"use strict";
/* ---------------- editor UI ---------------- */
let selBlock=null, elseSel=null;
function findList(list,blk){
  for(let i=0;i<list.length;i++){
    if(list[i]===blk)return {list,i};
    if(list[i].body){const f=findList(list[i].body,blk);if(f)return f;}
    if(list[i].els){const f=findList(list[i].els,blk);if(f)return f;}
  }
  return null;
}
function byUid(list,uid){
  for(const b of list){
    if(b.uid===uid)return b;
    if(b.body){const f=byUid(b.body,uid);if(f)return f;}
    if(b.els){const f=byUid(b.els,uid);if(f)return f;}
  }
  return null;
}
function isDescendant(parent,node){
  if(!parent||parent===node)return false;
  const scan=l=>l&&l.some(b=>b===node||scan(b.body)||scan(b.els));
  return scan(parent.body)||scan(parent.els);
}
/* move a block to a new spot in the program tree (drag & drop core; also unit-tested) */
function moveBlock(dragUid,mode,anchorUid,which){
  const prog=R().program;
  const dragBlk=byUid(prog,dragUid);
  if(!dragBlk)return false;
  let anchor=null;
  if(mode!=="root-end"){
    anchor=byUid(prog,anchorUid);
    if(!anchor||anchor===dragBlk||isDescendant(dragBlk,anchor))return false;
  }
  pushUndo();
  const f=findList(prog,dragBlk);f.list.splice(f.i,1);
  if(mode==="root-end")prog.push(dragBlk);
  else if(mode==="into"){
    const tgt=which==="els"?(anchor.els=anchor.els||[]):(anchor.body=anchor.body||[]);
    tgt.push(dragBlk);
  }else{
    const g=findList(prog,anchor);
    if(!g)prog.push(dragBlk);
    else g.list.splice(mode==="before"?g.i:g.i+1,0,dragBlk);
  }
  selBlock=dragBlk;elseSel=null;
  programChanged();
  return true;
}
function pushUndo(){
  const r=R();
  if(!r.hist)r.hist=[];
  r.hist.push(JSON.stringify(r.program));
  if(r.hist.length>50)r.hist.shift();
  r.redoS=[];
}
function restoreProgram(r,json,toStack){
  toStack.push(JSON.stringify(r.program));
  r.program=JSON.parse(json);reUid(r.program);
  selBlock=null;elseSel=null;programChanged();
}
function doUndo(){const r=R();if(r.hist&&r.hist.length)restoreProgram(r,r.hist.pop(),(r.redoS=r.redoS||[]));}
function doRedo(){const r=R();if(r.redoS&&r.redoS.length)restoreProgram(r,r.redoS.pop(),(r.hist=r.hist||[]));}
function updateUndoBtns(){
  const r=R();
  $("undoBtn").style.opacity=(r.hist&&r.hist.length)?"1":".35";
  $("redoBtn").style.opacity=(r.redoS&&r.redoS.length)?"1":".35";
}
$("undoBtn").addEventListener("click",doUndo);
$("redoBtn").addEventListener("click",doRedo);
function programChanged(){
  const r=R();
  if(mgState){
    if(mgState.running)mgStop();
    mgUpdateCount();
    renderProgram();renderPy();updateUndoBtns();
    return;
  }
  if(r.running){stopRobot(r);toast("⏹ "+r.name+" stopped — program changed");}
  renderProgram();renderPy();saveSoon();updateUndoBtns();
  if(!tut.done&&tut.step===2&&r.program.length>=2)tutSet(3);
}
let lastAdded=null, lastTapDel={uid:0,t:0};
function addBlock(t){
  pushUndo();
  const b=newBlock(t), r=R();
  lastAdded=b.uid;
  if(elseSel){elseSel.els.push(b);}
  else if(selBlock&&selBlock.body){selBlock.body.push(b);}
  else if(selBlock){const f=findList(r.program,selBlock);if(f)f.list.splice(f.i+1,0,b);else r.program.push(b);}
  else r.program.push(b);
  sfx(440,.04);
  programChanged();
}
function renderProgram(){
  const r=R(), root=$("programEl");
  root.innerHTML="";
  if(!r.program.length){
    root.innerHTML='<div class="empty">🧩 Tap blocks below to program <b>'+r.name+'</b>!<br>Try: <b>Repeat 3</b> → put <b>Move</b> inside → then <b>Collect</b>.</div>';
  }else renderList(r.program,root);
  updateSelUI();
}
function renderList(list,parent){
  for(const b of list){
    const d=DEFS[b.t];
    const row=document.createElement("div");
    row.className="blk c-"+d.cat+(b===selBlock?" sel":"")+(b.uid===lastAdded?" new":"");
    if(b.uid===lastAdded)setTimeout(()=>{lastAdded=null;},50);
    row.dataset.uid=b.uid;
    let inner='<span class="ic">'+d.ic+'</span><span class="lbl">'+d.lbl+'</span>';
    const valCtl=v=>{
      let s='<button class="pbtn" data-p="vkind">'+(v.k==="num"?"🔢":v.k==="str"?"🔤":"📦")+'</button>';
      if(v.k==="num")s+='<button class="pbtn" data-p="vdec">−</button><span class="num">'+v.n+'</span><button class="pbtn" data-p="vinc">＋</button>';
      else if(v.k==="str")s+='<button class="pbtn" data-p="vtxt">"'+esc(String(v.s).slice(0,10))+'"</button>';
      else s+='<button class="pbtn" data-p="vvar">📦 '+esc(v.name)+'</button>';
      return s;
    };
    if(b.t==="wait"||b.t==="changeVar"){
      if(b.t==="changeVar")inner+='<button class="pbtn" data-p="vname">'+esc(b.name)+'</button><span>by</span>';
      // ➕ Change by a VALUE, so `s = s + v` works — not just `s = s + 1`
      const byVar=b.t==="changeVar"&&b.n&&typeof b.n==="object"&&b.n.k==="var";
      if(byVar)inner+='<button class="pbtn" data-p="nname">📦 '+esc(b.n.name)+'</button>';
      else inner+='<button class="pbtn" data-p="dec">−</button><span class="num">'+numOf(b.n)+'</span><button class="pbtn" data-p="inc">＋</button>';
      if(b.t==="changeVar")inner+='<button class="pbtn" data-p="nkind">'+(byVar?"🔢":"📦")+'</button>';
    }
    if(b.t==="repeat"){
      if(b.src)inner+='<button class="pbtn" data-p="rname">📦 '+esc(b.src)+'</button><button class="pbtn" data-p="rmode">🔢</button>';
      else{
        inner+='<button class="pbtn" data-p="dec">−</button><span class="num">'+b.n+'</span><button class="pbtn" data-p="inc">＋</button>';
        if(mgState||unlocks.vars)inner+='<button class="pbtn" data-p="rmode">📦</button>'; // challenges: everything unlocked
      }
    }
    if(b.t==="countLoop")inner+='<button class="pbtn" data-p="vname">'+esc(b.name)+'</button><span>1→</span><button class="pbtn" data-p="tdec">−</button><span class="num">'+b.to+'</span><button class="pbtn" data-p="tinc">＋</button>';
    if(b.t==="setVar")inner+='<button class="pbtn" data-p="vname">'+esc(b.name)+'</button><span>=</span>'+valCtl(b.val);
    if(b.t==="say")inner+=valCtl(b.val);
    if(b.t==="read")inner+='<button class="pbtn" data-p="vname">'+esc(b.name)+'</button><span>=</span><button class="pbtn" data-p="rsrc">'+(READ_LBL[b.src]||b.src)+'</button>';
    if(b.t==="if"||b.t==="whileLoop"){
      if(typeof b.cond==="object"){
        // the right side is a VALUE: a number (−/+) or another variable, so `x > y` works
        const rv=b.cond.val, isVar=!!(rv&&typeof rv==="object"&&rv.k==="var");
        inner+='<button class="pbtn" data-p="cvar">📦 '+esc(b.cond.var)+'</button><button class="pbtn" data-p="cop">'+b.cond.op+'</button>';
        if(isVar)inner+='<button class="pbtn" data-p="crname">📦 '+esc(rv.name)+'</button>';
        else inner+='<button class="pbtn" data-p="cvdec">−</button><span class="num">'+condNum(b.cond)+'</span><button class="pbtn" data-p="cvinc">＋</button>';
        inner+='<button class="pbtn" data-p="cvkind">'+(isVar?"🔢":"📦")+'</button>';
      }
      else inner+='<button class="pbtn" data-p="cond">'+COND_LBL[b.cond]+'</button>';
    }
    if(b.t==="build")inner+='<button class="pbtn" data-p="build">'+BUILD_LBL[b.opt]+'</button>';
    if(b.t==="faceNearest")inner+='<button class="pbtn" data-p="tgt">'+TGT_EM[b.opt]+' '+b.opt+'</button>';
    row.innerHTML=inner;
    row.title="Hold & drag to move";
    attachDrag(row,b);
    row.addEventListener("click",e=>{
      if(dragSuppress){dragSuppress=false;e.stopPropagation();return;}
      const p=e.target.dataset&&e.target.dataset.p;
      if(p){
        pushUndo();
        if(p==="inc")b.n=Math.min(99,numOf(b.n)+1);
        if(p==="dec")b.n=b.t==="changeVar"?Math.max(-99,numOf(b.n)-1):Math.max(1,numOf(b.n)-1);
        // toggle "change by a number" ↔ "change by another variable"
        if(p==="nkind")b.n=(b.n&&typeof b.n==="object")?1:{k:"var",name:"v"};
        if(p==="nname")b.n={k:"var",name:promptName(b.n&&b.n.name)};
        if(p==="cond"){
          // inside a challenge the sensor list is the board's, not the world's
          const L=(mgState&&typeof mgCondList==="function")?mgCondList():CONDS;
          const ci=L.indexOf(b.cond); // -1 for a cond carried in from the other list
          if(ci===L.length-1&&(mgState||unlocks.vars))b.cond={var:"x",op:">",val:3}; // compare variables freely
          else b.cond=L[(ci+1)%L.length];
        }
        if(p==="cvar")b.cond.var=promptName(b.cond.var);
        if(p==="cop"){
          b.cond.op=b.cond.op===">"?"<":b.cond.op==="<"?"=":null;
          if(!b.cond.op)b.cond=((mgState&&typeof mgCondList==="function")?mgCondList():CONDS)[0];
        }
        if(p==="cvdec")condSetNum(b.cond,condNum(b.cond)-1);
        if(p==="cvinc")condSetNum(b.cond,condNum(b.cond)+1);
        // toggle the comparison's right side between a number and another variable
        if(p==="cvkind"){
          const rv=b.cond.val;
          b.cond.val=(rv&&typeof rv==="object"&&rv.k==="var")?{k:"num",n:3}:{k:"var",name:"y"};
        }
        if(p==="crname")b.cond.val={k:"var",name:promptName(b.cond.val&&b.cond.val.name)};
        if(p==="rsrc")b.src=READ_SRC[(READ_SRC.indexOf(b.src)+1)%READ_SRC.length];
        if(p==="build")b.opt=BUILDS[(BUILDS.indexOf(b.opt)+1)%BUILDS.length];
        if(p==="tgt")b.opt=TARGETS[(TARGETS.indexOf(b.opt)+1)%TARGETS.length];
        if(p==="vname")b.name=promptName(b.name);
        if(p==="vkind")b.val=b.val.k==="num"?{k:"str",s:"Hello!"}:b.val.k==="str"?{k:"var",name:"x"}:{k:"num",n:5};
        if(p==="vdec")b.val.n--;
        if(p==="vinc")b.val.n++;
        if(p==="vtxt"){const s=prompt("Text:",b.val.s);if(s!==null)b.val.s=s.slice(0,30);}
        if(p==="vvar")b.val.name=promptName(b.val.name);
        if(p==="tdec")b.to=Math.max(1,b.to-1);
        if(p==="tinc")b.to=Math.min(99,b.to+1);
        if(p==="rmode")b.src=b.src?null:"x";
        if(p==="rname")b.src=promptName(b.src);
        programChanged();e.stopPropagation();return;
      }
      // double-tap deletes — only in the maximized (focused coding) editor
      if($("editor").classList.contains("max")&&lastTapDel.uid===b.uid&&performance.now()-lastTapDel.t<380){
        lastTapDel={uid:0,t:0};
        pushUndo();
        const f=findList(R().program,b);
        if(f)f.list.splice(f.i,1);
        if(selBlock===b)selBlock=null;
        sfx(300,.05);
        programChanged();
        e.stopPropagation();return;
      }
      lastTapDel={uid:b.uid,t:performance.now()};
      selBlock=(selBlock===b)?null:b;elseSel=null;
      renderProgram();
      e.stopPropagation();
    });
    parent.appendChild(row);
    if(b.body){
      const nest=document.createElement("div");
      nest.className="nest";
      if(!b.body.length)nest.innerHTML='<div class="hint">'+(b===selBlock?"👇 new blocks go in here":"tap "+d.lbl+" then add blocks inside")+'</div>';
      renderList(b.body,nest);
      parent.appendChild(nest);
    }
    if(b.t==="if"){
      const er=document.createElement("div");
      er.className="blk c-logic elserow"+(elseSel===b?" sel":"");
      er.innerHTML='<span class="ic">↪️</span><span class="lbl">Else</span>';
      er.addEventListener("click",e=>{elseSel=(elseSel===b)?null:b;selBlock=null;renderProgram();e.stopPropagation();});
      parent.appendChild(er);
      const en=document.createElement("div");
      en.className="nest";
      if(!b.els.length)en.innerHTML='<div class="hint">'+(elseSel===b?"👇 new blocks go in here":"runs when the condition is false")+'</div>';
      renderList(b.els,en);
      parent.appendChild(en);
    }
  }
}
