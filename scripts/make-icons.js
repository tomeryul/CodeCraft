#!/usr/bin/env node
/* Render the app icons from the game's own mascot.
   ----------------------------------------------------------------------
   The mascot on the splash screen is drawn in CSS, not shipped as art, so
   it can be rendered at any size without going soft — which matters,
   because the only icon in the repo was 512px with rounded corners and
   transparency baked in. iOS wants 1024x1024, square and fully opaque: it
   applies its own mask, so a pre-rounded icon comes out double-rounded,
   and an alpha channel in the App Store icon is rejected outright.

   Four masters come out of here:
     icon-1024.png      opaque square, for iOS and the store listing
     icon-fg.png        the robot alone with adaptive-icon safe padding
     icon-bg.png        the icon's purple, the adaptive background layer
     splash.png         the robot on the dark the app starts on: the native
                        launch screen, which used to be the whole icon —
                        square and all — pasted in the middle of it

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
const DARK = "#1a1230";         // capacitor.config.json's backgroundColor: what a launch screen stands on

/* The robot is the one on the home-screen icon (icon-512.png) — .mascot in
   styles.css is measured off it — so the store icon is given that icon's
   own setting too: its purple, lighter at the top, and the pale arc across
   the top-right corner. `scale` blows the mascot's 116px body up to the
   canvas; `kind` says what goes behind it:
     icon    the gradient and the arc, opaque — iOS and the store listing
     fg      nothing, transparent — Android's adaptive foreground
     bg      the gradient alone — Android's adaptive background
     launch  the flat dark the app starts on — the native launch screen */
function page(size, scale, kind){
  const grad = "linear-gradient(180deg,#6a45e0 0%,#4a25bb 100%)";
  const arc = "radial-gradient(circle at 84% -6%,rgba(255,255,255,.085) 0 34%,rgba(255,255,255,0) 34.4%)";
  const back = kind==="icon" ? arc+","+grad : kind==="bg" ? grad : kind==="launch" ? DARK : "transparent";
  /* on the icon the robot stands a little below centre, where it stands on
     icon-512.png: the light on its antenna needs the room above it */
  const drop = kind==="icon" ? Math.round(size*0.047) : kind==="fg" ? Math.round(size*0.03) : 0;
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="./css/styles.css">
<style>
  html,body{margin:0;padding:0;width:${size}px;height:${size}px;overflow:hidden;}
  body{background:${back};display:flex;align-items:center;justify-content:center;}
  /* freeze the idle animations so every render is identical */
  *,*::before,*::after{animation:none!important;transition:none!important;}
  .stage{transform:translateY(${drop}px) scale(${scale});transform-origin:center center;}
  .mascot{margin:0;}
  .mascot .mshadow{display:none;}
  ${kind==="fg"?".mascot .mbody{box-shadow:inset 0 2px 0 rgba(255,236,150,.75)!important;}":""}
</style></head><body>
<div class="stage"><div class="mascot"><i class="ant"></i><i class="antlight"></i>
<div class="mbody"><span class="eye"><i></i></span><span class="eye"><i></i></span></div>
</div></div></body></html>`;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch(fs.existsSync(CHROME) ? { executablePath: CHROME } : {});

  const shots = [
    // name,           size, scale, kind
    ["icon-1024.png",  1024, 6.35,  "icon"  ],  // the robot 72% of the width, as on icon-512.png
    ["icon-fg.png",    1024, 3.9,   "fg"    ],  // padded for adaptive cropping
    ["icon-bg.png",    1024, 0,     "bg"    ],
    /* One launch image for every screen: the tool crops the middle out of
       it, so the robot is small enough to survive the narrowest crop — and
       comes out about the size it is on the game's own first screen. */
    ["splash.png",     2732, 3.2,   "launch"]
  ];

  for (const [name, size, scale, kind] of shots) {
    const opaque = kind !== "fg";
    const pg = await b.newPage({ viewport:{ width:size, height:size }, deviceScaleFactor:1 });
    // written next to the stylesheet and loaded over file://, because a page
    // set with setContent() lives on about:blank and cannot pull in a
    // file:// stylesheet — the robot silently came out as a blank square.
    const tmp = path.join(ROOT, ".icon-render.html");
    fs.writeFileSync(tmp, page(size, scale, kind));
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
