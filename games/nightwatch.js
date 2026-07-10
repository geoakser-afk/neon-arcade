/* Nightwatch — a calm-neon FNAF-style tension game. You watch 4 security
   camera feeds of a dark facility; faint glowing drifters creep toward their
   doors. Seal a threatening feed before it breaches — but sealing burns
   limited power, and some drifters are feints that recede on their own. No
   jumpscares, no gore: dread through slow ambience, not startle. */
(function () {
  Arcade.register({
    id: "nightwatch",
    name: "Nightwatch",
    tagline: "Watch the feeds. Seal the doors. Don't burn your power.",
    accent: "#e0705f",
    complexity: "high",
    controls: "mouse",
    scoreLabel: "Survived",
    create() {
      let stageEl, ctx, canvas, g, unResize = null;
      let cssS = 0, dpr = 1;
      let reduced = false;

      // accent (danger red) as rgb, plus the cold cyan feed tint
      let AR = 224, AG = 112, AB = 95;
      const CY = "95,208,200"; // cyan feed tint

      let feeds, power, elapsed, over, score;
      let spawnTimer, ambientTimer, dangerTimer, noiseTimer;
      let L = null; // layout rects

      // ---- tunables ----
      const POWER_MAX = 100;
      const REGEN = 7;        // power / second
      const SEAL_COST = 22;   // per seal activation
      const SEAL_MS = 2000;   // seal auto-opens after this
      const WARN = 0.60;      // enters warning band
      const DANGER = 0.82;    // committed — real threats only
      const REF_MS = 6200;    // ms for a base-speed drifter to cross 0..1

      function acc(a) { return "rgba(" + AR + "," + AG + "," + AB + "," + a + ")"; }
      function cyan(a) { return "rgba(" + CY + "," + a + ")"; }

      function hexToRgb(hex) {
        const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
        if (!m) return null;
        const n = parseInt(m[1], 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      }

      function resize() {
        const size = Arcade.board.stageSize(820);
        cssS = Math.round(size);
        dpr = window.devicePixelRatio || 1;
        canvas.style.width = cssS + "px";
        canvas.style.height = cssS + "px";
        canvas.width = Math.round(cssS * dpr);
        canvas.height = Math.round(cssS * dpr);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        computeLayout();
      }

      function computeLayout() {
        const S = cssS;
        const pad = S * 0.03;
        const powerH = S * 0.085;
        const gap = S * 0.025;
        const gridW = S - pad * 2;
        const gridH = S - pad * 2 - powerH - S * 0.02;
        const fw = (gridW - gap) / 2;
        const fh = (gridH - gap) / 2;
        const gridTop = pad;
        L = {
          pad: pad, gap: gap, fw: fw, fh: fh,
          feeds: [
            { x: pad, y: gridTop, w: fw, h: fh },
            { x: pad + fw + gap, y: gridTop, w: fw, h: fh },
            { x: pad, y: gridTop + fh + gap, w: fw, h: fh },
            { x: pad + fw + gap, y: gridTop + fh + gap, w: fw, h: fh }
          ],
          power: { x: pad, y: S - pad - powerH, w: gridW, h: powerH }
        };
      }

      function reset() {
        feeds = [0, 1, 2, 3].map(function (i) {
          return { sealed: false, sealTimer: 0, drifter: null, warnPinged: false, noise: [] };
        });
        power = POWER_MAX;
        elapsed = 0;
        over = false;
        score = 0;
        spawnTimer = 1400;
        ambientTimer = 0;
        dangerTimer = 0;
        noiseTimer = 0;
        regenNoise();
      }

      // ---- difficulty ramp (by seconds survived) ----
      function tSec() { return elapsed / 1000; }
      function spawnInterval() { return Math.max(900, 2600 - tSec() * 22); }
      function driftSpeed() {
        // proximity units per ms; ramps up with time
        const base = (1 / REF_MS) * (1 + tSec() * 0.012);
        return base * (0.8 + Math.random() * 0.45);
      }
      function feintChance() { return Math.max(0.20, 0.55 - tSec() * 0.004); }

      function spawn() {
        const empties = [];
        for (let i = 0; i < 4; i++) if (!feeds[i].drifter) empties.push(i);
        if (!empties.length) return;
        const i = empties[Math.floor(Math.random() * empties.length)];
        const feint = Math.random() < feintChance();
        feeds[i].drifter = {
          prox: 0.02,
          speed: driftSpeed(),
          feint: feint,
          feintTurn: 0.55 + Math.random() * 0.16, // where a feint gives up
          receding: false,
          jx: (Math.random() - 0.5) * 0.28        // horizontal drift within feed
        };
        feeds[i].warnPinged = false;
      }

      function trySeal(i) {
        if (over) return;
        const f = feeds[i];
        if (f.sealed) return;              // already sealed — ignore
        if (power < SEAL_COST) {           // no power — vulnerable, soft denial
          ctx.audio.tone(120, 0.12, { type: "sine", vol: 0.05, glide: 90 });
          return;
        }
        power -= SEAL_COST;
        f.sealed = true;
        f.sealTimer = SEAL_MS;
        if (f.drifter) f.drifter.receding = true; // seal repels the drifter
        ctx.audio.thunk();
      }

      function breach(i) {
        over = true;
        score = Math.floor(elapsed / 1000);
        ctx.audio.lose();
        ctx.onGameOver(score, {
          title: "They got in.",
          msg: "CAM " + ("0" + (i + 1)).slice(-2) + " breached. You held for " + score + "s."
        });
      }

      // ---- audio cues ----
      function ambient(dt) {
        ambientTimer -= dt;
        if (ambientTimer <= 0) {
          ambientTimer = 2600;
          ctx.audio.tone(68, 0.55, { type: "sine", vol: 0.03 });
        }
      }
      function dangerCue(dt, maxProx) {
        dangerTimer -= dt;
        if (maxProx >= DANGER && dangerTimer <= 0) {
          // soft rising proximity pulse — tension, never a jumpscare
          const f = 170 + (maxProx - DANGER) * 340;
          ctx.audio.tone(f, 0.16, { type: "sine", vol: 0.06 });
          dangerTimer = 640;
        }
      }

      function regenNoise() {
        const n = reduced ? 14 : 26;
        for (let i = 0; i < 4; i++) {
          const arr = feeds[i].noise;
          arr.length = 0;
          for (let k = 0; k < n; k++) {
            arr.push({ x: Math.random(), y: Math.random(), a: 0.04 + Math.random() * 0.10, s: 1 + Math.random() * 2 });
          }
        }
      }

      // ---- update ----
      function update(dt) {
        if (over) return;
        elapsed += dt;
        const s = Math.floor(elapsed / 1000);
        if (s !== score) { score = s; ctx.setScore(score); }

        power = Math.min(POWER_MAX, power + REGEN * (dt / 1000));

        // spawn
        spawnTimer -= dt;
        if (spawnTimer <= 0) { spawn(); spawnTimer = spawnInterval(); }

        let maxProx = 0;
        for (let i = 0; i < 4; i++) {
          const f = feeds[i];
          if (f.sealed) {
            f.sealTimer -= dt;
            if (f.sealTimer <= 0) { f.sealed = false; f.sealTimer = 0; }
          }
          const d = f.drifter;
          if (!d) continue;

          if (d.receding) {
            d.prox -= d.speed * dt * 2.2; // recede faster than it came
            if (d.prox <= 0) { f.drifter = null; continue; }
          } else {
            d.prox += d.speed * dt;
            // feints lose their nerve in the warning band and pull back
            if (d.feint && d.prox >= d.feintTurn) d.receding = true;
            // warning ping when a drifter first commits into the warning band
            if (!f.warnPinged && d.prox >= WARN) {
              f.warnPinged = true;
              ctx.audio.tone(300, 0.14, { type: "sine", vol: 0.05, glide: 360 });
            }
            if (d.prox >= 1) {
              if (f.sealed) { d.receding = true; }
              else { breach(i); return; }
            }
          }
          if (!f.sealed && d.prox > maxProx) maxProx = d.prox;
        }

        ambient(dt);
        dangerCue(dt, maxProx);

        noiseTimer -= dt;
        if (noiseTimer <= 0) { regenNoise(); noiseTimer = reduced ? 700 : 95; }
      }

      // ---- drawing ----
      function pathRR(x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        g.beginPath();
        g.moveTo(x + r, y);
        g.arcTo(x + w, y, x + w, y + h, r);
        g.arcTo(x + w, y + h, x, y + h, r);
        g.arcTo(x, y + h, x, y, r);
        g.arcTo(x, y, x + w, y, r);
        g.closePath();
      }

      function drawFeed(i) {
        const f = feeds[i], r = L.feeds[i];
        const x = r.x, y = r.y, w = r.w, h = r.h;
        const d = f.drifter;
        const prox = d && !d.receding ? d.prox : (d ? d.prox : 0);
        const inWarn = d && d.prox >= WARN && !f.sealed;
        const inDanger = d && d.prox >= DANGER && !f.sealed;

        g.save();
        pathRR(x, y, w, h, 10);
        g.clip();

        // base panel
        const bg = g.createLinearGradient(x, y, x, y + h);
        bg.addColorStop(0, "rgba(10,20,24,0.96)");
        bg.addColorStop(1, "rgba(6,12,16,0.98)");
        g.fillStyle = bg;
        g.fillRect(x, y, w, h);

        // static noise
        for (let k = 0; k < f.noise.length; k++) {
          const p = f.noise[k];
          g.fillStyle = cyan(p.a);
          g.fillRect(x + p.x * w, y + p.y * h, p.s, p.s);
        }

        // scanlines
        g.fillStyle = "rgba(0,0,0,0.16)";
        for (let sy = y; sy < y + h; sy += 3) g.fillRect(x, sy, w, 1);

        // drifter glow
        if (d && d.prox > 0.001) {
          const dx = x + w * (0.5 + d.jx);
          const dy = y + h * (0.14 + d.prox * 0.72);
          const rad = w * (0.10 + d.prox * 0.24);
          // color shifts cyan -> accent as it commits
          const mix = Math.max(0, Math.min(1, (d.prox - WARN) / (1 - WARN)));
          const cr = Math.round(95 + (AR - 95) * mix);
          const cg = Math.round(208 + (AG - 208) * mix);
          const cb = Math.round(200 + (AB - 200) * mix);
          const pulse = reduced ? 1 : 0.85 + Math.sin(elapsed * 0.006) * 0.15;
          const grad = g.createRadialGradient(dx, dy, rad * 0.1, dx, dy, rad);
          grad.addColorStop(0, "rgba(" + cr + "," + cg + "," + cb + "," + (0.55 * pulse) + ")");
          grad.addColorStop(0.45, "rgba(" + cr + "," + cg + "," + cb + "," + (0.22 * pulse) + ")");
          grad.addColorStop(1, "rgba(" + cr + "," + cg + "," + cb + ",0)");
          g.fillStyle = grad;
          g.beginPath();
          g.arc(dx, dy, rad, 0, Math.PI * 2);
          g.fill();
          // darker silhouette core
          g.fillStyle = "rgba(4,8,10," + (0.35 + d.prox * 0.3) + ")";
          g.beginPath();
          g.arc(dx, dy, rad * 0.34, 0, Math.PI * 2);
          g.fill();
        }

        // vignette per feed
        const vg = g.createRadialGradient(x + w / 2, y + h / 2, w * 0.2, x + w / 2, y + h / 2, w * 0.75);
        vg.addColorStop(0, "rgba(0,0,0,0)");
        vg.addColorStop(1, "rgba(0,0,0,0.5)");
        g.fillStyle = vg;
        g.fillRect(x, y, w, h);

        // seal shutter overlay
        if (f.sealed) {
          g.fillStyle = acc(0.14);
          g.fillRect(x, y, w, h);
          g.strokeStyle = acc(0.5);
          g.lineWidth = 2;
          for (let by = y + h * 0.12; by < y + h * 0.9; by += h * 0.11) {
            g.beginPath(); g.moveTo(x + w * 0.08, by); g.lineTo(x + w * 0.92, by); g.stroke();
          }
          g.fillStyle = acc(0.9);
          g.font = "700 " + Math.round(w * 0.10) + "px system-ui, sans-serif";
          g.textAlign = "center"; g.textBaseline = "middle";
          g.fillText("SEALED", x + w / 2, y + h / 2);
          // seal timer bar
          const frac = f.sealTimer / SEAL_MS;
          g.fillStyle = acc(0.6);
          g.fillRect(x + w * 0.1, y + h * 0.86, (w * 0.8) * frac, 3);
        }

        g.restore();

        // border (accent when warning/danger, cyan otherwise)
        const bcol = inDanger ? acc(0.9) : inWarn ? acc(0.6) : cyan(0.35);
        g.save();
        if (inWarn) { g.shadowColor = acc(inDanger ? 0.8 : 0.45); g.shadowBlur = inDanger ? 26 : 14; }
        g.strokeStyle = bcol;
        g.lineWidth = inWarn ? 2.5 : 1.5;
        pathRR(x + 1, y + 1, w - 2, h - 2, 10);
        g.stroke();
        g.restore();

        // cam label
        g.fillStyle = inWarn ? acc(0.95) : cyan(0.7);
        g.font = "600 " + Math.round(w * 0.06) + "px system-ui, sans-serif";
        g.textAlign = "left"; g.textBaseline = "top";
        g.fillText("CAM " + ("0" + (i + 1)).slice(-2), x + w * 0.06, y + h * 0.05);

        // warning marker
        if (inDanger) {
          g.fillStyle = acc(0.6 + Math.sin(elapsed * 0.012) * 0.35);
          g.textAlign = "right";
          g.fillText("!", x + w * 0.94, y + h * 0.05);
        }

        // seal tab hint at bottom
        g.textAlign = "center"; g.textBaseline = "alphabetic";
        g.font = "600 " + Math.round(w * 0.05) + "px system-ui, sans-serif";
        g.fillStyle = f.sealed ? acc(0.0) : (inWarn ? acc(0.8) : cyan(0.32));
        if (!f.sealed) g.fillText("CLICK TO SEAL", x + w / 2, y + h - h * 0.05);
      }

      function drawPower() {
        const p = L.power;
        const frac = power / POWER_MAX;
        const low = power < SEAL_COST;
        g.save();
        // track
        pathRR(p.x, p.y, p.w, p.h, 8);
        g.fillStyle = "rgba(8,16,20,0.9)";
        g.fill();
        g.strokeStyle = cyan(0.22);
        g.lineWidth = 1.5;
        g.stroke();
        // fill
        const fillW = (p.w - 6) * frac;
        if (fillW > 1) {
          g.save();
          pathRR(p.x + 3, p.y + 3, p.w - 6, p.h - 6, 6);
          g.clip();
          const col = low ? acc(0.85) : cyan(0.8);
          g.shadowColor = low ? acc(0.6) : cyan(0.5);
          g.shadowBlur = 16;
          g.fillStyle = col;
          g.fillRect(p.x + 3, p.y + 3, fillW, p.h - 6);
          g.restore();
        }
        // label
        g.fillStyle = low ? acc(0.95) : cyan(0.85);
        g.font = "700 " + Math.round(p.h * 0.42) + "px system-ui, sans-serif";
        g.textAlign = "left"; g.textBaseline = "middle";
        g.fillText("POWER", p.x + p.w * 0.02, p.y + p.h / 2);
        g.textAlign = "right";
        g.fillText(Math.round(power) + "%", p.x + p.w * 0.98, p.y + p.h / 2);
        g.restore();
      }

      function draw() {
        g.clearRect(0, 0, cssS, cssS);
        // backdrop
        g.fillStyle = "rgba(6,10,14,0.55)";
        g.fillRect(0, 0, cssS, cssS);
        for (let i = 0; i < 4; i++) drawFeed(i);
        drawPower();
        // global scanline sweep (subtle)
        if (!reduced) {
          const sweepY = ((elapsed * 0.05) % cssS);
          const sg = g.createLinearGradient(0, sweepY - 30, 0, sweepY + 30);
          sg.addColorStop(0, "rgba(95,208,200,0)");
          sg.addColorStop(0.5, "rgba(95,208,200,0.05)");
          sg.addColorStop(1, "rgba(95,208,200,0)");
          g.fillStyle = sg;
          g.fillRect(0, sweepY - 30, cssS, 60);
        }
        // overall vignette
        const vg = g.createRadialGradient(cssS / 2, cssS / 2, cssS * 0.35, cssS / 2, cssS / 2, cssS * 0.72);
        vg.addColorStop(0, "rgba(0,0,0,0)");
        vg.addColorStop(1, "rgba(0,0,0,0.35)");
        g.fillStyle = vg;
        g.fillRect(0, 0, cssS, cssS);
      }

      function feedAt(x, y) {
        for (let i = 0; i < 4; i++) {
          const r = L.feeds[i];
          if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
        }
        return -1;
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
          canvas.style.background = "rgba(6,10,14,0.85)";
          canvas.style.boxShadow = "0 0 46px rgba(224,112,95,0.10)";
          canvas.style.cursor = "pointer";
          g = canvas.getContext("2d");
          wrap.appendChild(canvas);

          const hint = document.createElement("div");
          hint.className = "hint";
          hint.textContent = "Click a feed to seal its door before a drifter reaches you · don't waste power";
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
          if (over) return;
          if (intent.type === "point" && intent.phase === "down" && intent.button === 0) {
            const i = feedAt(intent.x, intent.y);
            if (i >= 0) trySeal(i);
          }
        },

        tick(dt) {
          update(dt);
          draw();
        },

        teardown() {
          if (unResize) unResize();
          unResize = null;
          stageEl = ctx = canvas = g = null;
          feeds = null; L = null;
        }
      };
    }
  });
})();
