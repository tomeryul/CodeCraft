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
const SHEETS=["editor","mentor","quests","hub","projects","guide","funcLib","orders","style","maker","report","settings"];
const has=n=>typeof window[n]==="function";

const ICON_BACK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" '+
  'stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';
/* the same two glyphs #edMax uses, so shrink means one thing everywhere */
const ICON_SIZE=
  '<svg class="ic-max" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" '+
  'stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>'+
  '<svg class="ic-min" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" '+
  'stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';

function closeAll(){
  SHEETS.forEach(id=>{const e=$(id); if(e)e.classList.remove("open");});
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
  const wasProjects=$("projects").classList.contains("open");
  closeAll();
  if(has("hubOpen"))setTimeout(hubOpen,wasProjects?120:0);
  if(has("sfx"))sfx(500,.04);
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
    b.addEventListener("click",()=>{const m=$("edMax"); if(m)m.click();});
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
