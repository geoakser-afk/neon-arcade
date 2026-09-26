/* Chimes — made for Christopher (age 5), from a game he and George invented at a park
   on the big outdoor tubular chimes: one person hits a tube, the other has to find WHICH
   one by ear and touch it to stop the ringing — then you switch. Six metal tubes, tallest
   (lowest) to shortest (highest), pentatonic so everything sounds good. The fire-pup is
   the other player: he hits, Chris finds; then Chris hits and the pup guesses (sometimes
   wrong first). Early rounds the ringing tube shimmers; later it's ears only, with the
   pup re-hitting it as a hint. Free play always works. No losing, no clock. */
(function () {
  const TAU = Math.PI * 2;
  const NOTES = [392, 440, 523, 587, 659, 784];                       // G4 A4 C5 D5 E5 G5 (pentatonic)
  const COLS = ["#74b9ff", "#7fe0a0", "#ffd36b", "#ffb86b", "#ff8fd0", "#c9c3ff"];

  function drawTube(g, x, top, w, h, col, glow, wob) {
    g.save(); g.translate(Math.sin(wob * 30) * w * 0.08 * wob, 0);
    if (glow > 0) { g.shadowColor = col; g.shadowBlur = w * (0.6 + glow * 1.2); }
    const gr = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    gr.addColorStop(0, "#8a86a8"); gr.addColorStop(0.3, "#f4f2ff"); gr.addColorStop(0.55, "#c9c6dc"); gr.addColorStop(1, "#6a6788");
    g.fillStyle = gr; g.beginPath(); g.roundRect(x - w / 2, top, w, h, w / 2); g.fill();
    g.shadowBlur = 0;
    if (glow > 0) { g.globalAlpha = glow * 0.55; g.fillStyle = col; g.beginPath(); g.roundRect(x - w / 2, top, w, h, w / 2); g.fill(); g.globalAlpha = 1; }
    g.fillStyle = col; g.beginPath(); g.roundRect(x - w / 2, top + h * 0.12, w, w * 0.5, w * 0.2); g.fill();   // colour band
    g.fillStyle = "rgba(255,255,255,0.5)"; g.beginPath(); g.ellipse(x - w * 0.18, top + h * 0.5, w * 0.12, h * 0.42, 0, 0, TAU); g.fill();
    g.restore();
  }
  function drawPup(g, x, y, r, o) {
    o = o || {}; const t = o.t || 0;
    g.save(); g.translate(x, y);
    if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = r * 0.6; }
    g.fillStyle = "#f6f3ff"; g.beginPath(); g.ellipse(0, r * 1.05, r * 0.8, r * 0.55, 0, 0, TAU); g.fill();
    g.fillStyle = "#e84f5a"; g.beginPath(); g.ellipse(0, r * 0.78, r * 0.62, r * 0.16, 0, 0, TAU); g.fill();
    g.fillStyle = "#2a2434"; [-1, 1].forEach(function (d) { g.beginPath(); g.ellipse(d * r * 0.88, r * 0.05, r * 0.3, r * 0.55, d * 0.35, 0, TAU); g.fill(); });
    const hg = g.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r * 1.15); hg.addColorStop(0, "#ffffff"); hg.addColorStop(1, "#e6e0f5");
    g.fillStyle = hg; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); g.shadowBlur = 0;
    g.fillStyle = "#2a2434"; g.beginPath(); g.ellipse(-r * 0.62, -r * 0.1, r * 0.2, r * 0.26, 0.3, 0, TAU); g.fill(); g.beginPath(); g.ellipse(r * 0.55, r * 0.35, r * 0.15, r * 0.2, -0.4, 0, TAU); g.fill();
    g.save(); g.beginPath(); g.rect(-r * 1.4, -r * 1.6, r * 2.8, r * 1.15); g.clip(); g.fillStyle = "#e84f5a"; g.beginPath(); g.arc(0, -r * 0.35, r * 1.02, 0, TAU); g.fill(); g.restore();
    g.fillStyle = "#c93c47"; g.beginPath(); g.ellipse(0, -r * 0.45, r * 1.18, r * 0.16, 0, 0, TAU); g.fill();
    g.fillStyle = "#ffd36b"; g.beginPath(); g.moveTo(0, -r * 1.15); g.lineTo(r * 0.22, -r * 1.0); g.lineTo(r * 0.18, -r * 0.72); g.lineTo(0, -r * 0.64); g.lineTo(-r * 0.18, -r * 0.72); g.lineTo(-r * 0.22, -r * 1.0); g.closePath(); g.fill();
    // eyes: open / covered by paws (when he's not allowed to peek) / thinking
    if (o.cover) { g.fillStyle = "#f6f3ff"; [-1, 1].forEach(function (d) { g.beginPath(); g.ellipse(d * r * 0.4, -r * 0.05, r * 0.32, r * 0.28, 0, 0, TAU); g.fill(); g.fillStyle = "#2a2434"; g.beginPath(); g.arc(d * r * 0.3, r * 0.05, r * 0.05, 0, TAU); g.fill(); g.fillStyle = "#f6f3ff"; }); }
    else {
      const blink = Math.sin(t * 0.0025 + 1.3) > 0.975;
      [-1, 1].forEach(function (d) { const ex = d * r * 0.36, ey = -r * 0.05; g.fillStyle = "#2a2434";
        if (blink) { g.lineWidth = r * 0.08; g.strokeStyle = "#2a2434"; g.lineCap = "round"; g.beginPath(); g.moveTo(ex - r * 0.14, ey); g.lineTo(ex + r * 0.14, ey); g.stroke(); return; }
        g.beginPath(); g.ellipse(ex + (o.look || 0) * r * 0.08, ey, r * 0.17, r * 0.22, 0, 0, TAU); g.fill(); g.fillStyle = "#fff"; g.beginPath(); g.arc(ex - r * 0.06 + (o.look || 0) * r * 0.08, ey - r * 0.08, r * 0.07, 0, TAU); g.fill(); });
    }
    g.fillStyle = "#fff"; g.beginPath(); g.ellipse(0, r * 0.42, r * 0.42, r * 0.32, 0, 0, TAU); g.fill();
    g.fillStyle = "#2a2434"; g.beginPath(); g.ellipse(0, r * 0.3, r * 0.15, r * 0.11, 0, 0, TAU); g.fill();
    g.strokeStyle = "#2a2434"; g.lineWidth = r * 0.06; g.lineCap = "round"; g.beginPath();
    if (o.mood === "hmm") { g.moveTo(-r * 0.18, r * 0.58); g.lineTo(r * 0.18, r * 0.55); }
    else { g.moveTo(0, r * 0.4); g.lineTo(0, r * 0.52); g.moveTo(-r * 0.22, r * 0.5); g.quadraticCurveTo(0, r * 0.72, r * 0.22, r * 0.5); }
    g.stroke();
    if (o.mood === "party") { g.fillStyle = "#ff8fa3"; g.beginPath(); g.ellipse(r * 0.08, r * 0.66, r * 0.11, r * 0.14, 0, 0, TAU); g.fill(); }
    g.fillStyle = "rgba(255,120,150,0.3)"; [-1, 1].forEach(function (d) { g.beginPath(); g.ellipse(d * r * 0.62, r * 0.3, r * 0.16, r * 0.1, 0, 0, TAU); g.fill(); });
    g.restore();
  }
  function drawMallet(g, x, y, len, ang) {
    g.save(); g.translate(x, y); g.rotate(ang || 0);
    g.strokeStyle = "#d9b283"; g.lineWidth = len * 0.1; g.lineCap = "round"; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, len); g.stroke();
    g.fillStyle = "#ff8fa3"; g.shadowColor = "#ff8fa3"; g.shadowBlur = len * 0.25; g.beginPath(); g.arc(0, 0, len * 0.18, 0, TAU); g.fill();
    g.restore();
  }

  Arcade.register({
    id: "chimes",
    name: "Chimes",
    tagline: "Park chimes: who hit which tube? Find it by ear, then switch.",
    accent: "#c9c3ff",
    complexity: "low",
    controls: "click",
    scoreLabel: "Found",
    kid: true,
    kidName: "Chimes",
    kidIcon(g, s) {
      g.fillStyle = "rgba(90,70,100,0.9)"; g.beginPath(); g.roundRect(s * 0.1, s * 0.14, s * 0.8, s * 0.06, s * 0.03); g.fill();
      for (let i = 0; i < 6; i++) drawTube(g, s * (0.18 + i * 0.128), s * 0.2, s * 0.085, s * (0.62 - i * 0.07), COLS[i], i === 2 ? 0.9 : 0, 0);
      drawMallet(g, s * 0.5, s * 0.82, s * 0.16, -0.7);
    },
    create() {
      let ctx, canvas, g, unResize = null;
      let S = 0, dpr = 1, reduced = false, now = 0;
      let found = 0, stars = 0, level = 1, streak = 0;
      let tubes = [];                 // {x, top, w, h, col, note, glow, wob, ring}
      let state = "pupHit", st = 0;   // pupHit → guess → win → yourTurn → pupThink → pupGuess → pupWin → pupHit
      let target = -1, wrongs = 0, lastHint = 0, turns = 0;
      let pup = { x: 0.5, y: 0.9, r: 0.055, cover: false, mood: "happy", look: 0, mallet: null };   // mallet: {tx, ty, t, dur}
      let pupPick = -1, pupWrong = -1, eyes = 0, hidden = false, state_hitDone = false;   // eyes: 0..1 how far the "close your eyes" curtain is down
      let particles = [], rings = [], barkEl = null, barkAt = -9999, voiceAt = -9999, pointer = { x: -1, y: -1, seen: -9999 };

      function say(parts) { if (!Arcade.voice || now - voiceAt < 300) return; voiceAt = now; try { Arcade.voice.stop(); Arcade.voice.say(parts, "jessica"); } catch (e) {} }
      function bark() { if (now - barkAt < 900) return; barkAt = now; try { if (!barkEl) { barkEl = new Audio("audio/animals/dog.mp3"); barkEl.volume = 0.6; } barkEl.currentTime = 0; const p = barkEl.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {} }

      function resize() {
        S = Arcade.board.stageSize(880); dpr = window.devicePixelRatio || 1;
        canvas.style.width = S + "px"; canvas.style.height = S + "px";
        canvas.width = Math.round(S * dpr); canvas.height = Math.round(S * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        layout();
      }
      function layout() {
        const old = tubes; tubes = [];
        for (let i = 0; i < 6; i++) tubes.push({ x: 0.16 + i * 0.136, top: 0.2, w: 0.085, h: 0.58 - i * 0.07, col: COLS[i], note: NOTES[i], glow: old[i] ? old[i].glow : 0, wob: old[i] ? old[i].wob : 0 });
      }
      // metal tube: fundamental + two inharmonic partials, long ring
      function ringTube(i, vol) {
        const t = tubes[i], f = t.note, v = vol == null ? 1 : vol;
        ctx.audio.tone(f, 1.8, { type: "sine", vol: 0.16 * v, attack: 0.004 });
        ctx.audio.tone(f * 2.76, 0.9, { type: "sine", vol: 0.05 * v, attack: 0.003 });
        ctx.audio.tone(f * 5.4, 0.35, { type: "sine", vol: 0.025 * v, attack: 0.002 });
        ctx.audio.tone(f * 1.003, 1.6, { type: "triangle", vol: 0.03 * v, attack: 0.02 });
        t.wob = hidden ? 0 : 1;
        if (hidden) return;
        rings.push({ x: t.x, y: t.top + t.h * 0.3, r: 0.02, col: t.col, life: 1 });
        for (let k = 0; k < (reduced ? 2 : 6); k++) { const a = Math.random() * TAU; particles.push({ x: t.x, y: t.top + t.h * 0.3, vx: Math.cos(a) * 0.0002, vy: Math.sin(a) * 0.0002 - 0.0001, life: 1, r: 0.006, col: t.col }); }
      }
      function damp(i) { tubes[i].wob = 0; tubes[i].glow = 0; ctx.audio.tone(tubes[i].note, 0.06, { type: "sine", vol: 0.05 }); }
      function tubeAt(x, y) {
        let best = -1, bd = Infinity;
        tubes.forEach(function (t, i) { if (y < t.top - 0.04 || y > t.top + t.h + 0.06) return; const d = Math.abs(x - t.x); if (d < t.w * 0.9 && d < bd) { bd = d; best = i; } });
        return best;
      }
      function confetti(x, y, n) { for (let i = 0; i < (reduced ? 8 : n); i++) { const a = Math.random() * TAU, sp = 0.0003 * (0.4 + Math.random()); particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.00015, life: 1.2, r: 0.007 + Math.random() * 0.006, col: COLS[i % 6], rect: true }); } }
      function setState(s) { state = s; st = 0; }
      function addStar() { found++; stars++; ctx.setScore(found); ctx.storage.set("stars", stars); }
      function hintGlow() { return level <= 1 ? 1 : level === 2 ? 0.45 : (wrongs >= 2 ? 0.7 : 0); }

      // pup swings the mallet at tube i; onHit fires when it lands
      function pupSwing(i, soft, then) { pup.mallet = { i: i, t: 0, dur: 520, soft: soft, then: then }; }

      function update(dt) {
        now += dt; st += dt;
        tubes.forEach(function (t, i) {
          t.wob = Math.max(0, t.wob - dt / 900);
          const want = (state === "guess" && i === target) ? hintGlow() * (0.6 + 0.4 * Math.sin(now * 0.006)) : 0;
          t.glow += (want - t.glow) * Math.min(1, dt / 200);
        });
        eyes += (((state === "eyesClosed" || state === "eyesOpen") ? 1 : 0) - eyes) * Math.min(1, dt / 260);
        if (pup.mallet) {
          const m = pup.mallet; m.t += dt;
          if (m.t >= m.dur && !m.hit) { m.hit = true; ringTube(m.i, m.soft ? 0.55 : 1); if (m.then) m.then(); }
          if (m.t >= m.dur + 400) pup.mallet = null;
        }
        pup.look += (((state === "guess" || state === "pupHit") && target >= 0 ? (tubes[target].x - 0.5) * 2 : 0) - pup.look) * Math.min(1, dt / 300);

        if (state === "pupHit") {
          pup.cover = false; pup.mood = "happy";
          if (st > 700 && target < 0) { target = Math.floor(Math.random() * 6); wrongs = 0; setState("eyesClosed"); say("Close your eyes!"); }
        } else if (state === "eyesClosed") {
          hidden = true;
          if (st > 1700 && !pup.mallet && !state_hitDone) { state_hitDone = true; pupSwing(target, false, function () { setState("eyesOpen"); }); }
        } else if (state === "eyesOpen") {
          if (st > 900) { hidden = false; state_hitDone = false; setState("guess"); lastHint = now; say(["Open your eyes!", "Which one did I hit?"]); }
        } else if (state === "guess") {
          if (now - lastHint > 3200 && !pup.mallet) { lastHint = now; pupSwing(target, true); }   // re-hit as a hint
        } else if (state === "win") {
          pup.mood = "party";
          if (st > 1900) { turns++; target = -1; if (turns % 2 === 1) { setState("yourTurn"); say("Your turn! Hit a chime!"); } else setState("pupHit"); }
        } else if (state === "yourTurn") {
          pup.cover = true; pup.mood = "happy";
        } else if (state === "pupThink") {
          pup.cover = false; pup.mood = "hmm";
          if (st > 1300) {
            const wrongFirst = Math.random() < 0.35;
            if (wrongFirst) { pupWrong = Math.max(0, Math.min(5, pupPick + (Math.random() < 0.5 ? -1 : 1))); if (pupWrong === pupPick) pupWrong = (pupPick + 1) % 6; setState("pupGuess"); pupSwing(pupWrong, false, function () { pup.mood = "hmm"; }); }
            else { setState("pupGuess"); pupWrong = -1; pupSwing(pupPick, false, function () { setState("pupWin"); damp(pupPick); confetti(tubes[pupPick].x, tubes[pupPick].top + 0.1, 30); ctx.audio.arp([784, 988, 1175, 1568], { dur: 0.16, step: 0.07, vol: 0.12 }); bark(); }); }
          }
        } else if (state === "pupGuess") {
          if (pupWrong >= 0 && st > 1800 && !pup.mallet) { pupWrong = -1; pupSwing(pupPick, false, function () { setState("pupWin"); damp(pupPick); confetti(tubes[pupPick].x, tubes[pupPick].top + 0.1, 30); ctx.audio.arp([784, 988, 1175, 1568], { dur: 0.16, step: 0.07, vol: 0.12 }); bark(); }); }
        } else if (state === "pupWin") {
          pup.mood = "party";
          if (st > 1900) { turns++; addStar(); setState("pupHit"); }
        }

        for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; if (p.rect) p.vy += 0.0000015 * dt; p.life -= dt / 1200; if (p.life <= 0) particles.splice(i, 1); }
        for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.r += dt * 0.00012; r.life -= dt / 900; if (r.life <= 0) rings.splice(i, 1); }
      }

      function tap(x, y) {
        if (state === "eyesClosed" || state === "eyesOpen") return;
        const i = tubeAt(x, y);
        if (i < 0) { ctx.audio.tone(330, 0.08, { type: "sine", vol: 0.04, glide: 420 }); return; }
        if (state === "guess") {
          if (i === target) {
            damp(i); addStar(); streak++; if (streak % 3 === 0) level = Math.min(4, level + 1);
            ctx.audio.arp([523, 659, 784, 1046], { dur: 0.18, step: 0.08, vol: 0.13 }); say("Yes!"); bark();
            confetti(tubes[i].x, tubes[i].top + 0.1, 40); setState("win"); return;
          }
          ringTube(i, 1); wrongs++; lastHint = now - 2400;   // wrong tube: just hear it, pup re-hits the real one soon
          return;
        }
        if (state === "yourTurn") { ringTube(i, 1); pupPick = i; setState("pupThink"); say("Hmm, let me listen."); return; }
        ringTube(i, 1);   // free play anywhere else
      }

      function draw() {
        g.clearRect(0, 0, S, S);
        const sky = g.createLinearGradient(0, 0, 0, S); sky.addColorStop(0, "#131026"); sky.addColorStop(0.6, "#1c1630"); sky.addColorStop(1, "#1e2a2a");
        g.fillStyle = sky; g.fillRect(0, 0, S, S);
        for (let i = 0; i < 22; i++) { const x = ((i * 137.5) % 100) / 100 * S, y = ((i * 91.7) % 16) / 100 * S; g.fillStyle = "rgba(255,255,255," + (0.12 + 0.3 * (0.5 + 0.5 * Math.sin(now * 0.002 + i))) + ")"; g.beginPath(); g.arc(x, y, S * 0.003, 0, TAU); g.fill(); }
        g.fillStyle = "rgba(60,120,90,0.3)"; g.beginPath(); g.ellipse(S * 0.5, S * 1.0, S * 0.8, S * 0.2, 0, 0, TAU); g.fill();
        g.save(); g.textAlign = "center"; g.textBaseline = "top"; g.fillStyle = "#ffd36b"; g.shadowColor = "rgba(255,211,107,0.6)"; g.shadowBlur = 16; g.font = "800 " + Math.round(S * 0.07) + "px system-ui, sans-serif"; g.fillText("★ " + stars, S / 2, S * 0.02); g.restore();
        // frame: two posts + beam
        g.fillStyle = "#5a4a70"; g.beginPath(); g.roundRect(S * 0.06, S * 0.15, S * 0.88, S * 0.05, S * 0.02); g.fill();
        [0.09, 0.91].forEach(function (px) { g.fillRect(S * px - S * 0.015, S * 0.17, S * 0.03, S * 0.7); });
        rings.forEach(function (r) { g.save(); g.globalAlpha = Math.max(0, r.life) * 0.7; g.strokeStyle = r.col; g.lineWidth = S * 0.006; g.beginPath(); g.arc(r.x * S, r.y * S, r.r * S, 0, TAU); g.stroke(); g.restore(); });
        tubes.forEach(function (t) {
          g.strokeStyle = "rgba(255,255,255,0.5)"; g.lineWidth = S * 0.004; g.beginPath(); g.moveTo(t.x * S, S * 0.2); g.lineTo(t.x * S, t.top * S + S * 0.01); g.stroke();
          drawTube(g, t.x * S, t.top * S, t.w * S, t.h * S, t.col, t.glow, t.wob);
        });
        // "your turn" cue: a bouncing mallet above the tubes
        if (state === "yourTurn") { const b = Math.abs(Math.sin(now * 0.005)) * S * 0.03; drawMallet(g, S * 0.5, S * 0.09 - b, S * 0.09, -0.5 + Math.sin(now * 0.005) * 0.3); }
        // pup + his mallet
        const px = pup.x * S, py = pup.y * S, pr = pup.r * S;
        drawPup(g, px, py, pr, { t: now, cover: pup.cover, mood: pup.mood, look: pup.look, glow: "#ff9fa8" });
        if (pup.mallet) {
          const m = pup.mallet, t = tubes[m.i], u = Math.min(1, m.t / m.dur), e = u * u;
          const hx = px + (t.x * S - px) * e, hy = py - pr * 0.6 + ((t.top + t.h * 0.3) * S - (py - pr * 0.6)) * e;
          drawMallet(g, hx, hy, S * 0.1, m.hit ? 0.6 : -1.2 + e * 1.8);
        } else if (state === "pupHit" || state === "pupThink" || state === "guess") drawMallet(g, px + pr * 1.1, py - pr * 0.3, S * 0.1, -0.5 + Math.sin(now * 0.003) * 0.1);
        if (state === "pupThink") { g.save(); g.fillStyle = "rgba(255,255,255,0.9)"; g.beginPath(); g.arc(px + pr * 1.6, py - pr * 1.6, pr * 0.55, 0, TAU); g.fill(); g.fillStyle = "#2a2434"; g.font = "800 " + Math.round(pr * 0.7) + "px system-ui"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("?", px + pr * 1.6, py - pr * 1.55); g.restore(); }
        if (eyes > 0.01) {
          g.save(); g.globalAlpha = Math.min(1, eyes * 1.05); g.fillStyle = "#0d0a18"; g.fillRect(0, S * 0.12, S, S * 0.88); g.restore();
          g.save(); g.globalAlpha = eyes; g.strokeStyle = "#ffffff"; g.lineWidth = S * 0.018; g.lineCap = "round";
          [-1, 1].forEach(function (d) { const ex = S * (0.5 + d * 0.14), ey = S * 0.5; g.beginPath(); g.arc(ex, ey - S * 0.05, S * 0.09, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
            for (let k = -1; k <= 1; k++) { const a = Math.PI / 2 + k * 0.5, x1 = ex + Math.cos(a) * S * 0.09, y1 = ey - S * 0.05 + Math.sin(a) * S * 0.09; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 + Math.cos(a) * S * 0.035, y1 + Math.sin(a) * S * 0.035); g.stroke(); } });
          // sound waves so he knows something is ringing
          if (state === "eyesOpen" || (pup.mallet && pup.mallet.hit)) for (let i = 0; i < 3; i++) { const p = ((now * 0.0008) + i / 3) % 1; g.globalAlpha = eyes * (1 - p) * 0.7; g.strokeStyle = "#c9c3ff"; g.lineWidth = S * 0.008; g.beginPath(); g.arc(S * 0.5, S * 0.5, S * (0.16 + p * 0.2), 0, TAU); g.stroke(); }
          g.restore();
        }
        // Chris's mallet follows the pointer
        if (now - pointer.seen < 1500 && pointer.x >= 0) drawMallet(g, pointer.x, pointer.y, S * 0.09, -0.7);
        particles.forEach(function (p) { g.save(); g.globalAlpha = Math.max(0, Math.min(1, p.life)); g.fillStyle = p.col; if (p.rect) { g.translate(p.x * S, p.y * S); g.rotate(p.x * 40); g.fillRect(-p.r * S, -p.r * S * 0.6, p.r * S * 2, p.r * S * 1.2); } else { g.beginPath(); g.arc(p.x * S, p.y * S, p.r * S, 0, TAU); g.fill(); } g.restore(); });
      }

      return {
        mount(stage, c) {
          ctx = c; reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          const wrap = document.createElement("div"); wrap.style.display = "flex"; wrap.style.flexDirection = "column"; wrap.style.alignItems = "center";
          canvas = document.createElement("canvas"); canvas.style.borderRadius = "18px"; canvas.style.background = "#131026"; canvas.style.cursor = "none"; canvas.style.boxShadow = "0 0 46px rgba(201,195,255,0.16)"; canvas.style.touchAction = "none";
          g = canvas.getContext("2d"); wrap.appendChild(canvas);
          const hint = document.createElement("div"); hint.className = "hint"; hint.textContent = "Close your eyes while the pup hits a chime, then tap the one that's ringing. Then it's your turn."; wrap.appendChild(hint);
          stage.appendChild(wrap);
          now = 0; found = 0; level = 1; streak = 0; turns = 0; target = -1; particles = []; rings = []; state = "pupHit"; st = 0; pup.mallet = null; eyes = 0; hidden = false; state_hitDone = false;
          stars = ctx.storage.get("stars", 0);
          resize(); ctx.setScore(0);
          Arcade.input.setPointerTarget(canvas);
          unResize = Arcade.board.onResize(function () { resize(); });
          if (Arcade.voice) { try { Arcade.voice.preload(["Close your eyes!", "Open your eyes!", "Which one did I hit?", "Your turn! Hit a chime!", "Hmm, let me listen.", "Yes!"], "jessica"); } catch (e) {} }
          try { barkEl = new Audio("audio/animals/dog.mp3"); barkEl.preload = "auto"; barkEl.volume = 0.6; barkEl.load(); } catch (e) {}
          draw();
          if (window.__chimesDebug) window.__chimesDebug.state = function () { return { state: state, target: target, tubes: tubes, pupPick: pupPick, found: found, level: level }; };
        },
        handleInput(intent) {
          if (intent.type !== "point") return;
          pointer.x = intent.x; pointer.y = intent.y; pointer.seen = now;
          if (intent.phase === "down" && intent.button === 0) tap(intent.x / S, intent.y / S);
        },
        tick(dt) { update(Math.min(50, dt)); draw(); },
        getScore() { return found; },
        teardown() {
          if (unResize) unResize(); unResize = null;
          try { if (Arcade.voice) Arcade.voice.stop(); } catch (e) {}
          if (barkEl) { try { barkEl.pause(); } catch (e) {} } barkEl = null;
          ctx = canvas = g = null; tubes = []; particles = []; rings = [];
        }
      };
    }
  });
})();
