/* Tower Mode's 3D board is a painter: it draws whole faces, far to near,
   and trusts the order. Every check here is a question about pixels,
   because a wrong order is invisible to anything but the picture.
   Run: NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node test/tower3d.js */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const LAUNCH = fs.existsSync(CHROME) ? { executablePath: CHROME } : {};

let pass = 0, fail = 0;
const ck = (n, ok, d) => { ok ? pass++ : fail++;
  console.log((ok ? '  ✅ ' : '  ❌ ') + n + (ok ? '' : ' — ' + JSON.stringify(d))); };

(async () => {
  const b = await chromium.launch(LAUNCH);
  const pg = await b.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push(String(e)));
  await pg.setContent('<body></body>');
  await pg.addScriptTag({ path: path.join(ROOT, 'js/game/tower3d.js') });

  /* Shared by every check: the level as shipped, a scene builder, and a
     render into a fresh canvas that comes back as raw pixels. */
  await pg.evaluate(() => {
    const W = 520, H = 380;
    window.__W = W; window.__H = H;
    window.__scene = (fn) => {
      const lv = TOWER_LEVELS.find(l => l.id === 't3_descend');
      const sc = { gw: lv.gw, gh: lv.gh, h: {}, base: {}, plan: {}, robot: null };
      for (const c of lv.terrain) { sc.base[c[0] + '_' + c[1]] = c[2]; sc.h[c[0] + '_' + c[1]] = c[2]; }
      if (fn) fn(sc);
      return sc;
    };
    window.__draw = (sc, yaw) => {
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d');
      T3.render(g, W, H, sc, { yaw, t: 0 });
      return g.getImageData(0, 0, W, H).data;
    };
    /* the same projection render() builds, so a face can be found on screen */
    window.__proj = (sc, yaw) => {
      let maxZ = 1;
      for (const k in sc.h) maxZ = Math.max(maxZ, sc.h[k]);
      for (const k in sc.plan) maxZ = Math.max(maxZ, sc.plan[k]);
      return T3.makeProj({ gw: sc.gw, gh: sc.gh, maxZ }, W, H, yaw);
    };
  });

  const YAWS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5];

  console.log('▶ a brick shows its front, never its back');
  /* One rock block, alone and off to one side, at every step the camera
     turns through. The centre of each face that looks at the camera must
     be that face's own shade. A brick now draws only the faces its
     on-screen winding says are turned towards the camera; get that sign
     backwards, or the winding of one face in the list, and the face
     that should be there is simply missing. */
  const faces = await pg.evaluate((yaws) => {
    const bad = [];
    const sc = __scene(s => { s.base = { '1_0': 1 }; s.h = { '1_0': 1 }; });
    const FACE = { N: .88, W: .78, E: .60, S: .50 };
    const rock = [0xa8, 0x9b, 0x86];
    for (const q of yaws) {
      const yaw = q * Math.PI / 2, px = __draw(sc, yaw), P = __proj(sc, yaw);
      const p = (dx, dy, dz) => P(1 + dx, 0 + dy, dz);
      const t = [p(0, 0, 1), p(1, 0, 1), p(1, 1, 1), p(0, 1, 1)];
      const bo = [p(0, 0, 0), p(1, 0, 0), p(1, 1, 0), p(0, 1, 0)];
      const sides = { N: [bo[0], bo[1], t[1], t[0]], E: [bo[1], bo[2], t[2], t[1]],
                      S: [bo[2], bo[3], t[3], t[2]], W: [bo[3], bo[0], t[0], t[3]] };
      const area = qd => qd.reduce((a, pt, i) => { const n = qd[(i + 1) % 4]; return a + pt.x * n.y - n.x * pt.y; }, 0);
      const ground = area([P(3, 1, 0), P(4, 1, 0), P(4, 2, 0), P(3, 2, 0)]);
      for (const k in sides) {
        const qd = sides[k], a = area(qd);
        if (Math.abs(a) < 400 || a * ground <= 0) continue;   // facing away, or too thin to aim at
        const cx = Math.round(qd.reduce((s, v) => s + v.x, 0) / 4), cy = Math.round(qd.reduce((s, v) => s + v.y, 0) / 4);
        const i = (cy * __W + cx) * 4, got = [px[i], px[i + 1], px[i + 2]];
        const want = rock.map(c => Math.min(255, Math.round(c * FACE[k])));
        if (got.some((v, j) => Math.abs(v - want[j]) > 3)) bad.push({ yaw: q, face: k, got, want });
      }
    }
    return bad;
  }, YAWS);
  ck('every visible side is drawn in its own shade, at every angle', faces.length === 0, faces.slice(0, 4));

  console.log('▶ what stands behind the cliff stays behind it');
  /* The cliff is terrain. It used to be painted in the ground pass,
     before anything with height, so a brick or a blueprint standing
     behind it was drawn over it. Here a brick sits tucked right behind
     the three-high cliff: from the front it must not change one pixel. */
  const hidden = await pg.evaluate(() => {
    const plain = __scene(), behind = __scene(s => { s.h['0_2'] = 1; });
    const a = __draw(plain, 0), c = __draw(behind, 0);
    let diff = 0;
    /* a real change of colour, not the one-pixel antialiasing seam along
       an edge the two share, which shifts by a dozen levels */
    for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - c[i]) + Math.abs(a[i + 1] - c[i + 1]) + Math.abs(a[i + 2] - c[i + 2]) > 30) diff++;
    return diff;
  });
  ck('a brick hidden behind the cliff draws nothing', hidden === 0, { pixelsChanged: hidden });

  /* And the other way round: turned to face the cliff side-on, the
     blueprint beyond it must not show through the rock. */
  const ghost = await pg.evaluate(() => {
    const plain = __scene(), planned = __scene(s => { s.plan = { '0_0': 1 }; });
    /* at yaw 90 the tile (0,0) is straight behind the rock at (0,1) */
    const a = __draw(plain, Math.PI / 2), c = __draw(planned, Math.PI / 2);
    const P = __proj(planned, Math.PI / 2), m = P(0.5, 1.5, 2.2);   // on the cliff's face
    const i = (Math.round(m.y) * __W + Math.round(m.x)) * 4;
    return { same: [a[i], a[i + 1], a[i + 2]].join() === [c[i], c[i + 1], c[i + 2]].join(),
             rock: [a[i], a[i + 1], a[i + 2]], withPlan: [c[i], c[i + 1], c[i + 2]] };
  });
  ck('a blueprint behind the cliff does not paint over its face', ghost.same, ghost);

  console.log('▶ a row of columns stands side by side');
  /* The stair in "Down and Over" is three columns in one row across the
     screen. Their depth along the view axis is identical, so the old sort
     tied and drew them in list order; the nearer one must be drawn last.
     The front face of the middle column, low down where the tall one
     beside it would overlap if drawn after, must be the middle column's. */
  const row = await pg.evaluate(() => {
    const bad = [];
    for (const q of [0, 2]) {
      const yaw = q * Math.PI / 2, sc = __scene(), px = __draw(sc, yaw), P = __proj(sc, yaw);
      /* at yaw 0 the camera sits on the low-y side; at 180 on the high-y side */
      const fy = q === 0 ? 1 : 2;
      for (const x of [0, 1, 2]) {
        /* just under its own top, beside the taller neighbour: that is
           where the neighbour's side face lands when it is drawn after */
        const nx = q === 0 ? x + 0.12 : x + 0.88, top = 3 - x;
        const m = P(nx, fy, top - 0.25), i = (Math.round(m.y) * __W + Math.round(m.x)) * 4;
        const got = [px[i], px[i + 1], px[i + 2]];
        const want = [0xa8, 0x9b, 0x86].map(c => Math.round(c * (q === 0 ? .88 : .50)));
        if (got.some((v, j) => Math.abs(v - want[j]) > 3)) bad.push({ yaw: q, column: x, got, want });
      }
    }
    return bad;
  });
  ck('each column’s front face is its own, not a neighbour painted over it', row.length === 0, row);

  ck('no uncaught exceptions', errs.length === 0, errs.slice(0, 3));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
