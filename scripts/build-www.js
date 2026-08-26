#!/usr/bin/env node
/* Stage the game into www/ for Capacitor.
   ----------------------------------------------------------------------
   There is no bundler here and there does not need to be one: the app is
   already a set of plain files. All this does is copy the right ones.

   The file list is READ FROM sw.js's ASSETS array rather than written out
   again here. That array is already the app's own statement of what it is
   made of — keeping a second list in this script would mean every new file
   had to be remembered in two places, and the native build would quietly
   ship without it the day someone forgot.

   sw.js itself is deliberately NOT copied. A service worker exists to make
   a website work offline; a packaged app is already local, and pointing a
   network-first worker at capacitor://localhost only adds a way to fail.
   js/game/native.js skips registration when running natively. */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "www");

function assetList(){
  const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  const m = sw.match(/const ASSETS\s*=\s*\[([\s\S]*?)\]/);
  if(!m) throw new Error("could not find the ASSETS array in sw.js");
  return m[1].split(",")
    .map(s => s.trim().replace(/^["']|["']$/g, ""))
    .filter(s => s && s !== "./")          // "./" is the page itself, covered by index.html
    .map(s => s.replace(/^\.\//, ""));
}

function copy(rel){
  const from = path.join(ROOT, rel);
  const to = path.join(OUT, rel);
  if(!fs.existsSync(from)) throw new Error("sw.js lists a file that does not exist: " + rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  return fs.statSync(from).size;
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const files = assetList();
let bytes = 0;
for(const f of files) bytes += copy(f);

// The licence has to travel with the font it covers (SIL OFL 1.1).
if(fs.existsSync(path.join(ROOT, "fonts/OFL.txt"))) bytes += copy("fonts/OFL.txt");

// A packaged app has no service worker to unregister a stale one for it, so
// make sure we did not ship one by accident.
if(fs.existsSync(path.join(OUT, "sw.js"))) throw new Error("sw.js must not be bundled into the app");
if(!fs.existsSync(path.join(OUT, "index.html"))) throw new Error("www/index.html is missing");

console.log("www/ ← " + files.length + " files, " + (bytes/1024).toFixed(0) + " KB");
