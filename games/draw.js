/* Neon Draw — Gartic-Phone-style draw & guess party game (2–8 players) on the shared relay.
   Moderation by design: there is NO free-text anywhere. The host broadcasts 8 word options (real + 7 decoys) and
   guessing is a button tap, so nothing needs filtering. Authority: the HOST runs the round state machine
   (pick → round → reveal → … → standings) and broadcasts it; guessers send {k:"guess", i} to the host; the
   DRAWER streams strokes directly to everyone (batched ~80 ms, 0..1 normalized coords, 800×800 backing store).
   Host leaving = game ends gracefully with a toast. Late joiners spectate until the next round. */
(function () {
  const WORDS = {
    animals: ["cat", "dog", "frog", "fish", "bird", "duck", "cow", "pig", "horse", "sheep", "lion", "tiger", "bear", "monkey", "elephant", "giraffe", "zebra", "snake", "turtle", "rabbit", "mouse", "owl", "penguin", "whale", "shark", "octopus", "crab", "butterfly", "bee", "spider", "snail", "ladybug", "dolphin", "kangaroo", "panda", "fox", "wolf", "deer", "chicken", "bat"],
    foods: ["apple", "banana", "pizza", "burger", "hot dog", "ice cream", "cookie", "cake", "donut", "carrot", "cheese", "egg", "bread", "taco", "sushi", "strawberry", "watermelon", "grapes", "pineapple", "corn", "popcorn", "lollipop", "pancake", "sandwich", "cupcake", "lemon", "cherry", "mushroom", "pretzel", "broccoli"],
    objects: ["car", "bus", "truck", "train", "boat", "rocket", "airplane", "bicycle", "helicopter", "chair", "table", "bed", "lamp", "clock", "key", "book", "pencil", "scissors", "umbrella", "hat", "shoe", "sock", "glasses", "crown", "guitar", "drum", "piano", "balloon", "kite", "ball", "teddy bear", "robot", "ladder", "hammer", "phone", "camera", "tent", "backpack", "toothbrush", "candle", "bell", "flag", "anchor", "sword", "shield", "magnet", "dice", "ring", "watch", "broom"],
    places: ["house", "castle", "school", "beach", "island", "mountain", "volcano", "river", "lake", "forest", "bridge", "lighthouse", "farm", "barn", "cave", "igloo", "desert", "city", "tree", "flower", "sun", "moon", "star", "cloud", "rainbow", "snowman", "cactus", "leaf", "fire", "wave", "lightning", "tornado", "planet", "comet"]
  };
  const ALL = []; Object.keys(WORDS).forEach(function (c) { WORDS[c].forEach(function (w) { ALL.push({ w: w, c: c }); }); });
  const COLORS = ["#f6f7fb", "#c98cff", "#7fe0a0", "#6fd3ff", "#ffd36b", "#ff8fb1", "#ff9c6b", "#5fd0c8"];
  const SIZES = [4, 10, 22], ERASER_W = 30;
  const BG = "#100e1e", N = 800;
  const ROUND_MS = 60000, REVEAL_MS = 4000, PICK_MS = 15000, TURNS_EACH = 2, BATCH_MS = 80, MAX_PTS = 400;
  const HEX = /^#[0-9a-f]{6}$/i;

  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function esc(s) { return String(s == null ? "" : s).replace(/[<>&"]/g, function (c) { return { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]; }); }
  function clamp01(v) { return Math.max(0, Math.min(1, +v || 0)); }
  function pickChoices() { const bag = shuffle(ALL.slice()); const out = [], cats = {}; for (let i = 0; i < bag.length && out.length < 3; i++) { if (!cats[bag[i].c]) { cats[bag[i].c] = 1; out.push(bag[i].w); } } return out; }
  function makeOptions(word) {
    const cat = (ALL.find(function (x) { return x.w === word; }) || {}).c;
    const same = shuffle(ALL.filter(function (x) { return x.c === cat && x.w !== word; }).map(function (x) { return x.w; })).slice(0, 3);
    const rest = shuffle(ALL.filter(function (x) { return x.w !== word && same.indexOf(x.w) < 0; }).map(function (x) { return x.w; })).slice(0, 7 - same.length);
    return shuffle([word].concat(same, rest));
  }
  function maskOf(w) { return w.replace(/[^ ]/g, "_"); }
  function blanks(mask) { return mask.split("").map(function (ch) { return ch === " " ? " " : ch; }).join(" "); }

  Arcade.register({
    id: "draw", name: "Neon *Draw*", tagline: "Draw it, friends tap the word. No typing.", accent: "#c98cff",
    complexity: "med", controls: "click", scoreLabel: "Points",
    create() {
      let stageEl = null, ctx = null, styleEl = null, root = null, listeners = [], timers = [];
      let mode = "title";            // title | solo | mp
      let me = null, hostId = null, isHost = false, ended = false;
      let V = null;                  // everyone's view of the round (mirrors host broadcasts)
      let H = null;                  // host-only authoritative state
      // drawing
      let cv = null, g = null, off = null, og = null, strokes = [], dirty = true, pending = [], lastSent = null, drawing = false, batchT = null, curId = null, seq = 0;
      let tool = { col: COLORS[1], w: SIZES[1], eraser: false };
      let ui = {};

      function on(t, ev, fn, opts) { t.addEventListener(ev, fn, opts); listeners.push([t, ev, fn, opts]); }
      function setT(fn, ms) { const id = setTimeout(function () { timers = timers.filter(function (x) { return x !== id; }); fn(); }, ms); timers.push(id); return id; }
      function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
      function snd(kind) {
        if (!ctx || !ctx.audio) return;
        try {
          if (kind === "tick") ctx.audio.tone(880, 0.05, { type: "sine", vol: 0.06 });
          else if (kind === "ok") ctx.audio.arp([523, 659, 784, 1046], { dur: 0.14, step: 0.06, vol: 0.1, type: "sine" });
          else if (kind === "bad") ctx.audio.tone(196, 0.1, { type: "triangle", vol: 0.05 });
          else if (kind === "reveal") ctx.audio.arp([392, 494, 587], { dur: 0.16, step: 0.07, vol: 0.08, type: "sine" });
          else if (kind === "win") ctx.audio.arp([523, 659, 784, 1046, 1318], { dur: 0.2, step: 0.08, vol: 0.12, type: "sine" });
          else if (kind === "pick") ctx.audio.tone(660, 0.07, { type: "sine", vol: 0.06, glide: 880 });
          else if (kind === "soft") ctx.audio.tone(440, 0.05, { type: "sine", vol: 0.04 });
        } catch (e) {}
      }
      function toast(msg) {
        if (!root) return;
        const t = el("div", "nd-toast", esc(msg)); root.appendChild(t);
        setT(function () { t.classList.add("go"); }, 20);
        setT(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 2600);
      }

      // ---------- canvas ----------
      function initCanvas(wrap) {
        cv = document.createElement("canvas"); cv.width = N; cv.height = N; cv.className = "nd-canvas"; g = cv.getContext("2d");
        off = document.createElement("canvas"); off.width = N; off.height = N; og = off.getContext("2d");
        wrap.appendChild(cv);
        clearAll();
        on(cv, "pointerdown", pDown, { passive: false }); on(cv, "pointermove", pMove, { passive: false });
        on(cv, "pointerup", pUp, { passive: false }); on(cv, "pointercancel", pUp, { passive: false });
        on(cv, "contextmenu", function (e) { e.preventDefault(); });
      }
      function drawSeg(c, s, glow) {
        const pts = s.pts; if (!pts || !pts.length) return;
        c.save(); c.lineCap = "round"; c.lineJoin = "round"; c.strokeStyle = s.col; c.lineWidth = s.w;
        if (glow && s.col !== BG) { c.shadowBlur = 12; c.shadowColor = s.col; }
        c.beginPath(); c.moveTo(pts[0][0] * N, pts[0][1] * N);
        if (pts.length === 1) c.lineTo(pts[0][0] * N + 0.01, pts[0][1] * N);
        for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0] * N, pts[i][1] * N);
        c.stroke(); c.restore();
      }
      function validStroke(d) {
        if (!Array.isArray(d.pts) || !d.pts.length || d.pts.length > MAX_PTS + 1) return null;
        const pts = []; for (let i = 0; i < d.pts.length; i++) { const p = d.pts[i]; if (!Array.isArray(p) || p.length < 2) return null; pts.push([clamp01(p[0]), clamp01(p[1])]); }
        const col = (typeof d.col === "string" && HEX.test(d.col)) ? d.col : COLORS[0];
        const w = Math.max(1, Math.min(60, +d.w || SIZES[1]));
        return { id: String(d.id || "s"), pts: pts, col: col, w: w };
      }
      function addStroke(d) { const s = validStroke(d); if (!s) return; strokes.push(s); drawSeg(og, s, true); dirty = true; }
      function rebuildOff() { og.fillStyle = BG; og.fillRect(0, 0, N, N); strokes.forEach(function (s) { drawSeg(og, s, true); }); dirty = true; }
      function clearAll() { strokes = []; pending = []; lastSent = null; drawing = false; if (og) rebuildOff(); }
      function undoLast() { if (!strokes.length) return; const id = strokes[strokes.length - 1].id; strokes = strokes.filter(function (s) { return s.id !== id; }); rebuildOff(); }
      function render() {
        if (!g) return;
        g.fillStyle = BG; g.fillRect(0, 0, N, N); g.drawImage(off, 0, 0);
        if (pending.length || lastSent) { const pts = lastSent ? [lastSent].concat(pending) : pending; if (pts.length) drawSeg(g, { pts: pts, col: curCol(), w: curW() }, true); }
        dirty = false;
      }
      function curCol() { return tool.eraser ? BG : tool.col; }
      function curW() { return tool.eraser ? ERASER_W : tool.w; }
      function canDraw() { return mode === "solo" || (mode === "mp" && !ended && V && V.phase === "round" && V.drawerId === me); }
      function ptOf(e) { const r = cv.getBoundingClientRect(); return [+clamp01((e.clientX - r.left) / r.width).toFixed(3), +clamp01((e.clientY - r.top) / r.height).toFixed(3)]; }
      function pDown(e) {
        if (!canDraw() || (e.button != null && e.button !== 0 && e.pointerType === "mouse")) return;
        e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (er) {}
        drawing = true; seq++; curId = (me || "solo") + "_" + seq; pending = [ptOf(e)]; lastSent = null; dirty = true; scheduleFlush();
      }
      function pMove(e) {
        if (!drawing) return; e.preventDefault();
        const p = ptOf(e), last = pending[pending.length - 1] || lastSent;
        if (last && last[0] === p[0] && last[1] === p[1]) return;
        pending.push(p); dirty = true; if (pending.length >= MAX_PTS) flush(false);
      }
      function pUp(e) { if (!drawing) return; e.preventDefault(); drawing = false; flush(true); }
      function scheduleFlush() { if (!batchT) batchT = setTimeout(function () { batchT = null; flush(false); }, BATCH_MS); }
      function flush(final) {
        if (batchT) { clearTimeout(batchT); batchT = null; }
        if (pending.length) {
          const pts = lastSent ? [lastSent].concat(pending) : pending.slice();
          const d = { k: "stroke", id: curId, pts: pts, col: curCol(), w: curW() };
          lastSent = pending[pending.length - 1]; pending = [];
          if (mode === "mp") Arcade.mpLobby.send(d);
          addStroke(d);
        }
        if (final) { lastSent = null; dirty = true; } else if (drawing) scheduleFlush();
      }
      function doUndo() { if (!canDraw()) return; if (drawing) { drawing = false; flush(true); } undoLast(); if (mode === "mp") Arcade.mpLobby.send({ k: "undo" }); snd("soft"); }
      function doClear() { if (!canDraw()) return; clearAll(); if (mode === "mp") Arcade.mpLobby.send({ k: "clear" }); snd("soft"); }

      // ---------- networking ----------
      function mpOpen() {
        if (!window.Arcade || !Arcade.mpLobby) { toast("multiplayer unavailable"); return; }
        Arcade.mpLobby.open({ title: "Neon Draw", minPlayers: 2, onStart: onStart, onMsg: onMsg, onLeave: onLeave, onPeer: onPeer });
      }
      function onStart(info) {
        me = info.me.id; hostId = info.room ? info.room.hostId : (info.isHost ? me : null); isHost = !!info.isHost; ended = false; H = null;
        V = { phase: "wait", drawerId: null, options: null, mask: "", word: null, choices: null, guessed: {}, roster: [], turn: 0, total: 0, endsAt: 0, dur: ROUND_MS, reveal: null, spectating: false, lastSec: null };
        Arcade.mpLobby.players().forEach(function (q) { V.roster.push({ id: q.id, name: q.name, score: 0 }); });
        mode = "mp"; showGame(); ctx.setScore(0);
        if (isHost) hostBegin();
      }
      function onMsg(m) { if (!m || !m.d) return; if (isHost && (m.d.k === "guess" || m.d.k === "picked")) { hostRecv(m.from, m.d); return; } handle(m.from, m.d); }
      function onLeave(why) { toast(why === "disconnected" ? "disconnected from the room" : "left the room"); endMp(); }
      function onPeer(q, what) {
        if (mode !== "mp" || !V) return;
        if (what === "join") {
          if (!V.roster.find(function (p) { return p.id === q.id; })) V.roster.push({ id: q.id, name: q.name, score: 0 });
          if (isHost && H) {
            const others = Object.keys(H.players).map(function (id) { return H.players[id].turns; });
            H.players[q.id] = { id: q.id, name: q.name, score: 0, turns: others.length ? Math.min.apply(null, others) : 0 };
            sendTo(q.id, hostSync());
            for (let i = 0; i < strokes.length; i += 24) sendTo(q.id, { k: "strokes", list: strokes.slice(i, i + 24) });
          }
          toast(q.name + " joined — in next round"); renderSide();
        } else if (what === "leave") {
          V.roster = V.roster.filter(function (p) { return p.id !== q.id; });
          if (q.id === hostId && !isHost) { ended = true; toast("host left"); renderSide(); return; }
          if (isHost && H) {
            delete H.players[q.id];
            if (q.id === H.drawerId && H.phase === "pick") hostNextTurn();
            else if (q.id === H.drawerId && H.phase === "round") hostEndRound();
            else if (H.phase === "round") hostCheckAllGuessed();
          }
          toast(q.name + " left"); renderSide();
        }
      }
      function endMp() { mode = "title"; V = null; H = null; ended = false; timers.forEach(clearTimeout); timers = []; showTitle(); }
      function sendTo(id, d) { if (id === me) handle(me, d); else Arcade.mpLobby.to(id, d); }
      function emit(d) { Arcade.mpLobby.send(d); handle(me, d); }
      function toHost(d) { if (isHost) hostRecv(me, d); else if (hostId) Arcade.mpLobby.to(hostId, d); }

      // ---------- host state machine ----------
      function hostBegin() {
        H = { players: {}, phase: "idle", drawerId: null, word: null, options: null, choices: null, startAt: 0, endsAt: 0, pickAt: 0, roundPlayers: [], guessed: {} };
        Arcade.mpLobby.players().forEach(function (q) { H.players[q.id] = { id: q.id, name: q.name, score: 0, turns: 0 }; });
        hostNextTurn();
      }
      function hostRoster() { return Object.keys(H.players).map(function (id) { return { id: id, name: H.players[id].name, score: H.players[id].score }; }); }
      function scoresMap() { const o = {}; Object.keys(H.players).forEach(function (id) { o[id] = H.players[id].score; }); return o; }
      function hostTurnNo() { const ids = Object.keys(H.players); return { turn: ids.reduce(function (s, id) { return s + H.players[id].turns; }, 0) + 1, total: ids.length * TURNS_EACH }; }
      function hostNextTurn() {
        if (!H || ended) return;
        const ids = Object.keys(H.players);
        if (ids.length < 2) { hostStandings(); return; }
        const minT = Math.min.apply(null, ids.map(function (id) { return H.players[id].turns; }));
        if (minT >= TURNS_EACH) { hostStandings(); return; }
        const drawer = ids.find(function (id) { return H.players[id].turns === minT; });
        H.drawerId = drawer; H.word = null; H.options = null; H.guessed = {}; H.phase = "pick"; H.pickAt = Date.now(); H.choices = pickChoices();
        const t = hostTurnNo();
        emit({ k: "pick", drawerId: drawer, turn: t.turn, total: t.total, roster: hostRoster() });
        sendTo(drawer, { k: "choices", list: H.choices });
      }
      function hostStartRound(w) {
        if (!H || H.phase !== "pick") return;
        H.word = w; H.options = makeOptions(w); H.phase = "round"; H.startAt = Date.now(); H.endsAt = H.startAt + ROUND_MS;
        H.roundPlayers = Object.keys(H.players); H.players[H.drawerId].turns++;
        const t = hostTurnNo();
        emit({ k: "round", drawerId: H.drawerId, options: H.options, endsAt: H.endsAt, now: Date.now(), dur: ROUND_MS, mask: maskOf(w), turn: t.turn - 1, total: t.total, roster: hostRoster() });
        sendTo(H.drawerId, { k: "word", w: w });
      }
      function hostRecv(from, d) {
        if (!H || ended || !d) return;
        if (d.k === "picked") { if (H.phase !== "pick" || from !== H.drawerId) return; hostStartRound(H.choices.indexOf(d.w) >= 0 ? d.w : H.choices[0]); }
        else if (d.k === "guess") {
          if (H.phase !== "round" || from === H.drawerId || H.guessed[from] || H.roundPlayers.indexOf(from) < 0 || !H.players[from]) return;
          const i = d.i | 0; if (i < 0 || i >= H.options.length) return;
          const ok = H.options[i] === H.word, elapsed = Date.now() - H.startAt;
          const pts = ok ? Math.max(40, Math.min(100, Math.round(100 - 60 * elapsed / ROUND_MS))) : 0;
          H.guessed[from] = { ok: ok, pts: pts, i: i };
          if (ok) { H.players[from].score += pts; if (H.players[H.drawerId]) H.players[H.drawerId].score += 25; }
          emit({ k: "result", id: from, ok: ok, pts: pts, i: i, scores: scoresMap() });
          hostCheckAllGuessed();
        }
      }
      function hostCheckAllGuessed() {
        if (!H || H.phase !== "round") return;
        const left = H.roundPlayers.filter(function (id) { return id !== H.drawerId && H.players[id] && !H.guessed[id]; });
        if (!left.length) hostEndRound();
      }
      function hostEndRound() {
        if (!H || H.phase !== "round") return; H.phase = "reveal";
        const got = Object.keys(H.guessed).filter(function (id) { return H.guessed[id].ok; });
        emit({ k: "reveal", word: H.word, got: got, drawerId: H.drawerId, roster: hostRoster() });
        setT(function () { if (H && !ended && H.phase === "reveal") hostNextTurn(); }, REVEAL_MS);
      }
      function hostStandings() { if (!H) return; H.phase = "standings"; emit({ k: "standings", roster: hostRoster() }); }
      function hostSync() {
        const t = hostTurnNo();
        return { k: "sync", phase: H.phase, drawerId: H.drawerId, options: H.options, endsAt: H.endsAt, now: Date.now(), dur: ROUND_MS, mask: H.word ? maskOf(H.word) : "", turn: H.phase === "round" ? t.turn - 1 : t.turn, total: t.total, roster: hostRoster(), got: Object.keys(H.guessed).filter(function (id) { return H.guessed[id].ok; }), word: H.phase === "reveal" || H.phase === "standings" ? H.word : null };
      }
      function hostTick() {
        if (!H || ended) return;
        if (H.phase === "round" && Date.now() >= H.endsAt) hostEndRound();
        else if (H.phase === "pick" && Date.now() - H.pickAt > PICK_MS) hostStartRound(H.choices[0]);
      }

      // ---------- everyone: apply messages ----------
      function applyRoster(r) { if (Array.isArray(r)) V.roster = r.map(function (p) { return { id: String(p.id), name: String(p.name || "Frog").slice(0, 24), score: +p.score || 0 }; }); }
      function myScore() { const p = V && V.roster.find(function (q) { return q.id === me; }); return p ? p.score : 0; }
      function handle(from, d) {
        if (mode !== "mp" || !V || ended || !d) return;
        const k = d.k;
        if (k === "stroke" || k === "clear" || k === "undo") {
          if (from !== V.drawerId) return;
          if (k === "stroke") addStroke(d); else if (k === "clear") clearAll(); else undoLast();
          return;
        }
        if (from !== hostId) return;
        if (k === "pick") { V.phase = "pick"; V.drawerId = d.drawerId; V.turn = d.turn; V.total = d.total; V.options = null; V.word = null; V.choices = null; V.guessed = {}; V.reveal = null; V.mask = ""; applyRoster(d.roster); clearAll(); }
        else if (k === "choices") { V.choices = Array.isArray(d.list) ? d.list.slice(0, 3).map(String) : []; snd("pick"); }
        else if (k === "round") { V.phase = "round"; V.drawerId = d.drawerId; V.options = (d.options || []).slice(0, 8).map(String); V.mask = String(d.mask || ""); V.dur = d.dur || ROUND_MS; V.endsAt = d.endsAt - ((d.now || Date.now()) - Date.now()); V.turn = d.turn; V.total = d.total; V.guessed = {}; V.choices = null; V.reveal = null; V.spectating = false; V.lastSec = null; applyRoster(d.roster); clearAll(); if (V.drawerId !== me) V.word = null; }
        else if (k === "word") { V.word = String(d.w); }
        else if (k === "result") { V.guessed[d.id] = { ok: !!d.ok, pts: +d.pts || 0, i: d.i | 0 }; if (d.scores) V.roster.forEach(function (p) { if (d.scores[p.id] != null) p.score = +d.scores[p.id]; }); if (d.id === me) snd(d.ok ? "ok" : "bad"); else if (d.ok) snd("soft"); }
        else if (k === "reveal") { V.phase = "reveal"; V.reveal = { word: String(d.word), got: d.got || [] }; V.word = String(d.word); applyRoster(d.roster); snd("reveal"); }
        else if (k === "standings") { V.phase = "standings"; applyRoster(d.roster); const top = V.roster.slice().sort(function (a, b) { return b.score - a.score; })[0]; if (top && top.id === me) snd("win"); else snd("reveal"); }
        else if (k === "sync") { V.phase = d.phase === "idle" ? "wait" : d.phase; V.drawerId = d.drawerId; V.options = d.options ? d.options.slice(0, 8).map(String) : null; V.mask = String(d.mask || ""); V.dur = d.dur || ROUND_MS; V.endsAt = d.endsAt ? d.endsAt - ((d.now || Date.now()) - Date.now()) : 0; V.turn = d.turn; V.total = d.total; applyRoster(d.roster); V.spectating = V.phase === "round" || V.phase === "pick"; V.reveal = d.word ? { word: String(d.word), got: d.got || [] } : null; V.word = d.word ? String(d.word) : null; }
        else if (k === "strokes") { (d.list || []).slice(0, 40).forEach(addStroke); return; }
        else return;
        ctx.setScore(myScore()); renderSide(); renderTools();
      }

      // ---------- DOM ----------
      function showTitle() {
        if (!root) return; root.innerHTML = ""; ui = {}; cv = g = off = og = null; root.className = "nd-root nd-title-mode";
        const t = el("div", "nd-title",
          '<div class="nd-logo">Neon <em>Draw</em></div>' +
          '<p class="nd-tag">One draws, everyone taps the word. 2–8 players, no typing, no chat.</p>' +
          '<div class="nd-how"><span>✏️ 60 s to draw</span><span>🔘 8 words to pick from</span><span>⚡ faster = more points</span></div>' +
          '<div class="btn-row"><button class="btn nd-play">👥 Play Together</button><button class="btn ghost nd-solo">Solo doodle</button></div>');
        root.appendChild(t);
        t.querySelector(".nd-play").onclick = mpOpen;
        t.querySelector(".nd-solo").onclick = function () { mode = "solo"; showGame(); };
      }
      function showGame() {
        root.innerHTML = ""; ui = {}; root.className = "nd-root";
        const left = el("div", "nd-left");
        const wrap = el("div", "nd-cvwrap"); left.appendChild(wrap); initCanvas(wrap);
        ui.badge = el("div", "nd-badge"); wrap.appendChild(ui.badge);
        ui.tools = el("div", "nd-tools"); left.appendChild(ui.tools);
        const side = el("div", "nd-side"); ui.side = side;
        root.appendChild(left); root.appendChild(side);
        tool = { col: COLORS[1], w: SIZES[1], eraser: false };
        renderTools(); renderSide(); dirty = true;
      }
      function renderTools() {
        if (!ui.tools) return; const can = canDraw();
        let html = '<div class="nd-swatches">' + COLORS.map(function (c) { return '<button class="nd-sw' + (!tool.eraser && tool.col === c ? " on" : "") + '" data-c="' + c + '" style="--c:' + c + '" aria-label="color"></button>'; }).join("") + "</div>";
        html += '<div class="nd-brushes">' + SIZES.map(function (s, i) { return '<button class="nd-br' + (!tool.eraser && tool.w === s ? " on" : "") + '" data-i="' + i + '" aria-label="brush"><i style="width:' + (8 + i * 8) + "px;height:" + (8 + i * 8) + 'px"></i></button>'; }).join("") +
          '<button class="nd-tb nd-eraser' + (tool.eraser ? " on" : "") + '">◻ Eraser</button><button class="nd-tb nd-undo">↶ Undo</button><button class="nd-tb nd-clear">✕ Clear</button>' +
          (mode === "solo" ? '<button class="nd-tb nd-back">← Back</button>' : "") + "</div>";
        ui.tools.innerHTML = html; ui.tools.classList.toggle("off", !can);
        ui.tools.querySelectorAll(".nd-sw").forEach(function (b) { b.onclick = function () { tool.col = b.dataset.c; tool.eraser = false; renderTools(); }; });
        ui.tools.querySelectorAll(".nd-br").forEach(function (b) { b.onclick = function () { tool.w = SIZES[+b.dataset.i]; tool.eraser = false; renderTools(); }; });
        ui.tools.querySelector(".nd-eraser").onclick = function () { tool.eraser = !tool.eraser; renderTools(); };
        ui.tools.querySelector(".nd-undo").onclick = doUndo;
        ui.tools.querySelector(".nd-clear").onclick = doClear;
        const back = ui.tools.querySelector(".nd-back"); if (back) back.onclick = function () { mode = "title"; showTitle(); };
        if (cv) cv.classList.toggle("can", can);
        if (ui.badge) { ui.badge.textContent = mode === "solo" ? "solo doodle" : (can ? "you're drawing" : (V && V.phase === "round" ? "guess the word →" : "")); ui.badge.style.display = ui.badge.textContent ? "" : "none"; }
      }
      function nameOf(id) { const p = V && V.roster.find(function (q) { return q.id === id; }); return p ? p.name : "Frog"; }
      function renderSide() {
        if (!ui.side) return;
        if (mode === "solo") { ui.side.innerHTML = '<div class="nd-card"><div class="nd-h">Solo doodle</div><p class="nd-sub">Free canvas. Pick a color, draw, undo, clear. Press <b>Play Together</b> from the title to draw for friends.</p></div>'; return; }
        if (!V) { ui.side.innerHTML = ""; return; }
        const drawerMe = V.drawerId === me, drawerName = nameOf(V.drawerId);
        let html = '<div class="nd-card nd-status">';
        html += '<div class="nd-h">' + (V.phase === "standings" ? "Final standings" : ended ? "Game over" : V.total ? "Round " + esc(V.turn) + " / " + esc(V.total) : "Neon Draw") + "</div>";
        if (ended) html += '<p class="nd-sub">The host left, so this game is over.</p><button class="btn ghost nd-leave">Back to title</button>';
        else if (V.phase === "wait") html += '<p class="nd-sub">waiting for the host…</p>';
        else if (V.phase === "standings") { const top = V.roster.slice().sort(function (a, b) { return b.score - a.score; }); html += '<p class="nd-sub">' + (top.length ? "🏆 <b>" + esc(top[0].name) + "</b> wins with " + top[0].score + " points" + (top[0].id === me ? " — that's you!" : "") : "") + "</p>"; }
        else if (V.phase === "pick") {
          if (drawerMe && V.choices) html += '<p class="nd-sub">Your turn to draw. Pick a word:</p><div class="nd-choices">' + V.choices.map(function (w) { return '<button class="nd-choice" data-w="' + esc(w) + '">' + esc(w) + "</button>"; }).join("") + "</div>";
          else html += '<p class="nd-sub"><b>' + esc(drawerName) + "</b> is picking a word…</p>";
        } else if (V.phase === "round") {
          html += '<div class="nd-timer"><div class="nd-timebar"><i></i></div><span class="nd-time"></span></div>';
          html += '<div class="nd-word">' + (drawerMe && V.word ? '<span class="nd-lbl">draw</span>' + esc(V.word) : '<span class="nd-lbl">' + esc(drawerName) + " is drawing</span>" + esc(blanks(V.mask))) + "</div>";
        } else if (V.phase === "reveal" && V.reveal) {
          const got = V.reveal.got.map(nameOf);
          html += '<div class="nd-reveal"><span class="nd-lbl">the word was</span><b>' + esc(V.reveal.word) + "</b><small>" + (got.length ? esc(got.join(", ")) + (got.length === 1 ? " got it" : " got it") : "nobody got it") + "</small></div>";
        }
        html += "</div>";
        // guess grid
        if (V.phase === "round" && !drawerMe && V.options) {
          const mine = V.guessed[me];
          html += '<div class="nd-card"><div class="nd-h">' + (V.spectating ? "Spectating — you join next round" : mine ? (mine.ok ? "✓ Correct! +" + mine.pts : "✗ Not it — watch the reveal") : "Tap the word") + '</div><div class="nd-grid">' +
            V.options.map(function (w, i) { let cls = "nd-opt"; if (mine && mine.i === i) cls += mine.ok ? " ok" : " bad"; return '<button class="' + cls + '" data-i="' + i + '"' + (mine || V.spectating ? " disabled" : "") + ">" + esc(w) + "</button>"; }).join("") + "</div></div>";
        }
        // players
        const sorted = V.roster.slice().sort(function (a, b) { return b.score - a.score; });
        html += '<div class="nd-card"><div class="nd-h">Players</div><div class="nd-players">' + sorted.map(function (p, i) {
          const gz = V.guessed[p.id]; let tag = "";
          if (V.phase === "round" || V.phase === "reveal") tag = p.id === V.drawerId ? "✏️" : gz ? (gz.ok ? "✓" : "✗") : "…";
          if (V.phase === "standings") tag = i === 0 ? "🏆" : "";
          return '<div class="nd-p' + (p.id === me ? " me" : "") + (p.id === V.drawerId ? " drawer" : "") + '"><span class="n">' + (V.phase === "standings" ? (i + 1) + ". " : "") + esc(p.name) + (p.id === me ? " (you)" : "") + '</span><span class="t">' + tag + '</span><b>' + p.score + "</b></div>";
        }).join("") + "</div>";
        if (V.phase === "standings") html += '<div class="nd-foot">' + (isHost ? '<button class="btn nd-again">Play again</button>' : '<span class="nd-sub">waiting for the host to restart…</span>') + '<button class="btn ghost nd-leave">Leave</button></div>';
        html += "</div>";
        ui.side.innerHTML = html;
        ui.side.querySelectorAll(".nd-choice").forEach(function (b) { b.onclick = function () { if (!V || V.phase !== "pick") return; V.choices = null; snd("pick"); toHost({ k: "picked", w: b.dataset.w }); renderSide(); }; });
        ui.side.querySelectorAll(".nd-opt").forEach(function (b) { b.onclick = function () { if (!V || V.phase !== "round" || V.guessed[me] || V.spectating) return; toHost({ k: "guess", i: +b.dataset.i }); b.classList.add("sent"); }; });
        ui.side.querySelectorAll(".nd-leave").forEach(function (b) { b.onclick = function () { try { Arcade.mpLobby.leave(); } catch (e) {} if (mode === "mp") endMp(); }; });
        const again = ui.side.querySelector(".nd-again"); if (again) again.onclick = function () { Arcade.mpLobby.restart(); };
        ui.bar = ui.side.querySelector(".nd-timebar i"); ui.time = ui.side.querySelector(".nd-time");
        tickTimer();
      }
      function tickTimer() {
        if (!V || V.phase !== "round" || !ui.bar) return;
        const left = Math.max(0, V.endsAt - Date.now()), sec = Math.ceil(left / 1000);
        ui.bar.style.width = (100 * left / V.dur).toFixed(1) + "%"; ui.bar.classList.toggle("low", left < 10000);
        if (ui.time) ui.time.textContent = sec + "s";
        if (left > 0 && left <= 5000 && sec !== V.lastSec) { V.lastSec = sec; snd("tick"); }
      }

      return {
        mount(stage, c) {
          stageEl = stage; ctx = c;
          styleEl = document.createElement("style");
          styleEl.textContent =
            ".nd-root{position:relative;display:flex;gap:18px;align-items:flex-start;justify-content:center;width:min(97vw,1180px);--cvs:min(58vw,66vh,700px)}" +
            ".nd-root.nd-title-mode{align-items:center;justify-content:center;min-height:50vh}" +
            ".nd-title{text-align:center;max-width:560px;padding:18px}.nd-logo{font-size:clamp(40px,7vw,68px);font-weight:800;letter-spacing:-.02em;line-height:1}.nd-logo em{font-style:normal;color:var(--accent);text-shadow:0 0 28px color-mix(in srgb,var(--accent) 60%,transparent)}" +
            ".nd-tag{opacity:.72;font-size:16px;margin:14px 0 6px}.nd-how{display:flex;flex-wrap:wrap;justify-content:center;gap:8px 18px;font-size:13px;opacity:.6;margin-bottom:10px}.nd-title .btn-row{justify-content:center;flex-wrap:wrap}" +
            ".nd-left{display:flex;flex-direction:column;align-items:center;gap:10px;flex:0 0 auto}" +
            ".nd-cvwrap{position:relative;width:var(--cvs);height:var(--cvs);border-radius:18px;overflow:hidden;border:1px solid color-mix(in srgb,var(--accent) 40%,transparent);box-shadow:0 0 40px color-mix(in srgb,var(--accent) 14%,transparent),0 0 0 1px rgba(255,255,255,.04) inset;background:" + BG + "}" +
            ".nd-canvas{display:block;width:100%;height:100%;touch-action:none;cursor:not-allowed;user-select:none;-webkit-user-select:none}.nd-canvas.can{cursor:crosshair}" +
            ".nd-badge{position:absolute;top:10px;left:12px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;padding:4px 10px;border-radius:999px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.12);opacity:.85;pointer-events:none}" +
            ".nd-tools{display:flex;flex-direction:column;gap:8px;width:var(--cvs);transition:opacity .2s}.nd-tools.off{opacity:.35;pointer-events:none}" +
            ".nd-swatches{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}.nd-sw{width:44px;height:44px;border-radius:50%;border:2px solid rgba(255,255,255,.12);background:var(--c);cursor:pointer;box-shadow:0 0 12px color-mix(in srgb,var(--c) 35%,transparent);transition:transform .1s}.nd-sw.on{border-color:#fff;transform:scale(1.12);box-shadow:0 0 18px var(--c)}" +
            ".nd-brushes{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;align-items:center}.nd-br{width:44px;height:44px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);cursor:pointer;display:flex;align-items:center;justify-content:center}.nd-br i{display:block;border-radius:50%;background:var(--fg,#e6ecf5)}.nd-br.on{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 18%,transparent)}" +
            ".nd-tb{min-height:44px;padding:0 14px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:var(--fg,#e6ecf5);font:inherit;font-size:14px;cursor:pointer}.nd-tb.on{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 18%,transparent)}.nd-tb:hover{border-color:rgba(255,255,255,.3)}" +
            ".nd-side{display:flex;flex-direction:column;gap:12px;flex:0 0 310px;max-height:calc(var(--cvs) + 120px);overflow:auto}" +
            ".nd-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:12px 14px}.nd-h{font-weight:800;font-size:13px;letter-spacing:.05em;text-transform:uppercase;opacity:.8;margin-bottom:8px}.nd-sub{opacity:.7;font-size:14px;margin:0;line-height:1.45}" +
            ".nd-timer{display:flex;align-items:center;gap:10px;margin-bottom:10px}.nd-timebar{flex:1;height:10px;border-radius:6px;background:rgba(255,255,255,.08);overflow:hidden}.nd-timebar i{display:block;height:100%;width:100%;background:var(--accent);box-shadow:0 0 12px var(--accent);transition:width .25s linear}.nd-timebar i.low{background:#ff8fb1;box-shadow:0 0 12px #ff8fb1}.nd-time{font-variant-numeric:tabular-nums;font-weight:700;min-width:34px;text-align:right}" +
            ".nd-word{font-size:26px;font-weight:800;letter-spacing:.12em;text-align:center;color:var(--accent);text-shadow:0 0 18px color-mix(in srgb,var(--accent) 50%,transparent);padding:6px 0 2px}.nd-lbl{display:block;font-size:11px;letter-spacing:.1em;text-transform:uppercase;opacity:.55;color:var(--fg,#e6ecf5);text-shadow:none;margin-bottom:4px}" +
            ".nd-reveal{text-align:center;padding:6px 0}.nd-reveal b{display:block;font-size:30px;color:#ffd36b;text-shadow:0 0 22px rgba(255,211,107,.5)}.nd-reveal small{display:block;opacity:.7;margin-top:6px;font-size:13px}" +
            ".nd-choices{display:flex;flex-direction:column;gap:8px;margin-top:8px}.nd-choice{min-height:48px;border-radius:12px;border:1px solid color-mix(in srgb,var(--accent) 50%,transparent);background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--fg,#e6ecf5);font:inherit;font-size:17px;font-weight:700;cursor:pointer}.nd-choice:hover{background:color-mix(in srgb,var(--accent) 24%,transparent)}" +
            ".nd-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.nd-opt{min-height:48px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:var(--fg,#e6ecf5);font:inherit;font-size:15px;font-weight:600;cursor:pointer;padding:6px 8px;transition:transform .08s}.nd-opt:not(:disabled):hover{border-color:var(--accent);transform:scale(1.03)}.nd-opt:disabled{opacity:.45;cursor:default}.nd-opt.sent{border-color:var(--accent)}" +
            ".nd-opt.ok{opacity:1!important;border-color:#7fe0a0;background:rgba(127,224,160,.18);box-shadow:0 0 16px rgba(127,224,160,.35)}.nd-opt.bad{opacity:1!important;border-color:#ff8fb1;background:rgba(255,143,177,.14)}" +
            ".nd-players{display:flex;flex-direction:column;gap:4px}.nd-p{display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:10px;font-size:14px}.nd-p.me{background:color-mix(in srgb,var(--accent) 12%,transparent)}.nd-p.drawer .n{color:var(--accent)}.nd-p .n{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.nd-p .t{width:22px;text-align:center;opacity:.8}.nd-p b{min-width:40px;text-align:right;font-variant-numeric:tabular-nums}" +
            ".nd-foot{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px}.nd-foot .btn{margin-top:0}" +
            ".nd-toast{position:absolute;left:50%;top:10px;transform:translate(-50%,-12px);opacity:0;background:rgba(20,17,42,.95);border:1px solid color-mix(in srgb,var(--accent) 50%,transparent);border-radius:999px;padding:8px 16px;font-size:14px;z-index:5;pointer-events:none;transition:opacity .25s,transform .25s;box-shadow:0 0 24px color-mix(in srgb,var(--accent) 25%,transparent)}.nd-toast.go{opacity:1;transform:translate(-50%,0)}" +
            "@media (max-width:900px){.nd-root{flex-direction:column;align-items:center;gap:12px;--cvs:min(94vw,50vh);align-self:flex-start;max-height:100%;overflow-y:auto;padding:4px 0 24px}.nd-root.nd-title-mode{align-self:center;overflow:visible}.nd-side{flex:0 0 auto;width:min(94vw,520px);max-height:none;overflow:visible}.nd-tools{width:min(94vw,520px)}.nd-word{font-size:22px}}";
          document.head.appendChild(styleEl);
          root = document.createElement("div"); root.className = "nd-root"; stage.appendChild(root);
          ctx.setScore(0);
          showTitle();
          Arcade._draw = { get: function () { return { mode: mode, me: me, hostId: hostId, isHost: isHost, ended: ended, phase: V ? V.phase : null, drawerId: V ? V.drawerId : null, word: V ? V.word : null, choices: V ? V.choices : null, options: V ? V.options : null, mask: V ? V.mask : null, guessed: V ? V.guessed : null, roster: V ? V.roster : null, turn: V ? V.turn : 0, total: V ? V.total : 0, reveal: V ? V.reveal : null, strokes: strokes.length, host: H ? { phase: H.phase, word: H.word, drawerId: H.drawerId } : null }; } };
        },
        handleInput() { /* pointer + buttons are wired directly on our own DOM */ },
        tick() {
          if (dirty) render();
          if (mode === "mp" && V && V.phase === "round") tickTimer();
          if (isHost) hostTick();
        },
        pause() {}, resume() {},
        getScore() { return mode === "mp" && V ? myScore() : 0; },
        teardown() {
          if (mode === "mp") { try { Arcade.mpLobby.leave(); } catch (e) {} }
          try { if (window.Arcade && Arcade.mpLobby) Arcade.mpLobby.close(); } catch (e) {}
          try { if (window.Arcade && Arcade.net) Arcade.net.disconnect(); } catch (e) {}
          if (batchT) clearTimeout(batchT); batchT = null;
          timers.forEach(clearTimeout); timers = [];
          listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); }); listeners = [];
          if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl); styleEl = null;
          if (root && root.parentNode) root.parentNode.removeChild(root);
          try { delete Arcade._draw; } catch (e) {}
          root = stageEl = ctx = cv = g = off = og = null; V = H = null; ui = {}; strokes = []; pending = []; mode = "title"; me = hostId = null; isHost = ended = false;
        }
      };
    }
  });
})();
