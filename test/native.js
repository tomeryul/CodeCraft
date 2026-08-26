/* The native shell adapter, exercised in a browser against a fake Capacitor
   bridge. Capacitor exposes its plugins on window.Capacitor.Plugins at
   runtime, so a stub injected before the page scripts run is the real
   interface — not a mock of our own invention.
   Run: NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node test/native.js */
const { chromium } = require('playwright');
const APP = 'file:///home/user/CodeCraft/index.html';
let pass=0, fail=0;
const ck=(n,ok,d)=>{ok?pass++:fail++; console.log((ok?'  ✅ ':'  ❌ ')+n+(ok?'':' — '+JSON.stringify(d)));};

/* A stand-in for the native bridge. `seed` pre-loads native storage, which is
   how we simulate iOS having evicted the webview's localStorage. */
function bridge(seed){
  return `(() => {
    const store = ${JSON.stringify(seed||{})};
    window.__calls = [];
    const rec = (n,a) => { window.__calls.push(n+':'+JSON.stringify(a||{})); };
    window.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => 'ios',
      Plugins: {
        Preferences: {
          get: async ({key}) => { rec('prefs.get',{key}); return {value: key in store ? store[key] : null}; },
          set: async ({key,value}) => { rec('prefs.set',{key}); store[key]=value; },
          remove: async ({key}) => { rec('prefs.remove',{key}); delete store[key]; }
        },
        App: {
          addListener: (ev, fn) => { (window.__handlers = window.__handlers || {})[ev] = fn; return {remove(){}}; },
          exitApp: () => { rec('app.exitApp'); window.__exited = true; }
        },
        Browser: { open: async ({url}) => { rec('browser.open',{url}); window.__opened = url; } },
        StatusBar: { setStyle: async (o) => { rec('statusbar.setStyle',o); } }
      },
      __store: store
    };
  })()`;
}

(async () => {
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const errs=[];

  // ============================================================ native mode
  let ctx = await b.newContext({ viewport:{width:420,height:940} });
  await ctx.addInitScript(bridge());
  let pg = await ctx.newPage(); pg.on('pageerror',e=>errs.push(String(e)));
  const swReqs=[]; pg.on('request',r=>{ if(/sw\.js/.test(r.url())) swReqs.push(r.url()); });
  await pg.goto(APP); await pg.waitForTimeout(1200);

  ck('the app knows it is running natively',
     await pg.evaluate(()=>isNative()===true && document.documentElement.classList.contains('native')));
  ck('the service worker is not registered in the packaged app', swReqs.length===0, swReqs);
  ck('the status bar is styled for the dark theme',
     await pg.evaluate(()=>window.__calls.some(c=>c.startsWith('statusbar.setStyle'))));
  ck('a back-button handler is installed',
     await pg.evaluate(()=>!!(window.__handlers && window.__handlers.backButton)));

  // the age gate must not be escapable with back
  ck('back does nothing while the age gate is up',
     await pg.evaluate(()=>{ window.__handlers.backButton();
       return $('agegate').classList.contains('open') && !window.__exited; }));

  await pg.selectOption('#ageMonth','6');
  await pg.selectOption('#ageYear', String(new Date().getFullYear()-30));
  await pg.click('#ageGo'); await pg.waitForTimeout(300);

  // the answer is mirrored into device storage (debounced, so wait it out)
  await pg.waitForTimeout(1000);
  ck('the age answer is mirrored into native storage',
     await pg.evaluate(()=>Capacitor.__store['codecraft_age_v1']==='y'),
     await pg.evaluate(()=>Object.keys(Capacitor.__store)));

  await pg.click('#playBtn').catch(()=>{}); await pg.waitForTimeout(1400);
  await pg.evaluate(()=>{const c=document.querySelector('#ccCele .cc-cta');if(c)c.click();});
  await pg.waitForTimeout(400);

  await pg.evaluate(()=>{ saveNow(); }); await pg.waitForTimeout(1000);
  ck('the game save is mirrored into native storage',
     await pg.evaluate(()=>{
       const v=Capacitor.__store['codecraft_save_v1'];
       return !!v && v===localStorage.getItem('codecraft_save_v1');
     }));

  // back unwinds sheets, topmost first, and only leaves from the map
  const backSeq = await pg.evaluate(()=>{
    const out=[];
    $('quests').classList.add('open');
    $('projects').classList.add('open');
    window.__handlers.backButton();
    out.push({projects:$('projects').classList.contains('open'), quests:$('quests').classList.contains('open')});
    window.__handlers.backButton();
    out.push({projects:$('projects').classList.contains('open'), quests:$('quests').classList.contains('open')});
    // the editor is open behind them once the intro finishes, and it is a
    // screen too — back should close it before it ever leaves the app
    window.__exited=false;
    window.__handlers.backButton();
    out.push({editor:$('editor').classList.contains('open'), exited:window.__exited});
    window.__handlers.backButton();
    out.push({exited:window.__exited});
    return out;
  });
  ck('back closes the topmost sheet first',
     backSeq[0].projects===false && backSeq[0].quests===true, backSeq);
  ck('back then closes the one underneath', backSeq[1].quests===false, backSeq);
  ck('back closes the code editor rather than leaving',
     backSeq[2].editor===false && backSeq[2].exited===false, backSeq);
  ck('back with nothing left open leaves the app', backSeq[3].exited===true, backSeq);

  // links out go through the native browser, not a dead _blank
  const opened = await pg.evaluate(()=>{
    window.__opened=null;
    const a=document.createElement('a');
    a.href='./privacy.html'; a.target='_blank'; a.textContent='p';
    document.body.appendChild(a); a.click();
    return window.__opened;
  });
  ck('a _blank link opens through the native browser', /privacy\.html$/.test(opened||''), opened);

  // deleting the account must reach the mirror too
  const wiped = await pg.evaluate(async()=>{
    accountWipeLocal();
    await new Promise(r=>setTimeout(r,1000));
    return { local:localStorage.getItem('codecraft_save_v1'),
             native:Capacitor.__store['codecraft_save_v1'] };
  });
  ck('deleting the account clears the native mirror too',
     wiped.local===null && wiped.native===undefined, wiped);
  await ctx.close();

  // ================================= the save survives an evicted localStorage
  ctx = await b.newContext({ viewport:{width:420,height:940} });
  const seeded = JSON.stringify({v:2,coins:4242,player:{level:9,xp:77,quests:[],projects:{},projPrograms:{}}});
  await ctx.addInitScript(bridge({ 'codecraft_age_v1':'y', 'codecraft_save_v1':seeded }));
  pg = await ctx.newPage(); pg.on('pageerror',e=>errs.push(String(e)));
  await pg.goto(APP);                      // localStorage is empty; native storage is not
  await pg.waitForTimeout(2500);           // nativeRestore writes it back, then reloads
  const back = await pg.evaluate(()=>({
    local: localStorage.getItem('codecraft_save_v1'),
    age:   localStorage.getItem('codecraft_age_v1'),
    gate:  document.getElementById('agegate').classList.contains('open')
  }));
  ck('an evicted save is restored from native storage', back.local===seeded, back && {got:(back.local||'').slice(0,40)});
  ck('the age answer is restored too, so the gate is not asked again',
     back.age==='y' && back.gate===false, back);
  await ctx.close();

  // ======================================================== plain browser
  ctx = await b.newContext({ viewport:{width:420,height:940} });   // no bridge
  pg = await ctx.newPage(); pg.on('pageerror',e=>errs.push(String(e)));
  const swReqs2=[]; pg.on('request',r=>{ if(/sw\.js/.test(r.url())) swReqs2.push(r.url()); });
  await pg.goto(APP); await pg.waitForTimeout(1200);
  ck('in a plain browser the adapter reports not-native',
     await pg.evaluate(()=>isNative()===false && !document.documentElement.classList.contains('native')));
  ck('in a plain browser mirroring is a silent no-op',
     await pg.evaluate(()=>{ try{ nativeMirror('x','y'); return true; }catch(e){ return 'threw '+e.message; } })===true);
  ck('the age gate still works with no bridge present',
     await pg.evaluate(()=>document.getElementById('agegate').classList.contains('open')));

  console.log('  pageerrors:', errs.length?errs.slice(0,3).join(' | '):'none');
  ck('no uncaught exceptions', errs.length===0);
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
