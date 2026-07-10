/* Arcade.timer — the hybrid break timer, the product's soul.
   One shell-owned 1s loop. Two coexisting modes:
     - global:  set once at the hub, counts across ALL games, locks the
                whole arcade at zero.
     - per-game: each game may set its own fuse; ends only that game.
   Both can run at once; effective time = min(global, game).

   Fuse options include sub-minute "quick hit" lengths (30s, 1m) for a
   fast dopamine hit then back to work. Only prefs persist — never the
   live countdown, so the arcade always opens fresh. */
(function () {
  const store = window.Arcade.storage;
  const audio = window.Arcade.audio;

  // seconds. label = short display, note = tiny subcaption
  const FUSES = [
    { s: 30, label: "30s", note: "quick hit" },
    { s: 60, label: "1", note: "one min" },
    { s: 300, label: "5", note: "quick" },
    { s: 600, label: "10", note: "standard" },
    { s: 900, label: "15", note: "snack run" },
    { s: 1200, label: "20", note: "max" }
  ];

  const state = {
    mode: "none",        // 'global' | 'none' (per-game is tracked separately)
    globalRemaining: 0,
    gameRemaining: null, // null = current game has no per-game fuse
    locked: false,       // hard stop (global hit zero)
    running: false
  };

  let loopId = null;
  const subs = new Set(); // callbacks({globalRemaining, gameRemaining, effective, low, locked})

  function subscribe(cb) { subs.add(cb); return () => subs.delete(cb); }

  function effective() {
    const vals = [];
    if (state.mode === "global") vals.push(state.globalRemaining);
    if (state.gameRemaining != null) vals.push(state.gameRemaining);
    if (!vals.length) return null;
    return Math.min.apply(null, vals);
  }

  // whichever active counter is running determines "how it started"
  function isSubMinute() {
    const e = effective();
    return e != null && startedSub;
  }
  let startedSub = false; // was the binding fuse < 60s when it began

  function notify(extra) {
    const eff = effective();
    const info = {
      globalRemaining: state.mode === "global" ? state.globalRemaining : null,
      gameRemaining: state.gameRemaining,
      effective: eff,
      low: eff != null && !startedSub && eff <= 60,
      subMinute: startedSub,
      locked: state.locked,
      timedOut: !!(extra && extra.timedOut),
      scope: extra && extra.scope
    };
    subs.forEach((cb) => { try { cb(info); } catch (e) {} });
  }

  function loop() {
    loopId = setTimeout(loop, 1000);
    if (!state.running || state.locked) return;

    let tickGlobalZero = false;
    let tickGameZero = false;

    if (state.mode === "global") {
      state.globalRemaining--;
      if (state.globalRemaining <= 0) { state.globalRemaining = 0; tickGlobalZero = true; }
    }
    if (state.gameRemaining != null) {
      state.gameRemaining--;
      if (state.gameRemaining <= 0) { state.gameRemaining = 0; tickGameZero = true; }
    }

    // soft audible tick in the final 5s of a sub-minute fuse
    const eff = effective();
    if (startedSub && eff != null && eff <= 5 && eff > 0) audio.tick();

    if (tickGlobalZero) {
      state.locked = true;
      audio.breakOver();
      notify({ timedOut: true, scope: "global" });
      return;
    }
    if (tickGameZero) {
      // per-game fuse ended: signal, but arcade stays open
      state.gameRemaining = null;
      audio.breakOver();
      notify({ timedOut: true, scope: "game" });
      return;
    }
    notify();
  }

  function ensureLoop() { if (loopId == null) loop(); }

  // ---- public API ----
  function setGlobal(seconds) {
    state.mode = "global";
    state.globalRemaining = seconds;
    state.locked = false;
    state.running = true;
    startedSub = seconds < 60;
    ensureLoop();
    notify();
  }
  function noGlobal() {
    state.mode = "none";
    state.globalRemaining = 0;
    state.running = true; // still running to drive per-game fuses
    ensureLoop();
    notify();
  }
  function setGameFuse(seconds) {
    state.gameRemaining = seconds;
    if (seconds != null && seconds < 60 && state.mode !== "global") startedSub = true;
    else if (state.mode !== "global") startedSub = false;
    notify();
  }
  function clearGameFuse() { state.gameRemaining = null; notify(); }

  function isLocked() { return state.locked; }
  function hasGlobal() { return state.mode === "global"; }

  function reset() {
    if (loopId != null) { clearTimeout(loopId); loopId = null; }
    state.mode = "none"; state.globalRemaining = 0; state.gameRemaining = null;
    state.locked = false; state.running = false; startedSub = false;
  }

  function format(sec) {
    if (sec == null) return "∞";
    const m = Math.floor(sec / 60), s = sec % 60;
    return m + ":" + String(s).padStart(2, "0");
  }

  window.Arcade.timer = {
    FUSES, subscribe, setGlobal, noGlobal, setGameFuse, clearGameFuse,
    isLocked, hasGlobal, reset, format, effective,
    lastFuse: () => store.get("pref:lastFuse", 600),
    rememberFuse: (s) => store.set("pref:lastFuse", s)
  };
})();
