/* Motion that has to earn its place — the findings of an audit against the
   improve-animations catalog, asserted by SAMPLING the animations rather
   than by reading the stylesheet, because the stylesheet looked fine and
   the block pop was still wobbling twice.
   Run: NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node test/motion.js */
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
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto(APP); await wait(1200);
  await pg.selectOption('#ageMonth', '6');
  await pg.selectOption('#ageYear', String(new Date().getFullYear() - 30));
  await pg.click('#ageGo'); await wait(400);
  await pg.evaluate(() => $('playBtn').click()); await wait(1600);
  await pg.evaluate(() => { const c = document.querySelector('#ccCele .cc-cta'); if (c) c.click(); });
  await wait(400);

  /* Step an element's animation through its own timeline, paused, and read
     the scale it actually has at each point. */
  const sampleScale = sel => pg.evaluate(s => {
    const d = document.createElement('div'); d.className = s; d.textContent = 'x';
    d.style.cssText = 'position:fixed;top:100px;left:40px';
    document.body.appendChild(d);
    const a = d.getAnimations()[0];
    if (!a) { d.remove(); return null; }
    a.pause();
    const dur = a.effect.getComputedTiming().duration, out = [];
    for (let i = 0; i <= 40; i++) {
      a.currentTime = dur * i / 40;
      const m = getComputedStyle(d).transform;
      out.push(m === 'none' ? 1 : +m.slice(7).split(',')[0]);
    }
    const curve = getComputedStyle(d).animationTimingFunction;
    d.remove();
    return { dur, curve, peak: Math.max(...out), dip: Math.min(...out.slice(20)), first: out[0] };
  }, sel);

  console.log('▶ the block a child taps in');
  const blk = await sampleScale('blk c-basic new');
  /* It was .82 → 1.086 → .993 → 1: overshoot on the way up, then again on
     the way down. A block lands two hundred times a session. */
  ck('it grows and settles — it does not overshoot and then dip back under',
     !!blk && blk.dip >= 0.999, blk);
  ck('any overshoot is a hair, not a bounce', !!blk && blk.peak < 1.01, blk);
  ck('it starts close to its size, not from a shrunken block',
     !!blk && blk.first >= 0.9 && blk.first < 1, blk);
  ck('it is quick, because it is the most frequent motion in the game',
     !!blk && blk.dur <= 200, blk && blk.dur);
  ck('and it uses the house curve for things the hand put somewhere',
     !!blk && blk.curve === 'cubic-bezier(0.22, 1.2, 0.36, 1)', blk && blk.curve);

  console.log('▶ the one place a big pop is allowed');
  const cele = await sampleScale('cc-card');
  ck('the celebration card still pops — it is the rare moment the delight is for',
     !!cele && cele.peak > 1.05, cele);

  console.log('▶ one vocabulary');
  /* Every curve is a token in css/apple.css. Checked on the live cascade:
     the sheets used to carry the house curve typed out by hand. */
  const tok = await pg.evaluate(() => {
    const cs = e => getComputedStyle(e);
    /* matched, not split: a cubic-bezier has commas of its own */
    return { sheet: (cs($('hub')).transitionTimingFunction.match(/cubic-bezier\([^)]*\)/)||[''])[0],
             dur: cs($('hub')).transitionDuration.split(',')[0].trim(),
             settle: cs(document.documentElement).getPropertyValue('--ease-settle').trim() };
  });
  ck('the sheets move on --ease-settle, by name',
     tok.sheet === 'cubic-bezier(0.32, 0.9, 0.35, 1)' && tok.dur === '0.28s', tok);
  const literals = ['css/styles.css', 'css/codecraft-v4.css', 'css/codecraft-v5.css',
                    'css/codecraft-v6.css', 'css/codecraft-v7.css']
    .filter(f => fs.existsSync(path.join(ROOT, f)))
    .map(f => [f, (fs.readFileSync(path.join(ROOT, f), 'utf8').match(/cubic-bezier\(/g) || []).length])
    .filter(([, n]) => n > 0);
  ck('no stylesheet but apple.css spells out a curve of its own', literals.length === 0, literals);

  console.log('▶ the toast stack');
  /* Toasts sit in a column, and every arrival and departure used to move
     the rest a whole row in one frame. The column is anchored at the TOP,
     always: it used to drop to the bottom whenever a sheet was open, and
     that 658px jump was most of the app's layout shift (see the Calm topic
     in docs/ux-roadmap.md). So a toast LEAVING pulls the rest up — that is
     the move to glide — and one ARRIVING moves nothing at all. */
  const glide = (open, act) => pg.evaluate(async ([open, act]) => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    navHome(); await wait(300);
    if (open) { hubOpen(); await wait(450); }
    const box = $('toasts'); box.innerHTML = '';
    toast('one'); await wait(40); toast('two');
    await wait(420);                                   // both have arrived
    const watch = act === 'leave' ? box.children[1] : box.children[0];
    const rest = watch.getBoundingClientRect().top;
    if (act === 'leave') tDrop(box.children[0]); else toast('three');
    const moved = watch.getBoundingClientRect().top;   // the same frame
    /* FLIP clears the inline transform in the same tick on purpose — the
       CSS transition is what carries the toast from the inverted spot to
       its new row, so THAT is what is looked for. */
    const gliding = watch.getAnimations().some(x => x.transitionProperty === 'transform');
    await wait(500);
    const settled = watch.getBoundingClientRect().top;
    const after = watch.style.transform;
    navHome(); await wait(200);
    return { rest, moved, gliding, settled, after, laneTop: Math.round(box.getBoundingClientRect().top),
             anchored: getComputedStyle(box).bottom !== 'auto' && open ? 'bottom' : 'top' };
  }, [open, act]);

  const L = await glide(false, 'leave');
  /* The glide: in the frame the change happens the toast is still where it
     was, carrying an inverse transform, and THEN travels to its new row. */
  ck('top-anchored: when a toast leaves, the one below does not jump',
     Math.abs(L.moved - L.rest) < 1 && L.gliding === true, L);
  ck('and ends up in the gap', L.settled < L.rest - 10, L);
  ck('and hands its position back to the layout when it gets there', L.after === '', L);

  const A = await glide(true, 'arrive');
  ck('one lane: opening a sheet does not move the toasts anywhere',
     A.laneTop === L.laneTop, { closed: L.laneTop, open: A.laneTop });
  ck('and a new toast arriving leaves the ones already showing where they are',
     Math.abs(A.moved - A.rest) < 1 && Math.abs(A.settled - A.rest) < 1 && A.after === '', A);

  const R = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const box = $('toasts'); box.innerHTML = '';
    for (const t of ['a', 'b', 'c']) { toast(t); await wait(30); }
    await wait(400);
    const first = box.children[0];
    toast('d');                                        // pushes the oldest out
    return { count: box.children.length, gone: !first.isConnected };
  });
  ck('a fourth toast still pushes the oldest out — three at most', R.count === 3 && R.gone, R);

  console.log('▶ the review\'s findings');
  const V = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const out = {};
    /* XP: scaled on the GPU, and the shine plays on a gain — not for ever */
    const fill = $('xpFill'), bar = $('xpBar');
    out.fillTransition = getComputedStyle(fill).transitionProperty;
    out.fillWidthStyle = fill.style.width;
    player.xp = 0; updateHud(); await wait(30);
    bar.classList.remove('gain');
    player.xp = Math.round(xpNeed(player.level) * 0.5); updateHud(); await wait(30);
    out.scaled = /scaleX\(0\.5\)/.test(fill.style.transform);
    out.shineOnGain = bar.classList.contains('gain');
    const sh = getComputedStyle(bar, '::after');
    out.shineCount = sh.animationIterationCount;
    /* the other shines and pulses are finite */
    const probe = cls => { const d = document.createElement('div'); d.className = cls;
      document.body.appendChild(d); const c = getComputedStyle(d);
      const r = c.animationIterationCount; d.remove(); return r; };
    out.badge = (() => { const b = document.createElement('button'); b.className = 'iconbtn badge';
      document.body.appendChild(b); const r = getComputedStyle(b, '::after').animationIterationCount;
      b.remove(); return r; })();
    out.quest = (() => { const q = document.createElement('div'); q.className = 'quest';
      const b = document.createElement('button'); q.appendChild(b); document.body.appendChild(q);
      const r = getComputedStyle(b, '::after').animationIterationCount; q.remove(); return r; })();
    /* the object menu: close by, popover-quick, and out faster than in */
    const m = $('objMenu');
    out.menuShutScale = getComputedStyle(m).transform;
    const dur = el => getComputedStyle(el).transitionDuration.split(',').map(x => parseFloat(x) * 1000);
    out.menuOut = Math.max(...dur(m));
    m.classList.add('open'); out.menuIn = dur(m); m.classList.remove('open');
    /* the menu's tiles arrive in order */
    hubOpen(); await wait(60);
    out.tileDelays = [...document.querySelectorAll('#hub .hub-tile')].slice(0, 4)
      .map(t => parseFloat(getComputedStyle(t).animationDelay) * 1000);
    navHome(); await wait(200);
    return out;
  });
  ck('the XP fill is scaled, not resized', V.fillTransition === 'transform' && V.fillWidthStyle === '', V);
  ck('and it lands where the XP says', V.scaled === true, V);
  ck('a gain plays the shine, once', V.shineOnGain === true && V.shineCount === '1', V);
  ck('the quest button shines twice and then rests', V.quest === '2', V.quest);
  ck('the notification dot pulses three times and then rests', V.badge === '3', V.badge);
  const menuScale = (+V.menuShutScale.slice(7).split(',')[0]);
  ck('the object menu arrives from .95, not from far away', Math.abs(menuScale - 0.95) < 0.005, V.menuShutScale);
  ck('it opens within the popover budget', Math.max(...V.menuIn) <= 200, V.menuIn);
  ck('and leaves faster than it arrived', V.menuOut < Math.max(...V.menuIn), { in: V.menuIn, out: V.menuOut });
  ck('the menu tiles arrive one after another',
     V.tileDelays.length === 4 && V.tileDelays.every((d, i) => Math.abs(d - i * 35) < 1), V.tileDelays);

  /* No press anywhere re-lays out the page: the bevel does not shrink. */
  const pressLayout = ['css/styles.css', 'css/codecraft-v4.css', 'css/codecraft-v5.css',
                       'css/codecraft-v6.css', 'css/codecraft-v7.css']
    .filter(f => fs.existsSync(path.join(ROOT, f)))
    .flatMap(f => (fs.readFileSync(path.join(ROOT, f), 'utf8')
      .match(/:active\{[^}]*border-bottom-width[^}]*\}|transition:[^;}]*border-bottom-width/g) || [])
      .map(x => f + ': ' + x.slice(0, 60)));
  ck('no press changes a border — only the transform moves', pressLayout.length === 0, pressLayout);

  const toastOut = fs.readFileSync(path.join(ROOT, 'js/game/fx.js'), 'utf8').match(/opacity \.(\d)s/g) || [];
  ck('a toast leaves in 200ms, quicker than its 250ms entrance',
     toastOut.length === 2 && toastOut.every(x => x === 'opacity .2s'), toastOut);

  console.log('▶ reduced motion');
  await pg.emulateMedia({ reducedMotion: 'reduce' });
  const RM = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const box = $('toasts'); box.innerHTML = '';
    toast('one'); toast('two'); await wait(60);
    const second = box.children[1];
    tDrop(box.children[0]);
    await wait(40);
    return second.getBoundingClientRect().top === box.getBoundingClientRect().top;
  });
  /* No travel: the gap simply closes. */
  ck('with reduced motion the gap closes without travelling', RM === true, RM);
  await pg.emulateMedia({ reducedMotion: null });

  ck('no uncaught exceptions', errs.length === 0, errs.slice(0, 3));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
