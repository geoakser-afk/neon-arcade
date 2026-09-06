/* Fishy — made for Christopher (age 5). A calm aquarium: six big-eyed fish swim
   back and forth, bubbles rise, seaweed sways. Tap a fish: it wiggles, bloops and
   puffs out bubbles. Tap the water: a food pellet drops and the nearest fish swims
   over to munch it. Nothing to lose, no clock — every 10 taps a rainbow fish visits. */
(function () {
  const FISH = [
    { body: "#ff9f5a", fin: "#ffd0a8", eye: "#2a2038", size: 1.0 },
    { body: "#74b9ff", fin: "#c2e0ff", eye: "#1e2440", size: 0.82 },
    { body: "#ff8fd0", fin: "#ffd0ea", eye: "#3a2038", size: 0.9 },
    { body: "#7fe0a0", fin: "#c8f5d6", eye: "#1e3a2a", size: 0.72 },
    { body: "#ffd36b", fin: "#fff0c2", eye: "#3a3020", size: 1.1 },
    { body: "#c9c3ff", fin: "#ebe8ff", eye: "#2a2444", size: 0.78 }
  ];
  const RAINBOW = { body: "rainbow", fin: "#ffffff", eye: "#2a2038", size: 1.25 };

  // ---- shared drawing (in-game + kidIcon). Fish faces +x; r = body half-length ----
  function fishFill(g, f, r) {
    if (f.body !== "rainbow") {
      const gr = g.createRadialGradient(-r * 0.2, -r * 0.3, r * 0.05, 0, 0, r * 1.1);
      gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.3, f.body); gr.addColorStop(1, f.body);
      return gr;
    }
    const gr = g.createLinearGradient(-r, 0, r, 0);
    ["#ff8fa3", "#ffd36b", "#a8e6a0", "#74b9ff", "#c9c3ff"].forEach(function (c, i) { gr.addColorStop(i / 4, c); });
    return gr;
  }
  function drawFish(g, f, r, t, wig, puff) {
    // t: time for tail wag, wig: 0..1 tap wiggle, puff: 0..1 munch puff
    const wag = Math.sin(t * 0.012) * 0.35 + Math.sin(t * 0.05) * wig * 0.6;
    const p = 1 + puff * 0.18;
    g.save();
    g.scale(p, p * (1 + wig * 0.12));
    g.shadowColor = f.body === "rainbow" ? "#ffffff" : f.body; g.shadowBlur = r * 0.45;
    g.fillStyle = fishFill(g, f, r);
    // tail
    g.save(); g.translate(-r * 0.85, 0); g.rotate(wag);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(-r * 0.65, -r * 0.5); g.lineTo(-r * 0.5, 0); g.lineTo(-r * 0.65, r * 0.5); g.closePath(); g.fill();
    g.restore();
    // top + bottom fins
    g.fillStyle = f.fin;
    g.beginPath(); g.moveTo(-r * 0.3, -r * 0.45); g.quadraticCurveTo(r * 0.05, -r * 1.05, r * 0.35, -r * 0.5); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(-r * 0.1, r * 0.5); g.quadraticCurveTo(r * 0.1, r * 0.95 + wag * r * 0.2, r * 0.4, r * 0.5); g.closePath(); g.fill();
    // body
    g.fillStyle = fishFill(g, f, r);
    g.beginPath(); g.ellipse(0, 0, r, r * 0.62, 0, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
    // side fin
    g.fillStyle = f.fin;
    g.save(); g.translate(0, r * 0.15); g.rotate(0.5 + wag * 0.4);
    g.beginPath(); g.ellipse(0, 0, r * 0.32, r * 0.16, 0, 0, Math.PI * 2); g.fill(); g.restore();
    // stripe / belly highlight
    g.fillStyle = "rgba(255,255,255,0.22)";
    g.beginPath(); g.ellipse(-r * 0.15, r * 0.25, r * 0.55, r * 0.22, 0, 0, Math.PI * 2); g.fill();
    // big eye
    const ex = r * 0.5, ey = -r * 0.12, er = r * 0.22;
    g.fillStyle = "#ffffff"; g.beginPath(); g.arc(ex, ey, er, 0, Math.PI * 2); g.fill();
    g.fillStyle = f.eye; g.beginPath(); g.arc(ex + er * 0.25, ey, er * 0.55, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#ffffff"; g.beginPath(); g.arc(ex + er * 0.05, ey - er * 0.3, er * 0.2, 0, Math.PI * 2); g.fill();
    // mouth + cheek
    g.strokeStyle = f.eye; g.lineWidth = r * 0.05; g.lineCap = "round";
    g.beginPath(); g.arc(r * 0.82, r * 0.18, r * 0.1 * (1 + puff), 0.1 * Math.PI, 0.9 * Math.PI); g.stroke();
    g.fillStyle = "rgba(255,110,140,0.3)"; g.beginPath(); g.ellipse(r * 0.6, r * 0.22, r * 0.12, r * 0.08, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  function drawBubble(g, x, y, r, a) {
    g.save(); g.globalAlpha = a;
    g.strokeStyle = "rgba(200,230,255,0.8)"; g.lineWidth = Math.max(1, r * 0.18);
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "rgba(255,255,255,0.7)"; g.beginPath(); g.arc(x - r * 0.35, y - r * 0.35, r * 0.22, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  Arcade.register({
    id: "fishy",
    name: "Fishy",
    tagline: "Tap the fish. Feed the fish. Watch them swim.",
    accent: "#74b9ff",
    complexity: "low",
    controls: "click",
    scoreLabel: "Taps",
    kid: true,
    kidIcon(g, s) {
      g.save(); g.translate(s * 0.5, s * 0.54);
      drawFish(g, FISH[0], s * 0.3, 400, 0, 0);
      g.restore();
      drawBubble(g, s * 0.8, s * 0.24, s * 0.05, 0.9);
      drawBubble(g, s * 0.7, s * 0.13, s * 0.03, 0.8);
      drawBubble(g, s * 0.88, s * 0.1, s * 0.035, 0.7);
    },
    create() {
      let stageEl, ctx, canvas, g, unResize = null;
      let S = 0, dpr = 1, reduced = false;
      let now = 0, taps = 0;
      let fish = [];       // {f, x, y, dir, face, speed, r, bob, t, wig, puff, target, rainbow, last}
      let confetti = [];   // rainbow-fish celebration
      let bubbles = [];    // {x,y,r,vy,life,wob}
      let pellets = [];    // {x,y,vy,r}
      let weeds = [];      // {x, h, phase, col}
      let nextBubble = 0;

      function resize() {
        S = Arcade.board.stageSize(880);
        dpr = window.devicePixelRatio || 1;
        canvas.style.width = S + "px"; canvas.style.height = S + "px";
        canvas.width = Math.round(S * dpr); canvas.height = Math.round(S * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        fish.forEach(function (fs) { fs.r = S * 0.075 * fs.f.size; fs.x = Math.min(S * 0.9, Math.max(S * 0.1, fs.x)); fs.y = Math.min(S * 0.78, Math.max(S * 0.18, fs.y)); });
      }
      function spawnFish() {
        fish = [];
        for (let i = 0; i < FISH.length; i++) {
          const dir = i % 2 ? -1 : 1;
          fish.push({ f: FISH[i], x: S * (0.15 + 0.7 * ((i * 0.37) % 1)), y: S * (0.2 + 0.55 * (i / (FISH.length - 1))), dir: dir, face: dir,
            speed: S * (0.00004 + Math.random() * 0.00004), r: S * 0.075 * FISH[i].size, bob: Math.random() * 6.28, t: Math.random() * 1000, wig: 0, puff: 0, target: null, rainbow: false, last: -1000 });
        }
        weeds = [];
        for (let i = 0; i < 9; i++) weeds.push({ x: (0.04 + 0.92 * (i / 8)) + (Math.random() - 0.5) * 0.04, h: 0.12 + Math.random() * 0.14, phase: Math.random() * 6.28, col: i % 2 ? "rgba(127,224,160,0.7)" : "rgba(95,208,200,0.6)" });
      }
      function spawnRainbow() {
        const dir = Math.random() < 0.5 ? 1 : -1;
        fish.push({ f: RAINBOW, x: dir > 0 ? -S * 0.2 : S * 1.2, y: S * (0.25 + Math.random() * 0.4), dir: dir, face: dir, speed: S * 0.00016, r: S * 0.075 * RAINBOW.size,
          bob: Math.random() * 6.28, t: 0, wig: 0, puff: 0, target: null, rainbow: true, last: -1000 });
        ctx.audio.arp([1046, 1318, 1568, 2093], { dur: 0.2, step: 0.08, vol: 0.1, type: "sine" });
      }
      function puffBubbles(x, y, n, big) {
        for (let i = 0; i < n; i++) bubbles.push({ x: x + (Math.random() - 0.5) * S * 0.06, y: y + (Math.random() - 0.5) * S * 0.04, r: S * (big ? 0.008 : 0.004) * (0.6 + Math.random()), vy: -S * (0.00006 + Math.random() * 0.00008), life: 1, wob: Math.random() * 6.28 });
      }
      function countTap() {
        taps++; ctx.setScore(taps);
        if (taps % 10 === 0) spawnRainbow();
      }
      function tapFish(fs) {
        if (now - fs.last < 80) return;
        fs.last = now; fs.wig = 1;
        countTap();
        ctx.audio.tone(300, 0.15, { type: "sine", vol: 0.14, glide: 900 });
        const note = [523, 587, 659, 784, 880][Math.floor(Math.random() * 5)];
        ctx.audio.tone(fs.rainbow ? note * 2 : note, 0.18, { type: "triangle", vol: 0.09, when: 0.12 });
        puffBubbles(fs.x + fs.face * fs.r * 0.8, fs.y - fs.r * 0.2, reduced ? 4 : 10, true);
        if (fs.rainbow) {
          // the rainbow fish is special: confetti + a little fanfare
          ctx.audio.arp([784, 1046, 1318, 1568, 2093], { dur: 0.16, step: 0.06, vol: 0.12, type: "sine", when: 0.1 });
          const n = reduced ? 14 : 60;
          for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, sp = S * (0.0003 + Math.random() * 0.0007); confetti.push({ x: fs.x, y: fs.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - S * 0.0003, life: 1, r: S * (0.005 + Math.random() * 0.007), col: ["#ff8fa3", "#ffd36b", "#a8e6a0", "#74b9ff", "#c9c3ff", "#ffffff"][i % 6], rot: Math.random() * 6.28 }); }
        }
      }
      function dropPellet(x, y) {
        countTap();
        const p = { x: x, y: Math.max(S * 0.14, y), vy: S * 0.00005, r: S * 0.018 };
        pellets.push(p);
        ctx.audio.tone(700, 0.08, { type: "sine", vol: 0.06, glide: 500 });
        puffBubbles(x, p.y, 3, false);
        // nearest free fish takes it; fall back to nearest overall
        let best = null, bd = Infinity;
        fish.forEach(function (fs) { if (fs.rainbow || fs.target) return; const d = Math.hypot(fs.x - x, fs.y - y); if (d < bd) { bd = d; best = fs; } });
        if (!best) fish.forEach(function (fs) { if (fs.rainbow) return; const d = Math.hypot(fs.x - x, fs.y - y); if (d < bd) { bd = d; best = fs; } });
        if (best) best.target = p;
      }
      function munch(fs, p) {
        const i = pellets.indexOf(p); if (i >= 0) pellets.splice(i, 1);
        fs.target = null; fs.puff = 1;
        ctx.audio.tone(180, 0.06, { type: "triangle", vol: 0.12, glide: 120 });
        ctx.audio.tone(160, 0.06, { type: "triangle", vol: 0.12, glide: 110, when: 0.09 });
        ctx.audio.tone(880, 0.12, { type: "sine", vol: 0.06, when: 0.2 });
        puffBubbles(fs.x + fs.face * fs.r, fs.y, reduced ? 3 : 6, false);
        // hand any waiting pellet to this fish
        const waiting = pellets.filter(function (q) { return !fish.some(function (o) { return o.target === q; }); });
        if (waiting.length) fs.target = waiting[0];
      }

      function update(dt) {
        now += dt;
        for (let i = confetti.length - 1; i >= 0; i--) { const c = confetti[i]; c.vy += S * 0.0000012 * dt; c.vx *= Math.pow(0.999, dt); c.x += c.vx * dt; c.y += c.vy * dt; c.rot += dt * 0.004; c.life -= dt / 1600; if (c.life <= 0) confetti.splice(i, 1); }
        const floorY = S * 0.86;
        // bubbles ambient
        nextBubble -= dt;
        if (nextBubble <= 0) { bubbles.push({ x: S * (0.05 + Math.random() * 0.9), y: floorY, r: S * (0.003 + Math.random() * 0.006), vy: -S * (0.00005 + Math.random() * 0.00006), life: 1, wob: Math.random() * 6.28 }); nextBubble = reduced ? 900 : 350 + Math.random() * 500; }
        for (let i = bubbles.length - 1; i >= 0; i--) { const b = bubbles[i]; b.y += b.vy * dt; b.x += Math.sin(now * 0.003 + b.wob) * S * 0.00002 * dt; if (b.y < S * 0.12) b.life -= dt / 250; if (b.life <= 0) bubbles.splice(i, 1); }
        // pellets fall slowly, rest on the sand
        pellets.forEach(function (p) { p.y = Math.min(floorY - p.r, p.y + p.vy * dt); p.x += Math.sin(now * 0.002 + p.y) * S * 0.00001 * dt; });
        // fish
        for (let i = fish.length - 1; i >= 0; i--) {
          const fs = fish[i];
          fs.t += dt;
          if (fs.wig > 0) fs.wig = Math.max(0, fs.wig - dt / 450);
          if (fs.puff > 0) fs.puff = Math.max(0, fs.puff - dt / 600);
          if (fs.rainbow) {
            fs.x += fs.dir * fs.speed * dt; fs.y += Math.sin(now * 0.002 + fs.bob) * S * 0.00003 * dt;
            if ((fs.dir > 0 && fs.x > S * 1.3) || (fs.dir < 0 && fs.x < -S * 0.3)) fish.splice(i, 1);
            continue;
          }
          if (fs.target) {
            const dx = fs.target.x - fs.x, dy = fs.target.y - fs.y, d = Math.hypot(dx, dy);
            if (d < fs.r * 0.7) { munch(fs, fs.target); }
            else { if (Math.abs(dx) > fs.r * 0.2) fs.dir = dx > 0 ? 1 : -1; const sp = fs.speed * 3.2 * dt; fs.x += dx / d * sp; fs.y += dy / d * sp; }
          } else {
            fs.x += fs.dir * fs.speed * dt;
            fs.y += Math.sin(now * 0.0015 + fs.bob) * S * 0.00002 * dt;
            if (fs.x > S * 0.9 && fs.dir > 0) fs.dir = -1;
            if (fs.x < S * 0.1 && fs.dir < 0) fs.dir = 1;
            fs.y = Math.min(S * 0.78, Math.max(S * 0.18, fs.y));
          }
          // smooth turn: face lerps toward dir (scaleX passes through 0 = fish turns)
          fs.face += (fs.dir - fs.face) * Math.min(1, dt / 220);
        }
      }

      function draw() {
        g.clearRect(0, 0, S, S);
        const water = g.createLinearGradient(0, 0, 0, S);
        water.addColorStop(0, "#0e1a3a"); water.addColorStop(0.6, "#0f2450"); water.addColorStop(1, "#123058");
        g.fillStyle = water; g.fillRect(0, 0, S, S);
        // light rays
        for (let i = 0; i < 4; i++) { g.save(); g.globalAlpha = 0.05 + 0.03 * Math.sin(now * 0.001 + i); g.fillStyle = "#9fd0ff"; g.beginPath(); const x = S * (0.15 + i * 0.24) + Math.sin(now * 0.0004 + i) * S * 0.03; g.moveTo(x - S * 0.03, 0); g.lineTo(x + S * 0.03, 0); g.lineTo(x + S * 0.14, S * 0.9); g.lineTo(x - S * 0.1, S * 0.9); g.closePath(); g.fill(); g.restore(); }
        // sand
        const floorY = S * 0.86;
        const sand = g.createLinearGradient(0, floorY, 0, S); sand.addColorStop(0, "#c9a86b"); sand.addColorStop(1, "#8f7445");
        g.fillStyle = sand; g.beginPath(); g.moveTo(0, S); g.lineTo(0, floorY + S * 0.01);
        for (let x = 0; x <= S; x += S / 12) g.quadraticCurveTo(x + S / 24, floorY - S * 0.012, x + S / 12, floorY + S * 0.01);
        g.lineTo(S, S); g.closePath(); g.fill();
        g.fillStyle = "rgba(255,255,255,0.12)"; [0.12, 0.4, 0.7, 0.9].forEach(function (k, i) { g.beginPath(); g.arc(S * k, floorY + S * 0.05, S * 0.012 * (1 + (i % 2)), 0, Math.PI * 2); g.fill(); });
        // seaweed
        g.lineCap = "round"; g.lineWidth = Math.max(3, S * 0.014);
        weeds.forEach(function (w) {
          g.strokeStyle = w.col; g.beginPath();
          const bx = w.x * S, h = w.h * S; g.moveTo(bx, floorY + S * 0.01);
          for (let k = 1; k <= 4; k++) { const yy = floorY - h * k / 4; const sway = Math.sin(now * 0.0012 + w.phase + k * 0.7) * S * 0.012 * k; g.lineTo(bx + sway, yy); }
          g.stroke();
        });
        // pellets
        pellets.forEach(function (p) { g.save(); g.fillStyle = "#c98a4a"; g.shadowColor = "#ffd36b"; g.shadowBlur = 10; g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill(); g.fillStyle = "rgba(255,255,255,0.35)"; g.beginPath(); g.arc(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.35, 0, Math.PI * 2); g.fill(); g.restore(); });
        // fish (small first so big ones are in front)
        fish.slice().sort(function (a, b) { return a.r - b.r; }).forEach(function (fs) {
          g.save(); g.translate(fs.x, fs.y + (reduced ? 0 : Math.sin(now * 0.002 + fs.bob) * fs.r * 0.08));
          g.scale(Math.max(0.08, Math.abs(fs.face)) * (fs.face < 0 ? -1 : 1), 1);
          drawFish(g, fs.f, fs.r, fs.t, fs.wig, fs.puff);
          g.restore();
        });
        // bubbles
        bubbles.forEach(function (b) { drawBubble(g, b.x, b.y, b.r, Math.max(0, b.life) * 0.8); });
        // confetti (rainbow fish)
        confetti.forEach(function (c) { g.save(); g.globalAlpha = Math.max(0, c.life); g.fillStyle = c.col; g.translate(c.x, c.y); g.rotate(c.rot); g.fillRect(-c.r, -c.r * 0.6, c.r * 2, c.r * 1.2); g.restore(); });
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
          canvas.style.borderRadius = "18px"; canvas.style.background = "#0e1a3a"; canvas.style.cursor = "pointer";
          canvas.style.boxShadow = "0 0 46px rgba(116,185,255,0.16)"; canvas.style.touchAction = "none";
          g = canvas.getContext("2d");
          wrap.appendChild(canvas);
          const hint = document.createElement("div"); hint.className = "hint";
          hint.textContent = "Tap a fish to say hi. Tap the water to drop food.";
          wrap.appendChild(hint);
          stage.appendChild(wrap);
          now = 0; taps = 0; bubbles = []; pellets = []; nextBubble = 300;
          S = Arcade.board.stageSize(880);
          spawnFish();
          resize();
          ctx.setScore(0);
          Arcade.input.setPointerTarget(canvas);
          unResize = Arcade.board.onResize(function () { resize(); });
          draw();
        },
        handleInput(intent) {
          if (intent.type !== "point" || intent.phase !== "down" || intent.button !== 0) return;
          let best = null, bd = Infinity;
          fish.forEach(function (fs) {
            const d = Math.hypot(intent.x - fs.x, (intent.y - fs.y) * 1.3);
            if (d < fs.r * 1.5 && d < bd) { bd = d; best = fs; }
          });
          if (best) tapFish(best);
          else if (intent.y < S * 0.86) dropPellet(intent.x, intent.y);
          else ctx.audio.tone(330, 0.06, { type: "sine", vol: 0.03, glide: 400 });   // tapped the sand: soft blip
        },
        tick(dt) { update(Math.min(50, dt)); draw(); },
        getScore() { return taps; },
        teardown() {
          if (unResize) unResize(); unResize = null;
          stageEl = ctx = canvas = g = null; confetti = []; fish = []; bubbles = []; pellets = []; weeds = [];
        }
      };
    }
  });
})();
