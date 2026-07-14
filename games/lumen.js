/* Lumen — a glowing light-worm snake on an 18x18 grid. Calm neon:
   segments glow with the accent, head brightest, a soft fading trail
   behind. Grows on orbs, dies on wall/self. Canvas render, responsive. */
(function () {
  const GRID = 18;
  const BASE = 120;        // ms per step at start
  const MIN_STEP = 72;     // fastest it gets

  Arcade.register({
    id: "snake",
    name: "Lumen",
    tagline: "Grow the light-worm.",
    accent: "#5fd0c8",
    complexity: "low",
    controls: "arrows",
    scoreLabel: "Length",
    create() {
      let stage, ctx, canvas, g, wrap;
      let cssSize = 0, cell = 0;
      let snake, dir, nextDir, orb, trail;
      let stepMs, acc, orbs, over, paused, t0;
      let rgb = "95,208,200";
      let unResize = null;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const DIRS = {
        up: { dr: -1, dc: 0 }, down: { dr: 1, dc: 0 },
        left: { dr: 0, dc: -1 }, right: { dr: 0, dc: 1 }
      };

      function toRGB(hex) {
        const h = hex.replace("#", "");
        const n = parseInt(h.length === 3 ? h.split("").map(x => x + x).join("") : h, 16);
        return ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255);
      }

      function sizeCanvas() {
        cssSize = Arcade.board.stageSize(820);
        const dpr = window.devicePixelRatio || 1;
        canvas.style.width = cssSize + "px";
        canvas.style.height = cssSize + "px";
        canvas.width = Math.round(cssSize * dpr);
        canvas.height = Math.round(cssSize * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        cell = cssSize / GRID;
      }

      function freeCells() {
        const occ = new Set(snake.map(s => s.r + "," + s.c));
        const free = [];
        for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++)
          if (!occ.has(r + "," + c)) free.push([r, c]);
        return free;
      }

      function placeOrb() {
        const free = freeCells();
        if (!free.length) return;
        const [r, c] = free[Math.floor(Math.random() * free.length)];
        orb = { r, c };
      }

      function reset() {
        const m = Math.floor(GRID / 2);
        snake = [{ r: m, c: m }, { r: m, c: m - 1 }, { r: m, c: m - 2 }];
        dir = DIRS.right; nextDir = DIRS.right;
        trail = []; orbs = 0; over = false; paused = false;
        stepMs = BASE; acc = 0; t0 = performance.now();
        placeOrb();
        ctx.setScore(snake.length);
      }

      function die() {
        if (over) return;
        over = true;
        ctx.audio.thunk();
        ctx.onGameOver(snake.length, {
          title: "Tangled up.",
          msg: "The light-worm reached length " + snake.length + ". Untangle and go again."
        });
      }

      function steer(d) {
        if (over || paused) return;
        const nd = DIRS[d];
        if (!nd) return;
        if (nd.dr === -dir.dr && nd.dc === -dir.dc) return; // no 180°
        nextDir = nd;
      }

      function step() {
        dir = nextDir;
        const head = snake[0];
        // wrap around walls: exit one side, re-enter the opposite. Only
        // self-collision kills. (Modulo handles the negative case.)
        const nh = {
          r: (head.r + dir.dr + GRID) % GRID,
          c: (head.c + dir.dc + GRID) % GRID
        };
        const willGrow = orb && nh.r === orb.r && nh.c === orb.c;
        const checkLen = willGrow ? snake.length : snake.length - 1;
        for (let i = 0; i < checkLen; i++)
          if (snake[i].r === nh.r && snake[i].c === nh.c) { die(); return; }

        snake.unshift(nh);
        if (willGrow) {
          orbs++;
          ctx.setScore(snake.length);
          if (orbs % 5 === 0) ctx.audio.win(Math.min(8, 2 + orbs / 5));
          else ctx.audio.pick();
          stepMs = Math.max(MIN_STEP, BASE - snake.length * 1.4);
          placeOrb();
        } else {
          const tail = snake.pop();
          if (!reduce) trail.push({ r: tail.r, c: tail.c, life: 1 });
        }
      }

      function roundRect(x, y, w, h, r) {
        g.beginPath();
        g.moveTo(x + r, y);
        g.arcTo(x + w, y, x + w, y + h, r);
        g.arcTo(x + w, y + h, x, y + h, r);
        g.arcTo(x, y + h, x, y, r);
        g.arcTo(x, y, x + w, y, r);
        g.closePath();
      }

      function fillCell(r, c, inset, radius, alpha, blur) {
        const x = c * cell + inset, y = r * cell + inset;
        const s = cell - inset * 2;
        g.save();
        g.globalAlpha = alpha;
        if (blur) { g.shadowColor = "rgba(" + rgb + ",0.9)"; g.shadowBlur = blur; }
        g.fillStyle = "rgba(" + rgb + ",1)";
        roundRect(x, y, s, s, radius);
        g.fill();
        g.restore();
      }

      function draw(now) {
        g.clearRect(0, 0, cssSize, cssSize);
        // base panel
        g.fillStyle = "rgba(" + rgb + ",0.03)";
        g.fillRect(0, 0, cssSize, cssSize);

        // fading trail
        for (const t of trail) {
          fillCell(t.r, t.c, cell * 0.28, cell * 0.16, t.life * 0.22, 0);
        }

        // orb — soft pulse
        if (orb) {
          const pulse = reduce ? 0.5 : 0.5 + 0.5 * Math.sin((now - t0) / 320);
          const inset = cell * (0.26 - pulse * 0.06);
          g.save();
          g.globalAlpha = 0.85;
          g.shadowColor = "rgba(" + rgb + ",1)";
          g.shadowBlur = cell * (0.5 + pulse * 0.5);
          g.fillStyle = "rgba(" + rgb + ",1)";
          const s = cell - inset * 2;
          roundRect(orb.c * cell + inset, orb.r * cell + inset, s, s, s / 2);
          g.fill();
          g.restore();
        }

        // body then head
        for (let i = snake.length - 1; i >= 1; i--) {
          const a = 0.34 + 0.42 * (1 - i / snake.length);
          fillCell(snake[i].r, snake[i].c, cell * 0.12, cell * 0.24, a, cell * 0.35);
        }
        // head — brightest, with white core
        const h = snake[0];
        fillCell(h.r, h.c, cell * 0.08, cell * 0.26, 1, cell * 0.7);
        g.save();
        g.globalAlpha = 0.85;
        g.fillStyle = "rgba(235,250,248,1)";
        const hi = cell * 0.34;
        roundRect(h.c * cell + hi, h.r * cell + hi, cell - hi * 2, cell - hi * 2, cell * 0.14);
        g.fill();
        g.restore();
      }

      return {
        mount(st, c) {
          stage = st; ctx = c;
          rgb = toRGB(ctx.accent || "#5fd0c8");
          wrap = document.createElement("div");
          wrap.style.cssText = "position:relative;display:inline-block;";
          canvas = document.createElement("canvas");
          canvas.style.cssText =
            "display:block;background:var(--panel);border:1px solid var(--line);" +
            "border-radius:var(--radius);box-shadow:var(--glow);";
          g = canvas.getContext("2d");
          wrap.appendChild(canvas);
          const hint = document.createElement("div");
          hint.className = "hint";
          hint.textContent = "Arrows / WASD / swipe · eat the light";
          wrap.appendChild(hint);
          stage.appendChild(wrap);

          sizeCanvas();
          reset();
          unResize = Arcade.board.onResize(sizeCanvas);
          Arcade.touch.dpad(stage, steer);
        },
        handleInput(intent) {
          if (intent.type === "dir") steer(intent.dir);
        },
        tick(dt) {
          const now = performance.now();
          if (!over && !paused) {
            acc += dt;
            while (acc >= stepMs && !over) { acc -= stepMs; step(); }
            for (let i = trail.length - 1; i >= 0; i--) {
              trail[i].life -= dt / 480;
              if (trail[i].life <= 0) trail.splice(i, 1);
            }
          }
          draw(now);
        },
        pause() { paused = true; },
        resume() { paused = false; },
        getScore() { return snake ? snake.length : 0; },
        teardown() { if (unResize) unResize(); Arcade.touch.clear(); }
      };
    }
  });
})();
