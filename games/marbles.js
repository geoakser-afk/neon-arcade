/* Marble Run — made for Christopher (age 5). Build your own marble course with
   big pieces (ramps, bumpers, trampolines, spinners), then press the big GO
   button: four smiling marbles drop in and race to the bottom. First one down
   gets a crown and confetti. No reading, no losing — tap a piece in the tray,
   tap the board to place it, tap a placed piece to remove it, tap GO to race. */
(function () {
  Arcade.register({
    id: "marbles",
    name: "Marble Run",
    tagline: "Build a marble course with big pieces, then watch the marbles race.",
    accent: "#74b9ff",
    complexity: "low",
    controls: "click",
    scoreLabel: "Races",
    kid: true,
    kidIcon(g, s) {
      // a marble rolling down a ramp
      g.save(); g.lineCap = "round";
      g.strokeStyle = "#b48cff"; g.lineWidth = s * 0.07; g.shadowColor = "#b48cff"; g.shadowBlur = s * 0.05;
      g.beginPath(); g.moveTo(s * 0.12, s * 0.42); g.lineTo(s * 0.62, s * 0.76); g.stroke();
      g.strokeStyle = "rgba(255,255,255,0.45)"; g.lineWidth = s * 0.02; g.stroke();
      const r = s * 0.14, x = s * 0.36, y = s * 0.44;
      const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
      gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.3, "#ff8fa3"); gr.addColorStop(1, "#b8455e");
      g.fillStyle = gr; g.shadowColor = "#ff8fa3"; g.shadowBlur = s * 0.06; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
      g.fillStyle = "#2a2233"; [-1, 1].forEach(function (d) { g.beginPath(); g.ellipse(x + d * r * 0.35, y - r * 0.1, r * 0.11, r * 0.14, 0, 0, Math.PI * 2); g.fill(); });
      g.strokeStyle = "#2a2233"; g.lineWidth = r * 0.08; g.beginPath(); g.arc(x, y + r * 0.2, r * 0.22, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
      // bumper + trampoline hints
      g.fillStyle = "#ffd36b"; g.shadowColor = "#ffd36b"; g.shadowBlur = s * 0.04; g.beginPath(); g.arc(s * 0.78, s * 0.5, s * 0.07, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#7fe0a0"; g.shadowColor = "#7fe0a0"; g.lineWidth = s * 0.05; g.beginPath(); g.moveTo(s * 0.62, s * 0.88); g.lineTo(s * 0.9, s * 0.88); g.stroke();
      g.restore();
    },
    create() {
      let stageEl, ctx, canvas, g, unResize = null;
      let S = 0, dpr = 1, reduced = false;
      let now = 0, races = 0;
      let pieces = [];          // {kind, x, y, dir, spin, hit}
      let marbles = [];
      let tool = "rampR";
      let racing = false, raceT = 0, finished = [], winner = null, winT = 0;
      let confetti = [], fx = [];
      let lastRoll = -9999;
      const TAU = Math.PI * 2;
      const KINDS = ["rampR", "rampL", "bumper", "tramp", "spinner"];
      const KCOL = { rampR: "#b48cff", rampL: "#b48cff", bumper: "#ffd36b", tramp: "#7fe0a0", spinner: "#74b9ff" };
      const MARBLES = [
        { a: "#ff8fa3", b: "#b8455e" }, { a: "#74b9ff", b: "#2a4a8a" }, { a: "#7fe0a0", b: "#2f8a58" }, { a: "#ffd36b", b: "#b8860b" }
      ];
      const NOTES = [523, 587, 659, 784, 880, 1046];

      // ---- layout ----
      function boardRect() { return { x: 0, y: S * 0.13, w: S, h: S * 0.73 }; }
      function trayY() { return S * 0.93; }
      function pieceLen() { return S * 0.2; }
      function marbleR() { return S * 0.032; }
      function goBtn() { return { x: S * 0.5, y: S * 0.065, r: S * 0.05 }; }
      function clearBtn() { return { x: S * 0.9, y: S * 0.065, r: S * 0.036 }; }
      function traySlots() {
        const n = KINDS.length, w = S * 0.14, x0 = (S - n * w) / 2 + w / 2;
        return KINDS.map(function (k, i) { return { kind: k, x: x0 + i * w, y: trayY(), w: w }; });
      }

      function resize() {
        const old = S;
        S = Arcade.board.stageSize(880);
        dpr = window.devicePixelRatio || 1;
        canvas.style.width = S + "px"; canvas.style.height = S + "px";
        canvas.width = Math.round(S * dpr); canvas.height = Math.round(S * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (old && old !== S) { const k = S / old; pieces.forEach(function (p) { p.x *= k; p.y *= k; }); resetMarbles(); }
      }

      function defaultCourse() {
        const b = boardRect();
        pieces = [
          { kind: "rampR", x: S * 0.28, y: b.y + b.h * 0.22, dir: 1, spin: 0, hit: 0 },
          { kind: "bumper", x: S * 0.62, y: b.y + b.h * 0.42, dir: 1, spin: 0, hit: 0 },
          { kind: "rampL", x: S * 0.7, y: b.y + b.h * 0.6, dir: -1, spin: 0, hit: 0 },
          { kind: "tramp", x: S * 0.3, y: b.y + b.h * 0.82, dir: 1, spin: 0, hit: 0 }
        ];
      }
      function resetMarbles() {
        const b = boardRect(), r = marbleR();
        marbles = MARBLES.map(function (m, i) { return { x: S * (0.2 + i * 0.2), y: b.y + r * 1.4, vx: 0, vy: 0, r: r, col: m, done: false, sq: 0, lastSnd: -9999, blink: Math.random() * 6 }; });
        finished = []; winner = null; racing = false; raceT = 0;
      }

      // ---- geometry ----
      function rampPts(p) {
        const L = pieceLen(), d = p.dir;
        return [{ x: p.x - d * L * 0.5, y: p.y - L * 0.28 }, { x: p.x + d * L * 0.5, y: p.y + L * 0.28 }];
      }
      function trampPts(p) { const L = pieceLen(); return [{ x: p.x - L * 0.5, y: p.y }, { x: p.x + L * 0.5, y: p.y }]; }
      function spinnerArms(p) {
        const L = pieceLen() * 0.42, arms = [];
        for (let k = 0; k < 3; k++) { const a = p.spin + k * TAU / 3; arms.push([{ x: p.x, y: p.y }, { x: p.x + Math.cos(a) * L, y: p.y + Math.sin(a) * L }]); }
        return arms;
      }
      function pieceAt(x, y) {
        for (let i = pieces.length - 1; i >= 0; i--) { const p = pieces[i]; if (Math.hypot(x - p.x, y - p.y) < pieceLen() * 0.42) return i; }
        return -1;
      }
      // circle vs segment; returns true on contact. e restitution, fric tangential keep, boost multiplier
      function collideSeg(m, a, b, e, fric, boost) {
        const abx = b.x - a.x, aby = b.y - a.y, L2 = abx * abx + aby * aby || 1;
        let u = ((m.x - a.x) * abx + (m.y - a.y) * aby) / L2; u = Math.max(0, Math.min(1, u));
        const cx = a.x + abx * u, cy = a.y + aby * u;
        const dx = m.x - cx, dy = m.y - cy, d = Math.hypot(dx, dy);
        if (d >= m.r || d === 0) return false;
        const nx = dx / d, ny = dy / d;
        m.x = cx + nx * m.r; m.y = cy + ny * m.r;
        const vn = m.vx * nx + m.vy * ny;
        if (vn < 0) {
          m.vx -= (1 + e) * vn * nx; m.vy -= (1 + e) * vn * ny;
          if (boost && ny < -0.3) { m.vx *= boost; m.vy = -Math.abs(m.vy) * boost - S * 0.0009; }
          const tx = -ny, ty = nx, vt = m.vx * tx + m.vy * ty;
          m.vx -= vt * (1 - fric) * tx; m.vy -= vt * (1 - fric) * ty;
          return -vn;
        }
        return 0.0001;
      }
      function sndRoll(m, f) {
        if (now - m.lastSnd < 110) return; m.lastSnd = now;
        ctx.audio.tone(f, 0.05, { type: "triangle", vol: 0.05 });
      }
      function bell(f, vol, when) {
        ctx.audio.tone(f, 0.3, { type: "sine", vol: vol, when: when || 0 });
        ctx.audio.tone(f * 2, 0.18, { type: "sine", vol: vol * 0.3, when: when || 0 });
      }

      // ---- race physics ----
      function update(dt) {
        now += dt;
        pieces.forEach(function (p) { if (p.kind === "spinner") p.spin += dt * 0.0016; if (p.hit > 0) p.hit = Math.max(0, p.hit - dt / 300); });
        marbles.forEach(function (m) { if (m.sq > 0) m.sq = Math.max(0, m.sq - dt / 250); });
        for (let i = confetti.length - 1; i >= 0; i--) { const c = confetti[i]; c.vy += S * 0.0000015 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.life -= dt / 1400; if (c.life <= 0) confetti.splice(i, 1); }
        for (let i = fx.length - 1; i >= 0; i--) { fx[i].t += dt; if (fx[i].t > fx[i].dur) fx.splice(i, 1); }
        if (winner != null) winT += dt;
        if (!racing) return;
        raceT += dt;
        const b = boardRect(), G = S * 0.0000024, vmax = S * 0.0028;
        const steps = 3, h = dt / steps;
        for (let s = 0; s < steps; s++) {
          marbles.forEach(function (m) {
            if (m.done) return;
            m.vy += G * h;
            const dmp = Math.pow(0.9996, h); m.vx *= dmp; m.vy *= dmp;
            const sp = Math.hypot(m.vx, m.vy); if (sp > vmax) { m.vx *= vmax / sp; m.vy *= vmax / sp; }
            m.x += m.vx * h; m.y += m.vy * h;
            if (m.x - m.r < b.x) { m.x = b.x + m.r; m.vx = Math.abs(m.vx) * 0.6; }
            if (m.x + m.r > b.x + b.w) { m.x = b.x + b.w - m.r; m.vx = -Math.abs(m.vx) * 0.6; }
            if (m.y - m.r < b.y) { m.y = b.y + m.r; m.vy = Math.abs(m.vy) * 0.5; }
            pieces.forEach(function (p) {
              if (p.kind === "rampR" || p.kind === "rampL") {
                const q = rampPts(p), v = collideSeg(m, q[0], q[1], 0.15, 0.998);
                if (v) { if (v > S * 0.0006) { m.sq = 0.6; p.hit = 1; } sndRoll(m, 300 + (m.y / S) * 300); }
              } else if (p.kind === "tramp") {
                const q = trampPts(p), v = collideSeg(m, q[0], q[1], 0.7, 1, 1.15);
                if (v > S * 0.0004) { m.sq = 1; p.hit = 1; ctx.audio.tone(200, 0.16, { type: "triangle", vol: 0.12, glide: 640 }); }
              } else if (p.kind === "bumper") {
                const R = pieceLen() * 0.2, dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy);
                if (d < R + m.r && d > 0) {
                  const nx = dx / d, ny = dy / d, vn = m.vx * nx + m.vy * ny;
                  m.x = p.x + nx * (R + m.r); m.y = p.y + ny * (R + m.r);
                  if (vn < 0) { m.vx -= 1.9 * vn * nx; m.vy -= 1.9 * vn * ny; m.vx += nx * S * 0.0004; m.vy += ny * S * 0.0004; }
                  if (p.hit < 0.5) { p.hit = 1; m.sq = 0.8; bell(NOTES[Math.floor(Math.random() * NOTES.length)] * 2, 0.1); fx.push({ kind: "ring", x: p.x, y: p.y, t: 0, dur: 350, r: R * 2.2, col: KCOL.bumper }); }
                }
              } else if (p.kind === "spinner") {
                spinnerArms(p).forEach(function (arm) {
                  const v = collideSeg(m, arm[0], arm[1], 0.5, 0.95);
                  if (v) { // arms push in their direction of rotation
                    const ax = m.x - p.x, ay = m.y - p.y, d = Math.hypot(ax, ay) || 1;
                    m.vx += (-ay / d) * S * 0.0005; m.vy += (ax / d) * S * 0.0005;
                    if (v > S * 0.0005) { m.sq = 0.5; p.hit = 1; ctx.audio.tone(700, 0.05, { type: "sine", vol: 0.05, glide: 900 }); }
                  }
                });
              }
            });
            // finish line
            if (m.y + m.r >= b.y + b.h) {
              m.done = true; m.y = b.y + b.h - m.r; m.vx = 0; m.vy = 0;
              finished.push(m);
              const place = finished.length;
              if (place === 1) {
                winner = m; winT = 0;
                ctx.audio.arp([523, 659, 784, 1046, 1318], { dur: 0.2, step: 0.08, vol: 0.16, type: "sine" });
                for (let i = 0; i < (reduced ? 12 : 50); i++) { const a = Math.random() * TAU, sp = S * (0.0003 + Math.random() * 0.0007); confetti.push({ x: m.x, y: m.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - S * 0.0006, life: 1, r: S * (0.005 + Math.random() * 0.007), col: ["#ffd36b", "#ff8fd0", "#74b9ff", "#7fe0a0", "#ffb86b"][i % 5] }); }
              } else bell(NOTES[Math.max(0, 4 - place)], 0.08);
            }
          });
          // marble-marble
          for (let i = 0; i < marbles.length; i++) for (let j = i + 1; j < marbles.length; j++) {
            const a = marbles[i], c = marbles[j];
            if (a.done || c.done) continue;
            const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy), md = a.r + c.r;
            if (d >= md || d === 0) continue;
            const nx = dx / d, ny = dy / d, ov = (md - d) / 2;
            a.x -= nx * ov; a.y -= ny * ov; c.x += nx * ov; c.y += ny * ov;
            const vn = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
            if (vn < 0) { const j2 = -(1.6) * vn / 2; a.vx -= j2 * nx; a.vy -= j2 * ny; c.vx += j2 * nx; c.vy += j2 * ny; if (-vn > S * 0.0005) { a.sq = c.sq = 0.5; sndRoll(a, 900); } }
          }
        }
        // stuck marbles get a nudge; race ends when all are done or after 14s
        if (raceT > 2500) marbles.forEach(function (m) { if (!m.done && Math.hypot(m.vx, m.vy) < S * 0.00004) { m.vx += (Math.random() - 0.5) * S * 0.0008; m.vy -= S * 0.0006; } });
        if (finished.length === marbles.length || raceT > 14000) { racing = false; races++; ctx.setScore(races); }
      }

      function startRace() {
        if (racing) return;
        resetMarbles(); racing = true; raceT = 0;
        ctx.audio.arp([392, 392, 523], { dur: 0.14, step: 0.22, vol: 0.14, type: "triangle" });
        marbles.forEach(function (m, i) { m.vx = (Math.random() - 0.5) * S * 0.0002; m.vy = S * 0.0002; });
      }
      function placePiece(x, y) {
        const b = boardRect();
        if (y < b.y + S * 0.05 || y > b.y + b.h - S * 0.04) return;
        const i = pieceAt(x, y);
        if (i >= 0) { pieces.splice(i, 1); ctx.audio.tone(300, 0.1, { type: "sine", vol: 0.08, glide: 180 }); return; }
        if (pieces.length >= 12) pieces.shift();
        pieces.push({ kind: tool, x: Math.max(S * 0.1, Math.min(S * 0.9, x)), y: y, dir: tool === "rampL" ? -1 : 1, spin: 0, hit: 1 });
        ctx.audio.tone(520, 0.1, { type: "sine", vol: 0.1, glide: 780 });
        fx.push({ kind: "ring", x: x, y: y, t: 0, dur: 300, r: pieceLen() * 0.5, col: KCOL[tool] });
      }

      // ---- drawing ----
      function drawMarble(m, r, x, y) {
        g.save(); g.translate(x, y); g.scale(1 + m.sq * 0.25, 1 - m.sq * 0.25);
        const gr = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
        gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.3, m.col.a); gr.addColorStop(1, m.col.b);
        g.fillStyle = gr; g.shadowColor = m.col.a; g.shadowBlur = r * 0.8; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); g.shadowBlur = 0;
        const blink = Math.sin(now * 0.003 + m.blink) > 0.96;
        g.fillStyle = "#2a2233";
        [-1, 1].forEach(function (d) { if (blink) { g.fillRect(d * r * 0.35 - r * 0.12, -r * 0.1, r * 0.24, r * 0.05); } else { g.beginPath(); g.ellipse(d * r * 0.35, -r * 0.1, r * 0.11, r * 0.14, 0, 0, TAU); g.fill(); } });
        g.fillStyle = "#fff"; if (!blink) [-1, 1].forEach(function (d) { g.beginPath(); g.arc(d * r * 0.35 - r * 0.04, -r * 0.15, r * 0.045, 0, TAU); g.fill(); });
        g.strokeStyle = "#2a2233"; g.lineWidth = r * 0.08; g.lineCap = "round"; g.beginPath(); g.arc(0, r * 0.2, r * (m.done ? 0.28 : 0.2), 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
        g.restore();
        if (winner === m) {
          const bob = Math.sin(winT * 0.006) * r * 0.15;
          g.save(); g.translate(x, y - r * 1.5 + bob); g.fillStyle = "#ffd36b"; g.shadowColor = "#ffd36b"; g.shadowBlur = r * 0.6;
          g.beginPath(); g.moveTo(-r * 0.6, r * 0.3); g.lineTo(-r * 0.6, -r * 0.3); g.lineTo(-r * 0.25, 0); g.lineTo(0, -r * 0.45); g.lineTo(r * 0.25, 0); g.lineTo(r * 0.6, -r * 0.3); g.lineTo(r * 0.6, r * 0.3); g.closePath(); g.fill(); g.restore();
        }
      }
      function drawPiece(p, x, y, scale) {
        const L = pieceLen() * scale, col = KCOL[p.kind], glow = 0.4 + p.hit * 0.6;
        g.save(); g.translate(x, y); g.lineCap = "round"; g.lineJoin = "round";
        g.shadowColor = col; g.shadowBlur = L * (0.12 + p.hit * 0.15);
        if (p.kind === "rampR" || p.kind === "rampL") {
          const d = p.kind === "rampL" ? -1 : 1;
          g.strokeStyle = col; g.lineWidth = L * 0.11; g.beginPath(); g.moveTo(-d * L * 0.5, -L * 0.28); g.lineTo(d * L * 0.5, L * 0.28); g.stroke();
          g.shadowBlur = 0; g.strokeStyle = "rgba(255,255,255," + glow + ")"; g.lineWidth = L * 0.03; g.stroke();
        } else if (p.kind === "tramp") {
          g.strokeStyle = "rgba(255,255,255,0.3)"; g.shadowBlur = 0; g.lineWidth = L * 0.03; g.beginPath(); g.moveTo(-L * 0.4, 0); g.lineTo(-L * 0.45, L * 0.3); g.moveTo(L * 0.4, 0); g.lineTo(L * 0.45, L * 0.3); g.stroke();
          g.shadowBlur = L * 0.15; g.strokeStyle = col; g.lineWidth = L * 0.1; g.beginPath(); g.moveTo(-L * 0.5, p.hit * L * 0.08); g.lineTo(L * 0.5, p.hit * L * 0.08); g.stroke();
        } else if (p.kind === "bumper") {
          const R = L * 0.2 * (1 + p.hit * 0.15);
          const gr = g.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R); gr.addColorStop(0, "#fff3b0"); gr.addColorStop(1, col);
          g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
          g.shadowBlur = 0; g.strokeStyle = "rgba(255,255,255,0.6)"; g.lineWidth = L * 0.02; g.beginPath(); g.arc(0, 0, R * 0.6, 0, TAU); g.stroke();
        } else if (p.kind === "spinner") {
          g.strokeStyle = col; g.lineWidth = L * 0.09;
          for (let k = 0; k < 3; k++) { const a = p.spin + k * TAU / 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * L * 0.42, Math.sin(a) * L * 0.42); g.stroke(); }
          g.shadowBlur = 0; g.fillStyle = "#fff"; g.beginPath(); g.arc(0, 0, L * 0.07, 0, TAU); g.fill();
        }
        g.restore();
      }
      function draw() {
        g.clearRect(0, 0, S, S);
        const bg = g.createLinearGradient(0, 0, 0, S); bg.addColorStop(0, "#0f0c1e"); bg.addColorStop(1, "#0a0912");
        g.fillStyle = bg; g.fillRect(0, 0, S, S);
        const b = boardRect();
        // board
        g.fillStyle = "rgba(255,255,255,0.03)"; g.fillRect(b.x, b.y, b.w, b.h);
        g.strokeStyle = "rgba(116,185,255,0.25)"; g.lineWidth = 2; g.beginPath(); g.moveTo(0, b.y); g.lineTo(S, b.y); g.stroke();
        // finish line (checkered)
        const fy = b.y + b.h, cs = S * 0.03;
        for (let i = 0; i < S / cs; i++) { g.fillStyle = i % 2 ? "rgba(255,255,255,0.7)" : "rgba(40,40,60,0.9)"; g.fillRect(i * cs, fy, cs, cs * 0.45); }
        // top bar: GO + clear
        const gb = goBtn(), pulse = racing ? 0 : 0.5 + 0.5 * Math.sin(now * 0.004);
        g.save(); g.shadowColor = "#7fe0a0"; g.shadowBlur = S * 0.02 + pulse * S * 0.02;
        g.fillStyle = racing ? "rgba(127,224,160,0.35)" : "#7fe0a0"; g.beginPath(); g.arc(gb.x, gb.y, gb.r * (1 + pulse * 0.06), 0, TAU); g.fill(); g.shadowBlur = 0;
        g.fillStyle = "#0b1a12"; g.beginPath(); g.moveTo(gb.x - gb.r * 0.3, gb.y - gb.r * 0.42); g.lineTo(gb.x + gb.r * 0.48, gb.y); g.lineTo(gb.x - gb.r * 0.3, gb.y + gb.r * 0.42); g.closePath(); g.fill();
        const cb = clearBtn();
        g.fillStyle = "rgba(255,255,255,0.08)"; g.beginPath(); g.arc(cb.x, cb.y, cb.r, 0, TAU); g.fill();
        g.strokeStyle = "rgba(230,236,245,0.8)"; g.lineWidth = Math.max(2, S * 0.005); g.lineCap = "round";
        g.beginPath(); g.arc(cb.x, cb.y, cb.r * 0.5, -0.4 * Math.PI, 1.3 * Math.PI); g.stroke();
        g.beginPath(); g.moveTo(cb.x + cb.r * 0.15, cb.y - cb.r * 0.75); g.lineTo(cb.x + cb.r * 0.5, cb.y - cb.r * 0.5); g.lineTo(cb.x + cb.r * 0.12, cb.y - cb.r * 0.28); g.stroke();
        g.restore();
        // counter
        g.save(); g.textAlign = "left"; g.textBaseline = "middle"; g.fillStyle = "#ffd36b"; g.shadowColor = "rgba(255,211,107,0.6)"; g.shadowBlur = 14;
        g.font = "800 " + Math.round(S * 0.055) + "px system-ui, sans-serif"; g.fillText("★ " + races, S * 0.06, gb.y); g.restore();
        // pieces
        pieces.forEach(function (p) { drawPiece(p, p.x, p.y, 1); });
        // fx rings
        fx.forEach(function (f) { const k = f.t / f.dur; g.save(); g.globalAlpha = 1 - k; g.strokeStyle = f.col; g.lineWidth = 3; g.beginPath(); g.arc(f.x, f.y, f.r * (0.4 + k), 0, TAU); g.stroke(); g.restore(); });
        // marbles
        marbles.forEach(function (m) { drawMarble(m, m.r, m.x, m.y); });
        // confetti
        confetti.forEach(function (c) { g.save(); g.globalAlpha = Math.max(0, c.life); g.fillStyle = c.col; g.translate(c.x, c.y); g.rotate(c.x * 0.05); g.fillRect(-c.r, -c.r * 0.6, c.r * 2, c.r * 1.2); g.restore(); });
        // tray
        const ty = trayY();
        g.fillStyle = "rgba(255,255,255,0.04)"; g.fillRect(0, ty - S * 0.055, S, S * 0.11);
        traySlots().forEach(function (sl) {
          const sel = sl.kind === tool;
          if (sel) { g.save(); g.fillStyle = "rgba(255,255,255,0.1)"; g.strokeStyle = KCOL[sl.kind]; g.lineWidth = 2; g.beginPath(); g.roundRect ? g.roundRect(sl.x - sl.w * 0.45, ty - S * 0.048, sl.w * 0.9, S * 0.096, S * 0.02) : g.rect(sl.x - sl.w * 0.45, ty - S * 0.048, sl.w * 0.9, S * 0.096); g.fill(); g.stroke(); g.restore(); }
          drawPiece({ kind: sl.kind, hit: sel ? 0.5 + 0.5 * Math.sin(now * 0.005) : 0, spin: now * 0.001 }, sl.x, ty, 0.42);
        });
      }

      return {
        mount(stage, c) {
          stageEl = stage; ctx = c;
          reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          const wrap = document.createElement("div");
          wrap.style.display = "flex"; wrap.style.flexDirection = "column"; wrap.style.alignItems = "center";
          canvas = document.createElement("canvas");
          canvas.style.borderRadius = "18px"; canvas.style.background = "#0f0c1e"; canvas.style.cursor = "pointer";
          canvas.style.boxShadow = "0 0 46px rgba(116,185,255,0.14)"; canvas.style.touchAction = "none";
          g = canvas.getContext("2d");
          wrap.appendChild(canvas);
          const hint = document.createElement("div"); hint.className = "hint";
          hint.textContent = "Pick a piece, tap the board to place it (tap a piece to remove) · press ▶ to race the marbles";
          wrap.appendChild(hint);
          stage.appendChild(wrap);
          now = 0; races = 0; confetti = []; fx = []; tool = "rampR"; S = 0;
          resize(); defaultCourse(); resetMarbles();
          ctx.setScore(0);
          Arcade.input.setPointerTarget(canvas);
          unResize = Arcade.board.onResize(function () { resize(); });
          draw();
        },
        handleInput(intent) {
          if (intent.type !== "point" || intent.phase !== "down" || intent.button !== 0) return;
          const x = intent.x, y = intent.y;
          const gb = goBtn(); if (Math.hypot(x - gb.x, y - gb.y) < gb.r * 1.3) { startRace(); return; }
          const cb = clearBtn(); if (Math.hypot(x - cb.x, y - cb.y) < cb.r * 1.4) { pieces = []; resetMarbles(); ctx.audio.tone(400, 0.12, { type: "sine", vol: 0.08, glide: 200 }); return; }
          const slot = traySlots().find(function (sl) { return Math.abs(x - sl.x) < sl.w / 2 && Math.abs(y - sl.y) < S * 0.06; });
          if (slot) { tool = slot.kind; ctx.audio.tone(660, 0.08, { type: "sine", vol: 0.08, glide: 880 }); return; }
          const b = boardRect();
          if (y >= b.y && y <= b.y + b.h) { placePiece(x, y); return; }
        },
        tick(dt) { update(Math.min(50, dt)); draw(); },
        getScore() { return races; },
        teardown() {
          if (unResize) unResize(); unResize = null;
          stageEl = ctx = canvas = g = null; pieces = []; marbles = []; confetti = []; fx = [];
        }
      };
    }
  });
})();
