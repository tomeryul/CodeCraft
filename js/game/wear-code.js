"use strict";
/* =====================================================================
   The piece, written out as HTML and CSS — and editable there
   ---------------------------------------------------------------------
   CodeCraft already makes one promise like this: you drag blocks, and the
   Python tab shows the same program in the language real engineers use.
   Reading it is the lesson; the blocks are how you write it.

   A piece built out of parts goes one step further, because a box IS a
   <div> with a CSS rule — a position, a size, a corner radius, an angle
   and a colour, all percentages of the slot it lives in. So the code is
   not a picture of the piece, it is the piece; and since every one of
   those numbers is a real number in a real declaration, every one of them
   can be tapped and nudged. Dragging is how you rough it out. The code is
   where you say exactly 42%.

   The one idea this exists to teach is in the two-or-more case. Parts in
   the same group share a class: one rule for how they look, and a `style`
   of their own for where they stand. That is a component, spelled the way
   CSS spells it, and a child who sees one rule light up two divs has met
   the idea before they have met the word.

   Every editable token carries where it writes back to:
     data-k  which field            x y w h r a c  (or "name")
     data-i  a part, by index       for the two values an element owns
     data-g  a group, by class id   for the five the shared rule owns
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

const ESC=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const C={com:"#8a7fb8",tag:"#ff9d6b",attr:"#5ab8ff",str:"#8ff0a0",
         sel:"#b184ff",prop:"#5ab8ff",num:"#ffd66b",plain:"#dfe3ec"};

/* One walk over the piece writes the plain source and the marked-up source
   together, so the two can never drift — the text a player copies out is
   character for character the text they have been tapping. */
/* `only` narrows the whole thing to one component: the elements that use
   that class and the one rule that paints them, and nothing else. It is the
   same walk and the same tokens — a component screen is not a second
   renderer, it is this one with a filter. */
function build(piece,slot,live,only){
  const parts=(piece&&piece.parts)||[];
  const root=slot||(piece&&piece.slot)||"outfit";
  let plain="", html="";
  const raw=s=>{plain+=s;html+=ESC(s);};
  const tok=(c,s)=>{plain+=s;html+='<span style="color:'+c+'">'+ESC(s)+'</span>';};
  const attrs=m=>' data-k="'+m.k+'"'+(m.i!=null?' data-i="'+m.i+'"':'')+
                 (m.g!=null?' data-g="'+m.g+'"':'');
  const val=(c,s,m)=>{
    plain+=s;
    if(!live){ tokHtmlOnly(c,s); return; }
    html+='<button type="button" class="val"'+attrs(m)+' style="color:'+c+'">'+ESC(s)+'</button>';
  };
  const tokHtmlOnly=(c,s)=>{ html+='<span style="color:'+c+'">'+ESC(s)+'</span>'; };
  const hexVal=(s,m)=>{
    plain+=s;
    const chip='<span class="hexsw" style="background:'+s+'"></span>';
    html+=live
      ?'<button type="button" class="val col"'+attrs(m)+' style="color:'+C.str+'">'+chip+ESC(s)+'</button>'
      :chip+'<span style="color:'+C.str+'">'+ESC(s)+'</span>';
  };

  const names=classNames(parts), count={};
  for(const p of parts)count[p.cls]=(count[p.cls]||0)+1;
  const mine=p=>only==null||p.cls===only;

  if(only!=null){
    const n=count[only]||0;
    tok(C.com,"<!-- ."+names[only]+" — "+(n===1?"one box":n+" boxes share this")+" -->");
  }else tok(C.com,"<!-- "+((piece&&piece.name)||"my piece")+" -->");
  raw("\n");
  if(!parts.length){
    tok(C.tag,"<div");raw(" ");tok(C.attr,"class");raw("=");tok(C.str,'"'+root+'"');tok(C.tag,">");
    raw("\n");tok(C.tag,"</div>");raw("\n");
    return {plain,html};
  }

  /* ---- the elements ---- */
  const ind=only==null?"  ":"";
  if(only==null){
    tok(C.tag,"<div");raw(" ");tok(C.attr,"class");raw("=");tok(C.str,'"'+root+'"');tok(C.tag,">");raw("\n");
  }
  parts.forEach((p,i)=>{
    if(!mine(p))return;
    raw(ind);tok(C.tag,"<div");raw(" ");tok(C.attr,"class");raw("=");
    tok(C.str,'"'+names[p.cls]+'"');
    if(count[p.cls]>1){
      /* the component case: the look is in the rule, the place is here */
      raw(" ");tok(C.attr,"style");raw('="');
      tok(C.prop,"left");raw(": ");val(C.num,p.x+"%",{k:"x",i:i});raw("; ");
      tok(C.prop,"top");raw(": ");val(C.num,p.y+"%",{k:"y",i:i});raw('"');
    }
    tok(C.tag,">");tok(C.tag,"</div>");raw("\n");
  });
  if(only==null){tok(C.tag,"</div>");raw("\n");}
  raw("\n");

  /* ---- the stylesheet ---- */
  tok(C.tag,"<style>");raw("\n");
  if(only==null){
    tok(C.sel,"."+root);raw(" {\n  ");
    tok(C.prop,"position");raw(": relative;\n  ");
    tok(C.prop,"width");raw(": 100%;\n  ");
    tok(C.prop,"height");raw(": 100%;\n}\n");
  }
  const done={};
  let firstRule=only!=null;   /* no root rule above it to be spaced away from */
  parts.forEach((p,i)=>{
    if(!mine(p)||done[p.cls])return; done[p.cls]=1;
    const shared=count[p.cls]>1;
    if(firstRule)firstRule=false; else raw("\n");
    val(C.sel,"."+names[p.cls],{k:"name",g:p.cls});raw(" {\n  ");
    tok(C.prop,"position");raw(": absolute;\n  ");
    if(!shared){
      tok(C.prop,"left");raw(": ");val(C.num,p.x+"%",{k:"x",i:i});raw(";\n  ");
      tok(C.prop,"top");raw(": ");val(C.num,p.y+"%",{k:"y",i:i});raw(";\n  ");
    }
    tok(C.prop,"width");raw(": ");val(C.num,p.w+"%",{k:"w",g:p.cls});raw(";\n  ");
    tok(C.prop,"height");raw(": ");val(C.num,p.h+"%",{k:"h",g:p.cls});raw(";\n  ");
    tok(C.prop,"border-radius");raw(": ");val(C.num,p.r+"%",{k:"r",g:p.cls});raw(";\n  ");
    tok(C.prop,"transform");raw(": rotate(");val(C.num,(p.a|0)+"deg",{k:"a",g:p.cls});raw(");\n  ");
    tok(C.prop,"background");raw(": ");hexVal(CC_WEAR.pal[p.c]||CC_WEAR.pal[0],{k:"c",g:p.cls});
    raw(";\n}\n");
  });
  tok(C.tag,"</style>");raw("\n");
  return {plain,html};
}

const wearCode=(piece,slot,only)=>build(piece,slot,false,only).plain;
const wearCodeHtml=(piece,slot,only)=>build(piece,slot,true,only).html;

/* what each field may hold, and how far one tap moves it. The ranges are
   the ones the canvas drag itself produces, so the two ways of editing can
   never disagree about what a legal box is. */
const FIELD={
  x:{lo:-40,hi:140,step:1,big:10,unit:"%",prop:"left"},
  y:{lo:-40,hi:140,step:1,big:10,unit:"%",prop:"top"},
  w:{lo:1,  hi:160,step:1,big:10,unit:"%",prop:"width"},
  h:{lo:1,  hi:160,step:1,big:10,unit:"%",prop:"height"},
  r:{lo:0,  hi:50, step:1,big:5, unit:"%",prop:"border-radius"},
  a:{lo:-180,hi:180,step:1,big:15,unit:"deg",prop:"rotate"}
};

window.CC_CODE={code:wearCode,html:wearCodeHtml,classNames:classNames,
  shapeWord:shapeWord,cleanName:cleanName,field:FIELD};
})();
