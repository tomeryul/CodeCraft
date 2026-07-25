# 🤖 CodeCraft — Program Your World

An **open-world game that teaches programming** to kids and teens — no levels, no lessons, no puzzles. Just a living world where **everything runs on your code**.

**▶ Play it:** https://tomeryul.github.io/CodeCraft/

Built as a single `index.html` — no dependencies, no build step, works offline after first load. Mobile-first: designed for phones and tablets, great on desktop too.

## What is it?

You start with one small robot in a big procedurally generated world. You never control it directly — you **program** it with drag-free, tap-to-build code blocks:

- ⬆️ Move, ↩️ Turn, ✋ Collect, 🪓 Chop, ⛏️ Mine, 🪣 Scoop (water), ⤵️ Drop, 🔨 Build, 😴 Rest, ⏱️ Wait
- 🔁 Repeat, ♾️ Forever and 🔄 While loops (repeat count can be a variable; While keeps going *until* a condition changes)
- ❓ If / Else conditions (tree ahead? wall ahead? block under me? `x > 5`? **`x > y`** — compare two variables)
- 🧭 Face Nearest, 🏠 Go Home (pathfinding), 💰 Sell All
- 🔧 **Routines**: name a group of steps once, then 🔧 Call it from anywhere — including from inside itself (recursion). The block budget charges a routine's body **once** however many times you call it, so breaking a problem into named pieces is rewarded, not punished. They show up in the Python view as real `def routine_a():` functions.
- 🧠 Memory: 📦 Set (numbers & strings), ➕ Change (by a number **or by another variable**, so `total = total + v` works), 🔢 Count loops with a rising index, 📖 **Read** (pull a block's number, or the robot's own position, into a variable), 💬 Say (speech bubbles!) — with a **live variable watch** in the editor

Big resources take **several hits** to harvest (a tree needs a few chops), so gathering naturally pushes you toward loops — and every job burns **⚡ energy**, so a busy robot must 😴 Rest (put it in the loop!) before it gets too tired to work. Blocks can be **long-press dragged** to nest or reorder them, and in the maximized editor a double-tap deletes.

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
| 🧠 Memory (variables) | Earn 250 🪙 |

Plus an **Inventor Level** (XP from everything you do), an endless **quest board** 📜 with no timers or FOMO, a **daily gift** that grows with total days played, collectible **robot hats** 🎩, and **treasure chests** 🎁 hidden far from home to reward explorers.

**⚡ Skills** level up slowly with real practice — Woodcutting, Mining, Agility, Building and Trading each grant a growing perk (bonus resources, faster robots, free builds, better prices).

**🧠 Algorithms** challenges hand your program **several different inputs** and run it on all of them — you pass only if it solves every one, including a hidden input you never see. That's the difference between an algorithm and a memorised path: find the biggest number, add up a row, count what passes a test, search for a value, escape any maze. Failing tells you which input broke it. **⏭ Step** runs one action at a time, live **variables** show under the board, and after a run a little bar chart shows how many steps each input cost — so a child *sees* one program grow gently and another explode.

**🏗️ Build Projects** are mini-game coding challenges a few levels above normal play: solve a blueprint (Big House → Race Car → Theme Park) inside a tight block budget that forces nested loops — finished builds appear in your world forever (tap one to 🚚 move or 🗑 delete it). Making your own challenge? Set the **map size** and budget and use the **full block palette** (loops, conditions, variables) — challenges run on the same interpreter, so they can be as clever as you like. In the maximized editor you can also double-tap a block to delete it.

**🏦 Bank:** deposit a robot's whole bag with the Bank All block (or by dropping into a chest); the bank is never sold unless you sell it, and any robot can **build straight from the bank** when its own bag runs short — stockpile now, build later.

**🌍 Online (optional):** minimal email + password accounts and **community challenges** — design your own blueprint challenge (you must solve it yourself first), publish it, and let players everywhere try it. Powered by Supabase with row-level security; the game stays fully playable offline if online mode isn't configured.

### Online setup (Supabase)

The client is wired to a Supabase project via `SB` in `index.html`. To point it at your own project: create a Supabase project, run [`supabase/migrations/0001_challenges.sql`](supabase/migrations/0001_challenges.sql), and set `SB.url` / `SB.key` to your project URL and publishable (anon) key. For a friction-free kids experience, turn **off** *Authentication → Sign In / Up → Email → Confirm email* so players can start right after signing up.

## From blocks to real Python 🐍

Every block program is shown live as **real Python** in the editor's Python tab:

```python
c = 0
while True:
    robot.face_nearest("tree")
    if robot.sees("tree"):
        robot.collect()
        c = c + 1
        robot.say(c)
    else:
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
