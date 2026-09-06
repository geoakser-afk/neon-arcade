/* ABC — an educational game for Christopher (age 5). A giant letter with a
   picture of something that starts with it. Tap the letter and the game SAYS
   it ("B! B says buh"). Tap the picture and it says the word ("Ball!"). Big
   arrows go to the next / previous letter. Below, a little quiz: three letter
   bubbles — the game says "Find the B", tap the right one for confetti. Wrong
   = gentle wobble, it says the answer. No losing. Speech is the browser's own
   voice — no files, no network. */
(function () {
  function say(text, opts) {
    try {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US"; u.rate = (opts && opts.rate) || 0.85; u.pitch = (opts && opts.pitch) || 1.15; u.volume = 1;
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }
  // letter, word, "says" sound, colors, and a simple drawn picture
  const L = [
    { l: "A", w: "apple", s: "ah", c: "#ff6b6b", c2: "#b8232f", d: function (g, r) { g.beginPath(); g.arc(0, r * 0.1, r, 0, 6.29); g.fill(); g.fillStyle = "#7fe0a0"; g.beginPath(); g.ellipse(r * 0.35, -r * 0.85, r * 0.32, r * 0.15, -0.6, 0, 6.29); g.fill(); g.strokeStyle = "#6b4a2a"; g.lineWidth = r * 0.1; g.beginPath(); g.moveTo(0, -r * 0.9); g.lineTo(0, -r * 1.25); g.stroke(); } },
    { l: "B", w: "ball", s: "buh", c: "#74b9ff", c2: "#2a4a8a", d: function (g, r) { g.beginPath(); g.arc(0, 0, r, 0, 6.29); g.fill(); g.strokeStyle = "rgba(255,255,255,0.7)"; g.lineWidth = r * 0.12; g.beginPath(); g.arc(0, 0, r * 0.6, 0.6, 2.5); g.stroke(); g.beginPath(); g.arc(0, 0, r * 0.6, 3.7, 5.6); g.stroke(); } },
    { l: "C", w: "cat", s: "kuh", c: "#c9c3ff", c2: "#6a55b5", d: function (g, r) { g.beginPath(); g.moveTo(-r * 0.75, -r * 0.3); g.lineTo(-r * 0.65, -r * 1.05); g.lineTo(-r * 0.15, -r * 0.7); g.closePath(); g.fill(); g.beginPath(); g.moveTo(r * 0.75, -r * 0.3); g.lineTo(r * 0.65, -r * 1.05); g.lineTo(r * 0.15, -r * 0.7); g.closePath(); g.fill(); g.beginPath(); g.arc(0, 0, r * 0.85, 0, 6.29); g.fill(); g.fillStyle = "#2a2233"; [-1, 1].forEach(function (d) { g.beginPath(); g.ellipse(d * r * 0.3, -r * 0.1, r * 0.08, r * 0.16, 0, 0, 6.29); g.fill(); }); g.strokeStyle = "#2a2233"; g.lineWidth = r * 0.05; g.beginPath(); g.moveTo(-r * 0.15, r * 0.25); g.lineTo(0, r * 0.35); g.lineTo(r * 0.15, r * 0.25); g.stroke(); } },
    { l: "D", w: "duck", s: "duh", c: "#ffe27a", c2: "#c99a1c", d: function (g, r) { g.beginPath(); g.ellipse(0, r * 0.25, r, r * 0.7, 0, 0, 6.29); g.fill(); g.beginPath(); g.arc(r * 0.45, -r * 0.45, r * 0.5, 0, 6.29); g.fill(); g.fillStyle = "#ff9f5a"; g.beginPath(); g.moveTo(r * 0.9, -r * 0.45); g.lineTo(r * 1.35, -r * 0.3); g.lineTo(r * 0.9, -r * 0.2); g.closePath(); g.fill(); g.fillStyle = "#2a2233"; g.beginPath(); g.arc(r * 0.6, -r * 0.55, r * 0.08, 0, 6.29); g.fill(); } },
    { l: "E", w: "egg", s: "eh", c: "#fff3d6", c2: "#d9b98a", d: function (g, r) { g.beginPath(); g.ellipse(0, 0, r * 0.78, r, 0, 0, 6.29); g.fill(); g.fillStyle = "rgba(255,255,255,0.55)"; g.beginPath(); g.ellipse(-r * 0.25, -r * 0.4, r * 0.18, r * 0.3, -0.3, 0, 6.29); g.fill(); } },
    { l: "F", w: "fish", s: "fff", c: "#7fe0ff", c2: "#2a7a9a", d: function (g, r) { g.beginPath(); g.ellipse(0, 0, r, r * 0.65, 0, 0, 6.29); g.fill(); g.beginPath(); g.moveTo(-r * 0.8, 0); g.lineTo(-r * 1.35, -r * 0.5); g.lineTo(-r * 1.35, r * 0.5); g.closePath(); g.fill(); g.fillStyle = "#fff"; g.beginPath(); g.arc(r * 0.45, -r * 0.15, r * 0.18, 0, 6.29); g.fill(); g.fillStyle = "#2a2233"; g.beginPath(); g.arc(r * 0.5, -r * 0.15, r * 0.09, 0, 6.29); g.fill(); } },
    { l: "H", w: "heart", s: "huh", c: "#ff8fa3", c2: "#b8455e", d: function (g, r) { g.beginPath(); g.moveTo(0, r * 0.9); g.bezierCurveTo(-r * 1.4, -r * 0.05, -r * 0.7, -r * 1.1, 0, -r * 0.45); g.bezierCurveTo(r * 0.7, -r * 1.1, r * 1.4, -r * 0.05, 0, r * 0.9); g.closePath(); g.fill(); } },
    { l: "M", w: "moon", s: "mmm", c: "#fff3b0", c2: "#c9b464", d: function (g, r) { g.beginPath(); g.arc(0, 0, r, 0, 6.29); g.fill(); g.globalCompositeOperation = "destination-out"; g.beginPath(); g.arc(r * 0.45, -r * 0.2, r * 0.8, 0, 6.29); g.fill(); g.globalCompositeOperation = "source-over"; } },
    { l: "O", w: "octopus", s: "oh", c: "#c98cff", c2: "#6b3fb5", d: function (g, r) { g.beginPath(); g.arc(0, -r * 0.2, r * 0.8, 0, 6.29); g.fill(); g.lineCap = "round"; g.strokeStyle = g.fillStyle; g.lineWidth = r * 0.22; for (let i = 0; i < 5; i++) { const x = (i - 2) * r * 0.36; g.beginPath(); g.moveTo(x, r * 0.4); g.quadraticCurveTo(x + (i % 2 ? r * 0.25 : -r * 0.25), r * 0.9, x, r * 1.2); g.stroke(); } g.fillStyle = "#2a2233"; [-1, 1].forEach(function (d) { g.beginPath(); g.arc(d * r * 0.3, -r * 0.3, r * 0.1, 0, 6.29); g.fill(); }); } },
    { l: "S", w: "star", s: "sss", c: "#ffd36b", c2: "#c48a00", d: function (g, r) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; i ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); g.fill(); } },
    { l: "T", w: "tree", s: "tuh", c: "#7fe0a0", c2: "#2f8a58", d: function (g, r) { g.fillStyle = "#8a5a3a"; g.fillRect(-r * 0.15, r * 0.4, r * 0.3, r * 0.7); const gr = g.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r); gr.addColorStop(0, "#c6ffd6"); gr.addColorStop(1, "#2f8a58"); g.fillStyle = gr; g.beginPath(); g.moveTo(0, -r * 1.1); g.lineTo(r * 0.9, r * 0.5); g.lineTo(-r * 0.9, r * 0.5); g.closePath(); g.fill(); } },
    { l: "U", w: "umbrella", s: "uh", c: "#ff9fb0", c2: "#b8455e", d: function (g, r) { g.beginPath(); g.arc(0, 0, r, Math.PI, 0); g.closePath(); g.fill(); g.strokeStyle = "#e6ecf5"; g.lineWidth = r * 0.1; g.lineCap = "round"; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, r * 0.9); g.arc(r * 0.2, r * 0.9, r * 0.2, Math.PI, 0, true); g.stroke(); } }
  ];
  Arcade.register({
    id: "letters",
    name: "ABC",
    tagline: "Big letters with pictures — the game says them out loud.",
    accent: "#74b9ff",
    complexity: "low",
    controls: "click",
    scoreLabel: "Found",
    kid: true,
    kidIcon(g, s) {
      g.save(); g.textAlign = "center"; g.textBaseline = "middle";
      [["A", "#ff6b6b", -0.26, -0.1], ["B", "#74b9ff", 0.02, 0.08], ["C", "#c9c3ff", 0.3, -0.12]].forEach(function (q) {
        g.fillStyle = q[1]; g.shadowColor = q[1]; g.shadowBlur = s * 0.06;
        g.font = "900 " + Math.round(s * 0.42) + "px system-ui, sans-serif"; g.fillText(q[0], s / 2 + q[2] * s, s / 2 + q[3] * s);
      });
      g.restore();
    },
    create() {
      let stageEl, ctx, canvas, g, unResize = null;
      let S = 0, dpr = 1, reduced = false;
      let now = 0, found = 0, idx = 0;
      let letterSq = 0, picSq = 0, wrongFx = 0, winFx = 0;
      let quiz = [], quizTarget = 0, quizLock = 0;
      let confetti = [];

      function resize() {
        S = Arcade.board.stageSize(880);
        dpr = window.devicePixelRatio || 1;
        canvas.style.width = S + "px"; canvas.style.height = S + "px";
        canvas.width = Math.round(S * dpr); canvas.height = Math.round(S * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      function cur() { return L[idx]; }
      function goTo(i, speak) {
        idx = (i + L.length) % L.length;
        letterSq = 1; newQuiz();
        ctx.audio.tone(520, 0.1, { type: "sine", vol: 0.08, glide: 780 });
        if (speak !== false) say(cur().l + ". " + cur().l + " is for " + cur().w + ".");
      }
      function newQuiz() {
        quizTarget = idx;
        const opts = [idx];
        while (opts.length < 3) { const k = Math.floor(Math.random() * L.length); if (opts.indexOf(k) < 0) opts.push(k); }
        opts.sort(function () { return Math.random() - 0.5; });
        quiz = opts; quizLock = 0;
      }
      function sayLetter() { letterSq = 1; ctx.audio.tone(660, 0.12, { type: "sine", vol: 0.1 }); say(cur().l + ". " + cur().l + " says " + cur().s + "."); }
      function sayWord() { picSq = 1; ctx.audio.tone(440, 0.12, { type: "sine", vol: 0.1, glide: 660 }); say(cur().w + "!"); }
      function askQuiz() { say("Find the letter " + L[quizTarget].l + "."); }
      function pickQuiz(k) {
        if (quizLock > 0) return;
        if (k === quizTarget) {
          found++; ctx.setScore(found); winFx = 1; quizLock = 1800;
          ctx.audio.arp([523, 659, 784, 1046], { dur: 0.18, step: 0.07, vol: 0.14, type: "sine" });
          say("Yes! " + L[k].l + "!");
          for (let i = 0; i < (reduced ? 10 : 50); i++) { const a = Math.random() * 6.28, sp = S * (0.0003 + Math.random() * 0.0006); confetti.push({ x: S / 2, y: S * 0.86, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - S * 0.0005, life: 1, r: S * (0.005 + Math.random() * 0.006), col: ["#ffd36b", "#ff8fd0", "#74b9ff", "#7fe0a0"][i % 4] }); }
          setTimeout(function () { if (ctx) goTo(idx + 1); }, 1700);
        } else {
          wrongFx = 1; ctx.audio.tone(300, 0.14, { type: "triangle", vol: 0.07, glide: 240 });
          say("That's " + L[k].l + ". Find the " + L[quizTarget].l + ".");
        }
      }
      function update(dt) {
        now += dt;
        letterSq = Math.max(0, letterSq - dt / 350); picSq = Math.max(0, picSq - dt / 350);
        wrongFx = Math.max(0, wrongFx - dt / 400); winFx = Math.max(0, winFx - dt / 1500);
        if (quizLock > 0) quizLock -= dt;
        for (let i = confetti.length - 1; i >= 0; i--) { const c = confetti[i]; c.vy += S * 0.0000015 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.life -= dt / 1400; if (c.life <= 0) confetti.splice(i, 1); }
      }
      function arrowBtn(side) { return { x: side < 0 ? S * 0.09 : S * 0.91, y: S * 0.4, r: S * 0.055 }; }
      function quizSlots() { const w = S * 0.18, gap = S * 0.06, x0 = (S - (w * 3 + gap * 2)) / 2; return quiz.map(function (k, i) { return { k: k, x: x0 + i * (w + gap) + w / 2, y: S * 0.86, r: w * 0.45 }; }); }
      function draw() {
        g.clearRect(0, 0, S, S);
        const c = cur();
        const bg = g.createLinearGradient(0, 0, 0, S); bg.addColorStop(0, "#111a2e"); bg.addColorStop(1, "#0b0a14");
        g.fillStyle = bg; g.fillRect(0, 0, S, S);
        g.save(); g.textAlign = "left"; g.textBaseline = "middle"; g.fillStyle = "#ffd36b"; g.shadowColor = "rgba(255,211,107,0.6)"; g.shadowBlur = 14;
        g.font = "800 " + Math.round(S * 0.05) + "px system-ui, sans-serif"; g.fillText("★ " + found, S * 0.05, S * 0.07); g.restore();
        // letter (left) + picture (right)
        const bob = Math.sin(now * 0.002) * S * 0.006;
        g.save(); g.translate(S * 0.33, S * 0.4 + bob); g.scale(1 + letterSq * 0.15, 1 + letterSq * 0.15);
        g.fillStyle = c.c; g.shadowColor = c.c; g.shadowBlur = S * 0.05;
        g.font = "900 " + Math.round(S * 0.34) + "px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(c.l, 0, 0);
        g.shadowBlur = 0; g.fillStyle = "rgba(255,255,255,0.5)"; g.font = "700 " + Math.round(S * 0.12) + "px system-ui, sans-serif"; g.fillText(c.l.toLowerCase(), S * 0.16, S * 0.09);
        g.restore();
        g.save(); g.translate(S * 0.7, S * 0.4 - bob); g.scale(1 + picSq * 0.2, 1 - picSq * 0.2);
        const r = S * 0.11; const gr = g.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.2); gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.3, c.c); gr.addColorStop(1, c.c2);
        g.fillStyle = gr; g.shadowColor = c.c; g.shadowBlur = r * 0.6; c.d(g, r); g.restore();
        // word under the picture (for grown-ups; he learns it by ear)
        g.save(); g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "rgba(230,236,245,0.7)"; g.font = "700 " + Math.round(S * 0.045) + "px system-ui, sans-serif"; g.fillText(c.w, S * 0.7, S * 0.58); g.restore();
        // arrows
        [-1, 1].forEach(function (side) {
          const b = arrowBtn(side);
          g.save(); g.fillStyle = "rgba(255,255,255,0.08)"; g.beginPath(); g.arc(b.x, b.y, b.r, 0, 6.29); g.fill();
          g.strokeStyle = "rgba(255,255,255,0.3)"; g.lineWidth = 2; g.stroke();
          g.fillStyle = "#e6ecf5"; g.beginPath(); g.moveTo(b.x + side * b.r * 0.4, b.y); g.lineTo(b.x - side * b.r * 0.25, b.y - b.r * 0.4); g.lineTo(b.x - side * b.r * 0.25, b.y + b.r * 0.4); g.closePath(); g.fill(); g.restore();
        });
        // quiz row: speaker bubble + 3 letter bubbles
        g.save(); g.fillStyle = "rgba(116,185,255,0.12)"; g.beginPath(); g.arc(S * 0.1, S * 0.86, S * 0.05, 0, 6.29); g.fill(); g.strokeStyle = "rgba(116,185,255,0.6)"; g.lineWidth = 2; g.stroke();
        g.fillStyle = "#e6ecf5"; g.beginPath(); g.moveTo(S * 0.08, S * 0.845); g.lineTo(S * 0.095, S * 0.845); g.lineTo(S * 0.115, S * 0.83); g.lineTo(S * 0.115, S * 0.89); g.lineTo(S * 0.095, S * 0.875); g.lineTo(S * 0.08, S * 0.875); g.closePath(); g.fill();
        g.strokeStyle = "#e6ecf5"; g.lineWidth = 2; g.beginPath(); g.arc(S * 0.115, S * 0.86, S * 0.018, -0.9, 0.9); g.stroke(); g.beginPath(); g.arc(S * 0.115, S * 0.86, S * 0.03, -0.9, 0.9); g.stroke(); g.restore();
        quizSlots().forEach(function (q) {
          const right = q.k === quizTarget, lc = L[q.k];
          let shake = 0; if (wrongFx > 0 && !right) shake = Math.sin(now * 0.05) * wrongFx * S * 0.008;
          g.save(); g.translate(q.x + shake, q.y);
          const glow = right && winFx > 0 ? "#7fe0a0" : lc.c;
          g.fillStyle = right && winFx > 0 ? "rgba(127,224,160,0.3)" : "rgba(255,255,255,0.06)"; g.shadowColor = glow; g.shadowBlur = S * 0.015 + (right ? winFx * S * 0.03 : 0);
          g.beginPath(); g.arc(0, 0, q.r, 0, 6.29); g.fill(); g.shadowBlur = 0;
          g.strokeStyle = glow; g.lineWidth = 3; g.stroke();
          g.fillStyle = "#fff"; g.font = "900 " + Math.round(q.r * 1.1) + "px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(lc.l, 0, q.r * 0.05);
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
          canvas.style.borderRadius = "18px"; canvas.style.background = "#111a2e"; canvas.style.cursor = "pointer";
          canvas.style.boxShadow = "0 0 46px rgba(116,185,255,0.14)"; canvas.style.touchAction = "none";
          g = canvas.getContext("2d");
          wrap.appendChild(canvas);
          const hint = document.createElement("div"); hint.className = "hint";
          hint.textContent = "Tap the letter or the picture to hear it · arrows change letters · tap the speaker, then find the letter it says";
          wrap.appendChild(hint);
          stage.appendChild(wrap);
          now = 0; found = 0; idx = 0; confetti = []; ctx.setScore(0);
          resize(); newQuiz();
          Arcade.input.setPointerTarget(canvas);
          unResize = Arcade.board.onResize(function () { resize(); });
          draw();
          setTimeout(function () { if (ctx) say(cur().l + ". " + cur().l + " is for " + cur().w + "."); }, 400);
        },
        handleInput(intent) {
          if (intent.type !== "point" || intent.phase !== "down" || intent.button !== 0) return;
          const x = intent.x, y = intent.y;
          const a1 = arrowBtn(-1), a2 = arrowBtn(1);
          if (Math.hypot(x - a1.x, y - a1.y) < a1.r * 1.4) { goTo(idx - 1); return; }
          if (Math.hypot(x - a2.x, y - a2.y) < a2.r * 1.4) { goTo(idx + 1); return; }
          if (Math.hypot(x - S * 0.1, y - S * 0.86) < S * 0.07) { askQuiz(); return; }
          const slot = quizSlots().find(function (q) { return Math.hypot(x - q.x, y - q.y) < q.r * 1.4; });
          if (slot) { pickQuiz(slot.k); return; }
          if (y < S * 0.62) { if (x < S / 2) sayLetter(); else sayWord(); return; }
          ctx.audio.tone(330, 0.08, { type: "sine", vol: 0.04, glide: 420 });
        },
        tick(dt) { update(Math.min(50, dt)); draw(); },
        getScore() { return found; },
        teardown() {
          try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
          if (unResize) unResize(); unResize = null;
          stageEl = ctx = canvas = g = null; confetti = [];
        }
      };
    }
  });
})();
