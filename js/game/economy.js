"use strict";
/* ---------------- the living market ----------------
   The open world's problem was not that robots bumped into each other — it was
   that once your gathering program worked, it stayed optimal forever, so there
   was never a reason to open the editor again.

   This is the fix: the WORLD changes its mind. Prices for the five resources
   drift; one is "most wanted" and pays a premium; a 📣 Rush can spike a price for
   a minute; 🌙 Nightfall taxes energy and makes 💎 precious; the market posts
   📋 Orders on a clock. And crucially the robot can 📖 Read a price, so "what is
   worth gathering right now" becomes a decision INSIDE the program rather than
   something you hardcoded once and forgot.

   Everything here is derived from `market`, one small saveable object. */

const MKT_RES=["wood","stone","iron","crystal","water"];
const MKT_DRIFT_MS=9000;      // how often prices take a step
const MKT_WANT_MS=95000;      // how long one resource stays "most wanted"
const ORDER_MS=210000;        // a board order's clock
const EVENT_CHECK_MS=30000;   // how often the world rolls for an event
const NIGHT_MS=70000;         // how long dusk lasts
const RUSH_MS=60000;          // how long a price spike lasts
const LODE_MS=90000;          // how long a rich seam stays up

let market=null;

function freshMarket(){
  const p={};
  for(const k of MKT_RES)p[k]=RES[k].price;
  return {
    prices:p,                 // live price per resource (drifts around the base)
    want:"stone",             // the one paying a premium right now
    wantAt:0,
    driftAt:0,
    order:null,               // {need:{res:n}, got:{res:n}, until, reward}
    event:null,               // {kind:"rush"|"night"|"lode", res, until, x, y}
    eventAt:0,
    earnedWindow:[],          // [{at, n}] recent sales, for the 🪙/min readout
  };
}
function marketReady(){ if(!market)market=freshMarket(); return market; }

// what one unit sells for RIGHT NOW: the drifting price, x the most-wanted
// premium, x any 📣 Rush spike. This is the number 📖 Read reports, so what the
// program sees and what the market pays can never disagree.
function priceOf(res){
  const m=marketReady();
  let p=m.prices[res]||RES[res].price;
  if(m.want===res)p*=1.8;
  const e=m.event;
  if(e&&e.kind==="rush"&&e.res===res&&now<e.until)p*=2.5;
  if(e&&e.kind==="night"&&res==="crystal"&&now<e.until)p*=1.6;
  return Math.max(1,Math.round(p));
}
function priceTrend(res){
  const m=marketReady();
  return (m.prices[res]||0)>=RES[res].price?"▲":"▼";
}

/* ---- prices drift, and the "most wanted" rotates ---- */
function marketTick(){
  const m=marketReady();
  if(!m.driftAt)m.driftAt=now+MKT_DRIFT_MS;
  if(now>=m.driftAt){
    m.driftAt=now+MKT_DRIFT_MS;
    for(const k of MKT_RES){
      const base=RES[k].price;
      // a bounded random walk: never worthless, never absurd
      const step=base*(Math.random()*0.34-0.17);
      m.prices[k]=Math.min(base*1.9,Math.max(base*0.45,(m.prices[k]||base)+step));
    }
  }
  if(!m.wantAt)m.wantAt=now+MKT_WANT_MS;
  if(now>=m.wantAt){
    m.wantAt=now+MKT_WANT_MS;
    const pick=MKT_RES.filter(k=>k!==m.want);
    m.want=pick[Math.floor(Math.random()*pick.length)];
    toast("📈 The market now wants "+RES[m.want].em+" most — worth "+priceOf(m.want)+" 🪙 each!");
    sfx(700,.06);sfx(900,.06,.08);
  }
  orderTick();
  eventTick();
}

/* ---- 📋 orders: a goal with a clock ---- */
/* Orders come in two shapes, and which one is up is what makes "parallel" or
   "cooperative" the right answer — the difference is played, not explained.

   ⇉ SPREAD asks for two or three DIFFERENT resources in modest amounts. They sit
     in different places, so the fast answer is every robot taking one resource and
     running the whole loop itself: pure parallelism.

   ⛓ BULK asks for a LOT of one resource. Volume is far past one bag, so the job
     becomes round trips and the fast answer is a pipeline: gatherers stay on the
     seam and 📦 Give Bag to a hauler that runs the route. It pays more per unit
     precisely because it is travel-heavy.

   Same board, same clock, same 🪙/min readout — so the player sees which shape of
   fleet wins which shape of job. */
function newOrder(){
  const m=marketReady();
  const pool=MKT_RES.filter(k=>k!=="water");
  const bulk=Math.random()<0.45;
  const need={};
  let shape;
  if(bulk){
    shape="bulk";
    const a=(m.want!=="water")?m.want:pool[Math.floor(Math.random()*pool.length)];
    // deliberately several bags' worth, so the trip is the cost, not the mining
    need[a]=Math.max(18,Math.round((26+Math.random()*22)*(3/Math.max(1,RES[a].price))));
  }else{
    shape="spread";
    const a=(m.want!=="water")?m.want:pool[Math.floor(Math.random()*pool.length)];
    let b=pool[Math.floor(Math.random()*pool.length)];
    if(b===a)b=pool[(pool.indexOf(a)+1)%pool.length];
    const amt=r2=>Math.max(4,Math.round((6+Math.random()*14)*(3/Math.max(1,RES[r2].price))*2));
    need[a]=amt(a);need[b]=amt(b);
  }
  let reward=0;for(const k in need)reward+=need[k]*priceOf(k);
  reward=Math.round(reward*(bulk?2.1:1.7))+40;   // hauling is paid for
  m.order={need,got:{},until:now+ORDER_MS,reward,shape,at:now};
  bigToast("📋 New order! "+orderText(m.order)+" → "+reward+" 🪙");
  sfx(660,.08);sfx(880,.08,.1);
}
function orderText(o){
  return Object.keys(o.need).map(k=>RES[k].em+" "+(o.got[k]||0)+"/"+o.need[k]).join("  ");
}
function orderDone(o){ return Object.keys(o.need).every(k=>(o.got[k]||0)>=o.need[k]); }
// called from sellInv: what you sell counts toward the order
function orderCredit(res,n){
  const m=marketReady(), o=m.order;
  if(!o||!o.need[res]||now>=o.until)return;
  o.got[res]=Math.min(o.need[res],(o.got[res]||0)+n);
  if(orderDone(o)){
    coins+=o.reward;totals.earned+=o.reward;
    player.orders=(player.orders|0)+1;   // the Journey asks for one filled order
    // how fast it went, for the 🏁 best time on the Orders board
    const took=Math.round((now-(o.at||(o.until-ORDER_MS)))/1000);
    if(took>0&&(!player.orderBest||took<player.orderBest))player.orderBest=took;
    addXP(Math.ceil(o.reward/3));
    m.order=null;
    if(window.CC_EXTRAS)CC_EXTRAS.celebrate("📋","ORDER FILLED!","+"+o.reward+" 🪙",
      "Delivered before the clock ran out — that is what a fast program buys you.","Nice! 🎉");
    else bigToast("📋 Order filled! +"+o.reward+" 🪙");
    coinFlash();confetti();sfx(880,.1);sfx(1320,.12,.12);updateHud();
    setTimeout(()=>{if(market&&!market.order)newOrder();},4000);
  }
}
function orderTick(){
  const m=marketReady();
  if(!m.order){ if(!m.orderNext)m.orderNext=now+6000; if(now>=m.orderNext){m.orderNext=0;newOrder();} return; }
  if(now>=m.order.until){
    toast("📋 The order expired — a new one will come up.");
    m.order=null;m.orderNext=now+9000;
  }
}

/* ---- what a robot can ask the board ----
   A 🚶 Walk To target, not a resource key: "wood" is what the market pays
   for, but "tree" is the thing standing in the world, and the block that
   comes next needs the second one. */
const RES_TARGET={wood:"tree",stone:"rock",iron:"iron",crystal:"crystal",water:"water"};
// the first thing the live order is still short of
function orderNeeds(){
  const m=market,o=m&&m.order;
  if(!o||now>=o.until)return null;
  for(const k in o.need){ const got=o.got[k]||0; if(got<o.need[k])return {res:k,left:o.need[k]-got}; }
  return null;
}
function orderWant(){const n=orderNeeds();return n?(RES_TARGET[n.res]||n.res):"";}
function orderLeft(){const n=orderNeeds();return n?n.left:0;}

/* ---- 🎲 events: the world does something you did not plan for ---- */
function eventTick(){
  const m=marketReady();
  if(m.event&&now>=m.event.until){
    if(m.event.kind==="lode")clearLode(m.event);
    m.event=null;
  }
  if(!m.eventAt)m.eventAt=now+EVENT_CHECK_MS;
  if(now<m.eventAt)return;
  m.eventAt=now+EVENT_CHECK_MS;
  if(m.event)return;
  const roll=Math.random();
  if(roll<0.34)startRush();
  else if(roll<0.62)startNight();
  else if(roll<0.9)startLode();
}
function startRush(){
  const m=marketReady();
  const res=MKT_RES[Math.floor(Math.random()*MKT_RES.length)];
  m.event={kind:"rush",res,until:now+RUSH_MS};
  bigToast("📣 "+RES[res].em+" RUSH! Prices spiked to "+priceOf(res)+" 🪙 for a minute — send everyone!");
  sfx(880,.09);sfx(1180,.1,.1);
}
function startNight(){
  const m=marketReady();
  m.event={kind:"night",until:now+NIGHT_MS};
  bigToast("🌙 Nightfall — everything costs more energy, but 💎 crystal is precious. Watch for 😴 tired!");
  sfx(300,.12);
}
// a rich seam appears somewhere near home AND announces itself on the 📻
// noticeboard, so a fleet with 📻 Go To Call reacts to it without you touching
// anything — the one place the team blocks earn their keep.
function startLode(){
  const m=marketReady();
  const kinds=["crystal","iron","rock"];
  const type=kinds[Math.floor(Math.random()*kinds.length)];
  const spots=[];
  for(let tries=0;tries<300&&spots.length<5;tries++){
    const x=homePos.x+Math.round((Math.random()-.5)*22), y=homePos.y+Math.round((Math.random()-.5)*22);
    if(!inB(x,y))continue;
    const k=key(x,y);
    if(terrain[k]===T_WATER||objects.has(k))continue;
    if(robots.some(r=>r.x===x&&r.y===y))continue;
    objects.set(k,{type,lode:1});
    spots.push({x,y});
  }
  if(!spots.length)return;
  const c=spots[0];
  m.event={kind:"lode",res:NODE_YIELD[type],until:now+LODE_MS,x:c.x,y:c.y,spots};
  if(typeof radioPost==="function")radioPost(type==="rock"?"rock":type,c.x,c.y,-1,0);
  bigToast("💎 A rich "+(OBJ_EM[type]||"")+" seam surfaced — it is on the 📻 team channel for "+Math.round(LODE_MS/1000)+"s!");
  sfx(760,.09);sfx(1040,.1,.1);
}
function clearLode(e){
  for(const s of (e.spots||[])){
    const o=objects.get(key(s.x,s.y));
    if(o&&o.lode)objects.delete(key(s.x,s.y));   // only what is left of it sinks away
  }
}
// 🌙 makes every action hungrier — a program that never checks 😴 tired stalls
function energyMul(){
  const m=market;
  return (m&&m.event&&m.event.kind==="night"&&now<m.event.until)?1.7:1;
}

/* ---- 🪙 per minute: so a smarter program is VISIBLE, not just theoretical ---- */
function noteEarning(n){
  const m=marketReady();
  m.earnedWindow.push({at:now,n});
  const cut=now-60000;
  while(m.earnedWindow.length&&m.earnedWindow[0].at<cut)m.earnedWindow.shift();
  if(m.earnedWindow.length>400)m.earnedWindow.splice(0,m.earnedWindow.length-400);
}
function coinsPerMin(){
  const m=marketReady();
  const cut=now-60000;
  return m.earnedWindow.reduce((s,e)=>s+(e.at>=cut?e.n:0),0);
}

/* ---- the market handle: ONE button under the top bar. Prices, the live event
   and the 📋 order used to be three permanent rows over the world; now they are
   one line you tap open. Same numbers, same tick, just folded away. ---- */
function mktClock(t){
  const s=Math.max(0,Math.ceil((t-now)/1000));
  return Math.floor(s/60)+":"+("0"+(s%60)).slice(-2);
}
function renderMarket(){
  const el=$("ticker");if(!el)return;
  const m=marketReady();
  const showing=!$("editor").classList.contains("open")&&!$("projects").classList.contains("open");
  el.style.display=showing?"":"none";
  if(!showing)return;
  const ev=m.event&&now<m.event.until?m.event:null;
  const open=el.classList.contains("open");
  const cpm=coinsPerMin();
  /* the handle: rate, the order clock, and a dot when the world is doing something */
  /* The order's shape is already spelled out in the panel's own order row, so
     the handle drops it. q0 hides the rate while it reads zero — a number
     that has never moved is not worth a chip's width — and .tk-rate stays in
     the DOM either way, because it is what the smoke test reads. */
  /* TWO buttons, not one with two halves. The clock used to sit inside the
     📈 handle, and tapping it opened the Orders sheet while tapping two
     millimetres to the left opened the price panel — one pill, one shape,
     two different screens, and nothing on it saying so. They are separate
     chips now, with a gap and their own colours: amber for the market, the
     Orders sheet's own violet for the order. */
  let html='<button class="tk-btn'+(ev?" live":"")+(cpm?"":" q0")+'" type="button"'+
    ' aria-expanded="'+open+'" title="Market prices" aria-label="Market prices">'+
    '<span class="tk-ic">📈</span>'+
    '<span class="tk-rate">🪙/min '+cpm+'</span>'+
    '<span class="tk-car">'+(open?"▴":"▾")+'</span></button>'+
    (m.order?'<button class="tk-ord" type="button" title="The order on the clock"'+
      ' aria-label="The order on the clock">'+
      '<span class="tk-clk">⏱ '+mktClock(m.order.until)+'</span></button>':'');
  if(open){
    html+='<div class="tk-panel">';
    if(ev){
      const txt=ev.kind==="rush"?"📣 "+RES[ev.res].em+" RUSH":ev.kind==="night"?"🌙 Nightfall":"💎 Rich seam — on 📻";
      html+='<div class="tk-ev '+ev.kind+'">'+txt+' · '+Math.max(0,Math.ceil((ev.until-now)/1000))+'s</div>';
    }
    html+='<div class="tk-grid">';
    for(const k of MKT_RES){
      const hot=(m.want===k)||(ev&&ev.kind==="rush"&&ev.res===k);
      html+='<span class="tk'+(hot?" hot":"")+'">'+RES[k].em+' '+priceOf(k)+
        '<i>'+priceTrend(k)+'</i></span>';
    }
    html+='</div>';
    html+='<div class="tk-note">'+RES[m.want].em+' is most wanted right now — it sells for a premium.</div>';
    if(m.order){
      html+='<div class="tk-order"><b>'+(m.order.shape==="bulk"?"⛓":"⇉")+'</b> '+orderText(m.order)+
        ' <span class="tk-rw">'+m.order.reward+' 🪙</span>'+
        ' <span class="tk-clk">⏱ '+mktClock(m.order.until)+'</span></div>';
    }
    html+='</div>';
  }
  el.innerHTML=html;
}
/* one delegated listener — renderMarket rewrites innerHTML on every tick */
$("ticker").addEventListener("click",e=>{
  if(!e.target.closest(".tk-btn"))return;
  $("ticker").classList.toggle("open");
  if(typeof sfx==="function")sfx(520,.03);
  renderMarket();
});
