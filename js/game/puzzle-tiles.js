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
  // four tile colours, reused for key/door pairs and portal pairs
  const COL=["#ffd66b","#5ab8ff","#ff5d73","#54d66a"];
  const DEFS={
    wall:{em:"🧱",lbl:"Wall",arg:null,
      solid:()=>true},
    // A pit blocks the robot until something fills it. Dropping a carried brick
    // into the gap ahead is the fix — the robot builds its own bridge.
    pit:{em:"🕳️",lbl:"Pit",arg:null,
      solid:(rs,k)=>!rs.bricks.has(k)},
    // Walk over a key to add its colour to the robot's keyring. Keys are never
    // spent — one key opens every door of its colour, which keeps the rule simple
    // ("do I have the blue key?") and means a door, once open, stays open.
    key:{em:"🔑",lbl:"Key",arg:"colour",
      solid:()=>false,
      enter:(st,rs,k,t)=>{rs.keys.add(t.a);rs.tiles.delete(k);sfx(880,.05);sfx(1180,.05,.06);}},
    door:{em:"🚪",lbl:"Door",arg:"colour",
      solid:(rs,k,t)=>!rs.keys.has(t.a),
      enter:(st,rs,k)=>{rs.open.add(k);}},
    // Two portals sharing a colour are a pair — stepping on one puts the robot
    // on the other. The move that lands here is not re-run at the far end, so a
    // pair can never bounce the robot back and forth.
    portal:{em:"🌀",lbl:"Portal",arg:"colour",
      solid:()=>false,
      enter:(st,rs,k,t)=>{
        for(const [k2,t2] of rs.tiles)
          if(k2!==k&&t2.t==="portal"&&t2.a===t.a){sfx(700,.05);sfx(1000,.06,.05);return k2;}
      }},
    // A plate is held down by the robot standing on it OR by a block left on it.
    // Both matter: standing on it teaches "I can't be in two places at once",
    // which is exactly what pushes the player to discover the block solution.
    plate:{em:"🔘",lbl:"Plate",arg:"colour",
      solid:()=>false},
    // Open only while every plate of its colour is pressed.
    gate:{em:"🚧",lbl:"Gate",arg:"colour",
      solid:(rs,k,t)=>!platesPressed(rs,t.a)},
    // One-way: you may not step OFF this tile against the arrow. It never moves
    // the robot itself — "the robot does exactly what your code says" still holds.
    arrow:{em:"➡️",lbl:"One-way",arg:"dir",
      solid:()=>false},
  };
  // creator tool order (also the order tiles are drawn in)
  const TYPES=["wall","pit","key","door","portal","plate","gate","arrow"];
  // are all plates of this colour currently held down?
  function platesPressed(rs,colour){
    let any=false;
    for(const [k,t] of rs.tiles){
      if(t.t!=="plate"||t.a!==colour)continue;
      any=true;
      if(!(rs.bricks.has(k)||(rs.x+"_"+rs.y)===k))return false;
    }
    return any; // a gate with no plates of its colour stays shut
  }
  // may the robot leave `from` heading in direction `dir`? (one-way arrows)
  function canLeave(rs,fx,fy,dir){
    const t=at(rs,fx+"_"+fy);
    return !(t&&t.t==="arrow"&&(t.a|0)!==dir);
  }

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

  // a colour swatch behind an emoji, plus the colour's number in the corner so
  // the pairing still reads for a colour-blind player
  function drawBadge(g,px,py,cell,colIdx,em,shape){
    const c=COL[(colIdx-1+COL.length)%COL.length]||COL[0];
    const m=Math.max(2,cell*0.08), x=px+m, y=py+m, s=cell-2*m;
    g.save();
    if(shape==="disc"){g.beginPath();g.arc(px+cell/2,py+cell/2,s*.46,0,7);}
    else{rr(g,x,y,s,s,Math.max(4,cell*.18));}
    g.fillStyle="rgba(0,0,0,.2)";g.fill();
    g.strokeStyle=c;g.lineWidth=Math.max(2.5,cell*.075);g.stroke();
    g.fillStyle=c;g.globalAlpha=.22;g.fill();g.globalAlpha=1;
    g.restore();
    const sp=sprite(em,cell*.52);
    g.drawImage(sp,px+cell/2-sp.lw/2,py+cell/2-sp.lw/2,sp.lw,sp.lw);
    g.font="900 "+Math.floor(cell*0.21)+"px Fredoka,sans-serif";
    g.textAlign="left";g.textBaseline="top";
    g.lineWidth=3;g.strokeStyle="rgba(0,0,0,.45)";g.strokeText(colIdx,px+4,py+3);
    g.fillStyle=c;g.fillText(colIdx,px+4,py+3);
  }
  // a gate: solid bars when shut, retracted stubs when its plates are pressed
  function drawGate(g,px,py,cell,colIdx,open){
    const c=COL[(colIdx-1+COL.length)%COL.length]||COL[0];
    const m=Math.max(2,cell*0.06), x=px+m, y=py+m, s=cell-2*m;
    g.save();rr(g,x,y,s,s,Math.max(4,cell*.16));g.clip();
    g.fillStyle=open?"rgba(80,200,120,.14)":"rgba(0,0,0,.3)";g.fillRect(x,y,s,s);
    g.strokeStyle=c;g.lineWidth=Math.max(2.5,cell*.08);g.globalAlpha=open?.35:1;
    const bars=3, step=s/(bars+1), len=open?s*.22:s;
    for(let i=1;i<=bars;i++){
      const bx=x+i*step;
      g.beginPath();g.moveTo(bx,y);g.lineTo(bx,y+len);
      if(open){g.moveTo(bx,y+s);g.lineTo(bx,y+s-len);}
      g.stroke();
    }
    g.globalAlpha=1;g.restore();
    g.strokeStyle=c;g.lineWidth=1.8;rr(g,x,y,s,s,Math.max(4,cell*.16));g.stroke();
    g.font="900 "+Math.floor(cell*0.21)+"px Fredoka,sans-serif";
    g.textAlign="left";g.textBaseline="top";
    g.lineWidth=3;g.strokeStyle="rgba(0,0,0,.45)";g.strokeText(colIdx,px+4,py+3);
    g.fillStyle=c;g.fillText(colIdx,px+4,py+3);
  }
  // a one-way tile: a big chevron pointing the only way out (dir 0=N 1=E 2=S 3=W)
  function drawArrow(g,px,py,cell,dir){
    const cx=px+cell/2, cy=py+cell/2, r=cell*.3;
    g.save();g.translate(cx,cy);g.rotate(dir*Math.PI/2); // art points north at dir 0
    g.fillStyle="rgba(255,255,255,.13)";
    g.beginPath();g.arc(0,0,cell*.42,0,7);g.fill();
    g.strokeStyle="#ffd66b";g.lineWidth=Math.max(3,cell*.1);
    g.lineCap="round";g.lineJoin="round";
    g.beginPath();g.moveTo(-r*.7,r*.28);g.lineTo(0,-r*.42);g.lineTo(r*.7,r*.28);g.stroke();
    g.beginPath();g.moveTo(-r*.7,r*.85);g.lineTo(0,r*.15);g.lineTo(r*.7,r*.85);g.stroke();
    g.restore();
  }
  // draw every tile of the board. Called from mgDraw AFTER the grass, BEFORE
  // the blueprint outlines, so targets and bricks read on top of the terrain.
  function draw(g,rs,cell){
    if(!rs||!rs.tiles)return;
    for(const [k,t] of rs.tiles){
      const q=k.split("_"), px=(+q[0])*cell, py=(+q[1])*cell;
      const n=(t.a|0)||1;
      if(t.t==="wall")drawWall(g,px,py,cell);
      else if(t.t==="pit")drawPit(g,px,py,cell,rs.bricks.has(k));
      else if(t.t==="key")drawBadge(g,px,py,cell,n,"🔑","disc");
      else if(t.t==="door")drawBadge(g,px,py,cell,n,rs.keys.has(t.a)?"🚪":"🔒","sq");
      else if(t.t==="portal")drawBadge(g,px,py,cell,n,"🌀","disc");
      else if(t.t==="plate")drawBadge(g,px,py,cell,n,
        (rs.bricks.has(k)||(rs.x+"_"+rs.y)===k)?"🟢":"🔘","disc");
      else if(t.t==="gate")drawGate(g,px,py,cell,n,platesPressed(rs,t.a));
      else if(t.t==="arrow")drawArrow(g,px,py,cell,t.a|0);
    }
  }

  window.CC_TILES={DEFS,TYPES,COL,seed,at,solid,enter,isFilledPit,openPit,draw,platesPressed,canLeave};
})();
