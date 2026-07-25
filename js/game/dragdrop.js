"use strict";
/* ---------------- drag & drop blocks ---------------- */
let dragCtx=null, dragSuppress=false;
// iOS decides whether a touch can scroll at touchstart and ignores touch-action
// changes made mid-gesture — so a class added when the drag begins can't stop the
// list from scrolling and cancelling the drag. Cancel scrolling imperatively:
// while a drag is active, preventDefault every touchmove. Must be non-passive.
document.addEventListener("touchmove",e=>{ if(dragCtx)e.preventDefault(); },{passive:false});
function attachDrag(row,b){
  row.addEventListener("pointerdown",e=>{
    if(e.target.closest(".pbtn"))return;
    if(e.pointerType==="mouse"&&e.button!==0)return;
    const pid=e.pointerId, sx=e.clientX, sy=e.clientY;
    let hold=setTimeout(()=>{hold=null;beginDrag(b,row,sx,sy,pid);},240);
    const mv=ev=>{
      if(ev.pointerId!==pid)return;
      if(hold){ if(Math.hypot(ev.clientX-sx,ev.clientY-sy)>10){clearTimeout(hold);hold=null;done();} return; }
      if(dragCtx){ev.preventDefault();dragMove(ev.clientX,ev.clientY);}
    };
    const up=ev=>{ if(ev.pointerId!==pid)return; if(hold){clearTimeout(hold);hold=null;} if(dragCtx){dragEnd(ev.clientX,ev.clientY);dragSuppress=true;} done(); };
    // pointercancel (iOS interrupting the gesture) must NOT commit a move — that
    // was dropping blocks at the bottom of the program. Abort cleanly instead.
    const cancel=ev=>{ if(ev.pointerId!==pid)return; if(hold){clearTimeout(hold);hold=null;} if(dragCtx)dragAbort(); done(); };
    function done(){document.removeEventListener("pointermove",mv);document.removeEventListener("pointerup",up);document.removeEventListener("pointercancel",cancel);}
    document.addEventListener("pointermove",mv,{passive:false});
    document.addEventListener("pointerup",up);
    document.addEventListener("pointercancel",cancel);
  });
}
function isDescUid(uid){return !!byUid(dragCtx.b.body||[],uid)||!!byUid(dragCtx.b.els||[],uid);}
function beginDrag(b,row,x,y,pid){
  dragCtx={b,uid:b.uid,w:row.offsetWidth,h:row.offsetHeight,row,pid};
  // NOTE: do NOT setPointerCapture here — on iOS capturing a pointer inside a
  // scroll container fires an immediate pointercancel, which kills the drag on
  // the first move. Document-level listeners already receive every move.
  row.classList.add("drag-src");
  const clone=row.cloneNode(true);
  clone.className="blk c-"+DEFS[b.t].cat+" drag-clone";
  clone.style.width=row.offsetWidth+"px";
  document.body.appendChild(clone);
  dragCtx.clone=clone;
  $("programWrap").classList.add("dragging");
  if(navigator.vibrate)navigator.vibrate(15);
  sfx(600,.04);
  dragMove(x,y);
}
function dragMove(x,y){
  const c=dragCtx.clone;
  c.style.left=(x-dragCtx.w*0.5)+"px";
  c.style.top=(y-dragCtx.h*0.6)+"px";
  // auto-scroll the program list when dragging near its top/bottom edge so long
  // programs stay fully reachable (otherwise you can't reach far-away targets)
  const wrap=$("programWrap"), wr=wrap.getBoundingClientRect(), EDGE=44;
  if(y<wr.top+EDGE)wrap.scrollTop-=9;
  else if(y>wr.bottom-EDGE)wrap.scrollTop+=9;
  dragCtx.target=computeDrop(x,y);
  paintDrop(dragCtx.target);
}
function computeDrop(x,y){
  const rows=[...$("programEl").querySelectorAll(".blk[data-uid]")]
    .filter(el=>+el.dataset.uid!==dragCtx.uid && !isDescUid(+el.dataset.uid));
  let hit=null;
  for(const el of rows){const r=el.getBoundingClientRect();if(y>=r.top&&y<=r.bottom){hit={el,r};break;}}
  if(!hit){
    if(rows.length){const fr=rows[0].getBoundingClientRect();if(y<fr.top)return {mode:"before",uid:+rows[0].dataset.uid,el:rows[0]};}
    return {mode:"root-end"};
  }
  const blk=byUid(curList(),+hit.el.dataset.uid), isC=!!blk.body, rel=(y-hit.r.top)/hit.r.height;
  if(isC){ if(rel<0.28)return {mode:"before",uid:blk.uid,el:hit.el}; if(rel>0.72)return {mode:"after",uid:blk.uid,el:hit.el}; return {mode:"into",uid:blk.uid,el:hit.el}; }
  return {mode:rel<0.5?"before":"after",uid:blk.uid,el:hit.el};
}
function paintDrop(t){
  $("programEl").querySelectorAll(".blk.dz-into").forEach(el=>el.classList.remove("dz-into"));
  let line=$("dropline");
  if(!line){line=document.createElement("div");line.id="dropline";$("programWrap").appendChild(line);}
  const wr=$("programWrap").getBoundingClientRect(), sc=$("programWrap").scrollTop;
  if(!t||t.mode==="root-end"){
    const pe=$("programEl").getBoundingClientRect();
    line.style.display="block";line.style.left="6px";line.style.width="calc(100% - 12px)";
    line.style.top=(sc+(pe.bottom-wr.top))+"px";return;
  }
  if(t.mode==="into"){t.el.classList.add("dz-into");line.style.display="none";return;}
  const r=t.el.getBoundingClientRect();
  line.style.display="block";
  line.style.top=(sc+((t.mode==="before"?r.top:r.bottom)-wr.top))+"px";
  line.style.left=(r.left-wr.left)+"px";line.style.width=r.width+"px";
}
function dragEnd(x,y){
  const t=dragCtx.target||computeDrop(x,y), ctx=dragCtx;
  if(ctx.clone)ctx.clone.remove();
  const line=$("dropline");if(line)line.style.display="none";
  $("programEl").querySelectorAll(".blk.dz-into").forEach(el=>el.classList.remove("dz-into"));
  $("programWrap").classList.remove("dragging");
  dragCtx=null;
  if(t){moveBlock(ctx.uid,t.mode,t.uid);sfx(780,.05);}
  else renderProgram();
}
// aborted drag (OS cancel): tear down without moving anything
function dragAbort(){
  const ctx=dragCtx; dragCtx=null;
  if(ctx&&ctx.clone)ctx.clone.remove();
  if(ctx&&ctx.row)ctx.row.classList.remove("drag-src");
  const line=$("dropline");if(line)line.style.display="none";
  $("programEl").querySelectorAll(".blk.dz-into").forEach(el=>el.classList.remove("dz-into"));
  $("programWrap").classList.remove("dragging");
  renderProgram();
}

function updateSelUI(){
  const bar=$("selActions");
  if(selBlock||elseSel){
    bar.classList.add("show");
    $("insNote").textContent = elseSel ? "new blocks → inside Else" :
      (selBlock.body ? "new blocks → inside "+DEFS[selBlock.t].lbl : "new blocks → after selection");
  }else bar.classList.remove("show");
  updatePasteBtn();
}

/* ---- copy / paste blocks ---- */
let blkClip=null;
function updatePasteBtn(){const b=$("pasteBlk");if(b)b.disabled=!blkClip;}
$("copyBlk").addEventListener("click",()=>{
  if(!selBlock)return;
  blkClip=JSON.parse(JSON.stringify(selBlock));   // deep copy incl. any nested blocks
  updatePasteBtn();
  sfx(700,.05);
  toast("📋 Copied "+(DEFS[selBlock.t]?DEFS[selBlock.t].lbl:"block"));
});
$("pasteBlk").addEventListener("click",()=>{
  if(!blkClip)return;
  const r=R();
  pushUndo();
  const copy=JSON.parse(JSON.stringify(blkClip));
  reUid([copy]);
  // paste where a new block would go: inside the selected container, else after it
  if(elseSel){elseSel.els.push(copy);}
  else if(selBlock&&selBlock.body){selBlock.body.push(copy);}
  else if(selBlock){const f=findList(curList(),selBlock);if(f)f.list.splice(f.i+1,0,copy);else curList().push(copy);}
  else curList().push(copy);
  selBlock=copy;elseSel=null;
  programChanged();
  sfx(820,.05);
});
updatePasteBtn();
$("delBlk").addEventListener("click",()=>{
  if(!selBlock)return;
  pushUndo();
  const f=findList(curList(),selBlock);
  if(f)f.list.splice(f.i,1);
  selBlock=null;programChanged();
});
$("dupBlk").addEventListener("click",()=>{
  if(!selBlock)return;
  const f=findList(curList(),selBlock);
  if(!f)return;
  pushUndo();
  const copy=JSON.parse(JSON.stringify(selBlock));
  reUid([copy]);
  f.list.splice(f.i+1,0,copy);
  programChanged();
});
function moveSel(dir){
  if(!selBlock)return;
  const f=findList(curList(),selBlock);
  if(!f)return;
  const j=f.i+dir;
  if(j<0||j>=f.list.length)return;
  pushUndo();
  f.list.splice(f.i,1);f.list.splice(j,0,selBlock);
  programChanged();
}
$("mvUp").addEventListener("click",()=>moveSel(-1));
$("mvDn").addEventListener("click",()=>moveSel(1));

function renderPalette(){
  const pal=$("palette");pal.innerHTML="";
  if(mgState){
    // challenge mode: render exactly the project's allowed blocks (incl. challenge-
    // only ones like Lift/Drop that aren't in the normal CATS), grouped by category
    const allow=mgState.proj.allowed||CHALLENGE_BLOCKS;
    const catName={};for(const c of CATS)catName[c.id]=c.name;
    const groups={},order=[];
    for(const t of allow){ if(!DEFS[t])continue; const c=DEFS[t].cat; if(!groups[c]){groups[c]=[];order.push(c);} groups[c].push(t); }
    for(const c of order){
      const div=document.createElement("div");div.className="pcat";
      let html='<h4>'+(catName[c]||c)+'</h4><div class="row">';
      for(const t of groups[c]){const d=DEFS[t];html+='<button class="pblk c-'+d.cat+'" data-t="'+t+'">'+d.ic+' '+d.lbl+'</button>';}
      div.innerHTML=html+'</div>';pal.appendChild(div);
    }
    pal.querySelectorAll(".pblk").forEach(btn=>btn.addEventListener("click",()=>addBlock(btn.dataset.t)));
    return;
  }
  for(const cat of CATS){
    const locked=cat.lock&&!unlocks[cat.lock];
    const div=document.createElement("div");
    div.className="pcat"+(locked?" locked":"");
    let html='<h4>'+cat.name+(locked?" 🔒":"")+'</h4><div class="row">';
    for(const t of cat.types){
      const d=DEFS[t];
      html+='<button class="pblk c-'+d.cat+'" data-t="'+t+'" '+(locked?"disabled":"")+'>'+d.ic+' '+d.lbl+'</button>';
    }
    html+='</div>';
    if(locked)html+='<div class="lockmsg">'+cat.need+'</div>';
    div.innerHTML=html;
    pal.appendChild(div);
  }
  pal.querySelectorAll(".pblk").forEach(btn=>btn.addEventListener("click",()=>addBlock(btn.dataset.t)));
}
function updateChips(){
  const wrap=$("robotChips");wrap.innerHTML="";
  if(mgState){
    const c=document.createElement("button");
    c.className="rchip sel";
    const nb=progSize(mgRobot), over=nb>mgState.proj.maxBlocks;
    c.innerHTML="🏗️ "+esc(mgState.proj.name)+' <span class="rbudget" style="color:'+(over?"#ff5d73":"#ffd66b")+'">🧩'+nb+"/"+mgState.proj.maxBlocks+"</span>"+(mgState.running?' <span class="live">●RUN</span>':'');
    wrap.appendChild(c);
    return;
  }
  robots.forEach((r,i)=>{
    const c=document.createElement("button");
    c.className="rchip"+(i===selRobot?" sel":"");
    c.innerHTML='<span class="dot" style="background:'+r.color+'"></span>'+r.name+(r.running?' <span class="live">●RUN</span>':'');
    c.addEventListener("click",()=>{selRobot=i;selBlock=null;elseSel=null;renderProgram();renderPy();updateChips();updateHud();updateFab();updateUndoBtns();follow=true;});
    wrap.appendChild(c);
  });
  const add=document.createElement("button");
  add.className="rchip";add.textContent="＋ robot";
  add.addEventListener("click",openShop);
  wrap.appendChild(add);
}
