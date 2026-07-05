"use strict";
/* ---------------- XP, quests, engagement ---------------- */
function hasLoop(list){return list.some(b=>b.t==="repeat"||b.t==="forever"||b.t==="countLoop"||(b.body&&hasLoop(b.body))||(b.els&&hasLoop(b.els)));}
function xpNeed(l){return Math.round(50*Math.pow(l,1.4));}
function addXP(n){
  player.xp+=n;
  while(player.xp>=xpNeed(player.level)){
    player.xp-=xpNeed(player.level);
    player.level++;
    const bonus=player.level*10;coins+=bonus;
    confetti();sfx(660,.1);sfx(880,.1,.12);sfx(1320,.14,.24);
    const hat=HATS.find(h=>h.lvl===player.level);
    bigToast("⭐ LEVEL "+player.level+"! +"+bonus+" 🪙"+(hat?" — new hat "+hat.em+" unlocked! (🛒 → Style)":""));
  }
  updateHud();
}
const QUEST_POOL=[
  {id:"wood10",txt:"Collect 10 🪵 wood",type:"collect",res:"wood",n:10,coins:25,xp:15},
  {id:"stone8",txt:"Collect 8 🪨 stone",type:"collect",res:"stone",n:8,coins:30,xp:15},
  {id:"iron5",txt:"Collect 5 ⛓️ iron",type:"collect",res:"iron",n:5,coins:40,xp:20},
  {id:"cry2",txt:"Collect 2 💎 crystals",type:"collect",res:"crystal",n:2,coins:50,xp:25},
  {id:"earn80",txt:"Earn 80 🪙 at the market",type:"earn",n:80,coins:40,xp:20},
  {id:"sap3",txt:"Plant 3 🌱 saplings",type:"build",opt:"sapling",n:3,coins:30,xp:20},
  {id:"bridge2",txt:"Build 2 🌉 bridges",type:"build",opt:"bridge",n:2,coins:45,xp:25},
  {id:"loop1",txt:"Run a program with a 🔁 loop",type:"loop",n:1,coins:25,xp:20},
  {id:"say1",txt:"Make a robot 💬 say something",type:"say",n:1,coins:25,xp:20},
  {id:"duo",txt:"Run 2 robots at the same time",type:"duo",n:1,coins:60,xp:30},
  {id:"walk150",txt:"Walk 150 steps",type:"walk",n:150,coins:35,xp:20},
  {id:"gift1",txt:"Find a 🎁 treasure chest",type:"gift",n:1,coins:40,xp:25},
  {id:"proj1",txt:"Complete a 🏗️ Build Project",type:"proj",n:1,coins:80,xp:40},
];
function qDef(q){return QUEST_POOL.find(p=>p.id===q.id);}
function fillQuests(){
  while(player.quests.length<3){
    const opts=QUEST_POOL.filter(p=>!player.quests.some(q=>q.id===p.id));
    if(!opts.length)break;
    player.quests.push({id:opts[(Math.random()*opts.length)|0].id,prog:0,noted:false});
  }
}
function qProg(type,extra,n){
  n=n||1;
  let changed=false;
  for(const q of player.quests){
    const d=qDef(q);if(!d||d.type!==type)continue;
    if(d.res&&d.res!==extra)continue;
    if(d.opt&&d.opt!==extra)continue;
    if(q.prog>=d.n)continue;
    q.prog=Math.min(d.n,q.prog+n);changed=true;
    if(q.prog>=d.n&&!q.noted){q.noted=true;toast("📜 Quest complete: "+d.txt+" — tap 📜 to claim!");sfx(700,.08);sfx(900,.08,.1);}
  }
  if(changed){
    updateQuestBadge();
    if($("quests").classList.contains("open"))renderQuests();
  }
}
function updateQuestBadge(){
  const claim=player.quests.some(q=>{const d=qDef(q);return d&&q.prog>=d.n;});
  $("questBtn").classList.toggle("badge",claim);
}
function renderQuests(){
  fillQuests();
  const el=$("questList");el.innerHTML="";
  // build-projects entry banner
  const pb=document.createElement("button");pb.id="projBanner";
  pb.innerHTML='<span class="pb-em">🏗️</span><span class="pb-tx"><b>Build Projects</b><small>Coding challenges: Big House, Car, Theme Park…</small></span><span class="pb-go">▶</span>';
  pb.addEventListener("click",()=>{
    $("quests").classList.remove("open");
    renderProjects();$("projects").classList.add("open");
  });
  el.appendChild(pb);
  // skills grid
  const sh=document.createElement("h4");sh.className="qsec";sh.textContent="⚡ Skills — level up by doing";
  el.appendChild(sh);
  const sg=document.createElement("div");sg.id="skillGrid";
  for(const k in SKILL_DEFS){
    const d=SKILL_DEFS[k],s=skills[k];
    const pct=s.lvl>=SKILL_MAX?100:Math.round(s.xp/skillNeed(s.lvl)*100);
    const row=document.createElement("div");row.className="skill";
    row.innerHTML='<span class="sk-em">'+d.em+'</span><span class="sk-nm">'+d.name+'</span>'+
      '<span class="sk-lv">Lv '+s.lvl+(s.lvl>=SKILL_MAX?" MAX":"")+'</span>'+
      '<div class="sk-bar"><i style="width:'+pct+'%"></i></div>'+
      '<small>'+(s.lvl>0?d.perk(s.lvl):"level up to unlock a perk")+'</small>';
    sg.appendChild(row);
  }
  el.appendChild(sg);
  const qh=document.createElement("h4");qh.className="qsec";qh.textContent="📜 Quests";
  el.appendChild(qh);
  for(const q of player.quests){
    const d=qDef(q);if(!d)continue;
    const div=document.createElement("div");div.className="quest";
    div.innerHTML='<div class="qt"><span>'+d.txt+'</span><span class="qr">'+q.prog+'/'+d.n+' · +'+d.coins+'🪙 +'+d.xp+'⭐</span></div>'+
      '<div class="qbar"><i style="width:'+Math.round(q.prog/d.n*100)+'%"></i></div>';
    if(q.prog>=d.n){
      const b=document.createElement("button");b.textContent="🎉 Claim reward";
      b.addEventListener("click",()=>{
        coins+=d.coins;
        player.quests=player.quests.filter(x=>x!==q);
        fillQuests();addXP(d.xp);confetti();coinFlash();
        toast("🎉 +"+d.coins+" 🪙 and +"+d.xp+" ⭐");
        renderQuests();updateQuestBadge();updateHud();saveSoon();
      });
      div.appendChild(b);
    }
    el.appendChild(div);
  }
  $("statsBox").innerHTML=
    '<div>Collected<b>'+totals.collected+'</b></div>'+
    '<div>Earned<b>'+totals.earned+' 🪙</b></div>'+
    '<div>Steps walked<b>'+(totals.dist||0)+'</b></div>'+
    '<div>Robot team<b>'+robots.length+' 🤖</b></div>';
}
function dailyGift(){
  const today=new Date().toDateString();
  if(player.lastGift===today)return;
  player.lastGift=today;player.days++;
  const c=20+player.days*5;
  coins+=c;addXP(10);confetti();coinFlash();updateHud();saveSoon();
  bigToast("🎁 Day "+player.days+" of your adventure! Daily gift: +"+c+" 🪙");
}
