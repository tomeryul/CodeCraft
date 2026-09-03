"use strict";
/* =====================================================================
   v5 — one language, applied to the DOM the game already has
   ---------------------------------------------------------------------
   Companion to css/codecraft-v5.css. This file MOVES nodes; it does not
   rewrite screens, and it adds no new state. Load it LAST (after
   nav.js/hub.js/settings.js), so every id it addresses exists and every
   handler it reuses is already wired.

   What it does, and why:

   1. Every sheet header becomes the same three slots — ‹ Back, title,
      ✕ Exit — in the same order. The header is chrome; nothing that
      acts on the CONTENT is allowed to live in it.
   2. The editor grows that same header. Its old two-row chrome (robot
      chips + tool tray on top, the challenge's own ✕/title/speed bar
      inside the board tab) is where "the back button is somewhere else
      in a challenge" came from: two headers, two backs, two titles.
      The title and Back move up into the one header; the chips, undo,
      redo and expand move down into the Blocks tab, where they belong
      to what you are editing; the speed button joins the run row.
   3. #tabs moves to the END of #editor, so tabs are the last row of
      the screen in every mode — the same place as an app tab bar.
   4. The Shop stops being a centred pop-up and becomes the same bottom
      sheet as every other destination, with the same header.

   Everything is guarded: a missing node is skipped, never thrown.
   ===================================================================== */
(function(){
if(window.__v5)return; window.__v5=1;

const $=id=>document.getElementById(id);
const has=n=>typeof window[n]==="function";
const ICON_BACK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" '+
  'stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>';

/* ---------- 1. the sheet headers ---------- */
const SHEETS=["mentor","quests","hub","projects","guide","funcLib","orders","report","settings","delacc"];
function head(id){
  const sheet=$(id); if(!sheet)return;
  const h=sheet.querySelector(".m-head"); if(!h)return;
  const back=h.querySelector(".iconbtn.back"), x=h.querySelector(".iconbtn.x");
  /* the menu is the top of the tree: keep the slot so the title stays
     centred, drop the button that would have nowhere to go */
  if(!back&&!h.querySelector(".v5-gap")){
    const g=document.createElement("span");g.className="v5-gap";
    h.insertBefore(g,h.firstChild);
  }
  if(back&&back!==h.firstElementChild)h.insertBefore(back,h.firstChild);
  if(x&&x!==h.lastElementChild)h.appendChild(x);
}

/* ---------- 2 + 3. the editor ---------- */
function editor(){
  const ed=$("editor"); if(!ed||ed.querySelector(".v5-head"))return;
  const edHead=ed.querySelector(".ed-head"), btns=ed.querySelector(".ed-btns");
  const hd=document.createElement("div");hd.className="v5-head";

  const back=document.createElement("button");
  back.className="iconbtn back";back.id="v5EdBack";
  back.title="Back";back.setAttribute("aria-label","Back");
  back.innerHTML=ICON_BACK;
  back.addEventListener("click",()=>{ if(has("navBack"))navBack(); });
  hd.appendChild(back);

  const t=document.createElement("div");t.className="v5-title";
  t.innerHTML='<b id="v5EdTitle"></b><small id="v5EdSub"></small>';
  hd.appendChild(t);

  const x=$("edClose");
  if(x){x.classList.add("iconbtn","x");hd.appendChild(x);}
  ed.insertBefore(hd,ed.firstChild);

  /* chips, undo, redo and expand belong to the program, not to the
     screen — they move into the tab that shows the program */
  const bt=$("blocksTab");
  if(bt){
    const row=document.createElement("div");row.className="v5-edrow";
    const chips=$("robotChips"); if(chips)row.appendChild(chips);
    if(btns)row.appendChild(btns);
    bt.insertBefore(row,bt.firstChild);
  }
  if(edHead&&!edHead.children.length)edHead.remove();

  /* the speed button is a run control, so it sits with Run */
  const bar=$("actionBar"), sp=$("mgSpeedBtn");
  if(bar&&sp)bar.insertBefore(sp,$("runBtn")||null);

  /* tabs last, in every mode */
  const tabs=$("tabs"); if(tabs)ed.appendChild(tabs);

  /* the one header has to say where you are: the challenge's title when
     there is one, the robot you are programming when there is not */
  const sync=()=>{
    try{
      const mg=ed.classList.contains("mg");
      const ti=$("v5EdTitle"), su=$("v5EdSub");
      if(!ti||!su)return;
      if(mg){
        ti.textContent=($("mgTitle")||{}).textContent||"Challenge";
        const c=($("mgCount")||{}).textContent||"";
        su.textContent=c?("🧩 "+c.replace(/^🧩\s*/,"")):"";
      }else{
        const r=(typeof R==="function")?R():null;
        ti.textContent=r&&r.name?r.name:"Your code";
        su.textContent="The world";
      }
      back.style.visibility=mg?"visible":"hidden";
    }catch(_){}
  };
  sync();
  const mo=new MutationObserver(sync);
  mo.observe(ed,{attributes:true,attributeFilter:["class"]});
  const mt=$("mgTitle"), mc=$("mgCount");
  if(mt)mo.observe(mt,{childList:true,characterData:true,subtree:true});
  if(mc)mo.observe(mc,{childList:true,characterData:true,subtree:true});
  window.v5EdSync=sync;
}

/* ---------- 4. the shop ---------- */
function shop(){
  const sh=$("shop"); if(!sh||sh.querySelector(".m-head"))return;
  const close=()=>{const w=$("shopWrap");if(w)w.classList.remove("open");};

  const h=document.createElement("div");h.className="m-head";
  const back=document.createElement("button");
  back.className="iconbtn back";back.title="Back";back.setAttribute("aria-label","Back");
  back.innerHTML=ICON_BACK;
  back.addEventListener("click",()=>{close();if(has("hubOpen"))setTimeout(hubOpen,120);});

  const t=document.createElement("div");
  t.innerHTML='<h3>🛒 Robo-Mart</h3><p>Sell at the 🏪 market, then upgrade your robots.</p>';

  const x=document.createElement("button");
  x.className="iconbtn x";x.textContent="✕";
  x.title="Exit to the world";x.setAttribute("aria-label","Exit to the world");
  x.addEventListener("click",()=>{close();if(has("sfx"))sfx(430,.05);});

  h.appendChild(back);h.appendChild(t);h.appendChild(x);
  sh.insertBefore(h,sh.firstChild);

  /* one bevel per screen, and in a list of prices it is the price you
     can pay. renderShop() rebuilds these rows, so watch instead of tag. */
  const items=$("shopItems");
  if(items){
    const tag=()=>{
      items.querySelectorAll(".shopitem>button").forEach(b=>{
        const s=(b.textContent||"").trim();
        b.classList.toggle("v5-buy",(s==="Get"||s==="Sell")&&!b.disabled);
      });
    };
    tag();
    new MutationObserver(tag).observe(items,{childList:true,subtree:true});
  }
}

function wire(){
  try{SHEETS.forEach(head);}catch(_){}
  try{editor();}catch(_){}
  try{shop();}catch(_){}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",wire);
else wire();
})();
