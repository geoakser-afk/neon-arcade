/* Refract — a juiced-up neon breakout. Multi-hit bricks, powerup drops
   (multiball / wide paddle / lasers / slow-mo), particle shatter, a combo
   multiplier, 3 lives, and endless levels that ramp. Paddle follows the mouse;
   calm bounces, brighter breaks. */
(function () {
  Arcade.register({
    id: "breakout",
    name: "Refract",
    tagline: "Neon breakout — powerups, combos, endless levels.",
    accent: "#f0846b",
    complexity: "med",
    controls: "mouse",
    scoreLabel: "Score",
    create() {
      let canvas, g, ctx, wrap, hintEl;
      let unResize = null;
      let W = 0, H = 0, dpr = 1;
      let paddle, balls, bricks, powerups, particles, lasers;
      let score, level, lives, combo, comboTimer, running, launched, over;
      let wideT, laserT, laserCd, slowT, shake, flash;
      const COLS = 9;

      // muted accent-family hues per brick tier (warm neon), + powerup colors
      const ROW_HUE = ["#f0846b", "#f09b6b", "#f0b06b", "#e88bb0", "#b57edc", "#6bb8f0"];
      const PU = {
        multi: { c: "#6bb8f0", label: "◆◆" },   // split balls x3
        wide:  { c: "#7fe0a0", label: "↔" },     // wider paddle
        laser: { c: "#f0846b", label: "▲" },     // paddle shoots
        slow:  { c: "#c792ff", label: "≈" }      // slow-mo balls
      };
      const PU_KEYS = Object.keys(PU);

      function sizeCanvas() {
        const target = Arcade.board.stageSize(900, 0.8);
        dpr = window.devicePixelRatio || 1;
        W = Math.round(target); H = Math.round(target);
        canvas.style.width = W + "px"; canvas.style.height = H + "px";
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      // a level's brick field — more rows + tougher bricks as levels climb
      function buildBricks() {
        bricks = [];
        const rows = Math.min(8, 4 + Math.floor(level / 2));
        const marginX = W * 0.06, top = H * 0.11, gap = W * 0.012;
        const bw = (W - marginX * 2 - gap * (COLS - 1)) / COLS;
        const bh = H * 0.04;
        for (let r = 0; r < rows; r++) {
          for (let cI = 0; cI < COLS; cI++) {
            // tougher bricks toward the top; hp grows slowly with level
            const baseHp = 1 + Math.floor((rows - 1 - r) / 2);
            const hp = Math.min(4, baseHp + (level > 4 ? 1 : 0));
            bricks.push({ x: marginX + cI * (bw + gap), y: top + r * (bh + gap),
                          w: bw, h: bh, row: r, hp: hp, maxHp: hp, alive: true });
          }
        }
      }

      function ballSpeed() { return H * (0.6 + level * 0.03); }

      function newBall(x, y, vx, vy) {
        const rad = Math.max(5, W * 0.013);
        return { x: x, y: y, r: rad, vx: vx || 0, vy: vy || 0, trail: [] };
      }

      function resetPaddleAndBall() {
        const pw = W * 0.17, ph = H * 0.022;
        paddle = { w: pw, baseW: pw, h: ph, x: W / 2 - pw / 2, y: H - H * 0.06 };
        balls = [newBall(W / 2, paddle.y - W * 0.02)];
        launched = false;
      }

      function newLevel() {
        buildBricks();
        resetPaddleAndBall();
        powerups = []; particles = []; lasers = [];
        wideT = 0; laserT = 0; laserCd = 0; slowT = 0;
        combo = 0; comboTimer = 0;
      }

      function resetState() {
        score = 0; level = 1; lives = 3; over = false; running = true;
        shake = 0; flash = 0;
        newLevel();
        ctx.setScore(0);
      }

      function relayout() { sizeCanvas(); const lv = level, sc = score, li = lives; resetState(); level = lv || 1; score = sc || 0; lives = li || 3; buildBricks(); resetPaddleAndBall(); ctx.setScore(score); }

      function launch() {
        if (launched || over) return;
        launched = true;
        const ang = Math.random() * 0.5 - 0.25;
        balls.forEach(function (b) { b.vx = Math.sin(ang) * ballSpeed(); b.vy = -Math.cos(ang) * ballSpeed(); });
      }

      function setPaddle(px) {
        paddle.x = Math.max(0, Math.min(W - paddle.w, px - paddle.w / 2));
        if (!launched && balls[0]) balls[0].x = paddle.x + paddle.w / 2;
      }

      function spawnParticles(x, y, color, n) {
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2, sp = W * (0.05 + Math.random() * 0.18);
          particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                           life: 1, color: color, r: 1 + Math.random() * 2.5 });
        }
      }

      function maybeDropPowerup(x, y) {
        if (Math.random() < 0.16) {
          const type = PU_KEYS[Math.floor(Math.random() * PU_KEYS.length)];
          powerups.push({ x: x, y: y, vy: H * 0.28, type: type });
        }
      }

      function applyPowerup(type) {
        ctx.audio.score();
        flash = 0.6;
        if (type === "multi") {
          const add = [];
          balls.forEach(function (b) {
            for (let k = 0; k < 2; k++) {
              const ang = (Math.random() * 0.8 - 0.4);
              const sp = ballSpeed();
              add.push(newBall(b.x, b.y, Math.sin(ang) * sp, -Math.abs(Math.cos(ang) * sp)));
            }
          });
          balls = balls.concat(add).slice(0, 8); // cap
        } else if (type === "wide") { wideT = 9000; paddle.w = paddle.baseW * 1.6; }
        else if (type === "laser") { laserT = 8000; }
        else if (type === "slow") { slowT = 5000; }
      }

      function loseBall() {
        if (over) return;
        lives--;
        combo = 0;
        shake = 1; flash = 0.5;
        ctx.audio.lose();
        if (lives <= 0) { endGame(false); return; }
        resetPaddleAndBall();
      }

      function endGame(win) {
        if (over) return;
        over = true; running = false;
        ctx.onGameOver(score, win
          ? { title: "Cleared!", msg: "Level " + level + " down — score " + score + "." }
          : { title: "Out of light.", msg: "Reached level " + level + " · score " + score + "." });
      }

      function hitBrick(b, ball) {
        b.hp--;
        combo++;
        comboTimer = 1400;
        const mult = 1 + Math.floor(combo / 4);        // combo score multiplier
        if (b.hp <= 0) {
          b.alive = false;
          score += 10 * mult;
          spawnParticles(b.x + b.w / 2, b.y + b.h / 2, ROW_HUE[b.row % ROW_HUE.length], 14);
          maybeDropPowerup(b.x + b.w / 2, b.y + b.h / 2);
          ctx.audio.tone(360 + combo * 12, 0.12, { type: "sine", vol: 0.15 });
        } else {
          score += 2 * mult;
          spawnParticles(ball.x, ball.y, ROW_HUE[b.row % ROW_HUE.length], 4);
          ctx.audio.tone(280, 0.07, { type: "triangle", vol: 0.1 });
        }
        ctx.setScore(score);
      }

      function step(dt) {
        const slow = slowT > 0 ? 0.55 : 1;
        const s = (dt / 1000) * slow;

        // timers
        if (wideT > 0) { wideT -= dt; if (wideT <= 0) paddle.w = paddle.baseW; }
        if (laserT > 0) laserT -= dt;
        if (slowT > 0) slowT -= dt;
        if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) combo = 0; }
        if (shake > 0) shake = Math.max(0, shake - dt / 260);
        if (flash > 0) flash = Math.max(0, flash - dt / 300);
        // keep paddle centered on ball before launch
        if (!launched) { if (balls[0]) balls[0].x = paddle.x + paddle.w / 2; }

        // lasers
        if (laserT > 0 && launched) {
          laserCd -= dt;
          if (laserCd <= 0) {
            laserCd = 260;
            lasers.push({ x: paddle.x + paddle.w * 0.2, y: paddle.y });
            lasers.push({ x: paddle.x + paddle.w * 0.8, y: paddle.y });
            ctx.audio.tone(880, 0.05, { type: "square", vol: 0.05 });
          }
        }
        for (let i = lasers.length - 1; i >= 0; i--) {
          const L = lasers[i];
          L.y -= H * 1.4 * s;
          let hit = false;
          for (let j = 0; j < bricks.length; j++) {
            const b = bricks[j];
            if (b.alive && L.x > b.x && L.x < b.x + b.w && L.y < b.y + b.h && L.y > b.y) {
              hitBrick(b, { x: L.x, y: L.y }); hit = true; break;
            }
          }
          if (hit || L.y < 0) lasers.splice(i, 1);
        }

        // powerups fall
        for (let i = powerups.length - 1; i >= 0; i--) {
          const p = powerups[i];
          p.y += p.vy * s;
          if (p.y + 8 >= paddle.y && p.y <= paddle.y + paddle.h &&
              p.x >= paddle.x && p.x <= paddle.x + paddle.w) {
            applyPowerup(p.type); powerups.splice(i, 1); continue;
          }
          if (p.y > H) powerups.splice(i, 1);
        }

        // particles
        for (let i = particles.length - 1; i >= 0; i--) {
          const pt = particles[i];
          pt.x += pt.vx * s; pt.y += pt.vy * s; pt.vy += H * 0.9 * s;
          pt.life -= dt / 620;
          if (pt.life <= 0) particles.splice(i, 1);
        }

        if (!launched) return;

        // move each ball
        for (let bi = balls.length - 1; bi >= 0; bi--) {
          const ball = balls[bi];
          ball.x += ball.vx * s; ball.y += ball.vy * s;

          if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); ctx.audio.soft(); }
          if (ball.x + ball.r > W) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); ctx.audio.soft(); }
          if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); ctx.audio.soft(); }

          // paddle
          if (ball.vy > 0 && ball.y + ball.r >= paddle.y && ball.y - ball.r <= paddle.y + paddle.h &&
              ball.x >= paddle.x && ball.x <= paddle.x + paddle.w) {
            const hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
            const ang = hit * Math.PI * 0.42;
            const sp = ballSpeed();
            ball.vx = Math.sin(ang) * sp; ball.vy = -Math.cos(ang) * sp;
            ball.y = paddle.y - ball.r - 1;
            combo = 0;                    // touching the paddle resets the combo
            ctx.audio.move();
          }

          // bricks
          for (let i = 0; i < bricks.length; i++) {
            const b = bricks[i];
            if (!b.alive) continue;
            if (ball.x + ball.r > b.x && ball.x - ball.r < b.x + b.w &&
                ball.y + ball.r > b.y && ball.y - ball.r < b.y + b.h) {
              const oL = (ball.x + ball.r) - b.x, oR = (b.x + b.w) - (ball.x - ball.r);
              const oT = (ball.y + ball.r) - b.y, oB = (b.y + b.h) - (ball.y - ball.r);
              if (Math.min(oL, oR) < Math.min(oT, oB)) ball.vx = -ball.vx; else ball.vy = -ball.vy;
              hitBrick(b, ball);
              break;
            }
          }

          // trail
          ball.trail.push({ x: ball.x, y: ball.y });
          if (ball.trail.length > 8) ball.trail.shift();

          // lost off the bottom
          if (ball.y - ball.r > H) {
            balls.splice(bi, 1);
            if (balls.length === 0) { loseBall(); return; }
          }
        }

        // level clear
        if (!bricks.some(function (b) { return b.alive; })) {
          level++; flash = 0.8; ctx.audio.score();
          newLevel();
        }
      }

      function draw() {
        const sx = shake > 0 ? (Math.random() - 0.5) * shake * W * 0.02 : 0;
        const sy = shake > 0 ? (Math.random() - 0.5) * shake * H * 0.02 : 0;
        g.clearRect(0, 0, W, H);
        g.save();
        g.translate(sx, sy);
        const accent = ctx.accent || "#f0846b";

        // bricks (brightness by remaining hp)
        for (let i = 0; i < bricks.length; i++) {
          const b = bricks[i];
          if (!b.alive) continue;
          const hue = ROW_HUE[b.row % ROW_HUE.length];
          const strength = 20 + (b.hp / b.maxHp) * 45;
          g.save();
          g.shadowColor = hue; g.shadowBlur = 8 + b.hp * 3;
          g.fillStyle = "color-mix(in srgb, " + hue + " " + Math.round(strength) + "%, #171b26)";
          roundRect(g, b.x, b.y, b.w, b.h, 4); g.fill();
          g.shadowBlur = 0;
          g.strokeStyle = "color-mix(in srgb, " + hue + " 60%, transparent)";
          g.lineWidth = 1;
          roundRect(g, b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1, 4); g.stroke();
          // pips for multi-hit bricks
          if (b.maxHp > 1) {
            g.fillStyle = "rgba(255,255,255," + (0.25 + b.hp * 0.12) + ")";
            g.font = "700 " + Math.round(b.h * 0.5) + "px system-ui, sans-serif";
            g.textAlign = "center"; g.textBaseline = "middle";
            g.fillText(String(b.hp), b.x + b.w / 2, b.y + b.h / 2);
          }
          g.restore();
        }

        // particles
        for (let i = 0; i < particles.length; i++) {
          const pt = particles[i];
          g.globalAlpha = Math.max(0, pt.life);
          g.fillStyle = pt.color;
          g.beginPath(); g.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2); g.fill();
        }
        g.globalAlpha = 1;

        // powerups (falling gems)
        for (let i = 0; i < powerups.length; i++) {
          const p = powerups[i], info = PU[p.type];
          g.save();
          g.shadowColor = info.c; g.shadowBlur = 12;
          g.fillStyle = "color-mix(in srgb, " + info.c + " 40%, #171b26)";
          roundRect(g, p.x - W * 0.02, p.y - W * 0.02, W * 0.04, W * 0.04, 5); g.fill();
          g.strokeStyle = info.c; g.lineWidth = 1.5;
          roundRect(g, p.x - W * 0.02, p.y - W * 0.02, W * 0.04, W * 0.04, 5); g.stroke();
          g.fillStyle = info.c;
          g.font = "700 " + Math.round(W * 0.022) + "px system-ui, sans-serif";
          g.textAlign = "center"; g.textBaseline = "middle";
          g.fillText(info.label, p.x, p.y);
          g.restore();
        }

        // lasers
        g.strokeStyle = accent; g.lineWidth = 2; g.shadowColor = accent; g.shadowBlur = 8;
        for (let i = 0; i < lasers.length; i++) {
          const L = lasers[i];
          g.beginPath(); g.moveTo(L.x, L.y); g.lineTo(L.x, L.y + H * 0.03); g.stroke();
        }
        g.shadowBlur = 0;

        // paddle
        g.save();
        g.shadowColor = laserT > 0 ? "#f0846b" : accent; g.shadowBlur = 16;
        g.fillStyle = wideT > 0 ? "#7fe0a0" : accent;
        roundRect(g, paddle.x, paddle.y, paddle.w, paddle.h, paddle.h / 2); g.fill();
        g.restore();

        // balls + trails
        for (let bi = 0; bi < balls.length; bi++) {
          const ball = balls[bi];
          for (let i = 0; i < ball.trail.length; i++) {
            const t = ball.trail[i], a = (i + 1) / ball.trail.length;
            g.beginPath(); g.arc(t.x, t.y, ball.r * a * 0.8, 0, Math.PI * 2);
            g.fillStyle = "color-mix(in srgb, " + accent + " " + Math.round(a * 30) + "%, transparent)";
            g.fill();
          }
          g.save();
          g.shadowColor = slowT > 0 ? "#c792ff" : accent; g.shadowBlur = 20;
          g.beginPath(); g.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
          g.fillStyle = "#fff"; g.fill();
          g.restore();
        }

        // HUD: lives, level, combo
        g.fillStyle = "rgba(230,235,245,0.6)";
        g.font = "700 " + Math.round(W * 0.022) + "px system-ui, sans-serif";
        g.textAlign = "left"; g.textBaseline = "top";
        g.fillText("LV " + level, W * 0.03, H * 0.02);
        g.textAlign = "right";
        g.fillStyle = accent;
        g.fillText("● ".repeat(Math.max(0, lives)).trim(), W * 0.97, H * 0.02);
        if (combo >= 4) {
          g.textAlign = "center";
          g.fillStyle = "color-mix(in srgb, " + accent + " 80%, white)";
          g.font = "800 " + Math.round(W * 0.03) + "px system-ui, sans-serif";
          g.fillText("x" + (1 + Math.floor(combo / 4)) + "  combo " + combo, W / 2, H * 0.02);
        }

        // launch prompt
        if (!launched && !over) {
          g.fillStyle = "rgba(230,235,245,0.5)";
          g.font = "600 " + Math.round(W * 0.032) + "px system-ui, sans-serif";
          g.textAlign = "center";
          g.fillText("click to launch", W / 2, H * 0.62);
        }

        g.restore();

        // level-clear / powerup flash
        if (flash > 0) {
          g.fillStyle = "color-mix(in srgb, " + accent + " " + Math.round(flash * 18) + "%, transparent)";
          g.fillRect(0, 0, W, H);
        }
      }

      function roundRect(g, x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        g.beginPath();
        g.moveTo(x + r, y);
        g.arcTo(x + w, y, x + w, y + h, r);
        g.arcTo(x + w, y + h, x, y + h, r);
        g.arcTo(x, y + h, x, y, r);
        g.arcTo(x, y, x + w, y, r);
        g.closePath();
      }

      return {
        mount(stage, c) {
          ctx = c;
          wrap = document.createElement("div");
          wrap.style.position = "relative";
          wrap.style.display = "flex";
          wrap.style.flexDirection = "column";
          wrap.style.alignItems = "center";
          canvas = document.createElement("canvas");
          canvas.style.borderRadius = "12px";
          canvas.style.background = "var(--panel)";
          canvas.style.border = "1px solid var(--line)";
          canvas.style.boxShadow = "var(--glow)";
          g = canvas.getContext("2d");
          wrap.appendChild(canvas);
          hintEl = document.createElement("div");
          hintEl.className = "hint";
          hintEl.style.position = "static";
          hintEl.style.marginTop = "8px";
          hintEl.textContent = "Move to slide the paddle · catch powerups · combo without touching the paddle";
          wrap.appendChild(hintEl);
          stage.appendChild(wrap);

          sizeCanvas();
          resetState();
          Arcade.input.setPointerTarget(canvas);
          unResize = Arcade.board.onResize(function () {
            // resize keeps the run going: rescale field to new dims
            const lv = level, sc = score, li = lives;
            sizeCanvas(); buildBricks(); resetPaddleAndBall();
            level = lv; score = sc; lives = li; powerups = []; lasers = []; particles = [];
            ctx.setScore(score);
          });
        },
        handleInput(intent) {
          if (over) return;
          if (intent.type === "point") {
            if (intent.phase === "move") setPaddle(intent.x);
            if (intent.phase === "down" && intent.button === 0) { ctx.audio.unlock(); setPaddle(intent.x); launch(); }
          } else if (intent.type === "dir") {
            const dx = paddle.w * 0.5;
            if (intent.dir === "left") setPaddle(paddle.x + paddle.w / 2 - dx);
            if (intent.dir === "right") setPaddle(paddle.x + paddle.w / 2 + dx);
          } else if (intent.type === "action") { ctx.audio.unlock(); launch(); }
        },
        tick(dt) {
          if (!running || !ctx) return;
          step(Math.min(50, dt));
          draw();
        },
        getScore() { return score; },
        pause() { running = false; },
        resume() { if (!over) running = true; },
        teardown() {
          if (unResize) unResize();
          running = false; over = true;
          balls = paddle = bricks = powerups = particles = lasers = null;
          canvas = g = null;
        }
      };
    }
  });
})();
