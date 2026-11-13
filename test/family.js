/* 🤖 The family: Robo and the five from the "משפחת הרובוטים החדשה" canvas.
   Each is drawn as itself, bought in the shop as itself, saved as itself,
   and is good and bad at what the canvas says — and nothing else: a
   program means the same thing on every one of them.
   Run: NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node test/family.js */
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
  await pg.goto(APP); await wait(1100);
  await pg.selectOption('#ageMonth', '6');
  await pg.selectOption('#ageYear', String(new Date().getFullYear() - 30));
  await pg.click('#ageGo'); await wait(400);
  await pg.evaluate(() => $('playBtn').click()); await wait(1500);
  await pg.evaluate(() => { document.querySelectorAll('#ccCele').forEach(e => e.remove()); if (mgState) mgExit(false); navHome(); });
  await wait(300);

  console.log('▶ six of them, each drawn as itself');
  const look = await pg.evaluate(() => {
    const shot = (kind, yaw) => { const c = document.createElement('canvas'); c.width = c.height = 120;
      const g = c.getContext('2d'); CC_RIG.drawStill(g, 60, 112, 1, yaw, '#5ab8ff', CC_RIG.pose('idle', 0, 0, { fs: 0 }), { t: 0, kind });
      return g.getImageData(0, 0, 120, 120).data; };
    const diff = (a, b) => { let n = 0; for (let i = 3; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > 40) n++; return n; };
    const kinds = CC_RIG.KINDS, out = { kinds, pairs: [], same: null, still: null, turned: {} };
    const shots = {}; kinds.forEach(k => shots[k] = shot(k, 0));
    for (let i = 0; i < kinds.length; i++) for (let j = i + 1; j < kinds.length; j++) out.pairs.push(diff(shots[kinds[i]], shots[kinds[j]]));
    out.same = diff(shot('robo', 0), shot(undefined, 0));          // no kind is a Robo
    out.still = diff(shot('zoom', .6), shot('zoom', .6));          // a preview keeps no state
    kinds.forEach(k => out.turned[k] = diff(shot(k, 0), shot(k, Math.PI / 2)));
    return out;
  });
  ck('the family is Robo, Timber, Rocky, Tipi, Sabli and Zoom',
    look.kinds.join() === 'robo,timber,rocky,tipi,sabli,zoom', look.kinds);
  ck('no two of them draw alike (silhouettes differ by hundreds of pixels)', Math.min(...look.pairs) > 300, look.pairs);
  ck('a robot with no kind is drawn as Robo, pixel for pixel', look.same === 0, look.same);
  ck('a preview of one of them keeps no state: the same inputs, the same pixels', look.still === 0, look.still);
  ck('every one of them turns', Object.values(look.turned).every(n => n > 100), look.turned);

  console.log('▶ what each one wears');
  const wear = await pg.evaluate(() => {
    const W = {}; CC_RIG.KINDS.forEach(k => W[k] = CC_RIG.kindWear(k));
    const shot = (kind, w) => { const c = document.createElement('canvas'); c.width = c.height = 120;
      const g = c.getContext('2d'); CC_RIG.drawStill(g, 60, 112, 1, 0, '#5ab8ff', CC_RIG.pose('idle', 0, 0, { fs: 0 }), { t: 0, kind, wear: w });
      return g.getImageData(0, 0, 120, 120).data.join(','); };
    return { W, hatOnTimber: shot('timber', { hat: '🎩' }) === shot('timber', {}),
      hatOnRobo: shot('robo', { hat: '🎩' }) !== shot('robo', {}),
      fitOnRocky: shot('rocky', { outfit: 'vest' }) !== shot('rocky', {}),
      shoesOnTimber: shot('timber', { shoes: 'sneakers' }) !== shot('timber', {}),
      shoesOnZoom: shot('zoom', { shoes: 'sneakers' }) === shot('zoom', {}) };
  });
  ck('only Robo takes a hat: the others are known by their own headgear',
    wear.W.robo.hat && !wear.W.timber.hat && !wear.W.rocky.hat && !wear.W.zoom.hat && wear.hatOnRobo && wear.hatOnTimber, wear);
  ck('a type with feet takes shoes; one on tracks, a ring, wheels or a rotor does not',
    wear.W.robo.shoes && wear.W.timber.shoes && !wear.W.rocky.shoes && !wear.W.tipi.shoes && !wear.W.sabli.shoes && wear.shoesOnTimber && wear.shoesOnZoom, wear);
  ck('a box-headed type wears an outfit', wear.fitOnRocky && wear.W.sabli.outfit, wear);

  console.log('▶ good and bad at what the canvas says');
  const rules = await pg.evaluate(() => {
    const at = (kind) => makeRobot(0, 0, 'T', kind);
    /* a tile of water, a tree and grass, found in this world */
    let water = null, tree = null, grass = null;
    for (let y = 1; y < H - 1 && !(water && tree && grass); y++) for (let x = 1; x < W - 1; x++) {
      const k = key(x, y), o = objects.get(k);
      if (!water && terrain[k] === T_WATER && !o) water = [x, y];
      if (!tree && o && o.type === 'tree' && o.stage >= 1) tree = [x, y];
      if (!grass && terrain[k] !== T_WATER && !o) grass = [x, y];
    }
    const walk = (kind, p) => canWalk(p[0], p[1], at(kind));
    const ms = k => robotStepMs(at(k));
    return {
      water: { robo: walk('robo', water), tipi: walk('tipi', water), zoom: walk('zoom', water), none: canWalk(water[0], water[1]) },
      tree: { robo: walk('robo', tree), tipi: walk('tipi', tree), zoom: walk('zoom', tree) },
      grass: CC_RIG.KINDS.every(k => walk(k, grass)),
      edge: CC_RIG.KINDS.some(k => canWalk(-1, 3, at(k)) || canWalk(W, 3, at(k))),
      ms: Object.fromEntries(CC_RIG.KINDS.map(k => [k, ms(k)])),
      chop: { robo: workTicks(at('robo'), 'chop'), timber: workTicks(at('timber'), 'chop'), rocky: workTicks(at('rocky'), 'chop') },
      mine: { robo: workTicks(at('robo'), 'mine'), rocky: workTicks(at('rocky'), 'mine'), timber: workTicks(at('timber'), 'mine') },
      bag: Object.fromEntries(CC_RIG.KINDS.map(k => [k, at(k).cap])),
      names: CC_RIG.KINDS.map(k => makeRobot(0, 0, null, k).name),
      odd: at('dragon').kind
    };
  });
  ck('Tipi floats onto water; Robo cannot; a robot named by no one keeps the old rule',
    rules.water.tipi && !rules.water.robo && !rules.water.none, rules.water);
  ck('Zoom flies over water and over a tree; Robo and Tipi stop at the tree',
    rules.water.zoom && rules.tree.zoom && !rules.tree.robo && !rules.tree.tipi, rules);
  ck('all of them walk on grass, and none of them past the edge of the map', rules.grass && !rules.edge, rules);
  ck('Zoom is the fastest; Rocky and Sabli are slower than Robo; Timber and Tipi keep its pace',
    rules.ms.zoom < rules.ms.robo && rules.ms.rocky > rules.ms.robo && rules.ms.sabli > rules.ms.robo &&
    rules.ms.timber === rules.ms.robo && rules.ms.tipi === rules.ms.robo, rules.ms);
  ck('Timber swings an axe in half the time, and only an axe',
    rules.chop.timber === rules.chop.robo / 2 && rules.chop.rocky === rules.chop.robo && rules.mine.timber === rules.mine.robo, rules.chop);
  ck('Rocky swings a pick in half the time, and only a pick', rules.mine.rocky === rules.mine.robo / 2, rules.mine);
  ck('Sabli carries twice the bag, Zoom half', rules.bag.sabli === 2 * rules.bag.robo && rules.bag.zoom === rules.bag.robo / 2, rules.bag);
  ck('each one is named for its kind', rules.names.join() === 'Robo-2,Timber-2,Rocky-2,Tipi-2,Sabli-2,Zoom-2', rules.names);
  ck('a kind the game does not know makes a Robo', rules.odd === 'robo', rules.odd);

  console.log('▶ a program means the same thing on all of them');
  const prog = await pg.evaluate(() => {
    /* a square walked with Move and Turn ends where it began, whoever walks it,
       as long as nothing on it stops anyone */
    const out = {};
    let s = null;
    for (let y = 2; y < H - 4 && !s; y++) for (let x = 2; x < W - 4 && !s; x++) {
      let ok = true;
      for (let dy = 0; dy < 3 && ok; dy++) for (let dx = 0; dx < 3 && ok; dx++) ok = canWalk(x + dx, y + dy);
      if (ok) s = [x, y];
    }
    CC_RIG.KINDS.forEach(k => {
      const r = makeRobot(s[0], s[1], 'P', k); r.dir = 1;
      const steps = [];
      for (let i = 0; i < 4; i++) { doAction(r, { t: 'move' }); doAction(r, { t: 'move' }); doAction(r, { t: 'turnR' }); steps.push(r.x + ',' + r.y); }
      out[k] = steps.join(' ');
    });
    return out;
  });
  ck('the same square, the same steps, for every kind', new Set(Object.values(prog)).size === 1, prog);

  console.log('▶ saved as itself');
  const save = await pg.evaluate(() => {
    const keep = robots.slice();
    robots.length = 0;
    CC_RIG.KINDS.forEach(k => robots.push(makeRobot(homePos.x, homePos.y + 1, null, k)));
    const snap = JSON.parse(JSON.stringify(buildSave()));
    snap.robots[0].kind = 'dragon'; snap.robots[1].kind = '<img src=x>';
    applySave(snap);
    const after = robots.map(r => r.kind);
    robots.length = 0; keep.forEach(r => robots.push(r));
    return after;
  });
  ck('every kind survives buildSave → applySave', save.slice(2).join() === 'rocky,tipi,sabli,zoom', save);
  ck('a kind in a save that the game does not know comes back a Robo', save[0] === 'robo' && save[1] === 'robo', save);

  console.log('▶ the shop sells each one, by its own row');
  const shop = await pg.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    coins = 1000; const n0 = robots.length;
    openShop(); await w(200);
    const rows = [...document.querySelectorAll('#shopItems .shopitem')];
    const titles = rows.slice(0, 6).map(r => r.querySelector('.tx b').textContent);
    const pics = rows.slice(0, 6).every(r => r.querySelector('.em canvas'));
    rows[5].querySelector('button').click(); await w(100);
    const got = robots[robots.length - 1];
    const res = { titles, pics, n: robots.length - n0, kind: got.kind, coins, sel: selRobot === robots.length - 1 };
    robots.pop(); selRobot = 0; document.querySelectorAll('#ccCele').forEach(e => e.remove());
    navHome();
    return res;
  });
  ck('a row for each of the six, with its price, pictured by the rig',
    shop.titles.length === 6 && /^Robo — 100/.test(shop.titles[0]) && /^Zoom — 400/.test(shop.titles[5]) && shop.pics, shop);
  ck('buying Zoom adds a Zoom, costs 400 and picks it', shop.n === 1 && shop.kind === 'zoom' && shop.coins === 600 && shop.sel, shop);

  console.log('▶ Style shows a type only what it can wear');
  const style = await pg.evaluate(async () => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    player.level = 20;
    const t = makeRobot(homePos.x, homePos.y + 1, 'Tim', 'timber'); robots.push(t); selRobot = robots.length - 1;
    styleOpen(); await w(300);
    const slots = [...document.querySelectorAll('#styleBody .st-slot')].map(s => ({ note: (s.querySelector('.st-note') || {}).textContent || '', sw: s.querySelectorAll('.st-sw').length }));
    navHome(); robots.pop(); selRobot = 0;
    return slots;
  });
  ck('Timber: the hat row says only Robo wears one; outfits and shoes are offered',
    style.length === 3 && style[0].note === 'Only Robo wears a hat.' && style[0].sw === 0 && style[1].sw > 1 && style[2].sw > 1, style);

  ck('no uncaught exceptions', errs.length === 0, errs.slice(0, 3));
  await b.close();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
