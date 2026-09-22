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

     2. Android's hardware back button closes the app by default. On an
        open sheet that reads as a crash, so it is routed through the same
        navBack() the ‹ in every header uses, and only leaves from the map.

     3. target="_blank" does nothing useful in a webview, which would
        make the privacy policy link a dead end — and the stores require
        that link to work.

     4. A service worker is pointless in a packaged app (the files are
        already local) and network-first against capacitor://localhost is
        a way to fail, so registration is skipped.

     5. The launch screen used to vanish the moment the webview loaded —
        before the game had drawn anything — which reads as a flash of an
        empty purple rectangle. It now waits for the first real screen and
        then fades, with a timer so a failure can never trap the app on it.

     6. iPhones have no navigator.vibrate at all, so the game had no touch
        feedback on the device most children hold. ccFeel() below speaks to
        the Taptic Engine when it is there and to vibrate() when it is not.

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
/* Back means ONE thing in this game, and js/game/nav.js owns it: one step,
   to wherever you came from — which from a destination sheet is the menu.
   The hardware button therefore calls the same navBack() the ‹ in every
   header calls. It deliberately does NOT keep its own list of sheets: the
   one it used to keep went stale the moment the menu, Style, the maker,
   Orders and Settings were added, and a second navigation model on Android
   is exactly what nav.js was written to get rid of.

   Three screens are handled before it, because each is a modal that owns
   its own way out rather than a step in the journey. The age gate is the
   important one: it is a gate, and backing out of it would be a way
   around it. */
function nativeBack(){
  const gate=$("agegate");
  if(gate&&gate.classList.contains("open"))return true;

  const del=$("delacc");
  if(del&&del.classList.contains("open")){
    if(typeof closeDeleteAccount==="function")closeDeleteAccount();
    else del.classList.remove("open");
    return true;
  }
  /* By the class, never by computed display: the shop became a sheet that
     is always display:block and hides with opacity, so asking the style
     system whether it is visible answers "yes" on an empty map — and the
     inline display:none that used to follow broke the shop for good. */
  const shop=$("shopWrap");
  if(shop&&shop.classList.contains("open")){
    if(typeof closeShop==="function")closeShop(); else shop.classList.remove("open");
    return true;
  }
  /* The menu is the top of the journey: one step back from it is the
     world. navBack() would close it and open it again. */
  const hub=$("hub");
  if(hub&&hub.classList.contains("open")&&!document.querySelector(".sheet.open:not(#hub)")){
    if(typeof hubClose==="function")hubClose(); else hub.classList.remove("open");
    return true;
  }
  if(document.querySelector(".sheet.open")){
    if(typeof navBack==="function")navBack();
    else document.querySelector(".sheet.open").classList.remove("open");
    return true;
  }
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

/* ---------------- 5. the launch screen hands over ---------------- */
/* launchAutoHide is false in capacitor.config.json, so nothing hides the
   launch screen unless this does. boot.js calls it once the first real
   screen — the age gate or the splash — is in the page and has painted.

   The timer is the reason that is safe. It is set here, at load, before
   any of the game's own code has had a chance to throw: if boot never
   gets as far as calling this, the launch screen still lifts after four
   seconds rather than sitting over a broken app for ever. */
let nativeSplashDone=false;
function nativeSplashHide(){
  if(nativeSplashDone)return;
  nativeSplashDone=true;
  const S=nativePlugin("SplashScreen");
  if(S&&S.hide)S.hide({fadeOutDuration:180}).catch(()=>{});
}
if(isNative())setTimeout(nativeSplashHide,4000);

/* ---------------- 6. one voice for the hand ---------------- */
/* Four kinds, and only four, because CLAUDE.md is explicit that feedback
   has to earn its place: a SNAP (a block landing, a sheet coming loose), a
   COMMIT (a sheet thrown away, a window resized), a SUCCESS (a challenge
   solved) and an ERROR (a run that failed). Anything that is not one of
   those should not be buzzing.

   Native: Capacitor's Haptics, which is UIFeedbackGenerator on iOS and so
   obeys the phone's own System Haptics switch — the platform owns that
   choice, not the game. Web: navigator.vibrate, which on Android is an
   audible motor, so it answers the game's Sound toggle. iPhone Safari has
   no vibrate at all, and gets nothing, correctly. */
const FEEL_WEB={snap:8,commit:14,success:[12,50,20],error:[28,40,28]};
function ccFeel(kind){
  const H=nativePlugin("Haptics");
  if(H){
    try{
      if(kind==="success")H.notification({type:"SUCCESS"}).catch(()=>{});
      else if(kind==="error")H.notification({type:"ERROR"}).catch(()=>{});
      else H.impact({style:kind==="commit"?"MEDIUM":"LIGHT"}).catch(()=>{});
    }catch(_){}
    return;
  }
  if(typeof muted!=="undefined"&&muted)return;
  try{ if(navigator.vibrate)navigator.vibrate(FEEL_WEB[kind]||8); }catch(_){}
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
