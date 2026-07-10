/* Blackout — Lights Out on a 5x5 grid. Toggle a cell + its neighbors,
   clear the whole board. Always solvable. */
(function () {
  const N = 5;
  const SCRAMBLE = 8;

  Arcade.register({
    id: "lightsout",
    name: "Blackout",
    tagline: "Flip the lights out. One clean board.",
    accent: "#7fe0a0",
    complexity: "low",
    controls: "mouse",
    scoreLabel: "Moves",
    create() {
      let boardEl, gridEl, ctx;
      let lit, cells, moves, over;
      let cell = 0, gap = 0;
      let unResize = null, styleEl = null;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      function injectStyle() {
        if (document.getElementById("blackout-style")) return;
        styleEl = document.createElement("style");
        styleEl.id = "blackout-style";
        styleEl.textContent =
          ".bo-grid{position:absolute;inset:0}" +
          ".bo-cell{position:absolute;box-sizing:border-box;border-radius:10px;cursor:pointer;" +
          "user-select:none;background:#10131a;border:1px solid var(--accent-faint);" +
          "transition:background .22s ease,box-shadow .22s ease,transform .12s ease;}" +
          ".bo-cell:hover{transform:scale(.97);}" +
          ".bo-cell.on{background:color-mix(in srgb,var(--accent) 30%,#10131a);" +
          "border-color:var(--accent-soft);" +
          "box-shadow:0 0 14px var(--accent-soft),0 0 32px var(--accent-faint)," +
          "inset 0 0 12px color-mix(in srgb,var(--accent) 30%,transparent);}" +
          "@keyframes bo-bloom{0%{box-shadow:0 0 0 0 var(--accent-soft);}" +
          "60%{box-shadow:0 0 40px 12px var(--accent-soft),0 0 80px 24px var(--accent-faint);}" +
          "100%{box-shadow:0 0 0 0 transparent;}}" +
          ".bo-cell.bloom{animation:bo-bloom .7s ease;}";
        document.head.appendChild(styleEl);
      }

      function idx(r, c) { return r * N + c; }

      function toggle(r, c) {
        lit[idx(r, c)] = !lit[idx(r, c)];
      }

      function press(r, c) {
        toggle(r, c);
        if (r > 0) toggle(r - 1, c);
        if (r < N - 1) toggle(r + 1, c);
        if (c > 0) toggle(r, c - 1);
        if (c < N - 1) toggle(r, c + 1);
      }

      function scramble() {
        lit = new Array(N * N).fill(false);
        let clicks = 0;
        // apply random valid presses -> guaranteed solvable
        while (clicks < SCRAMBLE || lit.every((v) => !v)) {
          press(Math.floor(Math.random() * N), Math.floor(Math.random() * N));
          clicks++;
          if (clicks > SCRAMBLE + 40) break;
        }
      }

      function relayout() {
        boardEl.style.setProperty("--board-size", Arcade.board.stageSize(720) + "px");
        const l = Arcade.board.layout(boardEl, N, N);
        cell = l.cell; gap = l.gap;
        draw();
      }

      function draw() {
        gridEl.innerHTML = "";
        cells = new Array(N * N);
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
          const el = document.createElement("div");
          el.className = "bo-cell" + (lit[idx(r, c)] ? " on" : "");
          el.style.width = cell + "px"; el.style.height = cell + "px";
          const p = Arcade.board.cellPos(r, c, cell, gap);
          el.style.left = p.x + "px"; el.style.top = p.y + "px";
          cells[idx(r, c)] = el;
          gridEl.appendChild(el);
        }
      }

      function repaint() {
        for (let i = 0; i < N * N; i++) {
          if (!cells[i]) continue;
          cells[i].classList.toggle("on", lit[i]);
        }
      }

      function handleClick(r, c) {
        if (over) return;
        press(r, c);
        moves++;
        repaint();
        ctx.setScore(moves);
        if (lit.every((v) => !v)) {
          over = true;
          ctx.audio.score();
          if (!reduceMotion) {
            cells.forEach((el, i) => {
              el.classList.remove("bloom");
              void el.offsetWidth;
              el.style.animationDelay = ((Math.floor(i / N) + (i % N)) * 40) + "ms";
              el.classList.add("bloom");
            });
          }
          ctx.onGameOver(moves, {
            title: "All clear.",
            msg: "Solved in " + moves + " moves."
          });
        } else {
          ctx.audio.pick();
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
          gridEl.className = "bo-grid";
          boardEl.appendChild(gridEl);
          wrap.appendChild(boardEl);
          const hint = document.createElement("div");
          hint.className = "hint";
          hint.textContent = "Click to toggle a light + its neighbors · clear the board";
          wrap.appendChild(hint);
          stage.appendChild(wrap);

          moves = 0; over = false;
          scramble();
          relayout();
          ctx.setScore(0);
          Arcade.input.setPointerTarget(gridEl);
          unResize = Arcade.board.onResize(relayout);
        },
        handleInput(intent) {
          if (intent.type !== "point" || intent.phase !== "down" || intent.button !== 0) return;
          if (over) return;
          const step = cell + gap;
          const c = Math.floor((intent.x - gap) / step);
          const r = Math.floor((intent.y - gap) / step);
          if (r < 0 || r >= N || c < 0 || c >= N) return;
          handleClick(r, c);
        },
        teardown() {
          if (unResize) unResize();
          if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
        }
      };
    }
  });
})();
