/* Glide — a calm flappy-style drifter. One button: rise. Fly a glowing
   mote through soft neon gates. Gentle gravity, generous gaps, very slow
   ramp. Calm-neon, meditative, short-fuse friendly. */
(function () {
  Arcade.register({
    id: "glide",
    name: "Glide",
    tagline: "Drift a light-mote through the gates.",
    accent: "#6bb8f0",
    complexity: "low",
    controls: "click",
    scoreLabel: "Gates",
    create() {
      let stageEl, ctx, canvas, g, unResize = null, raf = null;
      let cssW = 0, cssH = 0, dpr = 1;
      let reduced = false;

      let started, over, gates, gx, gy, vy, gates_passed, spawnTimer, speed, trail;
      let mote;

      const GRAV = 0.0016;        // px per ms^2 (scaled below by size)
      const FLAP = -0.62;         // impulse velocity (px/ms at ref size)
      const REF = 480;            // reference play height for scaling motion

      function scaleUnit() { return cssH / REF; }

      function resize() {
        const size = Arcade.board.stageSize(900, 0.8);
        cssW = Math.round(size);
        cssH = Math.round(size);
        dpr = window.devicePixelRatio || 1;
        canvas.style.width = cssW + "px";
        canvas.style.height = cssH + "px";
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      function reset() {
        started = false;
        over = false;
        gates = [];
        gates_passed = 0;
        speed = cssW * 0.00016;   // px per ms
        spawnTimer = 0;
        trail = [];
        mote = { x: cssW * 0.28, y: cssH * 0.45 };
        vy = 0;
      }

      function gapSize() {
        // generous, shrinks very gently with score, floored
        return Math.max(cssH * 0.30, cssH * 0.40 - gates_passed * cssH * 0.006);
      }

      function spawnGate() {
        const gap = gapSize();
        const margin = cssH * 0.10;
        const cy = margin + gap / 2 + Math.random() * (cssH - gap - margin * 2);
        gates.push({ x: cssW + cssW * 0.08, gapY: cy, gap, w: cssW * 0.11, scored: false });
      }

      function flap() {
        if (over) return;
        if (!started) { started = true; }
        vy = FLAP * scaleUnit();
        // soft whoosh: quick downward glide, low vol
        ctx.audio.tone(520, 0.14, { type: "sine", vol: 0.07, glide: 240 });
        trail.push({ x: mote.x, y: mote.y, a: 1 });
      }

      function end() {
        over = true;
        ctx.audio.lose();
        ctx.onGameOver(gates_passed, {
          title: "Clipped a gate.",
          msg: "Gates cleared: " + gates_passed + ". Breathe, glide again."
        });
      }

      function update(dt) {
        if (!started || over) return;

        // gentle speed ramp
        speed += dt * 0.0000000045 * cssW;

        vy += GRAV * scaleUnit() * dt;
        mote.y += vy * dt;

        // trail
        trail.push({ x: mote.x, y: mote.y, a: 1 });
        if (trail.length > 22) trail.shift();
        for (const t of trail) t.a -= dt * 0.004;

        // spawn gates on a spacing timer
        spawnTimer -= dt;
        if (spawnTimer <= 0) {
          spawnGate();
          spawnTimer = 1550;
        }

        const r = cssW * 0.022; // mote radius
        for (const gt of gates) {
          gt.x -= speed * dt;
          // score when passed
          if (!gt.scored && gt.x + gt.w < mote.x - r) {
            gt.scored = true;
            gates_passed++;
            ctx.setScore(gates_passed);
            ctx.audio.pick();
          }
          // collision
          if (mote.x + r > gt.x && mote.x - r < gt.x + gt.w) {
            const top = gt.gapY - gt.gap / 2;
            const bot = gt.gapY + gt.gap / 2;
            if (mote.y - r < top || mote.y + r > bot) { end(); return; }
          }
        }
        // cull offscreen
        while (gates.length && gates[0].x + gates[0].w < -cssW * 0.15) gates.shift();

        // floor / ceiling
        if (mote.y - r < 0 || mote.y + r > cssH) { end(); return; }
      }

      function draw() {
        g.clearRect(0, 0, cssW, cssH);

        // soft vertical vignette background
        const bg = g.createLinearGradient(0, 0, 0, cssH);
        bg.addColorStop(0, "rgba(107,184,240,0.05)");
        bg.addColorStop(0.5, "rgba(107,184,240,0.015)");
        bg.addColorStop(1, "rgba(107,184,240,0.06)");
        g.fillStyle = bg;
        g.fillRect(0, 0, cssW, cssH);

        // gates
        for (const gt of gates) {
          const top = gt.gapY - gt.gap / 2;
          const bot = gt.gapY + gt.gap / 2;
          g.save();
          g.shadowColor = "rgba(107,184,240,0.55)";
          g.shadowBlur = 16;
          g.fillStyle = "rgba(107,184,240,0.16)";
          g.strokeStyle = "rgba(107,184,240,0.5)";
          g.lineWidth = 2;
          roundRect(0, 0, gt.x + gt.w, top, gt.w, 8);
          roundRect(0, bot, gt.x + gt.w, cssH - bot, gt.w, 8);
          g.restore();
        }

        // trail
        for (const t of trail) {
          if (t.a <= 0) continue;
          g.globalAlpha = t.a * 0.5;
          g.fillStyle = "rgba(150,205,250,0.8)";
          g.beginPath();
          g.arc(t.x, t.y, cssW * 0.012, 0, Math.PI * 2);
          g.fill();
        }
        g.globalAlpha = 1;

        // mote (glowing triangle pointing right, tilted by velocity)
        const r = cssW * 0.028;
        const tilt = Math.max(-0.5, Math.min(0.7, vy * 0.9));
        g.save();
        g.translate(mote.x, mote.y);
        g.rotate(tilt);
        g.shadowColor = "rgba(120,195,250,0.9)";
        g.shadowBlur = 22;
        g.fillStyle = "#bfe2fb";
        g.beginPath();
        g.moveTo(r, 0);
        g.lineTo(-r * 0.75, -r * 0.7);
        g.lineTo(-r * 0.4, 0);
        g.lineTo(-r * 0.75, r * 0.7);
        g.closePath();
        g.fill();
        g.restore();

        // pre-start prompt
        if (!started && !over) {
          g.save();
          g.globalAlpha = 0.6 + Math.sin(Date.now() * 0.004) * 0.2;
          g.fillStyle = "rgba(190,226,251,0.9)";
          g.font = Math.round(cssW * 0.045) + "px system-ui, sans-serif";
          g.textAlign = "center";
          g.fillText("click to rise", cssW / 2, cssH * 0.5 + cssW * 0.11);
          g.restore();
        }
      }

      function roundRect(x, y, w, h, rr) {
        if (w <= 0 || h <= 0) return;
        rr = Math.min(rr, w / 2, h / 2);
        g.beginPath();
        g.moveTo(x + rr, y);
        g.arcTo(x + w, y, x + w, y + h, rr);
        g.arcTo(x + w, y + h, x, y + h, rr);
        g.arcTo(x, y + h, x, y, rr);
        g.arcTo(x, y, x + w, y, rr);
        g.closePath();
        g.fill();
        g.stroke();
      }

      return {
        mount(stage, c) {
          stageEl = stage;
          ctx = c;
          reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

          const wrap = document.createElement("div");
          wrap.style.display = "flex";
          wrap.style.flexDirection = "column";
          wrap.style.alignItems = "center";

          canvas = document.createElement("canvas");
          canvas.style.borderRadius = "14px";
          canvas.style.background = "rgba(10,16,24,0.6)";
          canvas.style.boxShadow = "0 0 40px rgba(107,184,240,0.12)";
          g = canvas.getContext("2d");
          wrap.appendChild(canvas);

          const hint = document.createElement("div");
          hint.className = "hint";
          hint.textContent = "Click or space to rise · glide through the gates";
          wrap.appendChild(hint);

          stage.appendChild(wrap);

          resize();
          reset();
          draw();
          unResize = Arcade.board.onResize(() => { resize(); draw(); });
        },

        handleInput(intent) {
          if (intent.type === "action") flap();
          else if (intent.type === "point" && intent.phase === "down" && intent.button === 0) flap();
        },

        tick(dt) {
          update(dt);
          draw();
        },

        teardown() {
          if (unResize) unResize();
          if (raf) cancelAnimationFrame(raf);
          unResize = null; raf = null;
          stageEl = ctx = canvas = g = null;
          gates = trail = mote = null;
        }
      };
    }
  });
})();
