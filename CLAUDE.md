# CodeCraft

An open-world game that teaches kids to program. Zero build step: plain
files, classic `<script>` tags, one global scope, HTML5 canvas. Supabase
is the only backend and the only external domain.

## Ground rules that bite

- **Load order matters.** Everything shares one global scope, so a
  `function foo(){}` in a later file REPLACES an earlier `window.foo =`
  wrapper. Export a wrapper under a different name than the function it
  wraps, or it will call itself. That has cost this project a blown
  stack and a whole afternoon.
- **A new JS or CSS file costs four edits:** the tag in `index.html`, an
  entry in `sw.js`'s `ASSETS`, the `CACHE` bump in `sw.js`, and
  `CC_BUILD` in `js/game/constants.js`. Miss one and it ships broken or
  stale.
- **Hebrew matches WHOLE text nodes.** A `<b>` welded into a sentence
  splits it into fragments that match nothing. Build labelled rows out
  of separate elements. See the tables at the top of `js/game/i18n.js`.
- **Every emoji in `js/*.js` needs icon art** or `test/smoke.js` fails.
- **A control that shows only a symbol needs an `aria-label`** (➤, ✕, −,
  ＋), or VoiceOver reads it as just "button". The Hebrew layer translates
  `aria-label` too, so each label also needs its entry in `HE`.
  `test/a11y.js` walks the real accessibility tree in both languages.
- Run the suites before shipping:
  `NODE_PATH=/opt/node22/lib/node_modules node test/<name>.js`

## Design principles

The interface follows Apple's fluid-interface work. The full text is in
`.claude/skills/apple-design/SKILL.md` — load that skill before any
substantial UI or motion work. What a stylesheet can enforce on its own
lives in `css/apple.css`, which loads last. These are the rules a person
has to keep:

**Respond on the press, not the release.** Feedback belongs on
`pointerdown`. Waiting for the tap to complete before showing anything
reads as a dead control. Use `--dur-quick` (120ms).

**Track the finger 1:1, from where it grabbed.** Anything dragged stays
glued to the point that grabbed it — never re-centred under the finger.
`beginDrag` in `js/game/dragdrop.js` is the worked example.

**Two curves, and a reason for each.** `--ease-settle` for anything that
simply moves or appears; `--ease-carry`, which overshoots slightly, only
when the hand pushed the thing. Overshoot on a panel that merely
appeared feels wrong. Don't invent a third curve without a reason you
can say out loud — the one that exists, `--ease-celebrate`, is the
solved-level card and nothing else. Every curve lives in `css/apple.css`
and nowhere else; `test/motion.js` fails if a stylesheet types one out.
Frequency sets the budget: a block lands two hundred times a session, so
it gets 180ms and a hair of give, not a bounce.

**Dragged means sprung.** A CSS curve is enough for a surface that
only ever opens by a tap. The moment something can be dragged and
released, it is not: the animation has to start from the live on-screen
value, inherit the release velocity, and be grabbable again mid-flight.
Sheets crossed that line — `js/game/sheet-drag.js` holds the spring
(`ccSpring`) and the momentum projection (`ccProject`), and both are
exported for the next thing that needs them. Do not add a second spring.

Three traps that file already paid for. Read the release velocity over
a WINDOW of the last ~80ms, never from the last two points (a burst of
moves can share a timestamp, and a real flick then arrives at zero).
Let the gesture do what the on-screen control does — a fling clicks the
sheet's own ✕, a pull up presses its own size button, and a swipe in
from the left edge calls `nativeBack()`, the same step as the ‹ and as
Android's hardware back — rather than inventing a second way out or a
second idea of "big". And judge the
throw on the UNDAMPED finger travel: upward is rubber-banded, so a
threshold read off the sheet silently asks for twice the pull going up
as coming down.

A pull down from full has two rungs below it, half and gone, and the
projected landing picks the nearer — a slow pull to the middle stops at
half, a long pull or a hard flick leaves. When the size changes under
the finger, the height flips with no curve and the transform absorbs the
difference (`resize()`), so the top edge never jumps at release.

**Out the way it came in.** A surface that arrives from the bottom
leaves to the bottom, and a menu grows from the control that opened it.

**Answer the three accessibility settings.** `prefers-reduced-motion`,
`prefers-reduced-transparency` and `prefers-contrast` are all handled in
`css/apple.css`. New animation inherits that for free; a new translucent
surface does NOT — add it to the solid-background list there, because
removing the blur without solidifying the fill makes it harder to read,
not easier.

**Tracking is size-specific, and this app is bilingual.** Large Latin
display text wants slightly negative tracking; small uppercase labels
want a little more. Hebrew wants neither — do not pull Hebrew letters
together. The rule in `css/apple.css` is scoped for that reason.

**Feedback has to earn its place.** Haptics and sound are for commits,
snaps, successes and errors. Put them everywhere and players learn to
ignore all of them. Those four are also the only arguments `ccFeel()`
takes (`js/game/native.js`) — it reaches the Taptic Engine in the app and
`navigator.vibrate` on the web, which iOS Safari never had. Never call
`vibrate()` directly; there were two and neither worked on an iPhone.

### The skills pack

`.claude/skills/` holds Emil Kowalski's set (github.com/emilkowalski/skills,
at 85e8e23), byte for byte. Seven of them fit this codebase:

| skill | when |
|---|---|
| `apple-design` | the house rules above — load it before UI or motion work |
| `animate` | building a new animation, web, from scratch |
| `review-animations` | judging motion that already exists (`/review-animations`) |
| `improve-animations` | a whole-codebase motion audit, read-only |
| `find-animation-opportunities` | what here should move and does not |
| `mobile-native` | the CSS and meta fixes that stop a web app feeling like a browser |
| `animation-vocabulary` | naming an effect you can only describe |

Three are for stacks this project does not have and should be left
alone here: `animate-expo` (React Native), `ask-sonner` (a React toast
library), `write-swift`. Two more only run when you type them:
`/pick-ui-library` and `/prototype`, both of which assume React.
`emil-design-eng` is the philosophy the rest are built on.

`.claude/skills/performance-cheatsheet.md` is a one-page table from the
same repo — the fifteen lines are worth reading once.

## 🚶 Walk To on a board

A challenge board can hand out the world's 🚶 Walk To (`goNear`): it
walks to the nearest target, block, flag, key, door or plate by the
same rules ⬆️ Move obeys (`mgMoveAhead`), one tile a tick. On a level
about the route it solves the level, so it is in NO default block list —
only in `FLAT_BLOCKS` for the author to hand out, and in the Errands
chapter. The author also picks its destinations (`proj.goTargets`). A
single level's row has no column for either, so a level that hands it
out publishes as a one-level pack. `test/walk-to.js`.

## The 3D board

`js/game/tower3d.js` is a painter, not a z-buffer, so order is
everything. A brick draws only the faces whose screen winding says they
face the camera. Everything with height — rock, bricks, blueprints, the
robot — goes in ONE pass sorted by distance from the camera's eye.
Depth along the view axis is not enough: it ties for every brick in a
row across the screen. `test/tower3d.js` checks all of this in pixels.

## Native app

The Capacitor wrapper lives on this branch now (merged forward from
`dev/app` at v169): `ios/`, `android/`, `capacitor.config.json`,
`js/game/native.js`, `scripts/build-www.js`, `test/native.js`.
`scripts/build-www.js` reads its file list from `sw.js`'s `ASSETS`, so a
file registered properly is a file the app ships.

Adding a Capacitor plugin is `npm install --save`, then `npm run sync` —
the sync is what registers it in `android/capacitor.settings.gradle` and
`ios/App/CapApp-SPM/Package.swift`, and those two files are committed. A
plugin in `package.json` but not in them is in `node_modules` and nowhere
else.

Two things that look optional and are not. The launch screen does not
hide itself (`launchAutoHide:false`); `boot.js` lifts it once the first
screen has painted and `native.js` has a timer in case boot never gets
there — keep both. And the iPad is portrait-only, which Apple rejects at
upload (ITMS-90474) unless `UIRequiresFullScreen` is set — it is; do not
remove it without restoring all four iPad orientations.
