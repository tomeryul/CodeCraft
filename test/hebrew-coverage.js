/* Every screen, in Hebrew, with nothing left in English
   (docs/design-audit.md, stage 6).
   test/hebrew.js checks that the Hebrew layer works; this one walks the
   whole game in Hebrew — every page, level, designer, card — and fails on
   any English word still on screen, in the text or in a label VoiceOver
   reads (aria-label, title, placeholder). A new string shipped without its
   translation fails here, instead of reaching a child who reads Hebrew.
   Run: NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node test/hebrew-coverage.js */
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

/* Words that are right in Latin letters in Hebrew too: names (the game,
   the mentor, a robot, the language Python), the "English" button that
   names the other language, 2D/3D, and the web-page maker's CSS words,
   which are code — and "builder", the name a new player starts with until
   they pick one (it is their name, and it is what their published levels
   carry). Anything else in Latin letters is a missing translation. */
const OK = /^(CodeCraft|Byte|Robo|Python|AI|2D|3D|HTML|CSS|px|English|kid|example|com|margin|border|padding|content|hat|div|span|class|id|builder|v\d+|x\d+)$/;

const PAGES = [
  ['the world', 'navHome()'],
  ['the menu', 'hubOpen()'],
  ...['academy', 'puzzles', 'builds', 'tower', 'cyber', 'mine', 'community', 'account'].map(k => ['page: ' + k, `hubOpen();hubPage('${k}')`]),
  ['the shop', 'openShop()'], ['style', 'styleOpen()'], ['settings', 'openSettings()'],
  ['orders', 'ordersOpen()'], ['quests', "renderQuests();$('quests').classList.add('open')"],
  ['my functions', 'openFuncLib()'], ['the design guide', 'openGuide()'], ['Byte', "$('mentor').classList.add('open')"],
  ['the market panel', "navHome();$('ticker').classList.add('open');renderMarket()"],
  ['the editor', "$('editor').classList.add('open');setTab('blocks');renderProgram()"],
  ['a level', 'packEnter(PUZZLE_PACKS[1],0)'], ['its blocks', "packEnter(PUZZLE_PACKS[1],0);setTab('blocks')"],
  ['a lesson, full height', "academyEnter(2);$('edMax').click()"],
  ['a tower level', 't3Enter(TOWER_LEVELS[1])'], ['a cyber level', 'CC_CYBER.enter(CC_CYBER.levels[0])'],
  ['an errand', "packEnter(PUZZLE_PACKS.find(p=>p.id==='errands'),0)"],
  ['the designer', "window.confirm=()=>true;mgEnterCreator();setTab('board')"],
  ['the designer, design tab', "window.confirm=()=>true;mgEnterCreator();setTab('design')"],
  ['the designer in 3D', "window.confirm=()=>true;mgEnterCreator();setTab('board');t3SetMode(true)"],
  ['the designer in Cyber', "window.confirm=()=>true;mgEnterCreator();setTab('board');$('cyBtn').click()"],
];

(async () => {
  const b = await chromium.launch(LAUNCH);
  const pg = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const errs = [];
  pg.on('pageerror', e => errs.push(String(e)));
  await pg.addInitScript(() => { try { localStorage.setItem('codecraft_lang', 'he'); } catch (_) {} });
  await pg.goto(APP); await wait(1300);

  const scan = where => pg.evaluate(([where, okSrc]) => {
    const OK = new RegExp(okSrc), found = [];
    const vis = e => { if (!e) return false; const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false;
      const c = getComputedStyle(e); return c.visibility !== 'hidden' && c.display !== 'none'; };
    const english = t => (t.match(/[A-Za-z][A-Za-z'’-]*[A-Za-z]/g) || []).filter(w => !OK.test(w));
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) {
      const p = n.parentElement;
      if (!p || !vis(p) || p.closest('script,style,pre,code,textarea,#pyTab,#pyCode,.mono,svg,#delWho')) continue;
      const t = n.nodeValue.replace(/\s+/g, ' ').trim();
      if (t && english(t).length) found.push(where + ': "' + t.slice(0, 70) + '"');
    }
    for (const e of document.querySelectorAll('[aria-label],[title],[placeholder]')) {
      if (!vis(e)) continue;
      for (const a of ['aria-label', 'title', 'placeholder']) {
        const v = e.getAttribute(a);
        if (v && english(v).length) found.push(where + ': @' + a + ' "' + v.slice(0, 60) + '"');
      }
    }
    return found;
  }, [where, OK.source]);

  console.log('▶ from the first screen');
  const first = await scan('the age gate');
  await pg.selectOption('#ageMonth', '6');
  await pg.selectOption('#ageYear', String(new Date().getFullYear() - 30));
  await pg.click('#ageGo'); await wait(600);
  first.push(...await scan('the splash'));
  ck('the age gate and the splash are all Hebrew', first.length === 0, first.slice(0, 6));

  console.log('▶ every page, level and designer');
  await pg.evaluate(() => $('playBtn').click()); await wait(2500);
  await pg.evaluate(() => { player.fresh = false; for (let i = 0; i < 6; i++) player.academy[TUTS[i].id] = 1; HELD.length = 0; });
  const left = [];
  for (const [name, js] of PAGES) {
    await pg.evaluate(() => { document.querySelectorAll('#ccCele').forEach(e => e.remove()); $('shopWrap').classList.remove('open');
      if (mgState) mgExit(false); navHome(); if ($('editor').classList.contains('max')) $('edMax').click(); });
    await wait(300);
    await pg.evaluate(js); await wait(900);
    left.push(...await scan(name));
  }
  const uniq = [...new Set(left.map(s => s.replace(/^[^:]*: /, '')))];
  ck(PAGES.length + ' surfaces, and not one English word on any of them', uniq.length === 0, uniq.slice(0, 10));

  console.log('▶ a label that changes after it arrives');
  const L = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    if (mgState) mgExit(false); navHome(); await wait(300);
    packEnter(PUZZLE_PACKS[1], 0); await wait(700);
    const b = $('edMax'), before = b.getAttribute('title');
    b.click(); await wait(600);
    const after = b.getAttribute('title');
    b.click(); await wait(400); mgExit(false);
    return { before, after };
  });
  ck('the size button\'s title is Hebrew both before and after it flips', !/[A-Za-z]{3}/.test(L.before + L.after), L);

  ck('no uncaught exceptions', errs.length === 0, errs.slice(0, 3));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
