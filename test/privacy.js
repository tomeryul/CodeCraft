/* Privacy policy — checks the page is reachable from the app, and that the
   factual claims it makes about the app are actually true.
   A privacy policy that drifts from the code is worse than none, so the
   claims are asserted against the running app, not just spell-checked.
   Run: NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node test/privacy.js */
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

let pass=0, fail=0;
const ck=(n,ok,d)=>{ok?pass++:fail++; console.log((ok?'  ✅ ':'  ❌ ')+n+(ok?'':' — '+JSON.stringify(d)));};

(async () => {
  const b = await chromium.launch(LAUNCH);
  const errs=[];

  // ---------------------------------------------- the page itself
  let ctx = await b.newContext({ viewport:{width:420,height:940} });
  let pg = await ctx.newPage(); pg.on('pageerror',e=>errs.push(String(e)));
  await pg.goto('file://'+path.join(ROOT,'privacy.html')); await pg.waitForTimeout(400);
  const page = await pg.evaluate(()=>({
    title:document.title,
    h2:[...document.querySelectorAll('h2')].map(h=>h.textContent.trim()),
    body:document.body.innerText,
    horizScroll:document.documentElement.scrollWidth>document.documentElement.clientWidth+1
  }));
  ck('the policy page renders', /Privacy Policy/i.test(page.title));
  ck('it covers every section a store listing needs', ['Children','Deleting your data','Your rights','Contact','How long it is kept']
       .every(s=>page.h2.some(h=>h.indexOf(s)>=0)), page.h2);
  ck('it does not scroll sideways on a phone', page.horizScroll===false);

  // ---------------------------------------------- reachable from the app
  ctx = await b.newContext({ viewport:{width:420,height:940} });
  pg = await ctx.newPage(); pg.on('pageerror',e=>errs.push(String(e)));
  const reqs=[]; pg.on('request',r=>{ if(!/^(file|data|blob):/.test(r.url())) reqs.push(r.url()); });
  await pg.goto(APP); await pg.waitForTimeout(1200);
  ck('a first-time player can reach it from the age gate',
     await pg.evaluate(()=>{const a=document.querySelector('.age-priv');
       return !!a && a.getAttribute('href')==='./privacy.html';}));

  await pg.selectOption('#ageMonth','6');
  await pg.selectOption('#ageYear', String(new Date().getFullYear()-9));
  await pg.click('#ageGo'); await pg.waitForTimeout(400);
  ck('an under-13 player can reach it from the splash',
     await pg.evaluate(()=>!!document.querySelector('#splashAuth .sp-priv a')));

  await pg.evaluate(()=>{ ageSet(true); renderSplashAuth(); }); await pg.waitForTimeout(200);
  ck('a signed-out player can reach it from the splash',
     await pg.evaluate(()=>!!document.querySelector('#splashAuth .sp-priv a')));
  await pg.evaluate(()=>{ sbUser={email:"a@b.c",uid:"u",access:"t",refresh:"r",exp:Date.now()+3e6};
                          renderSplashAuth(); }); await pg.waitForTimeout(200);
  ck('a signed-in player can reach it from the splash',
     await pg.evaluate(()=>!!document.querySelector('#splashAuth .sp-priv a')));

  // ------------------------- the claims, checked against the running app
  await pg.evaluate(()=>{ sbUser=null; });
  await pg.click('#playBtn').catch(()=>{}); await pg.waitForTimeout(1800);
  ck('CLAIM "no network requests beyond downloading itself" holds for a guest',
     reqs.length===0, reqs.slice(0,5));

  // force a save rather than waiting on the 8s autosave, so the check is deterministic
  const keys = await pg.evaluate(()=>{ saveNow(); return Object.keys(localStorage).sort(); });
  ck('CLAIM the app stores exactly the two keys the policy names',
     JSON.stringify(keys)===JSON.stringify(['codecraft_age_v1','codecraft_save_v1']), keys);

  // static claims about the source
  const src = fs.readdirSync(path.join(ROOT,'js'),{recursive:true})
    .filter(f=>f.endsWith('.js')).map(f=>fs.readFileSync(path.join(ROOT,'js',f),'utf8'))
    .concat(fs.readFileSync(path.join(ROOT,'index.html'),'utf8')).join('');
  ck('CLAIM "no advertising, analytics or tracking" — no such SDK in the source',
     !/googletagmanager|gtag\(|firebase|mixpanel|amplitude|segment\.com|sentry|admob|doubleclick|facebook\.net/i.test(src));
  ck('CLAIM the font is served from this origin, not a font CDN',
     !/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(src)
     && fs.existsSync(path.join(ROOT,'fonts','fredoka-latin.woff2')));
  ck('CLAIM no location, camera, microphone or contacts are used',
     !/getUserMedia|geolocation|navigator\.contacts|DeviceOrientation/i.test(src));
  ck('the self-hosted font ships its OFL licence', fs.existsSync(path.join(ROOT,'fonts','OFL.txt')));

  const origins = [...new Set((src.match(/https?:\/\/[a-z0-9.-]+/gi)||[])
    .map(u=>u.toLowerCase()).filter(u=>!u.startsWith('http://www.w3.org')))];
  ck('CLAIM only one backend origin is contacted', origins.length===1 && /supabase\.co/.test(origins[0]), origins);

  ck('the policy is cached, so it opens offline',
     /"\.\/privacy\.html"/.test(fs.readFileSync(path.join(ROOT,'sw.js'),'utf8')));

  // the contact placeholder must be impossible to miss before submission
  ck('the unfilled contact address is flagged as a TODO',
     /TODO before submitting/i.test(page.body), 'contact section');

  console.log('  pageerrors:', errs.length?errs.slice(0,3).join(' | '):'none');
  ck('no uncaught exceptions', errs.length===0);
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
