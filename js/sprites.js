/* =====================================================================
   CodeCraft — SVG sprite pack (drop-in)
   Replaces emoji world sprites with the custom SVG set. 48px-grid shape
   language, two-tone shading, baked shadows. ~9KB total. Emoji not in
   the map (animals except bunny, UI emoji) fall back automatically.

   INSTALL — two small edits to index.html:
   1. Add before the main game <script>:
        a script tag loading ./codecraft-sprites.js
   2. In the sprite() function, after `if(!c){`, add these 2 lines:
        const sc=window.CC_SPRITES&&window.CC_SPRITES.canvas(ch,s);
        if(sc){spriteCache.set(k,sc);return sc;}
   ===================================================================== */
(function(){
"use strict";
const NS='xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"';
const SVGS={
tree1:`<svg ${NS}><ellipse cx="24" cy="42" rx="9" ry="2.5" fill="rgba(0,0,0,.15)"/><rect x="22.7" y="28" width="2.6" height="13" rx="1.3" fill="#4d8a35"/><ellipse cx="18" cy="26" rx="6" ry="4.5" fill="#54b04a" transform="rotate(-24 18 26)"/><ellipse cx="30" cy="24" rx="6" ry="4.5" fill="#3f9142" transform="rotate(22 30 24)"/></svg>`,
tree2:`<svg ${NS}><ellipse cx="24" cy="43" rx="10" ry="2.5" fill="rgba(0,0,0,.15)"/><rect x="22" y="26" width="4" height="16" rx="2" fill="#8a5a2b"/><circle cx="24" cy="19" r="11" fill="#3f9142"/><circle cx="24" cy="17.5" r="8.5" fill="#4aa348"/><circle cx="20" cy="13.5" r="3.4" fill="#63c25a"/></svg>`,
tree3:`<svg ${NS}><ellipse cx="24" cy="44.5" rx="14" ry="3" fill="rgba(0,0,0,.16)"/><rect x="21" y="28" width="6" height="15" rx="3" fill="#8a5a2b"/><circle cx="13.5" cy="20" r="8.5" fill="#3f9142"/><circle cx="34.5" cy="20" r="8.5" fill="#3f9142"/><circle cx="24" cy="13.5" r="11.5" fill="#3f9142"/><circle cx="24" cy="15.5" r="9.5" fill="#4aa348"/><circle cx="19" cy="10.5" r="3.8" fill="#63c25a"/></svg>`,
flower:`<svg ${NS}><rect x="23" y="28" width="2.4" height="12" rx="1.2" fill="#4d8a35"/><circle cx="24" cy="18" r="4.5" fill="#ffd66b"/><circle cx="24" cy="10.5" r="4" fill="#ff8fb0"/><circle cx="24" cy="25.5" r="4" fill="#ff8fb0"/><circle cx="16.5" cy="18" r="4" fill="#ff8fb0"/><circle cx="31.5" cy="18" r="4" fill="#ff8fb0"/></svg>`,
stone:`<svg ${NS}><ellipse cx="24" cy="41" rx="13" ry="3" fill="rgba(0,0,0,.15)"/><path d="M11 36 Q9 22 18 17 Q25 12 33 18 Q40 23 37 36 Q30 40 11 36 Z" fill="#b9b9c4"/><path d="M14 34 Q13 26 19 22" fill="none" stroke="#9a9aa8" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="30" cy="22" rx="4" ry="2.6" fill="#d5d5de" transform="rotate(-18 30 22)"/></svg>`,
iron:`<svg ${NS}><ellipse cx="24" cy="41" rx="13" ry="3" fill="rgba(0,0,0,.18)"/><path d="M11 36 Q9 22 18 17 Q25 12 33 18 Q40 23 37 36 Q30 40 11 36 Z" fill="#6e6e7c"/><circle cx="19" cy="24" r="3" fill="#cfd4e0"/><circle cx="30" cy="29" r="2.6" fill="#cfd4e0"/><circle cx="26" cy="20" r="1.8" fill="#a8aec2"/></svg>`,
crystal:`<svg ${NS}><circle cx="24" cy="24" r="14" fill="rgba(124,224,255,.22)"/><ellipse cx="24" cy="41" rx="9" ry="2.5" fill="rgba(0,0,0,.15)"/><path d="M24 7 L34 20 L24 40 L14 20 Z" fill="#7ce0ff"/><path d="M24 11 L30 20 L24 34 L18 20 Z" fill="#b9f0ff"/><path d="M24 7 L34 20 L24 40" fill="none" stroke="#54c2ec" stroke-width="1.6"/></svg>`,
log:`<svg ${NS}><ellipse cx="24" cy="38" rx="14" ry="3" fill="rgba(0,0,0,.15)"/><rect x="8" y="20" width="30" height="15" rx="7.5" fill="#a06a2e"/><ellipse cx="38" cy="27.5" rx="5" ry="7.5" fill="#c98d4b"/><ellipse cx="38" cy="27.5" rx="2.6" ry="4" fill="#e8c08a"/><path d="M12 24 L26 24 M14 31 L28 31" stroke="#8a5a2b" stroke-width="2" stroke-linecap="round"/></svg>`,
home:`<svg ${NS}><ellipse cx="24" cy="43" rx="17" ry="3" fill="rgba(0,0,0,.16)"/><rect x="9" y="20" width="30" height="21" rx="4" fill="#f4e7d0"/><path d="M5 23 Q24 2 43 23 L38 23 Q24 9 10 23 Z" fill="#ff7d6b"/><path d="M7 23 Q24 5 41 23 Z" fill="#ff9184"/><rect x="20" y="28" width="9" height="13" rx="3.5" fill="#8a5a2b"/><circle cx="14.5" cy="28" r="3.2" fill="#5ab8ff"/><circle cx="34" cy="28" r="3.2" fill="#5ab8ff"/></svg>`,
market:`<svg ${NS}><ellipse cx="24" cy="43" rx="17" ry="3" fill="rgba(0,0,0,.16)"/><rect x="10" y="20" width="28" height="21" rx="3" fill="#c98d4b"/><rect x="13" y="26" width="10" height="15" rx="2" fill="#8a5a2b"/><rect x="26" y="26" width="9" height="7" rx="2" fill="#ffd66b"/><path d="M7 12 Q24 6 41 12 L41 20 Q24 24 7 20 Z" fill="#ff5d73"/><path d="M12 10.5 L12 21.4 M20 9.4 L20 22.5 M28 9.4 L28 22.5 M36 10.5 L36 21.4" stroke="#fff" stroke-width="3.4" opacity=".85"/></svg>`,
chest:`<svg ${NS}><ellipse cx="24" cy="42" rx="14" ry="2.8" fill="rgba(0,0,0,.16)"/><rect x="9" y="22" width="30" height="18" rx="4" fill="#b07a3e"/><rect x="9" y="13" width="30" height="12" rx="5" fill="#c98d4b"/><rect x="9" y="22" width="30" height="3" fill="#8f5f28"/><rect x="21" y="19" width="6" height="9" rx="2" fill="#ffd66b"/><circle cx="24" cy="24" r="1.4" fill="#8f5f28"/></svg>`,
gift:`<svg ${NS}><ellipse cx="24" cy="42" rx="13" ry="2.8" fill="rgba(0,0,0,.16)"/><rect x="10" y="17" width="28" height="23" rx="4" fill="#ff5d73"/><rect x="8" y="13" width="32" height="8" rx="3" fill="#ff7d90"/><rect x="21" y="13" width="6" height="27" fill="#ffd66b"/><circle cx="18.5" cy="10" r="4" fill="#ffd66b"/><circle cx="29.5" cy="10" r="4" fill="#ffd66b"/></svg>`,
bridge:`<svg ${NS}><rect x="2" y="17" width="44" height="14" rx="4" fill="#c98d4b"/><rect x="11" y="17" width="2.5" height="14" fill="#a06a2e"/><rect x="23" y="17" width="2.5" height="14" fill="#a06a2e"/><rect x="35" y="17" width="2.5" height="14" fill="#a06a2e"/><rect x="2" y="13" width="44" height="3.5" rx="1.75" fill="#8a5a2b"/><rect x="2" y="31.5" width="44" height="3.5" rx="1.75" fill="#8a5a2b"/></svg>`,
bunny:`<svg ${NS}><ellipse cx="24" cy="42" rx="11" ry="2.5" fill="rgba(0,0,0,.13)"/><ellipse cx="19" cy="14" rx="3.6" ry="8.5" fill="#f6f3ff" transform="rotate(-8 19 14)"/><ellipse cx="29" cy="14" rx="3.6" ry="8.5" fill="#f6f3ff" transform="rotate(8 29 14)"/><ellipse cx="19.5" cy="15" rx="1.7" ry="5.5" fill="#ffc9d6" transform="rotate(-8 19.5 15)"/><ellipse cx="28.5" cy="15" rx="1.7" ry="5.5" fill="#ffc9d6" transform="rotate(8 28.5 15)"/><ellipse cx="24" cy="30" rx="11.5" ry="10.5" fill="#f6f3ff"/><ellipse cx="24" cy="35" rx="8" ry="5" fill="#e9e2f6"/><circle cx="20" cy="27" r="1.7" fill="#241b45"/><circle cx="28" cy="27" r="1.7" fill="#241b45"/><ellipse cx="24" cy="30.5" rx="1.8" ry="1.4" fill="#ff8fb0"/></svg>`,
fox:`<svg ${NS}><ellipse cx="23" cy="41" rx="12" ry="2.5" fill="rgba(0,0,0,.13)"/><ellipse cx="36" cy="31" rx="8" ry="4.5" fill="#ff9d5a" transform="rotate(-24 36 31)"/><circle cx="40.5" cy="28.5" r="3.4" fill="#fff"/><path d="M13 19 L15.5 9 L21 16 Z" fill="#ff9d5a"/><path d="M31 16 L36.5 9 L39 19 Z" fill="#ff9d5a"/><ellipse cx="24" cy="29" rx="12" ry="10" fill="#ff9d5a"/><ellipse cx="24" cy="34" rx="8" ry="5" fill="#ffd9b8"/><circle cx="20" cy="26" r="1.7" fill="#241b45"/><circle cx="28" cy="26" r="1.7" fill="#241b45"/><ellipse cx="24" cy="30" rx="2" ry="1.5" fill="#241b45"/></svg>`,
sheep:`<svg ${NS}><ellipse cx="24" cy="42" rx="12" ry="2.5" fill="rgba(0,0,0,.13)"/><circle cx="17" cy="26" r="8" fill="#f6f3ff"/><circle cx="27" cy="23" r="9" fill="#f6f3ff"/><circle cx="33" cy="29" r="7" fill="#f6f3ff"/><circle cx="22" cy="31" r="9" fill="#f6f3ff"/><ellipse cx="12" cy="24" rx="5" ry="6" fill="#4a4066"/><circle cx="10.5" cy="22.5" r="1.3" fill="#fff"/><ellipse cx="7.5" cy="21" rx="2.5" ry="1.6" fill="#4a4066"/><rect x="16" y="36" width="3" height="6" rx="1.5" fill="#4a4066"/><rect x="28" y="36" width="3" height="6" rx="1.5" fill="#4a4066"/></svg>`,
duck:`<svg ${NS}><ellipse cx="24" cy="41" rx="11" ry="2.5" fill="rgba(0,0,0,.13)"/><ellipse cx="23" cy="30" rx="11" ry="9" fill="#ffd66b"/><circle cx="30" cy="18" r="6.5" fill="#ffd66b"/><path d="M35 16 L43 18.5 L35 21 Z" fill="#ff9d3b"/><circle cx="31.5" cy="16.5" r="1.5" fill="#241b45"/><path d="M14 28 Q10 30 12 34 Q17 33 18 30 Z" fill="#eec14f"/></svg>`,
squirrel:`<svg ${NS}><ellipse cx="22" cy="41" rx="11" ry="2.5" fill="rgba(0,0,0,.13)"/><path d="M30 34 Q44 30 40 16 Q36 8 30 12 Q34 20 28 26 Z" fill="#b0703a"/><ellipse cx="21" cy="30" rx="9" ry="9.5" fill="#c98d4b"/><circle cx="19" cy="20" r="6.5" fill="#c98d4b"/><path d="M14 15 L15 9 L19 13 Z" fill="#b0703a"/><circle cx="17" cy="19" r="1.5" fill="#241b45"/><ellipse cx="21" cy="33" rx="5" ry="6" fill="#e8c08a"/></svg>`,
anger:`<svg ${NS}><path d="M14 14 Q19 17 24 14 M34 14 Q31 19 34 24 M34 34 Q29 31 24 34 M14 34 Q17 29 14 24" stroke="#ff5d73" stroke-width="5" fill="none" stroke-linecap="round"/></svg>`,
tophat:`<svg ${NS}><rect x="11" y="30" width="26" height="5" rx="2.5" fill="#2a2148"/><rect x="16.5" y="12" width="15" height="20" rx="3" fill="#2a2148"/><rect x="16.5" y="25" width="15" height="4.5" fill="#ffb830"/></svg>`,
hardhat:`<svg ${NS}><path d="M12 31 Q12 14 24 14 Q36 14 36 31 Z" fill="#ff5d73"/><rect x="21.5" y="12" width="5" height="8" rx="2.5" fill="#ff8fa0"/><rect x="9" y="30" width="30" height="5" rx="2.5" fill="#e04a5f"/></svg>`,
crown:`<svg ${NS}><path d="M13 34 L13 19 L19 25.5 L24 15 L29 25.5 L35 19 L35 34 Z" fill="#ffd66b"/><rect x="13" y="31" width="22" height="4" rx="2" fill="#e8b23e"/><circle cx="24" cy="29" r="2.2" fill="#ff5d73"/></svg>`,
gradcap:`<svg ${NS}><path d="M24 12 L42 20 L24 28 L6 20 Z" fill="#2a2148"/><path d="M15 24 L15 32 Q24 37 33 32 L33 24 L24 28 Z" fill="#3a3357"/><rect x="40" y="20" width="2" height="10" rx="1" fill="#ffd66b"/><circle cx="41" cy="31" r="2.5" fill="#ffd66b"/></svg>`,
cowboy:`<svg ${NS}><path d="M16 22 Q16 11 24 11 Q32 11 32 22 Z" fill="#b0703a"/><path d="M6 24 Q24 34 42 24 Q42 30 24 30 Q6 30 6 24 Z" fill="#c98d4b"/><rect x="16" y="20" width="16" height="4" fill="#8a5a2b"/></svg>`,
party:`<svg ${NS}><path d="M24 8 L34 34 L14 34 Z" fill="#ff5d73"/><path d="M18.5 22 L29.5 22 L31 26 L17 26 Z" fill="#ffd66b"/><circle cx="24" cy="8" r="3.5" fill="#ffd66b"/></svg>`,
coin:`<svg ${NS}><circle cx="24" cy="24" r="12" fill="#ffd66b"/><circle cx="24" cy="24" r="8" fill="none" stroke="#d99a1e" stroke-width="2.5"/><rect x="22.5" y="19" width="3" height="10" rx="1.5" fill="#d99a1e"/></svg>`,
drop:`<svg ${NS}><ellipse cx="24" cy="41" rx="9" ry="2.2" fill="rgba(0,0,0,.13)"/><path d="M24 7 Q35 22 35 29.5 A11 11 0 0 1 13 29.5 Q13 22 24 7 Z" fill="#5ab8ff"/><path d="M24 11 Q32 21.5 32 28.5" fill="none" stroke="#8fd0ff" stroke-width="3" stroke-linecap="round"/><ellipse cx="19.5" cy="29" rx="2.6" ry="4" fill="#bfe6ff" transform="rotate(14 19.5 29)"/></svg>`,
sleep:`<svg ${NS}><g fill="#cfd8ff" font-family="Arial,sans-serif" font-weight="900"><text x="5" y="41" font-size="21">Z</text><text x="20" y="28" font-size="15">Z</text><text x="32" y="17" font-size="11">Z</text></g></svg>`,
housebuild:`<svg ${NS}><ellipse cx="24" cy="43" rx="17" ry="3" fill="rgba(0,0,0,.16)"/><rect x="10" y="21" width="28" height="20" rx="3" fill="#f4e7d0"/><path d="M6 23 Q24 4 42 23 Z" fill="#54b04a"/><path d="M8.5 22 Q24 7.5 39.5 22 Z" fill="#63c25a"/><rect x="20" y="29" width="8" height="12" rx="3" fill="#8a5a2b"/><circle cx="33" cy="28" r="3" fill="#5ab8ff"/><rect x="12.5" y="35" width="5.5" height="6" rx="2" fill="#54b04a"/></svg>`,
car:`<svg ${NS}><ellipse cx="24" cy="40" rx="16" ry="2.6" fill="rgba(0,0,0,.16)"/><path d="M8 32 Q8 24 14 23 L18 16 Q19 14 22 14 L30 14 Q33 14 34 16 L38 23 Q40 24 40 27 L40 32 Q40 34 38 34 L10 34 Q8 34 8 32 Z" fill="#ff5d73"/><path d="M20 17 L29 17 Q31 17 32 19 L34 23 L18 23 L19.5 18.5 Q20 17 20 17 Z" fill="#bfe6ff"/><rect x="8" y="27" width="32" height="2.5" fill="#e04a5f"/><circle cx="15" cy="34" r="4.5" fill="#241b45"/><circle cx="33" cy="34" r="4.5" fill="#241b45"/><circle cx="15" cy="34" r="2" fill="#cfd4e0"/><circle cx="33" cy="34" r="2" fill="#cfd4e0"/></svg>`,
ferris:`<svg ${NS}><ellipse cx="24" cy="43" rx="14" ry="2.6" fill="rgba(0,0,0,.16)"/><path d="M24 20 L15 41 M24 20 L33 41" stroke="#c47d10" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="20" r="13" fill="none" stroke="#ffb830" stroke-width="2.5"/><path d="M24 7 L24 33 M11 20 L37 20 M15 11 L33 29 M33 11 L15 29" stroke="#ffb830" stroke-width="1.8"/><circle cx="24" cy="7" r="3.2" fill="#ff5d73"/><circle cx="37" cy="20" r="3.2" fill="#5ab8ff"/><circle cx="24" cy="33" r="3.2" fill="#54d66a"/><circle cx="11" cy="20" r="3.2" fill="#b184ff"/><circle cx="24" cy="20" r="2.6" fill="#ff5d73"/></svg>`,
globe:`<svg ${NS}><ellipse cx="24" cy="42" rx="11" ry="2.5" fill="rgba(0,0,0,.14)"/><circle cx="24" cy="24" r="14" fill="#5ab8ff"/><path d="M13 18 Q18 14 22 17 Q26 20 23 24 Q18 26 16 23 Z M28 12 Q33 13 34 18 Q31 20 28 17 Z M27 27 Q34 26 36 31 Q32 37 26 35 Q24 30 27 27 Z" fill="#54b04a"/><path d="M16 13.5 Q20 10 26 10.8" stroke="rgba(255,255,255,.5)" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>`,
pencil:`<svg ${NS}><ellipse cx="24" cy="42" rx="11" ry="2.4" fill="rgba(0,0,0,.14)"/><g transform="rotate(45 24 24)"><rect x="19" y="4" width="10" height="26" rx="1.5" fill="#ffb830"/><rect x="19" y="4" width="10" height="5.5" rx="1.5" fill="#ff8fb0"/><path d="M19 30 L24 41 L29 30 Z" fill="#e8c08a"/><path d="M22.2 36.5 L24 41 L25.8 36.5 Z" fill="#241b45"/></g></svg>`,
spark:`<svg ${NS}><path d="M24 8 L27.5 20.5 L40 24 L27.5 27.5 L24 40 L20.5 27.5 L8 24 L20.5 20.5 Z" fill="#fff"/><circle cx="24" cy="24" r="3" fill="#ffd66b"/></svg>`
};
/* emoji used by the game -> sprite name */
const MAP={"🌱":"tree1","🌿":"tree2","🌳":"tree3","🌼":"flower","🪨":"stone","⛓️":"iron","💎":"crystal","🪵":"log",
"🏠":"home","🏪":"market","📦":"chest","🎁":"gift","🌉":"bridge","🐰":"bunny","🦊":"fox","🪙":"coin","✨":"spark","🐑":"sheep","🦆":"duck","🐿️":"squirrel","💢":"anger","🎩":"tophat","⛑️":"hardhat","👑":"crown","🎓":"gradcap","🤠":"cowboy","🥳":"party",
"💧":"drop","😴":"sleep","🏡":"housebuild","🚗":"car","🎡":"ferris","🌍":"globe","✏️":"pencil"};
const imgs={};
function img(name){
  let i=imgs[name];
  if(!i){i=new Image();i.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(SVGS[name]);imgs[name]=i;}
  return i;
}
window.CC_SPRITES={
  has:ch=>!!MAP[ch],
  svg:ch=>{const n=MAP[ch];return n?SVGS[n]:null;},
  list:()=>Object.keys(MAP),
  /* returns a canvas sized like the game's emoji sprites (s*1.3 square,
     sprite drawn centered at s), or null if this emoji isn't in the set */
  canvas(ch,s){
    const name=MAP[ch]; if(!name)return null;
    const R=3, c=document.createElement("canvas");
    c.lw=Math.ceil(s*1.3);
    c.width=c.height=c.lw*R;
    const i=img(name), off=(c.lw-s)/2*R;
    const paint=()=>{c.getContext("2d").drawImage(i,off,off,s*R,s*R);};
    if(i.complete&&i.naturalWidth)paint();
    else i.addEventListener("load",paint,{once:true});
    return c;
  }
};
/* preload everything so the first frame is already skinned */
Object.keys(SVGS).forEach(img);
})();
