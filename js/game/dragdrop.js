"use strict";
/* ---------------- drag & drop blocks ---------------- */
let dragCtx=null, dragSuppress=false;
function attachDrag(row,b){
  row.addEventListener("pointerdown",e=>{
    if(e.target.closest(".pbtn"))return;
    if(e.pointerType==="mouse"&&e.button!==0)return;
    const sx=e.clientX, sy=e.clientY;
    let hold=setTimeout(()=>{hold=null;beginDrag(b,row,sx,sy);},240);
    const mv=ev=>{
      if(hold){ if(Math.hypot(ev.clientX-sx,ev.clientY-sy)>10){clearTimeout(hold);hold=null;done();} return; }
      if(dragCtx){ev.preventDefault();dragMove(ev.clientX,ev.clientY);}
    };
    const up=ev=>{ if(hold){clearTimeout(hold);hold=null;} if(dragCtx){dragEnd(ev.clientX,ev.clientY);dragSuppress=true;} done(); };
    function done(){document.removeEventListener("pointermove",mv);document.removeEventListener("pointerup",up);document.removeEventListener("pointercancel",up);}
    document.addEventListener("pointermove",mv,{passive:false});
    document.addEventListener("pointerup",up);
    document.addEventListener("pointercancel",up);
  });
}
function isDescUid(uid){return !!byUid(dragCtx.b.body||[],uid)||!!byUid(dragCtx.b.els||[],uid);}
function beginDrag(b,row,x,y){
  dragCtx={b,uid:b.uid,w:row.offsetWidth,h:row.offsetHeight};
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
  const blk=byUid(R().program,+hit.el.dataset.uid), isC=!!blk.body, rel=(y-hit.r.top)/hit.r.height;
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

function updateSelUI(){
  const bar=$("selActions");
  if(selBlock||elseSel){
    bar.classList.add("show");
    $("insNote").textContent = elseSel ? "new blocks → inside Else" :
      (selBlock.body ? "new blocks → inside "+DEFS[selBlock.t].lbl : "new blocks → after selection");
  }else bar.classList.remove("show");
}
$("delBlk").addEventListener("click",()=>{
  if(!selBlock)return;
  pushUndo();
  const f=findList(R().program,selBlock);
  if(f)f.list.splice(f.i,1);
  selBlock=null;programChanged();
});
$("dupBlk").addEventListener("click",()=>{
  if(!selBlock)return;
  const f=findList(R().program,selBlock);
  if(!f)return;
  pushUndo();
  const copy=JSON.parse(JSON.stringify(selBlock));
  reUid([copy]);
  f.list.splice(f.i+1,0,copy);
  programChanged();
});
function moveSel(dir){
  if(!selBlock)return;
  const f=findList(R().program,selBlock);
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
    // challenge mode: the FULL programming toolbox (loops, conditions, variables) — everything unlocked
    const allow=mgState.proj.allowed||CHALLENGE_BLOCKS;
    for(const cat of CATS){
      const types=cat.types.filter(t=>allow.indexOf(t)>=0);
      if(!types.length)continue;
      const div=document.createElement("div");div.className="pcat";
      let html='<h4>'+cat.name+'</h4><div class="row">';
      for(const t of types){const d=DEFS[t];html+='<button class="pblk c-'+d.cat+'" data-t="'+t+'">'+d.ic+' '+d.lbl+'</button>';}
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
    const nb=countBlocks(mgRobot.program), over=nb>mgState.proj.maxBlocks;
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
