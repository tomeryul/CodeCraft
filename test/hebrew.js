/* Hebrew.
   The dictionary is matched on whole strings with emoji ignored, because
   ui-icons.js also rewrites text nodes and lifts each emoji into its own
   span — whichever observer registers first wins, and matching the
   emoji-bearing form made translation depend on that race.

   Run: NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node test/hebrew.js */
const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
let pass=0, fail=0;
const ck=(n,ok,d)=>{ok?pass++:fail++; console.log((ok?'  ✅ ':'  ❌ ')+n+(ok?'':' — '+JSON.stringify(d)));};
const HEB=/[֐-׿]/;

async function boot(pg,he){
  await pg.goto('file://'+ROOT+'/index.html'); await pg.waitForTimeout(1100);
  if(he) await pg.evaluate(()=>{ lang="he"; i18nApply(); });
  await pg.evaluate(()=>{ ageSet(true); document.getElementById('agegate').classList.remove('open'); });
  await pg.click('#playBtn').catch(()=>{}); await pg.waitForTimeout(1500);
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
  await boot(pg,true);

  // ------------------------------------------------ the font
  /* styles.css already declared the Fredoka Hebrew subset with
     unicode-range U+0590-05FF, and sw.js already cached it, so Hebrew was
     always going to render in the game's own face. Assert it, because a
     fallback face is the one thing that would look wrong immediately. */
  const font = await pg.evaluate(async ()=>{
    await document.fonts.ready;
    /* The subset is fetched only once Hebrew is on the page, which is what
       font-display:swap with a unicode-range is for — so this is checked
       after switching, not at load. The browser normalises the range to
       U+590-5FF, without the leading zero the stylesheet writes. */
    return { declared:[...document.fonts].some(f=>f.family==='Fredoka'&&
               /\b590\b/.test(f.unicodeRange||'')),
             loaded:[...document.fonts].some(f=>f.family==='Fredoka'&&
               /\b590\b/.test(f.unicodeRange||'')&&f.status==='loaded'),
             canRender:document.fonts.check('700 16px Fredoka','שלום'),
             bodyFace:getComputedStyle(document.body).fontFamily.split(',')[0].replace(/"/g,'') };
  });
  ck("Hebrew renders in Fredoka, the game's own face",
     font.declared && font.loaded && font.canRender && /Fredoka/.test(font.bodyFace), font);

  // ------------------------------------------------ direction
  const dir = await pg.evaluate(()=>({
    html:document.documentElement.dir, lang:document.documentElement.lang,
    python:getComputedStyle($('pyTab')).direction,
    canvas:getComputedStyle($('game')).direction }));
  ck('the page is rtl and marked lang=he', dir.html==='rtl' && dir.lang==='he', dir);
  ck('the Python listing and the canvas stay ltr',
     dir.python==='ltr' && dir.canvas==='ltr', dir);

  // ------------------------------------------------ the chrome is translated
  await pg.evaluate(()=>{ $('editor').classList.add('open'); setTab('blocks'); renderPalette(); });
  await pg.waitForTimeout(500);
  const chrome = await pg.evaluate(()=>{
    const txt=id=>{const e=document.getElementById(id);return e?e.innerText.trim():'(missing)';};
    return { code:txt('codeBtn'), build:txt('buildBtn'),
             tabs:[...document.querySelectorAll('#tabs button')].map(b=>b.innerText.trim()),
             palette:[...document.querySelectorAll('#palette .pblk')].slice(0,6).map(b=>b.innerText.trim()),
             heading:(document.querySelector('#palette .pcat h4')||{}).innerText||'',
             run:getComputedStyle($('runBtn'),'::after').content };
  });
  ck('the world buttons are Hebrew', HEB.test(chrome.code)&&HEB.test(chrome.build), chrome);
  ck('the tab bar is Hebrew', chrome.tabs.every(t=>HEB.test(t)), chrome.tabs);
  ck('the block palette is Hebrew',
     chrome.palette.length>0 && chrome.palette.every(t=>HEB.test(t)), chrome.palette);
  ck('the palette headings are Hebrew', HEB.test(chrome.heading), chrome.heading);
  /* Run is CSS ::after content, which no DOM observer can reach */
  ck('Run, which is CSS content, is Hebrew', HEB.test(chrome.run), chrome.run);

  await pg.evaluate(()=>{ navHome(); hubOpen(); }); await pg.waitForTimeout(700);
  const menu = await pg.evaluate(()=>({
    title:(document.querySelector('#hub .m-head h3')||{}).innerText||'',
    groups:[...document.querySelectorAll('.hub-sec')].map(h=>h.innerText.trim()),
    tiles:[...document.querySelectorAll('.hub-tile .ht-name')].map(e=>e.innerText.trim()),
    next:(document.querySelector('.hub-next .j-tx b')||{}).innerText||'' }));
  ck('the menu is Hebrew', HEB.test(menu.title) &&
     menu.groups.every(g=>HEB.test(g)) && menu.tiles.every(t=>HEB.test(t)), menu);
  ck('"Next up" is Hebrew', HEB.test(menu.next), menu.next);

  // ------------------------------------------------ what must NOT be touched
  /* Whole-string matching is what protects a player's own text. A robot
     called "Level 3" hits the numeric-skeleton path and must survive it. */
  const safe = await pg.evaluate(()=>{
    navHome();
    R().name='Level 3'; updateChips();
    const chips=$('robotChips').innerText;
    setTab('py'); renderPy();
    const py=$('pyCode').innerText;
    return { name:chips.includes('Level 3'),
             pyHasHebrew:HEB_TEST(py), py:py.slice(0,80) };
    function HEB_TEST(s){return /[֐-׿]/.test(s);}
  });
  ck('a robot named "Level 3" is left alone', safe.name, safe);
  ck('the Python listing is never translated', !safe.pyHasHebrew, safe);

  // ------------------------------------------------ the setting persists
  const saved = await pg.evaluate(()=>{
    saveNow();
    const j=JSON.parse(localStorage.getItem(SAVE_KEY));
    return { inSave:j.lang, live:lang };
  });
  ck('the language is saved like sound and music',
     saved.inSave==='he' && saved.live==='he', saved);

  // ------------------------------------------------ English still works
  const pg2 = await b.newPage({ viewport:{width:390,height:844} });
  const errs2=[]; pg2.on('pageerror',e=>errs2.push(String(e)));
  await boot(pg2,false);
  const en = await pg2.evaluate(()=>({
    dir:document.documentElement.dir||'(none)',
    code:$('codeBtn').innerText.trim(),
    anyHebrew:/[֐-׿]/.test(document.body.innerText) }));
  ck('English is untouched and stays ltr',
     en.dir==='(none)' && /Code/.test(en.code) && !en.anyHebrew, en);
  await pg2.close();

  console.log('  pageerrors:', errs.concat(errs2).length?errs.concat(errs2).slice(0,3):'none');
  ck('no uncaught exceptions', errs.length===0 && errs2.length===0, errs.concat(errs2).slice(0,3));
  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
