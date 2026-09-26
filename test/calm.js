/* Calm: a message is sorted by what caused it, and the world waits its
   turn (.claude/skills/game-app-design §3, §4; docs/ux-roadmap.md topic 1).
   Run: NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node test/calm.js */
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

  /* Everything below starts from the world, calm: nothing open, no level,
     no card, nothing held. */
  await pg.evaluate(() => {
    /* Back to the world with a clean slate. The queue is emptied FIRST and
       again at the end: anything still held from an earlier step (the game's
       own first daily gift, say) would otherwise surface in the middle of
       the next one and be mistaken for what that step produced. */
    window.__home = async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const drain = () => { HELD.length = 0; clearTimeout(heldT); heldT = 0; };
      drain();
      for (let i = 0; i < 4; i++) { const c = document.querySelector('#ccCele .cc-cta'); if (c) { c.click(); await wait(400); } }
      if (mgState) mgExit(false);
      navHome(); $('shopWrap').classList.remove('open');
      await wait(900);
      drain();
      const cc = document.getElementById('ccCele'); if (cc) cc.remove();
      $('toasts').innerHTML = '';
    };
    window.__lane = () => [...$('toasts').children].map(t => t.dataset.msg || t.textContent);
  });

  console.log('▶ world news waits for the world');
  const N = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    await __home();
    const out = {};
    out.calmInWorld = calmNow();
    worldNews('📣 news in the world', true);
    out.showsAtOnce = __lane().some(t => /news in the world/.test(t));
    await __home();
    hubOpen(); await wait(400);
    out.calmInMenu = calmNow();
    worldNews('📋 news over the menu', true);
    out.heldInMenu = !__lane().some(t => /over the menu/.test(t)) && HELD.length === 1;
    navHome(); await wait(1600);
    out.deliveredOnReturn = __lane().some(t => /over the menu/.test(t));
    return out;
  });
  ck('in the world, with nothing open, news shows at once', N.calmInWorld && N.showsAtOnce, N);
  ck('with a menu open, news is held, not shown', N.calmInMenu === false && N.heldInMenu, N);
  ck('and it arrives when the player is back in the world', N.deliveredOnReturn, N);

  const L = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    await __home();
    academyEnter(0); await wait(500);
    const out = { inLevel: calmNow() };
    // the robots fill an order in the background while the player is in a level
    const m = marketReady();
    m.order = { need: { wood: 1 }, got: {}, reward: 99, until: now + 60000, at: now };
    const c0 = coins;
    orderCredit('wood', 1);
    out.paid = coins - c0 === 99;
    await wait(300);
    out.cardInLevel = !!document.getElementById('ccCele');
    mgExit(false); navHome(); await wait(1500);
    out.cardInWorld = !!document.getElementById('ccCele') &&
      /ORDER FILLED/.test(document.getElementById('ccCele').textContent);
    return out;
  });
  ck('robots filling an order during a level: paid now', L.inLevel === false && L.paid, L);
  ck('but its full-screen card does not open inside the level', L.cardInLevel === false, L);
  ck('it opens back in the world', L.cardInWorld === true, L);

  const G = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    await __home();
    hubOpen(); await wait(300);
    worldNews('📈 stale price news', false, 200);   // true for 0.2s only
    worldNews('📋 an order', true);
    player.lastGift = ''; dailyGift();               // a reward: must never be lost
    const out = { held: HELD.map(h => h.key) };
    await wait(400);                                  // the price news is no longer true
    navHome(); await wait(1500);
    out.giftFirst = !!document.getElementById('ccCele') && /DAILY GIFT/.test(document.getElementById('ccCele').textContent);
    out.newsWhileCard = __lane().length === 0;       // nothing lands on top of the card
    const c = document.querySelector('#ccCele .cc-cta'); if (c) c.click();
    // watch the lane: what arrives, and that each one gets its time
    const seen = [], firstAt = {};
    const t0 = performance.now();
    for (let i = 0; i < 26; i++) {
      await wait(250);
      for (const t of __lane()) { if (!(t in firstAt)) { firstAt[t] = performance.now() - t0; seen.push(t); } }
    }
    out.after = seen;
    const at = Object.values(firstAt);
    out.spaced = at.length < 2 || at.every((v, i) => !i || v - at[i - 1] >= 2500);
    return out;
  });
  ck('a reward comes on its own, first', G.giftFirst && G.newsWhileCard, G);
  ck('then the news that is still true, and not the news that went stale',
    G.after.some(t => /an order/.test(t)) && !G.after.some(t => /stale price/.test(t)), G.after);
  ck('one at a time, each given its time before the next', G.spaced === true, G);

  console.log('▶ one lane, and it lets taps through');
  const T = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    await __home();
    toast('in the world'); await wait(300);
    const a = $('toasts').getBoundingClientRect().top;
    hubOpen(); await wait(400);
    toast('over the menu'); await wait(300);
    const b = $('toasts').getBoundingClientRect().top;
    const t = $('toasts').lastElementChild;
    const out = { a: Math.round(a), b: Math.round(b), events: getComputedStyle(t).pointerEvents };
    navHome(); await wait(300);
    return out;
  });
  ck('the toast lane is in the same place with a menu open', T.a === T.b, T);
  ck('and a toast does not take the tap meant for what is under it', T.events === 'none', T);

  console.log('▶ a win is a moment, then a choice');
  const W = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const solve = async (prog) => {
      applyProg(mgRobot, prog); renderProgram(); mgRun();
      for (let i = 0; i < 200 && mgState && mgState.running; i++) await wait(50);
    };
    await __home();
    const out = {};
    academyEnter(0); await wait(400);
    const id0 = mgState.proj.id;
    await solve([{ t: 'move' }, { t: 'move' }, { t: 'move' }, { t: 'move' }]);
    out.beat = !document.getElementById('ccCele');        // the board first, not the card
    await wait(1200);
    out.stillHere = !!mgState && mgState.proj.id === id0;  // no jump to lesson 2
    out.card = !!document.querySelector('#ccCele .cc-cta') && !!document.querySelector('#ccCele .cc-alt');
    document.querySelector('#ccCele .cc-alt').click(); await wait(500);
    out.notNowStays = !!mgState && mgState.proj.id === id0 && !document.getElementById('ccCele');
    // run it again, and this time take the Next
    await solve([{ t: 'move' }, { t: 'move' }, { t: 'move' }, { t: 'move' }]);
    await wait(1200);
    document.querySelector('#ccCele .cc-cta').click(); await wait(500);
    out.nextGoes = !!mgState && mgState.proj.id === TUTS[1].id;
    await __home();
    // a build project: the level stays under its card until the player leaves
    const p = JSON.parse(JSON.stringify(PROJECTS[0])); p.id = 'calm_proj';
    mgEnter(p);
    const c0 = coins;
    out.guard = (() => { mgSuccess(); mgSuccess(); return coins - c0; })();  // a second win in the beat pays nothing
    out.reward = PROJECTS[0].coins;
    await wait(1200);
    out.projUnderCard = !!mgState && !!document.getElementById('ccCele');
    document.querySelector('#ccCele .cc-cta').click(); await wait(500);
    out.projLeft = mgState === null;
    return out;
  });
  ck('the player sees the robot finish before any card', W.beat === true, W);
  ck('the next lesson does not load by itself', W.stillHere === true, W);
  ck('the card offers Next, and a way to stay', W.card === true, W);
  ck('"Not now" leaves the player on the lesson they solved', W.notNowStays === true, W);
  ck('"Next" is what moves them on', W.nextGoes === true, W);
  ck('a second win during the beat pays nothing more', W.guard === W.reward, W);
  ck('a project stays on screen under its card, and leaves when the player does',
    W.projUnderCard === true && W.projLeft === true, W);

  ck('no uncaught exceptions', errs.length === 0, errs.slice(0, 3));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
