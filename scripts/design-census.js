/* Design census — every surface of the app, photographed and measured
   (docs/design-audit.md). For each page: screenshots at full height,
   scrolled all the way through, and every visible button, text and box
   with its size, weight, colour and radius. analyze-design.js turns the
   JSON into counts: how many font sizes, button kinds, section-title
   styles… — "one design language" as a number.

   Run: NODE_PATH=/opt/node22/lib/node_modules node scripts/design-census.js [outDir]
        LANG_HE=1 … Hebrew;  HALF=1 … sheets at half height
   Then: node scripts/analyze-design.js outDir/census-en.json [fs|fw|upper|rad|btn|head|col|box] */
const { chromium } = require('playwright');
const fs=require('fs'); const path=require('path');
const OUT=(process.argv[2]||'/tmp/design-census').replace(/\/?$/,'/'); fs.mkdirSync(OUT,{recursive:true});
const LANG=(process.env.LANG_HE?'he':'en')+(process.env.HALF?'h':'');
const SURF=[
 ['world','navHome()',{world:1}],
 ['hub','hubOpen()'],
 ['p-academy',"hubOpen();hubPage('academy')"],
 ['p-puzzles',"hubOpen();hubPage('puzzles')"],
 ['p-builds',"hubOpen();hubPage('builds')"],
 ['p-cyber',"hubOpen();hubPage('cyber')"],
 ['p-tower',"hubOpen();hubPage('tower')"],
 ['p-mine',"hubOpen();hubPage('mine')"],
 ['p-community',"hubOpen();hubPage('community')"],
 ['p-account',"hubOpen();hubPage('account')"],
 ['shop','openShop()',{root:'#shopWrap'}],
 ['style','styleOpen()'],
 ['maker',"makerOpen('hat')"],
 ['settings','openSettings()'],
 ['orders','ordersOpen()'],
 ['quests',"renderQuests();$('quests').classList.add('open')"],
 ['funclib','openFuncLib()'],
 ['guide','openGuide()'],
 ['mentor',"$('mentor').classList.add('open')"],
 ['report',"window.sbReady=()=>true;sbUser={uid:'u1',email:'kid@example.com'};reportChallenge({id:'x',name:'Sample level',author:'a',author_name:'someone'})"],
 ['delacc',"openDeleteAccount()"],
 ['ticker',"navHome();$('ticker').classList.add('open');renderMarket()",{world:1}],
 ['editor-blocks',"$('editor').classList.add('open');setTab('blocks');renderProgram()"],
 ['editor-python',"$('editor').classList.add('open');setTab('python')"],
 ['lvl-flat-board',"packEnter(PUZZLE_PACKS[1],0);setTab('board')",{lvl:1}],
 ['lvl-flat-blocks',"setTab('blocks')",{keep:1}],
 ['lvl-flat-python',"setTab('python')",{keep:1}],
 ['lvl-lesson',"academyEnter(2)",{lvl:1}],
 ['lvl-tower',"t3Enter(TOWER_LEVELS[1])",{lvl:1}],
 ['lvl-cyber',"CC_CYBER.enter(CC_CYBER.levels[0])",{lvl:1}],
 ['creator-board',"window.confirm=()=>true;mgEnterCreator();setTab('board')",{lvl:1}],
 ['creator-design',"setTab('design')",{keep:1}],
 ['creator-3d',"setTab('board');$('t3Btn').click()",{keep:1}],
 ['creator-cyber',"$('cyBtn').click();setTab('board')",{keep:1}],
 ['wincard',"CC_EXTRAS.celebrate('✅','LESSON 1 OF 10','First Steps','<span>Next</span> <b>Turn & Go</b>','Next lesson ▶',{alt:'Not now'})",{root:'#ccCele',noclose:1}],
];
const census=(rootSel)=>{
  const root=rootSel?document.querySelector(rootSel):document.body;
  const vis=e=>{const r=e.getBoundingClientRect();if(r.width<2||r.height<2)return false;const cs=getComputedStyle(e);return cs.visibility!=='hidden'&&cs.display!=='none'&&+cs.opacity>0.05;};
  const bgOf=cs=>cs.backgroundImage&&cs.backgroundImage!=='none'?'grad':cs.backgroundColor;
  const txt=e=>(e.innerText||e.getAttribute('aria-label')||'').replace(/\s+/g,' ').trim().slice(0,32);
  const out={buttons:[],texts:[],boxes:[],head:null,inputs:[]};
  const all=[...root.querySelectorAll('*')].filter(e=>!e.closest('svg')||e.tagName==='svg');
  for(const e of all){ if(!vis(e))continue; const cs=getComputedStyle(e); const r=e.getBoundingClientRect();
    const isBtn=e.matches('button,[role=button],.pgo,a.btn,select');
    if(isBtn){out.buttons.push({t:txt(e),id:e.id,c:String(e.className).slice(0,40),h:Math.round(r.height),w:Math.round(r.width),rad:cs.borderTopLeftRadius,fs:cs.fontSize,fw:cs.fontWeight,bg:bgOf(cs),col:cs.color,bd:cs.borderTopWidth+' '+cs.borderTopColor,tt:cs.textTransform,ls:cs.letterSpacing,ff:cs.fontFamily.split(',')[0]});continue;}
    if(e.matches('input,textarea')){out.inputs.push({id:e.id,h:Math.round(r.height),rad:cs.borderTopLeftRadius,fs:cs.fontSize,bg:bgOf(cs),bd:cs.borderTopWidth+' '+cs.borderTopColor});continue;}
    const own=[...e.childNodes].filter(n=>n.nodeType===3&&n.nodeValue.trim()).map(n=>n.nodeValue.trim()).join(' ');
    if(own&&!e.closest('button,[role=button]'))out.texts.push({t:own.slice(0,40),tag:e.tagName.toLowerCase(),c:String(e.className).slice(0,30),fs:cs.fontSize,fw:cs.fontWeight,col:cs.color,tt:cs.textTransform,ls:cs.letterSpacing,lh:cs.lineHeight,ff:cs.fontFamily.split(',')[0]});
    const hasBg=(cs.backgroundColor!=='rgba(0, 0, 0, 0)'&&cs.backgroundColor!=='transparent')||cs.backgroundImage!=='none';
    const hasBd=parseFloat(cs.borderTopWidth)>0&&!/rgba\(\d+, \d+, \d+, 0\)/.test(cs.borderTopColor);
    if((hasBg||hasBd)&&r.height>=30&&r.width>=60&&!e.matches('canvas,svg,img')&&!e.classList.contains('sheet'))
      out.boxes.push({c:(e.id?'#'+e.id+' ':'')+String(e.className).slice(0,40),h:Math.round(r.height),w:Math.round(r.width),rad:cs.borderTopLeftRadius,bg:bgOf(cs),bd:hasBd?cs.borderTopWidth+' '+cs.borderTopColor:'',pad:cs.paddingTop+' '+cs.paddingLeft,sh:cs.boxShadow!=='none'?'sh':''});
  }
  const hd=root.querySelector(':scope > .m-head, :scope > .ed-head, :scope > .v5-head, .m-head');
  if(hd&&vis(hd)){const h1=hd.querySelector('h2,h3,b,.m-title,strong');const sub=hd.querySelector('small,.m-sub,p');
    out.head={h:Math.round(hd.getBoundingClientRect().height),title:h1&&{t:txt(h1),fs:getComputedStyle(h1).fontSize,fw:getComputedStyle(h1).fontWeight,ff:getComputedStyle(h1).fontFamily.split(',')[0]},sub:sub&&{t:txt(sub),fs:getComputedStyle(sub).fontSize},btns:[...hd.querySelectorAll('button')].filter(vis).map(b=>txt(b)||b.id)};}
  return out;
};
(async()=>{
const b=await chromium.launch(fs.existsSync(process.env.CHROME_PATH||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome')?{executablePath:process.env.CHROME_PATH||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'}:{});
const pg=await b.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true});
const errs=[];pg.on('pageerror',e=>errs.push(String(e)));
await pg.goto('file://'+path.join(__dirname,'..','index.html'));await pg.waitForTimeout(1200);
await pg.screenshot({path:OUT+LANG+'-00-agegate.png'});
const C={};C['agegate']=await pg.evaluate(census,'#agegate');
await pg.selectOption('#ageMonth','6');await pg.selectOption('#ageYear',String(new Date().getFullYear()-30));await pg.click('#ageGo');await pg.waitForTimeout(600);
if(LANG.startsWith('he'))await pg.evaluate(()=>{lang='he';i18nApply();});
await pg.waitForTimeout(300);
await pg.screenshot({path:OUT+LANG+'-01-splash.png'});C['splash']=await pg.evaluate(census,'#splash');
await pg.evaluate(()=>$('playBtn').click());await pg.waitForTimeout(2500);
await pg.evaluate(()=>{player.fresh=false;coins=140;for(let i=0;i<6;i++)player.academy[TUTS[i].id]=1;HELD.length=0;document.querySelectorAll('#ccCele').forEach(e=>e.remove());if(mgState)mgExit(false);navHome();updateHud();});
await pg.waitForTimeout(800);
let n=2;
for(const [name,js,o={}] of SURF){
  const idx=String(n++).padStart(2,'0');
  try{
    if(!o.keep){await pg.evaluate(()=>{HELD.length=0;document.querySelectorAll('#ccCele').forEach(e=>e.remove());const w=$('shopWrap');w.classList.remove('open');$('delacc').classList.remove('open');$('report').classList.remove('open');if(mgState)mgExit(false);navHome();});await pg.waitForTimeout(350);}
    await pg.evaluate(js);await pg.waitForTimeout(o.lvl?1100:700);
    // full height for sheets
    const half=process.env.HALF;
    await pg.evaluate(h=>{const ed=$('editor');const open=[...document.querySelectorAll('.sheet.open')];if(!open.length)return;const want=!h;if(ed.classList.contains('max')!==want){const m=$('edMax');if(m)m.click();}},!!half);
    await pg.waitForTimeout(700);
    const root=o.root||(o.world?null:await pg.evaluate(()=>{const s=[...document.querySelectorAll('.sheet.open')].pop();return s?'#'+s.id:null;}));
    C[name]=await pg.evaluate(census,root);C[name].root=root;
    // screenshots, scrolling the biggest scroller in the surface
    await pg.screenshot({path:`${OUT}${LANG}-${idx}-${name}-0.png`});
    const sc=await pg.evaluate(r=>{const R=r?document.querySelector(r):document.body;const s=[...R.querySelectorAll('*')].filter(e=>{const cs=getComputedStyle(e);return /(auto|scroll)/.test(cs.overflowY)&&e.scrollHeight>e.clientHeight+20&&e.clientHeight>120;}).sort((a,b)=>b.clientHeight-a.clientHeight)[0];if(!s)return 0;s.dataset.__sc='1';return Math.ceil((s.scrollHeight-s.clientHeight)/(s.clientHeight*0.85));},root);
    for(let k=1;k<=Math.min(sc,4);k++){await pg.evaluate(k=>{const s=document.querySelector('[data-__sc]');s.scrollTop=s.clientHeight*0.85*k;},k);await pg.waitForTimeout(250);await pg.screenshot({path:`${OUT}${LANG}-${idx}-${name}-${k}.png`});}
    await pg.evaluate(()=>{const s=document.querySelector('[data-__sc]');if(s){s.scrollTop=0;delete s.dataset.__sc;}});
    console.log('ok',name,root,'scroll pages',sc);
  }catch(e){console.log('FAIL',name,String(e).slice(0,200));}
}
fs.writeFileSync(OUT+'census-'+LANG+'.json',JSON.stringify(C,null,1));
console.log('errors',errs.slice(0,5));
await b.close();})();
