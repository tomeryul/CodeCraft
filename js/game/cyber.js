"use strict";
/* =====================================================================
   Cyber Lab — the third thing this game teaches
   ---------------------------------------------------------------------
   The Academy and the Puzzle Chapters teach programming. The Wear Maker
   teaches HTML and CSS. This teaches the one idea a child meets before
   either and is never taught: what makes a secret a secret.

   It is the same board, the same blocks and the same robot. What is new
   is a keypad-locked door and a number written where anyone can read it,
   and a counter that says out loud how many codes have been tried. Every
   level is one idea, and the idea arrives as a thing that happens rather
   than as a sentence:

     Ten Codes          a loop opens a one-digit lock in ten tries
     One More Digit     the same loop needs a hundred
     On a Sticky Note   the code was written beside the door
     With a Key         the note is useless until you add the key
     Never Trust a Note the note by the door was lying

   Nothing here is an attack: a keypad in a cartoon has no lock to pick.
   What a child takes away is why their own password should be long, why a
   password does not belong in the code, and why a program that believes
   whatever it is handed is a program somebody else is driving.

   Bolted on the way Tower Mode is — two tile types, one block, one action
   hook — so nothing above it has to know this file exists.
   ===================================================================== */
(function(){
if(typeof window==="undefined"||typeof mgState==="undefined")return;
if(window.__cyber)return;
/* the board, its tiles and its runner are what this rides on */
if(!window.CC_TILES||typeof window.mgEnter!=="function"){
  console.warn("cyber.js: the challenge board is not loaded — Cyber Lab disabled.");
  return;
}
window.__cyber=1;

const K=(x,y)=>x+"_"+y;

/* ---------------- the two tiles ----------------
   A keypad is a door whose key is a number rather than a colour. It stays
   solid until the right number has been punched into it, and then it is
   open for good — the same promise CC_TILES makes about a door and its
   key, so "is this door open?" stays one question with one answer. */
CC_TILES.DEFS.lock={
  em:"🔢", lbl:"Keypad", arg:"num",
  solid:(rs,k)=>!(rs.cracked&&rs.cracked.has(k)),
  draw:(g,px,py,cell,t,rs,k)=>drawLock(g,px,py,cell,!!(rs.cracked&&rs.cracked.has(k)))
};
/* A note is a number somebody wrote down. The robot reads it with the
   block it already has — 🧠 Read "number ahead" — because that is what a
   note is: a number in front of you. */
CC_TILES.DEFS.note={
  em:"📝", lbl:"Note", arg:"num",
  solid:()=>false,
  draw:(g,px,py,cell,t)=>drawNote(g,px,py,cell,t.a|0)
};

/* ---------------- art ---------------- */
function rr(g,x,y,w,h,r){
  r=Math.min(r,w/2,h/2);
  g.beginPath();
  g.moveTo(x+r,y);g.lineTo(x+w-r,y);g.quadraticCurveTo(x+w,y,x+w,y+r);
  g.lineTo(x+w,y+h-r);g.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  g.lineTo(x+r,y+h);g.quadraticCurveTo(x,y+h,x,y+h-r);
  g.lineTo(x,y+r);g.quadraticCurveTo(x,y,x+r,y);
  g.closePath();
}
function drawLock(g,px,py,cell,open){
  const p=cell*.08;
  /* the frame is the same slab a wall is, so a keypad reads as a way
     THROUGH a wall rather than as a thing standing in a field */
  g.fillStyle=open?"#3b5a43":"#4a4258";
  rr(g,px+p,py+p,cell-p*2,cell-p*2,cell*.13);g.fill();
  const bx=px+cell*.26, by=py+cell*.2, bw=cell*.48, bh=cell*.6;
  g.fillStyle=open?"#1d3326":"#241b45";
  rr(g,bx,by,bw,bh,cell*.09);g.fill();
  /* nine keys and a screen: a keypad is recognisable by its grid */
  g.fillStyle=open?"#8ff0a0":"#ffd66b";
  rr(g,bx+bw*.14,by+bh*.1,bw*.72,bh*.18,cell*.03);g.fill();
  g.fillStyle=open?"rgba(143,240,160,.75)":"rgba(255,255,255,.5)";
  for(let r0=0;r0<3;r0++)for(let c=0;c<3;c++){
    const s=bw*.15;
    g.beginPath();
    g.arc(bx+bw*.26+c*bw*.24, by+bh*.45+r0*bh*.19, s*.42, 0, 7);
    g.fill();
  }
  if(open){
    g.strokeStyle="#8ff0a0";g.lineWidth=Math.max(2,cell*.07);
    g.lineCap="round";g.lineJoin="round";
    g.beginPath();
    g.moveTo(px+cell*.3,py+cell*.52);g.lineTo(px+cell*.44,py+cell*.66);g.lineTo(px+cell*.72,py+cell*.34);
    g.stroke();
  }
}
function drawNote(g,px,py,cell,n){
  const w=cell*.66, h=cell*.62, x=px+(cell-w)/2, y=py+(cell-h)/2;
  g.save();
  g.translate(x+w/2,y+h/2);g.rotate(-.06);g.translate(-x-w/2,-y-h/2);
  g.fillStyle="rgba(0,0,0,.22)";rr(g,x+cell*.03,y+cell*.04,w,h,cell*.06);g.fill();
  g.fillStyle="#ffe9a8";rr(g,x,y,w,h,cell*.06);g.fill();
  g.fillStyle="#8a6d1f";
  g.font="700 "+Math.round(h*.52)+"px ui-monospace,Menlo,Consolas,monospace";
  g.textAlign="center";g.textBaseline="middle";
  g.fillText(String(n),x+w/2,y+h*.55);
  g.restore();
}

/* ---------------- the run ----------------
   cracked: which keypads have been opened. tries: how many codes have
   been punched in, which is the whole teaching instrument — a child who
   watches it read 7, then 42, has been told what a digit costs without
   anyone saying it. */
const _mgSeed=window.mgSeed;
window.mgSeed=function(rs,proj){
  _mgSeed(rs,proj);
  rs.cracked=new Set();
  rs.tries=0;
};

const onCy=()=>!!(mgState&&mgState.proj&&mgState.proj.cyber);
window.onCy=onCy;

/* the keypad in front of the robot, if there is one */
function lockAhead(rb){
  const k=K(rb.x+DX[rb.dir],rb.y+DY[rb.dir]);
  const t=CC_TILES.at(rb,k);
  return (t&&t.t==="lock")?{k,t}:null;
}
/* 🔢 Try Code. Returns true when it handled the block, which is what
   keeps it out of the way of every other level in the game. */
window.CCAct=function(st,b){
  if(b.t!=="tryCode")return false;
  /* two objects, and they are not the same one: st.robot is where the
     robot IS — its tiles, its bricks, its keypads — and mgRobot is the
     program that moves it, which is where a variable lives. */
  const rb=st.robot, L=lockAhead(rb);
  const n=Number(resolveVal(mgRobot,b.val))||0;
  rb.tries=(rb.tries|0)+1;
  if(!L){ sfx(180,.05); return true; }            // nothing to punch into
  if(rb.cracked.has(L.k)){ return true; }         // already open
  if((L.t.a|0)===n){
    rb.cracked.add(L.k);
    sfx(880,.06);sfx(1240,.07,.06);
  }else sfx(200,.05);
  return true;
};

/* A note is a number in front of you, so the block that reads a number in
   front of you reads it. Wrapping rather than editing mgReadSrc keeps the
   flat board's own answer — the number on a brick — exactly as it was. */
const _mgReadSrc=window.mgReadSrc;
window.mgReadSrc=function(st,src){
  if(src==="ahead"||src==="here"){
    const rb=st.robot;
    const k=src==="ahead"?K(rb.x+DX[rb.dir],rb.y+DY[rb.dir]):K(rb.x,rb.y);
    const t=CC_TILES.at(rb,k);
    if(t&&t.t==="note")return t.a|0;
  }
  return _mgReadSrc(st,src);
};

/* ---------------- the counter, under the board ----------------
   The strip is the lesson: ten tries and a hundred tries look different,
   and nothing else on the screen would ever say so. */
function bar(on){
  let el=$("cyBar");
  if(!on){ if(el)el.remove(); return; }
  if(!el){
    el=document.createElement("div");el.id="cyBar";el.className="t3bar";
    el.innerHTML='<span class="t3tag">🔐 Cyber</span>'+
      '<span class="t3h">🔢 codes tried <b id="cyTries">0</b></span>'+
      '<span class="spacer"></span>'+
      '<span class="t3key" id="cyLocks"></span>';
    const cv=$("mgCanvas");
    if(cv&&cv.parentNode)cv.parentNode.insertBefore(el,cv.nextSibling);
  }
  const rb=mgState&&mgState.robot;
  const t=$("cyTries");
  if(t&&rb){const v=String(rb.tries|0); if(t.textContent!==v)t.textContent=v;}
  const ls=$("cyLocks");
  if(ls&&rb&&rb.tiles){
    let total=0,open=0;
    for(const [k,q] of rb.tiles)if(q.t==="lock"){total++;if(rb.cracked.has(k))open++;}
    const txt=total?(open+"/"+total+" open"):"";
    if(ls.textContent!==txt)ls.textContent=txt;
  }
}
const _mgDraw=window.mgDraw;
window.mgDraw=function(){ const r=_mgDraw.apply(this,arguments); if(onCy())bar(true); return r; };
const _mgExit=window.mgExit;
window.mgExit=function(reopen){ bar(false); return _mgExit(reopen); };

/* ---------------- the levels ---------------- */
const CY_BLOCKS=["move","turnL","turnR","tryCode","repeat","countLoop","whileLoop","if","setVar","changeVar","read","wait"];
const LEVELS=[
  /* Every board is the same shape: the robot, a keypad in a wall, and the
     flag on the far side. What changes between levels is only what the
     robot has to know to get through, which is the point. */
  {id:"cy_ten", em:"🔓", name:"Ten Codes", diff:1, coins:120, xp:50,
   maxBlocks:6, gw:5, gh:3, start:{x:1,y:1,dir:1}, goal:[4,1],
   tiles:[[2,0,"wall"],[2,2,"wall"],[2,1,"lock",7]],
   desc:"🔐 A keypad with a ONE-digit code stands between you and the 🚩 flag. You do not know the code — so try every one of them. 🔁 Count to 10, 🔢 Try Code the counter each time, then walk through.",
   why:"A one-digit code has ten possibilities, and a loop went through all ten before you could blink. A real computer does it millions of times faster. That is the whole reason a short secret is not a secret."},

  {id:"cy_two", em:"🔢", name:"One More Digit", diff:1, coins:150, xp:60, needs:"cy_ten",
   maxBlocks:6, gw:5, gh:3, start:{x:1,y:1,dir:1}, goal:[4,1],
   tiles:[[2,0,"wall"],[2,2,"wall"],[2,1,"lock",42]],
   desc:"🔐 The same keypad — but the code has TWO digits now. The same idea needs a bigger loop. Watch 🔢 codes tried under the board as it runs.",
   why:"One more digit turned ten guesses into a hundred. Every digit you add multiplies the work by ten, so eight digits is a hundred million. That is why a long password is a strong one — not because it is clever, because it is long."},

  {id:"cy_note", em:"📝", name:"On a Sticky Note", diff:2, coins:180, xp:70, needs:"cy_two",
   maxBlocks:7, gw:7, gh:3, start:{x:1,y:1,dir:1}, goal:[6,1],
   tiles:[[3,0,"wall"],[3,2,"wall"],[3,1,"lock",58],[2,1,"note",58]],
   desc:"🔐 This code is far too big to guess. But somebody left a 📝 note on the floor in front of the door. 🧠 Read the “number ahead” into a box, then 🔢 Try Code that box.",
   why:"Nobody guessed this code: it was written down next to the door it opens. Programs do exactly this — a password typed into the code itself, or left in a file that ships with the app. A secret anybody can read is not a secret, however long it is."},

  {id:"cy_shift", em:"🔑", name:"With a Key", diff:2, coins:220, xp:85, needs:"cy_note",
   maxBlocks:8, gw:7, gh:3, start:{x:1,y:1,dir:1}, goal:[6,1],
   tiles:[[3,0,"wall"],[3,2,"wall"],[3,1,"lock",61],[2,1,"note",58]],
   desc:"🔐 The 📝 note is scrambled this time: the real code is the number on it PLUS 3. Three is the key. 🧠 Read the note, ➕ Change it by 3, then 🔢 Try Code it.",
   why:"The note by itself was useless — it needed the key (+3) before it meant anything. That is encryption: a message anybody may see, that only the key turns back into the secret. Real keys are far bigger than 3, but the shape is exactly this."},

  {id:"cy_trust", em:"🚨", name:"Never Trust a Note", diff:3, coins:280, xp:110, needs:"cy_shift",
   maxBlocks:14, gw:6, gh:4, start:{x:1,y:2,dir:1}, goal:[5,2],
   tiles:[[3,1,"wall"],[3,3,"wall"],[3,2,"lock",88],
          [2,2,"note",5],[2,0,"note",88],[4,0,"wall"],[5,0,"wall"]],
   desc:"🔐 TWO 📝 notes, and only one of them is telling the truth. The one lying on the floor right by the door says 5. The other is up along the top of the room. Try the wrong one and the door simply does not care.",
   why:"The note by the door said 5, and the door did not open. Anything handed to a program can be wrong — by mistake, or as a lie, from somebody who wants in. That is the rule underneath most of security: check what you are given before you act on it. A program that believes whatever it is handed is a program somebody else is driving."}
];

function unlocked(lv){
  if(!lv.needs)return true;
  return !!player.projects[lv.needs];
}
function enter(lv){
  const p=JSON.parse(JSON.stringify(lv));
  p.cyber=true;
  p.goalType="reach";
  p.allowed=CY_BLOCKS;
  p.cells=[];p.initial=[];
  mgEnter(p);
  bar(true);
}

/* The idea IS the reward, so it goes on the card the player already stops
   to read. Everything else about finishing a level — the coins, the save,
   the thing that appears next to your house — is left exactly as it is:
   the celebration's words are borrowed for one call and handed straight
   back, so nothing downstream knows this happened. */
const _mgSuccess=window.mgSuccess;
window.mgSuccess=function(){
  const p=mgState&&mgState.proj;
  if(!(p&&p.cyber&&p.why))return _mgSuccess.apply(this,arguments);
  const X=window.CC_EXTRAS, _c=X&&X.celebrate;
  if(_c)X.celebrate=function(){ return _c.call(X,"🔐","LOCK OPENED!",p.name,p.why,"Got it! 🎉"); };
  try{ return _mgSuccess.apply(this,arguments); }
  finally{ if(_c)X.celebrate=_c; }
};

/* ---------------- its own band in the projects sheet ---------------- */
const _renderProjects=window.renderProjects;
window.renderProjects=function(){
  _renderProjects();
  const el=$("projList"); if(!el)return;
  const done=LEVELS.filter(l=>player.projects[l.id]).length;
  const sec=document.createElement("div");sec.className="t3sec cy-sec";
  sec.innerHTML='<div class="t3head"><div class="t3ico cy-ico">🔐</div>'+
    '<div><div class="t3title">Cyber Lab</div>'+
    /* not the page header's own line again: that one names the section,
       this one says what the five levels do — the shape Tower Mode uses */
    '<div class="t3sub">Locks to open, notes that lie — and why a long password is a strong one.</div></div>'+
    '<div class="t3prog">'+done+'/'+LEVELS.length+'</div></div>'+
    '<div class="t3grid"></div>';
  const grid=sec.querySelector(".t3grid");
  for(const lv of LEVELS){
    const solved=!!player.projects[lv.id], open=unlocked(lv);
    const c=document.createElement("button");
    c.className="t3card cy-card"+(solved?" done":"")+(open?"":" locked");
    c.innerHTML='<span class="t3badge">'+lv.em+'</span>'+
      '<span class="t3name">'+esc(lv.name)+'</span>'+
      '<span class="t3meta">'+"⭐".repeat(lv.diff)+' · 🧩 '+lv.maxBlocks+'</span>'+
      (solved?'<span class="t3done">✓</span>':"");
    if(open)c.onclick=()=>{$("projects").classList.remove("open");enter(lv);};
    else{
      /* a locked card says what opens it, rather than doing nothing */
      c.onclick=()=>toast("🔒 Finish “"+levelName(lv.needs)+"” first.");
    }
    grid.appendChild(c);
  }
  el.insertBefore(sec,el.firstChild);
};
function levelName(id){const l=LEVELS.find(x=>x.id===id);return l?l.name:id;}

window.CC_CYBER={levels:LEVELS,enter:enter,blocks:CY_BLOCKS};
})();
