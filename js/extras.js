/* =====================================================================
   CodeCraft — v2 extras (drop-in)
   Adds: full-screen unlock / daily-gift celebration overlay, Python
   syntax highlighting, returning-player splash state, color helper for
   the canvas robot bevel. Load in its own script tag after the sprite
   pack and before the main game script. Requires codecraft-skin.css
   (the "v2 extras" CSS section) for the overlay/mascot styles.

   Hooks needed in the game code (already applied in index-redesigned.html):
   - bigToast(): first line -> if(window.CC_EXTRAS&&CC_EXTRAS.maybeCelebrate(t))return;
   - renderPy(): use CC_EXTRAS.hl(src) into innerHTML instead of textContent
   ===================================================================== */
(function(){
"use strict";
const CONF=["#ffb830","#54d66a","#5ab8ff","#ff5d73","#ffd66b","#b184ff"];

/* ---- full-screen celebration overlay (mock board 1g) ---- */
function celebrate(icon,kicker,title,desc,cta){
  const old=document.getElementById("ccCele"); if(old)old.remove();
  const o=document.createElement("div");o.id="ccCele";
  o.innerHTML='<div class="cc-card"><div class="cc-halo"><div class="cc-ic">'+icon+'</div></div>'+
    '<div class="cc-kick">'+kicker+'</div><div class="cc-title">'+title+'</div>'+
    '<div class="cc-desc">'+desc+'</div><button class="cc-cta">'+(cta||"Let\u2019s try it! 🚀")+'</button></div>';
  for(let i=0;i<14;i++){
    const s=document.createElement("i");s.className="cc-conf";
    s.style.left=(4+Math.random()*92)+"%";
    s.style.background=CONF[i%CONF.length];
    s.style.animationDuration=(1.7+Math.random()*.9)+"s";
    s.style.animationDelay=(Math.random()*1.4)+"s";
    if(i%3===0)s.style.borderRadius="50%";
    o.appendChild(s);
  }
  document.body.appendChild(o);
  const close=()=>{o.classList.add("out");setTimeout(()=>o.remove(),320);};
  o.querySelector(".cc-cta").addEventListener("click",close);
  o.addEventListener("click",e=>{if(e.target===o)close();});
}
/* intercepts bigToast text; returns true if it showed an overlay instead */
function maybeCelebrate(t){
  if(typeof t!=="string")return false;
  let m=t.match(/^(\S+)\s+(.+?UNLOCKED!)\s*(.*)$/);
  if(m){celebrate(m[1],"NEW POWER",m[2],m[3]||"");return true;}
  m=t.match(/^🎁\s*(Day \d+[^!]*!)\s*(.*)$/);
  if(m){celebrate("🎁","DAILY GIFT",m[1],m[2]||"","Awesome! 🎉");return true;}
  return false;
}

/* ---- Python syntax highlighting (mock board 1d) ---- */
const ESC=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;");
function hl(code){
  let out=ESC(code).replace(
    /(#[^\n]*)|("[^"\n]*")|\b(for|in|if|elif|else|while|def|return|not|and|or|True|False)\b|\brobot\b|\b(range|print|len)\b|\b(\d+)\b/g,
    (m,com,str,kw,fn,num)=>{
      if(com)return '<span style="color:#8a7fb8;font-style:italic">'+com+'</span>';
      if(str)return '<span style="color:#8ff0a0">'+str+'</span>';
      if(kw)return '<span style="color:#ff9d6b">'+kw+'</span>';
      if(m==="robot")return '<span style="color:#b184ff">robot</span>';
      if(fn)return '<span style="color:#5ab8ff">'+fn+'</span>';
      if(num)return '<span style="color:#ffd66b">'+num+'</span>';
      return m;
    });
  /* method names after a dot */
  out=out.replace(/\.([a-z_]\w*)\(/g,'.<span style="color:#5ab8ff">$1</span>(');
  return out;
}

/* ---- color helper for the canvas robot bevel ---- */
function lighten(hex,amt){
  const n=parseInt(hex.slice(1),16),r=n>>16&255,g=n>>8&255,b=n&255;
  const f=c=>Math.round(c+(255-c)*amt);
  return "rgb("+f(r)+","+f(g)+","+f(b)+")";
}

/* ---- returning-player splash state (mock board 1a) ---- */
document.addEventListener("DOMContentLoaded",()=>{
  try{
    const d=JSON.parse(localStorage.getItem("codecraft_save_v1"));
    const p=document.getElementById("playBtn");
    if(d&&p&&!document.getElementById("contBtn")){
      const days=((d.player&&d.player.days)||0)+1;
      const b=document.createElement("button");b.id="contBtn";
      b.textContent="🎁 Day "+days+" of your adventure — welcome back!";
      p.after(b);
      b.addEventListener("click",()=>p.click());
    }
  }catch(e){}
});

window.CC_EXTRAS={celebrate,maybeCelebrate,hl,lighten};
})();
