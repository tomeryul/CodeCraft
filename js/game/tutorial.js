"use strict";
/* ---------------- tutorial ---------------- */
let tutTarget=null;
function tutSet(step){
  if(step>0&&mgState)step=0; // never let the onboarding coach cover a challenge
  tut.step=step;
  if(tutTarget){tutTarget.classList.remove("tut-pulse");tutTarget=null;}
  const coach=$("coach");
  coach.classList.remove("hi");
  if(step===1){
    coach.innerHTML='👋 Your robot only moves when you <b>program</b> it!<small>Step 1 of 3 — tap the 🧩 Code button</small>';
    tutTarget=$("codeBtn");
  }else if(step===2){
    coach.innerHTML='Tap <b>🚶 Walk To 🌳</b>, then <b>✋ Collect</b>!<small>Step 2 of 3 — your blocks appear in the program above</small>';
    coach.classList.add("hi");
    tutTarget=$("palette").querySelector(".pblk");
  }else if(step===3){
    coach.innerHTML='🚀 Press the green <b>▶ Run</b> button and watch your robot!<small>Step 3 of 3</small>';
    coach.classList.add("hi");
    tutTarget=$("runBtn");
  }
  if(step>=1&&step<=3){coach.classList.add("show");if(tutTarget)tutTarget.classList.add("tut-pulse");}
  else coach.classList.remove("show");
}
function tutFinish(){
  if(tut.done)return;
  tut.done=true;tutSet(0);
  setTimeout(()=>bigToast("🎉 You're a programmer now! Collect 🌳, sell at the 🏪, and unlock new powers!"),900);
  saveSoon();
}
