/* Drums — made for Christopher (age 5). Six giant drum pads, each with its own
   synthesized voice: bass thud, snare crack, hi-hat tick, tom, cowbell, crash.
   Tap one: it squashes, a ring ripples out, sparkles fly, the sound plays.
   Nothing to lose, no clock — just a big star counter and confetti every 16 hits. */
(function () {
  const PADS = [
    { id: "bass", kind: "drum", body: "#ff6b6b", rim: "#ffd6d6", head: "#ffe9e9", glow: "#ff8f8f", scale: 1.0 },
    { id: "snare", kind: "drum", body: "#74b9ff", rim: "#e0f0ff", head: "#f4f9ff", glow: "#9fd0ff", scale: 0.86 },
    { id: "hihat", kind: "cymbal", body: "#ffd36b", rim: "#fff1c2", head: "#ffe39a", glow: "#ffe08a", scale: 0.8 },
    { id: "tom", kind: "drum", body: "#7fe0a0", rim: "#d6ffe3", head: "#eefff3", glow: "#a4f0bc", scale: 0.86 },
    { id: "cowbell", kind: "bell", body: "#c9c3ff", rim: "#ebe8ff", head: "#f6f4ff", glow: "#d9d4ff", scale: 0.78 },
    { id: "crash", kind: "cymbal", body: "#ffb86b", rim: "#ffe4c2", head: "#ffd39a", glow: "#ffcf94", scale: 0.96 }
  ];

  // ---- shared drawing helpers (used in-game AND for kidIcon) ----
  function drawDrum(g, r, p, squash) {
    const sq = squash || 0;
    g.save();
    g.scale(1 + sq * 0.18, 1 - sq * 0.18);
    // body (shell)
    g.shadowColor = p.glow; g.shadowBlur = r * 0.45;
    g.fillStyle = p.body;
    g.beginPath(); g.ellipse(0, r * 0.42, r, r * 0.42, 0, 0, Math.PI); g.fill();
    g.fillRect(-r, r * 0.02, r * 2, r * 0.42);
    g.shadowBlur = 0;
    // lugs
    g.fillStyle = "rgba(255,255,255,0.35)";
    [-0.75, -0.25, 0.25, 0.75].forEach(function (d) { g.fillRect(d * r - r * 0.04, r * 0.06, r * 0.08, r * 0.5); });
    // head (top skin)
    const hg = g.createRadialGradient(-r * 0.25, -r * 0.1, r * 0.05, 0, 0, r * 1.05);
    hg.addColorStop(0, "#ffffff"); hg.addColorStop(0.6, p.head); hg.addColorStop(1, p.rim);
    g.fillStyle = hg;
    g.beginPath(); g.ellipse(0, 0, r, r * 0.42, 0, 0, Math.PI * 2); g.fill();
    // rim
    g.strokeStyle = p.body; g.lineWidth = r * 0.1;
    g.beginPath(); g.ellipse(0, 0, r, r * 0.42, 0, 0, Math.PI * 2); g.stroke();
    g.restore();
  }
  function drawCymbal(g, r, p, squash) {
    const sq = squash || 0;
    g.save();
    g.rotate(sq * 0.12);
    g.scale(1, 1 - sq * 0.12);
    g.shadowColor = p.glow; g.shadowBlur = r * 0.5;
    const cg = g.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.05, 0, 0, r);
    cg.addColorStop(0, "#ffffff"); cg.addColorStop(0.3, p.head); cg.addColorStop(1, p.body);
    g.fillStyle = cg;
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
    // concentric grooves
    g.strokeStyle = "rgba(120,80,20,0.22)"; g.lineWidth = Math.max(1, r * 0.025);
    [0.85, 0.7, 0.55, 0.4].forEach(function (k) { g.beginPath(); g.arc(0, 0, r * k, 0, Math.PI * 2); g.stroke(); });
    // bell
    g.fillStyle = p.rim; g.beginPath(); g.arc(0, 0, r * 0.22, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(90,60,10,0.5)"; g.beginPath(); g.arc(0, 0, r * 0.06, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  function drawBell(g, r, p, squash) {
    const sq = squash || 0;
    g.save();
    g.rotate(sq * 0.2);
    g.scale(1 + sq * 0.1, 1 - sq * 0.1);
    g.shadowColor = p.glow; g.shadowBlur = r * 0.45;
    const bg = g.createLinearGradient(-r, 0, r, 0);
    bg.addColorStop(0, p.body); bg.addColorStop(0.5, p.head); bg.addColorStop(1, p.body);
    g.fillStyle = bg;
    g.beginPath();
    g.moveTo(-r * 0.45, -r * 0.85); g.lineTo(r * 0.45, -r * 0.85);
    g.lineTo(r * 0.8, r * 0.75); g.lineTo(-r * 0.8, r * 0.75); g.closePath(); g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = p.rim; g.lineWidth = r * 0.07; g.lineJoin = "round"; g.stroke();
    // opening at the bottom
    g.fillStyle = "rgba(30,20,50,0.7)";
    g.beginPath(); g.ellipse(0, r * 0.75, r * 0.78, r * 0.16, 0, 0, Math.PI * 2); g.fill();
    // handle loop
    g.strokeStyle = p.rim; g.lineWidth = r * 0.08;
    g.beginPath(); g.arc(0, -r * 0.85, r * 0.2, Math.PI, 0); g.stroke();
    g.restore();
  }
  function drawPad(g, r, p, squash) {
    if (p.kind === "drum") drawDrum(g, r, p, squash);
    else if (p.kind === "cymbal") drawCymbal(g, r, p, squash);
    else drawBell(g, r, p, squash);
  }
  function drawStick(g, len, w) {
    g.save();
    g.lineCap = "round";
    g.strokeStyle = "#e8c79a"; g.lineWidth = w;
    g.beginPath(); g.moveTo(-len / 2, 0); g.lineTo(len / 2, 0); g.stroke();
    g.fillStyle = "#fff1dc"; g.beginPath(); g.arc(len / 2, 0, w * 0.9, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  Arcade.register({
    id: "drums",
    name: "Drums",
    tagline: "Bang the drums! Every pad has its own sound.",
    accent: "#ffd36b",
    complexity: "low",
    controls: "click",
    scoreLabel: "Hits",
    kid: true,
    kidIcon(g, s) {
      g.save(); g.translate(s / 2, s * 0.5);
      drawDrum(g, s * 0.32, PADS[0], 0);
      // crossed drumsticks over the drum
      g.save(); g.translate(0, -s * 0.08); g.rotate(-0.6); drawStick(g, s * 0.62, s * 0.04); g.restore();
      g.save(); g.translate(0, -s * 0.08); g.rotate(0.6); drawStick(g, s * 0.62, s * 0.04); g.restore();
      g.restore();
    },
    create() {
      let stageEl, ctx, canvas, g, unResize = null;
      let S = 0, dpr = 1, reduced = false;
      let now = 0, hits = 0;
      let pads = [];          // {p, x, y, r, sq, last, idle}
      let ripples = [];       // {x,y,r,max,life,col}
      let sparks = [];        // {x,y,vx,vy,life,r,col}
      let confetti = [];
      let flash = 0;
      const COLS = 3, ROWS = 2;

      function resize() {
        S = Arcade.board.stageSize(880);
        dpr = window.devicePixelRatio || 1;
        canvas.style.width = S + "px"; canvas.style.height = S + "px";
        canvas.width = Math.round(S * dpr); canvas.height = Math.round(S * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        layout();
      }
      function layout() {
        const old = pads;
        pads = [];
        const gx = S * 0.05, gy = S * 0.15, gw = S * 0.9, gh = S * 0.82;
        const cw = gw / COLS, ch = gh / ROWS;
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
          const i = r * COLS + c, prev = old[i], p = PADS[i];
          pads.push({ p: p, x: gx + cw * (c + 0.5), y: gy + ch * (r + 0.5), r: Math.min(cw, ch) * 0.36 * p.scale,
            sq: prev ? prev.sq : 0, last: prev ? prev.last : -1000, idle: i * 1.1 });
        }
      }

      // ---- voices ----
      function rnd(a, b) { return a + Math.random() * (b - a); }
      function play(id) {
        const A = ctx.audio;
        if (id === "bass") { A.tone(80, 0.3, { type: "sine", vol: 0.2, glide: 45, attack: 0.005 }); }
        else if (id === "snare") {
          A.tone(210, 0.1, { type: "sawtooth", vol: 0.08, glide: 130, attack: 0.003 });
          for (let i = 0; i < 7; i++) A.tone(rnd(1800, 6500), 0.035, { type: "sawtooth", vol: 0.03, when: Math.random() * 0.05, attack: 0.002 });
        }
        else if (id === "hihat") { for (let i = 0; i < 6; i++) A.tone(rnd(5000, 9500), 0.05, { type: i % 2 ? "square" : "sawtooth", vol: 0.022, when: Math.random() * 0.02, attack: 0.002 }); }
        else if (id === "tom") { A.tone(220, 0.25, { type: "sine", vol: 0.18, glide: 150, attack: 0.005 }); }
        else if (id === "cowbell") { A.chord([560, 840], 0.15, { type: "square", vol: 0.06, attack: 0.003 }); }
        else if (id === "crash") { for (let i = 0; i < 9; i++) A.tone(rnd(2000, 5000), 0.8, { type: "sine", vol: 0.03, when: Math.random() * 0.03, attack: 0.004 }); }
      }

      function hitPad(pd) {
        if (now - pd.last < 60) return;
        pd.last = now;
        hits++; ctx.setScore(hits);
        pd.sq = 1; flash = 1;
        play(pd.p.id);
        ripples.push({ x: pd.x, y: pd.y, r: pd.r * 0.9, max: pd.r * 2.1, life: 1, col: pd.p.glow });
        const n = reduced ? 5 : 14;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2, sp = S * rnd(0.0004, 0.0009);
          sparks.push({ x: pd.x + Math.cos(a) * pd.r * 0.6, y: pd.y + Math.sin(a) * pd.r * 0.4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - S * 0.0003, life: 1, r: S * rnd(0.004, 0.009), col: i % 3 ? pd.p.rim : "#ffffff" });
        }
        if (hits % 16 === 0) {
          ctx.audio.arp([784, 1046, 1318, 1568], { dur: 0.16, step: 0.07, vol: 0.12, type: "sine", when: 0.1 });
          const m = reduced ? 16 : 60;
          for (let i = 0; i < m; i++) {
            confetti.push({ x: S * rnd(0.1, 0.9), y: -S * rnd(0, 0.2), vx: S * rnd(-0.0002, 0.0002), vy: S * rnd(0.0002, 0.0005), life: 1, r: S * rnd(0.006, 0.011), rot: Math.random() * 6.28, col: ["#ffd36b", "#ff8fd0", "#74b9ff", "#7fe0a0", "#ffb86b", "#c9c3ff"][i % 6] });
          }
        }
      }

      function update(dt) {
        now += dt;
        if (flash > 0) flash = Math.max(0, flash - dt / 200);
        pads.forEach(function (pd) { if (pd.sq > 0) pd.sq = Math.max(0, pd.sq - dt / 220); });
        for (let i = ripples.length - 1; i >= 0; i--) { const rp = ripples[i]; rp.r += (rp.max - rp.r) * Math.min(1, dt / 120); rp.life -= dt / 450; if (rp.life <= 0) ripples.splice(i, 1); }
        for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.vy += S * 0.0000012 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt / 600; if (s.life <= 0) sparks.splice(i, 1); }
        for (let i = confetti.length - 1; i >= 0; i--) { const c = confetti[i]; c.x += (c.vx + Math.sin(now * 0.004 + c.rot) * S * 0.0001) * dt; c.y += c.vy * dt; c.rot += dt * 0.004; if (c.y > S * 1.05) confetti.splice(i, 1); }
      }

      function draw() {
        g.clearRect(0, 0, S, S);
        const bg = g.createLinearGradient(0, 0, 0, S);
        bg.addColorStop(0, "#141024"); bg.addColorStop(1, "#1e1430");
        g.fillStyle = bg; g.fillRect(0, 0, S, S);
        if (flash > 0) { g.fillStyle = "rgba(255,211,107," + (flash * 0.06) + ")"; g.fillRect(0, 0, S, S); }
        // soft stage floor
        g.fillStyle = "rgba(255,255,255,0.03)"; g.beginPath(); g.ellipse(S / 2, S * 0.62, S * 0.5, S * 0.42, 0, 0, Math.PI * 2); g.fill();
        // counter
        g.save(); g.textAlign = "center"; g.textBaseline = "top";
        g.fillStyle = "#ffd36b"; g.shadowColor = "rgba(255,211,107,0.6)"; g.shadowBlur = 16;
        g.font = "800 " + Math.round(S * 0.075) + "px system-ui, sans-serif";
        g.fillText("★ " + hits, S / 2, S * 0.03);
        g.restore();
        // ripples
        ripples.forEach(function (rp) { g.save(); g.globalAlpha = Math.max(0, rp.life) * 0.7; g.strokeStyle = rp.col; g.lineWidth = S * 0.012 * rp.life + 1; g.shadowColor = rp.col; g.shadowBlur = 14; g.beginPath(); g.ellipse(rp.x, rp.y, rp.r, rp.r * 0.75, 0, 0, Math.PI * 2); g.stroke(); g.restore(); });
        // pads
        pads.forEach(function (pd) {
          const pulse = reduced ? 1 : 1 + 0.025 * Math.sin(now * 0.0022 + pd.idle);
          g.save(); g.translate(pd.x, pd.y); g.scale(pulse, pulse);
          drawPad(g, pd.r, pd.p, pd.sq);
          g.restore();
        });
        // sparks + confetti
        sparks.forEach(function (s) { g.save(); g.globalAlpha = Math.max(0, s.life); g.fillStyle = s.col; g.shadowColor = s.col; g.shadowBlur = 8; g.beginPath(); g.arc(s.x, s.y, s.r * s.life, 0, Math.PI * 2); g.fill(); g.restore(); });
        confetti.forEach(function (c) { g.save(); g.fillStyle = c.col; g.translate(c.x, c.y); g.rotate(c.rot); g.fillRect(-c.r, -c.r * 0.6, c.r * 2, c.r * 1.2); g.restore(); });
      }

      return {
        mount(stage, c) {
          stageEl = stage; ctx = c;
          reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          const wrap = document.createElement("div");
          wrap.style.display = "flex"; wrap.style.flexDirection = "column"; wrap.style.alignItems = "center";
          canvas = document.createElement("canvas");
          canvas.style.borderRadius = "18px"; canvas.style.background = "#141024"; canvas.style.cursor = "pointer";
          canvas.style.boxShadow = "0 0 46px rgba(255,211,107,0.14)"; canvas.style.touchAction = "none";
          g = canvas.getContext("2d");
          wrap.appendChild(canvas);
          const hint = document.createElement("div"); hint.className = "hint";
          hint.textContent = "Tap the drums. Every pad makes its own sound.";
          wrap.appendChild(hint);
          stage.appendChild(wrap);
          now = 0; hits = 0; ripples = []; sparks = []; confetti = []; flash = 0; pads = [];
          resize();
          ctx.setScore(0);
          Arcade.input.setPointerTarget(canvas);
          unResize = Arcade.board.onResize(function () { resize(); });
          draw();
        },
        handleInput(intent) {
          if (intent.type !== "point" || intent.phase !== "down" || intent.button !== 0) return;
          let best = null, bd = Infinity;
          pads.forEach(function (pd) {
            const d = Math.hypot(intent.x - pd.x, (intent.y - pd.y) * 1.15);
            if (d < pd.r * 1.45 && d < bd) { bd = d; best = pd; }
          });
          if (best) hitPad(best);
          else ctx.audio.tone(330, 0.06, { type: "sine", vol: 0.03, glide: 400 });   // soft blip on empty space
        },
        tick(dt) { update(Math.min(50, dt)); draw(); },
        getScore() { return hits; },
        teardown() {
          if (unResize) unResize(); unResize = null;
          stageEl = ctx = canvas = g = null; pads = []; ripples = []; sparks = []; confetti = [];
        }
      };
    }
  });
})();
