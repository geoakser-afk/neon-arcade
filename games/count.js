/* Count — an educational game for Christopher (age 5). A handful of big cute
   things (apples, ducks, stars…) appear. Tap them one by one: each one pops
   and the big number in the middle grows while the game SAYS the number out
   loud (browser speech, no files). When they're all counted, three number
   bubbles appear — tap the one that matches. Right = confetti + "Yes! Five!".
   Wrong = a gentle wobble and the game says the right answer. No losing. */
(function () {
  // spoken lines = pre-rendered Kokoro clips chained by the shell (Arcade.voice); parts = clip keys
  function say(parts) { if (window.Arcade && Arcade.voice) Arcade.voice.say(parts); }
  const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  const THINGS = [
    { name: "apples", col: "#ff6b6b", col2: "#b8232f", draw: function (g, r) { g.beginPath(); g.arc(0, r * 0.08, r, 0, Math.PI * 2); g.fill(); g.fillStyle = "#7fe0a0"; g.beginPath(); g.ellipse(r * 0.35, -r * 0.85, r * 0.3, r * 0.14, -0.6, 0, Math.PI * 2); g.fill(); g.strokeStyle = "#6b4a2a"; g.lineWidth = r * 0.1; g.beginPath(); g.moveTo(0, -r * 0.9); g.lineTo(0, -r * 1.2); g.stroke(); } },
    { name: "ducks", col: "#ffe27a", col2: "#c99a1c", draw: function (g, r) { g.beginPath(); g.ellipse(0, r * 0.25, r, r * 0.7, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(r * 0.45, -r * 0.45, r * 0.5, 0, Math.PI * 2); g.fill(); g.fillStyle = "#ff9f5a"; g.beginPath(); g.moveTo(r * 0.9, -r * 0.45); g.lineTo(r * 1.35, -r * 0.3); g.lineTo(r * 0.9, -r * 0.2); g.closePath(); g.fill(); g.fillStyle = "#2a2233"; g.beginPath(); g.arc(r * 0.6, -r * 0.55, r * 0.08, 0, Math.PI * 2); g.fill(); } },
    { name: "stars", col: "#ffd36b", col2: "#c48a00", draw: function (g, r) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; i ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); g.fill(); } },
    { name: "fish", col: "#74b9ff", col2: "#2a4a8a", draw: function (g, r) { g.beginPath(); g.ellipse(0, 0, r, r * 0.65, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.moveTo(-r * 0.8, 0); g.lineTo(-r * 1.35, -r * 0.5); g.lineTo(-r * 1.35, r * 0.5); g.closePath(); g.fill(); g.fillStyle = "#fff"; g.beginPath(); g.arc(r * 0.45, -r * 0.15, r * 0.18, 0, Math.PI * 2); g.fill(); g.fillStyle = "#2a2233"; g.beginPath(); g.arc(r * 0.5, -r * 0.15, r * 0.09, 0, Math.PI * 2); g.fill(); } },
    { name: "balloons", col: "#c9c3ff", col2: "#6a55b5", draw: function (g, r) { g.beginPath(); g.ellipse(0, -r * 0.1, r * 0.85, r, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = "rgba(255,255,255,0.6)"; g.lineWidth = r * 0.06; g.beginPath(); g.moveTo(0, r * 0.9); g.quadraticCurveTo(r * 0.3, r * 1.3, 0, r * 1.7); g.stroke(); } },
    { name: "hearts", col: "#ff8fa3", col2: "#b8455e", draw: function (g, r) { g.beginPath(); g.moveTo(0, r * 0.9); g.bezierCurveTo(-r * 1.4, -r * 0.05, -r * 0.7, -r * 1.1, 0, -r * 0.45); g.bezierCurveTo(r * 0.7, -r * 1.1, r * 1.4, -r * 0.05, 0, r * 0.9); g.closePath(); g.fill(); } }
  ];
  Arcade.register({
    id: "count",
    name: "Count",
    tagline: "Tap to count the things — the game says the numbers out loud.",
    accent: "#ffd36b",
    complexity: "low",
    controls: "click",
    scoreLabel: "Rounds",
    kid: true,
    kidIcon(g, s) {
      g.save(); g.translate(s / 2, s / 2);
      g.fillStyle = "#ffd36b"; g.shadowColor = "#ffd36b"; g.shadowBlur = s * 0.08;
      g.font = "900 " + Math.round(s * 0.55) + "px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText("3", -s * 0.14, s * 0.02); g.shadowBlur = 0;
      [[0.2, -0.28], [0.32, -0.02], [0.2, 0.24]].forEach(function (q) { g.save(); g.translate(q[0] * s, q[1] * s); g.fillStyle = "#ff6b6b"; g.shadowColor = "#ff6b6b"; g.shadowBlur = s * 0.03; THINGS[0].draw(g, s * 0.085); g.restore(); });
      g.restore();
    },
    create() {
      let stageEl, ctx, canvas, g, unResize = null;
      let S = 0, dpr = 1, reduced = false;
      let now = 0, rounds = 0;
      let items = [], target = 3, counted = 0, thing = THINGS[0];
      let phase = "count";        // "count" | "pick" | "win"
      let choices = [], wrongFx = 0, winT = 0, numPop = 0;
      let confetti = [];

      function resize() {
        S = Arcade.board.stageSize(880);
        dpr = window.devicePixelRatio || 1;
        canvas.style.width = S + "px"; canvas.style.height = S + "px";
        canvas.width = Math.round(S * dpr); canvas.height = Math.round(S * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        layoutItems();
      }
      function newRound() {
        target = 1 + Math.floor(Math.random() * (rounds < 3 ? 5 : 10));
        thing = THINGS[Math.floor(Math.random() * THINGS.length)];
        counted = 0; phase = "count"; choices = []; winT = 0; numPop = 0;
        layoutItems();
        say(["Count the", thing.name]);
      }
      function layoutItems() {
        items = [];
        const r = S * (target <= 5 ? 0.075 : 0.058);
        const x0 = S * 0.1, x1 = S * 0.9, y0 = S * 0.36, y1 = S * 0.86;
        let tries = 0;
        while (items.length < target && tries < 2000) {
          tries++;
          const x = x0 + Math.random() * (x1 - x0), y = y0 + Math.random() * (y1 - y0);
          if (items.some(function (it) { return Math.hypot(it.x - x, it.y - y) < r * 2.6; })) continue;
          items.push({ x: x, y: y, r: r, done: false, sq: 0, ph: Math.random() * 6.28 });
        }
        // keep previously counted state if this is just a resize
        for (let i = 0; i < Math.min(counted, items.length); i++) items[i].done = true;
      }
      function tapItem(it) {
        it.done = true; it.sq = 1; counted++;
        numPop = 1;
        ctx.audio.tone(392 * Math.pow(1.0595, counted * 2), 0.18, { type: "sine", vol: 0.12 });
        say(WORDS[counted]);
        if (counted >= target) {
          phase = "pick";
          const opts = [target];
          while (opts.length < 3) { const c = Math.max(1, Math.min(10, target + Math.floor(Math.random() * 5) - 2)); if (opts.indexOf(c) < 0) opts.push(c); }
          opts.sort(function () { return Math.random() - 0.5; });
          choices = opts;
          setTimeout(function () { if (ctx) say(["How many?", "Tap the number."]); }, 900);
        }
      }
      function pick(c) {
        if (c === target) {
          phase = "win"; winT = 0; rounds++; ctx.setScore(rounds);
          ctx.audio.arp([523, 659, 784, 1046, 1318], { dur: 0.2, step: 0.08, vol: 0.16, type: "sine" });
          say(["Yes!", WORDS[target], thing.name]);
          for (let i = 0; i < (reduced ? 12 : 60); i++) { const a = Math.random() * 6.28, sp = S * (0.0003 + Math.random() * 0.0007); confetti.push({ x: S / 2, y: S * 0.3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - S * 0.0004, life: 1, r: S * (0.005 + Math.random() * 0.007), col: ["#ffd36b", "#ff8fd0", "#74b9ff", "#7fe0a0", "#ffb86b"][i % 5] }); }
        } else {
          wrongFx = 1;
          ctx.audio.tone(300, 0.15, { type: "triangle", vol: 0.07, glide: 240 });
          say(["Not that one.", "It's", WORDS[target]]);
        }
      }
      function update(dt) {
        now += dt;
        items.forEach(function (it) { if (it.sq > 0) it.sq = Math.max(0, it.sq - dt / 300); });
        if (numPop > 0) numPop = Math.max(0, numPop - dt / 350);
        if (wrongFx > 0) wrongFx = Math.max(0, wrongFx - dt / 400);
        for (let i = confetti.length - 1; i >= 0; i--) { const c = confetti[i]; c.vy += S * 0.0000015 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.life -= dt / 1500; if (c.life <= 0) confetti.splice(i, 1); }
        if (phase === "win") { winT += dt; if (winT > 2600) newRound(); }
      }
      function drawThing(it, alpha) {
        g.save(); g.translate(it.x, it.y + Math.sin(now * 0.002 + it.ph) * it.r * 0.08);
        g.scale(1 + it.sq * 0.3, 1 - it.sq * 0.3); g.globalAlpha = alpha;
        const gr = g.createRadialGradient(-it.r * 0.3, -it.r * 0.35, it.r * 0.1, 0, 0, it.r * 1.2);
        gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.3, thing.col); gr.addColorStop(1, thing.col2);
        g.fillStyle = gr; g.shadowColor = thing.col; g.shadowBlur = it.r * 0.5;
        thing.draw(g, it.r);
        g.shadowBlur = 0;
        if (it.done) { g.fillStyle = "rgba(255,255,255,0.9)"; g.font = "900 " + Math.round(it.r * 0.9) + "px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("✓", 0, 0); }
        g.restore();
      }
      function draw() {
        g.clearRect(0, 0, S, S);
        const bg = g.createLinearGradient(0, 0, 0, S); bg.addColorStop(0, "#151027"); bg.addColorStop(1, "#0b0a14");
        g.fillStyle = bg; g.fillRect(0, 0, S, S);
        // rounds star
        g.save(); g.textAlign = "left"; g.textBaseline = "middle"; g.fillStyle = "#ffd36b"; g.shadowColor = "rgba(255,211,107,0.6)"; g.shadowBlur = 14;
        g.font = "800 " + Math.round(S * 0.05) + "px system-ui, sans-serif"; g.fillText("★ " + rounds, S * 0.05, S * 0.08); g.restore();
        // the big number
        const shown = phase === "count" ? counted : target;
        g.save(); g.textAlign = "center"; g.textBaseline = "middle";
        const scale = 1 + numPop * 0.25;
        g.translate(S / 2, S * 0.19); g.scale(scale, scale);
        g.fillStyle = phase === "win" ? "#7fe0a0" : "#ffd36b"; g.shadowColor = g.fillStyle; g.shadowBlur = S * 0.05;
        g.font = "900 " + Math.round(S * 0.2) + "px system-ui, sans-serif"; g.fillText(String(shown), 0, 0);
        g.restore();
        // things
        items.forEach(function (it) { drawThing(it, it.done ? 0.45 : 1); });
        // choices
        if (phase === "pick" || phase === "win") {
          const w = S * 0.2, gap = S * 0.05, x0 = (S - (w * 3 + gap * 2)) / 2, y = S * 0.9;
          choices.forEach(function (c, i) {
            const x = x0 + i * (w + gap) + w / 2, right = c === target;
            let shake = 0; if (wrongFx > 0 && !right) shake = Math.sin(now * 0.05) * wrongFx * S * 0.01;
            g.save(); g.translate(x + shake, y);
            const col = phase === "win" ? (right ? "#7fe0a0" : "rgba(255,255,255,0.15)") : "#74b9ff";
            g.fillStyle = phase === "win" && !right ? "rgba(255,255,255,0.05)" : "rgba(116,185,255,0.18)"; g.shadowColor = col; g.shadowBlur = S * 0.02;
            g.beginPath(); g.arc(0, 0, w * 0.42, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
            g.strokeStyle = col; g.lineWidth = 3; g.stroke();
            g.fillStyle = "#fff"; g.font = "900 " + Math.round(w * 0.45) + "px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(c), 0, w * 0.02);
            g.restore();
          });
        }
        confetti.forEach(function (c) { g.save(); g.globalAlpha = Math.max(0, c.life); g.fillStyle = c.col; g.translate(c.x, c.y); g.rotate(c.x * 0.05); g.fillRect(-c.r, -c.r * 0.6, c.r * 2, c.r * 1.2); g.restore(); });
      }

      return {
        mount(stage, c) {
          stageEl = stage; ctx = c;
          reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          const wrap = document.createElement("div");
          wrap.style.display = "flex"; wrap.style.flexDirection = "column"; wrap.style.alignItems = "center";
          canvas = document.createElement("canvas");
          canvas.style.borderRadius = "18px"; canvas.style.background = "#151027"; canvas.style.cursor = "pointer";
          canvas.style.boxShadow = "0 0 46px rgba(255,211,107,0.14)"; canvas.style.touchAction = "none";
          g = canvas.getContext("2d");
          wrap.appendChild(canvas);
          const hint = document.createElement("div"); hint.className = "hint";
          hint.textContent = "Tap each thing to count it out loud, then tap the matching number.";
          wrap.appendChild(hint);
          stage.appendChild(wrap);
          now = 0; rounds = 0; confetti = []; ctx.setScore(0);
          resize(); newRound();
          Arcade.input.setPointerTarget(canvas);
          unResize = Arcade.board.onResize(function () { resize(); });
          draw();
        },
        handleInput(intent) {
          if (intent.type !== "point" || intent.phase !== "down" || intent.button !== 0) return;
          const x = intent.x, y = intent.y;
          if (phase === "count") {
            let best = null, bd = Infinity;
            items.forEach(function (it) { if (it.done) return; const d = Math.hypot(x - it.x, y - it.y); if (d < it.r * 1.6 && d < bd) { bd = d; best = it; } });
            if (best) { tapItem(best); return; }
            // tapping the big number repeats the count so far
            if (Math.hypot(x - S / 2, y - S * 0.19) < S * 0.12) { say(counted ? WORDS[counted] : ["Tap the", thing.name]); return; }
            ctx.audio.tone(330, 0.08, { type: "sine", vol: 0.04, glide: 420 });
          } else if (phase === "pick") {
            const w = S * 0.2, gap = S * 0.05, x0 = (S - (w * 3 + gap * 2)) / 2, yy = S * 0.9;
            for (let i = 0; i < choices.length; i++) { const cx = x0 + i * (w + gap) + w / 2; if (Math.hypot(x - cx, y - yy) < w * 0.6) { pick(choices[i]); return; } }
            say(["How many?", "Tap a number."]);
          }
        },
        tick(dt) { update(Math.min(50, dt)); draw(); },
        getScore() { return rounds; },
        teardown() {
          if (window.Arcade && Arcade.voice) Arcade.voice.stop();
          if (unResize) unResize(); unResize = null;
          stageEl = ctx = canvas = g = null; items = []; confetti = [];
        }
      };
    }
  });
})();
