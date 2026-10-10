/* Stable: nothing moves by itself (.claude/skills/game-app-design §4;
   docs/ux-roadmap.md topic 2).
   Run: NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node test/stable.js */
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
  await pg.addInitScript(() => {
    window.__shifts = [];
    try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__shifts.push({ t: e.startTime, v: e.value }); })
      .observe({ type: 'layout-shift', buffered: true }); } catch (_) {}
  });
  await pg.goto(APP); await wait(1100);
  await pg.selectOption('#ageMonth', '6');
  await pg.selectOption('#ageYear', String(new Date().getFullYear() - 30));
  await pg.click('#ageGo'); await wait(400);
  await pg.evaluate(() => $('playBtn').click()); await wait(1600);
  await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    HELD.length = 0; document.querySelectorAll('#ccCele').forEach(e => e.remove());
    if (mgState) mgExit(false); navHome(); await wait(400);
    if ($('editor').classList.contains('max')) $('edMax').click();
    await wait(600);
  });

  console.log('▶ a size change glides; it does not jump or relayout per frame');
  const S = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    academyEnter(0); await wait(700);
    const ed = $('editor');
    const tops = [];
    $('edMax').click();
    for (let i = 0; i < 40; i++) { await new Promise(r => requestAnimationFrame(r)); tops.push(ed.getBoundingClientRect().top); }
    const steps = tops.slice(1).map((t, i) => Math.abs(t - tops[i]));
    const out = { first: Math.round(tops[0]), last: Math.round(tops[tops.length - 1]), biggest: Math.round(Math.max(...steps)),
      heightCurve: /height/.test(getComputedStyle(ed).transitionProperty) };
    $('edMax').click(); await wait(700);
    mgExit(false); await wait(300);
    return out;
  });
  /* from half height (top ~370) to full (~50): 320px, over many frames —
     never most of it in one */
  ck('the top edge travels from where it was, over many frames', S.first > 250 && S.last < 90 && S.biggest < 120, S);
  ck('and height is never on a curve (a layout on every frame)', S.heightCurve === false, S);

  console.log('▶ every page\'s header is the same height');
  const H = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const h = id => { const e = document.querySelector('#' + id + ' > .m-head'); return e ? Math.round(e.getBoundingClientRect().height) : null; };
    const out = {};
    hubOpen(); await wait(300); out.hub = h('hub');
    for (const k of ['academy', 'community', 'account', 'puzzles']) { hubPage(k); await wait(250); out[k] = h('projects'); }
    navHome(); await wait(250); openSettings(); await wait(250); out.settings = h('settings');
    navHome(); await wait(250); ordersOpen(); await wait(250); out.orders = h('orders');
    navHome(); await wait(300);
    return out;
  });
  ck('a one-line and a two-line subtitle make the same header', new Set(Object.values(H)).size === 1, H);

  console.log('▶ the board keeps its size');
  const B = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const lv = PUZZLE_PACKS.find(p => p.id === 'algo').stages[0];   // a run fills the text under it
    const p = JSON.parse(JSON.stringify(lv)); p.id = 'stable_b';
    mgEnter(p); await wait(700);
    const size = () => { const r = $('mgCanvas').getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); };
    const before = size(), readBefore = $('mgRead').scrollHeight;
    applyProg(mgRobot, lv.sol); renderProgram(); mgRun();
    for (let i = 0; i < 300 && mgState && mgState.running; i++) await wait(40);
    await wait(700);
    const out = { before, after: mgState ? size() : null, readBefore, readAfter: mgState ? $('mgRead').scrollHeight : null };
    document.querySelectorAll('#ccCele').forEach(e => e.remove());
    if (mgState) mgExit(false); await wait(300);
    return out;
  });
  ck('the text under the board changes during a run, the board does not',
    B.after === B.before, B);

  console.log('▶ a Tower level at half height');
  const T = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    t3Enter(TOWER_LEVELS[0]); await wait(900);
    const c = $('mgCanvas').getBoundingClientRect(), l = $('t3RotL').getBoundingClientRect(), r = $('t3RotR').getBoundingClientRect();
    const out = { h: Math.round(c.height), w: Math.round(c.width),
      leftOf: l.right <= c.left + 1, rightOf: r.left >= c.right - 1,
      besideV: l.top < c.bottom && l.bottom > c.top,
      legendHidden: getComputedStyle(document.querySelector('#t3Bar .t3key')).display === 'none' };
    $('edMax').click(); await wait(700);
    out.fullBar = getComputedStyle($('t3Bar')).display !== 'contents' &&
      getComputedStyle(document.querySelector('#t3Bar .t3key')).display !== 'none';
    $('edMax').click(); await wait(600);
    mgExit(false); await wait(300);
    return out;
  });
  ck('the rotate buttons sit beside the board, not in a row under it',
    T.leftOf && T.rightOf && T.besideV, T);
  ck('which leaves the board the height the row used to take', T.h >= 125, T);
  ck('at full height the whole camera row, legend and all, is back', T.fullBar === true, T);

  console.log('▶ designing, the board you design is the big thing');
  /* The box of tools used to get up to 70% of the tab: at half height a
     designer board came out 96×66 in every kind of level. */
  const D = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    window.confirm = () => true;
    mgEnterCreator(); await wait(600); setTab('board');
    if ($('editor').classList.contains('max')) $('edMax').click();
    await wait(700);
    const h = () => { mgFitReset(); mgDraw(); return Math.round($('mgCanvas').getBoundingClientRect().height); };
    const out = { flat: h() };
    $('t3Btn').click(); await wait(500); setTab('board'); $('t3View').click(); await wait(500); out.tower = h();
    $('cyBtn').click(); await wait(600); setTab('board'); await wait(200); out.cyber = h();
    mgExit(false); await wait(300);
    return out;
  });
  ck('at half height the designer board is no longer a thumbnail — flat, Tower and Cyber',
    D.flat >= 130 && D.tower >= 130 && D.cyber >= 100, D);

  console.log('▶ nothing moves after the player stops touching it');
  await pg.keyboard.press('Shift');          // the tap that opens the designer
  const C = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const t0 = performance.now();
    mgEnterCreator(); await wait(1600);
    const late = window.__shifts.filter(s => s.t > t0);
    mgExit(false); await wait(300);
    return { late: +late.reduce((a, s) => a + s.v, 0).toFixed(3), n: late.length };
  });
  ck('opening the designer: no layout shift once the tap is answered', C.late < 0.02, C);

  /* The Orders sheet was rewritten every second while open, which replaced
     its buttons under the finger: a press held across a rewrite ended on a
     different element and was no click at all. The clock ticks in place. */
  const O = await pg.evaluate(async () => {
    if (mgState) mgExit(false); navHome();
    marketReady(); market.order = { need: { wood: 12 }, got: {}, until: now + 300000, reward: 99, shape: 'spread', at: now };
    ordersOpen();
    const clk = () => (document.querySelector('#ordBody .ord-clk') || {}).textContent;
    const btn = $('ordCode'), t0 = clk();
    await new Promise(r => setTimeout(r, 2300));
    const out = { sameButton: $('ordCode') === btn, t0, t1: clk() };
    ordersClose(); market.order = null;
    return out;
  });
  ck('the Orders sheet keeps its buttons while its clock ticks', O.sameButton === true && O.t0 !== O.t1, O);

  /* Quests rebuilt its list on every robot step while a walk quest was on
     it: with three robots walking, a 600ms press on Claim paid 0 times in
     5. A step moves the numbers; the list only changes shape when a quest
     becomes claimable. */
  const Q = await pg.evaluate(() => {
    player.quests = [{ id: 'say1', prog: 1, noted: true }, { id: 'walk150', prog: 3, noted: false }, { id: 'wood10', prog: 0, noted: false }];
    renderQuests(); $('quests').classList.add('open');
    const btn = document.querySelector('#questList .quest button');
    for (let i = 0; i < 5; i++) qProg('walk');
    const out = { sameButton: document.querySelector('#questList .quest button') === btn,
      shown: [...document.querySelectorAll('#questList .qn')].map(n => n.textContent) };
    qProg('walk', null, 200);
    out.claimable = document.querySelectorAll('#questList .quest button').length;
    $('quests').classList.remove('open');
    return out;
  });
  ck('a robot step moves the quest numbers, not the Claim button under the finger',
     Q.sameButton === true && Q.shown[1] === '8/150', Q);
  ck('and a quest that becomes claimable still gets its button', Q.claimable === 2, Q);

  /* Build mode: picking a piece rebuilt the bar and threw the row back to
     its start; and a placed piece's menu opened on top of the bar. */
  const BB = await pg.evaluate(async () => {
    navHome(); $('buildBtn').click(); await new Promise(r => setTimeout(r, 300));
    const row = () => document.querySelector('#buildBar .bb-items');
    const fadeAtStart = row().classList.contains('fade-r') && !row().classList.contains('fade-l');
    row().scrollLeft = 1e4; await new Promise(r => setTimeout(r, 100));
    const items = [...row().querySelectorAll('.bb-item')]; items[items.length - 1].click();
    await new Promise(r => setTimeout(r, 150));
    const sel = row().querySelector('.bb-item.sel').getBoundingClientRect(), rr = row().getBoundingClientRect();
    const out = { fadeAtStart, kept: sel.left >= rr.left - 1 && sel.right <= rr.right + 1,
      fadeAtEnd: row().classList.contains('fade-l') && !row().classList.contains('fade-r') };
    const k = [...objects.keys()].find(k => objects.get(k).type === 'chest');
    openObjMenu(k, objects.get(k), innerWidth / 2, innerHeight / 2); await new Promise(r => setTimeout(r, 350));
    out.menuAbove = $('objMenu').getBoundingClientRect().bottom <= $('buildBar').getBoundingClientRect().top + 1;
    closeObjMenu(); $('buildBtn').click();
    return out;
  });
  ck('a picked build piece stays where the row was scrolled', BB.kept === true, BB);
  ck('the row fades only on the side with more beyond it', BB.fadeAtStart && BB.fadeAtEnd, BB);
  ck("a placed piece's menu opens above the build bar, not on it", BB.menuAbove === true, BB);

  ck('no uncaught exceptions', errs.length === 0, errs.slice(0, 3));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
