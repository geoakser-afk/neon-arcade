/* Refract — a light-mote refracts off walls, paddle, and neon bricks.
   Calm bounces, brighter brick-breaks. Paddle follows the mouse. */
(function () {
  Arcade.register({
    id: "breakout",
    name: "Refract",
    tagline: "Bounce the light-mote through the neon bricks.",
    accent: "#f0846b",
    complexity: "med",
    controls: "mouse",
    scoreLabel: "Score",
    create() {
      let canvas, g, ctx, wrap;
      let unResize = null;
      let W = 0, H = 0, dpr = 1;
      let paddle, ball, bricks, score, running, launched, over;
      let trail = [];
      const ROWS = 5, COLS = 8;

      // muted accent-family hues per row (warm, soft)
      const ROW_HUE = ["#f0846b", "#f09b6b", "#f0b06b", "#e88bb0", "#e0846b"];

      function css(v) {
        return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
      }

      function sizeCanvas() {
        const target = Arcade.board.stageSize(900, 0.8);
        dpr = window.devicePixelRatio || 1;
        W = Math.round(target);
        H = Math.round(target);
        canvas.style.width = W + "px";
        canvas.style.height = H + "px";
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      function buildBricks() {
        bricks = [];
        const marginX = W * 0.06;
        const top = H * 0.12;
        const gap = W * 0.012;
        const bw = (W - marginX * 2 - gap * (COLS - 1)) / COLS;
        const bh = H * 0.045;
        for (let r = 0; r < ROWS; r++) {
          for (let cI = 0; cI < COLS; cI++) {
            bricks.push({
              x: marginX + cI * (bw + gap),
              y: top + r * (bh + gap),
              w: bw, h: bh, row: r, alive: true
            });
          }
        }
      }

      function resetState() {
        const pw = W * 0.18, ph = H * 0.022;
        paddle = { w: pw, h: ph, x: W / 2 - pw / 2, y: H - H * 0.06 };
        const rad = Math.max(5, W * 0.014);
        ball = { x: W / 2, y: paddle.y - rad - 2, r: rad, vx: 0, vy: 0, speed: H * 0.62 };
        trail = [];
        buildBricks();
        score = 0; running = true; launched = false; over = false;
      }

      function relayout() {
        sizeCanvas();
        resetState();
      }

      function launch() {
        if (launched || over) return;
        launched = true;
        const ang = (Math.random() * 0.5 - 0.25); // small horizontal spread
        ball.vx = Math.sin(ang) * ball.speed;
        ball.vy = -Math.cos(ang) * ball.speed;
      }

      function setPaddle(px) {
        paddle.x = Math.max(0, Math.min(W - paddle.w, px - paddle.w / 2));
        if (!launched) { ball.x = paddle.x + paddle.w / 2; }
      }

      function endGame(win) {
        if (over) return;
        over = true; running = false;
        if (win) {
          ctx.audio.score();
          ctx.onGameOver(score, { title: "Cleared!", msg: "Every brick refracted — score " + score + ". Sharp." });
        } else {
          ctx.onGameOver(score, { title: "Missed it.", msg: "The mote slipped by. Score " + score + "." });
        }
      }

      function step(dt) {
        if (!launched) return;
        const s = dt / 1000;
        ball.x += ball.vx * s;
        ball.y += ball.vy * s;

        // walls
        if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); ctx.audio.soft(); }
        if (ball.x + ball.r > W) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); ctx.audio.soft(); }
        if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); ctx.audio.soft(); }

        // paddle
        if (ball.vy > 0 &&
            ball.y + ball.r >= paddle.y &&
            ball.y - ball.r <= paddle.y + paddle.h &&
            ball.x >= paddle.x && ball.x <= paddle.x + paddle.w) {
          const hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2); // -1..1
          const maxAng = Math.PI * 0.42;
          const ang = hit * maxAng;
          ball.vx = Math.sin(ang) * ball.speed;
          ball.vy = -Math.cos(ang) * ball.speed;
          ball.y = paddle.y - ball.r - 1;
          ctx.audio.move();
        }

        // bricks
        for (let i = 0; i < bricks.length; i++) {
          const b = bricks[i];
          if (!b.alive) continue;
          if (ball.x + ball.r > b.x && ball.x - ball.r < b.x + b.w &&
              ball.y + ball.r > b.y && ball.y - ball.r < b.y + b.h) {
            b.alive = false;
            score++;
            ctx.setScore(score);
            // reflect: choose axis by shallowest penetration
            const overlapL = (ball.x + ball.r) - b.x;
            const overlapR = (b.x + b.w) - (ball.x - ball.r);
            const overlapT = (ball.y + ball.r) - b.y;
            const overlapB = (b.y + b.h) - (ball.y - ball.r);
            const minX = Math.min(overlapL, overlapR);
            const minY = Math.min(overlapT, overlapB);
            if (minX < minY) ball.vx = -ball.vx; else ball.vy = -ball.vy;
            // chime pitched by row (higher rows brighter)
            ctx.audio.tone(360 + (ROWS - b.row) * 90, 0.12, { type: "sine", vol: 0.14 });
            break;
          }
        }

        // lose / win
        if (ball.y - ball.r > H) { endGame(false); return; }
        if (!bricks.some((b) => b.alive)) { endGame(true); return; }

        // trail
        trail.push({ x: ball.x, y: ball.y });
        if (trail.length > 8) trail.shift();
      }

      function draw() {
        g.clearRect(0, 0, W, H);
        const accent = ctx.accent || "#f0846b";

        // bricks
        for (let i = 0; i < bricks.length; i++) {
          const b = bricks[i];
          if (!b.alive) continue;
          const hue = ROW_HUE[b.row % ROW_HUE.length];
          g.save();
          g.shadowColor = hue;
          g.shadowBlur = 10;
          g.fillStyle = "color-mix(in srgb, " + hue + " 34%, #171b26)";
          roundRect(g, b.x, b.y, b.w, b.h, 4);
          g.fill();
          g.shadowBlur = 0;
          g.strokeStyle = "color-mix(in srgb, " + hue + " 55%, transparent)";
          g.lineWidth = 1;
          roundRect(g, b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1, 4);
          g.stroke();
          g.restore();
        }

        // paddle
        g.save();
        g.shadowColor = accent;
        g.shadowBlur = 16;
        g.fillStyle = accent;
        roundRect(g, paddle.x, paddle.y, paddle.w, paddle.h, paddle.h / 2);
        g.fill();
        g.restore();

        // trail
        for (let i = 0; i < trail.length; i++) {
          const t = trail[i];
          const a = (i + 1) / trail.length;
          g.beginPath();
          g.arc(t.x, t.y, ball.r * a * 0.8, 0, Math.PI * 2);
          g.fillStyle = "color-mix(in srgb, " + accent + " " + Math.round(a * 30) + "%, transparent)";
          g.fill();
        }

        // ball (glowing mote)
        g.save();
        g.shadowColor = accent;
        g.shadowBlur = 20;
        g.beginPath();
        g.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
        g.fillStyle = "#fff";
        g.fill();
        g.shadowBlur = 0;
        g.beginPath();
        g.arc(ball.x, ball.y, ball.r * 1.8, 0, Math.PI * 2);
        g.fillStyle = "color-mix(in srgb, " + accent + " 22%, transparent)";
        g.fill();
        g.restore();

        // launch prompt
        if (!launched && !over) {
          g.fillStyle = "rgba(230,235,245,0.45)";
          g.font = "600 " + Math.round(W * 0.032) + "px 'Segoe UI', system-ui, sans-serif";
          g.textAlign = "center";
          g.fillText("click to launch", W / 2, H * 0.62);
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
          const hint = document.createElement("div");
          hint.className = "hint";
          hint.style.position = "static";
          hint.style.marginTop = "8px";
          hint.textContent = "Move the mouse to slide the paddle";
          wrap.appendChild(hint);
          stage.appendChild(wrap);

          relayout();
          Arcade.input.setPointerTarget(canvas);
          unResize = Arcade.board.onResize(relayout);
        },
        handleInput(intent) {
          if (over) return;
          if (intent.type === "point") {
            if (intent.phase === "move") setPaddle(intent.x);
            if (intent.phase === "down" && intent.button === 0) {
              ctx.audio.unlock();
              setPaddle(intent.x);
              launch();
            }
          } else if (intent.type === "dir") {
            const dx = paddle.w * 0.5;
            if (intent.dir === "left") setPaddle(paddle.x + paddle.w / 2 - dx);
            if (intent.dir === "right") setPaddle(paddle.x + paddle.w / 2 + dx);
          } else if (intent.type === "action") {
            ctx.audio.unlock();
            launch();
          }
        },
        tick(dt) {
          if (!running || !ctx) return;
          step(dt);
          draw();
        },
        getScore() { return score; },
        pause() { running = false; },
        resume() { if (!over) running = true; },
        teardown() {
          if (unResize) unResize();
          running = false; over = true;
          ball = paddle = bricks = null; trail = [];
          canvas = g = null;
        }
      };
    }
  });
})();
