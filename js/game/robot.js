"use strict";
/* ---------------- robots ---------------- */
function makeRobot(x,y,name){
  return {id:uid(),x,y,rx:x,ry:y,dir:1,name:name||("Robo-"+(robots.length+1)),
    color:ROBOT_COLORS[robots.length%ROBOT_COLORS.length],
    inv:{wood:0,stone:0,iron:0,crystal:0,water:0},cap:8,speed:1,energy:100,
    vars:{},hat:null,say:null,pop:0,tired:false,
    program:[],frames:null,running:false,wait:0,path:null,blocked:false,curUid:null,nextAct:0};
}
const bagCount=r=>r.inv.wood+r.inv.stone+r.inv.iron+r.inv.crystal+(r.inv.water||0);
const MAX_ENERGY=100;
// materials: robot bag first, then the shared 🏦 Bank (stash). Returns amount taken from the bank.
function haveMat(r,res,n){return (r.inv[res]||0)+(stash[res]||0)>=n;}
function drawMat(r,res,n){
  const fi=Math.min(r.inv[res]||0,n);r.inv[res]=(r.inv[res]||0)-fi;
  const fb=n-fi;if(fb>0)stash[res]=(stash[res]||0)-fb;return fb;
}
function bankTotal(){return Object.keys(RES).reduce((s,k2)=>s+(stash[k2]||0),0);}
function useEnergy(r,cost){
  const c=Math.max(1,Math.round(cost*(1-skills.agility.lvl*0.03))); // agility eases fatigue
  if((r.energy||0)<c){r.blocked=true;r.tired=true;mentorFlag("tired");return false;}
  r.energy-=c;r.tired=false;return true;
}
// hit a resource node ahead; harvest only when its HP reaches 0 (so gathering needs repetition/loops)
function hitNode(r,a,k,o){
  if(bagCount(r)>=r.cap){r.blocked=true;sfxIf(r,150,.05);mentorFlag("bagFull");return;}
  if(!useEnergy(r,5))return;
  if(o.hp===undefined)o.hp=NODE_HP[o.type]||1;
  o.hp--;r.pop=1;
  burst(a.x,a.y,o.type==="tree"?"leaf":o.type==="crystal"?"sparkle":"stone");
  sfxIf(r,o.type==="tree"?300:210,.04);
  if(o.hp>0){addPop(a.x,a.y,o.type==="tree"?"🪓":"⛏️");return;}
  const got=NODE_YIELD[o.type];
  objects.delete(k);
  respawnQ.push({at:now+NODE_RESPAWN[o.type],x:a.x,y:a.y,type:o.type});
  r.inv[got]++;totals.collected++;addPop(a.x,a.y,"+1 "+RES[got].em);
  addXP(o.type==="crystal"?4:2);qProg("collect",got);
  const sk=o.type==="tree"?"wood":"mine";
  skillXP(sk,o.type==="crystal"?6:o.type==="iron"?4:3);
  if(bagCount(r)<r.cap&&Math.random()<skills[sk].lvl*.06){r.inv[got]++;totals.collected++;addPop(a.x,a.y,"✨ +1 "+RES[got].em);}
  sfxIf(r,660,.06);checkUnlocks();
}
function scoopWater(r,a,k){
  if(bagCount(r)>=r.cap){r.blocked=true;sfxIf(r,150,.05);mentorFlag("bagFull");return;}
  if(!inB(a.x,a.y)||terrain[k]!==T_WATER||(objects.get(k)&&objects.get(k).type==="bridge")){r.blocked=true;return;}
  if(!useEnergy(r,4))return;
  r.inv.water=(r.inv.water||0)+1;totals.collected++;r.pop=1;addPop(a.x,a.y,"+1 💧");burst(a.x,a.y,"sparkle");
  addXP(1);qProg("collect","water");skillXP("agility",1);sfxIf(r,720,.05);checkUnlocks();
}
let mgRobot=null, mgState=null; // active build-project challenge; editor targets mgRobot while set
const R=()=>mgRobot||robots[selRobot];
