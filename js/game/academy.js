"use strict";
/* ---------------- Academy: guided starter tutorials ----------------
   A short ladder of tiny mini-games that teach the core mechanics before the
   open world: move → turn → chop → collect → loop → condition. Each stage
   reuses the challenge engine (mgEnter / mgTick / mgDraw / mgFinish) — it just
   supplies a growing `allowed` block set and a simple goal (reach a 🚩 flag,
   chop every 🌳 tree, or collect every 💎 gem). Progress lives in
   player.academy (an id→1 map), saved + cloud-synced like everything else. */
const TUTS=[
  {id:"t_move",tut:true,em:"👣",name:"First Steps",diff:1,coins:0,xp:15,maxBlocks:6,gw:5,gh:3,
   allowed:["move"],start:{x:0,y:1,dir:1},goal:[4,1],goalType:"reach",
   desc:"Robots do exactly what your code says. Add ⬆️ Move blocks until the robot reaches the 🚩 flag, then press ▶ to run.",
   teach:[{em:"⬆️",name:"Move",txt:"One step forward, in whatever direction the robot is already facing."},
          {em:"▶",name:"Run",txt:"Runs your blocks from top to bottom, one at a time. Watch the robot follow them."}],
   steps:["Tap ⬆️ Move at the bottom to add it to your program.",
          "Add enough of them to cross the gap to the 🚩 flag.",
          "Press ▶ and watch. Too few or too many and it won't land on the flag."]},
  {id:"t_turn",tut:true,em:"🧭",name:"Turn & Go",diff:1,coins:0,xp:15,maxBlocks:8,gw:4,gh:4,
   allowed:["move","turnL","turnR"],start:{x:0,y:0,dir:1},goal:[3,3],goalType:"reach",
   desc:"The flag is around a corner! Use ↪️ Turn Right to change the way the robot faces, then ⬆️ Move toward the 🚩.",
   teach:[{em:"↪️",name:"Turn Right",txt:"Turns the robot on the spot. It does NOT move — turning costs a step but changes nothing else."},
          {em:"↩️",name:"Turn Left",txt:"The same, the other way."}],
   steps:["Move across until the robot is under the 🚩 flag.",
          "Add ↪️ Turn Right so it faces the flag.",
          "Add ⬆️ Move blocks to finish the trip."]},
  {id:"t_chop",tut:true,em:"🪓",name:"Timber!",diff:1,coins:0,xp:20,maxBlocks:8,gw:5,gh:3,
   allowed:["move","turnL","turnR","chop"],start:{x:0,y:1,dir:1},trees:[[4,1]],goalType:"chop",
   desc:"Walk up to the 🌳 tree and use 🪓 Chop to clear it — exactly how your robots gather wood out in the world.",
   teach:[{em:"🪓",name:"Chop",txt:"Cuts down the 🌳 tree the robot is facing. If there is no tree there it just does nothing."}],
   steps:["⬆️ Move until the robot is standing right next to the 🌳 tree.",
          "Add 🪓 Chop.",
          "You do NOT need to stand on the tree — chopping reaches the tile ahead."]},
  {id:"t_collect",tut:true,em:"💎",name:"Treasure Hunt",diff:1,coins:0,xp:20,maxBlocks:10,gw:5,gh:3,
   allowed:["move","turnL","turnR","collect"],start:{x:0,y:1,dir:1},items:[[4,1]],goalType:"collect",
   desc:"Reach the 💎 gem and use ✋ Collect to pick it up — the same way you gather crystals and resources.",
   teach:[{em:"✋",name:"Collect",txt:"Picks up the 💎 gem the robot is on, or the one right in front of it."}],
   steps:["⬆️ Move toward the 💎 gem.",
          "Add ✋ Collect to pick it up.",
          "This is exactly how your robots gather wood, stone and crystal out in the world."]},
  {id:"t_loop",tut:true,em:"🔁",name:"Loop the Forest",diff:2,coins:0,xp:30,maxBlocks:4,gw:6,gh:3,
   allowed:["move","turnL","turnR","chop","repeat"],start:{x:0,y:1,dir:1},trees:[[1,1],[2,1],[3,1],[4,1],[5,1]],goalType:"chop",
   desc:"Five trees, but only 4 blocks! Put ⬆️ Move and 🪓 Chop INSIDE a 🔁 Repeat so one small loop does the work of many.",
   teach:[{em:"🔁",name:"Repeat",txt:"Runs the blocks INSIDE it again and again, a set number of times."},
          {em:"🧩",name:"The block budget",txt:"The 🧩 counter shows blocks used / allowed. A loop is how you do a lot of work with few blocks."}],
   steps:["Add a 🔁 Repeat block and set its number to 5.",
          "Drag ⬆️ Move and 🪓 Chop INSIDE the loop — blocks inside are indented.",
          "5 trees, 3 blocks. That is the whole idea of a loop."]},
  {id:"t_if",tut:true,em:"❓",name:"Smart Chopper",diff:3,coins:0,xp:40,maxBlocks:6,gw:6,gh:3,
   allowed:["move","turnL","turnR","chop","repeat","if"],start:{x:0,y:1,dir:1},trees:[[1,1],[3,1],[5,1]],goalType:"chop",
   desc:"Trees are scattered with gaps. 🔁 Repeat: ❓ If 🌳 tree ahead → 🪓 Chop, then ⬆️ Move. The robot decides for itself!",
   teach:[{em:"❓",name:"If",txt:"Asks a question RIGHT NOW, and only runs the blocks inside when the answer is yes."}],
   steps:["Put a 🔁 Repeat around everything so the robot walks the whole row.",
          "Inside it, add ❓ If and set the question to “🌳 tree ahead”.",
          "Put 🪓 Chop INSIDE the If, and ⬆️ Move after it — so it only chops when there is something to chop."]},

  /* ---- Lessons 7-11: the half nobody had been taught. The first six get a
     player moving; these are the ones that turn moving into programming. ---- */

  {id:"t_while",tut:true,em:"🔄",name:"Until It's Done",diff:3,coins:0,xp:45,maxBlocks:4,gw:13,gh:3,
   allowed:["move","turnL","turnR","chop","repeat","whileLoop","if"],start:{x:0,y:1,dir:1},
   trees:[[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[7,1],[8,1],[9,1],[10,1],[11,1]],goalType:"chop",
   desc:"A whole forest — and you get 4 blocks. 🔄 While 🌳 tree ahead → 🪓 Chop, ⬆️ Move. It keeps going until the trees run out, so you never have to count them.",
   teach:[{em:"🔄",name:"While",txt:"A loop that asks a question before EVERY turn, and keeps looping while the answer stays yes."},
          {em:"🔁",name:"Repeat vs While",txt:"🔁 Repeat needs a number: “do this 5 times”. 🔄 While needs a question: “keep going until there are none left”."}],
   steps:["Count the trees if you like — then don't. You won't need the number.",
          "Add a 🔄 While block and set its question to “🌳 tree ahead”.",
          "Inside it put 🪓 Chop then ⬆️ Move.",
          "Run it. The same 3 blocks would clear 5 trees or 500."]},

  {id:"t_var",tut:true,em:"🔢",name:"Keep Count",diff:3,coins:0,xp:50,maxBlocks:7,gw:8,gh:3,
   allowed:["move","turnL","turnR","chop","repeat","whileLoop","if","setVar","changeVar","say"],
   start:{x:0,y:1,dir:1},initial:[[1,1],[3,1],[4,1],[6,1]],goalType:"answer",expect:4,
   question:"How many 🧱 blocks are in the row?",
   desc:"Walk the row and count the 🧱 blocks, then 💬 Say the answer. The robot has to work it out — you can't just look and type the number.",
   teach:[{em:"🔢",name:"Set variable",txt:"Makes a named box to remember a number. Start your counter at 0."},
          {em:"➕",name:"Change by",txt:"Adds to the box. Add 1 each time you find a block."},
          {em:"💬",name:"Say",txt:"Tells us the answer. The level checks what the robot says."}],
   steps:["🔢 Set a variable — call it count — to 0.",
          "🔁 Repeat 8 times: ❓ If 🧱 block here → ➕ Change count by 1, then ⬆️ Move.",
          "After the loop, 💬 Say count."]},

  {id:"t_func",tut:true,em:"🔧",name:"Name the Job",diff:4,coins:0,xp:60,maxBlocks:13,gw:12,gh:3,
   allowed:["move","turnL","turnR","chop","build","repeat","whileLoop","if","setVar","changeVar","say","call"],
   start:{x:0,y:1,dir:1},cells:[[0,1],[2,1],[5,1],[7,1],[9,1],[11,1]],
   desc:"Three pairs of 🧱 blocks, spaced unevenly — so one 🔁 Repeat can't do it. Teach the robot the little job ONCE inside 🔧 A, then call it three times.",
   teach:[{em:"🔧",name:"Function (A)",txt:"A job you write once and give a name. Tap the 🔧 A tab to write inside it."},
          {em:"🔧",name:"Call",txt:"Runs the job. Calling A three times costs 3 blocks — writing it out three times costs a lot more."},
          {em:"🧩",name:"Why it's cheaper",txt:"The blocks inside 🔧 A are counted ONCE, however many times you call it. That's the whole point of a function."}],
   steps:["Tap the 🔧 A tab at the top of the Blocks screen.",
          "Inside A, write the little job: 🧱 Build, ⬆️ Move, ⬆️ Move, 🧱 Build.",
          "Go back to 🧩 Main and add 🔧 Call, set to A.",
          "Add ⬆️ Move blocks to walk to the next pair, then 🔧 Call A again — three times in all.",
          "Writing the job out three times needs 17 blocks. You only have 13."]},

  {id:"t_algo",tut:true,em:"🧠",name:"One Program, Any Row",diff:5,coins:0,xp:80,maxBlocks:8,gw:8,gh:3,
   allowed:["move","turnL","turnR","chop","build","repeat","whileLoop","if","setVar","changeVar","say","call"],
   start:{x:0,y:1,dir:1},initial:[[1,1],[3,1],[4,1],[6,1]],goalType:"answer",expect:4,
   question:"How many 🧱 blocks are in the row?",
   cases:[{initial:[[1,1],[3,1],[4,1],[6,1]],expect:4},
          {initial:[[0,1],[1,1],[2,1]],expect:3},
          {initial:[[5,1]],expect:1},
          {initial:[],expect:0}],
   desc:"The same counting job — but now on FOUR different rows, and your one program has to get all four right. Guessing the number works for one row and fails the rest.",
   teach:[{em:"🧠",name:"Algorithm",txt:"A set of steps that works for every case, not just the one in front of you. This is the real thing programmers write."},
          {em:"🔢",name:"Try the lazy way first",txt:"💬 Say 4 passes the first row and fails the other three. That failure IS the lesson."}],
   steps:["Look at the row of inputs at the top — your program runs once for each.",
          "Write the counting program from the last lesson: count = 0, walk the row, add 1 for each 🧱, then 💬 Say count.",
          "Press ▶. It has to pass all four rows to win.",
          "Nothing about your program mentions 4, or 3, or 1 — that's what makes it an algorithm."]},
];
for(const t of TUTS)if(!t.cells)t.cells=[]; // engine expects a (possibly empty) blueprint list
/* The first six lessons are the ones that must be finished before the open
   world makes any sense: move, turn, chop, collect, loop, if. The last four —
   while, variables, functions, algorithms — are what a player needs to write
   anything REAL, but gating the whole game behind them would keep a seven year
   old on a tutorial board for an hour. So graduation, and the Journey's first
   step, still mean the core six; the advanced four sit open next to them. */
const ACADEMY_CORE=6;
function academyIndex(id){return TUTS.findIndex(t=>t.id===id);}
function academyDoneCount(){player.academy=player.academy||{};return TUTS.filter(t=>player.academy[t.id]).length;}
function academyCoreDone(){player.academy=player.academy||{};return TUTS.slice(0,ACADEMY_CORE).filter(t=>player.academy[t.id]).length;}
function academyComplete(){return academyCoreDone()>=ACADEMY_CORE;}   // graduated to the world
function academyAllDone(){return academyDoneCount()>=TUTS.length;}    // finished every lesson
// enter a stage by index (fresh clone — mgEnter reads start/cells and the engine mutates robot state)
function academyEnter(i){
  if(i<0||i>=TUTS.length)return;
  mgEnter(JSON.parse(JSON.stringify(TUTS[i])));
}
// jump to the first stage the player hasn't cleared yet (or the first, on replay)
function academyStart(){
  player.academy=player.academy||{};
  let i=TUTS.findIndex(t=>!player.academy[t.id]);
  if(i<0)i=0;
  academyEnter(i);
}
// called from mgSuccess when a tutorial stage is solved: record it, celebrate,
// then auto-advance to the next lesson (or graduate to the open world)
function academySolved(proj){
  player.academy=player.academy||{};
  const first=!player.academy[proj.id];
  player.academy[proj.id]=1;
  if(first&&proj.xp)addXP(proj.xp);
  confetti();sfx(760,.08);sfx(1040,.09,.09);
  const i=academyIndex(proj.id), next=TUTS[i+1];
  saveNow();
  // Finishing lesson 6 is graduation: the world opens. The advanced four are
  // offered rather than imposed — a player who wants to go and play should not
  // have to sit through functions first, and one who wants them knows they exist.
  if(i===ACADEMY_CORE-1){
    if(window.CC_EXTRAS)CC_EXTRAS.celebrate("🎓","ACADEMY COMPLETE!","The world is yours!",
      "You've learned moving, turning, chopping, collecting, loops and conditions. "+
      "Four harder lessons are waiting whenever you want them — 🔄 While, 🔢 Variables, "+
      "🔧 Functions and 🧠 Algorithms are how you build things that think.","Let's play! 🎉");
    else bigToast("🎓 Academy complete — the world is yours! Four advanced lessons are waiting.");
    academyExitToWorld();
    return;
  }
  if(next){
    bigToast("✅ "+proj.name+" done!  Next: "+next.em+" "+next.name);
    setTimeout(()=>{ if(mgState)academyEnter(i+1); },700);
  }else{
    if(window.CC_EXTRAS)CC_EXTRAS.celebrate("🧠","EVERY LESSON DONE!","You can write real programs now",
      "Loops, conditions, variables, functions and algorithms — that is genuinely what programming is. "+
      "Go and build something nobody has built yet.","Onwards! 🚀");
    else bigToast("🧠 Every lesson done — you can write real programs now!");
    academyExitToWorld();
  }
}
// leave the academy straight back to the open world (not the Projects sheet)
function academyExitToWorld(){
  if(mgState)mgExit(false);
  $("editor").classList.remove("open","max");
  setTab("blocks");
}
// a cohesive "🎓 Academy" section for the Projects sheet — uses the same compact
// ccCard as Build Projects / My Challenges, plus a lesson track inside the card.
function renderAcademySection(el){
  const done=academyDoneCount(), total=TUTS.length, all=done>=total;
  const core=academyCoreDone(), grad=academyComplete();
  const nextI=TUTS.findIndex(t=>!player.academy||!player.academy[t.id]);
  const h=document.createElement("h4");h.className="qsec";
  h.textContent="🎓 Academy — learn the basics";
  el.appendChild(h);
  // no `hot` here — .acad-card's purple glow is the Academy's own marker, and
  // .pcard.hot would out-specify it and repaint the border amber
  const card=ccCard(el,{em:all?"🏆":"🎓",name:"Starter Academy",cls:"acad-card",done:all,
    meta:'<i>'+done+'/'+total+' done</i>'+(grad?" · 🎓 graduated":" · basics "+core+"/"+ACADEMY_CORE)
      +(all?"":" · next: "+TUTS[nextI].em+" "+esc(TUTS[nextI].name)),
    desc:all
      ? "Every lesson done — loops, conditions, variables, functions and algorithms. Replay any of them any time."
      : grad
        ? "You've graduated. The last four lessons are the ones that turn moving a robot into programming: 🔄 While, 🔢 Variables, 🔧 Functions and 🧠 Algorithms."
        : "Six quick lessons take you from your first Move to loops &amp; conditions — then four more teach variables, functions and algorithms.",
    badge:all?"🔁":"▶",
    onTap:()=>{$("projects").classList.remove("open");academyStart();}});
  // The lesson track lives under the text — and every dot is a door: tap one to
  // jump straight to that lesson instead of being marched through in order.
  const tr=document.createElement("div");tr.className="acad-track";
  TUTS.forEach((t,i)=>{
    const st=player.academy&&player.academy[t.id]?"done":(i===nextI?"now":"soon");
    const d=document.createElement("span");
    d.className="acad-dot tapp "+st+(i>=ACADEMY_CORE?" adv":"");
    d.title=t.name+" — Lesson "+(i+1)+(i>=ACADEMY_CORE?" (advanced)":"");
    d.textContent=t.em;
    d.addEventListener("click",e=>{e.stopPropagation();$("projects").classList.remove("open");academyEnter(i);});
    tr.appendChild(d);
  });
  card.querySelector(".pmain").appendChild(tr);
}

/* ---------------- the lesson card ----------------
   The first six lessons told a player WHAT to do in one line and never said
   what any block actually was. That is fine for ⬆️ Move and useless by the
   time you reach 🔧 functions, which is exactly where players were getting
   stuck. Every lesson now carries two extra things:

     teach[] — what each NEW block is, in one sentence each
     steps[] — the actual moves to make, in order

   It opens with the lesson and folds away; ❓ brings it back, because the
   explanation you need is rarely the one you needed thirty seconds ago. */
function renderLessonCard(proj){
  const el=$("mgLesson"); if(!el)return;
  if(!proj||!proj.tut||(!proj.teach&&!proj.steps)){el.innerHTML="";el.style.display="none";return;}
  el.style.display="";
  const i=academyIndex(proj.id);
  const teach=(proj.teach||[]).map(t=>
    '<div class="ls-block"><span class="ls-em">'+t.em+'</span>'+
      '<span><b>'+esc(t.name)+'</b> — '+esc(t.txt)+'</span></div>').join("");
  const steps=(proj.steps||[]).map((t,n)=>
    '<li><span class="ls-n">'+(n+1)+'</span><span>'+esc(t)+'</span></li>').join("");
  el.innerHTML=
    '<div class="ls-head"><span class="ls-badge">Lesson '+(i+1)+' of '+TUTS.length+'</span>'+
      '<button class="ls-x" id="lsClose" title="Hide">✕</button></div>'+
    (teach?'<div class="ls-sec">🧩 What these blocks do</div>'+teach:"")+
    (steps?'<div class="ls-sec">👣 What to do</div><ol class="ls-steps">'+steps+'</ol>':"");
  const x=$("lsClose");
  if(x)x.addEventListener("click",()=>{el.classList.add("hid");lessonBtn(true);});
}
/* the ❓ that brings the card back, parked next to the board hint */
function lessonBtn(show){
  let b=$("lsShow");
  if(!show){if(b)b.remove();return;}
  if(b)return;
  b=document.createElement("button");
  b.id="lsShow";b.className="ls-show";b.textContent="❓ How do I do this?";
  b.addEventListener("click",()=>{$("mgLesson").classList.remove("hid");b.remove();});
  const hint=$("mgBoardHint");
  if(hint&&hint.parentNode)hint.parentNode.insertBefore(b,hint);
}
