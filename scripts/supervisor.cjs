"use strict";
const { spawn } = require("node:child_process");
const c = require("./common.cjs");
const instance = process.argv[process.argv.indexOf("--instance") + 1];
if (!/^[a-f0-9-]{36}$/.test(instance || "")) throw Error("Missing runtime identity.");
const state = { schema: 1, product: c.PRODUCT, version: c.version().version, instance, pid: process.pid, config: c.config(), workerEnabled: !process.argv.includes("--no-worker"), status: "starting", startedAt: new Date().toISOString(), children: {}, failures: {} };
const children = new Map(), attempts = new Map(), misses = new Map();
let stopping = false;
const persist = () => c.write(c.STATE, state);
const entries = { api: "app/local-server/server.js", ui: "scripts/ui-server.cjs", worker: "app/worker/worker.js" };
function launch(name) {
  if (stopping || state.status === "failed") return;
  c.fs.mkdirSync(c.path.join(c.ROOT, "logs"), { recursive: true });
  const fd = c.fs.openSync(c.path.join(c.ROOT, "logs", `${name}-runtime.log`), "a");
  const child = spawn(process.execPath, [c.path.join(c.ROOT, entries[name]), "--mrz-instance", instance], {
    cwd: c.path.join(c.ROOT, "app"), windowsHide: true, stdio: ["ignore", fd, fd],
    env: { ...process.env, MRZ_STUDIO_ROOT: c.ROOT, MRZ_INSTANCE_ID: instance, LOCAL_API_HOST: "127.0.0.1", LOCAL_API_PORT: String(state.config.api), MRZ_UI_PORT: String(state.config.ui) },
  });
  c.fs.closeSync(fd); children.set(name, child);
  state.children[name] = { pid: child.pid, entry: entries[name], startedAt: Date.now() }; persist();
  c.fs.writeFileSync(c.path.join(c.CONTROL, { api: "server.pid", ui: "vite.pid", worker: "worker.pid" }[name]), String(child.pid || ""));
  child.on("error", error => failed(name, error.message));
  child.on("exit", (code, signal) => {
    if (children.get(name) !== child) return;
    children.delete(name);
    if (!stopping) failed(name, `exited (${signal || code})`);
  });
}
function failed(name, reason) {
  if (stopping || state.status === "failed" || state.children[name]?.restarting) return;
  if (name === "worker") {
    const hb = c.read(c.path.join(c.CONTROL, "heartbeat.json"));
    if (hb?.instance === instance && hb.current_job_id) {
      state.status = "failed"; state.detail = "The worker stopped during a job. Inspect queue/processing before restarting; the job will not be replayed automatically."; persist(); return;
    }
  }
  const recent = (attempts.get(name) || []).filter(t => Date.now() - t < 300000);
  recent.push(Date.now()); attempts.set(name, recent);
  state.failures[name] = reason;
  if (recent.length > 3) { state.status = "failed"; state.detail = `${name} could not recover. Run mrz doctor.`; persist(); return; }
  state.status = "recovering"; state.children[name].restarting = true; persist();
  const child = children.get(name);
  if (child) { children.delete(name); child.kill(); }
  setTimeout(() => { misses.set(name, 0); launch(name); }, 750 * recent.length);
}
async function stop() {
  if (stopping) return;
  stopping = true; state.status = "stopping"; persist();
  c.write(c.path.join(c.CONTROL, "worker-stop.json"), { instance, at: Date.now() });
  const worker = children.get("worker");
  // Windows signals terminate processes immediately. The worker uses a file request
  // and finishes its active job before exiting; never terminate it during an update.
  if (worker && worker.exitCode === null && worker.signalCode === null) await new Promise(resolve => worker.once("exit", resolve));
  c.write(c.REQUEST, { instance, action: "stop", phase: "services", at: Date.now() });
  for (const name of ["ui", "api"]) {
    const child = children.get(name);
    if (child) await new Promise(resolve => { if (child.exitCode !== null || child.signalCode !== null) return resolve(); child.once("exit", resolve); });
  }
  state.status = "stopped"; state.children = {}; persist();
  for (const file of [c.REQUEST, c.path.join(c.CONTROL, "worker-stop.json")]) if (c.read(file)?.instance === instance) c.fs.rmSync(file, { force: true });
  process.exit(0);
}
async function main() {
  persist(); launch("api"); launch("ui"); if (state.workerEnabled) launch("worker");
  while (!stopping) {
    if (c.read(c.REQUEST)?.instance === instance && c.read(c.REQUEST)?.action === "stop") return stop();
    const health = await c.readiness(state);
    if (state.status !== "failed") {
      const next = health.ready ? "ready" : state.status === "starting" ? "starting" : "recovering";
      if (next !== state.status || state.detail !== (health.reason || null)) { state.status = next; state.detail = health.reason || null; persist(); }
      if (Date.now() - Date.parse(state.startedAt) > 20000) {
        for (const name of ["api", "ui"]) {
          try { await c.json(state.config[name + "Url"] + (name === "api" ? "/api/health" : "/__mrz/health")); misses.set(name, 0); }
          catch { misses.set(name, (misses.get(name) || 0) + 1); if (misses.get(name) >= 3) failed(name, "health check timed out"); }
        }
        const hb = c.read(c.path.join(c.CONTROL, "heartbeat.json"));
        if (state.workerEnabled && (!hb || hb.instance !== instance || Date.now() - Date.parse(hb.last_seen_at) > 30000) && !hb?.current_job_id) failed("worker", "heartbeat timed out");
      }
    }
    await c.delay(1000);
  }
}
process.on("SIGINT", stop); process.on("SIGTERM", stop);
main().catch(error => { console.error(error); state.status = "failed"; state.detail = error.message; persist(); process.exitCode = 1; });
