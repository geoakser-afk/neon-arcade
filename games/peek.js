/* Peekaboo — made for Christopher (age 5). Six cozy burrows; round, big-eyed
   critters pop up one or two at a time and look around. Tap one: it giggles
   (a little rising arpeggio), squishes, bursts confetti and ducks back down.
   Nothing to lose, no clock, no wrong answers — just a friendly whack-a-mole
   with a big star counter. Every 10 taps a rainbow critter visits. */
(function () {
  Arcade.register({
    id: "peek",
    name: "Peekaboo",
    tagline: "Critters pop out of burrows — tap them! No losing, just giggles.",
    accent: "#ffb86b",
    complexity: "low",
    controls: "click",
    scoreLabel: "Taps",
    kid: true,
    kidIcon(g, s) {
      // a bunny peeking out of a burrow
      g.save(); g.translate(s / 2, s * 0.52);
      const r = s * 0.24;
      g.fillStyle = "rgba(60,44,70,0.95)"; g.beginPath(); g.ellipse(0, r * 0.9, r * 1.7, r * 0.7, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(8,6,14,0.95)"; g.beginPath(); g.ellipse(0, r * 0.9, r * 1.5, r * 0.55, 0, 0, Math.PI * 2); g.fill();
      g.save(); g.beginPath(); g.rect(-r * 3, -r * 3, r * 6, r * 3.9); g.clip();
      g.shadowColor = "#ffd6e7"; g.shadowBlur = r * 0.5;
      const gr = g.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.2); gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.25, "#ffd6e7"); gr.addColorStop(1, "#ffb3d1");
      g.fillStyle = gr;
      [-1, 1].forEach(function (d) { g.beginPath(); g.ellipse(d * r * 0.45, -r * 1.05, r * 0.22, r * 0.62, d * 0.15, 0, Math.PI * 2); g.fill(); });
      g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
      g.fillStyle = "#3a2a44"; [-1, 1].forEach(function (d) { g.beginPath(); g.ellipse(d * r * 0.38, -r * 0.1, r * 0.17, r * 0.21, 0, 0, Math.PI * 2); g.fill(); });
      g.fillStyle = "#fff"; [-1, 1].forEach(function (d) { g.beginPath(); g.arc(d * r * 0.38 - r * 0.06, -r * 0.18, r * 0.07, 0, Math.PI * 2); g.fill(); });
      g.fillStyle = "rgba(255,110,140,0.4)"; [-1, 1].forEach(function (d) { g.beginPath(); g.ellipse(d * r * 0.6, r * 0.25, r * 0.18, r * 0.11, 0, 0, Math.PI * 2); g.fill(); });
      g.strokeStyle = "#3a2a44"; g.lineWidth = r * 0.06; g.lineCap = "round"; g.beginPath(); g.arc(0, r * 0.28, r * 0.2, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
      g.restore();
      const lip = g.createLinearGradient(0, r * 0.9, 0, r * 1.6); lip.addColorStop(0, "rgba(90,70,100,0.95)"); lip.addColorStop(1, "rgba(50,38,60,0.95)");
      g.fillStyle = lip; g.beginPath(); g.ellipse(0, r * 1.0, r * 1.7, r * 0.7, 0, 0, Math.PI); g.fill();
      g.restore();
    },
    create() {
      let stageEl, ctx, canvas, g, unResize = null;
      let S = 0, dpr = 1, reduced = false;
      let now = 0, taps = 0, total = 0;
      let holes = [];            // {x,y,r, up:0..1 (how far the critter is out), state, t, critter, wig}
      let confetti = [];
      let toasts = [];
      let nextPop = 0;
      const COLS = 3, ROWS = 2;
      const CRITTERS = [
        { name: "bunny", body: "#ffd6e7", ear: "#ffb3d1", eye: "#3a2a44", ears: "long" },
        { name: "bear", body: "#d9a066", ear: "#b5784a", eye: "#3a2a20", ears: "round" },
        { name: "frog", body: "#a8e6a0", ear: "#7fcf78", eye: "#2a3a2a", ears: "bump" },
        { name: "cat", body: "#c9c3ff", ear: "#a89dff", eye: "#2a2a44", ears: "point" },
        { name: "chick", body: "#fff0a0", ear: "#ffd05a", eye: "#3a3020", ears: "tuft" },
        { name: "pig", body: "#ffc4d6", ear: "#ff9fbd", eye: "#3a2a30", ears: "flop" }
      ];
      const RAINBOW = { name: "rainbow", body: "rainbow", ear: "#ffffff", eye: "#3a2a44", ears: "star" };

      function resize() {
        S = Arcade.board.stageSize(880);
        dpr = window.devicePixelRatio || 1;
        canvas.style.width = S + "px"; canvas.style.height = S + "px";
        canvas.width = Math.round(S * dpr); canvas.height = Math.round(S * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        layout();
      }
      function layout() {
        const old = holes;
        holes = [];
        const gx = S * 0.08, gy = S * 0.2, gw = S * 0.84, gh = S * 0.7;
        const cw = gw / COLS, ch = gh / ROWS;
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
          const i = r * COLS + c;
          const prev = old[i];
          holes.push({ x: gx + cw * (c + 0.5), y: gy + ch * (r + 0.72), r: Math.min(cw, ch) * 0.3,
            up: prev ? prev.up : 0, state: prev ? prev.state : "down", t: prev ? prev.t : 0, critter: prev ? prev.critter : CRITTERS[i % CRITTERS.length], wig: Math.random() * 6.28, sq: 0 });
        }
      }

      function popOne() {
        const down = holes.filter(function (h) { return h.state === "down"; });
        if (!down.length) return;
        const h = down[Math.floor(Math.random() * down.length)];
        h.state = "rising"; h.t = 0;
        h.critter = (taps > 0 && taps % 10 === 9) ? RAINBOW : CRITTERS[Math.floor(Math.random() * CRITTERS.length)];
        h.stay = 1800 + Math.random() * 1600;
        ctx.audio.tone(h.critter === RAINBOW ? 880 : 520 + Math.random() * 200, 0.12, { type: "sine", vol: 0.07, glide: 900 });
      }

      function tapHole(h) {
        if (h.state !== "up" && h.state !== "rising") return false;
        taps++; total++; ctx.setScore(taps);
        ctx.storage.set("total", total);
        h.state = "tapped"; h.t = 0; h.sq = 1;
        const rainbow = h.critter === RAINBOW;
        // giggle: quick rising arpeggio, random happy key
        const base = [523, 587, 659, 784][Math.floor(Math.random() * 4)];
        ctx.audio.arp([base, base * 1.25, base * 1.5, base * 2], { dur: 0.12, step: 0.055, vol: 0.14, type: "sine" });
        if (rainbow) { ctx.audio.arp([1046, 1318, 1568, 2093, 2637], { dur: 0.2, step: 0.07, vol: 0.12, type: "sine", when: 0.25 }); toast(h.x, h.y - h.r * 1.6, "★ RAINBOW! ★", "#ffffff"); }
        else if (taps % 10 === 0) { ctx.audio.arp([784, 1046, 1318], { dur: 0.16, step: 0.08, vol: 0.12 }); toast(h.x, h.y - h.r * 1.6, "★ " + taps + " ★", "#ffd36b"); }
        const n = reduced ? 8 : (rainbow ? 40 : 18);
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2, sp = S * (0.0003 + Math.random() * 0.0006);
          confetti.push({ x: h.x, y: h.y - h.r * 0.6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - S * 0.0004, life: 1, r: S * (0.005 + Math.random() * 0.007), col: ["#ffd36b", "#ff8fd0", "#74b9ff", "#7fe0a0", "#ffb86b", "#c9c3ff"][i % 6] });
        }
        return true;
      }
      function toast(x, y, text, col) { toasts.push({ x: x, y: y, text: text, col: col, life: 1 }); }

      function update(dt) {
        now += dt;
        nextPop -= dt;
        const upCount = holes.filter(function (h) { return h.state !== "down"; }).length;
        if (nextPop <= 0 && upCount < 2) { popOne(); nextPop = 700 + Math.random() * 900; }
        holes.forEach(function (h) {
          h.t += dt;
          if (h.sq > 0) h.sq = Math.max(0, h.sq - dt / 300);
          if (h.state === "rising") { h.up = Math.min(1, h.up + dt / 260); if (h.up >= 1) { h.state = "up"; h.t = 0; } }
          else if (h.state === "up") { if (h.t > h.stay) { h.state = "sinking"; } }
          else if (h.state === "sinking") { h.up = Math.max(0, h.up - dt / 400); if (h.up <= 0) { h.state = "down"; } }
          else if (h.state === "tapped") { h.up = Math.max(0, h.up - dt / 160); if (h.up <= 0) { h.state = "down"; } }
        });
        for (let i = confetti.length - 1; i >= 0; i--) {
          const c = confetti[i]; c.vy += S * 0.0000015 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.life -= dt / 1300;
          if (c.life <= 0) confetti.splice(i, 1);
        }
        for (let i = toasts.length - 1; i >= 0; i--) { toasts[i].y -= dt * S * 0.00005; toasts[i].life -= dt / 1400; if (toasts[i].life <= 0) toasts.splice(i, 1); }
      }

      function critterFill(cr, x, y, r) {
        if (cr.body !== "rainbow") {
          const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r * 1.2);
          gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.25, cr.body); gr.addColorStop(1, cr.ear);
          return gr;
        }
        const gr = g.createLinearGradient(x - r, y - r, x + r, y + r);
        ["#ff8fa3", "#ffd36b", "#a8e6a0", "#74b9ff", "#c9c3ff"].forEach(function (c, i) { gr.addColorStop(i / 4, c); });
        return gr;
      }
      function drawCritter(h) {
        const cr = h.critter, up = h.up;
        if (up <= 0) return;
        const r = h.r * 0.82 * (1 + h.sq * 0.25);
        const cx = h.x, cy = h.y - r * 0.15 - up * r * 1.25;   // rises out of the hole
        g.save();
        // clip so the critter appears from inside the burrow
        g.beginPath(); g.rect(cx - r * 2, cy - r * 3, r * 4, (h.y + h.r * 0.1) - (cy - r * 3)); g.clip();
        g.translate(cx, cy);
        g.scale(1 + h.sq * 0.3, 1 - h.sq * 0.3);
        g.shadowColor = cr.body === "rainbow" ? "#ffffff" : cr.body; g.shadowBlur = r * 0.5;
        g.fillStyle = critterFill(cr, 0, 0, r);
        // ears
        if (cr.ears === "long") { [-1, 1].forEach(function (s) { g.beginPath(); g.ellipse(s * r * 0.45, -r * 1.05, r * 0.22, r * 0.62, s * 0.15, 0, Math.PI * 2); g.fill(); }); }
        else if (cr.ears === "round") { [-1, 1].forEach(function (s) { g.beginPath(); g.arc(s * r * 0.7, -r * 0.7, r * 0.32, 0, Math.PI * 2); g.fill(); }); }
        else if (cr.ears === "point") { [-1, 1].forEach(function (s) { g.beginPath(); g.moveTo(s * r * 0.3, -r * 0.7); g.lineTo(s * r * 0.85, -r * 1.35); g.lineTo(s * r * 0.95, -r * 0.5); g.closePath(); g.fill(); }); }
        else if (cr.ears === "bump") { [-1, 1].forEach(function (s) { g.beginPath(); g.arc(s * r * 0.5, -r * 0.8, r * 0.28, 0, Math.PI * 2); g.fill(); }); }
        else if (cr.ears === "tuft") { g.beginPath(); g.moveTo(-r * 0.2, -r * 0.9); g.lineTo(0, -r * 1.4); g.lineTo(r * 0.2, -r * 0.9); g.closePath(); g.fill(); }
        else if (cr.ears === "flop") { [-1, 1].forEach(function (s) { g.beginPath(); g.ellipse(s * r * 0.75, -r * 0.55, r * 0.28, r * 0.42, s * 0.6, 0, Math.PI * 2); g.fill(); }); }
        else if (cr.ears === "star") { for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; g.beginPath(); g.arc(Math.cos(a) * r * 1.05, -r * 0.1 + Math.sin(a) * r * 1.05, r * 0.18, 0, Math.PI * 2); g.fill(); } }
        // head
        g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
        g.shadowBlur = 0;
        // eyes (big, kid-friendly), blink occasionally
        const blink = Math.sin(now * 0.003 + h.wig) > 0.97;
        g.fillStyle = cr.eye;
        [-1, 1].forEach(function (s) {
          if (blink || h.sq > 0.4) { g.lineWidth = r * 0.08; g.strokeStyle = cr.eye; g.lineCap = "round"; g.beginPath(); g.moveTo(s * r * 0.38 - r * 0.14, -r * 0.1); g.lineTo(s * r * 0.38 + r * 0.14, -r * 0.1); g.stroke(); }
          else { g.beginPath(); g.ellipse(s * r * 0.38, -r * 0.1, r * 0.17, r * 0.21, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = "#fff"; g.beginPath(); g.arc(s * r * 0.38 - r * 0.06, -r * 0.18, r * 0.07, 0, Math.PI * 2); g.fill(); g.fillStyle = cr.eye; }
        });
        // cheeks + mouth
        g.fillStyle = "rgba(255,110,140,0.35)"; [-1, 1].forEach(function (s) { g.beginPath(); g.ellipse(s * r * 0.6, r * 0.25, r * 0.18, r * 0.11, 0, 0, Math.PI * 2); g.fill(); });
        g.strokeStyle = cr.eye; g.lineWidth = r * 0.06; g.lineCap = "round";
        g.beginPath(); g.arc(0, r * 0.28, r * (h.sq > 0.3 ? 0.28 : 0.18), 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
        if (cr.name === "pig") { g.fillStyle = cr.ear; g.beginPath(); g.ellipse(0, r * 0.15, r * 0.26, r * 0.18, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = cr.eye; [-1, 1].forEach(function (s) { g.beginPath(); g.arc(s * r * 0.1, r * 0.15, r * 0.045, 0, Math.PI * 2); g.fill(); }); }
        if (cr.name === "chick") { g.fillStyle = "#ff9f5a"; g.beginPath(); g.moveTo(-r * 0.14, r * 0.12); g.lineTo(r * 0.14, r * 0.12); g.lineTo(0, r * 0.32); g.closePath(); g.fill(); }
        g.restore();
      }

      function draw() {
        g.clearRect(0, 0, S, S);
        // sky + meadow
        const sky = g.createLinearGradient(0, 0, 0, S);
        sky.addColorStop(0, "#141024"); sky.addColorStop(0.55, "#1c1630"); sky.addColorStop(1, "#1a2a24");
        g.fillStyle = sky; g.fillRect(0, 0, S, S);
        // stars
        for (let i = 0; i < 24; i++) { const x = ((i * 137.5) % 100) / 100 * S, y = ((i * 91.7) % 45) / 100 * S; g.fillStyle = "rgba(255,255,255," + (0.15 + 0.35 * (0.5 + 0.5 * Math.sin(now * 0.002 + i))) + ")"; g.beginPath(); g.arc(x, y, S * 0.003, 0, Math.PI * 2); g.fill(); }
        // counter
        g.save(); g.textAlign = "center"; g.textBaseline = "top";
        g.fillStyle = "#ffd36b"; g.shadowColor = "rgba(255,211,107,0.6)"; g.shadowBlur = 16;
        g.font = "800 " + Math.round(S * 0.075) + "px system-ui, sans-serif";
        g.fillText("★ " + taps, S / 2, S * 0.03);
        g.restore();
        // burrows (back rim, critter, front rim)
        holes.forEach(function (h) {
          g.save();
          g.fillStyle = "rgba(60,44,70,0.9)"; g.beginPath(); g.ellipse(h.x, h.y, h.r * 1.25, h.r * 0.55, 0, 0, Math.PI * 2); g.fill();
          g.fillStyle = "rgba(8,6,14,0.95)"; g.beginPath(); g.ellipse(h.x, h.y, h.r * 1.1, h.r * 0.42, 0, 0, Math.PI * 2); g.fill();
          g.restore();
          drawCritter(h);
          // front lip of the burrow (covers the critter's bottom)
          g.save();
          const lip = g.createLinearGradient(0, h.y, 0, h.y + h.r * 0.7);
          lip.addColorStop(0, "rgba(90,70,100,0.95)"); lip.addColorStop(1, "rgba(50,38,60,0.95)");
          g.fillStyle = lip; g.shadowColor = "rgba(255,184,107,0.25)"; g.shadowBlur = 12;
          g.beginPath(); g.ellipse(h.x, h.y + h.r * 0.12, h.r * 1.25, h.r * 0.55, 0, 0, Math.PI); g.fill();
          g.restore();
          // grass tufts
          g.strokeStyle = "rgba(127,224,160,0.7)"; g.lineWidth = Math.max(1.5, S * 0.004); g.lineCap = "round";
          [-1.15, -0.9, 1.0, 1.2].forEach(function (d, i) { const bx = h.x + d * h.r, by = h.y + h.r * 0.5; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.sin(now * 0.002 + i) * h.r * 0.08, by - h.r * (0.2 + (i % 2) * 0.12)); g.stroke(); });
        });
        // confetti + toasts
        confetti.forEach(function (c) { g.save(); g.globalAlpha = Math.max(0, c.life); g.fillStyle = c.col; g.translate(c.x, c.y); g.rotate(c.x * 0.05); g.fillRect(-c.r, -c.r * 0.6, c.r * 2, c.r * 1.2); g.restore(); });
        toasts.forEach(function (t) { g.save(); g.globalAlpha = Math.max(0, Math.min(1, t.life * 1.5)); g.fillStyle = t.col; g.shadowColor = t.col; g.shadowBlur = 12; g.font = "800 " + Math.round(S * 0.045) + "px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(t.text, Math.min(S * 0.85, Math.max(S * 0.15, t.x)), t.y); g.restore(); });
      }

      return {
        mount(stage, c) {
          stageEl = stage; ctx = c;
          reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          const wrap = document.createElement("div");
          wrap.style.display = "flex"; wrap.style.flexDirection = "column"; wrap.style.alignItems = "center";
          canvas = document.createElement("canvas");
          canvas.style.borderRadius = "18px"; canvas.style.background = "#141024"; canvas.style.cursor = "pointer";
          canvas.style.boxShadow = "0 0 46px rgba(255,184,107,0.14)"; canvas.style.touchAction = "none";
          g = canvas.getContext("2d");
          wrap.appendChild(canvas);
          const hint = document.createElement("div"); hint.className = "hint";
          hint.textContent = "Tap the critters when they peek out. No losing — just giggles.";
          wrap.appendChild(hint);
          stage.appendChild(wrap);
          now = 0; taps = 0; confetti = []; toasts = []; nextPop = 600;
          total = ctx.storage.get("total", 0);
          holes = [];
          resize();
          ctx.setScore(0);
          Arcade.input.setPointerTarget(canvas);
          unResize = Arcade.board.onResize(function () { resize(); });
          draw();
        },
        handleInput(intent) {
          if (intent.type !== "point" || intent.phase !== "down" || intent.button !== 0) return;
          // generous hit: anywhere on the critter or its burrow
          let best = null, bd = Infinity;
          holes.forEach(function (h) {
            const cy = h.y - h.r * 0.15 - h.up * h.r;
            const d = Math.hypot(intent.x - h.x, intent.y - cy);
            if (d < h.r * 1.5 && d < bd) { bd = d; best = h; }
          });
          if (best && tapHole(best)) return;
          ctx.audio.tone(330, 0.08, { type: "sine", vol: 0.04, glide: 420 });   // gentle blip, nothing lost
        },
        tick(dt) { update(Math.min(50, dt)); draw(); },
        getScore() { return taps; },
        teardown() {
          if (unResize) unResize(); unResize = null;
          stageEl = ctx = canvas = g = null; holes = []; confetti = []; toasts = [];
        }
      };
    }
  });
})();
