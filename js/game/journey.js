"use strict";
/* =====================================================================
   The Journey — one ordered spine through everything the game has
   ---------------------------------------------------------------------
   The problem this solves: the game had plenty to DO and no answer to
   "what now". The Academy ended on "the whole open world is yours!",
   which to a nine-year-old reads as "you are on your own", and behind the
   Projects sheet sat five unrelated kinds of content in no order. Quests
   did not fill the gap — three drawn at random from a pool of thirteen is
   a to-do list, not a path.

   So: ONE visible next step, always. It names the thing to do, it says
   where that thing lives, and tapping it GOES there — because "I don't
   know what to do" and "I don't know where it is" are two different
   problems and the second one is the easier to fix.

   Each step is keyed off state the game already keeps (totals, unlocks,
   player.projects, robots.length), so nothing here has to be maintained
   in step with the systems it points at.
   ===================================================================== */

/* the sheet-opening helper: getting to the right SCREEN is half of it,
   getting to the right CARD is the other half — a wall of cards you have
   to scan is the same problem one level down. */
function jGoto(open,find){
  if(typeof mgState!=="undefined"&&mgState&&typeof mgExit==="function")mgExit(false);
  $("editor").classList.remove("open");
  open();
  if(!find)return;
  setTimeout(()=>{
    const el=find();
    if(!el)return;
    el.scrollIntoView({block:"center",behavior:"smooth"});
    el.classList.add("j-point");
    setTimeout(()=>el.classList.remove("j-point"),2600);
  },260);
}
function jProjects(find){
  jGoto(()=>{renderProjects();$("projects").classList.add("open");},find);
}
function jEditor(tip){
  jGoto(()=>{$("editor").classList.add("open");if(typeof setTab==="function")setTab("blocks");
    if(typeof renderProgram==="function"){renderProgram();renderPy();}});
  if(tip)setTimeout(()=>toast(tip),420);
}
const jCard=re=>()=>[...document.querySelectorAll("#projList .pcard, #projList .t3card")]
  .find(c=>re.test(c.textContent));

/* ---------------- the spine ----------------
   Ordered so each step is the smallest next thing that is possible, and
   so the thing it teaches is what the NEXT step needs. */
const JOURNEY=[
  {id:"academy", em:"🎓", title:"Finish the Starter Academy",
   hint:"Six short lessons. They teach every block you need to start.",
   where:"Projects ▸ Starter Academy",
   done:()=>typeof academyComplete==="function"&&academyComplete(),
   go:()=>{if(typeof academyStart==="function")academyStart();}},

  {id:"chop", em:"🪓", title:"Send your robot for wood",
   hint:"Open 🧩 Code and build: 🚶 Walk To 🌳 → 🪓 Chop. Then press ▶.",
   where:"the 🧩 Code button",
   done:()=>totals.collected>=1,
   go:()=>jEditor("🚶 Walk To 🌳, then 🪓 Chop, then ▶ Run.")},

  {id:"sell", em:"🏪", title:"Sell what you gathered",
   hint:"Add 🚶 Walk To 🏪 and then ⤵️ Drop — the market pays you for a full bag.",
   where:"the 🧩 Code button",
   done:()=>totals.earned>=1,
   go:()=>jEditor("Add 🚶 Walk To 🏪 then ⤵️ Drop at the end of your program.")},

  {id:"loop", em:"🔁", title:"Do it again — with a loop",
   hint:"Wrap your gathering blocks in 🔁 Repeat so one program works forever.",
   where:"the 🧩 Code button",
   done:()=>typeof hasLoop==="function"&&robots.some(r=>hasLoop(r.program)),
   go:()=>jEditor("Tap 🔁 Repeat, then tap the blocks that go inside it.")},

  {id:"robot2", em:"🤖", title:"Hire a second robot",
   hint:"100 🪙 in the shop. Two robots run their own programs at the same time.",
   where:"the 🛒 Shop",
   done:()=>robots.length>=2,
   go:()=>{if(typeof openShop==="function")openShop();}},

  {id:"order", em:"📋", title:"Fill an order at the market",
   hint:"The board posts an order on a clock. Deliver it before it runs out.",
   where:"the 📈 bar at the top",
   done:()=>(player.orders|0)>=1,
   go:()=>{$("editor").classList.remove("open");$("projects").classList.remove("open");
     $("ticker").classList.add("open");if(typeof renderMarket==="function")renderMarket();
     toast("📋 That's the order. Gather what it asks for, then sell it.");}},

  {id:"project", em:"🏗️", title:"Finish a Build Project",
   hint:"A blueprint to fill in. What you build appears in your world.",
   where:"Projects ▸ Build Projects",
   done:()=>Object.keys(player.projects||{}).some(k=>k.indexOf("t3_")!==0),
   go:()=>jProjects(jCard(/Big House|Build Projects/i))},

  {id:"tower", em:"🧊", title:"Build upwards in Tower Mode",
   hint:"The board gets a third dimension. You can only reach one brick above your feet.",
   where:"Projects ▸ Tower Mode",
   done:()=>typeof TOWER_LEVELS!=="undefined"&&TOWER_LEVELS.some(l=>player.projects[l.id]),
   go:()=>jProjects(jCard(/First Steps/i))},

  {id:"create", em:"✏️", title:"Design a challenge of your own",
   hint:"Draw a board, prove it can be solved, then share it with everyone.",
   where:"Projects ▸ Create your own",
   done:()=>((player.myChallenges||[]).length)>=1,
   go:()=>jProjects(jCard(/Create your own/i))}
];

function journeyState(){
  player.journey=player.journey||{claimed:{}};
  if(!player.journey.claimed)player.journey.claimed={};
  return player.journey;
}
// the first step not finished — the only thing the player is ever asked for
function journeyStep(){
  for(const s of JOURNEY){ let ok=false; try{ok=!!s.done();}catch(_){}
    if(!ok)return s; }
  return null;
}
function journeyProgress(){
  let n=0;
  for(const s of JOURNEY){ try{ if(s.done())n++; }catch(_){} }
  return n;
}

/* Award once, the moment a step's condition first becomes true. Checked
   on the world's slow tick rather than wired into a dozen call sites, so
   a step can be keyed off ANY state without that system knowing. */
/* The FIRST run only records where the player already is. A loaded save —
   or a cloud sync onto a fresh device — can satisfy six steps at once, and
   celebrating each of them buries the screen in a stack of banners for
   things the player did days ago. After priming, only real transitions
   are announced, and a check that clears several at once says so once. */
let jPrimed=false;
// loading a different save is a fresh start for the priming rule
function journeyPrimeReset(){jPrimed=false;}
function journeyCheck(){
  const st=journeyState();
  let last=null, n=0;
  for(const s of JOURNEY){
    if(st.claimed[s.id])continue;
    let ok=false; try{ok=!!s.done();}catch(_){}
    if(!ok)break;                       // strictly in order — no skipping ahead
    st.claimed[s.id]=1;last=s;n++;
  }
  if(!jPrimed){jPrimed=true;return false;}   // priming pass: record, never celebrate
  if(!last)return false;
  const next=journeyStep();
  if(typeof confetti==="function")confetti();
  if(typeof sfx==="function"){sfx(760,.08);sfx(1040,.09,.09);}
  bigToast("✅ "+(n>1?n+" steps done — ":"")+last.title+
    (next?"  →  Next: "+next.em+" "+next.title:"  —  that's the whole journey! 🏆"));
  if(typeof saveSoon==="function")saveSoon();
  return true;
}

/* ---------------- the bar ----------------
   Lives above the bottom bar, in the world, always. Not behind a menu:
   a "what now" you have to go looking for is not an answer. */
function renderJourney(){
  const el=$("journey"); if(!el)return;
  const hidden=$("editor").classList.contains("open")||
               $("projects").classList.contains("open")||
               $("quests").classList.contains("open")||
               $("shopWrap").classList.contains("open")||
               ($("splash")&&!$("splash").classList.contains("hide"));
  const s=journeyStep();
  if(hidden||!s){el.style.display="none";return;}
  el.style.display="";
  const n=journeyProgress();
  el.innerHTML='<button class="j-btn" type="button">'+
    '<span class="j-em">'+s.em+'</span>'+
    '<span class="j-tx"><b>'+esc(s.title)+'</b><small>'+esc(s.hint)+'</small></span>'+
    '<span class="j-go">'+n+'/'+JOURNEY.length+'</span></button>';
}
$("journey").addEventListener("click",e=>{
  if(!e.target.closest(".j-btn"))return;
  const s=journeyStep(); if(!s)return;
  if(typeof sfx==="function")sfx(560,.04);
  toast(s.em+" "+s.where);
  try{s.go();}catch(_){}
});

/* One monkey-patch instead of a dozen call sites: updateHud already runs
   on the world's 1s tick and after anything that changes the numbers a
   step could be keyed off. */
const _jUpdateHud=window.updateHud;
window.updateHud=function(){
  const r=_jUpdateHud.apply(this,arguments);
  try{journeyCheck();renderJourney();}catch(_){}
  return r;
};
