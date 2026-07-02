# CodeCraft v3 — Variables, Visual Overhaul & Engagement Systems

> **RESUME NOTE (plan already approved once; implementation is ~40% done in the working tree, uncommitted).**
> Already applied to `index.html`: Memory category defs (`setVar/changeVar/countLoop/say` in `DEFS`/`CATS`/`newBlock`), `resolveVal`/`promptName`, interpreter support (count-loop frames w/ `cv/cur`, repeat-by-variable via `b.src`, comparison conditions in `evalCond`, new action cases), robot fields `vars/hat/say/pop`, XP/quest/daily-gift engine (`addXP`, `QUEST_POOL`, `qProg`, `renderQuests`, `dailyGift`, `hasLoop`), quest/XP/particle hooks in `doAction`/`sellInv`/`startRobot`/`checkUnlocks` (incl. new `vars` unlock at 250🪙 + confetti calls), gift-chest collect handling.
> **Remaining** (references already exist in code — these must be added or the page breaks): `burst()`/`confetti()` particle systems + draw integration; `qProg`-referenced UI: `#questBtn`, quests sheet HTML/CSS, `#lvlChip/#xpBar` in top bar + `updateHud` additions; `varWatch` UI + editor `renderList` params for new blocks (vname/vkind/vval/cvar/cop/tdec…); `toPy`/`pyCond`/`pyVal` cases; treasure placement in `genObjects`; `gift` in `OBJ_EM`/`solidObj`/tap-names; save/load of `player`, `r.vars`, `r.hat` + `fillQuests()` on boot; `dailyGift()` call in playBtn; shop Style(hats)+Sound rows, remove top-bar `muteBtn` (replaced by `questBtn`); visual overhaul (chunk cache, water anim, sway, clouds, day tint, fireflies, squash/pop, say bubbles, hat draw, Fredoka font, 3D blocks CSS, splash floaters); mentor BRAIN updates; extended tests in `test/smoke.js`; screenshots; commit+push.
> ⚠️ `index.html` in its current state references undefined functions (`burst`, `confetti`, `qProg` UI elements) — finishing the remaining items is required before the game runs.

## Context

User request (translated from Hebrew): (1) add **int and string variables** so loops can work with increasing values — smarter programs; (2) a **significant visual upgrade** (suggested Canva / design tools / web research); (3) make the game **more interesting** and find ways to make players **want to keep coming back**.

All work happens in `index.html` (single-file game, branch `claude/open-world-programming-game-l8rgv1`), plus `test/smoke.js`, `README.md`. Design research done: juice = particles + squash/stretch + sine-based motion; retention research says quests/daily rewards work but must celebrate returning, never punish absence (no loss-streaks for kids).

---

## A. Variables & smarter programming (int + string)

New block category **🧠 Memory** (unlock: earn 250 🪙 total; continues the existing `unlocks` ladder in `checkUnlocks()`).

**New blocks** (extend `DEFS`, `newBlock`, `doAction`, `toPy` in index.html):
- **Set** `📦 x = value` — value is a number (−/+ buttons), a text string, or another variable; variable names & strings entered via `prompt()` (mobile-safe), kind cycles 123/abc/📦.
- **Change** `x by +n` — the increment primitive (numbers, can be negative).
- **Count loop** `🔢 Count i from 1 to N` — container block; sets the loop variable each iteration ("loops with increasing values"). Python: `for i in range(1, N+1):`.
- **Say** `💬 value` — robot shows a speech bubble (canvas-rendered, ~2.5 s). Gives strings a visible purpose. Python: `robot.say(x)`.
- **Repeat by variable** — existing `repeat` block's count can toggle number ↔ variable. Python: `for i in range(x):`.
- **Comparison conditions** — `if` conditions extended beyond the `CONDS` strings with `{var, op(>,<,=), val}`; edited via cycling param chips like existing cond UI. Python: `if x > 3:`.

**Runtime**: `r.vars = {}` per robot (persisted — additive field in save v2, no format break; old saves default to `{}`). `resolveVal()` helper; count-loop implemented as an interpreter frame variant that updates the robot var on each rep (extend the frame handling in `tickRobot`). `r.say={txt,until}` drawn above the robot.

**Live variable watch** — small strip in the editor (`🧠 x=3 count=7`) refreshed by the existing `updateExecHighlight` interval, so kids *see* values change while the program runs. Key educational payoff.

## B. Visual overhaul (significant, no build step)

**Canvas rendering** (in `draw()` and helpers):
- **Terrain chunk cache**: bake 16×16-tile chunks to offscreen canvases with rich static detail (grass specks, rocky dots, sand grain, soft tile-edge shading). Terrain never mutates after gen → no invalidation needed. Frees per-frame budget for effects and fixes the roadmap perf item.
- **Animated water**: sine ripple highlights + foam edge where water meets land (drawn per-frame only on visible water tiles, over the cached chunks).
- **Wind**: trees/flowers sway with layered sine (rotate at draw time).
- **Particle system** (single array, pooled): leaf burst on tree collect, stone chips on mining, coin sparkles on sell, dust puffs behind moving robots, ambient crystal glints, fireflies at "evening"; screen-space confetti on unlocks/level-ups/quest claims.
- **Squash & stretch**: robots stretch when starting to move, pop-scale when collecting (decaying `r.pop` factor); antenna light pulses while running.
- **Ambience**: drifting cloud shadows + soft white clouds (parallax); very subtle 3-minute warm/cool day cycle tint (kept faint on purpose).
- Nicer selection ring (glow gradient), pulsing home-territory border.

**UI/CSS**:
- **Fredoka** Google Font (playful rounded; system fallback keeps offline PWA working).
- Scratch-style **"3D" blocks**: darker bottom edge, press-down active state, bounce-in animation when a block is added.
- Glassier chips/panels, richer gradients, micro-interactions on all buttons.
- **Splash upgrade**: animated gradient sky, floating parallax emoji (blocks/stars/robots), bigger logo treatment.
- **Canva (time-boxed, optional)**: try Canva MCP `generate-design` → `export-design` for a splash hero illustration; commit as `assets/splash.png` if it looks good, else keep the CSS-art splash. Never a blocker.

## C. Engagement systems (ethical — reward returning, never punish absence)

1. **Inventor Level (player XP)** — XP from collecting (1), selling (value/2), building (5), quests, unlocks. Curve `xpNeed = 50·level^1.4`. Level badge + thin progress bar in the top bar; level-up = confetti + coins.
2. **Robot hats 🎩** — cosmetic emoji hats unlocked every 2 levels (⛑️🎩🎓👑🤠🥳…), equipped per robot from a new shop "Style" section, drawn above the robot. Collection/dress-up drive.
3. **Quest board 📜** — new top-bar button + sheet; always 3 active quests drawn from a pool (collect X of Y, sell for X, build N saplings/bridges, run a program with a loop, run 2 robots at once, make a robot Say something…). No timers, no expiry — pure "one more goal" pull. Claim → coins + XP + confetti; a badge dot marks claimable quests.
4. **Daily gift 🎁** — first launch each calendar day: gift chest with coins scaled by *total days played* ("Day 7 of your adventure!"). Explicitly not a consecutive streak — no loss anxiety (per the retention research).
5. **World treasure** — ~10 gift chests 🎁 scattered far from spawn at generation; collecting gives coins + XP (makes exploration itself rewarding).
6. **Stats panel** in the quest sheet (total collected, earned, distance walked, robots owned) — numbers that go up.

**Persistence**: all additive fields on save v2 (`xp, level, hats, quests, lastGiftDay, daysPlayed`, `robot.vars`, `robot.hat`) with defaults for older saves.

## D. Files & verification

**Files**: `index.html` (all game changes), `test/smoke.js` (new tests), `README.md` (feature blurbs), optional `assets/splash.png`.

**New tests** in `test/smoke.js`:
- VM: `set c=0; count i 1→3 { change c by 2 }` ⇒ `r.vars.c===6`, `r.vars.i===3`.
- `say` sets the bubble; comparison condition `if c > 5` takes the true branch.
- Python gen contains `for i in range(1, 4):`, `c = c + 2`, `robot.say(...)`.
- XP: collecting grants XP; quest progress increments.
- Full existing suite (15 checks) must stay green — same save-format guarantees.

**Verify**: `node --check` on extracted script → `node test/smoke.js` → headless mobile screenshots (splash, world with effects, editor with Memory blocks + variable watch, quest board) → commit & push to `claude/open-world-programming-game-l8rgv1`.
