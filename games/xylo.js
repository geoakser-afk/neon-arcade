/* Xylophone — made for Christopher (age 5). Eight giant rainbow bars, one
   C-major scale (C5..C6). Tap a bar: it lights up, wobbles, throws sparkles and
   rings like a bell. Drag a finger across for a glissando. A little mallet
   follows the pointer. No losing, no clock — every 8 notes, a twinkle. */
(function () {
  const COLORS = ["#ff6b6b", "#ffa94d", "#ffd36b", "#7fe0a0", "#5fd0c8", "#74b9ff", "#9b8cff", "#ff8fd0"];
  const NOTES = [523, 587, 659, 698, 784, 880, 988, 1046];

  function roundRect(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }

  // One bar centered at (cx,cy). hit = 0..1 flash/wobble amount, breathe = idle scale wobble (-1..1)
  function drawBar(g, cx, cy, w, h, col, hit, breathe) {
    hit = hit || 0; breathe = breathe || 0;
    g.save(); g.translate(cx, cy);
    g.rotate(hit * 0.05 * Math.sin(hit * 18));
    g.scale(1 + hit * 0.1 + breathe * 0.012, 1 - hit * 0.03 + breathe * 0.008);
    g.shadowColor = col; g.shadowBlur = w * (0.3 + hit * 1.1);
    const gr = g.createLinearGradient(0, -h / 2, 0, h / 2);
    gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.12, col); gr.addColorStop(1, col);
    g.fillStyle = gr; roundRect(g, -w / 2, -h / 2, w, h, w * 0.22); g.fill();
    g.shadowBlur = 0;
    g.fillStyle = "rgba(0,0,0,0.18)"; roundRect(g, -w / 2, -h / 2, w, h, w * 0.22); g.fill();
    g.fillStyle = col; roundRect(g, -w / 2 + w * 0.06, -h / 2 + w * 0.06, w * 0.88, h - w * 0.12, w * 0.18); g.fill();
    g.fillStyle = "rgba(255,255,255,0.22)"; roundRect(g, -w / 2 + w * 0.14, -h / 2 + w * 0.3, w * 0.16, h - w * 0.6, w * 0.08); g.fill();
    if (hit > 0) { g.fillStyle = "rgba(255,255,255," + (hit * 0.55).toFixed(3) + ")"; roundRect(g, -w / 2, -h / 2, w, h, w * 0.22); g.fill(); }
    g.fillStyle = "rgba(20,16,36,0.85)";
    g.beginPath(); g.arc(0, -h / 2 + w * 0.4, w * 0.09, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(0, h / 2 - w * 0.4, w * 0.09, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  function drawMallet(g, x, y, len) {
    g.save(); g.lineCap = "round";
    g.strokeStyle = "#e8d5a3"; g.lineWidth = len * 0.1;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + len * 0.45, y + len); g.stroke();
    g.fillStyle = "#ff8fa3"; g.shadowColor = "#ff8fa3"; g.shadowBlur = len * 0.25;
    g.beginPath(); g.arc(x, y, len * 0.17, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0; g.fillStyle = "rgba(255,255,255,0.5)"; g.beginPath(); g.arc(x - len * 0.05, y - len * 0.06, len * 0.06, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  Arcade.register({
    id: "xylo",
    name: "Xylophone",
    tagline: "Tap the rainbow bars to play notes.",
    accent: "#ff8fa3",
    complexity: "low",
    controls: "click",
    scoreLabel: "Notes",
    kid: true,
    kidName: "Xylophone",
    kidIcon(g, s) {
      const n = 7, w = s * 0.095, gap = s * 0.022, total = n * w + (n - 1) * gap, x0 = (s - total) / 2;
      g.fillStyle = "rgba(90,70,100,0.9)"; roundRect(g, x0 - w * 0.3, s * 0.32, total + w * 0.6, s * 0.05, s * 0.02); g.fill(); roundRect(g, x0 - w * 0.3, s * 0.66, total + w * 0.6, s * 0.05, s * 0.02); g.fill();
      for (let i = 0; i < n; i++) { const h = s * (0.62 - i * 0.035); drawBar(g, x0 + i * (w + gap) + w / 2, s * 0.52, w, h, COLORS[i], 0, 0); }
      drawMallet(g, s * 0.36, s * 0.3, s * 0.3);
    },
    create() {
      let stageEl, ctx, canvas, g, unResize = null;
      let S = 0, dpr = 1, reduced = false;
      let now = 0, notes = 0, lastPlay = -1e9, lastBar = -1;
      let bars = [];             // {i,f,col,x,w,cy,h,hit,ph}
      let sparkles = [];
      let pointer = { x: -1, y: -1, down: false, seen: -1e9, dip: 0 };
      let L = { m: 0, gap: 0, top: 0, area: 0, w: 0 };

      function resize() {
        S = Arcade.board.stageSize(880);
        dpr = window.devicePixelRatio || 1;
        canvas.style.width = S + "px"; canvas.style.height = S + "px";
        canvas.width = Math.round(S * dpr); canvas.height = Math.round(S * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        layout();
      }
      function layout() {
        const old = bars;
        L.m = S * 0.025; L.gap = S * 0.01; L.top = S * 0.15; L.area = S * 0.82;
        L.w = (S - 2 * L.m - L.gap * 7) / 8;
        bars = NOTES.map(function (f, i) {
          const prev = old[i];
          return { i: i, f: f, col: COLORS[i], x: L.m + i * (L.w + L.gap) + L.w / 2, w: L.w, cy: L.top + L.area / 2, h: L.area * (1 - i * 0.04),
            hit: prev ? prev.hit : 0, ph: i * 0.7 };
        });
      }
      function barAt(x, y) {
        if (y < L.top - S * 0.02 || x < L.m - L.gap || x > S - L.m + L.gap) return -1;
        const i = Math.floor((x - L.m + L.gap / 2) / (L.w + L.gap));
        return Math.max(0, Math.min(7, i));
      }

      function play(b) {
        notes++; ctx.setScore(notes);
        b.hit = 1; pointer.dip = 1;
        if (now - lastPlay >= 40) {                // rate-limit audio only; the bar always reacts
          lastPlay = now;
          const A = ctx.audio, f = b.f;
          A.tone(f, 0.55, { type: "sine", vol: 0.16, attack: 0.005 });
          A.tone(f * 2, 0.35, { type: "sine", vol: 0.06, attack: 0.005 });
          A.tone(f * 3, 0.2, { type: "sine", vol: 0.025, attack: 0.005 });
        }
        const n = reduced ? 4 : 14;
        for (let i = 0; i < n; i++) {
          const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4, sp = S * (0.0002 + Math.random() * 0.0005);
          sparkles.push({ x: b.x + (Math.random() - 0.5) * b.w * 0.6, y: (pointer.y > L.top ? pointer.y : b.cy), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, r: S * (0.006 + Math.random() * 0.008), col: i % 3 === 0 ? "#ffffff" : b.col, spin: Math.random() * 6.28 });
        }
        if (notes % 8 === 0) {
          ctx.audio.arp([1568, 2093, 2637, 3136], { dur: 0.16, step: 0.055, vol: 0.08, type: "sine", when: 0.12 });
          const m = reduced ? 8 : 30;
          for (let i = 0; i < m; i++) sparkles.push({ x: S * (0.1 + Math.random() * 0.8), y: S * (0.04 + Math.random() * 0.1), vx: (Math.random() - 0.5) * S * 0.0002, vy: -S * (0.0001 + Math.random() * 0.0002), life: 1.4, r: S * (0.006 + Math.random() * 0.01), col: COLORS[i % 8], spin: Math.random() * 6.28 });
        }
      }

      function update(dt) {
        now += dt;
        bars.forEach(function (b) { if (b.hit > 0) b.hit = Math.max(0, b.hit - dt / 420); });
        if (pointer.dip > 0) pointer.dip = Math.max(0, pointer.dip - dt / 180);
        for (let i = sparkles.length - 1; i >= 0; i--) {
          const s = sparkles[i]; s.vy += S * 0.0000008 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt / 900; s.spin += dt * 0.006;
          if (s.life <= 0) sparkles.splice(i, 1);
        }
      }

      function drawSparkle(s) {
        g.save(); g.globalAlpha = Math.max(0, Math.min(1, s.life)); g.fillStyle = s.col; g.shadowColor = s.col; g.shadowBlur = 8;
        g.translate(s.x, s.y); g.rotate(s.spin);
        const r = s.r, q = r * 0.3;
        g.beginPath(); g.moveTo(0, -r); g.lineTo(q, -q); g.lineTo(r, 0); g.lineTo(q, q); g.lineTo(0, r); g.lineTo(-q, q); g.lineTo(-r, 0); g.lineTo(-q, -q); g.closePath(); g.fill();
        g.restore();
      }

      function draw() {
        g.clearRect(0, 0, S, S);
        const sky = g.createLinearGradient(0, 0, 0, S);
        sky.addColorStop(0, "#141024"); sky.addColorStop(1, "#1a1430");
        g.fillStyle = sky; g.fillRect(0, 0, S, S);
        for (let i = 0; i < 20; i++) { const x = ((i * 137.5) % 100) / 100 * S, y = ((i * 91.7) % 100) / 100 * S; g.fillStyle = "rgba(255,255,255," + (0.06 + 0.14 * (0.5 + 0.5 * Math.sin(now * 0.0015 + i))) + ")"; g.beginPath(); g.arc(x, y, S * 0.0035, 0, Math.PI * 2); g.fill(); }
        // counter
        g.save(); g.textAlign = "center"; g.textBaseline = "top";
        g.fillStyle = "#ffd36b"; g.shadowColor = "rgba(255,211,107,0.6)"; g.shadowBlur = 16;
        g.font = "800 " + Math.round(S * 0.075) + "px system-ui, sans-serif";
        g.fillText("★ " + notes, S / 2, S * 0.03);
        g.restore();
        // frame rails behind the bars
        g.save(); g.fillStyle = "rgba(90,70,100,0.9)"; g.shadowColor = "rgba(255,143,163,0.2)"; g.shadowBlur = 14;
        const cy = L.top + L.area / 2;
        roundRect(g, L.m * 0.4, cy - L.area * 0.32, S - L.m * 0.8, S * 0.04, S * 0.015); g.fill();
        roundRect(g, L.m * 0.4, cy + L.area * 0.28, S - L.m * 0.8, S * 0.04, S * 0.015); g.fill();
        g.restore();
        // bars (idle breathe)
        bars.forEach(function (b) {
          const br = reduced ? 0 : Math.sin(now * 0.0016 + b.ph);
          drawBar(g, b.x, b.cy, b.w, b.h, b.col, b.hit, br);
        });
        sparkles.forEach(drawSparkle);
        // mallet follows the pointer for a couple of seconds after it was last seen
        if (now - pointer.seen < 2500 && pointer.x >= 0) {
          const len = S * 0.14, dip = pointer.dip * S * 0.02;
          g.save(); g.globalAlpha = Math.max(0, Math.min(1, (2500 - (now - pointer.seen)) / 600));
          drawMallet(g, pointer.x + S * 0.01, pointer.y - S * 0.02 + dip, len);
          g.restore();
        }
      }

      return {
        mount(stage, c) {
          stageEl = stage; ctx = c;
          reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          const wrap = document.createElement("div");
          wrap.style.display = "flex"; wrap.style.flexDirection = "column"; wrap.style.alignItems = "center";
          canvas = document.createElement("canvas");
          canvas.style.borderRadius = "18px"; canvas.style.background = "#141024"; canvas.style.cursor = "none";
          canvas.style.boxShadow = "0 0 46px rgba(255,143,163,0.14)"; canvas.style.touchAction = "none";
          g = canvas.getContext("2d");
          wrap.appendChild(canvas);
          const hint = document.createElement("div"); hint.className = "hint";
          hint.textContent = "Tap the bars to play. Drag across for a glissando.";
          wrap.appendChild(hint);
          stage.appendChild(wrap);
          now = 0; notes = 0; lastPlay = -1e9; lastBar = -1; sparkles = []; bars = [];
          pointer = { x: -1, y: -1, down: false, seen: -1e9, dip: 0 };
          resize();
          ctx.setScore(0);
          Arcade.input.setPointerTarget(canvas);
          unResize = Arcade.board.onResize(function () { resize(); });
          draw();
        },
        handleInput(intent) {
          if (intent.type !== "point") return;
          pointer.x = intent.x; pointer.y = intent.y; pointer.seen = now;
          if (intent.phase === "down" && intent.button === 0) {
            pointer.down = true;
            const i = barAt(intent.x, intent.y); lastBar = i;
            if (i >= 0) play(bars[i]);
            else ctx.audio.tone(330, 0.08, { type: "sine", vol: 0.04, glide: 420 });   // gentle blip, nothing lost
          } else if (intent.phase === "move") {
            if (!pointer.down) return;
            const i = barAt(intent.x, intent.y);
            if (i >= 0 && i !== lastBar) { lastBar = i; play(bars[i]); }
            else if (i < 0) lastBar = -1;
          } else if (intent.phase === "up") {
            pointer.down = false; lastBar = -1;
          }
        },
        tick(dt) { update(Math.min(50, dt)); draw(); },
        getScore() { return notes; },
        teardown() {
          if (unResize) unResize(); unResize = null;
          stageEl = ctx = canvas = g = null; bars = []; sparkles = [];
        }
      };
    }
  });
})();
