"use strict";
/* ---------------- sprites ---------------- */
const spriteCache=new Map();
function sprite(ch,size){
  const s=Math.round(size), k=ch+"@"+s;
  let c=spriteCache.get(k);
  if(!c&&window.CC_SPRITES){const sc=window.CC_SPRITES.canvas(ch,s);if(sc){spriteCache.set(k,sc);return sc;}}
  if(!c){
    const R=3;
    c=document.createElement("canvas");
    c.lw=Math.ceil(s*1.3);
    c.width=c.height=c.lw*R;
    const g=c.getContext("2d");
    g.textAlign="center";g.textBaseline="middle";
    g.font=(s*R)+'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    g.fillText(ch,c.width/2,c.height/2+s*R*.05);
    spriteCache.set(k,c);
  }
  return c;
}

/* ---------------- render ---------------- */
const GRASS=["#79c34e","#71ba47","#7fc957"],SANDC="#ecd9a0",ROCKC=["#a9a9b4","#b3b3be","#9f9faa"],WATERC=["#3f9fd8","#48a8e0"];
const OBJ_EM={rock:"🪨",iron:"⛓️",crystal:"💎",home:"🏠",market:"🏪",chest:"📦",bridge:"🌉",flower:"🌼",gift:"🎁"};
let now=0, lastDtSec=0.016;
/* terrain chunk cache — terrain never mutates after generation */
const CHUNK=16, chunks=new Map();
function tileHash(x,y){let h=(x*374761393+y*668265263)^(seed|0);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;}
function getChunk(cx,cy){
  const ck=cx+"_"+cy;
  let c=chunks.get(ck);
  if(c)return c;
  c=document.createElement("canvas");c.width=c.height=CHUNK*TILE*2;
  const g=c.getContext("2d");g.scale(2,2);
  for(let ly=0;ly<CHUNK;ly++)for(let lx=0;lx<CHUNK;lx++){
    const x=cx*CHUNK+lx, y=cy*CHUNK+ly;
    if(x>=W||y>=H)continue;
    const tr=terrain[key(x,y)], px=lx*TILE, py=ly*TILE;
    if(tr===T_WATER)g.fillStyle="#3f9fd8";
    else if(tr===T_SAND)g.fillStyle=SANDC;
    else if(tr===T_GRASS)g.fillStyle=GRASS[(x*31+y*17)%3];
    else g.fillStyle=ROCKC[(x*31+y*17)%3];
    g.fillRect(px,py,TILE+1,TILE+1);
    const h1=tileHash(x,y),h2=tileHash(x*3+1,y),h3=tileHash(x,y*5+2);
    if(tr===T_GRASS){
      g.fillStyle="rgba(38,96,24,.28)";
      g.fillRect(px+h1*(TILE-6)+2,py+h2*(TILE-8)+2,2,5);
      g.fillRect(px+h3*(TILE-6)+2,py+h1*(TILE-8)+2,2,4);
      if(h2<.12){g.fillStyle="rgba(255,255,255,.5)";g.fillRect(px+h3*(TILE-8)+3,py+h2*(TILE-8)+3,3,3);}
    }else if(tr===T_SAND){
      g.fillStyle="rgba(150,120,60,.3)";
      g.beginPath();g.arc(px+h1*TILE,py+h2*TILE,1.6,0,7);g.arc(px+h3*TILE,py+h1*TILE,1.3,0,7);g.fill();
    }else if(tr===T_ROCKY){
      g.fillStyle="rgba(60,60,75,.3)";
      g.beginPath();g.arc(px+h1*TILE,py+h2*TILE,2.2,0,7);g.arc(px+h3*TILE,py+h1*TILE,1.6,0,7);g.fill();
      g.fillStyle="rgba(255,255,255,.14)";
      g.fillRect(px+h2*(TILE-8),py+h3*(TILE-8),4,2);
    }
    // depth shading at terrain-type boundaries
    if(tr!==T_WATER&&y+1<H&&terrain[key(x,y+1)]===T_WATER){g.fillStyle="rgba(0,0,0,.18)";g.fillRect(px,py+TILE-3,TILE+1,3);}
    if(tr!==T_WATER&&y>0&&terrain[key(x,y-1)]===T_WATER){g.fillStyle="rgba(255,255,255,.12)";g.fillRect(px,py,TILE+1,2);}
  }
  chunks.set(ck,c);
  return c;
}
/* drifting clouds */
const clouds=Array.from({length:6},(_,i)=>({
  x:(i*1319)%(W*TILE),y:((i*761)%(H*TILE)),s:.7+(i%3)*.35,v:6+(i%4)*3}));
function draw(t){
  const w=VW,h=VH;
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.fillStyle="#2c7fb8";ctx.fillRect(0,0,w,h);
  if(follow){
    const r=R();
    let ty=(r.ry+.5)*TILE;
    // keep the robot visible above the editor sheet on mobile (not when maximized — the world is intentionally hidden then)
    const ed=$("editor");
    if(ed.classList.contains("open")&&!ed.classList.contains("max")&&innerWidth<920)ty+=h*0.24/cam.scale;
    cam.x=lerp(cam.x,(r.rx+.5)*TILE,.12);cam.y=lerp(cam.y,ty,.12);
  }
  cam.x=clamp(cam.x,0,W*TILE);cam.y=clamp(cam.y,0,H*TILE);
  ctx.translate(w/2,h/2);ctx.scale(cam.scale,cam.scale);ctx.translate(-cam.x,-cam.y);
  const x0=clamp(Math.floor((cam.x-w/2/cam.scale)/TILE)-1,0,W-1);
  const x1=clamp(Math.ceil((cam.x+w/2/cam.scale)/TILE)+1,0,W-1);
  const y0=clamp(Math.floor((cam.y-h/2/cam.scale)/TILE)-1,0,H-1);
  const y1=clamp(Math.ceil((cam.y+h/2/cam.scale)/TILE)+1,0,H-1);
  // terrain via cached chunks
  const cx0=Math.floor(x0/CHUNK),cx1=Math.floor(x1/CHUNK),cy0=Math.floor(y0/CHUNK),cy1=Math.floor(y1/CHUNK);
  for(let cy=cy0;cy<=cy1;cy++)for(let cx=cx0;cx<=cx1;cx++)
    ctx.drawImage(getChunk(cx,cy),cx*CHUNK*TILE,cy*CHUNK*TILE,CHUNK*TILE,CHUNK*TILE);
  // animated water: ripples + foam at shores
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    if(terrain[key(x,y)]!==T_WATER)continue;
    const wx=x*TILE,wy=y*TILE;
    const ph=Math.sin(t/750+x*1.4+y*.8);
    ctx.globalAlpha=.10+.07*ph;
    ctx.fillStyle="#cfeaff";
    ctx.fillRect(wx+7,wy+TILE*(.35+.15*Math.sin(t/950+x)),TILE-14,3);
    ctx.globalAlpha=.5;
    ctx.fillStyle="rgba(255,255,255,.55)";
    if(y>0&&terrain[key(x,y-1)]!==T_WATER)ctx.fillRect(wx,wy+1+Math.sin(t/600+x)*1.2,TILE+1,2.5);
    if(x>0&&terrain[key(x-1,y)]!==T_WATER)ctx.fillRect(wx+1+Math.sin(t/600+y)*1.2,wy,2.5,TILE+1);
    ctx.globalAlpha=1;
  }
  // home territory: animated dashed border
  ctx.strokeStyle="rgba(255,214,107,.55)";ctx.lineWidth=3;
  ctx.setLineDash([12,8]);ctx.lineDashOffset=-t/40;
  ctx.strokeRect((homePos.x-3.5)*TILE,(homePos.y-3.5)*TILE,7*TILE,7*TILE);
  ctx.setLineDash([]);
  // player-built ground layer (paths / wooden floors) — under everything
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const o=objects.get(key(x,y));
    if(o&&o.type==="decor"&&window.CC_DECOR&&CC_DECOR.layer(o.deco)==="ground")
      CC_DECOR.draw(ctx,o.deco,x,y,t);
  }
  // objects
  const es=TILE*.88;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const o=objects.get(key(x,y));if(!o)continue;
    let ch=null,sz=es;
    if(o.type==="tree")ch=o.stage===0?"🌱":o.stage===1?"🌿":"🌳";
    else if(o.type==="item"){ch=RES[o.item].em;sz=es*.6;}
    else if(o.type==="proj"){ch=o.em;sz=es*1.2;}
    else if(o.type==="decor"){ // player-placed build-mode piece
      if(window.CC_DECOR){
        const ly=CC_DECOR.layer(o.deco);
        if(ly==="ground"||ly==="roof")continue;       // handled in their own passes
        if(ly==="mid"&&CC_DECOR.draw(ctx,o.deco,x,y,t))continue; // autotiled / procedural
      }
      ch=o.em;
    }
    else ch=OBJ_EM[o.type];
    if(o.type==="home"||o.type==="market")sz=es*1.12;
    if(ch){
      const sp=sprite(ch,sz);
      if(o.type==="tree"||o.type==="flower"){
        // wind sway, pivoting at the trunk base
        const sw=Math.sin(t/900+(x*13+y*7)%6.28)*.05;
        ctx.save();
        ctx.translate((x+.5)*TILE,(y+.92)*TILE);
        ctx.rotate(sw);
        ctx.drawImage(sp,-sp.lw/2,-sp.lw+TILE*.14,sp.lw,sp.lw);
        ctx.restore();
      }else if(o.type==="gift"){
        const bob2=Math.sin(t/400+x)*2.5;
        ctx.drawImage(sp,(x+.5)*TILE-sp.lw/2,(y+.5)*TILE-sp.lw/2+bob2,sp.lw,sp.lw);
        ctx.globalAlpha=.35+.25*Math.sin(t/300+y);
        const gl=sprite("✨",TILE*.4);
        ctx.drawImage(gl,(x+.85)*TILE-gl.lw/2,(y+.1)*TILE,gl.lw,gl.lw);
        ctx.globalAlpha=1;
      }else{
        ctx.drawImage(sp,(x+.5)*TILE-sp.lw/2,(y+.5)*TILE-sp.lw/2,sp.lw,sp.lw);
      }
      if(o.type==="crystal"&&Math.random()<.02)burst(x,y,"sparkle");
      if(o.type==="item"&&o.n>1){
        ctx.fillStyle="#fff";ctx.font="bold 11px sans-serif";ctx.textAlign="center";
        ctx.fillText("x"+o.n,(x+.5)*TILE+10,(y+.5)*TILE+12);
      }
    }
  }
  // roof layer — drawn above walls so buildings read as solid structures
  if(window.CC_DECOR)for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const o=objects.get(key(x,y));
    if(o&&o.type==="decor"&&CC_DECOR.layer(o.deco)==="roof")CC_DECOR.draw(ctx,o.deco,x,y,t);
  }
  drawTeamLayer(t,x0,y0,x1,y1);
  // animals
  for(const a of animals){
    a.rx=lerp(a.rx,a.x,.08);a.ry=lerp(a.ry,a.y,.08);
    const sp=sprite(a.em,TILE*.62);
    ctx.drawImage(sp,(a.rx+.5)*TILE-sp.lw/2,(a.ry+.5)*TILE-sp.lw/2-Math.abs(Math.sin(t/300+a.x))*3,sp.lw,sp.lw);
  }
  // robots
  robots.forEach((r,i)=>{
    /* a step is walked at an even pace that fills the tick, so a run of
       steps is one unbroken walk rather than a dart and a wait */
    const stepMs=robotStepMs(r), v=lastDtSec*1000/(stepMs*.96);
    r.rx=glide(r.rx,r.x,v);r.ry=glide(r.ry,r.y,v);
    const cx=(r.rx+.5)*TILE, cy=(r.ry+.5)*TILE, s2=TILE*.72;
    /* the robot stands on its tile where it always has, its feet at gy,
       a little shorter than the old one: rs is one rig unit in world px,
       hy is just above the antenna (or the hat) */
    const rs=s2/76.9, gy=cy+s2*.66, hy=gy-(r.hat?122:114)*rs;
    if(i===selRobot){
      ctx.save();
      const k=Math.sin(t/250);
      ctx.beginPath();ctx.ellipse(cx,gy,TILE*.46+k*1.5,TILE*.2+k*.6,0,0,7);
      ctx.strokeStyle="rgba(255,214,107,.9)";ctx.lineWidth=3;
      ctx.setLineDash([10,7]);ctx.lineDashOffset=-t/30;ctx.stroke();ctx.setLineDash([]);
      ctx.restore();
    }
    const moving=Math.abs(r.rx-r.x)+Math.abs(r.ry-r.y)>.001;
    // per-action tell (r.anim set by the interpreter)
    const A=r.anim; let ap=1, atype=null;
    if(A){
      /* a tool swing stretches to fill the gap until the next sim step, so
         a faster robot swings faster; a turn is quick, a rest is long */
      const dur=A.type==="rest"?1400:A.type==="wait"?stepMs:A.type==="move"?(r.blocked?Math.max(420,Math.min(700,stepMs*.95)):220):
        (A.type==="turnL"||A.type==="turnR")?Math.max(220,Math.min(560,stepMs*.9)):
        Math.max(320,Math.min(1250,stepMs*(WORK_ACTS[A.type]?WORK_TICKS:1)*.95));
      /* an action is stamped with performance.now() during the frame, and the
         frame is drawn with the time it STARTED, a moment earlier — so the
         first frame of a clip reads a little below zero. That is the clip
         starting, not a stale one; clearing it there is what used to make
         every action vanish before it was ever drawn. */
      ap=Math.max(0,(t-A.t0)/dur);
      if(ap>=1){r.anim=null;ap=1;}else atype=A.type;
    }
    const B=CC_RIG.botFor(r);
    B.color=safeColor(r.color);B.face(r.dir);
    const P=robotPose(r,B,atype,ap,moving,t,i);
    B.update(lastDtSec*1000,P);
    B.draw(ctx,P,cx+B.st.nx,gy+B.st.ny,rs,{t,glow:false,wear:{hat:r.hat,outfit:r.outfit,shoes:r.shoes}});
    robotFx(r,B,atype,ap);
    // sleepy Zzz while resting
    if(atype==="rest"){
      ctx.font='bold 11px "Fredoka",sans-serif';ctx.textAlign="center";ctx.fillStyle="#e6ecff";
      const zp=(t/450)%1, zp2=(zp+.5)%1;
      ctx.globalAlpha=.8*(1-zp);ctx.fillText("z",cx+s2*.42,hy+10-zp*11);
      ctx.globalAlpha=.6*(1-zp2);ctx.fillText("z",cx+s2*.56,hy+4-zp2*11);
      ctx.globalAlpha=1;
    }
    // name
    ctx.fillStyle="rgba(20,14,45,.75)";
    const nm=r.name;ctx.font='bold 11px "Fredoka",sans-serif';ctx.textAlign="center";
    const tw=ctx.measureText(nm).width;
    rr(ctx,cx-tw/2-5,hy-14,tw+10,15,7);ctx.fill();
    ctx.fillStyle="#fff";ctx.fillText(nm,cx,hy-2.5);
    // speech bubble
    if(r.say){
      if(now>r.say.until)r.say=null;
      else{
        ctx.font='bold 12px "Fredoka",sans-serif';
        const sw2=ctx.measureText(r.say.txt).width;
        const bx=cx-sw2/2-8, by=hy-38;
        ctx.fillStyle="#fff";
        rr(ctx,bx,by,sw2+16,20,9);ctx.fill();
        ctx.beginPath();ctx.moveTo(cx-4,by+19);ctx.lineTo(cx+5,by+19);ctx.lineTo(cx,by+26);ctx.closePath();ctx.fill();
        ctx.fillStyle="#241b45";ctx.fillText(r.say.txt,cx,by+14);
      }
    }
    if(r.blocked){
      const sp=sprite(r.tired?"😴":"💢",r.tired?16:14);ctx.drawImage(sp,cx+s2*.42,hy+12,sp.lw,sp.lw);
    }
    /* v5: the action badge — what the robot is doing, and what it is
       doing it TO, drawn from the same SVG art as the UI (CC_SPRITES)
       instead of the device's emoji font. */
    if(atype){
      const A={chop:"🪓",mine:"⛏️",scoop:"🪣",collect:"✋",drop:"⤵️",build:"🔨",pickUp:"✊"};
      const ae=A[atype];
      if(ae){
        let te=null;
        try{
          const tx=r.x+DX[r.dir], ty=r.y+DY[r.dir];
          const o=objects.get(key(tx,ty));
          if(o)te=(o.type==="tree")?"🌳":(OBJ_EM[o.type]||null);
          else if(terrain[key(tx,ty)]===T_WATER)te="💧";
        }catch(_){}
        const ic=16, pad=5, gap=te?4:0, w=pad*2+ic+(te?ic+gap:0), h=ic+pad*2;
        const bx=cx-w/2, by=hy-38;
        ctx.fillStyle="rgba(23,17,48,.86)";rr(ctx,bx,by,w,h,h/2);ctx.fill();
        ctx.strokeStyle="rgba(255,255,255,.14)";ctx.lineWidth=1.5;
        rr(ctx,bx,by,w,h,h/2);ctx.stroke();
        const s1=sprite(ae,ic);
        ctx.drawImage(s1,bx+pad+ic/2-s1.lw/2,by+h/2-s1.lw/2,s1.lw,s1.lw);
        if(te){
          const s3=sprite(te,ic);
          ctx.drawImage(s3,bx+pad+ic+gap+ic/2-s3.lw/2,by+h/2-s3.lw/2,s3.lw,s3.lw);
        }
      }
    }
    // energy bar under the robot when not full
    const en=r.energy==null?100:r.energy;
    if(en<100){
      const bw=s2*.9, bx=cx-bw/2, by=gy+3;
      ctx.fillStyle="rgba(0,0,0,.4)";rr(ctx,bx,by,bw,4,2);ctx.fill();
      ctx.fillStyle=en<25?"#ff5d73":en<55?"#ffb830":"#54d66a";
      rr(ctx,bx,by,Math.max(2,bw*en/100),4,2);ctx.fill();
    }
  });
  // world particles
  for(let i=parts.length-1;i>=0;i--){
    const p=parts[i];p.t+=lastDtSec;
    if(p.t>=p.life){parts.splice(i,1);continue;}
    p.vy+=p.g*lastDtSec;p.x+=p.vx*lastDtSec;p.y+=p.vy*lastDtSec;
    ctx.globalAlpha=1-p.t/p.life;
    ctx.fillStyle=p.c;
    ctx.beginPath();ctx.arc(p.x,p.y,p.s,0,7);ctx.fill();
  }
  ctx.globalAlpha=1;
  // drifting clouds + shadows
  for(const c of clouds){
    c.x+=c.v*lastDtSec;
    if(c.x>W*TILE+300)c.x=-300;
    if(c.x+260<cam.x-w/cam.scale||c.x-260>cam.x+w/cam.scale)continue;
    ctx.fillStyle="rgba(0,0,0,.06)";
    ctx.beginPath();ctx.ellipse(c.x+26,c.y+34,90*c.s,26*c.s,0,0,7);ctx.fill();
    ctx.fillStyle="rgba(255,255,255,.4)";
    ctx.beginPath();
    ctx.ellipse(c.x,c.y,70*c.s,22*c.s,0,0,7);
    ctx.ellipse(c.x-46*c.s,c.y+7,42*c.s,16*c.s,0,0,7);
    ctx.ellipse(c.x+50*c.s,c.y+6,46*c.s,17*c.s,0,0,7);
    ctx.fill();
  }
  // gentle day cycle + fireflies at dusk
  const ph2=(simTime%180000)/180000;
  const dusk=Math.max(0,-Math.sin(ph2*6.283));
  if(dusk>.05){
    for(let i=0;i<10;i++){
      const fxp=tileHash(i*7+3,i*13+1), fyp=tileHash(i*11+5,i*3+9);
      const fwx=(x0+fxp*(x1-x0))*TILE, fwy=(y0+fyp*(y1-y0))*TILE;
      const fl=.5+.5*Math.sin(t/300+i*2.1);
      ctx.globalAlpha=dusk*.5*fl;
      ctx.fillStyle="#ffe9a0";
      ctx.beginPath();ctx.arc(fwx+Math.sin(t/800+i)*14,fwy+Math.cos(t/1000+i)*10,2.4,0,7);ctx.fill();
    }
    ctx.globalAlpha=1;
  }
  // floating reward popups
  for(let i=pops.length-1;i>=0;i--){
    const p=pops[i], age=(t-p.t0)/1000;
    if(age>1){pops.splice(i,1);continue;}
    ctx.globalAlpha=1-age;
    ctx.font='bold 15px "Fredoka",sans-serif';ctx.textAlign="center";
    ctx.fillStyle="#fff";ctx.strokeStyle="rgba(0,0,0,.55)";ctx.lineWidth=3;
    const px=(p.x+.5)*TILE, py=(p.y+.2)*TILE-age*26;
    /* v5: the resource in a pop is drawn art, not an emoji glyph */
    const mm=p.txt.match(/^(\S+?)\s*([+\-−]?\s*\d.*)$/);
    if(mm&&window.CC_SPRITES&&CC_SPRITES.has(mm[1])){
      const sp=sprite(mm[1],16), tw2=ctx.measureText(mm[2]).width;
      ctx.drawImage(sp,px-tw2/2-sp.lw*.9,py-sp.lw/2,sp.lw,sp.lw);
      ctx.textAlign="left";
      ctx.strokeText(mm[2],px-tw2/2+3,py);ctx.fillText(mm[2],px-tw2/2+3,py);
      ctx.textAlign="center";
    }else{
      ctx.strokeText(p.txt,px,py);ctx.fillText(p.txt,px,py);
    }
    ctx.globalAlpha=1;
  }
  // screen-space: day tint + confetti
  ctx.setTransform(DPR,0,0,DPR,0,0);
  const warm=Math.max(0,Math.sin(ph2*6.283));
  if(warm>.05){ctx.fillStyle="rgba(255,150,60,"+(warm*.06).toFixed(3)+")";ctx.fillRect(0,0,w,h);}
  if(dusk>.05){ctx.fillStyle="rgba(50,50,140,"+(dusk*.08).toFixed(3)+")";ctx.fillRect(0,0,w,h);}
  for(let i=fx.length-1;i>=0;i--){
    const p=fx[i];p.t+=lastDtSec;
    if(p.t>=p.life){fx.splice(i,1);continue;}
    p.vy+=800*lastDtSec;p.x+=p.vx*lastDtSec;p.y+=p.vy*lastDtSec;p.rot+=p.vr*lastDtSec;
    ctx.save();
    ctx.globalAlpha=Math.min(1,2*(1-p.t/p.life));
    ctx.translate(p.x,p.y);ctx.rotate(p.rot);
    ctx.fillStyle=p.c;ctx.fillRect(-4,-2.5,8,5);
    ctx.restore();
  }
}
/* What a world robot is doing this frame, as one pose of the rig
   (robot-rig.js): the clip of the block it is running, else its walk, else
   waiting, tired or idle. The walk is driven by distance, not the clock,
   so the feet keep pace with the tile and a speed upgrade lengthens the
   stride into a run. */
const RIG_OF={turnL:"turn",turnR:"turn",collect:"collect",chop:"chop",mine:"mine",scoop:"scoop",
  drop:"drop",build:"build",rest:"rest",wait:"wait",pickUp:"lift"};
function robotPose(r,B,atype,ap,moving,t,i){
  const S=B.st||(B.st={gp:(i*.37)%1,runk:0,wb:0,px:r.rx,py:r.ry,anim:null,ap:0});
  const dt=lastDtSec, c={fs:DX[r.dir]||0,dir:r.dir,turn:atype==="turnR"?-1:1};
  const spd=Math.hypot(r.rx-S.px,r.ry-S.py);S.px=r.rx;S.py=r.ry;S.nx=S.ny=0;
  const tps=spd/Math.max(.0001,dt);
  S.runk+=(Math.max(0,Math.min(1,(tps-3.5)/3.5))-S.runk)*Math.min(1,dt*6);
  if(spd>.0005)S.gp=(S.gp+spd/1.15)%1;   // one stride cycle per ~1.15 tiles
  /* one step ends a frame or two before the next begins; the walk does
     not stop for that */
  if(moving)S.mt=t;
  S.wb+=((t-(S.mt==null?-1e9:S.mt)<160?1:0)-S.wb)*Math.min(1,dt*8);
  const ms=t+i*700, clip=atype==="move"&&r.blocked?"bump":atype&&RIG_OF[atype];
  let P,key;
  if(clip){P=CC_RIG.pose(clip,ap,t-r.anim.t0,c);key=clip;
    if(clip==="bump"){const n=CC_RIG.nudge(ap)*TILE;S.nx=DX[r.dir]*n;S.ny=DY[r.dir]*n;}}
  else if(S.wb>.02){
    let w=CC_RIG.pose("walk",0,S.gp*620,c);
    if(S.runk>.02)w=CC_RIG.mix(w,CC_RIG.pose("run",0,S.gp*420,c),S.runk);
    P=S.wb<.98?CC_RIG.mix(CC_RIG.pose("idle",0,ms,c),w,S.wb):w;key="walk";
  }
  else if(r.wait>0){P=CC_RIG.pose("wait",0,ms,c);key="wait";}
  else if(r.tired){P=CC_RIG.pose("tired",0,ms,c);key="tired";}
  else{P=CC_RIG.pose("idle",0,ms,c);key="idle";}
  /* the bulb is the program: green while it runs, gold while it waits,
     red when the robot is stuck */
  if(key==="idle"||key==="walk"||key==="wait")P.bulb=r.running?"run":"idle";
  if(r.blocked)P.bulb="error";
  P.energy=(r.energy==null?100:r.energy)/100;
  const n=typeof bagCount==="function"?bagCount(r):0, cap=r.cap||1;
  P.packFill=Math.min(1,n/cap);
  if(n>0&&n>=cap){P.packFull=true;P.packScale=1.16;}
  if(r.say&&now<r.say.until){P.expr="talk";P.talk=r.say.until-now>900?1:0;}
  // the pop a sale gives
  r.pop=Math.max(0,(r.pop||0)-dt*3);
  if(r.pop){const k=1+r.pop*.22;P.sx*=k;P.sy*=k;}
  return B.blend(P,key,dt*1000);
}
/* the moments a clip crosses become a few of the world's own particles,
   thrown from where the tool or the hand actually is */
function robotFx(r,B,atype,ap){
  const S=B.st, clip=atype&&RIG_OF[atype];
  if(r.anim!==S.anim){S.anim=r.anim;S.ap=0;}
  const evs=clip?CC_RIG.events(clip,S.ap,ap):[];
  S.ap=ap;
  const a=B.anchors;if(!evs.length||!a.valid)return;
  const spray=(p,cols,n,sp)=>{if(!p)return;
    for(let k=0;k<n;k++)parts.push({x:p.x,y:p.y,vx:(Math.random()-.5)*sp*2,vy:-20-Math.random()*sp,g:380,
      s:1.3+Math.random()*1.5,c:cols[k%cols.length],t:0,life:.4+Math.random()*.3});
    if(parts.length>280)parts.splice(0,parts.length-280);};
  const tp=a.tool||a.handR;
  for(const k of evs){
    if(k==="hit"&&clip==="chop")spray(tp,["#c98a4b","#ecc08b","#8a5a2c"],5,90);
    else if(k==="hit"&&clip==="mine")spray(tp,["#ffe27a","#ffffff","#9aa3b8","#c3cad9"],7,130);
    else if(k==="hit"||k==="tap")spray(tp,["#e4dcbe","#cfc3a0"],k==="hit"?4:2,50);
    else if(k==="splash")spray(tp,["#6fd3ff","#bff0ff"],6,80);
    else if(k==="toss")spray(a.packTop||tp,["#fff6c9","#ffe27a"],3,40);
  }
}
function rr(c,x,y,w2,h2,r2){
  c.beginPath();
  if(c.roundRect){c.roundRect(x,y,w2,h2,r2);return;}
  c.moveTo(x+r2,y);c.arcTo(x+w2,y,x+w2,y+h2,r2);c.arcTo(x+w2,y+h2,x,y+h2,r2);c.arcTo(x,y+h2,x,y,r2);c.arcTo(x,y,x+w2,y,r2);c.closePath();
}
/* ---- shared board visuals: the same toy-bevel robot & bricks as the open
   world, so the mini-game / Academy board matches the main game exactly.
   Drawn at the reference size RS=TILE*0.72 and scaled to fit any cell. ---- */
/* 🤝 the team layer: a claimed tile wears a rotating ring in its owner's colour,
   and a 📡 broadcast pings out from the spot it pinned. Without this the whole
   mechanic is invisible — you could never SEE that four robots were fighting over
   one tree, or that claiming made them fan out, which is the entire lesson. */
function drawTeamLayer(t,x0,y0,x1,y1){
  if(typeof claims==="undefined")return;
  for(const [k,c] of claims){
    if(now>=c.until){claims.delete(k);continue;}
    const x=k%W, y=(k/W)|0;
    if(x<x0||x>x1||y<y0||y>y1)continue;
    const owner=robots[c.by];
    const col=(owner&&owner.color)||"#ffd66b";
    const left=(c.until-now)/CLAIM_MS;               // ring drains as the claim ages
    const cx=(x+.5)*TILE, cy=(y+.5)*TILE, rad=TILE*.42;
    ctx.save();
    ctx.strokeStyle=col;ctx.lineWidth=2.5;ctx.globalAlpha=.85;
    ctx.setLineDash([5,4]);ctx.lineDashOffset=-t/70;
    ctx.beginPath();ctx.arc(cx,cy,rad,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(0,left));ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha=.16;ctx.fillStyle=col;
    ctx.beginPath();ctx.arc(cx,cy,rad,0,6.2832);ctx.fill();
    ctx.restore();
  }
  if(typeof radio==="undefined")return;
  for(const ch in radio){
    const m=radio[ch];
    const age=now-m.at;
    if(age>RADIO_MS){delete radio[ch];continue;}
    if(m.x<x0||m.x>x1||m.y<y0||m.y>y1)continue;
    const cx=(m.x+.5)*TILE, cy=(m.y+.5)*TILE;
    const owner=robots[m.by], col=(owner&&owner.color)||"#5ab8ff";
    // three expanding rings, so a fresh call is loud and an old one is a whisper
    ctx.save();
    const fade=Math.max(0,1-age/RADIO_MS);
    for(let i=0;i<3;i++){
      const ph=((t/900)+i/3)%1;
      ctx.globalAlpha=(1-ph)*.5*fade;
      ctx.strokeStyle=col;ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(cx,cy,TILE*(.2+ph*.75),0,6.2832);ctx.stroke();
    }
    ctx.globalAlpha=fade;
    const sp=sprite(RADIO_EM[ch]||"📻",TILE*.42);
    ctx.drawImage(sp,cx-sp.lw/2,cy-TILE*.72,sp.lw,sp.lw);
    ctx.restore();
  }
}
/* The board robot is the world robot, standing still: the same rig, the
   same clips, the same wearables (robot-rig.js). (cx,cy) and s2 are the
   centre and size of the old square body, so every caller keeps its
   layout: the feet land where they always did. `wear` is optional: {hat,outfit,shoes}. `pose` is
   optional too: without it the robot is a token with no breath and no
   glance, exactly what the Academy board wants; with it, it plays the
   world robot's own idle, walk or chop. A board has no memory, so the
   robot it draws has none either: the same inputs give the same pixels. */
function boardPose(pose,t){return CC_RIG.boardPose(pose,t);}
function drawBoardRobot(g,cx,cy,s2,dir,color,running,t,wear,pose){
  if(!window.CC_RIG)return;
  const P=pose?CC_RIG.boardPose(pose,t):CC_RIG.P0();
  if(!pose)P.blink=(!running&&((t+cx*7)%3400)<110)?1:0;
  if(P.bulb==="idle"||P.bulb==="run")P.bulb=running?"run":"idle";
  const yaw=typeof dir==="number"?CC_RIG.DIRYAW[dir&3]:.45;
  CC_RIG.drawStill(g,cx,cy+s2*.66,s2/76.9,yaw,color,P,{t,wear:wear||{}});
}
function drawBoardBrick(g,px,py,cell,onPlan,no){
  const m=Math.max(3,cell*0.08), x=px+m, y=py+m, s=cell-2*m;
  /* The inset is at least 3px a side, so under ~8px there is no brick left
     — s goes NEGATIVE, and ellipse() throws on a negative radius. That was
     an uncaught exception in the middle of mgDraw, every frame, whenever a
     big board met a small screen: the carried brick (drawn at half a cell)
     hit it first. Too small to see is too small to draw. */
  if(s<2)return;
  const rad=Math.min(Math.max(4,cell*.15),s/2);
  const grd=g.createLinearGradient(0,y,0,y+s);
  grd.addColorStop(0,onPlan?"#e6bd7d":"#ff8fa0");grd.addColorStop(1,onPlan?"#b9793c":"#e23b57");
  g.fillStyle="rgba(0,0,0,.18)";g.beginPath();g.ellipse(px+cell/2,y+s-2,s*.42,s*.12,0,0,7);g.fill();
  g.fillStyle=grd;rr(g,x,y,s,s,rad);g.fill();
  g.save();rr(g,x,y,s,s,rad);g.clip();
  g.fillStyle="rgba(0,0,0,.25)";g.fillRect(x,y+s-Math.max(3,s*.16),s,Math.max(3,s*.16));
  g.fillStyle="rgba(255,255,255,.4)";rr(g,x+3,y+3,s-6,Math.max(3,s*.11),2);g.fill();
  g.strokeStyle="rgba(0,0,0,.12)";g.lineWidth=1.4;g.beginPath();g.moveTo(x,y+s*.5);g.lineTo(x+s,y+s*.5);g.stroke();
  g.restore();
  g.strokeStyle=onPlan?"rgba(120,70,25,.5)":"rgba(150,25,45,.5)";g.lineWidth=1.6;rr(g,x,y,s,s,rad);g.stroke();
  if(no!=null){
    g.font="900 "+Math.floor(cell*0.4)+"px Fredoka,sans-serif";g.textAlign="center";g.textBaseline="middle";
    g.lineWidth=3;g.strokeStyle="rgba(0,0,0,.32)";g.strokeText(no,px+cell/2,y+s/2+1);
    g.fillStyle="#fff";g.fillText(no,px+cell/2,y+s/2+1);
  }
}
