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
/* ---------------- routines ----------------
   A robot has a main program plus named routines the program can 🔧 Call. The
   editor shows ONE list at a time; `edTarget` says which, and curList() is what
   every edit operation works on. Execution, persistence and the block budget
   still deal with the whole set. */
const ROUTINE_IDS=["A","B"];
let edTarget="main";
function robotRoutines(r){
  if(!r.routines)r.routines={};
  for(const id of ROUTINE_IDS)routineOf(r,id);   // normalises old array-shaped saves
  return r.routines;
}
function curList(){
  const r=R();
  return edTarget==="main"?r.program:routineOf(r,edTarget).body;
}
// total blocks the player has written: a routine body counts ONCE however many
// times it's called, so factoring repeated work into a routine is rewarded by
// the budget instead of punished by it.
function progSize(r){
  let n=countBlocks(r.program);
  for(const id of ROUTINE_IDS)n+=countBlocks(routineOf(r,id).body);
  return n;
}
// stored form: a plain array while no routines are used (so every existing save
// and every stored solution keeps loading), an object once they are.
function packProg(r){
  const R2=robotRoutines(r);
  const used=ROUTINE_IDS.some(id=>routineOf(r,id).body.length);
  return used?{main:r.program,routines:JSON.parse(JSON.stringify(R2))}:r.program;
}
function unpackProg(stored){
  if(Array.isArray(stored)||!stored)return {program:stored?JSON.parse(JSON.stringify(stored)):[],routines:null};
  return {program:JSON.parse(JSON.stringify(stored.main||[])),
          routines:JSON.parse(JSON.stringify(stored.routines||{}))};
}
function applyProg(r,stored){
  const u=unpackProg(stored);
  r.program=u.program; reUid(r.program);
  r.routines={};
  for(const id of ROUTINE_IDS){
    r.routines[id]=(u.routines&&u.routines[id])||{params:[],body:[]};
    reUid(routineOf(r,id).body);          // routineOf upgrades an old bare array
  }
}
/* move a block to a new spot in the program tree (drag & drop core; also unit-tested) */
function moveBlock(dragUid,mode,anchorUid,which){
  const prog=curList();
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
// snapshot the WHOLE set — main plus every routine — or an undo taken after a
// routine edit would silently throw that edit away
function progSnapshot(r){return JSON.stringify({main:r.program,routines:robotRoutines(r)});}
function pushUndo(){
  const r=R();
  if(!r.hist)r.hist=[];
  r.hist.push(progSnapshot(r));
  if(r.hist.length>50)r.hist.shift();
  r.redoS=[];
}
function restoreProgram(r,json,toStack){
  toStack.push(progSnapshot(r));
  const s=JSON.parse(json);
  r.program=s.main||[];reUid(r.program);
  r.routines={};
  for(const id of ROUTINE_IDS){
    r.routines[id]=(s.routines&&s.routines[id])||{params:[],body:[]};
    reUid(routineOf(r,id).body);
  }
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
  else if(selBlock){const f=findList(curList(),selBlock);if(f)f.list.splice(f.i+1,0,b);else curList().push(b);}
  else curList().push(b);
  sfx(440,.04);
  programChanged();
}
// tabs for the main program and each routine, with a dot on whichever is running
function renderRoutineTabs(){
  const el=$("routineTabs"); if(!el)return;
  const r=R(), R2=robotRoutines(r);
  const inCur=uid=>uid!=null&&!!byUid(curList(),uid);
  const tab=(id,label,list)=>{
    const running=r.running&&r.curUid!=null&&byUid(list,r.curUid);
    return '<button class="rtab'+(edTarget===id?" on":"")+'" data-rt="'+id+'">'+
      label+' <span class="rn">'+countBlocks(list)+'</span>'+(running?' ●':'')+'</button>';
  };
  el.innerHTML=tab("main","🧩 Main",r.program)+
    ROUTINE_IDS.map(id=>tab(id,"🔧 "+fnLabel(r,id),routineOf(r,id).body)).join("")+
    (edTarget!=="main"?'<button class="rtab rp" data-params="1" title="Edit this function\'s parameters">🏷️ inputs</button>':"")+
    '<button class="rtab rlib" data-lib="1" title="My saved functions">📚</button>';
  el.querySelectorAll(".rtab[data-rt]").forEach(b=>b.addEventListener("click",()=>{
    edTarget=b.dataset.rt; selBlock=null; elseSel=null;
    sfx(520,.03); renderProgram(); renderPy(); updateSelUI();
  }));
  const pb=el.querySelector("[data-params]");
  if(pb)pb.addEventListener("click",()=>editParams(edTarget));
  const lb=el.querySelector("[data-lib]");
  if(lb)lb.addEventListener("click",()=>openFuncLib());
}
// name the values a function takes in. Kept to plain comma-separated names so a
// child types "a, b" rather than meeting a form.
function editParams(id){
  const r=R(), f=routineOf(r,id);
  const cur=(f.params||[]).join(", ");
  const t=prompt("What does function "+id+" take in?\nComma-separated names, or leave empty for none:",cur);
  if(t===null)return;
  pushUndo();
  f.params=t.split(",").map(x=>x.trim().replace(/\W+/g,"_").slice(0,10)).filter(Boolean).slice(0,4);
  sfx(560,.04); programChanged();
}
function renderProgram(){
  const r=R(), root=$("programEl");
  renderRoutineTabs();
  root.innerHTML="";
  if(!curList().length){
    root.innerHTML=edTarget==="main"
      ? '<div class="empty">🧩 Tap blocks below to program <b>'+esc(r.name)+'</b>!<br>Try: <b>🚶 Walk To 🌳</b> → <b>🪓 Chop</b> → <b>🚶 Walk To 🏪</b> → <b>⤵️ Drop</b>.</div>'
      : '<div class="empty">🔧 Routine <b>'+edTarget+'</b> is empty.<br>Put the steps you repeat in here, then 🔧 Call it from your main program.</div>';
  }else renderList(curList(),root);
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
        inner+='<button class="pbtn" data-p="cvar">📦 '+esc(b.cond.var)+'</button><button class="pbtn" data-p="cop">'+opLbl(b.cond.op)+'</button>';
        if(isVar)inner+='<button class="pbtn" data-p="crname">📦 '+esc(rv.name)+'</button>';
        else inner+='<button class="pbtn" data-p="cvdec">−</button><span class="num">'+condNum(b.cond)+'</span><button class="pbtn" data-p="cvinc">＋</button>';
        inner+='<button class="pbtn" data-p="cvkind">'+(isVar?"🔢":"📦")+'</button>';
      }
      else inner+='<button class="pbtn" data-p="cond">'+COND_LBL[b.cond]+'</button>';
    }
    if(b.t==="build")inner+='<button class="pbtn" data-p="build">'+BUILD_LBL[b.opt]+'</button>';
    if(b.t==="faceNearest"||b.t==="goNear"){
      // a fixed place, or wherever a variable says — "walk to what the order wants"
      if(b.src)inner+='<button class="pbtn" data-p="tsrc">📦 '+esc(b.src)+'</button>';
      else inner+='<button class="pbtn" data-p="tgt">'+TGT_EM[b.opt]+' '+b.opt+'</button>';
      if(mgState||unlocks.vars)inner+='<button class="pbtn" data-p="tmode">'+(b.src?"🗺️":"📦")+'</button>';
    }
    if(b.t==="call"){
      const f=routineOf(R(),b.fn||"A");
      inner+='<button class="pbtn" data-p="fn">🔧 '+(b.fn||"A")+'</button>';
      (f.params||[]).forEach((pn,i)=>{
        const av=(b.args&&b.args[i])||{k:"num",n:0};
        inner+='<span class="pnm">'+esc(pn)+'=</span>'+
          '<button class="pbtn" data-p="akind" data-i="'+i+'">'+(av.k==="var"?"📦":"🔢")+'</button>'+
          (av.k==="var"
            ? '<button class="pbtn" data-p="aname" data-i="'+i+'">'+esc(av.name||"x")+'</button>'
            : '<button class="pbtn" data-p="adec" data-i="'+i+'">−</button><span class="num">'+(av.n|0)+'</span><button class="pbtn" data-p="ainc" data-i="'+i+'">＋</button>');
      });
      const outs=callOuts(b);
      inner+='<button class="pbtn" data-p="out">'+(outs.length?"→ 📦 "+outs.map(esc).join(", "):"→ —")+'</button>';
    }
    if(b.t==="ret"){
      // one chip group per value handed back, plus ＋ / ✂ to change how many
      const vs=retVals(b);
      vs.forEach((v,i)=>{
        if(i)inner+='<span class="pnm">,</span>';
        inner+='<button class="pbtn" data-p="rkind" data-i="'+i+'">'+(v.k==="var"?"📦":"🔢")+'</button>'+
          (v.k==="var"
            ? '<button class="pbtn" data-p="rname" data-i="'+i+'">'+esc(v.name||"x")+'</button>'
            : '<button class="pbtn" data-p="rdec" data-i="'+i+'">−</button><span class="num">'+(v.n|0)+'</span><button class="pbtn" data-p="rinc" data-i="'+i+'">＋</button>');
      });
      if(vs.length<4)inner+='<button class="pbtn" data-p="rmore" title="Give back one more value">＋val</button>';
      if(vs.length>1)inner+='<button class="pbtn" data-p="rless" title="One fewer">✂</button>';
    }
    if(b.t==="read"&&b.src==="price")inner+='<button class="pbtn" data-p="pres">'+RES[b.opt||"wood"].em+'</button>';
    if(b.t==="broadcast"||b.t==="goTo")inner+='<button class="pbtn" data-p="ch">'+(RADIO_EM[b.opt]||"📻")+' '+b.opt+'</button>';
    row.innerHTML=inner;
    row.title="Hold & drag to move";
    attachDrag(row,b);
    row.addEventListener("click",e=>{
      if(dragSuppress){dragSuppress=false;e.stopPropagation();return;}
      /* Find the chip that was tapped, not merely whatever pixel the finger hit.
         ui-icons.js swaps every emoji for a <span class="ui-emoji"><svg>…</svg></span>,
         so on a chip like "🔧 A" or "＋" the event target is that span (or the svg
         inside it) and reading dataset.p off it found nothing — the chip looked
         dead. Anything with no [data-p] ancestor inside the row still falls
         through to "select this block", exactly as before. */
      const el=(e.target.closest&&e.target.closest("[data-p]"))||e.target;
      const p=el.dataset&&el.dataset.p;
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
          // cycle > < = ≠, then fall back out to the sensor list
          const oi=OPS.indexOf(b.cond.op);
          if(oi>=0&&oi<OPS.length-1)b.cond.op=OPS[oi+1];
          else b.cond=((mgState&&typeof mgCondList==="function")?mgCondList():CONDS)[0];
        }
        if(p==="cvdec")condSetNum(b.cond,condNum(b.cond)-1);
        if(p==="cvinc")condSetNum(b.cond,condNum(b.cond)+1);
        // toggle the comparison's right side between a number and another variable
        if(p==="cvkind"){
          const rv=b.cond.val;
          b.cond.val=(rv&&typeof rv==="object"&&rv.k==="var")?{k:"num",n:3}:{k:"var",name:"y"};
        }
        if(p==="crname")b.cond.val={k:"var",name:promptName(b.cond.val&&b.cond.val.name)};
        if(p==="rsrc"){
          // 💰 market price is a WORLD reading — there is no market on a challenge
          // board, so don't offer a source that could only ever answer 0 there
          const OFF={price:1,order:1,orderLeft:1};   // world-only readings
          const SRCS=mgState?READ_SRC.filter(x=>!OFF[x]):READ_SRC;
          const i=SRCS.indexOf(b.src);
          b.src=SRCS[(i<0?0:i+1)%SRCS.length];
        }
        if(p==="build")b.opt=BUILDS[(BUILDS.indexOf(b.opt)+1)%BUILDS.length];
        if(p==="tgt")b.opt=TARGETS[(TARGETS.indexOf(b.opt)+1)%TARGETS.length];
        if(p==="tmode")b.src=b.src?null:"what";
        if(p==="tsrc")b.src=promptName(b.src);
        if(p==="ch")b.opt=RADIO_CH[(RADIO_CH.indexOf(b.opt)+1)%RADIO_CH.length];
        if(p==="pres")b.opt=MKT_RES[(MKT_RES.indexOf(b.opt)+1)%MKT_RES.length];
        if(p==="fn"){b.fn=ROUTINE_IDS[(ROUTINE_IDS.indexOf(b.fn)+1)%ROUTINE_IDS.length];b.args=[];}
        if(p==="out"){
          const cur=callOuts(b).join(", ");
          const nm=prompt("Catch the values it gives back in which variables?\nComma-separated, in order. Empty = throw them away.",cur||"result");
          if(nm!==null){
            b.outs=nm.split(",").map(x=>x.trim().replace(/\W+/g,"_").slice(0,10)).filter(Boolean).slice(0,4);
            delete b.out;
          }
        }
        if(b.t==="ret"&&(p==="rkind"||p==="rname"||p==="rdec"||p==="rinc"||p==="rmore"||p==="rless")){
          b.vals=retVals(b).map(v=>Object.assign({},v)); delete b.val;
          if(p==="rmore"){ if(b.vals.length<4)b.vals.push({k:"num",n:0}); }
          else if(p==="rless"){ if(b.vals.length>1)b.vals.pop(); }
          else{
            const i=+el.dataset.i;   // was `btn` — a name that never existed here
            if(!b.vals[i])b.vals[i]={k:"num",n:0};
            const v=b.vals[i];
            if(p==="rkind")b.vals[i]=v.k==="var"?{k:"num",n:0}:{k:"var",name:"x"};
            else if(p==="rname")v.name=promptName(v.name);
            else if(p==="rdec")v.n=(v.n|0)-1;
            else if(p==="rinc")v.n=(v.n|0)+1;
          }
        }
        if(p==="akind"||p==="aname"||p==="adec"||p==="ainc"){
          const i=+el.dataset.i;     // was `btn` — a name that never existed here
          b.args=b.args||[];
          if(!b.args[i])b.args[i]={k:"num",n:0};
          const av=b.args[i];
          if(p==="akind")b.args[i]=av.k==="var"?{k:"num",n:0}:{k:"var",name:"x"};
          else if(p==="aname")av.name=promptName(av.name);
          else if(p==="adec")av.n=(av.n|0)-1;
          else if(p==="ainc")av.n=(av.n|0)+1;
        }
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
        const f=findList(curList(),b);
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
