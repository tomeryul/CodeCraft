"use strict";
/* =====================================================================
   Cyber Lab — the third thing this game teaches
   ---------------------------------------------------------------------
   The Academy and the Puzzle Chapters teach programming. The Wear Maker
   teaches HTML and CSS. This teaches the one idea a child meets before
   either and is never taught: what makes a secret a secret.

   It is the same board, the same blocks and the same robot. What is new
   is a keypad-locked door, a number written where anyone can read it, and
   a counter that says out loud how many codes have been tried. Eleven
   levels in three acts, and every idea arrives as a thing that happens
   rather than as a sentence:

     I. Secrets — what one is, and what breaks one
        Ten Codes           a loop opens a one-digit lock in ten tries
        One More Digit      the same loop needs a hundred
        On a Sticky Note    the code was written beside the door
        With a Key          the note is useless until you add the key

     II. Locks that fight back — what a good lock does about all that
        Three Strikes       the keypad jams, and guessing starts costing
        Two Kinds of Proof  a code you know AND a key you carry
        The Open Window     nobody picks a lock with a hole beside it

     III. Never trust what you are told — the program's own side
        Never Trust a Note  the note by the door was lying
        Never the Same Twice the secret is different every time
        The Lookalike       one of the two notes is a forgery
        Who Went Through    the door's log, and the entry that stands out

   Nothing here is an attack: a keypad in a cartoon has no lock to pick.
   What a child takes away is why their own password should be long, why a
   password does not belong in the code, why a program that believes
   whatever it is handed is a program somebody else is driving — and, on
   the hard levels, that a rule which only works on the board you have
   already seen is not a rule at all.

   That last one is why the hard levels ship several inputs, one of them
   hidden: a program that remembers THIS code passes the board in front of
   it and fails the next. For a security lesson that is not a technicality,
   it is the entire point.

   Bolted on the way Tower Mode is — tiles, one block, one action hook and
   one sensor hook — so nothing above it has to know this file exists.
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

/* ---------------- the tiles ----------------
   A keypad is a door whose key is a number rather than a colour. It stays
   solid until the right number has been punched into it, and then it is
   open for good — the same promise CC_TILES makes about a door and its
   key, so "is this door open?" stays one question with one answer. */
CC_TILES.DEFS.lock={
  em:"🔢", lbl:"Keypad", arg:"num",
  solid:(rs,k)=>!(rs.cracked&&rs.cracked.has(k)),
  draw:(g,px,py,cell,t,rs,k)=>drawLock(g,px,py,cell,!!(rs.cracked&&rs.cracked.has(k)),false)
};
/* The same keypad, with a keyhole beside the pad: the code alone does not
   open it. Two proofs of two different kinds — one you know, one you
   carry — which is the whole of two-factor, and it is one tile rather than
   two doors in a row, because two doors in a row is not two factors. */
CC_TILES.DEFS.lockk={
  em:"🔐", lbl:"Keypad + Key", arg:"num",
  solid:(rs,k)=>!(rs.cracked&&rs.cracked.has(k)&&rs.keys&&rs.keys.size>0),
  draw:(g,px,py,cell,t,rs,k)=>drawLock(g,px,py,cell,
    !!(rs.cracked&&rs.cracked.has(k)&&rs.keys&&rs.keys.size>0),true)
};
/* A note is a number somebody wrote down. The robot reads it with the
   block it already has — 🧠 Read "number ahead" — because that is what a
   note is: a number in front of you. */
CC_TILES.DEFS.note={
  em:"📝", lbl:"Note", arg:"num",
  solid:()=>false,
  draw:(g,px,py,cell,t)=>drawNote(g,px,py,cell,t.a|0,false)
};
/* The same note with a wax seal on it. Nothing about the NUMBER is
   different — a forgery copies the number's shape perfectly. What the seal
   says is who wrote it, and that is the only thing a forger cannot copy.
   Checking the seal instead of the message is what "look at the sender"
   means, in the one form a robot on a grid can actually do. */
CC_TILES.DEFS.snote={
  em:"🔏", lbl:"Sealed note", arg:"num",
  solid:()=>false,
  draw:(g,px,py,cell,t)=>drawNote(g,px,py,cell,t.a|0,true)
};
const isNote=t=>!!(t&&(t.t==="note"||t.t==="snote"));
const isLock=t=>!!(t&&(t.t==="lock"||t.t==="lockk"));

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
function drawLock(g,px,py,cell,open,needsKey){
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
  /* The second factor, as a badge in the corner: a keyhole on a disc of
     its own. It was drawn small and flush against the pad first and simply
     could not be seen at the size a phone renders a tile — and a level
     whose whole point is "this one wants a key as well" cannot afford a
     detail the player has to be told about. */
  if(needsKey){
    const kx=px+cell*.22, ky=py+cell*.27, R=cell*.16;
    g.fillStyle=open?"#1d3326":"#161022";
    g.beginPath();g.arc(kx,ky,R,0,7);g.fill();
    g.strokeStyle=open?"#8ff0a0":"#ffd66b";g.lineWidth=Math.max(1.2,cell*.025);
    g.beginPath();g.arc(kx,ky,R,0,7);g.stroke();
    const r0=R*.34;
    g.fillStyle=open?"#8ff0a0":"#ffd66b";
    g.beginPath();g.arc(kx,ky-R*.18,r0,0,7);g.fill();
    g.beginPath();
    g.moveTo(kx-r0*.62,ky-R*.18+r0*.5);g.lineTo(kx+r0*.62,ky-R*.18+r0*.5);
    g.lineTo(kx+r0*.34,ky+R*.62);g.lineTo(kx-r0*.34,ky+R*.62);
    g.closePath();g.fill();
  }
  if(open){
    g.strokeStyle="#8ff0a0";g.lineWidth=Math.max(2,cell*.07);
    g.lineCap="round";g.lineJoin="round";
    g.beginPath();
    g.moveTo(px+cell*.3,py+cell*.52);g.lineTo(px+cell*.44,py+cell*.66);g.lineTo(px+cell*.72,py+cell*.34);
    g.stroke();
  }
}
function drawNote(g,px,py,cell,n,sealed){
  const w=cell*.66, h=cell*.62, x=px+(cell-w)/2, y=py+(cell-h)/2;
  g.save();
  g.translate(x+w/2,y+h/2);g.rotate(-.06);g.translate(-x-w/2,-y-h/2);
  g.fillStyle="rgba(0,0,0,.22)";rr(g,x+cell*.03,y+cell*.04,w,h,cell*.06);g.fill();
  g.fillStyle=sealed?"#fff3d0":"#ffe9a8";rr(g,x,y,w,h,cell*.06);g.fill();
  g.fillStyle="#8a6d1f";
  g.font="700 "+Math.round(h*.52)+"px ui-monospace,Menlo,Consolas,monospace";
  g.textAlign="center";g.textBaseline="middle";
  g.fillText(String(n),x+w/2,y+h*.55);
  /* a red wax blob in the corner. Deliberately loud: the whole level turns
     on whether a child can see, at a glance, which of two notes has it. */
  if(sealed){
    const cx=x+w*.82, cy=y+h*.2, r0=Math.max(2.5,cell*.1);
    g.fillStyle="#c0243a";g.beginPath();g.arc(cx,cy,r0,0,7);g.fill();
    g.fillStyle="rgba(255,255,255,.55)";
    g.beginPath();g.arc(cx-r0*.28,cy-r0*.28,r0*.3,0,7);g.fill();
  }
  g.restore();
}

/* ---------------- the run ----------------
   cracked: which keypads have been opened. tries: how many codes have been
   punched in, which is the whole teaching instrument — a child who watches
   it read 7, then 42, has been told what a digit costs without anyone
   saying it. strikes/jam: how a keypad that is paying attention answers a
   loop that is guessing. */
const _mgSeed=window.mgSeed;
window.mgSeed=function(rs,proj){
  _mgSeed(rs,proj);
  rs.cracked=new Set();
  rs.tries=0; rs.strikes=0; rs.jam=0;
};

const onCy=()=>!!(mgState&&mgState.proj&&mgState.proj.cyber);
window.onCy=onCy;

/* the keypad in front of the robot, if there is one */
function lockAhead(rb){
  const k=K(rb.x+DX[rb.dir],rb.y+DY[rb.dir]);
  const t=CC_TILES.at(rb,k);
  return isLock(t)?{k,t}:null;
}
/* 🔢 Try Code, and the one other thing this file watches for. Returning
   true means "handled", which is what keeps it out of the way of every
   other level in the game; a ⏱ Wait is only OBSERVED on the way past and
   still returns false, so the runner's own wait does its normal job. */
window.CCAct=function(st,b){
  const rb=st.robot;
  /* a jammed keypad is waiting for you to stop hammering it, so the block
     that does nothing is the block that clears it */
  if(b.t==="wait"&&rb&&rb.jam){ rb.jam=0; rb.strikes=0; sfx(520,.05); }
  if(b.t!=="tryCode")return false;
  /* two objects, and they are not the same one: st.robot is where the
     robot IS — its tiles, its bricks, its keypads — and mgRobot is the
     program that moves it, which is where a variable lives. */
  const L=lockAhead(rb);
  const n=Number(resolveVal(mgRobot,b.val))||0;
  if(rb.jam){ sfx(150,.12); return true; }        // still locked out: not even a try
  rb.tries=(rb.tries|0)+1;
  if(!L){ sfx(180,.05); return true; }            // nothing to punch into
  if(rb.cracked.has(L.k)){ return true; }         // already open
  if((L.t.a|0)===n){
    rb.cracked.add(L.k); rb.strikes=0;
    sfx(880,.06);sfx(1240,.07,.06);
    return true;
  }
  sfx(200,.05);
  /* strikes is what turns "ten guesses is nothing" into "ten guesses costs
     you something". A level that does not set it behaves exactly as the
     first four do, so the lesson arrives in one place and stays there. */
  const max=st.proj.strikes|0;
  if(max>0&&++rb.strikes>=max){ rb.strikes=0; rb.jam=1; sfx(140,.16); }
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
    if(isNote(t))return t.a|0;
  }
  return _mgReadSrc(st,src);
};

/* ---------------- two sensors ----------------
   Both answer false everywhere else, so no level outside this file can
   see them, and mgCondList only OFFERS one when the board in front of the
   player could actually make it true. */
const _mgCond=window.mgCond;
window.mgCond=function(st,c){
  if(c==="jammed")return !!(st.robot&&st.robot.jam);
  if(c==="sealAhead"){
    const rb=st.robot, t=CC_TILES.at(rb,K(rb.x+DX[rb.dir],rb.y+DY[rb.dir]));
    return !!(t&&t.t==="snote");
  }
  return _mgCond(st,c);
};
const _mgCondList=window.mgCondList;
window.mgCondList=function(){
  const L=_mgCondList();
  if(!onCy())return L;
  const p=mgState.proj, has=ty=>(p.tiles||[]).some(t=>t[2]===ty);
  if((p.strikes|0)>0)L.push("jammed");
  if(has("snote"))L.push("sealAhead");
  return L;
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
      '<span class="cy-jam" id="cyJam" hidden>⛔ jammed</span>'+
      '<span class="spacer"></span>'+
      '<span class="t3key" id="cyLocks"></span>';
    const cv=$("mgCanvas");
    if(cv&&cv.parentNode)cv.parentNode.insertBefore(el,cv.nextSibling);
  }
  const rb=mgState&&mgState.robot;
  const t=$("cyTries");
  if(t&&rb){const v=String(rb.tries|0); if(t.textContent!==v)t.textContent=v;}
  /* hidden, not removed: a pill that comes and goes mid-run must not
     reflow the strip under the player's eyes */
  const j=$("cyJam");
  if(j){const want=!(rb&&rb.jam); if(j.hidden!==want)j.hidden=want;}
  const ls=$("cyLocks");
  if(ls&&rb&&rb.tiles){
    let total=0,open=0;
    for(const [k,q] of rb.tiles)if(isLock(q)){total++;if(rb.cracked.has(k))open++;}
    const txt=total?(open+"/"+total+" open"):"";
    if(ls.textContent!==txt)ls.textContent=txt;
  }
}
const _mgDraw=window.mgDraw;
window.mgDraw=function(){ const r=_mgDraw.apply(this,arguments); if(onCy())bar(true); return r; };
const _mgExit=window.mgExit;
window.mgExit=function(reopen){ bar(false); return _mgExit(reopen); };

/* ---------------- the levels ----------------
   Every board is the same shape: the robot, a keypad in a wall, and the
   flag on the far side. What changes between levels is only what the robot
   has to KNOW to get through, which is the point.

   From act III on, a level ships several inputs and one of them is hidden.
   That is not decoration. A program that remembers the code passes the
   board it is looking at and fails the next one, and "it worked on my
   board" is exactly the mistake the whole subject is about. */
const CY_BLOCKS=["move","turnL","turnR","tryCode","repeat","countLoop","whileLoop","if","setVar","changeVar","read","wait"];

/* the three acts, in the order they are played */
const ACTS=[
  {id:"secrets", name:"I · Secrets",
   sub:"What a secret is, and what breaks one."},
  {id:"locks",   name:"II · Locks that fight back",
   sub:"What a lock worth the name does about all that."},
  {id:"trust",   name:"III · Never trust what you are told",
   sub:"The program's own side of it — and the hard ones."}
];

/* a corridor board: wall above and below the keypad, flag on the far side */
const wallsAt=x=>[[x,0,"wall"],[x,2,"wall"]];

const LEVELS=[
  /* ===================== I. Secrets ===================== */
  {id:"cy_ten", act:"secrets", em:"🔓", name:"Ten Codes", diff:1, coins:120, xp:50,
   maxBlocks:6, gw:5, gh:3, start:{x:1,y:1,dir:1}, goal:[4,1],
   tiles:[...wallsAt(2),[2,1,"lock",7]],
   desc:"🔐 A keypad with a ONE-digit code stands between you and the 🚩 flag. You do not know the code — so try every one of them. 🔁 Count to 10, 🔢 Try Code the counter each time, then walk through.",
   why:"A one-digit code has ten possibilities, and a loop went through all ten before you could blink. A real computer does it millions of times faster. That is the whole reason a short secret is not a secret."},

  {id:"cy_two", act:"secrets", em:"🔢", name:"One More Digit", diff:1, coins:150, xp:60, needs:"cy_ten",
   maxBlocks:6, gw:5, gh:3, start:{x:1,y:1,dir:1}, goal:[4,1],
   tiles:[...wallsAt(2),[2,1,"lock",42]],
   desc:"🔐 The same keypad — but the code has TWO digits now. The same idea needs a bigger loop. Watch 🔢 codes tried under the board as it runs.",
   why:"One more digit turned ten guesses into a hundred. Every digit you add multiplies the work by ten, so eight digits is a hundred million. That is why a long password is a strong one — not because it is clever, because it is long."},

  {id:"cy_note", act:"secrets", em:"📝", name:"On a Sticky Note", diff:2, coins:180, xp:70, needs:"cy_two",
   maxBlocks:7, gw:7, gh:3, start:{x:1,y:1,dir:1}, goal:[6,1],
   tiles:[...wallsAt(3),[3,1,"lock",58],[2,1,"note",58]],
   desc:"🔐 This code is far too big to guess. But somebody left a 📝 note on the floor in front of the door. 🧠 Read the “number ahead” into a box, then 🔢 Try Code that box.",
   why:"Nobody guessed this code: it was written down next to the door it opens. Programs do exactly this — a password typed into the code itself, or left in a file that ships with the app. A secret anybody can read is not a secret, however long it is."},

  {id:"cy_shift", act:"secrets", em:"🔑", name:"With a Key", diff:2, coins:220, xp:85, needs:"cy_note",
   maxBlocks:8, gw:7, gh:3, start:{x:1,y:1,dir:1}, goal:[6,1],
   tiles:[...wallsAt(3),[3,1,"lock",61],[2,1,"note",58]],
   desc:"🔐 The 📝 note is scrambled this time: the real code is the number on it PLUS 3. Three is the key. 🧠 Read the note, ➕ Change it by 3, then 🔢 Try Code it.",
   why:"The note by itself was useless — it needed the key (+3) before it meant anything. That is encryption: a message anybody may see, that only the key turns back into the secret. Real keys are far bigger than 3, but the shape is exactly this."},

  /* ================ II. Locks that fight back ================ */
  /* The answer to act I, and the first level where the program that won
     level 1 loses. Three wrong codes and the keypad stops listening; ⏱
     Wait is the only thing that talks it round. */
  {id:"cy_jam", act:"locks", em:"⛔", name:"Three Strikes", diff:2, coins:240, xp:95, needs:"cy_shift",
   maxBlocks:8, gw:6, gh:3, start:{x:2,y:1,dir:1}, goal:[5,1],
   strikes:3,
   tiles:[...wallsAt(3),[3,1,"lock",9]],
   desc:"🔐 One digit again — but this keypad COUNTS. Three wrong codes and it jams: every code after that is refused until you ⏱ Wait for it to cool down. Put ❓ If ⛔ jammed → ⏱ Wait at the top of your loop.",
   why:"Nothing about the code got harder — the lock just stopped being polite. Three guesses and it makes you wait, so a million guesses would take years instead of a second. That is why a real login locks you out, and it is the cheapest defence there is."},

  /* Two proofs of two different kinds, on ONE door — because two doors in
     a row is not two factors, it is two locks. */
  {id:"cy_2fa", act:"locks", em:"🗝️", name:"Two Kinds of Proof", diff:2, coins:260, xp:105, needs:"cy_jam",
   maxBlocks:13, gw:6, gh:3, start:{x:1,y:1,dir:1}, goal:[5,1],
   strikes:3,
   tiles:[...wallsAt(3),[3,1,"lockk",44],[2,1,"note",44],[0,1,"key",0]],
   desc:"🔐 This keypad has a keyhole beside it: the right code is not enough on its own. The 📝 note ahead has the code, and the 🔑 key is behind you. It jams after three wrong codes, like the last one — so read the note, go back for the key, then come and 🔢 Try Code.",
   why:"Two proofs, and they are different KINDS of proof: a code is something you know, a key is something you have. Steal one and you still have nothing. That is what the second step on your parents' phone is doing — and it is why it is worth the extra three seconds."},

  /* The joke level, and the one people remember. The keypad is enormous
     and completely irrelevant. */
  {id:"cy_hole", act:"locks", em:"🪟", name:"The Open Window", diff:2, coins:280, xp:110, needs:"cy_2fa",
   maxBlocks:10, gw:7, gh:4, start:{x:0,y:2,dir:1}, goal:[6,2],
   tiles:[[3,1,"wall"],[3,3,"wall"],[3,2,"lock",4821]],
   desc:"🔐 A FOUR-digit code — ten thousand possibilities, and ten blocks to do it in. Do not even start. Walk the whole wall first and look at it properly: something about this room is not like the others.",
   why:"The code was perfect and it did not matter, because nobody left the wall finished. Real break-ins look like this far more often than they look like guessing: the forgotten window, the account nobody switched off, the page that was never meant to be public. A lock is only as good as the wall it is in."},

  /* ============ III. Never trust what you are told ============ */
  {id:"cy_trust", act:"trust", em:"🚨", name:"Never Trust a Note", diff:3, coins:300, xp:120, needs:"cy_hole",
   maxBlocks:14, gw:6, gh:4, start:{x:1,y:2,dir:1}, goal:[5,2],
   strikes:3,
   tiles:[[3,1,"wall"],[3,3,"wall"],[3,2,"lock",88],
          [2,2,"note",5],[2,0,"note",88],[4,0,"wall"],[5,0,"wall"]],
   desc:"🔐 TWO 📝 notes, and only one of them is telling the truth. The one lying on the floor right by the door says 5. The other is up along the top of the room. Try the wrong one and the door simply does not care — and after three wrong codes it stops listening altogether.",
   why:"The note by the door said 5, and the door did not open. Anything handed to a program can be wrong — by mistake, or as a lie, from somebody who wants in. That is the rule underneath most of security: check what you are given before you act on it. A program that believes whatever it is handed is a program somebody else is driving."},

  /* The first level with inputs. The program is the SAME seven blocks as
     On a Sticky Note; what is new is that it has to survive a code it has
     never seen, including one the player is never shown. */
  {id:"cy_otp", act:"trust", em:"🎲", name:"Never the Same Twice", diff:3, coins:340, xp:140, needs:"cy_trust",
   maxBlocks:7, gw:7, gh:3, start:{x:1,y:1,dir:1}, goal:[6,1],
   strikes:1,
   tiles:[...wallsAt(4),[4,1,"lock",31],[2,1,"note",31]],
   desc:"🔐 FOUR different doors, one program, and the code is different behind every one of them — including a 🙈 secret door you never get to look at. These keypads jam on the FIRST wrong code, so guessing is over. Writing the number into your program will pass the first door and fail the rest — 🧠 Read it, every single time.",
   cases:[
     {tiles:[...wallsAt(4),[4,1,"lock",31],[2,1,"note",31]]},
     {tiles:[...wallsAt(4),[4,1,"lock",68],[2,1,"note",68]]},
     {tiles:[...wallsAt(4),[4,1,"lock",95],[2,1,"note",95]]},
     {tiles:[...wallsAt(4),[4,1,"lock",47],[2,1,"note",47]],hidden:true}],
   why:"Your program never knew the code and opened every door anyway — because it asked instead of remembering. That is a one-time code: the six digits your parents' phone shows for thirty seconds and then throws away. A secret that is different every time cannot be stolen once and used forever."},

  /* Phishing. The forged note's NUMBER is a near-perfect copy; the one
     thing a forger cannot copy is who wrote it. */
  {id:"cy_phish", act:"trust", em:"🎣", name:"The Lookalike", diff:3, coins:380, xp:160, needs:"cy_otp",
   maxBlocks:10, gw:7, gh:3, start:{x:0,y:1,dir:1}, goal:[6,1],
   strikes:1,
   tiles:[...wallsAt(4),[4,1,"lock",58],[1,1,"snote",58],[2,1,"note",53]],
   desc:"🔐 Two notes on the floor, and their numbers look almost the same. Only one is real: the 🔏 SEALED one. The other is a forgery, and this keypad jams on the first wrong code. Walk past both — ❓ If 🔏 sealed note ahead → 🧠 Read it — then try what you read.",
   cases:[
     {tiles:[...wallsAt(4),[4,1,"lock",58],[1,1,"snote",58],[2,1,"note",53]]},
     {tiles:[...wallsAt(4),[4,1,"lock",76],[1,1,"note",71],[2,1,"snote",76]]},
     {tiles:[...wallsAt(4),[4,1,"lock",40],[1,1,"snote",40],[2,1,"note",49]]},
     {tiles:[...wallsAt(4),[4,1,"lock",28],[1,1,"note",23],[2,1,"snote",28]],hidden:true}],
   why:"The forgery copied the number almost perfectly — 53 for 58 — because that is the easy part. What it could not copy was the seal: WHO the note came from. This is phishing, and it is how most people actually get caught: a message that looks right, from an address that is one letter wrong. Read the sender, not the message."},

  /* Forensics, and a real algorithm: the entry that does not fit. */
  {id:"cy_log", act:"trust", em:"🕵️", name:"Who Went Through", diff:3, coins:420, xp:180, needs:"cy_phish",
   maxBlocks:12, gw:8, gh:3, start:{x:0,y:1,dir:1}, goal:[7,1],
   strikes:1,
   tiles:[...wallsAt(6),[6,1,"lock",37],
          [1,1,"note",30],[2,1,"note",30],[3,1,"note",37],[4,1,"note",30],[5,1,"note",30]],
   desc:"🔐 The door keeps a 📝 log: every code it was shown today, in order. Almost all of them are the same ordinary number — and one is not. The odd one out is who got in, and it is the code — and the keypad jams on a wrong one, so you have to actually find it. 🧠 Read the first into a box, then walk the log keeping anything BIGGER.",
   cases:[
     {tiles:[...wallsAt(6),[6,1,"lock",37],
             [1,1,"note",30],[2,1,"note",30],[3,1,"note",37],[4,1,"note",30],[5,1,"note",30]]},
     {tiles:[...wallsAt(6),[6,1,"lock",68],
             [1,1,"note",62],[2,1,"note",68],[3,1,"note",62],[4,1,"note",62],[5,1,"note",62]]},
     {tiles:[...wallsAt(6),[6,1,"lock",19],
             [1,1,"note",15],[2,1,"note",15],[3,1,"note",15],[4,1,"note",15],[5,1,"note",19]]},
     {tiles:[...wallsAt(6),[6,1,"lock",89],
             [1,1,"note",84],[2,1,"note",84],[3,1,"note",84],[4,1,"note",89],[5,1,"note",84]],hidden:true}],
   why:"Nobody told you where to look — you found it because one line did not match the rest. That is what reading a log is, and it is most of how break-ins are actually caught: not a siren, just an entry at a strange hour from a place nobody has ever logged in from. In real logs the odd one is not always the biggest, but looking for the one that does not fit always is the job."}
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

/* ---------------- its own band in the projects sheet ----------------
   Eleven cards in one grid is a wall. Three acts with a line each is the
   same eleven cards and a story, and it tells a player who has stopped
   half-way where they stopped. */
const _renderProjects=window.renderProjects;
window.renderProjects=function(){
  _renderProjects();
  const el=$("projList"); if(!el)return;
  const done=LEVELS.filter(l=>player.projects[l.id]).length;
  const sec=document.createElement("div");sec.className="t3sec cy-sec";
  sec.innerHTML='<div class="t3head"><div class="t3ico cy-ico">🔐</div>'+
    '<div><div class="t3title">Cyber Lab</div>'+
    '<div class="t3sub">Locks to open, notes that lie — and why a long password is a strong one.</div></div>'+
    '<div class="t3prog">'+done+'/'+LEVELS.length+'</div></div>';
  for(const act of ACTS){
    const mine=LEVELS.filter(l=>l.act===act.id);
    if(!mine.length)continue;
    const h=document.createElement("div");h.className="cy-act";
    h.innerHTML='<span class="cy-act-n">'+esc(act.name)+'</span>'+
      '<span class="cy-act-s">'+esc(act.sub)+'</span>';
    sec.appendChild(h);
    const grid=document.createElement("div");grid.className="t3grid";
    for(const lv of mine)grid.appendChild(card(lv));
    sec.appendChild(grid);
  }
  el.insertBefore(sec,el.firstChild);
};
function card(lv){
  const solved=!!player.projects[lv.id], open=unlocked(lv);
  const c=document.createElement("button");
  c.className="t3card cy-card"+(solved?" done":"")+(open?"":" locked");
  /* the inputs are part of what a level costs, so the card says so before
     you open it — "one program, four boards" is the promise */
  const inputs=(lv.cases||[]).length;
  c.innerHTML='<span class="t3badge">'+lv.em+'</span>'+
    '<span class="t3name">'+esc(lv.name)+'</span>'+
    '<span class="t3meta">'+"⭐".repeat(lv.diff)+' · 🧩 '+lv.maxBlocks+
      (inputs?' · 🔀 '+inputs:'')+'</span>'+
    (solved?'<span class="t3done">✓</span>':"");
  if(open)c.onclick=()=>{$("projects").classList.remove("open");enter(lv);};
  else{
    /* a locked card says what opens it, rather than doing nothing */
    c.onclick=()=>toast("🔒 Finish “"+levelName(lv.needs)+"” first.");
  }
  return c;
}
function levelName(id){const l=LEVELS.find(x=>x.id===id);return l?l.name:id;}

window.CC_CYBER={levels:LEVELS,acts:ACTS,enter:enter,blocks:CY_BLOCKS};
})();
