"use strict";
/* ---------------- puzzle chapters ----------------
   A hand-built campaign that teaches each puzzle mechanic in turn. Pure data:
   every chapter is a multi-level pack, so it rides the machinery that already
   exists (packEnter / packStageSolved / player.projects["pack_<id>"]).

   Each level carries `sol` — a program that actually solves it. It is NEVER
   loaded when playing (players write their own); it exists so the smoke suite
   can run every level and prove the campaign is solvable. If a level is ever
   edited into an unsolvable state, the test fails instead of a child getting
   stuck on it.

   Directions: 0=N 1=E 2=S 3=W (DX/DY in constants.js). */
const CH_MOVE=["move","turnL","turnR","repeat","forever","if"];
const CH_CARRY=["move","turnL","turnR","pickUp","drop","repeat","forever","if"];
const CH_BUILD=["move","turnL","turnR","pickUp","drop","build","repeat","forever","if"];
// the algorithm toolbox: everything needed to inspect data and act on it
const CH_ALGO=["move","turnL","turnR","pickUp","drop","repeat","forever","whileLoop",
               "countLoop","if","setVar","changeVar","read","say","call"];
// terse level builders so the data below stays readable
const mv={t:"move"},tL={t:"turnL"},tR={t:"turnR"},pk={t:"pickUp"},dr={t:"drop"},bd={t:"build"};
const rep=(n,body)=>({t:"repeat",n,body});
const rd=(name,src)=>({t:"read",name,src:src||"here"});
const setN=(name,n)=>({t:"setVar",name,val:{k:"num",n}});
const setV=(name,from)=>({t:"setVar",name,val:{k:"var",name:from}});
const addN=(name,n)=>({t:"changeVar",name,n});
const addV=(name,from)=>({t:"changeVar",name,n:{k:"var",name:from}});
const sayV=name=>({t:"say",val:{k:"var",name}});
const whil=(cond,body)=>({t:"whileLoop",cond,body});
const iff=(cond,body,els)=>({t:"if",cond,body,els:els||[]});
const cmpV=(v,op,other)=>({var:v,op,val:{k:"var",name:other}});
const cmpN=(v,op,n)=>({var:v,op,val:n});
// a row of numbers laid along y=1 starting at x=0 (row y=0 stays free as scratch)
const row=ns=>ns.map((n,i)=>[i,1,n]);
// the same numbers as NUMBERED target cells in sorted order — "this row, in order"
const sortedRow=ns=>ns.slice().sort((a,b)=>a-b).map((n,i)=>[i,1,n]);
// n UNNUMBERED blocks along y=1, and n plain targets on the row above. Numbers are
// deliberately absent: a numbered `initial` with plain `cells` makes the engine derive
// a SORTING goal (mgSortGoalOrder), and this level only asks for them to be carried.
const plainRow=n=>Array.from({length:n},(_,i)=>[i,1]);
const aboveN=n=>Array.from({length:n},(_,i)=>[i,0]);
/* Swap the block under the robot with the one in front of it, using the free row
   above as a parking space, and come back facing the same way one step along.
   Traced by hand and verified by the suite: park A above, fetch B, place B, fetch
   A from above, place A. 21 blocks — which is exactly why it wants to be a
   routine rather than something you retype for every comparison. */
const SWAP=[pk,tL,mv,dr,tR,mv,tR,mv,pk,tR,mv,dr,tR,mv,pk,tR,mv,tR,mv,dr,tL];
// carry the block under the robot up to the row above, then step along
const LIFT_UP=[pk,tL,mv,dr,tR,mv,tR,mv,tL];

const PUZZLE_PACKS=[
  /* ---------- 1. walls: there is now something to walk around ---------- */
  {id:"maze",em:"🧱",name:"Labyrinth",diff:1,coins:150,xp:70,needs:null,
   desc:"Walls block the way. Teach your robot to find a way around them.",
   stages:[
    {em:"🧱",name:"First Wall",diff:1,maxBlocks:12,gw:5,gh:3,allowed:CH_MOVE,
     start:{x:0,y:1,dir:1},tiles:[[2,1,"wall",0]],cells:[],initial:[],
     goal:[4,1],goalType:"reach",
     desc:"A wall sits between you and the 🚩. Step around it: up, across, and back down.",
     sol:[mv,tL,mv,tR,mv,mv,tR,mv,tL,mv]},
    {em:"🧱",name:"The Long Corridor",diff:1,maxBlocks:6,gw:6,gh:3,allowed:CH_MOVE,
     start:{x:0,y:0,dir:1},tiles:[[1,1,"wall",0],[2,1,"wall",0],[3,1,"wall",0],[4,1,"wall",0]],
     cells:[],initial:[],goal:[5,2],goalType:"reach",
     desc:"A long wall — but only 6 blocks. Put ⬆️ Move inside a 🔁 Repeat and let the loop do the walking.",
     sol:[rep(5,[mv]),tR,mv,mv]},
    {em:"🧱",name:"Zigzag",diff:2,maxBlocks:12,gw:8,gh:3,allowed:CH_MOVE,
     start:{x:0,y:1,dir:1},tiles:[[2,1,"wall",0],[5,1,"wall",0]],cells:[],initial:[],
     goal:[7,1],goalType:"reach",
     desc:"Two walls, and the SAME dodge works for both. Find the pattern, then 🔁 Repeat it twice.",
     sol:[mv,rep(2,[tL,mv,tR,mv,mv,tR,mv,tL,mv])]},
    {em:"🧱",name:"Feel Your Way",diff:3,maxBlocks:5,gw:5,gh:5,allowed:CH_MOVE,
     start:{x:0,y:0,dir:1},
     tiles:[[1,1,"wall",0],[2,1,"wall",0],[3,1,"wall",0],[1,2,"wall",0],[2,2,"wall",0],
            [3,2,"wall",0],[1,3,"wall",0],[2,3,"wall",0],[3,3,"wall",0]],
     cells:[],initial:[],goal:[0,4],goalType:"reach",
     desc:"Only 5 blocks! Don't count steps — let the robot FEEL: ♾️ Forever ❓ If 🚧 blocked → ↪️ Turn, else ⬆️ Move.",
     sol:[{t:"forever",body:[{t:"if",cond:"blocked",body:[tR],els:[mv]}]}]},
   ]},

  /* ---------- 2. pits: the robot builds its own bridge ---------- */
  {id:"gap",em:"🕳️",name:"Mind the Gap",diff:2,coins:220,xp:110,needs:"maze",
   desc:"Pits can't be crossed — unless the robot drops a block into one first.",
   stages:[
    {em:"🕳️",name:"Bridge It",diff:1,maxBlocks:8,gw:5,gh:3,allowed:CH_CARRY,
     start:{x:0,y:1,dir:1},tiles:[[2,1,"pit",0]],cells:[],initial:[[1,1]],
     goal:[4,1],goalType:"reach",
     desc:"A hole in the ground! ✊ Lift the block, face the hole and ⤵️ Drop it IN — now you can walk over it.",
     sol:[mv,pk,dr,mv,mv,mv]},
    {em:"🕳️",name:"Two Holes",diff:2,maxBlocks:6,gw:5,gh:3,allowed:CH_CARRY,
     start:{x:0,y:1,dir:1},tiles:[[1,1,"pit",0],[3,1,"pit",0]],cells:[],initial:[[0,1],[2,1]],
     goal:[4,1],goalType:"reach",
     desc:"Two holes, two blocks — and the same four steps each time. One 🔁 Repeat does it all.",
     sol:[rep(2,[pk,dr,mv,mv])]},
    {em:"🕳️",name:"Carry It Further",diff:2,maxBlocks:9,gw:6,gh:3,allowed:CH_CARRY,
     start:{x:0,y:1,dir:1},tiles:[[4,1,"pit",0]],cells:[],initial:[[1,1]],
     goal:[5,1],goalType:"reach",
     desc:"The block is nowhere near the hole. Pick it up and CARRY it — the robot keeps holding it while it walks.",
     sol:[mv,pk,mv,mv,dr,mv,mv]},
    {em:"🕳️",name:"Bridge, Then Build",diff:3,maxBlocks:11,gw:6,gh:3,allowed:CH_BUILD,
     start:{x:0,y:1,dir:1},tiles:[[2,1,"pit",0]],cells:[[4,1],[5,1]],initial:[[1,1]],
     desc:"Cross the hole, then lay the last two tiles of the plan with 🔨 Build. The bridge block doesn't count against you.",
     sol:[mv,pk,dr,mv,mv,mv,bd,mv,bd]},
   ]},

  /* ---------- 3. keys, doors, portals: state and order ---------- */
  {id:"keys",em:"🔑",name:"Locked Vault",diff:2,coins:300,xp:150,needs:"gap",
   desc:"Doors stay shut until the robot is carrying a key of the same colour.",
   stages:[
    {em:"🔑",name:"One Key, One Door",diff:1,maxBlocks:4,gw:6,gh:3,allowed:CH_MOVE,
     start:{x:0,y:1,dir:1},tiles:[[1,1,"key",1],[3,1,"door",1]],cells:[],initial:[],
     goal:[5,1],goalType:"reach",
     desc:"Walk over the 🔑 to pick it up, and the 🚪 of the same colour opens for you. Just 4 blocks.",
     sol:[rep(5,[mv])]},
    {em:"🔑",name:"The Key Is Elsewhere",diff:2,maxBlocks:13,gw:6,gh:3,allowed:CH_MOVE,
     start:{x:0,y:1,dir:1},tiles:[[2,1,"door",1],[1,0,"key",1]],cells:[],initial:[],
     goal:[5,1],goalType:"reach",
     desc:"The 🚪 is straight ahead but the 🔑 isn't. Go and fetch it FIRST, then come back.",
     sol:[tL,mv,tR,mv,tR,mv,tL,mv,mv,mv,mv]},
    {em:"🔑",name:"Two Colours",diff:3,maxBlocks:14,gw:7,gh:3,allowed:CH_MOVE,
     start:{x:0,y:1,dir:1},
     tiles:[[1,1,"key",1],[1,0,"key",2],[2,1,"door",1],[4,1,"door",2]],cells:[],initial:[],
     goal:[6,1],goalType:"reach",
     desc:"Two doors, two colours. Collect BOTH keys before you set off — the robot keeps every key it finds.",
     sol:[mv,tL,mv,tR,tR,mv,tL,mv,mv,mv,mv,mv]},
    {em:"🌀",name:"Portal Vault",diff:2,maxBlocks:5,gw:7,gh:3,allowed:CH_MOVE,
     start:{x:0,y:1,dir:1},
     tiles:[[2,0,"wall",0],[2,1,"wall",0],[2,2,"wall",0],[1,1,"portal",1],[3,1,"portal",1]],
     cells:[],initial:[],goal:[6,1],goalType:"reach",
     desc:"A wall with no way round it — but two 🌀 portals of the same colour are a pair. Step on one, come out the other.",
     sol:[rep(4,[mv])]},
   ]},

  /* ---------- 4. plates, gates, one-way tiles ---------- */
  {id:"machine",em:"🔘",name:"The Machine",diff:3,coins:400,xp:200,needs:"keys",
   desc:"Gates open while their plates are held down — by the robot, or by a block it leaves behind.",
   stages:[
    {em:"🔘",name:"Leave It Behind",diff:2,maxBlocks:8,gw:5,gh:3,allowed:CH_CARRY,
     start:{x:0,y:1,dir:1},tiles:[[1,1,"plate",1],[2,1,"gate",1]],cells:[],initial:[[0,1]],
     goal:[4,1],goalType:"reach",
     desc:"The 🚧 gate opens while its 🔘 plate is pressed — but you can't stand on the plate AND walk through. Leave a block on it instead.",
     sol:[pk,mv,dr,mv,mv,mv]},
    {em:"➡️",name:"One Way Only",diff:2,maxBlocks:8,gw:5,gh:4,allowed:CH_MOVE,
     start:{x:0,y:0,dir:1},tiles:[[2,0,"arrow",2]],cells:[],initial:[],
     goal:[2,3],goalType:"reach",
     desc:"A ➡️ one-way tile only lets you leave the way it points. Step on it, then turn to face that way.",
     sol:[mv,mv,tR,mv,mv,mv]},
    {em:"🔘",name:"Locked Machine",diff:3,maxBlocks:10,gw:7,gh:3,allowed:CH_CARRY,
     start:{x:0,y:1,dir:1},
     tiles:[[1,1,"key",1],[2,1,"door",1],[3,1,"plate",2],[4,1,"gate",2]],
     cells:[],initial:[[0,1]],goal:[6,1],goalType:"reach",
     desc:"A door AND a gate. Take the block with you from the very start — you'll need it on the plate later.",
     sol:[pk,mv,mv,mv,dr,mv,mv,mv]},
    {em:"🏆",name:"The Full Machine",diff:3,maxBlocks:10,gw:7,gh:3,allowed:CH_CARRY,
     start:{x:0,y:1,dir:1},
     tiles:[[1,1,"pit",0],[2,0,"wall",0],[2,2,"wall",0],[3,1,"key",1],[4,1,"door",1]],
     cells:[],initial:[[0,1]],goal:[6,1],goalType:"reach",
     desc:"Everything at once: bridge the hole, squeeze through the gap, grab the key, open the door. You've learned all of it.",
     sol:[pk,dr,rep(6,[mv])]},
   ]},

  /* ---------- 5. algorithms: one program, every input ----------
     These are the levels the whole language work was for. Each ships several
     inputs, so a hardcoded answer cannot pass — the program has to READ the row,
     decide, and be right every time. */
  {id:"algo",em:"🧠",name:"Algorithms",diff:3,coins:500,xp:260,needs:"machine",
   desc:"Now the real thing: write ONE program that is right for every row we give it — including one you never see.",
   stages:[
    {em:"🔍",name:"Find the Biggest",diff:2,maxBlocks:10,gw:6,gh:2,allowed:CH_ALGO,
     start:{x:0,y:1,dir:1},cells:[],initial:[],tiles:[],
     goalType:"answer",question:"What is the biggest number in the row?",
     desc:"Walk the row, remember the biggest number you've seen, and 💬 Say it at the end. The rows are different every time — so no guessing.",
     cases:[{initial:row([3,7,2]),expect:7},{initial:row([9,1,4]),expect:9},
            {initial:row([2,5,8,6]),expect:8},{initial:row([4,4,1]),expect:4,hidden:true}],
     sol:[rd("best"),whil("brickHere",[rd("v"),iff(cmpV("v",">","best"),[setV("best","v")]),mv]),sayV("best")]},

    {em:"➕",name:"Add Up the Row",diff:2,maxBlocks:9,gw:6,gh:2,allowed:CH_ALGO,
     start:{x:0,y:1,dir:1},cells:[],initial:[],tiles:[],
     goalType:"answer",question:"What do all the numbers add up to?",
     desc:"Keep a running total: start at 0, and for every block you stand on, ➕ Change the total BY the number you just read.",
     cases:[{initial:row([1,2,3]),expect:6},{initial:row([5,5]),expect:10},
            {initial:row([2,4,6,8]),expect:20},{initial:row([7,3,1,9]),expect:20,hidden:true}],
     sol:[setN("s",0),whil("brickHere",[rd("v"),addV("s","v"),mv]),sayV("s")]},

    {em:"🔢",name:"Count the Big Ones",diff:2,maxBlocks:10,gw:6,gh:2,allowed:CH_ALGO,
     start:{x:0,y:1,dir:1},cells:[],initial:[],tiles:[],
     goalType:"answer",question:"How many numbers are bigger than 4?",
     desc:"Same walk, but this time only count the blocks that pass a test. Counting IF something is true is one of the most useful things a program does.",
     cases:[{initial:row([3,7,2,9]),expect:2},{initial:row([1,2,3]),expect:0},
            {initial:row([5,6,7,8]),expect:4},{initial:row([4,5,4,6]),expect:2,hidden:true}],
     sol:[setN("c",0),whil("brickHere",[rd("v"),iff(cmpN("v",">",4),[addN("c",1)]),mv]),sayV("c")]},

    {em:"🎯",name:"Where Is It?",diff:3,maxBlocks:10,gw:6,gh:2,allowed:CH_ALGO,
     start:{x:0,y:1,dir:1},cells:[],initial:[],tiles:[],
     goalType:"answer",question:"Which position holds the 7? (the first block is position 0)",
     desc:"Search the row for the 7 and 💬 Say WHERE it was, not what it was. 📖 Read can tell the robot its own column.",
     cases:[{initial:row([3,7,2]),expect:1},{initial:row([7,1,4]),expect:0},
            {initial:row([2,5,8,7]),expect:3},{initial:row([1,2,7,4]),expect:2,hidden:true}],
     sol:[setN("p",0),whil("brickHere",[rd("v"),iff(cmpN("v","=",7),[rd("p","x")]),mv]),sayV("p")]},

    {em:"🧭",name:"Escape Any Maze",diff:3,maxBlocks:6,gw:5,gh:5,allowed:CH_ALGO,
     start:{x:0,y:0,dir:1},cells:[],initial:[],goal:[0,4],goalType:"reach",
     tiles:[[1,1,"wall",0],[2,1,"wall",0],[3,1,"wall",0],[1,2,"wall",0],[2,2,"wall",0],
            [3,2,"wall",0],[1,3,"wall",0],[2,3,"wall",0],[3,3,"wall",0]],
     desc:"Four different mazes, one program, only 6 blocks. Don't count steps — teach the robot to feel the wall and follow it round.",
     cases:[
      {gw:5,gh:5,start:{x:0,y:0,dir:1},goal:[0,4],
       tiles:[[1,1,"wall",0],[2,1,"wall",0],[3,1,"wall",0],[1,2,"wall",0],[2,2,"wall",0],
              [3,2,"wall",0],[1,3,"wall",0],[2,3,"wall",0],[3,3,"wall",0]]},
      {gw:6,gh:4,start:{x:0,y:0,dir:1},goal:[0,3],
       tiles:[[2,1,"wall",0],[3,1,"wall",0],[2,2,"wall",0],[3,2,"wall",0]]},
      {gw:4,gh:5,start:{x:0,y:0,dir:1},goal:[0,4],
       tiles:[[1,2,"wall",0],[2,2,"wall",0],[1,3,"wall",0]]},
      {gw:7,gh:5,start:{x:0,y:0,dir:1},goal:[0,4],hidden:true,
       tiles:[[2,2,"wall",0],[3,2,"wall",0],[4,2,"wall",0],[2,3,"wall",0],[4,3,"wall",0]]}],
     sol:[{t:"forever",body:[iff("blocked",[tR],[mv])]}]},

    {em:"🔧",name:"One Job, Many Times",diff:3,maxBlocks:14,gw:6,gh:2,allowed:CH_ALGO,
     start:{x:0,y:1,dir:1},cells:[],initial:[],tiles:[],
     desc:"Carry EVERY block up to the row above. Moving one block is nine steps — so don't write them over and over. Put them in 🔧 routine A (lift · turn left · move · drop · turn right · move · turn right · move · turn left) and your main program becomes: 🔄 While a block is under me → 🔧 Call A.",
     cases:[{initial:plainRow(3),cells:aboveN(3)},
            {initial:plainRow(2),cells:aboveN(2)},
            {initial:plainRow(4),cells:aboveN(4)},
            {initial:plainRow(5),cells:aboveN(5),hidden:true}],
     preset:{main:[],routines:{A:[],B:[]}},
     sol:{main:[whil("brickHere",[{t:"call",fn:"A"}])],routines:{A:LIFT_UP,B:[]}}},

    {em:"🏆",name:"Sort Any Row",diff:3,maxBlocks:40,gw:6,gh:2,allowed:CH_ALGO,
     start:{x:0,y:1,dir:1},cells:[],initial:[],tiles:[],
     desc:"The real thing: put ANY row in order, smallest first. 🔧 Routine A already holds a Swap — it trades the block under you with the one in front. Your job is the algorithm: walk the row comparing each block with the next, swap when they're the wrong way round, walk back to the start, and do that enough times.",
     cases:[{initial:row([3,1,2]),cells:sortedRow([3,1,2])},
            {initial:row([2,3,1]),cells:sortedRow([2,3,1])},
            {initial:row([4,3,2,1]),cells:sortedRow([4,3,2,1])},
            {initial:row([5,2,8,4]),cells:sortedRow([5,2,8,4]),hidden:true}],
     preset:{main:[],routines:{A:SWAP,B:[]}}, // the Swap is a gift; the algorithm isn't
     sol:{main:[rep(4,[
            rd("b","ahead"),
            whil(cmpN("b",">",0),[
              rd("a","here"),
              iff(cmpV("a",">","b"),[{t:"call",fn:"A"}],[mv]),
              rd("b","ahead")]),
            tL,tL,                                  // turn around and walk home
            rd("cx","x"),
            whil(cmpN("cx",">",0),[mv,rd("cx","x")]),
            tL,tL])],
          routines:{A:SWAP,B:[]}}},
   ]},
];
function puzzlePack(id){return PUZZLE_PACKS.find(p=>p.id===id)||null;}
function puzzleDone(p){return !!(player.projects&&player.projects["pack_"+p.id]);}
// a chapter card per pack, reusing the Academy's dot-track look
function renderPuzzleSection(el){
  const h=document.createElement("h4");h.className="qsec";
  h.textContent="🧩 Puzzle Chapters — learn every trick";
  el.appendChild(h);
  for(const pack of PUZZLE_PACKS){
    const done=puzzleDone(pack);
    const need=pack.needs?puzzlePack(pack.needs):null;
    const locked=!!(need&&!puzzleDone(need));
    const card=document.createElement("div");card.className="quest proj acad-card";
    let dots="";
    pack.stages.forEach(s=>{dots+='<span class="acad-dot '+(done?"done":"soon")+'" title="'+esc(s.name)+'">'+s.em+'</span>';});
    card.innerHTML='<div class="qt"><span>'+(done?"🏆":pack.em)+' <b>'+esc(pack.name)+'</b> '+"⭐".repeat(pack.diff)+'</span>'+
      '<span class="qr">🎬 '+pack.stages.length+' lv · '+pack.coins+' 🪙</span></div>'+
      '<div class="acad-track">'+dots+'</div>'+
      '<small class="pdesc">'+(locked?"🔒 Finish "+esc(need.name)+" to unlock this chapter.":esc(pack.desc))+'</small>';
    const b=document.createElement("button");
    b.textContent=locked?"🔒 Locked":(done?"🔁 Play again":"▶ Start chapter");
    b.disabled=locked;
    if(!locked)b.addEventListener("click",()=>{$("projects").classList.remove("open");packEnter(pack,0);});
    card.appendChild(b);
    el.appendChild(card);
  }
}
