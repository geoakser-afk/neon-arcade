/* Arcade.touch — reusable on-screen controls for touch devices. Games opt in;
   on non-touch (desktop) these no-op so nothing changes there. Controls are
   plain DOM buttons layered over the stage; they route back to the game via
   the callbacks you pass. Auto-cleaned when the game tears down (shell clears
   the stage), but games should also call Arcade.touch.clear() in teardown. */
(function () {
  const isTouch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
  let host = null;   // container appended into the current stage

  function ensureHost(stage) {
    if (host && host.parentNode) return host;
    host = document.createElement("div");
    host.className = "touch-controls";
    stage.appendChild(host);
    return host;
  }

  function clear() {
    if (host && host.parentNode) host.parentNode.removeChild(host);
    host = null;
  }

  // A directional D-PAD (up/down/left/right). onDir(dir) fires on press.
  // opts.dirs = subset like ["left","right"] for side-only games (cascade).
  function dpad(stage, onDir, opts) {
    if (!isTouch) return;
    opts = opts || {};
    const dirs = opts.dirs || ["up", "down", "left", "right"];
    const h = ensureHost(stage);
    const pad = document.createElement("div");
    pad.className = "tc-dpad" + (dirs.length <= 2 ? " tc-dpad-row" : "");
    const glyph = { up: "▲", down: "▼", left: "◀", right: "▶" };
    dirs.forEach(function (d) {
      const btn = document.createElement("button");
      btn.className = "tc-btn tc-" + d;
      btn.textContent = glyph[d];
      const fire = function (e) { e.preventDefault(); e.stopPropagation(); onDir(d); };
      btn.addEventListener("pointerdown", fire);
      pad.appendChild(btn);
    });
    h.appendChild(pad);
    return pad;
  }

  // A single big ACTION button (for tap/flap/hold games that also want a clear
  // on-screen target). onDown/onUp fire on press/release (onUp optional — for
  // hold games like wave). Label defaults to a dot.
  function action(stage, onDown, onUp, label) {
    if (!isTouch) return;
    const h = ensureHost(stage);
    const btn = document.createElement("button");
    btn.className = "tc-action";
    btn.textContent = label || "";
    btn.addEventListener("pointerdown", function (e) { e.preventDefault(); e.stopPropagation(); if (onDown) onDown(); });
    if (onUp) btn.addEventListener("pointerup", function (e) { e.preventDefault(); e.stopPropagation(); onUp(); });
    h.appendChild(btn);
    return btn;
  }

  window.Arcade = window.Arcade || {};
  window.Arcade.touch = { isTouch: isTouch, dpad: dpad, action: action, clear: clear, host: function () { return host; } };
})();
