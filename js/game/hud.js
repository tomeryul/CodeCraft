"use strict";
/* ---------------- HUD ---------------- */
function updateHud(){
  $("coinsEl").textContent=coins;
  $("lvlEl").textContent=player.level;
  $("xpFill").style.width=Math.min(100,Math.round(player.xp/xpNeed(player.level)*100))+"%";
  const r=R();
  const parts=Object.keys(r.inv).filter(res=>r.inv[res]>0).sort((a,b)=>r.inv[b]-r.inv[a]);
  let inv="";
  parts.slice(0,2).forEach(res=>{inv+=" "+RES[res].em+r.inv[res];});
  if(parts.length>2)inv+=" +";
  $("bagEl").textContent=bagCount(r)+"/"+r.cap+inv;
  const en=Math.round(r.energy==null?100:r.energy);
  $("energyEl").textContent=(r.tired?"😴":"⚡")+en;
  $("energyChip").style.opacity=en<100?"1":".7";
}
function updateFab(){
  const r=R(), f=$("fabRun");
  if(r.running){f.textContent="⏹";f.classList.add("running");}
  else{f.textContent="▶";f.classList.remove("running");}
}
$("fabRun").addEventListener("click",()=>{
  if(mgState){mgState.running?mgStop():mgRun();return;}
  const r=R();r.running?stopRobot(r):startRobot(r);
});
$("runBtn").addEventListener("click",()=>{if(mgState)mgRun();else startRobot(R());});
$("stopBtn").addEventListener("click",()=>{if(mgState)mgStop();else stopRobot(R());});
$("mgResetBtn").addEventListener("click",()=>{mgStop();mgReset();});
$("mgExitBtn").addEventListener("click",()=>mgExit(true));
$("projClose").addEventListener("click",()=>$("projects").classList.remove("open"));
/* --- challenge creator controls --- */
$("mgModePaint").addEventListener("click",()=>{if(mgState){mgState.paintMode="paint";mgCreatorUI();}});
$("mgModeBot").addEventListener("click",()=>{if(mgState){mgState.paintMode="bot";mgCreatorUI();}});
$("mgBudDec").addEventListener("click",()=>{if(mgState){mgState.proj.maxBlocks=Math.max(3,mgState.proj.maxBlocks-1);mgState.solved=false;mgCreatorUI();mgUpdateCount();}});
$("mgBudInc").addEventListener("click",()=>{if(mgState){mgState.proj.maxBlocks=Math.min(30,mgState.proj.maxBlocks+1);mgCreatorUI();mgUpdateCount();}});
$("mgWDec").addEventListener("click",()=>mgSetSize(-1,0));
$("mgWInc").addEventListener("click",()=>mgSetSize(1,0));
$("mgHDec").addEventListener("click",()=>mgSetSize(0,-1));
$("mgHInc").addEventListener("click",()=>mgSetSize(0,1));
$("mgName").addEventListener("click",()=>{
  if(!mgState)return;
  const n=prompt("Challenge name:",mgState.proj.name);
  if(n&&n.trim().length>=2)mgState.proj.name=n.trim().slice(0,30);
  mgCreatorUI();
});
$("mgPublish").addEventListener("click",()=>{
  if(!mgState||!mgState.creator)return;
  const p=mgState.proj;
  if(p.cells.length<3){toast("🖌️ Paint at least 3 blueprint tiles first!");return;}
  if(!mgState.solved){toast("🧪 First prove it's solvable: build a program within the budget and press ▶!");return;}
  if(!sbReady()){toast("🔌 Online mode isn't connected yet.");return;}
  if(!sbUser){toast("🔐 Log in first — account box at the top of Projects.");return;}
  publishChallenge();
});
$("mgCanvas").addEventListener("pointerdown",e=>{
  if(!mgState||!mgState.creator||mgState.running)return;
  const cv=$("mgCanvas"),rect=cv.getBoundingClientRect(),p=mgState.proj;
  const x=Math.floor((e.clientX-rect.left)/rect.width*p.gw);
  const y=Math.floor((e.clientY-rect.top)/rect.height*p.gh);
  if(x<0||y<0||x>=p.gw||y>=p.gh)return;
  if(mgState.paintMode==="bot"){
    p.start={x,y,dir:1};
    mgState.robot.x=x;mgState.robot.y=y;mgState.robot.dir=1;
  }else{
    const i=p.cells.findIndex(c=>c[0]===x&&c[1]===y);
    if(i>=0)p.cells.splice(i,1);else p.cells.push([x,y]);
  }
  mgState.solved=false; // design changed — must re-prove
  sfx(500,.03);mgDraw();
});
$("codeBtn").addEventListener("click",()=>{
  $("editor").classList.add("open");renderProgram();renderPy();updateUndoBtns();
  if(!tut.done&&tut.step===1)tutSet(2);
});
$("edClose").addEventListener("click",()=>{
  if(mgState)mgExit(false);
  $("editor").classList.remove("open");
});
$("edMax").addEventListener("click",()=>{
  const on=$("editor").classList.toggle("max");
  $("edMax").title=on?"Shrink editor":"Expand editor";
  sfx(on?620:460,.05);
  if(on&&!mentorFlags.dblTap){mentorFlags.dblTap=true;toast("💡 Tip: in full-screen mode, double-tap a block to delete it!");}
});
$("centerBtn").addEventListener("click",()=>{follow=true;toast("🎯 Following "+R().name);});
document.querySelectorAll("#tabs button").forEach(b=>b.addEventListener("click",()=>{
  const tab=b.dataset.tab;
  document.querySelectorAll("#tabs button").forEach(x=>x.classList.toggle("on",x===b));
  $("blocksTab").style.display=tab==="blocks"?"flex":"none";
  $("pyTab").style.display=tab==="python"?"flex":"none";
  $("boardTab").style.display=tab==="board"?"flex":"none";
  if(tab==="python")renderPy();
  if(tab==="board")mgDraw();
}));
function setTab(t){const b=document.querySelector('#tabs button[data-tab="'+t+'"]');if(b)b.click();}
