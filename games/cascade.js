/* Cascade — a Threes/2048 merge-drop hybrid on a 5x7 well. A numbered
   tile falls smoothly; steer it with ← →, hold ↓ to soft-drop. Land on a
   twin and they fuse into double, chaining downward. Neon glow tiles. */
(function () {
  const COLS = 5, ROWS = 7;
  const FALL = 620;         // ms per row under natural gravity
  const SOFT = 60;          // ms per row while soft-dropping
  const SOFT_WINDOW = 150;  // a ↓ press keeps soft-drop live this long (covers key auto-repeat)
  const SPAWN_GRACE = 100;  // a fresh tile ignores soft-drop for this long (kills carried-over presses)
  const LAND_MS = 190;      // landing squash duration
  const BLOOM_MS = 340;     // merge bloom duration
  const SLIDE_MS = 90;      // horizontal move slide

  Arcade.register({
    id: "cascade",
    name: "Cascade",
    tagline: "Drop and merge the falling neon.",
    accent: "#c8cf5f",
    complexity: "med",
    controls: "arrows",
    scoreLabel: "Score",
    create() {
      let stage, ctx, canvas, g, wrap;
      let cellW = 0, cellH = 0, boardW = 0, boardH = 0, pad = 0;
      let grid, cur, score, over, paused, clock, effects;
      let rgb = "200,207,95";
      let unResize = null;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      function toRGB(hex) {
        const h = hex.replace("#", "");
        const n = parseInt(h.length === 3 ? h.split("").map(x => x + x).join("") : h, 16);
        return ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255);
      }

      function sizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        // portrait board — height is the binding constraint; treat the ideal
        // stage size as the board HEIGHT so it fills far more vertical space.
        const S = Arcade.board.stageSize(1060, 0.5);
        const gapRatio = 0.085;
        cellH = S / (ROWS + (ROWS + 1) * gapRatio);
        cellW = cellH;
        pad = cellH * gapRatio;
        boardW = COLS * cellW + (COLS + 1) * pad;
        boardH = ROWS * cellH + (ROWS + 1) * pad;
        // guard: never overflow a narrow viewport width
        const maxW = window.innerWidth * 0.92;
        if (boardW > maxW) {
          const f = maxW / boardW;
          cellW *= f; cellH *= f; pad *= f;
          boardW *= f; boardH *= f;
        }
        canvas.style.width = boardW + "px";
        canvas.style.height = boardH + "px";
        canvas.width = Math.round(boardW * dpr);
        canvas.height = Math.round(boardH * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      function empty() { return Array.from({ length: ROWS }, () => Array(COLS).fill(0)); }

      // lowest empty row in a column, or -1 if the column is full
      function restRow(c) {
        let r = ROWS - 1;
        while (r >= 0 && grid[r][c] !== 0) r--;
        return r;
      }

      function spawn() {
        const open = [];
        for (let c = 0; c < COLS; c++) if (grid[0][c] === 0) open.push(c);
        if (!open.length) { cur = null; end(); return; }
        const col = open[Math.floor(Math.random() * open.length)];
        // Fresh tile: fall state lives ENTIRELY on this object. No carried
        // momentum — softUntil starts in the past, so it begins on gravity.
        cur = { c: col, val: Math.random() < 0.85 ? 2 : 4, y: 0, bornAt: clock, softUntil: -1, slideFrom: col, slideAt: -1 };
      }

      function end() {
        if (over) return;
        over = true; cur = null;
        ctx.audio.thunk();
        ctx.onGameOver(score, {
          title: "Stacked out.",
          msg: "The well filled to the top. Score: " + score + "."
        });
      }

      // land the current tile at its resting row, resolving chain merges downward
      function land() {
        const c = cur.c;
        let r = restRow(c);
        if (r < 0) { end(); return; }
        grid[r][c] = cur.val;
        cur = null;

        let merged = false;
        while (r + 1 < ROWS && grid[r + 1][c] === grid[r][c]) {
          const nv = grid[r][c] * 2;
          grid[r][c] = 0;
          grid[r + 1][c] = nv;
          score += nv;
          merged = true;
          r++;
        }

        if (merged) {
          ctx.setScore(score);
          ctx.audio.win(Math.log2(grid[r][c]));
          addEffect("bloom", r, c);
        } else {
          ctx.audio.place();
          addEffect("land", r, c);
        }
        spawn();
      }

      function tryMove(dc) {
        if (!cur || over) return;
        const nc = cur.c + dc;
        if (nc < 0 || nc >= COLS) return;
        // the tile may straddle two rows mid-fall — both must be clear
        const rTop = Math.max(0, Math.floor(cur.y));
        const rBot = Math.min(ROWS - 1, Math.ceil(cur.y));
        if (grid[rTop][nc] !== 0 || grid[rBot][nc] !== 0) return;
        cur.slideFrom = cur.c;
        cur.slideAt = clock;
        cur.c = nc;
        ctx.audio.move();
      }

      function addEffect(type, r, c) {
        if (reduce) return;
        effects.push({ type: type, r: r, c: c, born: clock });
      }
      function effectAt(type, r, c) {
        for (let i = 0; i < effects.length; i++) {
          const e = effects[i];
          if (e.type === type && e.r === r && e.c === c) return e;
        }
        return null;
      }
      function pruneEffects() {
        effects = effects.filter(e =>
          clock - e.born < (e.type === "bloom" ? BLOOM_MS : LAND_MS));
      }

      function tint(v) {
        const lv = Math.log2(v);
        const light = Math.min(0.9, 0.32 + lv * 0.07);
        return "rgba(" + rgb + "," + light + ")";
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

      function cellPx(rowF, colF) {
        return { x: pad + colF * (cellW + pad), y: pad + rowF * (cellH + pad) };
      }

      // draw a tile with optional squash (sx/sy) and glow boost
      function drawTile(px, py, val, alpha, sx, sy, glowBoost) {
        sx = sx || 1; sy = sy || 1;
        const w = cellW * sx, h = cellH * sy;
        // squash keeps the tile bottom-anchored so it looks like it settles
        const x = px + (cellW - w) / 2;
        const y = py + (cellH - h);
        const rad = w * 0.18;
        const lv = Math.log2(val);
        g.save();
        g.globalAlpha = alpha == null ? 1 : alpha;
        g.shadowColor = "rgba(" + rgb + ",0.9)";
        g.shadowBlur = Math.min(cellW * 0.6, cellW * 0.12 * lv) + (glowBoost || 0);
        g.fillStyle = tint(val);
        roundRect(x, y, w, h, rad);
        g.fill();
        g.shadowBlur = 0;
        g.strokeStyle = "rgba(" + rgb + ",0.55)";
        g.lineWidth = Math.max(1, cellW * 0.012);
        roundRect(x, y, w, h, rad);
        g.stroke();
        // number — large and clearly readable
        const frac = val >= 1024 ? 0.34 : val >= 128 ? 0.4 : 0.5;
        g.fillStyle = "#0b0d12";
        // NOTE: canvas font can't use CSS vars like var(--font) — an invalid
        // font string silently falls back to 10px, which is what made the
        // numbers tiny. Use a concrete stack.
        g.font = "800 " + Math.round(h * frac) + "px 'Segoe UI', system-ui, sans-serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(String(val), x + w / 2, y + h / 2 + h * 0.02);
        g.restore();
      }

      function draw() {
        g.clearRect(0, 0, boardW, boardH);
        // empty wells
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
          const p = cellPx(r, c);
          g.fillStyle = "rgba(" + rgb + ",0.05)";
          roundRect(p.x, p.y, cellW, cellH, cellW * 0.18);
          g.fill();
        }
        // settled tiles (with land squash / merge bloom)
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
          const v = grid[r][c];
          if (!v) continue;
          const p = cellPx(r, c);
          let sx = 1, sy = 1, glow = 0;
          const le = effectAt("land", r, c);
          if (le) {
            const e = 1 - (clock - le.born) / LAND_MS;
            sy = 1 - 0.18 * e; sx = 1 + 0.13 * e;
          }
          const be = effectAt("bloom", r, c);
          if (be) {
            const p2 = (clock - be.born) / BLOOM_MS;
            const e = 1 - p2;
            sy = 1 + 0.1 * e * Math.sin(p2 * Math.PI);
            sx = sy;
            glow = cellW * 0.5 * e;
            // expanding ring
            g.save();
            g.globalAlpha = 0.45 * e;
            g.strokeStyle = "rgba(" + rgb + ",1)";
            g.lineWidth = Math.max(1.5, cellW * 0.04 * e);
            const cx = p.x + cellW / 2, cy = p.y + cellH / 2;
            const rr = cellW * (0.4 + 0.55 * p2);
            roundRect(cx - rr, cy - rr, rr * 2, rr * 2, rr * 0.4);
            g.stroke();
            g.restore();
          }
          drawTile(p.x, p.y, v, 1, sx, sy, glow);
        }
        // falling tile — smooth fractional position + horizontal slide
        if (cur) {
          let colF = cur.c;
          if (!reduce && cur.slideAt >= 0) {
            const sp = (clock - cur.slideAt) / SLIDE_MS;
            if (sp < 1) {
              const ease = 1 - Math.pow(1 - sp, 3);
              colF = cur.slideFrom + (cur.c - cur.slideFrom) * ease;
            }
          }
          const p = cellPx(cur.y, colF);
          drawTile(p.x, p.y, cur.val, 0.97);
        }
      }

      function step(dt) {
        if (!cur) return;
        const soft = clock < cur.softUntil && (clock - cur.bornAt) > SPAWN_GRACE;
        const v = soft ? dt / SOFT : dt / FALL; // rows this frame
        const rest = restRow(cur.c);
        if (rest < 0) { land(); return; }
        cur.y += v;
        if (cur.y >= rest) { cur.y = rest; land(); }
      }

      function reset() {
        grid = empty(); score = 0; over = false; paused = false;
        clock = 0; effects = [];
        cur = null;
        ctx.setScore(0);
        spawn();
      }

      return {
        mount(st, c) {
          stage = st; ctx = c;
          rgb = toRGB(ctx.accent || "#c8cf5f");
          wrap = document.createElement("div");
          wrap.style.cssText = "position:relative;display:inline-block;";
          canvas = document.createElement("canvas");
          canvas.style.cssText =
            "display:block;background:var(--panel);border:1px solid var(--line);" +
            "border-radius:var(--radius);box-shadow:var(--glow);padding:0;";
          g = canvas.getContext("2d");
          wrap.appendChild(canvas);
          const hint = document.createElement("div");
          hint.className = "hint";
          hint.textContent = "← → move · hold ↓ to soft-drop";
          wrap.appendChild(hint);
          stage.appendChild(wrap);

          sizeCanvas();
          reset();
          unResize = Arcade.board.onResize(sizeCanvas);
        },
        handleInput(intent) {
          if (over || paused || !cur) return;
          if (intent.type !== "dir") return;
          if (intent.dir === "left") tryMove(-1);
          else if (intent.dir === "right") tryMove(1);
          else if (intent.dir === "down") {
            // soft-drop lives on THIS tile only; a fresh tile can't inherit it
            cur.softUntil = clock + SOFT_WINDOW;
          }
        },
        tick(dt) {
          if (!over && !paused) {
            clock += dt;
            step(dt);
            pruneEffects();
          }
          draw();
        },
        pause() { paused = true; },
        resume() {
          paused = false;
          // drop any pending soft-drop so play resumes under gravity
          if (cur) cur.softUntil = -1;
        },
        getScore() { return score || 0; },
        teardown() { if (unResize) unResize(); }
      };
    }
  });
})();
