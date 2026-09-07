/* Arcade.perf — automatic "low effects" mode for machines without GPU acceleration.
   The arcade's look leans on canvas shadowBlur glows and CSS box-shadows. On a GPU
   they're free; on software rendering (old PCs, Chrome with acceleration off) they
   drop games to 5–8 fps. This watches the real frame rate while a game is running and,
   after ~3 s under 22 fps, switches to low-FX: every shadowBlur set by any game becomes
   0 (one property override on the canvas prototype — no game code changes) and CSS glows
   are removed. The choice is remembered in localStorage so the next visit starts fast.
   Arcade.perf.reset() (or the "FX" button the shell shows) turns full effects back on. */
(function () {
  const A = (window.Arcade = window.Arcade || {});
  const KEY = "neonarcade:lowfx";
  const proto = window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
  const desc = proto && Object.getOwnPropertyDescriptor(proto, "shadowBlur");
  let low = false, applied = false, auto = false;

  function apply() {
    if (applied || !desc) return;
    applied = true;
    Object.defineProperty(proto, "shadowBlur", {
      configurable: true,
      get: function () { return desc.get.call(this); },
      set: function () { desc.set.call(this, 0); }
    });
    document.documentElement.classList.add("lowfx");
  }
  function unapply() {
    if (!applied || !desc) return;
    applied = false;
    Object.defineProperty(proto, "shadowBlur", desc);
    document.documentElement.classList.remove("lowfx");
  }
  function setLow(v, why) {
    low = !!v;
    try { if (low) localStorage.setItem(KEY, "1"); else localStorage.removeItem(KEY); } catch (e) {}
    if (low) apply(); else unapply();
    if (why) console.info("[arcade] low-FX " + (low ? "ON" : "OFF") + " (" + why + ")");
    document.dispatchEvent(new CustomEvent("arcade:lowfx", { detail: { low: low, auto: auto } }));
  }
  try { if (localStorage.getItem(KEY) === "1") setLow(true, "remembered"); } catch (e) {}

  // frame-rate watchdog: only judges while a game is mounted (the hub is static and always "fast")
  let frames = 0, t0 = performance.now(), slowSecs = 0;
  function tick(t) {
    frames++;
    if (t - t0 >= 1000) {
      const fps = frames * 1000 / (t - t0); frames = 0; t0 = t;
      const inGame = !!(A.shell && A.shell.current && A.shell.current());
      if (document.visibilityState === "visible" && inGame && !low) {
        if (fps < 22) slowSecs++; else slowSecs = 0;
        if (slowSecs >= 3) { auto = true; setLow(true, Math.round(fps) + " fps"); }
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  A.perf = {
    isLow: function () { return low; },
    wasAuto: function () { return auto; },
    setLow: function (v) { auto = false; setLow(v, "manual"); },
    reset: function () { auto = false; setLow(false, "reset"); }
  };
})();
