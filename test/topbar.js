/* The top pill fits, whatever the numbers. Its width rules were sums worked
   out for one save; a long game brought five-digit coins, a 47/112 bag, a
   three-digit 🪙/min and an order clock all at once, and the pill ran 85px
   under the tool column on a 393px phone. hudFit() (hud.js) now measures and
   folds what matters least until it fits. This plays that save at every
   phone width, and checks a fresh one folds nothing.
   Run: NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node test/topbar.js */
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
  for (const W of [430, 393, 375, 360, 320]) {
    console.log(`▶ ${W}px`);
    const pg = await b.newPage({ viewport: { width: W, height: 852 }, hasTouch: true, isMobile: true });
    const errs = [];
    pg.on('pageerror', e => errs.push(String(e)));
    await pg.goto(APP); await wait(1100);
    await pg.selectOption('#ageMonth', '6');
    await pg.selectOption('#ageYear', String(new Date().getFullYear() - 30));
    await pg.click('#ageGo'); await wait(300);
    await pg.evaluate(() => $('playBtn').click()); await wait(1500);

    const measure = () => pg.evaluate(() => {
      const st = $('stats'), s = st.getBoundingClientRect(), t = $('tbBtns').getBoundingClientRect();
      return { right: Math.round(s.right), tools: Math.round(t.left),
               spill: st.scrollWidth - st.clientWidth, folds: st.className,
               coinsShown: !!$('coinChip').offsetParent, bagShown: !!$('bagChip').offsetParent,
               orderShown: !!document.querySelector('#ticker .tk-ord') };
    });

    const fresh = await measure();
    ck(`${W}: a fresh game folds nothing`, fresh.folds === '' && fresh.spill <= 1, fresh);

    await pg.evaluate(async () => {
      document.querySelectorAll('#ccCele').forEach(e => e.remove()); HELD.length = 0; navHome();
      player.fresh = false; player.level = 21; coins = 56284;
      const r = R(); r.cap = 112; for (const i in r.inv) r.inv[i] = 0; r.inv.wood = 47; r.energy = 73;
      marketReady(); market.order = { need: { wood: 5 }, got: {}, until: now + 130000, reward: 50, shape: 'spread' };
      for (let i = 0; i < 5; i++) noteEarning(47.4);
      updateHud(); renderMarket();
      await new Promise(r => setTimeout(r, 400));
    });
    const long = await measure();
    ck(`${W}: a long game's row stops short of the tool column`, long.right <= long.tools && long.spill <= 1, long);
    ck(`${W}: coins, the bag and the order clock are never what folds`, long.coinsShown && long.bagShown && long.orderShown, long);

    const crit = await pg.evaluate(async () => {
      R().energy = 12; updateHud(); await new Promise(r => setTimeout(r, 200));
      return !!$('energyChip').offsetParent;
    });
    ck(`${W}: energy low enough to stop the robot is shown anyway`, crit, crit);
    const after = await measure();
    ck(`${W}: and the row still fits with it`, after.right <= after.tools && after.spill <= 1, after);

    ck(`${W}: no uncaught exceptions`, errs.length === 0, errs.slice(0, 3));
    await pg.close();
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
