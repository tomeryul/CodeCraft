/* Sheets you can pull down and throw away — drives the real gesture in a
   real browser, because the only thing worth asserting about a drag is
   what the pixels did.
   Run: NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node test/sheet-drag.js */
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
  const pg = await b.newPage({ viewport: { width: 420, height: 800 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(String(e)));

  await pg.goto(APP); await wait(1200);
  await pg.selectOption('#ageMonth', '6');
  await pg.selectOption('#ageYear', String(new Date().getFullYear() - 30));
  await pg.click('#ageGo'); await wait(400);
  await pg.evaluate(() => $('playBtn').click()); await wait(1600);
  await pg.evaluate(() => { const c = document.querySelector('#ccCele .cc-cta'); if (c) c.click(); });
  await wait(500);

  /* translateY is read off the element, not computed from its rect: the
     rect also moves when the sheet's HEIGHT changes, and the editor's
     does. This is the number the drag actually writes. */
  const ty = id => pg.evaluate(i => {
    const m = /translateY\(([-\d.]+)px\)/.exec($(i).style.transform || '');
    return m ? Math.round(parseFloat(m[1])) : 0;
  }, id);
  const isOpen = id => pg.evaluate(i => $(i).classList.contains('open'), id);
  /* Every phase starts from the same place and measures the header again:
     the editor's size is mirrored onto <body> and changes how tall the
     other sheets are, and a phase that left the hub open would otherwise
     hand the next one a different screen. */
  const openHub = async () => {
    await pg.evaluate(() => { navHome(); }); await wait(350);
    await pg.evaluate(() => hubOpen()); await wait(550);
    return grip('hub');
  };
  /* The gesture is dispatched rather than driven through Playwright's
     mouse, because the thing under test is a VELOCITY and a real headless
     mouse has no reliable tempo: its moves can land several to the
     millisecond, which is a flick the code must still read correctly but
     not a flick a test can aim. Dispatching gives an exact tempo, so
     "fast" and "slow" mean the same thing on every machine.

     down()/move()/up() are separate so a test can stop in the middle and
     look, which is the whole point of an interruptible animation. */
  const down = (id, y) => pg.evaluate(([i, yy]) => {
    const h = $(i).querySelector(':scope > .m-head, :scope > .v5-head, :scope > .ed-head');
    const r = h.getBoundingClientRect();
    window.__gx = Math.round(r.left + r.width / 2);
    window.__gy = yy == null ? Math.round(r.top + r.height / 2) : yy;
    h.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, isPrimary: true,
      button: 0, buttons: 1, clientX: window.__gx, clientY: window.__gy, bubbles: true }));
    return window.__gy;
  }, [id, y]);
  const moveTo = (id, dy) => pg.evaluate(([i, d]) => {
    const h = $(i).querySelector(':scope > .m-head, :scope > .v5-head, :scope > .ed-head');
    h.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, isPrimary: true,
      button: -1, buttons: 1, clientX: window.__gx, clientY: window.__gy + d,
      bubbles: true, cancelable: true }));
  }, [id, dy]);
  const up = (id, dy) => pg.evaluate(([i, d]) => {
    const h = $(i).querySelector(':scope > .m-head, :scope > .v5-head, :scope > .ed-head');
    h.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, isPrimary: true,
      button: 0, buttons: 0, clientX: window.__gx, clientY: window.__gy + d, bubbles: true }));
  }, [id, dy]);
  /* px per step and ms between steps ARE the speed. 15px/16ms is a flick
     at about 940px/s; 6px/70ms is a deliberate pull at about 85px/s. */
  const drag = async (id, steps, px, gap) => {
    await down(id);
    for (let k = 1; k <= steps; k++) { await moveTo(id, k * px); await wait(gap); }
    await up(id, steps * px);
    return steps * px;
  };

  const grip = async id => pg.evaluate(i => {
    const r = $(i).querySelector(':scope > .m-head, :scope > .v5-head, :scope > .ed-head')
                   .getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  }, id);

  console.log('▶ the grip is there to be found');
  ck('every sheet is marked grabbable and has a header to grab',
    await pg.evaluate(() => [...document.querySelectorAll('.sheet')]
      .every(s => s.classList.contains('grabbable') &&
                  !!s.querySelector(':scope > .m-head, :scope > .v5-head, :scope > .ed-head'))),
    await pg.evaluate(() => [...document.querySelectorAll('.sheet')]
      .filter(s => !s.querySelector(':scope > .m-head, :scope > .v5-head, :scope > .ed-head'))
      .map(s => s.id)));
  ck('the grip is drawn, and only on a sheet',
    await pg.evaluate(() => {
      const h = $('hub').querySelector('.m-head');
      const w = getComputedStyle(h, '::before').width;
      return w === '36px';
    }), await pg.evaluate(() => getComputedStyle($('hub').querySelector('.m-head'), '::before').width));

  let r = await openHub();

  console.log('▶ it tracks the finger');
  await down('hub');
  const track = [];
  for (const d of [12, 45, 95, 150]) {
    await moveTo('hub', d); await wait(40);
    track.push({ finger: d, sheet: await ty('hub') });
  }
  /* 1:1 from the point that grabbed it. Not "roughly follows" — the same
     number, because anything else is the sheet sliding under the hand. */
  ck('the sheet moves exactly as far as the finger',
    track.every(t => Math.abs(t.sheet - t.finger) <= 1), track);
  ck('dragging marks the sheet so the CSS curve lets go',
    await pg.evaluate(() => $('hub').classList.contains('sheet-drag')));

  console.log('▶ up is a boundary, not a wall');
  await moveTo('hub', -10); await wait(40);
  await moveTo('hub', -100); await wait(60);
  const lifted = await ty('hub');
  ck('pulling up gives, but less and less', lifted < 0 && lifted > -100,
    { finger: -100, sheet: lifted });
  await up('hub', -100); await wait(900);

  console.log('▶ a small slow pull springs back');
  r = await openHub();
  await drag('hub', 11, 6, 70);              // 66px at about 85px/s — a pull, not a flick
  await wait(60);
  const returning = await ty('hub');
  ck('the spring starts from where the sheet is, not from home', returning > 20, returning);
  await wait(900);
  ck('a small pull leaves the sheet open, back at rest',
    await isOpen('hub') === true && await ty('hub') === 0,
    { open: await isOpen('hub'), y: await ty('hub') });

  console.log('▶ the spring can be caught mid-flight');
  r = await openHub();
  await drag('hub', 12, 6, 60);              // 72px, slow: short of the half rung, so it springs back
  await wait(50);
  const before = await ty('hub');
  await down('hub');                          // catch it in the air
  await wait(90);
  const caught = await ty('hub');
  await moveTo('hub', 40); await wait(60);
  const dragged = await ty('hub');
  await up('hub', 40); await wait(900);
  /* Caught means it STOPPED where it was. A spring that animates to its
     target instead of from its current value snaps home on the grab. */
  /* Caught means it STOPPED where it was. A spring that animates to its
     target instead of from its current value snaps home on the grab. */
  ck('grabbing a flying sheet stops it where it is',
    caught > 15 && Math.abs(caught - before) < 20, { before, caught });
  ck('and it follows the finger again from there', dragged >= caught + 35,
    { caught, dragged });

  console.log('▶ a throw is judged by where it was going');
  const h = await pg.evaluate(() => $('hub').offsetHeight);
  /* The landing point is a pure function, so it is checked as one: a
     hand-speed flick projects far past the dismiss threshold even from a
     standing start, which is why a short fast flick works and a long slow
     drag to the same place does not. */
  const proj = await pg.evaluate(() => [200, 800, 2000].map(v => Math.round(ccProject(v))));
  ck('a throw projects forward, and faster means further',
    proj[0] < proj[1] && proj[1] < proj[2] && proj[1] > h * 0.4,
    { proj, threshold: Math.round(h * 0.4) });

  /* And the real gesture. A headless mouse has no consistent tempo, so
     the test drives a flick that is unambiguous rather than marginal. */
  r = await openHub();
  const flick = await drag('hub', 8, 15, 16);   // 120px at about 940px/s
  await wait(1200);
  ck('a fast flick throws the sheet away, well short of the threshold',
    await isOpen('hub') === false && flick < h * 0.4,
    { travelled: flick, height: h, threshold: Math.round(h * 0.4) });

  console.log('▶ a dismissal is the sheet’s own ✕, not a new rule');
  r = await openHub();
  await pg.evaluate(() => { window.__x = 0;
    $('hub').querySelector('.m-head .iconbtn.x').addEventListener('click', () => window.__x++); });
  await drag('hub', 8, 15, 16);
  await wait(1200);
  ck('flinging a sheet clicks the ✕ it already had',
    await pg.evaluate(() => window.__x) === 1, await pg.evaluate(() => window.__x));
  ck('and the inline transform is handed back to the stylesheet',
    await pg.evaluate(() => $('hub').style.transform) === '',
    await pg.evaluate(() => $('hub').style.transform));

  console.log('▶ the other way up the same ladder');
  /* Down makes the window smaller and then sends it away. Up has to make
     it bigger, by the same hand movement, or the gesture is lopsided. */
  const size = () => pg.evaluate(() => ({
    max: $('editor').classList.contains('max'),
    full: document.body.classList.contains('sheets-full'),
    hub: $('hub').classList.contains('open') ? Math.round($('hub').offsetHeight) : null
  }));
  const shrink = async () => {
    await pg.evaluate(() => { if ($('editor').classList.contains('max')) $('edMax').click(); });
    await wait(600);
  };

  await shrink();
  r = await openHub();
  const small = await size();
  await drag('hub', 8, -15, 16);                 // 120px UP at about 940px/s
  await wait(1100);
  const grown = await size();
  ck('pulling a sheet up makes the window bigger',
    small.max === false && grown.max === true && grown.hub > small.hub + 100,
    { before: small, after: grown });
  ck('and the sheet it grew is still open', await isOpen('hub') === true);

  /* Nothing lives above full height. The danger here is the up-gesture
     falling through into the DOWN branch and throwing the sheet away. */
  await drag('hub', 8, -15, 16);
  await wait(1100);
  const ceiling = await size();
  ck('pulling up at full height changes nothing and keeps the sheet',
    ceiling.max === true && await isOpen('hub') === true, ceiling);

  await shrink();
  r = await openHub();
  await drag('hub', 5, -6, 70);                  // 30px at about 85px/s
  await wait(900);
  const nudged = await size();
  ck('a small slow pull up is not enough to resize',
    nudged.max === false && await isOpen('hub') === true, nudged);
  ck('and it comes back to rest', await ty('hub') === 0, await ty('hub'));

  /* The maker sizes itself — a pinned canvas does not fit in 56vh — so
     the gesture has to reach ITS control, not the shared one. */
  const mk = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    if (typeof makerOpen !== 'function') return { skipped: true };
    navHome(); await wait(300);
    makerOpen('hat'); await wait(700);
    return { skipped: false, open: $('maker').classList.contains('open'),
             wide: $('maker').classList.contains('wide'),
             hasOwn: !!$('maker').querySelector('.m-head .iconbtn.size') };
  });
  if (!mk.skipped) {
    ck('the maker is open with a size control of its own',
      mk.open === true && mk.hasOwn === true, mk);
    await drag('maker', 8, mk.wide ? 15 : -15, 16);
    await wait(1000);
    const mkAfter = await pg.evaluate(() => ({
      wide: $('maker').classList.contains('wide'),
      open: $('maker').classList.contains('open'),
      edMax: $('editor').classList.contains('max') }));
    ck('dragging the maker moves its own size, not the shared one',
      mkAfter.wide !== mk.wide && mkAfter.open === true, { before: mk.wide, after: mkAfter });
    await pg.evaluate(() => { navHome(); }); await wait(400);
  }

  console.log('▶ three rungs down: full, half, gone');
  /* Pulled down from full, a sheet lands on whichever rung the throw
     reaches: a gentle pull to the middle stops at half, a long pull or a
     hard flick leaves. The same on every sheet — the editor included,
     since leaving it saves the program and the draft (mgExit). */
  const full = async () => {
    await pg.evaluate(() => { if (!$('editor').classList.contains('max')) $('edMax').click(); });
    await wait(600);
  };
  /* A slow pull, released, with the top edge measured on both sides of
     the release in ONE evaluate: the height changes at that instant and
     the edge must not jump when it does. */
  const pullAndLook = (id, to) => pg.evaluate(async ([i, dist]) => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const el = $(i);
    const h = el.querySelector(':scope > .m-head, :scope > .v5-head, :scope > .ed-head');
    const r = h.getBoundingClientRect();
    const x = Math.round(r.left + r.width / 2), y0 = Math.round(r.top + r.height / 2);
    const ev = (type, y, extra) => h.dispatchEvent(new PointerEvent(type, Object.assign({
      pointerId: 1, isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true }, extra)));
    ev('pointerdown', y0, { button: 0, buttons: 1 });
    const steps = Math.round(dist / 8);
    for (let k = 1; k <= steps; k++) { ev('pointermove', y0 + k * 8, { button: -1, buttons: 1 }); await wait(70); }
    const hBefore = el.offsetHeight, topBefore = el.getBoundingClientRect().top;
    ev('pointerup', y0 + steps * 8, { button: 0, buttons: 0 });
    const hAfter = el.offsetHeight, topAfter = el.getBoundingClientRect().top;
    return { hBefore, hAfter, jump: Math.round(topAfter - topBefore) };
  }, [id, to]);

  for (const id of ['editor', 'hub']) {
    await pg.evaluate(() => { navHome(); }); await wait(400);
    await full();
    if (id === 'editor') { await pg.evaluate(() => $('editor').classList.add('open')); await wait(600); }
    else await openHub();
    const H = await pg.evaluate(i => $(i).offsetHeight, id);
    const look = await pullAndLook(id, Math.round(H * 0.42));
    await wait(1000);
    const st = await pg.evaluate(i => ({ max: $('editor').classList.contains('max'),
      open: $(i).classList.contains('open'), y: $(i).style.transform }), id);
    ck(`${id}: a slow pull to the middle stops at half size`,
      st.max === false && st.open === true && look.hAfter < look.hBefore - 100, { look, st });
    ck(`${id}: and the top edge stays under the finger as the size changes`,
      Math.abs(look.jump) <= 2, look);
    ck(`${id}: then settles at rest`, st.y === '', st.y);

    await drag(id, 8, 15, 16);                   // from half: a flick
    await wait(1200);
    ck(`${id}: from half, a flick sends it away`, await isOpen(id) === false);

    await pg.evaluate(() => { navHome(); }); await wait(400);
    await full();
    if (id === 'editor') { await pg.evaluate(() => $('editor').classList.add('open')); await wait(600); }
    else await openHub();
    await drag(id, 12, 20, 16);                  // from full: 240px at ~1250px/s
    await wait(1200);
    ck(`${id}: from full, a hard flick goes all the way in one throw`,
      await isOpen(id) === false, await pg.evaluate(i => $(i).className, id));
  }

  console.log('▶ buttons in the header keep their own press');
  r = await openHub();
  const btnDrag = await pg.evaluate(async () => {
    const x = $('hub').querySelector('.m-head .iconbtn.x');
    const b = x.getBoundingClientRect();
    const cx = Math.round(b.left + b.width / 2), cy = Math.round(b.top + b.height / 2);
    x.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, isPrimary: true,
      button: 0, buttons: 1, clientX: cx, clientY: cy, bubbles: true }));
    const h = $('hub').querySelector('.m-head');
    h.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, isPrimary: true,
      button: -1, buttons: 1, clientX: cx, clientY: cy + 40, bubbles: true, cancelable: true }));
    const dragged = $('hub').classList.contains('sheet-drag');
    h.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, isPrimary: true,
      button: 0, buttons: 0, clientX: cx, clientY: cy + 40, bubbles: true }));
    return dragged;
  });
  await wait(600);
  ck('pressing the ✕ and sliding off does not drag the sheet', btnDrag === false);

  console.log('▶ swipe in from the left edge to go back');
  /* Dispatched from x=5, into whatever element is under that point, the way
     a finger would land. Returns the transform the sheet had at each step. */
  const edge = (id, steps, px, gap, opt) => pg.evaluate(async ([id, steps, px, gap, opt]) => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const o = opt || {};
    const sh = $(id), r = sh.getBoundingClientRect(), Y = Math.round(r.top + r.height / 2);
    const X = o.x || 5;
    const tgt = document.elementFromPoint(X, Y);
    const ev = (t, x, y) => tgt.dispatchEvent(new PointerEvent(t, { pointerId: 7, isPrimary: true,
      button: t === 'pointermove' ? -1 : 0, buttons: t === 'pointerup' ? 0 : 1,
      clientX: x, clientY: y, bubbles: true, cancelable: true }));
    ev('pointerdown', X, Y); const xs = [];
    for (let k = 1; k <= steps; k++) {
      ev('pointermove', X + k * px, Y + k * (o.dy || 0)); await wait(gap);
      xs.push(sh.style.transform);
    }
    ev(o.cancel ? 'pointercancel' : 'pointerup', X + steps * px, Y + steps * (o.dy || 0));
    return xs;
  }, [id, steps, px, gap, opt]);
  const onProjects = async () => {
    /* An earlier phase can leave the celebration card up, and it covers the
       screen — a real finger would land on it too, so it is closed first. */
    await pg.evaluate(() => { const c = document.querySelector('#ccCele .cc-cta'); if (c) c.click();
      navHome(); $('projects').classList.add('open'); }); await wait(500);
  };
  const px = t => { const m = /translateX\(([-\d.]+)px\)/.exec(t || ''); return m ? Math.round(+m[1]) : 0; };
  const where = () => pg.evaluate(() => ({
    projects: $('projects').classList.contains('open'), hub: $('hub').classList.contains('open'),
    tr: $('projects').style.transform, drag: $('projects').classList.contains('sheet-drag') }));

  await onProjects();
  const tr = await edge('projects', 6, 10, 60);
  ck('the sheet follows the finger sideways, 1:1', tr.map(px).join() === '10,20,30,40,50,60', tr);
  await wait(700);
  const back1 = await where();
  ck('a slow short swipe springs the sheet home', back1.projects && back1.tr === '' && !back1.drag, back1);

  await edge('projects', 8, 18, 16);                     // about 1100px/s
  await wait(900);
  const went = await where();
  /* The same step the ‹ in the header takes: from a page, to the menu. */
  ck('a flick takes the same step back as the ‹ button', !went.projects && went.hub, went);
  ck('and leaves nothing behind on the sheet', went.tr === '' && !went.drag, went);

  await onProjects();
  await edge('projects', 8, 18, 16, { x: 60 });
  await wait(700);
  const mid = await where();
  ck('a swipe that starts away from the edge is not a back swipe',
     mid.projects && mid.tr === '', mid);

  await onProjects();
  await edge('projects', 6, 2, 30, { dy: 14 });
  await wait(500);
  const vert = await where();
  /* A finger that sets off downwards was scrolling. */
  ck('a finger that sets off vertically is left alone', vert.projects && vert.tr === '', vert);

  await onProjects();
  await edge('projects', 8, 18, 16, { cancel: true });
  await wait(800);
  const canc = await where();
  ck('when the system cancels the touch, the sheet goes home rather than back',
     canc.projects && canc.tr === '', canc);

  /* In a Safari tab that edge is the browser's own history-back; two
     gestures on one swipe is worse than one. */
  await onProjects();
  await pg.evaluate(() => Object.defineProperty(navigator, 'standalone', { value: false, configurable: true }));
  const tab = await edge('projects', 8, 18, 16);
  await wait(600);
  const tabState = await where();
  await pg.evaluate(() => { delete navigator.standalone; });
  ck('in a Safari tab the edge is left to the browser',
     tab.every(t => t === '') && tabState.projects, { tab, tabState });

  console.log('▶ reduced motion');
  await pg.emulateMedia({ reducedMotion: 'reduce' });
  await openHub();
  await down('hub');
  for (const d of [12, 40, 80]) { await moveTo('hub', d); await wait(40); }
  const stillTracks = await ty('hub');
  await up('hub', 80); await wait(120);
  const landed = await ty('hub');
  ck('the drag still tracks when motion is reduced', Math.abs(stillTracks - 80) <= 1, stillTracks);
  /* No spring to watch, so the release lands at once rather than easing —
     that is the non-vestibular equivalent, not the removal of feedback. */
  ck('but the release lands at once, with nothing flying', landed === 0, landed);
  await pg.emulateMedia({ reducedMotion: null });

  ck('no uncaught exceptions', errs.length === 0, errs.slice(0, 3));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
