# UX roadmap — from "works" to "feels finished"

Measured with `scripts/ux-audit.js` on v183 (390×844, touch), judged
against `.claude/skills/game-app-design`. One topic at a time; each is a
set of problems with one cause and one fix. Re-run the audit after each
and record the numbers here.

Baseline (v183): layout shift **1.34** (good is < 0.1) · 5 notifications
landed on surfaces that were not the world · frames: 60fps idle, 13–15
frames over 33ms in 3s with the editor or a level open · two full canvases
repainted every frame while only one is visible.

---

## 1. Calm — notifications that know where you are  ✅ v184
*Done:* every message is sorted by cause; world news, level-ups and skill
news are held while a level, a menu or a card is open (`whenCalm` in
`js/game/fx.js`) and delivered one at a time in the world, rewards first,
stale news dropped; the order-filled and daily-gift cards wait for the
world; one fixed toast lane at the top; every win is a card after a beat,
with Next / Not now — nothing loads by itself. `test/calm.js`.
*Measured:* layout shift 1.34 → **0.46** (the rest is topic 2);
notifications landing on a surface other than the world 5 → **0**.
*Skill §3, §4 (no auto-advance), §7*

- World news fires on top of whatever is open: 📋 New order over the
  menu, 📣 RUSH over the shop, 🌙 Nightfall inside the level creator,
  📈 "market wants wood" while designing, 💎 seam news over Style.
- 🎁 Daily gift opens as a dialog over the menu (and over lesson 1 on a
  first run), and stays up across page changes.
- The toast lane moves: `#toasts` jumps 658px between bottom and top as
  panels open — 0.92 of the 1.34 layout shift.
- Big toasts sit at the bottom, over content and next to Run.
- Finishing an Academy lesson loads the next one immediately, under a
  toast — the player never sees the win and lands somewhere new.

Fix: classify every message (response / achievement / ambient / reward /
system); ambient and reward are held while the player is focused and
delivered, merged, in the world; one fixed toast lane that does not move
and lets taps through; a lesson win is a moment and a choice.

## 2. Stable — nothing moves by itself  ✅ v185
*Done:* no height curve anywhere — a size change is one frame of layout
and a spring on the transform, for every open sheet (`ccSizeFlip`), and
the board re-fits in that same frame; one header height for every page;
the strip under the board has a fixed share, so a run no longer resizes
the board; the designer fits its board to the tool box at once; a Tower
level at half height puts its rotate buttons beside the board (board
102px → 133px tall). The HUD turned out not to push anything — new chips
join the end of the row. `test/stable.js`. The audit now presses a key
before each step, so only what moves after the tap is scored.
*Measured:* layout shift 0.46 → **0.026**.

*Skill §4*

- The editor animates `height` when a level borrows full height (the
  creator): a layout per frame, 0.26 of layout shift and visible stutter.
- Sheet headers change height with the subtitle (±7px on every page).
- The board resizes after a run when the text under it changes (0.03).
- The HUD grows: ticker chips (📈, ⏱) push into the top bar mid-game.

## 3. The play is a scene  — ✋ declined, keep as is
*Owner's decision:* levels stay in the bottom sheet over the world, with
its half / full sizes. Do not turn them into full-screen scenes, and do
not reopen this as a finding. Work inside it instead: the size problems
that are real (the Tower board at half height, the board resizing under
the text) belong to topic 2.

## 4. Fewer pages, one stack, Back to where you were  ✅ v187
*Done:* My Challenges shows only your own towers (it was the Tower page
under another name); the Academy page lists every lesson as a row
instead of one card and a strip of dots; going home closes the shop, so
nothing opens underneath it; Back from a level restores the list's
scroll. Kept on purpose: the shop's Style row (a link that closes the
shop first, not a second page). `test/pages.js`.
*Owner: menus and destinations stay sheets with the half / full choice —
do NOT make them full-screen. Everything else in this topic stands.*
*Skill §1, §2*

- The menu and every destination are half sheets over a dimmed,
  untouchable world.
- The shop is a different kind of surface (`#shopWrap`, its own z-index
  45, its own close, not in the navigation's list): "go home" leaves it
  open, and any screen opened while it is up lands underneath it.
- Duplicates: *My Challenges* lists the built-in Tower levels, so it and
  *Tower Mode* show the same page; the shop has a *Style* row and the menu
  has Style.
- A page for one card: *Academy* holds a single card you tap again.
- Back does not restore scroll position.

## 5. One design system
*Skill §5*

- Two languages for "a list of levels": rows with ▶ (Academy, Chapters,
  Builds) vs. grid tiles (Cyber, Tower).
- Four card radii (14/16/18/24) and several button shapes (h40 r12 in
  lists, tiles r14/r16).
- Emoji and drawn icons mixed in the same rows.

Fix: tokens (3 radii, 4px grid, a type scale), one row, one tile, one
card, one button set; each kind of content always uses the same one.

## 6. Performance
*Skill §9*

- The world canvas is drawn every frame under full-height surfaces; with
  a level open two full canvases repaint every frame.
- Idle DOM churn: the market ticker rewrites its markup every second
  (~30 mutations/s in the world, 110+/s with confetti or a level), and each
  one runs the Hebrew and icon observers.
- Tower's `mgDraw` sets the canvas size on every draw.

## 7. First session and the HUD
*Skill §6, §7*

- First run: lesson 1 opens, then the daily gift, then a market order —
  three things to dismiss before the first block.
- HUD slots are not reserved (see 2).
