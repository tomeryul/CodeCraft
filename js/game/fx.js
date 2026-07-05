"use strict";
/* ---------------- toasts & sfx ---------------- */
function toast(t){
  const d=document.createElement("div");d.className="toast";d.textContent=t;
  $("toasts").appendChild(d);
  setTimeout(()=>{d.style.opacity="0";d.style.transition="opacity .4s";},2600);
  setTimeout(()=>d.remove(),3100);
}
function bigToast(t){
  if(window.CC_EXTRAS&&CC_EXTRAS.maybeCelebrate(t))return;
  const d=document.createElement("div");d.className="toast big";d.textContent=t;
  $("toasts").appendChild(d);
  setTimeout(()=>{d.style.opacity="0";d.style.transition="opacity .5s";},4200);
  setTimeout(()=>d.remove(),4800);
}
let actx=null;
function sfx(freq,dur,delay){
  if(muted)return;
  try{
    if(!actx)actx=new (window.AudioContext||window.webkitAudioContext)();
    const t=actx.currentTime+(delay||0);
    const o=actx.createOscillator(),g=actx.createGain();
    o.type="triangle";o.frequency.value=freq;
    g.gain.setValueAtTime(.08,t);g.gain.exponentialRampToValueAtTime(.001,t+dur+.02);
    o.connect(g);g.connect(actx.destination);o.start(t);o.stop(t+dur+.05);
  }catch(_){}
}
function sfxIf(r,f,d){if(robots[selRobot]===r)sfx(f,d);}
