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
const TARGETS=["tree","rock","iron","crystal"];
const TGT_EM={tree:"🌳",rock:"🪨",iron:"⛓️",crystal:"💎"};
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
  // 🔧 Call a named routine. Decomposition: name a repeated idea once and reuse
  // it — including from inside itself, which is recursion.
  call:{cat:"funcs",ic:"🔧",lbl:"Call"},
  /* 🤝 the team blocks. One program pasted onto every robot makes them all walk to
     the SAME nearest tree; these are how a fleet divides the work instead. */
  claim:{cat:"team",ic:"🤝",lbl:"Call It"},        // reserve what I'm facing
  broadcast:{cat:"team",ic:"📡",lbl:"Tell Team"},  // pin this spot to a channel
  goTo:{cat:"team",ic:"📻",lbl:"Go To Call"},      // walk to what the team pinned
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
  {id:"funcs",name:"Routines",types:["call"],lock:"vars",need:"Earn 250 🪙 total to unlock 🔧 routines!"},
  // unlocked by owning a second robot — exactly when "they keep bumping into each
  // other" becomes a problem worth programming around
  {id:"team",name:"Teamwork",types:["claim","broadcast","goTo"],lock:"team",need:"Buy a 2nd robot 🤖 to unlock 🤝 teamwork blocks!"},
];
function newBlock(t){
  const b={t,uid:uid()};
  if(t==="repeat"){b.n=3;b.body=[];}
  if(t==="forever"){b.body=[];}
  if(t==="if"){b.cond="treeAhead";b.body=[];b.els=[];}
  if(t==="whileLoop"){b.cond=(typeof mgState!=="undefined"&&mgState)?"brickHere":"treeAhead";b.body=[];}
  if(t==="read"){b.name="x";b.src="here";b.opt="wood";}
  if(t==="call")b.fn="A";
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
function promptName(cur){
  const nm=prompt("Variable name:",cur||"x");
  if(nm===null)return cur||"x";
  const cl=nm.trim().replace(/\W+/g,"_").slice(0,10);
  return cl||cur||"x";
}
