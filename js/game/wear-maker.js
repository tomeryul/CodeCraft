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
/* the piece itself is a box too: it has padding, and it can lay its own
   children out instead of letting each of them say where it goes */
let mkRoot={lay:0,pad:0,gap:0,jus:0,ali:0};
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
/* which pose the preview robot holds. A piece has to be judged on a moving
   robot, not a standing one: a brim that clears the antenna at rest can
   still swing through it on a chop, and shoes only make sense mid-stride. */
let mkPose="idle";
const POSES=[["idle","Idle"],["walk","Walk"],["work","Chop"]];

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
  mkRoot={lay:0,pad:0,gap:0,jus:0,ali:0};
  if(p){
    mkId=p.id; mkName=p.name;
    if(p.kind==="parts"){ mkKind="parts"; mkParts=p.parts.map(q=>({...q}));
      if(p.root)mkRoot=Object.assign(mkRoot,p.root); }
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
  if(mkKind==="parts")CC_WEAR.parts(g,mkSlot,mkParts,mkFocus,mkRoot);
  else CC_WEAR.grid(g,mkSlot,mkStr(),mkSm);
  g.restore();
  if(mkKind==="parts"){ mkHandles(g,W,H); return; }
  g.strokeStyle="rgba(255,255,255,.13)";g.lineWidth=1;
  for(let i=1;i<n;i++){
    g.beginPath();g.moveTo(i*cw,0);g.lineTo(i*cw,H);g.stroke();
    g.beginPath();g.moveTo(0,i*cw);g.lineTo(W,i*cw);g.stroke();
  }
}
/* Where the boxes actually landed. Everything that has to agree about a
   box's position — the paint, the drag, the overlay — reads this one
   answer, so they cannot disagree. */
function mkLayout(){ return CC_WEAR.layout(mkParts,mkRoot); }
/* the content box a part's own numbers are measured against: its holder's,
   or the piece's */
function mkHolderBox(L,i){
  const p=mkParts[i]; if(!p)return L.rootContent;
  if(p.pin==null)return L.rootContent;
  const at=mkParts.findIndex(q=>q.pid===p.pin);
  return (at>=0&&L.content[at])?L.content[at]:L.rootContent;
}
function mkHolderBoxObj(i){
  const p=mkParts[i]; if(!p||p.pin==null)return mkRoot;
  return mkParts.find(q=>q.pid===p.pin)||mkRoot;
}
const mkFlows=o=>(CC_WEAR.lay[CC_WEAR.field(o,"lay")]||"free")!=="free";

/* The box model, drawn the way devtools draws it: margin, border, padding,
   content, out from the middle. It is the single picture that makes CSS
   click, and it costs four rectangles. The container's centre lines are
   drawn with it, because "is this centred" is the question the whole
   layout section exists to answer. */
const RING=[["margin","rgba(246,178,107,.30)"],["border","rgba(255,214,107,.32)"],
            ["padding","rgba(147,224,155,.30)"],["content","rgba(120,180,255,.34)"]];
const HANDLE=13;
function mkHandles(g,W,H){
  const p=mkParts[mkSel]; if(!p)return;
  const L=mkLayout(), r=L.rect[mkSel]; if(!r)return;
  const K=W/100;
  const x=r.x*K, y=r.y*K, w=r.w*K, h=r.h*K;
  const rings=CC_WEAR.rings(x,y,w,h,p,K);

  /* the holder's centre lines: what "centre" means for THIS box */
  const hb=mkHolderBox(L,mkSel);
  if(hb){
    g.save();g.setLineDash([3,5]);g.lineWidth=1;g.strokeStyle="rgba(255,255,255,.30)";
    const hx=(hb.x+hb.w/2)*K, hy=(hb.y+hb.h/2)*K;
    g.beginPath();g.moveTo(hx,hb.y*K);g.lineTo(hx,(hb.y+hb.h)*K);g.stroke();
    g.beginPath();g.moveTo(hb.x*K,hy);g.lineTo((hb.x+hb.w)*K,hy);g.stroke();
    g.restore();
  }

  /* each ring as the band between it and the next one in */
  for(let i=0;i<RING.length-1;i++){
    const a=rings[i], b=rings[i+1];
    if(a[3]<=0||a[4]<=0)continue;
    if(Math.abs(a[1]-b[1])<.3&&Math.abs(a[2]-b[2])<.3)continue;
    g.save();
    g.beginPath();g.rect(a[1],a[2],a[3],a[4]);
    g.rect(b[1]+b[3],b[2],-b[3],b[4]);   /* reverse-wound hole */
    g.fillStyle=RING[i][1];g.fill("evenodd");
    g.restore();
  }
  g.setLineDash([5,4]);
  g.strokeStyle="#fff";g.lineWidth=2;g.strokeRect(x,y,w,h);
  g.setLineDash([]);
  /* a box the layout is placing cannot be dragged, so it is not offered a
     grip — the grip is a promise that dragging will do something */
  if(!mkFlows(mkHolderBoxObj(mkSel))){
    g.fillStyle="#ffb830";g.strokeStyle="#241b45";g.lineWidth=2;
    g.beginPath();g.arc(x+w,y+h,HANDLE/2+2,0,7);g.fill();g.stroke();
  }
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
      ?{id:mkId,kind:"parts",parts:mkParts,root:mkRoot}
      :{id:mkId,px:mkStr(),sm:mkSm});
    const r=robots[selRobot]||robots[0];
    if(r){
      /* the box is portrait and as tall as the canvas beside it, so the
         robot gets read at a size a child can actually judge — the old one
         was 58 body units in a 132px square and looked like a token */
      const w=Math.max(80,Math.round(cv.clientWidth||120));
      const h=Math.max(120,Math.round(cv.clientHeight||220));
      const d=Math.min(2,window.devicePixelRatio||1);
      if(cv.width!==Math.round(w*d)||cv.height!==Math.round(h*d)){
        cv.width=Math.round(w*d);cv.height=Math.round(h*d);
      }
      const g=cv.getContext("2d");
      g.setTransform(d,0,0,d,0,0);g.clearRect(0,0,w,h);
      const wear={hat:r.hat,outfit:r.outfit,shoes:r.shoes};
      wear[mkSlot]=mkId;
      /* A chopping robot is 1.9 body-widths across once the axe is out and
         1.68 tall from hat to sole, so the fit is against both — and one
         size for all three poses, because a robot that changes size when you
         switch pose is a robot you cannot compare. The chop reaches to the
         right, so the body sits a little left of centre on that one. */
      const s2=Math.min(w/1.95,h*.55);
      drawBoardRobot(g,w/2-(mkPose==="work"?s2*.2:0),h*.5,s2,
        "E",safeColor(r.color),false,ts||0,wear,mkPose);
    }
    mkRaf=requestAnimationFrame(step);
  };
  mkRaf=requestAnimationFrame(step);
}

/* ---------------- the sheet ---------------- */
function renderMaker(){
  const body=$("makerBody"); if(!body)return;
  /* the lesson watches the piece rather than a Next button, so the check
     belongs wherever the piece is about to be drawn again */
  if(typeof feCheck==="function")feCheck();
  body.innerHTML="";
  if(typeof feBanner==="function")body.appendChild(feBanner());

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
  stage.appendChild(pv);stage.appendChild(mkPoseRow());stage.appendChild(pad);
  body.appendChild(stage);
  if(mkKind==="parts")body.appendChild(mkBoxKey());

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
function mkNewPid(){ let m=-1; for(const p of mkParts)if(p.pid>m)m=p.pid; return m+1; }
/* a fresh box carries every field, so nothing downstream has to guess what
   a missing one meant */
function mkBox(over){
  return Object.assign({cls:mkNewCls(),pid:mkNewPid(),x:32,y:38,w:36,h:24,
    r:CC_WEAR.rad[1],a:0,c:mkColor<0?0:mkColor,
    pad:0,mg:0,bw:0,bc:15,lay:0,gap:0,jus:0,ali:0,org:0},over||{});
}
function mkAddPart(){
  if(mkParts.length>=CC_WEAR.partMax){ toast("That is as many boxes as one piece can hold."); return; }
  /* a new box joins whatever is open: on a component screen it lands inside
     that component, which is what "add" means while you are looking at one */
  const host=(mkFocus!=null)?mkParts.find(p=>p.cls===mkFocus):null;
  mkParts.push(mkBox(host?{pin:host.pid}:null));
  mkSel=mkParts.length-1;
  mkRender();
  if(typeof sfx==="function")sfx(660,.04);
}
/* the boxes held inside one box, however deep */
function mkDescend(pid,acc){
  acc=acc||[];
  mkParts.forEach((p,i)=>{ if(p.pin===pid){ acc.push(i); mkDescend(p.pid,acc); } });
  return acc;
}
/* Parents come before their children, always: it is what makes a cycle
   impossible and the paint order right. Sending a box to the front takes
   its children with it, and dropping a box lets its children out rather
   than taking them down with it. */
function mkToFront(at){
  const p=mkParts[at], moving=[at].concat(mkDescend(p.pid));
  const set=new Set(moving), keep=[], went=[];
  mkParts.forEach((q,i)=>{ (set.has(i)?went:keep).push(q); });
  mkParts=keep.concat(went);
  mkSel=mkParts.indexOf(p);
}
function mkOrphan(pid){
  for(const q of mkParts)if(q.pin===pid)delete q.pin;
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
  btn("Copy","",()=>{ mkCopyPart(mkSel); });
  btn("Front","",()=>{ mkToFront(mkSel); mkRender(); });
  btn("Delete","danger",()=>{
    mkOrphan(mkParts[mkSel].pid);
    mkParts.splice(mkSel,1); mkSel=Math.min(mkSel,mkParts.length-1); mkRender();
    if(typeof sfx==="function")sfx(360,.05);
  });
  body.appendChild(acts);

  /* the way in that does not need to be discovered */
  const open=document.createElement("button");open.type="button";open.className="mk-btn mk-open";
  /* one text node, not three: js/game/i18n.js reassembles a run of text and
     lifted emoji, and a <b> in the middle breaks the run — the sentence
     would reach the dictionary in pieces and come back English */
  open.textContent="Open ."+(CC_CODE.classNames(mkParts)[sel.cls]||"")+" on its own";
  open.addEventListener("click",()=>compOpen(sel.cls));
  body.appendChild(open);
}

/* Putting a component inside another one. Every box of the group moves,
   because a class is one thing wherever it appears — and the whole group
   has to land after its new parent, or "parents come first" is broken and
   the tree stops being a tree. */
function mkNestInto(pid){
  if(mkFocus==null)return;
  const moving=[];
  mkParts.forEach((q,i)=>{ if(q.cls===mkFocus){ moving.push(i); mkDescend(q.pid).forEach(j=>moving.push(j)); } });
  const set=new Set(moving);
  const went=[], keep=[];
  mkParts.forEach((q,i)=>{ (set.has(i)?went:keep).push(q); });
  for(const q of went)if(q.cls===mkFocus){ if(pid==null)delete q.pin; else q.pin=pid; }
  if(pid==null){ mkParts=went.concat(keep); }
  else{
    /* land directly after the parent's own subtree, so nothing that was
       inside the parent ends up in front of the newcomer by accident */
    let at=keep.findIndex(q=>q.pid===pid);
    if(at<0){ mkParts=keep.concat(went); }
    else{
      at++;
      while(at<keep.length&&mkDescend(pid).length&&keep[at]&&keep[at].pin!=null)at++;
      mkParts=keep.slice(0,at).concat(went,keep.slice(at));
    }
  }
  mkSel=mkParts.findIndex(q=>q.cls===mkFocus);
  renderComp();
  if(typeof sfx==="function")sfx(680,.04);
}

/* A copy shares the class, so it shares the rule — and it takes whatever is
   inside it, because copying an element in HTML copies its children too. */
function mkCopyPart(at){
  const src=mkParts[at];
  if(!src)return;
  const subs=mkDescend(src.pid);
  if(mkParts.length+1+subs.length>CC_WEAR.partMax){
    toast("That is as many boxes as one piece can hold."); return;
  }
  const c={...src}; c.pid=mkNewPid();
  if(c.pin==null)c.x=Math.max(-40,Math.min(140,c.x+Math.round(c.w*.6)));
  mkParts.push(c);
  const map={}; map[src.pid]=c.pid;
  for(const i of subs){
    const q={...mkParts[i]}; q.pid=mkNewPid();
    map[mkParts[i].pid]=q.pid;
    q.pin=map[mkParts[i].pin];
    mkParts.push(q);
  }
  mkSel=mkParts.indexOf(c);
  mkRender();
  if(typeof sfx==="function")sfx(720,.04);
}

/* Drag inside the selected box to move it; drag its corner grip to resize.
   Everything is rounded to whole percent, because whole percent is what
   reads well in the stylesheet underneath. */
function wireParts(c){
  const at=e=>{
    const r=c.getBoundingClientRect();
    return {x:(e.clientX-r.left)/r.width*100, y:(e.clientY-r.top)/r.height*100, w:r.width};
  };
  /* Hit-testing reads the laid-out rectangles, not the raw numbers: a box
     inside a row is nowhere near its own left/top, and a box inside a
     padded parent is inset from them. */
  const hit=q=>{
    const L=mkLayout();
    for(let i=mkParts.length-1;i>=0;i--){
      const p=mkParts[i], r=L.rect[i]; if(!r)continue;
      /* on a component screen the rest of the piece is there to look at,
         not to grab: a stray tap on the hat must not pull the brim */
      if(mkFocus!=null&&p.cls!==mkFocus)continue;
      if(q.x>=r.x&&q.y>=r.y&&q.x<=r.x+r.w&&q.y<=r.y+r.h)return i;
    }
    return -1;
  };
  c.addEventListener("pointerdown",e=>{
    const q=at(e), L=mkLayout(), sr=L.rect[mkSel];
    mkPaint=e.pointerId;
    try{c.setPointerCapture(e.pointerId);}catch(_){}
    e.preventDefault();
    /* the grip wins over everything, including a box sitting on top of it */
    if(sr&&!mkFlows(mkHolderBoxObj(mkSel))){
      const gx=sr.x+sr.w, gy=sr.y+sr.h, near=(HANDLE+9)/q.w*100;
      if(Math.abs(q.x-gx)<near&&Math.abs(q.y-gy)<near){
        mkDrag={mode:"size",ox:q.x-gx,oy:q.y-gy}; return;
      }
    }
    const i=hit(q);
    if(i<0){ if(mkSel!==-1&&mkFocus==null){mkSel=-1;mkRender();} mkDrag=null; return; }
    if(mkFlows(mkHolderBoxObj(i))){
      /* the layout is placing this one. Saying so once beats a drag that
         silently does nothing, and it names the two things that WOULD
         move it. */
      mkDrag=null;
      if(i!==mkSel){ mkSel=i; mkRender(); }
      toast("The layout places this box — change justify-content or its margin.");
      return;
    }
    const r=L.rect[i];
    mkDrag={mode:"move",ox:q.x-r.x,oy:q.y-r.y};
    if(i!==mkSel){ mkSel=i; mkRender(); } else mkDraw();
  });
  c.addEventListener("pointermove",e=>{
    if(mkPaint!==e.pointerId||!mkDrag)return;
    const q=at(e), p=mkParts[mkSel]; if(!p)return;
    /* a box's own numbers are percentages of its holder's content box, so
       that is the space a drag has to be converted into */
    const L=mkLayout(), hb=mkHolderBox(L,mkSel);
    const sx=(hb&&hb.w>0)?hb.w/100:1, sy=(hb&&hb.h>0)?hb.h/100:1;
    if(mkDrag.mode==="move"){
      /* left/top name the box's top-left or its centre, so a drag has to put
         back the half-size the layout took off */
      const off=CC_WEAR.field(p,"org")===1?.5:0;
      p.x=Math.round(Math.max(-40,Math.min(140,(q.x-mkDrag.ox-hb.x)/sx+p.w*off)));
      p.y=Math.round(Math.max(-40,Math.min(140,(q.y-mkDrag.oy-hb.y)/sy+p.h*off)));
    }else{
      /* size belongs to the shared rule, so the whole group grows together */
      const r=L.rect[mkSel];
      const w=Math.round(Math.max(3,Math.min(160,(q.x-mkDrag.ox-r.x)/sx)));
      const h=Math.round(Math.max(3,Math.min(160,(q.y-mkDrag.oy-r.y)/sy)));
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
/* what a chosen token writes to: one element, a whole group, or the piece
   itself — the three scopes a CSS declaration can belong to here */
function mkValParts(){
  if(!mkVal)return [];
  if(mkVal.g==="root")return [mkRoot];
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
  if(mkVal&&mkVal.g!=="root"){
    const at=mkVal.i!=null?mkVal.i:mkParts.findIndex(p=>p.cls===mkVal.g);
    if(at>=0)mkSel=at;
  }
  mkRender();
  const ins=$(CID()+"Ins"); if(ins&&mkVal)ins.scrollIntoView({block:"nearest"});
}
const mkValNow=(o,k)=>CC_WEAR.field(o,k)|0;
function mkNudge(d){
  const f=CC_CODE.field[mkVal.k]; if(!f)return;
  const list=mkValParts(); if(!list.length)return;
  const now=mkValNow(list[0],mkVal.k);
  const next=Math.max(f.lo,Math.min(f.hi,now+d));
  if(next===now)return;
  for(const p of list)p[mkVal.k]=next;
  mkDraw(); mkCodeRefresh(); mkInsRefresh();
  if(typeof feCheck==="function"&&feCheck())mkRender();
  if(typeof sfx==="function")sfx(620,.02);
}
function mkInsRefresh(){
  const v=$(CID()+"InsVal"); if(!v||!mkVal)return;
  const f=CC_CODE.field[mkVal.k], list=mkValParts();
  if(f&&list.length)v.textContent=mkValNow(list[0],mkVal.k)+f.unit;
}
/* the sentence for whatever is being edited — a value you can change and
   cannot name is a slider, not a lesson */
function mkTip(text){
  const t=document.createElement("div");t.className="mk-instip";t.textContent=text||"";
  return t;
}
function mkInspector(){
  const wrap=document.createElement("div");wrap.className="mk-inswrap";
  const box=mkInspectorStrip();
  wrap.appendChild(box);
  if(!box.hidden&&mkVal){
    const KW=CC_CODE.keyword[mkVal.k], f=CC_CODE.field[mkVal.k];
    const tip=(KW&&KW.tip)||(f&&f.tip)||CC_CODE.colTip[mkVal.k]||"";
    if(tip)wrap.appendChild(mkTip(tip));
  }else wrap.hidden=true;
  return wrap;
}
function mkInspectorStrip(){
  const box=document.createElement("div");box.className="mk-ins";box.id=CID()+"Ins";
  if(!mkVal||!mkValParts().length){ box.hidden=true; return box; }
  const f=CC_CODE.field[mkVal.k], list=mkValParts(), p=list[0];
  if(!p){ box.hidden=true; return box; }

  /* a keyword is not a range — it is a short list of words, so the strip
     offers the words. This is how flexbox is reachable at all: nothing on
     the canvas can say "justify-content". */
  const KW=CC_CODE.keyword[mkVal.k];
  if(KW){
    const lab=document.createElement("span");lab.className="mk-inslab";lab.textContent=KW.prop;
    box.appendChild(lab);
    const row=document.createElement("div");row.className="mk-inskw";
    KW.opts().forEach((word,v)=>{
      const b=document.createElement("button");b.type="button";
      b.className="mk-kw"+(CC_WEAR.field(p,mkVal.k)===v?" on":"");
      b.textContent=word;
      b.addEventListener("click",()=>{ for(const q of list)q[mkVal.k]=v; mkRender(); });
      row.appendChild(b);
    });
    box.appendChild(row);
    return box;
  }

  if(mkVal.k==="c"||mkVal.k==="bc"){
    const lab=document.createElement("span");lab.className="mk-inslab";
    lab.textContent=mkVal.k==="bc"?"border-color":"background";
    box.appendChild(lab);
    const row=document.createElement("div");row.className="mk-inspal";
    for(let i=0;i<CC_WEAR.pal.length;i++){
      const b=document.createElement("button");b.type="button";
      b.className="mk-insdot"+(CC_WEAR.field(p,mkVal.k)===i?" on":"");
      b.style.background=CC_WEAR.pal[i];
      b.setAttribute("aria-label",CC_WEAR.names[i]);
      b.addEventListener("click",()=>{
        const k=mkVal.k;
        for(const q of list)q[k]=i;
        if(k==="c")mkColor=i;
        mkRender();
      });
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
  v.textContent=mkValNow(p,mkVal.k)+f.unit;
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

/* The four colours on the canvas, named. Without this the overlay is
   decoration; with it, it is the box model — and the box model is the one
   diagram that makes CSS make sense. */
function mkBoxKey(){
  const k=document.createElement("div");k.className="mk-key";
  [["margin","#f6b26b"],["border","#ffd66b"],["padding","#93e09b"],["content","#78b4ff"]]
    .forEach(([lab,col])=>{
      const s2=document.createElement("span");
      const i=document.createElement("i");i.style.background=col;
      s2.appendChild(i);s2.appendChild(document.createTextNode(lab));
      k.appendChild(s2);
    });
  return k;
}

/* Standing, walking, chopping — the three the world actually shows. */
function mkPoseRow(){
  const wrap=document.createElement("div");wrap.className="mk-fin mk-poses";
  const seg=document.createElement("div");seg.className="mk-seg";
  POSES.forEach(([k,lab])=>{
    const b=document.createElement("button");b.type="button";
    b.className="mk-sm"+(mkPose===k?" on":"");b.textContent=lab;
    b.addEventListener("click",()=>{ if(mkPose===k)return; mkPose=k; mkRender(); });
    seg.appendChild(b);
  });
  wrap.appendChild(seg);
  return wrap;
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
  if(typeof feCheck==="function")feCheck();
  body.innerHTML="";
  if(typeof feBanner==="function")body.appendChild(feBanner());
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
  stage.appendChild(pv);stage.appendChild(mkPoseRow());stage.appendChild(pad);
  body.appendChild(stage);
  if(mkKind==="parts")body.appendChild(mkBoxKey());

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

  /* What this component IS, in a sentence: how many elements wear the
     class, what it sits in, and what it holds. A component screen that
     does not say what a component is teaches the buttons, not the idea. */
  const holdCount=mkParts.filter(q=>q.pin===list[0].pid).length;
  const inName=(list[0].pin!=null)
    ?"."+(names[(mkParts.find(q=>q.pid===list[0].pin)||{}).cls]||"?")
    :"."+mkSlot;
  /* three sentences, three text nodes: js/game/i18n.js looks a text node up
     whole, so a paragraph glued together from counts and class names would
     never match anything and would stay English forever */
  const what=document.createElement("div");what.className="cp-what";
  const line=t=>{const sp=document.createElement("span");sp.textContent=t;what.appendChild(sp);};
  line(list.length===1
    ?"One <div> wears this class."
    :list.length+" <div>s wear this class — one rule paints them all.");
  line("It sits inside "+inName+".");
  line(holdCount===0?"It holds nothing yet."
      :(holdCount===1?"It holds one box.":"It holds "+holdCount+" boxes."));
  body.appendChild(what);

  /* Which corner its left and top name. The other half of "where is the
     centre": measuring from the middle instead of the top-left is one line
     of real CSS, and it is the line every front-end developer writes. */
  const holderFlows=mkFlows(mkParts.find(q=>q.pid===list[0].pin)||mkRoot);
  const anc=document.createElement("div");anc.className="cp-in";
  const alab=document.createElement("span");alab.className="cp-inlab";alab.textContent="Measured from";
  anc.appendChild(alab);
  const arow=document.createElement("div");arow.className="cp-inrow";
  [["its top-left",0],["its centre",1]].forEach(([lab,v])=>{
    const b2=document.createElement("button");b2.type="button";
    b2.className="mk-kw"+(CC_WEAR.field(list[0],"org")===v?" on":"");
    b2.textContent=lab; b2.disabled=holderFlows;
    b2.addEventListener("click",()=>{ for(const q of list)q.org=v; renderComp(); });
    arow.appendChild(b2);
  });
  anc.appendChild(arow);
  body.appendChild(anc);
  if(!holderFlows){
    const at=document.createElement("div");at.className="mk-instip";
    at.textContent=CC_WEAR.field(list[0],"org")===1
      ?"left and top name its middle — that is translate(-50%, -50%) in the code."
      :"left and top name its top-left corner, the way a browser measures by default.";
    body.appendChild(at);
  }

  /* Which box this one lives inside. "What I make is inside them" is the
     whole idea of nesting, and it needs one row: the slot, or any box that
     is not this one and not something already inside it. */
  const host=document.createElement("div");host.className="cp-in";
  const hlab=document.createElement("span");hlab.className="cp-inlab";hlab.textContent="Inside";
  host.appendChild(hlab);
  const hrow=document.createElement("div");hrow.className="cp-inrow";
  const inside=list[0].pin;
  const mkIn=(lab,pid,dis)=>{
    const b=document.createElement("button");b.type="button";
    b.className="mk-kw"+(inside===pid||(pid==null&&inside==null)?" on":"");
    b.textContent=lab; b.disabled=!!dis;
    b.addEventListener("click",()=>{ mkNestInto(pid); });
    hrow.appendChild(b);
  };
  mkIn("."+mkSlot,null,false);
  const banned=new Set([mkFocus]);
  mkParts.forEach(q=>{ if(banned.has(q.cls))mkDescend(q.pid).forEach(j=>banned.add(mkParts[j].cls)); });
  const offered=new Set();
  mkParts.forEach(q=>{
    if(banned.has(q.cls)||offered.has(q.cls))return;
    offered.add(q.cls);
    mkIn("."+names[q.cls],q.pid,false);
  });
  host.appendChild(hrow);
  body.appendChild(host);

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
  btn("Copy","",()=>{ mkCopyPart(mkSel); });
  btn("Front","",()=>{ mkToFront(mkSel); renderComp(); });
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
    ?{id:mkId,slot:mkSlot,name:nm,kind:"parts",parts:mkParts.map(p=>({...p})),root:{...mkRoot}}
    :{id:mkId,slot:mkSlot,name:nm,px:mkStr(),sm:mkSm};
  if(at<0)list.push(piece); else list[at]=piece;
  /* wearing it is the point of making it */
  const r=robots[selRobot]||robots[0];
  if(r)r[mkSlot]=mkId;
  saveSoon();
  if(typeof feCheck==="function")feCheck();
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
