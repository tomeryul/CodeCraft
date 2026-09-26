/* A player's tour of every screen, instrumented — the measurement §0 of
   .claude/skills/game-app-design asks for. Not a pass/fail test: it writes
   a screenshot per surface plus log.json (every notification with the
   surface it landed on, every open/close, long tasks, layout shifts with
   their sources) and prints frame timings. Run it before and after a
   change and compare.

   Run: NODE_PATH=/opt/node22/lib/node_modules node scripts/ux-audit.js [outDir]
        THROTTLE=1 … to slow the CPU 4× (script cost on a mid phone; the
        compositing numbers are exaggerated by headless software rendering) */
const { chromium } = require('playwright');
const fs=require('fs'); const path=require('path');
const OUT=(process.argv[2]||'/tmp/ux-audit').replace(/\/?$/,'/'); fs.mkdirSync(OUT,{recursive:true});
const CHROME=process.env.CHROME_PATH||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const APP='file://'+path.join(__dirname,'..','index.html');
(async()=>{
const b=await chromium.launch(fs.existsSync(CHROME)?{executablePath:CHROME}:{});
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true});
const pg=await ctx.newPage();
const cdp=await ctx.newCDPSession(pg);
const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
await pg.addInitScript(()=>{
  window.__log=[]; window.__lt=[]; window.__cls=0;
  const t0=performance.now(); const T=()=>Math.round(performance.now()-t0);
  window.__mark=(s)=>window.__log.push({t:T(),k:'step',s});
  try{new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lt.push({t:Math.round(e.startTime),d:Math.round(e.duration)});}).observe({type:'longtask',buffered:true});}catch(_){}
  window.__shifts=[];
  const desc=n=>{if(!n||!n.nodeType)return '?';if(n.nodeType!==1)n=n.parentElement;if(!n)return '?';let s=n.tagName.toLowerCase()+(n.id?'#'+n.id:'')+(n.className&&typeof n.className==='string'?'.'+n.className.trim().split(/\s+/).slice(0,2).join('.'):'');const p=n.closest('[id]');return s+(p&&p!==n?' in #'+p.id:'');};
  try{new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput){window.__cls+=e.value;if(e.value>.005)window.__shifts.push({t:Math.round(e.startTime),v:+e.value.toFixed(3),src:(e.sources||[]).map(s=>desc(s.node)+' dy='+Math.round((s.currentRect.y-s.previousRect.y))+' dh='+Math.round(s.currentRect.height-s.previousRect.height))});}}).observe({type:'layout-shift',buffered:true});}catch(_){}
  addEventListener('DOMContentLoaded',()=>{
    const openNow=()=>[...document.querySelectorAll('.sheet.open,#shopWrap.open,#agegate.open,#splash:not(.hide),#ccCele.show,#ccCele.open')].map(e=>e.id).filter(Boolean);
    window.__open=openNow;
    const mo=new MutationObserver(ms=>{
      for(const m of ms){const el=m.target; if(!el.id)continue;
        const cl=el.classList; const o=cl.contains('open')||cl.contains('show');
        const was=(m.oldValue||'').split(/\s+/).some(c=>c==='open'||c==='show');
        if(o!==was)window.__log.push({t:T(),k:o?'open':'close',id:el.id,stack:openNow().join('>')});
      }});
    mo.observe(document.body,{attributes:true,attributeFilter:['class'],attributeOldValue:true,subtree:true});
    // count DOM churn
    window.__muts=0; new MutationObserver(ms=>{window.__muts+=ms.length;}).observe(document.body,{childList:true,characterData:true,subtree:true,attributes:true});
  });
  addEventListener('load',()=>{
    const wrap=(n)=>{const f=window[n]; if(typeof f!=='function')return;
      window[n]=function(msg){window.__log.push({t:T(),k:n,msg:String(msg).slice(0,110),on:(window.__open?window.__open():[]).join('>')});return f.apply(this,arguments);};};
    wrap('toast'); wrap('bigToast');
    // time the two canvas painters
    window.__paint={draw:[0,0],mgDraw:[0,0]};
    for(const n of ['draw','mgDraw']){const f=window[n]; if(typeof f!=='function')continue;
      window[n]=function(){const a=performance.now();const r=f.apply(this,arguments);const d=performance.now()-a;window.__paint[n][0]+=d;window.__paint[n][1]++;return r;};}
  });
});
const shot=async(name)=>{await pg.waitForTimeout(450);await pg.screenshot({path:OUT+name+'.png'});};
const cele=async()=>{const had=await pg.evaluate("(()=>{const c=document.querySelector('#ccCele .cc-cta');const v=c&&c.offsetParent;if(v){window.__log.push({t:0,k:'cele',msg:(document.getElementById('ccCele').textContent||'').replace(/\\s+/g,' ').slice(0,80)});c.click();}return !!v;})()");if(had)await pg.waitForTimeout(700);};
const step=async(name,fn,wait)=>{try{await pg.evaluate(`window.__mark(${JSON.stringify(name)})`);await cele();await fn();await pg.waitForTimeout(wait||600);await cele();await shot(name);}catch(e){console.log('STEP FAIL',name,e.message.slice(0,200));}};
const ev=s=>pg.evaluate(s);
// frame sampler: how smooth is the page over ms
const frames=async(label,ms)=>{
  const r=await pg.evaluate(ms=>new Promise(res=>{const d=[];let l=performance.now();const st=l;window.__paint={draw:[0,0],mgDraw:[0,0]};const m0=window.__muts;
    const f=t=>{d.push(t-l);l=t;if(t-st<ms)requestAnimationFrame(f);else res({n:d.length,p50:d.sort((a,b)=>a-b)[d.length>>1],p95:d[Math.floor(d.length*.95)],over33:d.filter(x=>x>33).length,draw:window.__paint.draw,mg:window.__paint.mgDraw,muts:window.__muts-m0});};requestAnimationFrame(f);}),ms);
  const per=x=>x[1]?+(x[0]/x[1]).toFixed(2):0;
  console.log('FRAMES',label,JSON.stringify({fps:Math.round(r.n/(ms/1000)),p50:+r.p50.toFixed(1),p95:+r.p95.toFixed(1),jank:r.over33,drawMsPerFrame:per(r.draw),drawCalls:r.draw[1],mgMsPerFrame:per(r.mg),domMutsPerSec:Math.round(r.muts/(ms/1000))}));
};
if(process.env.THROTTLE)await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
const tLoad=Date.now();
await pg.goto(APP);
await pg.waitForLoadState('load');
console.log('LOAD ms',Date.now()-tLoad,process.env.THROTTLE?'(4x cpu)':'');
await shot('00-agegate');
await step('01-splash',async()=>{await pg.selectOption('#ageMonth','6');await pg.selectOption('#ageYear',String(new Date().getFullYear()-30));await pg.click('#ageGo');},900);
await step('02-world-first',async()=>{await ev("$('playBtn').click()");},2500);
await frames('world idle (first run)',3000);
await step('03-world-after-cele',async()=>{await ev("{const c=document.querySelector('#ccCele .cc-cta');if(c)c.click();}");},1200);
await step('04-hub',async()=>{await ev("hubOpen()");},900);
await frames('hub open over world',3000);
for(const k of ['academy','puzzles','builds','cyber','tower','mine','community','account'])
  await step('05-hub-'+k,async()=>{await ev(`hubPage(${JSON.stringify(k)})`);},900);
await step('06-back-to-menu',async()=>{await ev("navBack()");},900);
const dest=[['07-shop',"hubClose();openShop()"],['08-style',"hubClose();styleOpen()"],['09-settings',"hubClose();openSettings()"],
  ['10-orders',"hubClose();ordersOpen()"],['11-quests',"hubClose();renderQuests();$('quests').classList.add('open')"],
  ['12-funclib',"hubClose();openFuncLib()"],['13-guide',"hubClose();openGuide()"]];
for(const [n,js] of dest){ await step(n,async()=>{await ev("{const w=$('shopWrap');if(w.classList.contains('open')){const x=w.querySelector('.m-head .iconbtn.x, .m-head .x, #shopClose');if(x)x.click();else w.classList.remove('open');}}");await ev("navHome()");await pg.waitForTimeout(300);await ev("hubOpen()");await pg.waitForTimeout(300);await ev(js);},900); }
await step('14-home',async()=>{await ev("navHome()");},800);
await step('15-editor-world',async()=>{await ev("$('editor').classList.add('open');renderProgram&&renderProgram()");},900);
await frames('world editor open',3000);
await step('16-editor-closed',async()=>{await ev("navHome()");},700);
await step('17-mentor',async()=>{await ev("$('mentor').classList.add('open')");},800);
await step('18-home2',async()=>{await ev("navHome()");},700);
// a lesson from the hub, solved, and what happens after
await step('19-academy-lesson1',async()=>{await ev("hubOpen()");await pg.waitForTimeout(300);await ev("hubPage('academy')");await pg.waitForTimeout(400);await ev("(document.querySelector('#projList .acad-dot')||{click(){}}).click()");},1200);
await frames('challenge board open',3000);
await step('20-lesson-run',async()=>{await ev("applyProg(mgRobot,[{t:'move'},{t:'move'},{t:'move'},{t:'move'}]);renderProgram();mgRun()");},4000);
await step('21-after-success',async()=>{},2500);
await step('22-cele-continue',async()=>{await ev("{const c=document.querySelector('#ccCele .cc-cta');if(c)c.click();}");},1500);
// a chapter level, then Back
await step('23-chapter-level',async()=>{await ev("navHome()");await pg.waitForTimeout(300);await ev("hubOpen()");await pg.waitForTimeout(300);await ev("hubPage('puzzles')");await pg.waitForTimeout(300);await ev("packEnter(PUZZLE_PACKS[0],0)");},1200);
await step('24-chapter-back',async()=>{await ev("navBack()");},1000);
await step('25-tower-level',async()=>{await ev("navHome()");await pg.waitForTimeout(300);await ev("t3Enter(TOWER_LEVELS[0])");},1500);
await frames('3D level open, idle',3000);
await step('26-creator',async()=>{await ev("navHome()");await pg.waitForTimeout(300);await ev("mgEnterCreator()");},1200);
await step('27-creator-design',async()=>{await ev("setTab('design')");},800);
await step('28-home3',async()=>{await ev("navHome()");},1000);
await frames('world idle (later)',3000);
// dump
const log=await ev("window.__log"), lt=await ev("window.__lt"), cls=await ev("window.__cls"), shifts=await ev("window.__shifts");
fs.writeFileSync(OUT+'log.json',JSON.stringify({log,lt,cls,errs,shifts},null,1));
console.log('LONGTASKS',lt.length,'total ms',lt.reduce((a,x)=>a+x.d,0),'max',Math.max(0,...lt.map(x=>x.d)));
console.log('CLS',cls.toFixed(3),'ERRORS',errs.length,errs.slice(0,3));
const steps=log.filter(e=>e.k==='step'), at=t=>{let c='(load)';for(const s of steps)if(s.t<=t)c=s.s;return c;};
const by={}; for(const s of shifts){const k=at(s.t);by[k]=(by[k]||0)+s.v;}
for(const [k,v] of Object.entries(by).sort((a,b)=>b[1]-a[1]).slice(0,8))console.log('  shift',v.toFixed(3),k);
const notes=log.filter(e=>e.k==='toast'||e.k==='bigToast'||e.k==='cele');
console.log('NOTIFICATIONS',notes.length);
for(const n of notes)console.log('  ',n.k.padEnd(8),'['+(n.on||'world')+']',n.msg);
await b.close();})();
