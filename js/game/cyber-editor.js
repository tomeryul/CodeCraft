"use strict";
/* =====================================================================
   Designing your own Cyber Lab level
   ---------------------------------------------------------------------
   The eleven built-in levels are eleven ideas. This is the twelfth thing
   to do with them: make one of your own, prove it can be solved, and put
   it in front of everybody else.

   A Cyber level IS a flat challenge board — same grid, same robot, same
   runner — so almost none of the creator is rewritten here. What this
   file adds is the four tiles that make a board a Cyber board, a flag to
   walk to, the ⛔ strikes setting, and the checks that stop an author
   publishing a lock nobody can open. Everything else — the size, the
   block budget, the difficulty, the inputs, Save, Publish — is the
   creator the player already knows.

   It is bolted on exactly the way tower-editor.js is, by wrapping the
   creator's own functions and answering "not mine" everywhere else, so a
   flat challenge and a Tower level behave as if this file did not exist.

   The one design decision worth writing down: an author's level must be
   SOLVABLE, and for a keypad that means its code has to be discoverable.
   A four-digit code with no note anywhere is not a hard level, it is a
   wall — so check() says so before Save opens, in the same words the
   level would have taught.
   ===================================================================== */
(function(){
if(typeof window==="undefined"||typeof mgState==="undefined")return;
if(window.__cyed)return;
if(!window.CC_CYBER||typeof window.mgEnterCreator!=="function"){
  console.warn("cyber-editor.js: the Cyber Lab is not loaded — its designer is off.");
  return;
}
window.__cyed=1;

const CY=window.CC_CYBER;
/* 🚩 and 🤖 are places, not terrain; the rest are tiles CC_TILES already
   knows how to draw, so painting them is the creator's own code. */
/* Nine glyphs in a row and a number box is a puzzle of its own, and the
   author is here to build a level rather than solve one — so every tool
   says what it is, in the place you pick it up. `tip` is written for
   somebody who has never seen a keypad tile before, because that is who
   opens this the first time. */
const TOOLS=[
  {id:"flag",  em:"🚩", lbl:"Flag",
   tip:"Where the robot has to get to. Every level needs exactly one — tap the flag again to take it away."},
  {id:"bot",   em:"🤖", lbl:"Start",
   tip:"Where the robot begins, facing right. Put it on the far side of the keypad from the flag."},
  {id:"wall",  em:"🧱", lbl:"Wall",
   tip:"Nothing walks through it. The usual shape: a wall across the board with ONE gap, and the keypad in the gap."},
  {id:"lock",  em:"🔢", lbl:"Keypad", num:true,
   tip:"A door whose key is a NUMBER. Set its code below — tap the number to type one. It opens when the robot punches that exact code in with 🔢 Try Code, and then it stays open."},
  {id:"lockk", em:"🗝️", lbl:"Keypad + Key", num:true,
   tip:"The same door, but it wants a 🔑 key as well. The right code ALONE will not open it — something you know and something you carry."},
  {id:"key",   em:"🔑", lbl:"Key",
   tip:"The robot picks it up just by walking over it, and keeps it. One key opens every 🗝️ keypad on the board."},
  {id:"note",  em:"📝", lbl:"Note", num:true,
   tip:"A number lying on the floor. The robot reads it with 🧠 Read “number ahead”. Put the keypad's code on it and your level is about reading — put a DIFFERENT number on it and your level is about a note that lies."},
  {id:"snote", em:"🔏", lbl:"Sealed note", num:true,
   tip:"The same note with a wax seal, which says WHO wrote it. A forgery copies the number perfectly and cannot copy the seal — ❓ If 🔏 sealed note ahead is how the robot tells two notes apart."},
  {id:"erase", em:"🧹", lbl:"Erase",
   tip:"Clears whatever is on the tile you tap."}
];
const NUMTOOL=id=>!!(TOOLS.find(t=>t.id===id)||{}).num;
/* which blocks an author may hand out, and the ones every level needs */
const LOCKED={move:1,turnL:1,turnR:1,tryCode:1};
const DEF_ALLOWED=["move","turnL","turnR","tryCode","repeat","countLoop","read","if"];
const STRIKES=[0,1,2,3];

const onCyP=()=>!!(mgState&&mgState.proj&&mgState.proj.cyber);
const editCy=()=>!!(mgState&&mgState.creator&&onCyP());
window.onCyEdit=editCy;

const tilesOf=p=>p.tiles||[];
const countOf=(p,ty)=>tilesOf(p).filter(t=>t[2]===ty).length;
const locks=p=>tilesOf(p).filter(t=>t[2]==="lock"||t[2]==="lockk");
const notes=p=>tilesOf(p).filter(t=>t[2]==="note"||t[2]==="snote");

/* ---------------- is this level a level? ----------------
   Errors stop Save; warnings are advice. The line between them is whether
   a player could finish it at all. */
function check(p){
  const errs=[], warns=[];
  if(!p.goal)errs.push("No 🚩 flag yet — tap the Flag tool and put one where the robot has to get to.");
  else if(p.goal[0]===p.start.x&&p.goal[1]===p.start.y)
    errs.push("The 🚩 flag is under the robot — it would win before it moved.");
  const L=locks(p);
  if(!L.length)warns.push("No 🔢 keypad on the board — this is a walking puzzle, not a Cyber level.");
  if(countOf(p,"lockk")&&!countOf(p,"key"))
    errs.push("A 🗝️ Keypad + Key needs a 🔑 key somewhere on the board, or it never opens.");
  /* the real check: can the code be found? Either it is written on a note,
     or it is short enough that a loop can walk through every possibility
     inside the level's own block budget. */
  const known=new Set(notes(p).map(t=>t[3]|0));
  for(const t of L){
    const code=t[3]|0;
    if(known.has(code))continue;
    if((p.strikes|0)>0)
      errs.push("The keypad at "+t[0]+","+t[1]+" has code "+code+", it jams on wrong codes, and no 📝 note says what it is — nobody can open it.");
    else if(code>99)
      errs.push("The keypad at "+t[0]+","+t[1]+" has code "+code+" and no 📝 note says so. Guessing that far takes more steps than a run has — write it on a note.");
    else if(code>20)
      warns.push("Code "+code+" at "+t[0]+","+t[1]+" is only findable by guessing — that is "+code+" tries. Fine for a brute-force lesson, slow for anything else.");
  }
  if((p.strikes|0)>0&&!L.length)
    warns.push("⛔ Strikes only matters when there is a keypad to jam.");
  if(countOf(p,"snote")&&countOf(p,"note")===0)
    warns.push("Every note is sealed, so 🔏 sealed note ahead can never tell two apart — add a plain 📝 note to make it a choice.");
  return {errs,warns};
}

/* ---------------- switching the creator into Cyber mode ---------------- */
function setMode(on){
  const p=mgState.proj;
  if(on){
    p.cyber=true;
    p.goalType="reach";
    if(!p.cyinit){
      p.cyinit=1;
      p.allowed=DEF_ALLOWED.slice();
      p.strikes=0;p.desc2=p.desc2||"";
      p.cells=[];p.initial=[];p.tiles=[];p.goal=null;p.cases=[];
    }
    mgState.paintMode="lock";
    if(mgState.tileNum==null)mgState.tileNum=7;
    if(mgRobot){mgRobot.program=[];mgRobot.routines={A:{params:[],body:[]},B:{params:[],body:[]}};
      mgRobot.hist=[];mgRobot.redoS=[];}
    if(typeof edTarget!=="undefined")edTarget="main";
  }else{
    delete p.cyber;delete p.goalType;delete p.goal;delete p.strikes;
    p.cyinit=0;p.desc2="";
    p.cells=[];p.initial=[];p.tiles=[];p.cases=[];
    p.allowed=(typeof CREATOR_BLOCKS!=="undefined"?CREATOR_BLOCKS:p.allowed);
    mgState.paintMode="paint";
  }
  mgState.solved=false;mgState.caseBase=null;
  const rb=mgState.robot;
  rb.x=p.start.x;rb.y=p.start.y;rb.dir=p.start.dir;
  mgSeed(rb,p);
  renderPalette();renderProgram();renderPy();updateUndoBtns();mgUpdateCount();
  mgCreatorUI();mgDraw();
  sfx(on?680:420,.05);
}
window.cyDesign=()=>{mgEnterCreator();setMode(true);};

/* ---------------- the injected chrome ---------------- */
function chrome(){
  const bar=$("mgCreatorBar");
  if(!bar||$("cyBtn"))return;
  const act=bar.querySelector(".cb-act");
  const b=document.createElement("button");
  b.id="cyBtn";b.className="ibtn wide";
  b.title="Switch between a flat 2D challenge and a Cyber Lab level";
  b.addEventListener("click",()=>{
    const to=!onCyP();
    const msg=to
      ? "Switch to 🔐 Cyber Lab mode?\n\nThe flat board and the program you've written are cleared — you design with keypads and notes instead."
      : "Back to the flat 2D board?\n\nYour Cyber board is cleared.";
    if(!confirm(msg))return;
    if(to&&window.on3d&&on3d()&&typeof setT3==="function")setT3(false);
    setMode(to);
  });
  act.insertBefore(b,$("mgSetup"));

  /* the strikes setting and the verdict, in the row Tower's stats use */
  const row=document.createElement("div");
  row.id="cyEdRow";row.className="cb-row t3edrow";
  row.innerHTML='<span class="t3stat cy-strk-l">⛔ Strikes</span>'+
    '<span id="cyStrikes" class="cy-strk"></span>'+
    '<span class="spacer"></span>'+
    '<span class="t3stat">🔢 <b id="cyNLocks">0</b></span>'+
    '<span class="t3stat">📝 <b id="cyNNotes">0</b></span>';
  bar.insertBefore(row,act);

  const pane=bar.querySelector(".cb-panel"), stprow=pane.querySelector(".stprow");
  const hint=document.createElement("button");
  hint.id="cyHint";hint.className="rowbtn";
  hint.innerHTML='📜 <span class="lb">Level hint for the player</span>';
  hint.addEventListener("click",()=>{
    const p=mgState.proj;
    const t=prompt("What should the player read when the level opens?",p.desc2||"");
    if(t===null)return;
    p.desc2=t.slice(0,240);sfx(560,.04);ui();
  });
  const chips=document.createElement("div");
  chips.id="cyBlocks";chips.className="t3chips";
  pane.insertBefore(hint,stprow);
  pane.insertBefore(chips,stprow);

  /* stepping one at a time to a four-digit code is not a design tool, so
     the number itself is the way in */
  const n=$("mgBrickN");
  if(n)n.addEventListener("click",()=>{
    if(!editCy()||!NUMTOOL(mgState.paintMode))return;
    const v=prompt("Number for this tile (0–9999):",String(mgState.tileNum|0));
    if(v===null)return;
    mgState.tileNum=Math.max(0,Math.min(9999,parseInt(v,10)||0));
    sfx(560,.03);mgCreatorUI();
  });
}
function strikeRow(p){
  const el=$("cyStrikes"); if(!el)return;
  el.innerHTML="";
  for(const s of STRIKES){
    const c=document.createElement("button");
    c.className="t3chip"+((p.strikes|0)===s?" on":"");
    c.textContent=s?String(s):"off";
    c.title=s?("Jams after "+s+" wrong code"+(s>1?"s":"")+" — ⏱ Wait clears it")
             :"Wrong codes cost nothing";
    c.addEventListener("click",()=>{
      p.strikes=s;mgState.solved=false;sfx(520,.03);mgCreatorUI();mgDraw();
    });
    el.appendChild(c);
  }
}
function chipRow(p){
  const chips=$("cyBlocks"); if(!chips)return;
  chips.innerHTML="";
  const set=new Set(p.allowed||[]);
  for(const t of CY.blocks){
    const d=DEFS[t]; if(!d)continue;
    const lock=!!LOCKED[t], onx=set.has(t)||lock;
    const c=document.createElement("button");
    c.className="t3chip"+(onx?" on":"")+(lock?" lock":"");
    c.innerHTML=d.ic+' <span>'+esc(d.lbl)+'</span>';
    c.title=lock?"Always available":(onx?"Tap to take it away":"Tap to allow it");
    if(!lock)c.addEventListener("click",()=>{
      if(set.has(t))set.delete(t); else set.add(t);
      p.allowed=CY.blocks.filter(k=>set.has(k)||LOCKED[k]);
      mgState.solved=false;
      sfx(520,.03);renderPalette();mgUpdateCount();ui();
    });
    chips.appendChild(c);
  }
}
function ui(){
  const btn=$("cyBtn"); if(!btn)return;
  const cr=!!(mgState&&mgState.creator);
  btn.style.display=cr?"":"none";
  const row=$("cyEdRow"), chips=$("cyBlocks"), hint=$("cyHint");
  const mine=cr&&onCyP();
  for(const el of [row,chips,hint])if(el)el.style.display=mine?"":"none";
  if(!cr)return;
  /* Tower's button renames itself to "2D" while it is on, which is fine
     when it is the only mode button. With two of them a row reading
     "3D · 2D" says nothing about which is which, so this one keeps its
     name and lights up instead. */
  btn.textContent="🔐 Cyber";
  btn.classList.toggle("on",mine);
  /* ➕ Add level banks a flat stage into a multi-level pack, and a Cyber
     board is not one — same as Tower Mode, a design is one level. The
     depth is in the inputs instead. */
  const add=$("mgAddStage"); if(add)add.style.display=mine?"none":"";
  if(!mine)return;
  const p=mgState.proj;
  strikeRow(p);chipRow(p);
  $("cyNLocks").textContent=locks(p).length;
  $("cyNNotes").textContent=notes(p).length;
  $("mgGoal").textContent=(p.desc2?"📜 “"+p.desc2+"”":"🔐 Cyber design — a keypad, something that says what its code is, and a 🚩 flag past it.");
}

/* ---------------- wrapping the creator ----------------
   The creator already has a strip that says where you are — Tower Mode
   turns it off and draws its own, which is two status lines in a panel
   that has room for neither. This mode says its piece in the one the
   author is already reading. */
const _mgStatus=window.mgStatus;
window.mgStatus=function(has,solved,banked){
  if(!editCy())return _mgStatus(has,solved,banked);
  const el=$("mgStatus"); if(!el)return;
  el.style.display="";
  const v=check(mgState.proj);
  if(v.errs.length){el.className="t3warn bad";el.textContent="⚠️ "+v.errs[0];return;}
  if(!solved){el.className="t3warn hmm";
    el.textContent=v.warns.length?("💡 "+v.warns[0]):
      "Now write it in 🧩 Blocks and press ▶ — a level counts as a level once you have solved it yourself.";
    return;}
  el.className="t3warn ok";
  el.textContent="✅ Solved — 💾 Save it, or 🌍 Publish it for everyone.";
};

const _mgCreatorUI=window.mgCreatorUI;
window.mgCreatorUI=function(){_mgCreatorUI();chrome();ui();};

const _mgToolsUI=window.mgToolsUI;
window.mgToolsUI=function(){
  if(!editCy())return _mgToolsUI();
  const el=$("mgTools"); if(!el)return;
  el.innerHTML="";
  for(const t of TOOLS){
    const b=document.createElement("button");
    b.className="tool"+(t.id===mgState.paintMode?" on":"");
    b.title=t.lbl;
    const em=document.createElement("span");em.className="tl-em";em.textContent=t.em;
    const lb=document.createElement("span");lb.className="tl-lb";lb.textContent=t.lbl;
    b.appendChild(em);b.appendChild(lb);
    b.addEventListener("click",()=>{mgState.paintMode=t.id;sfx(560,.03);mgCreatorUI();});
    el.appendChild(b);
  }
  tipLine();
  const stp=$("mgBrickStp"), num=NUMTOOL(mgState.paintMode);
  if(stp){
    stp.style.display=num?"":"none";
    if(num){
      const lab=stp.querySelector(".clab");
      if(lab)lab.textContent="🔢 Code — tap to type";
      $("mgBrickN").textContent=String(mgState.tileNum|0);
    }
  }
};
/* Under the tools, not above them: it explains the thing you just tapped,
   so it belongs on the same side of the strip your finger is on.

   The 📘 rides here too. The flat creator keeps its guide two taps deep
   inside ⚙️, and on an untouched 8×6 board the whole settings row is below
   the fold — so the one question a stuck author has ("how do I even do
   this?") had its answer off screen. The dock is the part of this panel
   that is always visible, so that is where the way in goes. */
function tipLine(){
  let el=$("cyTip");
  if(!el){
    const dock=$("mgDock"); if(!dock)return;
    el=document.createElement("div");el.id="cyTip";el.className="cy-tip";
    el.innerHTML='<button class="cy-help" id="cyHelp">📘 <span>Guide</span></button>'+
      '<span class="cy-tip-t"></span>';
    dock.appendChild(el);
    $("cyHelp").addEventListener("click",()=>{
      $("mgCreatorBar").classList.remove("setup");
      if(typeof openGuide==="function")openGuide();
    });
  }
  el.style.display=editCy()?"":"none";
  const t=TOOLS.find(x=>x.id===mgState.paintMode), tx=el.querySelector(".cy-tip-t");
  if(!t||!tx)return;
  /* separate nodes, never one glued string: the dictionary matches whole
     text nodes, and a name welded to its sentence matches nothing */
  tx.textContent="";
  const b=document.createElement("b");b.textContent=t.em+" "+t.lbl;
  tx.appendChild(b);
  tx.appendChild(document.createTextNode(" — "));
  tx.appendChild(document.createTextNode(t.tip));
}

/* 🚩 is a place on the board, not a tile, so it is the one tool this file
   has to paint itself. Everything else is CC_TILES terrain and goes
   through the creator's own painter — which is also the single place that
   re-locks Save after a change, so nothing here may skip it. */
const _mgPaintTile=window.mgPaintTile;
window.mgPaintTile=function(x,y){
  if(!editCy())return _mgPaintTile(x,y);
  const p=mgState.proj;
  if(mgState.paintMode==="flag"){
    const t=(p.tiles||[]).find(q=>q[0]===x&&q[1]===y);
    if(t&&mgProbeSolid(t[2],t[3]|0,x,y)){
      toast("🚧 The flag can't sit inside "+(CC_TILES.DEFS[t[2]]||{lbl:"terrain"}).lbl.toLowerCase()+" — nobody could stand on it.");return;}
    const had=p.goal&&p.goal[0]===x&&p.goal[1]===y;
    p.goal=had?null:[x,y];
    mgState.solved=false;mgState.caseBase=null;
    sfx(500,.03);mgDraw();mgCreatorUI();
    return;
  }
  _mgPaintTile(x,y);
};

/* the shared −/+ edits a colour, a direction or a block number; a keypad's
   code is a fourth thing, and it is the one this mode is made of */
const _mgStepArg=window.mgStepArg;
window.mgStepArg=function(d){
  if(!editCy()||!NUMTOOL(mgState.paintMode))return _mgStepArg(d);
  mgState.tileNum=Math.max(0,Math.min(9999,(mgState.tileNum|0)+d));
  mgCreatorUI();
};

/* a board that shrank under the flag leaves a goal nobody can reach */
const _mgSetSize=window.mgSetSize;
window.mgSetSize=function(dw,dh){
  const was=editCy();
  _mgSetSize(dw,dh);
  if(!was)return;
  const p=mgState.proj;
  if(p.goal&&(p.goal[0]>=p.gw||p.goal[1]>=p.gh))p.goal=null;
  mgCreatorUI();mgDraw();
};

/* "has the author drawn anything yet?" is asked of target tiles and
   pre-placed blocks, and a Cyber board has neither */
const _mgHasDesign=window.mgHasDesign;
window.mgHasDesign=function(p){
  if(!(p&&p.cyber))return _mgHasDesign(p);
  return !!(p.goal&&tilesOf(p).length);
};

/* ---------------- save · play · edit · publish ---------------- */
function levelFrom(p){
  const b=(typeof baseBoard==="function")?baseBoard(p):{tiles:p.tiles,start:p.start};
  return JSON.parse(JSON.stringify({
    em:"🔐", name:p.name, diff:p.diff||1,
    maxBlocks:p.maxBlocks, gw:p.gw, gh:p.gh,
    allowed:(p.allowed||DEF_ALLOWED).slice(),
    start:b.start, tiles:b.tiles, cells:[], initial:[],
    cases:p.cases||[],
    cyber:true, goalType:"reach", goal:p.goal, strikes:p.strikes|0,
    desc:p.desc2||"🔐 Open the keypad and reach the 🚩 flag — a Cyber level somebody built."}));
}
function gate(p){
  const v=check(p);
  if(v.errs.length){toast("⚠️ "+v.errs[0]);sfx(200,.06);return false;}
  if(!mgState.solved){toast("▶ First prove it: write a program and run it, then 💾 Save opens up.");sfx(200,.06);return false;}
  return true;
}
const _saveMy=window.saveMyChallenge;
window.saveMyChallenge=function(){
  if(!editCy())return _saveMy();
  const p=mgState.proj;
  mgSyncCase();
  if(!gate(p))return;
  player.myChallenges=player.myChallenges||[];
  const entry=levelFrom(p);
  entry.id=mgState.editingId||("my_"+Date.now());
  entry.mine=true;entry.cy=true;entry.coins=0;entry.xp=0;
  entry.sol=(mgRobot?packProg(mgRobot):[]);
  const i=player.myChallenges.findIndex(x=>x.id===entry.id);
  if(i>=0)player.myChallenges[i]=entry; else player.myChallenges.push(entry);
  saveNow();
  toast(i>=0?"✅ Updated “"+p.name+"”":"💾 Saved “"+p.name+"” to My Challenges!");
  sfx(760,.06);sfx(1040,.06,.08);
};

/* a saved Cyber level plays as itself, wherever it was tapped from */
const _mgEnter=window.mgEnter;
window.mgEnter=function(proj0){
  if(proj0&&proj0.cy&&!proj0.cyber){
    const p=JSON.parse(JSON.stringify(proj0));
    p.cyber=true;p.goalType="reach";
    return _mgEnter(p);
  }
  return _mgEnter(proj0);
};

const _mgEditMy=window.mgEditMyChallenge;
window.mgEditMyChallenge=function(entry){
  if(!entry||!entry.cy)return _mgEditMy(entry);
  mgEnterCreator();setMode(true);
  const p=mgState.proj;
  p.name=entry.name;p.diff=entry.diff||1;p.maxBlocks=entry.maxBlocks||12;
  p.gw=entry.gw||8;p.gh=entry.gh||6;
  p.allowed=(entry.allowed||DEF_ALLOWED).slice();
  p.start=JSON.parse(JSON.stringify(entry.start||{x:0,y:0,dir:1}));
  p.tiles=JSON.parse(JSON.stringify(entry.tiles||[]));
  p.cases=JSON.parse(JSON.stringify(entry.cases||[]));
  p.goal=entry.goal?entry.goal.slice():null;
  p.strikes=entry.strikes|0;
  p.desc2=entry.desc&&entry.desc.indexOf("🔐 Open the keypad")!==0?entry.desc:"";
  mgState.editingId=entry.id;
  if(typeof mgSelectFirstCase==="function")mgSelectFirstCase();
  mgLoadSolution(entry.sol||[]);
  mgState.solved=false;
  const rb=mgState.robot;rb.x=p.start.x;rb.y=p.start.y;rb.dir=p.start.dir;mgSeed(rb,p);
  renderPalette();renderProgram();renderPy();updateUndoBtns();mgUpdateCount();
  mgCreatorUI();mgDraw();
  toast("✏️ Editing “"+entry.name+"” — your solution is loaded. Change it, prove it ▶, then 💾 Save.");
};

/* Publishing: the community table has fixed columns, so the Cyber payload
   rides in `stages` as a single stage — the same berth Tower Mode uses.
   `tiles` is a real column, so it is filled as well: a client that has
   never heard of the Cyber Lab drops the tile types it does not know and
   shows the walls, rather than an empty board. */
const _publish=window.publishChallenge;
window.publishChallenge=async function(){
  if(!editCy())return _publish();
  const p=mgState.proj;
  mgSyncCase();
  if(!gate(p))return;
  if(typeof sbUser==="undefined"||!sbUser){toast("🔑 Log in first to publish.");return;}
  const stage=levelFrom(p);
  stage.cy=true;
  stage.sol=(mgRobot?packProg(mgRobot):[]);
  const body={name:p.name,gw:p.gw,gh:p.gh,
    start_x:stage.start.x,start_y:stage.start.y,start_dir:stage.start.dir,
    cells:[],initial:[],tiles:stage.tiles,
    max_blocks:p.maxBlocks,diff:p.diff||2,
    stages:[stage],solution:stage.sol,cases:[],preset:[],
    author_name:(sbUser.email||"builder").split("@")[0].slice(0,20)};
  try{
    if(mgState.publishId){
      await sbRest("challenges?id=eq."+encodeURIComponent(mgState.publishId),{method:"PATCH",
        headers:Object.assign(sbHeaders(true),{Prefer:"return=minimal"}),
        body:JSON.stringify(Object.assign({updated_at:new Date().toISOString()},body))});
      if(window.CC_EXTRAS)CC_EXTRAS.celebrate("🔐","UPDATED!",p.name+" is updated!","Your Cyber level is live for everyone who plays it!","Nice! 🎉");
      else bigToast("🔐 Updated “"+p.name+"”!");
    }else{
      await sbRest("challenges",{method:"POST",headers:Object.assign(sbHeaders(true),{Prefer:"return=minimal"}),
        body:JSON.stringify(body)});
      if(window.CC_EXTRAS)CC_EXTRAS.celebrate("🔐","PUBLISHED!",p.name+" is live!","Players everywhere can now try to crack your keypad!","Awesome! 🎉");
      else bigToast("🔐 Published “"+p.name+"”!");
    }
    mgExit(true);
  }catch(e){toast("⚠️ Publish failed: "+e.message);}
};

// a published Cyber level arrives as a one-stage pack
const _packEnter=window.packEnter;
window.packEnter=function(pack,i){
  const s=pack&&pack.stages&&pack.stages[i||0];
  if(s&&(s.cy||s.cyber)&&!s.mode3d){
    const lv=JSON.parse(JSON.stringify(s));
    lv.id=pack.id||("cy_"+Date.now());
    lv.em="🔐";lv.name=pack.name||lv.name;lv.diff=pack.diff||2;
    lv.cyber=true;lv.goalType="reach";
    lv.community=pack.community||null;
    lv.coins=lv.community?60:0;lv.xp=lv.community?30:0;
    return mgEnter(lv);
  }
  return _packEnter(pack,i);
};

/* ---------------- the Cyber band gets a Design card ---------------- */
const _renderProjects=window.renderProjects;
window.renderProjects=function(){
  _renderProjects();
  const sec=document.querySelector(".t3sec.cy-sec");
  if(!sec)return;
  const grid=document.createElement("div");grid.className="t3grid";
  for(const e of (player.myChallenges||[]).filter(x=>x.cy)){
    const c=document.createElement("button");
    c.className="t3card cy-card mine";
    c.innerHTML='<span class="t3badge">🔐</span>'+
      '<span class="t3name">'+esc(e.name)+'</span>'+
      '<span class="t3meta">'+"⭐".repeat(e.diff||1)+' · 🧩 '+e.maxBlocks+
        ((e.strikes|0)?' · ⛔ '+(e.strikes|0):'')+'</span>'+
      '<span class="t3mine">yours</span>';
    c.onclick=()=>{$("projects").classList.remove("open");mgEnter(e);};
    grid.appendChild(c);
  }
  const add=document.createElement("button");
  add.className="t3card t3new";
  add.innerHTML='<span class="t3badge">✏️</span>'+
    '<span class="t3name">Design a level</span>'+
    '<span class="t3meta">Your own keypad — set the code, prove it, publish it</span>';
  add.onclick=()=>{$("projects").classList.remove("open");cyDesign();};
  grid.appendChild(add);
  const h=document.createElement("div");h.className="cy-act";
  h.innerHTML='<span class="cy-act-n">Yours</span>'+
    '<span class="cy-act-s">Build a lock of your own and put it in front of everybody.</span>';
  sec.appendChild(h);sec.appendChild(grid);
};

/* ===================== 📘 the guide =====================
   The flat creator has one, and it is the difference between a blank grid
   and a level. This is the same sheet for this mode: what each piece IS,
   how the two notes differ, the four shapes a Cyber level comes in, and
   four boards that land on the canvas already working, so the first thing
   an author does is CHANGE something rather than invent it.
   ====================================================== */
const CY_RECIPES=[
  {id:"cy_r_guess", em:"🔓", name:"The simplest lock", teaches:"guessing",
   blurb:"One keypad, a one-digit code, and no clue anywhere. The player writes a 🔢 Count loop that tries 1, 2, 3… until it opens. Start here — it is the level the whole section is built on.",
   /* the keypad is DIRECTLY in front of the robot, like the first built-in
      level: a first board should not also be a walking puzzle */
   gw:5,gh:3,max:6,strikes:0,start:{x:1,y:1,dir:1},goal:[4,1],
   tiles:[[2,0,"wall",0],[2,2,"wall",0],[2,1,"lock",7]],
   hint:"🔐 A ONE-digit code stands between you and the 🚩 flag. You do not know it — so try all ten."},

  {id:"cy_r_note", em:"📝", name:"Write it on a note", teaches:"🧠 Read",
   blurb:"The code is far too big to guess, and somebody wrote it on a 📝 note lying in the corridor. The player reads the note into a box and tries that. Change the number on BOTH tiles to make it yours.",
   gw:7,gh:3,max:7,strikes:0,start:{x:1,y:1,dir:1},goal:[6,1],
   tiles:[[4,0,"wall",0],[4,2,"wall",0],[4,1,"lock",58],[2,1,"note",58]],
   hint:"🔐 Too big to guess — but somebody left a 📝 note on the floor. 🧠 Read it, then 🔢 Try Code it."},

  {id:"cy_r_2fa", em:"🗝️", name:"A code and a key", teaches:"two factors",
   blurb:"A 🗝️ Keypad + Key: the right code is not enough on its own. The 🔑 key is behind the robot, so the player has to go back for it. Two kinds of proof, on one door.",
   gw:6,gh:3,max:13,strikes:3,start:{x:1,y:1,dir:1},goal:[5,1],
   tiles:[[3,0,"wall",0],[3,2,"wall",0],[3,1,"lockk",44],[2,1,"note",44],[0,1,"key",0]],
   hint:"🔐 This keypad has a keyhole too. The 📝 note has the code; the 🔑 key is behind you."},

  {id:"cy_r_fake", em:"🔏", name:"One note is lying", teaches:"🔏 the seal",
   blurb:"Two notes with numbers that look almost the same, and only the 🔏 SEALED one is real. ⛔ Strikes is set to 1, so trying the forgery ends the run — the player has to check the seal before they act.",
   gw:7,gh:3,max:10,strikes:1,start:{x:0,y:1,dir:1},goal:[6,1],
   tiles:[[4,0,"wall",0],[4,2,"wall",0],[4,1,"lock",58],[1,1,"snote",58],[2,1,"note",53]],
   hint:"🔐 Two notes, and only the 🔏 sealed one is real. One wrong code and this keypad jams."}
];

/* drop a recipe onto the canvas, exactly as the flat guide's boards do */
function cyApply(r){
  if(!r)return;
  if(!editCy())cyDesign();
  else if(tilesOf(mgState.proj).length&&
          !confirm("Replace the board you're working on with “"+r.name+"”?"))return;
  const p=mgState.proj;
  p.name=r.name;p.gw=r.gw;p.gh=r.gh;p.maxBlocks=r.max;p.strikes=r.strikes|0;
  p.start=JSON.parse(JSON.stringify(r.start));
  p.goal=r.goal.slice();
  p.tiles=JSON.parse(JSON.stringify(r.tiles));
  p.cells=[];p.initial=[];p.cases=[];
  p.desc2=r.hint;
  mgState.solved=false;mgState.caseBase=null;mgState.caseEdit=null;
  if(mgRobot){mgRobot.program=[];mgRobot.routines={A:{params:[],body:[]},B:{params:[],body:[]}};
    mgRobot.hist=[];mgRobot.redoS=[];}
  if(typeof edTarget!=="undefined")edTarget="main";
  const rb=mgState.robot;rb.x=p.start.x;rb.y=p.start.y;rb.dir=p.start.dir;mgSeed(rb,p);
  if(typeof closeGuide==="function")closeGuide();
  renderPalette();renderProgram();renderPy();updateUndoBtns();mgUpdateCount();
  mgCreatorUI();mgDraw();setTab("board");
  toast("🛠️ “"+r.name+"” is on the board — solve it first, then make it yours!");
}

/* what each piece is, in the sheet as well as on the strip — somebody
   reading the guide is usually not looking at the tool they need yet.

   Every line here is its own element with no markup inside it, which is
   not a style choice: the Hebrew dictionary matches WHOLE text nodes, and
   a <b> in the middle of a sentence splits it into fragments that match
   nothing. The flat guide is written as bolded prose and is translated a
   shard at a time because of it. Short labelled rows read better anyway. */
function cyGuideBody(el){
  const sec=t=>{const h=document.createElement("h4");h.className="qsec";h.textContent=t;el.appendChild(h);};
  const box=cls=>{const d=document.createElement("div");d.className=cls;el.appendChild(d);return d;};
  const line=(par,t)=>{const p=document.createElement("p");p.className="gline";p.textContent=t;par.appendChild(p);};
  const row=(par,badge,label,text)=>{
    const d=document.createElement("div");d.className="grule";
    const n=document.createElement("span");n.className="gnum";n.textContent=badge;
    const w=document.createElement("div");
    const b=document.createElement("b");b.textContent=label;
    const p=document.createElement("p");p.textContent=text;
    w.appendChild(b);w.appendChild(p);d.appendChild(n);d.appendChild(w);
    par.appendChild(d);
  };

  sec("🧩 The pieces, and what each one does");
  for(const t of TOOLS){
    if(t.id==="erase")continue;
    row(el,t.em,t.lbl,t.tip);
  }

  sec("📝 The two kinds of note");
  const n1=box("gnote");
  line(n1,"Both notes are just a number lying on the floor, and the robot reads either one the same way: 🧠 Read “number ahead”.");
  row(n1,"📝","Plain note","Anybody could have written it. It might be the code. It might be a lie.");
  row(n1,"🔏","Sealed note","It carries a wax seal, and the seal says who wrote it.");
  line(n1,"The numbers are not what tells them apart, and that is the whole point: a forgery copies a number perfectly. What it cannot copy is the seal. So ❓ If 🔏 sealed note ahead is the only honest way to choose between two notes — which is exactly what “check the sender, not the message” means.");
  row(n1,"1️⃣","Use one note","Your level is about reading a secret somebody wrote down.");
  row(n1,"2️⃣","Use two, one of them sealed","Your level is about not believing the wrong one.");

  sec("⛔ What Strikes does");
  const n2=box("gnote alt");
  row(n2,"🔓","off","A wrong code costs nothing. The player can guess forever, so keep the code under 20 or your level is a wall.");
  row(n2,"⛔","1, 2 or 3","After that many wrong codes the keypad jams, and every code after it is refused until the robot ⏱ Waits.");
  line(n2,"That one setting decides what your level is about. With Strikes off a loop can guess its way in, so the level is about looping. With Strikes on guessing is dead, so the level is about finding out — and the code had better be written somewhere.");
  line(n2,"The game checks this for you: a keypad that jams, with its code on no note, is refused before you can save it.");

  sec("🍳 Start from a board");
  const p=document.createElement("div");p.className="gsub";
  p.textContent="Tap one and it lands on your canvas, already working. Solve it, then change the numbers and the walls until it is yours.";
  el.appendChild(p);
  for(const r of CY_RECIPES){
    ccCard(el,{em:r.em,name:esc(r.name),badge:"🛠️",
      meta:'<i>teaches '+esc(r.teaches)+'</i> · '+r.gw+'×'+r.gh+' · 🧩 '+r.max+((r.strikes|0)?' · ⛔ '+(r.strikes|0):''),
      desc:esc(r.blurb),
      onTap:()=>cyApply(r)});
  }

  sec("🪜 Build one from nothing, in six taps");
  const n3=box("gnote");
  row(n3,"1","🤖 Start","Tap the left end of the middle row.");
  row(n3,"2","🧱 Wall","Tap every tile of one column except the middle one.");
  row(n3,"3","🔢 Keypad","Tap the gap you left, then tap the number under the tools and type its code.");
  row(n3,"4","📝 Note","Tap a tile in front of the keypad and give it the same number.");
  row(n3,"5","🚩 Flag","Tap the far side of the wall.");
  row(n3,"6","🧩 Blocks","Write the program yourself and press ▶.");
  line(n3,"That is a finished level. 💾 Save only opens once you have solved it yourself, which is the one rule here: nobody publishes a lock they cannot open.");

  sec("🔀 The hard version: several codes, one program");
  const n4=box("gnote alt");
  line(n4,"This is the trick the three hardest built-in levels are made of, and it is two taps.");
  row(n4,"1","⚙️ Split into inputs","Your board becomes input 1. Add another, and give that board a different code on its keypad and on its note. Up to eight.");
  row(n4,"2","One program, every board","A program that types 58 into the keypad passes the first board and fails the rest. Only a program that reads the note gets through all of them.");
  row(n4,"3","👁 Make the last one 🙈 secret","The player never sees that board at all, so they cannot study it. That is a one-time code, built by you.");
}

/* the flat guide's sheet, filled with this mode's contents instead */
const _renderGuide=window.renderGuide;
window.renderGuide=function(){
  if(!editCy())return _renderGuide();
  const el=$("guideBody"); if(!el)return;
  el.innerHTML="";
  cyGuideBody(el);
  const head=document.querySelector("#guide .m-head h3"),
        sub=document.querySelector("#guide .m-head p");
  if(head)head.textContent="Design a Cyber level";
  if(sub)sub.textContent="What every piece does, then four boards to start from.";
};
/* and the flat one puts its own words back when it renders */
const _openGuide=window.openGuide;
window.openGuide=function(){
  if(!editCy()){
    const head=document.querySelector("#guide .m-head h3"),
          sub=document.querySelector("#guide .m-head p");
    if(head)head.textContent="Design a great challenge";
    if(sub)sub.textContent="Six rules, then five boards to start from.";
  }
  return _openGuide();
};

window.CC_CYED={tools:TOOLS,check:check,setMode:setMode,levelFrom:levelFrom,
                recipes:CY_RECIPES,apply:cyApply};
})();
