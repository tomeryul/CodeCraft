"use strict";
/* ---------------- HUD ---------------- */
/* updateHud runs on every world tick, and these strings carry emoji that
   ui-icons.js swaps for inline SVG. Assigning textContent unconditionally
   replaced the text node 60x a second, so the observer rebuilt every chip
   icon each frame. Write only when the string actually changed. */
function setTxt(el,s){s=String(s);if(el.textContent!==s)el.textContent=s;}
function updateHud(){
  setTxt($("coinsEl"),coins);
  setTxt($("lvlEl"),player.level);
  $("xpFill").style.width=Math.min(100,Math.round(player.xp/xpNeed(player.level)*100))+"%";
  const r=R();
  const parts=Object.keys(r.inv).filter(res=>r.inv[res]>0).sort((a,b)=>r.inv[b]-r.inv[a]);
  let inv="";
  parts.slice(0,2).forEach(res=>{inv+=" "+RES[res].em+r.inv[res];});
  if(parts.length>2)inv+=" +";
  setTxt($("bagEl"),bagCount(r)+"/"+r.cap+inv);
  const en=Math.round(r.energy==null?100:r.energy);
  setTxt($("energyEl"),(r.tired?"😴":"⚡")+en);
  // four status chips + four tools do not fit across 390px — energy shows
  // only while it is spendable
  $("energyChip").classList.toggle("low",en<100);
}
function updateFab(){
  const r=R(), f=$("fabRun");
  if(r.running){setTxt(f,"⏹");f.classList.add("running");}
  else{setTxt(f,"▶");f.classList.remove("running");}
  // the bottom action bar shows exactly one primary: Run, or Stop while running
  const live=(typeof mgState!=="undefined"&&mgState)?!!mgState.running:!!r.running;
  $("editor").classList.toggle("running",live);
}
$("fabRun").addEventListener("click",()=>{
  if(mgState){mgState.running?mgStop():mgRun();return;}
  const r=R();r.running?stopRobot(r):startRobot(r);
});
$("runBtn").addEventListener("click",()=>{if(mgState)mgRun();else startRobot(R());});
$("stopBtn").addEventListener("click",()=>{if(mgState)mgStop();else stopRobot(R());});
$("mgStepBtn").addEventListener("click",()=>mgStep());
$("mgSpeedBtn").addEventListener("click",()=>mgSpeedCycle());
$("mgResetBtn").addEventListener("click",()=>{
  mgStop();
  // back to the FIRST input, not whichever test case the last run ended on
  if(mgState&&mgState.cases){mgState.ci=0;mgState.results=[];mgState.failAt=-1;mgState.stepping=false;
    mgApplyCase(mgState.cases[0]);mgCaseStrip();mgVarsUI();$("mgCost").innerHTML="";}
  else mgReset();
});
$("mgExitBtn").addEventListener("click",()=>mgExit(true));
$("mgSetup").addEventListener("click",()=>{$("mgCreatorBar").classList.toggle("setup");sfx(520,.03);});
$("mgGoal").addEventListener("click",()=>$("mgGoal").classList.toggle("open"));
$("projClose").addEventListener("click",()=>$("projects").classList.remove("open"));
$("mgGuide").addEventListener("click",()=>{$("mgCreatorBar").classList.remove("setup");openGuide();});
$("guideClose").addEventListener("click",()=>closeGuide());
$("funcLibClose").addEventListener("click",()=>closeFuncLib());
/* --- challenge creator controls (the tool strip renders itself in mgToolsUI) --- */
$("mgBrickDec").addEventListener("click",()=>mgStepArg(-1));
$("mgBrickInc").addEventListener("click",()=>mgStepArg(1));
$("mgSave").addEventListener("click",()=>saveMyChallenge());
$("mgDiff").addEventListener("click",()=>{if(mgState&&mgState.creator){const d=mgState.proj;d.diff=((d.diff||1)%3)+1;mgCreatorUI();sfx(520,.03);}});
$("mgAddStage").addEventListener("click",()=>mgAddStage());
$("mgAddCase").addEventListener("click",()=>mgAddCase());
$("mgPreset").addEventListener("click",()=>mgTogglePreset());
/* 🧩 block budget, 3…999. One tap per block would be 987 taps to reach the top, so
   the step grows with the number — and tapping the number itself types an exact one. */
const BUDGET_MAX=999;
function budStep(v){return v<20?1:v<100?10:50;}
function setBudget(v){
  if(!mgState)return;
  const n=Math.max(3,Math.min(BUDGET_MAX,Math.round(v)||3));
  if(n<mgState.proj.maxBlocks)mgState.solved=false; // a tighter budget must be re-proven
  mgState.proj.maxBlocks=n;
  mgCreatorUI();mgUpdateCount();
}
$("mgBudDec").addEventListener("click",()=>{if(mgState){const v=mgState.proj.maxBlocks;setBudget(v-budStep(v-1));}});
$("mgBudInc").addEventListener("click",()=>{if(mgState){const v=mgState.proj.maxBlocks;setBudget(v+budStep(v));}});
$("mgBudget").addEventListener("click",()=>{
  if(!mgState)return;
  const n=prompt("How many blocks may the player use? (3-"+BUDGET_MAX+")",mgState.proj.maxBlocks);
  if(n!=null&&n.trim()!=="")setBudget(parseInt(n,10));
});
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
  const p=mgState.proj, banked=(mgState.stages||[]).length;
  const curHas=p.cells.length||(p.initial&&p.initial.length);
  if(!banked&&!curHas){toast("🖌️ Paint the target tiles first (where blocks must end up)!");return;}
  if(curHas&&!mgState.solved){toast("🧪 First prove this level is solvable — build a program and press ▶! (or ➕ Add it)");return;}
  if(!sbReady()){toast("🔌 Online mode isn't connected yet.");return;}
  if(!sbUser){toast("🔐 Log in first — account box at the top of Projects.");return;}
  publishChallenge();
});
// Thin dispatcher — all the painting rules (and the solved=false invariant) live
// in mgPaintTile so every tool goes through one place.
$("mgCanvas").addEventListener("pointerdown",e=>{
  if(!mgState||!mgState.creator||mgState.running)return;
  const cv=$("mgCanvas"),rect=cv.getBoundingClientRect(),p=mgState.proj;
  const x=Math.floor((e.clientX-rect.left)/rect.width*p.gw);
  const y=Math.floor((e.clientY-rect.top)/rect.height*p.gh);
  if(x<0||y<0||x>=p.gw||y>=p.gh)return;
  mgPaintTile(x,y);
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
  sheetFull=on; saveSoon();
  $("edMax").title=on?"Shrink editor":"Expand editor";
  sfx(on?620:460,.05);
  /* Every sheet's size control routes through this button now, so the tip
     has to check that the thing it describes is actually on screen. */
  if(on&&$("editor").classList.contains("open")&&!mentorFlags.dblTap){
    mentorFlags.dblTap=true;toast("💡 Tip: in full-screen mode, double-tap a block to delete it!");}
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
