"use strict";
/* ---------------- 📚 My Functions ----------------
   A function you wrote once should be yours forever. This is a personal library
   that lives in `player.funcLib`, so it rides the normal save — localStorage AND
   the cloud sync — and is available everywhere the editor is: the open world and
   every minigame alike. Save 🔧 A or 🔧 B into it, load any entry back into a
   slot later, and stop rewriting the same swap / the same trip to market. */

const FUNCLIB_MAX=24;

function funcLib(){
  if(!player.funcLib)player.funcLib=[];
  return player.funcLib;
}
function funcSig(f){return (f.name||"?")+"("+((f.params||[]).join(", "))+")";}

// bank the slot the editor is on (or the given one) into the library
function saveFuncToLib(id){
  const r=R(), f=routineOf(r,id);
  if(!f.body.length){toast("🔧 Function "+id+" is empty — write something in it first.");sfx(200,.06);return;}
  const lib=funcLib();
  if(lib.length>=FUNCLIB_MAX){toast("📚 Your library is full ("+FUNCLIB_MAX+"). Delete one first.");return;}
  const nm=prompt("Save function "+id+" as:", "my_"+id.toLowerCase());
  if(nm===null)return;
  const name=nm.trim().replace(/\W+/g,"_").slice(0,14)||("fn"+(lib.length+1));
  const entry={id:"f_"+Date.now(),name,
    params:JSON.parse(JSON.stringify(f.params||[])),
    body:JSON.parse(JSON.stringify(f.body))};
  const at=lib.findIndex(x=>x.name===name);
  if(at>=0)lib[at]=entry; else lib.push(entry);
  saveNow();
  toast("📚 Saved "+funcSig(entry)+" — use it in any world or minigame.");
  sfx(760,.06);
  renderFuncLib();
}
// copy a library entry into slot A or B, with fresh uids so editing it here can
// never reach back and mutate the stored copy
function loadFuncFromLib(entryId,slot){
  const e=funcLib().find(x=>x.id===entryId); if(!e)return;
  const r=R();
  pushUndo();
  r.routines=r.routines||{};
  r.routines[slot]={params:JSON.parse(JSON.stringify(e.params||[])),
                    body:JSON.parse(JSON.stringify(e.body||[]))};
  reUid(routineOf(r,slot).body);
  edTarget=slot;
  sfx(660,.06);
  toast("🔧 "+funcSig(e)+" loaded into "+slot+".");
  closeFuncLib();
  programChanged();
}
function deleteFuncFromLib(entryId){
  const lib=funcLib(), i=lib.findIndex(x=>x.id===entryId);
  if(i<0)return;
  if(!confirm("Delete “"+funcSig(lib[i])+"” from your library?"))return;
  lib.splice(i,1);saveNow();sfx(300,.05);renderFuncLib();
}

function renderFuncLib(){
  const el=$("funcLibBody"); if(!el)return;
  el.innerHTML="";
  const r=R();
  const sec=t=>{const h=document.createElement("h4");h.className="qsec";h.textContent=t;el.appendChild(h);};
  sec("💾 Save one of this robot's functions");
  const row=document.createElement("div");row.className="fl-save";
  for(const id of ROUTINE_IDS){
    const f=routineOf(r,id);
    const b=document.createElement("button");
    b.className="rowbtn";
    b.innerHTML='💾 <span class="lb">Save 🔧 '+id+" ("+countBlocks(f.body)+" blocks"+
      ((f.params||[]).length?", takes "+f.params.join(", "):"")+")</span>";
    b.addEventListener("click",()=>saveFuncToLib(id));
    row.appendChild(b);
  }
  el.appendChild(row);
  sec("📚 My functions");
  const lib=funcLib();
  if(!lib.length){
    const n=document.createElement("div");n.className="authnote";
    n.textContent="Nothing saved yet. Write something in 🔧 A or 🔧 B, then save it here — it will be waiting in every world and every minigame.";
    el.appendChild(n);
    return;
  }
  for(const e of lib){
    const card=ccCard(el,{em:"🔧",name:esc(funcSig(e)),badge:"A",
      meta:'<i>'+countBlocks(e.body||[])+' blocks</i>'+((e.params||[]).length?" · takes "+esc(e.params.join(", ")):" · takes nothing"),
      onTap:()=>loadFuncFromLib(e.id,"A")});
    ccSideBtn(card,"B","Load into 🔧 B",()=>loadFuncFromLib(e.id,"B"));
    ccSideBtn(card,"🗑","Delete",()=>deleteFuncFromLib(e.id));
  }
}
function openFuncLib(){renderFuncLib();$("funcLib").classList.add("open");}
function closeFuncLib(){$("funcLib").classList.remove("open");}
