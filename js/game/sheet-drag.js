"use strict";
/* =====================================================================
   Sheets you can pull down and throw away
   ---------------------------------------------------------------------
   Every surface in this game arrives from the bottom on a fixed CSS
   curve, and until now the only way out was to hit the ✕. A fixed curve
   is enough for something that only ever opens by a tap — CLAUDE.md says
   exactly that, and adds the condition under which it stops being enough:

     "The moment something can be dragged and released — a sheet you can
      fling shut — a fixed curve stops working: the animation has to
      start from the live on-screen value, inherit the release velocity,
      and be grabbable again mid-flight. That is a spring."

   So this file is that condition arriving. It adds three things and no
   new navigation:

     1. a 1:1 drag on the sheet's header, from the point that grabbed it;
     2. a spring that takes over at release, starting from where the
        sheet actually is and moving at the speed the finger left it;
     3. a landing decision made by PROJECTING the throw rather than by
        asking where the finger happened to stop.

   What a dismissal MEANS is not invented here. The sheet's own ✕ is
   clicked, so a fling does exactly what the control in the corner does,
   on every sheet, for ever — including the ones added after this file.

   Down and up are the same ladder, and it has three rungs: full, half,
   gone. Pulling UP climbs one, by pressing the size control the header
   has always carried. Pulling DOWN from full lands on whichever rung the
   throw would reach — a slow pull to the middle stops at half, a long
   pull or a hard flick goes all the way — on every sheet, the way an
   iOS sheet chooses between its detents.
   ===================================================================== */

/* ---------------------------------------------------------------------
   The spring
   ---------------------------------------------------------------------
   Apple's two parameters rather than the physics triplet: RESPONSE (how
   long it takes to arrive) and DAMPING (whether it overshoots). There is
   no animation library here and this needs to stay a zero-dependency
   file, so it is the closed-form solution of a damped oscillator
   stepped on rAF — which is all a spring is.

   It is exported under a different name than the function itself
   (window.ccSpring vs. spring) because in one global scope
   `window.spring = (...)=>spring(...)` would replace the declaration and
   call itself. That has cost this project an afternoon before.
   --------------------------------------------------------------------- */
function spring(from,to,v0,onFrame,onDone,opt){
  const o=opt||{};
  const zeta=o.damping==null?1:o.damping;          // 1 = no overshoot
  const T=o.response==null?0.36:o.response;        // seconds to arrive
  const w=2*Math.PI/T;
  const x0=from-to;
  let A=x0,B,wd=0;
  if(zeta<1){ wd=w*Math.sqrt(1-zeta*zeta); B=(v0+zeta*w*x0)/wd; }
  else{ B=v0+w*x0; }
  const t0=performance.now();
  let raf=0,stopped=false;
  function frame(now){
    if(stopped)return;
    const t=(now-t0)/1000;
    let x,v;
    if(zeta<1){
      const e=Math.exp(-zeta*w*t), c=Math.cos(wd*t), s=Math.sin(wd*t);
      x=e*(A*c+B*s);
      v=e*(-zeta*w*(A*c+B*s)+(-A*wd*s+B*wd*c));
    }else{
      const e=Math.exp(-w*t);
      x=e*(A+B*t);
      v=e*(B-w*(A+B*t));
    }
    /* Settled means BOTH near the target and nearly still. Position alone
       stops it dead in the middle of an overshoot. */
    if(Math.abs(x)<0.5&&Math.abs(v)<12){ onFrame(to); if(onDone)onDone(); return; }
    onFrame(to+x);
    raf=requestAnimationFrame(frame);
  }
  raf=requestAnimationFrame(frame);
  return { stop(){ stopped=true; cancelAnimationFrame(raf); } };
}
window.ccSpring=spring;

/* Where a throw would come to rest if nothing stopped it. The
   physics-textbook v²/2a is not what iOS uses; this is the exponential
   decay form from Apple's own sample code, and it is the reason a flick
   feels like it throws the sheet rather than nudging it. */
function projectThrow(v,rate){
  const d=rate==null?0.998:rate;
  return (v/1000)*d/(1-d);
}
window.ccProject=projectThrow;

(function(){
if(window.__sheetDrag)return; window.__sheetDrag=1;

const DISMISS_FRACTION=0.4;   // past this much of its own height, it goes
/* Smaller than the dismiss threshold on purpose: growing is undoable with
   the same gesture the other way, while leaving is not, so the cheap
   direction is allowed to be the easy one. */
const EXPAND_FRACTION=0.22;   // and this much upwards makes it bigger
const START_SLOP=6;           // px before a press becomes a drag
const reduced=()=>window.matchMedia&&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Two moments earn a tap on the hand, and only two: the sheet coming
   loose in your fingers, and it landing somewhere new. Putting one on
   every frame of a drag is how a game teaches players to ignore all of
   its feedback. The voice itself is ccFeel() in native.js, so it reaches
   the Taptic Engine on an iPhone rather than a vibrate() that iOS never
   had. */
function ccHaptic(kind){ if(typeof ccFeel==="function")ccFeel(kind); }

/* A sheet is grabbable by its header. Not by its body: every sheet's body
   is either a scroller or the thing the player is tapping, and stealing
   those to a drag is how you make a list impossible to use. */
/* Direct children only, so this agrees exactly with the CSS that draws
   the grip. The editor's header is rebuilt by v5-ui.js — .ed-head in the
   markup becomes .v5-head at load — which is why wiring happens again on
   `load`: the node the first pass attached to no longer exists. */
function headOf(sheet){
  return sheet.querySelector(":scope > .m-head, :scope > .v5-head, :scope > .ed-head");
}
/* Buttons, fields and anything that scrolls keep their own press. */
function grabbable(t){
  return !(t.closest("button,a,input,select,textarea,label,[contenteditable]"));
}

const st=new Map();            // sheet -> {anim, y}
function stateOf(el){ let s=st.get(el); if(!s){s={anim:null,y:0};st.set(el,s);} return s; }

function setY(el,y){
  const s=stateOf(el); s.y=y;
  el.style.transform=y?("translateY("+y+"px)"):"";
  const sc=$("scrim");
  if(sc&&y>=0){
    const h=el.offsetHeight||1;
    /* The scrim is the room behind the sheet coming back. It has to fade
       WITH the finger, not at the end, or the sheet looks like it is
       sliding over a photograph. */
    const k=Math.max(0,1-y/h);
    sc.style.opacity=openSheets()>1?"1":String(k);
  }
}
function clearY(el){
  const s=stateOf(el); s.y=0;
  el.style.transform="";
  const sc=$("scrim"); if(sc)sc.style.opacity="";
}
function openSheets(){ return document.querySelectorAll(".sheet.open").length; }

/* ---------------- the size ladder ----------------
   Sizing is ONE preference shared by every sheet: nav.js puts a size
   button in each header and that button clicks #edMax, so #editor.max is
   the state even when the editor is shut. The maker is the exception — a
   pinned canvas does not fit in 56vh — and owns its own.

   Both are CLICKED rather than reimplemented, for exactly the reason the
   ✕ is: the gesture does what the control does, so the two can never
   drift apart. */
function sizeCtl(el){
  if(el.id==="maker")return el.querySelector(".m-head .iconbtn.size");
  return $("edMax");
}
function isFull(el){
  if(el.id==="maker")return el.classList.contains("wide");
  const ed=$("editor");
  return !!ed&&ed.classList.contains("max");
}
/* body.sheets-full is how every other sheet reads the size, and nav.js
   mirrors it from #editor.max with a MutationObserver — which runs only
   after this handler returns, too late for a measurement taken inside
   it. So it is mirrored here as well, synchronously. Same rule, same
   result; the observer then finds nothing to change. */
function mirrorSize(){
  const ed=$("editor");
  if(ed)document.body.classList.toggle("sheets-full",ed.classList.contains("max"));
}
/* The height of the half rung, read off the stylesheet rather than
   restated here: flip the size, measure, flip it back, all inside one
   task, so nothing is ever painted in between. 0 when there is no half
   rung — the sheet is already small, or it is the maker, whose size
   control moves its canvas rather than its top edge. */
function halfHeight(el){
  if(el.id==="maker"||!isFull(el)||!sizeCtl(el))return 0;
  const ed=$("editor"), h=el.offsetHeight;
  el.classList.add("sheet-resize"); ed.classList.add("sheet-resize");
  ed.classList.remove("max"); mirrorSize();
  const small=el.offsetHeight;
  ed.classList.add("max"); mirrorSize();
  void el.offsetHeight;          // settle back at full before the curve returns
  el.classList.remove("sheet-resize"); ed.classList.remove("sheet-resize");
  return small<h-1?small:0;
}
/* Press the size control, and keep the sheet's top edge exactly where
   the finger left it: the height changes in one frame with no curve, the
   transform takes up the difference, and the spring carries it home from
   there at the release velocity. Without that the edge jumps the moment
   the finger lets go — the one thing a sheet under a finger must not do. */
function resize(el,vel){
  const c=sizeCtl(el); if(!c)return false;
  const ed=$("editor"), h0=el.offsetHeight, y=stateOf(el).y;
  el.classList.add("sheet-resize"); ed.classList.add("sheet-resize");
  c.click(); mirrorSize();
  const h1=el.offsetHeight;
  setY(el,y+(h1-h0));
  void el.offsetHeight;
  el.classList.remove("sheet-resize"); ed.classList.remove("sheet-resize");
  settle(el,0,vel,()=>clearY(el));
  return true;
}
/* What dismissal means is the sheet's own ✕ — never a rule invented here,
   so a sheet added next year behaves correctly without being listed. */
function dismiss(el){
  const x=el.querySelector(".m-head .iconbtn.x, .m-head .x, .v5-head .x, #edClose");
  if(x){x.click();return;}
  el.classList.remove("open");
}

function begin(e,sheet){
  const s=stateOf(sheet);
  /* Grabbing mid-flight: the spring is killed and the drag starts from
     the value on screen this instant, never from where it was heading. */
  if(s.anim){s.anim.stop();s.anim=null;}
  const startY=s.y;
  const grabY=e.clientY;
  let dragging=false, rawDy=0;
  /* A short history rather than a running average of the last two points.
     Two points is not enough: a burst of moves can share a timestamp —
     performance.now() is deliberately coarse — and every one of them then
     contributes nothing, so a genuine flick arrives at the release with a
     velocity of zero and the sheet springs back in the hand. Measuring
     across a window of real elapsed time cannot go to zero that way. */
  const VEL_WINDOW=80;                 // ms of gesture the speed is read from
  const hist=[{y:e.clientY,t:performance.now()}];
  function push(y,t){
    hist.push({y,t});
    while(hist.length>2&&t-hist[0].t>VEL_WINDOW)hist.shift();
  }
  function velocity(){
    const a=hist[0], b=hist[hist.length-1];
    const dt=b.t-a.t;
    return dt>0?(b.y-a.y)/dt*1000:0;
  }

  const head=e.currentTarget;
  try{head.setPointerCapture(e.pointerId);}catch(_){}

  function move(ev){
    const dy=ev.clientY-grabY;
    if(!dragging){
      if(Math.abs(dy)<START_SLOP)return;
      dragging=true;
      sheet.classList.add("sheet-drag");
      ccHaptic("snap");
    }
    ev.preventDefault();
    push(ev.clientY,performance.now());
    rawDy=dy;
    let y=startY+dy;
    /* Up is a boundary, not a wall: it gives, less and less, which reads
       as "there is nothing more up here" rather than "frozen". */
    if(y<0){ const h=sheet.offsetHeight||1; y=-(-y*h*0.55)/(h+0.55*(-y)); }
    setY(sheet,y);
  }

  function up(ev){
    head.removeEventListener("pointermove",move);
    head.removeEventListener("pointerup",up);
    head.removeEventListener("pointercancel",up);
    try{head.releasePointerCapture(ev.pointerId);}catch(_){}
    if(!dragging)return;
    sheet.classList.remove("sheet-drag");

    const h=sheet.offsetHeight||1;
    const y=stateOf(sheet).y;
    const vel=velocity();
    /* Not "where did the finger stop" but "where was it going". A short
       fast flick from near the top still throws the sheet away, which is
       what the hand meant and what the eye expects.

       Read off the UNDAMPED travel, not off the sheet: going down the two
       are the same number, but going up the sheet is rubber-banded and
       moves about half as far as the hand — a threshold taken from the
       sheet would quietly ask for a pull twice as long upwards. */
    const landing=startY+rawDy+projectThrow(vel);

    /* Up the ladder: bigger. Nothing lives above full height, so from
       there the sheet simply comes home. */
    if(landing<-h*EXPAND_FRACTION){
      /* no sound of its own: the size control it presses has one */
      if(!isFull(sheet)&&resize(sheet,vel)){ ccHaptic("commit"); return; }
      settle(sheet,0,vel,()=>clearY(sheet));
      return;
    }
    /* Down the ladder. From full there are two rungs below: half, sitting
       `half` px lower, and gone. The throw lands on the nearer rung, with
       leaving asking for the same 40% of the remaining height it asks for
       from the half size — so a gentle pull to the middle stops there, and
       the ✕ is only ever one long pull or one hard flick away. */
    const half=landing>0?h-halfHeight(sheet):h;     // measured only when heading down
    const goAt=half>=h?h*DISMISS_FRACTION:half+(h-half)*DISMISS_FRACTION;
    if(landing>goAt){
      /* Out the way it came in, at the speed it was thrown, and only
         then does the sheet's own ✕ run. */
      ccHaptic("commit");
      settle(sheet,h,vel,()=>{ dismiss(sheet); clearY(sheet); });
    }else if(half<h&&landing>half/2&&resize(sheet,vel)){
      ccHaptic("commit");
    }else{
      if(typeof sfx==="function"&&y>20)sfx(430,.03);
      settle(sheet,0,vel,()=>clearY(sheet));
    }
  }

  head.addEventListener("pointermove",move);
  head.addEventListener("pointerup",up);
  head.addEventListener("pointercancel",up);
}

/* The handoff: the spring starts at the sheet's live position and at the
   finger's release velocity, so there is no seam between dragging and
   animating. Overshoot only when the hand threw it — a sheet that merely
   sprang back should not bounce. */
function settle(sheet,to,vel,done){
  const s=stateOf(sheet);
  if(s.anim){s.anim.stop();s.anim=null;}
  if(reduced()){ setY(sheet,to); if(done)done(); else clearY(sheet); return; }
  sheet.classList.add("sheet-anim");
  const thrown=Math.abs(vel)>300;
  s.anim=spring(s.y,to,vel,y=>setY(sheet,y),()=>{
    s.anim=null;
    sheet.classList.remove("sheet-anim");
    if(done)done(); else clearY(sheet);
  },{damping:thrown?0.85:1,response:thrown?0.3:0.36});
}

/* Sheets are static markup, so one pass at load is enough; the guard
   makes a second call harmless if one is ever added dynamically. */
function wire(){
  document.querySelectorAll(".sheet").forEach(sheet=>{
    const head=headOf(sheet);
    if(!head||head.dataset.drag)return;
    head.dataset.drag="1";
    sheet.classList.add("grabbable");
    head.addEventListener("pointerdown",e=>{
      if(e.button)return;
      if(!grabbable(e.target))return;
      if(!sheet.classList.contains("open"))return;
      begin(e,sheet);
    });
  });
}
window.ccSheetDrag=wire;

/* ---------------------------------------------------------------------
   Swipe in from the left edge to go back
   ---------------------------------------------------------------------
   On an iPhone the left edge IS back, in every app, and here it did
   nothing. It now does exactly what the ‹ in the header does — the same
   one step, via nativeBack() in native.js, which is also what Android's
   hardware button calls — so there are three ways back and one meaning.

   It is interactive, not a trigger: the sheet follows the finger 1:1
   sideways, and at release the throw is projected, as with the vertical
   drag above. Far enough or fast enough and it slides off and the step is
   taken; otherwise it springs home, and it can be caught on the way.

   Left edge in Hebrew too. iOS mirrors the gesture only for apps that
   mirror their layout, and this one does not: the ‹ sits on the left in
   both languages, so the edge that means back is the one next to it.

   Off in a Safari tab. There the browser owns that edge — it is its own
   history-back — and two gestures on one swipe is worse than one. That is
   the one place navigator.standalone is exactly false; in the app and in
   an installed PWA it is true or absent. */
const EDGE=16;                 // px from the edge where a back-swipe can start
function edgeOn(){
  if(navigator.standalone===false)return false;
  const g=$("agegate"); if(g&&g.classList.contains("open"))return false;
  return !!document.querySelector(".sheet.open");
}
/* The sheet a step back would act on: the highest in the stack, then the
   latest in the page. */
function topSheet(){
  const open=[...document.querySelectorAll(".sheet.open")];
  let best=null,bz=-Infinity;
  open.forEach(el=>{ const z=+getComputedStyle(el).zIndex||0; if(z>=bz){bz=z;best=el;} });
  return best;
}
function setX(el,x){ el.style.transform=x?("translateX("+x+"px)"):""; }

document.addEventListener("pointerdown",e=>{
  if(e.button||e.clientX>EDGE||!edgeOn())return;
  const sheet=topSheet();
  if(!sheet||!sheet.contains(e.target))return;
  const s=stateOf(sheet);
  if(s.anim){s.anim.stop();s.anim=null;}
  const x0=e.clientX, y0=e.clientY, id=e.pointerId;
  let live=false,dead=false,dx=0;
  const hist=[{x:x0,t:performance.now()}];

  function move(ev){
    if(ev.pointerId!==id||dead)return;
    const mx=ev.clientX-x0, my=ev.clientY-y0;
    if(!live){
      /* Commit to the gesture only once it is clearly sideways; a finger
         that set off vertically was scrolling, and is left alone. */
      if(Math.abs(mx)<8&&Math.abs(my)<8)return;
      if(Math.abs(my)>Math.abs(mx)||mx<=0){dead=true;return end();}
      live=true;
      sheet.classList.add("sheet-drag");
      try{sheet.setPointerCapture(id);}catch(_){}
      ccHaptic("snap");
    }
    ev.preventDefault();
    const t=performance.now();
    hist.push({x:ev.clientX,t});
    while(hist.length>2&&t-hist[0].t>80)hist.shift();
    dx=Math.max(0,mx);                       // it only ever goes the way it came
    setX(sheet,dx);
  }
  function up(ev){
    if(ev.pointerId!==id)return;
    end();
    if(!live)return;
    const a=hist[0],b=hist[hist.length-1],dt=b.t-a.t;
    const vel=dt>0?(b.x-a.x)/dt*1000:0;
    const w=sheet.offsetWidth||window.innerWidth;
    /* A cancel is the system taking the touch away, not a throw: it
       always goes home. */
    const go=ev.type!=="pointercancel"&&dx+projectThrow(vel)>w*0.4;
    const finish=to=>{
      if(reduced()){ setX(sheet,to); return done(to); }
      sheet.classList.add("sheet-anim");
      s.anim=spring(dx,to,vel,x=>setX(sheet,x),()=>{s.anim=null;done(to);},
        {damping:1,response:0.3});
    };
    const done=to=>{
      sheet.classList.remove("sheet-anim");
      if(to>0){
        /* Off the right edge now. Take the step, then hand the transform
           back to the stylesheet with the transition still switched off,
           so the sheet does not travel from "off to the right" to "off
           the bottom" on screen. It is invisible either way. */
        ccHaptic("commit");
        if(typeof nativeBack==="function")nativeBack(); else sheet.classList.remove("open");
        setX(sheet,0);
        requestAnimationFrame(()=>requestAnimationFrame(()=>sheet.classList.remove("sheet-drag")));
      }else{ setX(sheet,0); sheet.classList.remove("sheet-drag"); }
    };
    finish(go?w:0);
  }
  function end(){
    document.removeEventListener("pointermove",move,true);
    document.removeEventListener("pointerup",up,true);
    document.removeEventListener("pointercancel",up,true);
  }
  document.addEventListener("pointermove",move,true);
  document.addEventListener("pointerup",up,true);
  document.addEventListener("pointercancel",up,true);
},true);

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",wire);
else wire();
/* Second pass after every other script has had its turn at the DOM. The
   dataset guard makes it free for the headers that were already wired. */
window.addEventListener("load",wire);
})();
