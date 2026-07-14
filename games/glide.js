/* Glide — Flappy Bird, neon-styled. Tap to flap a little bird between green
   pipes; snappy gravity, tight gaps, a scrolling ground, big center score.
   One button. Keeps the calm-neon coat but plays like the real thing. */
(function () {
  Arcade.register({
    id: "glide",
    name: "Glide",
    tagline: "Flap between the pipes. One tap, don't drop.",
    accent: "#6bb8f0",
    complexity: "low",
    controls: "click",
    scoreLabel: "Score",
    create() {
      let stageEl, ctx, canvas, g, unResize = null;
      let cssW = 0, cssH = 0, dpr = 1;
      let reduced = false;

      let started, over, pipes, score, spawnTimer, groundX, flapAnim, best;
      let bird;   // { y, vy }

      // physics tuned to REF height so it feels the same at any canvas size
      const REF = 560;
      const GRAV = 0.0022;     // px/ms^2 at ref — snappy flappy-bird fall
      const FLAP = -0.72;      // px/ms impulse at ref — a firm hop
      const SPEED = 0.20;      // px/ms scroll at ref
      const GAP = 0.30;        // gap as fraction of playfield height (tight-ish)
      const PIPE_W = 0.15;     // pipe width as fraction of width
      const SPACING = 1500;    // ms between pipes
      const GROUND = 0.12;     // ground height fraction

      function u() { return cssH / REF; }                 // motion scale
      function playH() { return cssH * (1 - GROUND); }    // area above the ground

      function resize() {
        const size = Arcade.board.stageSize(760, 0.62);   // portrait-ish, flappy is tall
        cssW = Math.round(size * 0.72);
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
        pipes = []; score = 0; spawnTimer = 0; groundX = 0; flapAnim = 0;
        bird = { y: cssH * 0.42, vy: 0 };
      }

      function spawnPipe() {
        const gap = playH() * GAP;
        const margin = cssH * 0.08;
        const cy = margin + gap / 2 + Math.random() * (playH() - gap - margin * 2);
        pipes.push({ x: cssW + cssW * 0.1, gapY: cy, gap: gap, w: cssW * PIPE_W, scored: false });
      }

      function flap() {
        if (over) return;
        if (!started) { started = true; spawnPipe(); }
        bird.vy = FLAP * u();
        flapAnim = 1;
        ctx.audio.tone(560, 0.08, { type: "square", vol: 0.06, glide: 360 }); // chirpy hop
      }

      function end() {
        if (over) return;
        over = true;
        ctx.audio.lose();
        if (score > best) { best = score; ctx.storage.recordScore(best); }
        ctx.onGameOver(score, {
          title: "Down it goes.",
          msg: "Score: " + score + (score >= best && score > 0 ? "  — new best!" : "  ·  best " + best)
        });
      }

      function update(dt) {
        if (flapAnim > 0) flapAnim = Math.max(0, flapAnim - dt * 0.006);
        // ground scrolls even before start (idle bob)
        groundX = (groundX - SPEED * u() * dt) % (cssW * 0.1);
        if (!started || over) return;

        bird.vy += GRAV * u() * dt;
        bird.y += bird.vy * dt;

        spawnTimer -= dt;
        if (spawnTimer <= 0) { spawnPipe(); spawnTimer = SPACING; }

        const r = cssW * 0.05;                 // bird radius (hitbox a touch smaller)
        const hit = r * 0.82;
        const step = SPEED * u() * dt;
        const bx = cssW * 0.3;                  // bird's fixed x
        for (const p of pipes) {
          p.x -= step;
          if (!p.scored && p.x + p.w < bx - hit) {
            p.scored = true; score++; ctx.setScore(score);
            ctx.audio.pick();
          }
          // collision with either pipe
          if (bx + hit > p.x && bx - hit < p.x + p.w) {
            const top = p.gapY - p.gap / 2, bot = p.gapY + p.gap / 2;
            if (bird.y - hit < top || bird.y + hit > bot) { end(); return; }
          }
        }
        while (pipes.length && pipes[0].x + pipes[0].w < -cssW * 0.2) pipes.shift();

        // ground + ceiling
        if (bird.y + hit > playH()) { bird.y = playH() - hit; end(); return; }
        if (bird.y - hit < 0) { bird.y = hit; bird.vy = 0; }
      }

      function drawPipe(x, w, top, bot) {
        // neon-green pipe pair (classic flappy green, glowing)
        const green = "107,224,140";
        g.save();
        g.shadowColor = "rgba(" + green + ",0.5)"; g.shadowBlur = 14;
        g.fillStyle = "rgba(" + green + ",0.16)";
        g.strokeStyle = "rgba(" + green + ",0.7)"; g.lineWidth = 2.5;
        // top pipe (from 0 to `top`) with a lip
        pipeBody(x, 0, w, top);
        // bottom pipe (from `bot` to ground)
        pipeBody(x, bot, w, playH() - bot);
        g.restore();
      }
      function pipeBody(x, y, w, h) {
        if (h <= 0) return;
        const lipH = Math.min(cssH * 0.03, h);
        const lipOut = cssW * 0.02;
        // shaft
        g.beginPath(); g.rect(x, y, w, h); g.fill(); g.stroke();
        // lip at the mouth end (nearest the gap)
        if (y === 0) { // top pipe → lip at bottom
          g.beginPath(); g.rect(x - lipOut, y + h - lipH, w + lipOut * 2, lipH); g.fill(); g.stroke();
        } else {        // bottom pipe → lip at top
          g.beginPath(); g.rect(x - lipOut, y, w + lipOut * 2, lipH); g.fill(); g.stroke();
        }
      }

      function draw() {
        g.clearRect(0, 0, cssW, cssH);
        // sky
        const sky = g.createLinearGradient(0, 0, 0, cssH);
        sky.addColorStop(0, "rgba(107,184,240,0.06)");
        sky.addColorStop(1, "rgba(107,184,240,0.015)");
        g.fillStyle = sky; g.fillRect(0, 0, cssW, cssH);

        for (const p of pipes) drawPipe(p.x, p.w, p.gapY - p.gap / 2, p.gapY + p.gap / 2);

        // ground (scrolling neon strip)
        const gyTop = playH();
        g.save();
        g.fillStyle = "rgba(90,120,80,0.25)";
        g.fillRect(0, gyTop, cssW, cssH - gyTop);
        g.strokeStyle = "rgba(107,224,140,0.6)"; g.lineWidth = 2;
        g.beginPath(); g.moveTo(0, gyTop); g.lineTo(cssW, gyTop); g.stroke();
        g.strokeStyle = "rgba(107,224,140,0.25)"; g.lineWidth = 1.5;
        for (let x = groundX; x < cssW; x += cssW * 0.1) {
          g.beginPath(); g.moveTo(x, gyTop); g.lineTo(x - cssW * 0.05, cssH); g.stroke();
        }
        g.restore();

        // bird
        const r = cssW * 0.05;
        const bx = cssW * 0.3;
        const tilt = Math.max(-0.5, Math.min(0.9, bird.vy * 1.1 - flapAnim * 0.6));
        g.save();
        g.translate(bx, bird.y);
        g.rotate(tilt);
        g.shadowColor = "rgba(255,215,90,0.85)"; g.shadowBlur = 18;
        // body
        g.fillStyle = "#ffd75a";
        g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
        // wing (flaps on hop)
        g.fillStyle = "#f0b93a";
        g.beginPath();
        g.ellipse(-r * 0.2, r * 0.1 - flapAnim * r * 0.5, r * 0.55, r * 0.32, -0.3, 0, Math.PI * 2);
        g.fill();
        // eye + beak
        g.shadowBlur = 0;
        g.fillStyle = "#fff"; g.beginPath(); g.arc(r * 0.35, -r * 0.3, r * 0.28, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#222"; g.beginPath(); g.arc(r * 0.45, -r * 0.3, r * 0.13, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#ff9e3d";
        g.beginPath(); g.moveTo(r * 0.7, 0); g.lineTo(r * 1.25, -r * 0.12); g.lineTo(r * 1.25, r * 0.12); g.closePath(); g.fill();
        g.restore();

        // big center score while playing
        if (started && !over) {
          g.save();
          g.fillStyle = "rgba(255,255,255,0.92)";
          g.strokeStyle = "rgba(0,0,0,0.4)"; g.lineWidth = cssW * 0.012;
          g.font = "800 " + Math.round(cssW * 0.16) + "px system-ui, sans-serif";
          g.textAlign = "center"; g.textBaseline = "middle";
          g.strokeText(String(score), cssW / 2, cssH * 0.16);
          g.fillText(String(score), cssW / 2, cssH * 0.16);
          g.restore();
        }

        // pre-start prompt
        if (!started && !over) {
          g.save();
          g.globalAlpha = 0.6 + (reduced ? 0.2 : Math.sin(Date.now() * 0.004) * 0.2);
          g.fillStyle = "rgba(190,226,251,0.95)";
          g.font = "700 " + Math.round(cssW * 0.06) + "px system-ui, sans-serif";
          g.textAlign = "center";
          g.fillText("tap to flap", cssW / 2, cssH * 0.5);
          g.font = "500 " + Math.round(cssW * 0.035) + "px system-ui, sans-serif";
          g.fillStyle = "rgba(190,226,251,0.6)";
          if (best > 0) g.fillText("best " + best, cssW / 2, cssH * 0.5 + cssW * 0.08);
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
          canvas.style.borderRadius = "14px";
          canvas.style.background = "rgba(10,16,24,0.7)";
          canvas.style.boxShadow = "0 0 40px rgba(107,184,240,0.12)";
          g = canvas.getContext("2d");
          wrap.appendChild(canvas);
          const hint = document.createElement("div");
          hint.className = "hint";
          hint.textContent = "Click or space to flap · thread the pipes";
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
          pipes = bird = null;
        }
      };
    }
  });
})();
