"use strict";
/* =====================================================================
   Deleting your account, from inside the app
   ---------------------------------------------------------------------
   App Store Review Guideline 5.1.1(v): an app that lets you create an
   account must let you delete it from within the app. Offering only
   "log out" is a rejection, not a note. Google Play asks the same.

   The client only ever holds the publishable key, so this cannot go
   through the admin API. It calls delete_my_account(), a SECURITY
   DEFINER function keyed strictly to auth.uid() — it takes no arguments,
   so there is nothing to point at anyone else's account. Deleting the
   auth.users row cascades to the cloud save, the published levels, the
   reports and the block list.

   Two things this screen tries hard to get right, because the person
   reading it is nine:
     - it says what disappears, in words, before anything happens;
     - it cannot be done by one stray tap. The red button arms first,
       and disarms itself again after a few seconds.
   ===================================================================== */

/* A token that expired while the sheet sat open would fail the delete with
   a confusing 401, so refresh first if it is close. */
async function sbEnsureToken(){
  if(!sbUser)throw new Error("You're not signed in.");
  if(Date.now()<sbUser.exp-60000)return;
  const r=await sbAuth("token?grant_type=refresh_token",{refresh_token:sbUser.refresh});
  if(!sbSaveSession(r))throw new Error("Your session expired — log in again first.");
}

/* Everything this device keeps. player.blocked, player.reported and the
   whole world live inside the game save, so the two keys are the lot. */
function accountWipeLocal(){
  saveOff=true;                       // stop autosave writing the game back
  try{localStorage.removeItem(SAVE_KEY);}catch(_){}
  try{localStorage.removeItem(SB_AUTH_KEY);}catch(_){}
  // the native mirror is a copy of the same data, so deleting has to reach
  // it as well or the next launch would restore what was just deleted
  if(typeof nativeMirror==="function"){nativeMirror(SAVE_KEY,null);nativeMirror(SB_AUTH_KEY,null);}
}

const DEL_GONE=[
  {em:"☁",  txt:"Your saved game in the cloud — coins, levels, robots and every program you wrote"},
  {em:"🌍", txt:"Every challenge you published — they come off the community list for everyone"},
  {em:"🔐", txt:"Your email and password. You won't be able to log in again"},
  {em:"🧹", txt:"The progress saved on this device"}
];

let delArmed=0, delArmT=null, delBusy=false;

function openDeleteAccount(){
  if(!sbReady()||!sbUser){toast("🔐 You're not signed in.");return;}
  const el=$("delList"); if(!el)return;
  $("delWho").textContent=sbUser.email||"";
  el.innerHTML="";
  for(const g of DEL_GONE){
    const r=document.createElement("div");
    r.className="del-row";
    r.innerHTML='<span class="del-em">'+g.em+'</span><span>'+esc(g.txt)+'</span>';
    el.appendChild(r);
  }
  delDisarm();
  $("delMsg").textContent="";
  delBusy=false;
  $("delacc").classList.add("open");
  sfx(420,.04);
}
function closeDeleteAccount(){
  if(delBusy)return;                  // never yank the sheet mid-delete
  delDisarm();
  $("delacc").classList.remove("open");
}
function delDisarm(){
  clearTimeout(delArmT); delArmed=0;
  const b=$("delGo"); if(!b)return;
  b.classList.remove("armed");
  b.textContent="Delete everything";
}
/* First tap arms, second tap does it. The arm lapses on its own so a
   child who walked away does not come back to a live red button. */
function delTap(){
  if(delBusy)return;
  if(!delArmed){
    delArmed=1;
    const b=$("delGo");
    b.classList.add("armed");
    b.textContent="Tap again to delete forever";
    $("delMsg").textContent="Still fine to change your mind.";
    clearTimeout(delArmT); delArmT=setTimeout(()=>{delDisarm();$("delMsg").textContent="";},5000);
    sfx(300,.05);
    return;
  }
  doDeleteAccount();
}
async function doDeleteAccount(){
  delBusy=true;
  clearTimeout(delArmT);
  const b=$("delGo"), c=$("delCancel");
  b.disabled=true; c.disabled=true;
  b.textContent="Deleting…";
  $("delMsg").textContent="⏳ Deleting your account…";
  try{
    await sbEnsureToken();
    await sbRest("rpc/delete_my_account",{method:"POST",body:"{}"});
    // Only wipe this device once the server has actually said yes — a failed
    // call must not cost a child their local progress as well.
    accountWipeLocal();
    $("delMsg").textContent="👋 Your account is gone. Starting fresh…";
    setTimeout(()=>location.reload(),1200);
  }catch(e){
    delBusy=false;
    b.disabled=false; c.disabled=false;
    delDisarm();
    $("delMsg").textContent="⚠️ "+e.message;
  }
}

/* the row that appears under the account box, and on the splash */
function delAccBtn(cls){
  const b=document.createElement("button");
  b.className=cls||"authbtn danger";
  b.textContent="Delete account";
  b.addEventListener("click",openDeleteAccount);
  return b;
}

document.addEventListener("DOMContentLoaded",()=>{
  const x=$("delClose"), c=$("delCancel"), g=$("delGo");
  if(x)x.addEventListener("click",closeDeleteAccount);
  if(c)c.addEventListener("click",closeDeleteAccount);
  if(g)g.addEventListener("click",delTap);
});
