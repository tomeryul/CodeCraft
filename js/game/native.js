"use strict";
/* =====================================================================
   Running inside the native shell
   ---------------------------------------------------------------------
   The same files run in three places: a browser, an installed PWA, and a
   Capacitor app. Four things behave differently in the third, and each
   one is a real bug rather than a nicety:

     1. localStorage is not durable on iOS. WKWebView may evict it under
        storage pressure, and the entire game save lives there — a child
        could lose everything without touching the app. The save is
        mirrored into native storage and restored if it goes missing.

     2. Android's hardware back button closes the app by default. On a
        screen full of sheets that reads as a crash, so back closes the
        topmost sheet instead and only leaves from the map.

     3. target="_blank" does nothing useful in a webview, which would
        make the privacy policy link a dead end — and the stores require
        that link to work.

     4. A service worker is pointless in a packaged app (the files are
        already local) and network-first against capacitor://localhost is
        a way to fail, so registration is skipped.

   Capacitor exposes its plugins on window.Capacitor.Plugins at runtime,
   so none of this needs a bundler and the app stays zero-build. Every
   path here is guarded: in a plain browser this file does nothing.
   ===================================================================== */

function isNative(){
  return !!(window.Capacitor && typeof Capacitor.isNativePlatform==="function"
            && Capacitor.isNativePlatform());
}
function nativePlugin(name){
  return (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins[name]) || null;
}

/* ---------------- 1. the save has to survive ---------------- */
/* Mirrored, not moved: localStorage stays the source of truth so every
   read path in the game is unchanged and synchronous. The native copy is
   only ever consulted when the fast one has vanished. */
let mirrorT=null, mirrorQ={};
function nativeMirror(key,value){
  const P=nativePlugin("Preferences"); if(!P)return;
  mirrorQ[key]=value;
  clearTimeout(mirrorT);
  mirrorT=setTimeout(()=>{
    const q=mirrorQ; mirrorQ={};
    for(const k in q){
      if(q[k]===null)P.remove({key:k}).catch(()=>{});
      else P.set({key:k,value:q[k]}).catch(()=>{});
    }
  },800);
}
/* Runs before the splash lets anyone in. If the device threw away the web
   copy but the native one is still there, put it back and start again —
   a reload is cheap next to losing a child's whole game. */
async function nativeRestore(){
  const P=nativePlugin("Preferences"); if(!P)return false;
  let restored=false;
  for(const key of [SAVE_KEY,AGE_KEY,SB_AUTH_KEY]){
    try{
      if(localStorage.getItem(key)!==null)continue;
      const r=await P.get({key});
      if(r&&r.value){localStorage.setItem(key,r.value);restored=true;}
    }catch(_){}
  }
  return restored;
}

/* ---------------- 2. the back button ---------------- */
/* Topmost first, so back unwinds the screens in the order they were
   opened. The age gate is not in this list on purpose: it is a gate, and
   backing out of it would be a way around it. */
const BACK_ORDER=[
  {sel:"#delacc",  close:()=>{ if(typeof closeDeleteAccount==="function")closeDeleteAccount(); }},
  {sel:"#report",  close:()=>$("report").classList.remove("open")},
  {sel:"#guide",   close:()=>$("guide").classList.remove("open")},
  {sel:"#funcLib", close:()=>$("funcLib").classList.remove("open")},
  {sel:"#projects",close:()=>$("projects").classList.remove("open")},
  {sel:"#quests",  close:()=>$("quests").classList.remove("open")},
  {sel:"#mentor",  close:()=>$("mentor").classList.remove("open")}
];
function nativeBack(){
  if(document.getElementById("agegate")&&$("agegate").classList.contains("open"))return true;
  const shop=$("shopWrap");
  if(shop&&getComputedStyle(shop).display!=="none"){
    if(typeof closeShop==="function")closeShop(); else shop.style.display="none";
    return true;
  }
  for(const o of BACK_ORDER){
    const el=document.querySelector(o.sel);
    if(el&&el.classList.contains("open")){o.close();return true;}
  }
  const ed=$("editor");
  if(ed&&ed.classList.contains("open")){ed.classList.remove("open","max");return true;}
  const anySheet=document.querySelector(".sheet.open");
  if(anySheet){anySheet.classList.remove("open");return true;}
  return false;                       // nothing left to close — leave the app
}

/* ---------------- 3. links that leave the app ---------------- */
function openExternal(url){
  const B=nativePlugin("Browser");
  if(B){B.open({url,presentationStyle:"popover"}).catch(()=>{});return;}
  window.open(url,"_blank","noopener");
}
/* privacy.html ships inside the bundle, so in the app it is a local page
   rather than a link out — but _blank still has to be intercepted or it
   opens a webview with no way back. */
function nativeLinks(){
  document.addEventListener("click",e=>{
    const a=e.target&&e.target.closest&&e.target.closest('a[target="_blank"]');
    if(!a)return;
    const href=a.getAttribute("href")||"";
    if(!href)return;
    e.preventDefault();
    openExternal(new URL(href,location.href).href);
  },true);
}

/* ---------------- boot ---------------- */
function nativeInit(){
  if(!isNative())return Promise.resolve(false);
  document.documentElement.classList.add("native");
  nativeLinks();
  const App=nativePlugin("App");
  if(App&&App.addListener){
    App.addListener("backButton",()=>{ if(!nativeBack())App.exitApp(); });
    // a home-button press is the most likely moment to lose the app, so
    // flush rather than wait out the autosave interval
    App.addListener("appStateChange",s=>{ if(s&&!s.isActive&&typeof saveNow==="function")saveNow(); });
  }
  const SB=nativePlugin("StatusBar");
  if(SB&&SB.setStyle)SB.setStyle({style:"DARK"}).catch(()=>{});
  return nativeRestore().then(restored=>{
    if(!restored)return false;
    // boot already gave up and started a new game against the empty
    // localStorage, so freeze saving before that blank state can be written
    // over what we just recovered, then start again from the restored copy.
    saveOff=true;
    location.reload();
    return true;
  });
}
