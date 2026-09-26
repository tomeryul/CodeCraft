# Design canvas sources

Proposed HUD layout for the world and minigame screens, published as a
design canvas. These four files are the SOURCE; the canvas itself is
generated from them and is gitignored (~2.5MB of editor payload).

| file | artboard |
|---|---|
| `Before.dc.html`   | the HUD as it stands, annotated |
| `Main.dc.html`     | proposed world HUD |
| `Minigame.dc.html` | proposed challenge / lesson HUD |
| `System.dc.html`   | the rules: docks, colour meanings, button shapes |
| `canvas.json`      | layout, titles and sticky notes |

Every colour, radius and control size is lifted from `css/styles.css` —
the proposal reorganises the HUD, it does not repaint it. The one number
that is measured rather than designed is on `Before`: at 390×844 the
current HUD is 13 floating boxes in 5 clusters covering 16.5% of the
screen. Scatter, not coverage, is the problem it addresses.

Nothing here is wired into the game yet.
