/* Squish — a smooth, tactile 30-second burst. Soft neon jelly blobs drift up;
   click one to SQUISH it — it wobbles, flattens, and pops into droplets with a
   satisfying boing. Chain quick pops for a combo. A glowing line guards the
   top: any jelly that drifts past it costs a life. Three lives, 30 seconds —
   lose all three and the round ends early. Bomb blobs (dark, red fuse) explode
   if you click them (-1 life) — let those float away. Rare gold jelly gives a
   life back (or bonus points at full health).
   Two modes: TIMER (the classic 30s burst) and ENDLESS (no clock — speed,
   spawn rate, crowd size and bomb share all ramp with time + score until
   your three lives are gone). Each mode keeps its own best. */
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

      let phase;             // "menu" | "play" | "done"
      let mode;              // "timer" | "endless"
      let bestTimer, bestEndless;
      let menuRects;         // hit boxes for the two mode cards
      let blobs, drips, score, best, timeLeft, combo, comboT, spawnT, popFlash;
      let lives, lifeFlash, endReason, goldFlash, shake, toasts, elapsed;
      const BOMB_CHANCE = 0.17;   // share of spawns that are bombs (after the opening seconds)

      // ---- endless difficulty ramp: driven by BOTH time survived and points ----
      // level ~1 after 30s or 70 points; everything scales off it (capped so it stays playable).
      // Gentle: ~1.2x speed at 30s, ~1.6x at 90s, hard cap 2.4x.
      function level() { return mode === "endless" ? elapsed / 30000 + score / 70 : 0; }
      function speedMult() { return mode === "endless" ? Math.min(2.4, 1 + 0.2 * level()) : 1; }
      function spawnEvery() {
        if (mode === "endless") return Math.max(280, 620 / (1 + 0.25 * level()));
        return 620 - (1 - timeLeft / ROUND) * 260;   // timer: quickens slightly for a fun finish
      }
      function maxBlobs() { return mode === "endless" ? Math.min(26, Math.round(14 + 2 * level())) : 14; }
      function bombChance() { return mode === "endless" ? Math.min(0.25, BOMB_CHANCE + 0.012 * level()) : BOMB_CHANCE; }
      const GOLD_CHANCE = 0.06;   // share of spawns that are gold jelly
      const GOLD_HUE = "255,214,110";
      const BOMB_HUE = "255,96,110";
      const ROUND = 30000;   // 30s burst
      const LIVES = 3;
      const LINE_FRAC = 0.14;   // danger line sits this far down from the top
      function lineY() { return cssH * LINE_FRAC; }

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

      function reset(m) {
        mode = m || mode || "timer";
        phase = "play";
        blobs = []; drips = []; score = 0; combo = 0; comboT = 0;
        timeLeft = ROUND; spawnT = 0; popFlash = 0;
        lives = LIVES; lifeFlash = 0; endReason = "";
        goldFlash = 0; shake = 0; toasts = []; elapsed = 0;
        ctx.setScore(0);
      }

      function spawnBlob() {
        // On a narrow phone, scale blobs up so even the smallest is a comfortable
        // tap target (~44px). Desktop keeps the original smaller/denser blobs.
        const portrait = window.innerWidth < 720;
        const base = portrait ? 0.075 : 0.045;
        let r = cssW * (base + Math.random() * 0.05);
        // kind: plain jelly, a bomb (don't click!), or rare gold (extra life)
        let kind = "jelly";
        if (elapsed > 2500) {
          const roll = Math.random();
          const bc = bombChance();
          if (roll < bc) kind = "bomb";
          else if (roll < bc + GOLD_CHANCE) kind = "gold";
        }
        let hue = HUES[Math.floor(Math.random() * HUES.length)];
        let vy = -cssH * (0.00016 + Math.random() * 0.00013);   // drift up (~1.5x the old drift)
        if (kind === "bomb") { hue = BOMB_HUE; r *= 0.95; }
        if (kind === "gold") { hue = GOLD_HUE; r *= 0.85; vy *= 1.35; }   // gold is small + quick
        blobs.push({
          kind: kind,
          x: r + Math.random() * (cssW - r * 2),
          y: cssH + r,
          r: r, hue: hue,
          vy: vy,
          vx: (Math.random() * 2 - 1) * cssW * 0.00003,
          wob: Math.random() * Math.PI * 2,                   // wobble phase
          wobA: 0,                                            // wobble amplitude (kick on near-miss/hover)
          squish: 0,                                          // 0..1 squish anim on pop
          dead: false
        });
      }

      function toast(x, y, text, hue) { toasts.push({ x: x, y: y, text: text, hue: hue, life: 1 }); }

      function popBlob(bl) {
        bl.dead = true;
        combo++; comboT = 900;
        const mult = 1 + Math.floor(combo / 4);
        let gain = mult;
        if (bl.kind === "gold") {
          // gold: +3 bonus and a life back (or +2 more points if already full)
          gain += 3;
          if (lives < LIVES) { lives++; toast(bl.x, bl.y - bl.r, "+1 life", GOLD_HUE); }
          else { gain += 2; toast(bl.x, bl.y - bl.r, "+" + gain, GOLD_HUE); }
          goldFlash = 1;
          ctx.audio.chord([660, 880, 1320], 0.35, { type: "sine", vol: 0.12, attack: 0.01 });
        }
        score += gain; ctx.setScore(score);
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

      // clicked a bomb: it detonates, shakes the board, and takes a life
      function detonate(bl) {
        bl.dead = true;
        bl.squish = 0.2;
        lives--;
        lifeFlash = 1; shake = 1;
        combo = 0; comboT = 0;
        toast(bl.x, bl.y - bl.r, "-1 life", BOMB_HUE);
        ctx.audio.tone(90, 0.42, { type: "sawtooth", vol: 0.16, glide: 30 });
        ctx.audio.tone(60, 0.5, { type: "triangle", vol: 0.14, glide: 20 });
        const n = reduced ? 8 : 22;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2, sp = bl.r * (0.05 + Math.random() * 0.10);
          drips.push({ x: bl.x, y: bl.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: bl.r * (0.10 + Math.random() * 0.18), hue: i % 3 ? BOMB_HUE : "255,200,120", life: 1 });
        }
        if (lives <= 0) { lives = 0; endReason = "kaboom"; end(); }
      }

      // a bomb that drifts off the top just fizzles — no penalty for letting it go
      function fizzle(bl) {
        bl.dead = true;
        bl.squish = 0.5;
        ctx.audio.tone(220, 0.08, { type: "sine", vol: 0.04, glide: 160 });
        for (let i = 0; i < 4; i++) {
          drips.push({ x: bl.x, y: bl.y, vx: (Math.random() - 0.5) * bl.r * 0.02, vy: -bl.r * 0.02, r: bl.r * 0.1, hue: "160,160,170", life: 0.6 });
        }
      }

      // a blob slipped past the danger line: it bursts red, you lose a life
      function escapeBlob(bl) {
        if (bl.kind === "bomb") { fizzle(bl); return; }
        bl.dead = true;
        bl.squish = 0.35;
        lives--;
        lifeFlash = 1;
        combo = 0; comboT = 0;
        ctx.audio.tone(140, 0.28, { type: "triangle", vol: 0.14, glide: 70 });
        const n = reduced ? 6 : 14;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2, sp = bl.r * (0.03 + Math.random() * 0.06);
          drips.push({ x: bl.x, y: bl.y, vx: Math.cos(a) * sp, vy: Math.abs(Math.sin(a) * sp) * 0.8, r: bl.r * (0.12 + Math.random() * 0.14), hue: "255,96,110", life: 1 });
        }
        if (lives <= 0) { lives = 0; endReason = "out of lives"; end(); }
      }

      function end() {
        phase = "done";
        if (!endReason) endReason = "time's up";
        if (mode === "endless") {
          if (score > bestEndless) { bestEndless = score; ctx.storage.set("best_endless", bestEndless); }
        } else {
          if (score > bestTimer) { bestTimer = score; ctx.storage.set("best_timer", bestTimer); }
        }
        if (score > best) best = score;
        ctx.storage.recordScore(score);   // hub card shows the overall best across modes
        ctx.audio.score();
      }
      function modeBest() { return mode === "endless" ? bestEndless : bestTimer; }

      function update(dt) {
        if (popFlash > 0) popFlash = Math.max(0, popFlash - dt / 300);
        if (lifeFlash > 0) lifeFlash = Math.max(0, lifeFlash - dt / 550);
        if (goldFlash > 0) goldFlash = Math.max(0, goldFlash - dt / 500);
        if (shake > 0) shake = Math.max(0, shake - dt / 420);
        for (const t of toasts) { t.y -= dt * cssH * 0.00006; t.life -= dt / 1100; }
        for (let i = toasts.length - 1; i >= 0; i--) if (toasts[i].life <= 0) toasts.splice(i, 1);
        if (comboT > 0) { comboT -= dt; if (comboT <= 0) combo = 0; }

        // droplets always animate
        for (const d of drips) {
          d.x += d.vx * dt; d.y += d.vy * dt; d.vy += cssH * 0.0000012 * dt;
          d.life -= dt / 700;
        }
        for (let i = drips.length - 1; i >= 0; i--) if (drips[i].life <= 0) drips.splice(i, 1);

        if (phase !== "play") return;

        elapsed += dt;
        if (mode === "timer") {
          timeLeft -= dt;
          if (timeLeft <= 0) { timeLeft = 0; end(); return; }
        }

        // spawn cadence (timer: slight finish rush; endless: ramps hard)
        spawnT -= dt;
        if (spawnT <= 0 && blobs.length < maxBlobs()) { spawnBlob(); spawnT = spawnEvery(); }

        const sm = speedMult();
        for (const bl of blobs) {
          if (bl.dead) { bl.squish = Math.min(1, bl.squish + dt / 140); continue; }
          bl.x += bl.vx * sm * dt; bl.y += bl.vy * sm * dt;
          bl.wob += dt * 0.005;
          if (bl.wobA > 0) bl.wobA = Math.max(0, bl.wobA - dt / 400);
          // bounce off side walls softly
          if (bl.x < bl.r) { bl.x = bl.r; bl.vx = Math.abs(bl.vx); bl.wobA = 1; }
          if (bl.x > cssW - bl.r) { bl.x = cssW - bl.r; bl.vx = -Math.abs(bl.vx); bl.wobA = 1; }
          // crossed the danger line — lose a life
          if (bl.y < lineY()) { escapeBlob(bl); if (phase !== "play") return; }
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
        const pulse = 0.5 + 0.5 * Math.sin(bl.wob * 2.2);
        if (bl.kind === "bomb") {
          // bomb: dark body, red-hot rim that pulses, a lit fuse on top
          const grad = g.createRadialGradient(-bl.r * 0.3, -bl.r * 0.3, bl.r * 0.1, 0, 0, bl.r * 1.1);
          grad.addColorStop(0, "rgba(70,40,52," + (0.95 * alpha) + ")");
          grad.addColorStop(1, "rgba(30,14,22," + (0.9 * alpha) + ")");
          g.shadowColor = "rgba(" + BOMB_HUE + "," + ((0.45 + pulse * 0.4) * alpha) + ")"; g.shadowBlur = 16 + pulse * 14;
          g.fillStyle = grad; g.fill();
          g.shadowBlur = 0;
          g.strokeStyle = "rgba(" + BOMB_HUE + "," + ((0.65 + pulse * 0.35) * alpha) + ")"; g.lineWidth = 2.5;
          g.stroke();
          if (!bl.dead) {
            // fuse + spark
            g.strokeStyle = "rgba(220,200,180," + (0.8 * alpha) + ")"; g.lineWidth = Math.max(2, bl.r * 0.08);
            g.beginPath(); g.moveTo(bl.r * 0.1, -bl.r * 0.85); g.quadraticCurveTo(bl.r * 0.35, -bl.r * 1.25, bl.r * 0.55, -bl.r * 1.2); g.stroke();
            g.fillStyle = "rgba(255,230,140," + ((0.7 + pulse * 0.3) * alpha) + ")";
            g.shadowColor = "rgba(255,200,120,0.9)"; g.shadowBlur = 12;
            g.beginPath(); g.arc(bl.r * 0.55, -bl.r * 1.2, bl.r * (0.09 + pulse * 0.05), 0, Math.PI * 2); g.fill();
            g.shadowBlur = 0;
            // little "!" so it reads as danger even at a glance
            g.fillStyle = "rgba(" + BOMB_HUE + "," + (0.9 * alpha) + ")";
            g.font = "800 " + Math.round(bl.r * 0.9) + "px system-ui, sans-serif";
            g.textAlign = "center"; g.textBaseline = "middle";
            g.fillText("!", 0, bl.r * 0.05);
          }
        } else {
          const gold = bl.kind === "gold";
          const grad = g.createRadialGradient(-bl.r * 0.3, -bl.r * 0.3, bl.r * 0.1, 0, 0, bl.r * 1.1);
          grad.addColorStop(0, "rgba(" + bl.hue + "," + ((gold ? 0.8 : 0.55) * alpha) + ")");
          grad.addColorStop(1, "rgba(" + bl.hue + "," + ((gold ? 0.3 : 0.14) * alpha) + ")");
          g.shadowColor = "rgba(" + bl.hue + "," + ((gold ? 0.9 : 0.6) * alpha) + ")"; g.shadowBlur = gold ? 26 + pulse * 10 : 20;
          g.fillStyle = grad; g.fill();
          g.shadowBlur = 0;
          g.strokeStyle = "rgba(" + bl.hue + "," + (0.8 * alpha) + ")"; g.lineWidth = 2;
          g.stroke();
          // glossy highlight
          if (!bl.dead) {
            g.beginPath();
            g.ellipse(-bl.r * 0.3, -bl.r * 0.35, bl.r * 0.26, bl.r * 0.16, -0.5, 0, Math.PI * 2);
            g.fillStyle = "rgba(255,255,255," + (gold ? 0.55 : 0.35) + ")"; g.fill();
            if (gold) {
              // sparkle: a small four-point star that twinkles
              const sz = bl.r * (0.18 + pulse * 0.1);
              g.fillStyle = "rgba(255,255,255," + (0.6 + pulse * 0.4) + ")";
              g.beginPath();
              g.moveTo(bl.r * 0.35, -bl.r * 0.1 - sz); g.lineTo(bl.r * 0.35 + sz * 0.3, -bl.r * 0.1); g.lineTo(bl.r * 0.35, -bl.r * 0.1 + sz); g.lineTo(bl.r * 0.35 - sz * 0.3, -bl.r * 0.1);
              g.closePath(); g.fill();
            }
          }
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

        // explosion shake
        g.save();
        if (shake > 0 && !reduced) {
          const now = performance.now();
          g.translate(Math.sin(now * 0.08) * shake * shake * cssW * 0.02, Math.cos(now * 0.1) * shake * shake * cssH * 0.014);
        }

        for (const bl of blobs) drawBlob(bl);

        // droplets
        for (const d of drips) {
          g.globalAlpha = Math.max(0, d.life);
          g.fillStyle = "rgba(" + d.hue + ",0.9)";
          g.beginPath(); g.arc(d.x, d.y, d.r, 0, Math.PI * 2); g.fill();
        }
        g.globalAlpha = 1;

        // floating toasts (+1 life / -1 life / bonus)
        for (const t of toasts) {
          g.globalAlpha = Math.max(0, Math.min(1, t.life * 1.5));
          g.fillStyle = "rgba(" + t.hue + ",0.95)";
          g.shadowColor = "rgba(" + t.hue + ",0.8)"; g.shadowBlur = 10;
          g.font = "800 " + Math.round(cssW * 0.034) + "px system-ui, sans-serif";
          g.textAlign = "center"; g.textBaseline = "middle";
          g.fillText(t.text, Math.min(cssW - cssW * 0.08, Math.max(cssW * 0.08, t.x)), t.y);
          g.shadowBlur = 0;
        }
        g.globalAlpha = 1;
        g.restore();   // end shake

        // pop flash
        if (popFlash > 0) {
          g.fillStyle = "rgba(255,255,255," + (popFlash * 0.08) + ")";
          g.fillRect(0, 0, cssW, cssH);
        }
        // gold flash
        if (goldFlash > 0) {
          g.fillStyle = "rgba(" + GOLD_HUE + "," + (goldFlash * 0.10) + ")";
          g.fillRect(0, 0, cssW, cssH);
        }
        // bomb flash: red vignette pulse
        if (shake > 0) {
          const v = g.createRadialGradient(cssW / 2, cssH / 2, cssW * 0.3, cssW / 2, cssH / 2, cssW * 0.75);
          v.addColorStop(0, "rgba(255,96,110,0)");
          v.addColorStop(1, "rgba(255,96,110," + (0.35 * shake) + ")");
          g.fillStyle = v; g.fillRect(0, 0, cssW, cssH);
        }

        // danger line — glows red for a moment after a life is lost
        if (phase !== "menu") {
          const ly = lineY();
          const r = Math.round(232 + (255 - 232) * lifeFlash), gg = Math.round(139 - 40 * lifeFlash), b = Math.round(176 - 66 * lifeFlash);
          const col = r + "," + gg + "," + b;
          g.save();
          g.strokeStyle = "rgba(" + col + "," + (0.35 + lifeFlash * 0.6) + ")";
          g.lineWidth = 2 + lifeFlash * 2;
          g.shadowColor = "rgba(" + col + "," + (0.5 + lifeFlash * 0.5) + ")";
          g.shadowBlur = 12 + lifeFlash * 22;
          g.setLineDash([cssW * 0.02, cssW * 0.012]);
          g.beginPath(); g.moveTo(cssW * 0.04, ly); g.lineTo(cssW * 0.96, ly); g.stroke();
          g.restore();
          if (lifeFlash > 0) {
            const wash = g.createLinearGradient(0, 0, 0, ly * 1.6);
            wash.addColorStop(0, "rgba(255,96,110," + (0.28 * lifeFlash) + ")");
            wash.addColorStop(1, "rgba(255,96,110,0)");
            g.fillStyle = wash; g.fillRect(0, 0, cssW, ly * 1.6);
          }
        }

        // lives — three jelly dots, top-left; lost ones go hollow
        if (phase !== "menu") {
          const rr = Math.max(5, cssW * 0.013);
          const y0 = cssH * 0.035 + 3;
          for (let i = 0; i < LIVES; i++) {
            const x = cssW * 0.1 + rr + i * rr * 3.1;
            g.beginPath(); g.arc(x, y0 + rr * 2.6, rr, 0, Math.PI * 2);
            if (i < lives) {
              g.shadowColor = "rgba(" + HUES[0] + ",0.8)"; g.shadowBlur = 10;
              g.fillStyle = "rgba(" + HUES[0] + ",0.95)"; g.fill();
              g.shadowBlur = 0;
            } else {
              g.strokeStyle = "rgba(255,96,110," + (0.35 + lifeFlash * 0.5) + ")"; g.lineWidth = 1.5; g.stroke();
            }
          }
        }

        if (phase === "play") {
          if (mode === "timer") {
            // timer bar
            const frac = timeLeft / ROUND;
            g.fillStyle = "rgba(255,255,255,0.1)"; g.fillRect(cssW * 0.1, cssH * 0.035, cssW * 0.8, 6);
            g.fillStyle = frac < 0.25 ? "rgba(255,120,120,0.9)" : "rgba(" + HUES[0] + ",0.9)";
            g.fillRect(cssW * 0.1, cssH * 0.035, cssW * 0.8 * frac, 6);
            g.fillStyle = "rgba(230,235,245,0.6)";
            g.font = "700 " + Math.round(cssW * 0.03) + "px system-ui, sans-serif";
            g.textAlign = "center"; g.textBaseline = "top";
            g.fillText((timeLeft / 1000).toFixed(1) + "s", cssW / 2, cssH * 0.055);
          } else {
            // endless: speed readout — bar fills toward max ramp, tint shifts hot as it climbs
            const sm = speedMult();
            const frac = Math.min(1, (sm - 1) / 1.4);
            g.fillStyle = "rgba(255,255,255,0.1)"; g.fillRect(cssW * 0.1, cssH * 0.035, cssW * 0.8, 6);
            g.fillStyle = "rgba(" + Math.round(232 + 23 * frac) + "," + Math.round(139 - 43 * frac) + "," + Math.round(176 - 66 * frac) + ",0.9)";
            g.fillRect(cssW * 0.1, cssH * 0.035, cssW * 0.8 * frac, 6);
            g.fillStyle = "rgba(230,235,245,0.6)";
            g.font = "700 " + Math.round(cssW * 0.03) + "px system-ui, sans-serif";
            g.textAlign = "center"; g.textBaseline = "top";
            g.fillText("×" + sm.toFixed(1) + " speed · " + Math.floor(elapsed / 1000) + "s", cssW / 2, cssH * 0.055);
          }
          if (combo >= 4) {
            g.fillStyle = "color-mix(in srgb, " + acc + " 85%, white)";
            g.font = "800 " + Math.round(cssW * 0.04) + "px system-ui, sans-serif";
            g.fillText("x" + (1 + Math.floor(combo / 4)) + " combo", cssW / 2, cssH * 0.165);
          }
        } else if (phase === "menu") {
          drawMenu(acc);
        } else {
          // results
          g.fillStyle = "rgba(6,8,14,0.78)"; g.fillRect(0, 0, cssW, cssH);
          g.textAlign = "center"; g.textBaseline = "middle";
          g.fillStyle = acc; g.font = "800 " + Math.round(cssW * 0.12) + "px system-ui, sans-serif";
          g.fillText(String(score), cssW / 2, cssH * 0.4);
          g.fillStyle = "rgba(230,235,245,0.85)"; g.font = "700 " + Math.round(cssW * 0.04) + "px system-ui, sans-serif";
          g.fillText("popped · " + mode + " best " + modeBest(), cssW / 2, cssH * 0.5);
          g.fillStyle = "rgba(255,150,160,0.8)"; g.font = "600 " + Math.round(cssW * 0.03) + "px system-ui, sans-serif";
          g.fillText(endReason + (mode === "endless" ? " · survived " + Math.floor(elapsed / 1000) + "s" : ""), cssW / 2, cssH * 0.55);
          g.fillStyle = "rgba(200,205,230,0.6)"; g.font = "500 " + Math.round(cssW * 0.032) + "px system-ui, sans-serif";
          g.fillText("click to pick a mode", cssW / 2, cssH * 0.63);
        }
      }

      // ---- mode select: two cards, click one to start ----
      function drawMenu(acc) {
        g.fillStyle = "rgba(6,8,14,0.55)"; g.fillRect(0, 0, cssW, cssH);
        g.textAlign = "center"; g.textBaseline = "middle";
        g.fillStyle = acc; g.font = "800 " + Math.round(cssW * 0.09) + "px system-ui, sans-serif";
        g.shadowColor = "rgba(232,139,176,0.6)"; g.shadowBlur = 24;
        g.fillText("Squish", cssW / 2, cssH * 0.2);
        g.shadowBlur = 0;
        g.fillStyle = "rgba(200,205,230,0.7)"; g.font = "500 " + Math.round(cssW * 0.03) + "px system-ui, sans-serif";
        g.fillText("pick a mode", cssW / 2, cssH * 0.28);

        const cards = [
          { id: "timer", title: "Timer", lines: ["30 seconds", "pop as many as you can"], best: bestTimer, hue: HUES[0] },
          { id: "endless", title: "Endless", lines: ["no clock · 3 lives", "ramps up the longer you last"], best: bestEndless, hue: "199,146,255" }
        ];
        menuRects = [];
        const w = cssW * 0.38, h = cssH * 0.32, y = cssH * 0.37, gap = cssW * 0.04;
        const x0 = (cssW - (w * 2 + gap)) / 2;
        const t = performance.now();
        cards.forEach((c, i) => {
          const x = x0 + i * (w + gap);
          menuRects.push({ id: c.id, x: x, y: y, w: w, h: h });
          const breathe = 0.5 + 0.5 * Math.sin(t * 0.002 + i * 1.7);
          g.save();
          g.shadowColor = "rgba(" + c.hue + "," + (0.35 + breathe * 0.25) + ")"; g.shadowBlur = 22 + breathe * 10;
          g.fillStyle = "rgba(" + c.hue + ",0.10)";
          roundRect(x, y, w, h, cssW * 0.025); g.fill();
          g.shadowBlur = 0;
          g.strokeStyle = "rgba(" + c.hue + "," + (0.6 + breathe * 0.3) + ")"; g.lineWidth = 2;
          roundRect(x, y, w, h, cssW * 0.025); g.stroke();
          g.fillStyle = "rgba(" + c.hue + ",0.95)";
          g.font = "800 " + Math.round(cssW * 0.052) + "px system-ui, sans-serif";
          g.fillText(c.title, x + w / 2, y + h * 0.26);
          g.fillStyle = "rgba(230,235,245,0.8)";
          g.font = "500 " + Math.round(cssW * 0.024) + "px system-ui, sans-serif";
          g.fillText(c.lines[0], x + w / 2, y + h * 0.5);
          g.fillText(c.lines[1], x + w / 2, y + h * 0.62);
          g.fillStyle = "rgba(200,205,230,0.6)";
          g.font = "600 " + Math.round(cssW * 0.024) + "px system-ui, sans-serif";
          g.fillText("best " + c.best, x + w / 2, y + h * 0.84);
          g.restore();
        });
      }
      function roundRect(x, y, w, h, r) {
        g.beginPath();
        g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
        g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
        g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
        g.closePath();
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
          hint.textContent = "Squish jelly before it crosses the line · don't click bombs · gold = extra life · Timer or Endless";
          wrap.appendChild(hint);
          stage.appendChild(wrap);

          best = ctx.storage.best();
          bestTimer = ctx.storage.get("best_timer", best);   // legacy best was always timer mode
          bestEndless = ctx.storage.get("best_endless", 0);
          resize();
          reset("timer");
          phase = "menu";
          Arcade.input.setPointerTarget(canvas);
          draw();
          unResize = Arcade.board.onResize(function () { resize(); draw(); });
        },
        handleInput(intent) {
          if (intent.type !== "point" || intent.phase !== "down" || intent.button !== 0) return;
          if (phase === "done") { phase = "menu"; ctx.audio.soft(); return; }
          if (phase === "menu") {
            for (const r of (menuRects || [])) {
              if (intent.x >= r.x && intent.x <= r.x + r.w && intent.y >= r.y && intent.y <= r.y + r.h) {
                reset(r.id);
                ctx.audio.tone(520, 0.12, { type: "sine", vol: 0.12, glide: 780 });
                return;
              }
            }
            return;
          }
          // hit-test topmost blob under the click (generous — jelly is forgiving)
          for (let i = blobs.length - 1; i >= 0; i--) {
            const bl = blobs[i];
            if (bl.dead) continue;
            const dx = intent.x - bl.x, dy = intent.y - bl.y;
            if (dx * dx + dy * dy <= (bl.r * 1.15) * (bl.r * 1.15)) {
              if (bl.kind === "bomb") detonate(bl); else popBlob(bl);
              return;
            }
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
          blobs = drips = toasts = null;
        }
      };
    }
  });
})();
