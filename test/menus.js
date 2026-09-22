/* A menu grows out of the thing that opened it.
   Run: NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node test/menus.js */
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
  await pg.evaluate(() => { navHome(); }); await wait(400);

  console.log('▶ the object menu');
  const shut = await pg.evaluate(() => {
    const c = getComputedStyle($('objMenu'));
    return { display: c.display, visibility: c.visibility, events: c.pointerEvents };
  });
  /* Laid out but hidden, rather than display:none. That is what lets the
     menu be measured before it is shown, and what gives the close
     something to animate instead of a display flip. */
  ck('a closed menu is laid out, hidden, and takes no taps',
    shut.display === 'block' && shut.visibility === 'hidden' && shut.events === 'none', shut);

  const M = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const at = (sx, sy) => {
      const wx = (sx - VW / 2) / cam.scale + cam.x, wy = (sy - VH / 2) / cam.scale + cam.y;
      return [Math.floor(wx / TILE), Math.floor(wy / TILE)];
    };
    const out = [];
    for (const [sx, sy] of [[70, 150], [350, 150], [210, 320]]) {
      closeObjMenu(); await wait(80);
      const [tx, ty] = at(sx, sy);
      objects.set(key(tx, ty), { type: 'chest' });
      handleTap(sx, sy);
      await wait(420);                       // let the grow finish before measuring
      const m = $('objMenu'), r = m.getBoundingClientRect();
      const ox = parseFloat(getComputedStyle(m).transformOrigin);
      out.push({ tap: sx, left: Math.round(r.left), width: Math.round(r.width),
                 originAbs: Math.round(r.left + ox), open: m.classList.contains('open') });
      objects.delete(key(tx, ty));
    }
    return out;
  });
  ck('tapping a build opens its menu', M.every(m => m.open), M);
  /* The origin is a point on the menu's own box, clamped to it: the menu
     stays where it fits and only the growth points at the object. Two
     pixels of slack for rounding — more than that and the measurement is
     being taken through the scale or through a running transition, which
     is exactly the bug this asserts against. */
  ck('the menu grows from the point that was tapped',
    M.every(m => {
      const want = Math.max(m.left, Math.min(m.left + m.width, m.tap));
      return Math.abs(m.originAbs - want) <= 2;
    }),
    M.map(m => ({ tap: m.tap, grewFrom: m.originAbs,
                  wanted: Math.max(m.left, Math.min(m.left + m.width, m.tap)) })));
  /* Three taps, three different origins — the proof that it is reading the
     tap and not just centring itself. */
  ck('a tap on the left and a tap on the right do not grow from the same place',
    M[0].originAbs < M[2].originAbs && M[2].originAbs < M[1].originAbs,
    M.map(m => m.originAbs));

  console.log('▶ out the way it came in');
  const back = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const m = $('objMenu');
    const grown = getComputedStyle(m).transform;
    const originHeld = getComputedStyle(m).transformOrigin;
    closeObjMenu();
    await wait(90);                          // mid-exit, not finished
    const midway = getComputedStyle(m).transform;
    const originStill = getComputedStyle(m).transformOrigin;
    await wait(400);
    return { grown, midway, originHeld, originStill,
             visible: getComputedStyle(m).visibility };
  });
  const scaleOf = t => { const m = /matrix\(([-\d.]+)/.exec(t || ''); return m ? +m[1] : 1; };
  ck('closing shrinks the menu rather than blinking it out',
    scaleOf(back.grown) > 0.98 && scaleOf(back.midway) < 0.98,
    { open: scaleOf(back.grown), closing: scaleOf(back.midway) });
  ck('and it shrinks back into the same point it grew from',
    back.originHeld === back.originStill, back);
  ck('once gone it is hidden again', back.visible === 'hidden', back.visible);

  console.log('▶ the market panel grows from its own button');
  const T = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const el = $('ticker');
    el.style.display = '';
    const btn = () => el.querySelector('.tk-btn');
    if (el.classList.contains('open')) { btn().click(); await wait(60); }
    btn().click(); await wait(40);
    const p = el.querySelector('.tk-panel');
    const out = { grew: !!p && p.classList.contains('tk-grow'),
                  origin: p ? getComputedStyle(p).transformOrigin : null };
    /* The ticker rewrites its own markup once a second. The animation
       must not come back with it, or the panel pulses while it is open. */
    await wait(1400);
    const p2 = el.querySelector('.tk-panel');
    out.stillThere = !!p2;
    out.replayed = !!p2 && p2.classList.contains('tk-grow');
    btn().click(); await wait(60);
    out.closed = !el.querySelector('.tk-panel');
    return out;
  });
  ck('the panel a tap created grows', T.grew === true, T);
  ck('it grows from the corner it hangs off', /^0px 0px/.test(T.origin || ''), T.origin);
  ck('a tick does not replay the animation under an open panel',
    T.stillThere === true && T.replayed === false, T);
  ck('closing takes the panel away', T.closed === true, T);

  ck('no uncaught exceptions', errs.length === 0, errs.slice(0, 3));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
