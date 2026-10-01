/** Configuration only: this module never launches a connector or changes server ports. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const MAX_BYTES = 64 * 1024;
const SIGNATURE = { mode: "first_name_only", width: 420, height: 123 };
const DEFAULTS = {
  version: 1,
  studio: { api_base: "http://127.0.0.1:8787", ui_base: "http://127.0.0.1:5173" },
  connectors: [{
    id: "employee-id", display_name: "Employee ID", enabled: true,
    glass_kind: "local_stdio", command: "node",
    args: ["C:\\Users\\Agent\\cyclone-coord\\employee-id-mcp\\dist\\server.js"],
    http_url: "http://127.0.0.1:8791/mcp", auto_signature: SIGNATURE,
    notes: "Fallback stdio MCP until Glass ships dedicated Employee ID connector.",
  }],
};

class SettingsError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
function invalid(message) { throw new SettingsError(422, "INVALID_SETTINGS", message); }
function object(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid(`${label} must be an object.`);
  for (const key of Object.keys(value)) if (!keys.includes(key)) invalid(`${label}: unsupported field ${key}.`);
}
function text(value, label, max, empty = false) {
  if (typeof value !== "string" || (!empty && !value.trim()) || value.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) invalid(`${label} must be ${empty ? "0" : "1"}–${max} characters.`);
  return value.trim();
}
function address(value, label, empty = false) {
  const raw = text(value, label, 2048, empty);
  if (!raw && empty) return "";
  let url;
  try { url = new URL(raw); } catch { invalid(`${label} must be a complete http or https URL.`); }
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password || url.search || url.hash) invalid(`${label} must be an http or https URL without credentials, query parameters, or fragments.`);
  return url.href.replace(/\/$/, "");
}
function validate(value) {
  object(value, ["version", "studio", "connectors"], "Settings");
  if (value.version !== 1) invalid("Unsupported settings version. Expected version 1.");
  object(value.studio, ["api_base", "ui_base"], "Studio");
  if (!Array.isArray(value.connectors) || value.connectors.length > 20) invalid("Use at most 20 connectors.");
  const ids = new Set();
  return {
    version: 1,
    studio: { api_base: address(value.studio.api_base, "Studio API address"), ui_base: address(value.studio.ui_base, "Studio UI address") },
    connectors: value.connectors.map((c, i) => {
      const label = `Connector ${i + 1}`;
      object(c, ["id", "display_name", "enabled", "glass_kind", "command", "args", "http_url", "auto_signature", "notes"], label);
      const id = text(c.id, `${label} ID`, 64);
      if (!/^[a-z][a-z0-9_-]*$/.test(id) || ids.has(id)) invalid("Connector IDs must be unique lowercase names (letters, numbers, - or _).");
      ids.add(id);
      if (typeof c.enabled !== "boolean") invalid(`${label}: enabled must be true or false.`);
      if (!["local_stdio", "remote_http"].includes(c.glass_kind)) invalid(`${label}: choose a supported connection type.`);
      const command = text(c.command ?? "", `${label} command`, 200, c.glass_kind !== "local_stdio");
      if (/[\r\n]/.test(command)) invalid(`${label}: command must be one line.`);
      if (!Array.isArray(c.args) || c.args.length > 40 || c.args.some(a => typeof a !== "string" || a.length > 2048 || /[\x00-\x1f\x7f]/.test(a))) invalid(`${label}: arguments must be an array of up to 40 strings without control characters. Double backslashes in JSON paths.`);
      const http_url = address(c.http_url ?? "", `${label} MCP address`, c.glass_kind !== "remote_http");
      const out = { id, display_name: text(c.display_name, `${label} name`, 100), enabled: c.enabled, glass_kind: c.glass_kind, command, args: [...c.args], http_url, notes: text(c.notes ?? "", `${label} notes`, 2000, true) };
      if (c.auto_signature !== undefined) {
        object(c.auto_signature, ["mode", "width", "height"], "Signature policy");
        if (Object.entries(SIGNATURE).some(([key, val]) => c.auto_signature[key] !== val)) invalid("Employee ID signature policy is first_name_only at 420 × 123.");
        out.auto_signature = { ...SIGNATURE };
      }
      if (id === "employee-id" && !out.auto_signature) out.auto_signature = { ...SIGNATURE };
      return out;
    }),
  };
}
function revision(data) { return '"' + crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex") + '"'; }

function createStore(control) {
  const file = path.join(control, "mcp-connections.json");
  function write(data) {
    fs.mkdirSync(control, { recursive: true });
    const temp = file + "." + crypto.randomUUID() + ".tmp";
    try {
      const fd = fs.openSync(temp, "wx", 0o600);
      try { fs.writeFileSync(fd, JSON.stringify(data, null, 2) + "\n", "utf8"); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      fs.renameSync(temp, file);
    } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
  }
  function get() {
    let raw;
    try { raw = fs.readFileSync(file, "utf8"); }
    catch (err) { if (err.code !== "ENOENT") throw err; const data = validate(DEFAULTS); write(data); return { data, etag: revision(data) }; }
    try { const data = validate(JSON.parse(raw)); return { data, etag: revision(data) }; }
    catch { throw new SettingsError(409, "SETTINGS_FILE_INVALID", "The saved MCP settings file is invalid. Restore or repair control/mcp-connections.json; it has not been overwritten."); }
  }
  function put(value, expected) {
    const data = validate(value);
    if (!expected) throw new SettingsError(428, "REVISION_REQUIRED", "Load settings before saving.");
    if (get().etag !== expected) throw new SettingsError(409, "SETTINGS_CHANGED", "Settings changed in another tab. Reload the saved version before saving your changes.");
    write(data);
    return { data, etag: revision(data) };
  }
  return { get, put, file };
}

function createSettingsHandler(control) {
  const store = createStore(control);
  return async function settings(req, res) {
    const pathname = (req.url || "").split("?")[0];
    if (pathname !== "/api/mcp-connections") return false;
    const origin = req.headers.origin;
    let validHost = false;
    try { validHost = ["127.0.0.1", "localhost", "[::1]"].includes(new URL(`http://${req.headers.host}`).hostname); } catch {}
    const allowed = ["http://127.0.0.1:5173", "http://localhost:5173"];
    const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", Vary: "Origin", "X-Content-Type-Options": "nosniff" };
    if (allowed.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
    const reply = (status, body, extra = {}) => { res.writeHead(status, { ...headers, ...extra }); res.end(body === null ? undefined : JSON.stringify(body)); };
    try {
      if (!validHost || (origin && !allowed.includes(origin)) || (req.headers["sec-fetch-site"] === "cross-site" && !allowed.includes(origin))) throw new SettingsError(403, "LOCAL_UI_ONLY", "Open settings from the local MRZ Studio UI.");
      if (req.method === "OPTIONS") { reply(204, null, { "Access-Control-Allow-Methods": "GET, PUT, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, If-Match", "Access-Control-Expose-Headers": "ETag" }); return true; }
      let result;
      if (req.method === "GET") result = store.get();
      else if (req.method === "PUT") {
        if ((req.headers["content-type"] || "").split(";")[0].trim() !== "application/json") throw new SettingsError(415, "JSON_REQUIRED", "Send application/json.");
        const chunks = []; let size = 0;
        for await (const chunk of req) { size += chunk.length; if (size > MAX_BYTES) throw new SettingsError(413, "SETTINGS_TOO_LARGE", "Settings must be smaller than 64 KB."); chunks.push(chunk); }
        let body;
        try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new SettingsError(400, "INVALID_JSON", "Settings must contain valid JSON."); }
        result = store.put(body, req.headers["if-match"]);
      } else { reply(405, { error: "Use GET or PUT." }, { Allow: "GET, PUT, OPTIONS" }); return true; }
      reply(200, result.data, { ETag: result.etag, "Access-Control-Expose-Headers": "ETag" });
    } catch (err) { reply(err.status || 500, { error: err.status ? err.message : "MCP settings could not be read or saved. Check access to the control folder.", code: err.code || "SETTINGS_IO_ERROR" }); }
    return true;
  };
}
module.exports = { createStore, createSettingsHandler, validate, DEFAULTS };
