/* Performance: draw only what can be seen, never resize a canvas per
   frame, no DOM churn at idle (.claude/skills/game-app-design §9;
   docs/ux-roadmap.md topic 6).
   Run: NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node test/perf.js */
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

(async () => {
  const b = await chromium.launch(LAUNCH);
  const pg = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const errs = [];
  pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto(APP); await wait(1100);
  await pg.selectOption('#ageMonth', '6');
  await pg.selectOption('#ageYear', String(new Date().getFullYear() - 30));
  await pg.click('#ageGo'); await wait(400);
  await pg.evaluate(() => $('playBtn').click()); await wait(1600);
  await pg.evaluate(() => {
    window.__home = async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      HELD.length = 0; clearTimeout(heldT); heldT = 0;
      document.querySelectorAll('#ccCele').forEach(e => e.remove());
      if (mgState) mgExit(false); navHome(); await wait(500);
      if ($('editor').classList.contains('max')) $('edMax').click();
      await wait(400);
    };
    /* what changed in the page, and how often the world was painted, over ms */
    window.__watch = async ms => {
      const by = {}; let draws = 0, boards = 0;
      const mo = new MutationObserver(l => { for (const m of l) {
        const t = m.target.nodeType === 1 ? m.target : m.target.parentElement;
        const k = m.type + ':' + (t ? t.id || t.className || t.tagName : '?') + (m.attributeName ? '[' + m.attributeName + ']' : '');
        by[k] = (by[k] || 0) + 1; } });
      mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
      const od = window.draw, om = window.mgDraw;
      window.draw = function () { draws++; return od.apply(this, arguments); };
      window.mgDraw = function () { boards++; return om.apply(this, arguments); };
      await new Promise(r => setTimeout(r, ms));
      mo.disconnect(); window.draw = od; window.mgDraw = om;
      return { draws, boards, by, total: Object.values(by).reduce((a, n) => a + n, 0) };
    };
  });

  console.log('▶ a board is drawn every frame, but its canvas is not resized every frame');
  const L = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    await __home();
    const out = {};
    for (const [k, go] of [['flat', () => packEnter(PUZZLE_PACKS[0], 0)], ['tower', () => t3Enter(TOWER_LEVELS[0])]]) {
      go(); await wait(900);
      const w = await __watch(1000);
      const canvasWrites = Object.entries(w.by).filter(([k2]) => /mgCanvas/.test(k2)).reduce((a, [, n]) => a + n, 0);
      // and it is still a picture: the middle of the board is not blank
      const cv = $('mgCanvas'), g = cv.getContext('2d');
      const px = g.getImageData(cv.width >> 1, cv.height >> 1, 1, 1).data;
      const w0 = cv.width;
      $('edMax').click(); await wait(700);
      out[k] = { boards: w.boards, canvasWrites, painted: px[3] > 0, resizes: cv.width !== w0 };
      $('edMax').click(); await wait(500);
      mgExit(false); await wait(300);
    }
    return out;
  });
  for (const k of ['flat', 'tower']) {
    ck(k + ': the board keeps animating', L[k].boards > 30, L[k]);
    ck(k + ': with no canvas size written while nothing changed size', L[k].canvasWrites === 0, L[k]);
    ck(k + ': and it is not blank', L[k].painted === true, L[k]);
    ck(k + ': when the sheet changes size, the canvas does follow', L[k].resizes === true, L[k]);
  }

  console.log('▶ the world is not painted where it cannot be seen');
  const W = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    await __home();
    const out = { world: (await __watch(600)).draws };
    hubOpen(); await wait(600);
    out.half = (await __watch(600)).draws;
    $('edMax').click(); await wait(700);
    out.full = (await __watch(600)).draws;
    navHome(); await wait(400);
    out.after = (await __watch(600)).draws;
    return out;
  });
  ck('in the world, it is drawn every frame', W.world > 20, W);
  ck('under a half sheet, where it shows, it still is', W.half > 20, W);
  ck('under a sheet at full height, it is not drawn at all', W.full === 0, W);
  ck('and it is drawn again as soon as the sheet is gone', W.after > 20, W);

  const D = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    hubOpen(); await wait(600);
    const covered = (await __watch(300)).draws;
    // a press on the sheet may be the start of a drag that shows the world
    document.querySelector('#hub').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const pressed = (await __watch(200)).draws;
    await __home();
    return { covered, pressed };
  });
  ck('a press on a full sheet (maybe a drag) brings the world back at once',
    D.covered === 0 && D.pressed > 5, D);

  console.log('▶ nothing is rewritten at idle');
  const I = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    await __home();
    // an order on the clock: the ticker's timer ticks, the rest stands still
    const m = marketReady();
    m.order = { need: { wood: 3 }, got: {}, reward: 10, until: now + 120000, at: now };
    renderMarket(); await wait(300);
    const w = await __watch(3000);
    const rebuilt = Object.entries(w.by).filter(([k]) => /^childList:(ticker|journey)$/.test(k));
    return { total: w.total, rebuilt, by: w.by, clock: !!document.querySelector('#ticker .tk-clk') };
  });
  ck('the market ticker and the journey bar are not rebuilt every second', I.rebuilt.length === 0, I.by);
  ck('the world at idle writes a handful of text nodes a second, not markup', I.total <= 30, I.by);

  const V = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const r = R(); r.vars = { x: 3 };
    $('editor').classList.add('open'); updateExecHighlight();
    const w = await __watch(1200);
    const out = { varWrites: Object.entries(w.by).filter(([k]) => /varWatch/.test(k)).length, shown: $('varWatch').textContent };
    r.vars.x = 4; updateExecHighlight(); out.updated = $('varWatch').textContent;
    r.vars = {}; updateExecHighlight(); $('editor').classList.remove('open');
    await __home();
    return out;
  });
  ck('the variable watch is not rebuilt while its values stand still', V.varWrites === 0 && /x = 3/.test(V.shown), V);
  ck('and it is when a value changes', /x = 4/.test(V.updated), V);

  ck('no uncaught exceptions', errs.length === 0, errs.slice(0, 3));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
