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
// terse level builders so the data below stays readable
const mv={t:"move"},tL={t:"turnL"},tR={t:"turnR"},pk={t:"pickUp"},dr={t:"drop"},bd={t:"build"};
const rep=(n,body)=>({t:"repeat",n,body});

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
