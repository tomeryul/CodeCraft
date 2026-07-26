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
   desc:"Robots do exactly what your code says. Add ⬆️ Move blocks until the robot reaches the 🚩 flag, then press ▶ to run."},
  {id:"t_turn",tut:true,em:"🧭",name:"Turn & Go",diff:1,coins:0,xp:15,maxBlocks:8,gw:4,gh:4,
   allowed:["move","turnL","turnR"],start:{x:0,y:0,dir:1},goal:[3,3],goalType:"reach",
   desc:"The flag is around a corner! Use ↪️ Turn Right to change the way the robot faces, then ⬆️ Move toward the 🚩."},
  {id:"t_chop",tut:true,em:"🪓",name:"Timber!",diff:1,coins:0,xp:20,maxBlocks:8,gw:5,gh:3,
   allowed:["move","turnL","turnR","chop"],start:{x:0,y:1,dir:1},trees:[[4,1]],goalType:"chop",
   desc:"Walk up to the 🌳 tree and use 🪓 Chop to clear it — exactly how your robots gather wood out in the world."},
  {id:"t_collect",tut:true,em:"💎",name:"Treasure Hunt",diff:1,coins:0,xp:20,maxBlocks:10,gw:5,gh:3,
   allowed:["move","turnL","turnR","collect"],start:{x:0,y:1,dir:1},items:[[4,1]],goalType:"collect",
   desc:"Reach the 💎 gem and use ✋ Collect to pick it up — the same way you gather crystals and resources."},
  {id:"t_loop",tut:true,em:"🔁",name:"Loop the Forest",diff:2,coins:0,xp:30,maxBlocks:4,gw:6,gh:3,
   allowed:["move","turnL","turnR","chop","repeat"],start:{x:0,y:1,dir:1},trees:[[1,1],[2,1],[3,1],[4,1],[5,1]],goalType:"chop",
   desc:"Five trees, but only 4 blocks! Put ⬆️ Move and 🪓 Chop INSIDE a 🔁 Repeat so one small loop does the work of many."},
  {id:"t_if",tut:true,em:"❓",name:"Smart Chopper",diff:3,coins:0,xp:40,maxBlocks:6,gw:6,gh:3,
   allowed:["move","turnL","turnR","chop","repeat","if"],start:{x:0,y:1,dir:1},trees:[[1,1],[3,1],[5,1]],goalType:"chop",
   desc:"Trees are scattered with gaps. 🔁 Repeat: ❓ If 🌳 tree ahead → 🪓 Chop, then ⬆️ Move. The robot decides for itself!"},
];
for(const t of TUTS)if(!t.cells)t.cells=[]; // engine expects a (possibly empty) blueprint list
function academyIndex(id){return TUTS.findIndex(t=>t.id===id);}
function academyDoneCount(){player.academy=player.academy||{};return TUTS.filter(t=>player.academy[t.id]).length;}
function academyComplete(){return academyDoneCount()>=TUTS.length;}
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
  if(next){
    bigToast("✅ "+proj.name+" done!  Next: "+next.em+" "+next.name);
    setTimeout(()=>{ if(mgState)academyEnter(i+1); },700);
  }else{
    if(window.CC_EXTRAS)CC_EXTRAS.celebrate("🎓","ACADEMY COMPLETE!","You're ready to build!",
      "You've learned moving, turning, chopping, collecting, loops and conditions — the whole open world is yours now!","Let's play! 🎉");
    else bigToast("🎓 Academy complete — you're ready for the open world!");
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
  const nextI=TUTS.findIndex(t=>!player.academy||!player.academy[t.id]);
  const h=document.createElement("h4");h.className="qsec";
  h.textContent="🎓 Academy — learn the basics";
  el.appendChild(h);
  // no `hot` here — .acad-card's purple glow is the Academy's own marker, and
  // .pcard.hot would out-specify it and repaint the border amber
  const card=ccCard(el,{em:all?"🏆":"🎓",name:"Starter Academy",cls:"acad-card",done:all,
    meta:'<i>'+done+'/'+total+' done</i>'+(all?"":" · next: "+TUTS[nextI].em+" "+esc(TUTS[nextI].name)),
    desc:all
      ? "You've graduated! Replay any lesson any time to sharpen your skills."
      : "Six quick lessons take you from your first Move all the way to loops &amp; conditions.",
    badge:all?"🔁":"▶",
    onTap:()=>{$("projects").classList.remove("open");academyStart();}});
  // the lesson track lives under the text, inside the card body
  const tr=document.createElement("div");tr.className="acad-track";
  TUTS.forEach((t,i)=>{const st=player.academy&&player.academy[t.id]?"done":(i===nextI?"now":"soon");
    tr.innerHTML+='<span class="acad-dot '+st+'" title="'+esc(t.name)+'">'+t.em+'</span>';});
  card.querySelector(".pmain").appendChild(tr);
}
