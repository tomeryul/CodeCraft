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
const GROUP={wall:"wall",door:"wall",window:"wall",roof:"roof",fence:"fence",path:"path",floor:"floor",bush:"bush"};
/* which render layer owns each piece */
const LAYER={path:"ground",floor:"ground",roof:"roof",
  wall:"mid",door:"mid",window:"mid",fence:"mid",bush:"mid",
  lamp:"mid",fountain:"mid",gem:"mid",flower:"mid"};

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

/* ============ GROUND ============ */
function drawPath(g,px,py,mask,h){
  tilePath(g,px,py,mask,4,13);
  g.fillStyle="#ddd3bf";g.fill();
  g.strokeStyle="rgba(95,78,50,.28)";g.lineWidth=2;g.stroke();
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
  g.strokeStyle="rgba(120,70,25,.35)";g.lineWidth=2;g.stroke();
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
const FACE_Y=.42;      // front face starts at this fraction of the tile
function drawWallBody(g,px,py,mask,h){
  const N=mask&1,E=mask&2,S=mask&4,Wd=mask&8;
  // continuous drop shadow under the exposed south rim (plain rect => rows merge)
  if(!S){
    g.fillStyle="rgba(30,20,8,.18)";
    g.fillRect(px,py+T,T+(!E?3:0),5);
    g.fillStyle="rgba(30,20,8,.10)";
    g.fillRect(px+2,py+T+5,T+(!E?3:0)-2,3);
  }
  tilePath(g,px,py,mask,2,9);
  g.save();g.clip();
  // flat top surface — uniform across the whole blob
  g.fillStyle="#f2e6c8";g.fillRect(px,py,T,T);
  // faint plaster texture on the top
  g.fillStyle="rgba(160,120,70,.10)";
  if(dhash(px,py)<.5)g.fillRect(px+8+dhash(px,py)*20,py+6+dhash(py,px)*14,7,7);
  // lit rim along exposed north / west (light from top-left)
  if(!N){g.fillStyle="rgba(255,252,240,.65)";g.fillRect(px,py,T,3);}
  if(!Wd){g.fillStyle="rgba(255,252,240,.4)";g.fillRect(px,py,3,T);}
  // shaded rim along exposed east
  if(!E){g.fillStyle="rgba(120,80,35,.22)";g.fillRect(px+T-4,py,4,T);}
  // tall brick front face along the exposed south rim
  if(!S){
    const fy=py+T*FACE_Y, fh=py+T-fy;
    const fg=g.createLinearGradient(0,fy,0,py+T);
    fg.addColorStop(0,"#e0c491");fg.addColorStop(1,"#b28d5b");
    g.fillStyle=fg;g.fillRect(px,fy,T,fh);
    // cornice line where top meets face
    g.fillStyle="rgba(90,58,25,.35)";g.fillRect(px,fy,T,2);
    g.fillStyle="rgba(255,250,235,.35)";g.fillRect(px,fy+2,T,1.5);
    // brick courses on the FACE (world-aligned => continuous across tiles)
    g.strokeStyle="rgba(120,80,35,.30)";g.lineWidth=1.5;
    for(let yy=fy+9;yy<py+T-3;yy+=9){
      g.beginPath();g.moveTo(px,yy);g.lineTo(px+T,yy);g.stroke();
      const row=Math.round((yy-fy)/9), off=(row%2)?0:12;
      for(let xx=px+off;xx<px+T;xx+=24){
        g.beginPath();g.moveTo(xx,yy);g.lineTo(xx,Math.min(yy+9,py+T-3));g.stroke();
      }
    }
    // grounding AO at the base
    g.fillStyle="rgba(30,18,6,.28)";g.fillRect(px,py+T-3.5,T,3.5);
  }
  g.restore();
  tilePath(g,px,py,mask,2,9);
  g.strokeStyle="rgba(100,60,25,.38)";g.lineWidth=2;g.stroke();
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

/* ============ ROOF ============ */
function drawRoof(g,px,py,mask,h){
  const N=mask&1,E=mask&2,S=mask&4,Wd=mask&8;
  // roof sits ABOVE the walls: shadow under the exposed eave first, then
  // the whole roof is drawn lifted up a few px so it reads as elevated.
  const LIFT=6;
  if(!S){g.fillStyle="rgba(30,18,6,.26)";g.fillRect(px,py+T-LIFT,T,LIFT+3);}
  g.save();g.translate(0,-LIFT);
  tilePath(g,px,py,mask,2,11);
  const gr=g.createLinearGradient(0,py,0,py+T);
  gr.addColorStop(0,N?"#e2694f":"#f08a67");
  gr.addColorStop(1,S?"#e2694f":"#cd5540");
  g.fillStyle=gr;g.fill();
  g.save();tilePath(g,px,py,mask,2,11);g.clip();
  // shingle scallops, world-aligned so rows continue across tiles
  g.strokeStyle="rgba(120,35,20,.25)";g.lineWidth=1.8;
  for(let r=0;r<4;r++){
    const yy=py+10+r*11, off=(r%2)?6:0;
    g.beginPath();
    for(let xx=px-12+off;xx<px+T+12;xx+=12)
      g.arc(xx+6,yy,6,Math.PI,0,true);
    g.stroke();
  }
  // ridge cap on exposed top
  if(!N){
    g.fillStyle="#f6ac8b";
    const rx0=px+(Wd?-6:5), rx1=px+T-(E?-6:5);
    rrd(g,rx0,py+2.5,rx1-rx0,7,3.5);
    g.fill();
    g.fillStyle="rgba(120,35,20,.25)";g.fillRect(px,py+10,T,1.6);
  }
  // eave lip on exposed bottom
  if(!S){g.fillStyle="rgba(110,28,16,.38)";g.fillRect(px,py+T-6,T,6);}
  // rakes on exposed sides
  if(!E){g.fillStyle="rgba(110,28,16,.22)";g.fillRect(px+T-5,py,5,T);}
  if(!Wd){g.fillStyle="rgba(255,255,255,.14)";g.fillRect(px,py,4,T);}
  g.restore();
  tilePath(g,px,py,mask,2,11);
  g.strokeStyle="rgba(120,35,20,.42)";g.lineWidth=2;g.stroke();
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
  tilePath(g,px,py,mask,5,16);
  g.strokeStyle="rgba(25,80,25,.4)";g.lineWidth=2;g.stroke();
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

const DRAW={path:drawPath,floor:drawFloor,wall:drawWall,door:drawDoor,window:drawWindow,
  roof:drawRoof,fence:drawFence,bush:drawBush,flower:drawFlower,lamp:drawLamp,
  fountain:drawFountain,gem:drawGem};

/* icon previews for the build palette — rendered from the same draw fns */
const iconCache={};
function icon(id,variant){
  const k=id+(variant||"");
  if(iconCache[k])return iconCache[k];
  const c=document.createElement("canvas");c.width=c.height=96;
  const g=c.getContext("2d");g.scale(2,2);
  const fn=DRAW[id];if(!fn)return null;
  /* preview walls/roofs/paths as a horizontal run so kids see they connect */
  const mask=(id==="wall"||id==="roof"||id==="path"||id==="floor"||id==="bush"||id==="fence")?10:0; // E+W
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
    fn(g,x*T,y*T,gp?maskAt(x,y,gp):0,dhash(x,y),t);
    return true;
  },
  icon
};
})();
