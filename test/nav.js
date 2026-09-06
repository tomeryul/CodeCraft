/* Back and Exit — one meaning each, on every screen.

   The bug this pins: leaving a challenge reopened #projects directly, with
   no band filter and no title, so entering through Academy and coming back
   landed you in the whole seven-section scroll, still headed "Academy".

   Run: NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node test/nav.js */
const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
let pass=0, fail=0;
const ck=(n,ok,d)=>{ok?pass++:fail++; console.log((ok?'  ✅ ':'  ❌ ')+n+(ok?'':' — '+JSON.stringify(d)));};

const shownBands = () => [...document.getElementById('projList').children]
  .filter(n=>n.style.display!=='none')
  .filter(n=>(n.tagName==='H4'&&n.classList.contains('qsec'))||n.classList.contains('t3sec'))
  .map(n=>n.classList.contains('t3sec')?'tower':n.textContent.trim());

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

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const pg = await b.newPage({ viewport:{width:390,height:844} });
  const errs=[]; pg.on('pageerror', e=>errs.push(String(e)));
  await toWorld(pg);

  // ------------------------------------------------ the reported bug
  await pg.evaluate(()=>hubPage('academy')); await pg.waitForTimeout(450);
  const before = await pg.evaluate(`(${shownBands})()`);
  await pg.evaluate(()=>academyEnter(0)); await pg.waitForTimeout(800);
  await pg.evaluate(()=>mgExit(true)); await pg.waitForTimeout(700);
  const after = await pg.evaluate(`(${shownBands})()`);
  ck('leaving a challenge returns to the page you came from',
     after.length===1 && after.join()===before.join(), {before,after});

  // every route out of a challenge, not just the one button
  for (const page of ['builds','tower','puzzles']) {
    await pg.evaluate(p=>hubPage(p), page); await pg.waitForTimeout(400);
    const want = await pg.evaluate(`(${shownBands})()`);
    await pg.evaluate(()=>{ $('editor').classList.add('mg','open'); });
    await pg.evaluate(()=>{ $('editor').classList.remove('mg'); mgExit(true); });
    await pg.waitForTimeout(500);
    const got = await pg.evaluate(`(${shownBands})()`);
    ck(`...and from the ${page} page too`, got.join()===want.join(), {want,got});
  }

  // ------------------------------------------------ both buttons, every page
  const sheets=['mentor','quests','projects','guide','funcLib','orders','report','settings'];
  const btns = await pg.evaluate(ids=>ids.map(id=>{
    const s=document.getElementById(id);
    const h=s&&s.querySelector('.m-head');
    const back=h&&h.querySelector('.iconbtn.back'), x=h&&h.querySelector('.iconbtn.x');
    return { id, back:!!back, exit:!!x,
             backFirst:!!(back&&h.firstElementChild===back),
             exitLast:!!(x&&h.lastElementChild===x) };
  }), sheets);
  ck('every destination page has a Back and an Exit',
     btns.every(s=>s.back&&s.exit), btns.filter(s=>!s.back||!s.exit));
  ck('...Back on the left, Exit on the right, the same on each',
     btns.every(s=>s.backFirst&&s.exitLast), btns.filter(s=>!s.backFirst||!s.exitLast));

  // the menu is the top of the tree, so it offers no way further back
  const hub = await pg.evaluate(()=>{
    const h=$('hub').querySelector('.m-head');
    return { back:!!h.querySelector('.iconbtn.back'), exit:!!h.querySelector('.iconbtn.x') };
  });
  ck('the menu has an Exit but no Back', !hub.back && hub.exit, hub);

  // ------------------------------------------------ Back goes one step
  await pg.evaluate(()=>hubPage('tower')); await pg.waitForTimeout(400);
  await pg.click('#projBack'); await pg.waitForTimeout(600);
  ck('Back from a page opens the menu', await pg.evaluate(()=>
     $('hub').classList.contains('open') && !$('projects').classList.contains('open')),
     await pg.evaluate(()=>({hub:$('hub').classList.contains('open')})));

  // ------------------------------------------------ Exit goes all the way
  await pg.evaluate(()=>{ hubClose(); hubPage('academy'); }); await pg.waitForTimeout(400);
  await pg.evaluate(()=>academyEnter(0)); await pg.waitForTimeout(800);
  await pg.evaluate(()=>navHome()); await pg.waitForTimeout(600);
  const home = await pg.evaluate(()=>({
    open:[...document.querySelectorAll('.sheet')].filter(s=>s.classList.contains('open')).map(s=>s.id),
    mg:$('editor').classList.contains('mg'),
    max:$('editor').classList.contains('max'),
    live:typeof mgState!=='undefined'&&!!mgState
  }));
  ck('Exit closes everything and tears the challenge down',
     home.open.length===0 && !home.mg && !home.max && !home.live, home);

  // ------------------------------------------------ no dead affordances
  const grabs = await pg.evaluate(()=>document.querySelectorAll('.grab').length);
  ck('the dead drag handle is gone from every sheet', grabs===0, grabs);

  /* Two ✕ a few pixels apart, doing different things, is what made this
     confusing in the first place. */
  await pg.evaluate(()=>hubPage('academy')); await pg.waitForTimeout(400);
  await pg.evaluate(()=>academyEnter(0)); await pg.waitForTimeout(800);
  const inMg = await pg.evaluate(()=>{
    /* v5 merged the challenge's own bar into the editor's one header, so
       find the pair by role rather than by id — the rule is what matters,
       not which element currently carries it. */
    const ed=$('editor');
    const vis=e=>!!(e&&e.offsetParent&&e.getBoundingClientRect().width>4&&
                    getComputedStyle(e).visibility!=='hidden');
    const all=[...ed.querySelectorAll('button')].filter(vis);
    const back=all.find(e=>/back/i.test(e.getAttribute('aria-label')||''));
    const exit=all.find(e=>/exit/i.test(e.getAttribute('aria-label')||''));
    if(!back||!exit)return {back:!!back,exit:!!exit};
    const art=e=>{const p=e.querySelector('path,rect');
                  return p?(p.getAttribute('d')||'rect'):(e.textContent||'').trim();};
    const r=e=>e.getBoundingClientRect();
    return { back:true, exit:true, backId:back.id, exitId:exit.id,
             backArt:art(back), exitArt:art(exit),
             backX:Math.round(r(back).left), exitX:Math.round(r(exit).left),
             sameRow:Math.abs(r(back).top-r(exit).top)<8,
             tap:[back,exit].every(e=>{const b=r(e);return b.width>=40&&b.height>=40;}),
             mid:innerWidth/2 };
  });
  /* They used to be the same ✕ stacked in the same corner 88px apart.
     Different drawing, opposite ends of one header, both big enough. */
  ck('in a challenge Back and Exit are told apart by shape and by side',
     inMg.back && inMg.exit && inMg.backArt!==inMg.exitArt &&
     inMg.backX<inMg.mid && inMg.exitX>inMg.mid && inMg.sameRow && inMg.tap, inMg);

  /* v5 gave every header the same three slots, but one nowrap line left
     ~240px between two 40px buttons and four subtitles broke mid-word. */
  const cut = await pg.evaluate(()=>[...document.querySelectorAll('.m-head p, .v5-head small')]
    .filter(p=>p.textContent.trim())
    .filter(p=>p.scrollWidth>p.clientWidth+1||p.scrollHeight>p.clientHeight+1)
    .map(p=>{const s=p.closest('.sheet,#shop');return (s?s.id:'?')+': '+p.textContent.trim().slice(0,40);}));
  ck('no header subtitle is cut off', cut.length===0, cut);

  const small = await pg.evaluate(()=>[...document.querySelectorAll(
      '.m-head .iconbtn, .ed-btns button, .mg-top .ibtn')]
    .filter(e=>e.offsetParent)
    .filter(e=>{const r=e.getBoundingClientRect();return r.width<40||r.height<40;})
    .map(e=>e.id||e.className));
  ck('every header control is at least 40px', small.length===0, small);

  await pg.evaluate(()=>navHome()); await pg.waitForTimeout(400);
  await pg.evaluate(()=>{ $('editor').classList.add('open'); }); await pg.waitForTimeout(400);
  ck('the world editor offers no Back, because nothing is behind it',
     await pg.evaluate(()=>{
       const ed=$('editor');
       return ![...ed.querySelectorAll('button')].some(e=>
         /back/i.test(e.getAttribute('aria-label')||'') &&
         e.offsetParent && getComputedStyle(e).visibility!=='hidden');
     }), null);

  /* The paint sheet is the one page reached from another page rather than
     from the menu, so Back has to mean Style there and Exit still has to
     mean the world. */
  await pg.evaluate(()=>navHome()); await pg.waitForTimeout(400);
  if (await pg.evaluate(()=>typeof makerOpen==='function')) {
    /* a level-up card left over from the run so far would sit over the
       header and swallow the click */
    await pg.evaluate(()=>{ const c=document.getElementById('ccCele'); if(c)c.remove(); });
    await pg.evaluate(()=>{ player.myWear=[]; makerOpen('hat',null); });
    await pg.waitForTimeout(500);
    await pg.click('#makerBack'); await pg.waitForTimeout(500);
    ck('Back out of the paint sheet lands on Style, not the menu',
       await pg.evaluate(()=>$('style').classList.contains('open') &&
         !$('maker').classList.contains('open') && !$('hub').classList.contains('open')),
       await pg.evaluate(()=>[...document.querySelectorAll('.sheet.open')].map(s=>s.id)));
    await pg.evaluate(()=>makerOpen('hat',null)); await pg.waitForTimeout(500);
    await pg.click('#makerClose'); await pg.waitForTimeout(500);
    ck('Exit out of the paint sheet lands on the world',
       await pg.evaluate(()=>document.querySelectorAll('.sheet.open').length===0),
       await pg.evaluate(()=>[...document.querySelectorAll('.sheet.open')].map(s=>s.id)));

    /* A component is no longer a sheet on top of the maker — it is the
       maker filtered to one class. Back still has to walk it one step at a
       time: first the filter, then Style. Exit still skips all of it. */
    await pg.evaluate(()=>{ player.myWear=[]; makerOpen('hat',null);
      mkKind='parts'; mkParts=[]; renderMaker(); mkAddPart(); });
    await pg.waitForTimeout(400);
    await pg.evaluate(()=>mkFocusOn(mkParts[0].cls));
    await pg.waitForTimeout(400);
    await pg.click('#makerBack'); await pg.waitForTimeout(400);
    ck('Back out of a component lands on the whole piece',
       await pg.evaluate(()=>$('maker').classList.contains('open') &&
         !$('style').classList.contains('open') && mkFocus===null),
       await pg.evaluate(()=>[...document.querySelectorAll('.sheet.open')].map(s=>s.id)));
    await pg.evaluate(()=>mkFocusOn(mkParts[0].cls));
    await pg.waitForTimeout(400);
    await pg.click('#makerClose'); await pg.waitForTimeout(400);
    ck('Exit out of a component lands on the world',
       await pg.evaluate(()=>document.querySelectorAll('.sheet.open').length===0),
       await pg.evaluate(()=>[...document.querySelectorAll('.sheet.open')].map(s=>s.id)));
  } else {
    ck('Back out of the paint sheet lands on Style, not the menu', false, 'makerOpen missing');
    ck('Exit out of the paint sheet lands on the world', false, 'makerOpen missing');
    ck('Back out of a component lands on the whole piece', false, 'makerOpen missing');
    ck('Exit out of a component lands on the world', false, 'makerOpen missing');
  }

  console.log('  pageerrors:', errs.length?errs.slice(0,3):'none');
  ck('no uncaught exceptions', errs.length===0, errs.slice(0,3));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
