"use strict";
/* ---------------- state ---------------- */
let terrain, objects, robots=[], animals=[], respawnQ=[];
let seed=0, coins=0, stash={wood:0,stone:0,iron:0,crystal:0,water:0};
let totals={collected:0,earned:0};
let unlocks={loops:false,logic:false,smart:false};
let homePos={x:0,y:0}, marketPos={x:0,y:0};
let selRobot=0, muted=false, isNew=true;
let tut={step:0,done:false}, pendingAway=null;
let player={xp:0,level:1,quests:[],lastGift:"",days:0,projects:{},projPrograms:{}};
const HATS=[{lvl:2,em:"⛑️"},{lvl:4,em:"🎩"},{lvl:6,em:"🎓"},{lvl:8,em:"🤠"},{lvl:10,em:"👑"},{lvl:12,em:"🥳"}];
/* --- action skills: level up slowly with use, each grants a small perk --- */
const SKILL_DEFS={
  wood:{em:"🪓",name:"Woodcutting",perk:l=>"+"+l*6+"% bonus wood"},
  mine:{em:"⛏️",name:"Mining",perk:l=>"+"+l*6+"% bonus ore"},
  agility:{em:"🏃",name:"Agility",perk:l=>"+"+Math.round(l*1.5)+"% robot speed"},
  build:{em:"🔨",name:"Building",perk:l=>l*5+"% free builds"},
  trade:{em:"💰",name:"Trading",perk:l=>"+"+l*2+"% sale prices"},
};
const SKILL_MAX=10;
function freshSkills(){const s={};for(const k in SKILL_DEFS)s[k]={xp:0,lvl:0};return s;}
let skills=freshSkills();
const skillNeed=lvl=>Math.round(40*Math.pow(lvl+1,1.6));
function skillXP(name,n){
  const s=skills[name];if(!s||s.lvl>=SKILL_MAX)return;
  s.xp+=n;
  while(s.lvl<SKILL_MAX&&s.xp>=skillNeed(s.lvl)){
    s.xp-=skillNeed(s.lvl);s.lvl++;
    const d=SKILL_DEFS[name];
    bigToast(d.em+" "+d.name+" Lv "+s.lvl+"! "+d.perk(s.lvl));
    confetti();sfx(700,.09);sfx(940,.09,.11);
  }
}
const key=(x,y)=>y*W+x;
