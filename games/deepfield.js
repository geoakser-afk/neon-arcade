/* Deepfield — Minesweeper reskinned to calm-neon. Clear the field,
   avoid the voids. Left-click reveal, right-click flag. */
(function () {
  const COLS = 10, ROWS = 10, VOIDS = 14;

  Arcade.register({
    id: "minesweeper",
    name: "Deepfield",
    tagline: "Chart the dark. Flag the voids, clear the field.",
    accent: "#8a7ff0",
    complexity: "med",
    controls: "mouse",
    scoreLabel: "Cleared",
    create() {
      let boardEl, gridEl, ctx;
      let cells, revealed, flagged, isVoid, counts;
      let placed, over, won, cleared;
      let cell = 0, gap = 0;
      let unResize = null, styleEl = null, ctxMenu = null;
      let flagMode = false, flagBtn = null;   // touch: tap-to-flag toggle

      function injectStyle() {
        if (document.getElementById("deepfield-style")) return;
        styleEl = document.createElement("style");
        styleEl.id = "deepfield-style";
        styleEl.textContent =
          ".df-grid{position:absolute;inset:0}" +
          ".df-cell{position:absolute;box-sizing:border-box;border-radius:5px;" +
          "display:flex;align-items:center;justify-content:center;font-weight:700;" +
          "cursor:pointer;user-select:none;background:color-mix(in srgb,var(--accent) 8%,#12121a);" +
          "border:1px solid var(--accent-faint);transition:background .12s ease,box-shadow .12s ease;}" +
          ".df-cell:hover{background:color-mix(in srgb,var(--accent) 15%,#12121a);}" +
          ".df-cell.rev{background:color-mix(in srgb,var(--accent) 4%,#0c0c12);" +
          "border-color:color-mix(in srgb,var(--accent) 12%,transparent);" +
          "box-shadow:inset 0 2px 6px rgba(0,0,0,.5);cursor:default;}" +
          ".df-cell.rev:hover{background:color-mix(in srgb,var(--accent) 4%,#0c0c12);}" +
          ".df-flag{color:var(--accent);text-shadow:0 0 8px var(--accent-soft);}" +
          ".df-dot{width:38%;height:38%;border-radius:50%;" +
          "background:radial-gradient(circle,color-mix(in srgb,var(--accent) 70%,#ff7a9a) 0%,transparent 70%);" +
          "box-shadow:0 0 10px color-mix(in srgb,var(--accent) 50%,transparent);}" +
          ".df-cell.boom{background:color-mix(in srgb,#ff7a9a 22%,#0c0c12);}" +
          ".df-mode{display:block;margin:12px auto 0;padding:12px 22px;border-radius:12px;" +
          "font-size:17px;font-weight:700;letter-spacing:.02em;cursor:pointer;" +
          "color:var(--accent);background:color-mix(in srgb,var(--accent) 10%,#12121a);" +
          "border:1px solid var(--accent-soft);box-shadow:0 0 12px var(--accent-faint);" +
          "-webkit-tap-highlight-color:transparent;touch-action:manipulation;user-select:none;}" +
          ".df-mode.flagging{background:color-mix(in srgb,var(--accent) 28%,#12121a);" +
          "box-shadow:0 0 18px var(--accent-soft);}";
        document.head.appendChild(styleEl);
      }

      function inBounds(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS; }
      function neighbors(r, c) {
        const out = [];
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          if (inBounds(r + dr, c + dc)) out.push([r + dr, c + dc]);
        }
        return out;
      }

      function reset() {
        revealed = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
        flagged = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
        isVoid = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
        counts = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
        placed = false; over = false; won = false; cleared = 0;
      }

      function placeVoids(safeR, safeC) {
        const spots = [];
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
          if (r === safeR && c === safeC) continue;
          spots.push([r, c]);
        }
        for (let i = spots.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const t = spots[i]; spots[i] = spots[j]; spots[j] = t;
        }
        for (let i = 0; i < VOIDS && i < spots.length; i++) {
          const [r, c] = spots[i];
          isVoid[r][c] = true;
        }
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
          if (isVoid[r][c]) continue;
          counts[r][c] = neighbors(r, c).filter(([nr, nc]) => isVoid[nr][nc]).length;
        }
        placed = true;
      }

      function numColor(n) {
        const mix = [0, 30, 45, 60, 72, 84, 92, 98, 100][n] || 60;
        return "color-mix(in srgb,var(--accent) " + mix + "%,#c9c6e6)";
      }

      function relayout() {
        boardEl.style.setProperty("--board-size", Arcade.board.stageSize(820) + "px");
        const l = Arcade.board.layout(boardEl, COLS, ROWS);
        cell = l.cell; gap = l.gap;
        draw();
      }

      function draw() {
        gridEl.innerHTML = "";
        cells = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
          const el = document.createElement("div");
          el.className = "df-cell";
          el.style.width = cell + "px"; el.style.height = cell + "px";
          const p = Arcade.board.cellPos(r, c, cell, gap);
          el.style.left = p.x + "px"; el.style.top = p.y + "px";
          el.style.fontSize = Math.round(cell * 0.5) + "px";
          paint(el, r, c);
          cells[r][c] = el;
          gridEl.appendChild(el);
        }
      }

      function paint(el, r, c) {
        el.className = "df-cell";
        el.textContent = "";
        if (revealed[r][c]) {
          el.classList.add("rev");
          if (isVoid[r][c]) {
            const dot = document.createElement("div");
            dot.className = "df-dot";
            el.appendChild(dot);
            if (over && !won) el.classList.add("boom");
          } else if (counts[r][c] > 0) {
            el.textContent = counts[r][c];
            el.style.color = numColor(counts[r][c]);
          }
        } else if (flagged[r][c]) {
          el.classList.add("df-flag");
          el.textContent = "⚑";
        }
      }

      function repaint() {
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
          if (cells[r][c]) paint(cells[r][c], r, c);
        }
      }

      function reveal(r, c) {
        if (revealed[r][c] || flagged[r][c]) return;
        revealed[r][c] = true;
        cleared++;
        if (counts[r][c] === 0 && !isVoid[r][c]) {
          neighbors(r, c).forEach(([nr, nc]) => {
            if (!revealed[nr][nc] && !flagged[nr][nc]) reveal(nr, nc);
          });
        }
      }

      function handleReveal(r, c) {
        if (over || revealed[r][c] || flagged[r][c]) return;
        if (!placed) placeVoids(r, c);
        if (isVoid[r][c]) {
          revealed[r][c] = true;
          over = true;
          for (let rr = 0; rr < ROWS; rr++) for (let cc = 0; cc < COLS; cc++) {
            if (isVoid[rr][cc]) revealed[rr][cc] = true;
          }
          repaint();
          ctx.audio.lose();
          ctx.setScore(cleared);
          ctx.onGameOver(cleared, {
            title: "Hit a void.",
            msg: "Cleared " + cleared + " before the dark caught you."
          });
          return;
        }
        reveal(r, c);
        repaint();
        ctx.audio.soft();
        ctx.setScore(cleared);
        checkWin();
      }

      function handleFlag(r, c) {
        if (over || revealed[r][c]) return;
        flagged[r][c] = !flagged[r][c];
        paint(cells[r][c], r, c);
        ctx.audio.pick();
      }

      function checkWin() {
        const total = ROWS * COLS - VOIDS;
        if (cleared >= total) {
          over = true; won = true;
          ctx.audio.score();
          ctx.setScore(total);
          ctx.onGameOver(total, {
            title: "Field cleared.",
            msg: "Every safe cell charted. Clean sweep."
          });
        }
      }

      return {
        mount(stage, c) {
          ctx = c;
          injectStyle();
          const wrap = document.createElement("div");
          boardEl = document.createElement("div");
          boardEl.className = "board";
          gridEl = document.createElement("div");
          gridEl.className = "df-grid";
          boardEl.appendChild(gridEl);
          wrap.appendChild(boardEl);
          const hint = document.createElement("div");
          hint.className = "hint";
          const touch = Arcade.touch && Arcade.touch.isTouch;
          hint.textContent = touch
            ? "Tap to dig · switch to flag mode to mark voids"
            : "Left-click reveal · right-click flag";
          wrap.appendChild(hint);

          // On touch there's no right-click, so add a Dig/Flag mode toggle:
          // tapping it flips what a cell-tap does. Reveal stays the default.
          if (touch) {
            flagMode = false;
            flagBtn = document.createElement("button");
            flagBtn.type = "button";
            flagBtn.className = "df-mode";
            flagBtn.textContent = "⛏ Dig mode";
            flagBtn.addEventListener("pointerdown", (e) => {
              e.preventDefault(); e.stopPropagation();
              flagMode = !flagMode;
              flagBtn.classList.toggle("flagging", flagMode);
              flagBtn.textContent = flagMode ? "🚩 Flag mode" : "⛏ Dig mode";
              ctx.audio.pick();
            });
            wrap.appendChild(flagBtn);
          }
          stage.appendChild(wrap);

          ctxMenu = (e) => e.preventDefault();
          boardEl.addEventListener("contextmenu", ctxMenu);

          reset();
          relayout();
          ctx.setScore(0);
          Arcade.input.setPointerTarget(gridEl);
          unResize = Arcade.board.onResize(relayout);
        },
        handleInput(intent) {
          if (intent.type !== "point" || intent.phase !== "down") return;
          if (over) return;
          const step = cell + gap;
          const c = Math.floor((intent.x - gap) / step);
          const r = Math.floor((intent.y - gap) / step);
          if (!inBounds(r, c)) return;
          if (intent.button === 2) handleFlag(r, c);
          else if (intent.button === 0) { if (flagMode) handleFlag(r, c); else handleReveal(r, c); }
        },
        teardown() {
          if (unResize) unResize();
          if (boardEl && ctxMenu) boardEl.removeEventListener("contextmenu", ctxMenu);
          if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
        }
      };
    }
  });
})();
