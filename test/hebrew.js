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
  /* the way the settings row does it: langSet writes the device's own key,
     which is what stops a later save from overriding the choice */
  if(he) await pg.evaluate(()=>{
    if(typeof langSet==="function")langSet("he"); else { lang="he"; i18nApply(); } });
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
  /* Hebrew marks the page and nothing else. dir="rtl" used to be set here,
     which flips every flex and grid row: picking a language moved Run, Back
     and the tabs to the other side of the screen, which is not what asking
     for Hebrew asks for. The text still needs its own direction per
     paragraph, so that is done with unicode-bidi, which reorders inside a
     line without moving the line. */
  const dir = await pg.evaluate(()=>({
    html:document.documentElement.getAttribute('dir')||'(none)',
    cls:document.documentElement.classList.contains('he'),
    lang:document.documentElement.lang,
    page:getComputedStyle(document.documentElement).direction,
    bidi:getComputedStyle($('mgGoal')).unicodeBidi,
    python:getComputedStyle($('pyTab')).direction,
    canvas:getComputedStyle($('game')).direction }));
  ck('the page is marked Hebrew and is NOT flipped to rtl',
     dir.lang==='he' && dir.cls && dir.html==='(none)' && dir.page==='ltr', dir);
  ck('prose still gets its direction per paragraph',
     dir.bidi==='plaintext', dir);
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
    return { onDevice:localStorage.getItem(LANG_KEY), live:lang };
  });
  ck('the language is remembered on the device, not in the world save',
     saved.onDevice==='he' && saved.live==='he', saved);

  // ------------------------------------------------ the coverage itself
  /* The sentences the game builds by concatenation — "Level 3 complete!",
     "Robot 2 sold 4 wood" — never arrive as a fixed string, so a
     whole-string table cannot hold them. They go through patterns instead:
     the numbers and names come back untranslated INSIDE Hebrew wording. */
  const probe = await pg.evaluate(async list => {
    const host=document.createElement('div');
    host.id='__probe'; host.style.position='absolute'; host.style.left='-9999px';
    for(const s of list){ const sp=document.createElement('span'); sp.textContent=s;
      host.appendChild(sp); }
    document.body.appendChild(host);
    /* the swap runs from a MutationObserver, so it lands a microtask later */
    await new Promise(r=>setTimeout(r,250));
    return [...document.querySelectorAll('#__probe > span')].map(s=>s.textContent);
  }, ['🎉 Big House built! +40 🪙',
      '✅ Level 2 complete! Next: Level 3/5',
      '🚫 Too many blocks (14/8) — squeeze more into loops! 🔁',
      '🤖 Rex joined your team!',
      'This sentence is in no dictionary at all.']);
  /* "Big House" is a built-in project, so it is in the dictionary and gets
     translated inside the pattern too. What must survive untouched is a
     name the dictionary has never heard of — checked with "Rex" below. */
  ck('a built sentence is translated around its number',
     HEB.test(probe[0]) && /40/.test(probe[0]), probe[0]);
  ck('both numbers survive a two-number pattern',
     HEB.test(probe[1]) && /2/.test(probe[1]) && /3\/5/.test(probe[1]), probe[1]);
  ck('a pattern keeps the budget it was given',
     HEB.test(probe[2]) && /14\/8/.test(probe[2]), probe[2]);
  ck("a robot's name is carried through untranslated",
     HEB.test(probe[3]) && /Rex/.test(probe[3]), probe[3]);
  ck('a string in no table is left exactly as it was',
     probe[4]==='This sentence is in no dictionary at all.', probe[4]);

  /* ui-icons.js lifts every emoji into its own span, so a sentence with an
     emoji in the MIDDLE reaches the dictionary as several nodes and no one
     of them matches. Whichever observer ran first, the sentence has to come
     out Hebrew. */
  const mid = await pg.evaluate(async () => {
    const host=document.createElement('div'); host.id='__mid';
    host.style.position='absolute'; host.style.left='-9999px';
    const sp=document.createElement('span'); sp.textContent='Collect 5 ⛓️ iron';
    host.appendChild(sp); document.body.appendChild(host);
    await new Promise(r=>setTimeout(r,250));
    return { text:sp.textContent, icons:sp.querySelectorAll('.ui-emoji').length };
  });
  ck('an emoji in mid-sentence does not block the translation',
     HEB.test(mid.text) && !/Collect|iron/.test(mid.text), mid);
  ck('and the emoji is still drawn as an icon afterwards', mid.icons>0, mid);

  /* The probe above appends a whole element, which is the easy case. The
     game's own path is the opposite: an element already on the page has its
     textContent replaced, ui-icons.js lifts the emoji out of it, and what
     reaches the observer is loose text nodes and spans with no element to
     reassemble. That is how every lesson goal is written. */
  const inPlace = await pg.evaluate(async () => {
    const host=document.createElement('div'); host.id='__inplace';
    host.style.position='absolute'; host.style.left='-9999px';
    document.body.appendChild(host);
    await new Promise(r=>setTimeout(r,60));
    host.textContent='Walk up to the 🌳 tree and use 🪓 Chop to clear it'+
      ' — exactly how your robots gather wood out in the world.';
    await new Promise(r=>setTimeout(r,300));
    return host.textContent;
  });
  ck('a sentence written into an element already on the page is translated',
     HEB.test(inPlace) && !/Walk up|Chop to clear/.test(inPlace), inPlace);

  /* A lesson row is "<b>Move</b> — One step forward…", so the sentence
     arrives with a leading em-dash and a <b> beside it. The dash is edge
     decoration; the <b> is real markup and has to survive. */
  const dash = await pg.evaluate(async () => {
    const host=document.createElement('div'); host.id='__dash';
    host.style.position='absolute'; host.style.left='-9999px';
    document.body.appendChild(host);
    await new Promise(r=>setTimeout(r,60));
    host.innerHTML='<span><b>Move</b> — One step forward, in whatever'+
      ' direction the robot is already facing.</span>';
    await new Promise(r=>setTimeout(r,300));
    return { text:host.textContent, bold:host.querySelector('b')?host.querySelector('b').textContent:null };
  });
  ck('a sentence after an em-dash still matches the dictionary',
     HEB.test(dash.text) && /—/.test(dash.text) && !/One step forward/.test(dash.text), dash);
  ck('and the bold block name beside it is not flattened away',
     dash.bold!==null && dash.bold.length>0, dash);

  /* The goal line and the level's question are two nodes, not one joined
     string — a joined string exists nowhere in the source and so could
     never match. */
  const goal = await pg.evaluate(async () => {
    if(typeof mgState!=='undefined'&&mgState)mgExit(false);
    academyEnter(7);
    await new Promise(r=>setTimeout(r,700));
    const g=document.getElementById('mgGoal');
    return { nodes:g.childNodes.length, text:g.textContent,
             q:g.querySelector('.mg-q')?g.querySelector('.mg-q').textContent:null };
  });
  ck('a lesson goal and its question are translated separately',
     goal.nodes>1 && HEB.test(goal.text) && goal.q!==null && HEB.test(goal.q), goal);
  ck('nothing English is left in the goal line',
     !/[A-Za-z]{3}/.test(goal.text), goal.text);

  /* An <input> holds the player's own text, so its contents are never
     touched — but its placeholder is ours. */
  const ph = await pg.evaluate(()=>{
    const e=document.querySelector('#mentor input[placeholder],#mentorInput');
    return e?e.getAttribute('placeholder'):null; });
  ck("a placeholder inside an input is translated", ph!==null && HEB.test(ph), ph);

  // ------------------------------------------------ nothing may turn it off
  /* The language used to be a field inside the world save, and applySave()
     set it from whatever save it was handed. Signing in hands that function
     the cloud save, so an account whose save was written before Hebrew
     existed — or on a device set to English — turned the choice off in the
     middle of a session. The text already on screen stayed Hebrew, because
     it had been replaced in place, and everything drawn afterwards came out
     English. It is a device preference now, stored beside the save. */
  const foreign = await pg.evaluate(async () => {
    const s = buildSave();
    delete s.lang;             // a save from before the feature existed
    applySave(s);
    await new Promise(r => setTimeout(r, 300));
    document.getElementById('editor').classList.add('open');
    setTab('blocks'); renderPalette();
    await new Promise(r => setTimeout(r, 400));
    const p = document.getElementById('palette');
    return { lang: lang, he: document.documentElement.classList.contains('he'),
             palette: p ? p.innerText.replace(/\s+/g, ' ').slice(0, 80) : '' };
  });
  ck('a save carrying no language cannot turn Hebrew off',
     foreign.lang === 'he' && foreign.he, foreign);
  ck('and what is drawn after such a save is still Hebrew',
     HEB.test(foreign.palette) && !/BASICS|Walk To/.test(foreign.palette), foreign.palette);

  /* An English save must not flip a device that chose Hebrew either. */
  const enSave = await pg.evaluate(async () => {
    const s = buildSave(); s.lang = 'en';
    applySave(s);
    await new Promise(r => setTimeout(r, 250));
    return lang;
  });
  ck('nor may a save that says English', enSave === 'he', enSave);

  // ------------------------------------------------ nothing moves
  /* The promise Hebrew makes is words, not a new layout. Measure the same
     controls in both languages: a Hebrew word is not the same length as an
     English one so a button may be wider, but no control may end up on the
     other side of the screen. */
  const MEASURE = sels => {
    const out = {};
    for (const s of sels) {
      const e = document.querySelector(s);
      out[s] = e ? Math.round(e.getBoundingClientRect().left) : null;
    }
    return out;
  };
  const SELS = ['#edClose','#edMax','#boardTab','#blocksTab','#pyTab',
                '#palette','#programWrap','#actionBar','#editor #tabs'];
  /* Both measured on a fresh page taken through identical steps: the page
     this suite has been driving has a challenge open, and comparing it with
     a clean one measures the challenge, not the language. */
  const measureIn = async he => {
    const p = await b.newPage({ viewport:{width:390,height:844} });
    await boot(p,he);
    await p.evaluate(()=>{ $('editor').classList.add('open'); setTab('blocks'); renderPalette(); });
    await p.waitForTimeout(500);
    const m = await p.evaluate(MEASURE, SELS);
    await p.close();
    return m;
  };
  const posHe = await measureIn(true);
  const posEn = await measureIn(false);

  const moved = SELS.filter(k => posHe[k]!==null && posEn[k]!==null &&
                                 Math.abs(posHe[k]-posEn[k]) > 4);
  ck('no control changes side when the language does', moved.length===0,
     moved.map(k=>k+' en='+posEn[k]+' he='+posHe[k]));

  /* A heading that sits on the left in English sits on the left in Hebrew:
     plaintext would otherwise resolve text-align:start to the right. */
  const align = await pg.evaluate(()=>{
    const e=document.querySelector('.hub-sec,#palette h4,.pal-h');
    return e?getComputedStyle(e).textAlign:'(none)'; });
  ck('headings keep the alignment they have in English',
     align==='left'||align==='center', align);

  // ------------------------------------------------ opening a screen in Hebrew
  /* An entry that translated to itself — the Language row's
     "English · עברית" — made walk() assign a text node the value it already
     held. That still queues a characterData record, which calls the
     observer, which assigns it again: a microtask loop that never yields.
     Opening Settings in Hebrew froze the game outright. */
  const selfMapped = await pg.evaluate(() => window.CC_I18N.selfMapped());
  ck('no entry translates to itself', selfMapped.length === 0, selfMapped);

  const settingsOpen = await pg.evaluate(() => {
    const t0 = performance.now();
    openSettings();
    return { ms: Math.round(performance.now() - t0),
             rows: document.getElementById('settingsList').children.length };
  });
  await pg.waitForTimeout(400);
  ck('Settings opens in Hebrew without hanging',
     settingsOpen.rows > 3 && settingsOpen.ms < 2000, settingsOpen);
  const settingsHe = await pg.evaluate(() => {
    const el = document.getElementById('settingsList');
    return { text: el.innerText.replace(/\s+/g, ' ').slice(0, 120),
             heb: /[֐-׿]/.test(el.innerText) };
  });
  ck('and its rows are Hebrew', settingsHe.heb, settingsHe.text);
  await pg.evaluate(() => document.getElementById('settings').classList.remove('open'));
  await pg.waitForTimeout(300);

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
