#!/usr/bin/env node
/* Render the app icons from the game's own mascot.
   ----------------------------------------------------------------------
   The mascot on the splash screen is drawn in CSS, not shipped as art, so
   it can be rendered at any size without going soft — which matters,
   because the only icon in the repo was 512px with rounded corners and
   transparency baked in. iOS wants 1024x1024, square and fully opaque: it
   applies its own mask, so a pre-rounded icon comes out double-rounded,
   and an alpha channel in the App Store icon is rejected outright.

   Three masters come out of here:
     icon-1024.png      opaque square, for iOS and the store listing
     icon-fg.png        the robot alone with adaptive-icon safe padding
     icon-bg.png        flat brand purple, the adaptive background layer

   Android's adaptive icon crops the foreground to a circle, squircle or
   whatever the launcher fancies, and only the middle ~66% is guaranteed
   visible — hence the padding on the foreground layer.

   Run: node scripts/make-icons.js   (needs the bundled Chromium) */
"use strict";
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "build");
const CHROME = process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BG = "#4a2f9e";           // the mid stop of the splash gradient

/* scale is the mascot's natural 104px body blown up to fill the canvas */
function page(size, scale, opaque, shadow){
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="./css/styles.css">
<style>
  html,body{margin:0;padding:0;width:${size}px;height:${size}px;overflow:hidden;}
  body{background:${opaque?BG:"transparent"};display:flex;align-items:center;justify-content:center;}
  /* freeze the idle animations so every render is identical */
  *,*::before,*::after{animation:none!important;transition:none!important;}
  .stage{transform:scale(${scale});transform-origin:center center;
         ${shadow?"filter:drop-shadow(0 14px 26px rgba(0,0,0,.32));":""}}
  .mascot{margin:0;}
  .mascot .mshadow{display:none;}
</style></head><body>
<div class="stage"><div class="mascot"><i class="ant"></i><i class="antlight"></i>
<div class="mbody"><span class="eye"><i></i></span><span class="eye"><i></i></span></div>
</div></div></body></html>`;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: CHROME });

  const shots = [
    // name,           size, scale, opaque, shadow
    ["icon-1024.png",  1024, 5.7,   true,   true ],
    ["icon-fg.png",    1024, 4.0,   false,  false],  // padded for adaptive cropping
    ["icon-bg.png",    1024, 0,     true,   false]
  ];

  for (const [name, size, scale, opaque, shadow] of shots) {
    const pg = await b.newPage({ viewport:{ width:size, height:size }, deviceScaleFactor:1 });
    // written next to the stylesheet and loaded over file://, because a page
    // set with setContent() lives on about:blank and cannot pull in a
    // file:// stylesheet — the robot silently came out as a blank square.
    const tmp = path.join(ROOT, ".icon-render.html");
    fs.writeFileSync(tmp, page(size, scale, opaque, shadow));
    await pg.goto("file://" + tmp, { waitUntil:"load" });
    await pg.evaluate(() => document.fonts.ready);
    if (scale === 0) await pg.evaluate(() => { document.querySelector(".stage").style.display = "none"; });
    await pg.waitForTimeout(150);
    await pg.screenshot({ path: path.join(OUT, name), omitBackground: !opaque });
    await pg.close();
    fs.unlinkSync(tmp);
    const px = fs.readFileSync(path.join(OUT, name));
    console.log(`  ${name.padEnd(15)} ${px.readUInt32BE(16)}x${px.readUInt32BE(20)}  ${(px.length/1024).toFixed(0)}KB` +
                (opaque ? "  opaque" : "  transparent"));
  }
  await b.close();
})();
