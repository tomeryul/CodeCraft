"use strict";
/* ---------------- 📘 Design Guide: how to make a challenge worth solving ----------------
   The creator hands you a blank grid and a box of tools, which is exactly the
   moment people freeze — "what do I even build?". So this is two things in one
   sheet: six short rules for designing a level, and five ready boards you can
   drop straight onto the canvas and then make your own.

   The rules are the ones the built-in campaign was designed with, written for a
   child: one idea per level, the block budget IS the difficulty dial, make the
   robot LOOK instead of remember, and — the one that separates a puzzle from an
   algorithm question — the shuffle test: move something and run the SAME program
   again. Every recipe below is verified solvable by the test suite. */

const GUIDE_RULES=[
  {t:"Say it in one sentence",
   d:'Before you paint anything, finish this: "the robot has to ___". Like <b>"fetch the key, then open the door"</b>, or <b>"fill every tile in the row"</b>. If it takes you two sentences, you have two levels — and that is good news, see rule 5.'},
  {t:"One idea per level",
   d:'A 🧱 wall in the way teaches turning. A long row of targets teaches 🔁 Repeat. Gaps in the row teach ❓ If. Numbered 🔢 blocks teach comparing. Pick <b>one</b> and build the whole board around it. Two new ideas at once and nobody finishes.'},
  {t:"The block budget is your difficulty dial",
   d:'🧩 is the strongest tool in the creator. Solve your own level first, count the blocks you used, then set the budget to <b>that exact number</b>. A generous budget lets the player paste "move, build" twenty times. A tight one forces them to find the pattern — which was the whole point.'},
  {t:"Make the robot look, not remember",
   d:'A great level makes the robot <b>check</b> something it could not know in advance: ❓ If 🧱 wall ahead, ❓ If 🎯 on a target, 📖 Read the number under me. A level with nothing to check can only be walked from memory.'},
  {t:"Build a ladder, not a wall",
   d:'Use ➕ Add level. Level 1 shows the trick with two blocks. Level 2 makes them use it twice. Level 4 makes it the only way through. Four small levels beat one giant one — and your player actually finishes them.'},
  {t:"Prove it, then try to break it",
   d:'▶ until it is solved — the game will not let you 💾 Save a level you have not solved yourself. Then change <b>one</b> thing (move a block, move the start) and run the same program again. What happens next is rule number seven…'},
];

const GUIDE_RECIPES=[
  {id:"detour",em:"🧱",name:"The Detour",teaches:"turning",
   blurb:"A wall sits between the robot and its target. The only way is around — the smallest level that makes ↪️ Turn matter.",
   gw:6,gh:4,max:12,start:{x:0,y:2,dir:1},
   cells:[[5,2]],initial:[],
   tiles:[[3,2,"wall",0],[3,3,"wall",0]]},

  {id:"row",em:"🔁",name:"The Long Row",teaches:"🔁 Repeat",
   blurb:"Eight targets in a straight line, and a budget of 4 blocks. You cannot paste your way out — the player has to find the loop.",
   gw:8,gh:3,max:4,start:{x:0,y:1,dir:1},
   cells:[[0,1],[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[7,1]],initial:[],tiles:[]},

  {id:"gaps",em:"❓",name:"Only Where It Counts",teaches:"❓ If",
   blurb:"Same row — but now the targets have gaps. Building everywhere fails, so the robot must ask ❓ If 🎯 on a target before it drops a brick.",
   gw:8,gh:3,max:5,start:{x:0,y:1,dir:1},
   cells:[[1,1],[3,1],[4,1],[6,1]],initial:[],tiles:[]},

  {id:"bridge",em:"🕳️",name:"Bridge the Gap",teaches:"✊ Lift & ⤵️ Drop",
   blurb:"Two pits block the corridor. The robot has to make a brick, carry it, and drop it into the hole to walk across its own bridge.",
   gw:6,gh:3,max:14,start:{x:0,y:1,dir:1},
   cells:[[5,1]],initial:[],
   tiles:[[2,1,"pit",0],[4,1,"pit",0]]},

  {id:"sort",em:"🔢",name:"Line Them Up",teaches:"📖 Read & comparing",
   blurb:"Three numbered blocks in the wrong order, and a free row above to use as scratch space. This is the one that can become a real algorithm question — run the shuffle test on it.",
   gw:4,gh:2,max:30,start:{x:0,y:1,dir:1},
   cells:[[0,1],[1,1],[2,1]],
   initial:[[0,1,3],[1,1,1],[2,1,2]],tiles:[]},
];

function guideRecipe(id){return GUIDE_RECIPES.find(r=>r.id===id)||null;}

// Drop a recipe onto the creator canvas. Opening the guide from the Projects
// sheet means there is no creator session yet, so start one first.
function guideApply(r){
  if(!r)return;
  if(!mgState||!mgState.creator){
    mgEnterCreator();
  }else if((mgState.proj.cells||[]).length||(mgState.proj.initial||[]).length||(mgState.proj.tiles||[]).length){
    if(!confirm("Replace the board you're working on with “"+r.name+"”?"))return;
  }
  const p=mgState.proj;
  p.name=r.name;p.gw=r.gw;p.gh=r.gh;p.maxBlocks=r.max;
  // the board should say what it is — the generic "Design mode — pick a tool…"
  // blurb tells the author nothing about the level they just loaded
  p.desc=r.blurb+"  ✏️ It's yours now: change anything, then press ▶ to prove it.";
  p.start=JSON.parse(JSON.stringify(r.start));
  p.cells=JSON.parse(JSON.stringify(r.cells||[]));
  p.initial=JSON.parse(JSON.stringify(r.initial||[]));
  p.tiles=JSON.parse(JSON.stringify(r.tiles||[]));
  mgState.robot={x:p.start.x,y:p.start.y,dir:p.start.dir};mgSeed(mgState.robot,p);
  mgState.solved=false;      // a new board is an unproven board
  mgState.caseBase=null;
  if(mgRobot){mgRobot.program=[];mgRobot.routines={A:[],B:[]};mgRobot.hist=[];mgRobot.redoS=[];}
  edTarget="main";
  closeGuide();
  $("mgGoal").textContent=p.desc;
  renderPalette();renderProgram();renderPy();updateUndoBtns();mgUpdateCount();
  mgCreatorUI();mgDraw();setTab("board");
  toast("🛠️ “"+r.name+"” is on the board — solve it first, then make it yours!");
}

function renderGuide(){
  const el=$("guideBody");if(!el)return;
  el.innerHTML="";
  const sec=txt=>{const h=document.createElement("h4");h.className="qsec";h.textContent=txt;el.appendChild(h);return h;};
  sec("📏 Six rules for a level people finish");
  GUIDE_RULES.forEach((r,i)=>{
    const d=document.createElement("div");d.className="grule";
    d.innerHTML='<span class="gnum">'+(i+1)+'</span><div><b>'+r.t+'</b><p>'+r.d+'</p></div>';
    el.appendChild(d);
  });
  sec("🧠 When is it an algorithm question?");
  const n=document.createElement("div");n.className="gnote";
  n.innerHTML='A <b>path</b> is directions you memorised. An <b>algorithm</b> still works after the board changes — that is the whole difference.'+
    '<br><br>So run the <b>shuffle test</b>: solve your level, then move the 🔢 blocks around (or move the robot\'s start) and press ▶ again with the <b>same program, unchanged</b>.'+
    '<br><br>✅ <b>Still solves it?</b> You wrote an algorithm. That is a question worth publishing.'+
    '<br>❌ <b>Breaks?</b> Your player will just memorise the answer. Give the robot a way to look at the board instead of a route to follow: 📖 Read, ❓ If, 🔄 While.'+
    '<br><br>The built-in 🧠 <b>Algorithms</b> chapter is made entirely of questions that pass this test — play it when you want ideas.';
  el.appendChild(n);
  sec("🔢 Make the game run the shuffle test for you");
  const m=document.createElement("div");m.className="gnote alt";
  m.innerHTML='You do not have to shuffle by hand. Open ⚙️ and use <b>🔢 Add this board as an input</b>:'+
    '<br><br><b>1.</b> Lay out your numbered blocks and add them as input 1.'+
    '<br><b>2.</b> Move the blocks, add them again as input 2. Up to eight.'+
    '<br><b>3.</b> Write <b>one</b> program and press ▶. It runs against <b>every</b> input, and you only prove the level — and only unlock 💾 Save — if all of them pass.'+
    '<br><br>Then tap 👁 on your last input to make it <b>🙈 secret</b>. A hidden input is never shown to the player, so they cannot study it while writing. Guessing stops working; only a real algorithm gets through.'+
    '<br><br>And if your question needs a building block that is not the point of the puzzle — a swap, a step, a turn-around — write it in routine 🔧 A and switch on <b>🎁 Starter routines</b>. Players open the challenge with your routine already written, so they spend their thinking on the algorithm instead of rebuilding your tools.';
  el.appendChild(m);
  sec("🍳 Start from a board");
  const p=document.createElement("div");p.className="gsub";
  p.textContent="Tap one and it lands on your canvas. Solve it, then change it until it is yours.";
  el.appendChild(p);
  for(const r of GUIDE_RECIPES){
    ccCard(el,{em:r.em,name:r.name,badge:"🛠️",
      meta:'<i>teaches '+r.teaches+'</i> · '+r.gw+'×'+r.gh+' · 🧩 '+r.max,
      desc:r.blurb,
      onTap:()=>guideApply(r)});
  }
}
function openGuide(){renderGuide();$("guide").classList.add("open");}
function closeGuide(){$("guide").classList.remove("open");}
