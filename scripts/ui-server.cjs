"use strict";
const http = require("node:http");
const c = require("./common.cjs");
const cfg = c.config(), dist = c.path.join(c.ROOT, "app", "dist");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".ttf": "font/ttf", ".wasm": "application/wasm" };
const server = http.createServer((req, res) => {
  const finish = (status, text) => { res.writeHead(status, { "Content-Type": "text/plain", "Cache-Control": "no-store" }); res.end(text); };
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, cfg.uiUrl).pathname); } catch { return finish(400, "Bad path"); }
  if (pathname === "/__mrz/health") {
    if (req.method !== "GET") return finish(405, "Method not allowed");
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    return res.end(JSON.stringify({ ...c.read(c.path.join(dist, "mrz-build.json")), instance: process.env.MRZ_INSTANCE_ID, pid: process.pid }));
  }
  if (pathname.startsWith("/api/")) {
    // Proxy only to our configured loopback API. No user-supplied upstream address.
    const upstream = http.request({ host: "127.0.0.1", port: cfg.api, path: req.url, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${cfg.api}` }, timeout: 20000 }, response => { res.writeHead(response.statusCode, response.headers); response.pipe(res); });
    upstream.on("timeout", () => upstream.destroy()); upstream.on("error", () => { if (!res.headersSent) finish(503, "Studio API is starting. Try again shortly."); else res.destroy(); });
    req.on("aborted", () => upstream.destroy()); return req.pipe(upstream);
  }
  if (!["GET", "HEAD"].includes(req.method)) return finish(405, "Method not allowed");
  let file;
  try { file = pathname === "/" ? c.path.join(dist, "index.html") : c.inside(dist, pathname.slice(1)); } catch { return finish(400, "Bad path"); }
  if (!c.fs.existsSync(file) || !c.fs.statSync(file).isFile()) {
    if (pathname.startsWith("/assets/") || c.path.extname(pathname)) return finish(404, "Not found");
    file = c.path.join(dist, "index.html");
  }
  if (!c.fs.existsSync(file)) return finish(503, "Studio UI is not built. Run mrz build.");
  res.writeHead(200, { "Content-Type": types[c.path.extname(file)] || "application/octet-stream", "X-Content-Type-Options": "nosniff", "Cache-Control": file.endsWith("index.html") ? "no-store" : "public, max-age=3600" });
  if (req.method === "HEAD") return res.end();
  const stream = c.fs.createReadStream(file); stream.on("error", () => res.destroy()); stream.pipe(res);
});
server.listen(cfg.ui, "127.0.0.1", () => console.log(`Studio UI ${c.version().version}: ${cfg.uiUrl}`));
let closing = false;
function shutdown() {
  if (closing) return; closing = true;
  server.close(() => process.exit(0)); server.closeIdleConnections();
  setTimeout(() => server.closeAllConnections(), 15000).unref();
}
if (process.env.MRZ_INSTANCE_ID) setInterval(() => {
  const request = c.read(c.REQUEST);
  if (request?.instance === process.env.MRZ_INSTANCE_ID && request.phase === "services") shutdown();
}, 300).unref();
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
