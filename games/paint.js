/* Paint — a coloring book made for Christopher (age 5). Three pictures built
   from big simple regions (a house, a flower, a friendly dino). Pick a color
   blob at the bottom, tap a part of the picture and it fills with a happy
   "plip" + sparkles. Tap again to recolor. Giant round arrows at the top
   corners flip between pictures; fills are remembered while the game is open.
   Nothing to lose, no clock — just a big star counter of fills. */
(function () {
  const PALETTE = ["#ff6b6b", "#ffa94d", "#ffe066", "#7fe0a0", "#74b9ff", "#b197fc", "#ff8fd0", "#ffffff"];
  const NOTES = [523, 587, 659, 784, 880, 1046, 1174, 1318];
  function rrect(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  function drawBrush(g, s) {
    // big paintbrush with a rainbow blob on its tip + three small blobs
    g.save(); g.translate(s / 2, s / 2);
    g.rotate(-Math.PI / 4);
    const L = s * 0.62, w = s * 0.11;
    g.lineCap = "round";
    // handle
    g.fillStyle = "#c9a066"; g.beginPath(); rrect(g, -w / 2, -L * 0.1, w, L * 0.6, w / 2); g.fill();
    // ferrule
    g.fillStyle = "#cfd6e6"; g.beginPath(); rrect(g, -w * 0.6, -L * 0.28, w * 1.2, L * 0.2, w * 0.2); g.fill();
    // bristles
    g.fillStyle = "#f6f0e0"; g.beginPath(); g.moveTo(-w * 0.55, -L * 0.27); g.lineTo(w * 0.55, -L * 0.27); g.lineTo(0, -L * 0.52); g.closePath(); g.fill();
    // rainbow blob
    const gr = g.createLinearGradient(-w, -L * 0.6, w, -L * 0.4);
    ["#ff8fa3", "#ffd36b", "#a8e6a0", "#74b9ff", "#c9c3ff"].forEach(function (c, i) { gr.addColorStop(i / 4, c); });
    g.shadowColor = "#ff8fd0"; g.shadowBlur = s * 0.06;
    g.fillStyle = gr; g.beginPath(); g.ellipse(0, -L * 0.52, w * 0.95, w * 0.7, 0, 0, Math.PI * 2); g.fill();
    g.restore();
    g.save();
    [["#ff6b6b", 0.2, 0.82], ["#ffe066", 0.5, 0.9], ["#74b9ff", 0.8, 0.82]].forEach(function (b) {
      g.shadowColor = b[0]; g.shadowBlur = s * 0.04; g.fillStyle = b[0];
      g.beginPath(); g.arc(s * b[1], s * b[2], s * 0.075, 0, Math.PI * 2); g.fill();
    });
    g.restore();
  }

  Arcade.register({
    id: "paint",
    name: "Paint",
    tagline: "A coloring book: pick a color, tap a part to fill it.",
    accent: "#ff8fd0",
    complexity: "low",
    controls: "click",
    scoreLabel: "Fills",
    kid: true,
    kidIcon(g, s) { drawBrush(g, s); },
    create() {
      let stageEl, ctx, canvas, g, unResize = null;
      let S = 0, dpr = 1, reduced = false;
      let now = 0, fills = 0;
      let pic = 0, picIn = 1, sel = 6, selWig = 0;
      let pics = [];             // [ [ {name, path, cx, cy} ... ] x3 ]
      let colors = [[], [], []]; // per picture: color index per region, -1 = unfilled
      let pops = [[], [], []];   // per picture: pop anim per region
      let sparks = [];
      let btnPress = [0, 0];
      let box = { x: 0, y: 0, w: 1, h: 1 };

      // ---- picture builders: normalized 0..1 coords inside the drawing box ----
      function rect(p, x, y, w, h) { p.rect(box.x + x * box.w, box.y + y * box.h, w * box.w, h * box.h); }
      function circ(p, x, y, r) { p.arc(box.x + x * box.w, box.y + y * box.h, r * box.w, 0, Math.PI * 2); }
      function ell(p, x, y, rx, ry, rot) { p.ellipse(box.x + x * box.w, box.y + y * box.h, rx * box.w, ry * box.h, rot || 0, 0, Math.PI * 2); }
      function poly(p, pts) { pts.forEach(function (q, i) { const X = box.x + q[0] * box.w, Y = box.y + q[1] * box.h; if (i) p.lineTo(X, Y); else p.moveTo(X, Y); }); p.closePath(); }
      function region(name, cx, cy, build) { const p = new Path2D(); build(p); return { name: name, path: p, cx: box.x + cx * box.w, cy: box.y + cy * box.h }; }

      function buildHouse() {
        return [
          region("ground", 0.5, 0.91, function (p) { rect(p, 0, 0.82, 1, 0.18); }),
          region("sun", 0.85, 0.16, function (p) { circ(p, 0.85, 0.16, 0.11); }),
          region("wall", 0.425, 0.62, function (p) { rect(p, 0.13, 0.42, 0.59, 0.4); }),
          region("roof", 0.425, 0.3, function (p) { poly(p, [[0.06, 0.44], [0.425, 0.1], [0.79, 0.44]]); }),
          region("door", 0.425, 0.7, function (p) { rect(p, 0.35, 0.58, 0.15, 0.24); }),
          region("win1", 0.245, 0.55, function (p) { rect(p, 0.175, 0.48, 0.14, 0.14); }),
          region("win2", 0.605, 0.55, function (p) { rect(p, 0.535, 0.48, 0.14, 0.14); })
        ];
      }
      function buildFlower() {
        const r = [];
        r.push(region("pot", 0.5, 0.86, function (p) { poly(p, [[0.28, 0.72], [0.72, 0.72], [0.65, 1.0], [0.35, 1.0]]); }));
        r.push(region("stem", 0.5, 0.56, function (p) { rect(p, 0.44, 0.4, 0.12, 0.33); }));
        r.push(region("leaf1", 0.3, 0.6, function (p) { ell(p, 0.3, 0.6, 0.15, 0.075, -0.5); }));
        r.push(region("leaf2", 0.7, 0.6, function (p) { ell(p, 0.7, 0.6, 0.15, 0.075, 0.5); }));
        for (let i = 0; i < 6; i++) {
          const a = -Math.PI / 2 + i * Math.PI / 3, px = 0.5 + Math.cos(a) * 0.17, py = 0.25 + Math.sin(a) * 0.17;
          r.push(region("petal" + i, px, py, function (p) { ell(p, px, py, 0.095, 0.15, a + Math.PI / 2); }));
        }
        r.push(region("center", 0.5, 0.25, function (p) { circ(p, 0.5, 0.25, 0.11); }));
        return r;
      }
      function buildDino() {
        const r = [];
        r.push(region("tail", 0.12, 0.72, function (p) { ell(p, 0.14, 0.7, 0.14, 0.09, 0.6); }));
        r.push(region("leg1", 0.32, 0.86, function (p) { rect(p, 0.25, 0.72, 0.15, 0.24); }));
        r.push(region("leg2", 0.58, 0.86, function (p) { rect(p, 0.5, 0.72, 0.15, 0.24); }));
        r.push(region("body", 0.45, 0.6, function (p) { ell(p, 0.45, 0.6, 0.3, 0.22, 0); }));
        r.push(region("belly", 0.42, 0.66, function (p) { ell(p, 0.42, 0.66, 0.17, 0.12, 0); }));
        [0.2, 0.33, 0.46].forEach(function (x, i) { r.push(region("spike" + i, x, 0.36, function (p) { poly(p, [[x - 0.08, 0.46], [x, 0.26], [x + 0.08, 0.46]]); })); });
        r.push(region("head", 0.72, 0.3, function (p) { circ(p, 0.72, 0.3, 0.18); }));
        r.push(region("eye", 0.77, 0.25, function (p) { circ(p, 0.77, 0.25, 0.07); }));
        return r;
      }

      function resize() {
        S = Arcade.board.stageSize(880);
        dpr = window.devicePixelRatio || 1;
        canvas.style.width = S + "px"; canvas.style.height = S + "px";
        canvas.width = Math.round(S * dpr); canvas.height = Math.round(S * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        box = { x: S * 0.09, y: S * 0.17, w: S * 0.82, h: S * 0.6 };
        pics = [buildHouse(), buildFlower(), buildDino()];
        for (let i = 0; i < 3; i++) {
          while (colors[i].length < pics[i].length) colors[i].push(-1);
          while (pops[i].length < pics[i].length) pops[i].push(0);
        }
      }

      // ---- layout of the chrome ----
      function btnPos(i) { return { x: i === 0 ? S * 0.1 : S * 0.9, y: S * 0.085, r: S * 0.065 }; }
      function blobPos(i) { return { x: S * (0.115 + i * 0.11), y: S * 0.895, r: S * 0.045 }; }
      function bob() { return reduced ? 0 : Math.sin(now * 0.0015) * S * 0.006; }

      // ---- actions ----
      function pickColor(i) {
        sel = i; selWig = 1;
        ctx.audio.tone(NOTES[i], 0.14, { type: "triangle", vol: 0.08 });
      }
      function fillRegion(ri) {
        const c = colors[pic];
        const was = c[ri];
        c[ri] = sel; pops[pic][ri] = 1;
        fills++; ctx.setScore(fills);
        ctx.audio.tone(NOTES[sel] * 0.75, 0.16, { type: "sine", vol: 0.13, glide: NOTES[sel] });
        if (fills % 10 === 0) ctx.audio.arp([784, 1046, 1318, 1568], { dur: 0.16, step: 0.07, vol: 0.11, type: "sine", when: 0.12 });
        const rg = pics[pic][ri];
        const n = reduced ? 6 : (was === -1 ? 22 : 12);
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2, sp = S * (0.0002 + Math.random() * 0.0005);
          sparks.push({ x: rg.cx, y: rg.cy + bob(), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - S * 0.0002, life: 1, r: S * (0.005 + Math.random() * 0.008), col: i % 3 === 0 ? "#ffffff" : PALETTE[sel] });
        }
      }
      function switchPic(dir) {
        pic = (pic + dir + 3) % 3; picIn = 0; btnPress[dir > 0 ? 1 : 0] = 1;
        ctx.audio.arp(dir > 0 ? [440, 554, 659] : [659, 554, 440], { dur: 0.1, step: 0.05, vol: 0.07, type: "triangle" });
      }

      function hitRegion(x, y) {
        const regs = pics[pic];
        const py = y - bob();
        // isPointInPath takes the point in device pixels (the CTM only scales the path), so apply dpr
        for (let i = regs.length - 1; i >= 0; i--) if (g.isPointInPath(regs[i].path, x * dpr, py * dpr)) return i;
        // generous fallback: nearest region center within a fingertip
        let best = -1, bd = S * 0.07;
        regs.forEach(function (r, i) { const d = Math.hypot(x - r.cx, py - r.cy); if (d < bd) { bd = d; best = i; } });
        return best;
      }

      function update(dt) {
        now += dt;
        if (picIn < 1) picIn = Math.min(1, picIn + dt / 320);
        if (selWig > 0) selWig = Math.max(0, selWig - dt / 500);
        for (let i = 0; i < 2; i++) if (btnPress[i] > 0) btnPress[i] = Math.max(0, btnPress[i] - dt / 250);
        const pp = pops[pic];
        for (let i = 0; i < pp.length; i++) if (pp[i] > 0) pp[i] = Math.max(0, pp[i] - dt / 380);
        for (let i = sparks.length - 1; i >= 0; i--) {
          const c = sparks[i]; c.vy += S * 0.0000012 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.life -= dt / 900;
          if (c.life <= 0) sparks.splice(i, 1);
        }
      }

      // ---- drawing ----
      function drawArrow(i) {
        const b = btnPos(i), k = 1 + btnPress[i] * 0.15 + (reduced ? 0 : Math.sin(now * 0.002 + i * 2) * 0.03);
        g.save(); g.translate(b.x, b.y); g.scale(k, k);
        g.fillStyle = "rgba(255,143,208,0.18)"; g.shadowColor = "#ff8fd0"; g.shadowBlur = S * 0.02;
        g.beginPath(); g.arc(0, 0, b.r, 0, Math.PI * 2); g.fill();
        g.shadowBlur = 0; g.strokeStyle = "rgba(255,255,255,0.55)"; g.lineWidth = S * 0.006; g.stroke();
        g.fillStyle = "#ffffff"; const d = i === 0 ? -1 : 1, r = b.r * 0.45;
        g.beginPath(); g.moveTo(d * r, 0); g.lineTo(-d * r * 0.6, -r * 0.85); g.lineTo(-d * r * 0.6, r * 0.85); g.closePath(); g.fill();
        g.restore();
      }
      function drawBlob(i) {
        const b = blobPos(i), on = i === sel;
        const k = on ? 1.35 + Math.sin(now * 0.004) * 0.05 : 1;
        const wig = on ? Math.sin(now * 0.03) * selWig * 0.25 : 0;
        g.save(); g.translate(b.x, b.y); g.rotate(wig); g.scale(k, k);
        g.fillStyle = PALETTE[i]; g.shadowColor = PALETTE[i]; g.shadowBlur = on ? S * 0.03 : S * 0.012;
        g.beginPath(); g.ellipse(0, 0, b.r, b.r * 0.92, 0, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(-b.r * 0.55, -b.r * 0.55, b.r * 0.3, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(b.r * 0.5, b.r * 0.55, b.r * 0.25, 0, Math.PI * 2); g.fill();
        g.shadowBlur = 0;
        if (on) { g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = S * 0.005; g.beginPath(); g.arc(0, 0, b.r * 1.25, 0, Math.PI * 2); g.stroke(); }
        g.fillStyle = "rgba(255,255,255,0.45)"; g.beginPath(); g.ellipse(-b.r * 0.3, -b.r * 0.35, b.r * 0.22, b.r * 0.14, -0.6, 0, Math.PI * 2); g.fill();
        g.restore();
      }
      function drawDecor() {
        // little faces / details that make the picture read at a glance (no text)
        g.save(); g.strokeStyle = "rgba(255,255,255,0.7)"; g.lineWidth = S * 0.006; g.lineCap = "round";
        const X = function (x) { return box.x + x * box.w; }, Y = function (y) { return box.y + y * box.h; };
        if (pic === 0) {
          // sun rays rotate slowly; door knob; window crosses
          g.save(); g.translate(X(0.85), Y(0.16)); g.rotate(reduced ? 0 : now * 0.0004);
          for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.beginPath(); g.moveTo(Math.cos(a) * box.w * 0.14, Math.sin(a) * box.w * 0.14); g.lineTo(Math.cos(a) * box.w * 0.19, Math.sin(a) * box.w * 0.19); g.stroke(); }
          g.restore();
          [0.245, 0.605].forEach(function (x) { g.beginPath(); g.moveTo(X(x), Y(0.48)); g.lineTo(X(x), Y(0.62)); g.moveTo(X(x - 0.07), Y(0.55)); g.lineTo(X(x + 0.07), Y(0.55)); g.stroke(); });
          g.fillStyle = "rgba(255,255,255,0.8)"; g.beginPath(); g.arc(X(0.46), Y(0.7), S * 0.008, 0, Math.PI * 2); g.fill();
        } else if (pic === 1) {
          g.fillStyle = "#3a2a44";
          [-1, 1].forEach(function (d) { g.beginPath(); g.arc(X(0.5 + d * 0.035), Y(0.235), S * 0.011, 0, Math.PI * 2); g.fill(); });
          g.strokeStyle = "#3a2a44"; g.beginPath(); g.arc(X(0.5), Y(0.255), box.w * 0.045, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
          g.strokeStyle = "rgba(255,255,255,0.5)"; g.beginPath(); g.moveTo(X(0.3), Y(0.62)); g.lineTo(X(0.42), Y(0.55)); g.moveTo(X(0.7), Y(0.62)); g.lineTo(X(0.58), Y(0.55)); g.stroke();
        } else {
          g.fillStyle = "#2a2a44"; const blink = !reduced && Math.sin(now * 0.0025) > 0.96;
          if (blink) { g.strokeStyle = "#2a2a44"; g.beginPath(); g.moveTo(X(0.73), Y(0.25)); g.lineTo(X(0.81), Y(0.25)); g.stroke(); }
          else { g.beginPath(); g.arc(X(0.78), Y(0.255), S * 0.014, 0, Math.PI * 2); g.fill(); }
          g.strokeStyle = "#2a2a44"; g.beginPath(); g.arc(X(0.74), Y(0.36), box.w * 0.07, 0.1 * Math.PI, 0.8 * Math.PI); g.stroke();
          g.fillStyle = "rgba(255,110,140,0.35)"; g.beginPath(); g.ellipse(X(0.66), Y(0.36), S * 0.018, S * 0.011, 0, 0, Math.PI * 2); g.fill();
        }
        g.restore();
      }

      function draw() {
        g.clearRect(0, 0, S, S);
        const bg = g.createLinearGradient(0, 0, 0, S);
        bg.addColorStop(0, "#161228"); bg.addColorStop(1, "#1e1830");
        g.fillStyle = bg; g.fillRect(0, 0, S, S);
        // counter
        g.save(); g.textAlign = "center"; g.textBaseline = "top";
        g.fillStyle = "#ffd36b"; g.shadowColor = "rgba(255,211,107,0.6)"; g.shadowBlur = 16;
        g.font = "800 " + Math.round(S * 0.075) + "px system-ui, sans-serif";
        g.fillText("★ " + fills, S / 2, S * 0.03);
        g.restore();
        drawArrow(0); drawArrow(1);
        // paper card behind the picture
        g.save(); g.fillStyle = "rgba(255,255,255,0.035)"; g.beginPath(); rrect(g, box.x - S * 0.03, box.y - S * 0.03, box.w + S * 0.06, box.h + S * 0.06, S * 0.03); g.fill(); g.restore();
        // picture
        const regs = pics[pic], cols = colors[pic], pp = pops[pic];
        const ease = 1 - Math.pow(1 - picIn, 3);
        g.save();
        g.translate(S / 2, box.y + box.h / 2 + bob()); g.scale(0.6 + 0.4 * ease, 0.6 + 0.4 * ease); g.globalAlpha = ease; g.translate(-S / 2, -(box.y + box.h / 2));
        regs.forEach(function (r, i) {
          const pop = pp[i], k = 1 + Math.sin(pop * Math.PI) * 0.09;
          g.save();
          if (pop > 0) { g.translate(r.cx, r.cy); g.scale(k, k); g.translate(-r.cx, -r.cy); }
          if (cols[i] >= 0) { g.fillStyle = PALETTE[cols[i]]; g.shadowColor = PALETTE[cols[i]]; g.shadowBlur = S * 0.012; }
          else { g.fillStyle = "rgba(255,255,255,0.05)"; g.shadowBlur = 0; }
          g.fill(r.path); g.shadowBlur = 0;
          g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineWidth = S * 0.011; g.lineJoin = "round"; g.shadowColor = "rgba(255,255,255,0.5)"; g.shadowBlur = S * 0.01;
          g.stroke(r.path);
          g.restore();
        });
        drawDecor();
        g.restore();
        // palette
        for (let i = 0; i < 8; i++) drawBlob(i);
        // sparkles
        sparks.forEach(function (c) { g.save(); g.globalAlpha = Math.max(0, c.life); g.fillStyle = c.col; g.shadowColor = c.col; g.shadowBlur = 8; g.translate(c.x, c.y); g.rotate(c.x * 0.03); g.fillRect(-c.r, -c.r * 0.5, c.r * 2, c.r); g.restore(); });
      }

      return {
        mount(stage, c) {
          stageEl = stage; ctx = c;
          reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          const wrap = document.createElement("div");
          wrap.style.display = "flex"; wrap.style.flexDirection = "column"; wrap.style.alignItems = "center";
          canvas = document.createElement("canvas");
          canvas.style.borderRadius = "18px"; canvas.style.background = "#161228"; canvas.style.cursor = "pointer";
          canvas.style.boxShadow = "0 0 46px rgba(255,143,208,0.14)"; canvas.style.touchAction = "none";
          g = canvas.getContext("2d");
          wrap.appendChild(canvas);
          const hint = document.createElement("div"); hint.className = "hint";
          hint.textContent = "Pick a color, tap a part of the picture to fill it. Arrows change the picture.";
          wrap.appendChild(hint);
          stage.appendChild(wrap);
          now = 0; fills = 0; pic = 0; picIn = 1; sel = 6; selWig = 0; sparks = [];
          colors = [[], [], []]; pops = [[], [], []]; btnPress = [0, 0];
          resize();
          ctx.setScore(0);
          Arcade.input.setPointerTarget(canvas);
          unResize = Arcade.board.onResize(function () { resize(); });
          draw();
        },
        handleInput(intent) {
          if (intent.type !== "point" || intent.phase !== "down" || intent.button !== 0) return;
          const x = intent.x, y = intent.y;
          for (let i = 0; i < 2; i++) { const b = btnPos(i); if (Math.hypot(x - b.x, y - b.y) < b.r * 1.4) { switchPic(i === 0 ? -1 : 1); return; } }
          if (y > S * 0.82) {
            let best = -1, bd = S * 0.075;
            for (let i = 0; i < 8; i++) { const b = blobPos(i); const d = Math.hypot(x - b.x, y - b.y); if (d < bd) { bd = d; best = i; } }
            if (best >= 0) { pickColor(best); return; }
          }
          const ri = hitRegion(x, y);
          if (ri >= 0) { fillRegion(ri); return; }
          ctx.audio.tone(330, 0.08, { type: "sine", vol: 0.04, glide: 420 });   // gentle blip, nothing lost
        },
        tick(dt) { update(Math.min(50, dt)); draw(); },
        getScore() { return fills; },
        teardown() {
          if (unResize) unResize(); unResize = null;
          stageEl = ctx = canvas = g = null; pics = []; sparks = [];
        }
      };
    }
  });
})();
