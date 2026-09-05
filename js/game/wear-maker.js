"use strict";
/* =====================================================================
   Make a piece — the player paints their own hat, outfit or shoes
   ---------------------------------------------------------------------
   A 12×12 grid, sixteen colours and an eraser. That is the whole tool,
   and it is deliberately the whole tool: a free colour picker and a fine
   grid would let a child spend an hour making something that then reads
   as a smudge at 34 pixels tall. Twelve cells is the resolution the robot
   actually renders at, so what you paint is what you get.

   The canvas underneath shows the robot part you are painting onto — the
   body top for a hat, the body square for an outfit, the leg for shoes —
   because "paint in this box" is meaningless without knowing where the
   box sits on the robot.

   Everything a made piece needs lives in js/game/cosmetics.js: the
   palette, the grid decoder and the three body-unit boxes. This file is
   only the sheet.
   ===================================================================== */

/* the working piece: slot, id, name, and the grid as an array of chars */
let mkSlot="hat", mkId=null, mkName="", mkPx=null, mkColor=0, mkRaf=0, mkPaint=null;

function myWear(){ if(!player.myWear)player.myWear=[]; return player.myWear; }
function wearOf(slot){ return myWear().filter(p=>p.slot===slot); }
function wearFind(id){ return myWear().find(p=>p.id===id)||null; }
function wearNewId(){
  /* short, lowercase and unique among what this player already has — the
     save's cleaner rejects anything else */
  let id;
  do{ id=CC_WEAR.prefix+Math.random().toString(36).slice(2,9).replace(/[^a-z0-9]/g,"x"); }
  while(wearFind(id));
  return id;
}
const mkBlank=()=>new Array(CC_WEAR.cells*CC_WEAR.cells).fill(".");
const mkStr=()=>mkPx.join("");
const mkEmpty=()=>mkPx.every(c=>c===".");

/* ---------------- open / close ---------------- */
function makerOpen(slot,id){
  mkSlot=(slot==="outfit"||slot==="shoes")?slot:"hat";
  const p=id?wearFind(id):null;
  if(p){ mkId=p.id; mkName=p.name; mkPx=p.px.split(""); }
  else{
    if(wearOf(mkSlot).length>=CC_WEAR.max){
      toast("You already have "+CC_WEAR.max+" of these. Delete one to make another.");
      return;
    }
    mkId=wearNewId(); mkName=""; mkPx=mkBlank();
  }
  mkColor=0;
  $("style").classList.remove("open");
  renderMaker();
  $("maker").classList.add("open");
  if(typeof sfx==="function")sfx(600,.04);
}
/* Two ways out, and they mean what they mean everywhere else in the app:
   ‹ Back is one step, which from here is Style; ✕ is out to the world, and
   js/game/nav.js already adds that to this sheet's ✕. So the ✕ handler only
   puts the sheet away — it must not also open Style, or Exit would flash a
   screen on its way past. */
function makerExit(){
  CC_WEAR.setDraft(null);
  $("maker").classList.remove("open");
}
function makerClose(){ makerExit(); styleOpen(); }

/* ---------------- the painting surface ---------------- */
/* The guide is the robot, not a ruler: whatever the piece is worn on is
   drawn faintly under the grid, in the same body units the piece uses, so
   a brim painted on row 8 is a brim that will sit on the body. */
function mkGuide(g,W,H){
  const b=CC_WEAR.box[mkSlot], S=TILE*.72;
  const X=u=>(u-b.x)/b.w*W, Y=u=>(u-b.y)/b.h*H, K=W/b.w;
  g.save();
  g.globalAlpha=.30;
  if(mkSlot==="shoes"){
    g.strokeStyle="#9aa3b5";g.lineWidth=5*K;g.lineCap="round";
    g.beginPath();g.moveTo(X(0),Y(-4));g.lineTo(X(0),Y(0));g.stroke();
  }else{
    g.fillStyle="#9aa3b5";
    rr(g,X(-S/2),Y(-S/2),S*K,S*K,11*K);g.fill();
    if(mkSlot==="hat"){
      /* the antenna, so the player can see what a tall hat has to clear */
      g.strokeStyle="#9aa3b5";g.lineWidth=2.5*K;
      g.beginPath();g.moveTo(X(0),Y(-S/2));g.lineTo(X(0),Y(-S/2-7));g.stroke();
      g.beginPath();g.arc(X(0),Y(-S/2-9),3.5*K,0,7);g.fill();
    }else{
      g.fillStyle="#fff";g.globalAlpha=.22;
      g.beginPath();g.arc(X(-6.5),Y(-3),5*K,0,7);g.moveTo(X(11.5),Y(-3));g.arc(X(6.5),Y(-3),5*K,0,7);g.fill();
    }
  }
  g.restore();
}
function mkDraw(){
  const c=$("mkCanvas"); if(!c)return;
  const W=Math.max(120,Math.round(c.clientWidth||264)), H=W;
  const d=Math.min(2,window.devicePixelRatio||1);
  if(c.width!==Math.round(W*d)){c.width=Math.round(W*d);c.height=Math.round(H*d);}
  const g=c.getContext("2d");
  g.setTransform(d,0,0,d,0,0);g.clearRect(0,0,W,H);
  mkGuide(g,W,H);
  const n=CC_WEAR.cells, cw=W/n;
  for(let i=0;i<mkPx.length;i++){
    const k=CC_WEAR.key.indexOf(mkPx[i]); if(k<0)continue;
    g.fillStyle=CC_WEAR.pal[k];
    g.fillRect((i%n)*cw,((i/n)|0)*cw,cw+.5,cw+.5);
  }
  g.strokeStyle="rgba(255,255,255,.13)";g.lineWidth=1;
  for(let i=1;i<n;i++){
    g.beginPath();g.moveTo(i*cw,0);g.lineTo(i*cw,H);g.stroke();
    g.beginPath();g.moveTo(0,i*cw);g.lineTo(W,i*cw);g.stroke();
  }
}
/* one loop for the live preview; it stops itself when the sheet closes, so
   Back and Exit in the shared header need to know nothing about it */
function mkPlay(){
  if(mkRaf)return;
  const step=ts=>{
    mkRaf=0;
    const sheet=$("maker"), cv=$("mkPrev");
    if(!sheet||!sheet.classList.contains("open")||!cv){CC_WEAR.setDraft(null);return;}
    CC_WEAR.setDraft({id:mkId,px:mkStr()});
    const r=robots[selRobot]||robots[0];
    if(r){
      const w=Math.max(140,Math.round(cv.clientWidth||200)), d=Math.min(2,window.devicePixelRatio||1);
      if(cv.width!==Math.round(w*d)){cv.width=Math.round(w*d);cv.height=Math.round(132*d);}
      const g=cv.getContext("2d");
      g.setTransform(d,0,0,d,0,0);g.clearRect(0,0,w,132);
      const wear={hat:r.hat,outfit:r.outfit,shoes:r.shoes};
      wear[mkSlot]=mkId;
      drawBoardRobot(g,w/2,74,58,"E",safeColor(r.color),false,ts||0,wear);
    }
    mkRaf=requestAnimationFrame(step);
  };
  mkRaf=requestAnimationFrame(step);
}

/* ---------------- the sheet ---------------- */
function renderMaker(){
  const body=$("makerBody"); if(!body)return;
  body.innerHTML="";

  /* which slot — switching keeps the grid, because a shape you painted for
     a hat is often the start of the shoes */
  const tabs=document.createElement("div");tabs.className="mk-tabs";
  [["hat","Hat"],["outfit","Outfit"],["shoes","Shoes"]].forEach(([k,lab])=>{
    const b=document.createElement("button");b.type="button";
    b.className="mk-tab"+(mkSlot===k?" on":"");b.textContent=lab;
    b.addEventListener("click",()=>{
      if(mkSlot===k)return;
      if(!mkId||wearFind(mkId)){ makerOpen(k,null); return; }  // editing a saved piece: start a new one
      mkSlot=k; renderMaker();
    });
    tabs.appendChild(b);
  });
  body.appendChild(tabs);

  /* preview + canvas, side by side when there is room */
  const stage=document.createElement("div");stage.className="mk-stage";
  const pv=document.createElement("div");pv.className="mk-prev";
  const pc=document.createElement("canvas");pc.id="mkPrev";pv.appendChild(pc);
  const pad=document.createElement("div");pad.className="mk-pad";
  const cc=document.createElement("canvas");cc.id="mkCanvas";pad.appendChild(cc);
  stage.appendChild(pad);stage.appendChild(pv);
  body.appendChild(stage);

  /* colours. The eraser is first because it is the one a child reaches for
     most, and it is a colour-shaped button so it lives in the same row. */
  const pal=document.createElement("div");pal.className="mk-pal";
  const dot=(i)=>{
    const b=document.createElement("button");b.type="button";
    b.className="mk-dot"+(mkColor===i?" on":"")+(i<0?" era":"");
    if(i<0){b.textContent="✖";b.setAttribute("aria-label","Eraser");}
    else{b.style.background=CC_WEAR.pal[i];b.setAttribute("aria-label","Colour "+(i+1));}
    b.addEventListener("click",()=>{mkColor=i;
      [...pal.children].forEach(n=>n.classList.remove("on"));b.classList.add("on");});
    pal.appendChild(b);
  };
  dot(-1);
  for(let i=0;i<CC_WEAR.pal.length;i++)dot(i);
  body.appendChild(pal);

  /* name + the two things you can do with the piece */
  const row=document.createElement("div");row.className="mk-row";
  const nm=document.createElement("input");
  nm.type="text";nm.id="mkName";nm.maxLength=18;nm.placeholder="Name it";
  nm.value=mkName;nm.setAttribute("aria-label","Piece name");
  nm.addEventListener("input",()=>{mkName=nm.value;});
  row.appendChild(nm);
  const clr=document.createElement("button");clr.type="button";clr.className="mk-btn";
  clr.textContent="Clear";
  clr.addEventListener("click",()=>{mkPx=mkBlank();mkDraw();});
  row.appendChild(clr);
  body.appendChild(row);

  const acts=document.createElement("div");acts.className="mk-acts";
  const save=document.createElement("button");save.type="button";save.className="mk-btn go";
  save.textContent="Save";
  save.addEventListener("click",mkSave);
  acts.appendChild(save);
  if(wearFind(mkId)){
    const del=document.createElement("button");del.type="button";del.className="mk-btn danger";
    del.textContent="Delete";
    del.addEventListener("click",mkDelete);
    acts.appendChild(del);
  }
  body.appendChild(acts);

  wirePaint(cc);
  requestAnimationFrame(mkDraw);
  mkPlay();
}

/* Painting is pointer-driven so a dragged finger fills a line of cells.
   touch-action:none on the canvas (css/codecraft-v7.css) is what stops the
   sheet scrolling underneath the stroke. */
function wirePaint(c){
  const cell=e=>{
    const r=c.getBoundingClientRect(), n=CC_WEAR.cells;
    const x=Math.floor((e.clientX-r.left)/r.width*n), y=Math.floor((e.clientY-r.top)/r.height*n);
    if(x<0||y<0||x>=n||y>=n)return -1;
    return y*n+x;
  };
  const put=e=>{
    const i=cell(e); if(i<0)return;
    const v=mkColor<0?".":CC_WEAR.key.charAt(mkColor);
    if(mkPx[i]===v)return;
    mkPx[i]=v; mkDraw();
  };
  c.addEventListener("pointerdown",e=>{
    mkPaint=e.pointerId;
    try{c.setPointerCapture(e.pointerId);}catch(_){}
    put(e); e.preventDefault();
  });
  c.addEventListener("pointermove",e=>{ if(mkPaint===e.pointerId)put(e); });
  const up=e=>{ if(mkPaint===e.pointerId)mkPaint=null; };
  c.addEventListener("pointerup",up);
  c.addEventListener("pointercancel",up);
}

/* ---------------- save / delete ---------------- */
function mkSave(){
  if(mkEmpty()){ toast("Paint something first!"); return; }
  const list=myWear(), at=list.findIndex(p=>p.id===mkId);
  if(at<0&&wearOf(mkSlot).length>=CC_WEAR.max){
    toast("You already have "+CC_WEAR.max+" of these. Delete one to make another.");
    return;
  }
  const nm=safeText(mkName,18)||"My piece";
  const piece={id:mkId,slot:mkSlot,name:nm,px:mkStr()};
  if(at<0)list.push(piece); else list[at]=piece;
  /* wearing it is the point of making it */
  const r=robots[selRobot]||robots[0];
  if(r)r[mkSlot]=mkId;
  saveSoon();
  if(typeof sfx==="function"){sfx(700,.07);sfx(940,.08,.09);}
  toast("🎨 "+nm+" is yours!");
  makerClose();
}
function mkDelete(){
  const list=myWear(), at=list.findIndex(p=>p.id===mkId);
  if(at>=0)list.splice(at,1);
  /* a robot cannot go on wearing something that no longer exists */
  robots.forEach(r=>{ if(r.hat===mkId)r.hat=null;
    if(r.outfit===mkId)r.outfit=null; if(r.shoes===mkId)r.shoes=null; });
  saveSoon();
  if(typeof sfx==="function")sfx(360,.08);
  makerClose();
}

$("makerClose").addEventListener("click",makerExit);
