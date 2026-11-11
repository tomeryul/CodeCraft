/* The lie of the land: terraces with rounded coasts (js/game/terrain.js),
   and the chunk cache that keeps them (js/game/render.js).
   Run: NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node test/terrain.js */
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
  await pg.evaluate(() => $('playBtn').click()); await wait(1800);
  await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    HELD.length = 0; document.querySelectorAll('#ccCele').forEach(e => e.remove());
    if (mgState) mgExit(false); navHome(); await wait(300);
    /* one world, the same every run */
    seed = 20261111; buildTerrain(); genObjects();
    window.__lv = CC_LAND.level;
    /* the colour of the ground at a world pixel, read from the kept chunk */
    window.__at = (wx, wy) => {
      const cx = Math.floor(wx / (CHUNK * TILE)), cy = Math.floor(wy / (CHUNK * TILE));
      const c = getChunk(cx, cy), g = c.getContext('2d');
      const d = g.getImageData(Math.round((wx - cx * CHUNK * TILE) * 2), Math.round((wy - cy * CHUNK * TILE) * 2), 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    window.__hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    window.__near = (a, b, t) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) <= (t == null ? 6 : t);
    window.__watery = c => c[2] > c[0] + 40 && c[2] > 180;
    /* a tile carries a blade of grass or a speck here and there: its tone is
       what two of three samples agree on */
    window.__tone = (x, y, want, spots) => spots.filter(o => __near(__at(x * TILE + o[0], y * TILE + o[1]), want, 4)).length >= 2;
    /* every tile that fits a description, well inside the map */
    window.__find = pred => { const out = []; for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++) if (pred(x, y)) out.push([x, y]); return out; };
  });

  console.log('▶ the grid a child counts on is untouched');
  const G = await pg.evaluate(() => {
    const inner = __find((x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].every(d => __lv(x + d[0], y + d[1]) === 2)).slice(0, 400);
    let wrong = 0;
    /* five spots, three to agree: a tile has two blades of grass on it, and one tile in four hundred had both under the samples */
    window.__tone = (x, y, want, spots) => spots.filter(o => __near(__at(x * TILE + o[0], y * TILE + o[1]), want, 4)).length * 2 > spots.length;
    for (const [x, y] of inner) if (!__tone(x, y, __hex(GRASS[(x * 31 + y * 17) % 3]), [[5, 5], [43, 6], [24, 44], [12, 30], [36, 20]])) wrong++;
    const rock = __find((x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].every(d => __lv(x + d[0], y + d[1]) === 3)).slice(0, 200);
    let wrongR = 0;
    for (const [x, y] of rock) {
      if (!__tone(x, y, __hex(ROCKC[(x * 31 + y * 17) % 3]), [[5, 5], [43, 5], [24, 44]])) wrongR++;
    }
    return { grass: inner.length, wrong, rock: rock.length, wrongR };
  });
  ck('every grass tile inside the plateau is still its own one of the three greens (' + G.grass + ' tiles)', G.grass > 200 && G.wrong === 0, G);
  ck('and every rock tile its own grey', G.rock > 50 && G.wrongR === 0, G);

  console.log('▶ a coast is a curve, not a staircase');
  const C = await pg.evaluate(() => {
    const out = {};
    /* an outward corner: land with water to its north, west and north-west */
    const capes = __find((x, y) => __lv(x, y) >= 1 && __lv(x, y - 1) === 0 && __lv(x - 1, y) === 0 && __lv(x - 1, y - 1) === 0);
    out.capes = capes.length;
    out.cut = capes.filter(([x, y]) => __watery(__at(x * TILE + 2, y * TILE + 2))).length;       // the very corner: water now
    out.kept = capes.filter(([x, y]) => !__watery(__at(x * TILE + 16, y * TILE + 16))).length;   // a little way in: still land
    /* an inward corner: a water tile with land to its north, west and north-west */
    const bays = __find((x, y) => __lv(x, y) === 0 && __lv(x, y - 1) >= 1 && __lv(x - 1, y) >= 1 && __lv(x - 1, y - 1) >= 1);
    out.bays = bays.length;
    out.filled = bays.filter(([x, y]) => !__watery(__at(x * TILE + 2, y * TILE + 2))).length;    // the corner of the WATER tile: land now
    out.open = bays.filter(([x, y]) => __watery(__at(x * TILE + 24, y * TILE + 24))).length;     // its middle: still water
    /* two tiles that touch only at a point are not joined */
    const kiss = __find((x, y) => __lv(x, y) === 0 && __lv(x, y - 1) >= 1 && __lv(x - 1, y) >= 1 && __lv(x - 1, y - 1) === 0);
    out.kiss = kiss.length;
    out.apart = kiss.filter(([x, y]) => __watery(__at(x * TILE + 2, y * TILE + 2))).length;
    return out;
  });
  ck('an outward corner of the land is cut back: its very corner is water (' + C.capes + ' corners)', C.capes > 5 && C.cut === C.capes && C.kept === C.capes, C);
  ck('an inward corner is filled in: the corner of the water tile is land (' + C.bays + ' corners)', C.bays > 5 && C.filled === C.bays && C.open === C.bays, C);
  ck('two tiles that meet only at a point stay apart', C.kiss === 0 || C.apart === C.kiss, C);

  console.log('▶ the land stands in steps');
  const S = await pg.evaluate(() => {
    const out = {};
    const soil = __hex('#b27d48'), soilLow = __hex('#9a693a'), stone = __hex('#84849a'), stoneLow = __hex('#6f6f86');
    const isAny = (c, list) => list.some(k => __near(c, k, 10));
    /* grass with sand south of it, and grass both sides so no corner is near */
    const banks = __find((x, y) => __lv(x, y) === 2 && __lv(x, y + 1) === 1 && __lv(x - 1, y) >= 2 && __lv(x + 1, y) >= 2);
    out.banks = banks.length;
    out.face = banks.filter(([x, y]) => isAny(__at(x * TILE + 24, y * TILE + 44), [soil, soilLow])).length;      // the last 7px: soil
    out.top = banks.filter(([x, y]) => __tone(x, y, __hex(GRASS[(x * 31 + y * 17) % 3]), [[8, 34], [24, 36], [40, 34]])).length;
    /* the north side of a plateau shows no face: you are looking down on it */
    const norths = __find((x, y) => __lv(x, y) === 2 && __lv(x, y - 1) === 1 && __lv(x - 1, y) >= 2 && __lv(x + 1, y) >= 2);
    out.norths = norths.length;
    out.flat = norths.filter(([x, y]) => __tone(x, y, __hex(GRASS[(x * 31 + y * 17) % 3]), [[8, 2], [24, 3], [40, 2]])).length;
    const crags = __find((x, y) => __lv(x, y) === 3 && __lv(x, y + 1) === 2 && __lv(x - 1, y) === 3 && __lv(x + 1, y) === 3);
    out.crags = crags.length;
    out.rockFace = crags.filter(([x, y]) => isAny(__at(x * TILE + 24, y * TILE + 43), [stone, stoneLow])).length;
    /* it shades the ground just south of it */
    out.shaded = banks.filter(([x, y]) => { const c = __at(x * TILE + 24, y * TILE + 50), s = __hex(SANDC); return c[0] < s[0] - 8 && c[1] < s[1] - 8; }).length;
    return out;
  });
  ck('grass above sand shows a face of soil along its southern edge (' + S.banks + ' tiles)', S.banks > 10 && S.face === S.banks && S.top === S.banks, S);
  ck('and none along its northern edge', S.norths > 5 && S.flat === S.norths, S);
  ck('rock above grass stands on a face of stone', S.crags > 5 && S.rockFace === S.crags, S);
  ck('a plateau shades the sand just south of it', S.shaded === S.banks, S);

  console.log('▶ water has depth');
  const Wt = await pg.evaluate(() => {
    const deep = __hex('#3f9fd8');
    const out = {};
    /* open water: water all round, two tiles deep */
    const open = __find((x, y) => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (__lv(x + dx, y + dy) !== 0) return false; return true; }).slice(0, 150);
    out.open = open.length;
    out.deep = open.filter(([x, y]) => __near(__at(x * TILE + 24, y * TILE + 24), deep, 4)).length;
    /* a water tile with land straight north of it: lighter against the shore, darker further out */
    const shore = __find((x, y) => __lv(x, y) === 0 && __lv(x, y - 1) >= 1 && __lv(x - 1, y) === 0 && __lv(x + 1, y) === 0 && __lv(x, y + 1) === 0 && __lv(x - 1, y - 1) >= 1 && __lv(x + 1, y - 1) >= 1);
    out.shore = shore.length;
    const lum = c => c[0] + c[1] + c[2];
    out.steps = shore.filter(([x, y]) => { const a = lum(__at(x * TILE + 24, y * TILE + 5)), b2 = lum(__at(x * TILE + 24, y * TILE + 20)); return a > b2 + 10 && b2 > lum(deep) + 10; }).length;
    /* sand is darker where it is wet: right at the water, against a few pixels up the beach */
    const beach = __find((x, y) => __lv(x, y) === 1 && __lv(x, y + 1) === 0 && __lv(x - 1, y) >= 1 && __lv(x + 1, y) >= 1);
    out.beach = beach.length;
    out.wet = beach.filter(([x, y]) => lum(__at(x * TILE + 24, y * TILE + 45)) < lum(__at(x * TILE + 24, y * TILE + 34)) - 15).length;
    return out;
  });
  ck('open water is the deep blue (' + Wt.open + ' tiles)', Wt.open > 30 && Wt.deep === Wt.open, Wt);
  ck('against a shore it steps down in two lighter bands (' + Wt.shore + ' tiles)', Wt.shore > 5 && Wt.steps === Wt.shore, Wt);
  ck('and the sand is darker where it is wet', Wt.beach > 3 && Wt.wet === Wt.beach, Wt);

  console.log('▶ the picture is only a picture');
  const R = await pg.evaluate(() => {
    const before = Array.from(terrain).join('');
    for (let cy = 0; cy < 5; cy++) for (let cx = 0; cx < 5; cx++) { const c = document.createElement('canvas'); c.width = c.height = 64; CC_LAND.bake(c.getContext('2d'), cx, cy); }
    /* a rounded corner is still a whole tile to the rules */
    const capes = __find((x, y) => __lv(x, y) >= 1 && __lv(x, y - 1) === 0 && __lv(x - 1, y) === 0).slice(0, 20);
    return { same: Array.from(terrain).join('') === before, walk: capes.filter(([x, y]) => terrain[key(x, y)] !== T_WATER).length === capes.length, n: capes.length };
  });
  ck('drawing the ground changes nothing in the world, and a cut corner is still a whole tile of land', R.same && R.walk && R.n > 0, R);

  console.log('▶ the foam');
  const F = await pg.evaluate(async () => {
    const out = {};
    /* count what the foam strokes, chunk by chunk */
    const rec = { strokes: 0, alphas: new Set(), dash: new Set() };
    const fake = { save() {}, restore() {}, set lineCap(v) {}, set lineJoin(v) {}, set strokeStyle(v) {}, set lineWidth(v) {},
      set globalAlpha(v) { rec.alphas.add(v.toFixed(2)); }, set lineDashOffset(v) {}, setLineDash(a) { rec.dash.add(a.join()); }, stroke(p) { if (p instanceof Path2D) rec.strokes++; } };
    CC_LAND.foam(fake, 0, 0, 4, 4, 1000);
    out.strokes = rec.strokes; out.dashed = rec.dash.has('15,11');
    const a1 = [...rec.alphas].join();
    rec.alphas.clear(); CC_LAND.foam(fake, 0, 0, 4, 4, 3000);
    out.moves = [...rec.alphas].join() !== a1;
    /* a chunk with no coast in it costs nothing */
    let coastless = 0, coastal = 0;
    for (let cy = 0; cy < 5; cy++) for (let cx = 0; cx < 5; cx++) {
      let land = false, water = false;
      for (let y = cy * 16; y < cy * 16 + 16; y++) for (let x = cx * 16; x < cx * 16 + 16; x++) {
        if (__lv(x, y) === 0) continue;
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(d => __lv(x + d[0], y + d[1]) === 0)) water = true;
        land = true;
      }
      water ? coastal++ : coastless++;
    }
    out.coastal = coastal; out.coastless = coastless;
    return out;
  });
  ck('two rings are stroked for every chunk that has a coast, and none for one that has not',
    F.strokes === F.coastal * 2 && F.coastal > 3, F);
  ck('the outer ring is broken, and the two fade against each other over time', F.dashed && F.moves, F);

  console.log('▶ the ground is kept in pieces, ahead of the walk, and not for ever');
  const K = await pg.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const out = {};
    let inDraw = 0, ahead = 0, drawing = false;
    const bk = CC_LAND.bake; CC_LAND.bake = function () { drawing ? inDraw++ : ahead++; return bk.apply(this, arguments); };
    const frame = () => { drawing = true; draw(performance.now()); drawing = false; };
    follow = false; cam.scale = 1; cam.x = 8 * TILE; cam.y = 40.5 * TILE;
    for (let i = 0; i < 12; i++) { frame(); await wait(40); }      // settle where the walk starts
    inDraw = ahead = 0;
    /* right across the map at twice a robot's pace */
    for (let x = 8 * TILE; x < 72 * TILE; x += TILE * 6 / 60) { cam.x = x; frame(); await wait(16); }
    out.walk = { inDraw, ahead, kept: chunks.size };
    /* a jump far away, pinched right out: many at once */
    cam.x = 20.5 * TILE; cam.y = 20.5 * TILE; cam.scale = .4;
    const per = [];
    for (let i = 0; i < 10; i++) { const n0 = inDraw; frame(); per.push(inDraw - n0); await wait(16); }
    out.burst = per;
    /* everywhere on the map, one screen at a time */
    cam.scale = 1; let most = 0;
    for (let cy = 0; cy < 5; cy++) for (let cx = 0; cx < 5; cx++) { cam.x = (cx * 16 + 8) * TILE; cam.y = (cy * 16 + 8) * TILE; frame(); await wait(30); most = Math.max(most, chunks.size); }
    out.roam = { most, all: Math.ceil(W / CHUNK) * Math.ceil(H / CHUNK) };
    /* a new seed: nothing kept is true any more */
    const had = chunks.size; seed = 5; buildTerrain(); out.reset = { had, now: chunks.size };
    seed = 20261111; buildTerrain(); genObjects();
    CC_LAND.bake = bk;
    return out;
  });
  ck('walking across the whole map, no chunk is drawn in the frame it appears — each was ready ahead (' + K.walk.ahead + ' ahead)',
    K.walk.inDraw === 0 && K.walk.ahead >= 4, K.walk);
  ck('when many are needed at once, at most two are drawn in a frame', Math.max(...K.burst) <= 2 && K.burst.reduce((a, n) => a + n, 0) >= 2, K.burst);
  ck('a walk over all twenty-five keeps a dozen at most, not all of them', K.roam.most <= 12 && K.roam.all === 25, K.roam);
  ck('a new seed throws the kept ground away', K.reset.had > 0 && K.reset.now === 0, K.reset);

  console.log('▶ it ships');
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  ck('terrain.js is loaded before render.js, and is in the service worker\'s list',
    idx.indexOf('js/game/terrain.js') > 0 && idx.indexOf('js/game/terrain.js') < idx.indexOf('js/game/render.js') && sw.includes('"./js/game/terrain.js"'), {});

  ck('no uncaught exceptions', errs.length === 0, errs.slice(0, 3));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
