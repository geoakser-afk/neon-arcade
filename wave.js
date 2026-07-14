/* Surge — a Geometry-Dash "wave" runner. HOLD to fly up-diagonal, RELEASE to
   dive down-diagonal; tap fast to feather a flat line through tight corridors.
   Auto-scrolls right through neon obstacle corridors. Features: BOOST pads
   (speed burst), SLIDE zones (gravity flips / you ride a rail), and a set of
   hand-shaped levels that get harder, then endless. One button. Calm-neon. */
(function () {
  Arcade.register({
    id: "wave",
    name: "Surge",
    tagline: "Hold to rise, release to dive — ride the wave.",
    accent: "#8a7ff0",
    complexity: "med",
    controls: "click",
    scoreLabel: "Level",
    create() {
      let stageEl, ctx, canvas, g, unResize = null;
      let cssW = 0, cssH = 0, dpr = 1, reduced = false;

      // world scrolls in "cells" — 1 cell = a chunk of vertical space. The wave
      // moves at 45° at base speed: dy/dt = ±speed (same magnitude as scroll).
      let phase;              // "menu" | "intro" | "play" | "clear"
      let held, over, dead;
      let camX;               // world x scrolled so far (px)
      let y, vyDir;           // wave y (world px from top of band) and current slope sign
      let speed;              // px/ms horizontal (and vertical magnitude)
      let trail;              // recent points for the ribbon
      let level, maxLevel, deaths, progress, levelLen;
      let obstacles;          // [{x,w,gapY,gap, kind}]  kind: "gate"|"boost"|"slide"
      let boostT, slideT;     // active-effect timers
      let particles;
      let best;

      const BASE = 0.34;      // px/ms scroll at ref
      const REF = 560;

      function u() { return cssH / REF; }
      function bandTop() { return cssH * 0.06; }
      function bandBot() { return cssH * 0.94; }
      function bandH() { return bandBot() - bandTop(); }

      function resize() {
        const size = Arcade.board.stageSize(920, 0.82);   // wide — it's a runner
        cssW = Math.round(size);
        cssH = Math.round(size * 0.62);
        dpr = window.devicePixelRatio || 1;
        canvas.style.width = cssW + "px";
        canvas.style.height = cssH + "px";
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      // ---- level generation ----
      // Each level is a sequence of corridor segments. We build obstacles in
      // WORLD px ahead of the camera. Difficulty: tighter gaps, more boosts/slides,
      // longer, as level climbs (endless past the hand-made count).
      function levelParams(n) {
        return {
          len: 9000 + n * 1400,                       // world px length
          gap: Math.max(bandH() * 0.26, bandH() * 0.5 - n * bandH() * 0.03),
          spacing: Math.max(cssW * 0.42, cssW * 0.62 - n * cssW * 0.02),
          boostChance: Math.min(0.35, 0.12 + n * 0.03),
          slideChance: Math.min(0.30, 0.05 + n * 0.03)
        };
      }

      function buildLevel(n) {
        obstacles = [];
        const p = levelParams(n);
        levelLen = p.len;
        let x = cssW * 0.9;                            // first obstacle a bit in
        let gy = bandTop() + bandH() * 0.5;
        while (x < p.len) {
          // wander the gap center within reach, clamped to the band
          const reach = bandH() * 0.28;
          gy += (Math.random() * 2 - 1) * reach;
          gy = Math.max(bandTop() + p.gap / 2, Math.min(bandBot() - p.gap / 2, gy));
          const roll = Math.random();
          let kind = "gate";
          if (roll < p.slideChance) kind = "slide";
          else if (roll < p.slideChance + p.boostChance) kind = "boost";
          if (kind === "boost") {
            obstacles.push({ x: x, w: cssW * 0.04, gapY: gy, gap: p.gap, kind: "boost" });
          } else if (kind === "slide") {
            // a slide RAIL: a safe channel you ride (wider gap, marked)
            obstacles.push({ x: x, w: cssW * 0.18, gapY: gy, gap: p.gap * 1.35, kind: "slide" });
          } else {
            obstacles.push({ x: x, w: cssW * 0.05, gapY: gy, gap: p.gap, kind: "gate" });
          }
          x += p.spacing + Math.random() * cssW * 0.15;
        }
      }

      function startLevel(n) {
        level = n; phase = "intro";
        over = false; dead = false; held = false;
        camX = 0; speed = BASE * u() * (1 + (n - 1) * 0.06);   // faster each level
        y = bandTop() + bandH() * 0.5; vyDir = 1;
        trail = []; particles = [];
        boostT = 0; slideT = 0; progress = 0;
        buildLevel(n);
        ctx.setScore(level);
      }

      function beginPlay() { if (phase === "intro") phase = "play"; }

      function clearLevel() {
        phase = "clear";
        ctx.audio.score();
        if (level >= maxLevel) { maxLevel = level; ctx.storage.set("maxWave", maxLevel); }
        if (level > best) { best = level; ctx.storage.recordScore(best); }
      }

      function die() {
        if (dead) return;
        dead = true; over = true;
        ctx.audio.lose();
        shake = 1;
        // burst
        for (let i = 0; i < 22; i++) {
          const a = Math.random() * Math.PI * 2, sp = cssW * (0.04 + Math.random() * 0.14);
          particles.push({ x: cssW * 0.28, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1 });
        }
        if (level > best) { best = level; ctx.storage.recordScore(best); }
        ctx.onGameOver(level, {
          title: "Wiped out.",
          msg: "Level " + level + " · " + Math.round(progress * 100) + "% · best " + best
        });
      }

      let shake = 0;

      function update(dt) {
        if (shake > 0) shake = Math.max(0, shake - dt / 240);
        // fade particles always
        for (const pt of particles) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += cssH * 0.0009 * dt; pt.life -= dt / 700; }
        for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);

        if (phase !== "play" || over) return;

        boostT = Math.max(0, boostT - dt);
        slideT = Math.max(0, slideT - dt);

        const spd = speed * (boostT > 0 ? 1.7 : 1);
        camX += spd * dt;
        progress = Math.min(1, camX / levelLen);

        // wave vertical motion — 45° up when held, down when released. In a
        // slide zone you're locked to the rail center (auto-ride).
        vyDir = held ? -1 : 1;
        if (slideT > 0) {
          // ride: glide toward the slide rail's gap center
          const rail = currentSlide();
          if (rail) { const target = rail.gapY; y += Math.sign(target - y) * Math.min(Math.abs(target - y), spd * dt * 1.2); }
        } else {
          y += vyDir * spd * dt;   // exact 45° feel: |dy| == |dx|
        }

        // trail
        trail.push({ x: cssW * 0.28, wy: y, cam: camX });
        if (trail.length > 60) trail.shift();

        // band collision (top/bottom of play band)
        if (y < bandTop() || y > bandBot()) { die(); return; }

        // obstacle collision + effects. Wave sits at fixed screen x = px;
        // an obstacle at world x=o.x draws at screen x = o.x - camX.
        const px = cssW * 0.28, hit = cssW * 0.012;
        for (const o of obstacles) {
          const screenX = o.x - camX;
          if (screenX + o.w < px - hit || screenX > px + hit) continue; // wave not in this obstacle's column
          const top = o.gapY - o.gap / 2, bot = o.gapY + o.gap / 2;
          if (o.kind === "boost") {
            if (!o.used && y > top && y < bot) { o.used = true; boostT = 900; ctx.audio.tone(720, 0.1, { type: "sine", vol: 0.08, glide: 1100 }); }
            // boost pad: hitting its solid frame (outside the gap) still kills
            if (y < top || y > bot) { die(); return; }
          } else if (o.kind === "slide") {
            if (y > top && y < bot) { if (slideT <= 0) ctx.audio.tone(300, 0.12, { type: "sine", vol: 0.06, glide: 240 }); slideT = 260; }
            else { die(); return; }
          } else { // gate
            if (y < top || y > bot) { die(); return; }
          }
        }

        if (progress >= 1) { clearLevel(); return; }
      }

      function currentSlide() {
        const px = cssW * 0.28;
        for (const o of obstacles) {
          if (o.kind !== "slide") continue;
          const sx = o.x - camX;
          if (sx <= px && sx + o.w >= px) return o;
        }
        return null;
      }

      // ---- draw ----
      function acc(a) { return "rgba(138,127,240," + a + ")"; }
      function draw() {
        const sx = shake > 0 ? (Math.random() - 0.5) * shake * cssW * 0.02 : 0;
        const sy = shake > 0 ? (Math.random() - 0.5) * shake * cssH * 0.02 : 0;
        g.clearRect(0, 0, cssW, cssH);
        g.save(); g.translate(sx, sy);

        // bg wash
        const bg = g.createLinearGradient(0, 0, 0, cssH);
        bg.addColorStop(0, acc(0.06)); bg.addColorStop(0.5, acc(0.015)); bg.addColorStop(1, acc(0.06));
        g.fillStyle = bg; g.fillRect(0, 0, cssW, cssH);

        // band edges (the deadly ceiling/floor)
        g.strokeStyle = acc(0.5); g.lineWidth = 2; g.shadowColor = acc(0.5); g.shadowBlur = 10;
        g.beginPath(); g.moveTo(0, bandTop()); g.lineTo(cssW, bandTop()); g.stroke();
        g.beginPath(); g.moveTo(0, bandBot()); g.lineTo(cssW, bandBot()); g.stroke();
        g.shadowBlur = 0;

        // obstacles
        for (const o of obstacles) {
          const scr = o.x - camX;
          if (scr + o.w < -20 || scr > cssW + 20) continue;
          const top = o.gapY - o.gap / 2, bot = o.gapY + o.gap / 2;
          if (o.kind === "boost") {
            // boost pad: cyan chevrons in the gap
            g.save();
            g.fillStyle = "rgba(107,224,200,0.16)"; g.strokeStyle = "rgba(107,224,200,0.8)"; g.lineWidth = 2;
            g.shadowColor = "rgba(107,224,200,0.7)"; g.shadowBlur = 14;
            fillPipes(scr, o.w, top, bot, "107,224,200");
            // chevrons
            g.strokeStyle = "rgba(180,255,235,0.9)";
            for (let k = 0; k < 3; k++) {
              const cxp = scr + o.w / 2 + k * cssW * 0.014 - cssW * 0.014;
              g.beginPath(); g.moveTo(cxp - 6, o.gapY - 10); g.lineTo(cxp + 6, o.gapY); g.lineTo(cxp - 6, o.gapY + 10); g.stroke();
            }
            g.restore();
          } else if (o.kind === "slide") {
            // slide rail: amber safe channel
            g.save();
            g.strokeStyle = "rgba(240,200,90,0.85)"; g.lineWidth = 2; g.shadowColor = "rgba(240,200,90,0.6)"; g.shadowBlur = 12;
            fillPipes(scr, o.w, top, bot, "240,200,90");
            // rail centerline (dashed)
            g.setLineDash([8, 8]); g.strokeStyle = "rgba(240,220,140,0.7)";
            g.beginPath(); g.moveTo(scr, o.gapY); g.lineTo(scr + o.w, o.gapY); g.stroke();
            g.setLineDash([]);
            g.restore();
          } else {
            g.save();
            g.strokeStyle = acc(0.65); g.lineWidth = 2.5; g.shadowColor = acc(0.55); g.shadowBlur = 14;
            fillPipes(scr, o.w, top, bot, "138,127,240");
            g.restore();
          }
        }

        // wave ribbon trail
        if (trail.length > 1) {
          g.beginPath();
          for (let i = 0; i < trail.length; i++) {
            const t = trail[i];
            const tx = cssW * 0.28 - (camX - t.cam);
            if (i === 0) g.moveTo(tx, t.wy); else g.lineTo(tx, t.wy);
          }
          g.strokeStyle = boostT > 0 ? "rgba(107,224,200,0.85)" : acc(0.75);
          g.lineWidth = 3; g.shadowColor = boostT > 0 ? "rgba(107,224,200,0.8)" : acc(0.8); g.shadowBlur = 12;
          g.stroke();
          g.shadowBlur = 0;
        }

        // the wave head (arrow diamond), tilted to slope
        const hx = cssW * 0.28;
        g.save();
        g.translate(hx, y);
        g.rotate((held ? -1 : 1) * Math.PI / 4 * (slideT > 0 ? 0 : 1));
        g.shadowColor = "rgba(190,180,255,0.95)"; g.shadowBlur = 18;
        g.fillStyle = "#d7d0ff";
        const s = cssW * 0.016;
        g.beginPath(); g.moveTo(s * 1.6, 0); g.lineTo(-s, -s); g.lineTo(-s * 0.4, 0); g.lineTo(-s, s); g.closePath(); g.fill();
        g.restore();

        // particles
        for (const pt of particles) {
          g.globalAlpha = Math.max(0, pt.life);
          g.fillStyle = acc(0.9);
          g.beginPath(); g.arc(pt.x, pt.y, cssW * 0.008, 0, Math.PI * 2); g.fill();
        }
        g.globalAlpha = 1;

        // progress bar
        g.fillStyle = "rgba(255,255,255,0.12)"; g.fillRect(cssW * 0.1, cssH * 0.03, cssW * 0.8, 5);
        g.fillStyle = acc(0.85); g.fillRect(cssW * 0.1, cssH * 0.03, cssW * 0.8 * progress, 5);

        g.restore();

        // ---- overlays ----
        if (phase === "menu") drawMenu();
        else if (phase === "intro") drawCard(["LEVEL " + level, "Hold to rise · release to dive", "Cyan = boost · amber = slide rail. Click anywhere to begin."]);
        else if (phase === "clear") drawCard(["LEVEL " + level, "CLEAR", "Nice line. Click for the next level."]);
      }

      function fillPipes(scr, w, top, bot, rgb) {
        g.fillStyle = "rgba(" + rgb + ",0.14)";
        // top block (bandTop..top) and bottom block (bot..bandBot)
        g.beginPath(); g.rect(scr, bandTop(), w, Math.max(0, top - bandTop())); g.fill(); g.stroke();
        g.beginPath(); g.rect(scr, bot, w, Math.max(0, bandBot() - bot)); g.fill(); g.stroke();
      }

      function drawCard(lines) {
        g.fillStyle = "rgba(6,8,14,0.82)"; g.fillRect(0, 0, cssW, cssH);
        g.textAlign = "center"; g.textBaseline = "middle";
        g.fillStyle = acc(0.95); g.font = "800 " + Math.round(cssH * 0.09) + "px system-ui, sans-serif";
        g.fillText(lines[0], cssW / 2, cssH * 0.38);
        g.fillStyle = "rgba(210,205,255,0.9)"; g.font = "700 " + Math.round(cssH * 0.05) + "px system-ui, sans-serif";
        g.fillText(lines[1], cssW / 2, cssH * 0.52);
        g.fillStyle = "rgba(200,195,240,0.6)"; g.font = "500 " + Math.round(cssH * 0.035) + "px system-ui, sans-serif";
        g.fillText(lines[2], cssW / 2, cssH * 0.62);
      }

      function drawMenu() {
        g.fillStyle = "rgba(6,8,14,0.85)"; g.fillRect(0, 0, cssW, cssH);
        g.textAlign = "center"; g.textBaseline = "middle";
        g.fillStyle = acc(0.95); g.font = "800 " + Math.round(cssH * 0.11) + "px system-ui, sans-serif";
        g.fillText("SURGE", cssW / 2, cssH * 0.2);
        g.fillStyle = "rgba(210,205,255,0.85)"; g.font = "700 " + Math.round(cssH * 0.04) + "px system-ui, sans-serif";
        g.fillText("Pick a level  ·  best " + best, cssW / 2, cssH * 0.3);
        menuTiles().forEach(function (t) {
          g.save();
          rr(t.r.x, t.r.y, t.r.w, t.r.h, 12);
          g.fillStyle = t.n === -1 ? "rgba(24,20,40,0.95)" : "rgba(18,20,34,0.95)";
          g.fill();
          g.shadowColor = acc(0.5); g.shadowBlur = 10; g.strokeStyle = acc(0.6); g.lineWidth = 2;
          rr(t.r.x, t.r.y, t.r.w, t.r.h, 12); g.stroke();
          g.restore();
          g.fillStyle = acc(0.95); g.font = "800 " + Math.round(t.r.h * 0.4) + "px system-ui, sans-serif";
          g.textAlign = "center"; g.textBaseline = "middle";
          g.fillText(t.n === -1 ? "∞" : String(t.n), t.r.x + t.r.w / 2, t.r.y + t.r.h * 0.42);
          g.fillStyle = "rgba(200,195,240,0.55)"; g.font = "600 " + Math.round(t.r.h * 0.13) + "px system-ui, sans-serif";
          g.fillText(t.n === -1 ? "endless" : (t.n <= maxLevel ? "" : ""), t.r.x + t.r.w / 2, t.r.y + t.r.h * 0.78);
        });
      }
      // menu shows levels 1..min(HANDMADE, maxLevel+1) and an endless tile
      const HANDMADE = 6;
      function menuTiles() {
        const avail = Math.min(HANDMADE, maxLevel);       // unlocked hand levels
        const nums = [];
        for (let k = 1; k <= Math.min(HANDMADE, avail + 1); k++) nums.push(k);  // next one is playable
        nums.push(-1);                                     // endless (starts at your maxLevel)
        const cols = Math.min(4, nums.length);
        const tw = cssW * 0.13, th = cssW * 0.13, gap = cssW * 0.03;
        const rows = Math.ceil(nums.length / cols);
        const y0 = cssH * 0.44;
        const tiles = [];
        for (let i = 0; i < nums.length; i++) {
          const rI = Math.floor(i / cols), c = i % cols;
          const rowCount = Math.min(cols, nums.length - rI * cols);
          const rowW = rowCount * tw + (rowCount - 1) * gap;
          const x0 = (cssW - rowW) / 2;
          tiles.push({ n: nums[i], r: { x: x0 + c * (tw + gap), y: y0 + rI * (th + gap), w: tw, h: th } });
        }
        return tiles;
      }
      function rr(x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        g.beginPath(); g.moveTo(x + r, y);
        g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
        g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
      }
      function inRect(r, px, py) { return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h; }

      const self = {
        mount(stage, c) {
          stageEl = stage; ctx = c;
          reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          const wrap = document.createElement("div");
          wrap.style.display = "flex"; wrap.style.flexDirection = "column"; wrap.style.alignItems = "center";
          canvas = document.createElement("canvas");
          canvas.style.borderRadius = "14px";
          canvas.style.background = "rgba(10,10,20,0.7)";
          canvas.style.boxShadow = "0 0 40px rgba(138,127,240,0.14)";
          g = canvas.getContext("2d");
          wrap.appendChild(canvas);
          const hint = document.createElement("div");
          hint.className = "hint";
          hint.textContent = "Hold click / space to rise, release to dive · tap fast to hold a line";
          wrap.appendChild(hint);
          stage.appendChild(wrap);

          best = ctx.storage.best();
          maxLevel = Math.max(1, ctx.storage.get("maxWave", 1));
          resize();
          phase = "menu"; over = false; held = false; obstacles = []; particles = []; trail = []; y = cssH * 0.5; camX = 0;
          Arcade.input.setPointerTarget(canvas);
          draw();
          unResize = Arcade.board.onResize(function () { resize(); draw(); });
        },
        handleInput(intent) {
          if (over && phase !== "menu") return;
          if (intent.type === "point" && intent.phase === "down" && intent.button === 0) {
            if (phase === "menu") {
              const hit = menuTiles().find(function (t) { return inRect(t.r, intent.x, intent.y); });
              if (hit) { ctx.audio.tone(320, 0.14, { type: "sine", vol: 0.07, glide: 220 }); startLevel(hit.n === -1 ? Math.max(1, maxLevel) : hit.n); }
              return;
            }
            if (phase === "intro") { beginPlay(); }
            else if (phase === "clear") { startLevel(level + 1); }
          }
          // hold drives the wave slope during play
          if (intent.type === "hold") {
            held = intent.down;
            if (intent.down && phase === "intro") beginPlay();
          }
        },
        tick(dt) { update(Math.min(50, dt)); draw(); },
        getScore() { return level || 1; },
        pause() { held = false; },
        resume() { held = false; },
        teardown() {
          if (unResize) unResize();
          unResize = null;
          stageEl = ctx = canvas = g = null;
          obstacles = trail = particles = null;
        }
      };
      return self;
    }
  });
})();
