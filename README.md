# Neon Arcade

A calm-neon arcade of 15 simple browser games — a personal anti-doomscroll break tool.
Set a break timer, play a quick round, and it hard-stops when time's up so a 30-second
breather doesn't turn into an hour.

**No build step, no dependencies, no server.** Just open `index.html`.

## Play it

Double-click `index.html` (or serve the folder and open it). Works in any modern browser.

## The games

**Classics:** Fuse 2048 · Lumen (snake) · Deepfield (minesweeper) · Refract (breakout) ·
Stack (tetris) · Glide (flappy) · Echoes (memory) · Blackout (lights out) · Cascade (merge-drop)

**Originals:** Nightwatch & Vigil (FNAF-style survival) · Constellation (connect-the-stars) ·
Orbit (zen timing) · Bloom (rhythm mandala) · Ripple (chain reaction)

Each game has its own neon accent color and synthesized sound. There's a hub with search,
a hybrid break timer (session-wide or per-game, from 30s up to 20m), and generative
background music you can shuffle.

## How it's built

The whole thing runs over `file://` by double-click, which rules out ES modules (CORS blocks
them locally). So it's a single-page app built from **classic `<script>` tags on one global
`Arcade` object** — zero build tooling, zero npm.

```
index.html          the hub — the only file you open
shell/              shared engine (theme, audio, timer, storage, input, board, registry, router)
games/              one self-contained file per game
GAMEDEV.md          the contract each game implements
```

The **shell** owns everything shared: the neon theme, a synthesized Web Audio engine (no audio
files — every sound is generated), the break timer, high-score storage, input handling, and
responsive board sizing. Each **game** is a small pluggable module that implements a simple
contract (`mount / handleInput / tick / teardown`) documented in [GAMEDEV.md](GAMEDEV.md).

## Adding a game

Read [GAMEDEV.md](GAMEDEV.md), drop a new file in `games/`, register it with `Arcade.register({...})`,
and add a `<script>` tag in `index.html`. That's it.

## License

MIT — do whatever you want with it.
