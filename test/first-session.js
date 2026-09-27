/* First session: one thing at a time (.claude/skills/game-app-design §7;
   docs/ux-roadmap.md topic 7).
   Run: NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node test/first-session.js */
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
    try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__shifts.push({ t: e.startTime, v: e.value }); })
      .observe({ type: 'layout-shift', buffered: true }); } catch (_) {}
    /* the chip row's height on every frame of the load */
    window.__feats = [];
    const T = () => { const f = document.querySelector('#splash .feats');
      if (f) window.__feats.push(Math.round(f.getBoundingClientRect().height));
      if (performance.now() < 1500) requestAnimationFrame(T); };
    requestAnimationFrame(T);
    /* everything that asks for the player's attention */
    window.__seen = [];
    new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) {
      if (n.nodeType !== 1) continue;
      if (n.id === 'ccCele') __seen.push('card: ' + n.textContent.trim().slice(0, 40));
      if (n.parentElement && n.parentElement.id === 'toasts') __seen.push('toast: ' + n.textContent.trim().slice(0, 40));
    } }).observe(document, { childList: true, subtree: true });
  });

  console.log('▶ the splash holds still while it loads');
  await pg.goto(APP); await wait(1400);
  const S = await pg.evaluate(() => ({ heights: [...new Set(window.__feats)],
    icons: document.querySelectorAll('#splash .feats .ui-emoji').length,
    cls: +window.__shifts.reduce((a, s) => a + s.v, 0).toFixed(3) }));
  ck('the feature chips are one shape before and after their icons arrive',
    S.heights.length === 1 && S.icons >= 5, S);
  ck('loading the splash moves almost nothing (layout shift < 0.05)', S.cls < 0.05, S);

  console.log('▶ a brand-new player meets the Academy, and nothing else');
  await pg.selectOption('#ageMonth', '6');
  await pg.selectOption('#ageYear', String(new Date().getFullYear() - 10));
  await pg.click('#ageGo'); await wait(400);
  await pg.evaluate(() => { __seen.length = 0; $('playBtn').click(); });
  await wait(10500);   // the old daily gift fired 9s in
  const A = await pg.evaluate(() => ({ lesson: !!mgState && mgState.proj.id === TUTS[0].id,
    seen: __seen.slice(), held: HELD.map(h => h.key), coins, order: !!(market && market.order) }));
  ck('lesson 1 opens by itself', A.lesson === true, A);
  ck('and nothing is shown or waiting behind it — no gift, no order, no news',
    A.seen.length === 0 && A.held.length === 0 && A.order === false, A);
  ck('day one\'s gift is in the starting purse instead', A.coins === 25, A);

  const W = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    __seen.length = 0;
    mgExit(false); navHome(); await wait(1500);
    const m = marketReady();
    m.orderNext = 1; m.wantAt = 1; m.eventAt = 1;   // everything is due
    marketTick(); renderMarket(); await wait(300);
    return { seen: __seen.slice(), order: !!m.order, event: !!m.event,
      ticker: getComputedStyle($('ticker')).display !== 'none' };
  });
  ck('back in the world after a lesson: no card, no toast', W.seen.length === 0, W);
  ck('the market sleeps: no order, no event, no ticker in the HUD',
    !W.order && !W.event && !W.ticker, W);

  console.log('▶ graduation wakes the world');
  const G = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const m = marketReady();
    m.wantAt = 0; m.eventAt = 0; m.orderNext = 0;   // as they are after a real sleep: never armed
    for (let i = 0; i < ACADEMY_CORE; i++) player.academy[TUTS[i].id] = 1;
    __seen.length = 0;
    marketTick(); renderMarket(); await wait(300);
    // waking is not a burst: the clocks start now, nothing is announced yet
    const market_ = __seen.filter(s => /📋|📈|📣|🌙|💎/.test(s));   // the journey's own ✅ is a response, not news
    const out = { quietWake: market_.length === 0 && !m.event && !m.order, seenAtWake: __seen.slice(),
      wantIn: m.wantAt - now, eventIn: m.eventAt - now, orderIn: m.orderNext - now };
    m.orderNext = 1; marketTick(); renderMarket(); await wait(1500);
    Object.assign(out, { order: !!m.order, ticker: getComputedStyle($('ticker')).display !== 'none',
      told: __seen.some(s => /order/i.test(s)), fresh: player.fresh });
    // and it stays awake, whatever happens to the academy record
    player.academy = {}; out.stays = marketAwake();
    return out;
  });
  ck('waking is quiet: the market\'s clocks start then, nothing fires at once',
    G.quietWake && G.wantIn > 5000 && G.eventIn > 5000 && G.orderIn > 3000, G);
  ck('the first order arrives, and the ticker with it', G.order && G.ticker, G);
  ck('and the player hears about it, in the world', G.told === true, G);
  ck('once awake it stays awake', G.fresh === false && G.stays === true, G);

  console.log('▶ the daily gift starts on day two');
  const D = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    HELD.length = 0; clearTimeout(heldT); heldT = 0; $('toasts').innerHTML = '';
    const again = coins; dailyGift(); const sameDay = coins === again;
    player.lastGift = new Date(Date.now() - 864e5).toDateString();
    __seen.length = 0; dailyGift(); await wait(1200);
    return { sameDay, seen: __seen.slice() };
  });
  ck('no second gift on the first day', D.sameDay === true, D);
  ck('the next day it is "Day 2"', D.seen.some(s => /Day 2/.test(s)), D);

  console.log('▶ a save from before this rule is untouched');
  const O = await pg.evaluate(() => { delete player.fresh; player.academy = {}; player.level = 1; return marketAwake(); });
  ck('an old save with an unfinished Academy still has its market', O === true, O);

  ck('no uncaught exceptions', errs.length === 0, errs.slice(0, 3));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
