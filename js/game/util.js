"use strict";
/* =====================================================================
   CodeCraft — open-world programming game. Single file, no dependencies.
   ===================================================================== */
window.addEventListener("error", e => {
  try { document.title = "JSERR: " + e.message; toast("⚠️ " + e.message); } catch (_) {}
});

/* ---------------- utils ---------------- */
const $ = id => document.getElementById(id);
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
/* toward b at an even pace of at most v a call; a gap of more than a
   couple of tiles is a teleport (home, a load), not a walk */
const glide=(a,b,v)=>{if(a==null||!isFinite(a)||Math.abs(b-a)>2.5)return b;return a+Math.max(-v,Math.min(v,b-a));};
/* > and ' were missing. A value escaped for element content is not
   automatically safe inside an attribute, and the game does build
   attributes by concatenation. */
const esc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;")
  .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
/* A colour arrives from a save file, so it reaches a style attribute as
   whatever the file said. Anything that is not plainly a colour is not
   one. */
const safeColor=c=>/^#[0-9a-fA-F]{3,8}$/.test(String(c||""))?String(c):"#ffb830";
/* Player-supplied text that will be shown: no markup, no runaway length. */
const safeText=(s,n)=>String(s==null?"":s).replace(/[<>&"']/g,"").slice(0,n||40);
let uidN=1; const uid=()=>uidN++;
