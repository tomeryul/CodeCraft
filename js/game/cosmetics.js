"use strict";
/* =====================================================================
   Robot cosmetics — outfits, shoes and the hats' fit
   ---------------------------------------------------------------------
   The robot is a head on two short legs (robot-rig.js), so nothing here
   is drawn on a body: every built-in piece is made for THAT head, in the
   rig's own units, and turns with it.

     an outfit   is worn on the head itself, in up to three layers:
                   back   behind the head (a cape), in the body's space
                   shell  on the shell, inside its outline, under the screen
                   front  over the screen's edges and hanging below the head
     a shoe      IS the foot: it stands where the leg stub stood, on the
                 ground, and the head is lifted a little (SHOE_UP) so its
                 sole and its toe show under the head instead of a sliver
     a hat       stays the sprite from js/sprites.js; HAT_FIT says where
                 its brim and its top are, so it sits ON the head and the
                 antenna comes out of its top

   G, what a layer is handed (rig units, the head's own space):
     hw top H bot rad   the shell: half-width, top, height, bottom, corner
     lx ly              how far the lit face is moved inside it (the
                        darker tone shows on the right and underneath)
     sx sy sw sh        the screen; k = how wide it is now / face on
     fvis bvis          how much of the face / the back is turned to us
     ca sa              the head's yaw; pal = the team's three tones
     t gp sway          time, gait phase, sway — for whatever hangs

   A piece the player painted is still a grid in the old body units (the
   maker paints in WEAR_BOX); the rig maps that box onto the head, so the
   entry points outfit/shoe/hat are kept for it.
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
const TAU=Math.PI*2;
/* Two tones, the way the shell is painted: the whole shape in the darker
   one, then again in the lit one clipped to the lit face — so a piece
   shades along the right and underneath exactly where the shell does. */
function two(g,G,lit,shade,path,rule){
  g.fillStyle=shade;path();g.fill(rule||"nonzero");
  g.save();RR(g,-G.hw+G.lx,G.top+G.ly,G.hw*2,G.H,G.rad);g.clip();
  g.fillStyle=lit;path();g.fill(rule||"nonzero");g.restore();
}
/* the shell grown by d: what a wrapped band is clipped to, so it reads
   as wound round the head and a hair thicker than it */
function around(g,G,d){RR(g,-G.hw-d,G.top-d,G.hw*2+d*2,G.H+d*2,G.rad+d);}
/* the screen's rim, as screen() draws it */
function rim(G){const r=2.2;return{x:G.sx-G.sw/2-r,y:G.sy-G.sh/2-r,w:G.sw+r*2,h:G.sh+r*2,r:13.8};}
function fade(g,v){g.globalAlpha*=Math.max(0,Math.min(1,v));}

/* ---------- outfits ---------- */
const outfits={
  /* Hi-Vis Vest: orange from the cheeks down, zipped up under the screen,
     a silver band round the bottom and a silver strap up each side */
  vest:{covers:true,
    shell(g,G){
      const R=rim(G), yT=R.y+R.h*.55, yS=G.bot-7.2;
      two(g,G,"#ff8a3d","#ea6a2c",()=>{RR(g,-G.hw-2,yT,G.hw*2+4,G.bot-yT+4,4);});
      two(g,G,"#eef3fb","#c9d1df",()=>{g.beginPath();
        g.rect(-G.hw-2,yS,G.hw*2+4,2.8);
        if(G.fvis>.01)for(const x of [(R.x-G.hw)/2,(R.x+R.w+G.hw)/2])g.rect(x-1.3,yT,2.6,yS-yT);
        if(G.bvis>.01)for(const sd of [-1,1])g.rect(G.bu+sd*G.hw*.42-1.3,yT,2.6,yS-yT);});
      if(G.fvis<=.01)return;
      const yz=R.y+R.h+.4;
      g.fillStyle="#c4521c";g.fillRect(G.sx-.55,yz,1.1,G.bot-yz);
      g.fillStyle="#eef3fb";RR(g,G.sx-1,yz,2,2.8,.8);g.fill();
    }},
  /* Builder Apron: a belt round the bottom of the head and a short canvas
     apron hanging from it, a hammer and a pencil in its pocket */
  apron:{
    front(g,G){
      const by=G.bot-9.4;
      g.save();around(g,G,1.2);g.clip();
      g.fillStyle="#8a5a2b";g.fillRect(-G.hw-2,by,G.hw*2+4,3.6);
      g.fillStyle="#a8743f";g.fillRect(-G.hw-2,by,G.hw*2+4,1.1);
      g.restore();
      if(G.fvis<=.01)return;
      g.save();fade(g,G.fvis);
      const cx=G.sx, w=26*G.k, y0=by+1.6, y1=G.bot+5.8;
      /* the hammer behind the bib, the pencil in front of the pocket */
      g.save();g.translate(cx-w*.24,y0+4.2);g.rotate(-.42);
      g.fillStyle="#c98d4b";RR(g,-.9,-9.4,1.8,9.4,.9);g.fill();
      g.fillStyle="#9aa3b5";RR(g,-3.4,-11,6.8,2.8,1.1);g.fill();
      g.restore();
      RR(g,cx-w/2,y0,w,y1-y0,3.6);g.fillStyle="#c9b98c";g.fill();
      RR(g,cx-w/2,y0,w-1.6,y1-y0-1.4,3.6);g.fillStyle="#e8dcb8";g.fill();
      RR(g,cx-w/2+2.2,y0+3.8,w-4.4,5.8,1.6);g.fillStyle="#d6c69c";g.fill();
      g.fillStyle="#c4b58c";g.fillRect(cx-.4,y0+3.8,.8,5.8);
      g.save();g.translate(cx+w*.24,y0+4.6);g.rotate(.28);
      g.fillStyle="#ffd66b";RR(g,-.8,-6.4,1.6,6.4,.6);g.fill();
      g.fillStyle="#4a3728";g.beginPath();g.moveTo(-.8,-6.4);g.lineTo(.8,-6.4);g.lineTo(0,-8.2);g.closePath();g.fill();
      g.restore();
      /* the buckle */
      RR(g,cx-2.4,by-.3,4.8,4.2,1.1);g.fillStyle="#ffd66b";g.fill();
      RR(g,cx-1.1,by+1,2.2,1.6,.5);g.fillStyle="#8a5a2b";g.fill();
      g.restore();
    }},
  /* Stripes: a knitted scarf, wound round the bottom of the head and
     knotted at the front, its end hanging down past the head */
  stripes:{
    front(g,G){
      const y0=G.bot-8.8, h=9.4, ph=((G.sx*1.6)%7.2+7.2)%7.2;
      g.save();around(g,G,1.5);g.clip();
      g.fillStyle="#ff5d73";g.fillRect(-G.hw-2,y0,G.hw*2+4,h);
      g.fillStyle="#f2f3f7";for(let x=-G.hw-9+ph;x<G.hw+2;x+=7.2)g.fillRect(x,y0,3.2,h);
      g.fillStyle="rgba(140,24,60,.2)";g.fillRect(-G.hw-2,y0+h-2.6,G.hw*2+4,2.6);
      g.restore();
      if(G.fvis<=.01)return;
      g.save();fade(g,G.fvis);
      const kx=G.sx-G.sw*.3, ky=y0+h*.55, sw=(G.sway||0)*.012+Math.sin((G.gp||0)*TAU)*.05;
      g.save();g.translate(kx,ky+2);g.rotate(.16+sw);
      const L=11.5;
      g.fillStyle="#ff5d73";RR(g,-3.2,0,6.4,L,1.6);g.fill();
      g.fillStyle="#f2f3f7";g.fillRect(-3.2,2.6,6.4,2.4);g.fillRect(-3.2,6.8,6.4,2.4);
      g.fillStyle="rgba(140,24,60,.2)";g.fillRect(1.6,0,1.6,L-.6);
      g.fillStyle="#ff5d73";for(let i=0;i<4;i++)g.fillRect(-2.9+i*1.8,L-.4,1.1,1.8);
      g.restore();
      g.beginPath();g.ellipse(kx,ky,4.4,4.1,0,0,TAU);g.fillStyle="#e04a5f";g.fill();
      g.beginPath();g.ellipse(kx-.5,ky-.5,3.6,3.3,0,0,TAU);g.fillStyle="#ff5d73";g.fill();
      g.fillStyle="#f2f3f7";g.fillRect(kx-3.4,ky-.9,6.4,1.8);
      g.restore();
    }},
  /* Hoodie: a hood round the whole head, the face looking out of it, two
     drawstrings hanging down */
  hoodie:{covers:true,hi:"#a9dcff",
    shell(g,G){
      two(g,G,"#5ab8ff","#3f93cf",()=>{g.beginPath();g.rect(-G.hw-3,G.top-3,G.hw*2+6,G.H+6);});
      const R=rim(G), o={x:R.x-2.6,y:R.y-2.6,w:R.w+5.2,h:R.h+5.2,r:R.r+2.6};
      /* the seam over the crown */
      g.strokeStyle="#3f93cf";g.lineWidth=1.3;g.lineCap="round";
      g.beginPath();g.moveTo(G.sx*.8,G.top+1);g.lineTo(G.sx*.8,o.y-2);g.stroke();
      if(G.fvis<=.01)return;
      g.save();fade(g,G.fvis);
      RR(g,o.x-2.6,o.y-2.6,o.w+5.2,o.h+5.2,o.r+2.6);g.fillStyle="#3f93cf";g.fill();
      RR(g,o.x-2.6,o.y-2.6,o.w+3.8,o.h+3.8,o.r+2.6);g.fillStyle="#7cc8ff";g.fill();
      RR(g,o.x,o.y,o.w,o.h,o.r);g.fillStyle=G.pal.face;g.fill();
      g.restore();
    },
    front(g,G){
      if(G.fvis<=.01)return;
      const R=rim(G), y0=R.y+R.h+3.6, y1=G.bot+5.4, sw=(G.sway||0)*.03;
      g.save();fade(g,G.fvis);
      g.lineCap="round";g.lineWidth=1.5;g.strokeStyle="#f2f3f7";
      for(const sd of [-1,1]){
        const x=G.sx+sd*G.sw*.2, xe=x+sd*.6+sw;
        g.beginPath();g.moveTo(x,y0);g.quadraticCurveTo(x+sd*.8,(y0+y1)/2,xe,y1);g.stroke();
        RR(g,xe-1.2,y1-.4,2.4,3.4,1.2);g.fillStyle="#cfd4e0";g.fill();
      }
      g.restore();
    }},
  /* Lab Coat: a white coat from the cheeks down with its lapels under the
     screen and a pen in the pocket, and goggles pushed up on the forehead */
  lab:{covers:true,
    shell(g,G){
      const R=rim(G), yT=R.y+R.h*.55;
      two(g,G,"#f4f6fb","#d3d8e4",()=>{RR(g,-G.hw-2,yT,G.hw*2+4,G.bot-yT+4,4);});
      if(G.fvis<=.01)return;
      g.save();fade(g,G.fvis);
      const yb=R.y+R.h, cx=G.sx;
      /* the lapels: two folds meeting in a V under the screen */
      g.fillStyle="#e3e7f0";
      for(const sd of [-1,1]){g.beginPath();g.moveTo(cx+sd*G.sw*.34,yb-1);g.lineTo(cx+sd*1.2,G.bot-1.2);g.lineTo(cx+sd*G.sw*.16,yb-1);g.closePath();g.fill();}
      g.fillStyle=G.pal.face;g.beginPath();g.moveTo(cx-G.sw*.12,yb-1);g.lineTo(cx,G.bot-2.6);g.lineTo(cx+G.sw*.12,yb-1);g.closePath();g.fill();
      /* the pocket on the right, a blue pen in it */
      const px=R.x+R.w+1.4;
      if(px+4<G.hw){g.fillStyle="#5ab8ff";RR(g,px+1.4,yT+1,1.6,5,.8);g.fill();
        g.fillStyle="#dfe3ec";RR(g,px,yT+4,Math.min(6,G.hw-px-1),5,1.2);g.fill();}
      g.restore();
    },
    front(g,G){
      const y=G.top+7.4;
      g.save();around(g,G,.8);g.clip();
      g.fillStyle="#35325e";g.fillRect(-G.hw-2,y-1.6,G.hw*2+4,3.2);
      g.restore();
      if(G.fvis<=.01)return;
      g.save();fade(g,G.fvis);
      for(const sd of [-1,1]){
        const x=G.sx+sd*7.8*G.k;
        g.beginPath();g.arc(x,y,4.8,0,TAU);g.fillStyle="#35325e";g.fill();
        g.beginPath();g.arc(x,y,3.4,0,TAU);g.fillStyle="#9fe3ff";g.fill();
        g.beginPath();g.arc(x-1.1,y-1.1,1.1,0,TAU);g.fillStyle="#f2feff";g.fill();
      }
      g.fillStyle="#35325e";g.fillRect(G.sx-3.6*G.k,y-1,7.2*G.k,2);
      g.restore();
    }},
  /* Cape: hung from behind the ears, wider than the head, to the ground —
     a red collar and a gold clasp under the screen hold it on */
  cape:{
    back(g,G){
      const w=Math.sin((G.gp||0)*TAU)*1.8+(G.sway||0)*.04, f=.4+.6*Math.abs(G.ca), off=-G.sa*G.hw*.45;
      const y0=G.top+G.H*.42, y1=1.6, a=G.hw*.8*f, b=(G.hw+8)*f;
      g.save();g.translate(off,0);
      g.beginPath();g.moveTo(-a,y0);g.quadraticCurveTo(0,y0-3,a,y0);
      g.quadraticCurveTo(b-1+w,y0+14,b+w*1.4,y1);
      g.quadraticCurveTo(w,y1+4.5,-b+w*1.4,y1);
      g.quadraticCurveTo(-b+1+w,y0+14,-a,y0);g.closePath();
      g.fillStyle="#e04a5f";g.fill();
      g.beginPath();g.moveTo(a*.15,y0);g.quadraticCurveTo(b*.5+w,y0+16,b*.55+w*1.4,y1+2.8);
      g.quadraticCurveTo(b*.2+w,y1+3.8,a*.15,y0);g.closePath();g.fillStyle="#c23a55";g.fill();
      g.restore();
    },
    front(g,G){
      const y=G.bot-8.6;
      g.save();around(g,G,1);g.clip();
      g.fillStyle="#e04a5f";g.fillRect(-G.hw-2,y,G.hw*2+4,3.4);
      g.fillStyle="#ff5d73";g.fillRect(-G.hw-2,y,G.hw*2+4,1.1);
      g.restore();
      if(G.fvis<=.01)return;
      g.save();fade(g,G.fvis);
      g.beginPath();g.arc(G.sx,y+1.7,3.3,0,TAU);g.fillStyle="#e8b23e";g.fill();
      g.beginPath();g.arc(G.sx-.3,y+1.4,2.4,0,TAU);g.fillStyle="#ffd66b";g.fill();
      g.beginPath();g.arc(G.sx-1.1,y+.7,.8,0,TAU);g.fillStyle="#fff6d6";g.fill();
      g.restore();
    }}
};
/* Back pieces, kept by name for whoever asks "is this worn behind?" */
const backs={};Object.keys(outfits).forEach(k=>{if(outfits[k].back)backs[k]=outfits[k].back;});

/* ---------- shoes: each one IS a foot ----------
   Foot-local: the origin is under the middle of the foot, on the ground;
   F.w is how wide the leg stub would be from here and F.side which way it
   points (-1, 0 face on, 1), so a shoe seen from the side is longer, its
   toe forward. The upper reaches up behind the head, which hides its top:
   what shows is the toe, the sides and the sole. */
const SHOE_UP=2.6;   // the head stands this much higher in shoes
function shoeBox(F){const w=F.w+1.6, L=w+Math.abs(F.side)*3.6;return{w,L,x:-L/2+F.side*1.8};}
const shoes={
  boots(g,F){const b=shoeBox(F);
    RR(g,b.x,-12,b.L,10,3.6);g.fillStyle="#8a5a2b";g.fill();
    RR(g,b.x,-12,b.L-1.6,8.8,3.4);g.fillStyle="#9b6634";g.fill();
    const tx=F.side>0?b.x+b.L-6:F.side<0?b.x+.4:-b.w*.36, tw=F.side?5.6:b.w*.72;
    RR(g,tx,-6,tw,3.6,1.8);g.fillStyle="#b07a45";g.fill();
    g.fillStyle="#6e4422";g.fillRect(b.x,-8.4,b.L-1.6,1);
    RR(g,b.x-.6,-2.9,b.L+1.2,3.3,1.5);g.fillStyle="#4a3728";g.fill();
  },
  sneakers(g,F){const b=shoeBox(F);
    RR(g,b.x,-11,b.L,9,3.8);g.fillStyle="#d3d8e4";g.fill();
    RR(g,b.x,-11,b.L-1.4,8,3.6);g.fillStyle="#f4f6fb";g.fill();
    g.fillStyle="#5ab8ff";g.fillRect(b.x,-7.2,b.L-1.4,1.6);
    const tx=F.side>0?b.x+b.L-5.4:F.side<0?b.x:-b.w*.34, tw=F.side?5.4:b.w*.68;
    RR(g,tx,-4.8,tw,2.6,1.3);g.fillStyle="#e3e7f0";g.fill();
    RR(g,b.x-.6,-2.6,b.L+1.2,3,1.4);g.fillStyle="#5ab8ff";g.fill();
    g.fillStyle="#f4f6fb";g.fillRect(b.x+.4,-2.6,b.L-.8,.8);
  },
  wellies(g,F){const b=shoeBox(F);
    RR(g,b.x+.2,-13,b.L-.4,11,3.2);g.fillStyle="#3fb257";g.fill();
    RR(g,b.x+.2,-13,b.L-2,10,3);g.fillStyle="#54d66a";g.fill();
    RR(g,b.x+1.6,-10,1.3,6.4,.65);g.fillStyle="#a6f0b0";g.fill();
    RR(g,b.x-.5,-2.6,b.L+1,3,1.4);g.fillStyle="#241b45";g.fill();
  },
  rockets(g,F){const b=shoeBox(F);
    RR(g,b.x,-12,b.L,9.6,3.6);g.fillStyle="#b4bccb";g.fill();
    RR(g,b.x,-12,b.L-1.5,8.6,3.4);g.fillStyle="#dfe3ec";g.fill();
    g.fillStyle="#ff5d73";g.fillRect(b.x,-6.4,b.L,1.9);
    RR(g,b.x-.4,-3,b.L+.8,2.8,1.3);g.fillStyle="#6e7690";g.fill();
    const nw=b.w*.42;
    g.fillStyle="#9aa3b5";g.beginPath();g.moveTo(-nw/2,-.4);g.lineTo(nw/2,-.4);g.lineTo(nw*.36,1.6);g.lineTo(-nw*.36,1.6);g.closePath();g.fill();
    if(F.moving){
      const fl=.7+.3*Math.sin((F.t||0)/70);
      g.fillStyle="#ffb830";g.beginPath();g.moveTo(-nw*.36,1.6);g.lineTo(nw*.36,1.6);g.lineTo(0,1.6+5.6*fl);g.closePath();g.fill();
      g.fillStyle="#ffe9a0";g.beginPath();g.moveTo(-nw*.18,1.6);g.lineTo(nw*.18,1.6);g.lineTo(0,1.6+3.2*fl);g.closePath();g.fill();
    }
  }
};

/* ---------- hats: where each sprite's brim and top are ----------
   In the sprite's own 48-unit box: brim = the bottom of the brim (it sits
   on the shell's top edge, sunk into it a little), top = the top of the
   crown (the antenna comes out there). */
const HAT_FIT={
  "🎩":{brim:34.5,top:12}, "⛑️":{brim:34.5,top:14}, "⛑":{brim:34.5,top:14},
  "👑":{brim:34.5,top:17}, "🎓":{brim:33,top:16}, "🤠":{brim:28,top:11.5},
  "🥳":{brim:33.5,top:8}
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
function rrEl(g,x,y,w,h,rx,ry){ g.beginPath(); rrElSub(g,x,y,w,h,rx,ry); }
function rrElSub(g,x,y,w,h,rx,ry){
  rx=Math.min(rx,w/2); ry=Math.min(ry,h/2);
  const P=Math.PI;
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
/* `org` is which corner of the box its left/top name: 0 the top-left, the
   way a browser measures by default, or 1 its own centre — which in CSS is
   translate(-50%, -50%), the idiom every front-end developer learns and
   the only honest way to say "put this in the middle of that". */
const BOXF={pad:0,mg:0,bw:0,bc:15,lay:0,gap:0,jus:0,ali:0,org:0};
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
        const w=p.w*sx, h=p.h*sy;
        /* translate(-50%, -50%): half of the box's OWN size, which is what
           makes the idiom work whatever size the box happens to be */
        const off=bf(p,"org")===1?.5:0;
        const r={x:c.x+p.x*sx-w*off,y:c.y+p.y*sy-h*off,w:w,h:h};
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
/* A box with c === -1 has no colour: it is a <div> that only holds other
   boxes, the way most of a real page's divs do. It paints nothing — a
   border ring if it has one — and in the editor (`edit`) it is traced
   with a faint dashed line so it can still be found and dragged. */
function paintParts(g,box,parts,focus,root,edit){
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
    const bw=bf(pt,"bw")*K, clear=(pt.c|0)<0;
    if(bw>0){
      /* a border is a ring: the border colour fills the whole box and the
         background fills what is left inside it, which is exactly the order
         a browser paints them in — unless there is no background, when the
         ring has to be cut out rather than painted over */
      const iw=Math.max(0,w-bw*2), ih=Math.max(0,h-bw*2);
      rrEl(g,x,y,w,h,w*pt.r/100,h*pt.r/100);
      g.fillStyle=WEAR_PAL[bf(pt,"bc")]||WEAR_PAL[15];
      if(clear&&iw>0&&ih>0){
        rrElSub(g,x+bw,y+bw,iw,ih,iw*pt.r/100,ih*pt.r/100);
        g.fill("evenodd");
      }else{
        g.fill();
        if(iw>0&&ih>0){
          rrEl(g,x+bw,y+bw,iw,ih,iw*pt.r/100,ih*pt.r/100);
          g.fillStyle=WEAR_PAL[pt.c]||WEAR_PAL[0];
          g.fill();
        }
      }
    }else if(!clear){
      rrEl(g,x,y,w,h,w*pt.r/100,h*pt.r/100);
      g.fillStyle=WEAR_PAL[pt.c]||WEAR_PAL[0];
      g.fill();
    }
    if(clear&&edit){
      rrEl(g,x,y,w,h,w*pt.r/100,h*pt.r/100);
      /* body units: the canvas is scaled, so this is a hairline on screen */
      g.save();g.setLineDash([1.4,1.4]);g.lineWidth=0.35;
      g.strokeStyle="rgba(255,255,255,.55)";g.stroke();g.restore();
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
  outfits:outfits, backs:backs, shoes:shoes, shoeUp:SHOE_UP, hatFit:HAT_FIT,
  pal:WEAR_PAL, key:WEAR_KEY, cells:WEAR_N, max:WEAR_MAX, prefix:WEAR_PRE, box:WEAR_BOX,
  names:WEAR_NAME, rad:PART_RAD, partMax:PART_MAX,
  isCustom:isCustom,
  /* the maker's build canvas draws the working parts straight */
  parts(g,slot,list,focus,root,edit){const b=WEAR_BOX[slot]; if(b)paintParts(g,b,list,focus,root,edit);},
  /* one answer to "where is that box", shared by the paint, the drag and
     the box-model overlay */
  layout:layoutParts, rings:boxRings, lay:LAY, jus:JUS, ali:ALI, boxDefault:BOXF,
  field:bf,
  /* a painted outfit: body-local, the caller has mapped the body square
     onto the shell and clipped to it. The built-in ones are worn by fit() */
  outfit(g,id){
    const p=customPiece(id); if(p)return paintPiece(g,"outfit",p);
  },
  /* one layer of a built-in outfit on the head ("back", "shell", "front");
     true if the outfit has that layer */
  fit(g,id,layer,G){const o=outfits[id]; if(!o||!o[layer])return false; o[layer](g,G); return true;},
  /* a built-in outfit's back piece (the cape), in the body's space */
  back(g,id,G){const o=outfits[id]; if(o&&o.back)o.back(g,G);},
  /* a shoe IS the foot: foot-local, origin on the ground under it. F is
     {w, side, moving, t}; a painted one keeps its old box, at the ankle */
  shoe(g,id,F){
    const p=customPiece(id); if(p)return paintPiece(g,"shoes",p);
    const f=shoes[id]; if(f)f(g,F||{w:12,side:0});
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
            c:N(q&&q.c,-1,WEAR_PAL.length-1,0),
            pad:N(q&&q.pad,0,40,0), mg:N(q&&q.mg,0,40,0),
            bw:N(q&&q.bw,0,20,0),   bc:N(q&&q.bc,0,WEAR_PAL.length-1,15),
            lay:N(q&&q.lay,0,LAY.length-1,0), gap:N(q&&q.gap,0,40,0),
            jus:N(q&&q.jus,0,JUS.length-1,0), ali:N(q&&q.ali,0,ALI.length-1,0),
            org:N(q&&q.org,0,1,0)
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
