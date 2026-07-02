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
    objects.set(key(r.x+1,r.y),{type:'tree',stage:2});
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

  check("no uncaught exceptions during entire run", exceptions.length === 0, exceptions.join(" | "));

  console.log(`\n${passed} passed, ${failed} failed`);
  chrome.kill();
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error("FATAL", e); chrome.kill(); process.exit(1); });
