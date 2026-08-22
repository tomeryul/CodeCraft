"use strict";
/* =====================================================================
   Moderation for community challenges
   ---------------------------------------------------------------------
   The app publishes player-made levels to a public list. Both app stores
   require three things of anything that does that, and none existed: a
   way to REPORT content, a way to BLOCK an author, and a route by which
   offending content actually goes away. In a children's app the absence
   of those is a rejection, not a note.

   Everything here assumes nobody is on call. Three independent reports
   hide a level server-side (report_challenge is SECURITY DEFINER, so the
   counter and the flag are not client-writable), and a block is stored
   per account so it follows the child to their next device.

   It also closes a privacy hole that mattered more than any of it: a
   published level used to be signed with the local part of the author's
   EMAIL, which for a child is very often their real name.
   ===================================================================== */

/* ---------------- the nickname ----------------
   Chosen, never derived. Letters, digits, spaces and a dash — enough to
   be a name, not enough to be an email, a URL or a phone number. */
const NICK_MAX=16;
function nickClean(s){
  return String(s||"").replace(/[^A-Za-z0-9 \-֐-׿]/g,"").replace(/\s+/g," ").trim().slice(0,NICK_MAX);
}
function nickOf(){
  const n=nickClean(player.nick);
  return n||"builder";
}
// asked once, before the first publish — and re-askable from the shop
function askNick(force){
  const cur=nickClean(player.nick);
  if(cur&&!force)return cur;
  const t=prompt("Pick a name to sign your challenges with.\n\nOther players will see this — don't use your real name, your school or anything private.",cur||"");
  if(t===null)return cur;
  const n=nickClean(t);
  if(!n){toast("✏️ Letters and numbers only, please.");return cur;}
  player.nick=n;saveNow();
  toast("✅ You'll sign your challenges as “"+n+"”.");
  return n;
}

/* ---------------- a name filter at publish time ----------------
   Not a content policy — a first sieve, so the obvious cases never reach
   the list at all. Anything it lets through is what reporting is for. */
const NAME_BAD=/(fuck|shit|bitch|cunt|nigg|rape|porn|sex|penis|vagina|whore|slut|kill your|kys)/i;
const NAME_PII=/(\d{6,}|@[a-z0-9.\-]+\.[a-z]{2,}|https?:|www\.|instagram|tiktok|snapchat|whatsapp)/i;
function nameOk(name){
  const s=String(name||"").trim();
  if(s.length<2)return "Give it a name first.";
  if(NAME_BAD.test(s))return "That name isn't allowed — pick something else.";
  if(NAME_PII.test(s))return "Names can't contain links, contact details or long numbers.";
  return null;
}

/* ---------------- the block list ----------------
   Held per account so it survives a reinstall, and cached locally so a
   list can be filtered before the network answers. */
let blockedIds=new Set();
function isBlocked(uid){return !!(uid&&blockedIds.has(uid));}
async function loadBlocks(){
  blockedIds=new Set(player.blocked||[]);
  if(!sbReady()||!sbUser)return blockedIds;
  try{
    const rows=await sbRest("user_blocks?select=blocked",{method:"GET"});
    // MERGE, never replace. A block is a promise to the child that they will
    // not see that person again; replacing the local set with the server's
    // answer breaks that promise the moment a block was made offline, or the
    // insert lost a race with this read.
    const local=[...blockedIds];
    for(const r of rows)blockedIds.add(r.blocked);
    player.blocked=[...blockedIds];saveSoon();
    // push anything the server has not heard about yet
    const known=new Set(rows.map(r=>r.blocked));
    for(const id of local){
      if(known.has(id))continue;
      try{await sbRest("rpc/block_author",{method:"POST",body:JSON.stringify({uid:id})});}catch(_){}
    }
  }catch(_){}
  return blockedIds;
}
async function blockAuthor(uid,name){
  if(!uid)return;
  if(!confirm("Hide everything by “"+name+"”?\n\nYou won't see their challenges any more. You can undo this in the 🛒 shop."))return;
  blockedIds.add(uid);
  player.blocked=[...blockedIds];saveNow();
  toast("🚫 Hidden everything by “"+name+"”.");
  if(sbReady()&&sbUser){
    try{await sbRest("rpc/block_author",{method:"POST",body:JSON.stringify({uid})});}catch(_){}
  }
  await loadCommunity();
}
async function unblockAll(){
  if(!blockedIds.size){toast("👍 You haven't hidden anyone.");return;}
  if(!confirm("Show challenges from everyone again?"))return;
  const ids=[...blockedIds];
  blockedIds=new Set();player.blocked=[];saveNow();
  toast("👍 Everyone's challenges are back.");
  if(sbReady()&&sbUser){
    for(const id of ids){
      try{await sbRest("user_blocks?blocked=eq."+encodeURIComponent(id),{method:"DELETE"});}catch(_){}
    }
  }
  await loadCommunity();
}

/* ---------------- reporting ----------------
   The reasons are the ones a nine-year-old would actually pick. They are
   also the reasons the server's CHECK constraint accepts. */
const REPORT_REASONS=[
  {id:"rude",  em:"🤬", txt:"Rude or mean words"},
  {id:"scary", em:"😨", txt:"Scary or not for kids"},
  {id:"broken",em:"🧩", txt:"Impossible or broken"},
  {id:"copied",em:"📋", txt:"Copied from someone else"},
  {id:"other", em:"❓", txt:"Something else"}
];
function reportChallenge(row){
  if(!sbReady()||!sbUser){toast("🔐 Sign in first so a report can be checked.");return;}
  const el=$("repBody"); if(!el)return;
  $("repTitle").textContent="“"+row.name+"”";
  el.innerHTML="";
  for(const r of REPORT_REASONS){
    const b=document.createElement("button");
    b.className="rep-opt";
    b.innerHTML='<span class="rep-em">'+r.em+'</span><span>'+esc(r.txt)+'</span>';
    b.addEventListener("click",()=>sendReport(row,r.id));
    el.appendChild(b);
  }
  $("report").classList.add("open");
  sfx(520,.04);
}
async function sendReport(row,reason){
  $("report").classList.remove("open");
  try{
    await sbRest("rpc/report_challenge",{method:"POST",body:JSON.stringify({cid:row.id,why:reason})});
    // reported levels go away for the reporter immediately, whether or not
    // this was the third report — nobody should have to keep looking at it
    player.reported=player.reported||[];
    if(player.reported.indexOf(row.id)<0)player.reported.push(row.id);
    saveNow();
    bigToast("🚩 Thanks — that's reported and hidden from you. Three reports takes it down for everyone.");
    await loadCommunity();
  }catch(e){toast("⚠️ Could not send the report: "+e.message);}
}
function wasReported(id){return (player.reported||[]).indexOf(id)>=0;}

$("repClose").addEventListener("click",()=>$("report").classList.remove("open"));
