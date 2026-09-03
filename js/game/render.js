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
    // motion state (needed early for the walk cycle)
    const moving=Math.abs(r.rx-r.x)+Math.abs(r.ry-r.y)>.04;
    // springy antenna: tip lags behind motion
    const vx=(r.rx-(r._prx==null?r.rx:r._prx))*TILE, vy=(r.ry-(r._pry==null?r.ry:r._pry))*TILE;
    r._prx=r.rx;r._pry=r.ry;
    r._asw=(r._asw||0)+(( -vx*.9)-(r._asw||0))*.25;
    const asw=Math.max(-6,Math.min(6,r._asw))+Math.sin(t/900+i)*0.6;
    /* ================= animation driver =================
       Every pose below is sampled DIRECTLY from the approved
       robot-animated.svg keyframe tables (GAIT walk/run, IDLE, REST, and the
       ACT_TL tool timelines) using the SAME transform tree as that asset, so
       the in-game robot matches the reference frame-for-frame. The only
       game-side additions are: a distance-driven gait phase (feet never slide,
       cadence scales with speed upgrades) and smooth blends between states. */
    const D2R=Math.PI/180;
    const spd=Math.hypot(vx,vy);
    const tps=spd/Math.max(.0001,lastDtSec)/TILE;
    r._runk=(r._runk||0)+(Math.max(0,Math.min(1,(tps-3.5)/3.5))-(r._runk||0))*Math.min(1,lastDtSec*6);
    const runk=r._runk;
    r._wb=(r._wb||0)+((moving?1:0)-(r._wb||0))*Math.min(1,lastDtSec*8);
    const wb=r._wb<.01?0:r._wb;
    // distance-driven gait phase: one full SVG cycle ≈ 1.3 tiles of travel
    if(spd>.001)r._gp=(((r._gp||i*.37)+spd/(TILE*1.3))%1+1)%1;
    const gp=(((r._gp||i*.37)%1)+1)%1;
    // per-action tell (r.anim set by the interpreter)
    const A=r.anim; let ap=1, atype=null;
    if(A){
      const AD={move:220,turnL:190,turnR:190,drop:260,build:300,rest:1400,wait:420};
      let dur=AD[A.type]||260;
      if(ACT_TL[A.type]){ // tool swings stretch to fill the gap until the next sim step
        const stepMs=340/(r.speed||1)/(1+(typeof skills!=="undefined"?skills.agility.lvl*.015:0));
        dur=Math.max(320,Math.min(1250,stepMs*.95));
      }
      ap=(t-A.t0)/dur;
      if(ap>=1||ap<0){r.anim=null;ap=1;}else atype=A.type;
    }
    const TL=atype?ACT_TL[atype]:null;
    const resting=atype==="rest"||(r.tired&&!moving&&!TL);
    const aw=atype&&!TL&&!resting?Math.sin(Math.PI*ap):0; // out-and-back wave
    const ao=atype?(1-ap)*(1-ap):0;                        // ease-out decay
    // ---- sample the current state's body transform ----
    // gait sampler blends walk↔run by runk (all values are the exact SVG keyframes)
    const G=(k)=>{const a=kf(GAIT.walk[k],KT9,gp);return a+(kf(GAIT.run[k],KT9,gp)-a)*runk;};
    let bobY=0,swayDeg=0,sqx=1,sqy=1;
    let legLd=0,legRd=0,lenL=5.53,lenR=5.53,footLd=0,footRd=0,armLd=10,armRd=-10,antD=0;
    const ip=(((t/2600+i*.3)%1)+1)%1;
    const iBob=kf([0,-1.6,0],KT3,ip),iSway=kf([-3,3,-3],KT3,ip),iSx=kf([1,.99,1],KT3,ip),iSy=kf([1,1.01,1],KT3,ip),iArmL=kf([10,16,10],KT3,ip),iArmR=kf([-10,-16,-10],KT3,ip);
    if(resting){
      const rp=(((t/3400+i*.3)%1)+1)%1;
      bobY=kf([.8,1.6,.8],KT3,rp);swayDeg=kf([7,11,7],KT3,rp);
      sqx=kf([1.01,1.04,1.01],KT3,rp);sqy=kf([.99,.96,.99],KT3,rp);
      armLd=kf([6,10,6],KT3,rp);armRd=kf([-6,-10,-6],KT3,rp);
    }else if(TL){
      bobY=kf(TL.ty,TL.t,ap);const kx=kf(TL.sx,TL.t,ap);sqx=kx;sqy=2-kx;
    }else{ // idle (wb=0) → gait (wb=1)
      bobY=iBob*(1-wb)+G("bob")*wb;
      swayDeg=iSway*(1-wb)+G("sway")*wb;
      sqx=iSx*(1-wb)+G("sx")*wb;
      sqy=iSy*(1-wb)+G("sy")*wb;
      legLd=G("legL")*wb;legRd=G("legR")*wb;
      lenL=5.53+(G("lenL")-5.53)*wb;lenR=5.53+(G("lenR")-5.53)*wb;
      footLd=G("footL")*wb;footRd=G("footR")*wb;
      armLd=iArmL*(1-wb)+G("armL")*wb;armRd=iArmR*(1-wb)+G("armR")*wb;
      antD=G("ant")*wb;
    }
    // shadow on the ground (rx shrinks a touch when the body lifts)
    const shS=1+bobY*.012;
    ctx.fillStyle="rgba(0,0,0,.2)";
    ctx.beginPath();ctx.ellipse(0,s2*.52,s2*.42*shS,s2*.16*shS,0,0,7);ctx.fill();
    // --- apply the SVG transform tree ---
    ctx.translate(0,bobY);                                  // 1. body bob
    if(TL)ctx.rotate(kf(TL.rot,TL.t,ap)*D2R*(DX[r.dir]<0?-1:1)); // tool: lean toward target (mirror when facing left)
    else{ctx.translate(0,10);ctx.rotate(swayDeg*D2R);ctx.translate(0,-10);} // 2. body sway (pivot near hips)
    // action-specific extra motion
    if(atype==="move"){
      ctx.translate(DX[r.dir]*2.0*aw,DY[r.dir]*2.0*aw-.7*aw);
      if(DX[r.dir])ctx.rotate(DX[r.dir]*0.06*aw);
      if(!A.dust&&typeof parts!=="undefined"){A.dust=1;
        for(let d=0;d<2;d++)parts.push({x:cx-DX[r.dir]*s2*.45+(Math.random()*8-4),y:cy+s2*.34,
          vx:-DX[r.dir]*22+(Math.random()*14-7),vy:-14-Math.random()*10,g:60,s:2.2+Math.random()*1.4,c:"#e4dcbe",t:0,life:.4});}
    }
    else if(atype==="turnL")ctx.rotate(0.42*ao);
    else if(atype==="turnR")ctx.rotate(-0.42*ao);
    else if(atype==="drop"||atype==="build")ctx.translate(0,3.2*aw);
    // 3. squash & stretch about the ground pivot (y≈18)
    r.pop=Math.max(0,(r.pop||0)-lastDtSec*3);
    const pk=1+r.pop*.22;
    ctx.translate(0,18);ctx.scale(sqx*pk,sqy*pk);ctx.translate(0,-18);
    const limbDk=(function(hex){try{const n=parseInt(hex.slice(1),16);const f=c=>Math.max(0,Math.round(c*.72));return "rgb("+f(n>>16&255)+","+f(n>>8&255)+","+f(n&255)+")";}catch(e){return hex;}})(r.color);
    // ---- legs (drawn behind body) — hips at (±5.53,13.28); thigh rotates at
    // the hip, foot rounded-rect at the leg end counter-rotates to stay flat.
    // Planted straight during tool actions (SVG tool groups don't animate legs).
    (function(){
      const draw=(hx,rotDeg,len,footDeg)=>{
        ctx.save();ctx.translate(hx,13.28);ctx.rotate(rotDeg*D2R);
        ctx.strokeStyle=limbDk;ctx.lineWidth=5;ctx.lineCap="round";
        ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,len);ctx.stroke();
        ctx.translate(0,len);ctx.rotate(footDeg*D2R);
        ctx.fillStyle=limbDk;rr(ctx,-3.5,-1,7,4.5,2.2);ctx.fill();
        ctx.restore();
      };
      if(TL){draw(-5.53,0,5.53,0);draw(5.53,0,5.53,0);}
      else{draw(-5.53,legLd,lenL,footLd);draw(5.53,legRd,lenR,footRd);}
    })();
    // body — toy bevel
    const grd=ctx.createLinearGradient(0,-s2/2,0,s2/2);
    /* the colour reaches the canvas as well as the DOM, and an unparseable
       one throws inside the draw loop */
    const rc=safeColor(r.color);
    grd.addColorStop(0,window.CC_EXTRAS?CC_EXTRAS.lighten(rc,.3):rc);grd.addColorStop(1,rc);
    ctx.fillStyle=grd;rr(ctx,-s2/2,-s2/2,s2,s2,11);ctx.fill();
    ctx.save();rr(ctx,-s2/2,-s2/2,s2,s2,11);ctx.clip();
    ctx.fillStyle="rgba(0,0,0,.25)";ctx.fillRect(-s2/2,s2/2-6,s2,6);
    ctx.fillStyle="rgba(255,255,255,.35)";rr(ctx,-s2/2+4,-s2/2+3,s2-8,4.5,2.5);ctx.fill();
    ctx.restore();
    // working arm — two-segment jointed arm (shoulder → elbow → hand) plus a
    // support arm and tool, geometry & keyframes ported 1:1 from the approved
    // robot-animated.svg: right shoulder (16.6,5.2), upper len 4.6, forearm
    // len 5, tool at the hand. Mirrors horizontally when the robot faces left.
    if(TL){
      const mir=DX[r.dir]<0?-1:1;
      ctx.save();if(mir<0)ctx.scale(-1,1);
      ctx.lineCap="round";ctx.strokeStyle=limbDk;ctx.fillStyle=limbDk;
      // support (left) arm — single segment
      ctx.save();
      ctx.translate(-16.6,5.2);ctx.rotate(kf(TL.larm,TL.t,ap)*D2R);
      ctx.lineWidth=3.8;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,5.6);ctx.stroke();
      ctx.beginPath();ctx.arc(0,5.6,2.5,0,7);ctx.fill();
      ctx.restore();
      ctx.beginPath();ctx.arc(-16.6,5.2,2.3,0,7);ctx.fill(); // shoulder cap
      // working (right) arm — upper segment
      ctx.save();
      ctx.translate(16.6,5.2);ctx.rotate(kf(TL.upper,TL.t,ap)*D2R);
      ctx.lineWidth=3.8;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,4.6);ctx.stroke();
      ctx.beginPath();ctx.arc(0,4.6,2.5,0,7);ctx.fill();
      // forearm segment (pivots at the elbow)
      ctx.translate(0,4.6);ctx.rotate(kf(TL.fore,TL.t,ap)*D2R);
      ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,5);ctx.stroke();
      ctx.beginPath();ctx.arc(0,5,2.5,0,7);ctx.fill();
      // tool held at the hand (SVG holds it at rotate(90) off the forearm axis)
      ctx.translate(0,5);ctx.rotate((90+(TL.toolrot?kf(TL.toolrot,TL.t,ap):0))*D2R);
      if(atype==="chop"){ // toy axe
        ctx.strokeStyle="#8a5a2c";ctx.lineWidth=4.5;
        ctx.beginPath();ctx.moveTo(-3,0);ctx.lineTo(16,0);ctx.stroke();
        ctx.fillStyle="#cfd4e0";
        ctx.beginPath();ctx.moveTo(15,-9);ctx.quadraticCurveTo(24,0,15,9);ctx.lineTo(12,5);ctx.lineTo(12,-5);ctx.closePath();ctx.fill();
        ctx.strokeStyle="rgba(28,22,56,.45)";ctx.lineWidth=1.6;ctx.stroke();
        ctx.fillStyle="rgba(255,255,255,.4)";ctx.beginPath();ctx.arc(16,-4,1.6,0,7);ctx.fill();
      }else if(atype==="mine"){ // toy pickaxe
        ctx.strokeStyle="#8a5a2c";ctx.lineWidth=4.5;
        ctx.beginPath();ctx.moveTo(-3,0);ctx.lineTo(15,0);ctx.stroke();
        ctx.fillStyle="#cfd4e0";
        ctx.beginPath();ctx.moveTo(13,-11);ctx.quadraticCurveTo(28,0,13,11);ctx.quadraticCurveTo(19.5,0,13,-11);ctx.closePath();ctx.fill();
        ctx.strokeStyle="rgba(28,22,56,.45)";ctx.lineWidth=1.6;ctx.stroke();
        ctx.fillStyle="rgba(255,255,255,.4)";ctx.beginPath();ctx.arc(16.5,-4.5,1.4,0,7);ctx.fill();
      }else if(atype==="scoop"){ // little bucket, dips & tips
        ctx.fillStyle="#8fa3b8";
        ctx.beginPath();ctx.moveTo(-4.2,-3.5);ctx.lineTo(4.2,-3.5);ctx.lineTo(3.2,4);ctx.lineTo(-3.2,4);ctx.closePath();ctx.fill();
        ctx.strokeStyle="rgba(28,22,56,.45)";ctx.lineWidth=1.3;ctx.stroke();
        ctx.strokeStyle="#6b7f94";ctx.lineWidth=1.4;
        ctx.beginPath();ctx.moveTo(-4.2,-3.5);ctx.quadraticCurveTo(0,-8.5,4.2,-3.5);ctx.stroke();
        if(ap>.4&&ap<.82){ctx.fillStyle="#5db8e8";ctx.beginPath();ctx.moveTo(-3.6,-2.6);ctx.lineTo(3.6,-2.6);ctx.lineTo(3.3,-.4);ctx.lineTo(-3.3,-.4);ctx.closePath();ctx.fill();}
      }
      // collect: open hand, no tool
      ctx.restore();
      ctx.restore();
    }else{
      // idle / walk / run / rest arms — single segment at shoulders (±16.6,5.2),
      // rotation sampled from the SVG keyframes (armL/armR). Drawn in front of
      // the body, exactly as in robot-animated.svg.
      const arm=(sx,rotDeg)=>{
        ctx.save();ctx.translate(sx,5.2);ctx.rotate(rotDeg*D2R);
        ctx.strokeStyle=limbDk;ctx.lineWidth=4.5;ctx.lineCap="round";
        ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,6.2);ctx.stroke();
        ctx.fillStyle=limbDk;ctx.beginPath();ctx.arc(0,6.2,3,0,7);ctx.fill();
        ctx.restore();
      };
      arm(-16.6,armLd);arm(16.6,armRd);
    }
    // antenna — during tool actions it sways on the SVG antenna keyframes; while
    // walking/running it uses the gait antenna keyframes; idle keeps a springy
    // tip that lags behind movement for a bit of life
    const antR=TL?kf(TL.ant,TL.t,ap)*(Math.PI/180)*(DX[r.dir]<0?-1:1):antD*D2R;
    ctx.save();ctx.translate(0,-s2/2);ctx.rotate(antR);
    ctx.strokeStyle="#8a6210";ctx.lineWidth=2.5;
    ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(asw*.4,-4,asw,-7);ctx.stroke();
    if(r.running){ctx.fillStyle="#54d66a";ctx.shadowColor="#54d66a";ctx.shadowBlur=4+5*Math.abs(Math.sin(t/160));}
    else ctx.fillStyle="#ffd66b";
    ctx.beginPath();ctx.arc(asw,-9,3.5,0,7);ctx.fill();ctx.shadowBlur=0;
    ctx.restore();
    // eyes look toward dir (closed while resting; occasional idle blink;
    // curious glance around when idle)
    let ex=DX[r.dir]*2.5, ey=DY[r.dir]*2.5;
    if(!r.running&&!moving){const gl=Math.sin(t/1400+i*3.1);if(gl>.6)ex=2.5;else if(gl<-.6)ex=-2.5;}
    const shut=atype==="rest"||r.tired||((!r.running||atype==="wait")&&((t+i*913)%3400)<110);
    ctx.fillStyle="#fff";
    ctx.beginPath();ctx.arc(-6.5,-3,5,0,7);ctx.moveTo(11.5,-3);ctx.arc(6.5,-3,5,0,7);ctx.fill();
    if(shut){
      ctx.strokeStyle="#241b45";ctx.lineWidth=2;ctx.lineCap="round";
      ctx.beginPath();ctx.moveTo(-9,-2.5);ctx.lineTo(-4,-2.5);ctx.moveTo(4,-2.5);ctx.lineTo(9,-2.5);ctx.stroke();
    }else{
      ctx.fillStyle="#241b45";
      ctx.beginPath();ctx.arc(-6.5+ex,-2.5+ey,2.5,0,7);ctx.moveTo(9+ex,-2.5+ey);ctx.arc(6.5+ex,-2.5+ey,2.5,0,7);ctx.fill();
    }
    // smile
    ctx.strokeStyle="#1c1638";ctx.lineWidth=2;ctx.beginPath();ctx.arc(ex*.5,4+ey*.5,5,.2*Math.PI,.8*Math.PI);ctx.stroke();
    ctx.restore();
    // sleepy Zzz while resting
    if(atype==="rest"){
      ctx.font='bold 11px "Fredoka",sans-serif';ctx.textAlign="center";ctx.fillStyle="#e6ecff";
      const zp=(t/450)%1, zp2=(zp+.5)%1;
      ctx.globalAlpha=.8*(1-zp);ctx.fillText("z",cx+s2*.42,cy-s2*.6-zp*11);
      ctx.globalAlpha=.6*(1-zp2);ctx.fillText("z",cx+s2*.56,cy-s2*.74-zp2*11);
      ctx.globalAlpha=1;
    }
    // hat — bounces with the body and tilts with the step wobble
    if(r.hat){
      const hp=sprite(r.hat,TILE*.5);
      ctx.save();
      ctx.translate(cx+2,cy+bobY-s2*.62-6);
      if(!TL)ctx.rotate(swayDeg*Math.PI/180*.5);
      ctx.drawImage(hp,-hp.lw/2,-hp.lw/2,hp.lw,hp.lw);
      ctx.restore();
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
        const bx=cx-w/2, by=cy-s2*.95-38;
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
/* keyframe sampler + tool-action timelines ported 1:1 from the approved SMIL
   SVG action set (robot-animated.svg): keyTimes/values pairs, ease-in-out
   between keys (≈ spline .4 0 .6 1). rot in degrees, ty in px, sx = width
   squash (height gets the inverse), arm: 0 = overhead → 1 = full strike. */
function kf(vals,times,p){
  p=p<0?0:p>1?1:p;
  let j=1;while(j<times.length-1&&times[j]<p)j++;
  const a=times[j-1],b=times[j],u=b>a?(p-a)/(b-a):1;
  const e=u<.5?2*u*u:1-2*(1-u)*(1-u);
  return vals[j-1]+(vals[j]-vals[j-1])*e;
}
const KT9=[0,.125,.25,.375,.5,.625,.75,.875,1];
const KT3=[0,.5,1];
/* Walk & run gaits — exact keyTimes/values lifted from robot-animated.svg
   (idle & rest are inline 3-point loops in the driver). legL/legR = thigh
   rotation; lenL/lenR = leg length (foot lifts as the leg shortens); footL/R =
   foot counter-rotation; armL/R = arm swing; ant = antenna; bob/sway/sx/sy =
   body bob, tilt & squash. */
const GAIT={
  walk:{bob:[0,-1.9,-2.7,-1.9,0,-1.9,-2.7,-1.9,0], sway:[2.3,1.63,0,-1.63,-2.3,-1.63,0,1.63,2.3],
    sx:[1.05,1.04,1.01,.99,.97,.99,1.01,1.04,1.05], sy:[.96,.98,1,1.03,1.04,1.03,1,.98,.96],
    legL:[-20.6,-14.63,0,14.63,20.6,14.63,0,-14.63,-20.6], lenL:[5.53,4.4,3.87,4.4,5.53,5.53,5.53,5.53,5.53], footL:[20.6,14.63,0,-14.63,-20.6,-14.63,0,14.63,20.6],
    legR:[20.6,14.63,0,-14.63,-20.6,-14.63,0,14.63,20.6], lenR:[5.53,5.53,5.53,5.53,5.53,4.4,3.87,4.4,5.53], footR:[-20.6,-14.63,0,14.63,20.6,14.63,0,-14.63,-20.6],
    ant:[-4,-2.84,0,2.84,4,2.84,0,-2.84,-4], armL:[10,12.03,17,21.97,24,21.97,17,12.03,10], armR:[-10,-12.03,-17,-21.97,-24,-21.97,-17,-12.03,-10]},
  run:{bob:[0,-2.4,-3.4,-2.4,0,-2.4,-3.4,-2.4,0], sway:[3.2,2.27,0,-2.27,-3.2,-2.27,0,2.27,3.2],
    sx:[1.08,1.06,1.02,.98,.96,.98,1.02,1.06,1.08], sy:[.95,.97,1,1.04,1.05,1.04,1,.97,.95],
    legL:[-32,-22.72,0,22.72,32,22.72,0,-22.72,-32], lenL:[5.53,4.1,3.3,4.1,5.53,5.53,5.53,5.53,5.53], footL:[32,22.72,0,-22.72,-32,-22.72,0,22.72,32],
    legR:[32,22.72,0,-22.72,-32,-22.72,0,22.72,32], lenR:[5.53,5.53,5.53,5.53,5.53,4.1,3.3,4.1,5.53], footR:[-32,-22.72,0,22.72,32,22.72,0,-22.72,-32],
    ant:[-8,-5.68,0,5.68,8,5.68,0,-5.68,-8], armL:[12,14.61,21,27.39,30,27.39,21,14.61,12], armR:[-12,-14.61,-21,-27.39,-30,-27.39,-21,-14.61,-12]}
};
const ACT_TL={
  chop:   {t:[0,.1,.36,.46,.53,.6,.68,1], rot:[0,-1,-6,-6,7,6,7,0], ty:[0,0,-1.5,-1.5,1.4,1.2,1.4,0], sx:[1,1,.97,.97,1.07,1.05,1.07,1],
           ant:[0,-2,6,6,-6,-5,-6,0], larm:[10,12,26,26,2,4,2,10], upper:[-15,-5,-150,-150,-62,-57,-62,-15], fore:[-5,0,-40,-40,12,7,12,-5]},
  mine:   {t:[0,.1,.36,.46,.53,.6,.68,1], rot:[0,-1,-7,-7,9,8,9,0], ty:[0,0,-1.8,-1.8,2,1.7,2,0], sx:[1,1,.96,.96,1.09,1.07,1.09,1],
           ant:[0,-2,7,7,-7,-6,-7,0], larm:[10,12,26,26,2,4,2,10], upper:[-15,-5,-140,-140,-12,-8,-12,-15], fore:[-5,2,-45,-45,-2,-6,-2,-5]},
  collect:{t:[0,.1,.28,.4,.56,.75,1], rot:[0,-2,8,8,-3,-3,0], ty:[0,0,2,2,-1,-1,0], sx:[1,1,1.05,1.05,.98,.98,1],
           ant:[0,-3,6,6,-4,-4,0], larm:[10,11,20,20,6,6,10], upper:[-15,-8,-42,-42,-80,-80,-15], fore:[-5,-2,-30,-30,-28,-28,-5]},
  scoop:  {t:[0,.12,.3,.42,.6,.78,1], rot:[0,-2,9,10,-4,-1,0], ty:[0,0,2.2,2.6,-1.2,0,0], sx:[1,1,1.05,1.06,.98,1,1],
           ant:[0,-3,7,7,-4,-2,0], larm:[10,12,22,22,4,8,10], upper:[-15,-10,-55,-70,-100,-30,-15], fore:[-5,-4,-35,-28,-20,-15,-5], toolrot:[0,0,35,35,-8,0,0]}
};
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
function drawBoardRobot(g,cx,cy,s2,dir,color,running,t){
  const RS=TILE*0.72, k=s2/RS;
  g.save();g.translate(cx,cy);g.scale(k,k);
  const S=RS;
  g.fillStyle="rgba(0,0,0,.22)";g.beginPath();g.ellipse(0,S*.42,S*.42,S*.16,0,0,7);g.fill();
  const bob=running?Math.sin(t/120)*1.6:0; g.translate(0,bob);
  // body — toy bevel
  const grd=g.createLinearGradient(0,-S/2,0,S/2);
  grd.addColorStop(0,window.CC_EXTRAS?CC_EXTRAS.lighten(color,.3):color);grd.addColorStop(1,color);
  g.fillStyle=grd;rr(g,-S/2,-S/2,S,S,11);g.fill();
  g.save();rr(g,-S/2,-S/2,S,S,11);g.clip();
  g.fillStyle="rgba(0,0,0,.25)";g.fillRect(-S/2,S/2-6,S,6);
  g.fillStyle="rgba(255,255,255,.35)";rr(g,-S/2+4,-S/2+3,S-8,4.5,2.5);g.fill();
  g.restore();
  // antenna + status light (green glow while running, gold when idle)
  g.strokeStyle="#8a6210";g.lineWidth=2.5;g.beginPath();g.moveTo(0,-S/2);g.lineTo(0,-S/2-7);g.stroke();
  if(running){g.fillStyle="#54d66a";g.shadowColor="#54d66a";g.shadowBlur=4+5*Math.abs(Math.sin(t/160));}
  else g.fillStyle="#ffd66b";
  g.beginPath();g.arc(0,-S/2-9,3.5,0,7);g.fill();g.shadowBlur=0;
  // eyes look toward the facing direction (occasional idle blink when stopped)
  const ex=DX[dir]*2.5, ey=DY[dir]*2.5;
  const shut=!running&&((t+cx*7)%3400)<110;
  g.fillStyle="#fff";
  g.beginPath();g.arc(-6.5,-3,5,0,7);g.moveTo(11.5,-3);g.arc(6.5,-3,5,0,7);g.fill();
  if(shut){
    g.strokeStyle="#241b45";g.lineWidth=2;g.lineCap="round";
    g.beginPath();g.moveTo(-9,-2.5);g.lineTo(-4,-2.5);g.moveTo(4,-2.5);g.lineTo(9,-2.5);g.stroke();
  }else{
    g.fillStyle="#241b45";
    g.beginPath();g.arc(-6.5+ex,-2.5+ey,2.5,0,7);g.moveTo(9+ex,-2.5+ey);g.arc(6.5+ex,-2.5+ey,2.5,0,7);g.fill();
  }
  // smile
  g.strokeStyle="#1c1638";g.lineWidth=2;g.beginPath();g.arc(ex*.5,4+ey*.5,5,.2*Math.PI,.8*Math.PI);g.stroke();
  g.restore();
}
function drawBoardBrick(g,px,py,cell,onPlan,no){
  const m=Math.max(3,cell*0.08), x=px+m, y=py+m, s=cell-2*m, rad=Math.max(4,cell*.15);
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
