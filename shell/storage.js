/* Arcade.storage — thin localStorage wrapper (works over file://).
   Namespaces per-game data so games can't collide. Fails soft if
   localStorage is unavailable (private mode, etc.). */
(function () {
  const PREFIX = "neonarcade:";
  let mem = {}; // in-memory fallback

  function raw(key) { return PREFIX + key; }
  function ok() {
    try { const k = raw("__t"); localStorage.setItem(k, "1"); localStorage.removeItem(k); return true; }
    catch (e) { return false; }
  }
  const usable = ok();

  function get(key, fallback) {
    try {
      const v = usable ? localStorage.getItem(raw(key)) : mem[key];
      if (v == null) return fallback;
      return JSON.parse(v);
    } catch (e) { return fallback; }
  }
  function set(key, val) {
    const s = JSON.stringify(val);
    try { if (usable) localStorage.setItem(raw(key), s); else mem[key] = s; }
    catch (e) { mem[key] = s; }
  }

  // per-game namespace: Arcade.storage.game('snake').get/set + best score
  function game(id) {
    const pre = "g:" + id + ":";
    return {
      get: (k, fb) => get(pre + k, fb),
      set: (k, v) => set(pre + k, v),
      best: () => get(pre + "best", 0),
      recordScore(score) {
        const b = get(pre + "best", 0);
        if (score > b) { set(pre + "best", score); return true; }
        return false;
      }
    };
  }

  window.Arcade = window.Arcade || {};
  window.Arcade.storage = { get, set, game };
})();
