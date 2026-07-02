# CodeCraft — Product Review & Improvement Roadmap

## Context

CodeCraft (single-file `index.html`, ~1,250 lines, vanilla JS + Canvas, deployed via GitHub Pages) shipped as an MVP of the open-world programming game. This review identifies weaknesses, missing features, UX issues, and technical limits; proposes new features and improvements prioritized by impact vs effort; and lays out a refactor plan for scalability. Findings below are verified against the actual code, not guesses.

---

## 1. Real bugs & technical weaknesses (verified in code)

**P0 — world slowly dies across sessions (data-loss bug).**
`saveNow()` strips `growAt` from saved objects and never saves `respawnQ`. After a reload: saplings whose `growAt` is `undefined` never grow (the growth check requires `growAt!==undefined`), and every collected tree/rock/iron/crystal that was awaiting respawn is lost forever. A player who plays a few sessions ends up in a barren world — the opposite of "the world never stops."
→ Fix: persist `respawnQ` and `growAt` as *relative* ms remaining; rehydrate on load.

**P0 — freeze after tab suspension.** Robot ticks use absolute time: `while(t>=r.nextAct){...}`. rAF pauses in background tabs, so on resume after an hour, each robot executes ~10,000 ticks in one frame → multi-second freeze. → Clamp catch-up per frame (or turn it into a feature: bounded offline fast-forward).

**No offline progression.** Sim time = rAF time, so nothing grows or produces while the tab is closed. The spec's core fantasy ("factories keep producing") breaks between sessions. → On load, fast-forward growth/respawns by elapsed wall time; optionally simulate robots for a capped number of ticks ("While you were away: +34 🪵").

**Fragile persistence.** One localStorage key, no export/import, no slots, no schema migrations. Browser storage eviction = total progress loss. Kids will lose worlds and churn.

**Interpreter ceiling.** No `else` branch, no AND/OR conditions, no variables, no custom functions, no events/timers. The spec's "Advanced/Expert" tiers (variables, functions, events, robot networks) have no representation.

**Python is display-only.** The 🐍 tab renders code but can't be edited or run — the promised blocks→Python transition is one-way.

**Rendering has no caching.** Every frame redraws every visible tile + object. Fine at default zoom; at min zoom (0.4) on a low-end phone it's ~1,500+ tiles/frame. No terrain layer cache, no battery saver, no FPS cap.

**Mentor is keyword-matching.** ~14 canned answers; anything off-script gets the fallback. Fine for MVP, far from the spec's "AI companion."

**No tests committed.** The CDP smoke test used during development lives only in scratchpad. The VM/interpreter is pure logic and eminently unit-testable, but nothing guards regressions.

**Monolith ceiling.** All state is module-global; sim calls UI directly (`sellInv` → `toast`/`updateHud`); no modules/TS/lint. Fine at 1.2k lines, painful at 5k.

Minor: `updateExecHighlight` polls the DOM every 350 ms even with the editor closed; camera clamp lets you center past world edges; robots overlap on one tile; animals are purely decorative.

## 2. UX / UI issues

1. **Editor hides the world (biggest UX flaw on mobile).** The sheet is 66 vh, so when a kid presses ▶ they can't see their robot react — and the live green block-highlight (the best teaching device in the game) plays to an audience of zero. → Half-height sheet + offset camera so the selected robot stays visible above it.
2. **Container insertion is undiscoverable.** "Tap the Repeat block, then tap a palette block to put it inside" is never taught interactively; the only hint is a gray text row. First-session kids will build flat programs and stall.
3. **No drag-and-drop / no restructuring.** Blocks can move ↑↓ only within their own list; you can't move an existing block *into* or *out of* a loop — you delete and rebuild. No undo, no copy/duplicate. One mis-tap destroys work.
4. **No onboarding flow.** One mentor wall-of-text, then editors auto-open/close on a timer. Needs a 3-step interactive tutorial (place Move → press Run → collect a tree) with celebration.
5. **Top-bar bag chip grows unbounded** with inventory emoji and collides with the icon buttons on narrow phones.
6. **Toast/sfx spam** from automated sellers (a Forever-seller fires a toast + chord every cycle). Aggregate ("+120 🪙 in the last minute").
7. **Emoji art is inconsistent across platforms** (flat on Windows, different metrics on Android) and the 🏪 market renders as a "24" convenience store — unclear iconography. No i18n (RTL/Hebrew would matter for this user), no reduced-motion, no accessibility.
8. **No feedback numbers.** Collecting shows no floating "+1 🪵"; selling shows no coin fly-to-HUD. Juice is what makes automation satisfying to watch.

## 3. Missing vs. original spec

| Spec item | Status |
|---|---|
| Multiplayer shared world, trading, visiting | ❌ needs backend |
| Player economy / businesses | ❌ (single-player market only) |
| Vehicles, drones, trains, doors, energy systems | ❌ (robots only) |
| Events, timers, variables, functions, arrays | ❌ |
| 4-stage language ladder (blocks → Scratch → simple Python → real Python) | ⚠️ stage 1 + read-only stage 4 |
| Real AI mentor | ⚠️ canned responses |
| Automation competitions | ❌ |

## 4. Prioritized roadmap (impact × effort)

### P0 — Quick wins (days; do first)
| # | Item | Why |
|---|---|---|
| 1 | Persist respawnQ/growAt; fix tab-suspend tick flood | Data-loss + freeze bugs |
| 2 | Offline fast-forward + "while you were away" summary | Delivers the living-world promise |
| 3 | Half-height editor + camera offset (robot visible while coding) | The core feedback loop |
| 4 | Interactive 3-step tutorial replacing the text wall | First-session retention |
| 5 | Undo/redo + duplicate block; Else branch on If | Editor trust + expressiveness |
| 6 | Floating +1 popups, coin fly-to-HUD, aggregated sale toasts | Cheap, huge perceived quality |
| 7 | Save export/import (base64 file/link) + PWA manifest & service worker | Progress safety, installable |
| 8 | Commit the CDP smoke test + add Vitest for the VM | Regression safety before growing |

### P1 — Medium (1–3 weeks each)
- **Program templates gallery** ("Wood farm", "Explorer", "Courier") — one-tap starter programs; teaching by example beats docs.
- **My Blocks (custom functions) + counters (variables) + event hats** ("when bag full → …") — unlocks the spec's advanced tier and is the single biggest educational upgrade.
- **Editable simplified Python** via Skulpt (~500 KB) mapped onto the same VM actions — completes the block→text ladder. (Avoid Pyodide: 10 MB+.)
- **Long-press drag-and-drop** for blocks with drop-zone highlighting (Pointer Events; no library needed).
- **Content pack**: crafting (iron→gears→machines), conveyor belts, drones, day/night cycle, NPC villagers with fetch-quests, achievements board.
- **Robot-to-robot signals** (send/receive on channels) — "distributed robot networks" from the spec, still fully client-side.
- **Program sharing via URL hash / QR** — social features with zero backend.
- **Sprite-sheet art pass** replacing emoji (consistency across platforms) + minimap.
- **LLM mentor** behind a tiny proxy (e.g. Supabase Edge Function w/ kid-safe system prompt + rate limit); keep keyword brain as offline fallback.

### P2 — Large bets (month+)
- **Async multiplayer first**: accounts + cloud saves + shared program library + leaderboards + visit-a-snapshot-of-a-friend's-world. Realistic stack: Supabase (auth, Postgres, storage, realtime). Full realtime co-op only after the deterministic-sim refactor below.
- **Chunked/infinite world** with seeded chunk generation and per-chunk persistence.
- **Automation competitions**: weekly seeded world + goal ("most iron in 10 sim-minutes"), deterministic replay = verifiable leaderboard.

## 5. Architecture / refactor plan for scalability

**Step 1 — Split the monolith into ES modules (no build step; stays GitHub-Pages-native).**
`src/{world,sim,vm,blocks,editor,render,mentor,save,audio,ui}.js` + thin `index.html`. Browsers load modules natively; zero tooling risk.

**Step 2 — Make the simulation deterministic and headless (the keystone refactor).**
Replace wall-clock ms with an integer **tick counter**; all timers (growth, respawn, robot `nextAct`) become tick numbers; RNG becomes a seeded stream inside sim state. Sim = pure `step(state) → state'` with an event list out; rendering interpolates between ticks. This one change simultaneously enables: offline fast-forward (run N ticks), replays, unit tests, competition verification, and future multiplayer sync (lockstep or server-authoritative). Decouple UI via an event bus (sim emits `{type:'sold', coins}`; UI subscribes) instead of `sellInv()` calling `toast()` directly.

**Step 3 — Tooling once modules exist:** Vite + TypeScript (typed block/VM schemas catch whole bug classes), Vitest for VM/world logic, Playwright e2e smoke, GitHub Actions deploy to Pages. Keep runtime dependency count ≈ 0.

**Step 4 — Rendering scalability:** cache terrain per 16×16-tile chunk to offscreen canvases (redraw only dirty chunks), dirty-track objects, add battery-saver FPS cap. Only consider PixiJS if a later art pass demands it.

**Step 5 — Persistence & backend-ready:** versioned save schema with migrations, multiple world slots, export/import; then optional Supabase sync (the deterministic sim makes server validation of competition results feasible).

## 6. If approved — implementation batch

Implement the **P0 quick-wins batch (items 1–8)** on `claude/open-world-programming-game-l8rgv1`, keeping the single-file (or minimal-split) zero-build constraint for now:
- Fix persistence of `respawnQ`/`growAt` (relative times) + save-format bump to v2 with v1 migration.
- Clamp/fast-forward robot ticks; add offline catch-up on load with summary toast.
- Editor sheet → ~46 vh with camera offset keeping the selected robot in view.
- Interactive first-run tutorial (3 guided steps with highlight overlays).
- Else branch on If (block UI, interpreter, Python gen); undo/redo stack + duplicate.
- Collect/sell juice popups; aggregated sale toasts.
- Export/import save; `manifest.json` + minimal service worker.
- Commit `test/smoke.js` (CDP) and extract the interpreter into a testable shape with a few Vitest-style assertions (plain node script to stay dependency-free).

## Verification

- `node --check` on extracted script; headless CDP smoke test (existing script): boot → run programs → assert robot moved/collected → save → reload → assert saplings still grow and respawns fire (regression test for the P0 bug).
- Manual: background the tab 5+ min, resume → no freeze, "while away" summary appears.
- Mobile viewport screenshot pass (420×800) for editor/camera layout.
