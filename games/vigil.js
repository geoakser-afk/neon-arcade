/* Vigil — a calm-neon FNAF-style survive-the-NIGHT run. You hold one office
   through night after night; each is a short shift you must survive to advance,
   and it never stops getting harder. Each night introduces one named monster:
     Night 1 — HUSKS (red) + the CRANK: seal doors vs. the hall Husks while
               winding the center crank to keep power up.
     Night 2 — VENTS: raise the monitor to flush the vent before it overflows.
     Night 3 — the STALKER (red): creeps the vent cam only while you watch it.
     Night 4 — the WISP (green): left hall only; flash the left light repeatedly
               to drive it back — sealing won't stop it.
     Night 5 — the LEECH (purple): latches on your power bar; click it off.
     Night 6+ — everything's live and only gets darker.
   No jumpscares/gore: dread through choices you can't all win at once. */
(function () {
  Arcade.register({
    id: "vigil",
    name: "*Vigil*",
    tagline: "Hold the office through the night. Each one adds a threat.",
    accent: "#c6584f",
    complexity: "high",
    controls: "mouse",
    scoreLabel: "Night",
    create() {
      let stageEl, ctx, canvas, g, unResize = null;
      let cssS = 0, dpr = 1, reduced = false;

      let AR = 198, AG = 88, AB = 79;          // danger red (accent)
      const CY = "120,178,208";                // cold neutral cyan

      // ---- feature unlock schedule (night at which each turns on) ----
      // crank + doors from night 1; each later night introduces one monster.
      const UNLOCK = { crank: 1, vent: 2, stalker: 3, wisp: 4, leech: 5 };
      function has(f) { return night >= UNLOCK[f]; }

      // Each night's intro card: [title, description]. Monsters are named.
      const INTRO = {
        1: ["Husks & the crank", "HUSKS (red) creep the halls to your doors — seal a door before one arrives. If a Husk presses a sealed door, DON'T open (the door glows red 'HELD') until it leaves. Meanwhile POWER drains: wind the CRANK in the middle to keep it up."],
        2: ["The vents", "Raise the monitor to flush the vent before it overflows."],
        3: ["The Stalker", "The STALKER (red) stirs in the vent — it only creeps toward you while you watch the cam, so don't linger on the monitor."],
        4: ["The Wisp", "The WISP (green, barely visible) comes ONLY down the LEFT hall. Sealing won't stop it — flash the LEFT light again and again to drive it back before it reaches you."],
        5: ["The Leech", "The LEECH (purple) latches onto your power bar and drains it fast. Click the leech to knock it off — it'll keep coming back."]
      };

      // ---- state ----
      let night, phase, phaseT;        // phase: "select" | "intro" | "play" | "clear"
      let maxUnlocked = 1;             // highest night reached (persisted)
      let anim;                        // ever-running clock for animations
      let nightTime, nightLen;         // night countdown (survive to nightLen)
      let over, ended;
      let power, blackout, flicker;
      let doors, halls, lights;
      let vent, monitorUp, creep;
      let wisp;                        // green left-hall monster (flash to repel)
      let leech;                       // purple power-drain monster (click to remove)
      let crank;                       // {angle, cd, glow}
      let noise, ambientT, proxT, ventPingT, noiseT, skitterT;
      let L = null;

      const POWER_MAX = 100;
      const WARN = 0.6, DANGER = 0.84;
      const CRANK_GAIN = 1.0, CRANK_CD = 150;   // small charge per wind — keep winding
      // Door siege: a wraith that reaches a SEALED door presses against it. The
      // door locks — you cannot open it. It stays that long, then KNOCKS twice
      // (a distinct per-side signal) and leaves; only then is the door safe to
      // open. Opening while it's still pressing = death. If it reaches an OPEN
      // door it takes you immediately.
      const SIEGE_MS = 3600;                    // how long it presses before leaving
      const KNOCK_LOCK_MS = 700;                // brief lock during the leave-knock

      function acc(a) { return "rgba(" + AR + "," + AG + "," + AB + "," + a + ")"; }
      function cy(a) { return "rgba(" + CY + "," + a + ")"; }
      function grn(a) { return "rgba(90,210,120," + a + ")"; }   // Wisp
      function pur(a) { return "rgba(170,110,235," + a + ")"; }  // Leech
      function hexToRgb(hex) {
        const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
        if (!m) return null;
        const n = parseInt(m[1], 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      }

      // ---- per-night difficulty (scales forever) ----
      function nightLenMs(n) { return Math.min(120000, 30000 + (n - 1) * 9000); }
      // gap before a wraith next appears — short so sieges happen often
      function hallDelay(n) { return Math.max(1200, 3800 - n * 320) + Math.random() * 1800; }
      // travel speed toward the door — a bit faster so the trek isn't slow
      function hallSpeed(n) { return (1 / Math.max(2000, 4200 - n * 260)) * (0.85 + Math.random() * 0.35); }
      function creepRate(n) { return 1 / Math.max(2400, 5200 - n * 240); }     // prox/ms, monitor up
      const creepRetreat = 1 / 7000;
      function ventFill(n) { return Math.min(11, 3 + n * 0.7); }               // %/s
      const ventDrain = 15;                                                    // %/s, monitor up
      function baseDrain(n) { return 1.05 + n * 0.05; }       // %/s idle (crank always on)
      const doorDrain = 1.4, monDrain = 1.7, lightCost = 1.1;
      // Wisp (green, left only): advances toward you; each LEFT flash pushes it
      // back a chunk. Reaches you if it isn't beaten back in time.
      function wispDelay(n) { return Math.max(3000, 10000 - n * 700) + Math.random() * 4000; }
      function wispSpeed(n) { return (1 / Math.max(5000, 9000 - n * 500)); }   // prox/ms
      const WISP_FLASH_PUSH = 0.24;                                           // prox knocked back per flash
      // Leech (purple): latches onto the power bar and drains it fast until you
      // click it off; then it lurks and re-latches after a delay.
      function leechDelay(n) { return Math.max(4000, 11000 - n * 700) + Math.random() * 5000; }
      const LEECH_DRAIN = 6.5;                                                // extra %/s while latched

      function resize() {
        const size = Arcade.board.stageSize(880);
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
          power: { x: S * 0.04, y: S * 0.03, w: S * 0.92, h: S * 0.06 },
          leftDoor: { x: 0, y: S * 0.14, w: S * 0.29, h: S * 0.60 },
          rightDoor: { x: S * 0.71, y: S * 0.14, w: S * 0.29, h: S * 0.60 },
          // crank sits centered in the middle of the office (the empty desk area)
          crank: { x: S * 0.34, y: S * 0.40, w: S * 0.32, h: S * 0.22 },
          monTab: { x: S * 0.30, y: S * 0.82, w: S * 0.40, h: S * 0.12 },
          full: { x: 0, y: 0, w: S, h: S }
        };
      }

      // small light button inside a doorway (only meaningful once unlocked)
      function lightBtn(door) {
        return { x: door.x + door.w * 0.2, y: door.y + door.h - door.h * 0.13,
                 w: door.w * 0.6, h: door.h * 0.1 };
      }

      // the Leech clings to the RIGHT end of the power bar (where it's draining
      // from). A generous square hitbox so it's easy to click off.
      function leechRect() {
        const p = L.power;
        const s = p.h * 1.5;
        return { x: p.x + p.w - s * 0.9, y: p.y + p.h / 2 - s / 2, w: s, h: s };
      }

      // Night-select tiles: show every night up to maxUnlocked (+1 preview locked).
      // Returns [{ n, rect, locked }] laid out in a centered wrapping grid.
      function nightTiles() {
        const S = cssS;
        const count = Math.max(1, maxUnlocked);
        const cols = Math.min(5, count);
        const tw = S * 0.15, th = S * 0.15, gap = S * 0.03;
        const rows = Math.ceil(count / cols);
        const gridW = cols * tw + (cols - 1) * gap;
        const x0 = (S - gridW) / 2, y0 = S * 0.42;
        const tiles = [];
        for (let i = 0; i < count; i++) {
          const r = Math.floor(i / cols), c = i % cols;
          const rowCount = Math.min(cols, count - r * cols);
          const rowW = rowCount * tw + (rowCount - 1) * gap;
          const rx = (S - rowW) / 2;
          tiles.push({
            n: i + 1,
            rect: { x: rx + c * (tw + gap), y: y0 + r * (th + gap), w: tw, h: th },
            locked: false
          });
        }
        return tiles;
      }

      function reset() {
        night = 1; ended = false;
        anim = 0;
        // highest night ever reached (persisted) gates which nights you can jump to
        maxUnlocked = Math.max(1, ctx.storage.get("maxNight", 1));
        phase = "select"; phaseT = 0;
        over = false;
        // draw needs these defined even on the select screen
        power = POWER_MAX; blackout = 0; flicker = 0; monitorUp = false; vent = 6; creep = 0;
        doors = { L: { closed: false }, R: { closed: false } };
        halls = { L: newHall(Infinity), R: newHall(Infinity) };
        lights = { L: { until: -1 }, R: { until: -1 } };
        wisp = newWisp(1); leech = newLeech(1);
        crank = { angle: 0, cd: 0, glow: 0 };
        nightTime = 0; nightLen = nightLenMs(1);
        regenNoise();
        ctx.setScore(1);
      }

      function startNight(n) {
        night = n;
        phase = "intro"; phaseT = 0;
        over = false;
        nightTime = 0; nightLen = nightLenMs(n);
        power = POWER_MAX; blackout = 0; flicker = 0;
        monitorUp = false; vent = 6; creep = 0;
        doors = { L: { closed: false }, R: { closed: false } };
        // Husks (red door monsters) work both halls from night 1. First comes
        // fast (~2-4s) so you meet the siege right away, then they keep coming.
        halls = {
          L: newHall(2600 + Math.random() * 2200),
          R: newHall(2000 + Math.random() * 1600)
        };
        lights = { L: { until: -1 }, R: { until: -1 } };
        wisp = newWisp(n); leech = newLeech(n);
        crank = { angle: 0, cd: 0, glow: 0 };
        ambientT = 0; proxT = 0; ventPingT = 0; noiseT = 0; skitterT = 0;
        regenNoise();
        ctx.setScore(night);
      }

      // siege: 0 = not at door; >0 = pressing against a sealed door (ms elapsed);
      // knocking = playing the leave-knock (door still locked until it ends).
      function newHall(delay) { return { active: false, prox: 0, wait: delay, warned: false, retreating: false, siege: 0, knocking: 0 }; }
      // Wisp: active=creeping down the left hall; prox 0→1 reaches you. Flashing
      // the left light knocks prox back. wait = delay before it next appears.
      function newWisp(n) { return { active: false, prox: 0, wait: wispDelay(n), pinged: false }; }
      // Leech: latched=draining the power bar; when clicked off it lurks then
      // re-latches after wait. present=on screen at all.
      function newLeech(n) { return { latched: false, wait: leechDelay(n) }; }

      function beginPlay() {
        if (phase !== "intro") return;
        phase = "play"; phaseT = 0;
        ctx.audio.tone(300, 0.22, { type: "sine", vol: 0.07, glide: 210 });
      }
      function clearNight() {
        phase = "clear"; phaseT = 0;
        ctx.audio.score();
      }
      function advanceFromClear() {
        if (phase !== "clear") return;
        const next = night + 1;
        if (next > maxUnlocked) { maxUnlocked = next; ctx.storage.set("maxNight", maxUnlocked); }
        startNight(next);
      }

      // ---- actions ----
      function toggleDoor(side) {
        if (over || monitorUp || blackout) return;
        const d = doors[side];
        const h = halls[side];
        if (d.closed) {
          // trying to OPEN. If something is pressing (siege) and hasn't finished
          // knocking its way out yet, opening lets it in — instant death.
          if (h.siege > 0 && h.knocking <= 0) { breach(side === "L" ? "hallL" : "hallR"); return; }
          d.closed = false;
          ctx.audio.thunk();
        } else {
          // sealing
          d.closed = true;
          ctx.audio.thunk();
          if (h.active && h.prox >= WARN && h.siege <= 0) h.retreating = true;
        }
      }
      // LEFT light flash — the Wisp's counter. Each flash lights the hall briefly
      // and shoves the Wisp back; spam it to drive the Wisp away.
      function flickLight(side) {
        if (over || monitorUp || blackout || !has("wisp")) return;
        lights[side].until = anim + 900;
        power = Math.max(0, power - lightCost);
        ctx.audio.tone(560, 0.09, { type: "sine", vol: 0.06 });
        if (side === "L" && wisp.active) {
          wisp.prox = Math.max(0, wisp.prox - WISP_FLASH_PUSH);
          ctx.audio.tone(660, 0.12, { type: "sine", vol: 0.09, glide: 900 }); // recoil chirp
          if (wisp.prox <= 0) { wisp = newWisp(night); }                       // fully driven off
        }
      }
      // click the Leech off the power bar
      function grabLeech() {
        if (over || monitorUp || blackout || !has("leech") || !leech.latched) return;
        leech.latched = false;
        leech.wait = leechDelay(night);
        ctx.audio.tone(300, 0.14, { type: "triangle", vol: 0.14, glide: 150 });
      }
      function windCrank() {
        if (over || monitorUp || blackout || !has("crank")) return;
        if (crank.cd > 0) return;
        crank.cd = CRANK_CD;
        crank.angle += Math.PI / 3;
        crank.glow = 1;
        power = Math.min(POWER_MAX, power + CRANK_GAIN);
        const pitch = 360 + (power / POWER_MAX) * 220;
        ctx.audio.tone(pitch, 0.05, { type: "triangle", vol: 0.05 });
      }
      function setMonitor(up) {
        if (over || blackout || !has("vent")) return;
        if (monitorUp === up) return;
        monitorUp = up;
        ctx.audio.tone(up ? 240 : 150, 0.16, { type: "sine", vol: 0.08, glide: up ? 300 : 96 });
      }

      function breach(kind) {
        if (over) return;
        over = true; ended = true;
        ctx.audio.lose();
        const msgs = {
          hallL: "A Husk came through the left door.",
          hallR: "A Husk came through the right door.",
          wisp: "The Wisp slipped past the left light.",
          vent: "The vent overflowed.",
          creep: "The Stalker reached you through the cam.",
          power: "The power died and the dark came in."
        };
        ctx.onGameOver(night, {
          title: kind === "power" ? "Lights out." : "Night " + night + " got you.",
          msg: (msgs[kind] || "It got in.") + " You reached night " + night + "."
        });
      }

      // The Wisp announces itself with a soft, eerie rising whisper on the left.
      function wispCue() { ctx.audio.tone(430, 0.4, { type: "sine", vol: 0.07, glide: 620 }); }
      // The Leech latches with a wet low pulse.
      function leechCue() { ctx.audio.tone(140, 0.3, { type: "triangle", vol: 0.12, glide: 90 }); }

      // ---- audio texture ----
      function ambient(dt) {
        ambientT -= dt;
        if (ambientT <= 0) { ambientT = 2800; ctx.audio.tone(60, 0.6, { type: "sine", vol: 0.03 }); }
      }
      function proxCue(dt, threat) {
        proxT -= dt;
        if (threat >= 0.7 && proxT <= 0) {
          ctx.audio.tone(150 + (threat - 0.7) * 380, 0.16, { type: "sine", vol: 0.055 });
          proxT = 620;
        }
      }
      function ventPing(dt) {
        ventPingT -= dt;
        if (has("vent") && vent >= 66 && ventPingT <= 0) {
          ctx.audio.tone(210, 0.14, { type: "triangle", vol: 0.05, glide: 150 });
          ventPingT = vent >= 85 ? 520 : 1000;
        }
      }

      function regenNoise() {
        const n = reduced ? 30 : 70;
        noise = [];
        for (let k = 0; k < n; k++)
          noise.push({ x: Math.random(), y: Math.random(), a: 0.03 + Math.random() * 0.09, s: 1 + Math.random() * 2 });
      }

      // ---- update ----
      function update(dt) {
        anim += dt;
        if (crank.glow > 0) crank.glow = Math.max(0, crank.glow - dt / 260);
        if (flicker > 0) flicker = Math.max(0, flicker - dt / 260);
        if (crank.cd > 0) crank.cd = Math.max(0, crank.cd - dt);

        if (phase === "select") { phaseT += dt; return; }
        if (phase === "intro") { phaseT += dt; if (phaseT >= 3600) beginPlay(); return; }
        if (phase === "clear") { phaseT += dt; if (phaseT >= 2400) advanceFromClear(); return; }
        if (over) return;

        // ---- night clock ----
        nightTime += dt;
        if (nightTime >= nightLen) { clearNight(); return; }

        // ---- blackout endgame ----
        if (blackout > 0) {
          blackout -= dt;
          if (blackout <= 0) { breach("power"); return; }
          return;
        }

        // ---- power (crank is live from night 1) ----
        let drain = baseDrain(night);
        if (doors.L.closed) drain += doorDrain;
        if (doors.R.closed) drain += doorDrain;
        if (monitorUp) drain += monDrain;
        if (has("leech") && leech.latched) drain += LEECH_DRAIN;   // Leech feeds on power
        power -= drain * (dt / 1000);
        if (power <= 0) {
          power = 0;
          doors.L.closed = doors.R.closed = false;
          monitorUp = false;
          blackout = reduced ? 2400 : 3200;
          flicker = 1;
          ctx.audio.tone(80, 0.5, { type: "triangle", vol: 0.12, glide: 46 });
          return;
        }

        // ---- vent (night 3+) ----
        if (has("vent")) {
          if (monitorUp) vent = Math.max(0, vent - ventDrain * (dt / 1000));
          else vent += ventFill(night) * (dt / 1000);
          if (vent >= 100) { breach("vent"); return; }
        }

        // ---- stalker (night 4+, only via monitor) ----
        if (has("stalker")) {
          if (monitorUp) { creep += creepRate(night) * dt; if (creep >= 1) { breach("creep"); return; } }
          else creep = Math.max(0, creep - creepRetreat * dt);
        }

        // ---- hall wraiths ----
        let maxThreat = creep;
        ["L", "R"].forEach(function (side) {
          const h = halls[side];
          if (h.wait === Infinity) return;
          if (!h.active) {
            h.wait -= dt;
            if (h.wait <= 0) { h.active = true; h.prox = 0.03; h.warned = false; h.retreating = false; }
            return;
          }
          if (h.retreating) {
            h.prox -= hallSpeed(night) * dt * 2.4;
            if (h.prox <= 0) halls[side] = newHall(hallDelay(night));
            return;
          }
          // ---- pressing against a SEALED door (siege) ----
          if (h.siege > 0) {
            maxThreat = 1;
            // if the player somehow opened, toggleDoor already killed them; here
            // the door is guaranteed closed. Count down the press.
            if (h.knocking > 0) {
              // leave-knock playing: door still locked; when it ends, it's gone
              h.knocking -= dt;
              if (h.knocking <= 0) { halls[side] = newHall(hallDelay(night)); }
              return;
            }
            h.siege += dt;
            if (h.siege >= SIEGE_MS) {
              // it gives up and leaves. NO knock sound for door wraiths — the
              // door's red "HELD" glow going calm is the only cue (the crank
              // noise would mask a sound anyway). Door stays locked through the
              // brief leave window so you can't open into it as it goes.
              h.knocking = KNOCK_LOCK_MS;
            }
            return;
          }
          // ---- approaching ----
          h.prox += hallSpeed(night) * dt;
          if (!h.warned && h.prox >= WARN) {
            h.warned = true;
            ctx.audio.tone(side === "L" ? 300 : 360, 0.16, { type: "sine", vol: 0.06, glide: side === "L" ? 210 : 440 });
          }
          if (h.prox >= 1) {
            if (doors[side].closed) {
              // reaches a sealed door → begins pressing; door is now LOCKED.
              // No arrival knock — the red door glow is the cue.
              h.prox = 1; h.siege = 0.0001;
            } else {
              // reaches an OPEN door → takes you at once
              breach(side === "L" ? "hallL" : "hallR"); return;
            }
          }
          if (h.prox > maxThreat) maxThreat = h.prox;
        });
        if (over) return;

        // ---- Wisp (night 4+): green, LEFT hall only. Creeps in; sealing does
        // nothing — you FLASH the left light to shove it back. Reaches you if you
        // don't beat it back in time. ----
        if (has("wisp")) {
          if (!wisp.active) {
            wisp.wait -= dt;
            if (wisp.wait <= 0) { wisp.active = true; wisp.prox = 0.05; wisp.pinged = false; wispCue(); }
          } else {
            wisp.prox += wispSpeed(night) * dt;
            if (!wisp.pinged && wisp.prox >= 0.45) { wisp.pinged = true; wispCue(); }
            if (wisp.prox >= 1) { breach("wisp"); return; }
            if (wisp.prox > maxThreat) maxThreat = wisp.prox;
          }
        }

        // ---- Leech (night 5+): purple, latches onto the power bar and drains it
        // fast until you CLICK it off; then it lurks and re-latches. ----
        if (has("leech")) {
          if (!leech.latched) {
            leech.wait -= dt;
            if (leech.wait <= 0) { leech.latched = true; leechCue(); }
          }
          // power drain handled in the power block above
        }

        ambient(dt);
        proxCue(dt, maxThreat);
        ventPing(dt);

        noiseT -= dt;
        if (noiseT <= 0) { regenNoise(); noiseT = reduced ? 620 : (monitorUp ? 80 : 150); }
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
      function drawStatic(x, y, w, h, aScale) {
        for (let k = 0; k < noise.length; k++) {
          const p = noise[k];
          g.fillStyle = cy(p.a * aScale);
          g.fillRect(x + p.x * w, y + p.y * h, p.s, p.s);
        }
      }
      function drawScanlines(x, y, w, h, step, a) {
        g.fillStyle = "rgba(0,0,0," + a + ")";
        for (let sy = y; sy < y + h; sy += step) g.fillRect(x, sy, w, 1);
      }

      // ---- night clock + label ----
      function drawClock() {
        const S = cssS, p = L.power;
        const frac = Math.min(1, nightTime / nightLen);
        const hour = Math.min(6, Math.floor(frac * 6));
        const label = hour === 0 ? "12 AM" : (hour) + " AM";
        g.fillStyle = cy(0.85);
        g.font = "800 " + Math.round(S * 0.03) + "px system-ui, sans-serif";
        g.textAlign = "left"; g.textBaseline = "top";
        g.fillText("NIGHT " + night, p.x, p.y + p.h + S * 0.012);
        g.textAlign = "right";
        g.fillStyle = frac > 0.8 ? acc(0.9) : cy(0.7);
        g.fillText(label + " · " + Math.round(frac * 100) + "%", p.x + p.w, p.y + p.h + S * 0.012);
        // thin night progress line
        const ly = p.y + p.h + S * 0.05, lw = p.w;
        g.strokeStyle = cy(0.14); g.lineWidth = 2;
        g.beginPath(); g.moveTo(p.x, ly); g.lineTo(p.x + lw, ly); g.stroke();
        g.strokeStyle = cy(0.6); g.lineWidth = 2;
        g.beginPath(); g.moveTo(p.x, ly); g.lineTo(p.x + lw * frac, ly); g.stroke();
      }

      function drawPower() {
        const p = L.power;
        const frac = power / POWER_MAX;
        const low = power < 22;
        g.save();
        pathRR(p.x, p.y, p.w, p.h, 8);
        g.fillStyle = "rgba(8,14,18,0.92)"; g.fill();
        g.strokeStyle = cy(0.22); g.lineWidth = 1.5; g.stroke();
        const fw = (p.w - 6) * frac;
        if (fw > 1) {
          g.save();
          pathRR(p.x + 3, p.y + 3, p.w - 6, p.h - 6, 6); g.clip();
          const pulse = low && !reduced ? 0.6 + Math.abs(Math.sin(anim * 0.008)) * 0.4 : 1;
          g.shadowColor = low ? acc(0.6) : cy(0.5); g.shadowBlur = 16;
          g.fillStyle = low ? acc(0.85 * pulse) : cy(0.8);
          g.fillRect(p.x + 3, p.y + 3, fw, p.h - 6);
          g.restore();
        }
        g.fillStyle = low ? acc(0.95) : cy(0.85);
        g.font = "700 " + Math.round(p.h * 0.44) + "px system-ui, sans-serif";
        g.textAlign = "left"; g.textBaseline = "middle";
        g.fillText("POWER", p.x + p.w * 0.02, p.y + p.h / 2);
        g.textAlign = "right";
        g.fillText(Math.round(power) + "%", p.x + p.w * 0.98, p.y + p.h / 2);
        g.restore();
      }

      // purple Leech latched on the power bar — pulsing, obviously clickable
      function drawLeech() {
        const b = leechRect();
        const cxp = b.x + b.w / 2, cyp = b.y + b.h / 2;
        const pulse = reduced ? 1 : 0.75 + Math.abs(Math.sin(anim * 0.012)) * 0.25;
        g.save();
        g.shadowColor = pur(0.8); g.shadowBlur = 22 * pulse;
        const gr = g.createRadialGradient(cxp, cyp, b.w * 0.08, cxp, cyp, b.w * 0.5);
        gr.addColorStop(0, pur(0.95)); gr.addColorStop(0.6, pur(0.55)); gr.addColorStop(1, pur(0));
        g.fillStyle = gr;
        g.beginPath(); g.arc(cxp, cyp, b.w * 0.5 * pulse, 0, Math.PI * 2); g.fill();
        // dark core + feeding tendrils into the bar
        g.fillStyle = "rgba(20,8,30,0.9)";
        g.beginPath(); g.arc(cxp, cyp, b.w * 0.24, 0, Math.PI * 2); g.fill();
        g.strokeStyle = pur(0.7); g.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          const a = Math.PI + (i - 1) * 0.5;
          g.beginPath(); g.moveTo(cxp, cyp);
          g.lineTo(cxp + Math.cos(a) * b.w * 0.4, cyp + Math.sin(a) * b.w * 0.4); g.stroke();
        }
        g.restore();
        g.fillStyle = pur(0.95);
        g.font = "700 " + Math.round(b.h * 0.2) + "px system-ui, sans-serif";
        g.textAlign = "center"; g.textBaseline = "top";
        g.fillText("click!", cxp, b.y + b.h + 2);
      }

      // ---- OFFICE VIEW ----
      function drawOffice() {
        const S = cssS;
        const bg = g.createLinearGradient(0, 0, 0, S);
        bg.addColorStop(0, "rgba(9,16,22,1)");
        bg.addColorStop(0.6, "rgba(11,18,25,1)");
        bg.addColorStop(1, "rgba(6,10,14,1)");
        g.fillStyle = bg; g.fillRect(0, 0, S, S);

        const dip = flicker > 0 && !reduced ? (0.5 + Math.random() * 0.5) : 1;

        g.save();
        g.fillStyle = "rgba(4,8,11,0.9)";
        g.beginPath(); g.moveTo(0, 0); g.lineTo(S * 0.29, S * 0.14); g.lineTo(S * 0.29, S * 0.74); g.lineTo(0, S * 0.86); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(S, 0); g.lineTo(S * 0.71, S * 0.14); g.lineTo(S * 0.71, S * 0.74); g.lineTo(S, S * 0.86); g.closePath(); g.fill();
        g.restore();

        drawDoorway("L", L.leftDoor, dip);
        drawDoorway("R", L.rightDoor, dip);
        drawConsole();

        if (has("vent") && vent > 40) {
          const vf = (vent - 40) / 60;
          const vg = g.createRadialGradient(S / 2, S * 0.14, S * 0.02, S / 2, S * 0.14, S * 0.42);
          vg.addColorStop(0, acc(0.10 + vf * 0.22));
          vg.addColorStop(1, "rgba(0,0,0,0)");
          g.fillStyle = vg; g.fillRect(0, 0, S, S * 0.6);
        }

        drawPower();
        if (has("leech") && leech.latched) drawLeech();
        drawClock();

        const vig = g.createRadialGradient(S / 2, S * 0.5, S * 0.30, S / 2, S * 0.5, S * 0.78);
        vig.addColorStop(0, "rgba(0,0,0,0)");
        vig.addColorStop(1, "rgba(0,0,0," + (0.42 + (1 - dip) * 0.3) + ")");
        g.fillStyle = vig; g.fillRect(0, 0, S, S);
      }

      function drawDoorway(side, r, dip) {
        const h = halls[side];
        const threat = h.active && !h.retreating ? h.prox : 0;
        const inWarn = threat >= WARN, inDanger = threat >= DANGER;
        const closed = doors[side].closed;
        const litUntil = lights[side].until;
        const isLit = has("wisp") && side === "L" && anim < litUntil;
        const showLight = has("wisp") && side === "L";     // only the left door gets a light

        g.save();
        pathRR(r.x, r.y, r.w, r.h, 6); g.clip();

        const dg = g.createLinearGradient(r.x, r.y, r.x + r.w, r.y);
        if (side === "L") { dg.addColorStop(0, "rgba(3,6,9,1)"); dg.addColorStop(1, "rgba(10,17,23,1)"); }
        else { dg.addColorStop(0, "rgba(10,17,23,1)"); dg.addColorStop(1, "rgba(3,6,9,1)"); }
        g.fillStyle = dg; g.fillRect(r.x, r.y, r.w, r.h);

        // hall-light flood on the LEFT (the Wisp's counter)
        if (isLit && !closed) {
          const lg = g.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
          lg.addColorStop(0, cy(0.24)); lg.addColorStop(1, cy(0.05));
          g.fillStyle = lg; g.fillRect(r.x, r.y, r.w, r.h);
        }

        // ---- the Wisp: green orb creeping the left hall. BARELY visible in the
        // dark; the light flash briefly reveals it clearly. ----
        if (has("wisp") && side === "L" && wisp.active) {
          const wp = wisp.prox;
          const cxp = r.x + r.w * (0.68 - wp * 0.42);       // nears from far end
          const cyp = r.y + r.h * 0.5;
          const rad = r.w * (0.16 + wp * 0.34);
          const seen = isLit ? 1 : 0.16 + wp * 0.12;         // dim unless lit
          const pulse = reduced ? 1 : 0.8 + Math.sin(anim * 0.005) * 0.2;
          const gr = g.createRadialGradient(cxp, cyp, rad * 0.1, cxp, cyp, rad);
          gr.addColorStop(0, grn((isLit ? 0.75 : 0.34) * pulse));
          gr.addColorStop(0.5, grn((isLit ? 0.3 : 0.12) * pulse));
          gr.addColorStop(1, grn(0));
          g.fillStyle = gr; g.fillRect(r.x, r.y, r.w, r.h);
          g.fillStyle = grn(seen * 0.8);
          g.beginPath(); g.arc(cxp, cyp, rad * 0.34, 0, Math.PI * 2); g.fill();
        }

        // wraith glow from the far end
        if (threat > 0.02) {
          const cxp = side === "L" ? r.x + r.w * (0.62 - threat * 0.42) : r.x + r.w * (0.38 + threat * 0.42);
          const cyp = r.y + r.h * 0.5, rad = r.w * (0.28 + threat * 0.5);
          const mix = Math.max(0, Math.min(1, (threat - WARN) / (1 - WARN)));
          const cr = Math.round(120 + (AR - 120) * mix), cg = Math.round(178 + (AG - 178) * mix), cb = Math.round(208 + (AB - 208) * mix);
          const pulse = reduced ? 1 : 0.82 + Math.sin(anim * 0.006) * 0.18;
          const gr = g.createRadialGradient(cxp, cyp, rad * 0.08, cxp, cyp, rad);
          gr.addColorStop(0, "rgba(" + cr + "," + cg + "," + cb + "," + (0.55 * pulse) + ")");
          gr.addColorStop(0.5, "rgba(" + cr + "," + cg + "," + cb + "," + (0.2 * pulse) + ")");
          gr.addColorStop(1, "rgba(" + cr + "," + cg + "," + cb + ",0)");
          g.fillStyle = gr; g.fillRect(r.x, r.y, r.w, r.h);
          g.fillStyle = "rgba(2,5,7," + (0.4 + threat * 0.35) + ")";
          g.beginPath(); g.arc(cxp, cyp, rad * 0.32, 0, Math.PI * 2); g.fill();
        }

        const sieging = h.siege > 0 && h.knocking <= 0;   // pressing: DON'T open
        const knocking = h.knocking > 0;                   // leaving: about to be safe

        if (closed) {
          g.fillStyle = "rgba(14,22,28,0.98)"; g.fillRect(r.x, r.y, r.w, r.h);
          // shutter slats — flush red and rattle while something presses
          const rattle = sieging && !reduced ? Math.sin(anim * 0.05) * (r.w * 0.01) : 0;
          g.strokeStyle = sieging ? acc(0.7) : knocking ? cy(0.6) : cy(0.4);
          g.lineWidth = sieging ? 3 : 2;
          for (let by = r.y + r.h * 0.08; by < r.y + r.h * 0.9; by += r.h * 0.1) {
            g.beginPath(); g.moveTo(r.x + r.w * 0.06 + rattle, by); g.lineTo(r.x + r.w * 0.94 + rattle, by); g.stroke();
          }
          if (sieging) {   // red pressure glow bleeding around the sealed door
            const pg = g.createLinearGradient(r.x, r.y, side === "L" ? r.x + r.w : r.x, r.y);
            pg.addColorStop(0, side === "L" ? acc(0.28) : "rgba(0,0,0,0)");
            pg.addColorStop(1, side === "L" ? "rgba(0,0,0,0)" : acc(0.28));
            g.fillStyle = pg; g.fillRect(r.x, r.y, r.w, r.h);
          }
        }
        g.restore();

        // frame
        const bcol = sieging ? acc(0.95) : knocking ? cy(0.75) : inDanger ? acc(0.92) : inWarn ? acc(0.6) : cy(0.32);
        g.save();
        if (sieging || inWarn) { g.shadowColor = sieging ? acc(0.9) : acc(inDanger ? 0.85 : 0.5); g.shadowBlur = sieging ? 34 : inDanger ? 30 : 15; }
        g.strokeStyle = bcol; g.lineWidth = sieging || inWarn ? 3 : 1.6;
        pathRR(r.x + 1, r.y + 1, r.w - 2, r.h - 2, 6); g.stroke();
        g.restore();

        // label
        g.fillStyle = inWarn ? acc(0.95) : cy(0.7);
        g.font = "700 " + Math.round(r.w * 0.13) + "px system-ui, sans-serif";
        g.textAlign = "center"; g.textBaseline = "top";
        g.fillText(side, r.x + r.w / 2, r.y + r.h * 0.03);

        // seal state (above the light button area)
        g.textBaseline = "middle";
        let stateTxt, stateCol;
        if (sieging) { stateTxt = "HELD — don't open"; stateCol = acc(0.6 + Math.sin(anim * 0.02) * 0.4); }
        else if (knocking) { stateTxt = "it's gone · click: open"; stateCol = cy(0.95); }
        else if (closed) { stateTxt = "SEALED"; stateCol = cy(0.75); }
        else { stateTxt = "click: seal"; stateCol = inWarn ? acc(0.9) : cy(0.45); }
        g.fillStyle = stateCol;
        g.font = "700 " + Math.round(r.w * (sieging ? 0.07 : 0.072)) + "px system-ui, sans-serif";
        g.fillText(stateTxt, r.x + r.w / 2, r.y + r.h * (showLight ? 0.78 : 0.92));

        // LEFT light button (night 4+, Wisp's counter) — green when lit
        if (showLight) {
          const lb = lightBtn(r);
          const wispNear = wisp.active && wisp.prox > 0.3;
          g.save();
          pathRR(lb.x, lb.y, lb.w, lb.h, 6);
          g.fillStyle = isLit ? grn(0.3) : (wispNear ? grn(0.14) : "rgba(10,16,20,0.9)");
          g.fill();
          g.strokeStyle = isLit ? grn(0.8) : wispNear ? grn(0.6) : cy(0.35); g.lineWidth = 1.5;
          if (isLit || wispNear) { g.shadowColor = grn(0.5); g.shadowBlur = isLit ? 14 : 9; }
          pathRR(lb.x, lb.y, lb.w, lb.h, 6); g.stroke();
          g.restore();
          g.fillStyle = isLit ? grn(0.95) : cy(0.65);
          g.font = "700 " + Math.round(lb.h * 0.48) + "px system-ui, sans-serif";
          g.textAlign = "center"; g.textBaseline = "middle";
          g.fillText("💡 FLASH", lb.x + lb.w / 2, lb.y + lb.h / 2);
        }

        if (inDanger && !closed) {
          g.fillStyle = acc(0.55 + Math.sin(anim * 0.013) * 0.4);
          g.font = "800 " + Math.round(r.w * 0.16) + "px system-ui, sans-serif";
          g.textAlign = "center"; g.textBaseline = "middle";
          g.fillText("!", r.x + r.w / 2, r.y + r.h * 0.42);
        }
      }

      function drawConsole() {
        const S = cssS;
        // ---- crank (night 2+) — centered power wheel ----
        if (has("crank")) drawCrank();
        else {
          // night 1: nothing in the middle but the survive prompt
          g.fillStyle = cy(0.28);
          g.font = "600 " + Math.round(S * 0.028) + "px system-ui, sans-serif";
          g.textAlign = "center"; g.textBaseline = "middle";
          g.fillText("survive the night", S / 2, S * 0.5);
        }

        // ---- monitor tab (night 3+) at the bottom ----
        if (has("vent")) drawMonTab();
      }

      function drawCrank() {
        const c = L.crank;
        g.save();
        pathRR(c.x, c.y, c.w, c.h, 10);
        const grd = g.createLinearGradient(c.x, c.y, c.x, c.y + c.h);
        grd.addColorStop(0, "rgba(16,26,32,0.98)"); grd.addColorStop(1, "rgba(9,15,20,0.98)");
        g.fillStyle = grd; g.fill();
        const nudge = power < 40;
        g.shadowColor = nudge ? acc(0.5) : cy(0.3);
        g.shadowBlur = (nudge && !reduced ? 12 + Math.abs(Math.sin(anim * 0.007)) * 10 : 6) + crank.glow * 14;
        g.strokeStyle = nudge ? acc(0.7) : cy(0.4); g.lineWidth = 2;
        pathRR(c.x + 1, c.y + 1, c.w - 2, c.h - 2, 10); g.stroke();
        g.restore();

        // rotating handle — big, centered horizontally, upper portion of the box
        const gx = c.x + c.w * 0.5, gy = c.y + c.h * 0.42, gr = c.h * 0.30;
        g.save();
        g.translate(gx, gy); g.rotate(crank.angle);
        g.strokeStyle = cy(0.55 + crank.glow * 0.4); g.lineWidth = Math.max(2, c.h * 0.045);
        g.beginPath(); g.arc(0, 0, gr, 0, Math.PI * 2); g.stroke();
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3;
          g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * gr, Math.sin(a) * gr); g.stroke();
        }
        g.fillStyle = cy(0.85 + crank.glow * 0.15);
        g.beginPath(); g.arc(Math.cos(crank.angle) * gr, Math.sin(crank.angle) * gr, c.h * 0.07, 0, Math.PI * 2); g.fill();
        g.restore();

        g.textAlign = "center";
        g.fillStyle = power < 40 ? acc(0.9) : cy(0.85);
        g.font = "800 " + Math.round(c.h * 0.15) + "px system-ui, sans-serif";
        g.textBaseline = "alphabetic";
        g.fillText("WIND", c.x + c.w * 0.5, c.y + c.h * 0.88);
        g.font = "500 " + Math.round(c.h * 0.1) + "px system-ui, sans-serif";
        g.fillStyle = cy(0.5);
        g.fillText("click to charge power", c.x + c.w * 0.5, c.y + c.h * 0.99);
      }

      function drawMonTab() {
        const t = L.monTab;
        g.save();
        pathRR(t.x, t.y, t.w, t.h, 8);
        const grd = g.createLinearGradient(t.x, t.y, t.x, t.y + t.h);
        grd.addColorStop(0, "rgba(16,26,32,0.98)"); grd.addColorStop(1, "rgba(9,15,20,0.98)");
        g.fillStyle = grd; g.fill();
        const nudge = vent >= 66;
        g.shadowColor = nudge ? acc(0.5) : cy(0.3);
        g.shadowBlur = nudge && !reduced ? 14 + Math.abs(Math.sin(anim * 0.007)) * 10 : 8;
        g.strokeStyle = nudge ? acc(0.7) : cy(0.4); g.lineWidth = 2;
        pathRR(t.x + 1, t.y + 1, t.w - 2, t.h - 2, 8); g.stroke();
        g.restore();

        g.fillStyle = vent >= 66 ? acc(0.95) : cy(0.85);
        g.font = "700 " + Math.round(t.h * 0.32) + "px system-ui, sans-serif";
        g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText("▲ RAISE MONITOR", t.x + t.w / 2, t.y + t.h * 0.38);

        const gy = t.y + t.h * 0.72, gw = t.w * 0.74, gx = t.x + t.w * 0.13;
        g.fillStyle = "rgba(4,8,11,0.9)"; g.fillRect(gx, gy, gw, t.h * 0.14);
        g.fillStyle = vent >= 66 ? acc(0.85) : cy(0.7);
        g.fillRect(gx, gy, gw * Math.min(1, vent / 100), t.h * 0.14);
        g.fillStyle = cy(0.55);
        g.font = "600 " + Math.round(t.h * 0.14) + "px system-ui, sans-serif";
        g.textAlign = "left"; g.textBaseline = "bottom";
        g.fillText("VENT " + Math.round(vent) + "%", gx, gy - 2);
      }

      // ---- MONITOR (VENT CAM) VIEW ----
      function drawMonitor() {
        const S = cssS;
        g.fillStyle = "rgba(5,9,12,1)"; g.fillRect(0, 0, S, S);
        const fx = S * 0.05, fy = S * 0.13, fw = S * 0.9, fh = S * 0.64;
        g.save();
        pathRR(fx, fy, fw, fh, 12); g.clip();
        const bg = g.createLinearGradient(fx, fy, fx, fy + fh);
        bg.addColorStop(0, "rgba(8,16,20,1)"); bg.addColorStop(1, "rgba(4,8,11,1)");
        g.fillStyle = bg; g.fillRect(fx, fy, fw, fh);

        const vpx = fx + fw / 2, vpy = fy + fh * 0.5;
        g.strokeStyle = cy(0.18); g.lineWidth = 1.5;
        for (let i = 0; i <= 6; i++) {
          const t = i / 6;
          g.beginPath(); g.moveTo(fx + fw * t, fy); g.lineTo(vpx, vpy); g.stroke();
          g.beginPath(); g.moveTo(fx + fw * t, fy + fh); g.lineTo(vpx, vpy); g.stroke();
        }
        for (let rr = 1; rr <= 5; rr++) {
          const s = 1 - rr / 6, rw = fw * s, rh = fh * s;
          g.strokeStyle = cy(0.1 + s * 0.14);
          g.strokeRect(vpx - rw / 2, vpy - rh / 2, rw, rh);
        }

        if (has("stalker") && creep > 0.01) {
          const cs = creep, size = fw * (0.05 + cs * 0.34), cxp = vpx, cyp = vpy - fh * 0.02;
          const mix = Math.min(1, cs / 0.8);
          const cr = Math.round(120 + (AR - 120) * mix), cg = Math.round(178 + (AG - 178) * mix), cb = Math.round(208 + (AB - 208) * mix);
          const pulse = reduced ? 1 : 0.82 + Math.sin(anim * 0.007) * 0.18;
          const gr = g.createRadialGradient(cxp, cyp, size * 0.1, cxp, cyp, size * 1.4);
          gr.addColorStop(0, "rgba(" + cr + "," + cg + "," + cb + "," + (0.6 * pulse) + ")");
          gr.addColorStop(0.5, "rgba(" + cr + "," + cg + "," + cb + "," + (0.22 * pulse) + ")");
          gr.addColorStop(1, "rgba(" + cr + "," + cg + "," + cb + ",0)");
          g.fillStyle = gr; g.beginPath(); g.arc(cxp, cyp, size * 1.4, 0, Math.PI * 2); g.fill();
          g.fillStyle = "rgba(2,5,7," + (0.5 + cs * 0.4) + ")";
          g.beginPath(); g.ellipse(cxp, cyp + size * 0.15, size * 0.5, size * 0.62, 0, 0, Math.PI * 2); g.fill();
          if (cs > 0.35) {
            g.fillStyle = acc(0.5 + cs * 0.5);
            const es = size * 0.09;
            g.beginPath(); g.arc(cxp - size * 0.18, cyp, es, 0, Math.PI * 2); g.fill();
            g.beginPath(); g.arc(cxp + size * 0.18, cyp, es, 0, Math.PI * 2); g.fill();
          }
        }

        drawStatic(fx, fy, fw, fh, 1.4);
        drawScanlines(fx, fy, fw, fh, 3, 0.2);
        if (!reduced) {
          const sweepY = fy + ((anim * 0.06) % fh);
          const sg = g.createLinearGradient(0, sweepY - 26, 0, sweepY + 26);
          sg.addColorStop(0, cy(0)); sg.addColorStop(0.5, cy(0.06)); sg.addColorStop(1, cy(0));
          g.fillStyle = sg; g.fillRect(fx, sweepY - 26, fw, 52);
        }
        const vg = g.createRadialGradient(vpx, vpy, fw * 0.15, vpx, vpy, fw * 0.62);
        vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.55)");
        g.fillStyle = vg; g.fillRect(fx, fy, fw, fh);
        g.restore();

        const hot = has("stalker") && creep >= 0.7;
        g.save();
        if (hot) { g.shadowColor = acc(0.7); g.shadowBlur = 24; }
        g.strokeStyle = hot ? acc(0.9) : cy(0.4); g.lineWidth = hot ? 3 : 1.6;
        pathRR(fx + 1, fy + 1, fw - 2, fh - 2, 12); g.stroke();
        g.restore();

        g.fillStyle = cy(0.8);
        g.font = "700 " + Math.round(fw * 0.045) + "px system-ui, sans-serif";
        g.textAlign = "left"; g.textBaseline = "top";
        g.fillText("CAM · VENT SHAFT", fx + fw * 0.03, fy + fh * 0.03);
        if (has("stalker")) {
          g.textAlign = "right";
          g.fillStyle = creep >= 0.7 ? acc(0.95) : cy(0.6);
          g.fillText(creep >= 0.5 ? "PROXIMITY " + Math.round(creep * 100) + "%" : "clear", fx + fw * 0.97, fy + fh * 0.03);
        }

        // big draining vent gauge
        const gx = S * 0.05, gy = S * 0.8, gw = S * 0.9, gh = S * 0.045;
        g.fillStyle = "rgba(8,14,18,0.92)"; pathRR(gx, gy, gw, gh, 6); g.fill();
        g.strokeStyle = cy(0.22); g.lineWidth = 1.5; g.stroke();
        g.save(); pathRR(gx + 3, gy + 3, gw - 6, gh - 6, 5); g.clip();
        g.fillStyle = vent >= 66 ? acc(0.8) : cy(0.75);
        g.shadowColor = vent >= 66 ? acc(0.5) : cy(0.4); g.shadowBlur = 12;
        g.fillRect(gx + 3, gy + 3, (gw - 6) * Math.min(1, vent / 100), gh - 6);
        g.restore();
        g.fillStyle = cy(0.85);
        g.font = "700 " + Math.round(gh * 0.5) + "px system-ui, sans-serif";
        g.textAlign = "left"; g.textBaseline = "middle";
        g.fillText("VENT — draining", gx + gw * 0.02, gy + gh / 2);
        g.textAlign = "right"; g.fillText(Math.round(vent) + "%", gx + gw * 0.98, gy + gh / 2);

        drawPower();
        g.fillStyle = creep >= 0.7 ? acc(0.95) : cy(0.85);
        g.font = "700 " + Math.round(S * 0.03) + "px system-ui, sans-serif";
        g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText("▼ click anywhere to lower monitor", S / 2, S * 0.88);
        g.fillStyle = cy(0.32);
        g.font = "600 " + Math.round(S * 0.022) + "px system-ui, sans-serif";
        g.fillText("doors are blind while you watch", S / 2, S * 0.93);
      }

      // ---- intro / clear cards ----
      function drawCard(lines, small) {
        const S = cssS;
        drawOffice();
        g.fillStyle = "rgba(4,7,10," + (reduced ? 0.9 : 0.82) + ")";
        g.fillRect(0, 0, S, S);
        g.textAlign = "center";
        g.fillStyle = acc(0.95);
        g.font = "800 " + Math.round(S * 0.075) + "px system-ui, sans-serif";
        g.textBaseline = "middle";
        g.fillText(lines[0], S / 2, S * 0.4);
        if (lines[1]) {
          g.fillStyle = cy(0.85);
          g.font = "700 " + Math.round(S * 0.04) + "px system-ui, sans-serif";
          g.fillText(lines[1], S / 2, S * 0.5);
        }
        if (lines[2]) {
          g.fillStyle = cy(0.6);
          g.font = "500 " + Math.round(S * 0.03) + "px system-ui, sans-serif";
          // wrap long feature description
          wrapText(lines[2], S / 2, S * 0.6, S * 0.8, S * 0.042);
        }
        if (small) {
          g.fillStyle = cy(0.5);
          g.font = "600 " + Math.round(S * 0.026) + "px system-ui, sans-serif";
          g.fillText(small, S / 2, S * 0.82);
        }
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

      function drawSelect() {
        const S = cssS;
        drawOffice();
        g.fillStyle = "rgba(4,7,10," + (reduced ? 0.92 : 0.86) + ")";
        g.fillRect(0, 0, S, S);
        g.textAlign = "center"; g.textBaseline = "middle";
        g.fillStyle = acc(0.95);
        g.font = "800 " + Math.round(S * 0.06) + "px system-ui, sans-serif";
        g.fillText("VIGIL", S / 2, S * 0.2);
        g.fillStyle = cy(0.8);
        g.font = "700 " + Math.round(S * 0.032) + "px system-ui, sans-serif";
        g.fillText("Pick a night to start", S / 2, S * 0.29);
        g.fillStyle = cy(0.45);
        g.font = "500 " + Math.round(S * 0.024) + "px system-ui, sans-serif";
        g.fillText(maxUnlocked > 1 ? ("Reached: Night " + maxUnlocked) : "Start at Night 1 — clear it to unlock the next", S / 2, S * 0.345);

        nightTiles().forEach(function (t) {
          const r = t.rect;
          g.save();
          pathRR(r.x, r.y, r.w, r.h, 12);
          g.fillStyle = "rgba(14,22,28,0.95)";
          g.fill();
          g.shadowColor = cy(0.4); g.shadowBlur = 10;
          g.strokeStyle = cy(0.5); g.lineWidth = 2;
          pathRR(r.x, r.y, r.w, r.h, 12); g.stroke();
          g.restore();
          g.fillStyle = cy(0.95);
          g.font = "800 " + Math.round(r.h * 0.42) + "px system-ui, sans-serif";
          g.textAlign = "center"; g.textBaseline = "middle";
          g.fillText(String(t.n), r.x + r.w / 2, r.y + r.h * 0.42);
          // feature label for the first five nights
          const feat = { 1: "husks + crank", 2: "vents", 3: "stalker", 4: "wisp", 5: "leech" }[t.n] || "all live";
          g.fillStyle = cy(0.55);
          g.font = "600 " + Math.round(r.h * 0.13) + "px system-ui, sans-serif";
          g.fillText(feat, r.x + r.w / 2, r.y + r.h * 0.78);
        });
      }

      function draw() {
        g.clearRect(0, 0, cssS, cssS);
        if (phase === "select") { drawSelect(); return; }
        if (phase === "intro") {
          const info = INTRO[night];
          if (info) drawCard(["NIGHT " + night, info[0], info[1]], "click to begin");
          else drawCard(["NIGHT " + night, "It only gets darker.", "Every system is live now."], "click to begin");
          return;
        }
        if (phase === "clear") { drawCard(["NIGHT " + night, "CLEAR", "You held the office. Next night is harder."], "next night…"); return; }
        if (blackout > 0) { drawBlackout(); return; }
        if (monitorUp) drawMonitor(); else drawOffice();
      }

      function drawBlackout() {
        const S = cssS;
        g.fillStyle = "rgba(0,0,0," + (reduced ? 0.9 : 0.82) + ")"; g.fillRect(0, 0, S, S);
        if (!reduced && Math.sin(anim * 0.02) > 0.6) { g.fillStyle = acc(0.06); g.fillRect(0, 0, S, S); }
        g.fillStyle = acc(0.5 + Math.sin(anim * 0.01) * 0.3);
        g.font = "700 " + Math.round(S * 0.05) + "px system-ui, sans-serif";
        g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText("POWER OUT", S / 2, S / 2);
      }

      function inRect(r, x, y) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }

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
          canvas.style.boxShadow = "0 0 46px rgba(198,88,79,0.1)";
          canvas.style.cursor = "pointer";
          g = canvas.getContext("2d");
          wrap.appendChild(canvas);
          const hint = document.createElement("div");
          hint.className = "hint";
          hint.textContent = "Survive each night to reach the next. New systems unlock as you go — read the card, then hold the office.";
          wrap.appendChild(hint);
          stage.appendChild(wrap);

          resize();
          reset();
          Arcade.input.setPointerTarget(canvas);
          draw();
          unResize = Arcade.board.onResize(function () { resize(); draw(); });
        },

        handleInput(intent) {
          if (over) return;
          if (intent.type !== "point" || intent.phase !== "down" || intent.button !== 0) return;
          if (phase === "select") {
            const hit = nightTiles().find(function (t) { return inRect(t.rect, intent.x, intent.y); });
            if (hit) { ctx.audio.tone(300, 0.16, { type: "sine", vol: 0.07, glide: 220 }); startNight(hit.n); }
            return;
          }
          if (phase === "intro") { beginPlay(); return; }
          if (phase === "clear") { advanceFromClear(); return; }
          if (blackout > 0) return;
          const x = intent.x, y = intent.y;
          if (monitorUp) { setMonitor(false); return; }
          // Leech first — it sits over the power bar / top area
          if (has("leech") && leech.latched && inRect(leechRect(), x, y)) { grabLeech(); return; }
          if (has("crank") && inRect(L.crank, x, y)) { windCrank(); return; }
          if (has("vent") && inRect(L.monTab, x, y)) { setMonitor(true); return; }
          // doorways — left door has a FLASH button (Wisp) vs seal
          ["L", "R"].forEach(function (side) {
            const r = side === "L" ? L.leftDoor : L.rightDoor;
            if (!inRect(r, x, y)) return;
            if (side === "L" && has("wisp") && inRect(lightBtn(r), x, y)) flickLight("L");
            else toggleDoor(side);
          });
        },

        tick(dt) { update(dt); draw(); },

        teardown() {
          if (unResize) unResize();
          unResize = null;
          stageEl = ctx = canvas = g = null;
          doors = halls = lights = wisp = leech = noise = L = null;
        }
      };
      return self;
    }
  });
})();
