/* Orbit — a zen timing game. A mote sweeps around a central glow. One
   neon ring at a time carries a bright gate arc; click/space launches the
   mote straight outward. Land the launch inside the gate to score a combo.
   Three missed launches ends the round. Breathing-paced, pitch rises with
   the combo. Original. */
(function () {
  Arcade.register({
    id: "orbit",
    name: "Orbit",
    tagline: "Time the launch, ride the combo.",
    accent: "#5fc8e0",
    complexity: "med",
    controls: "click",
    scoreLabel: "Combo",
    create() {
      let stageEl, ctx, canvas, g, unResize = null;
      let cssW = 0, cssH = 0, dpr = 1;
      let reduced = false;

      let cx, cy, R;                 // center + reference radius (min dim / 2)
      let orbitR, angle, angVel;
      let launching, proj, radSpeed;
      let ring;
      let combo, best, misses, over;
      let trail, flash;

      const MAX_MISS = 3;

      function resize() {
        const size = Arcade.board.stageSize(880);
        cssW = Math.round(size);
        cssH = Math.round(size);
        dpr = window.devicePixelRatio || 1;
        canvas.style.width = cssW + "px";
        canvas.style.height = cssH + "px";
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        cx = cssW / 2; cy = cssH / 2;
        R = Math.min(cssW, cssH) / 2;
        orbitR = R * 0.20;
        radSpeed = R * 0.0032;       // px per ms outward
      }

      function reset() {
        angle = Math.random() * Math.PI * 2;
        angVel = 0.00220;            // rad/ms — calm sweep (~2.85s per lap)
        launching = false;
        proj = null;
        combo = 0; best = 0; misses = 0; over = false;
        trail = [];
        flash = 0;
        spawnRing();
      }

      function gateHalf() {
        // generous, eases tighter with combo, floored (stays calm)
        return Math.max(0.20, 0.42 - combo * 0.015);
      }

      function spawnRing() {
        const radius = R * (0.55 + Math.random() * 0.32);
        ring = {
          radius,
          gateAngle: Math.random() * Math.PI * 2,
          half: gateHalf(),
          born: 0,
          appear: 0
        };
      }

      function angDiff(a, b) {
        let d = (a - b) % (Math.PI * 2);
        if (d > Math.PI) d -= Math.PI * 2;
        if (d < -Math.PI) d += Math.PI * 2;
        return d;
      }

      function launch() {
        if (over || launching) return;
        launching = true;
        proj = { r: orbitR, angle: angle, resolved: false };
        ctx.audio.soft();
      }

      function onHit() {
        combo++;
        if (combo > best) best = combo;
        ctx.setScore(combo);
        ctx.audio.combo(combo);
        flash = 1;
        // every successful hit: the gate jumps to a fresh spot AND the sweep
        // speeds up a little more each press (ramps, uncapped-but-gentle).
        angVel += 0.00016;
        spawnRing();
      }

      function onMiss() {
        misses++;
        combo = 0;
        ctx.setScore(0);
        ctx.audio.lose();
        if (misses >= MAX_MISS) { end(); return; }
        spawnRing();
      }

      function end() {
        over = true;
        ctx.onGameOver(best, {
          title: "Lost the rhythm.",
          msg: "Best combo: " + best + ". Center, and orbit again."
        });
      }

      function update(dt) {
        if (over) return;

        // sweep the orbit angle
        angle = (angle + angVel * dt) % (Math.PI * 2);
        if (ring.appear < 1) ring.appear = Math.min(1, ring.appear + dt * 0.004);

        if (launching && proj && !proj.resolved) {
          proj.r += radSpeed * dt;

          // orbiting-dot trail carries into the flight
          trail.push({ r: proj.r, angle: proj.angle, a: 1 });

          // resolve at the ring crossing
          if (proj.r >= ring.radius) {
            proj.resolved = true;
            const d = Math.abs(angDiff(proj.angle, ring.gateAngle));
            if (d <= ring.half) onHit(); else onMiss();
            // return mote to orbit (at a fresh radius each round)
            launching = false;
            proj = null;
            orbitR = R * (0.16 + Math.random() * 0.10);
          }
        } else {
          // orbiting: lay down a soft trail
          trail.push({ r: orbitR, angle: angle, a: 1 });
        }

        if (trail.length > 26) trail.splice(0, trail.length - 26);
        for (const t of trail) t.a -= dt * 0.0045;
        while (trail.length && trail[0].a <= 0) trail.shift();

        if (flash > 0) flash = Math.max(0, flash - dt * 0.004);
      }

      function polar(r, a) { return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }; }

      function draw() {
        g.clearRect(0, 0, cssW, cssH);

        // faint field
        const bg = g.createRadialGradient(cx, cy, R * 0.05, cx, cy, R);
        bg.addColorStop(0, "rgba(95,200,224,0.07)");
        bg.addColorStop(1, "rgba(95,200,224,0.01)");
        g.fillStyle = bg;
        g.fillRect(0, 0, cssW, cssH);

        // central glow (gently breathing)
        const pulse = reduced ? 0.5 : 0.5 + Math.sin(Date.now() * 0.0022) * 0.5;
        const coreR = R * 0.05 * (1 + pulse * 0.25);
        g.save();
        g.shadowColor = "rgba(95,200,224,0.9)";
        g.shadowBlur = 28 + flash * 30;
        g.fillStyle = "rgba(180,235,248,0.95)";
        g.beginPath();
        g.arc(cx, cy, coreR, 0, Math.PI * 2);
        g.fill();
        g.restore();

        // orbit guide ring (very faint)
        g.strokeStyle = "rgba(95,200,224,0.12)";
        g.lineWidth = 1;
        g.beginPath();
        g.arc(cx, cy, orbitR, 0, Math.PI * 2);
        g.stroke();

        // target ring + bright gate arc
        if (ring) {
          const ap = ring.appear;
          g.save();
          g.globalAlpha = ap;
          // thin base ring
          g.strokeStyle = "rgba(95,200,224,0.28)";
          g.lineWidth = 2;
          g.beginPath();
          g.arc(cx, cy, ring.radius, 0, Math.PI * 2);
          g.stroke();
          // glowing gate segment
          g.shadowColor = "rgba(120,225,245,0.9)";
          g.shadowBlur = 18;
          g.strokeStyle = "rgba(150,235,250,0.95)";
          g.lineWidth = 5;
          g.beginPath();
          g.arc(cx, cy, ring.radius, ring.gateAngle - ring.half, ring.gateAngle + ring.half);
          g.stroke();
          g.restore();
        }

        // trail
        for (const t of trail) {
          if (t.a <= 0) continue;
          const p = polar(t.r, t.angle);
          g.globalAlpha = t.a * 0.55;
          g.fillStyle = "rgba(150,225,245,0.9)";
          g.beginPath();
          g.arc(p.x, p.y, R * 0.014, 0, Math.PI * 2);
          g.fill();
        }
        g.globalAlpha = 1;

        // the mote
        const mp = launching && proj ? polar(proj.r, proj.angle) : polar(orbitR, angle);
        g.save();
        g.shadowColor = "rgba(140,230,248,0.95)";
        g.shadowBlur = 20;
        g.fillStyle = "#cfeefb";
        g.beginPath();
        g.arc(mp.x, mp.y, R * 0.024, 0, Math.PI * 2);
        g.fill();
        g.restore();

        // aim guide when orbiting (faint radial hint of launch direction)
        if (!launching && !over) {
          const inner = polar(orbitR, angle);
          const outer = polar(R * 0.92, angle);
          const grad = g.createLinearGradient(inner.x, inner.y, outer.x, outer.y);
          grad.addColorStop(0, "rgba(150,225,245,0.35)");
          grad.addColorStop(1, "rgba(150,225,245,0)");
          g.strokeStyle = grad;
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(inner.x, inner.y);
          g.lineTo(outer.x, outer.y);
          g.stroke();
        }

        // miss pips
        for (let i = 0; i < MAX_MISS; i++) {
          const on = i < (MAX_MISS - misses);
          g.beginPath();
          g.arc(cssW * 0.5 + (i - 1) * R * 0.08, cssH - R * 0.06, R * 0.014, 0, Math.PI * 2);
          g.fillStyle = on ? "rgba(150,225,245,0.85)" : "rgba(95,200,224,0.18)";
          g.fill();
        }
      }

      return {
        mount(stage, c) {
          stageEl = stage;
          ctx = c;
          reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

          const wrap = document.createElement("div");
          wrap.style.display = "flex";
          wrap.style.flexDirection = "column";
          wrap.style.alignItems = "center";

          canvas = document.createElement("canvas");
          canvas.style.borderRadius = "14px";
          canvas.style.background = "rgba(8,15,20,0.6)";
          canvas.style.boxShadow = "0 0 40px rgba(95,200,224,0.12)";
          g = canvas.getContext("2d");
          wrap.appendChild(canvas);

          const hint = document.createElement("div");
          hint.className = "hint";
          hint.textContent = "Click at the right moment to hit the ring";
          wrap.appendChild(hint);

          stage.appendChild(wrap);

          resize();
          reset();
          draw();
          unResize = Arcade.board.onResize(() => { resize(); draw(); });
        },

        handleInput(intent) {
          if (intent.type === "action") launch();
          else if (intent.type === "point" && intent.phase === "down" && intent.button === 0) launch();
        },

        tick(dt) {
          update(dt);
          draw();
        },

        teardown() {
          if (unResize) unResize();
          unResize = null;
          stageEl = ctx = canvas = g = null;
          ring = proj = trail = null;
        }
      };
    }
  });
})();
