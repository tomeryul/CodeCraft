"use strict";
/* =====================================================================
   🧊 Tower Mode — the world has a THIRD axis
   ---------------------------------------------------------------------
   A flat challenge board asks "which tiles?". A tower asks "how high?",
   and that one extra number is what turns a route into an algorithm: you
   cannot reach the top of a stack you have not already built, so the
   order of the work becomes the puzzle.

   A level is a height map:
     terrain [x,y,h]  the ground the robot starts on
     plan    [x,y,h]  the blueprint — what each column must END UP at
     holes   [x,y]    pits: no floor, nothing can stand or be built there

   The robot carries unlimited bricks and can only reach ONE level above
   where it is standing, so a tall column has to be climbed as it grows.
   That single rule is the whole game.

   This file owns Tower Mode end to end: the level data, the height-aware
   VM, the isometric renderer, the camera, and the band of levels in the
   Projects sheet. challenges.js calls into it through four small seams
   (window.T3), all guarded, so with this file absent nothing changes.
   ===================================================================== */
(function(){
if(typeof window==="undefined")return;

const K=(x,y)=>x+"_"+y;
const D4=[[0,-1],[1,0],[0,1],[-1,0]];   // matches DX/DY: 0=N 1=E 2=S 3=W

/* ---------------- the built-in levels ----------------
   Each one exists to make exactly one block necessary for the first time:
   nothing here can be solved by the previous level's program. */
const TOWER_LEVELS=[
  {id:"t3_first", em:"🧊", name:"First Bricks", diff:1, coins:40, xp:25,
   gw:6, gh:4, maxBlocks:8, start:{x:1,y:2,dir:0},
   allowed:["move","turnL","turnR","build","repeat"],
   terrain:[], holes:[],
   plan:[[1,1,1],[2,1,1],[3,1,1]],
   desc:"Lay three bricks in a row. 🔨 Build puts a brick on the tile you FACE — so build, turn, move, turn back."},

  {id:"t3_stair", em:"🧊", name:"Staircase", diff:1, coins:60, xp:35,
   gw:6, gh:4, maxBlocks:14, start:{x:1,y:2,dir:0},
   allowed:["move","turnL","turnR","build","climb","repeat"],
   terrain:[], holes:[],
   plan:[[1,1,1],[2,1,2],[3,1,3]],
   desc:"1, then 2, then 3 high. You can only reach ONE above your feet — so climb the step you just built before you build the next."},

  {id:"t3_gap", em:"🧊", name:"Mind The Gap", diff:2, coins:70, xp:40,
   gw:7, gh:4, maxBlocks:16, start:{x:1,y:2,dir:0},
   allowed:["move","turnL","turnR","build","jump","climb","repeat"],
   terrain:[], holes:[[3,2]],
   plan:[[1,1,1],[2,1,1],[4,1,1],[5,1,1]],
   desc:"Four bricks, but the walkway has a hole in it. 🦘 Jump Gap lands you two tiles ahead — and only when that tile is level with your feet."},

  {id:"t3_pyr", em:"🧊", name:"The Pyramid", diff:3, coins:110, xp:60,
   gw:7, gh:5, maxBlocks:30, start:{x:0,y:2,dir:1},
   allowed:["move","turnL","turnR","build","climb","descend","dig","repeat","countLoop","whileLoop","if"],
   terrain:[], holes:[],
   plan:[[2,1,1],[3,1,1],[4,1,1],
         [2,2,1],[3,2,2],[4,2,1],
         [2,3,1],[3,3,1],[4,3,1]],
   desc:"A ring one high with a peak of two in the middle. Build the ring from the ground, then climb onto it to reach the top."}
];
window.TOWER_LEVELS=TOWER_LEVELS;

/* ---------------- reading a level ---------------- */
function inB(p,x,y){return x>=0&&y>=0&&x<p.gw&&y<p.gh;}
function isPit(rb,x,y){return rb.hole&&rb.hole.has(K(x,y));}
// the height of a column right now — undefined for a pit or off the board,
// which is exactly "nothing to stand on"
function hAt(rb,p,x,y){return (inB(p,x,y)&&!isPit(rb,x,y))?(rb.h[K(x,y)]||0):undefined;}
function want(rb,k){return rb.plan[k]!=null?rb.plan[k]:(rb.base[k]||0);}
// bricks still to lay / to take away — the two numbers the player is playing against
function tally(st){
  const rb=st.robot, p=st.proj;
  let low=0, high=0;
  for(let y=0;y<p.gh;y++)for(let x=0;x<p.gw;x++){
    const k=K(x,y); if(isPit(rb,x,y))continue;
    const d=(rb.h[k]||0)-want(rb,k);
    if(d<0)low-=d; else high+=d;
  }
  return {low,high};
}
function planTotal(rb,p){
  let n=0;
  for(let y=0;y<p.gh;y++)for(let x=0;x<p.gw;x++){
    const k=K(x,y); if(isPit(rb,x,y))continue;
    n+=Math.max(0,want(rb,k)-(rb.base[k]||0));
  }
  return n;
}

/* ---------------- the height map on the robot ----------------
   mgSeed calls this for a 3D project. `base` never changes (it is the
   land); `h` is what has actually been built and is what the robot walks
   on; `z` is the height of the column it is standing on. The editor
   clears exactly these three fields when leaving 3D. */
function seed(rb,p){
  rb.base={};rb.h={};rb.plan={};rb.hole=new Set();
  for(const c of (p.terrain||[]))rb.base[K(c[0],c[1])]=c[2];
  for(const c of (p.holes||[]))rb.hole.add(K(c[0],c[1]));
  for(const c of (p.plan||[]))rb.plan[K(c[0],c[1])]=c[2];
  for(let y=0;y<p.gh;y++)for(let x=0;x<p.gw;x++){
    const k=K(x,y);
    if(rb.hole.has(k))continue;
    rb.h[k]=rb.base[k]||0;
  }
  rb.z=rb.h[K(rb.x,rb.y)]||0;
}

/* ---------------- what the blocks mean up here ----------------
   Returns true when it has handled the block. Everything it does NOT
   claim — turns, variables, 💬 Say, ⏱️ Wait — falls through to the shared
   challenge VM, so loops, functions and memory work identically. */
function act(st,rb,b){
  const p=st.proj;
  const ax=rb.x+DX[rb.dir], ay=rb.y+DY[rb.dir], ka=K(ax,ay);
  const nope=()=>{sfx(180,.05);};
  const step=(x,y)=>{rb.x=x;rb.y=y;rb.z=rb.h[K(x,y)]||0;sfx(430,.03);};
  const za=hAt(rb,p,ax,ay);
  switch(b.t){
    // walk the flat, or step DOWN one — falling off a kerb needs no block
    case "move":
      if(za===undefined)return nope(),true;
      if(za-rb.z===0||za-rb.z===-1)step(ax,ay); else nope();
      return true;
    // 🪜 the whole point of the mode: up is never free
    case "climb":
      if(za===undefined)return nope(),true;
      if(za-rb.z===1)step(ax,ay); else nope();
      return true;
    // ⬇️ drop off a stack of any height in one action
    case "descend":
      if(za===undefined)return nope(),true;
      if(za<rb.z)step(ax,ay); else nope();
      return true;
    // 🦘 clear a pit: land two ahead, and only on ground level with you
    case "jump":{
      const jx=rb.x+DX[rb.dir]*2, jy=rb.y+DY[rb.dir]*2;
      const zj=hAt(rb,p,jx,jy);
      if(zj!==undefined&&zj===rb.z)step(jx,jy); else nope();
      return true;}
    // 🔨 a brick on the tile ahead. Reach is one above your feet, which is
    // what forces a tall column to be climbed as it grows.
    case "build":
      if(za===undefined)return nope(),true;
      if(za>rb.z)return nope(),true;
      rb.h[ka]=za+1;sfx(520,.04);
      return true;
    // ⛏️ take one back off — the only way to fix an over-build
    case "dig":{
      if(za===undefined)return nope(),true;
      const g=rb.base[ka]||0;
      if(za<=g)return nope(),true;
      rb.h[ka]=za-1;sfx(300,.05);
      return true;}
  }
  return false;
}

/* ---------------- sensors ----------------
   The flat board's sensors ask about tiles; a tower's ask about heights.
   `needBrick` is the one that makes "keep building until it's right" a
   loop the player can actually write. */
const T3_CONDS=["blocked","pitAhead","stepUp","needBrick","tooHigh","atPlan"];
const T3_LBL={blocked:"can't step ahead 🚧",pitAhead:"pit ahead 🕳️",
  stepUp:"a step up ahead 🪜",needBrick:"brick needed ahead 🧱",
  tooHigh:"too high ahead ⛏️",atPlan:"tile ahead is finished ✅"};
function cond(st,c){
  const rb=st.robot, p=st.proj;
  const ax=rb.x+DX[rb.dir], ay=rb.y+DY[rb.dir], ka=K(ax,ay);
  const za=hAt(rb,p,ax,ay);
  switch(c){
    case "blocked":  return !(za!==undefined&&Math.abs(za-rb.z)<=1);
    case "pitAhead": return inB(p,ax,ay)&&isPit(rb,ax,ay);
    case "stepUp":   return za!==undefined&&za-rb.z===1;
    case "needBrick":return za!==undefined&&za<want(rb,ka);
    case "tooHigh":  return za!==undefined&&za>want(rb,ka);
    case "atPlan":   return za!==undefined&&za===want(rb,ka);
  }
  return false;
}

/* ---------------- did they build it? ----------------
   EXACTLY the blueprint: too many bricks fails as surely as too few, or
   "fill everything" would solve every level. ⛏️ Dig is the way back. */
function check(st){
  const t=tally(st);
  if(!t.low&&!t.high)return {ok:true,msg:""};
  if(t.low&&t.high)return {ok:false,msg:"🧱 "+t.low+" brick"+(t.low>1?"s":"")+" missing and "+t.high+" too many — ⛏️ Dig takes the extra ones back off."};
  if(t.low)return {ok:false,msg:"🧱 "+t.low+" more brick"+(t.low>1?"s":"")+" to lay. Remember you can only build ONE above your feet."};
  return {ok:false,msg:"⛏️ "+t.high+" brick"+(t.high>1?"s":"")+" too many — Dig the extras back off."};
}

/* =====================================================================
   The camera
   ---------------------------------------------------------------------
   Yaw is a continuous angle eased toward a target that ⟲/⟳ move in
   quarter turns, so a tower can be inspected from any side. Everything
   projected below is recomputed per frame from `yaw` alone.
   ===================================================================== */
/* Yaw starts at ZERO, not at 45°: the isometric mapping below ((rx−ry), (rx+ry))
   is itself a 45° rotation, so a 45° yaw cancels it exactly and every cube
   collapses into a flat axis-aligned square. */
let yaw=0, yawT=0, raf=0;
function t3Loop(){
  raf=0;
  const d=yawT-yaw;
  if(Math.abs(d)>0.002){
    yaw+=d*0.18;
    raf=requestAnimationFrame(t3Loop);
  }else yaw=yawT;
  draw();
}
function t3Rotate(d){yawT+=d*Math.PI/2;if(!raf)raf=requestAnimationFrame(t3Loop);}
/* the camera, for anyone else who wants to show this scene — the level
   editor borrows the same loop and bar rather than growing its own. */
window.t3Cam={rot:t3Rotate, bar:on=>t3Bar(on),
  start(){if(!raf)raf=requestAnimationFrame(t3Loop);},
  stop(){if(raf){cancelAnimationFrame(raf);raf=0;}}};

// the ⟲ ⟳ strip. Lives above the board so it never covers the tower.
function t3Bar(on){
  let bar=document.getElementById("t3Bar");
  if(!bar){
    const cv=$("mgCanvas"); if(!cv||!cv.parentNode)return;
    bar=document.createElement("div");
    bar.id="t3Bar";
    bar.innerHTML='<button data-r="-1" title="Turn the view left">⟲</button>'+
      '<span class="t3hint">turn the view</span>'+
      '<button data-r="1" title="Turn the view right">⟳</button>';
    cv.parentNode.insertBefore(bar,cv);
    bar.querySelectorAll("[data-r]").forEach(b=>
      b.addEventListener("click",()=>{t3Rotate(+b.dataset.r);sfx(560,.03);}));
  }
  bar.style.display=on?"":"none";
}

/* =====================================================================
   The isometric renderer
   ---------------------------------------------------------------------
   Columns are drawn back to front. Side faces are back-face culled by
   the sign of their projected area, which is what lets the yaw be any
   angle rather than four fixed views.
   ===================================================================== */
const C_GRASS=["#6cb545","#63a83e","#74bd4d"];
const C_ROCK ="#a89b86", C_ROCK_T="#c3b7a2";
const C_BRICK="#e2913a", C_BRICK_T="#ffb347";
const C_PIT  ="#241d17";

function camOf(p,maxZ,W,H){
  const c=Math.cos(yaw), s=Math.sin(yaw);
  const cx=(p.gw-1)/2, cy=(p.gh-1)/2;
  const R=(x,y)=>{const ox=x-cx, oy=y-cy;return [ox*c-oy*s, ox*s+oy*c];};
  // fit: project the bounding box's eight corners at unit scale
  let m=[1e9,-1e9,1e9,-1e9];
  for(const gx of [-0.5,p.gw-0.5])for(const gy of [-0.5,p.gh-0.5])for(const gz of [0,maxZ+1]){
    const r=R(gx,gy);
    const X=(r[0]-r[1])*0.92, Y=(r[0]+r[1])*0.53-gz*0.66;
    m[0]=Math.min(m[0],X);m[1]=Math.max(m[1],X);
    m[2]=Math.min(m[2],Y);m[3]=Math.max(m[3],Y);
  }
  const k=Math.min(W*0.97/Math.max(.001,m[1]-m[0]), H*0.97/Math.max(.001,m[3]-m[2]));
  return {c,s,cx,cy,k,
    ox:W/2-(m[0]+m[1])/2*k,
    oy:H/2-(m[2]+m[3])/2*k};
}
function P(cam,x,y,z){
  const ox=x-cam.cx, oy=y-cam.cy;
  const rx=ox*cam.c-oy*cam.s, ry=ox*cam.s+oy*cam.c;
  return [cam.ox+(rx-ry)*0.92*cam.k, cam.oy+((rx+ry)*0.53-z*0.66)*cam.k, rx+ry];
}
function poly(g,pts,fill,stroke,lw){
  g.beginPath();
  g.moveTo(pts[0][0],pts[0][1]);
  for(let i=1;i<pts.length;i++)g.lineTo(pts[i][0],pts[i][1]);
  g.closePath();
  if(fill){g.fillStyle=fill;g.fill();}
  if(stroke){g.strokeStyle=stroke;g.lineWidth=lw||1;g.stroke();}
}
function area(pts){
  let a=0;
  for(let i=0;i<pts.length;i++){
    const q=pts[(i+1)%pts.length];
    a+=pts[i][0]*q[1]-q[0]*pts[i][1];
  }
  return a/2;
}
// one column: the four walls that face us, then the lid
function box(g,cam,x,y,z0,z1,side,top,dash){
  const c=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]];
  const lo=c.map(o=>P(cam,x+o[0],y+o[1],z0));
  const hi=c.map(o=>P(cam,x+o[0],y+o[1],z1));
  for(let i=0;i<4;i++){
    const j=(i+1)%4;
    const q=[lo[i],lo[j],hi[j],hi[i]];
    if(area(q)<=0)continue;                   // a wall pointing away from us
    if(dash){g.save();g.setLineDash([5,4]);poly(g,q,null,dash,1.4);g.restore();}
    else poly(g,q,i%2?side:shade(side,-14),"rgba(30,20,10,.30)",1);
  }
  if(dash){g.save();g.setLineDash([5,4]);poly(g,hi,null,dash,1.6);g.restore();}
  else poly(g,hi,top,"rgba(30,20,10,.34)",1);
}
function shade(hex,d){
  const n=parseInt(hex.slice(1),16);
  const f=v=>Math.max(0,Math.min(255,v+d));
  return "rgb("+f(n>>16&255)+","+f(n>>8&255)+","+f(n&255)+")";
}
function drawBot(g,cam,rb){
  const [X,Y]=P(cam,rb.x,rb.y,rb.z+1);
  const s=cam.k*0.46;
  box(g,cam,rb.x,rb.y,rb.z,rb.z+0.72,"#d99a2b","#ffcd6e");
  // the face is billboarded: it must read from every angle the yaw allows
  g.fillStyle="#2b1c40";
  g.beginPath();g.arc(X-s*.20,Y+s*.16,s*.115,0,7);g.fill();
  g.beginPath();g.arc(X+s*.20,Y+s*.16,s*.115,0,7);g.fill();
  g.strokeStyle="#d99a2b";g.lineWidth=Math.max(1.4,s*.09);
  g.beginPath();g.moveTo(X,Y-s*.24);g.lineTo(X,Y-s*.52);g.stroke();
  g.fillStyle="#ffe58a";g.beginPath();g.arc(X,Y-s*.58,s*.11,0,7);g.fill();
  /* An arrow ON THE LID, drawn in world space so it turns with the camera:
     "which way am I facing" is the one thing the player must read off this
     board every single step, and a screen-space marker would lie the moment
     the view is rotated. */
  const d=D4[rb.dir|0], px=-d[1], py=d[0], lz=rb.z+0.74;
  const tip=P(cam,rb.x+d[0]*0.40,rb.y+d[1]*0.40,lz);
  const tail=P(cam,rb.x-d[0]*0.16,rb.y-d[1]*0.16,lz);
  const bl=P(cam,rb.x+d[0]*0.14+px*0.20,rb.y+d[1]*0.14+py*0.20,lz);
  const br=P(cam,rb.x+d[0]*0.14-px*0.20,rb.y+d[1]*0.14-py*0.20,lz);
  g.strokeStyle="rgba(70,40,5,.85)";g.lineWidth=Math.max(1.6,s*.085);
  g.lineCap="round";g.lineJoin="round";
  g.beginPath();
  g.moveTo(tail[0],tail[1]);g.lineTo(tip[0],tip[1]);
  g.moveTo(bl[0],bl[1]);g.lineTo(tip[0],tip[1]);g.lineTo(br[0],br[1]);
  g.stroke();
}
function draw(){
  if(typeof mgState==="undefined"||!mgState||!mgState.proj.mode3d)return;
  const cv=$("mgCanvas"); if(!cv)return;
  if($("boardTab").style.display==="none")return;
  const p=mgState.proj, rb=mgState.robot;
  if(!rb||!rb.h)return;
  let maxZ0=1;
  for(const k in rb.h)maxZ0=Math.max(maxZ0,rb.h[k]);
  for(const k in rb.plan)maxZ0=Math.max(maxZ0,rb.plan[k]);
  // a tall tower needs a taller frame, or fitting its height squashes the footprint
  const W=Math.max(200,cv.clientWidth||320);
  const H=Math.round(W*Math.min(0.95,0.50+maxZ0*0.085));
  const dpr=(typeof DPR!=="undefined"?DPR:Math.min(3,window.devicePixelRatio||1));
  cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);cv.style.height=H+"px";
  const g=cv.getContext("2d");
  g.setTransform(dpr,0,0,dpr,0,0);
  g.clearRect(0,0,W,H);

  const cam=camOf(p,maxZ0,W,H);

  // back to front: nearer columns must paint over the ones behind them
  const cells=[];
  for(let y=0;y<p.gh;y++)for(let x=0;x<p.gw;x++)
    cells.push({x,y,d:P(cam,x,y,0)[2]});
  cells.sort((a,b)=>a.d-b.d);

  for(const c of cells){
    const k=K(c.x,c.y);
    if(rb.hole.has(k)){
      // a pit is drawn as a sunken lid so it reads as absence, not as a black tile
      const pts=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].map(o=>P(cam,c.x+o[0],c.y+o[1],-0.55));
      poly(g,pts,C_PIT,"rgba(0,0,0,.5)",1);
      box(g,cam,c.x,c.y,-0.55,0,"#1b1610","#241d17");
      continue;
    }
    const ground=rb.base[k]||0, h=rb.h[k]||0, tgt=want(rb,k);
    // the land
    box(g,cam,c.x,c.y,-0.35,Math.max(0,ground),
      ground>0?C_ROCK:C_GRASS[(c.x*31+c.y*17)%3],
      ground>0?C_ROCK_T:C_GRASS[(c.x*7+c.y*13)%3]);
    // bricks laid on top of it
    if(h>ground)box(g,cam,c.x,c.y,ground,h,C_BRICK,C_BRICK_T);
    // and what is still owed, as a dashed ghost
    if(tgt>h)box(g,cam,c.x,c.y,h,tgt,null,null,"rgba(255,240,190,.85)");
    if(h>tgt)box(g,cam,c.x,c.y,tgt,h,null,null,"rgba(255,110,130,.95)");
    if(rb.x===c.x&&rb.y===c.y)drawBot(g,cam,rb);
  }

  // one line of state: how much is left, so progress is visible mid-run
  const t=tally(mgState), total=planTotal(rb,p);
  const done=Math.max(0,total-t.low);
  g.font="800 13px system-ui,-apple-system,sans-serif";
  g.textAlign="left";g.textBaseline="top";
  g.fillStyle="rgba(20,14,34,.55)";
  const label="🧱 "+done+"/"+total+(t.high?"  ⛏️ "+t.high+" too many":"");
  const wpx=g.measureText(label).width+16;
  g.beginPath();g.roundRect?g.roundRect(8,8,wpx,24,9):g.rect(8,8,wpx,24);g.fill();
  g.fillStyle=t.high?"#ffb0bd":(t.low?"#ffd66b":"#8ff0ab");
  g.fillText(label,16,13);
}

/* ---------------- entering a Tower level ----------------
   Deliberately routed through the normal mgEnter: the program editor,
   block budget, ▶/⏹, undo and the save of the player's program are all
   the same machinery. Only the board is different. */
function t3Enter(level){
  const lv=JSON.parse(JSON.stringify(level));
  lv.mode3d=true;
  lv.em=lv.em||"🧊";
  lv.id=lv.id||("t3_"+Date.now());
  lv.allowed=(lv.allowed&&lv.allowed.length)?lv.allowed:["move","turnL","turnR","build","climb","repeat"];
  lv.cells=(lv.plan||[]).map(c=>[c[0],c[1]]);   // the 2D "has content" guards
  lv.initial=[];lv.tiles=[];lv.cases=[];
  mgEnter(lv);
  if(mgState){mgState.t3view="3d";t3Bar(true);t3Cam.start();}
}
window.t3Enter=t3Enter;
window.t3Rotate=t3Rotate;
window.t3Bar=t3Bar;

/* ---------------- the blocks Tower Mode adds ----------------
   Registered here rather than in blocks.js: they are meaningless on a
   flat board, and a challenge only offers what its `allowed` list names. */
DEFS.climb  ={cat:"basic",ic:"🪜",lbl:"Climb Up"};
DEFS.descend={cat:"basic",ic:"⬇️",lbl:"Climb Down"};
DEFS.jump   ={cat:"basic",ic:"🦘",lbl:"Jump Gap"};
DEFS.dig    ={cat:"basic",ic:"⛏️",lbl:"Dig"};
for(const k in T3_LBL)COND_LBL[k]=T3_LBL[k];

/* ---------------- the Tower band in Projects ---------------- */
function towerBand(){
  const el=$("projList"); if(!el)return;
  const h=document.createElement("h4");
  h.className="qsec";h.textContent="🧊 Tower Mode — build upwards";
  el.appendChild(h);
  const sec=document.createElement("div");sec.className="t3sec";
  const grid=document.createElement("div");grid.className="t3grid";
  sec.appendChild(grid);el.appendChild(sec);
  for(const lv of TOWER_LEVELS){
    const done=!!player.projects[lv.id];
    const c=document.createElement("button");
    c.className="t3card"+(done?" done":"");
    c.innerHTML='<span class="t3badge">'+(done?"✅":"🧊")+'</span>'+
      '<span class="t3name">'+esc(lv.name)+'</span>'+
      '<span class="t3meta">'+"⭐".repeat(lv.diff||1)+' · 🧩 '+lv.maxBlocks+
      ' · ⛰ '+lv.plan.reduce((m,q)=>Math.max(m,q[2]),0)+'</span>';
    c.onclick=()=>{$("projects").classList.remove("open");t3Enter(lv);};
    grid.appendChild(c);
  }
}
const _renderProjects=window.renderProjects;
window.renderProjects=function(){_renderProjects();towerBand();};

/* ---------------- the seams challenges.js calls ---------------- */
window.T3={seed,act,cond,check,draw,tally,
  conds:()=>T3_CONDS.slice(),
  levels:TOWER_LEVELS};
})();
