/* Arcade shell — bootstrap, hub<->game router, lifecycle glue.
   Owns the HUD, the break timer wiring, high-score persistence, and the
   overlays. Games are dumb renderers driven through the contract. */
(function () {
  const A = window.Arcade;
  const { el, clear, overlay, fusePicker, flash } = A.ui;
  const audio = A.audio, timer = A.timer, input = A.input, board = A.board, storage = A.storage;
  const music = A.music;

  // ---- DOM refs ----
  const app = document.getElementById("app");
  let hud, brandEl, backBtn, scoreStat, scoreVal, scoreLabel, timerStat, timerVal, muteBtn, secondaryTimer;
  let musicBtn, shuffleBtn;
  let stage;

  // ---- runtime state ----
  let current = null;      // { def, inst, ctx }
  let sessionStarted = false;
  let kidMode = false;     // Chris's Games: picture-only hub, free play, kid games only
  let timerUnsub = null;
  let wasLow = false;      // edge-trigger for the "going red" alert

  function build() {
    // HUD
    hud = el("div", "hud");
    const left = el("div", "hud-left");
    backBtn = el("button", "back-btn hidden", "‹ Arcade");
    backBtn.onclick = toHub;
    brandEl = el("div", "brand", 'NEON <span>ARCADE</span>');
    left.appendChild(backBtn); left.appendChild(brandEl);

    const right = el("div", "hud-right");
    scoreStat = el("div", "stat");
    scoreStat.innerHTML = '<div class="label" id="scLabel">Score</div><div class="val" id="scVal">0</div>';
    timerStat = el("div", "stat timer");
    timerStat.innerHTML = '<div class="label">Break</div><div class="val" id="tmVal">∞</div>';
    secondaryTimer = el("div", "stat");
    secondaryTimer.style.display = "none";
    secondaryTimer.innerHTML = '<div class="label" id="secLabel">Game</div><div class="val" id="secVal">--</div>';
    musicBtn = el("button", "icon-btn", music.isEnabled() ? "🎵" : "🎶");
    musicBtn.classList.toggle("off", !music.isEnabled());
    musicBtn.title = "background music";
    musicBtn.onclick = toggleMusic;
    shuffleBtn = el("button", "icon-btn", "🔀");
    shuffleBtn.title = "shuffle track";
    shuffleBtn.onclick = shuffleMusic;
    muteBtn = el("button", "icon-btn", audio.muted ? "🔇" : "🔈");
    muteBtn.title = "mute sound effects (M)";
    muteBtn.onclick = toggleMute;
    // FX toggle: low-effects mode for slow machines (auto-enabled by shell/perf.js when a game runs under ~22 fps)
    const fxBtn = el("button", "icon-btn", "✨");
    const fxSync = () => { const low = A.perf && A.perf.isLow(); fxBtn.textContent = low ? "🐢" : "✨"; fxBtn.title = low ? "Low effects ON (glows off for speed) — click for full effects" : "Full effects — click to turn glows off (faster on slow PCs)"; fxBtn.classList.toggle("on", !!low); };
    fxBtn.onclick = () => { if (A.perf) A.perf.setLow(!A.perf.isLow()); fxSync(); };
    document.addEventListener("arcade:lowfx", fxSync); fxSync();

    right.appendChild(secondaryTimer);
    right.appendChild(scoreStat);
    right.appendChild(timerStat);
    right.appendChild(shuffleBtn);
    right.appendChild(musicBtn);
    right.appendChild(fxBtn);
    right.appendChild(muteBtn);

    hud.appendChild(left); hud.appendChild(right);
    app.appendChild(hud);

    stage = el("div"); stage.id = "stage";
    app.appendChild(stage);

    scoreVal = document.getElementById("scVal");
    scoreLabel = document.getElementById("scLabel");
    timerVal = document.getElementById("tmVal");
    input.setStage(stage);

    // global keys
    document.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (k === "escape" && current) { e.preventDefault(); toHub(); }
      else if (k === "m") { e.preventDefault(); toggleMute(); }
    });

    // timer HUD wiring
    timerUnsub = timer.subscribe(onTimer);
  }

  function toggleMute() {
    const m = audio.toggleMute();
    muteBtn.innerHTML = m ? "🔇" : "🔈";
  }

  function toggleMusic() {
    const on = music.toggle();
    musicBtn.innerHTML = on ? "🎵" : "🎶";
    musicBtn.classList.toggle("off", !on);
    syncMusicUI();
  }

  function shuffleMusic() {
    music.shuffle();
    if (!music.isEnabled()) toggleMusic(); // shuffling turns it on
    else syncMusicUI();
  }

  // keep any on-screen music toggles (HUD + session screen) in agreement
  let sessionMusicSync = null;
  function syncMusicUI() {
    const on = music.isEnabled();
    if (musicBtn) { musicBtn.innerHTML = on ? "🎵" : "🎶"; musicBtn.classList.toggle("off", !on); }
    if (sessionMusicSync) sessionMusicSync(on, music.currentName());
  }

  function onTimer(info) {
    // primary readout = binding (effective) time
    timerVal.textContent = timer.format(info.effective);
    timerStat.classList.toggle("low", !!info.low);

    // the moment it crosses into the red: obvious sound + a one-shot
    // expand / red-glow / shake that settles back fluidly.
    if (info.low && !wasLow) {
      audio.warn();
      timerStat.classList.remove("alarm");
      void timerStat.offsetWidth; // restart the animation
      timerStat.classList.add("alarm");
    }
    wasLow = !!info.low;

    // secondary readout: if both global + game fuses active, show the other
    if (info.globalRemaining != null && info.gameRemaining != null) {
      secondaryTimer.style.display = "";
      document.getElementById("secLabel").textContent = "Game";
      document.getElementById("secVal").textContent = timer.format(info.gameRemaining);
      timerStat.querySelector(".label").textContent = "Session";
    } else {
      secondaryTimer.style.display = "none";
      timerStat.querySelector(".label").textContent = info.globalRemaining != null ? "Session" : "Break";
    }

    if (info.timedOut) {
      if (info.subMinute) flash(stage);
      if (info.scope === "global") lockArcade();
      else if (info.scope === "game" && current) endCurrentGame({ title: "Time's up.", msg: "Round done. Back to work — or run it again." });
    }
  }

  // ---- session start overlay (hub) ----
  function showSessionSetup() {
    const ov = overlay(stage);
    const wrap = el("div");
    wrap.appendChild(el("h2", null, "Set a break fuse?"));
    wrap.appendChild(el("p", null, "A session fuse counts down across every game and hard-stops the whole arcade at zero. Or skip it and just time individual games."));
    const picker = fusePicker(timer.FUSES, timer.lastFuse(), null);
    wrap.appendChild(picker);

    // ---- music controls on the break-select screen ----
    const musicRow = el("div", "music-row");
    const mToggle = el("button", "music-toggle", "");
    const mShuffle = el("button", "music-shuffle", "🔀 Shuffle");
    function paintSession(on, name) {
      mToggle.innerHTML = (on ? "🎵 Music: On" : "🎶 Music: Off") +
        (on ? ' <span class="trk">' + name + "</span>" : "");
      mToggle.classList.toggle("on", on);
    }
    paintSession(music.isEnabled(), music.currentName());
    sessionMusicSync = paintSession;         // let HUD toggles update this too
    mToggle.onclick = () => { audio.unlock(); toggleMusic(); };
    mShuffle.onclick = () => { audio.unlock(); shuffleMusic(); };
    musicRow.appendChild(mToggle);
    musicRow.appendChild(mShuffle);
    wrap.appendChild(musicRow);

    const row = el("div", "btn-row");
    const go = el("button", "btn", "Start session");
    const skip = el("button", "btn ghost", "No limit — free play");
    row.appendChild(go); row.appendChild(skip);
    wrap.appendChild(row);
    ov.root.appendChild(wrap);
    ov.show();

    const finish = () => { sessionMusicSync = null; ov.root.remove(); };
    go.onclick = () => {
      audio.unlock(); music.resumeIfEnabled();
      const s = picker.getSelected();
      timer.rememberFuse(s);
      timer.setGlobal(s);
      audio.start();
      sessionStarted = true;
      finish();
    };
    skip.onclick = () => {
      audio.unlock(); music.resumeIfEnabled();
      timer.noGlobal();
      sessionStarted = true;
      finish();
    };
  }

  // ---- hub ----
  function toHub() {
    if (current) teardownCurrent();
    input.clearHandler();
    board.clear();
    backBtn.classList.add("hidden");
    scoreStat.style.display = "none";
    if (kidMode) { setAccent("#ffb86b"); renderKidHub(); return; }
    setAccent("#6bb8f0");
    renderHub();
    if (!sessionStarted) showSessionSetup();
  }

  // ---- Kids Games (kid mode; for Christopher, 5) ----
  function enterKidMode() {
    audio.unlock();
    kidMode = true;
    sessionStarted = true;           // free play — never show the fuse prompt to a 5-year-old
    timer.noGlobal();
    document.body.classList.add("kid");
    try { if (location.hash !== "#kids" && location.hash !== "#chris") history.replaceState(null, "", "#kids"); } catch (e) {}
    audio.arp([523, 659, 784, 1046], { dur: 0.16, step: 0.07, vol: 0.14, type: "sine" });
    toHub();
  }
  function exitKidMode() {
    kidMode = false;
    document.body.classList.remove("kid");
    try { if (location.hash) history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    toHub();
  }
  // draw a game's picture icon into a canvas (games provide kidIcon(g, size))
  function kidIconCanvas(g, size) {
    const c = document.createElement("canvas");
    c.width = c.height = Math.round(size * (window.devicePixelRatio || 1));
    c.style.width = c.style.height = size + "px";
    const cx = c.getContext("2d");
    cx.setTransform(c.width / size, 0, 0, c.width / size, 0, 0);
    try { if (g.kidIcon) g.kidIcon(cx, size); } catch (e) { console.error(e); }
    return c;
  }
  function kidGames() {
    return A.games.filter((g) => g.kid || g.kidOpts);
  }
  function renderKidHub() {
    clear(stage);
    const hub = el("div", "kid-hub");
    const top = el("div", "kid-top");
    const home = el("button", "kid-home", "");
    home.title = "back to the grown-up arcade";
    home.appendChild(kidIconCanvas({ kidIcon: drawHomeIcon }, 44));
    home.onclick = exitKidMode;
    const title = el("div", "kid-title", "Kids Games");
    top.appendChild(home); top.appendChild(title);
    hub.appendChild(top);
    const grid = el("div", "kid-grid");
    kidGames().forEach((g) => {
      const card = el("button", "kid-card");
      card.style.setProperty("--card-accent", g.kidAccent || g.accent);
      card.appendChild(kidIconCanvas(g, 200));
      const lab = el("div", "kid-label", g.kidName || g.name.replace(/\*/g, ""));
      card.appendChild(lab);
      card.onclick = () => { audio.unlock(); audio.tone(660, 0.1, { type: "sine", vol: 0.1, glide: 990 }); launch(g.id, g.kidOpts); };
      grid.appendChild(card);
    });
    hub.appendChild(grid);
    stage.appendChild(hub);
  }
  function drawHomeIcon(g, s) {
    g.fillStyle = "#ffffff";
    g.beginPath(); g.moveTo(s * 0.5, s * 0.12); g.lineTo(s * 0.9, s * 0.48); g.lineTo(s * 0.78, s * 0.48); g.lineTo(s * 0.78, s * 0.88); g.lineTo(s * 0.22, s * 0.88); g.lineTo(s * 0.22, s * 0.48); g.lineTo(s * 0.1, s * 0.48); g.closePath(); g.fill();
    g.fillStyle = "#ffb86b"; g.fillRect(s * 0.42, s * 0.6, s * 0.16, s * 0.28);
  }
  function drawChrisIcon(g, s) {
    // big happy star face — the "Chris's Games" button picture
    g.save();
    g.translate(s / 2, s / 2);
    g.shadowColor = "rgba(255,211,107,0.8)"; g.shadowBlur = s * 0.12;
    const gr = g.createRadialGradient(-s * 0.1, -s * 0.12, s * 0.05, 0, 0, s * 0.45);
    gr.addColorStop(0, "#fff3b0"); gr.addColorStop(1, "#ffb84a");
    g.fillStyle = gr;
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? s * 0.2 : s * 0.44; i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    g.closePath(); g.fill(); g.shadowBlur = 0;
    g.fillStyle = "#3a2a20";
    [-1, 1].forEach((d) => { g.beginPath(); g.ellipse(d * s * 0.09, -s * 0.02, s * 0.035, s * 0.045, 0, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = "#fff"; [-1, 1].forEach((d) => { g.beginPath(); g.arc(d * s * 0.09 - s * 0.012, -s * 0.035, s * 0.013, 0, Math.PI * 2); g.fill(); });
    g.strokeStyle = "#3a2a20"; g.lineWidth = s * 0.02; g.lineCap = "round";
    g.beginPath(); g.arc(0, s * 0.05, s * 0.07, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    g.fillStyle = "rgba(255,110,140,0.35)"; [-1, 1].forEach((d) => { g.beginPath(); g.ellipse(d * s * 0.15, s * 0.06, s * 0.04, s * 0.025, 0, 0, Math.PI * 2); g.fill(); });
    g.restore();
  }

  function renderHub() {
    clear(stage);
    const hub = el("div", "hub");
    const title = el("div", "hub-title");
    title.innerHTML = "<h1>Pick your break</h1><p>Simple games, calm neon, hard stop when the timer's up.</p>";
    hub.appendChild(title);

    // search bar — find a game by name/tagline/controls
    const search = el("div", "hub-search");
    search.innerHTML =
      '<span class="mag">🔍</span>' +
      '<input type="text" placeholder="Search games…" spellcheck="false" autocomplete="off">' +
      '<button class="clear" title="clear">✕</button>';
    const input = search.querySelector("input");
    const clearBtn = search.querySelector(".clear");
    hub.appendChild(search);

    // Chris's Games — one big picture button that opens the kid hub
    const kidBtn = el("button", "kid-entry");
    kidBtn.appendChild(kidIconCanvas({ kidIcon: drawChrisIcon }, 84));
    const kidTxt = el("div", "kid-entry-text");
    kidTxt.innerHTML = "<b>Kids Games</b><span>" + kidGames().length + " games · big pictures · no losing · made for little hands</span>";
    kidBtn.appendChild(kidTxt);
    kidBtn.onclick = enterKidMode;
    hub.appendChild(kidBtn);

    // pinned games sit up top, bigger and centered
    const pinnedGrid = el("div", "hub-grid pinned");
    hub.appendChild(pinnedGrid);
    const grid = el("div", "hub-grid");
    hub.appendChild(grid);
    const empty = el("div", "hub-empty", "No games match that. Try another word.");
    empty.style.display = "none";
    hub.appendChild(empty);

    const pins = new Set(storage.get("pref:pins", []));
    function savePins() { storage.set("pref:pins", Array.from(pins)); }

    // build one game card (used in both grids). `big` = pinned styling.
    function makeCard(g, big) {
      const card = el("div", "card" + (big ? " big" : ""));
      card.style.setProperty("--card-accent", g.accent);
      const best = storage.game(g.id).best();
      const nameHtml = g.name.replace(/\*(.+?)\*/g, "<b>$1</b>");
      const pinned = pins.has(g.id);
      card.innerHTML =
        '<button class="pin' + (pinned ? " on" : "") + '" title="' +
          (pinned ? "unpin" : "pin — keep it up top") + '">' + (pinned ? "★" : "☆") + "</button>" +
        '<div class="dot"></div>' +
        "<h3>" + nameHtml + "</h3>" +
        '<div class="tag">' + g.tagline + "</div>" +
        '<div class="foot"><span>' + g.controls + "</span>" +
        (best ? '<span class="best">best ' + best + "</span>" : "<span></span>") + "</div>";
      card.onclick = () => launch(g.id);
      const pinBtn = card.querySelector(".pin");
      pinBtn.onclick = (e) => {
        e.stopPropagation();                 // don't launch when toggling the star
        if (pins.has(g.id)) pins.delete(g.id); else pins.add(g.id);
        savePins();
        build(input.value);                  // re-render both grids
      };
      return card;
    }

    function build(q) {
      clear(pinnedGrid); clear(grid);
      const needle = (q || "").trim().toLowerCase();
      let shown = 0;
      A.games.forEach((g) => {
        if (g.kid) return;                   // kid-only games live in Chris's hub
        const hay = (g.name + " " + g.tagline + " " + g.controls + " " + g.id)
          .replace(/\*/g, "").toLowerCase();
        if (needle && hay.indexOf(needle) === -1) return;
        shown++;
        const isPinned = pins.has(g.id);
        (isPinned ? pinnedGrid : grid).appendChild(makeCard(g, isPinned));
      });
      pinnedGrid.style.display = pinnedGrid.children.length ? "" : "none";
      empty.style.display = shown ? "none" : "";
      clearBtn.classList.toggle("show", !!needle);
    }

    input.addEventListener("input", () => build(input.value));
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();                 // don't let global keys hijack typing
      if (e.key === "Escape") { input.value = ""; build(""); input.blur(); }
      else if (e.key === "Enter") {         // Enter launches the first match
        const first = grid.querySelector(".card");
        if (first) first.click();
      }
    });
    clearBtn.onclick = () => { input.value = ""; build(""); input.focus(); };

    build("");

    // ---- ad-ready slot (dormant until an ad script is added) ----
    // A clean, reserved container at the bottom of the hub. It renders nothing
    // visible until window.ARCADE_ADS is turned on (see how-to in the code), so
    // there's zero clutter now — just a labelled home for a future AdSense unit.
    const adSlot = el("div", "ad-slot");
    adSlot.setAttribute("data-ad-slot", "hub-bottom");
    if (window.ARCADE_ADS) adSlot.classList.add("live");   // flip on when ads go live
    hub.appendChild(adSlot);

    stage.appendChild(hub);
  }

  function setAccent(color) {
    stage.style.setProperty("--accent", color);
    // tint the ambient field to match the current game (with two derived
    // companion hues so the side space reads as a living neon environment)
    const root = document.documentElement.style;
    root.setProperty("--amb", color);
    root.setProperty("--amb2", shiftHue(color, 40));
    root.setProperty("--amb3", shiftHue(color, -55));
  }

  // rotate a hex color's hue by `deg` degrees for companion ambient tones
  function shiftHue(hex, deg) {
    const h = hex.replace("#", "");
    const n = parseInt(h.length === 3 ? h.split("").map(x => x + x).join("") : h, 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let hh = 0, s = mx === 0 ? 0 : d / mx, v = mx;
    if (d) {
      if (mx === r) hh = ((g - b) / d) % 6;
      else if (mx === g) hh = (b - r) / d + 2;
      else hh = (r - g) / d + 4;
      hh *= 60; if (hh < 0) hh += 360;
    }
    hh = (hh + deg + 360) % 360;
    const c = v * s, x = c * (1 - Math.abs((hh / 60) % 2 - 1)), m = v - c;
    let rr = 0, gg = 0, bb = 0;
    if (hh < 60) { rr = c; gg = x; }
    else if (hh < 120) { rr = x; gg = c; }
    else if (hh < 180) { gg = c; bb = x; }
    else if (hh < 240) { gg = x; bb = c; }
    else if (hh < 300) { rr = x; bb = c; }
    else { rr = c; bb = x; }
    const to = (v2) => Math.round((v2 + m) * 255).toString(16).padStart(2, "0");
    return "#" + to(rr) + to(gg) + to(bb);
  }

  // ---- launch a game ----
  function launch(id, opts) {
    const def = A.gameById(id);
    if (!def) return;
    if (current) teardownCurrent();
    launchOpts = opts || null;

    audio.unlock();
    clear(stage);
    setAccent(def.accent);
    backBtn.classList.remove("hidden");
    scoreStat.style.display = "";
    scoreLabel.textContent = def.scoreLabel;
    scoreVal.textContent = "0";

    const inst = def.create();
    const ctx = makeCtx(def, inst);
    current = { def, inst, ctx };

    input.setPointerTarget(stage);
    inst.mount(stage, ctx);

    // route input, dropping everything while locked
    input.setHandler((intent) => {
      if (timer.isLocked()) return;
      if (inst.handleInput) inst.handleInput(intent);
    });

    // per-frame tick if the game wants one
    if (inst.tick) startRaf(inst);
  }

  let rafId = null, lastT = 0, launchOpts = null;
  function startRaf(inst) {
    stopRaf();
    lastT = 0;
    const step = (t) => {
      rafId = requestAnimationFrame(step);
      if (!lastT) lastT = t;
      const dt = Math.min(50, t - lastT); lastT = t;
      if (timer.isLocked()) return;
      try { inst.tick(dt); } catch (e) { console.error(e); }
    };
    rafId = requestAnimationFrame(step);
  }
  function stopRaf() { if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; } }

  function makeCtx(def, inst) {
    return {
      audio: audio,
      accent: def.accent,
      opts: launchOpts || {},      // launch options (e.g. Chris's hub opens Squish straight into Chill)
      board: board,
      storage: storage.game(def.id),
      // game reports its running score to the HUD
      setScore(n) { scoreVal.textContent = n; },
      // game signals it ended
      onGameOver(finalScore, opts) {
        opts = opts || {};
        const isBest = storage.game(def.id).recordScore(finalScore || 0);
        endCurrentGame({
          title: opts.title || "Round over.",
          msg: (opts.msg || (def.scoreLabel + ": " + (finalScore || 0))) +
               (isBest ? "  — new best!" : ""),
          allowReplay: true
        });
      },
      // let a game offer a per-game fuse start (optional)
      setGameFuse(seconds) { timer.setGameFuse(seconds); },
      clearGameFuse() { timer.clearGameFuse(); }
    };
  }

  function endCurrentGame(opts) {
    stopRaf();
    input.setHandler(null); // stop feeding the game
    const ov = overlay(stage);
    const wrap = el("div");
    wrap.appendChild(el("h2", null, opts.title));
    wrap.appendChild(el("p", null, opts.msg || ""));
    const row = el("div", "btn-row");
    if (opts.allowReplay && !timer.isLocked()) {
      const again = el("button", "btn", "Play again");
      again.onclick = () => { const id = current.def.id; ov.root.remove(); launch(id); };
      row.appendChild(again);
    }
    const hubBtn = el("button", "btn ghost", "Back to arcade");
    hubBtn.onclick = () => { ov.root.remove(); toHub(); };
    if (!timer.isLocked()) { row.appendChild(hubBtn); wrap.appendChild(row); }
    ov.root.appendChild(wrap);
    ov.show();
    audio.gameOver();
  }

  function lockArcade() {
    stopRaf();
    input.setHandler(null);
    if (current && current.inst.pause) { try { current.inst.pause(); } catch (e) {} }
    const ov = overlay(stage);
    const wrap = el("div");
    wrap.appendChild(el("h2", null, "Break's over."));
    wrap.appendChild(el("p", null, "That's the fuse. You spent the wait building nothing dumb — go see what your agent shipped."));
    wrap.appendChild(el("div", "sub", "Closing…"));
    ov.root.appendChild(wrap);
    ov.show();
    // when the fuse ends, close the tab. Browsers only allow window.close() on
    // script-opened windows, so try a few variants; if the browser refuses
    // (a normal user-opened tab), fall back to a clear "close this tab" note.
    setTimeout(function () {
      try { window.open("", "_self"); } catch (e) {}   // mark as script-closable
      try { window.close(); } catch (e) {}
      // if the browser refused to close (normal user-opened tab), say so clearly
      setTimeout(function () {
        const sub = ov.root.querySelector(".sub");
        if (sub) sub.textContent = "Break's done — you can close this tab now.";
      }, 500);
    }, 1600);
  }

  function teardownCurrent() {
    stopRaf();
    input.setHandler(null);
    if (current && current.inst.teardown) { try { current.inst.teardown(); } catch (e) {} }
    current = null;
  }

  // ---- boot ----
  function boot() {
    build();
    if (location.hash === "#kids" || location.hash === "#chris") { kidMode = true; sessionStarted = true; timer.noGlobal(); document.body.classList.add("kid"); }
    toHub();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  A.shell = { toHub, launch, enterKidMode, exitKidMode, current: () => current };
})();
