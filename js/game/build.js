"use strict";
/* ---------------- manual build mode (Minecraft-style placement) ----------------
   Your robots gather resources (with your algorithms); YOU spend them to place
   decor wherever you like and design your own base. Pieces are cosmetic and
   non-solid, so they never break robot pathing. They live in the objects map, so
   they save to localStorage and cloud-sync like everything else. */
const DECOR=[
  {id:"wall",    em:"🧱", name:"Wall",     cost:{stone:1}},
  {id:"roof",    em:"🛖", name:"Roof",     cost:{wood:1}},
  {id:"door",    em:"🚪", name:"Door",     cost:{wood:1}},
  {id:"window",  em:"🪟", name:"Window",   cost:{stone:1}},
  {id:"fence",   em:"🚧", name:"Fence",    cost:{wood:1}},
  {id:"path",    em:"⬜", name:"Path",     cost:{stone:1}},
  {id:"tree",    em:"🌳", name:"Tree",     cost:{wood:1}},
  {id:"bush",    em:"🌿", name:"Bush",     cost:{water:1}},
  {id:"flower",  em:"🌷", name:"Flower",   cost:{water:1}},
  {id:"lamp",    em:"🏮", name:"Lamp",     cost:{crystal:1}},
  {id:"fountain",em:"⛲", name:"Fountain", cost:{stone:2}},
  {id:"gem",     em:"💠", name:"Gem",      cost:{crystal:1}},
];
const DECOR_BY={}; for(const _d of DECOR)DECOR_BY[_d.id]=_d;
const RES_EM={wood:"🪵",stone:"🪨",iron:"⛓️",crystal:"💎",water:"💧"};

// resource pool = the Bank (stash) + the selected robot's bag
function resPool(){ const p=Object.assign({},stash); const r=R&&R(); if(r&&r.inv)for(const k in r.inv)p[k]=(p[k]||0)+(r.inv[k]||0); return p; }
function decorAfford(d){ const p=resPool(); for(const k in d.cost)if((p[k]||0)<d.cost[k])return false; return true; }
function decorPay(d){ const r=R(); for(const k in d.cost){ let need=d.cost[k]; const fromBank=Math.min(need,stash[k]||0); stash[k]=(stash[k]||0)-fromBank; need-=fromBank; if(need>0&&r&&r.inv)r.inv[k]=(r.inv[k]||0)-need; } }
function decorRefund(o){ const d=DECOR_BY[o.deco]; if(d)for(const k in d.cost)stash[k]=(stash[k]||0)+d.cost[k]; }
function costStr(d){ return Object.keys(d.cost).map(k=>(RES_EM[k]||k)+d.cost[k]).join(" "); }

function toggleBuild(on){
  buildMode = on===undefined ? !buildMode : !!on;
  if(buildMode&&!buildSel)buildSel=DECOR[0].id;
  const bb=$("buildBar"); if(bb)bb.classList.toggle("on",buildMode);
  const btn=$("buildBtn"); if(btn){btn.classList.toggle("on",buildMode);btn.textContent=buildMode?"✓ Done":"🔨 Build";}
  if(buildMode){follow=false;toast("🔨 Build mode — tap a tile to place, tap a piece to remove it.");}
  renderBuildBar();
}
function renderBuildBar(){
  const bar=$("buildBar"); if(!bar)return;
  if(!buildMode){bar.innerHTML="";return;}
  const p=resPool();
  let html='<div class="bb-res">'+Object.keys(RES_EM).map(k=>'<span>'+RES_EM[k]+" "+(p[k]||0)+'</span>').join("")+'</div><div class="bb-items">';
  for(const d of DECOR){
    const ok=decorAfford(d);
    html+='<button class="bb-item'+(d.id===buildSel?" sel":"")+(ok?"":" poor")+'" data-d="'+d.id+'">'+
      '<span class="be">'+d.em+'</span><span class="bc">'+costStr(d)+'</span></button>';
  }
  html+='</div>';
  bar.innerHTML=html;
  bar.querySelectorAll(".bb-item").forEach(b=>b.addEventListener("click",()=>{buildSel=b.dataset.d;renderBuildBar();sfx(560,.03);}));
}
// place / remove a decor piece at a tapped tile (called from handleTap in build mode)
function buildTap(tx,ty){
  const k=key(tx,ty), o=objects.get(k);
  if(o&&o.type==="decor"){ decorRefund(o);objects.delete(k);burst(tx,ty,"sparkle");toast("↩️ Removed — resources refunded to the bank");sfx(300,.06);saveSoon();updateHud();renderBuildBar();return; }
  if(o){ toast("🚫 That tile is taken — pick an empty spot.");return; }
  if(terrain[k]===T_WATER){ toast("🌊 Can't build on water.");return; }
  if(robots.some(r=>Math.round(r.rx)===tx&&Math.round(r.ry)===ty)){ toast("🤖 A robot is standing there.");return; }
  const d=DECOR_BY[buildSel]||DECOR[0];
  if(!decorAfford(d)){ toast("😕 Need "+costStr(d)+" — send robots to gather & bank more!");sfx(200,.08);return; }
  decorPay(d);
  objects.set(k,{type:"decor",deco:d.id,em:d.em});
  burst(tx,ty,"leaf");if(typeof addPop==="function")addPop(tx,ty,d.em);sfx(520,.05);saveSoon();updateHud();renderBuildBar();
}
if($("buildBtn"))$("buildBtn").addEventListener("click",()=>toggleBuild());
