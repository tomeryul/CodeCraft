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
  /* Playwright dismisses dialogs by default, which answers "no" to every
     confirm() — and "replace the board you're working on?" is a question
     the path under test says yes to. */
  pg.on('dialog', d=>d.accept());
  await toWorld(pg,false);

  // ---------------------------------------------- it bolts on, it does not cut in
  /* Two tiles and one block arrive from a file nothing else imports. The
     proof that they are additions and not edits is that the creator's tile
     palette and the world's block palette are exactly as they were: the
     keypad is not a tool anyone can paint with, and Try Code is in no
     category row, so only a level's own `allowed` list hands it out. */
  const reg = await pg.evaluate(()=>({
    loaded:!!window.CC_CYBER,
    lock:['lock','lockk','note','snote'].every(t=>CC_TILES.DEFS[t]&&CC_TILES.DEFS[t].draw),
    note:!!(CC_TILES.DEFS.lock.solid&&CC_TILES.DEFS.lockk.solid),
    inPalette:CC_TILES.TYPES.filter(t=>['lock','lockk','note','snote'].indexOf(t)>=0),
    block:!!DEFS.tryCode,
    inCats:CATS.filter(c=>c.types.indexOf('tryCode')>=0).map(c=>c.id),
    inAllowed:CC_CYBER.blocks.indexOf('tryCode')>=0,
    levels:CC_CYBER.levels.length, acts:CC_CYBER.acts.length,
    /* every level belongs to an act, or the band would silently drop it */
    orphans:CC_CYBER.levels.filter(l=>!CC_CYBER.acts.some(a=>a.id===l.act)).map(l=>l.id),
    /* and the chain is one line with no forks and no gaps */
    chain:CC_CYBER.levels.map((l,i)=>l.needs===(i?CC_CYBER.levels[i-1].id:undefined))
  }));
  ck('the keypads and the notes register themselves as tiles',
     reg.loaded && reg.lock && reg.note, reg);
  ck('and none of them turns up as a creator tool',
     reg.inPalette.length===0, reg.inPalette);
  ck('every level sits in an act, and each one unlocks the next',
     reg.orphans.length===0 && reg.chain.every(Boolean), reg);
  ck('🔢 Try Code exists but sits in no palette category',
     reg.block && reg.inCats.length===0 && reg.inAllowed, reg);
  ck('there are eleven levels in three acts',
     reg.levels===11 && reg.acts===3, reg);

  // ---------------------------------------------- the band
  await pg.evaluate(()=>hubPage('cyber')); await pg.waitForTimeout(600);
  const band = await pg.evaluate(()=>{
    const s=document.querySelector('.t3sec.cy-sec');
    if(!s)return null;
    return { title:s.querySelector('.t3title').textContent,
             prog:s.querySelector('.t3prog').textContent,
             /* the built-in eleven only: a level you designed is .mine and
                the way in to design one is .t3new */
             cards:[...s.querySelectorAll('.t3card.cy-card:not(.mine)')].map(c=>({
               name:c.querySelector('.t3name').textContent,
               locked:c.classList.contains('locked') })) };
  });
  ck('the Cyber Lab has a band of its own', band && band.title==='Cyber Lab', band);
  ck('nothing is solved yet, and it says so', band && band.prog==='0/11', band&&band.prog);
  ck('only the first level is open — each one unlocks the next',
     band && !band.cards[0].locked && band.cards.slice(1).every(c=>c.locked),
     band&&band.cards);
  /* A locked card that does nothing is indistinguishable from a broken one,
     so it says what opens it. */
  const gate = await pg.evaluate(async ()=>{
    const lv=CC_CYBER.levels[2];
    document.querySelectorAll('.t3sec.cy-sec .t3card.cy-card:not(.mine)')[2].click();
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

  // ---------------------------------------------- two proofs, one door
  /* The 2FA keypad is one tile on purpose: two doors in a row is two
     locks, not two factors. So the right code on its own has to leave it
     exactly as shut as no code at all. */
  const twofa = await pg.evaluate(async ()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    CC_CYBER.enter(CC_CYBER.levels.find(l=>l.id==='cy_2fa'));
    await wait(350);
    const st=mgState, rb=st.robot;
    const ahead=()=>CC_TILES.solid(rb,(rb.x+DX[rb.dir])+'_'+(rb.y+DY[rb.dir]));
    const punch=n=>{const b=newBlock('tryCode');b.val={k:'num',n:n};CCAct(st,b);};
    rb.x=2;rb.y=1;rb.dir=1;                 // standing in front of the keypad
    punch(44);                               // the code, and nothing else
    const codeOnly={solid:ahead(),cracked:rb.cracked.size};
    rb.keys.add(0);                          // now carrying the key too
    const both={solid:ahead()};
    mgExit(false); await wait(200);
    return {codeOnly,both};
  });
  ck('the right code alone does not open a keypad that wants a key too',
     twofa.codeOnly.cracked===1 && twofa.codeOnly.solid===true, twofa);
  ck('and it opens the moment the robot is carrying one', twofa.both.solid===false, twofa);

  // ---------------------------------------------- the seal, and the jam
  /* A forgery copies the number perfectly; what it cannot copy is who
     wrote the note. 🔏 sealed note ahead is the only sensor that can tell
     the two apart, and it has to be wrong about neither. */
  const sensors = await pg.evaluate(async ()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    CC_CYBER.enter(CC_CYBER.levels.find(l=>l.id==='cy_phish'));
    await wait(350);
    const st=mgState, rb=st.robot;
    const at=(x,y)=>{rb.x=x;rb.y=y;rb.dir=1;return mgCond(st,'sealAhead');};
    const real=at(0,1), forged=at(1,1), floor=at(3,1);
    /* one wrong code and this keypad is done listening */
    rb.x=3;rb.y=1;rb.dir=1;
    const wrong=newBlock('tryCode');wrong.val={k:'num',n:99};CCAct(st,wrong);
    const jam={on:mgCond(st,'jammed'), tries:rb.tries|0};
    const right=newBlock('tryCode');right.val={k:'num',n:58};CCAct(st,right);
    const refused={cracked:rb.cracked.size, tries:rb.tries|0};
    const w=newBlock('wait');CCAct(st,w);    // ⏱ Wait is what talks it round
    const cooled=mgCond(st,'jammed');
    mgExit(false); await wait(200);
    return {real,forged,floor,jam,refused,cooled};
  });
  ck('the seal sensor tells the real note from the forgery',
     sensors.real===true && sensors.forged===false && sensors.floor===false, sensors);
  ck('one wrong code jams a keypad that only allows one',
     sensors.jam.on===true && sensors.jam.tries===1, sensors);
  ck('and a jammed keypad refuses even the RIGHT code, without counting it',
     sensors.refused.cracked===0 && sensors.refused.tries===1, sensors);
  ck('⏱ Wait is what clears it', sensors.cooled===false, sensors);

  // ---------------------------------------------- nothing leaks outward
  /* Both sensors answer false off a Cyber level, and neither is offered by
     a board that could not make it true — a sensor a player cannot use is
     a sensor that should not be in their list. */
  const leak = await pg.evaluate(async ()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    CC_CYBER.enter(CC_CYBER.levels[0]);      // no strikes, no sealed notes
    await wait(320);
    const plain={jam:mgCond(mgState,'jammed'), seal:mgCond(mgState,'sealAhead'),
                 list:mgCondList().filter(c=>c==='jammed'||c==='sealAhead')};
    mgExit(false); await wait(200);
    CC_CYBER.enter(CC_CYBER.levels.find(l=>l.id==='cy_phish'));
    await wait(320);
    const phish=mgCondList().filter(c=>c==='jammed'||c==='sealAhead').sort();
    mgExit(false); await wait(200);
    return {plain, phish, world:mgCondList===undefined?null:CONDS.indexOf('jammed')};
  });
  ck('neither sensor is true, or offered, on a level that cannot use it',
     leak.plain.jam===false && leak.plain.seal===false && leak.plain.list.length===0, leak);
  ck('and both are offered on the level that needs them',
     leak.phish.join()==='jammed,sealAhead', leak.phish);
  ck('the world palette never hears about them', leak.world===-1, leak.world);

  // ---------------------------------------------- every level is solvable, in budget
  /* A level that cannot be finished inside its own block budget is not a
     lesson, it is a wall. Each solution here is the intended one, so the
     block count is also the claim the card makes on the player — and on a
     level with several inputs the SAME program has to pass all of them,
     hidden one included. */
  const solved = await pg.evaluate(async () => {
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    const B=t=>newBlock(t);
    const loop=(n,body)=>{const b=B('countLoop');b.name='i';b.to=n;b.body=body;return b;};
    const rep=(n,body)=>{const b=B('repeat');b.n=n;b.body=body;return b;};
    const iff=(c,body)=>{const b=B('if');b.cond=c;b.body=body;return b;};
    const tc=v=>{const b=B('tryCode');b.val=v;return b;};
    const rd=n=>{const b=B('read');b.name=n;b.src='ahead';return b;};
    const ch=(n,k)=>{const b=B('changeVar');b.name=n;b.n=k;return b;};
    const set=(n,v)=>{const b=B('setVar');b.name=n;b.val=v;return b;};
    const mv=k=>Array.from({length:k},()=>B('move'));
    const V=n=>({k:'var',name:n});
    const SOL={
      cy_ten:  [loop(10,[tc(V('i'))]),...mv(3)],
      cy_two:  [loop(100,[tc(V('i'))]),...mv(3)],
      cy_note: [rd('x'),B('move'),tc(V('x')),...mv(4)],
      cy_shift:[rd('x'),ch('x',3),B('move'),tc(V('x')),...mv(4)],
      /* the loop from level 1 no longer works: three wrong codes jam the
         keypad, so the program has to notice and ⏱ Wait it off */
      cy_jam:  [loop(10,[iff('jammed',[B('wait')]),tc(V('i'))]),...mv(3)],
      cy_2fa:  [rd('x'),B('turnL'),B('turnL'),B('move'),B('turnL'),B('turnL'),
                B('move'),B('move'),tc(V('x')),...mv(3)],
      /* the keypad is never touched at all — that is the level */
      cy_hole: [B('turnL'),rep(2,[B('move')]),B('turnR'),rep(6,[B('move')]),
                B('turnR'),rep(2,[B('move')])],
      cy_trust:[B('turnL'),B('move'),B('move'),B('turnR'),rd('x'),B('turnR'),
                B('move'),B('move'),B('turnL'),B('move'),tc(V('x')),...mv(3)],
      cy_otp:  [rd('x'),B('move'),B('move'),tc(V('x')),...mv(3)],
      /* read the SEALED note, whichever of the two it is this time */
      cy_phish:[loop(2,[iff('sealAhead',[rd('x')]),B('move')]),B('move'),
                tc(V('x')),...mv(3)],
      /* the log, and the entry that does not fit */
      cy_log:  [rd('c'),B('move'),
                loop(4,[rd('x'),iff({var:'x',op:'>',val:V('c')},[set('c',V('x'))]),B('move')]),
                tc(V('c')),...mv(2)]
    };
    const out=[];
    for(const lv of CC_CYBER.levels){
      delete player.projects[lv.id];
      CC_CYBER.enter(lv); await wait(320);
      mgRobot.program=SOL[lv.id].slice();
      renderProgram();
      /* counted BEFORE the run: finishing a level tears the run down, and
         the block count is a claim about the program, not about the robot */
      const size=progSize(mgRobot);
      mgRun();
      let tries=0, cele=null;
      for(let i=0;i<3000;i++){
        if(mgState&&mgState.robot)tries=mgState.robot.tries|0;
        if(!(mgState&&mgState.running))break;
        await wait(12);
      }
      await wait(250);
      const card=document.querySelector('#ccCele .cc-desc');
      if(card)cele=card.textContent;
      out.push({id:lv.id, done:!!player.projects[lv.id], tries,
                blocks:size, max:lv.maxBlocks, cele,
                inputs:(lv.cases||[]).length, why:lv.why,
                kick:(document.querySelector('#ccCele .cc-kick')||{}).textContent});
      const c=document.querySelector('#ccCele .cc-cta'); if(c)c.click();
      await wait(300); if(mgState)mgExit(false); await wait(200);
    }
    return out;
  });
  const by=id=>solved.find(r=>r.id===id)||{};
  ck('every level can be finished', solved.every(r=>r.done),
     solved.filter(r=>!r.done).map(r=>r.id));
  ck('and each one inside the block budget its card promises',
     solved.every(r=>r.blocks<=r.max), solved.map(r=>r.id+' '+r.blocks+'/'+r.max));
  /* The whole of act I, in two numbers: a one-digit code falls in ten
     tries and the same program needs a hundred for two digits. Nothing
     else on the screen would ever say what a digit costs. */
  ck('one digit costs ten tries', by('cy_ten').tries===10, by('cy_ten').tries);
  ck('and two digits cost a hundred — the lesson, in the counter',
     by('cy_two').tries===100, by('cy_two').tries);
  ck('a code that was written down costs one try',
     by('cy_note').tries===1 && by('cy_shift').tries===1,
     [by('cy_note').tries,by('cy_shift').tries]);
  /* Three Strikes: the same ten guesses as level one, and that is the
     point — nothing about the CODE got harder. What changed is that the
     loop now has to notice it has been shut out and wait its way back in. */
  ck('a keypad that jams still falls to a loop that waits it out',
     by('cy_jam').done && by('cy_jam').tries===10, by('cy_jam').tries);
  /* and the level is worth nothing unless the loop from level one, the one
     the player already has, actually loses on it */
  const naive = await pg.evaluate(async ()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    const B=t=>newBlock(t);
    const lv=CC_CYBER.levels.find(l=>l.id==='cy_jam');
    delete player.projects[lv.id];
    CC_CYBER.enter(lv); await wait(320);
    const loop=B('countLoop');loop.name='i';loop.to=10;
    const t=B('tryCode');t.val={k:'var',name:'i'};loop.body=[t];
    mgRobot.program=[loop,B('move'),B('move'),B('move')];
    renderProgram(); mgRun();
    for(let i=0;i<3000;i++){ if(!(mgState&&mgState.running))break; await wait(12); }
    await wait(300);
    const out={done:!!player.projects[lv.id],
               jam:!!(mgState&&mgState.robot&&mgState.robot.jam),
               tries:mgState&&mgState.robot?mgState.robot.tries|0:-1};
    const c=document.querySelector('#ccCele .cc-cta'); if(c)c.click();
    await wait(250); if(mgState)mgExit(false); await wait(200);
    return out;
  });
  ck('the plain guessing loop from level one now loses',
     naive.done===false && naive.jam===true, naive);
  ck('and it stops after three, instead of racking up ten',
     naive.tries===3, naive.tries);
  /* The Open Window: the keypad is never touched. */
  ck('the level about the hole in the wall is won without a single code',
     by('cy_hole').done && by('cy_hole').tries===0, by('cy_hole').tries);
  /* The hard levels ship four boards each, one of them hidden. */
  ck('the three hardest levels each run one program over four boards',
     ['cy_otp','cy_phish','cy_log'].every(id=>by(id).inputs===4),
     ['cy_otp','cy_phish','cy_log'].map(id=>id+':'+by(id).inputs));
  const hidden = await pg.evaluate(()=>CC_CYBER.levels
    .filter(l=>(l.cases||[]).length)
    .map(l=>({id:l.id,hid:(l.cases||[]).filter(c=>c.hidden).length})));
  ck('and each keeps one of them hidden from the player',
     hidden.length===3 && hidden.every(h=>h.hid===1), hidden);

  // ---------------------------------------------- a memorised secret is not a rule
  /* The point of shipping four boards is that a program which writes the
     code into itself passes the board in front of it and fails the next.
     If that program were to pass, the level would teach the opposite of
     what it says. */
  const cheat = await pg.evaluate(async ()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    const B=t=>newBlock(t);
    const tc=n=>{const b=B('tryCode');b.val={k:'num',n:n};return b;};
    const lv=CC_CYBER.levels.find(l=>l.id==='cy_otp');
    delete player.projects[lv.id];
    CC_CYBER.enter(lv); await wait(320);
    /* 31 is the code on the FIRST board, and on that board alone */
    mgRobot.program=[B('move'),B('move'),tc(31),B('move'),B('move'),B('move')];
    renderProgram(); mgRun();
    for(let i=0;i<3000;i++){ if(!(mgState&&mgState.running))break; await wait(12); }
    await wait(300);
    const res=(mgState&&mgState.results)||[];
    const out={done:!!player.projects[lv.id], first:res[0], later:res.slice(1)};
    const c=document.querySelector('#ccCele .cc-cta'); if(c)c.click();
    await wait(250); if(mgState)mgExit(false); await wait(200);
    return out;
  });
  ck('a program that remembers the code passes the board it was written for',
     cheat.first===true, cheat);
  ck('and fails every other one, so the level cannot be memorised',
     cheat.done===false && cheat.later.some(r=>r===false), cheat);

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

  // ---------------------------------------------- designing one yourself
  /* A Cyber level IS a flat challenge board, so the designer is the
     creator the player already knows with four more tiles, a flag and one
     setting. What has to be true is that the mode really switches, that a
     code really lands on the tile, and that Save stays shut until the
     board is a level somebody could finish. */
  const mode = await pg.evaluate(async ()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    if(mgState)mgExit(false); await wait(200);
    cyDesign(); await wait(400);
    const p=mgState.proj;
    return { cyber:!!p.cyber, creator:!!mgState.creator, goalType:p.goalType,
             tools:[...document.querySelectorAll('#mgTools .tl-lb')].map(e=>e.textContent),
             tryCode:(p.allowed||[]).indexOf('tryCode')>=0,
             bar:!!document.getElementById('cyBar'),
             strikes:document.querySelectorAll('#cyStrikes .t3chip').length,
             addLevel:document.getElementById('mgAddStage').style.display,
             blank:mgRobot.program.length===0 };
  });
  ck('the creator switches into Cyber mode with its own tools',
     mode.cyber && mode.creator && mode.goalType==='reach' &&
     mode.tools.join()==='Flag,Start,Wall,Keypad,Keypad + Key,Key,Note,Sealed note,Erase', mode);
  ck('🔢 Try Code is in the palette it hands out, and the counter is under the board',
     mode.tryCode && mode.bar, mode);
  ck('and ⛔ Strikes is a setting with four values', mode.strikes===4, mode);
  /* ➕ Add level banks a FLAT stage into a multi-level pack, which a Cyber
     board is not — the depth here is the inputs instead */
  ck('➕ Add level is not offered, because a design is one level',
     mode.addLevel==='none', mode);

  /* The code is what a keypad IS. It used to paint as 0, because the
     creator only knew how to carry a colour or a direction onto a tile. */
  const painted = await pg.evaluate(()=>{
    const p=mgState.proj;
    mgState.paintMode='lock'; mgState.tileNum=58; mgPaintTile(3,1);
    mgState.paintMode='snote'; mgState.tileNum=58; mgPaintTile(2,1);
    mgState.paintMode='flag'; mgPaintTile(5,1);
    mgState.paintMode='bot'; mgPaintTile(1,1);
    return { tiles:p.tiles.map(t=>t[2]+':'+t[3]), goal:p.goal, start:[p.start.x,p.start.y],
             has:mgHasDesign(p) };
  });
  ck('a keypad and a note keep the number they were painted with',
     painted.tiles.join()==='lock:58,snote:58', painted.tiles);
  ck('the flag is a place on the board, and the design counts as drawn',
     painted.goal.join()==='5,1' && painted.has===true, painted);

  /* The checks are the point of the designer: an author must not be able
     to publish a lock nobody can open. */
  const guard = await pg.evaluate(()=>{
    const p=mgState.proj, out={};
    const first=()=>{const v=CC_CYED.check(p);return v.errs[0]||null;};
    const g=p.goal; p.goal=null; out.noFlag=first(); p.goal=g;
    p.strikes=2;
    const note=p.tiles.find(t=>t[2]==='snote'); note[3]=11;   // the note no longer says the code
    out.jamNoNote=first();
    note[3]=58; p.strikes=0;
    const lock=p.tiles.find(t=>t[2]==='lock'); lock[3]=4821; note[3]=11;
    out.unfindable=first();
    lock[3]=58; note[3]=58;
    mgState.paintMode='lockk'; mgState.tileNum=58; mgPaintTile(3,1);
    out.lockkNoKey=first();
    mgState.paintMode='lock'; mgState.tileNum=58; mgPaintTile(3,1);
    out.clean=first();
    /* Save is shut until the author has solved it themselves */
    mgState.solved=false;
    const before=(player.myChallenges||[]).filter(x=>x.cy).length;
    saveMyChallenge();
    out.savedUnproven=(player.myChallenges||[]).filter(x=>x.cy).length-before;
    return out;
  });
  ck('a board with no flag is not a level', /flag/.test(guard.noFlag||''), guard);
  ck('a jamming keypad whose code is written nowhere is refused',
     /nobody can open it/.test(guard.jamNoNote||''), guard);
  ck('and so is a long code with no note to find it on',
     /more steps than a run has/.test(guard.unfindable||''), guard);
  ck('a 🗝️ Keypad + Key with no key on the board is refused',
     /needs a 🔑 key/.test(guard.lockkNoKey||''), guard);
  ck('a board that is a level passes clean', guard.clean===null, guard);
  ck('Save stays shut until the author has solved it themselves',
     guard.savedUnproven===0, guard);

  // ---------------------------------------------- saying what the pieces are
  /* Nine glyphs and a number box is a puzzle of its own, and the author is
     here to build a level rather than solve one. Every tool says what it
     is where you pick it up, and the way into the guide rides beside them
     — because on an untouched 8×6 board the settings row, where the flat
     creator keeps its guide, is below the fold. */
  const tips = await pg.evaluate(async ()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    if(mgState)mgExit(false); await wait(200);
    cyDesign(); await wait(350);
    const seen=[];
    for(const t of CC_CYED.tools){
      mgState.paintMode=t.id; mgCreatorUI();
      seen.push((document.querySelector('#cyTip .cy-tip-t')||{}).textContent||'');
    }
    const help=document.getElementById('cyHelp');
    const dock=document.getElementById('mgDock');
    return { tools:CC_CYED.tools.length,
             everyToolExplained:CC_CYED.tools.every(t=>t.tip&&t.tip.length>30),
             saysTheName:seen.every((t,i)=>t.indexOf(CC_CYED.tools[i].lbl)>=0),
             lock:seen[3], snote:seen[7],
             helpInDock:!!(help&&dock&&dock.contains(help)) };
  });
  ck('every tool explains itself', tips.tools===9 && tips.everyToolExplained, tips);
  ck('and the line under the tools names the one you picked', tips.saysTheName, tips);
  ck('the keypad says its code is a number you set',
     /NUMBER/.test(tips.lock) && /Try Code/.test(tips.lock), tips.lock);
  ck('and the sealed note says the seal is who wrote it, not the number',
     /wax seal/.test(tips.snote) && /sealed note ahead/.test(tips.snote), tips.snote);
  /* the dock is the part of this panel that is always on screen */
  ck('the way into the guide sits beside the tools, not in a settings panel',
     tips.helpInDock, tips);

  const guide = await pg.evaluate(async ()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    document.getElementById('cyHelp').click(); await wait(400);
    const body=document.getElementById('guideBody');
    const out={ open:document.getElementById('guide').classList.contains('open'),
      head:document.querySelector('#guide .m-head h3').textContent,
      secs:document.querySelectorAll('#guideBody h4.qsec').length,
      rows:document.querySelectorAll('#guideBody .grule').length,
      boards:[...document.querySelectorAll('#guideBody .pcard .pname')].map(e=>e.textContent),
      /* Every line is its own element with no markup inside it — a <b> in
         mid-sentence is what leaves the flat guide translated in shards.
         ui-icons.js lifts each emoji into a span of its own, so those are
         the children that do not count. */
      welded:[...body.querySelectorAll('.grule p, .gline, .grule b')]
        .filter(e=>[...e.children].some(c=>!c.classList.contains('ui-emoji'))).length };
    closeGuide(); await wait(250);
    return out;
  });
  ck('the 📘 opens this mode\'s own guide', guide.open && guide.head==='Design a Cyber level', guide);
  ck('it covers the pieces, the notes, Strikes, the boards, a walkthrough and the inputs',
     guide.secs===6, guide);
  ck('with a labelled row for every piece and every step', guide.rows>=20, guide);
  ck('and no line welds markup into the middle of a sentence', guide.welded===0, guide);
  ck('four boards to start from', guide.boards.length===4, guide.boards);

  /* A starter board is the shortest path from "what do I even build" to a
     level: it has to land ready to prove, not ready to debug. */
  const recipes = await pg.evaluate(async ()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    const out=[];
    for(const r of CC_CYED.recipes){
      CC_CYED.apply(r); await wait(250);
      const p=mgState.proj;
      out.push({id:r.id, name:p.name===r.name, errs:CC_CYED.check(p).errs.length,
                tiles:(p.tiles||[]).length, goal:!!p.goal, hint:p.desc2===r.hint,
                unproven:mgState.solved===false});
    }
    if(mgState)mgExit(false); await wait(200);
    return out;
  });
  ck('every starter board lands as a level the checks already accept',
     recipes.length===4 && recipes.every(r=>r.errs===0&&r.tiles>0&&r.goal&&r.name&&r.hint),
     recipes);
  ck('and lands unproven, so the author still has to solve it',
     recipes.every(r=>r.unproven), recipes);

  /* A starter board that cannot be solved is worse than no starter board:
     an author loads it, cannot prove it, and concludes the mode is
     broken. So each one is solved here, inside the budget it ships with. */
  const recipeSolve = await pg.evaluate(async ()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    const B=t=>newBlock(t);
    const loop=(n,body)=>{const b=B('countLoop');b.name='i';b.to=n;b.body=body;return b;};
    const iff=(c,body)=>{const b=B('if');b.cond=c;b.body=body;return b;};
    const tc=v=>{const b=B('tryCode');b.val=v;return b;};
    const rd=n=>{const b=B('read');b.name=n;b.src='ahead';return b;};
    const mv=k=>Array.from({length:k},()=>B('move'));
    const V=n=>({k:'var',name:n});
    const SOL={
      cy_r_guess:[loop(10,[tc(V('i'))]),...mv(3)],
      cy_r_note: [rd('x'),B('move'),B('move'),tc(V('x')),...mv(3)],
      cy_r_2fa:  [rd('x'),B('turnL'),B('turnL'),B('move'),B('turnL'),B('turnL'),
                  B('move'),B('move'),tc(V('x')),...mv(3)],
      cy_r_fake: [loop(2,[iff('sealAhead',[rd('x')]),B('move')]),B('move'),
                  tc(V('x')),...mv(3)]
    };
    const out=[];
    for(const r of CC_CYED.recipes){
      CC_CYED.apply(r); await wait(300);
      mgRobot.program=SOL[r.id].slice(); renderProgram();
      const size=progSize(mgRobot);
      mgRun();
      for(let i=0;i<3000;i++){ if(!(mgState&&mgState.running))break; await wait(12); }
      await wait(300);
      out.push({id:r.id, solved:!!mgState.solved, blocks:size, max:r.max});
      const c=document.querySelector('#ccCele .cc-cta'); if(c)c.click(); await wait(250);
    }
    if(mgState)mgExit(false); await wait(200);
    return out;
  });
  ck('every starter board can actually be solved',
     recipeSolve.every(r=>r.solved), recipeSolve.filter(r=>!r.solved).map(r=>r.id));
  ck('and inside the budget it ships with',
     recipeSolve.every(r=>r.blocks<=r.max),
     recipeSolve.map(r=>r.id+' '+r.blocks+'/'+r.max));

  /* and the flat creator must still get the flat guide */
  const flat = await pg.evaluate(async ()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    if(mgState)mgExit(false); await wait(200);
    mgEnterCreator(); await wait(300);
    openGuide(); await wait(350);
    const out={ head:document.querySelector('#guide .m-head h3').textContent,
                boards:[...document.querySelectorAll('#guideBody .pcard .pname')].map(e=>e.textContent) };
    closeGuide(); await wait(200);
    if(mgState)mgExit(false); await wait(200);
    return out;
  });
  ck('a flat challenge still gets the guide it always had',
     flat.head==='Design a great challenge' && flat.boards.indexOf('The Detour')>=0, flat);

  /* The creator's inputs work here unchanged, and they are the best thing
     an author can reach for: two boards with two codes, and a program
     that writes the number into itself passes one and fails the other.
     The hard built-in levels are made of exactly this. */
  const inputs = await pg.evaluate(async ()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    if(mgState)mgExit(false); await wait(200);
    cyDesign(); await wait(300);
    const p=mgState.proj;
    mgSetSize(-2,-2);
    const board=code=>{
      mgState.paintMode='bot';  mgPaintTile(1,1);
      mgState.paintMode='wall'; mgPaintTile(3,0); mgPaintTile(3,2); mgPaintTile(3,3);
      mgState.paintMode='lock'; mgState.tileNum=code; mgPaintTile(3,1);
      mgState.paintMode='note'; mgState.tileNum=code; mgPaintTile(2,1);
    };
    board(58);
    mgState.paintMode='flag'; mgPaintTile(5,1);
    mgAddCase(); await wait(200);          // the board becomes input 1
    mgAddCase(); await wait(200);          // and input 2 gets a code of its own
    board(71);
    const B=t=>newBlock(t);
    const rd=n=>{const b=B('read');b.name=n;b.src='ahead';return b;};
    const tc=v=>{const b=B('tryCode');b.val=v;return b;};
    const run=async prog=>{
      mgRobot.program=prog; renderProgram(); mgRun();
      for(let i=0;i<3000;i++){ if(!(mgState&&mgState.running))break; await wait(12); }
      await wait(350);
      const r=(mgState.results||[]).slice(), ok=!!mgState.solved;
      const c=document.querySelector('#ccCele .cc-cta'); if(c)c.click();
      await wait(250);
      return {r,ok};
    };
    const codes=(p.cases||[]).map(c=>(c.tiles||[]).filter(t=>t[2]==='lock').map(t=>t[3]).join());
    const reads=await run([rd('x'),B('move'),tc({k:'var',name:'x'}),B('move'),B('move'),B('move')]);
    const remembers=await run([B('move'),tc({k:'num',n:58}),B('move'),B('move'),B('move')]);
    if(mgState)mgExit(false); await wait(200);
    return {cases:(p.cases||[]).length, codes, reads, remembers};
  });
  ck('an author can split their level into inputs with a code each',
     inputs.cases===2 && inputs.codes.join()==='58,71', inputs);
  ck('a program that reads the note passes both',
     inputs.reads.ok && inputs.reads.r.join()==='true,true', inputs.reads);
  /* the per-input verdicts, not mgState.solved: a level stays proven once
     it has been proven, so a later experiment that fails does not un-prove
     it — which is right, and is why the claim here is about the inputs */
  ck('and one that remembers the first code passes one and fails the other',
     inputs.remembers.r.join()==='true,false', inputs.remembers);

  /* Prove it, save it, and play it back the way a player would. */
  const mine = await pg.evaluate(async ()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    /* its own board: the section before this one closed the designer, and
       a check that depends on where an earlier check happened to leave the
       page is a check that breaks the moment one is inserted above it */
    if(mgState)mgExit(false); await wait(200);
    cyDesign(); await wait(300);
    const p=mgState.proj;
    mgSetSize(-2,-2);
    mgState.paintMode='bot';   mgPaintTile(1,1);
    mgState.paintMode='wall';  mgPaintTile(3,0); mgPaintTile(3,2); mgPaintTile(3,3);
    mgState.paintMode='lock';  mgState.tileNum=58; mgPaintTile(3,1);
    mgState.paintMode='snote'; mgState.tileNum=58; mgPaintTile(2,1);
    mgState.paintMode='flag';  mgPaintTile(5,1);
    p.strikes=2; p.name='My Lock'; p.desc2='Read the note. Do not guess.';
    const B=t=>newBlock(t);
    const rd=n=>{const b=B('read');b.name=n;b.src='ahead';return b;};
    const tc=v=>{const b=B('tryCode');b.val=v;return b;};
    const prog=()=>[rd('x'),B('move'),tc({k:'var',name:'x'}),B('move'),B('move'),B('move')];
    mgRobot.program=prog();
    renderProgram(); mgRun();
    for(let i=0;i<2000;i++){ if(!(mgState&&mgState.running))break; await wait(12); }
    await wait(300);
    let c=document.querySelector('#ccCele .cc-cta'); if(c)c.click(); await wait(250);
    const proven=!!mgState.solved;
    saveMyChallenge();
    const e=(player.myChallenges||[]).filter(x=>x.cy)[0]||null;
    mgExit(false); await wait(250);
    if(!e)return {proven,saved:null};
    mgEnter(e); await wait(400);
    const played={cyber:!!mgState.proj.cyber, strikes:mgState.proj.strikes|0,
                  goal:(mgState.proj.goal||[]).join(), bar:!!document.getElementById('cyBar'),
                  brief:document.getElementById('mgGoal').textContent,
                  creator:!!mgState.creator, blank:mgRobot.program.length===0};
    mgRobot.program=prog(); renderProgram(); mgRun();
    for(let i=0;i<2000;i++){ if(!(mgState&&mgState.running))break; await wait(12); }
    await wait(300);
    played.won=!!document.querySelector('#ccCele');
    c=document.querySelector('#ccCele .cc-cta'); if(c)c.click(); await wait(250);
    if(mgState)mgExit(false); await wait(200);
    return {proven, saved:{id:e.id,cy:!!e.cy,strikes:e.strikes|0,goal:(e.goal||[]).join(),
                           tiles:(e.tiles||[]).length, sol:(e.sol||[]).length}, played};
  });
  /* a failure earlier in the chain must not take the rest of the suite
     down with it — a harness that dies on the first cascade hides every
     check after it */
  const played=mine.played||{};
  ck('proving it opens Save, and what is saved is a Cyber level',
     mine.proven && !!mine.saved && mine.saved.cy && mine.saved.goal==='5,1' &&
     mine.saved.strikes===2 && mine.saved.tiles===5 && mine.saved.sol>0, mine);
  ck('playing it back turns the mode on, with the strikes its author set',
     played.cyber && played.strikes===2 && played.bar &&
     played.creator===false, played);
  ck("and the player reads the author's own words, not a stock line",
     /Read the note/.test(played.brief||''), played.brief);
  ck('the player starts with an empty program, and can win it',
     played.blank && played.won, played);

  /* Editing it back has to restore the board, the setting and the
     author's own solution — an edit that loses the solution would make
     them re-prove a level they already proved. */
  const edit = await pg.evaluate(async ()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    const e=(player.myChallenges||[]).filter(x=>x.cy)[0];
    mgEditMyChallenge(e); await wait(400);
    const p=mgState.proj;
    const out={cyber:!!p.cyber, creator:!!mgState.creator, sameId:mgState.editingId===e.id,
               tiles:(p.tiles||[]).length, goal:(p.goal||[]).join(), strikes:p.strikes|0,
               hint:p.desc2, prog:mgRobot.program.length};
    /* and switching back to a flat board leaves nothing of it behind */
    CC_CYED.setMode(false); await wait(250);
    out.off={cyber:!!p.cyber, goal:p.goal||null, goalType:p.goalType||null,
             tiles:(p.tiles||[]).length,
             tool:[...document.querySelectorAll('#mgTools .tl-lb')].map(x=>x.textContent)[0]};
    if(mgState)mgExit(false); await wait(200);
    return out;
  });
  ck('editing a saved Cyber level reloads its board and its setting',
     edit.cyber && edit.creator && edit.sameId && edit.tiles===5 &&
     edit.goal==='5,1' && edit.strikes===2 && /Read the note/.test(edit.hint), edit);
  ck("and the author's own solution comes back with it", edit.prog===6, edit);
  ck('switching back to a flat board leaves nothing of the Cyber one behind',
     edit.off.cyber===false && edit.off.goal===null && edit.off.goalType===null &&
     edit.off.tiles===0 && edit.off.tool==='Target', edit.off);

  /* The band is where a player finds it: their own levels, and the way in. */
  await pg.evaluate(()=>hubPage('cyber')); await pg.waitForTimeout(600);
  const yours = await pg.evaluate(()=>{
    const sec=document.querySelector('.t3sec.cy-sec');
    return { acts:[...sec.querySelectorAll('.cy-act-n')].map(e=>e.textContent),
             mine:[...sec.querySelectorAll('.t3card.mine .t3name')].map(e=>e.textContent),
             design:!!sec.querySelector('.t3card.t3new') };
  });
  ck('a level you built gets its own place in the band, under the eleven',
     yours.acts.length===4 && yours.acts[3]==='Yours' &&
     yours.mine.join()==='My Lock', yours);
  ck('and there is a way in to build another', yours.design, yours);
  await pg.evaluate(()=>{$('projects').classList.remove('open');});

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
  ph.on('dialog', d=>d.accept());
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

  /* The guide is the part an author actually reads, so it is the part
     that has to be readable. Every line of it is its own element with
     nothing inside it, which is what lets a whole-string dictionary
     translate the lot. */
  const heGuide = await ph.evaluate(async ()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    if(mgState)mgExit(false); await wait(200);
    cyDesign(); await wait(400);
    const tip=(document.querySelector('#cyTip .cy-tip-t')||{}).textContent||'';
    document.getElementById('cyHelp').click(); await wait(500);
    const bits=[...document.querySelectorAll(
      '#guideBody h4.qsec, #guideBody .grule b, #guideBody .grule p, '+
      '#guideBody .gline, #guideBody .gsub, #guideBody .pcard .pname, #guideBody .pcard .pdesc')];
    const eng=bits.map(e=>e.textContent.trim())
      .filter(t=>t && !/[֐-׿]/.test(t) && /[A-Za-z]{3}/.test(t));
    const out={ n:bits.length, english:eng.slice(0,6),
                head:document.querySelector('#guide .m-head h3').textContent, tip };
    closeGuide(); await wait(200);
    if(mgState)mgExit(false); await wait(200);
    return out;
  });
  ck('the whole designer guide is Hebrew, line by line',
     heGuide.n>40 && heGuide.english.length===0 && HEB.test(heGuide.head), heGuide);
  ck('and so is the line that explains the tool in your hand',
     HEB.test(heGuide.tip) && !/keypad|note|robot/i.test(heGuide.tip), heGuide.tip);

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
