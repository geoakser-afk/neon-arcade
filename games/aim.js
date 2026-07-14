/* Trace — a neon aim trainer. Pick a MODE and a DIFFICULTY on the canvas,
   then a timed round runs and tracks hits / accuracy / reaction. Five modes:
     Gridshot  — several targets up at once; pop them fast, they respawn.
     Flick     — one target at a time, jumps elsewhere on each hit; avg reaction.
     Tracking  — one target drifts smoothly; keep the cursor on it (time-on-target%).
     Frenzy    — a swarm of targets plus DECOYS you must NOT click (penalty).
     Precision — tiny targets, no clock; clear the set, misses hurt accuracy.
   Difficulty scales size / speed / spawn / duration. Original. */
(function () {
  Arcade.register({
    id: "aim",
    name: "Trace",
    tagline: "Neon aim trainer — flick, track, frenzy.",
    accent: "#6be0c0",
    complexity: "med",
    controls: "mouse",
    scoreLabel: "Hits",
    create() {
      let stageEl, ctx, canvas, g, unResize = null;
      let cssW = 0, cssH = 0, dpr = 1, reduced = false;

      let AR = 107, AG = 224, AB = 192;           // mint accent
      const DEC = "235,108,138";                  // decoy rose

      // phase: "select" | "play" | "results"
      let phase = "select";
      let now = 0;                                 // running ms clock
      let selDiff = "med";
      let mode = null;

      // round state
      let targets = [], particles = [], cursorGlow = 0;   // init so update() is safe on the select screen
      let roundLeft, roundDur, timed;
      let hits, misses, streak, bestStreak;
      let reactions, lastSpawnAt;                  // flick
      let onTargetMs;                              // tracking
      let goal, cleared;                           // precision
      let mx = 0, my = 0, haveCursor = false;
      let lastPrimary = 0, lastBest = 0;
      let flashT = 0;

      const MODES = [
        { id: "grid", name: "Gridshot", blurb: "pop targets fast" },
        { id: "flick", name: "Flick", blurb: "one at a time" },
        { id: "track", name: "Tracking", blurb: "stay on it" },
        { id: "frenzy", name: "Frenzy", blurb: "dodge decoys" },
        { id: "precision", name: "Precision", blurb: "tiny · no clock" }
      ];
      const DIFFS = ["easy", "med", "hard"];
      const DIFF_LABEL = { easy: "Easy", med: "Medium", hard: "Hard" };

      function acc(a) { return "rgba(" + AR + "," + AG + "," + AB + "," + a + ")"; }
      function dec(a) { return "rgba(" + DEC + "," + a + ")"; }
      function hexToRgb(hex) {
        const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
        if (!m) return null;
        const n = parseInt(m[1], 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      }

      function resize() {
        const w = Arcade.board.stageSize(920, 0.72);
        cssW = Math.round(w);
        cssH = Math.round(w * 0.72);
        dpr = window.devicePixelRatio || 1;
        canvas.style.width = cssW + "px";
        canvas.style.height = cssH + "px";
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      // ---- difficulty config per mode ----
      function cfg() {
        const D = { easy: 0, med: 1, hard: 2 }[selDiff];
        const b = Math.min(cssW, cssH);
        switch (mode) {
          case "grid":
            return { timed: true, dur: [35000, 30000, 30000][D], count: [4, 6, 8][D], rad: b * [0.058, 0.044, 0.033][D] };
          case "flick":
            return { timed: true, dur: [35000, 30000, 30000][D], rad: b * [0.062, 0.046, 0.034][D] };
          case "track":
            return { timed: true, dur: 30000, rad: b * [0.078, 0.06, 0.046][D], speed: b * [0.00017, 0.00028, 0.00044][D], turn: [0.0010, 0.0018, 0.0028][D] };
          case "frenzy":
            return { timed: true, dur: [35000, 30000, 30000][D], count: [5, 7, 9][D], decoy: [0.30, 0.38, 0.46][D], rad: b * [0.052, 0.041, 0.033][D] };
          case "precision":
            return { timed: false, goal: [14, 20, 26][D], rad: b * [0.042, 0.032, 0.024][D] };
        }
      }

      // ---- targets ----
      function rndPos(r) {
        const pad = r + Math.min(cssW, cssH) * 0.04;
        return {
          x: pad + Math.random() * (cssW - pad * 2),
          y: pad + Math.random() * (cssH - pad * 2)
        };
      }
      function makeTarget(r, kind) {
        const p = rndPos(r);
        const t = { x: p.x, y: p.y, r: r, born: now, kind: kind || "good", appear: 0 };
        if (mode === "track") {
          const h = Math.random() * Math.PI * 2;
          t.heading = h;
        }
        return t;
      }
      function farPos(r) {
        // for flick: place away from current target so it's a real flick
        let best = null, bestD = -1;
        for (let i = 0; i < 8; i++) {
          const p = rndPos(r);
          const prev = targets[0];
          const d = prev ? (p.x - prev.x) ** 2 + (p.y - prev.y) ** 2 : Infinity;
          if (d > bestD) { bestD = d; best = p; }
        }
        return best;
      }

      function startRound(m, d) {
        mode = m; selDiff = d;
        const c = cfg();
        phase = "play";
        targets = []; particles = []; cursorGlow = 0;
        hits = 0; misses = 0; streak = 0; bestStreak = 0;
        reactions = []; onTargetMs = 0; cleared = 0; flashT = 0;
        timed = c.timed;
        roundDur = c.timed ? c.dur : 0;
        roundLeft = roundDur;
        goal = c.goal || 0;
        lastSpawnAt = now;

        if (m === "grid" || m === "frenzy") {
          for (let i = 0; i < c.count; i++) spawnFor(c);
        } else if (m === "flick") {
          const p = farPos(c.rad);
          targets.push({ x: p.x, y: p.y, r: c.rad, born: now, kind: "good", appear: 0 });
        } else if (m === "track") {
          targets.push(makeTarget(c.rad, "good"));
        } else if (m === "precision") {
          targets.push(makeTarget(c.rad, "good"));
        }
        ctx.audio.start();
        ctx.setScore(0);
      }

      function spawnFor(c) {
        let kind = "good";
        if (mode === "frenzy" && Math.random() < c.decoy) kind = "decoy";
        targets.push(makeTarget(c.rad, kind));
      }

      function burst(x, y, col, n) {
        const count = reduced ? Math.round(n * 0.4) : n;
        for (let i = 0; i < count; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 0.06 + Math.random() * 0.22;
          particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, max: 1, r: 1.5 + Math.random() * 3, col });
        }
      }

      function hitTone() {
        const f = 380 * Math.pow(1.045, Math.min(28, streak));
        ctx.audio.tone(f, 0.08, { type: "sine", vol: 0.13 });
      }
      function missTone() { ctx.audio.tone(150, 0.12, { type: "triangle", vol: 0.07, glide: 108 }); }
      function decoyTone() { ctx.audio.thunk(); }

      function onGood(t, c) {
        hits++;
        streak++;
        if (streak > bestStreak) bestStreak = streak;
        burst(t.x, t.y, null, reduced ? 8 : 16);
        hitTone();
        flashT = 1;
        ctx.setScore(hits);
        if (mode === "flick") {
          reactions.push(now - t.born);
          const p = farPos(c.rad);
          targets[0] = { x: p.x, y: p.y, r: c.rad, born: now, kind: "good", appear: 0 };
        } else if (mode === "precision") {
          cleared++;
          if (cleared >= goal) { endRound(); return; }
          const nt = makeTarget(c.rad, "good");
          targets[0] = nt;
        } else {
          // grid / frenzy: remove and refill
          const i = targets.indexOf(t);
          if (i >= 0) targets.splice(i, 1);
          spawnFor(c);
        }
      }

      function onDecoy(t, c) {
        misses++;                    // counts against accuracy
        hits = Math.max(0, hits - 1);
        streak = 0;
        ctx.setScore(hits);
        decoyTone();
        burst(t.x, t.y, "decoy", reduced ? 8 : 14);
        const i = targets.indexOf(t);
        if (i >= 0) targets.splice(i, 1);
        spawnFor(c);
      }

      function shoot(x, y) {
        const c = cfg();
        // topmost target hit wins (search from end)
        for (let i = targets.length - 1; i >= 0; i--) {
          const t = targets[i];
          const dx = x - t.x, dy = y - t.y;
          if (dx * dx + dy * dy <= t.r * t.r) {
            if (t.kind === "decoy") onDecoy(t, c);
            else onGood(t, c);
            return;
          }
        }
        // empty click = miss
        misses++;
        streak = 0;
        missTone();
      }

      function endRound() {
        phase = "results";
        // primary metric per mode
        if (mode === "track") lastPrimary = Math.round(onTargetMs / 1000);
        else lastPrimary = hits;
        const key = "best:" + mode + ":" + selDiff;
        lastBest = ctx.storage.get(key, 0);
        if (lastPrimary > lastBest) { lastBest = lastPrimary; ctx.storage.set(key, lastPrimary); }
        ctx.storage.recordScore(lastPrimary);
        ctx.audio.score();
      }

      function accuracy() {
        const shots = hits + misses;
        return shots ? Math.round((hits / shots) * 100) : 100;
      }

      // ---- update ----
      function update(dt) {
        now += dt;
        if (flashT > 0) flashT = Math.max(0, flashT - dt * 0.004);
        if (cursorGlow > 0) cursorGlow = Math.max(0, cursorGlow - dt * 0.006);

        // particles always animate
        for (const p of particles) {
          p.x += p.vx * dt; p.y += p.vy * dt;
          p.vx *= 0.96; p.vy *= 0.96;
          p.life -= dt * 0.0022;
        }
        for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);

        if (phase !== "play") return;

        // target appear ease + tracking motion
        const c = cfg();
        for (const t of targets) {
          if (t.appear < 1) t.appear = Math.min(1, t.appear + dt * 0.006);
        }
        if (mode === "track" && targets[0]) {
          const t = targets[0];
          t.heading += (Math.random() - 0.5) * c.turn * dt;
          t.x += Math.cos(t.heading) * c.speed * dt;
          t.y += Math.sin(t.heading) * c.speed * dt;
          const pad = t.r + 4;
          if (t.x < pad) { t.x = pad; t.heading = Math.PI - t.heading; }
          if (t.x > cssW - pad) { t.x = cssW - pad; t.heading = Math.PI - t.heading; }
          if (t.y < pad) { t.y = pad; t.heading = -t.heading; }
          if (t.y > cssH - pad) { t.y = cssH - pad; t.heading = -t.heading; }
          // score on-target time
          if (haveCursor) {
            const dx = mx - t.x, dy = my - t.y;
            if (dx * dx + dy * dy <= t.r * t.r) {
              onTargetMs += dt;
              streak++;
              cursorGlow = 1;
              if (Math.floor(onTargetMs / 1000) > Math.floor((onTargetMs - dt) / 1000)) ctx.audio.tick();
            } else {
              streak = 0;
            }
            if (streak > bestStreak) bestStreak = streak;
            ctx.setScore(Math.round(onTargetMs / 1000));
          }
        }

        if (timed) {
          roundLeft -= dt;
          if (roundLeft <= 0) { roundLeft = 0; endRound(); return; }
        }
      }

      // ---- drawing ----
      function bg() {
        g.clearRect(0, 0, cssW, cssH);
        const grd = g.createLinearGradient(0, 0, 0, cssH);
        grd.addColorStop(0, "rgba(8,16,18,1)");
        grd.addColorStop(1, "rgba(5,10,12,1)");
        g.fillStyle = grd; g.fillRect(0, 0, cssW, cssH);
        // faint grid
        g.strokeStyle = acc(0.05); g.lineWidth = 1;
        const step = Math.min(cssW, cssH) / 12;
        for (let x = step; x < cssW; x += step) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, cssH); g.stroke(); }
        for (let y = step; y < cssH; y += step) { g.beginPath(); g.moveTo(0, y); g.lineTo(cssW, y); g.stroke(); }
      }

      function drawParticles() {
        for (const p of particles) {
          const isDecoy = p.col === "decoy";
          g.globalAlpha = Math.max(0, p.life);
          g.fillStyle = isDecoy ? dec(0.9) : acc(0.9);
          g.beginPath(); g.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2); g.fill();
        }
        g.globalAlpha = 1;
      }

      function drawTarget(t) {
        const isDecoy = t.kind === "decoy";
        const col = isDecoy ? DEC : AR + "," + AG + "," + AB;
        const r = t.r * (0.6 + t.appear * 0.4);
        const pulse = reduced ? 1 : 0.9 + Math.sin(now * 0.006 + t.born) * 0.1;
        g.save();
        g.shadowColor = "rgba(" + col + ",0.8)";
        g.shadowBlur = 22 * pulse;
        // outer ring
        const gr = g.createRadialGradient(t.x, t.y, r * 0.1, t.x, t.y, r);
        gr.addColorStop(0, "rgba(" + col + ",0.95)");
        gr.addColorStop(0.55, "rgba(" + col + ",0.5)");
        gr.addColorStop(1, "rgba(" + col + ",0)");
        g.globalAlpha = t.appear;
        g.fillStyle = gr;
        g.beginPath(); g.arc(t.x, t.y, r, 0, Math.PI * 2); g.fill();
        // core
        g.shadowBlur = 8;
        g.fillStyle = isDecoy ? "rgba(30,8,14,0.92)" : "rgba(8,20,18,0.92)";
        g.beginPath(); g.arc(t.x, t.y, r * 0.42, 0, Math.PI * 2); g.fill();
        g.lineWidth = 2;
        g.strokeStyle = "rgba(" + col + ",0.9)";
        g.beginPath(); g.arc(t.x, t.y, r * 0.42, 0, Math.PI * 2); g.stroke();
        if (isDecoy) {
          // X mark = don't click
          g.strokeStyle = dec(0.95); g.lineWidth = 2.5;
          const s = r * 0.22;
          g.beginPath(); g.moveTo(t.x - s, t.y - s); g.lineTo(t.x + s, t.y + s);
          g.moveTo(t.x + s, t.y - s); g.lineTo(t.x - s, t.y + s); g.stroke();
        }
        g.restore();
      }

      function drawCursor() {
        if (!haveCursor) return;
        const on = cursorGlow;
        g.save();
        g.strokeStyle = acc(0.5 + on * 0.4);
        if (on > 0) { g.shadowColor = acc(0.7); g.shadowBlur = 12; }
        g.lineWidth = 1.6;
        const s = Math.min(cssW, cssH) * 0.018;
        g.beginPath();
        g.moveTo(mx - s, my); g.lineTo(mx - s * 0.35, my);
        g.moveTo(mx + s * 0.35, my); g.lineTo(mx + s, my);
        g.moveTo(mx, my - s); g.lineTo(mx, my - s * 0.35);
        g.moveTo(mx, my + s * 0.35); g.lineTo(mx, my + s);
        g.stroke();
        g.fillStyle = acc(0.9);
        g.beginPath(); g.arc(mx, my, 1.6, 0, Math.PI * 2); g.fill();
        g.restore();
      }

      function drawHUD() {
        const pad = cssW * 0.03;
        const fs = Math.round(Math.min(cssW, cssH) * 0.032);
        g.font = "800 " + fs + "px system-ui, sans-serif";
        g.textBaseline = "top";
        // left: hits (or on-target for tracking)
        g.textAlign = "left";
        g.fillStyle = acc(0.95);
        if (mode === "track") g.fillText("ON TARGET " + Math.round(onTargetMs / 1000) + "s", pad, pad);
        else g.fillText("HITS " + hits, pad, pad);
        // center: streak
        g.textAlign = "center";
        g.fillStyle = streak > 1 ? acc(0.6 + Math.min(0.4, streak * 0.04)) : acc(0.4);
        const streakTxt = mode === "track" ? "" : (streak > 1 ? "x" + streak : "");
        if (streakTxt) g.fillText(streakTxt, cssW / 2, pad);
        // right: timer or progress
        g.textAlign = "right";
        if (timed) {
          const sec = roundLeft / 1000;
          g.fillStyle = sec <= 5 ? "rgba(235,108,138,0.95)" : acc(0.85);
          g.fillText(sec.toFixed(1) + "s", cssW - pad, pad);
        } else {
          g.fillStyle = acc(0.85);
          g.fillText(cleared + " / " + goal, cssW - pad, pad);
        }
        // second line: accuracy
        const fs2 = Math.round(Math.min(cssW, cssH) * 0.024);
        g.font = "700 " + fs2 + "px system-ui, sans-serif";
        g.textAlign = "left";
        g.fillStyle = acc(0.55);
        g.fillText("ACC " + accuracy() + "%", pad, pad + fs * 1.2);
      }

      // ---- select screen ----
      function diffRects() {
        const w = cssW * 0.2, h = cssH * 0.09, gap = cssW * 0.02;
        const totalW = w * 3 + gap * 2;
        const x0 = (cssW - totalW) / 2, y = cssH * 0.26;
        return DIFFS.map((d, i) => ({ d, rect: { x: x0 + i * (w + gap), y, w, h } }));
      }
      function modeRects() {
        const cols = Math.min(5, MODES.length);
        const w = cssW * 0.165, h = cssH * 0.30, gap = cssW * 0.018;
        const totalW = w * cols + gap * (cols - 1);
        const x0 = (cssW - totalW) / 2, y = cssH * 0.46;
        return MODES.map((m, i) => ({ m, rect: { x: x0 + i * (w + gap), y, w, h } }));
      }

      function drawRR(x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        g.beginPath();
        g.moveTo(x + r, y);
        g.arcTo(x + w, y, x + w, y + h, r);
        g.arcTo(x + w, y + h, x, y + h, r);
        g.arcTo(x, y + h, x, y, r);
        g.arcTo(x, y, x + w, y, r);
        g.closePath();
      }

      function drawSelect() {
        bg();
        g.textAlign = "center"; g.textBaseline = "middle";
        g.fillStyle = acc(0.95);
        g.font = "800 " + Math.round(Math.min(cssW, cssH) * 0.075) + "px system-ui, sans-serif";
        g.save(); g.shadowColor = acc(0.5); g.shadowBlur = 24;
        g.fillText("TRACE", cssW / 2, cssH * 0.12); g.restore();
        g.fillStyle = acc(0.5);
        g.font = "600 " + Math.round(Math.min(cssW, cssH) * 0.028) + "px system-ui, sans-serif";
        g.fillText("difficulty", cssW / 2, cssH * 0.2);

        diffRects().forEach(function (o) {
          const on = o.d === selDiff;
          g.save();
          drawRR(o.rect.x, o.rect.y, o.rect.w, o.rect.h, 10);
          g.fillStyle = on ? acc(0.18) : "rgba(14,24,26,0.9)";
          g.fill();
          if (on) { g.shadowColor = acc(0.5); g.shadowBlur = 14; }
          g.strokeStyle = on ? acc(0.85) : acc(0.25); g.lineWidth = 2;
          drawRR(o.rect.x, o.rect.y, o.rect.w, o.rect.h, 10); g.stroke();
          g.restore();
          g.fillStyle = on ? acc(0.98) : acc(0.6);
          g.font = "700 " + Math.round(o.rect.h * 0.34) + "px system-ui, sans-serif";
          g.fillText(DIFF_LABEL[o.d], o.rect.x + o.rect.w / 2, o.rect.y + o.rect.h / 2);
        });

        g.fillStyle = acc(0.5);
        g.font = "600 " + Math.round(Math.min(cssW, cssH) * 0.028) + "px system-ui, sans-serif";
        g.fillText("pick a mode to start", cssW / 2, cssH * 0.4);

        modeRects().forEach(function (o) {
          const r = o.rect;
          const key = "best:" + o.m.id + ":" + selDiff;
          const bst = ctx.storage.get(key, 0);
          g.save();
          drawRR(r.x, r.y, r.w, r.h, 12);
          g.fillStyle = "rgba(12,22,24,0.95)"; g.fill();
          g.shadowColor = acc(0.4); g.shadowBlur = 12;
          g.strokeStyle = acc(0.45); g.lineWidth = 2;
          drawRR(r.x, r.y, r.w, r.h, 12); g.stroke();
          g.restore();
          // mini preview dot
          g.save();
          g.shadowColor = acc(0.7); g.shadowBlur = 16;
          g.fillStyle = acc(0.9);
          g.beginPath(); g.arc(r.x + r.w / 2, r.y + r.h * 0.3, r.w * 0.12, 0, Math.PI * 2); g.fill();
          g.restore();
          g.textAlign = "center"; g.textBaseline = "middle";
          g.fillStyle = acc(0.95);
          g.font = "800 " + Math.round(r.w * 0.15) + "px system-ui, sans-serif";
          g.fillText(o.m.name, r.x + r.w / 2, r.y + r.h * 0.58);
          g.fillStyle = acc(0.5);
          g.font = "600 " + Math.round(r.w * 0.1) + "px system-ui, sans-serif";
          g.fillText(o.m.blurb, r.x + r.w / 2, r.y + r.h * 0.72);
          g.fillStyle = acc(0.7);
          g.font = "700 " + Math.round(r.w * 0.1) + "px system-ui, sans-serif";
          g.fillText("best " + bst, r.x + r.w / 2, r.y + r.h * 0.87);
        });
      }

      // ---- results screen ----
      function resultRects() {
        const w = cssW * 0.26, h = cssH * 0.1, gap = cssW * 0.03;
        const totalW = w * 2 + gap;
        const x0 = (cssW - totalW) / 2, y = cssH * 0.74;
        return {
          again: { x: x0, y, w, h },
          change: { x: x0 + w + gap, y, w, h }
        };
      }

      function drawResults() {
        bg();
        drawParticles();
        g.textAlign = "center"; g.textBaseline = "middle";
        const mName = (MODES.find(m => m.id === mode) || {}).name || "";
        g.fillStyle = acc(0.9);
        g.font = "700 " + Math.round(Math.min(cssW, cssH) * 0.032) + "px system-ui, sans-serif";
        g.fillText(mName + " · " + DIFF_LABEL[selDiff], cssW / 2, cssH * 0.13);

        g.save(); g.shadowColor = acc(0.5); g.shadowBlur = 24;
        g.fillStyle = acc(0.98);
        g.font = "800 " + Math.round(Math.min(cssW, cssH) * 0.11) + "px system-ui, sans-serif";
        const big = mode === "track" ? Math.round(onTargetMs / 1000) + "s" : String(hits);
        g.fillText(big, cssW / 2, cssH * 0.3);
        g.restore();
        g.fillStyle = acc(0.5);
        g.font = "600 " + Math.round(Math.min(cssW, cssH) * 0.028) + "px system-ui, sans-serif";
        g.fillText(mode === "track" ? "time on target" : "hits", cssW / 2, cssH * 0.4);

        // detail line
        const parts = [];
        if (mode === "track") {
          const pct = roundDur ? Math.round((onTargetMs / roundDur) * 100) : 0;
          parts.push(pct + "% on target");
        } else {
          parts.push(accuracy() + "% accuracy");
        }
        if (mode === "flick") {
          const avg = reactions.length ? Math.round(reactions.reduce((a, b) => a + b, 0) / reactions.length) : 0;
          parts.push(avg + "ms avg reaction");
        } else if (mode === "precision") {
          parts.push(accuracy() + "% — misses hurt");
        } else if (mode !== "track") {
          parts.push("best streak x" + bestStreak);
        }
        g.fillStyle = acc(0.8);
        g.font = "700 " + Math.round(Math.min(cssW, cssH) * 0.03) + "px system-ui, sans-serif";
        g.fillText(parts.join("   ·   "), cssW / 2, cssH * 0.5);

        g.fillStyle = lastPrimary >= lastBest && lastPrimary > 0 ? acc(0.9) : acc(0.45);
        g.font = "700 " + Math.round(Math.min(cssW, cssH) * 0.026) + "px system-ui, sans-serif";
        g.fillText((lastPrimary >= lastBest && lastPrimary > 0 ? "NEW BEST · " : "best ") + lastBest, cssW / 2, cssH * 0.58);

        const rr = resultRects();
        [["again", "▶ Play again", true], ["change", "⟲ Change mode", false]].forEach(function (b) {
          const r = rr[b[0]];
          g.save();
          drawRR(r.x, r.y, r.w, r.h, 10);
          g.fillStyle = b[2] ? acc(0.2) : "rgba(14,24,26,0.9)";
          g.fill();
          if (b[2]) { g.shadowColor = acc(0.5); g.shadowBlur = 14; }
          g.strokeStyle = acc(b[2] ? 0.85 : 0.4); g.lineWidth = 2;
          drawRR(r.x, r.y, r.w, r.h, 10); g.stroke();
          g.restore();
          g.fillStyle = acc(0.95);
          g.font = "700 " + Math.round(r.h * 0.32) + "px system-ui, sans-serif";
          g.fillText(b[1], r.x + r.w / 2, r.y + r.h / 2);
        });
      }

      function draw() {
        if (phase === "select") { drawSelect(); return; }
        if (phase === "results") { drawResults(); return; }
        bg();
        for (const t of targets) drawTarget(t);
        drawParticles();
        if (flashT > 0) {
          g.fillStyle = acc(flashT * 0.06);
          g.fillRect(0, 0, cssW, cssH);
        }
        drawCursor();
        drawHUD();
      }

      function inRect(r, x, y) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }

      return {
        mount(stage, c) {
          stageEl = stage; ctx = c;
          reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          const rgb = hexToRgb(ctx.accent);
          if (rgb) { AR = rgb[0]; AG = rgb[1]; AB = rgb[2]; }

          const wrap = document.createElement("div");
          wrap.style.display = "flex"; wrap.style.flexDirection = "column"; wrap.style.alignItems = "center";
          canvas = document.createElement("canvas");
          canvas.style.borderRadius = "16px";
          canvas.style.background = "rgba(5,10,12,0.9)";
          canvas.style.boxShadow = "0 0 46px rgba(107,224,192,0.12)";
          canvas.style.cursor = "crosshair";
          g = canvas.getContext("2d");
          wrap.appendChild(canvas);
          const hint = document.createElement("div");
          hint.className = "hint";
          hint.textContent = "Pick a mode + difficulty, then hit the neon targets. Don't click the marked decoys.";
          wrap.appendChild(hint);
          stage.appendChild(wrap);

          resize();
          phase = "select";
          Arcade.input.setPointerTarget(canvas);
          draw();
          unResize = Arcade.board.onResize(function () { resize(); draw(); });
        },

        handleInput(intent) {
          if (intent.type !== "point") return;
          if (intent.x != null) { mx = intent.x; my = intent.y; haveCursor = true; }
          if (intent.phase === "down") {
            if (intent.button !== 0) return;
            const x = intent.x, y = intent.y;
            if (phase === "select") {
              const d = diffRects().find(o => inRect(o.rect, x, y));
              if (d) { selDiff = d.d; ctx.audio.pick(); draw(); return; }
              const m = modeRects().find(o => inRect(o.rect, x, y));
              if (m) { startRound(m.m.id, selDiff); }
              return;
            }
            if (phase === "results") {
              const rr = resultRects();
              if (inRect(rr.again, x, y)) { startRound(mode, selDiff); return; }
              if (inRect(rr.change, x, y)) { phase = "select"; ctx.audio.pick(); return; }
              return;
            }
            // play
            shoot(x, y);
          }
        },

        tick(dt) { update(dt); draw(); },

        pause() { },
        resume() { },

        teardown() {
          if (unResize) unResize();
          unResize = null;
          stageEl = ctx = canvas = g = null;
          targets = particles = null;
        }
      };
    }
  });
})();
