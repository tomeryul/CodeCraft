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

  /* ---------------- art ----------------
     Every tile is drawn as vector art on the board canvas — no emoji sprites —
     so it stays crisp at any cell size and can react to state (a door really
     swings open, a plate really sinks). Walls auto-connect: each wall cell
     looks at its four neighbours and drops the margin + corner radius on every
     side that continues into more masonry, so a run of walls reads as ONE wall
     and a door reads as an opening cut into it. */
  function path4(g,x,y,w,h,r){ // r = [tl,tr,br,bl]
    const a=r[0],b=r[1],c=r[2],d=r[3];
    g.beginPath();
    g.moveTo(x+a,y);
    g.lineTo(x+w-b,y);   if(b)g.arcTo(x+w,y,x+w,y+b,b);
    g.lineTo(x+w,y+h-c); if(c)g.arcTo(x+w,y+h,x+w-c,y+h,c);
    g.lineTo(x+d,y+h);   if(d)g.arcTo(x,y+h,x,y+h-d,d);
    g.lineTo(x,y+a);     if(a)g.arcTo(x,y,x+a,y,a);
    g.closePath();
  }
  // nb = {n,e,s,w} — true where the masonry continues into the next cell
  function drawWall(g,px,py,cell,nb){
    nb=nb||{};
    const m=Math.max(1,cell*.03), rad=Math.max(3,cell*.16);
    const x=px+(nb.w?0:m), y=py+(nb.n?0:m);
    const w=cell-(nb.w?0:m)-(nb.e?0:m), h=cell-(nb.n?0:m)-(nb.s?0:m);
    const r=[(nb.n||nb.w)?0:rad,(nb.n||nb.e)?0:rad,(nb.s||nb.e)?0:rad,(nb.s||nb.w)?0:rad];
    const grd=g.createLinearGradient(0,y,0,y+h);
    grd.addColorStop(0,"#9aa2ad");grd.addColorStop(.55,"#79828e");grd.addColorStop(1,"#5b6470");
    if(!nb.s){g.fillStyle="rgba(0,0,0,.22)";path4(g,x+1.5,y+3,w,h,r);g.fill();}
    g.fillStyle=grd;path4(g,x,y,w,h,r);g.fill();
    g.save();path4(g,x,y,w,h,r);g.clip();
    // three courses of stone; the joint offset is derived from the cell's grid
    // position so neighbouring cells stagger instead of repeating identically
    const rows=3, rh=h/rows, gx=Math.round(px/cell), gy=Math.round(py/cell);
    g.strokeStyle="rgba(30,36,44,.42)";g.lineWidth=Math.max(1,cell*.03);g.lineCap="butt";
    for(let i=1;i<rows;i++){g.beginPath();g.moveTo(x,y+i*rh);g.lineTo(x+w,y+i*rh);g.stroke();}
    for(let i=0;i<rows;i++){
      const odd=((i+gy*rows+gx)&1);
      const j1=px+(odd?cell*.5:cell*.02), j2=j1+cell*.5;
      if(j1>x+1&&j1<x+w-1){g.beginPath();g.moveTo(j1,y+i*rh);g.lineTo(j1,y+(i+1)*rh);g.stroke();}
      if(j2>x+1&&j2<x+w-1){g.beginPath();g.moveTo(j2,y+i*rh);g.lineTo(j2,y+(i+1)*rh);g.stroke();}
    }
    if(!nb.n){g.fillStyle="rgba(255,255,255,.3)";g.fillRect(x,y,w,Math.max(2,cell*.08));}
    if(!nb.s){g.fillStyle="rgba(0,0,0,.26)";g.fillRect(x,y+h-Math.max(2,cell*.13),w,Math.max(2,cell*.13));}
    g.restore();
    g.strokeStyle="rgba(35,42,52,.5)";g.lineWidth=1.4;path4(g,x,y,w,h,r);g.stroke();
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
  const colOf=i=>COL[(i-1+COL.length)%COL.length]||COL[0];
  // the colour's number, top-left, so key/door and plate/gate pairings still
  // read for a colour-blind player
  function colTag(g,px,py,cell,colIdx,c){
    g.font="900 "+Math.floor(cell*0.2)+"px Fredoka,sans-serif";
    g.textAlign="left";g.textBaseline="top";
    g.lineWidth=3;g.strokeStyle="rgba(0,0,0,.5)";g.strokeText(colIdx,px+3,py+2);
    g.fillStyle=c;g.fillText(colIdx,px+3,py+2);
  }
  // ---- a real key: bow, shaft and two teeth, glowing in its colour ----
  function drawKey(g,px,py,cell,colIdx){
    const c=colOf(colIdx), cx=px+cell/2, cy=py+cell/2, u=cell/100;
    g.save();
    g.fillStyle="rgba(0,0,0,.18)";g.beginPath();g.arc(cx,cy,cell*.4,0,7);g.fill();
    g.translate(cx,cy);g.rotate(-Math.PI/4);
    g.lineCap="round";
    g.shadowColor=c;g.shadowBlur=cell*.18;
    g.strokeStyle=c;g.lineWidth=Math.max(2,u*8);
    g.beginPath();g.arc(-u*16,0,u*12,0,7);g.stroke();            // bow
    g.beginPath();g.moveTo(-u*4,0);g.lineTo(u*30,0);g.stroke();  // shaft
    g.shadowBlur=0;
    g.lineWidth=Math.max(1.6,u*7);
    g.beginPath();g.moveTo(u*21,0);g.lineTo(u*21,u*11);g.stroke(); // teeth
    g.beginPath();g.moveTo(u*30,0);g.lineTo(u*30,u*8);g.stroke();
    g.fillStyle="rgba(0,0,0,.45)";g.beginPath();g.arc(-u*16,0,Math.max(1,u*4.5),0,7);g.fill();
    g.restore();
    colTag(g,px,py,cell,colIdx,c);
  }
  // ---- a real door: an opening cut into the masonry, with a leaf that swings ----
  function drawDoor(g,px,py,cell,colIdx,open,nb){
    const c=colOf(colIdx), u=cell/100;
    drawWall(g,px,py,cell,nb);                    // the wall this door sits in
    const fw=cell*.13;                            // jamb thickness
    const x=px+fw, y=py+cell*.13, w=cell-2*fw, h=cell-cell*.13-fw*.6;
    const top=Math.min(w*.5,cell*.2);             // arched head
    g.save();
    path4(g,x,y,w,h,[top,top,0,0]);
    g.fillStyle="#1b1f2b";g.fill();               // the dark opening
    g.clip();
    if(open){
      // the leaf has swung inward — a foreshortened slab hinged on the left
      const lw=w*.34;
      const lg=g.createLinearGradient(x,0,x+lw,0);
      lg.addColorStop(0,"#8d5a2b");lg.addColorStop(1,"#5d3a19");
      g.fillStyle=lg;g.fillRect(x,y+h*.06,lw,h*.94);
      g.fillStyle="rgba(0,0,0,.35)";g.fillRect(x+lw,y,w*.1,h);
      g.strokeStyle=c;g.lineWidth=Math.max(1.4,u*4);g.globalAlpha=.9;
      g.beginPath();g.moveTo(x+lw*.55,y+h*.22);g.lineTo(x+lw*.55,y+h*.8);g.stroke();
      g.globalAlpha=1;
      const sp=g.createLinearGradient(x,y,x+w,y+h);   // light spilling through
      sp.addColorStop(0,"rgba(255,240,200,0)");sp.addColorStop(1,"rgba(255,240,200,.22)");
      g.fillStyle=sp;g.fillRect(x,y,w,h);
    }else{
      const dg=g.createLinearGradient(x,0,x+w,0);
      dg.addColorStop(0,"#a8642f");dg.addColorStop(.5,"#c07c3f");dg.addColorStop(1,"#8d5a2b");
      g.fillStyle=dg;g.fillRect(x,y,w,h);
      g.strokeStyle="rgba(0,0,0,.3)";g.lineWidth=Math.max(1.2,u*3.5);
      const pw=w*.56, ph=h*.3;                        // two recessed panels
      g.strokeRect(x+(w-pw)/2,y+h*.13,pw,ph);
      g.strokeRect(x+(w-pw)/2,y+h*.55,pw,ph);
      // the colour band + handle, so which key opens it is unmistakable
      g.fillStyle=c;g.globalAlpha=.85;g.fillRect(x,y+h*.44,w,Math.max(2,h*.07));g.globalAlpha=1;
      g.fillStyle="#ffe9a8";g.beginPath();g.arc(x+w*.8,y+h*.5,Math.max(1.5,u*5),0,7);g.fill();
      g.strokeStyle="rgba(0,0,0,.45)";g.lineWidth=Math.max(1,u*2.5);g.stroke();
    }
    g.restore();
    g.strokeStyle=open?"rgba(20,24,32,.75)":c;
    g.lineWidth=Math.max(1.8,u*4);
    path4(g,x,y,w,h,[top,top,0,0]);g.stroke();
    colTag(g,px,py,cell,colIdx,c);
  }
  // ---- a real portal: a glowing vortex ring with a spiral throat ----
  function drawPortal(g,px,py,cell,colIdx){
    const c=colOf(colIdx), cx=px+cell/2, cy=py+cell/2, R=cell*.4;
    g.save();
    g.translate(cx,cy);
    const rg=g.createRadialGradient(0,0,R*.1,0,0,R);
    rg.addColorStop(0,"#08101e");rg.addColorStop(.55,"rgba(10,18,34,.85)");rg.addColorStop(1,"rgba(10,18,34,0)");
    g.fillStyle=rg;g.beginPath();g.ellipse(0,0,R,R*.9,0,0,7);g.fill();
    g.shadowColor=c;g.shadowBlur=cell*.22;
    g.strokeStyle=c;g.lineWidth=Math.max(2,cell*.055);
    g.beginPath();g.ellipse(0,0,R*.94,R*.86,0,0,7);g.stroke();
    g.shadowBlur=0;
    // spiral throat — a couple of turns tightening to the centre
    g.globalAlpha=.85;g.lineWidth=Math.max(1.6,cell*.04);g.lineCap="round";
    g.beginPath();
    for(let i=0;i<=44;i++){
      const t=i/44, a=t*Math.PI*2.6-0.7, r=R*(.78-.66*t);
      const X=Math.cos(a)*r, Y=Math.sin(a)*r*.9;
      if(i)g.lineTo(X,Y);else g.moveTo(X,Y);
    }
    g.stroke();
    g.globalAlpha=.75;g.fillStyle="#fff";
    g.beginPath();g.arc(0,0,Math.max(1.4,cell*.045),0,7);g.fill();
    g.globalAlpha=1;
    g.restore();
    colTag(g,px,py,cell,colIdx,c);
  }
  // ---- a pressure plate: a raised pad that visibly sinks when held down ----
  function drawPlate(g,px,py,cell,colIdx,pressed){
    const c=colOf(colIdx), cx=px+cell/2, cy=py+cell/2, R=cell*.32;
    g.save();
    g.fillStyle="rgba(0,0,0,.3)";
    rr(g,px+cell*.12,py+cell*.12,cell*.76,cell*.76,Math.max(3,cell*.14));g.fill();
    const lift=pressed?0:cell*.055;
    const pg=g.createLinearGradient(0,cy-R,0,cy+R);
    if(pressed){pg.addColorStop(0,"#2f3a46");pg.addColorStop(1,"#3d4a58");}
    else{pg.addColorStop(0,"#dfe5ef");pg.addColorStop(1,"#9aa4b4");}
    g.fillStyle=pg;
    g.beginPath();g.arc(cx,cy-lift,R,0,7);g.fill();
    if(!pressed){ // a shadow under the near rim gives the button its height
      g.strokeStyle="rgba(0,0,0,.35)";g.lineWidth=Math.max(1.5,cell*.045);
      g.beginPath();g.arc(cx,cy-lift+cell*.02,R,0.15,Math.PI-0.15);g.stroke();
    }
    g.strokeStyle=c;g.lineWidth=Math.max(2,cell*.06);
    if(pressed){g.shadowColor=c;g.shadowBlur=cell*.22;}
    g.beginPath();g.arc(cx,cy-lift,R*.62,0,7);g.stroke();
    g.shadowBlur=0;
    g.restore();
    colTag(g,px,py,cell,colIdx,c);
  }
  // ---- a gate: a hazard-striped barrier that retracts into its posts ----
  function drawGate(g,px,py,cell,colIdx,open){
    const c=colOf(colIdx);
    const m=Math.max(2,cell*0.06), x=px+m, y=py+m, s=cell-2*m, rad=Math.max(4,cell*.16);
    g.save();rr(g,x,y,s,s,rad);g.clip();
    g.fillStyle=open?"rgba(84,214,106,.13)":"rgba(0,0,0,.34)";g.fillRect(x,y,s,s);
    g.fillStyle="rgba(255,255,255,.14)";                    // the posts stay put
    g.fillRect(x,y,s*.14,s);g.fillRect(x+s*.86,y,s*.14,s);
    const bh=s*.22, by=y+s*.5-bh/2;
    g.globalAlpha=open?.32:1;
    if(open){                                               // retracted into both posts
      g.fillStyle=c;g.fillRect(x,by,s*.2,bh);g.fillRect(x+s*.8,by,s*.2,bh);
    }else{
      g.fillStyle=c;g.fillRect(x,by,s,bh);
      g.save();g.beginPath();g.rect(x,by,s,bh);g.clip();
      g.strokeStyle="rgba(0,0,0,.45)";g.lineWidth=s*.09;
      for(let i=-1;i<7;i++){const o=x+i*s*.24;
        g.beginPath();g.moveTo(o,by+bh);g.lineTo(o+bh,by);g.stroke();}
      g.restore();
    }
    g.globalAlpha=1;g.restore();
    g.strokeStyle=c;g.lineWidth=1.8;rr(g,x,y,s,s,rad);g.stroke();
    colTag(g,px,py,cell,colIdx,c);
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
    // walls and doors are one structure: a wall butts seamlessly against the
    // door's jamb, so a door reads as an opening cut into the wall
    const joins=k=>{const t=rs.tiles.get(k);return !!(t&&(t.t==="wall"||t.t==="door"));};
    const nbOf=(gx,gy)=>({n:joins(gx+"_"+(gy-1)),e:joins((gx+1)+"_"+gy),
                          s:joins(gx+"_"+(gy+1)),w:joins((gx-1)+"_"+gy)});
    for(const [k,t] of rs.tiles){
      const q=k.split("_"), gx=+q[0], gy=+q[1], px=gx*cell, py=gy*cell;
      const n=(t.a|0)||1;
      if(t.t==="wall")drawWall(g,px,py,cell,nbOf(gx,gy));
      else if(t.t==="pit")drawPit(g,px,py,cell,rs.bricks.has(k));
      else if(t.t==="key")drawKey(g,px,py,cell,n);
      else if(t.t==="door")drawDoor(g,px,py,cell,n,rs.keys.has(t.a),nbOf(gx,gy));
      else if(t.t==="portal")drawPortal(g,px,py,cell,n);
      else if(t.t==="plate")drawPlate(g,px,py,cell,n,rs.bricks.has(k)||(rs.x+"_"+rs.y)===k);
      else if(t.t==="gate")drawGate(g,px,py,cell,n,platesPressed(rs,t.a));
      else if(t.t==="arrow")drawArrow(g,px,py,cell,t.a|0);
    }
  }

  window.CC_TILES={DEFS,TYPES,COL,seed,at,solid,enter,isFilledPit,openPit,draw,platesPressed,canLeave};
})();
