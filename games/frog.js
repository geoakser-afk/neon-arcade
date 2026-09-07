/* Frog — made for Christopher (age 5), who loves frogs. An open-world meadow at night:
   ponds with lily pads, three toad houses you can walk into, and animals to meet.
   LEFT-click (or tap) anywhere and the frog hops there (boing!). RIGHT-click (or tap a
   fly) and the frog shoots its tongue out to eat it. Click an animal and the frog hops
   over to say hi — the animal talks (Kokoro voice clip) with a little picture bubble.
   Click a house door to go inside and meet the toad who lives there. No losing, no
   timer, nothing to read. The star counter = flies eaten. */
(function () {
  const TAU = Math.PI * 2;
  const WORLD = 3.6;                 // world is WORLD × WORLD canvases big
  const GREEN = "#7fe0a0", GREEN_D = "#3fa66a", BELLY = "#d9ffe6";

  function rr(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }
  function ell(g, x, y, rx, ry) { g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU); }
  function dot(g, x, y, r) { g.beginPath(); g.arc(x, y, Math.max(0.1, r), 0, TAU); g.fill(); }
  function hash(i, j) { let h = (i * 374761393 + j * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177; h = h ^ (h >> 16); return ((h >>> 0) % 10000) / 10000; }

  // eyes + smile used by every creature
  function eyes(g, x, y, r, dx, blink, look) {
    look = look || 0;
    [-1, 1].forEach(function (d) {
      const ex = x + d * dx;
      g.fillStyle = "#fff"; dot(g, ex, y, r);
      if (blink) { g.strokeStyle = "#2a2434"; g.lineWidth = r * 0.35; g.lineCap = "round"; g.beginPath(); g.moveTo(ex - r * 0.6, y); g.lineTo(ex + r * 0.6, y); g.stroke(); }
      else { g.fillStyle = "#2a2434"; dot(g, ex + look * r * 0.3, y + r * 0.1, r * 0.5); g.fillStyle = "#fff"; dot(g, ex + look * r * 0.3 - r * 0.15, y - r * 0.15, r * 0.16); }
    });
  }
  function smile(g, x, y, r, big) { g.strokeStyle = "#2a2434"; g.lineWidth = Math.max(1.5, r * 0.28); g.lineCap = "round"; g.beginPath(); g.arc(x, y, r, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); if (big) { g.fillStyle = "#ff8fa3"; g.beginPath(); g.arc(x, y + r * 0.55, r * 0.45, 0, Math.PI); g.fill(); } }
  function cheeks(g, x, y, dx, r) { g.fillStyle = "rgba(255,143,163,0.55)"; dot(g, x - dx, y, r); dot(g, x + dx, y, r); }

  // The frog (also used for toads with different colors). face = -1 left / 1 right. z = hop height 0..1
  function drawFrog(g, x, y, r, face, now, o) {
    o = o || {};
    const body = o.body || GREEN, dark = o.dark || GREEN_D, belly = o.belly || BELLY, blink = o.blink;
    const sq = o.sq || 0, tongue = o.tongue;                   // tongue: {tx, ty, k}
    g.save(); g.translate(x, y); g.scale(face < 0 ? -1 : 1, 1); g.scale(1 + sq * 0.12, 1 - sq * 0.12);
    // back legs
    g.fillStyle = dark;
    ell(g, -r * 0.85, r * 0.45, r * 0.5, r * 0.3); g.fill(); ell(g, r * 0.85, r * 0.45, r * 0.5, r * 0.3); g.fill();
    // toes
    [-1, 1].forEach(function (d) { for (let i = -1; i <= 1; i++) { ell(g, d * (r * 1.1 + i * r * 0.16), r * 0.66, r * 0.09, r * 0.16); g.fill(); } });
    // body
    g.fillStyle = body; g.shadowColor = body; g.shadowBlur = r * 0.6;
    ell(g, 0, r * 0.05, r, r * 0.85); g.fill(); g.shadowBlur = 0;
    if (o.warts) { g.fillStyle = dark; for (let i = 0; i < 6; i++) dot(g, Math.cos(i * 1.1) * r * 0.55, r * 0.1 + Math.sin(i * 2.3) * r * 0.4, r * 0.07); }
    g.fillStyle = belly; ell(g, 0, r * 0.35, r * 0.6, r * 0.42); g.fill();
    // front legs
    g.fillStyle = dark; ell(g, -r * 0.55, r * 0.72, r * 0.2, r * 0.26); g.fill(); ell(g, r * 0.55, r * 0.72, r * 0.2, r * 0.26); g.fill();
    // head bumps (eyes on top)
    g.fillStyle = body; dot(g, -r * 0.5, -r * 0.62, r * 0.36); dot(g, r * 0.5, -r * 0.62, r * 0.36);
    eyes(g, 0, -r * 0.62, r * 0.27, r * 0.5, blink, o.look || 0);
    cheeks(g, 0, -r * 0.02, r * 0.62, r * 0.14);
    if (tongue && tongue.k > 0) {
      // tongue drawn in the frog's local (un-flipped) frame
      g.save(); g.scale(face < 0 ? -1 : 1, 1);
      g.strokeStyle = "#ff6b8a"; g.lineWidth = r * 0.22; g.lineCap = "round";
      g.beginPath(); g.moveTo(0, -r * 0.05); g.lineTo(tongue.tx * tongue.k, -r * 0.05 + tongue.ty * tongue.k); g.stroke();
      g.fillStyle = "#ff6b8a"; dot(g, tongue.tx * tongue.k, -r * 0.05 + tongue.ty * tongue.k, r * 0.18);
      g.restore();
      g.fillStyle = "#2a2434"; ell(g, 0, -r * 0.05, r * 0.22, r * 0.17); g.fill();
    } else smile(g, 0, -r * 0.2, r * 0.36, o.happy);
    g.restore();
  }

  function drawFly(g, x, y, r, now, ph) {
    g.save(); g.translate(x, y);
    const wf = Math.sin(now * 0.06 + ph);
    g.fillStyle = "rgba(200,230,255,0.55)"; ell(g, -r * 0.6, -r * 0.5, r * 0.75, r * 0.35 * (0.4 + Math.abs(wf))); g.fill(); ell(g, r * 0.6, -r * 0.5, r * 0.75, r * 0.35 * (0.4 + Math.abs(wf))); g.fill();
    g.fillStyle = "#2a2434"; ell(g, 0, 0, r * 0.55, r * 0.7); g.fill();
    g.fillStyle = "#ff6b6b"; dot(g, -r * 0.25, -r * 0.35, r * 0.2); dot(g, r * 0.25, -r * 0.35, r * 0.2);
    g.restore();
  }

  const PICT = {
    heart: function (g, r) { g.fillStyle = "#ff6b8a"; g.beginPath(); g.moveTo(0, r * 0.8); g.bezierCurveTo(-r * 1.3, -r * 0.1, -r * 0.6, -r * 1, 0, -r * 0.3); g.bezierCurveTo(r * 0.6, -r * 1, r * 1.3, -r * 0.1, 0, r * 0.8); g.fill(); },
    sun: function (g, r) { g.fillStyle = "#ffd36b"; g.beginPath(); g.arc(0, 0, r * 0.55, 0, TAU); g.fill(); g.strokeStyle = "#ffd36b"; g.lineWidth = r * 0.14; g.lineCap = "round"; for (let i = 0; i < 8; i++) { const a = i * TAU / 8; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); g.stroke(); } },
    flower: function (g, r) { g.fillStyle = "#ff8fd0"; for (let i = 0; i < 6; i++) { const a = i * TAU / 6; g.beginPath(); g.arc(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.36, 0, TAU); g.fill(); } g.fillStyle = "#ffd36b"; g.beginPath(); g.arc(0, 0, r * 0.32, 0, TAU); g.fill(); },
    star: function (g, r) { g.fillStyle = "#ffd36b"; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr2 = i % 2 ? r * 0.45 : r; i ? g.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2) : g.moveTo(Math.cos(a) * rr2, Math.sin(a) * rr2); } g.closePath(); g.fill(); },
    note: function (g, r) { g.fillStyle = "#c9c3ff"; g.beginPath(); g.ellipse(-r * 0.35, r * 0.5, r * 0.4, r * 0.3, -0.3, 0, TAU); g.fill(); g.fillRect(-r * 0.05, -r * 0.8, r * 0.16, r * 1.3); g.fillRect(-r * 0.05, -r * 0.8, r * 0.7, r * 0.2); },
    drops: function (g, r) { g.fillStyle = "#74b9ff"; [[-0.5, 0.1, 0.55], [0.45, -0.2, 0.7]].forEach(function (d) { g.beginPath(); g.moveTo(d[0] * r, (d[1] - d[2]) * r); g.quadraticCurveTo((d[0] + d[2] * 0.75) * r, (d[1] + d[2] * 0.6) * r, d[0] * r, (d[1] + d[2] * 0.7) * r); g.quadraticCurveTo((d[0] - d[2] * 0.75) * r, (d[1] + d[2] * 0.6) * r, d[0] * r, (d[1] - d[2]) * r); g.fill(); }); },
    fly: function (g, r) { drawFly(g, 0, 0, r * 0.8, 0, 0); },
    moon: function (g, r) { g.fillStyle = "#fff4c8"; g.beginPath(); g.arc(0, 0, r * 0.8, 0, TAU); g.fill(); g.fillStyle = "#2a2434"; g.beginPath(); g.arc(r * 0.35, -r * 0.2, r * 0.62, 0, TAU); g.fill(); }
  };

  // ---- the animals of the meadow ----
  const ANIMALS = [
    { kind: "toad", x: 0.40, y: 0.36, line: "Ribbit! Nice to meet you.", pict: "heart" },
    { kind: "duck", x: 0.78, y: 0.70, line: "Nice day for a swim!", pict: "drops", pond: 1 },
    { kind: "turtle", x: 0.62, y: 0.80, line: "Slow and steady.", pict: "flower" },
    { kind: "snail", x: 0.30, y: 0.60, line: "Hi there!", pict: "heart" },
    { kind: "bee", x: 0.50, y: 0.55, line: "Buzz buzz! Sweet flowers.", pict: "flower" },
    { kind: "owl", x: 0.68, y: 0.12, line: "Whooo! Hello, friend!", pict: "moon" },
    { kind: "bunny", x: 0.16, y: 0.21, line: "Hop hop! Let's race!", pict: "star" },
    { kind: "butterfly", x: 0.88, y: 0.50, line: "Look at my wings!", pict: "heart" },
    { kind: "ladybug", x: 0.45, y: 0.90, line: "Hi there!", pict: "flower" }
  ];
  const PONDS = [{ x: 0.28, y: 0.32, rx: 0.13, ry: 0.085 }, { x: 0.76, y: 0.70, rx: 0.15, ry: 0.10 }, { x: 0.18, y: 0.82, rx: 0.085, ry: 0.06 }];
  const HOUSES = [
    { x: 0.55, y: 0.22, col: "#ff8fa3", roof: "#d95a78", toad: { body: "#c8a06a", dark: "#8a6a3c", belly: "#f4e2c2" } },
    { x: 0.14, y: 0.52, col: "#74b9ff", roof: "#3f7fc4", toad: { body: "#a8e6a0", dark: "#5f9e5a", belly: "#e8ffe4" } },
    { x: 0.86, y: 0.30, col: "#ffd36b", roof: "#c99a2e", toad: { body: "#e0a3ff", dark: "#9a5ec4", belly: "#f7e6ff" } }
  ];
  const HOUSE_LINES = ["Welcome to my house!", "Come in, come in!", "Hello, little frog!", "Have a nice hop!"];
  const RACE = { x0: 0.08, x1: 0.44, y: 0.145 };   // the race track (world units): start flag at x0, finish at x1
  const TREES = [[0.08, 0.10], [0.30, 0.08], [0.67, 0.06], [0.93, 0.12], [0.06, 0.40], [0.95, 0.52], [0.05, 0.68], [0.40, 0.72], [0.93, 0.90], [0.60, 0.95], [0.34, 0.95], [0.72, 0.45]];
  const ROCKS = [[0.48, 0.44], [0.20, 0.70], [0.82, 0.86], [0.60, 0.62], [0.12, 0.92]];
  const SHROOMS = [[0.10, 0.18], [0.36, 0.14], [0.90, 0.20], [0.70, 0.90], [0.28, 0.48], [0.52, 0.70]];

  Arcade.register({
    id: "frog",
    name: "Frog",
    tagline: "Open-world frog. Tap to hop, right-click to catch flies, visit the toads.",
    accent: "#7fe0a0",
    complexity: "low",
    controls: "click",
    scoreLabel: "Flies",
    kid: true,
    kidIcon(g, s) {
      g.save();
      g.fillStyle = "rgba(116,185,255,0.25)"; ell(g, s * 0.5, s * 0.8, s * 0.42, s * 0.12); g.fill();
      drawFrog(g, s * 0.5, s * 0.52, s * 0.3, 1, 0, { happy: true });
      drawFly(g, s * 0.84, s * 0.2, s * 0.06, 0, 0);
      g.restore();
    },
    create() {
      let stageEl, ctx, canvas, g, unResize = null, ctxMenu = null;
      let S = 0, W = 0, dpr = 1, reduced = false, now = 0;
      let frog, cam, flies = [], animals = [], fx = [], ripples = [], bubble = null, eaten = 0;
      let scene = "world", house = -1, fade = 0, fadeDir = 0, pendingScene = null;
      let hopSnd = 0, duckClip = null, race = null, press = null, touchDevice = false;

      function resize() {
        const oldS = S;
        S = Arcade.board.stageSize(880); dpr = window.devicePixelRatio || 1; W = S * WORLD;
        canvas.style.width = S + "px"; canvas.style.height = S + "px";
        canvas.width = Math.round(S * dpr); canvas.height = Math.round(S * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (oldS && frog) { const k = S / oldS; frog.x *= k; frog.y *= k; frog.tx *= k; frog.ty *= k; cam.x *= k; cam.y *= k; flies.forEach(function (f) { f.x *= k; f.y *= k; f.hx *= k; f.hy *= k; }); animals.forEach(function (a) { a.x *= k; a.y *= k; a.hx *= k; a.hy *= k; }); }
      }
      function reset() {
        const h = HOUSES[0];
        frog = { x: W * 0.5, y: W * 0.45, tx: W * 0.5, ty: W * 0.45, face: 1, happy: 0, hop: null, rest: 0, z: 0, sq: 0, blink: 0, tongue: null, goal: null, swim: 0, kick: 0 };
        cam = { x: frog.x - S / 2, y: frog.y - S / 2 };
        flies = []; for (let i = 0; i < 16; i++) spawnFly(i < 6 ? frog : null);
        animals = ANIMALS.map(function (a) { return Object.assign({}, a, { x: a.x * W, y: a.y * W, hx: a.x * W, hy: a.y * W, ph: Math.random() * TAU, t: 0, sq: 0, talk: 0, lastTalk: -9999 }); });
        fx = []; ripples = []; bubble = null; scene = "world"; house = -1; fade = 0; fadeDir = 0; pendingScene = null; race = null; press = null;
      }
      function spawnFly(near) {
        let x, y;
        if (near) { const a = Math.random() * TAU, d = S * (0.25 + Math.random() * 0.45); x = near.x + Math.cos(a) * d; y = near.y + Math.sin(a) * d; }
        else { x = W * (0.05 + Math.random() * 0.9); y = W * (0.05 + Math.random() * 0.9); }
        x = Math.max(S * 0.05, Math.min(W - S * 0.05, x)); y = Math.max(S * 0.05, Math.min(W - S * 0.05, y));
        flies.push({ x: x, y: y, hx: x, hy: y, ph: Math.random() * TAU, vx: 0, vy: 0 });
      }
      function inPond(x, y) {
        for (let i = 0; i < PONDS.length; i++) { const p = PONDS[i], dx = (x - p.x * W) / (p.rx * W), dy = (y - p.y * W) / (p.ry * W); if (dx * dx + dy * dy < 1) return p; }
        return null;
      }
      function houseDoor(h) { return { x: h.x * W, y: h.y * W + S * 0.11 }; }
      const ROOM = function () { return { x: S * 0.1, y: S * 0.2, w: S * 0.8, h: S * 0.64 }; };

      // ---- sounds ----
      function sndHop() { if (now - hopSnd < 120) return; hopSnd = now; ctx.audio.tone(260, 0.14, { type: "triangle", vol: 0.09, glide: 620 }); }
      function sndLand(water) { if (water) { ctx.audio.tone(520, 0.12, { type: "sine", vol: 0.07, glide: 160 }); ctx.audio.arp([880, 1170, 1560], { dur: 0.06, step: 0.04, vol: 0.05, type: "sine", when: 0.05 }); } else ctx.audio.tone(140, 0.06, { type: "sine", vol: 0.06, glide: 90 }); }
      function sndTongue() { ctx.audio.tone(900, 0.07, { type: "sine", vol: 0.07, glide: 1500 }); }
      function sndGulp() { ctx.audio.tone(420, 0.16, { type: "sine", vol: 0.12, glide: 160 }); ctx.audio.tone(260, 0.12, { type: "triangle", vol: 0.08, glide: 330, when: 0.16 }); }
      function sndRibbit() { ctx.audio.tone(150, 0.13, { type: "sawtooth", vol: 0.06, glide: 230 }); ctx.audio.tone(130, 0.16, { type: "sawtooth", vol: 0.06, glide: 210, when: 0.17 }); }
      function sndDoor() { ctx.audio.arp([392, 523, 659], { dur: 0.16, step: 0.08, vol: 0.1, type: "triangle" }); }
      function sndAnimal(kind) {
        const a = ctx.audio;
        if (kind === "duck") { if (duckClip) { try { const n = duckClip.cloneNode(); n.volume = 0.7; n.play().catch(function () {}); return; } catch (e) {} } a.tone(600, 0.12, { type: "sawtooth", vol: 0.05, glide: 420 }); a.tone(600, 0.12, { type: "sawtooth", vol: 0.05, glide: 420, when: 0.18 }); }
        else if (kind === "toad") { a.tone(120, 0.18, { type: "sawtooth", vol: 0.06, glide: 170 }); a.tone(110, 0.2, { type: "sawtooth", vol: 0.06, glide: 150, when: 0.22 }); }
        else if (kind === "turtle") { a.tone(220, 0.35, { type: "triangle", vol: 0.08, glide: 180 }); }
        else if (kind === "snail") { a.arp([523, 587], { dur: 0.2, step: 0.2, vol: 0.06, type: "sine" }); }
        else if (kind === "bee") { a.tone(230, 0.5, { type: "sawtooth", vol: 0.04, glide: 260 }); a.tone(235, 0.5, { type: "sawtooth", vol: 0.04, glide: 250 }); }
        else if (kind === "owl") { a.tone(392, 0.3, { type: "sine", vol: 0.1, glide: 330 }); a.tone(392, 0.4, { type: "sine", vol: 0.1, glide: 300, when: 0.36 }); }
        else if (kind === "bunny") { a.arp([784, 988, 1175], { dur: 0.1, step: 0.07, vol: 0.08, type: "sine" }); }
        else if (kind === "butterfly") { a.arp([1046, 1318, 1568, 1318], { dur: 0.12, step: 0.09, vol: 0.06, type: "sine" }); }
        else if (kind === "ladybug") { a.arp([659, 784], { dur: 0.1, step: 0.1, vol: 0.07, type: "triangle" }); }
      }
      function say(parts) { if (window.Arcade && Arcade.voice) Arcade.voice.say(parts); }

      // ---- actions ----
      function goTo(x, y, goal) {
        if (scene === "house") { const R = ROOM(); x = Math.max(R.x + S * 0.08, Math.min(R.x + R.w - S * 0.08, x)); y = Math.max(R.y + S * 0.16, Math.min(R.y + R.h - S * 0.06, y)); }
        else { x = Math.max(S * 0.04, Math.min(W - S * 0.04, x)); y = Math.max(S * 0.06, Math.min(W - S * 0.04, y)); }
        frog.tx = x; frog.ty = y; frog.goal = goal || null;
        fx.push({ kind: "mark", x: x, y: y, t: 0, dur: 600 });
        ctx.audio.tone(660, 0.05, { type: "sine", vol: 0.035, glide: 880 });
      }
      function shootTongue(x, y) {
        if (frog.tongue) return;
        const dx = x - frog.x, dy = y - (frog.y - frogR() * 0.05), d = Math.hypot(dx, dy) || 1, max = S * 0.42;
        const k = Math.min(1, max / d);
        let tx = dx * k, ty = dy * k, hit = null, best = S * 0.09;
        flies.forEach(function (f) { const dd = Math.hypot(f.x - (frog.x + tx), f.y - (frog.y + ty)); if (dd < best) { best = dd; hit = f; } });
        if (!hit) { // maybe a fly sits along the tongue's path
          flies.forEach(function (f) { const px = f.x - frog.x, py = f.y - frog.y, L = Math.hypot(tx, ty), proj = (px * tx + py * ty) / L; if (proj > 0 && proj < L) { const off = Math.abs(px * ty - py * tx) / L; if (off < S * 0.05 && !hit) hit = f; } });
        }
        if (hit) { tx = hit.x - frog.x; ty = hit.y - frog.y; }
        if (Math.abs(tx) > S * 0.01) frog.face = tx < 0 ? -1 : 1;
        frog.tongue = { tx: tx, ty: ty, t: 0, dur: 300, hit: hit, done: false };
        sndTongue();
      }
      function eat(f) {
        const i = flies.indexOf(f); if (i >= 0) flies.splice(i, 1);
        eaten++; ctx.setScore(eaten); frog.sq = 1; frog.happy = 1200;
        sndGulp();
        for (let k = 0; k < (reduced ? 4 : 10); k++) fx.push({ kind: "spark", x: f.x, y: f.y, vx: (Math.random() - 0.5) * S * 0.0006, vy: (Math.random() - 0.8) * S * 0.0006, t: 0, dur: 500 + Math.random() * 300, col: "#ffd36b" });
        fx.push({ kind: "star", x: frog.x, y: frog.y - frogR() * 1.6, t: 0, dur: 900 });
        if (eaten % 5 === 0) { say("Yummy!"); confetti(frog.x, frog.y - frogR()); ctx.audio.arp([523, 659, 784, 1046], { dur: 0.18, step: 0.08, vol: 0.1, type: "sine", when: 0.3 }); }
        if (scene === "world") spawnFly(frog); else spawnRoomFly();
      }
      function spawnRoomFly() { const R = ROOM(); const x = R.x + S * 0.1 + Math.random() * (R.w - S * 0.2), y = R.y + S * 0.08 + Math.random() * (R.h * 0.5); flies.push({ x: x, y: y, hx: x, hy: y, ph: Math.random() * TAU, vx: 0, vy: 0 }); }
      function confetti(x, y) { const n = reduced ? 12 : 50; for (let i = 0; i < n; i++) { const a = Math.random() * TAU, sp = S * (0.0003 + Math.random() * 0.0006); fx.push({ kind: "conf", x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - S * 0.0003, t: 0, dur: 1400 + Math.random() * 500, col: ["#ff8fa3", "#ffd36b", "#a8e6a0", "#74b9ff", "#c9c3ff", "#fff"][i % 6], rot: Math.random() * TAU }); } }
      function talk(a) {
        a.talk = 2400; a.sq = 1; a.lastTalk = now;
        bubble = { a: a, x: a.x, y: a.y - S * 0.1, pict: a.pict, t: 0, dur: 2400 };
        sndAnimal(a.kind);
        setTimeout(function () { if (ctx) say(a.line); }, a.kind === "duck" ? 700 : 350);
        frog.face = a.x < frog.x ? -1 : 1; frog.happy = 2000;
      }
      function enterHouse(i) {
        pendingScene = { scene: "house", house: i }; fadeDir = 1; sndDoor();
      }
      function leaveHouse() { pendingScene = { scene: "world" }; fadeDir = 1; sndDoor(); say("Bye bye!"); }
      function applyScene() {
        const p = pendingScene; pendingScene = null;
        bubble = null; frog.tongue = null; frog.goal = null; frog.hop = null; frog.z = 0;
        if (p.scene === "house") {
          scene = "house"; house = p.house;
          const R = ROOM(); frog.x = frog.tx = R.x + R.w / 2; frog.y = frog.ty = R.y + R.h - S * 0.09; frog.face = 1;
          worldFlies = flies; flies = []; for (let k = 0; k < 3; k++) spawnRoomFly();
          const T = HOUSES[house].toad; roomToad = { x: R.x + R.w / 2, y: R.y + R.h * 0.42, sq: 0, talk: 0, lines: 0, body: T.body, dark: T.dark, belly: T.belly };
          setTimeout(function () { if (ctx && scene === "house") { roomToad.talk = 2400; roomToad.sq = 1; bubble = { x: roomToad.x, y: roomToad.y - S * 0.16, pict: "heart", t: 0, dur: 2400 }; sndAnimal("toad"); setTimeout(function () { if (ctx) say(HOUSE_LINES[0]); }, 400); } }, 350);
        } else {
          scene = "world"; flies = worldFlies || flies; worldFlies = null;
          const d = houseDoor(HOUSES[house]); frog.x = frog.tx = d.x; frog.y = frog.ty = d.y + S * 0.06; frog.face = 1; house = -1;
          cam.x = frog.x - S / 2; cam.y = frog.y - S / 2;
        }
      }
      let worldFlies = null, roomToad = null;
      function frogR() { return S * 0.055; }

      // ---- the rabbit race ----
      function raceStartPos() { return { x: RACE.x0 * W + S * 0.06, y: RACE.y * W + S * 0.075 }; }
      function bunny() { return animals.find(function (a) { return a.kind === "bunny"; }); }
      function startRace() {
        const b = bunny(); if (!b) return;
        race = { phase: "count", t: 0, beeps: 0, speed: S * (0.00016 + Math.random() * 0.0002), rx: RACE.x0 * W + S * 0.06, winner: null };
        b.x = race.rx; b.y = RACE.y * W - S * 0.06; b.face = 1; b.z = 0;
        frog.x = frog.tx = raceStartPos().x; frog.y = frog.ty = raceStartPos().y; frog.face = 1; frog.hop = null; frog.goal = null;
        b.talk = 2200; b.sq = 1; bubble = { a: b, x: b.x, y: b.y, pict: "star", t: 0, dur: 2200 }; sndAnimal("bunny"); setTimeout(function () { if (ctx) say(b.line); }, 300);
      }
      function raceClick() {
        if (!race || race.phase !== "run" || frog.hop) return;
        const len = S * 0.07; frog.hop = { x0: frog.x, y0: frog.y, x1: frog.x + len, y1: frog.y, t: 0, dur: 170 }; frog.tx = frog.x + len; frog.ty = frog.y; frog.face = 1; sndHop();
      }
      function updateRace(dt) {
        const r = race, b = bunny(), fin = RACE.x1 * W;
        r.t += dt;
        if (r.phase === "count") {
          const step = Math.floor(r.t / 700);
          if (step > r.beeps) { r.beeps = step; if (step < 3) { ctx.audio.tone(520, 0.14, { type: "sine", vol: 0.12 }); fx.push({ kind: "ring", x: frog.x + S * 0.1, y: RACE.y * W, t: 0, dur: 500 }); } else { ctx.audio.tone(1040, 0.35, { type: "sine", vol: 0.14 }); r.phase = "run"; r.t = 0; fx.push({ kind: "ring", x: frog.x + S * 0.1, y: RACE.y * W, t: 0, dur: 700, big: true }); } }
          b.x = r.rx; b.z = Math.abs(Math.sin(r.t * 0.008)) * 0.4;
        } else if (r.phase === "run") {
          r.rx += r.speed * dt; b.x = r.rx; b.z = Math.abs(Math.sin(r.t * 0.012)); b.face = 1;
          if (frog.x >= fin || r.rx >= fin) {
            r.phase = "done"; r.t = 0; r.winner = frog.x >= fin && !(r.rx >= fin && r.rx > frog.x) ? "frog" : "bunny";
            if (r.winner === "frog") { confetti(frog.x, frog.y - frogR()); ctx.audio.arp([523, 659, 784, 1046, 1318], { dur: 0.2, step: 0.08, vol: 0.12, type: "sine" }); frog.happy = 3000; setTimeout(function () { if (ctx) say("Great job!"); }, 500); }
            else { b.sq = 1; b.talk = 2000; bubble = { a: b, x: b.x, y: b.y, pict: "star", t: 0, dur: 2000 }; confetti(b.x, b.y - S * 0.06); ctx.audio.arp([784, 988, 1175], { dur: 0.14, step: 0.08, vol: 0.1, type: "sine" }); setTimeout(function () { if (ctx) say("Try again!"); }, 500); }
          }
        } else if (r.phase === "done") {
          b.z = Math.abs(Math.sin(r.t * 0.008)) * (r.winner === "bunny" ? 0.8 : 0.2);
          if (r.t > 2600) { race = null; b.t = 0; }
        }
      }

      // ---- update ----
      function update(dt) {
        now += dt;
        if (fadeDir) { fade += fadeDir * dt / 260; if (fade >= 1) { fade = 1; if (pendingScene) applyScene(); fadeDir = -1; } if (fade <= 0) { fade = 0; fadeDir = 0; } }
        if (press && !press.done && now - press.t > 380 && touchDevice) { press.done = true; shootTongue(press.wx, press.wy); }
        if (race) updateRace(dt);
        // frog movement: hop toward target (swim when in a pond)
        const f = frog, R = frogR();
        f.blink -= dt; if (f.blink < -2600 - Math.random() * 2000) f.blink = 160;
        if (f.sq > 0) f.sq = Math.max(0, f.sq - dt / 300);
        if (f.happy > 0) f.happy -= dt;
        const pond = scene === "world" ? inPond(f.x, f.y) : null;
        const dx = f.tx - f.x, dy = f.ty - f.y, dist = Math.hypot(dx, dy);
        if (f.hop) {
          const h = f.hop; h.t += dt; const k = Math.min(1, h.t / h.dur);
          f.x = h.x0 + (h.x1 - h.x0) * k; f.y = h.y0 + (h.y1 - h.y0) * k; f.z = Math.sin(k * Math.PI);
          if (k >= 1) { f.hop = null; f.z = 0; f.rest = 70; f.sq = 0.7; const wp = scene === "world" && inPond(f.x, f.y); sndLand(!!wp); if (wp) { f.swim = 1; ripples.push({ x: f.x, y: f.y, t: 0, dur: 900, r: R * 3 }); } }
        } else if (pond && dist > R * 0.4) {
          // swimming: glide with kicks
          const sp = S * 0.00032, step = Math.min(dist, sp * dt);
          f.x += dx / dist * step; f.y += dy / dist * step; f.face = Math.abs(dx) > S * 0.005 ? (dx < 0 ? -1 : 1) : f.face;
          f.kick += dt; if (f.kick > 420) { f.kick = 0; ripples.push({ x: f.x, y: f.y + R * 0.3, t: 0, dur: 800, r: R * 2.2 }); ctx.audio.tone(700 + Math.random() * 200, 0.05, { type: "sine", vol: 0.025, glide: 900 }); }
          f.swim = 1;
        } else if (dist > R * 0.4) {
          f.rest -= dt;
          if (f.rest <= 0) {
            const len = Math.min(dist, S * 0.13);
            f.hop = { x0: f.x, y0: f.y, x1: f.x + dx / dist * len, y1: f.y + dy / dist * len, t: 0, dur: 300 + len / S * 500 };
            if (Math.abs(dx) > S * 0.01) f.face = dx < 0 ? -1 : 1;
            sndHop();
          }
        } else {
          f.swim = pond ? 1 : 0;
          if (f.goal) { const gl = f.goal; f.goal = null; if (gl.type === "animal") talk(gl.a); else if (gl.type === "house") enterHouse(gl.i); else if (gl.type === "door") leaveHouse(); else if (gl.type === "toad") toadTalk(); else if (gl.type === "race") startRace(); }
        }
        if (!pond) f.swim = 0;
        // tongue
        if (f.tongue) {
          const t = f.tongue; t.t += dt; const k = t.t / t.dur;
          if (k >= 0.5 && !t.done) { t.done = true; if (t.hit && flies.indexOf(t.hit) >= 0) eat(t.hit); }
          if (k >= 1) f.tongue = null;
        }
        // flies buzz around their home point; the home slowly drifts
        flies.forEach(function (fl) {
          fl.ph += dt * 0.004;
          const ax = (fl.hx - fl.x) * 0.00002 + Math.sin(fl.ph * 3.1) * S * 0.0000025, ay = (fl.hy - fl.y) * 0.00002 + Math.cos(fl.ph * 2.3) * S * 0.0000025;
          fl.vx = (fl.vx + ax * dt) * 0.98; fl.vy = (fl.vy + ay * dt) * 0.98;
          fl.x += fl.vx * dt; fl.y += fl.vy * dt;
          fl.hx += Math.sin(fl.ph * 0.5) * S * 0.00003 * dt; fl.hy += Math.cos(fl.ph * 0.37) * S * 0.00003 * dt;
        });
        // animals idle
        animals.forEach(function (a) {
          a.t += dt; if (a.sq > 0) a.sq = Math.max(0, a.sq - dt / 400); if (a.talk > 0) a.talk -= dt;
          if (a.kind === "duck") { const p = PONDS[a.pond]; a.x = p.x * W + Math.cos(a.t * 0.0004 + a.ph) * p.rx * W * 0.55; a.y = p.y * W + Math.sin(a.t * 0.0004 + a.ph) * p.ry * W * 0.55; a.face = Math.cos(a.t * 0.0004 + a.ph + 1.57) < 0 ? -1 : 1; if (Math.floor(a.t / 700) !== Math.floor((a.t - dt) / 700)) ripples.push({ x: a.x, y: a.y + S * 0.02, t: 0, dur: 1200, r: S * 0.09 }); }
          else if (a.kind === "bee") { a.x = a.hx + Math.cos(a.t * 0.0012) * S * 0.16; a.y = a.hy + Math.sin(a.t * 0.0024) * S * 0.08; a.face = Math.sin(a.t * 0.0012) > 0 ? -1 : 1; }
          else if (a.kind === "butterfly") { a.x = a.hx + Math.sin(a.t * 0.0007) * S * 0.2; a.y = a.hy + Math.sin(a.t * 0.0019) * S * 0.12; a.face = Math.cos(a.t * 0.0007) < 0 ? -1 : 1; }
          else if (a.kind === "bunny") { if (race) return; const ph = (a.t % 2600) / 2600; a.z = ph < 0.3 ? Math.sin(ph / 0.3 * Math.PI) : 0; a.x = a.hx + Math.sin(a.t * 0.0005) * S * 0.18; a.face = Math.cos(a.t * 0.0005) < 0 ? -1 : 1; }
          else if (a.kind === "snail" || a.kind === "turtle" || a.kind === "ladybug") { a.x = a.hx + Math.sin(a.t * 0.00025 + a.ph) * S * 0.1; a.face = Math.cos(a.t * 0.00025 + a.ph) < 0 ? -1 : 1; }
        });
        if (roomToad) { if (roomToad.sq > 0) roomToad.sq = Math.max(0, roomToad.sq - dt / 400); if (roomToad.talk > 0) roomToad.talk -= dt; }
        if (bubble) { bubble.t += dt; if (bubble.a) { bubble.x = bubble.a.x; bubble.y = bubble.a.y - S * 0.1 - (bubble.a.z || 0) * S * 0.04; } if (bubble.t > bubble.dur) bubble = null; }
        for (let i = fx.length - 1; i >= 0; i--) { const e = fx[i]; e.t += dt; if (e.vx !== undefined) { e.x += e.vx * dt; e.y += e.vy * dt; e.vy += S * 0.0000012 * dt; if (e.rot !== undefined) e.rot += dt * 0.004; } if (e.t > e.dur) fx.splice(i, 1); }
        for (let i = ripples.length - 1; i >= 0; i--) { ripples[i].t += dt; if (ripples[i].t > ripples[i].dur) ripples.splice(i, 1); }
        // camera follows the frog
        if (scene === "world") {
          const cx = Math.max(0, Math.min(W - S, f.x - S / 2)), cy = Math.max(0, Math.min(W - S, f.y - S / 2));
          const k = 1 - Math.pow(0.0025, dt / 1000);
          cam.x += (cx - cam.x) * k; cam.y += (cy - cam.y) * k;
        }
      }
      function toadTalk() {
        if (!roomToad) return;
        roomToad.lines = (roomToad.lines + 1) % HOUSE_LINES.length; roomToad.talk = 2400; roomToad.sq = 1;
        bubble = { x: roomToad.x, y: roomToad.y - S * 0.16, pict: ["heart", "sun", "star", "note"][roomToad.lines], t: 0, dur: 2400 };
        sndAnimal("toad"); setTimeout(function () { if (ctx) say(HOUSE_LINES[roomToad.lines]); }, 400);
        frog.happy = 2000;
      }

      // ---- drawing ----
      function drawShadow(x, y, r, z) { g.fillStyle = "rgba(0,0,0,0.3)"; ell(g, x, y + r * 0.7, r * (1 - z * 0.35), r * 0.35 * (1 - z * 0.35)); g.fill(); }
      function drawTree(x, y, s, i) {
        const R = S * 0.11 * s;
        g.fillStyle = "#4a3448"; rr(g, x - R * 0.14, y - R * 0.3, R * 0.28, R * 0.9, R * 0.1); g.fill();
        g.fillStyle = "#1f5e46"; g.shadowColor = "#3fa66a"; g.shadowBlur = R * 0.3;
        dot(g, x, y - R * 0.8, R * 0.72); dot(g, x - R * 0.5, y - R * 0.45, R * 0.55); dot(g, x + R * 0.5, y - R * 0.5, R * 0.55); g.shadowBlur = 0;
        g.fillStyle = "#2f8a5e"; dot(g, x - R * 0.2, y - R * 0.95, R * 0.28); dot(g, x + R * 0.35, y - R * 0.75, R * 0.2);
        if (i % 3 === 0) { g.fillStyle = "#ff6b8a"; dot(g, x + R * 0.1, y - R * 0.5, R * 0.07); dot(g, x - R * 0.45, y - R * 0.8, R * 0.07); dot(g, x + R * 0.55, y - R * 0.3, R * 0.07); }
      }
      // start flag (pulses so it looks tappable) / finish flag
      function drawFlag(x, y, start) {
        const h = S * 0.2;
        if (start && !race) { const k = 0.5 + 0.5 * Math.sin(now * 0.004); g.fillStyle = "rgba(255,211,107," + (0.12 + k * 0.12) + ")"; dot(g, x + S * 0.02, y + h * 0.5, S * 0.09 + k * S * 0.015); }
        g.fillStyle = "#e6ecf5"; rr(g, x - S * 0.006, y, S * 0.012, h, S * 0.004); g.fill();
        const w = S * 0.1, fh = S * 0.07, wave = Math.sin(now * 0.005) * S * 0.006;
        g.save(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y + wave); g.lineTo(x + w, y + fh + wave); g.lineTo(x, y + fh); g.closePath(); g.clip();
        if (start) { g.fillStyle = "#ffd36b"; g.shadowColor = "#ffd36b"; g.shadowBlur = S * 0.02; g.fillRect(x, y - S * 0.01, w, fh + S * 0.03); g.shadowBlur = 0; g.save(); g.translate(x + w * 0.5, y + fh * 0.5); PICT.star(g, fh * 0.34); g.restore(); }
        else { for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { g.fillStyle = (i + j) % 2 ? "#fff" : "#2a2434"; g.fillRect(x + i * w / 4, y - S * 0.01 + j * (fh + S * 0.03) / 3, w / 4, (fh + S * 0.03) / 3); } }
        g.restore();
      }
      function drawRock(x, y, s) { const R = S * 0.05 * s; g.fillStyle = "#4e4a66"; ell(g, x, y, R, R * 0.65); g.fill(); g.fillStyle = "#6b6689"; ell(g, x - R * 0.2, y - R * 0.2, R * 0.5, R * 0.28); g.fill(); }
      function drawShroom(x, y, s) { const R = S * 0.035 * s; g.fillStyle = "#f4e2c2"; rr(g, x - R * 0.3, y - R * 0.6, R * 0.6, R * 0.8, R * 0.2); g.fill(); g.fillStyle = "#ff6b6b"; g.shadowColor = "#ff6b6b"; g.shadowBlur = R * 0.4; g.beginPath(); g.arc(x, y - R * 0.6, R, Math.PI, 0); g.closePath(); g.fill(); g.shadowBlur = 0; g.fillStyle = "#fff"; dot(g, x - R * 0.4, y - R * 0.95, R * 0.14); dot(g, x + R * 0.3, y - R * 1.1, R * 0.16); dot(g, x + R * 0.55, y - R * 0.75, R * 0.1); }
      function drawFlower(x, y, col, s) { const R = S * 0.014 * s; g.fillStyle = col; for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + now * 0.0004; dot(g, x + Math.cos(a) * R, y + Math.sin(a) * R, R * 0.75); } g.fillStyle = "#ffd36b"; dot(g, x, y, R * 0.6); }
      function drawHouse(h, x, y) {
        const R = S * 0.13;
        g.fillStyle = "rgba(0,0,0,0.25)"; ell(g, x, y + R * 0.88, R * 1.2, R * 0.2); g.fill();
        g.fillStyle = "#f4e2c2"; rr(g, x - R * 0.7, y - R * 0.1, R * 1.4, R * 0.95, R * 0.12); g.fill();
        g.fillStyle = h.col; g.shadowColor = h.col; g.shadowBlur = R * 0.5; g.beginPath(); g.arc(x, y - R * 0.05, R * 1.05, Math.PI, 0); g.closePath(); g.fill(); g.shadowBlur = 0;
        g.fillStyle = "#fff"; g.globalAlpha = 0.85; dot(g, x - R * 0.45, y - R * 0.55, R * 0.16); dot(g, x + R * 0.35, y - R * 0.7, R * 0.2); dot(g, x + R * 0.7, y - R * 0.3, R * 0.11); g.globalAlpha = 1;
        // window (warm light) + door
        g.fillStyle = "#ffe9a0"; g.shadowColor = "#ffe9a0"; g.shadowBlur = R * 0.3; dot(g, x + R * 0.38, y + R * 0.25, R * 0.16); g.shadowBlur = 0;
        g.strokeStyle = "#c99a2e"; g.lineWidth = R * 0.04; g.beginPath(); g.moveTo(x + R * 0.22, y + R * 0.25); g.lineTo(x + R * 0.54, y + R * 0.25); g.moveTo(x + R * 0.38, y + R * 0.09); g.lineTo(x + R * 0.38, y + R * 0.41); g.stroke();
        g.fillStyle = h.roof; rr(g, x - R * 0.42, y + R * 0.2, R * 0.5, R * 0.65, R * 0.22); g.fill();
        g.fillStyle = "#ffd36b"; dot(g, x - R * 0.05, y + R * 0.55, R * 0.05);
        g.fillStyle = "#4a3448"; rr(g, x - R * 0.5, y + R * 0.85, R * 0.66, R * 0.12, R * 0.05); g.fill();
      }
      function drawAnimal(a) {
        const x = a.x, y = a.y - (a.z || 0) * S * 0.04, R = S * 0.05, face = a.face || 1, blink = ((a.t + a.ph * 1000) % 3000) < 150;
        g.save(); g.translate(x, y); g.scale(face, 1); g.scale(1 + a.sq * 0.1, 1 - a.sq * 0.1);
        const k = a.kind;
        if (k === "toad") { g.restore(); drawFrog(g, x, y, R * 1.1, face, now, { body: "#c8a06a", dark: "#8a6a3c", belly: "#f4e2c2", warts: true, blink: blink, sq: a.sq, happy: a.talk > 0 }); return; }
        if (k === "duck") { g.fillStyle = "#ffd36b"; g.shadowColor = "#ffd36b"; g.shadowBlur = R * 0.5; ell(g, 0, 0, R * 1.1, R * 0.7); g.fill(); dot(g, R * 0.7, -R * 0.7, R * 0.5); g.shadowBlur = 0; g.fillStyle = "#ffb86b"; ell(g, R * 1.25, -R * 0.62, R * 0.35, R * 0.18); g.fill(); g.fillStyle = "#ffe9a0"; ell(g, -R * 0.5, -R * 0.15, R * 0.5, R * 0.3); g.fill(); g.scale(1, 1); eyes(g, R * 0.75, -R * 0.8, R * 0.13, R * 0.001, blink); }
        else if (k === "turtle") { g.fillStyle = "#3fa66a"; ell(g, R * 1.15, -R * 0.1, R * 0.45, R * 0.4); g.fill(); [-0.7, 0.6].forEach(function (lx) { ell(g, lx * R, R * 0.55, R * 0.3, R * 0.18); g.fill(); }); g.fillStyle = "#2f8a5e"; g.shadowColor = "#7fe0a0"; g.shadowBlur = R * 0.4; ell(g, 0, 0, R * 1.05, R * 0.75); g.fill(); g.shadowBlur = 0; g.fillStyle = "#7fe0a0"; dot(g, 0, -R * 0.15, R * 0.28); dot(g, -R * 0.55, R * 0.1, R * 0.2); dot(g, R * 0.55, R * 0.1, R * 0.2); eyes(g, R * 1.2, -R * 0.2, R * 0.12, R * 0.001, blink); smile(g, R * 1.25, -R * 0.02, R * 0.12); }
        else if (k === "snail") { g.fillStyle = "#c9c3ff"; ell(g, R * 0.7, 0, R * 0.9, R * 0.35); g.fill(); g.fillStyle = "#ff8fd0"; g.shadowColor = "#ff8fd0"; g.shadowBlur = R * 0.4; dot(g, -R * 0.2, -R * 0.45, R * 0.7); g.shadowBlur = 0; g.strokeStyle = "#d95a9e"; g.lineWidth = R * 0.12; g.beginPath(); for (let t = 0; t < 12; t += 0.3) { const rr2 = R * 0.06 * t; t ? g.lineTo(-R * 0.2 + Math.cos(t) * rr2, -R * 0.45 + Math.sin(t) * rr2) : g.moveTo(-R * 0.2, -R * 0.45); } g.stroke(); g.strokeStyle = "#c9c3ff"; g.lineWidth = R * 0.1; g.lineCap = "round"; g.beginPath(); g.moveTo(R * 1.3, -R * 0.3); g.lineTo(R * 1.5, -R * 0.9); g.moveTo(R * 1.1, -R * 0.3); g.lineTo(R * 1.05, -R * 0.9); g.stroke(); g.fillStyle = "#c9c3ff"; dot(g, R * 1.5, -R * 0.95, R * 0.12); dot(g, R * 1.05, -R * 0.95, R * 0.12); eyes(g, R * 1.3, -R * 0.35, R * 0.1, R * 0.15, blink); }
        else if (k === "bee") { const wf = Math.abs(Math.sin(now * 0.05)); g.fillStyle = "rgba(200,230,255,0.6)"; ell(g, -R * 0.15, -R * 0.6, R * 0.5, R * 0.35 * (0.4 + wf)); g.fill(); ell(g, R * 0.25, -R * 0.6, R * 0.5, R * 0.35 * (0.4 + wf)); g.fill(); g.fillStyle = "#ffd36b"; g.shadowColor = "#ffd36b"; g.shadowBlur = R * 0.4; ell(g, 0, 0, R * 0.8, R * 0.55); g.fill(); g.shadowBlur = 0; g.fillStyle = "#2a2434"; g.fillRect(-R * 0.35, -R * 0.55, R * 0.2, R * 1.1); g.fillRect(R * 0.05, -R * 0.55, R * 0.2, R * 1.1); g.beginPath(); g.moveTo(-R * 0.8, 0); g.lineTo(-R * 1.05, R * 0.1); g.lineTo(-R * 0.8, R * 0.2); g.fill(); eyes(g, R * 0.6, -R * 0.15, R * 0.12, R * 0.001, blink); smile(g, R * 0.65, R * 0.08, R * 0.1); }
        else if (k === "owl") { g.fillStyle = "#b8a0d9"; g.shadowColor = "#c9c3ff"; g.shadowBlur = R * 0.4; ell(g, 0, 0, R * 0.8, R * 1); g.fill(); g.shadowBlur = 0; g.beginPath(); g.moveTo(-R * 0.6, -R * 0.7); g.lineTo(-R * 0.75, -R * 1.25); g.lineTo(-R * 0.2, -R * 0.9); g.fill(); g.beginPath(); g.moveTo(R * 0.6, -R * 0.7); g.lineTo(R * 0.75, -R * 1.25); g.lineTo(R * 0.2, -R * 0.9); g.fill(); g.fillStyle = "#f4e2c2"; ell(g, 0, R * 0.3, R * 0.5, R * 0.55); g.fill(); eyes(g, 0, -R * 0.35, R * 0.3, R * 0.36, blink); g.fillStyle = "#ffb86b"; g.beginPath(); g.moveTo(-R * 0.12, -R * 0.05); g.lineTo(R * 0.12, -R * 0.05); g.lineTo(0, R * 0.2); g.fill(); }
        else if (k === "bunny") { g.fillStyle = "#fff"; g.shadowColor = "#fff"; g.shadowBlur = R * 0.4; ell(g, 0, R * 0.1, R * 0.85, R * 0.7); g.fill(); dot(g, R * 0.55, -R * 0.45, R * 0.5); g.shadowBlur = 0; rr(g, R * 0.15, -R * 1.5, R * 0.3, R * 1.1, R * 0.15); g.fill(); rr(g, R * 0.6, -R * 1.55, R * 0.3, R * 1.1, R * 0.15); g.fill(); g.fillStyle = "#ffb3c6"; rr(g, R * 0.22, -R * 1.4, R * 0.16, R * 0.8, R * 0.08); g.fill(); rr(g, R * 0.67, -R * 1.45, R * 0.16, R * 0.8, R * 0.08); g.fill(); dot(g, -R * 0.85, R * 0.1, R * 0.25); eyes(g, R * 0.6, -R * 0.5, R * 0.12, R * 0.22, blink); g.fillStyle = "#ff8fa3"; dot(g, R * 0.98, -R * 0.35, R * 0.08); smile(g, R * 0.85, -R * 0.3, R * 0.14); }
        else if (k === "butterfly") { const wf = 0.5 + 0.5 * Math.sin(now * 0.012); g.fillStyle = "#ff8fd0"; g.shadowColor = "#ff8fd0"; g.shadowBlur = R * 0.5; [-1, 1].forEach(function (d) { ell(g, d * R * 0.6 * (0.4 + wf * 0.6), -R * 0.35, R * 0.6 * (0.4 + wf * 0.6), R * 0.55); g.fill(); ell(g, d * R * 0.5 * (0.4 + wf * 0.6), R * 0.35, R * 0.45 * (0.4 + wf * 0.6), R * 0.4); g.fill(); }); g.shadowBlur = 0; g.fillStyle = "#ffd36b"; [-1, 1].forEach(function (d) { dot(g, d * R * 0.55 * (0.4 + wf * 0.6), -R * 0.35, R * 0.18); }); g.fillStyle = "#2a2434"; ell(g, 0, 0, R * 0.12, R * 0.7); g.fill(); eyes(g, 0, -R * 0.6, R * 0.1, R * 0.12, blink); }
        else if (k === "ladybug") { g.fillStyle = "#2a2434"; dot(g, R * 0.75, -R * 0.1, R * 0.35); g.fillStyle = "#ff5c5c"; g.shadowColor = "#ff6b6b"; g.shadowBlur = R * 0.5; ell(g, 0, 0, R * 0.85, R * 0.65); g.fill(); g.shadowBlur = 0; g.strokeStyle = "#2a2434"; g.lineWidth = R * 0.06; g.beginPath(); g.moveTo(R * 0.4, -R * 0.65); g.lineTo(-R * 0.85, 0); g.stroke(); g.fillStyle = "#2a2434"; dot(g, -R * 0.3, -R * 0.3, R * 0.12); dot(g, 0.1 * R, R * 0.3, R * 0.12); dot(g, -R * 0.5, R * 0.25, R * 0.1); dot(g, R * 0.35, -R * 0.15, R * 0.1); eyes(g, R * 0.8, -R * 0.2, R * 0.09, R * 0.12, blink); }
        g.restore();
      }
      function drawBubble(b) {
        const k = Math.min(1, b.t / 200) * (b.t > b.dur - 300 ? Math.max(0, (b.dur - b.t) / 300) : 1), R = S * 0.05;
        if (k <= 0) return;
        g.save(); g.translate(b.x, b.y - R * 1.2); g.scale(k, k);
        g.fillStyle = "#fff"; g.shadowColor = "rgba(255,255,255,0.5)"; g.shadowBlur = R * 0.4;
        rr(g, -R * 1.1, -R * 0.95, R * 2.2, R * 1.9, R * 0.6); g.fill();
        g.beginPath(); g.moveTo(-R * 0.3, R * 0.9); g.lineTo(0, R * 1.5); g.lineTo(R * 0.3, R * 0.9); g.fill(); g.shadowBlur = 0;
        (PICT[b.pict] || PICT.heart)(g, R * 0.6);
        g.restore();
      }
      function drawGround() {
        // grass with deterministic tufts + flowers, only inside the camera view
        g.fillStyle = "#15302a"; g.fillRect(0, 0, S, S);
        const cell = S * 0.075, i0 = Math.floor(cam.x / cell), j0 = Math.floor(cam.y / cell), n = Math.ceil(S / cell) + 2;
        for (let i = i0; i < i0 + n; i++) for (let j = j0; j < j0 + n; j++) {
          const h1 = hash(i, j), h2 = hash(j, i), x = i * cell + h1 * cell - cam.x, y = j * cell + h2 * cell - cam.y;
          if (h1 < 0.5) { g.fillStyle = "rgba(127,224,160," + (0.05 + h2 * 0.08) + ")"; ell(g, x, y, cell * 0.45, cell * 0.28); g.fill(); }
          if (h2 > 0.82) { g.strokeStyle = "rgba(127,224,160,0.35)"; g.lineWidth = Math.max(1, S * 0.003); g.lineCap = "round"; g.beginPath(); for (let t = -1; t <= 1; t++) { g.moveTo(x + t * cell * 0.07, y); g.lineTo(x + t * cell * 0.14 + Math.sin(now * 0.002 + i) * cell * 0.03, y - cell * 0.22); } g.stroke(); }
          if (h1 > 0.9) drawFlower(x, y, ["#ff8fd0", "#c9c3ff", "#74b9ff", "#ffb86b"][Math.floor(h2 * 4)], 0.8 + h2 * 0.6);
        }
        // a winding dirt path between the houses
        g.strokeStyle = "rgba(90,74,110,0.5)"; g.lineWidth = S * 0.07; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath();
        const P = [[0.14, 0.58], [0.3, 0.5], [0.5, 0.45], [0.55, 0.3], [0.7, 0.32], [0.86, 0.38], [0.8, 0.55], [0.6, 0.72], [0.45, 0.85]];
        P.forEach(function (p, i) { const x = p[0] * W - cam.x, y = p[1] * W - cam.y; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
        // race track: a light strip with a start flag and a checkered finish
        { const x0 = RACE.x0 * W - cam.x, x1 = RACE.x1 * W - cam.x, y = RACE.y * W - cam.y, h = S * 0.13;
          if (x1 > -S * 0.2 && x0 < S * 1.2 && y > -S * 0.3 && y < S * 1.3) {
            g.fillStyle = "rgba(255,255,255,0.07)"; rr(g, x0, y - h, x1 - x0 + S * 0.08, h * 2, S * 0.03); g.fill();
            g.strokeStyle = "rgba(255,255,255,0.25)"; g.lineWidth = Math.max(1, S * 0.004); g.setLineDash([S * 0.03, S * 0.03]); g.beginPath(); g.moveTo(x0, y); g.lineTo(x1 + S * 0.08, y); g.stroke(); g.setLineDash([]);
            for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? "#fff" : "#2a2434"; g.fillRect(x1 + i * S * 0.015, y - h + j * h, S * 0.015, h); }   // finish line
            g.fillStyle = "rgba(255,255,255,0.5)"; g.fillRect(x0 + S * 0.03, y - h, S * 0.006, h * 2);  // start line
            if (race) { // progress bar above the track
              g.fillStyle = "rgba(0,0,0,0.35)"; rr(g, x0, y - h - S * 0.06, x1 - x0, S * 0.03, S * 0.015); g.fill();
              const k1 = (frog.x - RACE.x0 * W) / (RACE.x1 * W - RACE.x0 * W), k2 = (race.rx - RACE.x0 * W) / (RACE.x1 * W - RACE.x0 * W);
              g.fillStyle = GREEN; dot(g, x0 + Math.max(0, Math.min(1, k1)) * (x1 - x0), y - h - S * 0.045, S * 0.014); g.fillStyle = "#fff"; dot(g, x0 + Math.max(0, Math.min(1, k2)) * (x1 - x0), y - h - S * 0.045, S * 0.011);
            }
          } }
        // ponds
        PONDS.forEach(function (p) {
          const x = p.x * W - cam.x, y = p.y * W - cam.y, rx = p.rx * W, ry = p.ry * W;
          if (x + rx < -S * 0.1 || x - rx > S * 1.1 || y + ry < -S * 0.1 || y - ry > S * 1.1) return;
          g.fillStyle = "#1e4d6e"; g.shadowColor = "#74b9ff"; g.shadowBlur = S * 0.04; ell(g, x, y, rx, ry); g.fill(); g.shadowBlur = 0;
          g.fillStyle = "#2a6a92"; ell(g, x - rx * 0.15, y - ry * 0.15, rx * 0.75, ry * 0.7); g.fill();
          g.strokeStyle = "rgba(191,233,255,0.25)"; g.lineWidth = Math.max(1, S * 0.003); for (let i = 0; i < 3; i++) { const ph = now * 0.0006 + i * 2.1; g.beginPath(); g.ellipse(x + Math.cos(ph) * rx * 0.3, y + Math.sin(ph) * ry * 0.3, rx * 0.25, ry * 0.25, 0, 0, TAU); g.stroke(); }
          // lily pads
          for (let i = 0; i < 5; i++) { const a = i * 1.26 + p.x * 10, px = x + Math.cos(a) * rx * 0.62, py = y + Math.sin(a) * ry * 0.62 + Math.sin(now * 0.002 + i) * S * 0.003, r = S * 0.03; g.fillStyle = "#3fa66a"; g.beginPath(); g.moveTo(px, py); g.arc(px, py, r, a + 0.3, a + TAU - 0.3); g.closePath(); g.fill(); if (i % 2) drawFlower(px, py - r * 0.3, "#ff8fd0", 1.1); }
        });
        ripples.forEach(function (r) { const k = r.t / r.dur; g.strokeStyle = "rgba(191,233,255," + (0.5 * (1 - k)) + ")"; g.lineWidth = Math.max(1, S * 0.003); g.beginPath(); g.ellipse(r.x - cam.x, r.y - cam.y, r.r * k, r.r * k * 0.5, 0, 0, TAU); g.stroke(); });
      }
      function drawWorld() {
        drawGround();
        const items = [];
        const vis = function (x, y, m) { return x > cam.x - m && x < cam.x + S + m && y > cam.y - m && y < cam.y + S + m; };
        TREES.forEach(function (t, i) { const x = t[0] * W, y = t[1] * W; if (vis(x, y, S * 0.3)) items.push({ y: y, f: function () { drawTree(x - cam.x, y - cam.y, 0.9 + hash(i, 7) * 0.5, i); } }); });
        ROCKS.forEach(function (t, i) { const x = t[0] * W, y = t[1] * W; if (vis(x, y, S * 0.2)) items.push({ y: y, f: function () { drawRock(x - cam.x, y - cam.y, 0.8 + hash(i, 3) * 0.6); } }); });
        SHROOMS.forEach(function (t, i) { const x = t[0] * W, y = t[1] * W; if (vis(x, y, S * 0.2)) items.push({ y: y, f: function () { drawShroom(x - cam.x, y - cam.y, 0.9 + hash(i, 5) * 0.5); } }); });
        { const fx0 = RACE.x0 * W, fy = RACE.y * W - S * 0.1, fx1 = RACE.x1 * W + S * 0.015;
          if (vis(fx0, fy, S * 0.3)) items.push({ y: fy + S * 0.1, f: function () { drawFlag(fx0 - cam.x, fy - cam.y, true); } });
          if (vis(fx1, fy, S * 0.3)) items.push({ y: fy + S * 0.1, f: function () { drawFlag(fx1 - cam.x, fy - cam.y, false); } }); }
        HOUSES.forEach(function (h) { const x = h.x * W, y = h.y * W; if (vis(x, y, S * 0.3)) items.push({ y: y + S * 0.1, f: function () { drawHouse(h, x - cam.x, y - cam.y); } }); });
        animals.forEach(function (a) { if (vis(a.x, a.y, S * 0.3)) items.push({ y: a.y + (a.kind === "owl" ? -S * 0.2 : 0), f: function () { if (a.kind !== "duck" && a.kind !== "owl") drawShadow(a.x - cam.x, a.y - cam.y, S * 0.05, a.z || 0); drawAnimal(Object.assign({}, a, { x: a.x - cam.x, y: a.y - cam.y })); } }); });
        // the owl sits in the tree at (0.68,0.12) → draw above the canopy
        items.push({ y: frog.y + (frog.swim ? -S : 0), f: function () { drawTheFrog(); } });
        items.sort(function (a, b) { return a.y - b.y; });
        // frog swimming should be drawn right after the ponds (under everything else) — handled by the -S offset
        items.forEach(function (it) { it.f(); });
        flies.forEach(function (f) { if (vis(f.x, f.y, S * 0.1)) drawFly(g, f.x - cam.x, f.y - cam.y, S * 0.02, now, f.ph); });
        drawFx(cam.x, cam.y);
        if (bubble) drawBubble({ x: bubble.x - cam.x, y: bubble.y - cam.y, pict: bubble.pict, t: bubble.t, dur: bubble.dur });
        drawMinimap();
      }
      function drawTheFrog() {
        const f = frog, R = frogR(), x = f.x - (scene === "world" ? cam.x : 0), y = f.y - (scene === "world" ? cam.y : 0);
        const tongue = f.tongue ? { tx: f.tongue.tx, ty: f.tongue.ty, k: Math.sin(Math.min(1, f.tongue.t / f.tongue.dur) * Math.PI) } : null;
        if (f.swim) {
          // half-submerged: body low, ripple ring, gentle bob
          const bob = Math.sin(now * 0.005) * R * 0.08;
          g.save(); g.beginPath(); g.rect(x - R * 3, y - R * 3, R * 6, R * 3.35 + bob); g.clip();
          drawFrog(g, x, y + R * 0.3 + bob, R, f.face, now, { blink: f.blink > 0, sq: f.sq, tongue: tongue, happy: f.happy > 0 });
          g.restore();
          g.strokeStyle = "rgba(191,233,255,0.6)"; g.lineWidth = Math.max(1.5, S * 0.004); ell(g, x, y + R * 0.35 + bob, R * 1.35, R * 0.5); g.stroke();
        } else {
          drawShadow(x, y, R * 1.1, f.z);
          drawFrog(g, x, y - f.z * R * 1.6, R, f.face, now, { blink: f.blink > 0, sq: f.sq, tongue: tongue, happy: f.happy > 0 });
        }
      }
      function drawFx(ox, oy) {
        fx.forEach(function (e) {
          const k = e.t / e.dur, x = e.x - ox, y = e.y - oy;
          g.save();
          if (e.kind === "mark") { g.globalAlpha = 1 - k; g.strokeStyle = "#fff"; g.lineWidth = Math.max(1.5, S * 0.004); g.beginPath(); g.arc(x, y, S * 0.02 + k * S * 0.03, 0, TAU); g.stroke(); }
          else if (e.kind === "spark") { g.globalAlpha = 1 - k; g.fillStyle = e.col; dot(g, x, y, S * 0.006); }
          else if (e.kind === "conf") { g.globalAlpha = 1 - k; g.fillStyle = e.col; g.translate(x, y); g.rotate(e.rot); g.fillRect(-S * 0.008, -S * 0.005, S * 0.016, S * 0.01); }
          else if (e.kind === "ring") { g.globalAlpha = 1 - k; g.strokeStyle = e.big ? "#7fe0a0" : "#ffd36b"; g.lineWidth = Math.max(2, S * 0.008); g.beginPath(); g.arc(x, y, S * 0.03 + k * S * (e.big ? 0.25 : 0.12), 0, TAU); g.stroke(); }
          else if (e.kind === "star") { g.globalAlpha = 1 - k; g.translate(x, y - k * S * 0.08); g.scale(1 + k * 0.5, 1 + k * 0.5); PICT.star(g, S * 0.025); }
          g.restore();
        });
      }
      function drawMinimap() {
        const m = S * 0.16, x0 = S - m - S * 0.025, y0 = S - m - S * 0.025;
        g.save(); g.globalAlpha = 0.85; rr(g, x0, y0, m, m, S * 0.02); g.fillStyle = "rgba(10,20,18,0.8)"; g.fill(); g.strokeStyle = "rgba(127,224,160,0.5)"; g.lineWidth = 1.5; g.stroke();
        PONDS.forEach(function (p) { g.fillStyle = "#2a6a92"; ell(g, x0 + p.x * m, y0 + p.y * m, p.rx * m, p.ry * m); g.fill(); });
        g.strokeStyle = "rgba(255,255,255,0.45)"; g.lineWidth = 2; g.beginPath(); g.moveTo(x0 + RACE.x0 * m, y0 + RACE.y * m); g.lineTo(x0 + RACE.x1 * m, y0 + RACE.y * m); g.stroke();
        HOUSES.forEach(function (h) { g.fillStyle = h.col; dot(g, x0 + h.x * m, y0 + h.y * m, m * 0.045); });
        g.fillStyle = GREEN; g.shadowColor = GREEN; g.shadowBlur = 6; dot(g, x0 + frog.x / W * m, y0 + frog.y / W * m, m * 0.04 + Math.sin(now * 0.006) * m * 0.008);
        g.restore();
      }
      function drawHouseScene() {
        const R = ROOM(), h = HOUSES[house];
        g.fillStyle = "#0e0c1e"; g.fillRect(0, 0, S, S);
        // walls + floor
        g.fillStyle = h.col; g.globalAlpha = 0.25; rr(g, R.x - S * 0.03, R.y - S * 0.1, R.w + S * 0.06, R.h + S * 0.13, S * 0.05); g.fill(); g.globalAlpha = 1;
        g.fillStyle = "#3a3048"; rr(g, R.x, R.y - S * 0.06, R.w, R.h + S * 0.06, S * 0.03); g.fill();
        g.fillStyle = "#4a3448"; rr(g, R.x, R.y + R.h * 0.42, R.w, R.h * 0.58, S * 0.03); g.fill();
        g.fillStyle = h.roof; g.globalAlpha = 0.6; ell(g, R.x + R.w / 2, R.y + R.h * 0.72, R.w * 0.33, R.h * 0.16); g.fill(); g.globalAlpha = 1;
        // window with moon, picture of a fly on the wall, a little bed and table
        g.fillStyle = "#1c1834"; rr(g, R.x + R.w * 0.1, R.y, R.w * 0.2, R.h * 0.28, S * 0.02); g.fill();
        g.save(); g.translate(R.x + R.w * 0.2, R.y + R.h * 0.14); PICT.moon(g, S * 0.035); g.restore();
        g.fillStyle = "#f4e2c2"; rr(g, R.x + R.w * 0.72, R.y + R.h * 0.04, R.w * 0.16, R.h * 0.2, S * 0.01); g.fill();
        g.save(); g.translate(R.x + R.w * 0.8, R.y + R.h * 0.14); PICT.fly(g, S * 0.03); g.restore();
        g.fillStyle = h.col; rr(g, R.x + R.w * 0.04, R.y + R.h * 0.5, R.w * 0.22, R.h * 0.3, S * 0.02); g.fill(); g.fillStyle = "#fff"; rr(g, R.x + R.w * 0.06, R.y + R.h * 0.5, R.w * 0.08, R.h * 0.1, S * 0.015); g.fill();
        g.fillStyle = "#c8a06a"; rr(g, R.x + R.w * 0.72, R.y + R.h * 0.45, R.w * 0.2, R.h * 0.1, S * 0.015); g.fill(); g.fillRect(R.x + R.w * 0.75, R.y + R.h * 0.55, R.w * 0.03, R.h * 0.18); g.fillRect(R.x + R.w * 0.86, R.y + R.h * 0.55, R.w * 0.03, R.h * 0.18);
        g.fillStyle = "#ff8fa3"; rr(g, R.x + R.w * 0.77, R.y + R.h * 0.39, R.w * 0.1, R.h * 0.07, S * 0.01); g.fill(); g.fillStyle = "#ffd36b"; dot(g, R.x + R.w * 0.82, R.y + R.h * 0.37, S * 0.01);
        // door (bottom middle) — click to go back outside
        const D = doorRect(); g.fillStyle = h.roof; g.shadowColor = h.roof; g.shadowBlur = S * 0.03; rr(g, D.x, D.y, D.w, D.h, S * 0.03); g.fill(); g.shadowBlur = 0;
        g.fillStyle = "#ffd36b"; dot(g, D.x + D.w * 0.75, D.y + D.h * 0.55, S * 0.008);
        g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = Math.max(2, S * 0.006); g.lineCap = "round"; g.beginPath(); g.moveTo(D.x + D.w / 2, D.y + D.h * 0.25); g.lineTo(D.x + D.w / 2, D.y + D.h * 0.75); g.moveTo(D.x + D.w * 0.3, D.y + D.h * 0.55); g.lineTo(D.x + D.w / 2, D.y + D.h * 0.78); g.lineTo(D.x + D.w * 0.7, D.y + D.h * 0.55); g.stroke();
        // toad + frog (depth-sorted)
        const items = [{ y: roomToad.y, f: function () { drawShadow(roomToad.x, roomToad.y, S * 0.085, 0); drawFrog(g, roomToad.x, roomToad.y, S * 0.078, roomToad.x < frog.x ? 1 : -1, now, { body: roomToad.body, dark: roomToad.dark, belly: roomToad.belly, warts: true, sq: roomToad.sq, happy: roomToad.talk > 0, blink: (now % 3300) < 150 }); } }, { y: frog.y, f: drawTheFrog }];
        items.sort(function (a, b) { return a.y - b.y; }); items.forEach(function (it) { it.f(); });
        flies.forEach(function (f) { drawFly(g, f.x, f.y, S * 0.02, now, f.ph); });
        drawFx(0, 0);
        if (bubble) drawBubble(bubble);
      }
      function doorRect() { const R = ROOM(); return { x: R.x + R.w / 2 - S * 0.07, y: R.y + R.h + S * 0.01, w: S * 0.14, h: S * 0.1 }; }

      function draw() {
        g.clearRect(0, 0, S, S);
        if (scene === "world") drawWorld(); else drawHouseScene();
        // counter
        g.save(); g.textAlign = "center"; g.textBaseline = "top"; g.fillStyle = "#ffd36b"; g.shadowColor = "rgba(255,211,107,0.6)"; g.shadowBlur = 16;
        g.font = "800 " + Math.round(S * 0.075) + "px system-ui, sans-serif"; g.fillText("★ " + eaten, S / 2, S * 0.025); g.restore();
        if (fade > 0) { g.fillStyle = "rgba(10,8,20," + fade + ")"; g.fillRect(0, 0, S, S); }
      }

      // ---- input ---- LEFT = move/talk/enter ONLY. RIGHT = tongue ONLY. (Touch: hold ~0.4 s = tongue.)
      function leftAction(x, y) {
        if (fadeDir) return;
        const wx = scene === "world" ? x + cam.x : x, wy = scene === "world" ? y + cam.y : y;
        if (race) { raceClick(); return; }
        // tap the frog itself -> ribbit
        if (Math.hypot(wx - frog.x, wy - frog.y) < frogR() * 1.6) { sndRibbit(); frog.sq = 1; frog.happy = 1200; fx.push({ kind: "star", x: frog.x, y: frog.y - frogR() * 1.6, t: 0, dur: 900 }); return; }
        if (scene === "house") {
          const D = doorRect();
          if (x > D.x - S * 0.03 && x < D.x + D.w + S * 0.03 && y > D.y - S * 0.03) { goTo(D.x + D.w / 2, D.y - S * 0.03, { type: "door" }); return; }
          if (Math.hypot(wx - roomToad.x, wy - roomToad.y) < S * 0.13) { if (Math.hypot(frog.x - roomToad.x, frog.y - roomToad.y) < S * 0.24) toadTalk(); else goTo(roomToad.x + (frog.x < roomToad.x ? -1 : 1) * S * 0.17, roomToad.y + S * 0.06, { type: "toad" }); return; }
          goTo(x, y); return;
        }
        // the race start flag
        { const fx0 = RACE.x0 * W + S * 0.03, fy = RACE.y * W; if (Math.abs(wx - fx0) < S * 0.1 && Math.abs(wy - fy) < S * 0.14) { const sp = raceStartPos(); goTo(sp.x, sp.y, { type: "race" }); return; } }
        // animals
        let a = null; animals.forEach(function (q) { if (Math.hypot(q.x - wx, q.y - wy) < S * 0.09) a = q; });
        if (a) { if (Math.hypot(frog.x - a.x, frog.y - a.y) < S * 0.2) talk(a); else goTo(a.x + (frog.x < a.x ? -1 : 1) * S * 0.14, a.y + S * 0.03, { type: "animal", a: a }); return; }
        // houses
        for (let i = 0; i < HOUSES.length; i++) { const h = HOUSES[i], hx = h.x * W, hy = h.y * W; if (Math.abs(wx - hx) < S * 0.16 && wy > hy - S * 0.16 && wy < hy + S * 0.14) { const d = houseDoor(h); goTo(d.x, d.y + S * 0.03, { type: "house", i: i }); return; } }
        goTo(wx, wy);
      }
      function rightAction(x, y) {
        if (fadeDir) return;
        const wx = scene === "world" ? x + cam.x : x, wy = scene === "world" ? y + cam.y : y;
        shootTongue(wx, wy);      // always the tongue, never a move - even if the fly is out of reach
      }

      return {
        mount(stage, c) {
          stageEl = stage; ctx = c;
          reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          touchDevice = (navigator.maxTouchPoints || 0) > 0 && !window.matchMedia("(pointer: fine)").matches;
          const wrap = document.createElement("div");
          wrap.style.display = "flex"; wrap.style.flexDirection = "column"; wrap.style.alignItems = "center";
          canvas = document.createElement("canvas");
          canvas.style.borderRadius = "18px"; canvas.style.background = "#15302a"; canvas.style.cursor = "pointer";
          canvas.style.boxShadow = "0 0 46px rgba(127,224,160,0.14)"; canvas.style.touchAction = "none";
          g = canvas.getContext("2d");
          wrap.appendChild(canvas);
          const hint = document.createElement("div"); hint.className = "hint";
          hint.textContent = touchDevice ? "Tap: hop there. Hold: tongue! Tap animals to say hi, tap a house to go in, tap the flag to race the bunny." : "Left-click: hop there. Right-click: tongue! Click animals to say hi, a house to go in, the flag to race the bunny.";
          wrap.appendChild(hint);
          stage.appendChild(wrap);
          ctxMenu = function (e) { e.preventDefault(); }; canvas.addEventListener("contextmenu", ctxMenu);
          try { duckClip = new Audio("audio/animals/duck.mp3"); duckClip.preload = "auto"; } catch (e) { duckClip = null; }
          if (window.Arcade && Arcade.voice && Arcade.voice.preload) Arcade.voice.preload(ANIMALS.map(function (a) { return a.line; }).concat(HOUSE_LINES, ["Yummy!", "Bye bye!", "Great job!", "Try again!"]));
          now = 0; eaten = 0; S = 0;
          resize(); reset();
          ctx.setScore(0);
          Arcade.input.setPointerTarget(canvas);
          unResize = Arcade.board.onResize(function () { resize(); });
          Arcade._frog = { get: function () { return { frog: frog, flies: flies, animals: animals, scene: scene, cam: cam, S: S, W: W, eaten: eaten, race: race, race0: { x: RACE.x0 * W, x1: RACE.x1 * W, y: RACE.y * W }, houses: HOUSES.map(function (h) { return { x: h.x * W, y: h.y * W }; }) }; } };
          draw();
        },
        handleInput(intent) {
          if (intent.type !== "point") return;
          if (intent.phase === "down" && intent.button === 2) { press = null; rightAction(intent.x, intent.y); return; }
          if (intent.button !== 0) return;
          if (intent.phase === "down") {
            if (!touchDevice) { leftAction(intent.x, intent.y); return; }
            const wx = scene === "world" ? intent.x + cam.x : intent.x, wy = scene === "world" ? intent.y + cam.y : intent.y;
            press = { x: intent.x, y: intent.y, wx: wx, wy: wy, t: now, done: false };   // touch: decide on release (tap) or after a hold (tongue)
          } else if (intent.phase === "up" && press) {
            const p = press; press = null; if (!p.done) leftAction(p.x, p.y);
          }
        },
        tick(dt) { update(Math.min(50, dt)); draw(); },
        getScore() { return eaten; },
        teardown() {
          if (unResize) unResize(); unResize = null;
          if (canvas && ctxMenu) canvas.removeEventListener("contextmenu", ctxMenu); ctxMenu = null;
          if (window.Arcade && Arcade.voice) Arcade.voice.stop();
          if (window.Arcade) delete Arcade._frog;
          stageEl = ctx = canvas = g = null; flies = []; animals = []; fx = []; ripples = []; bubble = null; roomToad = null; worldFlies = null; duckClip = null;
        }
      };
    }
  });
})();
