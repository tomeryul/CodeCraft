"use strict";
/* ---------------- camera & input ---------------- */
const canvas=$("game"), ctx=canvas.getContext("2d");
let cam={x:0,y:0,scale:1}, follow=true, DPR=1, VW=innerWidth, VH=innerHeight;
// CSS sizes #game to the LARGE viewport (full physical screen, edge to edge,
// incl. the iOS home-indicator area). We keep the drawing BUFFER exactly matched
// to the element's real rendered size — measured with getBoundingClientRect — so
// the canvas always fully paints the element and its background never shows
// through as a band. A ResizeObserver re-syncs the buffer whenever the element's
// box changes (e.g. when 100lvh / safe-area insets settle a frame after load),
// which is what left a blue strip at the bottom before.
function resize(){
  DPR=Math.min(3,window.devicePixelRatio||1);
  const r=canvas.getBoundingClientRect();
  VW=Math.round(r.width)||innerWidth; VH=Math.round(r.height)||innerHeight;
  canvas.width=Math.round(VW*DPR);canvas.height=Math.round(VH*DPR);
}
addEventListener("resize",resize);
addEventListener("orientationchange",()=>setTimeout(resize,150));
addEventListener("load",resize);
if(window.visualViewport)visualViewport.addEventListener("resize",resize);
if(window.ResizeObserver)new ResizeObserver(resize).observe(canvas);
resize();

const pointers=new Map();
let pinchD=0, panMoved=false;
canvas.addEventListener("pointerdown",e=>{
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  panMoved=false;
  if(pointers.size===2){
    const p=[...pointers.values()];
    pinchD=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);
  }
});
canvas.addEventListener("pointermove",e=>{
  const p=pointers.get(e.pointerId);if(!p)return;
  if(pointers.size===1){
    const dx=e.clientX-p.x, dy=e.clientY-p.y;
    if(Math.abs(dx)+Math.abs(dy)>4)panMoved=true;
    if(panMoved){cam.x-=dx/cam.scale;cam.y-=dy/cam.scale;follow=false;}
  }
  p.x=e.clientX;p.y=e.clientY;
  if(pointers.size===2){
    const q=[...pointers.values()];
    const d=Math.hypot(q[0].x-q[1].x,q[0].y-q[1].y);
    if(pinchD>0){cam.scale=clamp(cam.scale*(d/pinchD),.4,2.2);follow=false;panMoved=true;}
    pinchD=d;
  }
});
function endPointer(e){
  if(pointers.size===1&&!panMoved)handleTap(e.clientX,e.clientY);
  pointers.delete(e.pointerId);pinchD=0;
}
canvas.addEventListener("pointerup",endPointer);
canvas.addEventListener("pointercancel",e=>pointers.delete(e.pointerId));
canvas.addEventListener("wheel",e=>{cam.scale=clamp(cam.scale*(e.deltaY<0?1.1:0.9),.4,2.2);follow=false;e.preventDefault();},{passive:false});
const PLAYER_BUILT={proj:1,chest:1,bridge:1}; // things the player made and may move/remove
function handleTap(sx,sy){
  const wx=(sx-VW/2)/cam.scale+cam.x, wy=(sy-VH/2)/cam.scale+cam.y;
  const tx=Math.floor(wx/TILE), ty=Math.floor(wy/TILE);
  if(!inB(tx,ty)){closeObjMenu();return;}
  // relocating a build: second tap drops it on an empty walkable tile
  if(movingObj){
    const nk=key(tx,ty), no=objects.get(nk);
    if(!no && ((movingObj.o.type==="bridge")?terrain[nk]===T_WATER:(terrain[nk]!==T_WATER))){
      objects.delete(movingObj.k);objects.set(nk,movingObj.o);
      burst(tx,ty,"sparkle");toast("🚚 Moved!");sfx(600,.06);saveSoon();
      movingObj=null;return;
    }
    toast(movingObj.o.type==="bridge"?"🌉 Bridges go on water.":"🚫 Pick an empty spot on land.");
    return;
  }
  const ri=robots.findIndex(r=>Math.round(r.rx)===tx&&Math.round(r.ry)===ty);
  if(ri>=0){selRobot=ri;selBlock=null;elseSel=null;follow=true;updateChips();updateHud();updateFab();renderProgram();renderPy();toast("🤖 Selected "+robots[ri].name);sfx(500,.05);return;}
  const o=objects.get(key(tx,ty));
  if(o&&PLAYER_BUILT[o.type]){openObjMenu(key(tx,ty),o);return;}
  const names={tree:"🌳 Tree — chop it for wood!",rock:"🪨 Rock — mine it for stone!",iron:"⛓️ Iron ore — mine it, worth 6🪙!",crystal:"💎 Crystal — mine it, worth 15🪙!",home:"🏠 Home base",market:"🏪 Market — sell resources here!",flower:"🌼 Just a pretty flower",item:"📦 Dropped items — a robot can collect these!",gift:"🎁 Treasure! Send a robot to collect it!"};
  if(o){
    if(o.type==="tree"&&o.stage<2)toast("🌱 A young tree… it's still growing!");
    else toast(names[o.type]||o.type);
  }else if(terrain[key(tx,ty)]===T_WATER)toast("🌊 Water — face it and 🪣 Scoop for water 💧, or 🔨 Build a bridge (2🪨) to cross!");
}
let movingObj=null;
function closeObjMenu(){const m=$("objMenu");if(m)m.classList.remove("open");}
function openObjMenu(k,o){
  const m=$("objMenu");
  const label={proj:"🏗️ "+((o.em||"")+" build"),chest:"📦 Chest",bridge:"🌉 Bridge"}[o.type]||"Build";
  m.querySelector(".om-title").textContent=label+" — what to do?";
  m.dataset.k=k;m.classList.add("open");sfx(500,.04);
}
$("objMove").addEventListener("click",()=>{
  const k=+$("objMenu").dataset.k, o=objects.get(k);
  if(o){movingObj={k,o};toast("🚚 Tap an empty spot to move it there.");}
  closeObjMenu();
});
$("objDelete").addEventListener("click",()=>{
  const k=+$("objMenu").dataset.k, o=objects.get(k);
  if(o){objects.delete(k);burst(k%W,(k/W)|0,"stone");toast("🗑 Removed.");sfx(300,.06);saveSoon();}
  closeObjMenu();
});
$("objCancel").addEventListener("click",closeObjMenu);
