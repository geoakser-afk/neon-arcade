/* Frog Quest — story mode. You are Pip, a small meadow frog, hopping across five biomes to
   take down King Grumbold, the Frog King who taxes the peasants' flies. Left-click hops,
   right-click strikes with your tongue. Eat prey and defeat enemies for gems + biome tokens
   (star, triangle, diamond, hexagon, crown); tokens open the gate to the next biome. Camps
   have a Weaponsmith (tongue upgrades), Armorsmith (skins, hearts, shields) and Shopkeeper
   (potions). Hearts + stamina, water sections with alligators, a boss fight at the castle,
   a skippable intro cutscene, and a save in ctx.storage. The kids "Frog" game is untouched. */
(function () {
  const TAU = Math.PI * 2;
  const BW = 3.0, BH = 2.4;                 // each biome is BW × BH canvases; 5 biomes side by side
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
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, k) { return a + (b - a) * k; }

  function eyes(g, x, y, r, dx, blink, angry) {
    [-1, 1].forEach(function (d) {
      const ex = x + d * dx;
      g.fillStyle = "#fff"; dot(g, ex, y, r);
      if (blink) { g.strokeStyle = "#2a2434"; g.lineWidth = r * 0.35; g.lineCap = "round"; g.beginPath(); g.moveTo(ex - r * 0.6, y); g.lineTo(ex + r * 0.6, y); g.stroke(); }
      else { g.fillStyle = "#2a2434"; dot(g, ex, y + r * 0.1, r * 0.5); g.fillStyle = "#fff"; dot(g, ex - r * 0.15, y - r * 0.15, r * 0.16); }
      if (angry) { g.fillStyle = "#2a2434"; g.beginPath(); g.moveTo(ex - r * 1.1, y - r * 1.1); g.lineTo(ex + r * 1.1, y - r * 0.5); g.lineTo(ex + r * 1.1, y - r * 1.3); g.lineTo(ex - r * 1.1, y - r * 1.6); g.fill(); }
    });
  }
  function smile(g, x, y, r, big) { g.strokeStyle = "#2a2434"; g.lineWidth = Math.max(1.5, r * 0.28); g.lineCap = "round"; g.beginPath(); g.arc(x, y, r, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); if (big) { g.fillStyle = "#ff8fa3"; g.beginPath(); g.arc(x, y + r * 0.55, r * 0.45, 0, Math.PI); g.fill(); } }
  function frown(g, x, y, r) { g.strokeStyle = "#2a2434"; g.lineWidth = Math.max(1.5, r * 0.28); g.lineCap = "round"; g.beginPath(); g.arc(x, y + r, r, 1.15 * Math.PI, 1.85 * Math.PI); g.stroke(); }

  // frog / toad body. o: {body,dark,belly,blink,sq,tongue:{tx,ty,k},happy,warts,angry,crown,helmet,cape,hurt}
  function drawFrog(g, x, y, r, face, now, o) {
    o = o || {};
    const body = o.hurt ? "#ff8fa3" : (o.body || GREEN), dark = o.dark || GREEN_D, belly = o.belly || BELLY;
    const sq = o.sq || 0, tongue = o.tongue;
    g.save(); g.translate(x, y); g.scale(face < 0 ? -1 : 1, 1); g.scale(1 + sq * 0.12, 1 - sq * 0.12);
    if (o.cape) { g.fillStyle = o.cape; g.beginPath(); g.moveTo(-r * 0.9, -r * 0.3); g.lineTo(r * 0.9, -r * 0.3); g.lineTo(r * 1.2, r * 1.1); g.lineTo(-r * 1.2, r * 1.1); g.closePath(); g.fill(); }
    g.fillStyle = dark;
    ell(g, -r * 0.85, r * 0.45, r * 0.5, r * 0.3); g.fill(); ell(g, r * 0.85, r * 0.45, r * 0.5, r * 0.3); g.fill();
    [-1, 1].forEach(function (d) { for (let i = -1; i <= 1; i++) { ell(g, d * (r * 1.1 + i * r * 0.16), r * 0.66, r * 0.09, r * 0.16); g.fill(); } });
    g.fillStyle = body; g.shadowColor = body; g.shadowBlur = r * 0.6;
    ell(g, 0, r * 0.05, r, r * 0.85); g.fill(); g.shadowBlur = 0;
    if (o.warts) { g.fillStyle = dark; for (let i = 0; i < 6; i++) dot(g, Math.cos(i * 1.1) * r * 0.55, r * 0.1 + Math.sin(i * 2.3) * r * 0.4, r * 0.07); }
    g.fillStyle = belly; ell(g, 0, r * 0.35, r * 0.6, r * 0.42); g.fill();
    if (o.armor) { g.fillStyle = o.armor; g.globalAlpha = 0.85; ell(g, 0, r * 0.32, r * 0.62, r * 0.4); g.fill(); g.globalAlpha = 1; g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = r * 0.05; g.beginPath(); g.moveTo(-r * 0.4, r * 0.3); g.lineTo(r * 0.4, r * 0.3); g.stroke(); }
    g.fillStyle = dark; ell(g, -r * 0.55, r * 0.72, r * 0.2, r * 0.26); g.fill(); ell(g, r * 0.55, r * 0.72, r * 0.2, r * 0.26); g.fill();
    g.fillStyle = body; dot(g, -r * 0.5, -r * 0.62, r * 0.36); dot(g, r * 0.5, -r * 0.62, r * 0.36);
    eyes(g, 0, -r * 0.62, r * 0.27, r * 0.5, o.blink, o.angry);
    if (!o.angry) { g.fillStyle = "rgba(255,143,163,0.55)"; dot(g, -r * 0.62, -r * 0.02, r * 0.14); dot(g, r * 0.62, -r * 0.02, r * 0.14); }
    if (tongue && tongue.k > 0) {
      g.save(); g.scale(face < 0 ? -1 : 1, 1);
      g.strokeStyle = tongue.col || "#ff6b8a"; g.lineWidth = r * 0.22; g.lineCap = "round";
      if (tongue.glow) { g.shadowColor = tongue.col || "#ff6b8a"; g.shadowBlur = r * 0.5; }
      g.beginPath(); g.moveTo(0, -r * 0.05); g.lineTo(tongue.tx * tongue.k, -r * 0.05 + tongue.ty * tongue.k); g.stroke();
      g.fillStyle = tongue.col || "#ff6b8a"; dot(g, tongue.tx * tongue.k, -r * 0.05 + tongue.ty * tongue.k, r * 0.18);
      if (tongue.fork) { const ang = Math.atan2(tongue.ty, tongue.tx), L = Math.hypot(tongue.tx, tongue.ty) * tongue.k; [-0.35, 0.35].forEach(function (d) { g.beginPath(); g.moveTo(Math.cos(ang) * L * 0.75, -r * 0.05 + Math.sin(ang) * L * 0.75); g.lineTo(Math.cos(ang + d) * L, -r * 0.05 + Math.sin(ang + d) * L); g.stroke(); }); }
      g.restore();
      g.fillStyle = "#2a2434"; ell(g, 0, -r * 0.05, r * 0.22, r * 0.17); g.fill();
    } else if (o.angry) frown(g, 0, -r * 0.1, r * 0.3); else smile(g, 0, -r * 0.2, r * 0.36, o.happy);
    if (o.helmet) { g.fillStyle = o.helmet; g.beginPath(); g.arc(0, -r * 0.75, r * 0.95, Math.PI, 0); g.fill(); g.fillStyle = "#ff6b6b"; g.fillRect(-r * 0.08, -r * 1.75, r * 0.16, r * 0.4); }
    if (o.crown) { g.fillStyle = "#ffd36b"; g.shadowColor = "#ffd36b"; g.shadowBlur = r * 0.4; g.beginPath(); g.moveTo(-r * 0.6, -r * 0.95); g.lineTo(-r * 0.6, -r * 1.45); g.lineTo(-r * 0.3, -r * 1.15); g.lineTo(0, -r * 1.55); g.lineTo(r * 0.3, -r * 1.15); g.lineTo(r * 0.6, -r * 1.45); g.lineTo(r * 0.6, -r * 0.95); g.closePath(); g.fill(); g.shadowBlur = 0; g.fillStyle = "#ff6b8a"; dot(g, 0, -r * 1.1, r * 0.09); }
    g.restore();
  }

  // ---- prey ----
  function drawPrey(g, kind, x, y, r, now, ph) {
    g.save(); g.translate(x, y);
    const wf = Math.abs(Math.sin(now * 0.06 + ph));
    if (kind === "fly") {
      g.fillStyle = "rgba(200,230,255,0.55)"; ell(g, -r * 0.6, -r * 0.5, r * 0.75, r * 0.35 * (0.4 + wf)); g.fill(); ell(g, r * 0.6, -r * 0.5, r * 0.75, r * 0.35 * (0.4 + wf)); g.fill();
      g.fillStyle = "#2a2434"; ell(g, 0, 0, r * 0.55, r * 0.7); g.fill();
      g.fillStyle = "#ff6b6b"; dot(g, -r * 0.25, -r * 0.35, r * 0.2); dot(g, r * 0.25, -r * 0.35, r * 0.2);
    } else if (kind === "mosquito") {
      g.strokeStyle = "#c9c3ff"; g.lineWidth = Math.max(1, r * 0.08); for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-r * 0.4 + i * r * 0.4, r * 0.2); g.lineTo(-r * 0.7 + i * r * 0.6, r * 1.1); g.stroke(); }
      g.fillStyle = "rgba(200,230,255,0.5)"; ell(g, 0, -r * 0.7, r * 0.9, r * 0.25 * (0.4 + wf)); g.fill();
      g.fillStyle = "#6b6689"; ell(g, 0, 0, r * 0.35, r * 0.9); g.fill(); dot(g, 0, -r * 0.8, r * 0.28);
      g.strokeStyle = "#ff8fa3"; g.lineWidth = Math.max(1, r * 0.1); g.beginPath(); g.moveTo(0, -r * 0.9); g.lineTo(0, -r * 1.7); g.stroke();
      g.fillStyle = "#ff6b6b"; dot(g, -r * 0.15, -r * 0.85, r * 0.1); dot(g, r * 0.15, -r * 0.85, r * 0.1);
    } else if (kind === "dragonfly") {
      const cols = ["#74b9ff", "#7fe0a0", "#c9c3ff"]; const c = cols[Math.floor(ph * 10) % 3];
      g.fillStyle = "rgba(200,230,255,0.45)"; [-1, 1].forEach(function (d) { ell(g, d * r * 1.1, -r * 0.35, r * 1.1, r * 0.3 * (0.35 + wf)); g.fill(); ell(g, d * r * 0.9, r * 0.2, r * 0.9, r * 0.25 * (0.35 + wf)); g.fill(); });
      g.fillStyle = c; g.shadowColor = c; g.shadowBlur = r * 0.5; ell(g, 0, r * 0.3, r * 0.22, r * 1.4); g.fill(); g.shadowBlur = 0; dot(g, 0, -r * 0.9, r * 0.4);
      g.fillStyle = "#2a2434"; dot(g, -r * 0.2, -r * 1.0, r * 0.14); dot(g, r * 0.2, -r * 1.0, r * 0.14);
    } else if (kind === "beetle") {
      g.fillStyle = "#2a2434"; for (let i = -1; i <= 1; i++) { g.fillRect(-r * 1.1, i * r * 0.35 - r * 0.05, r * 2.2, r * 0.1); }
      g.fillStyle = "#c98a2e"; g.shadowColor = "#ffb86b"; g.shadowBlur = r * 0.4; ell(g, 0, 0, r * 0.8, r * 1.0); g.fill(); g.shadowBlur = 0;
      g.strokeStyle = "#8a5a1e"; g.lineWidth = Math.max(1, r * 0.08); g.beginPath(); g.moveTo(0, -r * 0.6); g.lineTo(0, r * 1); g.stroke();
      g.fillStyle = "#ffe9a0"; dot(g, -r * 0.35, -r * 0.2, r * 0.12); dot(g, r * 0.35, -r * 0.2, r * 0.12); dot(g, 0, r * 0.4, r * 0.1);
      g.fillStyle = "#2a2434"; dot(g, 0, -r * 1.05, r * 0.32); g.fillStyle = "#fff"; dot(g, -r * 0.14, -r * 1.1, r * 0.1); dot(g, r * 0.14, -r * 1.1, r * 0.1);
    } else if (kind === "wasp") {
      g.fillStyle = "rgba(200,230,255,0.6)"; ell(g, -r * 0.15, -r * 0.6, r * 0.6, r * 0.35 * (0.4 + wf)); g.fill(); ell(g, r * 0.25, -r * 0.6, r * 0.6, r * 0.35 * (0.4 + wf)); g.fill();
      g.fillStyle = "#ffd36b"; g.shadowColor = "#ffd36b"; g.shadowBlur = r * 0.4; ell(g, 0, 0, r * 0.95, r * 0.5); g.fill(); g.shadowBlur = 0;
      g.fillStyle = "#2a2434"; g.fillRect(-r * 0.45, -r * 0.5, r * 0.22, r * 1); g.fillRect(r * 0.05, -r * 0.5, r * 0.22, r * 1); g.beginPath(); g.moveTo(-r * 0.95, 0); g.lineTo(-r * 1.4, r * 0.1); g.lineTo(-r * 0.95, r * 0.2); g.fill();
      g.fillStyle = "#ff6b6b"; dot(g, r * 0.7, -r * 0.15, r * 0.14);
    }
    g.restore();
  }

  // ---- enemies ----
  function drawEnemy(g, e, x, y, S, now) {
    const R = S * 0.05 * (e.def.size || 1), face = e.face || 1, hurt = e.hurt > 0;
    g.save(); g.translate(x, y);
    const k = e.kind;
    if (k === "snake") {
      g.strokeStyle = hurt ? "#ff8fa3" : "#3fa66a"; g.lineWidth = R * 0.55; g.lineCap = "round"; g.beginPath();
      for (let i = 0; i <= 8; i++) { const t = i / 8, px = -face * (t * R * 3), py = Math.sin(now * 0.008 + t * 6) * R * 0.35; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke();
      g.strokeStyle = hurt ? "#ff6b8a" : "#ffd36b"; g.lineWidth = R * 0.12; g.setLineDash([R * 0.2, R * 0.3]); g.stroke(); g.setLineDash([]);
      g.fillStyle = hurt ? "#ff8fa3" : "#3fa66a"; ell(g, 0, 0, R * 0.55, R * 0.42); g.fill();
      g.fillStyle = "#ff6b6b"; dot(g, face * R * 0.2, -R * 0.15, R * 0.11); dot(g, face * R * 0.4, -R * 0.15, R * 0.11);
      g.strokeStyle = "#ff6b6b"; g.lineWidth = R * 0.07; g.beginPath(); g.moveTo(face * R * 0.55, R * 0.05); g.lineTo(face * R * 0.95, R * 0.05); g.lineTo(face * R * 1.1, -R * 0.1); g.moveTo(face * R * 0.95, R * 0.05); g.lineTo(face * R * 1.1, R * 0.2); g.stroke();
    } else if (k === "gator") {
      const open = e.lunge > 0 ? 0.35 : 0.05;
      g.fillStyle = hurt ? "#ff8fa3" : "#2f6e3f"; g.shadowColor = "#7fe0a0"; g.shadowBlur = R * 0.3;
      ell(g, -face * R * 0.5, 0, R * 1.6, R * 0.5); g.fill(); g.shadowBlur = 0;
      g.fillStyle = hurt ? "#ff8fa3" : "#3a8a4d"; for (let i = 0; i < 5; i++) { ell(g, -face * (R * 0.9 - i * R * 0.45), -R * 0.3, R * 0.15, R * 0.14); g.fill(); }
      g.save(); g.translate(face * R * 0.9, -R * 0.1); g.rotate(-face * open); g.fillStyle = hurt ? "#ff8fa3" : "#2f6e3f"; rr(g, face > 0 ? 0 : -R * 1.2, -R * 0.22, R * 1.2, R * 0.28, R * 0.1); g.fill(); g.restore();
      g.fillStyle = hurt ? "#ff8fa3" : "#2f6e3f"; rr(g, face > 0 ? R * 0.9 : -R * 2.1, -R * 0.05, R * 1.2, R * 0.28, R * 0.1); g.fill();
      g.fillStyle = "#fff"; for (let i = 0; i < 4; i++) { const tx = face * (R * 1.05 + i * R * 0.25); g.beginPath(); g.moveTo(tx - R * 0.06, 0); g.lineTo(tx + R * 0.06, 0); g.lineTo(tx, R * 0.14); g.fill(); }
      g.fillStyle = "#ffd36b"; dot(g, face * R * 0.55, -R * 0.4, R * 0.16); dot(g, face * R * 0.2, -R * 0.4, R * 0.16); g.fillStyle = "#2a2434"; g.fillRect(face * R * 0.55 - R * 0.03, -R * 0.5, R * 0.06, R * 0.2); g.fillRect(face * R * 0.2 - R * 0.03, -R * 0.5, R * 0.06, R * 0.2);
    } else if (k === "spider") {
      g.strokeStyle = hurt ? "#ff8fa3" : "#4a3448"; g.lineWidth = R * 0.12; g.lineCap = "round";
      for (let i = 0; i < 4; i++) { const a = -0.9 + i * 0.6, w = Math.sin(now * 0.01 + i) * R * 0.1; [-1, 1].forEach(function (d) { g.beginPath(); g.moveTo(0, 0); g.lineTo(d * Math.cos(a) * R * 1.1, Math.sin(a) * R * 0.6 + w); g.lineTo(d * Math.cos(a) * R * 1.6, R * 0.5 + w); g.stroke(); }); }
      g.fillStyle = hurt ? "#ff8fa3" : "#5a3a5e"; g.shadowColor = "#c9c3ff"; g.shadowBlur = R * 0.3; ell(g, 0, R * 0.1, R * 0.8, R * 0.7); g.fill(); g.shadowBlur = 0; dot(g, 0, -R * 0.55, R * 0.42);
      g.fillStyle = "#ff6b6b"; for (let i = 0; i < 4; i++) dot(g, -R * 0.3 + i * R * 0.2, -R * 0.65 + (i % 2) * R * 0.12, R * 0.08);
      g.fillStyle = "#c9c3ff"; dot(g, -R * 0.2, R * 0.05, R * 0.12); dot(g, R * 0.25, R * 0.2, R * 0.1);
    } else if (k === "scorpion") {
      g.fillStyle = hurt ? "#ff8fa3" : "#c9563a"; g.shadowColor = "#ff8f6b"; g.shadowBlur = R * 0.3;
      ell(g, 0, 0, R * 0.9, R * 0.5); g.fill(); g.shadowBlur = 0;
      g.strokeStyle = hurt ? "#ff8fa3" : "#c9563a"; g.lineWidth = R * 0.22; g.lineCap = "round"; g.beginPath();
      for (let i = 0; i <= 5; i++) { const t = i / 5; const px = -face * (R * 0.8 + t * R * 1.2), py = -Math.sin(t * 2.2) * R * 1.1; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke();
      g.fillStyle = "#2a2434"; dot(g, -face * R * 2.0, -R * 0.95, R * 0.16);
      g.lineWidth = R * 0.14; for (let i = 0; i < 3; i++) { [-1, 1].forEach(function (d) { g.beginPath(); g.moveTo(-R * 0.4 + i * R * 0.4, 0); g.lineTo(-R * 0.4 + i * R * 0.4 + d * R * 0.1, d * R * 0.6); g.stroke(); }); }
      [-1, 1].forEach(function (d) { g.beginPath(); g.moveTo(face * R * 0.7, d * R * 0.2); g.lineTo(face * R * 1.4, d * R * 0.55); g.stroke(); g.fillStyle = hurt ? "#ff8fa3" : "#c9563a"; ell(g, face * R * 1.5, d * R * 0.55, R * 0.3, R * 0.2); g.fill(); });
      g.fillStyle = "#ffd36b"; dot(g, face * R * 0.5, -R * 0.15, R * 0.1); dot(g, face * R * 0.7, -R * 0.15, R * 0.1);
    } else if (k === "guard") {
      drawFrog(g, 0, 0, R * 1.1, face, now, { body: hurt ? "#ff8fa3" : "#8a7a5a", dark: "#5a4a3a", belly: "#cfc0a0", warts: true, angry: true, helmet: "#b8b2cc", armor: "#6b6689" });
      g.strokeStyle = "#c8a06a"; g.lineWidth = R * 0.12; g.lineCap = "round"; g.beginPath(); g.moveTo(face * R * 1.2, R * 0.8); g.lineTo(face * R * 1.2, -R * 1.7); g.stroke();
      g.fillStyle = "#e6ecf5"; g.beginPath(); g.moveTo(face * R * 1.2 - R * 0.18, -R * 1.6); g.lineTo(face * R * 1.2 + R * 0.18, -R * 1.6); g.lineTo(face * R * 1.2, -R * 2.2); g.fill();
    } else if (k === "king") {
      drawFrog(g, 0, 0, R, face, now, { body: hurt ? "#ff8fa3" : "#6b8f3a", dark: "#3f5a22", belly: "#d8e0a0", warts: true, angry: e.phase !== "dead", crown: true, cape: "#8a2a4a", sq: e.sq || 0 });
    }
    g.restore();
  }

  // token shapes (biome objectives) + misc pictograms
  const SHAPE = {
    star: function (g, r) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr2 = i % 2 ? r * 0.45 : r; i ? g.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2) : g.moveTo(Math.cos(a) * rr2, Math.sin(a) * rr2); } g.closePath(); g.fill(); },
    triangle: function (g, r) { g.beginPath(); g.moveTo(0, -r); g.lineTo(r * 0.95, r * 0.7); g.lineTo(-r * 0.95, r * 0.7); g.closePath(); g.fill(); },
    diamond: function (g, r) { g.beginPath(); g.moveTo(0, -r); g.lineTo(r * 0.7, 0); g.lineTo(0, r); g.lineTo(-r * 0.7, 0); g.closePath(); g.fill(); },
    hex: function (g, r) { g.beginPath(); for (let i = 0; i < 6; i++) { const a = i * TAU / 6 - Math.PI / 6; i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); },
    crown: function (g, r) { g.beginPath(); g.moveTo(-r, r * 0.7); g.lineTo(-r, -r * 0.3); g.lineTo(-r * 0.5, r * 0.1); g.lineTo(0, -r); g.lineTo(r * 0.5, r * 0.1); g.lineTo(r, -r * 0.3); g.lineTo(r, r * 0.7); g.closePath(); g.fill(); },
    heart: function (g, r) { g.beginPath(); g.moveTo(0, r * 0.8); g.bezierCurveTo(-r * 1.3, -r * 0.1, -r * 0.6, -r * 1, 0, -r * 0.3); g.bezierCurveTo(r * 0.6, -r * 1, r * 1.3, -r * 0.1, 0, r * 0.8); g.fill(); },
    gem: function (g, r) { g.beginPath(); g.moveTo(-r * 0.6, -r * 0.4); g.lineTo(r * 0.6, -r * 0.4); g.lineTo(r, 0); g.lineTo(0, r); g.lineTo(-r, 0); g.closePath(); g.fill(); },
    bolt: function (g, r) { g.beginPath(); g.moveTo(r * 0.2, -r); g.lineTo(-r * 0.5, r * 0.1); g.lineTo(0, r * 0.1); g.lineTo(-r * 0.2, r); g.lineTo(r * 0.5, -r * 0.1); g.lineTo(0, -r * 0.1); g.closePath(); g.fill(); }
  };

  // ---- world data ----
  const BIOMES = [
    { id: "meadow", name: "Sunny Meadow", token: "star", tokenCol: "#ffd36b", need: 10, prey: "fly", enemy: "snake", ground: "#15302a", tuft: "127,224,160", water: "#1e4d6e", decor: "tree", shopTier: 0,
      ponds: [[0.35, 0.3, 0.09, 0.06], [0.7, 0.72, 0.1, 0.07]], enemies: [[0.55, 0.5], [0.8, 0.3], [0.62, 0.85]], sign: "The meadow. Grandma Toad says: eat flies, earn stars, open the gate." },
    { id: "swamp", name: "Murky Swamp", token: "triangle", tokenCol: "#7fe0a0", need: 12, prey: "mosquito", enemy: "gator", ground: "#1a2a22", tuft: "110,160,120", water: "#2a4a3e", decor: "reed", shopTier: 1,
      ponds: [[0.5, 0.5, 0.22, 0.42], [0.82, 0.2, 0.08, 0.06]], enemies: [[0.44, 0.35], [0.56, 0.65], [0.5, 0.85], [0.82, 0.2]], water_enemies: true, sign: "The swamp. Alligators wait in the water — swim fast, strike first." },
    { id: "forest", name: "Whispering Forest", token: "diamond", tokenCol: "#c9c3ff", need: 14, prey: "dragonfly", enemy: "spider", ground: "#141a2a", tuft: "140,140,200", water: "#233a5e", decor: "pine", shopTier: 2,
      ponds: [[0.3, 0.7, 0.09, 0.06], [0.75, 0.35, 0.1, 0.07]], enemies: [[0.4, 0.3], [0.6, 0.55], [0.85, 0.75], [0.25, 0.5]], sign: "The forest. Spiders spit webs that slow you. Keep hopping." },
    { id: "canyon", name: "Red Canyon", token: "hex", tokenCol: "#ff8f6b", need: 16, prey: "beetle", enemy: "scorpion", ground: "#2a1a18", tuft: "220,140,100", water: "#3a5a6e", decor: "cactus", shopTier: 3,
      ponds: [[0.6, 0.5, 0.07, 0.05]], enemies: [[0.35, 0.4], [0.55, 0.75], [0.75, 0.3], [0.85, 0.65], [0.5, 0.2]], sign: "The canyon. Scorpions charge — sidestep, then hit the tail." },
    { id: "kingdom", name: "Toad Kingdom", token: "crown", tokenCol: "#ffd36b", need: 8, prey: "wasp", enemy: "guard", ground: "#1c1834", tuft: "150,130,200", water: "#2a3a6e", decor: "castle", shopTier: 4,
      ponds: [[0.3, 0.25, 0.08, 0.05], [0.3, 0.75, 0.08, 0.05]], enemies: [[0.4, 0.5], [0.55, 0.3], [0.55, 0.7], [0.68, 0.5]], sign: "The kingdom. Royal guards ahead. The castle gate opens with 8 crowns." }
  ];
  const PREY_DEF = {
    fly: { r: 0.02, speed: 0.00006, gems: 2, hp: 1, wander: 0.05 },
    mosquito: { r: 0.02, speed: 0.00016, gems: 3, hp: 1, wander: 0.09 },
    dragonfly: { r: 0.024, speed: 0.00026, gems: 4, hp: 1, wander: 0.16 },
    beetle: { r: 0.022, speed: 0.00005, gems: 5, hp: 2, wander: 0.05, ground: true },
    wasp: { r: 0.022, speed: 0.0002, gems: 6, hp: 2, wander: 0.1 }
  };
  const ENEMY_DEF = {
    snake: { hp: 6, dmg: 1, speed: 0.00016, aggro: 0.35, gems: 12, size: 1, r: 0.06 },
    gator: { hp: 12, dmg: 2, speed: 0.00034, aggro: 0.34, gems: 20, size: 1.3, r: 0.09, water: true },
    spider: { hp: 9, dmg: 1, speed: 0.0001, aggro: 0.45, gems: 18, size: 1, r: 0.06, shoots: true },
    scorpion: { hp: 14, dmg: 2, speed: 0.00012, aggro: 0.4, gems: 26, size: 1.1, r: 0.07, charges: true },
    guard: { hp: 18, dmg: 2, speed: 0.00022, aggro: 0.45, gems: 34, size: 1.1, r: 0.07 },
    king: { hp: 140, dmg: 3, speed: 0.00028, aggro: 9, gems: 300, size: 2.4, r: 0.16 }
  };
  // shop items. tier = first biome (index) where the item is sold. kind: weapon | armor | potion
  const ITEMS = [
    { id: "long", kind: "weapon", tier: 0, cost: 30, name: "Long Tongue", desc: "+40% reach" },
    { id: "quick", kind: "weapon", tier: 0, cost: 45, name: "Quick Tongue", desc: "strike 35% faster" },
    { id: "sticky", kind: "weapon", tier: 1, cost: 90, name: "Sticky Tongue", desc: "eats every bug along its path" },
    { id: "forked", kind: "weapon", tier: 1, cost: 110, name: "Forked Tongue", desc: "hits two enemies at once" },
    { id: "venom", kind: "weapon", tier: 2, cost: 160, name: "Venom Tongue", desc: "+2 damage, poisons for 3 s" },
    { id: "slingshot", kind: "weapon", tier: 2, cost: 190, name: "Slingshot Tongue", desc: "double reach, pierces everything" },
    { id: "fire", kind: "weapon", tier: 3, cost: 280, name: "Fire Tongue", desc: "+3 damage, sets enemies ablaze" },
    { id: "royal", kind: "weapon", tier: 4, cost: 420, name: "Royal Tongue", desc: "double damage. Fit for a king." },
    { id: "toadskin", kind: "armor", tier: 0, cost: 50, name: "Toad Skin", desc: "take 1 less damage" },
    { id: "heart", kind: "armor", tier: 0, cost: 60, name: "Extra Heart", desc: "+1 max heart (up to 4 times)", repeat: 4 },
    { id: "boots", kind: "armor", tier: 1, cost: 70, name: "Swamp Boots", desc: "swim 60% faster" },
    { id: "spring", kind: "armor", tier: 1, cost: 95, name: "Spring Legs", desc: "hop 30% farther" },
    { id: "lily", kind: "armor", tier: 1, cost: 130, name: "Lily Shield", desc: "blocks one hit every 8 s" },
    { id: "stone", kind: "armor", tier: 3, cost: 240, name: "Stone Hide", desc: "take 2 less damage" },
    { id: "crownguard", kind: "armor", tier: 4, cost: 360, name: "Crown Guard", desc: "take 3 less damage" },
    { id: "heal", kind: "potion", tier: 0, cost: 25, name: "Heal Potion", desc: "+3 hearts (use from the bar)", stack: true },
    { id: "stam", kind: "potion", tier: 0, cost: 15, name: "Zip Potion", desc: "10 s of endless stamina", stack: true },
    { id: "bait", kind: "potion", tier: 0, cost: 30, name: "Bug Bait", desc: "spawns 8 bugs around you", stack: true },
    { id: "charm", kind: "potion", tier: 2, cost: 140, name: "Lucky Charm", desc: "+50% gems forever" }
  ];
  const SMITHS = [
    { kind: "weapon", name: "Weaponsmith Bram", body: "#c8a06a", dark: "#8a6a3c", belly: "#f4e2c2", line: "Tongues sharpened here." },
    { kind: "armor", name: "Armorsmith Mossy", body: "#7f9fb8", dark: "#4f6f88", belly: "#d9e6f0", line: "Skins, shields, hearts." },
    { kind: "potion", name: "Shopkeeper Lulu", body: "#e0a3ff", dark: "#9a5ec4", belly: "#f7e6ff", line: "Potions! Fresh from the pond." }
  ];

  const INTRO = [
    { t: ["In the land of Lilypond, every frog", "lived under the rule of the Frog King."], scene: "castle" },
    { t: ["But King Grumbold grew greedy.", "He took every fly the peasants caught,", "and drained their ponds to fill his moat."], scene: "king" },
    { t: ["In a small meadow lived Pip —", "a frog too small to matter.", "Or so everyone thought."], scene: "pip" },
    { t: ["Grandma Toad: \"Someone has to hop to the castle, Pip.", "Collect each biome's tokens to open its gate.", "Grow strong at the camps. Then end this.\""], scene: "grandma" },
    { t: ["LEFT-click to hop.  RIGHT-click to strike with your tongue.", "Eat bugs for gems and tokens. Visit the smiths.", "Watch your hearts and stamina."], scene: "controls" }
  ];
  const BOSS_INTRO = [
    { t: ["King Grumbold: \"A meadow frog? In MY castle?\"", "\"Guards! ...Guards?\""], scene: "king" },
    { t: ["Pip: \"Your guards are napping in the swamp.", "The flies go back to the people, Grumbold.\""], scene: "pip" }
  ];
  const ENDING = [
    { t: ["The crown rolled across the floor", "and stopped at Pip's feet."], scene: "crown" },
    { t: ["The ponds were refilled. The flies were shared.", "And the smallest frog in Lilypond", "became its kindest king."], scene: "castle" },
    { t: ["THE END", "(the world is yours — keep exploring)"], scene: "pip" }
  ];

  const MINIBOSS = [
    { kind: "snake", name: "Slither the Long", hp: 40, size: 2.2, dmg: 1, gems: 80, gimmick: "slam", intro: "The ground trembles. Slither the Long blocks the gate. Hop over the shockwaves!" },
    { kind: "gator", name: "Mawgrim, Elder Gator", hp: 60, size: 2.0, dmg: 2, gems: 110, gimmick: "wave", intro: "The swamp churns. Mawgrim rises. Hop over the waves he sends!" },
    { kind: "spider", name: "Silka, Spider Queen", hp: 70, size: 2.1, dmg: 2, gems: 140, gimmick: "web", intro: "Silka descends from the canopy. Dodge her webs, squash her brood." },
    { kind: "scorpion", name: "Duneclaw", hp: 85, size: 2.0, dmg: 3, gems: 180, gimmick: "quake", intro: "Duneclaw shakes the canyon. Watch the falling rocks, hop the shockwave!" },
    { kind: "guard", name: "Sir Croakalot", hp: 100, size: 1.9, dmg: 3, gems: 220, gimmick: "sweep", intro: "Sir Croakalot, Captain of the Guard. Strike when his shield drops!" }
  ];

  Arcade.register({
    id: "frogquest",
    name: "Frog Quest",
    tagline: "Story mode: hop through 5 biomes, upgrade your tongue, hop over shockwaves, dethrone the Frog King.",
    accent: "#7fe0a0",
    complexity: "high",
    controls: "click",
    scoreLabel: "Gems",
    create() {
      let stageEl, ctx, canvas, g, unResize = null, ctxMenu = null;
      let S = 0, W = 0, H = 0, dpr = 1, reduced = false, now = 0;
      let save, p, cam, prey = [], enemies = [], hazards = [], fx = [], ripples = [], toasts = [], boss = null, mini = null;
      let scene = "title", cut = null, panel = null, shake = 0, fade = 0, fadeDir = 0, afterFade = null, hopSnd = 0, dirty = false, saveT = 0;

      // ---- geometry ----
      function bw() { return BW * S; }
      function biomeOf(x) { return clamp(Math.floor(x / bw()), 0, 4); }
      function gateX(i) { return i < 4 ? (i + 1) * bw() : (4 * BW + 2.2) * S; }
      function campPos(i) { return { x: (i + 0.28) * bw(), y: H * 0.5 }; }
      function pondAt(x, y) {
        const i = biomeOf(x), b = BIOMES[i];
        for (let k = 0; k < b.ponds.length; k++) { const q = b.ponds[k], cx = (i + q[0]) * bw(), cy = q[1] * H, rx = q[2] * bw(), ry = q[3] * H, dx = (x - cx) / rx, dy = (y - cy) / ry; if (dx * dx + dy * dy < 1) return { x: cx, y: cy, rx: rx, ry: ry }; }
        if (i === 4 && x > gateX(4) + S * 0.2 && Math.abs(y - H * 0.5) > H * 0.36) return { x: x, y: y, rx: S, ry: S };   // castle moat edges
        return null;
      }
      function inArena(x) { return x > gateX(4); }
      function frogR() { return S * 0.055; }

      // ---- save ----
      function defaultSave() { return { started: false, gems: 0, tokens: [0, 0, 0, 0, 0], owned: {}, potions: { heal: 1, stam: 1, bait: 0 }, hpMax: 5, unlocked: [false, false, false, false, false], miniDead: [false, false, false, false, false], won: false, reach: 0, x: 0.5, y: 0.5, total: 0 }; }
      function load() { const s = ctx.storage.get("save", null); save = Object.assign(defaultSave(), s || {}); }
      function markDirty() { dirty = true; }
      function persist() { if (!p) return; save.x = p.x / W; save.y = p.y / H; ctx.storage.set("save", save); dirty = false; }
      function has(id) { return (save.owned[id] || 0) > 0; }
      function count(id) { return save.owned[id] || 0; }

      // derived stats
      function tongueRange() { return S * 0.4 * (has("long") ? 1.4 : 1) * (has("slingshot") ? 2 : 1); }
      function tongueDmg() { return (2 + (has("venom") ? 2 : 0) + (has("fire") ? 3 : 0)) * (has("royal") ? 2 : 1); }
      function tongueCd() { return 380 * (has("quick") ? 0.65 : 1); }
      function armor() { return (has("toadskin") ? 1 : 0) + (has("stone") ? 2 : 0) + (has("crownguard") ? 3 : 0); }
      function hopLen() { return S * 0.13 * (has("spring") ? 1.3 : 1); }
      function gemMul() { return has("charm") ? 1.5 : 1; }

      // ---- sounds ----
      const A = function () { return ctx.audio; };
      function sndHop() { if (now - hopSnd < 110) return; hopSnd = now; A().tone(260, 0.12, { type: "triangle", vol: 0.07, glide: 620 }); }
      function sndTongue() { A().tone(900, 0.07, { type: "sine", vol: 0.07, glide: 1500 }); }
      function sndGulp() { A().tone(420, 0.14, { type: "sine", vol: 0.1, glide: 160 }); }
      function sndHit() { A().tone(220, 0.1, { type: "square", vol: 0.06, glide: 120 }); }
      function sndClank() { A().tone(1200, 0.06, { type: "square", vol: 0.05, glide: 900 }); A().tone(300, 0.08, { type: "triangle", vol: 0.05 }); }
      function sndHurt() { A().tone(180, 0.22, { type: "sawtooth", vol: 0.09, glide: 90 }); }
      function sndGem() { A().tone(1046, 0.08, { type: "sine", vol: 0.06, glide: 1568 }); }
      function sndToken() { A().arp([784, 1046, 1318], { dur: 0.1, step: 0.06, vol: 0.08, type: "sine" }); }
      function sndBuy() { A().arp([523, 659, 784, 1046], { dur: 0.14, step: 0.07, vol: 0.1, type: "triangle" }); }
      function sndNo() { A().tone(200, 0.15, { type: "square", vol: 0.05, glide: 150 }); }
      function sndQuake() { A().tone(60, 0.6, { type: "sawtooth", vol: 0.14, glide: 40 }); A().tone(45, 0.7, { type: "sine", vol: 0.14 }); }
      function sndGate() { A().arp([392, 523, 659, 784, 1046], { dur: 0.25, step: 0.1, vol: 0.12, type: "triangle" }); }
      function sndClick() { A().tone(660, 0.05, { type: "sine", vol: 0.04, glide: 880 }); }

      // ---- helpers ----
      function toast(text, col) { toasts.push({ text: text, col: col || "#e6ecf5", life: 1, t: 0, dur: 2600 }); }
      function spark(x, y, col, n) { for (let k = 0; k < (reduced ? 3 : n); k++) fx.push({ kind: "spark", x: x, y: y, vx: (Math.random() - 0.5) * S * 0.0007, vy: (Math.random() - 0.8) * S * 0.0007, t: 0, dur: 450 + Math.random() * 300, col: col }); }
      function confetti(x, y) { const n = reduced ? 12 : 50; for (let i = 0; i < n; i++) { const a = Math.random() * TAU, sp = S * (0.0003 + Math.random() * 0.0006); fx.push({ kind: "conf", x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - S * 0.0003, t: 0, dur: 1400 + Math.random() * 500, col: ["#ff8fa3", "#ffd36b", "#a8e6a0", "#74b9ff", "#c9c3ff", "#fff"][i % 6], rot: Math.random() * TAU }); } }
      function addGems(n, x, y) { n = Math.round(n * gemMul()); save.gems += n; save.total += n; ctx.setScore(save.total); markDirty(); fx.push({ kind: "gemtxt", x: x, y: y, t: 0, dur: 900, text: "+" + n }); sndGem(); }
      function addToken(i, x, y) {
        const b = BIOMES[i]; save.tokens[i]++; markDirty(); sndToken();
        fx.push({ kind: "token", x: x, y: y, t: 0, dur: 900, shape: b.token, col: b.tokenCol });
        if (save.tokens[i] === b.need && !save.miniDead[i]) { toast(b.name + " tokens complete! Something stirs at the gate…", b.tokenCol); }
      }

      // ---- world population ----
      function resetWorld() {
        prey = []; enemies = []; hazards = []; fx = []; ripples = []; boss = null; mini = null;
        BIOMES.forEach(function (b, i) { b.enemies.forEach(function (e, k) { spawnEnemy(b.enemy, (i + e[0]) * bw(), e[1] * H, i, k); }); });
      }
      function spawnEnemy(kind, x, y, biome, slot) {
        const d = ENEMY_DEF[kind];
        enemies.push({ kind: kind, def: d, x: x, y: y, hx: x, hy: y, hp: d.hp, hpMax: d.hp, face: 1, t: Math.random() * 1000, hurt: 0, cd: 0, lunge: 0, dead: 0, biome: biome, slot: slot, poison: 0, fire: 0, state: "idle", charge: null, z: 0 });
      }
      function spawnPrey(kind, x, y) { const d = PREY_DEF[kind]; prey.push({ kind: kind, def: d, x: x, y: y, hx: x, hy: y, ph: Math.random() * TAU, vx: 0, vy: 0, hp: d.hp }); }
      function keepPrey(dt) {
        const i = biomeOf(p.x), b = BIOMES[i];
        const here = prey.filter(function (q) { return biomeOf(q.x) === i; }).length;
        if (here < 9 && Math.random() < dt * 0.003) {
          const a = Math.random() * TAU, d = S * (0.3 + Math.random() * 0.6);
          let x = clamp(p.x + Math.cos(a) * d, i * bw() + S * 0.1, (i + 1) * bw() - S * 0.1), y = clamp(p.y + Math.sin(a) * d, S * 0.1, H - S * 0.1);
          if (inArena(x) || (i === 4 && x > gateX(4) - S * 0.3)) x = gateX(4) - S * 0.5;
          spawnPrey(b.prey, x, y);
        }
        // trim far-away prey
        for (let k = prey.length - 1; k >= 0; k--) if (Math.hypot(prey[k].x - p.x, prey[k].y - p.y) > S * 2.4) prey.splice(k, 1);
      }

      // ---- player ----
      function newPlayer(x, y) { p = { x: x, y: y, tx: x, ty: y, face: 1, hop: null, rest: 0, z: 0, sq: 0, hp: save.hpMax, stam: 100, iframes: 0, slow: 0, tongue: null, tcd: 0, shieldCd: 0, zip: 0, hurt: 0, swim: 0, kick: 0, blink: 0, happy: 0, dead: false }; }
      function goTo(x, y) {
        if (p.dead) return;
        x = clamp(x, S * 0.05, W - S * 0.05); y = clamp(y, S * 0.08, H - S * 0.05);
        // locked gates block the way forward
        for (let i = 0; i < 5; i++) { const gx = gateX(i); if (!save.unlocked[i] && p.x < gx && x > gx - S * 0.14) x = gx - S * 0.14; }
        p.tx = x; p.ty = y;
        fx.push({ kind: "mark", x: x, y: y, t: 0, dur: 500 });
      }
      function strike(x, y) {
        if (p.dead || p.tongue || p.tcd > 0) return;
        if (p.stam < 8 && !p.zip) { A().tone(300, 0.08, { type: "sine", vol: 0.04, glide: 200 }); fx.push({ kind: "txt", x: p.x, y: p.y - frogR() * 2, t: 0, dur: 700, text: "tired…", col: "#74b9ff" }); return; }
        if (!p.zip) p.stam -= 8;
        const oy = p.y - frogR() * 0.05, dx = x - p.x, dy = y - oy, d = Math.hypot(dx, dy) || 1, max = tongueRange();
        let tx = dx / d * Math.min(d, max), ty = dy / d * Math.min(d, max);
        const L = Math.hypot(tx, ty), ux = tx / L, uy = ty / L;
        const along = function (ox, oyy, rad) { const px = ox - p.x, py = oyy - oy, proj = px * ux + py * uy; if (proj < -rad || proj > L + rad) return -1; const off = Math.abs(px * uy - py * ux); return off < rad ? Math.max(0, proj) : -1; };
        // enemies on the line (sorted by distance)
        const hitsE = [];
        const targets = enemies.slice(); if (boss) targets.push(boss);
        targets.forEach(function (e) { if (e.dead) return; const pr = along(e.x, e.y, e.def.r * S * (e.def.size || 1) + S * 0.03); if (pr >= 0) hitsE.push({ e: e, pr: pr }); });
        hitsE.sort(function (a, b) { return a.pr - b.pr; });
        const takeE = has("slingshot") ? hitsE : hitsE.slice(0, has("forked") ? 2 : 1);
        // prey on the line
        const hitsP = [];
        prey.forEach(function (q) { const pr = along(q.x, q.y, S * 0.05); if (pr >= 0) hitsP.push({ q: q, pr: pr }); });
        hitsP.sort(function (a, b) { return a.pr - b.pr; });
        let takeP = has("sticky") ? hitsP : hitsP.slice(0, 1);
        if (!takeP.length && !takeE.length) { let best = S * 0.08, q0 = null; prey.forEach(function (q) { const dd = Math.hypot(q.x - (p.x + tx), q.y - (oy + ty)); if (dd < best) { best = dd; q0 = q; } }); if (q0) takeP = [{ q: q0, pr: L }]; }
        // tongue tip snaps to the first thing it touches (unless it pierces)
        let end = L; if (!has("slingshot")) { const firsts = []; if (takeE.length) firsts.push(takeE[0].pr); if (takeP.length && !has("sticky")) firsts.push(takeP[0].pr); if (firsts.length) end = Math.min.apply(null, firsts.concat([L])) + S * 0.02; }
        if (end < L) { tx = ux * end; ty = uy * end; }
        if (Math.abs(tx) > S * 0.01) p.face = tx < 0 ? -1 : 1;
        p.tongue = { tx: tx, ty: ty, t: 0, dur: 260, done: false, E: takeE.map(function (h) { return h.e; }), P: takeP.map(function (h) { return h.q; }) };
        p.tcd = tongueCd() + 260;
        sndTongue();
      }
      function resolveTongue() {
        const t = p.tongue, dmg = tongueDmg();
        t.E.forEach(function (e) { damageEnemy(e, dmg, p.x + t.tx, p.y + t.ty); });
        t.P.forEach(function (q) { const i = prey.indexOf(q); if (i < 0) return; q.hp -= 1; if (q.hp > 0) { spark(q.x, q.y, "#ffd36b", 4); sndHit(); return; } prey.splice(i, 1); sndGulp(); p.sq = 1; p.happy = 900; addGems(q.def.gems, q.x, q.y); addToken(biomeOf(q.x), q.x, q.y); spark(q.x, q.y, "#ffd36b", 8); });
      }
      function damageEnemy(e, dmg, hx, hy) {
        if (e.dead) return;
        if (e.isBoss) { // weak points only
          const wp = bossWeakPoint();
          if (!wp || Math.hypot(hx - wp.x, hy - wp.y) > S * 0.11) { sndClank(); fx.push({ kind: "txt", x: hx, y: hy, t: 0, dur: 600, text: "clank", col: "#b8b2cc" }); spark(hx, hy, "#b8b2cc", 5); return; }
          dmg *= 2; fx.push({ kind: "txt", x: hx, y: hy - S * 0.02, t: 0, dur: 700, text: "WEAK POINT!", col: "#ffd36b" }); shake = Math.max(shake, 6);
        }
        if (e.shield > 0) { sndClank(); fx.push({ kind: "txt", x: hx, y: hy, t: 0, dur: 600, text: "blocked", col: "#74b9ff" }); return; }
        e.hp -= dmg; e.hurt = 220; sndHit(); spark(hx, hy, "#ff8fa3", 6);
        if (has("venom")) e.poison = 3000;
        if (has("fire")) e.fire = 2500;
        fx.push({ kind: "txt", x: e.x, y: e.y - S * 0.06, t: 0, dur: 600, text: "-" + dmg, col: "#ff8fa3" });
        if (e.hp <= 0) killEnemy(e);
      }
      function killEnemy(e) {
        e.dead = 1; e.deadT = now; spark(e.x, e.y, "#ffd36b", 16); confetti(e.x, e.y);
        addGems(e.def.gems, e.x, e.y); addToken(clamp(e.biome, 0, 4), e.x, e.y);
        if (e.isMini) { mini = null; save.miniDead[e.biome] = true; save.unlocked[e.biome] = true; markDirty(); persist(); sndGate(); toast(e.name + " defeated! The gate is open.", "#ffd36b"); shake = 10; }
        if (e.isBoss) { boss = null; save.won = true; markDirty(); persist(); setTimeout(function () { if (ctx) startCut(ENDING, function () { toast("You are the Frog King. Long live Pip!", "#ffd36b"); }); }, 900); }
        if (e.spawned) { const i = enemies.indexOf(e); if (i >= 0) enemies.splice(i, 1); }
      }
      function takeHit(dmg, fromX, fromY) {
        if (p.dead || p.iframes > 0) return;
        if (has("lily") && p.shieldCd <= 0) { p.shieldCd = 8000; p.iframes = 700; fx.push({ kind: "txt", x: p.x, y: p.y - frogR() * 2, t: 0, dur: 800, text: "blocked!", col: "#74b9ff" }); A().tone(880, 0.12, { type: "sine", vol: 0.08, glide: 1320 }); return; }
        dmg = Math.max(dmg >= 3 ? 1 : 0, dmg - armor());
        if (dmg <= 0) { fx.push({ kind: "txt", x: p.x, y: p.y - frogR() * 2, t: 0, dur: 600, text: "0", col: "#b8b2cc" }); p.iframes = 400; return; }
        p.hp -= dmg; p.iframes = 900; p.hurt = 300; shake = Math.max(shake, 8); sndHurt();
        const a = Math.atan2(p.y - fromY, p.x - fromX); p.hop = null; p.x = clamp(p.x + Math.cos(a) * S * 0.08, S * 0.05, W - S * 0.05); p.y = clamp(p.y + Math.sin(a) * S * 0.08, S * 0.08, H - S * 0.05);   // knocked back, but you keep your destination
        fx.push({ kind: "txt", x: p.x, y: p.y - frogR() * 2, t: 0, dur: 700, text: "-" + dmg, col: "#ff6b6b" });
        if (p.hp <= 0) die();
      }
      function die() {
        p.dead = true; p.hp = 0; A().tone(200, 0.5, { type: "sawtooth", vol: 0.1, glide: 60 });
        fadeDir = 1; afterFade = function () {
          const i = biomeOf(p.x), c = campPos(i);
          const lost = Math.floor(save.gems * 0.1); save.gems -= lost; markDirty();
          newPlayer(c.x, c.y); hazards = []; toast(lost ? "Ouch. Back at camp. Lost " + lost + " gems." : "Ouch. Back at camp.", "#ff8fa3");
          if (boss) { boss = null; }   // the king resets; walk back in to try again
          if (mini) { mini.x = mini.hx; mini.y = mini.hy; mini.tele = null; mini.charge = null; }   // damage you dealt sticks
          persist();
        };
      }
      function usePotion(id) {
        if (!save.potions[id]) { sndNo(); return; }
        if (id === "heal") { if (p.hp >= save.hpMax) { sndNo(); return; } p.hp = Math.min(save.hpMax, p.hp + 3); spark(p.x, p.y, "#ff8fa3", 12); }
        else if (id === "stam") { p.stam = 100; p.zip = 10000; spark(p.x, p.y, "#74b9ff", 12); }
        else if (id === "bait") { const b = BIOMES[biomeOf(p.x)]; for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; spawnPrey(b.prey, clamp(p.x + Math.cos(a) * S * 0.25, S * 0.1, W - S * 0.1), clamp(p.y + Math.sin(a) * S * 0.25, S * 0.1, H - S * 0.1)); } }
        save.potions[id]--; markDirty(); sndBuy();
      }
      function buy(it) {
        const owned = count(it.id);
        if (!it.stack && !it.repeat && owned) { sndNo(); return; }
        if (it.repeat && owned >= it.repeat) { sndNo(); return; }
        if (save.gems < it.cost) { sndNo(); toast("Not enough gems.", "#ff8fa3"); return; }
        save.gems -= it.cost;
        if (it.kind === "potion" && it.stack) save.potions[it.id] = (save.potions[it.id] || 0) + 1;
        else save.owned[it.id] = owned + 1;
        if (it.id === "heart") { save.hpMax++; p.hp++; }
        markDirty(); persist(); sndBuy(); toast("Bought " + it.name + "!", "#ffd36b");
      }

      // ---- mini-bosses ----
      function spawnMini(i) {
        const m = MINIBOSS[i], d = Object.assign({}, ENEMY_DEF[m.kind], { hp: m.hp, size: m.size, dmg: m.dmg, gems: m.gems, r: ENEMY_DEF[m.kind].r * 1.2 });
        let x = gateX(i) - S * 0.6, y = H * 0.5;
        if (m.gimmick === "wave") { x = (1 + 0.5) * bw(); y = H * 0.5; }
        enemies.push(mini = { kind: m.kind, def: d, x: x, y: y, hx: x, hy: y, hp: m.hp, hpMax: m.hp, face: -1, t: 0, hurt: 0, cd: 2500, lunge: 0, dead: 0, biome: i, slot: -1, poison: 0, fire: 0, state: "idle", isMini: true, name: m.name, gimmick: m.gimmick, shield: 0, z: 0 });
        shake = 14; sndQuake(); toast(m.intro, "#ff8fa3");
        for (let k = 0; k < 20; k++) spark(x + (Math.random() - 0.5) * S * 0.4, y + (Math.random() - 0.5) * S * 0.3, "#b8b2cc", 3);
      }
      function ring(x, y, dmg, speed) { hazards.push({ type: "ring", x: x, y: y, r: S * 0.05, speed: speed || S * 0.00045, w: S * 0.045, dmg: dmg, life: 1, max: S * 0.9 }); sndQuake(); shake = Math.max(shake, 10); }
      function miniAttack(e, dt) {
        const d = Math.max(0.001, Math.hypot(p.x - e.x, p.y - e.y));
        e.cd -= dt;
        if (e.tele) { e.tele.t += dt; if (e.tele.t >= e.tele.dur) { e.tele.fire(); e.tele = null; } return; }
        if (e.cd > 0) return;
        const gk = e.gimmick;
        if (gk === "slam") { e.cd = 3200; e.tele = { t: 0, dur: 700, kind: "rise", fire: function () { e.z = 0; ring(e.x, e.y, 2); } }; }
        else if (gk === "wave") { e.cd = 3600; e.tele = { t: 0, dur: 800, kind: "rise", fire: function () { const dir = p.x < e.x ? -1 : 1; hazards.push({ type: "wave", x: e.x + dir * S * 0.2, y0: 0, y1: H, vx: dir * S * 0.00055, w: S * 0.05, dmg: 2, life: 1, maxX: dir > 0 ? 2 * bw() : bw() }); sndQuake(); shake = 12; } }; }
        else if (gk === "web") { e.cd = 2600; if (Math.random() < 0.4 && enemies.filter(function (q) { return q.spawned && !q.dead; }).length < 4) { e.tele = { t: 0, dur: 600, kind: "shake", fire: function () { for (let k = -1; k <= 1; k += 2) { const s = spawnEnemyAt("spider", e.x + k * S * 0.15, e.y + S * 0.12, e.biome); s.spawned = true; s.def = Object.assign({}, s.def, { hp: 3, size: 0.6, gems: 6, r: 0.04 }); s.hp = s.hpMax = 3; } shake = 8; sndQuake(); } }; }
          else { for (let k = -1; k <= 1; k++) { const a = Math.atan2(p.y - e.y, p.x - e.x) + k * 0.35; hazards.push({ type: "web", x: e.x, y: e.y, vx: Math.cos(a) * S * 0.0004, vy: Math.sin(a) * S * 0.0004, life: 1, dur: 1800, t: 0 }); } } }
        else if (gk === "quake") { e.cd = 3400; if (d < S * 0.7 && Math.random() < 0.5) { e.tele = { t: 0, dur: 500, kind: "crouch", fire: function () { e.charge = { vx: (p.x - e.x) / d * S * 0.0011, vy: (p.y - e.y) / d * S * 0.0011, t: 0, dur: 650 }; } }; }
          else { e.tele = { t: 0, dur: 800, kind: "rise", fire: function () { ring(e.x, e.y, 3, S * 0.0005); for (let k = 0; k < 5; k++) { const a = Math.random() * TAU, rr2 = Math.random() * S * 0.3; hazards.push({ type: "rock", x: p.x + Math.cos(a) * rr2, y: p.y + Math.sin(a) * rr2, t: 0, dur: 1000, r: S * 0.07, dmg: 2 }); } } }; } }
        else if (gk === "sweep") { e.cd = 3000; if (Math.random() < 0.35) { e.shield = 2200; fx.push({ kind: "txt", x: e.x, y: e.y - S * 0.15, t: 0, dur: 800, text: "SHIELD", col: "#74b9ff" }); }
          else if (d < S * 0.45) { e.tele = { t: 0, dur: 600, kind: "raise", fire: function () { hazards.push({ type: "arc", x: e.x, y: e.y, ang: Math.atan2(p.y - e.y, p.x - e.x), t: 0, dur: 350, r: S * 0.34, dmg: 3 }); A().tone(500, 0.15, { type: "sawtooth", vol: 0.07, glide: 200 }); } }; } }
      }
      function spawnEnemyAt(kind, x, y, biome) { spawnEnemy(kind, x, y, biome, -1); return enemies[enemies.length - 1]; }

      // ---- the Frog King ----
      function spawnBoss() {
        const d = ENEMY_DEF.king;
        boss = { kind: "king", def: d, x: gateX(4) + S * 1.6, y: H * 0.5, hx: gateX(4) + S * 1.6, hy: H * 0.5, hp: d.hp, hpMax: d.hp, face: -1, t: 0, hurt: 0, cd: 1800, dead: 0, biome: 4, isBoss: true, name: "King Grumbold", phase: "chase", pt: 0, weak: null, z: 0, sq: 0, poison: 0, fire: 0, shield: 0, spawned: false };
        shake = 16; sndQuake();
      }
      function bossWeakPoint() {
        if (!boss || !boss.weak) return null;
        const R = S * 0.05 * boss.def.size;
        if (boss.weak === "crown") return { x: boss.x, y: boss.y - R * 1.3 };
        if (boss.weak === "belly") return { x: boss.x, y: boss.y + R * 0.4 };
        if (boss.weak === "back") return { x: boss.x - boss.face * R * 0.9, y: boss.y };
        return null;
      }
      function updateBoss(dt) {
        const b = boss, d = Math.max(0.001, Math.hypot(p.x - b.x, p.y - b.y)), R = S * 0.05 * b.def.size;
        b.t += dt; b.pt += dt; if (b.hurt > 0) b.hurt -= dt; if (b.sq > 0) b.sq = Math.max(0, b.sq - dt / 300);
        if (b.poison > 0) { b.poison -= dt; if (Math.floor(b.t / 500) !== Math.floor((b.t - dt) / 500)) { b.hp -= 1; fx.push({ kind: "txt", x: b.x, y: b.y - R, t: 0, dur: 500, text: "-1", col: "#7fe0a0" }); if (b.hp <= 0) { killEnemy(b); return; } } }
        if (b.fire > 0) { b.fire -= dt; if (Math.floor(b.t / 400) !== Math.floor((b.t - dt) / 400)) { b.hp -= 1; if (b.hp <= 0) { killEnemy(b); return; } } }
        const lowHp = b.hp / b.hpMax;
        const ph = b.phase;
        if (ph === "chase") {
          b.weak = null;
          if (d > R * 1.4) { b.x += (p.x - b.x) / d * b.def.speed * dt; b.y += (p.y - b.y) / d * b.def.speed * dt; }
          b.face = p.x < b.x ? -1 : 1;
          if (d < R * 1.5 && b.cd <= 0) { takeHit(2, b.x, b.y); b.cd = 900; }
          b.cd -= dt;
          if (b.pt > (lowHp < 0.5 ? 1100 : 1700)) {
            const guards = enemies.filter(function (e) { return e.spawned && !e.dead && e.kind === "guard"; }).length;
            const pick = Math.random();
            if (lowHp < 0.6 && guards === 0 && pick < 0.2) b.phase = "summon";
            else if (pick < 0.45) b.phase = "slamTele";
            else if (pick < 0.7) b.phase = "inhale";
            else if (pick < 0.85) b.phase = "quakeTele";
            else b.phase = "chargeTele";
            b.pt = 0;
          }
        } else if (ph === "slamTele") { b.sq = 0.6; b.weak = null; if (b.pt > 650) { b.phase = "slamAir"; b.pt = 0; b.jx = p.x; b.jy = p.y; b.x0 = b.x; b.y0 = b.y; A().tone(200, 0.3, { type: "triangle", vol: 0.08, glide: 700 }); } }
        else if (ph === "slamAir") { const k = Math.min(1, b.pt / 700); b.x = lerp(b.x0, b.jx, k); b.y = lerp(b.y0, b.jy, k); b.z = Math.sin(k * Math.PI) * 2.2; if (k >= 1) { b.z = 0; b.phase = "stun"; b.pt = 0; b.weak = "crown"; ring(b.x, b.y, 3, S * 0.0005); if (lowHp < 0.5) setTimeout(function () { if (boss) ring(b.x, b.y, 3, S * 0.0005); }, 500); fx.push({ kind: "txt", x: b.x, y: b.y - R * 2, t: 0, dur: 1200, text: "DIZZY — hit the crown!", col: "#ffd36b" }); } }
        else if (ph === "stun") { if (b.pt > 2200) { b.phase = "chase"; b.pt = 0; b.weak = null; } }
        else if (ph === "inhale") { b.weak = "belly"; b.sq = 0.3; if (b.pt === dt) fx.push({ kind: "txt", x: b.x, y: b.y - R * 2, t: 0, dur: 1100, text: "inhaling — hit the belly!", col: "#ffd36b" }); if (b.pt > 1300) { b.phase = "spit"; b.pt = 0; b.weak = null; const n = lowHp < 0.5 ? 7 : 5, base = Math.atan2(p.y - b.y, p.x - b.x); for (let k = 0; k < n; k++) { const a = base + (k - (n - 1) / 2) * 0.22; hazards.push({ type: "spit", x: b.x, y: b.y, vx: Math.cos(a) * S * 0.00045, vy: Math.sin(a) * S * 0.00045, life: 1, dur: 2600, t: 0, dmg: 2 }); } A().tone(400, 0.25, { type: "sawtooth", vol: 0.08, glide: 150 }); } }
        else if (ph === "spit") { if (b.pt > 500) { b.phase = "chase"; b.pt = 0; } }
        else if (ph === "quakeTele") { b.sq = 0.5; if (b.pt > 700) { b.phase = "chase"; b.pt = 0; shake = 14; sndQuake(); for (let k = 0; k < (lowHp < 0.5 ? 8 : 6); k++) { const a = Math.random() * TAU, rr2 = Math.random() * S * 0.35; hazards.push({ type: "rock", x: p.x + Math.cos(a) * rr2, y: p.y + Math.sin(a) * rr2, t: 0, dur: 1000 + k * 120, r: S * 0.075, dmg: 2 }); } } }
        else if (ph === "chargeTele") { b.face = p.x < b.x ? -1 : 1; if (b.pt > 600) { b.phase = "charge"; b.pt = 0; b.cvx = (p.x - b.x) / d * S * 0.0013; b.cvy = (p.y - b.y) / d * S * 0.0013; } }
        else if (ph === "charge") { b.x += b.cvx * dt; b.y += b.cvy * dt; b.x = clamp(b.x, gateX(4) + R, W - R); b.y = clamp(b.y, R, H - R); if (d < R * 1.5 && b.cd <= 0) { takeHit(3, b.x, b.y); b.cd = 900; } b.cd -= dt; if (b.pt > 700) { b.phase = "dizzy"; b.pt = 0; b.weak = "back"; fx.push({ kind: "txt", x: b.x, y: b.y - R * 2, t: 0, dur: 1200, text: "off balance — hit his back!", col: "#ffd36b" }); } }
        else if (ph === "dizzy") { if (b.pt > 1800) { b.phase = "chase"; b.pt = 0; b.weak = null; } }
        else if (ph === "summon") { if (b.pt > 800) { b.phase = "chase"; b.pt = 0; for (let k = -1; k <= 1; k += 2) { const e = spawnEnemyAt("guard", b.x + k * S * 0.25, b.y + S * 0.1, 4); e.spawned = true; } shake = 8; sndQuake(); toast("The King calls his guards!", "#ff8fa3"); } }
        b.x = clamp(b.x, gateX(4) + R, W - R); b.y = clamp(b.y, R, H - R);
      }

      // ---- enemies ----
      function updateEnemy(e, dt) {
        if (e.dead) { if (e.slot >= 0 && now - e.deadT > 30000 && Math.hypot(e.hx - p.x, e.hy - p.y) > S * 1.2) { e.dead = 0; e.hp = e.hpMax; e.x = e.hx; e.y = e.hy; } return; }
        const d = Math.max(0.001, Math.hypot(p.x - e.x, p.y - e.y)), def = e.def, R = def.r * S * (def.size || 1);
        e.t += dt; if (e.hurt > 0) e.hurt -= dt; if (e.shield > 0) e.shield -= dt; if (e.lunge > 0) e.lunge -= dt;
        if (e.poison > 0) { e.poison -= dt; if (Math.floor(e.t / 500) !== Math.floor((e.t - dt) / 500)) { e.hp -= 1; fx.push({ kind: "txt", x: e.x, y: e.y - R, t: 0, dur: 500, text: "-1", col: "#7fe0a0" }); if (e.hp <= 0) { killEnemy(e); return; } } }
        if (e.fire > 0) { e.fire -= dt; if (Math.floor(e.t / 400) !== Math.floor((e.t - dt) / 400)) { e.hp -= 1; spark(e.x, e.y - R, "#ff8f6b", 2); if (e.hp <= 0) { killEnemy(e); return; } } }
        if (e.isMini) { miniAttack(e, dt); if (e.tele) { e.z = e.tele.kind === "rise" ? Math.min(1, e.tele.t / e.tele.dur) * 0.8 : 0; return; } }
        if (e.charge) { e.charge.t += dt; e.x += e.charge.vx * dt; e.y += e.charge.vy * dt; if (e.charge.t > e.charge.dur) e.charge = null; if (d < R + frogR() * 0.8 && e.cd <= 0) { takeHit(def.dmg, e.x, e.y); e.cd = 900; } e.cd -= dt; return; }
        const bi = e.biome, minX = bi * bw() + S * 0.05, maxX = (bi + 1) * bw() - S * 0.05;
        if (def.water) {
          // gators: patrol inside their pond, lunge when you're close
          const pd = pondAt(e.hx, e.hy);
          if (d < def.aggro * S && p.x > minX && (pondAt(p.x, p.y) || d < S * 0.2)) { if (e.lunge <= 0 && e.cd <= 0) { e.lunge = 700; e.cd = 1800; e.lvx = (p.x - e.x) / d * def.speed * 2.2; e.lvy = (p.y - e.y) / d * def.speed * 2.2; } }
          if (e.lunge > 0) { e.x += e.lvx * dt; e.y += e.lvy * dt; }
          else { e.x += Math.cos(e.t * 0.0004 + e.slot) * def.speed * 0.3 * dt; e.y += Math.sin(e.t * 0.0003 + e.slot) * def.speed * 0.3 * dt; }
          if (pd) { const dx = (e.x - pd.x) / pd.rx, dy = (e.y - pd.y) / pd.ry, q = Math.hypot(dx, dy); if (q > 0.92) { e.x = pd.x + dx / q * 0.9 * pd.rx; e.y = pd.y + dy / q * 0.9 * pd.ry; e.lunge = 0; } }
          e.face = p.x < e.x ? -1 : 1;
          if (Math.floor(e.t / 900) !== Math.floor((e.t - dt) / 900)) ripples.push({ x: e.x, y: e.y, t: 0, dur: 1200, r: R * 1.6 });
        } else if (def.shoots && !e.isMini) {
          if (d < def.aggro * S) { e.face = p.x < e.x ? -1 : 1; e.cd -= dt; if (e.cd <= 0) { e.cd = 2600; const a = Math.atan2(p.y - e.y, p.x - e.x); hazards.push({ type: "web", x: e.x, y: e.y, vx: Math.cos(a) * S * 0.00042, vy: Math.sin(a) * S * 0.00042, life: 1, dur: 1800, t: 0 }); A().tone(700, 0.1, { type: "sine", vol: 0.04, glide: 400 }); } }
          else e.cd = Math.max(e.cd - dt, 300);
          if (d < S * 0.16) { e.x -= (p.x - e.x) / d * def.speed * dt; e.y -= (p.y - e.y) / d * def.speed * dt; }
        } else if (def.charges && !e.isMini) {
          e.cd -= dt;
          if (d < def.aggro * S && e.cd <= 0) { e.cd = 2400; e.charge = { vx: (p.x - e.x) / d * S * 0.0009, vy: (p.y - e.y) / d * S * 0.0009, t: 0, dur: 550 }; }
          else if (d < def.aggro * S) { e.face = p.x < e.x ? -1 : 1; }
          else { e.x += Math.cos(e.t * 0.0005 + e.slot) * def.speed * 0.4 * dt; e.face = Math.cos(e.t * 0.0005 + e.slot) < 0 ? -1 : 1; }
        } else {
          // chasers: snakes, guards, mini-bosses when not attacking
          if (d < def.aggro * S || e.isMini) { const sp = def.speed * (e.isMini ? 0.8 : 1); if (d > R * 0.9) { e.x += (p.x - e.x) / d * sp * dt; e.y += (p.y - e.y) / d * sp * dt; } e.face = p.x < e.x ? -1 : 1; if (e.kind === "guard") e.z = Math.abs(Math.sin(e.t * 0.012)) * 0.5; }
          else { const k = Math.sin(e.t * 0.0006 + e.slot); e.x = e.hx + k * S * 0.25; e.face = Math.cos(e.t * 0.0006 + e.slot) < 0 ? -1 : 1; e.z = 0; }
        }
        if (!e.isMini || e.gimmick !== "wave") { e.x = clamp(e.x, minX, maxX); e.y = clamp(e.y, S * 0.06, H - S * 0.06); }
        // contact damage
        if (d < R + frogR() * 0.7 && e.cd <= 0 && !(def.water && !pondAt(p.x, p.y) && e.lunge <= 0)) { takeHit(def.dmg, e.x, e.y); e.cd = 900; }
        e.cd -= dt;
      }

      function updateHazards(dt) {
        for (let i = hazards.length - 1; i >= 0; i--) {
          const h = hazards[i]; let gone = false;
          if (h.type === "ring") { h.r += h.speed * dt; if (h.r > h.max) gone = true; else if (p.z < 0.35 && Math.abs(Math.hypot(p.x - h.x, p.y - h.y) - h.r) < h.w && !p.dead) takeHit(h.dmg, h.x, h.y); }
          else if (h.type === "wave") { h.x += h.vx * dt; if ((h.vx > 0 && h.x > h.maxX) || (h.vx < 0 && h.x < h.maxX)) gone = true; else if (p.z < 0.35 && Math.abs(p.x - h.x) < h.w && !p.dead) takeHit(h.dmg, h.x - h.vx * 100, p.y); if (Math.random() < dt * 0.02) ripples.push({ x: h.x, y: Math.random() * H, t: 0, dur: 600, r: S * 0.05 }); }
          else if (h.type === "rock") { h.t += dt; if (h.t >= h.dur && !h.hit) { h.hit = true; shake = Math.max(shake, 6); A().tone(90, 0.15, { type: "triangle", vol: 0.08, glide: 50 }); spark(h.x, h.y, "#b8b2cc", 8); if (Math.hypot(p.x - h.x, p.y - h.y) < h.r && p.z < 0.6) takeHit(h.dmg, h.x, h.y - 1); } if (h.t > h.dur + 300) gone = true; }
          else if (h.type === "spit" || h.type === "web") { h.t += dt; h.x += h.vx * dt; h.y += h.vy * dt; if (h.t > h.dur) gone = true; else if (Math.hypot(p.x - h.x, p.y - h.y) < frogR() * 1.1) { if (h.type === "spit") takeHit(h.dmg, h.x - h.vx, h.y - h.vy); else { p.slow = 2200; fx.push({ kind: "txt", x: p.x, y: p.y - frogR() * 2, t: 0, dur: 700, text: "webbed!", col: "#c9c3ff" }); } gone = true; } }
          else if (h.type === "arc") { h.t += dt; if (h.t > h.dur) gone = true; else if (!h.hit) { const a = Math.atan2(p.y - h.y, p.x - h.x), da = Math.abs(((a - h.ang + Math.PI * 3) % TAU) - Math.PI), dd = Math.hypot(p.x - h.x, p.y - h.y); if (dd < h.r && da < 1.05) { h.hit = true; takeHit(h.dmg, h.x, h.y); } } }
          if (gone) hazards.splice(i, 1);
        }
      }

      // ---- prey ----
      function updatePrey(dt) {
        prey.forEach(function (q) {
          const d = q.def; q.ph += dt * 0.004;
          const ax = (q.hx - q.x) * 0.00002 + Math.sin(q.ph * 3.1) * S * d.speed * 0.05, ay = (q.hy - q.y) * 0.00002 + Math.cos(q.ph * 2.3) * S * d.speed * 0.05;
          q.vx = (q.vx + ax * dt) * 0.98; q.vy = (q.vy + ay * dt) * 0.98;
          q.x += q.vx * dt; q.y += q.vy * dt;
          q.hx += Math.sin(q.ph * 0.5) * S * d.wander * 0.0006 * dt; q.hy += Math.cos(q.ph * 0.37) * S * d.wander * 0.0006 * dt;
          if (d.speed > 0.0001 && Math.hypot(p.x - q.x, p.y - q.y) < S * 0.22) { q.hx += (q.x - p.x) * 0.02; q.hy += (q.y - p.y) * 0.02; }  // skittish bugs flee
          const bi = biomeOf(q.hx); q.hx = clamp(q.hx, bi * bw() + S * 0.08, (bi + 1) * bw() - S * 0.08); q.hy = clamp(q.hy, S * 0.1, H - S * 0.08);
        });
      }

      // ---- update ----
      function update(dt) {
        now += dt;
        if (shake > 0) shake = Math.max(0, shake - dt * 0.02);
        if (fadeDir) { fade += fadeDir * dt / 300; if (fade >= 1) { fade = 1; if (afterFade) { afterFade(); afterFade = null; } fadeDir = -1; } if (fade <= 0) { fade = 0; fadeDir = 0; } }
        for (let i = fx.length - 1; i >= 0; i--) { const e = fx[i]; e.t += dt; if (e.vx !== undefined) { e.x += e.vx * dt; e.y += e.vy * dt; e.vy += S * 0.0000012 * dt; if (e.rot !== undefined) e.rot += dt * 0.004; } if (e.t > e.dur) fx.splice(i, 1); }
        for (let i = ripples.length - 1; i >= 0; i--) { ripples[i].t += dt; if (ripples[i].t > ripples[i].dur) ripples.splice(i, 1); }
        for (let i = toasts.length - 1; i >= 0; i--) { toasts[i].t += dt; if (toasts[i].t > toasts[i].dur) toasts.splice(i, 1); }
        if (cut) { cut.t += dt; return; }
        if (scene !== "world") return;
        if (dirty) { saveT += dt; if (saveT > 2000) { saveT = 0; persist(); } }
        const f = p, R = frogR();
        f.blink -= dt; if (f.blink < -2600 - Math.random() * 2000) f.blink = 160;
        if (f.sq > 0) f.sq = Math.max(0, f.sq - dt / 300);
        if (f.happy > 0) f.happy -= dt; if (f.iframes > 0) f.iframes -= dt; if (f.hurt > 0) f.hurt -= dt; if (f.slow > 0) f.slow -= dt; if (f.tcd > 0) f.tcd -= dt; if (f.shieldCd > 0) f.shieldCd -= dt; if (f.zip > 0) f.zip -= dt;
        f.stam = Math.min(100, f.stam + dt * (f.zip > 0 ? 0.2 : 0.016));
        if (!panel && !f.dead) {
          const pond = pondAt(f.x, f.y);
          const dx = f.tx - f.x, dy = f.ty - f.y, dist = Math.hypot(dx, dy);
          const slowK = f.slow > 0 ? 0.45 : 1;
          if (f.hop) {
            const h = f.hop; h.t += dt; const k = Math.min(1, h.t / h.dur);
            f.x = h.x0 + (h.x1 - h.x0) * k; f.y = h.y0 + (h.y1 - h.y0) * k; f.z = Math.sin(k * Math.PI);
            if (k >= 1) { f.hop = null; f.z = 0; f.rest = 60; f.sq = 0.6; const wp = pondAt(f.x, f.y); if (wp) { f.swim = 1; ripples.push({ x: f.x, y: f.y, t: 0, dur: 900, r: R * 3 }); A().tone(520, 0.1, { type: "sine", vol: 0.05, glide: 160 }); } else A().tone(140, 0.05, { type: "sine", vol: 0.05, glide: 90 }); }
          } else if (pond && dist > R * 0.4) {
            const sp = S * 0.00032 * (has("boots") ? 1.6 : 1) * slowK, step = Math.min(dist, sp * dt);
            f.x += dx / dist * step; f.y += dy / dist * step; f.face = Math.abs(dx) > S * 0.005 ? (dx < 0 ? -1 : 1) : f.face;
            f.kick += dt; if (f.kick > 420) { f.kick = 0; ripples.push({ x: f.x, y: f.y + R * 0.3, t: 0, dur: 800, r: R * 2.2 }); }
            f.swim = 1;
          } else if (dist > R * 0.4) {
            f.rest -= dt;
            if (f.rest <= 0) {
              const len = Math.min(dist, hopLen() * slowK * (f.stam <= 0 && !f.zip ? 0.5 : 1));
              f.hop = { x0: f.x, y0: f.y, x1: f.x + dx / dist * len, y1: f.y + dy / dist * len, t: 0, dur: 280 + len / S * 500 };
              if (Math.abs(dx) > S * 0.01) f.face = dx < 0 ? -1 : 1;
              if (!f.zip) f.stam = Math.max(0, f.stam - 3);
              sndHop();
            }
          } else f.swim = pond ? 1 : 0;
          if (!pond) f.swim = 0;
          if (f.tongue) { const t = f.tongue; t.t += dt; const k = t.t / t.dur; if (k >= 0.5 && !t.done) { t.done = true; resolveTongue(); } if (k >= 1) f.tongue = null; }
          // biome reach + gate guardians + boss trigger
          const bi = biomeOf(f.x);
          if (bi > save.reach) { save.reach = bi; markDirty(); toast(BIOMES[bi].name + " — " + BIOMES[bi].sign, BIOMES[bi].tokenCol); }
          if (!mini && !save.miniDead[bi] && save.tokens[bi] >= BIOMES[bi].need && f.x > gateX(bi) - S * 1.6 && !inArena(f.x)) spawnMini(bi);
          if (bi === 4 && save.unlocked[4] && inArena(f.x) && !boss && !save.won && !cut) { startCut(BOSS_INTRO, function () { spawnBoss(); }); }
          keepPrey(dt); updatePrey(dt);
          enemies.forEach(function (e) { updateEnemy(e, dt); });
          if (boss) updateBoss(dt);
          updateHazards(dt);
          for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].dead && enemies[i].spawned) enemies.splice(i, 1);
        }
        // camera
        const cx = clamp(f.x - S / 2, 0, W - S), cy = clamp(f.y - S / 2, 0, H - S);
        const k = 1 - Math.pow(0.0025, dt / 1000);
        cam.x += (cx - cam.x) * k; cam.y += (cy - cam.y) * k;
      }

      // ---- cutscenes ----
      function startCut(panels, onDone) { cut = { panels: panels, i: 0, t: 0, onDone: onDone }; }
      function cutNext() { cut.i++; cut.t = 0; sndClick(); if (cut.i >= cut.panels.length) endCut(); }
      function endCut() { const c = cut; cut = null; if (c && c.onDone) c.onDone(); }
      function drawCutScene(key, x, y, s) {
        g.save(); g.translate(x, y);
        if (key === "castle") { g.fillStyle = "#2a2440"; [[-0.3, 0.25, 0.14], [0, 0.4, 0.2], [0.3, 0.25, 0.14]].forEach(function (t) { rr(g, t[0] * s - t[2] * s / 2, -t[1] * s, t[2] * s, t[1] * s + s * 0.1, s * 0.02); g.fill(); for (let i = 0; i < 3; i++) g.fillRect(t[0] * s - t[2] * s / 2 + i * t[2] * s / 3, -t[1] * s - s * 0.04, t[2] * s / 6, s * 0.04); }); g.fillStyle = "#ffe9a0"; dot(g, 0, -s * 0.2, s * 0.03); g.fillStyle = "#1e4d6e"; ell(g, 0, s * 0.16, s * 0.6, s * 0.08); g.fill(); }
        else if (key === "king") { drawFrog(g, 0, 0, s * 0.18, -1, now, { body: "#6b8f3a", dark: "#3f5a22", belly: "#d8e0a0", warts: true, angry: true, crown: true, cape: "#8a2a4a" }); for (let i = 0; i < 3; i++) drawFrog(g, -s * 0.45 + i * s * 0.12, s * 0.12, s * 0.05, 1, now, { body: "#a8c6a0", dark: "#6a8a62", belly: "#e0f0d8" }); g.fillStyle = "#ffd36b"; for (let i = 0; i < 6; i++) { g.save(); g.translate(s * 0.28 + (i % 3) * s * 0.07, -s * 0.05 + Math.floor(i / 3) * s * 0.07); SHAPE.gem(g, s * 0.025); g.restore(); } }
        else if (key === "pip") { drawFrog(g, 0, 0, s * 0.16, 1, now, { happy: true, blink: (now % 3000) < 150, crown: save && save.won }); drawPrey(g, "fly", s * 0.3, -s * 0.15, s * 0.03, now, 0); }
        else if (key === "grandma") { drawFrog(g, -s * 0.15, 0, s * 0.16, 1, now, { body: "#c8a06a", dark: "#8a6a3c", belly: "#f4e2c2", warts: true }); drawFrog(g, s * 0.2, s * 0.08, s * 0.09, -1, now, {}); }
        else if (key === "controls") { drawFrog(g, -s * 0.2, 0, s * 0.12, 1, now, { tongue: { tx: s * 0.42, ty: -s * 0.1, k: 1 } }); drawPrey(g, "fly", s * 0.24, -s * 0.1, s * 0.03, now, 0); g.fillStyle = "#ff8fa3"; for (let i = 0; i < 3; i++) { g.save(); g.translate(-s * 0.35 + i * s * 0.07, -s * 0.26); SHAPE.heart(g, s * 0.025); g.restore(); } g.fillStyle = "#74b9ff"; rr(g, -s * 0.38, -s * 0.2, s * 0.2, s * 0.02, s * 0.01); g.fill(); }
        else if (key === "crown") { g.fillStyle = "#ffd36b"; g.shadowColor = "#ffd36b"; g.shadowBlur = s * 0.05; g.save(); g.translate(0, -s * 0.04); SHAPE.crown(g, s * 0.12); g.restore(); g.shadowBlur = 0; drawFrog(g, -s * 0.28, s * 0.06, s * 0.1, 1, now, { happy: true }); }
        g.restore();
      }
      function drawCut() {
        const c = cut, pnl = c.panels[c.i];
        g.fillStyle = "#0e0c1e"; g.fillRect(0, 0, S, S);
        drawCutScene(pnl.scene, S * 0.5, S * 0.36, S * 0.9);
        g.save(); g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#e6ecf5"; g.font = "600 " + Math.round(S * 0.03) + "px system-ui, sans-serif";
        const a = Math.min(1, c.t / 400); g.globalAlpha = a;
        pnl.t.forEach(function (line, i) { g.fillText(line, S / 2, S * 0.62 + i * S * 0.05); });
        g.globalAlpha = 0.5; g.font = "500 " + Math.round(S * 0.022) + "px system-ui, sans-serif"; g.fillText("click to continue  ·  " + (c.i + 1) + "/" + c.panels.length, S / 2, S * 0.9);
        g.restore();
        // skip button
        const b = skipRect(); g.save(); rr(g, b.x, b.y, b.w, b.h, S * 0.015); g.fillStyle = "rgba(255,255,255,0.08)"; g.fill(); g.strokeStyle = "rgba(255,255,255,0.3)"; g.lineWidth = 1; g.stroke(); g.fillStyle = "#e6ecf5"; g.font = "600 " + Math.round(S * 0.022) + "px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("Skip ▸", b.x + b.w / 2, b.y + b.h / 2); g.restore();
      }
      function skipRect() { return { x: S - S * 0.17, y: S * 0.03, w: S * 0.14, h: S * 0.055 }; }
      function inRect(r, x, y) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }

      // ---- title ----
      function titleButtons() { const hasSave = save.started; const list = []; if (hasSave) list.push({ id: "continue", label: "Continue", y: S * 0.62 }); list.push({ id: "new", label: hasSave ? "New Game" : "Start", y: S * (hasSave ? 0.71 : 0.64) }); return list.map(function (b) { return Object.assign(b, { x: S * 0.32, w: S * 0.36, h: S * 0.07 }); }); }
      function drawTitle() {
        g.fillStyle = "#0e1a18"; g.fillRect(0, 0, S, S);
        for (let i = 0; i < 40; i++) { const x = ((i * 137.5) % 100) / 100 * S, y = ((i * 71.3) % 100) / 100 * S * 0.5; g.fillStyle = "rgba(255,255,255," + (0.1 + 0.3 * (0.5 + 0.5 * Math.sin(now * 0.002 + i))) + ")"; dot(g, x, y, S * 0.003); }
        drawCutScene("castle", S * 0.5, S * 0.42, S * 0.8);
        drawFrog(g, S * 0.5, S * 0.47, S * 0.09, 1, now, { happy: true, blink: (now % 3200) < 150, crown: save.won });
        g.save(); g.textAlign = "center"; g.textBaseline = "middle";
        g.fillStyle = GREEN; g.shadowColor = GREEN; g.shadowBlur = S * 0.03; g.font = "800 " + Math.round(S * 0.1) + "px system-ui, sans-serif"; g.fillText("FROG QUEST", S / 2, S * 0.16);
        g.shadowBlur = 0; g.fillStyle = "rgba(230,236,245,0.7)"; g.font = "500 " + Math.round(S * 0.026) + "px system-ui, sans-serif"; g.fillText("a small frog vs. the Frog King", S / 2, S * 0.24);
        titleButtons().forEach(function (b) { rr(g, b.x, b.y, b.w, b.h, S * 0.02); g.fillStyle = b.id === "continue" || !save.started ? "rgba(127,224,160,0.2)" : "rgba(255,255,255,0.08)"; g.fill(); g.strokeStyle = b.id === "continue" || !save.started ? GREEN : "rgba(255,255,255,0.3)"; g.lineWidth = 2; g.stroke(); g.fillStyle = "#e6ecf5"; g.font = "700 " + Math.round(S * 0.03) + "px system-ui, sans-serif"; g.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2); });
        if (save.started) { g.fillStyle = "rgba(230,236,245,0.5)"; g.font = "500 " + Math.round(S * 0.02) + "px system-ui, sans-serif"; g.fillText(BIOMES[save.reach].name + " · " + save.gems + " gems · " + save.tokens.reduce(function (a, b) { return a + b; }, 0) + " tokens" + (save.won ? " · KING" : ""), S / 2, S * 0.84); }
        g.restore();
      }
      function beginGame(fresh) {
        if (fresh) { save = defaultSave(); save.started = true; ctx.storage.set("save", save); }
        resetWorld();
        const c = campPos(0);
        newPlayer(fresh ? c.x : save.x * W, fresh ? c.y : save.y * H);
        if (!fresh) { for (let i = 0; i < 5; i++) if (save.unlocked[i] && !save.miniDead[i]) save.miniDead[i] = true; }
        cam = { x: clamp(p.x - S / 2, 0, W - S), y: clamp(p.y - S / 2, 0, H - S) };
        scene = "world"; ctx.setScore(save.total);
        if (fresh) startCut(INTRO, function () { toast("Grandma Toad: \"Eat 10 flies for 10 stars, Pip. Then the gate.\"", "#ffd36b"); });
      }

      // ---- drawing: world ----
      function drawShadow(x, y, r, z) { g.fillStyle = "rgba(0,0,0,0.3)"; ell(g, x, y + r * 0.7, r * (1 - z * 0.3), r * 0.35 * (1 - z * 0.3)); g.fill(); }
      function drawDecor(kind, x, y, s, i) {
        const R = S * 0.11 * s;
        if (kind === "tree") { g.fillStyle = "#4a3448"; rr(g, x - R * 0.14, y - R * 0.3, R * 0.28, R * 0.9, R * 0.1); g.fill(); g.fillStyle = "#1f5e46"; g.shadowColor = "#3fa66a"; g.shadowBlur = R * 0.3; dot(g, x, y - R * 0.8, R * 0.72); dot(g, x - R * 0.5, y - R * 0.45, R * 0.55); dot(g, x + R * 0.5, y - R * 0.5, R * 0.55); g.shadowBlur = 0; g.fillStyle = "#2f8a5e"; dot(g, x - R * 0.2, y - R * 0.95, R * 0.28); }
        else if (kind === "reed") { g.strokeStyle = "#5f9e5a"; g.lineWidth = R * 0.06; g.lineCap = "round"; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(x + k * R * 0.12, y + R * 0.3); g.quadraticCurveTo(x + k * R * 0.2 + Math.sin(now * 0.001 + k) * R * 0.1, y - R * 0.4, x + k * R * 0.28, y - R * 0.9); g.stroke(); } g.fillStyle = "#8a6a3c"; for (let k = -1; k <= 1; k++) { ell(g, x + k * R * 0.24, y - R * 0.75, R * 0.05, R * 0.16); g.fill(); } if (i % 2) { g.fillStyle = "rgba(127,224,160,0.5)"; g.shadowColor = "#7fe0a0"; g.shadowBlur = R * 0.4; dot(g, x + R * 0.5, y - R * 0.6 + Math.sin(now * 0.003 + i) * R * 0.1, R * 0.05); g.shadowBlur = 0; } }
        else if (kind === "pine") { g.fillStyle = "#3a2a3a"; rr(g, x - R * 0.1, y - R * 0.2, R * 0.2, R * 0.8, R * 0.05); g.fill(); g.fillStyle = "#1e3a4e"; g.shadowColor = "#c9c3ff"; g.shadowBlur = R * 0.2; for (let k = 0; k < 3; k++) { const w = R * (0.9 - k * 0.22), yy = y - R * 0.2 - k * R * 0.45; g.beginPath(); g.moveTo(x - w, yy); g.lineTo(x + w, yy); g.lineTo(x, yy - R * 0.7); g.closePath(); g.fill(); } g.shadowBlur = 0; }
        else if (kind === "cactus") { g.fillStyle = "#4a8a5e"; g.shadowColor = "#7fe0a0"; g.shadowBlur = R * 0.2; rr(g, x - R * 0.18, y - R * 1.1, R * 0.36, R * 1.5, R * 0.18); g.fill(); rr(g, x - R * 0.6, y - R * 0.7, R * 0.5, R * 0.22, R * 0.1); g.fill(); rr(g, x - R * 0.6, y - R * 1.0, R * 0.22, R * 0.5, R * 0.1); g.fill(); rr(g, x + R * 0.1, y - R * 0.5, R * 0.5, R * 0.22, R * 0.1); g.fill(); rr(g, x + R * 0.38, y - R * 0.85, R * 0.22, R * 0.5, R * 0.1); g.fill(); g.shadowBlur = 0; g.fillStyle = "#ff8fd0"; dot(g, x, y - R * 1.15, R * 0.09); }
        else if (kind === "castle") { g.fillStyle = "#2a2440"; rr(g, x - R * 0.35, y - R * 1.6, R * 0.7, R * 2, R * 0.05); g.fill(); for (let k = 0; k < 3; k++) g.fillRect(x - R * 0.35 + k * R * 0.25, y - R * 1.75, R * 0.14, R * 0.18); g.fillStyle = "#ffe9a0"; g.shadowColor = "#ffe9a0"; g.shadowBlur = R * 0.3; rr(g, x - R * 0.08, y - R * 1.1, R * 0.16, R * 0.25, R * 0.05); g.fill(); g.shadowBlur = 0; }
        else if (kind === "rock") { const r2 = S * 0.05 * s; g.fillStyle = "#4e4a66"; ell(g, x, y, r2, r2 * 0.65); g.fill(); g.fillStyle = "#6b6689"; ell(g, x - r2 * 0.2, y - r2 * 0.2, r2 * 0.5, r2 * 0.28); g.fill(); }
        else if (kind === "shroom") { const r2 = S * 0.035 * s; g.fillStyle = "#f4e2c2"; rr(g, x - r2 * 0.3, y - r2 * 0.6, r2 * 0.6, r2 * 0.8, r2 * 0.2); g.fill(); g.fillStyle = "#ff6b6b"; g.shadowColor = "#ff6b6b"; g.shadowBlur = r2 * 0.4; g.beginPath(); g.arc(x, y - r2 * 0.6, r2, Math.PI, 0); g.closePath(); g.fill(); g.shadowBlur = 0; g.fillStyle = "#fff"; dot(g, x - r2 * 0.4, y - r2 * 0.95, r2 * 0.14); dot(g, x + r2 * 0.3, y - r2 * 1.1, r2 * 0.16); }
      }
      function drawGate(i, x, y) {
        const open = save.unlocked[i], b = BIOMES[i];
        const ph = S * 0.34;  // arch half-height
        g.fillStyle = i === 4 ? "#2a2440" : "#3a3048";
        rr(g, x - S * 0.05, 0, S * 0.1, y - ph, S * 0.02); g.fill(); rr(g, x - S * 0.05, y + ph, S * 0.1, H - y - ph, S * 0.02); g.fill();
        // pillars
        g.fillStyle = "#5a5470"; rr(g, x - S * 0.07, y - ph - S * 0.03, S * 0.14, S * 0.08, S * 0.02); g.fill(); rr(g, x - S * 0.07, y + ph - S * 0.05, S * 0.14, S * 0.08, S * 0.02); g.fill();
        if (!open) {
          g.fillStyle = "rgba(90,84,112,0.85)"; rr(g, x - S * 0.035, y - ph, S * 0.07, ph * 2, S * 0.01); g.fill();
          g.strokeStyle = "rgba(255,255,255,0.15)"; g.lineWidth = 2; for (let k = 1; k < 6; k++) { g.beginPath(); g.moveTo(x - S * 0.035, y - ph + k * ph * 2 / 6); g.lineTo(x + S * 0.035, y - ph + k * ph * 2 / 6); g.stroke(); }
          // lock badge: token shape + count
          g.save(); g.translate(x, y); g.fillStyle = "rgba(10,8,20,0.85)"; dot(g, 0, 0, S * 0.075); g.strokeStyle = b.tokenCol; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, S * 0.075, 0, TAU); g.stroke();
          g.fillStyle = b.tokenCol; g.shadowColor = b.tokenCol; g.shadowBlur = S * 0.02; g.save(); g.translate(0, -S * 0.02); SHAPE[b.token](g, S * 0.03); g.restore(); g.shadowBlur = 0;
          g.fillStyle = "#e6ecf5"; g.font = "800 " + Math.round(S * 0.026) + "px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(Math.min(save.tokens[i], b.need) + "/" + b.need, 0, S * 0.03); g.restore();
        } else { g.fillStyle = "rgba(127,224,160,0.12)"; rr(g, x - S * 0.035, y - ph, S * 0.07, ph * 2, S * 0.01); g.fill(); }
      }
      function drawCamp(i, x, y) {
        // campfire + the three smiths standing around it
        g.fillStyle = "rgba(0,0,0,0.25)"; ell(g, x, y + S * 0.05, S * 0.3, S * 0.09); g.fill();
        g.fillStyle = "#4a3448"; for (let k = 0; k < 3; k++) { g.save(); g.translate(x, y); g.rotate(k * 1.05); g.fillRect(-S * 0.04, -S * 0.006, S * 0.08, S * 0.012); g.restore(); }
        const fl = 0.8 + 0.2 * Math.sin(now * 0.02); g.fillStyle = "#ffb86b"; g.shadowColor = "#ff8f6b"; g.shadowBlur = S * 0.03; ell(g, x, y - S * 0.03, S * 0.02, S * 0.035 * fl); g.fill(); g.fillStyle = "#ffe9a0"; ell(g, x, y - S * 0.025, S * 0.01, S * 0.02 * fl); g.fill(); g.shadowBlur = 0;
        g.fillStyle = "rgba(255,184,107,0.06)"; dot(g, x, y, S * 0.3);
        smithPositions(i).forEach(function (sp0, k) { const sp = { x: sp0.x - cam.x, y: sp0.y - cam.y }; const sm = SMITHS[k]; drawShadow(sp.x, sp.y, S * 0.06, 0); drawFrog(g, sp.x, sp.y + Math.sin(now * 0.003 + k) * S * 0.003, S * 0.055, sp.x < x ? 1 : -1, now, { body: sm.body, dark: sm.dark, belly: sm.belly, warts: true, blink: ((now + k * 700) % 3300) < 150, helmet: k === 1 ? "#6b6689" : null });
          // icon above the head
          g.save(); g.translate(sp.x, sp.y - S * 0.13 + Math.sin(now * 0.004 + k) * S * 0.005); g.fillStyle = "rgba(10,8,20,0.7)"; dot(g, 0, 0, S * 0.03); g.fillStyle = k === 0 ? "#ff6b8a" : k === 1 ? "#74b9ff" : "#e0a3ff";
          if (k === 0) { g.strokeStyle = g.fillStyle; g.lineWidth = S * 0.008; g.lineCap = "round"; g.beginPath(); g.moveTo(-S * 0.015, S * 0.01); g.quadraticCurveTo(0, -S * 0.02, S * 0.016, -S * 0.005); g.stroke(); dot(g, S * 0.016, -S * 0.005, S * 0.006); }
          else if (k === 1) { g.beginPath(); g.moveTo(-S * 0.014, -S * 0.014); g.lineTo(S * 0.014, -S * 0.014); g.lineTo(S * 0.012, S * 0.006); g.lineTo(0, S * 0.016); g.lineTo(-S * 0.012, S * 0.006); g.closePath(); g.fill(); }
          else { rr(g, -S * 0.009, -S * 0.006, S * 0.018, S * 0.022, S * 0.005); g.fill(); g.fillRect(-S * 0.005, -S * 0.016, S * 0.01, S * 0.01); }
          g.restore(); });
      }
      function smithPositions(i) { const c = campPos(i); return [{ x: c.x - S * 0.2, y: c.y - S * 0.06 }, { x: c.x + S * 0.2, y: c.y - S * 0.06 }, { x: c.x, y: c.y - S * 0.2 }]; }

      function drawGround() {
        const x0 = cam.x, x1 = cam.x + S;
        for (let i = 0; i < 5; i++) {
          const bx0 = i * bw(), bx1 = (i + 1) * bw(); if (bx1 < x0 || bx0 > x1) continue;
          const b = BIOMES[i];
          g.fillStyle = b.ground; g.fillRect(Math.max(0, bx0 - cam.x), 0, Math.min(S, bx1 - cam.x) - Math.max(0, bx0 - cam.x), S);
        }
        if (inArena(x1)) { const ax = Math.max(0, gateX(4) - cam.x); g.fillStyle = "#231d3a"; g.fillRect(ax, 0, S - ax, S); const ty = H * 0.5 - cam.y; g.fillStyle = "#3a2a4a"; for (let k = -6; k <= 6; k++) { g.fillRect(ax, ty + k * S * 0.1 - 1, S - ax, 2); } }
        const cell = S * 0.075, i0 = Math.floor(cam.x / cell), j0 = Math.floor(cam.y / cell), n = Math.ceil(S / cell) + 2;
        for (let i = i0; i < i0 + n; i++) for (let j = j0; j < j0 + n; j++) {
          const h1 = hash(i, j), h2 = hash(j, i), wx = i * cell + h1 * cell, x = wx - cam.x, y = j * cell + h2 * cell - cam.y;
          if (inArena(wx)) continue;
          const b = BIOMES[biomeOf(wx)];
          if (h1 < 0.5) { g.fillStyle = "rgba(" + b.tuft + "," + (0.05 + h2 * 0.08) + ")"; ell(g, x, y, cell * 0.45, cell * 0.28); g.fill(); }
          if (h2 > 0.82) { g.strokeStyle = "rgba(" + b.tuft + ",0.35)"; g.lineWidth = Math.max(1, S * 0.003); g.lineCap = "round"; g.beginPath(); for (let t = -1; t <= 1; t++) { g.moveTo(x + t * cell * 0.07, y); g.lineTo(x + t * cell * 0.14 + Math.sin(now * 0.002 + i) * cell * 0.03, y - cell * 0.22); } g.stroke(); }
        }
        // ponds
        BIOMES.forEach(function (b, i) { b.ponds.forEach(function (q) { const cx = (i + q[0]) * bw() - cam.x, cy = q[1] * H - cam.y, rx = q[2] * bw(), ry = q[3] * H; if (cx + rx < -S * 0.1 || cx - rx > S * 1.1 || cy + ry < -S * 0.1 || cy - ry > S * 1.1) return;
          g.fillStyle = b.water; g.shadowColor = "#74b9ff"; g.shadowBlur = S * 0.04; ell(g, cx, cy, rx, ry); g.fill(); g.shadowBlur = 0;
          g.fillStyle = "rgba(255,255,255,0.06)"; ell(g, cx - rx * 0.15, cy - ry * 0.15, rx * 0.75, ry * 0.7); g.fill();
          g.strokeStyle = "rgba(191,233,255,0.2)"; g.lineWidth = 1; for (let k = 0; k < 3; k++) { const ph = now * 0.0006 + k * 2.1; g.beginPath(); g.ellipse(cx + Math.cos(ph) * rx * 0.3, cy + Math.sin(ph) * ry * 0.3, rx * 0.25, ry * 0.25, 0, 0, TAU); g.stroke(); }
          for (let k = 0; k < 4; k++) { const a = k * 1.6 + q[0] * 10, px = cx + Math.cos(a) * rx * 0.65, py = cy + Math.sin(a) * ry * 0.65, r = S * 0.028; g.fillStyle = "#3fa66a"; g.beginPath(); g.moveTo(px, py); g.arc(px, py, r, a + 0.3, a + TAU - 0.3); g.closePath(); g.fill(); } }); });
        if (inArena(x1)) { const ax = Math.max(0, gateX(4) + S * 0.2 - cam.x); g.fillStyle = "#2a3a6e"; g.fillRect(ax, 0, S, Math.max(0, H * 0.14 - cam.y)); g.fillRect(ax, H * 0.86 - cam.y, S, S); }
        ripples.forEach(function (r) { const k = r.t / r.dur; g.strokeStyle = "rgba(191,233,255," + (0.5 * (1 - k)) + ")"; g.lineWidth = Math.max(1, S * 0.003); g.beginPath(); g.ellipse(r.x - cam.x, r.y - cam.y, r.r * k, r.r * k * 0.5, 0, 0, TAU); g.stroke(); });
      }
      function drawHazards() {
        hazards.forEach(function (h) {
          const x = h.x - cam.x, y = h.y - cam.y;
          g.save();
          if (h.type === "ring") { g.strokeStyle = "#ffb86b"; g.shadowColor = "#ff8f6b"; g.shadowBlur = S * 0.02; g.lineWidth = h.w * 1.4; g.globalAlpha = 0.75; g.beginPath(); g.ellipse(x, y, h.r, h.r * 0.6, 0, 0, TAU); g.stroke(); g.lineWidth = 2; g.strokeStyle = "#fff"; g.globalAlpha = 0.5; g.stroke(); }
          else if (h.type === "wave") { g.fillStyle = "rgba(116,185,255,0.55)"; g.shadowColor = "#74b9ff"; g.shadowBlur = S * 0.03; rr(g, x - h.w, h.y0 - cam.y, h.w * 2, h.y1 - h.y0, h.w); g.fill(); g.fillStyle = "rgba(255,255,255,0.5)"; g.fillRect(x - h.w * 0.3, h.y0 - cam.y, h.w * 0.6, h.y1 - h.y0); }
          else if (h.type === "rock") { const k = Math.min(1, h.t / h.dur); if (!h.hit) { g.strokeStyle = "rgba(255,143,107," + (0.4 + 0.4 * Math.sin(now * 0.02)) + ")"; g.lineWidth = 2; g.setLineDash([6, 6]); g.beginPath(); g.ellipse(x, y, h.r, h.r * 0.6, 0, 0, TAU); g.stroke(); g.setLineDash([]); g.fillStyle = "#6b6689"; const ry = y - (1 - k) * S * 0.9; ell(g, x, ry, h.r * 0.6, h.r * 0.5); g.fill(); g.fillStyle = "#8a85a8"; ell(g, x - h.r * 0.15, ry - h.r * 0.15, h.r * 0.3, h.r * 0.2); g.fill(); } else { g.globalAlpha = 1 - (h.t - h.dur) / 300; g.fillStyle = "#6b6689"; ell(g, x, y, h.r * 0.6, h.r * 0.45); g.fill(); } }
          else if (h.type === "spit") { g.fillStyle = "#a8e6a0"; g.shadowColor = "#7fe0a0"; g.shadowBlur = S * 0.02; dot(g, x, y, S * 0.02); }
          else if (h.type === "web") { g.strokeStyle = "rgba(230,236,245,0.8)"; g.lineWidth = 1.5; for (let k = 0; k < 6; k++) { const a = k * TAU / 6 + h.t * 0.003; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * S * 0.03, y + Math.sin(a) * S * 0.03); g.stroke(); } g.beginPath(); g.arc(x, y, S * 0.018, 0, TAU); g.stroke(); }
          else if (h.type === "arc") { const k = h.t / h.dur; g.fillStyle = "rgba(255,255,255," + (0.35 * (1 - k)) + ")"; g.beginPath(); g.moveTo(x, y); g.arc(x, y, h.r, h.ang - 1.05, h.ang + 1.05); g.closePath(); g.fill(); }
          g.restore();
        });
      }
      function drawHpBar(x, y, w, hp, hpMax, col) { g.fillStyle = "rgba(0,0,0,0.5)"; rr(g, x - w / 2, y, w, S * 0.012, S * 0.006); g.fill(); g.fillStyle = col || "#ff6b6b"; rr(g, x - w / 2, y, w * clamp(hp / hpMax, 0, 1), S * 0.012, S * 0.006); g.fill(); }
      function drawThePlayer(x, y) {
        const f = p, R = frogR();
        const tongue = f.tongue ? { tx: f.tongue.tx, ty: f.tongue.ty, k: Math.sin(Math.min(1, f.tongue.t / f.tongue.dur) * Math.PI), col: has("fire") ? "#ff8f6b" : has("venom") ? "#a8e6a0" : "#ff6b8a", glow: has("fire") || has("venom") || has("royal"), fork: has("forked") } : null;
        const o = { blink: f.blink > 0, sq: f.sq, tongue: tongue, happy: f.happy > 0, hurt: f.hurt > 0 && Math.floor(now / 60) % 2 === 0, crown: save.won, armor: has("crownguard") ? "#ffd36b" : has("stone") ? "#8a85a8" : has("toadskin") ? "#5f9e5a" : null };
        if (f.iframes > 0 && Math.floor(now / 80) % 2 === 0 && !f.dead) g.globalAlpha = 0.5;
        if (f.swim) { const bob = Math.sin(now * 0.005) * R * 0.08; g.save(); g.beginPath(); g.rect(x - R * 3, y - R * 3, R * 6, R * 3.35 + bob); g.clip(); drawFrog(g, x, y + R * 0.3 + bob, R, f.face, now, o); g.restore(); g.strokeStyle = "rgba(191,233,255,0.6)"; g.lineWidth = Math.max(1.5, S * 0.004); ell(g, x, y + R * 0.35 + bob, R * 1.35, R * 0.5); g.stroke(); }
        else { drawShadow(x, y, R * 1.1, f.z); drawFrog(g, x, y - f.z * R * 1.6, R, f.face, now, o); }
        g.globalAlpha = 1;
        if (has("lily") && f.shieldCd <= 0) { g.strokeStyle = "rgba(116,185,255,0.5)"; g.lineWidth = 2; g.beginPath(); g.arc(x, y - R * 0.2, R * 1.7, 0, TAU); g.stroke(); }
        if (f.slow > 0) { g.strokeStyle = "rgba(230,236,245,0.6)"; g.lineWidth = 1.5; for (let k = 0; k < 5; k++) { const a = k * TAU / 5 + now * 0.002; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * R * 1.4, y + Math.sin(a) * R * 1.4); g.stroke(); } }
      }
      function drawWorld() {
        g.save();
        if (shake > 0) g.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
        drawGround();
        const items = [];
        const vis = function (x, y, m) { return x > cam.x - m && x < cam.x + S + m && y > cam.y - m && y < cam.y + S + m; };
        // decor (deterministic per biome)
        for (let i = 0; i < 5; i++) { const b = BIOMES[i]; if ((i + 1) * bw() < cam.x - S * 0.3 || i * bw() > cam.x + S * 1.3) continue;
          for (let k = 0; k < 14; k++) { const hx = (i + 0.05 + hash(k, i * 7 + 1) * 0.9) * bw(), hy = (0.06 + hash(i * 7 + 2, k) * 0.88) * H; if (!vis(hx, hy, S * 0.3)) continue; if (pondAt(hx, hy) || Math.hypot(hx - campPos(i).x, hy - campPos(i).y) < S * 0.4 || Math.abs(hx - gateX(i)) < S * 0.25 || (i === 4 && hx > gateX(4) - S * 0.5)) continue; if (i > 0 && Math.abs(hx - gateX(i - 1)) < S * 0.2) continue;
            const kind = hash(k, i) < 0.6 ? b.decor : hash(k, i) < 0.85 ? "rock" : "shroom"; items.push({ y: hy, f: (function (kind, hx, hy, k) { return function () { drawDecor(kind, hx - cam.x, hy - cam.y, 0.8 + hash(k, 99) * 0.6, k); }; })(kind, hx, hy, k) }); } }
        // castle towers flanking the arena
        if (inArena(cam.x + S)) { [[gateX(4) + S * 0.35, H * 0.18], [gateX(4) + S * 0.35, H * 0.82], [W - S * 0.3, H * 0.18], [W - S * 0.3, H * 0.82]].forEach(function (t) { items.push({ y: t[1], f: function () { drawDecor("castle", t[0] - cam.x, t[1] - cam.y, 1.3, 0); } }); }); }
        for (let i = 0; i < 5; i++) { const gx = gateX(i); if (vis(gx, H / 2, S * 0.5)) items.push({ y: -1e9, f: function () { drawGate(i, gx - cam.x, H / 2 - cam.y); } }); }
        for (let i = 0; i < 5; i++) { const c = campPos(i); if (vis(c.x, c.y, S * 0.5)) items.push({ y: c.y, f: function () { drawCamp(i, c.x - cam.x, c.y - cam.y); } }); }
        enemies.forEach(function (e) { if (e.dead || !vis(e.x, e.y, S * 0.4)) return; items.push({ y: e.y + (e.def.water ? -S : 0), f: function () { const x = e.x - cam.x, y = e.y - cam.y; if (!e.def.water) drawShadow(x, y, S * 0.05 * (e.def.size || 1), e.z || 0); drawEnemy(g, e, x, y - (e.z || 0) * S * 0.08, S, now); if (e.shield > 0) { g.strokeStyle = "rgba(116,185,255,0.8)"; g.lineWidth = 3; g.beginPath(); g.arc(x, y, S * 0.1 * (e.def.size || 1), 0, TAU); g.stroke(); } if (e.hp < e.hpMax || e.isMini) drawHpBar(x, y - S * 0.08 * (e.def.size || 1) - S * 0.03, S * 0.1 * (e.def.size || 1), e.hp, e.hpMax, e.isMini ? "#ffd36b" : "#ff6b6b"); if (e.poison > 0) { g.fillStyle = "#7fe0a0"; dot(g, x + S * 0.03, y - S * 0.06, S * 0.008); } if (e.fire > 0) { g.fillStyle = "#ff8f6b"; dot(g, x - S * 0.03 + Math.sin(now * 0.02) * S * 0.01, y - S * 0.07, S * 0.01); } } }); });
        if (boss && vis(boss.x, boss.y, S)) items.push({ y: boss.y, f: function () { const x = boss.x - cam.x, y = boss.y - cam.y, R = S * 0.05 * boss.def.size; drawShadow(x, y, R * 1.1, boss.z); drawEnemy(g, boss, x, y - boss.z * R * 0.9, S, now); const wp = bossWeakPoint(); if (wp) { const pulse = 0.6 + 0.4 * Math.sin(now * 0.015); g.fillStyle = "rgba(255,211,107," + (0.25 * pulse) + ")"; dot(g, wp.x - cam.x, wp.y - cam.y - boss.z * R * 0.9, S * 0.1); g.strokeStyle = "#ffd36b"; g.lineWidth = 3; g.shadowColor = "#ffd36b"; g.shadowBlur = S * 0.02; g.beginPath(); g.arc(wp.x - cam.x, wp.y - cam.y - boss.z * R * 0.9, S * 0.07 * pulse, 0, TAU); g.stroke(); g.shadowBlur = 0; } } });
        items.push({ y: p.y + (p.swim ? -S : 0), f: function () { drawThePlayer(p.x - cam.x, p.y - cam.y); } });
        items.sort(function (a, b) { return a.y - b.y; }); items.forEach(function (it) { it.f(); });
        prey.forEach(function (q) { if (vis(q.x, q.y, S * 0.1)) drawPrey(g, q.kind, q.x - cam.x, q.y - cam.y, q.def.r * S, now, q.ph); });
        drawHazards();
        // fx
        fx.forEach(function (e) {
          const k = e.t / e.dur, x = e.x - cam.x, y = e.y - cam.y; g.save();
          if (e.kind === "mark") { g.globalAlpha = 1 - k; g.strokeStyle = "#fff"; g.lineWidth = Math.max(1.5, S * 0.004); g.beginPath(); g.arc(x, y, S * 0.02 + k * S * 0.03, 0, TAU); g.stroke(); }
          else if (e.kind === "spark") { g.globalAlpha = 1 - k; g.fillStyle = e.col; dot(g, x, y, S * 0.006); }
          else if (e.kind === "conf") { g.globalAlpha = 1 - k; g.fillStyle = e.col; g.translate(x, y); g.rotate(e.rot); g.fillRect(-S * 0.008, -S * 0.005, S * 0.016, S * 0.01); }
          else if (e.kind === "gemtxt" || e.kind === "txt") { g.globalAlpha = 1 - k; g.fillStyle = e.col || "#ffd36b"; g.font = "800 " + Math.round(S * 0.026) + "px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(e.text, x, y - k * S * 0.06); }
          else if (e.kind === "token") { g.globalAlpha = 1 - k; g.translate(x, y - k * S * 0.1); g.scale(1 + k, 1 + k); g.fillStyle = e.col; g.shadowColor = e.col; g.shadowBlur = S * 0.02; SHAPE[e.shape](g, S * 0.02); }
          g.restore();
        });
        g.restore();
        drawHUD();
        if (panel) drawPanel();
      }

      // ---- HUD ----
      function drawHUD() {
        const bi = biomeOf(p.x), b = BIOMES[bi];
        // hearts
        for (let i = 0; i < save.hpMax; i++) { g.save(); g.translate(S * 0.045 + i * S * 0.042, S * 0.045); g.fillStyle = i < p.hp ? "#ff6b8a" : "rgba(255,255,255,0.15)"; if (i < p.hp) { g.shadowColor = "#ff6b8a"; g.shadowBlur = S * 0.012; } SHAPE.heart(g, S * 0.016); g.restore(); }
        // stamina
        g.fillStyle = "rgba(255,255,255,0.12)"; rr(g, S * 0.03, S * 0.075, S * 0.22, S * 0.014, S * 0.007); g.fill(); g.fillStyle = p.zip > 0 ? "#ffd36b" : "#74b9ff"; rr(g, S * 0.03, S * 0.075, S * 0.22 * p.stam / 100, S * 0.014, S * 0.007); g.fill();
        // biome + token progress (center)
        g.save(); g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "rgba(230,236,245,0.85)"; g.font = "700 " + Math.round(S * 0.024) + "px system-ui, sans-serif"; g.fillText(inArena(p.x) ? "The Castle" : b.name, S / 2, S * 0.035);
        g.translate(S / 2 - S * 0.035, S * 0.075); g.fillStyle = b.tokenCol; g.shadowColor = b.tokenCol; g.shadowBlur = S * 0.015; SHAPE[b.token](g, S * 0.016); g.shadowBlur = 0; g.fillStyle = "#e6ecf5"; g.font = "800 " + Math.round(S * 0.026) + "px system-ui, sans-serif"; g.textAlign = "left"; g.fillText(save.tokens[bi] + " / " + b.need, S * 0.03, 0); g.restore();
        // gems (right)
        g.save(); g.translate(S * 0.9, S * 0.045); g.fillStyle = "#74b9ff"; g.shadowColor = "#74b9ff"; g.shadowBlur = S * 0.015; SHAPE.gem(g, S * 0.018); g.shadowBlur = 0; g.fillStyle = "#e6ecf5"; g.font = "800 " + Math.round(S * 0.03) + "px system-ui, sans-serif"; g.textAlign = "right"; g.textBaseline = "middle"; g.fillText(String(save.gems), -S * 0.03, 0); g.restore();
        // potions (bottom-left)
        potionSlots().forEach(function (s) { g.save(); rr(g, s.x, s.y, s.w, s.h, S * 0.012); g.fillStyle = "rgba(10,8,20,0.7)"; g.fill(); g.strokeStyle = s.n ? s.col : "rgba(255,255,255,0.15)"; g.lineWidth = 2; g.stroke(); g.globalAlpha = s.n ? 1 : 0.3; g.fillStyle = s.col; g.translate(s.x + s.w / 2, s.y + s.h / 2 - S * 0.006); if (s.id === "heal") SHAPE.heart(g, S * 0.014); else if (s.id === "stam") SHAPE.bolt(g, S * 0.014); else drawPrey(g, "fly", 0, 0, S * 0.012, now, 0); g.globalAlpha = 1; g.fillStyle = "#e6ecf5"; g.font = "800 " + Math.round(S * 0.018) + "px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("×" + s.n, 0, S * 0.022); g.restore(); });
        // boss / mini-boss bar
        const big = boss || (mini && mini.biome === biomeOf(p.x) ? mini : null); if (big && !big.dead) { g.save(); g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#ffd36b"; g.font = "800 " + Math.round(S * 0.022) + "px system-ui, sans-serif"; g.fillText(big.name, S / 2, S * 0.115); drawHpBar(S / 2, S * 0.13, S * 0.5, big.hp, big.hpMax, boss ? "#ff6b8a" : "#ffd36b"); g.restore(); }
        // minimap strip
        const mw = S * 0.3, mh = S * 0.05, mx = S - mw - S * 0.025, my = S - mh - S * 0.025;
        g.save(); g.globalAlpha = 0.9; rr(g, mx, my, mw, mh, S * 0.01); g.fillStyle = "rgba(10,8,20,0.75)"; g.fill();
        BIOMES.forEach(function (bb, i) { g.fillStyle = bb.ground; g.fillRect(mx + i * mw / 5 + 1, my + 2, mw / 5 - 2, mh - 4); g.fillStyle = save.unlocked[i] || i === 4 ? bb.tokenCol : "rgba(255,255,255,0.25)"; if (i < 4) g.fillRect(mx + (i + 1) * mw / 5 - 1.5, my, 3, mh); });
        g.fillStyle = GREEN; g.shadowColor = GREEN; g.shadowBlur = 6; dot(g, mx + p.x / W * mw, my + p.y / H * mh, 4); g.restore();
        // toasts
        toasts.forEach(function (t, i) { const a = Math.min(1, t.t / 200) * (t.t > t.dur - 400 ? (t.dur - t.t) / 400 : 1); g.save(); g.globalAlpha = Math.max(0, a); g.font = "700 " + Math.round(S * 0.022) + "px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; const w = Math.min(S * 0.9, g.measureText(t.text).width + S * 0.05); rr(g, S / 2 - w / 2, S * 0.83 - i * S * 0.055 - S * 0.022, w, S * 0.044, S * 0.015); g.fillStyle = "rgba(10,8,20,0.8)"; g.fill(); g.fillStyle = t.col; g.fillText(t.text, S / 2, S * 0.83 - i * S * 0.055); g.restore(); });
        if (p.dead || fade > 0) { g.fillStyle = "rgba(10,8,20," + fade + ")"; g.fillRect(0, 0, S, S); }
      }
      function potionSlots() { return ["heal", "stam", "bait"].map(function (id, i) { return { id: id, n: save.potions[id] || 0, x: S * 0.03 + i * S * 0.075, y: S - S * 0.095, w: S * 0.065, h: S * 0.07, col: id === "heal" ? "#ff6b8a" : id === "stam" ? "#ffd36b" : "#a8e6a0" }; }); }

      // ---- shop panel ----
      function panelRows() { const tier = save.reach; return ITEMS.filter(function (it) { return it.kind === panel.kind && it.tier <= tier; }); }
      function panelGeom() { const px = S * 0.08, pw = S * 0.84, py = S * 0.12, rows = panelRows(), rh = Math.min(S * 0.075, (S * 0.7) / Math.max(1, rows.length)); return { px: px, pw: pw, py: py, ph: S * 0.14 + rows.length * rh, rh: rh, rows: rows, ry0: py + S * 0.11 }; }
      function drawPanel() {
        const G = panelGeom(), sm = SMITHS.findIndex(function (s) { return s.kind === panel.kind; });
        g.fillStyle = "rgba(0,0,0,0.45)"; g.fillRect(0, 0, S, S);
        rr(g, G.px, G.py, G.pw, G.ph, S * 0.03); g.fillStyle = "rgba(14,11,26,0.96)"; g.fill(); g.strokeStyle = "rgba(127,224,160,0.5)"; g.lineWidth = 2; g.stroke();
        drawFrog(g, G.px + S * 0.07, G.py + S * 0.06, S * 0.035, 1, now, { body: SMITHS[sm].body, dark: SMITHS[sm].dark, belly: SMITHS[sm].belly, warts: true, happy: true });
        g.save(); g.textBaseline = "middle"; g.fillStyle = "#e6ecf5"; g.font = "800 " + Math.round(S * 0.03) + "px system-ui, sans-serif"; g.fillText(SMITHS[sm].name, G.px + S * 0.13, G.py + S * 0.045);
        g.fillStyle = "rgba(230,236,245,0.6)"; g.font = "500 " + Math.round(S * 0.02) + "px system-ui, sans-serif"; g.fillText("\"" + SMITHS[sm].line + "\"  ·  you have " + save.gems + " gems", G.px + S * 0.13, G.py + S * 0.08);
        G.rows.forEach(function (it, i) {
          const y = G.ry0 + i * G.rh, owned = count(it.id), maxed = (!it.stack && !it.repeat && owned) || (it.repeat && owned >= it.repeat), can = save.gems >= it.cost && !maxed;
          rr(g, G.px + S * 0.03, y, G.pw - S * 0.06, G.rh - S * 0.008, S * 0.012); g.fillStyle = maxed ? "rgba(127,224,160,0.1)" : can ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)"; g.fill();
          g.fillStyle = maxed ? "#7fe0a0" : "#e6ecf5"; g.font = "700 " + Math.round(S * 0.022) + "px system-ui, sans-serif"; g.textAlign = "left"; g.fillText(it.name + (it.repeat ? "  (" + owned + "/" + it.repeat + ")" : it.stack ? "  ×" + (save.potions[it.id] || 0) : ""), G.px + S * 0.05, y + G.rh * 0.35);
          g.fillStyle = "rgba(230,236,245,0.6)"; g.font = "500 " + Math.round(S * 0.018) + "px system-ui, sans-serif"; g.fillText(it.desc, G.px + S * 0.05, y + G.rh * 0.7);
          g.textAlign = "right"; g.font = "800 " + Math.round(S * 0.024) + "px system-ui, sans-serif"; g.fillStyle = maxed ? "#7fe0a0" : can ? "#74b9ff" : "rgba(230,236,245,0.35)"; g.fillText(maxed ? "owned" : it.cost + " ◆", G.px + G.pw - S * 0.05, y + G.rh * 0.5);
        });
        g.restore();
        const c = panelClose(); g.save(); rr(g, c.x, c.y, c.w, c.h, S * 0.012); g.fillStyle = "rgba(255,255,255,0.08)"; g.fill(); g.fillStyle = "#e6ecf5"; g.font = "800 " + Math.round(S * 0.026) + "px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("✕", c.x + c.w / 2, c.y + c.h / 2); g.restore();
      }
      function panelClose() { const G = panelGeom(); return { x: G.px + G.pw - S * 0.075, y: G.py + S * 0.02, w: S * 0.055, h: S * 0.055 }; }
      function panelClick(x, y) {
        const G = panelGeom();
        if (inRect(panelClose(), x, y) || !inRect({ x: G.px, y: G.py, w: G.pw, h: G.ph }, x, y)) { panel = null; sndClick(); return; }
        G.rows.forEach(function (it, i) { const y0 = G.ry0 + i * G.rh; if (y >= y0 && y < y0 + G.rh) buy(it); });
      }

      function draw() {
        g.clearRect(0, 0, S, S);
        if (scene === "title") { drawTitle(); return; }
        if (cut) { drawCut(); return; }
        drawWorld();
      }

      // ---- input ----
      function leftClick(x, y) {
        if (scene === "title") { titleButtons().forEach(function (b) { if (inRect(b, x, y)) { sndClick(); beginGame(b.id === "new"); } }); return; }
        if (cut) { if (inRect(skipRect(), x, y)) endCut(); else cutNext(); return; }
        if (panel) { panelClick(x, y); return; }
        if (p.dead || fadeDir) return;
        const slot = potionSlots().find(function (s) { return inRect(s, x, y); }); if (slot) { usePotion(slot.id); return; }
        const wx = x + cam.x, wy = y + cam.y;
        // smiths
        const bi = biomeOf(p.x);
        for (let k = 0; k < 3; k++) { const sp = smithPositions(bi)[k]; if (Math.hypot(wx - sp.x, wy - (sp.y - S * 0.04)) < S * 0.1) { if (Math.hypot(p.x - sp.x, p.y - sp.y) < S * 0.32) { panel = { kind: SMITHS[k].kind }; sndClick(); } else { goTo(sp.x + (p.x < sp.x ? -1 : 1) * S * 0.16, sp.y + S * 0.06); toast("Hop closer to " + SMITHS[k].name + ".", "#e6ecf5"); } return; } }
        goTo(wx, wy);
      }
      function rightClick(x, y) { if (scene !== "world" || cut || panel || p.dead) return; strike(x + cam.x, y + cam.y); }

      function resize() {
        const oldS = S;
        S = Arcade.board.stageSize(880); dpr = window.devicePixelRatio || 1; W = 5 * BW * S; H = BH * S;
        canvas.style.width = S + "px"; canvas.style.height = S + "px";
        canvas.width = Math.round(S * dpr); canvas.height = Math.round(S * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (oldS && p) { const k = S / oldS; [p].concat(prey, enemies, boss ? [boss] : []).forEach(function (o) { o.x *= k; o.y *= k; if (o.hx !== undefined) { o.hx *= k; o.hy *= k; } if (o.tx !== undefined) { o.tx *= k; o.ty *= k; } }); hazards = []; cam.x *= k; cam.y *= k; }
      }

      return {
        mount(stage, c) {
          stageEl = stage; ctx = c;
          reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          const wrap = document.createElement("div");
          wrap.style.display = "flex"; wrap.style.flexDirection = "column"; wrap.style.alignItems = "center";
          canvas = document.createElement("canvas");
          canvas.style.borderRadius = "18px"; canvas.style.background = "#0e1a18"; canvas.style.cursor = "pointer";
          canvas.style.boxShadow = "0 0 46px rgba(127,224,160,0.14)"; canvas.style.touchAction = "none";
          g = canvas.getContext("2d");
          wrap.appendChild(canvas);
          const hint = document.createElement("div"); hint.className = "hint";
          hint.textContent = "Left-click: hop. Right-click: tongue. Hop over shockwaves. Click a smith to shop, click a potion to drink it.";
          wrap.appendChild(hint);
          stage.appendChild(wrap);
          ctxMenu = function (e) { e.preventDefault(); }; canvas.addEventListener("contextmenu", ctxMenu);
          now = 0; S = 0; scene = "title"; cut = null; panel = null; shake = 0; fade = 0; fadeDir = 0; toasts = []; fx = [];
          resize(); load();
          cam = { x: 0, y: 0 }; p = null;
          ctx.setScore(save.total || 0);
          Arcade.input.setPointerTarget(canvas);
          unResize = Arcade.board.onResize(function () { resize(); });
          Arcade._quest = { get: function () { return { scene: scene, cut: !!cut, panel: panel, p: p, save: save, cam: cam, S: S, W: W, H: H, prey: prey, enemies: enemies, boss: boss, mini: mini, hazards: hazards, gates: [0, 1, 2, 3, 4].map(gateX), camps: [0, 1, 2, 3, 4].map(campPos), smiths: p ? smithPositions(biomeOf(p.x)) : [] }; }, cheat: function (o) { Object.assign(save, o); markDirty(); persist(); } };
          draw();
        },
        handleInput(intent) {
          if (intent.type !== "point" || intent.phase !== "down") return;
          if (intent.button === 2) rightClick(intent.x, intent.y);
          else if (intent.button === 0) leftClick(intent.x, intent.y);
        },
        tick(dt) { update(Math.min(50, dt)); draw(); },
        getScore() { return save ? save.total : 0; },
        teardown() {
          if (dirty && p) persist();
          if (unResize) unResize(); unResize = null;
          if (canvas && ctxMenu) canvas.removeEventListener("contextmenu", ctxMenu); ctxMenu = null;
          if (window.Arcade) delete Arcade._quest;
          stageEl = ctx = canvas = g = null; prey = []; enemies = []; hazards = []; fx = []; ripples = []; toasts = []; boss = null; mini = null; p = null;
        }
      };
    }
  });
})();
