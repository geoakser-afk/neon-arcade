/* Sparkle — made for Christopher (age 5). A finger-painting playground: drag
   to draw glowing rainbow ribbons that shed sparkles and play soft notes as
   you go; tap without dragging to stamp a big star, heart or flower that
   chimes and floats up. Everything gently fades so the screen never fills
   up. No buttons, no losing, no timer — just color and music. */
(function () {
  Arcade.register({
    id: "sparkle",
    name: "Sparkle",
    tagline: "Finger-paint glowing rainbow ribbons that sing. No rules, just color.",
    accent: "#7fe0ff",
    complexity: "low",
    controls: "drag",
    scoreLabel: "Strokes",
    create() {
      let stageEl, ctx, canvas, g, unResize = null;
      let S = 0, dpr = 1, reduced = false;
      let now = 0, strokes = 0;
      let ribbons = [];        // {pts:[{x,y,t,hue}], hue0, done}
      let cur = null;          // ribbon being drawn
      let sparks = [];
      let stamps = [];
      let hue = 0, lastNote = -9999, noteIdx = 0, downAt = null, moved = 0;
      const NOTES = [523, 587, 659, 784, 880, 1046, 1174, 1318, 1568];
      const FADE = 9000;

      function resize() {
        S = Arcade.board.stageSize(880);
        dpr = window.devicePixelRatio || 1;
        canvas.style.width = S + "px"; canvas.style.height = S + "px";
        canvas.width = Math.round(S * dpr); canvas.height = Math.round(S * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      function note(i, vol) {
        const f = NOTES[((i % NOTES.length) + NOTES.length) % NOTES.length];
        ctx.audio.tone(f, 0.35, { type: "sine", vol: vol, attack: 0.02 });
        ctx.audio.tone(f * 2, 0.2, { type: "sine", vol: vol * 0.25, when: 0.01 });
      }
      function begin(x, y) {
        cur = { pts: [{ x: x, y: y, t: now, hue: hue }], done: false };
        ribbons.push(cur);
        downAt = { x: x, y: y, t: now }; moved = 0;
        noteIdx = Math.floor((1 - y / S) * NOTES.length);   // higher on screen = higher note
        note(noteIdx, 0.1); lastNote = now;
      }
      function move(x, y) {
        if (!cur) return;
        const last = cur.pts[cur.pts.length - 1];
        const d = Math.hypot(x - last.x, y - last.y);
        if (d < S * 0.006) return;
        moved += d;
        hue = (hue + d * 0.6) % 360;
        cur.pts.push({ x: x, y: y, t: now, hue: hue });
        if (cur.pts.length > 400) cur.pts.shift();
        // sparkles trail off the brush
        if (!reduced) for (let i = 0; i < 2; i++) sparks.push({ x: x + (Math.random() - 0.5) * S * 0.02, y: y + (Math.random() - 0.5) * S * 0.02, vx: (Math.random() - 0.5) * S * 0.0002, vy: -S * (0.0001 + Math.random() * 0.0002), life: 1, r: S * (0.003 + Math.random() * 0.005), hue: hue });
        // a soft note every so often, pitch follows height
        if (now - lastNote > 140) {
          const target = Math.floor((1 - y / S) * NOTES.length);
          noteIdx = target;
          note(noteIdx, 0.06); lastNote = now;
        }
      }
      function end(x, y) {
        if (!cur) return;
        cur.done = true;
        if (moved < S * 0.02) {
          // a tap: stamp a big shape
          cur.pts = [];
          const kind = ["star", "heart", "flower"][stamps.length % 3];
          stamps.push({ x: x, y: y, kind: kind, hue: hue, t: 0, life: 1 });
          hue = (hue + 47) % 360;
          const base = NOTES[Math.floor((1 - y / S) * NOTES.length) % NOTES.length];
          ctx.audio.arp([base, base * 1.25, base * 1.5, base * 2], { dur: 0.22, step: 0.07, vol: 0.13, type: "sine" });
          for (let i = 0; i < (reduced ? 6 : 22); i++) { const a = Math.random() * Math.PI * 2, sp = S * (0.0002 + Math.random() * 0.0005); sparks.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, r: S * (0.004 + Math.random() * 0.006), hue: (hue + Math.random() * 60) % 360 }); }
        } else {
          strokes++; ctx.setScore(strokes);
          ctx.audio.tone(NOTES[noteIdx % NOTES.length] * 2, 0.3, { type: "sine", vol: 0.06, attack: 0.05 });
        }
        cur = null; downAt = null;
      }

      function update(dt) {
        now += dt;
        for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i]; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt / 1100; if (s.life <= 0) sparks.splice(i, 1); }
        for (let i = stamps.length - 1; i >= 0; i--) { const st = stamps[i]; st.t += dt; st.y -= S * 0.00002 * dt; st.life = 1 - st.t / 7000; if (st.life <= 0) stamps.splice(i, 1); }
        for (let i = ribbons.length - 1; i >= 0; i--) {
          const rb = ribbons[i];
          if (rb === cur) continue;
          rb.pts = rb.pts.filter(function (p) { return now - p.t < FADE; });
          if (!rb.pts.length) ribbons.splice(i, 1);
        }
      }

      function shapePath(kind, r) {
        g.beginPath();
        if (kind === "star") { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; i ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); }
        else if (kind === "heart") { g.moveTo(0, r * 0.8); g.bezierCurveTo(-r * 1.3, -r * 0.05, -r * 0.6, -r * 1.05, 0, -r * 0.4); g.bezierCurveTo(r * 0.6, -r * 1.05, r * 1.3, -r * 0.05, 0, r * 0.8); g.closePath(); }
        else { for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; g.moveTo(Math.cos(a) * r * 0.5 + r * 0.45, Math.sin(a) * r * 0.5); g.arc(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.45, 0, Math.PI * 2); } g.moveTo(r * 0.3, 0); g.arc(0, 0, r * 0.3, 0, Math.PI * 2); }
      }

      function draw() {
        g.clearRect(0, 0, S, S);
        const bg = g.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S * 0.8);
        bg.addColorStop(0, "#12101f"); bg.addColorStop(1, "#08070f");
        g.fillStyle = bg; g.fillRect(0, 0, S, S);
        if (!ribbons.length && !stamps.length && !sparks.length) {
          g.save(); g.textAlign = "center"; g.textBaseline = "middle";
          g.fillStyle = "rgba(127,224,255," + (0.35 + 0.25 * Math.sin(now * 0.003)) + ")";
          g.font = "700 " + Math.round(S * 0.05) + "px system-ui, sans-serif";
          g.fillText("draw!", S / 2, S / 2);
          g.restore();
        }
        g.lineCap = "round"; g.lineJoin = "round";
        // ribbons: thick glowing multi-hue strokes, fading with age
        ribbons.forEach(function (rb) {
          const pts = rb.pts;
          for (let i = 1; i < pts.length; i++) {
            const a = pts[i], b = pts[i - 1];
            const age = clamp01(1 - (now - a.t) / FADE);
            const w = S * 0.03 * (0.4 + 0.6 * age);
            g.save();
            g.globalAlpha = age;
            g.strokeStyle = "hsl(" + a.hue + ",90%,70%)";
            g.shadowColor = "hsl(" + a.hue + ",90%,60%)"; g.shadowBlur = w * 1.2;
            g.lineWidth = w;
            g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(a.x, a.y); g.stroke();
            g.shadowBlur = 0; g.strokeStyle = "rgba(255,255,255," + (0.45 * age) + ")"; g.lineWidth = w * 0.3;
            g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(a.x, a.y); g.stroke();
            g.restore();
          }
        });
        // stamps
        stamps.forEach(function (st) {
          const k = Math.min(1, st.t / 260), r = S * 0.09 * (1.2 - 0.2 * k) * (0.5 + 0.5 * k);
          g.save(); g.globalAlpha = Math.max(0, st.life); g.translate(st.x, st.y); g.rotate(Math.sin(st.t * 0.001) * 0.15);
          const gr = g.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
          gr.addColorStop(0, "hsl(" + st.hue + ",90%,88%)"); gr.addColorStop(1, "hsl(" + st.hue + ",90%,60%)");
          g.fillStyle = gr; g.shadowColor = "hsl(" + st.hue + ",90%,65%)"; g.shadowBlur = r * 0.6;
          shapePath(st.kind, r); g.fill();
          g.shadowBlur = 0; g.strokeStyle = "rgba(255,255,255,0.5)"; g.lineWidth = 2; g.stroke();
          g.restore();
        });
        // sparkles
        sparks.forEach(function (s) {
          g.save(); g.globalAlpha = Math.max(0, s.life); g.fillStyle = "hsl(" + s.hue + ",90%,85%)"; g.shadowColor = "hsl(" + s.hue + ",90%,70%)"; g.shadowBlur = 6;
          const r = s.r * (0.5 + s.life);
          g.beginPath(); g.moveTo(s.x, s.y - r); g.quadraticCurveTo(s.x, s.y, s.x + r, s.y); g.quadraticCurveTo(s.x, s.y, s.x, s.y + r); g.quadraticCurveTo(s.x, s.y, s.x - r, s.y); g.quadraticCurveTo(s.x, s.y, s.x, s.y - r); g.fill();
          g.restore();
        });
      }
      function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

      return {
        mount(stage, c) {
          stageEl = stage; ctx = c;
          reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          const wrap = document.createElement("div");
          wrap.style.display = "flex"; wrap.style.flexDirection = "column"; wrap.style.alignItems = "center";
          canvas = document.createElement("canvas");
          canvas.style.borderRadius = "18px"; canvas.style.background = "#0c0a16"; canvas.style.cursor = "crosshair";
          canvas.style.boxShadow = "0 0 46px rgba(127,224,255,0.14)"; canvas.style.touchAction = "none";
          g = canvas.getContext("2d");
          wrap.appendChild(canvas);
          const hint = document.createElement("div"); hint.className = "hint";
          hint.textContent = "Drag to paint singing rainbow ribbons · tap to stamp a star, heart or flower";
          wrap.appendChild(hint);
          stage.appendChild(wrap);
          now = 0; strokes = 0; ribbons = []; sparks = []; stamps = []; cur = null; hue = Math.random() * 360;
          resize();
          ctx.setScore(0);
          Arcade.input.setPointerTarget(canvas);
          unResize = Arcade.board.onResize(function () { resize(); });
          draw();
        },
        handleInput(intent) {
          if (intent.type !== "point") return;
          if (intent.phase === "down" && intent.button === 0) begin(intent.x, intent.y);
          else if (intent.phase === "move" && cur) move(intent.x, intent.y);
          else if (intent.phase === "up" && cur) end(intent.x, intent.y);
        },
        tick(dt) { update(Math.min(50, dt)); draw(); },
        getScore() { return strokes; },
        teardown() {
          if (unResize) unResize(); unResize = null;
          stageEl = ctx = canvas = g = null; ribbons = []; sparks = []; stamps = []; cur = null;
        }
      };
    }
  });
})();
