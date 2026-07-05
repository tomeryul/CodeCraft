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
  const w=innerWidth,h=innerHeight;
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
  // objects
  const es=TILE*.88;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const o=objects.get(key(x,y));if(!o)continue;
    let ch=null,sz=es;
    if(o.type==="tree")ch=o.stage===0?"🌱":o.stage===1?"🌿":"🌳";
    else if(o.type==="item"){ch=RES[o.item].em;sz=es*.6;}
    else if(o.type==="proj"){ch=o.em;sz=es*1.2;}
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
  // animals
  for(const a of animals){
    a.rx=lerp(a.rx,a.x,.08);a.ry=lerp(a.ry,a.y,.08);
    const sp=sprite(a.em,TILE*.62);
    ctx.drawImage(sp,(a.rx+.5)*TILE-sp.lw/2,(a.ry+.5)*TILE-sp.lw/2-Math.abs(Math.sin(t/300+a.x))*3,sp.lw,sp.lw);
  }
  // robots
  robots.forEach((r,i)=>{
    r.rx=lerp(r.rx,r.x,.22);r.ry=lerp(r.ry,r.y,.22);
    const cx=(r.rx+.5)*TILE, cy=(r.ry+.5)*TILE, s2=TILE*.72;
    if(i===selRobot){
      ctx.save();
      ctx.beginPath();ctx.arc(cx,cy,s2*.78+Math.sin(t/250)*2,0,7);
      ctx.strokeStyle="rgba(255,214,107,.9)";ctx.lineWidth=3;
      ctx.setLineDash([10,7]);ctx.lineDashOffset=-t/30;ctx.stroke();ctx.setLineDash([]);
      ctx.restore();
    }
    ctx.save();ctx.translate(cx,cy);
    // shadow
    ctx.fillStyle="rgba(0,0,0,.22)";ctx.beginPath();ctx.ellipse(0,s2*.42,s2*.42,s2*.16,0,0,7);ctx.fill();
    const bob=r.running?Math.sin(t/120)*1.6:0;
    ctx.translate(0,bob);
    // squash & stretch: pop on actions, lean while moving
    r.pop=Math.max(0,(r.pop||0)-lastDtSec*3);
    const moving=Math.abs(r.rx-r.x)+Math.abs(r.ry-r.y)>.04;
    let sqx=1,sqy=1;
    if(moving){ if(DX[r.dir]){sqx=1.08;sqy=.93;} else {sqx=.93;sqy=1.08;} }
    const pk=1+r.pop*.22;
    ctx.scale(sqx*pk,sqy*pk);
    // body — toy bevel
    const grd=ctx.createLinearGradient(0,-s2/2,0,s2/2);
    grd.addColorStop(0,window.CC_EXTRAS?CC_EXTRAS.lighten(r.color,.3):r.color);grd.addColorStop(1,r.color);
    ctx.fillStyle=grd;rr(ctx,-s2/2,-s2/2,s2,s2,11);ctx.fill();
    ctx.save();rr(ctx,-s2/2,-s2/2,s2,s2,11);ctx.clip();
    ctx.fillStyle="rgba(0,0,0,.25)";ctx.fillRect(-s2/2,s2/2-6,s2,6);
    ctx.fillStyle="rgba(255,255,255,.35)";rr(ctx,-s2/2+4,-s2/2+3,s2-8,4.5,2.5);ctx.fill();
    ctx.restore();
    // antenna
    ctx.strokeStyle="#8a6210";ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(0,-s2/2);ctx.lineTo(0,-s2/2-7);ctx.stroke();
    if(r.running){ctx.fillStyle="#54d66a";ctx.shadowColor="#54d66a";ctx.shadowBlur=4+5*Math.abs(Math.sin(t/160));}
    else ctx.fillStyle="#ffd66b";
    ctx.beginPath();ctx.arc(0,-s2/2-9,3.5,0,7);ctx.fill();ctx.shadowBlur=0;
    // eyes look toward dir
    const ex=DX[r.dir]*2.5, ey=DY[r.dir]*2.5;
    ctx.fillStyle="#fff";
    ctx.beginPath();ctx.arc(-6.5,-3,5,0,7);ctx.moveTo(11.5,-3);ctx.arc(6.5,-3,5,0,7);ctx.fill();
    ctx.fillStyle="#241b45";
    ctx.beginPath();ctx.arc(-6.5+ex,-2.5+ey,2.5,0,7);ctx.moveTo(9+ex,-2.5+ey);ctx.arc(6.5+ex,-2.5+ey,2.5,0,7);ctx.fill();
    // smile
    ctx.strokeStyle="#1c1638";ctx.lineWidth=2;ctx.beginPath();ctx.arc(ex*.5,4+ey*.5,5,.2*Math.PI,.8*Math.PI);ctx.stroke();
    ctx.restore();
    // hat
    if(r.hat){
      const hp=sprite(r.hat,TILE*.5);
      ctx.drawImage(hp,cx-hp.lw/2+2,cy+bob-s2*.62-hp.lw/2-6,hp.lw,hp.lw);
    }
    // name
    ctx.fillStyle="rgba(20,14,45,.75)";
    const nm=r.name;ctx.font='bold 11px "Fredoka",sans-serif';ctx.textAlign="center";
    const tw=ctx.measureText(nm).width;
    rr(ctx,cx-tw/2-5,cy-s2*.95-14,tw+10,15,7);ctx.fill();
    ctx.fillStyle="#fff";ctx.fillText(nm,cx,cy-s2*.95-2.5);
    // speech bubble
    if(r.say){
      if(now>r.say.until)r.say=null;
      else{
        ctx.font='bold 12px "Fredoka",sans-serif';
        const sw2=ctx.measureText(r.say.txt).width;
        const bx=cx-sw2/2-8, by=cy-s2*.95-38;
        ctx.fillStyle="#fff";
        rr(ctx,bx,by,sw2+16,20,9);ctx.fill();
        ctx.beginPath();ctx.moveTo(cx-4,by+19);ctx.lineTo(cx+5,by+19);ctx.lineTo(cx,by+26);ctx.closePath();ctx.fill();
        ctx.fillStyle="#241b45";ctx.fillText(r.say.txt,cx,by+14);
      }
    }
    if(r.blocked){
      const sp=sprite(r.tired?"😴":"💢",r.tired?16:14);ctx.drawImage(sp,cx+s2*.35,cy-s2*.85,sp.lw,sp.lw);
    }
    // energy bar under the robot when not full
    const en=r.energy==null?100:r.energy;
    if(en<100){
      const bw=s2*.9, bx=cx-bw/2, by=cy+s2*.52;
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
    ctx.strokeText(p.txt,px,py);ctx.fillText(p.txt,px,py);
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
function rr(c,x,y,w2,h2,r2){
  c.beginPath();
  if(c.roundRect){c.roundRect(x,y,w2,h2,r2);return;}
  c.moveTo(x+r2,y);c.arcTo(x+w2,y,x+w2,y+h2,r2);c.arcTo(x+w2,y+h2,x,y+h2,r2);c.arcTo(x,y+h2,x,y,r2);c.arcTo(x,y,x+w2,y,r2);c.closePath();
}
