"use strict";
/* ---------------- toasts & sfx ---------------- */
/* ---------------- toasts ----------------
   Two rules, both learned the hard way: never stack the SAME line twice, and
   never let more than a few on screen at once. Removing eight decorations in
   Build mode fired eight identical banners and buried the game behind them;
   a journey step that clears several at once did the same. A repeat now bumps
   a counter on the line already showing. */
const TOAST_MAX=3;
function tArm(d,fade,gone){
  clearTimeout(d._f);clearTimeout(d._g);
  d.style.opacity="";d.style.transition="";
  d._f=setTimeout(()=>{d.style.opacity="0";d.style.transition="opacity .4s";},fade);
  d._g=setTimeout(()=>d.remove(),gone);
}
function tDrop(d){clearTimeout(d._f);clearTimeout(d._g);d.remove();}
function toast(t){
  const box=$("toasts");
  const small=[...box.querySelectorAll(".toast:not(.big)")];
  const same=small.find(d=>d.dataset.msg===t);
  if(same){
    const n=(+same.dataset.n||1)+1;
    same.dataset.n=n;same.textContent=t+"  ×"+n;
    tArm(same,2600,3100);
    return;
  }
  const d=document.createElement("div");
  d.className="toast";d.textContent=t;d.dataset.msg=t;d.dataset.n="1";
  box.appendChild(d);
  for(let i=0;i<=small.length-TOAST_MAX;i++)tDrop(small[i]);
  tArm(d,2600,3100);
}
function bigToast(t){
  if(window.CC_EXTRAS&&CC_EXTRAS.maybeCelebrate(t))return;
  const box=$("toasts");
  // one banner at a time: a big toast is an announcement, and two
  // announcements on screen at once is neither
  box.querySelectorAll(".toast.big").forEach(tDrop);
  const d=document.createElement("div");d.className="toast big";d.textContent=t;
  box.appendChild(d);
  tArm(d,4200,4800);
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
