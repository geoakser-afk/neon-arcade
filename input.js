/* Arcade.input — normalizes keyboard / pointer / touch into semantic
   intents forwarded to the current game's handleInput(intent):
     { type:'dir',   dir:'up|down|left|right' }
     { type:'action' }                              // click / space / tap
     { type:'hold', down:true|false }               // press-and-HOLD (wave): true on press, false on release
     { type:'point', x, y, phase:'down|move|up', el, button }  // board-normalized
   Global keys (Esc=back, M=mute) are intercepted by the shell before
   games ever see them. The shell drops all intents while locked/paused. */
(function () {
  let handler = null;   // current game's handleInput
  let stageEl = null;
  let pointerTarget = null; // element pointer coords are normalized against

  const KEYMAP = {
    arrowup: "up", w: "up", arrowdown: "down", s: "down",
    arrowleft: "left", a: "left", arrowright: "right", d: "right"
  };

  function setHandler(fn) { handler = fn; }
  function clearHandler() { handler = null; pointerTarget = null; }
  function setStage(el) { stageEl = el; }
  function setPointerTarget(el) { pointerTarget = el; }

  function emit(intent) { if (handler) handler(intent); }

  // ---- keyboard ----
  let keyHeld = false;   // tracks a physical space/enter hold (ignores auto-repeat)
  document.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    // shell-global keys handled elsewhere (shell.js listens for Escape / m)
    if (k === "escape" || k === "m") return;
    if (!handler) return;
    if (KEYMAP[k]) { e.preventDefault(); emit({ type: "dir", dir: KEYMAP[k] }); return; }
    if (k === " " || k === "enter") {
      e.preventDefault();
      emit({ type: "action" });                     // tap games (glide/orbit/bloom/ripple)
      if (!keyHeld) { keyHeld = true; emit({ type: "hold", down: true }); }  // hold games (wave)
    }
  });
  document.addEventListener("keyup", (e) => {
    const k = e.key.toLowerCase();
    if ((k === " " || k === "enter") && keyHeld) { keyHeld = false; if (handler) emit({ type: "hold", down: false }); }
  });

  // ---- pointer (mouse + touch via Pointer Events) ----
  function norm(e) {
    const el = pointerTarget || stageEl;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return {
      x: (e.clientX - r.left),
      y: (e.clientY - r.top),
      nx: (e.clientX - r.left) / r.width,
      ny: (e.clientY - r.top) / r.height
    };
  }

  // swipe detection for directional games on touch
  let downPt = null;
  const SWIPE = 24;

  document.addEventListener("pointerdown", (e) => {
    if (!handler || !stageEl) return;
    const p = norm(e);
    downPt = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    emit({ type: "point", phase: "down", button: e.button, el: e.target, x: p.x, y: p.y, nx: p.nx, ny: p.ny });
    if (e.button === 0) emit({ type: "hold", down: true });   // hold games (wave)
  });
  document.addEventListener("pointermove", (e) => {
    if (!handler || !stageEl) return;
    if (e.buttons === 0 && !downPt) {
      // hover-move still useful for paddle games (mouse follow)
      const p = norm(e);
      emit({ type: "point", phase: "move", button: -1, el: e.target, x: p.x, y: p.y, nx: p.nx, ny: p.ny });
      return;
    }
    const p = norm(e);
    emit({ type: "point", phase: "move", button: e.button, el: e.target, x: p.x, y: p.y, nx: p.nx, ny: p.ny });
  });
  document.addEventListener("pointerup", (e) => {
    if (!handler || !stageEl) return;
    const p = norm(e);
    emit({ type: "point", phase: "up", button: e.button, el: e.target, x: p.x, y: p.y, nx: p.nx, ny: p.ny });
    if (e.button === 0) emit({ type: "hold", down: false });  // hold games (wave)
    // swipe -> dir intent
    if (downPt) {
      const dx = e.clientX - downPt.x, dy = e.clientY - downPt.y;
      if (Math.abs(dx) > SWIPE || Math.abs(dy) > SWIPE) {
        const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
        emit({ type: "dir", dir });
      }
      downPt = null;
    }
  });

  window.Arcade.input = { setHandler, clearHandler, setStage, setPointerTarget };
})();
