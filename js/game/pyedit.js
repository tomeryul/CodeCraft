"use strict";
/* ---------------- the Python editor ----------------
   The 🐍 tab used to print the program. Now it is where you can write it:
   type a line and its block appears in the Blocks tab; change a block and
   its line changes here. pyparse.js does the reading; this file is the
   page around it.

   The blocks stay the program. What is typed is read into blocks the
   moment it makes sense, and until it does the blocks keep the last
   version that did — so a half-typed line never breaks a running robot,
   and Run never runs something the player cannot see.

   What the text is, for each robot, is `r.py`:
     text   what the editor shows
     base   the blocks (pyCanon) this text was last in step with
     gen    true while the text is the game's own listing, untouched
   While the blocks still come to `base`, the text is the player's and is
   left alone — their spacing, their notes, a line they are half way
   through. The moment the blocks change some other way (a block dragged,
   an undo), the text is written out fresh.

   Three things a phone needs that a desk does not, all handled here:
   a keyboard that covers the bottom of the screen (kbSync), the keys it
   buries two layers down (#pyKeys), and not having to type at all — the
   palette is in this tab too, each chip writing its own line (#pySnips). */
(function(){
const ta=$("pyEdit"), pre=$("pyCode"), gut=$("pyGut"), pane=$("pyPane"), marks=$("pyMarks"),
      sayEl=$("pySay"), keysEl=$("pyKeys"), snipsEl=$("pySnips"), tab=$("pyTab"), ed=$("editor");
if(!ta||!pre)return;
const LH=parseFloat(getComputedStyle(tab).getPropertyValue("--py-lh"))||26;
const PAD=parseFloat(getComputedStyle(tab).getPropertyValue("--py-pad"))||10;
const SOFT={bodyNone:1};       // not a mistake yet: a loop still waiting for its first line
const S={owner:null,err:null,shown:false,ro:false,parse:null,map:null,run:0,busy:false,
  tCheck:0,tShow:0,prev:"",hist:[],hi:-1,lastSnap:0,gutN:0,saySig:"",snipSig:"",kb:0,hadFocus:false};
marks.innerHTML='<i class="bad"></i><i class="run"></i><i class="new"></i>';
const mBad=marks.children[0], mRun=marks.children[1], mNew=marks.children[2];
const he=()=>typeof lang!=="undefined"&&lang==="he";
const visible=()=>ed.classList.contains("open")&&tab.style.display!=="none";

/* ---- colours ---- */
const ESC=s=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const RX=/(#.*$)|("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?|[“”„][^“”„"]*[“”„"]?|[‘’][^‘’']*[‘’']?)|\b(for|in|if|elif|else|while|def|return|not|and|or|pass|True|False|None)\b|\b(robot|team|market)\b|\b(range|print|routine_[ab])\b|\b(\d+(?:\.\d+)?)\b|\.([A-Za-z_]\w*)(?=\s*\()/g;
function segs(line){
  const out=[]; let last=0, m; RX.lastIndex=0;
  while((m=RX.exec(line))){
    if(!m[0].length){RX.lastIndex++;continue;}
    if(m.index>last)out.push([line.slice(last,m.index),""]);
    if(m[7]!==undefined){out.push([".",""]);out.push([m[7],"f"]);}
    else out.push([m[0],m[1]!==undefined?"c":m[2]!==undefined?"s":m[3]!==undefined?"k":
      m[4]!==undefined?"o":m[5]!==undefined?"f":"n"]);
    last=m.index+m[0].length;
  }
  if(last<line.length)out.push([line.slice(last),""]);
  return out;
}
/* one line as markup; `q` is the stretch of it a message is about */
function lineHtml(line,q){
  let pos=0, html="";
  const piece=(t,c,on)=>{
    const cls=(c||"")+(on?(c?" ":"")+"q"+(q.soft?" soft":""):"");
    return cls?'<span class="'+cls+'">'+ESC(t)+'</span>':ESC(t);
  };
  for(const [t,c] of segs(line)){
    const s=pos, e=pos+t.length; pos=e;
    if(!q||e<=q.a||s>=q.b){html+=piece(t,c,false);continue;}
    const a=Math.max(s,q.a), b=Math.min(e,q.b);
    if(a>s)html+=piece(t.slice(0,a-s),c,false);
    html+=piece(t.slice(a-s,b-s),c,true);
    if(b<e)html+=piece(t.slice(b-s),c,false);
  }
  return html;
}
function shownErr(){return (S.shown&&S.err&&!S.ro)?S.err:null;}
function paint(){
  const text=ta.value, lines=text.split("\n"), e=shownErr();
  /* the trailing newline is what gives a last, empty line its height — a
     <pre> does not draw one for a newline that ends it, a <textarea> does */
  pre.innerHTML=lines.map((l,i)=>lineHtml(l,(e&&e.line===i+1&&e.col>=0&&e.len>0)
    ?{a:e.col,b:e.col+e.len,soft:!!SOFT[e.key]}:null)).join("\n")+"\n";
  if(S.gutN!==lines.length){
    S.gutN=lines.length;
    let g="";
    for(let i=1;i<=lines.length;i++)g+="<div>"+i+"</div>";
    gut.innerHTML=g;
  }
  const bad=e&&!SOFT[e.key]?e.line:0;
  gut.querySelectorAll(".bad").forEach(x=>x.classList.remove("bad"));
  if(bad&&gut.children[bad-1])gut.children[bad-1].classList.add("bad");
  mark(mBad,bad);
  runMark();
  /* nothing but notes: say what goes here, on the line after the last of them */
  const empty=!/^[ \t]*[^#\s]/m.test(text);
  tab.classList.toggle("empty",empty);
  if(empty)$("pyHint").style.top=(PAD+text.replace(/\s+$/,"").split("\n").length*(text.trim()?LH:0))+"px";
  tab.classList.toggle("ro",S.ro);
  tab.classList.toggle("bad",!!e&&!SOFT[e.key]);
  tab.classList.toggle("wait",!S.ro&&((!!S.err&&!(e&&!SOFT[e.key]))||!!S.tCheck));
  const tb=document.querySelector('#tabs button[data-tab="python"]');
  if(tb)tb.classList.toggle("warn",!!S.err&&!S.ro&&!SOFT[S.err.key]);
  say();
}
function mark(el,ln){
  if(ln){el.style.top=((ln-1)*LH)+"px";el.style.display="block";}
  else el.style.display="none";
}
/* bring a line into the window onto the code */
function reveal(ln){
  const top=(ln-1)*LH, cover=(sayEl.classList.contains("on")&&!sayEl.classList.contains("top"))?sayEl.offsetHeight+10:0;
  if(top<pane.scrollTop)pane.scrollTop=top;
  else if(top+LH+2*PAD+cover>pane.scrollTop+pane.clientHeight)pane.scrollTop=top+LH+2*PAD+cover-pane.clientHeight;
}
function caretLine(){return ta.value.slice(0,ta.selectionStart).split("\n").length;}
/* Sideways, the code stays hard against the left unless the caret is past
   the right edge. A browser scrolls a wide field a little whenever it is
   tapped, and one character of sideways scroll hides the first character
   of every line — which, in Python, is where the indentation is. */
let CW=0;
function revealX(){
  if(!CW){
    try{const g=document.createElement("canvas").getContext("2d");g.font=getComputedStyle(pre).font;CW=g.measureText("0000000000").width/10;}catch(_){}
    if(!CW)CW=10;
  }
  const v=ta.value, a=ta.selectionStart, x=4+(a-(v.lastIndexOf("\n",a-1)+1))*CW;
  const w=pane.clientWidth-gut.offsetWidth-14;
  if(x<w)pane.scrollLeft=0;
  else if(x-pane.scrollLeft>w)pane.scrollLeft=x-w+2*CW;
  else if(x<pane.scrollLeft+CW)pane.scrollLeft=Math.max(0,x-2*CW);
}

/* ---- what is wrong, and how to fix it ---- */
function say(){
  const e=shownErr();
  const sig=S.ro?"ro"+(he()?1:0):e?JSON.stringify([e.key,e.args,e.line,e.dict||"",he()]):"";
  if(sig!==S.saySig){
    S.saySig=sig;
    sayEl.textContent="";
    if(!sig){sayEl.className="";return;}
    const btn=document.createElement("button");btn.type="button";
    if(S.ro){
      btn.textContent="This program has a block that can't be typed yet. Change it in the Blocks tab.";
    }else{
      const ln=document.createElement("span");ln.className="ln";
      ln.textContent=(he()?"שורה ":"Line ")+e.line;
      btn.appendChild(ln);
      for(const p of pyErrParts(e)){
        if(p.c!==undefined){const c=document.createElement("code");c.textContent=p.c;btn.appendChild(c);}
        /* a sentence the Hebrew layer already knows goes in an element of
           its own, whole, so that layer can find it */
        else if(p.d!==undefined){const d=document.createElement("span");d.textContent=p.d;btn.appendChild(d);}
        else btn.appendChild(document.createTextNode(p.t));
      }
      btn.addEventListener("click",()=>goTo(e));
    }
    sayEl.appendChild(btn);
    sayEl.className="on"+((S.ro||SOFT[e.key])?" soft":"");
  }
  if(!e)return;
  /* at whichever edge leaves the line it is about in view */
  const y=(e.line-1)*LH+PAD-pane.scrollTop, h=sayEl.offsetHeight;
  sayEl.classList.toggle("top",y+LH>pane.clientHeight-h-12&&y>h+12);
}
function goTo(e){
  const lines=ta.value.split("\n");
  let at=0;
  for(let i=0;i<e.line-1&&i<lines.length;i++)at+=lines[i].length+1;
  const a=at+(e.col>=0?Math.min(e.col,(lines[e.line-1]||"").length):0);
  ta.setSelectionRange(a,Math.min(at+(lines[e.line-1]||"").length,a+Math.max(0,e.len)));
  reveal(e.line);
}

/* ---- the listing for whichever robot is being looked at ---- */
function pyShow(){
  const r=R(); if(!r)return;
  const canon=pyCanon(r);
  /* text that came back out of a save: still this program? */
  if(r.py&&r.py.base===null){
    const p=pyParse(r.py.text);
    r.py.base=(p.ok&&pyCanonOf(p)===canon)?canon:undefined;
  }
  if(!r.py||r.py.base!==canon)r.py={text:pyDoc(r),base:canon,gen:true};
  if(ta.value!==r.py.text||S.owner!==r){
    const same=S.owner===r;
    ta.value=r.py.text; S.owner=r; S.prev=r.py.text;
    S.hist=[]; S.hi=-1; snap(true);
    clearTimeout(S.tCheck); clearTimeout(S.tShow); S.tCheck=S.tShow=0;
    S.err=null; S.shown=false; S.parse=null; S.ro=false;
    if(!same)pane.scrollTop=pane.scrollLeft=0;
  }
  S.map=null;
  snips();
  if(visible()&&!S.busy)check(true); else paint();
}
window.pyShow=pyShow;

/* Read what is in the editor. If it is a program, and not the one the
   blocks hold, the blocks become it. */
function check(now){
  clearTimeout(S.tCheck); S.tCheck=0;
  const r=R();
  if(!r||!r.py||S.owner!==r||S.busy){paint();return;}
  S.busy=true;
  try{
    const canon=pyCanon(r), p=pyParse(ta.value);
    S.parse=p; S.map=null;
    const mine=p.ok?pyCanonOf(p):null;
    /* The game's own listing, unable to be read back as the program it was
       written from: something in there has no Python yet. Typing over it
       would lose that block, so this one is read-only. */
    S.ro=!!r.py.gen&&mine!==canon;
    ta.readOnly=S.ro;
    if(S.ro){S.err=null;S.shown=false;}
    else if(p.ok){
      S.err=null; S.shown=false; clearTimeout(S.tShow); S.tShow=0;
      if(mine!==canon)commit(r,p);
      else r.py.base=canon;
    }else{
      S.err=p.err;
      if(now||S.shown||SOFT[p.err.key]){S.shown=true;clearTimeout(S.tShow);S.tShow=0;}
      else if(!S.tShow)S.tShow=setTimeout(()=>{S.tShow=0;if(S.err){S.shown=true;paint();}},800);
    }
  }finally{S.busy=false;}
  paint();
}
function commit(r,p){
  const typed=!!S.typing;
  pushUndo();
  r.program=p.program;
  r.routines={};
  for(const id of ROUTINE_IDS)r.routines[id]={params:p.routines[id].params.slice(),body:p.routines[id].body};
  r.py.base=pyCanon(r); r.py.gen=false;
  selBlock=null; elseSel=null;
  programChanged();
  /* once, ever: say out loud that the two tabs are one program */
  if(typed&&!player.pyTyped&&progSize(r)>0){
    player.pyTyped=true;
    toast("🐍 You typed it — and its block is in 🧩 Blocks now. They are one program.");
  }
}

/* ---- typing ---- */
function snap(force){
  const st={v:ta.value,a:ta.selectionStart,b:ta.selectionEnd}, t=performance.now();
  const top=S.hist[S.hi];
  if(top&&top.v===st.v){top.a=st.a;top.b=st.b;return;}
  /* a run of keystrokes is one step back, not forty */
  if(!force&&top&&S.hi===S.hist.length-1&&S.hi>0&&t-S.lastSnap<600)S.hist[S.hi]=st;
  else{S.hist.length=S.hi+1;S.hist.push(st);if(S.hist.length>200)S.hist.shift();S.hi=S.hist.length-1;}
  S.lastSnap=force?0:t;
}
function unredo(d){
  const i=S.hi+d;
  if(i<0||i>=S.hist.length)return;
  S.hi=i;
  const st=S.hist[i];
  ta.value=st.v; ta.setSelectionRange(st.a,st.b);
  changed(false,true);
}
/* the text is different: note it, colour it, and read it once the typing pauses */
function changed(now,noSnap){
  const r=R(); if(!r||!r.py||S.owner!==r)return;
  r.py.text=ta.value; r.py.gen=false; S.prev=ta.value;
  if(!noSnap)snap(!!now);
  if(now)check(true);
  else{
    clearTimeout(S.tCheck);
    S.tCheck=setTimeout(()=>{S.typing=true;try{check(false);}finally{S.typing=false;}},220);
    paint();
  }
  histKeys();
}
ta.addEventListener("input",e=>{
  if(S.ro)return;
  let v=ta.value, a=ta.selectionStart;
  /* a phone curls quotes and hardens spaces by itself; Python wants neither */
  const fixed=v.replace(/[“”„]/g,'"').replace(/[‘’]/g,"'").replace(/ /g," ");
  if(fixed!==v){v=fixed;ta.value=v;ta.setSelectionRange(a,a);}
  const it=e&&e.inputType;
  const brk=it==="insertLineBreak"||it==="insertParagraph"||
    (v.length===S.prev.length+1&&v[a-1]==="\n"&&v.slice(0,a-1)+v.slice(a)===S.prev);
  if(brk&&v[a-1]==="\n"){
    /* Enter keeps the line's depth, and goes one deeper after a colon */
    const ls=v.lastIndexOf("\n",a-2)+1, was=v.slice(ls,a-1);
    let ind=/^ */.exec(was)[0];
    if(/:\s*(#.*)?$/.test(was)&&!/^\s*#/.test(was))ind+="    ";
    if(ind)ta.setRangeText(ind,a,a,"end");
  }else if(v[a-1]===":"&&v.length===S.prev.length+1){
    /* `else:` typed inside the if's own lines steps back out to stand under it */
    const ls=v.lastIndexOf("\n",a-1)+1, line=v.slice(ls,a), m=/^( +)(else|elif\b.*):$/.exec(line);
    if(m){
      const above=v.slice(0,ls).split("\n");
      for(let i=above.length-2;i>=0;i--){
        const l=above[i]; if(!l.trim()||/^\s*#/.test(l))continue;
        const d=/^ */.exec(l)[0].length;
        if(d>=m[1].length)continue;
        if(/^\s*(if|elif)\b/.test(l)){ta.setRangeText(l.slice(0,d),ls,ls+m[1].length,"end");
          const c=a-(m[1].length-d);ta.setSelectionRange(c,c);}
        break;
      }
    }
  }
  changed(false);
  reveal(caretLine()); revealX();
});
/* the caret was moved by a tap or an arrow key */
ta.addEventListener("click",revealX);
ta.addEventListener("keyup",e=>{if(/^(Arrow|Home|End|Page)/.test(e.key))revealX();});
ta.addEventListener("beforeinput",e=>{
  if(e.inputType==="historyUndo"){e.preventDefault();unredo(-1);}
  else if(e.inputType==="historyRedo"){e.preventDefault();unredo(1);}
});
ta.addEventListener("keydown",e=>{
  if(S.ro)return;
  const mod=e.metaKey||e.ctrlKey;
  if(e.key==="Tab"){e.preventDefault();shift(e.shiftKey?-1:1);}
  else if(mod&&(e.key==="z"||e.key==="Z")){e.preventDefault();unredo(e.shiftKey?1:-1);}
  else if(mod&&e.key==="y"){e.preventDefault();unredo(1);}
  else if(e.key==="Escape")ta.blur();
  else if(e.key==="Backspace"&&!mod&&!e.altKey&&ta.selectionStart===ta.selectionEnd){
    /* in the spaces at the front of a line, Backspace goes back a whole step */
    const v=ta.value, a=ta.selectionStart, ls=v.lastIndexOf("\n",a-1)+1, lead=v.slice(ls,a);
    if(lead.length&&/^ +$/.test(lead)){
      e.preventDefault();
      const n=lead.length%4||4;
      ta.setRangeText("",a-n,a,"end");
      changed(false);
    }
  }
});
/* push the caret's line (or every selected line) in a step, or pull it out */
function shift(dir){
  const v=ta.value, a=ta.selectionStart, b=ta.selectionEnd;
  const ls=v.lastIndexOf("\n",a-1)+1;
  let le=v.indexOf("\n",Math.max(a,b-(b>a&&v[b-1]==="\n"?1:0))); if(le<0)le=v.length;
  const lines=v.slice(ls,le).split("\n");
  let da=0, db=0;
  const out=lines.map((l,i)=>{
    let d;
    if(dir>0){d=4;l="    "+l;}
    else{d=-Math.min(4,/^ */.exec(l)[0].length);l=l.slice(-d);}
    if(i===0)da=d; db+=d;
    return l;
  });
  ta.setRangeText(out.join("\n"),ls,le,"preserve");
  ta.setSelectionRange(Math.max(ls,a+da),Math.max(ls,b+db));
  changed(true);
}
/* put text where the caret is; `back` leaves the caret that far inside it */
function put(str,back){
  ta.setRangeText(str,ta.selectionStart,ta.selectionEnd,"end");
  if(back){const c=ta.selectionStart-back;ta.setSelectionRange(c,c);}
  changed(false);
}

/* ---- the keys a phone hides ---- */
const SVG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">';
const IC={
  inn:SVG+'<path d="M4 5v14M9 12h11M15 7l5 5-5 5"/></svg>',
  out:SVG+'<path d="M20 5v14M15 12H4M9 7l-5 5 5 5"/></svg>',
  undo:SVG+'<path d="M8 5L3.5 9.5 8 14"/><path d="M3.5 9.5H14a6 6 0 0 1 0 12h-3"/></svg>',
  redo:SVG+'<path d="M16 5l4.5 4.5L16 14"/><path d="M20.5 9.5H10a6 6 0 0 0 0 12h3"/></svg>'};
const KEYS=[[".","Dot","."],["()","Brackets","( )"],[":","Colon",":"],['""',"Quotes",'" "'],
  ["=","Equals","="],["_","Underscore","_"],["#","Note","#"],
  ["undo","Undo typing",IC.undo],["redo","Redo typing",IC.redo]];
keysEl.innerHTML=KEYS.map(k=>'<button type="button" data-k="'+ESC(k[0]).replace(/"/g,"&quot;")+
  '" aria-label="'+k[1]+'">'+k[2]+'</button>').join("");
function histKeys(){
  const u=keysEl.querySelector('[data-k="undo"]'), r=keysEl.querySelector('[data-k="redo"]');
  if(u)u.disabled=S.hi<=0;
  if(r)r.disabled=S.hi>=S.hist.length-1;
}
/* A tap on one of these must not take the caret out of the code: the press
   is stopped from moving focus, and the tap does the work. (Not on the
   press — both rows scroll sideways, and a scroll begins with a press.) */
function bar(el,act){
  el.addEventListener("pointerdown",e=>{
    if(!e.target.closest("button"))return;
    S.hadFocus=document.activeElement===ta;
    e.preventDefault();
  });
  el.addEventListener("click",e=>{
    const b=e.target.closest("button"); if(!b||b.disabled||S.ro)return;
    act(b);
    if(S.hadFocus&&document.activeElement!==ta)ta.focus({preventScroll:true});
  });
}
bar(keysEl,b=>{
  const k=b.dataset.k;
  if(k==="undo")unredo(-1);
  else if(k==="redo")unredo(1);
  else if(k==="()"||k==='""')put(k,1);
  else put(k,0);
});

/* ---- the palette, as lines of code ---- */
/* what a chip says — the Python word for its block, short enough for a chip */
function chipWord(t){
  if(PY_ACT[t])return PY_ACT[t].length>16?PY_ACT[t].slice(0,8)+"…()":PY_ACT[t]+"()";
  return {rest:"rest(2)",wait:"wait(1)",build:"build()",tryCode:"try_code(1)",faceNearest:"face_nearest()",
    goNear:"walk_to()",broadcast:"tell()",goTo:"go_to()",say:"say()",repeat:"for range(3)",
    countLoop:"for range(1, 6)",forever:"while True",whileLoop:"while","if":"if",setVar:"x = 5",
    changeVar:"x = x + 1",read:"x = read()",call:"routine_a()",ret:"return"}[t]||t;
}
/* the line a chip writes: the block's own Python, as a new block would have it */
function chipLine(t){
  const X=pyCtx(), b=newBlock(t);
  if(typeof b.cond==="string"&&!X.conds.has(condBase(b.cond))&&X.conds.size)b.cond=[...X.conds][0];
  if(t==="call"){const d=defsIn(ta.value);b.fn=d.A||!d.B?"A":"B";}
  return toPy([b],"").split("\n")[0];
}
function defsIn(text){
  const d={};
  text.replace(/^def\s+routine_([ab])\b/gmi,(m,x)=>{d[x.toUpperCase()]=1;});
  return d;
}
function snipTypes(){
  if(pyOnBoard()){
    /* a board's own blocks, in the order its palette groups them */
    const allow=(mgState.proj.allowed||CHALLENGE_BLOCKS).filter(t=>DEFS[t]), by={}, order=[];
    for(const t of allow){const c=DEFS[t].cat;if(!by[c]){by[c]=[];order.push(c);}by[c].push(t);}
    return [].concat.apply([],order.map(c=>by[c]));
  }
  const out=[];
  for(const c of CATS)if(!c.lock||unlocks[c.lock])for(const t of c.types)out.push(t);
  return out;
}
function snips(){
  const types=snipTypes(), sig=types.join(",")+"|"+(he()?1:0);
  if(sig===S.snipSig)return;
  S.snipSig=sig;
  let h='<button type="button" class="pysk" data-s="out" aria-label="Pull the line out">'+IC.out+'</button>'+
        '<button type="button" class="pysk" data-s="in" aria-label="Push the line in">'+IC.inn+'</button>';
  for(const t of types){
    const d=DEFS[t];
    /* the block's name is what a screen reader says; the code is what is shown */
    h+='<button type="button" class="pblk c-'+d.cat+'" data-s="'+t+'" aria-label="'+ESC(d.lbl)+'">'+
      d.ic+'<code>'+ESC(chipWord(t))+'</code></button>';
    if(t==="call")h+='<button type="button" class="pblk c-funcs" data-s="def" aria-label="New function">'+
      d.ic+'<code>def</code></button>';
  }
  snipsEl.innerHTML=h;
}
bar(snipsEl,b=>{
  const s=b.dataset.s;
  if(s==="in")shift(1);
  else if(s==="out")shift(-1);
  else if(s==="def")addDef();
  else addLine(chipLine(s));
  if(typeof sfx==="function")sfx(440,.04);
});
/* A chip's line goes after the line the caret is on — one step deeper if
   that line opens a loop — or onto the caret's line if it is empty. */
function addLine(code){
  const v=ta.value, pos=ta.selectionStart;
  const ls=v.lastIndexOf("\n",pos-1)+1; let le=v.indexOf("\n",pos); if(le<0)le=v.length;
  const line=v.slice(ls,le), ind=/^ */.exec(line)[0];
  let at;
  if(!line.trim()){ta.setRangeText(ind+code,ls,le,"end");at=ls;}
  else{
    const deeper=/:\s*(#.*)?$/.test(line)&&!/^\s*#/.test(line);
    ta.setRangeText("\n"+ind+(deeper?"    ":"")+code,le,le,"end");at=le+1;
  }
  landed(at);
}
/* a new function goes above the main program, under the notes at the top */
function addDef(){
  const d=defsIn(ta.value), id=!d.A?"a":!d.B?"b":null;
  if(!id)return;
  const lines=ta.value.split("\n");
  let i=0, at=0;
  while(i<lines.length&&/^\s*(#.*)?$/.test(lines[i])&&lines[i].trim()){at+=lines[i].length+1;i++;}
  at=Math.min(at,ta.value.length);
  const head="def routine_"+id+"():";
  ta.setRangeText((at>ta.value.length-1&&ta.value.length&&!/\n$/.test(ta.value)?"\n":"")+head+"\n\n",at,at,"end");
  const s=ta.value.indexOf(head,Math.max(0,at-1));
  ta.setSelectionRange(s+head.length,s+head.length);
  landed(s);
}
function landed(at){
  const ln=ta.value.slice(0,at).split("\n").length;
  changed(true);
  reveal(ln); revealX();
  /* show where it went: the same job the new block's pop does in Blocks */
  mNew.style.top=((ln-1)*LH)+"px";
  mNew.classList.remove("go"); void mNew.offsetWidth; mNew.classList.add("go");
}

/* ---- the line the robot is on ---- */
function runMark(){
  mark(mRun,S.run);
  const was=gut.querySelector(".run");
  if(was)was.classList.remove("run");
  if(S.run&&gut.children[S.run-1])gut.children[S.run-1].classList.add("run");
}
setInterval(()=>{
  if(!visible())return;
  const r=R(); let ln=0;
  if(r&&S.owner===r&&r.curUid!=null&&(r.running||(typeof mgState!=="undefined"&&mgState&&mgState.running))){
    /* worked out once for a text, and `false` when the text and the
       blocks do not match — there is no line to point at then */
    if(S.map===null)S.map=(S.parse&&S.parse.ok&&r.py&&r.py.base===pyCanon(r))?pyLineMap(S.parse,r):false;
    ln=(S.map&&S.map.get(r.curUid))||0;
  }
  if(ln===S.run)return;
  S.run=ln; runMark();
  if(ln&&document.activeElement!==ta)reveal(ln);
},150);

/* ---- the keyboard ----
   A phone keyboard covers the bottom of the screen without making the page
   any shorter, so a sheet pinned to the bottom ends up underneath it.
   visualViewport is the part of the page still in sight: what is missing
   from the bottom of it is the keyboard. */
function kbSet(kb,vh){
  kb=kb>120?Math.round(kb):0;       // a toolbar sliding away is not a keyboard
  if(kb===S.kb)return;
  S.kb=kb;
  ed.style.setProperty("--kb",kb+"px");
  ed.style.setProperty("--kbv",Math.round(vh)+"px");
  ed.classList.toggle("kb",kb>0);
  if(kb&&(scrollX||scrollY))scrollTo(0,0);
  requestAnimationFrame(()=>{reveal(caretLine());say();});
}
function kbSync(){
  if(S.fake)return;                 // a test is holding a keyboard up by hand
  const vv=window.visualViewport;
  if(!vv||document.activeElement!==ta){kbSet(0,innerHeight);return;}
  kbSet(innerHeight-vv.height-vv.offsetTop,vv.height);
}
if(window.visualViewport){
  visualViewport.addEventListener("resize",kbSync);
  visualViewport.addEventListener("scroll",kbSync);
}
/* the sheet stands on the keyboard now, so the page itself must not also
   scroll to "reveal" the field — that pushes the code off the top */
addEventListener("scroll",()=>{if(S.kb&&document.activeElement===ta&&(scrollX||scrollY))scrollTo(0,0);},{passive:true});
ta.addEventListener("focus",()=>{ed.classList.add("typing");histKeys();kbSync();setTimeout(kbSync,350);
  revealX();requestAnimationFrame(revealX);});
ta.addEventListener("blur",()=>{
  ed.classList.remove("typing");
  kbSync();
  /* stopped typing: read it now, and say what is wrong if anything is */
  if(S.owner===R()&&(S.tCheck||(S.err&&!S.shown)))check(true);
});
/* leaving the tab, or the editor, puts the keyboard away */
document.querySelectorAll("#tabs button").forEach(b=>b.addEventListener("click",()=>{
  if(b.dataset.tab!=="python"&&document.activeElement===ta)ta.blur();}));
new MutationObserver(()=>{if(!ed.classList.contains("open")&&document.activeElement===ta)ta.blur();})
  .observe(ed,{attributes:true,attributeFilter:["class"]});
/* the message sits at whichever edge is clear of its line, and which edge
   that is changes when the code scrolls or the sheet changes size */
pane.addEventListener("scroll",()=>{if(shownErr())say();},{passive:true});
try{new ResizeObserver(()=>{if(shownErr())say();}).observe(pane);}catch(_){}

/* ---- Run ----
   Asked by ▶, ⏭ and the world's own ▶ before they start anything. With the
   code (or the board it runs on) in front of the player, a mistake in what
   they typed is answered — not skipped past to run the older blocks, which
   would look exactly like "my change did nothing". On the Blocks tab the
   blocks are what is on screen, and they run. */
window.pyHold=function(){
  const r=R();
  if(!r||!r.py||!ed.classList.contains("open")||$("blocksTab").style.display!=="none")return false;
  if(S.owner!==r||r.py.base!==pyCanon(r))return false;
  if(S.tCheck)check(true);                       // a line typed a moment ago still counts
  const p=pyParse(ta.value);
  if(p.ok)return false;
  if(typeof setTab==="function")setTab("python");
  S.err=p.err; S.shown=true;
  paint(); goTo(p.err);
  if(typeof sfx==="function")sfx(200,.08);
  if(typeof ccFeel==="function")ccFeel("error");
  return true;
};

/* ---- what was typed is kept ----
   A listing written by the game can always be written again, so only text
   the player has touched is worth saving: their spacing and their notes.
   It comes back as `base:null` — "check me" — and pyShow keeps it only if
   it still reads as the very program the blocks hold. */
window.pyKept=function(r){
  return (r&&r.py&&!r.py.gen&&typeof r.py.text==="string"&&r.py.text.length<=6000)?r.py.text:undefined;
};
window.pyRestore=function(r,text){
  if(r&&typeof text==="string"&&text.length<=6000)r.py={text,base:null,gen:false};
};
/* a level's text lives beside its program, under the same id */
window.pyStash=function(id,r){
  if(!player.projPy)player.projPy={};
  const t=pyKept(r);
  if(t===undefined)delete player.projPy[id]; else player.projPy[id]=t;
};
window.pyUnstash=function(id,r){
  if(player.projPy&&typeof player.projPy[id]==="string")pyRestore(r,player.projPy[id]);
};

/* for test/python.js, and nothing else */
window.CC_PY={state:S,check,kb(k,vh){S.fake=k>0;kbSet(k,vh);},snips:()=>{S.snipSig="";snips();},
  type(text){ta.value=text;ta.setSelectionRange(text.length,text.length);changed(true);}};
})();
