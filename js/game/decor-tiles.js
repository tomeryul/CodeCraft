"use strict";
/* ---------------- decor autotiling (CC_DECOR) ----------------
   Player-placed build pieces connect to their neighbours like a real
   tileset: walls/fences/paths/hedges compute a 4-dir bitmask from same-
   group neighbours at draw time; doors & windows embed into the wall
   line; roofs read their footprint and render ridge / eaves / rakes.
   Everything is drawn procedurally in canvas 2D in the toy-bevel style
   (rounded corners, top highlight, dark bottom edge). No new assets,
   no data-model changes: pieces are still {type:"decor",deco,em} in
   the objects Map. */
(function(){
const T=48; // logical tile size (matches TILE)
/* bit values: N=1 E=2 S=4 W=8 */
const GROUP={wall:"wall",door:"wall",window:"wall",roof:"roof",fence:"fence",path:"path",floor:"floor",bush:"bush",
  roofBlue:"roofB",roofGreen:"roofG",roofPurple:"roofP",glass:"glass",awning:"awning"};
/* which render layer owns each piece */
const LAYER={path:"ground",floor:"ground",roof:"roof",
  wall:"mid",door:"mid",window:"mid",fence:"mid",bush:"mid",
  lamp:"mid",fountain:"mid",gem:"mid",flower:"mid",
  roofBlue:"roof",roofGreen:"roof",roofPurple:"roof",awning:"roof",glass:"mid",sign:"mid",
  bench:"mid",table:"mid",barrel:"mid",crate:"mid",well:"mid",mailbox:"mid",
  statue:"mid",flag:"mid",stall:"mid",planter:"mid",campfire:"mid",rug:"ground"};

function grpAt(x,y){
  if(x<0||y<0||x>=W||y>=H)return null;
  const o=objects.get(y*W+x);
  return (o&&o.type==="decor")?(GROUP[o.deco]||null):null;
}
function maskAt(x,y,g){
  let m=0;
  if(grpAt(x,y-1)===g)m|=1;
  if(grpAt(x+1,y)===g)m|=2;
  if(grpAt(x,y+1)===g)m|=4;
  if(grpAt(x-1,y)===g)m|=8;
  return m;
}
function dhash(x,y){let h=(x*374761393+y*668265263)^((typeof seed!=="undefined"?seed:7)|0);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;}

/* rounded tile outline: edges with a neighbour run flush to the tile
   border (so shapes fuse); exposed edges are inset; corners round only
   when both touching edges are exposed */
function tilePath(g,px,py,mask,inset,rad){
  const N=mask&1,E=mask&2,S=mask&4,Wd=mask&8;
  const x0=px+(Wd?0:inset), x1=px+T-(E?0:inset);
  const y0=py+(N?0:inset), y1=py+T-(S?0:inset);
  const rNW=(!N&&!Wd)?rad:0.01, rNE=(!N&&!E)?rad:0.01,
        rSE=(!S&&!E)?rad:0.01, rSW=(!S&&!Wd)?rad:0.01;
  g.beginPath();
  g.moveTo(x0+rNW,y0);
  g.lineTo(x1-rNE,y0); g.arcTo(x1,y0,x1,y0+rNE,rNE);
  g.lineTo(x1,y1-rSE); g.arcTo(x1,y1,x1-rSE,y1,rSE);
  g.lineTo(x0+rSW,y1); g.arcTo(x0,y1,x0,y1-rSW,rSW);
  g.lineTo(x0,y0+rNW); g.arcTo(x0,y0,x0+rNW,y0,rNW);
  g.closePath();
}
function rrd(g,x,y,w,h,r){
  g.beginPath();
  if(g.roundRect){g.roundRect(x,y,w,h,r);return;}
  g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();
}
/* stroke ONLY the exposed edges of a tile blob (interior seams between
   joined tiles stay invisible, so a building outlines as one shape) */
function strokeEdges(g,px,py,mask,inset,rad){
  const N=mask&1,E=mask&2,S=mask&4,Wd=mask&8;
  if(N&&E&&S&&Wd)return;
  const x0=px+(Wd?0:inset), x1=px+T-(E?0:inset);
  const y0=py+(N?0:inset), y1=py+T-(S?0:inset);
  const rNW=(!N&&!Wd)?rad:0, rNE=(!N&&!E)?rad:0,
        rSE=(!S&&!E)?rad:0, rSW=(!S&&!Wd)?rad:0;
  g.beginPath();
  if(!N){g.moveTo(x0+rNW,y0);g.lineTo(x1-rNE,y0);if(rNE)g.arcTo(x1,y0,x1,y0+rNE,rNE);}
  if(!E){if(N)g.moveTo(x1,y0);else if(!rNE)g.moveTo(x1,y0);g.lineTo(x1,y1-rSE);if(rSE)g.arcTo(x1,y1,x1-rSE,y1,rSE);}
  if(!S){if(E)g.moveTo(x1,y1);else if(!rSE)g.moveTo(x1-rSE,y1);g.lineTo(x0+rSW,y1);if(rSW)g.arcTo(x0,y1,x0,y1-rSW,rSW);}
  if(!Wd){if(S)g.moveTo(x0,y1);else if(!rSW)g.moveTo(x0,y1);g.lineTo(x0,y0+rNW);if(rNW)g.arcTo(x0,y0,x0+rNW,y0,rNW);}
  g.stroke();
}

/* ============ GROUND ============ */
function drawPath(g,px,py,mask,h){
  tilePath(g,px,py,mask,4,13);
  g.fillStyle="#ddd3bf";g.fill();
  g.strokeStyle="rgba(95,78,50,.28)";g.lineWidth=2;strokeEdges(g,px,py,mask,4,13);
  g.save();tilePath(g,px,py,mask,4,13);g.clip();
  // cobbles: soft 2x2 slabs with jitter
  const cs=["#e7ddc9","#d5c9b0","#e2d7c2","#cfc3a8"];
  for(let i=0;i<4;i++){
    const ox=(i%2)*22+3+(dhash(px+i,py)*4-2), oy=((i/2)|0)*22+3+(dhash(px,py+i)*4-2);
    g.fillStyle=cs[(i+((px/T+py/T)|0))%4];
    rrd(g,px+ox,py+oy,19,19,7);g.fill();
  }
  g.fillStyle="rgba(255,255,255,.22)";
  rrd(g,px+6,py+5,T-12,4,2);g.fill();
  g.fillStyle="rgba(95,78,50,.16)";
  g.fillRect(px,py+T-5,T,5);
  g.restore();
}
function drawFloor(g,px,py,mask,h){
  tilePath(g,px,py,mask,3,10);
  g.fillStyle="#d9a15e";g.fill();
  g.strokeStyle="rgba(120,70,25,.35)";g.lineWidth=2;strokeEdges(g,px,py,mask,3,10);
  g.save();tilePath(g,px,py,mask,3,10);g.clip();
  g.strokeStyle="rgba(140,85,30,.4)";g.lineWidth=1.6;
  for(let r=0;r<3;r++){
    const yy=py+8+r*16;
    g.beginPath();g.moveTo(px,yy);g.lineTo(px+T,yy);g.stroke();
    // plank end joints, offset per row
    const jx=px+((r%2)?12:30)+((dhash(px,py+r)*10)|0);
    g.beginPath();g.moveTo(jx,yy-16);g.lineTo(jx,yy);g.stroke();
  }
  g.fillStyle="rgba(255,255,255,.25)";
  rrd(g,px+5,py+4,T-10,3.5,2);g.fill();
  g.fillStyle="rgba(120,70,25,.28)";
  g.fillRect(px,py+T-5,T,5);
  g.restore();
}

/* ============ WALL (+ door / window embedded) ============
   2.5D: the wall blob has ONE flat light top surface (seen from above) and
   ONE tall continuous brick front face along the exposed SOUTH rim. Faces,
   shadows and rims only appear on exposed edges, and use world-aligned
   coords + full-width rects, so adjacent tiles fuse into a single building
   instead of reading as per-tile steps. */
/* RPG-facade wall: the whole tile is a flat front facade (like classic
   top-down RPG villages) — plaster with horizontal siding, corner trim
   boards on outer edges, and a short brick foundation at ground level. */
const FOUND_H=11;      // foundation strip height at the exposed south rim
function drawWallBody(g,px,py,mask,h){
  const N=mask&1,E=mask&2,S=mask&4,Wd=mask&8,RN=mask&32; // RN: roof directly above
  // continuous drop shadow under the exposed south rim (plain rect => rows merge)
  if(!S){
    g.fillStyle="rgba(30,20,8,.22)";
    g.fillRect(px,py+T,T+(!E?4:0),6);
    g.fillStyle="rgba(30,20,8,.12)";
    g.fillRect(px+(!Wd?3:0),py+T+6,T-(!Wd?3:0)+(!E?4:0),4);
  }
  // side shadow cast to the east (light from top-left => shadow falls right)
  if(!E){
    const eg2=g.createLinearGradient(px+T,py,px+T+7,py);
    eg2.addColorStop(0,"rgba(30,20,8,.18)");eg2.addColorStop(1,"rgba(30,20,8,0)");
    g.fillStyle=eg2;g.fillRect(px+T,py+(N?0:4),7,T-(N?0:4)+(!S?6:0));
  }
  tilePath(g,px,py,mask,2,9);
  g.save();g.clip();
  // facade base
  g.fillStyle="#f2e6c8";g.fillRect(px,py,T,T);
  // horizontal siding boards (world-aligned => continuous across tiles)
  g.strokeStyle="rgba(150,110,60,.16)";g.lineWidth=1.4;
  for(let yy=Math.ceil(py/10)*10;yy<py+T;yy+=10){
    g.beginPath();g.moveTo(px,yy);g.lineTo(px+T,yy);g.stroke();
    g.strokeStyle="rgba(255,252,240,.30)";
    g.beginPath();g.moveTo(px,yy+1.4);g.lineTo(px+T,yy+1.4);g.stroke();
    g.strokeStyle="rgba(150,110,60,.16)";
  }
  // eave shadow cast by the roof onto the facade
  if(RN){
    const sg=g.createLinearGradient(0,py,0,py+14);
    sg.addColorStop(0,"rgba(60,30,12,.42)");sg.addColorStop(1,"rgba(60,30,12,0)");
    g.fillStyle=sg;g.fillRect(px,py,T,14);
  }else if(!N){ // open wall top: simple cap board
    g.fillStyle="#d9bd8d";g.fillRect(px,py,T,7);
    g.fillStyle="rgba(255,252,240,.5)";g.fillRect(px,py,T,2);
    g.fillStyle="rgba(120,80,35,.3)";g.fillRect(px,py+6,T,1.6);
  }
  // corner trim boards on outer edges (classic RPG facade corners)
  if(!Wd){
    g.fillStyle="#e4cfa4";g.fillRect(px,py,6,T);
    g.fillStyle="rgba(255,252,240,.5)";g.fillRect(px,py,2,T);
    g.fillStyle="rgba(120,80,35,.25)";g.fillRect(px+5,py,1.5,T);
  }
  if(!E){
    g.fillStyle="#dbc294";g.fillRect(px+T-6,py,6,T);
    g.fillStyle="rgba(120,80,35,.35)";g.fillRect(px+T-1.5,py,1.5,T);
    g.fillStyle="rgba(255,252,240,.35)";g.fillRect(px+T-6,py,1.5,T);
  }
  // brick foundation strip at ground level
  if(!S){
    const fy=py+T-FOUND_H;
    const fg=g.createLinearGradient(0,fy,0,py+T);
    fg.addColorStop(0,"#c9a06b");fg.addColorStop(1,"#a87f4f");
    g.fillStyle=fg;g.fillRect(px,fy,T,FOUND_H);
    g.fillStyle="rgba(90,58,25,.35)";g.fillRect(px,fy,T,1.8);
    // brick joints (world-aligned)
    g.strokeStyle="rgba(120,80,35,.35)";g.lineWidth=1.4;
    g.beginPath();g.moveTo(px,fy+5.5);g.lineTo(px+T,fy+5.5);g.stroke();
    for(let xx=px;xx<px+T;xx+=12){
      g.beginPath();g.moveTo(xx+6,fy+1.8);g.lineTo(xx+6,fy+5.5);
      g.moveTo(xx,fy+5.5);g.lineTo(xx,py+T-2);g.stroke();
    }
    // grounding AO at the base
    g.fillStyle="rgba(30,18,6,.28)";g.fillRect(px,py+T-3,T,3);
  }
  g.restore();
  g.strokeStyle="rgba(100,60,25,.38)";g.lineWidth=2;strokeEdges(g,px,py,mask,2,9);
}
function drawWall(g,px,py,mask,h){drawWallBody(g,px,py,mask,h);}
function drawDoor(g,px,py,mask,h){
  drawWallBody(g,px,py,mask,h);
  // arched wooden door, seated in the wall
  const dx=px+12,dw=24,dby=py+T-3,dty=py+16;
  g.beginPath();
  g.moveTo(dx,dby);g.lineTo(dx,dty+10);
  g.quadraticCurveTo(dx,dty-2,dx+dw/2,dty-2);
  g.quadraticCurveTo(dx+dw,dty-2,dx+dw,dty+10);
  g.lineTo(dx+dw,dby);g.closePath();
  g.fillStyle="#a06a35";g.fill();
  g.strokeStyle="rgba(70,40,15,.55)";g.lineWidth=2;g.stroke();
  g.save();g.clip();
  g.strokeStyle="rgba(70,40,15,.35)";g.lineWidth=1.4;
  for(let i=1;i<3;i++){g.beginPath();g.moveTo(dx+i*dw/3,dty-2);g.lineTo(dx+i*dw/3,dby);g.stroke();}
  g.fillStyle="rgba(255,255,255,.18)";g.fillRect(dx,dty-2,dw,4);
  g.restore();
  g.fillStyle="#ffd66b";g.beginPath();g.arc(dx+dw-5.5,py+30,2.6,0,7);g.fill();
  g.strokeStyle="rgba(70,40,15,.5)";g.lineWidth=1;g.stroke();
}
function drawWindow(g,px,py,mask,h){
  drawWallBody(g,px,py,mask,h);
  const wx=px+11,wy=py+17,ww=26,wh=21;
  rrd(g,wx-2.5,wy-2.5,ww+5,wh+5,7);
  g.fillStyle="#f7edd4";g.fill();
  g.strokeStyle="rgba(100,60,25,.4)";g.lineWidth=1.8;g.stroke();
  rrd(g,wx,wy,ww,wh,5);
  const gl=g.createLinearGradient(0,wy,0,wy+wh);
  gl.addColorStop(0,"#bfe4ff");gl.addColorStop(1,"#7ec3f2");
  g.fillStyle=gl;g.fill();
  g.save();rrd(g,wx,wy,ww,wh,5);g.clip();
  g.strokeStyle="rgba(255,255,255,.55)";g.lineWidth=4;
  g.beginPath();g.moveTo(wx+4,wy+wh+3);g.lineTo(wx+ww-8,wy-3);g.stroke();
  g.restore();
  g.strokeStyle="#f7edd4";g.lineWidth=2.4;
  g.beginPath();g.moveTo(wx+ww/2,wy);g.lineTo(wx+ww/2,wy+wh);
  g.moveTo(wx,wy+wh/2);g.lineTo(wx+ww,wy+wh/2);g.stroke();
  // window box flowers
  g.fillStyle="#ff5d73";g.beginPath();g.arc(wx+5,wy+wh+4.5,2.2,0,7);g.arc(wx+ww-5,wy+wh+4.5,2.2,0,7);g.fill();
}

/* scalloped shingle edge along y=ey (world-aligned 12px pitch => continuous) */
function scallopPath(g,x0,x1,ey,close){
  g.beginPath();
  g.moveTo(x0,close?ey-7:ey);
  if(close)g.lineTo(x0,ey);
  for(let cx=x0+6;cx-6<x1;cx+=12)g.arc(cx,ey,6,Math.PI,0,true);
  if(close){g.lineTo(x1,ey-7);g.closePath();}
}

/* ============ ROOF (color variants share one machinery) ============ */
const ROOF_PAL={
  roof:  {lt:"#f08a67",dk:"#cd5540",tp:"#e2694f",ridge:"#f6ac8b",edge:"120,35,20",eave:"#b2412f"},
  roofB: {lt:"#8fc2ec",dk:"#4a86c4",tp:"#6aa7db",ridge:"#b4dcf6",edge:"28,66,112",eave:"#3d72ad"},
  roofG: {lt:"#88cf74",dk:"#4e9c46",tp:"#63b552",ridge:"#b0e79f",edge:"30,88,30", eave:"#3f8438"},
  roofP: {lt:"#bd97e6",dk:"#8a5fc0",tp:"#a279d4",ridge:"#dabdf5",edge:"74,44,116",eave:"#7550ac"},
};
function drawRoof(g,px,py,mask,h,pal){
  pal=pal||ROOF_PAL.roof;
  const N=mask&1,E=mask&2,S=mask&4,Wd=mask&8;
  const EDG=a=>"rgba("+pal.edge+","+a+")";
  // shadow the roof casts on the ground to its east (2.5D light from top-left)
  if(!E){
    const rg=g.createLinearGradient(px+T,py,px+T+8,py);
    rg.addColorStop(0,"rgba(30,20,8,.16)");rg.addColorStop(1,"rgba(30,20,8,0)");
    g.fillStyle=rg;g.fillRect(px+T,py+(N?0:6),8,T-(N?0:6));
  }
  tilePath(g,px,py,mask,2,11);
  const gr=g.createLinearGradient(0,py,0,py+T);
  gr.addColorStop(0,N?pal.tp:pal.lt);
  gr.addColorStop(1,S?pal.tp:pal.dk);
  g.fillStyle=gr;g.fill();
  g.save();tilePath(g,px,py,mask,2,11);g.clip();
  // shingle scallops, world-aligned so rows continue across tiles
  g.strokeStyle=EDG(".25");g.lineWidth=1.8;
  for(let r=0;r<4;r++){
    const yy=py+10+r*11, off=(r%2)?6:0;
    g.beginPath();
    for(let xx=px-12+off;xx<px+T+12;xx+=12)
      g.arc(xx+6,yy,6,Math.PI,0,true);
    g.stroke();
  }
  // ridge cap on exposed top
  if(!N){
    g.fillStyle=pal.ridge;
    const rx0=px+(Wd?-6:5), rx1=px+T-(E?-6:5);
    rrd(g,rx0,py+2.5,rx1-rx0,7,3.5);
    g.fill();
    g.fillStyle=EDG(".25");g.fillRect(px,py+10,T,1.6);
  }
  // eave lip on exposed bottom
  if(!S){g.fillStyle=EDG(".30");g.fillRect(px,py+T-8,T,8);}
  // rakes on exposed sides
  if(!E){g.fillStyle=EDG(".22");g.fillRect(px+T-5,py,5,T);}
  if(!Wd){g.fillStyle="rgba(255,255,255,.14)";g.fillRect(px,py,4,T);}
  g.restore();
  g.strokeStyle=EDG(".42");g.lineWidth=2;strokeEdges(g,px,py,mask,2,11);
  // wavy shingle eave: scallops hang over the wall below (fused) or past the
  // outer bottom edge, so the roof ends like real overlapping tiles
  const FW=mask&64;
  if(FW||!S){
    const ey=FW?py+T:py+T-2;
    g.fillStyle="rgba(60,25,12,.25)";
    scallopPath(g,px,px+T,ey+3,true);g.fill();
    const sg2=g.createLinearGradient(0,ey-7,0,ey+6);
    sg2.addColorStop(0,pal.dk);sg2.addColorStop(1,pal.eave);
    g.fillStyle=sg2;
    scallopPath(g,px,px+T,ey,true);g.fill();
    g.strokeStyle=EDG(".42");g.lineWidth=2;
    scallopPath(g,px,px+T,ey,false);g.stroke();
  }
}

/* ============ GLASS STOREFRONT (shops / malls) ============
   Same footprint machinery as the wall, but the facade is a big glazed
   panel with cream mullions that continue across tiles => a row reads as
   one long shop window. Cream frame + brick foundation tie it to houses. */
function drawGlass(g,px,py,mask,h){
  const N=mask&1,E=mask&2,S=mask&4,Wd=mask&8,RN=mask&32;
  if(!S){
    g.fillStyle="rgba(30,20,8,.22)";g.fillRect(px,py+T,T+(!E?4:0),6);
    g.fillStyle="rgba(30,20,8,.12)";g.fillRect(px+(!Wd?3:0),py+T+6,T-(!Wd?3:0)+(!E?4:0),4);
  }
  if(!E){
    const eg=g.createLinearGradient(px+T,py,px+T+7,py);
    eg.addColorStop(0,"rgba(30,20,8,.18)");eg.addColorStop(1,"rgba(30,20,8,0)");
    g.fillStyle=eg;g.fillRect(px+T,py+(N?0:4),7,T-(N?0:4)+(!S?6:0));
  }
  tilePath(g,px,py,mask,2,9);
  g.save();g.clip();
  g.fillStyle="#f2e6c8";g.fillRect(px,py,T,T);
  // glass panel
  const gy0=py+(N?0:9), gy1=py+T-(S?0:11);
  const gg=g.createLinearGradient(0,gy0,0,gy1);
  gg.addColorStop(0,"#c7e8ff");gg.addColorStop(1,"#79bced");
  g.fillStyle=gg;g.fillRect(px,gy0,T,gy1-gy0);
  // diagonal sheen streaks
  g.save();g.beginPath();g.rect(px,gy0,T,gy1-gy0);g.clip();
  g.strokeStyle="rgba(255,255,255,.4)";g.lineWidth=6;
  g.beginPath();g.moveTo(px-14,gy1+12);g.lineTo(px+26,gy0-12);
  g.moveTo(px+16,gy1+12);g.lineTo(px+56,gy0-12);g.stroke();
  g.restore();
  // eave shade if a roof sits above
  if(RN){const sg=g.createLinearGradient(0,py,0,py+14);sg.addColorStop(0,"rgba(60,30,12,.42)");sg.addColorStop(1,"rgba(60,30,12,0)");g.fillStyle=sg;g.fillRect(px,py,T,14);}
  // cream mullions (world-aligned vertical + one horizontal)
  g.fillStyle="#f2e6c8";
  for(let mx=Math.ceil((px-8)/16)*16;mx<px+T;mx+=16)g.fillRect(mx-1.5,gy0,3,gy1-gy0);
  g.fillRect(px,(gy0+gy1)/2-1.5,T,3);
  // brick foundation
  if(!S){
    const fy=py+T-11;
    const fg=g.createLinearGradient(0,fy,0,py+T);fg.addColorStop(0,"#c9a06b");fg.addColorStop(1,"#a87f4f");
    g.fillStyle=fg;g.fillRect(px,fy,T,11);
    g.fillStyle="rgba(90,58,25,.35)";g.fillRect(px,fy,T,1.8);
    g.strokeStyle="rgba(120,80,35,.35)";g.lineWidth=1.4;
    g.beginPath();g.moveTo(px,fy+5.5);g.lineTo(px+T,fy+5.5);g.stroke();
    for(let xx=px;xx<px+T;xx+=12){g.beginPath();g.moveTo(xx+6,fy+1.8);g.lineTo(xx+6,fy+5.5);g.moveTo(xx,fy+5.5);g.lineTo(xx,py+T-2);g.stroke();}
    g.fillStyle="rgba(30,18,6,.28)";g.fillRect(px,py+T-3,T,3);
  }
  // corner trim on outer edges
  if(!Wd){g.fillStyle="#e4cfa4";g.fillRect(px,py,6,T);g.fillStyle="rgba(255,252,240,.5)";g.fillRect(px,py,2,T);}
  if(!E){g.fillStyle="#dbc294";g.fillRect(px+T-6,py,6,T);g.fillStyle="rgba(120,80,35,.35)";g.fillRect(px+T-1.5,py,1.5,T);}
  if(!N&&!RN){g.fillStyle="#d9bd8d";g.fillRect(px,py,T,7);g.fillStyle="rgba(255,252,240,.5)";g.fillRect(px,py,T,2);}
  g.restore();
  g.strokeStyle="rgba(100,60,25,.38)";g.lineWidth=2;strokeEdges(g,px,py,mask,2,9);
}

/* ============ AWNING (striped shop canopy) ============ */
function drawAwning(g,px,py,mask,h){
  const N=mask&1,E=mask&2,S=mask&4,Wd=mask&8, FW=mask&64;
  if(!E){
    const rg=g.createLinearGradient(px+T,py,px+T+8,py);
    rg.addColorStop(0,"rgba(30,20,8,.16)");rg.addColorStop(1,"rgba(30,20,8,0)");
    g.fillStyle=rg;g.fillRect(px+T,py+(N?0:6),8,T-(N?0:6));
  }
  const STR=sx=>((Math.floor(sx/16))&1);
  tilePath(g,px,py,mask,2,10);
  g.save();g.clip();
  for(let sx=Math.floor(px/16)*16;sx<px+T;sx+=16){
    g.fillStyle=STR(sx)?"#e2624a":"#f4ede0";g.fillRect(sx,py-2,16,T+6);
  }
  if(!N){g.fillStyle="rgba(255,255,255,.3)";g.fillRect(px,py+2,T,4);
    g.fillStyle="rgba(120,35,20,.22)";g.fillRect(px,py+9,T,1.4);}
  g.restore();
  g.strokeStyle="rgba(120,35,20,.42)";g.lineWidth=2;strokeEdges(g,px,py,mask,2,10);
  // scalloped hanging valance (over the storefront below, or the outer edge)
  if(FW||!S){
    const ey=FW?py+T:py+T-2;
    g.fillStyle="rgba(60,25,12,.22)";scallopPath(g,px,px+T,ey+3,true);g.fill();
    g.save();scallopPath(g,px,px+T,ey,true);g.clip();
    for(let sx=Math.floor(px/16)*16;sx<px+T;sx+=16){
      g.fillStyle=STR(sx)?"#c9502f":"#e6ddca";g.fillRect(sx,ey-9,16,16);
    }
    g.restore();
    g.strokeStyle="rgba(120,35,20,.42)";g.lineWidth=1.8;scallopPath(g,px,px+T,ey,false);g.stroke();
  }
}

/* ============ SHOP SIGN (single tile) ============ */
function drawSign(g,px,py){
  const cx=px+T/2;
  g.fillStyle="rgba(0,0,0,.14)";g.beginPath();g.ellipse(cx,py+T-6,13,3,0,0,7);g.fill();
  g.fillStyle="#8a5a2c";g.fillRect(cx-15,py+13,4,27);g.fillRect(cx+11,py+13,4,27);
  const bg=g.createLinearGradient(0,py+7,0,py+31);bg.addColorStop(0,"#efc588");bg.addColorStop(1,"#c8934f");
  g.fillStyle=bg;rrd(g,cx-19,py+7,38,24,7);g.fill();
  g.strokeStyle="rgba(90,55,20,.6)";g.lineWidth=2.4;rrd(g,cx-19,py+7,38,24,7);g.stroke();
  g.fillStyle="rgba(255,255,255,.35)";rrd(g,cx-15,py+9,30,4,2);g.fill();
  // 4-point star emblem
  g.fillStyle="#7a4dff";
  g.save();g.translate(cx,py+19);
  g.beginPath();
  for(let i=0;i<8;i++){const a=i/8*6.283,r=(i%2)?3:8;g.lineTo(Math.cos(a)*r,Math.sin(a)*r);}
  g.closePath();g.fill();
  g.fillStyle="rgba(255,255,255,.85)";g.beginPath();g.arc(-1.5,-1.5,1.8,0,7);g.fill();
  g.restore();
}

/* ============ FENCE ============ */
function drawFence(g,px,py,mask,h){
  const cx=px+T/2, cy=py+T/2;
  const rail=(x1,y1,x2,y2)=>{
    g.strokeStyle="#7c4c22";g.lineWidth=7;g.lineCap="round";
    g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();
    g.strokeStyle="#c98d4b";g.lineWidth=4;
    g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();
  };
  if(mask&2){rail(cx,cy-7,px+T,cy-7);rail(cx,cy+6,px+T,cy+6);}
  if(mask&8){rail(px,cy-7,cx,cy-7);rail(px,cy+6,cx,cy+6);}
  if(mask&1){rail(cx-7,py,cx-7,cy);rail(cx+6,py,cx+6,cy);}
  if(mask&4){rail(cx-7,cy,cx-7,py+T);rail(cx+6,cy,cx+6,py+T);}
  // post (always at the node — reads as endpoint / corner / junction)
  g.fillStyle="rgba(0,0,0,.16)";
  g.beginPath();g.ellipse(cx,cy+16,9,3,0,0,7);g.fill();
  const pg=g.createLinearGradient(0,cy-17,0,cy+15);
  pg.addColorStop(0,"#d9a15e");pg.addColorStop(1,"#a06a35");
  g.fillStyle=pg;rrd(g,cx-6,cy-17,12,32,5);g.fill();
  g.strokeStyle="rgba(70,40,15,.45)";g.lineWidth=1.8;
  rrd(g,cx-6,cy-17,12,32,5);g.stroke();
  g.fillStyle="rgba(255,255,255,.3)";rrd(g,cx-4,cy-15,8,4,2);g.fill();
}

/* ============ HEDGE (bush) ============ */
function drawBush(g,px,py,mask,h){
  g.fillStyle="rgba(0,0,0,.13)";
  g.beginPath();g.ellipse(px+T/2,py+T-5,T*.4,4,0,0,7);g.fill();
  tilePath(g,px,py,mask,5,16);
  const gr=g.createLinearGradient(0,py,0,py+T);
  gr.addColorStop(0,"#5fbb54");gr.addColorStop(1,"#3d8c3c");
  g.fillStyle=gr;g.fill();
  g.save();tilePath(g,px,py,mask,5,16);g.clip();
  // leafy texture
  g.fillStyle="rgba(255,255,255,.16)";
  for(let i=0;i<5;i++){
    const lx=px+6+dhash(px+i,py)*(T-14), ly=py+5+dhash(px,py+i)*(T-22);
    g.beginPath();g.arc(lx,ly,3.2,0,7);g.fill();
  }
  g.fillStyle="rgba(20,70,20,.22)";g.fillRect(px,py+T-9,T,9);
  if(dhash(px+3,py+7)<.3){
    g.fillStyle="#ff5d73";
    g.beginPath();g.arc(px+14+dhash(px,py)*18,py+16,2.5,0,7);
    g.arc(px+24+dhash(py,px)*10,py+26,2.5,0,7);g.fill();
  }
  g.restore();
  g.strokeStyle="rgba(25,80,25,.4)";g.lineWidth=2;strokeEdges(g,px,py,mask,5,16);
}

/* ============ single-tile decor (no autotile, but crisp + on-style) ============ */
function drawFlower(g,px,py,mask,h){
  const cx=px+T/2, sway=0;
  g.fillStyle="rgba(0,0,0,.12)";
  g.beginPath();g.ellipse(cx,py+T-6,7,2.5,0,0,7);g.fill();
  g.strokeStyle="#3d8c3c";g.lineWidth=3;g.lineCap="round";
  g.beginPath();g.moveTo(cx,py+T-7);g.quadraticCurveTo(cx+2,py+30,cx,py+22);g.stroke();
  g.fillStyle="#54b04a";
  g.beginPath();g.ellipse(cx-5,py+34,5,2.6,-.5,0,7);g.fill();
  g.fillStyle="#ff8fb0";
  for(let i=0;i<5;i++){
    const a=i/5*6.283-1.57;
    g.beginPath();g.ellipse(cx+Math.cos(a)*6,py+18+Math.sin(a)*6,4.6,3.2,a,0,7);g.fill();
  }
  g.fillStyle="#ffd66b";g.beginPath();g.arc(cx,py+18,3.6,0,7);g.fill();
  g.strokeStyle="rgba(160,90,20,.5)";g.lineWidth=1;g.stroke();
}
function drawLamp(g,px,py,mask,h){
  const cx=px+T/2;
  g.fillStyle="rgba(0,0,0,.16)";
  g.beginPath();g.ellipse(cx,py+T-5,9,3,0,0,7);g.fill();
  g.fillStyle="#3a3153";rrd(g,cx-2.5,py+16,5,26,2.5);g.fill();
  rrd(g,cx-8,py+T-8,16,5,2.5);g.fill();
  // warm glow
  const glow=g.createRadialGradient(cx,py+12,2,cx,py+12,16);
  glow.addColorStop(0,"rgba(255,214,107,.55)");glow.addColorStop(1,"rgba(255,214,107,0)");
  g.fillStyle=glow;g.beginPath();g.arc(cx,py+12,16,0,7);g.fill();
  const lg=g.createLinearGradient(0,py+4,0,py+20);
  lg.addColorStop(0,"#ffe49a");lg.addColorStop(1,"#ffb830");
  g.fillStyle=lg;g.beginPath();g.arc(cx,py+12,8,0,7);g.fill();
  g.strokeStyle="rgba(140,80,10,.5)";g.lineWidth=1.8;g.stroke();
  g.fillStyle="#3a3153";rrd(g,cx-5,py+2,10,4,2);g.fill();
}
function drawFountain(g,px,py,mask,h,t){
  const cx=px+T/2, cy=py+T/2+4;
  g.fillStyle="rgba(0,0,0,.14)";
  g.beginPath();g.ellipse(cx,py+T-4,16,4,0,0,7);g.fill();
  // basin
  g.fillStyle="#b9b4c4";g.beginPath();g.ellipse(cx,cy+6,19,10,0,0,7);g.fill();
  g.strokeStyle="rgba(60,55,80,.4)";g.lineWidth=2;g.stroke();
  g.fillStyle="#8f8aa0";g.beginPath();g.ellipse(cx,cy+4,16,8,0,0,7);g.fill();
  const wg=g.createLinearGradient(0,cy-4,0,cy+10);
  wg.addColorStop(0,"#8fd0ff");wg.addColorStop(1,"#4aa3e8");
  g.fillStyle=wg;g.beginPath();g.ellipse(cx,cy+4,13.5,6.4,0,0,7);g.fill();
  // animated jet + ripples
  const ph=t?Math.sin(t/260):0;
  g.strokeStyle="rgba(255,255,255,.75)";g.lineWidth=3;g.lineCap="round";
  g.beginPath();g.moveTo(cx,cy+2);g.quadraticCurveTo(cx-4,py+10,cx,py+7+ph*1.5);g.stroke();
  g.beginPath();g.moveTo(cx,cy+2);g.quadraticCurveTo(cx+4,py+11,cx+1,py+9-ph*1.5);g.stroke();
  g.fillStyle="rgba(255,255,255,.8)";
  g.beginPath();g.arc(cx-3,py+9+ph,1.6,0,7);g.arc(cx+4,py+11-ph,1.4,0,7);g.fill();
  g.strokeStyle="rgba(255,255,255,.4)";g.lineWidth=1.4;
  g.beginPath();g.ellipse(cx,cy+4,7+ (ph+1)*2,3+(ph+1),0,0,7);g.stroke();
}
function drawGem(g,px,py,mask,h,t){
  const cx=px+T/2, cy=py+T/2, bob=t?Math.sin(t/420+px)*2:0;
  g.fillStyle="rgba(0,0,0,.14)";
  g.beginPath();g.ellipse(cx,py+T-6,8,2.6,0,0,7);g.fill();
  g.save();g.translate(cx,cy+bob-2);
  g.fillStyle="#6fe0d8";
  g.beginPath();g.moveTo(0,-13);g.lineTo(10,-4);g.lineTo(0,13);g.lineTo(-10,-4);g.closePath();g.fill();
  g.fillStyle="rgba(255,255,255,.45)";
  g.beginPath();g.moveTo(0,-13);g.lineTo(10,-4);g.lineTo(0,-1);g.closePath();g.fill();
  g.fillStyle="rgba(20,120,110,.35)";
  g.beginPath();g.moveTo(0,13);g.lineTo(-10,-4);g.lineTo(0,-1);g.closePath();g.fill();
  g.strokeStyle="rgba(15,110,100,.5)";g.lineWidth=1.6;
  g.beginPath();g.moveTo(0,-13);g.lineTo(10,-4);g.lineTo(0,13);g.lineTo(-10,-4);g.closePath();g.stroke();
  g.restore();
}

/* ============ extra single-tile props (crisp, toy style) ============ */
function drawBench(g,px,py){
  const cx=px+T/2, sy=py+T/2;
  g.fillStyle="rgba(0,0,0,.14)";g.beginPath();g.ellipse(cx,py+T-6,17,3.5,0,0,7);g.fill();
  g.fillStyle="#7c4c22";g.fillRect(cx-15,sy+2,4,14);g.fillRect(cx+11,sy+2,4,14);
  const bg=g.createLinearGradient(0,sy-6,0,sy+6);bg.addColorStop(0,"#d9a15e");bg.addColorStop(1,"#b57e40");
  g.fillStyle=bg;rrd(g,cx-19,sy-4,38,9,4);g.fill();
  g.strokeStyle="rgba(70,40,15,.5)";g.lineWidth=1.8;rrd(g,cx-19,sy-4,38,9,4);g.stroke();
  rrd(g,cx-19,sy-16,38,8,4);g.fillStyle=bg;g.fill();g.stroke();
  g.fillStyle="rgba(255,255,255,.3)";rrd(g,cx-16,sy-15,32,2.5,1.5);g.fill();
}
function drawTable(g,px,py){
  const cx=px+T/2, cy=py+T/2+3;
  g.fillStyle="rgba(0,0,0,.14)";g.beginPath();g.ellipse(cx,py+T-6,15,3.5,0,0,7);g.fill();
  g.fillStyle="#7c4c22";g.fillRect(cx-2.5,cy,5,16);
  const tg=g.createLinearGradient(0,cy-12,0,cy+2);tg.addColorStop(0,"#e0ac68");tg.addColorStop(1,"#c08a48");
  g.fillStyle=tg;g.beginPath();g.ellipse(cx,cy-4,17,9,0,0,7);g.fill();
  g.strokeStyle="rgba(70,40,15,.5)";g.lineWidth=2;g.stroke();
  g.strokeStyle="rgba(120,75,30,.35)";g.lineWidth=1.2;
  g.beginPath();g.ellipse(cx,cy-4,11,5.5,0,0,7);g.stroke();
  g.fillStyle="rgba(255,255,255,.3)";g.beginPath();g.ellipse(cx-4,cy-7,6,2.2,-.4,0,7);g.fill();
}
function drawBarrel(g,px,py){
  const cx=px+T/2, by=py+9;
  g.fillStyle="rgba(0,0,0,.15)";g.beginPath();g.ellipse(cx,py+T-5,12,3.5,0,0,7);g.fill();
  const bg=g.createLinearGradient(cx-12,0,cx+12,0);
  bg.addColorStop(0,"#a06a35");bg.addColorStop(.5,"#d9a15e");bg.addColorStop(1,"#8a5a2c");
  g.fillStyle=bg;rrd(g,cx-12,by,24,32,7);g.fill();
  g.strokeStyle="rgba(70,40,15,.5)";g.lineWidth=2;rrd(g,cx-12,by,24,32,7);g.stroke();
  g.fillStyle="#6b6f7a";g.fillRect(cx-12,by+6,24,3.5);g.fillRect(cx-12,by+22,24,3.5);
  g.fillStyle="rgba(255,255,255,.25)";rrd(g,cx-8,by+3,4,26,2);g.fill();
  g.strokeStyle="rgba(70,40,15,.3)";g.lineWidth=1.2;
  g.beginPath();g.moveTo(cx,by+2);g.lineTo(cx,by+30);g.stroke();
}
function drawCrate(g,px,py){
  const cx=px+T/2, cy=py+T/2+2;
  g.fillStyle="rgba(0,0,0,.15)";g.beginPath();g.ellipse(cx,py+T-5,13,3.5,0,0,7);g.fill();
  const cg=g.createLinearGradient(0,cy-14,0,cy+14);cg.addColorStop(0,"#d9a15e");cg.addColorStop(1,"#b07a3e");
  g.fillStyle=cg;rrd(g,cx-14,cy-14,28,28,4);g.fill();
  g.strokeStyle="rgba(70,40,15,.55)";g.lineWidth=2.2;rrd(g,cx-14,cy-14,28,28,4);g.stroke();
  g.lineWidth=1.6;g.strokeStyle="rgba(70,40,15,.4)";
  g.beginPath();g.moveTo(cx-14,cy-5);g.lineTo(cx+14,cy-5);g.moveTo(cx-14,cy+5);g.lineTo(cx+14,cy+5);g.stroke();
  g.beginPath();g.moveTo(cx-13,cy-13);g.lineTo(cx+13,cy+13);g.stroke();
  g.fillStyle="rgba(255,255,255,.28)";rrd(g,cx-11,cy-12,22,3,1.5);g.fill();
}
function drawWell(g,px,py){
  const cx=px+T/2;
  g.fillStyle="rgba(0,0,0,.15)";g.beginPath();g.ellipse(cx,py+T-4,16,4,0,0,7);g.fill();
  // stone ring
  g.fillStyle="#b9b4c4";g.beginPath();g.ellipse(cx,py+T-12,16,9,0,0,7);g.fill();
  g.strokeStyle="rgba(60,55,80,.45)";g.lineWidth=2;g.stroke();
  g.fillStyle="#2a5d8f";g.beginPath();g.ellipse(cx,py+T-13,11,5.5,0,0,7);g.fill();
  g.fillStyle="rgba(255,255,255,.35)";g.beginPath();g.ellipse(cx-3,py+T-14,4,1.6,0,0,7);g.fill();
  // posts + little roof
  g.fillStyle="#8a5a2c";g.fillRect(cx-13,py+12,4,22);g.fillRect(cx+9,py+12,4,22);
  const rg=g.createLinearGradient(0,py+4,0,py+16);rg.addColorStop(0,"#f08a67");rg.addColorStop(1,"#cd5540");
  g.fillStyle=rg;
  g.beginPath();g.moveTo(cx-19,py+16);g.lineTo(cx,py+3);g.lineTo(cx+19,py+16);g.closePath();g.fill();
  g.strokeStyle="rgba(120,35,20,.45)";g.lineWidth=2;g.stroke();
  // crank + bucket
  g.strokeStyle="#5a4020";g.lineWidth=2;
  g.beginPath();g.moveTo(cx,py+16);g.lineTo(cx,py+26);g.stroke();
  g.fillStyle="#6b6f7a";rrd(g,cx-4,py+26,8,6,2);g.fill();
}
function drawMailbox(g,px,py){
  const cx=px+T/2;
  g.fillStyle="rgba(0,0,0,.13)";g.beginPath();g.ellipse(cx,py+T-6,9,2.8,0,0,7);g.fill();
  g.fillStyle="#8a5a2c";g.fillRect(cx-2,py+22,4,20);
  const mg=g.createLinearGradient(0,py+8,0,py+24);mg.addColorStop(0,"#6aa7db");mg.addColorStop(1,"#4a86c4");
  g.fillStyle=mg;rrd(g,cx-11,py+8,22,15,7);g.fill();
  g.strokeStyle="rgba(28,66,112,.5)";g.lineWidth=2;rrd(g,cx-11,py+8,22,15,7);g.stroke();
  g.fillStyle="rgba(255,255,255,.3)";rrd(g,cx-8,py+10,16,3,1.5);g.fill();
  g.fillStyle="#f4ede0";rrd(g,cx-5,py+13,10,6,1.5);g.fill();
  g.fillStyle="#e2624a";g.fillRect(cx+8,py+6,2.5,8);
  g.beginPath();g.moveTo(cx+10.5,py+6);g.lineTo(cx+16,py+8.5);g.lineTo(cx+10.5,py+11);g.closePath();g.fill();
}
function drawStatue(g,px,py){
  const cx=px+T/2;
  g.fillStyle="rgba(0,0,0,.15)";g.beginPath();g.ellipse(cx,py+T-5,13,3.5,0,0,7);g.fill();
  // plinth
  const pg=g.createLinearGradient(0,py+30,0,py+T-6);pg.addColorStop(0,"#c6c1d1");pg.addColorStop(1,"#9a95aa");
  g.fillStyle=pg;rrd(g,cx-12,py+30,24,13,3);g.fill();
  g.strokeStyle="rgba(60,55,80,.45)";g.lineWidth=2;rrd(g,cx-12,py+30,24,13,3);g.stroke();
  // robot statue (matches the game's robots, in stone)
  g.fillStyle="#b9b4c4";rrd(g,cx-9,py+10,18,20,7);g.fill();
  g.strokeStyle="rgba(60,55,80,.45)";g.lineWidth=2;rrd(g,cx-9,py+10,18,20,7);g.stroke();
  g.fillStyle="#8f8aa0";g.beginPath();g.arc(cx-4,py+18,3,0,7);g.arc(cx+4,py+18,3,0,7);g.fill();
  g.strokeStyle="#8f8aa0";g.lineWidth=2.4;g.beginPath();g.moveTo(cx,py+10);g.lineTo(cx,py+5);g.stroke();
  g.fillStyle="#b9b4c4";g.beginPath();g.arc(cx,py+4,2.6,0,7);g.fill();
  g.fillStyle="rgba(255,255,255,.35)";rrd(g,cx-6,py+12,12,3,1.5);g.fill();
}
function drawFlag(g,px,py,mask,h,t){
  const cx=px+T/2, wav=t?Math.sin(t/300)*2:0;
  g.fillStyle="rgba(0,0,0,.13)";g.beginPath();g.ellipse(cx-8,py+T-5,7,2.5,0,0,7);g.fill();
  g.fillStyle="#6b6f7a";g.fillRect(cx-10,py+4,4,38);
  g.fillStyle="#d3d6dd";g.beginPath();g.arc(cx-8,py+4,3,0,7);g.fill();
  const fg=g.createLinearGradient(0,py+7,0,py+22);fg.addColorStop(0,"#9b6bff");fg.addColorStop(1,"#7a4dff");
  g.fillStyle=fg;
  g.beginPath();g.moveTo(cx-6,py+7);
  g.quadraticCurveTo(cx+8,py+9+wav,cx+18,py+8+wav);
  g.lineTo(cx+14,py+15+wav*.5);g.lineTo(cx+18,py+22+wav);
  g.quadraticCurveTo(cx+8,py+21+wav,cx-6,py+23);g.closePath();g.fill();
  g.strokeStyle="rgba(60,30,140,.4)";g.lineWidth=1.8;g.stroke();
  g.fillStyle="rgba(255,255,255,.5)";g.beginPath();g.arc(cx+3,py+15+wav*.5,3,0,7);g.fill();
}
function drawStall(g,px,py){
  const cx=px+T/2;
  g.fillStyle="rgba(0,0,0,.15)";g.beginPath();g.ellipse(cx,py+T-4,19,4,0,0,7);g.fill();
  // counter
  const bg=g.createLinearGradient(0,py+26,0,py+T-6);bg.addColorStop(0,"#d9a15e");bg.addColorStop(1,"#a06a35");
  g.fillStyle=bg;rrd(g,cx-19,py+26,38,17,4);g.fill();
  g.strokeStyle="rgba(70,40,15,.5)";g.lineWidth=2;rrd(g,cx-19,py+26,38,17,4);g.stroke();
  // goods
  g.fillStyle="#ff5d73";g.beginPath();g.arc(cx-10,py+26,4,0,7);g.fill();
  g.fillStyle="#ffd66b";g.beginPath();g.arc(cx-1,py+25,4,0,7);g.fill();
  g.fillStyle="#88cf74";g.beginPath();g.arc(cx+9,py+26,4,0,7);g.fill();
  // striped canopy
  g.save();g.beginPath();g.moveTo(cx-22,py+18);g.lineTo(cx+22,py+18);g.lineTo(cx+18,py+5);g.lineTo(cx-18,py+5);g.closePath();g.clip();
  for(let i=-3;i<4;i++){g.fillStyle=(i&1)?"#f4ede0":"#e2624a";g.fillRect(cx+i*8-4,py+3,8,17);}
  g.restore();
  g.strokeStyle="rgba(120,35,20,.45)";g.lineWidth=2;
  g.beginPath();g.moveTo(cx-22,py+18);g.lineTo(cx+22,py+18);g.lineTo(cx+18,py+5);g.lineTo(cx-18,py+5);g.closePath();g.stroke();
  // posts
  g.fillStyle="#8a5a2c";g.fillRect(cx-18,py+18,3.5,10);g.fillRect(cx+14.5,py+18,3.5,10);
}
function drawPlanter(g,px,py){
  const cx=px+T/2, byy=py+T-16;
  g.fillStyle="rgba(0,0,0,.13)";g.beginPath();g.ellipse(cx,py+T-5,15,3,0,0,7);g.fill();
  const bg=g.createLinearGradient(0,byy,0,py+T-6);bg.addColorStop(0,"#c98d4b");bg.addColorStop(1,"#8a5a2c");
  g.fillStyle=bg;rrd(g,cx-16,byy,32,12,3);g.fill();
  g.strokeStyle="rgba(70,40,15,.5)";g.lineWidth=1.8;rrd(g,cx-16,byy,32,12,3);g.stroke();
  g.fillStyle="#54b04a";
  for(let i=0;i<4;i++){g.beginPath();g.arc(cx-12+i*8,byy-2,4.5,0,7);g.fill();}
  const cols=["#ff5d73","#ffd66b","#ff8fb0","#9b6bff"];
  for(let i=0;i<4;i++){g.fillStyle=cols[i];g.beginPath();g.arc(cx-12+i*8,byy-6,3.2,0,7);g.fill();
    g.fillStyle="rgba(255,255,255,.5)";g.beginPath();g.arc(cx-13+i*8,byy-7,1.1,0,7);g.fill();}
}
function drawRug(g,px,py){
  g.fillStyle="rgba(0,0,0,.08)";rrd(g,px+4,py+6,T-8,T-9,7);g.fill();
  const rg=g.createLinearGradient(0,py,0,py+T);rg.addColorStop(0,"#b47ae2");rg.addColorStop(1,"#8a5fc0");
  g.fillStyle=rg;rrd(g,px+3,py+4,T-6,T-9,7);g.fill();
  g.strokeStyle="rgba(74,44,116,.5)";g.lineWidth=2;rrd(g,px+3,py+4,T-6,T-9,7);g.stroke();
  g.strokeStyle="rgba(255,255,255,.35)";g.lineWidth=1.6;rrd(g,px+8,py+9,T-16,T-19,4);g.stroke();
  g.fillStyle="#ffd66b";
  g.save();g.translate(px+T/2,py+T/2-1);
  g.beginPath();for(let i=0;i<8;i++){const a=i/8*6.283,r=(i%2)?2.4:6;g.lineTo(Math.cos(a)*r,Math.sin(a)*r);}g.closePath();g.fill();
  g.restore();
}
function drawCampfire(g,px,py,mask,h,t){
  const cx=px+T/2, cy=py+T-14, fl=t?Math.sin(t/140)*2:0;
  g.fillStyle="rgba(0,0,0,.15)";g.beginPath();g.ellipse(cx,py+T-6,13,3.5,0,0,7);g.fill();
  // stone ring
  g.fillStyle="#9a95aa";
  for(let i=0;i<7;i++){const a=i/7*6.283;g.beginPath();g.arc(cx+Math.cos(a)*13,cy+4+Math.sin(a)*5,3.4,0,7);g.fill();}
  // logs
  g.strokeStyle="#8a5a2c";g.lineWidth=5;g.lineCap="round";
  g.beginPath();g.moveTo(cx-8,cy+6);g.lineTo(cx+8,cy+1);g.moveTo(cx-8,cy+1);g.lineTo(cx+8,cy+6);g.stroke();
  // glow + flame
  const glow=g.createRadialGradient(cx,cy-2,2,cx,cy-2,18);
  glow.addColorStop(0,"rgba(255,180,60,.5)");glow.addColorStop(1,"rgba(255,180,60,0)");
  g.fillStyle=glow;g.beginPath();g.arc(cx,cy-2,18,0,7);g.fill();
  g.fillStyle="#ff9b3d";
  g.beginPath();g.moveTo(cx,cy-16-fl);g.quadraticCurveTo(cx+9,cy-6,cx,cy+3);g.quadraticCurveTo(cx-9,cy-6,cx,cy-16-fl);g.fill();
  g.fillStyle="#ffd66b";
  g.beginPath();g.moveTo(cx,cy-8-fl*.6);g.quadraticCurveTo(cx+5,cy-3,cx,cy+2);g.quadraticCurveTo(cx-5,cy-3,cx,cy-8-fl*.6);g.fill();
}

const DRAW={path:drawPath,floor:drawFloor,wall:drawWall,door:drawDoor,window:drawWindow,
  roof:drawRoof,fence:drawFence,bush:drawBush,flower:drawFlower,lamp:drawLamp,
  fountain:drawFountain,gem:drawGem,
  roofBlue:(g,x,y,m,h)=>drawRoof(g,x,y,m,h,ROOF_PAL.roofB),
  roofGreen:(g,x,y,m,h)=>drawRoof(g,x,y,m,h,ROOF_PAL.roofG),
  roofPurple:(g,x,y,m,h)=>drawRoof(g,x,y,m,h,ROOF_PAL.roofP),
  glass:drawGlass,awning:drawAwning,sign:drawSign,
  bench:drawBench,table:drawTable,barrel:drawBarrel,crate:drawCrate,well:drawWell,
  mailbox:drawMailbox,statue:drawStatue,flag:drawFlag,stall:drawStall,
  planter:drawPlanter,rug:drawRug,campfire:drawCampfire};

/* which groups behave as roof-over-wall for cross-group fusion */
const ROOFISH={roof:1,roofB:1,roofG:1,roofP:1,awning:1};
const WALLISH={wall:1,glass:1};

/* icon previews for the build palette — rendered from the same draw fns */
const iconCache={};
function icon(id,variant){
  const k=id+(variant||"");
  if(iconCache[k])return iconCache[k];
  const c=document.createElement("canvas");c.width=c.height=96;
  const g=c.getContext("2d");g.scale(2,2);
  const fn=DRAW[id];if(!fn)return null;
  /* preview walls/roofs/paths as a horizontal run so kids see they connect */
  const mask=(id==="wall"||id==="roof"||id==="path"||id==="floor"||id==="bush"||id==="fence"||id==="roofBlue"||id==="roofGreen"||id==="roofPurple"||id==="glass"||id==="awning")?10:0; // E+W
  fn(g,0,0,mask,.5,0);
  iconCache[k]=c.toDataURL();
  return iconCache[k];
}

window.CC_DECOR={
  LAYER, GROUP,
  layer:id=>LAYER[id]||null,
  draw(g,id,x,y,t){
    const fn=DRAW[id];if(!fn)return false;
    const gp=GROUP[id];
    let m=gp?maskAt(x,y,gp):0;
    // cross-group bits: a roof/awning fuses onto the wall/glass below it just
    // like a wall-to-wall join (shared edge vanishes); the wall top under it
    // falls into the roof's shade
    if(ROOFISH[gp]&&WALLISH[grpAt(x,y+1)])m|=4|64;
    if(WALLISH[gp]&&ROOFISH[grpAt(x,y-1)])m|=1|32;
    fn(g,x*T,y*T,m,dhash(x,y),t);
    return true;
  },
  icon
};
})();
