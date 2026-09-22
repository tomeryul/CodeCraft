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
can say out loud.

**If it ever becomes draggable, it needs a spring.** These CSS curves
are enough because every surface here opens by a tap. The moment
something can be dragged and released — a sheet you can fling shut — a
fixed curve stops working: the animation has to start from the live
on-screen value, inherit the release velocity, and be grabbable again
mid-flight. That is a spring, and the skill file explains the handoff.

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
ignore all of them.

## Native app

`dev/app` carries the Capacitor wrapper (iOS + Android, `js/game/native.js`,
`scripts/build-www.js`, `test/native.js`). It branches from `main` and is
behind this branch — merge forward before building, don't restart it.
`scripts/build-www.js` reads its file list from `sw.js`'s `ASSETS`, so a
file registered properly is a file the app ships.
