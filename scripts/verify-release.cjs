"use strict";
const { spawn, execFileSync } = require("node:child_process"), net = require("node:net");
const c = require("./common.cjs");
const port = () => new Promise(resolve => { const server = net.createServer(); server.listen(0, "127.0.0.1", () => { const value = server.address().port; server.close(() => resolve(value)); }); });
async function verify() {
  const manifest = require("./update.cjs").validate(c.read(c.path.join(c.ROOT, "artifacts/releases/mrz-local-release.json")));
  const zip = c.path.join(c.ROOT, "artifacts/releases", manifest.archive);
  if (c.hash(zip) !== manifest.archive_sha256) throw Error("Release ZIP does not match its manifest.");
  const parent = c.path.join(c.ROOT, "artifacts/launcher-build"), root = c.path.join(parent, "fresh-" + c.crypto.randomUUID());
  c.fs.mkdirSync(root, { recursive: true });
  let run;
  try {
    execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", c.path.join(c.ROOT, "scripts/archive.ps1"), "-Mode", "Unpack", "-Archive", zip, "-Directory", root], { windowsHide: true, timeout: 60000, stdio: "pipe" });
    require("./update.cjs").verifyStage(root, manifest);
    const api = await port(), ui = await port();
    const env = { ...process.env, LOCAL_API_PORT: String(api), MRZ_UI_PORT: String(ui), LOCAL_DRY_RUN: "1", MRZ_STUDIO_ROOT: root };
    run = args => new Promise(resolve => {
      const child = spawn(process.execPath, [c.path.join(root, "scripts/mrz.cjs"), ...args], { cwd: root, env, windowsHide: true }); let output = "";
      child.stdout.on("data", data => output += data); child.stderr.on("data", data => output += data); child.once("close", exit => resolve({ exit, output }));
    });
    if (c.fs.existsSync(c.path.join(root, "app/node_modules"))) throw Error("Release unexpectedly contains node_modules.");
    let result = await run(["start", "--no-browser", "--json"]);
    if (result.exit) throw Error(result.output);
    const health = JSON.parse(result.output);
    if (!health.ready || !health.api.worker.online || health.ui.version !== manifest.version) throw Error("Fresh package failed startup checks.");
    const page = await fetch(`http://127.0.0.1:${ui}/settings/mcp`);
    if (!page.ok || !(await page.text()).includes('<div id="root">')) throw Error("Fresh settings route failed.");
    const asset = Object.keys(manifest.files).find(n => /^app\/dist\/assets\/index-.*\.js$/.test(n));
    if (!asset || !(await fetch(`http://127.0.0.1:${ui}/` + asset.replace("app/dist/", ""))).ok) throw Error("Fresh UI asset failed.");
    result = await run(["stop", "--json"]);
    if (result.exit || !JSON.parse(result.output).stopped) throw Error("Fresh package failed stop checks.");
    const report = { passed: true, noNpmNeeded: true, version: manifest.version, worker: true, settingsRoute: true, asset: true, stopped: true, at: new Date().toISOString() };
    c.write(c.path.join(parent, "fresh-package-result.json"), report); console.log(JSON.stringify(report, null, 2));
  } finally {
    if (run) { const stopped = await run(["stop"]); if (stopped.exit) throw Error("Fresh test runtime could not stop; preserved its folder for inspection."); }
    if (c.path.dirname(root) !== parent || c.fs.lstatSync(root).isSymbolicLink()) throw Error("Unsafe fresh-package cleanup.");
    c.fs.rmSync(root, { recursive: true, force: true });
  }
}
if (require.main === module) verify().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { verify };
