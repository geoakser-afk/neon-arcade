/* Arcade.ui — small DOM helpers + overlay/screen system shared by the
   shell and games. Games get overlays via ctx.onGameOver; they don't
   build their own chrome. */
(function () {
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  // Build an overlay inside a container. Returns { root, show, hide, setContent }.
  function overlay(container) {
    const root = el("div", "overlay");
    container.appendChild(root);
    return {
      root,
      show() { root.classList.add("show"); },
      hide() { root.classList.remove("show"); },
      html(h) { root.innerHTML = h; return root; }
    };
  }

  // A fuse picker widget. onPick(seconds) fires when a fuse button clicked.
  // Returns the row element; caller inserts it. Includes selection state.
  function fusePicker(fuses, selected, onSelect) {
    const row = el("div", "fuse-row");
    let sel = selected;
    fuses.forEach((f) => {
      const b = el("button", "fuse-btn" + (f.s === sel ? " sel" : ""),
        f.label + "<small>" + f.note + "</small>");
      b.onclick = () => {
        sel = f.s;
        row.querySelectorAll(".fuse-btn").forEach((x) => x.classList.remove("sel"));
        b.classList.add("sel");
        if (onSelect) onSelect(f.s);
      };
      row.appendChild(b);
    });
    row.getSelected = () => sel;
    return row;
  }

  // flash the "time's up" bloom over a stage element
  function flash(stageEl) {
    const f = el("div", "stage-flash");
    stageEl.appendChild(f);
    // force reflow then animate
    void f.offsetWidth;
    f.classList.add("go");
    setTimeout(() => { if (f.parentNode) f.parentNode.removeChild(f); }, 800);
  }

  window.Arcade.ui = { el, clear, overlay, fusePicker, flash };
})();
