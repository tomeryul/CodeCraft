"use strict";
/* ---------------- build projects (mini-games) ---------------- */
// full programming toolbox available inside every challenge (loops, conditions, variables, values)
const CHALLENGE_BLOCKS=["move","turnL","turnR","build","wait","repeat","countLoop","if","setVar","changeVar","say"];
// sorting toolbox: lift/drop instead of build — for rearranging numbered bricks
const SORT_BLOCKS=["move","turnL","turnR","pickUp","drop","wait","repeat","countLoop","if","setVar","changeVar","say"];
// creators get everything so they can design either kind of challenge
const CREATOR_BLOCKS=CHALLENGE_BLOCKS.concat(["pickUp","drop"]);
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
  return {id:"cc_"+row.id,community:row.id,em:"🌍",name:row.name,diff:2,coins:60,xp:30,
    maxBlocks:row.max_blocks,gw:row.gw,gh:row.gh,
    desc:"Community challenge by "+row.author_name+" — paint the whole blueprint within "+row.max_blocks+" blocks!",
    allowed:CHALLENGE_BLOCKS,start:{x:row.start_x,y:row.start_y,dir:row.start_dir},cells:row.cells};
}
async function loadCommunity(){
  const el=$("ccList");if(!el)return;
  if(!sbReady()){el.innerHTML='<div class="authnote">🔌 Not connected yet.</div>';return;}
  el.innerHTML='<div class="authnote">⏳ Loading challenges…</div>';
  try{
    const rows=await sbRest("challenges?select=*&order=created_at.desc&limit=30",{method:"GET"});
    el.innerHTML="";
    if(!rows.length){el.innerHTML='<div class="authnote">No challenges yet — be the first to publish one! ✏️</div>';return;}
    for(const row of rows){
      const div=document.createElement("div");div.className="quest proj";
      const solved=!!player.projects["cc_"+row.id];
      div.innerHTML='<div class="qt"><span>🌍 <b>'+esc(row.name)+'</b></span><span class="qr">🧩 '+row.max_blocks+' · ✅ '+row.solves+'</span></div>'+
        '<small class="pdesc">by '+esc(row.author_name)+(solved?" — you solved this! 🏅":"")+'</small>';
      const b=document.createElement("button");
      b.textContent=solved?"🏅 Solve again":"🌍 Try this challenge";
      b.addEventListener("click",()=>mgEnter(ccToProj(row)));
      div.appendChild(b);el.appendChild(div);
    }
  }catch(e){el.innerHTML='<div class="authnote">⚠️ Could not load: '+esc(e.message)+'</div>';}
}
function mgEnterCreator(){
  mgEnter({id:"custom",em:"✏️",name:"My Challenge",diff:2,coins:0,xp:0,maxBlocks:12,gw:8,gh:6,
    desc:"Design mode: 🖌️ Paint the target tiles, 🤖 set the robot start, 🔢 Bricks to pre-place blocks (pick a number, or “—” for a plain block) — for a sorting game place numbered blocks + paint where they must end up (they'll need to finish in order). Solve it, then 💾 Save (or 🌍 Publish).",
    allowed:CREATOR_BLOCKS,start:{x:0,y:0,dir:1},cells:[],initial:[]});
  mgState.creator=true;mgState.solved=false;mgState.paintMode="paint";mgState.brickNum=1;
  $("mgCreatorBar").classList.add("on");
  mgCreatorUI();
}
function mgCreatorUI(){
  if(!mgState||!mgState.creator)return;
  $("mgModePaint").classList.toggle("on",mgState.paintMode==="paint");
  $("mgModeBot").classList.toggle("on",mgState.paintMode==="bot");
  $("mgModeBrick").classList.toggle("on",mgState.paintMode==="brick");
  $("mgBudget").textContent=mgState.proj.maxBlocks;
  $("mgW").textContent=mgState.proj.gw;
  $("mgH").textContent=mgState.proj.gh;
  $("mgBrickN").textContent=mgState.brickNum==null?"—":mgState.brickNum;
  $("mgTitle").textContent="✏️ "+mgState.proj.name;
}
function mgSetSize(dw,dh){
  if(!mgState||!mgState.creator)return;
  const p=mgState.proj;
  p.gw=clamp(p.gw+dw,4,10); p.gh=clamp(p.gh+dh,4,8); // DB limits: gw 4-10, gh 4-8
  p.cells=p.cells.filter(c=>c[0]<p.gw&&c[1]<p.gh);
  if(p.start.x>=p.gw)p.start.x=p.gw-1;
  if(p.start.y>=p.gh)p.start.y=p.gh-1;
  mgState.robot.x=Math.min(mgState.robot.x,p.gw-1);
  mgState.robot.y=Math.min(mgState.robot.y,p.gh-1);
  mgState.solved=false;
  mgCreatorUI();mgDraw();
}
async function publishChallenge(){
  const p=mgState.proj;
  try{
    await sbRest("challenges",{method:"POST",headers:Object.assign(sbHeaders(true),{Prefer:"return=minimal"}),
      body:JSON.stringify({name:p.name,gw:p.gw,gh:p.gh,start_x:p.start.x,start_y:p.start.y,
        start_dir:p.start.dir,cells:p.cells,max_blocks:p.maxBlocks,
        author_name:(sbUser.email||"builder").split("@")[0].slice(0,20)})});
    if(window.CC_EXTRAS)CC_EXTRAS.celebrate("🌍","PUBLISHED!",p.name+" is live!","Players everywhere can now try to solve your challenge!","Awesome! 🎉");
    mgExit(true);
  }catch(e){toast("⚠️ Publish failed: "+e.message);}
}
// save the current creator design into the player's own library (persisted with
// the normal save + cloud sync). Sorting designs live here since the community
// table can't yet store pre-placed bricks.
function saveMyChallenge(){
  if(!mgState||!mgState.creator)return;
  const p=mgState.proj, sort=mgHasNumbers(p);
  if(!p.cells.length){toast("🖌️ Paint the target tiles first (where blocks must end up)!");return;}
  if(sort&&!mgState.solved){toast("🧪 Prove it's solvable first: write a program and press ▶!");return;}
  const copy=JSON.parse(JSON.stringify({
    id:"my_"+Date.now(), mine:true, em:sort?"🔢":"🧩", name:p.name, diff:2,
    coins:0, xp:0, maxBlocks:p.maxBlocks, gw:p.gw, gh:p.gh,
    allowed:p.allowed, start:p.start, cells:p.cells, initial:p.initial||[],
    desc:(sort?"Sort the numbered blocks into order ":"Fill the blueprint ")+"— your custom challenge!"}));
  player.myChallenges=player.myChallenges||[];
  player.myChallenges.push(copy);
  saveNow();
  toast("💾 Saved to “My Challenges”!");
  sfx(760,.06);
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
}
// does this project use numbered bricks (→ it's a sorting challenge)?
function mgHasNumbers(proj){return (proj.initial||[]).some(c=>c.length>2&&c[2]!=null);}
// the win target: an explicit goalOrder, or (for numbered challenges) derived as
// "the blueprint cells, row-major, must hold the brick numbers in ascending order".
function mgSortGoalOrder(proj){
  if(proj.goalOrder)return proj.goalOrder;
  if(!mgHasNumbers(proj))return null;
  const cells=proj.cells.slice().sort((a,b)=>a[1]-b[1]||a[0]-b[0]);
  const nums=proj.initial.filter(c=>c.length>2&&c[2]!=null).map(c=>c[2]).sort((a,b)=>a-b);
  const n=Math.min(cells.length,nums.length),g=[];
  for(let i=0;i<n;i++)g.push([cells[i][0],cells[i][1],nums[i]]);
  return g.length?g:null;
}
function mgEnter(proj){
  mgRobot=makeRobot(0,0,proj.name);
  mgRobot.program=(player.projPrograms[proj.id]||[]).map(b=>JSON.parse(JSON.stringify(b)));
  reUid(mgRobot.program);
  const rs={x:proj.start.x,y:proj.start.y,dir:proj.start.dir};mgSeed(rs,proj);
  mgState={proj,robot:rs,
    steps:0,running:false,frames:null,timer:null,prevMax:$("editor").classList.contains("max")};
  $("projects").classList.remove("open");
  tutSet(0); // dismiss the onboarding coach — it doesn't belong over a challenge
  $("editor").classList.add("open","max");
  $("boardTabBtn").style.display="";
  $("mgTitle").textContent=proj.em+" "+proj.name;
  $("mgGoal").textContent=proj.desc;
  selBlock=null;elseSel=null;
  renderPalette();updateChips();renderProgram();renderPy();updateUndoBtns();
  mgUpdateCount();
  setTab("board"); // show the goal & blueprint first, code is one tap away
}
function mgExit(reopen){
  if(!mgState)return;
  mgStop();
  player.projPrograms[mgState.proj.id]=mgRobot.program;
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
  const n=countBlocks(mgRobot.program);
  const over=n>mgState.proj.maxBlocks;
  const el=$("mgCount");
  el.textContent="🧩 "+n+"/"+mgState.proj.maxBlocks;
  el.style.color=over?"#ff5d73":"";
  updateChips(); // keep the block budget visible on the challenge chip while coding
}
function mgRun(){
  if(!mgState)return;
  if(mgState.running){mgStop();return;}
  const prog=mgRobot.program;
  if(!prog.length){toast("🧩 Add some blocks first!");return;}
  const n=countBlocks(prog);
  if(n>mgState.proj.maxBlocks){toast("🚫 Too many blocks ("+n+"/"+mgState.proj.maxBlocks+") — squeeze more into loops! 🔁");return;}
  setTab("board"); // watch the robot build
  mgReset();
  mgRobot.vars={};mgRobot.say=null;
  mgState.running=true;mgRobot.running=true;
  mgState.frames=[{blocks:prog,i:0,reps:1}];
  mgState.timer=setInterval(mgTick,170);
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
  if(++st.steps>500){mgStop();toast("♾️ Your program ran too long — something is looping forever!");return;}
  let guard=0;
  while(guard++<60){
    const fr=st.frames[st.frames.length-1];
    if(!fr){mgFinish();return;}
    if(fr.i>=fr.blocks.length){
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
      if(nx>=0&&ny>=0&&nx<st.proj.gw&&ny<st.proj.gh){rb.x=nx;rb.y=ny;}
    }
    else if(b.t==="turnL")rb.dir=(rb.dir+3)%4;
    else if(b.t==="turnR")rb.dir=(rb.dir+1)%4;
    else if(b.t==="build"){const kk=rb.x+"_"+rb.y;if(!rb.bricks.has(kk)){rb.bricks.add(kk);rb.brickNo[kk]=rb.nextNo++;}sfx(430,.03);}
    else if(b.t==="pickUp"){const kk=rb.x+"_"+rb.y;
      if(rb.held==null&&rb.bricks.has(kk)){rb.held=rb.brickNo[kk]!=null?rb.brickNo[kk]:rb.nextNo++;rb.bricks.delete(kk);delete rb.brickNo[kk];sfx(560,.03);}
      else sfx(200,.05);}
    else if(b.t==="drop"){const kk=rb.x+"_"+rb.y;
      if(rb.held!=null&&!rb.bricks.has(kk)){rb.bricks.add(kk);rb.brickNo[kk]=rb.held;rb.held=null;sfx(400,.03);}
      else sfx(200,.05);}
    else if(b.t==="setVar")mgRobot.vars[b.name]=resolveVal(mgRobot,b.val);
    else if(b.t==="changeVar")mgRobot.vars[b.name]=(Number(mgRobot.vars[b.name])||0)+(b.n|0);
    else if(b.t==="say")mgRobot.say={txt:String(resolveVal(mgRobot,b.val)).slice(0,24),until:1e18};
    // wait and any world-only action are harmless no-ops on the challenge grid
    fr.i++;
    mgDraw();
    return;
  }
}
function mgCond(st,c){
  if(c&&typeof c==="object"){
    const v=Number(mgRobot.vars[c.var])||0;
    return c.op===">"?v>c.val:c.op==="<"?v<c.val:v===c.val;
  }
  if(c==="blocked"){const rb=st.robot,nx=rb.x+DX[rb.dir],ny=rb.y+DY[rb.dir];return nx<0||ny<0||nx>=st.proj.gw||ny>=st.proj.gh;}
  if(c==="bagEmpty")return true; // no bag in a challenge
  return false; // world-sensing conditions don't apply on the blank grid
}
function mgFinish(){
  const st=mgState;
  mgStop();
  // sorting-style goal: each target cell must hold its required number
  const goal=mgSortGoalOrder(st.proj);
  if(goal){
    const ok=goal.every(g=>st.robot.brickNo[g[0]+"_"+g[1]]===g[2]);
    if(ok){mgSuccess();return;}
    toast("🔢 Not sorted yet — get every numbered block onto its target cell in order!");
    sfx(220,.12);return;
  }
  const bp=new Set(st.proj.cells.map(c=>c[0]+"_"+c[1]));
  const stray=[...st.robot.bricks].some(k2=>!bp.has(k2));
  const missing=[...bp].filter(k2=>!st.robot.bricks.has(k2)).length;
  if(!stray&&missing===0){mgSuccess();return;}
  if(stray)toast("🚧 A brick landed outside the plan — check your path!");
  else toast("🧱 Almost! "+missing+" tiles still missing — tweak your loops and run again!");
  sfx(220,.12);
}
function mgSuccess(){
  const proj=mgState.proj;
  if(mgState.creator){
    // creator proved their challenge is solvable
    mgState.solved=true;
    if(sbUser&&sbReady()){publishChallenge();return;}
    toast(sbReady()?"✅ It works! Log in (account box in Projects) then press 🌍 Publish!":"✅ It works! Publishing opens once online mode is connected.");
    sfx(880,.1);confetti();
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
  player.projPrograms[proj.id]=mgRobot.program;
  coins+=proj.coins;addXP(proj.xp);qProg("proj");
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
function mgDraw(){
  if(!mgState)return;
  if($("boardTab").style.display==="none")return; // board hidden — nothing to draw
  const cv=$("mgCanvas"),st=mgState,p=st.proj;
  const cw=cv.clientWidth||300;
  const cell=Math.floor(cw/p.gw);
  cv.width=p.gw*cell;cv.height=p.gh*cell;
  const g=cv.getContext("2d");
  const bp=new Set(p.cells.map(c=>c[0]+"_"+c[1]));
  for(let y=0;y<p.gh;y++)for(let x=0;x<p.gw;x++){
    g.fillStyle=(x+y)%2?"#71ba47":"#79c34e";
    g.fillRect(x*cell,y*cell,cell,cell);
    const k2=x+"_"+y;
    if(st.robot.bricks.has(k2)){
      g.fillStyle=bp.has(k2)?"#c98d4b":"#ff5d73";
      g.fillRect(x*cell+2,y*cell+2,cell-4,cell-4);
      g.fillStyle="rgba(0,0,0,.25)";g.fillRect(x*cell+2,y*cell+cell-7,cell-4,5);
      g.fillStyle="rgba(255,255,255,.3)";g.fillRect(x*cell+4,y*cell+4,cell-8,3);
      const no=st.robot.brickNo[k2];
      if(no!=null){ // stamp the brick's order number on it
        g.fillStyle="#fff";g.font="900 "+Math.floor(cell*0.42)+"px Fredoka,sans-serif";
        g.textAlign="center";g.textBaseline="middle";
        g.fillText(no,x*cell+cell/2,y*cell+cell/2+1);
      }
    }else if(bp.has(k2)){
      g.strokeStyle="rgba(255,214,107,.85)";g.lineWidth=2;g.setLineDash([5,4]);
      g.strokeRect(x*cell+3,y*cell+3,cell-6,cell-6);g.setLineDash([]);
      g.fillStyle="rgba(255,214,107,.12)";g.fillRect(x*cell+3,y*cell+3,cell-6,cell-6);
    }
  }
  // sorting goal hints: show each target's required number in its corner
  const goalHints=mgSortGoalOrder(p);
  if(goalHints)for(const gg of goalHints){
    if(st.robot.brickNo[gg[0]+"_"+gg[1]]===gg[2])continue; // already correct
    g.fillStyle="rgba(255,214,107,.9)";g.font="900 "+Math.floor(cell*0.24)+"px Fredoka,sans-serif";
    g.textAlign="right";g.textBaseline="top";
    g.fillText("→"+gg[2],gg[0]*cell+cell-4,gg[1]*cell+3);
  }
  // challenge robot
  const rb=st.robot,cx=rb.x*cell+cell/2,cy=rb.y*cell+cell/2,s=cell*.68;
  g.fillStyle="rgba(0,0,0,.2)";g.beginPath();g.ellipse(cx,cy+s*.4,s*.4,s*.14,0,0,7);g.fill();
  g.fillStyle="#ffb830";
  g.beginPath();g.roundRect?g.roundRect(cx-s/2,cy-s/2,s,s,6):g.rect(cx-s/2,cy-s/2,s,s);g.fill();
  g.fillStyle="rgba(0,0,0,.22)";g.fillRect(cx-s/2,cy+s/2-4,s,4);
  g.fillStyle="#fff";
  g.beginPath();g.arc(cx-s*.18,cy-s*.08,s*.14,0,7);g.arc(cx+s*.18,cy-s*.08,s*.14,0,7);g.fill();
  g.fillStyle="#241b45";
  const ex=DX[rb.dir]*s*.06,ey=DY[rb.dir]*s*.06;
  g.beginPath();g.arc(cx-s*.18+ex,cy-s*.08+ey,s*.07,0,7);g.arc(cx+s*.18+ex,cy-s*.08+ey,s*.07,0,7);g.fill();
  // brick being carried, floating above the robot's head
  if(rb.held!=null){
    const hs=cell*0.42, hx=cx-hs/2, hy=cy-s*0.5-hs-3;
    g.fillStyle="#e8a53a";g.fillRect(hx,hy,hs,hs);
    g.fillStyle="rgba(0,0,0,.25)";g.fillRect(hx,hy+hs-4,hs,4);
    g.fillStyle="#241b45";g.font="900 "+Math.floor(hs*0.7)+"px Fredoka,sans-serif";
    g.textAlign="center";g.textBaseline="middle";
    g.fillText(rb.held,cx,hy+hs/2);
  }
}
function renderProjects(){
  renderAuthBox();
  const el=$("projList");el.innerHTML="";
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
      div.innerHTML='<div class="qt"><span>'+p.em+' <b>'+esc(p.name)+'</b></span></div><small class="pdesc">'+esc(p.desc||"")+'</small>';
      const play=document.createElement("button");play.textContent="🏗️ Play";
      play.addEventListener("click",()=>mgEnter(p));
      const del=document.createElement("button");del.className="authbtn";del.textContent="🗑";del.style.marginLeft="6px";
      del.addEventListener("click",()=>{player.myChallenges=player.myChallenges.filter(x=>x!==p);saveNow();renderProjects();});
      div.appendChild(play);div.appendChild(del);el.appendChild(div);
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
