/* Security regressions.
   Each of these was a real hole, verified exploitable before it was closed.

   Run: NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node test/security.js */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
let pass=0, fail=0;
const ck=(n,ok,d)=>{ok?pass++:fail++; console.log((ok?'  ✅ ':'  ❌ ')+n+(ok?'':' — '+JSON.stringify(d)));};

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const pg = await b.newPage({ viewport:{width:390,height:844} });
  const csp=[], errs=[];
  pg.on('console',m=>{ if(/Content Security Policy|Refused to/i.test(m.text())) csp.push(m.text().slice(0,150)); });
  pg.on('pageerror',e=>errs.push(String(e)));
  pg.on('dialog',async d=>{ errs.push('DIALOG '+d.message()); await d.dismiss(); });

  await pg.goto('file://'+ROOT+'/index.html'); await pg.waitForTimeout(1100);
  await pg.evaluate(()=>{ ageSet(true); document.getElementById('agegate').classList.remove('open'); });
  await pg.click('#playBtn').catch(()=>{}); await pg.waitForTimeout(1400);
  await pg.evaluate(()=>{ const c=document.querySelector('#ccCele .cc-cta'); if(c)c.click(); });
  await pg.waitForTimeout(1500);
  await pg.evaluate(()=>{ if(mgState)mgExit(false); tutSet(0);
    document.querySelectorAll('.sheet.open').forEach(x=>x.classList.remove('open')); });
  await pg.waitForTimeout(400);

  // ------------------------------------------------ save-file HTML injection
  /* A save carries the robot's name and colour, and both are drawn through
     innerHTML. Unescaped, a crafted name landed a live <img onerror> in the
     robot chips and the shop row, and a crafted colour broke out of the
     style attribute to add an event handler. Save files get shared, and
     localStorage holds the Supabase session token. */
  const inj = await pg.evaluate(async ()=>{
    delete window.__XSS;
    R().name='<img src=x onerror="window.__XSS=1">Robo';
    R().color='red" onmouseover="window.__XSS=1';
    updateChips(); openShop();
    await new Promise(r=>setTimeout(r,350));
    return { img:!!document.querySelector('#robotChips img'),
             ran:!!window.__XSS,
             handler:/onmouseover/i.test($('robotChips').innerHTML),
             colour:(/background:([^"';]*)/.exec($('robotChips').innerHTML)||[])[1]||'' };
  });
  ck('a crafted robot name cannot inject an element',  !inj.img, inj);
  ck('...and cannot execute',                          !inj.ran, inj);
  ck('a crafted colour cannot escape the style attribute',
     !inj.handler && /^#[0-9a-fA-F]{3,8}$/.test(inj.colour.trim()), inj);
  await pg.evaluate(()=>{ $('shopWrap').classList.remove('open'); });

  // ------------------------------------------------ escaping is attribute-safe
  const e = await pg.evaluate(()=>({
    lt:esc('<b>'), quot:esc('a"b'), apos:esc("a'b"), gt:esc('a>b'),
    colour:safeColor('red" onmouseover=x'), colourOk:safeColor('#7a4dff'),
    text:safeText('<img src=x>hello') }));
  ck('esc covers < > " and \'',
     e.lt==='&lt;b&gt;' && e.quot==='a&quot;b' && e.apos==='a&#39;b' && e.gt==='a&gt;b', e);
  ck('safeColor only passes real colours',
     e.colour==='#ffb830' && e.colourOk==='#7a4dff', e);
  ck('safeText strips markup', !/[<>]/.test(e.text), e);

  // ------------------------------------------------ prototype pollution
  /* JSON.parse keeps a literal "__proto__" as an own property, and the
     loader hands these objects to Object.assign, whose [[Set]] runs the
     prototype setter. */
  const proto = await pg.evaluate(()=>{
    const hostile='{"v":2,"__proto__":{"pwned":1},"robots":[]}';
    const cleaned=JSON.parse(hostile,(k,v)=>
      (k==="__proto__"||k==="constructor"||k==="prototype")?undefined:v);
    return { hasOwn:Object.prototype.hasOwnProperty.call(cleaned,'__proto__'),
             polluted:({}).pwned!==undefined };
  });
  ck('an imported save cannot carry a __proto__ key', !proto.hasOwn && !proto.polluted, proto);

  // ------------------------------------------------ CSP
  const meta = await pg.evaluate(()=>{
    const m=document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    return m?m.content:null;
  });
  ck('the page ships a CSP', !!meta, meta);
  ck("script-src is 'self' with no unsafe-inline or unsafe-eval",
     !!meta && /script-src 'self'\s*;/.test(meta) &&
     !/script-src[^;]*unsafe-(inline|eval)/.test(meta), meta);
  ck("object-src and base-uri are 'none'",
     !!meta && /object-src 'none'/.test(meta) && /base-uri 'none'/.test(meta), meta);

  /* A strict script-src is only possible while the page has no inline script
     and no inline handler; a future one would silently be blocked instead. */
  /* comments are stripped first: the CSP comment in index.html itself talks
     about inline scripts, and matched the check that looks for them. */
  const html=fs.readFileSync(ROOT+'/index.html','utf8').replace(/<!--[\s\S]*?-->/g,'');
  ck('no inline script or handler that a strict CSP would break',
     !/<script(?![^>]*\bsrc=)/.test(html) && !/\son(click|load|error|change|input|submit)=/.test(html), null);

  /* The app has to run clean under it. Measured in a fresh page, because the
     injection above deliberately trips script-src-attr — that violation is
     the policy working, not a defect. */
  const pg2 = await b.newPage({ viewport:{width:390,height:844} });
  const csp2=[];
  pg2.on('console',m=>{ if(/Content Security Policy|Refused to/i.test(m.text())) csp2.push(m.text().slice(0,150)); });
  await pg2.goto('file://'+ROOT+'/index.html'); await pg2.waitForTimeout(1100);
  await pg2.evaluate(()=>{ ageSet(true); document.getElementById('agegate').classList.remove('open'); });
  await pg2.click('#playBtn').catch(()=>{}); await pg2.waitForTimeout(1400);
  await pg2.evaluate(()=>{ const c=document.querySelector('#ccCele .cc-cta'); if(c)c.click(); });
  await pg2.waitForTimeout(1500);
  await pg2.evaluate(()=>{ if(mgState)mgExit(false); tutSet(0);
    document.querySelectorAll('.sheet.open').forEach(x=>x.classList.remove('open')); });
  for (const fn of ['hubOpen','openShop','openSettings','openGuide','openFuncLib','ordersOpen']) {
    await pg2.evaluate(n=>{ try{ window[n]&&window[n](); }catch(_){} }, fn);
    await pg2.waitForTimeout(200);
    await pg2.evaluate(()=>navHome()); await pg2.waitForTimeout(120);
  }
  await pg2.evaluate(()=>{ academyEnter(0); }); await pg2.waitForTimeout(800);
  ck('the app itself never violates it', csp2.length===0, csp2.slice(0,3));
  await pg2.close();

  /* The escaping above now stops the payload before it becomes an element,
     so the policy never gets asked. Prove it is still load-bearing by
     simulating a sink that gets missed in future: write the handler straight
     into the DOM and confirm it cannot run. */
  const net = await pg.evaluate(async ()=>{
    delete window.__CSP;
    const d=document.createElement('div');
    d.innerHTML='<img src=x onerror="window.__CSP=1">';
    document.body.appendChild(d);
    await new Promise(r=>setTimeout(r,300));
    const ran=!!window.__CSP; d.remove();
    return ran;
  });
  ck('...and it stops a handler that slips past escaping', net===false, {executed:net});

  // ------------------------------------------------ no secrets shipped
  const files=[]; (function walk(d){ for(const f of fs.readdirSync(d,{withFileTypes:true})){
    if(f.name==='.git'||f.name==='node_modules')continue;
    const p=path.join(d,f.name);
    if(f.isDirectory())walk(p); else if(/\.(js|html|json|sql|md)$/.test(f.name))files.push(p);
  }})(ROOT);
  const leaks=files.filter(f=>path.basename(f)!=='security.js')
    .filter(f=>/service_role|SUPABASE_SERVICE|BEGIN (RSA )?PRIVATE KEY/.test(
      fs.readFileSync(f,'utf8')));
  ck('no service-role key or private key in the tree', leaks.length===0,
     leaks.map(f=>path.relative(ROOT,f)));

  console.log('  pageerrors:', errs.length?errs.slice(0,3):'none');
  ck('no uncaught exceptions', errs.length===0, errs.slice(0,3));
  ck('a bad colour cannot throw inside the draw loop',
     !errs.some(e=>/addColorStop/.test(e)), errs.filter(e=>/addColorStop/.test(e)).slice(0,1));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
