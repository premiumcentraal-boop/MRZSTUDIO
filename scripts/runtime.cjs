"use strict";
const net = require("node:net");
const { spawn, execFileSync } = require("node:child_process");
const c = require("./common.cjs");
function ensureBuild() {
  const stamp = c.read(c.path.join(c.ROOT, "app/dist/mrz-build.json"));
  if (!c.fs.existsSync(c.path.join(c.ROOT, "app/dist/index.html")) || stamp?.product !== c.PRODUCT || stamp.version !== c.version().version || stamp.local !== true) throw Error("The installed UI is missing or belongs to another version. Run mrz build, or reinstall the verified local release.");
}
const available = port => new Promise(resolve => { const server = net.createServer(); server.once("error", () => resolve(false)); server.listen(port, "127.0.0.1", () => server.close(() => resolve(true))); });
function portProcess(port) {
  if (process.platform !== "win32") return null;
  try { return JSON.parse(execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", c.path.join(c.ROOT, "scripts/process-info.ps1"), "-Port", String(port)], { encoding: "utf8", windowsHide: true, timeout: 8000 })); } catch { return null; }
}
async function legacyStop() {
  const cfg = c.config();
  let health;
  try { health = await c.json(cfg.apiUrl + "/api/health"); } catch { return; }
  if (c.path.resolve(health.root || "/") !== c.ROOT || health.mode !== "local" || health.studio?.instance) return;
  if (health.worker?.online && health.worker.current_job_id) throw Error("The previous worker is processing a job. Wait for it to finish before switching launchers.");
  for (const [name, port, expected] of [["server", cfg.api, /local-server[\\/]server\.js/i], ["vite", cfg.ui, /vite[\\/]bin[\\/]vite\.js/i]]) {
    const info = portProcess(port), saved = Number(c.fs.existsSync(c.path.join(c.CONTROL, name + ".pid")) && c.fs.readFileSync(c.path.join(c.CONTROL, name + ".pid"), "utf8"));
    if (info && info.pid === saved && /node(?:\.exe)?[" ]/i.test(info.command || "") && expected.test(info.command)) { try { process.kill(info.pid); } catch {} }
  }
  const workerFile = c.path.join(c.CONTROL, "worker.pid");
  if (c.fs.existsSync(workerFile)) c.killOwned({ pid: Number(c.fs.readFileSync(workerFile, "utf8")) }, "app/worker/worker.js");
  await c.delay(600);
}
async function start({ worker = true, open = false } = {}) {
  ensureBuild();
  const old = c.read(c.STATE);
  if (c.owned(old, "scripts/supervisor.cjs", old?.instance)) {
    const health = await c.readiness(old);
    if (!health.ready || old.status === "failed" || old.status === "stopping") throw Error(`Studio is ${old.status}: ${old.detail || health.reason || "run mrz doctor"}.`);
    if (old.workerEnabled !== worker) throw Error("Studio is already running with a different worker setting. Stop it before changing that setting.");
    if (open) c.browser(old.config.uiUrl); return { ...health, state: old, reused: true };
  }
  if (await c.busy(old)) throw Error("A surviving worker is processing a job. Wait for completion before restarting.");
  await stopOrphans(old);
  await legacyStop();
  const cfg = c.config();
  if (!(await available(cfg.api)) || !(await available(cfg.ui))) throw Error(`A different program is using port ${cfg.api} or ${cfg.ui}. Studio left it running. Run mrz doctor to inspect the conflict.`);
  const instance = c.crypto.randomUUID();
  c.fs.mkdirSync(c.path.join(c.ROOT, "logs"), { recursive: true });
  const fd = c.fs.openSync(c.path.join(c.ROOT, "logs/runtime.log"), "a");
  const child = spawn(process.execPath, [c.path.join(c.ROOT, "scripts/supervisor.cjs"), "--instance", instance, ...(worker ? [] : ["--no-worker"])], { cwd: c.ROOT, detached: true, windowsHide: true, stdio: ["ignore", fd, fd], env: { ...process.env, LOCAL_API_PORT: String(cfg.api), MRZ_UI_PORT: String(cfg.ui) } });
  c.fs.closeSync(fd);
  let launchError; child.on("error", e => { launchError = e; }); child.unref();
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (launchError) throw launchError;
    const state = c.read(c.STATE);
    if (state?.instance === instance) {
      const health = await c.readiness(state);
      if (health.ready && state.status === "ready") { if (open) c.browser(cfg.uiUrl); return { ...health, state, reused: false }; }
      if (state.status === "failed") break;
    }
    await c.delay(300);
  }
  const state = c.read(c.STATE);
  if (state?.instance === instance) await stop();
  throw Error(`Studio could not become ready: ${state?.detail || "startup timed out"}. Run mrz doctor.`);
}
async function stop({ refuseBusy = false } = {}) {
  const state = c.read(c.STATE);
  if (!c.owned(state, "scripts/supervisor.cjs", state?.instance)) {
    if (await c.busy(state)) throw Error("A surviving worker is processing a job. Wait before stopping or updating.");
    await stopOrphans(state);
    await legacyStop(); return { stopped: true };
  }
  if (refuseBusy && await c.busy(state)) throw Error("Studio is processing a job. Update after it finishes.");
  c.write(c.REQUEST, { instance: state.instance, action: "stop", at: Date.now() });
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const current = c.read(c.STATE);
    if (current?.instance === state.instance && current.status === "stopped" && await available(state.config.api) && await available(state.config.ui)) return { stopped: true, state };
    if (await c.busy(state)) return { stopped: false, draining: true, state };
    await c.delay(300);
  }
  throw Error("Studio is still stopping. Its current job will be preserved. Run mrz status before trying again.");
}
async function stopOrphans(state) {
  if (!state?.instance) return;
  const worker = state.children?.worker;
  if (c.owned(worker, "app/worker/worker.js", state.instance)) {
    c.write(c.path.join(c.CONTROL, "worker-stop.json"), { instance: state.instance, at: Date.now() });
    for (let tries = 0; tries < 10; tries++) { await c.delay(300); if (!c.owned(worker, "app/worker/worker.js", state.instance)) break; }
    if (c.owned(worker, "app/worker/worker.js", state.instance)) throw Error("A surviving worker is finishing its job. Try again when it has stopped.");
  }
  for (const child of Object.values(state.children || {})) if (child.entry !== "app/worker/worker.js") c.killOwned(child, child.entry, state.instance);
}
module.exports = { start, stop, available, ensureBuild, legacyStop, portProcess };
