/* Constellation — trace the stars. Faint stars drift across a night sky with a
   ghostly target pattern behind them. Drag from star to star to draw glowing
   lines; matching an edge in the target locks it in with a harp note. Complete
   the figure and it blooms into light, then a fresh constellation fades in.
   Endless, calm, no fail. */
(function () {
  Arcade.register({
    id: "constellation",
    name: "*Constellation*",
    tagline: "Drag between stars to trace the figure.",
    accent: "#e8dca0",
    complexity: "med",
    controls: "drag",
    scoreLabel: "Formed",
    create() {
      let stageEl, ctx, canvas, g, unResize = null;
      let cssW = 0, cssH = 0, dpr = 1, reduced = false;
      let accRgb;

      let stars;        // [{x,y,vx,vy,r,tw,twSpeed}]
      let edges;        // target edges: [{a,b,done}]
      let dragFrom;     // star index or null
      let pointer;      // {x,y} live pointer while dragging
      let formed;       // completed count
      let wrongFx;      // [{a,b,life}]
      let bloomFx;      // 0..1 flash on completion
      let fadeIn;       // 0..1 new-constellation fade
      let harpStep;     // ascending harp index within current figure

      const HARP = [329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00];

      function hexToRgb(hex) {
        const h = (hex || "#e8dca0").replace("#", "");
        return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
      }
      function mixWhite(c, t) {
        return { r: Math.round(c.r + (255 - c.r) * t), g: Math.round(c.g + (255 - c.g) * t), b: Math.round(c.b + (255 - c.b) * t) };
      }
      function rgba(c, a) { return "rgba(" + c.r + "," + c.g + "," + c.b + "," + a + ")"; }

      function resize() {
        const size = Arcade.board.stageSize(900, 0.75);
        cssW = Math.round(size); cssH = Math.round(size);
        dpr = window.devicePixelRatio || 1;
        canvas.style.width = cssW + "px";
        canvas.style.height = cssH + "px";
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      // build a fresh procedural constellation: N stars + a connected edge set
      function newConstellation() {
        const N = 4 + Math.floor(Math.random() * 4); // 4..7
        const margin = 0.16;
        stars = [];
        // place stars with a little spacing
        let tries = 0;
        while (stars.length < N && tries < 400) {
          tries++;
          const x = (margin + Math.random() * (1 - margin * 2)) * cssW;
          const y = (margin + Math.random() * (1 - margin * 2)) * cssH;
          let ok = true;
          for (const s of stars) {
            const d = Math.hypot(s.x - x, s.y - y);
            if (d < cssW * 0.16) { ok = false; break; }
          }
          if (!ok) continue;
          stars.push({
            x, y,
            vx: (Math.random() - 0.5) * cssW * 0.000012,
            vy: (Math.random() - 0.5) * cssW * 0.000012,
            r: cssW * (0.010 + Math.random() * 0.006),
            tw: Math.random() * Math.PI * 2,
            twSpeed: 0.0012 + Math.random() * 0.0018
          });
        }
        const M = stars.length;
        // build a spanning path (guaranteed connected + solvable), order by angle
        const cx = stars.reduce((s, p) => s + p.x, 0) / M;
        const cy = stars.reduce((s, p) => s + p.y, 0) / M;
        const order = stars.map((s, i) => i).sort((i, j) =>
          Math.atan2(stars[i].y - cy, stars[i].x - cx) - Math.atan2(stars[j].y - cy, stars[j].x - cx));
        edges = [];
        const seen = new Set();
        const addEdge = (a, b) => {
          const key = a < b ? a + "-" + b : b + "-" + a;
          if (a === b || seen.has(key)) return;
          seen.add(key); edges.push({ a, b, done: false });
        };
        for (let i = 0; i < M - 1; i++) addEdge(order[i], order[i + 1]);
        // maybe close the loop for a fuller figure
        if (M >= 4 && Math.random() < 0.6) addEdge(order[M - 1], order[0]);
        // maybe one extra chord for character
        if (M >= 5 && Math.random() < 0.5) addEdge(order[0], order[2]);

        dragFrom = null; pointer = null; harpStep = 0; fadeIn = 0;
      }

      function reset() {
        formed = 0; wrongFx = []; bloomFx = 0;
        newConstellation();
      }

      function edgeIndex(a, b) {
        for (let i = 0; i < edges.length; i++) {
          if ((edges[i].a === a && edges[i].b === b) || (edges[i].a === b && edges[i].b === a)) return i;
        }
        return -1;
      }

      function nearestStar(x, y) {
        let best = -1, bd = cssW * 0.07; // grab radius
        for (let i = 0; i < stars.length; i++) {
          const d = Math.hypot(stars[i].x - x, stars[i].y - y);
          if (d < bd) { bd = d; best = i; }
        }
        return best;
      }

      function tryLink(a, b) {
        if (a < 0 || b < 0 || a === b) return;
        const ei = edgeIndex(a, b);
        if (ei >= 0 && !edges[ei].done) {
          edges[ei].done = true;
          const f = HARP[Math.min(HARP.length - 1, harpStep)];
          harpStep++;
          ctx.audio.tone(f, 0.55, { type: "sine", vol: 0.11, attack: 0.015 });
          ctx.audio.tone(f * 2, 0.4, { type: "sine", vol: 0.04, attack: 0.02 });
          checkComplete();
        } else if (ei < 0) {
          // wrong link: fade out with a soft low tone
          wrongFx.push({ a, b, life: 1 });
          ctx.audio.tone(190, 0.22, { type: "sine", vol: 0.05, glide: 140 });
        }
      }

      function checkComplete() {
        if (edges.every((e) => e.done)) {
          formed++;
          ctx.setScore(formed);
          bloomFx = 1;
          ctx.audio.score();
          ctx.audio.chord([523.25, 659.25, 783.99], 0.6, { type: "sine", vol: 0.1, spread: 0.05 });
          // spin up a new one after a short bloom
          setTimeout(() => { if (stars) newConstellation(); }, 850);
        }
      }

      function update(dt) {
        if (!stars) return;
        for (const s of stars) {
          if (!reduced) { s.x += s.vx * dt; s.y += s.vy * dt; }
          // soft wrap-bounce within margins
          const mx = cssW * 0.10, my = cssH * 0.10;
          if (s.x < mx || s.x > cssW - mx) s.vx *= -1;
          if (s.y < my || s.y > cssH - my) s.vy *= -1;
          s.x = Math.max(mx, Math.min(cssW - mx, s.x));
          s.y = Math.max(my, Math.min(cssH - my, s.y));
          s.tw += s.twSpeed * dt;
        }
        for (const w of wrongFx) w.life -= dt * 0.0022;
        wrongFx = wrongFx.filter((w) => w.life > 0);
        if (bloomFx > 0) bloomFx = Math.max(0, bloomFx - dt * 0.0016);
        if (fadeIn < 1) fadeIn = Math.min(1, fadeIn + dt * 0.0018);
      }

      function drawLine(a, b, col, alpha, width, glow) {
        g.save();
        g.strokeStyle = rgba(col, alpha);
        g.lineWidth = width;
        g.shadowColor = rgba(col, Math.min(0.7, alpha));
        g.shadowBlur = glow;
        g.lineCap = "round";
        g.beginPath();
        g.moveTo(stars[a].x, stars[a].y);
        g.lineTo(stars[b].x, stars[b].y);
        g.stroke();
        g.restore();
      }

      function draw() {
        g.clearRect(0, 0, cssW, cssH);
        if (!stars) return;

        // faint sky vignette
        const bg = g.createRadialGradient(cssW / 2, cssH * 0.42, 0, cssW / 2, cssH / 2, Math.max(cssW, cssH) * 0.7);
        bg.addColorStop(0, rgba(accRgb, 0.035));
        bg.addColorStop(1, "rgba(4,6,12,0)");
        g.fillStyle = bg;
        g.fillRect(0, 0, cssW, cssH);

        const white = mixWhite(accRgb, 0.55);

        // ghost target edges (very faint)
        for (const e of edges) {
          if (e.done) continue;
          drawLine(e.a, e.b, accRgb, 0.10 * fadeIn, 1, 4);
        }

        // wrong-link fading strokes
        for (const w of wrongFx) {
          drawLine(w.a, w.b, { r: 200, g: 120, b: 150 }, 0.4 * w.life, 1.5, 6);
        }

        // completed edges (bright, blooms extra on completion)
        for (const e of edges) {
          if (!e.done) continue;
          drawLine(e.a, e.b, white, (0.75 + bloomFx * 0.25) * fadeIn, 2 + bloomFx * 1.5, 12 + bloomFx * 20);
        }

        // live drag rubber-band
        if (dragFrom != null && pointer) {
          g.save();
          g.strokeStyle = rgba(white, 0.4);
          g.lineWidth = 1.5;
          g.setLineDash([4, 6]);
          g.beginPath();
          g.moveTo(stars[dragFrom].x, stars[dragFrom].y);
          g.lineTo(pointer.x, pointer.y);
          g.stroke();
          g.restore();
        }

        // stars
        for (let i = 0; i < stars.length; i++) {
          const s = stars[i];
          const tw = 0.7 + 0.3 * Math.sin(s.tw);
          const isSel = i === dragFrom;
          const rr = s.r * (isSel ? 1.5 : 1) * (0.85 + bloomFx * 0.5);
          const glow = g.createRadialGradient(s.x, s.y, 0, s.x, s.y, rr * 3.2);
          glow.addColorStop(0, rgba(mixWhite(accRgb, 0.8), (0.55 + bloomFx * 0.4) * tw * fadeIn));
          glow.addColorStop(0.4, rgba(accRgb, 0.3 * tw * fadeIn));
          glow.addColorStop(1, rgba(accRgb, 0));
          g.fillStyle = glow;
          g.beginPath();
          g.arc(s.x, s.y, rr * 3.2, 0, Math.PI * 2);
          g.fill();
          // bright core
          g.fillStyle = rgba(mixWhite(accRgb, 0.9), (0.9 * tw) * fadeIn);
          g.beginPath();
          g.arc(s.x, s.y, rr * 0.7, 0, Math.PI * 2);
          g.fill();
        }
      }

      return {
        mount(stage, c) {
          stageEl = stage; ctx = c;
          reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          accRgb = hexToRgb(ctx.accent || "#e8dca0");

          const wrap = document.createElement("div");
          wrap.style.display = "flex";
          wrap.style.flexDirection = "column";
          wrap.style.alignItems = "center";

          canvas = document.createElement("canvas");
          canvas.style.borderRadius = "14px";
          canvas.style.background = "radial-gradient(circle at 50% 40%, rgba(12,14,26,0.75), rgba(5,6,12,0.9))";
          canvas.style.boxShadow = "0 0 46px rgba(232,220,160,0.10)";
          g = canvas.getContext("2d");
          wrap.appendChild(canvas);

          const hint = document.createElement("div");
          hint.className = "hint";
          hint.textContent = "Drag between stars to trace the constellation";
          wrap.appendChild(hint);

          stage.appendChild(wrap);

          resize();
          reset();
          ctx.setScore(0);
          Arcade.input.setPointerTarget(canvas);
          draw();
          unResize = Arcade.board.onResize(() => {
            // keep relative positions on resize
            const oldW = cssW, oldH = cssH;
            resize();
            if (stars && oldW && oldH) {
              const sx = cssW / oldW, sy = cssH / oldH;
              for (const s of stars) { s.x *= sx; s.y *= sy; }
            }
            draw();
          });
        },

        handleInput(intent) {
          if (intent.type !== "point") return;
          if (intent.phase === "down" && intent.button === 0) {
            const hit = nearestStar(intent.x, intent.y);
            if (hit >= 0) {
              // click-to-click chaining: if a star was already selected, try to link
              if (dragFrom != null && dragFrom !== hit) { tryLink(dragFrom, hit); dragFrom = null; pointer = null; }
              else { dragFrom = hit; pointer = { x: intent.x, y: intent.y }; }
            } else {
              dragFrom = null; pointer = null;
            }
          } else if (intent.phase === "move") {
            if (dragFrom != null) pointer = { x: intent.x, y: intent.y };
          } else if (intent.phase === "up") {
            if (dragFrom != null) {
              const hit = nearestStar(intent.x, intent.y);
              if (hit >= 0 && hit !== dragFrom) { tryLink(dragFrom, hit); dragFrom = null; pointer = null; }
              // if released on empty space, keep selection for click-to-click
              else pointer = null;
            }
          }
        },

        tick(dt) { update(dt); draw(); },

        teardown() {
          if (unResize) unResize();
          unResize = null;
          stageEl = ctx = canvas = g = null;
          stars = edges = wrongFx = pointer = null;
        }
      };
    }
  });
})();
