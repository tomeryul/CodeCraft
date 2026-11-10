/* The time machine: a run on a board is kept, step by step, and a bar
   under the board slides through it (js/game/timemachine.js).
   Run: NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node test/timemachine.js */
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
  pg.on('console', m => { if (/time machine:/.test(m.text())) errs.push(m.text()); });
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
    await wait(500);
    /* helpers every block below uses */
    window.__w = wait;
    /* a board, as text: everything the rules can see */
    window.__sig = () => {
      const rb = mgState.robot, o = {};
      for (const k of Object.keys(rb).sort()) {
        const v = rb[k];
        o[k] = v instanceof Set ? [...v].sort() : v instanceof Map ? [...v].sort((a, b) => a[0] < b[0] ? -1 : 1) : v;
      }
      return JSON.stringify({ rb: o, vars: mgRobot.vars, say: mgRobot.say ? mgRobot.say.txt : null });
    };
    /* run a program by hand, one tick at a time, noting the board after each */
    window.__trace = (prog, max) => {
      applyProg(mgRobot, prog); renderProgram();
      const st = mgState;
      st.cases = mgCases(st.proj); st.ci = 0; st.results = []; st.failMsg = null; st.failAt = -1; st.costs = [];
      st.stepping = true;
      mgApplyCase(st.cases[0]); mgStartCase(false);
      const seen = [__sig()];
      for (let i = 0; i < (max || 700) && mgState && mgState.running; i++) {
        const count = () => { const t = tmState(); return t ? t.base + t.n : 0; };
        const before = __sig(), n0 = count();
        mgTick();
        if (count() > n0) seen.push(__sig());
        else if (mgState && !mgState.running && __sig() !== before) seen[seen.length - 1] = __sig();
      }
      return seen;
    };
    window.__lesson = async i => { if (mgState) mgExit(false); academyEnter(i); await wait(500); };
    window.__level = async (lv, id) => { if (mgState) mgExit(false);
      const p = JSON.parse(JSON.stringify(lv)); p.id = id || 'tm_test'; mgEnter(p); await wait(500); };
    window.__run = async prog => { applyProg(mgRobot, prog); renderProgram(); mgRun();
      for (let i = 0; i < 400 && mgState && mgState.running; i++) await wait(30);
      await wait(250); };
    window.__bar = () => { const e = $('mgTime'); return !!e && !e.hidden && e.getBoundingClientRect().height > 0; };
  });

  /* ------------------------------------------------------------------ */
  console.log('▶ a run is kept, one step for every action');
  const A = await pg.evaluate(async () => {
    await __lesson(0);
    const before = __bar();
    const size = () => { const r = $('mgCanvas').getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); };
    const s0 = size();
    await __run([{ t: 'move' }, { t: 'move' }, { t: 'turnL' }, { t: 'move' }, { t: 'move' }, { t: 'move' }]);
    const t = tmState(), live = mgState.robot;
    /* the first failed run this player has had: the thumb leans back, once */
    const home = t.x, xs = [];
    await new Promise(res => { const t0 = performance.now(); const f = () => { xs.push(tmState().x); if (performance.now() - t0 < 2600) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    const lean = { home, low: Math.round(Math.min(...xs)), end: Math.round(xs[xs.length - 1]), count: player.tmHint | 0, used: !!player.tmUsed };
    const out = { lean, before, after: __bar(), n: t.n, at: t.at, bad: t.bad, isLive: t.live, s0, s1: size(),
      hint: getComputedStyle($('mgBoardHint')).display, first: $('mgRead').firstElementChild.id === 'mgTime' || $('mgRead').children[1].id === 'mgTime' };
    const pos = [];
    for (let i = 0; i < t.n; i++) { tmGo(i); pos.push([mgState.robot.x, mgState.robot.y, mgState.robot.dir].join(',')); }
    out.pos = pos;
    tmGo(2); out.peek = { live: tmState().live, sameObj: mgState.robot === live, flag: !!mgRobot.peek };
    tmGo(t.n - 1); out.back = { live: tmState().live, sameObj: mgState.robot === live, flag: !!mgRobot.peek };
    out.cap = [...document.querySelectorAll('#mgTime .tm-cap > *')].map(e => e.textContent.trim());
    return out;
  });
  ck('there is no bar before the first run, and there is one after it', A.before === false && A.after === true, A);
  ck('the start and six actions are seven steps, and the bar stands on the last', A.n === 7 && A.at === 6 && A.isLive, A);
  ck('every step puts the robot where it was at that step',
    A.pos.join(' ') === '0,1,1 1,1,1 2,1,1 2,1,0 2,0,0 2,0,0 2,0,0', A.pos);
  ck('looking back shows a copy — the run itself is set aside', A.peek.live === false && A.peek.sameObj === false && A.peek.flag, A.peek);
  ck('and the end of the bar is the run itself again, the very same board', A.back.live && A.back.sameObj && !A.back.flag, A.back);
  ck('the board is the size it was before the bar arrived', A.s0 === A.s1, A);
  ck('the first time a run fails the thumb leans back and returns — the bar can be pulled, said without a word',
    A.lean.low < A.lean.home - 20 && Math.abs(A.lean.end - A.lean.home) < 1 && A.lean.count === 1 && !A.lean.used, A.lean);
  ck('the bar takes the place of the "tap Blocks" hint, which a run made stale', A.hint === 'none', A);
  ck('the two steps into the edge of the board are marked', A.bad.join() === '5,6', A.bad);
  ck('and the caption says which step, which block, and what went wrong',
    A.cap[0] === '6 / 6' && A.cap[2] === 'Move' && A.cap[3] === 'Blocked', A.cap);

  /* ------------------------------------------------------------------ */
  console.log('▶ what the bar shows is what happened');
  /* Two hundred programs out of every block a flat board runs, each traced
     tick by tick as it ran. Afterwards every step of the bar must be, to
     the last brick and variable, the board the trace saw at that tick. */
  const P = await pg.evaluate(async () => {
    let seed = 20261110;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const pick = a => a[Math.floor(rnd() * a.length)];
    const leaf = () => {
      const t = pick(['move', 'move', 'move', 'turnL', 'turnR', 'build', 'pickUp', 'drop', 'wait', 'setVar', 'changeVar', 'say', 'read']);
      if (t === 'wait') return { t, n: 1 + Math.floor(rnd() * 3) };
      if (t === 'setVar') return { t, name: pick(['a', 'b']), val: { k: 'num', n: Math.floor(rnd() * 9) } };
      if (t === 'changeVar') return { t, name: pick(['a', 'b']), by: 1 + Math.floor(rnd() * 3) };
      if (t === 'say') return { t, val: { k: 'var', name: pick(['a', 'b']) } };
      if (t === 'read') return { t, name: pick(['a', 'b']), src: 'here' };
      return { t };
    };
    const gen = d => {
      const out = [], n = 1 + Math.floor(rnd() * 5);
      for (let i = 0; i < n; i++) {
        const r = rnd();
        if (d < 2 && r < .16) out.push({ t: 'repeat', n: 2 + Math.floor(rnd() * 3), body: gen(d + 1) });
        else if (d < 2 && r < .26) out.push({ t: 'if', cond: pick(['blocked', 'brickHere', 'holding']), body: gen(d + 1), els: gen(d + 1) });
        else if (d < 2 && r < .32) out.push({ t: 'countLoop', name: 'i', to: 2 + Math.floor(rnd() * 3), body: gen(d + 1) });
        else out.push(leaf());
      }
      return out;
    };
    const board = { id: 'tm_prop', em: '🧪', name: 'prop', desc: '', gw: 5, gh: 4, start: { x: 1, y: 1, dir: 1 }, maxBlocks: 99,
      cells: [[0, 0], [1, 0], [2, 0]], initial: [[2, 1, 4], [3, 2, 7], [0, 3]], tiles: [[4, 1, 'wall'], [2, 3, 'wall']] };
    await __level(board, 'tm_prop');
    let steps = 0, wrong = [], progs = 0, shared = 0, snaps = 0;
    for (let k = 0; k < 200; k++) {
      const prog = gen(0);
      const seen = __trace(prog);
      const t = tmState();
      if (!t) { wrong.push({ k, why: 'no recording' }); continue; }
      if (t.n !== seen.length) { wrong.push({ k, why: 'steps', bar: t.n, ran: seen.length }); continue; }
      for (let i = 0; i < t.n; i++) {
        tmGo(i);
        if (__sig() !== seen[i]) { wrong.push({ k, i, bar: __sig().slice(0, 160), ran: seen[i].slice(0, 160) }); break; }
      }
      tmGo(t.n - 1);
      if (!tmState().live) wrong.push({ k, why: 'not live at the end' });
      steps += t.n; progs++;
    }
    return { progs, steps, wrong: wrong.slice(0, 3), nWrong: wrong.length };
  });
  ck('two hundred random programs: every step of the bar is the board as it ran (' + P.steps + ' steps)',
    P.progs === 200 && P.nWrong === 0 && P.steps > 1500, P);

  /* ------------------------------------------------------------------ */
  console.log('▶ looking back never changes what runs');
  const R = await pg.evaluate(async () => {
    const prog = [{ t: 'repeat', n: 3, body: [{ t: 'move' }, { t: 'build' }] }, { t: 'turnR' }, { t: 'move' }, { t: 'build' }];
    const board = { id: 'tm_rules', em: '🧪', name: 'rules', desc: '', gw: 6, gh: 4, start: { x: 0, y: 0, dir: 1 }, maxBlocks: 20,
      cells: [[1, 0], [2, 0], [3, 0], [3, 1]] };
    await __level(board, 'tm_rules');
    const straight = __trace(prog);                 // ran with nobody touching the bar
    const endA = straight[straight.length - 1], wonA = !!mgState.solved || mgCheck(mgState).ok;
    document.querySelectorAll('#ccCele').forEach(e => e.remove());
    await __level(board, 'tm_rules');
    /* the same program, stepped — and after every step, a look at step 0 */
    applyProg(mgRobot, prog); renderProgram();
    const peeks = [];
    for (let i = 0; i < 40; i++) {
      mgStep();
      if (!mgState.running) break;
      tmGo(0); peeks.push(mgState.robot.x + ',' + mgState.robot.y);
    }
    const out = { endA, endB: __sig(), wonA, wonB: mgCheck(mgState).ok, peeks: [...new Set(peeks)], n: tmState().n, live: tmState().live };
    document.querySelectorAll('#ccCele').forEach(e => e.remove());
    return out;
  });
  ck('a run stepped with a look back after every step ends exactly where an untouched run ends',
    R.endA === R.endB && R.wonA === true && R.wonB === true, R);
  ck('each of those looks really was at the start', R.peeks.join() === '0,0', R.peeks);

  /* ------------------------------------------------------------------ */
  console.log('▶ taking hold of the bar');
  await pg.evaluate(async () => {
    await __lesson(0);
    await __run([{ t: 'move' }, { t: 'move' }, { t: 'move' }, { t: 'turnL' }]);   // 5 steps: 0..4
    document.querySelectorAll('.toast').forEach(e => e.remove());
  });
  await wait(1500);     // the hint lean, if any, is over
  const geo = await pg.evaluate(() => { const r = $('tmTrack').getBoundingClientRect(), t = document.querySelector('#tmTrack .tm-thumb i').getBoundingClientRect();
    return { l: r.left, w: r.width, y: r.top + 26, tx: t.left + t.width / 2, ty: t.top + t.height / 2, h: r.height }; });
  const stepX = i => geo.l + 12 + (i / 4) * (geo.w - 24);
  ck('the thumb rests on the last step, at the end of the track', Math.abs(geo.tx - stepX(4)) < 1.5, geo);
  ck('the track is a target a finger can hit (40px and more)', geo.h >= 40 && geo.w >= 150, geo);
  /* grab the thumb 7px right of its middle and pull: it must keep that 7px */
  await pg.mouse.move(geo.tx + 7, geo.ty);
  await pg.mouse.down();
  const pressed = await pg.evaluate(() => ({ drag: $('tmTrack').classList.contains('drag'),
    scale: getComputedStyle(document.querySelector('#tmTrack .tm-thumb i')).transitionProperty }));
  const track = [];
  for (const x of [stepX(3) + 7, stepX(2) + 30, stepX(2) + 7, stepX(1) + 3]) {
    await pg.mouse.move(x, geo.ty, { steps: 4 });
    track.push(await pg.evaluate(x => { const t = document.querySelector('#tmTrack .tm-thumb i').getBoundingClientRect();
      return { off: +(x - (t.left + t.width / 2)).toFixed(1), at: tmState().at, rx: mgState.robot.x }; }, x));
  }
  ck('the thumb answers the press before it has moved', pressed.drag === true, pressed);
  ck('it stays under the point that grabbed it, 7px off its middle, the whole way',
    track.every(t => Math.abs(t.off - 7) < 1.2), track);
  ck('and the board is the step under the finger at every moment',
    track.map(t => t.at + ':' + t.rx).join(' ') === '3:3 2:2 2:2 1:1', track);
  await pg.mouse.up();
  await wait(700);
  const rest = await pg.evaluate(() => { const t = document.querySelector('#tmTrack .tm-thumb i').getBoundingClientRect();
    return { x: t.left + t.width / 2, at: tmState().at, drag: $('tmTrack').classList.contains('drag') }; });
  ck('let go between two steps, it settles on the one the board is showing',
    Math.abs(rest.x - stepX(1)) < 1 && rest.at === 1 && !rest.drag, { rest, want: stepX(1) });
  /* a press on the rail, away from the thumb, brings the thumb to it */
  await pg.mouse.move(stepX(3) + 2, geo.ty); await pg.mouse.down();
  const jump = await pg.evaluate(() => { const t = document.querySelector('#tmTrack .tm-thumb i').getBoundingClientRect();
    return { x: t.left + t.width / 2, at: tmState().at }; });
  await pg.mouse.up(); await wait(500);
  ck('a press on the rail brings the thumb there at once', Math.abs(jump.x - (stepX(3) + 2)) < 1.2 && jump.at === 3, jump);

  /* a release at speed: the thumb must still come to rest on a step, and
     pass through somewhere in between (a spring, not a jump) */
  await pg.mouse.move(stepX(3), geo.ty); await pg.mouse.down();
  await pg.mouse.move(stepX(1) + 18, geo.ty, { steps: 3 });
  await pg.evaluate(() => { window.__xs = []; const f = () => { const s = tmState(); if (s) __xs.push(s.x); if (__xs.length < 40) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  await pg.mouse.up();
  await wait(800);
  const fl = await pg.evaluate(() => ({ xs: __xs.map(x => +x.toFixed(1)), at: tmState().at }));
  const dist = [...new Set(fl.xs)];
  ck('released while moving, it glides to its step over several frames',
    dist.length >= 4 && Math.abs(fl.xs[fl.xs.length - 1] - (stepX(fl.at) - geo.l)) < 1, { at: fl.at, xs: dist.slice(0, 12) });

  const NH = await pg.evaluate(async () => {
    await __lesson(0);
    await __run([{ t: 'move' }, { t: 'turnL' }, { t: 'move' }, { t: 'move' }]);
    const home = tmState().x, xs = [];
    await new Promise(res => { const t0 = performance.now(); const f = () => { xs.push(tmState().x); if (performance.now() - t0 < 2200) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    const out = { used: !!player.tmUsed, moved: Math.round(home - Math.min(...xs)) };
    /* put back the clean five-step run the checks below are written for */
    await __run([{ t: 'move' }, { t: 'move' }, { t: 'move' }, { t: 'turnL' }]);
    return out;
  });
  ck('once the bar has been used, a failed run no longer leans the thumb', NH.used && NH.moved === 0, NH);

  /* ------------------------------------------------------------------ */
  console.log('▶ the buttons beside it');
  const BT = await pg.evaluate(async () => {
    const press = el => { el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 5 }));
      el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 5 })); };
    tmGo(4);
    const out = { fwdOffAtEnd: $('tmFwd').disabled, sizes: ['tmBack', 'tmFwd', 'tmWhy'].map(i => { const r = $(i).getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); }) };
    press($('tmBack')); out.afterBack = tmState().at;
    press($('tmBack')); press($('tmBack')); press($('tmBack')); out.atStart = tmState().at; out.backOffAtStart = $('tmBack').disabled;
    press($('tmBack')); out.stays = tmState().at;
    press($('tmFwd')); out.afterFwd = tmState().at;
    $('tmFwd').click(); out.keyboardClick = tmState().at;            // a click no pointer made
    /* held: it keeps going */
    tmGo(0);
    $('tmFwd').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 6 }));
    await __w(900);
    $('tmFwd').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 6 }));
    out.held = tmState().at;
    /* the keys, on the slider itself */
    const key = k => $('tmTrack').dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    key('Home'); out.home = tmState().at; key('ArrowRight'); out.right = tmState().at; key('End'); out.end = tmState().at; key('ArrowLeft'); out.left = tmState().at;
    out.aria = { role: $('tmTrack').getAttribute('role'), now: $('tmTrack').getAttribute('aria-valuenow'), max: $('tmTrack').getAttribute('aria-valuemax'),
      labels: ['tmBack', 'tmFwd', 'tmWhy', 'tmTrack'].map(i => $(i).getAttribute('aria-label')) };
    out.whyHidden = getComputedStyle($('tmWhy')).visibility;
    return out;
  });
  ck('each is a 40px target', BT.sizes.every(s => s === '40x40'), BT.sizes);
  ck('back and forward answer on the press, one step each, and stop at the ends',
    BT.fwdOffAtEnd && BT.afterBack === 3 && BT.atStart === 0 && BT.backOffAtStart && BT.stays === 0 && BT.afterFwd === 1, BT);
  ck('a click with no pointer behind it (a keyboard, a screen reader) steps too — once', BT.keyboardClick === 2, BT);
  ck('a held button keeps stepping', BT.held >= 3, BT);
  ck('the slider takes the arrow keys, Home and End', BT.home === 0 && BT.right === 1 && BT.end === 4 && BT.left === 3, BT);
  ck('and says what it is: a slider with a name, a value and a range',
    BT.aria.role === 'slider' && BT.aria.now === '3' && BT.aria.max === '4' && BT.aria.labels.every(l => l && l.length > 4), BT.aria);
  ck('with nothing gone wrong the triangle is not shown — but keeps its place', BT.whyHidden === 'hidden', BT);

  /* ------------------------------------------------------------------ */
  console.log('▶ what went wrong, and only what can be seen to have');
  const W = await pg.evaluate(async () => {
    const out = {};
    /* a chop one tile early: nothing happened */
    await __lesson(2);
    await __run([{ t: 'move' }, { t: 'chop' }, { t: 'move' }, { t: 'move' }, { t: 'chop' }]);
    out.chop = tmState().bad;
    tmGo(4); tmNextBad(); await __w(50);
    out.jump = { at: tmState().at, why: document.querySelector('#mgTime .tm-why').textContent, red: $('mgTime').classList.contains('bad'),
      shown: getComputedStyle($('tmWhy')).visibility, ticks: document.querySelectorAll('#tmTrack .tm-ticks i').length };
    /* a blueprint: one brick on the plan twice (fine), one off it (not) */
    const board = { id: 'tm_bp', em: '🧪', name: 'bp', desc: '', gw: 5, gh: 3, start: { x: 0, y: 0, dir: 1 }, maxBlocks: 20, cells: [[0, 0], [1, 0]] };
    await __level(board, 'tm_bp');
    await __run([{ t: 'build' }, { t: 'build' }, { t: 'move' }, { t: 'build' }, { t: 'move' }, { t: 'build' }, { t: 'pickUp' }, { t: 'pickUp' }]);
    out.plan = tmState().bad;
    tmGo(5); out.planWhy = document.querySelector('#mgTime .tm-why').textContent;
    /* the Cyber Lab: guessing is the method, a refused guess is not a mistake */
    if (mgState) mgExit(false);
    CC_CYBER.enter(CC_CYBER.levels[0]); await __w(500);
    await __run([{ t: 'countLoop', name: 'n', to: 9, body: [{ t: 'tryCode', val: { k: 'var', name: 'n' } }] }, { t: 'move' }, { t: 'move' }, { t: 'move' }]);
    out.cyber = { bad: tmState().bad, n: tmState().n };
    document.querySelectorAll('#ccCele').forEach(e => e.remove());
    return out;
  });
  ck('a chop with nothing to chop is marked; the one that fells the tree is not', W.chop.join() === '2', W.chop);
  ck('the triangle walks to it, the thumb turns red and the caption says why',
    W.jump.at === 2 && W.jump.why === 'Nothing happened' && W.jump.red && W.jump.shown === 'visible' && W.jump.ticks === 1, W.jump);
  ck('a brick laid twice on the plan is not a mistake; the first one off the plan is; an empty grab is',
    W.plan.join() === '6,8' && W.planWhy === '', W);
  ck('nine guesses at a keypad leave no marks — in the Cyber Lab guessing is the method', W.cyber.bad.length === 0 && W.cyber.n >= 10, W.cyber);

  /* ------------------------------------------------------------------ */
  console.log('▶ one program, several inputs');
  const M = await pg.evaluate(async () => {
    const lv = PUZZLE_PACKS.find(p => p.id === 'algo').stages[0];
    await __level(lv, 'tm_algo');
    const hidden = mgCases(mgState.proj).findIndex(c => c && c.hidden);
    await __run([{ t: 'move' }, { t: 'read', name: 'v', src: 'here' }, { t: 'say', val: { k: 'var', name: 'v' } }]);
    const chips = () => [...document.querySelectorAll('#mgCases .casechip')].map(e => e.className.replace('lvchip casechip', '').trim());
    const out = { hidden, results: mgState.results.slice(), view: tmState().view, failAt: mgState.failAt, liveCase: mgState.ci, isLive: tmState().live,
      chips: chips(), board: Object.values(mgState.robot.brickNo).join(' '), label: mgCaseLabel(mgState.cases[mgState.failAt], mgState.failAt),
      say: mgRobot.say && mgRobot.say.txt };
    /* tap an input that passed */
    const okI = mgState.results.findIndex(r => r === true);
    document.querySelectorAll('#mgCases .casechip')[okI].click();
    out.tapped = { view: tmState().view, okI, board: Object.values(mgState.robot.brickNo).join(' '), label: mgCaseLabel(mgState.cases[okI], okI), chips: chips() };
    tmGo(1); out.scrub = { vars: JSON.stringify(mgRobot.vars), x: mgState.robot.x, chipsText: $('mgVars').textContent };
    /* the secret one cannot be tapped */
    document.querySelectorAll('#mgCases .casechip')[hidden].click();
    out.secret = { view: tmState().view, role: document.querySelectorAll('#mgCases .casechip')[hidden].getAttribute('role') };
    /* and Run starts again from the first input, cleanly */
    await __run([{ t: 'move' }, { t: 'read', name: 'v', src: 'here' }, { t: 'say', val: { k: 'var', name: 'v' } }]);
    out.again = { results: mgState.results.slice(), view: tmState().view };
    return out;
  });
  ck('the level has a secret input, and the run fails on a visible one', M.hidden >= 0 && M.failAt >= 0 && M.failAt !== M.hidden, M);
  ck('after the run the board is the input that FAILED, not whichever ran last',
    M.view === M.failAt && M.isLive === false && M.board === M.label, M);
  ck('its chip is the one marked as on the board', M.chips[M.failAt].includes('view') && M.chips.filter(c => c.includes('view')).length === 1, M.chips);
  ck('tapping another input puts ITS run on the board and the bar', M.tapped.view === M.tapped.okI && M.tapped.board === M.tapped.label && M.tapped.chips[M.tapped.okI].includes('view'), M.tapped);
  ck('and its variables are the ones it had at that step', M.scrub.vars === '{}' && M.scrub.x === 1, M.scrub);
  ck('the secret input is never replayed', M.secret.view === M.tapped.okI && M.secret.role === null && !M.chips[M.hidden].includes('tap'), M.secret);
  ck('a second run gives the same verdicts as the first', JSON.stringify(M.again.results) === JSON.stringify(M.results), M.again);

  /* ------------------------------------------------------------------ */
  console.log('▶ a run that is still going');
  const L = await pg.evaluate(async () => {
    await __lesson(0);
    applyProg(mgRobot, [{ t: 'move' }, { t: 'move' }, { t: 'move' }, { t: 'move' }]); renderProgram();
    player.mgSpeed = 1; mgRun();
    await __w(520);                                   // a step or two in
    return { running: mgState.running, timer: !!mgState.timer, n: tmState().n, bar: __bar() };
  });
  const g2 = await pg.evaluate(() => { const r = $('tmTrack').getBoundingClientRect(); return { l: r.left, w: r.width, y: r.top + 26 }; });
  await pg.mouse.move(g2.l + 14, g2.y); await pg.mouse.down();
  const held = await pg.evaluate(async () => { const n = tmState().n; await __w(700);
    return { running: mgState.running, timer: !!mgState.timer, n, later: tmState().n, at: tmState().at, x: mgState.robot.x }; });
  await pg.mouse.up(); await wait(300);
  const cont = await pg.evaluate(async () => {
    const out = { before: tmState().live };
    for (let i = 0; i < 10 && mgState.running; i++) mgStep();
    out.won = mgCheck(mgState).ok; out.x = mgState.robot.x; out.n = tmState().n; out.live = tmState().live;
    document.querySelectorAll('#ccCele').forEach(e => e.remove());
    return out;
  });
  ck('the bar is there from the first step of a run, not only when it ends', L.bar && L.running && L.timer && L.n >= 2, L);
  ck('taking hold of it pauses the run — nothing more is recorded under the finger',
    held.running === true && held.timer === false && held.later === held.n && held.at === 0 && held.x === 0, held);
  ck('and Step carries on from where the run really was, to the flag', cont.before === false && cont.won === true && cont.x === 4 && cont.n === 5 && cont.live, cont);

  const F = await pg.evaluate(async () => {
    await __lesson(0);
    /* lesson 1 allows six blocks: fourteen steps from three of them */
    const prog = [{ t: 'repeat', n: 7, body: [{ t: 'turnL' }, { t: 'turnR' }] }];
    applyProg(mgRobot, prog); renderProgram();
    player.mgSpeed = 4; mgRun();
    await __w(450);
    const cap = () => [...document.querySelectorAll('#mgTime .tm-cap > *')].map(e => e.textContent.trim());
    const mid = { running: mgState.running, cap: cap(), n: tmState().n };
    for (let i = 0; i < 200 && mgState.running; i++) await __w(30);
    await __w(200);
    const out = { mid, end: cap(), ms: mgState.tickMs };
    player.mgSpeed = 1;
    return out;
  });
  ck('at 4x only the count moves — the block names go by too fast to read, so they are not written',
    F.mid.running && F.mid.n >= 3 && /^\d+ \/ \d+$/.test(F.mid.cap[0]) && F.mid.cap[2] === '' && F.ms < 200, F);
  ck('and when the run stops the caption says everything again', F.end[0] === '14 / 14' && F.end[2] === 'Turn Right', F.end);

  /* ------------------------------------------------------------------ */
  console.log('▶ the Blocks tab lights the block of the step');
  const H = await pg.evaluate(async () => {
    await __lesson(1);
    await __run([{ t: 'move' }, { t: 'turnR' }, { t: 'move' }]);
    tmGo(2); setTab('blocks'); updateExecHighlight();
    const lit = [...document.querySelectorAll('#programEl .blk.exec')];
    const all = [...document.querySelectorAll('#programEl .blk')];
    const out = { lit: lit.length, which: all.indexOf(lit[0]), dot: /●/.test($('routineTabs').textContent) || true };
    setTab('board'); tmGo(3); setTab('blocks'); updateExecHighlight();
    out.atEnd = document.querySelectorAll('#programEl .blk.exec').length;
    setTab('board');
    return out;
  });
  ck('standing on step 2, the second block is lit', H.lit === 1 && H.which === 1, H);
  ck('back at the end of a finished run nothing is lit, as before', H.atEnd === 0, H);

  /* ------------------------------------------------------------------ */
  console.log('▶ when the recording stops being true');
  const C = await pg.evaluate(async () => {
    const out = {};
    await __lesson(0);
    await __run([{ t: 'move' }, { t: 'move' }]);
    tmGo(1);
    const end = mgState.robot.x;
    /* the program changes: the bar goes, the board is the run's end again */
    mgRobot.program.push(newBlock('move')); programChanged();
    out.prog = { bar: __bar(), tm: tmState(), x: mgState.robot.x, peek: !!mgRobot.peek, hint: getComputedStyle($('mgBoardHint')).display, end };
    /* Reset */
    await __run(mgRobot.program.map(b => ({ t: b.t })));
    tmGo(1); $('mgResetBtn').click();
    out.reset = { bar: __bar(), tm: tmState(), x: mgState.robot.x, peek: !!mgRobot.peek };
    /* leaving the level, and coming into another */
    await __run([{ t: 'move' }]);
    tmGo(0); mgExit(false);
    out.exit = { tm: tmState(), bar: __bar() };
    await __lesson(1);
    out.next = { tm: tmState(), bar: __bar() };
    /* the designer has no time machine */
    window.confirm = () => true;
    if (mgState) mgExit(false);
    mgEnterCreator(); await __w(500); setTab('board');
    mgPaintTile(1, 0);
    await __run([{ t: 'move' }, { t: 'build' }]);
    out.creator = { tm: tmState(), bar: __bar() };
    mgExit(false); await __w(200);
    return out;
  });
  ck('a changed program drops the recording, and the board is the end of the run again',
    C.prog.bar === false && C.prog.tm === null && C.prog.x === 2 && !C.prog.peek && C.prog.hint !== 'none', C.prog);
  ck('Reset drops it and puts the robot back at the start', C.reset.bar === false && C.reset.tm === null && C.reset.x === 0 && !C.reset.peek, C.reset);
  ck('it does not follow the player out of a level, or into the next', C.exit.tm === null && C.next.tm === null && C.next.bar === false, C);
  ck('the designer has none: a run there lays inputs over the board being drawn', C.creator.tm === null && C.creator.bar === false, C.creator);

  /* ------------------------------------------------------------------ */
  console.log('▶ a Tower level');
  const T3r = await pg.evaluate(async () => {
    if (mgState) mgExit(false);
    t3Enter(TOWER_LEVELS[0]); await __w(800);
    await __run([{ t: 'build' }, { t: 'climb' }, { t: 'build' }]);
    const t = tmState(), px = () => { const c = $('mgCanvas'), g = c.getContext('2d'); const d = g.getImageData(0, 0, c.width, c.height).data; let s = 0; for (let i = 0; i < d.length; i += 97) s = (s * 31 + d[i]) >>> 0; return s; };
    const hs = [];
    for (let i = 0; i < t.n; i++) { tmGo(i); hs.push(JSON.stringify(mgState.robot.h) + '|' + mgState.robot.x + ',' + (mgState.robot.z || 0)); }
    tmGo(0); mgDraw(); const p0 = px();
    tmGo(t.n - 1); mgDraw(); const p1 = px();
    const out = { n: t.n, hs, differ: p0 !== p1, live: tmState().live };
    document.querySelectorAll('#ccCele').forEach(e => e.remove());
    mgExit(false); await __w(200);
    return out;
  });
  ck('heights are part of a step: the brick is not there at the start and is at the end',
    T3r.n === 4 && T3r.hs[0] !== T3r.hs[T3r.n - 1] && new Set(T3r.hs).size >= 3 && T3r.live, T3r);
  ck('and the 3D picture of the start is not the picture of the end', T3r.differ === true, T3r);

  /* ------------------------------------------------------------------ */
  console.log('▶ a long run');
  const Lg = await pg.evaluate(async () => {
    const board = { id: 'tm_long', em: '🧪', name: 'long', desc: '', gw: 6, gh: 3, start: { x: 0, y: 0, dir: 1 }, maxBlocks: 400,
      cells: [[5, 2]], tiles: [[3, 2, 'wall'], [4, 2, 'wall'], [1, 2, 'wall']] };
    await __level(board, 'tm_long');
    const loop = [{ t: 'forever', body: [{ t: 'turnR' }, { t: 'turnL' }] }];
    const seen = __trace(loop, 9000);
    const t = tmState();
    const out = { n: t.n, base: t.base, ran: seen.length };
    /* the oldest step still kept, and the newest, against the trace */
    tmGo(0); out.oldest = __sig() === seen[t.base];
    tmGo(t.n - 1); out.newest = __sig() === seen[seen.length - 1]; out.live = tmState().live;
    out.cap = document.querySelector('#mgTime .tm-num').textContent;
    /* what recording costs: the same eight thousand ticks, with it and without */
    const time = () => {
      applyProg(mgRobot, loop); const st = mgState;
      st.cases = mgCases(st.proj); st.ci = 0; st.results = []; st.costs = []; st.failAt = -1; st.stepping = true;
      mgApplyCase(st.cases[0]); mgStartCase(false);
      const t0 = performance.now();
      for (let i = 0; i < 9000 && mgState.running; i++) mgTick();
      return performance.now() - t0;
    };
    const keep = window.tmRec;
    const withIt = Math.min(time(), time());
    window.tmRec = null;
    const without = Math.min(time(), time());
    window.tmRec = keep;
    out.perStep = +((withIt - without) / 8000).toFixed(4); out.withIt = Math.round(withIt); out.without = Math.round(without);
    return out;
  });
  ck('a run of thousands of steps keeps the last three thousand or so, numbered as they ran',
    Lg.ran > 7000 && Lg.n >= 3000 && Lg.n <= 3250 && Lg.base === Lg.ran - Lg.n && Lg.oldest && Lg.newest && Lg.live &&
    Lg.cap === (Lg.ran - 1) + ' / ' + (Lg.ran - 1), Lg);
  /* the worst case for the bar: a different block on every step, so its
     icon is redrawn every step. Still a small part of one frame. */
  ck('and a step with the bar costs well under a millisecond more than one without (' + Lg.perStep + 'ms)', Lg.perStep < 1, Lg);

  const Sh = await pg.evaluate(async () => {
    /* the same walls, step after step, are one object — not a copy a step */
    await __lesson(0);
    await __run([{ t: 'move' }, { t: 'move' }, { t: 'turnL' }]);
    return tmShared();
  });
  ck('a step keeps only what changed in it: an unchanged part of the board is shared with the step before',
    Sh && Sh.steps === 4 && Sh.sharedTiles === 3 && Sh.sharedBricks === 3, Sh);

  /* ------------------------------------------------------------------ */
  console.log('▶ in Hebrew');
  const He = await pg.evaluate(async () => {
    if (typeof langSet === 'function') langSet('he'); else { lang = 'he'; i18nApply(); }
    await __w(300);
    await __lesson(0);
    await __run([{ t: 'move' }, { t: 'turnL' }, { t: 'move' }, { t: 'move' }]);
    tmGo(4); await __w(300);
    const latin = s => /[A-Za-z]{2,}/.test(s || '');
    const out = { cap: [...document.querySelectorAll('#mgTime .tm-cap > *')].map(e => e.textContent.trim()),
      labels: ['tmBack', 'tmFwd', 'tmWhy', 'tmTrack'].map(i => $(i).getAttribute('aria-label')), title: $('tmTrack').getAttribute('title'),
      dir: getComputedStyle(document.querySelector('#mgTime .tm-row')).direction };
    out.english = out.cap.concat(out.labels, [out.title]).filter(latin);
    tmGo(0); await __w(200); out.start = document.querySelector('#mgTime .tm-what').textContent;
    if (typeof langSet === 'function') langSet('en'); else { lang = 'en'; i18nApply(); }
    await __w(200);
    return out;
  });
  ck('the caption, the reason and every label are in Hebrew', He.english.length === 0 && /[֐-׿]/.test(He.cap[3]) && /[֐-׿]/.test(He.labels[3]), He);
  ck('the first step is called the start, in Hebrew too', /[֐-׿]/.test(He.start), He.start);
  ck('and time still runs left to right, like the page', He.dir === 'ltr', He.dir);

  /* ------------------------------------------------------------------ */
  console.log('▶ the bar and the room under the board');
  const Sz = await pg.evaluate(async () => {
    const out = {};
    const lv = PUZZLE_PACKS.find(p => p.id === 'algo').stages[0];
    await __level(lv, 'tm_size');
    const size = () => { const r = $('mgCanvas').getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); };
    out.before = size();
    const t0 = performance.now();
    await __run([{ t: 'move' }, { t: 'say', val: { k: 'num', n: 1 } }]);
    await __w(600);
    out.after = size();
    const bar = $('mgTime').getBoundingClientRect(), tab = $('boardTab').getBoundingClientRect(), act = $('actionBar').getBoundingClientRect();
    out.barH = Math.round(bar.height); out.visible = bar.bottom <= Math.min(tab.bottom, act.top) + 1 && bar.top >= tab.top;
    out.cap = document.querySelector('#mgTime .tm-cap').getBoundingClientRect().height;
    out.fontPx = getComputedStyle(document.querySelector('#mgTime .tm-cap')).fontSize;
    return out;
  });
  ck('a board that fills its width is the same size with the bar under it', Sz.before === Sz.after, Sz);
  await pg.evaluate(async () => { await __lesson(0); applyProg(mgRobot, [{ t: 'move' }, { t: 'move' }, { t: 'turnL' }, { t: 'move' }]); renderProgram();
    document.querySelectorAll('.toast').forEach(e => e.remove()); await __w(700); window.__t0 = performance.now(); });
  await pg.tap('#runBtn');
  await wait(2600);
  const Ls = await pg.evaluate(() => { const late = window.__shifts.filter(s => s.t > window.__t0);
    return { bar: __bar(), n: tmState() && tmState().n, shift: +late.reduce((a, s) => a + s.v, 0).toFixed(4), count: late.length }; });
  ck('a real tap on Run: the bar arrives with the tap, and nothing shifts afterwards — not while it runs, not when it ends',
    Ls.bar && Ls.n === 5 && Ls.shift < 0.01, Ls);
  ck('the bar is one row, and all of it is on screen at half height', Sz.barH <= 48 && Sz.visible === true, Sz);
  ck('its caption is a size from the type scale', Sz.fontPx === '12.5px', Sz);

  /* ------------------------------------------------------------------ */
  console.log('▶ the answers to the accessibility settings');
  const pg2 = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  pg2.on('pageerror', e => errs.push(String(e)));
  await pg2.goto(APP); await wait(1000);
  await pg2.selectOption('#ageMonth', '6');
  await pg2.selectOption('#ageYear', String(new Date().getFullYear() - 30));
  await pg2.click('#ageGo'); await wait(400);
  await pg2.evaluate(() => $('playBtn').click()); await wait(1500);
  const RM = await pg2.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    document.querySelectorAll('#ccCele').forEach(e => e.remove());
    if (mgState) mgExit(false); academyEnter(0); await wait(500);
    applyProg(mgRobot, [{ t: 'move' }, { t: 'move' }, { t: 'move' }, { t: 'turnL' }, { t: 'move' }]); renderProgram(); mgRun();
    for (let i = 0; i < 300 && mgState.running; i++) await wait(30);
    await wait(300);
    const x0 = tmState().x;
    const xs = [];
    await new Promise(res => { const t0 = performance.now(); const f = () => { xs.push(tmState().x); if (performance.now() - t0 < 1800) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    tmGo(5); tmStep(-3, false);
    return { leaned: new Set(xs.map(x => Math.round(x))).size > 1, x0, after: tmState().x, at: tmState().at, hint: player.tmHint | 0 };
  });
  ck('with reduced motion the thumb does not lean to hint, and a step places it without a glide',
    RM.leaned === false && RM.at === 2 && Math.abs(RM.after - RM.x0) > 20, RM);
  await pg2.close();

  console.log('▶ a narrow phone');
  for (const W of [390, 320]) {
    const pg3 = await b.newPage({ viewport: { width: W, height: 780 }, hasTouch: true, isMobile: true });
    pg3.on('pageerror', e => errs.push(String(e)));
    await pg3.goto(APP); await wait(1000);
    await pg3.selectOption('#ageMonth', '6');
    await pg3.selectOption('#ageYear', String(new Date().getFullYear() - 30));
    await pg3.click('#ageGo'); await wait(400);
    await pg3.evaluate(() => $('playBtn').click()); await wait(1500);
    const N = await pg3.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      document.querySelectorAll('#ccCele').forEach(e => e.remove());
      if (mgState) mgExit(false);
      const board = { id: 'tm_nar', em: '🧪', name: 'narrow', desc: '', gw: 5, gh: 3, start: { x: 0, y: 0, dir: 1 }, maxBlocks: 20, cells: [[4, 2]], initial: [[1, 0, 3]] };
      mgEnter(JSON.parse(JSON.stringify(board))); await wait(500);
      applyProg(mgRobot, [{ t: 'move' }, { t: 'pickUp' }, { t: 'pickUp' }]); renderProgram(); mgRun();
      for (let i = 0; i < 300 && mgState.running; i++) await wait(30);
      await wait(300);
      tmGo(3); await wait(100);
      const cap = document.querySelector('#mgTime .tm-cap'), why = document.querySelector('#mgTime .tm-why');
      return { track: Math.round($('tmTrack').getBoundingClientRect().width), tight: cap.classList.contains('tight'),
        why: why.textContent, whole: why.scrollWidth <= why.clientWidth + 1, num: getComputedStyle(document.querySelector('#mgTime .tm-num')).display };
    });
    if (W === 390) ck('at 390 the count, the block and the reason all fit on the line', !N.tight && N.whole && N.why === 'Nothing happened' && N.num !== 'none', N);
    else ck('at 320 the count gives way, and the reason is still read whole', N.tight && N.whole && N.num === 'none' && N.track >= 150, N);
    await pg3.close();
  }

  ck('no uncaught exceptions, and the recorder never had to give up', errs.length === 0, errs.slice(0, 3));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
