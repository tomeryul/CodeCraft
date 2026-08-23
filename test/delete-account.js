const { chromium } = require('playwright');
const OUT='/tmp/';
let pass=0, fail=0;
const ck=(n,ok,d)=>{ok?pass++:fail++; console.log((ok?'  ✅ ':'  ❌ ')+n+(ok?'':' — '+JSON.stringify(d)));};

(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport:{width:420,height:940}, deviceScaleFactor:2 });
  const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
  await pg.goto('file:///home/user/CodeCraft/index.html'); await pg.waitForTimeout(1000);

  // a signed-in player with real local progress
  await pg.evaluate(()=>{
    sbUser={email:"kid@example.com",uid:"u-1",access:"tok",refresh:"ref",exp:Date.now()+3600000};
    coins=555; player.level=7; saveNow();
    window.__calls=[];
    window.sbRest=async(path)=>{ window.__calls.push(path); return null; };
    renderAuthBox(); renderSplashAuth();
  });
  await pg.waitForTimeout(300);

  ck('a Delete account button exists in the account box',
     await pg.evaluate(()=>!!document.querySelector('#authBox .authdel button')));
  ck('a delete link exists on the splash next to log out',
     await pg.evaluate(()=>!!document.getElementById('spDelete')));

  // open it
  await pg.evaluate(()=>openDeleteAccount()); await pg.waitForTimeout(400);
  const opened = await pg.evaluate(()=>({
    open:document.getElementById('delacc').classList.contains('open'),
    who:$('delWho').textContent, rows:document.querySelectorAll('#delList .del-row').length,
    btn:$('delGo').textContent
  }));
  ck('the sheet opens and names the account', opened.open && opened.who==='kid@example.com', opened);
  ck('it lists everything that will be deleted', opened.rows===4, opened);
  await pg.screenshot({path:OUT+'del-1-open.png'});

  // first tap: arms only
  await pg.click('#delGo'); await pg.waitForTimeout(250);
  const armed = await pg.evaluate(()=>({label:$('delGo').textContent, armed:$('delGo').classList.contains('armed'),
    calls:window.__calls.length, save:!!localStorage.getItem(SAVE_KEY)}));
  ck('one tap only arms — nothing is deleted', armed.calls===0 && armed.save===true, armed);
  ck('the button says it needs a second tap', /again/i.test(armed.label) && armed.armed, armed);
  await pg.screenshot({path:OUT+'del-2-armed.png'});

  // it disarms itself
  await pg.waitForTimeout(5400);
  const dis = await pg.evaluate(()=>({label:$('delGo').textContent, armed:$('delGo').classList.contains('armed')}));
  ck('the arm lapses on its own after a few seconds', !dis.armed && dis.label==='Delete everything', dis);

  // failure path must NOT wipe the device
  await pg.evaluate(()=>{ window.sbRest=async()=>{ throw new Error("network is down"); }; });
  await pg.click('#delGo'); await pg.waitForTimeout(150); await pg.click('#delGo'); await pg.waitForTimeout(600);
  const failed = await pg.evaluate(()=>({msg:$('delMsg').textContent, save:!!localStorage.getItem(SAVE_KEY),
    auth:!!localStorage.getItem(SB_AUTH_KEY), disabled:$('delGo').disabled}));
  ck('a failed delete keeps the local save', failed.save===true, failed);
  ck('a failed delete explains itself and re-enables', /network is down/.test(failed.msg) && !failed.disabled, failed);

  // success path
  await pg.evaluate(()=>{ window.__calls=[]; window.sbRest=async(p)=>{ window.__calls.push(p); return null; };
                          localStorage.setItem(SB_AUTH_KEY,'{"x":1}'); });
  await pg.click('#delGo'); await pg.waitForTimeout(150); await pg.click('#delGo'); await pg.waitForTimeout(700);
  const done = await pg.evaluate(()=>({calls:window.__calls.slice(), save:localStorage.getItem(SAVE_KEY),
    auth:localStorage.getItem(SB_AUTH_KEY), off:saveOff, msg:$('delMsg').textContent}));
  ck('it calls delete_my_account exactly once', done.calls.length===1 && done.calls[0]==='rpc/delete_my_account', done);
  ck('the local save is wiped', done.save===null, done);
  ck('the stored session is wiped', done.auth===null, done);
  ck('autosave is switched off so nothing resurrects it', done.off===true, done);
  await pg.screenshot({path:OUT+'del-3-done.png'});

  // the real trap: autosave / visibilitychange must not rewrite the save
  await pg.evaluate(()=>{ saveNow(); saveSoon(); document.dispatchEvent(new Event('visibilitychange')); });
  await pg.waitForTimeout(1800);
  ck('save stays gone after autosave + visibilitychange fire',
     await pg.evaluate(()=>localStorage.getItem(SAVE_KEY)===null));

  // and after the reload the game really is fresh
  await pg.waitForTimeout(900);
  const fresh = await pg.evaluate(()=>({coins, lvl:player.level, save:!!localStorage.getItem(SAVE_KEY)}));
  ck('the game comes back as a brand-new player', fresh.coins===0 && fresh.lvl===1, fresh);

  console.log('  pageerrors:', errs.length?errs.slice(0,3).join(' | '):'none');
  ck('no uncaught exceptions', errs.length===0);
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
