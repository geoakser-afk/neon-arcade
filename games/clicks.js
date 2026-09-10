/* Click Speed — a CPS (clicks-per-second) tester, not really a game. Pick a mode, then
   hammer the pad: 5-second and 10-second sprints, Butterfly (two fingers alternating on one
   button, 10 s), Jitter (5 s of pure speed), Kohi (how fast can you land 10 clicks), Scroll
   (wheel ticks in 5 s), Space (spacebar taps in 5 s). Live CPS while you go, peak-second
   burst, a rating at the end, and a saved best per mode. Timer starts on the first input. */
(function () {
  const MODES = [
    { id: "cps5", name: "5 seconds", sub: "classic sprint", dur: 5000, kind: "click" },
    { id: "cps10", name: "10 seconds", sub: "stamina", dur: 10000, kind: "click" },
    { id: "butterfly", name: "Butterfly", sub: "two fingers, one button · 10 s", dur: 10000, kind: "click" },
    { id: "jitter", name: "Jitter", sub: "shake it · 5 s", dur: 5000, kind: "click" },
    { id: "kohi", name: "Kohi", sub: "time to land 10 clicks", dur: 0, kind: "click", target: 10 },
    { id: "scroll", name: "Scroll", sub: "wheel ticks · 5 s", dur: 5000, kind: "wheel" },
    { id: "space", name: "Space", sub: "spacebar taps · 5 s", dur: 5000, kind: "key" }
  ];
  function rating(cps, kind) {
    if (kind === "wheel") return cps < 8 ? "Gentle scroller" : cps < 15 ? "Solid" : cps < 25 ? "Free-spin energy" : "Wheel on fire";
    if (kind === "key") return cps < 5 ? "Warming up" : cps < 8 ? "Normal" : cps < 11 ? "Fast fingers" : "Mechanical keyboard abuse";
    return cps < 4 ? "Warming up" : cps < 6 ? "Normal human" : cps < 8 ? "Fast" : cps < 10 ? "Butterfly territory" : cps < 13 ? "Jitter god" : "Are you a macro?";
  }

  Arcade.register({
    id: "clicks",
    name: "Click Speed",
    tagline: "How many clicks per second? Sprints, butterfly, jitter, Kohi, scroll wheel, spacebar.",
    accent: "#74b9ff",
    complexity: "low",
    controls: "click",
    scoreLabel: "Clicks",
    create() {
      let stageEl, ctx, root, pad, big, live, sub, modeBar, result, styleEl, canvas, g;
      let mode = MODES[0], state = "idle", t0 = 0, count = 0, times = [], best = 0, raf = null, unResize = null;
      let ripples = [], listeners = [], lastTick = 0, doneAt = 0, lbEl = null;
      let race = null, raceEl = null, raceBtn = null, lastProg = 0;   // multiplayer race (Arcade.mpLobby)
      const COOLDOWN = 1500;   // ms after a result during which input is ignored (so spam can't click through your score)

      const fmt = (n) => (Math.round(n * 100) / 100).toFixed(2);
      function on(el, ev, fn, opts) { el.addEventListener(ev, fn, opts); listeners.push([el, ev, fn, opts]); }

      function setMode(m) {
        mode = m; reset();
        Array.from(modeBar.children).forEach(function (b) { b.classList.toggle("on", b.dataset.id === m.id); });
        const key = "best:" + m.id; best = ctx.storage.get(key, 0);
        sub.textContent = m.kind === "wheel" ? "Scroll the wheel on the pad. Timer starts on the first tick." : m.kind === "key" ? "Tap SPACE. Timer starts on the first tap." : m.target ? "Click as fast as you can. Timer runs until " + m.target + " clicks land." : "Click the pad. Timer starts on the first click.";
        result.innerHTML = best ? '<span class="cs-dim">best</span> ' + (m.target ? fmt(best) + " s" : fmt(best) + " cps") : "";
        pad.focus();
      }
      function reset() { if (lbEl) { lbEl.remove(); lbEl = null; } state = "idle"; count = 0; times = []; t0 = 0; big.textContent = "0"; live.textContent = mode.kind === "wheel" ? "ticks / sec" : "clicks / sec"; pad.classList.remove("done"); pad.classList.remove("cool"); }

      function hit(x, y) {
        const now = performance.now();
        if (state === "done") {
          if (now - doneAt < COOLDOWN) return;                       // still cooling down: swallow the click
          reset(); pad.classList.remove("cool");                      // first click after the cooldown only re-arms; the next one starts
          result.innerHTML = best ? '<span class="cs-dim">best</span> ' + (mode.target ? fmt(best) + " s" : fmt(best) + " cps") : "";
          return;
        }
        if (race && race.phase !== "run") return;            // race: wait for GO
        if (state === "idle") { state = "run"; t0 = now; }
        count++; times.push(now);
        ctx.setScore(count);
        if (now - lastTick > 40) { lastTick = now; ctx.audio.tone(880 + (count % 4) * 60, 0.03, { type: "sine", vol: 0.03 }); }
        if (x !== undefined) ripples.push({ x: x, y: y, t: 0 });
        if (mode.target && count >= mode.target) finish(now);
      }
      function finish(now) {
        state = "done"; doneAt = performance.now(); pad.classList.add("done"); pad.classList.add("cool");
        const secs = mode.target ? (now - t0) / 1000 : mode.dur / 1000;
        const cps = count / Math.max(0.001, secs);
        // peak burst = most inputs inside any 1-second window
        let peak = 0; for (let i = 0; i < times.length; i++) { let j = i; while (j < times.length && times[j] - times[i] <= 1000) j++; peak = Math.max(peak, j - i); }
        const key = "best:" + mode.id;
        let isBest = false;
        if (mode.target) { if (!best || secs < best) { best = secs; isBest = true; } }
        else if (cps > best) { best = cps; isBest = true; }
        if (isBest) ctx.storage.set(key, best);
        ctx.storage.recordScore(count);
        big.textContent = mode.target ? fmt(secs) + "s" : fmt(cps);
        live.textContent = mode.target ? "seconds for " + mode.target + " clicks" : (mode.kind === "wheel" ? "ticks / sec" : "clicks / sec");
        result.innerHTML =
          '<b>' + count + '</b> ' + (mode.kind === "wheel" ? "ticks" : mode.kind === "key" ? "taps" : "clicks") + (mode.target ? "" : " in " + secs + " s") +
          ' · <b>' + fmt(cps) + '</b> cps · peak <b>' + peak + '</b>/s' +
          '<div class="cs-rate">' + rating(cps, mode.kind) + (isBest ? ' · <span class="cs-new">new best!</span>' : ' · <span class="cs-dim">best ' + (mode.target ? fmt(best) + " s" : fmt(best) + " cps") + '</span>') + '</div>' +
          '<div class="cs-dim cs-again">wait…</div>';
        ctx.audio.arp(isBest ? [523, 659, 784, 1046] : [523, 659], { dur: 0.16, step: 0.08, vol: 0.1, type: "sine" });
        if (race) { race.me.done = true; race.me.score = mode.target ? secs : cps; race.me.count = count; Arcade.mpLobby.send({ k: "fin", score: race.me.score, count: count }); raceRender(); raceMaybeFinish(); }
        // global leaderboard for this mode (Kohi = lower time is better)
        if (window.Arcade && Arcade.leaderboardPanel) { if (lbEl) lbEl.remove(); lbEl = Arcade.leaderboardPanel("clicks:" + mode.id, mode.target ? secs : cps, mode.name + (mode.target ? " (s)" : " (cps)"), !!mode.target); lbEl.style.margin = "10px auto 0"; root.appendChild(lbEl); }
      }

      function frame() {
        const now = performance.now();
        if (state === "done" && pad.classList.contains("cool") && now - doneAt >= COOLDOWN) { pad.classList.remove("cool"); const a = result.querySelector(".cs-again"); if (a) a.textContent = "click the pad to reset, then click to go again"; }
        if (race && race.phase === "run" && state === "run" && now - lastProg > 200) { lastProg = now; race.me.count = count; Arcade.mpLobby.send({ k: "prog", count: count }); raceRender(); }
        if (race && race.phase === "count") { const left = race.goAt - now; big.textContent = left > 0 ? String(Math.ceil(left / 1000)) : "GO!"; live.textContent = "race: " + mode.name; if (left <= 0) { race.phase = "run"; state = "run"; t0 = now; times = []; count = 0; ctx.audio.tone(1040, 0.3, { type: "sine", vol: 0.14 }); } else if (Math.floor(left / 1000) !== race.lastBeep) { race.lastBeep = Math.floor(left / 1000); ctx.audio.tone(520, 0.12, { type: "sine", vol: 0.1 }); } }
        if (state === "run") {
          const el = now - t0;
          if (!mode.target && el >= mode.dur) finish(now);
          else {
            // rolling one-second CPS
            let k = times.length; while (k > 0 && now - times[k - 1] < 1000) k--;
            const inWin = times.length - k;
            big.textContent = mode.target ? String(count) : String(count);
            live.textContent = fmt(inWin / Math.min(1, Math.max(0.001, el / 1000))) + (mode.kind === "wheel" ? " ticks/s" : " cps") + (mode.target ? "" : " · " + Math.max(0, Math.ceil((mode.dur - el) / 1000)) + "s left");
          }
        }
        // ripple canvas
        if (canvas) {
          const r = pad.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
          if (canvas.width !== Math.round(r.width * dpr) || canvas.height !== Math.round(r.height * dpr)) { canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); }
          g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, r.width, r.height);
          for (let i = ripples.length - 1; i >= 0; i--) { const q = ripples[i]; q.t += 16; const k = q.t / 420; if (k >= 1) { ripples.splice(i, 1); continue; } g.globalAlpha = 1 - k; g.strokeStyle = ctx.accent; g.lineWidth = 3; g.beginPath(); g.arc(q.x, q.y, 10 + k * 60, 0, Math.PI * 2); g.stroke(); }
          g.globalAlpha = 1;
          if (state === "done" && now - doneAt < COOLDOWN) { const k = (now - doneAt) / COOLDOWN; g.strokeStyle = ctx.accent; g.globalAlpha = 0.6; g.lineWidth = 5; g.beginPath(); g.arc(r.width / 2, r.height * 0.86, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - k)); g.stroke(); g.globalAlpha = 1; }
          if (state === "run" && !mode.target) { g.fillStyle = ctx.accent; g.globalAlpha = 0.5; g.fillRect(0, r.height - 6, r.width * Math.min(1, (now - t0) / mode.dur), 6); g.globalAlpha = 1; }
        }
        raf = requestAnimationFrame(frame);
      }

      // ---- Race friends: everyone runs the same mode from a synced countdown; live bars; ranking at the end ----
      function raceOpen() {
        Arcade.mpLobby.open({
          title: "Click Speed — race your friends", modes: MODES.map(function (m) { return { id: m.id, label: m.name }; }), defaultMode: mode.id,
          onStart: raceStart, onMsg: raceMsg, onLeave: raceEnd,
          onPeer: function (q, what) { if (!race) return; if (what === "leave") { delete race.players[q.id]; raceRender(); raceMaybeFinish(); } }
        });
      }
      function raceStart(info) {
        const m = MODES.find(function (x) { return x.id === info.mode; }) || MODES[0];
        setMode(m); pad.classList.remove("cool");
        race = { phase: "count", goAt: performance.now() + 3200, lastBeep: 9, isHost: info.isHost, me: { id: info.me.id, name: info.me.name, count: 0, done: false, score: null }, players: {}, finished: false };
        Arcade.mpLobby.players().forEach(function (q) { if (q.id !== info.me.id) race.players[q.id] = { id: q.id, name: q.name, count: 0, done: false, score: null }; });
        state = "idle"; count = 0; times = []; big.textContent = "3"; live.textContent = "get ready…";
        if (!raceEl) { raceEl = document.createElement("div"); raceEl.className = "cs-race"; root.insertBefore(raceEl, sub); }
        raceRender();
      }
      function raceMsg(m) {
        if (!race) return; const d = m.d || {}; let q = race.players[m.from];
        if (!q) { const r = Arcade.mpLobby.players().find(function (z) { return z.id === m.from; }); q = race.players[m.from] = { id: m.from, name: r ? r.name : "Frog", count: 0, done: false, score: null }; }
        if (d.k === "prog") q.count = d.count; else if (d.k === "fin") { q.done = true; q.score = d.score; q.count = d.count; raceMaybeFinish(); }
        raceRender();
      }
      function raceAll() { return [race.me].concat(Object.keys(race.players).map(function (id) { return race.players[id]; })); }
      function raceMaybeFinish() {
        if (!race || race.finished) return;
        const all = raceAll(); if (!all.every(function (q) { return q.done; })) { if (race.me.done && !race.timeout) race.timeout = setTimeout(function () { if (race && !race.finished) raceFinishNow(); }, 6000); return; }
        raceFinishNow();
      }
      function raceFinishNow() {
        race.finished = true; race.phase = "done"; clearTimeout(race.timeout);
        const all = raceAll().filter(function (q) { return q.done; }).sort(function (a, b) { return mode.target ? a.score - b.score : b.score - a.score; });
        race.rank = all.map(function (q) { return q.id; });
        const winner = all[0]; if (winner) { if (winner.id === race.me.id) ctx.audio.arp([523, 659, 784, 1046, 1318], { dur: 0.2, step: 0.08, vol: 0.12, type: "sine" }); }
        raceRender();
      }
      function raceRender() {
        if (!race || !raceEl) return;
        const all = raceAll(), max = Math.max(1, Math.max.apply(null, all.map(function (q) { return q.count || 0; })));
        let html = '<div class="cs-race-title">' + (race.phase === "count" ? "🏁 race starting…" : race.phase === "run" ? "🏁 racing — " + mode.name : "🏁 results — " + mode.name) + "</div>";
        const order = race.rank ? race.rank.map(function (id) { return all.find(function (q) { return q.id === id; }); }).filter(Boolean).concat(all.filter(function (q) { return race.rank.indexOf(q.id) < 0; })) : all;
        order.forEach(function (q, i) {
          const val = q.done && q.score != null ? (mode.target ? fmt(q.score) + " s" : fmt(q.score) + " cps") : (q.count || 0) + (mode.kind === "wheel" ? " ticks" : "");
          html += '<div class="cs-race-row' + (q.id === race.me.id ? " me" : "") + (race.rank && i === 0 ? " win" : "") + '"><span class="n">' + (race.rank ? (i + 1) + ". " : "") + String(q.name).replace(/[<>&]/g, "") + '</span><span class="bar"><i style="width:' + Math.round(100 * (q.count || 0) / max) + '%"></i></span><b>' + val + '</b></div>';
        });
        if (race.phase === "done") html += '<div class="cs-race-foot">' + (race.isHost ? '<button class="btn cs-again">Race again</button>' : "waiting for the host to start another…") + ' <button class="btn ghost cs-leave">Leave race</button></div>';
        raceEl.innerHTML = html;
        const again = raceEl.querySelector(".cs-again"); if (again) again.onclick = function () { Arcade.mpLobby.restart(mode.id); };
        const lv = raceEl.querySelector(".cs-leave"); if (lv) lv.onclick = function () { Arcade.mpLobby.leave(); };
      }
      function raceEnd() { if (race && race.timeout) clearTimeout(race.timeout); race = null; if (raceEl) { raceEl.remove(); raceEl = null; } reset(); }

      return {
        mount(stage, c) {
          stageEl = stage; ctx = c;
          styleEl = document.createElement("style");
          styleEl.textContent =
            ".cs-root{display:flex;flex-direction:column;align-items:center;gap:14px;width:min(92vw,720px)}" +
            ".cs-modes{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}" +
            ".cs-modes button{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);color:var(--fg,#e6ecf5);border-radius:12px;padding:8px 12px;cursor:pointer;font:inherit;line-height:1.15;text-align:left}" +
            ".cs-modes button small{display:block;opacity:.55;font-size:11px}" +
            ".cs-modes button.on{border-color:var(--accent);box-shadow:0 0 18px color-mix(in srgb,var(--accent) 40%,transparent);background:color-mix(in srgb,var(--accent) 16%,transparent)}" +
            ".cs-pad{position:relative;width:100%;aspect-ratio:16/9;max-height:52vh;border-radius:22px;background:rgba(255,255,255,.04);border:2px solid color-mix(in srgb,var(--accent) 45%,transparent);box-shadow:0 0 40px color-mix(in srgb,var(--accent) 18%,transparent) inset,0 0 30px color-mix(in srgb,var(--accent) 12%,transparent);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;user-select:none;-webkit-user-select:none;touch-action:none;outline:none;overflow:hidden}" +
            ".cs-pad:active{transform:scale(.995)}.cs-pad.done{border-style:dashed}.cs-pad.cool{cursor:wait;opacity:.85}" +
            ".cs-pad canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}" +
            ".cs-big{font-size:clamp(56px,12vw,120px);font-weight:800;letter-spacing:-.02em;color:var(--accent);text-shadow:0 0 24px color-mix(in srgb,var(--accent) 55%,transparent);line-height:1;position:relative;font-variant-numeric:tabular-nums}" +
            ".cs-live{opacity:.7;font-size:15px;margin-top:8px;position:relative}" +
            ".cs-sub{opacity:.6;font-size:13px;text-align:center}.cs-result{text-align:center;font-size:15px;min-height:3.2em;line-height:1.5}" +
            ".cs-rate{font-size:17px;color:var(--accent)}.cs-dim{opacity:.55}.cs-new{color:#ffd36b;font-weight:700}" +
            ".cs-racebtn{border-color:rgba(127,224,160,.5)!important;background:rgba(127,224,160,.1)!important}" +
            ".cs-race{width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:10px 14px}.cs-race-title{font-weight:800;font-size:13px;letter-spacing:.04em;opacity:.85;margin-bottom:6px}" +
            ".cs-race-row{display:flex;align-items:center;gap:10px;padding:4px 0;font-size:14px}.cs-race-row .n{width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cs-race-row .bar{flex:1;height:10px;border-radius:6px;background:rgba(255,255,255,.08);overflow:hidden}.cs-race-row .bar i{display:block;height:100%;background:var(--accent);transition:width .15s}.cs-race-row.me .bar i{background:#7fe0a0}.cs-race-row.win .n{color:#ffd36b}.cs-race-row b{width:84px;text-align:right;font-variant-numeric:tabular-nums}" +
            ".cs-race-foot{margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px;opacity:.9}";
          document.head.appendChild(styleEl);
          root = document.createElement("div"); root.className = "cs-root";
          modeBar = document.createElement("div"); modeBar.className = "cs-modes";
          MODES.forEach(function (m) { const b = document.createElement("button"); b.dataset.id = m.id; b.innerHTML = m.name + "<small>" + m.sub + "</small>"; on(b, "click", function () { setMode(m); }); modeBar.appendChild(b); });
          if (window.Arcade && Arcade.mpLobby) { raceBtn = document.createElement("button"); raceBtn.className = "cs-racebtn"; raceBtn.innerHTML = "👥 Race friends<small>same mode, live bars</small>"; on(raceBtn, "click", raceOpen); modeBar.appendChild(raceBtn); }
          pad = document.createElement("div"); pad.className = "cs-pad"; pad.tabIndex = 0;
          canvas = document.createElement("canvas"); g = canvas.getContext("2d"); pad.appendChild(canvas);
          big = document.createElement("div"); big.className = "cs-big"; big.textContent = "0";
          live = document.createElement("div"); live.className = "cs-live";
          pad.appendChild(big); pad.appendChild(live);
          sub = document.createElement("div"); sub.className = "cs-sub";
          result = document.createElement("div"); result.className = "cs-result";
          root.appendChild(modeBar); root.appendChild(pad); root.appendChild(sub); root.appendChild(result);
          stage.appendChild(root);

          on(pad, "pointerdown", function (e) { if (mode.kind !== "click") { pad.focus(); return; } e.preventDefault(); const r = pad.getBoundingClientRect(); hit(e.clientX - r.left, e.clientY - r.top); }, { passive: false });
          on(pad, "contextmenu", function (e) { e.preventDefault(); });
          on(pad, "wheel", function (e) { if (mode.kind !== "wheel") return; e.preventDefault(); const r = pad.getBoundingClientRect(); const n = Math.max(1, Math.min(3, Math.round(Math.abs(e.deltaY) / 100))); for (let i = 0; i < n; i++) hit(e.clientX - r.left, e.clientY - r.top); }, { passive: false });
          on(window, "keydown", function (e) { if (mode.kind !== "key" || e.repeat) return; if (e.code === "Space" || e.key === " ") { e.preventDefault(); e.stopImmediatePropagation(); const r = pad.getBoundingClientRect(); hit(r.width / 2 + (Math.random() - 0.5) * r.width * 0.5, r.height * 0.7); } }, true);
          on(window, "keyup", function (e) { if (mode.kind === "key" && (e.code === "Space" || e.key === " ")) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
          ctx.setScore(0);
          setMode(MODES[0]);
          raf = requestAnimationFrame(frame);
        },
        handleInput() { /* all input is wired directly on the pad (needs button/wheel/key details the intents don't carry) */ },
        tick() {},
        getScore() { return count; },
        teardown() {
          if (race) { try { Arcade.mpLobby.leave(); } catch (e) {} } raceEnd(); try { if (window.Arcade && Arcade.mpLobby) Arcade.mpLobby.close(); } catch (e) {}
          if (raf) cancelAnimationFrame(raf); raf = null;
          listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); }); listeners = [];
          if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
          stageEl = ctx = root = pad = canvas = g = null; ripples = [];
        }
      };
    }
  });
})();
