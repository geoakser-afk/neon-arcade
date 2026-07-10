# Neon Arcade — Game Author Contract

Read this fully before writing a game. Every game is ONE self-contained file in `games/<id>.js`,
a classic script (NO ES modules, NO imports — it runs over `file://` by double-click). It registers
itself on load and implements the lifecycle the shell drives.

## Hard rules
- **No `import`/`export`, no `type="module"`, no external libraries, no network, no audio files.**
  Everything synthesized or CSS. A single `import` breaks the whole arcade's double-click launch.
- Wrap the whole file in an IIFE `(function(){ ... })();` — no globals leak except via `Arcade.register`.
- All sound goes through `ctx.audio` (see below). Never create your own AudioContext.
- Never build your own timer, mute button, score box, back button, or game-over/break overlay —
  the SHELL owns all chrome. You only render your play area into the `stage` element you're given.
- Keep controls SIMPLE: arrow keys OR mouse/left-click OR a single action (click/space). Nothing else.
- Calm-neon aesthetic: dark, muted, soft glow. Use the game's assigned accent via `var(--accent)`,
  `var(--accent-soft)`, `var(--accent-faint)` (already set on the stage). Never hardcode harsh colors.

## Registration
```js
Arcade.register({
  id: "snake",                 // unique, matches filename + <script src> in index.html
  name: "Lumen",               // display name; wrap ONE word in *stars* to accent it: "Fuse *2048*"
  tagline: "Grow the light-worm.",  // one line shown on the hub card
  accent: "#5fd0c8",           // this game's neon accent
  complexity: "low",
  controls: "arrows",          // "arrows" | "mouse" | "click" | "drag"  (shown on card)
  scoreLabel: "Length",        // label for the HUD score stat
  create() { return { /* lifecycle */ }; }
});
```

## Lifecycle object returned by create()
```js
{
  mount(stage, ctx) { }        // REQUIRED. Build your DOM into `stage`. Start your game.
  handleInput(intent) { }      // OPTIONAL. Receives semantic input intents (see below).
  tick(dt) { }                 // OPTIONAL. Called each animation frame if present. dt = ms since last frame (capped 50).
  pause() { }                  // OPTIONAL. Shell calls when arcade locks. Stop motion.
  resume() { }                 // OPTIONAL.
  teardown() { }               // OPTIONAL but IMPORTANT. Remove listeners, intervals, unsubscribe resize.
  getScore() { }               // OPTIONAL. Return current score int.
}
```
The shell automatically: routes input, runs `tick` via requestAnimationFrame, drops all input while
locked/paused, clears the stage on teardown, and shows overlays. Don't duplicate any of that.

## Input intents (from ctx via handleInput)
- `{ type:"dir", dir:"up"|"down"|"left"|"right" }` — arrows, WASD, and swipe all map here.
- `{ type:"action" }` — space or enter (use for one-button games).
- `{ type:"point", phase:"down"|"move"|"up", x, y, nx, ny, button, el }` — pointer/mouse/touch.
  `x,y` are pixels relative to the stage; `nx,ny` are 0..1 normalized. `button` 0=left, 2=right, -1=hover-move.
  For click games use `phase:"down"` + `button===0`. For right-click (flag) use `button===2`.
  For paddle games track `phase:"move"`.
IMPORTANT: to get pointer coords relative to YOUR board (not the stage), call
`Arcade.input.setPointerTarget(yourBoardEl)` inside mount — then x,y/nx,ny are relative to that element.

## ctx services (passed to mount)
- `ctx.audio` — sound. Calm tier: `soft() move() tick() pick() place()`. Punchy tier:
  `win(level) score() combo(n) thunk()`. Also `chord(freqs,dur,opts) arp(freqs,opts) tone(f,d,opts)`.
  Keep routine actions calm (soft/move/tick), reserve punchy (win/score/combo/thunk) for real wins.
- `ctx.setScore(n)` — update the HUD score display. Call whenever score changes.
- `ctx.onGameOver(finalScore, { title, msg })` — call when the round ends. Shell saves the high score,
  shows the overlay with Play again / Back to arcade, and plays the game-over sting. Do NOT call this
  when the break timer locks — the shell handles that.
- `ctx.accent` — the resolved accent hex (also available as CSS `var(--accent)`).
- `ctx.board` — sizing helpers: `layout(el, cols, rows, gapRatio?)` returns `{cell,gap,size}` and writes
  `--cell`/`--gap` CSS vars on el; `cellPos(row,col,cell,gap)` returns `{x,y}` px top-left inside the
  padded board; `onResize(cb)` returns an unsubscribe fn — call it in teardown.
- `ctx.storage` — per-game namespaced: `get(k,fallback) set(k,v) best() recordScore(n)`.

## Layout conventions
- For a square grid game, make a `<div class="board">` (already styled: responsive size, glow, padding).
  Call `ctx.board.layout(boardEl, cols, rows)` in mount AND on resize.
- For canvas games (breakout, glide, orbit, bloom, nightwatch, constellation): create a `<canvas>`,
  size it to `min(90vw,78vh,640px)`, and (for crispness) set canvas width/height = cssSize * devicePixelRatio,
  scale the 2d context by dpr. Re-handle on resize via `ctx.board.onResize`.
- Add a `<div class="hint">short control hint</div>` under the board.
- Respect `prefers-reduced-motion` where you add big motion (check
  `window.matchMedia("(prefers-reduced-motion: reduce)").matches`).

## Style
Prefer inline styles or a small injected `<style>` block scoped by a game-specific class prefix
(e.g. `.lumen-...`). Use accent CSS vars so the game matches the shell. Glow = soft low-opacity
`box-shadow`/`filter`, never big saturated fills. This is a calm late-night break tool — nothing harsh,
strobing, or loud.

## Quality bar
- Must be immediately playable and satisfying within a 30–60s round (short-fuse friendly).
- No crashes in console. Clean teardown (no leaked intervals/listeners — test by entering/leaving twice).
- Feels calm on routine actions, satisfying (punchy audio + a little bloom) on wins.
