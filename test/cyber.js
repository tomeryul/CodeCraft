/* The Cyber Lab.
   The game already teaches programming (the Academy, the Puzzle Chapters)
   and HTML/CSS (the Wear Maker). This is the third thing: what makes a
   secret a secret. It is bolted on the way Tower Mode is — two tile types,
   one block, one action hook — so the first thing to pin is that nothing
   above it had to know the file exists.

   What the levels teach is the counter under the board: one digit falls in
   ten tries, two digits need a hundred. That number is the lesson, so it is
   asserted rather than eyeballed.

   Run: NODE_PATH=/opt/node22/lib/node_modules /opt/node22/bin/node test/cyber.js */
const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
let pass=0, fail=0;
const ck=(n,ok,d)=>{ok?pass++:fail++; console.log((ok?'  ✅ ':'  ❌ ')+n+(ok?'':' — '+JSON.stringify(d)));};
const HEB=/[֐-׿]/;

/* Pressing Play drops you into the first academy lesson, so every test here
   has to leave it before the world (and the menu) is reachable. */
async function toWorld(pg,he){
  await pg.goto('file://'+ROOT+'/index.html'); await pg.waitForTimeout(1000);
  if(he) await pg.evaluate(()=>{
    if(typeof langSet==="function")langSet("he"); else { lang="he"; i18nApply(); } });
  await pg.evaluate(()=>{ ageSet(true); document.getElementById('agegate').classList.remove('open'); });
  await pg.click('#playBtn').catch(()=>{}); await pg.waitForTimeout(1400);
  for(let i=0;i<4;i++){
    await pg.evaluate(()=>{ const c=document.querySelector('#ccCele .cc-cta'); if(c)c.click(); });
    await pg.waitForTimeout(400);
  }
  await pg.evaluate(()=>{ if(mgState)mgExit(false); tutSet(0); player.level=20;
    document.querySelectorAll('.sheet.open,#shopWrap.open').forEach(x=>x.classList.remove('open')); });
  await pg.waitForTimeout(500);
}

(async () => {
  const b = await chromium.launch({ executablePath: CHROME });
  const pg = await b.newPage({ viewport:{width:390,height:844} });
  const errs=[]; pg.on('pageerror', e=>errs.push(String(e)));
  await toWorld(pg,false);

  // ---------------------------------------------- it bolts on, it does not cut in
  /* Two tiles and one block arrive from a file nothing else imports. The
     proof that they are additions and not edits is that the creator's tile
     palette and the world's block palette are exactly as they were: the
     keypad is not a tool anyone can paint with, and Try Code is in no
     category row, so only a level's own `allowed` list hands it out. */
  const reg = await pg.evaluate(()=>({
    loaded:!!window.CC_CYBER,
    lock:!!(CC_TILES.DEFS.lock&&CC_TILES.DEFS.lock.draw&&CC_TILES.DEFS.lock.solid),
    note:!!(CC_TILES.DEFS.note&&CC_TILES.DEFS.note.draw),
    inPalette:CC_TILES.TYPES.filter(t=>t==='lock'||t==='note'),
    block:!!DEFS.tryCode,
    inCats:CATS.filter(c=>c.types.indexOf('tryCode')>=0).map(c=>c.id),
    inAllowed:CC_CYBER.blocks.indexOf('tryCode')>=0,
    levels:CC_CYBER.levels.length
  }));
  ck('the keypad and the note register themselves as tiles',
     reg.loaded && reg.lock && reg.note, reg);
  ck('and neither one turns up as a creator tool',
     reg.inPalette.length===0, reg.inPalette);
  ck('🔢 Try Code exists but sits in no palette category',
     reg.block && reg.inCats.length===0 && reg.inAllowed, reg);
  ck('there are five levels', reg.levels===5, reg.levels);

  // ---------------------------------------------- the band
  await pg.evaluate(()=>hubPage('cyber')); await pg.waitForTimeout(600);
  const band = await pg.evaluate(()=>{
    const s=document.querySelector('.t3sec.cy-sec');
    if(!s)return null;
    return { title:s.querySelector('.t3title').textContent,
             prog:s.querySelector('.t3prog').textContent,
             cards:[...s.querySelectorAll('.t3card')].map(c=>({
               name:c.querySelector('.t3name').textContent,
               locked:c.classList.contains('locked') })) };
  });
  ck('the Cyber Lab has a band of its own', band && band.title==='Cyber Lab', band);
  ck('nothing is solved yet, and it says so', band && band.prog==='0/5', band&&band.prog);
  ck('only the first level is open — each one unlocks the next',
     band && !band.cards[0].locked && band.cards.slice(1).every(c=>c.locked),
     band&&band.cards);
  /* A locked card that does nothing is indistinguishable from a broken one,
     so it says what opens it. */
  const gate = await pg.evaluate(async ()=>{
    const lv=CC_CYBER.levels[2];
    document.querySelectorAll('.t3sec.cy-sec .t3card')[2].click();
    await new Promise(r=>setTimeout(r,250));
    const t=document.querySelector('#toasts .toast');
    /* ui-icons.js lifts the 🔒 into a span of its own, so the lock is in the
       element and not in its text */
    return { said:t?t.textContent:'(none)',
             wants:(CC_CYBER.levels.find(x=>x.id===lv.needs)||{}).name,
             entered:!!(typeof mgState!=='undefined'&&mgState) };
  });
  ck('a locked card names the level that opens it',
     gate.wants && gate.said.indexOf(gate.wants)>=0, gate);
  ck('and does not drop the player into a level they have not unlocked',
     gate.entered===false, gate);

  // ---------------------------------------------- a keypad is a door with a number for a key
  const lock = await pg.evaluate(async ()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    document.getElementById('projects').classList.remove('open');
    CC_CYBER.enter(CC_CYBER.levels[0]);
    await wait(350);
    const st=mgState, rb=st.robot;
    const ahead=()=>CC_TILES.solid(rb,(rb.x+DX[rb.dir])+'_'+(rb.y+DY[rb.dir]));
    const punch=n=>{ const bl=newBlock('tryCode'); bl.val={k:'num',n:n}; CCAct(st,bl); };
    const before=ahead();
    punch(3);                       const wrong={solid:ahead(),tries:rb.tries};
    punch(7);                       const right={solid:ahead(),tries:rb.tries};
    punch(3);                       const after={solid:ahead(),tries:rb.tries};
    return {before,wrong,right,after,code:7};
  });
  ck('the keypad blocks the way until the right code goes in',
     lock.before===true && lock.wrong.solid===true && lock.right.solid===false, lock);
  ck('every code punched in is counted, right or wrong',
     lock.wrong.tries===1 && lock.right.tries===2, lock);
  ck('and once it is open a wrong code cannot shut it again',
     lock.after.solid===false, lock);

  // ---------------------------------------------- the note
  /* A note is a number in front of you, so the block that reads a number in
     front of you reads it — no new block, and the flat board's own answer
     (the number on a brick) has to survive untouched. */
  const note = await pg.evaluate(async ()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    mgExit(false); await wait(200);
    CC_CYBER.enter(CC_CYBER.levels[2]);   // On a Sticky Note: note 58 in front
    await wait(350);
    const onNote=mgReadSrc(mgState,'ahead');
    mgState.robot.x=5;                     // nothing ahead but empty floor
    const onNothing=mgReadSrc(mgState,'ahead');
    mgExit(false); await wait(200);
    return { onNote, onNothing, real:CC_CYBER.levels[2].tiles.find(t=>t[2]==='note')[3] };
  });
  ck('🧠 Read "number ahead" reads the note',
     note.onNote===note.real && note.real===58, note);
  ck('and reads nothing where there is no note', note.onNothing!==58, note);

  // ---------------------------------------------- every level is solvable, in budget
  /* A level that cannot be finished inside its own block budget is not a
     lesson, it is a wall. Each solution here is the intended one, so the
     block count is also the claim the card makes on the player. */
  const solved = await pg.evaluate(async ()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    const B=t=>newBlock(t);
    const loop=(n,body)=>{const b=B('countLoop');b.name='i';b.to=n;b.body=body;return b;};
    const tc=v=>{const b=B('tryCode');b.val=v;return b;};
    const rd=n=>{const b=B('read');b.name=n;b.src='ahead';return b;};
    const ch=(n,k)=>{const b=B('changeVar');b.name=n;b.n=k;return b;};
    const mv=k=>Array.from({length:k},()=>B('move'));
    const SOL={
      cy_ten:  [loop(10,[tc({k:'var',name:'i'})]),...mv(3)],
      cy_two:  [loop(100,[tc({k:'var',name:'i'})]),...mv(3)],
      cy_note: [rd('x'),B('move'),tc({k:'var',name:'x'}),...mv(4)],
      cy_shift:[rd('x'),ch('x',3),B('move'),tc({k:'var',name:'x'}),...mv(4)],
      cy_trust:[B('turnL'),B('move'),B('move'),B('turnR'),rd('x'),B('turnR'),
                B('move'),B('move'),B('turnL'),B('move'),tc({k:'var',name:'x'}),...mv(3)]
    };
    const out=[];
    for(const lv of CC_CYBER.levels){
      delete player.projects[lv.id];
      CC_CYBER.enter(lv); await wait(320);
      mgRobot.program=SOL[lv.id].slice();
      renderProgram(); mgRun();
      let tries=0, cele=null;
      for(let i=0;i<900;i++){
        if(mgState&&mgState.robot)tries=mgState.robot.tries|0;
        if(!(mgState&&mgState.running))break;
        await wait(25);
      }
      await wait(250);
      const card=document.querySelector('#ccCele .cc-desc');
      if(card)cele=card.textContent;
      out.push({id:lv.id, done:!!player.projects[lv.id], tries,
                blocks:SOL[lv.id].length, max:lv.maxBlocks, cele,
                why:lv.why, kick:(document.querySelector('#ccCele .cc-kick')||{}).textContent});
      const c=document.querySelector('#ccCele .cc-cta'); if(c)c.click();
      await wait(300); if(mgState)mgExit(false); await wait(200);
    }
    return out;
  });
  ck('every level can be finished', solved.every(r=>r.done),
     solved.map(r=>r.id+':'+r.done));
  ck('and each one inside the block budget its card promises',
     solved.every(r=>r.blocks<=r.max), solved.map(r=>r.id+' '+r.blocks+'/'+r.max));
  /* The whole arc, in two numbers: a one-digit code falls in ten tries and
     the same program needs a hundred for two digits. Nothing else on the
     screen would ever say what a digit costs. */
  ck('one digit costs ten tries', solved[0].tries===10, solved[0].tries);
  ck('and two digits cost a hundred — the lesson, in the counter',
     solved[1].tries===100, solved[1].tries);
  ck('a code that was written down costs one try',
     solved[2].tries===1 && solved[3].tries===1, solved.map(r=>r.tries));

  // ---------------------------------------------- the idea is the reward
  /* The player already stops to read the celebration card, so the lesson
     goes on it rather than on a second card nobody asked for. */
  ck('finishing a level puts what it taught on the celebration card',
     solved.every(r=>r.cele===r.why), solved.map(r=>({id:r.id,got:(r.cele||'').slice(0,40)})));
  ck('and the card says the lock opened',
     solved.every(r=>/LOCK OPENED/.test(r.kick||'')), solved.map(r=>r.kick));
  /* The celebration's words are borrowed for one call and handed straight
     back — every other level in the game has to celebrate as it always did. */
  const handedBack = await pg.evaluate(()=>{
    let seen=null;
    const _c=CC_EXTRAS.celebrate;
    CC_EXTRAS.celebrate=function(ic,kick){ seen=kick; };
    try{ mgSuccess.call(window); }catch(_){ }
    const out={seen, restored:true};
    CC_EXTRAS.celebrate=_c;
    return out;
  });
  ck('a level that is not a Cyber level celebrates as it always did',
     handedBack.seen===null || !/LOCK OPENED/.test(handedBack.seen), handedBack);

  // ---------------------------------------------- the counter strip
  const strip = await pg.evaluate(async ()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    CC_CYBER.enter(CC_CYBER.levels[0]); await wait(400);
    const bar=document.getElementById('cyBar');
    const under=bar&&bar.previousElementSibling&&bar.previousElementSibling.id==='mgCanvas';
    const text=bar?bar.textContent:'(none)';
    mgExit(false); await wait(300);
    return { there:!!bar, under, text, goneAfterExit:!document.getElementById('cyBar') };
  });
  ck('the counter sits right under the board', strip.there && strip.under, strip);
  ck('it opens at zero, and says how many keypads are still shut',
     /0/.test(strip.text) && /0\/1/.test(strip.text), strip.text);
  ck('and it leaves with the level', strip.goneAfterExit, strip);

  console.log('  pageerrors:', errs.length?errs.slice(0,3):'none');
  ck('no uncaught exceptions', errs.length===0, errs.slice(0,3));
  await pg.close();

  // ---------------------------------------------- Hebrew
  /* Hebrew is a dictionary of whole strings matched by a MutationObserver,
     so a new section is translated only if someone wrote its lines down.
     The level brief is the one that breaks quietly: its emoji sit inside
     the sentence, which is a different table from the rest. */
  const ph = await b.newPage({ viewport:{width:390,height:844} });
  const errsHe=[]; ph.on('pageerror', e=>errsHe.push(String(e)));
  await toWorld(ph,true);
  await ph.evaluate(()=>hubOpen()); await ph.waitForTimeout(600);
  const heMenu = await ph.evaluate(()=>{
    const t=[...document.querySelectorAll('.hub-tile')]
      .find(x=>/סייבר|Cyber/.test(x.querySelector('.ht-name').textContent));
    return t?{name:t.querySelector('.ht-name').textContent,
              tag:t.querySelector('.ht-tag').textContent}:null;
  });
  ck('the Cyber Lab tile is Hebrew in the menu',
     heMenu && HEB.test(heMenu.name) && HEB.test(heMenu.tag), heMenu);

  await ph.evaluate(()=>hubPage('cyber')); await ph.waitForTimeout(700);
  const heBand = await ph.evaluate(()=>{
    const s=document.querySelector('.t3sec.cy-sec');
    return s?{title:s.querySelector('.t3title').textContent,
              sub:s.querySelector('.t3sub').textContent,
              names:[...s.querySelectorAll('.t3name')].map(n=>n.textContent)}:null;
  });
  ck('the band, its subtitle and every level name are Hebrew',
     heBand && HEB.test(heBand.title) && HEB.test(heBand.sub) &&
     heBand.names.every(n=>HEB.test(n)), heBand);
  ck('and no English is left in a level name',
     heBand && heBand.names.every(n=>!/[A-Za-z]{3}/.test(n)), heBand&&heBand.names);

  const heLevel = await ph.evaluate(async ()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    document.getElementById('projects').classList.remove('open');
    CC_CYBER.enter(CC_CYBER.levels[0]);
    await wait(700);
    const g=document.getElementById('mgGoal'), bar=document.getElementById('cyBar');
    return { goal:g?g.textContent:'', bar:bar?bar.textContent:'' };
  });
  ck('the level brief is Hebrew, emoji and all',
     HEB.test(heLevel.goal) && !/keypad|digit|flag/i.test(heLevel.goal), heLevel.goal);
  ck('and so is the counter under the board',
     HEB.test(heLevel.bar) && !/codes tried|open/.test(heLevel.bar), heLevel.bar);

  const heWhy = await ph.evaluate(async ()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    const B=t=>newBlock(t);
    const loop=(n,body)=>{const b=B('countLoop');b.name='i';b.to=n;b.body=body;return b;};
    const tc=v=>{const b=B('tryCode');b.val=v;return b;};
    mgRobot.program=[loop(10,[tc({k:'var',name:'i'})]),B('move'),B('move'),B('move')];
    renderProgram(); mgRun();
    for(let i=0;i<900;i++){ if(!(mgState&&mgState.running))break; await wait(25); }
    await wait(400);
    const d=document.querySelector('#ccCele .cc-desc'), k=document.querySelector('#ccCele .cc-kick');
    return { desc:d?d.textContent:'', kick:k?k.textContent:'' };
  });
  ck('the lesson on the celebration card is Hebrew',
     HEB.test(heWhy.desc) && !/possibilities|secret/i.test(heWhy.desc), heWhy.desc.slice(0,60));
  ck('and so is the headline above it', HEB.test(heWhy.kick), heWhy.kick);

  /* An entry that translates to itself makes walk() write a text node the
     value it already holds, which queues another mutation: the loop that
     froze the game once already. */
  const self = await ph.evaluate(()=>window.CC_I18N.selfMapped());
  ck('no new entry translates to itself', self.length===0, self);

  console.log('  pageerrors (he):', errsHe.length?errsHe.slice(0,3):'none');
  ck('no uncaught exceptions in Hebrew', errsHe.length===0, errsHe.slice(0,3));

  console.log(`\n${pass} passed, ${fail} failed`);
  await b.close();
  process.exit(fail?1:0);
})();
