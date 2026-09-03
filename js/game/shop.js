"use strict";
/* ---------------- unlocks ---------------- */
function checkUnlocks(){
  if(!unlocks.loops&&totals.collected>=5){unlocks.loops=true;bigToast("🔁 LOOPS UNLOCKED! Repeat & Forever blocks are yours!");confetti();sfx(660,.1);sfx(880,.1,.12);sfx(1100,.12,.24);renderPalette();}
  if(!unlocks.logic&&totals.earned>=1){unlocks.logic=true;bigToast("❓ LOGIC UNLOCKED! Your robots can now make decisions with If!");confetti();sfx(660,.1);sfx(880,.1,.12);sfx(1100,.12,.24);renderPalette();}
  if(!unlocks.smart&&(totals.earned>=150||robots.length>=2)){unlocks.smart=true;bigToast("🧭 SMART BLOCKS UNLOCKED! Face Nearest, Go Home & Sell All!");confetti();sfx(660,.1);sfx(880,.1,.12);sfx(1320,.14,.24);renderPalette();}
  if(!unlocks.vars&&totals.earned>=250){unlocks.vars=true;bigToast("🧠 MEMORY UNLOCKED! Variables, counting loops & Say!");confetti();sfx(660,.1);sfx(880,.1,.12);sfx(1320,.14,.24);renderPalette();}
  // the moment there IS a team, the problem of them fighting over one tree exists
  if(!unlocks.team&&robots.length>=2){unlocks.team=true;bigToast("🤝 TEAMWORK UNLOCKED! 🚶 Walk To already keeps your robots off each other's trees — now use 📡 Tell Team and 📻 Go To Call to send one scout ahead for the whole fleet.");confetti();sfx(660,.1);sfx(880,.1,.12);sfx(1320,.14,.24);renderPalette();}
}

/* ---------------- shop ---------------- */
function openShop(){renderShop();$("shopWrap").classList.add("open");}
function renderShop(){
  const r=R(), el=$("shopItems");
  const stashSum=Object.keys(stash).reduce((s,k2)=>s+stash[k2]*RES[k2].price,0);
  const items=[
    {em:"🤖",b:"New Robot — 100 🪙",s:"More robots = more automation! It spawns at your home base.",
     can:coins>=100,fn(){coins-=100;const nr=makeRobot(homePos.x,homePos.y+1);robots.push(nr);selRobot=robots.length-1;toast("🤖 "+nr.name+" joined your team!");checkUnlocks();}},
    {em:"🎒",b:"Bigger Bag +4 — 60 🪙",s:esc(r.name)+" carries "+r.cap+" now. Fewer trips home!",
     can:coins>=60,fn(){coins-=60;r.cap+=4;toast("🎒 "+r.name+" bag upgraded to "+r.cap+"!");}},
    {em:"⚡",b:"Speed Boost — 80 🪙",s:esc(r.name)+" runs code 25% faster. (x"+r.speed.toFixed(2)+" now, max x2)",
     can:coins>=80&&r.speed<2,fn(){coins-=80;r.speed=Math.min(2,r.speed*1.25);toast("⚡ "+r.name+" is faster!");}},
    {em:"🏦",b:"Sell the Bank — +"+stashSum+" 🪙",s:"Bank: "+RES.wood.em+stash.wood+" "+RES.stone.em+stash.stone+" "+RES.iron.em+stash.iron+" "+RES.crystal.em+stash.crystal+(stash.water?" "+RES.water.em+stash.water:"")+" — or keep it and let robots 🔨 Build from it!",
     can:stashSum>0,fn(){coins+=stashSum;totals.earned+=stashSum;stash={wood:0,stone:0,iron:0,crystal:0,water:0};toast("💰 Bank sold for "+stashSum+" 🪙");sfx(880,.1);checkUnlocks();}},
  ];
  el.innerHTML="";
  for(const it of items){
    const d=document.createElement("div");d.className="shopitem";
    d.innerHTML='<div class="em">'+it.em+'</div><div class="tx"><b>'+it.b+'</b><small>'+it.s+'</small></div>';
    const btn=document.createElement("button");btn.textContent="Get";btn.disabled=!it.can;
    btn.addEventListener("click",()=>{it.fn();updateHud();updateChips();renderShop();saveSoon();});
    d.appendChild(btn);el.appendChild(d);
  }
  // robot style (hats unlocked by level)
  const owned=HATS.filter(h=>h.lvl<=player.level);
  const st=document.createElement("div");st.className="shopitem";
  st.innerHTML='<div class="em">🎩</div><div class="tx"><b>Style — '+esc(R().name)+'</b><small>'+(owned.length?"Tap a hat to wear it!":"Hats unlock as you level up ⭐ (first at level 2)")+'</small></div>';
  const hwrap=document.createElement("div");
  hwrap.style.cssText="display:flex;gap:5px;flex-wrap:wrap;max-width:130px;justify-content:flex-end";
  const mkHat=(label,val)=>{
    const bt=document.createElement("button");bt.textContent=label;
    if(R().hat===val)bt.style.outline="2px solid #fff";
    bt.addEventListener("click",()=>{R().hat=val;saveSoon();renderShop();});
    hwrap.appendChild(bt);
  };
  mkHat("✖",null);
  owned.forEach(h=>mkHat(h.em,h.em));
  HATS.filter(h=>h.lvl>player.level).slice(0,2).forEach(h=>{
    const bt=document.createElement("button");bt.textContent="🔒"+h.lvl;bt.disabled=true;hwrap.appendChild(bt);
  });
  st.appendChild(hwrap);el.appendChild(st);
  /* Sound, Music, your name, hiding players and New World moved to
     Settings; Export and Import to the Account & save page. None of them
     cost coins, and none of them belonged under "buy a robot". */
}
$("importFile").addEventListener("change",e=>{
  const f=e.target.files[0];if(!f)return;
  const rd=new FileReader();
  rd.onload=()=>{
    try{
      /* JSON.parse keeps a literal "__proto__" as an own property, and the
         loader hands these objects to Object.assign, whose [[Set]] would run
         the prototype setter. Drop those keys before anything touches them. */
      const d=JSON.parse(rd.result,(k,v)=>
        (k==="__proto__"||k==="constructor"||k==="prototype")?undefined:v);
      if(d.v!==1&&d.v!==2)throw 0;
      localStorage.setItem(SAVE_KEY,JSON.stringify(d));
      location.reload();
    }catch(_){toast("⚠️ That file isn't a CodeCraft world.");}
  };
  rd.readAsText(f);
  e.target.value="";
});
$("shopBtn").addEventListener("click",openShop);
$("shopClose").addEventListener("click",()=>$("shopWrap").classList.remove("open"));
$("shopWrap").addEventListener("click",e=>{if(e.target.id==="shopWrap")$("shopWrap").classList.remove("open");});
