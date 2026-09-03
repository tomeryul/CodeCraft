"use strict";
/* ---------------- save / load ---------------- */
const GROW_MS=20000;
// which account this in-memory/local save belongs to (null = guest / never signed in).
// Used to stop one signed-in user's local progress leaking into a different new account.
let saveOwner=null;
// serialize the whole game into a plain object (used for both localStorage and the cloud)
function buildSave(){
  return {v:2,owner:(typeof sbUser!=="undefined"&&sbUser)?sbUser.uid:saveOwner,savedAt:Date.now(),seed,coins,stash,totals,unlocks,muted,musicOff,sheetFull,lang,selRobot,tutDone:tut.done,player,skills,
    robots:robots.map(r=>({x:r.x,y:r.y,dir:r.dir,name:r.name,color:r.color,inv:r.inv,cap:r.cap,speed:r.speed,energy:r.energy,program:packProg(r),vars:r.vars,hat:r.hat})),
    objects:[...objects.entries()].map(([k2,o])=>{
      const c={...o};
      if(c.growAt!==undefined){c.growIn=Math.max(0,c.growAt-now);delete c.growAt;} // timers as ms-remaining
      return [k2,c];
    }),
    respawns:respawnQ.map(e=>({rin:Math.max(0,e.at-now),x:e.x,y:e.y,type:e.type})),
    // the living market: prices and the order survive; timers go as ms-remaining
    // so they resume correctly on a clock that restarts at 0. Events are transient
    // by design and simply do not come back.
    market:market?{prices:market.prices,want:market.want,
      wantIn:Math.max(0,market.wantAt-now),
      order:market.order?{need:market.order.need,got:market.order.got,shape:market.order.shape,
        untilIn:Math.max(0,market.order.until-now),reward:market.order.reward}:null}:null};
}
let saveT=null, cloudT=null;
function saveSoon(){if(saveOff)return;clearTimeout(saveT);saveT=setTimeout(saveNow,1500);}
// Set while an account is being erased. Without it the autosave interval, or
// the visibilitychange handler firing as the page reloads, writes the live
// in-memory game straight back over the local save we just deleted.
let saveOff=false;
function saveNow(){
  if(saveOff)return;
  const data=buildSave();
  try{localStorage.setItem(SAVE_KEY,JSON.stringify(data));}catch(_){}
  scheduleCloud(data); // logged-in players also sync to their account
}
function scheduleCloud(data){
  if(!(sbUser&&sbReady()))return;
  clearTimeout(cloudT);
  cloudT=setTimeout(()=>{cloudSave(data||buildSave()).catch(()=>{});},4000);
}
// rebuild live game state from a save object (localStorage OR cloud). Returns true on success.
function applySave(d){
  // a different save is a different starting point: record where THIS
  // player already is without celebrating steps they finished days ago
  if(typeof journeyPrimeReset==="function")journeyPrimeReset();
  try{
    if(!d||(d.v!==1&&d.v!==2))return false;
    saveOwner=d.owner||null; // remember whose data this is (null for old/guest saves)
    seed=d.seed;buildTerrain();
    objects=new Map(d.objects);
    coins=d.coins;stash=Object.assign({wood:0,stone:0,iron:0,crystal:0,water:0},d.stash);totals=d.totals;
    unlocks=Object.assign({loops:false,logic:false,smart:false,vars:false,team:false},d.unlocks);
    muted=!!d.muted;
    musicOff=!!d.musicOff;
    /* the sheet size is a preference like sound: it holds until the player
       presses the control again, across sessions included */
    sheetFull=!!d.sheetFull;
    $("editor").classList.toggle("max",sheetFull);
    lang=(d.lang==="he")?"he":"en";
    if(typeof i18nApply==="function")i18nApply();
    tut.done=d.v===1?true:!!d.tutDone;
    player=Object.assign({xp:0,level:1,quests:[],lastGift:"",days:0,projects:{},projPrograms:{},myChallenges:[],academy:{},funcLib:[]},d.player||{});
    if(!player.academy)player.academy={};
    if(!player.funcLib)player.funcLib=[];
    market=freshMarket();
    if(d.market){
      market.prices=Object.assign(market.prices,d.market.prices||{});
      if(d.market.want)market.want=d.market.want;
      market.wantAt=(d.market.wantIn||MKT_WANT_MS);
      const o=d.market.order;
      // an order whose clock ran out while you were away is simply gone
      if(o&&o.untilIn>0)market.order={need:o.need,got:o.got||{},until:o.untilIn,reward:o.reward,shape:o.shape||'spread'};
    }
    skills=freshSkills();
    if(d.skills)for(const k in skills)if(d.skills[k])skills[k]=d.skills[k];
    robots=d.robots.map(rd=>{
      /* A save can arrive from a file someone else wrote, and the name and
         colour are both rendered. They are cleaned here, where untrusted
         data enters the game, as well as escaped where it is drawn. */
      const r=makeRobot(rd.x,rd.y,safeText(rd.name,24));
      Object.assign(r,{dir:rd.dir,color:safeColor(rd.color),cap:rd.cap,speed:rd.speed,
        vars:rd.vars||{},hat:rd.hat||null,
        inv:Object.assign({wood:0,stone:0,iron:0,crystal:0,water:0},rd.inv),
        energy:rd.energy==null?100:rd.energy});
      applyProg(r,rd.program); // an array (old saves) or {main,routines} — both load
      return r;
    });
    selRobot=clamp(d.selRobot||0,0,robots.length-1);
    // fast-forward growth and respawns by the real time spent away (sim clock restarts at 0)
    const elapsed=Math.max(0,Date.now()-(d.savedAt||Date.now()));
    let grew=0,back=0;
    for(const [,o] of objects){
      if(o.type==="tree"&&o.stage<2){
        let rem=(o.growIn!==undefined?o.growIn:GROW_MS)-elapsed;
        while(o.stage<2&&rem<=0){o.stage++;grew++;rem+=GROW_MS;}
        delete o.growIn;
        if(o.stage<2)o.growAt=rem;
      }
    }
    respawnQ=[];
    for(const e of (d.respawns||[])){
      const rem=e.rin-elapsed;
      if(rem>0){respawnQ.push({at:rem,x:e.x,y:e.y,type:e.type});continue;}
      const k2=key(e.x,e.y);
      if(objects.has(k2))continue;
      if(e.type==="tree"){
        const stage=Math.min(2,Math.floor(-rem/GROW_MS));
        const o={type:"tree",stage};
        if(stage<2)o.growAt=GROW_MS+rem%GROW_MS;
        objects.set(k2,o);grew++;
      }else{objects.set(k2,{type:e.type});back++;}
    }
    if(elapsed>60000&&(grew||back))
      pendingAway="🌍 While you were away: "+(grew?grew+" 🌳 grew":"")+(grew&&back?", ":"")+(back?back+" 🪨 returned":"")+"!";
    genAnimals();
    return true;
  }catch(_){return false;}
}
function load(){ // load from this device's localStorage
  try{
    const raw=localStorage.getItem(SAVE_KEY);
    if(!raw)return false;
    return applySave(JSON.parse(raw));
  }catch(_){return false;}
}
// refresh every screen after the world was swapped in (e.g. cloud save applied post-login)
function refreshAllUI(){
  cam.x=(homePos.x+.5)*TILE;cam.y=(homePos.y+.5)*TILE;follow=true;
  fillQuests();updateQuestBadge();
  renderPalette();updateChips();updateHud();updateFab();updateUndoBtns();renderProgram();renderPy();
}
function reUid(list){for(const b of list){b.uid=uid();if(b.t==="if"&&!b.els)b.els=[];if(b.body)reUid(b.body);if(b.els)reUid(b.els);}}
setInterval(saveNow,8000);
document.addEventListener("visibilitychange",()=>{if(document.hidden)saveNow();});
