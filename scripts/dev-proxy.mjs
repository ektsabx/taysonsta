#!/usr/bin/env node
// Local dev front door on :3200 (docs/12-decisions.md D-011).
//   http://localhost:3200        → Yolias (customer app)   on YOLIAS_PORT (3201)
//   http://admin.localhost:3200  → Yolias Admin            on ADMIN_PORT  (3202)
// Browsers resolve *.localhost to 127.0.0.1, so no hosts-file change is needed.
// Plain Node (no dependencies). Forwards HTTP and WebSocket upgrades (HMR)
// and keeps the original Host header so cookies, server actions and redirects
// see the public URL.

import http from "node:http";
import net from "node:net";

const PORT = Number(process.env.PROXY_PORT || 3200);
const YOLIAS_PORT = Number(process.env.YOLIAS_PORT || 3201);
const ADMIN_PORT = Number(process.env.ADMIN_PORT || 3202);

function isAdminHost(host) {
  return (host || "").toLowerCase().split(":")[0].startsWith("admin.");
}

function targetPort(req) {
  return isAdminHost(req.headers.host) ? ADMIN_PORT : YOLIAS_PORT;
}

function forwardedHeaders(req) {
  const headers = { ...req.headers };
  headers["x-forwarded-host"] = req.headers.host || "";
  headers["x-forwarded-proto"] = "http";
  headers["x-forwarded-port"] = String(PORT);
  headers["x-forwarded-for"] = req.socket.remoteAddress || "";
  return headers;
}

function unavailable(res, port) {
  if (res.headersSent) return res.end();
  res.writeHead(502, { "content-type": "text/html; charset=utf-8", "retry-after": "2" });
  res.end(`<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="2">
<title>Starting…</title><body style="font-family:system-ui;padding:40px;color:#444">
<p>The app on port ${port} is starting. This page reloads by itself.</p></body>`);
}

const appOf = (port) => (port === ADMIN_PORT ? "admin" : "yolias");

const server = http.createServer((req, res) => {
  // Health/self-test: which app would this host get?
  if (req.url === "/__yolias-proxy") {
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    return res.end(JSON.stringify({ proxy: true, host: req.headers.host, app: appOf(targetPort(req)) }));
  }
  // admin.localhost:3200/ opens the admin directly.
  if (isAdminHost(req.headers.host) && (req.url === "/" || req.url?.startsWith("/?"))) {
    res.writeHead(302, { location: "/admin" });
    return res.end();
  }
  const port = targetPort(req);
  const upstream = http.request(
    { host: "127.0.0.1", port, method: req.method, path: req.url, headers: forwardedHeaders(req) },
    (up) => {
      // Next.js builds absolute redirects from its own port (e.g. :3201);
      // point them back at the public host.
      const loc = up.headers.location;
      if (loc) up.headers.location = loc.replace(new RegExp(`^https?://(localhost|127\\.0\\.0\\.1|\\[::1\\]):${port}(?=/|$)`), `http://${req.headers.host}`);
      // Which app answered — handy when checking routing in devtools.
      up.headers["x-yolias-app"] = appOf(port);
      res.writeHead(up.statusCode || 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on("error", () => unavailable(res, port));
  req.pipe(upstream);
});

// WebSockets (Next.js HMR): replay the request line + headers to the target
// and splice the two sockets together.
server.on("upgrade", (req, socket, head) => {
  const port = targetPort(req);
  const conn = net.connect(port, "127.0.0.1", () => {
    const headers = forwardedHeaders(req);
    const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
    for (const [k, v] of Object.entries(headers)) {
      for (const value of Array.isArray(v) ? v : [v]) lines.push(`${k}: ${value}`);
    }
    conn.write(`${lines.join("\r\n")}\r\n\r\n`);
    if (head?.length) conn.write(head);
    conn.pipe(socket);
    socket.pipe(conn);
  });
  const close = () => {
    socket.destroy();
    conn.destroy();
  };
  conn.on("error", close);
  socket.on("error", close);
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.error(`✖ Port ${PORT} is already in use by another program (often an old "next dev").`);
    console.error(`  Stop it, then run "npm run local" again. On macOS/Linux: lsof -ti:${PORT} | xargs kill`);
  } else {
    console.error(`✖ Proxy failed: ${e.message}`);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`▸ Yolias       http://localhost:${PORT}        (→ :${YOLIAS_PORT})`);
  console.log(`▸ Yolias Admin http://admin.localhost:${PORT}  (→ :${ADMIN_PORT})`);
});
