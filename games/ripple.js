/* Ripple — a zen chain-reaction. Glowing lights drift across a dark pond;
   click to drop an expanding ring. Every light the ring touches pops and sends
   out its OWN ring, cascading through the swarm. Score = the length of the
   longest chain from a single click. Soft harmonic tones rise as the chain
   grows. New lights keep drifting in — endless and calm. */
(function () {
  Arcade.register({
    id: "ripple",
    name: "*Ripple*",
    tagline: "Click to send a ripple — pop the lights, chain them.",
    accent: "#6fd0e0",
    complexity: "low",
    controls: "click",
    scoreLabel: "Chain",
    create() {
      let stageEl, ctx, canvas, g, unResize = null;
      let cssS = 0, dpr = 1, reduced = false;
      let AR = 111, AG = 208, AB = 224;

      let dots;         // drifting lights
      let rings;        // expanding rings
      let bestChain;    // best chain this session (the score)
      let curChain;     // chain currently resolving
      let chainTimer;   // ms since last pop in current chain (to close it out)
      let spawnTimer;
      let running;

      // pentatonic ladder — each new link in a chain climbs it
      const PENT = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];

      const RING_SPEED_REF = 0.28;   // fraction of stage / second at base
      const RING_LIFE = 2200;        // ms a ring lives
      const RING_THICK = 0.03;       // hit band thickness (fraction of stage)
      const CHAIN_CLOSE = 900;       // ms of no pops → chain resolved

      function acc(a) { return "rgba(" + AR + "," + AG + "," + AB + "," + a + ")"; }

      function hexToRgb(hex) {
        const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
        if (!m) return null;
        const n = parseInt(m[1], 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      }

      function resize() {
        const size = Arcade.board.stageSize(900);
        cssS = Math.round(size);
        dpr = window.devicePixelRatio || 1;
        canvas.style.width = cssS + "px";
        canvas.style.height = cssS + "px";
        canvas.width = Math.round(cssS * dpr);
        canvas.height = Math.round(cssS * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      function reset() {
        dots = [];
        rings = [];
        bestChain = 0;
        curChain = 0;
        chainTimer = 0;
        spawnTimer = 0;
        running = true;
        const start = reduced ? 14 : 22;
        for (let i = 0; i < start; i++) dots.push(newDot());
      }

      function newDot(edge) {
        // hues drift subtly around the accent for a soft aurora
        const hueShift = (Math.random() - 0.5) * 0.5;
        let x, y;
        if (edge) {
          // drift in from a random edge
          const s = Math.floor(Math.random() * 4);
          if (s === 0) { x = Math.random(); y = -0.03; }
          else if (s === 1) { x = 1.03; y = Math.random(); }
          else if (s === 2) { x = Math.random(); y = 1.03; }
          else { x = -0.03; y = Math.random(); }
        } else {
          x = 0.08 + Math.random() * 0.84;
          y = 0.08 + Math.random() * 0.84;
        }
        const ang = Math.random() * Math.PI * 2;
        const spd = (0.006 + Math.random() * 0.014) * (reduced ? 0.5 : 1);
        return {
          x: x, y: y,
          vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
          r: 0.012 + Math.random() * 0.010,
          alive: true,
          pulse: Math.random() * Math.PI * 2,
          hueShift: hueShift,
          popFade: 0
        };
      }

      function dropRing(nx, ny, chainDepth) {
        rings.push({
          x: nx, y: ny,
          rad: 0.0,
          life: RING_LIFE,
          depth: chainDepth,
          fromClick: chainDepth === 0
        });
      }

      function tint(hueShift, a) {
        // shift toward warm/cool around accent for variety
        const r = Math.min(255, Math.max(0, Math.round(AR + hueShift * 60)));
        const gg = Math.min(255, Math.max(0, Math.round(AG - Math.abs(hueShift) * 20)));
        const b = Math.min(255, Math.max(0, Math.round(AB - hueShift * 50)));
        return "rgba(" + r + "," + gg + "," + b + "," + a + ")";
      }

      function popDot(d, depth) {
        d.alive = false;
        d.popFade = 1;
        curChain += 1;
        if (curChain > bestChain) { bestChain = curChain; ctx.setScore(bestChain); }
        chainTimer = 0;
        // rising harmonic — climbs the pentatonic ladder with chain depth
        const note = PENT[Math.min(PENT.length - 1, depth)];
        ctx.audio.tone(note, 0.5, { type: "sine", vol: 0.12, attack: 0.02 });
        if (curChain >= 3) ctx.audio.tone(note * 2, 0.35, { type: "sine", vol: 0.05, when: 0.02 });
        // each popped dot emits its own ring
        dropRing(d.x, d.y, depth + 1);
      }

      function update(dt) {
        if (!running) return;
        const sec = dt / 1000;

        // drift dots
        for (let i = 0; i < dots.length; i++) {
          const d = dots[i];
          if (!d.alive) { d.popFade = Math.max(0, d.popFade - sec * 2.2); continue; }
          d.x += d.vx * (dt / 16.67);
          d.y += d.vy * (dt / 16.67);
          d.pulse += sec * 2.4;
          // gentle wrap-around so the pond never empties awkwardly
          if (d.x < -0.06) d.x = 1.06; else if (d.x > 1.06) d.x = -0.06;
          if (d.y < -0.06) d.y = 1.06; else if (d.y > 1.06) d.y = -0.06;
        }

        // expand rings, test collisions
        for (let i = 0; i < rings.length; i++) {
          const ring = rings[i];
          ring.rad += RING_SPEED_REF * sec;
          ring.life -= dt;
          const inner = ring.rad - RING_THICK;
          for (let j = 0; j < dots.length; j++) {
            const d = dots[j];
            if (!d.alive) continue;
            const dx = d.x - ring.x, dy = d.y - ring.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= ring.rad + d.r && dist >= inner - d.r) {
              popDot(d, ring.depth);
            }
          }
        }
        rings = rings.filter(function (r) { return r.life > 0 && r.rad < 1.6; });

        // resolve chain when it goes quiet
        if (curChain > 0) {
          chainTimer += dt;
          if (chainTimer >= CHAIN_CLOSE && rings.length === 0) {
            if (curChain >= 4) ctx.audio.combo(curChain); // satisfying cap for a big chain
            curChain = 0;
          }
        }

        // clean the dead & keep the pond populated
        dots = dots.filter(function (d) { return d.alive || d.popFade > 0.01; });
        const alive = dots.reduce(function (n, d) { return n + (d.alive ? 1 : 0); }, 0);
        const target = reduced ? 16 : 26;
        spawnTimer -= dt;
        if (alive < target && spawnTimer <= 0) {
          dots.push(newDot(true));
          spawnTimer = 260;
        }
      }

      function draw() {
        const S = cssS;
        // dark pond backdrop
        const bg = g.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S * 0.75);
        bg.addColorStop(0, "rgba(8,16,22,1)");
        bg.addColorStop(1, "rgba(4,8,12,1)");
        g.fillStyle = bg;
        g.fillRect(0, 0, S, S);

        // rings
        g.save();
        g.globalCompositeOperation = "lighter";
        for (let i = 0; i < rings.length; i++) {
          const ring = rings[i];
          const px = ring.x * S, py = ring.y * S, pr = ring.rad * S;
          const lifeFrac = Math.max(0, ring.life / RING_LIFE);
          const a = lifeFrac * (ring.fromClick ? 0.5 : 0.4);
          if (pr < 1) continue;
          g.strokeStyle = acc(a);
          g.lineWidth = Math.max(1.5, RING_THICK * S * 0.9 * lifeFrac + 1);
          g.shadowColor = acc(a * 0.9);
          g.shadowBlur = reduced ? 0 : 14;
          g.beginPath();
          g.arc(px, py, pr, 0, Math.PI * 2);
          g.stroke();
        }
        g.restore();

        // dots
        g.save();
        g.globalCompositeOperation = "lighter";
        for (let i = 0; i < dots.length; i++) {
          const d = dots[i];
          const px = d.x * S, py = d.y * S;
          if (d.alive) {
            const breathe = 0.85 + Math.sin(d.pulse) * 0.15;
            const pr = d.r * S * breathe;
            const grad = g.createRadialGradient(px, py, 0, px, py, pr * 3.2);
            grad.addColorStop(0, tint(d.hueShift, 0.95));
            grad.addColorStop(0.4, tint(d.hueShift, 0.35));
            grad.addColorStop(1, tint(d.hueShift, 0));
            g.fillStyle = grad;
            g.beginPath();
            g.arc(px, py, pr * 3.2, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = tint(d.hueShift, 0.95);
            g.beginPath();
            g.arc(px, py, pr, 0, Math.PI * 2);
            g.fill();
          } else if (d.popFade > 0) {
            // pop bloom
            const pr = d.r * S * (1 + (1 - d.popFade) * 3);
            const grad = g.createRadialGradient(px, py, 0, px, py, pr);
            grad.addColorStop(0, tint(d.hueShift, d.popFade * 0.7));
            grad.addColorStop(1, tint(d.hueShift, 0));
            g.fillStyle = grad;
            g.beginPath();
            g.arc(px, py, pr, 0, Math.PI * 2);
            g.fill();
          }
        }
        g.restore();

        // live chain readout when one is resolving
        if (curChain >= 2) {
          g.fillStyle = acc(0.4 + Math.min(0.5, curChain * 0.05));
          g.font = "700 " + Math.round(S * 0.05) + "px system-ui, sans-serif";
          g.textAlign = "center"; g.textBaseline = "middle";
          g.fillText("×" + curChain, S / 2, S * 0.5);
        }

        // soft vignette
        const vg = g.createRadialGradient(S / 2, S / 2, S * 0.35, S / 2, S / 2, S * 0.72);
        vg.addColorStop(0, "rgba(0,0,0,0)");
        vg.addColorStop(1, "rgba(0,0,0,0.4)");
        g.fillStyle = vg;
        g.fillRect(0, 0, S, S);
      }

      return {
        mount(stage, c) {
          stageEl = stage;
          ctx = c;
          reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          const rgb = hexToRgb(ctx.accent);
          if (rgb) { AR = rgb[0]; AG = rgb[1]; AB = rgb[2]; }

          const wrap = document.createElement("div");
          wrap.style.display = "flex";
          wrap.style.flexDirection = "column";
          wrap.style.alignItems = "center";

          canvas = document.createElement("canvas");
          canvas.style.borderRadius = "16px";
          canvas.style.background = "rgba(5,9,13,0.9)";
          canvas.style.boxShadow = "0 0 46px rgba(111,208,224,0.10)";
          canvas.style.cursor = "crosshair";
          g = canvas.getContext("2d");
          wrap.appendChild(canvas);

          const hint = document.createElement("div");
          hint.className = "hint";
          hint.textContent = "Click to send a ripple — pop the lights, chain them";
          wrap.appendChild(hint);

          stage.appendChild(wrap);

          resize();
          reset();
          ctx.setScore(0);
          Arcade.input.setPointerTarget(canvas);
          draw();
          unResize = Arcade.board.onResize(function () { resize(); draw(); });
        },

        handleInput(intent) {
          if (!running) return;
          if (intent.type === "point" && intent.phase === "down" && intent.button === 0) {
            curChain = 0; // a fresh click starts a new chain measurement
            chainTimer = 0;
            dropRing(intent.nx, intent.ny, 0);
            ctx.audio.soft();
          }
        },

        tick(dt) { update(dt); draw(); },

        teardown() {
          running = false;
          if (unResize) unResize();
          unResize = null;
          stageEl = ctx = canvas = g = null;
          dots = rings = null;
        }
      };
    }
  });
})();
