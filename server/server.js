/* Neon Arcade realtime relay — rooms over WebSocket for multiplayer games (Frog Quest first).
   Runs on dad's box (Node 16, CentOS 7) behind Apache: wss://play.vaultdigitaltools.com/ws → 127.0.0.1:8787.

   Design: the server is a thin, authenticated RELAY. It does not simulate games. Each room has a host
   (the game's authority) and up to MAX_PLAYERS peers; messages are forwarded, rate-limited and size-capped.
   Auth: every client must present a Clerk session JWT (verified against the instance's public JWKS —
   no secret key needed). Names are sanitized + filtered so public play later is a small step.

   Protocol (JSON text frames):
     client → server:  {t:"hello", token, name}        must be first; replies {t:"welcome", id, name}
                       {t:"host", mode:"coop"|"pvp"}    → {t:"room", code, mode, hostId, players:[{id,name}]}
                       {t:"join", code}                 → {t:"room", …} to everyone in the room
                       {t:"leave"}
                       {t:"msg", d}                     relay d to everyone else in the room  ({t:"msg", from, d})
                       {t:"to", id, d}                  relay d to one peer                    ({t:"msg", from, d})
                       {t:"ping"}                       → {t:"pong"}
     server → client:  {t:"error", code, message} · {t:"room", …} (on every membership change) · {t:"host", hostId} on migration
   Env: PORT (8787), CLERK_JWKS_URL, ALLOW_GUEST=1 (LOCAL TESTING ONLY: accepts hello without a token). */
"use strict";
const http = require("http");
const https = require("https");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");
const fs = require("fs");
const path = require("path");

const PORT = +process.env.PORT || 8787;
const JWKS_URL = process.env.CLERK_JWKS_URL || "https://pro-elephant-6619.clerk.accounts.dev/.well-known/jwks.json";
const ALLOW_GUEST = process.env.ALLOW_GUEST === "1";
const MAX_PLAYERS = 6, MAX_MSG_BYTES = 8192, MSGS_PER_SEC = 40, CONNS_PER_IP = 8, IDLE_MS = 90000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const MAX_SAVE_BYTES = 256 * 1024;   // per user cloud save blob
try { fs.mkdirSync(path.join(DATA_DIR, "saves"), { recursive: true }); } catch (e) {}

// ---- Clerk JWT verification via JWKS (RS256) ----
let jwks = { keys: [], fetched: 0 };
function fetchJwks() {
  return new Promise((resolve) => {
    https.get(JWKS_URL, { headers: { "User-Agent": "neon-arcade-relay" } }, (res) => {
      let body = ""; res.on("data", (c) => (body += c)); res.on("end", () => { try { jwks = { keys: JSON.parse(body).keys || [], fetched: Date.now() }; } catch (e) {} resolve(); });
    }).on("error", () => resolve());
  });
}
function b64url(s) { return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64"); }
async function verifyClerkToken(token) {
  if (typeof token !== "string" || token.split(".").length !== 3) return null;
  const [h, p, sig] = token.split(".");
  let header, payload;
  try { header = JSON.parse(b64url(h).toString("utf8")); payload = JSON.parse(b64url(p).toString("utf8")); } catch (e) { return null; }
  if (header.alg !== "RS256") return null;
  if (!jwks.keys.length || Date.now() - jwks.fetched > 6 * 3600e3 || !jwks.keys.find((k) => k.kid === header.kid)) await fetchJwks();
  const jwk = jwks.keys.find((k) => k.kid === header.kid);
  if (!jwk) return null;
  let ok = false;
  try { const key = crypto.createPublicKey({ key: jwk, format: "jwk" }); ok = crypto.verify("RSA-SHA256", Buffer.from(h + "." + p), key, b64url(sig)); } catch (e) { ok = false; }
  if (!ok) return null;
  const nowS = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < nowS - 30) return null;
  if (payload.nbf && payload.nbf > nowS + 30) return null;
  return payload;   // { sub: "user_…", sid, exp, … }
}

// ---- names ----
const BAD = ["fuck", "shit", "bitch", "cunt", "nigg", "fag", "dick", "cock", "pussy", "whore", "slut", "rape", "hitler", "nazi", "kkk"];
function cleanName(n, fallback) {
  n = String(n || "").replace(/[^\w \-.'!]/g, "").trim().slice(0, 14);
  const low = n.toLowerCase().replace(/[^a-z]/g, "");
  if (!n || BAD.some((w) => low.includes(w))) n = fallback;
  return n;
}

// ---- rooms ----
const rooms = new Map();     // code → { code, mode, hostId, players: Map<id, client>, created }
const clients = new Map();   // id → client
const perIp = new Map();
const CODE_ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function newCode() { let c; do { c = ""; for (let i = 0; i < 5; i++) c += CODE_ALPHA[crypto.randomInt(CODE_ALPHA.length)]; } while (rooms.has(c)); return c; }
function send(c, obj) { if (c.ws.readyState === 1) { try { c.ws.send(JSON.stringify(obj)); } catch (e) {} } }
function roomState(r) { return { t: "room", code: r.code, mode: r.mode, hostId: r.hostId, players: [...r.players.values()].map((c) => ({ id: c.id, name: c.name })) }; }
function broadcastRoom(r) { const st = roomState(r); r.players.forEach((c) => send(c, st)); }
function leaveRoom(c, why) {
  const r = c.room; if (!r) return; c.room = null;
  r.players.delete(c.id);
  r.players.forEach((o) => send(o, { t: "peer-leave", id: c.id, name: c.name, why: why || "left" }));
  if (!r.players.size) { rooms.delete(r.code); return; }
  if (r.hostId === c.id) { r.hostId = r.players.keys().next().value; r.players.forEach((o) => send(o, { t: "host", hostId: r.hostId })); }
  broadcastRoom(r);
}

// ---- cloud saves: one JSON blob per user, per-key last-write-wins on timestamps ----
function safeId(id) { return String(id || "").replace(/[^A-Za-z0-9_\-]/g, "").slice(0, 80); }
function savePath(uid) { return path.join(DATA_DIR, "saves", safeId(uid) + ".json"); }
function readSave(uid) { try { return JSON.parse(fs.readFileSync(savePath(uid), "utf8")); } catch (e) { return { data: {}, ts: {}, name: null }; } }
function writeJsonAtomic(file, obj) { const tmp = file + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(obj)); fs.renameSync(tmp, file); }
function mergeSave(cur, inc) {   // inc: { data:{key:value}, ts:{key:ms} }
  cur.data = cur.data || {}; cur.ts = cur.ts || {};
  Object.keys(inc.data || {}).forEach((k) => { const t = +(inc.ts && inc.ts[k]) || 0; if (!(k in cur.data) || t >= (+cur.ts[k] || 0)) { cur.data[k] = inc.data[k]; cur.ts[k] = t; } });
  return cur;
}
// ---- leaderboards: best per user per board; lower-is-better boards end with ":low" ----
const boardsFile = path.join(DATA_DIR, "boards.json");
let boards = {}; try { boards = JSON.parse(fs.readFileSync(boardsFile, "utf8")); } catch (e) { boards = {}; }
let boardsDirty = false; setInterval(() => { if (boardsDirty) { boardsDirty = false; try { writeJsonAtomic(boardsFile, boards); } catch (e) {} } }, 3000);
function boardTop(name, limit) { const b = boards[name] || {}; const low = /:low$/.test(name); return Object.keys(b).map((uid) => Object.assign({ uid: uid.slice(0, 8) }, b[uid])).sort((a, z) => low ? a.score - z.score : z.score - a.score).slice(0, limit || 20); }

function readBody(req, limit) { return new Promise((resolve, reject) => { let body = "", size = 0; req.on("data", (c) => { size += c.length; if (size > limit) { reject(new Error("too big")); req.destroy(); return; } body += c; }); req.on("end", () => resolve(body)); req.on("error", reject); }); }
const ORIGINS = ["https://play.vaultdigitaltools.com", "https://geoakser-afk.github.io"];
function cors(req, res) { const o = req.headers.origin; if (o && (ORIGINS.indexOf(o) >= 0 || ALLOW_GUEST)) { res.setHeader("Access-Control-Allow-Origin", o); res.setHeader("Vary", "Origin"); } else if (ALLOW_GUEST && !o) res.setHeader("Access-Control-Allow-Origin", "*"); res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type"); res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS"); res.setHeader("Access-Control-Max-Age", "600"); }
function json(res, code, obj) { res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(obj)); }
const httpBucket = new Map();
function httpAllowed(ip) { const t = Date.now(); const b = httpBucket.get(ip) || { n: 0, t: t }; if (t - b.t > 10000) { b.n = 0; b.t = t; } b.n++; httpBucket.set(ip, b); return b.n <= 60; }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  cors(req, res); if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  const ip = (req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "?").toString().split(",")[0].trim();
  if (url.pathname === "/ws/health" || url.pathname === "/health") return json(res, 200, { ok: true, rooms: rooms.size, clients: clients.size, uptime: Math.round(process.uptime()), boards: Object.keys(boards).length });
  if (!httpAllowed(ip)) return json(res, 429, { error: "slow down" });
  // public: leaderboard read
  if (url.pathname === "/ws/board" && req.method === "GET") { const name = String(url.searchParams.get("game") || "").slice(0, 60); if (!name) return json(res, 400, { error: "game?" }); return json(res, 200, { game: name, top: boardTop(name, Math.min(50, +url.searchParams.get("limit") || 20)) }); }
  // authenticated
  const auth = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  let claims = auth ? await verifyClerkToken(auth) : null;
  if (!claims && ALLOW_GUEST && /^guest:/.test(auth)) claims = { sub: "guest_" + safeId(auth.slice(6)) };   // local testing only
  if (!claims) return json(res, 401, { error: "sign in" });
  const uid = claims.sub;
  if (url.pathname === "/ws/save" && req.method === "GET") { return json(res, 200, readSave(uid)); }
  if (url.pathname === "/ws/save" && (req.method === "PUT" || req.method === "POST")) {
    let body; try { body = JSON.parse(await readBody(req, MAX_SAVE_BYTES)); } catch (e) { return json(res, 413, { error: "save too big or not JSON" }); }
    const cur = mergeSave(readSave(uid), body || {}); if (body && body.name) cur.name = cleanName(body.name, cur.name || "Frog"); cur.updated = Date.now();
    try { writeJsonAtomic(savePath(uid), cur); } catch (e) { return json(res, 500, { error: "could not write" }); }
    return json(res, 200, { ok: true, keys: Object.keys(cur.data).length, ts: cur.ts });
  }
  if (url.pathname === "/ws/score" && req.method === "POST") {
    let body; try { body = JSON.parse(await readBody(req, 4096)); } catch (e) { return json(res, 400, { error: "bad json" }); }
    const name = String(body.game || "").replace(/[^a-z0-9:_\-]/gi, "").slice(0, 60), score = +body.score;
    if (!name || !isFinite(score) || score < 0 || score > 1e9) return json(res, 400, { error: "bad score" });
    const low = /:low$/.test(name); boards[name] = boards[name] || {};
    const prev = boards[name][uid];
    if (!prev || (low ? score < prev.score : score > prev.score)) { boards[name][uid] = { name: cleanName(body.name, "Frog"), score: Math.round(score * 100) / 100, when: Date.now() }; boardsDirty = true; }
    else if (prev && body.name && prev.name !== cleanName(body.name, prev.name)) { prev.name = cleanName(body.name, prev.name); boardsDirty = true; }
    const top = boardTop(name, 20); const rank = Object.keys(boards[name]).map((u) => ({ u, s: boards[name][u].score })).sort((a, z) => low ? a.s - z.s : z.s - a.s).findIndex((r) => r.u === uid) + 1;
    return json(res, 200, { ok: true, best: boards[name][uid].score, rank: rank, top: top, improved: !prev || boards[name][uid].when === (boards[name][uid] || {}).when && (!prev || (low ? score < prev.score : score > prev.score)) });
  }
  json(res, 404, { error: "not found" });
});
const wss = new WebSocketServer({ server, path: "/ws", maxPayload: MAX_MSG_BYTES });

wss.on("connection", (ws, req) => {
  const ip = (req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "?").toString().split(",")[0].trim();
  const n = (perIp.get(ip) || 0) + 1; perIp.set(ip, n);
  if (n > CONNS_PER_IP) { ws.close(1008, "too many connections"); perIp.set(ip, n - 1); return; }
  const c = { id: crypto.randomBytes(6).toString("hex"), ws, ip, name: null, user: null, room: null, last: Date.now(), bucket: MSGS_PER_SEC, bucketT: Date.now(), authed: false };
  ws.on("message", async (raw) => {
    c.last = Date.now();
    // token bucket
    const t = Date.now(); c.bucket = Math.min(MSGS_PER_SEC, c.bucket + (t - c.bucketT) * MSGS_PER_SEC / 1000); c.bucketT = t;
    if (c.bucket < 1) return; c.bucket -= 1;
    let m; try { m = JSON.parse(raw.toString("utf8")); } catch (e) { return send(c, { t: "error", code: "bad_json" }); }
    if (!m || typeof m.t !== "string") return;
    if (!c.authed) {
      if (m.t !== "hello") return send(c, { t: "error", code: "hello_first" });
      let claims = null;
      if (m.token) claims = await verifyClerkToken(m.token);
      if (!claims && !ALLOW_GUEST) return send(c, { t: "error", code: "auth", message: "Sign in to play together." });
      c.user = claims ? claims.sub : "guest_" + c.id;
      c.name = cleanName(m.name, "Frog " + c.id.slice(0, 3).toUpperCase());
      c.authed = true; clients.set(c.id, c);
      return send(c, { t: "welcome", id: c.id, name: c.name, guest: !claims });
    }
    if (m.t === "ping") return send(c, { t: "pong", now: Date.now() });
    if (m.t === "host") {
      leaveRoom(c);
      const r = { code: newCode(), mode: m.mode === "pvp" ? "pvp" : "coop", hostId: c.id, players: new Map([[c.id, c]]), created: Date.now() };
      rooms.set(r.code, r); c.room = r; return broadcastRoom(r);
    }
    if (m.t === "join") {
      const r = rooms.get(String(m.code || "").toUpperCase().trim());
      if (!r) return send(c, { t: "error", code: "no_room", message: "No room with that code." });
      if (r.players.size >= MAX_PLAYERS) return send(c, { t: "error", code: "full", message: "That room is full." });
      leaveRoom(c); c.room = r; r.players.set(c.id, c);
      r.players.forEach((o) => { if (o !== c) send(o, { t: "peer-join", id: c.id, name: c.name }); });
      return broadcastRoom(r);
    }
    if (m.t === "leave") return leaveRoom(c);
    if (m.t === "msg" || m.t === "to") {
      const r = c.room; if (!r) return;
      const out = { t: "msg", from: c.id, d: m.d };
      if (m.t === "to") { const o = r.players.get(m.id); if (o) send(o, out); return; }
      r.players.forEach((o) => { if (o !== c) send(o, out); });
    }
  });
  ws.on("close", () => { leaveRoom(c, "disconnected"); clients.delete(c.id); perIp.set(ip, Math.max(0, (perIp.get(ip) || 1) - 1)); });
  ws.on("error", () => {});
});
setInterval(() => { const t = Date.now(); clients.forEach((c) => { if (t - c.last > IDLE_MS) { try { c.ws.close(1000, "idle"); } catch (e) {} } }); }, 15000);

fetchJwks().then(() => server.listen(PORT, "127.0.0.1", () => console.log("[arcade-ws] listening on 127.0.0.1:" + PORT + (ALLOW_GUEST ? "  (GUESTS ALLOWED — local testing)" : "") + "  jwks keys: " + jwks.keys.length)));
