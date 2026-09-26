---
name: game-app-design
description: High-level design principles for mobile game apps — the architecture of screens around the play, when a surface should be a scene, a screen, a sheet, a dialog or a toast, a notification policy that never interrupts focus, flow and continuity between places (no jumps, no teleports, no dead ends), one design system instead of many, HUD discipline, first-session pacing, a performance budget for a phone, and how to audit all of it with measurements rather than opinions. Use when designing or reviewing any game UI, when an app "feels stuck", "feels like a website", "is not one design language", has "pages that shouldn't exist", "jumps between places" or "notifications in the wrong place", or before restructuring navigation. For motion physics (springs, drag, velocity) use apple-design; for browser-level fixes (100vh, tap highlight, input zoom) use mobile-native.
---

# Game App Design

A game app is two things sharing one screen: **the play** — the thing the
player came for — and **the meta** — everything around it (menus, shop,
progress, settings, social). Production games feel finished because the
two are kept strictly apart and each follows its own rules. Apps that feel
"stuck" or "like a website" almost always blur them: the play is squeezed
into a panel, the meta interrupts the play, and every screen was built by
a different hand.

This skill is the set of rules for keeping them apart, and for making each
side feel like one product. It sits above two others: `apple-design`
(how motion and gesture feel) and `mobile-native` (how the browser stops
showing through). Use this one to decide *what* each piece of UI is and
*when* it may appear; use those to decide *how* it moves.

## 0. Measure first

Opinions about UI are cheap and mostly wrong about causes. Before
changing anything, walk the whole app the way a player would and record:

- **A screenshot of every surface**, on a phone viewport (390×844 and the
  narrowest you support), in every language you ship.
- **Every notification**: text, time, and *which surface was on screen*
  when it fired. This single log finds most interruption bugs.
- **Every open/close of every surface**, in order. A surface that closes
  and reopens, or two that are open at once without meaning to be, is a
  jump the player feels as "the app moved by itself".
- **Frames** (p50/p95 frame time, frames over 33ms) at idle and in each
  heavy state, with and without CPU throttling (4× approximates a mid
  phone for script; headless software rendering exaggerates compositing,
  so treat commit/raster numbers as relative).
- **Layout shift with sources** (the `layout-shift` PerformanceObserver
  gives the nodes). Every shift is a jump; the sources say which.

Re-run the same walk after every change. A fix that is not visible in the
numbers or the screenshots did not happen.

## 1. Surfaces — five kinds, and a reason for each

Every piece of UI is exactly one of these. Most structural problems are a
piece of UI that is the wrong kind.

| kind | covers | lives | use for | never use for |
|---|---|---|---|---|
| **Scene** | the whole screen | until the player leaves | the play itself: the world, a level, an editor you work in | anything you visit briefly |
| **Screen** | the whole screen (minus a persistent bar) | until the player leaves | meta destinations: a menu, a shop, a collection, a list of levels, settings | a single choice |
| **Sheet** | part of the screen, over a scene | seconds | a quick, contextual action *about what is behind it*: inspect a tile, pick a colour, confirm a purchase, a tooltip that needs room | a destination with its own content; a level |
| **Dialog** | blocks everything | until answered | a decision the player must make now, or a moment the player caused (a win) | news, rewards the player did not earn just now, marketing |
| **Toast / banner** | a strip, never content | ~2–3s | the result of what the player just did, when it is not visible otherwise | ambient news while the player is focused; anything with a required action |

Tests for the kind:

- **Would the player want to see what is behind it?** If not — if the
  back half of the screen is dimmed and untouchable — it is not a sheet,
  it is a screen, and it should take the whole screen. A half-height panel
  over a dimmed world gives up half the phone to wallpaper.
- **Is this where the player will spend minutes?** Then it is a scene or
  a screen. A level in a half-sheet makes the board a thumbnail.
- **Does it need an answer?** Only then is it a dialog.

A **badge** (a dot or count on the control that leads somewhere) is the
sixth surface, and the right home for everything that is news but not
urgent: new orders, unclaimed rewards, unread messages.

## 2. Navigation — one map, one stack, one Back

- **One home.** In a world game the home is the world; everything else is
  one step from it. Depth ≤ 2 for anything the player uses weekly.
- **One way to each place.** A destination reachable from two menus, or a
  page duplicated under two names, doubles what the player has to learn
  and guarantees the two drift apart. Pick the one place it belongs.
- **One stack, managed in one place.** Every surface opens and closes
  through one manager that knows the order. A surface that opens itself
  outside that manager (its own z-index, its own close) will end up under
  or over the wrong thing, and will survive "go home".
- **Back is the inverse of the last forward.** Back returns to exactly the
  surface, tab and scroll position the player came from. Close (✕) goes
  home. They are different buttons because they are different promises.
- **No page for one item.** A page that holds a single card makes the
  player tap twice to do one thing. Open the thing, or show its content
  where the link was.
- **No dead ends.** Every surface has an obvious next step: an empty list
  says how to fill it; a finished level offers the next one.

## 3. Interruptions — the notification policy

The player's attention is the scarcest resource in the app. Classify every
message by **what caused it**, and let that decide where and when it
appears:

| class | caused by | when | where |
|---|---|---|---|
| **Response** | the player's own action just now | immediately | at the spot the action happened if possible, else the one toast lane |
| **Achievement** | the player accomplished something | right after, once | a dialog / celebration, only for real milestones |
| **Ambient** | the world or the clock (market moves, day/night, a new order, a timed event) | **only while the player is in the play and not focused on a task** | the toast lane, or a badge |
| **Reward** | the app giving something (daily gift, streak) | at a calm moment in the home scene, at session start — never over a menu or a level | a dialog, once |
| **System** | errors, connectivity, saves | when it matters to the current action | inline, next to what failed |

Rules that follow:

- **Focus is sacred.** While the player is in a level, an editor, a
  creator, a purchase or any menu, ambient news is *held*, not shown. It
  is delivered — merged, newest first, at most a couple — when the player
  returns to the play, or it becomes a badge.
- **One lane, fixed.** Toasts appear in one place that never moves
  between screens and never covers the primary action (the thumb zone at
  the bottom holds Run/Play/Buy — keep toasts out of it). A lane that
  relocates when a panel opens is itself a jump.
- **Taps pass through.** A toast that is not actionable must not eat
  taps meant for the control under it.
- **Rate limit.** One ambient message at a time; a burst merges into one.
  If the game narrates everything, the player learns to read nothing.
- **No auto-advance.** Never move the player to a different place as a
  side effect of a message ("Level done! → next level already loaded").
  Show the moment; offer the next step; let them take it.

## 4. Flow and continuity — no jumps

A jump is anything that moves without the player moving it.

- **Transitions carry meaning.** Going deeper slides in from the side or
  up from the bottom; coming back is the exact reverse. A place that
  appears with no transition — or with a different one each time — is a
  teleport, and teleports make the map unlearnable.
- **Layout is reserved, not discovered.** Anything that loads, counts or
  varies in length reserves its space up front: headers have a fixed
  height whatever the subtitle, a board keeps its size whatever the text
  under it, a list shows skeleton rows while it loads. Never animate
  `height`/`top`/`width` — animate `transform`, snapping the layout and
  inverting the difference (FLIP).
- **The HUD does not grow.** Fixed slots; a new chip appears in a slot
  reserved for it, not by pushing its neighbours along.
- **Return where you left.** Leaving a list and coming back restores its
  scroll and its tab. Leaving a level and returning restores the program.
- **Success is a moment, then a choice.** Win → the play acknowledges it
  (the robot at the flag, the tower complete) → a card with the reward and
  *Next* / *Back*. Never skip the acknowledgement; never skip the choice.

## 5. One design system

"Not one design language" is almost never about taste — it is about
*count*: too many kinds of card, button, radius, spacing and header, each
added by a different feature.

- **Tokens, few of each.** Colour roles (not colours): surface, surface-2,
  text, text-2, accent, success, warning, danger. Radius: 3 values
  (small controls, cards, sheets). Spacing: a 4px grid. Type: a scale of
  5–6 sizes, two weights for text and one display face.
- **Component inventory, one of each job.** One list row (icon · title ·
  one-line meta · trailing action). One tile (for a grid of peers). One
  card (for a featured item). One primary, one secondary, one tertiary
  button. One header. One empty state. One section title. If two screens
  show "a list of levels", they use the same row.
- **Grid vs list is a decision, not a style.** A grid is for peers you
  compare visually (items, cosmetics, levels of a chapter). A list is for
  things you read (settings, orders, chapters). The same *kind* of content
  is always the same one.
- **One accent job per screen.** The most important action on a screen is
  the only thing in the accent colour. Two yellow buttons is none.
- **Icons are one family.** Same stroke, same size box, same optical
  weight. Emoji mixed with drawn icons read as two apps.

## 6. The HUD

- Shows only what changes the player's next decision (currency they spend
  now, the timer they are racing). Everything else is one tap away.
- Stable positions for every item, in the corners and the top edge; the
  centre belongs to the play.
- Big targets (≥ 44pt, ≥ 48dp; bigger for children), in reach of the thumb
  for anything used often.
- Never covered by a toast; never pushed by one.

## 7. First session

- **One thing at a time.** The first minutes teach the core verb by doing
  it. No reward popups, daily gifts, orders or market news stacked on top
  of the first lesson — each one is a thing the player must dismiss before
  they have learned anything.
- **Earn every popup.** A celebration the player did not cause is noise.
- **Reveal the meta gradually.** Menus, shop and events unlock as they
  become useful, and each arrives with one sentence of why.

## 8. Game feel, calibrated

Feedback (motion, sound, haptics, particles) makes actions feel real —
and its value is inversely proportional to how often it fires.

- Every commit gets a response on press (see `apple-design` §1).
- Big feedback for rare events, small for frequent ones: a block snaps
  two hundred times a session and gets 180ms and a tick; finishing a
  chapter gets confetti.
- Idle motion (bobbing, shimmer, pulse) only on the one thing that wants
  attention *now*, and it stops after a few cycles.

## 9. Performance budget

A game that drops frames feels broken no matter how it looks.

- **16.7ms per frame, on a mid phone.** Script ≤ ~8ms of it.
- **Draw only what is visible.** A world canvas hidden under a full-screen
  surface is not drawn; a board that has not changed is not redrawn; two
  full-screen canvases never both repaint every frame.
- **Never resize a canvas per frame** (setting `width`/`height` clears and
  reallocates it). Resize on resize.
- **No DOM churn at idle.** A clock or ticker that rewrites markup every
  second makes every observer (i18n, icons, a11y) run every second.
  Update text nodes in place; batch writes; read before you write.
- **No long tasks.** Anything over 50ms on the main thread is a stall the
  player feels; split it or defer it (`requestIdleCallback`, chunking).
- **Cheap paint.** Blur (`backdrop-filter`) and large shadows are paid on
  every frame something under them moves. Use them on a few static
  surfaces, and give reduced-transparency a solid fill.

## 10. Children (and everyone)

- Reading is effortful: one idea per sentence, icons with words, never a
  wall of text before the play.
- Generous targets and spacing; forgiving gestures (a near miss counts).
- No dark patterns: no fake urgency on things they cannot control, no
  loss aversion used to pull them back, no purchase one tap from play.
- Every language is a first-class layout, including right-to-left.

## Audit checklist

Run the walk in §0, then for each surface ask:

1. Which of the five kinds is it, and is that the right kind? (§1)
2. How many taps from home, and is there exactly one way here? (§2)
3. What notifications fired while it was open, and should any have? (§3)
4. What moved while nobody touched it? (§4, layout-shift sources)
5. Which components does it use, and are they the shared ones? (§5)
6. What does it cost per frame while open, and what is drawn that cannot
   be seen? (§9)

Then write the findings as **topics**, each a set of problems that share
one cause and one fix, ordered by how much of the app they touch. Fix one
topic at a time, re-measure, ship.
