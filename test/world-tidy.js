/* The world does not fill up. A 💎 rich seam is a visit: it sinks away when
   its event ends. It used to stay for good two ways — a seam up when the game
   closed (every update reloads it) never got its ending, and a mined seam
   node came back as a plain permanent one — until the tiles around home were
   solid stone and a robot could not take a step. This checks both leaks are
   closed and that a world that already filled up heals on load.
   Run: NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node test/world-tidy.js */
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

  const nodes = () => pg.evaluate(() => [...objects.values()].filter(o => /^(rock|iron|crystal)$/.test(o.type)).length);
  const reload = async () => {
    await pg.evaluate(() => saveNow());
    await pg.reload(); await wait(1300);
    await pg.evaluate(() => { const p = $('playBtn'); if (p && p.offsetParent) p.click(); }); await wait(1600);
  };
  await pg.evaluate(() => { player.fresh = false; });
  const N0 = await nodes();

  console.log('▶ a seam up when the game closes does not stay');
  const L = await pg.evaluate(() => { market.event = null; startLode(); return market.event ? market.event.spots.length : 0; });
  ck('a seam surfaced (' + L + ' nodes)', L > 0, L);
  await reload();
  ck('after a reload the world has exactly the nodes it started with', await nodes() === N0, { N0, now: await nodes() });

  console.log('▶ a mined seam node does not come back');
  const M = await pg.evaluate(() => {
    market.event = null; startLode();
    const s = market.event.spots[0], k = key(s.x, s.y), o = objects.get(k), r = robots[0];
    r.energy = 100; for (const i in r.inv) r.inv[i] = 0; o.hp = 1;
    hitNode(r, { x: s.x, y: s.y }, k, o);
    return { gone: !objects.has(k), queued: respawnQ.some(e => e.x === s.x && e.y === s.y) };
  });
  ck('the node is mined', M.gone, M);
  ck('and is not queued to grow back', !M.queued, M);
  const W = await pg.evaluate(() => {
    /* a node of the world's own is still queued when mined */
    const [k, o] = [...objects].find(([, o]) => o.type === 'rock' && !o.lode);
    const x = k % W, y = Math.floor(k / W), r = robots[0];
    r.energy = 100; for (const i in r.inv) r.inv[i] = 0; o.hp = 1;
    hitNode(r, { x, y }, k, o);
    return respawnQ.some(e => e.x === x && e.y === y);
  });
  ck('a node of the world\'s own still grows back', W, W);

  console.log('▶ a world that already filled up heals on load');
  await pg.evaluate(() => {
    respawnQ.length = 0; market.event = null;
    for (const [k, o] of [...objects]) if (o.lode) objects.delete(k);
    /* what a long-played save looked like: stone on every free tile near
       home, and more on the way back */
    for (let y = homePos.y - 11; y <= homePos.y + 11; y++) for (let x = homePos.x - 11; x <= homePos.x + 11; x++) {
      const k = key(x, y);
      if (!inB(x, y) || terrain[k] === T_WATER || objects.has(k) || robots.some(r => r.x === x && r.y === y)) continue;
      objects.set(k, { type: ['rock', 'iron', 'crystal'][(x + y) % 3] });
    }
    respawnQ.push({ at: now + 50000, x: homePos.x + 5, y: homePos.y + 5, type: 'rock' });
  });
  const full = await nodes();
  ck('the stuffed world has far more nodes than it started with', full > N0 + 100, { N0, full });
  await reload();
  const S = await pg.evaluate(() => { const base = baseObjects();
    return [...objects].filter(([k, o]) => /^(rock|iron|crystal)$/.test(o.type) && !(base.get(k) && base.get(k).type === o.type)).length; });
  ck('after a load every node stands where the seed put one', S === 0, S);
  ck('and only the one mined above is missing', await nodes() === N0 - 1, { N0, now: await nodes() });
  const Q = await pg.evaluate(() => respawnQ.some(e => e.x === homePos.x + 5 && e.y === homePos.y + 5));
  ck('and the stray waiting to come back is dropped', !Q, Q);
  const free = await pg.evaluate(() => {
    const r = robots[0];
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => canWalk(r.x + dx, r.y + dy) && !objects.has(key(r.x + dx, r.y + dy)));
  });
  ck('the robot has somewhere to step', free, free);

  ck('no uncaught exceptions', errs.length === 0, errs.slice(0, 3));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
