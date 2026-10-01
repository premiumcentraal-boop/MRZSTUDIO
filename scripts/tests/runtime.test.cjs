"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), { spawn } = require("node:child_process"), net = require("node:net");
const { fixture, delay, fs, path } = require("./helpers.cjs");
test("start checks all services, repeated start reuses them, crashed UI recovers, stop releases both ports", { timeout: 90000 }, async () => {
  const f = await fixture();
  try {
    let result = await f.command(["start", "--no-browser", "--json"]); assert.equal(result.exit, 0, result.output); assert.equal(JSON.parse(result.output).api.worker.instance, f.state().instance);
    const first = f.state(); result = await f.command(["start", "--no-browser", "--json"]); assert.equal(result.exit, 0, result.output); assert.equal(JSON.parse(result.output).reused, true); assert.equal(f.state().pid, first.pid);
    const html = await fetch(`http://127.0.0.1:${f.ui}/settings/mcp`); assert.equal(html.status, 200); assert.match(await html.text(), /MRZ fixture/);
    const settings = await fetch(`http://127.0.0.1:${f.ui}/api/mcp-connections`); assert.equal(settings.status, 200);
    process.kill(first.children.ui.pid);
    for (let tries = 0; tries < 30; tries++) { await delay(300); if (f.state().children.ui.pid !== first.children.ui.pid && f.state().status === "ready") break; }
    assert.notEqual(f.state().children.ui.pid, first.children.ui.pid); assert.equal(f.state().status, "ready");
    result = await f.command(["stop", "--json"]); assert.equal(result.exit, 0, result.output); assert.equal(JSON.parse(result.output).stopped, true);
    await assert.rejects(fetch(`http://127.0.0.1:${f.api}/api/health`)); await assert.rejects(fetch(`http://127.0.0.1:${f.ui}/__mrz/health`));
  } finally { await f.cleanup(); }
});
test("port conflict fails without terminating another program", { timeout: 30000 }, async () => {
  const f = await fixture(), server = net.createServer();
  try {
    await new Promise(resolve => server.listen(f.ui, "127.0.0.1", resolve));
    const result = await f.command(["start", "--no-browser"]); assert.equal(result.exit, 1); assert.match(result.output, /different program/); assert.equal(server.listening, true);
  } finally { await new Promise(resolve => server.close(resolve)); await f.cleanup(); }
});
test("a saved PID belonging to another program is never killed", { timeout: 30000 }, async () => {
  const f = await fixture();
  const unrelated = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { stdio: "ignore", windowsHide: true });
  try {
    fs.mkdirSync(path.join(f.root, "control"), { recursive: true });
    fs.writeFileSync(path.join(f.root, "control/runtime.json"), JSON.stringify({ pid: unrelated.pid, instance: "fake", children: { ui: { pid: unrelated.pid, entry: "scripts/ui-server.cjs" } } }));
    const result = await f.command(["stop"]); assert.equal(result.exit, 0, result.output); assert.doesNotThrow(() => process.kill(unrelated.pid, 0));
  } finally { unrelated.kill(); await f.cleanup(); }
});
test("stop waits for an active worker instead of killing it", { timeout: 30000 }, async () => {
  const f = await fixture();
  // A deterministic worker fixture simulates finishing an already claimed job.
  fs.writeFileSync(path.join(f.root, "app/worker/worker.js"), `const c=require('../../scripts/common.cjs');const file=c.path.join(c.CONTROL,'heartbeat.json');let working=true;const hb=()=>c.write(file,{status:'online',instance:process.env.MRZ_INSTANCE_ID,pid:process.pid,last_seen_at:new Date().toISOString(),current_job_id:working?'fixture-job':null});hb();const timer=setInterval(()=>{hb();if(c.read(c.path.join(c.CONTROL,'worker-stop.json'))?.instance===process.env.MRZ_INSTANCE_ID){clearInterval(timer);setTimeout(()=>{working=false;hb();c.fs.writeFileSync(c.path.join(c.CONTROL,'job-finished.txt'),'finished');process.exit(0)},2000)}},100);`);
  try {
    let result = await f.command(["start", "--no-browser"]); assert.equal(result.exit, 0, result.output);
    result = await f.command(["stop", "--json"]); assert.equal(result.exit, 0, result.output); assert.equal(JSON.parse(result.output).draining, true);
    for (let i = 0; i < 30 && f.state().status !== "stopped"; i++) await delay(200);
    assert.equal(f.state().status, "stopped"); assert.equal(fs.readFileSync(path.join(f.root, "control/job-finished.txt"), "utf8"), "finished");
  } finally { await f.cleanup(); }
});
