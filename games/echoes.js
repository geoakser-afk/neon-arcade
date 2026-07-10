/* Echoes — neon memory match with an audio twist. Each pair owns a note
   from a pentatonic scale; revealing a tile plays it, matching harmonizes
   the two into a chord. Memory for sound as well as symbol. */
(function () {
  Arcade.register({
    id: "memory",
    name: "Echoes",
    tagline: "Match the pairs — by symbol and by sound.",
    accent: "#e88bb0",
    complexity: "low",
    controls: "mouse",
    scoreLabel: "Pairs",
    create() {
      const COLS = 4, ROWS = 4;              // 4x4 = 8 pairs
      const PAIRS = (COLS * ROWS) / 2;
      // pentatonic-ish scale, one distinct note per pair
      const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 784.0, 880.0];
      const GLYPHS = ["◆", "●", "▲", "■", "★", "✦", "♦", "▼", "✴", "❖"];
      // accent-family hues (soft, muted, in the pink/rose accent family + warm neighbors)
      const HUES = ["#e88bb0", "#d98bc9", "#e89bb8", "#c98be0", "#e0a0b8", "#e8a0d0", "#d0a0e0", "#e88b9b", "#c98bb0", "#e0b0c8"];

      let boardEl, ctx, gridEl;
      let unResize = null;
      let cards = [];        // { el, pair, revealed, locked }
      let first = null, second = null;
      let busy = false;      // true while comparing two
      let matched = 0;
      let flipTimer = null;
      let injected = false;

      function injectStyle() {
        if (injected || document.getElementById("echoes-style")) { injected = true; return; }
        const s = document.createElement("style");
        s.id = "echoes-style";
        s.textContent = [
          ".echoes-grid{position:absolute;inset:0;display:grid;gap:var(--gap,10px);padding:var(--gap,10px);}",
          ".echoes-card{position:relative;border-radius:var(--radius-sm);cursor:pointer;transform-style:preserve-3d;transition:transform 300ms var(--ease);}",
          ".echoes-card .face{position:absolute;inset:0;border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;backface-visibility:hidden;-webkit-backface-visibility:hidden;}",
          ".echoes-card .back{background:var(--surface);border:1px solid var(--line);}",
          ".echoes-card .back::after{content:'';width:26%;height:26%;border-radius:50%;background:var(--accent-faint);box-shadow:0 0 12px var(--accent-faint);}",
          ".echoes-card .front{transform:rotateY(180deg);background:var(--surface-hi);border:1px solid var(--eh,var(--accent-soft));font-weight:800;color:var(--eh,var(--accent));text-shadow:0 0 10px var(--eh,var(--accent-soft));}",
          ".echoes-card.up{transform:rotateY(180deg);}",
          ".echoes-card.locked .front{box-shadow:0 0 16px var(--eh,var(--accent-soft)),0 0 34px var(--eh,var(--accent-faint));border-color:var(--eh,var(--accent));}",
          ".echoes-card.locked{cursor:default;}",
          "@media (prefers-reduced-motion: reduce){.echoes-card{transition-duration:80ms;}}"
        ].join("");
        document.head.appendChild(s);
        injected = true;
      }

      function relayout() {
        boardEl.style.setProperty("--board-size", Arcade.board.stageSize(780) + "px");
        const l = Arcade.board.layout(boardEl, COLS, ROWS);
        const fs = Math.round(l.cell * 0.46);
        cards.forEach((c) => { c.el.style.fontSize = fs + "px"; });
      }

      function shuffle(a) {
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      }

      function reset() {
        const deck = [];
        for (let p = 0; p < PAIRS; p++) { deck.push(p); deck.push(p); }
        shuffle(deck);
        gridEl.innerHTML = "";
        cards = [];
        deck.forEach((pair) => {
          const card = document.createElement("div");
          card.className = "echoes-card";
          card.style.setProperty("--eh", HUES[pair]);
          const back = document.createElement("div");
          back.className = "face back";
          const front = document.createElement("div");
          front.className = "face front";
          front.textContent = GLYPHS[pair];
          card.appendChild(back);
          card.appendChild(front);
          gridEl.appendChild(card);
          cards.push({ el: card, pair, revealed: false, locked: false });
        });
        first = null; second = null; busy = false; matched = 0;
      }

      function cardFromEl(target) {
        let el = target;
        while (el && el !== gridEl && !el.classList.contains("echoes-card")) el = el.parentNode;
        if (!el || el === gridEl) return null;
        return cards.find((c) => c.el === el) || null;
      }

      function flipUp(c) {
        c.revealed = true;
        c.el.classList.add("up");
        ctx.audio.tone(SCALE[c.pair], 0.3, { type: "sine", vol: 0.18 });
      }

      function flipDown(c) {
        c.revealed = false;
        c.el.classList.remove("up");
      }

      function pick(c) {
        if (busy || !c || c.revealed || c.locked) return;
        if (!first) { first = c; flipUp(c); return; }
        if (c === first) return;
        second = c; flipUp(c);
        busy = true;
        if (first.pair === second.pair) {
          // match — harmonize the two notes and lock
          const f = SCALE[first.pair];
          const a = first, b = second;
          setTimeout(() => {
            a.locked = b.locked = true;
            a.el.classList.add("locked");
            b.el.classList.add("locked");
            ctx.audio.chord([f, f * 1.5], 0.34, { type: "sine", vol: 0.2 });
            matched++;
            ctx.setScore(matched);
            first = null; second = null; busy = false;
            if (matched === PAIRS) {
              ctx.audio.score();
              ctx.onGameOver(matched, { title: "All matched.", msg: "Every echo answered — " + matched + " pairs. Clean run." });
            }
          }, 260);
        } else {
          // no match — soft tone, flip back
          const a = first, b = second;
          flipTimer = setTimeout(() => {
            ctx.audio.soft();
            flipDown(a); flipDown(b);
            first = null; second = null; busy = false;
            flipTimer = null;
          }, 700);
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
          gridEl.className = "echoes-grid";
          boardEl.appendChild(gridEl);
          wrap.appendChild(boardEl);
          const hint = document.createElement("div");
          hint.className = "hint";
          hint.textContent = "Click tiles to find matching pairs";
          wrap.appendChild(hint);
          stage.appendChild(wrap);

          reset();
          relayout();
          Arcade.input.setPointerTarget(boardEl);
          unResize = Arcade.board.onResize(relayout);
        },
        handleInput(intent) {
          if (intent.type !== "point" || intent.phase !== "down" || intent.button !== 0) return;
          ctx.audio.unlock();
          pick(cardFromEl(intent.el));
        },
        getScore() { return matched; },
        teardown() {
          if (unResize) unResize();
          if (flipTimer) { clearTimeout(flipTimer); flipTimer = null; }
          cards = []; first = second = null; busy = false;
        }
      };
    }
  });
})();
