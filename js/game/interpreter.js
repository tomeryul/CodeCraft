"use strict";
/* ---------------- world helpers ---------------- */
const inB=(x,y)=>x>=0&&y>=0&&x<W&&y<H;
function solidObj(o){
  if(!o)return false;
  // What you BUILD is really there. Decor used to be uniformly walk-through so it
  // could never break pathing, which meant a wall you spent stone on was scenery
  // and robots strolled through your house. Structure and bulky props block now;
  // ground you stand on (path/floor/rug), doorways and flat trinkets do not.
  if(o.type==="decor")return !!(DECOR_BY[o.deco]&&DECOR_BY[o.deco].solid);
  return o.type==="rock"||o.type==="iron"||o.type==="crystal"||o.type==="home"||o.type==="market"||o.type==="chest"||o.type==="gift"||o.type==="proj"||(o.type==="tree"&&o.stage>=1);
}
function canWalk(x,y){
  if(!inB(x,y))return false;
  const o=objects.get(key(x,y));
  if(terrain[key(x,y)]===T_WATER)return o&&o.type==="bridge";
  return !solidObj(o);
}
function ahead(r){return {x:r.x+DX[r.dir],y:r.y+DY[r.dir]};}
/* ---------------- 🤝 teamwork ----------------
   A claim is a short reservation on one tile. Its whole purpose is that
   findNearest SKIPS tiles another robot has called, so the same fleet gets faster
   the moment the program says "call it before you walk". Claims expire on their
   own, so a robot that dies, idles or is reprogrammed never wedges a tile. */
function robotIndex(r){return robots.indexOf(r);}
function claimAt(k){
  const c=claims.get(k);
  if(!c)return null;
  if(now>=c.until){claims.delete(k);return null;}
  return c;
}
function claimedByOther(r,k){const c=claimAt(k);return !!(c&&c.by!==robotIndex(r));}
function setClaim(r,k){claims.set(k,{by:robotIndex(r),until:now+CLAIM_MS});}
function radioPost(ch,x,y,by,n){radio[ch]={x,y,by,n:n|0,at:now};}
function radioGet(ch){
  const m=radio[ch];
  if(!m)return null;
  if(now-m.at>RADIO_MS){delete radio[ch];return null;}
  return m;
}
// The right-hand side of a comparison is a VALUE, so `if x > y` is expressible and
// not just `if x > 3`. Old saves store a bare number there — still honoured.
function condRhs(r,c){return (c.val&&typeof c.val==="object")?Number(resolveVal(r,c.val))||0:(Number(c.val)||0);}
function evalCond(r,c){
  if(c&&typeof c==="object"){
    const v=Number(r.vars[c.var])||0, w=condRhs(r,c);
    if(c.op===">")return v>w;
    if(c.op==="<")return v<w;
    if(c.op==="!=")return v!==w;
    return v===w;   // no op / "=" — the shape every save before ≠ existed used
  }
  /* "!blocked" is "blocked", answered the other way round */
  if(condNeg(c))return !evalCond(r,condBase(c));
  const a=ahead(r), o=inB(a.x,a.y)?objects.get(key(a.x,a.y)):null;
  switch(c){
    case "taken":return inB(a.x,a.y)&&claimedByOther(r,key(a.x,a.y));
    case "treeAhead":return !!(o&&o.type==="tree"&&o.stage===2);
    case "rockAhead":return !!(o&&o.type==="rock");
    case "ironAhead":return !!(o&&o.type==="iron");
    case "waterAhead":return inB(a.x,a.y)&&terrain[key(a.x,a.y)]===T_WATER&&!(o&&o.type==="bridge");
    case "blocked":return !canWalk(a.x,a.y);
    case "bagFull":return bagCount(r)>=r.cap;
    case "bagEmpty":return bagCount(r)===0;
    case "tired":return (r.energy==null?100:r.energy)<10;
  } return false;
}

/* ---------------- interpreter ---------------- */
function startRobot(r){
  if(mgState){mgRun();return;}
  if(!r.program.length){toast("🧩 "+r.name+" has no program yet! Open the Code editor.");return;}
  r.frames=[{blocks:r.program,i:0,reps:1}];r.running=true;r.wait=0;r.path=null;r.blocked=false;
  sfx(520,.06);updateChips();updateFab();
  if(!tut.done&&tut.step>0)tutFinish();
  if(hasLoop(r.program))qProg("loop");
  if(robots.filter(x=>x.running).length>=2)qProg("duo");
}
function stopRobot(r){r.running=false;r.frames=null;r.curUid=null;r.path=null;updateChips();updateFab();}
function tickRobot(r){
  if(!r.running)return;
  if(r.wait>0){r.wait--;return;}
  if(r.path&&r.path.length){
    const s=r.path.shift();
    faceTo(r,s.x,s.y);
    if(canWalk(s.x,s.y)){
      r.x=s.x;r.y=s.y;
      // A path step IS a step. The world used to count distance only for ⬆️ Move,
      // so once 🚶 Walk To became the way you travel, "Walk 150 steps" could never
      // finish and the distance stat froze.
      totals.dist=(totals.dist||0)+1;qProg("walk");skillXP("agility",1);
      if(Math.random()<.25)burst(r.x,r.y,"dust");
    }else{r.path=null;r.blocked=true;}
    // On arrival, turn to FACE what we walked here for. Without this the robot
    // ends up facing the way it last stepped, so the 🪓 Chop right after a
    // 🧭 Go To Nearest would swing at empty grass — the single most confusing
    // thing about walking somewhere on purpose.
    if(r.path&&!r.path.length&&r.faceAfter){faceTo(r,r.faceAfter.x,r.faceAfter.y);r.faceAfter=null;r.path=null;}
    return;
  }
  let guard=0;
  while(guard++<80){
    const fr=r.frames&&r.frames[r.frames.length-1];
    if(!fr){stopRobot(r);return;}
    if(fr.i>=fr.blocks.length){
      // a 🔄 While frame re-checks its condition here and falls out when it's false
      if(fr.wc!==undefined&&!evalCond(r,fr.wc)){r.frames.pop();const pw=r.frames[r.frames.length-1];if(pw){pw.i++;continue;}stopRobot(r);return;}
      if(fr.reps===Infinity){fr.i=0;if(!fr.blocks.length)return;continue;}
      if(fr.reps>1){
        fr.reps--;fr.i=0;
        if(fr.cv!==undefined){fr.cur++;r.vars[fr.cv]=fr.cur;}
        continue;
      }
      r.frames.pop();
      // falling off the end of a function returns 0 and restores the caller's scope
      if(fr.fn)fnExit(r,fr,[]);
      const p=r.frames[r.frames.length-1];
      if(p){p.i++;continue;}
      stopRobot(r);return;
    }
    const b=fr.blocks[fr.i];
    if(b.t==="repeat"){
      const times=b.src?Math.floor(Number(r.vars[b.src])||0):Math.max(1,b.n|0);
      if(!b.body.length||times<1){fr.i++;continue;}
      r.frames.push({blocks:b.body,i:0,reps:times});continue;}
    if(b.t==="countLoop"){
      if(!b.body.length||(b.to|0)<1){fr.i++;continue;}
      r.vars[b.name]=1;
      r.frames.push({blocks:b.body,i:0,reps:Math.max(1,b.to|0),cv:b.name,cur:1});continue;}
    if(b.t==="forever"){ r.curUid=b.uid; if(!b.body.length)return; r.frames.push({blocks:b.body,i:0,reps:Infinity});continue;}
    if(b.t==="whileLoop"){
      if(!b.body.length||!evalCond(r,b.cond)){fr.i++;continue;}
      r.curUid=b.uid;r.frames.push({blocks:b.body,i:0,reps:Infinity,wc:b.cond});continue;}
    if(b.t==="call"){
      const f=routineOf(r,b.fn);
      if(!f.body.length){fr.i++;continue;}
      if(r.frames.length>30){ // recursion with no base case
        stopRobot(r);toast("🔁 "+r.name+": function "+b.fn+" called itself too many times!");return;}
      const saved=fnEnter(r,f,b);
      r.curUid=b.uid;
      r.frames.push({blocks:f.body,i:0,reps:1,fn:1,outs:callOuts(b),saved});continue;}
    if(b.t==="ret"){
      // hand a value back: unwind to and including the nearest function frame
      const vals=retVals(b).map(v=>resolveVal(r,v));
      let done=false;
      while(r.frames.length){
        const f2=r.frames.pop();
        if(f2.fn){fnExit(r,f2,vals);done=true;break;}
      }
      const pr=r.frames[r.frames.length-1];
      if(pr&&done){pr.i++;continue;}
      stopRobot(r);return;}
    if(b.t==="if"){
      const br=evalCond(r,b.cond)?b.body:(b.els||[]);
      if(br.length){r.curUid=b.uid;r.frames.push({blocks:br,i:0,reps:1});}
      else fr.i++;
      continue;}
    r.curUid=b.uid; doAction(r,b); fr.i++; return;
  }
}
function faceTo(r,x,y){
  if(x>r.x)r.dir=1;else if(x<r.x)r.dir=3;else if(y>r.y)r.dir=2;else if(y<r.y)r.dir=0;
}
/* actions that get a draw-time animation (see robot drawing in render.js) */
const ANIM_ACTS={move:1,turnL:1,turnR:1,collect:1,chop:1,mine:1,scoop:1,drop:1,build:1,rest:1,wait:1};
/* Where a 🚶 Walk To / 🧭 Face Nearest is aimed. A fixed pick is `opt`; a
   VARIABLE target is `src`, exactly the shape 🔁 Repeat already uses for its
   count. That is what closes the loop on the 📋 board: 📖 Read hands you what
   the order wants, and this block goes there — without it a child has to read
   the order themselves and hard-code the answer. */
function aimOf(r,b){
  if(!b.src)return b.opt||"tree";
  const v=String(r.vars[b.src]==null?"":r.vars[b.src]);
  return TARGETS.indexOf(v)>=0?v:null;      // nothing named that → blocked
}
function doAction(r,b){
  const a=ahead(r), k=inB(a.x,a.y)?key(a.x,a.y):-1, o=k>=0?objects.get(k):null;
  r.blocked=false;
  // animation hook: render.js reads r.anim to play a short per-action "tell"
  if(ANIM_ACTS[b.t])r.anim={type:b.t,t0:(typeof performance!=="undefined"?performance.now():Date.now())};
  switch(b.t){
    case "move":
      if(canWalk(a.x,a.y)){
        r.x=a.x;r.y=a.y;
        totals.dist=(totals.dist||0)+1;qProg("walk");skillXP("agility",1);
        if(Math.random()<.4)burst(r.x,r.y,"dust");
      }
      else{r.blocked=true;sfxIf(r,150,.05);}
      break;
    case "turnL": r.dir=(r.dir+3)%4; break;
    case "turnR": r.dir=(r.dir+1)%4; break;
    case "wait": r.wait=Math.max(0,(b.n|0)-1); break;
    case "rest":
      r.energy=Math.min(MAX_ENERGY,(r.energy||0)+30*Math.max(1,b.n|0));
      r.wait=Math.max(0,(b.n|0)-1);r.tired=false;r.pop=1;
      if(sfxIf)sfxIf(r,420,.05);
      break;
    case "collect":{
      // generic gather: dropped items, treasure, chop trees, mine rocks/ore, scoop water
      if(o&&o.type==="gift"){
        objects.delete(k);
        const c2=30+Math.floor(Math.random()*40);
        coins+=c2;addXP(20);addPop(a.x,a.y,"🎁 +"+c2+" 🪙");burst(a.x,a.y,"coin");
        coinFlash();qProg("gift");r.pop=1;sfxIf(r,880,.1);updateHud();break;
      }
      if(o&&o.type==="item"){
        if(bagCount(r)>=r.cap){r.blocked=true;mentorFlag("bagFull");break;}
        const space=r.cap-bagCount(r), take=Math.min(space,o.n);
        r.inv[o.item]+=take;o.n-=take;if(o.n<=0)objects.delete(k);
        totals.collected+=take;r.pop=1;addPop(a.x,a.y,"+"+take+" "+RES[o.item].em);
        addXP(take);qProg("collect",o.item);sfxIf(r,660,.06);break;
      }
      if(o&&NODE_YIELD[o.type]&&!(o.type==="tree"&&o.stage<2)){hitNode(r,a,k,o);break;}
      if(inB(a.x,a.y)&&terrain[k]===T_WATER&&!(o&&o.type==="bridge")){scoopWater(r,a,k);break;}
      r.blocked=true;break;}
    case "chop":{
      if(o&&o.type==="tree"&&o.stage===2)hitNode(r,a,k,o);
      else{r.blocked=true;sfxIf(r,150,.05);}
      break;}
    case "mine":{
      if(o&&(o.type==="rock"||o.type==="iron"||o.type==="crystal"))hitNode(r,a,k,o);
      else{r.blocked=true;sfxIf(r,150,.05);}
      break;}
    case "scoop": scoopWater(r,a,k); break;
    case "drop":{
      if(o&&o.type==="chest"){ for(const res in r.inv){stash[res]=(stash[res]||0)+r.inv[res];r.inv[res]=0;} r.pop=1;addPop(r.x,r.y,"🏦");sfxIf(r,500,.06);updateHud(); break;}
      if(o&&o.type==="market"){ sellInv(r); break;}
      const order=Object.keys(r.inv).sort((p,q)=>r.inv[q]-r.inv[p]);
      const it=order.find(x=>r.inv[x]>0);
      if(!it){r.blocked=true;break;}
      if(!inB(a.x,a.y)||terrain[k]===T_WATER){r.blocked=true;break;}
      if(!o){objects.set(k,{type:"item",item:it,n:1});r.inv[it]--;}
      else if(o.type==="item"&&o.item===it){o.n++;r.inv[it]--;}
      else r.blocked=true;
      break;}
    case "build":{
      if(!inB(a.x,a.y)||o){r.blocked=true;break;}
      const bcost=Math.max(1,Math.round(4*(1-skills.agility.lvl*0.03)));
      if((r.energy||0)<bcost){r.blocked=true;r.tired=true;mentorFlag("tired");break;}
      // materials come from the robot's bag first, then the 🏦 Bank
      const need=b.opt==="sapling"?["wood",1]:b.opt==="bridge"?["stone",2]:["wood",5];
      const okTerrain=b.opt==="sapling"?terrain[k]===T_GRASS:b.opt==="bridge"?terrain[k]===T_WATER:terrain[k]!==T_WATER;
      let fromBank=0;
      if(!okTerrain||!haveMat(r,need[0],need[1])){r.blocked=true;break;}
      fromBank=drawMat(r,need[0],need[1]);
      if(b.opt==="sapling")objects.set(k,{type:"tree",stage:0,growAt:now+20000});
      else if(b.opt==="bridge")objects.set(k,{type:"bridge"});
      else objects.set(k,{type:"chest"});
      if(!r.blocked){
        r.energy-=bcost;r.tired=false;
        if(fromBank>0)addPop(a.x,a.y,"🏦 from bank");
        sfxIf(r,420,.07);r.pop=1;addXP(5);qProg("build",b.opt);skillXP("build",5);
        burst(a.x,a.y,b.opt==="sapling"?"leaf":"stone");
        if(Math.random()<skills.build.lvl*.05){
          // building skill perk: materials refunded
          if(b.opt==="sapling")r.inv.wood+=1;
          else if(b.opt==="bridge")r.inv.stone+=2;
          else r.inv.wood+=5;
          addPop(a.x,a.y,"✨ free build!");
        }
      }
      break;}
    case "faceNearest":{
      const fa=aimOf(r,b);
      const t=fa&&findNearest(r,fa);
      if(t)faceTo(r,t.x,t.y);else r.blocked=true;
      break;}
    /* --- 🤝 teamwork --- */
    case "claim":{
      // call the tile ahead so the rest of the fleet's Face Nearest skips it
      if(k<0){r.blocked=true;break;}
      if(claimedByOther(r,k)){r.blocked=true;sfxIf(r,180,.05);break;}
      setClaim(r,k);r.pop=1;sfxIf(r,700,.04);
      break;}
    case "broadcast":{
      // pin the spot ahead to a channel, together with how full my bag is, so a
      // scout can tell the haulers where the good stuff is
      if(k<0){r.blocked=true;break;}
      radioPost(b.opt||"tree",a.x,a.y,robotIndex(r),bagCount(r));
      r.pop=1;addPop(r.x,r.y,"📡 "+(RADIO_EM[b.opt]||"")); sfxIf(r,880,.05);
      break;}
    case "give":{
      // Pass everything to a robot standing next to me — the one I'm facing first,
      // otherwise any neighbour. It used to be the faced tile only, which meant a
      // hand-off needed ↩️/↪️ to line up; with step-by-step walking gone from the
      // world there is no way to aim, so proximity is the whole requirement.
      let mate=robots.find(x=>x!==r&&x.x===a.x&&x.y===a.y);
      if(!mate)mate=robots.find(x=>x!==r&&Math.abs(x.x-r.x)+Math.abs(x.y-r.y)===1);
      if(!mate){r.blocked=true;sfxIf(r,180,.05);break;}
      let moved=0;
      for(const res in r.inv){
        const space=Math.max(0,mate.cap-bagCount(mate));
        if(space<=0)break;
        const take=Math.min(space,r.inv[res]);
        if(take<=0)continue;
        mate.inv[res]+=take;r.inv[res]-=take;moved+=take;
      }
      if(!moved){r.blocked=true;sfxIf(r,180,.05);break;}
      r.pop=1;mate.pop=1;
      addPop(mate.x,mate.y,"📦 +"+moved);
      burst(mate.x,mate.y,"sparkle");
      sfxIf(r,720,.05);updateHud();
      break;}
    case "goTo":{
      // walk to whatever the team last pinned on this channel. Nothing pinned (or
      // it went stale) reads as `blocked 🚧`, so a program can fall back to its
      // own search instead of standing there.
      const m=radioGet(b.opt||"tree");
      if(!m){r.blocked=true;break;}
      if(Math.abs(r.x-m.x)+Math.abs(r.y-m.y)<=1){faceTo(r,m.x,m.y);break;}
      const p=pathTo(r,m.x,m.y);
      if(p){r.path=p;r.faceAfter={x:m.x,y:m.y};}else r.blocked=true;
      break;}
    case "goHome":{
      const p=pathTo(r,homePos.x,homePos.y);
      if(p){r.path=p;r.faceAfter={x:homePos.x,y:homePos.y};}else r.blocked=true;
      break;}
    // 🧭 Go To Nearest — actually WALK to the nearest tree/rock/ore/crystal.
    // Until now the only pathfinding in the world was Go Home, so a robot could
    // aim at a target with Face Nearest but only ever travel in a straight line:
    // anything off-axis or behind an obstacle was simply unreachable, and no
    // interesting navigation program was expressible. This is that gap closed.
    case "goNear":{
      // Walking somewhere CALLS it on the way. Making that automatic matters: a
      // 🤝 Call It block costs a whole tick, so on a resource-rich map paying it
      // every cycle made the coordinated program ~10% SLOWER than the naive one —
      // the new feature would have been a trap. Claiming what you are already
      // walking to is free, so a fleet fans out by default and 🤝 stays for the
      // deliberate case: holding a spot you are not walking to yet.
      const aim=aimOf(r,b);
      if(!aim){r.blocked=true;break;}
      const cands=findNearestList(r,aim,6);
      let done=false;
      for(const c of cands){
        const ck=key(c.x,c.y);
        if(Math.abs(r.x-c.x)+Math.abs(r.y-c.y)===1){faceTo(r,c.x,c.y);r.path=null;r.faceAfter=null;setClaim(r,ck);done=true;break;}
        const p=pathTo(r,c.x,c.y);
        if(p&&p.length){r.path=p;r.faceAfter={x:c.x,y:c.y};setClaim(r,ck);done=true;break;}
        if(p){faceTo(r,c.x,c.y);setClaim(r,ck);done=true;break;} // already adjacent by another route
      }
      if(!done)r.blocked=true;   // nothing of that kind, or every one walled off
      break;}
    case "sellAll":{
      if(Math.abs(r.x-marketPos.x)<=2&&Math.abs(r.y-marketPos.y)<=2)sellInv(r);
      else{r.blocked=true;mentorFlag("farFromMarket");}
      break;}
    case "bankAll":{
      let moved=0;
      for(const res in r.inv){stash[res]=(stash[res]||0)+r.inv[res];moved+=r.inv[res];r.inv[res]=0;}
      if(moved>0){r.pop=1;addPop(r.x,r.y,"🏦 +"+moved);sfxIf(r,520,.06);updateHud();}
      else r.blocked=true;
      break;}
    case "setVar": r.vars[b.name]=resolveVal(r,b.val); break;
    case "changeVar": r.vars[b.name]=(Number(r.vars[b.name])||0)+changeBy(r,b); break;
    // 📖 Read in the open world: no numbered blocks out here, so "here"/"ahead"
    // report how full the bag is and the robot's own position is exact.
    case "read":
      // 💰 price is the whole point of the living market: "what is worth
      // gathering right now" becomes a decision the PROGRAM makes, and it
      // changes on its own, so a program written once stops being optimal.
      r.vars[b.name]=b.src==="price"?(typeof priceOf==="function"?priceOf(b.opt||"wood"):RES[(b.opt||"wood")].price)
        // the 📋 board, as two numbers a program can branch on
        :b.src==="order"?(typeof orderWant==="function"?orderWant():"")
        :b.src==="orderLeft"?(typeof orderLeft==="function"?orderLeft():0)
        :b.src==="x"?r.x:b.src==="y"?r.y:bagCount(r);
      break;
    case "say":
      r.say={txt:String(resolveVal(r,b.val)).slice(0,24),until:now+2600};
      qProg("say");
      break;
  }
}
function sellInv(r){
  let sum=0;
  // live market price, not the static base — and what you sell counts toward the
  // 📋 order on the board
  for(const res in r.inv){
    const n=r.inv[res];if(!n)continue;
    sum+=n*(typeof priceOf==="function"?priceOf(res):RES[res].price);
    r.inv[res]=0;
    if(typeof orderCredit==="function")orderCredit(res,n);
  }
  sum=Math.round(sum*(1+skills.trade.lvl*.02)); // trading skill perk
  if(sum>0){
    skillXP("trade",Math.ceil(sum/4));
    coins+=sum;totals.earned+=sum;addPop(r.x,r.y,"+"+sum+" 🪙");burst(r.x,r.y,"coin");r.pop=1;
    if(typeof noteEarning==="function")noteEarning(sum);
    queueSaleToast(sum);coinFlash();addXP(Math.ceil(sum/2));qProg("earn",null,sum);
    sfx(880,.09);sfx(1100,.09,.1);checkUnlocks();updateHud();
  }
}
let saleAcc=0,saleT=null;
function queueSaleToast(n){
  saleAcc+=n;clearTimeout(saleT);
  saleT=setTimeout(()=>{toast("💰 Sold goods for "+saleAcc+" 🪙");saleAcc=0;},1200);
}
function coinFlash(){
  const c=$("coinChip");
  c.classList.remove("flash");void c.offsetWidth;c.classList.add("flash");
}
const pops=[];
function addPop(x,y,txt){pops.push({x,y,txt,t0:performance.now()});if(pops.length>40)pops.shift();}
/* world-space particles */
const parts=[];
const BURSTS={
  leaf:{n:8,c:["#4f9e33","#6fbf4a","#8fdc63"],s:4,sp:70,g:90},
  stone:{n:7,c:["#9a9aa6","#7d7d88","#b8b8c2"],s:3.5,sp:80,g:120},
  coin:{n:10,c:["#ffd66b","#ffb830","#ffe9a8"],s:3.5,sp:90,g:70},
  sparkle:{n:12,c:["#b184ff","#e0ccff","#ffffff"],s:3,sp:55,g:0},
  dust:{n:3,c:["#e8e2d0","#d8d2c0"],s:3,sp:22,g:-14},
};
function burst(x,y,kind){
  const d=BURSTS[kind];if(!d)return;
  for(let i=0;i<d.n;i++){
    const a=Math.random()*6.283, sp=d.sp*(.4+Math.random()*.8);
    parts.push({x:(x+.5)*TILE,y:(y+.5)*TILE,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-40,
      life:.5+Math.random()*.4,t:0,c:d.c[i%d.c.length],s:d.s*(.7+Math.random()*.6),g:d.g});
  }
  if(parts.length>280)parts.splice(0,parts.length-280);
}
/* screen-space confetti */
const fx=[];
function confetti(){
  for(let i=0;i<70;i++)
    fx.push({x:VW/2+(Math.random()-.5)*140,y:VH*.22,
      vx:(Math.random()-.5)*380,vy:-220-Math.random()*260,
      rot:Math.random()*6.3,vr:(Math.random()-.5)*14,
      c:["#ffb830","#5ab8ff","#ff5d73","#54d66a","#b184ff","#fff"][i%6],
      t:0,life:1.3+Math.random()*.5});
  if(fx.length>240)fx.splice(0,fx.length-240);
}
// Nearest FREE one. Skipping tiles another robot has called is what turns 🤝 from
// decoration into the thing that makes a fleet fan out — without it, every robot
// running the same program walks to the same tree and takes turns waiting.
// The fallback matters: if everything in range is called, take the nearest anyway
// rather than standing still, so a naive program never deadlocks on a busy map.
function findNearest(r,what){
  let best=null,bd=1e9,anyBest=null,anyBd=1e9;
  const R2=14;
  for(let dy=-R2;dy<=R2;dy++)for(let dx=-R2;dx<=R2;dx++){
    const x=r.x+dx,y=r.y+dy;if(!inB(x,y))continue;
    const k=key(x,y);
    const o=objects.get(k);if(!o)continue;
    let ok=false;
    if(what==="tree")ok=o.type==="tree"&&o.stage===2;
    else ok=o.type===what;
    if(!ok)continue;
    const d=Math.abs(dx)+Math.abs(dy);
    if(d<=0)continue;
    if(d<anyBd){anyBd=d;anyBest={x,y};}
    if(claimedByOther(r,k))continue;
    if(d<bd){bd=d;best={x,y};}
  }
  return best||anyBest;
}
// Every candidate in range, nearest first, with the ones nobody has called ranked
// ahead of the ones somebody has. 🧭 Go To Nearest walks this list until one of
// them is actually REACHABLE, so a tree behind a wall you built (or on the far
// side of the lake) makes the robot pick the next one instead of giving up.
function findNearestList(r,what,max){
  const out=[];
  const R2=14;
  // 💧 water is terrain, not an object; 🏪 market and 🏠 home are fixed places.
  // Everything else is an object on a tile.
  for(let dy=-R2;dy<=R2;dy++)for(let dx=-R2;dx<=R2;dx++){
    const x=r.x+dx,y=r.y+dy;if(!inB(x,y))continue;
    const k=key(x,y);
    let ok;
    if(what==="water")ok=terrain[k]===T_WATER&&!(objects.get(k)||{type:0}).type;
    else{
      const o=objects.get(k);
      if(!o)continue;
      ok=(what==="tree")?(o.type==="tree"&&o.stage===2):(o.type===what);
    }
    if(!ok)continue;
    const d=Math.abs(dx)+Math.abs(dy);
    if(d<=0)continue;
    out.push({x,y,d,taken:claimedByOther(r,k)?1:0});
  }
  // the market and home are single known spots — reachable from anywhere, not
  // just inside the 14-tile scan window
  if(what==="market"&&!out.length&&marketPos)out.push({x:marketPos.x,y:marketPos.y,d:0,taken:0});
  if(what==="home"&&!out.length&&homePos)out.push({x:homePos.x,y:homePos.y,d:0,taken:0});
  out.sort((a,b)=>a.taken-b.taken||a.d-b.d);
  return out.slice(0,max||6);
}
function pathTo(r,tx,ty){
  // BFS to any tile adjacent to (tx,ty)
  const seen=new Uint8Array(W*H), prev=new Int32Array(W*H).fill(-1);
  const q=[key(r.x,r.y)];seen[q[0]]=1;
  let found=-1,n=0;
  while(q.length&&n++<6000){
    const c=q.shift(), cx=c%W, cy=(c/W)|0;
    if(Math.abs(cx-tx)+Math.abs(cy-ty)===1){found=c;break;}
    for(let d=0;d<4;d++){
      const nx=cx+DX[d],ny=cy+DY[d];
      if(!inB(nx,ny))continue;
      const nk=key(nx,ny);
      if(seen[nk]||!canWalk(nx,ny))continue;
      seen[nk]=1;prev[nk]=c;q.push(nk);
    }
  }
  if(found<0)return null;
  const path=[];let c=found;
  while(c!==key(r.x,r.y)&&c>=0){path.unshift({x:c%W,y:(c/W)|0});c=prev[c];}
  return path;
}
