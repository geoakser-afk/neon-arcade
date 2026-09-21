/* Tongue Tag — 2–6 frogs in a round pond arena; one frog is "it" (glowing red, crown of flames). Left-click hops
   (short arc hops), right-click shoots your tongue. If the "it" frog's tongue touches another frog, THEY become it.
   Every second you are not it = 1 point; first to 60 wins. The arena shrinks over the round (outside it you hop
   at half speed) and four lily pads teleport you to another pad so chases have escapes. Multiplayer through
   Arcade.mpLobby + Arcade.net (each client owns its own frog, the host decides tags / arena / the win). Solo
   "Practice" spawns three local bots. Phones: tap = hop, hold ~350 ms = tongue. */
(function () {
  const TAU = Math.PI * 2, WIN = 60, R = 0.042;            // R = frog radius, in arena units (fractions of the canvas)
  const HOP = 0.11, IT_HOP = 0.12, HOP_MS = 260, TONGUE = 0.3, TONGUE_MS = 400, PAD_CD = 1500, IMMUNE_MS = 1200;
  const RED = "#ff6b6b", PINK = "#ff8fa3", MINT = "#9ff0c0", INK = "#2a2434";
  const PADS = [45, 135, 225, 315].map(function (a) { const t = a * Math.PI / 180; return { x: 0.5 + Math.cos(t) * 0.2, y: 0.5 + Math.sin(t) * 0.2, r: 0.055 }; });
  const PAL = [
    { body: "#9ff0c0", dark: "#4faa78", belly: "#e6fff0" },   // mint
    { body: "#9fd0ff", dark: "#4f88c0", belly: "#e6f3ff" },   // sky
    { body: "#c9b8ff", dark: "#7f6ac8", belly: "#f0ebff" },   // lavender
    { body: "#ffc9a0", dark: "#c88a5a", belly: "#fff1e6" },   // peach
    { body: "#f5f0a0", dark: "#b8a850", belly: "#fffbe6" },   // lemon
    { body: "#ffb3c6", dark: "#c86a86", belly: "#ffe9f0" }    // rose
  ];
  const BOT_NAMES = ["Bop", "Lil", "Moss"];

  function rr(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }
  function ell(g, x, y, rx, ry) { g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU); }
  function dot(g, x, y, r) { g.beginPath(); g.arc(x, y, Math.max(0.1, r), 0, TAU); g.fill(); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function hash(i, j) { let h = (i * 374761393 + j * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177; h = h ^ (h >> 16); return ((h >>> 0) % 10000) / 10000; }
  function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function mix(a, b, k) { const A = hex(a), B = hex(b); return "rgb(" + Math.round(lerp(A[0], B[0], k)) + "," + Math.round(lerp(A[1], B[1], k)) + "," + Math.round(lerp(A[2], B[2], k)) + ")"; }

  function eyes(g, x, y, r, dx, blink) {
    [-1, 1].forEach(function (d) {
      const ex = x + d * dx;
      g.fillStyle = "#fff"; dot(g, ex, y, r);
      if (blink) { g.strokeStyle = INK; g.lineWidth = r * 0.35; g.lineCap = "round"; g.beginPath(); g.moveTo(ex - r * 0.6, y); g.lineTo(ex + r * 0.6, y); g.stroke(); }
      else { g.fillStyle = INK; dot(g, ex, y + r * 0.1, r * 0.5); g.fillStyle = "#fff"; dot(g, ex - r * 0.15, y - r * 0.15, r * 0.16); }
    });
  }
  function smile(g, x, y, r, big) { g.strokeStyle = INK; g.lineWidth = Math.max(1.5, r * 0.28); g.lineCap = "round"; g.beginPath(); g.arc(x, y, r, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); if (big) { g.fillStyle = PINK; g.beginPath(); g.arc(x, y + r * 0.55, r * 0.45, 0, Math.PI); g.fill(); } }
  function frown(g, x, y, r) { g.strokeStyle = INK; g.lineWidth = Math.max(1.5, r * 0.28); g.lineCap = "round"; g.beginPath(); g.arc(x, y + r, r, 1.15 * Math.PI, 1.85 * Math.PI); g.stroke(); }

  // frog body (px coords). o: {body,dark,belly,blink,sq,tongue:{tx,ty,k} in px,angry,happy}. No shadowBlur — a cheap halo instead.
  function drawFrog(g, x, y, r, face, o) {
    const body = o.body, dark = o.dark, belly = o.belly, sq = o.sq || 0, tongue = o.tongue;
    g.save(); g.translate(x, y); g.scale(face < 0 ? -1 : 1, 1); g.scale(1 + sq * 0.12, 1 - sq * 0.12);
    g.globalAlpha = 0.16; g.fillStyle = body; ell(g, 0, r * 0.1, r * 1.4, r * 1.2); g.fill(); g.globalAlpha = 1;
    g.fillStyle = dark;
    ell(g, -r * 0.85, r * 0.45, r * 0.5, r * 0.3); g.fill(); ell(g, r * 0.85, r * 0.45, r * 0.5, r * 0.3); g.fill();
    [-1, 1].forEach(function (d) { for (let i = -1; i <= 1; i++) { ell(g, d * (r * 1.1 + i * r * 0.16), r * 0.66, r * 0.09, r * 0.16); g.fill(); } });
    g.fillStyle = body; ell(g, 0, r * 0.05, r, r * 0.85); g.fill();
    g.fillStyle = belly; ell(g, 0, r * 0.35, r * 0.6, r * 0.42); g.fill();
    g.fillStyle = dark; ell(g, -r * 0.55, r * 0.72, r * 0.2, r * 0.26); g.fill(); ell(g, r * 0.55, r * 0.72, r * 0.2, r * 0.26); g.fill();
    g.fillStyle = body; dot(g, -r * 0.5, -r * 0.62, r * 0.36); dot(g, r * 0.5, -r * 0.62, r * 0.36);
    eyes(g, 0, -r * 0.62, r * 0.27, r * 0.5, o.blink);
    g.fillStyle = "rgba(255,143,163,0.55)"; dot(g, -r * 0.62, -r * 0.02, r * 0.14); dot(g, r * 0.62, -r * 0.02, r * 0.14);
    if (tongue && tongue.k > 0) {
      g.save(); g.scale(face < 0 ? -1 : 1, 1);
      g.strokeStyle = "#ff6b8a"; g.lineWidth = r * 0.22; g.lineCap = "round";
      g.beginPath(); g.moveTo(0, -r * 0.05); g.lineTo(tongue.tx * tongue.k, -r * 0.05 + tongue.ty * tongue.k); g.stroke();
      g.fillStyle = "#ff6b8a"; dot(g, tongue.tx * tongue.k, -r * 0.05 + tongue.ty * tongue.k, r * 0.2);
      g.restore();
      g.fillStyle = INK; ell(g, 0, -r * 0.05, r * 0.22, r * 0.17); g.fill();
    } else if (o.angry) frown(g, 0, -r * 0.1, r * 0.3); else smile(g, 0, -r * 0.2, r * 0.36, o.happy);
    g.restore();
  }
  function drawFlames(g, x, y, r, now) {
    g.save(); g.translate(x, y - r * 1.2);
    for (let i = -2; i <= 2; i++) {
      const ph = now / 90 + i * 1.7, h = r * (0.5 + 0.22 * Math.sin(ph)), w = r * 0.2, bx = i * r * 0.28;
      g.fillStyle = (i + 2) % 2 ? "#ffb86b" : RED; g.globalAlpha = 0.9;
      g.beginPath(); g.moveTo(bx - w, 0); g.quadraticCurveTo(bx - w * 0.7, -h * 0.5, bx + Math.sin(ph) * w * 0.5, -h); g.quadraticCurveTo(bx + w * 0.7, -h * 0.5, bx + w, 0); g.closePath(); g.fill();
    }
    g.restore();
  }
  function drawPad(g, x, y, r, hot, now) {
    g.save(); g.translate(x, y);
    g.fillStyle = hot ? "rgba(159,240,192,0.16)" : "rgba(159,240,192,0.08)"; dot(g, 0, 0, r * (1.25 + 0.05 * Math.sin(now / 400)));
    g.fillStyle = hot ? "#4faa78" : "#3d7d5c";
    g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, 0.22, TAU - 0.22); g.closePath(); g.fill();
    g.strokeStyle = "rgba(230,255,240,0.35)"; g.lineWidth = Math.max(1, r * 0.06);
    for (let i = 0; i < 5; i++) { const a = 0.6 + i * 1.1; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85); g.stroke(); }
    g.fillStyle = "rgba(255,255,255,0.25)"; ell(g, -r * 0.3, -r * 0.35, r * 0.28, r * 0.14); g.fill();
    g.restore();
  }

  Arcade.register({
    id: "tongue", name: "Tongue Tag", tagline: "One frog is it. Don't get licked.", accent: "#ff8fa3",
    complexity: "med", controls: "click", scoreLabel: "Points",
    create() {
      let canvas, g, S = 600, dpr = 1, ctx, hint, unsub = null, touchDevice = false, reduced = false, onCtx = null;
      let scene = "title", mode = null, now = 0, frogs = {}, order = [], me = null, itId = null, immune = {};
      let arena = { r: 0.46, tr: 0.46, el: 0 }, freeze = 0, fx = [], toasts = [], flash = 0, winner = null, resultsT = 0, btns = [];
      let sendT = 0, arenaT = 0, taggedT = -9999, hold = null, hopSnd = -9999;

      function A() { return ctx.audio; }
      function isHost() { return mode === "online" && !!(window.Arcade.mpLobby && Arcade.mpLobby.isHost()); }
      function authority() { return mode === "practice" || isHost(); }
      function myName() { try { const u = Arcade.auth && Arcade.auth.isSignedIn() && Arcade.auth.user(); return (u && u.name) || "You"; } catch (e) { return "You"; } }
      function r3(v) { return Math.round(v * 1000) / 1000; }
      function outside(f) { return Math.hypot(f.x - 0.5, f.y - 0.5) > arena.r; }
      function arenaR(el) { return Math.max(0.24, 0.46 - el / 150000 * 0.22); }
      function toast(text, col) { toasts.push({ text: text, col: col || "#e6ecf5", t: 0, dur: 2200 }); if (toasts.length > 3) toasts.shift(); }
      function ripple(x, y, col) { fx.push({ kind: "ring", x: x, y: y, t: 0, dur: 600, col: col || MINT, r0: R * 0.6, r1: R * 3 }); }

      function sndHop() { if (now - hopSnd < 110) return; hopSnd = now; A().tone(240, 0.1, { type: "triangle", vol: 0.05, glide: 520 }); }
      function sndTongue() { A().tone(620, 0.09, { type: "sine", vol: 0.06, glide: 1100 }); }
      function sndPad() { A().arp([523, 784, 1046], { dur: 0.1, step: 0.05, vol: 0.06, type: "sine" }); }
      function sndTag() { A().arp([440, 330], { dur: 0.12, step: 0.06, vol: 0.1, type: "triangle" }); }
      function sndTaggedMe() { A().tone(200, 0.28, { type: "sawtooth", vol: 0.07, glide: 90 }); A().tone(400, 0.12, { type: "triangle", vol: 0.06, glide: 150 }); }
      function sndGo() { A().arp([523, 784], { dur: 0.14, step: 0.07, vol: 0.09, type: "triangle" }); }
      function sndWin(mine) { A().arp(mine ? [523, 659, 784, 1046, 1318] : [392, 494, 587, 784], { dur: 0.2, step: 0.08, vol: 0.12, type: "sine" }); }

      function mkFrog(id, name, ci, i, n) {
        const a = (i / Math.max(1, n)) * TAU - Math.PI / 2, x = 0.5 + Math.cos(a) * 0.3, y = 0.5 + Math.sin(a) * 0.3;
        return { id: id, name: String(name || "Frog").slice(0, 16), ci: ci % PAL.length, x: x, y: y, tx: x, ty: y, face: 1, z: 0, sq: 0, hop: null, goal: null, rest: 0, tongue: null, tcd: 0, padCd: 0, score: 0, scT: 0, blink: 0, tp: 0, remote: false, bot: false, ai: null };
      }

      // ---- actions (owner-side only) ----
      function hopTo(f, x, y) { if (!f) return; f.goal = { x: clamp(x, R, 1 - R), y: clamp(y, R, 1 - R) }; }
      function tongueAt(f, x, y) {
        if (!f || f.tongue || f.tcd > 0) return;
        const dx = x - f.x, dy = y - f.y, d = Math.hypot(dx, dy) || 1, L = Math.min(d, TONGUE);
        f.tongue = { tx: dx / d * L, ty: dy / d * L, t: 0, dur: TONGUE_MS, remote: false, k: 0 };
        f.tcd = TONGUE_MS + 250; if (Math.abs(dx) > 0.005) f.face = dx < 0 ? -1 : 1;
        if (f === me) sndTongue();
      }
      function tk(f) { const t = f.tongue; if (!t) return 0; return t.remote ? t.k : Math.sin(Math.min(1, t.t / t.dur) * Math.PI); }
      function tongueTouches(f, q) {
        const t = f.tongue; if (!t) return false; const k = tk(f); if (k <= 0.05) return false;
        const ex = t.tx * k, ey = t.ty * k, L = Math.hypot(ex, ey); if (L < 1e-6) return false;
        const ux = ex / L, uy = ey / L, px = q.x - f.x, py = q.y - f.y, cp = clamp(px * ux + py * uy, 0, L);
        return Math.hypot(px - ux * cp, py - uy * cp) < R * 1.1;
      }
      function land(f) {
        if (f.padCd > 0) return;
        for (let i = 0; i < PADS.length; i++) {
          const p = PADS[i]; if (Math.hypot(f.x - p.x, f.y - p.y) >= p.r) continue;
          const j = (i + 1 + Math.floor(Math.random() * (PADS.length - 1))) % PADS.length, q = PADS[j];
          ripple(f.x, f.y); f.x = q.x; f.y = q.y; f.goal = null; f.padCd = PAD_CD; f.tp = (f.tp + 1) % 1000; ripple(q.x, q.y);
          if (f === me || mode === "practice") sndPad();
          return;
        }
      }
      function moveFrog(f, dt) {
        f.blink -= dt; if (f.blink < -2600 - Math.random() * 2000) f.blink = 150;
        f.sq = Math.max(0, f.sq - dt / 220); f.tcd -= dt; f.padCd -= dt;
        if (f.remote) {
          const k = Math.min(1, dt / 80); f.x += (f.tx - f.x) * k; f.y += (f.ty - f.y) * k;
          if (f.tongue) { f.tongue.t += dt; if (f.tongue.t > 250) f.tongue.k = Math.max(0, f.tongue.k - dt / 200); if (f.tongue.t > 700) f.tongue = null; }
          return;
        }
        if (f.hop) { const h = f.hop; h.t += dt; const k = Math.min(1, h.t / h.dur); f.x = lerp(h.x0, h.x1, k); f.y = lerp(h.y0, h.y1, k); f.z = Math.sin(k * Math.PI); if (k >= 1) { f.hop = null; f.z = 0; f.rest = 60; f.sq = 0.6; land(f); } }
        else if (f.goal) {
          const dx = f.goal.x - f.x, dy = f.goal.y - f.y, d = Math.hypot(dx, dy);
          if (d < 0.006) f.goal = null;
          else { f.rest -= dt; if (f.rest <= 0) { const len = Math.min(d, f.id === itId ? IT_HOP : HOP), slow = outside(f) ? 2 : 1; f.hop = { x0: f.x, y0: f.y, x1: clamp(f.x + dx / d * len, R, 1 - R), y1: clamp(f.y + dy / d * len, R, 1 - R), t: 0, dur: HOP_MS * slow }; if (Math.abs(dx) > 0.005) f.face = dx < 0 ? -1 : 1; if (f === me) sndHop(); } }
        }
        if (f.tongue) { f.tongue.t += dt; if (f.tongue.t >= f.tongue.dur) f.tongue = null; }
      }

      // ---- tags / rounds ----
      function applyTag(victim, by) {
        const v = frogs[victim]; if (!v || itId === victim) return;
        itId = victim; immune[victim] = now + IMMUNE_MS; v.scT = 0;
        fx.push({ kind: "ring", x: v.x, y: v.y, t: 0, dur: 750, col: RED, r0: R, r1: R * 5 });
        if (by && frogs[by]) fx.push({ kind: "ring", x: frogs[by].x, y: frogs[by].y, t: 0, dur: 400, col: PINK, r0: R, r1: R * 2.5 });
        if (!reduced) flash = 220;
        if (by && frogs[by]) toast(frogs[by].name + " tagged " + (v === me ? "YOU" : v.name) + "!", RED);
        else toast(v === me ? "You're IT first!" : v.name + " is IT first!", RED);
        if (v === me) sndTaggedMe(); else sndTag();
      }
      function doTag(victim, by) { applyTag(victim, by); if (isHost()) Arcade.mpLobby.send({ k: "it", id: victim, by: by || null }); }
      function pickIt() { const ids = Object.keys(frogs); if (!ids.length) return; doTag(ids[Math.floor(Math.random() * ids.length)], null); }
      function beginRound() {
        scene = "play"; freeze = 3000; arena = { r: 0.46, tr: 0.46, el: 0 }; fx = []; toasts = []; flash = 0; winner = null; resultsT = 0; sendT = 0; arenaT = 0; itId = null; immune = {}; btns = [];
        Object.keys(frogs).forEach(function (id) { const f = frogs[id]; f.score = 0; f.scT = 0; f.tongue = null; f.hop = null; f.goal = null; f.padCd = 0; f.tcd = 0; f.z = 0; });
        ctx.setScore(0);
      }
      function doWin(id) {
        if (scene !== "play" || !frogs[id]) return;
        scene = "results"; winner = id; resultsT = 0; btns = [];
        if (me) ctx.storage.recordScore(me.score);
        sndWin(id === (me && me.id)); fx.push({ kind: "ring", x: frogs[id].x, y: frogs[id].y, t: 0, dur: 1200, col: "#ffd36b", r0: R, r1: R * 8 });
        if (isHost()) Arcade.mpLobby.send({ k: "win", id: id });
      }
      function toTitle() {
        scene = "title"; mode = null; me = null; itId = null; immune = {}; order = []; frogs = {}; fx = []; flash = 0; winner = null; btns = []; clearHold();
        for (let i = 0; i < 3; i++) { const f = mkFrog("idle" + i, BOT_NAMES[i], i + 1, i, 3); f.bot = true; f.ai = { t: Math.random() * 400 }; frogs[f.id] = f; }
        if (hint) hint.textContent = touchDevice ? "tap to hop · hold to tongue" : "left-click hop · right-click tongue";
      }
      function startPractice() {
        mode = "practice"; frogs = {}; order = [];
        me = mkFrog("me", myName(), 0, 0, 4); frogs.me = me; order.push("me");
        for (let i = 1; i <= 3; i++) { const b = mkFrog("bot" + i, BOT_NAMES[i - 1], i, i, 4); b.bot = true; b.ai = { t: Math.random() * 400, side: 1 }; frogs[b.id] = b; order.push(b.id); }
        beginRound(); pickIt();
      }

      // ---- bots (practice + title idle) ----
      function inArena(x, y, m) { const dx = x - 0.5, dy = y - 0.5, d = Math.hypot(dx, dy) || 1, lim = arena.r * (m || 0.85); return d <= lim ? { x: x, y: y } : { x: 0.5 + dx / d * lim, y: 0.5 + dy / d * lim }; }
      function botThink(b, dt) {
        b.ai.t -= dt; if (b.ai.t > 0) return; b.ai.t = 260 + Math.random() * 300;
        if (scene !== "play") { if (!b.goal && Math.random() < 0.45) { const p = inArena(0.5 + (Math.random() - 0.5) * 0.8, 0.5 + (Math.random() - 0.5) * 0.8); hopTo(b, p.x, p.y); } return; }
        if (freeze > 0) return;
        const it = itId ? frogs[itId] : null;
        if (b.id === itId) {
          let best = null, bd = 9;
          Object.keys(frogs).forEach(function (id) { const q = frogs[id]; if (q === b || immune[id] > now) return; const d = Math.hypot(q.x - b.x, q.y - b.y); if (d < bd) { bd = d; best = q; } });
          if (!best) return;
          const lead = best.hop ? 0.5 : 0, ax = best.x + (best.hop ? (best.hop.x1 - best.x) * lead : 0), ay = best.y + (best.hop ? (best.hop.y1 - best.y) * lead : 0);
          if (bd < TONGUE * 0.9 && !b.tongue && b.tcd <= 0 && Math.random() < 0.75) tongueAt(b, ax, ay); else hopTo(b, ax, ay);
        } else if (it) {
          const dx = b.x - it.x, dy = b.y - it.y, d = Math.hypot(dx, dy) || 1;
          if (d < 0.4) {
            if (b.padCd <= 0 && Math.random() < 0.5) { const pad = PADS.filter(function (p) { return Math.hypot(p.x - b.x, p.y - b.y) < 0.18; })[0]; if (pad) { hopTo(b, pad.x, pad.y); return; } }
            const ax = dx / d, ay = dy / d, side = b.ai.side || 1;
            let gx = b.x + ax * 0.25 - ay * side * 0.12, gy = b.y + ay * 0.25 + ax * side * 0.12;
            const p = inArena(gx, gy, 0.88);
            if (Math.hypot(p.x - gx, p.y - gy) > 0.05) { b.ai.side = -side; const cx = 0.5 - b.x, cy = 0.5 - b.y, cd = Math.hypot(cx, cy) || 1; gx = b.x - ay * side * 0.2 + cx / cd * 0.1; gy = b.y + ax * side * 0.2 + cy / cd * 0.1; const p2 = inArena(gx, gy, 0.9); hopTo(b, p2.x, p2.y); }
            else hopTo(b, p.x, p.y);
          } else if (Math.random() < 0.35 || outside(b)) { const p = inArena(0.5 + (Math.random() - 0.5) * 1.2 * arena.r, 0.5 + (Math.random() - 0.5) * 1.2 * arena.r, 0.8); hopTo(b, p.x, p.y); }
        }
      }

      // ---- multiplayer (Arcade.mpLobby) ----
      function openLobby() {
        if (!window.Arcade.mpLobby || !window.Arcade.net) { toast("Multiplayer isn't available here.", "#b8b2cc"); return; }
        Arcade.mpLobby.open({ title: "Tongue Tag", minPlayers: 2, onStart: netStart, onMsg: netMsg, onLeave: netLeave, onPeer: netPeer });
      }
      function netStart(info) {
        mode = "online"; frogs = {}; order = []; clearHold();
        const roster = Arcade.mpLobby.players();
        roster.forEach(function (p, i) { const f = mkFrog(p.id, p.name, i, i, roster.length); f.remote = p.id !== info.me.id; frogs[p.id] = f; order.push(p.id); });
        me = frogs[info.me.id];
        if (!me) { me = mkFrog(info.me.id, info.me.name, order.length, order.length, roster.length + 1); frogs[me.id] = me; order.push(me.id); }
        beginRound(); toast("Tongue Tag — first to " + WIN + " wins!", "#ffd36b");
        if (info.isHost) pickIt();
      }
      function addRemote(id, name) {
        const f = mkFrog(id, name, order.length, order.length, order.length + 1); f.remote = true; frogs[id] = f; order.push(id); return f;
      }
      function netMsg(m) {
        const d = m.d || {}; if (!d.k || mode !== "online") return;
        if (d.k === "p") {
          let q = frogs[m.from];
          if (!q) { const r = Arcade.mpLobby.players().find(function (z) { return z.id === m.from; }); q = addRemote(m.from, r ? r.name : "Frog"); }
          q.remote = true;
          if (d.tp !== q.tp) { q.x = d.x; q.y = d.y; q.tp = d.tp; ripple(d.x, d.y); }
          q.tx = d.x; q.ty = d.y; q.face = d.f || 1; q.z = d.z || 0; q.sq = d.sq || 0; q.score = d.sc || 0;
          if (d.tg) { if (!q.tongue) q.tongue = { remote: true, t: 0 }; q.tongue.tx = d.tg[0]; q.tongue.ty = d.tg[1]; q.tongue.k = d.tg[2]; q.tongue.t = 0; q.tongue.dur = TONGUE_MS; } else q.tongue = null;
          return;
        }
        if (d.k === "it") { if (frogs[d.id]) applyTag(d.id, d.by); return; }
        if (d.k === "tagged") {
          if (!isHost() || scene !== "play" || freeze > 0) return;
          const v = frogs[d.id]; if (!v || d.id === itId || immune[d.id] > now) return;
          if (m.from !== itId && m.from !== d.id) return;          // only the tagger or the victim may report it
          doTag(d.id, itId); return;
        }
        if (d.k === "arena") { if (isHost()) return; arena.tr = d.r; if (typeof d.el === "number") arena.el = d.el; if (d.it && frogs[d.it] && d.it !== itId && scene === "play") itId = d.it; return; }
        if (d.k === "win") { if (frogs[d.id]) doWin(d.id); return; }
      }
      function netPeer(q, what) {
        if (mode !== "online") return;
        if (what === "leave") {
          const wasIt = itId === q.id; delete frogs[q.id]; order = order.filter(function (id) { return id !== q.id; });
          toast(q.name + " left.", "#b8b2cc");
          if (wasIt) { itId = null; if (isHost() && scene === "play") pickIt(); }
        } else if (what === "join") { if (!frogs[q.id]) addRemote(q.id, q.name); toast(q.name + " joined!", "#7fe0a0"); }
      }
      function netLeave() { if (mode === "online") { toTitle(); toast("Left the room.", "#b8b2cc"); } }
      function packet() {
        const k = tk(me);
        return { k: "p", x: r3(me.x), y: r3(me.y), f: me.face, z: Math.round(me.z * 100) / 100, sq: Math.round(me.sq * 100) / 100, tg: me.tongue ? [r3(me.tongue.tx), r3(me.tongue.ty), Math.round(k * 100) / 100] : 0, sc: me.score, tp: me.tp };
      }

      // ---- input ----
      function clearHold() { if (hold && hold.timer) clearTimeout(hold.timer); hold = null; }
      function hitBtn(px, py) { for (let i = 0; i < btns.length; i++) { const b = btns[i]; if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) { A().tick(); b.fn(); return true; } } return false; }

      // ---- tick ----
      function tick(dt) {
        now += dt;
        if (freeze > 0 && scene === "play") { freeze -= dt; if (freeze <= 0) { freeze = 0; toast("GO!", MINT); sndGo(); } }
        Object.keys(frogs).forEach(function (id) { const f = frogs[id]; if (f.bot) botThink(f, dt); moveFrog(f, dt); });
        if (scene === "play") {
          if (authority()) {
            arena.el += dt; arena.tr = arenaR(arena.el);
            if (freeze <= 0 && itId && frogs[itId] && frogs[itId].tongue) {
              const it = frogs[itId], ids = Object.keys(frogs);
              for (let i = 0; i < ids.length; i++) { const q = frogs[ids[i]]; if (q === it || immune[q.id] > now) continue; if (tongueTouches(it, q)) { doTag(q.id, it.id); break; } }
            }
          }
          if (freeze <= 0 && itId) Object.keys(frogs).forEach(function (id) {
            const f = frogs[id]; if (f.remote || id === itId) return;
            f.scT += dt; while (f.scT >= 1000) { f.scT -= 1000; f.score++; if (f === me) ctx.setScore(me.score); }
          });
          if (authority()) { const ids = Object.keys(frogs); for (let i = 0; i < ids.length; i++) if (frogs[ids[i]].score >= WIN) { doWin(ids[i]); break; } }
          if (mode === "online" && !isHost() && freeze <= 0 && itId && now - taggedT > 300) {
            const it = frogs[itId];
            if (it && it.tongue) {
              if (it === me) { const ids = Object.keys(frogs); for (let i = 0; i < ids.length; i++) { const q = frogs[ids[i]]; if (q === me || immune[q.id] > now) continue; if (tongueTouches(me, q)) { Arcade.mpLobby.send({ k: "tagged", id: q.id }); taggedT = now; break; } } }
              else if (!(immune[me.id] > now) && tongueTouches(it, me)) { Arcade.mpLobby.send({ k: "tagged", id: me.id }); taggedT = now; }
            }
          }
        }
        arena.r += (arena.tr - arena.r) * Math.min(1, dt / 300);
        if (mode === "online" && me && (scene === "play" || scene === "results")) {
          sendT += dt; if (sendT > 66) { sendT = 0; Arcade.mpLobby.send(packet()); }
          if (isHost()) { arenaT += dt; if (arenaT > 500) { arenaT = 0; Arcade.mpLobby.send({ k: "arena", r: r3(arena.tr), it: itId, el: Math.round(arena.el) }); } }
        }
        if (scene === "results") resultsT += dt;
        fx = fx.filter(function (e) { e.t += dt; return e.t < e.dur; });
        toasts = toasts.filter(function (t) { t.t += dt; return t.t < t.dur; });
        if (flash > 0) flash -= dt;
        draw();
      }

      // ---- drawing ----
      function button(x, y, w, h, label, primary, fn) {
        btns.push({ x: x, y: y, w: w, h: h, fn: fn, label: label });
        rr(g, x, y, w, h, h / 2); g.fillStyle = primary ? PINK : "rgba(255,255,255,0.08)"; g.fill();
        if (!primary) { g.strokeStyle = "rgba(255,255,255,0.28)"; g.lineWidth = 1.5; g.stroke(); }
        g.fillStyle = primary ? "#1a0d14" : "#e6ecf5"; g.font = "800 " + Math.round(h * 0.38) + "px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(label, x + w / 2, y + h / 2 + 1);
      }
      function nameTag(f, px, py) {
        const label = f.name + (f === me ? " (you)" : ""), fs = Math.round(S * 0.019), it = f.id === itId;
        g.font = "800 " + fs + "px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
        const w = g.measureText(label).width + S * 0.022, y = py - R * S * 2.35 - (it ? S * 0.012 : 0), h = S * 0.03;
        rr(g, px - w / 2, y - h / 2, w, h, h / 2); g.fillStyle = it ? "rgba(255,107,107,0.85)" : (f === me ? "rgba(255,255,255,0.16)" : "rgba(8,12,18,0.7)"); g.fill();
        g.fillStyle = it ? "#1a0d14" : "#e6ecf5"; g.fillText(label, px, y + 1);
      }
      function draw() {
        btns = [];
        g.clearRect(0, 0, S, S);
        g.fillStyle = "#0a1412"; g.fillRect(0, 0, S, S);
        // faint static pond specks
        g.fillStyle = "rgba(159,240,192,0.07)";
        for (let i = 0; i < 40; i++) { const x = hash(i, 3) * S, y = hash(i, 7) * S; dot(g, x, y, S * (0.002 + hash(i, 11) * 0.004)); }
        // arena
        const cx = S / 2, cy = S / 2, ar = arena.r * S;
        g.fillStyle = "rgba(127,224,160,0.07)"; dot(g, cx, cy, ar);
        g.save(); g.shadowColor = MINT; g.shadowBlur = S * 0.018; g.strokeStyle = "rgba(159,240,192,0.75)"; g.lineWidth = Math.max(1.5, S * 0.004); g.beginPath(); g.arc(cx, cy, ar, 0, TAU); g.stroke(); g.restore();
        g.strokeStyle = "rgba(159,240,192,0.18)"; g.lineWidth = 1; g.setLineDash([S * 0.01, S * 0.014]); g.beginPath(); g.arc(cx, cy, ar * 1.06, 0, TAU); g.stroke(); g.setLineDash([]);
        // pads
        PADS.forEach(function (p) { drawPad(g, p.x * S, p.y * S, p.r * S, !me || me.padCd <= 0, now); });
        // fx rings (under frogs)
        fx.forEach(function (e) { const k = e.t / e.dur; g.strokeStyle = e.col; g.globalAlpha = (1 - k) * 0.8; g.lineWidth = Math.max(1, S * 0.006 * (1 - k)); g.beginPath(); g.arc(e.x * S, e.y * S, lerp(e.r0, e.r1, k) * S, 0, TAU); g.stroke(); });
        g.globalAlpha = 1;
        // frogs, back to front
        const list = Object.keys(frogs).map(function (id) { return frogs[id]; }).sort(function (a, b) { return a.y - b.y; });
        const it = itId ? frogs[itId] : null;
        if (it) { const pulse = 0.5 + 0.5 * Math.sin(now / 160); g.save(); g.shadowColor = RED; g.shadowBlur = S * (0.02 + 0.015 * pulse); g.fillStyle = "rgba(255,107,107," + (0.16 + 0.12 * pulse) + ")"; dot(g, it.x * S, it.y * S + R * S * 0.5, R * S * (1.5 + 0.2 * pulse)); g.restore(); }
        list.forEach(function (f) {
          const px = f.x * S, py = f.y * S - f.z * R * S * 1.3, r = R * S, pal = PAL[f.ci], isIt = f.id === itId;
          g.fillStyle = "rgba(0,0,0,0.3)"; ell(g, px, f.y * S + r * 0.75, r * (0.9 - f.z * 0.3), r * 0.3); g.fill();
          const pulse = 0.5 + 0.5 * Math.sin(now / 160);
          const body = isIt ? mix(pal.body, RED, 0.45 + 0.3 * pulse) : pal.body, dark = isIt ? mix(pal.dark, "#a83a3a", 0.5) : pal.dark;
          const tg = f.tongue ? { tx: f.tongue.tx * S, ty: f.tongue.ty * S, k: tk(f) } : null;
          drawFrog(g, px, py, r, f.face, { body: body, dark: dark, belly: pal.belly, blink: f.blink > 0, sq: f.sq, tongue: tg, angry: isIt, happy: !isIt && scene === "results" && winner === f.id });
          if (isIt) drawFlames(g, px, py, r, now);
          if (immune[f.id] > now && scene === "play") { g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 1.5; g.setLineDash([S * 0.006, S * 0.006]); g.beginPath(); g.arc(px, py + r * 0.1, r * 1.6, 0, TAU); g.stroke(); g.setLineDash([]); }
        });
        list.forEach(function (f) { if (scene !== "title") nameTag(f, f.x * S, f.y * S - f.z * R * S * 1.3); });
        // HUD
        if (scene === "play" || scene === "results") {
          const rows = list.slice().sort(function (a, b) { return b.score - a.score; }), fs = Math.round(S * 0.02);
          g.font = "700 " + fs + "px system-ui, sans-serif"; g.textAlign = "left"; g.textBaseline = "middle";
          const pw = S * 0.26, ph = S * 0.012 + rows.length * fs * 1.5; rr(g, S * 0.02, S * 0.02, pw, ph, S * 0.014); g.fillStyle = "rgba(8,12,18,0.62)"; g.fill();
          rows.forEach(function (f, i) {
            const y = S * 0.026 + fs * 0.75 + i * fs * 1.5, isIt = f.id === itId;
            g.fillStyle = PAL[f.ci].body; dot(g, S * 0.04, y, fs * 0.3);
            g.fillStyle = isIt ? RED : (f === me ? "#fff" : "#cfd6e2"); g.fillText(f.name.slice(0, 11), S * 0.055, y);
            g.textAlign = "right"; g.fillStyle = "#e6ecf5"; g.fillText(String(f.score) + (isIt ? "  IT" : ""), S * 0.02 + pw - S * 0.014, y); g.textAlign = "left";
          });
          g.textAlign = "right"; g.fillStyle = "rgba(230,236,245,0.6)"; g.font = "700 " + Math.round(S * 0.018) + "px system-ui, sans-serif"; g.fillText("first to " + WIN, S - S * 0.03, S * 0.04);
          if (me && outside(me) && scene === "play") { g.textAlign = "center"; g.fillStyle = "rgba(255,143,163,0.85)"; g.font = "800 " + Math.round(S * 0.022) + "px system-ui, sans-serif"; g.fillText("outside the ring — half speed!", S / 2, S - S * 0.045); }
          if (freeze > 0) { const n = Math.ceil(freeze / 1000); g.save(); g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = MINT; g.shadowColor = MINT; g.shadowBlur = S * 0.02; g.font = "900 " + Math.round(S * 0.16) + "px system-ui, sans-serif"; g.globalAlpha = 0.9; g.fillText(String(n), S / 2, S * 0.42); g.font = "700 " + Math.round(S * 0.028) + "px system-ui, sans-serif"; g.fillText(itId && frogs[itId] ? (frogs[itId] === me ? "you are IT — go lick someone" : frogs[itId].name + " is IT — run!") : "get ready…", S / 2, S * 0.54); g.restore(); }
        }
        // toasts
        toasts.forEach(function (t, i) { const k = t.t / t.dur, a = k < 0.1 ? k / 0.1 : k > 0.8 ? (1 - k) / 0.2 : 1; g.save(); g.globalAlpha = a; g.textAlign = "center"; g.textBaseline = "middle"; g.font = "800 " + Math.round(S * 0.026) + "px system-ui, sans-serif"; const w = g.measureText(t.text).width + S * 0.04, y = S * 0.12 + i * S * 0.045; rr(g, S / 2 - w / 2, y - S * 0.019, w, S * 0.038, S * 0.019); g.fillStyle = "rgba(8,12,18,0.7)"; g.fill(); g.fillStyle = t.col; g.fillText(t.text, S / 2, y + 1); g.restore(); });
        if (flash > 0) { g.fillStyle = "rgba(255,107,107," + (flash / 220 * 0.22) + ")"; g.fillRect(0, 0, S, S); }
        if (scene === "title") drawTitle(); else if (scene === "results") drawResults();
      }
      function drawTitle() {
        g.fillStyle = "rgba(6,10,12,0.55)"; g.fillRect(0, 0, S, S);
        g.save(); g.textAlign = "center"; g.textBaseline = "middle";
        g.fillStyle = PINK; g.shadowColor = PINK; g.shadowBlur = S * 0.03; g.font = "900 " + Math.round(S * 0.095) + "px system-ui, sans-serif"; g.fillText("Tongue Tag", S / 2, S * 0.3); g.shadowBlur = 0;
        g.fillStyle = "#cfd6e2"; g.font = "600 " + Math.round(S * 0.026) + "px system-ui, sans-serif"; g.fillText("One frog is it. Don't get licked.", S / 2, S * 0.385);
        g.fillStyle = "rgba(207,214,226,0.6)"; g.font = "600 " + Math.round(S * 0.02) + "px system-ui, sans-serif";
        g.fillText("2–6 frogs · first to " + WIN + " points · the ring shrinks · lily pads teleport", S / 2, S * 0.43);
        g.fillText(touchDevice ? "tap = hop · hold = tongue" : "left-click = hop · right-click = tongue", S / 2, S * 0.465);
        g.restore();
        const bw = S * 0.4, bh = S * 0.075;
        button(S / 2 - bw / 2, S * 0.53, bw, bh, "Play Together", true, openLobby);
        button(S / 2 - bw / 2, S * 0.53 + bh + S * 0.025, bw, bh, "Practice", false, startPractice);
      }
      function drawResults() {
        const w = frogs[winner], rows = Object.keys(frogs).map(function (id) { return frogs[id]; }).sort(function (a, b) { return b.score - a.score; });
        g.fillStyle = "rgba(6,10,12,0.6)"; g.fillRect(0, 0, S, S);
        const pw = S * 0.62, ph = S * 0.3 + rows.length * S * 0.04, px = S / 2 - pw / 2, py = S * 0.16;
        rr(g, px, py, pw, ph, S * 0.03); g.fillStyle = "#14112a"; g.fill(); g.strokeStyle = "rgba(255,143,163,0.4)"; g.lineWidth = 1.5; g.stroke();
        g.save(); g.textAlign = "center"; g.textBaseline = "middle";
        g.fillStyle = "#ffd36b"; g.shadowColor = "#ffd36b"; g.shadowBlur = S * 0.02; g.font = "900 " + Math.round(S * 0.055) + "px system-ui, sans-serif"; g.fillText((w ? (w === me ? "You win!" : w.name + " wins!") : "Round over"), S / 2, py + S * 0.07); g.shadowBlur = 0;
        g.font = "700 " + Math.round(S * 0.024) + "px system-ui, sans-serif";
        rows.forEach(function (f, i) { const y = py + S * 0.14 + i * S * 0.04; g.fillStyle = PAL[f.ci].body; dot(g, px + S * 0.08, y, S * 0.009); g.textAlign = "left"; g.fillStyle = f === me ? "#fff" : "#cfd6e2"; g.fillText((i + 1) + ".  " + f.name, px + S * 0.1, y); g.textAlign = "right"; g.fillStyle = "#e6ecf5"; g.fillText(f.score + " pts", px + pw - S * 0.08, y); });
        g.restore();
        const by = py + ph - S * 0.11, bw = S * 0.24, bh = S * 0.06;
        if (resultsT < 5000) { g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "rgba(207,214,226,0.7)"; g.font = "600 " + Math.round(S * 0.02) + "px system-ui, sans-serif"; g.fillText("next round in " + Math.ceil((5000 - resultsT) / 1000) + "…", S / 2, by + bh / 2); return; }
        if (mode === "practice") { button(S / 2 - bw - S * 0.01, by, bw, bh, "Play again", true, startPractice); button(S / 2 + S * 0.01, by, bw, bh, "Menu", false, toTitle); }
        else if (isHost()) { button(S / 2 - bw - S * 0.01, by, bw, bh, "Play again", true, function () { Arcade.mpLobby.restart(); }); button(S / 2 + S * 0.01, by, bw, bh, "Leave", false, function () { Arcade.mpLobby.leave(); }); }
        else { g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "rgba(207,214,226,0.7)"; g.font = "600 " + Math.round(S * 0.02) + "px system-ui, sans-serif"; g.fillText("waiting for the host to start another…", S / 2 - S * 0.08, by + bh / 2); button(S / 2 + S * 0.16, by, bw * 0.8, bh, "Leave", false, function () { Arcade.mpLobby.leave(); }); }
      }

      function resize() {
        S = Arcade.board.stageSize(880); dpr = window.devicePixelRatio || 1;
        canvas.style.width = S + "px"; canvas.style.height = S + "px";
        canvas.width = Math.round(S * dpr); canvas.height = Math.round(S * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      return {
        mount(stage, c) {
          ctx = c;
          reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          touchDevice = (navigator.maxTouchPoints || 0) > 0 && !window.matchMedia("(pointer: fine)").matches;
          const wrap = document.createElement("div");
          wrap.style.display = "flex"; wrap.style.flexDirection = "column"; wrap.style.alignItems = "center";
          canvas = document.createElement("canvas");
          canvas.style.borderRadius = "18px"; canvas.style.background = "#0a1412"; canvas.style.cursor = "pointer";
          canvas.style.boxShadow = "0 0 46px rgba(255,143,163,0.14)"; canvas.style.touchAction = "none";
          g = canvas.getContext("2d");
          onCtx = function (e) { e.preventDefault(); }; canvas.addEventListener("contextmenu", onCtx);
          hint = document.createElement("div"); hint.className = "hint";
          wrap.appendChild(canvas); wrap.appendChild(hint); stage.appendChild(wrap);
          Arcade.input.setPointerTarget(canvas);
          resize(); unsub = ctx.board.onResize(resize);
          toTitle(); ctx.setScore(0);
          Arcade._tongue = {
            get: function () {
              const out = {};
              Object.keys(frogs).forEach(function (id) { const f = frogs[id]; out[id] = { id: id, name: f.name, x: f.x, y: f.y, score: f.score, it: id === itId, tongue: !!f.tongue, remote: f.remote, bot: f.bot }; });
              return { scene: scene, mode: mode, me: me ? me.id : null, frogs: out, itId: itId, arena: arena.r, isHost: isHost(), S: S, winner: winner, freeze: freeze, resultsT: resultsT, btns: btns.map(function (b) { return { label: b.label, x: b.x, y: b.y, w: b.w, h: b.h }; }) };
            },
            set: function (o) { o = o || {}; if (o.freeze != null) freeze = o.freeze; if (!me) return; if (o.x != null) { me.hop = null; me.goal = null; me.x = me.tx = o.x; me.y = me.ty = o.y; } if (o.score != null) me.score = o.score; if (o.tcd != null) me.tcd = o.tcd; },
            act: { hop: function (x, y) { hopTo(me, x, y); }, tongue: function (x, y) { tongueAt(me, x, y); } }
          };
        },
        handleInput(intent) {
          if (intent.type !== "point" || !canvas || intent.el !== canvas) return;
          const ux = intent.x / S, uy = intent.y / S;
          if (intent.phase === "down") {
            if (scene === "title" || scene === "results") { if (intent.button === 0) hitBtn(intent.x, intent.y); return; }
            if (scene !== "play" || !me) return;
            if (intent.button === 2) { tongueAt(me, ux, uy); return; }
            if (intent.button !== 0) return;
            if (touchDevice) { clearHold(); hold = { x: ux, y: uy, timer: setTimeout(function () { const h = hold; hold = null; if (h) tongueAt(me, h.x, h.y); }, 350) }; }
            else hopTo(me, ux, uy);
          } else if (intent.phase === "move") { if (hold) { hold.x = ux; hold.y = uy; } }
          else if (intent.phase === "up") { if (hold) { const h = hold; clearHold(); hopTo(me, h.x, h.y); } }
        },
        tick: tick,
        pause() { clearHold(); },
        resume() {},
        getScore() { return me ? me.score : 0; },
        teardown() {
          clearHold();
          if (unsub) unsub(); unsub = null;
          try { if (window.Arcade.mpLobby) Arcade.mpLobby.close(); } catch (e) {}
          try { if (window.Arcade.net) Arcade.net.disconnect(); } catch (e) {}
          if (canvas && onCtx) canvas.removeEventListener("contextmenu", onCtx);
          try { delete Arcade._tongue; } catch (e) {}
          frogs = {}; order = []; me = null; fx = []; toasts = []; btns = []; mode = null; scene = "title";
          canvas = g = hint = ctx = null;
        }
      };
    }
  });
})();
