"use strict";
/* ---------------- build projects (mini-games) ---------------- */
// full programming toolbox available inside every challenge (loops, conditions, variables, values)
// every challenge (built-in, community, custom) gets the full toolbox — incl.
// ✊ Lift / ⤵️ Drop so bricks can be moved when PLAYING, not just while editing
const CHALLENGE_BLOCKS=["move","turnL","turnR","build","pickUp","drop","wait","repeat","forever","whileLoop","countLoop","if","setVar","changeVar","read","say","call"];
// sorting toolbox: lift/drop, no build — for rearranging numbered bricks
const SORT_BLOCKS=["move","turnL","turnR","pickUp","drop","wait","repeat","forever","whileLoop","countLoop","if","setVar","changeVar","read","say","call"];
const CREATOR_BLOCKS=CHALLENGE_BLOCKS;
const PROJECTS=[
  {id:"house",em:"🏡",name:"Big House",diff:1,coins:150,xp:60,maxBlocks:8,gw:8,gh:7,
   desc:"Lay the walls of the Big House: paint every tile of the 4×4 outline. Your robot drops a brick on the tile it's STANDING on. Budget: 8 blocks — you'll need a loop inside a loop!",
   allowed:CHALLENGE_BLOCKS,
   start:{x:2,y:2,dir:1},
   cells:[[2,2],[3,2],[4,2],[5,2],[5,3],[5,4],[5,5],[4,5],[3,5],[2,5],[2,4],[2,3]]},
  {id:"car",em:"🚗",name:"Race Car",diff:2,coins:250,xp:100,maxBlocks:12,gw:8,gh:6,needs:"house",
   desc:"Build the car body: fill the whole 5×2 plate. Paint one row, make a U-turn, paint the row back. Budget: 12 blocks.",
   allowed:CHALLENGE_BLOCKS,
   start:{x:1,y:2,dir:1},
   cells:[[1,2],[2,2],[3,2],[4,2],[5,2],[1,3],[2,3],[3,3],[4,3],[5,3]]},
  {id:"park",em:"🎡",name:"Theme Park",diff:3,coins:400,xp:160,maxBlocks:9,gw:8,gh:7,needs:"car",
   desc:"Fence the whole Theme Park: paint the 6×5 outline. The sides have DIFFERENT lengths — two loops inside one loop. Budget: 9 blocks. This is expert work!",
   allowed:CHALLENGE_BLOCKS,
   start:{x:1,y:1,dir:1},
   cells:[[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[6,2],[6,3],[6,4],[6,5],[5,5],[4,5],[3,5],[2,5],[1,5],[1,4],[1,3],[1,2]]},
  {id:"sort",em:"🔢",name:"Sort the Blocks",diff:2,coins:300,xp:120,maxBlocks:30,gw:3,gh:2,needs:"house",
   desc:"The numbered blocks are jumbled! The top row is free space. Use ✊ Lift and ⤵️ Drop to arrange them 1·2·3 across the bottom row — your very first sorting algorithm!",
   allowed:SORT_BLOCKS,
   start:{x:0,y:0,dir:1},
   initial:[[0,1,2],[1,1,3],[2,1,1]],      // pre-placed numbered bricks (x,y,number) to rearrange
   goalOrder:[[0,1,1],[1,1,2],[2,1,3]],    // each target cell must end up holding this number
   cells:[]},
];
function countBlocks(list){let n=0;for(const b of list){n++;if(b.body)n+=countBlocks(b.body);if(b.els)n+=countBlocks(b.els);}return n;}

/* ---------------- online: Supabase (email+password only, zero-dependency REST) ---------------- */
const SB={url:"https://tqeswkurpznpwefbdoig.supabase.co",key:"sb_publishable_EPoUdw-xJZClvtN61SrwnA_aTQI8Uym"}; // CodeCraft — publishable anon key, safe for client use (RLS enforced)
const SB_AUTH_KEY="codecraft_auth_v1";
let sbUser=null;
const sbReady=()=>!!(SB.url&&SB.key);
function sbHeaders(auth){
  const h={"apikey":SB.key,"Content-Type":"application/json"};
  if(auth&&sbUser)h["Authorization"]="Bearer "+sbUser.access;
  return h;
}
async function sbAuth(path,body){
  const res=await fetch(SB.url+"/auth/v1/"+path,{method:"POST",headers:sbHeaders(false),body:JSON.stringify(body)});
  const d=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(d.msg||d.error_description||d.message||("error "+res.status));
  return d;
}
function sbSaveSession(d){
  if(!d.access_token)return false;
  sbUser={email:(d.user&&d.user.email)||"",uid:(d.user&&d.user.id)||"",
    access:d.access_token,refresh:d.refresh_token,exp:Date.now()+(d.expires_in||3600)*1000};
  try{localStorage.setItem(SB_AUTH_KEY,JSON.stringify(sbUser));}catch(_){}
  return true;
}
function sbLogout(){sbUser=null;localStorage.removeItem(SB_AUTH_KEY);renderAuthBox();}
async function sbRestore(){
  try{
    const d=JSON.parse(localStorage.getItem(SB_AUTH_KEY));
    if(!d)return;
    sbUser=d;
    if(sbReady()&&Date.now()>d.exp-120000){
      const r=await sbAuth("token?grant_type=refresh_token",{refresh_token:d.refresh});
      sbSaveSession(r);
    }
  }catch(_){sbUser=null;localStorage.removeItem(SB_AUTH_KEY);}
}
async function sbRest(path,opts){
  const o=Object.assign({headers:sbHeaders(true)},opts||{});
  if(o.body&&!o.method)o.method="POST";
  const res=await fetch(SB.url+"/rest/v1/"+path,o);
  if(!res.ok){const d=await res.json().catch(()=>({}));throw new Error(d.message||("error "+res.status));}
  return res.status===204?null:res.json();
}
/* ---- cloud player save (Supabase 'saves' table, one row per user) ---- */
async function cloudLoad(){
  if(!sbUser||!sbReady())return null;
  const rows=await sbRest("saves?select=data&user_id=eq."+encodeURIComponent(sbUser.uid),{method:"GET"});
  return (rows&&rows[0])?rows[0].data:null;
}
async function cloudSave(data){
  if(!sbUser||!sbReady())return;
  await sbRest("saves?on_conflict=user_id",{method:"POST",
    headers:Object.assign(sbHeaders(true),{Prefer:"resolution=merge-duplicates,return=minimal"}),
    body:JSON.stringify({user_id:sbUser.uid,data,updated_at:new Date().toISOString()})});
}
function renderAuthBox(){
  const box=$("authBox");
  if(!sbReady()){box.innerHTML='<div class="authnote">🔌 Online accounts & shared challenges are coming online soon — everything else works offline!</div>';return;}
  if(sbUser){
    box.innerHTML='<div class="authrow">🟢 <b>'+esc(sbUser.email)+'</b><span class="spacer"></span></div>';
    const out=document.createElement("button");out.className="authbtn";out.textContent="Log out";
    out.addEventListener("click",sbLogout);
    box.firstChild.appendChild(out);
    return;
  }
  box.innerHTML='<div class="authform">'+
    '<input id="authEmail" type="email" placeholder="Email" autocomplete="email">'+
    '<input id="authPass" type="password" placeholder="Password (6+)" autocomplete="current-password">'+
    '<div class="authbtns"><button class="authbtn go" id="authLogin">Log in</button>'+
    '<button class="authbtn" id="authSignup">Sign up</button></div>'+
    '<div id="authMsg"></div></div>';
  const msg=t=>{$("authMsg").textContent=t;};
  const creds=()=>[($("authEmail").value||"").trim(),$("authPass").value||""];
  $("authLogin").addEventListener("click",async()=>{
    const[e,p]=creds();if(!e||p.length<6)return msg("Enter email and a 6+ char password");
    msg("⏳ Logging in…");
    try{sbSaveSession(await sbAuth("token?grant_type=password",{email:e,password:p}));renderAuthBox();renderProjects();toast("🟢 Welcome back!");}
    catch(err){msg("⚠️ "+err.message);}
  });
  $("authSignup").addEventListener("click",async()=>{
    const[e,p]=creds();if(!e||p.length<6)return msg("Enter email and a 6+ char password");
    msg("⏳ Creating account…");
    try{
      const d=await sbAuth("signup",{email:e,password:p});
      if(sbSaveSession(d)){renderAuthBox();renderProjects();toast("🎉 Account created!");}
      else msg("📧 Check your email to confirm, then log in!");
    }catch(err){msg("⚠️ "+err.message);}
  });
}
const CC_ALLOWED=["move","turnL","turnR","build","repeat","countLoop"];
function ccToProj(row){
  const initial=row.initial||[], sort=initial.some(c=>c.length>2&&c[2]!=null)||(row.cells||[]).some(c=>c.length>2&&c[2]!=null);
  return {id:"cc_"+row.id,community:row.id,em:sort?"🔢":"🌍",name:row.name,diff:row.diff||2,coins:60,xp:30,
    maxBlocks:row.max_blocks,gw:row.gw,gh:row.gh,
    desc:"Community challenge by "+row.author_name+(sort?" — sort the numbered blocks into order":" — paint the whole blueprint")+" within "+row.max_blocks+" blocks!",
    allowed:CHALLENGE_BLOCKS,start:{x:row.start_x,y:row.start_y,dir:row.start_dir},cells:row.cells,initial:initial,tiles:row.tiles||[]};
}
// a multi-level community challenge → a playable pack (levels stored in row.stages)
function ccToPack(row){
  return {id:"cc_"+row.id, community:row.id, em:"🎬", name:row.name, diff:row.diff||2,
    stages:JSON.parse(JSON.stringify(row.stages||[]))};
}
async function loadCommunity(){
  const el=$("ccList");if(!el)return;
  if(!sbReady()){el.innerHTML='<div class="authnote">🔌 Not connected yet.</div>';return;}
  el.innerHTML='<div class="authnote">⏳ Loading challenges…</div>';
  try{
    const rows=await sbRest("challenges?select=*&order=created_at.desc&limit=30",{method:"GET"});
    el.innerHTML="";
    if(!rows.length){el.innerHTML='<div class="authnote">No challenges yet — be the first to publish one! ✏️</div>';return;}
    const myUid=(sbUser&&sbUser.uid)||null;
    for(const row of rows){
      const div=document.createElement("div");div.className="quest proj";
      const solved=!!player.projects["cc_"+row.id];
      const multi=!!(row.stages&&row.stages.length);
      const sortC=(row.initial||[]).some(c=>c.length>2&&c[2]!=null)||(row.cells||[]).some(c=>c.length>2&&c[2]!=null);
      const em=multi?"🎬":(sortC?"🔢":"🌍");
      const mine=!!(myUid&&row.author===myUid);
      const stars="⭐".repeat(row.diff||2);
      div.innerHTML='<div class="qt"><span>'+em+' <b>'+esc(row.name)+'</b> '+stars+'</span>'+
        '<span class="qr">'+(multi?"🎬 "+row.stages.length+" lv":"🧩 "+row.max_blocks)+' · ✅ '+row.solves+'</span></div>'+
        '<small class="pdesc">by '+esc(row.author_name)+(mine?" (you)":"")+(solved?" — you solved this! 🏅":"")+'</small>';
      const b=document.createElement("button");
      b.textContent=solved?"🏅 Play again":(multi?"🎬 Play levels":"🌍 Try this challenge");
      b.addEventListener("click",()=> multi?packEnter(ccToPack(row),0):mgEnter(ccToProj(row)));
      div.appendChild(b);
      if(mine){ // authors can edit their own published challenge (add levels, tweak it)
        const ed=document.createElement("button");ed.className="authbtn";ed.textContent="✏️ Edit";ed.style.marginLeft="6px";
        ed.addEventListener("click",()=>{$("projects").classList.remove("open");mgEditCommunity(row);});
        div.appendChild(ed);
      }
      el.appendChild(div);
    }
  }catch(e){el.innerHTML='<div class="authnote">⚠️ Could not load: '+esc(e.message)+'</div>';}
}
function mgEnterCreator(){
  mgEnter({id:"custom",em:"✏️",name:"My Challenge",diff:1,coins:0,xp:0,maxBlocks:12,gw:8,gh:6,
    desc:"Design mode — pick a tool: 🖌️ target tiles · 🤖 the robot's start · 🔢 pre-placed blocks · 🧱 walls to route around · 🕳️ pits (⤵️ Drop a block in to bridge one) · 🔑 keys and 🚪 doors of the same colour · 🌀 a pair of portals · 🔘 plates that open 🚧 gates (the robot — or a block left behind — holds one down) · ➡️ one-way tiles · 🧹 erase. Then write a program and press ▶ to PROVE the level is solvable — only then do 💾 Save / ➕ Add level / 🌍 Publish open up. Build several levels for a multi-level minigame.",
    allowed:CREATOR_BLOCKS,start:{x:0,y:0,dir:1},cells:[],initial:[],tiles:[]});
  // Every creator session shares player.projPrograms["custom"], so a new challenge
  // used to open with the PREVIOUS one's program — which could then be run with ▶ and
  // "prove" a level the author never solved. Start blank; the edit flows
  // (mgEditStage / mgEditMyChallenge / mgEditCommunity) load their saved solution after this.
  if(mgRobot){mgRobot.program=[];robotRoutines(mgRobot);mgRobot.routines={A:[],B:[]};mgRobot.hist=[];mgRobot.redoS=[];}
  edTarget="main";
  mgState.creator=true;mgState.solved=false;mgState.paintMode="paint";mgState.brickNum=1;mgState.tileArg=1;
  mgState.stages=[];        // banked levels for a multi-level pack (empty = single challenge)
  mgState.editIndex=null;   // when re-editing a banked level, the slot to put it back
  mgState.editingId=null;   // when editing an already-saved My Challenges entry, its id (→ Save updates in place)
  mgState.publishId=null;   // when editing an already-published community challenge, its id (→ Publish PATCHes it)
  $("mgCreatorBar").classList.add("on");
  mgCreatorUI();
}
// open the creator loaded with a community challenge the player published, so they
// can tweak it or add levels; Publish then UPDATES that row instead of inserting.
function mgEditCommunity(row){
  mgEnterCreator();
  const p=mgState.proj;
  p.name=row.name; p.diff=row.diff||2;
  mgState.publishId=row.id;
  const stages=(row.stages&&row.stages.length)?row.stages:null;
  let sol=[]; // author's solution to reload into the editor
  if(stages){ // already multi-level: load levels into the strip, canvas empty
    mgState.stages=JSON.parse(JSON.stringify(stages));
    p.cells=[]; p.initial=[]; p.tiles=[]; p.start={x:0,y:0,dir:1};
    mgState.robot={x:0,y:0,dir:1}; mgSeed(mgState.robot,p);
  }else{ // single-level: load its blueprint onto the canvas (add ➕ levels to grow it)
    p.gw=row.gw||8; p.gh=row.gh||6; p.maxBlocks=row.max_blocks||12; p.allowed=CREATOR_BLOCKS;
    p.cells=JSON.parse(JSON.stringify(row.cells||[]));
    p.tiles=JSON.parse(JSON.stringify(row.tiles||[]));
    p.initial=JSON.parse(JSON.stringify(row.initial||[]));
    p.start={x:row.start_x||0,y:row.start_y||0,dir:row.start_dir==null?1:row.start_dir};
    mgState.robot={x:p.start.x,y:p.start.y,dir:p.start.dir}; mgSeed(mgState.robot,p);
    sol=row.solution||[]; // reload the author's own solution program (edit mode only)
  }
  mgLoadSolution(sol);
  mgState.solved=false;
  renderPalette();renderProgram();renderPy();updateUndoBtns();mgUpdateCount();
  mgCreatorUI(); mgDraw();
  toast("✏️ Editing your published challenge — your saved solution is loaded. Add ➕ levels or tweak it, prove ▶, then 🌍 Publish to update.");
}
// load a saved solution program back into the creator robot (fresh uids). Used
// only in edit mode — solving a challenge never loads it.
function mgLoadSolution(prog){
  if(!mgRobot)return;
  applyProg(mgRobot,prog);
}
// open the creator loaded with an already-saved My Challenges entry so it can be
// changed and re-saved in place (single challenge OR a multi-level pack).
function mgEditMyChallenge(entry){
  mgEnterCreator();
  const p=mgState.proj;
  p.name=entry.name; p.diff=entry.diff||1;
  mgState.editingId=entry.id;
  let sol=[];
  if(entry.pack){
    // load its levels into the strip; the canvas starts empty (tweak levels via ✏️, or ➕ add more)
    mgState.stages=JSON.parse(JSON.stringify(entry.stages||[]));
    p.cells=[]; p.initial=[]; p.tiles=[]; p.start={x:0,y:0,dir:1};
    mgState.robot={x:0,y:0,dir:1}; mgSeed(mgState.robot,p);
  }else{
    p.gw=entry.gw||8; p.gh=entry.gh||6; p.maxBlocks=entry.maxBlocks||12;
    p.allowed=entry.allowed||CREATOR_BLOCKS;
    p.cells=JSON.parse(JSON.stringify(entry.cells||[]));
    p.tiles=JSON.parse(JSON.stringify(entry.tiles||[]));
    p.initial=JSON.parse(JSON.stringify(entry.initial||[]));
    p.start=JSON.parse(JSON.stringify(entry.start||{x:0,y:0,dir:1}));
    mgState.robot={x:p.start.x,y:p.start.y,dir:p.start.dir}; mgSeed(mgState.robot,p);
    sol=entry.sol||[]; // reload the author's own solution program (edit mode only)
  }
  mgState.solved=false; // must re-prove after any change
  mgLoadSolution(sol);
  renderPalette();renderProgram();renderPy();updateUndoBtns();mgUpdateCount();
  mgCreatorUI(); mgDraw();
  toast("✏️ Editing “"+esc(entry.name)+"” — change it, prove it ▶, then 💾 Save to update.");
}
function mgSetBtn(id,on){const b=$(id);if(!b)return;b.style.opacity=on?"":".4";b.classList.toggle("locked",!on);}
// The creator's tool strip: the fixed board tools plus one chip per terrain type,
// so adding a tile type in puzzle-tiles.js adds its tool here automatically.
function mgToolList(){
  const base=[{id:"paint",em:"🖌️",lbl:"Target",num:true},
              {id:"bot",em:"🤖",lbl:"Start"},
              {id:"brick",em:"🔢",lbl:"Block",num:true}];
  const tiles=(window.CC_TILES?CC_TILES.TYPES:[]).map(t=>({id:t,em:CC_TILES.DEFS[t].em,lbl:CC_TILES.DEFS[t].lbl,
    colour:CC_TILES.DEFS[t].arg==="colour",dir:CC_TILES.DEFS[t].arg==="dir"}));
  return base.concat(tiles,[{id:"erase",em:"🧹",lbl:"Erase"}]);
}
const DIR_EM=["⬆️","➡️","⬇️","⬅️"]; // matches DX/DY: 0=N 1=E 2=S 3=W
// One shared −/+ stepper: it edits the block number for 🖌️/🔢, the colour (1-4,
// pairing keys to doors, portals to portals, plates to gates) for coloured tiles,
// and the direction for ➡️ one-way tiles.
function mgStepArg(d){
  if(!mgState)return;
  const t=mgToolList().find(x=>x.id===mgState.paintMode);
  if(t&&t.dir)mgState.tileArg=(((mgState.tileArg|0)+d)%4+4)%4;
  else if(t&&t.colour){
    const n=(mgState.tileArg||1)+d;
    mgState.tileArg=n<1?4:n>4?1:n; // wraps — only four colours
  }else if(d>0)mgState.brickNum=mgState.brickNum==null?1:Math.min(99,mgState.brickNum+1);
  else mgState.brickNum=mgState.brickNum==null?null:(mgState.brickNum<=1?null:mgState.brickNum-1);
  mgCreatorUI();
}
function mgToolsUI(){
  const el=$("mgTools");if(!el)return;
  const cur=mgState.paintMode, list=mgToolList();
  el.innerHTML="";
  for(const t of list){
    const b=document.createElement("button");
    b.className="tool"+(t.id===cur?" on":"");
    b.textContent=t.em;b.title=t.lbl;
    b.addEventListener("click",()=>{mgState.paintMode=t.id;sfx(560,.03);mgCreatorUI();});
    el.appendChild(b);
  }
  // the stepper only appears for tools that carry a value, and relabels itself
  const t=list.find(x=>x.id===cur), stp=$("mgBrickStp");
  if(stp){
    const on=!!(t&&(t.num||t.colour||t.dir));
    stp.style.display=on?"":"none";
    if(on){
      const lab=stp.querySelector(".clab");
      if(lab)lab.textContent=t.dir?"🧭 Way":t.colour?"🎨 Colour":"🔢 No.";
      $("mgBrickN").textContent=t.dir?DIR_EM[(mgState.tileArg|0)%4]
        :t.colour?(mgState.tileArg||1)
        :(mgState.brickNum==null?"—":mgState.brickNum);
    }
  }
}
function mgCreatorUI(){
  if(!mgState||!mgState.creator)return;
  mgToolsUI();
  const p=mgState.proj;
  $("mgBudget").textContent=p.maxBlocks;
  $("mgW").textContent=p.gw;
  $("mgH").textContent=p.gh;
  // (#mgBrickN is owned by mgToolsUI — it shows a block number or a colour)
  const dl=["","⭐ Easy","⭐⭐ Medium","⭐⭐⭐ Hard"];
  if($("mgDiff"))$("mgDiff").textContent=dl[p.diff||1];
  const banked=(mgState.stages&&mgState.stages.length)||0, editing=mgState.editIndex!=null;
  if($("mgStageInfo"))$("mgStageInfo").textContent=editing?("✏️"+(mgState.editIndex+1)):(banked+1);
  if($("mgAddStage"))$("mgAddStage").textContent=editing?"➕ Update level":"➕ Add level";
  $("mgTitle").textContent="✏️ "+p.name+(banked?" · 🎬"+(banked+(editing?0:1)):"");
  // ---- gate Save / Add / Publish behind proving the level solvable ----
  const curHas=p.cells.length||(p.initial&&p.initial.length);
  const solved=!!mgState.solved;
  const canSaveCur=curHas&&solved;               // current design proven
  mgSetBtn("mgAddStage",canSaveCur);             // must prove before banking
  mgSetBtn("mgSave",canSaveCur||(banked>0&&!curHas)); // proven current, or already-proven banked levels
  // Publish (or Update) — available once there's proven content: a proven single
  // level, or one or more banked levels (a multi-level challenge). Hidden only
  // while a banked level is pulled out for editing.
  const canPublish=(canSaveCur||banked>0)&&!editing;
  const pub=$("mgPublish");
  if(pub){pub.style.display=canPublish?"":"none"; pub.textContent=mgState.publishId?"🌍 Update":"🌍 Publish";}
  renderMgLevels();
}
// the strip of banked levels with ✏️ edit / 🗑 delete
function renderMgLevels(){
  const el=$("mgLevels"); if(!el)return;
  const st=mgState.stages||[];
  if(!st.length){el.style.display="none";el.innerHTML="";return;}
  el.style.display="flex";
  el.innerHTML='<span class="clab">🎬 Levels</span>';
  st.forEach((s,i)=>{
    const chip=document.createElement("span");
    chip.className="lvchip"+(mgState.editIndex===i?" ed":"");
    chip.innerHTML=(s.em||"🧩")+' <b>'+(i+1)+'</b> '+
      '<button data-e="'+i+'" title="Edit level">✏️</button><button data-d="'+i+'" title="Delete level">🗑</button>';
    el.appendChild(chip);
  });
  el.querySelectorAll("[data-e]").forEach(b=>b.addEventListener("click",()=>mgEditStage(+b.dataset.e)));
  el.querySelectorAll("[data-d]").forEach(b=>b.addEventListener("click",()=>mgDeleteStage(+b.dataset.d)));
}
// pull a banked level back into the editor to tweak it (remembering its slot)
function mgEditStage(i){
  if(!mgState||!mgState.creator)return;
  const st=mgState.stages||[]; if(i<0||i>=st.length)return;
  const s=st[i], p=mgState.proj;
  p.cells=JSON.parse(JSON.stringify(s.cells||[]));
  p.tiles=JSON.parse(JSON.stringify(s.tiles||[]));
  p.initial=JSON.parse(JSON.stringify(s.initial||[]));
  p.start=JSON.parse(JSON.stringify(s.start||{x:0,y:0,dir:1}));
  p.gw=s.gw;p.gh=s.gh;p.maxBlocks=s.maxBlocks;if(s.diff)p.diff=s.diff;
  const sol=s.sol||[];       // this level's saved solution
  // Leave it in `stages`. It used to be spliced out and only put back by
  // "➕ Update level", so exiting or editing a different level lost it silently.
  mgState.editIndex=i;
  mgState.robot={x:p.start.x,y:p.start.y,dir:p.start.dir};mgSeed(mgState.robot,p);
  mgState.solved=false;
  mgLoadSolution(sol);
  renderPalette();renderProgram();renderPy();updateUndoBtns();mgUpdateCount();
  toast("✏️ Editing Level "+(i+1)+" — your solution is loaded; tweak it, run ▶ to prove it, then ➕ Update level.");
  sfx(520,.04);mgCreatorUI();mgDraw();
}
function mgDeleteStage(i){
  if(!mgState||!mgState.creator)return;
  const st=mgState.stages||[]; if(i<0||i>=st.length)return;
  if(!confirm("Delete Level "+(i+1)+"?"))return;
  st.splice(i,1);
  if(mgState.editIndex!=null){ if(i===mgState.editIndex)mgState.editIndex=null; else if(i<mgState.editIndex)mgState.editIndex--; }
  sfx(300,.05);toast("🗑 Level removed.");
  mgCreatorUI();mgDraw();
}
// a self-contained snapshot of the current creator design (one level of a pack)
function snapshotStage(p){
  const sort=mgHasNumbers(p);
  return JSON.parse(JSON.stringify({
    em:sort?"🔢":"🧩", name:p.name, diff:p.diff||1, maxBlocks:p.maxBlocks, gw:p.gw, gh:p.gh,
    allowed:p.allowed, start:p.start, cells:p.cells, initial:p.initial||[], tiles:p.tiles||[],
    sol:(mgRobot?packProg(mgRobot):[]), // author's proving solution — loaded only in edit mode
    desc:(sort?"Sort the numbered blocks into order":"Fill the whole blueprint")}));
}
// bank the current design as a level and clear the board for the next one
function mgAddStage(){
  if(!mgState||!mgState.creator)return;
  const p=mgState.proj;
  if(!p.cells.length&&!(p.initial&&p.initial.length)){toast("🖌️ Design this level first — paint tiles or 🔢 place blocks.");sfx(200,.06);return;}
  if(!mgState.solved){toast("▶ First prove this level is solvable — write a program and run it, then it can be added!");sfx(200,.06);return;}
  mgState.stages=mgState.stages||[];
  if(mgState.editIndex!=null&&mgState.editIndex<mgState.stages.length){ // replace the level in place
    const idx=mgState.editIndex;
    mgState.stages[idx]=snapshotStage(p);
    mgState.editIndex=null;
    toast("✅ Level "+(idx+1)+" updated!");
  }else{
    mgState.stages.push(snapshotStage(p));
    toast("🎬 Level "+mgState.stages.length+" banked — design the next, then 💾 Save the pack!");
  }
  // reset the canvas for the next level (keep size / budget / difficulty / name)
  p.cells=[]; p.initial=[]; p.tiles=[]; p.start={x:0,y:0,dir:1};
  mgState.robot={x:0,y:0,dir:1}; mgSeed(mgState.robot,p);
  mgState.solved=false;
  if(mgRobot)mgRobot.program=[];
  renderProgram();mgUpdateCount();
  sfx(680,.05);sfx(880,.05,.08);
  mgCreatorUI(); mgDraw();
}
/* ---------------- creator: painting the board ----------------
   Every tool goes through mgPaintTile, which is the SINGLE place that clears
   mgState.solved — so a newly added tool can never forget to re-lock
   Save / Add level / Publish after the design changed. */
function mgPaintTile(x,y){
  const st=mgState, p=st.proj, k=x+"_"+y, mode=st.paintMode;
  const tool=(window.CC_TILES&&CC_TILES.DEFS[mode])?mode:null; // a terrain tool?
  if(mode==="bot"){
    // only SOLID terrain is a problem — a key, portal, plate or arrow is walkable,
    // so the robot is allowed to start on one
    const t=mgTileAt(p,x,y);
    if(t&&mgProbeSolid(t[2],t[3]||0,x,y)){
      toast("🚧 The robot can't start on "+(CC_TILES.DEFS[t[2]]||{lbl:"terrain"}).lbl.toLowerCase()+" — pick an open tile!");return;}
    p.start={x,y,dir:1};
    st.robot.x=x;st.robot.y=y;st.robot.dir=1;
  }else if(mode==="brick"){
    p.initial=p.initial||[];
    const i=p.initial.findIndex(c=>c[0]===x&&c[1]===y);
    if(i>=0)p.initial.splice(i,1);
    else{mgClearTile(p,x,y);p.initial.push(st.brickNum!=null?[x,y,st.brickNum]:[x,y]);}
    mgSeed(st.robot,p); // re-seed so the new bricks render immediately
  }else if(mode==="erase"){
    mgClearTile(p,x,y);
    const i=p.cells.findIndex(c=>c[0]===x&&c[1]===y);
    if(i>=0)p.cells.splice(i,1);
    mgSeed(st.robot,p);
  }else if(tool){
    // terrain: tapping the same type again removes it, a different type replaces it
    p.tiles=p.tiles||[];
    const def=CC_TILES.DEFS[tool];
    const arg=def.arg==="colour"?(st.tileArg||1):def.arg==="dir"?(st.tileArg|0)%4:0;
    const i=p.tiles.findIndex(t=>t[0]===x&&t[1]===y);
    const had=i>=0?p.tiles[i]:null;
    if(i>=0)p.tiles.splice(i,1);
    // same tool AND same colour = remove; a different colour re-labels it
    if(!had||had[2]!==tool||(had[3]||0)!==arg){
      if(p.start.x===x&&p.start.y===y&&mgProbeSolid(tool,arg,x,y))
        toast("🤖 The robot starts here — move it first!");
      else{mgClearTile(p,x,y);p.tiles.push([x,y,tool,arg]);}
    }
    mgSeed(st.robot,p);
  }else{ // 🖌️ paint a target tile
    if(mgTileAt(p,x,y)){toast("🧱 There's terrain here — 🧹 erase it first.");}
    else{
      const i=p.cells.findIndex(c=>c[0]===x&&c[1]===y);
      if(i>=0){
        const curN=p.cells[i].length>2?p.cells[i][2]:null;
        if(curN===st.brickNum)p.cells.splice(i,1);
        else p.cells[i]=st.brickNum!=null?[x,y,st.brickNum]:[x,y];
      }else p.cells.push(st.brickNum!=null?[x,y,st.brickNum]:[x,y]);
    }
  }
  st.solved=false;      // design changed — must re-prove (re-locks Save/Publish)
  st.caseBase=null;     // ...and any board snapshot taken by a previous run is now void
  sfx(500,.03);mgDraw();mgCreatorUI();
}
// Would a tile of this type block the robot on an empty board? Answered with a
// COMPLETE probe state — a gate's solid() calls platesPressed, which iterates
// rs.tiles, so a partial stub threw "rs.tiles is not iterable".
function mgProbeSolid(type,arg,x,y){
  const def=window.CC_TILES&&CC_TILES.DEFS[type];
  if(!def||!def.solid)return false;
  const probe={keys:new Set(),bricks:new Set(),open:new Set(),tiles:new Map(),x:-1,y:-1};
  probe.tiles.set(x+"_"+y,{t:type,a:arg});
  return !!def.solid(probe,x+"_"+y,{t:type,a:arg});
}
function mgTileAt(p,x,y){return (p.tiles||[]).find(t=>t[0]===x&&t[1]===y)||null;}
function mgTileMap(p){const m=new Map();for(const t of (p.tiles||[]))m.set(t[0]+"_"+t[1],{t:t[2],a:t[3]||0});return m;}
// a cell holds ONE thing: placing terrain wipes the target/brick there and vice versa
function mgClearTile(p,x,y){
  p.tiles=(p.tiles||[]).filter(t=>!(t[0]===x&&t[1]===y));
  p.initial=(p.initial||[]).filter(c=>!(c[0]===x&&c[1]===y));
}
function mgSetSize(dw,dh){
  if(!mgState||!mgState.creator)return;
  const p=mgState.proj;
  p.gw=clamp(p.gw+dw,4,10); p.gh=clamp(p.gh+dh,4,8); // DB limits: gw 4-10, gh 4-8
  p.cells=p.cells.filter(c=>c[0]<p.gw&&c[1]<p.gh);
  p.initial=(p.initial||[]).filter(c=>c[0]<p.gw&&c[1]<p.gh);
  p.tiles=(p.tiles||[]).filter(t=>t[0]<p.gw&&t[1]<p.gh); // a clipped-off wall would block invisibly
  mgState.caseBase=null; // the board changed shape — drop any snapshot of the old one
  if(p.start.x>=p.gw)p.start.x=p.gw-1;
  if(p.start.y>=p.gh)p.start.y=p.gh-1;
  mgState.robot.x=Math.min(mgState.robot.x,p.gw-1);
  mgState.robot.y=Math.min(mgState.robot.y,p.gh-1);
  mgState.solved=false;
  mgCreatorUI();mgDraw();
}
// publish (insert) a new community challenge, or UPDATE (PATCH) one the player is
// editing. Supports multi-level challenges: extra levels ride along in `stages`
// while the top-level columns mirror the FIRST level (so old clients still play it).
async function publishChallenge(){
  const p=mgState.proj, diff=p.diff||2;
  const banked=mgState.stages||[];
  const curHas=p.cells.length||(p.initial&&p.initial.length);
  // multi-level only when there are banked levels; a lone current design stays single
  let stages=[];
  if(banked.length)stages=(curHas&&mgState.solved)?banked.concat([snapshotStage(p)]):banked.slice();
  const multi=stages.length>0;
  const base=multi?stages[0]:{cells:p.cells,initial:p.initial||[],tiles:p.tiles||[],start:p.start,maxBlocks:p.maxBlocks,gw:p.gw,gh:p.gh};
  // author's solution: level 1's for the top-level column (multi levels keep their own sol in `stages`)
  const solution=multi?(base.sol||[]):((mgRobot&&mgRobot.program)?JSON.parse(JSON.stringify(mgRobot.program)):[]);
  const body={name:p.name,gw:base.gw,gh:base.gh,start_x:base.start.x,start_y:base.start.y,start_dir:base.start.dir,
    cells:base.cells,initial:base.initial||[],tiles:base.tiles||[],max_blocks:base.maxBlocks,diff,stages:multi?stages:[],solution,
    author_name:(sbUser.email||"builder").split("@")[0].slice(0,20)};
  try{
    if(mgState.publishId){ // update the player's already-published challenge
      await sbRest("challenges?id=eq."+encodeURIComponent(mgState.publishId),{method:"PATCH",
        headers:Object.assign(sbHeaders(true),{Prefer:"return=minimal"}),
        body:JSON.stringify(Object.assign({updated_at:new Date().toISOString()},body))});
      if(window.CC_EXTRAS)CC_EXTRAS.celebrate("🌍","UPDATED!",p.name+" is updated!","Your changes are live for everyone who plays it!","Nice! 🎉");
      else bigToast("🌍 Updated “"+p.name+"”!");
    }else{
      await sbRest("challenges",{method:"POST",headers:Object.assign(sbHeaders(true),{Prefer:"return=minimal"}),body:JSON.stringify(body)});
      if(window.CC_EXTRAS)CC_EXTRAS.celebrate("🌍","PUBLISHED!",p.name+" is live!","Players everywhere can now try to solve your challenge!","Awesome! 🎉");
    }
    mgExit(true);
  }catch(e){toast("⚠️ Publish failed: "+e.message);}
}
// save the current creator design into the player's own library (persisted with
// the normal save + cloud sync). Sorting designs live here since the community
// table can't yet store pre-placed bricks.
function saveMyChallenge(){
  if(!mgState||!mgState.creator)return;
  const p=mgState.proj, sort=mgHasNumbers(p), diff=p.diff||1;
  const curHas=p.cells.length||(p.initial&&p.initial.length);
  const banked=mgState.stages||[];
  // Save unlocks only once a level is proven solvable: the current design must be
  // solved to be saved/included; a pack of already-proven banked levels can save
  // even with the current canvas empty.
  if(curHas&&!mgState.solved){toast("▶ First prove it's solvable — write a program and run it, then 💾 Save opens up!");sfx(200,.06);return;}
  if(!curHas&&!banked.length){toast("🖌️ Design a level and solve it first, then Save it!");return;}
  player.myChallenges=player.myChallenges||[];
  const editId=mgState.editingId||null;
  // save a fresh entry, or replace the one being edited (keeping its id + position)
  const commit=(entry,doneMsg)=>{
    if(editId){
      entry.id=editId;
      const i=player.myChallenges.findIndex(x=>x.id===editId);
      if(i>=0)player.myChallenges[i]=entry; else player.myChallenges.push(entry);
    }else player.myChallenges.push(entry);
    saveNow();
    toast((editId?"✅ Updated ":doneMsg)); sfx(760,.06);
  };
  // multi-level pack: one or more banked levels (+ the current one if it has content)
  if(banked.length){
    const stages=curHas?banked.concat([snapshotStage(p)]):banked.slice();
    if(!stages.length){toast("🎬 Add at least one level first!");return;}
    const pack=JSON.parse(JSON.stringify({
      id:"my_"+Date.now(), mine:true, pack:true, em:"🎬", name:p.name, diff,
      stages, desc:stages.length+" levels · "+["","Easy","Medium","Hard"][diff]+" — your multi-level minigame!"}));
    commit(pack,"🎬 Saved “"+p.name+"” — "+stages.length+" levels!");
    sfx(1040,.06,.08);
    return;
  }
  // single challenge — proven solvable above
  if(!curHas){toast("🖌️ Paint target tiles or 🔢 place some blocks first!");return;}
  const copy=JSON.parse(JSON.stringify({
    id:"my_"+Date.now(), mine:true, em:sort?"🔢":"🧩", name:p.name, diff,
    coins:0, xp:0, maxBlocks:p.maxBlocks, gw:p.gw, gh:p.gh,
    allowed:p.allowed, start:p.start, cells:p.cells, initial:p.initial||[], tiles:p.tiles||[],
    sol:(mgRobot?packProg(mgRobot):[]), // author's solution (loaded only when editing)
    desc:(sort?"Sort the numbered blocks into order ":"Fill the blueprint ")+"— your custom challenge!"}));
  commit(copy,"💾 Saved to “My Challenges”!");
}
// ---- play a multi-level pack: run its levels in sequence (like the Academy) ----
function packEnter(pack,i){
  const stage=JSON.parse(JSON.stringify(pack.stages[i]));
  stage.id="pack_"+pack.id+"_"+i; // per-level program storage
  mgEnter(stage);
  mgState.packCtx={packId:pack.id,i,total:pack.stages.length,name:pack.name,em:pack.em,stages:pack.stages,
    community:pack.community||null,coins:pack.coins||0,xp:pack.xp||0};
  mgState.proj.name=pack.name+" — Level "+(i+1)+"/"+pack.stages.length;
  $("mgTitle").textContent=(pack.em||"🎬")+" "+mgState.proj.name;
}
function packStageSolved(){
  const c=mgState.packCtx, next=c.i+1;
  confetti();sfx(760,.08);sfx(1040,.09,.09);
  if(next<c.total){
    bigToast("✅ Level "+(c.i+1)+" complete! Next: Level "+(next+1)+"/"+c.total);
    setTimeout(()=>{ if(mgState)packEnter({id:c.packId,name:c.name,em:c.em,stages:c.stages,community:c.community,coins:c.coins,xp:c.xp},next); },700);
  }else{
    if(c.community&&!player.projects["cc_"+c.community]){ // first clear of a community pack: count the solve
      player.projects["cc_"+c.community]=1;
      sbRest("rpc/add_solve",{method:"POST",body:JSON.stringify({cid:c.community})}).catch(()=>{});
    }
    // first clear pays out the chapter's reward (packs used to award nothing at all)
    let earned=0;
    if(!player.projects["pack_"+c.packId]){
      player.projects["pack_"+c.packId]=1;
      if(c.coins){coins+=c.coins;earned=c.coins;coinFlash();}
      if(c.xp)addXP(c.xp);
      qProg("proj");updateHud();saveNow();
    }
    if(window.CC_EXTRAS)CC_EXTRAS.celebrate(c.em||"🎬","CHAPTER COMPLETE!",c.name,
      (earned?"+"+earned+" 🪙 +"+c.xp+" ⭐ — ":"")+"You cleared all "+c.total+" levels! 🎉","Awesome! 🎉");
    else bigToast("🎬 "+c.name+" complete — all "+c.total+" levels cleared!");
    mgExit(true);
  }
}
// (re)build the challenge robot's brick state, seeding any pre-placed numbered
// bricks from proj.initial. bricks = Set of "x_y"; brickNo = {"x_y":order#};
// held = number being carried (null if empty hand); nextNo = next auto number.
function mgSeed(rs,proj){
  rs.bricks=new Set(); rs.brickNo={}; rs.held=null; rs.nextNo=1;
  if(proj.initial)for(const c of proj.initial){
    const kk=c[0]+"_"+c[1]; rs.bricks.add(kk);
    if(c.length>2&&c[2]!=null){ rs.brickNo[kk]=c[2]; if(c[2]>=rs.nextNo)rs.nextNo=c[2]+1; } // numbered brick
  }
  // tutorial props: choppable trees + collectable gems (Academy stages)
  rs.trees=new Set((proj.trees||[]).map(c=>c[0]+"_"+c[1]));
  rs.items=new Set((proj.items||[]).map(c=>c[0]+"_"+c[1]));
  // puzzle terrain (walls, pits, …). Absent on every pre-existing project → empty board.
  if(window.CC_TILES)CC_TILES.seed(rs,proj);
  else{rs.tiles=new Map();rs.keys=new Set();rs.open=new Set();}
}
// can the robot stand on this cell? (grid bounds + solid terrain)
function mgWalkable(st,x,y){
  if(x<0||y<0||x>=st.proj.gw||y>=st.proj.gh)return false;
  return !(window.CC_TILES&&CC_TILES.solid(st.robot,x+"_"+y));
}
// does this project use numbered bricks / numbered target cells (→ numbers matter)?
function mgHasNumbers(proj){return (proj.initial||[]).some(c=>c.length>2&&c[2]!=null)||(proj.cells||[]).some(c=>c.length>2&&c[2]!=null);}
// the win target: an explicit goalOrder, or the Paint-mode per-cell target numbers,
// or (for pre-placed numbered bricks) derived as "the blueprint cells, row-major,
// must hold the brick numbers in ascending order".
function mgSortGoalOrder(proj){
  if(proj.goalOrder)return proj.goalOrder;
  // Paint mode: the author tapped cells while a number was selected, so each of
  // those cells must hold that exact brick number.
  const explicit=(proj.cells||[]).filter(c=>c.length>2&&c[2]!=null).map(c=>[c[0],c[1],c[2]]);
  if(explicit.length)return explicit;
  if(!(proj.initial||[]).some(c=>c.length>2&&c[2]!=null))return null;
  const cells=proj.cells.slice().sort((a,b)=>a[1]-b[1]||a[0]-b[0]);
  const nums=proj.initial.filter(c=>c.length>2&&c[2]!=null).map(c=>c[2]).sort((a,b)=>a-b);
  const n=Math.min(cells.length,nums.length),g=[];
  for(let i=0;i<n;i++)g.push([cells[i][0],cells[i][1],nums[i]]);
  return g.length?g:null;
}
function mgEnter(proj0){
  // Own a private copy. Two callers hand us LIVE objects — the PROJECTS entry and a
  // saved player.myChallenges entry — so anything that writes to mgState.proj during
  // play (the test-case loop does) would corrupt the built-in level for the session,
  // or worse, mutate persisted save data.
  const proj=JSON.parse(JSON.stringify(proj0));
  mgRobot=makeRobot(0,0,proj.name);
  applyProg(mgRobot,player.projPrograms[proj.id]);
  // a level may HAND the player a starter routine (e.g. a ready-made 🔧 Swap) so the
  // exercise is writing the algorithm, not re-deriving its primitive. Only applied
  // when they have nothing of their own saved for this level yet.
  if(proj.preset&&!mgRobot.program.length&&!ROUTINE_IDS.some(id=>mgRobot.routines[id].length))
    applyProg(mgRobot,proj.preset);
  const rs={x:proj.start.x,y:proj.start.y,dir:proj.start.dir};mgSeed(rs,proj);
  mgState={proj,robot:rs,
    steps:0,running:false,frames:null,timer:null,prevMax:$("editor").classList.contains("max")};
  $("projects").classList.remove("open");
  tutSet(0); // dismiss the onboarding coach — it doesn't belong over a challenge
  $("editor").classList.add("open","max");
  $("boardTabBtn").style.display="";
  $("mgTitle").textContent=proj.em+" "+proj.name;
  $("mgGoal").textContent=proj.desc+(proj.question?"  ❓ "+proj.question:"");
  selBlock=null;elseSel=null;
  renderPalette();updateChips();renderProgram();renderPy();updateUndoBtns();
  mgUpdateCount();
  // a multi-input level shows its FIRST input, and the verdict strip up front, so
  // it's obvious from the start that one program has to handle all of them
  mgState.cases=mgCases(proj);mgState.ci=0;mgState.results=[];mgState.failAt=-1;mgState.costs=[];
  if(mgState.cases.length>1)mgApplyCase(mgState.cases[0]);
  mgCaseStrip();mgVarsUI();
  $("mgCost").innerHTML="";
  $("mgSpeedBtn").textContent="⏱ "+(player.mgSpeed||1)+"×";
  setTab("board"); // show the goal & blueprint first, code is one tap away
}
function mgExit(reopen){
  if(!mgState)return;
  mgStop();
  player.projPrograms[mgState.proj.id]=packProg(mgRobot);
  const wasMax=mgState.prevMax;
  mgState=null;mgRobot=null;
  $("boardTabBtn").style.display="none";
  $("mgCreatorBar").classList.remove("on");
  setTab("blocks");
  if(!wasMax)$("editor").classList.remove("max");
  selBlock=null;elseSel=null;
  renderPalette();updateChips();renderProgram();renderPy();updateUndoBtns();
  saveSoon();
  if(reopen!==false){
    $("editor").classList.remove("open");
    renderProjects();$("projects").classList.add("open");
  }
}
function mgReset(){
  if(!mgState)return;
  const p=mgState.proj;
  const rs={x:p.start.x,y:p.start.y,dir:p.start.dir};mgSeed(rs,p);
  mgState.robot=rs;
  mgState.steps=0;mgDraw();
}
function mgUpdateCount(){
  if(!mgState)return;
  const n=progSize(mgRobot);
  const over=n>mgState.proj.maxBlocks;
  const el=$("mgCount");
  el.textContent="🧩 "+n+"/"+mgState.proj.maxBlocks;
  el.style.color=over?"#ff5d73":"";
  updateChips(); // keep the block budget visible on the challenge chip while coding
}
/* ---------------- test cases: one program, many inputs ----------------
   A level may ship several starting boards. The SAME program runs against every
   one of them and only passes if it solves them all — which is the difference
   between an algorithm and a lucky hardcoded path. A level with no `cases` has a
   single implicit case, so it behaves exactly as it always did. */
function mgCases(proj){const c=proj&&proj.cases;return (c&&c.length)?c:[null];} // null = the level's own board
// swap the board over to a case. Never touches the caller's data — mgEnter cloned it.
function mgApplyCase(c){
  const st=mgState,p=st.proj;
  st.caseExpect=(c&&c.expect!=null)?c.expect:p.expect; // the answer this input should produce
  // A single-input level (mgCases returned [null]) has nothing to swap: the board IS
  // the level. Touching it here used to overwrite live edits — in the creator, painting
  // a block then pressing ▶ restored a stale snapshot and the block vanished.
  if(!c){mgReset();return;}
  // Snapshot by VALUE. The creator replaces these arrays rather than mutating them
  // (mgClearTile/mgSetSize/mgEditStage all reassign), so holding references went stale.
  if(!st.caseBase)st.caseBase=JSON.parse(JSON.stringify(
    {initial:p.initial,start:p.start,cells:p.cells,tiles:p.tiles,gw:p.gw,gh:p.gh,goal:p.goal||null}));
  const b=st.caseBase, pick=k=>JSON.parse(JSON.stringify((c&&c[k])?c[k]:b[k]));
  p.initial=pick("initial");p.start=pick("start");p.cells=pick("cells");p.tiles=pick("tiles");
  // a case may also resize the board and move the goal — that's how "escape ANY maze"
  // can hand the same program four mazes of different shapes
  p.gw=pick("gw");p.gh=pick("gh");if(b.goal||(c&&c.goal))p.goal=pick("goal");
  mgReset();
}
// a compact label for an input, so a failure can name the case that broke
function mgCaseLabel(c,i){
  const init=(c&&c.initial)||(mgState&&mgState.caseBase&&mgState.caseBase.initial)||[];
  const nums=init.filter(x=>x.length>2&&x[2]!=null).map(x=>x[2]);
  if(nums.length)return nums.join(" ");                       // "3 1 2" — the data itself
  if(c&&c.start)return "start "+c.start.x+","+c.start.y;       // cases that move the robot
  return "#"+(i+1);
}
// start (or restart) the frame stack for the current case
function mgStartCase(fast){
  const st=mgState;
  st.frames=[{blocks:mgRobot.program,i:0,reps:1}];
  st.steps=0;st.wait=0;
  mgRobot.vars={};mgRobot.say=null;mgRobot.curUid=null;
  st.running=true;mgRobot.running=true;
  clearInterval(st.timer);st.timer=null;
  // ⏭ Step mode drives mgTick by hand, so no timer at all
  if(!st.stepping){
    const base=fast?60:170;
    st.timer=setInterval(mgTick,Math.max(25,Math.round(base/(player.mgSpeed||1))));
  }
  mgCaseStrip();mgVarsUI();
}
/* ---------------- the instruments ----------------
   You cannot design an algorithm you cannot watch. A sort is 60+ steps and all
   of its meaning is in the variables, so: step one action at a time, change the
   speed, see the variables, and see how the cost grows with the input. */
function mgStep(){
  if(!mgState)return;
  const st=mgState;
  if(!st.running){                       // first tap: set the run up, then advance once
    const prog=mgRobot.program;
    if(!progSize(mgRobot)){toast("🧩 Add some blocks first!");return;}
    setTab("board");
    st.cases=mgCases(st.proj);st.ci=0;st.results=[];st.failMsg=null;st.failAt=-1;st.costs=[];
    st.stepping=true;
    mgApplyCase(st.cases[0]);
    mgStartCase(false);
  }else{clearInterval(st.timer);st.timer=null;st.stepping=true;} // pause a live run
  mgTick();
  if(mgState){mgVarsUI();updateChips();updateFab();}
}
function mgSpeedCycle(){
  const steps=[1,2,4];
  player.mgSpeed=steps[(steps.indexOf(player.mgSpeed||1)+1)%steps.length];
  $("mgSpeedBtn").textContent="⏱ "+player.mgSpeed+"×";
  if(mgState&&mgState.running&&mgState.timer)mgStartCase(mgState.ci>0);
  saveSoon();
}
// the robot's variables, live, right under the board
function mgVarsUI(){
  const el=$("mgVars");if(!el)return;
  const v=(mgRobot&&mgRobot.vars)||{},ks=Object.keys(v);
  const rb=mgState&&mgState.robot; // `held` lives on the BOARD state, not on mgRobot
  // bail only when there is genuinely nothing to show — a carried block counts even
  // when the program hasn't set any variables yet
  if(!ks.length&&!(rb&&rb.held!=null)){el.innerHTML="";return;}
  el.innerHTML=ks.slice(0,8).map(k=>'<span class="vchip">📦 '+esc(k)+" = "+esc(String(v[k]))+"</span>").join("")+
    (rb&&rb.held!=null?'<span class="vchip">✊ holding '+rb.held+"</span>":"");
}
// how many steps each input cost — the same program, bigger rows
function mgCostUI(){
  const el=$("mgCost");if(!el)return;
  const st=mgState,cs=(st&&st.cases)||[],costs=(st&&st.costs)||[];
  if(!st||cs.length<2||!costs.length){el.innerHTML="";return;}
  const max=Math.max.apply(null,costs.concat([1]));
  const size=c=>((c&&c.initial)||(st.caseBase&&st.caseBase.initial)||[]).length;
  el.innerHTML='<div class="ctitle">⏱ How much work each row took:</div>'+
    cs.map((c,i)=>{
      const n=size(c),st2=costs[i]||0;
      return '<div class="crow"><span class="clbl">'+(n?n+" blocks":"input "+(i+1))+
        '</span><span class="cbar" style="width:'+Math.round(st2/max*58)+'%"></span><span>'+st2+" steps</span></div>";
    }).join("");
}
// the per-case ✓/✗ strip above the board (only when there's more than one case)
function mgCaseStrip(){
  const el=$("mgCases");if(!el)return;
  const st=mgState, cs=(st&&st.cases)||[];
  if(!st||cs.length<2){el.style.display="none";el.innerHTML="";return;}
  el.style.display="";
  el.innerHTML=cs.map((c,i)=>{
    const r=st.results?st.results[i]:undefined;
    const cls=r===true?"ok":r===false?"bad":(i===st.ci&&st.running)?"now":"";
    const mark=r===true?"✓":r===false?"✗":(i===st.ci&&st.running)?"▶":"○";
    const lab=(c&&c.hidden)?"?":esc(mgCaseLabel(c,i));
    return '<span class="lvchip casechip '+cls+'">'+mark+" "+lab+'</span>';
  }).join("");
}
function mgRun(){
  if(!mgState)return;
  if(mgState.running){mgStop();return;}
  const prog=mgRobot.program;
  if(!prog.length){toast("🧩 Add some blocks first!");return;}
  const n=progSize(mgRobot);
  if(n>mgState.proj.maxBlocks){toast("🚫 Too many blocks ("+n+"/"+mgState.proj.maxBlocks+") — squeeze more into loops! 🔁");return;}
  setTab("board"); // watch the robot build
  mgState.cases=mgCases(mgState.proj);
  mgState.ci=0;mgState.results=[];mgState.failMsg=null;mgState.failAt=-1;mgState.costs=[];
  mgState.stepping=false;               // ▶ takes over from ⏭ Step
  $("mgCost").innerHTML="";
  mgApplyCase(mgState.cases[0]);
  mgStartCase(false);
  sfx(520,.06);updateChips();updateFab();
}
function mgStop(){
  if(!mgState)return;
  clearInterval(mgState.timer);mgState.timer=null;
  mgState.running=false;
  if(mgRobot){mgRobot.running=false;mgRobot.curUid=null;}
  updateChips();updateFab();
}
function mgTick(){
  const st=mgState;
  if(!st||!st.running)return;
  if(++st.steps>500){
    mgStop();
    // A ♾️ program is SUPPOSED to run out of steps — it wins early when the goal
    // is met, so reaching the cap just means it isn't there yet. Judge it properly
    // instead of scolding, so the player gets the specific "what's missing" nudge.
    if(st.frames&&st.frames.some(f=>f.reps===Infinity)){mgFinish();return;}
    // A runaway on one input means THAT input failed — not that the whole run is
    // void. Go through mgFinish so the remaining cases still get their turn.
    if(st.cases&&st.cases.length>1){mgFinish();return;}
    toast("♾️ Your program ran too long — something is looping forever!");return;
  }
  if(st.wait>0){st.wait--;mgDraw();return;} // ⏱️ Wait holds the robot still for n ticks
  let guard=0;
  while(guard++<60){
    const fr=st.frames[st.frames.length-1];
    if(!fr){mgFinish();return;}
    if(fr.i>=fr.blocks.length){
      // a 🔄 While frame re-checks its condition here and falls out when it's false
      if(fr.wc!==undefined&&!mgCond(st,fr.wc)){st.frames.pop();const pw=st.frames[st.frames.length-1];if(pw){pw.i++;continue;}mgFinish();return;}
      if(fr.reps===Infinity){fr.i=0;continue;}
      if(fr.reps>1){
        fr.reps--;fr.i=0;
        if(fr.cv!==undefined){fr.cur++;mgRobot.vars[fr.cv]=fr.cur;}
        continue;
      }
      st.frames.pop();
      const p=st.frames[st.frames.length-1];
      if(p){p.i++;continue;}
      mgFinish();return;
    }
    const b=fr.blocks[fr.i];
    if(b.t==="repeat"){
      const times=b.src?Math.floor(Number(mgRobot.vars[b.src])||0):Math.max(1,b.n|0);
      if(!b.body.length||times<1){fr.i++;continue;}
      st.frames.push({blocks:b.body,i:0,reps:times});continue;
    }
    if(b.t==="call"){
      const body=(mgRobot.routines&&mgRobot.routines[b.fn])||[];
      if(!body.length){fr.i++;continue;}
      if(st.frames.length>30){ // recursion without a base case — say so, don't hang
        mgStop();toast("🔁 Routine "+b.fn+" called itself too many times — it never stops!");return;
      }
      mgRobot.curUid=b.uid;
      st.frames.push({blocks:body,i:0,reps:1});continue;
    }
    if(b.t==="whileLoop"){
      // re-tests its condition every pass: an endless frame tagged with the cond,
      // popped by the frame-exhausted branch above the moment it goes false
      if(!b.body.length||!mgCond(st,b.cond)){fr.i++;continue;}
      mgRobot.curUid=b.uid;
      st.frames.push({blocks:b.body,i:0,reps:Infinity,wc:b.cond});continue;
    }
    if(b.t==="forever"){
      // same shape as the world interpreter: an endless frame. The program never
      // drains its stack, so the goal is checked after every action instead.
      if(!b.body.length){fr.i++;continue;}
      mgRobot.curUid=b.uid;
      st.frames.push({blocks:b.body,i:0,reps:Infinity});continue;
    }
    if(b.t==="countLoop"){
      if(!b.body.length||(b.to|0)<1){fr.i++;continue;}
      mgRobot.vars[b.name]=1;
      st.frames.push({blocks:b.body,i:0,reps:Math.max(1,b.to|0),cv:b.name,cur:1});continue;
    }
    if(b.t==="if"){
      const br=mgCond(st,b.cond)?b.body:(b.els||[]);
      if(br.length){mgRobot.curUid=b.uid;st.frames.push({blocks:br,i:0,reps:1});}
      else fr.i++;
      continue;
    }
    mgRobot.curUid=b.uid;
    const rb=st.robot;
    if(b.t==="move"){
      const nx=rb.x+DX[rb.dir],ny=rb.y+DY[rb.dir];
      const oneWay=window.CC_TILES&&!CC_TILES.canLeave(rb,rb.x,rb.y,rb.dir);
      if(oneWay)sfx(180,.05); // standing on a ➡️ one-way tile, facing the wrong way
      else if(mgWalkable(st,nx,ny)){
        rb.x=nx;rb.y=ny;
        // the tile may relocate the robot (portals) or hand it something (keys)
        if(window.CC_TILES){
          const to=CC_TILES.enter(st,rb,nx+"_"+ny);
          if(to){const q=to.split("_");rb.x=+q[0];rb.y=+q[1];}
        }
      }else sfx(180,.05); // bumped into a wall / the edge
    }
    else if(b.t==="turnL")rb.dir=(rb.dir+3)%4;
    else if(b.t==="turnR")rb.dir=(rb.dir+1)%4;
    else if(b.t==="build"){const kk=rb.x+"_"+rb.y;if(!rb.bricks.has(kk)){rb.bricks.add(kk);rb.brickNo[kk]=rb.nextNo++;}sfx(430,.03);}
    else if(b.t==="pickUp"){const kk=rb.x+"_"+rb.y;
      if(rb.held==null&&rb.bricks.has(kk)){rb.held=rb.brickNo[kk]!=null?rb.brickNo[kk]:rb.nextNo++;rb.bricks.delete(kk);delete rb.brickNo[kk];sfx(560,.03);}
      else sfx(200,.05);}
    else if(b.t==="drop"){const kk=rb.x+"_"+rb.y, ka=(rb.x+DX[rb.dir])+"_"+(rb.y+DY[rb.dir]);
      // a pit straight ahead takes priority: dropping into the gap bridges it,
      // which is the only way across (the robot can't stand on an open pit).
      if(rb.held!=null&&window.CC_TILES&&CC_TILES.openPit(rb,ka)){
        rb.bricks.add(ka);rb.brickNo[ka]=rb.held;rb.held=null;sfx(300,.07);}
      else if(rb.held!=null&&!rb.bricks.has(kk)){rb.bricks.add(kk);rb.brickNo[kk]=rb.held;rb.held=null;sfx(400,.03);}
      else sfx(200,.05);}
    else if(b.t==="chop"){ // fell a tree on the tile the robot stands on, else the one it faces
      const kk=rb.x+"_"+rb.y, ka=(rb.x+DX[rb.dir])+"_"+(rb.y+DY[rb.dir]);
      const hit=rb.trees&&(rb.trees.has(kk)?kk:rb.trees.has(ka)?ka:null);
      if(hit){rb.trees.delete(hit);sfx(300,.05);}else sfx(200,.04);}
    else if(b.t==="collect"){ // gather a gem on the current tile, else the one ahead
      const kk=rb.x+"_"+rb.y, ka=(rb.x+DX[rb.dir])+"_"+(rb.y+DY[rb.dir]);
      const hit=rb.items&&(rb.items.has(kk)?kk:rb.items.has(ka)?ka:null);
      if(hit){rb.items.delete(hit);sfx(660,.05);}else sfx(200,.04);}
    else if(b.t==="read")mgRobot.vars[b.name]=mgReadSrc(st,b.src);
    else if(b.t==="setVar")mgRobot.vars[b.name]=resolveVal(mgRobot,b.val);
    else if(b.t==="changeVar")mgRobot.vars[b.name]=(Number(mgRobot.vars[b.name])||0)+changeBy(mgRobot,b);
    else if(b.t==="say")mgRobot.say={txt:String(resolveVal(mgRobot,b.val)).slice(0,24),until:1e18};
    else if(b.t==="wait")st.wait=Math.max(0,(b.n|0)-1); // this tick counts as the first
    // any remaining world-only action is a harmless no-op on the challenge grid
    fr.i++;
    mgDraw();mgVarsUI();
    // A ♾️ Forever program never runs out of blocks, so the goal can't be checked
    // when the stack empties — check it after every action instead. This is also
    // what makes "loop until it's done" puzzles work.
    // via mgFinish, not mgSuccess — the run may still have other inputs to try
    if(st.frames.some(f=>f.reps===Infinity)&&mgGoalMet(st)){mgFinish();return;}
    return;
  }
}
// Sensors a challenge robot can actually answer. The world robot keeps its own
// CONDS list (blocks.js) — mixing them would put dead sensors in both palettes.
const CHALLENGE_CONDS=["blocked","wallAhead","pitAhead","doorAhead","keyAhead","gateAhead","onPlate","brickHere","onTarget","holding","treeAhead"];
// Only the sensors THIS level can answer, so the tap-to-cycle list stays short and
// a player never meets a condition that can never be true. Reads proj (stable), not
// the mutating robot state, so the list doesn't change mid-run.
function mgCondList(){
  if(!mgState)return CONDS;
  const p=mgState.proj, has=c=>(p.tiles||[]).some(t=>t[2]===c);
  const L=["blocked","brickHere","onTarget","holding"];
  if(has("wall"))L.push("wallAhead");
  if(has("pit"))L.push("pitAhead");
  if(has("door"))L.push("doorAhead");
  if(has("key"))L.push("keyAhead");
  if(has("gate"))L.push("gateAhead");
  if(has("plate"))L.push("onPlate");
  if((p.trees||[]).length)L.push("treeAhead");
  return L;
}
// 📖 Read — the only path from the board INTO a variable. This is what makes the
// grid a data structure a program can inspect (and so what makes sorting,
// searching and counting expressible at all). Missing values read as 0.
function mgReadSrc(st,src){
  const rb=st.robot, kh=rb.x+"_"+rb.y, ka=(rb.x+DX[rb.dir])+"_"+(rb.y+DY[rb.dir]);
  if(src==="held")return rb.held!=null?rb.held:0;
  if(src==="x")return rb.x;
  if(src==="y")return rb.y;
  const k=src==="ahead"?ka:kh;
  return rb.brickNo[k]!=null?rb.brickNo[k]:0;
}
function mgCond(st,c){
  if(c&&typeof c==="object"){
    const v=Number(mgRobot.vars[c.var])||0, w=condRhs(mgRobot,c);
    return c.op===">"?v>w:c.op==="<"?v<w:v===w;
  }
  const rb=st.robot, ax=rb.x+DX[rb.dir], ay=rb.y+DY[rb.dir];
  const ka=ax+"_"+ay, kh=rb.x+"_"+rb.y, T=window.CC_TILES;
  switch(c){
    case "blocked":   return !mgWalkable(st,ax,ay);
    case "wallAhead": {const t=T&&T.at(rb,ka);return !!(t&&t.t==="wall");}
    case "pitAhead":  return !!(T&&T.openPit(rb,ka));
    // "a door I can't open yet" — so `if doorAhead → go find the key` is a
    // complete program shape, and the sensor goes quiet once the key is held
    case "doorAhead": {const t=T&&T.at(rb,ka);return !!(t&&t.t==="door"&&!rb.keys.has(t.a));}
    case "keyAhead":  {const t=T&&T.at(rb,ka);return !!(t&&t.t==="key");}
    case "gateAhead": {const t=T&&T.at(rb,ka);return !!(t&&t.t==="gate"&&!T.platesPressed(rb,t.a));}
    case "onPlate":   {const t=T&&T.at(rb,kh);return !!(t&&t.t==="plate");}
    case "treeAhead": return !!(rb.trees&&rb.trees.has(ka));
    case "brickHere": return rb.bricks.has(kh);
    case "onTarget":  return (st.proj.cells||[]).some(c2=>c2[0]===rb.x&&c2[1]===rb.y);
    case "holding":   return rb.held!=null;
    case "bagEmpty":  return rb.held==null;  // "empty hands" is the challenge-grid reading
    case "bagFull":   return rb.held!=null;
  }
  return false; // world-only sensors don't apply on the challenge grid
}
// A block that was dropped into a pit has been spent as bridge material, and one
// left on a pressure plate is doing a job — neither is a "brick outside the plan".
function mgStray(st,bp){
  const T=window.CC_TILES, rs=st.robot;
  const doingAJob=k2=>{
    if(!T)return false;
    if(T.isFilledPit(rs,k2))return true;
    const t=T.at(rs,k2);
    return !!(t&&t.t==="plate");
  };
  return [...rs.bricks].some(k2=>!bp.has(k2)&&!doingAJob(k2));
}
// The single source of truth for "is this level solved?", returning both the
// verdict and the nudge to show when it isn't. mgGoalMet() is the pure predicate
// (used by ♾️ Forever programs, which never run out of blocks to check at the end).
function mgCheck(st){
  // A board with nothing to achieve is never "won" — otherwise a ♾️ Forever
  // program would instantly succeed on a blank creator canvas.
  if(!st.proj.goalType&&!(st.proj.cells||[]).length&&!(st.proj.initial||[]).length)
    return {ok:false,msg:"🖌️ Nothing to build yet — paint some target tiles first!"};
  // "answer" goals: the level asks a QUESTION and the robot must 💬 Say the right
  // value. The goal is a computed result rather than an arrangement of blocks, which
  // is what makes sum / count / max / search levels possible at all.
  if(st.proj.goalType==="answer"){
    const want=st.caseExpect,said=mgRobot&&mgRobot.say?String(mgRobot.say.txt):null;
    if(want==null)return {ok:false,msg:"⚠️ This level is missing its expected answer."};
    return {ok:said!==null&&said===String(want),
      msg:said===null?"💬 Say your answer at the end — the robot has to tell us the number!"
        :"❌ You answered "+said+", but that's not right for this row. Check your algorithm!"};
  }
  // Academy goals: reach the flag / chop every tree / collect every gem
  if(st.proj.goalType){
    const rb=st.robot,gt=st.proj.goalType;
    let ok=false;
    if(gt==="reach")ok=!!(st.proj.goal&&rb.x===st.proj.goal[0]&&rb.y===st.proj.goal[1]);
    else if(gt==="chop")ok=!!(rb.trees&&rb.trees.size===0);
    else if(gt==="collect")ok=!!(rb.items&&rb.items.size===0);
    return {ok,msg:gt==="reach"?"🚩 Not on the flag yet — guide the robot onto it, then run again!":
      gt==="chop"?"🌳 Trees still standing — make sure the robot chops every one!":
      "💎 Gems left behind — collect them all!"};
  }
  // Paint mode with per-cell target numbers: numbered cells must hold that exact
  // number, plain target cells just need a brick, and nothing may land off-plan.
  const numCells=(st.proj.cells||[]).filter(c=>c.length>2&&c[2]!=null);
  if(numCells.length){
    const bp2=new Set(st.proj.cells.map(c=>c[0]+"_"+c[1]));
    const stray=mgStray(st,bp2);
    const numOk=numCells.every(c=>st.robot.brickNo[c[0]+"_"+c[1]]===c[2]);
    const filled=st.proj.cells.every(c=>st.robot.bricks.has(c[0]+"_"+c[1]));
    return {ok:!stray&&numOk&&filled,
      msg:stray?"🚧 A brick landed outside the plan — check your path!":
        !numOk?'🔢 Match every "→n" target — each numbered tile needs that exact block!':
        "🧱 Almost! Fill every target tile, then run again!"};
  }
  // sorting-style goal: each target cell must hold its required number
  const goal=mgSortGoalOrder(st.proj);
  if(goal){
    return {ok:goal.every(g=>st.robot.brickNo[g[0]+"_"+g[1]]===g[2]),
      msg:"🔢 Not sorted yet — get every numbered block onto its target cell in order!"};
  }
  const bp=new Set(st.proj.cells.map(c=>c[0]+"_"+c[1]));
  const stray=mgStray(st,bp);
  const missing=[...bp].filter(k2=>!st.robot.bricks.has(k2)).length;
  return {ok:!stray&&missing===0,
    msg:stray?"🚧 A brick landed outside the plan — check your path!":
      "🧱 Almost! "+missing+" tiles still missing — tweak your loops and run again!"};
}
function mgGoalMet(st){return mgCheck(st||mgState).ok;}
// End of a case: record the verdict, then either move on to the next input or
// deliver the overall result. This is no longer terminal — with several cases the
// program is re-run on each one before anything is celebrated.
function mgFinish(){
  const st=mgState;
  mgStop();
  // tolerate being called without mgRun having set the case state up (the smoke
  // suite drives mgTick/mgFinish by hand in a dozen places)
  if(!st.cases){st.cases=mgCases(st.proj);st.ci=0;st.results=[];st.costs=[];st.failAt=-1;}
  const r=mgCheck(st);
  st.results[st.ci]=r.ok;
  st.costs[st.ci]=st.steps;
  if(!r.ok&&st.failAt<0){st.failAt=st.ci;st.failMsg=r.msg;}
  mgCaseStrip();
  if(st.ci+1<st.cases.length){        // more inputs to try — same program, next board
    st.ci++;
    mgApplyCase(st.cases[st.ci]);
    mgStartCase(true);
    return;
  }
  mgCostUI(); // every input has run — show what each one cost
  const total=st.cases.length, passed=st.results.filter(Boolean).length;
  if(passed===total){mgSuccess();return;}
  if(total>1){
    const c=st.cases[st.failAt];
    const on=(c&&c.hidden)?"the secret test":mgCaseLabel(c,st.failAt);
    bigToast("🧪 Passed "+passed+"/"+total+" — failed on "+on+". One program has to solve them all!");
    toast(st.failMsg);
  }else toast(st.failMsg);
  sfx(220,.12);
}
function mgSuccess(){
  const proj=mgState.proj;
  if(proj.tut){academySolved(proj);return;} // Academy stage: record + advance to the next lesson
  if(mgState.packCtx){packStageSolved();return;} // multi-level pack: advance to the next level
  if(mgState.creator){
    // creator proved their level is solvable — this UNLOCKS Save / Add level /
    // Publish. We never auto-publish; the player chooses what to do next.
    mgState.solved=true;
    sfx(880,.1);confetti();
    const banked=(mgState.stages&&mgState.stages.length)||0;
    bigToast("✅ Solvable! Now 💾 Save"+(mgState.editIndex!=null?" or ➕ Update level":" or ➕ Add level")+(sbReady()&&banked===0?" or 🌍 Publish":"")+".");
    mgCreatorUI(); // refresh button states (Save / Add / Publish now available)
    return;
  }
  if(proj.mine){ // solving your own saved challenge — celebrate, no farmable reward
    confetti();
    if(window.CC_EXTRAS)CC_EXTRAS.celebrate(proj.em,"SOLVED!",proj.name,"You solved your own challenge! 🎉","Nice! 🎉");
    else bigToast("🎉 Solved your challenge!");
    mgExit(true);
    return;
  }
  if(proj.community){
    const first=!player.projects[proj.id];
    player.projects[proj.id]=1;
    if(first){coins+=proj.coins;addXP(proj.xp);}
    confetti();coinFlash();updateHud();saveNow();
    sbRest("rpc/add_solve",{method:"POST",body:JSON.stringify({cid:proj.community})}).catch(()=>{});
    if(window.CC_EXTRAS)CC_EXTRAS.celebrate("🌍","CHALLENGE SOLVED!",proj.name,(first?"+"+proj.coins+" 🪙 +"+proj.xp+" ⭐ — ":"")+"You beat a challenge made by another player!","Sweet! 🎉");
    mgExit(true);
    return;
  }
  player.projects[proj.id]=1;
  player.projPrograms[proj.id]=packProg(mgRobot);
  // a level opened outside its pack has no reward of its own — never let that
  // turn the player's coin total into NaN
  coins+=(proj.coins|0);addXP(proj.xp|0);qProg("proj");
  // the finished build appears in the real world near home
  let placed=false;
  for(let rad=2;rad<=7&&!placed;rad++)for(let dy=-rad;dy<=rad&&!placed;dy++)for(let dx=-rad;dx<=rad&&!placed;dx++){
    if(Math.max(Math.abs(dx),Math.abs(dy))!==rad)continue;
    const x=homePos.x+dx,y=homePos.y+dy;
    if(inB(x,y)&&canWalk(x,y)&&!objects.has(key(x,y))){objects.set(key(x,y),{type:"proj",em:proj.em});placed=true;}
  }
  confetti();coinFlash();updateHud();saveNow();
  if(window.CC_EXTRAS)CC_EXTRAS.celebrate(proj.em,"PROJECT COMPLETE!",proj.name+" built!","+"+proj.coins+" 🪙 +"+proj.xp+" ⭐ — it now stands proudly next to your home base!","Amazing! 🎉");
  else bigToast("🎉 "+proj.name+" built! +"+proj.coins+" 🪙");
  mgExit(true);
}
// deterministic per-cell hash (independent of the world seed) for grass texture
function mgHash(x,y){let h=(x*374761393+y*668265263)^0x9e3779b9;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;}
function mgDraw(){
  if(!mgState)return;
  if($("boardTab").style.display==="none")return; // board hidden — nothing to draw
  const cv=$("mgCanvas"),st=mgState,p=st.proj;
  const cw=cv.clientWidth||300;
  const cell=Math.floor(cw/p.gw);
  const CW=p.gw*cell, CH=p.gh*cell;
  // render at device-pixel resolution so the board is crisp/HD on retina, then
  // draw in CSS-pixel space (same handling as the main game canvas)
  const dpr=(typeof DPR!=="undefined"?DPR:Math.min(3,window.devicePixelRatio||1));
  cv.width=Math.round(CW*dpr);cv.height=Math.round(CH*dpr);
  cv.style.height=CH+"px";
  const g=cv.getContext("2d");
  g.setTransform(dpr,0,0,dpr,0,0);
  g.imageSmoothingEnabled=true;g.imageSmoothingQuality="high";
  const bp=new Set((p.cells||[]).map(c=>c[0]+"_"+c[1]));
  const GR=(typeof GRASS!=="undefined")?GRASS:["#79c34e","#71ba47","#7fc957"];
  const T=(typeof now!=="undefined"?now:Date.now());
  // ---- HD grass, matching the open world (base tone + specks + flecks) ----
  for(let y=0;y<p.gh;y++)for(let x=0;x<p.gw;x++){
    const px=x*cell,py=y*cell;
    g.fillStyle=GR[(x*31+y*17)%3];
    g.fillRect(px,py,cell+1,cell+1);
    const h1=mgHash(x,y),h2=mgHash(x*3+1,y),h3=mgHash(x,y*5+2);
    g.fillStyle="rgba(38,96,24,.28)";
    g.fillRect(px+h1*(cell-6)+2,py+h2*(cell-8)+2,2,5);
    g.fillRect(px+h3*(cell-6)+2,py+h1*(cell-8)+2,2,4);
    if(h2<.14){g.fillStyle="rgba(255,255,255,.5)";g.fillRect(px+h3*(cell-8)+3,py+h2*(cell-8)+3,3,3);}
  }
  // vignette so the board reads as a framed little world (CSS-px space)
  const vg=g.createRadialGradient(CW/2,CH/2,cell,CW/2,CH/2,Math.max(CW,CH)*.72);
  vg.addColorStop(0,"rgba(0,0,0,0)");vg.addColorStop(1,"rgba(0,0,0,.14)");
  g.fillStyle=vg;g.fillRect(0,0,CW,CH);
  // ---- puzzle terrain (walls, pits) — under the plan so targets read on top ----
  if(window.CC_TILES)CC_TILES.draw(g,st.robot,cell);
  // ---- blueprint target outlines (unbuilt cells) ----
  for(const c of (p.cells||[])){
    const k2=c[0]+"_"+c[1]; if(st.robot.bricks.has(k2))continue;
    const px=c[0]*cell,py=c[1]*cell;
    g.fillStyle="rgba(255,214,107,.12)";rr(g,px+4,py+4,cell-8,cell-8,cell*.16);g.fill();
    g.strokeStyle="rgba(255,214,107,.9)";g.lineWidth=2;g.setLineDash([6,5]);g.lineDashOffset=-T/60;
    rr(g,px+4,py+4,cell-8,cell-8,cell*.16);g.stroke();g.setLineDash([]);g.lineDashOffset=0;
  }
  // ---- placed bricks (HD toy-bevel, like world builds) ----
  for(const k2 of st.robot.bricks){
    const q=k2.split("_");
    // Stray-red means "this is a mistake". A block is only a mistake when there IS
    // a blueprint to violate — on a puzzle level with no target tiles, blocks are
    // tools. A block that bridged a pit is never a mistake either.
    const ok=bp.size===0||bp.has(k2)||!!(window.CC_TILES&&CC_TILES.isFilledPit(st.robot,k2));
    drawBoardBrick(g,(+q[0])*cell,(+q[1])*cell,cell,ok,st.robot.brickNo[k2]);
  }
  // sorting goal hints: show each target's required number in its corner
  const goalHints=mgSortGoalOrder(p);
  if(goalHints)for(const gg of goalHints){
    if(st.robot.brickNo[gg[0]+"_"+gg[1]]===gg[2])continue; // already correct
    g.fillStyle="rgba(255,214,107,.95)";g.font="900 "+Math.floor(cell*0.24)+"px Fredoka,sans-serif";
    g.textAlign="right";g.textBaseline="top";
    g.fillText("→"+gg[2],gg[0]*cell+cell-4,gg[1]*cell+3);
  }
  // ---- Academy props via HD emoji sprites (goal flag, trees, gems) ----
  const spr=(ch,gx,gy,frac,bob)=>{const s=sprite(ch,cell*frac);g.drawImage(s,gx*cell+cell/2-s.lw/2,gy*cell+cell/2-s.lw/2+(bob||0),s.lw,s.lw);};
  if(p.goal&&p.goalType==="reach"){
    const gx=p.goal[0],gy=p.goal[1],ccx=gx*cell+cell/2,ccy=gy*cell+cell/2;
    const rg=g.createRadialGradient(ccx,ccy,2,ccx,ccy,cell*.5);
    rg.addColorStop(0,"rgba(255,214,107,.5)");rg.addColorStop(1,"rgba(255,214,107,0)");
    g.fillStyle=rg;g.fillRect(gx*cell,gy*cell,cell,cell);
    spr("🚩",gx,gy,.72,Math.sin(T/400)*1.5);
  }
  if(st.robot.trees)for(const k of st.robot.trees){const q=k.split("_");
    // little shadow + gentle wind sway, like world trees
    g.fillStyle="rgba(0,0,0,.14)";g.beginPath();g.ellipse((+q[0])*cell+cell/2,(+q[1]+1)*cell-cell*.14,cell*.28,cell*.08,0,0,7);g.fill();
    spr("🌳",+q[0],+q[1],.86,Math.sin(T/900+(+q[0]*3))*0);}
  if(st.robot.items)for(const k of st.robot.items){const q=k.split("_");spr("💎",+q[0],+q[1],.6,Math.sin(T/300+(+q[0]))*2);}
  // ---- robot — the open-world look ----
  const rb=st.robot;
  drawBoardRobot(g,rb.x*cell+cell/2,rb.y*cell+cell/2,cell*.72,rb.dir,ROBOT_COLORS[0],!!mgState.running,T);
  // brick being carried, floating above the robot's head
  if(rb.held!=null){
    const hs=cell*0.52, cxp=rb.x*cell+cell/2, hy=rb.y*cell+cell/2-cell*.55-hs+Math.sin(T/260)*2;
    drawBoardBrick(g,cxp-hs/2,hy,hs,true,rb.held);
  }
}
function renderProjects(){
  renderAuthBox();
  const el=$("projList");el.innerHTML="";
  if(typeof renderAcademySection==="function")renderAcademySection(el); // 🎓 starter tutorials first
  if(typeof renderPuzzleSection==="function")renderPuzzleSection(el);   // 🧩 then the puzzle campaign
  const bh=document.createElement("h4");bh.className="qsec";bh.textContent="🏗️ Build Projects";el.appendChild(bh);
  for(const p of PROJECTS){
    const done=!!player.projects[p.id];
    const locked=p.needs&&!player.projects[p.needs];
    const div=document.createElement("div");div.className="quest proj"+(locked?" locked":"");
    div.innerHTML='<div class="qt"><span>'+p.em+' <b>'+p.name+'</b> '+"⭐".repeat(p.diff)+'</span>'+
      '<span class="qr">+'+p.coins+'🪙 +'+p.xp+'⭐</span></div>'+
      '<small class="pdesc">'+p.desc+'</small>';
    const b=document.createElement("button");
    if(done){b.textContent="✅ Built! Enter again";}
    else if(locked){b.textContent="🔒 Finish "+PROJECTS.find(x=>x.id===p.needs).name+" first";b.disabled=true;}
    else b.textContent="🏗️ Enter workshop";
    if(!locked)b.addEventListener("click",()=>mgEnter(p));
    div.appendChild(b);
    el.appendChild(div);
  }
  // player's own saved challenges (incl. sorting games) — persisted + cloud-synced
  if(player.myChallenges&&player.myChallenges.length){
    const mh=document.createElement("h4");mh.className="qsec";mh.textContent="🛠️ My Challenges";el.appendChild(mh);
    for(const p of player.myChallenges){
      const div=document.createElement("div");div.className="quest proj";
      const stars="⭐".repeat(p.diff||1);
      const badge=p.pack?'<span class="qr">🎬 '+p.stages.length+' levels</span>':'';
      div.innerHTML='<div class="qt"><span>'+p.em+' <b>'+esc(p.name)+'</b> '+stars+'</span>'+badge+'</div><small class="pdesc">'+esc(p.desc||"")+'</small>';
      const play=document.createElement("button");play.textContent=p.pack?"🎬 Play levels":"🏗️ Play";
      play.addEventListener("click",()=>p.pack?packEnter(p,0):mgEnter(p));
      const edit=document.createElement("button");edit.className="authbtn";edit.textContent="✏️ Edit";edit.style.marginLeft="6px";
      edit.addEventListener("click",()=>{$("projects").classList.remove("open");mgEditMyChallenge(p);});
      const del=document.createElement("button");del.className="authbtn";del.textContent="🗑";del.style.marginLeft="6px";
      del.addEventListener("click",()=>{if(!confirm("Delete “"+p.name+"”?"))return;player.myChallenges=player.myChallenges.filter(x=>x!==p);saveNow();renderProjects();});
      div.appendChild(play);div.appendChild(edit);div.appendChild(del);el.appendChild(div);
    }
  }
  // create-your-own + community section
  const cb=document.createElement("button");cb.id="ccCreate";
  cb.innerHTML="✏️ <b>Create your own challenge</b> — design a blueprint for other players!";
  cb.addEventListener("click",()=>{$("projects").classList.remove("open");mgEnterCreator();});
  el.appendChild(cb);
  const hh=document.createElement("h4");hh.className="qsec";
  hh.innerHTML='🌍 Community Challenges <button id="ccRefresh" class="authbtn" style="float:right">↻</button>';
  el.appendChild(hh);
  const cc=document.createElement("div");cc.id="ccList";el.appendChild(cc);
  hh.querySelector("#ccRefresh").addEventListener("click",loadCommunity);
  loadCommunity();
}
