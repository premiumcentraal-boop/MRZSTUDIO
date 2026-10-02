"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), net = require("node:net");
const { spawn } = require("node:child_process");
const ROOT = path.resolve(__dirname, "../.."), BASE = path.join(ROOT, "artifacts/launcher-build/tests");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const port = () => new Promise(resolve => { const server = net.createServer(); server.listen(0, "127.0.0.1", () => { const value = server.address().port; server.close(() => resolve(value)); }); });
async function fixture() {
  const root = path.join(BASE, crypto.randomUUID()); fs.mkdirSync(root, { recursive: true });
  for (const name of ["scripts", "release", "app/local-server"]) fs.cpSync(path.join(ROOT, name), path.join(root, name), { recursive: true });
  for (const name of ["worker.js", "job-adapter.js", "photoshop-dispatch.cjs", "run-photoshop.ps1", "package.json", "scripts"]) fs.cpSync(path.join(ROOT, "app/worker", name), path.join(root, "app/worker", name), { recursive: true });
  for (const name of ["mrz.cmd", "package.json"]) fs.copyFileSync(path.join(ROOT, name), path.join(root, name));
  fs.mkdirSync(path.join(root, "app/dist"), { recursive: true }); fs.writeFileSync(path.join(root, "app/dist/index.html"), "<html><title>MRZ fixture</title></html>");
  const v = JSON.parse(fs.readFileSync(path.join(root, "release/version.json")));
  v.version = "7.1.0";
  fs.writeFileSync(path.join(root, "release/version.json"), JSON.stringify(v));
  fs.writeFileSync(path.join(root, "app/dist/mrz-build.json"), JSON.stringify({ product: v.product, version: v.version, local: true }));
  const api = await port(), ui = await port();
  const env = { ...process.env, MRZ_STUDIO_ROOT: root, LOCAL_API_PORT: String(api), MRZ_UI_PORT: String(ui), LOCAL_DRY_RUN: "1", POLL_INTERVAL_MS: "100", HEARTBEAT_INTERVAL_MS: "100" };
  const command = (args, code = null) => new Promise(resolve => {
    const child = spawn(process.execPath, code ? ["-e", code] : [path.join(root, "scripts/mrz.cjs"), ...args], { cwd: root, env, windowsHide: true }); let output = "";
    child.stdout.on("data", b => output += b); child.stderr.on("data", b => output += b); child.on("close", exit => resolve({ exit, output }));
  });
  const state = () => JSON.parse(fs.readFileSync(path.join(root, "control/runtime.json")));
  async function cleanup() {
    await command(["stop"]);
    if (!path.resolve(root).startsWith(path.resolve(BASE) + path.sep) || fs.lstatSync(root).isSymbolicLink()) throw Error("Unsafe fixture cleanup.");
    fs.rmSync(root, { recursive: true, force: true });
  }
  return { root, env, api, ui, command, state, cleanup };
}
module.exports = { fixture, delay, fs, path, port, ROOT };
