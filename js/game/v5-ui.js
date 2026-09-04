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
/* arrows pushing outward = give the blocks the screen; pulling inward =
   put the rest of the screen back */
const SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" '+
  'stroke-linecap="round" stroke-linejoin="round" class="';
const ICON_FOCUS_ON=SVG+'ic-fon"><path d="M12 10V4M9 7l3-3 3 3M12 14v6M9 17l3 3 3-3"/></svg>';
const ICON_FOCUS_OFF=SVG+'ic-foff"><path d="M12 4v6M9 7l3 3 3-3M12 20v-6M9 17l3-3 3 3"/></svg>';

/* ---------- 1. the sheet headers ---------- */
const SHEETS=["mentor","quests","hub","projects","guide","funcLib","orders","report","settings","delacc"];
function head(id){
  const sheet=$(id); if(!sheet)return;
  const h=sheet.querySelector(".m-head"); if(!h)return;
  const back=h.querySelector(".iconbtn.back"), x=h.querySelector(".iconbtn.x");
  /* the menu is the top of the tree: keep the slot so the title stays
     centred, drop the button that would have nowhere to go */
  /* only pad the left slot when nothing occupies it — the size control
     nav.js adds counts, or the gap would push it off the edge. */
  if(!back&&!h.querySelector(".iconbtn.size")&&!h.querySelector(".v5-gap")){
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

  /* Shrink/expand is chrome — it resizes the SCREEN, not the program — so
     it belongs beside Back rather than in the Blocks tab's tool row. A
     challenge opens maximised on the Board tab, where that row is not
     rendered at all, so there was no way to shrink the sheet from the
     first screen you land on. */
  const mx=$("edMax");
  if(mx){mx.classList.add("iconbtn");hd.appendChild(mx);}

  /* Focus: everything that is not the program or the palette goes away.
     Making the sheet taller only ever bought a little room, because the
     rows above the program — the header, the robot chips, undo/redo, the
     routine tabs, the variable watch — and the run bar below it keep their
     height whatever the sheet does, so the part you are actually editing
     stayed small even full-screen. This drops all of them and gives the
     blocks the whole screen. The button stays where it is so the way back
     is in the place you pressed. */
  const fc=document.createElement("button");
  fc.className="iconbtn focus";fc.id="edFocus";
  fc.title="Blocks only — hide everything else";
  fc.setAttribute("aria-label","Blocks only");
  fc.innerHTML=ICON_FOCUS_ON+ICON_FOCUS_OFF;
  fc.addEventListener("click",()=>{
    /* Focus is about the blocks, so it only means anything on that tab —
       from the board or the Python listing it takes you there first
       rather than hiding the screen you are looking at. */
    if(has("setTab")&&$("blocksTab")&&$("blocksTab").style.display==="none")setTab("blocks");
    const on=ed.classList.toggle("focused");
    fc.title=on?"Show everything again":"Blocks only — hide everything else";
    fc.setAttribute("aria-label",on?"Show everything again":"Blocks only");
    if(has("renderProgram"))renderProgram();
  });
  hd.appendChild(fc);

  /* Focus hides the header, the tabs and Run. Leaving it on when the editor
     closes would drop the player back into a screen with no way out that
     they did not choose, so it lasts as long as the editor is open. */
  new MutationObserver(()=>{
    /* Both halves of this condition matter. classList.remove() rewrites the
       class attribute even when the token was not there, which is another
       mutation, which calls this observer again — as a microtask, so it
       never yields and the game freezes the moment the editor closes.
       Checking for the class first means at most one more mutation. */
    if(!ed.classList.contains("open")&&ed.classList.contains("focused"))
      ed.classList.remove("focused");
  }).observe(ed,{attributes:true,attributeFilter:["class"]});

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

  const sz=document.createElement("button");
  sz.className="iconbtn size";
  sz.title="Shrink or expand"; sz.setAttribute("aria-label","Shrink or expand");
  sz.innerHTML=
    '<svg class="ic-max" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" '+
    'stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>'+
    '<svg class="ic-min" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" '+
    'stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>';
  sz.addEventListener("click",()=>{const m=$("edMax"); if(m)m.click();});

  h.appendChild(back);h.appendChild(sz);h.appendChild(t);h.appendChild(x);
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

/* ---------- 5. the market handle joins the status pill ---------- */
/* #ticker is a sibling of #stats inside #topbar, so the corner held two
   objects on two rows. It is the pill's last chip now. renderMarket()
   rewrites #ticker.innerHTML on every tick but never replaces the element,
   so moving it once at boot is enough; the display:none it sets while a
   sheet is open still works from inside the pill. */
function hud(){
  const st=$("stats"), tk=$("ticker");
  if(st&&tk&&tk.parentNode!==st)st.appendChild(tk);
}

function wire(){
  try{SHEETS.forEach(head);}catch(_){}
  try{editor();}catch(_){}
  try{shop();}catch(_){}
  try{hud();}catch(_){}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",wire);
else wire();
})();
