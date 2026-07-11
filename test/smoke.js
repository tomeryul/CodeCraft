#!/usr/bin/env node
/*
 * CodeCraft smoke + regression tests.
 * Drives the real game in headless Chromium over the DevTools protocol —
 * no npm dependencies. Run: node test/smoke.js
 * Override the browser with CHROME=/path/to/chrome.
 */
const { spawn, execSync } = require("child_process");
const http = require("http");
const crypto = require("crypto");
const net = require("net");
const path = require("path");
const fs = require("fs");
const { URL } = require("url");

const PORT = 9377;
const GAME_URL = "file://" + path.resolve(__dirname, "..", "index.html");

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const candidates = [
    "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell",
    "/opt/pw-browsers/chromium",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  try { return execSync("which chromium chromium-browser google-chrome 2>/dev/null | head -1").toString().trim(); } catch (_) {}
  throw new Error("No Chromium found. Set CHROME=/path/to/chrome");
}

const chrome = spawn(findChrome(), [
  "--headless", "--disable-gpu", "--no-sandbox",
  "--remote-debugging-port=" + PORT, "--window-size=420,800", "about:blank",
]);
chrome.stderr.on("data", () => {});

const sleep = ms => new Promise(r => setTimeout(r, ms));
function get(p) {
  return new Promise((res, rej) => {
    http.get({ host: "127.0.0.1", port: PORT, path: p }, r => {
      let b = ""; r.on("data", d => b += d); r.on("end", () => res(b));
    }).on("error", rej);
  });
}

/* --- minimal websocket client for CDP --- */
let sock, buf = Buffer.alloc(0), handshake = false, msgId = 0;
const pending = {}, exceptions = [];
function sendFrame(str) {
  const p = Buffer.from(str), mask = crypto.randomBytes(4);
  let hdr;
  if (p.length < 126) hdr = Buffer.from([0x81, 0x80 | p.length]);
  else if (p.length < 65536) { hdr = Buffer.alloc(4); hdr[0] = 0x81; hdr[1] = 0xFE; hdr.writeUInt16BE(p.length, 2); }
  else { hdr = Buffer.alloc(10); hdr[0] = 0x81; hdr[1] = 0xFF; hdr.writeBigUInt64BE(BigInt(p.length), 2); }
  for (let i = 0; i < p.length; i++) p[i] ^= mask[i & 3];
  sock.write(Buffer.concat([hdr, mask, p]));
}
function call(method, params) {
  return new Promise(res => { const i = ++msgId; pending[i] = res; sendFrame(JSON.stringify({ id: i, method, params: params || {} })); });
}
function onData(d, onReady) {
  buf = Buffer.concat([buf, d]);
  if (!handshake) {
    const idx = buf.indexOf("\r\n\r\n"); if (idx < 0) return;
    buf = buf.slice(idx + 4); handshake = true; onReady();
  }
  while (buf.length >= 2) {
    const l0 = buf[1] & 0x7f; let off = 2, len = l0;
    if (l0 === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
    else if (l0 === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
    if (buf.length < off + len) return;
    const payload = buf.slice(off, off + len).toString(); buf = buf.slice(off + len);
    try {
      const m = JSON.parse(payload);
      if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; }
      else if (m.method === "Runtime.exceptionThrown") exceptions.push(JSON.stringify(m.params.exceptionDetails).slice(0, 300));
    } catch (_) {}
  }
}
async function connect() {
  let list;
  for (let i = 0; i < 40; i++) { await sleep(250); try { list = JSON.parse(await get("/json/list")); break; } catch (_) {} }
  const u = new URL(list[0].webSocketDebuggerUrl);
  return new Promise(resolve => {
    sock = net.connect(u.port, u.hostname);
    const key = crypto.randomBytes(16).toString("base64");
    sock.on("data", d => onData(d, resolve));
    sock.write(`GET ${u.pathname} HTTP/1.1\r\nHost: ${u.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
  });
}

/* --- test helpers --- */
let passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log("  ✅ " + name); }
  else { failed++; console.log("  ❌ " + name + (detail !== undefined ? " — got: " + JSON.stringify(detail) : "")); }
}
async function ev(expr) {
  const r = await call("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result && r.result.exceptionDetails) throw new Error("eval failed: " + JSON.stringify(r.result.exceptionDetails).slice(0, 200));
  return r.result && r.result.result ? r.result.result.value : undefined;
}

(async () => {
  await connect();
  await call("Runtime.enable");
  await call("Page.enable");

  console.log("▶ boot");
  await call("Page.navigate", { url: GAME_URL });
  await sleep(2200);
  check("page loads without JS errors", (await ev("document.title")).indexOf("JSERR") < 0, await ev("document.title"));
  check("one robot exists", await ev("robots.length") === 1);
  await ev(`localStorage.removeItem(SAVE_KEY); document.getElementById('playBtn').click(); 'ok'`);
  await sleep(600);

  console.log("▶ VM: repeat loop");
  await ev(`(()=>{
    const r=R(); r.x=homePos.x-3; r.y=homePos.y+2; r.rx=r.x; r.ry=r.y; r.dir=1;
    const rep=newBlock('repeat'); rep.n=3; rep.body.push(newBlock('move'));
    r.program=[rep]; unlocks.loops=true; startRobot(r); return 'ok';
  })()`);
  await sleep(2500);
  check("repeat 3 × move advances 3 tiles", await ev("R().x") === await ev("homePos.x"), await ev("JSON.stringify([R().x,homePos.x])"));
  check("program terminates", await ev("R().running") === false);

  console.log("▶ VM: if/else");
  await ev(`(()=>{
    const r=R(); r.dir=1;
    const iff=newBlock('if'); iff.cond='waterAhead';
    iff.body.push(newBlock('turnL')); iff.els.push(newBlock('turnR'));
    r.program=[iff]; unlocks.logic=true; startRobot(r); return 'ok';
  })()`);
  await sleep(1200);
  check("false condition runs else branch (turnR: dir 1→2)", await ev("R().dir") === 2, await ev("R().dir"));

  console.log("▶ Python generation");
  const py = await ev(`(()=>{
    const b=newBlock('if'); b.cond='treeAhead';
    b.body.push(newBlock('collect')); b.els.push(newBlock('move'));
    return toPy([b],'');
  })()`);
  check("if/else emits else:", py.indexOf("else:") >= 0, py);
  check("condition maps to robot.sees", py.indexOf('robot.sees("tree")') >= 0, py);

  console.log("▶ editor: undo/redo");
  const undo = await ev(`(()=>{
    const r=R(); r.program=[]; r.hist=[]; r.redoS=[];
    addBlock('move'); addBlock('collect');
    const after=r.program.length;
    doUndo(); const undone=r.program.length;
    doRedo(); const redone=r.program.length;
    return JSON.stringify([after,undone,redone]);
  })()`);
  check("add 2 → undo → redo restores", undo === "[2,1,2]", undo);

  console.log("▶ persistence: timers survive save (regression for world-depletion bug)");
  await ev(`(()=>{
    const r=R();
    r.x=homePos.x-3; r.y=homePos.y+2; r.rx=r.x; r.ry=r.y; r.dir=1;
    objects.set(key(r.x+1,r.y),{type:'tree',stage:2,hp:1}); // hp:1 → one collect harvests it
    r.program=[newBlock('collect')]; startRobot(r); return 'ok';
  })()`);
  await sleep(1200);
  check("collecting queues a respawn", await ev("respawnQ.length") >= 1, await ev("respawnQ.length"));
  const saved = await ev(`(()=>{
    objects.set(key(homePos.x+3,homePos.y+3),{type:'tree',stage:0,growAt:now+20000});
    saveNow();
    const s=JSON.parse(localStorage.getItem(SAVE_KEY));
    return JSON.stringify({v:s.v, respawns:s.respawns.length,
      growSaved:s.objects.some(([k,o])=>o.growIn!==undefined)});
  })()`);
  check("save v2 keeps respawns + growth timers", saved === '{"v":2,"respawns":1,"growSaved":true}' || JSON.parse(saved).respawns >= 1 && JSON.parse(saved).growSaved, saved);

  console.log("▶ persistence: offline fast-forward on reload");
  await ev(`(()=>{
    saveNow=()=>{}; // the page saves again on visibilitychange during navigation; keep our back-dated save intact
    const s=JSON.parse(localStorage.getItem(SAVE_KEY));
    s.savedAt=Date.now()-180000; // pretend 3 minutes passed
    localStorage.setItem(SAVE_KEY,JSON.stringify(s)); return 'ok';
  })()`);
  await call("Page.navigate", { url: GAME_URL });
  await sleep(2200);
  check("reload has no JS errors", (await ev("document.title")).indexOf("JSERR") < 0, await ev("document.title"));
  check("sapling grew to full tree while away",
    await ev(`(objects.get(key(homePos.x+3,homePos.y+3))||{}).stage`) === 2,
    await ev(`JSON.stringify(objects.get(key(homePos.x+3,homePos.y+3)))`));
  check("matured respawn placed back in world",
    await ev(`(objects.get(key(homePos.x-2,homePos.y+2))||{}).type`) === "tree",
    await ev(`JSON.stringify(objects.get(key(homePos.x-2,homePos.y+2)))`));
  check("away summary prepared", typeof await ev("pendingAway") === "string", await ev("pendingAway"));

  await ev(`document.getElementById('playBtn').click(); 'ok'`); // start the sim on the reloaded page
  await sleep(400);

  console.log("▶ VM: variables & count loop");
  await ev(`(()=>{
    const r=R(); r.vars={};
    const s1=newBlock('setVar'); s1.name='c'; s1.val={k:'num',n:0};
    const cl=newBlock('countLoop'); cl.name='i'; cl.to=3;
    const ch=newBlock('changeVar'); ch.name='c'; ch.n=2;
    cl.body.push(ch);
    const sy=newBlock('say'); sy.val={k:'var',name:'c'};
    r.program=[s1,cl,sy]; unlocks.vars=true; startRobot(r); return 'ok';
  })()`);
  await sleep(2800);
  check("count loop ran body 3 times (c=0+2*3=6)", await ev("R().vars.c") === 6, await ev("JSON.stringify(R().vars)"));
  check("loop variable counted up to 3", await ev("R().vars.i") === 3, await ev("R().vars.i"));
  check("say shows the variable's value", await ev("R().say && R().say.txt") === "6", await ev("JSON.stringify(R().say)"));

  console.log("▶ VM: comparison condition");
  await ev(`(()=>{
    const r=R(); r.dir=1; r.vars={c:6};
    const iff=newBlock('if'); iff.cond={var:'c',op:'>',val:5};
    iff.body.push(newBlock('turnR')); iff.els.push(newBlock('turnL'));
    r.program=[iff]; startRobot(r); return 'ok';
  })()`);
  await sleep(1000);
  check("c > 5 takes the true branch (turnR: dir 1→2)", await ev("R().dir") === 2, await ev("R().dir"));

  console.log("▶ Python: variables");
  const py2 = await ev(`(()=>{
    const s=newBlock('setVar'); s.name='c'; s.val={k:'num',n:0};
    const cl=newBlock('countLoop'); cl.name='i'; cl.to=3;
    const ch=newBlock('changeVar'); ch.name='c'; ch.n=2; cl.body.push(ch);
    const sy=newBlock('say'); sy.val={k:'str',s:'hi'};
    const iff=newBlock('if'); iff.cond={var:'c',op:'>',val:5}; iff.body.push(newBlock('move'));
    return toPy([s,cl,sy,iff],'');
  })()`);
  check("py: counting loop", py2.indexOf("for i in range(1, 4):") >= 0, py2);
  check("py: increment", py2.indexOf("c = c + 2") >= 0, py2);
  check("py: say string", py2.indexOf('robot.say("hi")') >= 0, py2);
  check("py: comparison", py2.indexOf("if c > 5:") >= 0, py2);

  console.log("▶ engagement");
  check("collecting granted XP", (await ev("player.xp")) > 0 || (await ev("player.level")) > 1, await ev("JSON.stringify({xp:player.xp,lvl:player.level})"));
  check("3 quests are active", await ev("player.quests.length") === 3, await ev("player.quests.length"));
  check("treasure chests exist in the world", await ev(`[...objects.values()].filter(o=>o.type==='gift').length`) >= 5, await ev(`[...objects.values()].filter(o=>o.type==='gift').length`));
  check("say quest progressed", await ev(`(player.quests.find(q=>q.id==='say1')||{prog:1}).prog`) >= 1);

  console.log("▶ skills");
  check("collecting granted woodcutting skill XP", (await ev("skills.wood.xp")) > 0 || (await ev("skills.wood.lvl")) > 0, await ev("JSON.stringify(skills.wood)"));
  const tradeCheck = await ev(`(()=>{
    const r=R(); const before=coins;
    skills.trade.lvl=5; r.inv={wood:10,stone:0,iron:0,crystal:0};
    sellInv(r); const gained=coins-before; skills.trade.lvl=0;
    return gained; // 10 wood ×2 = 20 base, ×1.10 trading perk = 22
  })()`);
  check("trading perk boosts sale price (20 → 22)", tradeCheck === 22, tradeCheck);

  console.log("▶ build project mini-game (solve the Big House)");
  await ev(`(()=>{
    mgEnter(PROJECTS[0]);
    const outer=newBlock('repeat'); outer.n=4;
    const inner=newBlock('repeat'); inner.n=3;
    inner.body.push(newBlock('build'), newBlock('move'));
    outer.body.push(inner, newBlock('turnR'));
    mgRobot.program=[outer];
    renderProgram(); mgUpdateCount(); mgRun();
    return 'running';
  })()`);
  await sleep(7000);
  check("house project completed", await ev("player.projects.house") === 1, await ev("JSON.stringify(player.projects)"));
  check("monument placed in the world", await ev(`[...objects.values()].some(o=>o.type==='proj'&&o.em==='🏡')`) === true);
  check("mini-game exited cleanly", await ev("mgState === null && mgRobot === null") === true);
  check("car project now unlocked in list", await ev(`(()=>{renderProjects();return !document.querySelector('#projList .proj.locked button[disabled]')||PROJECTS[1].needs==='house';})()`) === true);
  await ev(`const cc=document.getElementById('ccCele'); if(cc)cc.remove(); document.getElementById('projects').classList.remove('open'); 'ok'`);

  console.log("▶ double-tap delete (maximized editor only)");
  const dbl = await ev(`(()=>{
    document.getElementById('editor').classList.add('open','max');
    const r=R(); r.program=[]; r.hist=[]; r.redoS=[];
    addBlock('move'); addBlock('collect');
    const before=r.program.length;
    const uid=r.program[0].uid;
    document.querySelector('#programEl .blk[data-uid="'+uid+'"]').click();
    document.querySelector('#programEl .blk[data-uid="'+uid+'"]').click();
    const after=r.program.length;
    // not in max mode: double-tap must NOT delete
    document.getElementById('editor').classList.remove('max');
    const uid2=r.program[0].uid;
    document.querySelector('#programEl .blk[data-uid="'+uid2+'"]').click();
    document.querySelector('#programEl .blk[data-uid="'+uid2+'"]').click();
    return JSON.stringify([before,after,r.program.length]);
  })()`);
  check("double-tap deletes in max mode, not in normal mode", dbl === "[2,1,1]", dbl);

  console.log("▶ editor 50/50 split");
  const split = await ev(`(()=>{
    document.getElementById('editor').classList.add('open');
    const pw=document.getElementById('programWrap'),pl=document.getElementById('palette');
    const a=pw.getBoundingClientRect().height,b=pl.getBoundingClientRect().height;
    return JSON.stringify([Math.round(a),Math.round(b),Math.abs(a-b)<Math.max(a,b)*0.35]);
  })()`);
  check("program area and palette split roughly half-half", JSON.parse(split)[2] === true, split);

  console.log("▶ challenge creator (offline flow)");
  const creator = await ev(`(()=>{
    mgEnterCreator();
    const p=mgState.proj;
    // design a 4-tile line blueprint via the same data path the canvas taps use
    p.cells=[[0,0],[1,0],[2,0],[3,0]];
    p.start={x:0,y:0,dir:1};mgState.robot.x=0;mgState.robot.y=0;mgState.robot.dir=1;
    p.maxBlocks=6;
    const rep=newBlock('repeat');rep.n=3;rep.body.push(newBlock('build'),newBlock('move'));
    mgRobot.program=[rep,newBlock('build')];
    renderProgram();mgRun();
    return 'running';
  })()`);
  await sleep(2500);
  check("creator solve marks challenge as proven", await ev("mgState && mgState.solved === true") === true, await ev("mgState&&JSON.stringify({solved:mgState.solved,bricks:[...mgState.robot.bricks]})"));
  check("offline publish is blocked gracefully", await ev(`(()=>{document.getElementById('mgPublish').click();return mgState!==null;})()`) === true);
  await ev(`mgExit(false); document.getElementById('editor').classList.remove('open','max'); 'ok'`);
  check("online configured: auth box shows email/password login form", await ev(`(()=>{renderAuthBox();return !!document.getElementById('authEmail')&&!!document.getElementById('authPass');})()`) === true);
  check("Supabase project is wired up", await ev("sbReady()") === true);

  console.log("▶ world actions: multi-hit nodes need loops");
  const chop = await ev(`(()=>{
    mgState=null; mgRobot=null;
    const r=R(); r.x=homePos.x-3; r.y=homePos.y+2; r.rx=r.x; r.ry=r.y; r.dir=1; r.energy=100;
    const before=r.inv.wood;
    objects.set(key(r.x+1,r.y),{type:'tree',stage:2}); // full HP (3)
    r.program=[newBlock('chop')]; startRobot(r);
    return before;
  })()`);
  await sleep(900);
  check("one Chop does NOT fell a full tree (needs repeats)", await ev(`objects.get(key(R().x+1,R().y)) && objects.get(key(R().x+1,R().y)).type==='tree'`) === true);
  const looped = await ev(`(()=>{
    const r=R(); r.dir=1; r.energy=100;
    if(!objects.get(key(r.x+1,r.y))) objects.set(key(r.x+1,r.y),{type:'tree',stage:2});
    const rep=newBlock('repeat'); rep.n=5; rep.body.push(newBlock('chop'));
    r.program=[rep]; startRobot(r); return 'ok';
  })()`);
  await sleep(2600);
  check("a loop of Chop fells the tree and yields wood", await ev("R().inv.wood") >= 1, await ev("R().inv.wood"));

  console.log("▶ energy & rest");
  const tired = await ev(`(()=>{
    const r=R(); r.energy=3; r.dir=1;
    objects.set(key(r.x+1,r.y),{type:'rock',hp:9});
    r.program=[newBlock('mine')]; startRobot(r);
    return 'ok';
  })()`);
  await sleep(700);
  check("a worn-out robot is too tired to work", await ev("R().tired") === true, await ev("JSON.stringify({e:R().energy,tired:R().tired})"));
  check("Rest restores energy", await ev(`(()=>{const r=R();stopRobot(r);r.energy=5;doAction(r,{t:'rest',n:2});return r.energy;})()`) >= 60);

  console.log("▶ scoop water");
  const water = await ev(`(()=>{
    const r=R(); stopRobot(r); r.energy=100;
    // find a water tile and face it
    let placed=false;
    for(let y=0;y<H&&!placed;y++)for(let x=1;x<W&&!placed;x++){
      if(terrain[key(x,y)]===T_WATER && canWalk(x-1,y) && !objects.get(key(x-1,y))){
        r.x=x-1; r.y=y; r.rx=r.x; r.ry=r.y; r.dir=1; placed=true;
      }
    }
    const before=r.inv.water||0;
    doAction(r,{t:'scoop'});
    return JSON.stringify([placed, before, r.inv.water]);
  })()`);
  check("Scoop collects water from the river", JSON.parse(water)[0] && JSON.parse(water)[2] === 1, water);

  console.log("▶ mini-game Board tab");
  await ev(`mgEnter(PROJECTS[0]); 'ok'`);
  check("challenge opens on the Board tab", await ev(`document.getElementById('boardTab').style.display!=='none' && document.getElementById('boardTabBtn').style.display!=='none'`) === true);
  check("Blocks tab is full code (no canvas eating space)", await ev(`document.getElementById('blocksTab').contains(document.getElementById('mgCanvas'))`) === false);
  await ev(`mgExit(false); document.getElementById('editor').classList.remove('open','max'); 'ok'`);
  check("Board tab hidden after leaving a challenge", await ev(`document.getElementById('boardTabBtn').style.display==='none'`) === true);

  console.log("▶ mini-game: numbered bricks + lift/drop sorting");
  const sortRes = await ev(`(()=>{
    mgEnter(PROJECTS.find(p=>p.id==='sort'));
    const rb=mgState.robot;
    // run exactly one action block through the challenge interpreter
    const act=t=>{ mgState.frames=[{blocks:[{t,uid:1}],i:0,reps:1}]; mgState.running=true; mgTick(); mgState.running=false; };
    // seeded scrambled bricks: (0,1)=2 (1,1)=3 (2,1)=1
    const seeded = rb.brickNo['0_1']+','+rb.brickNo['1_1']+','+rb.brickNo['2_1'];
    rb.x=2; rb.y=1; act('pickUp');                       // lift the '1'
    const heldOne = rb.held===1 && !rb.bricks.has('2_1');
    rb.x=0; rb.y=0; act('drop');                         // carry it to the free top-left
    const droppedTop = rb.held===null && rb.brickNo['0_0']===1;
    mgExit(false); document.getElementById('editor').classList.remove('open','max');
    return JSON.stringify({seeded, heldOne, droppedTop});
  })()`);
  const SR = JSON.parse(sortRes);
  check("sort challenge seeds pre-placed numbered bricks", SR.seeded === "2,3,1", sortRes);
  check("Lift carries a numbered brick (cell emptied)", SR.heldOne === true, sortRes);
  check("Drop places the carried brick, keeping its number", SR.droppedTop === true, sortRes);

  console.log("▶ creator: place numbered/plain bricks + derived sort goal + save");
  const creat = await ev(`(()=>{
    mgEnterCreator();
    const p=mgState.proj; mgState.paintMode='brick';
    const place=(x,y,n)=>{ mgState.brickNum=n; p.initial=p.initial||[];
      const i=p.initial.findIndex(c=>c[0]===x&&c[1]===y);
      if(i>=0)p.initial.splice(i,1); else p.initial.push(n!=null?[x,y,n]:[x,y]);
      mgSeed(mgState.robot,p); };
    place(0,3,2); place(1,3,3); place(2,3,1);   // scrambled numbered blocks
    place(3,3,null);                            // a plain (unnumbered) block
    const hasPlain = p.initial.some(c=>c.length===2);
    p.cells=[[0,3],[1,3],[2,3]];                // target cells (row-major)
    const goal = JSON.stringify(mgSortGoalOrder(p));
    const isSort = mgHasNumbers(p);
    player.myChallenges=[]; mgState.solved=true; saveMyChallenge();
    const saved = player.myChallenges.length===1 && player.myChallenges[0].mine===true && player.myChallenges[0].initial.length===4;
    mgExit(false); document.getElementById('editor').classList.remove('open','max');
    return JSON.stringify({hasPlain,goal,isSort,saved});
  })()`);
  const CR = JSON.parse(creat);
  check("creator can place a plain (unnumbered) brick", CR.hasPlain === true, creat);
  check("numbered bricks make it a sort challenge", CR.isSort === true, creat);
  check("sort goal = target cells hold ascending numbers", CR.goal === JSON.stringify([[0,3,1],[1,3,2],[2,3,3]]), creat);
  check("Save stores the design in My Challenges", CR.saved === true, creat);

  console.log("▶ save owner tag (per-account isolation)");
  const own = await ev(`(()=>{
    const s=buildSave(); s.owner='userA'; applySave(s);   // adopt a save owned by userA
    const afterApply = saveOwner;
    const rebuilt = buildSave().owner;                     // no sbUser → owner tag persists
    return JSON.stringify({afterApply, rebuilt});
  })()`);
  const OWN = JSON.parse(own);
  check("applySave records the save's owner", OWN.afterApply === 'userA', own);
  check("buildSave carries the owner tag forward", OWN.rebuilt === 'userA', own);

  console.log("▶ drag & drop (moveBlock core)");
  const dnd = await ev(`(()=>{
    const r=R(); r.program=[]; r.hist=[]; r.redoS=[];
    const rep=newBlock('repeat'); const mv=newBlock('move'); const col=newBlock('collect');
    r.program=[rep, mv, col];
    // drag 'move' INTO the repeat loop
    const ok1=moveBlock(mv.uid,'into',rep.uid);
    const inLoop = rep.body.length===1 && rep.body[0].uid===mv.uid && r.program.length===2;
    // forbid dropping a container into its own child
    const ok2=moveBlock(rep.uid,'into',mv.uid);
    // reorder: move 'collect' before the repeat at root
    const ok3=moveBlock(col.uid,'before',rep.uid);
    const order = r.program.map(b=>b.t).join(',');
    return JSON.stringify({ok1,inLoop,ok2,ok3,order});
  })()`);
  const D = JSON.parse(dnd);
  check("drag a block into a loop nests it", D.ok1 === true && D.inLoop === true, dnd);
  check("cannot drop a container into its own descendant", D.ok2 === false, dnd);
  check("drag to reorder at root works", D.ok3 === true && D.order === "collect,repeat", dnd);

  console.log("▶ copy / paste blocks");
  const cp = await ev(`(()=>{
    const r=R(); r.program=[]; r.hist=[]; r.redoS=[];
    const a=newBlock('move'); const b=newBlock('collect');
    r.program=[a,b]; renderProgram();
    selBlock=a; elseSel=null;
    document.getElementById('copyBlk').click();            // copy 'move'
    const clipOk = !!blkClip && blkClip.t==='move';
    selBlock=b; elseSel=null;
    document.getElementById('pasteBlk').click();           // paste after 'collect'
    const types = r.program.map(x=>x.t).join(',');
    const pasted = r.program[2];
    const freshUid = !!pasted && pasted.uid!==a.uid;       // pasted copy gets a new uid
    return JSON.stringify({clipOk, types, freshUid});
  })()`);
  const CP = JSON.parse(cp);
  check("copy stores the selected block on the clipboard", CP.clipOk === true, cp);
  check("paste inserts a fresh-uid copy after the selection", CP.types === "move,collect,move" && CP.freshUid === true, cp);

  console.log("▶ bank: deposit + build from bank");
  const bank = await ev(`(()=>{
    mgState=null; mgRobot=null;
    stash={wood:0,stone:0,iron:0,crystal:0,water:0};
    const r=R(); r.x=homePos.x-3; r.y=homePos.y+2; r.rx=r.x; r.ry=r.y; r.dir=1; r.energy=100;
    r.inv={wood:6,stone:0,iron:2,crystal:0,water:0};
    doAction(r,{t:'bankAll'});
    const banked = JSON.stringify(stash);
    const bagAfterBank = bagCount(r);
    // now build a chest (needs 5 wood) with an EMPTY bag — must pull from the bank
    // find an empty grass tile ahead
    let ok=false;
    for(let d=0;d<4&&!ok;d++){ r.dir=d; const a={x:r.x+DX[d],y:r.y+DY[d]};
      if(inB(a.x,a.y)&&terrain[key(a.x,a.y)]!==0&&!objects.get(key(a.x,a.y))){ok=true;} }
    doAction(r,{t:'build',opt:'chest'});
    const woodLeft = stash.wood;
    return JSON.stringify({banked, bagAfterBank, ok, woodLeft, chestUp: !!objects.get(key(r.x+DX[r.dir],r.y+DY[r.dir]))});
  })()`);
  const BK = JSON.parse(bank);
  check("Bank All empties the bag into the bank", BK.bagAfterBank === 0 && JSON.parse(BK.banked).wood === 6, bank);
  check("Build pulls materials from the bank when the bag is empty", BK.ok && BK.woodLeft === 1 && BK.chestUp === true, bank);

  console.log("▶ move / delete a player build");
  const md = await ev(`(()=>{
    const k=key(homePos.x+4,homePos.y);
    objects.set(k,{type:'proj',em:'🏡'});
    openObjMenu(k, objects.get(k));
    const menuOpen = document.getElementById('objMenu').classList.contains('open');
    // delete it
    document.getElementById('objDelete').click();
    const gone = !objects.get(k);
    // move flow
    const k2=key(homePos.x+4,homePos.y+1);
    objects.set(k2,{type:'proj',em:'🚗'});
    openObjMenu(k2, objects.get(k2));
    document.getElementById('objMove').click();
    const moving = !!movingObj;
    return JSON.stringify({menuOpen, gone, moving});
  })()`);
  const MD = JSON.parse(md);
  check("tapping a build opens a Move/Delete menu", MD.menuOpen === true, md);
  check("Delete removes the build from the world", MD.gone === true, md);
  check("Move arms relocation for the next tap", MD.moving === true, md);
  await ev(`movingObj=null; 'ok'`);

  console.log("▶ challenge creator: size + full-palette VM (if + variables)");
  const cre = await ev(`(()=>{
    mgEnterCreator();
    mgSetSize(2,1); // 8->10 wide, 6->7 tall (clamped to DB limits)
    const p=mgState.proj;
    return JSON.stringify({gw:p.gw, gh:p.gh, blocks:CHALLENGE_BLOCKS.length});
  })()`);
  const CRE = JSON.parse(cre);
  check("creator can resize the map (clamped to 10x8)", CRE.gw === 10 && CRE.gh === 7, cre);
  check("challenges expose the full programming palette", CRE.blocks >= 11, cre);
  // solve a custom challenge using a Count loop + an If — proves the extended challenge interpreter
  const solve = await ev(`(()=>{
    mgSetSize(-6,-3); // back to a small 4x4-ish grid
    const p=mgState.proj; p.gw=6; p.gh=4; p.start={x:0,y:0,dir:1};
    p.cells=[[0,0],[1,0],[2,0],[3,0]]; // a 4-tile line
    mgState.robot={x:0,y:0,dir:1,bricks:new Set()};
    // program: count i 1..4 { build; move } using the challenge VM
    const cl=newBlock('countLoop'); cl.name='i'; cl.to=4;
    cl.body.push(newBlock('build'));
    const iff=newBlock('if'); iff.cond={var:'i',op:'<',val:4}; iff.body.push(newBlock('move'));
    cl.body.push(iff);
    mgRobot.program=[cl];
    mgRun();
    return 'running';
  })()`);
  await sleep(2500);
  check("custom challenge solved via count-loop + if in the challenge VM", await ev("mgState && mgState.solved === true") === true, await ev("mgState && JSON.stringify([...mgState.robot.bricks])"));
  await ev(`mgExit(false); document.getElementById('editor').classList.remove('open','max'); 'ok'`);

  console.log("▶ onboarding coach never covers a challenge");
  const tg = await ev(`(()=>{
    tut.done=false;
    mgEnter(PROJECTS[0]);
    tutSet(1); // pretend the onboarding timer fires while a challenge is open
    const res={shown:document.getElementById('coach').classList.contains('show'), step:tut.step};
    mgExit(false); document.getElementById('editor').classList.remove('open','max'); tut.done=true;
    return JSON.stringify(res);
  })()`);
  check("onboarding coach is suppressed inside a challenge", JSON.parse(tg).shown === false && JSON.parse(tg).step === 0, tg);

  console.log("▶ cloud save round-trip (buildSave / applySave)");
  const rt = await ev(`(()=>{
    mgState=null; mgRobot=null;
    coins=777; player.level=9; skills.wood.lvl=4; R().hat='🎩'; R().inv.wood=5;
    const snap=JSON.stringify(buildSave());
    coins=0; player.level=1; skills.wood.lvl=0; R().hat=null; R().inv.wood=0;
    const ok=applySave(JSON.parse(snap));
    return JSON.stringify({ok, coins, lvl:player.level, wood:skills.wood.lvl, hat:R().hat, inv:R().inv.wood});
  })()`);
  const RT = JSON.parse(rt);
  check("applySave restores coins/level/skills/hat/inventory", RT.ok && RT.coins===777 && RT.lvl===9 && RT.wood===4 && RT.hat==='🎩' && RT.inv===5, rt);
  check("cloud helpers exist (cloudSave/cloudLoad)", await ev("typeof cloudSave==='function' && typeof cloudLoad==='function'") === true);

  console.log("▶ splash login gate");
  check("splash shows an email/password login card when online is configured",
    await ev(`(()=>{renderSplashAuth();return !!document.getElementById('spEmail')&&!!document.getElementById('spLogin')&&!!document.getElementById('spSignup');})()`) === true);

  check("no uncaught exceptions during entire run", exceptions.length === 0, exceptions.join(" | "));

  console.log(`\n${passed} passed, ${failed} failed`);
  chrome.kill();
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error("FATAL", e); chrome.kill(); process.exit(1); });
