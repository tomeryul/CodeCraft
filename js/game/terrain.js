"use strict";
/* =====================================================================
   The lie of the land
   ---------------------------------------------------------------------
   The world was a sheet of squares: grass, sand and water met in
   staircases, every tile the same flat fill, and nothing said which was
   higher than which. Everything standing ON it — the robot, the trees,
   the houses — had long since been drawn with care, so the ground was
   the one part of the picture that still looked like a placeholder.

   The seed already knows the shape of the land: it is a height map cut at
   three levels (world.js), so water < sand < grass < rock is not only a
   list of types, it is how high each tile stands. This file draws it that
   way — as terraces:

     water   deep, then two bands of shallows hugging every coast
     sand    the beach, darker where it is wet
     grass   a plateau that stands a little above the sand, on a face of
             soil that shows along its southern edges
     rock    a second, higher step, on a face of stone

   and every outline is rounded: an outward corner is cut back (R), an
   inward one is filled in (RC), so a coast is a curve and not a
   staircase.

   What does NOT change is the grid. A tile is still a 48px square and the
   grass still alternates its three greens tile by tile, because this is a
   game where a child counts tiles — "Move 3" has to be countable on the
   ground. Only the edges of a terrace are softened; its tiles are not.
   Nothing here feeds the rules either: what can be walked on is decided
   in interpreter.js from the same `terrain` array, never from a pixel.

   A chunk of ground is drawn once into a canvas and kept (render.js
   getChunk); this file is what draws it. The one thing drawn every frame
   is the foam: two thin rings a few pixels off every coast that fade in
   and out against each other, stroked from an outline kept per chunk.
   ===================================================================== */
(function(){
if(window.CC_LAND)return;

const T=TILE;
const R=15;                 // an outward corner is cut back this far
const RC=11;                // an inward corner is filled in this far
const CUT=R, FILL=RC;       // the same two, for the functions that take their own
const LIP=[0,0,7,9];        // how much face shows under each level's southern edge
const INK={
  deep:"#3f9fd8", shallow1:"#4eabe0", shallow2:"#66bfe8",
  wet:"#dcc68a", sandSpeck:"rgba(150,120,60,.3)",
  soil:"#b27d48", soilLow:"#9a693a", turf:"#5fa83a",
  stone:"#84849a", stoneLow:"#6f6f86",
  shade:"rgba(54,38,14,.17)"
};

/* how high a tile stands: 0 water, 1 sand, 2 grass, 3 rock. Off the map is sea. */
function lv(x,y){return (x<0||y<0||x>=W||y>=H)?0:terrain[key(x,y)];}
const atLeast=[null,(x,y)=>lv(x,y)>=1,(x,y)=>lv(x,y)>=2,(x,y)=>lv(x,y)>=3];
/* open water: a water tile with water on every side of it, corners too */
function deep(x,y){
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(lv(x+dx,y+dy)!==0)return false;
  return true;
}

/* ---------------- shapes ----------------
   Everything is drawn in the chunk's own pixels: (ox,oy) is the world
   pixel at the chunk's corner. */
function rrect(p,x1,y1,x2,y2,tl,tr,br,bl){
  p.moveTo(x1+tl,y1);
  p.lineTo(x2-tr,y1); if(tr)p.arcTo(x2,y1,x2,y1+tr,tr);
  p.lineTo(x2,y2-br); if(br)p.arcTo(x2,y2,x2-br,y2,br);
  p.lineTo(x1+bl,y2); if(bl)p.arcTo(x1,y2,x1,y2-bl,bl);
  p.lineTo(x1,y1+tl); if(tl)p.arcTo(x1,y1,x1+tl,y1,tl);
  p.closePath();
}
/* the sliver that rounds an inward corner: between the corner at (cx,cy)
   and a circle of radius rc tucked into it */
function fillet(p,cx,cy,sx,sy,rc){
  p.moveTo(cx+sx*rc,cy);
  p.arcTo(cx,cy,cx,cy+sy*rc,rc);
  p.lineTo(cx,cy);
  p.closePath();
}
/* Every tile `inside` says yes to, as one area. With `lift`, a tile whose
   southern neighbour is outside stops that many pixels short — what is
   left uncovered below it is the face the terrace stands on. */
function area(inside,x0,y0,x1,y1,ox,oy,lift,r,rc,edgeOnly){
  if(r==null)r=R;
  if(rc==null)rc=RC;
  const p=new Path2D();
  let any=false;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const px=x*T-ox, py=y*T-oy;
    const n=inside(x,y-1), e=inside(x+1,y), s=inside(x,y+1), w=inside(x-1,y);
    if(inside(x,y)){
      if(edgeOnly&&n&&e&&s&&w)continue;      // a plain square: the caller draws those itself
      any=true;
      const bottom=py+T-((lift&&!s)?lift:0);
      /* half a pixel into a neighbour of the same terrace, so no seam shows */
      rrect(p,px,py,px+T+(e?.5:0),bottom+(s?.5:0),
        (!n&&!w)?r:0,(!n&&!e)?r:0,(!s&&!e)?r:0,(!s&&!w)?r:0);
    }else{
      /* an inward corner needs all three neighbours: two tiles that only
         touch at a point stay two rounded tiles */
      const up=py-(lift||0);        // the top corners sit under the lip of the tile above
      if(n&&w&&inside(x-1,y-1))fillet(p,px,up,1,1,rc);
      if(n&&e&&inside(x+1,y-1))fillet(p,px+T,up,-1,1,rc);
      if(s&&w&&inside(x-1,y+1))fillet(p,px,py+T,1,-1,rc);
      if(s&&e&&inside(x+1,y+1))fillet(p,px+T,py+T,-1,-1,rc);
    }
  }
  return any?p:null;
}
/* The edge of that area as a line — only the sides that face lower ground,
   with the same rounding — moved `d` pixels outward (inward if negative).
   Each side is its own stroke; round caps join them. */
const SIDES=[[1,0,0,-1],[0,1,1,0],[-1,0,0,1],[0,-1,-1,0]];   // along x,y · outward x,y — N,E,S,W
function edge(inside,x0,y0,x1,y1,ox,oy,d,R,RC){
  if(R==null)R=CUT;
  if(RC==null)RC=FILL;
  const p=new Path2D();
  let any=false;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    if(!inside(x,y))continue;
    const px=x*T-ox, py=y*T-oy;
    for(let k=0;k<4;k++){
      const ax=SIDES[k][0], ay=SIDES[k][1], qx=SIDES[k][2], qy=SIDES[k][3];
      if(inside(x+qx,y+qy))continue;                      // this side faces its own kind
      any=true;
      const sx=px+((k===1||k===2)?T:0), sy=py+((k===2||k===3)?T:0);
      const ex=sx+ax*T, ey=sy+ay*T;
      let t0=0, t1=T, turn=0;
      if(!inside(x-ax,y-ay))t0=R;                         // outward corner behind
      else if(inside(x-ax+qx,y-ay+qy))t0=RC;              // inward corner behind
      if(!inside(x+ax,y+ay)){t1=T-R;turn=1;}              // outward corner ahead
      else if(inside(x+ax+qx,y+ay+qy)){t1=T-RC;turn=2;}   // inward corner ahead
      p.moveTo(sx+ax*t0+qx*d,sy+ay*t0+qy*d);
      p.lineTo(sx+ax*t1+qx*d,sy+ay*t1+qy*d);
      if(turn===1)
        p.arc(ex-ax*R-qx*R,ey-ay*R-qy*R,Math.max(.01,R+d),Math.atan2(qy,qx),Math.atan2(ay,ax),false);
      else if(turn===2)
        p.arc(ex-ax*RC+qx*RC,ey-ay*RC+qy*RC,Math.max(.01,RC-d),Math.atan2(-qy,-qx),Math.atan2(ay,ax),true);
    }
  }
  return any?p:null;
}

/* ---------------- one chunk of ground ----------------
   A terrace is mostly plain squares. Only the tiles on its edge have a
   rounded corner or stop short above a face, so only those go through the
   outline: the inside is filled tile by tile, straight. (Putting every
   tile through one big outline was 11ms a chunk; this is 4.) */
function terrace(g,inside,a,b,c,d,ox,oy,lift,r,rc,base,tile){
  for(let y=b;y<=d;y++)for(let x=a;x<=c;x++)
    if(inside(x,y)&&inside(x,y-1)&&inside(x+1,y)&&inside(x,y+1)&&inside(x-1,y))tile(x,y,x*T-ox,y*T-oy);
  const rim=area(inside,a,b,c,d,ox,oy,lift,r,rc,true);
  if(!rim)return;
  g.save();g.clip(rim);
  /* one flat fill first: the slivers that round an inward corner lie in a
     tile OUTSIDE the terrace, which the tile-by-tile painting never reaches */
  g.fillStyle=base;g.fill(rim);
  for(let y=b;y<=d;y++)for(let x=a;x<=c;x++)
    if(inside(x,y)&&!(inside(x,y-1)&&inside(x+1,y)&&inside(x,y+1)&&inside(x-1,y)))tile(x,y,x*T-ox,y*T-oy);
  g.restore();
}
/* the face a terrace stands on: under every southern edge, and the slivers
   that carry it round an inward corner */
function faces(inside,a,b,c,d,ox,oy,lip){
  const p=new Path2D();
  let any=false;
  for(let y=b;y<=d;y++)for(let x=a;x<=c;x++){
    const px=x*T-ox, py=y*T-oy;
    if(inside(x,y)){
      if(inside(x,y+1))continue;
      any=true;
      const e=inside(x+1,y), w=inside(x-1,y);
      /* tall enough to reach up behind the rounded corner of the top */
      rrect(p,px,py+T-lip-R,px+T+(e?.5:0),py+T,0,0,e?0:R,w?0:R);
    }else{
      const n=inside(x,y-1);
      if(n&&inside(x-1,y)&&inside(x-1,y-1)){any=true;fillet(p,px,py,1,1,RC);}
      if(n&&inside(x+1,y)&&inside(x+1,y-1)){any=true;fillet(p,px+T,py,-1,1,RC);}
    }
  }
  return any?p:null;
}
function bake(g,cx,cy){
  const X0=cx*CHUNK, Y0=cy*CHUNK, ox=X0*T, oy=Y0*T, S=CHUNK*T;
  /* one tile of margin all round: a neighbour's shallows and rounding
     reach into this chunk, and the widest of them is half a tile */
  const a=X0-1, b=Y0-1, c=X0+CHUNK, d=Y0+CHUNK;
  g.lineJoin="round";g.lineCap="round";
  let kinds=0;
  for(let y=b;y<=d;y++)for(let x=a;x<=c;x++)kinds|=1<<lv(x,y);

  /* ---- level 0: water, in three depths ----
     Shallow everywhere, then open water painted over it: the tiles with
     water all round them, grown by 18px, so the deep starts 30px off a
     coast. It is built from the deep side on purpose. Growing the LAND's
     outline instead gives the same band but leaves the deep with a square
     corner in every bay; grown from here, a bay's corner is a 33px curve,
     and the big inward radius (30) keeps a curve round a headland too. */
  if(kinds===1){g.fillStyle=INK.deep;g.fillRect(0,0,S,S);return;}
  if(kinds&1){
    g.fillStyle=INK.shallow1;g.fillRect(0,0,S,S);
    /* grown by stroking its outline: a fat stroke along the coastline only */
    const far=edge(deep,a,b,c,d,ox,oy,0,R,30);
    if(far){g.strokeStyle=INK.deep;g.lineWidth=36;g.stroke(far);}
    terrace(g,deep,a,b,c,d,ox,oy,0,R,30,INK.deep,(x,y,px,py)=>{g.fillStyle=INK.deep;g.fillRect(px,py,T+1,T+1);});
  }
  /* and a lighter band right against the shore: the land's outline, fatter.
     (No outline at all means no coast in sight: land from edge to edge.) */
  const shore=edge(atLeast[1],a,b,c,d,ox,oy,0);
  if(shore){g.strokeStyle=INK.shallow2;g.lineWidth=24;g.stroke(shore);}

  /* ---- level 1: everything that is not water ---- */
  terrace(g,atLeast[1],a,b,c,d,ox,oy,0,R,RC,SANDC,(x,y,px,py)=>{
    g.fillStyle=SANDC;g.fillRect(px,py,T+1,T+1);
    if(lv(x,y)!==1)return;
    const h1=tileHash(x,y), h2=tileHash(x*3+1,y), h3=tileHash(x,y*5+2);
    g.fillStyle=INK.sandSpeck;
    g.beginPath();g.arc(px+h1*T,py+h2*T,1.6,0,7);g.arc(px+h3*T,py+h1*T,1.3,0,7);g.fill();
  });
  /* wet sand: a band just inside the shoreline. Its own line, drawn 3.75px
     in from the coast and 7.5 wide, so it needs no clipping — clipped to
     the terrace's edge tiles it lost its curve wherever a bay turned a
     corner, because the tile in that corner is not an edge tile. */
  const wet=edge(atLeast[1],a,b,c,d,ox,oy,-3.75);
  if(wet){g.strokeStyle=INK.wet;g.lineWidth=7.5;g.stroke(wet);}

  /* ---- level 2: the grass plateau ---- */
  if(kinds&12){
    step(g,2,a,b,c,d,ox,oy,INK.soil,INK.soilLow,5);
    terrace(g,atLeast[2],a,b,c,d,ox,oy,LIP[2],R,RC,GRASS[0],(x,y,px,py)=>{
      /* the same three greens, tile by tile: the grid a child counts on */
      g.fillStyle=GRASS[(x*31+y*17)%3];
      g.fillRect(px,py,T+1,T+1);
      if(lv(x,y)!==2)return;
      const h1=tileHash(x,y), h2=tileHash(x*3+1,y), h3=tileHash(x,y*5+2);
      g.fillStyle="rgba(38,96,24,.28)";
      g.fillRect(px+h1*(T-6)+2,py+h2*(T-8)+2,2,5);
      g.fillRect(px+h3*(T-6)+2,py+h1*(T-8)+2,2,4);
      if(h2<.12){g.fillStyle="rgba(255,255,255,.5)";g.fillRect(px+h3*(T-8)+3,py+h2*(T-8)+3,3,3);}
    });
    /* the turf's own edge: a darker rim where it ends, so the plateau reads
       as a thing with an edge and not a colour that stops */
    rim(g,2,a,b,c,d,ox,oy,INK.turf);
  }

  /* ---- level 3: rock, one step higher ---- */
  if(kinds&8){
    step(g,3,a,b,c,d,ox,oy,INK.stone,INK.stoneLow,6);
    terrace(g,atLeast[3],a,b,c,d,ox,oy,LIP[3],R,RC,ROCKC[0],(x,y,px,py)=>{
      const h1=tileHash(x,y), h2=tileHash(x*3+1,y), h3=tileHash(x,y*5+2);
      g.fillStyle=ROCKC[(x*31+y*17)%3];
      g.fillRect(px,py,T+1,T+1);
      g.fillStyle="rgba(60,60,75,.3)";
      g.beginPath();g.arc(px+h1*T,py+h2*T,2.2,0,7);g.arc(px+h3*T,py+h1*T,1.6,0,7);g.fill();
      g.fillStyle="rgba(255,255,255,.14)";
      g.fillRect(px+h2*(T-8),py+h3*(T-8),4,2);
    });
    rim(g,3,a,b,c,d,ox,oy,"rgba(255,255,255,.22)");
  }
}
/* what a terrace stands on: its shade on the ground to the south, then the
   face itself, darker at its foot. The top is painted over this afterwards. */
function step(g,L,a,b,c,d,ox,oy,ink,inkLow,reach){
  const f=faces(atLeast[L],a,b,c,d,ox,oy,LIP[L]);
  if(!f)return;
  g.save();g.translate(0,reach);g.fillStyle=INK.shade;g.fill(f);g.restore();
  g.fillStyle=ink;g.fill(f);
  face(g,L,a,b,c,d,ox,oy,inkLow);
}
/* the foot of a face is darker than its top: a band along the bottom of
   every southern edge, inside the face only */
function face(g,L,a,b,c,d,ox,oy,ink){
  g.fillStyle=ink;
  for(let y=b;y<=d;y++)for(let x=a;x<=c;x++){
    if(lv(x,y)<L||lv(x,y+1)>=L)continue;
    const px=x*T-ox, py=y*T-oy;
    const w=lv(x-1,y)<L, e=lv(x+1,y)<L;
    /* stay clear of a rounded corner: the band would square it off */
    g.fillRect(px+(w?R*.7:0),py+T-3,T+.5-(w?R*.7:0)-(e?R*.7:0),3);
  }
}
/* a thin line along where a terrace's top ends above its face */
function rim(g,L,a,b,c,d,ox,oy,ink){
  g.strokeStyle=ink;g.lineWidth=2;
  g.beginPath();
  for(let y=b;y<=d;y++)for(let x=a;x<=c;x++){
    if(lv(x,y)<L||lv(x,y+1)>=L)continue;
    const px=x*T-ox, py=y*T-oy, yy=py+T-LIP[L];
    const w=lv(x-1,y)<L, e=lv(x+1,y)<L;
    g.moveTo(px+(w?R*.55:0),yy);g.lineTo(px+T-(e?R*.55:0),yy);
  }
  g.stroke();
}

/* ---------------- the foam ----------------
   Two rings a few pixels off every coast. They are kept per chunk as
   outlines and stroked each frame; one is bright while the other is
   faint, and they change places — which reads as water lapping at the
   shore, for the price of two strokes a chunk. */
const coasts=new Map();
function coast(cx,cy){
  const k=cx+"_"+cy;
  let c=coasts.get(k);
  if(c!==undefined)return c;
  const X0=cx*CHUNK, Y0=cy*CHUNK;
  const near=edge(atLeast[1],X0,Y0,X0+CHUNK-1,Y0+CHUNK-1,0,0,3.5);
  c=near?{near,far:edge(atLeast[1],X0,Y0,X0+CHUNK-1,Y0+CHUNK-1,0,0,9.5)}:null;
  coasts.set(k,c);
  return c;
}
function foam(ctx,cx0,cy0,cx1,cy1,t){
  const still=calm();
  const ph=still?.6:t/1300;
  const a1=.34+.26*Math.sin(ph), a2=.20+.18*Math.sin(ph+2.4);
  ctx.save();
  ctx.lineCap="round";ctx.lineJoin="round";ctx.strokeStyle="#fff";
  for(let cy=cy0;cy<=cy1;cy++)for(let cx=cx0;cx<=cx1;cx++){
    const c=coast(cx,cy);if(!c)continue;
    ctx.setLineDash([]);
    ctx.globalAlpha=a1;ctx.lineWidth=2.4;ctx.stroke(c.near);
    /* the outer ring is broken and drifts along the shore: foam, not a contour */
    ctx.setLineDash([15,11]);ctx.lineDashOffset=still?0:-t/160;
    ctx.globalAlpha=a2;ctx.lineWidth=1.8;ctx.stroke(c.far);
  }
  ctx.setLineDash([]);
  ctx.restore();
}
let calmAt=0, calmIs=false;
function calm(){
  const n=Date.now();
  if(n-calmAt>2000){
    calmAt=n;
    try{calmIs=matchMedia("(prefers-reduced-motion: reduce)").matches;}catch(_){calmIs=false;}
  }
  return calmIs;
}

window.CC_LAND={bake,foam,level:lv,reset(){coasts.clear();},
  /* for the suite: the shapes themselves */
  _area:area,_edge:edge,R,RC,LIP};
})();
