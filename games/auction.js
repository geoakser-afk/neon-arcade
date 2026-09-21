/* Squishy Auction — a live auction house for Squishy Bazaar toys (2–6 players).
   Built on Arcade.mpLobby (Play Together lobby) + Arcade.net (relay). The HOST owns the auction state and
   broadcasts {k:"state"} every 250 ms and on every change; bidders send {k:"bid"} to the host; the host
   validates and rebroadcasts. Inventory + coins move ONLY when the host broadcasts {k:"sold"}: the winner
   adds the toy (new uid, per-owner) and pays, the seller removes it (by uid) and gets paid. Everything is
   read/written in the Squishy Bazaar save (Arcade.storage key g:bazaar:save) so the toys really change hands.
   The toy catalog + renderer below mirror games/bazaar.js (ids must stay identical). */
(function () {
  // ---------- data mirrored from games/bazaar.js ----------
  const RAR = [
    { key: "common",    label: "Common",    col: "#a9b4c4", w: 52 },
    { key: "uncommon",  label: "Uncommon",  col: "#7fe0a0", w: 27 },
    { key: "rare",      label: "Rare",      col: "#74b9ff", w: 13 },
    { key: "epic",      label: "Epic",      col: "#c98cff", w: 5.5 },
    { key: "super",     label: "Super",     col: "#ff8fd0", w: 2 },
    { key: "legendary", label: "Legendary", col: "#ffd36b", w: 0.6 }
  ];
  const RI = {}; RAR.forEach(function (r, i) { RI[r.key] = i; });
  function I(id, name, cat, rar, base, shape, ca, cb, pat) { return { id: id, name: name, cat: cat, rar: rar, base: base, shape: shape, ca: ca, cb: cb, pat: pat }; }
  const ITEMS = [
    I("crunch_bead", "Bead Crunch Ball", "crunchy", "common", 12, "ball", "#f7c873", "#c9852c", "spots"),
    I("crunch_donut", "Crunchy Donut", "crunchy", "common", 14, "donut", "#f4a6c1", "#a85c7c", "spots"),
    I("crunch_star", "Crunch Star", "crunchy", "common", 15, "star", "#ffd27a", "#b57b1f", "none"),
    I("spike_pom", "Spiky Pom", "needle", "common", 10, "spiky", "#9be7ff", "#3f8fb5", "none"),
    I("pin_tube", "Pin Tube", "needle", "common", 12, "tube", "#8ee3f5", "#2d7f96", "stripes"),
    I("rubber_bouncer", "Rubber Bouncer", "bouncy", "common", 9, "ball", "#ff9fb0", "#b8455e", "stripes"),
    I("mini_bun", "Mini Bun", "soft", "common", 11, "blob", "#ffe0ea", "#d18ea3", "face"),
    I("popit_square", "Pop-It Square", "clicky", "common", 13, "pop", "#b8f2b0", "#5c9a52", "none"),
    I("bubble_wrap", "Bubble Wrap Strip", "clicky", "common", 9, "bar", "#cfe8ff", "#6d8fb5", "bubbles"),
    I("green_goo", "Green Goo", "slime", "common", 12, "drop", "#a6ffb0", "#3f9a52", "bubbles"),
    I("stress_orb", "Stress Orb", "odd", "common", 8, "ball", "#d9d9e6", "#7a7a94", "none"),
    I("mochi_kitty", "Mochi Kitty", "soft", "uncommon", 32, "blob", "#fff1f3", "#e6a9b8", "face"),
    I("crunch_avocado", "Crunch Avocado", "crunchy", "uncommon", 28, "drop", "#b6e388", "#4d7a2a", "none"),
    I("hedgehog_poker", "Hedgehog Poker", "needle", "uncommon", 30, "spiky", "#c9b8ff", "#6a55b5", "none"),
    I("glow_bouncer", "Glow Bouncer", "bouncy", "uncommon", 34, "ball", "#c6ff9a", "#5a9a2e", "glitter"),
    I("tri_spinner", "Tri Spinner", "clicky", "uncommon", 40, "spinner", "#ffd08a", "#b5651d", "none"),
    I("think_putty", "Think Putty", "slime", "uncommon", 36, "blob", "#ffb3d9", "#b3477f", "swirl"),
    I("infinity_cube", "Infinity Cube", "clicky", "uncommon", 45, "cube", "#a8b8ff", "#4a5aa8", "none"),
    I("water_snake", "Wiggly Water Snake", "odd", "uncommon", 38, "tube", "#9ad8ff", "#2e6f9c", "spots"),
    I("squeaky_duck", "Squeaky Duck", "odd", "uncommon", 26, "blob", "#ffe27a", "#c99a1c", "face"),
    I("splat_ball", "Splat Ball", "bouncy", "uncommon", 30, "ball", "#ff9c6b", "#b5442e", "none"),
    I("crunch_cloud", "Crunch Cloud", "crunchy", "rare", 95, "cloud", "#f3f6ff", "#a4b5d6", "glitter"),
    I("crystal_spike", "Crystal Spike", "needle", "rare", 120, "spiky", "#b6f0ff", "#3d9fb5", "glitter"),
    I("galaxy_bouncer", "Galaxy Bouncer", "bouncy", "rare", 110, "ball", "#7f8cff", "#2a2f7a", "glitter"),
    I("slowrise_cake", "Slow-Rise Cake", "soft", "rare", 130, "cube", "#ffd7e8", "#c77aa0", "face"),
    I("heart_popit", "Heart Pop-It", "clicky", "rare", 100, "heart", "#ff9fc8", "#b04a78", "none"),
    I("glitter_slime", "Glitter Slime", "slime", "rare", 115, "drop", "#c8a6ff", "#6a3fb5", "glitter"),
    I("magnet_beads", "Magnet Beads", "odd", "rare", 140, "ball", "#c4c9d6", "#5d6270", "spots"),
    I("tangle_twist", "Tangle Twist", "odd", "rare", 90, "donut", "#7fe0c0", "#2f8a70", "stripes"),
    I("needoh_cube", "Nee-Doh Cube", "slime", "rare", 125, "cube", "#a6ffe8", "#3fa08a", "bubbles"),
    I("dragon_crunch", "Dragon Crunch", "crunchy", "epic", 320, "star", "#ff9d6b", "#b5321e", "glitter"),
    I("neon_urchin", "Neon Urchin", "needle", "epic", 380, "spiky", "#c8ff6b", "#5a9a1e", "glitter"),
    I("moon_bouncer", "Moon Bouncer", "bouncy", "epic", 350, "ball", "#f2f2ff", "#8a8ab5", "spots"),
    I("giant_bun", "Giant Slow-Rise Bun", "soft", "epic", 420, "blob", "#fff4e0", "#d9a066", "face"),
    I("gold_spinner", "Gold Spinner", "clicky", "epic", 450, "spinner", "#ffe08a", "#b8860b", "glitter"),
    I("nebula_slime", "Nebula Slime", "slime", "epic", 400, "drop", "#8f7fff", "#3a2a8a", "glitter"),
    I("mood_octopus", "Mood Octopus", "odd", "epic", 300, "blob", "#c99cff", "#6b3fb5", "face"),
    I("crown_cruncher", "Crown Cruncher", "crunchy", "super", 900, "star", "#ffe08a", "#c48a00", "glitter"),
    I("aurora_spike", "Aurora Spike", "needle", "super", 1100, "spiky", "#9affe0", "#2a8f7a", "glitter"),
    I("hyper_bouncer", "Hyper Bouncer", "bouncy", "super", 1000, "ball", "#ff7ab8", "#8a1f5a", "glitter"),
    I("cloud_whale", "Cloud Whale Squish", "soft", "super", 1300, "cloud", "#dfe9ff", "#8aa0d6", "face"),
    I("prism_cube", "Prism Cube", "clicky", "super", 1200, "cube", "#d0f0ff", "#5a7aa8", "glitter"),
    I("void_putty", "Void Putty", "slime", "super", 1150, "blob", "#7a6ab0", "#1a1030", "glitter"),
    I("everlasting_crunch", "The Everlasting Crunch", "crunchy", "legendary", 3500, "star", "#fff0b0", "#d4a017", "glitter"),
    I("starneedle", "Starneedle", "needle", "legendary", 4000, "spiky", "#e0ffff", "#4aa8b5", "glitter"),
    I("infinity_bouncer", "Infinity Bouncer", "bouncy", "legendary", 4500, "ball", "#ffffff", "#7a7aff", "glitter"),
    I("original_squishy", "The Original Squishy", "soft", "legendary", 6000, "blob", "#ffe6ee", "#e08aa8", "face"),
    I("dragon_breath", "Dragon's Breath Slime", "slime", "legendary", 5000, "drop", "#ff9a6b", "#a3241a", "glitter"),
    I("mystery_fidget", "The Mystery Fidget", "odd", "legendary", 5500, "cube", "#5a5a8a", "#0f0f1f", "glitter")
  ];
  const ITEM = {}; ITEMS.forEach(function (it) { ITEM[it.id] = it; });
  const CAT_KEYS = ["crunchy", "needle", "bouncy", "soft", "clicky", "slime", "odd"];
  const INV_MAX = 40, MAX_LOTS = 3, MYSTERY_N = 2, HOUSE = "house", STATE_EVERY = 250;
  let LOT_MS = 12000, BID_MS = 6000, BETWEEN_MS = 2600, COLLECT_MS = 900;   // let: Arcade._auction.fast() shortens them
  const TAU = Math.PI * 2;

  // ---------- small helpers ----------
  function hexRgb(h) { const m = /^#?([0-9a-f]{6})$/i.exec(h || ""); if (!m) return [180, 180, 180]; const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(h1, h2, t) { const a = hexRgb(h1), b = hexRgb(h2); return "rgb(" + Math.round(a[0] + (b[0] - a[0]) * t) + "," + Math.round(a[1] + (b[1] - a[1]) * t) + "," + Math.round(a[2] + (b[2] - a[2]) * t) + ")"; }
  function lighten(h, t) { return mix(h, "#ffffff", t); }
  function darken(h, t) { return mix(h, "#000000", t); }
  function rgba(h, a) { const c = hexRgb(h); return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0); }
  function srnd(seed, i) { const x = Math.sin(seed * 0.37 + i * 78.233) * 43758.5453; return x - Math.floor(x); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function clampInt(v, lo, hi, fb) { v = Math.floor(+v); if (!isFinite(v)) return fb; return Math.max(lo, Math.min(hi, v)); }
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function fill(tpl, m) { return tpl.replace(/\{(\w+)\}/g, function (_, k) { return m[k] != null ? m[k] : ""; }); }

  // ---------- compact toy renderer (faithful to bazaar's drawToy: soft-shaded glossy body, pattern, rim light, face) ----------
  function pathRR(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function smoothClosed(g, pts) { const n = pts.length; const p0 = pts[n - 1], p1 = pts[0]; g.moveTo((p0.x + p1.x) / 2, (p0.y + p1.y) / 2); for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; g.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2); } g.closePath(); }
  function shapePath(g, shape, r, seed, spin) {
    spin = spin || 0; g.beginPath();
    switch (shape) {
      case "blob": { const pts = []; for (let i = 0; i < 10; i++) { const a = i / 10 * TAU, rr = r * (0.9 + srnd(seed, i) * 0.16); pts.push({ x: Math.cos(a) * rr * 1.05, y: Math.sin(a) * rr * 0.93 }); } smoothClosed(g, pts); break; }
      case "cube": pathRR(g, -r * 0.85, -r * 0.85, r * 1.7, r * 1.7, r * 0.24); break;
      case "star": { const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i / 10 * TAU, rr = i % 2 ? r * 0.55 : r; pts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr }); } smoothClosed(g, pts); break; }
      case "spiky": { const n = 16; for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * TAU + spin, rr = i % 2 ? r * 0.68 : r; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); } g.closePath(); break; }
      case "donut": g.arc(0, 0, r, 0, TAU); g.moveTo(r * 0.4, 0); g.arc(0, 0, r * 0.4, 0, TAU, true); break;
      case "bar": pathRR(g, -r, -r * 0.42, r * 2, r * 0.84, r * 0.32); break;
      case "tube": pathRR(g, -r * 0.42, -r, r * 0.84, r * 2, r * 0.4); break;
      case "cloud": [[-0.45, 0.12, 0.5], [-0.12, -0.3, 0.55], [0.35, -0.08, 0.5], [0.12, 0.25, 0.5], [-0.2, 0.28, 0.45]].forEach(function (c) { g.moveTo(c[0] * r + c[2] * r, c[1] * r); g.arc(c[0] * r, c[1] * r, c[2] * r, 0, TAU); }); break;
      case "heart": g.moveTo(0, r * 0.85); g.bezierCurveTo(-r * 1.35, -r * 0.05, -r * 0.65, -r * 1.1, 0, -r * 0.45); g.bezierCurveTo(r * 0.65, -r * 1.1, r * 1.35, -r * 0.05, 0, r * 0.85); g.closePath(); break;
      case "drop": g.moveTo(0, -r); g.bezierCurveTo(r * 0.95, -r * 0.05, r * 0.9, r * 0.95, 0, r * 0.95); g.bezierCurveTo(-r * 0.9, r * 0.95, -r * 0.95, -r * 0.05, 0, -r); g.closePath(); break;
      case "spinner": for (let k = 0; k < 3; k++) { const a = spin + k * TAU / 3, cx = Math.cos(a) * r * 0.55, cy = Math.sin(a) * r * 0.55; g.moveTo(cx + r * 0.45, cy); g.arc(cx, cy, r * 0.45, 0, TAU); } g.moveTo(r * 0.32, 0); g.arc(0, 0, r * 0.32, 0, TAU); break;
      case "pop": pathRR(g, -r * 0.9, -r * 0.9, r * 1.8, r * 1.8, r * 0.4); break;
      default: g.arc(0, 0, r, 0, TAU);
    }
  }
  function bodyGradient(g, ca, cb, r) { const gr = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.08, 0, 0, r * 1.25); gr.addColorStop(0, lighten(ca, 0.45)); gr.addColorStop(0.42, ca); gr.addColorStop(1, cb); return gr; }
  function sparkle(g, x, y, s, a) { g.fillStyle = "rgba(255,255,255," + a + ")"; g.beginPath(); g.moveTo(x, y - s); g.quadraticCurveTo(x, y, x + s, y); g.quadraticCurveTo(x, y, x, y + s); g.quadraticCurveTo(x, y, x - s, y); g.quadraticCurveTo(x, y, x, y - s); g.fill(); }
  function drawPattern(g, it, r, seed, t) {
    const cb = it.cb;
    if (it.pat === "spots") { g.fillStyle = rgba(cb, 0.5); for (let i = 0; i < 7; i++) { const cx = (srnd(seed, i) * 2 - 1) * r * 0.8, cy = (srnd(seed, i + 20) * 2 - 1) * r * 0.8, rad = r * (0.07 + srnd(seed, i + 40) * 0.1); g.beginPath(); g.arc(cx, cy, rad, 0, TAU); g.fill(); } }
    else if (it.pat === "stripes") { g.save(); g.rotate(-0.6); g.fillStyle = rgba(cb, 0.38); for (let k = -4; k <= 4; k++) g.fillRect(k * r * 0.5 - r * 0.1, -2 * r, r * 0.2, 4 * r); g.restore(); }
    else if (it.pat === "glitter") { for (let i = 0; i < 16; i++) { const px = (srnd(seed, i) * 2 - 1) * r * 0.85, py = (srnd(seed, i + 20) * 2 - 1) * r * 0.85, ph = srnd(seed, i + 60); sparkle(g, px, py, r * (0.05 + srnd(seed, i + 80) * 0.06), 0.15 + 0.75 * (0.5 + 0.5 * Math.sin(t * 0.004 + ph * 6.28))); } }
    else if (it.pat === "swirl") { g.strokeStyle = rgba(cb, 0.45); g.lineWidth = r * 0.11; g.lineCap = "round"; g.beginPath(); for (let a = 0; a <= 4 * Math.PI; a += 0.2) { const rad = a / (4 * Math.PI) * r * 0.8, x = Math.cos(a + seed) * rad, y = Math.sin(a + seed) * rad; if (a === 0) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke(); }
    else if (it.pat === "bubbles") { for (let i = 0; i < 7; i++) { const cx = (srnd(seed, i) * 2 - 1) * r * 0.7, cy = (srnd(seed, i + 20) * 2 - 1) * r * 0.7, rad = r * (0.08 + srnd(seed, i + 40) * 0.12); g.fillStyle = "rgba(255,255,255,0.16)"; g.beginPath(); g.arc(cx, cy, rad, 0, TAU); g.fill(); g.fillStyle = "rgba(255,255,255,0.45)"; g.beginPath(); g.arc(cx - rad * 0.35, cy - rad * 0.35, rad * 0.25, 0, TAU); g.fill(); } }
  }
  function drawPop(g, it, r, seed) {
    for (let i = 0; i < 9; i++) {
      const cx = ((i % 3) - 1) * r * 0.55, cy = (Math.floor(i / 3) - 1) * r * 0.55, rad = r * 0.2;
      if (srnd(seed, i + 100) > 0.6) { g.fillStyle = rgba(it.cb, 0.55); g.beginPath(); g.arc(cx, cy, rad, 0, TAU); g.fill(); }
      else { const gr = g.createRadialGradient(cx - rad * 0.3, cy - rad * 0.35, rad * 0.1, cx, cy, rad); gr.addColorStop(0, lighten(it.ca, 0.5)); gr.addColorStop(1, it.cb); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, rad, 0, TAU); g.fill(); }
    }
  }
  function drawFace(g, r) {
    const ey = -r * 0.05, ex = r * 0.3, er = r * 0.085, ink = "rgba(40,30,50,0.85)";
    g.fillStyle = ink; [-1, 1].forEach(function (s) { g.beginPath(); g.ellipse(s * ex, ey, er, er * 1.2, 0, 0, TAU); g.fill(); });
    g.fillStyle = "rgba(255,255,255,0.8)"; [-1, 1].forEach(function (s) { g.beginPath(); g.arc(s * ex - er * 0.3, ey - er * 0.4, er * 0.35, 0, TAU); g.fill(); });
    g.fillStyle = "rgba(255,120,150,0.28)"; [-1, 1].forEach(function (s) { g.beginPath(); g.ellipse(s * r * 0.52, r * 0.22, r * 0.14, r * 0.08, 0, 0, TAU); g.fill(); });
    g.strokeStyle = "rgba(40,30,50,0.7)"; g.lineWidth = r * 0.045; g.lineCap = "round"; g.beginPath(); g.arc(0, r * 0.18, r * 0.12, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  }
  function drawToy(g, x, y, r, it, t) {
    const seed = hash(it.id) % 997, ri = RI[it.rar], rar = RAR[ri];
    g.save(); g.translate(x, y);
    g.globalAlpha = 0.42; g.fillStyle = "#000"; g.beginPath(); g.ellipse(0, r, r * 0.8, r * 0.17, 0, 0, TAU); g.fill(); g.globalAlpha = 1;
    if (it.rar === "legendary") for (let i = 0; i < 6; i++) { const a = t * 0.0012 + i * TAU / 6, rr = r * 1.3; sparkle(g, Math.cos(a) * rr, Math.sin(a) * rr * 0.9, r * 0.09, 0.35 + 0.35 * Math.sin(t * 0.005 + i)); }
    if (ri >= 1) { g.shadowColor = it.rar === "legendary" ? "hsl(" + ((t * 0.05) % 360) + ",90%,70%)" : rar.col; g.shadowBlur = r * (0.2 + ri * 0.13); }
    const spin = it.shape === "spinner" ? t * 0.0006 : 0, isSlime = it.cat === "slime";
    if (it.shape === "spiky") { shapePath(g, "spiky", r, seed, spin); g.fillStyle = bodyGradient(g, darken(it.ca, 0.1), it.cb, r); g.fill(); g.shadowBlur = 0; shapePath(g, "ball", r * 0.7, seed); g.fillStyle = bodyGradient(g, it.ca, it.cb, r * 0.7); g.fill(); }
    else { shapePath(g, it.shape, r, seed, spin); if (isSlime) g.globalAlpha = 0.92; g.fillStyle = bodyGradient(g, it.ca, it.cb, r); g.fill(); g.globalAlpha = 1; }
    g.shadowBlur = 0;
    const cr = it.shape === "spiky" ? r * 0.7 : r, cs = it.shape === "spiky" ? "ball" : it.shape;
    g.save(); shapePath(g, cs, cr, seed, spin); g.clip();
    drawPattern(g, it, cr, seed, t); if (it.shape === "pop") drawPop(g, it, r, seed);
    g.save(); g.translate(cr * 0.07, cr * 0.08); shapePath(g, cs, cr, seed, spin); g.lineWidth = cr * 0.12; g.strokeStyle = "rgba(255,255,255,0.13)"; g.stroke(); g.restore();
    g.save(); g.translate(-cr * 0.07, -cr * 0.09); shapePath(g, cs, cr, seed, spin); g.lineWidth = cr * 0.14; g.strokeStyle = "rgba(0,0,0,0.16)"; g.stroke(); g.restore();
    g.restore();
    g.fillStyle = "rgba(255,255,255," + (isSlime ? 0.5 : 0.36) + ")"; g.beginPath(); g.ellipse(-cr * 0.38, -cr * 0.42, cr * 0.26, cr * 0.13, -0.65, 0, TAU); g.fill();
    g.fillStyle = "rgba(255,255,255,0.55)"; g.beginPath(); g.arc(-cr * 0.15, -cr * 0.6, cr * 0.06, 0, TAU); g.fill();
    if (it.pat === "face") drawFace(g, cr);
    g.restore();
  }

  // ---------- Squishy Bazaar save access (same key bazaar's ctx.storage uses: g:bazaar:save) ----------
  // Reads via Arcade.storage.game("bazaar"); writes via Arcade.storage.set on the full key so cloud.js's set-hook stamps + syncs it.
  function newSave() {
    const cats = {}; CAT_KEYS.forEach(function (k) { const hist = []; for (let i = 0; i < 14; i++) hist.push(1); cats[k] = { m: 1, hist: hist }; });
    return { v: 1, coins: 150, xp: 0, inv: [], nextUid: 1, market: { cats: cats, news: null }, shop: { stock: [], t: 0 }, traders: {}, bot: { on: false, log: [], earned: 0, trades: 0 }, stats: { trades: 0, bought: 0, sold: 0, mini: 0, squeezes: 0, bestWorth: 0 }, seen: {}, intro: false, created: Date.now() };
  }
  function bzPeek() { return Arcade.storage.game("bazaar").get("save", null); }
  function bzGet() {
    let s = bzPeek();
    if (!s || s.v !== 1 || !Array.isArray(s.inv)) { s = newSave(); bzSet(s); }
    if (typeof s.coins !== "number" || !isFinite(s.coins)) s.coins = 150;
    if (!s.nextUid) s.nextUid = 1; if (!s.seen) s.seen = {};
    return s;
  }
  function bzSet(s) { Arcade.storage.set("g:bazaar:save", s); }

  const OPEN_L = ["Next up: {n}! Who opens at {s}?", "Fresh on the block — {n}. Bidding starts at {s}.", "Here's a beauty: {n}. Do I hear {s}?", "Lot from {seller}: {n}. Starting at {s}!"];
  const BID_L = ["{b} bids {a}!", "{a} to {b} — anyone else?", "{b} says {a}! Do I hear more?", "Ooh, {a} from {b}!", "{a}! The clock resets — who's next?"];

  Arcade.register({
    id: "auction", name: "Squishy *Auction*", tagline: "Bid live on your friends' squishies.", accent: "#ffd36b",
    complexity: "med", controls: "click", scoreLabel: "Coins",
    create() {
      let ctx = null, stageEl = null, root = null, styleEl = null, unResize = null;
      let started = false, isHost = false, me = null, hostId = null, mode = "normal";
      let myLots = [];                     // [{u, id, start}] — MY listings (uids from my own Bazaar save)
      let view = null, clockOff = 0, lastLotId = null, lastEnds = 0, lastTickSec = -1, flashUntil = 0, stampT = null;
      let H = null;                        // host-only authoritative auction state
      let lobbyEl = null, lobbyPoll = null, collectT = null, listT = null, previewT = 0, previewIt = null;
      let now = 0, dpr = 1;
      const R = {}, thumbSrc = {};

      // ---- thumbs (offscreen cache per item+size, copied into fresh canvases so one item can appear in many places) ----
      function thumb(it, size) {
        const key = it.id + ":" + size; dpr = window.devicePixelRatio || 1;
        if (!thumbSrc[key]) { const c = document.createElement("canvas"); c.width = c.height = Math.round(size * dpr); const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); drawToy(g, size / 2, size / 2, size * 0.34, it, 0); thumbSrc[key] = c; }
        const c = document.createElement("canvas"); c.width = c.height = Math.round(size * dpr); c.style.width = c.style.height = size + "px"; c.getContext("2d").drawImage(thumbSrc[key], 0, 0); c.title = it.name + " · " + RAR[RI[it.rar]].label; return c;
      }
      function pill(it) { const r = RAR[RI[it.rar]]; const p = el("span", "auc-pill", r.label); p.style.color = r.col; p.style.borderColor = rgba(r.col, 0.5); p.style.background = rgba(r.col, 0.12); return p; }
      function fitCanvas(c) { const w = c.clientWidth; if (!w) return false; dpr = window.devicePixelRatio || 1; if (c.width !== Math.round(w * dpr)) { c.width = c.height = Math.round(w * dpr); } return true; }
      function drawBig(c, it, o) {
        if (!fitCanvas(c)) return; const g = c.getContext("2d"); const w = c.clientWidth; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, w);
        const rar = RAR[RI[it.rar]]; const gl = g.createRadialGradient(w / 2, w / 2, w * 0.05, w / 2, w / 2, w * 0.5); gl.addColorStop(0, rgba(rar.col, 0.16)); gl.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gl; g.fillRect(0, 0, w, w);
        const bob = Math.sin(now * 0.003) * w * 0.012; const sq = o && o.sq ? o.sq : 0;
        g.save(); g.translate(w / 2, w * 0.5 + bob); g.scale(1 + sq * 0.2, 1 - sq * 0.2); drawToy(g, 0, 0, w * 0.3, it, now); g.restore();
      }

      // ---- lots panel (shared by the lobby-side bottom sheet and the in-game listing phase) ----
      function renderLots(c) {
        if (!c) return; const s = bzGet(); c.innerHTML = "";
        c.appendChild(el("div", "auc-h", "My lots · " + myLots.length + "/" + MAX_LOTS + " · you have " + s.coins + " coins"));
        const list = el("div", "auc-lots");
        myLots.forEach(function (l) {
          const it = ITEM[l.id]; const row = el("div", "auc-lot"); row.appendChild(thumb(it, 44));
          const n = el("div", "n"); n.appendChild(document.createTextNode(it.name + " ")); n.appendChild(pill(it)); row.appendChild(n);
          const minus = el("button", "x", "−"); minus.title = "lower starting price"; minus.onclick = function () { l.start = Math.max(1, l.start - 5); ctx.audio.soft(); queueList(); renderAll(); };
          const inp = document.createElement("input"); inp.type = "number"; inp.min = "1"; inp.max = "99999"; inp.value = l.start; inp.setAttribute("aria-label", "starting price"); inp.oninput = function () { const v = parseInt(inp.value, 10); if (v > 0) { l.start = Math.min(99999, v); queueList(); } };
          const plus = el("button", "x", "+"); plus.title = "raise starting price"; plus.onclick = function () { l.start = Math.min(99999, l.start + 5); ctx.audio.soft(); queueList(); renderAll(); };
          const x = el("button", "x rm", "✕"); x.title = "take off the block"; x.onclick = function () { myLots = myLots.filter(function (q) { return q !== l; }); ctx.audio.soft(); queueList(); renderAll(); };
          row.appendChild(minus); row.appendChild(inp); row.appendChild(plus); row.appendChild(x); list.appendChild(row);
        });
        if (!myLots.length) list.appendChild(el("div", "auc-empty", s.inv.length ? "Tap a toy below to put it on the block (up to " + MAX_LOTS + "). Set a starting price with − / +." : "Play Squishy Bazaar first to get toys — you can still bid with your " + s.coins + " coins."));
        c.appendChild(list);
        const inv = el("div", "auc-inv");
        s.inv.filter(function (x) { return !x.lock && ITEM[x.id] && !myLots.some(function (l) { return l.u === x.u; }); }).forEach(function (x) {
          const b = el("button"); b.title = ITEM[x.id].name; b.disabled = myLots.length >= MAX_LOTS; b.appendChild(thumb(ITEM[x.id], 44));
          b.onclick = function () { if (myLots.length >= MAX_LOTS) return; myLots.push({ u: x.u, id: x.id, start: ITEM[x.id].base }); ctx.audio.pick(); queueList(); renderAll(); };
          inv.appendChild(b);
        });
        const locked = s.inv.filter(function (x) { return x.lock; }).length;
        if (locked) inv.appendChild(el("div", "auc-empty", locked + " locked toy" + (locked === 1 ? " stays" : "s stay") + " home"));
        c.appendChild(inv);
      }
      function renderAll() { if (lobbyEl) renderLots(lobbyEl.firstChild); if (started && view && view.phase === "listing") renderLots(R.listLots); }
      function queueList() { clearTimeout(listT); listT = setTimeout(sendList, 200); }
      function sendList() {
        clearTimeout(listT); listT = null; if (!Arcade.net.connected()) return;
        const s = bzGet(); myLots = myLots.filter(function (l) { return s.inv.some(function (x) { return x.u === l.u && !x.lock; }); });
        const msg = { k: "list", lots: myLots.map(function (l) { return { itemId: l.id, uid: l.u, start: l.start }; }), coins: s.coins, slots: INV_MAX - s.inv.length };
        const room = Arcade.net.room(); if (!room) return;
        if (Arcade.net.isHost()) hostList(Arcade.net.id(), msg); else Arcade.mpLobby.to(room.hostId, msg);
      }

      // ---- lobby phase: a bottom sheet under the Play Together card so players can list toys before the host starts ----
      function showLobbyLots() { if (lobbyEl) return; lobbyEl = el("div", "auc-lobbylots"); lobbyEl.appendChild(el("div", "in")); document.body.appendChild(lobbyEl); renderLots(lobbyEl.firstChild); sendList(); }
      function closeLobbyLots() { if (lobbyEl) { lobbyEl.remove(); lobbyEl = null; } }
      function startLobbyPoll() {
        stopLobbyPoll();
        lobbyPoll = setInterval(function () {
          if (started) { stopLobbyPoll(); return; }
          const open = !!document.querySelector(".mpl"), room = Arcade.net.room();
          if (!open) { stopLobbyPoll(); closeLobbyLots(); showTitle(""); return; }
          if (room) showLobbyLots(); else closeLobbyLots();
        }, 300);
      }
      function stopLobbyPoll() { clearInterval(lobbyPoll); lobbyPoll = null; }
      function openLobby() {
        Arcade.mpLobby.open({
          title: "Squishy Auction", minPlayers: 2,
          modes: [{ id: "normal", label: "Player lots only" }, { id: "mystery", label: "+ Mystery house lots" }],
          onStart: onStart, onPeer: onPeer,
          onLeave: function (why) { endGame(why === "disconnected" ? "Lost the connection — auction over." : "You left the auction."); }
        });
        Arcade.net.on("msg", onNet);      // registered AFTER open (mpLobby.open wipes net handlers); one handler for lobby + game
        startLobbyPoll();
      }

      // ---- network ----
      function onNet(m) {
        const d = m.d || {}; if (!d.k || String(d.k).slice(0, 2) === "__") return;
        if (d.k === "list") { if (Arcade.net.isHost()) hostList(m.from, d); return; }
        if (d.k === "bid") { if (Arcade.net.isHost()) hostBid(m.from, d.amount); return; }
        if (!started || (hostId && m.from !== hostId)) return;      // only the host is trusted for the rest
        if (d.k === "state") applyState(d); else if (d.k === "sold") applySold(d); else if (d.k === "unsold") applyUnsold(d);
      }
      function onStart(info) {
        started = true; isHost = info.isHost; me = info.me; mode = info.mode || "normal";
        const room = Arcade.net.room(); hostId = (info.room && info.room.hostId) || (room && room.hostId);
        stopLobbyPoll(); closeLobbyLots(); view = null; lastLotId = null; lastEnds = 0;
        R.title.style.display = "none"; R.game.style.display = "";
        R.main.style.display = ""; R.listing.style.display = "none"; R.summary.style.display = "none";
        R.name.textContent = "Collecting lots…"; R.line.textContent = "";
        sendList();
        if (isHost) hostStart();
      }
      function onPeer(q, what) {
        if (!started) return;
        if (what === "join") { if (isHost) { Arcade.mpLobby.to(q.id, { k: "__start", mode: mode }); if (H) bcast(); } return; }
        if (q.id === hostId && !isHost) { endGame("The host left — auction over."); return; }
        if (isHost && H) {
          delete H.lots[q.id]; H.queue = H.queue.filter(function (l) { return l.sellerId !== q.id; }); H.total = H.results.length + H.queue.length + (H.cur ? 1 : 0);
          if (H.cur && H.phase === "lot") {
            if (H.cur.sellerId === q.id) { H.results.push({ lotId: H.cur.lotId, itemId: H.cur.itemId, sellerName: H.cur.sellerName, sold: false }); H.line = q.name + " left — lot withdrawn."; H.cur.result = "unsold"; H.phase = "between"; H.endsAt = Date.now() + BETWEEN_MS; H.dur = BETWEEN_MS; Arcade.mpLobby.send({ k: "unsold", lotId: H.cur.lotId, itemId: H.cur.itemId }); applyUnsold({}); }
            else if (H.cur.bidderId === q.id) { H.cur.bid = null; H.cur.bidderId = null; H.cur.bidderName = null; H.cur.once = H.cur.twice = false; H.endsAt = Date.now() + BID_MS; H.dur = BID_MS; H.line = q.name + " left — bidding reopens!"; }
          }
          bcast();
        }
      }
      function endGame(msg) {
        started = false; isHost = false; H = null; view = null; clearTimeout(collectT); collectT = null; myLots = [];
        stopLobbyPoll(); closeLobbyLots(); try { Arcade.mpLobby.close(); } catch (e) {}
        showTitle(msg);
      }

      // ---- HOST: authoritative auction ----
      function ensureH() { if (!H) H = { phase: "idle", lots: {}, balances: {}, slots: {}, queue: [], cur: null, results: [], ticker: [], line: "", endsAt: 0, dur: 1, lastB: 0, seq: 1, total: 0 }; return H; }
      function roomPlayers() { const r = Arcade.net.room(); return (r && r.players) || Arcade.mpLobby.players() || []; }
      function nameOf(id) { const p = roomPlayers().find(function (q) { return q.id === id; }); return p ? p.name : "Someone"; }
      function playerLotCount() { const ids = roomPlayers().map(function (p) { return p.id; }); return ids.reduce(function (n, id) { return n + (H.lots[id] || []).length; }, 0); }
      function hostList(from, d) {
        ensureH();
        const lots = (Array.isArray(d.lots) ? d.lots : []).slice(0, MAX_LOTS).filter(function (l) { return l && ITEM[l.itemId] && l.uid != null; }).map(function (l) { return { itemId: String(l.itemId), uid: l.uid, start: clampInt(l.start, 1, 99999, ITEM[l.itemId].base) }; });
        H.lots[from] = lots;
        if (typeof d.coins === "number" && isFinite(d.coins)) H.balances[from] = Math.max(0, Math.floor(d.coins));
        if (typeof d.slots === "number" && isFinite(d.slots)) H.slots[from] = Math.floor(d.slots);
        if (H.phase === "listing") bcast();
      }
      function hostStart() {
        ensureH(); H.phase = "collect"; H.results = []; H.queue = []; H.cur = null; H.ticker = []; H.line = ""; bcast();
        clearTimeout(collectT);
        collectT = setTimeout(function () { collectT = null; if (!H || !started) return; if (playerLotCount() > 0) hostBegin(); else { H.phase = "listing"; bcast(); } }, COLLECT_MS);
      }
      function mysteryItem() {
        const pool = ITEMS.filter(function (it) { return RI[it.rar] <= RI.rare; }); let tot = 0; pool.forEach(function (it) { tot += RAR[RI[it.rar]].w; });
        let r = Math.random() * tot; for (let i = 0; i < pool.length; i++) { r -= RAR[RI[pool[i].rar]].w; if (r <= 0) return pool[i]; } return pool[pool.length - 1];
      }
      function hostBegin() {
        if (!H) return; const q = [];
        roomPlayers().forEach(function (p) { (H.lots[p.id] || []).forEach(function (l) { q.push({ lotId: "L" + (H.seq++), itemId: l.itemId, uid: l.uid, sellerId: p.id, sellerName: p.name, start: l.start, bid: null, bidderId: null, bidderName: null }); }); });
        if (mode === "mystery") for (let i = 0; i < MYSTERY_N; i++) { const it = mysteryItem(); q.push({ lotId: "L" + (H.seq++), itemId: it.id, uid: null, sellerId: HOUSE, sellerName: "the House", start: Math.max(1, Math.round(it.base * 0.6)), bid: null, bidderId: null, bidderName: null }); }
        if (!q.length) { H.phase = "listing"; bcast(); return; }
        shuffle(q); H.queue = q; H.total = q.length; H.results = []; H.ticker = []; H.lots = {};
        hostNext();
      }
      function hostNext() {
        if (!H) return;
        if (!H.queue.length) { H.phase = "summary"; H.cur = null; H.line = "That's the lot! Thanks for playing."; bcast(); return; }
        H.cur = H.queue.shift(); H.phase = "lot"; H.endsAt = Date.now() + LOT_MS; H.dur = LOT_MS;
        H.line = fill(pick(OPEN_L), { n: ITEM[H.cur.itemId].name, s: H.cur.start, seller: H.cur.sellerName });
        H.ticker.unshift("🏷 " + ITEM[H.cur.itemId].name + " from " + H.cur.sellerName + " · opens at " + H.cur.start); H.ticker.length = Math.min(H.ticker.length, 8);
        bcast();
      }
      function hostBid(from, amount) {
        if (!H || H.phase !== "lot" || !H.cur) return; const L = H.cur; amount = Math.floor(+amount); if (!isFinite(amount) || amount <= 0) return;
        if (from === L.sellerId) return;
        const min = L.bid != null ? L.bid + 1 : L.start; if (amount < min) return;
        if ((H.balances[from] || 0) < amount) return;
        if (H.slots[from] != null && H.slots[from] <= 0) return;
        L.bid = amount; L.bidderId = from; L.bidderName = nameOf(from); L.once = L.twice = false;
        H.endsAt = Date.now() + BID_MS; H.dur = BID_MS;
        H.line = fill(pick(BID_L), { b: L.bidderName, a: amount });
        H.ticker.unshift(L.bidderName + " bid " + amount); H.ticker.length = Math.min(H.ticker.length, 8);
        bcast();
      }
      function hostCloseLot() {
        const L = H.cur;
        if (L.bid != null) {
          const d = { k: "sold", lotId: L.lotId, winnerId: L.bidderId, winnerName: L.bidderName, price: L.bid, sellerId: L.sellerId, sellerName: L.sellerName, itemId: L.itemId, uid: L.uid };
          H.balances[L.bidderId] = Math.max(0, (H.balances[L.bidderId] || 0) - L.bid); if (H.slots[L.bidderId] != null) H.slots[L.bidderId]--;
          if (L.sellerId !== HOUSE) { H.balances[L.sellerId] = (H.balances[L.sellerId] || 0) + L.bid; if (H.slots[L.sellerId] != null) H.slots[L.sellerId]++; }
          H.results.push({ lotId: L.lotId, itemId: L.itemId, sellerName: L.sellerName, sold: true, winnerName: L.bidderName, winnerId: L.bidderId, price: L.bid });
          H.line = "SOLD to " + L.bidderName + " for " + L.bid + "!"; H.ticker.unshift("🔨 SOLD — " + ITEM[L.itemId].name + " → " + L.bidderName + " for " + L.bid); L.result = "sold";
          Arcade.mpLobby.send(d); applySold(d);
        } else {
          H.results.push({ lotId: L.lotId, itemId: L.itemId, sellerName: L.sellerName, sold: false });
          H.line = L.sellerId === HOUSE ? "No takers — the House keeps it." : "No takers — " + ITEM[L.itemId].name + " goes back to " + L.sellerName + "."; H.ticker.unshift("— no bids on " + ITEM[L.itemId].name); L.result = "unsold";
          Arcade.mpLobby.send({ k: "unsold", lotId: L.lotId, itemId: L.itemId }); applyUnsold({});
        }
        H.ticker.length = Math.min(H.ticker.length, 8);
        H.phase = "between"; H.endsAt = Date.now() + BETWEEN_MS; H.dur = BETWEEN_MS; bcast();
      }
      function hostAnother() { if (!H || !isHost) return; H.lots = {}; H.queue = []; H.cur = null; H.results = []; H.ticker = []; H.line = ""; H.total = 0; H.phase = "listing"; bcast(); }
      function hostTick() {
        if (!H || !started) return; const t = Date.now();
        if (H.phase === "lot" && H.cur) {
          const rem = H.endsAt - t;
          if (H.cur.bid != null) { if (rem <= 1500 && !H.cur.twice) { H.cur.twice = true; H.line = "Going twice…"; bcast(); } else if (rem <= 3000 && !H.cur.once) { H.cur.once = true; H.line = "Going once…"; bcast(); } }
          if (rem <= 0) { hostCloseLot(); return; }
        } else if (H.phase === "between") { if (t >= H.endsAt) { hostNext(); return; } }
        if (t - H.lastB >= STATE_EVERY) bcast();
      }
      function hostSnapshot() {
        const players = roomPlayers().map(function (p) { return { id: p.id, name: p.name, coins: H.balances[p.id] != null ? H.balances[p.id] : null, lots: (H.lots[p.id] || []).length }; });
        const L = H.cur;
        return { k: "state", phase: H.phase, mode: mode, hostNow: Date.now(), endsAt: H.endsAt, dur: H.dur,
          lot: L ? { lotId: L.lotId, itemId: L.itemId, sellerId: L.sellerId, sellerName: L.sellerName, start: L.start, bid: L.bid, bidderId: L.bidderId, bidderName: L.bidderName, result: L.result || null } : null,
          queue: H.queue.slice(0, 12).map(function (l) { return { lotId: l.lotId, itemId: l.itemId, sellerName: l.sellerName }; }), qlen: H.queue.length, done: H.results.length, total: H.total,
          players: players, ticker: H.ticker.slice(0, 8), line: H.line, results: H.phase === "summary" ? H.results : undefined,
          canBegin: H.phase === "listing" ? (playerLotCount() > 0 || mode === "mystery") : false, nlots: H.phase === "listing" ? playerLotCount() : 0 };
      }
      function bcast() { if (!H) return; const s = hostSnapshot(); H.lastB = Date.now(); Arcade.mpLobby.send(s); applyState(s); }

      // ---- CLIENT: apply what the host says ----
      function myCoins() { if (view && me) { const p = view.players.find(function (q) { return q.id === me.id; }); if (p && p.coins != null) return p.coins; } return bzGet().coins; }
      function bidAmount(step) { const L = view && view.lot; if (!L) return 0; return (L.bid != null ? L.bid : L.start - 10) + step; }
      function bidBlock(step) {
        if (!view || view.phase !== "lot" || !view.lot) return "…";
        const L = view.lot; if (me && L.sellerId === me.id) return "This is your lot — sit tight.";
        const s = bzGet(); if (s.inv.length >= INV_MAX) return "Your collection is full (" + INV_MAX + ").";
        if (bidAmount(step) > myCoins()) return "Not enough coins for that.";
        return "";
      }
      function bidStep(step) {
        if (bidBlock(step)) { ctx.audio.soft(); return; } const amt = bidAmount(step);
        ctx.audio.pick();
        if (isHost) hostBid(me.id, amt); else Arcade.mpLobby.to(hostId, { k: "bid", amount: amt });
      }
      function applySold(d) {
        const s = bzGet(); let changed = false;
        if (me && d.winnerId === me.id) { s.inv.push({ u: s.nextUid++, id: d.itemId, lock: false, t: Date.now() }); s.seen[d.itemId] = 1; s.coins = Math.max(0, s.coins - d.price); if (s.stats) s.stats.bought = (s.stats.bought || 0) + 1; changed = true; ctx.audio.arp([523, 659, 784, 1046], { dur: 0.16, step: 0.08, vol: 0.12, type: "triangle" }); }
        if (me && d.sellerId === me.id) { const i = s.inv.findIndex(function (x) { return x.u === d.uid; }); if (i >= 0) s.inv.splice(i, 1); s.coins += d.price; if (s.stats) s.stats.sold = (s.stats.sold || 0) + 1; myLots = myLots.filter(function (l) { return l.u !== d.uid; }); changed = true; }
        if (changed) { bzSet(s); ctx.setScore(s.coins); }
        gavel(); stamp("SOLD", false);
      }
      function applyUnsold() { ctx.audio.tone(220, 0.16, { type: "triangle", vol: 0.07, glide: 150 }); stamp("NO SALE", true); }
      function gavel() { ctx.audio.thunk(); ctx.audio.tone(80, 0.2, { type: "triangle", vol: 0.18, glide: 45 }); }
      function stamp(txt, muted) { R.stamp.textContent = txt; R.stamp.className = "auc-stamp on" + (muted ? " no" : ""); }
      function applyState(st) {
        if (!started) return;
        const prev = view ? view.phase : null; view = st; clockOff = Date.now() - st.hostNow;
        const ph = st.phase;
        R.main.style.display = (ph === "lot" || ph === "between" || ph === "collect") ? "" : "none";
        R.listing.style.display = ph === "listing" ? "" : "none";
        R.summary.style.display = ph === "summary" ? "" : "none";
        renderPlayers(st);
        if (ph === "listing") { if (prev !== "listing") { renderLots(R.listLots); if (prev === "summary") sendList(); } renderListFoot(st); }
        if (ph === "summary" && prev !== "summary") { myLots = []; renderSummary(st); }
        if ((ph === "lot" || ph === "between") && st.lot) {
          const L = st.lot, it = ITEM[L.itemId];
          if (L.lotId !== lastLotId) { lastLotId = L.lotId; lastEnds = 0; R.stamp.className = "auc-stamp"; lastTickSec = -1; ctx.audio.tone(660, 0.12, { type: "sine", vol: 0.07, glide: 880 }); flashUntil = now + 350; }
          if (ph === "lot" && st.endsAt !== lastEnds) { if (lastEnds) flashUntil = now + 380; lastEnds = st.endsAt; }
          R.name.textContent = it.name; R.pillWrap.innerHTML = ""; R.pillWrap.appendChild(pill(it));
          R.seller.textContent = (L.sellerId === HOUSE ? "🏛 Mystery lot from the House" : "Seller: " + L.sellerName + (me && L.sellerId === me.id ? " (you)" : "")) + " · lot " + (st.done + 1) + " of " + st.total;
          R.bid.innerHTML = ""; R.bid.appendChild(document.createTextNode(L.bid != null ? String(L.bid) : String(L.start)));
          R.bid.appendChild(el("small", null, L.bid != null ? "top bid — " + L.bidderName + (me && L.bidderId === me.id ? " (you)" : "") : "starting price · no bids yet"));
          R.b.forEach(function (b, i) { const step = [10, 50, 100][i]; b.innerHTML = ""; b.appendChild(document.createTextNode("+" + step)); b.appendChild(el("small", null, "→ " + bidAmount(step))); b.disabled = ph !== "lot" || !!bidBlock(step); });
          R.note.textContent = ph === "lot" ? bidBlock(10) : "";
          if (ph === "between" && L.result) stamp(L.result === "sold" ? "SOLD" : "NO SALE", L.result !== "sold");
        } else if (ph === "collect") { R.name.textContent = "Collecting lots…"; R.pillWrap.innerHTML = ""; R.seller.textContent = ""; R.bid.textContent = ""; R.note.textContent = ""; R.b.forEach(function (b) { b.disabled = true; }); R.timerI.style.width = "0%"; }
        R.line.textContent = st.line || "";
        renderTicker(st.ticker || []); renderQueue(st);
      }
      function renderPlayers(st) {
        R.top.innerHTML = "";
        const lead = st.lot && st.lot.bidderId;
        (st.players || []).forEach(function (p) {
          const c = el("div", "auc-pl" + (me && p.id === me.id ? " me" : "") + (p.id === hostId ? " host" : "") + (p.id === lead ? " lead" : ""));
          c.appendChild(document.createTextNode(p.name + (p.id === hostId ? " ★" : "") + (me && p.id === me.id ? " (you)" : "")));
          c.appendChild(el("b", null, p.coins == null ? "…" : p.coins + " ¢"));
          if (st.phase === "listing") c.appendChild(el("i", null, p.lots + " lot" + (p.lots === 1 ? "" : "s")));
          R.top.appendChild(c);
        });
      }
      let tickerSig = "", queueSig = "";
      function renderTicker(t) { const sig = t.join("|"); if (sig === tickerSig) return; tickerSig = sig; R.ticker.innerHTML = ""; if (!t.length) R.ticker.appendChild(el("div", "auc-empty", "bids show up here")); t.forEach(function (s) { R.ticker.appendChild(el("div", null, s)); }); }
      function renderQueue(st) {
        const q = st.queue || []; const sig = q.map(function (l) { return l.lotId; }).join("|") + "/" + st.qlen; if (sig === queueSig) return; queueSig = sig;
        R.qh.textContent = "Up next · " + (st.qlen || 0) + " lot" + (st.qlen === 1 ? "" : "s") + " left"; R.queue.innerHTML = "";
        if (!q.length) R.queue.appendChild(el("div", "auc-empty", "this is the last lot"));
        q.forEach(function (l) { const it = ITEM[l.itemId]; const c = el("div", "auc-q"); c.appendChild(thumb(it, 44)); c.appendChild(el("span", null, it.name)); c.appendChild(el("span", "s", l.sellerName)); R.queue.appendChild(c); });
      }
      function renderListFoot(st) {
        R.listFoot.innerHTML = "";
        R.listFoot.appendChild(el("div", "auc-wait", (st.nlots || 0) + " player lot" + (st.nlots === 1 ? "" : "s") + " on the block" + (st.mode === "mystery" ? " + " + MYSTERY_N + " mystery lots" : "")));
        if (isHost) { const b = el("button", "btn", "Begin auction"); b.disabled = !st.canBegin; b.onclick = function () { if (H) hostBegin(); }; R.listFoot.appendChild(b); }
        else R.listFoot.appendChild(el("div", "auc-wait", "waiting for the host to begin…"));
      }
      function renderSummary(st) {
        R.summary.innerHTML = ""; const res = st.results || []; const sold = res.filter(function (r) { return r.sold; }); const big = sold.slice().sort(function (a, b) { return b.price - a.price; })[0];
        R.summary.appendChild(el("div", "auc-h", "Round over"));
        R.summary.appendChild(el("div", "auc-sumhead", sold.length + " sold · " + (res.length - sold.length) + " unsold" + (big ? " · biggest sale: " + ITEM[big.itemId].name + " → " + big.winnerName + " for " + big.price : "")));
        const list = el("div", "auc-sum");
        res.forEach(function (r) { const it = ITEM[r.itemId]; if (!it) return; const row = el("div", "r"); row.appendChild(thumb(it, 36)); row.appendChild(el("div", "n", it.name + " · from " + r.sellerName)); row.appendChild(el("b", null, r.sold ? "SOLD to " + r.winnerName + " · " + r.price : "unsold")); list.appendChild(row); });
        if (!res.length) list.appendChild(el("div", "auc-empty", "nothing went on the block"));
        R.summary.appendChild(list);
        const foot = el("div", "auc-foot");
        if (isHost) { const again = el("button", "btn", "Another round"); again.onclick = hostAnother; foot.appendChild(again); }
        else foot.appendChild(el("div", "auc-wait", "waiting for the host to start another round…"));
        R.summary.appendChild(foot);
      }

      // ---- screens ----
      function showTitle(msg) {
        R.game.style.display = "none"; R.title.style.display = "";
        const s = bzPeek();
        R.tinfo.textContent = s && Array.isArray(s.inv) ? "You have " + (s.coins | 0) + " coins and " + s.inv.length + " toy" + (s.inv.length === 1 ? "" : "s") + " in your Bazaar." : "Play Squishy Bazaar first to get toys — you can still bid with 150 starter coins.";
        R.tmsg.textContent = msg || "";
        ctx.setScore(s ? (s.coins | 0) : 150);
      }
      function buildDom() {
        root = el("div", "auc");
        // title
        R.title = el("div", "auc-title");
        const h = el("h2"); h.appendChild(document.createTextNode("Squishy ")); h.appendChild(el("b", null, "Auction")); R.title.appendChild(h);
        R.pcanvas = document.createElement("canvas"); R.pcanvas.className = "auc-canvas small"; R.title.appendChild(R.pcanvas);
        R.title.appendChild(el("p", null, "A live auction house for your Squishy Bazaar toys. Put up to 3 squishies on the block with a starting price, then fight over your friends' lots with +10 / +50 / +100 bids. Every lot runs 12 s; each bid resets the clock to 6 s. When the gavel drops, the toy and the coins move for real — straight into your Bazaar."));
        R.tinfo = el("div", "auc-tinfo");
        const play = el("button", "btn", "👥 Play Together"); play.onclick = function () { ctx.audio.start && ctx.audio.start(); openLobby(); };
        R.tmsg = el("div", "auc-tmsg");
        R.title.appendChild(R.tinfo); R.title.appendChild(play); R.title.appendChild(R.tmsg);
        R.title.appendChild(el("div", "hint", "2–6 players · the host toggles Mystery house lots in the lobby"));
        root.appendChild(R.title);
        // game
        R.game = el("div", "auc-game"); R.game.style.display = "none";
        R.top = el("div", "auc-top");
        R.main = el("div", "auc-main");
        R.stage = el("div", "auc-stage");
        R.stamp = el("div", "auc-stamp", "SOLD");
        R.canvas = document.createElement("canvas"); R.canvas.className = "auc-canvas";
        R.name = el("div", "auc-name"); R.pillWrap = el("div", "auc-pillwrap"); R.seller = el("div", "auc-seller");
        R.bid = el("div", "auc-bid"); R.timer = el("div", "auc-timer"); R.timerI = el("i"); R.timer.appendChild(R.timerI);
        R.line = el("div", "auc-line");
        R.btns = el("div", "auc-btns"); R.b = [10, 50, 100].map(function (step) { const b = el("button"); b.textContent = "+" + step; b.disabled = true; b.onclick = function () { bidStep(step); }; R.btns.appendChild(b); return b; });
        R.note = el("div", "auc-note");
        [R.stamp, R.canvas, R.name, R.pillWrap, R.seller, R.bid, R.timer, R.line, R.btns, R.note].forEach(function (e) { R.stage.appendChild(e); });
        R.side = el("div", "auc-side");
        const tb = el("div", "auc-box"); tb.appendChild(el("div", "auc-h", "Live bids")); R.ticker = el("div", "auc-ticker"); tb.appendChild(R.ticker);
        const qb = el("div", "auc-box"); R.qh = el("div", "auc-h", "Up next"); qb.appendChild(R.qh); R.queue = el("div", "auc-queue"); qb.appendChild(R.queue);
        R.side.appendChild(tb); R.side.appendChild(qb);
        R.main.appendChild(R.stage); R.main.appendChild(R.side);
        R.listing = el("div", "auc-box auc-listing"); R.listLots = el("div"); R.listFoot = el("div", "auc-foot"); R.listing.appendChild(R.listLots); R.listing.appendChild(R.listFoot); R.listing.style.display = "none";
        R.summary = el("div", "auc-box auc-summary"); R.summary.style.display = "none";
        R.foot = el("div", "auc-foot"); const lv = el("button", "btn ghost", "Leave auction"); lv.onclick = function () { Arcade.mpLobby.leave(); }; R.foot.appendChild(lv);
        [R.top, R.main, R.listing, R.summary, R.foot].forEach(function (e) { R.game.appendChild(e); });
        root.appendChild(R.game);
        stageEl.appendChild(root);
      }
      const CSS =
        ".auc{width:min(96vw,1000px);max-height:100%;overflow:auto;display:flex;flex-direction:column;gap:12px;padding:2px 4px}" +
        ".auc-title{text-align:center;padding:12px 16px 24px;display:flex;flex-direction:column;align-items:center;gap:10px}" +
        ".auc-title h2{margin:0;font-size:clamp(28px,5vw,42px);letter-spacing:-.01em}.auc-title h2 b{color:var(--accent);text-shadow:0 0 22px color-mix(in srgb,var(--accent) 50%,transparent)}" +
        ".auc-title p{margin:0;opacity:.75;max-width:560px;line-height:1.5;font-size:15px}.auc-tinfo{font-size:14px;opacity:.85}.auc-tmsg{min-height:1.2em;color:var(--accent);font-size:14px}" +
        ".auc-title .btn{margin-top:6px;min-height:52px}.auc-title .hint{position:static;margin-top:6px}" +
        ".auc-canvas{width:min(100%,280px);aspect-ratio:1;display:block}.auc-canvas.small{width:min(60vw,180px)}" +
        ".auc-top{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}" +
        ".auc-pl{display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);font-size:14px;min-height:40px}" +
        ".auc-pl b{font-variant-numeric:tabular-nums;color:var(--accent)}.auc-pl i{font-style:normal;opacity:.6;font-size:12px}" +
        ".auc-pl.me{background:color-mix(in srgb,var(--accent) 14%,transparent)}.auc-pl.host{border-color:rgba(255,211,107,.6)}.auc-pl.lead{box-shadow:0 0 16px color-mix(in srgb,var(--accent) 45%,transparent);border-color:var(--accent)}" +
        ".auc-main{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:14px;align-items:start}" +
        ".auc-stage{position:relative;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:22px;padding:16px;display:flex;flex-direction:column;align-items:center;gap:8px;box-shadow:0 0 40px color-mix(in srgb,var(--accent) 10%,transparent)}" +
        ".auc-name{font-size:22px;font-weight:800;text-align:center;line-height:1.15}.auc-pillwrap{min-height:22px}" +
        ".auc-pill{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;border:1px solid}" +
        ".auc-seller{opacity:.7;font-size:14px;text-align:center}" +
        ".auc-bid{font-size:36px;font-weight:800;color:var(--accent);font-variant-numeric:tabular-nums;line-height:1;text-align:center;text-shadow:0 0 18px color-mix(in srgb,var(--accent) 45%,transparent);min-height:52px}" +
        ".auc-bid small{display:block;font-size:13px;opacity:.75;font-weight:600;margin-top:5px;color:var(--text,#e6ecf5);text-shadow:none}" +
        ".auc-timer{width:100%;height:12px;border-radius:7px;background:rgba(255,255,255,.08);overflow:hidden}.auc-timer i{display:block;height:100%;width:0;background:var(--accent);border-radius:7px;box-shadow:0 0 12px color-mix(in srgb,var(--accent) 60%,transparent)}" +
        ".auc-timer.flash i{background:#fff;box-shadow:0 0 18px #fff}.auc-timer.hot i{background:#ff9fb0;box-shadow:0 0 14px rgba(255,159,176,.7)}" +
        ".auc-line{min-height:1.5em;font-style:italic;opacity:.9;text-align:center;font-size:15px}" +
        ".auc-btns{display:flex;gap:10px;width:100%;justify-content:center;flex-wrap:wrap}" +
        ".auc-btns button{flex:1 1 96px;min-height:60px;border-radius:16px;border:1px solid color-mix(in srgb,var(--accent) 55%,transparent);background:color-mix(in srgb,var(--accent) 16%,transparent);color:var(--text,#e6ecf5);font:inherit;font-weight:800;font-size:22px;cursor:pointer;line-height:1.1;transition:transform 80ms}" +
        ".auc-btns button small{display:block;font-size:12px;opacity:.7;font-weight:600;font-variant-numeric:tabular-nums}" +
        ".auc-btns button:disabled{opacity:.3;cursor:default}.auc-btns button:not(:disabled):hover{transform:scale(1.03)}.auc-btns button:not(:disabled):active{transform:scale(.97)}" +
        ".auc-note{font-size:13px;opacity:.65;min-height:1.2em;text-align:center}" +
        ".auc-side{display:flex;flex-direction:column;gap:12px;min-width:0}" +
        ".auc-box{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:12px 14px}" +
        ".auc-h{font-size:12px;letter-spacing:.1em;text-transform:uppercase;opacity:.6;margin-bottom:8px;font-weight:700}" +
        ".auc-ticker{display:flex;flex-direction:column;gap:5px;font-size:14px;min-height:5.5em}.auc-ticker div{opacity:.75;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.auc-ticker div:first-child{opacity:1;color:var(--accent);font-weight:700}" +
        ".auc-queue{display:flex;flex-wrap:wrap;gap:8px}.auc-q{display:flex;flex-direction:column;align-items:center;width:66px;font-size:11px;opacity:.85;text-align:center;gap:2px}.auc-q canvas{display:block}.auc-q span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%}.auc-q span.s{opacity:.55}" +
        ".auc-stamp{position:absolute;top:22px;left:50%;transform:translateX(-50%) rotate(-8deg) scale(1.4);font-size:42px;font-weight:900;color:#ffd36b;text-shadow:0 0 20px rgba(255,211,107,.6);border:4px solid #ffd36b;border-radius:12px;padding:2px 16px;opacity:0;pointer-events:none;transition:opacity .15s,transform .18s;z-index:2;letter-spacing:.04em}" +
        ".auc-stamp.on{opacity:1;transform:translateX(-50%) rotate(-8deg) scale(1)}.auc-stamp.no{color:#a9b4c4;border-color:#a9b4c4;text-shadow:none}" +
        ".auc-lots{display:flex;flex-direction:column;gap:8px;margin-bottom:10px}" +
        ".auc-lot{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:12px;background:rgba(255,255,255,.05)}.auc-lot .n{flex:1;font-size:14px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
        ".auc-lot input{width:74px;min-height:44px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.25);color:inherit;font:inherit;font-size:16px;text-align:center;-moz-appearance:textfield}.auc-lot input::-webkit-inner-spin-button{-webkit-appearance:none}" +
        ".auc-lot .x{min-width:44px;min-height:44px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:inherit;cursor:pointer;font:inherit;font-size:18px}.auc-lot .x.rm{color:#ff9fb0}" +
        ".auc-inv{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.auc-inv button{width:56px;height:56px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);padding:0;cursor:pointer;display:flex;align-items:center;justify-content:center}.auc-inv button:disabled{opacity:.35;cursor:default}.auc-inv button:not(:disabled):hover{border-color:var(--accent)}.auc-inv canvas{display:block}" +
        ".auc-empty{opacity:.6;font-size:13px}" +
        ".auc-lobbylots{position:fixed;left:0;right:0;bottom:0;z-index:61;background:#14112a;border-top:1px solid rgba(255,211,107,.35);box-shadow:0 -10px 50px rgba(0,0,0,.5);padding:12px 16px calc(12px + env(safe-area-inset-bottom));max-height:40vh;overflow:auto;color:#e6ecf5}" +
        ".auc-lobbylots .in{width:min(760px,100%);margin:0 auto;display:flex;flex-direction:column;gap:4px}" +
        "body.auc-live .mpl{align-items:flex-start;padding-top:2vh;padding-bottom:42vh}" +
        ".auc-sumhead{font-size:15px;margin-bottom:8px}.auc-sum{display:flex;flex-direction:column;gap:4px}.auc-sum .r{display:flex;align-items:center;gap:10px;font-size:14px;padding:3px 0}.auc-sum .r .n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.auc-sum .r b{color:var(--accent);white-space:nowrap}" +
        ".auc-foot{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;align-items:center;margin-top:8px}.auc-foot .btn{margin-top:0;min-height:48px}.auc-wait{opacity:.7;font-size:14px}" +
        "@media (max-width:900px){.auc-main{grid-template-columns:1fr}.auc-canvas{width:min(100%,210px)}.auc-bid{font-size:30px}.auc-name{font-size:19px}.auc-stamp{font-size:32px}.auc-lobbylots{max-height:46vh}body.auc-live .mpl{padding-bottom:48vh}}";

      return {
        mount(stage, c) {
          stageEl = stage; ctx = c; now = 0; dpr = window.devicePixelRatio || 1;
          styleEl = document.createElement("style"); styleEl.textContent = CSS; document.head.appendChild(styleEl);
          document.body.classList.add("auc-live");
          buildDom(); showTitle("");
          unResize = Arcade.board.onResize(function () { if (view && view.lot) drawBig(R.canvas, ITEM[view.lot.itemId]); });
          Arcade._auction = {
            get: function () { const s = bzPeek(); return { started: started, isHost: isHost, me: me, hostId: hostId, mode: mode, phase: view ? view.phase : null, view: view, myLots: myLots, H: H, coins: s ? s.coins : null, inv: s ? s.inv.map(function (x) { return x.id; }) : null, invRaw: s ? s.inv : null }; },
            fast: function (ms) { ms = ms || 1500; LOT_MS = ms; BID_MS = ms; BETWEEN_MS = Math.min(BETWEEN_MS, 900); COLLECT_MS = 300; }
          };
        },
        handleInput() {},
        tick(dt) {
          now += dt;
          if (isHost && H) hostTick();
          if (!started) {
            if (now - previewT > 2600 || !previewIt) { previewT = now; const s = bzPeek(); const own = s && Array.isArray(s.inv) ? s.inv.filter(function (x) { return ITEM[x.id]; }) : []; previewIt = own.length ? ITEM[pick(own).id] : pick(ITEMS.filter(function (it) { return RI[it.rar] >= 2; })); }
            drawBig(R.pcanvas, previewIt); return;
          }
          if (!view || !view.lot || (view.phase !== "lot" && view.phase !== "between")) return;
          const L = view.lot, it = ITEM[L.itemId];
          if (view.phase === "lot") {
            const rem = Math.max(0, view.endsAt + clockOff - Date.now()), f = Math.min(1, rem / Math.max(1, view.dur));
            R.timerI.style.width = (f * 100).toFixed(1) + "%";
            R.timer.classList.toggle("flash", now < flashUntil); R.timer.classList.toggle("hot", rem <= 3000 && L.bid != null);
            const sec = Math.ceil(rem / 1000); if (rem > 0 && rem <= 3000 && sec !== lastTickSec) { lastTickSec = sec; ctx.audio.tick(); }
            drawBig(R.canvas, it, { sq: now < flashUntil ? 0.12 : 0 });
          } else { R.timerI.style.width = "0%"; R.timer.classList.remove("hot", "flash"); drawBig(R.canvas, it, { sq: L.result === "sold" ? 0.25 : 0 }); }
        },
        getScore() { const s = bzPeek(); return s ? (s.coins | 0) : 0; },
        teardown() {
          stopLobbyPoll(); clearTimeout(collectT); clearTimeout(listT); clearTimeout(stampT); collectT = listT = null;
          closeLobbyLots();
          try { Arcade.mpLobby.close(); } catch (e) {}
          try { Arcade.net.disconnect(); } catch (e) {}
          if (unResize) unResize(); unResize = null;
          if (styleEl) styleEl.remove(); styleEl = null;
          document.body.classList.remove("auc-live");
          if (root) root.remove(); root = null;
          started = false; isHost = false; H = null; view = null; me = null; hostId = null; myLots = [];
          delete Arcade._auction;
          stageEl = ctx = null;
        }
      };
    }
  });
})();
