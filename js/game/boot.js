"use strict";
/* ---------------- boot ---------------- */
function newGame(){
  seed=(Math.random()*1e9)|0;
  buildTerrain();genObjects();genAnimals();
  coins=0;stash={wood:0,stone:0,iron:0,crystal:0,water:0};
  totals={collected:0,earned:0,dist:0};
  unlocks={loops:false,logic:false,smart:false,vars:false};
  player={xp:0,level:1,quests:[],lastGift:"",days:0,projects:{},projPrograms:{}};
  skills=freshSkills();
  robots=[makeRobot(homePos.x-1,homePos.y+1,"Robo-1")];
  selRobot=0;
}
// local baseline so a world exists behind the splash and the draw loop has state
isNew=!load();
if(isNew)newGame();
cam.x=(homePos.x+.5)*TILE;cam.y=(homePos.y+.5)*TILE;
fillQuests();updateQuestBadge();
renderPalette();updateChips();updateHud();updateFab();updateUndoBtns();renderProgram();renderPy();
$("questBtn").addEventListener("click",()=>{renderQuests();$("quests").classList.add("open");});
$("qClose").addEventListener("click",()=>$("quests").classList.remove("open"));

/* ---------------- splash login gate ---------------- */
function splashMsg(t){const el=$("splashStatus");if(el)el.textContent=t||"";}
/* TEMP viewport diagnostics for the iOS bottom-strip bug — shown on the splash
   only, removed when the game starts. Delete once the bug is closed. */
function vpDebug(){
  let el=document.getElementById("vpDbg");
  if(!el){
    el=document.createElement("div");el.id="vpDbg";
    el.style.cssText="position:fixed;left:10px;top:calc(env(safe-area-inset-top,0px) + 58px);z-index:200;font:10px/1.5 ui-monospace,monospace;color:#fff;opacity:.8;background:rgba(0,0,0,.5);padding:4px 8px;border-radius:8px;pointer-events:none;white-space:pre;text-align:left;";
    document.body.appendChild(el);
  }
  const probe=css=>{const d=document.createElement("div");
    d.style.cssText="position:fixed;left:0;top:0;width:1px;visibility:hidden;pointer-events:none;"+css;
    document.body.appendChild(d);const v=d.getBoundingClientRect().height;d.remove();return Math.round(v);};
  el.textContent=
    "ih "+innerHeight+"  vv "+Math.round(window.visualViewport?visualViewport.height:0)+"  scr "+screen.height+
    "\nlvh "+probe("height:100lvh")+"  svh "+probe("height:100svh")+"  dvh "+probe("height:100dvh")+
    "\nsat "+probe("height:env(safe-area-inset-top,0px)")+"  sab "+probe("height:env(safe-area-inset-bottom,0px)")+
    "  game "+Math.round(canvas.getBoundingClientRect().height)+"  dpr "+(window.devicePixelRatio||1);
}
vpDebug();setTimeout(vpDebug,700);setTimeout(vpDebug,2500);addEventListener("resize",vpDebug);
function startGame(){
  if(started)return;
  const dbg=document.getElementById("vpDbg");if(dbg)dbg.remove();
  $("splash").classList.add("hide");
  started=true;
  sfx(660,.08);sfx(880,.08,.1);
  if(isNew)say("👋 Hi! I'm Byte, your coding mentor. Follow the 3 quick steps on screen to wake up your robot — then ask me anything, anytime! 🦉",false);
  if(!tut.done)setTimeout(()=>tutSet(1),800);
  if(pendingAway){const msg=pendingAway;pendingAway=null;setTimeout(()=>bigToast(msg),1400);}
  setTimeout(dailyGift,tut.done?900:9000);
}
let entering=false;
async function enterGame(tryCloud){
  if(started||entering)return;
  entering=true;
  if(tryCloud&&sbUser&&sbReady()){
    splashMsg("☁️ Loading your world…");
    try{
      const cloud=await cloudLoad();
      if(cloud){ if(applySave(cloud)){isNew=false;refreshAllUI();} }
      else { await cloudSave(buildSave()); } // first login on this account → keep current progress
    }catch(_){ splashMsg("⚠️ Couldn't reach the cloud — playing on this device."); }
  }
  entering=false;
  startGame();
}
function renderSplashAuth(){
  const box=$("splashAuth"); if(!box)return;
  if(!sbReady()){ box.innerHTML=""; $("playBtn").textContent="▶ Play"; return; }
  if(sbUser){
    box.innerHTML='<div class="sp-welcome">☁️ Signed in as <b>'+esc(sbUser.email||"player")+'</b> · <button id="spLogout" class="sp-link">log out</button></div>';
    $("playBtn").textContent="▶ Play";
    $("spLogout").addEventListener("click",()=>{sbLogout();renderSplashAuth();});
    return;
  }
  box.innerHTML=
    '<div class="sp-card"><div class="sp-h">☁️ Sign in to save your world to your account</div>'+
    '<input id="spEmail" type="email" placeholder="Email" autocomplete="email">'+
    '<input id="spPass" type="password" placeholder="Password (6+)" autocomplete="current-password">'+
    '<div class="sp-row"><button class="authbtn go" id="spLogin">Log in</button><button class="authbtn" id="spSignup">Sign up</button></div>'+
    '<div id="spMsg" class="sp-msg"></div></div>';
  $("playBtn").textContent="▶ Play offline";
  const m=t=>{$("spMsg").textContent=t;};
  const creds=()=>[($("spEmail").value||"").trim(),$("spPass").value||""];
  $("spLogin").addEventListener("click",async()=>{
    const[e,p]=creds(); if(!e||p.length<6)return m("Enter your email and a 6+ character password");
    m("⏳ Logging in…");
    try{ sbSaveSession(await sbAuth("token?grant_type=password",{email:e,password:p})); if(typeof renderAuthBox==="function")renderAuthBox(); enterGame(true); }
    catch(err){ m("⚠️ "+err.message); }
  });
  $("spSignup").addEventListener("click",async()=>{
    const[e,p]=creds(); if(!e||p.length<6)return m("Enter your email and a 6+ character password");
    m("⏳ Creating your account…");
    try{
      const d=await sbAuth("signup",{email:e,password:p});
      if(sbSaveSession(d)){ if(typeof renderAuthBox==="function")renderAuthBox(); enterGame(true); }
      else m("📧 Check your email to confirm your address, then log in!");
    }catch(err){ m("⚠️ "+err.message); }
  });
}
renderSplashAuth();
sbRestore().then(renderSplashAuth).catch(()=>{});
$("playBtn").addEventListener("click",()=>enterGame(true));

if("serviceWorker" in navigator&&location.protocol.indexOf("http")===0){
  navigator.serviceWorker.register("./sw.js").catch(()=>{});
}
