/* Bloom — a screensaver you play. A soft neon halo breathes out and in at a
   calm tempo; click when it reaches the outer ring to add a petal and grow a
   glowing mandala flower. On-beat = a warm rising chime + a new petal. Off-beat
   just dims the bloom for a moment — no fail, endless zen. */
(function () {
  Arcade.register({
    id: "bloom",
    name: "*Bloom*",
    tagline: "Click on the beat to grow a neon flower.",
    accent: "#dc7fc8",
    complexity: "med",
    controls: "click",
    scoreLabel: "Petals",
    create() {
      let stageEl, ctx, canvas, g, unResize = null;
      let cssW = 0, cssH = 0, dpr = 1, reduced = false;

      const BEAT = 1100;      // ms per breath
      const WINDOW = 190;     // ms timing window around the peak
      // major-pentatonic run — rises as the flower grows, loops gently
      const PENT = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00];

      let petals;             // [{i, born}]
      let beatClock;          // 0..BEAT
      let lastBeatFlash;      // ms since a beat landed (for marker pulse)
      let rot;                // mandala rotation
      let wilt;               // 0..1 transient dim
      let hitFlash;           // 0..1 pulse when a petal lands
      let accRgb;
      let ringScale;          // current marker-ring size multiplier (randomized per blossom)
      let ringScaleTarget;    // eases toward this so the ring resizes smoothly

      // pick a fresh random ring size — big, small, medium, whatever
      function randomRingScale() { return 0.45 + Math.random() * 0.75; }   // 0.45x .. 1.20x

      function hexToRgb(hex) {
        const h = (hex || "#dc7fc8").replace("#", "");
        return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
      }
      function mixWhite(c, t) {
        return {
          r: Math.round(c.r + (255 - c.r) * t),
          g: Math.round(c.g + (255 - c.g) * t),
          b: Math.round(c.b + (255 - c.b) * t)
        };
      }
      function rgba(c, a) { return "rgba(" + c.r + "," + c.g + "," + c.b + "," + a + ")"; }

      function resize() {
        const size = Arcade.board.stageSize(860);
        cssW = Math.round(size); cssH = Math.round(size);
        dpr = window.devicePixelRatio || 1;
        canvas.style.width = cssW + "px";
        canvas.style.height = cssH + "px";
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      function reset() {
        petals = [];
        beatClock = 0;
        lastBeatFlash = BEAT;
        rot = 0;
        wilt = 0;
        hitFlash = 0;
        ringScale = randomRingScale();
        ringScaleTarget = ringScale;
      }

      // ring capacities: 6, 12, 18, ... find ring + position for petal index i
      function ringOf(i) {
        let r = 0, base = 0;
        for (;;) {
          const cap = 6 + r * 6;
          if (i < base + cap) return { ring: r, pos: i - base, cap: cap };
          base += cap; r++;
        }
      }

      // max the ring could ever be; the live marker uses this * ringScale
      function maxFit() { return Math.min(cssW, cssH) * 0.5 * 0.80; }
      function fitRadius() { return maxFit() * ringScale; }

      function distToBeat() { return Math.min(beatClock, BEAT - beatClock); }

      function onClick() {
        const d = distToBeat();
        if (d <= WINDOW) {
          // on-beat: bloom a petal + rising chime
          const idx = petals.length;
          petals.push({ i: idx, born: performance.now() });
          const f = PENT[idx % PENT.length];
          ctx.audio.chord([f, f * 2], 0.5, { type: "sine", vol: 0.09, attack: 0.02 });
          hitFlash = 1;
          wilt = Math.max(0, wilt - 0.3);
          ctx.setScore(petals.length);
          // every blossom re-randomizes the marker-ring radius (big/small/medium)
          ringScaleTarget = randomRingScale();
        } else {
          // off-beat: gentle wilt, never punishing
          wilt = Math.min(1, wilt + 0.5);
          ctx.audio.tone(160, 0.2, { type: "sine", vol: 0.06, glide: 118 });
        }
      }

      function update(dt) {
        // ease the ring toward its target size so it grows/shrinks smoothly
        ringScale += (ringScaleTarget - ringScale) * Math.min(1, dt / 260);
        beatClock += dt;
        if (beatClock >= BEAT) { beatClock -= BEAT; lastBeatFlash = 0; ctx.audio.tone(880, 0.03, { type: "sine", vol: 0.022 }); }
        lastBeatFlash += dt;
        rot += dt * (reduced ? 0 : 0.00007);
        if (wilt > 0) wilt = Math.max(0, wilt - dt * 0.0022);
        if (hitFlash > 0) hitFlash = Math.max(0, hitFlash - dt * 0.004);
      }

      function drawPetal(cx, cy, R, ang, len, wid, col, alpha) {
        g.save();
        g.translate(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R);
        g.rotate(ang);
        g.shadowColor = rgba(col, Math.min(0.6, alpha));
        g.shadowBlur = wid * 1.6;
        g.fillStyle = rgba(col, alpha);
        g.beginPath();
        g.ellipse(0, 0, len, wid, 0, 0, Math.PI * 2);
        g.fill();
        // soft bright core
        g.shadowBlur = 0;
        g.fillStyle = rgba(mixWhite(col, 0.55), alpha * 0.55);
        g.beginPath();
        g.ellipse(-len * 0.15, 0, len * 0.45, wid * 0.45, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }

      function draw() {
        g.clearRect(0, 0, cssW, cssH);
        const cx = cssW / 2, cy = cssH / 2;
        const fit = fitRadius();

        // background radial glow
        const bg = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(cssW, cssH) * 0.62);
        bg.addColorStop(0, rgba(accRgb, 0.06));
        bg.addColorStop(0.5, rgba(accRgb, 0.02));
        bg.addColorStop(1, "rgba(6,8,12,0)");
        g.fillStyle = bg;
        g.fillRect(0, 0, cssW, cssH);

        const dim = 1 - wilt * 0.45;

        // ---- mandala flower ----
        const step = fit * 0.135;
        const coreR = fit * 0.05;
        const now = performance.now();
        // auto-scale so the outermost ring stays inside the marker
        let maxRingR = coreR;
        if (petals.length) {
          const last = ringOf(petals.length - 1);
          maxRingR = coreR + (last.ring + 1) * step;
        }
        const flowerScale = Math.min(1, (fit * 0.86) / (maxRingR + step * 0.5));

        g.save();
        g.translate(cx, cy);
        g.rotate(rot);
        g.scale(flowerScale, flowerScale);

        for (let k = 0; k < petals.length; k++) {
          const p = petals[k];
          const info = ringOf(p.i);
          const R = coreR + (info.ring + 1) * step;
          const ang = (Math.PI * 2 * info.pos) / info.cap + info.ring * 0.4;
          const age = now - p.born;
          const grow = Math.min(1, age / 380);
          const sc = grow * grow * (3 - 2 * grow); // smoothstep
          const inner = Math.max(0, 1 - info.ring * 0.16);
          const col = mixWhite(accRgb, inner * 0.35);
          const alpha = (0.42 + inner * 0.35) * dim * sc;
          const len = step * 0.72 * sc;
          const wid = step * 0.30 * sc;
          drawPetal(0, 0, R, ang, len, wid, col, alpha);
        }

        // glowing core
        const coreGrad = g.createRadialGradient(0, 0, 0, 0, 0, coreR * 2.2);
        coreGrad.addColorStop(0, rgba(mixWhite(accRgb, 0.7), (0.5 + hitFlash * 0.4) * dim));
        coreGrad.addColorStop(1, rgba(accRgb, 0));
        g.fillStyle = coreGrad;
        g.beginPath();
        g.arc(0, 0, coreR * 2.2, 0, Math.PI * 2);
        g.fill();
        g.restore();

        // ---- breathing halo + marker (the beat cue) ----
        const phase = beatClock / BEAT;
        const amp = reduced ? fit * 0.10 : fit * 0.42;
        const haloR = fit - amp * (0.5 - 0.5 * Math.cos(Math.PI * 2 * phase));
        // marker ring (flashes on beat)
        const beatGlow = Math.max(0, 1 - lastBeatFlash / 260);
        g.save();
        g.strokeStyle = rgba(mixWhite(accRgb, 0.2), 0.18 + beatGlow * 0.35);
        g.lineWidth = 1.5;
        g.shadowColor = rgba(accRgb, 0.4 * (0.4 + beatGlow));
        g.shadowBlur = 12 + beatGlow * 14;
        g.beginPath();
        g.arc(cx, cy, fit, 0, Math.PI * 2);
        g.stroke();
        // breathing halo — near marker = on beat
        const near = Math.max(0, 1 - distToBeat() / WINDOW);
        g.strokeStyle = rgba(mixWhite(accRgb, 0.35), 0.35 + near * 0.4);
        g.lineWidth = 2 + near * 2;
        g.shadowBlur = 10 + near * 20;
        g.beginPath();
        g.arc(cx, cy, haloR, 0, Math.PI * 2);
        g.stroke();
        g.restore();

        // small beat pip at top
        g.save();
        g.fillStyle = rgba(mixWhite(accRgb, 0.5), 0.3 + beatGlow * 0.6);
        g.shadowColor = rgba(accRgb, 0.6);
        g.shadowBlur = 8 + beatGlow * 12;
        g.beginPath();
        g.arc(cx, cy - fit, 3 + beatGlow * 3, 0, Math.PI * 2);
        g.fill();
        g.restore();

        // gentle "click to bloom" prompt before first petal
        if (!petals.length) {
          g.save();
          g.globalAlpha = 0.55 + 0.2 * Math.sin(now * 0.003);
          g.fillStyle = rgba(mixWhite(accRgb, 0.6), 0.9);
          g.font = Math.round(cssW * 0.04) + "px system-ui, sans-serif";
          g.textAlign = "center";
          g.fillText("click when the ring meets the edge", cx, cy);
          g.restore();
        }
      }

      return {
        mount(stage, c) {
          stageEl = stage; ctx = c;
          reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          accRgb = hexToRgb(ctx.accent || "#dc7fc8");

          const wrap = document.createElement("div");
          wrap.style.display = "flex";
          wrap.style.flexDirection = "column";
          wrap.style.alignItems = "center";

          canvas = document.createElement("canvas");
          canvas.style.borderRadius = "50%";
          canvas.style.background = "radial-gradient(circle, rgba(14,10,18,0.7), rgba(8,6,12,0.85))";
          canvas.style.boxShadow = "0 0 46px rgba(220,127,200,0.14)";
          g = canvas.getContext("2d");
          wrap.appendChild(canvas);

          const hint = document.createElement("div");
          hint.className = "hint";
          hint.textContent = "Click on the beat to bloom";
          wrap.appendChild(hint);

          stage.appendChild(wrap);

          resize();
          reset();
          ctx.setScore(0);
          Arcade.input.setPointerTarget(canvas);
          draw();
          unResize = Arcade.board.onResize(() => { resize(); draw(); });
        },

        handleInput(intent) {
          if (intent.type === "action") onClick();
          else if (intent.type === "point" && intent.phase === "down" && intent.button === 0) onClick();
        },

        tick(dt) { update(dt); draw(); },

        teardown() {
          if (unResize) unResize();
          unResize = null;
          stageEl = ctx = canvas = g = null;
          petals = null;
        }
      };
    }
  });
})();
