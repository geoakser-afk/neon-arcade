/* Cars — made for Christopher (age 5). A night road with four lanes. A red car,
   a yellow school bus, a blue truck and a fire truck wait on the left. Tap one:
   it honks in its own voice and zooms across the road (spinning wheels, exhaust
   puffs, speed lines), then rolls back around to wait again. Nothing to lose,
   no clock — just beep beep. Every 10 zooms: confetti + a little fanfare. */
(function () {
  const VEH = [
    { type: "car", color: "#ff6b6b", dark: "#b84444", w: 0.24, h: 0.085 },
    { type: "bus", color: "#ffd36b", dark: "#c99a2e", w: 0.32, h: 0.105 },
    { type: "truck", color: "#74b9ff", dark: "#3f7fc4", w: 0.32, h: 0.115 },
    { type: "fire", color: "#ff5c5c", dark: "#b33636", w: 0.32, h: 0.115 }
  ];

  function rrect(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }
  function wheel(g, x, y, r, ang) {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.fillStyle = "#2a2434"; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#cfc9e0"; g.beginPath(); g.arc(0, 0, r * 0.55, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#2a2434"; g.lineWidth = r * 0.16; g.lineCap = "round";
    for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5); g.stroke(); }
    g.fillStyle = "#2a2434"; g.beginPath(); g.arc(0, 0, r * 0.14, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  function face(g, ex, ey, er, smx, smy, smr, happy) {
    g.fillStyle = "#fff"; [-1, 1].forEach(function (d) { g.beginPath(); g.arc(ex + d * er * 1.4, ey, er, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = "#2a2434"; [-1, 1].forEach(function (d) { g.beginPath(); g.arc(ex + d * er * 1.4 + er * 0.3, ey, er * 0.5, 0, Math.PI * 2); g.fill(); });
    g.strokeStyle = "#2a2434"; g.lineWidth = er * 0.35; g.lineCap = "round";
    g.beginPath(); g.arc(smx, smy, smr * (happy ? 1.3 : 1), 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  }
  // (cx, gy) = center-x, ground-y. S = canvas size. ang = wheel angle. now = ms. happy = squish/honk flag.
  function drawVehicle(g, v, cx, gy, S, ang, now, happy) {
    const W = v.w * S, H = v.h * S, wr = H * 0.32, by = gy - wr * 1.05, bx = cx - W / 2;
    g.save();
    g.shadowColor = v.color; g.shadowBlur = S * 0.02; g.fillStyle = v.color;
    if (v.type === "car") {
      rrect(g, bx, by - H * 0.55, W, H * 0.55, H * 0.2); g.fill();
      g.beginPath(); g.moveTo(bx + W * 0.16, by - H * 0.5); g.lineTo(bx + W * 0.3, by - H); g.lineTo(bx + W * 0.7, by - H); g.lineTo(bx + W * 0.86, by - H * 0.5); g.closePath(); g.fill();
      g.shadowBlur = 0; g.fillStyle = "#bfe9ff";
      g.beginPath(); g.moveTo(bx + W * 0.24, by - H * 0.56); g.lineTo(bx + W * 0.34, by - H * 0.92); g.lineTo(bx + W * 0.48, by - H * 0.92); g.lineTo(bx + W * 0.48, by - H * 0.56); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(bx + W * 0.53, by - H * 0.56); g.lineTo(bx + W * 0.53, by - H * 0.92); g.lineTo(bx + W * 0.68, by - H * 0.92); g.lineTo(bx + W * 0.8, by - H * 0.56); g.closePath(); g.fill();
      face(g, bx + W * 0.66, by - H * 0.74, H * 0.07, bx + W * 0.92, by - H * 0.36, H * 0.1, happy);
      wheel(g, bx + W * 0.24, gy - wr, wr, ang); wheel(g, bx + W * 0.78, gy - wr, wr, ang);
    } else if (v.type === "bus") {
      rrect(g, bx, by - H, W, H, H * 0.18); g.fill(); g.shadowBlur = 0;
      g.fillStyle = v.dark; g.fillRect(bx, by - H * 0.3, W * 0.95, H * 0.08);
      g.fillStyle = "#bfe9ff";
      for (let i = 0; i < 4; i++) rrect(g, bx + W * (0.05 + i * 0.16), by - H * 0.9, W * 0.12, H * 0.42, H * 0.05), g.fill();
      rrect(g, bx + W * 0.72, by - H * 0.9, W * 0.24, H * 0.5, H * 0.06); g.fill();
      face(g, bx + W * 0.84, by - H * 0.66, H * 0.07, bx + W * 0.94, by - H * 0.16, H * 0.09, happy);
      wheel(g, bx + W * 0.18, gy - wr, wr, ang); wheel(g, bx + W * 0.8, gy - wr, wr, ang);
    } else {
      // truck / fire truck: box + cab
      rrect(g, bx, by - H, W * 0.62, H, H * 0.1); g.fill();
      rrect(g, bx + W * 0.64, by - H * 0.72, W * 0.36, H * 0.72, H * 0.16); g.fill();
      g.shadowBlur = 0;
      g.fillStyle = "#bfe9ff"; rrect(g, bx + W * 0.7, by - H * 0.66, W * 0.26, H * 0.32, H * 0.06); g.fill();
      if (v.type === "fire") {
        g.fillStyle = "#fff"; g.fillRect(bx, by - H * 0.42, W * 0.62, H * 0.1);
        g.strokeStyle = "#e6e6f0"; g.lineWidth = H * 0.05; g.lineCap = "round";
        g.beginPath(); g.moveTo(bx + W * 0.05, by - H * 1.08); g.lineTo(bx + W * 0.58, by - H * 1.08); g.moveTo(bx + W * 0.05, by - H * 1.22); g.lineTo(bx + W * 0.58, by - H * 1.22); g.stroke();
        for (let i = 0; i < 5; i++) { const lx = bx + W * (0.08 + i * 0.12); g.beginPath(); g.moveTo(lx, by - H * 1.08); g.lineTo(lx, by - H * 1.22); g.stroke(); }
        const on = Math.sin(now * 0.01) > 0;
        g.fillStyle = on ? "#ff4d4d" : "#8fd3ff"; g.shadowColor = g.fillStyle; g.shadowBlur = S * 0.03;
        rrect(g, bx + W * 0.76, by - H * 0.9, W * 0.12, H * 0.18, H * 0.05); g.fill(); g.shadowBlur = 0;
      } else {
        g.fillStyle = v.dark; g.fillRect(bx + W * 0.05, by - H * 0.72, W * 0.52, H * 0.04); g.fillRect(bx + W * 0.05, by - H * 0.36, W * 0.52, H * 0.04);
      }
      face(g, bx + W * 0.83, by - H * 0.5, H * 0.065, bx + W * 0.95, by - H * 0.14, H * 0.08, happy);
      wheel(g, bx + W * 0.14, gy - wr, wr, ang); wheel(g, bx + W * 0.42, gy - wr, wr, ang); wheel(g, bx + W * 0.82, gy - wr, wr, ang);
    }
    // headlight (front-right, glowing)
    g.fillStyle = "#fff4b0"; g.shadowColor = "#fff4b0"; g.shadowBlur = S * 0.03;
    g.beginPath(); g.arc(bx + W * 0.99, by - H * 0.28, H * 0.09, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 0.14; g.beginPath(); g.moveTo(bx + W, by - H * 0.36); g.lineTo(bx + W + W * 0.5, by - H * 0.55); g.lineTo(bx + W + W * 0.5, by + H * 0.05); g.lineTo(bx + W, by - H * 0.2); g.closePath(); g.fill();
    g.restore();
  }

  Arcade.register({
    id: "cars",
    name: "Cars",
    tagline: "Tap a vehicle and it zooms across the road. Beep beep!",
    accent: "#ff6b6b",
    complexity: "low",
    controls: "click",
    scoreLabel: "Zooms",
    kid: true,
    kidIcon(g, s) {
      g.save();
      g.fillStyle = "rgba(255,255,255,0.08)"; g.fillRect(0, s * 0.72, s, s * 0.05);
      drawVehicle(g, { type: "car", color: "#ff6b6b", dark: "#b84444", w: 0.78, h: 0.3 }, s / 2, s * 0.74, s, 0.4, 0, false);
      g.restore();
    },
    create() {
      let stageEl, ctx, canvas, g, unResize = null;
      let S = 0, dpr = 1, reduced = false, now = 0, zooms = 0;
      let cars = [];      // {v, lane, cx, gy, state, vx, ang, honk, sq, lastHonk}
      let puffs = [], confetti = [], toasts = [];
      const ROAD_TOP = 0.2, ROAD_BOT = 0.97;

      function resize() {
        S = Arcade.board.stageSize(880); dpr = window.devicePixelRatio || 1;
        canvas.style.width = S + "px"; canvas.style.height = S + "px";
        canvas.width = Math.round(S * dpr); canvas.height = Math.round(S * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        layout();
      }
      function laneH() { return S * (ROAD_BOT - ROAD_TOP) / 4; }
      function waitX(c) { return S * 0.04 + c.v.w * S / 2; }
      function layout() {
        const old = cars; cars = [];
        for (let i = 0; i < 4; i++) {
          const p = old[i], v = VEH[i];
          cars.push({ v: v, lane: i, gy: S * ROAD_TOP + laneH() * (i + 0.86), cx: 0, state: p ? p.state : "wait", prog: p ? p.prog : 0,
            vx: p ? p.vx : 0, ang: p ? p.ang : 0, sq: 0, lastHonk: -9999, phase: i * 1.7 });
          const c = cars[i];
          c.cx = p && p.state !== "wait" ? p.cx / (old.S || S) * S : waitX(c);
        }
        cars.S = S;
      }

      function honk(c) {
        if (now - c.lastHonk < 260) return;
        c.lastHonk = now; c.sq = 1;
        const a = ctx.audio, t = c.v.type;
        if (t === "car") { a.tone(400, 0.13, { type: "sawtooth", vol: 0.06 }); a.tone(500, 0.16, { type: "sawtooth", vol: 0.06, when: 0.16 }); }
        else if (t === "bus") { a.tone(220, 0.38, { type: "triangle", vol: 0.14 }); a.tone(277, 0.38, { type: "triangle", vol: 0.08 }); }
        else if (t === "truck") { a.tone(150, 0.55, { type: "triangle", vol: 0.15, glide: 105 }); a.tone(75, 0.55, { type: "sine", vol: 0.1, glide: 55 }); }
        else { for (let i = 0; i < 6; i++) a.tone(i % 2 ? 800 : 600, 0.17, { type: "sine", vol: 0.09, when: i * 0.17 }); }
      }
      function launch(c) {
        honk(c);
        if (c.state !== "wait") return;
        c.state = "zoom"; c.vx = S * 0.00012;
        ctx.audio.tone(70, 0.6, { type: "triangle", vol: 0.06, glide: 220, when: 0.05 });
        zooms++; ctx.setScore(zooms);
        if (zooms % 10 === 0) {
          ctx.audio.arp([523, 659, 784, 1046], { dur: 0.22, step: 0.09, vol: 0.13, type: "sine", when: 0.3 });
          toasts.push({ x: S / 2, y: S * 0.16, text: "★ " + zooms + " ★", col: "#ffd36b", life: 1 });
          const n = reduced ? 14 : 60;
          for (let i = 0; i < n; i++) confetti.push({ x: Math.random() * S, y: -S * 0.02 - Math.random() * S * 0.2, vx: (Math.random() - 0.5) * S * 0.0002, vy: S * (0.0002 + Math.random() * 0.0003), life: 1, r: S * (0.006 + Math.random() * 0.008), col: ["#ffd36b", "#ff8fd0", "#74b9ff", "#7fe0a0", "#ffb86b", "#c9c3ff"][i % 6] });
        }
      }

      function update(dt) {
        now += dt;
        cars.forEach(function (c) {
          const W = c.v.w * S, wr = c.v.h * S * 0.32;
          if (c.sq > 0) c.sq = Math.max(0, c.sq - dt / 320);
          if (c.state === "zoom") {
            c.vx = Math.min(S * 0.0016, c.vx + S * 0.0000028 * dt);
            c.cx += c.vx * dt; c.ang += c.vx * dt / wr;
            if (!reduced || Math.random() < 0.3) puffs.push({ x: c.cx - W / 2 - wr * 0.3, y: c.gy - wr * 1.4, r: S * 0.008, vx: -S * 0.00008, vy: -S * 0.00006, life: 1, line: Math.random() < 0.5 });
            if (c.cx - W / 2 > S + S * 0.02) { c.state = "back"; c.cx = -W / 2 - S * 0.05; c.vx = S * 0.0007; }
          } else if (c.state === "back") {
            c.cx += c.vx * dt; c.ang += c.vx * dt / wr;
            if (c.cx >= waitX(c)) { c.cx = waitX(c); c.state = "wait"; c.vx = 0; }
          }
        });
        for (let i = puffs.length - 1; i >= 0; i--) { const p = puffs[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.r += dt * S * 0.00003; p.life -= dt / 700; if (p.life <= 0) puffs.splice(i, 1); }
        for (let i = confetti.length - 1; i >= 0; i--) { const c = confetti[i]; c.x += c.vx * dt + Math.sin(now * 0.004 + i) * S * 0.0001 * dt; c.y += c.vy * dt; c.life -= dt / 2600; if (c.life <= 0 || c.y > S) confetti.splice(i, 1); }
        for (let i = toasts.length - 1; i >= 0; i--) { toasts[i].y -= dt * S * 0.00004; toasts[i].life -= dt / 1500; if (toasts[i].life <= 0) toasts.splice(i, 1); }
      }

      function draw() {
        g.clearRect(0, 0, S, S);
        const sky = g.createLinearGradient(0, 0, 0, S * ROAD_TOP);
        sky.addColorStop(0, "#0e0c1e"); sky.addColorStop(1, "#1c1834");
        g.fillStyle = sky; g.fillRect(0, 0, S, S * ROAD_TOP);
        for (let i = 0; i < 30; i++) { const x = ((i * 137.5) % 100) / 100 * S, y = ((i * 71.3) % 16) / 100 * S; g.fillStyle = "rgba(255,255,255," + (0.15 + 0.4 * (0.5 + 0.5 * Math.sin(now * 0.002 + i * 1.3))) + ")"; g.beginPath(); g.arc(x, y, S * 0.003, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = "#fff4c8"; g.shadowColor = "#fff4c8"; g.shadowBlur = S * 0.03; g.beginPath(); g.arc(S * 0.86, S * 0.09, S * 0.035, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
        // road
        g.fillStyle = "#1e1c2c"; g.fillRect(0, S * ROAD_TOP, S, S * (ROAD_BOT - ROAD_TOP));
        g.fillStyle = "#2a2740"; g.fillRect(0, S * ROAD_TOP, S, S * 0.012); g.fillRect(0, S * ROAD_BOT - S * 0.012, S, S * 0.012);
        g.strokeStyle = "rgba(255,211,107,0.35)"; g.lineWidth = Math.max(2, S * 0.006); g.setLineDash([S * 0.05, S * 0.035]); g.lineDashOffset = -now * 0.02;
        for (let i = 1; i < 4; i++) { const y = S * ROAD_TOP + laneH() * i; g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); }
        g.setLineDash([]);
        // streetlights along the top edge
        [0.18, 0.5, 0.82].forEach(function (fx, i) {
          const x = fx * S, top = S * (ROAD_TOP - 0.06);
          g.strokeStyle = "#5a5470"; g.lineWidth = S * 0.008; g.lineCap = "round"; g.beginPath(); g.moveTo(x, S * ROAD_TOP); g.lineTo(x, top); g.lineTo(x + S * 0.03, top); g.stroke();
          const gl = 0.85 + 0.15 * Math.sin(now * 0.003 + i);
          g.fillStyle = "rgba(255,240,180," + gl + ")"; g.shadowColor = "#ffe9a0"; g.shadowBlur = S * 0.03; g.beginPath(); g.arc(x + S * 0.035, top + S * 0.005, S * 0.012, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
          g.fillStyle = "rgba(255,240,180,0.05)"; g.beginPath(); g.moveTo(x + S * 0.035, top); g.lineTo(x - S * 0.12, S * ROAD_BOT); g.lineTo(x + S * 0.19, S * ROAD_BOT); g.closePath(); g.fill();
        });
        // exhaust puffs + speed lines
        puffs.forEach(function (p) {
          g.save(); g.globalAlpha = p.life * 0.5;
          if (p.line) { g.strokeStyle = "#cfc9e0"; g.lineWidth = S * 0.004; g.beginPath(); g.moveTo(p.x, p.y + S * 0.03); g.lineTo(p.x - S * 0.06 * (1 - p.life), p.y + S * 0.03); g.stroke(); }
          else { g.fillStyle = "#b8b2cc"; g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill(); }
          g.restore();
        });
        // vehicles
        cars.forEach(function (c) {
          const bob = c.state === "wait" ? Math.sin(now * 0.004 + c.phase) * S * 0.004 : Math.sin(now * 0.03) * S * 0.002;
          g.save(); g.translate(c.cx, c.gy + bob); g.scale(1 + c.sq * 0.08, 1 - c.sq * 0.12);
          drawVehicle(g, c.v, 0, 0, S, c.ang, now, c.sq > 0.2);
          g.restore();
        });
        // counter
        g.save(); g.textAlign = "center"; g.textBaseline = "top";
        g.fillStyle = "#ffd36b"; g.shadowColor = "rgba(255,211,107,0.6)"; g.shadowBlur = 16;
        g.font = "800 " + Math.round(S * 0.075) + "px system-ui, sans-serif";
        g.fillText("★ " + zooms, S / 2, S * 0.03); g.restore();
        confetti.forEach(function (c) { g.save(); g.globalAlpha = Math.max(0, Math.min(1, c.life * 2)); g.fillStyle = c.col; g.translate(c.x, c.y); g.rotate(c.y * 0.03); g.fillRect(-c.r, -c.r * 0.6, c.r * 2, c.r * 1.2); g.restore(); });
        toasts.forEach(function (t) { g.save(); g.globalAlpha = Math.max(0, Math.min(1, t.life * 1.5)); g.fillStyle = t.col; g.shadowColor = t.col; g.shadowBlur = 12; g.font = "800 " + Math.round(S * 0.06) + "px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(t.text, t.x, t.y); g.restore(); });
      }

      return {
        mount(stage, c) {
          stageEl = stage; ctx = c;
          reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          const wrap = document.createElement("div");
          wrap.style.display = "flex"; wrap.style.flexDirection = "column"; wrap.style.alignItems = "center";
          canvas = document.createElement("canvas");
          canvas.style.borderRadius = "18px"; canvas.style.background = "#1e1c2c"; canvas.style.cursor = "pointer";
          canvas.style.boxShadow = "0 0 46px rgba(255,107,107,0.14)"; canvas.style.touchAction = "none";
          g = canvas.getContext("2d");
          wrap.appendChild(canvas);
          const hint = document.createElement("div"); hint.className = "hint";
          hint.textContent = "Tap a car, bus, truck or fire truck — it honks and zooms!";
          wrap.appendChild(hint);
          stage.appendChild(wrap);
          now = 0; zooms = 0; cars = []; puffs = []; confetti = []; toasts = [];
          resize();
          ctx.setScore(0);
          Arcade.input.setPointerTarget(canvas);
          unResize = Arcade.board.onResize(function () { resize(); });
          draw();
        },
        handleInput(intent) {
          if (intent.type !== "point" || intent.phase !== "down" || intent.button !== 0) return;
          let best = null;
          cars.forEach(function (c) {
            const W = c.v.w * S, H = c.v.h * S;
            if (Math.abs(intent.x - c.cx) < W * 0.72 && intent.y > c.gy - H * 1.9 && intent.y < c.gy + H * 0.5) best = c;
          });
          if (best) { launch(best); return; }
          ctx.audio.tone(330, 0.08, { type: "sine", vol: 0.04, glide: 420 });
        },
        tick(dt) { update(Math.min(50, dt)); draw(); },
        getScore() { return zooms; },
        teardown() {
          if (unResize) unResize(); unResize = null;
          stageEl = ctx = canvas = g = null; cars = []; puffs = []; confetti = []; toasts = [];
        }
      };
    }
  });
})();
