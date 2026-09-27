/* One design language, as numbers (docs/design-audit.md).
   Stage 2: every piece of text on every page is one of six sizes and three
   weights — the tokens in css/apple.css. It was sixteen sizes and five
   weights, each added by whichever feature came along; this is what stops
   the seventeenth.
   Run: NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node test/design.js */
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

/* the scale, and the wordmark on the splash (a logo, not a size) */
const SIZES = ['11px', '12.5px', '14.5px', '16.5px', '22px', '33px', '48px'];
const WEIGHTS = ['400', '600', '700'];

(async () => {
  console.log('▶ the stylesheets name the tokens, not numbers');
  const css = fs.readdirSync(path.join(ROOT, 'css')).filter(f => f.endsWith('.css'))
    .map(f => [f, fs.readFileSync(path.join(ROOT, 'css', f), 'utf8')]);
  const stray = [];
  for (const [f, src] of css) {
    const body = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@font-face\s*\{[^}]*\}/g, '');
    for (const m of body.matchAll(/font-weight:\s*(\d{3}|bold|bolder|lighter)/g)) stray.push(f + ': ' + m[0]);
  }
  ck('no font-weight is typed as a number outside the tokens', stray.length === 0, stray.slice(0, 8));

  const b = await chromium.launch(LAUNCH);
  const pg = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const errs = [];
  pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto(APP); await wait(1100);
  /* what text on this page is set in, and anything off the scale */
  const survey = (name) => pg.evaluate(([name, SIZES, WEIGHTS]) => {
    const sizes = new Set(), weights = new Set(), off = [];
    for (const e of document.querySelectorAll('body *')) {
      if (e.closest('svg,canvas,.ui-emoji')) continue;
      const own = [...e.childNodes].some(n => n.nodeType === 3 && /[A-Za-z֐-׿0-9]/.test(n.nodeValue));
      if (!own) continue;
      const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
      const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      sizes.add(cs.fontSize); weights.add(cs.fontWeight);
      if (!SIZES.includes(cs.fontSize) || !WEIGHTS.includes(cs.fontWeight))
        off.push(name + ': ' + (e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0]) +
          ' ' + cs.fontSize + '/' + cs.fontWeight + ' "' + e.textContent.trim().slice(0, 24) + '"');
    }
    return { sizes: [...sizes], weights: [...weights], off };
  }, [name, SIZES, WEIGHTS]);

  console.log('▶ every page is set in the six sizes and three weights');
  const seen = { sizes: new Set(), weights: new Set(), off: [] };
  const add = s => { s.sizes.forEach(x => seen.sizes.add(x)); s.weights.forEach(x => seen.weights.add(x)); seen.off.push(...s.off); };
  add(await survey('age gate'));
  await pg.selectOption('#ageMonth', '6');
  await pg.selectOption('#ageYear', String(new Date().getFullYear() - 30));
  await pg.click('#ageGo'); await wait(400);
  add(await survey('splash'));
  await pg.evaluate(() => $('playBtn').click()); await wait(2400);
  await pg.evaluate(() => { player.fresh = false; HELD.length = 0; document.querySelectorAll('#ccCele').forEach(e => e.remove());
    if (mgState) mgExit(false); navHome(); });
  const pages = [
    ['world', 'navHome()'], ['menu', 'hubOpen()'],
    ['academy', "hubOpen();hubPage('academy')"], ['chapters', "hubOpen();hubPage('puzzles')"],
    ['cyber', "hubOpen();hubPage('cyber')"], ['account', "hubOpen();hubPage('account')"],
    ['shop', 'openShop()'], ['style', 'styleOpen()'], ['settings', 'openSettings()'],
    ['orders', 'ordersOpen()'], ['quests', "renderQuests();$('quests').classList.add('open')"],
    ['functions', 'openFuncLib()'], ['guide', 'openGuide()'], ['mentor', "$('mentor').classList.add('open')"],
    ['market', "$('ticker').classList.add('open');renderMarket()"],
    ['editor', "$('editor').classList.add('open');setTab('blocks');renderProgram()"],
    ['a level', "packEnter(PUZZLE_PACKS[1],0)"], ['a lesson', 'academyEnter(2)'],
    ['a tower level', 't3Enter(TOWER_LEVELS[1])'],
    ['the designer', "window.confirm=()=>true;mgEnterCreator();setTab('board')"],
  ];
  for (const [name, js] of pages) {
    await pg.evaluate(() => { document.querySelectorAll('#ccCele').forEach(e => e.remove());
      $('shopWrap').classList.remove('open'); if (mgState) mgExit(false); navHome(); });
    await wait(250);
    await pg.evaluate(js); await wait(700);
    add(await survey(name));
  }
  await pg.evaluate(() => { setTab('design'); }); await wait(400);
  add(await survey('the designer, design tab'));
  await pg.evaluate(() => { if (mgState) mgExit(false); navHome();
    CC_EXTRAS.celebrate('✅', 'Lesson 1 of 10', 'First Steps', 'Next', 'Next lesson ▶', { alt: 'Not now' }); });
  await wait(600);
  add(await survey('win card'));

  const sizes = [...seen.sizes].sort((a, b) => parseFloat(a) - parseFloat(b));
  ck('text comes in at most the six sizes and the wordmark (it was 16)', sizes.every(s => SIZES.includes(s)), sizes);
  ck('and in three weights — Fredoka has no heavier (it was 5)', [...seen.weights].every(w => WEIGHTS.includes(w)), [...seen.weights]);
  ck('nothing on any page is off the scale', seen.off.length === 0, seen.off.slice(0, 10));

  ck('no uncaught exceptions', errs.length === 0, errs.slice(0, 3));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
