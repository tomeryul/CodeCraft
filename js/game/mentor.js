"use strict";
/* ---------------- mentor ---------------- */
const IDEAS=[
  "🌲 Wood farm: Forever → Face Nearest tree → If tree ahead: Collect, else Move. Watch it harvest forever!",
  "🚚 Delivery bot: one robot drops wood in a line, a second robot collects it and carries it to the market. A supply chain!",
  "🌉 Bridge builder: collect 10 stone, walk to a river, and use Build → bridge to cross into new lands!",
  "🌱 Tree planter: Repeat 5 → Build sapling → Move. Plant a forest, then harvest it later — renewable resources!",
  "💎 Crystal hunter: crystals hide in rocky mountains and sell for 15 🪙 each. Program an expedition!",
  "🏭 Full factory: harvester bot fills its bag → Go Home → face the chest → Drop → back to work. Sell the chest storage in the shop!",
  "🤖 Robot fleet: buy more robots and give each one a different job — miner, lumberjack, courier, seller.",
  "♾️ The dream: a program you never have to touch again. Coins roll in while you just watch your world work!",
  "🧮 Counter bot: Set c = 0 → Forever → Collect → Change c by 1 → Say c. Watch it count its harvest out loud!",
  "🗺️ Treasure hunter: 🎁 chests hide far from home. Program a robot with Face Nearest + If blocked → Turn, and go exploring!",
];
const BRAIN=[
  {k:["move","moving","stuck","walk"],a:"To move, add the ⬆️ Move block — your robot walks 1 tile in the direction it faces. Use ↩️/↪️ to turn first!\n\nIf it's not moving, check:\n1️⃣ Did you press ▶ Run?\n2️⃣ Is something blocking it (trees, rocks, water)?\n3️⃣ Does the program have blocks in it?"},
  {k:["loop","repeat","forever"],a:"Loops repeat actions so YOU don't have to! 🔁\n\n• Repeat 5 → runs its inside blocks 5 times\n• Forever ♾️ → runs them until you press Stop — perfect for automation!\n\nIn Python it looks like:\nfor i in range(5):\n    robot.move()\n\nTap a loop block, then tap other blocks — they go INSIDE it."},
  {k:["if","condition","logic","decide"],a:"❓ If blocks let robots make decisions!\n\nExample: If tree ahead → Collect. Otherwise the robot skips it.\n\nCombine with Forever for smart bots:\n♾️ Forever\n  ❓ If tree ahead → ✋ Collect\n  ⬆️ Move\n\nThat robot harvests every tree it walks past!"},
  {k:["coin","money","sell","earn","market","buy"],a:"💰 Earning coins:\n1️⃣ Collect resources (wood 2🪙, stone 3🪙, iron 6🪙, crystal 15🪙)\n2️⃣ Walk your robot next to the market 🏪 (near your home)\n3️⃣ Face it and use ⤵️ Drop — or the 💰 Sell All smart block\n\nSpend coins in the 🛒 shop on robots and upgrades!"},
  {k:["collect","chop","mine","wood","tree","resource"],a:"✋ Collect grabs whatever is directly in FRONT of your robot: full-grown trees 🌳 → wood, rocks 🪨 → stone, ⛓️ iron, 💎 crystal.\n\nFace the thing first (turn blocks), and make sure your bag isn't full — check 🎒 at the top!"},
  {k:["build","bridge","chest","sapling","plant"],a:"🔨 Build creates things on the tile ahead:\n• 🌱 Sapling (1 wood) — grows into a tree. Renewable farming!\n• 🌉 Bridge (2 stone) — cross water into new lands!\n• 📦 Chest (5 wood) — Drop while facing a chest to store items, then sell storage in the shop."},
  {k:["python","code","real","text"],a:"🐍 Tap the Python tab in the editor! Every block you place is shown as real Python code — the same language used at NASA, Google and in AI.\n\nrobot.move() is a function call, for i in range(3): is a loop… you're already writing it!"},
  {k:["fast","faster","speed","slow","optimi"],a:"⚡ Ways to go faster:\n1️⃣ Buy Speed Boost in the shop\n2️⃣ Write smarter code — 🧭 Face Nearest beats wandering randomly\n3️⃣ Bigger bag = fewer trips\n4️⃣ MORE ROBOTS working in parallel — that's real optimization thinking!"},
  {k:["robot","new","another","fleet","team"],a:"🤖 Buy extra robots in the 🛒 shop (100 🪙). Each robot has its OWN program and runs at the same time.\n\nPro move: give each robot one job — one harvests, one hauls, one sells. That's called division of labor, and it's how real factories (and real software!) work."},
  {k:["water","river","lake","cross","island","scoop"],a:"🌊 At a river you can 🪣 Scoop water 💧 (face the water first!). To cross, collect 2 stone and 🔨 Build → bridge. Chain bridges to reach islands full of treasure."},
  {k:["chop","mine","action","tool","harvest","hit"],a:"🪓 Different jobs, different tools!\n• 🪓 Chop — trees (into wood)\n• ⛏️ Mine — rocks, iron & crystal\n• 🪣 Scoop — water from a river\n• ✋ Collect — does the right thing to whatever is in front (and picks up dropped items)\n\nBig things take SEVERAL hits — a tree needs a few chops — so put the action in a 🔁 loop!"},
  {k:["tired","energy","rest","sleep","worn"],a:"😴 Working uses energy (see the ⚡ meter up top). When a robot runs out it gets too tired to chop, mine or build!\n\nAdd a 😴 Rest block to recover — the smart trick is to put Rest INSIDE your loop, or use ❓ If tired → Rest, so your robot paces itself and never conks out. ⚡"},
  {k:["variable","memory","set","count","number","string"],a:"🧠 Memory blocks (unlock by earning 250 🪙):\n• 📦 Set x = 5 — store a number or text\n• ➕ Change x by 1 — count things!\n• 🔢 Count i from 1 to N — a loop where i goes UP each time\n• 💬 Say — your robot shows the value in a speech bubble\n\nTry: Set c = 0 → Forever → Collect → Change c by 1 → Say c. A robot that counts its harvest!\n\nIn Python: for i in range(1, 6): — you're writing real code!"},
  {k:["function","array","advanced"],a:"Great question! In this world:\n• A robot's program is like a function — a reusable recipe\n• 📦 Memory blocks ARE variables — real ones\n• Your robot team is like an array of workers\n\nSwitch to the 🐍 Python tab to see the real syntax. When you're ready, try Python on a computer — you already know the ideas!"},
  {k:["quest","level","xp","hat","gift","daily","treasure"],a:"⭐ Ways to grow:\n• 📜 Quests — finish goals, claim coins & XP\n• ⭐ Level up — every action gives XP; levels give coins and 🎩 hats for your robots (🛒 → Style)\n• ⚡ Skills — the more you chop/mine/build/sell, the better you get at it!\n• 🎁 Daily gift — a present every day you play\n• 🎁 Treasure chests are hidden FAR from home… send an explorer robot!"},
  {k:["skill","perk","better","chop","stronger"],a:"⚡ Skills level up slowly as your robots WORK (check 📜 → Skills):\n• 🪓 Woodcutting — chance of bonus wood per chop\n• ⛏️ Mining — chance of bonus ore\n• 🏃 Agility — all robots run a bit faster\n• 🔨 Building — chance the materials are free\n• 💰 Trading — better prices at the market\n\nEvery level is earned with real practice — just like real skills!"},
  {k:["project","workshop","challenge","mini","harder","create","publish"],a:"🏗️ Build Projects (📜 → Build Projects) are coding challenges a few levels above normal play!\n\nYou get a blueprint and a tiny block budget — the only way to fit is smart loops (even loops inside loops!). Finished builds appear near home (tap one to 🚚 Move or 🗑 Delete it).\n\n✏️ Make your OWN: paint a blueprint, set the map size 📐 and budget, use ANY blocks (loops, variables, conditions!), solve it, and 🌍 Publish it for other players to try!"},
  {k:["smart","nearest","home","pathfind"],a:"🧭 Smart blocks (unlock by earning 150 🪙 or owning 2 robots):\n• Face Nearest — auto-aims at the closest tree/rock/iron/crystal\n• Go Home — pathfinds back to base, walking around obstacles\n• Sell All — sells your bag when near the market\n• 🏦 Bank All — stores your whole bag in the Bank\n\nThe ultimate combo: Forever → Face Nearest tree → If tree ahead: Collect, else Move → If bag full: Go Home + Sell All."},
  {k:["bank","save","store","stash","deposit"],a:"🏦 The Bank is your shared storage — it never gets sold unless YOU sell it (🛒 shop).\n\n• 🏦 Bank All block stores a robot's whole bag\n• Dropping into a chest 📦 also banks it\n• Any robot can 🔨 Build using bank materials when its own bag runs short — so stockpile wood, then send a builder to raise saplings, bridges and chests from the reserve!"},
  {k:["unlock","lock","locked"],a:"🔓 You unlock powers by PLAYING:\n• 🔁 Loops — collect 5 resources\n• ❓ Logic — sell anything at the market\n• 🧭 Smart blocks — earn 150 🪙 total or own 2 robots\n\nNo lessons, no levels — just build stuff!"},
  {k:["hello","hi","hey"],a:"Hey there, world-builder! 👋 I'm Byte. Ask me about loops, selling, building… or tap 💡 Give me an idea and I'll suggest a project!"},
];
function mentorAnswer(q){
  const s=q.toLowerCase();
  if(s.includes("idea")||s.includes("what should")||s.includes("bored"))return IDEAS[Math.floor(Math.random()*IDEAS.length)];
  if(s.includes("why")&&(s.includes("not")||s.includes("n't")||s.includes("stop"))){
    const r=R();
    if(!r.program.length)return "🔍 I checked "+r.name+" — its program is EMPTY! Open 🧩 Code and add some blocks first.";
    if(!r.running)return "🔍 "+r.name+" has a program but isn't running. Press the green ▶ button!";
    if(r.blocked)return "🔍 "+r.name+" is blocked! Something is in the way (or its bag is full / nothing to collect). Try a ❓ If blocked → Turn Right block so it steers around obstacles by itself.";
    return "🔍 "+r.name+" looks fine — it's at ("+r.x+", "+r.y+") and running. Tap 🎯 to jump the camera to it! Maybe it finished its program? Use ♾️ Forever to keep it going.";
  }
  for(const e of BRAIN)if(e.k.some(k2=>s.includes(k2)))return e.a;
  return "🤔 Interesting question! I know a lot about: loops 🔁, if-logic ❓, collecting ✋, building 🔨, selling 💰, robots 🤖, Python 🐍 and speed ⚡. Try asking about one of those — or say \"give me an idea\"!";
}
let mentorFlags={};
function mentorFlag(f){
  if(mentorFlags[f])return;mentorFlags[f]=true;
  if(f==="bagFull")toast("🎒 A robot's bag is full! Sell at the market 🏪 or Drop into a chest 📦.");
  if(f==="farFromMarket")toast("💰 Sell All only works within 2 tiles of the market 🏪.");
  if(f==="tired")toast("😴 Your robot is worn out! Add a Rest 😴 block (put it in the loop so it rests as it works).");
}
function say(txt,me){
  const d=document.createElement("div");
  d.className="msg "+(me?"me":"ai");d.textContent=txt;
  $("chat").appendChild(d);$("chat").scrollTop=1e6;
}
function ask(q){
  if(!q.trim())return;
  say(q,true);
  setTimeout(()=>say(mentorAnswer(q),false),350);
}
$("askSend").addEventListener("click",()=>{ask($("askInput").value);$("askInput").value="";});
$("askInput").addEventListener("keydown",e=>{if(e.key==="Enter"){ask($("askInput").value);$("askInput").value="";}});
[["🤔 Why isn't my robot moving?","Why isn't my robot moving?"],
 ["🔁 Explain loops","Explain loops"],
 ["💰 How do I earn coins?","How do I earn coins?"],
 ["💡 Give me an idea","Give me an idea"],
 ["🐍 Show me Python","Tell me about python"],
 ["⚡ Make it faster","How can I make this faster?"]].forEach(([lbl,q])=>{
  const b=document.createElement("button");b.textContent=lbl;
  b.addEventListener("click",()=>ask(q));
  $("chips").appendChild(b);
});
$("mentorBtn").addEventListener("click",()=>{$("mentor").classList.add("open");});
$("mClose").addEventListener("click",()=>$("mentor").classList.remove("open"));
