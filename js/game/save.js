"use strict";
/* ---------------- save / load ---------------- */
const GROW_MS=20000;
// serialize the whole game into a plain object (used for both localStorage and the cloud)
function buildSave(){
  return {v:2,savedAt:Date.now(),seed,coins,stash,totals,unlocks,muted,selRobot,tutDone:tut.done,player,skills,
    robots:robots.map(r=>({x:r.x,y:r.y,dir:r.dir,name:r.name,color:r.color,inv:r.inv,cap:r.cap,speed:r.speed,energy:r.energy,program:r.program,vars:r.vars,hat:r.hat})),
    objects:[...objects.entries()].map(([k2,o])=>{
      const c={...o};
      if(c.growAt!==undefined){c.growIn=Math.max(0,c.growAt-now);delete c.growAt;} // timers as ms-remaining
      return [k2,c];
    }),
    respawns:respawnQ.map(e=>({rin:Math.max(0,e.at-now),x:e.x,y:e.y,type:e.type}))};
}
let saveT=null, cloudT=null;
function saveSoon(){clearTimeout(saveT);saveT=setTimeout(saveNow,1500);}
function saveNow(){
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
  try{
    if(!d||(d.v!==1&&d.v!==2))return false;
    seed=d.seed;buildTerrain();
    objects=new Map(d.objects);
    coins=d.coins;stash=Object.assign({wood:0,stone:0,iron:0,crystal:0,water:0},d.stash);totals=d.totals;
    unlocks=Object.assign({loops:false,logic:false,smart:false,vars:false},d.unlocks);
    muted=!!d.muted;
    tut.done=d.v===1?true:!!d.tutDone;
    player=Object.assign({xp:0,level:1,quests:[],lastGift:"",days:0,projects:{},projPrograms:{}},d.player||{});
    skills=freshSkills();
    if(d.skills)for(const k in skills)if(d.skills[k])skills[k]=d.skills[k];
    robots=d.robots.map(rd=>{
      const r=makeRobot(rd.x,rd.y,rd.name);
      Object.assign(r,{dir:rd.dir,color:rd.color,cap:rd.cap,speed:rd.speed,program:rd.program||[],vars:rd.vars||{},hat:rd.hat||null,
        inv:Object.assign({wood:0,stone:0,iron:0,crystal:0,water:0},rd.inv),
        energy:rd.energy==null?100:rd.energy});
      reUid(r.program);
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
