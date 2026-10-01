#!/usr/bin/env node
"use strict";
const { spawnSync } = require("node:child_process");
const c = require("./common.cjs"), runtime = require("./runtime.cjs"), updates = require("./update.cjs");
const args = process.argv.slice(2), command = args[0] || "help";
const option = flag => { const index = args.indexOf(flag); if (index < 0) return undefined; if (!args[index + 1] || args[index + 1].startsWith("--")) throw Error(`${flag} needs a value.`); return args[index + 1]; };
function show(result) {
  if (args.includes("--json")) return console.log(JSON.stringify(result, null, 2));
  if (result.ready) {
    console.log(`MRZ Studio ${result.state.version} is ready: ${result.state.config.uiUrl}`);
    console.log(result.state.workerEnabled ? (result.generationReady ? "Worker and Photoshop template are ready." : "Worker is ready. Run mrz doctor to check Photoshop and your template.") : "Worker is disabled for this session.");
  } else if (result.stopped) console.log("MRZ Studio is stopped.");
  else if (result.draining) console.log("MRZ Studio will stop after its current job finishes. Run mrz status to check.");
  else if (result.updated) console.log(`Updated to ${result.version}. Previous version saved for mrz rollback.`);
  else if (result.rolledBack) console.log(`Restored MRZ Studio ${result.version}.`);
  else if (result.available) console.log(`Update ${result.latest} is available (installed: ${result.current}). Run mrz update.`);
  else console.log(result.message || `MRZ Studio ${result.current} is up to date.`);
}
async function status(doctor = false) {
  const state = c.read(c.STATE), owned = c.owned(state, "scripts/supervisor.cjs", state?.instance), health = owned ? await c.readiness(state) : { ready: false, reason: "Studio is stopped." };
  const result = { version: c.version().version, status: owned ? state.status : "stopped", ready: health.ready, url: state?.config.uiUrl || c.config().uiUrl, detail: state?.detail || health.reason || null };
  if (doctor) {
    result.node = process.version; result.build = c.read(c.path.join(c.ROOT, "app/dist/mrz-build.json"));
    result.ports = Object.fromEntries(await Promise.all([c.config().api, c.config().ui].map(async port => [port, await runtime.available(port) ? "free" : "in use"])));
    try { const h = await c.json(c.config().apiUrl + "/api/health"); result.photoshop = { found: h.photoshop.found, path: h.photoshop.path }; result.template = h.template; result.worker = h.worker; } catch { result.api = "not responding"; }
    result.processingJobs = c.fs.existsSync(c.path.join(c.ROOT, "queue/processing")) ? c.fs.readdirSync(c.path.join(c.ROOT, "queue/processing")).filter(name => c.fs.statSync(c.path.join(c.ROOT, "queue/processing", name)).isDirectory()).length : 0;
    result.logs = c.path.join(c.ROOT, "logs"); result.updateRecovery = c.read(c.path.join(c.CONTROL, "update-transaction.json"))?.status || "none";
  }
  if (args.includes("--json")) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`MRZ Studio ${result.version}: ${result.status}${result.ready ? " (healthy)" : ""}`);
    if (result.ready) console.log(result.url); else if (result.detail) console.log(result.detail);
    if (doctor) { console.log(`Node: ${result.node}. UI build: ${result.build?.version || "missing"}.`); console.log(`Photoshop: ${result.photoshop?.found ? "found" : "not configured"}. Template: ${result.template?.present ? "found" : "missing"}. Worker: ${result.worker?.online ? "online" : "offline"}.`); console.log(`Jobs requiring inspection in queue/processing: ${result.processingJobs}. Logs: ${result.logs}`); }
  }
  return result;
}
async function main() {
  if (Number(process.versions.node.split(".")[0]) < 22) throw Error("MRZ Studio requires Node.js 22 or newer. Install the current Node.js LTS, then retry.");
  if (["help", "--help", "-h"].includes(command)) return console.log("MRZ Studio Local\n  mrz start        Start and open Studio\n  mrz stop         Finish current job, then stop\n  mrz restart      Restart when idle\n  mrz status       Show live status\n  mrz doctor       Check setup and health\n  mrz update --check   Check GitHub for a compatible release\n  mrz update       Verify, install and restart\n  mrz rollback     Restore the previous update\n  mrz build        Build UI from source (developers)\n  mrz version      Show installed version\nOptions: --no-browser, --no-worker (start), --json. Offline update: --file ZIP --manifest JSON.");
  if (command === "version") return console.log(c.version().version);
  if (["status", "doctor"].includes(command)) return status(command === "doctor");
  if (command === "update" && args.includes("--check")) return show(await updates.check());
  await c.lock(async () => {
    if (command !== "build") { await updates.recover(); updates.initialize(); }
    switch (command) {
      case "start": return show(await runtime.start({ worker: !args.includes("--no-worker"), open: !args.includes("--no-browser") }));
      case "stop": return show(await runtime.stop());
      case "restart": {
        const state = c.read(c.STATE), stopped = await runtime.stop({ refuseBusy: true });
        if (!stopped.stopped) throw Error("Restart will wait until the active job finishes. Run mrz start when Studio is stopped.");
        return show(await runtime.start({ worker: state?.workerEnabled !== false, open: !args.includes("--no-browser") }));
      }
      case "update": return show(await updates.update({ archive: option("--file"), manifestFile: option("--manifest") }));
      case "rollback": return show(await updates.rollback());
      case "build": {
        if (c.owned(c.read(c.STATE), "scripts/supervisor.cjs", c.read(c.STATE)?.instance)) throw Error("Stop Studio before rebuilding its installed UI.");
        const build = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", c.path.join(c.ROOT, "scripts/build.ps1")], { cwd: c.ROOT, stdio: "inherit", windowsHide: true });
        if (build.error || build.status !== 0) throw Error("The source build failed. The previous version was not started.");
        runtime.ensureBuild(); updates.baseline(); console.log(`MRZ Studio ${c.version().version} built. Run mrz start.`); return;
      }
      default: throw Error(`Unknown command: ${command}. Run mrz help.`);
    }
  });
}
main().catch(error => { console.error(`MRZ Studio: ${error.message}`); process.exitCode = 1; });
