# CodeCraft — Code Architecture

The game is a **single-page, zero-dependency, no-build** web app so it can be
served straight from GitHub Pages. To keep it readable and maintainable, the
source is split into small files by concern instead of one giant `index.html`.

## Why classic scripts (not ES modules or a bundler)?

All the game files are loaded as ordinary `<script src>` tags **in order**.
They share one global scope, exactly as the original single script did, so:

- no build step / bundler is needed (GitHub Pages stays trivial);
- functions and state defined in one file are visible in the others;
- the headless test harness (`test/smoke.js`) can read game globals via the
  DevTools protocol.

Because behavior depends on **load order**, keep the `<script>` order in
`index.html` intact when adding files, and cut new files only at top-level
boundaries (between functions), never inside one.

## Layout

```
index.html          Thin shell: <head> links + all the DOM markup + ordered <script> tags
css/
  styles.css        All styles (design tokens, HUD, sheets, editor, blocks, animations)
js/
  font.js           Async Google-Fonts (Fredoka) loader — never blocks the game
  sprites.js        CC_SPRITES: HD SVG art for world objects (trees, robots, buildings, hats…)
  extras.js         CC_EXTRAS: celebration overlay, Python syntax highlighting, splash mascot
  ui-icons.js       Swaps UI emoji/glyphs for inline SVG icons via a MutationObserver
  game/             The game itself, in load order:
    util.js         "use strict", global error handler, $, RNG, clamp/lerp/esc/uid
    constants.js    Grid size, tiles, resources, node HP, robot colors, save key
    state.js        Global game state + the action-skills system
    world.js        Procedural terrain, objects, animals
    robot.js        makeRobot, bag/energy helpers, hitNode/scoopWater
    blocks.js       Block DEFS/CATS, newBlock, value resolver
    interpreter.js  World helpers, condition eval, the block interpreter (doAction…)
    python.js       Blocks → real Python source
    editor.js       Block editor: render, palette, selection, undo/redo
    dragdrop.js     Long-press drag-and-drop of blocks (nest/reorder)
    engagement.js   XP/levels, quests, daily gift
    challenges.js   Build-project mini-games + Supabase online layer + community challenges
    shop.js         Unlock checks + the shop
    mentor.js       Byte, the keyword AI mentor
    fx.js           Toasts + Web Audio sfx
    tutorial.js     3-step onboarding coach
    hud.js          Top-bar HUD, fab/run wiring, challenge-creator controls
    input.js        Camera, pan/pinch/tap, object move/delete menu
    build.js        Manual (Minecraft-style) build mode: place/remove decor with gathered resources
    decor-tiles.js  CC_DECOR: autotiling — walls/roofs/paths/fences/hedges connect to neighbours, drawn procedurally
    render.js       Canvas draw loop bits: sprite cache, terrain chunks, world render
    loop.js         Fixed-step simulation loop
    save.js         localStorage save/load (+ offline fast-forward)
    boot.js         New-game/load, wire the Play button, register the service worker
sw.js               PWA service worker (network-first, precache list generated from the files)
manifest.json       PWA manifest
supabase/migrations Online challenges table + RLS
test/smoke.js       Headless-Chromium end-to-end/regression suite (no npm deps)
```

## Adding code

- New UI: add markup to `index.html`, styles to `css/styles.css`, behavior to
  the most relevant `js/game/*.js` file.
- New file: create it under `js/game/`, add a `<script src>` for it in
  `index.html` **at the right position in the load order**, and add it to the
  `ASSETS` list in `sw.js` (bump `CACHE`).
- Run `node test/smoke.js` before committing.
