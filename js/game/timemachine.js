"use strict";
/* =====================================================================
   The time machine
   ---------------------------------------------------------------------
   A run on a board is over in a few seconds and all of its meaning is in
   the middle of it: the step where the robot turned the wrong way, the
   pass of the loop where the number stopped being the biggest. Watching
   it again from the start is the only way a child had to find that step.

   So every run is kept. Each action the program takes leaves a snapshot
   of the board — where the robot is, what it holds, every brick, every
   variable, which block ran — and a bar under the board slides through
   them. Drag it back and the board IS that step: the robot stands there,
   the variables read what they read then, and the Blocks tab lights the
   block that had just run.

   It RECORDS; it never runs anything. There is one interpreter (mgTick in
   challenges.js) and this file does not call it. What is on the board
   while looking back is a copy of a snapshot; the run itself is set aside
   (T.live) and put back before the next action is taken (tmLive, the
   first thing mgTick does), so a paused run carries on from where it
   really is, never from the step being looked at.

   What it says went wrong is only ever what can be SEEN to have gone
   wrong: a step that did not move (the way was blocked), a hand that came
   back empty, a brick outside the plan. Those are marks on the bar and
   the triangle button walks between them. A guess that a keypad refuses
   is not one — in the Cyber Lab guessing is the method — and neither is
   a brick laid twice on a corner, which is how an outline is painted.

   Several inputs: each has its own recording. When a run fails, the board
   goes back to the input that failed — it used to stay on whichever ran
   last, often the secret one — and tapping another input's chip puts its
   run on the bar. The secret input is never replayed.

   Not in the designer: there a run lays every input over the board the
   author is drawing, and looking back would leave another input's board
   under their next stroke.
   ===================================================================== */
(function(){
if(window.__tm)return; window.__tm=1;

const MAX=3000;       // steps kept for one input; past it the oldest go
const PAD=12;         // the thumb's radius: it stays inside the track
let T=null;           // the recording of the run on the board, or null
let el=null;          // the bar's elements, built once

/* ---------------- copies ----------------
   The board state is plain data — numbers, Sets of "x_y" keys, a Map of
   tiles, a few small objects — whichever file put it there (puzzle-tiles,
   tower3d, cyber). Copied by shape rather than by name, so a field added
   tomorrow is recorded without this file hearing about it. */
function copy(v,d){
  if(v===null||typeof v!=="object")return v;
  if(d>6)return v;
  if(v instanceof Set)return new Set(v);
  if(v instanceof Map){const m=new Map();for(const e of v)m.set(e[0],copy(e[1],d+1));return m;}
  if(Array.isArray(v))return v.map(x=>copy(x,d+1));
  const p=Object.getPrototypeOf(v);
  if(p!==Object.prototype&&p!==null)return v;        // not plain data: not ours to copy
  const o={};for(const k in v)o[k]=copy(v[k],d+1);
  return o;
}
function same(a,b,d){
  if(a===b)return true;
  if(a===null||b===null||typeof a!=="object"||typeof b!=="object")return false;
  if(d>6)return false;
  if(a instanceof Set){
    if(!(b instanceof Set)||a.size!==b.size)return false;
    for(const x of a)if(!b.has(x))return false;
    return true;
  }
  if(a instanceof Map){
    if(!(b instanceof Map)||a.size!==b.size)return false;
    for(const e of a)if(!b.has(e[0])||!same(e[1],b.get(e[0]),d+1))return false;
    return true;
  }
  if(Array.isArray(a)){
    if(!Array.isArray(b)||a.length!==b.length)return false;
    for(let i=0;i<a.length;i++)if(!same(a[i],b[i],d+1))return false;
    return true;
  }
  if(Array.isArray(b))return false;
  const ka=Object.keys(a);
  if(ka.length!==Object.keys(b).length)return false;
  for(const k of ka)if(!same(a[k],b[k],d+1))return false;
  return true;
}
/* One step's board. Most of a board does not change in a step — a Move
   changes two numbers — so whatever is equal to the step before is the
   SAME object as the step before, and a 500-step run of a 40-tile board
   keeps one copy of the tiles, not five hundred. Nothing ever writes to a
   snapshot (what is shown is a copy of it), which is what makes that safe. */
function snapBoard(rb,prev){
  const o={};
  for(const k in rb){
    const v=rb[k];
    o[k]=(v!==null&&typeof v==="object")?((prev&&same(v,prev[k],0))?prev[k]:copy(v,0)):v;
  }
  return o;
}
function snapVars(prev){
  const v=mgRobot.vars||{};
  return (prev&&same(v,prev.vars,0))?prev.vars:copy(v,0);
}
function snapSay(){const s=mgRobot.say;return s?{txt:s.txt,until:s.until}:null;}

/* ---------------- what counts as trouble ---------------- */
const EMPTY={pickUp:1,drop:1,chop:1,collect:1,dig:1};
function strayNow(st){
  const p=st.proj;
  if(p.mode3d||p.goalType||!(p.cells||[]).length||typeof mgStray!=="function")return false;
  const numbered=p.cells.some(c=>c.length>2&&c[2]!=null);
  if(!numbered&&typeof mgSortGoalOrder==="function"&&mgSortGoalOrder(p))return false;
  return mgStray(st,new Set(p.cells.map(c=>c[0]+"_"+c[1])));
}
function trouble(st,R,b,was,now,prev){
  if(!b||!was)return null;
  const rb=st.robot,t=b.t;
  if(MG_STEPS[t]&&t!=="goNear"&&rb.x===was.x&&rb.y===was.y)return "bump";
  if(t==="build"||t==="drop"||t==="pickUp"){
    const s=strayNow(st), fresh=s&&!R.stray;
    R.stray=s;
    if(fresh)return "stray";
  }
  /* reached for something and the board is exactly as it was */
  if(EMPTY[t]&&prev&&same(now,prev,0))return "empty";
  return null;
}
/* Two or three words: the caption shares one line with the count and the
   block's name, on a track that is 160px wide on the smallest phone. */
const WHY={bump:"Blocked",empty:"Nothing happened",stray:"Off the plan"};

/* ---------------- recording ---------------- */
function progSig(){try{return JSON.stringify(packProg(mgRobot));}catch(_){return "";}}
function begin(st){
  if(!st||st!==mgState||st.creator||!mgRobot){drop(false);return;}
  if(T&&(T.st!==st||T.live))drop(false);
  if(!T)T={st,recs:[],cur:null,view:0,at:0,live:null,board:0,sig:progSig(),busy:false,next:false,
    x:0,anim:null,hinted:false};
  const ci=st.ci|0, c=st.cases&&st.cases[ci];
  const R={ci,snaps:[],base:0,bad:[],done:false,ok:null,stray:false,hidden:!!(c&&c.hidden)};
  R.snaps.push({rb:snapBoard(st.robot,null),vars:snapVars(null),say:snapSay(),uid:null,t:null,bad:null});
  R.stray=strayNow(st);
  T.recs[ci]=R;T.cur=R;T.board=ci;T.view=ci;T.at=0;
  uiShow(true);paint(true);
}
function rec(st,b,was){
  if(!T||T.st!==st||!T.cur||T.cur.done||T.live)return;
  const R=T.cur, prev=R.snaps[R.snaps.length-1];
  const now=snapBoard(st.robot,prev.rb);
  const bad=trouble(st,R,b,was,now,prev.rb);
  R.snaps.push({rb:now,vars:snapVars(prev),say:snapSay(),uid:mgRobot.curUid,t:b?b.t:"wait",bad});
  if(bad)R.bad.push(R.base+R.snaps.length-1);
  if(R.snaps.length>MAX+250){
    R.snaps.splice(0,250);R.base+=250;
    R.bad=R.bad.filter(n=>n>=R.base);
  }
  if(T.view===R.ci){T.at=R.snaps.length-1;paint(true,!!st.timer&&(st.tickMs||340)<200);}
}
/* An input is over. The last step takes whatever the program did after its
   last action — a function handing its answer back, a loop counter's final
   value — so the end of the bar is the end of the run. */
function end(st,ok){
  if(!T||T.st!==st||!T.cur||T.cur.done)return;
  if(T.live)toLive();
  const R=T.cur, last=R.snaps[R.snaps.length-1];
  if(!same(mgRobot.vars||{},last.vars,0))last.vars=copy(mgRobot.vars||{},0);
  last.say=snapSay();
  R.done=true;R.ok=!!ok;
  T.next=!!(st.cases&&st.ci+1<st.cases.length);   // the next input's reset is not the end of this run
}
/* Every input has run. Stand the bar on the input worth looking at: the
   first one that failed, else the last — and never the secret one. */
function done(st){
  if(!T||T.st!==st)return;
  T.next=false;
  const seen=T.recs.filter(R=>R&&!R.hidden);
  if(!seen.length){uiShow(false);return;}
  const pick=seen.find(R=>R.done&&R.ok===false)||seen[seen.length-1];
  go(pick.ci,pick.snaps.length-1,false);
  paint(true);
  if(typeof mgCaseStrip==="function")mgCaseStrip();
  if(seen.some(R=>R.ok===false))hint();
}

/* ---------------- looking back ---------------- */
function liveRec(){return T&&T.cur;}
function isLive(ci,at){const L=liveRec();return !!L&&L.ci===ci&&at===L.snaps.length-1;}
function useCase(i){
  const st=T.st, keep=st.steps;
  T.busy=true;
  try{mgApplyCase(st.cases[i]);}finally{T.busy=false;}
  st.steps=keep;T.board=i;
}
/* put the run itself back on the board */
function toLive(){
  if(!T||!T.live)return;
  const st=T.st, L=T.live;
  if(T.board!==L.ci)useCase(L.ci);
  st.robot=L.rb;mgRobot.vars=L.vars;mgRobot.say=L.say;mgRobot.curUid=L.uid;mgRobot.peek=false;
  T.live=null;T.view=L.ci;
  const R=T.recs[L.ci];T.at=R?R.snaps.length-1:0;
}
/* stand the board on step `at` of input `ci`; `play` walks the robot into
   it from the step before, the way it happened */
function go(ci,at,play){
  if(!T)return;
  const st=T.st, R=T.recs[ci];
  if(!R||R.hidden||st!==mgState)return;
  at=Math.max(0,Math.min(R.snaps.length-1,at|0));
  if(isLive(ci,at)){
    const was=T.live;
    toLive();
    if(was&&play)replay(R,at);
  }else{
    if(!T.live)T.live={rb:st.robot,vars:mgRobot.vars,say:mgRobot.say,uid:mgRobot.curUid,ci:liveRec().ci};
    if(T.board!==ci)useCase(ci);
    const s=R.snaps[at];
    st.robot=copy(s.rb,0);mgRobot.vars=copy(s.vars,0);mgRobot.say=s.say?{txt:s.say.txt,until:s.say.until}:null;
    mgRobot.curUid=s.uid;mgRobot.peek=true;
    T.view=ci;T.at=at;
    if(play)replay(R,at);
  }
  if(typeof mgDraw==="function")mgDraw();
  if(typeof mgVarsUI==="function")mgVarsUI();
  if(typeof updateExecHighlight==="function")updateExecHighlight();
  paint(false);
}
function replay(R,at){
  const s=R.snaps[at], p=R.snaps[at-1];
  if(!p||!s.t||typeof mgLookReplay!=="function"||calm())return;
  mgLookReplay(T.st,s.t,p.rb);
}
function calm(){try{return matchMedia("(prefers-reduced-motion: reduce)").matches;}catch(_){return false;}}
/* a run on its timer is paused by taking hold of it, the way Step pauses it */
function pause(){
  const st=T&&T.st;
  if(st&&st.running&&st.timer){
    clearInterval(st.timer);st.timer=null;st.stepping=true;
    if(typeof updateChips==="function")updateChips();
    if(typeof updateFab==="function")updateFab();
  }
}
function used(){
  if(typeof player!=="undefined"&&player&&!player.tmUsed){player.tmUsed=1;if(typeof saveSoon==="function")saveSoon();}
}
function step(d,play){
  if(!ready())return;
  pause();stopAnim();used();
  const R=T.recs[T.view], to=Math.max(0,Math.min(R.snaps.length-1,T.at+d));
  if(to===T.at)return;
  go(T.view,to,play&&d===1);
  glide();
}
/* the next step where something visibly went wrong, round and round */
function nextBad(){
  if(!ready())return;
  const R=T.recs[T.view];
  if(!R.bad.length)return;
  pause();stopAnim();used();
  const here=R.base+T.at;
  const n=R.bad.find(x=>x>here);
  const to=(n==null?R.bad[0]:n)-R.base;
  /* arrive at the step before and take the bad one, so the bonk is seen */
  if(to>0&&to!==T.at)go(T.view,to-1,false);
  go(T.view,to,true);
  glide();
}
function ready(){
  if(!T||T.st!==mgState)return false;
  const R=T.recs[T.view];
  return !!R&&!R.hidden&&R.snaps.length>0;
}

/* ---------------- letting go ---------------- */
function drop(board){
  if(!T)return;
  stopAnim();
  const L=T.live, st=T.st;
  if(L&&mgRobot){
    if(board&&st===mgState){toLive();}
    else{mgRobot.vars=L.vars;mgRobot.say=L.say;mgRobot.curUid=L.uid;}
  }
  if(mgRobot)mgRobot.peek=false;
  T=null;
  uiShow(false);
  if(board&&st===mgState){
    if(typeof mgDraw==="function")mgDraw();
    if(typeof mgVarsUI==="function")mgVarsUI();
    if(typeof mgCaseStrip==="function")mgCaseStrip();
  }
}
function onReset(){
  if(!T||T.busy)return;
  if(T.next){T.next=false;return;}
  drop(false);
}
function onProg(){
  if(T&&progSig()!==T.sig)drop(true);
}
/* which class a chip in the strip of inputs gets */
function caseClass(i){
  if(!T||T.st!==mgState||T.st.running)return "";
  const R=T.recs[i];
  if(!R||R.hidden||!R.snaps.length)return "";
  return T.view===i?"tap view":"tap";
}

/* ---------------- the bar ---------------- */
function build(){
  if(el)return el;
  const read=$("mgRead");
  if(!read)return null;
  const box=document.createElement("div");
  box.id="mgTime";box.hidden=true;
  /* The caption sits in the track's own column, above the rail, so the bar
     is one row tall: under a board on a phone there is room for one. It is
     a sibling of the track, not a child — a slider's children are not read
     out — and lets presses through to the track under it. */
  box.innerHTML=
    '<div class="tm-row">'+
      '<button type="button" id="tmBack" class="tm-btn" aria-label="One step back">\u2039</button>'+
      '<div id="tmTrack" role="slider" tabindex="0" aria-label="Time machine" title="Drag to go back in time"'+
        ' aria-valuemin="0" aria-valuemax="0" aria-valuenow="0">'+
        '<div class="tm-rail"><div class="tm-fill"></div></div><div class="tm-ticks"></div>'+
        '<div class="tm-thumb"><i></i></div>'+
      '</div>'+
      '<div class="tm-cap"><b class="tm-num"></b><span class="tm-ic"></span><span class="tm-what"></span><span class="tm-why"></span></div>'+
      '<button type="button" id="tmFwd" class="tm-btn" aria-label="One step forward">\u203a</button>'+
      '<button type="button" id="tmWhy" class="tm-btn" aria-label="Go to what went wrong">⚠️</button>'+
    '</div>';
  /* first under the board: the bar belongs to the board it moves */
  const lesson=$("mgLesson");
  read.insertBefore(box,lesson&&lesson.parentNode===read?lesson:read.firstChild);
  el={box,track:box.querySelector("#tmTrack"),fill:box.querySelector(".tm-fill"),ticks:box.querySelector(".tm-ticks"),
    thumb:box.querySelector(".tm-thumb"),back:box.querySelector("#tmBack"),fwd:box.querySelector("#tmFwd"),
    why:box.querySelector("#tmWhy"),cap:box.querySelector(".tm-cap"),num:box.querySelector(".tm-num"),ic:box.querySelector(".tm-ic"),
    what:box.querySelector(".tm-what"),reason:box.querySelector(".tm-why"),W:0,last:{}};
  wire();
  return el;
}
function uiShow(on){
  if(!on&&!el)return;
  if(!build())return;
  if(el.box.hidden===!on)return;
  el.box.hidden=!on;
  const panel=$("mgPanel");
  if(panel)panel.classList.toggle("tm",on);
  if(on){el.W=0;const read=$("mgRead");if(read)read.scrollTop=0;}
}
function width(){
  if(!el.W)el.W=el.track.clientWidth||0;
  return el.W;
}
function xOf(R,at){
  const n=R.snaps.length, W=width();
  return n<2?W-PAD:PAD+(at/(n-1))*(W-2*PAD);
}
function setX(x){
  T.x=x;
  const W=width()||1;
  el.thumb.style.transform="translateX("+x.toFixed(2)+"px)";
  el.fill.style.transform="scaleX("+Math.max(0,Math.min(1,x/W)).toFixed(4)+")";
}
/* Text goes INTO the node that is already there. Replacing the node is a
   change to the list of children, and the stylesheets hold body:has()
   rules that are matched again on every one of those — measured here, a
   third of a millisecond each against a thirtieth for writing in place.
   (The Hebrew layer watches a node's text as well as new nodes, so the
   word is still translated.) The icon is the exception: ui-icons.js swaps
   the emoji for drawn art, so there is no text node left to write into. */
function set(node,key,v){
  if(el.last[key]===v)return;
  el.last[key]=v;
  const t=node.firstChild;
  if(t&&t.nodeType===3&&!t.nextSibling)t.nodeValue=v; else node.textContent=v;
}
function attr(node,key,name,v){
  if(el.last[key]===v)return;
  el.last[key]=v;node.setAttribute(name,v);
}
/* everything the bar shows, for where it stands. `place` puts the thumb
   there outright; without it the thumb is left to whatever is moving it.
   `lite` is a run going by faster than it can be read (2x, 4x, the later
   inputs): only the count moves, and the rest is filled in when it stops. */
function paint(place,lite){
  if(!T||!build())return;
  const R=T.recs[T.view];
  if(!R)return;
  const lock=R.hidden;
  if(el.last.lock!==lock){el.last.lock=lock;el.box.classList.toggle("lock",lock);}
  if(lock)return;
  const n=R.snaps.length, at=Math.min(T.at,n-1), s=R.snaps[at];
  if(place&&!T.drag){
    const x=xOf(R,at);
    if(T.anim||x!==T.x){stopAnim();setX(x);}
  }
  set(el.num,"num",(R.base+at)+" / "+(R.base+n-1));
  if(lite){
    set(el.ic,"ic","");set(el.what,"what","");set(el.reason,"why","");
    if(el.last.bad!==false){el.last.bad=false;el.box.classList.remove("bad");}
    return;
  }
  /* the marks: only as many as can be told apart on a phone's width */
  const sig=R.bad.length+":"+n+":"+R.base+":"+width();
  if(el.last.ticks!==sig){
    el.last.ticks=sig;
    const show=R.bad.slice(0,60);
    while(el.ticks.children.length>show.length)el.ticks.lastChild.remove();
    while(el.ticks.children.length<show.length)el.ticks.appendChild(document.createElement("i"));
    show.forEach((b,i)=>{el.ticks.children[i].style.transform="translateX("+xOf(R,b-R.base).toFixed(1)+"px)";});
  }
  const def=s.t&&typeof DEFS!=="undefined"?DEFS[s.t]:null;
  set(el.ic,"ic",def?def.ic:"");
  set(el.what,"what",s.t?(def?def.lbl:""):"Start");
  set(el.reason,"why",s.bad?WHY[s.bad]:"");
  const bad=!!s.bad;
  if(el.last.bad!==bad){el.last.bad=bad;el.box.classList.toggle("bad",bad);}
  /* when the line is too long for the track, the count is what gives way:
     on a step that went wrong, why matters more than which number it was.
     Measured only when the words changed — it is a read of the layout. */
  const words=el.last.what+"|"+el.last.why+"|"+width();
  if(el.last.fit!==words){
    el.last.fit=words;
    el.cap.classList.remove("tight");
    /* the reason shrinks to fit with an ellipsis, so it is the one to ask:
       the line as a whole never overflows */
    if(s.bad&&el.reason.scrollWidth>el.reason.clientWidth+1)el.cap.classList.add("tight");
  }
  attr(el.track,"max","aria-valuemax",String(n-1));
  attr(el.track,"now","aria-valuenow",String(at));
  attr(el.track,"txt","aria-valuetext",(R.base+at)+" / "+(R.base+n-1));
  const b0=at<=0, b1=at>=n-1, nb=!R.bad.length;
  if(el.last.b0!==b0){el.last.b0=b0;el.back.disabled=b0;}
  if(el.last.b1!==b1){el.last.b1=b1;el.fwd.disabled=b1;}
  if(el.last.nb!==nb){el.last.nb=nb;el.why.classList.toggle("none",nb);el.why.disabled=nb;}
}

/* ---------------- the thumb moves ----------------
   It is dragged, so it is sprung (CLAUDE.md, "Dragged means sprung"): from
   where it is on screen, with the speed the finger left it at, and it can
   be taken hold of again on the way. The spring is the one in
   sheet-drag.js; there is no second one. */
function stopAnim(){
  if(T&&T.anim){T.anim.stop();T.anim=null;}
}
function glide(v){
  if(!T||!el)return;
  const R=T.recs[T.view];if(!R)return;
  const to=xOf(R,T.at);
  stopAnim();
  if(calm()||typeof ccSpring!=="function"||Math.abs(to-T.x)<.5){setX(to);return;}
  const me=T;
  /* a hair of give only when a hand threw it; a tap on a button just arrives */
  T.anim=ccSpring(T.x,to,v||0,x=>{if(T===me)setX(x);},()=>{if(T===me)T.anim=null;},
    {damping:Math.abs(v||0)>250?.82:1,response:.28});
}
/* The first few times a run fails, the thumb leans back and returns: the
   bar can be pulled, said without a word. It stops for good the first time
   it is used. */
function hint(){
  if(!T||T.hinted||calm()||typeof player==="undefined"||!player)return;
  if(player.tmUsed||(player.tmHint|0)>=3)return;
  const R=T.recs[T.view];
  if(!R||R.snaps.length<3)return;
  T.hinted=true;
  player.tmHint=(player.tmHint|0)+1;
  if(typeof saveSoon==="function")saveSoon();
  const me=T;
  setTimeout(()=>{
    if(T!==me||T.drag||T.anim||T.live||typeof ccSpring!=="function")return;
    const home=T.x, lean=Math.max(PAD,home-34);
    T.anim=ccSpring(home,lean,0,x=>{if(T===me)setX(x);},()=>{
      if(T!==me)return;
      T.anim=ccSpring(lean,home,0,x=>{if(T===me)setX(x);},()=>{if(T===me)T.anim=null;},{damping:.8,response:.42});
    },{damping:1,response:.3});
  },1100);
}

function wire(){
  const tr=el.track;
  /* the finger on the bar. Pressing the thumb keeps the point that was
     grabbed under the finger; pressing the rail brings the thumb to it. */
  tr.addEventListener("pointerdown",e=>{
    if(e.button||!ready())return;
    pause();stopAnim();used();
    el.W=0;
    const r=tr.getBoundingClientRect(), px=e.clientX-r.left;
    const grab=Math.abs(px-T.x)<=PAD+10?px-T.x:0;
    T.drag={id:e.pointerId,left:r.left,grab,hist:[{t:e.timeStamp,x:px}]};
    try{tr.setPointerCapture(e.pointerId);}catch(_){}
    tr.classList.add("drag");
    dragTo(px-grab);
    e.preventDefault();
  });
  tr.addEventListener("pointermove",e=>{
    const d=T&&T.drag;
    if(!d||d.id!==e.pointerId)return;
    const px=e.clientX-d.left;
    d.hist.push({t:e.timeStamp,x:px});
    while(d.hist.length>2&&e.timeStamp-d.hist[0].t>120)d.hist.shift();
    dragTo(px-d.grab);
  });
  const up=e=>{
    const d=T&&T.drag;
    if(!d||d.id!==e.pointerId)return;
    T.drag=null;
    tr.classList.remove("drag");
    /* the speed it was let go at, over the last 80ms — never the last two
       points, which can share a timestamp */
    const h=d.hist, last=h[h.length-1];
    let first=last;
    for(let i=h.length-1;i>=0;i--){if(last.t-h[i].t<=80)first=h[i];else break;}
    const dt=(last.t-first.t)/1000, v=dt>0.012?(last.x-first.x)/dt:0;
    glide(v);
  };
  tr.addEventListener("pointerup",up);
  tr.addEventListener("pointercancel",up);
  tr.addEventListener("keydown",e=>{
    const k=e.key;
    const d=k==="ArrowLeft"||k==="ArrowDown"?-1:k==="ArrowRight"||k==="ArrowUp"?1:
      k==="PageDown"?-10:k==="PageUp"?10:k==="Home"?-1e9:k==="End"?1e9:0;
    if(!d)return;
    e.preventDefault();
    step(d,true);
  });
  /* the step buttons answer on the press, and a held one keeps going */
  const hold=(btn,fn)=>{
    let t=0,iv=0;
    const halt=()=>{clearTimeout(t);clearInterval(iv);t=iv=0;};
    btn.addEventListener("pointerdown",e=>{
      if(e.button||btn.disabled)return;
      halt();fn();
      t=setTimeout(()=>{iv=setInterval(()=>{if(btn.disabled)halt();else fn();},110);},420);
    });
    for(const ev of ["pointerup","pointercancel","pointerleave"])btn.addEventListener(ev,halt);
    /* a click that no pointer made (detail 0) is a keyboard or a screen
       reader; one a pointer made was already answered on the press */
    btn.addEventListener("click",e=>{if(e.detail===0)fn();});
  };
  hold(el.back,()=>step(-1,false));
  hold(el.fwd,()=>step(1,true));
  el.why.addEventListener("click",nextBad);
  /* an input's chip puts its run on the bar */
  const cases=$("mgCases");
  if(cases){
    const pick=e=>{
      const c=e.target.closest&&e.target.closest(".casechip.tap");
      if(!c||!T||T.st!==mgState)return;
      const i=+c.dataset.ci, R=T.recs[i];
      if(!R)return;
      stopAnim();used();
      go(i,R.snaps.length-1,false);
      paint(true);
      if(typeof mgCaseStrip==="function")mgCaseStrip();
    };
    cases.addEventListener("click",pick);
    cases.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();pick(e);}});
  }
  if(typeof ResizeObserver==="function")new ResizeObserver(()=>{el.W=0;if(T&&!el.box.hidden)paint(true);}).observe(tr);
  else addEventListener("resize",()=>{el.W=0;if(T&&!el.box.hidden)paint(true);});
}
/* the thumb goes where the finger is; the board goes to the step under it */
function dragTo(x){
  const R=T.recs[T.view], n=R.snaps.length, W=width();
  x=Math.max(PAD,Math.min(W-PAD,x));
  setX(x);
  if(n<2)return;
  const span=W-2*PAD, gap=span/(n-1);
  let i=Math.round((x-PAD)/gap);
  /* on a long run a step is a pixel or two wide: a mark within reach of the
     finger is the one that was meant */
  if(gap<20&&R.bad.length){
    let best=-1,bd=10;
    for(const b of R.bad){const d=Math.abs(xOf(R,b-R.base)-x);if(d<bd){bd=d;best=b-R.base;}}
    if(best>=0)i=best;
  }
  i=Math.max(0,Math.min(n-1,i));
  if(i!==T.at)go(T.view,i,false);
}

/* ---------------- what the rest of the game calls ----------------
   Each is exported under a name of its own (tmBegin, not begin): one
   global scope, and a later `function begin(){}` anywhere would replace a
   same-named export and leave it calling itself. A fault in here must
   never stop a program running, so the three that sit inside the run drop
   the recording and carry on. */
function guard(fn){
  return function(a,b,c){
    try{return fn(a,b,c);}
    catch(e){
      try{console.warn("time machine:",e);}catch(_){}
      try{if(T&&T.live&&T.st===mgState)toLive();}catch(_){}
      T=null;
      try{uiShow(false);}catch(_){}
    }
  };
}
window.tmBegin=guard(begin);
window.tmRec=guard(rec);
window.tmEnd=guard(end);
window.tmDone=guard(done);
window.tmLive=guard(()=>{if(T&&T.live){stopAnim();toLive();paint(true);}});
window.tmReset=guard(onReset);
window.tmProg=guard(onProg);
window.tmClear=guard(()=>drop(false));
/* the run has stopped, however it stopped: say everything about where it is */
window.tmStop=guard(()=>{if(T&&T.st===mgState&&el&&!el.box.hidden)paint(!T.live);});
window.tmCase=caseClass;
/* for the suites: where the bar stands, and a way to stand it somewhere */
window.tmState=()=>{
  if(!T)return null;
  const R=T.recs[T.view];
  return {view:T.view,at:T.at,n:R?R.snaps.length:0,base:R?R.base:0,bad:R?R.bad.slice():[],
    live:!T.live,done:!!(R&&R.done),ok:R?R.ok:null,inputs:T.recs.map(r=>r?r.snaps.length:0),x:T.x};
};
/* how many steps share their walls and their bricks with the step before */
window.tmShared=()=>{
  if(!T)return null;
  const R=T.recs[T.view];if(!R)return null;
  let tiles=0,bricks=0;
  for(let i=1;i<R.snaps.length;i++){
    if(R.snaps[i].rb.tiles===R.snaps[i-1].rb.tiles)tiles++;
    if(R.snaps[i].rb.bricks===R.snaps[i-1].rb.bricks)bricks++;
  }
  return {steps:R.snaps.length,sharedTiles:tiles,sharedBricks:bricks};
};
window.tmGo=(at,ci)=>{if(ready()){stopAnim();go(ci==null?T.view:ci,at,false);paint(true);}};
window.tmStep=step;
window.tmNextBad=nextBad;
})();
