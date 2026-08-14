"use strict";
/* =====================================================================
   CodeCraft — Tower Mode (3D builds)                    drop-in module
   ---------------------------------------------------------------------
   A third kind of challenge: the board has HEIGHT. The robot stacks
   bricks on the tile ahead, climbs onto them, and rebuilds a blueprint
   in three dimensions.

   The file is two halves that never touch each other's globals:

     T3.*   a pure renderer + rules engine. Knows nothing about the game;
            takes a plain scene object and a 2D context. Previewable and
            testable on its own.
     glue   monkey-patches mgDraw / mgTick / mgCheck / mgSeed / mgCond /
            mgCondList / renderProjects so 3D levels ride the EXISTING
            challenge machinery. No edits to challenges.js required.

   Load order: after js/game/challenges.js, before boot.
   ===================================================================== */

/* ============================ 1. renderer ============================ */
(function(){
const T3={};

/* ---- palette ----
   Taken from the board, not invented: bricks ride drawBoardBrick's ramp
   (render.js) and the robot is ROBOT_COLORS[0], the same colour the 2D
   challenge board hands drawBoardRobot. Read at runtime where the game's
   files are present; the literals are the standalone-preview fallback. */
const SKY0="#cfeaff", SKY1="#eaf7ff";
const GRASS=["#79c34e","#71ba47","#7fc957"];
// top-face colours; the face shading below walks them down to the ramp's
// dark end (#b9793c on plan, #e23b57 off it) all by itself
const BRICK="#e6bd7d", BRICK_OK="#e6bd7d", BRICK_BAD="#ff8fa0";
const PLAN="#ffb347";
var BOT=(typeof ROBOT_COLORS!=="undefined"?ROBOT_COLORS[0]:"#ffb830");
var BOT_LT=(typeof window!=="undefined"&&window.CC_EXTRAS?CC_EXTRAS.lighten(BOT,.3):"#ffcd6e");

// world-fixed light: faces keep their identity while the camera spins
const FACE={top:1, N:.88, W:.78, E:.60, S:.50};
const shade=(hex,m)=>{
  const n=parseInt(hex.slice(1),16);
  const r=Math.min(255,Math.round((n>>16&255)*m)), g=Math.min(255,Math.round((n>>8&255)*m)), b=Math.min(255,Math.round((n&255)*m));
  return "rgb("+r+","+g+","+b+")";
};
const K=(x,y)=>x+"_"+y;
T3.K=K;

/* ---- projection ----------------------------------------------------
   Real perspective, not isometric: a pinhole camera pitched down over
   the board. Scale is solved once against ALL FOUR yaw steps so the
   build never breathes or clips while the camera rotates.            */
function makeProj(sc,W,H,yaw){
  const pitch=0.60, cx=sc.gw/2, cy=sc.gh/2;
  const maxZ=(sc.maxZ||3)+1;
  const CAMD=Math.max(sc.gw,sc.gh)*0.95+4.5;
  const raw=(x,y,z,yw)=>{
    const c=Math.cos(yw), s=Math.sin(yw), cp=Math.cos(pitch), sp=Math.sin(pitch);
    const rx=(x-cx)*c-(y-cy)*s, ry=(x-cx)*s+(y-cy)*c;
    const yc=ry*cp-z*sp, zc=ry*sp+z*cp;
    const d=yc+CAMD, f=1/Math.max(.6,d);
    return {x:rx*f, y:-zc*f, d:d};
  };
  let mnx=1e9,mxx=-1e9,mny=1e9,mxy=-1e9;
  for(let q=0;q<4;q++){const yw=q*Math.PI/2;
    for(const X of [0,sc.gw])for(const Y of [0,sc.gh])for(const Z of [0,maxZ]){
      const p=raw(X,Y,Z,yw);
      if(p.x<mnx)mnx=p.x; if(p.x>mxx)mxx=p.x; if(p.y<mny)mny=p.y; if(p.y>mxy)mxy=p.y;
    }}
  const S=Math.min(W*.90/(mxx-mnx), H*.88/(mxy-mny));
  const mid=raw(cx,cy,maxZ*.45,yaw);
  const ox=W/2-mid.x*S, oy=H/2-mid.y*S;
  const f=(x,y,z)=>{const p=raw(x,y,z,yaw);return {x:ox+p.x*S,y:oy+p.y*S,d:p.d};};
  f.zcos=Math.cos(pitch);
  return f;
}
T3.makeProj=makeProj;

// px per tile at a given world point — the only honest way to size a detail
// (stud, shadow, the robot) under perspective.
// Measured along the HEIGHT axis, not along X: a horizontal axis foreshortens
// as the camera swings onto it (a unit of X collapses to ~56% of its length at
// yaw 90°, which was shrinking the robot whenever you looked down the board),
// while the vertical never does. Divide back out by cos(pitch) to get the
// unforeshortened tile width.
function unit(P,x,y,z){
  const a=P(x,y,z), b=P(x,y,z+1);
  return Math.hypot(b.x-a.x,b.y-a.y)/(P.zcos||1);
}

function poly(g,pts,fill,stroke,lw){
  g.beginPath();g.moveTo(pts[0].x,pts[0].y);
  for(let i=1;i<pts.length;i++)g.lineTo(pts[i].x,pts[i].y);
  g.closePath();
  if(fill){g.fillStyle=fill;g.fill();}
  if(stroke){g.strokeStyle=stroke;g.lineWidth=lw||1;g.lineJoin="round";g.stroke();}
}

/* one brick. Sides are drawn back-to-front then the top lid, so the
   cube is always correct without per-face culling maths. */
function cube(g,P,x,y,z,col,opt){
  opt=opt||{};
  const p=(dx,dy,dz)=>P(x+dx,y+dy,z+dz);
  const t=[p(0,0,1),p(1,0,1),p(1,1,1),p(0,1,1)];
  const b=[p(0,0,0),p(1,0,0),p(1,1,0),p(0,1,0)];
  const sides=[
    {q:[b[0],b[1],t[1],t[0]],k:"N"},
    {q:[b[1],b[2],t[2],t[1]],k:"E"},
    {q:[b[2],b[3],t[3],t[2]],k:"S"},
    {q:[b[3],b[0],t[0],t[3]],k:"W"}
  ];
  sides.sort((a,c)=>((c.q[0].d+c.q[1].d)-(a.q[0].d+a.q[1].d)));
  const line="rgba(90,58,20,.34)";
  for(const s of sides)poly(g,s.q,shade(col,FACE[s.k]),opt.line||line,1);
  poly(g,t,shade(col,FACE.top),opt.line||line,1);
  // stud — the one detail that says "toy brick" from any angle
  if(opt.stud!==false){
    const c0=P(x+.5,y+.5,z+1), r=Math.max(1.5,unit(P,x+.5,y+.5,z+1)*.17);
    g.beginPath();g.ellipse(c0.x,c0.y,r,r*.55,0,0,7);
    g.fillStyle=shade(col,1.14);g.fill();
    g.strokeStyle="rgba(90,58,20,.22)";g.lineWidth=1;g.stroke();
  }
}

/* the blueprint: a dashed amber ghost of everything still missing */
function ghost(g,P,x,y,z,t){
  const p=(dx,dy,dz)=>P(x+dx,y+dy,z+dz);
  const t4=[p(0,0,1),p(1,0,1),p(1,1,1),p(0,1,1)];
  const b4=[p(0,0,0),p(1,0,0),p(1,1,0),p(0,1,0)];
  poly(g,t4,"rgba(255,214,140,.30)",null);
  g.setLineDash([5,4]);g.lineDashOffset=-t/70;
  g.strokeStyle="rgba(233,140,32,.95)";g.lineWidth=1.5;
  poly(g,t4,null,"rgba(233,140,32,.95)",1.5);
  poly(g,b4,null,"rgba(233,140,32,.5)",1.2);
  for(let i=0;i<4;i++){g.beginPath();g.moveTo(b4[i].x,b4[i].y);g.lineTo(t4[i].x,t4[i].y);g.stroke();}
  g.setLineDash([]);g.lineDashOffset=0;
}

/* ---- the robot ------------------------------------------------------
   NOT a block-bot. This is the game's own board robot (drawBoardRobot in
   render.js) drawn as a billboard: same rounded-square toy body, same
   bevel gradient, same white eyes / dark pupils / smile, same gold-tipped
   antenna. Geometry is copied at its authored scale (S=36) and scaled to
   whatever the perspective says a tile is worth here, so the character
   reads identically to the rest of the game while the world around it is
   genuinely 3D.

   The one thing that has to be re-derived is which way "forward" points:
   on the flat board it is DX/DY, here it is the direction one tile ahead
   projects to on screen — so the pupils keep tracking the facing through
   every camera rotation.                                              */
function rr(g,x,y,w,h,r){
  g.beginPath();
  g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);
  g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();
}
function robot(g,P,r,t){
  const x=r.x+.5, y=r.y+.5, z=r.z;
  const tile=unit(P,x,y,z);
  const foot=P(x,y,z);

  // facing, in screen space: one tile ahead, projected
  const fx=x+DXX[r.dir|0], fy=y+DYY[r.dir|0];
  const fp=P(fx,fy,z);
  let dx=fp.x-foot.x, dy=fp.y-foot.y;
  const m=Math.hypot(dx,dy)||1; dx/=m; dy/=m;

  // ground chevron — the facing stays unambiguous at any yaw
  (function(){
    const o=.16, w=.13;
    const a=P(x+DXX[r.dir]*(o+w)-DYY[r.dir]*w, y+DYY[r.dir]*(o+w)+DXX[r.dir]*w, z+.02);
    const b=P(x+DXX[r.dir]*(o+w*2.1), y+DYY[r.dir]*(o+w*2.1), z+.02);
    const c=P(x+DXX[r.dir]*(o+w)+DYY[r.dir]*w, y+DYY[r.dir]*(o+w)-DXX[r.dir]*w, z+.02);
    g.strokeStyle="rgba(36,27,69,.30)";g.lineWidth=Math.max(1.4,tile*.05);
    g.lineJoin="round";g.lineCap="round";
    g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.lineTo(c.x,c.y);g.stroke();
  })();

  const S=36, k=tile*0.72/S;                 // authored at S=36, scaled to the tile
  const bob=Math.sin(t/420)*1.4;
  g.save();
  g.translate(foot.x, foot.y-S*0.42*k);
  g.scale(k,k);

  g.fillStyle="rgba(0,0,0,.22)";
  g.beginPath();g.ellipse(0,S*.42,S*.42,S*.16,0,0,7);g.fill();
  g.translate(0,bob);

  // body — toy bevel, exactly the game's. The colour follows the live robot
  // (players recolour theirs), falling back to the board default.
  const col=r.color||BOT;
  const colLt=(typeof window!=="undefined"&&window.CC_EXTRAS)?CC_EXTRAS.lighten(col,.3):BOT_LT;
  const grd=g.createLinearGradient(0,-S/2,0,S/2);
  grd.addColorStop(0,colLt);grd.addColorStop(1,col);
  g.fillStyle=grd;rr(g,-S/2,-S/2,S,S,11);g.fill();
  g.save();rr(g,-S/2,-S/2,S,S,11);g.clip();
  g.fillStyle="rgba(0,0,0,.25)";g.fillRect(-S/2,S/2-6,S,6);
  g.fillStyle="rgba(255,255,255,.35)";rr(g,-S/2+4,-S/2+3,S-8,4.5,2.5);g.fill();
  g.restore();

  // antenna + gold status light
  g.strokeStyle="#8a6210";g.lineWidth=2.5;g.lineCap="round";
  g.beginPath();g.moveTo(0,-S/2);g.lineTo(0,-S/2-7);g.stroke();
  g.fillStyle="#ffd66b";
  g.beginPath();g.arc(0,-S/2-9,3.5,0,7);g.fill();

  // eyes track the facing; the odd slow blink
  const ex=dx*2.5, ey=dy*2.5;
  const shut=(t%3400)<110;
  g.fillStyle="#fff";
  g.beginPath();g.arc(-6.5,-3,5,0,7);g.moveTo(11.5,-3);g.arc(6.5,-3,5,0,7);g.fill();
  if(shut){
    g.strokeStyle="#241b45";g.lineWidth=2;
    g.beginPath();g.moveTo(-9,-2.5);g.lineTo(-4,-2.5);g.moveTo(4,-2.5);g.lineTo(9,-2.5);g.stroke();
  }else{
    g.fillStyle="#241b45";
    g.beginPath();g.arc(-6.5+ex,-2.5+ey,2.5,0,7);g.moveTo(9+ex,-2.5+ey);g.arc(6.5+ex,-2.5+ey,2.5,0,7);g.fill();
  }
  g.strokeStyle="#1c1638";g.lineWidth=2;
  g.beginPath();g.arc(ex*.5,4+ey*.5,5,.2*Math.PI,.8*Math.PI);g.stroke();
  g.restore();
}

/* ---- the frame -----------------------------------------------------
   scene = {gw,gh,h:{},base:{},plan:{},robot:{x,y,dir,z},maxZ}
   h[k]    absolute height of every tile (terrain + placed bricks)
   base[k] terrain height, so placed bricks are h-base
   plan[k] the blueprint's target height for that tile               */
T3.render=function(g,W,H,sc,cam){
  const t=cam&&cam.t!=null?cam.t:(typeof performance!=="undefined"?performance.now():Date.now());
  const yaw=(cam&&cam.yaw)||0;
  const at=(m,x,y)=>{const v=m[K(x,y)];return v==null?0:v;};
  let maxZ=1;
  for(const k in sc.h)maxZ=Math.max(maxZ,sc.h[k]);
  for(const k in (sc.plan||{}))maxZ=Math.max(maxZ,sc.plan[k]);
  const P=makeProj({gw:sc.gw,gh:sc.gh,maxZ:maxZ},W,H,yaw);

  // sky
  const sky=g.createLinearGradient(0,0,0,H);
  sky.addColorStop(0,SKY0);sky.addColorStop(1,SKY1);
  g.fillStyle=sky;g.fillRect(0,0,W,H);

  /* --- ground plate: every tile at its terrain height, back to front.
     Drawing the terrain as its own low slab (rather than as cubes)
     keeps flat boards flat and cheap. */
  const tiles=[];
  for(let y=0;y<sc.gh;y++)for(let x=0;x<sc.gw;x++){
    const bz=at(sc.base,x,y);
    tiles.push({x:x,y:y,z:bz,d:P(x+.5,y+.5,bz).d});
  }
  tiles.sort((a,b)=>b.d-a.d);
  for(const tl of tiles){
    if(tl.z<0)continue;                      // a hole: nothing to stand on
    if(tl.z>0){                              // raised terrain reads as a rock plinth
      for(let z=0;z<tl.z;z++)cube(g,P,tl.x,tl.y,z,"#a89b86",{stud:false,line:"rgba(60,50,40,.35)"});
    }else{
      const q=[P(tl.x,tl.y,0),P(tl.x+1,tl.y,0),P(tl.x+1,tl.y+1,0),P(tl.x,tl.y+1,0)];
      poly(g,q,GRASS[(tl.x*31+tl.y*17)%3],"rgba(40,90,30,.16)",1);
    }
  }
  // holes — a real sunken pit: floor, then the far walls painted over the near
  // ones (a concave shape is the reverse sort of a convex one)
  for(let y=0;y<sc.gh;y++)for(let x=0;x<sc.gw;x++){
    if(at(sc.base,x,y)>=0)continue;
    const D=1.1;
    const f4=[P(x,y,-D),P(x+1,y,-D),P(x+1,y+1,-D),P(x,y+1,-D)];
    const r4=[P(x,y,0),P(x+1,y,0),P(x+1,y+1,0),P(x,y+1,0)];
    poly(g,r4,"#2f261e",null);
    g.save();
    g.beginPath();g.moveTo(r4[0].x,r4[0].y);for(let i=1;i<4;i++)g.lineTo(r4[i].x,r4[i].y);g.closePath();g.clip();
    poly(g,f4,"#3a2f26",null);
    const wall=[[0,1,"#5a4a3a"],[1,2,"#4a3d30"],[2,3,"#5f4f3e"],[3,0,"#453829"]]
      .map(w=>({q:[r4[w[0]],r4[w[1]],f4[w[1]],f4[w[0]]],c:w[2]}));
    wall.sort((a,b)=>(a.q[0].d+a.q[1].d)-(b.q[0].d+b.q[1].d));
    for(const w of wall)poly(g,w.q,w.c,null);
    g.restore();
    poly(g,r4,null,"rgba(30,22,14,.55)",1.6);
  }

  /* --- everything with height, in one depth-sorted pass so bricks,
     ghosts and the robot interleave correctly. */
  const items=[];
  for(let y=0;y<sc.gh;y++)for(let x=0;x<sc.gw;x++){
    const b=at(sc.base,x,y), h=at(sc.h,x,y), want=(sc.plan&&sc.plan[K(x,y)]);
    for(let z=Math.max(0,b);z<h;z++){
      const over=want!=null?(z>=want):(sc.plan?true:false);
      items.push({t:"b",x:x,y:y,z:z,bad:!!(sc.plan&&over),d:P(x+.5,y+.5,z+.5).d});
    }
    if(want!=null)for(let z=Math.max(0,h);z<want;z++)
      items.push({t:"g",x:x,y:y,z:z,d:P(x+.5,y+.5,z+.5).d});
  }
  if(sc.robot)items.push({t:"r",d:P(sc.robot.x+.5,sc.robot.y+.5,sc.robot.z+.5).d});
  items.sort((a,b)=>b.d-a.d);
  for(const it of items){
    if(it.t==="b")cube(g,P,it.x,it.y,it.z,it.bad?BRICK_BAD:(sc.plan?BRICK_OK:BRICK));
    else if(it.t==="g")ghost(g,P,it.x,it.y,it.z,t);
    else robot(g,P,sc.robot,t);
  }
};

/* ---- rules ---------------------------------------------------------
   One place decides what the robot may do, so the interpreter, the
   sensors and the level checker can never drift apart.              */
const DXX=[0,1,0,-1], DYY=[-1,0,1,0];
T3.ahead=(sc,n)=>({x:sc.robot.x+DXX[sc.robot.dir]*(n||1), y:sc.robot.y+DYY[sc.robot.dir]*(n||1)});
T3.inB=(sc,x,y)=>x>=0&&y>=0&&x<sc.gw&&y<sc.gh;
T3.hAt=(sc,x,y)=>{const v=sc.h[K(x,y)];return v==null?0:v;};
T3.bAt=(sc,x,y)=>{const v=sc.base[K(x,y)];return v==null?0:v;};

// every action returns true when it happened — the caller plays the sound
T3.act=function(sc,type){
  const r=sc.robot, a=T3.ahead(sc,1), a2=T3.ahead(sc,2), z=r.z;
  const H=(p)=>T3.hAt(sc,p.x,p.y), ok=(p)=>T3.inB(sc,p.x,p.y);
  switch(type){
    case "move":    if(ok(a)&&H(a)===z&&H(a)>=0){r.x=a.x;r.y=a.y;return true;} return false;
    // climb: exactly one brick up — the whole point of stacking a stair
    case "climb":   if(ok(a)&&H(a)===z+1){r.x=a.x;r.y=a.y;r.z=z+1;return true;} return false;
    case "descend": if(ok(a)&&H(a)===z-1&&H(a)>=0){r.x=a.x;r.y=a.y;r.z=z-1;return true;} return false;
    // jump: clear ONE low tile and land level on the far side
    case "jump":    if(ok(a2)&&H(a)<z&&H(a2)===z){r.x=a2.x;r.y=a2.y;return true;} return false;
    // build: onto the tile ahead, never higher than the robot's own
    // shoulder — which is what forces build→climb→build ladders
    case "build":   if(ok(a)&&H(a)<z+1&&H(a)>=Math.max(0,T3.bAt(sc,a.x,a.y))){
                      sc.h[K(a.x,a.y)]=Math.max(0,H(a))+1;return true;} return false;
    case "dig":     if(ok(a)&&H(a)>T3.bAt(sc,a.x,a.y)&&H(a)<=z+1){sc.h[K(a.x,a.y)]=H(a)-1;return true;} return false;
  }
  return null; // not a 3D action — the caller falls through to the 2D rules
};

T3.sense=function(sc,c){
  const r=sc.robot, a=T3.ahead(sc,1), a2=T3.ahead(sc,2);
  const H=(p)=>T3.hAt(sc,p.x,p.y), ok=(p)=>T3.inB(sc,p.x,p.y);
  switch(c){
    case "blocked":    return !(ok(a)&&H(a)===r.z&&H(a)>=0);
    case "canClimb":   return ok(a)&&H(a)===r.z+1;
    case "stepDown":   return ok(a)&&H(a)===r.z-1&&H(a)>=0;
    case "gapAhead":   return ok(a)&&H(a)<r.z;
    case "canJump":    return ok(a2)&&H(a)<r.z&&H(a2)===r.z;
    case "planDone":   return T3.done(sc).ok;
    // "the tile in front still wants another brick"
    case "needBrick":  {if(!ok(a))return false;const w=sc.plan&&sc.plan[K(a.x,a.y)];return w!=null&&H(a)<w;}
  }
  return null;
};

T3.done=function(sc){
  let missing=0, extra=0;
  const plan=sc.plan||{};
  for(const k in plan){const v=sc.h[k]==null?0:sc.h[k];if(v<plan[k])missing+=plan[k]-v;else if(v>plan[k])extra+=v-plan[k];}
  for(const k in sc.h){
    if(plan[k]!=null)continue;
    const b=sc.base[k]==null?0:sc.base[k];
    if(sc.h[k]>b)extra+=sc.h[k]-b;
  }
  return {ok:missing===0&&extra===0, missing:missing, extra:extra};
};

if(typeof window!=="undefined")window.T3=T3;
})();

/* ============================ 2. levels ============================== */
/* Every plan is reachable under the build rule (never higher than the
   robot's shoulder), so each one is a genuine build→climb ladder.     */
/* `var`, not `const`: a double <script src> (or a hot-reload) must not abort
   the whole module with "already declared" and take the patches down with it. */
var TOWER_LEVELS=window.TOWER_LEVELS||[
  {id:"t3_steps", em:"🪜", name:"First Steps", diff:1, coins:60, xp:40, maxBlocks:8, gw:5, gh:3,
   start:{x:0,y:1,dir:1},
   allowed:["move","turnL","turnR","build","climb","repeat"],
   plan:[[1,1,1],[2,1,2],[3,1,3]],
   desc:"Height is new. 🧱 Build drops a brick on the tile IN FRONT of you — but never higher than your own shoulder. 🪜 Climb steps up onto a brick exactly one level high. Build the three-step stair."},

  {id:"t3_ramp", em:"🛤️", name:"The Long Ramp", diff:2, coins:90, xp:60, maxBlocks:9, gw:8, gh:3,
   start:{x:0,y:1,dir:1},
   allowed:["move","turnL","turnR","build","climb","repeat","countLoop"],
   plan:[[1,1,1],[2,1,2],[3,1,3],[4,1,3],[5,1,3],[6,1,3]],
   desc:"Three steps up, then a walkway. The stair grows by one brick each time — a 🔢 Count loop can build a step whose height is the loop's own number."},

  {id:"t3_gap", em:"🕳️", name:"Mind the Gap", diff:2, coins:110, xp:70, maxBlocks:10, gw:7, gh:3,
   start:{x:0,y:1,dir:1}, holes:[[3,1]],
   allowed:["move","turnL","turnR","build","climb","jump","if","repeat","whileLoop"],
   plan:[[5,1,1],[6,1,2]],
   desc:"A hole splits the board. 🦘 Jump clears one low tile and lands you level on the far side. Cross it, then build the two-step marker on the other bank."},

  {id:"t3_corner", em:"📐", name:"The Corner", diff:3, coins:160, xp:100, maxBlocks:12, gw:5, gh:5,
   start:{x:0,y:1,dir:1},
   allowed:["move","turnL","turnR","build","climb","descend","repeat","countLoop","if"],
   plan:[[1,1,1],[2,1,2],[3,1,3],[3,2,3],[3,3,3]],
   desc:"Climb the stair, then turn and keep going. Up on the top step the tile ahead is three below you — a walkway at height costs three bricks per tile before you can step onto it."},

  {id:"t3_descend", em:"⛰️", name:"Down and Over", diff:3, coins:180, xp:120, maxBlocks:12, gw:7, gh:3,
   start:{x:0,y:1,dir:1},
   terrain:[[0,1,3],[1,1,2],[2,1,1]],
   allowed:["move","turnL","turnR","build","climb","descend","jump","if","repeat","whileLoop"],
   plan:[[4,1,1],[5,1,2],[6,1,3]],
   desc:"You start on a cliff. ⬇️ Descend steps DOWN exactly one level — walk yourself to the ground, then build the matching stair back up on the far side. A 🔄 While loop can descend until the ground is flat."}
];
window.TOWER_LEVELS=TOWER_LEVELS;

/* ============================ 3. glue =============================== */
(function(){
if(typeof window==="undefined"||typeof mgState==="undefined")return; // preview page: renderer only
if(window.__t3glue)return;                                            // never wrap twice
window.__t3glue=1;

/* ---- new blocks in the shared palette ----
   DEFS is the block registry (blocks.js) and COND_LBL the sensor labels;
   both are plain objects, so a 3D level's palette is just five more keys. */
DEFS.climb  ={cat:"basic",ic:"🪜",lbl:"Climb Up"};
DEFS.descend={cat:"basic",ic:"⬇️",lbl:"Step Down"};
DEFS.jump   ={cat:"basic",ic:"🦘",lbl:"Jump Gap"};
DEFS.dig    ={cat:"basic",ic:"⛏️",lbl:"Take Brick"};
COND_LBL.canClimb ="can climb up 🪜";
COND_LBL.stepDown ="step down ahead ⬇️";
COND_LBL.gapAhead ="gap ahead 🕳️";
COND_LBL.canJump  ="can jump across 🦘";
COND_LBL.needBrick="tile ahead needs a brick 🧱";

const t3On=()=>!!(mgState&&mgState.proj&&mgState.proj.mode3d);
const T3_ACTS={climb:1,descend:1,jump:1,build:1,move:1,dig:1};

/* the scene the renderer eats, built from the live challenge state.
   Takes the state explicitly so a caller holding a state that is no longer
   the global one (mgCheck is handed its own) never reads past it. */
function t3Scene(st){
  st=st||mgState;
  if(!st||!st.proj||!st.robot)return null;
  const p=st.proj,rb=st.robot;
  return {gw:p.gw,gh:p.gh,h:rb.h,base:rb.base,plan:p.planMap,robot:rb};
}

/* ---- state seeding ---- */
const _mgSeed=window.mgSeed;
window.mgSeed=function(rs,proj){
  _mgSeed(rs,proj);
  if(!proj.mode3d)return;
  rs.h={};rs.base={};
  for(const c of (proj.terrain||[])){rs.base[T3.K(c[0],c[1])]=c[2];rs.h[T3.K(c[0],c[1])]=c[2];}
  for(const c of (proj.holes||[])){rs.base[T3.K(c[0],c[1])]=-1;rs.h[T3.K(c[0],c[1])]=-1;}
  rs.z=rs.base[T3.K(rs.x,rs.y)]||0;
};

/* ---- the action hook ------------------------------------------------
   The one edit this feature needs inside challenges.js: mgTick calls
   window.T3Act at its action-dispatch site, once per leaf block, and skips
   its own flat-board switch when we answer true.

   It has to live there rather than around mgTick. mgTick is a
   while(guard<60) loop, and every control-flow block (repeat, call, while,
   forever, count, if) pushes a frame and CONTINUES inside the same call —
   so a wrapper around mgTick only ever sees a tick's first block, and the
   body of any loop falls straight through to the 2D rules, which have no
   climb, descend, jump or dig at all. That is the whole difference between
   "the levels work" and "no 3D action ever runs inside a loop".

   Answering false leaves the block completely alone, so 2D levels behave
   identically whether or not this file is loaded. */
window.T3Act=function(st,b){
  if(!t3On()||!b||!T3_ACTS[b.t])return false;
  const sc=t3Scene(st), rb=st.robot;
  if(!sc)return false;
  rb.z=T3.hAt(sc,rb.x,rb.y);
  const did=T3.act(sc,b.t);
  rb.z=T3.hAt(sc,rb.x,rb.y);
  if(did===null)return false;
  if(did)sfx(b.t==="build"?430:b.t==="jump"?640:520,.04); else sfx(185,.05);
  return true;
};

/* ---- sensors ---- */
const _mgCond=window.mgCond;
window.mgCond=function(st,c){
  if(t3On()&&typeof c==="string"){const sc=t3Scene(st);const v=sc&&T3.sense(sc,c);if(v!==null&&v!==undefined)return v;}
  return _mgCond(st,c);
};
const _mgCondList=window.mgCondList;
window.mgCondList=function(){
  if(!t3On())return _mgCondList();
  const p=mgState.proj, L=["blocked","canClimb","needBrick"];
  if((p.allowed||[]).indexOf("descend")>=0)L.push("stepDown");
  if((p.holes||[]).length){L.push("gapAhead");L.push("canJump");}
  return L;
};

/* ---- the verdict ---- */
const _mgCheck=window.mgCheck;
window.mgCheck=function(st){
  if(!(st&&st.proj&&st.proj.mode3d))return _mgCheck(st);
  const sc=t3Scene(st);
  if(!sc)return _mgCheck(st);
  const r=T3.done(sc);
  if(r.ok)return {ok:true, msg:""};
  // report whichever is wrong; missing first, since it is the commoner miss
  const msg=r.missing
    ? "🧱 "+r.missing+" brick"+(r.missing>1?"s":"")+" still missing from the blueprint — the ghost outlines show where."
    : "🚧 "+r.extra+" brick"+(r.extra>1?"s":"")+" outside the plan — the red ones. ⛏️ Take Brick removes the top one.";
  return {ok:false, msg:msg};
};

/* ---- rendering: own the canvas, own the frame loop ---- */
let raf=0, yaw=0, yawT=0;
const _mgDraw=window.mgDraw;
window.mgDraw=function(){
  if(!t3On())return _mgDraw();
  if($("boardTab").style.display==="none")return;
  const cv=$("mgCanvas"), sc=t3Scene();
  if(!sc)return;
  const W=cv.clientWidth||320, H=Math.round(W*0.72);
  const dpr=(typeof DPR!=="undefined"?DPR:Math.min(3,window.devicePixelRatio||1));
  cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);cv.style.height=H+"px";
  const g=cv.getContext("2d");
  g.setTransform(dpr,0,0,dpr,0,0);
  g.imageSmoothingEnabled=true;g.imageSmoothingQuality="high";
  yaw+=(yawT-yaw)*0.18;
  if(Math.abs(yawT-yaw)<0.001)yaw=yawT;
  T3.render(g,W,H,sc,{yaw:yaw,t:(typeof now!=="undefined"?now:Date.now())});
  // the number only — the ⛰ beside it is a one-time SVG the icon pack swapped in.
  // Rewriting the whole label every frame would destroy that span and re-trigger
  // the pack's observer sixty times a second.
  const hb=$("t3Height"), hz=String(T3.hAt(sc,sc.robot.x,sc.robot.y));
  if(hb&&hb.textContent!==hz)hb.textContent=hz;
};
function t3Loop(){
  raf=0;
  if(!t3On())return;
  mgDraw();
  /* Stop once the camera has settled. mgDraw is what eases yaw toward yawT, and
     every other redraw — an action, a paint stroke, a view toggle — calls mgDraw
     directly, so nothing needs a frame when nothing is turning. Re-arming
     unconditionally held a 60fps loop open for a board that was not moving: it
     drains a phone for as long as a 3D level is open, and it wedged a headless
     screenshot that waits for the page to go quiet. */
  if(Math.abs(yawT-yaw)>0.0005)raf=requestAnimationFrame(t3Loop);
}
function t3Rotate(d){yawT+=d*Math.PI/2;if(!raf)raf=requestAnimationFrame(t3Loop);}
/* the camera, for anyone else who wants to show this scene — the level
   editor borrows the same loop and bar rather than growing its own. */
window.t3Cam={rot:t3Rotate, bar:on=>t3Bar(on),
  start(){if(!raf)raf=requestAnimationFrame(t3Loop);},
  stop(){if(raf){cancelAnimationFrame(raf);raf=0;}}};

/* ---- the camera bar under the board ---- */
function t3Bar(on){
  let bar=$("t3Bar");
  if(!on){if(bar)bar.remove();return;}
  if(bar)return;
  bar=document.createElement("div");bar.id="t3Bar";bar.className="t3bar";
  bar.innerHTML='<span class="t3tag">🧊 3D</span>'+
    '<button class="t3btn" id="t3RotL" title="Rotate left">↺</button>'+
    '<button class="t3btn" id="t3RotR" title="Rotate right">↻</button>'+
    '<span class="t3h">⛰ <b id="t3Height">0</b></span>'+
    '<span class="t3key"><i class="t3sw t3sw-b"></i>built<i class="t3sw t3sw-p"></i>planned<i class="t3sw t3sw-x"></i>stray</span>';
  const cv=$("mgCanvas");
  cv.parentNode.insertBefore(bar,cv.nextSibling);
  $("t3RotL").onclick=()=>t3Rotate(-1);
  $("t3RotR").onclick=()=>t3Rotate(1);
}

/* ---- entering / leaving ---- */
function t3Enter(lv){
  const p=JSON.parse(JSON.stringify(lv));
  p.mode3d=true;
  p.planMap={};for(const c of (p.plan||[]))p.planMap[T3.K(c[0],c[1])]=c[2];
  p.cells=(p.plan||[]).map(c=>[c[0],c[1]]);   // keeps the 2D "nothing to build" guard happy
  p.goalType=null;
  yaw=yawT=0;
  mgEnter(p);
  t3Bar(true);
  if(!raf)raf=requestAnimationFrame(t3Loop);
}
const _mgExit=window.mgExit;
window.mgExit=function(reopen){t3Bar(false);if(raf){cancelAnimationFrame(raf);raf=0;}return _mgExit(reopen);};

/* ---- its own band in the projects sheet ---- */
const _renderProjects=window.renderProjects;
window.renderProjects=function(){
  _renderProjects();
  const el=$("projList");if(!el)return;
  const sec=document.createElement("div");sec.className="t3sec";
  const done=TOWER_LEVELS.filter(l=>player.projects[l.id]).length;
  sec.innerHTML='<div class="t3head"><div class="t3ico">🧊</div>'+
    '<div><div class="t3title">Tower Mode</div>'+
    '<div class="t3sub">Builds with height — stack, climb, and rebuild the blueprint in 3D.</div></div>'+
    '<div class="t3prog">'+done+'/'+TOWER_LEVELS.length+'</div></div>'+
    '<div class="t3grid"></div>';
  const grid=sec.querySelector(".t3grid");
  for(const lv of TOWER_LEVELS){
    const solved=!!player.projects[lv.id];
    const c=document.createElement("button");
    c.className="t3card"+(solved?" done":"");
    const peak=Math.max.apply(null,(lv.plan||[[0,0,1]]).map(x=>x[2]));
    c.innerHTML='<span class="t3badge">'+lv.em+'</span>'+
      '<span class="t3name">'+esc(lv.name)+'</span>'+
      '<span class="t3meta">'+"⭐".repeat(lv.diff)+' · 🧩 '+lv.maxBlocks+' · ⛰ '+peak+'</span>'+
      (solved?'<span class="t3done">✓</span>':'');
    c.onclick=()=>{$("projects").classList.remove("open");t3Enter(lv);};
    grid.appendChild(c);
  }
  el.insertBefore(sec,el.firstChild);
};

window.t3Enter=t3Enter;
})();
