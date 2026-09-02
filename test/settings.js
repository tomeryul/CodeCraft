/* Shop and Settings are two different subjects.
   They shared one scroll: turning the music off meant scrolling past four
   things for sale. Nothing here costs coins, nothing the Shop sells is a
   setting.

   Run: NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node test/settings.js */
const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
let pass=0, fail=0;
const ck=(n,ok,d)=>{ok?pass++:fail++; console.log((ok?'  ✅ ':'  ❌ ')+n+(ok?'':' — '+JSON.stringify(d)));};
const titles = sel => `[...document.querySelectorAll('${sel} .shopitem')]
  .map(d=>d.querySelector('.tx b').textContent.trim())`;

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const pg = await b.newPage({ viewport:{width:390,height:844} });
  const errs=[]; pg.on('pageerror', e=>errs.push(String(e)));
  await pg.goto('file://'+ROOT+'/index.html'); await pg.waitForTimeout(1000);
  await pg.evaluate(()=>{ ageSet(true); document.getElementById('agegate').classList.remove('open'); });
  await pg.click('#playBtn').catch(()=>{}); await pg.waitForTimeout(1400);
  await pg.evaluate(()=>{ const c=document.querySelector('#ccCele .cc-cta'); if(c)c.click(); });
  await pg.waitForTimeout(1500);
  await pg.evaluate(()=>{ if(mgState)mgExit(false); tutSet(0);
    document.querySelectorAll('.sheet.open').forEach(x=>x.classList.remove('open')); });
  await pg.waitForTimeout(500);

  // ------------------------------------------------ the shop sells things
  await pg.evaluate(()=>openShop()); await pg.waitForTimeout(500);
  const shop = await pg.evaluate(titles('#shopItems'));
  ck('the Shop is only things you buy or wear',
     shop.length===5 && !shop.some(t=>/Sound|Music|Your name|Hidden|New World|Backup/i.test(t)), shop);

  // ------------------------------------------------ settings are settings
  await pg.evaluate(()=>{ $('shopWrap').classList.remove('open'); openSettings(); });
  await pg.waitForTimeout(500);
  const set = await pg.evaluate(titles('#settingsList'));
  ck('Settings holds every row that left the Shop',
     ['Sound','Music','Your name','Hidden players','New World']
       .every(w=>set.some(t=>t.startsWith(w))), set);
  ck('...and nothing that costs coins', !set.some(t=>/🪙|Robot|Bag|Speed|Bank|Style/.test(t)), set);

  /* Export and Import are on the Account & save page. Two copies of a
     restore button is how you load the wrong file. */
  ck('backup is not duplicated here', !set.some(t=>/Backup|Export|Import/i.test(t)), set);
  const acct = await pg.evaluate(async ()=>{
    $('settings').classList.remove('open'); hubPage('account');
    await new Promise(r=>setTimeout(r,400));
    return [...document.querySelectorAll('#projList .pcard')].filter(c=>c.offsetParent)
      .map(c=>c.querySelector('.pname').textContent);
  });
  ck('...because the account page still has it',
     acct.some(t=>/Export/.test(t)) && acct.some(t=>/Import/.test(t)), acct);

  // ------------------------------------------------ reachable, and navigable
  await pg.evaluate(()=>{ navHome(); hubOpen(); }); await pg.waitForTimeout(500);
  const tile = await pg.evaluate(()=>{
    const t=[...document.querySelectorAll('.hub-tile')]
      .find(x=>x.querySelector('.ht-name').textContent==='Settings');
    if(t)t.click();
    return !!t;
  });
  await pg.waitForTimeout(500);
  ck('the menu opens Settings', tile &&
     await pg.evaluate(()=>$('settings').classList.contains('open')), tile);

  const nav = await pg.evaluate(()=>{
    const h=$('settings').querySelector('.m-head');
    const back=h.querySelector('.iconbtn.back'), x=h.querySelector('.iconbtn.x');
    const big=e=>{const r=e.getBoundingClientRect();return r.width>=40&&r.height>=40;};
    return { back:!!back, exit:!!x, backFirst:h.firstElementChild===back,
             exitLast:h.lastElementChild===x, size:big(back)&&big(x) };
  });
  ck('Settings gets the same Back and Exit as every other page',
     nav.back && nav.exit && nav.backFirst && nav.exitLast && nav.size, nav);

  // ------------------------------------------------ the switches still work
  const sound = await pg.evaluate(()=>{
    const was=muted;
    [...document.querySelectorAll('#settingsList .shopitem')]
      .find(d=>d.querySelector('.tx b').textContent==='Sound').querySelector('button').click();
    const now=muted; muted=was; renderSettings();
    return { was, now };
  });
  ck('the Sound switch still flips', sound.was!==sound.now, sound);
  const music = await pg.evaluate(()=>{
    const was=musicOff;
    [...document.querySelectorAll('#settingsList .shopitem')]
      .find(d=>d.querySelector('.tx b').textContent==='Music').querySelector('button').click();
    const now=musicOff; musicOff=was; renderSettings();
    return { was, now };
  });
  ck('the Music switch still flips', music.was!==music.now, music);

  /* A button that looks pressable and does nothing is the fault the drag
     handle had. */
  const dead = await pg.evaluate(()=>{
    const row=[...document.querySelectorAll('#settingsList .shopitem')]
      .find(d=>/Hidden players/.test(d.querySelector('.tx b').textContent));
    const b=row.querySelector('button');
    return { n:(player.blocked||[]).length, disabled:b.disabled, text:b.textContent };
  });
  ck('with nobody hidden, that row offers no dead button',
     dead.n===0 ? dead.disabled : !dead.disabled, dead);

  console.log('  pageerrors:', errs.length?errs.slice(0,3):'none');
  ck('no uncaught exceptions', errs.length===0, errs.slice(0,3));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
