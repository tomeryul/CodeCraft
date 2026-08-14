/* =====================================================================
   Tower Mode level editor — 3D design mode inside the existing creator
   ---------------------------------------------------------------------
   Nothing here is a fork of the 2D creator: it wraps it. 🧊 3D flips
   mgState.proj into a Tower level (plan / terrain / holes instead of
   cells / tiles / initial) and takes over five things — the tool strip,
   the canvas, save, publish and the level checker — leaving every other
   creator affordance (name, difficulty, budget, size, ▶ prove-it, the
   palette) working exactly as it already does.

   Loaded AFTER tower3d.js, so the mgDraw/mgSeed/mgCheck this file wraps
   are already the 3D-aware ones.
   ===================================================================== */
(function(){
if(typeof window==="undefined"||typeof mgState==="undefined")return;
if(window.__t3ed)return;
/* Tower Mode is the engine this edits. Without tower3d.js there is no
   t3Enter to play a level, no renderer behind the 🧊 view and no TOWER_LEVELS
   band to hang the cards on — so install nothing rather than half of it. */
if(typeof window.t3Enter!=="function"){
  console.warn("tower-editor.js: js/game/tower3d.js is not loaded — 3D design mode disabled.");
  return;
}
window.__t3ed=1;

const MAXH=5, MAXG=4;                       // brick peak / terrain peak
const K=(x,y)=>x+"_"+y;
const D4=[[0,-1],[1,0],[0,1],[-1,0]];
const GRASS=["#79c34e","#71ba47","#7fc957"], PLAN="#ffb347", STONE="#a89b86";

/* the palette a Tower level can hand the player. Order here IS the order
   in the block palette, so toggling a chip never shuffles it. */
const ACTS=["move","turnL","turnR","build","climb","descend","jump","dig"];
const CTRL=["repeat","countLoop","whileLoop","forever","if","call"];
const ALL=ACTS.concat(CTRL);
const LOCKED={move:1,turnL:1,turnR:1,build:1};   // a level without these is unplayable
const DEF_ALLOWED=["move","turnL","turnR","build","climb","repeat"];

const TOOLS=[
  {id:"plan",   em:"🧱", lbl:"Blueprint — tap to add a level, hold to clear"},
  {id:"ground", em:"⛰️", lbl:"Ground — raise the terrain the robot starts on"},
  {id:"pit",    em:"🕳️", lbl:"Pit — a hole to jump across"},
  {id:"bot",    em:"🤖", lbl:"Start — tap the same tile again to turn"},
  {id:"erase",  em:"🧹", lbl:"Erase everything on the tile"}
];

const on3  =()=>!!(mgState&&mgState.proj&&mgState.proj.mode3d);
const edit3=()=>!!(mgState&&mgState.creator&&on3());

/* ---------------- the level data ----------------
   plan/terrain are [x,y,height] triples and holes are [x,y] pairs — the
   exact shape TOWER_LEVELS uses, so a designed level and a built-in one
   are the same kind of object. */
function lists(p){p.plan=p.plan||[];p.terrain=p.terrain||[];p.holes=p.holes||[];return p;}
function at(l,x,y){for(const c of l)if(c[0]===x&&c[1]===y)return c;return null;}
function planH(p,x,y){const c=at(p.plan,x,y);return c?c[2]:0;}
function groundH(p,x,y){const c=at(p.terrain,x,y);return c?c[2]:0;}
function isHole(p,x,y){return !!at(p.holes,x,y);}
function without(l,x,y){return l.filter(c=>!(c[0]===x&&c[1]===y));}
function clearAt(p,x,y){p.plan=without(p.plan,x,y);p.terrain=without(p.terrain,x,y);p.holes=without(p.holes,x,y);}
function setH(l,x,y,h){
  const c=at(l,x,y);
  if(h<=0){const i=l.indexOf(c);if(i>=0)l.splice(i,1);return l;}
  if(c)c[2]=h; else l.push([x,y,h]);
  return l;
}
function peak(p){let m=0;for(const c of p.plan)m=Math.max(m,c[2]);for(const c of p.terrain)m=Math.max(m,c[2]);return m;}
function bricks(p){let n=0;for(const c of p.plan)n+=Math.max(0,c[2]-groundH(p,c[0],c[1]));return n;}

/* Every edit funnels through here: it rebuilds the derived state the rest
   of the game reads (planMap for the checker, cells for the 2D "is there
   anything to build" guard, the robot's height map) and re-locks the
   proof, so Save/Publish can never ship an unproven change. */
function sync(){
  const p=mgState.proj; lists(p);
  p.planMap={}; for(const c of p.plan)p.planMap[K(c[0],c[1])]=c[2];
  p.cells=p.plan.map(c=>[c[0],c[1]]);
  p.initial=[];p.tiles=[];p.cases=[];p.preset=null;p.goalType=null;
  const rb=mgState.robot;
  rb.x=p.start.x;rb.y=p.start.y;rb.dir=p.start.dir;
  mgSeed(rb,p);                       // tower3d's mgSeed rebuilds h/base/z
  mgState.solved=false;
  mgState.caseBase=null;mgState.draftBoard=null;
}

/* ---------------- painting ---------------- */
function paint(x,y,long){
  const p=mgState.proj; lists(p);
  const mode=mgState.paintMode;
  if(long||mode==="erase"){
    if(p.start.x===x&&p.start.y===y&&!planH(p,x,y)&&!groundH(p,x,y)){
      toast("🤖 That's the robot's start — put it somewhere else first.");return;
    }
    clearAt(p,x,y);
  }else if(mode==="ground"){
    p.holes=without(p.holes,x,y);
    const g=groundH(p,x,y);
    setH(p.terrain,x,y,g>=MAXG?0:g+1);
    // a brick planned at or below the new ground level is meaningless
    const ph=planH(p,x,y), ng=groundH(p,x,y);
    if(ph&&ph<=ng)setH(p.plan,x,y,ng+1);
  }else if(mode==="pit"){
    if(p.start.x===x&&p.start.y===y){toast("🤖 The robot starts here — move it first!");return;}
    if(isHole(p,x,y))p.holes=without(p.holes,x,y);
    else{clearAt(p,x,y);p.holes.push([x,y]);}
  }else if(mode==="bot"){
    if(isHole(p,x,y)){toast("🕳️ Not into a pit — pick solid ground.");return;}
    if(p.start.x===x&&p.start.y===y)p.start.dir=((p.start.dir|0)+1)%4;
    else{p.start.x=x;p.start.y=y;}
  }else{
    if(isHole(p,x,y)){toast("🕳️ A brick needs ground under it — fill the pit first.");return;}
    const ph=planH(p,x,y), g=groundH(p,x,y);
    const next=ph?(ph>=MAXH?0:ph+1):g+1;
    setH(p.plan,x,y,next);
  }
  sync(); sfx(500,.03); ui(); mgDraw();
}

/* tap vs hold, in capture phase so hud.js's flat-board dispatcher never
   also fires on the same pointerdown */
(function(){
  const cv=$("mgCanvas");
  let timer=0, tile=null, sx=0, sy=0, held=false, moved=false;
  const hit=e=>{
    const p=mgState.proj, r=cv.getBoundingClientRect();
    const x=Math.floor((e.clientX-r.left)/r.width*p.gw);
    const y=Math.floor((e.clientY-r.top)/r.height*p.gh);
    return (x<0||y<0||x>=p.gw||y>=p.gh)?null:{x,y};
  };
  const live=()=>edit3()&&!mgState.running&&mgState.t3view!=="3d";
  cv.addEventListener("pointerdown",e=>{
    if(!live())return;
    e.stopPropagation();
    tile=hit(e); if(!tile)return;
    sx=e.clientX;sy=e.clientY;held=false;moved=false;
    clearTimeout(timer);
    timer=setTimeout(()=>{held=true;sfx(300,.05);paint(tile.x,tile.y,true);},460);
  },true);
  cv.addEventListener("pointermove",e=>{
    if(!tile)return;
    if(Math.abs(e.clientX-sx)>12||Math.abs(e.clientY-sy)>12){moved=true;clearTimeout(timer);}
  },true);
  cv.addEventListener("pointerup",e=>{
    clearTimeout(timer);
    if(tile&&!held&&!moved&&live())paint(tile.x,tile.y,false);
    tile=null;
  },true);
  cv.addEventListener("pointercancel",()=>{clearTimeout(timer);tile=null;},true);
})();

/* ---------------- the top-down plan view ----------------
   Heights are numbers here on purpose: a flat map with a digit per tile is
   the only view where you can place a five-high stack accurately by touch.
   The 🧊 view toggle hands the same scene to the real 3D renderer. */
function rr(g,x,y,w,h,r){
  g.beginPath();
  g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);
  g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();
}
function drawBot(g,px,py,cs,dir){
  const col=(typeof ROBOT_COLORS!=="undefined"?ROBOT_COLORS[0]:"#ffb830");
  const lt=(window.CC_EXTRAS?CC_EXTRAS.lighten(col,.3):"#ffcd6e");
  const cx=px+cs/2, cy=py+cs/2;
  const dx=D4[dir|0][0], dy=D4[dir|0][1];
  // facing chevron on the ground, so the start direction reads at a glance
  const o=cs*.40, w=cs*.12, tx=cx+dx*o, ty=cy+dy*o;
  g.save();
  g.strokeStyle="rgba(36,27,69,.42)";g.lineWidth=Math.max(1.6,cs*.055);
  g.lineCap="round";g.lineJoin="round";
  g.beginPath();
  g.moveTo(tx-dx*w-dy*w, ty-dy*w+dx*w);
  g.lineTo(tx,ty);
  g.lineTo(tx-dx*w+dy*w, ty-dy*w-dx*w);
  g.stroke();
  g.restore();
  const s=cs*.60, x=cx-s/2, y=cy-s/2;
  g.strokeStyle="#d99a2b";g.lineWidth=Math.max(1,s*.07);
  g.beginPath();g.moveTo(x+s/2,y);g.lineTo(x+s/2,y-s*.2);g.stroke();
  g.fillStyle="#ffd76a";g.beginPath();g.arc(x+s/2,y-s*.23,s*.1,0,7);g.fill();
  const grd=g.createLinearGradient(0,y,0,y+s);
  grd.addColorStop(0,lt);grd.addColorStop(1,col);
  g.fillStyle=grd;rr(g,x,y,s,s,s*.28);g.fill();
  g.strokeStyle="rgba(120,70,10,.45)";g.lineWidth=1;g.stroke();
  for(const ox of [-1,1]){
    g.fillStyle="#fff";
    g.beginPath();g.arc(x+s/2+ox*s*.19,y+s*.42,s*.145,0,7);g.fill();
    g.fillStyle="#2b1c40";
    g.beginPath();g.arc(x+s/2+ox*s*.19+dx*s*.05,y+s*.42+dy*s*.05,s*.07,0,7);g.fill();
  }
  g.strokeStyle="rgba(43,28,64,.7)";g.lineWidth=Math.max(1,s*.05);
  g.beginPath();g.arc(x+s/2,y+s*.6,s*.16,.22*Math.PI,.78*Math.PI);g.stroke();
}
function drawGrid(){
  const p=mgState.proj, cv=$("mgCanvas");
  lists(p);
  const W=Math.max(180,cv.clientWidth||320), cs=W/p.gw, H=cs*p.gh;
  const dpr=(typeof DPR!=="undefined"?DPR:Math.min(3,window.devicePixelRatio||1));
  cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);cv.style.height=Math.round(H)+"px";
  const g=cv.getContext("2d");
  g.setTransform(dpr,0,0,dpr,0,0);
  g.clearRect(0,0,W,H);
  g.textAlign="center";g.textBaseline="middle";
  for(let y=0;y<p.gh;y++)for(let x=0;x<p.gw;x++){
    const px=x*cs, py=y*cs, pad=Math.max(1.5,cs*.05);
    const ph=planH(p,x,y), gh=groundH(p,x,y), hole=isHole(p,x,y);
    g.fillStyle=GRASS[(x*31+y*17)%3];
    g.fillRect(px,py,cs+.6,cs+.6);
    g.strokeStyle="rgba(40,90,30,.20)";g.lineWidth=1;
    g.strokeRect(px+.5,py+.5,cs-1,cs-1);
    if(hole){
      g.fillStyle="#2f261e";rr(g,px+pad,py+pad,cs-pad*2,cs-pad*2,cs*.15);g.fill();
      g.fillStyle="#1e1813";rr(g,px+cs*.22,py+cs*.22,cs*.56,cs*.56,cs*.11);g.fill();
      continue;
    }
    if(gh>0){
      g.fillStyle=STONE;rr(g,px+pad,py+pad,cs-pad*2,cs-pad*2,cs*.13);g.fill();
      g.strokeStyle="rgba(60,50,40,.42)";g.lineWidth=1;g.stroke();
      g.fillStyle="rgba(255,255,255,.26)";
      rr(g,px+pad*2,py+pad*2,cs-pad*4,(cs-pad*4)*.4,cs*.1);g.fill();
    }
    if(ph>0){
      const i0=gh>0?cs*.18:pad;
      g.fillStyle=PLAN;rr(g,px+i0,py+i0,cs-i0*2,cs-i0*2,cs*.12);g.fill();
      g.save();
      g.setLineDash([cs*.09,cs*.07]);
      g.strokeStyle="rgba(255,255,255,.8)";g.lineWidth=Math.max(1,cs*.03);
      rr(g,px+i0+cs*.055,py+i0+cs*.055,cs-i0*2-cs*.11,cs-i0*2-cs*.11,cs*.09);
      g.stroke();g.restore();
      g.fillStyle="#4a2b06";
      g.font="800 "+Math.round(cs*.40)+"px system-ui,-apple-system,sans-serif";
      g.fillText(String(ph),px+cs/2,py+cs/2+cs*.015);
    }
    if(gh>0){
      g.fillStyle=ph>0?"rgba(255,255,255,.96)":"#372f26";
      g.font="800 "+Math.round(cs*(ph>0?.19:.34))+"px system-ui,-apple-system,sans-serif";
      if(ph>0)g.fillText(String(gh),px+cs*.16,py+cs*.85);
      else g.fillText(String(gh),px+cs/2,py+cs/2);
    }
  }
  drawBot(g,p.start.x*cs,p.start.y*cs,cs,p.start.dir);
}

/* ---------------- the buildability check ----------------
   Errors are things the build rules make impossible and they block Save.
   Warnings are things that are probably a mistake — the ▶ prove-it gate
   the creator already enforces is the real guarantee. */
function check(p){
  lists(p);
  const errs=[], warns=[];
  if(!p.plan.length)errs.push("The blueprint is empty — tap tiles with 🧱 to plan bricks.");
  if(p.start.x>=p.gw||p.start.y>=p.gh)errs.push("The robot starts off the board — place it with 🤖.");
  else if(isHole(p,p.start.x,p.start.y))errs.push("The robot starts inside a 🕳️ pit.");
  for(const c of p.plan){
    if(isHole(p,c[0],c[1])){errs.push("The brick at "+c[0]+","+c[1]+" hangs over a 🕳️ pit — bricks need ground under them.");break;}
    if(c[2]<=groundH(p,c[0],c[1])){errs.push("The brick at "+c[0]+","+c[1]+" isn't above its own ⛰️ ground — raise the brick or lower the ground.");break;}
  }
  if(errs.length)return {errs,warns};
  // walk the FINISHED build: bricks in place, terrain as given
  const fin=(x,y)=>isHole(p,x,y)?null:(planH(p,x,y)||groundH(p,x,y));
  const jump=(p.allowed||[]).indexOf("jump")>=0;
  const seen=new Set([K(p.start.x,p.start.y)]);
  const q=[[p.start.x,p.start.y]];
  const inB=(x,y)=>x>=0&&y>=0&&x<p.gw&&y<p.gh;
  while(q.length){
    const cur=q.shift(), z=fin(cur[0],cur[1]);
    for(const d of D4){
      const nx=cur[0]+d[0], ny=cur[1]+d[1];
      if(!inB(nx,ny))continue;
      const nz=fin(nx,ny);
      if(nz!=null){                                  // walk, climb or step down
        if(Math.abs(nz-z)<=1&&!seen.has(K(nx,ny))){seen.add(K(nx,ny));q.push([nx,ny]);}
      }else if(jump){                                // 🦘 clear the pit
        const jx=cur[0]+d[0]*2, jy=cur[1]+d[1]*2;
        if(!inB(jx,jy))continue;
        if(fin(jx,jy)===z&&!seen.has(K(jx,jy))){seen.add(K(jx,jy));q.push([jx,jy]);}
      }
    }
  }
  // to raise a tile to T the robot must stand on a neighbour at T−1 or higher
  for(const c of p.plan){
    let ok=false;
    for(const d of D4){
      const nx=c[0]+d[0], ny=c[1]+d[1];
      if(!inB(nx,ny)||!seen.has(K(nx,ny)))continue;
      if(fin(nx,ny)>=c[2]-1){ok=true;break;}
    }
    if(!ok){
      warns.push("The robot can't build the brick at "+c[0]+","+c[1]+" — it has to stand on a neighbouring tile "+(c[2]-1)+" high. Plan a step beside it.");
      break;
    }
  }
  if(p.holes.length&&!jump)warns.push("There are 🕳️ pits but 🦘 Jump Gap isn't an allowed block — turn it on below.");
  if(peak(p)>1&&(p.allowed||[]).indexOf("climb")<0)warns.push("The build goes higher than 1 but 🪜 Climb Up isn't an allowed block — turn it on below.");
  if(bricks(p)>p.maxBlocks*8)warns.push(bricks(p)+" bricks from "+p.maxBlocks+" blocks is very tight — the player will need nested loops.");
  return {errs,warns};
}

/* ---------------- switching modes ---------------- */
function setMode(on){
  const p=mgState.proj;
  if(on){
    lists(p);
    p.mode3d=true;
    if(!p.t3init){p.allowed=DEF_ALLOWED.slice();p.t3init=1;p.desc3=p.desc3||"";}
    mgState.paintMode="plan";
    mgState.t3view="grid";
    if(mgRobot){mgRobot.program=[];mgRobot.routines={A:{params:[],body:[]},B:{params:[],body:[]}};mgRobot.hist=[];mgRobot.redoS=[];}
    if(typeof edTarget!=="undefined")edTarget="main";
    sync();
  }else{
    delete p.mode3d;
    p.planMap=null;p.t3init=0;
    p.plan=[];p.terrain=[];p.holes=[];
    p.cells=[];p.initial=[];p.tiles=[];
    p.allowed=(typeof CREATOR_BLOCKS!=="undefined"?CREATOR_BLOCKS:p.allowed);
    mgState.paintMode="paint";
    mgState.t3view="grid";
    if(window.t3Cam){t3Cam.stop();t3Cam.bar(false);}
    const rb=mgState.robot;
    rb.h={};rb.base={};rb.z=0;
    rb.x=p.start.x;rb.y=p.start.y;
    mgSeed(rb,p);
    mgState.solved=false;
  }
  renderPalette();renderProgram();renderPy();updateUndoBtns();mgUpdateCount();
  mgCreatorUI();mgDraw();
  sfx(on?680:420,.05);
}

/* ---------------- the injected chrome ---------------- */
function chrome(){
  const bar=$("mgCreatorBar");
  if(!bar||$("t3Btn"))return;
  const act=bar.querySelector(".cb-act");
  const b=document.createElement("button");
  b.id="t3Btn";b.className="ibtn wide";
  b.title="Switch between a flat 2D challenge and a 3D Tower level";
  b.addEventListener("click",()=>{
    const to=!on3();
    const msg=to
      ? "Switch to 🧊 3D Tower mode?\n\nThe flat board and the program you've written are cleared — you design with heights instead."
      : "Back to the flat 2D board?\n\nYour 3D blueprint is cleared.";
    if(!confirm(msg))return;
    setMode(to);
  });
  act.insertBefore(b,$("mgSetup"));

  const row=document.createElement("div");
  row.id="t3EdRow";row.className="cb-row t3edrow";
  row.innerHTML='<button class="t3vbtn" id="t3View"></button>'+
    '<span class="t3stat">⛰ <b id="t3Peak">0</b></span>'+
    '<span class="t3stat">🧱 <b id="t3Bricks">0</b></span>'+
    '<span class="spacer"></span>'+
    '<span class="t3leg"><i class="t3lg t3lg-p"></i>brick<i class="t3lg t3lg-g"></i>ground<i class="t3lg t3lg-h"></i>pit</span>';
  bar.insertBefore(row,act);
  const warn=document.createElement("div");
  warn.id="t3Warn";warn.className="t3warn";
  bar.insertBefore(warn,act);
  $("t3View").addEventListener("click",()=>{
    mgState.t3view=mgState.t3view==="3d"?"grid":"3d";
    if(window.t3Cam)t3Cam.bar(mgState.t3view==="3d");
    sfx(560,.03);ui();mgDraw();
  });

  const pane=bar.querySelector(".cb-panel"), stprow=pane.querySelector(".stprow");
  const hint=document.createElement("button");
  hint.id="t3Hint";hint.className="rowbtn";
  hint.innerHTML='📜 <span class="lb">Level hint for the player</span>';
  hint.addEventListener("click",()=>{
    const p=mgState.proj;
    const t=prompt("What should the player read when the level opens?",p.desc3||"");
    if(t===null)return;
    p.desc3=t.slice(0,240);sfx(560,.04);ui();
  });
  const chips=document.createElement("div");
  chips.id="t3Blocks";chips.className="t3chips";
  pane.insertBefore(hint,stprow);
  pane.insertBefore(chips,stprow);
}
function chipRow(p){
  const chips=$("t3Blocks");
  chips.innerHTML="";
  const set=new Set(p.allowed||[]);
  const mk=t=>{
    const d=DEFS[t]; if(!d)return;
    const lock=!!LOCKED[t], onx=set.has(t)||lock;
    const c=document.createElement("button");
    c.className="t3chip"+(onx?" on":"")+(lock?" lock":"");
    c.innerHTML=d.ic+' <span>'+esc(d.lbl)+'</span>';
    c.title=lock?"Always available":(onx?"Tap to take it away":"Tap to allow it");
    if(!lock)c.addEventListener("click",()=>{
      if(set.has(t))set.delete(t); else set.add(t);
      p.allowed=ALL.filter(k=>set.has(k)||LOCKED[k]);
      mgState.solved=false;
      sfx(520,.03);
      renderPalette();mgUpdateCount();ui();
    });
    chips.appendChild(c);
  };
  ACTS.forEach(mk);
  const sep=document.createElement("i");sep.className="t3sep";chips.appendChild(sep);
  CTRL.forEach(mk);
}
function ui(){
  const btn=$("t3Btn");
  if(!btn)return;
  const cr=!!(mgState&&mgState.creator);
  btn.style.display=cr?"":"none";
  const row=$("t3EdRow"), warn=$("t3Warn"), chips=$("t3Blocks"), hint=$("t3Hint");
  const three=cr&&on3();
  for(const el of [row,warn,chips,hint])if(el)el.style.display=three?"":"none";
  if(!cr)return;
  btn.textContent=three?"🗺️ 2D":"🧊 3D";
  btn.classList.toggle("on",three);
  if(!three){
    // these are always-on in 2D and nothing else restores them
    for(const id of ["mgAddCase","mgPreset","mgAddStage"]){const e=$(id);if(e)e.style.display="";}
    return;
  }
  const p=mgState.proj; lists(p);
  // the flat-board affordances have no meaning on a Tower level
  for(const id of ["mgAddCase","mgPreset","mgAddStage","mgBrickStp","mgCaseNow","mgCaseEdit","mgCases","mgLevels"]){
    const e=$(id); if(e)e.style.display="none";
  }
  const solid=mgState.t3view==="3d";
  $("t3View").textContent=solid?"🧊 3D view":"🗺️ Plan view";
  $("t3View").classList.toggle("on",solid);
  $("t3Peak").textContent=peak(p);
  $("t3Bricks").textContent=bricks(p);
  chipRow(p);
  const v=check(p);
  if(v.errs.length){warn.className="t3warn bad";warn.textContent="⚠️ "+v.errs[0];}
  else if(v.warns.length){warn.className="t3warn hmm";warn.textContent="⚠️ "+v.warns[0];}
  else warn.className="t3warn ok",warn.textContent="✅ Buildable — "+bricks(p)+" bricks, peak ⛰ "+peak(p)+". Write a program, press ▶ to prove it, then 💾 Save.";
  $("mgGoal").textContent=(p.desc3?"📜 “"+p.desc3+"”":"🧊 Tower design — tap a tile to raise it, hold to clear it.");
}

/* ---------------- wrapping the creator ---------------- */
const _mgCreatorUI=window.mgCreatorUI;
window.mgCreatorUI=function(){_mgCreatorUI();chrome();ui();};

const _mgToolsUI=window.mgToolsUI;
window.mgToolsUI=function(){
  if(!edit3())return _mgToolsUI();
  const el=$("mgTools"); if(!el)return;
  el.innerHTML="";
  for(const t of TOOLS){
    const b=document.createElement("button");
    b.className="tool"+(t.id===mgState.paintMode?" on":"");
    b.textContent=t.em;b.title=t.lbl;
    b.addEventListener("click",()=>{mgState.paintMode=t.id;sfx(560,.03);mgCreatorUI();});
    el.appendChild(b);
  }
};

const _mgPaintTile=window.mgPaintTile;
window.mgPaintTile=function(x,y){
  if(!edit3())return _mgPaintTile(x,y);
  paint(x,y,false);
};

const _mgSetSize=window.mgSetSize;
window.mgSetSize=function(dw,dh){
  const was=edit3();
  _mgSetSize(dw,dh);
  if(!was)return;
  const p=mgState.proj; lists(p);
  const keep=c=>c[0]<p.gw&&c[1]<p.gh;
  p.plan=p.plan.filter(keep);p.terrain=p.terrain.filter(keep);p.holes=p.holes.filter(keep);
  sync();ui();mgDraw();
};

/* the plan view owns the canvas while designing; ▶ hands it to the real
   3D renderer (and the 🧊 toggle does the same on demand) */
const _mgDraw=window.mgDraw;
window.mgDraw=function(){
  if(!edit3())return _mgDraw();
  if(mgState.running&&mgState.t3view!=="3d"){
    mgState.t3view="3d";
    if(window.t3Cam)t3Cam.bar(true);
    setTimeout(ui,0);
  }
  if(mgState.t3view==="3d"){
    if(window.t3Cam)t3Cam.start();
    return _mgDraw();
  }
  if(window.t3Cam)t3Cam.stop();
  drawGrid();
};

/* ---------------- save · play · edit · publish ---------------- */
function levelFrom(p){
  return JSON.parse(JSON.stringify({
    em:"🧊", name:p.name, diff:p.diff||1,
    maxBlocks:p.maxBlocks, gw:p.gw, gh:p.gh,
    allowed:(p.allowed||DEF_ALLOWED).slice(),
    start:{x:p.start.x,y:p.start.y,dir:p.start.dir},
    plan:p.plan, terrain:p.terrain, holes:p.holes,
    desc:p.desc3||("Rebuild the blueprint in 3D — "+bricks(p)+" bricks, peak ⛰ "+peak(p)+", within "+p.maxBlocks+" blocks.")
  }));
}
function gate(p){
  const v=check(p);
  if(v.errs.length){toast("⚠️ "+v.errs[0]);sfx(200,.06);return false;}
  if(!mgState.solved){toast("▶ First prove it: write a program and run it, then 💾 Save opens up.");sfx(200,.06);return false;}
  return true;
}
const _saveMy=window.saveMyChallenge;
window.saveMyChallenge=function(){
  if(!edit3())return _saveMy();
  const p=mgState.proj;
  if(!gate(p))return;
  player.myChallenges=player.myChallenges||[];
  const entry=levelFrom(p);
  entry.id=mgState.editingId||("my_"+Date.now());
  entry.mine=true;entry.t3=true;entry.coins=0;entry.xp=0;
  entry.sol=(mgRobot?packProg(mgRobot):[]);
  const i=player.myChallenges.findIndex(x=>x.id===entry.id);
  if(i>=0)player.myChallenges[i]=entry; else player.myChallenges.push(entry);
  saveNow();
  toast(i>=0?"✅ Updated “"+p.name+"”":"💾 Saved “"+p.name+"” to My Challenges!");
  sfx(760,.06);sfx(1040,.06,.08);
};

// a saved Tower level plays through t3Enter, wherever it was tapped from
const _mgEnter=window.mgEnter;
window.mgEnter=function(proj0){
  if(proj0&&proj0.t3&&!proj0.mode3d&&typeof t3Enter==="function")return t3Enter(proj0);
  return _mgEnter(proj0);
};

const _mgEditMy=window.mgEditMyChallenge;
window.mgEditMyChallenge=function(entry){
  if(!entry||!entry.t3)return _mgEditMy(entry);
  mgEnterCreator();
  const p=mgState.proj;
  p.name=entry.name;p.diff=entry.diff||1;
  p.gw=entry.gw||6;p.gh=entry.gh||4;p.maxBlocks=entry.maxBlocks||10;
  p.start=JSON.parse(JSON.stringify(entry.start||{x:0,y:0,dir:1}));
  p.plan=JSON.parse(JSON.stringify(entry.plan||[]));
  p.terrain=JSON.parse(JSON.stringify(entry.terrain||[]));
  p.holes=JSON.parse(JSON.stringify(entry.holes||[]));
  p.allowed=(entry.allowed||DEF_ALLOWED).slice();
  p.desc3=entry.desc||"";
  p.t3init=1;
  mgState.editingId=entry.id;
  setMode(true);
  mgLoadSolution(entry.sol||[]);
  mgState.solved=false;
  renderPalette();renderProgram();renderPy();updateUndoBtns();mgUpdateCount();
  mgCreatorUI();mgDraw();
  toast("✏️ Editing “"+entry.name+"” — your solution is loaded. Change it, prove it ▶, then 💾 Save.");
};

/* Publishing: the community table has fixed columns, so the Tower payload
   rides in `stages` as a single 3D stage. `cells` still carries the plan's
   footprint, so a client that has never heard of Tower Mode shows a plain
   (if easier) flat blueprint rather than an empty board. */
const _publish=window.publishChallenge;
window.publishChallenge=async function(){
  if(!edit3())return _publish();
  const p=mgState.proj;
  if(!gate(p))return;
  if(typeof sbUser==="undefined"||!sbUser){toast("🔑 Log in first to publish.");return;}
  const stage=levelFrom(p);
  stage.mode3d=true;stage.t3=true;
  stage.sol=(mgRobot?packProg(mgRobot):[]);
  const body={name:p.name,gw:p.gw,gh:p.gh,
    start_x:p.start.x,start_y:p.start.y,start_dir:p.start.dir,
    cells:p.plan.map(c=>[c[0],c[1]]),initial:[],tiles:[],
    max_blocks:p.maxBlocks,diff:p.diff||2,
    stages:[stage],solution:stage.sol,cases:[],preset:[],
    author_name:(sbUser.email||"builder").split("@")[0].slice(0,20)};
  try{
    if(mgState.publishId){
      await sbRest("challenges?id=eq."+encodeURIComponent(mgState.publishId),{method:"PATCH",
        headers:Object.assign(sbHeaders(true),{Prefer:"return=minimal"}),
        body:JSON.stringify(Object.assign({updated_at:new Date().toISOString()},body))});
      if(window.CC_EXTRAS)CC_EXTRAS.celebrate("🧊","UPDATED!",p.name+" is updated!","Your Tower level is live for everyone who plays it!","Nice! 🎉");
      else bigToast("🧊 Updated “"+p.name+"”!");
    }else{
      await sbRest("challenges",{method:"POST",headers:Object.assign(sbHeaders(true),{Prefer:"return=minimal"}),
        body:JSON.stringify(body)});
      if(window.CC_EXTRAS)CC_EXTRAS.celebrate("🧊","PUBLISHED!",p.name+" is live!","Players everywhere can now climb your tower!","Awesome! 🎉");
      else bigToast("🧊 Published “"+p.name+"”!");
    }
    mgExit(true);
  }catch(e){toast("⚠️ Publish failed: "+e.message);}
};

// a published Tower level arrives as a one-stage pack
const _packEnter=window.packEnter;
window.packEnter=function(pack,i){
  const s=pack&&pack.stages&&pack.stages[i||0];
  if(s&&s.mode3d&&typeof t3Enter==="function"){
    const lv=JSON.parse(JSON.stringify(s));
    lv.id=pack.id||("t3_"+Date.now());
    lv.em="🧊";lv.name=pack.name||lv.name;lv.diff=pack.diff||2;
    lv.community=pack.community||null;
    lv.coins=lv.community?60:0;lv.xp=lv.community?30:0;
    return t3Enter(lv);
  }
  return _packEnter(pack,i);
};

/* ---------------- the Tower band gets a Design card ---------------- */
const _renderProjects=window.renderProjects;
window.renderProjects=function(){
  _renderProjects();
  const grid=document.querySelector(".t3sec .t3grid");
  if(!grid)return;
  for(const e of (player.myChallenges||[]).filter(x=>x.t3)){
    const c=document.createElement("button");
    c.className="t3card mine";
    c.innerHTML='<span class="t3badge">🧊</span>'+
      '<span class="t3name">'+esc(e.name)+'</span>'+
      '<span class="t3meta">'+"⭐".repeat(e.diff||1)+' · 🧩 '+e.maxBlocks+' · ⛰ '+peak(lists(e))+'</span>'+
      '<span class="t3mine">yours</span>';
    c.onclick=()=>{$("projects").classList.remove("open");t3Enter(e);};
    grid.appendChild(c);
  }
  const add=document.createElement("button");
  add.className="t3card t3new";
  add.innerHTML='<span class="t3badge">✏️</span>'+
    '<span class="t3name">Design a level</span>'+
    '<span class="t3meta">Your own tower — plan it, prove it, publish it</span>';
  add.onclick=()=>{$("projects").classList.remove("open");mgEnterCreator();setMode(true);};
  grid.appendChild(add);
};
})();
