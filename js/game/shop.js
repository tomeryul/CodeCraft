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
  /* Style is its own sheet now. Three slots of sixteen pieces never fitted
     the 130px of tiny buttons this row used to hold, and a swatch you cannot
     see the art on is not a choice. The row keeps its place in the shop —
     it is still where a player looks for it — and opens the sheet. */
  const ownedN=HATS.filter(h=>h.lvl<=player.level).length+
    OUTFITS.filter(o=>o.lvl<=player.level).length+
    SHOES.filter(o=>o.lvl<=player.level).length;
  const total=HATS.length+OUTFITS.length+SHOES.length;
  const st=document.createElement("div");st.className="shopitem";
  st.innerHTML='<div class="em">🎩</div><div class="tx"><b>Style</b><small>'+
    (ownedN?"Hats, outfits and shoes — "+ownedN+" of "+total+" unlocked.":
            "Hats, outfits and shoes unlock as you level up ⭐ (first at level 2).")+
    '</small></div>';
  const sb=document.createElement("button");sb.textContent="Open";
  sb.addEventListener("click",()=>{$("shopWrap").classList.remove("open");styleOpen();});
  st.appendChild(sb);el.appendChild(st);
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

/* =====================================================================
   The Style sheet
   ---------------------------------------------------------------------
   Three slots — hat, outfit, shoes — each a horizontally scrolling row of
   52px swatches, over a live preview of the robot you are dressing.

   The swatches are painted with the same code that paints the robot: hats
   through sprite(), outfits and shoes through CC_WEAR. Nothing here draws a
   piece a second way, which is the whole point of the file — a picker that
   lies about what you are choosing is worse than no picker.
   ===================================================================== */
let styleSel=0, styleMode="idle", styleRaf=0;

function styleRobot(){ return robots[styleSel]||robots[selRobot]||robots[0]; }
function styleOpen(){
  styleSel=Math.max(0,Math.min(robots.length-1,selRobot));
  renderStyle();
  $("style").classList.add("open");
  if(typeof sfx==="function")sfx(560,.04);
  stylePlay();
}
function styleClose(){ $("style").classList.remove("open"); }

/* the limb colour render.js strokes legs with, so a shoe swatch stands on the
   same leg the robot does */
function styleLimb(hex){
  try{const n=parseInt(safeColor(hex).slice(1),16);const f=c=>Math.max(0,Math.round(c*.72));
    return "rgb("+f(n>>16&255)+","+f(n>>8&255)+","+f(n&255)+")";}catch(e){return hex;}
}
function styleFit(c,w,h){
  const d=Math.min(2,window.devicePixelRatio||1);
  if(c.width!==Math.round(w*d)){c.width=Math.round(w*d);c.height=Math.round(h*d);}
  const g=c.getContext("2d");
  g.setTransform(d,0,0,d,0,0);g.clearRect(0,0,w,h);return g;
}

/* one rAF loop for the preview. It stops itself when the sheet is no longer
   open, so Back and Exit in the shared header need to know nothing about it. */
function stylePlay(){
  if(styleRaf)return;
  const step=(ts)=>{
    styleRaf=0;
    const el=$("style"), cv=$("stylePrev");
    if(!el||!el.classList.contains("open")||!cv)return;
    const r=styleRobot();
    if(r){
      /* fit to the canvas's own CSS width so the robot is never squeezed on a
         narrow sheet */
      const w=Math.max(200,Math.round(cv.clientWidth||330));
      const g=styleFit(cv,w,150);
      if(g)drawBoardRobot(g,w/2,84,66,"E",safeColor(r.color),styleMode==="walk",ts||0,
        {hat:r.hat,outfit:r.outfit,shoes:r.shoes});
    }
    styleRaf=requestAnimationFrame(step);
  };
  styleRaf=requestAnimationFrame(step);
}

/* ---- swatch art: the pieces, drawn by the code that draws them in game ---- */
function stylePaintSwatch(c,kind,id,color){
  const g=styleFit(c,46,46); if(!g)return;
  const col=safeColor(color);
  g.save();
  /* a piece the player painted is the same grid the robot wears, fitted to
     the swatch — no second way of drawing it, so what you pick is what you
     get */
  if(window.CC_WEAR&&CC_WEAR.isCustom(id)){
    const p=wearFind(id);
    if(p)CC_WEAR.swatch(g,kind,p,46);
    g.restore();return;
  }
  if(kind==="hat"){
    const hp=sprite(id,30);
    g.drawImage(hp,23-hp.lw/2,25-hp.lw/2,hp.lw,hp.lw);
  }else if(kind==="outfit"){
    g.translate(23,25);g.scale(.78,.78);
    const S=TILE*0.72;
    const grd=g.createLinearGradient(0,-S/2,0,S/2);
    grd.addColorStop(0,window.CC_EXTRAS?CC_EXTRAS.lighten(col,.3):col);grd.addColorStop(1,col);
    /* a cape is worn behind the body, so the swatch shows it behind the body */
    if(window.CC_WEAR&&CC_WEAR.back[id])CC_WEAR.back(g,id,0,.25);
    g.fillStyle=grd;rr(g,-S/2,-S/2,S,S,11);g.fill();
    g.save();rr(g,-S/2,-S/2,S,S,11);g.clip();
    if(window.CC_WEAR)CC_WEAR.outfit(g,id,col);
    g.fillStyle="rgba(0,0,0,.25)";g.fillRect(-S/2,S/2-6,S,6);
    g.restore();
  }else{
    g.translate(23,20);g.scale(2.1,2.1);
    g.strokeStyle=styleLimb(col);g.lineWidth=5;g.lineCap="round";
    g.beginPath();g.moveTo(0,-5.5);g.lineTo(0,0);g.stroke();
    if(window.CC_WEAR)CC_WEAR.shoe(g,id,styleLimb(col),false,0);
  }
  g.restore();
}

function renderStyle(){
  const body=$("styleBody"); if(!body)return;
  const r=styleRobot(); if(!r)return;
  body.innerHTML="";

  /* which robot — the same chip the editor uses, so it reads as the same idea */
  if(robots.length>1){
    const crew=document.createElement("div");crew.className="st-crew";
    robots.forEach((rb,i)=>{
      const b=document.createElement("button");
      b.className="rchip"+(i===styleSel?" sel":"");
      b.innerHTML='<span class="dot" style="background:'+safeColor(rb.color)+'"></span>'+esc(rb.name);
      b.addEventListener("click",()=>{styleSel=i;renderStyle();});
      crew.appendChild(b);
    });
    body.appendChild(crew);
  }

  /* live preview */
  const pv=document.createElement("div");pv.className="st-prev";
  const cv=document.createElement("canvas");cv.id="stylePrev";
  pv.appendChild(cv);body.appendChild(pv);
  const modes=document.createElement("div");modes.className="st-modes";
  [["idle","Idle"],["walk","Walk"]].forEach(([k,lab])=>{
    const b=document.createElement("button");
    b.className="st-mode"+(styleMode===k?" on":"");b.type="button";b.textContent=lab;
    b.addEventListener("click",()=>{styleMode=k;renderStyle();});
    modes.appendChild(b);
  });
  body.appendChild(modes);

  /* three slots */
  const slot=(kind,label,list,label4)=>{
    const cur=r[kind];
    const wrap=document.createElement("div");wrap.className="st-slot";
    const found=list.find(x=>(x.id||x.em)===cur)||wearFind(cur);
    const owned=list.filter(x=>x.lvl<=player.level).length;
    const lab=document.createElement("div");lab.className="st-lab";
    lab.innerHTML=esc(label)+' <i>'+esc(found?(found.name||found.id):"None")+'</i><b>'+owned+"/"+list.length+"</b>";
    wrap.appendChild(lab);
    const row=document.createElement("div");row.className="st-row";
    const sw=(val,locked,lvl,paint,mine,nm)=>{
      const b=document.createElement("button");b.type="button";
      b.className="st-sw"+(cur===val?" on":"")+(locked?" locked":"")+(mine?" mine":"");
      /* the label is the piece's own name, not a slot-plus-id string: a name
         is a sentence the dictionary can translate, "outfit vest" is not */
      b.setAttribute("aria-label",val===null?"None":String(nm||val));
      if(locked)b.title="Unlocks at level "+lvl;
      if(paint){const c=document.createElement("canvas");b.appendChild(c);paint(c);}
      else{const n=document.createElement("span");n.className="none";n.textContent="✖";b.appendChild(n);}
      if(locked){const t=document.createElement("span");t.className="lk";t.textContent="🔒"+lvl;b.appendChild(t);}
      b.addEventListener("click",()=>{
        if(locked){toast("🔒 Unlocks at level "+lvl+" ⭐");return;}
        /* a second tap on a piece you already wear opens it for repainting:
           the piece is the button, so it does not need a second one beside
           it on a row that is already scrolling */
        if(mine&&cur===val){makerOpen(kind,val);return;}
        r[kind]=val;saveSoon();renderStyle();
        if(typeof sfx==="function")sfx(700,.05);
      });
      row.appendChild(b);
    };
    sw(null,false,0,null);
    list.forEach(it=>{
      const val=it.id||it.em, locked=it.lvl>player.level;
      sw(val,locked,it.lvl,c=>stylePaintSwatch(c,kind==="hat"?"hat":kind,kind==="hat"?it.em:it.id,r.color),false,it.name);
    });
    /* the player's own pieces sit in the same row as the shop's, because
       they are the same thing: something the robot can wear. Tapping one
       wears it; the pencil on the selected one opens it for repainting. */
    wearOf(kind).forEach(p=>{
      sw(p.id,false,0,c=>stylePaintSwatch(c,kind,p.id,r.color),true,p.name);
    });
    const add=document.createElement("button");add.type="button";add.className="st-sw add";
    add.setAttribute("aria-label","Make your own "+label4);
    add.innerHTML='<span class="pl">＋</span>';
    add.addEventListener("click",()=>makerOpen(kind,null));
    row.appendChild(add);
    wrap.appendChild(row);body.appendChild(wrap);
    /* The row is wider than the sheet, and the piece you are wearing — or
       have just made, which lands at the far end — is often the one past the
       right edge. A picker that hides your own choice is not a picker. */
    requestAnimationFrame(()=>{
      const on=row.querySelector(".st-sw.on");
      if(on&&row.scrollWidth>row.clientWidth)
        row.scrollLeft=Math.max(0,on.offsetLeft-row.clientWidth/2+on.offsetWidth/2);
    });
  };
  /* the labels are words, not emoji: the icon pack covers every emoji the app
     ships, and a slot label is not worth two new icons when the swatches
     underneath already say what the row is */
  slot("hat","Hat",HATS.map(h=>({lvl:h.lvl,id:h.em,em:h.em,name:HAT_NAMES[h.em]||"Hat"})),"hat");
  slot("outfit","Outfit",OUTFITS,"outfit");
  slot("shoes","Shoes",SHOES,"shoes");

  stylePlay();
}
const HAT_NAMES={"⛑️":"Hard Hat","🎩":"Top Hat","🎓":"Graduate","🤠":"Ranger","👑":"Crown","🥳":"Party"};
$("styleClose").addEventListener("click",styleClose);
