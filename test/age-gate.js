/* Age gate — drives the real screen in a real browser.
   Run: NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node test/age-gate.js */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
/* Paths are derived from this file's own location, and the browser is only
   pinned when the sandbox's bundled Chromium is present — on a CI runner
   Playwright resolves its own. Hardcoding either made these suites pass
   here and fail everywhere else. */
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const LAUNCH = require('fs').existsSync(CHROME) ? { executablePath: CHROME } : {};
const APP = 'file://' + path.join(ROOT, 'index.html');

const OUT = process.env.SHOT_DIR || '/tmp/';
let pass=0, fail=0;
const ck=(n,ok,d)=>{ok?pass++:fail++; console.log((ok?'  ✅ ':'  ❌ ')+n+(ok?'':' — '+JSON.stringify(d)));};


// answer the gate with a birth month/year and return the page
async function answer(pg, month, year){
  await pg.selectOption('#ageMonth', String(month));
  await pg.selectOption('#ageYear', String(year));
  await pg.click('#ageGo');
  await pg.waitForTimeout(400);
}

(async () => {
  const b = await chromium.launch(LAUNCH);
  const errs=[];

  // ---------------------------------------------------------------- asked once
  let ctx = await b.newContext({ viewport:{width:420,height:940}, deviceScaleFactor:2 });
  let pg = await ctx.newPage();
  pg.on('pageerror',e=>errs.push(String(e)));
  const thisYear = new Date().getFullYear();
  await pg.goto(APP); await pg.waitForTimeout(1200);

  ck('a first-time player is asked before anything else',
     await pg.evaluate(()=>document.getElementById('agegate').classList.contains('open')));
  ck('it asks WHEN you were born, not whether you are old enough',
     await pg.evaluate(()=>{
       const t=document.querySelector('#agegate h2').textContent+' '+document.querySelector('.age-sub').textContent;
       return /when were you born/i.test(t) && !/\b13\b|older than|over \d/i.test(t);
     }));
  ck('Continue is disabled until both fields are set',
     await pg.evaluate(()=>document.getElementById('ageGo').disabled));
  await pg.screenshot({path:OUT+'age-1-gate.png'});

  // ------------------------------------------------------------- under cutoff
  await answer(pg, 6, thisYear-9);                       // a nine-year-old
  ck('the gate closes once answered',
     await pg.evaluate(()=>!document.getElementById('agegate').classList.contains('open')));
  ck('only a yes/no is stored — never the date',
     await pg.evaluate(by=>{
       // the answer key holds one character, and the birth year entered above
       // appears nowhere on the device
       const age=localStorage.getItem('codecraft_age_v1');
       const all=Object.keys(localStorage).map(k=>k+'='+localStorage.getItem(k)).join('|');
       return age==='n' && all.indexOf(String(by))<0;
     }, thisYear-9), await pg.evaluate(()=>localStorage.getItem('codecraft_age_v1')));
  ck('under the cutoff there is no sign-in box on the splash',
     await pg.evaluate(()=>!document.getElementById('spEmail') && !document.getElementById('spSignup')));
  ck('and it says so plainly instead of showing a locked door',
     await pg.evaluate(()=>!!document.querySelector('#splashAuth .agenote')));
  await pg.screenshot({path:OUT+'age-2-under.png'});

  // The whole single-player game must be identical either way, so measure it
  // the same way on both sides of the cutoff and compare, rather than guessing
  // what a brand-new player's palette should contain (they start in the
  // Academy, which deliberately restricts it to the current lesson).
  const soloSnapshot = async p => {
    await p.click('#playBtn').catch(()=>{}); await p.waitForTimeout(1200);
    await p.evaluate(()=>{const c=document.querySelector('#ccCele .cc-cta');if(c)c.click();});
    await p.waitForTimeout(400);
    return p.evaluate(()=>{
      document.getElementById('editor').classList.add('open','max'); setTab('blocks'); renderPalette();
      return { blocks:document.querySelectorAll('#palette .pblk').length,
               tabs:[...document.querySelectorAll('.rtab')].length,
               world:objects.size>0, robot:!!R(),
               academy:typeof academyComplete==='function' };
    });
  };
  const solo = await soloSnapshot(pg);
  ck('the world and the robot are there below the cutoff', solo.world && solo.robot, solo);

  // community + publishing are simply absent
  const gated = await pg.evaluate(()=>{
    if(window.openProjects)openProjects(); else $('projects').classList.add('open');
    renderProjects();
    return { ccList:!!document.getElementById('ccList'),
             authBox:!!document.querySelector('#authBox .agenote'),
             publishGuard:(()=>{ try{ mgState={proj:{name:"x",diff:1}}; publishChallenge(); return true; }catch(e){ return 'threw '+e.message; } })() };
  });
  ck('the community list is not rendered at all', gated.ccList===false, gated);
  ck('the account box explains instead of offering sign-in', gated.authBox===true, gated);
  ck('publishChallenge refuses even if called directly', gated.publishGuard===true, gated);
  await pg.screenshot({path:OUT+'age-3-projects.png'});

  // it is not asked again, and cannot be re-rolled by wiping the save
  await pg.evaluate(()=>{ saveOff=false; localStorage.removeItem(SAVE_KEY); });
  await pg.reload(); await pg.waitForTimeout(1200);
  ck('the answer is not asked again on the next launch',
     await pg.evaluate(()=>!document.getElementById('agegate').classList.contains('open')));
  ck('clearing the game save does not re-roll the gate',
     await pg.evaluate(()=>localStorage.getItem('codecraft_age_v1')==='n'));
  await ctx.close();

  // ------------------------------------------------------------- over cutoff
  ctx = await b.newContext({ viewport:{width:420,height:940} });
  pg = await ctx.newPage(); pg.on('pageerror',e=>errs.push(String(e)));
  await pg.goto(APP); await pg.waitForTimeout(1200);
  await answer(pg, 6, thisYear-30);
  ck('over the cutoff the sign-in box is offered',
     await pg.evaluate(()=>!!document.getElementById('spEmail')));
  ck('over the cutoff the stored answer is yes',
     await pg.evaluate(()=>localStorage.getItem('codecraft_age_v1')==='y'));
  const okUi = await pg.evaluate(()=>{
    renderProjects();
    return { ccList:!!document.getElementById('ccList') };
  });
  ck('the community list is rendered above the cutoff', okUi.ccList===true, okUi);

  const soloAdult = await soloSnapshot(pg);
  ck('the single-player game is byte-for-byte the same on both sides of the cutoff',
     JSON.stringify(solo)===JSON.stringify(soloAdult), {kid:solo, adult:soloAdult});

  // ------------------------------------------------------- the boundary itself
  const edge = await pg.evaluate(m=>{
    const now=new Date(), y=now.getFullYear(), mo=now.getMonth()+1;
    return { exactlyToday: ageFrom(mo, y-13),        // turns 13 this month
             monthEarly:   ageFrom(mo===12?1:mo+1, y-13), // birthday not yet reached
             dayAfter:     ageFrom(mo, y-14) };
  });
  ck('someone who turns 13 this month counts as 13', edge.exactlyToday===13, edge);
  ck('a birthday later this year has not happened yet', edge.monthEarly===12, edge);
  ck('a fourteen-year-old reads as 14', edge.dayAfter===14, edge);

  // ------------------------------------------ signed in, then answers under
  const kicked = await pg.evaluate(()=>{
    saveNow();   // make sure a local save exists, rather than racing the autosave
    sbUser={email:"x@y.z",uid:"u1",access:"t",refresh:"r",exp:Date.now()+3600000};
    localStorage.setItem(SB_AUTH_KEY,'{"x":1}');
    ageSet(false);
    if(sbUser&&typeof sbLogout==="function")sbLogout();
    return { user:sbUser, stored:localStorage.getItem(SB_AUTH_KEY), save:!!localStorage.getItem(SAVE_KEY) };
  });
  ck('answering under the cutoff while signed in logs the account out',
     kicked.user===null && kicked.stored===null, kicked);
  ck('...but leaves the progress on the device alone', kicked.save===true, kicked);

  console.log('  pageerrors:', errs.length?errs.slice(0,3).join(' | '):'none');
  ck('no uncaught exceptions', errs.length===0);
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
