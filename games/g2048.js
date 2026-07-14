/* Fuse 2048 — the original, reskinned to soft-glow neon. First game =
   proof that the shell contract works. Ported from break.html but now
   responsive (board.js) and driven through the game contract. */
(function () {
  const SIZE = 4;

  Arcade.register({
    id: "2048",
    name: "Fuse *2048*",
    tagline: "Slide and merge tiles up to 2048. The meditative classic.",
    accent: "#e0a84b",
    complexity: "low",
    controls: "arrows",
    scoreLabel: "Score",
    create() {
      let boardEl, tilesEl, ctx;
      let grid, score, uid, over;
      let cell = 0, gap = 0;
      let unResize = null;

      // neon tile tints — soft, ramping warm; text via CSS
      function tint(v) {
        const stops = {
          2: "#5c5238", 4: "#726030", 8: "#96702a", 16: "#b07f24",
          32: "#c78d22", 64: "#d99724", 128: "#e6a52c", 256: "#e8ad42",
          512: "#eeb857", 1024: "#f2c46a", 2048: "#f7d182"
        };
        return stops[v] || "#f7d182";
      }

      function empty() { return Array.from({ length: SIZE }, () => Array(SIZE).fill(null)); }

      function relayout() {
        const l = Arcade.board.layout(boardEl, SIZE, SIZE);
        cell = l.cell; gap = l.gap;
        draw(true);
      }

      function spawn() {
        const free = [];
        for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!grid[r][c]) free.push([r, c]);
        if (!free.length) return null;
        const [r, c] = free[Math.floor(Math.random() * free.length)];
        grid[r][c] = { id: uid++, val: Math.random() < 0.9 ? 2 : 4, r, c, isNew: true };
        return grid[r][c];
      }

      function draw(reposOnly) {
        tilesEl.innerHTML = "";
        for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
          const t = grid[r][c]; if (!t) continue;
          const el = document.createElement("div");
          el.className = "n2048-tile";
          el.textContent = t.val;
          el.style.width = cell + "px"; el.style.height = cell + "px";
          el.style.background = tint(t.val);
          el.style.color = t.val <= 4 ? "var(--text)" : "#1a1206";
          el.style.fontSize = Math.round(cell * (t.val >= 1024 ? 0.28 : t.val >= 128 ? 0.34 : 0.42)) + "px";
          if (t.val >= 8) el.style.boxShadow = "0 0 " + Math.round(cell * 0.22) +
            "px color-mix(in srgb, " + tint(t.val) + " 60%, transparent)";
          const p = Arcade.board.cellPos(t.r, t.c, cell, gap);
          el.style.setProperty("--x", p.x + "px");
          el.style.setProperty("--y", p.y + "px");
          el.style.transform = "translate(" + p.x + "px," + p.y + "px)";
          if (t.isNew && !reposOnly) { el.classList.add("spawn"); t.isNew = false; }
          if (t.merged && !reposOnly) { el.classList.add("merge"); t.merged = false; }
          tilesEl.appendChild(el);
          t.el = el;
        }
      }

      function move(dir) {
        if (over) return;
        let moved = false, mergedVal = 0;
        const lines = [];
        if (dir === "left" || dir === "right") {
          for (let r = 0; r < SIZE; r++) { const line = []; for (let c = 0; c < SIZE; c++) line.push([r, c]); if (dir === "right") line.reverse(); lines.push(line); }
        } else {
          for (let c = 0; c < SIZE; c++) { const line = []; for (let r = 0; r < SIZE; r++) line.push([r, c]); if (dir === "down") line.reverse(); lines.push(line); }
        }
        lines.forEach((line) => {
          const tiles = line.map(([r, c]) => grid[r][c]).filter(Boolean);
          const result = [];
          for (let i = 0; i < tiles.length; i++) {
            if (i < tiles.length - 1 && tiles[i].val === tiles[i + 1].val) {
              const nv = tiles[i].val * 2;
              tiles[i + 1].val = nv; tiles[i + 1].merged = true;
              result.push(tiles[i + 1]);
              score += nv; mergedVal = Math.max(mergedVal, nv);
              i++; moved = true;
            } else result.push(tiles[i]);
          }
          line.forEach(([r, c], idx) => {
            const t = result[idx] || null;
            if (t) { if (t.r !== r || t.c !== c) moved = true; t.r = r; t.c = c; grid[r][c] = t; }
            else grid[r][c] = null;
          });
        });

        if (moved) {
          for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
            const t = grid[r][c];
            if (t && t.el) { const p = Arcade.board.cellPos(r, c, cell, gap); t.el.style.transform = "translate(" + p.x + "px," + p.y + "px)"; }
          }
          if (mergedVal) ctx.audio.win(Math.log2(mergedVal)); else ctx.audio.move();
          ctx.setScore(score);
          setTimeout(() => { spawn(); draw(); checkOver(); }, 120);
        }
      }

      function checkOver() {
        for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
          if (!grid[r][c]) return;
          const v = grid[r][c].val;
          if (c < SIZE - 1 && grid[r][c + 1] && grid[r][c + 1].val === v) return;
          if (r < SIZE - 1 && grid[r + 1][c] && grid[r + 1][c].val === v) return;
        }
        over = true;
        ctx.onGameOver(score, { title: "Board's locked.", msg: "Score: " + score + ". Solid grind." });
      }

      return {
        mount(stage, c) {
          ctx = c;
          const wrap = document.createElement("div");
          boardEl = document.createElement("div");
          boardEl.className = "board";
          tilesEl = document.createElement("div");
          tilesEl.className = "n2048-tiles";
          boardEl.appendChild(tilesEl);
          wrap.appendChild(boardEl);
          const hint = document.createElement("div");
          hint.className = "hint";
          hint.textContent = "Arrow keys / WASD / swipe to move";
          wrap.appendChild(hint);
          stage.appendChild(wrap);

          grid = empty(); score = 0; uid = 1; over = false;
          relayout();
          spawn(); spawn(); draw();
          unResize = Arcade.board.onResize(relayout);
          Arcade.touch.dpad(stage, move);
        },
        handleInput(intent) { if (intent.type === "dir") move(intent.dir); },
        teardown() { if (unResize) unResize(); Arcade.touch.clear(); }
      };
    }
  });
})();
