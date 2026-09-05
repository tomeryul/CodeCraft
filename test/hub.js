/* The Hub — one menu, and one destination per page.
   The change this pins: eleven destinations with no map became one grouped
   sheet, and the Projects scroll that held seven kinds of content became one
   band at a time with its own title.

   Run: NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node test/hub.js */
const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
let pass=0, fail=0;
const ck=(n,ok,d)=>{ok?pass++:fail++; console.log((ok?'  ✅ ':'  ❌ ')+n+(ok?'':' — '+JSON.stringify(d)));};

/* Pressing Play drops you into the first academy lesson, so every test here
   has to leave it before the world (and the menu button) is reachable. */
async function toWorld(pg){
  await pg.goto('file://'+ROOT+'/index.html'); await pg.waitForTimeout(1000);
  await pg.evaluate(()=>{ ageSet(true); document.getElementById('agegate').classList.remove('open'); });
  await pg.click('#playBtn').catch(()=>{}); await pg.waitForTimeout(1400);
  await pg.evaluate(()=>{ const c=document.querySelector('#ccCele .cc-cta'); if(c)c.click(); });
  await pg.waitForTimeout(1500);
  await pg.evaluate(()=>{ if(mgState)mgExit(false); tutSet(0);
    document.querySelectorAll('.sheet.open').forEach(x=>x.classList.remove('open')); });
  await pg.waitForTimeout(500);
}
/* Only the bands actually on screen. Every .pcard stays in the document —
   hub.js hides bands rather than removing them, because loadCommunity()
   resolves later into #ccList and tower-editor looks up .t3sec afterwards. */
const shownBands = () => [...document.getElementById('projList').children]
  .filter(n=>n.style.display!=='none')
  .filter(n=>(n.tagName==='H4'&&n.classList.contains('qsec'))||n.classList.contains('t3sec'))
  .map(n=>n.classList.contains('t3sec')?'tower':n.textContent.trim());

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const errs=[];
  const pg = await b.newPage({ viewport:{width:390,height:844} });
  pg.on('pageerror', e=>errs.push(String(e)));
  await toWorld(pg);

  // ------------------------------------------------ one door, three groups
  await pg.click('#hubBtn'); await pg.waitForTimeout(600);
  const menu = await pg.evaluate(()=>({
    open:$('hub').classList.contains('open'),
    groups:[...document.querySelectorAll('.hub-sec')].map(h=>h.textContent),
    tiles:[...document.querySelectorAll('.hub-tile')].map(t=>t.querySelector('.ht-name').textContent),
    tagged:[...document.querySelectorAll('.hub-tile')].every(t=>t.querySelector('.ht-tag').textContent.trim()),
    next:!!document.querySelector('.hub-next .j-btn'),
    // the old entry points stay in the DOM for boot.js / shop.js / engagement.js
    questInDom:!!$('questBtn'), questHidden:$('questBtn').hidden,
    shopInDom:!!$('shopBtn'),  shopHidden:$('shopBtn').hidden
  }));
  ck('the menu opens with all three groups', menu.open &&
     menu.groups.join()==='Play,Create,Your world', menu);
  ck('every destination is on it', menu.tiles.length===16, menu.tiles);
  ck('every tile carries a dimension tag', menu.tagged, menu.tiles);
  ck('"Next up" answers what to do, above the menu', menu.next, menu);
  ck('the old buttons are hidden, not deleted', menu.questInDom && menu.questHidden &&
     menu.shopInDom && menu.shopHidden, menu);

  // ------------------------------------------------ one band per page
  const want = {
    academy  :['Academy'],       puzzles:['Puzzle'],
    builds   :['Build Projects'],tower  :['tower'],
    community:['Community']
  };
  for (const [page,frag] of Object.entries(want)) {
    await pg.evaluate(p=>hubPage(p), page); await pg.waitForTimeout(400);
    const r = await pg.evaluate(`(${shownBands})()`);
    ck(`page "${page}" shows only its own band`,
       r.length===1 && frag.some(f=>r[0].includes(f)), r);
  }
  // 3D is a page of its own, named as such — that was the whole complaint
  await pg.evaluate(()=>hubPage('tower')); await pg.waitForTimeout(400);
  ck('Tower Mode is its own page, labelled 3D',
     (await pg.evaluate(()=>$('projTitle').textContent)).includes('3D'),
     await pg.evaluate(()=>$('projTitle').textContent));

  // ------------------------------------------------ the account page
  /* PAGES.account owns no band and draws its own rows. The "reworded header"
     fallback treated that as a failed match and rendered the whole catalogue
     under the sign-in box — the exact scroll this change removes. */
  await pg.evaluate(()=>hubPage('account')); await pg.waitForTimeout(500);
  const acct = await pg.evaluate(`(()=>({
    bands:(${shownBands})(),
    auth:document.getElementById('authBox').style.display!=='none',
    rows:[...document.getElementById('projList').querySelectorAll('.pcard')]
      .filter(c=>c.offsetParent).map(c=>c.querySelector('.pname').textContent)
  }))()`);
  ck('the account page shows only the save rows', acct.bands.length===1 &&
     /Your save/.test(acct.bands[0]), acct.bands);
  ck('sign-in, Export and Import are all on it', acct.auth &&
     acct.rows.some(r=>/Export/.test(r)) && acct.rows.some(r=>/Import/.test(r)), acct.rows);

  // ------------------------------------------------ back to the menu
  await pg.click('#projBack'); await pg.waitForTimeout(600);
  const back = await pg.evaluate(()=>({ hub:$('hub').classList.contains('open'),
                                        proj:$('projects').classList.contains('open') }));
  ck('the back button returns to the menu', back.hub && !back.proj, back);

  // ------------------------------------------------ the reworded-header net
  /* bandKey matches on header text. If a header is ever reworded the match
     fails, and the handoff's deliberate choice is to show everything: a page
     with extra sections beats a blank one. Fixing the account page must not
     have cost that. */
  await pg.evaluate(()=>{
    const _bk=renderProjects;
    window.renderProjects=function(){ const r=_bk.apply(this,arguments);
      [...$('projList').querySelectorAll('h4.qsec')].forEach(h=>h.textContent='Zzz');
      return r; };
  });
  await pg.evaluate(()=>hubPage('builds')); await pg.waitForTimeout(500);
  const fb = await pg.evaluate(`(${shownBands})()`);
  ck('a reworded header still falls back to showing everything', fb.length>1, fb);

  // ------------------------------------------------ narrow phones
  await pg.setViewportSize({width:340,height:740}); await pg.waitForTimeout(300);
  await pg.evaluate(()=>{ $('projects').classList.remove('open'); hubOpen(); });
  await pg.waitForTimeout(500);
  const narrow = await pg.evaluate(()=>{
    const g=document.querySelector('.hub-grid');
    const t=document.querySelector('.hub-tile').getBoundingClientRect();
    return { cols:getComputedStyle(g).gridTemplateColumns.split(' ').length,
             tileFits:t.right<=innerWidth+1, tapOk:t.height>=40 };
  });
  ck('tiles drop to one column on a narrow phone',
     narrow.cols===1 && narrow.tileFits && narrow.tapOk, narrow);

  console.log('  pageerrors:', errs.length?errs.slice(0,3):'none');
  ck('no uncaught exceptions', errs.length===0, errs.slice(0,3));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
