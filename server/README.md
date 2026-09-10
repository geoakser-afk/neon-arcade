# Arcade realtime relay (`server/`)

The multiplayer backbone for the Neon Arcade: a small Node WebSocket relay with rooms. It does **not** run games —
the room host's browser is the authority (Frog Quest co-op) or each client is authoritative for its own frog (PvP).
The server authenticates (Clerk JWT via public JWKS), makes rooms, forwards messages, rate-limits, filters names.

- Lives on dad's box (`george@web`, CentOS 7, Node 16 at `/usr/local/bin/node`) in `/opt/arcade-server`.
- Runs as systemd unit `arcade-ws` on `127.0.0.1:8787`; Apache proxies `wss://play.vaultdigitaltools.com/ws` to it
  (lines added to `/etc/httpd/vhost.d/play.vaultdigitaltools.com-le-ssl.conf` by `deploy/deploy.sh`).
- Health: `https://play.vaultdigitaltools.com/ws/health` → `{ok, rooms, clients, uptime}`.
- Redeploy: `bash deploy/deploy.sh` uploads `server/server.js`, installs the unit if missing, restarts the service.
- Logs on the box: `sudo journalctl -u arcade-ws -f`.
- Local testing: `ALLOW_GUEST=1 PORT=8787 node server/server.js` accepts connections without a Clerk token
  (never set that on the box).

Client side: `shell/auth.js` (Clerk sign-in, `Arcade.auth`) and `shell/net.js` (`Arcade.net` room client).
Clerk app: "Neon Arcade" (development instance `pro-elephant-6619.clerk.accounts.dev`). To go production later:
`clerk deploy` (needs DNS CNAMEs on vaultdigitaltools.com) and swap the publishable key in `shell/auth.js`.
