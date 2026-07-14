"use strict";
/* ---------------- simulation loop ---------------- */
let last=0, slowAcc=0, started=false, simTime=0;
function loop(t){
  requestAnimationFrame(loop);
  if(!started){last=t;return;}
  // simTime advances by clamped dt, so a suspended tab can never cause a tick flood
  const dt=Math.min(100,t-last);last=t;
  simTime+=dt;now=simTime;lastDtSec=dt/1000;
  for(const r of robots){
    if(!r.nextAct)r.nextAct=simTime;
    const step=340/r.speed/(1+skills.agility.lvl*.015); // agility skill perk
    while(simTime>=r.nextAct){r.nextAct+=step;tickRobot(r);}
  }
  // slow world tick (1s): growth, respawns, animals hud
  slowAcc+=dt;
  if(slowAcc>=1000){
    slowAcc=0;
    // robots slowly catch their breath even without resting (kids never get permanently stuck)
    for(const r2 of robots){r2.energy=Math.min(MAX_ENERGY,(r2.energy==null?MAX_ENERGY:r2.energy)+3);if(r2.energy>15)r2.tired=false;}
    for(const [k2,o] of objects){
      if(o.type==="tree"&&o.stage<2&&o.growAt!==undefined&&now>=o.growAt){
        o.stage++;o.growAt=now+20000;if(o.stage>=2)delete o.growAt;
      }
    }
    for(let i=respawnQ.length-1;i>=0;i--){
      const e=respawnQ[i];
      if(now>=e.at){
        respawnQ.splice(i,1);
        const k2=key(e.x,e.y);
        if(!objects.has(k2)){
          if(e.type==="tree")objects.set(k2,{type:"tree",stage:0,growAt:now+20000});
          else objects.set(k2,{type:e.type});
        }
      }
    }
    updateHud();updateExecHighlight();
  }
  // animals hop
  for(const a of animals){
    if(now>=a.next){
      a.next=now+800+Math.random()*2200;
      const d=(Math.random()*4)|0, nx=a.x+DX[d], ny=a.y+DY[d];
      if(inB(nx,ny)&&terrain[key(nx,ny)]===T_GRASS&&!objects.has(key(nx,ny)))
        {a.x=nx;a.y=ny;}
    }
  }
  draw(t);
  if(mgState&&typeof mgDraw==="function")mgDraw(); // keep the mini-game board live & animated
}
function updateExecHighlight(){
  if(!$("editor").classList.contains("open"))return;
  const r=R();
  document.querySelectorAll("#programEl .blk.exec").forEach(el=>el.classList.remove("exec"));
  if(r.running&&r.curUid){
    const el=document.querySelector('#programEl .blk[data-uid="'+r.curUid+'"]');
    if(el)el.classList.add("exec");
  }
  const vw=$("varWatch"), ks=Object.keys(r.vars||{});
  if(ks.length){
    vw.style.display="flex";vw.innerHTML="";
    for(const k2 of ks){
      const s=document.createElement("span");
      s.textContent="📦 "+k2+" = "+r.vars[k2];
      vw.appendChild(s);
    }
  }else vw.style.display="none";
}
setInterval(updateExecHighlight,350);
requestAnimationFrame(loop);
