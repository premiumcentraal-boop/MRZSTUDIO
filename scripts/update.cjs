"use strict";
const { execFileSync, spawn } = require("node:child_process");
const net = require("node:net");
const c = require("./common.cjs");
const runtime = require("./runtime.cjs");
const JOURNAL = c.path.join(c.CONTROL, "update-transaction.json"), INSTALLED = c.path.join(c.CONTROL, "installed-files.json");
const semver = value => typeof value === "string" && /^\d+\.\d+\.\d+$/.test(value);
const newer = (a, b) => { const x = a.split(".").map(Number), y = b.split(".").map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };
function validate(manifest) {
  if (manifest?.schema !== 1 || manifest.product !== c.PRODUCT || !semver(manifest.version) || !manifest.files || typeof manifest.files !== "object" || Array.isArray(manifest.files)) throw Error("This release is not a compatible MRZ Studio Local package.");
  const names = Object.keys(manifest.files), seen = new Set();
  if (names.length < 6 || names.length > 8000) throw Error("Invalid package file count.");
  for (const name of names) {
    if (!c.managed(name) || seen.has(name.toLowerCase()) || !/^[a-f0-9]{64}$/.test(manifest.files[name])) throw Error(`Unsafe package file: ${name}`);
    seen.add(name.toLowerCase());
  }
  for (const name of names) {
    const parts = name.split("/");
    for (let i = 1; i < parts.length; i++) if (seen.has(parts.slice(0, i).join("/").toLowerCase())) throw Error("A package path is both a file and a directory.");
  }
  for (const required of ["release/version.json", "scripts/mrz.cjs", "scripts/update.cjs", "scripts/supervisor.cjs", "app/local-server/server.js", "app/worker/worker.js", "app/dist/index.html", "app/dist/mrz-build.json", "mrz.cmd"]) if (!names.includes(required)) throw Error(`Incomplete local release: ${required}`);
  return manifest;
}
async function github(url, limit = 2 * 1024 * 1024) {
  let current = new URL(url);
  for (let i = 0; i < 6; i++) {
    if (current.protocol !== "https:" || !["api.github.com", "github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com", "github-releases.githubusercontent.com"].includes(current.hostname) || current.username || current.password) throw Error("Update download must come from GitHub over HTTPS.");
    const response = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(60000), headers: { "User-Agent": "MRZ-Studio-Local", Accept: "application/vnd.github+json" } });
    if (response.status >= 300 && response.status < 400) { current = new URL(response.headers.get("location"), current); continue; }
    if (!response.ok) throw Error(`GitHub returned HTTP ${response.status}. Nothing was installed.`);
    const declared = Number(response.headers.get("content-length"));
    if (declared > limit) throw Error("Update download is too large.");
    const chunks = []; let size = 0;
    for await (const chunk of response.body) { size += chunk.length; if (size > limit) throw Error("Update download is too large."); chunks.push(chunk); }
    return Buffer.concat(chunks);
  }
  throw Error("Too many update redirects.");
}
async function check() {
  const repository = c.version().repository;
  if (repository !== "premiumcentraal-boop/MRZSTUDIO") throw Error("Unexpected update repository.");
  const releases = JSON.parse((await github(`https://api.github.com/repos/${repository}/releases?per_page=30`)).toString("utf8"));
  if (!Array.isArray(releases)) throw Error("GitHub returned an invalid release list.");
  for (const release of releases.filter(r => !r.draft && !r.prerelease)) {
    const asset = release.assets?.find(a => a.name === "mrz-local-release.json");
    if (!asset) continue; // Historical source-only V7 ZIPs are not installable local releases.
    const prefix = `https://github.com/${repository}/releases/download/`;
    if (!asset.browser_download_url.startsWith(prefix)) throw Error("Unexpected release manifest URL.");
    const manifest = validate(JSON.parse((await github(asset.browser_download_url)).toString("utf8")));
    const archive = release.assets.find(a => a.name === manifest.archive);
    if (!archive || !archive.browser_download_url.startsWith(prefix) || !/^[a-f0-9]{64}$/.test(manifest.archive_sha256) || !Number.isInteger(manifest.archive_size) || manifest.archive_size <= 0 || manifest.archive_size > 256 * 1024 * 1024) throw Error("The release is missing its verified archive.");
    return { available: newer(manifest.version, c.version().version), current: c.version().version, latest: manifest.version, manifest, url: archive.browser_download_url, releaseUrl: release.html_url };
  }
  return { available: false, current: c.version().version, latest: null, message: "No compatible local update has been published. Older source-only V7 releases are skipped." };
}
function walk(folder, relative = "") {
  const result = [];
  for (const entry of c.fs.readdirSync(c.path.join(folder, relative), { withFileTypes: true })) {
    const name = relative ? relative + "/" + entry.name : entry.name;
    if (entry.isSymbolicLink()) throw Error("Package contains a linked path.");
    if (entry.isDirectory()) result.push(...walk(folder, name)); else result.push(name);
  }
  return result;
}
function verifyStage(stage, manifest) {
  validate(manifest);
  const embedded = c.read(c.path.join(stage, "package-manifest.json"));
  if (!embedded || embedded.product !== manifest.product || embedded.version !== manifest.version || JSON.stringify(embedded.files) !== JSON.stringify(manifest.files)) throw Error("Package and release manifest do not match.");
  const all = walk(stage);
  if (all.length !== Object.keys(manifest.files).length + 1 || all.some(name => name !== "package-manifest.json" && !Object.hasOwn(manifest.files, name))) throw Error("Package contains unexpected files.");
  for (const [name, expected] of Object.entries(manifest.files)) if (c.hash(c.inside(stage, name)) !== expected) throw Error(`Package checksum failed: ${name}`);
  const stamp = c.read(c.path.join(stage, "app/dist/mrz-build.json")), v = c.read(c.path.join(stage, "release/version.json"));
  if (stamp?.version !== manifest.version || stamp?.product !== c.PRODUCT || stamp.local !== true || v?.version !== manifest.version || v.repository !== c.version().repository) throw Error("Package UI or update source belongs to another version.");
}
function baseline() {
  const files = {};
  for (const name of require("./build-release.cjs").files(c.ROOT)) files[name] = c.hash(c.inside(c.ROOT, name));
  c.write(INSTALLED, { schema: 1, product: c.PRODUCT, version: c.version().version, files });
}
function initialize() {
  if (c.fs.existsSync(INSTALLED)) return;
  const embedded = c.read(c.path.join(c.ROOT, "package-manifest.json"));
  if (!embedded) return;
  validate(embedded);
  for (const [name, expected] of Object.entries(embedded.files)) if (c.hash(c.inside(c.ROOT, name)) !== expected) throw Error(`Installed package checksum failed: ${name}`);
  if (embedded.version !== c.version().version) throw Error("Installed package version does not match.");
  c.write(INSTALLED, embedded);
}
function conflicts(manifest) {
  const installed = c.read(INSTALLED);
  if (!installed?.files || installed.product !== c.PRODUCT) throw Error("Installed file records are missing. Reinstall the verified local release; the updater will not guess which local edits to overwrite.");
  for (const [name, expected] of Object.entries(installed.files)) {
    if (!c.managed(name)) throw Error("Invalid installed file record.");
    const file = c.inside(c.ROOT, name);
    if (!c.fs.existsSync(file) || c.hash(file) !== expected) throw Error(`Local program edits detected: ${name}. Save them before updating; nothing was overwritten.`);
  }
  for (const name of Object.keys(manifest.files)) if (!Object.hasOwn(installed.files, name) && c.fs.existsSync(c.inside(c.ROOT, name))) throw Error(`A local file conflicts with this update: ${name}`);
  return installed;
}
async function freePort() { return new Promise((resolve, reject) => { const server = net.createServer(); server.once("error", reject); server.listen(0, "127.0.0.1", () => { const port = server.address().port; server.close(() => resolve(port)); }); }); }
async function preflight(stage, manifest) {
  const api = await freePort(), ui = await freePort(), instance = c.crypto.randomUUID(), children = [];
  if (api === ui) return preflight(stage, manifest);
  const data = c.path.join(c.CONTROL, "update-probe-" + instance); c.fs.mkdirSync(data, { recursive: true });
  const env = { ...process.env, MRZ_STUDIO_ROOT: data, MRZ_INSTANCE_ID: instance, LOCAL_API_HOST: "127.0.0.1", LOCAL_API_PORT: String(api), MRZ_UI_PORT: String(ui), LOCAL_DRY_RUN: "1" };
  try {
    for (const entry of ["app/local-server/server.js", "scripts/ui-server.cjs"]) {
      const child = spawn(process.execPath, [c.inside(stage, entry)], { cwd: stage, env, stdio: "ignore", windowsHide: true }); child.on("error", () => {}); children.push(child);
    }
    for (let tries = 0; tries < 30; tries++) {
      try {
        const [a, u] = await Promise.all([c.json(`http://127.0.0.1:${api}/api/health`, 500), c.json(`http://127.0.0.1:${ui}/__mrz/health`, 500)]);
        if (a.studio?.version === manifest.version && a.studio.instance === instance && u.version === manifest.version && u.instance === instance) return;
      } catch {}
      await c.delay(200);
    }
    throw Error("The downloaded app failed its isolated startup check. The installed app was left intact.");
  } finally {
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill(); await Promise.race([new Promise(resolve => child.once("exit", resolve)), c.delay(2000)]);
      }
    }
    // Generated probe data contains no owner jobs. Verify its exact parent before cleanup.
    if (c.path.dirname(data) !== c.CONTROL || c.fs.lstatSync(data).isSymbolicLink()) throw Error("Unsafe probe cleanup.");
    c.fs.rmSync(data, { recursive: true, force: true });
  }
}
function replace(file, source) {
  c.fs.mkdirSync(c.path.dirname(file), { recursive: true }); const temp = file + ".mrz-update.tmp";
  try { c.fs.copyFileSync(source, temp); require("./atomic-json.cjs").rename(temp, file); } finally { c.fs.rmSync(temp, { force: true }); }
}
function restore(transaction) {
  if (!transaction || transaction.product !== c.PRODUCT || !Array.isArray(transaction.paths)) throw Error("Invalid rollback journal.");
  const backup = c.inside(c.ROOT, transaction.backup);
  if (!transaction.backup.startsWith("control/update-backups/") || !c.fs.existsSync(backup)) throw Error("Rollback backup is unavailable.");
  for (const name of transaction.paths) {
    if (!c.managed(name)) throw Error("Unsafe rollback path.");
    const source = c.inside(backup, name);
    if (Object.hasOwn(transaction.old.files, name) && (!c.fs.existsSync(source) || c.hash(source) !== transaction.old.files[name])) throw Error(`Rollback backup damaged: ${name}`);
  }
  for (const name of transaction.paths) {
    const file = c.inside(c.ROOT, name);
    if (Object.hasOwn(transaction.old.files, name)) replace(file, c.inside(backup, name)); else c.fs.rmSync(file, { force: true });
  }
  c.write(INSTALLED, transaction.old); transaction.status = "rolled-back"; c.write(JOURNAL, transaction);
}
async function recover() {
  const transaction = c.read(JOURNAL);
  if (!transaction || !["applying", "validating", "rolling-back"].includes(transaction.status)) return false;
  const stopped = await runtime.stop({ refuseBusy: true }); if (!stopped.stopped) throw Error("Recovery is waiting for an active job to finish.");
  restore(transaction); return true;
}
async function apply(stage, manifest) {
  verifyStage(stage, manifest);
  const old = conflicts(manifest);
  await preflight(stage, manifest);
  if (await c.busy()) throw Error("A job is running. The verified update is ready; try again after the job finishes.");
  const state = c.read(c.STATE), wasRunning = c.owned(state, "scripts/supervisor.cjs", state?.instance);
  const stopped = await runtime.stop({ refuseBusy: true });
  if (!stopped.stopped) throw Error("Studio is finishing a job. Try the update again after it stops.");
  conflicts(manifest); // A local edit during staging must also stop the update.
  const paths = [...new Set([...Object.keys(old.files), ...Object.keys(manifest.files)])];
  const backup = "control/update-backups/" + Date.now() + "-" + c.crypto.randomUUID();
  for (const name of Object.keys(old.files)) {
    const target = c.inside(c.inside(c.ROOT, backup), name); c.fs.mkdirSync(c.path.dirname(target), { recursive: true }); c.fs.copyFileSync(c.inside(c.ROOT, name), target);
  }
  const transaction = { schema: 1, product: c.PRODUCT, status: "applying", at: new Date().toISOString(), backup, paths, old, next: manifest, wasRunning, workerEnabled: state?.workerEnabled !== false };
  c.write(JOURNAL, transaction);
  try {
    for (const name of paths) { const file = c.inside(c.ROOT, name); if (Object.hasOwn(manifest.files, name)) replace(file, c.inside(stage, name)); else c.fs.rmSync(file, { force: true }); }
    c.write(INSTALLED, { schema: 1, product: c.PRODUCT, version: manifest.version, files: manifest.files });
    transaction.status = "validating"; c.write(JOURNAL, transaction);
    if (wasRunning) await runtime.start({ worker: transaction.workerEnabled });
    transaction.status = "complete"; c.write(JOURNAL, transaction);
    return { updated: true, version: manifest.version, backup };
  } catch (error) {
    const stoppedAgain = await runtime.stop({ refuseBusy: true });
    if (!stoppedAgain.stopped) throw Error(`Update validation failed and a job is active. Run mrz status, then mrz rollback. ${error.message}`);
    transaction.status = "rolling-back"; c.write(JOURNAL, transaction); restore(transaction);
    if (wasRunning) await runtime.start({ worker: transaction.workerEnabled });
    throw Error(`Update failed and the previous version was restored: ${error.message}`);
  }
}
async function update({ archive, manifestFile } = {}) {
  await recover();
  let manifest, bytes;
  if (archive || manifestFile) {
    if (!archive || !manifestFile) throw Error("Provide both --file and --manifest for an offline update.");
    manifest = validate(c.read(c.path.resolve(manifestFile))); bytes = c.fs.readFileSync(c.path.resolve(archive));
  } else {
    const result = await check(); if (!result.available) return result;
    manifest = result.manifest; bytes = await github(result.url, 256 * 1024 * 1024);
  }
  if (bytes.length !== manifest.archive_size || c.crypto.createHash("sha256").update(bytes).digest("hex") !== manifest.archive_sha256) throw Error("The update archive checksum failed. Nothing was installed.");
  const stage = c.path.join(c.CONTROL, "update-staging", c.crypto.randomUUID()); c.fs.mkdirSync(stage, { recursive: true });
  const zip = c.path.join(c.CONTROL, "update-download-" + c.crypto.randomUUID() + ".zip"); c.fs.writeFileSync(zip, bytes);
  try {
    execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", c.path.join(c.ROOT, "scripts/archive.ps1"), "-Mode", "Unpack", "-Archive", zip, "-Directory", stage], { windowsHide: true, timeout: 120000, stdio: "pipe" });
    return await apply(stage, manifest);
  } finally {
    c.fs.rmSync(zip, { force: true });
    if (c.path.dirname(stage) !== c.path.join(c.CONTROL, "update-staging") || c.fs.lstatSync(stage).isSymbolicLink()) throw Error("Unsafe update staging cleanup.");
    c.fs.rmSync(stage, { recursive: true, force: true });
  }
}
async function rollback() {
  const transaction = c.read(JOURNAL);
  if (!transaction || transaction.status !== "complete") throw Error("There is no completed update to roll back.");
  conflicts(transaction.next);
  const state = c.read(c.STATE), wasRunning = c.owned(state, "scripts/supervisor.cjs", state?.instance);
  const stopped = await runtime.stop({ refuseBusy: true }); if (!stopped.stopped) throw Error("Rollback is waiting for the current job.");
  transaction.status = "rolling-back"; c.write(JOURNAL, transaction); restore(transaction);
  if (wasRunning) await runtime.start({ worker: state.workerEnabled });
  return { rolledBack: true, version: transaction.old.version };
}
module.exports = { check, update, rollback, recover, initialize, baseline, validate, verifyStage, conflicts, apply, restore, newer };
