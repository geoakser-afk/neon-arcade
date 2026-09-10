/* Arcade.mpLobby — a ready-made "Play Together" overlay for any game: sign-in gate, host / join with a code,
   lobby with the room code + roster, mode picker (host), Start. Built on Arcade.net + Arcade.auth. DOM, so it
   works on phones. Usage from a game:
     const lobby = Arcade.mpLobby.open({
       title: "Click Speed — race",  modes: [{id:"cps5", label:"5 seconds"}, …], defaultMode: "cps5",
       onStart(info)  → { mode, isHost, room, me }   fired on EVERY client when the host presses Start
       onMsg(m)       → relayed game messages ({from, d}) once started (before that the lobby owns the channel)
       onLeave()      → the local player left / disconnected
     });
     lobby.close();  Arcade.mpLobby.send(d) / .to(id, d) / .isHost() / .players()
   The host's Start message is {k:"__start", mode}; games never see it. */
(function () {
  const A = (window.Arcade = window.Arcade || {});
  let root = null, state = null;
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function open(cfg) {
    close();
    state = { cfg: cfg, room: null, started: false, mode: cfg.defaultMode || (cfg.modes && cfg.modes[0] && cfg.modes[0].id) || null, msg: "" };
    root = el("div", "mpl"); document.body.appendChild(root);
    render();
    A.net.off();
    A.net.on("room", function (r) { if (!state) return; state.room = r; render(); });
    A.net.on("host", function () { if (state) render(); });
    A.net.on("peer-join", function (q) { if (state && state.started && cfg.onPeer) cfg.onPeer(q, "join"); });
    A.net.on("peer-leave", function (q) { if (state && state.started && cfg.onPeer) cfg.onPeer(q, "leave"); if (state && !state.started) render(); });
    A.net.on("close", function () { if (!state) return; if (state.started && cfg.onLeave) cfg.onLeave("disconnected"); close(); });
    A.net.on("error", function (e) { if (state) { state.msg = e.message || e.code; render(); } });
    A.net.on("msg", function (m) { if (!state) return; const d = m.d || {}; if (d.k === "__start") { begin(d.mode); return; } if (d.k === "__mode") { state.mode = d.mode; render(); return; } if (state.started && cfg.onMsg) cfg.onMsg(m); });
    return api;
  }
  function begin(mode) {
    if (!state) return;
    state.started = true; state.mode = mode;
    if (root) root.style.display = "none";
    const info = { mode: mode, isHost: A.net.isHost(), room: state.room, me: { id: A.net.id(), name: A.net.name() } };
    if (state.cfg.onStart) state.cfg.onStart(info);
  }
  async function go(kind) {
    state.msg = "connecting…"; render();
    try {
      await A.net.connect();
      const code = kind === "join" ? (prompt("Room code from your friend:") || "") : null;
      if (kind === "join" && !code) { state.msg = ""; render(); return; }
      state.room = kind === "join" ? await A.net.join(code) : await A.net.host(kind);
      state.msg = ""; render();
    } catch (e) { state.msg = e.message || String(e); render(); }
  }
  function render() {
    if (!root || !state) return;
    const cfg = state.cfg, signed = A.auth && A.auth.isSignedIn(), me = A.net.id();
    root.innerHTML = "";
    const card = el("div", "mpl-card");
    card.appendChild(el("h2", null, cfg.title || "Play Together"));
    const x = el("button", "mpl-x", "✕"); x.onclick = function () { leave(); }; card.appendChild(x);
    if (!signed) {
      card.appendChild(el("p", "mpl-sub", "Multiplayer needs an account (free). Everything single-player stays open."));
      const b = el("button", "btn", A.auth && A.auth.available() ? "Sign in" : "Sign-in unavailable (offline)"); b.onclick = function () { A.auth.signIn(); }; card.appendChild(b);
      document.addEventListener("arcade:auth", render, { once: true });
    } else if (!state.room) {
      card.appendChild(el("p", "mpl-sub", "Host a room and share the code, or join a friend's."));
      const row = el("div", "btn-row");
      const h = el("button", "btn", "Host a room"); h.onclick = function () { go("game"); };
      const j = el("button", "btn ghost", "Join with a code"); j.onclick = function () { go("join"); };
      row.appendChild(h); row.appendChild(j); card.appendChild(row);
    } else {
      const r = state.room, isHost = A.net.isHost();
      card.appendChild(el("div", "mpl-codelbl", "room code"));
      card.appendChild(el("div", "mpl-code", r.code));
      const ros = el("div", "mpl-roster");
      r.players.forEach(function (p) { ros.appendChild(el("div", "mpl-p" + (p.id === me ? " me" : "") + (p.id === r.hostId ? " host" : ""), p.name + (p.id === r.hostId ? " ★" : "") + (p.id === me ? " (you)" : ""))); });
      card.appendChild(ros);
      if (cfg.modes && cfg.modes.length) {
        const modes = el("div", "mpl-modes");
        cfg.modes.forEach(function (m) { const b = el("button", "mpl-mode" + (m.id === state.mode ? " on" : ""), m.label); b.disabled = !isHost; b.onclick = function () { state.mode = m.id; A.net.send({ k: "__mode", mode: m.id }); render(); }; modes.appendChild(b); });
        card.appendChild(modes);
      }
      const row = el("div", "btn-row");
      if (isHost) { const need = cfg.minPlayers || 1, enough = r.players.length >= need; const s = el("button", "btn", enough ? (r.players.length > 1 ? "Start" : "Start (solo)") : "Waiting for a friend…"); s.disabled = !enough; s.onclick = function () { A.net.send({ k: "__start", mode: state.mode }); begin(state.mode); }; row.appendChild(s); }
      else row.appendChild(el("div", "mpl-wait", "waiting for the host to start…"));
      const lv = el("button", "btn ghost", "Leave"); lv.onclick = function () { leave(); }; row.appendChild(lv);
      card.appendChild(row);
    }
    if (state.msg) card.appendChild(el("div", "mpl-msg", state.msg));
    root.appendChild(card);
  }
  function leave() { const cb = state && state.cfg.onLeave, started = state && state.started; try { A.net.leave(); } catch (e) {} close(); if (cb && started) cb("left"); }
  function close() { if (root) { root.remove(); root = null; } state = null; }
  const api = {
    open: open, close: close, leave: leave,
    show: function () { if (root) root.style.display = ""; },
    send: function (d) { A.net.send(d); }, to: function (id, d) { A.net.to(id, d); },
    isHost: function () { return A.net.isHost(); }, me: function () { return A.net.id(); },
    players: function () { return state && state.room ? state.room.players : []; },
    active: function () { return !!(state && state.started); },
    restart: function (mode) { if (!state || !A.net.isHost()) return; A.net.send({ k: "__start", mode: mode || state.mode }); begin(mode || state.mode); }
  };
  A.mpLobby = api;
})();
