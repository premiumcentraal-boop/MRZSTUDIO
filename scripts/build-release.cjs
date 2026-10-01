"use strict";
const { execFileSync } = require("node:child_process");
const c = require("./common.cjs");
function files(root, relative = "") {
  const result = [];
  for (const entry of c.fs.readdirSync(c.path.join(root, relative), { withFileTypes: true })) {
    const name = relative ? relative + "/" + entry.name : entry.name;
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (["node_modules", ".git", ".env", "control", "queue", "output", "out", "logs", "local-worker", "templates", "artifacts", "sprints"].includes(entry.name)) continue;
      result.push(...files(root, name));
    } else if (c.managed(name)) result.push(name);
  }
  return result.sort();
}
function build() {
  require("./runtime.cjs").ensureBuild();
  const v = c.version(), output = c.path.join(c.ROOT, "artifacts/releases");
  c.fs.mkdirSync(output, { recursive: true });
  const stage = c.path.join(output, "stage-" + c.crypto.randomUUID()); c.fs.mkdirSync(stage);
  const zip = c.path.join(output, `MRZ-Studio-Local-${v.version}.zip`);
  const candidate = zip + ".candidate-" + c.crypto.randomUUID();
  try {
  const hashes = {};
  for (const name of files(c.ROOT)) {
    const from = c.inside(c.ROOT, name), to = c.inside(stage, name);
    c.fs.mkdirSync(c.path.dirname(to), { recursive: true }); c.fs.copyFileSync(from, to); hashes[name] = c.hash(to);
  }
  const packageManifest = { schema: 1, product: c.PRODUCT, version: v.version, files: hashes };
  c.write(c.path.join(stage, "package-manifest.json"), packageManifest);
  execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", c.path.join(c.ROOT, "scripts/archive.ps1"), "-Mode", "Pack", "-Archive", candidate, "-Directory", stage], { windowsHide: true, timeout: 120000 });
  const manifest = { schema: 1, product: c.PRODUCT, version: v.version, archive: c.path.basename(zip), archive_sha256: c.hash(candidate), archive_size: c.fs.statSync(candidate).size, files: hashes };
  require("./atomic-json.cjs").rename(candidate, zip);
  const manifestPath = c.path.join(output, "mrz-local-release.json"); c.write(manifestPath, manifest);
  c.fs.writeFileSync(zip + ".sha256", manifest.archive_sha256 + "  " + c.path.basename(zip) + "\n");
  console.log(JSON.stringify({ version: v.version, archive: zip, manifest: manifestPath, files: Object.keys(hashes).length, sha256: manifest.archive_sha256 }, null, 2));
  return manifest;
  } finally {
    c.fs.rmSync(candidate, { force: true });
    if (c.path.dirname(stage) !== output || c.fs.lstatSync(stage).isSymbolicLink()) throw Error("Unsafe release staging directory.");
    c.fs.rmSync(stage, { recursive: true, force: true });
  }
}
if (require.main === module) { try { build(); } catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = { files, build };
