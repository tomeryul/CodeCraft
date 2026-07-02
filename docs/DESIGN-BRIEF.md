# CodeCraft — Design Brief for Claude Design

> מסמך זה מכיל את כל מה שצריך כדי לעצב את CodeCraft מחדש ב-Claude Design (או בכל כלי עיצוב אחר):
> סקירת המשחק, כל המסכים והקומפוננטות עם כל המצבים שלהם, הצבעים הנוכחיים, אילוצים טכניים,
> אפליקציות רפרנס, ופרומפטים מוכנים להדבקה. אפשר להדביק את החלקים באנגלית ישירות לכלי העיצוב.

---

## 1. What the game is (paste this as context)

CodeCraft is a **mobile-first, open-world programming game for kids and teens (ages 7–15)**.
Players never control their robot directly — they program it with tap-to-build code blocks
(move, loops, if/else, variables) and watch it come alive in a living 2D tile world: trees grow
back, water ripples, animals wander, robots automate mining/farming/selling. Programs are
mirrored live as real Python. Progression is level-free: players unlock block categories by
playing, earn XP → Inventor Levels, complete quests, collect robot hats, and find treasure.

**One-line feel target:** "Scratch meets Duolingo meets a cozy Zelda overworld."

## 2. Design goals

1. **Joyful, chunky, tactile** — big rounded buttons that beg to be pressed; nothing corporate.
2. **Readable at arm's length on a phone** — a 7-year-old must parse every icon without reading.
3. **The world is the hero** — UI should frame the canvas world, never bury it.
4. **Celebrate constantly** — every reward moment (XP, unlock, quest claim) deserves visual fireworks.
5. **Code looks friendly** — blocks feel like toys (Scratch-style 3D bevels), Python view feels "grown-up but warm".

## 3. Current design tokens (starting point — improve freely)

| Token | Value | Used for |
|---|---|---|
| `--bg` | `#3b2f63` | page background (deep purple) |
| `--panel` | `#241b45` | sheets (editor/mentor/quests) |
| `--panel2` | `#2f2456` | cards, chips, inner surfaces |
| `--ink` | `#f4f1ff` | primary text |
| `--ink2` | `#b9aee0` | secondary text |
| `--accent` | `#ffb830` | coins, CTAs, selection, XP |
| `--green` | `#54d66a` | success, Run button |
| `--red` | `#ff5d73` | Stop, destructive |
| `--blue` | `#5ab8ff` | info |
| `--purple` | `#b184ff` | brand secondary |
| Font | **Fredoka** (Google Fonts) | everything; monospace for Python |
| Radius | 11–22px, pill buttons | everywhere |

**Block category colors** (each block type is color-coded):
Basics `#3d5aa8` (blue) · Loops `#a86a1f` (orange) · Logic `#8746a8` (purple) ·
Smart `#1f8a72` (teal) · Memory/Variables `#1f7a9e` (cyan).

**World palette:** grass `#79c34e/#71ba47/#7fc957`, sand `#ecd9a0`, rock `#a9a9b4`,
water `#3f9fd8`. World objects are currently emoji sprites (🌳🪨💎🏠🏪📦🎁) — a custom
sprite set in one consistent style is the single biggest visual upgrade available.

## 4. Complete screen & component inventory (design each, with all states)

### 4.1 Splash / title screen
Logo ("CodeCraft"), mascot robot, tagline, big Play button, 5 feature pills, animated
background (floating emoji parallax today). **States:** first launch vs returning player.

### 4.2 HUD (always on top of the world)
- Level chip: ⭐ level number + thin XP progress bar (fills, then bursts on level-up)
- Coins chip 🪙 (flashes on gain), Bag chip 🎒 `3/8` + top-2 resources carried
- Icon buttons: Quests 📜 (red badge dot when claimable), Shop 🛒, Mentor 💡, Center-camera 🎯
- Bottom: "🧩 Code" pill button (primary CTA), round ▶/⏹ run FAB (green running → red stop)
- Toasts (pill notifications) + big gold "celebration toasts"; tutorial coach bubble with
  pulsing highlight ring on the target button (3 steps)

### 4.3 The world (canvas — art direction, not DOM)
Tile terrain (grass/sand/rock/water + shores), trees in 3 growth stages, resources, home 🏠,
market 🏪, chest 📦, bridges, gift chests, wandering animals, drifting clouds + shadows,
day-dusk tint, fireflies. **Robots:** rounded-square body in team colors, eyes that look in the
move direction, antenna (green light when running), optional hat 🎩, name tag, speech bubble
(Say block), selection glow ring, 💢 blocked indicator, squash & stretch. Particle bursts:
leaves/stone/coins/sparkles/confetti.

### 4.4 Code editor (bottom sheet, 48vh; right side panel ≥920px)
- Header: robot chips (color dot + name + ●RUN live badge), + robot, undo ↺ / redo ↻,
  Run ▶ / Stop ⏹ / close ✕
- Tabs: 🧩 Blocks / 🐍 Python
- **Variable watch strip**: live chips `📦 c = 6` updating while running
- **Program area**: nested color-coded 3D blocks. Block anatomy: icon + label + parameter
  chips (− n +, condition cycler, dropdown-cyclers, variable-name buttons, value chips
  showing 🔢/🔤/📦 kind). Container blocks (Repeat/Forever/If/Count) show indented children
  with a left rail; If has an Else row. **States:** normal / selected (gold ring) /
  currently-executing (green glow — this is the key teaching device) / bounce-in when added.
- Selection action bar: ↑ ↓ duplicate ⧉ delete 🗑 + insertion hint text
- **Palette**: category headers (Basics/Loops/Logic/Smart/Memory), chip-buttons per block,
  locked categories greyed with 🔒 + unlock requirement text ("Earn 250 🪙 …")
- Empty state: friendly "tap blocks below to program Robo-1!"
- Python tab: dark code panel, syntax-highlight friendly, note explaining "this is real Python"

### 4.5 Quest board (bottom sheet)
Header (📜 + subtitle), 3 quest cards: title, reward (+25🪙 +15⭐), progress bar `4/10`,
gold **Claim** button when complete (confetti on claim). Stats grid: collected / earned /
steps walked / robot team.

### 4.6 Shop (modal)
Item rows: emoji, name+price, description, gold Get button (disabled state). Sections:
robots & upgrades, **Style** (hat picker per robot: owned hats, 🔒 locked with level numbers,
✖ none), sound toggle, backup export/import, reset world (danger). Sell-storage row.

### 4.7 AI Mentor chat (bottom sheet)
Owl mascot 🦉 "Byte", chat bubbles (AI left / player right), quick-question chips row, input +
send. Personality: warm, encouraging, emoji-rich.

### 4.8 Misc
Daily gift moment 🎁 ("Day 7 of your adventure!"), unlock celebration ("🧠 MEMORY UNLOCKED"),
level-up moment, PWA app icon (robot face), README/og-image banner.

## 5. Technical constraints (important for handoff!)

- Everything ships in **one `index.html`** (vanilla JS + Canvas, GitHub Pages, offline PWA).
  Deliver design as **HTML/CSS mockups or exact specs** (hex, px, radii, shadows, gradients) —
  not as heavy image exports.
- UI = DOM+CSS (fully skinnable via the CSS variables above). World = `<canvas>` (art direction
  = palette + shape language + particle specs; sprites ideally as **SVG or a single sprite
  sheet PNG ≤200KB**, 48px tile grid, or keep emoji).
- Mobile-first **360–430px** wide, portrait, safe-area insets, thumb-reach bottom controls,
  min tap target 40px. Desktop: editor becomes a 430px right panel.
- Dark background world stays visible behind sheets; sheets max ~48vh so the robot is watchable.
- Font must load async with system fallback (offline PWA). Prefer CSS effects over images.

## 6. Reference apps to study (what to take from each)

| App | Steal this |
|---|---|
| **codeSpark Academy** | THE benchmark: "no words" icon-driven UI for pre-readers, Mario-like colorful world |
| **Scratch / Scratch Jr** | block shapes, category colors, snap affordances, container nesting |
| **Swift Playgrounds (Apple)** | world-beside-code layout, calm gradients, "grown-up but friendly" code panel |
| **Duolingo** | XP/streak/quest visual language: color-coded meaning (gold XP, green success), progress bars, celebration screens, mascot personality |
| **Toca Boca World** | kids art direction: chunky shapes, playful proportions, zero text density |
| **Brawl Stars / Clash Royale (Supercell)** | HUD chips, juicy buttons with dark bottom bevels, reward chest moments |
| **Monument Valley / Alto's Odyssey** | ambient world beauty: palettes, day-cycle tinting, silhouettes |
| **Grasshopper (Google)** | friendly code-to-real-code transition styling |

## 7. Ready-to-paste master prompt for Claude Design

```
Design a mobile-first UI kit for "CodeCraft", an open-world coding game for kids 7–15.
Feel: Scratch meets Duolingo meets a cozy Zelda overworld — joyful, chunky, tactile,
readable by a 7-year-old at arm's length. Dark purple world-framing UI (#3b2f63 bg,
#241b45 panels), gold accent #ffb830, Fredoka font, 12–22px radii, Scratch-style 3D
block bevels (darker bottom edge), pill buttons, glassy HUD chips.

Screens to design at 390×844 (portrait):
1) HUD over a green tile world: level chip ⭐5 with XP bar, coins chip, bag chip,
   quest/shop/mentor buttons (badge dot), bottom "🧩 Code" pill + round green Run FAB.
2) Code editor bottom sheet (48% height): robot tabs with live RUN badge, undo/redo,
   Blocks/Python tabs, live variable-watch chips (📦 c = 6), nested color-coded blocks
   (blue basics, orange loops, purple logic, teal smart, cyan memory) with parameter
   chips (− 3 +, condition cycler, variable name), a green-glow "currently executing"
   state, If/Else container with indented children, block palette with a 🔒 locked
   category, selection action bar (↑ ↓ duplicate delete).
3) Quest board sheet: 3 quest cards with progress bars and +coins/+XP rewards, one
   completed with a gold Claim button, stats grid (collected/earned/steps/robots).
4) Shop modal: purchase rows with emoji icons and gold Get buttons, a robot hat picker
   (owned + locked-by-level), sound toggle, danger reset row.
5) Splash: CodeCraft logo, robot mascot, Play button, feature pills, floating parallax.
6) Celebration overlay: "🧠 MEMORY UNLOCKED!" with confetti, and a level-up moment.
Also: a Python code panel style (dark, warm, kid-friendly syntax colors) and a toast/
coach-bubble system. Keep the world visible behind all sheets. Deliver as HTML/CSS with
CSS variables for every color so it can be dropped into a single-file vanilla JS game.
```

**Tip:** אחרי המסך הראשון, בקש וריאציות ממוקדות: "make the blocks 20% chunkier",
"try a light/day theme variant", "design the robot sprite sheet in SVG: idle/walk/collect,
4 directions, 3 team colors, with hats".

## 8. What to bring back for implementation

1. Final **CSS variables** (all colors) + font choice
2. HTML/CSS of each screen (or precise specs: spacing, radii, shadows, gradients)
3. If replacing emoji art: **SVG sprites or one sprite sheet** (48px grid, ≤200KB)
4. App icon 512×512 + og-image 1200×630
5. Anything animated: describe timing/easing (e.g., "block add: 220ms spring scale 0.85→1")

Paste them back into the chat and I'll wire everything into `index.html` and verify with the
existing 27-test suite + mobile screenshots.
