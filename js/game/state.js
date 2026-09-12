"use strict";
/* ---------------- state ---------------- */
let terrain, objects, robots=[], animals=[], respawnQ=[];
let seed=0, coins=0, stash={wood:0,stone:0,iron:0,crystal:0,water:0};
let totals={collected:0,earned:0};
let unlocks={loops:false,logic:false,smart:false,team:false};
/* --- 🤝 the team layer: how robots stop tripping over each other ---
   `claims` reserves a tile for one robot for a few seconds, and 🧭 Face Nearest
   skips tiles somebody else has claimed — so a fleet running ONE pasted program
   piles onto a single tree, while a fleet that claims fans out. `radio` is a tiny
   noticeboard: 📡 Broadcast pins a spot to a channel, 📻 Go To walks there. Both
   are deliberately transient (they expire) so nothing has to be saved or synced. */
let claims=new Map();   // tileKey -> {by: robotIndex, until: ms}
let radio={};           // channel -> {x, y, by, n, at}
let homePos={x:0,y:0}, marketPos={x:0,y:0};
let selRobot=0, muted=false, musicOff=false, sheetFull=false, lang="en", isNew=true;
let tut={step:0,done:false}, pendingAway=null;
let player={xp:0,level:1,quests:[],lastGift:"",days:0,projects:{},projPrograms:{}};
const HATS=[{lvl:2,em:"⛑️"},{lvl:4,em:"🎩"},{lvl:6,em:"🎓"},{lvl:8,em:"🤠"},{lvl:10,em:"👑"},{lvl:12,em:"🥳"}];
/* Outfits and shoes are painted by js/game/cosmetics.js, not sprites: an
   outfit has to squash inside the body's clip path and a shoe rides a foot
   that rotates every frame, and a rigid bitmap can do neither. Hats stay
   sprites because a hat is rigid.
   Hats take the even levels from 2, outfits the odd ones and shoes every
   third, so levelling up hands you something new almost every star to ⭐13.
   None of it costs coins — the shop already sells the things that do. */
const OUTFITS=[{lvl:3,id:"vest",name:"Hi-Vis Vest"},{lvl:5,id:"apron",name:"Builder Apron"},
  {lvl:7,id:"stripes",name:"Stripes"},{lvl:9,id:"hoodie",name:"Hoodie"},
  {lvl:11,id:"lab",name:"Lab Coat"},{lvl:13,id:"cape",name:"Cape"}];
const SHOES=[{lvl:6,id:"boots",name:"Work Boots"},{lvl:9,id:"sneakers",name:"Sneakers"},
  {lvl:12,id:"wellies",name:"Wellies"},{lvl:15,id:"rockets",name:"Rocket Boots"}];
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
