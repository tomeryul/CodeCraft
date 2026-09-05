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
let mkSlot="hat", mkId=null, mkName="", mkPx=null, mkColor=0, mkRaf=0, mkPaint=null, mkSm=true;
/* Build mode: the same piece, made of boxes instead of cells. Both buffers
   live at once so switching modes never throws work away — mkKind is the
   only thing that decides which of the two gets saved. */
let mkKind="grid", mkParts=[], mkSel=-1, mkDrag=null;
/* which token in the code is being edited: {k, i} for the two values an
   element owns, {k, g} for the five the shared rule owns, null for none */
let mkVal=null;
/* Which component has the screen to itself, or null for the whole piece.
   The two screens share every function below — the canvas, the drag, the
   code, the editing strip — because a component screen is not a second
   editor, it is this one with a filter. Only the ids differ, so that both
   sheets can be in the DOM at once. */
let mkFocus=null;
const CID=()=>mkFocus!=null?"cp":"mk";
const mkRender=()=>{ if(mkFocus!=null)renderComp(); else renderMaker(); };
const PART_WORD=["Box","Tile","Pill","Dot"];

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
  mkKind="grid"; mkParts=[]; mkSel=-1; mkDrag=null; mkPx=mkBlank(); mkSm=true;
  if(p){
    mkId=p.id; mkName=p.name;
    if(p.kind==="parts"){ mkKind="parts"; mkParts=p.parts.map(q=>({...q})); }
    else { mkPx=p.px.split(""); mkSm=p.sm!==false; }
  }
  else{
    if(wearOf(mkSlot).length>=CC_WEAR.max){
      toast("You already have "+CC_WEAR.max+" of these. Delete one to make another.");
      return;
    }
    mkId=wearNewId(); mkName="";
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
  mkFocus=null; mkVal=null;
  $("maker").classList.remove("open");
  $("comp").classList.remove("open");
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
  const c=$(CID()+"Canvas"); if(!c)return;
  const W=Math.max(120,Math.round(c.clientWidth||264)), H=W;
  const d=Math.min(2,window.devicePixelRatio||1);
  if(c.width!==Math.round(W*d)){c.width=Math.round(W*d);c.height=Math.round(H*d);}
  const g=c.getContext("2d");
  g.setTransform(d,0,0,d,0,0);g.clearRect(0,0,W,H);
  mkGuide(g,W,H);
  /* the canvas shows the piece the way the robot will wear it — curves when
     it is a smooth piece — with the cell grid still drawn over the top, so
     what you see is the result and what you aim at is still a cell */
  const b=CC_WEAR.box[mkSlot], n=CC_WEAR.cells, cw=W/n, k=W/b.w;
  g.save();
  g.setTransform(d*k,0,0,d*k,-b.x*k*d,-b.y*k*d);
  if(mkKind==="parts")CC_WEAR.parts(g,mkSlot,mkParts,mkFocus);
  else CC_WEAR.grid(g,mkSlot,mkStr(),mkSm);
  g.restore();
  if(mkKind==="parts"){ mkHandles(g,W,H); return; }
  g.strokeStyle="rgba(255,255,255,.13)";g.lineWidth=1;
  for(let i=1;i<n;i++){
    g.beginPath();g.moveTo(i*cw,0);g.lineTo(i*cw,H);g.stroke();
    g.beginPath();g.moveTo(0,i*cw);g.lineTo(W,i*cw);g.stroke();
  }
}
/* the selected box gets an outline and one corner grip: drag anywhere
   inside to move it, drag the grip to resize. Two gestures, no sliders. */
const HANDLE=13;
function mkHandles(g,W,H){
  const p=mkParts[mkSel]; if(!p)return;
  const x=p.x/100*W, y=p.y/100*H, w=p.w/100*W, h=p.h/100*H;
  g.setLineDash([5,4]);
  g.strokeStyle="#fff";g.lineWidth=2;g.strokeRect(x,y,w,h);
  g.setLineDash([]);
  g.fillStyle="#ffb830";g.strokeStyle="#241b45";g.lineWidth=2;
  g.beginPath();g.arc(x+w,y+h,HANDLE/2+2,0,7);g.fill();g.stroke();
}
/* one loop for the live preview; it stops itself when the sheet closes, so
   Back and Exit in the shared header need to know nothing about it */
function mkPlay(){
  if(mkRaf)return;
  const step=ts=>{
    mkRaf=0;
    const sheet=$(mkFocus!=null?"comp":"maker"), cv=$(CID()+"Prev");
    if(!sheet||!sheet.classList.contains("open")||!cv){CC_WEAR.setDraft(null);return;}
    CC_WEAR.setDraft(mkKind==="parts"
      ?{id:mkId,kind:"parts",parts:mkParts}
      :{id:mkId,px:mkStr(),sm:mkSm});
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

  /* Two ways to make the same thing. Paint is cells and a brush; Build is
     boxes you stack — and Build is the one that can be written down, so it
     comes with the code it means. */
  const modes=document.createElement("div");modes.className="mk-fin";
  const mseg=document.createElement("div");mseg.className="mk-seg";
  [["Paint","grid"],["Build","parts"]].forEach(([lab,k])=>{
    const b2=document.createElement("button");b2.type="button";
    b2.className="mk-sm"+(mkKind===k?" on":"");b2.textContent=lab;
    b2.addEventListener("click",()=>{ if(mkKind===k)return; mkKind=k; renderMaker(); });
    mseg.appendChild(b2);
  });
  modes.appendChild(mseg);
  body.appendChild(modes);

  /* preview + canvas, side by side when there is room */
  const stage=document.createElement("div");stage.className="mk-stage";
  const pv=document.createElement("div");pv.className="mk-prev";
  const pc=document.createElement("canvas");pc.id="mkPrev";pv.appendChild(pc);
  const pad=document.createElement("div");pad.className="mk-pad";
  const cc=document.createElement("canvas");cc.id="mkCanvas";pad.appendChild(cc);
  stage.appendChild(pad);stage.appendChild(pv);
  body.appendChild(stage);

  /* colours. In Paint they are the brush; in Build they recolour the box
     you have chosen — and because a colour lives in the shared rule, every
     box in that group changes with it. The eraser belongs to Paint only. */
  const pal=document.createElement("div");pal.className="mk-pal";
  const dot=(i)=>{
    const b=document.createElement("button");b.type="button";
    b.className="mk-dot"+(mkColor===i?" on":"")+(i<0?" era":"");
    if(i<0){b.textContent="✖";b.setAttribute("aria-label","Eraser");}
    else{b.style.background=CC_WEAR.pal[i];b.setAttribute("aria-label",CC_WEAR.names[i]);}
    b.addEventListener("click",()=>{
      mkColor=i;
      if(mkKind==="parts"&&i>=0&&mkParts[mkSel]){ mkGroup(p2=>{p2.c=i;}); mkRender(); return; }
      [...pal.children].forEach(n=>n.classList.remove("on"));b.classList.add("on");
    });
    pal.appendChild(b);
  };
  if(mkKind!=="parts")dot(-1);
  for(let i=0;i<CC_WEAR.pal.length;i++)dot(i);
  body.appendChild(pal);

  if(mkKind==="parts")mkBuildUI(body);
  else{
    /* Curves or blocks. The pieces the game ships are curves, so that is the
       default and the reason this switch exists is the child who wanted
       pixel art on purpose. */
    const fin=document.createElement("div");fin.className="mk-fin";
    const seg=document.createElement("div");seg.className="mk-seg";
    [["Smooth",true],["Blocky",false]].forEach(([lab,v])=>{
      const b2=document.createElement("button");b2.type="button";
      b2.className="mk-sm"+(mkSm===v?" on":"");b2.textContent=lab;
      b2.addEventListener("click",()=>{ if(mkSm===v)return; mkSm=v; renderMaker(); });
      seg.appendChild(b2);
    });
    fin.appendChild(seg);
    const clr=document.createElement("button");clr.type="button";clr.className="mk-btn";
    clr.textContent="Clear";
    clr.addEventListener("click",()=>{mkPx=mkBlank();mkDraw();});
    fin.appendChild(clr);
    body.appendChild(fin);
  }

  const row=document.createElement("div");row.className="mk-row";
  const nm=document.createElement("input");
  nm.type="text";nm.id="mkName";nm.maxLength=18;nm.placeholder="Name it";
  nm.value=mkName;nm.setAttribute("aria-label","Piece name");
  nm.addEventListener("input",()=>{mkName=nm.value;mkCodeRefresh();});
  row.appendChild(nm);
  body.appendChild(row);

  if(mkKind==="parts")body.appendChild(mkCodeBlock());

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

  if(mkKind==="parts")wireParts(cc); else wirePaint(cc);
  requestAnimationFrame(mkDraw);
  mkPlay();
}

/* ---------------- Build mode: boxes, not cells ----------------
   A part is a box with a position, a size, a corner radius and a colour —
   the five things a CSS rule holds. Position belongs to the element, and
   the other four belong to the class, so changing a colour or a shape
   changes every box in the group. That is not a quirk to work around: it
   is the lesson, and the chip says "×2" so it is never a surprise. */
function mkGroup(fn){
  const sel=mkParts[mkSel]; if(!sel)return;
  for(const p of mkParts)if(p.cls===sel.cls)fn(p);
}
function mkGroupSize(cls){ let n=0; for(const p of mkParts)if(p.cls===cls)n++; return n; }
function mkNewCls(){ let m=-1; for(const p of mkParts)if(p.cls>m)m=p.cls; return m+1; }
function mkAddPart(){
  if(mkParts.length>=CC_WEAR.partMax){ toast("That is as many boxes as one piece can hold."); return; }
  mkParts.push({cls:mkNewCls(),x:32,y:38,w:36,h:24,r:CC_WEAR.rad[1],a:0,
    c:mkColor<0?0:mkColor});
  mkSel=mkParts.length-1;
  mkRender();
  if(typeof sfx==="function")sfx(660,.04);
}
function mkBuildUI(body){
  const sel=mkParts[mkSel]||null;
  /* the chips announce themselves by the class they become, because that is
     what they are — and a selector is an identifier, so it stays in English
     the way every identifier in every stylesheet does */
  const cls=CC_CODE.classNames(mkParts);

  /* the boxes, in the order they are drawn: left is behind */
  const chips=document.createElement("div");chips.className="mk-parts";
  mkParts.forEach((p,i)=>{
    const b=document.createElement("button");b.type="button";
    b.className="mk-part"+(i===mkSel?" on":"");
    const n=mkGroupSize(p.cls);
    b.innerHTML='<span class="pd" style="background:'+CC_WEAR.pal[p.c]+
      '"></span>'+(n>1?'<span class="px2">×'+n+'</span>':'');
    b.setAttribute("aria-label","."+cls[p.cls]);
    /* a second tap on the box you already have opens its component — the
       same idiom the Style row uses for a piece you are already wearing */
    b.addEventListener("click",()=>{
      if(i===mkSel){ compOpen(p.cls); return; }
      mkSel=i; renderMaker();
    });
    chips.appendChild(b);
  });
  const add=document.createElement("button");add.type="button";add.className="mk-part add";
  add.innerHTML='<span class="pl">＋</span>';
  add.setAttribute("aria-label","Add a box");
  add.addEventListener("click",mkAddPart);
  chips.appendChild(add);
  body.appendChild(chips);

  if(!sel){
    const hint=document.createElement("div");hint.className="mk-hint";
    hint.textContent="Add a box to start. Drag it to move it, drag its corner to resize it.";
    body.appendChild(hint);
    return;
  }

  /* the corner radius, which is also what the box gets called */
  const shp=document.createElement("div");shp.className="mk-shapes";
  CC_WEAR.rad.forEach((r,i)=>{
    const b=document.createElement("button");b.type="button";
    b.className="mk-shape"+(sel.r===r?" on":"");b.textContent=PART_WORD[i];
    b.addEventListener("click",()=>{ mkGroup(p=>{p.r=r;}); mkRender(); });
    shp.appendChild(b);
  });
  body.appendChild(shp);

  const acts=document.createElement("div");acts.className="mk-acts";
  const btn=(lab,cls,fn)=>{
    const b=document.createElement("button");b.type="button";b.className="mk-btn"+(cls?" "+cls:"");
    b.textContent=lab;b.addEventListener("click",fn);acts.appendChild(b);
  };
  /* Copy is the component button: the twin shares the class, so it shares
     the rule, and only its own left/top says where it stands. */
  btn("Copy","",()=>{
    if(mkParts.length>=CC_WEAR.partMax){ toast("That is as many boxes as one piece can hold."); return; }
    const c={...sel}; c.x=Math.max(-40,Math.min(140,c.x+Math.round(c.w*.6)));
    mkParts.push(c); mkSel=mkParts.length-1; mkRender();
    if(typeof sfx==="function")sfx(720,.04);
  });
  btn("Front","",()=>{
    const p=mkParts.splice(mkSel,1)[0]; mkParts.push(p); mkSel=mkParts.length-1; mkRender();
  });
  btn("Delete","danger",()=>{
    mkParts.splice(mkSel,1); mkSel=Math.min(mkSel,mkParts.length-1); mkRender();
    if(typeof sfx==="function")sfx(360,.05);
  });
  body.appendChild(acts);

  /* the way in that does not need to be discovered */
  const open=document.createElement("button");open.type="button";open.className="mk-btn mk-open";
  open.innerHTML='Open <b>.'+esc(CC_CODE.classNames(mkParts)[sel.cls]||"")+'</b> on its own';
  open.addEventListener("click",()=>compOpen(sel.cls));
  body.appendChild(open);
}

/* Drag inside the selected box to move it; drag its corner grip to resize.
   Everything is rounded to whole percent, because whole percent is what
   reads well in the stylesheet underneath. */
function wireParts(c){
  const at=e=>{
    const r=c.getBoundingClientRect();
    return {x:(e.clientX-r.left)/r.width*100, y:(e.clientY-r.top)/r.height*100, w:r.width};
  };
  const hit=q=>{
    for(let i=mkParts.length-1;i>=0;i--){
      const p=mkParts[i];
      /* on a component screen the rest of the piece is there to look at,
         not to grab: a stray tap on the hat must not pull the brim */
      if(mkFocus!=null&&p.cls!==mkFocus)continue;
      if(q.x>=p.x&&q.y>=p.y&&q.x<=p.x+p.w&&q.y<=p.y+p.h)return i;
    }
    return -1;
  };
  c.addEventListener("pointerdown",e=>{
    const q=at(e), sel=mkParts[mkSel];
    mkPaint=e.pointerId;
    try{c.setPointerCapture(e.pointerId);}catch(_){}
    e.preventDefault();
    /* the grip wins over everything, including a box sitting on top of it */
    if(sel){
      const gx=sel.x+sel.w, gy=sel.y+sel.h, near=(HANDLE+9)/q.w*100;
      if(Math.abs(q.x-gx)<near&&Math.abs(q.y-gy)<near){
        mkDrag={mode:"size",ox:q.x-gx,oy:q.y-gy}; return;
      }
    }
    const i=hit(q);
    if(i<0){ if(mkSel!==-1&&mkFocus==null){mkSel=-1;mkRender();} mkDrag=null; return; }
    const p=mkParts[i];
    mkDrag={mode:"move",ox:q.x-p.x,oy:q.y-p.y};
    if(i!==mkSel){ mkSel=i; mkRender(); } else mkDraw();
  });
  c.addEventListener("pointermove",e=>{
    if(mkPaint!==e.pointerId||!mkDrag)return;
    const q=at(e), p=mkParts[mkSel]; if(!p)return;
    if(mkDrag.mode==="move"){
      p.x=Math.round(Math.max(-40,Math.min(140-p.w,q.x-mkDrag.ox)));
      p.y=Math.round(Math.max(-40,Math.min(140-p.h,q.y-mkDrag.oy)));
    }else{
      /* size belongs to the shared rule, so the whole group grows together */
      const w=Math.round(Math.max(3,Math.min(160,q.x-mkDrag.ox-p.x)));
      const h=Math.round(Math.max(3,Math.min(160,q.y-mkDrag.oy-p.y)));
      mkGroup(q2=>{q2.w=w;q2.h=h;});
    }
    mkDraw();
  });
  const up=e=>{
    if(mkPaint!==e.pointerId)return;
    mkPaint=null;
    /* the code only has to be right when the finger comes off */
    if(mkDrag){ mkDrag=null; mkCodeRefresh(); }
  };
  c.addEventListener("pointerup",up);
  c.addEventListener("pointercancel",up);
}
/* ---------------- editing a value in the code ----------------
   The token you tapped names what it writes to, so the same strip serves
   every one of them: steppers for a number, the palette for a colour, a
   text field for the selector. Selecting a token also selects its box on
   the canvas, because "which one is this?" is the first question. */
function mkValParts(){
  if(!mkVal)return [];
  if(mkVal.i!=null){ const p=mkParts[mkVal.i]; return p?[p]:[]; }
  return mkParts.filter(p=>p.cls===mkVal.g);
}
function mkPick(v){
  if(v.k==="name"){
    if(mkFocus==null){ compOpen(v.g); return; }
    const n=$("cpName"); if(n){ n.focus(); n.select&&n.select(); }
    return;
  }
  mkVal=(mkVal&&mkVal.k===v.k&&mkVal.i===v.i&&mkVal.g===v.g)?null:v;
  if(mkVal){
    const at=mkVal.i!=null?mkVal.i:mkParts.findIndex(p=>p.cls===mkVal.g);
    if(at>=0)mkSel=at;
  }
  mkRender();
  const ins=$(CID()+"Ins"); if(ins&&mkVal)ins.scrollIntoView({block:"nearest"});
}
function mkNudge(d){
  const f=CC_CODE.field[mkVal.k]; if(!f)return;
  const list=mkValParts(); if(!list.length)return;
  const now=(mkVal.k==="a")?(list[0].a|0):list[0][mkVal.k];
  const next=Math.max(f.lo,Math.min(f.hi,now+d));
  if(next===now)return;
  for(const p of list)p[mkVal.k]=next;
  mkDraw(); mkCodeRefresh(); mkInsRefresh();
  if(typeof sfx==="function")sfx(620,.02);
}
function mkInsRefresh(){
  const v=$(CID()+"InsVal"); if(!v||!mkVal)return;
  const f=CC_CODE.field[mkVal.k], list=mkValParts();
  if(f&&list.length)v.textContent=(mkVal.k==="a"?(list[0].a|0):list[0][mkVal.k])+f.unit;
}
function mkInspector(){
  const box=document.createElement("div");box.className="mk-ins";box.id=CID()+"Ins";
  if(!mkVal||!mkValParts().length){ box.hidden=true; return box; }
  const f=CC_CODE.field[mkVal.k], list=mkValParts(), p=list[0];

  if(mkVal.k==="c"){
    const lab=document.createElement("span");lab.className="mk-inslab";lab.textContent="background";
    box.appendChild(lab);
    const row=document.createElement("div");row.className="mk-inspal";
    for(let i=0;i<CC_WEAR.pal.length;i++){
      const b=document.createElement("button");b.type="button";
      b.className="mk-insdot"+(p.c===i?" on":"");
      b.style.background=CC_WEAR.pal[i];
      b.setAttribute("aria-label",CC_WEAR.names[i]);
      b.addEventListener("click",()=>{ for(const q of list)q.c=i; mkColor=i; mkRender(); });
      row.appendChild(b);
    }
    box.appendChild(row);
    return box;
  }

  if(!f){ box.hidden=true; return box; }
  const lab=document.createElement("span");lab.className="mk-inslab";lab.textContent=f.prop;
  box.appendChild(lab);
  const step=(d,txt)=>{
    const b=document.createElement("button");b.type="button";b.className="mk-step";
    b.textContent=txt;b.setAttribute("aria-label",f.prop+" "+txt);
    b.addEventListener("click",()=>mkNudge(d));
    box.appendChild(b);
  };
  /* a plain hyphen, not U+2212: js/ui-icons.js swaps the typographic minus
     for an SVG glyph, which would leave one button an icon and its twin
     across the value plain text */
  step(-f.big,"-"+f.big); step(-f.step,"-1");
  const v=document.createElement("span");v.className="mk-insval";v.id=CID()+"InsVal";
  v.textContent=(mkVal.k==="a"?(p.a|0):p[mkVal.k])+f.unit;
  box.appendChild(v);
  step(f.step,"+1"); step(f.big,"+"+f.big);
  return box;
}

/* The code on screen is valid on its own: a div and a stylesheet that work
   in any HTML file. Copying it out is the shortest path from this game to a
   real browser, so it is one button. */
function mkCopy(){
  const src=CC_CODE.code({name:mkName||"my piece",parts:mkParts},mkSlot,mkFocus);
  const done=()=>toast("Copied! Paste it into an HTML file to see it in a browser.");
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(src).then(done).catch(()=>mkCopyFallback(src,done));
  }else mkCopyFallback(src,done);
}
function mkCopyFallback(src,done){
  try{
    const ta=document.createElement("textarea");
    ta.value=src;ta.style.cssText="position:fixed;left:-9999px;top:0";
    document.body.appendChild(ta);ta.select();
    const ok=document.execCommand&&document.execCommand("copy");
    ta.remove();
    if(ok)done(); else toast("Could not copy — select the code and copy it by hand.");
  }catch(_){ toast("Could not copy — select the code and copy it by hand."); }
}

/* `el` is passed while the block is still being assembled: getElementById
   cannot find a <pre> that is not in the document yet, and the first fill
   happens before the caller appends it. */
function mkCodeRefresh(el){
  const pre=el||$(CID()+"Code"); if(!pre)return;
  pre.innerHTML=CC_CODE.html({name:mkName||"my piece",parts:mkParts},mkSlot,mkFocus);
  /* the click handler lives on <pre>, so replacing its children keeps it —
     only the mark on the chosen token has to be put back */
  if(!mkVal)return;
  for(const b of pre.querySelectorAll(".val")){
    if(b.dataset.k!==mkVal.k)continue;
    const i=b.dataset.i!=null?+b.dataset.i:null, g=b.dataset.g!=null?+b.dataset.g:null;
    if(i===mkVal.i&&g===mkVal.g){ b.classList.add("on"); break; }
  }
}

/* The code block, on either screen. The same promise the Python tab makes
   about blocks, made about boxes — except every number here is a real
   declaration in a real rule, so every number here can be tapped. Dragging
   roughs a box out; the code is where you say exactly 42%.

   The hint sits ABOVE the code, because a hint under three screens of
   stylesheet is a hint nobody reads. */
function mkCodeBlock(){
  const cw=document.createElement("div");cw.className="mk-code";
  const hint=document.createElement("div");hint.className="mk-tip";
  hint.innerHTML='<span class="mk-tipk">42%</span>'+
    '<span class="mk-tipt">Tap any value like this one to change it</span>';
  cw.appendChild(hint);
  const pre=document.createElement("pre");pre.className="mono";pre.id=CID()+"Code";
  pre.addEventListener("click",e=>{
    const b=e.target.closest(".val"); if(!b)return;
    mkPick({k:b.dataset.k,
      i:b.dataset.i!=null?+b.dataset.i:null,
      g:b.dataset.g!=null?+b.dataset.g:null});
  });
  cw.appendChild(pre);
  mkCodeRefresh(pre);
  cw.appendChild(mkInspector());
  const note=document.createElement("div");note.className="pynote";
  note.textContent=mkFocus!=null
    ?"One class, and every box that wears it. Change the rule and they all change; the code above is the whole component."
    :"This is your piece written in HTML and CSS — the language every web page is made of. Tap a class name to open that component on its own.";
  cw.appendChild(note);
  const cp=document.createElement("button");cp.type="button";cp.className="mk-btn mk-copy";
  cp.textContent="Copy code";
  cp.addEventListener("click",mkCopy);
  cw.appendChild(cp);
  return cw;
}

/* ---------------- one component, on its own screen ----------------
   Everything a component needs is here and nothing else is: its class, its
   boxes, its rule. What it does NOT hide is the rest of the piece — the
   other boxes stay on the canvas at a quarter strength and the robot beside
   it wears everything it owns, because you cannot design a brim without
   seeing the hat it goes under. */
function compOpen(cls){
  if(mkKind!=="parts")return;
  const at=mkParts.findIndex(p=>p.cls===cls);
  if(at<0)return;
  mkFocus=cls; mkSel=at; mkVal=null;
  $("maker").classList.remove("open");
  renderComp();
  $("comp").classList.add("open");
  if(typeof sfx==="function")sfx(640,.04);
}
function compExit(){
  mkFocus=null; mkVal=null;
  $("comp").classList.remove("open");
}
function compClose(){
  compExit();
  renderMaker();
  $("maker").classList.add("open");
}

function renderComp(){
  const body=$("compBody"); if(!body)return;
  body.innerHTML="";
  const list=mkParts.filter(p=>p.cls===mkFocus);
  if(!list.length){ compClose(); return; }
  const names=CC_CODE.classNames(mkParts);

  /* the class, first and editable, because the name IS the component */
  const head=document.createElement("div");head.className="cp-name";
  const dot=document.createElement("span");dot.className="cp-dot";
  dot.style.background=CC_WEAR.pal[list[0].c];
  head.appendChild(dot);
  const dotlab=document.createElement("span");dotlab.className="cp-sel";dotlab.textContent=".";
  head.appendChild(dotlab);
  const inp=document.createElement("input");inp.type="text";inp.id="cpName";inp.className="cp-input";
  inp.maxLength=16;inp.setAttribute("aria-label","Class name");
  inp.value=names[mkFocus]||"";
  inp.addEventListener("input",()=>{
    const n=CC_CODE.cleanName(inp.value);
    for(const q of mkParts)if(q.cls===mkFocus){ if(n)q.cn=n; else delete q.cn; }
    mkCodeRefresh();
  });
  head.appendChild(inp);
  const many=document.createElement("span");many.className="cp-many";
  many.textContent=list.length>1?"×"+list.length:"";
  head.appendChild(many);
  body.appendChild(head);

  /* the canvas, with the rest of the piece behind it, and the robot */
  const stage=document.createElement("div");stage.className="mk-stage";
  const pv=document.createElement("div");pv.className="mk-prev";
  const pc=document.createElement("canvas");pc.id="cpPrev";pv.appendChild(pc);
  const pad=document.createElement("div");pad.className="mk-pad";
  const cc=document.createElement("canvas");cc.id="cpCanvas";pad.appendChild(cc);
  stage.appendChild(pad);stage.appendChild(pv);
  body.appendChild(stage);

  /* which of this component's boxes you are moving, when there is a choice */
  if(list.length>1){
    const chips=document.createElement("div");chips.className="mk-parts";
    mkParts.forEach((p,i)=>{
      if(p.cls!==mkFocus)return;
      const b=document.createElement("button");b.type="button";
      b.className="mk-part"+(i===mkSel?" on":"");
      b.innerHTML='<span class="pd" style="background:'+CC_WEAR.pal[p.c]+'"></span>';
      b.setAttribute("aria-label","."+names[mkFocus]);
      b.addEventListener("click",()=>{ mkSel=i; mkVal=null; renderComp(); });
      chips.appendChild(b);
    });
    body.appendChild(chips);
  }

  /* the colours and the corner radius, both of which the rule owns */
  const pal=document.createElement("div");pal.className="mk-pal";
  for(let i=0;i<CC_WEAR.pal.length;i++){
    const b=document.createElement("button");b.type="button";
    b.className="mk-dot"+(list[0].c===i?" on":"");
    b.style.background=CC_WEAR.pal[i];
    b.setAttribute("aria-label",CC_WEAR.names[i]);
    b.addEventListener("click",()=>{ for(const q of list)q.c=i; mkColor=i; renderComp(); });
    pal.appendChild(b);
  }
  body.appendChild(pal);

  const shp=document.createElement("div");shp.className="mk-shapes";
  CC_WEAR.rad.forEach((r,i)=>{
    const b=document.createElement("button");b.type="button";
    b.className="mk-shape"+(list[0].r===r?" on":"");b.textContent=PART_WORD[i];
    b.addEventListener("click",()=>{ for(const q of list)q.r=r; renderComp(); });
    shp.appendChild(b);
  });
  body.appendChild(shp);

  const acts=document.createElement("div");acts.className="mk-acts";
  const btn=(lab,cls,fn)=>{
    const b=document.createElement("button");b.type="button";b.className="mk-btn"+(cls?" "+cls:"");
    b.textContent=lab;b.addEventListener("click",fn);acts.appendChild(b);
  };
  btn("Copy","",()=>{
    if(mkParts.length>=CC_WEAR.partMax){ toast("That is as many boxes as one piece can hold."); return; }
    const c={...mkParts[mkSel]}; c.x=Math.max(-40,Math.min(140,c.x+Math.round(c.w*.6)));
    mkParts.push(c); mkSel=mkParts.length-1; renderComp();
    if(typeof sfx==="function")sfx(720,.04);
  });
  btn("Front","",()=>{
    const p=mkParts.splice(mkSel,1)[0]; mkParts.push(p); mkSel=mkParts.length-1; renderComp();
  });
  btn("Delete","danger",()=>{
    for(let i=mkParts.length-1;i>=0;i--)if(mkParts[i].cls===mkFocus)mkParts.splice(i,1);
    if(typeof sfx==="function")sfx(360,.05);
    compClose();
  });
  body.appendChild(acts);

  body.appendChild(mkCodeBlock());

  const done=document.createElement("div");done.className="mk-acts";
  const d=document.createElement("button");d.type="button";d.className="mk-btn go";
  d.textContent="Done";
  d.addEventListener("click",compClose);
  done.appendChild(d);
  body.appendChild(done);

  wireParts(cc);
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
  if(mkKind==="parts"?!mkParts.length:mkEmpty()){
    toast(mkKind==="parts"?"Add a box first!":"Paint something first!"); return;
  }
  const list=myWear(), at=list.findIndex(p=>p.id===mkId);
  if(at<0&&wearOf(mkSlot).length>=CC_WEAR.max){
    toast("You already have "+CC_WEAR.max+" of these. Delete one to make another.");
    return;
  }
  const nm=safeText(mkName,18)||"My piece";
  const piece=mkKind==="parts"
    ?{id:mkId,slot:mkSlot,name:nm,kind:"parts",parts:mkParts.map(p=>({...p}))}
    :{id:mkId,slot:mkSlot,name:nm,px:mkStr(),sm:mkSm};
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
