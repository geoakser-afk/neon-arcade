/* Farm — made for Christopher (age 5). Six big animal faces on a night meadow:
   cow, sheep, duck, dog, cat, pig. Tap one: it squishes, little hearts and notes
   float up, and it talks — every voice is synthesized through ctx.audio.
   Nothing to lose, no clock. Every 10 taps: a happy arpeggio + confetti. */
(function () {
  const ANIMALS = {
    cow:   { body: "#f7f4ff", shade: "#d8d2ea", glow: "#f7f4ff", eye: "#3a2a44", spot: "#3a2a44", nose: "#ffb3d1", horn: "#e8d5a3" },
    sheep: { body: "#d9c6e6", shade: "#b39ccb", glow: "#fff6e8", eye: "#3a2a44", fluff: "#fff6e8" },
    duck:  { body: "#fff0a0", shade: "#ffd05a", glow: "#fff0a0", eye: "#3a3020", beak: "#ff9f5a" },
    dog:   { body: "#d9a066", shade: "#b5784a", glow: "#d9a066", eye: "#3a2a20", ear: "#a86a3e", muzzle: "#f0d9b8" },
    cat:   { body: "#c9c3ff", shade: "#a89dff", glow: "#c9c3ff", eye: "#2a2a44", inner: "#ffb3d1" },
    pig:   { body: "#ffc4d6", shade: "#ff9fbd", glow: "#ffc4d6", eye: "#3a2a30", snout: "#ff9fbd" }
  };
  const ORDER = ["cow", "sheep", "duck", "dog", "cat", "pig"];

  function ell(g, x, y, rx, ry, rot) { g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); g.fill(); }

  // Draws one animal face centered at (x,y) with head radius r. o = { sq: 0..1 squish, blink: bool }
  function drawFace(g, kind, x, y, r, o) {
    o = o || {};
    const C = ANIMALS[kind], sq = o.sq || 0, blink = !!o.blink || sq > 0.4, open = sq > 0.3;
    g.save(); g.translate(x, y); g.scale(1 + sq * 0.25, 1 - sq * 0.25);
    g.shadowColor = C.glow; g.shadowBlur = r * 0.45;
    const gr = g.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.2);
    gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.25, C.body); gr.addColorStop(1, C.shade);
    // things behind the head (ears, horns, fluff)
    if (kind === "cow") {
      g.fillStyle = C.horn; ell(g, -r * 0.72, -r * 0.88, r * 0.14, r * 0.34, 0.55); ell(g, r * 0.72, -r * 0.88, r * 0.14, r * 0.34, -0.55);
      g.fillStyle = gr; ell(g, -r * 0.98, -r * 0.2, r * 0.32, r * 0.18, 0.35); ell(g, r * 0.98, -r * 0.2, r * 0.32, r * 0.18, -0.35);
    } else if (kind === "sheep") {
      g.fillStyle = C.fluff;
      for (let i = 0; i < 9; i++) { const a = i * Math.PI * 2 / 9; ell(g, Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95, r * 0.42, r * 0.42); }
      ell(g, 0, -r * 1.05, r * 0.4, r * 0.36);
      g.fillStyle = gr; ell(g, -r * 0.95, r * 0.1, r * 0.3, r * 0.17, 0.25); ell(g, r * 0.95, r * 0.1, r * 0.3, r * 0.17, -0.25);
    } else if (kind === "duck") {
      g.fillStyle = C.shade;
      [-0.28, 0, 0.28].forEach(function (d, i) { g.beginPath(); g.moveTo(d * r - r * 0.12, -r * 0.85); g.lineTo(d * r + (i - 1) * r * 0.12, -r * 1.35); g.lineTo(d * r + r * 0.12, -r * 0.85); g.closePath(); g.fill(); });
    } else if (kind === "dog") {
      g.fillStyle = C.ear; ell(g, -r * 0.88, -r * 0.05, r * 0.32, r * 0.58, 0.25); ell(g, r * 0.88, -r * 0.05, r * 0.32, r * 0.58, -0.25);
    } else if (kind === "cat") {
      [-1, 1].forEach(function (s) {
        g.fillStyle = gr; g.beginPath(); g.moveTo(s * r * 0.3, -r * 0.7); g.lineTo(s * r * 0.85, -r * 1.35); g.lineTo(s * r * 0.95, -r * 0.5); g.closePath(); g.fill();
        g.fillStyle = C.inner; g.beginPath(); g.moveTo(s * r * 0.45, -r * 0.8); g.lineTo(s * r * 0.8, -r * 1.18); g.lineTo(s * r * 0.87, -r * 0.66); g.closePath(); g.fill();
      });
    } else if (kind === "pig") {
      g.fillStyle = C.shade; ell(g, -r * 0.75, -r * 0.6, r * 0.28, r * 0.44, 0.6); ell(g, r * 0.75, -r * 0.6, r * 0.28, r * 0.44, -0.6);
    }
    // head
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0;
    // muzzles / spots / beaks
    if (kind === "cow") {
      g.save(); g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.clip();
      g.fillStyle = C.spot; ell(g, -r * 0.62, -r * 0.55, r * 0.34, r * 0.24, 0.5); ell(g, r * 0.7, r * 0.2, r * 0.26, r * 0.36, 0.3);
      g.restore();
      g.fillStyle = C.nose; ell(g, 0, r * 0.45, r * 0.5, r * 0.3);
      g.fillStyle = C.eye; ell(g, -r * 0.18, r * 0.4, r * 0.07, r * 0.05); ell(g, r * 0.18, r * 0.4, r * 0.07, r * 0.05);
    } else if (kind === "duck") {
      g.fillStyle = C.beak; ell(g, 0, r * 0.38, r * 0.5, r * 0.24);
      g.strokeStyle = "rgba(120,60,20,0.5)"; g.lineWidth = r * 0.04; g.lineCap = "round";
      g.beginPath(); g.moveTo(-r * 0.4, r * 0.4); g.quadraticCurveTo(0, r * 0.55 + sq * r * 0.2, r * 0.4, r * 0.4); g.stroke();
    } else if (kind === "dog") {
      g.fillStyle = "rgba(168,106,62,0.55)"; ell(g, r * 0.38, -r * 0.18, r * 0.3, r * 0.34);
      g.fillStyle = C.muzzle; ell(g, 0, r * 0.45, r * 0.46, r * 0.34);
      g.fillStyle = C.eye; ell(g, 0, r * 0.3, r * 0.18, r * 0.13);
    } else if (kind === "pig") {
      g.fillStyle = C.snout; ell(g, 0, r * 0.28, r * 0.38, r * 0.27);
      g.fillStyle = C.eye; ell(g, -r * 0.13, r * 0.28, r * 0.06, r * 0.08); ell(g, r * 0.13, r * 0.28, r * 0.06, r * 0.08);
    }
    // eyes (big, blink occasionally / squint on squish)
    const ey = (kind === "cow" || kind === "dog") ? -r * 0.22 : -r * 0.12;
    g.fillStyle = C.eye;
    [-1, 1].forEach(function (s) {
      if (blink) { g.lineWidth = r * 0.08; g.strokeStyle = C.eye; g.lineCap = "round"; g.beginPath(); g.moveTo(s * r * 0.38 - r * 0.14, ey); g.lineTo(s * r * 0.38 + r * 0.14, ey); g.stroke(); }
      else { ell(g, s * r * 0.38, ey, r * 0.16, r * 0.2); g.fillStyle = "#fff"; g.beginPath(); g.arc(s * r * 0.38 - r * 0.06, ey - r * 0.08, r * 0.065, 0, Math.PI * 2); g.fill(); g.fillStyle = C.eye; }
    });
    // cheeks
    g.fillStyle = "rgba(255,110,140,0.35)"; ell(g, -r * 0.66, r * 0.18, r * 0.17, r * 0.11); ell(g, r * 0.66, r * 0.18, r * 0.17, r * 0.11);
    // mouth
    g.strokeStyle = C.eye; g.lineWidth = r * 0.06; g.lineCap = "round";
    if (kind === "cow") { g.beginPath(); g.arc(0, r * 0.52, r * (open ? 0.2 : 0.14), 0.2 * Math.PI, 0.8 * Math.PI); g.stroke(); }
    else if (kind === "dog") {
      [-1, 1].forEach(function (s) { g.beginPath(); g.arc(s * r * 0.16, r * 0.42, r * 0.16, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke(); });
      if (open) { g.fillStyle = "#ff8fa3"; ell(g, 0, r * 0.7, r * 0.12, r * 0.14); }
    } else if (kind === "cat") {
      g.fillStyle = C.inner; g.beginPath(); g.moveTo(-r * 0.1, r * 0.18); g.lineTo(r * 0.1, r * 0.18); g.lineTo(0, r * 0.3); g.closePath(); g.fill();
      [-1, 1].forEach(function (s) { g.beginPath(); g.arc(s * r * 0.13, r * 0.3, r * 0.13, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke(); });
      g.lineWidth = r * 0.035; g.strokeStyle = "rgba(42,42,68,0.6)";
      [-1, 1].forEach(function (s) { [-0.1, 0.05, 0.2].forEach(function (dy) { g.beginPath(); g.moveTo(s * r * 0.5, r * (0.25 + dy)); g.lineTo(s * r * 1.15, r * (0.1 + dy * 1.8)); g.stroke(); }); });
    } else if (kind === "pig") { g.beginPath(); g.arc(0, r * 0.52, r * (open ? 0.3 : 0.24), 0.2 * Math.PI, 0.8 * Math.PI); g.stroke(); }
    else if (kind === "sheep") { g.beginPath(); g.arc(0, r * 0.3, r * (open ? 0.28 : 0.18), 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
    g.restore();
  }

  function drawHeart(g, x, y, s) {
    g.beginPath(); g.moveTo(x, y + s * 0.9);
    g.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.6, y - s * 1.1, x, y - s * 0.35);
    g.bezierCurveTo(x + s * 0.6, y - s * 1.1, x + s * 1.4, y - s * 0.1, x, y + s * 0.9);
    g.fill();
  }
  function drawNote(g, x, y, s) {
    ell(g, x, y + s * 0.6, s * 0.55, s * 0.4, -0.4);
    g.strokeStyle = g.fillStyle; g.lineWidth = s * 0.22; g.lineCap = "round";
    g.beginPath(); g.moveTo(x + s * 0.45, y + s * 0.5); g.lineTo(x + s * 0.45, y - s * 1.1);
    g.quadraticCurveTo(x + s * 1.1, y - s * 0.9, x + s * 1.2, y - s * 0.4); g.stroke();
  }

  Arcade.register({
    id: "farm",
    name: "Farm",
    tagline: "Tap the animals to hear them talk.",
    accent: "#b6e388",
    complexity: "low",
    controls: "click",
    scoreLabel: "Taps",
    kid: true,
    kidName: "Farm",
    kidIcon(g, s) { drawFace(g, "cow", s / 2, s * 0.54, s * 0.27, {}); },
    create() {
      let stageEl, ctx, canvas, g, unResize = null;
      let S = 0, dpr = 1, reduced = false;
      let now = 0, taps = 0;
      let animals = [];            // {kind,x,y,r,sq,phase,lastVoice}
      let floaties = [], confetti = [];
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
        const old = animals;
        const gx = S * 0.05, gy = S * 0.16, gw = S * 0.9, gh = S * 0.8;
        const cw = gw / COLS, ch = gh / ROWS;
        animals = ORDER.map(function (kind, i) {
          const c = i % COLS, r = Math.floor(i / COLS), prev = old[i];
          return { kind: kind, x: gx + cw * (c + 0.5), y: gy + ch * (r + 0.55), r: Math.min(cw, ch) * 0.34,
            sq: prev ? prev.sq : 0, phase: prev ? prev.phase : i * 1.3, lastVoice: prev ? prev.lastVoice : -1e9 };
        });
      }

      // browser speech (no files, no network): says the noise AND the animal, so it's unmistakable
      const NOISE = { cow: "Moo! Cow.", sheep: "Baa! Sheep.", duck: "Quack quack! Duck.", dog: "Woof woof! Dog.", cat: "Meow! Cat.", pig: "Oink oink! Pig." };
      function speak(kind) { if (window.Arcade && Arcade.voice) Arcade.voice.say(NOISE[kind]); }
      // each animal's synthesized voice — layered sawtooth/triangle "formants" with
      // pitch bends and vibrato so they read as the real animal, not a beep.
      function vib(f, dur, opts) {
        // vibrato: chop a tone into short overlapping segments alternating slightly up/down
        const A = ctx.audio, seg = 0.045, n = Math.max(1, Math.round(dur / seg));
        for (let i = 0; i < n; i++) {
          const wob = 1 + (i % 2 ? 0.035 : -0.035) * (opts.depth || 1);
          A.tone(f * wob * (opts.bend ? Math.pow(opts.bend, i / n) : 1), seg * 1.3, { type: opts.type || "sawtooth", vol: opts.vol * (opts.fade ? 1 - i / n * 0.7 : 1), when: (opts.when || 0) + i * seg, attack: i === 0 ? (opts.attack || 0.03) : 0.01 });
        }
      }
      function voice(kind) {
        const A = ctx.audio;
        if (kind === "cow") {
          // "mmm-OOOO": low sawtooth swelling up a third then sagging, with a soft nasal octave
          A.tone(105, 0.35, { type: "sawtooth", vol: 0.07, glide: 130, attack: 0.12 });
          vib(130, 0.75, { type: "sawtooth", vol: 0.09, when: 0.3, bend: 0.85, depth: 0.8, fade: true });
          A.tone(210, 0.9, { type: "triangle", vol: 0.05, glide: 175, attack: 0.15, when: 0.25 });
          A.tone(65, 1.0, { type: "sine", vol: 0.12, glide: 55, attack: 0.2 });
        } else if (kind === "sheep") {
          // "b-a-a-a-a": fast wide vibrato on a bright nasal tone, dropping at the end
          A.tone(120, 0.05, { type: "triangle", vol: 0.1, attack: 0.005 });
          vib(330, 0.7, { type: "sawtooth", vol: 0.075, when: 0.05, bend: 0.8, depth: 2.2, fade: true });
          vib(660, 0.6, { type: "triangle", vol: 0.035, when: 0.08, bend: 0.8, depth: 2.2, fade: true });
        } else if (kind === "duck") {
          // "QUACK quack quack": buzzy sawtooth honks that bend down, quieter each time
          [0, 0.2, 0.38].forEach(function (w, i) {
            A.tone(520, 0.14, { type: "sawtooth", vol: 0.075 - i * 0.015, glide: 300, attack: 0.008, when: w });
            A.tone(1040, 0.1, { type: "square", vol: 0.02, glide: 700, attack: 0.008, when: w });
          });
        } else if (kind === "dog") {
          // "WOOF woof": a bark = sharp attack, quick fall from mid to low, chesty sub underneath
          [0, 0.26].forEach(function (w) {
            A.tone(300, 0.16, { type: "sawtooth", vol: 0.1, glide: 110, attack: 0.006, when: w });
            A.tone(600, 0.08, { type: "triangle", vol: 0.05, glide: 260, attack: 0.004, when: w });
            A.tone(95, 0.2, { type: "sine", vol: 0.16, glide: 60, attack: 0.01, when: w });
          });
        } else if (kind === "cat") {
          // "meee-OWWW": rises with light vibrato, then a slow whiny fall
          vib(520, 0.3, { type: "sawtooth", vol: 0.05, bend: 1.7, depth: 0.6 });
          vib(880, 0.5, { type: "sawtooth", vol: 0.055, when: 0.3, bend: 0.5, depth: 1.0, fade: true });
          A.tone(1040, 0.75, { type: "sine", vol: 0.05, glide: 500, attack: 0.1, when: 0.05 });
        } else if (kind === "pig") {
          // "OINK oink": a snort (buzzy burst that jumps up then drops) + a low grunt
          [0, 0.3].forEach(function (w) {
            A.tone(180, 0.09, { type: "sawtooth", vol: 0.08, glide: 380, attack: 0.005, when: w });
            A.tone(380, 0.12, { type: "sawtooth", vol: 0.07, glide: 150, attack: 0.005, when: w + 0.08 });
            for (let i = 0; i < 5; i++) A.tone(600 + Math.random() * 900, 0.03, { type: "square", vol: 0.02, when: w + 0.01 + i * 0.015, attack: 0.002 });
            A.tone(110, 0.22, { type: "sine", vol: 0.14, glide: 70, attack: 0.02, when: w + 0.06 });
          });
        }
      }

      function burst(x, y) {
        const n = reduced ? 10 : 36;
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2, sp = S * (0.0003 + Math.random() * 0.0006);
          confetti.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - S * 0.0004, life: 1, r: S * (0.005 + Math.random() * 0.007), col: ["#ffd36b", "#ff8fd0", "#74b9ff", "#7fe0a0", "#ffb86b", "#c9c3ff"][i % 6] });
        }
      }

      function tap(a) {
        taps++; ctx.setScore(taps);
        a.sq = 1;
        if (now - a.lastVoice > 220) { a.lastVoice = now; voice(a.kind); setTimeout(function () { if (ctx) speak(a.kind); }, 350); }
        const n = reduced ? 3 : 6;
        for (let i = 0; i < n; i++) {
          floaties.push({ x: a.x + (Math.random() - 0.5) * a.r * 1.4, y: a.y - a.r * 0.6, vx: (Math.random() - 0.5) * S * 0.00008, vy: -S * (0.00018 + Math.random() * 0.00012),
            life: 1, s: S * (0.012 + Math.random() * 0.01), kind: Math.random() < 0.6 ? "heart" : "note", col: ["#ff8fa3", "#ffd36b", "#ffffff", "#c9c3ff"][i % 4], wob: Math.random() * 6.28 });
        }
        if (taps % 10 === 0) { ctx.audio.arp([523, 659, 784, 1046, 1318], { dur: 0.18, step: 0.07, vol: 0.14, type: "sine", when: 0.15 }); burst(a.x, a.y); }
      }

      function update(dt) {
        now += dt;
        animals.forEach(function (a) { if (a.sq > 0) a.sq = Math.max(0, a.sq - dt / 350); });
        for (let i = floaties.length - 1; i >= 0; i--) {
          const f = floaties[i]; f.x += f.vx * dt + Math.sin(now * 0.004 + f.wob) * S * 0.00003 * dt; f.y += f.vy * dt; f.life -= dt / 1600;
          if (f.life <= 0) floaties.splice(i, 1);
        }
        for (let i = confetti.length - 1; i >= 0; i--) {
          const c = confetti[i]; c.vy += S * 0.0000015 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.life -= dt / 1300;
          if (c.life <= 0) confetti.splice(i, 1);
        }
      }

      function draw() {
        g.clearRect(0, 0, S, S);
        // night sky + meadow
        const sky = g.createLinearGradient(0, 0, 0, S);
        sky.addColorStop(0, "#141024"); sky.addColorStop(0.5, "#1c1630"); sky.addColorStop(1, "#16281f");
        g.fillStyle = sky; g.fillRect(0, 0, S, S);
        for (let i = 0; i < 26; i++) { const x = ((i * 137.5) % 100) / 100 * S, y = ((i * 91.7) % 40) / 100 * S; g.fillStyle = "rgba(255,255,255," + (0.15 + 0.35 * (0.5 + 0.5 * Math.sin(now * 0.002 + i))) + ")"; g.beginPath(); g.arc(x, y, S * 0.003, 0, Math.PI * 2); g.fill(); }
        g.save(); g.fillStyle = "#fff6d6"; g.shadowColor = "#fff6d6"; g.shadowBlur = S * 0.04; g.beginPath(); g.arc(S * 0.9, S * 0.1, S * 0.045, 0, Math.PI * 2); g.fill(); g.restore();
        g.fillStyle = "rgba(60,110,80,0.45)"; ell(g, S * 0.25, S * 1.02, S * 0.6, S * 0.55); g.fillStyle = "rgba(70,130,90,0.4)"; ell(g, S * 0.8, S * 1.05, S * 0.6, S * 0.5);
        // counter
        g.save(); g.textAlign = "center"; g.textBaseline = "top";
        g.fillStyle = "#ffd36b"; g.shadowColor = "rgba(255,211,107,0.6)"; g.shadowBlur = 16;
        g.font = "800 " + Math.round(S * 0.075) + "px system-ui, sans-serif";
        g.fillText("★ " + taps, S / 2, S * 0.03);
        g.restore();
        // animals (bob + blink)
        animals.forEach(function (a) {
          const bob = reduced ? 0 : Math.sin(now * 0.0022 + a.phase) * a.r * 0.05;
          const blink = Math.sin(now * 0.0025 + a.phase) > 0.975;
          drawFace(g, a.kind, a.x, a.y + bob, a.r, { sq: a.sq, blink: blink });
        });
        // floaties + confetti
        floaties.forEach(function (f) {
          g.save(); g.globalAlpha = Math.max(0, Math.min(1, f.life * 1.4)); g.fillStyle = f.col; g.shadowColor = f.col; g.shadowBlur = 8;
          if (f.kind === "heart") drawHeart(g, f.x, f.y, f.s); else drawNote(g, f.x, f.y, f.s);
          g.restore();
        });
        confetti.forEach(function (c) { g.save(); g.globalAlpha = Math.max(0, c.life); g.fillStyle = c.col; g.translate(c.x, c.y); g.rotate(c.x * 0.05); g.fillRect(-c.r, -c.r * 0.6, c.r * 2, c.r * 1.2); g.restore(); });
      }

      return {
        mount(stage, c) {
          stageEl = stage; ctx = c;
          reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          const wrap = document.createElement("div");
          wrap.style.display = "flex"; wrap.style.flexDirection = "column"; wrap.style.alignItems = "center";
          canvas = document.createElement("canvas");
          canvas.style.borderRadius = "18px"; canvas.style.background = "#141024"; canvas.style.cursor = "pointer";
          canvas.style.boxShadow = "0 0 46px rgba(182,227,136,0.14)"; canvas.style.touchAction = "none";
          g = canvas.getContext("2d");
          wrap.appendChild(canvas);
          const hint = document.createElement("div"); hint.className = "hint";
          hint.textContent = "Tap an animal to hear it talk.";
          wrap.appendChild(hint);
          stage.appendChild(wrap);
          now = 0; taps = 0; floaties = []; confetti = []; animals = [];
          resize();
          ctx.setScore(0);
          Arcade.input.setPointerTarget(canvas);
          unResize = Arcade.board.onResize(function () { resize(); });
          draw();
        },
        handleInput(intent) {
          if (intent.type !== "point" || intent.phase !== "down" || intent.button !== 0) return;
          let best = null, bd = Infinity;
          animals.forEach(function (a) {
            const d = Math.hypot(intent.x - a.x, intent.y - a.y);
            if (d < a.r * 1.5 && d < bd) { bd = d; best = a; }
          });
          if (best) { tap(best); return; }
          ctx.audio.tone(330, 0.08, { type: "sine", vol: 0.04, glide: 420 });   // gentle blip, nothing lost
        },
        tick(dt) { update(Math.min(50, dt)); draw(); },
        getScore() { return taps; },
        teardown() {
          if (window.Arcade && Arcade.voice) Arcade.voice.stop();
          if (unResize) unResize(); unResize = null;
          stageEl = ctx = canvas = g = null; animals = []; floaties = []; confetti = [];
        }
      };
    }
  });
})();
