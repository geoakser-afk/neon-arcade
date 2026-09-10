/* Arcade.net — room client for the realtime relay (server/server.js). Games use it for multiplayer:
     await Arcade.net.connect()            → connects + says hello with the Clerk token (throws if not signed in)
     await Arcade.net.host("coop"|"pvp")   → room {code, mode, hostId, players}
     await Arcade.net.join("ABCDE")        → room
     Arcade.net.send(d)  /  Arcade.net.to(id, d)      relay to everyone else / one peer
     Arcade.net.on("msg", fn({from, d}))   also: "room", "peer-join", "peer-leave", "host", "error", "close"
     Arcade.net.leave()  Arcade.net.disconnect()  Arcade.net.id()  Arcade.net.room()  Arcade.net.isHost()
   The relay URL is same-origin (/ws) in production; override with Arcade.net.setUrl(url) for local testing. */
(function () {
  const A = (window.Arcade = window.Arcade || {});
  let ws = null, myId = null, myName = null, room = null, url = null, pending = {}, handlers = {}, pingT = null;
  function defaultUrl() { if (/github\.io$/.test(location.hostname)) return "wss://play.vaultdigitaltools.com/ws"; return (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws"; }
  function emit(ev, data) { (handlers[ev] || []).forEach(function (fn) { try { fn(data); } catch (e) { console.error(e); } }); }
  function on(ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); return function () { handlers[ev] = (handlers[ev] || []).filter(function (f) { return f !== fn; }); }; }
  function off(ev) { if (ev) delete handlers[ev]; else handlers = {}; }
  function raw(obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }

  async function connect(opts) {
    opts = opts || {};
    if (ws && ws.readyState === 1 && myId) return { id: myId, name: myName };
    let token = null, name = opts.name || "Frog";
    if (!opts.guest) {
      if (!A.auth || !A.auth.isSignedIn()) throw new Error("Sign in to play together.");
      token = await A.auth.token(); const u = A.auth.user(); if (u) name = u.name;
    }
    return new Promise(function (resolve, reject) {
      let settled = false;
      ws = new WebSocket(url || defaultUrl());
      ws.onopen = function () { raw({ t: "hello", token: token, name: name }); };
      ws.onmessage = function (e) {
        let m; try { m = JSON.parse(e.data); } catch (err) { return; }
        if (m.t === "welcome") { myId = m.id; myName = m.name; settled = true; pingT = setInterval(function () { raw({ t: "ping" }); }, 25000); resolve({ id: myId, name: myName }); return; }
        if (m.t === "room") { room = m; if (pending.room) { pending.room(m); pending.room = null; } emit("room", m); return; }
        if (m.t === "error") { if (!settled) { settled = true; reject(new Error(m.message || m.code)); try { ws.close(); } catch (er) {} return; } if (pending.room) { const rj = pending.roomErr; pending.room = null; pending.roomErr = null; if (rj) rj(new Error(m.message || m.code)); } emit("error", m); return; }
        if (m.t === "host") { if (room) room.hostId = m.hostId; emit("host", m); return; }
        if (m.t === "peer-join" || m.t === "peer-leave") { emit(m.t, m); return; }
        if (m.t === "msg") { emit("msg", m); return; }
      };
      ws.onclose = function (e) { clearInterval(pingT); pingT = null; const hadId = myId; myId = null; room = null; if (!settled) { settled = true; reject(new Error("Could not reach the game server.")); } else if (hadId) emit("close", { code: e.code, reason: e.reason }); };
      ws.onerror = function () { if (!settled) { settled = true; reject(new Error("Could not reach the game server.")); } };
    });
  }
  function roomRequest(msg) { return new Promise(function (resolve, reject) { pending.room = resolve; pending.roomErr = reject; raw(msg); setTimeout(function () { if (pending.room === resolve) { pending.room = null; pending.roomErr = null; reject(new Error("The server didn't answer.")); } }, 6000); }); }

  A.net = {
    setUrl: function (u) { url = u; },
    connect: connect,
    host: function (mode) { return roomRequest({ t: "host", mode: mode || "coop" }); },
    join: function (code) { return roomRequest({ t: "join", code: String(code || "").toUpperCase().trim() }); },
    leave: function () { raw({ t: "leave" }); room = null; },
    disconnect: function () { off(); if (ws) { try { ws.close(); } catch (e) {} } ws = null; myId = null; room = null; clearInterval(pingT); },
    send: function (d) { raw({ t: "msg", d: d }); },
    to: function (id, d) { raw({ t: "to", id: id, d: d }); },
    on: on, off: off,
    id: function () { return myId; }, name: function () { return myName; }, room: function () { return room; },
    isHost: function () { return !!(room && myId && room.hostId === myId); },
    connected: function () { return !!(ws && ws.readyState === 1 && myId); }
  };
})();
