/* VoiceOver reads a control by its accessible name. A button that shows
   only a symbol (➤, ✕, −, ＋) and carries no label is read as just
   "button" — useless to a child who cannot see it. This walks the real
   accessibility tree (what VoiceOver and TalkBack are given) over the
   game's main screens, in both languages:
     English — every control has a name with actual words in it;
     Hebrew  — no control is still named in English only.
   Run: NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node test/a11y.js */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const LAUNCH = fs.existsSync(CHROME) ? { executablePath: CHROME } : {};
const APP = 'file://' + path.join(ROOT, 'index.html');

let pass = 0, fail = 0;
const ck = (n, ok, d) => { ok ? pass++ : fail++;
  console.log((ok ? '  ✅ ' : '  ❌ ') + n + (ok ? '' : ' — ' + JSON.stringify(d))); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const CONTROLS = ['button', 'link', 'textbox', 'combobox', 'slider', 'tab', 'checkbox', 'menuitem'];

(async () => {
  const b = await chromium.launch(LAUNCH);
  for (const lang of ['en', 'he']) {
    console.log('▶ ' + (lang === 'en' ? 'English' : 'Hebrew'));
    const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
    const errs = []; pg.on('pageerror', e => errs.push(String(e)));
    const cdp = await pg.context().newCDPSession(pg);
    await pg.goto(APP); await wait(1200);
    if (lang === 'he') { await pg.evaluate(() => langSet('he')); await wait(900); }

    const bad = new Map();
    let seen = 0;
    const scan = async where => {
      await wait(400);
      const { nodes } = await cdp.send('Accessibility.getFullAXTree');
      for (const n of nodes) {
        const role = n.role && n.role.value;
        if (!CONTROLS.includes(role) || n.ignored || !n.backendDOMNodeId) continue;
        seen++;
        const name = ((n.name && n.name.value) || '').trim();
        const wrong = lang === 'en'
          ? !/[A-Za-z֐-׿0-9]/.test(name)            // nothing but symbols, or nothing
          : !!name && /[A-Za-z]/.test(name) && !/[֐-׿]/.test(name);  // English only
        if (!wrong) continue;
        const { node } = await cdp.send('DOM.describeNode', { backendNodeId: n.backendDOMNodeId });
        const a = node.attributes || []; const at = {};
        for (let i = 0; i < a.length; i += 2) at[a[i]] = a[i + 1];
        /* Three kinds of name are the same in every language, and are right
           to stay as they are: a robot's own name (the player chose it), a
           routine's name as it is written in code (A(), B()), and "3D". */
        if (lang === 'he') {
          const robotNames = await pg.evaluate(() => robots.map(r => r.name));
          if (robotNames.some(r => name.startsWith(r))) continue;
          if ((at.class || '').split(' ').includes('rtab')) continue;
          if (name === '3D') continue;
        }
        const key = (at.id ? '#' + at.id : '') + (at.class ? '.' + at.class.split(' ').join('.') : '') || node.nodeName;
        if (!bad.has(key)) bad.set(key, where + ' · ' + role + ' · ' + JSON.stringify(name));
      }
    };

    await scan('age gate');
    await pg.selectOption('#ageMonth', '6');
    await pg.selectOption('#ageYear', String(new Date().getFullYear() - 30));
    await pg.click('#ageGo'); await scan('splash');
    await pg.evaluate(() => $('playBtn').click()); await wait(1500);
    await pg.evaluate(() => { const c = document.querySelector('#ccCele .cc-cta'); if (c) c.click(); });
    await scan('world and editor');
    await pg.evaluate(() => { navHome(); hubOpen(); }); await scan('menu');
    await pg.evaluate(() => { navHome(); player.level = 20; if (typeof renderProjects === 'function') renderProjects();
      $('projects').classList.add('open'); }); await scan('projects');
    await pg.evaluate(() => { navHome(); mgEnterCreator(); }); await wait(600);
    await pg.evaluate(() => setTab('design')); await scan('creator, design');
    await pg.evaluate(() => setTab('blocks')); await scan('creator, blocks');
    await pg.evaluate(() => { navHome(); if (typeof settingsOpen === 'function') settingsOpen(); }); await scan('settings');
    await pg.evaluate(() => { navHome(); if (typeof styleOpen === 'function') styleOpen(); }); await scan('style');

    /* the scan has to have looked at something for "none were bad" to mean anything */
    ck(`${lang}: the scan read the controls on nine screens`, seen > 200, seen);
    ck(lang === 'en'
         ? 'every control has a name VoiceOver can read'
         : 'no control is still named in English only',
       bad.size === 0, [...bad].map(([k, v]) => k + ' (' + v + ')'));
    ck(`${lang}: no uncaught exceptions`, errs.length === 0, errs.slice(0, 3));
    await pg.close();
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
