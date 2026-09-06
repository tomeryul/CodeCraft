"use strict";
/* =====================================================================
   The piece, written out as HTML and CSS — and editable there
   ---------------------------------------------------------------------
   CodeCraft already makes one promise like this: you drag blocks, and the
   Python tab shows the same program in the language real engineers use.
   Reading it is the lesson; the blocks are how you write it.

   A piece built out of boxes goes further, because a box IS a <div> with a
   CSS rule. It has the whole box model — content, padding, border, margin —
   it can hold other boxes, and it can lay those out in a row or a column
   with justify-content and align-items. So the code is not a picture of the
   piece, it is the piece; and every value in it is real enough to tap.

   Two ideas this exists to teach, and both of them are things you cannot
   see by dragging:

   1. A class is shared. Boxes in one group share a rule — one look, many
      elements — which is a component, spelled the way CSS spells it.
   2. A container places its children. Switch a box from `free` to a row
      and its children's `left` and `top` DISAPPEAR from the stylesheet,
      because the layout is placing them now. `center` becomes a word
      instead of a sum, which is the difference between guessing at 37% and
      knowing how the web is laid out.

   Every editable token carries where it writes back to:
     data-k  which field   x y w h r a c pad mg bw bc gap lay jus ali name
     data-i  a part, by index    for the values an element owns
     data-g  a group, by class id, or "root" for the piece itself
   ===================================================================== */
(function(){

/* what to call a box, from the corner radius that shapes it */
function shapeWord(r){ return r>=50?"dot":r>=40?"pill":r>=10?"tile":"box"; }

/* Class names are descriptive because that is what class names are for:
   "gold-pill", not "part3". The colour names are the same ones the palette
   announces, so the swatch a child tapped is the word in the stylesheet —
   until they rename it, which they can, because it is their stylesheet. */
const OKNAME=/^[a-z][a-z0-9-]{0,15}$/;
function cleanName(s){
  const n=String(s==null?"":s).toLowerCase().replace(/[^a-z0-9-]/g,"").slice(0,16);
  return OKNAME.test(n)?n:"";
}
function classNames(parts){
  const first={}, order=[], used={}, out={};
  for(const p of parts)if(!(p.cls in first)){first[p.cls]=p;order.push(p.cls);}
  for(const cls of order){
    const p=first[cls];
    const own=cleanName(p.cn);
    const base=own||((CC_WEAR.names[p.c]||"part")+"-"+shapeWord(p.r)).toLowerCase();
    let n=base, i=2;
    while(used[n])n=base+"-"+(i++);
    used[n]=1; out[cls]=n;
  }
  return out;
}

/* who holds whom. Parents come first in the array, so one pass is enough,
   and a pin that names nothing seen yet is simply not a pin. */
function tree(parts){
  const seen=new Set(), kids=new Map(), parent=new Array(parts.length);
  kids.set("",[]);
  parts.forEach((p,i)=>{
    const key=(p.pin!=null&&seen.has(p.pin))?p.pin:"";
    if(!kids.has(key))kids.set(key,[]);
    kids.get(key).push(i);
    parent[i]=(key==="")?null:key;
    if(p.pid!=null)seen.add(p.pid);
  });
  return {kids,parent};
}
/* every box in one component, and everything nested inside them: what is
   inside a component belongs to it */
function subtree(parts,cls){
  const {kids}=tree(parts), keep=new Set();
  const walk=i=>{ keep.add(i); const k=kids.get(parts[i].pid); if(k)for(const j of k)walk(j); };
  parts.forEach((p,i)=>{ if(p.cls===cls)walk(i); });
  return keep;
}

const ESC=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const C={com:"#8a7fb8",tag:"#ff9d6b",attr:"#5ab8ff",str:"#8ff0a0",
         sel:"#b184ff",prop:"#5ab8ff",num:"#ffd66b",kw:"#8ff0a0"};

/* One walk over the piece writes the plain source and the marked-up source
   together, so the two can never drift — the text a player copies out is
   character for character the text they have been tapping. */
function build(piece,slot,live,only){
  const parts=(piece&&piece.parts)||[];
  const root=(piece&&piece.root)||{};
  const rootName=slot||(piece&&piece.slot)||"outfit";
  let plain="", html="";
  const raw=s=>{plain+=s;html+=ESC(s);};
  const tok=(c,s)=>{plain+=s;html+='<span style="color:'+c+'">'+ESC(s)+'</span>';};
  const attrs=m=>' data-k="'+m.k+'"'+(m.i!=null?' data-i="'+m.i+'"':'')+
                 (m.g!=null?' data-g="'+m.g+'"':'');
  const val=(c,s,m,cls)=>{
    plain+=s;
    html+=live
      ?'<button type="button" class="val'+(cls?" "+cls:"")+'"'+attrs(m)+' style="color:'+c+'">'+ESC(s)+'</button>'
      :'<span style="color:'+c+'">'+ESC(s)+'</span>';
  };
  const hexVal=(s,m)=>{
    plain+=s;
    const chip='<span class="hexsw" style="background:'+s+'"></span>';
    html+=live
      ?'<button type="button" class="val col"'+attrs(m)+' style="color:'+C.str+'">'+chip+ESC(s)+'</button>'
      :chip+'<span style="color:'+C.str+'">'+ESC(s)+'</span>';
  };
  const F=(o,k)=>CC_WEAR.field(o,k);

  const names=classNames(parts), count={};
  for(const p of parts)count[p.cls]=(count[p.cls]||0)+1;
  const {kids,parent}=tree(parts);
  const keep=(only==null)?null:subtree(parts,only);
  const mine=i=>keep===null||keep.has(i);
  /* the container a box sits in: its parent's part, or the piece itself */
  const holder=i=>{
    const pin=parent[i];
    if(pin==null)return root;
    for(const q of parts)if(q.pid===pin)return q;
    return root;
  };
  const flows=o=>(CC_WEAR.lay[F(o,"lay")]||"free")!=="free";

  if(only!=null){
    const n=count[only]||0;
    tok(C.com,"<!-- ."+names[only]+" — "+(n===1?"one box":n+" boxes share this")+" -->");
  }else tok(C.com,"<!-- "+((piece&&piece.name)||"my piece")+" -->");
  raw("\n");
  if(!parts.length){
    tok(C.tag,"<div");raw(" ");tok(C.attr,"class");raw("=");tok(C.str,'"'+rootName+'"');tok(C.tag,">");
    raw("\n");tok(C.tag,"</div>");raw("\n");
    return {plain,html};
  }

  /* ---- the elements, nested the way the boxes are ---- */
  const elem=(i,ind)=>{
    if(!mine(i))return;
    const p=parts[i], inFlow=flows(holder(i));
    raw(ind);tok(C.tag,"<div");raw(" ");tok(C.attr,"class");raw("=");
    tok(C.str,'"'+names[p.cls]+'"');
    /* the component case: the look is in the rule, the place is here — but
       only while the container is placing nothing itself */
    if(count[p.cls]>1&&!inFlow){
      raw(" ");tok(C.attr,"style");raw('="');
      tok(C.prop,"left");raw(": ");val(C.num,p.x+"%",{k:"x",i:i});raw("; ");
      tok(C.prop,"top");raw(": ");val(C.num,p.y+"%",{k:"y",i:i});raw('"');
    }
    tok(C.tag,">");
    const k=(kids.get(p.pid)||[]).filter(mine);
    if(!k.length){ tok(C.tag,"</div>");raw("\n"); return; }
    raw("\n");
    for(const j of k)elem(j,ind+"  ");
    raw(ind);tok(C.tag,"</div>");raw("\n");
  };
  const tops=(only==null)
    ?(kids.get("")||[])
    :parts.map((p,i)=>i).filter(i=>mine(i)&&(parent[i]==null||!mine(parts.findIndex(q=>q.pid===parent[i]))));
  if(only==null){
    tok(C.tag,"<div");raw(" ");tok(C.attr,"class");raw("=");tok(C.str,'"'+rootName+'"');tok(C.tag,">");raw("\n");
    for(const i of tops)elem(i,"  ");
    tok(C.tag,"</div>");raw("\n");
  }else{
    for(const i of tops)elem(i,"");
  }
  raw("\n");

  /* ---- the stylesheet ---- */
  /* `display` is written even when it is the default, because that word is
     the switch: block means every child says where it goes, flex means this
     box says. Tapping it is how a child finds flexbox at all. */
  const layDecl=(o,g)=>{
    const flow=flows(o);
    raw("  ");tok(C.prop,"display");raw(": ");
    val(C.kw,flow?"flex":"block",{k:"lay",g:g},"kw");raw(";\n");
    if(!flow)return;
    raw("  ");tok(C.prop,"flex-direction");raw(": ");
    val(C.kw,CC_WEAR.lay[F(o,"lay")]==="row"?"row":"column",{k:"lay",g:g},"kw");raw(";\n");
    raw("  ");tok(C.prop,"justify-content");raw(": ");
    val(C.kw,CC_WEAR.jus[F(o,"jus")],{k:"jus",g:g},"kw");raw(";\n");
    raw("  ");tok(C.prop,"align-items");raw(": ");
    val(C.kw,CC_WEAR.ali[F(o,"ali")],{k:"ali",g:g},"kw");raw(";\n");
    raw("  ");tok(C.prop,"gap");raw(": ");val(C.num,F(o,"gap")+"px",{k:"gap",g:g});raw(";\n");
  };

  tok(C.tag,"<style>");raw("\n");
  if(only==null){
    tok(C.sel,"."+rootName);raw(" {\n");
    raw("  ");tok(C.prop,"position");raw(": ");tok(C.kw,"relative");raw(";\n");
    /* a concrete 100px, so that a percentage and a pixel are the same
       number everywhere below and nothing has to be converted */
    raw("  ");tok(C.prop,"width");raw(": ");tok(C.num,"100px");raw(";\n");
    raw("  ");tok(C.prop,"height");raw(": ");tok(C.num,"100px");raw(";\n");
    raw("  ");tok(C.prop,"padding");raw(": ");val(C.num,F(root,"pad")+"px",{k:"pad",g:"root"});raw(";\n");
    /* the box a child's percentages are measured against — say so, because
       "why is 100% not the whole thing" is the next question padding asks */
    raw("  ");tok(C.prop,"box-sizing");raw(": ");tok(C.kw,"border-box");raw(";\n");
    layDecl(root,"root");
    raw("}\n");
  }
  const done={};
  let firstRule=only!=null;
  parts.forEach((p,i)=>{
    if(!mine(i)||done[p.cls])return; done[p.cls]=1;
    const shared=count[p.cls]>1, inFlow=flows(holder(i));
    if(firstRule)firstRule=false; else raw("\n");
    val(C.sel,"."+names[p.cls],{k:"name",g:p.cls},"sel");raw(" {\n");
    if(!inFlow){
      raw("  ");tok(C.prop,"position");raw(": ");tok(C.kw,"absolute");raw(";\n");
      if(!shared){
        raw("  ");tok(C.prop,"left");raw(": ");val(C.num,p.x+"%",{k:"x",i:i});raw(";\n");
        raw("  ");tok(C.prop,"top");raw(": ");val(C.num,p.y+"%",{k:"y",i:i});raw(";\n");
      }
    }
    raw("  ");tok(C.prop,"width");raw(": ");val(C.num,p.w+"%",{k:"w",g:p.cls});raw(";\n");
    raw("  ");tok(C.prop,"height");raw(": ");val(C.num,p.h+"%",{k:"h",g:p.cls});raw(";\n");
    raw("  ");tok(C.prop,"margin");raw(": ");val(C.num,F(p,"mg")+"px",{k:"mg",g:p.cls});raw(";\n");
    raw("  ");tok(C.prop,"padding");raw(": ");val(C.num,F(p,"pad")+"px",{k:"pad",g:p.cls});raw(";\n");
    raw("  ");tok(C.prop,"border");raw(": ");val(C.num,F(p,"bw")+"px",{k:"bw",g:p.cls});
    raw(" ");tok(C.kw,"solid");raw(" ");hexVal(CC_WEAR.pal[F(p,"bc")]||CC_WEAR.pal[15],{k:"bc",g:p.cls});raw(";\n");
    raw("  ");tok(C.prop,"border-radius");raw(": ");val(C.num,p.r+"%",{k:"r",g:p.cls});raw(";\n");
    /* translate first, then rotate: the box is moved by a share of its own
       size and then turned about its own middle, which is what the canvas
       does too. translate(0px, 0px) is a real no-op, and writing it is what
       gives a child something to tap to find the other one. */
    raw("  ");tok(C.prop,"transform");raw(": translate(");
    val(C.kw,inFlow?"0px, 0px":(F(p,"org")===1?"-50%, -50%":"0px, 0px"),{k:"org",g:p.cls},"kw");
    raw(") rotate(");val(C.num,(p.a|0)+"deg",{k:"a",g:p.cls});raw(");\n");
    raw("  ");tok(C.prop,"background");raw(": ");hexVal(CC_WEAR.pal[p.c]||CC_WEAR.pal[0],{k:"c",g:p.cls});raw(";\n");
    if((kids.get(p.pid)||[]).length)layDecl(p,p.cls);
    raw("}\n");
  });
  tok(C.tag,"</style>");raw("\n");
  return {plain,html};
}

const wearCode=(piece,slot,only)=>build(piece,slot,false,only).plain;
const wearCodeHtml=(piece,slot,only)=>build(piece,slot,true,only).html;

/* what each field may hold, and how far one tap moves it. The ranges are
   the ones the canvas drag itself produces, so the two ways of editing can
   never disagree about what a legal box is. */
/* Every one of them carries a sentence, because a value you can change and
   cannot name is a slider, not a lesson. The sentence appears the moment a
   token is tapped — the only moment a child is actually asking. */
const FIELD={
  x:{lo:-40,hi:140,step:1,big:10,unit:"%",prop:"left",
     tip:"How far in from the left edge of the box it lives in."},
  y:{lo:-40,hi:140,step:1,big:10,unit:"%",prop:"top",
     tip:"How far down from the top of the box it lives in."},
  w:{lo:1,  hi:160,step:1,big:10,unit:"%",prop:"width",
     tip:"How wide it is — a share of the box it lives in, not of the screen."},
  h:{lo:1,  hi:160,step:1,big:10,unit:"%",prop:"height",
     tip:"How tall it is, as a share of the box it lives in."},
  r:{lo:0,  hi:50, step:1,big:5, unit:"%",prop:"border-radius",
     tip:"How round the corners are. At 50% the box becomes a circle."},
  a:{lo:-180,hi:180,step:1,big:15,unit:"deg",prop:"rotate",
     tip:"How far it is turned, in degrees, about its own middle."},
  pad:{lo:0,hi:40, step:1,big:5, unit:"px",prop:"padding",
     tip:"Space INSIDE, between its border and whatever it is holding."},
  mg:{lo:0, hi:40, step:1,big:5, unit:"px",prop:"margin",
     tip:"Space OUTSIDE, pushing its neighbours away from it."},
  bw:{lo:0, hi:20, step:1,big:5, unit:"px",prop:"border",
     tip:"How thick the ring around it is, between the padding and the margin."},
  gap:{lo:0,hi:40, step:1,big:5, unit:"px",prop:"gap",
     tip:"Space it leaves between the boxes it is holding."}
};
/* the three that are words rather than numbers. A keyword has options, not
   a range, so tapping one offers the words themselves. */
const KEYW={
  lay:{prop:"display",opts:()=>["block","row","column"],
       label:v=>v===0?"block":(v===1?"row":"column"),
       tip:"block lets every box inside say where it goes. flex places them itself, in a row or a column."},
  jus:{prop:"justify-content",opts:()=>CC_WEAR.jus.slice(),label:v=>CC_WEAR.jus[v],
       tip:"Where the boxes sit ALONG the line: at the start, in the middle, at the end, or spread out."},
  ali:{prop:"align-items",opts:()=>CC_WEAR.ali.slice(),label:v=>CC_WEAR.ali[v],
       tip:"Where the boxes sit ACROSS the line — up against one side, or centred."},
  org:{prop:"translate",opts:()=>["0px, 0px","-50%, -50%"],
       label:v=>v===1?"-50%, -50%":"0px, 0px",
       tip:"Moves the box by a share of its OWN size. At -50% its left and top name its middle instead of its corner."}
};
/* the two colours are neither a range nor a word list, so they get their
   sentence here rather than in a table of steppers */
const COLTIP={c:"The colour it is filled with.",
              bc:"The colour of the ring around it."};

window.CC_CODE={code:wearCode,html:wearCodeHtml,classNames:classNames,
  shapeWord:shapeWord,cleanName:cleanName,field:FIELD,keyword:KEYW,
  colTip:COLTIP,tree:tree};
})();
