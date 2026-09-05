"use strict";
/* =====================================================================
   The Hub — one door to everything
   ---------------------------------------------------------------------
   The problem: the game had eleven destinations and no map. Four of them
   were icon buttons in the top bar, one was a chip on the ticker, Export
   and Import were inside the SHOP, "Delete account" was inside Projects,
   and the Projects sheet itself was a single scroll holding SEVEN
   unrelated kinds of content — Academy, Puzzle Chapters, Build Projects,
   Tower Mode, My Challenges, the design guide and Community, one after
   another. Tower Mode is 3D and sat in the same list as the 2D boards,
   so "which of these is the 3D one" was a reading exercise.

   So: ONE button, one grouped menu, and every destination gets its own
   page with its own title. 2D and 3D are separate pages, named as such.

   Implementation note — this file adds, it does not rewrite. Every
   section still renders through the existing renderProjects() chain
   (including the two Tower bands that tower3d.js and tower-editor.js
   monkey-patch onto it). The hub renders the whole thing as before and
   then HIDES the bands that are not on the current page. Hiding, not
   removing: loadCommunity() resolves later and writes into #ccList, and
   tower-editor looks up ".t3sec .t3grid" after tower3d built it, so both
   have to still be in the document.
   ===================================================================== */
(function(){
if(window.__hub)return; window.__hub=1;

const has=n=>typeof window[n]==="function";
const num=fn=>{try{const v=fn();return v==null?null:v;}catch(_){return null;}};

/* ---------------- the pages ----------------
   key -> which band of #projList belongs to it, and what to call it.
   The band keys come from bandKey() below. */
const PAGES={
  academy  :{em:"🎓",title:"Academy",     sub:"Short lessons, in order. They teach every block the rest of the game needs.",bands:["academy"]},
  puzzles  :{em:"🧩",title:"Puzzle Chapters",sub:"A flat board and one new trick per chapter.",bands:["puzzles"]},
  builds   :{em:"🏗️",title:"Build Projects",sub:"A blueprint to fill in. What you finish appears in your world.",bands:["builds"]},
  tower    :{em:"🧊",title:"Tower Mode — 3D",sub:"The same board with height. Stack, climb, and rebuild the blueprint in 3D.",bands:["tower"]},
  mine     :{em:"🛠️",title:"My Challenges",sub:"Levels you designed — flat boards and towers.",bands:["mine","tower"]},
  community:{em:"🌍",title:"Community",   sub:"Levels other players published.",bands:["community"]},
  account  :{em:"👤",title:"Account & save",sub:"Sign in to keep your world on every device. Export a copy any time.",bands:[],auth:true}
};

/* ---------------- the menu ----------------
   Three groups, because there are exactly three reasons to leave the
   world: to play something, to make something, or to deal with your
   world's money and settings. `tag` is the dimension — the one label
   that was missing everywhere. */
const GROUPS=[
  {name:"Play",tiles:[
    {em:"🎓",name:"Academy",tag:"lessons",page:"academy",
     meta:()=>num(()=>academyDoneCount()+"/"+TUTS.length)},
    {em:"🧩",name:"Puzzle Chapters",tag:"2D",page:"puzzles"},
    {em:"🏗️",name:"Build Projects",tag:"2D",page:"builds",
     meta:()=>num(()=>PROJECTS.filter(p=>player.projects[p.id]).length+"/"+PROJECTS.length)},
    {em:"🧊",name:"Tower Mode",tag:"3D",page:"tower",
     meta:()=>num(()=>TOWER_LEVELS.filter(l=>player.projects[l.id]).length+"/"+TOWER_LEVELS.length)},
    {em:"🌍",name:"Community",tag:"2D + 3D",page:"community",
     show:()=>!has("ageOk")||ageOk()}
  ]},
  {name:"Create",tiles:[
    {em:"✏️",name:"New challenge",tag:"2D",go:()=>{hubClose();mgEnterCreator();}},
    {em:"🧊",name:"New tower level",tag:"3D",go:()=>hubPage("tower",".t3card.t3new")},
    {em:"🛠️",name:"My Challenges",tag:"yours",page:"mine",
     meta:()=>num(()=>((player.myChallenges||[]).length||null)+"")},
    {em:"📚",name:"My Functions",tag:"reusable",go:()=>{hubClose();openFuncLib();}},
    {em:"📘",name:"How to design",tag:"guide",go:()=>{hubClose();openGuide();}}
  ]},
  {name:"Your world",tiles:[
    {em:"🛒",name:"Shop",tag:"robots & upgrades",go:()=>{hubClose();openShop();}},
    {em:"🎩",name:"Style",tag:"dress your robots",go:()=>{hubClose();styleOpen();}},
    {em:"⚙️",name:"Settings",tag:"sound & world",go:()=>{hubClose();openSettings();}},
    {em:"📋",name:"Market Orders",tag:"on a clock",go:()=>{hubClose();ordersOpen();}},
    {em:"📜",name:"Quests",tag:"progress",go:()=>{hubClose();
      if(has("renderQuests"))renderQuests();$("quests").classList.add("open");}},
    {em:"👤",name:"Account & save",tag:"sign in · export",page:"account"}
  ]}
];

/* ---------------- open / close ---------------- */
function hubOpen(){
  hubRender();
  $("hub").classList.add("open");
  if(has("sfx"))sfx(560,.04);
}
function hubClose(){$("hub").classList.remove("open");}

function hubRender(){
  const el=$("hubBody"); if(!el)return;
  el.innerHTML="";
  /* The journey's next step, at the top. The hub is where you come when
     you don't know what to do, so the answer goes above the menu — not
     as a fourteenth tile competing with the rest. */
  if(typeof journeyStep==="function"){
    const s=journeyStep();
    if(s){
      const w=document.createElement("div");w.className="hub-next";
      w.innerHTML='<div class="hub-nlab">Next up</div>'+
        '<button class="j-btn" type="button"><span class="j-em">'+s.em+'</span>'+
        '<span class="j-tx"><b>'+esc(s.title)+'</b><small>'+esc(s.hint)+'</small></span>'+
        '<span class="j-go">'+journeyProgress()+'/'+JOURNEY.length+'</span></button>';
      w.querySelector(".j-btn").addEventListener("click",()=>{
        hubClose();try{s.go();}catch(_){}});
      el.appendChild(w);
    }
  }
  for(const g of GROUPS){
    const tiles=g.tiles.filter(t=>!t.show||t.show());
    if(!tiles.length)continue;
    const h=document.createElement("h4");h.className="hub-sec";h.textContent=g.name;
    el.appendChild(h);
    const grid=document.createElement("div");grid.className="hub-grid";
    for(const t of tiles){
      const m=t.meta?t.meta():null;
      const b=document.createElement("button");b.className="hub-tile";b.type="button";
      b.innerHTML='<span class="ht-em">'+t.em+'</span>'+
        '<span class="ht-name">'+esc(t.name)+'</span>'+
        '<span class="ht-foot"><i class="ht-tag">'+esc(t.tag||"")+'</i>'+
        (m&&m!=="null"?'<i class="ht-n">'+esc(m)+'</i>':'')+'</span>';
      b.addEventListener("click",()=>{
        if(has("sfx"))sfx(620,.035);
        if(t.go)t.go(); else hubPage(t.page);
      });
      grid.appendChild(b);
    }
    el.appendChild(grid);
  }
}

/* ---------------- one page of the Projects sheet ----------------
   Groups #projList's children into bands, then shows only the ones this
   page owns. A band is an h4.qsec plus every sibling up to the next one;
   .t3sec is its own band because tower3d builds it as a single block. */
function bandKey(t){
  if(/academy/i.test(t))return "academy";
  if(/puzzle/i.test(t))return "puzzles";
  if(/build\s*projects/i.test(t))return "builds";
  if(/my\s*challenges/i.test(t))return "mine";
  if(/community/i.test(t))return "community";
  return "?";
}
function bands(){
  const el=$("projList"),out=[];let cur=null;
  for(const n of [...el.children]){
    if(n.classList&&n.classList.contains("t3sec")){out.push({key:"tower",nodes:[n]});cur=null;continue;}
    if(n.tagName==="H4"&&n.classList.contains("qsec")){
      cur={key:bandKey(n.textContent||""),nodes:[n]};out.push(cur);continue;
    }
    if(cur)cur.nodes.push(n);else out.push({key:"?",nodes:[n]});
  }
  return out;
}
function hubPage(key,pointSel){
  const p=PAGES[key]; if(!p)return;
  hubClose();
  if(typeof mgState!=="undefined"&&mgState&&has("mgExit"))mgExit(false);
  $("editor").classList.remove("open");
  hubCur=key;
  renderProjects();                       // the whole chain, patches included
  const bs=bands(), keep=p.bands;
  /* Failure mode matters more than the happy path: if a section header is
     ever reworded, bandKey stops matching and this page would come up
     empty. Showing everything is a worse page; showing nothing is a bug
     report. So an empty match falls back to the full list. */
  const matched=bs.some(b=>keep.indexOf(b.key)>=0);
  /* A page that asks for no bands at all is not that failure — it is the
     account page, which owns no band and draws its own rows. Without the
     keep.length guard it hit the fallback and rendered the whole catalogue
     under the sign-in box, the exact scroll this change removes. */
  const showAll=keep.length>0&&!matched;
  for(const b of bs){
    const on=showAll||keep.indexOf(b.key)>=0;
    for(const n of b.nodes)n.style.display=on?"":"none";
  }
  $("authBox").style.display=p.auth?"":"none";
  if(p.auth)accountRows();
  const t=$("projTitle"),s=$("projSub");
  if(t)t.textContent=p.em+" "+p.title;
  if(s)s.textContent=p.sub;
  $("projects").classList.add("open");
  $("projList").scrollTop=0;
  if(pointSel)setTimeout(()=>{
    const c=document.querySelector(pointSel); if(!c)return;
    c.classList.add("j-point");setTimeout(()=>c.classList.remove("j-point"),2600);
  },240);
}
let hubCur=null;

/* Export and Import were inside the SHOP, between "buy a robot" and
   "reset the world" — they are account actions, so they live on the
   account page now, as the same ccCard rows as everything else in this
   sheet. Deleting the account stays where it was: renderAuthBox() draws
   that button itself, and only when there is an account to delete. */
function accountRows(){
  const el=$("projList");
  const h=document.createElement("h4");h.className="qsec";h.textContent="💾 Your save";
  el.appendChild(h);
  ccCard(el,{em:"📤",name:"Export a copy",badge:"⤓",
    desc:"Saves your whole world to a file on this device. Keep it anywhere.",
    onTap:()=>{
      if(has("saveNow"))saveNow();
      const blob=new Blob([localStorage.getItem(SAVE_KEY)],{type:"application/json"});
      const a=document.createElement("a");
      a.href=URL.createObjectURL(blob);a.download="codecraft-world.json";a.click();
      setTimeout(()=>URL.revokeObjectURL(a.href),2000);
      toast("💾 World exported!");
    }});
  ccCard(el,{em:"📥",name:"Import a save",badge:"⤒",
    desc:"Load a world back from a file. This replaces the world you have now.",
    onTap:()=>$("importFile").click()});
}

/* ---------------- rewire ---------------- */
$("hubBtn").addEventListener("click",hubOpen);
$("hubClose").addEventListener("click",hubClose);
$("projBack").addEventListener("click",()=>{
  $("projects").classList.remove("open");
  setTimeout(hubOpen,120);
});

/* The Journey pointed at "Projects ▸ Tower Mode" and scrolled the giant
   list to find a card. Each step now names a page and goes straight to
   it. JOURNEY is a top-level const in a classic script — visible here
   because this file loads after journey.js, but never on `window`. */
if(typeof JOURNEY!=="undefined"){
  const step=id=>JOURNEY.find(s=>s.id===id);
  const point=(id,where,page,sel)=>{
    const s=step(id); if(!s)return;
    s.where=where; s.go=()=>hubPage(page,sel);
  };
  point("academy","Menu ▸ Academy","academy",".acad-card");
  point("project","Menu ▸ Build Projects","builds",null);
  point("tower","Menu ▸ Tower Mode (3D)","tower",null);
  point("create","Menu ▸ New challenge","mine",".pnew");
  const r2=step("robot2");
  if(r2){r2.where="Menu ▸ Shop";r2.go=()=>{hubClose();openShop();};}
  const or=step("order");
  if(or){or.where="Menu ▸ Market Orders";or.go=()=>{
    hubClose();$("editor").classList.remove("open");$("projects").classList.remove("open");
    if(has("ordersOpen"))ordersOpen();};}
}

/* The journey bar hides itself while any sheet is open; it did not know
   about the hub, so it stayed lit underneath it. */
if(typeof renderJourney==="function"){
  const _rj=window.renderJourney;
  window.renderJourney=function(){
    const r=_rj.apply(this,arguments);
    const j=$("journey");
    if(j&&$("hub").classList.contains("open"))j.style.display="none";
    return r;
  };
}

/* The quest badge lived on #questBtn, which is now hidden. Mirror it onto
   the menu button — a reward you can claim is exactly the kind of thing
   the one visible entry point should be able to tell you. */
if(typeof updateQuestBadge==="function"){
  const _uqb=window.updateQuestBadge;
  window.updateQuestBadge=function(){
    const r=_uqb.apply(this,arguments);
    try{$("hubBtn").classList.toggle("badge",$("questBtn").classList.contains("badge"));}catch(_){}
    return r;
  };
}

/* Leaving a challenge reopened #projects directly — no band filter, no
   title — so going into Academy and coming back out landed you in the
   whole seven-section scroll this change exists to remove, still headed
   "Academy". Route the reopen through the page you actually came from.
   mgExit is a function declaration, so reassigning it here rebinds it for
   challenges.js's own internal calls too. */
if(typeof mgExit==="function"){
  const _mgExit=window.mgExit;
  window.mgExit=function(reopen){
    const r=_mgExit.apply(this,arguments);
    if(reopen!==false&&$("projects").classList.contains("open"))
      hubPage(hubCur||"academy");
    return r;
  };
}

window.hubOpen=hubOpen; window.hubClose=hubClose; window.hubPage=hubPage;
})();
