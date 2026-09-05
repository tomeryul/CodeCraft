"use strict";
/* =====================================================================
   The piece, written out as HTML and CSS
   ---------------------------------------------------------------------
   CodeCraft already makes one promise like this: you drag blocks, and the
   Python tab shows the same program in the language real engineers use.
   Nobody types the Python — reading it is the lesson, and the blocks are
   how you write it.

   A piece built out of parts gets the same deal. Every part IS a <div>
   with a CSS rule: a position, a size, a corner radius and a colour, all
   of them percentages of the box the piece lives in. So the code below is
   not a picture of the piece — it is the piece, spelled the way a browser
   would want it.

   The one idea this exists to teach is in the two-or-more case. Parts in
   the same group share a class: one rule for how they look, and a `style`
   of their own for where they stand. That is a component, spelled the way
   CSS spells it, and a child who sees one rule light up two divs has met
   the idea before they have met the word.
   ===================================================================== */
(function(){

/* what to call a box, from the corner radius that shapes it */
function shapeWord(r){ return r>=50?"dot":r>=40?"pill":r>=10?"tile":"box"; }

/* Class names are descriptive because that is what class names are for:
   "gold-pill", not "part3". The colour names are the same ones the palette
   announces, so the swatch a child tapped is the word in the stylesheet. */
function classNames(parts){
  const first={}, order=[], used={}, out={};
  for(const p of parts)if(!(p.cls in first)){first[p.cls]=p;order.push(p.cls);}
  for(const cls of order){
    const p=first[cls];
    const base=((CC_WEAR.names[p.c]||"part")+"-"+shapeWord(p.r)).toLowerCase();
    let n=base, i=2;
    while(used[n])n=base+"-"+(i++);
    used[n]=1; out[cls]=n;
  }
  return out;
}

function wearCode(piece,slot){
  const parts=(piece&&piece.parts)||[];
  const root=slot||(piece&&piece.slot)||"outfit";
  if(!parts.length)
    return '<!-- nothing here yet -->\n<div class="'+root+'">\n</div>\n';
  const names=classNames(parts), count={};
  for(const p of parts)count[p.cls]=(count[p.cls]||0)+1;

  let html='<div class="'+root+'">\n';
  for(const p of parts){
    const shared=count[p.cls]>1;
    html+='  <div class="'+names[p.cls]+'"'+
      (shared?' style="left: '+p.x+'%; top: '+p.y+'%"':'')+'></div>\n';
  }
  html+='</div>\n';

  let css='<style>\n.'+root+' {\n  position: relative;\n  width: 100%;\n  height: 100%;\n}\n';
  const done={};
  for(const p of parts){
    if(done[p.cls])continue; done[p.cls]=1;
    const shared=count[p.cls]>1;
    css+='\n.'+names[p.cls]+' {\n  position: absolute;\n'+
      (shared?'':'  left: '+p.x+'%;\n  top: '+p.y+'%;\n')+
      '  width: '+p.w+'%;\n  height: '+p.h+'%;\n'+
      (p.r?'  border-radius: '+p.r+'%;\n':'')+
      '  background: '+(CC_WEAR.pal[p.c]||CC_WEAR.pal[0])+';\n}\n';
  }
  css+='</style>\n';

  const title=(piece&&piece.name)?piece.name:"my piece";
  return '<!-- '+title+' -->\n'+html+'\n'+css;
}

/* Highlighting. js/extras.js has one of these already, but it is a Python
   highlighter: it reads "#ffb830" as a comment and paints the whole line
   grey. HTML needs its own, and a hex colour is worth a chip of that very
   colour beside it — the fastest way to learn that #5ab8ff IS the blue. */
const ESC=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const C={com:"#8a7fb8",tag:"#ff9d6b",attr:"#5ab8ff",str:"#8ff0a0",
         sel:"#b184ff",prop:"#5ab8ff",num:"#ffd66b"};
function wearCodeHtml(piece,slot){
  const src=ESC(wearCode(piece,slot));
  return src.replace(
    /(&lt;!--[\s\S]*?--&gt;)|(&lt;\/?)([a-zA-Z][\w-]*)|([a-zA-Z-]+)(?==&quot;|=")|("[^"\n]*")|(#[0-9a-fA-F]{3,8})\b|(\.[a-zA-Z][\w-]*)(?=[\s,{])|([a-z-]+)(?=\s*:)|(-?\d+(?:\.\d+)?%?)/g,
    (m,com,open,tag,attr,str,hex,sel,prop,num)=>{
      if(com)return '<span style="color:'+C.com+';font-style:italic">'+com+'</span>';
      if(tag)return '<span style="color:'+C.tag+'">'+open+tag+'</span>';
      if(attr)return '<span style="color:'+C.attr+'">'+attr+'</span>';
      if(str)return '<span style="color:'+C.str+'">'+str+'</span>';
      if(hex)return '<span class="hexsw" style="background:'+hex+'"></span>'+
                    '<span style="color:'+C.str+'">'+hex+'</span>';
      if(sel)return '<span style="color:'+C.sel+'">'+sel+'</span>';
      if(prop)return '<span style="color:'+C.prop+'">'+prop+'</span>';
      if(num)return '<span style="color:'+C.num+'">'+num+'</span>';
      return m;
    });
}

window.CC_CODE={code:wearCode,html:wearCodeHtml,classNames:classNames,shapeWord:shapeWord};
})();
