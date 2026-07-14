/* Stack — a calm neon block stacker (Tetris-ish). Falling tetrominoes on a
   10x18 grid, soft-glow blocks in the lavender accent family, satisfying
   line clears. Self-contained classic script, registers on load. */
(function () {
  const COLS = 10, ROWS = 18;

  // 7 muted accent-family neon tints — distinct but all calm, soft glow.
  const COLORS = {
    I: "#79c2e0", // soft sky
    O: "#d9b3f0", // light lavender
    T: "#b57edc", // orchid (accent)
    S: "#8fd9c4", // soft mint
    Z: "#e59bbf", // soft rose
    J: "#8b9ff0", // periwinkle
    L: "#c9a0e0"  // mauve
  };

  // spawn-state matrices (1 = filled)
  const SHAPES = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]]
  };
  const TYPES = ["I", "O", "T", "S", "Z", "J", "L"];

  Arcade.register({
    id: "stack",
    name: "Stack",
    tagline: "Drop and clear lines. The neon block stacker.",
    accent: "#b57edc",
    complexity: "med-high",
    controls: "arrows",
    scoreLabel: "Lines",
    create() {
      let boardEl, gridEl, tilesEl, flashEl, ctx;
      let grid, piece, bag;
      let lines, over, paused;
      let cell = 0, gap = 0;
      let acc = 0, stepTime = 600;
      let unResize = null, injected = false;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      function injectStyle() {
        if (injected) return;
        injected = true;
        const s = document.createElement("style");
        s.textContent =
          ".stack-cellline{position:absolute;border-radius:14%;" +
          "background:color-mix(in srgb,var(--accent) 5%,transparent);" +
          "box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--accent) 9%,transparent);}" +
          ".stack-block{position:absolute;border-radius:16%;}" +
          ".stack-ghost{position:absolute;border-radius:16%;" +
          "box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--accent) 26%,transparent);}" +
          ".stack-flash{position:absolute;border-radius:6px;background:var(--accent);" +
          "opacity:0;pointer-events:none;}" +
          "@keyframes stackFlash{0%{opacity:.55}100%{opacity:0}}" +
          ".stack-flash.go{animation:stackFlash .34s ease-out forwards;}";
        document.head.appendChild(s);
      }

      function emptyGrid() {
        return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
      }

      function nextType() {
        if (!bag || !bag.length) {
          bag = TYPES.slice();
          for (let i = bag.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = bag[i]; bag[i] = bag[j]; bag[j] = t;
          }
        }
        return bag.pop();
      }

      function rotateCW(m) {
        const h = m.length, w = m[0].length;
        const out = Array.from({ length: w }, () => Array(h).fill(0));
        for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) out[c][h - 1 - r] = m[r][c];
        return out;
      }

      function cellsOf(matrix, r, c) {
        const out = [];
        for (let dr = 0; dr < matrix.length; dr++)
          for (let dc = 0; dc < matrix[dr].length; dc++)
            if (matrix[dr][dc]) out.push([r + dr, c + dc]);
        return out;
      }

      function fits(matrix, r, c) {
        const cs = cellsOf(matrix, r, c);
        for (let i = 0; i < cs.length; i++) {
          const pr = cs[i][0], pc = cs[i][1];
          if (pc < 0 || pc >= COLS || pr >= ROWS) return false;
          if (pr >= 0 && grid[pr][pc]) return false;
        }
        return true;
      }

      function spawn() {
        const type = nextType();
        const matrix = SHAPES[type];
        const c = Math.floor((COLS - matrix[0].length) / 2);
        piece = { type, matrix, color: COLORS[type], r: 0, c };
        if (!fits(matrix, piece.r, piece.c)) {
          over = true;
          piece = null;
          ctx.onGameOver(lines, { title: "Stacked out.", msg: "Lines: " + lines });
        }
      }

      function ghostRow() {
        let r = piece.r;
        while (fits(piece.matrix, r + 1, piece.c)) r++;
        return r;
      }

      function relayout() {
        // tall board: drive height off the shared stage sizer (clamped to 84vh),
        // width follows via the 10:18 aspect ratio. Much bigger than the old 600px cap.
        boardEl.style.height = Arcade.board.stageSize(940) + "px";
        const l = Arcade.board.layout(boardEl, COLS, ROWS);
        cell = l.cell; gap = l.gap;
        drawGrid();
        draw();
      }

      // static faint cell backing, rebuilt only on resize
      function drawGrid() {
        gridEl.innerHTML = "";
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
          const d = document.createElement("div");
          d.className = "stack-cellline";
          const p = Arcade.board.cellPos(r, c, cell, gap);
          d.style.width = cell + "px"; d.style.height = cell + "px";
          d.style.transform = "translate(" + p.x + "px," + p.y + "px)";
          gridEl.appendChild(d);
        }
      }

      function blockEl(color, isGhost) {
        const el = document.createElement("div");
        el.className = isGhost ? "stack-ghost" : "stack-block";
        el.style.width = cell + "px"; el.style.height = cell + "px";
        if (!isGhost) {
          el.style.background = color;
          el.style.boxShadow =
            "0 0 " + Math.round(cell * 0.32) + "px color-mix(in srgb," + color + " 55%,transparent)," +
            "inset 0 0 " + Math.round(cell * 0.22) + "px color-mix(in srgb,#fff 28%,transparent)";
        }
        return el;
      }

      function place(el, r, c) {
        const p = Arcade.board.cellPos(r, c, cell, gap);
        el.style.transform = "translate(" + p.x + "px," + p.y + "px)";
      }

      function draw() {
        tilesEl.innerHTML = "";
        // locked blocks
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
          const col = grid[r][c];
          if (!col) continue;
          const el = blockEl(col, false);
          place(el, r, c);
          tilesEl.appendChild(el);
        }
        if (!piece) return;
        // ghost landing hint
        const gr = ghostRow();
        if (gr !== piece.r) {
          cellsOf(piece.matrix, gr, piece.c).forEach(([r, c]) => {
            if (r < 0) return;
            const el = blockEl(piece.color, true);
            place(el, r, c);
            tilesEl.appendChild(el);
          });
        }
        // active piece
        cellsOf(piece.matrix, piece.r, piece.c).forEach(([r, c]) => {
          if (r < 0) return;
          const el = blockEl(piece.color, false);
          place(el, r, c);
          tilesEl.appendChild(el);
        });
      }

      function lockPiece() {
        cellsOf(piece.matrix, piece.r, piece.c).forEach(([r, c]) => {
          if (r >= 0 && r < ROWS && c >= 0 && c < COLS) grid[r][c] = piece.color;
        });
        piece = null;
        ctx.audio.place();
        clearLines();
        if (!over) spawn();
      }

      function clearLines() {
        const full = [];
        for (let r = 0; r < ROWS; r++) {
          let solid = true;
          for (let c = 0; c < COLS; c++) if (!grid[r][c]) { solid = false; break; }
          if (solid) full.push(r);
        }
        if (!full.length) return;
        flashRows(full);
        // remove full rows, drop everything above
        for (let i = 0; i < full.length; i++) {
          grid.splice(full[i], 1);
          grid.unshift(Array(COLS).fill(null));
        }
        lines += full.length;
        ctx.setScore(lines);
        // bigger, brighter for multi-line clears
        ctx.audio.win(full.length * 3);
        if (full.length >= 3) ctx.audio.combo(full.length * 2);
        // gentle speed-up
        const level = Math.floor(lines / 8);
        stepTime = Math.max(140, 600 - level * 55);
      }

      function flashRows(rows) {
        if (reduced) return;
        rows.forEach((r) => {
          const f = document.createElement("div");
          f.className = "stack-flash";
          const p = Arcade.board.cellPos(r, 0, cell, gap);
          f.style.transform = "translate(" + p.x + "px," + p.y + "px)";
          f.style.width = (COLS * cell + (COLS - 1) * gap) + "px";
          f.style.height = cell + "px";
          flashEl.appendChild(f);
          // force reflow then animate
          void f.offsetWidth;
          f.classList.add("go");
          setTimeout(() => { if (f.parentNode) f.parentNode.removeChild(f); }, 400);
        });
      }

      function stepDown() {
        if (!piece) return;
        if (fits(piece.matrix, piece.r + 1, piece.c)) { piece.r++; }
        else { lockPiece(); }
      }

      function tryMove(dc) {
        if (!piece) return;
        if (fits(piece.matrix, piece.r, piece.c + dc)) {
          piece.c += dc;
          ctx.audio.move();
          draw();
        }
      }

      function tryRotate() {
        if (!piece) return;
        const rot = rotateCW(piece.matrix);
        const kicks = [0, -1, 1, -2, 2];
        for (let i = 0; i < kicks.length; i++) {
          if (fits(rot, piece.r, piece.c + kicks[i])) {
            piece.matrix = rot;
            piece.c += kicks[i];
            ctx.audio.soft();
            draw();
            return;
          }
        }
      }

      function steer(d) {
        if (over || paused || !piece) return;
        if (d === "left") tryMove(-1);
        else if (d === "right") tryMove(1);
        else if (d === "up") tryRotate();
        else if (d === "down") { stepDown(); acc = 0; if (piece) ctx.audio.tick(); draw(); }
      }

      function hardDrop() {
        if (!piece) return;
        let dropped = 0;
        while (fits(piece.matrix, piece.r + 1, piece.c)) { piece.r++; dropped++; }
        if (dropped) ctx.audio.thunk();
        lockPiece();
        acc = 0;
        draw();
      }

      return {
        mount(stage, c) {
          ctx = c;
          injectStyle();

          const wrap = document.createElement("div");
          boardEl = document.createElement("div");
          boardEl.className = "board";
          // override the shell's square board into a tall 10:18 rectangle
          boardEl.style.width = "auto";
          boardEl.style.height = "min(80vh, 600px)";
          boardEl.style.maxWidth = "92vw";
          boardEl.style.aspectRatio = "10 / 18";

          gridEl = document.createElement("div");
          tilesEl = document.createElement("div");
          flashEl = document.createElement("div");
          [gridEl, tilesEl, flashEl].forEach((el) => {
            el.style.position = "absolute";
            el.style.inset = "0";
            boardEl.appendChild(el);
          });

          wrap.appendChild(boardEl);
          const hint = document.createElement("div");
          hint.className = "hint";
          hint.textContent = "← → move · ↑ rotate · ↓ drop · space slam";
          wrap.appendChild(hint);
          stage.appendChild(wrap);

          grid = emptyGrid();
          bag = null;
          lines = 0; over = false; paused = false;
          acc = 0; stepTime = 600;
          ctx.setScore(0);
          relayout();
          spawn();
          draw();
          unResize = Arcade.board.onResize(relayout);
          Arcade.touch.dpad(stage, steer);
          Arcade.touch.action(stage, hardDrop, null, "slam");
        },

        handleInput(intent) {
          if (over || paused || !piece) return;
          if (intent.type === "dir") {
            steer(intent.dir);
          } else if (intent.type === "action") {
            hardDrop();
          }
        },

        tick(dt) {
          if (over || paused || !piece) return;
          acc += dt;
          let changed = false;
          while (acc >= stepTime) {
            acc -= stepTime;
            stepDown();
            changed = true;
            if (over || !piece) break;
          }
          if (changed) draw();
        },

        pause() { paused = true; },
        resume() { paused = false; },
        getScore() { return lines; },
        teardown() { if (unResize) unResize(); unResize = null; Arcade.touch.clear(); }
      };
    }
  });
})();
