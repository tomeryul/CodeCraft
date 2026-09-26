"use strict";
/* ---------------- toasts & sfx ---------------- */
/* ---------------- toasts ----------------
   Two rules, both learned the hard way: never stack the SAME line twice, and
   never let more than a few on screen at once. Removing eight decorations in
   Build mode fired eight identical banners and buried the game behind them;
   a journey step that clears several at once did the same. A repeat now bumps
   a counter on the line already showing. */
const TOAST_MAX=3;
/* The stack used to jump. Toasts sit in a column, and every one that
   arrived or left moved the others by a whole row in a single frame —
   several times a minute, since this game narrates nearly everything.

   FLIP: note where each toast is, make the change, then start each one
   back where it WAS and let it glide to where it now is. Transform only,
   so nothing is laid out per frame; and under reduced motion the global
   rule in css/apple.css zeroes the duration, so it simply lands. A toast
   that is still in its own entrance keeps it — an animation outranks an
   inline style, and 250ms later it is settled anyway. */
function tFlip(box,change){
  if(!box){change();return;}
  const was=new Map([...box.children].map(k=>[k,k.getBoundingClientRect().top]));
  change();
  for(const k of box.children){
    const t0=was.get(k); if(t0==null)continue;      // a newcomer has its own entrance
    const dy=t0-k.getBoundingClientRect().top;
    if(Math.abs(dy)<1)continue;
    k.style.transition="none";
    k.style.transform="translateY("+dy+"px)";
    k.getBoundingClientRect();                       // commit the old position first
    /* opacity stays in the list so a toast already fading out keeps fading */
    k.style.transition="transform var(--dur-move) var(--ease-settle),opacity .2s";
    k.style.transform="";
  }
}
function tKill(d){clearTimeout(d._f);clearTimeout(d._g);d.remove();}
function tArm(d,fade,gone){
  clearTimeout(d._f);clearTimeout(d._g);
  d.style.opacity="";d.style.transition="";
  d._f=setTimeout(()=>{d.style.opacity="0";d.style.transition="opacity .2s";},fade);
  d._g=setTimeout(()=>tFlip(d.parentNode,()=>d.remove()),gone);
}
function tDrop(d){tFlip(d.parentNode,()=>tKill(d));}
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
  /* the arrival and any overflow it pushes out happen as ONE change, so
     the stack makes one move rather than two */
  tFlip(box,()=>{
    box.appendChild(d);
    for(let i=0;i<=small.length-TOAST_MAX;i++)tKill(small[i]);
  });
  tArm(d,2600,2850);
}
function bigToast(t){
  if(window.CC_EXTRAS&&CC_EXTRAS.maybeCelebrate(t))return;
  const box=$("toasts");
  // one banner at a time: a big toast is an announcement, and two
  // announcements on screen at once is neither
  const d=document.createElement("div");d.className="toast big";d.textContent=t;
  tFlip(box,()=>{
    box.querySelectorAll(".toast.big").forEach(tKill);
    box.appendChild(d);
  });
  tArm(d,4200,4450);
}
/* ---------------- the world waits its turn ----------------
   (.claude/skills/game-app-design §3.) A message is sorted by what CAUSED
   it. What the player just did answers at once — that is toast() above.
   What the world or the clock did — the market moving, night falling, an
   order arriving or filling, robots selling in the background — is news,
   and news waits until the player is back in the world with nothing else
   open. The audit found it everywhere it should not be: a new order over
   the menu, a price rush inside the shop, nightfall inside the level
   designer, a full-screen "order filled" card in the middle of a level.

   Held messages are delivered when calm returns, ONE at a time, each given
   its time in the lane before the next — two announcements a beat apart
   is the pile-up this exists to stop. Rewards go first; of the news only
   the newest three are kept. Each carries how long it stays true —
   "prices spiked for a minute" is a lie ten minutes later — and a reward
   never expires. */
const HELD=[];
let heldT=0;
function calmNow(){
  if(typeof mgState!=="undefined"&&mgState)return false;            // in a level
  if(document.querySelector(".sheet.open,#shopWrap.open,#agegate.open,#ccCele"))return false;
  const sp=$("splash"); if(sp&&!sp.classList.contains("hide"))return false;
  return true;
}
/* run(now) if the player is calm and nothing is queued, otherwise in its
   turn. `key` replaces an older copy of the same message; `ttl` ms it
   stays worth saying (Infinity for a reward); a `reward` (a card) goes
   first; `gap` is how long it holds the lane before the next one. */
function whenCalm(key,run,ttl,reward,gap){
  if(calmNow()&&!HELD.length&&!heldT){run();return;}
  for(let i=HELD.length-1;i>=0;i--)if(HELD[i].key===key)HELD.splice(i,1);
  HELD.push({key,run,at:performance.now(),ttl:ttl==null?60000:ttl,reward:!!reward,gap:gap||1100});
  const news=HELD.filter(h=>!h.reward);
  for(const h of news.slice(0,Math.max(0,news.length-3)))HELD.splice(HELD.indexOf(h),1);
  heldSoon();
}
function worldNews(t,big,ttl){ whenCalm("n:"+t,()=>(big?bigToast:toast)(t),ttl,false,big?3000:1100); }
/* After the surface that just closed has finished leaving. Scheduled once,
   not restarted: confetti adds and removes nodes for seconds, and a timer
   pushed back on every one of them never fired. */
function heldSoon(){
  if(heldT)return;
  heldT=setTimeout(()=>{heldT=0;heldFlush();},700);
}
function heldFlush(){
  if(!HELD.length||!calmNow())return;
  const t=performance.now();
  for(let i=HELD.length-1;i>=0;i--)if(t-HELD[i].at>HELD[i].ttl)HELD.splice(i,1);
  if(!HELD.length)return;
  const r=HELD.findIndex(h=>h.reward);
  const h=HELD.splice(r>=0?r:0,1)[0];
  h.run();
  // the next one waits its turn; a card instead holds calm off until it closes
  if(HELD.length)heldT=setTimeout(()=>{heldT=0;heldFlush();},h.reward?700:h.gap);
}
/* Calm returns when a surface closes or a card leaves — watch exactly
   those, not the whole document. */
function heldWatch(){
  const mo=new MutationObserver(()=>{ if(HELD.length)heldSoon(); });
  document.querySelectorAll(".sheet,#shopWrap,#agegate,#splash").forEach(el=>
    mo.observe(el,{attributes:true,attributeFilter:["class"]}));
  mo.observe(document.body,{childList:true});                        // #ccCele comes and goes
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",heldWatch);
else heldWatch();

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
