/* Pup Rescue — designed by Christopher (age 5), built for him. A spotted fire-pup
   keeps disappearing. Round 1: find him hiding under things, he's stuck in a case
   with a lock, find the key, drag it to the lock. Then he disappears again and it
   gets harder: lots of locks, lots of keys. Then he's a jigsaw puzzle — put him
   back together and something happens. Then a GHOST puts him in an INVISIBLE cage:
   tap around to find it (warmer/colder shimmer), tap the ghost to make him drop the
   keys. Then he sneaks back, grabs the pup and flies for the moon: CHASE him in the fire
   truck — every tap is a burst of speed; the ghost stays just ahead, then gets tired and
   stalls near the moon so Chris ALWAYS catches him (faster taps = sooner). Loops forever,
   harder each lap. No losing, no timer, no reading. */
(function () {
  const TAU = Math.PI * 2;
  const KEY_COLS = ["#ffd36b", "#ff8fd0", "#74b9ff", "#7fe0a0", "#c9c3ff", "#ffb86b"];
  const OBJ_KINDS = ["bush", "house", "barrel", "crate", "rock", "pot", "hay", "stump", "log"];

  // ---------- shared drawing (used by the game AND the hub icon) ----------
  function drawPup(g, x, y, r, o) {
    o = o || {};
    const t = o.t || 0, mood = o.mood || "happy", sc = o.scale || 1;
    g.save(); g.translate(x, y); g.scale(sc, sc);
    if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = r * 0.6; }
    // body peeking below the head
    g.fillStyle = "#f6f3ff"; g.beginPath(); g.ellipse(0, r * 1.05, r * 0.8, r * 0.55, 0, 0, TAU); g.fill();
    g.fillStyle = "#2a2434"; g.beginPath(); g.ellipse(-r * 0.35, r * 1.1, r * 0.16, r * 0.11, 0.4, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(r * 0.4, r * 1.25, r * 0.13, r * 0.09, -0.3, 0, TAU); g.fill();
    // collar
    g.fillStyle = "#e84f5a"; g.beginPath(); g.ellipse(0, r * 0.78, r * 0.62, r * 0.16, 0, 0, TAU); g.fill();
    g.fillStyle = "#ffd36b"; g.beginPath(); g.arc(0, r * 0.9, r * 0.1, 0, TAU); g.fill();
    // ears (black, floppy)
    g.fillStyle = "#2a2434";
    [-1, 1].forEach(function (d) { g.beginPath(); g.ellipse(d * r * 0.88, r * 0.05 + Math.sin(t * 0.004 + d) * r * 0.03, r * 0.3, r * 0.55, d * 0.35, 0, TAU); g.fill(); });
    // head
    const hg = g.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r * 1.15); hg.addColorStop(0, "#ffffff"); hg.addColorStop(1, "#e6e0f5");
    g.fillStyle = hg; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
    g.shadowBlur = 0;
    // spots
    g.fillStyle = "#2a2434";
    g.beginPath(); g.ellipse(-r * 0.62, -r * 0.1, r * 0.2, r * 0.26, 0.3, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(r * 0.55, r * 0.35, r * 0.15, r * 0.2, -0.4, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(r * 0.7, -r * 0.35, r * 0.12, r * 0.15, 0.2, 0, TAU); g.fill();
    // fire helmet (red dome + brim + yellow badge)
    g.save(); g.beginPath(); g.rect(-r * 1.4, -r * 1.6, r * 2.8, r * 1.15); g.clip();
    g.fillStyle = "#e84f5a"; g.beginPath(); g.arc(0, -r * 0.35, r * 1.02, 0, TAU); g.fill(); g.restore();
    g.fillStyle = "#c93c47"; g.beginPath(); g.ellipse(0, -r * 0.45, r * 1.18, r * 0.16, 0, 0, TAU); g.fill();
    g.fillStyle = "#e84f5a"; g.beginPath(); g.ellipse(0, -r * 0.5, r * 1.1, r * 0.1, 0, 0, TAU); g.fill();
    g.fillStyle = "#ffd36b"; g.beginPath(); g.moveTo(0, -r * 1.15); g.lineTo(r * 0.22, -r * 1.0); g.lineTo(r * 0.18, -r * 0.72); g.lineTo(0, -r * 0.64); g.lineTo(-r * 0.18, -r * 0.72); g.lineTo(-r * 0.22, -r * 1.0); g.closePath(); g.fill();
    // eyes
    const blink = Math.sin(t * 0.0025 + 1.3) > 0.975;
    g.fillStyle = "#2a2434";
    [-1, 1].forEach(function (d) {
      const ex = d * r * 0.36, ey = -r * 0.05;
      if (blink) { g.lineWidth = r * 0.08; g.strokeStyle = "#2a2434"; g.lineCap = "round"; g.beginPath(); g.moveTo(ex - r * 0.14, ey); g.lineTo(ex + r * 0.14, ey); g.stroke(); return; }
      g.beginPath(); g.ellipse(ex, ey, r * 0.17, mood === "sad" ? r * 0.2 : r * 0.22, 0, 0, TAU); g.fill();
      g.fillStyle = "#fff"; g.beginPath(); g.arc(ex - r * 0.06, ey - r * 0.08, r * 0.07, 0, TAU); g.fill(); g.fillStyle = "#2a2434";
      if (mood === "sad") { g.lineWidth = r * 0.06; g.strokeStyle = "#2a2434"; g.beginPath(); g.moveTo(ex - d * r * 0.16, ey - r * 0.32); g.lineTo(ex + d * r * 0.14, ey - r * 0.4); g.stroke(); }
    });
    // muzzle + nose + mouth
    g.fillStyle = "#fff"; g.beginPath(); g.ellipse(0, r * 0.42, r * 0.42, r * 0.32, 0, 0, TAU); g.fill();
    g.fillStyle = "#2a2434"; g.beginPath(); g.ellipse(0, r * 0.3, r * 0.15, r * 0.11, 0, 0, TAU); g.fill();
    g.strokeStyle = "#2a2434"; g.lineWidth = r * 0.06; g.lineCap = "round"; g.beginPath();
    if (mood === "sad") { g.arc(0, r * 0.75, r * 0.2, 1.2 * Math.PI, 1.8 * Math.PI); }
    else { g.moveTo(0, r * 0.4); g.lineTo(0, r * 0.52); g.moveTo(-r * 0.22, r * 0.5); g.quadraticCurveTo(0, r * 0.72, r * 0.22, r * 0.5); }
    g.stroke();
    if (mood === "happy" || mood === "party") { g.fillStyle = "#ff8fa3"; g.beginPath(); g.ellipse(r * 0.08, r * 0.66, r * 0.11, r * 0.14, 0, 0, TAU); g.fill(); }
    g.fillStyle = "rgba(255,120,150,0.3)"; [-1, 1].forEach(function (d) { g.beginPath(); g.ellipse(d * r * 0.62, r * 0.3, r * 0.16, r * 0.1, 0, 0, TAU); g.fill(); });
    g.restore();
  }
  function drawKey(g, x, y, r, col, ang) {
    g.save(); g.translate(x, y); g.rotate(ang || 0);
    g.shadowColor = col; g.shadowBlur = r * 0.5;
    g.strokeStyle = col; g.lineWidth = r * 0.28; g.lineCap = "round";
    g.beginPath(); g.arc(-r * 0.55, 0, r * 0.42, 0, TAU); g.stroke();
    g.beginPath(); g.moveTo(-r * 0.15, 0); g.lineTo(r * 0.95, 0); g.moveTo(r * 0.55, 0); g.lineTo(r * 0.55, r * 0.35); g.moveTo(r * 0.9, 0); g.lineTo(r * 0.9, r * 0.35); g.stroke();
    g.shadowBlur = 0; g.fillStyle = "#1a1626"; g.beginPath(); g.arc(-r * 0.55, 0, r * 0.18, 0, TAU); g.fill();
    g.restore();
  }
  function drawLock(g, x, y, r, col, open) {
    g.save(); g.translate(x, y - open * r * 0.6); g.globalAlpha = 1 - open * 0.9;
    g.shadowColor = col; g.shadowBlur = r * 0.4;
    g.strokeStyle = col; g.lineWidth = r * 0.22; g.lineCap = "round";
    g.beginPath(); g.arc(0, -r * 0.35 - open * r * 0.45, r * 0.42, Math.PI, TAU); g.stroke();
    if (open > 0.2) { g.beginPath(); g.moveTo(r * 0.42, -r * 0.35 - open * r * 0.45); g.lineTo(r * 0.42, -r * 0.1); g.stroke(); }
    else { g.beginPath(); g.moveTo(-r * 0.42, -r * 0.35); g.lineTo(-r * 0.42, 0); g.moveTo(r * 0.42, -r * 0.35); g.lineTo(r * 0.42, 0); g.stroke(); }
    const bg = g.createLinearGradient(0, -r * 0.2, 0, r * 0.7); bg.addColorStop(0, "#ffffff"); bg.addColorStop(0.15, col); bg.addColorStop(1, "#5a4a70");
    g.fillStyle = bg; g.shadowBlur = 0;
    g.beginPath(); g.roundRect(-r * 0.62, -r * 0.05, r * 1.24, r * 0.8, r * 0.16); g.fill();
    g.fillStyle = "#1a1626"; g.beginPath(); g.arc(0, r * 0.28, r * 0.12, 0, TAU); g.fill(); g.fillRect(-r * 0.05, r * 0.28, r * 0.1, r * 0.25);
    g.restore();
  }

  Arcade.register({
    id: "pup",
    name: "Pup Rescue",
    tagline: "Find the fire-pup, find the keys, open the locks. Then the ghost shows up.",
    accent: "#e84f5a",
    complexity: "low",
    controls: "drag",
    scoreLabel: "Rescues",
    kid: true,
    kidName: "Pup Rescue",
    kidIcon(g, s) {
      drawPup(g, s * 0.5, s * 0.5, s * 0.24, { glow: "#ff9fa8", mood: "happy" });
      drawKey(g, s * 0.8, s * 0.82, s * 0.09, "#ffd36b", -0.6);
    },
    create() {
      let ctx, canvas, g, unResize = null, offc = null;
      let S = 0, dpr = 1, reduced = false, now = 0;
      let rescues = 0, stars = 0;
      let phase = "intro", pt = 0, roundIdx = 0, spec = null;
      let objects = [], keys = [], particles = [], rings = [];
      let pup = { x: 0.5, y: 0.26, vis: 1, mood: "happy", hop: 0 };
      let cage = null, ghost = null, puzzle = null, drag = null, chase = null, sirenAt = -9999;
      let voiceAt = 0, hintAt = 0;
      const CAGE = { x: 0.5, y: 0.25, w: 0.34, h: 0.26 };

      // ---------- rounds: Chris's exact escalation ----------
      function roundSpec(i) {
        if (i === 0) return { type: "hide", locks: 1, objects: 6 };
        if (i === 1) return { type: "hide", locks: 3, objects: 8 };
        if (i === 2) return { type: "puzzle", cols: 2, rows: 2 };
        if (i === 3) return { type: "ghost", locks: 3, speed: 1 };
        if (i === 4) return { type: "chase", speed: 1 };
        const k = i - 5, lvl = Math.floor(k / 4) + 1;
        if (k % 4 === 0) return { type: "hide", locks: Math.min(6, 4 + lvl), objects: 9 };
        if (k % 4 === 1) return { type: "puzzle", cols: 3, rows: lvl >= 2 ? 3 : 2 };
        if (k % 4 === 2) return { type: "ghost", locks: Math.min(6, 3 + lvl), speed: 1 + 0.25 * lvl };
        return { type: "chase", speed: 1 + 0.3 * lvl };
      }

      let barkEl = null, barkAt = -9999;
      // real dog recording (audio/animals/dog.mp3, Wikimedia Commons — see audio/animals/CREDITS.md), shared with Farm
      function bark() { if (now - barkAt < 900) return; barkAt = now; try { if (!barkEl) { barkEl = new Audio("audio/animals/dog.mp3"); barkEl.preload = "auto"; barkEl.volume = 0.7; } barkEl.currentTime = 0; const p = barkEl.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {} }
      function say(parts, voice) { if (!Arcade.voice) return; if (now - voiceAt < 250) return; voiceAt = now; try { Arcade.voice.stop(); Arcade.voice.say(parts, voice || "jessica"); } catch (e) {} }

      // ---------- helpers ----------
      function resize() {
        S = Arcade.board.stageSize(880);
        dpr = window.devicePixelRatio || 1;
        canvas.style.width = S + "px"; canvas.style.height = S + "px";
        canvas.width = Math.round(S * dpr); canvas.height = Math.round(S * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (puzzle) renderPuzzleImage();
      }
      function puff(x, y, n, col, spd) {
        for (let i = 0; i < (reduced ? Math.ceil(n / 3) : n); i++) {
          const a = Math.random() * TAU, sp = (spd || 0.00025) * (0.4 + Math.random());
          particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.0001, life: 1, r: 0.006 + Math.random() * 0.01, col: col || KEY_COLS[i % KEY_COLS.length], shape: col ? "dot" : "rect" });
        }
      }
      function ring(x, y, col, max) { rings.push({ x: x, y: y, r: 0.01, max: max || 0.12, life: 1, col: col }); }
      function setPhase(p) { phase = p; pt = 0; }
      function addStar() { rescues++; stars++; ctx.setScore(rescues); ctx.storage.set("stars", stars); }

      // ---------- objects (hiding spots) ----------
      function layoutObjects(n) {
        objects = [];
        const cols = 3, rows = n > 6 ? 3 : 2;
        const x0 = 0.06, x1 = 0.94, y0 = 0.42, y1 = 0.84;
        const cw = (x1 - x0) / cols, ch = (y1 - y0) / rows;
        const kinds = OBJ_KINDS.slice().sort(function () { return Math.random() - 0.5; });
        let i = 0;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          if (i >= n) break;
          if (n === 8 && r === 2 && c === 1) { i++; continue; }
          objects.push({ x: x0 + cw * (c + 0.5) + (Math.random() - 0.5) * cw * 0.12, y: y0 + ch * (r + 0.62), r: Math.min(cw, ch) * 0.42, kind: kinds[i % kinds.length], lift: 0, state: "idle", t: 0, content: null, col: null, sway: Math.random() * TAU });
          i++;
        }
      }
      function hideStuff(kind, count) {
        const pool = objects.slice().sort(function () { return Math.random() - 0.5; });
        objects.forEach(function (o) { o.content = Math.random() < 0.3 ? "critter" : null; o.col = null; });
        for (let i = 0; i < count; i++) { pool[i].content = kind; pool[i].col = kind === "key" ? cage.locks[i].col : null; }
      }
      function tapObject(o) {
        if (o.state !== "idle") return;
        o.state = "lifting"; o.t = 0;
        ctx.audio.tone(300 + Math.random() * 80, 0.12, { type: "triangle", vol: 0.07, glide: 520 });
      }
      function revealObject(o) {
        if (o.content === "pup") {
          say("There he is!"); ctx.audio.arp([523, 659, 784], { dur: 0.14, step: 0.07, vol: 0.12 });
          pup.x = o.x; pup.y = o.y - o.r * 0.9; pup.vis = 1; pup.mood = "sad";
          cage = makeCage(spec.locks, o.x, o.y - o.r * 0.9, 0.55);
          cage.fly = { fx: o.x, fy: o.y - o.r * 0.9, t: 0 };
          o.content = null;
          setPhase("cageFly");
        } else if (o.content === "key") {
          spawnKey(o.col, o.x, o.y - o.r * 0.6);
          o.content = null;
          if (keys.filter(function (k) { return !k.used; }).length === 1 && cage.locks.filter(function (l) { return !l.open; }).length === 1) say("You found a key!");
        } else if (o.content === "critter") {
          ctx.audio.arp([784, 988, 1175], { dur: 0.1, step: 0.05, vol: 0.09 });
          for (let i = 0; i < 3; i++) particles.push({ x: o.x, y: o.y - o.r * 0.5, vx: (Math.random() - 0.5) * 0.0004, vy: -0.0003 - Math.random() * 0.0002, life: 1.6, r: 0.014, col: ["#ff8fd0", "#74b9ff", "#ffd36b"][i], shape: "fly", w: Math.random() * TAU });
          o.content = null;
        } else {
          ctx.audio.tone(330, 0.08, { type: "sine", vol: 0.04, glide: 400 });
          puff(o.x, o.y - o.r * 0.4, 5, "rgba(200,190,230,0.5)", 0.00012);
        }
      }
      function drawObject(o) {
        const x = o.x * S, y = o.y * S, r = o.r * S;
        const lift = o.lift, ly = y - lift * r * 1.5;
        const sway = Math.sin(now * 0.0015 + o.sway) * 0.03;
        // shadow / hole
        g.fillStyle = "rgba(0,0,0,0.35)"; g.beginPath(); g.ellipse(x, y + r * 0.25, r * 1.1, r * 0.3, 0, 0, TAU); g.fill();
        // content underneath (visible when lifted)
        if (lift > 0.25 && o.content) {
          const a = Math.min(1, (lift - 0.25) * 2);
          g.save(); g.globalAlpha = a;
          if (o.content === "pup") drawPup(g, x, y - r * 0.5, r * 0.5, { t: now, mood: "sad", glow: "#ff9fa8" });
          else if (o.content === "key") drawKey(g, x, y - r * 0.3, r * 0.45, o.col, -0.5);
          else if (o.content === "critter") { g.fillStyle = "#ff8fd0"; g.beginPath(); g.arc(x, y - r * 0.3, r * 0.22, 0, TAU); g.fill(); g.fillStyle = "#2a2434"; g.beginPath(); g.arc(x - r * 0.08, y - r * 0.35, r * 0.04, 0, TAU); g.arc(x + r * 0.08, y - r * 0.35, r * 0.04, 0, TAU); g.fill(); }
          g.restore();
        }
        g.save(); g.translate(x, ly); g.rotate(sway * (1 - lift)); g.scale(1 + lift * 0.05, 1 + lift * 0.05);
        g.shadowColor = "rgba(255,255,255,0.15)"; g.shadowBlur = r * 0.3;
        const k = o.kind;
        if (k === "bush") { g.fillStyle = "#3f9a6a"; [[-0.55, 0.05, 0.6], [0.5, 0.0, 0.6], [0, -0.35, 0.7], [0, 0.15, 0.75]].forEach(function (b) { g.beginPath(); g.arc(b[0] * r, b[1] * r, b[2] * r, 0, TAU); g.fill(); }); g.fillStyle = "#ff8fa3"; [[-0.4, -0.2], [0.35, -0.4], [0.1, 0.35]].forEach(function (p) { g.beginPath(); g.arc(p[0] * r, p[1] * r, r * 0.09, 0, TAU); g.fill(); }); }
        else if (k === "house") { g.fillStyle = "#d9534f"; g.fillRect(-r * 0.75, -r * 0.3, r * 1.5, r * 1.0); g.fillStyle = "#8b3a3a"; g.beginPath(); g.moveTo(-r * 0.95, -r * 0.3); g.lineTo(0, -r * 1.05); g.lineTo(r * 0.95, -r * 0.3); g.closePath(); g.fill(); g.fillStyle = "#1a1626"; g.beginPath(); g.arc(0, r * 0.25, r * 0.32, Math.PI, TAU); g.rect(-r * 0.32, r * 0.25, r * 0.64, r * 0.45); g.fill(); }
        else if (k === "barrel") { g.fillStyle = "#b07a45"; g.beginPath(); g.roundRect(-r * 0.62, -r * 0.8, r * 1.24, r * 1.5, r * 0.3); g.fill(); g.fillStyle = "#6b4a2b"; [-0.4, 0.3].forEach(function (yy) { g.fillRect(-r * 0.62, yy * r, r * 1.24, r * 0.12); }); }
        else if (k === "crate") { g.fillStyle = "#c9a25a"; g.fillRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4); g.strokeStyle = "#8a6a34"; g.lineWidth = r * 0.1; g.strokeRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4); g.beginPath(); g.moveTo(-r * 0.7, -r * 0.7); g.lineTo(r * 0.7, r * 0.7); g.moveTo(r * 0.7, -r * 0.7); g.lineTo(-r * 0.7, r * 0.7); g.stroke(); }
        else if (k === "rock") { g.fillStyle = "#8a86a8"; g.beginPath(); g.moveTo(-r * 0.8, r * 0.6); g.lineTo(-r * 0.7, -r * 0.3); g.lineTo(-r * 0.2, -r * 0.75); g.lineTo(r * 0.5, -r * 0.6); g.lineTo(r * 0.85, r * 0.1); g.lineTo(r * 0.7, r * 0.6); g.closePath(); g.fill(); g.fillStyle = "rgba(255,255,255,0.15)"; g.beginPath(); g.arc(-r * 0.2, -r * 0.3, r * 0.2, 0, TAU); g.fill(); }
        else if (k === "pot") { g.fillStyle = "#d97a4a"; g.beginPath(); g.moveTo(-r * 0.6, -r * 0.1); g.lineTo(r * 0.6, -r * 0.1); g.lineTo(r * 0.45, r * 0.7); g.lineTo(-r * 0.45, r * 0.7); g.closePath(); g.fill(); g.fillRect(-r * 0.7, -r * 0.3, r * 1.4, r * 0.25); g.fillStyle = "#7fe0a0"; g.beginPath(); g.arc(0, -r * 0.55, r * 0.35, 0, TAU); g.fill(); g.fillStyle = "#ffd36b"; g.beginPath(); g.arc(0, -r * 0.75, r * 0.18, 0, TAU); g.fill(); }
        else if (k === "hay") { g.fillStyle = "#e6c15a"; g.beginPath(); g.arc(0, 0, r * 0.85, Math.PI, TAU); g.rect(-r * 0.85, 0, r * 1.7, r * 0.6); g.fill(); g.strokeStyle = "#b8922e"; g.lineWidth = r * 0.06; [-0.4, 0, 0.4].forEach(function (xx) { g.beginPath(); g.moveTo(xx * r, -r * 0.6); g.lineTo(xx * r + r * 0.1, r * 0.5); g.stroke(); }); }
        else if (k === "stump") { g.fillStyle = "#8a5a3a"; g.beginPath(); g.roundRect(-r * 0.6, -r * 0.4, r * 1.2, r * 1.1, r * 0.15); g.fill(); g.fillStyle = "#d9b283"; g.beginPath(); g.ellipse(0, -r * 0.4, r * 0.6, r * 0.28, 0, 0, TAU); g.fill(); g.strokeStyle = "#a8825a"; g.lineWidth = r * 0.05; g.beginPath(); g.ellipse(0, -r * 0.4, r * 0.35, r * 0.15, 0, 0, TAU); g.stroke(); }
        else { g.fillStyle = "#7a5238"; g.beginPath(); g.roundRect(-r * 0.95, -r * 0.35, r * 1.9, r * 0.75, r * 0.35); g.fill(); g.fillStyle = "#d9b283"; g.beginPath(); g.ellipse(r * 0.92, 0, r * 0.14, r * 0.36, 0, 0, TAU); g.fill(); }
        g.restore();
      }

      // ---------- cage + locks + keys ----------
      function makeCage(n, x, y, scale) {
        const locks = [];
        for (let i = 0; i < n; i++) {
          // ≤3 locks hang on the bottom bar; extras sit on the top bar — the pup's face stays visible
          const row = i < 3 ? 0 : 1, cnt = row === 0 ? Math.min(3, n) : n - 3, j = row === 0 ? i : i - 3;
          const u = cnt === 1 ? 0.5 : j / (cnt - 1);
          locks.push({ col: KEY_COLS[i], open: 0, opening: false, lx: -0.36 + u * 0.72, ly: row === 0 ? 0.88 : 0.02 });
        }
        return { x: x, y: y, w: CAGE.w, h: CAGE.h, scale: scale || 1, locks: locks, vis: 1, open: 0, shake: 0 };
      }
      function spawnKey(col, x, y) {
        const k = { col: col, x: x, y: y, hx: 0, hy: 0.945, vx: 0, vy: 0, used: false, fly: 1, ang: -0.4 };
        keys.push(k); layoutTray();
        ctx.audio.arp([660, 880, 1320], { dur: 0.12, step: 0.06, vol: 0.12 });
        puff(x, y, 10, col, 0.0002);
      }
      function layoutTray() {
        const live = keys.filter(function (k) { return !k.used; });
        live.forEach(function (k, i) { k.hx = 0.5 + (i - (live.length - 1) / 2) * 0.13; });
      }
      function cageRect() { const w = cage.w * cage.scale, h = cage.h * cage.scale; return { x: cage.x - w / 2, y: cage.y - h / 2, w: w, h: h }; }
      function inCage(x, y, pad) { const r = cageRect(); pad = pad || 0.05; return x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad; }
      function tryUnlock(k) {
        const lock = cage.locks.find(function (l) { return !l.open && !l.opening && l.col === k.col; });
        if (!lock) return false;
        lock.opening = true; k.used = true; layoutTray();
        ctx.audio.tone(1200, 0.06, { vol: 0.1 }); ctx.audio.arp([784, 1046, 1568], { dur: 0.14, step: 0.07, vol: 0.12, when: 0.08 });
        const r = cageRect(); puff(r.x + r.w * (0.5 + lock.lx), r.y + r.h * lock.ly, 14, lock.col, 0.0003);
        cage.vis = 1; cage.shake = 1;
        return true;
      }
      function drawCage() {
        if (!cage) return;
        const r = cageRect(), x = r.x * S, y = r.y * S, w = r.w * S, h = r.h * S;
        const vis = cage.vis;
        g.save();
        const sh = cage.shake * Math.sin(now * 0.05) * S * 0.006; g.translate(sh, 0);
        // pup inside
        if (pup.vis > 0 && cage.open < 1 && vis > 0.01) { g.save(); g.globalAlpha = pup.vis * vis; drawPup(g, x + w / 2, y + h * 0.5 - Math.abs(Math.sin(now * 0.004)) * h * 0.03, h * 0.26, { t: now, mood: cage.open > 0 ? "happy" : "sad" }); g.restore(); }
        if (vis <= 0.01) { g.restore(); return; }
        g.globalAlpha = vis;
        // glass box
        const gl = g.createLinearGradient(x, y, x + w, y + h); gl.addColorStop(0, "rgba(150,200,255,0.22)"); gl.addColorStop(1, "rgba(200,150,255,0.12)");
        g.fillStyle = gl; g.beginPath(); g.roundRect(x, y, w, h, S * 0.02); g.fill();
        // bars (door swings open with cage.open)
        g.strokeStyle = "rgba(220,225,255,0.85)"; g.lineWidth = Math.max(2, S * 0.008); g.lineCap = "round";
        g.shadowColor = "#c9c3ff"; g.shadowBlur = S * 0.02;
        const bars = 6;
        g.save(); g.translate(x, y); g.scale(1 - cage.open, 1);
        for (let i = 0; i <= bars; i++) { const bx = (i / bars) * w; g.beginPath(); g.moveTo(bx, S * 0.006); g.lineTo(bx, h - S * 0.006); g.stroke(); }
        g.restore();
        g.beginPath(); g.roundRect(x, y, w, h, S * 0.02); g.stroke();
        g.shadowBlur = 0;
        // locks
        cage.locks.forEach(function (l) { drawLock(g, x + w * (0.5 + l.lx), y + h * l.ly, h * 0.24, l.col, l.open); });
        g.restore();
      }
      function drawKeys() {
        keys.forEach(function (k) {
          if (k.used) return;
          const r = S * 0.05;
          if (k === (drag && drag.key)) { g.save(); g.shadowColor = k.col; g.shadowBlur = S * 0.03; drawKey(g, k.x * S, k.y * S, r * 1.15, k.col, k.ang); g.restore(); }
          else drawKey(g, k.x * S, k.y * S, r, k.col, k.ang + Math.sin(now * 0.003 + k.hx * 20) * 0.08);
        });
      }
      function drawTray() {
        if (!keys.some(function (k) { return !k.used; })) return;
        g.fillStyle = "rgba(255,255,255,0.06)"; g.beginPath(); g.roundRect(S * 0.08, S * 0.895, S * 0.84, S * 0.095, S * 0.03); g.fill();
      }

      // ---------- puzzle ----------
      function renderPuzzleImage() {
        const F = Math.round(puzzle.size * S * dpr);
        if (!offc) offc = document.createElement("canvas");
        offc.width = F; offc.height = F;
        const og = offc.getContext("2d");
        og.clearRect(0, 0, F, F);
        const bg = og.createRadialGradient(F / 2, F / 2, F * 0.1, F / 2, F / 2, F * 0.7); bg.addColorStop(0, "#3a2a5a"); bg.addColorStop(1, "#1c1630");
        og.fillStyle = bg; og.fillRect(0, 0, F, F);
        drawPup(og, F / 2, F * 0.5, F * 0.27, { mood: "happy", glow: "#ff9fa8" });
      }
      function makePuzzle(cols, rows) {
        puzzle = { cols: cols, rows: rows, size: 0.44, x: 0.28, y: 0.11, pieces: [], done: false, t: 0 };
        renderPuzzleImage();
        const pw = puzzle.size / cols, ph = puzzle.size / rows;
        // scatter slots: a loose grid under the frame so pieces barely overlap
        const slots = []; const sc = cols, sr = rows, sx0 = 0.05, sw = 0.9 / sc, sy0 = 0.58, sh = 0.4 / sr;
        for (let r = 0; r < sr; r++) for (let c = 0; c < sc; c++) slots.push({ x: sx0 + sw * c + (sw - pw) * (0.3 + Math.random() * 0.4), y: sy0 + sh * r + Math.max(0, sh - ph) * Math.random() });
        slots.sort(function () { return Math.random() - 0.5; });
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const sl = slots.pop();
          puzzle.pieces.push({ c: c, r: r, w: pw, h: ph, hx: puzzle.x + c * pw, hy: puzzle.y + r * ph, x: Math.min(1 - pw, sl.x), y: Math.min(1 - ph, sl.y), placed: false, wob: Math.random() * TAU });
        }
        puzzle.pieces.sort(function () { return Math.random() - 0.5; });
      }
      function drawPuzzle() {
        if (!puzzle || !offc) return;
        const F = puzzle.size * S, px = puzzle.x * S, py = puzzle.y * S;
        const done = puzzle.done, dt = puzzle.t;
        g.save();
        if (done) { const s = 1 + Math.sin(dt * 0.006) * 0.04; g.translate(px + F / 2, py + F / 2); g.scale(s, s); g.translate(-px - F / 2, -py - F / 2); g.shadowColor = "#ffd36b"; g.shadowBlur = S * 0.05; }
        // frame
        g.fillStyle = "rgba(255,255,255,0.05)"; g.beginPath(); g.roundRect(px - S * 0.012, py - S * 0.012, F + S * 0.024, F + S * 0.024, S * 0.02); g.fill();
        g.strokeStyle = "rgba(255,255,255,0.35)"; g.setLineDash(done ? [] : [S * 0.015, S * 0.012]); g.lineWidth = S * 0.005;
        g.beginPath(); g.roundRect(px - S * 0.012, py - S * 0.012, F + S * 0.024, F + S * 0.024, S * 0.02); g.stroke(); g.setLineDash([]);
        // slot grid
        if (!done) { g.strokeStyle = "rgba(255,255,255,0.12)"; puzzle.pieces.forEach(function (p) { g.strokeRect(p.hx * S, p.hy * S, p.w * S, p.h * S); }); }
        // pieces: placed first, then loose, dragged on top
        const order = puzzle.pieces.slice().sort(function (a, b) { return (a.placed ? 0 : 1) - (b.placed ? 0 : 1) || ((drag && drag.piece === a) ? 1 : 0) - ((drag && drag.piece === b) ? 1 : 0); });
        order.forEach(function (p) {
          const sx = p.c * offc.width / puzzle.cols, sy = p.r * offc.height / puzzle.rows, sw = offc.width / puzzle.cols, shh = offc.height / puzzle.rows;
          const dx = p.x * S, dy = p.y * S + (p.placed ? 0 : Math.sin(now * 0.002 + p.wob) * S * 0.004), dw = p.w * S, dh = p.h * S;
          g.save();
          if (!p.placed) { g.shadowColor = "rgba(0,0,0,0.6)"; g.shadowBlur = S * 0.02; g.shadowOffsetY = S * 0.006; }
          if (drag && drag.piece === p) { g.shadowColor = "#ffd36b"; g.shadowBlur = S * 0.03; }
          g.beginPath(); g.roundRect(dx, dy, dw, dh, done ? 0 : S * 0.008); g.clip();
          g.drawImage(offc, sx, sy, sw, shh, dx, dy, dw, dh);
          g.restore();
          if (!done) { g.strokeStyle = p.placed ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.7)"; g.lineWidth = S * 0.004; g.strokeRect(dx, dy, dw, dh); }
        });
        g.restore();
        if (done) {
          // "something happens": siren lights + rainbow rings
          const cx = px + F / 2, cy = py + F / 2;
          for (let i = 0; i < 3; i++) { const rr = ((dt * 0.00025 + i / 3) % 1); g.save(); g.globalAlpha = (1 - rr) * 0.5; g.strokeStyle = KEY_COLS[i * 2]; g.lineWidth = S * 0.01; g.beginPath(); g.arc(cx, cy, F * 0.5 + rr * S * 0.35, 0, TAU); g.stroke(); g.restore(); }
          const red = Math.sin(dt * 0.01) > 0;
          g.save(); g.globalAlpha = 0.5; g.shadowBlur = S * 0.04;
          g.fillStyle = red ? "#ff4d5e" : "#4d8dff"; g.shadowColor = g.fillStyle; g.beginPath(); g.arc(px - S * 0.012, py - S * 0.012, S * 0.02, 0, TAU); g.fill();
          g.fillStyle = red ? "#4d8dff" : "#ff4d5e"; g.shadowColor = g.fillStyle; g.beginPath(); g.arc(px + F + S * 0.012, py - S * 0.012, S * 0.02, 0, TAU); g.fill(); g.restore();
        }
      }

      // ---------- ghost ----------
      function makeGhost(n, speed) {
        return { x: 0.15, y: 0.2, tx: 0.5, ty: 0.25, keys: n, speed: speed, t: 0, alpha: 0, jolt: 0, gone: false, wob: 0 };
      }
      function drawGhost() {
        if (!ghost || ghost.alpha <= 0) return;
        const x = ghost.x * S, y = ghost.y * S + Math.sin(now * 0.003) * S * 0.01, r = S * 0.075;
        g.save(); g.globalAlpha = ghost.alpha;
        g.shadowColor = "#c9c3ff"; g.shadowBlur = r * 0.6;
        const gg = g.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r * 1.3); gg.addColorStop(0, "#ffffff"); gg.addColorStop(1, "#d8d2ff");
        g.fillStyle = gg;
        g.beginPath(); g.arc(x, y - r * 0.2, r, Math.PI, TAU);
        g.lineTo(x + r, y + r * 0.6);
        for (let i = 4; i >= 0; i--) { const wx = x - r + (i / 4) * r * 2, wy = y + r * 0.6 + Math.sin(now * 0.008 + i * 1.7) * r * 0.12 + (i % 2 ? r * 0.28 : 0); g.lineTo(wx, wy); }
        g.closePath(); g.fill(); g.shadowBlur = 0;
        g.fillStyle = "#2a2434";
        [-1, 1].forEach(function (d) { g.beginPath(); g.ellipse(x + d * r * 0.35, y - r * 0.3, r * 0.14, r * 0.2, 0, 0, TAU); g.fill(); });
        g.beginPath(); g.ellipse(x, y + r * 0.1, r * 0.14, ghost.jolt > 0 ? r * 0.22 : r * 0.12, 0, 0, TAU); g.fill();
        g.fillStyle = "rgba(255,150,180,0.35)"; [-1, 1].forEach(function (d) { g.beginPath(); g.ellipse(x + d * r * 0.62, y, r * 0.14, r * 0.09, 0, 0, TAU); g.fill(); });
        // dangling keys
        for (let i = 0; i < ghost.keys; i++) { const kx = x - r * 0.6 + (i / Math.max(1, ghost.keys - 1)) * r * 1.2 * (ghost.keys > 1 ? 1 : 0), ky = y + r * 1.15 + Math.sin(now * 0.005 + i) * r * 0.08; drawKey(g, kx, ky, r * 0.28, cage.locks[i].col, Math.PI / 2); }
        g.restore();
      }
      function updateGhost(dt) {
        const gh = ghost; gh.t += dt;
        if (gh.gone) { gh.y -= dt * 0.0004; gh.alpha = Math.max(0, gh.alpha - dt / 1200); return; }
        gh.alpha = Math.min(1, gh.alpha + dt / 600);
        if (gh.jolt > 0) gh.jolt -= dt / 500;
        const sp = 0.00018 * gh.speed * (gh.jolt > 0 ? 3 : 1);
        const dx = gh.tx - gh.x, dy = gh.ty - gh.y, d = Math.hypot(dx, dy);
        if (d < 0.02) { gh.tx = 0.12 + Math.random() * 0.76; gh.ty = 0.1 + Math.random() * 0.62; }
        else { gh.x += dx / d * sp * dt; gh.y += dy / d * sp * dt; }
      }

      // ---------- round flow ----------
      function startRound() {
        spec = roundSpec(roundIdx);
        objects = []; keys = []; cage = null; ghost = null; puzzle = null; drag = null; chase = null;
        pup = { x: CAGE.x, y: CAGE.y, vis: 1, mood: "happy", hop: 0 };
        if (spec.type === "chase") { ghost = makeGhost(0, spec.speed); ghost.x = -0.15; ghost.y = 0.2; ghost.alpha = 1; chase = { gx: 0.14, tx: 0.06, vel: 0, boost: 0, hasPup: false, caught: false, t: 0, taps: 0, hinted: false, lastTap: 0, tired: 0 }; setPhase("chaseIn"); }
        else if (spec.type === "ghost") { cage = makeCage(spec.locks, 0.2 + Math.random() * 0.6, 0.45 + Math.random() * 0.3, 0.75); cage.vis = 0; ghost = makeGhost(spec.locks, spec.speed); setPhase("ghostIn"); }
        else setPhase("intro");
      }
      function update(dt) {
        now += dt; pt += dt;
        if (cage && cage.shake > 0) cage.shake = Math.max(0, cage.shake - dt / 400);
        // ---- phases
        if (phase === "intro") {
          pup.hop = Math.abs(Math.sin(pt * 0.006)) * 0.02;
          if (pt > 400 && pt < 400 + dt) bark();
          if (pt > 2000 && pup.vis > 0) {
            puff(pup.x, pup.y, 24, "rgba(220,215,255,0.8)", 0.0003); pup.vis = 0;
            ctx.audio.tone(420, 0.35, { type: "triangle", vol: 0.08, glide: 90 });
            say("Oh no! Where did the puppy go?");
          }
          if (pt > 3400) {
            if (spec.type === "puzzle") { makePuzzle(spec.cols, spec.rows); setPhase("puzzle"); say("Put the puppy back together!"); }
            else { layoutObjects(spec.objects); hideStuff("pup", 1); setPhase("find"); say("Find the puppy!"); }
          }
        } else if (phase === "cageFly") {
          const f = cage.fly; f.t += dt; const u = Math.min(1, f.t / 900), e = 1 - Math.pow(1 - u, 3);
          cage.x = f.fx + (CAGE.x - f.fx) * e; cage.y = f.fy + (CAGE.y - f.fy) * e; cage.scale = 0.55 + 0.45 * e;
          pup.x = cage.x; pup.y = cage.y;
          if (u >= 1) { setPhase("keys"); hideStuff("key", spec.locks); say(spec.locks > 1 ? "Find the keys!" : "Find the key!"); }
        } else if (phase === "keys" || phase === "ghost") {
          if (cage.locks.every(function (l) { return l.open >= 1; }) && cage.open === 0) { cage.open = 0.001; }
          if (cage.open > 0) {
            cage.open = Math.min(1, cage.open + dt / 500);
            if (cage.open >= 1 && pt > 0) {
              setPhase("freed"); pup.mood = "party"; pup.x = cage.x; pup.y = cage.y; addStar();
              ctx.audio.arp([523, 659, 784, 1046, 1318], { dur: 0.2, step: 0.08, vol: 0.14 });
              say(["You saved him!", "Hooray!"]); setTimeout(function () { if (ctx) bark(); }, 1800); puff(cage.x, cage.y, 60, null, 0.0005);
              if (ghost) { ghost.gone = true; ghost.keys = 0; setTimeout(function () { if (ctx) say("Bye bye!", "callum"); }, 1200); }
            }
          }
          if (phase === "ghost") {
            updateGhost(dt);
            if (pt > 1200 && now - hintAt > 2600 && cage.vis < 1) { hintAt = now; ctx.audio.tone(700, 0.18, { type: "sine", vol: 0.05, glide: 500 }); ring(cage.x, cage.y, "rgba(255,255,255,0.35)", 0.05); }
          }
        } else if (phase === "ghostIn") {
          updateGhost(dt);
          ghost.tx = CAGE.x; ghost.ty = CAGE.y - 0.1;
          if (pt > 700 && pt < 700 + dt) say(["Boo!", "Hee hee hee!"], "callum");
          if (pt > 1800 && pup.vis > 0) { pup.vis = 0; for (let i = 0; i < 20; i++) particles.push({ x: pup.x, y: pup.y, vx: (Math.random() - 0.5) * 0.0003, vy: (Math.random() - 0.5) * 0.0003, life: 1.2, r: 0.006, col: "#c9c3ff", shape: "dot" }); ctx.audio.tone(260, 0.5, { type: "sine", vol: 0.07, glide: 130 }); say("Uh oh! A ghost!"); }
          if (pt > 3000) { ghost.tx = Math.random(); ghost.ty = 0.3; setPhase("ghost"); pup.vis = 1; pup.mood = "sad"; say("The cage is invisible! Tap to find it!"); }
        } else if (phase === "chaseIn") {
          // the ghost sneaks back, grabs the pup, flies off toward the moon
          pup.hop = Math.abs(Math.sin(pt * 0.006)) * 0.02;
          ghost.tx = pup.x; ghost.ty = pup.y - 0.02; updateGhost(dt); ghost.alpha = 1;
          const near = Math.hypot(ghost.x - pup.x, ghost.y - pup.y) < 0.04;
          if (!chase.hasPup && (near || pt > 2200)) { chase.hasPup = true; pup.vis = 0; say(["Boo!", "Hee hee hee!"], "callum"); ctx.audio.tone(260, 0.5, { type: "sine", vol: 0.07, glide: 130 }); puff(pup.x, pup.y, 16, "#c9c3ff", 0.0002); setTimeout(function () { if (ctx) say("Oh no! He's taking the puppy!"); }, 1300); }
          if (chase.hasPup && pt > 3600) { setPhase("chase"); chase.lastTap = now; say("Catch the ghost!"); }
        } else if (phase === "chase") {
          const c = chase; c.t += dt;
          // truck: taps add speed, speed bleeds off
          c.vel = Math.max(0, c.vel - c.vel * dt / 380);
          c.tx = Math.min(0.9, c.tx + c.vel * dt);
          c.boost = Math.max(0, c.boost - dt / 250);
          // ghost: stays just ahead, then gets TIRED near the moon and stalls until caught — Chris always wins
          const gap = c.gx - c.tx, base = 0.00024 * spec.speed;
          let gs = gap > 0.3 ? 0.25 : gap > 0.15 ? 0.75 : 1.2;
          if (c.gx > 0.72) { c.tired = Math.min(1, c.tired + dt / 1500); gs *= Math.max(0, (0.9 - c.gx) / 0.18) * (1 - c.tired); }
          c.gx = Math.min(0.9, c.gx + base * gs * dt);
          ghost.x = c.gx; ghost.y = 0.3 + (c.tired > 0.5 ? Math.sin(now * 0.02) * 0.006 : 0); ghost.alpha = 1;
          if (!c.hinted && now - c.lastTap > 3500) { c.hinted = true; say("Tap fast!"); }
          if (c.tx >= c.gx - 0.06) {
            c.caught = true; pup.vis = 1; pup.mood = "party"; pup.x = c.tx; pup.y = 0.56;
            ghost.gone = true; ghost.tx = c.gx; setPhase("chaseDone"); addStar();
            ctx.audio.arp([523, 659, 784, 1046, 1318], { dur: 0.2, step: 0.08, vol: 0.14 });
            say(["Gotcha!", "You saved him!"]); setTimeout(function () { if (ctx) bark(); }, 1800);
            puff(c.tx, 0.6, 60, null, 0.0005);
          }
        } else if (phase === "chaseDone") {
          updateGhost(dt);
          chase.tx = Math.min(1.2, chase.tx + 0.00012 * dt); pup.x = chase.tx; pup.hop = Math.abs(Math.sin(pt * 0.008)) * 0.02;
          if (pt > 3400) { roundIdx++; startRound(); }
        } else if (phase === "freed") {
          pup.hop = Math.abs(Math.sin(pt * 0.008)) * 0.05;
          if (pt > 3200) { roundIdx++; startRound(); }
        } else if (phase === "puzzle") {
          if (puzzle.done) {
            puzzle.t += dt;
            if (puzzle.t > 4200) { roundIdx++; startRound(); }
          }
        }
        // ---- objects
        objects.forEach(function (o) {
          o.t += dt;
          if (o.state === "lifting") { o.lift = Math.min(1, o.lift + dt / 240); if (o.lift >= 1) { o.state = "open"; o.t = 0; revealObject(o); } }
          else if (o.state === "open") { if (o.t > 800) o.state = "drop"; }
          else if (o.state === "drop") { o.lift = Math.max(0, o.lift - dt / 300); if (o.lift <= 0) o.state = "idle"; }
        });
        // ---- keys glide home / follow drag
        keys.forEach(function (k) {
          if (k.used) return;
          if (drag && drag.key === k) return;
          const dx = k.hx - k.x, dy = k.hy - k.y;
          k.x += dx * Math.min(1, dt / 160); k.y += dy * Math.min(1, dt / 160);
          k.ang += (-0.4 - k.ang) * Math.min(1, dt / 200);
        });
        // ---- locks animate open
        if (cage) cage.locks.forEach(function (l) { if (l.opening && l.open < 1) { l.open = Math.min(1, l.open + dt / 350); } });
        // ---- particles + rings
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt / 1300;
          if (p.shape === "rect") p.vy += 0.0000015 * dt;
          if (p.shape === "fly") { p.x += Math.sin(now * 0.01 + p.w) * 0.0006; }
          if (p.life <= 0) particles.splice(i, 1);
        }
        for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.r += dt * 0.0002; r.life -= dt / 700; if (r.life <= 0) rings.splice(i, 1); }
      }

      // ---------- input ----------
      function down(x, y) {
        if (phase === "find" || phase === "keys" || phase === "ghost") {
          // keys in tray → start drag
          if (phase !== "find") {
            let best = null, bd = Infinity;
            keys.forEach(function (k) { if (k.used) return; const d = Math.hypot(x - k.x, y - k.y); if (d < 0.085 && d < bd) { bd = d; best = k; } });
            if (best) { drag = { key: best }; best.x = x; best.y = y; ctx.audio.pick(); return; }
          }
          if (phase === "ghost") {
            const gd = Math.hypot(x - ghost.x, y - ghost.y);
            if (ghost.keys > 0 && gd < 0.11) {
              ghost.keys--; ghost.jolt = 1; ghost.tx = Math.random(); ghost.ty = 0.1 + Math.random() * 0.5;
              spawnKey(cage.locks[ghost.keys].col, ghost.x, ghost.y + 0.08);
              say("Hee hee hee!", "callum"); return;
            }
            // hunt for the invisible cage: warmer/colder shimmer
            const d = Math.hypot(x - cage.x, y - cage.y);
            if (inCage(x, y, 0.03)) { cage.vis = Math.min(1, cage.vis + 0.34); cage.shake = 0.6; ring(cage.x, cage.y, "#ffffff", 0.16); ctx.audio.arp([880, 1175, 1568], { dur: 0.12, step: 0.06, vol: 0.1 }); if (cage.vis >= 1) say("There he is!"); }
            else { const warm = Math.max(0, 1 - d / 0.45); ring(x, y, "rgba(201,195,255," + (0.25 + warm * 0.6) + ")", 0.05 + warm * 0.08); ctx.audio.tone(300 + warm * 500, 0.1, { type: "sine", vol: 0.05 }); }
            return;
          }
          // hiding spots
          let bo = null, bd2 = Infinity;
          objects.forEach(function (o) { const d = Math.hypot(x - o.x, (y - (o.y - o.r * 0.3)) * 1.2); if (d < o.r * 1.5 && d < bd2) { bd2 = d; bo = o; } });
          if (bo) { tapObject(bo); return; }
          ctx.audio.tone(330, 0.08, { type: "sine", vol: 0.04, glide: 420 });
        } else if (phase === "puzzle" && !puzzle.done) {
          let best = null;
          puzzle.pieces.forEach(function (p) { if (p.placed) return; if (x > p.x - 0.02 && x < p.x + p.w + 0.02 && y > p.y - 0.02 && y < p.y + p.h + 0.02) best = p; });
          if (best) { puzzle.pieces.splice(puzzle.pieces.indexOf(best), 1); puzzle.pieces.push(best); drag = { piece: best, ox: x - best.x, oy: y - best.y }; ctx.audio.pick(); return; }
          ctx.audio.tone(330, 0.08, { type: "sine", vol: 0.04, glide: 420 });
        } else if (phase === "chase") {
          const c = chase; c.taps++; c.lastTap = now;
          c.vel = Math.min(0.00042, c.vel + 0.00012); c.boost = 1;
          if (now - sirenAt > 90) { sirenAt = now; ctx.audio.tone(520 + Math.min(300, c.taps * 6), 0.1, { type: "triangle", vol: 0.06, glide: 880 }); }
          particles.push({ x: c.tx - 0.06, y: 0.66, vx: -0.0003, vy: -0.00012, life: 0.8, r: 0.01, col: "rgba(220,215,255,0.5)", shape: "dot" });
        } else if (phase === "freed" || phase === "intro") {
          // tapping the pup = happy bark
          if (pup.vis > 0 && Math.hypot(x - pup.x, y - pup.y) < 0.15 && now - barkAt > 1500) { bark(); puff(pup.x, pup.y, 8, "#ffd36b", 0.0002); }
        }
      }
      function move(x, y) {
        if (!drag) return;
        if (drag.key) { drag.key.x = x; drag.key.y = y; drag.key.ang = -0.9; }
        else if (drag.piece) { drag.piece.x = Math.max(0, Math.min(1 - drag.piece.w, x - drag.ox)); drag.piece.y = Math.max(0, Math.min(1 - drag.piece.h, y - drag.oy)); }
      }
      function up(x, y) {
        if (!drag) return;
        if (drag.key) {
          const k = drag.key;
          if (cage && inCage(x, y, 0.06) && tryUnlock(k)) { /* opened */ }
          else if (cage && inCage(x, y, 0.06)) { cage.shake = 0.5; ctx.audio.tone(240, 0.12, { type: "triangle", vol: 0.06 }); }
          else ctx.audio.place();
        } else if (drag.piece) {
          const p = drag.piece;
          if (Math.hypot(p.x - p.hx, p.y - p.hy) < Math.min(p.w, p.h) * 0.45) {
            p.x = p.hx; p.y = p.hy; p.placed = true; ctx.audio.place(); ctx.audio.arp([660, 880], { dur: 0.1, step: 0.06, vol: 0.1 }); puff(p.x + p.w / 2, p.y + p.h / 2, 10, "#ffd36b", 0.0002);
            if (puzzle.pieces.every(function (q) { return q.placed; })) {
              puzzle.done = true; puzzle.t = 0; addStar();
              ctx.audio.arp([523, 659, 784, 1046, 1318, 1568], { dur: 0.22, step: 0.09, vol: 0.14 });
              say("Hooray!"); setTimeout(function () { if (ctx) bark(); }, 900); puff(puzzle.x + puzzle.size / 2, puzzle.y + puzzle.size / 2, 70, null, 0.0006);
            }
          } else ctx.audio.soft();
        }
        drag = null;
      }

      // ---------- chase scene ----------
      function drawTruck(x, y, r, boost) {
        g.save(); g.translate(x, y);
        g.shadowColor = "#ff9fa8"; g.shadowBlur = r * 0.4;
        g.fillStyle = "#e84f5a"; g.beginPath(); g.roundRect(-r * 1.5, -r * 0.7, r * 3, r * 0.9, r * 0.15); g.fill();
        g.fillStyle = "#c93c47"; g.beginPath(); g.roundRect(r * 0.6, -r * 1.35, r * 0.9, r * 0.7, r * 0.15); g.fill();
        g.fillStyle = "#bfe9ff"; g.beginPath(); g.roundRect(r * 0.72, -r * 1.25, r * 0.55, r * 0.45, r * 0.08); g.fill();
        g.shadowBlur = 0;
        g.strokeStyle = "#ffd36b"; g.lineWidth = r * 0.1; g.lineCap = "round";
        g.beginPath(); g.moveTo(-r * 1.4, -r * 0.95); g.lineTo(r * 0.4, -r * 0.95); g.moveTo(-r * 1.4, -r * 0.75); g.lineTo(r * 0.4, -r * 0.75); g.stroke();
        for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(-r * 1.3 + i * r * 0.4, -r * 0.95); g.lineTo(-r * 1.3 + i * r * 0.4, -r * 0.75); g.stroke(); }
        const red = Math.sin(now * 0.012) > 0;
        g.fillStyle = red ? "#ff4d5e" : "#4d8dff"; g.shadowColor = g.fillStyle; g.shadowBlur = r * 0.6; g.beginPath(); g.roundRect(r * 0.85, -r * 1.55, r * 0.4, r * 0.22, r * 0.08); g.fill(); g.shadowBlur = 0;
        g.fillStyle = "#2a2434"; [-r * 0.9, r * 0.9].forEach(function (wx) { g.beginPath(); g.arc(wx, r * 0.3, r * 0.36, 0, TAU); g.fill(); });
        g.fillStyle = "#8a86a8"; [-r * 0.9, r * 0.9].forEach(function (wx) { g.save(); g.translate(wx, r * 0.3); g.rotate(now * 0.01 * (1 + boost * 3)); g.beginPath(); g.arc(0, 0, r * 0.16, 0, TAU); g.fill(); g.fillRect(-r * 0.03, -r * 0.3, r * 0.06, r * 0.6); g.restore(); });
        if (boost > 0) { g.fillStyle = "rgba(255,184,107," + (0.5 * boost) + ")"; g.beginPath(); g.moveTo(-r * 1.55, -r * 0.4); g.lineTo(-r * (1.9 + boost * 0.8), -r * 0.25); g.lineTo(-r * 1.55, -r * 0.05); g.closePath(); g.fill(); }
        g.restore();
      }
      function drawChase() {
        const c = chase;
        // moon (the ghost is flying toward it)
        g.save(); g.fillStyle = "#fff4c2"; g.shadowColor = "#fff4c2"; g.shadowBlur = S * 0.05; g.beginPath(); g.arc(S * 0.9, S * 0.16, S * 0.055, 0, TAU); g.fill(); g.restore();
        g.fillStyle = "rgba(0,0,0,0.12)"; [[0.88, 0.14, 0.012], [0.92, 0.18, 0.009], [0.9, 0.2, 0.006]].forEach(function (m) { g.beginPath(); g.arc(S * m[0], S * m[1], S * m[2], 0, TAU); g.fill(); });
        // road
        g.fillStyle = "#2a2440"; g.fillRect(0, S * 0.62, S, S * 0.12);
        g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = S * 0.006; g.setLineDash([S * 0.04, S * 0.03]); g.lineDashOffset = -now * 0.02 * (c.vel > 0.00005 ? 1 : 0);
        g.beginPath(); g.moveTo(0, S * 0.68); g.lineTo(S, S * 0.68); g.stroke(); g.setLineDash([]);
        // pup waiting (before the grab), then pup in the ghost's bubble
        if (phase === "chaseIn" && pup.vis > 0) drawPup(g, pup.x * S, (pup.y - pup.hop) * S, S * 0.085, { t: now, mood: pup.mood, glow: "#ff9fa8" });
        if (c.hasPup && !c.caught) {
          const bx = ghost.x * S, by = (ghost.y + 0.13) * S + Math.sin(now * 0.004) * S * 0.006;
          g.save(); g.fillStyle = "rgba(201,195,255,0.18)"; g.strokeStyle = "rgba(255,255,255,0.6)"; g.lineWidth = S * 0.004; g.beginPath(); g.arc(bx, by, S * 0.062, 0, TAU); g.fill(); g.stroke(); g.restore();
          drawPup(g, bx, by, S * 0.038, { t: now, mood: "sad" });
        }
        drawGhost();
        // fire truck (Chris)
        if (phase !== "chaseIn") {
          drawTruck(c.tx * S, S * 0.6, S * 0.05, c.boost);
          if (c.caught) drawPup(g, pup.x * S, (0.5 - pup.hop) * S, S * 0.045, { t: now, mood: "party", glow: "#ff9fa8" });
        }
        // speed meter under the road: fills with fast taps
        if (phase === "chase") {
          const mw = S * 0.6, mx = S * 0.2, my = S * 0.8, mh = S * 0.05, fill = Math.min(1, c.vel / 0.00042);
          g.fillStyle = "rgba(255,255,255,0.08)"; g.beginPath(); g.roundRect(mx, my, mw, mh, mh / 2); g.fill();
          if (fill > 0.02) { const gr = g.createLinearGradient(mx, 0, mx + mw, 0); KEY_COLS.forEach(function (col, i) { gr.addColorStop(i / (KEY_COLS.length - 1), col); }); g.save(); g.fillStyle = gr; g.shadowColor = "#ffd36b"; g.shadowBlur = S * 0.02; g.beginPath(); g.roundRect(mx, my, mw * fill, mh, mh / 2); g.fill(); g.restore(); }
          // invite to tap: pulsing rings around the truck when idle
          if (now - c.lastTap > 1200) { const p = (now % 900) / 900; g.save(); g.globalAlpha = (1 - p) * 0.6; g.strokeStyle = "#ffd36b"; g.lineWidth = S * 0.006; g.beginPath(); g.arc(c.tx * S, S * 0.6, S * (0.07 + p * 0.06), 0, TAU); g.stroke(); g.restore(); }
        }
      }

      // ---------- draw ----------
      function draw() {
        g.clearRect(0, 0, S, S);
        const sky = g.createLinearGradient(0, 0, 0, S);
        sky.addColorStop(0, "#131026"); sky.addColorStop(0.5, "#1c1630"); sky.addColorStop(1, "#1e2a2a");
        g.fillStyle = sky; g.fillRect(0, 0, S, S);
        for (let i = 0; i < 26; i++) { const x = ((i * 137.5) % 100) / 100 * S, y = ((i * 91.7) % 40) / 100 * S; g.fillStyle = "rgba(255,255,255," + (0.12 + 0.3 * (0.5 + 0.5 * Math.sin(now * 0.002 + i))) + ")"; g.beginPath(); g.arc(x, y, S * 0.003, 0, TAU); g.fill(); }
        // ground
        g.fillStyle = "rgba(60,120,90,0.25)"; g.beginPath(); g.ellipse(S * 0.5, S * 0.92, S * 0.7, S * 0.22, 0, 0, TAU); g.fill();
        // star counter
        g.save(); g.textAlign = "center"; g.textBaseline = "top"; g.fillStyle = "#ffd36b"; g.shadowColor = "rgba(255,211,107,0.6)"; g.shadowBlur = 16;
        g.font = "800 " + Math.round(S * 0.07) + "px system-ui, sans-serif"; g.fillText("★ " + stars, S / 2, S * 0.02); g.restore();

        rings.forEach(function (r) { g.save(); g.globalAlpha = Math.max(0, r.life); g.strokeStyle = r.col; g.lineWidth = S * 0.008; g.beginPath(); g.arc(r.x * S, r.y * S, Math.min(r.max, r.r) * S, 0, TAU); g.stroke(); g.restore(); });

        if (phase === "puzzle") drawPuzzle();
        else if (phase === "chase" || phase === "chaseDone" || phase === "chaseIn") drawChase();
        else {
          // free pup (intro / freed)
          if ((phase === "intro" || phase === "freed" || phase === "ghostIn") && pup.vis > 0) {
            drawPup(g, pup.x * S, (pup.y - pup.hop) * S, S * 0.085, { t: now, mood: pup.mood, glow: "#ff9fa8" });
          }
          objects.forEach(drawObject);
          if (phase !== "intro" && phase !== "freed") drawCage();
          else if (phase === "freed" && cage) { const keep = pup.vis; pup.vis = 0; drawCage(); pup.vis = keep; }
          drawGhost();
          drawTray(); drawKeys();
        }
        particles.forEach(function (p) {
          g.save(); g.globalAlpha = Math.max(0, Math.min(1, p.life)); g.fillStyle = p.col;
          if (p.shape === "rect") { g.translate(p.x * S, p.y * S); g.rotate(p.x * 40); g.fillRect(-p.r * S, -p.r * S * 0.6, p.r * S * 2, p.r * S * 1.2); }
          else if (p.shape === "fly") { const fl = Math.sin(now * 0.02 + p.w) * 0.5 + 0.5; g.beginPath(); g.ellipse(p.x * S - p.r * S * 0.5, p.y * S, p.r * S * (0.4 + fl * 0.4), p.r * S * 0.5, 0, 0, TAU); g.ellipse(p.x * S + p.r * S * 0.5, p.y * S, p.r * S * (0.4 + fl * 0.4), p.r * S * 0.5, 0, 0, TAU); g.fill(); }
          else { g.beginPath(); g.arc(p.x * S, p.y * S, p.r * S, 0, TAU); g.fill(); }
          g.restore();
        });
      }

      return {
        mount(stage, c) {
          ctx = c;
          reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          const wrap = document.createElement("div");
          wrap.style.display = "flex"; wrap.style.flexDirection = "column"; wrap.style.alignItems = "center";
          canvas = document.createElement("canvas");
          canvas.style.borderRadius = "18px"; canvas.style.background = "#131026"; canvas.style.cursor = "pointer";
          canvas.style.boxShadow = "0 0 46px rgba(232,79,90,0.16)"; canvas.style.touchAction = "none";
          g = canvas.getContext("2d");
          wrap.appendChild(canvas);
          const hint = document.createElement("div"); hint.className = "hint";
          hint.textContent = "Tap things to look under them. Drag keys onto the locks. Tap the ghost!";
          wrap.appendChild(hint);
          stage.appendChild(wrap);
          now = 0; rescues = 0; particles = []; rings = []; roundIdx = 0; voiceAt = -9999; hintAt = 0;
          stars = ctx.storage.get("stars", 0);
          resize();
          ctx.setScore(0);
          Arcade.input.setPointerTarget(canvas);
          unResize = Arcade.board.onResize(function () { resize(); });
          if (Arcade.voice) { try { Arcade.voice.preload(["Oh no! Where did the puppy go?", "Find the puppy!", "There he is!", "Find the key!", "Find the keys!", "You found a key!", "You saved him!", "Hooray!", "Put the puppy back together!", "Uh oh! A ghost!", "The cage is invisible! Tap to find it!", "Oh no! He's taking the puppy!", "Catch the ghost!", "Tap fast!", "Gotcha!"], "jessica"); Arcade.voice.preload(["Boo!", "Hee hee hee!", "Bye bye!"], "callum"); } catch (e) {} }
          try { barkEl = new Audio("audio/animals/dog.mp3"); barkEl.preload = "auto"; barkEl.volume = 0.7; barkEl.load(); } catch (e) {}   // warm the recording
          startRound();
          draw();
          if (window.__pupDebug) window.__pupDebug.state = function () { return { phase: phase, S: S, objects: objects, keys: keys, cage: cage, ghost: ghost, puzzle: puzzle, chase: chase, rescues: rescues, roundIdx: roundIdx }; };
        },
        handleInput(intent) {
          if (intent.type !== "point") return;
          const x = intent.x / S, y = intent.y / S;
          if (intent.phase === "down" && intent.button === 0) down(x, y);
          else if (intent.phase === "move") move(x, y);
          else if (intent.phase === "up") up(x, y);
        },
        tick(dt) { update(Math.min(50, dt)); draw(); },
        getScore() { return rescues; },
        teardown() {
          if (unResize) unResize(); unResize = null;
          try { if (Arcade.voice) Arcade.voice.stop(); } catch (e) {}
          if (barkEl) { try { barkEl.pause(); } catch (e) {} } barkEl = null; ctx = canvas = g = offc = null; objects = []; keys = []; particles = []; rings = []; cage = ghost = puzzle = drag = null;
        }
      };
    }
  });
})();
