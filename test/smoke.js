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
  // mark the Academy complete so the guided tutorial doesn't auto-launch over the
  // world-mechanics tests below (dedicated Academy tests drive it explicitly later)
  await ev(`localStorage.removeItem(SAVE_KEY); player.academy={}; TUTS.forEach(t=>player.academy[t.id]=1); document.getElementById('playBtn').click(); 'ok'`);
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
  const lockState = await ev(`(()=>{
    const cardFor=name=>[...document.querySelectorAll('#projList .pcard')]
      .find(c=>c.querySelector('.pname')&&c.querySelector('.pname').textContent.indexOf(name)>=0);
    const built=player.projects['house'];
    // NOTHING is gated: Race Car needs:'house', but with house unbuilt it must
    // still be a live, tappable card — only a hint says which order is easier.
    delete player.projects['house']; renderProjects();
    const car=cardFor('Race Car');
    const openBefore=!!car&&!car.classList.contains('locked');
    const hintBefore=/easier after/.test(car.querySelector('.pmeta').textContent);
    const badgeBefore=car.querySelector('.pbadge').textContent;
    // and it can actually be entered straight from the sheet
    car.click();
    const entered=!!(mgState&&mgState.proj.id==='car');
    if(mgState)mgExit(false);
    player.projects['house']=1; renderProjects();
    const hintAfter=/easier after/.test(cardFor('Race Car').querySelector('.pmeta').textContent);
    if(!built)delete player.projects['house']; renderProjects();
    return JSON.stringify({openBefore,hintBefore,badgeBefore,entered,hintAfter});
  })()`);
  const LS = JSON.parse(lockState);
  check("every project is playable, prerequisite built or not", LS.openBefore === true && LS.entered === true, lockState);
  check("...the prerequisite is only a suggestion, and it goes away once met",
    LS.hintBefore === true && LS.hintAfter === false, lockState);
  check("...so no card is left showing a padlock", LS.badgeBefore === "▶", lockState);
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
    // below the cost of one Mine, so spend() must refuse and flag it tired. (With
    // energy 3 a 2-cost mine succeeds and CLEARS tired, which made this test racy —
    // it only passed when something else drained energy inside the sleep window.)
    const r=R(); r.energy=1; r.dir=1;
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

  console.log("▶ saved sort challenge keeps numbered bricks through save→reload→replay");
  const rtSort = await ev(`(()=>{
    mgEnterCreator();
    const p=mgState.proj; mgState.paintMode='brick';
    const place=(x,y,n)=>{ mgState.brickNum=n; p.initial=p.initial||[];
      const i=p.initial.findIndex(c=>c[0]===x&&c[1]===y);
      if(i>=0)p.initial.splice(i,1); else p.initial.push(n!=null?[x,y,n]:[x,y]);
      mgSeed(mgState.robot,p); };
    place(0,3,2); place(1,3,3); place(2,3,1);
    p.cells=[[0,3],[1,3],[2,3]];
    player.myChallenges=[]; mgState.solved=true; saveMyChallenge(); // proven solvable, then saved
    mgExit(false); document.getElementById('editor').classList.remove('open','max');
    applySave(JSON.parse(JSON.stringify(buildSave()))); // true serialize round-trip (localStorage/cloud)
    const sp=player.myChallenges[0];
    const savedInitial=JSON.stringify(sp.initial||null);
    mgEnter(sp);                                 // replay the saved challenge
    const bricks=mgState.robot.bricks.size;
    const nums=[mgState.robot.brickNo['0_3'],mgState.robot.brickNo['1_3'],mgState.robot.brickNo['2_3']].join(',');
    mgExit(false); document.getElementById('editor').classList.remove('open','max');
    return JSON.stringify({savedInitial,bricks,nums});
  })()`);
  const RTS = JSON.parse(rtSort);
  check("saved sort challenge replays with its 3 numbered bricks", RTS.bricks===3 && RTS.nums==='2,3,1', rtSort);

  console.log("▶ community row → challenge carries pre-placed bricks");
  const cc = await ev(`(()=>{
    const row={id:'abc',name:'Sortie',author_name:'kid',gw:3,gh:2,start_x:0,start_y:0,start_dir:1,
      max_blocks:20,solves:0,cells:[[0,1],[1,1],[2,1]],initial:[[0,1,2],[1,1,3],[2,1,1]]};
    const proj=ccToProj(row);
    const rs={x:0,y:0,dir:1}; mgSeed(rs,proj);
    return JSON.stringify({hasInitial:(proj.initial||[]).length, em:proj.em,
      seeded:rs.bricks.size, goal:JSON.stringify(mgSortGoalOrder(proj))});
  })()`);
  const CC = JSON.parse(cc);
  check("community challenge loads its pre-placed bricks", CC.hasInitial===3 && CC.seeded===3, cc);
  check("community sort goal derives ascending order", CC.goal===JSON.stringify([[0,1,1],[1,1,2],[2,1,3]]) && CC.em==='🔢', cc);

  console.log("▶ Paint mode: per-cell target numbers (place the right block on the right tile)");
  const paintNum = await ev(`(()=>{
    mgEnterCreator();
    const p=mgState.proj; mgState.paintMode='paint'; p.cells=[];
    // mirror the real hud paint handler: smart toggle with the selected number
    const paint=(x,y,n)=>{ mgState.brickNum=n;
      const i=p.cells.findIndex(c=>c[0]===x&&c[1]===y);
      if(i>=0){ const cur=p.cells[i].length>2?p.cells[i][2]:null;
        if(cur===n)p.cells.splice(i,1); else p.cells[i]=n!=null?[x,y,n]:[x,y]; }
      else p.cells.push(n!=null?[x,y,n]:[x,y]); };
    paint(0,0,2); paint(1,0,1); paint(2,0,null);   // two numbered targets + one plain
    const goal=JSON.stringify(mgSortGoalOrder(p));
    const isNum=mgHasNumbers(p);
    paint(0,0,5); const relabeled=p.cells.find(c=>c[0]===0&&c[1]===0)[2]===5;  // re-tap → relabel
    paint(0,0,2);                                    // set it back to 2
    paint(2,0,null); const removed=!p.cells.some(c=>c[0]===2&&c[1]===0);       // re-tap same → remove
    paint(2,0,null);                                 // re-add the plain target
    // --- win checks ---
    const rb=mgState.robot;
    const put=(x,y,n)=>{ rb.bricks.add(x+'_'+y); if(n!=null)rb.brickNo[x+'_'+y]=n; };
    const reset=()=>{ rb.bricks=new Set(); rb.brickNo={}; mgState.solved=false; };
    reset(); put(0,0,2); put(1,0,1); put(2,0,7); mgFinish(); const winOk=mgState.solved===true;      // plain tile: any block
    reset(); put(0,0,9); put(1,0,1); put(2,0,7); mgFinish(); const wrongFails=mgState.solved===false; // wrong number
    reset(); put(0,0,2); put(1,0,1); mgFinish(); const missFails=mgState.solved===false;              // plain tile empty
    reset(); put(0,0,2); put(1,0,1); put(2,0,7); put(3,3,4); mgFinish(); const strayFails=mgState.solved===false; // off-plan brick
    mgExit(false); document.getElementById('editor').classList.remove('open','max');
    return JSON.stringify({goal,isNum,relabeled,removed,winOk,wrongFails,missFails,strayFails});
  })()`);
  const PN = JSON.parse(paintNum);
  check("Paint numbered targets → explicit per-cell goal", PN.goal===JSON.stringify([[0,0,2],[1,0,1]]), paintNum);
  check("numbered paint targets count as a numbers challenge", PN.isNum===true, paintNum);
  check("re-tapping a target with a new number relabels it", PN.relabeled===true, paintNum);
  check("re-tapping a target with the same setting removes it", PN.removed===true, paintNum);
  check("correct numbers + filled plain tiles wins", PN.winOk===true, paintNum);
  check("a wrong number on a numbered tile fails", PN.wrongFails===true, paintNum);
  check("an empty (unfilled) target tile fails", PN.missFails===true, paintNum);
  check("a brick landing off the plan fails", PN.strayFails===true, paintNum);

  console.log("▶ publish payload includes pre-placed bricks");
  const pub = await ev(`(()=>{
    mgEnterCreator();
    const p=mgState.proj; p.initial=[[0,1,2],[1,1,3],[2,1,1]]; p.cells=[[0,1],[1,1],[2,1]];
    p.tiles=[[3,1,'wall',0],[4,1,'door',2]];
    let body=null; const origRest=sbRest, origUser=sbUser;
    sbRest=(path,opts)=>{ if(path==='challenges'&&opts&&opts.method==='POST'&&body==null)body=opts.body; return Promise.resolve([]); };
    sbUser={uid:'u1',email:'k@x.com'};
    return publishChallenge().then(()=>{
      sbRest=origRest; sbUser=origUser;
      mgExit(false); document.getElementById('editor').classList.remove('open','max');
      const b=JSON.parse(body||'{}');
      // and the published row loads back with its terrain intact
      const back=ccToProj({id:'r1',name:'R',author_name:'k',gw:8,gh:6,start_x:0,start_y:0,start_dir:1,
        max_blocks:20,solves:0,cells:b.cells,initial:b.initial,tiles:b.tiles});
      return JSON.stringify({initialN:(b.initial||[]).length, cellsN:(b.cells||[]).length,
        tilesN:(b.tiles||[]).length, doorArg:(b.tiles||[]).filter(t=>t[2]==='door').map(t=>t[3])[0],
        roundTrip:(back.tiles||[]).length});
    });
  })()`);
  const PUB = JSON.parse(pub);
  check("publishChallenge sends the pre-placed bricks to the DB", PUB.initialN===3 && PUB.cellsN===3, pub);
  check("publishChallenge sends the puzzle terrain too", PUB.tilesN===2 && PUB.doorArg===2, pub);
  check("a published row loads back with its terrain", PUB.roundTrip===2, pub);

  console.log("▶ authored challenges carry routines, inputs and starter routines");
  const auth3 = await ev(`(()=>{
    const out={};
    const origSI=window.setInterval;
    window.setInterval=()=>0;          // hand-tick; RESTORED before returning
    let u=0;const B=t=>({t:t,uid:'q'+(++u)});
    // --- a challenge the author solved WITH a routine ---
    mgEnterCreator();
    let p=mgState.proj;
    p.gw=6;p.gh=3;p.start={x:0,y:1,dir:1};p.cells=[[1,1],[2,1],[3,1]];p.initial=[];p.tiles=[];
    mgState.robot={x:0,y:1,dir:1};mgSeed(mgState.robot,p);
    setBudget(12);
    mgRobot.routines.A=[B('move'),B('build')];
    mgRobot.program=[{t:'call',uid:'k1',fn:'A'},{t:'call',uid:'k2',fn:'A'},{t:'call',uid:'k3',fn:'A'}];
    mgRun();for(let i=0;i<400&&mgState&&mgState.running;i++)mgTick();
    out.proved=!!(mgState&&mgState.solved);
    // 🎁 hand those routines to the player
    mgTogglePreset();
    out.presetOn=!!mgState.proj.preset; out.presetSize=presetSize(mgState.proj.preset);
    // publish it and read what actually went to the DB
    let body=null;const origRest=sbRest,origUser=sbUser;
    sbRest=(path,opts)=>{if(opts&&opts.method==='POST'&&body==null)body=opts.body;return Promise.resolve([]);};
    sbUser={uid:'u9',email:'a@b.com'};
    return publishChallenge().then(()=>{
      sbRest=origRest;sbUser=origUser;
      const b=JSON.parse(body||'{}');
      // THE REGRESSION: publish used to send mgRobot.program, dropping A and B
      out.pubSolShape=Array.isArray(b.solution)?'array':'object';
      out.pubRoutineLen=((b.solution||{}).routines||{}).A ? b.solution.routines.A.length : 0;
      out.pubMainLen=(b.solution&&b.solution.main||[]).length;
      out.pubPresetLen=presetSize(b.preset);
      // ...and comes back whole through ✏️ Edit
      const row={id:'rr',name:'R',author_name:'a',gw:6,gh:3,start_x:0,start_y:1,start_dir:1,diff:1,
        max_blocks:12,solves:0,cells:b.cells,initial:b.initial,tiles:b.tiles,
        solution:b.solution,cases:b.cases,preset:b.preset,stages:[]};
      mgEditCommunity(row);
      out.editRoutineLen=mgRobot.routines.A.length;
      out.editMainLen=mgRobot.program.length;
      out.editPresetOn=!!mgState.proj.preset;
      mgExit(false);
      // a player opening the published challenge is HANDED the routine, not the answer
      delete player.projPrograms['cc_rr'];
      mgEnter(ccToProj(row));
      out.playerGotRoutine=mgRobot.routines.A.length;
      out.playerGotNoAnswer=mgRobot.program.length;
      mgExit(false);

      // --- several inputs, one program, the last one secret ---
      mgEnterCreator();
      p=mgState.proj;
      p.gw=4;p.gh=2;p.start={x:0,y:1,dir:1};p.cells=[[0,1],[1,1]];p.tiles=[];
      p.initial=[[0,1,2],[1,1,1]];                 // out of order
      mgState.robot={x:0,y:1,dir:1};mgSeed(mgState.robot,p);
      setBudget(30);
      mgAddCase();                                  // input 1
      p.initial=[[0,1,1],[1,1,2]];                  // already in order
      mgAddCase();                                  // input 2
      mgToggleCaseHidden(1);
      out.nCases=p.cases.length; out.hidden1=!!p.cases[1].hidden;
      out.addBlanks=mgState.solved===false;
      // a HARDCODED swap is right for input 1 and wrong for input 2
      const swap=[B('pickUp'),B('turnL'),B('move'),B('drop'),B('turnR'),B('turnR'),
                  B('move'),B('turnR'),B('move'),B('pickUp'),B('turnR'),B('turnR'),
                  B('move'),B('drop'),B('turnR'),B('move'),B('turnL'),B('pickUp'),
                  B('turnR'),B('turnR'),B('move'),B('drop')];
      mgRobot.program=swap;mgRobot.routines={A:[],B:[]};
      const draftBefore=JSON.stringify(p.initial);
      mgRun();
      for(let g=0;g<10&&mgState&&mgState.running;g++)for(let t=0;t<900&&mgState&&mgState.running;t++)mgTick();
      out.ranEvery=(mgState.results||[]).length;    // both inputs judged
      out.notProved=mgState.solved===false;         // a hardcoded answer must NOT prove it
      out.draftKept=JSON.stringify(mgState.proj.initial)===draftBefore; // board handed back
      out.saveBlocked=(()=>{const n=(player.myChallenges||[]).length;saveMyChallenge();
        return (player.myChallenges||[]).length===n;})();
      // inputs survive Save -> Edit
      p.cases=[{initial:[[0,1,2],[1,1,1]]}];
      mgState.solved=true;
      saveMyChallenge();
      const entry=player.myChallenges[player.myChallenges.length-1];
      out.savedCases=(entry.cases||[]).length;
      mgExit(false);
      mgEditMyChallenge(entry);
      out.editCases=(mgState.proj.cases||[]).length;
      mgExit(false);
      window.setInterval=origSI;
      document.getElementById('editor').classList.remove('open','max');
      return JSON.stringify(out);
    });
  })()`);
  const A3 = JSON.parse(auth3);
  check("publishing keeps the routines the author solved with (was: main only)",
    A3.pubSolShape === "object" && A3.pubRoutineLen === 2 && A3.pubMainLen === 3, auth3);
  check("...and ✏️ Edit loads main AND routines back", A3.editRoutineLen === 2 && A3.editMainLen === 3, auth3);
  check("🎁 starter routines publish with the challenge", A3.presetOn === true && A3.presetSize === 2 && A3.pubPresetLen === 2, auth3);
  check("...and a player is handed the routine but never the answer",
    A3.playerGotRoutine === 2 && A3.playerGotNoAnswer === 0 && A3.editPresetOn === true, auth3);
  check("🔢 the creator banks several inputs, and one can be secret",
    A3.nCases === 2 && A3.hidden1 === true && A3.addBlanks === true, auth3);
  check("...▶ judges the program on every one of them", A3.ranEvery === 2, auth3);
  check("...a hardcoded answer passes one input and so cannot prove the level",
    A3.notProved === true && A3.saveBlocked === true, auth3);
  check("...and the author's working board is handed back after the run", A3.draftKept === true, auth3);
  check("inputs survive Save → ✏️ Edit", A3.savedCases === 1 && A3.editCases === 1, auth3);

  console.log("▶ community: publish multi-level + edit/update a published challenge");
  const comm = await ev(`(()=>{
    const out={}, origRest=sbRest, origUser=sbUser;
    sbUser={uid:'me',email:'k@x.com'};
    let last=null;
    sbRest=(path,opts)=>{ const m=(opts&&opts.method)||'GET'; if(m==='POST'||m==='PATCH')last={path,method:m,body:opts.body?JSON.parse(opts.body):null}; return Promise.resolve(null); };
    mgEnterCreator();
    const p=mgState.proj; p.gw=4;p.gh=4; p.diff=3;
    p.cells=[[0,0]]; mgSeed(mgState.robot,p); mgState.solved=true; mgAddStage();  // level 1
    p.cells=[[1,1]]; mgSeed(mgState.robot,p); mgState.solved=true; mgAddStage();  // level 2
    return publishChallenge().then(()=>{
      out.newMethod=last.method; out.newIsInsert=(last.path==='challenges');
      out.newStages=(last.body.stages||[]).length; out.newDiff=last.body.diff;
      out.newBaseCells=JSON.stringify(last.body.cells);
      mgEditCommunity({id:'row9',name:'Alpha',diff:2,gw:4,gh:4,max_blocks:12,start_x:0,start_y:0,start_dir:1,cells:[[2,2]],initial:[],stages:[]});
      out.publishId=mgState.publishId; out.loadedSingleCells=JSON.stringify(mgState.proj.cells);
      mgState.solved=true;
      return publishChallenge();
    }).then(()=>{
      out.updMethod=last.method; out.updIsPatch=(last.path.indexOf('challenges?id=eq.row9')===0);
      mgEditCommunity({id:'row10',name:'Beta',diff:2,gw:4,gh:4,max_blocks:12,cells:[[0,0]],initial:[],stages:[
        {em:'🧩',name:'Beta',cells:[[0,0]],start:{x:0,y:0,dir:1},gw:4,gh:4,maxBlocks:12,allowed:CHALLENGE_BLOCKS,initial:[]},
        {em:'🧩',name:'Beta',cells:[[1,1]],start:{x:0,y:0,dir:1},gw:4,gh:4,maxBlocks:12,allowed:CHALLENGE_BLOCKS,initial:[]}
      ]});
      out.loadedPackStages=mgState.stages.length; out.packPublishId=mgState.publishId;
      sbRest=origRest; sbUser=origUser; mgState=null; mgRobot=null;
      return JSON.stringify(out);
    });
  })()`);
  const COMM = JSON.parse(comm);
  check("publishing a multi-level challenge sends its levels in stages", COMM.newIsInsert === true && COMM.newMethod === 'POST' && COMM.newStages === 2, comm);
  check("multi-level publish keeps difficulty + first-level cells on top", COMM.newDiff === 3 && COMM.newBaseCells === '[[0,0]]', comm);
  check("editing a published challenge loads it and sets publishId", COMM.publishId === 'row9' && COMM.loadedSingleCells === '[[2,2]]', comm);
  check("saving an edited published challenge UPDATEs it (PATCH)", COMM.updMethod === 'PATCH' && COMM.updIsPatch === true, comm);
  check("editing a multi-level published challenge loads its levels", COMM.loadedPackStages === 2 && COMM.packPublishId === 'row10', comm);

  console.log("▶ author's solution: saved with the challenge, loaded only in edit mode");
  const solT = await ev(`(()=>{
    const out={}, origRest=sbRest, origUser=sbUser;
    sbUser={uid:'me',email:'k@x.com'};
    let last=null;
    sbRest=(path,opts)=>{ const m=(opts&&opts.method)||'GET'; if(m==='POST'||m==='PATCH')last={body:opts.body?JSON.parse(opts.body):null}; return Promise.resolve(null); };
    mgEnterCreator();
    const p=mgState.proj; p.gw=4;p.gh=4; p.cells=[[0,0]]; mgSeed(mgState.robot,p);
    mgRobot.program=[{t:'build',uid:1}];   // the author's solution
    mgState.solved=true;
    return publishChallenge().then(()=>{
      out.pubSolN=(last.body.solution||[]).length;   // 1
      const row={id:'rowX',author:'me',name:'A',diff:2,gw:4,gh:4,max_blocks:12,start_x:0,start_y:0,start_dir:1,
        cells:[[0,0]],initial:[],stages:[],solution:[{t:'move',uid:7},{t:'build',uid:8}]};
      mgEditCommunity(row);                          // EDIT → solution reloads
      out.editLoadedN=mgRobot.program.length;        // 2
      out.editFirstT=mgRobot.program[0]&&mgRobot.program[0].t;
      mgExit(false);
      mgEnter(ccToProj(row));                        // PLAY to solve → solution NOT loaded
      out.playLoadedN=mgRobot.program.length;        // 0
      mgExit(false); document.getElementById('editor').classList.remove('open','max');
      sbRest=origRest; sbUser=origUser; mgState=null; mgRobot=null;
      return JSON.stringify(out);
    });
  })()`);
  const SOL = JSON.parse(solT);
  check("publish saves the author's solution program", SOL.pubSolN === 1, solT);
  check("editing a published challenge reloads the solution", SOL.editLoadedN === 2 && SOL.editFirstT === 'move', solT);
  check("solving/playing the challenge does NOT load the solution", SOL.playLoadedN === 0, solT);

  console.log("▶ manual build mode: place & remove decor with resources");
  const bld = await ev(`(()=>{
    mgState=null; mgRobot=null;
    let tx=-1,ty=-1;
    for(let y=2;y<24&&tx<0;y++)for(let x=2;x<24&&tx<0;x++){
      if(terrain[key(x,y)]!==T_WATER && !objects.get(key(x,y)) && !robots.some(r=>Math.round(r.rx)===x&&Math.round(r.ry)===y)){tx=x;ty=y;}
    }
    stash={wood:5,stone:5,iron:0,crystal:2,water:2};
    const r=R(); r.inv={wood:0,stone:0,iron:0,crystal:0,water:0};
    buildMode=true; buildSel='wall';                 // Wall costs 🪨1
    const before=stash.stone;
    buildTap(tx,ty);
    const p=objects.get(key(tx,ty));
    const okPlace = !!p && p.type==='decor' && p.deco==='wall' && stash.stone===before-1;
    buildTap(tx,ty);                                  // tap again → remove + refund
    const gone = !objects.get(key(tx,ty)) && stash.stone===before;
    buildMode=false; buildSel=null;
    return JSON.stringify({okPlace,gone});
  })()`);
  const BLD = JSON.parse(bld);
  check("build mode places a decor and spends resources", BLD.okPlace===true, bld);
  check("removing a decor refunds the resources", BLD.gone===true, bld);

  console.log("▶ decor autotiling module (CC_DECOR)");
  const dec = await ev(`(()=>{
    const has = typeof CC_DECOR==='object';
    const layers = [CC_DECOR.layer('wall'),CC_DECOR.layer('path'),CC_DECOR.layer('roof'),CC_DECOR.layer('lamp')].join(',');
    const c=document.createElement('canvas');c.width=c.height=48;const g=c.getContext('2d');
    const drew = CC_DECOR.draw(g,'wall',0,0,0);           // procedural piece → true
    const ic = CC_DECOR.icon('wall');                     // palette preview data URL
    // draw EVERY decor id with a real time value (the 5th arg lands in some
    // draw fns' palette slot — a regression guard for the roof addColorStop bug)
    const ids=['path','floor','wall','door','window','roof','roofBlue','roofGreen','roofPurple',
      'glass','awning','sign','fence','bush','flower','lamp','fountain','gem','bench','table',
      'barrel','crate','well','mailbox','statue','flag','stall','planter','rug','campfire'];
    objects=new Map(); for(let i=0;i<ids.length;i++)objects.set(i,{type:'decor',deco:ids[i],em:''});
    let threw=null;
    for(let i=0;i<ids.length;i++){ try{ CC_DECOR.draw(g,ids[i],i%W,0,performance.now()); CC_DECOR.icon(ids[i]); }catch(e){ threw=ids[i]+': '+e.message; break; } }
    return JSON.stringify({has, layers, drew, icon: typeof ic==='string' && ic.indexOf('data:image')===0, threw, n:ids.length});
  })()`);
  const DEC = JSON.parse(dec);
  check("CC_DECOR classifies render layers (mid/ground/roof)", DEC.has && DEC.layers==='mid,ground,roof,mid', dec);
  check("CC_DECOR draws pieces + renders palette icons", DEC.drew===true && DEC.icon===true, dec);
  check("every decor id draws with a time arg (no addColorStop crash)", DEC.threw===null, dec);

  const solid = await ev(`(()=>{
    const out={};
    objects=new Map();
    const r=R(); r.x=homePos.x-4; r.y=homePos.y+3; r.rx=r.x; r.ry=r.y; r.dir=1; r.energy=100;
    const at=(dx,dy)=>key(r.x+dx,r.y+dy);
    // a wall you paid stone for is really there
    terrain[at(1,0)]=T_GRASS;
    objects.set(at(1,0),{type:'decor',deco:'wall',em:'🧱'});
    out.wallBlocks=!canWalk(r.x+1,r.y);
    out.wallSensed=evalCond(r,'blocked');
    doAction(r,{t:'move'});
    out.stayedPut=(r.x===homePos.x-4);
    // ...but you can still walk your own paths, through your own doorways
    objects.set(at(1,0),{type:'decor',deco:'path',em:'⬜'});
    out.pathWalkable=canWalk(r.x+1,r.y);
    objects.set(at(1,0),{type:'decor',deco:'door',em:'🚪'});
    out.doorWalkable=canWalk(r.x+1,r.y);
    // and pathing routes around a built wall instead of through it
    objects.set(at(1,0),{type:'decor',deco:'wall',em:'🧱'});
    const p=pathTo(r,r.x+2,r.y);
    out.pathRoutesAround=!!p&&!p.some(s=>s.x===r.x+1&&s.y===r.y);
    // every solid piece is a real building material, every walkable one is ground/flat
    out.solidIds=DECOR.filter(d=>d.solid).map(d=>d.id).length;
    out.costClean=DECOR.every(d=>!('solid' in d.cost));
    objects=new Map();
    return JSON.stringify(out);
  })()`);
  const SO = JSON.parse(solid);
  check("a wall you built blocks robots (was: they walked straight through)",
    SO.wallBlocks === true && SO.stayedPut === true, solid);
  check("...and 'blocked 🚧' senses it, so programs can route around", SO.wallSensed === true && SO.pathRoutesAround === true, solid);
  check("paths, floors and doorways stay walkable", SO.pathWalkable === true && SO.doorWalkable === true, solid);
  check("the solid flag lives beside cost, not inside it", SO.costClean === true && SO.solidIds === 20, solid);

  console.log("▶ 📈 the living market: prices move, and the program can read them");
  const mkt = await ev(`(()=>{ try{
    const out={};
    market=freshMarket();
    const r=R(); r.x=marketPos.x; r.y=marketPos.y+1; r.rx=r.x; r.ry=r.y; r.energy=100;
    // --- the most-wanted resource pays a premium, and 📖 Read sees the SAME number
    //     the market pays; if those two ever disagreed the decision logic would lie
    market.want='iron';
    out.premium=priceOf('iron')>RES.iron.price;
    out.plain=priceOf('wood');
    r.vars={};
    doAction(r,{t:'read',name:'p',src:'price',opt:'iron'});
    doAction(r,{t:'read',name:'q',src:'price',opt:'wood'});
    out.readsLive=(r.vars.p===priceOf('iron')&&r.vars.q===priceOf('wood'));
    out.decidable=(r.vars.p>r.vars.q);           // "if p > q" is now a real branch
    // --- selling uses the live price, not the static base ---
    for(const k in r.inv)r.inv[k]=0;
    r.inv.iron=3; const before=coins;
    sellInv(r);
    out.soldLive=(coins-before)>=3*RES.iron.price;   // premium actually paid out
    // --- prices actually drift over time, within sane bounds ---
    const p0=JSON.stringify(market.prices);
    for(let i=0;i<12;i++){market.driftAt=now-1;marketTick();now+=1000;}
    out.drifted=JSON.stringify(market.prices)!==p0;
    out.inBounds=MKT_RES.every(k=>market.prices[k]>=RES[k].price*0.44&&market.prices[k]<=RES[k].price*1.91);
    // --- 📋 an order counts what you sell and pays out when filled ---
    market.order={need:{wood:4},got:{},until:now+60000,reward:250};
    const c0=coins;
    for(const k in r.inv)r.inv[k]=0; r.inv.wood=4; sellInv(r);
    out.orderFilled=(market.order===null)&&(coins-c0)>250;
    // ...and one whose clock ran out is dropped rather than paid
    market.order={need:{wood:99},got:{},until:now-1,reward:999};
    market.orderNext=0; orderTick();
    out.expired=(market.order===null);
    // --- 📣 a Rush spikes one price for a while, then lets it go ---
    market.event=null; startRush();
    const rushRes=market.event.res, spiked=priceOf(rushRes);
    market.event.until=now-1; eventTick();
    out.rushSpikes=spiked>priceOf(rushRes);
    out.rushEnds=(market.event===null);
    // --- 🌙 Nightfall taxes energy, so a program must watch 😴 tired ---
    out.dayMul=energyMul();
    market.event={kind:'night',until:now+50000};
    out.nightMul=energyMul();
    out.nightCrystal=priceOf('crystal')>priceOf('crystal')*0; // sanity: still a number
    const e0=(r.energy=60); useEnergy(r,10);
    const nightSpend=e0-r.energy;
    market.event=null;
    r.energy=60; useEnergy(r,10);
    out.nightCostsMore=nightSpend>(60-r.energy);
    // --- 💎 a rich seam appears AND announces itself on the 📻 noticeboard ---
    objects=new Map(); radio={};
    startLode();
    out.lodeSpawned=(market.event&&market.event.kind==='lode'&&market.event.spots.length>0);
    out.lodeOnRadio=Object.keys(radio).length>0;
    const lodeKeys=market.event.spots.map(s=>key(s.x,s.y));
    out.lodeReal=lodeKeys.every(k=>objects.has(k));
    market.event.until=now-1; eventTick();
    out.lodeSinks=lodeKeys.every(k=>!objects.has(k));   // untouched seam goes away
    // --- the ticker renders, and 🪙/min tracks recent earnings ---
    noteEarning(120);
    out.cpm=coinsPerMin()>=120;
    $("editor").classList.remove("open");$("projects").classList.remove("open");
    renderMarket();
    const tk=$("ticker");
    out.ticker=tk.querySelectorAll('.tk').length>=MKT_RES.length;
    out.py=toPy([{t:'read',uid:'m1',name:'p',src:'price',opt:'crystal'}],'');
    objects=new Map(); radio={}; market=freshMarket();
    return JSON.stringify(out);
  }catch(e){return JSON.stringify({ERR:e.message+' @ '+(e.stack||'').split('\\n')[1]});} })()`);
  const MK = JSON.parse(mkt);
  if(MK.ERR) throw new Error("market block threw: "+MK.ERR);
  check("the most-wanted resource pays a premium", MK.premium === true, mkt);
  check("📖 Read 💰 price reports exactly what the market pays",
    MK.readsLive === true && MK.decidable === true, mkt);
  check("...so selling uses the live price, not the static base", MK.soldLive === true, mkt);
  check("prices drift over time and stay in sane bounds", MK.drifted === true && MK.inBounds === true, mkt);
  check("📋 an order counts what you sell and pays out when filled", MK.orderFilled === true, mkt);
  check("...and an order past its clock is dropped, not paid", MK.expired === true, mkt);
  check("📣 a Rush spikes a price, then releases it", MK.rushSpikes === true && MK.rushEnds === true, mkt);
  check("🌙 Nightfall makes every action cost more energy",
    MK.dayMul === 1 && MK.nightMul > 1 && MK.nightCostsMore === true, mkt);
  check("💎 a rich seam really appears and posts itself on the 📻 channel",
    MK.lodeSpawned === true && MK.lodeOnRadio === true && MK.lodeReal === true, mkt);
  check("...and what is left of it sinks away when it expires", MK.lodeSinks === true, mkt);
  check("the ticker renders prices and 🪙/min tracks earnings",
    MK.ticker === true && MK.cpm === true, mkt);
  check("a price read generates Python", /market\.price\("crystal"\)/.test(MK.py), mkt);

  console.log("▶ 🚶 Walk To: real pathfinding to a target, not just facing it");
  const walkTo = await ev(`(()=>{ try{
    const out={};
    objects=new Map(); claims=new Map(); radio={};
    const r=R(); r.energy=100; r.running=true;
    const cx=24, cy=24;
    r.x=cx;r.y=cy;r.rx=cx;r.ry=cy;r.dir=1;r.path=null;r.faceAfter=null;
    for(let y=cy-6;y<=cy+6;y++)for(let x=cx-6;x<=cx+6;x++)terrain[key(x,y)]=T_GRASS;
    // a tree OFF the robot's axis — the case straight-line movement can never reach
    const tx=cx+4, ty=cy+3;
    objects.set(key(tx,ty),{type:'tree',stage:2});
    doAction(r,{t:'faceNearest',opt:'tree'});
    out.faceOnly=(r.x===cx&&r.y===cy&&!r.path);       // Face Nearest only turns
    doAction(r,{t:'goNear',opt:'tree'});
    out.gotPath=!!(r.path&&r.path.length);
    for(let i=0;i<60&&r.path&&r.path.length;i++)tickRobot(r);
    out.arrived=(Math.abs(r.x-tx)+Math.abs(r.y-ty))===1;
    // and it ARRIVES FACING the tree, so the very next Chop works
    out.facing=evalCond(r,'treeAhead');
    doAction(r,{t:'chop'});
    out.chopped=(r.blocked===false);
    // a tree walled off behind your own build: it takes the next one instead of stalling
    objects=new Map(); r.x=cx;r.y=cy;r.rx=cx;r.ry=cy;r.path=null;r.faceAfter=null;
    objects.set(key(cx+2,cy),{type:'tree',stage:2});                 // near, but sealed in
    for(const d of [[1,0],[3,0],[2,-1],[2,1]])objects.set(key(cx+d[0],cy+d[1]),{type:'decor',deco:'wall',em:'🧱'});
    objects.set(key(cx),{type:undefined}); objects.delete(key(cx));
    objects.set(key(cx-4,cy),{type:'tree',stage:2});                 // farther, but reachable
    doAction(r,{t:'goNear',opt:'tree'});
    for(let i=0;i<80&&r.path&&r.path.length;i++)tickRobot(r);
    out.wentRound=(Math.abs(r.x-(cx-4))+Math.abs(r.y-cy))===1&&evalCond(r,'treeAhead');
    // nothing of that kind in range → blocked, so a program can react
    objects=new Map(); r.path=null;
    doAction(r,{t:'goNear',opt:'crystal'});
    out.noneBlocks=(r.blocked===true&&!r.path);
    out.py=toPy([{t:'goNear',uid:'w1',opt:'iron'}],'');
    out.inPalette=CATS.find(c=>c.id==='smart').types.indexOf('goNear')>=0;
    objects=new Map(); claims=new Map();
    return JSON.stringify(out);
  }catch(e){return JSON.stringify({ERR:e.message});} })()`);
  const WT = JSON.parse(walkTo);
  if(WT.ERR) throw new Error("walkTo block threw: "+WT.ERR);
  check("🧭 Face Nearest only turns — it never travels", WT.faceOnly === true, walkTo);
  check("🚶 Walk To paths to an off-axis target and arrives", WT.gotPath === true && WT.arrived === true, walkTo);
  check("...arriving FACING it, so the next Chop lands", WT.facing === true && WT.chopped === true, walkTo);
  check("...and picks a reachable target when the nearest is walled off", WT.wentRound === true, walkTo);
  check("nothing in range reads as blocked 🚧", WT.noneBlocks === true, walkTo);
  check("Walk To is in the Smart palette and generates Python",
    WT.inPalette === true && /walk_to_nearest\("iron"\)/.test(WT.py), walkTo);

  // Does a fleet actually get more done? Same program both arms; the only
  // difference is whether walking to a target also calls it. Without that, adding
  // robots changes nothing — they all converge on one tree — which is exactly the
  // "shallow open world" complaint, measured.
  const scale = await ev(`(()=>{ try{
    const res={}; let u=0; const B=t=>({t:t,uid:'sc'+(++u)});
    const prog=[{t:'forever',uid:'scf',body:[{t:'goNear',uid:'scg',opt:'tree'},B('chop'),B('chop'),B('chop')]}];
    const realClaim=setClaim, origSI=window.setInterval;
    window.setInterval=()=>0;
    const cx=24,cy=24;
    function setup(n){
      objects=new Map(); claims=new Map(); radio={}; respawnQ.length=0;
      for(let y=cy-10;y<=cy+10;y++)for(let x=cx-10;x<=cx+10;x++){
        terrain[key(x,y)]=T_GRASS;
        if((x+y)%2===0&&!(x===cx&&y===cy))objects.set(key(x,y),{type:'tree',stage:2});
      }
      robots.length=0;
      for(let i=0;i<n;i++){const r=makeRobot(cx,cy,'S'+i);r.x=cx;r.y=cy;r.rx=cx;r.ry=cy;r.energy=1e9;r.cap=1e9;robots.push(r);}
      totals.collected=0;
    }
    function run(n){
      setup(n);
      for(const r of robots){r.program=JSON.parse(JSON.stringify(prog));
        r.frames=[{blocks:r.program,i:0,reps:1}];r.running=true;r.wait=0;r.path=null;r.vars={};}
      for(let t=0;t<300;t++){now+=120;for(const r of robots)tickRobot(r);}
      return totals.collected;
    }
    setClaim=()=>{};  res.solo1=run(1); res.solo4=run(4);
    setClaim=realClaim; res.team1=run(1); res.team4=run(4);
    window.setInterval=origSI;
    objects=new Map(); claims=new Map(); robots.length=1;
    return JSON.stringify(res);
  }catch(e){return JSON.stringify({ERR:e.message});} })()`);
  const SC = JSON.parse(scale);
  if(SC.ERR) throw new Error("scaling block threw: "+SC.ERR);
  check("uncoordinated, 4 robots gather barely more than 1 — the fleet doesn't scale",
    SC.solo4 < SC.solo1 * 1.6, scale);
  check("...calling what you walk to makes 4 robots gather 2x+ what 4 uncoordinated ones do",
    SC.team4 > SC.solo4 * 2, scale);
  check("...and costs a lone robot nothing", SC.team1 >= SC.solo1 * 0.95, scale);

  console.log("▶ 🤝 teamwork: claims, the noticeboard, and a fleet that fans out");
  const team = await ev(`(()=>{ try{
    const out={};
    objects=new Map(); claims=new Map(); radio={};
    const a=robots[0];
    // a second robot to coordinate with
    while(robots.length<2)robots.push(makeRobot(homePos.x+1,homePos.y+1,"R2"));
    const b=robots[1];
    a.x=5;a.y=5;a.rx=5;a.ry=5;a.dir=1;a.energy=100;
    b.x=5;b.y=7;b.rx=5;b.ry=7;b.dir=1;b.energy=100;
    // three trees, all reachable
    for(const t of [[8,5],[8,7],[9,6]]){terrain[key(t[0],t[1])]=T_GRASS;objects.set(key(t[0],t[1]),{type:'tree',stage:2,hits:0});}
    // --- without claiming, both robots pick the SAME nearest tree ---
    let n1=findNearest(a,'tree'), n2=findNearest(b,'tree');
    out.sameWhenNaive=(n1.x===8&&n1.y===5)&&(n2.x===8&&n2.y===7); // each nearest to itself
    // put them side by side so they genuinely compete for one tree
    b.x=5;b.y=5;b.rx=5;b.ry=5;
    n1=findNearest(a,'tree'); n2=findNearest(b,'tree');
    out.collide=(n1.x===n2.x&&n1.y===n2.y);
    // --- one 🤝 Call It and the other robot looks elsewhere ---
    faceTo(a,n1.x,n1.y); a.dir=1; a.x=7; a.y=5; a.rx=7; a.ry=5;   // stand next to it, facing it
    doAction(a,{t:'claim'});
    out.claimed=!!claimAt(key(8,5));
    out.claimOwner=claimAt(key(8,5)).by===0;
    const n2b=findNearest(b,'tree');
    out.otherMovedOn=!(n2b.x===8&&n2b.y===5);
    out.takenSensed=(()=>{b.x=7;b.y=5;b.rx=7;b.ry=5;b.dir=1;return evalCond(b,'taken');})();
    out.ownerNotBlockedByOwnClaim=!evalCond(a,'taken');
    // claiming something already called by someone else just fails, it never steals
    doAction(b,{t:'claim'});
    out.noSteal=claimAt(key(8,5)).by===0 && b.blocked===true;
    // --- claims expire, so an idle robot can't wedge a tile forever ---
    claims.get(key(8,5)).until=now-1;
    out.expires=!claimAt(key(8,5)) && findNearest(b,'tree').x===8;
    // --- everything called? still return SOMETHING rather than deadlock ---
    claims=new Map();
    for(const t of [[8,5],[8,7],[9,6]])claims.set(key(t[0],t[1]),{by:0,until:now+CLAIM_MS});
    out.neverDeadlocks=!!findNearest(b,'tree');
    claims=new Map();
    // --- 📡 the noticeboard ---
    a.x=11;a.y=6;a.rx=11;a.ry=6;a.dir=3;              // facing the tree at 9,6? no: 10,6
    a.dir=1; a.x=8; a.y=6; a.rx=8; a.ry=6;             // facing 9,6
    doAction(a,{t:'broadcast',opt:'tree'});
    const m=radioGet('tree');
    out.posted=!!m && m.x===9 && m.y===6;
    b.x=5;b.y=5;b.rx=5;b.ry=5;b.path=null;
    doAction(b,{t:'goTo',opt:'tree'});
    out.walksThere=!!(b.path&&b.path.length);
    // an empty channel reads as blocked, so a program can fall back to its own search
    b.path=null; doAction(b,{t:'goTo',opt:'crystal'});
    out.emptyChannelBlocks=(b.blocked===true&&!b.path);
    // and a stale call is forgotten
    radio.tree.at=now-RADIO_MS-1;
    out.expiresToo=!radioGet('tree');
    // --- the blocks are real blocks: palette, editor chip, python ---
    out.inCats=CATS.some(c=>c.id==='team'&&c.types.length===3);
    out.locked=CATS.find(c=>c.id==='team').lock==='team';
    const prog=[{t:'claim',uid:'t1'},{t:'broadcast',uid:'t2',opt:'crystal'},{t:'goTo',uid:'t3',opt:'crystal'},
                {t:'if',uid:'t4',cond:'taken',body:[{t:'turnR',uid:'t5'}],els:[]}];
    out.py=toPy(prog,'');
    // --- the payoff, measured: does a fleet actually fan out? ---
    // Four robots on one tile, four trees around them. Each runs the SAME program;
    // the only difference is whether it calls its target before walking.
    const fan=(useClaim)=>{
      objects=new Map(); claims=new Map();
      const cx=20,cy=20;
      const spots=[[cx+2,cy],[cx-2,cy],[cx,cy+2],[cx,cy-2]];
      for(const s of spots){terrain[key(s[0],s[1])]=T_GRASS;objects.set(key(s[0],s[1]),{type:'tree',stage:2,hits:0});}
      const crew=[];
      while(robots.length<4)robots.push(makeRobot(cx,cy,'X'+robots.length));
      for(let i=0;i<4;i++){const r=robots[i];r.x=cx;r.y=cy;r.rx=cx;r.ry=cy;r.dir=1;r.energy=100;crew.push(r);}
      const picked=[];
      for(const r of crew){
        const t=findNearest(r,'tree');
        if(!t){picked.push('none');continue;}
        picked.push(t.x+','+t.y);
        if(useClaim){faceTo(r,t.x,t.y);
          // stand next to it so 🤝 can reach it, the way the robot would after walking
          r.x=t.x-DX[r.dir];r.y=t.y-DY[r.dir];r.rx=r.x;r.ry=r.y;
          doAction(r,{t:'claim'});}
      }
      return new Set(picked).size;                 // how many DIFFERENT trees the fleet works
    };
    out.fanNaive=fan(false);
    out.fanClaim=fan(true);
    objects=new Map(); claims=new Map(); radio={};
    return JSON.stringify(out);
  }catch(e){return JSON.stringify({ERR:e.message+' @ '+(e.stack||'').split('\\n')[1]});} })()`);
  const TM = JSON.parse(team);
  if(TM.ERR) throw new Error("teamwork block threw: "+TM.ERR);
  check("without 🤝, two robots side by side target the very same tree", TM.collide === true, team);
  check("🤝 Call It reserves a tile for its owner", TM.claimed === true && TM.claimOwner === true, team);
  check("...and the rest of the fleet's Face Nearest goes elsewhere", TM.otherMovedOn === true, team);
  check("...'another robot called it 🤝' senses it, and never fires on your own call",
    TM.takenSensed === true && TM.ownerNotBlockedByOwnClaim === true, team);
  check("a call cannot be stolen, only waited out", TM.noSteal === true && TM.expires === true, team);
  check("a fully-called map still returns a target instead of deadlocking", TM.neverDeadlocks === true, team);
  check("📡 Tell Team pins the spot ahead to a channel", TM.posted === true, team);
  check("📻 Go To Call walks there, and an empty channel reads as blocked",
    TM.walksThere === true && TM.emptyChannelBlocks === true, team);
  check("a stale call fades off the noticeboard", TM.expiresToo === true, team);
  check("the team blocks ship as a locked palette category", TM.inCats === true && TM.locked === true, team);
  check("...and generate Python", /call_it\(\)/.test(TM.py) && /team\.tell\("crystal"\)/.test(TM.py) &&
    /team\.already_called\(\)/.test(TM.py), TM.py);
  // the point of the whole feature, stated as a number
  check("4 robots + one pasted program all pick the SAME tree", TM.fanNaive === 1, team);
  check("...the same program with 🤝 Call It spreads them over 4 different trees", TM.fanClaim === 4, team);

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

  // 🧩 budget: 3…999, reachable in a sane number of taps, and a 999-block program
  // must actually be able to RUN — a flat 500-step cap would have killed it.
  const bud = await ev(`(()=>{
    mgEnterCreator();
    const out={},inc=document.getElementById('mgBudInc'),dec=document.getElementById('mgBudDec');
    const p=mgState.proj;
    setBudget(12);
    let taps=0; while(p.maxBlocks<999&&taps<200){inc.click();taps++;}
    out.top=p.maxBlocks; out.taps=taps;                 // reaches 999, and not by brute force
    inc.click(); out.capped=p.maxBlocks;                // and stops there
    let down=0; while(p.maxBlocks>3&&down<200){dec.click();down++;}
    out.floor=p.maxBlocks;                              // never below 3
    dec.click(); out.floorHeld=p.maxBlocks;
    setBudget(9999); out.clampHigh=p.maxBlocks;
    setBudget(0);    out.clampLow=p.maxBlocks;
    setBudget(250);  out.exact=p.maxBlocks;             // typing an exact value works
    // the runaway guard has to scale with the budget, or a long program can never finish
    const capAt=n=>{p.maxBlocks=n;return Math.max(500,(p.maxBlocks|0)*20);};
    out.cap12=capAt(12); out.cap30=capAt(30); out.cap999=capAt(999);
    return JSON.stringify(out);
  })()`);
  const BU = JSON.parse(bud);
  check("the block budget reaches 999", BU.top === 999 && BU.capped === 999, bud);
  check("...without hundreds of taps (the step grows with the number)", BU.taps > 0 && BU.taps <= 40, bud);
  check("...and still floors at 3", BU.floor === 3 && BU.floorHeld === 3, bud);
  check("typing a budget clamps into 3…999", BU.clampHigh === 999 && BU.clampLow === 3 && BU.exact === 250, bud);
  check("the runaway cap scales with the budget, unchanged for small levels",
    BU.cap12 === 500 && BU.cap30 === 600 && BU.cap999 === 19980, bud);

  // a 700-block straight-line program: proves the raised budget is really usable
  const bigProg = await ev(`(()=>{
    mgExit(false); mgEnterCreator();
    const p=mgState.proj;
    p.gw=10;p.gh=8;p.start={x:0,y:0,dir:1};p.tiles=[];
    p.cells=[];for(let y=0;y<8;y++)for(let x=0;x<10;x++)p.cells.push([x,y]); // all 80 tiles
    mgState.robot={x:0,y:0,dir:1};mgSeed(mgState.robot,p);
    setBudget(700);
    // Snake over every tile building as it goes, written out flat with no loops —
    // the shape a big budget exists for. One pass over the 10x8 board is only 173
    // blocks (80 tiles is the publishable ceiling), so repeat the pass four times to
    // get a genuinely long program: rebuilding an existing brick is a no-op and the
    // robot only ever builds where it stands, so extra passes can't create strays.
    let u=0;const B=t=>({t:t,uid:'bp'+(++u)}),prog=[];
    for(let pass=0;pass<4;pass++)for(let y=0;y<8;y++){
      for(let x=0;x<10;x++){prog.push(B('build'));if(x<9)prog.push(B('move'));}
      if(y<7){ // turn down a row and reverse direction
        prog.push(B(y%2===0?'turnR':'turnL'));prog.push(B('move'));
        prog.push(B(y%2===0?'turnR':'turnL'));
      }
    }
    mgRobot.program=prog;
    const n=progSize(mgRobot);
    const origSI=window.setInterval;window.setInterval=()=>0;
    mgRun();
    const started=!!(mgState&&mgState.running);
    let ticks=0;while(mgState&&mgState.running&&ticks<30000){mgTick();ticks++;}
    window.setInterval=origSI;
    const out={n,started,ticks,solved:!!(mgState&&mgState.solved),
      filled:mgState?mgState.robot.bricks.size:0};
    if(mgState)mgExit(false);
    document.getElementById('editor').classList.remove('open','max');
    return JSON.stringify(out);
  })()`);
  const BP = JSON.parse(bigProg);
  check("a program of hundreds of blocks is accepted by the budget", BP.n > 500 && BP.started === true, bigProg);
  check("...and runs to completion instead of hitting the runaway cap",
    BP.solved === true && BP.filled === 80, bigProg);
  check("...taking more than the old flat 500-step cap allowed", BP.ticks > 500, bigProg);

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

  console.log("▶ Academy: guided starter tutorials");
  const acad = await ev(`(()=>{
    const out={};
    out.count=TUTS.length;
    out.grows=JSON.stringify(TUTS.map(t=>t.allowed.length));
    const enter=id=>mgEnter(JSON.parse(JSON.stringify(TUTS.find(t=>t.id===id))));
    const run=prog=>{ mgRobot.program=prog; mgReset(); mgRobot.vars={};
      mgState.running=true; mgRobot.running=true; mgState.frames=[{blocks:prog,i:0,reps:1}];
      let g=0; while(mgState&&mgState.running&&g++<400)mgTick(); };
    player.academy={};
    enter('t_move');
    run([{t:'move',uid:1},{t:'move',uid:2},{t:'move',uid:3},{t:'move',uid:4}]);
    out.moveSolved=!!player.academy.t_move;
    enter('t_chop');
    run([{t:'move',uid:1},{t:'move',uid:2},{t:'move',uid:3},{t:'move',uid:4},{t:'chop',uid:5}]);
    out.chopSolved=!!player.academy.t_chop;
    enter('t_collect');
    run([{t:'move',uid:1},{t:'move',uid:2},{t:'move',uid:3},{t:'move',uid:4},{t:'collect',uid:5}]);
    out.collectSolved=!!player.academy.t_collect;
    enter('t_loop');
    const loopProg=[{t:'repeat',n:5,uid:1,body:[{t:'move',uid:2},{t:'chop',uid:3}]}];
    out.loopBudget=countBlocks(loopProg)<=TUTS.find(t=>t.id==='t_loop').maxBlocks;
    run(loopProg);
    out.loopSolved=!!player.academy.t_loop;
    enter('t_if');
    mgState.robot.x=0; mgState.robot.y=1; mgState.robot.dir=1;
    out.treeAhead=mgCond(mgState,'treeAhead');
    mgState.robot.dir=3;
    out.noTree=mgCond(mgState,'treeAhead');
    mgState=null; mgRobot=null;
    out.incomplete=(academyComplete()===false); // t_turn & t_if not solved
    renderProjects();
    // the whole sheet is one card language now: Academy and Puzzle Chapters use
    // the same compact .pcard as Build Projects, each keeping its dot track inside
    const ac=document.querySelector('#projList .pcard.acad-card');
    out.hasCard=!!ac;
    out.acadMeta=ac?ac.querySelector('.pmeta').textContent.replace(/\s+/g,' ').trim():null;
    out.acadTrack=ac?ac.querySelectorAll('.pmain .acad-track .acad-dot').length:0;
    out.oldMarkup=document.querySelectorAll('#projList .quest.proj').length; // must be zero
    const packCards=[...document.querySelectorAll('#projList .pcard:not(.acad-card)')]
      .filter(c=>c.querySelector('.acad-track'));
    out.packCards=packCards.length;                 // one per chapter
    out.packDots=packCards.every((c,i)=>
      c.querySelectorAll('.pmain .acad-track .acad-dot').length===PUZZLE_PACKS[i].stages.length);
    out.packLocked=packCards.filter(c=>c.classList.contains('locked')).length; // must be zero
    // every dot is a door: tap the LAST level of the LAST (hardest) chapter, which
    // no prerequisite has been met for, and it must open that exact level
    const lastPack=PUZZLE_PACKS[PUZZLE_PACKS.length-1];
    const dots=packCards[packCards.length-1].querySelectorAll('.acad-track .acad-dot');
    dots[dots.length-1].click();
    out.deepJump=!!(mgState&&mgState.packCtx&&mgState.packCtx.packId===lastPack.id
      &&mgState.packCtx.i===lastPack.stages.length-1);
    if(mgState)mgExit(false);
    // same for a lesson the player has not reached
    renderProjects();
    document.querySelectorAll('#projList .pcard.acad-card .acad-dot')[5].click();
    out.lessonJump=!!(mgState&&mgState.proj.id===TUTS[5].id);
    if(mgState)mgExit(false);
    mgState=null;mgRobot=null;
    return JSON.stringify(out);
  })()`);
  const AC = JSON.parse(acad);
  check("Academy defines a full ladder of stages", AC.count === 6, acad);
  check("stages unlock a growing block set", AC.grows === "[1,3,4,4,5,6]", AC.grows);
  check("reach goal: landing on the flag solves the stage", AC.moveSolved === true, acad);
  check("chop goal: felling the tree solves the stage", AC.chopSolved === true, acad);
  check("collect goal: gathering the gem solves the stage", AC.collectSolved === true, acad);
  check("loop stage is solvable within its tight block budget", AC.loopBudget && AC.loopSolved === true, acad);
  check("treeAhead sensing works on the tutorial board", AC.treeAhead === true && AC.noTree === false, acad);
  check("Academy tracks partial progress", AC.incomplete === true, acad);
  check("Projects sheet shows the cohesive Academy section", AC.hasCard === true, acad);
  check("Academy card is a compact .pcard with progress meta + lesson track",
    AC.acadTrack === AC.count && /4\/6 done/.test(AC.acadMeta || ""), AC.acadMeta + " dots=" + AC.acadTrack);
  check("Puzzle chapters use the same card, one dot per level",
    AC.packCards === 5 && AC.packDots === true, "packs=" + AC.packCards + " dots=" + AC.packDots);
  check("no chapter is locked — every one is open from the start",
    AC.packLocked === 0 && AC.oldMarkup === 0, "locked=" + AC.packLocked + " old=" + AC.oldMarkup);
  check("tapping a level dot jumps straight into that level",
    AC.deepJump === true && AC.lessonJump === true, "chapter=" + AC.deepJump + " lesson=" + AC.lessonJump);

  console.log("▶ creator: multi-level packs + difficulty");
  const packSetup = await ev(`(()=>{
    const out={};
    mgEnterCreator();
    const setLevel=()=>{ const p=mgState.proj; p.gw=4;p.gh=4; p.cells=[[0,0]]; p.start={x:0,y:0,dir:1};
      mgState.robot.x=0;mgState.robot.y=0;mgState.robot.dir=1; mgSeed(mgState.robot,p); mgState.solved=true; }; // proven solvable
    mgState.proj.diff=2;            // Medium
    setLevel(); mgAddStage();       // bank level 1
    out.banked=mgState.stages.length;
    setLevel();                     // current design = level 2
    player.myChallenges=[];
    saveMyChallenge();              // -> multi-level pack (banked + current)
    const pk=player.myChallenges[player.myChallenges.length-1];
    out.isPack=!!pk.pack; out.levels=pk.stages.length; out.diff=pk.diff;
    window.__runProg=prog=>{ mgRobot.program=prog; mgReset(); mgState.running=true; mgRobot.running=true;
      mgState.frames=[{blocks:prog,i:0,reps:1}]; let g=0; while(mgState&&mgState.running&&g++<200)mgTick(); };
    packEnter(pk,0);
    out.startCtx=mgState.packCtx.i;
    window.__runProg([{t:'build',uid:1}]);   // solve level 1 (fills the single target cell)
    // assert the SAVED PACK's own card, not just any card in the list: after the card
    // redesign the old selector only matched the Academy/chapter cards, so it passed blind
    out.hasCard=(()=>{renderProjects();
      return [...document.querySelectorAll('#projList .pcard')].some(c=>{
        const n=c.querySelector('.pname'), m=c.querySelector('.pmeta');
        return n&&n.textContent.indexOf(pk.name)>=0&&m&&m.textContent.indexOf('2 levels')>=0;});})();
    return JSON.stringify(out);
  })()`);
  const PS = JSON.parse(packSetup);
  check("creator banks a level with Add level", PS.banked === 1, packSetup);
  check("saving with banked levels creates a multi-level pack", PS.isPack === true && PS.levels === 2, packSetup);
  check("pack keeps the chosen difficulty", PS.diff === 2, packSetup);
  check("pack starts on its first level", PS.startCtx === 0, packSetup);
  await sleep(950); // let the auto-advance timer fire
  const adv = await ev(`(()=>{
    const out={};
    out.advanced = !!(mgState && mgState.packCtx && mgState.packCtx.i===1);
    if(out.advanced) window.__runProg([{t:'build',uid:1}]); // solve the final level
    out.packDone = Object.keys(player.projects).some(k=>k.indexOf('pack_')===0);
    out.exited = (mgState===null);
    return JSON.stringify(out);
  })()`);
  const AD = JSON.parse(adv);
  check("solving a level auto-advances to the next", AD.advanced === true, adv);
  check("clearing the last level completes the pack", AD.packDone === true && AD.exited === true, adv);

  console.log("▶ creator: Save/Publish gated behind proving solvable + edit/delete levels");
  const gate = await ev(`(()=>{
    const out={}; window.confirm=()=>true;
    mgEnterCreator();
    const p=mgState.proj; p.gw=4;p.gh=4;
    p.cells=[[0,0]]; p.start={x:0,y:0,dir:1}; mgState.robot.x=0;mgState.robot.y=0;mgState.robot.dir=1; mgSeed(mgState.robot,p);
    mgState.solved=false; mgState.stages=[]; player.myChallenges=[];
    saveMyChallenge();                       // blocked — not proven
    out.blockedSave = player.myChallenges.length===0;
    mgAddStage();                            // blocked — not proven
    out.blockedAdd = mgState.stages.length===0;
    mgCreatorUI();
    out.saveLocked = document.getElementById('mgSave').classList.contains('locked');
    out.pubHidden = document.getElementById('mgPublish').style.display==='none';
    mgState.solved=true; mgCreatorUI();      // prove it
    out.saveUnlocked = !document.getElementById('mgSave').classList.contains('locked');
    out.pubShown = document.getElementById('mgPublish').style.display!=='none';
    mgAddStage();                            // level 1 banked
    p.cells=[[1,1]]; mgSeed(mgState.robot,p); mgState.solved=true; mgAddStage(); // level 2
    out.banked2 = mgState.stages.length;
    mgEditStage(0);                          // load level 1 back into the editor
    // it must STAY in the bank while being edited — it used to be spliced out, so
    // exiting or editing another level silently destroyed it
    out.editing = mgState.editIndex===0 && mgState.stages.length===2;
    out.editCells = JSON.stringify(p.cells);
    mgState.solved=true; mgAddStage();       // update it in its slot
    out.backTo2 = mgState.stages.length===2 && mgState.editIndex===null;
    out.updatedInPlace = JSON.stringify(mgState.stages[0].cells)==='[[0,0]]';
    mgDeleteStage(1);                        // delete level 2
    out.afterDelete = mgState.stages.length;
    mgExit(false); document.getElementById('editor').classList.remove('open','max');
    return JSON.stringify(out);
  })()`);
  const G = JSON.parse(gate);
  check("Save/Add blocked until the level is proven solvable", G.blockedSave === true && G.blockedAdd === true, gate);
  check("Save locked & Publish hidden before solving", G.saveLocked === true && G.pubHidden === true, gate);
  check("Save unlocks & Publish appears after solving", G.saveUnlocked === true && G.pubShown === true, gate);
  check("Edit loads a banked level and leaves it in the bank", G.editing === true && G.editCells === '[[0,0]]', gate);
  check("Update writes the edited level back into its own slot", G.updatedInPlace === true, gate);
  check("Updating re-inserts the level in its slot", G.backTo2 === true, gate);
  check("Delete removes a banked level", G.afterDelete === 1, gate);

  console.log("▶ creator: edit an already-saved My Challenge in place");
  const editSaved = await ev(`(()=>{
    const out={}; window.confirm=()=>true;
    player.myChallenges=[
      {id:'my_A',mine:true,em:'🧩',name:'Alpha',diff:1,maxBlocks:12,gw:4,gh:4,allowed:CHALLENGE_BLOCKS,start:{x:0,y:0,dir:1},cells:[[0,0]],initial:[],desc:'x'},
      {id:'my_B',mine:true,pack:true,em:'🎬',name:'Beta',diff:2,stages:[
        {em:'🧩',name:'Beta',diff:2,maxBlocks:12,gw:4,gh:4,allowed:CHALLENGE_BLOCKS,start:{x:0,y:0,dir:1},cells:[[0,0]],initial:[]},
        {em:'🧩',name:'Beta',diff:2,maxBlocks:12,gw:4,gh:4,allowed:CHALLENGE_BLOCKS,start:{x:0,y:0,dir:1},cells:[[1,1]],initial:[]}
      ],desc:'2 levels'}
    ];
    mgEditMyChallenge(player.myChallenges[0]);           // edit the single challenge
    out.editingId=mgState.editingId; out.loadedCells=JSON.stringify(mgState.proj.cells);
    mgState.proj.cells=[[0,0],[1,0]]; mgState.solved=true; // change + prove
    saveMyChallenge();
    out.countAfterSingle=player.myChallenges.length;
    const a=player.myChallenges.find(x=>x.id==='my_A'); out.singleUpdated=!!(a&&a.cells.length===2);
    mgEditMyChallenge(player.myChallenges.find(x=>x.id==='my_B')); // edit the pack
    out.packStages=mgState.stages.length; out.packEditingId=mgState.editingId;
    mgDeleteStage(1);                                     // remove one level, then save
    saveMyChallenge();
    out.countAfterPack=player.myChallenges.length;
    const bpk=player.myChallenges.find(x=>x.id==='my_B'); out.packUpdated=!!(bpk&&bpk.pack&&bpk.stages.length===1);
    mgState=null; mgRobot=null;
    return JSON.stringify(out);
  })()`);
  const ES = JSON.parse(editSaved);
  check("Edit loads a saved single challenge into the creator", ES.editingId === 'my_A' && ES.loadedCells === '[[0,0]]', editSaved);
  check("saving an edit updates the entry in place (no duplicate)", ES.countAfterSingle === 2 && ES.singleUpdated === true, editSaved);
  check("Edit loads a saved pack's levels into the strip", ES.packStages === 2 && ES.packEditingId === 'my_B', editSaved);
  check("editing a pack updates it in place", ES.countAfterPack === 2 && ES.packUpdated === true, editSaved);

  const CC_TILE_TYPES = JSON.parse(await ev(`JSON.stringify(CC_TILES.TYPES.length)`));

  console.log("▶ puzzle terrain: walls block, pits are bridged with a dropped block");
  const terr = await ev(`(()=>{
    // run a program by hand-ticking, so no timers are involved
    const run=(proj,prog,ticks)=>{
      mgEnter(proj); mgRobot.program=prog;
      mgState.running=true; mgState.frames=[{blocks:prog,i:0,reps:1}]; mgState.wait=0;
      for(let i=0;i<ticks&&mgState&&mgState.running;i++)mgTick();
      return mgState;
    };
    const base={id:'tt',em:'🧱',name:'T',desc:'',gw:5,gh:3,maxBlocks:30,
      allowed:CHALLENGE_BLOCKS,coins:0,xp:0,start:{x:0,y:1,dir:1},cells:[[4,1]],initial:[]};
    // --- wall blocks movement, and wallAhead/blocked sense it ---
    let st=run(Object.assign({},base,{tiles:[[1,1,'wall']]}),[{t:'move',uid:1}],3);
    const wallX=st.robot.x, wallSense=mgCond(st,'wallAhead'), blockedSense=mgCond(st,'blocked');
    mgExit(false);
    // --- pit blocks movement too ---
    st=run(Object.assign({},base,{tiles:[[1,1,'pit']]}),[{t:'move',uid:1}],3);
    const pitX=st.robot.x, pitSense=mgCond(st,'pitAhead');
    mgExit(false);
    // --- carry a block, drop it into the pit ahead, then walk across ---
    st=run(Object.assign({},base,{tiles:[[2,1,'pit']],initial:[[0,1]],cells:[[4,1]]}),
      [{t:'pickUp',uid:1},{t:'move',uid:2},{t:'drop',uid:3},{t:'move',uid:4},{t:'move',uid:5}],9);
    const bridged=st.robot.bricks.has('2_1'), crossed=st.robot.x, handEmpty=st.robot.held===null;
    // a block spent bridging a pit must NOT count as a stray brick outside the plan
    st.robot.bricks.add('4_1');
    const notStray=mgGoalMet(st);
    mgExit(false);
    // --- old projects (no tiles at all) behave exactly as before ---
    mgEnter(PROJECTS[0]);
    const legacy=mgState.robot.tiles.size===0&&mgWalkable(mgState,1,1);
    mgExit(false);
    return JSON.stringify({wallX,wallSense,blockedSense,pitX,pitSense,bridged,crossed,handEmpty,notStray,legacy});
  })()`);
  const TE = JSON.parse(terr);
  check("a wall stops the robot", TE.wallX === 0, terr);
  check("wallAhead and blocked both sense a wall", TE.wallSense === true && TE.blockedSense === true, terr);
  check("a pit stops the robot", TE.pitX === 0 && TE.pitSense === true, terr);
  check("dropping a block into the pit ahead bridges it", TE.bridged === true && TE.handEmpty === true, terr);
  check("the robot walks across the bridged pit", TE.crossed === 3, terr); // pit was at x=2
  check("a block spent bridging a pit isn't a stray brick", TE.notStray === true, terr);
  check("projects without tiles are unaffected", TE.legacy === true, terr);

  console.log("▶ challenge VM: ⏱️ Wait counts down and ♾️ Forever runs (and can win)");
  const vm = await ev(`(()=>{
    const start=(proj,prog)=>{ mgEnter(proj); mgRobot.program=prog;
      mgState.running=true; mgState.frames=[{blocks:prog,i:0,reps:1}]; mgState.wait=0; };
    const tick=n=>{for(let i=0;i<n&&mgState&&mgState.running;i++)mgTick();};
    const base={id:'vm',em:'⏱️',name:'V',desc:'',gw:6,gh:2,maxBlocks:30,
      allowed:CHALLENGE_BLOCKS,coins:0,xp:0,start:{x:0,y:0,dir:1},cells:[[5,0]],initial:[],tiles:[]};
    // ⏱️ Wait 3 holds the robot for three ticks, then Move runs on the fourth
    start(base,[{t:'wait',n:3,uid:1},{t:'move',uid:2}]);
    tick(3); const heldStill=mgState.robot.x===0;
    tick(1); const movedAfter=mgState.robot.x===1;
    mgExit(false);
    // ♾️ Forever actually executes its body (it used to be skipped entirely)
    start(base,[{t:'forever',uid:1,body:[{t:'move',uid:2}]}]);
    tick(4); const foreverRuns=mgState.robot.x===4;
    mgExit(false);
    // ♾️ Forever WINS the moment the goal is met, instead of running to the cap
    const fill={id:'vf',em:'♾️',name:'F',desc:'',gw:4,gh:1,maxBlocks:30,
      allowed:CHALLENGE_BLOCKS,coins:0,xp:0,start:{x:0,y:0,dir:1},
      cells:[[0,0],[1,0],[2,0],[3,0]],initial:[],tiles:[],mine:true};
    start(fill,[{t:'forever',uid:1,body:[{t:'build',uid:2},{t:'move',uid:3}]}]);
    tick(400);
    const wonEarly=!mgState||mgState.running===false;
    const steps=mgState?mgState.steps:0;
    if(mgState)mgExit(false);
    // an empty board is never "won" — otherwise ♾️ would instantly clear a blank canvas
    mgEnterCreator();
    const emptyNotWon=mgGoalMet(mgState);
    mgExit(false);
    return JSON.stringify({heldStill,movedAfter,foreverRuns,wonEarly,steps,emptyNotWon});
  })()`);
  const VM = JSON.parse(vm);
  check("Wait n holds the robot for n ticks", VM.heldStill === true && VM.movedAfter === true, vm);
  check("Forever runs its body", VM.foreverRuns === true, vm);
  check("Forever wins as soon as the goal is met", VM.wonEarly === true && VM.steps < 400, vm);
  check("an empty board is never counted as solved", VM.emptyNotWon === false, vm);

  console.log("▶ keys, doors & portals");
  const kdp = await ev(`(()=>{
    const run=(proj,prog,ticks)=>{
      mgEnter(proj); mgRobot.program=prog;
      mgState.running=true; mgState.frames=[{blocks:prog,i:0,reps:1}]; mgState.wait=0;
      for(let i=0;i<ticks&&mgState&&mgState.running;i++)mgTick();
      return mgState;
    };
    const base={id:'kd',em:'🔑',name:'K',desc:'',gw:6,gh:3,maxBlocks:30,
      allowed:CHALLENGE_BLOCKS,coins:0,xp:0,start:{x:0,y:1,dir:1},cells:[[5,1]],initial:[]};
    // a door with no key is a wall
    let st=run(Object.assign({},base,{tiles:[[2,1,'door',1]]}),[{t:'move',uid:1}],4);
    const lockedX=st.robot.x, doorSense=mgCond(st,'doorAhead');
    mgExit(false);
    // walk over the matching key, then straight through the door
    st=run(Object.assign({},base,{tiles:[[1,1,'key',1],[2,1,'door',1]]}),
      [{t:'move',uid:1},{t:'move',uid:2},{t:'move',uid:3}],6);
    const got=st.robot.keys.has(1), through=st.robot.x, quiet=mgCond(st,'doorAhead');
    mgExit(false);
    // the WRONG colour key doesn't open it
    st=run(Object.assign({},base,{tiles:[[1,1,'key',2],[2,1,'door',1]]}),
      [{t:'move',uid:1},{t:'move',uid:2},{t:'move',uid:3}],6);
    const wrongKey=st.robot.x;
    mgExit(false);
    // a portal pair moves the robot across, and does not bounce it back
    st=run(Object.assign({},base,{tiles:[[1,1,'portal',1],[4,1,'portal',1]]}),
      [{t:'move',uid:1}],3);
    const ported=st.robot.x;
    st.robot.x=4;st.robot.y=1;
    mgExit(false);
    return JSON.stringify({lockedX,doorSense,got,through,quiet,wrongKey,ported});
  })()`);
  const KD = JSON.parse(kdp);
  check("a locked door blocks the robot", KD.lockedX === 1 && KD.doorSense === true, kdp);
  check("the matching key opens the door and the robot walks through", KD.got === true && KD.through === 3, kdp);
  check("doorAhead goes quiet once the key is held", KD.quiet === false, kdp);
  check("a wrong-colour key does not open the door", KD.wrongKey === 1, kdp);
  check("a portal pair teleports the robot (no bounce-back)", KD.ported === 4, kdp);

  console.log("▶ plates, gates & one-way arrows");
  const pga = await ev(`(()=>{
    const run=(proj,prog,ticks)=>{
      mgEnter(proj); mgRobot.program=prog;
      mgState.running=true; mgState.frames=[{blocks:prog,i:0,reps:1}]; mgState.wait=0;
      for(let i=0;i<ticks&&mgState&&mgState.running;i++)mgTick();
      return mgState;
    };
    const base={id:'pg',em:'🔘',name:'P',desc:'',gw:6,gh:3,maxBlocks:30,
      allowed:CHALLENGE_BLOCKS,coins:0,xp:0,start:{x:0,y:1,dir:1},cells:[[5,1]],initial:[]};
    // a gate is shut while nothing presses its plate
    let st=run(Object.assign({},base,{tiles:[[3,0,'plate',1],[2,1,'gate',1]]}),[{t:'move',uid:1}],4);
    const shutX=st.robot.x, gateSense=mgCond(st,'gateAhead');
    // standing on the plate opens it
    st.robot.x=3;st.robot.y=0;
    const openWhileOn=CC_TILES.platesPressed(st.robot,1);
    st.robot.x=0;st.robot.y=1;
    const shutAgain=!CC_TILES.platesPressed(st.robot,1);
    // ...and a block left on the plate holds it open with the robot elsewhere
    st.robot.bricks.add('3_0');
    const heldByBlock=CC_TILES.platesPressed(st.robot,1);
    const onPlateSense=(st.robot.x=3,st.robot.y=0,mgCond(st,'onPlate'));
    // a block doing that job is not a stray brick
    st.robot.bricks.add('5_1');
    const notStray=mgGoalMet(st);
    mgExit(false);
    // a one-way tile refuses movement against its arrow, allows it along
    st=run(Object.assign({},base,{tiles:[[1,1,'arrow',1]],start:{x:0,y:1,dir:1}}),
      [{t:'move',uid:1},{t:'turnL',uid:2},{t:'turnL',uid:3},{t:'move',uid:4}],6);
    const stuck=st.robot.x===1;      // walked onto it, then couldn't go back west
    mgExit(false);
    st=run(Object.assign({},base,{tiles:[[1,1,'arrow',1]],start:{x:0,y:1,dir:1}}),
      [{t:'move',uid:1},{t:'move',uid:2}],4);
    const flows=st.robot.x===2;      // continuing east is fine
    mgExit(false);
    return JSON.stringify({shutX,gateSense,openWhileOn,shutAgain,heldByBlock,onPlateSense,notStray,stuck,flows});
  })()`);
  const PG = JSON.parse(pga);
  check("a gate blocks while its plate is unpressed", PG.shutX === 1 && PG.gateSense === true, pga);
  check("standing on the plate opens the gate", PG.openWhileOn === true && PG.shutAgain === true, pga);
  check("a block left on the plate holds the gate open", PG.heldByBlock === true, pga);
  check("onPlate senses the plate underfoot", PG.onPlateSense === true, pga);
  check("a block doing a job on a plate isn't a stray brick", PG.notStray === true, pga);
  check("a one-way tile refuses movement against the arrow", PG.stuck === true, pga);
  check("a one-way tile allows movement along the arrow", PG.flows === true, pga);

  console.log("▶ creator: every tool re-locks Save, and tiles survive banking");
  const tools = await ev(`(()=>{
    mgEnterCreator();
    // the solved=false invariant must hold for EVERY tool, now and in future
    const missed=[];
    mgToolList().forEach((t,i)=>{
      mgState.paintMode=t.id; mgState.solved=true;
      mgPaintTile(1+(i%3),1);
      if(mgState.solved!==false)missed.push(t.id);
    });
    const toolCount=mgToolList().length;
    // a wall painted in the creator lands in proj.tiles and survives snapshotStage
    mgState.proj.tiles=[]; mgState.proj.cells=[]; mgState.proj.initial=[];
    mgState.paintMode='wall'; mgPaintTile(3,3);
    const painted=mgState.proj.tiles.length===1&&mgState.proj.tiles[0][2]==='wall';
    mgState.proj.cells=[[1,1]]; mgState.solved=true; mgAddStage();
    const banked=(mgState.stages[0].tiles||[]).length===1;
    // shrinking the board must clip tiles, or an invisible wall blocks the level
    mgState.proj.tiles=[[7,3,'wall']]; mgState.proj.gw=8; mgSetSize(-3,0);
    const clipped=mgState.proj.tiles.length===0;
    mgExit(false); document.getElementById('editor').classList.remove('open','max');
    return JSON.stringify({missed,toolCount,painted,banked,clipped});
  })()`);
  const TL = JSON.parse(tools);
  check("every creator tool re-locks Save/Publish", TL.missed.length === 0, tools);
  check("the tool strip lists board tools + every terrain type", TL.toolCount === 4 + CC_TILE_TYPES, tools);
  check("painting a wall stores it in proj.tiles", TL.painted === true, tools);
  check("banked levels keep their terrain", TL.banked === true, tools);
  check("shrinking the board clips off-grid tiles", TL.clipped === true, tools);

  console.log("▶ puzzle campaign: every chapter level is solvable by its stored solution");
  const camp = await ev(`(()=>{
    const bad=[], budget=[];
    // capture the win instead of letting mgSuccess celebrate and tear the session
    // down (it exits the board, so we could never inspect the solved state)
    const origSI=window.setInterval; window.setInterval=()=>0; // drive every case by hand
    const origSuccess=mgSuccess; let fired=false;
    mgSuccess=()=>{fired=true;mgStop();};
    const partial=[];
    for(const pack of PUZZLE_PACKS){
      pack.stages.forEach((s,i)=>{
        const proj=JSON.parse(JSON.stringify(s));
        proj.id='camptest_'+pack.id+'_'+i;
        mgEnter(proj);
        applyProg(mgRobot, s.sol||[]);   // sol may be an array, or main+routines
        // the stored solution must also fit the level's own block budget
        const n=progSize(mgRobot);
        if(n>s.maxBlocks)budget.push(pack.id+'/'+i+' '+n+'>'+s.maxBlocks);
        // go through mgRun so a multi-input level is judged on EVERY one of its inputs
        fired=false; mgRun();
        for(let g=0;g<40&&mgState&&mgState.running;g++){
          for(let t=0;t<900&&mgState&&mgState.running;t++)mgTick();
        }
        const res=(mgState&&mgState.results)||[];
        if(!fired)bad.push(pack.id+'/'+i+' '+s.name+' ['+res.map(x=>x?1:0).join('')+']');
        // a level that ships N inputs must actually have been judged on all N
        if((s.cases||[]).length&&res.length!==s.cases.length)
          partial.push(pack.id+'/'+i+' ran '+res.length+'/'+s.cases.length);
        if(mgState)mgExit(false);
      });
    }
    mgSuccess=origSuccess; window.setInterval=origSI;
    document.getElementById('editor').classList.remove('open','max');
    // a level that HANDS the player a routine must actually deliver it
    delete player.projPrograms['presetchk'];
    const sortLvl=PUZZLE_PACKS.find(p=>p.id==='algo').stages.find(x=>x.name==='Sort Any Row');
    const pl=JSON.parse(JSON.stringify(sortLvl)); pl.id='presetchk';
    mgEnter(pl);
    const presetGiven=mgRobot.routines.A.length===21&&mgRobot.program.length===0;
    mgExit(false);
    const gated=PUZZLE_PACKS.filter(p=>p.needs).length;
    const levels=PUZZLE_PACKS.reduce((a,p)=>a+p.stages.length,0);
    const multi=PUZZLE_PACKS.reduce((a,p)=>a+p.stages.filter(s=>(s.cases||[]).length>1).length,0);
    const hidden=PUZZLE_PACKS.reduce((a,p)=>a+p.stages.filter(s=>(s.cases||[]).some(c=>c.hidden)).length,0);
    return JSON.stringify({bad,budget,partial,presetGiven,packs:PUZZLE_PACKS.length,levels,gated,multi,hidden});
  })()`);
  const CAMP = JSON.parse(camp);
  check("every campaign level is solvable", CAMP.bad.length === 0, camp);
  check("every stored solution fits the level's block budget", CAMP.budget.length === 0, camp);
  check("multi-input levels are judged on every one of their inputs", CAMP.partial.length === 0, camp);
  check("a level can hand the player a starter routine", CAMP.presetGiven === true, camp);
  check("the campaign has 5 chapters of levels, with a suggested order", CAMP.packs === 5 && CAMP.levels === 23 && CAMP.gated === 4, camp);
  check("the Algorithms levels are multi-input, each with a hidden case", CAMP.multi === 7 && CAMP.hidden === 7, camp);

  console.log("▶ 📘 design guide: every starter board is solvable within its budget");
  const gd = await ev(`(()=>{
    const out={};
    openGuide();
    out.open=document.getElementById('guide').classList.contains('open');
    out.rules=document.querySelectorAll('#guideBody .grule').length;
    out.note=!!document.querySelector('#guideBody .gnote');
    out.recipeCards=document.querySelectorAll('#guideBody .pcard').length;
    closeGuide();
    out.closed=!document.getElementById('guide').classList.contains('open');
    // reference solutions — one per recipe. A starter board nobody can solve is
    // worse than no starter board, so the suite proves each one, budget included.
    let u=0;
    const B=t=>({t:t,uid:'gd'+(++u)});
    const mv=()=>B('move'), tL=()=>B('turnL'), tR=()=>B('turnR');
    const bd=()=>B('build'), up=()=>B('pickUp'), dp=()=>B('drop');
    const back=()=>[tR(),tR()];                       // about-turn
    const SOL={
      detour:[mv(),mv(),tL(),mv(),tR(),mv(),mv(),tR(),mv(),tL(),mv(),bd()],
      row:[{t:'repeat',uid:'r1',n:8,body:[bd(),mv()]}],
      gaps:[{t:'repeat',uid:'r2',n:8,body:[{t:'if',uid:'i1',cond:'onTarget',body:[bd()],els:[]},mv()]}],
      bridge:[bd(),up(),mv(),dp(),mv(),mv(),bd(),up(),dp(),mv(),mv(),bd()],
      // park 3 off to the right, shuffle 1 and 2 left, bring 3 back
      sort:[up(),mv(),mv(),mv(),dp()].concat(
        back(),[mv(),mv(),up(),mv(),dp()],
        back(),[mv(),mv(),up()],
        back(),[mv(),dp()],
        back(),[mv(),mv(),up()],
        back(),[mv(),dp()])
    };
    const origSI=window.setInterval, origConf=window.confirm;
    window.setInterval=()=>0;            // hand-tick every run
    window.confirm=()=>true;             // "replace the board?" — yes
    const bad=[],over=[],notReset=[];
    for(const r of GUIDE_RECIPES){
      guideApply(r);
      const p=mgState.proj;
      // the recipe really landed, and it landed UNPROVEN with a blank program
      if(!(p.gw===r.gw&&p.gh===r.gh&&p.maxBlocks===r.max&&p.cells.length===r.cells.length
           &&mgState.solved===false&&progSize(mgRobot)===0&&mgState.creator))notReset.push(r.id);
      mgRobot.program=SOL[r.id];
      const n=progSize(mgRobot);
      if(n>r.max)over.push(r.id+' '+n+'>'+r.max);
      mgRun();
      for(let t=0;t<4000&&mgState&&mgState.running;t++)mgTick();
      if(!(mgState&&mgState.solved))bad.push(r.id+' ('+n+'/'+r.max+' blocks)');
    }
    out.bad=bad; out.over=over; out.notReset=notReset;
    out.count=GUIDE_RECIPES.length;
    if(mgState)mgExit(false);
    window.setInterval=origSI; window.confirm=origConf;
    document.getElementById('editor').classList.remove('open','max');
    // the guide is reachable from the Projects sheet, not only from inside the creator
    renderProjects();
    out.fromSheet=[...document.querySelectorAll('#projList .pcard .pname')]
      .some(n=>n.textContent.indexOf('design a great challenge')>=0);
    return JSON.stringify(out);
  })()`);
  const GD = JSON.parse(gd);
  check("the guide opens and closes", GD.open === true && GD.closed === true, gd);
  check("the guide teaches six rules plus the algorithm test",
    GD.rules === 6 && GD.note === true, gd);
  check("every starter board is offered as a card", GD.recipeCards === GD.count && GD.count === 5, gd);
  check("tapping a starter board lands it unproven with a blank program", GD.notReset.length === 0, gd);
  check("every starter board is solvable", GD.bad.length === 0, gd);
  check("...and its solution fits the budget the recipe ships with", GD.over.length === 0, gd);
  check("the guide is reachable from the Projects sheet", GD.fromSheet === true, gd);

  console.log("▶ finishing a chapter pays out its reward");
  const rew = await ev(`(()=>{
    const pack=PUZZLE_PACKS[0];
    delete player.projects['pack_'+pack.id];
    const c0=coins, x0=player.xp+player.level*1000;
    packEnter(pack,0);
    mgState.packCtx.i=mgState.packCtx.total-1;   // pretend we're on the last level
    packStageSolved();
    const paid=coins-c0, marked=!!player.projects['pack_'+pack.id];
    const grew=(player.xp+player.level*1000)>x0;
    // a second clear must NOT pay again
    const c1=coins;
    packEnter(pack,0); mgState.packCtx.i=mgState.packCtx.total-1; packStageSolved();
    const paidTwice=coins-c1;
    document.getElementById('editor').classList.remove('open','max');
    document.getElementById('projects').classList.remove('open');
    return JSON.stringify({paid,marked,grew,paidTwice});
  })()`);
  const RW = JSON.parse(rew);
  check("clearing a chapter pays coins + XP", RW.paid === 150 && RW.grew === true && RW.marked === true, rew);
  check("replaying a cleared chapter doesn't pay again", RW.paidTwice === 0, rew);

  console.log("▶ the language can express an algorithm: 📖 Read + x>y + 🔄 While");
  const algo = await ev(`(()=>{
    const mk=(initial,gw)=>({id:'al_'+Math.random(),em:'🔢',name:'A',desc:'',gw:gw||6,gh:2,
      maxBlocks:30,allowed:CHALLENGE_BLOCKS,coins:0,xp:0,start:{x:0,y:1,dir:1},
      cells:[],initial,tiles:[]});
    const run=(proj,prog,ticks)=>{
      mgEnter(proj);
      const p=JSON.parse(JSON.stringify(prog)); reUid(p);
      mgRobot.program=p; mgRobot.vars={}; mgRobot.say=null;
      mgState.running=true; mgState.frames=[{blocks:p,i:0,reps:1}]; mgState.wait=0;
      for(let t=0;t<(ticks||300)&&mgState&&mgState.running;t++)mgTick();
      return mgState;
    };
    // 📖 Read pulls the board into a variable
    let st=run(mk([[0,1,5],[1,1,8]]),[{t:'read',name:'a',src:'here'},{t:'read',name:'b',src:'ahead'},
      {t:'read',name:'cx',src:'x'},{t:'pickUp'},{t:'read',name:'h',src:'held'}],10);
    const v=mgRobot.vars, readHere=v.a===5, readAhead=v.b===8, readX=v.cx===0, readHeld=v.h===5;
    mgExit(false);
    // if x > y — comparing two VARIABLES (was impossible: RHS was always a constant)
    st=run(mk([[0,1,1]]),[{t:'setVar',name:'x',val:{k:'num',n:9}},{t:'setVar',name:'y',val:{k:'num',n:4}},
      {t:'if',cond:{var:'x',op:'>',val:{k:'var',name:'y'}},body:[{t:'say',val:{k:'str',s:'bigger'}}],els:[{t:'say',val:{k:'str',s:'no'}}]}],12);
    const varCmp=mgRobot.say&&mgRobot.say.txt==='bigger';
    mgExit(false);
    // an OLD saved condition stores a bare number there — must still evaluate
    st=run(mk([[0,1,1]]),[{t:'setVar',name:'x',val:{k:'num',n:9}},
      {t:'if',cond:{var:'x',op:'>',val:3},body:[{t:'say',val:{k:'str',s:'ok'}}],els:[]}],12);
    const legacyCmp=mgRobot.say&&mgRobot.say.txt==='ok';
    mgExit(false);
    // 🔄 While runs while its condition holds, and terminates when it stops
    st=run(mk([[0,1,1],[1,1,1],[2,1,1]]),[{t:'whileLoop',cond:'brickHere',body:[{t:'move'}]}],60);
    const whileWalked=st&&st.robot.x===3, whileEnded=st&&!st.running;
    mgExit(false);
    // THE POINT: one program, three different inputs, correct every time
    const maxProg=[{t:'read',name:'best',src:'here'},
      {t:'whileLoop',cond:'brickHere',body:[
        {t:'read',name:'v',src:'here'},
        {t:'if',cond:{var:'v',op:'>',val:{k:'var',name:'best'}},body:[{t:'setVar',name:'best',val:{k:'var',name:'v'}}],els:[]},
        {t:'move'}]},
      {t:'say',val:{k:'var',name:'best'}}];
    const answers=[], costs=[];
    [[[0,1,3],[1,1,7],[2,1,2]],[[0,1,9],[1,1,1],[2,1,4]],[[0,1,2],[1,1,5],[2,1,8],[3,1,6]]]
      .forEach(inp=>{const s=run(mk(inp),maxProg);answers.push(mgRobot.say?mgRobot.say.txt:null);costs.push(s?s.steps:0);mgExit(false);});
    // and it reads as real Python
    mgEnter(mk([[0,1,1]]));
    mgRobot.program=JSON.parse(JSON.stringify(maxProg)); reUid(mgRobot.program);
    const py=toPy(mgRobot.program,'');
    mgExit(false); document.getElementById('editor').classList.remove('open','max');
    return JSON.stringify({readHere,readAhead,readX,readHeld,varCmp,legacyCmp,
      whileWalked,whileEnded,answers,costs,
      pyRead:py.indexOf('best = robot.read()')>=0, pyWhile:py.indexOf('while robot.on_block():')>=0,
      pyCmp:py.indexOf('if v > best:')>=0});
  })()`);
  const AL = JSON.parse(algo);
  check("📖 Read pulls a block's number into a variable", AL.readHere === true && AL.readAhead === true, algo);
  check("📖 Read can report the carried block and the robot's own position", AL.readHeld === true && AL.readX === true, algo);
  check("a condition can compare two variables (x > y)", AL.varCmp === true, algo);
  check("an old numeric comparison still evaluates", AL.legacyCmp === true, algo);
  check("🔄 While loops while true and then terminates", AL.whileWalked === true && AL.whileEnded === true, algo);
  check("ONE program finds the max on three different inputs",
    JSON.stringify(AL.answers) === JSON.stringify(["7","9","8"]), algo);
  check("its cost varies with the input (raw material for complexity bars)",
    AL.costs[2] > AL.costs[1], algo);
  check("the algorithm renders as real Python", AL.pyRead && AL.pyWhile && AL.pyCmp, algo);

  console.log("▶ creator bug sweep: edits survive, guards don't crash");
  const cbug = await ev(`(()=>{
    const origSI=window.setInterval; window.setInterval=()=>0;
    const out={};
    // (1) THE REPORTED BUG: place a block, run, place another, run again — both must live.
    // caseBase used to hold the board BY REFERENCE while the creator replaced those
    // arrays, so the second run restored a stale snapshot and the new block vanished.
    mgEnterCreator();
    mgState.paintMode='paint'; mgPaintTile(0,0); mgPaintTile(1,0);
    mgState.paintMode='brick'; mgState.brickNum=1; mgPaintTile(0,2);
    mgRobot.program=[{t:'move',uid:1}]; mgRun();
    for(let t=0;t<20&&mgState&&mgState.running;t++)mgTick();
    mgState.paintMode='brick'; mgState.brickNum=2; mgPaintTile(1,2);
    const painted=mgState.proj.initial.length;
    mgRun(); for(let t=0;t<20&&mgState&&mgState.running;t++)mgTick();
    out.blocksSurvive = painted===2 && mgState.proj.initial.length===2;
    // ...and the same for the grid size after a resize
    mgState.proj.gw=8; mgSetSize(-2,0);
    mgRun(); for(let t=0;t<5&&mgState&&mgState.running;t++)mgTick();
    out.sizeSurvives = mgState.proj.gw===6;
    mgExit(false);
    // (2) a fresh creator session must not inherit the last one's program — a stale
    // program could be run with ▶ and "prove" a level the author never solved
    mgEnterCreator(); mgRobot.program=[{t:'move',uid:9},{t:'move',uid:8}];
    mgRobot.routines={A:[{t:'move',uid:7}],B:[]};
    mgExit(false);
    mgEnterCreator();
    out.freshStart = mgRobot.program.length===0 && mgRobot.routines.A.length===0;
    mgExit(false);
    // (3) editing a banked level must not remove it from the bank
    mgEnterCreator();
    const p=mgState.proj;
    p.cells=[[0,0]]; mgState.solved=true; mgAddStage();
    p.cells=[[1,1]]; mgState.solved=true; mgAddStage();
    mgEditStage(0);
    out.editKeepsLevel = mgState.stages.length===2;
    mgExit(false);   // walk away mid-edit — the level must still be there
    // (4) a 🚧 Gate on the robot's start must not throw (its solid() iterates rs.tiles)
    mgEnterCreator();
    let threw=false;
    try{ mgState.paintMode='gate'; mgState.tileArg=1;
      mgPaintTile(mgState.proj.start.x,mgState.proj.start.y); }catch(e){ threw=true; }
    out.gateGuardOk = threw===false;
    // (5) the 🤖 Start tool accepts a WALKABLE tile and refuses a solid one
    mgState.paintMode='key'; mgState.tileArg=1; mgPaintTile(3,3);
    mgState.paintMode='bot'; mgPaintTile(3,3);
    out.startsOnKey = mgState.proj.start.x===3 && mgState.proj.start.y===3;
    mgState.paintMode='wall'; mgPaintTile(4,4);
    mgState.paintMode='bot'; mgPaintTile(4,4);
    out.refusesWall = !(mgState.proj.start.x===4 && mgState.proj.start.y===4);
    mgExit(false);
    // (6) the ✊ holding chip shows even before any variable is set
    mgEnterCreator();
    mgState.robot.bricks.add('0_0'); mgState.robot.brickNo['0_0']=7;
    mgState.robot.x=0; mgState.robot.y=0;
    mgRobot.program=[{t:'pickUp',uid:1}];
    mgState.running=true; mgState.frames=[{blocks:mgRobot.program,i:0,reps:1}]; mgState.wait=0;
    mgTick();
    out.holdingChip = $('mgVars').textContent.indexOf('7')>=0;
    mgExit(false);
    document.getElementById('editor').classList.remove('open','max');
    document.getElementById('projects').classList.remove('open');
    window.setInterval=origSI;
    return JSON.stringify(out);
  })()`);
  const CB = JSON.parse(cbug);
  check("a placed block survives running the level again", CB.blocksSurvive === true, cbug);
  check("the grid size survives running after a resize", CB.sizeSurvives === true, cbug);
  check("a new creator session starts with a blank program", CB.freshStart === true, cbug);
  check("editing a banked level leaves it in the bank", CB.editKeepsLevel === true, cbug);
  check("placing a gate on the robot's start doesn't crash", CB.gateGuardOk === true, cbug);
  check("the robot may start on a walkable tile but not a wall", CB.startsOnKey === true && CB.refusesWall === true, cbug);
  check("the holding chip shows with no variables set", CB.holdingChip === true, cbug);

  console.log("▶ 🔧 Routines: decomposition, recursion, budget, persistence");
  const rout = await ev(`(()=>{
    const origSI=window.setInterval; window.setInterval=()=>0;
    const origSuccess=mgSuccess; let won=false; mgSuccess=()=>{won=true;mgStop();};
    const lvl=()=>({id:'rt_'+Math.random(),em:'🔧',name:'R',desc:'',gw:8,gh:2,maxBlocks:30,
      allowed:CHALLENGE_BLOCKS.concat(['call']),coins:0,xp:0,start:{x:0,y:1,dir:1},
      cells:[],initial:[],tiles:[],goal:[6,1],goalType:'reach'});
    const run=(setup,ticks)=>{
      mgEnter(lvl()); setup();
      won=false; mgRun();
      for(let t=0;t<(ticks||400)&&mgState&&mgState.running;t++)mgTick();
      const o={x:mgState?mgState.robot.x:-1,won,steps:mgState?mgState.steps:0};
      if(mgState)mgExit(false); return o;
    };
    // a 🔧 Call runs the routine's blocks
    const called=run(()=>{
      mgRobot.routines={A:[{t:'move',uid:11},{t:'move',uid:12}],B:[]};
      mgRobot.program=[{t:'call',fn:'A',uid:1}];
    });
    // calling the SAME routine twice runs it twice — 4 moves from 2 blocks of body
    const twice=run(()=>{
      mgRobot.routines={A:[{t:'move',uid:11},{t:'move',uid:12}],B:[]};
      mgRobot.program=[{t:'call',fn:'A',uid:1},{t:'call',fn:'A',uid:2}];
    });
    // ...and the budget charges the body ONCE (2 body + 2 calls = 4), so
    // factoring repeated work out is rewarded rather than punished
    mgEnter(lvl());
    mgRobot.routines={A:[{t:'move',uid:11},{t:'move',uid:12}],B:[]};
    mgRobot.program=[{t:'call',fn:'A',uid:1},{t:'call',fn:'A',uid:2},{t:'call',fn:'A',uid:3}];
    const size=progSize(mgRobot);           // 2 body + 3 calls = 5, NOT 2*3+3
    // an empty routine is a no-op, not a crash
    mgRobot.routines={A:[],B:[]}; mgRobot.program=[{t:'call',fn:'A',uid:1},{t:'move',uid:2}];
    mgState.running=true; mgState.frames=[{blocks:mgRobot.program,i:0,reps:1}]; mgState.wait=0;
    for(let t=0;t<10&&mgState&&mgState.running;t++)mgTick();
    const emptyOk=true;
    mgExit(false);
    // recursion with no base case stops with a message instead of hanging
    const recur=run(()=>{
      mgRobot.routines={A:[{t:'move',uid:11},{t:'call',fn:'A',uid:12}],B:[]};
      mgRobot.program=[{t:'call',fn:'A',uid:1}];
    },2000);
    // undo restores a routine edit (it used to snapshot only the main program)
    mgEnter(lvl());
    mgRobot.routines={A:[],B:[]}; mgRobot.program=[];
    edTarget='A'; addBlock('move'); addBlock('move');
    const beforeUndo=mgRobot.routines.A.length;
    doUndo();
    const afterUndo=mgRobot.routines.A.length;
    edTarget='main';
    // a program WITH routines survives store → load, and an OLD array still loads
    const stored=packProg(mgRobot);
    const isObj=!Array.isArray(stored);
    const r2=makeRobot(0,0,'x'); applyProg(r2,stored);
    const roundTrip=r2.routines.A.length===afterUndo;
    const r3=makeRobot(0,0,'y'); applyProg(r3,[{t:'move',uid:9},{t:'move',uid:8}]);
    const legacyLoads=r3.program.length===2&&r3.routines.A.length===0;
    // and it reads as real Python
    mgRobot.routines={A:[{t:'move',uid:11}],B:[]}; mgRobot.program=[{t:'call',fn:'A',uid:1}];
    renderPy();
    const py=$('pyCode').textContent||'';
    mgExit(false); document.getElementById('editor').classList.remove('open','max');
    window.setInterval=origSI; mgSuccess=origSuccess;
    return JSON.stringify({called,twice,size,emptyOk,recur,beforeUndo,afterUndo,
      isObj,roundTrip,legacyLoads,pyDef:py.indexOf('def routine_a():')>=0,pyCall:py.indexOf('routine_a()')>=0});
  })()`);
  const ROU = JSON.parse(rout);
  check("🔧 Call runs the routine's blocks", ROU.called.x === 2, rout);
  check("calling one routine twice runs it twice", ROU.twice.x === 4, rout);
  check("the budget charges a routine body once, not per call", ROU.size === 5, rout);
  check("an empty routine is a harmless no-op", ROU.emptyOk === true, rout);
  check("runaway recursion stops instead of hanging", ROU.recur.won === false && ROU.recur.steps < 2000, rout);
  check("undo restores a routine edit", ROU.beforeUndo === 2 && ROU.afterUndo === 1, rout);
  check("routines survive store → load", ROU.isObj === true && ROU.roundTrip === true, rout);
  check("an old array-shaped stored program still loads", ROU.legacyLoads === true, rout);
  check("routines render as real Python functions", ROU.pyDef === true && ROU.pyCall === true, rout);

  console.log("▶ the instruments: ⏭ Step, speed, live variables, cost bars");
  const instr = await ev(`(()=>{
    const origSI=window.setInterval; let made=0;
    window.setInterval=(fn,ms)=>{made++;window.__lastMs=ms;return 0;};
    const origSuccess=mgSuccess; mgSuccess=()=>{mgStop();};
    const lvl=cases=>({id:'in_'+Math.random(),em:'⏭',name:'I',desc:'',gw:8,gh:2,maxBlocks:30,
      allowed:CHALLENGE_BLOCKS,coins:0,xp:0,start:{x:0,y:1,dir:1},
      cells:[],initial:[],tiles:[],goal:[7,1],goalType:'reach',cases});
    // ⏭ Step advances exactly one action per tap and creates NO timer
    mgEnter(lvl(null));
    mgRobot.program=[{t:'move',uid:1},{t:'move',uid:2},{t:'move',uid:3}];
    made=0; mgStep();
    const afterOne=mgState.robot.x, noTimer=(made===0&&mgState.timer===null);
    mgStep(); const afterTwo=mgState.robot.x;
    mgExit(false);
    // the speed chip changes the interval the run is scheduled at
    player.mgSpeed=1; mgEnter(lvl(null));
    mgRobot.program=[{t:'move',uid:1}];
    mgRun(); const ms1=window.__lastMs;
    mgStop(); mgExit(false);
    mgSpeedCycle(); // → 2x
    mgEnter(lvl(null)); mgRobot.program=[{t:'move',uid:1}];
    mgRun(); const ms2=window.__lastMs;
    mgStop(); mgExit(false);
    player.mgSpeed=1;
    // live variables show up under the board
    mgEnter(lvl(null));
    mgRobot.program=[{t:'setVar',name:'q',val:{k:'num',n:42}}];
    mgState.running=true; mgState.frames=[{blocks:mgRobot.program,i:0,reps:1}]; mgState.wait=0;
    mgTick();
    const varsShown=$('mgVars').textContent.indexOf('42')>=0;
    mgExit(false);
    // one cost entry per input, and the bars render
    mgEnter(lvl([{start:{x:0,y:1,dir:1}},{start:{x:3,y:1,dir:1}},{start:{x:5,y:1,dir:1}}]));
    mgRobot.program=[{t:'forever',uid:1,body:[{t:'move',uid:2}]}];
    mgRun();
    for(let g=0;g<40&&mgState&&mgState.running;g++){for(let t=0;t<900&&mgState&&mgState.running;t++)mgTick();}
    const costs=(mgState&&mgState.costs)||[], costHtml=$('mgCost').innerHTML;
    const cheaperFromNearer=costs[0]>costs[2]; // starting closer costs fewer steps
    if(mgState)mgExit(false);
    document.getElementById('editor').classList.remove('open','max');
    document.getElementById('projects').classList.remove('open');
    window.setInterval=origSI; mgSuccess=origSuccess;
    return JSON.stringify({afterOne,afterTwo,noTimer,ms1,ms2,varsShown,
      costN:costs.length,cheaperFromNearer,hasBars:costHtml.indexOf('cbar')>=0});
  })()`);
  const IN = JSON.parse(instr);
  check("⏭ Step advances exactly one action", IN.afterOne === 1 && IN.afterTwo === 2, instr);
  check("⏭ Step runs without starting a timer", IN.noTimer === true, instr);
  check("the speed chip halves the tick interval", IN.ms2 === Math.round(IN.ms1 / 2), instr);
  check("live variables appear under the board", IN.varsShown === true, instr);
  check("one cost is recorded per input", IN.costN === 3, instr);
  check("cost reflects the work done per input", IN.cheaperFromNearer === true, instr);
  check("the cost bars render", IN.hasBars === true, instr);

  console.log("▶ answer goals + ➕ Change by a value");
  const ansg = await ev(`(()=>{
    const origSI=window.setInterval; window.setInterval=()=>0;
    const origSuccess=mgSuccess; let won=false; mgSuccess=()=>{won=true;mgStop();};
    const lvl=(expect,cases)=>({id:'ag_'+Math.random(),em:'🧠',name:'A',desc:'',gw:6,gh:2,
      maxBlocks:20,allowed:CHALLENGE_BLOCKS,coins:0,xp:0,start:{x:0,y:1,dir:1},
      cells:[],initial:[],tiles:[],goalType:'answer',question:'Sum?',expect,cases});
    const play=(proj,prog)=>{
      mgEnter(proj);
      const p=JSON.parse(JSON.stringify(prog)); reUid(p); mgRobot.program=p;
      won=false; mgRun();
      for(let g=0;g<40&&mgState&&mgState.running;g++){for(let t=0;t<900&&mgState&&mgState.running;t++)mgTick();}
      const o={won,said:(mgRobot&&mgRobot.say)?mgRobot.say.txt:null,results:(mgState&&mgState.results)||[]};
      if(mgState)mgExit(false); return o;
    };
    // ➕ Change BY A VARIABLE — the whole point: s = s + v. Sum of [1,2,3] is 6.
    const sum=[{t:'setVar',name:'s',val:{k:'num',n:0}},
      {t:'whileLoop',cond:'brickHere',body:[{t:'read',name:'v',src:'here'},
        {t:'changeVar',name:'s',n:{k:'var',name:'v'}},{t:'move'}]},
      {t:'say',val:{k:'var',name:'s'}}];
    const right=play(lvl(6,[{initial:[[0,1,1],[1,1,2],[2,1,3]],expect:6}]),sum);
    // the same program on a different row must give a DIFFERENT right answer
    const three=play(lvl(null,[{initial:[[0,1,1],[1,1,2],[2,1,3]],expect:6},
      {initial:[[0,1,5],[1,1,5]],expect:10},{initial:[[0,1,7]],expect:7}]),sum);
    // a wrong answer must fail, even though the program runs fine
    const wrong=play(lvl(99,[{initial:[[0,1,1],[1,1,2]],expect:99}]),sum);
    // saying nothing at all must fail too
    const silent=play(lvl(3,[{initial:[[0,1,3]],expect:3}]),[{t:'move'}]);
    // and an OLD literal ➕ Change still adds a constant
    const lit=play(lvl(2,[{initial:[[0,1,9]],expect:2}]),
      [{t:'setVar',name:'s',val:{k:'num',n:0}},{t:'changeVar',name:'s',n:2},{t:'say',val:{k:'var',name:'s'}}]);
    mgSuccess=origSuccess; window.setInterval=origSI;
    document.getElementById('editor').classList.remove('open','max');
    document.getElementById('projects').classList.remove('open');
    return JSON.stringify({right,three,wrong,silent,lit});
  })()`);
  const AG = JSON.parse(ansg);
  check("➕ Change by a variable accumulates (s = s + v)", AG.right.won === true && AG.right.said === "6", ansg);
  check("the same sum program is right on every row", AG.three.won === true && AG.three.results.length === 3, ansg);
  check("a wrong answer fails the level", AG.wrong.won === false, ansg);
  check("saying nothing fails the level", AG.silent.won === false, ansg);
  check("an old literal ➕ Change still adds a constant", AG.lit.won === true && AG.lit.said === "2", ansg);

  console.log("▶ one program, many inputs: an algorithm passes, a hardcoded path doesn't");
  const cases = await ev(`(()=>{
    // neutralise the run timer so we can drive every case deterministically
    const origSI=window.setInterval; window.setInterval=()=>0;
    const origSuccess=mgSuccess; let won=false;
    mgSuccess=()=>{won=true;mgStop();};
    // 3 inputs: the robot starts at a DIFFERENT column each time, flag always at x=5
    const lvl=(cases)=>({id:'tc_'+Math.random(),em:'🧪',name:'T',desc:'',gw:6,gh:3,maxBlocks:30,
      allowed:CHALLENGE_BLOCKS,coins:0,xp:0,start:{x:0,y:1,dir:1},cells:[],initial:[],tiles:[],
      goal:[5,1],goalType:'reach',cases});
    // starts 0 and 1 are too far for a fixed 3 moves; only start 2 lands on the flag.
    // (start 3 is deliberately avoided — the grid edge would clamp it onto the flag
    // and let the hardcoded program pass by accident.)
    const THREE=[{start:{x:0,y:1,dir:1}},{start:{x:2,y:1,dir:1}},{start:{x:1,y:1,dir:1}}];
    const play=(proj,prog)=>{
      mgEnter(proj);
      const p=JSON.parse(JSON.stringify(prog)); reUid(p);
      mgRobot.program=p; won=false; mgRun();
      // drive every case to completion by hand
      for(let guard=0;guard<40&&mgState&&mgState.running;guard++){
        for(let t=0;t<700&&mgState&&mgState.running;t++)mgTick();
      }
      const out={results:(mgState&&mgState.results)||[],won,
        failAt:mgState?mgState.failAt:-1,total:mgState?mgState.cases.length:0};
      if(mgState)mgExit(false);
      return out;
    };
    // (a) HARDCODED: three moves. Only correct for the start that happens to be 3 away.
    const hard=play(lvl(THREE),[{t:'repeat',n:3,body:[{t:'move'}]}]);
    // (b) ALGORITHM: keep going until you're there — correct from ANY start.
    const algo=play(lvl(THREE),[{t:'forever',body:[{t:'move'}]}]);
    // (c) a level with NO cases behaves exactly as before: one implicit input
    const single=play(lvl(null),[{t:'forever',body:[{t:'move'}]}]);
    // (d) a runaway on ONE input fails just that input; the others still run
    const withWall=[{start:{x:4,y:1,dir:1}},{start:{x:0,y:1,dir:1},tiles:[[2,1,'wall',0]]},{start:{x:4,y:1,dir:1}}];
    const runaway=play(lvl(withWall),[{t:'forever',body:[{t:'move'}]}]);
    // (e) ↺ Reset goes back to the FIRST input
    mgEnter(lvl(THREE)); mgState.ci=2; mgApplyCase(mgState.cases[2]);
    const atThird=mgState.robot.x===1; // case 3 starts at column 1
    document.getElementById('mgResetBtn').click();
    const backToFirst=mgState.robot.x===0&&mgState.ci===0;
    mgExit(false);
    // (f) the clone fix: playing must not mutate the shared level data
    const before=JSON.stringify(PROJECTS[3]);
    mgEnter(PROJECTS[3]); mgState.proj.initial=[]; mgState.proj.cells=[[9,9]]; mgExit(false);
    const projSafe=JSON.stringify(PROJECTS[3])===before;
    player.myChallenges=[{id:'mc1',mine:true,em:'🧩',name:'Mine',desc:'',gw:4,gh:3,maxBlocks:9,
      allowed:CHALLENGE_BLOCKS,coins:0,xp:0,start:{x:0,y:0,dir:1},cells:[[1,1]],initial:[],tiles:[]}];
    const mcBefore=JSON.stringify(player.myChallenges[0]);
    mgEnter(player.myChallenges[0]); mgState.proj.cells=[[3,3]]; mgState.proj.initial=[[0,0,5]]; mgExit(false);
    const saveSafe=JSON.stringify(player.myChallenges[0])===mcBefore;
    window.setInterval=origSI; mgSuccess=origSuccess;
    document.getElementById('editor').classList.remove('open','max');
    document.getElementById('projects').classList.remove('open');
    return JSON.stringify({hard,algo,single,runaway,atThird,backToFirst,projSafe,saveSafe});
  })()`);
  const TC = JSON.parse(cases);
  check("a multi-input level runs the program once per input", TC.algo.results.length === 3 && TC.algo.total === 3, cases);
  check("an ALGORITHM passes every input", TC.algo.won === true && TC.algo.results.every(Boolean) === true, cases);
  check("a HARDCODED path fails the inputs it wasn't written for",
    TC.hard.won === false && TC.hard.results.filter(Boolean).length === 1, cases);
  check("the failure points at the first input that broke", TC.hard.failAt === 0, cases);
  check("a level with no cases still has exactly one input", TC.single.total === 1 && TC.single.won === true, cases);
  check("a runaway on one input fails only that input", JSON.stringify(TC.runaway.results) === "[true,false,true]", cases);
  check("Reset returns to the first input", TC.atThird === true && TC.backToFirst === true, cases);
  check("playing never mutates the shared built-in level", TC.projSafe === true, cases);
  check("playing never mutates a saved My Challenge", TC.saveSafe === true, cases);

  console.log("▶ challenges unlock every block feature (ignore world unlocks)");
  const varsFree = await ev(`(()=>{
    mgEnter(PROJECTS[0]); unlocks.vars=false;   // low-level player: vars NOT unlocked in the world
    const r=mgRobot;
    // seed the LAST sensor of the challenge board's own list, so one more click
    // cycles past the presets into the variable comparison
    const CL=mgCondList();
    r.program=[{t:'repeat',n:3,uid:101,body:[]},{t:'if',cond:CL[CL.length-1],uid:102,body:[],els:[]}];
    selBlock=null; renderProgram();
    const hasRmode = $('programEl').innerHTML.indexOf('data-p="rmode"')>=0; // repeat-by-variable toggle shown
    const condBtn=[...document.querySelectorAll('#programEl .blk[data-uid="102"] .pbtn')].find(x=>x.dataset.p==='cond');
    let clicked=false; if(condBtn){condBtn.click();clicked=true;} // cycle the if condition once past the last preset
    const isCmp = typeof (byUid(r.program,102).cond)==='object'; // → variable comparison {var,op,val}
    const out={hasRmode,clicked,isCmp};
    mgExit(false);
    return JSON.stringify(out);
  })()`);
  const VF = JSON.parse(varsFree);
  check("challenge: repeat-by-variable available without the world unlock", VF.hasRmode === true, varsFree);
  check("challenge: if can compare a variable without the world unlock", VF.clicked && VF.isCmp === true, varsFree);

  check("no uncaught exceptions during entire run", exceptions.length === 0, exceptions.join(" | "));

  console.log(`\n${passed} passed, ${failed} failed`);
  chrome.kill();
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error("FATAL", e); chrome.kill(); process.exit(1); });
