"use strict";
/* =====================================================================
   Age gate
   ---------------------------------------------------------------------
   CodeCraft offers accounts (email + password) and a public list of
   player-made levels. Collecting either from a child under 13 needs
   verifiable parental consent under COPPA — which a game cannot do
   honestly with a checkbox. So it does not collect it at all: below the
   cutoff there is no account, no publishing and no community list.

   Nothing is taken away from the game itself. The world, the challenges,
   Tower, the level editor and market orders never look at an account —
   a younger player gets all of it, on the device, with no sign-in.

   Two deliberate choices:

   - The question is neutral. It asks when you were born, not "are you
     over 13?" — a yes/no gate teaches the child which answer unlocks
     the app, which is the pattern the FTC calls out.

   - The DATE IS NEVER STORED. It is turned into one yes/no the moment
     it is entered, and only that is kept. Asking a child their birthday
     and then filing it away would be the very thing this screen exists
     to avoid.

   The answer lives under its own key, not in the game save, so that
   deleting the account or clearing progress cannot be used to re-roll
   the question until it gives the wanted answer.
   ===================================================================== */

/* The cutoff. COPPA's line is 13; GDPR lets member states pick 13-16, so
   a strict EU reading would want 16 and would need country detection.
   One constant, one place, if that ever changes. */
const AGE_MIN_ACCOUNT=13;
const AGE_KEY="codecraft_age_v1";

let ageBracket=null;               // "y" old enough · "n" not · null not asked
function ageLoad(){
  try{const v=localStorage.getItem(AGE_KEY);ageBracket=(v==="y"||v==="n")?v:null;}
  catch(_){ageBracket=null;}
}
function ageAsked(){return ageBracket!==null;}
function ageOk(){return ageBracket==="y";}
function ageSet(ok){
  ageBracket=ok?"y":"n";
  try{localStorage.setItem(AGE_KEY,ageBracket);}catch(_){}
}

const AGE_MONTHS=["January","February","March","April","May","June",
                  "July","August","September","October","November","December"];

/* month granularity: a birthday later this year has not happened yet */
function ageFrom(month,year){
  const now=new Date();
  let a=now.getFullYear()-year;
  if((now.getMonth()+1)<month)a--;
  return a;
}

function ageGateShow(done){
  const el=$("agegate"); if(!el){if(done)done();return;}
  const yNow=new Date().getFullYear();
  let ys='<option value="">Year</option>';
  for(let y=yNow;y>=yNow-99;y--)ys+='<option value="'+y+'">'+y+'</option>';
  let ms='<option value="">Month</option>';
  for(let i=0;i<12;i++)ms+='<option value="'+(i+1)+'">'+AGE_MONTHS[i]+'</option>';
  $("ageSelects").innerHTML='<select id="ageMonth">'+ms+'</select><select id="ageYear">'+ys+'</select>';
  const go=$("ageGo");
  go.disabled=true;
  const check=()=>{go.disabled=!($("ageMonth").value&&$("ageYear").value);};
  $("ageMonth").addEventListener("change",check);
  $("ageYear").addEventListener("change",check);
  go.onclick=()=>{
    const m=parseInt($("ageMonth").value,10), y=parseInt($("ageYear").value,10);
    if(!m||!y)return;
    const ok=ageFrom(m,y)>=AGE_MIN_ACCOUNT;
    ageSet(ok);                                   // the date itself stops here
    // Someone already signed in who turns out to be under the cutoff must not
    // keep using the account. Logging out leaves their progress on the device.
    if(!ok&&typeof sbUser!=="undefined"&&sbUser&&typeof sbLogout==="function")sbLogout();
    el.classList.remove("open");
    sfx(660,.07);
    if(done)done();
  };
  el.classList.add("open");
}

/* Called from boot before the splash offers anything. */
function ageGateInit(done){
  ageLoad();
  if(ageAsked()){if(done)done();return;}
  ageGateShow(done);
}

/* The line shown where a sign-in box would otherwise be. It is a full stop,
   not a locked door with a key next to it — there is nothing to try. */
const AGE_NOTE='🎈 Everything in the game is yours to play, right here on this device. '+
               'Accounts and publishing challenges open up when you\'re older.';
