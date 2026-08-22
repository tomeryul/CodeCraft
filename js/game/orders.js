"use strict";
/* =====================================================================
   📋 Market Orders — the board, as an actual screen
   ---------------------------------------------------------------------
   An order used to be one cramped line inside the price ticker: a couple
   of "🪨 12/40" fragments and a clock. You could not see what was being
   asked, how far along you were, what it paid, or what to DO about it —
   so the one system in the game with a deadline was invisible.

   This is that line given room. It is also the only place the game gets
   to say out loud why the two order SHAPES exist, at the moment the
   player is looking at one:

     ⇉ spread  small amounts of two or three different resources. They
               sit in different places, so the fast answer is one robot
               per resource, each running the whole loop. Parallel.
     ⛓ bulk    a lot of ONE resource, far more than a bag. The trip is
               the cost, so the fast answer is gatherers who stay at the
               seam and a hauler who runs the route. A pipeline.

   Same board, same clock, same 🪙/min — the difference is played.
   ===================================================================== */

function ordersOpen(){
  renderOrders();
  $("orders").classList.add("open");
  if(typeof sfx==="function")sfx(560,.04);
}
function ordersClose(){$("orders").classList.remove("open");}

function ordBar(got,need){
  const pct=Math.max(0,Math.min(100,Math.round(got/Math.max(1,need)*100)));
  return '<i style="width:'+pct+'%"></i>';
}
function ordAdvice(o){
  if(o.shape==="bulk")
    return "<b>⛓ A bulk order</b> asks for one resource in volume — far more than a bag holds, so most of the work is the walking. The quick answer is a <b>pipeline</b>: leave the gatherers at the seam and give one robot the job of hauling. 📦 Give Bag hands a full bag to a robot standing next to you.";
  return "<b>⇉ A spread order</b> asks for a little of two or three different things, and they sit in different places. The quick answer is <b>parallel</b>: one robot per resource, each running the whole loop on its own. No hand-offs, no waiting.";
}
function renderOrders(){
  const el=$("ordBody"); if(!el)return;
  const m=(typeof marketReady==="function")?marketReady():null;
  const o=m&&m.order;
  const filled=player.orders|0, best=player.orderBest|0;
  let h="";
  if(!o){
    h+='<div class="ord-none">📭 The board is empty right now.<small>A new order goes up every few seconds — keep gathering in the meantime.</small></div>';
  }else{
    const late=(o.until-now)<45000;
    h+='<div class="ord-card">'+
       '<div class="ord-top"><span class="ord-shape">'+(o.shape==="bulk"?"⛓ Bulk":"⇉ Spread")+'</span>'+
       '<span class="spacer"></span>'+
       '<span class="ord-clk'+(late?" late":"")+'">⏱ '+mktClock(o.until)+'</span></div>';
    for(const k in o.need){
      const got=o.got[k]||0, need=o.need[k], done=got>=need;
      h+='<div class="ord-row'+(done?" done":"")+'">'+
         '<span class="ord-res">'+RES[k].em+' '+k+'</span>'+
         '<span class="ord-bar">'+ordBar(got,need)+'</span>'+
         '<span class="ord-n">'+got+'/'+need+(done?" ✅":"")+'</span></div>';
    }
    h+='<div class="ord-pay">🪙 '+o.reward+' on delivery</div>';
    h+='<div class="ord-how">Deliver by <b>selling</b> at the 🏪 market — whatever you sell counts towards the order automatically.</div>';
    h+='<div class="ord-tip">'+ordAdvice(o)+'</div>';
    h+='<button class="ord-go" id="ordCode">🧩 Open the code editor</button>';
    h+='</div>';
  }
  h+='<div class="ord-stats"><span>📦 Filled <b>'+filled+'</b></span>'+
     (best?'<span>🏁 Best <b>'+Math.floor(best/60)+":"+("0"+(best%60)).slice(-2)+'</b></span>':'')+
     '</div>';
  el.innerHTML=h;
  const go=$("ordCode");
  if(go)go.addEventListener("click",()=>{
    ordersClose();
    $("editor").classList.add("open");
    if(typeof setTab==="function")setTab("blocks");
    if(typeof renderProgram==="function"){renderProgram();renderPy();}
    toast("🚶 Walk To the resource → gather → 🚶 Walk To 🏪 → ⤵️ Drop.");
  });
}

$("ordClose").addEventListener("click",ordersClose);
/* the ticker is the only place an order is visible from the world, so its
   order chip is the way in — a screen nothing opens is a screen nobody finds */
$("ticker").addEventListener("click",e=>{
  if(e.target.closest(".tk-order")||e.target.closest(".tk-shape")||e.target.closest(".tk-clk")){
    e.stopPropagation();ordersOpen();
  }
},true);

// keep the sheet honest while it is open — the clock is ticking behind it
const _ordUpdateHud=window.updateHud;
window.updateHud=function(){
  const r=_ordUpdateHud.apply(this,arguments);
  try{ if($("orders").classList.contains("open"))renderOrders(); }catch(_){}
  return r;
};
