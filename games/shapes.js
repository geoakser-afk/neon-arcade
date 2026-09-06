/* Shapes & Colors — an educational game for Christopher (age 5). Four big
   colored shapes float on screen. The game SAYS "Find the red circle" (browser
   speech, no files); tap it for confetti and the next puzzle. Tap any shape at
   any time and it names it ("blue triangle"). Wrong taps just wobble and the
   game repeats the ask. Learns: circle, square, triangle, star, heart, diamond
   + red, orange, yellow, green, blue, purple, pink. No losing. */
(function () {
  // spoken lines = pre-rendered Kokoro clips chained by the shell (Arcade.voice); parts = clip keys
  function say(parts) { if (window.Arcade && Arcade.voice) Arcade.voice.say(parts); }
  const COLORS = [
    { n: "red", c: "#ff6b6b" }, { n: "orange", c: "#ffb86b" }, { n: "yellow", c: "#ffd36b" }, { n: "green", c: "#7fe0a0" },
    { n: "blue", c: "#74b9ff" }, { n: "purple", c: "#c98cff" }, { n: "pink", c: "#ff8fd0" }
  ];
  const SHAPES = ["circle", "square", "triangle", "star", "heart", "diamond"];
  function shapePath(g, kind, r) {
    g.beginPath();
    if (kind === "circle") g.arc(0, 0, r, 0, Math.PI * 2);
    else if (kind === "square") { const k = r * 0.85; g.moveTo(-k, -k); g.lineTo(k, -k); g.lineTo(k, k); g.lineTo(-k, k); g.closePath(); }
    else if (kind === "triangle") { g.moveTo(0, -r); g.lineTo(r * 0.95, r * 0.75); g.lineTo(-r * 0.95, r * 0.75); g.closePath(); }
    else if (kind === "star") { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; i ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); }
    else if (kind === "heart") { g.moveTo(0, r * 0.85); g.bezierCurveTo(-r * 1.35, -r * 0.05, -r * 0.65, -r * 1.1, 0, -r * 0.45); g.bezierCurveTo(r * 0.65, -r * 1.1, r * 1.35, -r * 0.05, 0, r * 0.85); g.closePath(); }
    else { g.moveTo(0, -r); g.lineTo(r * 0.75, 0); g.lineTo(0, r); g.lineTo(-r * 0.75, 0); g.closePath(); }
  }
  Arcade.register({
    id: "shapes",
    name: "Shapes",
    tagline: "Find the red circle! Shapes and colors, spoken out loud.",
    accent: "#7fe0a0",
    complexity: "low",
    controls: "click",
    scoreLabel: "Found",
    kid: true,
    kidIcon(g, s) {
      const items = [["circle", "#ff6b6b", 0.3, 0.32], ["square", "#74b9ff", 0.7, 0.32], ["triangle", "#ffd36b", 0.3, 0.7], ["star", "#c98cff", 0.7, 0.7]];
      items.forEach(function (q) { g.save(); g.translate(q[2] * s, q[3] * s); g.fillStyle = q[1]; g.shadowColor = q[1]; g.shadowBlur = s * 0.05; shapePath(g, q[0], s * 0.15); g.fill(); g.restore(); });
    },
    create() {
      let stageEl, ctx, canvas, g, unResize = null;
      let S = 0, dpr = 1, reduced = false;
      let now = 0, found = 0;
      let cards = [], target = null, lock = 0, wrongFx = 0;
      let confetti = [];

      function resize() {
        S = Arcade.board.stageSize(880);
        dpr = window.devicePixelRatio || 1;
        canvas.style.width = S + "px"; canvas.style.height = S + "px";
        canvas.width = Math.round(S * dpr); canvas.height = Math.round(S * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      function slots() { return [[0.28, 0.36], [0.72, 0.36], [0.28, 0.74], [0.72, 0.74]].map(function (p) { return { x: p[0] * S, y: p[1] * S }; }); }
      function newPuzzle() {
        // 4 distinct shape+color combos; the target differs from every other card in shape OR color
        cards = [];
        const usedShapes = [], usedCols = [];
        while (cards.length < 4) {
          const sh = SHAPES[Math.floor(Math.random() * SHAPES.length)], co = COLORS[Math.floor(Math.random() * COLORS.length)];
          if (usedShapes.indexOf(sh) >= 0 && usedCols.indexOf(co.n) >= 0) continue;
          if (cards.some(function (c) { return c.shape === sh && c.col.n === co.n; })) continue;
          usedShapes.push(sh); usedCols.push(co.n);
          cards.push({ shape: sh, col: co, sq: 0, ph: Math.random() * 6.28, spin: (Math.random() - 0.5) * 0.4 });
        }
        target = cards[Math.floor(Math.random() * 4)];
        lock = 0;
        say(["Find the", target.col.n, target.shape]);
      }
      function ask() { if (target) say(["Find the", target.col.n, target.shape]); }
      function tapCard(c) {
        if (lock > 0) return;
        c.sq = 1;
        if (c === target) {
          found++; ctx.setScore(found); lock = 2000;
          ctx.audio.arp([523, 659, 784, 1046], { dur: 0.18, step: 0.07, vol: 0.14, type: "sine" });
          say(["Yes! The", c.col.n, c.shape]);
          const sl = slots()[cards.indexOf(c)];
          for (let i = 0; i < (reduced ? 10 : 50); i++) { const a = Math.random() * 6.28, sp = S * (0.0003 + Math.random() * 0.0006); confetti.push({ x: sl.x, y: sl.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - S * 0.0004, life: 1, r: S * (0.005 + Math.random() * 0.006), col: ["#ffd36b", "#ff8fd0", "#74b9ff", "#7fe0a0"][i % 4] }); }
          setTimeout(function () { if (ctx) newPuzzle(); }, 1900);
        } else {
          wrongFx = 1; ctx.audio.tone(300, 0.14, { type: "triangle", vol: 0.07, glide: 240 });
          say(["That's the", c.col.n, c.shape, "Find the", target.col.n, target.shape]);
        }
      }
      function update(dt) {
        now += dt;
        cards.forEach(function (c) { if (c.sq > 0) c.sq = Math.max(0, c.sq - dt / 350); });
        if (lock > 0) lock -= dt;
        if (wrongFx > 0) wrongFx = Math.max(0, wrongFx - dt / 400);
        for (let i = confetti.length - 1; i >= 0; i--) { const c = confetti[i]; c.vy += S * 0.0000015 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.life -= dt / 1400; if (c.life <= 0) confetti.splice(i, 1); }
      }
      function draw() {
        g.clearRect(0, 0, S, S);
        const bg = g.createLinearGradient(0, 0, 0, S); bg.addColorStop(0, "#0f1a18"); bg.addColorStop(1, "#0b0a14");
        g.fillStyle = bg; g.fillRect(0, 0, S, S);
        g.save(); g.textAlign = "left"; g.textBaseline = "middle"; g.fillStyle = "#ffd36b"; g.shadowColor = "rgba(255,211,107,0.6)"; g.shadowBlur = 14;
        g.font = "800 " + Math.round(S * 0.05) + "px system-ui, sans-serif"; g.fillText("★ " + found, S * 0.05, S * 0.08); g.restore();
        // speaker button (repeat the ask) — top center
        g.save(); const sx = S * 0.5, sy = S * 0.09, sr = S * 0.045, pulse = 0.5 + 0.5 * Math.sin(now * 0.004);
        g.fillStyle = "rgba(127,224,160,0.14)"; g.shadowColor = "#7fe0a0"; g.shadowBlur = S * 0.01 + pulse * S * 0.012; g.beginPath(); g.arc(sx, sy, sr, 0, 6.29); g.fill(); g.shadowBlur = 0;
        g.strokeStyle = "rgba(127,224,160,0.7)"; g.lineWidth = 2; g.stroke();
        g.fillStyle = "#e6ecf5"; g.beginPath(); g.moveTo(sx - sr * 0.45, sy - sr * 0.22); g.lineTo(sx - sr * 0.15, sy - sr * 0.22); g.lineTo(sx + sr * 0.15, sy - sr * 0.5); g.lineTo(sx + sr * 0.15, sy + sr * 0.5); g.lineTo(sx - sr * 0.15, sy + sr * 0.22); g.lineTo(sx - sr * 0.45, sy + sr * 0.22); g.closePath(); g.fill();
        g.strokeStyle = "#e6ecf5"; g.lineWidth = 2; g.beginPath(); g.arc(sx + sr * 0.2, sy, sr * 0.35, -0.9, 0.9); g.stroke(); g.beginPath(); g.arc(sx + sr * 0.2, sy, sr * 0.6, -0.9, 0.9); g.stroke(); g.restore();
        // the ask, as pictures: a small target shape in the speaker's color hint (no reading needed)
        if (target) { g.save(); g.translate(S * 0.62, S * 0.09); g.fillStyle = target.col.c; g.shadowColor = target.col.c; g.shadowBlur = S * 0.02; shapePath(g, target.shape, S * 0.03); g.fill(); g.restore(); }
        // cards
        const sl = slots();
        cards.forEach(function (c, i) {
          const p = sl[i], r = S * 0.14, bob = Math.sin(now * 0.002 + c.ph) * S * 0.008;
          let shake = 0; if (wrongFx > 0 && c !== target) shake = Math.sin(now * 0.05) * wrongFx * S * 0.006;
          g.save(); g.translate(p.x + shake, p.y + bob); g.rotate(Math.sin(now * 0.0015 + c.ph) * 0.05); g.scale(1 + c.sq * 0.18, 1 - c.sq * 0.18);
          const win = lock > 0 && c === target;
          g.fillStyle = win ? "rgba(127,224,160,0.15)" : "rgba(255,255,255,0.04)"; g.beginPath(); g.arc(0, 0, r * 1.35, 0, 6.29); g.fill();
          const gr = g.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.1); gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.28, c.col.c); gr.addColorStop(1, c.col.c);
          g.fillStyle = gr; g.shadowColor = c.col.c; g.shadowBlur = r * 0.5 + (win ? r * 0.5 : 0);
          shapePath(g, c.shape, r); g.fill(); g.shadowBlur = 0;
          g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 3; g.stroke();
          g.restore();
        });
        confetti.forEach(function (c2) { g.save(); g.globalAlpha = Math.max(0, c2.life); g.fillStyle = c2.col; g.translate(c2.x, c2.y); g.rotate(c2.x * 0.05); g.fillRect(-c2.r, -c2.r * 0.6, c2.r * 2, c2.r * 1.2); g.restore(); });
      }

      return {
        mount(stage, c) {
          stageEl = stage; ctx = c;
          reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          const wrap = document.createElement("div");
          wrap.style.display = "flex"; wrap.style.flexDirection = "column"; wrap.style.alignItems = "center";
          canvas = document.createElement("canvas");
          canvas.style.borderRadius = "18px"; canvas.style.background = "#0f1a18"; canvas.style.cursor = "pointer";
          canvas.style.boxShadow = "0 0 46px rgba(127,224,160,0.14)"; canvas.style.touchAction = "none";
          g = canvas.getContext("2d");
          wrap.appendChild(canvas);
          const hint = document.createElement("div"); hint.className = "hint";
          hint.textContent = "Listen, then tap the shape it asks for · tap the speaker to hear it again · tap any shape to hear its name";
          wrap.appendChild(hint);
          stage.appendChild(wrap);
          now = 0; found = 0; confetti = []; ctx.setScore(0);
          resize(); newPuzzle();
          Arcade.input.setPointerTarget(canvas);
          unResize = Arcade.board.onResize(function () { resize(); });
          draw();
        },
        handleInput(intent) {
          if (intent.type !== "point" || intent.phase !== "down" || intent.button !== 0) return;
          const x = intent.x, y = intent.y;
          if (Math.hypot(x - S * 0.5, y - S * 0.09) < S * 0.07) { ask(); return; }
          const sl = slots(); let best = -1, bd = Infinity;
          sl.forEach(function (p, i) { const d = Math.hypot(x - p.x, y - p.y); if (d < S * 0.2 && d < bd) { bd = d; best = i; } });
          if (best >= 0) { tapCard(cards[best]); return; }
          ctx.audio.tone(330, 0.08, { type: "sine", vol: 0.04, glide: 420 });
        },
        tick(dt) { update(Math.min(50, dt)); draw(); },
        getScore() { return found; },
        teardown() {
          if (window.Arcade && Arcade.voice) Arcade.voice.stop();
          if (unResize) unResize(); unResize = null;
          stageEl = ctx = canvas = g = null; cards = []; confetti = [];
        }
      };
    }
  });
})();
