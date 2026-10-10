/* The robot, drawn — one rig for every place the game shows a robot: the
   world, the challenge boards, the 3D board's billboard, the Style preview
   and the wear maker. design/robot-character.html is the character sheet
   it came from and design/robot-options.html the style that was chosen
   ("soft"): the map has no outlines, so neither does the robot; its limbs
   are the team colour, darkened, as the old robot's were; the shadow is
   the map's own soft one.

   It is a painter in rig units. The robot is about 109 units tall with its
   antenna, the ground is y=0 and up is negative; a caller hands it a ground
   point and a scale.

   Pseudo-3D, not 3D. The body turns on a yaw angle (0 faces us, PI/2 faces
   right), the head on its own yaw so it can get there first, and every part
   is placed on the round surface it belongs to and drawn in depth order.
   The face is stylised on purpose: in profile the screen stays on the head
   instead of sliding off its edge, so the eyes never disappear.

   A pose is a flat object of numbers (P0). An animation is a function of
   time that writes one; two poses blend by mixing the numbers. Bot holds the
   only state — the yaw springs, the head's lag, the antenna spring, the
   blink and the expression swap — so a caller that wants a still picture
   uses drawStill(), which has none. Everything is inside this closure; the
   one name it adds to the page is CC_RIG. */
(function(){
'use strict';
const TAU=Math.PI*2, PI=Math.PI, HP=Math.PI/2;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const seg=(t,a,b)=>clamp((t-a)/(b-a),0,1);
const sm=(a,b,t)=>{t=seg(t,a,b);return t*t*(3-2*t);};
const wrapA=a=>{a=(a+PI)%TAU;if(a<0)a+=TAU;return a-PI;};
const hn=n=>{const s=Math.sin(n*127.1+311.7)*43758.5453;return s-Math.floor(s);};
const vn=x=>{const i=Math.floor(x),f=x-i,u=f*f*(3-2*f);return lerp(hn(i),hn(i+1),u)*2-1;};
const E={io:t=>.5-.5*Math.cos(PI*t),o2:t=>1-(1-t)*(1-t),o3:t=>1-Math.pow(1-t,3),i2:t=>t*t,i3:t=>t*t*t,
  back:t=>{const c1=1.7,c3=c1+1;return 1+c3*Math.pow(t-1,3)+c1*Math.pow(t-1,2);}};
/* keyframes: [[t,v],[t,v,ease],...] — an ease belongs to the segment that
   ENDS at its key */
function K(t,k){
  if(t<=k[0][0])return k[0][1];
  for(let i=1;i<k.length;i++){if(t<=k[i][0]){const a=k[i-1],b=k[i],u=(t-a[0])/((b[0]-a[0])||1);return a[1]+(b[1]-a[1])*(b[2]||E.io)(u);}}
  return k[k.length-1][1];
}

/* ---------------------------------------------------------------- colour */
function hexRgb(h){h=String(h).replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');const n=parseInt(h,16)||0;return[n>>16&255,n>>8&255,n&255];}
function shade(h,a){const c=hexRgb(h),t=a<0?0:255,p=Math.abs(a);return'rgb('+c.map(v=>Math.round(v+(t-v)*p)).join(',')+')';}
const PALC={};
function PAL(c){
  if(PALC[c])return PALC[c];
  if(Object.keys(PALC).length>64)for(const k in PALC)delete PALC[k];
  return PALC[c]={base:c,hi:shade(c,.34),lo:shade(c,-.14),dk:shade(c,-.34),boot:shade(c,-.26),bootHi:shade(c,.18),
    limb:shade(c,-.28),limbHi:shade(c,-.1)};
}
const MITT='#f2f3fb', MITT_SH='#c9cde6', SOLE='#f5eddb', PACK='#e8c78c', PACK_HI='#f6dfb2', PACK_DK='#c69756',
  CREAM='#fff4de', SCR_A='#2b2f5e', SCR_B='#101230', EYE='#a8f8ff', INK='#1c1638';
/* the game's directions: 0 up (back to us), 1 right, 2 down (facing us), 3 left */
const DIRYAW=[PI,HP,0,-HP];
const KZ=.5; // ground depth to screen y: the camera looks down a little
/* the body plan, feet at 0. Short legs and a short body under a big head:
   the head carries the face, so it is the part that keeps its size */
const ANK=-6, HIP=-20, T_TOP=-43, T_BOT=-14, SH_Y=-36, H_TOP=-88, H_H=44, H_BOT=H_TOP+H_H;
const LEG=7.2, ARM1=9, ARM2=8.6;
/* the clips were keyed on longer legs; these bring their squats and
   strides down to these */
const KC=.78, KS=.85;
function rr(g,x,y,w,h,r){r=Math.max(0,Math.min(r,Math.abs(w)/2,Math.abs(h)/2));g.beginPath();g.moveTo(x+r,y);g.lineTo(x+w-r,y);g.quadraticCurveTo(x+w,y,x+w,y+r);g.lineTo(x+w,y+h-r);g.quadraticCurveTo(x+w,y+h,x+w-r,y+h);g.lineTo(x+r,y+h);g.quadraticCurveTo(x,y+h,x,y+h-r);g.lineTo(x,y+r);g.quadraticCurveTo(x,y,x+r,y);g.closePath();}
function limb(g,pts,w,col,hi){
  g.lineCap='round';g.lineJoin='round';g.beginPath();g.moveTo(pts[0].x,pts[0].y);
  for(let i=1;i<pts.length;i++)g.lineTo(pts[i].x,pts[i].y);
  g.strokeStyle=col;g.lineWidth=w;g.stroke();
  if(hi){g.save();g.translate(-.7,-.9);g.strokeStyle=hi;g.lineWidth=w*.3;g.globalAlpha*=.55;g.stroke();g.restore();}
}
function feat(a){a=wrapA(a);const c=Math.cos(a),A=Math.abs(a);const u=A<=HP?Math.sin(a):Math.sign(a)*(1+(A-HP)/HP*.9);return{u,c,vis:sm(-.62,-.12,c)};}

/* ---------------------------------------------------------------- faces */
const EXP={
  neutral:{e:'cap',w:8.5,h:12,m:'smile',mw:8},
  happy:{e:'arc',w:10,h:9,m:'open',mw:9,blush:1},
  focus:{e:'cap',w:9,h:11,lid:.36,tilt:.5,m:'flat',mw:6},
  determined:{e:'cap',w:9,h:11,lid:.3,tilt:.45,m:'smile',mw:8},
  grit:{e:'chev',w:8,h:9,m:'grit',mw:11},
  surprised:{e:'round',w:11,h:11,m:'o',mw:4.5},
  think:{e:'cap',w:8.5,h:12,lidR:.45,m:'side',mw:6},
  wait:{e:'cap',w:8.5,h:12,lid:.3,m:'bar',mw:15},
  talk:{e:'cap',w:8.5,h:12,m:'eq',mw:11},
  dizzy:{e:'spiral',w:10,h:10,m:'wave',mw:10},
  error:{e:'x',w:9,h:9,m:'zig',mw:10,tint:'red'},
  tired:{e:'cap',w:8.5,h:11,lid:.5,tilt:-.2,m:'flat',mw:5,dim:.8},
  yawn:{e:'line',w:9,h:6,m:'yawn',mw:7,dim:.8},
  sleep:{e:'line',w:9,h:6,m:'small',mw:5,dim:.55},
  sad:{e:'cap',w:8.5,h:11,lid:.3,tilt:-.6,m:'frown',mw:8},
  love:{e:'heart',w:11,h:10,m:'open',mw:9,blush:1,col:'#ff95c8',glow:'rgba(255,110,190,.9)'},
  coin:{e:'coin',w:10,h:10,m:'open',mw:9,col:'#ffd34a',glow:'rgba(255,200,60,.9)'},
  scan:{e:'cap',w:10,h:5,m:'flat',mw:6},
  wink:{e:['cap','arc'],w:8.5,h:12,m:'smile',mw:9,blush:1}
};

/* ---------------------------------------------------------------- pose */
const NUMK=['x','fwd','lift','sx','sy','roll','lean','crouch','bob','yawAdd','headYaw','headTilt','headNod','headY',
  'lP','lR','lE','lX','lW','lG','rP','rR','rE','rX','rW','rG','fLz','fLy','fLp','fRz','fRy','fRp',
  'ant','lookX','lookY','blink','screen','energy','packScale','packFill','glow','vis','bucketTilt','bucketFill','talk','prog','scan',
  'carryS','carryY','glitch','gp','packB'];
function P0(){return{x:0,fwd:0,lift:0,sx:1,sy:1,roll:0,lean:0,crouch:0,bob:0,yawAdd:0,headYaw:0,headTilt:0,headNod:0,headY:0,
  lP:.06,lR:.13,lE:.28,lX:-.06,lW:-.4,lG:0,rP:.06,rR:.13,rE:.28,rX:-.06,rW:-.4,rG:0,
  fLz:0,fLy:0,fLp:0,fRz:0,fRy:0,fRp:0,ant:0,lookX:0,lookY:0,blink:0,screen:1,energy:.8,packScale:1,packFill:.35,glow:0,vis:1,
  bucketTilt:0,bucketFill:0,talk:0,prog:0,scan:-1,carryS:1,carryY:0,glitch:0,gp:0,packB:0,
  expr:'neutral',bulb:'idle',tool:null,carry:null,carryHand:'both',charge:false,packFull:false,point:false,moving:false};}
function mixPose(A,B,w){
  const R=Object.assign({},w<.5?A:B);
  for(const k of NUMK){const a=A[k];let b=B[k];if(k==='yawAdd'||k==='headYaw')b=a+wrapA(b-a);R[k]=a+(b-a)*w;}
  return R;
}
function breathe(P,ms,k,per){k=k==null?1:k;per=per||2600;const b=Math.sin(ms/per*TAU);P.bob+=-.9*b*k;P.sy*=1+.012*b*k;P.sx*=1-.008*b*k;P.lR+=.025*b*k;P.rR+=.025*b*k;return b;}

/* ---------------------------------------------------------------- the robot */
const WEAR_S=34.56; // the body square the hats, outfits and capes were drawn on (TILE*.72 at TILE 48)
class Bot{
  constructor(color,dir){
    dir=dir==null?2:dir;
    this.color=color;this.dir=dir;this.yaw=DIRYAW[dir];this.hyaw=this.yaw;this.yv=0;this.hv=0;this.lock=false;
    this.hp=0;this.hpv=0;this.hlag=0;
    this.tip=null;this.tipv={x:0,y:0};this.base=null;this.ant={x:0,y:-15};
    this.blinkIn=900+Math.random()*2600;this.blinkT=-1;this.dbl=false;this.bv=0;
    this.expr='neutral';this.exprNext=null;this.swapT=-1;this.swapK=1;this.anchors={};
    this.last=null;this.key=null;this.from=null;this.bt=1;
  }
  face(d,snap){this.dir=d&3;if(snap){this.yaw=this.hyaw=DIRYAW[this.dir];this.yv=this.hv=0;}}
  setYaw(a){this.lock=true;this.yaw=this.hyaw=a;}
  /* a new kind of pose fades in over 150ms from wherever the robot is */
  blend(P,key,dt){
    if(key!==this.key){if(this.last){this.from=this.last;this.bt=0;}this.key=key;}
    if(this.from&&this.bt<1){this.bt=Math.min(1,this.bt+dt/150);P=mixPose(this.from,P,E.io(this.bt));if(this.bt>=1)this.from=null;}
    this.last=P;return P;
  }
  update(dt,P){
    const steps=dt>20?2:1, h=Math.min(dt,60)/1000/steps;
    for(let s=0;s<steps;s++){
      if(!this.lock){
        const tb=this.yaw+wrapA(DIRYAW[this.dir]-this.yaw), th=this.hyaw+wrapA(DIRYAW[this.dir]-this.hyaw);
        this.yv+=(150*(tb-this.yaw)-16*this.yv)*h;this.yaw+=this.yv*h;   // the body: a little overshoot
        this.hv+=(380*(th-this.hyaw)-29*this.hv)*h;this.hyaw+=this.hv*h; // the head gets there first
      }
      const by=P.bob+P.crouch*KC-P.lift;
      this.hpv+=(320*(by-this.hp)-24*this.hpv)*h;this.hp+=this.hpv*h;
      this.hlag=clamp(this.hp-by,-4,4)*.85;
    }
    /* the antenna tip is a damped spring chasing its base, so it trails
       every step, hop and turn */
    const ah=this.hyaw+P.yawAdd+P.headYaw;
    const bx=P.x-Math.sin(ah)*3, byy=H_TOP+P.bob+P.crouch*KC-P.lift+this.hlag+P.headY;
    const rest=this.restOf(P);
    if(!this.base){this.base={x:bx,y:byy};this.tip={x:bx+rest.x,y:byy+rest.y};}
    const hs=Math.max(1e-3,Math.min(dt,60)/1000);
    const bvx=(bx-this.base.x)/hs, bvy=(byy-this.base.y)/hs;
    this.base={x:bx,y:byy};
    if(dt>0){const sub=4, hh=hs/sub;
      for(let s=0;s<sub;s++){
        const tx=bx+rest.x, ty=byy+rest.y;
        this.tipv.x+=(-240*(this.tip.x-tx)-8*(this.tipv.x-bvx))*hh;
        this.tipv.y+=(-240*(this.tip.y-ty)-8*(this.tipv.y-bvy))*hh;
        this.tip.x+=this.tipv.x*hh;this.tip.y+=this.tipv.y*hh;
      }}
    let ox=this.tip.x-bx, oy=this.tip.y-byy;
    const dx=ox-rest.x, dy=oy-rest.y, dl=Math.hypot(dx,dy);
    if(dl>9){ox=rest.x+dx/dl*9;oy=rest.y+dy/dl*9;this.tip.x=bx+ox;this.tip.y=byy+oy;}
    this.ant={x:ox,y:oy};
    // blinking, with the odd double blink
    this.blinkIn-=dt;
    if(this.blinkIn<0&&this.blinkT<0){this.blinkT=0;this.blinkIn=2300+Math.random()*2700;this.dbl=Math.random()<.2;}
    if(this.blinkT>=0){this.blinkT+=dt;const D=this.dbl?300:150;if(this.blinkT>D){this.blinkT=-1;this.bv=0;}else this.bv=Math.sin(PI*(this.blinkT%150)/150);}
    // an expression change hides behind a quick squint
    const want=P.expr||'neutral', cur=this.exprNext||this.expr;
    if(want!==cur){this.exprNext=want;this.swapT=0;}
    if(this.swapT>=0){this.swapT+=dt;if(this.swapT>55&&this.exprNext){this.expr=this.exprNext;this.exprNext=null;}
      if(this.swapT>120){this.swapT=-1;this.swapK=1;}else this.swapK=1-.85*Math.sin(PI*this.swapT/120);}
  }
  restOf(P){const a=P.ant+P.headTilt+P.roll;return{x:Math.sin(a)*15,y:-Math.cos(a)*15+(P.ant?Math.abs(Math.sin(P.ant))*2:0)};}
  /* o: {t, wear:{hat,outfit,shoes}, small, glow, noShadow}. X,Y is the ground
     point and s the size of one rig unit, both in the caller's space. */
  draw(g,P,X,Y,s,o){
    o=o||{};
    const m0=g.getTransform(), dev=Math.hypot(m0.a,m0.b)*s, inv=m0.inverse();
    const small=o.small!=null?o.small:dev<1.25, t=o.t||0;
    const a=this.yaw+P.yawAdd, ah=this.hyaw+P.yawAdd+P.headYaw, ca=Math.cos(a), sa=Math.sin(a);
    const anc=this.anchors, pal=PAL(this.color);
    /* anchors come back in the caller's own space, whatever the rig did to
       the transform on the way */
    const AP=(x,y)=>{const m=g.getTransform();const px=m.a*x+m.c*y+m.e, py=m.b*x+m.d*y+m.f;return{x:inv.a*px+inv.c*py+inv.e,y:inv.b*px+inv.d*py+inv.f};};
    this.ctx={pal,small,t,AP,glow:!small&&o.glow!==false,s,dev,wear:o.wear||{}};
    g.save();g.translate(X,Y);g.scale(s,s);
    const lf=Math.max(0,P.lift), sh=1-clamp(lf/100,0,.6);
    // the map's own soft shadow
    if(!o.noShadow&&P.vis>0){g.fillStyle='rgba(0,0,0,'+(.2*sh*Math.min(1,P.vis*1.5)).toFixed(3)+')';g.beginPath();g.ellipse(0,1,Math.max(1,26*sh*Math.min(1.3,P.sx)),Math.max(1,7.5*sh),0,0,TAU);g.fill();}
    if(P.vis<=.001){anc.valid=false;g.restore();return;}
    g.rotate(P.roll);g.scale(Math.max(.01,P.sx),Math.max(.01,P.sy));g.translate(0,-P.lift);
    anc.ground=AP(0,0);
    const bodyY=P.bob+P.crouch*KC;
    const W=this.ctx.wear, cape=W.outfit&&window.CC_WEAR&&CC_WEAR.back&&CC_WEAR.back[W.outfit];
    const upper=()=>{g.translate(0,bodyY);g.translate(0,HIP);g.rotate(P.lean*sa);g.scale(1,1-.1*Math.abs(P.lean*ca));g.translate(0,-HIP);};
    // a cape seen from the front hangs behind everything, legs included
    if(cape&&ca>.2){g.save();upper();this.cape(g,a,P);g.restore();}
    const legs=[-1,1].map(sd=>({sd,x:sd*8.5*ca,d:-sd*8.5*sa}));
    legs.sort((p,q)=>p.d-q.d);
    for(const L of legs)this.leg(g,L,P,a,bodyY);
    g.save();upper();
    const swap=sa>.15; // facing right, the near arm is the left one: it does the work
    const arms=[-1,1].map(sd=>this.armPts(sd,a,P,(sd>0)!==swap));
    const parts=[{d:0,i:0,f:()=>this.torso(g,a,P)},{d:-ca*20-1,i:1,f:()=>this.pack(g,a,P)},{d:.2,i:2,f:()=>this.head(g,ah,P)}];
    if(cape&&ca<=.2)parts.push({d:-ca*22-2,i:1,f:()=>this.cape(g,a,P)});
    for(const A of arms)parts.push({d:A.d,i:3,f:()=>this.arm(g,A,P)});
    if(P.carry&&P.carryHand==='both')parts.push({d:Math.max(arms[0].d,arms[1].d)+1,i:4,f:()=>{
      const x=(arms[0].H.x+arms[1].H.x)/2, y=(arms[0].H.y+arms[1].H.y)/2-6+P.carryY;
      drawItem(g,P.carry,x,y,P.carryS,t);anc.carry=AP(x,y);}});
    parts.sort((p,q)=>p.d-q.d||p.i-q.i);
    for(const p of parts)p.f();
    anc.chest=AP(0,(T_TOP+T_BOT)/2);anc.packTop=AP(-sa*20,T_TOP+1);
    g.restore();g.restore();anc.valid=true;
  }
  cape(g,a,P){
    const ca=Math.cos(a), sa=Math.sin(a), hw=Math.hypot(19*ca,15*sa);
    g.save();g.translate(0,(T_TOP+T_BOT)/2);g.scale(2*hw/WEAR_S,(T_BOT-T_TOP)/WEAR_S);
    CC_WEAR.back(g,this.ctx.wear.outfit,(P.roll+P.lean*sa)*57.3,P.gp||0);
    g.restore();
  }
  leg(g,L,P,a,bodyY){
    const {pal,AP,small,t}=this.ctx, sd=L.sd, isL=sd<0, ca=Math.cos(a), sa=Math.sin(a);
    const fz=(isL?P.fLz:P.fRz)*KS, fy=isL?P.fLy:P.fRy, fp=isL?P.fLp:P.fRp;
    const hy=HIP+bodyY+L.d*.22, ay=ANK-fy+L.d*.22;
    let dy=ay-hy, dz=fz, d=Math.hypot(dy,dz);
    const MX=LEG*2-.05;
    if(d>MX){const k=MX/d;dy*=k;dz*=k;d=MX;}
    d=Math.max(d,.5);
    const th=Math.atan2(dz,dy), al=Math.acos(clamp((LEG*LEG+d*d-LEG*LEG)/(2*LEG*d),-1,1));
    const kz=Math.sin(th+al)*LEG, ky=Math.cos(th+al)*LEG, bend=Math.max(0,MX-d);
    const pr=(x,y,z)=>({x:L.x+x*ca+z*sa,y:hy+y+(-x*sa+z*ca)*KZ});
    const H={x:L.x,y:hy}, Kn=pr(sd*(.6+bend*.35),ky,kz), A=pr(sd*1.4,dy,dz);
    limb(g,[H,Kn,A],6.4,pal.limb,small?null:pal.limbHi);
    g.fillStyle=pal.limbHi;g.beginPath();g.arc(Kn.x,Kn.y,2.5,0,TAU);g.fill();
    const fs=Math.abs(sa)>.15?Math.sign(sa):0;
    const shoe=this.ctx.wear.shoes;
    if(shoe&&window.CC_WEAR){
      /* a shoe is drawn foot-local, origin at the leg end: it rides the same
         pitch the boot would have, so it never slides */
      g.save();g.translate(A.x+2*sa,A.y-2);g.rotate(-fp*fs);g.scale(1.1,1.1);
      CC_WEAR.shoe(g,shoe,pal.limb,!!P.moving,t);
      this.anchors[isL?'footL':'footR']=AP(0,8);
      g.restore();
    }else{
      const len=11.5*Math.abs(ca)+16*Math.abs(sa), bh=8.6*(fs?1:1-.25*Math.abs(fp));
      g.save();g.translate(A.x,A.y);g.rotate(-fp*fs);
      const x0=-len/2+2.6*sa, y0=6-bh;
      const bootPath=()=>{g.beginPath();g.moveTo(x0+4,y0);g.lineTo(x0+len-4.5,y0);g.quadraticCurveTo(x0+len,y0,x0+len,y0+4.6);g.lineTo(x0+len,y0+bh);g.lineTo(x0,y0+bh);g.lineTo(x0,y0+4);g.quadraticCurveTo(x0,y0,x0+4,y0);g.closePath();};
      bootPath();g.fillStyle=pal.boot;g.fill();
      g.save();bootPath();g.clip();
      g.fillStyle=SOLE;g.fillRect(x0-1,y0+bh-2.7,len+2,3);
      if(!small){g.fillStyle=pal.bootHi;g.globalAlpha*=.7;g.beginPath();g.ellipse(x0+len*(fs?(fs>0?.72:.28):.5),y0+2.6,len*.2,1.6,0,0,TAU);g.fill();}
      g.restore();
      this.anchors[isL?'footL':'footR']=AP(x0+len/2,6);
      g.restore();
    }
    this.anchors[isL?'hipL':'hipR']=AP(H.x,H.y);this.anchors[isL?'kneeL':'kneeR']=AP(Kn.x,Kn.y);this.anchors[isL?'ankleL':'ankleR']=AP(A.x,A.y);
  }
  armPts(sd,a,P,work){
    const isL=!work, ca=Math.cos(a), sa=Math.sin(a);
    const p=isL?P.lP:P.rP, r=isL?P.lR:P.rR, e=isL?P.lE:P.rE, x2=isL?P.lX:P.rX, w=isL?P.lW:P.rW, gr=isL?P.lG:P.rG;
    const Sd=-sd*20.5*sa, S={x:sd*20.5*ca-sa*2.5,y:SH_Y+Sd*.08};
    const u=[sd*Math.sin(r)*ARM1,Math.cos(r)*Math.cos(p)*ARM1,Math.cos(r)*Math.sin(p)*ARM1];
    const r2=r+x2, q=p+e;
    const f=[sd*Math.sin(r2)*ARM2,Math.cos(r2)*Math.cos(q)*ARM2,Math.cos(r2)*Math.sin(q)*ARM2];
    const R=v=>({x:v[0]*ca+v[2]*sa,z:-v[0]*sa+v[2]*ca,y:v[1]});
    const U=R(u), F=R(f);
    const El={x:S.x+U.x,y:S.y+U.y+U.z*.3}, H={x:El.x+F.x,y:El.y+F.y+F.z*.3};
    const qT=q+HP+w;
    const T=R([0,Math.cos(qT),Math.sin(qT)]), B=R([0,Math.cos(qT+HP),Math.sin(qT+HP)]);
    return{sd,isL,S,El,H,hz:Sd+U.z+F.z,d:Sd+(U.z+F.z)*.6+.5,T:{x:T.x,y:T.y+T.z*.3},B:{x:B.x,y:B.y+B.z*.3},F:{x:F.x,y:F.y+F.z*.3},gr,fs:Math.abs(sa)>.15?Math.sign(sa):0};
  }
  arm(g,A,P){
    const {pal,AP,small,t}=this.ctx;
    const tool=A.isL?null:P.tool;
    if(tool&&tool!=='bucket')drawTool(g,tool,A,P,this);
    limb(g,[A.S,A.El,A.H],6,pal.limb,small?null:pal.limbHi);
    g.fillStyle=pal.limbHi;g.beginPath();g.arc(A.El.x,A.El.y,2.4,0,TAU);g.fill();
    // the shoulder cap is the team colour: it ties the arm to the body
    g.beginPath();g.arc(A.S.x,A.S.y,5,0,TAU);g.fillStyle=pal.lo;g.fill();
    if(tool==='bucket')drawTool(g,tool,A,P,this);
    if(!A.isL&&P.carry&&P.carryHand==='r')drawItem(g,P.carry,A.H.x+A.F.x*.25,A.H.y+A.F.y*.25+2,P.carryS*.9,t);
    const hr=5.3*(1+clamp(A.hz,-20,20)*.006);
    if(!A.isL&&P.point){const fl=Math.hypot(A.F.x,A.F.y)||1;limb(g,[{x:A.H.x,y:A.H.y},{x:A.H.x+A.F.x/fl*8,y:A.H.y+A.F.y/fl*8}],3.2,MITT);}
    g.beginPath();g.arc(A.H.x,A.H.y,A.gr>.5?hr*.9:hr,0,TAU);g.fillStyle=MITT;g.fill();
    if(!small){g.save();g.fillStyle=MITT_SH;g.globalAlpha*=.6;g.beginPath();g.arc(A.H.x+1.2,A.H.y+1.4,hr*.55,0,TAU);g.fill();g.restore();}
    if(A.gr>.5&&!small){g.strokeStyle='rgba(28,22,56,.3)';g.lineWidth=1;g.beginPath();g.moveTo(A.H.x-2.4,A.H.y-.5);g.lineTo(A.H.x+2.4,A.H.y-.5);g.stroke();}
    this.anchors[A.isL?'handL':'handR']=AP(A.H.x,A.H.y);
    this.anchors[A.isL?'shL':'shR']=AP(A.S.x,A.S.y);this.anchors[A.isL?'elL':'elR']=AP(A.El.x,A.El.y);
  }
  torso(g,a,P){
    const {pal,small,t}=this.ctx, ca=Math.cos(a), sa=Math.sin(a);
    const hw=Math.hypot(19*ca,15*sa), top=T_TOP, bot=T_BOT, tw=hw*.9;
    const path=()=>{g.beginPath();g.moveTo(-tw+8,top);g.lineTo(tw-8,top);g.quadraticCurveTo(tw,top,tw+.4,top+8);g.lineTo(hw,bot-9);g.quadraticCurveTo(hw,bot,hw-9,bot);g.lineTo(-hw+9,bot);g.quadraticCurveTo(-hw,bot,-hw,bot-9);g.lineTo(-tw-.4,top+8);g.quadraticCurveTo(-tw,top,-tw+8,top);g.closePath();};
    const gr=g.createLinearGradient(0,top,0,bot);gr.addColorStop(0,pal.hi);gr.addColorStop(.45,pal.base);gr.addColorStop(1,pal.lo);
    path();g.fillStyle=gr;g.fill();
    g.save();path();g.clip();
    /* the torso anchor: an outfit is painted inside the body's own clip, on
       the square it was drawn for, stretched to this torso */
    const W=this.ctx.wear;
    if(W.outfit&&window.CC_WEAR){g.save();g.translate(0,(top+bot)/2);g.scale(2*hw/WEAR_S,(bot-top)/WEAR_S);CC_WEAR.outfit(g,W.outfit,pal.base);g.restore();}
    if(!small){const sg=g.createLinearGradient(-hw,0,hw,0);sg.addColorStop(0,'rgba(255,255,255,.12)');sg.addColorStop(.5,'rgba(255,255,255,0)');sg.addColorStop(1,'rgba(10,0,40,.14)');
      g.fillStyle=sg;g.fillRect(-hw-2,top,hw*2+4,bot-top);}
    g.fillStyle=pal.dk;g.fillRect(-hw-2,bot-5,hw*2+4,5.5);
    g.fillStyle='rgba(255,255,255,.18)';g.fillRect(-hw-2,bot-5,hw*2+4,1.1);
    // the backpack's straps, on the side that faces us
    for(const sd of [-1,1]){const ph=a+sd*.78, c=Math.cos(ph);if(c>.05){const x=Math.sin(ph)*hw*.95, w=4.4*Math.max(.35,c);
      g.fillStyle=pal.limb;rr(g,x-w/2,top-2,w,20,1.6);g.fill();
      if(!small){g.fillStyle=PACK_DK;rr(g,x-w/2-.6,top+12.5,w+1.2,3.2,1);g.fill();}}}
    const f=feat(a);
    if(f.vis>.01)this.belly(g,f,hw,P);
    if(!small){g.fillStyle='rgba(255,255,255,.3)';rr(g,-tw+7,top+2.2,tw*2-16,3,1.5);g.fill();}
    g.restore();
  }
  belly(g,f,hw,P){
    const {small,t,AP}=this.ctx;
    const bw=19*(.62+.38*Math.max(0,f.c)), bh=14.5, bx=f.u*hw*.42, by=T_TOP+13.5;
    g.save();g.globalAlpha*=f.vis;
    rr(g,bx-bw/2,by-bh/2,bw,bh,5);g.fillStyle=CREAM;g.fill();
    // the battery is the robot's energy
    const W=bw-7.5, Hh=6.6, x0=bx-W/2-1, y0=by-Hh/2;
    rr(g,x0,y0,W,Hh,2);g.strokeStyle=INK;g.lineWidth=1.2;g.stroke();
    g.fillStyle=INK;g.fillRect(x0+W,by-1.6,1.8,3.2);
    let lvl=clamp(P.energy,0,1), col='#3fcf63';
    if(P.charge){lvl=.25+((t/3600)%1)*.75;}
    const n=Math.max(1,Math.ceil(lvl*4-.001));
    if(lvl<.27&&!P.charge){col='#ff5d73';if(Math.floor(t/420)%2)col='rgba(255,93,115,.25)';}
    else if(lvl<.55&&!P.charge)col='#ffb830';
    const sw=(W-2.4)/4;
    g.fillStyle=col;for(let i=0;i<n;i++){rr(g,x0+1.2+i*sw+.35,y0+1.2,sw-.7,Hh-2.4,.7);g.fill();}
    if(P.charge&&!small){g.fillStyle='#ffd24a';g.beginPath();
      const cx=bx-1,cy=by;g.moveTo(cx+1,cy-4.6);g.lineTo(cx-2.2,cy+.6);g.lineTo(cx,cy+.6);g.lineTo(cx-1,cy+4.6);g.lineTo(cx+2.4,cy-.8);g.lineTo(cx+.2,cy-.8);g.closePath();g.fill();}
    g.restore();
    this.anchors.battery=AP(bx,by);
  }
  pack(g,a,P){
    const {small,t,AP}=this.ctx, ca=Math.cos(a), sa=Math.sin(a);
    const sc=P.packScale*(1+(P.packB||0)*.07), sq=1-(P.packB||0)*.07;
    const pw=(28*Math.abs(ca)+11*Math.abs(sa))*sc, ph=24*sc*sq, px=-sa*(18.5+(sc-1)*10), bot=T_BOT-2.5, top=bot-ph;
    if(P.packFull){ // so full that things poke out of the top
      g.fillStyle='#b8783e';rr(g,px-pw*.32-4,top-6,9,12,3);g.fill();
      g.fillStyle='#e9b37a';g.beginPath();g.ellipse(px-pw*.32+.5,top-6,4.5,2,0,0,TAU);g.fill();
      drawItem(g,'gem',px+pw*.18,top-3,.75,t);
    }
    const gr=g.createLinearGradient(0,top,0,bot);gr.addColorStop(0,PACK_HI);gr.addColorStop(1,PACK);
    rr(g,px-pw/2,top,pw,ph,7);g.fillStyle=gr;g.fill();
    g.save();rr(g,px-pw/2,top,pw,ph,7);g.clip();
    g.fillStyle='rgba(0,0,0,.1)';g.fillRect(px-pw/2,bot-4,pw,4);
    const back=-ca;
    if(back>.05){
      g.globalAlpha*=sm(.05,.45,back);
      g.fillStyle=PACK_DK;rr(g,px-pw/2,top-2,pw,ph*.38+2,7);g.fill();
      // the window shows how full the bag is
      const ww=Math.max(4,pw*.42), wh=ph*.34, wx=px-ww/2, wy=top+ph*.5;
      rr(g,wx,wy,ww,wh,3);g.fillStyle='rgba(20,16,50,.75)';g.fill();
      const lvl=clamp(P.packFill,0,1), cols=['#7cf1ff','#b8783e','#9aa3b8','#ffd34a'];
      const nItems=Math.round(lvl*6);
      for(let i=0;i<nItems;i++){g.fillStyle=cols[i%4];const cx=wx+3+(i%3)*(ww-6)/2, cy=wy+wh-3-Math.floor(i/3)*3.4;g.beginPath();g.arc(cx,cy,1.6,0,TAU);g.fill();}
      if(!small){g.fillStyle=this.ctx.pal.limb;rr(g,px-2.2,top+ph*.36,4.4,4,1.2);g.fill();}
    }
    g.restore();
    this.anchors.packC=AP(px,top+ph/2);
  }
  head(g,ah,P){
    const {pal,small,t,AP}=this.ctx, ca=Math.cos(ah), sa=Math.sin(ah);
    const hw=Math.hypot(29*ca,24*sa)+2*Math.abs(Math.sin(2*ah)), top=H_TOP, H=H_H, rad=15;
    g.save();
    g.translate(0,this.hlag+P.headY);
    g.translate(0,H_BOT-1);g.rotate(P.headTilt);g.translate(0,-(H_BOT-1));
    g.fillStyle=pal.limb;rr(g,-7.5,H_BOT-5,15,9,3);g.fill();
    const ears=[-1,1].map(sd=>{const ph=ah+sd*HP, c=Math.cos(ph);return{sd,c,x:Math.sin(ph)*(hw+1.5*(1-Math.max(0,c)))-sa*hw*.42*Math.max(0,c)};});
    const ear=e=>{const rx=2.6+4.6*Math.max(0,e.c), ey=top+23+P.headNod*1.5;
      g.beginPath();g.ellipse(e.x,ey,rx,8.6,0,0,TAU);g.fillStyle=pal.limb;g.fill();
      if(e.c>.15){g.beginPath();g.ellipse(e.x,ey,rx*.55,5,0,0,TAU);g.fillStyle=pal.hi;g.fill();
        if(!small){g.fillStyle='rgba(255,255,255,.7)';g.beginPath();g.arc(e.x-rx*.15,ey-2,1.1,0,TAU);g.fill();}
        this.anchors.ear=AP(e.x,ey);}};
    ears.filter(e=>e.c<=.15).forEach(ear);
    const shell=()=>rr(g,-hw,top,hw*2,H,rad);
    const gr=g.createLinearGradient(0,top,0,top+H);gr.addColorStop(0,pal.hi);gr.addColorStop(.5,pal.base);gr.addColorStop(1,pal.lo);
    shell();g.fillStyle=gr;g.fill();
    g.save();shell();g.clip();
    if(!small){const sg=g.createLinearGradient(-hw,0,hw,0);sg.addColorStop(0,'rgba(255,255,255,.14)');sg.addColorStop(.5,'rgba(255,255,255,0)');sg.addColorStop(1,'rgba(10,0,40,.16)');
      g.fillStyle=sg;g.fillRect(-hw,top,hw*2,H);
      g.fillStyle='rgba(255,255,255,.4)';rr(g,-hw+7,top+3,hw*2-18,4.2,2.1);g.fill();}
    g.fillStyle='rgba(10,0,40,.14)';g.fillRect(-hw,top+H-5,hw*2,5);
    const fb=feat(ah+PI);fb.vis=sm(.15,.55,fb.c);
    if(fb.vis>.01){ // the back of the head: vents and the </> mark
      g.save();g.globalAlpha*=fb.vis;const bx=fb.u*hw*.4, k=.6+.4*Math.max(0,fb.c);
      g.strokeStyle='rgba(28,22,56,.4)';g.lineWidth=2.4;g.lineCap='round';
      for(let i=0;i<3;i++){g.beginPath();g.moveTo(bx-9*k,top+11+i*5);g.lineTo(bx+9*k,top+11+i*5);g.stroke();}
      g.strokeStyle='rgba(255,255,255,.55)';g.lineWidth=2;g.lineJoin='round';const my=top+32;
      g.beginPath();g.moveTo(bx-5*k,my-3.5);g.lineTo(bx-9*k,my);g.lineTo(bx-5*k,my+3.5);g.moveTo(bx+5*k,my-3.5);g.lineTo(bx+9*k,my);g.lineTo(bx+5*k,my+3.5);
      g.moveTo(bx+1.6*k,my-4.2);g.lineTo(bx-1.6*k,my+4.2);g.stroke();g.restore();
    }
    const f=feat(ah);
    if(f.vis>.01)this.screen(g,f,hw,P);
    g.restore();
    ears.filter(e=>e.c>.15).forEach(ear);
    this.antenna(g,ah,P);
    this.anchors.headC=AP(0,top+H/2);this.anchors.hat=AP(0,top);
    /* the head anchor. A hat is drawn here, after the antenna and inside
       the head's own transform, so it rides every nod, tilt, lag, lean and
       squash the head does — and sits over the antenna, as it always has.
       Hats were made on a body square of WEAR_S; that square's top edge is
       put on the top of this head. */
    const W=this.ctx.wear;
    if(W.hat){
      const k=58/WEAR_S;
      g.save();g.translate(0,top+WEAR_S/2*k);g.scale(k,k);
      if(!(window.CC_WEAR&&CC_WEAR.hat(g,W.hat))&&typeof sprite==='function'){
        const hp=sprite(W.hat,24);
        g.drawImage(hp,-hp.lw/2,-WEAR_S/2-4.75-hp.lw/2,hp.lw,hp.lw);
      }
      g.restore();
    }
    g.restore();
  }
  screen(g,f,hw,P){
    const {t,small,AP,pal}=this.ctx;
    const sw=40*(.6+.4*Math.max(0,f.c)), sh=29, sx=f.u*hw*.4, sy=H_TOP+21.5+P.headNod*3.2;
    g.save();g.globalAlpha*=f.vis;
    if(!small){g.save();g.globalAlpha*=.55;rr(g,sx-sw/2-2.4,sy-sh/2-2.4,sw+4.8,sh+4.8,11.5);g.fillStyle=pal.dk;g.fill();g.restore();}
    const sg=g.createLinearGradient(0,sy-sh/2,0,sy+sh/2);sg.addColorStop(0,SCR_A);sg.addColorStop(1,SCR_B);
    rr(g,sx-sw/2,sy-sh/2,sw,sh,9);g.fillStyle=sg;g.fill();
    g.save();rr(g,sx-sw/2,sy-sh/2,sw,sh,9);g.clip();
    drawFace(g,this,P,sx,sy,sw,sh,f);
    if(!small){g.fillStyle='rgba(255,255,255,.07)';g.beginPath();g.moveTo(sx-sw/2,sy-sh/2);g.lineTo(sx-sw/2+sw*.5,sy-sh/2);g.lineTo(sx-sw/2+sw*.2,sy+sh/2);g.lineTo(sx-sw/2,sy+sh/2);g.closePath();g.fill();}
    g.restore();
    g.restore();
    this.anchors.screen=AP(sx,sy);
  }
  antenna(g,ah,P){
    const {small,t,AP,pal}=this.ctx;
    const bx=-Math.sin(ah)*3, by=H_TOP+P.headNod*1.2, o=this.ant, tx=bx+o.x, ty=by+o.y;
    g.lineCap='round';
    g.beginPath();g.moveTo(bx,by);g.quadraticCurveTo(bx,by-8,tx,ty+4.5);g.strokeStyle=pal.limb;g.lineWidth=2.8;g.stroke();
    g.beginPath();g.ellipse(bx,by,5,2.3,0,0,TAU);g.fillStyle=pal.limb;g.fill();
    // the bulb is the program's state
    const st=P.bulb||'idle', col=bulbCol(st,t);
    const gl=Math.max(P.glow,{run:.55,think:.45+.3*Math.sin(t/260),error:.8,party:.9,idle:.22,sleep:.15+.15*Math.sin(t/900),off:0}[st]||0);
    if(!small&&gl>0){const rg=g.createRadialGradient(tx,ty,2,tx,ty,15);rg.addColorStop(0,colA(col,.55*gl));rg.addColorStop(1,colA(col,0));g.fillStyle=rg;g.beginPath();g.arc(tx,ty,15,0,TAU);g.fill();}
    if(small){g.fillStyle=col;}
    else{const bg=g.createRadialGradient(tx-1.8,ty-2,.5,tx,ty,6);bg.addColorStop(0,'#ffffff');bg.addColorStop(.35,col);bg.addColorStop(1,shadeAny(col,-.25));g.fillStyle=bg;}
    g.beginPath();g.arc(tx,ty,5.6,0,TAU);g.fill();
    this.anchors.bulb=AP(tx,ty);
  }
}
function bulbCol(st,t){switch(st){case'run':return'#5ee07a';case'think':return'#5ab8ff';case'error':return(Math.floor(t/170)%2)?'#ff5d73':'#c23a55';
  case'sleep':return'#8b80c4';case'off':return'#5c5684';case'party':return'hsl('+Math.round((t/4)%360)+',92%,62%)';default:return'#ffd24a';}}
function colA(c,a){if(c[0]==='#'){const r=hexRgb(c);return'rgba('+r.join(',')+','+a.toFixed(3)+')';}if(c.indexOf('hsl(')===0)return c.replace('hsl(','hsla(').replace(')',','+a.toFixed(3)+')');return c;}
function shadeAny(c,a){return c[0]==='#'?shade(c,a):c;}

function drawFace(g,bot,P,sx,sy,sw,sh,f){
  const {t,small}=bot.ctx;
  const ex=EXP[bot.expr]||EXP.neutral;
  const bright=clamp(P.screen,0,1)*(ex.dim||1);
  if(bright<=.02)return;
  let col=ex.col||EYE, glow=ex.glow||'rgba(70,215,255,.85)';
  if(ex.tint==='red'){col='#ff8796';glow='rgba(255,80,110,.9)';}
  g.save();g.globalAlpha*=bright;
  if(ex.tint==='red'){g.fillStyle='rgba(255,50,90,.2)';g.fillRect(sx-sw/2,sy-sh/2,sw,sh);}
  const k=sw/40, lx=P.lookX*sw*.12+f.u*sw*.05, ly=P.lookY*sh*.13, sp=sw*.245*(1-Math.abs(f.u)*.1), ey=sy-3.2+ly;
  const isCap=ex.e==='cap'||Array.isArray(ex.e);
  const open=(1-clamp(Math.max(P.blink,isCap?bot.bv:0),0,1))*bot.swapK;
  const useGlow=bot.ctx.glow;
  for(const sd of [-1,1]){
    const mode=Array.isArray(ex.e)?ex.e[sd<0?0:1]:ex.e;
    const per=1-sd*f.u*.1;
    drawEye(g,mode,sx+lx+sd*sp,ey,ex.w*k*per,ex.h*per,ex,sd,col,glow,mode==='cap'?open:Math.max(.3,bot.swapK),t,useGlow);
  }
  g.shadowBlur=0;
  if(ex.blush&&!small){g.fillStyle='rgba(255,130,190,.42)';for(const sd of [-1,1]){g.beginPath();g.ellipse(sx+lx+sd*sp*1.12,ey+6.6,3.2*k,1.9,0,0,TAU);g.fill();}}
  if(useGlow){g.shadowColor=glow;g.shadowBlur=5*(bot.ctx.dev||1)/2;}
  drawMouth(g,ex,sx+lx*.7,sy+8.4+ly*.6,P,t,col,k);
  g.shadowBlur=0;
  if(P.scan>=0){const y=sy-sh/2+P.scan*sh;g.fillStyle='rgba(190,250,255,.95)';g.fillRect(sx-sw/2,y-.8,sw,1.6);}
  if(P.glitch>0){for(let i=0;i<3;i++){const n=hn(Math.floor(t/45)*3+i);g.fillStyle=i%2?'rgba(255,60,110,'+(.4*P.glitch)+')':'rgba(80,230,255,'+(.35*P.glitch)+')';
    g.fillRect(sx-sw/2+(n-.5)*6,sy-sh/2+n*sh,sw,1.5+n*3);}}
  g.restore();
}
function drawEye(g,mode,x,y,w,h,ex,sd,col,glow,open,t,useGlow){
  g.fillStyle=col;g.strokeStyle=col;g.lineCap='round';g.lineJoin='round';
  if(useGlow){g.shadowColor=glow;g.shadowBlur=7;}
  switch(mode){
    case'cap':{
      const hh=Math.max(1.6,h*open);
      if(hh<3.2){g.lineWidth=2.3;g.beginPath();g.moveTo(x-w/2+1,y+.5);g.lineTo(x+w/2-1,y+.5);g.stroke();break;}
      const own=sd<0?ex.lidL:ex.lidR, lid=own!=null?own:(ex.lid||0), tilt=ex.tilt||0;
      g.save();
      if(lid>0||tilt){const top=y-hh/2, inner=sd<0?1:-1;
        const yIn=top+hh*(lid+tilt*.5), yOut=top+hh*(lid-tilt*.5), xi=x+inner*(w/2+2), xo=x-inner*(w/2+2);
        g.beginPath();g.moveTo(xi,yIn);g.lineTo(xo,yOut);g.lineTo(xo,y+hh);g.lineTo(xi,y+hh);g.closePath();g.clip();}
      rr(g,x-w/2,y-hh/2,w,hh,Math.min(w,hh)/2);g.fill();
      g.restore();break;}
    case'arc':g.lineWidth=3;g.beginPath();g.moveTo(x-w/2,y+h*.22);g.quadraticCurveTo(x,y-h*.62,x+w/2,y+h*.22);g.stroke();break;
    case'round':{const r=w/2*Math.max(.2,open);g.beginPath();g.arc(x,y,r,0,TAU);g.fill();g.shadowBlur=0;g.fillStyle='rgba(16,18,48,.85)';g.beginPath();g.arc(x,y+.4,r*.42,0,TAU);g.fill();
      g.fillStyle='rgba(255,255,255,.9)';g.beginPath();g.arc(x-r*.35,y-r*.35,r*.2,0,TAU);g.fill();break;}
    case'line':g.lineWidth=2.6;g.beginPath();g.moveTo(x-w/2,y-1);g.quadraticCurveTo(x,y+h*.6,x+w/2,y-1);g.stroke();break;
    case'chev':{g.lineWidth=2.8;const i=sd<0?1:-1;g.beginPath();g.moveTo(x-i*w/2,y-h/2);g.lineTo(x+i*w/2,y);g.lineTo(x-i*w/2,y+h/2);g.stroke();break;}
    case'x':g.lineWidth=2.7;g.beginPath();g.moveTo(x-w/2,y-h/2);g.lineTo(x+w/2,y+h/2);g.moveTo(x+w/2,y-h/2);g.lineTo(x-w/2,y+h/2);g.stroke();break;
    case'spiral':{g.lineWidth=1.7;g.shadowBlur=Math.min(g.shadowBlur,3);g.beginPath();const rot=t*.012*sd;for(let i=0;i<=24;i++){const a=i*.46+rot, r=i/24*w/2;const px=x+Math.cos(a)*r, py=y+Math.sin(a)*r;i?g.lineTo(px,py):g.moveTo(px,py);}g.stroke();break;}
    case'heart':{const k=w/11*(1+.1*Math.sin(t/110));g.beginPath();g.moveTo(x,y+4.6*k);g.bezierCurveTo(x-7.2*k,y-.4*k,x-4.6*k,y-6.4*k,x,y-2.8*k);g.bezierCurveTo(x+4.6*k,y-6.4*k,x+7.2*k,y-.4*k,x,y+4.6*k);g.fill();break;}
    case'coin':{const sp=Math.abs(Math.cos(t/160+sd));g.beginPath();g.ellipse(x,y,Math.max(1,w/2*sp),w/2,0,0,TAU);g.fill();g.shadowBlur=0;
      g.strokeStyle='#b37a10';g.lineWidth=1.2;g.beginPath();g.ellipse(x,y,Math.max(.5,w/2*sp*.62),w/2*.62,0,0,TAU);g.stroke();break;}
    default:g.beginPath();g.arc(x,y,2.2,0,TAU);g.fill();
  }
  g.shadowBlur=0;
}
function drawMouth(g,ex,x,y,P,t,col,k){
  const w=(ex.mw||8)*k;g.lineWidth=2.1;g.strokeStyle=col;g.fillStyle=col;g.lineCap='round';g.lineJoin='round';
  switch(ex.m){
    case'smile':g.beginPath();g.moveTo(x-w/2,y);g.quadraticCurveTo(x,y+w*.45,x+w/2,y);g.stroke();break;
    case'open':g.beginPath();g.moveTo(x-w/2,y-.6);g.quadraticCurveTo(x,y+w*.9,x+w/2,y-.6);g.closePath();g.fill();break;
    case'flat':g.beginPath();g.moveTo(x-w/2,y+.5);g.lineTo(x+w/2,y+.5);g.stroke();break;
    case'small':g.beginPath();g.moveTo(x-2,y);g.quadraticCurveTo(x,y+1.6,x+2,y);g.stroke();break;
    case'o':{const r=w/2*(1+P.talk*.35);g.beginPath();g.arc(x,y+1,r,0,TAU);g.stroke();break;}
    case'wave':g.beginPath();for(let i=0;i<=12;i++){const px=x-w/2+i/12*w, py=y+Math.sin(i*1.25+t*.012)*1.3;i?g.lineTo(px,py):g.moveTo(px,py);}g.stroke();break;
    case'zig':g.beginPath();for(let i=0;i<=4;i++){const px=x-w/2+i/4*w, py=y+(i%2?-1.6:1.6);i?g.lineTo(px,py):g.moveTo(px,py);}g.stroke();break;
    case'frown':g.beginPath();g.moveTo(x-w/2,y+2.2);g.quadraticCurveTo(x,y-2.8,x+w/2,y+2.2);g.stroke();break;
    case'side':g.beginPath();g.moveTo(x-w/2,y+1.4);g.quadraticCurveTo(x-w*.1,y-1.4,x+w/2,y-.4);g.stroke();break;
    case'eq':{const n=5, bw=1.7*k, gap=(w-bw*n)/(n-1);for(let i=0;i<n;i++){const hh=1.4+P.talk*5.6*Math.abs(vn(t*.014+i*2.3));rr(g,x-w/2+i*(bw+gap),y+.5-hh/2,bw,hh,bw/2);g.fill();}break;}
    case'bar':{g.lineWidth=1.2;rr(g,x-w/2,y-2,w,4.4,2.2);g.stroke();const p=clamp(P.prog,0,1);if(p>.02){rr(g,x-w/2+1.1,y-.9,(w-2.2)*p,2.2,1.1);g.fill();}break;}
    case'grit':{rr(g,x-w/2,y-2.4,w,4.8,1.8);g.fill();g.shadowBlur=0;g.strokeStyle='rgba(16,18,48,.8)';g.lineWidth=.9;g.beginPath();
      for(let i=1;i<4;i++){g.moveTo(x-w/2+i*w/4,y-2.4);g.lineTo(x-w/2+i*w/4,y+2.4);}g.moveTo(x-w/2,y);g.lineTo(x+w/2,y);g.stroke();break;}
    case'yawn':{g.beginPath();g.ellipse(x,y+1.4,w*.32,1.8+P.talk*3.4,0,0,TAU);g.fill();break;}
  }
}

/* ---------------------------------------------------------------- tools and things
   no outlines here either; a faint edge only where steel meets steel */
const EDGE='rgba(28,22,56,.28)';
function drawTool(g,tool,A,P,bot){
  const H=A.H, tl=Math.hypot(A.T.x,A.T.y)||1, hx=A.T.x/tl, hy=A.T.y/tl, fo=Math.min(1,tl);
  let nx=-hy, ny=hx;const bd=A.B.x*nx+A.B.y*ny;if(bd<0){nx=-nx;ny=-ny;}
  const bw=clamp(Math.abs(bd),.4,1);
  const L=tool==='hammer'?15:21, tip={x:H.x+hx*L*fo,y:H.y+hy*L*fo};
  const Q=(a,n)=>({x:tip.x+hx*a*fo+nx*n*bw,y:tip.y+hy*a*fo+ny*n*bw});
  const AP=bot.ctx.AP;
  g.lineJoin='round';
  if(tool==='bucket'){
    g.save();g.translate(H.x,H.y);g.rotate(P.bucketTilt*(A.fs||.6));
    g.strokeStyle='#6f87a3';g.lineWidth=1.6;g.beginPath();g.moveTo(-6.5,4);g.quadraticCurveTo(0,-4,6.5,4);g.stroke();
    g.beginPath();g.moveTo(-7.2,4);g.lineTo(7.2,4);g.lineTo(5.6,17);g.lineTo(-5.6,17);g.closePath();g.fillStyle='#9dbbdc';g.fill();
    g.fillStyle='rgba(255,255,255,.4)';g.fillRect(-6.2,7.8,12.4,1.6);
    g.beginPath();g.ellipse(0,4,7.2,2.2,0,0,TAU);g.fillStyle=P.bucketFill>.5?'#4fc3ff':'#6d84a3';g.fill();
    bot.anchors.tool=AP(0,4);
    g.restore();return;
  }
  limb(g,[{x:H.x-hx*5*fo,y:H.y-hy*5*fo},tip],3.6,'#a46a35');
  const poly=(pts,fill)=>{g.beginPath();g.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)g.lineTo(pts[i].x,pts[i].y);g.closePath();g.fillStyle=fill;g.fill();};
  if(tool==='axe'){
    const p1=Q(-9,1.2),p2=Q(-10.5,10),c=Q(-4.5,16.5),p3=Q(2,10),p4=Q(.5,1.2);
    g.beginPath();g.moveTo(p1.x,p1.y);g.lineTo(p2.x,p2.y);g.quadraticCurveTo(c.x,c.y,p3.x,p3.y);g.lineTo(p4.x,p4.y);g.closePath();
    g.fillStyle='#dfe4ef';g.fill();g.strokeStyle=EDGE;g.lineWidth=1.2;g.stroke();
    const e1=Q(-9.6,9.6),ec=Q(-4.4,14.6),e2=Q(1.2,9.6);g.strokeStyle='#ffffff';g.lineWidth=1.3;g.beginPath();g.moveTo(e1.x,e1.y);g.quadraticCurveTo(ec.x,ec.y,e2.x,e2.y);g.stroke();
    poly([Q(-7,-1),Q(-7,-4.6),Q(-1,-4.6),Q(-1,-1)],'#e5505e');
    const e=Q(-4.5,14);bot.anchors.tool=AP(e.x,e.y);
  }else if(tool==='pick'){
    const a=Q(-2,-13),c1=Q(6,0),b=Q(-2,13),c2=Q(1.5,0);
    g.beginPath();g.moveTo(a.x,a.y);g.quadraticCurveTo(c1.x,c1.y,b.x,b.y);g.quadraticCurveTo(c2.x,c2.y,a.x,a.y);g.closePath();
    g.fillStyle='#cfd6e6';g.fill();g.strokeStyle=EDGE;g.lineWidth=1.2;g.stroke();
    poly([Q(-1.5,-2.2),Q(-1.5,2.2),Q(2.6,2.2),Q(2.6,-2.2)],'#e5505e');
    bot.anchors.tool=AP(b.x,b.y);
  }else if(tool==='hammer'){
    poly([Q(-3.4,-7),Q(3.4,-7),Q(3.4,8),Q(-3.4,8)],'#6b7396');
    const f1=Q(-3.4,5),f2=Q(3.4,5);g.strokeStyle='#d8dde9';g.lineWidth=2.2;g.beginPath();g.moveTo(f1.x,f1.y);g.lineTo(f2.x,f2.y);g.stroke();
    const e=Q(0,8);bot.anchors.tool=AP(e.x,e.y);
  }
}
function drawItem(g,kind,x,y,sc,t){
  if(!kind||sc<=.01)return;
  g.save();g.translate(x,y);g.scale(sc,sc);g.lineJoin='round';
  switch(kind){
    case'gem':{g.beginPath();g.moveTo(0,-6.5);g.lineTo(5.5,-1.5);g.lineTo(0,6.5);g.lineTo(-5.5,-1.5);g.closePath();g.fillStyle='#7cf1ff';g.fill();
      g.fillStyle='rgba(255,255,255,.55)';g.beginPath();g.moveTo(0,-6.5);g.lineTo(5.5,-1.5);g.lineTo(0,-1.5);g.lineTo(-5.5,-1.5);g.closePath();g.fill();break;}
    case'log':{rr(g,-10,-4.5,20,9,4.5);g.fillStyle='#b8783e';g.fill();g.beginPath();g.ellipse(8,0,3.2,4.5,0,0,TAU);g.fillStyle='#ecc08b';g.fill();break;}
    case'brick':{rr(g,-13,-9,26,18,3.2);g.fillStyle='#ee7b4e';g.fill();g.fillStyle='rgba(255,255,255,.28)';rr(g,-11,-7.4,22,3,1.5);g.fill();break;}
    case'crate':{rr(g,-11,-11,22,21,2.5);g.fillStyle='#cf8f4f';g.fill();g.strokeStyle='rgba(90,50,20,.6)';g.lineWidth=1.6;
      g.beginPath();g.moveTo(-8,-8);g.lineTo(8,7);g.moveTo(-11,-3.5);g.lineTo(11,-3.5);g.moveTo(-11,3);g.lineTo(11,3);g.stroke();break;}
    case'sack':{g.beginPath();g.moveTo(-3,-8);g.quadraticCurveTo(-11,-2,-9,6);g.quadraticCurveTo(0,11,9,6);g.quadraticCurveTo(11,-2,3,-8);g.closePath();
      g.fillStyle='#d8b27a';g.fill();g.fillStyle='#a87b45';rr(g,-4,-10,8,3.4,1.5);g.fill();break;}
    case'coin':{const sp=Math.abs(Math.cos((t||0)/90));g.beginPath();g.ellipse(0,0,Math.max(1,6*sp),6,0,0,TAU);g.fillStyle='#ffd34a';g.fill();break;}
  }
  g.restore();
}

/* ================================================================ animations
   pose(P,t,ms,c): t runs 0..1 through the clip, ms is the time in it, and c
   is {fs: +1 facing right, -1 left, 0 toward or away from us; turn: the
   sign of a turn's yaw change; say: the line being said}. ev are the
   moments a host may want to answer — a hit, a step, a splash — as
   [t, kind]; what each one looks like is the host's business. */
const A={};
const def=o=>{A[o.id]=o;return o;};
def({id:'idle',dur:3400,loop:true,
  pose(P,t,ms){breathe(P,ms);
    const N=[0,.7,.7,0,-.6,-.6,0,.35], NY=[0,0,-.25,0,0,.25,0,-.3], per=1700, i=Math.floor(ms/per), u=(ms%per)/per;
    const a=N[(i+N.length-1)%N.length], b=N[i%N.length], ay=NY[(i+NY.length-1)%NY.length], by=NY[i%NY.length];
    const e=E.o3(seg(u,0,.07)), hz=E.io(seg(u,.04,.32));
    P.lookX=lerp(a,b,e);P.lookY=lerp(ay,by,e);P.headYaw=lerp(a,b,hz)*.3;P.headTilt=lerp(a,b,hz)*.035;}});
function walkPose(P,t,c,o){
  const w=t*TAU, s=Math.sin(w), co=Math.cos(w);
  P.fLz=-o.amp*co;P.fLy=Math.max(0,s)*o.lift;P.fRz=o.amp*co;P.fRy=Math.max(0,-s)*o.lift;
  P.fLp=-.26*co;P.fRp=.26*co; // toe up as a heel lands in front, heel up pushing off behind
  P.bob=o.bob[0]-o.bob[1]*Math.abs(s);P.lean=o.lean;P.roll=o.roll*s*(c.fs?.4:1);
  P.lP=o.arm*co;P.rP=-o.arm*co;P.lE=o.elb+.3*Math.max(0,co);P.rE=o.elb+.3*Math.max(0,-co);
  P.headTilt=.03*s;P.ant=-.3*(c.fs||0);P.bulb='run';P.gp=t;P.moving=true;
}
def({id:'walk',dur:620,loop:true,ev:[[0,'step'],[.5,'step']],
  pose(P,t,ms,c){walkPose(P,t,c,{amp:7,lift:5,bob:[1.1,2.4],lean:.1,roll:.03,arm:.5,elb:.4});}});
def({id:'run',dur:420,loop:true,ev:[[0,'step'],[.5,'step']],
  pose(P,t,ms,c){walkPose(P,t,c,{amp:10,lift:8,bob:[1.6,3.6],lean:.26,roll:.04,arm:.95,elb:1.25});
    P.lift=3*Math.max(0,Math.abs(Math.sin(t*TAU))-.55);P.expr='determined';P.ant=-.55*(c.fs||0);}});
def({id:'turn',dur:560,
  pose(P,t,ms,c){
    P.crouch=K(t,[[0,0],[.15,3,E.o2],[.38,-1],[.6,1.5],[1,0,E.o3]]);
    P.lift=K(t,[[0,0],[.15,0],[.38,4.5,E.o2],[.58,0,E.i2],[1,0]]);
    P.sy=K(t,[[0,1],[.15,.93],[.36,1.06],[.6,.94],[.8,1.02],[1,1]]);P.sx=1+(1-P.sy)*.8;
    P.fLy=K(t,[[0,0],[.2,0],[.35,3],[.5,0]]);P.fRy=K(t,[[0,0],[.35,0],[.5,3],[.65,0]]);
    P.lR=P.rR=.13+.22*Math.sin(PI*t);
    P.lookX=(c.turn||1)*.7*K(t,[[0,0],[.1,1,E.o3],[.55,1],[.9,0]]);}});
def({id:'collect',dur:800,ev:[[.3,'grab'],[.53,'toss']],
  pose(P,t){
    P.crouch=K(t,[[0,0],[.28,9],[.38,9],[.55,-1,E.o3],[.7,0]]);
    P.lean=K(t,[[0,0],[.28,.38],[.4,.3],[.55,-.06,E.o3],[.75,0]]);
    P.rP=K(t,[[0,.06],[.28,1.3],[.38,1.2],[.53,-2.3,E.o3],[.62,-2.05],[.86,.06]]);P.rE=K(t,[[0,.28],[.28,.2],[.4,.5],[.53,.9],[.86,.28]]);
    P.rG=t>.3&&t<.53?1:0;P.lP=K(t,[[0,.06],[.28,.7],[.55,.2],[.86,.06]]);
    P.headNod=K(t,[[0,0],[.25,.35],[.45,0]]);P.lookY=K(t,[[0,0],[.2,.8],[.4,.8],[.52,-.3],[.7,0]]);
    P.expr=t<.5?'focus':'happy';
    if(t>.3&&t<.53){P.carry='gem';P.carryHand='r';}}});
def({id:'chop',dur:950,ev:[[.47,'hit']],
  pose(P,t){
    P.tool='axe';
    P.rP=K(t,[[0,.35],[.36,3.35],[.47,1.15,E.i3],[.6,1.05,E.o2],[1,.35]]);P.rE=K(t,[[0,.7],[.36,.6],[.47,.15,E.i3],[.6,.25],[1,.7]]);
    P.rW=K(t,[[0,-.42],[.36,-2],[.47,-1.57,E.i3],[.6,-1.45],[1,-.42]]);P.rG=1;
    P.lP=K(t,[[0,.1],[.36,.75],[.47,-.45,E.i3],[.6,-.3],[1,.1]]);P.lE=K(t,[[0,.3],[.36,1],[.47,.3],[1,.3]]);
    P.lean=K(t,[[0,0],[.36,-.16],[.47,.2,E.i3],[.6,.17],[1,0]]);P.crouch=K(t,[[0,0],[.36,1.5],[.47,4,E.i3],[.62,3.5],[1,0]]);
    P.sy=K(t,[[0,1],[.36,1.05],[.47,.94,E.i3],[.56,1.01],[.66,.98],[1,1]]);P.sx=1+(1-P.sy)*.9;
    P.fRz=K(t,[[0,0],[.3,3],[.8,3],[1,0]]);P.fLz=K(t,[[0,0],[.3,-2],[.8,-2],[1,0]]);
    P.headNod=K(t,[[0,0],[.36,-.15],[.47,.2],[1,0]]);
    P.expr=t<.25?'neutral':(t>.46&&t<.6)?'grit':t<.75?'focus':'neutral';P.bulb='run';}});
def({id:'mine',dur:950,ev:[[.48,'hit']],
  pose(P,t){
    P.tool='pick';
    P.rP=K(t,[[0,.35],[.38,3.55],[.48,1.4,E.i3],[.62,1.3,E.o2],[1,.35]]);P.rE=K(t,[[0,.7],[.38,.5],[.48,.08,E.i3],[.62,.2],[1,.7]]);
    P.rW=K(t,[[0,-.42],[.38,-2.1],[.48,-1.6,E.i3],[.62,-1.5],[1,-.42]]);P.rG=1;
    P.lP=K(t,[[0,.1],[.38,.8],[.48,-.5,E.i3],[.62,-.3],[1,.1]]);P.lE=K(t,[[0,.3],[.38,1.1],[.48,.3],[1,.3]]);
    P.lean=K(t,[[0,0],[.38,-.2],[.48,.26,E.i3],[.62,.23],[1,0]]);P.crouch=K(t,[[0,0],[.38,1],[.48,6,E.i3],[.64,5],[1,0]]);
    P.sy=K(t,[[0,1],[.38,1.07],[.48,.92,E.i3],[.58,1.02],[.68,.98],[1,1]]);P.sx=1+(1-P.sy)*.9;
    P.fRz=K(t,[[0,0],[.3,3.5],[.8,3.5],[1,0]]);P.fLz=K(t,[[0,0],[.3,-2.5],[.8,-2.5],[1,0]]);
    P.headNod=K(t,[[0,0],[.38,-.2],[.48,.25],[1,0]]);
    P.expr=t<.25?'neutral':(t>.47&&t<.62)?'grit':t<.78?'focus':'neutral';P.bulb='run';}});
def({id:'scoop',dur:1100,ev:[[.33,'splash']],
  pose(P,t){
    P.tool='bucket';
    P.crouch=K(t,[[0,0],[.3,10],[.42,10],[.62,2,E.o3],[1,0]]);P.lean=K(t,[[0,0],[.3,.42],[.42,.4],[.62,.05],[1,0]]);
    P.rP=K(t,[[0,.3],[.3,1.25],[.42,1.2],[.62,.55,E.o3],[.8,.5],[1,.3]]);P.rE=K(t,[[0,.6],[.3,.2],[.42,.25],[.62,1.1],[1,.6]]);P.rG=1;
    P.bucketTilt=K(t,[[0,0],[.25,0],[.32,1.1],[.42,1.1],[.55,-.15,E.o2],[.66,.08],[.75,0]]);P.bucketFill=t>.4?1:0;
    P.lP=K(t,[[0,.06],[.3,.6],[.62,.1]]);P.lookY=K(t,[[0,0],[.2,.7],[.5,.7],[.65,0]]);
    P.expr=t<.3?'neutral':t<.6?'focus':'happy';}});
def({id:'build',dur:1050,ev:[[.25,'tap'],[.52,'hit']],
  pose(P,t){
    P.tool='hammer';
    P.rP=K(t,[[0,.3],[.18,2.3],[.25,.95,E.i3],[.32,.75,E.o2],[.45,2.6],[.52,1.05,E.i3],[.62,.9],[1,.3]]);
    P.rE=K(t,[[0,.7],[.18,.9],[.25,.45],[.45,.9],[.52,.4],[1,.7]]);
    P.rW=K(t,[[0,-.42],[.18,-1.27],[.25,-1.3,E.i3],[.45,-1.27],[.52,-1.35,E.i3],[1,-.42]]);P.rG=1;
    P.crouch=K(t,[[0,0],[.18,2],[.25,5],[.45,3],[.52,7],[.65,5],[1,0]]);P.lean=K(t,[[0,0],[.25,.3],[.45,.15],[.52,.36],[.65,.3],[1,0]]);
    P.lP=K(t,[[0,.06],[.25,.6],[.52,.7],[.8,.06]]);
    P.headNod=K(t,[[0,0],[.25,.2],[.45,.05],[.52,.25],[.7,.1],[.82,-.12],[.92,.05],[1,0]]);
    P.expr=t<.15?'neutral':t<.62?'focus':'happy';}});
def({id:'drop',dur:1000,ev:[[.66,'place']],
  pose(P,t){
    P.rP=K(t,[[0,.06],[.2,-2.6],[.26,-2.6],[.42,.9],[.62,1.35],[.72,1.3],[1,.06]]);P.rE=K(t,[[0,.28],[.2,1.6],[.26,1.6],[.42,1],[.62,.5],[1,.28]]);
    P.lP=K(t,[[0,.06],[.26,.2],[.42,.9],[.62,1.35],[.72,1.3],[1,.06]]);P.lE=K(t,[[0,.28],[.26,.4],[.42,1],[.62,.5],[1,.28]]);
    P.lR=P.rR=K(t,[[0,.13],[.3,-.08],[.7,-.08],[.9,.13]]);
    P.crouch=K(t,[[0,0],[.42,0],[.62,10],[.72,10],[.9,0]]);P.lean=K(t,[[0,0],[.42,.05],[.62,.35],[.72,.33],[.9,0]]);
    if(t>.26&&t<.66){P.carry='crate';P.carryHand='both';P.carryS=K(t,[[.26,.25],[.36,1,E.back]]);P.carryY=-2;}
    P.expr=t<.42?'neutral':t<.7?'focus':'happy';}});
def({id:'lift',dur:1200,ev:[[.25,'grab']],
  pose(P,t,ms){
    P.crouch=K(t,[[0,0],[.25,11],[.5,11],[.72,0,E.o3],[1,0]]);P.lean=K(t,[[0,0],[.25,.4],[.5,.32],[.72,-.06],[1,0]]);
    P.lP=P.rP=K(t,[[0,.06],[.25,1.3],[.5,1.25],[.72,.75,E.o3],[1,.75]]);P.lE=P.rE=K(t,[[0,.28],[.25,.25],[.5,.3],[.72,1.15],[1,1.15]]);
    P.lR=P.rR=K(t,[[0,.13],[.25,-.05],[1,-.05]]);P.lG=P.rG=t>.25?1:0;
    if(t>.3&&t<.5){P.x=.7*Math.sin(ms/28);P.sy=.96;P.sx=1.03;}
    if(t>.24){P.carry='brick';P.carryHand='both';P.carryY=K(t,[[.24,6],[.5,6],[.72,-2]]);}
    P.expr=t<.25?'focus':t<.55?'grit':'happy';}});
def({id:'carry',dur:760,loop:true,ev:[[0,'step'],[.5,'step']],
  pose(P,t,ms,c){walkPose(P,t,c,{amp:6,lift:4,bob:[1.5,3],lean:-.05,roll:.035,arm:0,elb:0});
    P.lP=P.rP=.75;P.lE=P.rE=1.15;P.lR=P.rR=-.05;P.lG=P.rG=1;P.carry='brick';P.carryHand='both';P.carryY=-2+1.2*Math.abs(Math.sin(t*TAU));P.expr='determined';}});
def({id:'sell',dur:1300,ev:[[.25,'coins']],
  pose(P,t){
    P.rP=K(t,[[0,.06],[.2,-2.4],[.28,-2.3],[.36,.06]]);P.rE=K(t,[[0,.28],[.2,1.4],[.36,.28]]);
    P.lift=K(t,[[0,0],[.3,0],[.42,10,E.o2],[.55,0,E.i2],[1,0]]);P.crouch=K(t,[[0,0],[.26,4],[.32,-1],[.55,3],[.65,0]]);
    P.sy=K(t,[[0,1],[.26,.92],[.34,1.08],[.55,.9],[.65,1.02],[.75,1]]);P.sx=1+(1-P.sy)*.8;
    P.lR=K(t,[[0,.13],[.3,.13],[.42,2.4,E.o3],[.72,2.3],[.88,.13]]);P.rR=K(t,[[0,.13],[.32,.13],[.44,2.4,E.o3],[.72,2.3],[.88,.13]]);
    P.lX=P.rX=K(t,[[0,-.06],[.42,.4],[.72,.4],[.88,-.06]]);P.lG=P.rG=t>.4&&t<.8?1:0;
    P.expr=t<.22?'neutral':t<.8?'coin':'happy';P.bulb=t>.3&&t<.85?'party':'idle';}});
def({id:'say',dur:2300,
  pose(P,t,ms){
    const on=t>.08&&t<.62?1:0;P.talk=on;
    P.lP=K(t,[[0,.06],[.1,.9,E.o3],[.62,.85],[.78,.06]])+.08*Math.sin(ms/120)*on;P.lR=K(t,[[0,.13],[.1,.55],[.62,.5],[.78,.13]]);P.lE=K(t,[[0,.28],[.1,1.3],[.62,1.25],[.78,.28]]);
    P.headNod=.07*Math.sin(ms/110)*on;P.headTilt=.06*sm(.05,.15,t)*(1-sm(.7,.9,t));
    P.expr=on?'talk':t>.62?'happy':'neutral';breathe(P,ms,.6);}});
def({id:'wave',dur:1600,
  pose(P,t,ms){
    const on=sm(.08,.2,t)*(1-sm(.82,.97,t));
    P.lift=K(t,[[0,0],[.06,0],[.14,4,E.o2],[.22,0,E.i2],[1,0]]);P.sy=K(t,[[0,1],[.06,.94],[.12,1.05],[.22,.95],[.3,1]]);P.sx=1+(1-P.sy)*.8;
    P.rR=lerp(.13,2.25,on);P.rX=lerp(-.06,.55+.45*Math.sin(ms/105),on);P.rE=lerp(.28,.1,on);
    P.headTilt=.08*on;P.roll=.025*on*Math.sin(ms/210);P.expr='happy';P.bulb='run';breathe(P,ms,.5);}});
def({id:'think',dur:2600,loop:true,
  pose(P,t,ms){
    breathe(P,ms,.7);P.rP=1.4;P.rR=-.3;P.rE=2;P.rX=-.2;P.rG=1;P.lP=.55;P.lR=-.25;P.lE=1.5;P.lX=-.4;
    P.headTilt=.1+.02*Math.sin(ms/700);P.lookX=.45;P.lookY=-.65;P.roll=.012*Math.sin(ms/1300);
    P.expr='think';P.bulb='think';}});
def({id:'wait',dur:1800,loop:true,
  pose(P,t,ms){
    breathe(P,ms,.6);P.fRp=.55*Math.max(0,Math.sin(t*TAU*3));P.fRz=2;
    P.lP=P.rP=-.5;P.lE=P.rE=.95;P.lR=P.rR=.05;
    P.prog=t;P.lookX=.5*Math.sin(t*TAU);P.headYaw=.12*Math.sin(t*TAU-.5);
    P.expr='wait';P.bulb='idle';P.glow=.3+.3*Math.sin(t*TAU*2);}});
def({id:'celebrate',dur:2000,ev:[[.2,'burst'],[.66,'land']],
  pose(P,t){
    P.crouch=K(t,[[0,0],[.12,10],[.2,-3,E.o3],[.62,-2],[.74,9,E.o2],[.84,0,E.o3],[1,0]]);
    P.lift=K(t,[[0,0],[.18,0],[.42,42,E.o2],[.66,0,E.i2],[1,0]]);
    P.sy=K(t,[[0,1],[.12,.88],[.2,1.18,E.o3],[.42,1.04],[.62,1.08],[.67,.8,E.o3],[.78,1.06],[.88,.98],[1,1]]);P.sx=1+(1-P.sy)*.9;
    P.yawAdd=K(t,[[0,0],[.2,0],[.6,TAU],[1,TAU]]);
    P.lR=P.rR=K(t,[[0,.13],[.12,-.05],[.24,2.5,E.o3],[.9,2.35],[1,.13]]);P.lX=P.rX=K(t,[[0,-.06],[.24,.35],[.9,.35],[1,-.06]]);
    P.lP=P.rP=K(t,[[0,.06],[.12,-.6],[.24,.06]]);P.lG=P.rG=t>.2&&t<.92?1:0;
    P.fLy=P.fRy=K(t,[[.2,0],[.3,6],[.55,6],[.64,0]]);
    P.expr=t<.2?'determined':t<.88?'love':'happy';P.bulb='party';P.glow=1;}});
def({id:'tired',dur:3000,loop:true,
  pose(P,t,ms,c){
    breathe(P,ms,1.5,3000);P.energy=.08;P.lean=.15;P.crouch=2.5;P.headNod=.28+.04*Math.sin(ms/1500*PI);
    P.lP=P.rP=.02;P.lR=P.rR=.04;P.lE=P.rE=.1;P.ant=.75*(c.fs||1);
    const y=sm(.55,.62,t)*(1-sm(.8,.86,t));P.talk=y;P.headTilt=-.15*y;P.headNod-=.3*y;P.lR=P.rR=.04+.5*y;
    P.expr=y>.2?'yawn':'tired';P.bulb='sleep';}});
def({id:'rest',dur:3600,loop:true,ev:[[.1,'z'],[.45,'z'],[.8,'z']],
  pose(P,t,ms,c){
    breathe(P,ms,1.6,3600);P.crouch=15;P.fLz=P.fRz=19;P.lP=P.rP=.25;P.lR=P.rR=.4;P.lE=P.rE=.1;
    P.headNod=.3;P.headTilt=.08+.03*Math.sin(ms/1800*PI);P.lean=-.06;P.ant=.55*(c.fs||1);
    P.expr='sleep';P.screen=.85;P.bulb='sleep';P.charge=true;}});

/* one pose, by name. Loops read ms; a one-shot reads t */
function pose(id,t,ms,c,into){
  const a=A[id]||A.idle, P=into||P0();
  a.pose(P,a.loop?((ms%a.dur)+a.dur)%a.dur/a.dur:clamp(t,0,1),ms||0,c||{fs:0});
  return P;
}
/* the moments of a clip crossed between two of its times */
function events(id,t0,t1){
  const a=A[id];if(!a||!a.ev||t1<=t0)return [];
  const out=[];
  for(const [tn,kind] of a.ev)if(t0<tn&&t1>=tn)out.push(kind);
  return out;
}

/* ---------------------------------------------------------------- the still robot
   A board or a preview is drawn from scratch every frame, and has to come
   out the same every time for the same inputs, so it gets a robot with no
   springs, no random blink and no memory. */
const still=new Bot('#ffb830',2);
function drawStill(g,X,Y,s,yaw,color,P,o){
  o=o||{};
  still.color=color;still.lock=true;still.yaw=still.hyaw=yaw;still.hlag=0;
  const r=still.restOf(P);still.ant={x:r.x,y:r.y};still.bv=0;still.swapK=1;still.expr=P.expr||'neutral';still.exprNext=null;
  still.anchors={};
  still.draw(g,P,X,Y,s,o);
  return still.anchors;
}
/* the three poses a preview can strike, sampled from the same clips the
   world robot plays */
function boardPose(kind,t){
  if(kind==='work')return pose('chop',((t/A.chop.dur)%1+1)%1,t,{fs:1});
  if(kind==='walk')return pose('walk',0,t,{fs:1});
  return pose('idle',0,t,{fs:0});
}

const bots=new WeakMap();
window.CC_RIG={
  Bot, P0, mix:mixPose, anim:A, pose, events, drawItem, drawStill, boardPose, EXP, DIRYAW,
  /* one Bot per game robot, held beside it rather than on it, so it never
     reaches a save */
  botFor(r){let b=bots.get(r);if(!b){b=new Bot(r.color||'#ffb830',r.dir==null?2:r.dir);bots.set(r,b);}return b;}
};
})();
