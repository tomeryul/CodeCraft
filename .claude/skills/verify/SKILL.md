---
name: verify
description: How to run CodeCraft and drive it to a change, for /verify. The game is static files opened straight from disk in the pre-installed Playwright Chromium; no build, no server.
---

# Verifying a change in the running game

There is no build and no server. Open `index.html` from disk in Playwright
(`require('playwright')` works from anywhere; run scripts with
`NODE_PATH=/opt/node22/lib/node_modules`). Keep the scripts in the
scratchpad, not the repo.

```js
const pg = await (await chromium.launch()).newPage({ viewport:{width:390,height:844},
  hasTouch:true, isMobile:true, deviceScaleFactor:2 });
// Hebrew: before goto
await pg.addInitScript(()=>localStorage.setItem('codecraft_lang','he'));
await pg.goto('file:///home/user/CodeCraft/index.html'); await wait(1500);
await pg.selectOption('#ageMonth','6');
await pg.selectOption('#ageYear', String(new Date().getFullYear()-10));
await pg.click('#ageGo'); await pg.click('#playBtn'); await wait(2500);
```

## Where a fresh game lands

In lesson 1 (`mgState.proj.id === 't_move'`), on the **Board** tab. The
palette is on the Blocks tab: tap `button[data-tab="blocks"]` first, then
`#palette .pblk[data-t="move"]`. Four Moves and `#runBtn` solve it (the
win sets `player.academy.t_move`). Leave with `mgExit(false); navHome()`.

## Handles that are real taps

- Tabs: `#tabbar .tb[data-tab="play|create|me|world"]`
- A page's size button: `#hub .m-head .iconbtn.size`; inside a level, `#edMax`.
  One size is shared by the pages and the levels (`#editor.max`).
- Next up: `#hub .j-btn`. On the Academy step it opens the Academy page;
  a lesson row there is `#projects [data-lesson="<index>"]`.
- The world's journey card: `#journey .j-btn`, its pill `#journey .j-go`.

## Gotchas

- `offsetParent` is null for anything `position:fixed` (the age gate, the
  splash). Test visibility with `getComputedStyle(el).display`.
- A canvas that should stop animating: hash its pixels twice, 800ms apart.
  To count draws, wrap `CC_RIG.drawStill` for a second.
- PIL is broken in this container; compose a contact sheet as an HTML file
  of `<img>`s opened with `goto` (not `setContent`, which cannot load
  `file://` images) and screenshot it.
- Celebrations (`#ccCele`, `.cele`, `#bigToast`) sit over the next tap;
  remove them before continuing.
