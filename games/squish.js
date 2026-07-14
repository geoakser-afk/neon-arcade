/* Squish — a smooth, tactile 30-second burst. Soft neon jelly blobs drift up;
   click one to SQUISH it — it wobbles, flattens, and pops into droplets with a
   satisfying boing. Chain quick pops for a combo. Pure calm-neon juice, no fail
   state beyond the timer: just squish as many as you can before it's up. */
(function () {
  Arcade.register({
    id: "squish",
    name: "Squish",
    tagline: "Pop the jelly blobs. Smooth, squishy, quick.",
    accent: "#e88bb0",
    complexity: "low",
    controls: "click",
    scoreLabel: "Popped",
    create() {
      let stageEl, ctx, canvas, g, unResize = null;
      let cssW = 0, cssH = 0, dpr = 1, reduced = false;

      let phase;             // "play" | "done"
      let blobs, drips, score, best, timeLeft, combo, comboT, spawnT, popFlash;
      const ROUND = 30000;   // 30s burst

      // accent + a couple companion jelly hues (all soft/calm)
      const HUES = ["232,139,176", "199,146,255", "111,208,224", "127,224,160", "240,180,90"];

      function resize() {
        const size = Arcade.board.stageSize(820);
        cssW = Math.round(size); cssH = Math.round(size);
        dpr = window.devicePixelRatio || 1;
        canvas.style.width = cssW + "px"; canvas.style.height = cssH + "px";
        canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      function reset() {
        phase = "play";
        blobs = []; drips = []; score = 0; combo = 0; comboT = 0;
        timeLeft = ROUND; spawnT = 0; popFlash = 0;
        ctx.setScore(0);
      }

      function spawnBlob() {
        const r = cssW * (0.045 + Math.random() * 0.05);
        const hue = HUES[Math.floor(Math.random() * HUES.length)];
        blobs.push({
          x: r + Math.random() * (cssW - r * 2),
          y: cssH + r,
          r: r, hue: hue,
          vy: -cssH * (0.00010 + Math.random() * 0.00009),   // drift up
          vx: (Math.random() * 2 - 1) * cssW * 0.00003,
          wob: Math.random() * Math.PI * 2,                   // wobble phase
          wobA: 0,                                            // wobble amplitude (kick on near-miss/hover)
          squish: 0,                                          // 0..1 squish anim on pop
          dead: false
        });
      }

      function popBlob(bl) {
        bl.dead = true;
        combo++; comboT = 900;
        const mult = 1 + Math.floor(combo / 4);
        score += mult; ctx.setScore(score);
        if (score > best) best = score;
        popFlash = 0.5;
        // boing: pitch rises with combo
        ctx.audio.tone(280 + Math.min(20, combo) * 22, 0.14, { type: "sine", vol: 0.16, glide: 520 });
        // droplets
        const n = reduced ? 5 : 12;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2, sp = bl.r * (0.02 + Math.random() * 0.05);
          drips.push({ x: bl.x, y: bl.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: bl.r * (0.12 + Math.random() * 0.14), hue: bl.hue, life: 1 });
        }
      }

      function end() {
        phase = "done";
        if (score > best) { best = score; }
        ctx.storage.recordScore(best);
        ctx.audio.score();
      }

      function update(dt) {
        if (popFlash > 0) popFlash = Math.max(0, popFlash - dt / 300);
        if (comboT > 0) { comboT -= dt; if (comboT <= 0) combo = 0; }

        // droplets always animate
        for (const d of drips) {
          d.x += d.vx * dt; d.y += d.vy * dt; d.vy += cssH * 0.0000012 * dt;
          d.life -= dt / 700;
        }
        for (let i = drips.length - 1; i >= 0; i--) if (drips[i].life <= 0) drips.splice(i, 1);

        if (phase !== "play") return;

        timeLeft -= dt;
        if (timeLeft <= 0) { timeLeft = 0; end(); return; }

        // spawn cadence quickens slightly as time runs down for a fun finish
        spawnT -= dt;
        const rate = 620 - (1 - timeLeft / ROUND) * 260;
        if (spawnT <= 0 && blobs.length < 14) { spawnBlob(); spawnT = rate; }

        for (const bl of blobs) {
          if (bl.dead) { bl.squish = Math.min(1, bl.squish + dt / 140); continue; }
          bl.x += bl.vx * dt; bl.y += bl.vy * dt;
          bl.wob += dt * 0.005;
          if (bl.wobA > 0) bl.wobA = Math.max(0, bl.wobA - dt / 400);
          // bounce off side walls softly
          if (bl.x < bl.r) { bl.x = bl.r; bl.vx = Math.abs(bl.vx); bl.wobA = 1; }
          if (bl.x > cssW - bl.r) { bl.x = cssW - bl.r; bl.vx = -Math.abs(bl.vx); bl.wobA = 1; }
        }
        // cull popped (after squish anim) + blobs that floated off the top
        for (let i = blobs.length - 1; i >= 0; i--) {
          if (blobs[i].dead && blobs[i].squish >= 1) blobs.splice(i, 1);
          else if (blobs[i].y < -blobs[i].r * 1.5) blobs.splice(i, 1);
        }
      }

      // draw a wobbly blob via a lumpy closed curve
      function drawBlob(bl) {
        const pts = 14;
        const squishY = bl.dead ? (1 - bl.squish) : 1;         // flatten on pop
        const squishX = bl.dead ? (1 + bl.squish * 0.6) : 1;   // spread on pop
        g.save();
        g.translate(bl.x, bl.y);
        g.beginPath();
        for (let i = 0; i <= pts; i++) {
          const a = (i / pts) * Math.PI * 2;
          const wob = reduced ? 0 : Math.sin(a * 3 + bl.wob) * bl.r * (0.04 + bl.wobA * 0.10);
          const rr = bl.r + wob;
          const px = Math.cos(a) * rr * squishX;
          const py = Math.sin(a) * rr * squishY;
          if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.closePath();
        const alpha = bl.dead ? (1 - bl.squish) : 1;
        const grad = g.createRadialGradient(-bl.r * 0.3, -bl.r * 0.3, bl.r * 0.1, 0, 0, bl.r * 1.1);
        grad.addColorStop(0, "rgba(" + bl.hue + "," + (0.55 * alpha) + ")");
        grad.addColorStop(1, "rgba(" + bl.hue + "," + (0.14 * alpha) + ")");
        g.shadowColor = "rgba(" + bl.hue + "," + (0.6 * alpha) + ")"; g.shadowBlur = 20;
        g.fillStyle = grad; g.fill();
        g.shadowBlur = 0;
        g.strokeStyle = "rgba(" + bl.hue + "," + (0.8 * alpha) + ")"; g.lineWidth = 2;
        g.stroke();
        // glossy highlight
        if (!bl.dead) {
          g.beginPath();
          g.ellipse(-bl.r * 0.3, -bl.r * 0.35, bl.r * 0.26, bl.r * 0.16, -0.5, 0, Math.PI * 2);
          g.fillStyle = "rgba(255,255,255,0.35)"; g.fill();
        }
        g.restore();
      }

      function draw() {
        g.clearRect(0, 0, cssW, cssH);
        const acc = ctx.accent || "#e88bb0";
        // soft wash
        const bg = g.createRadialGradient(cssW / 2, cssH * 0.6, cssW * 0.1, cssW / 2, cssH * 0.6, cssW * 0.7);
        bg.addColorStop(0, "rgba(232,139,176,0.05)");
        bg.addColorStop(1, "rgba(232,139,176,0.01)");
        g.fillStyle = bg; g.fillRect(0, 0, cssW, cssH);

        for (const bl of blobs) drawBlob(bl);

        // droplets
        for (const d of drips) {
          g.globalAlpha = Math.max(0, d.life);
          g.fillStyle = "rgba(" + d.hue + ",0.9)";
          g.beginPath(); g.arc(d.x, d.y, d.r, 0, Math.PI * 2); g.fill();
        }
        g.globalAlpha = 1;

        // pop flash
        if (popFlash > 0) {
          g.fillStyle = "rgba(255,255,255," + (popFlash * 0.08) + ")";
          g.fillRect(0, 0, cssW, cssH);
        }

        if (phase === "play") {
          // timer bar
          const frac = timeLeft / ROUND;
          g.fillStyle = "rgba(255,255,255,0.1)"; g.fillRect(cssW * 0.1, cssH * 0.035, cssW * 0.8, 6);
          g.fillStyle = frac < 0.25 ? "rgba(255,120,120,0.9)" : "rgba(" + HUES[0] + ",0.9)";
          g.fillRect(cssW * 0.1, cssH * 0.035, cssW * 0.8 * frac, 6);
          g.fillStyle = "rgba(230,235,245,0.6)";
          g.font = "700 " + Math.round(cssW * 0.03) + "px system-ui, sans-serif";
          g.textAlign = "center"; g.textBaseline = "top";
          g.fillText((timeLeft / 1000).toFixed(1) + "s", cssW / 2, cssH * 0.055);
          if (combo >= 4) {
            g.fillStyle = "color-mix(in srgb, " + acc + " 85%, white)";
            g.font = "800 " + Math.round(cssW * 0.04) + "px system-ui, sans-serif";
            g.fillText("x" + (1 + Math.floor(combo / 4)) + " combo", cssW / 2, cssH * 0.1);
          }
        } else {
          // results
          g.fillStyle = "rgba(6,8,14,0.78)"; g.fillRect(0, 0, cssW, cssH);
          g.textAlign = "center"; g.textBaseline = "middle";
          g.fillStyle = acc; g.font = "800 " + Math.round(cssW * 0.12) + "px system-ui, sans-serif";
          g.fillText(String(score), cssW / 2, cssH * 0.4);
          g.fillStyle = "rgba(230,235,245,0.85)"; g.font = "700 " + Math.round(cssW * 0.04) + "px system-ui, sans-serif";
          g.fillText("popped · best " + best, cssW / 2, cssH * 0.5);
          g.fillStyle = "rgba(200,205,230,0.6)"; g.font = "500 " + Math.round(cssW * 0.032) + "px system-ui, sans-serif";
          g.fillText("click to squish again", cssW / 2, cssH * 0.6);
        }
      }

      return {
        mount(stage, c) {
          stageEl = stage; ctx = c;
          reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          const wrap = document.createElement("div");
          wrap.style.display = "flex"; wrap.style.flexDirection = "column"; wrap.style.alignItems = "center";
          canvas = document.createElement("canvas");
          canvas.style.borderRadius = "16px";
          canvas.style.background = "rgba(14,10,16,0.7)";
          canvas.style.boxShadow = "0 0 44px rgba(232,139,176,0.14)";
          canvas.style.cursor = "pointer";
          g = canvas.getContext("2d");
          wrap.appendChild(canvas);
          const hint = document.createElement("div");
          hint.className = "hint";
          hint.textContent = "Click the jelly to squish it · chain pops for a combo · 30 seconds";
          wrap.appendChild(hint);
          stage.appendChild(wrap);

          best = ctx.storage.best();
          resize();
          reset();
          Arcade.input.setPointerTarget(canvas);
          draw();
          unResize = Arcade.board.onResize(function () { resize(); draw(); });
        },
        handleInput(intent) {
          if (intent.type !== "point" || intent.phase !== "down" || intent.button !== 0) return;
          if (phase === "done") { reset(); return; }
          // hit-test topmost blob under the click (generous — jelly is forgiving)
          for (let i = blobs.length - 1; i >= 0; i--) {
            const bl = blobs[i];
            if (bl.dead) continue;
            const dx = intent.x - bl.x, dy = intent.y - bl.y;
            if (dx * dx + dy * dy <= (bl.r * 1.15) * (bl.r * 1.15)) { popBlob(bl); return; }
          }
          // miss — tiny wobble on nearby blobs, breaks combo
          combo = 0;
          ctx.audio.soft();
        },
        tick(dt) { update(Math.min(50, dt)); draw(); },
        getScore() { return score; },
        teardown() {
          if (unResize) unResize();
          unResize = null;
          stageEl = ctx = canvas = g = null;
          blobs = drips = null;
        }
      };
    }
  });
})();
