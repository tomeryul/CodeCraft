"use strict";
/* =====================================================================
   Settings
   ---------------------------------------------------------------------
   These rows used to sit at the bottom of the Shop, under "buy a robot"
   and "sell the bank". Nothing here costs coins and nothing the Shop
   sells is a setting; they shared a sheet, not a subject. Turning the
   music off meant scrolling past four things for sale.

   Export and Import are deliberately NOT here — the Account & save page
   already carries them, and two copies of a destructive-adjacent action
   in two places is how you end up restoring the wrong file.
   ===================================================================== */
function settingsRow(el,em,title,sub,btnText,fn,cls,off){
  const d=document.createElement("div"); d.className="shopitem";
  d.innerHTML='<div class="em">'+em+'</div><div class="tx"><b>'+title+
              '</b><small>'+sub+'</small></div>';
  const b=document.createElement("button");
  b.textContent=btnText; if(cls)b.className=cls;
  /* A button that looks pressable and does nothing is the same fault as a
     drag handle that does not drag. */
  if(off)b.disabled=true; else b.addEventListener("click",()=>{fn();});
  d.appendChild(b); el.appendChild(d);
  return d;
}

function renderSettings(){
  const el=$("settingsList"); if(!el)return;
  el.innerHTML="";

  settingsRow(el,muted?"🔇":"🔊","Sound","Blips, dings and celebrations.",
    muted?"Turn on":"Turn off",()=>{
      muted=!muted;
      if(muted&&typeof musicStop==="function")musicStop();
      else if(!muted&&!musicOff&&typeof musicStart==="function")musicStart();
      saveSoon(); renderSettings();
    });

  /* Music is its own switch. "Sound off" silences everything; plenty of
     players want the blips that tell them the robot did something and not
     a loop underneath them. */
  settingsRow(el,musicOff?"🔇":"🎵","Music",
    "A theme for the world, another for challenges.",
    musicOff?"Turn on":"Turn off",()=>{
      musicOff=!musicOff;
      if(musicOff){if(typeof musicStop==="function")musicStop();}
      else if(!muted&&typeof musicStart==="function")musicStart();
      saveSoon(); renderSettings();
    });

  /* Switching language reloads. Hebrew is applied by replacing the English
     strings in place, and putting them back by reverse lookup would guess
     wrong the first time a word maps both ways — so the clean state comes
     from a fresh load. Nothing is lost: the choice is saved first. */
  settingsRow(el,"🌐","Language","English · עברית",
    lang==="he"?"English":"עברית",()=>{
      lang=(lang==="he")?"en":"he";
      saveNow();
      location.reload();
    });

  /* Naming and safety: a child who wants to change what other players see
     about them should not have to go looking for it, and undoing a block
     has to be as easy as making one. */
  if(typeof nickOf==="function")
    settingsRow(el,"✏️","Your name: "+esc(nickOf()),
      "What other players see on challenges you publish.",
      "Change",()=>{askNick(true);renderSettings();});

  if(typeof unblockAll==="function"){
    const nb=(player.blocked||[]).length;
    settingsRow(el,"\u{1F6AB}","Hidden players: "+nb,
      nb?"Their challenges are hidden from you.":"You haven't hidden anyone.",
      nb?"Show all":"None",()=>{unblockAll();renderSettings();},null,!nb);
  }

  settingsRow(el,"🌍","New World",
    "Erase everything and generate a fresh world.","Reset",()=>{
      if(confirm("Really erase your world, robots and coins?")){
        localStorage.removeItem(SAVE_KEY); location.reload();
      }
    },"danger");
}

function openSettings(){ renderSettings(); $("settings").classList.add("open"); }

$("setClose").addEventListener("click",()=>$("settings").classList.remove("open"));
