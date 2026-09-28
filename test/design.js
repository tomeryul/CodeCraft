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
    /* stage 3: section titles, the header; stage 4: buttons */
    const vis = e => { const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 && getComputedStyle(e).visibility !== 'hidden'; };
    const secs = [...document.querySelectorAll('#hub .hub-sec,#hub .hub-nlab,.sheet h4.qsec,#projList .acad-grp,#projList .t3title,#projList .cy-act-n,#palette h4,#maker .mk-sect,#mgLesson .ls-sec,#styleBody .st-name')]
      .filter(vis).map(e => { const c = getComputedStyle(e); return c.fontSize + ' ' + c.fontWeight + ' ' + c.textTransform + ' ' + c.color; });
    const sheet = [...document.querySelectorAll('.sheet.open,#shopWrap.open')].pop();
    const hd = sheet && (sheet.querySelector(':scope > .m-head') || sheet.querySelector('.m-head') || sheet.querySelector('.v5-head'));
    let head = null;
    if (hd && vis(hd)) {
      const sub = hd.querySelector('p,small'), ttl = hd.querySelector('h3,b');
      head = { h: Math.round(hd.getBoundingClientRect().height),
        subCut: !!sub && vis(sub) && sub.scrollWidth > sub.clientWidth + 1,
        titleIcon: !!ttl && [...ttl.querySelectorAll('.ui-emoji')].some(vis) };
    }
    /* the amber circle is "play this" — a ▶, or a row already done / locked */
    const amber = [...document.querySelectorAll('.pcard .pbadge')].filter(vis).filter(e => {
      const c = getComputedStyle(e); return c.backgroundImage !== 'none' && !e.closest('.done,.locked'); })
      .map(e => { const ic = e.querySelector('.ui-emoji'); return ((ic && ic.dataset.e) || e.textContent).trim(); })   // an icon keeps its glyph in data-e
      .filter(t => t !== '▶');
    /* purple is "selected", never a button's resting colour */
    const purple = [...document.querySelectorAll('button')].filter(vis).filter(b => !b.classList.contains('on') && !b.closest('#routineTabs,#ticker')).filter(b => {
      const c = getComputedStyle(b), bg = c.backgroundImage + ' ' + c.backgroundColor;
      return /(155, 107, 255|122, 77, 255|95, 52, 214|69, 58, 119)/.test(bg); })
      .map(b => (b.id ? '#' + b.id : '.' + String(b.className).split(' ')[0]) + ' "' + b.textContent.trim().slice(0, 18) + '"');
    return { sizes: [...sizes], weights: [...weights], off, secs, head, amber, purple };
  }, [name, SIZES, WEIGHTS]);

  console.log('▶ every page is set in the six sizes and three weights');
  const seen = { sizes: new Set(), weights: new Set(), off: [], secs: new Set(), heads: {}, cut: [], icon: [], amber: [], purple: [] };
  let where = '';
  const add = s => { s.sizes.forEach(x => seen.sizes.add(x)); s.weights.forEach(x => seen.weights.add(x)); seen.off.push(...s.off);
    s.secs.forEach(x => seen.secs.add(x));
    if (s.head) { seen.heads[where] = s.head.h; if (s.head.subCut) seen.cut.push(where); if (s.head.titleIcon) seen.icon.push(where); }
    s.amber.forEach(t => seen.amber.push(where + ': ' + t)); s.purple.forEach(t => seen.purple.push(where + ': ' + t)); };
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
    where = name; add(await survey(name));
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

  console.log('▶ stage 3 — one section title, one header');
  ck('every section title on every page is the same label (it was 8 styles)', seen.secs.size === 1, [...seen.secs]);
  const hs = new Set(Object.values(seen.heads));
  ck('every page header is the same height (it was 85, 75 and 71)', hs.size === 1, seen.heads);
  ck('no header subtitle is cut — each says it in one line', seen.cut.length === 0, seen.cut);
  ck('a page title is words, with no icon in front', seen.icon.length === 0, seen.icon);

  console.log('▶ stage 4 — one set of buttons');
  ck('the amber circle on a row only ever means "play this"', seen.amber.length === 0, seen.amber);
  ck('no button rests in purple — purple means "selected"', seen.purple.length === 0, seen.purple.slice(0, 6));
  const B = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const bg = e => { const c = getComputedStyle(e); return c.backgroundImage !== 'none' ? c.backgroundImage : c.backgroundColor; };
    const green = e => !!e && /(127, 226, 143|55, 200, 92|46, 158, 74|84, 214, 106)/.test(bg(e));
    const out = {};
    document.querySelectorAll('#ccCele').forEach(e => e.remove());
    CC_EXTRAS.celebrate('✅', 'Lesson 1 of 10', 'First Steps', 'Next', 'Next lesson ▶', { alt: 'Not now' }); await wait(500);
    out.cta = green(document.querySelector('#ccCele .cc-cta'));
    const alt = document.querySelector('#ccCele .cc-alt'); out.altH = alt ? Math.round(alt.getBoundingClientRect().height) : 0;
    document.querySelectorAll('#ccCele').forEach(e => e.remove());
    navHome(); $('mentor').classList.add('open'); await wait(400);
    out.send = green($('askSend') || document.querySelector('#askrow button'));
    navHome(); await wait(300);
    return out;
  });
  ck('the main action is green: the win card\'s Next, and Send to Byte', B.cta && B.send, B);
  ck('"Not now" is a quiet button a thumb can hit (44px), not bare words', B.altH >= 44, B);

  console.log('▶ stage 5 — the pages that were still their own thing');
  const P = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const vis = e => !!e && !!e.offsetParent;
    const home = async () => { document.querySelectorAll('#ccCele').forEach(e => e.remove()); if (mgState) mgExit(false); navHome(); await wait(300); };
    const out = {};
    await home(); hubOpen(); hubPage('mine'); await wait(500);
    const creates = [...document.querySelectorAll('#projList .pnew,#projList .t3new')].filter(vis);
    out.creates = creates.length;
    out.cyan = creates.some(c => getComputedStyle(c).backgroundImage !== 'none');
    await home(); await wait(300);
    const c = $('codeBtn').getBoundingClientRect(), b = $('buildBtn').getBoundingClientRect();
    out.pairGap = Math.round(b.left - c.right);
    out.pairSame = getComputedStyle($('codeBtn')).backgroundImage === getComputedStyle($('buildBtn')).backgroundImage &&
                   getComputedStyle($('codeBtn')).backgroundColor === getComputedStyle($('buildBtn')).backgroundColor;
    const ready = window.sbReady; window.sbReady = () => true;
    hubOpen(); hubPage('account'); await wait(500);
    const tog = document.querySelector('#authBox .authtoggle');
    out.signIn = tog ? { h: Math.round(tog.getBoundingClientRect().height), r: getComputedStyle(tog).borderTopLeftRadius } : null;
    window.sbReady = ready;
    await home(); renderQuests(); $('quests').classList.add('open'); await wait(400);
    out.questsLink = vis($('projBanner'));
    await home(); window.confirm = () => true; mgEnterCreator(); await wait(700); setTab('design'); await wait(300);
    const h = document.querySelector('.dsec .ds-t h4');
    out.cardTitle = h ? getComputedStyle(h).textTransform + ' ' + getComputedStyle(h).color : null;
    await home(); $('editor').classList.add('open'); setTab('blocks'); renderProgram(); await wait(400);
    const lm = document.querySelector('#palette .lockmsg');
    out.lockInk = lm ? getComputedStyle(lm).color : null;
    out.ink2 = getComputedStyle(document.documentElement).getPropertyValue('--ink2').trim();
    // "New tower level" makes a tower; "Tower Mode" is the page of tower levels
    await home(); hubOpen(); await wait(300);
    const tile = [...document.querySelectorAll('.hub-tile')].find(t => /New tower level/.test(t.textContent));
    if (tile) tile.click(); await wait(900);
    out.newTower = { designer3d: !!(mgState && mgState.proj.mode3d), towerPage: $('projects').classList.contains('open') };
    await home();
    return out;
  });
  ck('My Challenges has one way to start a level, not two', P.creates === 1, P);
  ck('and it is the dashed card, not a colour nothing else uses', P.cyan === false, P);
  ck('Code | Build is one control: the same surface, no gap through the middle', P.pairSame && P.pairGap <= 1, P);
  ck('"Sign in" is a row like the others (a card, not a strip)', !!P.signIn && P.signIn.h >= 56 && P.signIn.r === '16px', P);
  ck('Quests no longer has a second door into Build Projects', P.questsLink === false, P);
  ck('a designer card\'s title is a title, not amber capitals', !!P.cardTitle && !/uppercase/.test(P.cardTitle), P);
  ck('how to unlock a group of blocks is information, not amber', !!P.lockInk && !/255, 184, 48/.test(P.lockInk), P);
  ck('"New tower level" opens the designer in 3D — not the same page as "Tower Mode"',
    P.newTower && P.newTower.designer3d && !P.newTower.towerPage, P.newTower);

  ck('no uncaught exceptions', errs.length === 0, errs.slice(0, 3));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
