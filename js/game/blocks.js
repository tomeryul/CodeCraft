"use strict";
/* ---------------- blocks ---------------- */
const CONDS=["treeAhead","rockAhead","ironAhead","waterAhead","blocked","bagFull","bagEmpty","tired","taken"];
const COND_LBL={treeAhead:"tree ahead 🌳",rockAhead:"rock ahead 🪨",ironAhead:"iron ahead ⛓️",waterAhead:"water ahead 🌊",blocked:"blocked 🚧",bagFull:"bag full 🎒",bagEmpty:"bag empty 🕳️",tired:"tired 😴",
  taken:"another robot called it 🤝",
  // challenge-board sensors (see CHALLENGE_CONDS in challenges.js)
  wallAhead:"wall ahead 🧱",pitAhead:"pit ahead 🕳️",brickHere:"block under me 🟧",onTarget:"on a target 🎯",holding:"carrying a block ✊",
  doorAhead:"locked door ahead 🚪",keyAhead:"key ahead 🔑",gateAhead:"closed gate ahead 🚧",onPlate:"on a plate 🔘"};
const BUILDS=["sapling","bridge","chest"];
const BUILD_LBL={sapling:"🌱 sapling (1🪵)",bridge:"🌉 bridge (2🪨)",chest:"📦 chest (5🪵)"};
// Everywhere 🚶 Walk To / 🧭 Face Nearest can send a robot. Water is TERRAIN, not
// an object, and market/home/chest are places you go to finish a job — all four
// were missing, so half the world was unreachable by name.
const TARGETS=["tree","rock","iron","crystal","water","market","home","chest"];
const TGT_EM={tree:"🌳",rock:"🪨",iron:"⛓️",crystal:"💎",water:"💧",market:"🏪",home:"🏠",chest:"📦"};
const DEFS={
  move:{cat:"basic",ic:"⬆️",lbl:"Move"},
  turnL:{cat:"basic",ic:"↩️",lbl:"Turn Left"},
  turnR:{cat:"basic",ic:"↪️",lbl:"Turn Right"},
  collect:{cat:"basic",ic:"✋",lbl:"Collect"},
  chop:{cat:"basic",ic:"🪓",lbl:"Chop"},
  mine:{cat:"basic",ic:"⛏️",lbl:"Mine"},
  scoop:{cat:"basic",ic:"🪣",lbl:"Scoop"},
  drop:{cat:"basic",ic:"⤵️",lbl:"Drop"},
  pickUp:{cat:"basic",ic:"✊",lbl:"Lift"},   // challenge-only: lift a numbered brick to carry it
  build:{cat:"basic",ic:"🔨",lbl:"Build"},
  rest:{cat:"basic",ic:"😴",lbl:"Rest"},
  wait:{cat:"basic",ic:"⏱️",lbl:"Wait"},
  repeat:{cat:"loops",ic:"🔁",lbl:"Repeat",container:true},
  forever:{cat:"loops",ic:"♾️",lbl:"Forever",container:true},
  // "keep going UNTIL" — the loop every algorithm needs. repeat/count run a KNOWN
  // number of times, so neither can express "while it isn't sorted yet".
  whileLoop:{cat:"loops",ic:"🔄",lbl:"While",container:true},
  "if":{cat:"logic",ic:"❓",lbl:"If",container:true},
  faceNearest:{cat:"smart",ic:"🧭",lbl:"Face Nearest"},
  // walk there, around whatever is in the way — the world's only pathfinding used
  // to be Go Home, so off-axis targets were simply unreachable
  goNear:{cat:"smart",ic:"🚶",lbl:"Walk To"},
  goHome:{cat:"smart",ic:"🏠",lbl:"Go Home"},
  sellAll:{cat:"smart",ic:"💰",lbl:"Sell All"},
  bankAll:{cat:"smart",ic:"🏦",lbl:"Bank All"},
  setVar:{cat:"vars",ic:"📦",lbl:"Set"},
  changeVar:{cat:"vars",ic:"➕",lbl:"Change"},
  countLoop:{cat:"vars",ic:"🔢",lbl:"Count",container:true},
  // reads a value FROM the world INTO a variable. Without this the board is opaque:
  // the robot could carry a numbered block but never look at its number, so no
  // sorting/searching/counting algorithm was expressible at all.
  read:{cat:"vars",ic:"📖",lbl:"Read"},
  say:{cat:"vars",ic:"💬",lbl:"Say"},
  // 🔧 Call a function. A function takes PARAMETERS and can hand a value BACK,
  // so "do this thing" becomes "work this out for me" — the step from a named
  // block of steps to an actual abstraction.
  call:{cat:"funcs",ic:"🔧",lbl:"Call"},
  ret:{cat:"funcs",ic:"🔙",lbl:"Give Back"},
  /* 🤝 the team blocks. One program pasted onto every robot makes them all walk to
     the SAME nearest tree; these are how a fleet divides the work instead. */
  claim:{cat:"team",ic:"🤝",lbl:"Call It"},        // reserve what I'm facing
  broadcast:{cat:"team",ic:"📡",lbl:"Tell Team"},  // pin this spot to a channel
  goTo:{cat:"team",ic:"📻",lbl:"Go To Call"},      // walk to what the team pinned
  // Hand your whole bag to the robot in front of you. This is the primitive that
  // makes a PIPELINE expressible — gatherers stay on the seam, one hauler runs the
  // route — as opposed to N robots each doing the whole job in parallel.
  give:{cat:"team",ic:"📦",lbl:"Give Bag"},
};
// what 📖 Read can look at
const READ_SRC=["here","ahead","held","x","y","price"];
const READ_LBL={here:"number under me 🟧",ahead:"number ahead ⬆️",held:"number I'm holding ✊",
  x:"my column ↔️",y:"my row ↕️",price:"💰 market price of"};
const CATS=[
  {id:"basic",name:"Basics",types:["move","turnL","turnR","collect","chop","mine","scoop","drop","build","rest","wait"],lock:null},
  {id:"loops",name:"Loops",types:["repeat","forever","whileLoop"],lock:"loops",need:"Collect 5 resources to unlock 🔁 loops!"},
  {id:"logic",name:"Logic",types:["if"],lock:"logic",need:"Sell something at the market 🏪 to unlock ❓ logic!"},
  {id:"smart",name:"Smart",types:["faceNearest","goNear","goHome","sellAll","bankAll"],lock:"smart",need:"Earn 150 🪙 total (or own 2 robots) to unlock 🧭 smart blocks!"},
  {id:"vars",name:"Memory",types:["setVar","changeVar","countLoop","read","say"],lock:"vars",need:"Earn 250 🪙 total to unlock 🧠 memory & variables!"},
  {id:"funcs",name:"Functions",types:["call","ret"],lock:"vars",need:"Earn 250 🪙 total to unlock 🔧 functions!"},
  // unlocked by owning a second robot — exactly when "they keep bumping into each
  // other" becomes a problem worth programming around
  {id:"team",name:"Teamwork",types:["claim","broadcast","goTo","give"],lock:"team",need:"Buy a 2nd robot 🤖 to unlock 🤝 teamwork blocks!"},
];
function newBlock(t){
  const b={t,uid:uid()};
  if(t==="repeat"){b.n=3;b.body=[];}
  if(t==="forever"){b.body=[];}
  if(t==="if"){b.cond="treeAhead";b.body=[];b.els=[];}
  if(t==="whileLoop"){b.cond=(typeof mgState!=="undefined"&&mgState)?"brickHere":"treeAhead";b.body=[];}
  if(t==="read"){b.name="x";b.src="here";b.opt="wood";}
  if(t==="call"){b.fn="A";b.args=[];b.out=null;}
  if(t==="ret")b.val={k:"num",n:0};
  if(t==="wait")b.n=1;
  if(t==="rest")b.n=2;
  if(t==="build")b.opt="sapling";
  if(t==="faceNearest"||t==="goNear")b.opt="tree";
  if(t==="broadcast"||t==="goTo")b.opt="tree"; // which channel on the noticeboard
  if(t==="setVar"){b.name="x";b.val={k:"num",n:5};}
  if(t==="changeVar"){b.name="x";b.n=1;}
  if(t==="countLoop"){b.name="i";b.to=5;b.body=[];}
  if(t==="say")b.val={k:"str",s:"Hello!"};
  return b;
}
// A comparison's right-hand side may be a bare number (old saves) or a value
// object. These two keep the editor's −/+ working either way.
// a block field that may hold either a bare number (old saves) or a value object
function numOf(v){return (v&&typeof v==="object")?(Number(v.n)||0):(Number(v)||0);}
function condNum(c){const v=c.val;return (v&&typeof v==="object")?(Number(v.n)||0):(Number(v)||0);}
function condSetNum(c,n){if(c.val&&typeof c.val==="object")c.val={k:"num",n};else c.val=n;}
// how much ➕ Change adds: a literal, or the current value of another variable
function changeBy(r,b){return (b.n&&typeof b.n==="object")?(Number(resolveVal(r,b.n))||0):(b.n|0);}
function resolveVal(r,v){
  if(!v)return 0;
  if(v.k==="num")return v.n;
  if(v.k==="str")return v.s;
  if(v.k==="var")return r.vars[v.name]!==undefined?r.vars[v.name]:0;
  return 0;
}
/* ---------------- functions ----------------
   A function is {params:[names], body:[blocks]}. Older saves stored a bare array
   of blocks, so every read goes through routineOf(), which upgrades in place —
   that keeps every existing save, published solution, starter routine and
   campaign level loading unchanged. */
function routineOf(r,id){
  if(!r.routines)r.routines={};
  let f=r.routines[id];
  if(Array.isArray(f))f=r.routines[id]={params:[],body:f};
  else if(!f||typeof f!=="object")f=r.routines[id]={params:[],body:[]};
  if(!Array.isArray(f.params))f.params=[];
  if(!Array.isArray(f.body))f.body=[];
  return f;
}
// Arguments are resolved in the CALLER's scope, then the callee gets a fresh one
// with only its parameters bound. That local scope is the whole point: a function
// you can reuse without worrying which variable names it happens to use inside.
function fnEnter(r,f,b){
  // A function with no declared inputs is the old kind of routine and keeps
  // SHARING the caller's variables — that is what every program written before
  // functions existed expects, including saved solutions and the campaign's
  // starter 🔧 Swap. Declare an input and you opt into a private workspace.
  if(!(f.params&&f.params.length))return null;
  const scope={};
  f.params.forEach((p,i)=>{
    scope[p]=resolveVal(r,((b.args||[])[i])||{k:"num",n:0});
  });
  const saved=r.vars;
  r.vars=scope;
  return saved;
}
function fnExit(r,fr,val){
  if(fr.saved)r.vars=fr.saved;   // only a scoped call swapped anything
  if(fr.out)r.vars[fr.out]=val;
}
function fnLabel(r,id){
  const f=routineOf(r,id);
  return id+"("+(f.params||[]).join(",")+")";
}
function promptName(cur){
  const nm=prompt("Variable name:",cur||"x");
  if(nm===null)return cur||"x";
  const cl=nm.trim().replace(/\W+/g,"_").slice(0,10);
  return cl||cur||"x";
}
