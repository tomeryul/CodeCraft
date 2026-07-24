"use strict";
/* ---------------- puzzle tiles ----------------
   Terrain & objects that live on a challenge board, so a level can be a real
   puzzle instead of an empty field. Everything rides on ONE optional field:

     proj.tiles = [ [x, y, type, arg] ]      // arg optional, defaults 0

   Old saves and old published rows simply have no `tiles`, so they behave
   exactly as before. Same idea as CC_DECOR for the open world: the registry
   owns each type's rules AND its art, so adding a tile type is one entry here
   plus one chip in the creator's tool strip.

   A registry entry:
     em    emoji shown on the creator's tool chip
     lbl   human label (creator + level descriptions)
     arg   null | "num" | "dir"  — what the creator's stepper edits
     solid(rs,k,tile)   is this tile impassable RIGHT NOW?
     enter(st,rs,k,tile) stepped onto it — return a "x_y" to teleport to, or nothing
*/
(function(){
  const DEFS={
    wall:{em:"🧱",lbl:"Wall",arg:null,
      solid:()=>true},
    // A pit blocks the robot until something fills it. Dropping a carried brick
    // into the gap ahead is the fix — the robot builds its own bridge.
    pit:{em:"🕳️",lbl:"Pit",arg:null,
      solid:(rs,k)=>!rs.bricks.has(k)},
  };
  // creator tool order (also the order tiles are drawn in)
  const TYPES=["wall","pit"];

  const key=(x,y)=>x+"_"+y;
  const at=(rs,k)=>(rs&&rs.tiles)?(rs.tiles.get(k)||null):null;

  // build the per-run tile lookup + robot tile state. Called from mgSeed.
  function seed(rs,proj){
    rs.tiles=new Map();
    rs.keys=new Set();   // colours the robot is carrying (phase 2)
    rs.open=new Set();   // doors already unlocked (phase 2)
    for(const t of (proj.tiles||[])){
      if(!t||t.length<3)continue;
      if(!DEFS[t[2]])continue;               // unknown type from a newer client — ignore
      rs.tiles.set(key(t[0],t[1]),{t:t[2],a:t.length>3&&t[3]!=null?t[3]:0});
    }
  }
  // can the robot stand on this cell?
  function solid(rs,k){
    const t=at(rs,k);
    if(!t)return false;
    const d=DEFS[t.t];
    return !!(d&&d.solid&&d.solid(rs,k,t));
  }
  // stepped onto a cell — run any on-enter effect. Returns a destination key
  // when the tile relocates the robot (portals), else null.
  function enter(st,rs,k){
    const t=at(rs,k);
    if(!t)return null;
    const d=DEFS[t.t];
    return (d&&d.enter)?(d.enter(st,rs,k,t)||null):null;
  }
  // a brick sitting in a pit has been consumed as bridge material — it must not
  // count as a "stray brick outside the plan" when the goal is checked.
  function isFilledPit(rs,k){
    const t=at(rs,k);
    return !!(t&&t.t==="pit"&&rs.bricks.has(k));
  }
  // is the cell ahead an unfilled pit the robot could drop a brick into?
  function openPit(rs,k){
    const t=at(rs,k);
    return !!(t&&t.t==="pit"&&!rs.bricks.has(k));
  }

  /* ---------------- art ---------------- */
  function drawWall(g,px,py,cell){
    const m=Math.max(1,cell*0.02), x=px+m, y=py+m, s=cell-2*m, rad=Math.max(3,cell*.12);
    const grd=g.createLinearGradient(0,y,0,y+s);
    grd.addColorStop(0,"#9aa2ad");grd.addColorStop(1,"#5d6672");
    g.fillStyle="rgba(0,0,0,.22)";rr(g,x+1.5,y+3,s,s,rad);g.fill();
    g.fillStyle=grd;rr(g,x,y,s,s,rad);g.fill();
    g.save();rr(g,x,y,s,s,rad);g.clip();
    // three courses of stone with staggered mortar joints
    const rows=3, rh=s/rows;
    g.strokeStyle="rgba(30,36,44,.45)";g.lineWidth=Math.max(1,cell*.028);
    for(let i=1;i<rows;i++){g.beginPath();g.moveTo(x,y+i*rh);g.lineTo(x+s,y+i*rh);g.stroke();}
    for(let i=0;i<rows;i++){
      const jx=x+(i%2?s*.5:s*.25)+(i===2?s*.25:0);
      g.beginPath();g.moveTo(jx,y+i*rh);g.lineTo(jx,y+(i+1)*rh);g.stroke();
    }
    g.fillStyle="rgba(255,255,255,.28)";g.fillRect(x,y,s,Math.max(2,s*.09));
    g.fillStyle="rgba(0,0,0,.26)";g.fillRect(x,y+s-Math.max(2,s*.14),s,Math.max(2,s*.14));
    g.restore();
    g.strokeStyle="rgba(35,42,52,.55)";g.lineWidth=1.5;rr(g,x,y,s,s,rad);g.stroke();
  }
  function drawPit(g,px,py,cell,filled){
    const m=Math.max(2,cell*0.06), x=px+m, y=py+m, s=cell-2*m, rad=Math.max(4,cell*.2);
    if(filled){
      // filled in — just a soft rim so you can still see it WAS a gap
      g.strokeStyle="rgba(40,30,20,.4)";g.lineWidth=Math.max(2,cell*.05);
      g.setLineDash([]);rr(g,x,y,s,s,rad);g.stroke();
      return;
    }
    const cx=px+cell/2, cy=py+cell/2;
    const rg=g.createRadialGradient(cx,cy-s*.06,s*.08,cx,cy,s*.58);
    rg.addColorStop(0,"#0a0d12");rg.addColorStop(.72,"#181f29");rg.addColorStop(1,"#2b3542");
    g.fillStyle=rg;rr(g,x,y,s,s,rad);g.fill();
    g.save();rr(g,x,y,s,s,rad);g.clip();
    // light catches the near (bottom) lip, the far lip stays dark
    g.fillStyle="rgba(255,255,255,.16)";g.fillRect(x,y+s-Math.max(2,s*.1),s,Math.max(2,s*.1));
    g.fillStyle="rgba(0,0,0,.4)";g.fillRect(x,y,s,Math.max(2,s*.12));
    g.restore();
    g.strokeStyle="rgba(20,26,34,.7)";g.lineWidth=1.6;rr(g,x,y,s,s,rad);g.stroke();
  }

  // draw every tile of the board. Called from mgDraw AFTER the grass, BEFORE
  // the blueprint outlines, so targets and bricks read on top of the terrain.
  function draw(g,rs,cell){
    if(!rs||!rs.tiles)return;
    for(const [k,t] of rs.tiles){
      const q=k.split("_"), px=(+q[0])*cell, py=(+q[1])*cell;
      if(t.t==="wall")drawWall(g,px,py,cell);
      else if(t.t==="pit")drawPit(g,px,py,cell,rs.bricks.has(k));
    }
  }

  window.CC_TILES={DEFS,TYPES,seed,at,solid,enter,isFilledPit,openPit,draw};
})();
