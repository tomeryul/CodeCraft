"use strict";
/* =====================================================================
   Robot cosmetics — outfits, back pieces and shoes
   ---------------------------------------------------------------------
   Painters, not sprites. A hat is rigid, so it stays a sprite in
   js/sprites.js; an outfit has to squash with the body inside its clip
   path and a shoe has to ride a foot that re-rotates every frame, and a
   bitmap can do neither.

   Everything here is drawn in BODY UNITS — the same space render.js draws
   the robot in, where the body square is S = TILE*0.72, the hips sit at
   (±5.53, 13.28) and the leg is 5.53 long. The caller has already applied
   the whole transform tree, so these functions never translate to a
   world position and never save/restore around the caller's state beyond
   their own work.

   Three anchors, three entry points:
     back(g,id,sway,gp)          (0,2), before the legs
     shoe(g,id,limbColor,mv,t)   the leg end, after rotate(footDeg)
     outfit(g,id,color)          (0,0), inside the body's clip

   No new colours: every fill below already exists in css/styles.css or
   js/sprites.js.
   ===================================================================== */
(function(){
const S=TILE*0.72;

/* the game's own rounded-rect helper, guarded so this file is usable
   before render.js has run */
function RR(g,x,y,w,h,r){
  if(typeof rr==="function"){rr(g,x,y,w,h,r);return;}
  g.beginPath();
  if(g.roundRect){g.roundRect(x,y,w,h,r);return;}
  g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);
  g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();
}

/* ---------- outfits: inside the body's clip, so they squash with it ----------
   `cape` is deliberately absent here: it is worn on the back anchor, not
   the torso, so it is painted by back() before the legs instead. */
const outfits={
  vest(g){
    g.fillStyle="#ffb830";RR(g,-S/2,-6,9.4,S/2+6,3);g.fill();RR(g,S/2-9.4,-6,9.4,S/2+6,3);g.fill();
    g.fillStyle="rgba(232,242,255,.85)";g.fillRect(-S/2,3.6,S,3.2);
    g.fillStyle="#e09a12";g.fillRect(-S/2,-6,S,2.2);
  },
  apron(g){
    g.fillStyle="#e2d7b8";RR(g,-11,-3,22,S/2+3,4);g.fill();
    g.strokeStyle="#c4b58c";g.lineWidth=1.6;
    g.beginPath();g.moveTo(-9,-3);g.lineTo(-4.5,-9.5);g.moveTo(9,-3);g.lineTo(4.5,-9.5);g.stroke();
    g.beginPath();g.moveTo(-7.5,6.5);g.lineTo(7.5,6.5);g.stroke();
    g.fillStyle="#cfc09a";RR(g,-6.5,7.5,13,6,1.6);g.fill();
  },
  stripes(g){
    g.fillStyle="rgba(255,255,255,.88)";
    g.fillRect(-S/2,-9.5,S,3.4);g.fillRect(-S/2,-2.5,S,3.4);g.fillRect(-S/2,4.5,S,3.4);
  },
  hoodie(g){
    g.fillStyle="#5ab8ff";g.fillRect(-S/2,-S/2,S,15.5);
    g.fillStyle="#3f93cf";g.beginPath();g.moveTo(-S/2,-S/2);g.quadraticCurveTo(0,-S/2+9,S/2,-S/2);g.lineTo(S/2,-S/2);g.closePath();g.fill();
    g.strokeStyle="rgba(23,17,48,.4)";g.lineWidth=1.4;g.beginPath();g.moveTo(0,-11);g.lineTo(0,0);g.stroke();
    g.fillStyle="#ffd66b";g.beginPath();g.arc(0,.6,1.5,0,7);g.fill();
  },
  lab(g){
    g.fillStyle="#f2f3f7";RR(g,-S/2,-5,S,S/2+5,3);g.fill();
    g.fillStyle="#dfe3ec";g.beginPath();g.moveTo(-8,-5);g.lineTo(0,2);g.lineTo(8,-5);g.closePath();g.fill();
    g.strokeStyle="#c3c9d6";g.lineWidth=1.4;RR(g,3.4,5,7,6,1.4);g.stroke();
    g.fillStyle="#5ab8ff";g.fillRect(5.2,4.4,1.4,4);
  }
};

/* ---------- back pieces: before the legs, so they read as behind ----------
   The cape trails on the gait phase and leans with the sway, which is the
   whole reason it lives inside the transform tree. */
const backs={
  cape(g,sway,gp){
    const w=Math.sin((gp||0)*6.283)*2.2+(sway||0)*.35;
    g.save();
    g.fillStyle="#e04a5f";
    g.beginPath();g.moveTo(-12,-9);g.lineTo(12,-9);
    g.quadraticCurveTo(15+w,4,17+w*1.6,20);
    g.quadraticCurveTo(0,25,-17+w*1.6,20);
    g.quadraticCurveTo(-15+w,4,-12,-9);g.closePath();g.fill();
    g.fillStyle="rgba(0,0,0,.16)";
    g.beginPath();g.moveTo(0,-9);g.quadraticCurveTo(4+w,6,6+w*1.6,22);g.quadraticCurveTo(0,24,-2,22);g.closePath();g.fill();
    g.fillStyle="#ffd66b";RR(g,-12.5,-10.5,25,3.6,1.8);g.fill();
    g.restore();
  }
};

/* ---------- shoes: inside the per-leg closure, after rotate(footDeg) ----------
   Origin is the leg end and the foot has already counter-rotated, which is
   why a shoe never slides for the same reason the plain foot never did.
   `limb` is the darkened body colour the leg is stroked with, passed in so a
   shoe can match it; the rocket flame only burns while the robot is moving. */
const shoes={
  boots(g){
    g.fillStyle="#4a3728";RR(g,-4.9,-1.8,9.8,6.2,2.6);g.fill();
    g.fillStyle="#241b45";RR(g,-5.3,3.2,10.6,2.4,1.2);g.fill();
    g.fillStyle="rgba(255,255,255,.16)";RR(g,-3.6,-1,4.4,1.8,.9);g.fill();
  },
  sneakers(g){
    g.fillStyle="#f2f3f7";RR(g,-4.7,-1.9,9.4,5.2,2.4);g.fill();
    g.fillStyle="#5ab8ff";RR(g,-5.1,2.6,10.2,2.6,1.3);g.fill();
    g.strokeStyle="#c3c9d6";g.lineWidth=1;g.beginPath();g.moveTo(-2.6,-.6);g.lineTo(1.6,-.6);g.stroke();
  },
  wellies(g){
    g.fillStyle="#54d66a";RR(g,-3.3,-9.5,6.6,9.5,1.8);g.fill();
    g.fillStyle="#3fb257";RR(g,-4.9,-1.8,9.8,6,2.5);g.fill();
    g.fillStyle="#241b45";RR(g,-5.2,3.2,10.4,2.2,1.1);g.fill();
    g.fillStyle="rgba(255,255,255,.22)";g.fillRect(-3.3,-8.4,6.6,1.4);
  },
  rockets(g,limb,moving,t){
    g.fillStyle="#cfd4e0";RR(g,-4.2,-2.4,8.4,6.4,2.2);g.fill();
    g.fillStyle="#9aa3b5";g.beginPath();g.moveTo(-3.4,4);g.lineTo(3.4,4);g.lineTo(2.4,6.6);g.lineTo(-2.4,6.6);g.closePath();g.fill();
    g.fillStyle="#ff5d73";RR(g,-4.2,-.6,8.4,1.8,.9);g.fill();
    if(moving){
      const fl=.7+.3*Math.sin((t||0)/70);
      g.fillStyle="#ffb830";g.beginPath();g.moveTo(-2.2,6.6);g.lineTo(2.2,6.6);g.lineTo(0,6.6+6*fl);g.closePath();g.fill();
      g.fillStyle="#ffe9a0";g.beginPath();g.moveTo(-1.1,6.6);g.lineTo(1.1,6.6);g.lineTo(0,6.6+3.4*fl);g.closePath();g.fill();
    }
  }
};

/* =====================================================================
   Pieces the player painted
   ---------------------------------------------------------------------
   A made piece is a 12×12 grid of palette indices — one character per
   cell, "." for see-through — and an id that starts with "my:". That is
   the whole format: it fits in a save, it survives being typed into a
   text editor, and it cannot carry anything but colour.

   The grid lands in the SAME body units the hand-painted pieces use, so
   a made hat rides the head anchor and a made shoe rides the foot for
   exactly the same reason the drawn ones do. Only the paint is the
   player's; the rig is not up for negotiation.

   The palette is the game's own sixteen colours. A free colour picker
   would let a player paint a robot in colours that belong to nothing
   else on screen, and the point of a small palette is that whatever they
   make still looks like it comes from this world.
   ===================================================================== */
const WEAR_PAL=["#ffb830","#ffd66b","#e09a12","#ff5d73","#e04a5f","#ff8fa0",
  "#5ab8ff","#3f93cf","#54d66a","#3fb257","#b184ff","#f2f3f7",
  "#cfd4e0","#9aa3b5","#4a3728","#241b45"];
const WEAR_KEY="0123456789abcdef";
const WEAR_N=12;                     /* 12×12: chunky enough to paint with a thumb */
const WEAR_MAX=8;                    /* pieces per slot */
const WEAR_PRE="my:";
/* where the grid sits, in body units. The hat box is the sprite's own
   footprint — 24 units square, centred where sprite hats are drawn — so a
   made hat and a drawn one occupy the same space. */
const WEAR_BOX={
  hat:   {x:-12,   y:-S/2-16.75, w:24, h:24},
  outfit:{x:-S/2,  y:-S/2,       w:S,  h:S },
  shoes: {x:-6,    y:-4,         w:12, h:12}
};

function isCustom(id){ return typeof id==="string" && id.indexOf(WEAR_PRE)===0; }
/* the draft is the piece being painted right now: it has no entry in the
   save yet, and the preview has to be able to draw it anyway */
let draft=null;
function customPiece(id){
  if(!isCustom(id))return null;
  if(draft&&draft.id===id)return draft;
  const list=(typeof player!=="undefined"&&player&&player.myWear)||[];
  for(let i=0;i<list.length;i++)if(list[i]&&list[i].id===id)return list[i];
  return null;
}
/* smooth unless the piece says otherwise: a grid painted before this
   existed, and every new one, reads as curves */
const isSmooth=p=>!p||p.sm!==false;

/* ---------- blocks ---------- */
function paintBlocks(g,box,px){
  const cw=box.w/WEAR_N, ch=box.h/WEAR_N, n=WEAR_N*WEAR_N;
  for(let i=0;i<n&&i<px.length;i++){
    const k=WEAR_KEY.indexOf(px.charAt(i));
    if(k<0)continue;
    g.fillStyle=WEAR_PAL[k];
    /* the .04 overlap closes the hairline seams antialiasing leaves
       between neighbouring cells when the whole grid is scaled */
    g.fillRect(box.x+(i%WEAR_N)*cw-.02, box.y+((i/WEAR_N)|0)*ch-.02, cw+.04, ch+.04);
  }
}

/* =====================================================================
   Curves, not blocks
   ---------------------------------------------------------------------
   The pieces the game ships are rounded rectangles and quadratic curves,
   and a grid of squares next to them looks like it came from a different
   game. So the grid is only how a piece is STORED and painted; it is not
   how it is drawn.

   Walking the boundary of one colour's cells gives closed loops of unit
   axis-aligned edges — a staircase. Three rounds of Chaikin corner-cutting
   turn that staircase into a curve, and drawing the result as quadratics
   through the midpoints finishes the job. A single cell becomes a blob, a
   diagonal run becomes a slope, and a square block keeps its edges and
   loses its corners, which is what every other shape in this game does.
   ===================================================================== */
function maskLoops(mask,n){
  /* Each filled cell contributes only the edges facing an empty
     neighbour, wound so outer loops and holes come out with opposite
     handedness — which is what lets one path with "evenodd" fill a shape
     that has a hole in it. */
  const segs=new Map();
  const key=(x,y)=>x+","+y;
  const add=(ax,ay,bx,by)=>{
    const k=key(ax,ay); let l=segs.get(k);
    if(!l){l=[];segs.set(k,l);} l.push(bx,by);
  };
  const on=(x,y)=>x>=0&&y>=0&&x<n&&y<n&&mask[y*n+x];
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    if(!mask[y*n+x])continue;
    if(!on(x,y-1))add(x,y,x+1,y);
    if(!on(x+1,y))add(x+1,y,x+1,y+1);
    if(!on(x,y+1))add(x+1,y+1,x,y+1);
    if(!on(x-1,y))add(x,y+1,x,y);
  }
  const loops=[];
  while(segs.size){
    const startK=segs.keys().next().value;
    const sp=startK.split(","); let cx=+sp[0], cy=+sp[1];
    const loop=[];
    /* the guard is not paranoia: two regions that touch only at a corner
       give one lattice point two exits, and a wrong turn there must end
       the loop rather than spin */
    for(let guard=0;guard<n*n*8;guard++){
      const k=key(cx,cy), l=segs.get(k);
      if(!l||!l.length)break;
      const ny=l.pop(), nx=l.pop();
      if(!l.length)segs.delete(k);
      loop.push(cx,cy);
      cx=nx; cy=ny;
      if(cx===+sp[0]&&cy===+sp[1])break;
    }
    if(loop.length>=6)loops.push(loop);
  }
  return loops;
}
/* how far a point may sit off the straight line drawn through its
   neighbours before it counts as a corner rather than a stair, and how much
   of a cell each surviving corner is rounded by */
const SIMP=.72, FILLET=.85;
/* ---------- staircase -> straight lines -> rounded corners ----------
   Corner-cutting alone is not enough. Run it on a one-cell staircase and
   the diagonal comes out scalloped, because the wave IS the staircase,
   only rounder. So the loop is simplified first — Ramer-Douglas-Peucker
   with a tolerance a little over half a cell, which is exactly the height
   of a one-cell step, so a staircase collapses to the straight line it was
   drawn to mean while a real notch survives — and only then are the
   corners that remain replaced with fillets.

   That is the same two ingredients every piece the game ships is made of:
   straight edges and a consistent corner radius. */
function rdp(p,i,j,eps,keep){
  keep[i]=1;keep[j]=1;
  if(j<=i+1)return;
  const ax=p[i*2],ay=p[i*2+1],bx=p[j*2],by=p[j*2+1];
  const dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy)||1;
  let far=-1,at=-1;
  for(let k=i+1;k<j;k++){
    const d=Math.abs(dy*p[k*2]-dx*p[k*2+1]+bx*ay-by*ax)/len;
    if(d>far){far=d;at=k;}
  }
  if(far>eps){ rdp(p,i,at,eps,keep); rdp(p,at,j,eps,keep); }
}
function simplify(flat,eps){
  const m=flat.length/2;
  if(m<4)return flat;
  /* the topmost-then-leftmost lattice point is a genuine corner of the
     shape, so it is safe to cut the closed loop open there */
  let a=0;
  for(let i=1;i<m;i++)
    if(flat[i*2+1]<flat[a*2+1]||(flat[i*2+1]===flat[a*2+1]&&flat[i*2]<flat[a*2]))a=i;
  const rot=new Array(m*2);
  for(let i=0;i<m;i++){const j=(a+i)%m;rot[i*2]=flat[j*2];rot[i*2+1]=flat[j*2+1];}
  let b=1,bd=-1;
  for(let i=1;i<m;i++){
    const dx=rot[i*2]-rot[0], dy=rot[i*2+1]-rot[1], d=dx*dx+dy*dy;
    if(d>bd){bd=d;b=i;}
  }
  const keep=new Uint8Array(m);
  rdp(rot,0,b,eps,keep);
  /* the far side of the loop, walked as its own open line back to the start */
  const tail=rot.slice(b*2); tail.push(rot[0],rot[1]);
  const keep2=new Uint8Array(m-b+1);
  rdp(tail,0,m-b,eps,keep2);
  for(let i=0;i<=m-b;i++)if(keep2[i])keep[(b+i)%m]=1;
  const out=[];
  for(let i=0;i<m;i++)if(keep[i])out.push(rot[i*2],rot[i*2+1]);
  return out;
}
/* every corner becomes a fillet of the same radius, shortened where an
   edge is too short to hold it — so a lone cell rounds all the way to a
   blob and a long edge stays a long edge */
function roundLoop(g,pts,r,ox,oy,sc){
  const m=pts.length/2;
  if(m<3)return;
  const X=i=>ox+pts[(i%m)*2]*sc, Y=i=>oy+pts[(i%m)*2+1]*sc;
  for(let i=0;i<m;i++){
    const pv=(i+m-1)%m, nx=(i+1)%m;
    const ux=X(pv)-X(i), uy=Y(pv)-Y(i), Lp=Math.hypot(ux,uy)||1;
    const vx=X(nx)-X(i), vy=Y(nx)-Y(i), Ln=Math.hypot(vx,vy)||1;
    const rad=Math.min(r,Lp/2,Ln/2);
    const ex=X(i)+ux/Lp*rad, ey=Y(i)+uy/Lp*rad;
    if(i===0)g.moveTo(ex,ey); else g.lineTo(ex,ey);
    g.quadraticCurveTo(X(i),Y(i),X(i)+vx/Ln*rad,Y(i)+vy/Ln*rad);
  }
  g.closePath();
}
function paintSmooth(g,box,px){
  const n=WEAR_N, cw=box.w/n, cells=n*n;
  /* Largest area first, so a big shape cannot land on top of the detail
     drawn into it. Each region is also stroked in its own colour: two
     smoothed edges that used to share a cell border pull apart by a
     fraction of a cell, and a hairline of background between two colours
     is the one artefact that would give the trick away. */
  const count={};
  for(let i=0;i<cells&&i<px.length;i++){
    const c=px.charAt(i);
    if(WEAR_KEY.indexOf(c)>=0)count[c]=(count[c]||0)+1;
  }
  const order=Object.keys(count).sort((a,b)=>count[b]-count[a]);
  const mask=new Uint8Array(cells);
  for(const c of order){
    for(let i=0;i<cells;i++)mask[i]=(i<px.length&&px.charAt(i)===c)?1:0;
    const loops=maskLoops(mask,n);
    if(!loops.length)continue;
    g.beginPath();
    for(const lp of loops){
      /* A one-cell dot and a diagonal staircase deviate from their chord by
         the same 0.707 of a cell, so a tolerance that flattens the staircase
         can also collapse the dot to nothing. The fallback is the guard: a
         loop simplified out of existence is drawn as it was. */
      const sm=simplify(lp,SIMP);
      roundLoop(g,sm.length>=6?sm:lp,cw*FILLET,box.x,box.y,cw);
    }
    g.fillStyle=WEAR_PAL[WEAR_KEY.indexOf(c)];
    g.fill("evenodd");
    g.strokeStyle=g.fillStyle;g.lineJoin="round";g.lineCap="round";
    g.lineWidth=cw*.22;
    g.stroke();
  }
}

/* =====================================================================
   Pieces built out of parts
   ---------------------------------------------------------------------
   The other way to make a piece, and the one that is really a programming
   lesson: instead of painting cells, you stack boxes. Every part is a box
   with a position, a size, a corner radius and a colour — which is exactly
   what a <div> with a CSS rule is, so js/game/wear-code.js can print the
   piece as real HTML and CSS that always matches what the robot wears.
   The game already does this for behaviour: blocks on one tab, the Python
   they mean on the next. This is the same promise for how a robot looks.

   Numbers are percentages of the slot's own box, 0-100, because that is
   what they become in the stylesheet: left, top, width, height and a
   border-radius that goes round both axes at 50%.

   `cls` is the group a part belongs to. Two parts in the same group share
   one class — one rule, one look, two elements standing in different
   places — which is a component, spelled the way CSS spells it.
   ===================================================================== */
const WEAR_NAME=["Gold","Sand","Amber","Coral","Cherry","Blush","Sky","Ocean",
  "Leaf","Pine","Violet","Snow","Cloud","Stone","Cocoa","Ink"];
const PART_MAX=14;
/* the four radii the game offers, as CSS percentages — and they are exactly
   the four words a box can be called, so the chip a child taps is the word
   that ends up in the class name */
const PART_RAD=[0,15,40,50];

/* border-radius in percent is per-axis — 50% of the width across and 50%
   of the height down — so a wide box rounds into an ellipse, not a
   stadium. arcTo cannot do that; four elliptical arcs can. */
function rrEl(g,x,y,w,h,rx,ry){
  rx=Math.min(rx,w/2); ry=Math.min(ry,h/2);
  const P=Math.PI;
  g.beginPath();
  g.moveTo(x+rx,y);
  g.lineTo(x+w-rx,y);
  g.ellipse(x+w-rx,y+ry,rx,ry,0,-P/2,0);
  g.lineTo(x+w,y+h-ry);
  g.ellipse(x+w-rx,y+h-ry,rx,ry,0,0,P/2);
  g.lineTo(x+rx,y+h);
  g.ellipse(x+rx,y+h-ry,rx,ry,0,P/2,P);
  g.lineTo(x,y+ry);
  g.ellipse(x+rx,y+ry,rx,ry,0,P,P*1.5);
  g.closePath();
}
/* =====================================================================
   The box model, and the layout that uses it
   ---------------------------------------------------------------------
   A box used to be four numbers and a colour, placed by hand. That is
   absolute positioning, which is the least representative corner of CSS —
   real front-end work is a container telling its children where to go.

   So a box now has the whole box model — content, padding, border, margin,
   in that order out from the middle — and it can HOLD other boxes. A
   container lays its children out one of three ways:

     free   each child sits where its own left/top say, inside the
            container's content box. What every piece did before this.
     row    children in a line across, in the order they were made
     col    children in a line down

   and in the two flow modes, justify-content places them along that line
   and align-items across it. `center` is then a word rather than a sum,
   which is the whole point: a child who typed left: 37% to centre
   something and watched it drift has learned nothing, and a child who
   writes justify-content: center has learned how the web is laid out.

   Everything is in a 0..100 space, and the stylesheet says width: 100px on
   the root — so a percentage and a pixel are the same number here, a
   border of 3 is 3 either way, and nothing has to be converted to be
   understood.

   Parents come before their children in the array. That one invariant
   makes cycles impossible, keeps the paint order right without a sort, and
   lets the cleaner check a hand-edited save in a single pass.
   ===================================================================== */
const LAY=["free","row","col"];
const JUS=["flex-start","center","flex-end","space-between"];
const ALI=["flex-start","center","flex-end"];
const BOXF={pad:0,mg:0,bw:0,bc:15,lay:0,gap:0,jus:0,ali:0};
const bf=(p,k)=>{const v=p&&p[k]; return typeof v==="number"?v:BOXF[k];};

/* the four rectangles devtools draws, out from the middle */
function boxRings(x,y,w,h,pt,K){
  const m=bf(pt,"mg")*K, b=bf(pt,"bw")*K, pd=bf(pt,"pad")*K;
  return [
    ["margin", x-m,y-m,w+m*2,h+m*2],
    ["border", x,y,w,h],
    ["padding",x+b,y+b,Math.max(0,w-b*2),Math.max(0,h-b*2)],
    ["content",x+b+pd,y+b+pd,Math.max(0,w-(b+pd)*2),Math.max(0,h-(b+pd)*2)]
  ];
}

/* Lay the whole tree out once and hand back a rect per part, in the 0..100
   space, plus the content box each container offers its children. The
   renderer, the drag and the box-model overlay all read this, so there is
   one answer to "where is that box" instead of three. */
function layoutParts(parts,root){
  const out={rect:new Array(parts?parts.length:0),content:new Array(parts?parts.length:0),rootContent:null};
  if(!Array.isArray(parts)||!parts.length)return out;
  const seen=new Set(), kids=new Map();
  parts.forEach((p,i)=>{
    /* a parent must already have been seen, which is the invariant that
       makes a cycle unrepresentable */
    const key=(p.pin!=null&&seen.has(p.pin))?p.pin:"";
    if(!kids.has(key))kids.set(key,[]);
    kids.get(key).push(i);
    if(p.pid!=null)seen.add(p.pid);
  });
  const content=(box,cont)=>{
    const inset=bf(cont,"bw")+bf(cont,"pad");
    const kx=box.w/100, ky=box.h/100;
    return {x:box.x+inset*kx, y:box.y+inset*ky,
            w:Math.max(0,box.w-inset*2*kx), h:Math.max(0,box.h-inset*2*ky)};
  };
  const place=(key,box,cont,depth)=>{
    const c=content(box,cont);
    if(key==="")out.rootContent=c; else out.content[key.at]=c;
    const list=kids.get(key==="" ? "" : key.pid); if(!list||depth>4)return;
    const sx=c.w/100, sy=c.h/100;
    const lay=LAY[bf(cont,"lay")]||"free";
    if(lay==="free"){
      for(const i of list){
        const p=parts[i];
        const r={x:c.x+p.x*sx,y:c.y+p.y*sy,w:p.w*sx,h:p.h*sy};
        out.rect[i]=r;
        place({pid:p.pid,at:i},r,p,depth+1);
      }
      return;
    }
    /* flow: pack along the main axis, honouring each child's margin and
       the container's gap, then justify along it and align across it */
    const rowMode=lay==="row", gap=bf(cont,"gap");
    let total=gap*(list.length-1);
    const items=list.map(i=>{
      const p=parts[i], m=bf(p,"mg");
      const main=(rowMode?p.w:p.h)+m*2, cross=(rowMode?p.h:p.w)+m*2;
      total+=main;
      return {i,p,m,main,cross};
    });
    const jus=JUS[bf(cont,"jus")]||"flex-start";
    const ali=ALI[bf(cont,"ali")]||"flex-start";
    const free=100-total;
    let cursor=0, spread=gap;
    if(jus==="center")cursor=free/2;
    else if(jus==="flex-end")cursor=free;
    else if(jus==="space-between"&&list.length>1)spread=gap+Math.max(0,free)/(list.length-1);
    for(const it of items){
      const p=it.p, m=it.m;
      let cross=0;
      if(ali==="center")cross=(100-it.cross)/2;
      else if(ali==="flex-end")cross=100-it.cross;
      const r=rowMode
        ?{x:c.x+(cursor+m)*sx,y:c.y+(cross+m)*sy,w:p.w*sx,h:p.h*sy}
        :{x:c.x+(cross+m)*sx,y:c.y+(cursor+m)*sy,w:p.w*sx,h:p.h*sy};
      out.rect[it.i]=r;
      place({pid:p.pid,at:it.i},r,p,depth+1);
      cursor+=it.main+spread;
    }
  };
  place("",{x:0,y:0,w:100,h:100},root||{},0);
  return out;
}

/* `focus`, when it is a class id, dims every box that does not belong to
   it — in place, so the stacking order a player built is still what they
   see. It is how the component screen keeps the rest of the piece visible
   without letting it compete. */
function paintParts(g,box,parts,focus,root){
  if(!Array.isArray(parts))return;
  const a0=g.globalAlpha;
  const L=layoutParts(parts,root), K=box.w/100;
  parts.forEach((pt,i)=>{
    const r=L.rect[i]; if(!r)return;
    if(focus!=null)g.globalAlpha=a0*(pt.cls===focus?1:.25);
    const w=r.w*K, h=r.h*K;
    if(w<=0||h<=0)return;
    const x=box.x+r.x*K, y=box.y+r.y*K;
    /* CSS rotates an element about its own centre, so this does too — the
       code and the canvas have to mean the same thing by rotate() */
    const a=pt.a|0;
    if(a){ g.save(); g.translate(x+w/2,y+h/2); g.rotate(a*Math.PI/180); g.translate(-x-w/2,-y-h/2); }
    const bw=bf(pt,"bw")*K;
    if(bw>0){
      /* a border is a ring: the border colour fills the whole box and the
         background fills what is left inside it, which is exactly the order
         a browser paints them in */
      rrEl(g,x,y,w,h,w*pt.r/100,h*pt.r/100);
      g.fillStyle=WEAR_PAL[bf(pt,"bc")]||WEAR_PAL[15];
      g.fill();
      const iw=Math.max(0,w-bw*2), ih=Math.max(0,h-bw*2);
      if(iw>0&&ih>0){
        rrEl(g,x+bw,y+bw,iw,ih,iw*pt.r/100,ih*pt.r/100);
        g.fillStyle=WEAR_PAL[pt.c]||WEAR_PAL[0];
        g.fill();
      }
    }else{
      rrEl(g,x,y,w,h,w*pt.r/100,h*pt.r/100);
      g.fillStyle=WEAR_PAL[pt.c]||WEAR_PAL[0];
      g.fill();
    }
    if(a)g.restore();
  });
  g.globalAlpha=a0;
}

/* Smoothing costs a few hundred path operations per colour, and the world
   redraws every robot sixty times a second — so a smoothed piece is baked
   once into a small canvas and blitted after that. It can be a bitmap
   precisely because a made piece never animates: unlike the cape, which
   trails on the gait phase, or the rocket boots, whose flame flickers,
   nothing about a painted grid changes between frames. The blit still sits
   inside the robot's transform, so it squashes, leans and rotates with the
   body exactly as the vector version would. */
const BAKE=112;
const baked=new Map();
function bake(slot,px){
  const key=slot+"|"+px;
  let c=baked.get(key);
  if(c)return c;
  const b=WEAR_BOX[slot];
  c=document.createElement("canvas");
  c.width=c.height=BAKE;
  const k=BAKE/b.w, g=c.getContext("2d");
  g.setTransform(k,0,0,k,-b.x*k,-b.y*k);
  paintSmooth(g,b,px);
  /* a stroke of drafts arrives one grid per frame while a child paints, so
     the oldest entries go rather than the map growing without end */
  if(baked.size>48)baked.delete(baked.keys().next().value);
  baked.set(key,c);
  return c;
}
function paintPiece(g,slot,p){
  if(!p)return;
  const b=WEAR_BOX[slot];
  /* parts are already curves and already cheap — a handful of filled
     rounded rects — so they are drawn straight, with no bake in the way */
  if(p.kind==="parts"){ paintParts(g,b,p.parts,null,p.root); return; }
  if(typeof p.px!=="string")return;
  if(!isSmooth(p)){ paintBlocks(g,b,p.px); return; }
  g.drawImage(bake(slot,p.px),b.x,b.y,b.w,b.h);
}

window.CC_WEAR={
  outfits:outfits, backs:backs, shoes:shoes,
  pal:WEAR_PAL, key:WEAR_KEY, cells:WEAR_N, max:WEAR_MAX, prefix:WEAR_PRE, box:WEAR_BOX,
  names:WEAR_NAME, rad:PART_RAD, partMax:PART_MAX,
  isCustom:isCustom,
  /* the maker's build canvas draws the working parts straight */
  parts(g,slot,list,focus,root){const b=WEAR_BOX[slot]; if(b)paintParts(g,b,list,focus,root);},
  /* one answer to "where is that box", shared by the paint, the drag and
     the box-model overlay */
  layout:layoutParts, rings:boxRings, lay:LAY, jus:JUS, ali:ALI, boxDefault:BOXF,
  field:bf,
  /* body-local; the caller has already clipped to the body square */
  outfit(g,id,color){
    const p=customPiece(id); if(p)return paintPiece(g,"outfit",p);
    const f=outfits[id]; if(f)f(g,color);
  },
  /* body-local; drawn before the legs */
  back(g,id,sway,gp){const f=backs[id]; if(f)f(g,sway,gp);},
  /* foot-local; origin = leg end, already rotated */
  shoe(g,id,limb,moving,t){
    const p=customPiece(id); if(p)return paintPiece(g,"shoes",p);
    const f=shoes[id]; if(f)f(g,limb,moving,t);
  },
  /* body-local. Returns false for a shop hat so the caller falls back to
     the sprite — a hat that is not painted is still rigid art. */
  hat(g,id){
    const p=customPiece(id); if(!p)return false;
    paintPiece(g,"hat",p); return true;
  },
  /* the piece on its own, fitted to a size×size box: swatches and previews */
  swatch(g,slot,piece,size){
    const b=WEAR_BOX[slot]; if(!b)return;
    const k=size/Math.max(b.w,b.h)*.94;
    g.save();
    g.translate(size/2,size/2);g.scale(k,k);g.translate(-(b.x+b.w/2),-(b.y+b.h/2));
    paintPiece(g,slot,piece);
    g.restore();
  },
  /* the paint sheet draws the working grid straight, without the bake:
     a stroke has to appear on the canvas the same frame it is made */
  grid(g,slot,px,smooth){
    const b=WEAR_BOX[slot]; if(!b)return;
    if(smooth)paintSmooth(g,b,px); else paintBlocks(g,b,px);
  },
  setDraft(d){draft=d||null;},
  /* A save can arrive from a file somebody else wrote, and a made piece is
     both drawn and named on screen. Everything that is not a palette
     character becomes a hole, and anything the game does not recognise is
     dropped rather than repaired. */
  clean(list){
    if(!Array.isArray(list))return [];
    const out=[], n=WEAR_N*WEAR_N, seen={};
    for(const p of list){
      if(!p||typeof p!=="object")continue;
      const slot=p.slot;
      if(slot!=="hat"&&slot!=="outfit"&&slot!=="shoes")continue;
      if(!isCustom(p.id)||!/^my:[a-z0-9]{1,24}$/.test(p.id)||seen[p.id])continue;
      const px=String(p.px==null?"":p.px);
      let clean="";
      /* charAt past the end returns "", and "".indexOf() is 0 — which would
         quietly read a short grid as a row of colour 0. The length check is
         what keeps a truncated piece a truncated piece. */
      for(let i=0;i<n;i++){
        const c=i<px.length?px.charAt(i):"";
        clean+=(c&&WEAR_KEY.indexOf(c)>=0)?c:".";
      }
      const name=(typeof safeText==="function")?safeText(p.name,18):String(p.name||"").slice(0,18);
      seen[p.id]=1;
      if(p.kind==="parts"){
        /* Every number is clamped to exactly the range the editor's own drag
           can produce, so a hand-edited save can make an ugly piece but never
           a broken one — and never one that paints outside its slot. */
        const N=(v,lo,hi,d)=>{const n=Math.round(Number(v)); return isFinite(n)?Math.max(lo,Math.min(hi,n)):d;};
        /* pid is a name, not a position: it survives reordering, which is
           what lets a child keep its parent when a box is sent to the
           front. A save that brings its own ids keeps them when they are
           whole and unique; anything else gets a fresh one. */
        const seenPid=new Set(); let nextPid=0;
        const freshPid=()=>{ while(seenPid.has(nextPid))nextPid++; return nextPid; };
        const parts=(Array.isArray(p.parts)?p.parts:[]).slice(0,PART_MAX).map(q=>{
          let pid=(q&&q.pid!=null)?Math.round(Number(q.pid)):NaN;
          if(!isFinite(pid)||pid<0||pid>9999||seenPid.has(pid))pid=freshPid();
          const o={
            cls:N(q&&q.cls,0,PART_MAX-1,0), pid:pid,
            x:N(q&&q.x,-40,140,10), y:N(q&&q.y,-40,140,10),
            w:N(q&&q.w,1,160,30),   h:N(q&&q.h,1,160,30),
            r:N(q&&q.r,0,50,0),     a:N(q&&q.a,-180,180,0),
            c:N(q&&q.c,0,WEAR_PAL.length-1,0),
            pad:N(q&&q.pad,0,40,0), mg:N(q&&q.mg,0,40,0),
            bw:N(q&&q.bw,0,20,0),   bc:N(q&&q.bc,0,WEAR_PAL.length-1,15),
            lay:N(q&&q.lay,0,LAY.length-1,0), gap:N(q&&q.gap,0,40,0),
            jus:N(q&&q.jus,0,JUS.length-1,0), ali:N(q&&q.ali,0,ALI.length-1,0)
          };
          /* Parents come first, always. A pin that does not name a box
             already read is simply not a pin — which is how a hand-edited
             save gets a cycle rejected without anything having to look for
             one. pid is re-issued by position so the links stay sound
             however the array was reordered on the way in. */
          const pin=(q&&q.pin!=null)?Math.round(Number(q.pin)):null;
          if(pin!=null&&isFinite(pin)&&seenPid.has(pin))o.pin=pin;
          seenPid.add(pid);
          const cn=(window.CC_CODE&&q)?CC_CODE.cleanName(q.cn):"";
          if(cn)o.cn=cn;
          return o;
        });
        const rt=p.root||{};
        const root={lay:N(rt.lay,0,LAY.length-1,0), pad:N(rt.pad,0,40,0),
                    gap:N(rt.gap,0,40,0), jus:N(rt.jus,0,JUS.length-1,0),
                    ali:N(rt.ali,0,ALI.length-1,0)};
        out.push({id:p.id,slot:slot,name:name||"?",kind:"parts",parts:parts,root:root});
      }
      /* sm is a look, not data: anything but an explicit false means curves */
      else out.push({id:p.id,slot:slot,name:name||"?",px:clean,sm:p.sm!==false});
      if(out.length>=WEAR_MAX*3)break;
    }
    return out;
  }
};
Object.keys(backs).forEach(k=>{window.CC_WEAR.back[k]=backs[k];});
})();
