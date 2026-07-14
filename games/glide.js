/* Glide — Flappy Bird, fully neon. Tap to flap a glowing triangle mote (with
   a wave-dash trail) between soft neon-blue pipes. No grass, no green. Gaps are
   always big enough AND always reachable from the last one, and the mote has a
   small forgiving hitbox so near-misses don't kill. One button. */
(function () {
  Arcade.register({
    id: "glide",
    name: "Glide",
    tagline: "Flap the mote through the neon gates.",
    accent: "#6bb8f0",
    complexity: "low",
    controls: "click",
    scoreLabel: "Score",
    create() {
      let stageEl, ctx, canvas, g, unResize = null;
      let cssW = 0, cssH = 0, dpr = 1;
      let reduced = false;

      let started, over, pipes, score, spawnTimer, flapAnim, best, trail, lastGapY;
      let mote;   // { y, vy }

      const REF = 560;
      const GRAV = 0.0021;     // px/ms^2 at ref
      const FLAP = -0.70;      // px/ms hop at ref
      const SPEED = 0.19;      // px/ms scroll at ref
      const GAP = 0.34;        // gap as fraction of height — comfortably clears the mote
      const PIPE_W = 0.14;     // pipe width fraction
      const SPACING = 1600;    // ms between pipes
      const REACH = 0.30;      // max gap-center shift between consecutive pipes (fraction of H)

      function u() { return cssH / REF; }

      function resize() {
        const size = Arcade.board.stageSize(760, 0.62);
        cssW = Math.round(size * 0.74);
        cssH = Math.round(size);
        dpr = window.devicePixelRatio || 1;
        canvas.style.width = cssW + "px";
        canvas.style.height = cssH + "px";
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      function reset() {
        started = false; over = false;
        pipes = []; score = 0; spawnTimer = 0; flapAnim = 0; trail = [];
        mote = { y: cssH * 0.42, vy: 0 };
        lastGapY = cssH * 0.42;
      }

      function spawnPipe() {
        const gap = cssH * GAP;
        const margin = cssH * 0.09;
        const lo = margin + gap / 2;                 // highest a gap-center can sit
        const hi = cssH - margin - gap / 2;          // lowest
        // pick a reachable center: within REACH of the previous gap, then clamp to bounds
        const reach = cssH * REACH;
        let cy = lastGapY + (Math.random() * 2 - 1) * reach;
        cy = Math.max(lo, Math.min(hi, cy));
        lastGapY = cy;
        pipes.push({ x: cssW + cssW * 0.12, gapY: cy, gap: gap, w: cssW * PIPE_W, scored: false });
      }

      function flap() {
        if (over) return;
        if (!started) { started = true; spawnPipe(); }
        mote.vy = FLAP * u();
        flapAnim = 1;
        ctx.audio.tone(560, 0.12, { type: "sine", vol: 0.07, glide: 250 });
        trail.push({ x: cssW * 0.3, y: mote.y, a: 1 });
      }

      function end() {
        if (over) return;
        over = true;
        ctx.audio.lose();
        if (score > best) { best = score; ctx.storage.recordScore(best); }
        ctx.onGameOver(score, {
          title: "Clipped it.",
          msg: "Score: " + score + (score >= best && score > 0 ? "  — new best!" : "  ·  best " + best)
        });
      }

      function update(dt) {
        if (flapAnim > 0) flapAnim = Math.max(0, flapAnim - dt * 0.006);

        // trail always fades
        for (const t of trail) t.a -= dt * 0.004;
        while (trail.length && trail[0].a <= 0) trail.shift();

        if (!started || over) return;

        mote.vy += GRAV * u() * dt;
        mote.y += mote.vy * dt;

        trail.push({ x: cssW * 0.3, y: mote.y, a: 1 });
        if (trail.length > 26) trail.shift();

        spawnTimer -= dt;
        if (spawnTimer <= 0) { spawnPipe(); spawnTimer = SPACING; }

        // SMALL forgiving hitbox — a circle much tighter than the drawn mote
        const bx = cssW * 0.3;
        const hit = cssW * 0.024;
        const step = SPEED * u() * dt;
        for (const p of pipes) {
          p.x -= step;
          if (!p.scored && p.x + p.w < bx - hit) {
            p.scored = true; score++; ctx.setScore(score);
            ctx.audio.pick();
          }
          if (bx + hit > p.x && bx - hit < p.x + p.w) {
            const top = p.gapY - p.gap / 2, bot = p.gapY + p.gap / 2;
            if (mote.y - hit < top || mote.y + hit > bot) { end(); return; }
          }
        }
        while (pipes.length && pipes[0].x + pipes[0].w < -cssW * 0.2) pipes.shift();

        // top/bottom of the play area (no ground)
        if (mote.y + hit > cssH) { mote.y = cssH - hit; end(); return; }
        if (mote.y - hit < 0) { mote.y = hit; mote.vy = 0; }
      }

      function drawPipe(p) {
        const top = p.gapY - p.gap / 2, bot = p.gapY + p.gap / 2;
        const acc = "107,184,240";                    // neon blue
        g.save();
        g.shadowColor = "rgba(" + acc + ",0.55)"; g.shadowBlur = 16;
        g.fillStyle = "rgba(" + acc + ",0.14)";
        g.strokeStyle = "rgba(" + acc + ",0.65)"; g.lineWidth = 2.5;
        pipeBody(p.x, 0, p.w, top, true);             // top pipe → down to `top`
        pipeBody(p.x, bot, p.w, cssH - bot, false);   // bottom pipe → down to floor
        g.restore();
      }
      function pipeBody(x, y, w, h, isTop) {
        if (h <= 0) return;
        const r = Math.min(w * 0.28, 10);
        const lipH = Math.min(cssH * 0.028, h);
        const lipOut = cssW * 0.022;
        // shaft (rounded on the gap end)
        roundRect(x, y, w, h, r);
        // lip at the mouth
        if (isTop) roundRect(x - lipOut, y + h - lipH, w + lipOut * 2, lipH, r);
        else roundRect(x - lipOut, y, w + lipOut * 2, lipH, r);
      }

      function draw() {
        g.clearRect(0, 0, cssW, cssH);
        // neon sky wash
        const sky = g.createLinearGradient(0, 0, 0, cssH);
        sky.addColorStop(0, "rgba(107,184,240,0.07)");
        sky.addColorStop(0.5, "rgba(107,184,240,0.02)");
        sky.addColorStop(1, "rgba(107,184,240,0.07)");
        g.fillStyle = sky; g.fillRect(0, 0, cssW, cssH);

        for (const p of pipes) drawPipe(p);

        // wave-dash trail
        for (const t of trail) {
          if (t.a <= 0) continue;
          g.globalAlpha = t.a * 0.5;
          g.fillStyle = "rgba(150,205,250,0.85)";
          g.beginPath(); g.arc(t.x, t.y, cssW * 0.013, 0, Math.PI * 2); g.fill();
        }
        g.globalAlpha = 1;

        // the mote — glowing triangle pointing right, tilted by velocity
        const r = cssW * 0.03;
        const bx = cssW * 0.3;
        const tilt = Math.max(-0.5, Math.min(0.8, mote.vy * 1.0 - flapAnim * 0.5));
        g.save();
        g.translate(bx, mote.y);
        g.rotate(tilt);
        g.shadowColor = "rgba(150,205,250,0.95)"; g.shadowBlur = 22;
        g.fillStyle = "#cfe8fb";
        g.beginPath();
        g.moveTo(r, 0);
        g.lineTo(-r * 0.75, -r * 0.7);
        g.lineTo(-r * 0.4, 0);
        g.lineTo(-r * 0.75, r * 0.7);
        g.closePath();
        g.fill();
        g.restore();

        // big center score
        if (started && !over) {
          g.save();
          g.fillStyle = "rgba(230,240,255,0.95)";
          g.strokeStyle = "rgba(0,0,0,0.35)"; g.lineWidth = cssW * 0.012;
          g.font = "800 " + Math.round(cssW * 0.16) + "px system-ui, sans-serif";
          g.textAlign = "center"; g.textBaseline = "middle";
          g.strokeText(String(score), cssW / 2, cssH * 0.15);
          g.fillText(String(score), cssW / 2, cssH * 0.15);
          g.restore();
        }

        // pre-start prompt
        if (!started && !over) {
          g.save();
          g.globalAlpha = 0.6 + (reduced ? 0.2 : Math.sin(Date.now() * 0.004) * 0.2);
          g.fillStyle = "rgba(190,226,251,0.95)";
          g.font = "700 " + Math.round(cssW * 0.06) + "px system-ui, sans-serif";
          g.textAlign = "center";
          g.fillText("tap to flap", cssW / 2, cssH * 0.52);
          if (best > 0) {
            g.font = "500 " + Math.round(cssW * 0.035) + "px system-ui, sans-serif";
            g.fillStyle = "rgba(190,226,251,0.6)";
            g.fillText("best " + best, cssW / 2, cssH * 0.52 + cssW * 0.08);
          }
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
        g.fill(); g.stroke();
      }

      const self = {
        mount(stage, c) {
          stageEl = stage; ctx = c;
          reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

          const wrap = document.createElement("div");
          wrap.style.display = "flex"; wrap.style.flexDirection = "column"; wrap.style.alignItems = "center";
          canvas = document.createElement("canvas");
          canvas.style.borderRadius = "14px";
          canvas.style.background = "rgba(10,16,24,0.7)";
          canvas.style.boxShadow = "0 0 40px rgba(107,184,240,0.12)";
          g = canvas.getContext("2d");
          wrap.appendChild(canvas);
          const hint = document.createElement("div");
          hint.className = "hint";
          hint.textContent = "Click or space to flap · thread the neon gates";
          wrap.appendChild(hint);
          stage.appendChild(wrap);

          best = ctx.storage.best();
          resize();
          reset();
          Arcade.input.setPointerTarget(canvas);
          draw();
          unResize = Arcade.board.onResize(function () { resize(); reset(); draw(); });
        },
        handleInput(intent) {
          if (intent.type === "action") flap();
          else if (intent.type === "point" && intent.phase === "down" && intent.button === 0) flap();
        },
        tick(dt) { update(dt); draw(); },
        getScore() { return score; },
        teardown() {
          if (unResize) unResize();
          unResize = null;
          stageEl = ctx = canvas = g = null;
          pipes = mote = trail = null;
        }
      };
      return self;
    }
  });
})();
