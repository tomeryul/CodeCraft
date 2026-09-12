"use strict";
/* =====================================================================
   How a web page is built — ten steps, ending in a hat
   ---------------------------------------------------------------------
   A tour of the front end, taken inside the tool rather than beside it.
   Every step names one real idea, says it in a sentence, and then WATCHES
   the piece: the step is done when the piece actually has the thing, not
   when a Next button is pressed. Nothing here can be clicked through.

   The order is the order the ideas depend on each other, and the last one
   is the point of the whole thing — the player has a hat their robot
   wears, made of divs and CSS rules they wrote.

   A goal is a plain predicate over the piece being edited, so it can never
   go out of step with the editor: there is nothing to keep in sync, only
   the same state read a second way.
   ===================================================================== */

/* the working piece, however it is being edited right now */
function feWork(){ return {parts:mkParts,root:mkRoot}; }
function feGroups(){ return new Set(mkParts.map(p=>p.cls)).size; }
function feHas(fn){ return mkParts.some(fn); }
/* a box that is holding something */
function feHolder(){
  return mkParts.find(p=>mkParts.some(q=>q.pin===p.pid))||null;
}

const FE_STEPS=[
  {id:"box", title:"A box is a &lt;div&gt;",
   say:"Everything on a web page is a box. Tap ＋ to make one — that is a <div>, the tag every page is made of.",
   done:()=>mkParts.length>=1},

  {id:"size", title:"width and height",
   say:"Drag its corner to make it wide and low, near the bottom. In the code that is width and height — a share of the box it lives in.",
   done:()=>feHas(p=>p.w>=55&&p.h<=30&&p.y>=45)},

  {id:"round", title:"border-radius",
   say:"Tap Pill under the boxes. border-radius rounds the corners — at 50% a box becomes a circle. Now it is a brim.",
   done:()=>feHas(p=>p.w>=55&&p.h<=30&&p.r>=40)},

  {id:"two", title:"A second box",
   say:"Add another box above the brim and give it a colour. Two boxes, two rules — that is a stylesheet.",
   done:()=>feGroups()>=2},

  {id:"nest", title:"Boxes hold boxes",
   say:"Open the Layout tab and set <b>Inside</b> to the other box. Now one &lt;div&gt; is inside the other, the way every page is nested.",
   done:()=>feHas(p=>p.pin!=null)},

  {id:"pad", title:"padding",
   say:"On the Layout tab, give the outer box some <b>padding</b>. That is the space inside it, between its border and what it holds — so what is inside gets pushed in.",
   done:()=>{const h=feHolder();return !!h&&CC_WEAR.field(h,"pad")>=4;}},

  {id:"flex", title:"display: flex",
   say:"Choose the outer box, open Layout and set <b>display</b> to row. It stops letting each box say where it goes and starts placing them itself — watch left and top vanish from the code.",
   done:()=>{const h=feHolder();return !!h&&CC_WEAR.field(h,"lay")!==0;}},

  {id:"center", title:"justify-content",
   say:"Now set <b>justify-content</b> to center, on the same tab. This is how the web centres things — a word, not a sum you worked out yourself.",
   done:()=>{const h=feHolder();return !!h&&CC_WEAR.field(h,"lay")!==0&&CC_WEAR.field(h,"jus")===1;}},

  {id:"share", title:"One class, many elements",
   say:"Select the inner box and press Copy. Both copies share one class — change the rule and both change. That is a component.",
   done:()=>{
     const n={}; for(const p of mkParts)n[p.cls]=(n[p.cls]||0)+1;
     return Object.keys(n).some(k=>n[k]>=2);
   }},

  {id:"hat", title:"Make it yours",
   say:"Rename a class, pick your colours, try it on Walk and Chop — then Save. Your robot is about to wear a hat you wrote in HTML and CSS.",
   done:()=>myWear().some(p=>p.kind==="parts"&&(p.parts||[]).length>=2)}
];

function feStep(){ return Math.max(0,Math.min(FE_STEPS.length,(player.feTut|0))); }
function feOn(){ return player.feTut!=null&&feStep()<FE_STEPS.length; }
function feStart(){
  player.feTut=0;
  saveSoon();
  if($("maker").classList.contains("open"))mkRender();
  else{ makerOpen(mkSlot||"hat",null); }
}
function feStop(){ player.feTut=null; saveSoon(); mkRender(); }

/* Called after anything that could have changed the piece. A step is done
   when the piece has the thing, so there is no Next to press and no way to
   skip a idea by pressing it. */
function feCheck(){
  if(!feOn())return false;
  const at=feStep(), s=FE_STEPS[at];
  if(!s||!s.done())return false;
  player.feTut=at+1;
  saveSoon();
  if(typeof sfx==="function"){sfx(700,.06);sfx(940,.07,.08);}
  if(player.feTut>=FE_STEPS.length){
    if(typeof bigToast==="function")bigToast("🎩 You built a hat out of HTML and CSS!");
    if(typeof confetti==="function")confetti();
  }
  return true;
}

/* the banner: which step, what to do, and how far along */
function feBanner(){
  const wrap=document.createElement("div");
  if(!feOn()){
    if(player.feTut!=null)return wrap;   /* finished: out of the way */
    wrap.className="fe-offer";
    const b=document.createElement("button");b.type="button";b.className="mk-btn fe-go";
    b.textContent="Learn how a web page is built";
    b.addEventListener("click",feStart);
    wrap.appendChild(b);
    return wrap;
  }
  const at=feStep(), s=FE_STEPS[at];
  wrap.className="fe-bar";
  const head=document.createElement("div");head.className="fe-head";
  const n=document.createElement("span");n.className="fe-n";
  n.textContent=(at+1)+"/"+FE_STEPS.length;
  head.appendChild(n);
  const t=document.createElement("span");t.className="fe-title";t.innerHTML=s.title;
  head.appendChild(t);
  const x=document.createElement("button");x.type="button";x.className="fe-x";
  x.textContent="✕";x.setAttribute("aria-label","Stop the lesson");
  x.addEventListener("click",feStop);
  head.appendChild(x);
  wrap.appendChild(head);
  const say=document.createElement("div");say.className="fe-say";say.innerHTML=s.say;
  wrap.appendChild(say);
  const bar=document.createElement("div");bar.className="fe-dots";
  for(let i=0;i<FE_STEPS.length;i++){
    const d=document.createElement("i");
    d.className="fe-dot"+(i<at?" got":(i===at?" now":""));
    bar.appendChild(d);
  }
  wrap.appendChild(bar);
  return wrap;
}
