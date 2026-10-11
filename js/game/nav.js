"use strict";
/* =====================================================================
   Back and Exit, meaning the same thing on every screen
   ---------------------------------------------------------------------
   Before this file there were two ✕ buttons a few pixels apart inside a
   challenge — #mgExitBtn in the challenge header and #edClose in the
   editor header — and they did different things. One went back to the
   list, the other dropped you straight into the world. Same glyph, same
   corner of the screen, different outcome.

   One rule now, everywhere:

     ‹  BACK  one step, to wherever you came from
     ✕  EXIT  all the way out to the world

   Back is on the left of every header, Exit on the right, and neither
   ever means the other. Back is hidden where there is nothing behind you
   (the world editor, and the menu itself, which is the top).
   ===================================================================== */
(function(){
if(window.__nav)return; window.__nav=1;

/* The destination sheets. #splash, #agegate and #delacc are modal — they
   own their own buttons and must not gain a Back to somewhere behind. */
/* every sheet there is: "go home" closes each of these. delacc was missing,
   so the delete-account page survived going home and sat under whatever
   opened next (docs/design-audit.md, bug 1). */
const SHEETS=["editor","mentor","quests","hub","projects","guide","funcLib","orders","style","maker","report","settings","delacc"];
const has=n=>typeof window[n]==="function";

const ICON_BACK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" '+
  'stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';
/* the same two glyphs #edMax uses, so shrink means one thing everywhere */
const ICON_SIZE=
  '<svg class="ic-max" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" '+
  'stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>'+
  '<svg class="ic-min" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" '+
  'stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';

/* The shop is a wrapper of its own (#shopWrap, with its own backdrop)
   rather than a .sheet, and "go home" used to leave it open: every page
   opened afterwards landed underneath it, and closing that page revealed
   the shop again (game-app-design §2: one stack). Home closes it too. */
function closeAll(){
  window.mgOriginHint=null;     // out of every page: a level opened next came from nowhere behind
  SHEETS.forEach(id=>{const e=$(id); if(e)e.classList.remove("open");});
  const shop=$("shopWrap"); if(shop)shop.classList.remove("open");
}

/* Exit: out to the world from anywhere, with the challenge torn down so
   the next one does not open on top of it. */
function navHome(){
  if(typeof mgState!=="undefined"&&mgState&&has("mgExit"))mgExit(false);
  closeAll();
  if(has("sfx"))sfx(430,.05);
}

/* Back: exactly one step. Inside a challenge that is the page the
   challenge was opened from, which mgExit now restores; from a
   destination page it is the menu; from the menu there is nothing. */
function navBack(){
  if($("editor").classList.contains("mg")){ if(has("mgExit"))mgExit(true); return; }
  /* Two pages that were opened FROM another page rather than from the
     menu, so one step back is the page behind, not the menu. A component
     is no longer a sheet of its own — it is the maker filtered to one
     class — so the step before Style is dropping that filter. */
  if($("maker")&&$("maker").classList.contains("open")){
    if(typeof mkFocus!=="undefined"&&mkFocus!=null&&has("renderMaker")){
      mkFocus=null; renderMaker(); if(has("sfx"))sfx(500,.04); return;
    }
    if(has("makerClose")){ makerClose(); if(has("sfx"))sfx(500,.04); return; }
  }
  /* in the same task as the close, so the menu takes the page's place
     instead of rising after it has sunk (see swap below) */
  swapBack=true;
  closeAll();
  if(has("hubOpen"))hubOpen();
  if(has("sfx"))sfx(500,.04);
}

/* =====================================================================
   One page that changes, not two sheets that cross
   ---------------------------------------------------------------------
   Every destination is a sheet of its own, so going from the menu to the
   Academy used to be two surfaces passing each other: the menu sinking
   off the bottom while the Academy rose behind it — for a moment two
   panels, the old one looking as if it shrank. A player moving between
   pages never left the panel, so the panel should not move.

   When one page closes and another opens in the same task, the new one
   takes the old one's place without a slide: the old one, held where it
   is and lifted above, fades out over the new one, whose contents come in
   a short step from the side — from the right going deeper, from the left
   coming Back, the way the ‹ points. Same frame, same height, so all the
   eye sees is the contents changing. Where the heights differ the top
   edge glides from one to the other.

   Arriving from the world and leaving to it are untouched: a page still
   rises from the bottom and sinks back the way it came. Reduced motion
   keeps the cross-fade and drops the step and the glide.
   ===================================================================== */
const SWAP_ID=SHEETS.concat(["shopWrap"]);
const frameOf=el=>el.id==="shopWrap"?$("shop"):el;
let swapBack=false, live=null;
const imp=(el,p,v)=>el.style.setProperty(p,v,"important");
function restBox(el){
  let t=0,l=0;
  for(let n=el;n;n=n.offsetParent){t+=n.offsetTop;l+=n.offsetLeft;}
  return {t,l,w:el.offsetWidth,h:el.offsetHeight};
}
function reduced(){try{return matchMedia("(prefers-reduced-motion: reduce)").matches;}catch(_){return false;}}
const isHead=c=>c.classList&&(c.classList.contains("m-head")||c.classList.contains("v5-head")||c.classList.contains("ed-head"));

/* puts everything where the classes say, at once — the end of a swap, or
   an interrupted one when the next tap comes first */
function settle(){
  if(!live)return;
  const L=live; live=null;
  for(const a of L.anims)a.cancel();
  for(const f of L.undo)f();
  void document.body.offsetHeight;         // the jumps land with no transition
  for(const f of L.after)f();
}
function swap(A,B){
  settle();
  // Back: the ‹, the menu (it is the top), or out of a level to its list
  const back=swapBack||B.id==="hub"||A.id==="editor";
  const fa=frameOf(A), fb=frameOf(B);
  if(!fa||!fb||typeof fa.animate!=="function")return;
  // only two frames that are the same shape in the same place can be one
  const ra=restBox(fa), rb=restBox(fb), now=fa.getBoundingClientRect();
  if(Math.abs(ra.l-rb.l)>2||Math.abs(ra.w-rb.w)>2||Math.abs(ra.t+ra.h-(rb.t+rb.h))>2)return;
  if(now.height<2||now.top>innerHeight-40)return;   // the old one was never really there
  const hold=getComputedStyle(fa).transform, base=hold==="none"?"":hold+" ";
  const d=now.top-rb.t;                    // > 0: the new top edge starts lower, and rises
  const calm=reduced(), dir=back?-1:1;
  const css=getComputedStyle(document.documentElement);
  const EASE=css.getPropertyValue("--ease-settle").trim()||"ease-out";
  /* the old contents are gone in a blink and the new ones start a beat
     later, so the two pages are never read on top of each other */
  const MOVE=calm?160:(parseFloat(css.getPropertyValue("--dur-move"))||.28)*1000, FADE=calm?120:110, LAG=calm?40:50, STEP=24;
  const L={anims:[],undo:[],after:[]}; live=L;
  // set an inline !important value for the swap, and put it back after
  const put=(el,p,v,late)=>{
    const o=el.style.getPropertyValue(p), pr=el.style.getPropertyPriority(p);
    imp(el,p,v);
    (late?L.after:L.undo).push(()=>{if(o)el.style.setProperty(p,o,pr);else el.style.removeProperty(p);});
  };
  const wrap=$("shopWrap"), scrim=$("scrim");
  // no slides: neither frame moves on its CSS curve, and the dim stays as dim as it was
  for(const el of [fa,fb])put(el,"transition","none",true);
  if(A===wrap||B===wrap){
    put(wrap,"transition","none",true);
    if(scrim)put(scrim,"transition","none",true);
  }
  // the old page stays exactly where it is, above the new one, and lets taps through
  put(fa,"transform",hold);
  put(A,"pointer-events","none",true);
  if(A===wrap){put(wrap,"opacity","1");put(wrap,"background","transparent");}
  const z=el=>parseInt(getComputedStyle(el).zIndex,10)||0;
  put(A,"z-index",String(Math.max(z(A),z(B))+1),true);
  const go=(el,kf,o)=>{const a=el.animate(kf,o);L.anims.push(a);return a;};
  const out=[{opacity:1,transform:hold},{opacity:0,transform:base+"translateY("+(calm?0:Math.max(0,-d))+"px)"}];
  go(fa,out,{duration:FADE,easing:"linear",fill:"forwards"});
  if(!calm&&d>0)go(fb,[{transform:"translateY("+d+"px)"},{transform:"translateY(0)"}],{duration:MOVE,easing:EASE});
  for(const c of fa.children)if(!isHead(c)&&!calm){
    const t=getComputedStyle(c).transform, b=t==="none"?"":t+" ";
    go(c,[{transform:b+"translateX(0)"},{transform:b+"translateX("+(-dir*STEP)+"px)"}],{duration:FADE,easing:EASE,fill:"forwards"});
  }
  for(const c of fb.children)if(!isHead(c)){
    const t=getComputedStyle(c).transform, b=t==="none"?"":t+" ";
    go(c,calm?[{opacity:0},{opacity:1}]:
      [{opacity:0,transform:b+"translateX("+(dir*STEP)+"px)"},{opacity:1,transform:b+"translateX(0)"}],
      {duration:MOVE,delay:LAG,easing:calm?"linear":EASE,fill:"backwards"});
  }
  // done when the motion is done (cancel() rejects: an interrupted swap settled already)
  Promise.all(L.anims.map(a=>a.finished)).then(()=>{if(live===L)settle();},()=>{});
}
function watchSwaps(){
  const els=SWAP_ID.map(id=>$(id)).filter(Boolean);
  const mo=new MutationObserver(recs=>{
    /* an element can be written several times in one task (closeAll
       touches every sheet): compare where it started with where it is */
    const first=new Map();
    for(const r of recs)if(!first.has(r.target))first.set(r.target,/(^|\s)open(\s|$)/.test(r.oldValue||""));
    const gone=[],came=[];
    for(const [el,was] of first){
      const is=el.classList.contains("open");
      if(was&&!is)gone.push(el); else if(!was&&is)came.push(el);
    }
    const back=swapBack; swapBack=false;
    if(came.length!==1||!gone.length)return;
    // two pages closing for one (rare): the one on top is the one being replaced
    const A=gone.sort((p,q)=>(parseInt(getComputedStyle(q).zIndex,10)||0)-(parseInt(getComputedStyle(p).zIndex,10)||0))[0];
    swapBack=back;
    try{swap(A,came[0]);}catch(_){settle();}
    swapBack=false;
  });
  for(const el of els)mo.observe(el,{attributes:true,attributeFilter:["class"],attributeOldValue:true});
  // a press during a swap means the player is already on the new page
  document.addEventListener("pointerdown",()=>{if(live)settle();},true);
}

/* Every header gets the pair. Injected rather than written into ten
   headers by hand so a sheet added later cannot quietly miss one. */
function fit(id){
  const sheet=$(id); if(!sheet)return;
  const head=sheet.querySelector(".m-head"); if(!head)return;

  if(!head.querySelector(".iconbtn.back") && id!=="hub"){
    const b=document.createElement("button");
    b.className="iconbtn back"; b.id=id+"Back";
    b.title="Back"; b.setAttribute("aria-label","Back");
    b.innerHTML=ICON_BACK;
    b.addEventListener("click",navBack);
    head.insertBefore(b,head.firstChild);
  }
  /* Shrink, on every page, next to Back. It clicks #edMax rather than
     setting a size itself: that keeps one source of truth, so the camera
     offset in render.js and the size a challenge restores on exit all
     stay in step with what the player last chose. */
  if(!head.querySelector(".iconbtn.size")){
    const b=document.createElement("button");
    b.className="iconbtn size"; b.id=id+"Size";
    b.title="Shrink or expand"; b.setAttribute("aria-label","Shrink or expand");
    b.innerHTML=ICON_SIZE;
    /* The maker is the one sheet whose size is not the shared preference —
       a pinned canvas does not fit in 56vh — so its control is its own:
       the canvas gives its height to the dock, and takes it back. */
    b.addEventListener("click",()=>{
      if(id==="maker"&&has("makerWideToggle")){ makerWideToggle(); return; }
      const m=$("edMax"); if(m)m.click();
    });
    const back=head.querySelector(".iconbtn.back");
    head.insertBefore(b,back?back.nextSibling:head.firstChild);
  }
  sheet.classList.add("sized");

  /* The ✕ each sheet already had closed only itself, which from a page
     three levels in left the ones behind it open. */
  const x=head.querySelector(".iconbtn.x");
  if(x&&!x.dataset.nav){
    x.dataset.nav="1";
    x.title="Exit to the world"; x.setAttribute("aria-label","Exit to the world");
    x.addEventListener("click",navHome);
  }
}

/* #editor.max is the source of truth; body mirrors it so every other
   sheet can size itself from the same state without knowing about the
   editor. */
function mirrorSize(){
  document.body.classList.toggle("sheets-full",
    $("editor").classList.contains("max"));
}

function wire(){
  SHEETS.forEach(fit);
  mirrorSize();
  watchSwaps();
  new MutationObserver(mirrorSize).observe($("editor"),
    {attributes:true,attributeFilter:["class"]});

  /* #projects came with its own back arrow from the menu work; give it
     the shared handler rather than a second button beside it. */
  const pb=$("projBack");
  if(pb&&!pb.dataset.nav){pb.dataset.nav="1";pb.addEventListener("click",navBack);}

  /* The challenge header's ✕ was the one that meant "back to the list".
     It keeps that job and stops looking like the Exit next to it. */
  const mx=$("mgExitBtn");
  if(mx){
    mx.innerHTML=ICON_BACK;
    mx.classList.add("back");
    mx.title="Back to the list"; mx.setAttribute("aria-label","Back to the list");
  }
  /* #edClose is the editor's Exit and already tore the challenge down;
     it now goes through the same path as every other ✕. */
  const ec=$("edClose");
  if(ec&&!ec.dataset.nav){
    ec.dataset.nav="1";
    ec.title="Exit to the world"; ec.setAttribute("aria-label","Exit to the world");
  }
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",wire);
else wire();

window.navBack=navBack; window.navHome=navHome;
})();
