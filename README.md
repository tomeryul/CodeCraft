# 🤖 CodeCraft — Program Your World

An **open-world game that teaches programming** to kids and teens — no levels, no lessons, no puzzles. Just a living world where **everything runs on your code**.

**▶ Play it:** https://tomeryul.github.io/CodeCraft/

Built as a single `index.html` — no dependencies, no build step, works offline after first load. Mobile-first: designed for phones and tablets, great on desktop too.

## What is it?

You start with one small robot in a big procedurally generated world. You never control it directly — you **program** it with drag-free, tap-to-build code blocks:

- ⬆️ Move, ↩️ Turn, ✋ Collect, ⤵️ Drop, 🔨 Build, ⏱️ Wait
- 🔁 Repeat and ♾️ Forever loops
- ❓ If-conditions (tree ahead? blocked? bag full?)
- 🧭 Face Nearest, 🏠 Go Home (pathfinding), 💰 Sell All

Press ▶ and watch your code come alive in the world.

## The world is alive

- 🌱 Trees grow from saplings and regrow after harvesting
- 🪨 Rocks, ⛓️ iron and 💎 crystals respawn over time
- 🐰 Animals wander around
- 🤖 Every robot keeps running its program simultaneously — build a fleet and automate everything

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

Progress is saved automatically in your browser.

## Hosting on GitHub Pages

This repo is ready for GitHub Pages:

1. Go to **Settings → Pages**
2. Under **Build and deployment**, choose **Deploy from a branch**
3. Select branch **`main`**, folder **`/ (root)`**, and save

The game will be live at `https://<your-username>.github.io/CodeCraft/`.

## Development

Everything lives in [`index.html`](index.html) — vanilla JS + Canvas, zero dependencies. Open it in any browser to play locally.
