/* The Hub — four tabs, and one destination per page.
   The change this pins: eleven destinations with no map became one grouped
   sheet, then a tab bar with one page per group (tabbar.js); and the Projects
   scroll that held seven kinds of content became one band at a time with its
   own title.

   Run: NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node test/hub.js */
const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
let pass=0, fail=0;
const ck=(n,ok,d)=>{ok?pass++:fail++; console.log((ok?'  ✅ ':'  ❌ ')+n+(ok?'':' — '+JSON.stringify(d)));};

/* Pressing Play drops you into the first academy lesson, so every test here
   has to leave it before the world (and the tab bar) is reachable. */
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
  /* Tower and the Cyber Lab share the .t3sec band shell, so the band each
     one is has to be read off the class, not the shell. */
  .map(n=>n.classList.contains('t3sec')
    ?(n.classList.contains('cy-sec')?'cyber':'tower')
    :n.textContent.trim());

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const errs=[];
  const pg = await b.newPage({ viewport:{width:390,height:844} });
  pg.on('pageerror', e=>errs.push(String(e)));
  await toWorld(pg);

  // ------------------------------------------------ four tabs, one page each
  /* The ☰ and its menu of three groups became a tab bar: World, and one tab
     per group. Every destination the menu held is still one tap from the
     bar — 17 tiles across the three tabs that have pages. */
  const tabs={};
  for (const k of ['play','create','me']) {
    await pg.click('#tab'+k[0].toUpperCase()+k.slice(1)); await pg.waitForTimeout(500);
    tabs[k] = await pg.evaluate(()=>({
      open:$('hub').classList.contains('open'),
      title:$('hub').querySelector('.m-head h3').textContent,
      tiles:[...document.querySelectorAll('#hub .hub-tile')].map(t=>t.querySelector('.ht-name').textContent),
      tagged:[...document.querySelectorAll('#hub .hub-tile')].every(t=>t.querySelector('.ht-tag').textContent.trim()),
      next:!!document.querySelector('.hub-next .j-btn'),
      me:!!document.querySelector('#hub .me-card'),
      lit:[...document.querySelectorAll('#tabbar .tb[aria-selected="true"]')].map(b=>b.dataset.tab)
    }));
  }
  const all=[].concat(tabs.play.tiles,tabs.create.tiles,tabs.me.tiles);
  ck('each tab raises its own page, titled and lit', ['play','create','me'].every(k=>
     tabs[k].open && tabs[k].lit.join()===k) &&
     tabs.play.title==='Play' && tabs.create.title==='Create' && tabs.me.title==='Me', tabs);
  ck('every destination is on a tab', all.length===17 && new Set(all).size===17, all);
  ck('every tile carries a dimension tag', ['play','create','me'].every(k=>tabs[k].tagged), tabs);
  ck('"Next up" answers what to do, on Play', tabs.play.next && !tabs.create.next && !tabs.me.next, tabs);
  ck('Me opens on who you are', tabs.me.me && !tabs.play.me, tabs);
  const old = await pg.evaluate(()=>({
    // the old entry points stay in the DOM for boot.js / shop.js / engagement.js
    questInDom:!!$('questBtn'), questHidden:$('questBtn').hidden,
    shopInDom:!!$('shopBtn'),  shopHidden:$('shopBtn').hidden, hubBtn:!!$('hubBtn')
  }));
  ck('the old buttons are hidden, not deleted; the ☰ is gone', old.questInDom && old.questHidden &&
     old.shopInDom && old.shopHidden && !old.hubBtn, old);

  // ------------------------------------------------ the bar follows the screen
  /* Which tab is lit is read from what is open: a page lights its own tab
     however it was reached, and the bar steps aside for a level. */
  const lit = await pg.evaluate(async()=>{
    const w=ms=>new Promise(r=>setTimeout(r,ms));
    const now=()=>[...document.querySelectorAll('#tabbar .tb[aria-selected="true"]')].map(b=>b.dataset.tab).join();
    const out={};
    navHome(); await w(350); out.world=now();
    openShop(); await w(350); out.shop=now();
    navBack(); await w(350); out.backFromShop=now()+':'+$('hub').dataset.tab;
    hubPage('mine'); await w(350); out.mine=now();
    hubPage('academy'); await w(350); out.academy=now();
    academyEnter(0); await w(700); out.levelHides=document.body.classList.contains('tb-off');
    out.hidden=getComputedStyle($('tabbar')).visibility;
    mgExit(true); await w(600); out.backShows=!document.body.classList.contains('tb-off');
    out.afterLevel=now();
    navHome(); await w(350);
    $('codeBtn').click(); await w(450); out.editorHides=document.body.classList.contains('tb-off');
    navHome(); await w(450); out.home=now()+':'+document.body.classList.contains('tb-off');
    return out;
  });
  ck('the world lights World', lit.world==='world', lit);
  ck('a page lights its tab however it was reached', lit.shop==='me' && lit.mine==='create' &&
     lit.academy==='play', lit);
  ck('Back from a page lands on its tab', lit.backFromShop==='me:me', lit);
  ck('a level and the code editor have the screen to themselves', lit.levelHides &&
     lit.hidden==='hidden' && lit.editorHides, lit);
  ck('leaving a level brings the bar back on its tab', lit.backShows && lit.afterLevel==='play', lit);
  ck('home is the world, with the bar', lit.home==='world:false', lit);

  // ------------------------------------------------ pressing the tab you are on
  const again = await pg.evaluate(async()=>{
    const w=ms=>new Promise(r=>setTimeout(r,ms));
    navHome(); await w(300); hubPage('academy'); await w(400);
    $('tabPlay').click(); await w(450);
    const root=$('hub').classList.contains('open')&&!$('projects').classList.contains('open')&&$('hub').dataset.tab;
    $('tabCreate').click(); await w(450);
    const moved=$('hub').dataset.tab;
    navHome(); await w(350);
    return {root,moved};
  });
  ck('the lit tab, pressed again, goes back to its start', again.root==='play', again);
  ck('another tab, pressed, changes the page in place', again.moved==='create', again);

  /* the rest of this file opens the menu by hand */
  await pg.evaluate(()=>hubOpen('play')); await pg.waitForTimeout(500);

  // ------------------------------------------------ one band per page
  const want = {
    academy  :['Academy'],       puzzles:['Puzzle'],
    builds   :['Build Projects'],tower  :['tower'],
    cyber    :['cyber'],         community:['Community']
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
     fails, and the handoff's deliberate choice is that a page is never left
     blank. A page now BUILDS only its own band (projWant), by key, not by
     text — so a reworded header still leaves exactly that band on screen,
     where it used to fall back to the whole catalogue. */
  await pg.evaluate(()=>{
    const _bk=renderProjects;
    window.renderProjects=function(){ const r=_bk.apply(this,arguments);
      [...$('projList').querySelectorAll('h4.qsec')].forEach(h=>h.textContent='Zzz');
      return r; };
  });
  await pg.evaluate(()=>hubPage('builds')); await pg.waitForTimeout(500);
  const fb = await pg.evaluate(`(${shownBands})()`);
  ck('a reworded header still leaves the page its band, never blank', fb.length===1 && fb[0]==='Zzz', fb);

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
