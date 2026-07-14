"use strict";
/* ---------------- boot ---------------- */
function newGame(){
  seed=(Math.random()*1e9)|0;
  buildTerrain();genObjects();genAnimals();
  coins=0;stash={wood:0,stone:0,iron:0,crystal:0,water:0};
  totals={collected:0,earned:0,dist:0};
  unlocks={loops:false,logic:false,smart:false,vars:false};
  player={xp:0,level:1,quests:[],lastGift:"",days:0,projects:{},projPrograms:{},myChallenges:[],academy:{}};
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
function startGame(){
  if(started)return;
  $("splash").classList.add("hide");
  started=true;
  sfx(660,.08);sfx(880,.08,.1);
  if(isNew)say("👋 Hi! I'm Byte, your coding mentor. Let's run through a few quick lessons at the Academy — then the whole open world is yours! 🦉",false);
  // brand-new players start with the guided Academy; returning players get the map coach
  if(isNew&&typeof academyComplete==="function"&&!academyComplete())
    setTimeout(()=>academyStart(),750);
  else if(!tut.done)setTimeout(()=>tutSet(1),800);
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
      if(cloud){ if(applySave(cloud)){isNew=false;saveOwner=sbUser.uid;refreshAllUI();} }
      else {
        // brand-new account with no cloud save yet. Only keep the current on-screen
        // progress if it's this account's own (or a guest's) — never inherit a
        // DIFFERENT signed-in user's local data (that leaked their My Challenges etc.)
        if(saveOwner&&saveOwner!==sbUser.uid){ newGame(); isNew=true; refreshAllUI(); }
        saveOwner=sbUser.uid;
        await cloudSave(buildSave());
      }
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
