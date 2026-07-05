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
isNew=!load();
if(isNew)newGame();
cam.x=(homePos.x+.5)*TILE;cam.y=(homePos.y+.5)*TILE;
fillQuests();updateQuestBadge();sbRestore();
renderPalette();updateChips();updateHud();updateFab();updateUndoBtns();renderProgram();renderPy();
$("questBtn").addEventListener("click",()=>{renderQuests();$("quests").classList.add("open");});
$("qClose").addEventListener("click",()=>$("quests").classList.remove("open"));

$("playBtn").addEventListener("click",()=>{
  $("splash").classList.add("hide");
  started=true;
  sfx(660,.08);sfx(880,.08,.1);
  if(isNew)say("👋 Hi! I'm Byte, your coding mentor. Follow the 3 quick steps on screen to wake up your robot — then ask me anything, anytime! 🦉",false);
  if(!tut.done)setTimeout(()=>tutSet(1),800);
  if(pendingAway){const msg=pendingAway;pendingAway=null;setTimeout(()=>bigToast(msg),1400);}
  setTimeout(dailyGift,tut.done?900:9000);
});
if("serviceWorker" in navigator&&location.protocol.indexOf("http")===0){
  navigator.serviceWorker.register("./sw.js").catch(()=>{});
}
