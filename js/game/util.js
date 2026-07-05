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
const esc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;");
let uidN=1; const uid=()=>uidN++;
