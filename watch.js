/* Watch — a calm-neon anomaly-spotting game. You monitor a wall of security
   camera feeds of quiet neon rooms and learn each room's normal baseline.
   Periodically ONE feed goes wrong — an object moves, vanishes, appears,
   changes color or size, mirrors itself, or a figure turns to face the lens
   ("it's watching"). Click a feed to REPORT the anomaly: right catch clears it
   and it re-arranges; a false report costs a life. Let an anomaly linger past
   its window and it breaches you. No jumpscares/gore — tension is the watching,
   the ticking SIGNAL bar, and the fear of clicking wrong. Endless, escalating:
   more feeds, faster and subtler anomalies, eventually two wrong at once. */
(function () {
  Arcade.register({
    id: "watch",
    name: "*Watch*",
    tagline: "Learn the rooms. Spot what changed. Report it before it breaches.",
    accent: "#7fb0e0",
    complexity: "high",
    controls: "mouse",
    scoreLabel: "Cleared",
    create() {
      let stageEl, ctx, canvas, g, unResize = null;
      let cssS = 0, dpr = 1, reduced = false;

      // accent (surveillance blue) + a warm alert amber for the danger bar
      let AR = 127, AG = 176, AB = 224;
      const WARN = "230,150,86";

      function acc(a) { return "rgba(" + AR + "," + AG + "," + AB + "," + a + ")"; }
      function amb(a) { return "rgba(" + WARN + "," + a + ")"; }
      function hsl(h, a, l) { return "hsla(" + h + ",68%," + (l == null ? 62 : l) + "%," + a + ")"; }
      function hexToRgb(hex) {
        const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
        if (!m) return null;
        const n = parseInt(m[1], 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      }

      // ---- state ----
      let phase;                 // "intro" | "play"
      let feeds = [];            // camera feeds
      let cols = 2, rows = 2;
      let cleared, round, lives, over;
      let anim, spawnT, ambientT, alertT, noiseT;
      let hover = -1;            // hovered feed index
      let flash;                 // {i, t, ok} feedback pulse on a reported feed
      let toast;                 // {text, t} transient banner (round up / miss)
      let noise = [];
      let L = null;

      const BASE_HUE = 207;      // baseline neon-blue object hue
      const LIVES = 3;

      // ---- difficulty (scales forever) ----
      function gridFor(r) {
        if (r <= 2) return [2, 2];
        if (r <= 4) return [3, 2];
        return [3, 3];
      }
      function objCount(r) { return Math.min(6, 4 + Math.floor((r - 1) / 3)); }
      // gap before the next anomaly arms — shrinks with round
      function spawnDelay(r) { return Math.max(2400, 6000 - r * 340) + Math.random() * (r < 5 ? 2600 : 1500); }
      // how long an anomaly may linger before it breaches (ms)
      function reportWindow(r) { return Math.max(6000, 15000 - r * 1150); }
      // how subtle changes are (1 = obvious, ->0.35 = tiny)
      function magnitude(r) { return Math.max(0.35, 1 - (r - 1) * 0.085); }
      // how many anomalies may be live at once
      function maxConcurrent(r) { return r >= 8 ? 3 : r >= 5 ? 2 : 1; }
      function roundFor(c) { return 1 + Math.floor(c / 4); }

      // ---- layout ----
      function resize() {
        const size = Arcade.board.stageSize(900);
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
        L = {
          hud: { x: S * 0.03, y: S * 0.02, w: S * 0.94, h: S * 0.085 },
          grid: { x: S * 0.03, y: S * 0.13, w: S * 0.94, h: S * 0.845 }
        };
      }
      // rect for feed index i in the current cols x rows grid
      function feedRect(i) {
        const gr = L.grid, gap = cssS * 0.016;
        const fw = (gr.w - gap * (cols - 1)) / cols;
        const fh = (gr.h - gap * (rows - 1)) / rows;
        const c = i % cols, r = Math.floor(i / cols);
        return { x: gr.x + c * (fw + gap), y: gr.y + r * (fh + gap), w: fw, h: fh };
      }

      // ---- room / object generation ----
      const WALL_TYPES = { frame: 1, clock: 1 };
      const ASYM = { plant: 1, chair: 1, clock: 1, box: 1, lamp: 1 };
      const POOL = ["plant", "lamp", "chair", "frame", "door", "box", "clock", "figure"];

      function shuffle(a) {
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
      }

      function makeObj(type, slotX) {
        const wall = WALL_TYPES[type];
        return {
          type: type,
          nx: slotX + (Math.random() - 0.5) * 0.06,
          ny: wall ? 0.24 + Math.random() * 0.12 : 0.56 + Math.random() * 0.24,
          scale: 0.85 + Math.random() * 0.3,
          hue: BASE_HUE + (Math.random() - 0.5) * 10,
          flip: Math.random() < 0.5,
          facing: false,        // figures only
          hidden: false
        };
      }

      function generateRoom(r) {
        const n = objCount(r);
        let types = shuffle(POOL.slice());
        // bias toward including a figure so the "watching" anomaly stays possible
        if (types.indexOf("figure") >= n && Math.random() < 0.6) {
          types[Math.floor(Math.random() * n)] = "figure";
        }
        types = types.slice(0, n);
        const slots = shuffle([0.17, 0.37, 0.5, 0.63, 0.83, 0.28]).slice(0, n);
        const objs = [];
        for (let i = 0; i < n; i++) objs.push(makeObj(types[i], slots[i]));
        return objs;
      }

      function newFeed(i, r) {
        return { objs: generateRoom(r), anom: null, born: anim };
      }

      // ---- anomalies ----
      // pick + apply an anomaly to a feed (mutates feed.objs), returns type
      function armAnomaly(feed, r, obvious) {
        const m = obvious ? 1 : magnitude(r);
        const vis = feed.objs.filter(function (o) { return !o.hidden; });
        const figs = vis.filter(function (o) { return o.type === "figure" && !o.facing; });
        const asym = vis.filter(function (o) { return ASYM[o.type]; });

        // candidate anomaly types given what's in the room
        const kinds = ["move", "disappear", "appear", "recolor", "resize"];
        if (figs.length) kinds.push("watch");
        if (asym.length) kinds.push("flip");
        // early game leans on the obvious three
        const kind = obvious
          ? ["appear", "disappear", "move"][Math.floor(Math.random() * 3)]
          : kinds[Math.floor(Math.random() * kinds.length)];

        const pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };

        if (kind === "move") {
          const o = pick(vis);
          const d = 0.10 + m * 0.16, a = Math.random() * Math.PI * 2;
          o.nx = Math.max(0.12, Math.min(0.88, o.nx + Math.cos(a) * d));
          if (!WALL_TYPES[o.type]) o.ny = Math.max(0.5, Math.min(0.84, o.ny + Math.sin(a) * d * 0.6));
        } else if (kind === "disappear") {
          pick(vis).hidden = true;
        } else if (kind === "appear") {
          const t = pick(POOL);
          const o = makeObj(t, 0.14 + Math.random() * 0.72);
          feed.objs.push(o);
        } else if (kind === "recolor") {
          const o = pick(vis);
          const shift = pick([130, -120, 92, -80]) * (0.6 + 0.4 * m);
          o.hue = BASE_HUE + shift;
        } else if (kind === "resize") {
          const o = pick(vis);
          const f = Math.random() < 0.5 ? (1 + (0.35 + m * 0.4)) : (1 - (0.28 + m * 0.28));
          o.scale = Math.max(0.4, o.scale * f);
        } else if (kind === "flip") {
          pick(asym).flip = !pick(asym).flip;
        } else if (kind === "watch") {
          pick(figs).facing = true;
        }
        feed.anom = { kind: kind, window: reportWindow(r), timer: reportWindow(r) };
        return kind;
      }

      function activeAnomalies() {
        let n = 0;
        for (let i = 0; i < feeds.length; i++) if (feeds[i].anom) n++;
        return n;
      }
      // most-urgent alert level across live anomalies (0 calm .. 1 breach)
      function alertLevel() {
        let a = 0;
        for (let i = 0; i < feeds.length; i++) {
          const an = feeds[i].anom;
          if (an) a = Math.max(a, 1 - an.timer / an.window);
        }
        return a;
      }

      // ---- lifecycle actions ----
      function reset() {
        cleared = 0; round = 1; lives = LIVES; over = false;
        anim = 0; hover = -1; flash = null; toast = null;
        phase = "intro";
        applyGrid(1);
        regenNoise();
        ctx.setScore(0);
      }
      function applyGrid(r) {
        const gr = gridFor(r);
        cols = gr[0]; rows = gr[1];
        feeds = [];
        for (let i = 0; i < cols * rows; i++) feeds.push(newFeed(i, r));
      }
      function beginPlay() {
        if (phase !== "intro") return;
        phase = "play";
        spawnT = 2600;            // grace period to study the rooms
        ambientT = 0; alertT = 0; noiseT = 0;
        ctx.audio.tone(300, 0.22, { type: "sine", vol: 0.07, glide: 210 });
      }

      function report(i) {
        const feed = feeds[i];
        if (!feed) return;
        if (feed.anom) {
          // correct catch
          cleared++;
          ctx.setScore(cleared);
          feed.objs = generateRoom(round);
          feed.anom = null;
          feed.born = anim;
          flash = { i: i, t: 460, ok: true };
          ctx.audio.chord([523, 784], 0.16, { type: "sine", vol: 0.18, spread: 0.05 });
          ctx.audio.tone(1046, 0.1, { type: "sine", vol: 0.08, when: 0.11 });
          const nr = roundFor(cleared);
          if (nr > round) roundUp(nr);
        } else {
          // false report
          lives--;
          flash = { i: i, t: 460, ok: false };
          ctx.audio.tone(150, 0.28, { type: "triangle", vol: 0.13, glide: 96 });
          if (lives <= 0) { gameOver("falses"); return; }
          toast = { text: "FALSE REPORT · " + lives + " left", t: 1500 };
        }
      }

      function roundUp(nr) {
        round = nr;
        const gr = gridFor(round), grew = gr[0] * gr[1] !== feeds.length;
        if (grew) {
          applyGrid(round);       // more cams come online — fresh study moment
          toast = { text: "CAMS ONLINE · " + (gr[0] * gr[1]) + " FEEDS", t: 1800 };
          spawnT = Math.max(spawnT, 2400);
        } else {
          toast = { text: "SECTOR " + round, t: 1400 };
        }
        ctx.audio.arp([440, 587, 740], { dur: 0.14, step: 0.06, vol: 0.12, type: "sine" });
      }

      function gameOver(kind, camN) {
        if (over) return;
        over = true;
        ctx.audio.lose();
        const msg = kind === "falses"
          ? "Too many false reports — the watch lost your trust."
          : "CAM " + (camN + 1) + " breached — an anomaly went unreported.";
        ctx.onGameOver(cleared, {
          title: kind === "falses" ? "Trust broken." : "Breach on CAM " + (camN + 1) + ".",
          msg: msg + " You cleared " + cleared + "."
        });
      }

      // ---- audio texture ----
      function ambient(dt) {
        ambientT -= dt;
        if (ambientT <= 0) { ambientT = 3000; ctx.audio.tone(58, 0.7, { type: "sine", vol: 0.03 }); }
      }
      function alertCue(dt, lvl) {
        alertT -= dt;
        if (lvl >= 0.55 && alertT <= 0) {
          ctx.audio.tone(200 + (lvl - 0.55) * 520, 0.14, { type: "sine", vol: 0.05 });
          alertT = lvl >= 0.82 ? 460 : 900;
        }
      }
      function regenNoise() {
        const n = reduced ? 26 : 60;
        noise = [];
        for (let k = 0; k < n; k++)
          noise.push({ x: Math.random(), y: Math.random(), a: 0.03 + Math.random() * 0.08, s: 1 + Math.random() * 1.6 });
      }

      // ---- update ----
      function update(dt) {
        anim += dt;
        if (flash) { flash.t -= dt; if (flash.t <= 0) flash = null; }
        if (toast) { toast.t -= dt; if (toast.t <= 0) toast = null; }
        if (phase !== "play" || over) return;

        // arm new anomalies
        spawnT -= dt;
        if (spawnT <= 0) {
          if (activeAnomalies() < maxConcurrent(round)) {
            const calm = [];
            for (let i = 0; i < feeds.length; i++) if (!feeds[i].anom) calm.push(i);
            if (calm.length) {
              const i = calm[Math.floor(Math.random() * calm.length)];
              armAnomaly(feeds[i], round, cleared === 0);
            }
          }
          spawnT = spawnDelay(round);
        }

        // tick anomaly timers → breach when one runs out
        for (let i = 0; i < feeds.length; i++) {
          const an = feeds[i].anom;
          if (an) {
            an.timer -= dt;
            if (an.timer <= 0) { gameOver("breach", i); return; }
          }
        }

        const lvl = alertLevel();
        ambient(dt);
        alertCue(dt, lvl);
        noiseT -= dt;
        if (noiseT <= 0) { regenNoise(); noiseT = reduced ? 560 : 130; }
      }

      // ---- drawing helpers ----
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
      function drawStatic(fr, aScale, seed) {
        for (let k = 0; k < noise.length; k++) {
          const p = noise[k];
          const px = ((p.x + seed * 0.13) % 1), py = ((p.y + seed * 0.29) % 1);
          g.fillStyle = acc(p.a * aScale);
          g.fillRect(fr.x + px * fr.w, fr.y + py * fr.h, p.s, p.s);
        }
      }
      function drawScanlines(fr, step, a) {
        g.fillStyle = "rgba(0,0,0," + a + ")";
        for (let sy = fr.y; sy < fr.y + fr.h; sy += step) g.fillRect(fr.x, sy, fr.w, 1);
      }

      // ---- object renderers (neon line-art) ----
      function objColor(o, a) { return hsl(o.hue, a); }
      function drawObject(fr, o) {
        if (o.hidden) return;
        const cx = fr.x + o.nx * fr.w;
        const cy = fr.y + o.ny * fr.h;
        const size = fr.w * 0.15 * o.scale;
        g.save();
        g.translate(cx, cy);
        if (o.flip) g.scale(-1, 1);
        g.lineJoin = "round"; g.lineCap = "round";
        g.strokeStyle = objColor(o, 0.82);
        g.fillStyle = objColor(o, 0.16);
        g.shadowColor = objColor(o, 0.5);
        g.shadowBlur = reduced ? 4 : size * 0.5;
        g.lineWidth = Math.max(1.4, size * 0.07);
        const s = size;
        switch (o.type) {
          case "plant": {
            g.beginPath(); g.moveTo(-s * 0.34, s * 0.2); g.lineTo(-s * 0.24, s * 0.7);
            g.lineTo(s * 0.24, s * 0.7); g.lineTo(s * 0.34, s * 0.2); g.closePath();
            g.fill(); g.stroke();
            for (let i = -2; i <= 2; i++) {
              g.beginPath(); g.moveTo(0, s * 0.2);
              g.quadraticCurveTo(i * s * 0.28, -s * 0.3, i * s * 0.36, -s * 0.72); g.stroke();
            }
            break;
          }
          case "lamp": {
            g.beginPath(); g.moveTo(0, s * 0.72); g.lineTo(0, -s * 0.3); g.stroke();
            g.beginPath(); g.moveTo(-s * 0.3, s * 0.72); g.lineTo(s * 0.3, s * 0.72); g.stroke();
            g.beginPath(); g.moveTo(-s * 0.42, -s * 0.72); g.lineTo(s * 0.42, -s * 0.72);
            g.lineTo(s * 0.26, -s * 0.3); g.lineTo(-s * 0.26, -s * 0.3); g.closePath();
            g.fill(); g.stroke();
            g.save(); g.shadowBlur = reduced ? 6 : s * 1.1; g.fillStyle = objColor(o, 0.22);
            g.beginPath(); g.arc(0, -s * 0.5, s * 0.5, 0, Math.PI * 2); g.fill(); g.restore();
            break;
          }
          case "chair": {
            g.beginPath(); g.moveTo(-s * 0.4, -s * 0.1); g.lineTo(s * 0.4, -s * 0.1); g.stroke();
            g.beginPath(); g.moveTo(s * 0.4, -s * 0.1); g.lineTo(s * 0.4, -s * 0.75); g.stroke();
            g.beginPath(); g.moveTo(-s * 0.36, -s * 0.1); g.lineTo(-s * 0.36, s * 0.7); g.stroke();
            g.beginPath(); g.moveTo(s * 0.36, -s * 0.1); g.lineTo(s * 0.36, s * 0.7); g.stroke();
            break;
          }
          case "frame": {
            pathRR(-s * 0.5, -s * 0.55, s, s * 1.05, s * 0.06); g.fill(); g.stroke();
            g.beginPath(); g.moveTo(-s * 0.3, s * 0.2); g.lineTo(-s * 0.05, -s * 0.15);
            g.lineTo(s * 0.12, s * 0.1); g.lineTo(s * 0.32, -s * 0.25); g.stroke();
            break;
          }
          case "door": {
            pathRR(-s * 0.45, -s * 0.95, s * 0.9, s * 1.7, s * 0.05); g.fill(); g.stroke();
            g.beginPath(); g.arc(s * 0.26, -s * 0.05, s * 0.08, 0, Math.PI * 2); g.fill();
            break;
          }
          case "box": {
            g.beginPath(); g.moveTo(-s * 0.42, -s * 0.2); g.lineTo(-s * 0.42, s * 0.55);
            g.lineTo(s * 0.42, s * 0.55); g.lineTo(s * 0.42, -s * 0.2); g.closePath(); g.fill(); g.stroke();
            g.beginPath(); g.moveTo(-s * 0.42, -s * 0.2); g.lineTo(-s * 0.22, -s * 0.5);
            g.lineTo(s * 0.62, -s * 0.5); g.lineTo(s * 0.42, -s * 0.2); g.closePath(); g.stroke();
            break;
          }
          case "clock": {
            g.beginPath(); g.arc(0, 0, s * 0.5, 0, Math.PI * 2); g.fill(); g.stroke();
            g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -s * 0.34); g.stroke();
            g.beginPath(); g.moveTo(0, 0); g.lineTo(s * 0.26, s * 0.1); g.stroke();
            break;
          }
          case "figure": {
            g.beginPath(); g.moveTo(-s * 0.3, s * 0.75); g.lineTo(-s * 0.22, -s * 0.2);
            g.lineTo(s * 0.22, -s * 0.2); g.lineTo(s * 0.3, s * 0.75); g.closePath(); g.fill(); g.stroke();
            g.beginPath(); g.arc(0, -s * 0.5, s * 0.3, 0, Math.PI * 2); g.fill(); g.stroke();
            if (o.facing) {
              // it turned toward the lens — a pair of soft glowing eyes
              g.save();
              g.shadowColor = amb(0.7); g.shadowBlur = reduced ? 6 : s * 0.9;
              g.fillStyle = amb(0.92);
              g.beginPath(); g.arc(-s * 0.11, -s * 0.5, s * 0.07, 0, Math.PI * 2); g.fill();
              g.beginPath(); g.arc(s * 0.11, -s * 0.5, s * 0.07, 0, Math.PI * 2); g.fill();
              g.restore();
            }
            break;
          }
        }
        g.restore();
      }

      // ---- a single camera feed ----
      function drawFeed(i) {
        const fr = feedRect(i), feed = feeds[i];
        const hovered = i === hover && phase === "play" && !over;
        g.save();
        pathRR(fr.x, fr.y, fr.w, fr.h, 10); g.clip();

        // room: back wall + floor with soft perspective
        const bg = g.createLinearGradient(fr.x, fr.y, fr.x, fr.y + fr.h);
        bg.addColorStop(0, "rgba(9,15,22,1)");
        bg.addColorStop(0.52, "rgba(11,19,27,1)");
        bg.addColorStop(1, "rgba(6,10,15,1)");
        g.fillStyle = bg; g.fillRect(fr.x, fr.y, fr.w, fr.h);

        const hy = fr.y + fr.h * 0.5;          // horizon
        g.strokeStyle = acc(0.10); g.lineWidth = 1;
        g.beginPath(); g.moveTo(fr.x, hy); g.lineTo(fr.x + fr.w, hy); g.stroke();
        for (let k = 1; k < 6; k++) {           // floorboards receding
          const t = k / 6, ly = hy + (fr.h * 0.5) * t * t;
          g.strokeStyle = acc(0.05 + 0.05 * (1 - t));
          g.beginPath(); g.moveTo(fr.x, ly); g.lineTo(fr.x + fr.w, ly); g.stroke();
        }
        const midX = fr.x + fr.w / 2;
        for (let k = -2; k <= 2; k++) {
          g.strokeStyle = acc(0.05);
          g.beginPath(); g.moveTo(midX + k * fr.w * 0.14, hy);
          g.lineTo(midX + k * fr.w * 0.5, fr.y + fr.h); g.stroke();
        }

        // objects
        for (let k = 0; k < feed.objs.length; k++) drawObject(fr, feed.objs[k]);

        // cam texture
        drawStatic(fr, feed.anom && !reduced ? 1.5 : 1, i + 1);
        drawScanlines(fr, 3, 0.18);
        if (!reduced) {
          const sweepY = fr.y + ((anim * 0.05 + i * 90) % fr.h);
          const sg = g.createLinearGradient(0, sweepY - 20, 0, sweepY + 20);
          sg.addColorStop(0, acc(0)); sg.addColorStop(0.5, acc(0.05)); sg.addColorStop(1, acc(0));
          g.fillStyle = sg; g.fillRect(fr.x, sweepY - 20, fr.w, 40);
        }
        // vignette
        const vg = g.createRadialGradient(midX, fr.y + fr.h * 0.5, fr.w * 0.2, midX, fr.y + fr.h * 0.5, fr.w * 0.62);
        vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.5)");
        g.fillStyle = vg; g.fillRect(fr.x, fr.y, fr.w, fr.h);

        // hover REPORT affordance
        if (hovered) {
          g.fillStyle = acc(0.06); g.fillRect(fr.x, fr.y, fr.w, fr.h);
          const bw = fr.w * 0.44, bh = fr.h * 0.15, bx = midX - bw / 2, by = fr.y + fr.h - bh - fr.h * 0.07;
          g.save();
          pathRR(bx, by, bw, bh, bh * 0.3);
          g.fillStyle = amb(0.16); g.fill();
          g.shadowColor = amb(0.5); g.shadowBlur = 14;
          g.strokeStyle = amb(0.85); g.lineWidth = 2; g.stroke();
          g.restore();
          g.fillStyle = amb(0.95);
          g.font = "800 " + Math.round(bh * 0.42) + "px system-ui, sans-serif";
          g.textAlign = "center"; g.textBaseline = "middle";
          g.fillText("REPORT", midX, by + bh / 2);
        }

        // report-feedback flash
        if (flash && flash.i === i) {
          const a = (flash.t / 460) * 0.5;
          g.fillStyle = flash.ok ? "rgba(120,230,150," + a + ")" : amb(a);
          g.fillRect(fr.x, fr.y, fr.w, fr.h);
        }
        g.restore();

        // frame
        g.save();
        if (hovered) { g.shadowColor = amb(0.6); g.shadowBlur = 18; }
        g.strokeStyle = hovered ? amb(0.9) : acc(0.34); g.lineWidth = hovered ? 2.5 : 1.4;
        pathRR(fr.x + 1, fr.y + 1, fr.w - 2, fr.h - 2, 10); g.stroke();
        g.restore();

        // label + live REC dot
        g.fillStyle = acc(0.75);
        g.font = "700 " + Math.round(fr.w * 0.06) + "px system-ui, sans-serif";
        g.textAlign = "left"; g.textBaseline = "top";
        g.fillText("CAM " + (i + 1), fr.x + fr.w * 0.05, fr.y + fr.h * 0.05);
        const blink = reduced ? 0.8 : 0.4 + Math.abs(Math.sin(anim * 0.005)) * 0.5;
        g.fillStyle = "rgba(224,90,80," + blink + ")";
        g.beginPath(); g.arc(fr.x + fr.w * 0.92, fr.y + fr.h * 0.08, fr.w * 0.014, 0, Math.PI * 2); g.fill();
      }

      // ---- HUD ----
      function drawHud() {
        const h = L.hud, S = cssS;
        const lvl = alertLevel();
        // lives (pips) + counters, left
        g.textAlign = "left"; g.textBaseline = "middle";
        g.fillStyle = acc(0.9);
        g.font = "800 " + Math.round(h.h * 0.4) + "px system-ui, sans-serif";
        g.fillText("CLEARED " + cleared, h.x, h.y + h.h * 0.32);
        g.fillStyle = acc(0.55);
        g.font = "600 " + Math.round(h.h * 0.26) + "px system-ui, sans-serif";
        g.fillText("SECTOR " + round + " · " + (cols * rows) + " FEEDS", h.x, h.y + h.h * 0.75);

        // lives pips, right
        const pr = h.h * 0.13;
        for (let i = 0; i < LIVES; i++) {
          const px = h.x + h.w - pr * 2 - i * pr * 3.2, py = h.y + h.h * 0.3;
          g.beginPath(); g.arc(px, py, pr, 0, Math.PI * 2);
          if (i < lives) { g.fillStyle = acc(0.85); g.shadowColor = acc(0.5); g.shadowBlur = 8; g.fill(); g.shadowBlur = 0; }
          else { g.strokeStyle = acc(0.3); g.lineWidth = 1.5; g.stroke(); }
        }

        // SIGNAL bar — the danger timer: fills warm & pulses as the most-urgent
        // anomaly's window runs out (tells you SOMETHING's wrong, not which cam)
        const bx = h.x, by = h.y + h.h * 0.92, bw = h.w, bh = S * 0.016;
        g.fillStyle = "rgba(8,14,20,0.9)"; pathRR(bx, by, bw, bh, bh / 2); g.fill();
        g.strokeStyle = acc(0.18); g.lineWidth = 1; g.stroke();
        if (lvl > 0.001) {
          g.save(); pathRR(bx + 1, by + 1, bw - 2, bh - 2, bh / 2); g.clip();
          const pulse = lvl > 0.6 && !reduced ? 0.7 + Math.abs(Math.sin(anim * 0.01)) * 0.3 : 1;
          g.fillStyle = lvl > 0.55 ? amb(0.85 * pulse) : acc(0.7);
          g.shadowColor = lvl > 0.55 ? amb(0.6) : acc(0.5); g.shadowBlur = 12;
          g.fillRect(bx + 1, by + 1, (bw - 2) * lvl, bh - 2);
          g.restore();
        }
        g.fillStyle = lvl > 0.55 ? amb(0.9) : acc(0.4);
        g.font = "700 " + Math.round(bh * 0.9) + "px system-ui, sans-serif";
        g.textAlign = "right"; g.textBaseline = "bottom";
        g.fillText(lvl > 0.55 ? "SIGNAL LOST — REPORT NOW" : "SIGNAL", bx + bw, by - 2);
      }

      function drawToast() {
        if (!toast) return;
        const S = cssS, a = Math.min(1, toast.t / 400);
        g.fillStyle = acc(0.9 * a);
        g.font = "800 " + Math.round(S * 0.032) + "px system-ui, sans-serif";
        g.textAlign = "center"; g.textBaseline = "middle";
        g.save(); g.shadowColor = acc(0.5); g.shadowBlur = 14;
        g.fillText(toast.text, S / 2, S * 0.155);
        g.restore();
      }

      // ---- intro card ----
      function drawIntro() {
        const S = cssS;
        // dim the live feeds behind
        drawGridBg();
        g.fillStyle = "rgba(4,8,12," + (reduced ? 0.9 : 0.84) + ")";
        g.fillRect(0, 0, S, S);
        g.textAlign = "center"; g.textBaseline = "middle";
        g.fillStyle = acc(0.95);
        g.font = "800 " + Math.round(S * 0.072) + "px system-ui, sans-serif";
        g.fillText("WATCH", S / 2, S * 0.24);
        g.fillStyle = acc(0.8);
        g.font = "700 " + Math.round(S * 0.036) + "px system-ui, sans-serif";
        g.fillText("Learn each room. Spot what changed.", S / 2, S * 0.34);
        g.fillStyle = acc(0.62);
        g.font = "500 " + Math.round(S * 0.028) + "px system-ui, sans-serif";
        wrapText("One feed will go wrong: something moves, vanishes, appears, changes color or size, mirrors, or turns to face you. Click that feed to REPORT it.", S / 2, S * 0.44, S * 0.78, S * 0.04);
        g.fillStyle = amb(0.75);
        g.font = "600 " + Math.round(S * 0.026) + "px system-ui, sans-serif";
        wrapText("A wrong report costs a life (3 total). Let an anomaly linger past the SIGNAL bar and it breaches. It only gets faster and subtler.", S / 2, S * 0.6, S * 0.78, S * 0.038);
        g.fillStyle = acc(0.9);
        g.font = "700 " + Math.round(S * 0.03) + "px system-ui, sans-serif";
        const pulse = reduced ? 0.9 : 0.6 + Math.abs(Math.sin(anim * 0.004)) * 0.4;
        g.fillStyle = acc(pulse);
        g.fillText("click to begin the watch", S / 2, S * 0.78);
      }
      function wrapText(text, cx, cy2, maxW, lh) {
        const words = text.split(" ");
        let line = "", y = cy2;
        for (let i = 0; i < words.length; i++) {
          const test = line + words[i] + " ";
          if (g.measureText(test).width > maxW && line) { g.fillText(line.trim(), cx, y); line = words[i] + " "; y += lh; }
          else line = test;
        }
        g.fillText(line.trim(), cx, y);
      }

      function drawGridBg() {
        const S = cssS;
        g.fillStyle = "rgba(5,9,13,1)"; g.fillRect(0, 0, S, S);
        for (let i = 0; i < feeds.length; i++) drawFeed(i);
      }

      function draw() {
        g.clearRect(0, 0, cssS, cssS);
        if (phase === "intro") { drawIntro(); return; }
        g.fillStyle = "rgba(5,9,13,1)"; g.fillRect(0, 0, cssS, cssS);
        for (let i = 0; i < feeds.length; i++) drawFeed(i);
        drawHud();
        drawToast();
      }

      function inRect(r, x, y) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }
      function feedAt(x, y) {
        for (let i = 0; i < feeds.length; i++) if (inRect(feedRect(i), x, y)) return i;
        return -1;
      }

      const self = {
        mount(stage, c) {
          stageEl = stage; ctx = c;
          reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          const rgb = hexToRgb(ctx.accent);
          if (rgb) { AR = rgb[0]; AG = rgb[1]; AB = rgb[2]; }

          const wrap = document.createElement("div");
          wrap.style.display = "flex"; wrap.style.flexDirection = "column"; wrap.style.alignItems = "center";
          canvas = document.createElement("canvas");
          canvas.style.borderRadius = "16px";
          canvas.style.background = "rgba(5,9,13,0.9)";
          canvas.style.boxShadow = "0 0 46px rgba(127,176,224,0.1)";
          canvas.style.cursor = "pointer";
          g = canvas.getContext("2d");
          wrap.appendChild(canvas);
          const hint = document.createElement("div");
          hint.className = "hint";
          hint.textContent = "Watch the feeds, learn the rooms, and click a feed to REPORT when something changes. Wrong reports cost lives; lingering anomalies breach you.";
          wrap.appendChild(hint);
          stage.appendChild(wrap);

          resize();
          reset();
          Arcade.input.setPointerTarget(canvas);
          draw();
          unResize = Arcade.board.onResize(function () { resize(); draw(); });
        },

        handleInput(intent) {
          if (over || intent.type !== "point") return;
          if (intent.phase === "move") {
            hover = phase === "play" ? feedAt(intent.x, intent.y) : -1;
            return;
          }
          if (intent.phase !== "down" || intent.button !== 0) return;
          if (phase === "intro") { beginPlay(); return; }
          const i = feedAt(intent.x, intent.y);
          if (i >= 0) report(i);
        },

        tick(dt) { update(dt); draw(); },

        teardown() {
          if (unResize) unResize();
          unResize = null;
          stageEl = ctx = canvas = g = null;
          feeds = []; noise = []; L = null; flash = toast = null;
        }
      };
      return self;
    }
  });
})();
