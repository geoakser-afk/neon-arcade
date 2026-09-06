/* Fireworks — made for Christopher (age 5). A sleepy night city under a
   twinkling sky. Tap anywhere: a rocket whistles up from the rooftops and
   bursts where you tapped — spheres, rings, hearts, drooping willows and
   crackling sparklers in single, two-tone or rainbow colors. The sky is never
   boring (a small firework pops on its own every few seconds) and every 10 taps
   brings a giant golden finale. Nothing to lose, no clock — just booms. */
(function () {
  const HUES = [0, 30, 55, 120, 200, 260, 320];
  function col(h, l, a) { return "hsla(" + h + ",100%," + (l == null ? 65 : l) + "%," + (a == null ? 1 : a) + ")"; }

  function drawBurstIcon(g, cx, cy, R, arms, lw) {
    g.save(); g.translate(cx, cy);
    g.lineCap = "round"; g.lineWidth = lw; g.strokeStyle = "#ffd36b"; g.shadowColor = "#ffd36b"; g.shadowBlur = R * 0.35;
    for (let i = 0; i < arms; i++) {
      const a = i * Math.PI * 2 / arms, r = R * (i % 2 ? 0.72 : 1);
      g.beginPath(); g.moveTo(Math.cos(a) * R * 0.18, Math.sin(a) * R * 0.18); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); g.stroke();
      g.fillStyle = i % 2 ? "#ffffff" : "#ffe9a8"; g.beginPath(); g.arc(Math.cos(a) * r, Math.sin(a) * r, lw * 1.4, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = "#fff6d6"; g.beginPath(); g.arc(0, 0, lw * 1.6, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  function drawSkylineShape(g, buildings, yBase, S) {
    g.save();
    buildings.forEach(function (b) {
      g.fillStyle = "#0d0b18"; g.fillRect(b.x, yBase - b.h, b.w, b.h + S * 0.02);
      g.fillStyle = "rgba(255,211,107,0.55)";
      b.win.forEach(function (w) { if (w.on) g.fillRect(b.x + w.x, yBase - b.h + w.y, w.s, w.s); });
    });
    g.restore();
  }
  function makeBuildings(S, yBase, seed) {
    const out = []; let x = 0, k = seed;
    const rnd = function () { k = (k * 9301 + 49297) % 233280; return k / 233280; };
    while (x < S) {
      const w = S * (0.06 + rnd() * 0.09), h = S * (0.06 + rnd() * 0.16);
      const win = [], s = Math.max(3, S * 0.012);
      for (let wy = s * 1.5; wy < h - s; wy += s * 2.4) for (let wx = s; wx < w - s * 1.5; wx += s * 2.2) if (rnd() < 0.55) win.push({ x: wx, y: wy, s: s, on: true, ph: rnd() * 6.28 });
      out.push({ x: x, w: w, h: h, win: win });
      x += w + S * 0.006;
    }
    return out;
  }

  Arcade.register({
    id: "fireworks",
    name: "Fireworks",
    tagline: "Tap the sky. Boom! Sparkle!",
    accent: "#ffd36b",
    complexity: "low",
    controls: "click",
    scoreLabel: "Booms",
    kid: true,
    kidIcon(g, s) {
      const bl = makeBuildings(s, s * 0.98, 7);
      bl.forEach(function (b) { b.h *= 0.55; });
      drawSkylineShape(g, bl, s * 0.98, s);
      drawBurstIcon(g, s / 2, s * 0.42, s * 0.34, 12, s * 0.02);
    },
    create() {
      let stageEl, ctx, canvas, g, unResize = null;
      let S = 0, dpr = 1, reduced = false;
      let now = 0, taps = 0, lastSnd = -1000, nextAuto = 2500;
      let stars = [], buildings = [], rockets = [], parts = [], flashes = [];
      let skyBase = 0;

      function resize() {
        S = Arcade.board.stageSize(880);
        dpr = window.devicePixelRatio || 1;
        canvas.style.width = S + "px"; canvas.style.height = S + "px";
        canvas.width = Math.round(S * dpr); canvas.height = Math.round(S * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        skyBase = S * 0.97;
        buildings = makeBuildings(S, skyBase, 42);
        stars = [];
        for (let i = 0; i < 70; i++) stars.push({ x: Math.random() * S, y: Math.random() * S * 0.75, r: S * (0.0015 + Math.random() * 0.0025), ph: Math.random() * 6.28, sp: 0.001 + Math.random() * 0.002 });
      }

      // ---- sound (rate-limited so mashing stays gentle) ----
      function canSound() { if (now - lastSnd < 80) return false; lastSnd = now; return true; }
      function whistle() { if (canSound()) ctx.audio.tone(300, 0.5, { type: "sine", vol: 0.05, glide: 1200, attack: 0.05 }); }
      function boomSound(big) {
        if (!canSound()) return;
        ctx.audio.tone(90, 0.3, { type: "sine", vol: big ? 0.2 : 0.14, glide: 40 });
        const n = big ? 9 : 5;
        for (let i = 0; i < n; i++) ctx.audio.tone(1400 + Math.random() * 1800, 0.05, { type: "sine", vol: 0.05, when: 0.05 + i * 0.045 + Math.random() * 0.03 });
      }

      // ---- fireworks ----
      function pickScheme() {
        const r = Math.random();
        if (r < 0.4) { const h = HUES[Math.floor(Math.random() * HUES.length)]; return function () { return h; }; }
        if (r < 0.75) { const a = HUES[Math.floor(Math.random() * HUES.length)], b = (a + 120 + Math.floor(Math.random() * 120)) % 360; return function (i) { return i % 2 ? a : b; }; }
        return function (i, n) { return (i / n) * 360; };
      }
      function launch(tx, ty, opts) {
        opts = opts || {};
        // rocket starts on a rooftop near the tap
        let best = buildings[0], bd = Infinity;
        buildings.forEach(function (b) { const d = Math.abs(b.x + b.w / 2 - tx); if (d < bd) { bd = d; best = b; } });
        const sx = best.x + best.w / 2, sy = skyBase - best.h;
        rockets.push({ sx: sx, sy: sy, tx: tx, ty: ty, x: sx, y: sy, t: 0, dur: 420 + Math.random() * 180, trail: [], hue: opts.gold ? 45 : HUES[Math.floor(Math.random() * HUES.length)], small: !!opts.small, gold: !!opts.gold, shape: opts.gold ? "sphere" : ["sphere", "ring", "heart", "willow", "crackle"][Math.floor(Math.random() * 5)] });
        if (!opts.small) whistle();
      }
      function spawn(x, y, vx, vy, hue, extra) {
        const p = { x: x, y: y, vx: vx, vy: vy, hue: hue, life: 1, decay: 1 / (900 + Math.random() * 600), grav: S * 0.0000012, drag: 0.0015, r: S * (0.004 + Math.random() * 0.004), light: 65, crackle: 0, tw: 0 };
        if (extra) for (const k in extra) p[k] = extra[k];
        parts.push(p);
      }
      function burst(r) {
        const x = r.tx, y = r.ty, scheme = r.gold ? function () { return 45; } : pickScheme();
        const big = r.gold, n = big ? 160 : (r.small ? 45 : 60 + Math.floor(Math.random() * 60));
        const speed = S * (big ? 0.0006 : r.small ? 0.0003 : 0.00035 + Math.random() * 0.00015);
        flashes.push({ x: x, y: y, hue: scheme(0, 1), life: 1, r: S * (big ? 0.25 : 0.12) });
        for (let i = 0; i < n; i++) {
          const h = scheme(i, n), a = (i / n) * Math.PI * 2 + Math.random() * 0.1;
          if (r.shape === "sphere") { const sp = speed * (0.35 + Math.random() * 0.7); spawn(x, y, Math.cos(a) * sp, Math.sin(a) * sp, h, big ? { decay: 1 / 2000, light: 75, tw: 1 } : null); }
          else if (r.shape === "ring") { spawn(x, y, Math.cos(a) * speed, Math.sin(a) * speed * 0.85, h, { grav: S * 0.0000006 }); }
          else if (r.shape === "heart") {
            const t = (i / n) * Math.PI * 2, hx = 16 * Math.pow(Math.sin(t), 3), hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
            spawn(x, y, hx / 16 * speed * 0.9, hy / 16 * speed * 0.9, i % 2 ? 340 : 320, { grav: S * 0.0000005, decay: 1 / 1400 });
          }
          else if (r.shape === "willow") { const sp = speed * (0.6 + Math.random() * 0.5); spawn(x, y, Math.cos(a) * sp, Math.sin(a) * sp - speed * 0.2, 45, { grav: S * 0.0000025, drag: 0.003, decay: 1 / 2200, light: 70, r: S * 0.0035 }); }
          else { const sp = speed * (0.4 + Math.random() * 0.6); spawn(x, y, Math.cos(a) * sp, Math.sin(a) * sp, h, { crackle: 300 + Math.random() * 500, decay: 1 / 1000 }); }
        }
        boomSound(big);
        if (big) ctx.audio.arp([523, 659, 784, 1046, 1318, 1568], { dur: 0.22, step: 0.08, vol: 0.12, type: "sine", when: 0.15 });
      }

      function tap(x, y) {
        taps++; ctx.setScore(taps);
        const gold = taps % 10 === 0;
        launch(x, Math.min(y, S * 0.8), { gold: gold });
        if (gold) { launch(x - S * 0.2, Math.min(y, S * 0.8) + S * 0.05, { small: true }); launch(x + S * 0.2, Math.min(y, S * 0.8) + S * 0.05, { small: true }); }
      }

      function update(dt) {
        now += dt;
        nextAuto -= dt;
        if (nextAuto <= 0) { launch(S * (0.15 + Math.random() * 0.7), S * (0.15 + Math.random() * 0.4), { small: true }); nextAuto = 3200 + Math.random() * 1800; }
        for (let i = rockets.length - 1; i >= 0; i--) {
          const r = rockets[i]; r.t += dt;
          const u = Math.min(1, r.t / r.dur), e = 1 - Math.pow(1 - u, 2);
          r.x = r.sx + (r.tx - r.sx) * e + Math.sin(u * 9) * S * 0.006 * (1 - u);
          r.y = r.sy + (r.ty - r.sy) * e;
          r.trail.push({ x: r.x, y: r.y }); if (r.trail.length > 14) r.trail.shift();
          if (u >= 1) { burst(r); rockets.splice(i, 1); }
        }
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i];
          p.vy += p.grav * dt; const d = Math.max(0, 1 - p.drag * dt); p.vx *= d; p.vy *= d;
          p.x += p.vx * dt; p.y += p.vy * dt; p.life -= p.decay * dt;
          if (p.crackle > 0) { p.crackle -= dt; if (p.crackle <= 0 && !reduced) { for (let k = 0; k < 3; k++) { const a = Math.random() * 6.28, sp = S * 0.00012; spawn(p.x, p.y, Math.cos(a) * sp, Math.sin(a) * sp, p.hue, { decay: 1 / 350, r: S * 0.0025, light: 85 }); } p.life = Math.min(p.life, 0.15); } }
          if (p.life <= 0 || p.y > skyBase) parts.splice(i, 1);
        }
        for (let i = flashes.length - 1; i >= 0; i--) { flashes[i].life -= dt / 260; if (flashes[i].life <= 0) flashes.splice(i, 1); }
        if (parts.length > 900) parts.splice(0, parts.length - 900);
      }

      function draw() {
        g.clearRect(0, 0, S, S);
        const sky = g.createLinearGradient(0, 0, 0, S);
        sky.addColorStop(0, "#07061a"); sky.addColorStop(0.7, "#141030"); sky.addColorStop(1, "#2a1e40");
        g.fillStyle = sky; g.fillRect(0, 0, S, S);
        // stars twinkle
        stars.forEach(function (s) { const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(now * s.sp + s.ph)); g.fillStyle = "rgba(255,255,255," + a + ")"; g.beginPath(); g.arc(s.x, s.y, s.r * (0.8 + a * 0.5), 0, Math.PI * 2); g.fill(); });
        // moon
        g.save(); g.fillStyle = "#fff3cf"; g.shadowColor = "#fff3cf"; g.shadowBlur = S * 0.03; g.beginPath(); g.arc(S * 0.84, S * 0.16, S * 0.045, 0, Math.PI * 2); g.fill(); g.restore();
        // flashes (soft light bloom at burst)
        g.save(); g.globalCompositeOperation = "lighter";
        flashes.forEach(function (f) { const gr = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * (1.3 - f.life * 0.3)); gr.addColorStop(0, col(f.hue, 80, f.life * 0.45)); gr.addColorStop(1, col(f.hue, 60, 0)); g.fillStyle = gr; g.beginPath(); g.arc(f.x, f.y, f.r * 1.3, 0, Math.PI * 2); g.fill(); });
        // rockets + trails
        rockets.forEach(function (r) {
          g.lineCap = "round";
          for (let i = 1; i < r.trail.length; i++) { const a = i / r.trail.length; g.strokeStyle = col(r.hue, 80, a * 0.7); g.lineWidth = S * 0.004 * a + 1; g.beginPath(); g.moveTo(r.trail[i - 1].x, r.trail[i - 1].y); g.lineTo(r.trail[i].x, r.trail[i].y); g.stroke(); }
          g.fillStyle = "#ffffff"; g.shadowColor = col(r.hue, 75); g.shadowBlur = S * 0.015; g.beginPath(); g.arc(r.x, r.y, S * 0.006, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
        });
        // particles — batched: no per-particle shadowBlur (that was the lag). Particles are
        // grouped into hue x alpha buckets and each bucket is ONE path + ONE fill, drawn twice
        // ("lighter" composite): a wide faint disc for glow, then the bright core.
        const buckets = {};
        for (let i = 0; i < parts.length; i++) {
          const p = parts[i];
          const a = Math.max(0, Math.min(1, p.life * 1.4)) * (p.tw ? 0.6 + 0.4 * Math.sin(now * 0.03 + p.x) : 1);
          if (a <= 0.03) continue;
          const key = ((Math.round(p.hue / 15) * 15) % 360) + "_" + p.light + "_" + Math.min(4, Math.floor(a * 5));
          (buckets[key] || (buckets[key] = [])).push(p);
        }
        const keys = Object.keys(buckets);
        for (let pass = 0; pass < 2; pass++) {
          for (let k = 0; k < keys.length; k++) {
            const parts2 = buckets[keys[k]], bits = keys[k].split("_");
            const hue = +bits[0], light = +bits[1], a = (+bits[2] + 0.5) / 5;
            g.fillStyle = col(hue, pass ? light : Math.min(95, light + 10), pass ? a : a * 0.22);
            g.beginPath();
            for (let i = 0; i < parts2.length; i++) { const p = parts2[i], r = p.r * (0.5 + p.life * 0.5) * (pass ? 1 : 2.4); g.moveTo(p.x + r, p.y); g.arc(p.x, p.y, r, 0, Math.PI * 2); }
            g.fill();
          }
        }
        g.restore();
        // skyline (drawn last so fireworks fall behind it)
        buildings.forEach(function (b) { b.win.forEach(function (w) { w.on = Math.sin(now * 0.0007 + w.ph) > -0.6; }); });
        drawSkylineShape(g, buildings, skyBase, S);
        g.fillStyle = "#0d0b18"; g.fillRect(0, skyBase, S, S - skyBase);
        // counter
        g.save(); g.textAlign = "center"; g.textBaseline = "top";
        g.fillStyle = "#ffd36b"; g.shadowColor = "rgba(255,211,107,0.6)"; g.shadowBlur = 16;
        g.font = "800 " + Math.round(S * 0.075) + "px system-ui, sans-serif";
        g.fillText("★ " + taps, S / 2, S * 0.03);
        g.restore();
      }

      return {
        mount(stage, c) {
          stageEl = stage; ctx = c;
          reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          const wrap = document.createElement("div");
          wrap.style.display = "flex"; wrap.style.flexDirection = "column"; wrap.style.alignItems = "center";
          canvas = document.createElement("canvas");
          canvas.style.borderRadius = "18px"; canvas.style.background = "#07061a"; canvas.style.cursor = "pointer";
          canvas.style.boxShadow = "0 0 46px rgba(255,211,107,0.14)"; canvas.style.touchAction = "none";
          g = canvas.getContext("2d");
          wrap.appendChild(canvas);
          const hint = document.createElement("div"); hint.className = "hint";
          hint.textContent = "Tap the sky to launch a firework. Every 10 taps: a golden finale.";
          wrap.appendChild(hint);
          stage.appendChild(wrap);
          now = 0; taps = 0; lastSnd = -1000; nextAuto = 1200; rockets = []; parts = []; flashes = [];
          resize();
          ctx.setScore(0);
          Arcade.input.setPointerTarget(canvas);
          unResize = Arcade.board.onResize(function () { resize(); });
          draw();
        },
        handleInput(intent) {
          if (intent.type !== "point" || intent.phase !== "down" || intent.button !== 0) return;
          tap(intent.x, intent.y);
        },
        tick(dt) { update(Math.min(50, dt)); draw(); },
        getScore() { return taps; },
        teardown() {
          if (unResize) unResize(); unResize = null;
          stageEl = ctx = canvas = g = null; rockets = []; parts = []; flashes = []; stars = []; buildings = [];
        }
      };
    }
  });
})();
