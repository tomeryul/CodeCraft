"use strict";
/* =====================================================================
   Robot cosmetics — outfits, back pieces and shoes
   ---------------------------------------------------------------------
   Painters, not sprites. A hat is rigid, so it stays a sprite in
   js/sprites.js; an outfit has to squash with the body inside its clip
   path and a shoe has to ride a foot that re-rotates every frame, and a
   bitmap can do neither.

   Everything here is drawn in BODY UNITS — the same space render.js draws
   the robot in, where the body square is S = TILE*0.72, the hips sit at
   (±5.53, 13.28) and the leg is 5.53 long. The caller has already applied
   the whole transform tree, so these functions never translate to a
   world position and never save/restore around the caller's state beyond
   their own work.

   Three anchors, three entry points:
     back(g,id,sway,gp)          (0,2), before the legs
     shoe(g,id,limbColor,mv,t)   the leg end, after rotate(footDeg)
     outfit(g,id,color)          (0,0), inside the body's clip

   No new colours: every fill below already exists in css/styles.css or
   js/sprites.js.
   ===================================================================== */
(function(){
const S=TILE*0.72;

/* the game's own rounded-rect helper, guarded so this file is usable
   before render.js has run */
function RR(g,x,y,w,h,r){
  if(typeof rr==="function"){rr(g,x,y,w,h,r);return;}
  g.beginPath();
  if(g.roundRect){g.roundRect(x,y,w,h,r);return;}
  g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);
  g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();
}

/* ---------- outfits: inside the body's clip, so they squash with it ----------
   `cape` is deliberately absent here: it is worn on the back anchor, not
   the torso, so it is painted by back() before the legs instead. */
const outfits={
  vest(g){
    g.fillStyle="#ffb830";RR(g,-S/2,-6,9.4,S/2+6,3);g.fill();RR(g,S/2-9.4,-6,9.4,S/2+6,3);g.fill();
    g.fillStyle="rgba(232,242,255,.85)";g.fillRect(-S/2,3.6,S,3.2);
    g.fillStyle="#e09a12";g.fillRect(-S/2,-6,S,2.2);
  },
  apron(g){
    g.fillStyle="#e2d7b8";RR(g,-11,-3,22,S/2+3,4);g.fill();
    g.strokeStyle="#c4b58c";g.lineWidth=1.6;
    g.beginPath();g.moveTo(-9,-3);g.lineTo(-4.5,-9.5);g.moveTo(9,-3);g.lineTo(4.5,-9.5);g.stroke();
    g.beginPath();g.moveTo(-7.5,6.5);g.lineTo(7.5,6.5);g.stroke();
    g.fillStyle="#cfc09a";RR(g,-6.5,7.5,13,6,1.6);g.fill();
  },
  stripes(g){
    g.fillStyle="rgba(255,255,255,.88)";
    g.fillRect(-S/2,-9.5,S,3.4);g.fillRect(-S/2,-2.5,S,3.4);g.fillRect(-S/2,4.5,S,3.4);
  },
  hoodie(g){
    g.fillStyle="#5ab8ff";g.fillRect(-S/2,-S/2,S,15.5);
    g.fillStyle="#3f93cf";g.beginPath();g.moveTo(-S/2,-S/2);g.quadraticCurveTo(0,-S/2+9,S/2,-S/2);g.lineTo(S/2,-S/2);g.closePath();g.fill();
    g.strokeStyle="rgba(23,17,48,.4)";g.lineWidth=1.4;g.beginPath();g.moveTo(0,-11);g.lineTo(0,0);g.stroke();
    g.fillStyle="#ffd66b";g.beginPath();g.arc(0,.6,1.5,0,7);g.fill();
  },
  lab(g){
    g.fillStyle="#f2f3f7";RR(g,-S/2,-5,S,S/2+5,3);g.fill();
    g.fillStyle="#dfe3ec";g.beginPath();g.moveTo(-8,-5);g.lineTo(0,2);g.lineTo(8,-5);g.closePath();g.fill();
    g.strokeStyle="#c3c9d6";g.lineWidth=1.4;RR(g,3.4,5,7,6,1.4);g.stroke();
    g.fillStyle="#5ab8ff";g.fillRect(5.2,4.4,1.4,4);
  }
};

/* ---------- back pieces: before the legs, so they read as behind ----------
   The cape trails on the gait phase and leans with the sway, which is the
   whole reason it lives inside the transform tree. */
const backs={
  cape(g,sway,gp){
    const w=Math.sin((gp||0)*6.283)*2.2+(sway||0)*.35;
    g.save();
    g.fillStyle="#e04a5f";
    g.beginPath();g.moveTo(-12,-9);g.lineTo(12,-9);
    g.quadraticCurveTo(15+w,4,17+w*1.6,20);
    g.quadraticCurveTo(0,25,-17+w*1.6,20);
    g.quadraticCurveTo(-15+w,4,-12,-9);g.closePath();g.fill();
    g.fillStyle="rgba(0,0,0,.16)";
    g.beginPath();g.moveTo(0,-9);g.quadraticCurveTo(4+w,6,6+w*1.6,22);g.quadraticCurveTo(0,24,-2,22);g.closePath();g.fill();
    g.fillStyle="#ffd66b";RR(g,-12.5,-10.5,25,3.6,1.8);g.fill();
    g.restore();
  }
};

/* ---------- shoes: inside the per-leg closure, after rotate(footDeg) ----------
   Origin is the leg end and the foot has already counter-rotated, which is
   why a shoe never slides for the same reason the plain foot never did.
   `limb` is the darkened body colour the leg is stroked with, passed in so a
   shoe can match it; the rocket flame only burns while the robot is moving. */
const shoes={
  boots(g){
    g.fillStyle="#4a3728";RR(g,-4.9,-1.8,9.8,6.2,2.6);g.fill();
    g.fillStyle="#241b45";RR(g,-5.3,3.2,10.6,2.4,1.2);g.fill();
    g.fillStyle="rgba(255,255,255,.16)";RR(g,-3.6,-1,4.4,1.8,.9);g.fill();
  },
  sneakers(g){
    g.fillStyle="#f2f3f7";RR(g,-4.7,-1.9,9.4,5.2,2.4);g.fill();
    g.fillStyle="#5ab8ff";RR(g,-5.1,2.6,10.2,2.6,1.3);g.fill();
    g.strokeStyle="#c3c9d6";g.lineWidth=1;g.beginPath();g.moveTo(-2.6,-.6);g.lineTo(1.6,-.6);g.stroke();
  },
  wellies(g){
    g.fillStyle="#54d66a";RR(g,-3.3,-9.5,6.6,9.5,1.8);g.fill();
    g.fillStyle="#3fb257";RR(g,-4.9,-1.8,9.8,6,2.5);g.fill();
    g.fillStyle="#241b45";RR(g,-5.2,3.2,10.4,2.2,1.1);g.fill();
    g.fillStyle="rgba(255,255,255,.22)";g.fillRect(-3.3,-8.4,6.6,1.4);
  },
  rockets(g,limb,moving,t){
    g.fillStyle="#cfd4e0";RR(g,-4.2,-2.4,8.4,6.4,2.2);g.fill();
    g.fillStyle="#9aa3b5";g.beginPath();g.moveTo(-3.4,4);g.lineTo(3.4,4);g.lineTo(2.4,6.6);g.lineTo(-2.4,6.6);g.closePath();g.fill();
    g.fillStyle="#ff5d73";RR(g,-4.2,-.6,8.4,1.8,.9);g.fill();
    if(moving){
      const fl=.7+.3*Math.sin((t||0)/70);
      g.fillStyle="#ffb830";g.beginPath();g.moveTo(-2.2,6.6);g.lineTo(2.2,6.6);g.lineTo(0,6.6+6*fl);g.closePath();g.fill();
      g.fillStyle="#ffe9a0";g.beginPath();g.moveTo(-1.1,6.6);g.lineTo(1.1,6.6);g.lineTo(0,6.6+3.4*fl);g.closePath();g.fill();
    }
  }
};

window.CC_WEAR={
  outfits:outfits, backs:backs, shoes:shoes,
  /* body-local; the caller has already clipped to the body square */
  outfit(g,id,color){const f=outfits[id]; if(f)f(g,color);},
  /* body-local; drawn before the legs */
  back(g,id,sway,gp){const f=backs[id]; if(f)f(g,sway,gp);},
  /* foot-local; origin = leg end, already rotated */
  shoe(g,id,limb,moving,t){const f=shoes[id]; if(f)f(g,limb,moving,t);}
};
/* `back` is looked up as CC_WEAR.back[id] at the call site in render.js —
   a function has no such property, so expose the table under the same name
   through the function object. It keeps the call site honest: only ids that
   actually paint something behind the robot cost a save/restore. */
Object.keys(backs).forEach(k=>{window.CC_WEAR.back[k]=backs[k];});
})();
