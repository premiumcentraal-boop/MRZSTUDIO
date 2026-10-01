"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync, spawn } = require("node:child_process");
const ROOT = path.resolve(__dirname, "..");
const CONTROL = path.join(ROOT, "control");
const STATE = path.join(CONTROL, "runtime.json");
const REQUEST = path.join(CONTROL, "runtime-request.json");
const PRODUCT = "mrz-studio-local";
const read = (file, fallback = null) => { try { return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "")); } catch { return fallback; } };
const version = (root = ROOT) => read(path.join(root, "release", "version.json"));
const { write } = require("./atomic-json.cjs");
function inside(root, relative) {
  if (typeof relative !== "string" || !relative || relative.includes("\\") || relative.includes(":") || relative.startsWith("/") || relative.split("/").some(p => !p || p === "." || p === "..")) throw Error("Unsafe package path.");
  if (relative.split("/").some(p => /[<>"|?*\x00-\x1f]/.test(p) || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))) throw Error("Unsafe Windows package path.");
  const resolved = path.resolve(root, relative);
  if (!resolved.startsWith(path.resolve(root) + path.sep)) throw Error("Path is outside Studio.");
  let parent = resolved;
  while (parent !== path.resolve(root)) {
    if (fs.existsSync(parent) && fs.lstatSync(parent).isSymbolicLink()) throw Error("Linked paths cannot be updated or served.");
    parent = path.dirname(parent);
  }
  return resolved;
}
function managed(relative) {
  try { inside(ROOT, relative); } catch { return false; }
  if (/(^|\/)(node_modules|\.git|\.env[^/]*|local-worker|templates|output|out|queue|control|logs|artifacts)(\/|$)/i.test(relative) || /\.(psd|psb|log|debug)$/i.test(relative)) return false;
  if (relative.startsWith("app/docs/archive/") || /(?:[-_]log\.txt|\.(?:tmp|bak|zip|exe|dll))$/i.test(relative)) return false;
  return /^(scripts\/|release\/|app\/(src\/|dist\/|public\/|local-server\/|tests\/|scripts\/|docs\/|worker\/(scripts\/|[^/]+$))|\.github\/workflows\/)/.test(relative)
    || /^(mrz\.cmd|(?:Start|Stop|Update|Install)-MRZ-(?:Local|Command)\.(?:cmd|ps1)|package(?:-lock)?\.json|README(?:-LOCAL)?\.md|VERSION|app\/VERSION|PATHS\.md|\.gitignore|app\/[^/]+\.(?:json|ts|mjs|cjs|html|md|yaml))$/.test(relative);
}
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function config() {
  const api = Number(process.env.LOCAL_API_PORT || 8787), ui = Number(process.env.MRZ_UI_PORT || 5173);
  if (![api, ui].every(p => Number.isInteger(p) && p > 1024 && p < 65536) || api === ui) throw Error("API and UI ports must be different numbers between 1025 and 65535.");
  return { api, ui, apiUrl: `http://127.0.0.1:${api}`, uiUrl: `http://127.0.0.1:${ui}` };
}
async function json(url, timeout = 2000) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeout), redirect: "error" });
  if (!response.ok) throw Error(`HTTP ${response.status}`);
  const text = await response.text();
  if (text.length > 128 * 1024) throw Error("Health response is too large.");
  return JSON.parse(text);
}
function processInfo(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  try {
    if (process.platform === "win32") {
      const result = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", path.join(ROOT, "scripts", "process-info.ps1"), "-ProcessId", String(pid)], { encoding: "utf8", windowsHide: true, timeout: 5000 });
      return JSON.parse(result.replace(/^\uFEFF/, ""));
    }
    process.kill(pid, 0);
    return { pid, command: fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").replace(/\0/g, " ") };
  } catch { return null; }
}
function owned(record, entry, instance) {
  if (!["scripts/mrz.cjs", "scripts/supervisor.cjs", "scripts/ui-server.cjs", "app/local-server/server.js", "app/worker/worker.js"].includes(entry) || (instance && !/^[a-f0-9-]{36}$/i.test(instance))) return false;
  const info = processInfo(record?.pid);
  if (!info) return false;
  const normalized = String(info.command).replace(/\\/g, "/").toLowerCase();
  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const executable = escape(process.execPath.replace(/\\/g, "/").toLowerCase());
  const script = escape(path.resolve(ROOT, entry).replace(/\\/g, "/").toLowerCase());
  return new RegExp(`^(?:"${executable}"|${executable})\\s+(?:"${script}"|${script})(?:\\s|$)`).test(normalized)
    && (!instance || normalized.includes(instance.toLowerCase()));
}
function killOwned(record, entry, instance) {
  if (owned(record, entry, instance)) { try { process.kill(record.pid, "SIGTERM"); } catch {} return true; }
  return false;
}
async function lock(action) {
  fs.mkdirSync(CONTROL, { recursive: true });
  const folder = path.join(CONTROL, ".lifecycle-lock");
  for (let attempt = 0; ; attempt++) {
    try { fs.mkdirSync(folder); write(path.join(folder, "owner.json"), { pid: process.pid, at: Date.now() }); break; }
    catch (error) {
      if (error.code !== "EEXIST") throw error;
      const owner = read(path.join(folder, "owner.json"));
      if (attempt || !owner || Date.now() - owner.at < 2000 || processInfo(owner.pid)) throw Error("Another start, stop or update is running. Try again when it finishes.");
      fs.rmSync(path.join(folder, "owner.json"), { force: true }); fs.rmdirSync(folder);
    }
  }
  try { return await action(); }
  finally { fs.rmSync(path.join(folder, "owner.json"), { force: true }); fs.rmdirSync(folder); }
}
async function readiness(state, root = ROOT) {
  if (!state || !state.instance) return { ready: false, reason: "Studio is stopped." };
  try {
    const [api, ui] = await Promise.all([json(state.config.apiUrl + "/api/health"), json(state.config.uiUrl + "/__mrz/health")]);
    const v = version(root);
    const matching = x => x.product === PRODUCT && x.version === v.version && x.instance === state.instance;
    if (!matching(api.studio || {}) || !matching(ui) || api.studio.pid !== state.children?.api?.pid || ui.pid !== state.children?.ui?.pid || path.resolve(api.root) !== path.resolve(root)) return { ready: false, reason: "A different Studio instance is using these ports." };
    if (state.workerEnabled && !(api.worker.online && api.worker.instance === state.instance && api.worker.pid === state.children?.worker?.pid)) return { ready: false, reason: "Waiting for the worker heartbeat." };
    return { ready: true, api, ui, generationReady: api.worker.online && api.template.present && (api.photoshop.found || api.dryRun) };
  } catch (error) { return { ready: false, reason: error.message }; }
}
async function busy(state = read(STATE)) {
  if (!state?.workerEnabled) return false;
  const heartbeat = read(path.join(CONTROL, "heartbeat.json"));
  if (heartbeat?.instance === state.instance && heartbeat.current_job_id && owned(state.children?.worker, "app/worker/worker.js", state.instance)) return true;
  try { const h = await json(state.config.apiUrl + "/api/health"); return !!(h.worker.online && h.worker.current_job_id); } catch { return false; }
}
function browser(url) {
  const args = process.platform === "win32" ? ["url.dll,FileProtocolHandler", url] : [url];
  const child = spawn(process.platform === "win32" ? "rundll32.exe" : "xdg-open", args, { detached: true, windowsHide: true, stdio: "ignore" });
  child.on("error", () => {}); child.unref();
}
module.exports = { fs, path, crypto, ROOT, CONTROL, STATE, REQUEST, PRODUCT, read, write, version, inside, managed, hash, delay, config, json, owned, killOwned, lock, readiness, busy, browser };
