"use strict";
/* =====================================================================
   The tab bar — four places, always in the same spot
   ---------------------------------------------------------------------
   Everything that was not the world sat behind one ☰, in a menu of three
   groups. A phone app keeps its places where the thumb already is: a bar
   along the bottom, one tab each, the one you are on lit. So:

     World    the world itself — the tab with no sheet over it
     Play     Academy, chapters, builds, Cyber Lab, Tower, Community
     Create   a challenge of your own, your levels, your functions
     Me       your robot and level, and the Shop, Style, Settings, Quests

   A tab raises its page as the same half/full sheet every destination
   already is (hub.js shows one group per tab), so nothing about sheets
   changed: they still rise from the world and sink back into it, and a
   page that replaces a page still swaps in place (nav.js). The bar sits
   over the sheet; the sheet keeps its content clear of it (tabbar.css).

   Which tab is lit is READ from what is open, never kept on the side: a
   shop opened by the journey lights Me, a level list opened by Back lights
   Play. And the bar is not there when the screen belongs to something
   else — a level, the code editor, the mentor, the wear maker — the way
   an app hides its tab bar for a full-screen task.

   Pressing the tab you are on goes back to its start, as on an iPhone:
   from a page inside it to the tab's own page, from the top of that page
   to the top of its list, and on World to your robot.
   ===================================================================== */
(function(){
if(window.__tabbar)return; window.__tabbar=1;

const bar=$("tabbar"); if(!bar)return;
const pill=bar.querySelector(".tb-pill");
const ORDER=["world","play","create","me"];
const btn=k=>bar.querySelector('.tb[data-tab="'+k+'"]');
const has=n=>typeof window[n]==="function";
const isOpen=id=>{const e=$(id);return !!e&&e.classList.contains("open");};

/* a screen of its own: the bar steps aside */
const OWN=["editor","mentor","maker","report","delacc"];
/* the pages that belong to a tab without being its first page */
const PAGE_OF={shopWrap:"me",settings:"me",style:"me",quests:"me",orders:"me",
  funcLib:"create",guide:"create"};

function covered(){
  if(OWN.some(isOpen))return true;
  for(const id of ["splash","agegate"]){
    const e=$(id); if(!e)continue;
    if(e.classList.contains("open"))return true;
    if(id==="agegate"&&getComputedStyle(e).display!=="none")return true;
  }
  return false;
}
/* which tab the screen is on, from what is open — the one source of truth */
function current(){
  if(isOpen("hub"))return has("hubTabNow")?hubTabNow():"play";
  if(isOpen("projects")){
    const k=has("hubPageTab")?hubPageTab($("projects").dataset.page):null;
    return k||"play";
  }
  for(const id in PAGE_OF)if(isOpen(id))return PAGE_OF[id];
  return "world";
}

let lit=null, off=null;
function place(){
  const b=btn(lit); if(!b||!pill)return;
  pill.style.width=b.offsetWidth+"px";
  pill.style.transform="translateX("+b.offsetLeft+"px)";
}
function sync(){
  const hide=covered();
  if(hide!==off){
    off=hide;
    document.body.classList.toggle("tb-off",hide);
    document.body.classList.toggle("tb-on",!hide);
  }
  const k=current();
  /* a page opened from somewhere else (the journey's "open the Shop") still
     belongs to its tab, and Back from it should land there */
  if(k!=="world"&&!isOpen("hub")&&has("hubTabSet"))hubTabSet(k);
  if(k===lit)return;
  lit=k;
  for(const t of ORDER){
    const b=btn(t); if(!b)continue;
    b.setAttribute("aria-selected",t===k?"true":"false");
    b.tabIndex=t===k?0:-1;
  }
  place();
}

function go(k){
  const cur=current(), from=ORDER.indexOf(cur), to=ORDER.indexOf(k);
  if(k==="world"){
    if(cur==="world"){ const c=$("centerBtn"); if(c)c.click(); return; }
    if(has("navHome"))navHome();
    return;
  }
  if(cur===k){
    /* the tab's own page, at the top: back to the start of its list */
    if(isOpen("hub")&&!Object.keys(PAGE_OF).some(isOpen)&&!isOpen("projects")){
      const body=$("hubBody");
      if(body)body.scrollTo({top:0,behavior:"smooth"});
      return;
    }
    if(has("navTab"))navTab(k,-1);      // a page inside it: one step, back to its start
    return;
  }
  if(has("navTab"))navTab(k,to>from?1:-1);
}

/* The glyph of the tab you pressed gives under the thumb and springs back —
   the hand pushed it, so this is --ease-carry's one overshoot, and it is the
   only motion on the bar besides the pill. Not on the tab you were already
   on, and not under reduced motion. */
function pop(b){
  const ic=b.querySelector(".tb-ic"); if(!ic||typeof ic.animate!=="function")return;
  try{ if(matchMedia("(prefers-reduced-motion: reduce)").matches)return; }catch(_){}
  const ease=getComputedStyle(document.documentElement).getPropertyValue("--ease-carry").trim()||"ease-out";
  ic.getAnimations().forEach(a=>a.cancel());
  ic.animate([{transform:"scale(.82)"},{transform:"scale(1)"}],{duration:300,easing:ease});
}
bar.addEventListener("click",e=>{
  const b=e.target.closest(".tb"); if(!b)return;
  const was=lit;
  go(b.dataset.tab);
  if(b.dataset.tab!==was)pop(b);
});
/* arrow keys move along the bar, as a tablist does */
bar.addEventListener("keydown",e=>{
  if(e.key!=="ArrowLeft"&&e.key!=="ArrowRight")return;
  const i=ORDER.indexOf(lit), n=ORDER[(i+(e.key==="ArrowRight"?1:ORDER.length-1))%ORDER.length];
  e.preventDefault(); go(n);
  const b=btn(n); if(b)b.focus();
});

/* every sheet that can be open, and the two covers */
const WATCH=["editor","mentor","quests","hub","projects","guide","funcLib","orders","style",
  "maker","report","settings","delacc","shopWrap","splash","agegate"];
function wire(){
  const mo=new MutationObserver(sync);
  for(const id of WATCH){
    const e=$(id);
    if(e)mo.observe(e,{attributes:true,attributeFilter:["class","style"]});
  }
  addEventListener("resize",place);
  sync();
  /* the first placement does not glide in from the left edge */
  requestAnimationFrame(()=>requestAnimationFrame(()=>{place();bar.classList.add("ready");}));
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",wire);
else wire();

window.tabSync=sync;
})();
