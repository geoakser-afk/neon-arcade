/* Arcade.cloud — cloud saves + leaderboards for signed-in players (server/server.js HTTP API next to the relay).
   SAVES: every Arcade.storage key (game saves, bests, prefs) is mirrored to the server per user with a per-key
   timestamp; on sign-in we pull and merge (newest wins per key), and every local write is pushed (debounced).
   So progress follows the account across devices. Guests keep using localStorage exactly as before.
   SCORES: Arcade.cloud.submit(board, score, {lower}) posts a best; Arcade.cloud.board(board) fetches the top 20.
   Games never need to call anything — the shell submits every onGameOver score to board "<gameId>" automatically.
   Board names ending in ":low" are lower-is-better (e.g. Kohi time). */
(function () {
  const A = (window.Arcade = window.Arcade || {});
  let API = /github\.io$/.test(location.hostname) ? "https://play.vaultdigitaltools.com/ws" : (location.protocol === "https:" || location.protocol === "http:") ? location.origin + "/ws" : null;
  const TS_KEY = "_ts";                       // Arcade.storage key holding {key: ms} timestamps
  const SKIP = /^(_ts|lowfx|pref:pins)$/;     // device-local things that must not sync
  let pushT = null, pending = false, lastPull = 0, syncing = false, status = "off";
  function ts() { return A.storage.get(TS_KEY, {}); }
  function localKeys() { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf("neonarcade:") === 0) out.push(k.slice("neonarcade:".length)); } } catch (e) {} return out.filter(function (k) { return !SKIP.test(k); }); }
  function setStatus(s) { status = s; document.dispatchEvent(new CustomEvent("arcade:cloud", { detail: { status: s } })); }
  async function headers() { const t = A.auth && (await A.auth.token()); return t ? { "Authorization": "Bearer " + t, "Content-Type": "application/json" } : null; }
  function enabled() { return !!(API && A.auth && A.auth.available() && A.auth.isSignedIn()); }

  // hook Arcade.storage.set so every write is stamped + pushed
  const origSet = A.storage.set;
  A.storage.set = function (key, val) {
    origSet(key, val);
    if (SKIP.test(key)) return;
    const m = ts(); m[key] = Date.now(); origSet(TS_KEY, m);
    if (enabled()) schedulePush();
  };
  function schedulePush() { pending = true; clearTimeout(pushT); pushT = setTimeout(push, 1500); }

  async function push() {
    if (!enabled() || syncing) { if (pending) schedulePush(); return; }
    pending = false; syncing = true; setStatus("saving");
    try {
      const h = await headers(); if (!h) throw new Error("no token");
      const data = {}, m = ts(); localKeys().forEach(function (k) { data[k] = A.storage.get(k, null); });
      const u = A.auth.user();
      const r = await fetch(API + "/save", { method: "PUT", headers: h, body: JSON.stringify({ name: u && u.name, data: data, ts: m }) });
      if (!r.ok) throw new Error("save " + r.status);
      setStatus("saved");
    } catch (e) { console.warn("[cloud] push failed", e.message); setStatus("error"); }
    syncing = false;
  }
  async function pull() {
    if (!enabled()) return;
    syncing = true; setStatus("loading");
    try {
      const h = await headers(); if (!h) throw new Error("no token");
      const r = await fetch(API + "/save", { headers: h }); if (!r.ok) throw new Error("load " + r.status);
      const cloud = await r.json(), m = ts(); let changed = 0;
      Object.keys(cloud.data || {}).forEach(function (k) { if (SKIP.test(k)) return; const ct = +(cloud.ts && cloud.ts[k]) || 0; if (!(k in m) || ct > m[k]) { origSet(k, cloud.data[k]); m[k] = ct; changed++; } });
      origSet(TS_KEY, m); lastPull = Date.now(); setStatus("saved");
      if (changed) document.dispatchEvent(new CustomEvent("arcade:cloud-applied", { detail: { changed: changed } }));
      syncing = false; push();   // send anything we had that the cloud lacked
    } catch (e) { console.warn("[cloud] pull failed", e.message); setStatus("error"); syncing = false; }
  }

  async function submit(board, score, opts) {
    opts = opts || {};
    if (!API || !isFinite(score)) return null;
    const name = String(board).replace(/[^a-z0-9:_\-]/gi, "").slice(0, 60) + (opts.lower && !/:low$/.test(board) ? ":low" : "");
    if (!enabled()) return { board: name, guest: true };
    try { const h = await headers(); const u = A.auth.user(); const r = await fetch(API + "/score", { method: "POST", headers: h, body: JSON.stringify({ game: name, score: score, name: u && u.name }) }); return r.ok ? await r.json() : null; } catch (e) { return null; }
  }
  async function board(name, limit) {
    if (!API) return null;
    try { const r = await fetch(API + "/board?game=" + encodeURIComponent(name) + "&limit=" + (limit || 20), { cache: "no-store" }); return r.ok ? (await r.json()).top : null; } catch (e) { return null; }
  }

  document.addEventListener("arcade:auth", function () { if (enabled()) pull(); else setStatus("off"); });
  if (A.auth) A.auth.ready.then(function () { if (enabled()) pull(); });

  A.cloud = { enabled: enabled, pull: pull, push: push, submit: submit, board: board, status: function () { return status; }, setApi: function (u) { API = u; } };
})();
