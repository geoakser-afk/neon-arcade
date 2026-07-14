/* Arcade.board — responsive board sizing. Replaces the old fixed 440px.
   Games call layout() to get cell/gap sizes in px derived from the live
   board pixel size, and register onResize to recompute. */
(function () {
  const listeners = new Set();
  let rafPending = false;

  function onResize(cb) { listeners.add(cb); return () => listeners.delete(cb); }
  function clear() { listeners.clear(); }

  /* Ideal square play size in CSS px. On desktop/ultrawide it stays modest and
     height-bound; on a narrow/portrait PHONE it uses almost the full width so
     boards aren't tiny. `max` = game's ceiling; `wideBias` = desktop width use. */
  function stageSize(max, wideBias) {
    max = max || 940;
    const w = window.innerWidth, h = window.innerHeight;
    const portrait = w < 720;                 // phone / narrow window
    if (portrait) {
      // fill the width (minus a small margin), capped by most of the height
      return Math.floor(Math.min(w * 0.94, h * 0.7, Math.max(max, 560)));
    }
    const wf = wideBias == null ? 0.62 : wideBias;
    return Math.floor(Math.min(w * wf, h * 0.84, max));
  }

  window.addEventListener("resize", () => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      listeners.forEach((cb) => { try { cb(); } catch (e) {} });
    });
  });

  /* Given a board element and grid dimensions, compute square cell size.
     gapRatio is gap-as-fraction-of-cell (default 0.12). Writes --cell and
     --gap CSS vars on the board so CSS + JS positioning stay in sync.
     Returns { cell, gap, size } in px. */
  function layout(boardEl, cols, rows, gapRatio) {
    rows = rows || cols;
    gapRatio = gapRatio == null ? 0.12 : gapRatio;
    const rect = boardEl.getBoundingClientRect();
    const padW = rect.width, padH = rect.height;
    // pad is one --gap on each side; solve cell so cols*cell + (cols+1)*gap = width
    // gap = cell*gapRatio  =>  cell*(cols + (cols+1)*gapRatio) = width
    const cellW = padW / (cols + (cols + 1) * gapRatio);
    const cellH = padH / (rows + (rows + 1) * gapRatio);
    const cell = Math.floor(Math.min(cellW, cellH));
    const gap = Math.max(2, Math.round(cell * gapRatio));
    boardEl.style.setProperty("--cell", cell + "px");
    boardEl.style.setProperty("--gap", gap + "px");
    return { cell, gap, size: rect.width };
  }

  // pixel top-left of a cell at (row, col) inside the padded board
  function cellPos(row, col, cell, gap) {
    return { x: gap + col * (cell + gap), y: gap + row * (cell + gap) };
  }

  window.Arcade.board = { layout, cellPos, onResize, clear, stageSize };
})();
