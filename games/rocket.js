/* Rocket — made for Christopher (age 5). A rocket waits on its launchpad under a
   starry sky. Tap it: three big pulsing rings count down (beep, beep, BEEP), then
   LIFTOFF — flame, smoke, a rising whoosh, the sky scrolls past and smiling
   planets drift by (tap one: it wobbles and chimes). After the flight the rocket
   floats back down under a parachute, ready for the next launch. No losing. */
(function () {
  function rrect(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }
  // (x,y) = bottom-center of the body; h = total height; flame 0..1; tilt radians; chute 0..1; now ms
  function drawRocket(g, x, y, h, flame, tilt, chute, now) {
    const w = h * 0.34;
    g.save(); g.translate(x, y); g.rotate(tilt || 0);
    if (chute > 0) {
      const cy = -h * 1.55, cr = h * 0.62;
      g.strokeStyle = "rgba(255,255,255,0.7)"; g.lineWidth = Math.max(1.5, h * 0.012);
      [-0.9, -0.3, 0.3, 0.9].forEach(function (d) { g.beginPath(); g.moveTo(d * cr, cy + h * 0.02); g.lineTo(0, -h * 0.95); g.stroke(); });
      g.save(); g.globalAlpha = chute;
      g.fillStyle = "#ff8fa3"; g.shadowColor = "#ff8fa3"; g.shadowBlur = h * 0.08;
      g.beginPath(); g.arc(0, cy, cr, Math.PI, 0); g.quadraticCurveTo(cr * 0.6, cy + h * 0.1, cr * 0.5, cy); g.quadraticCurveTo(cr * 0.25, cy + h * 0.1, 0, cy);
      g.quadraticCurveTo(-cr * 0.25, cy + h * 0.1, -cr * 0.5, cy); g.quadraticCurveTo(-cr * 0.6, cy + h * 0.1, -cr, cy); g.closePath(); g.fill();
      g.shadowBlur = 0; g.fillStyle = "#fff"; [-0.5, 0.5].forEach(function (d) { g.beginPath(); g.moveTo(0, cy); g.arc(0, cy, cr, Math.PI * (1.5 + d * 0.25) - 0.12, Math.PI * (1.5 + d * 0.25) + 0.12); g.closePath(); g.fill(); });
      g.restore();
    }
    if (flame > 0) {
      const f = flame * (0.85 + 0.15 * Math.sin(now * 0.05)), fl = h * 0.55 * f;
      g.save(); g.shadowColor = "#ffb347"; g.shadowBlur = h * 0.15;
      g.fillStyle = "#ff7a3d"; g.beginPath(); g.moveTo(-w * 0.32, h * 0.04); g.quadraticCurveTo(0, fl * 1.3, w * 0.32, h * 0.04); g.closePath(); g.fill();
      g.fillStyle = "#ffd36b"; g.beginPath(); g.moveTo(-w * 0.18, h * 0.04); g.quadraticCurveTo(0, fl * 0.8, w * 0.18, h * 0.04); g.closePath(); g.fill();
      g.fillStyle = "#fff8d0"; g.beginPath(); g.moveTo(-w * 0.08, h * 0.04); g.quadraticCurveTo(0, fl * 0.4, w * 0.08, h * 0.04); g.closePath(); g.fill();
      g.restore();
    }
    // fins
    g.fillStyle = "#ff6b6b"; g.shadowColor = "#ff6b6b"; g.shadowBlur = h * 0.05;
    [-1, 1].forEach(function (d) { g.beginPath(); g.moveTo(d * w * 0.45, -h * 0.34); g.lineTo(d * w * 0.95, -h * 0.02); g.lineTo(d * w * 0.95, h * 0.03); g.lineTo(d * w * 0.45, 0); g.closePath(); g.fill(); });
    // nozzle
    g.shadowBlur = 0; g.fillStyle = "#8a84a0"; g.beginPath(); g.moveTo(-w * 0.3, -h * 0.02); g.lineTo(w * 0.3, -h * 0.02); g.lineTo(w * 0.38, h * 0.06); g.lineTo(-w * 0.38, h * 0.06); g.closePath(); g.fill();
    // body
    const bg = g.createLinearGradient(-w / 2, 0, w / 2, 0); bg.addColorStop(0, "#d8d4ea"); bg.addColorStop(0.4, "#ffffff"); bg.addColorStop(1, "#c8c3dd");
    g.fillStyle = bg; g.shadowColor = "#ffffff"; g.shadowBlur = h * 0.06;
    rrect(g, -w / 2, -h * 0.74, w, h * 0.74, w * 0.18); g.fill(); g.shadowBlur = 0;
    g.fillStyle = "#ff6b6b"; g.fillRect(-w / 2, -h * 0.2, w, h * 0.05);
    // nose cone
    g.fillStyle = "#ff6b6b"; g.beginPath(); g.moveTo(-w / 2, -h * 0.72); g.quadraticCurveTo(-w * 0.25, -h * 0.98, 0, -h); g.quadraticCurveTo(w * 0.25, -h * 0.98, w / 2, -h * 0.72); g.closePath(); g.fill();
    // round window with a little face
    g.fillStyle = "#8a84a0"; g.beginPath(); g.arc(0, -h * 0.5, w * 0.3, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#74b9ff"; g.beginPath(); g.arc(0, -h * 0.5, w * 0.23, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(255,255,255,0.7)"; g.beginPath(); g.arc(-w * 0.08, -h * 0.56, w * 0.07, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#2a2a44"; [-1, 1].forEach(function (d) { g.beginPath(); g.arc(d * w * 0.09, -h * 0.51, w * 0.04, 0, Math.PI * 2); g.fill(); });
    g.strokeStyle = "#2a2a44"; g.lineWidth = w * 0.03; g.lineCap = "round"; g.beginPath(); g.arc(0, -h * 0.48, w * 0.08, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
    g.restore();
  }
  function drawPlanet(g, p, now) {
    const r = p.r * (1 + Math.sin(p.wob * Math.PI * 4) * p.wob * 0.15);
    g.save(); g.translate(p.x, p.y); g.rotate(p.spin);
    g.shadowColor = p.color; g.shadowBlur = r * 0.5;
    if (p.style === "ring") { g.strokeStyle = p.ring; g.lineWidth = r * 0.16; g.beginPath(); g.ellipse(0, 0, r * 1.7, r * 0.45, -0.3, Math.PI * 0.95, Math.PI * 2.05); g.stroke(); }
    const gr = g.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r * 1.1); gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.25, p.color); gr.addColorStop(1, p.dark);
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
    g.save(); g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.clip();
    if (p.style === "stripes") { g.fillStyle = "rgba(255,255,255,0.22)"; [-0.55, -0.15, 0.3].forEach(function (f) { g.fillRect(-r, r * f, r * 2, r * 0.16); }); }
    if (p.style === "spots") { g.fillStyle = "rgba(255,255,255,0.25)"; [[-0.45, -0.4, 0.22], [0.4, -0.2, 0.15], [0.1, 0.45, 0.18]].forEach(function (s) { g.beginPath(); g.arc(r * s[0], r * s[1], r * s[2], 0, Math.PI * 2); g.fill(); }); }
    g.restore();
    if (p.style === "ring") { g.strokeStyle = p.ring; g.lineWidth = r * 0.16; g.beginPath(); g.ellipse(0, 0, r * 1.7, r * 0.45, -0.3, -Math.PI * 0.05, Math.PI * 0.95); g.stroke(); }
    // face
    const blink = Math.sin(now * 0.0025 + p.seed) > 0.96;
    g.fillStyle = "#2a2a44"; g.strokeStyle = "#2a2a44"; g.lineCap = "round"; g.lineWidth = r * 0.07;
    [-1, 1].forEach(function (d) {
      if (blink) { g.beginPath(); g.moveTo(d * r * 0.35 - r * 0.12, -r * 0.1); g.lineTo(d * r * 0.35 + r * 0.12, -r * 0.1); g.stroke(); }
      else { g.beginPath(); g.ellipse(d * r * 0.35, -r * 0.1, r * 0.13, r * 0.17, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = "#fff"; g.beginPath(); g.arc(d * r * 0.35 - r * 0.04, -r * 0.16, r * 0.05, 0, Math.PI * 2); g.fill(); g.fillStyle = "#2a2a44"; }
    });
    g.fillStyle = "rgba(255,110,140,0.35)"; [-1, 1].forEach(function (d) { g.beginPath(); g.ellipse(d * r * 0.55, r * 0.2, r * 0.14, r * 0.09, 0, 0, Math.PI * 2); g.fill(); });
    g.beginPath(); g.arc(0, r * 0.22, r * (p.wob > 0.3 ? 0.26 : 0.17), 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    g.restore();
  }

  Arcade.register({
    id: "rocket",
    name: "Rocket",
    tagline: "Tap to launch! Fly past the planets.",
    accent: "#c9c3ff",
    complexity: "low",
    controls: "click",
    scoreLabel: "Launches",
    kid: true,
    kidIcon(g, s) { drawRocket(g, s / 2, s * 0.8, s * 0.66, 0.8, 0, 0, 0); },
    create() {
      let stageEl, ctx, canvas, g, unResize = null;
      let S = 0, dpr = 1, reduced = false, now = 0, launches = 0;
      let state = "idle", t = 0, beeps = 0, shake = 0, scroll = 0, rocketY = 0, rocketX = 0, sq = 0;
      let stars = [], planets = [], parts = [], rings = [];
      const PAL = [
        { color: "#ff8fa3", dark: "#c94c66", style: "ring", ring: "#ffd36b" },
        { color: "#ffb86b", dark: "#c47a2e", style: "stripes" },
        { color: "#7fe0a0", dark: "#3f9c62", style: "spots" },
        { color: "#74b9ff", dark: "#3567b3", style: "ring", ring: "#c9c3ff" },
        { color: "#c9c3ff", dark: "#7a6fd1", style: "stripes" },
        { color: "#ffd36b", dark: "#c99a2e", style: "spots" }
      ];
      function padY() { return S * 0.86; }
      function rocketH() { return S * 0.3; }

      function resize() {
        const oldS = S || 1;
        S = Arcade.board.stageSize(880); dpr = window.devicePixelRatio || 1;
        canvas.style.width = S + "px"; canvas.style.height = S + "px";
        canvas.width = Math.round(S * dpr); canvas.height = Math.round(S * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        const k = S / oldS;
        planets.forEach(function (p) { p.x *= k; p.y *= k; p.r *= k; });
        rocketX = S / 2; if (state === "idle") rocketY = padY(); else rocketY *= k;
        if (!stars.length) for (let i = 0; i < 90; i++) stars.push({ x: Math.random(), y: Math.random(), z: 0.3 + Math.random() * 0.7, tw: Math.random() * 6.28 });
      }
      function spawnPlanet(y) {
        const base = PAL[Math.floor(Math.random() * PAL.length)];
        const r = S * (0.085 + Math.random() * 0.045);
        const x = (0.16 + Math.random() * 0.68) * S;
        planets.push({ x: x, y: y == null ? -r * 1.8 : y, r: r, color: base.color, dark: base.dark, style: base.style, ring: base.ring, spin: (Math.random() - 0.5) * 0.4, spinV: 0, wob: 0, seed: Math.random() * 6.28, last: -9999 });
      }
      function emit(n, big) {
        if (reduced) n = Math.ceil(n / 3);
        for (let i = 0; i < n; i++) {
          const a = Math.PI / 2 + (Math.random() - 0.5) * 0.9, sp = S * (0.0002 + Math.random() * 0.0005) * (big ? 1.6 : 1);
          parts.push({ x: rocketX + (Math.random() - 0.5) * S * 0.03, y: rocketY + S * 0.01, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, r: S * (0.008 + Math.random() * 0.012) * (big ? 1.4 : 1), smoke: Math.random() < 0.6 });
        }
      }
      function startCountdown() {
        state = "count"; t = 0; beeps = 0; sq = 1;
      }
      function beep(i) {
        ctx.audio.tone(i === 2 ? 660 : 440, i === 2 ? 0.45 : 0.22, { type: "sine", vol: 0.14 });
        rings.push({ life: 1, big: i === 2 }); shake = i + 1;
      }
      function liftoff() {
        state = "fly"; t = 0; launches++; ctx.setScore(launches);
        ctx.audio.tone(120, 1.2, { type: "sine", vol: 0.16, glide: 900 });
        ctx.audio.tone(60, 1.2, { type: "triangle", vol: 0.07, glide: 300 });
        ctx.audio.arp([523, 659, 784, 1046], { dur: 0.2, step: 0.1, vol: 0.09, type: "sine", when: 0.9 });
        emit(40, true);
      }
      function tapPlanet(p) {
        if (now - p.last < 220) return;
        p.last = now; p.wob = 1; p.spinV += (Math.random() < 0.5 ? -1 : 1) * 0.012;
        const base = [523, 587, 659, 784][Math.floor(Math.random() * 4)] * 2;
        ctx.audio.arp([base, base * 1.25, base * 1.5, base * 2], { dur: 0.4, step: 0.06, vol: 0.1, type: "sine" });
        ctx.audio.tone(base * 3, 0.5, { type: "sine", vol: 0.03, when: 0.18 });
      }

      function update(dt) {
        now += dt; t += dt;
        if (sq > 0) sq = Math.max(0, sq - dt / 300);
        if (shake > 0) shake = Math.max(0, shake - dt / 400);
        let speed = 0;
        if (state === "count") {
          const want = Math.min(3, Math.floor(t / 500) + 1);
          while (beeps < want) { beep(beeps); beeps++; }
          if (t >= 1500) liftoff();
          if (Math.random() < 0.5) emit(1, false);
          rocketY = padY();
        } else if (state === "fly") {
          const k = t / 1500;
          rocketY = padY() - S * 1.3 * k * k;
          speed = S * 0.0009 * Math.min(1, t / 900);
          if (rocketY > -rocketH() * 1.2) emit(reduced ? 1 : 3, true);
          if (t > 4000) { state = "return"; t = 0; rocketY = -rocketH() * 1.6; ctx.audio.tone(700, 0.12, { type: "triangle", vol: 0.06, glide: 1000 }); }
        } else if (state === "return") {
          const k = Math.min(1, t / 3200), e = Math.sin(k * Math.PI / 2);
          rocketY = -rocketH() * 1.6 + (padY() + rocketH() * 1.6) * e;
          speed = S * 0.0009 * Math.max(0, 1 - t / 1600);
          if (k >= 1) { state = "idle"; t = 0; rocketY = padY(); sq = 0.8; ctx.audio.tone(140, 0.2, { type: "sine", vol: 0.1, glide: 90 }); emit(10, false); }
        }
        if (speed > 0) {
          scroll += speed * dt;
          if (planets.length < 3 && Math.random() < dt * 0.0009) spawnPlanet();
        }
        stars.forEach(function (s) { s.y += speed * s.z * dt / S; if (s.y > 1.02) { s.y -= 1.04; s.x = Math.random(); } });
        for (let i = planets.length - 1; i >= 0; i--) {
          const p = planets[i];
          p.y += speed * 0.75 * dt + (speed > 0 ? 0 : Math.sin(now * 0.0015 + p.seed) * S * 0.00003 * dt + (p.y > S * 0.42 ? S * 0.00006 * dt : 0));   // idle: bob, but drift clear of the pad
          p.spin += p.spinV * dt * 0.06 + (speed > 0 ? 0.00002 * dt : 0.000006 * dt); p.spinV *= Math.pow(0.996, dt);
          if (p.wob > 0) p.wob = Math.max(0, p.wob - dt / 700);
          if (p.y > S + p.r * 1.5) planets.splice(i, 1);
        }
        for (let i = parts.length - 1; i >= 0; i--) { const q = parts[i]; q.x += q.vx * dt; q.y += q.vy * dt + speed * 0.5 * dt; q.vy *= Math.pow(0.998, dt); q.r += dt * S * 0.00002; q.life -= dt / (q.smoke ? 1100 : 450); if (q.life <= 0) parts.splice(i, 1); }
        for (let i = rings.length - 1; i >= 0; i--) { rings[i].life -= dt / 600; if (rings[i].life <= 0) rings.splice(i, 1); }
      }

      function draw() {
        g.clearRect(0, 0, S, S);
        const sky = g.createLinearGradient(0, 0, 0, S); sky.addColorStop(0, "#0c0a1c"); sky.addColorStop(0.7, "#171330"); sky.addColorStop(1, "#231c3c");
        g.fillStyle = sky; g.fillRect(0, 0, S, S);
        stars.forEach(function (s, i) { const a = 0.2 + 0.6 * (0.5 + 0.5 * Math.sin(now * 0.0025 * s.z + s.tw)); g.fillStyle = "rgba(255,255,255," + a * s.z + ")"; g.beginPath(); g.arc(s.x * S, s.y * S, S * 0.0025 * (0.6 + s.z), 0, Math.PI * 2); g.fill(); });
        planets.forEach(function (p) { drawPlanet(g, p, now); });
        // ground + pad
        g.fillStyle = "#1b1730"; g.beginPath(); g.ellipse(S / 2, S * 1.05, S * 0.8, S * 0.2, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#3a3452"; rrect(g, S * 0.34, padY() - S * 0.005, S * 0.32, S * 0.03, S * 0.01); g.fill();
        g.fillStyle = "#2a2540"; [0.38, 0.6].forEach(function (fx) { g.fillRect(fx * S, padY() + S * 0.02, S * 0.02, S * 0.06); });
        g.fillStyle = "#ffd36b"; g.shadowColor = "#ffd36b"; g.shadowBlur = S * 0.02; [0.36, 0.62].forEach(function (fx) { g.beginPath(); g.arc(fx * S + S * 0.01, padY(), S * 0.008, 0, Math.PI * 2); g.fill(); }); g.shadowBlur = 0;
        // particles (smoke behind, fire in front)
        parts.forEach(function (q) { g.save(); g.globalAlpha = Math.max(0, q.life) * (q.smoke ? 0.35 : 0.8); g.fillStyle = q.smoke ? "#b8b2cc" : (q.life > 0.5 ? "#ffd36b" : "#ff7a3d"); g.beginPath(); g.arc(q.x, q.y, q.r * (q.smoke ? 1.6 : 1), 0, Math.PI * 2); g.fill(); g.restore(); });
        // countdown rings
        rings.forEach(function (r) { const k = 1 - r.life; g.save(); g.globalAlpha = r.life * 0.8; g.strokeStyle = r.big ? "#ffd36b" : "#c9c3ff"; g.lineWidth = S * 0.012 * r.life + 1; g.shadowColor = g.strokeStyle; g.shadowBlur = 20; g.beginPath(); g.arc(rocketX, rocketY - rocketH() * 0.5, S * (0.12 + k * (r.big ? 0.45 : 0.3)), 0, Math.PI * 2); g.stroke(); g.restore(); });
        // rocket
        const sway = state === "idle" ? Math.sin(now * 0.0016) * 0.04 : state === "return" ? Math.sin(now * 0.002) * 0.12 : 0;
        const jit = shake > 0 ? (Math.random() - 0.5) * S * 0.008 * shake : 0;
        const bob = state === "idle" ? Math.sin(now * 0.002) * S * 0.004 : 0;
        const flame = state === "fly" ? 1 : state === "count" ? 0.25 + 0.2 * beeps : 0;
        g.save(); g.translate(rocketX + jit, rocketY + bob); g.scale(1 + sq * 0.08, 1 - sq * 0.1);
        drawRocket(g, 0, 0, rocketH(), flame, sway, state === "return" ? Math.min(1, t / 400) : 0, now);
        g.restore();
        // counter
        g.save(); g.textAlign = "center"; g.textBaseline = "top";
        g.fillStyle = "#ffd36b"; g.shadowColor = "rgba(255,211,107,0.6)"; g.shadowBlur = 16;
        g.font = "800 " + Math.round(S * 0.075) + "px system-ui, sans-serif";
        g.fillText("★ " + launches, S / 2, S * 0.03); g.restore();
      }

      return {
        mount(stage, c) {
          stageEl = stage; ctx = c;
          reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          const wrap = document.createElement("div");
          wrap.style.display = "flex"; wrap.style.flexDirection = "column"; wrap.style.alignItems = "center";
          canvas = document.createElement("canvas");
          canvas.style.borderRadius = "18px"; canvas.style.background = "#0c0a1c"; canvas.style.cursor = "pointer";
          canvas.style.boxShadow = "0 0 46px rgba(201,195,255,0.16)"; canvas.style.touchAction = "none";
          g = canvas.getContext("2d");
          wrap.appendChild(canvas);
          const hint = document.createElement("div"); hint.className = "hint";
          hint.textContent = "Tap the rocket to launch. Tap planets as they float by.";
          wrap.appendChild(hint);
          stage.appendChild(wrap);
          now = 0; t = 0; launches = 0; state = "idle"; stars = []; planets = []; parts = []; rings = []; shake = 0; sq = 0; scroll = 0;
          resize();
          spawnPlanet(S * 0.3); planets[0].x = S * 0.22; spawnPlanet(S * 0.42); planets[1].x = S * 0.78;
          ctx.setScore(0);
          Arcade.input.setPointerTarget(canvas);
          unResize = Arcade.board.onResize(function () { resize(); });
          draw();
        },
        handleInput(intent) {
          if (intent.type !== "point" || intent.phase !== "down" || intent.button !== 0) return;
          const x = intent.x, y = intent.y;
          const h = rocketH();
          const onRocket = Math.abs(x - rocketX) < S * 0.14 && y > rocketY - h * 1.15 && y < rocketY + h * 0.25;
          if (!(onRocket && state === "idle")) {   // planets (generous hit) — unless the rocket is ready to launch
            for (let i = planets.length - 1; i >= 0; i--) { const p = planets[i]; if (Math.hypot(x - p.x, y - p.y) < p.r * 1.45) { tapPlanet(p); return; } }
          }
          if (onRocket) {
            if (state === "idle") { startCountdown(); return; }
            sq = 1; ctx.audio.tone(520, 0.1, { type: "triangle", vol: 0.07, glide: 700 }); return;
          }
          ctx.audio.tone(330, 0.08, { type: "sine", vol: 0.04, glide: 420 });
        },
        tick(dt) { update(Math.min(50, dt)); draw(); },
        getScore() { return launches; },
        teardown() {
          if (unResize) unResize(); unResize = null;
          stageEl = ctx = canvas = g = null; stars = []; planets = []; parts = []; rings = [];
        }
      };
    }
  });
})();
