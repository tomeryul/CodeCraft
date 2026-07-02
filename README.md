# 🤖 CodeCraft — Program Your World

An **open-world game that teaches programming** to kids and teens — no levels, no lessons, no puzzles. Just a living world where **everything runs on your code**.

**▶ Play it:** https://tomeryul.github.io/CodeCraft/

Built as a single `index.html` — no dependencies, no build step, works offline after first load. Mobile-first: designed for phones and tablets, great on desktop too.

## What is it?

You start with one small robot in a big procedurally generated world. You never control it directly — you **program** it with drag-free, tap-to-build code blocks:

- ⬆️ Move, ↩️ Turn, ✋ Collect, ⤵️ Drop, 🔨 Build, ⏱️ Wait
- 🔁 Repeat and ♾️ Forever loops
- ❓ If / Else conditions (tree ahead? blocked? bag full?)
- 🧭 Face Nearest, 🏠 Go Home (pathfinding), 💰 Sell All

The editor has undo/redo and block duplication, and a 3-step interactive tutorial gets first-time players to their first running program in under a minute.

Press ▶ and watch your code come alive in the world.

## The world is alive

- 🌱 Trees grow from saplings and regrow after harvesting
- 🪨 Rocks, ⛓️ iron and 💎 crystals respawn over time
- 🐰 Animals wander around
- 🤖 Every robot keeps running its program simultaneously — build a fleet and automate everything
- ⏰ The world keeps evolving while you're away — come back to regrown forests and a "while you were away" report

## No levels — just powers to unlock

You don't pass stages; you expand what you can automate. New abilities unlock naturally by playing:

| Power | How to unlock |
|---|---|
| 🔁 Loops | Collect 5 resources |
| ❓ Logic | Sell something at the market |
| 🧭 Smart blocks | Earn 150 🪙 or own 2 robots |

## From blocks to real Python 🐍

Every block program is shown live as **real Python** in the editor's Python tab:

```python
while True:
    robot.face_nearest("tree")
    if robot.sees("tree"):
        robot.collect()
    robot.move()
```

Kids realize they've been writing Python all along.

## AI mentor 🦉

Byte, the in-game mentor, answers questions like *"Why isn't my robot moving?"* (it actually inspects your robot's state), explains loops and logic, and suggests open-ended projects — hints, never solutions.

## Gameplay loop

1. Program a robot to harvest wood 🌳
2. Sell at the market 🏪 for coins 🪙
3. Buy more robots, bigger bags, speed boosts 🛒
4. Build bridges 🌉 to reach new lands, plant tree farms 🌱, store goods in chests 📦
5. Chain robots into supply lines — harvester → courier → seller
6. Automate everything with `Forever` loops and watch your empire run itself ♾️

Progress is saved automatically in your browser, and you can export/import your world as a backup file from the 🛒 shop. The game is an installable PWA and works offline after the first load.

## Hosting on GitHub Pages

This repo is ready for GitHub Pages:

1. Go to **Settings → Pages**
2. Under **Build and deployment**, choose **Deploy from a branch**
3. Select branch **`main`**, folder **`/ (root)`**, and save

The game will be live at `https://<your-username>.github.io/CodeCraft/`.

## Development

The game lives in [`index.html`](index.html) — vanilla JS + Canvas, zero runtime dependencies. Open it in any browser to play locally. `manifest.json` and `sw.js` provide PWA install + offline support.

### Tests

```bash
node test/smoke.js          # drives the real game in headless Chromium (CDP, no npm deps)
CHROME=/path/to/chrome node test/smoke.js   # custom browser binary
```

The suite covers the block VM (loops, if/else), Python code generation, editor undo/redo, and save/load persistence including offline fast-forward of growth and respawn timers.
