const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { createStore, createSettingsHandler, DEFAULTS } = require("../local-server/mcp-connections");
const scratch = path.resolve(__dirname, "../../artifacts/mcp-settings-build/tests");
fs.mkdirSync(scratch, { recursive: true });
function fixture() { return fs.mkdtempSync(path.join(scratch, "config-")); }

test("seed, saved changes and new store retain configuration; stale edits cannot overwrite", () => {
  const root = fixture(), store = createStore(root);
  const first = store.get();
  assert.equal(first.data.connectors[0].id, "employee-id");
  assert.ok(fs.existsSync(store.file));
  first.data.studio.api_base = "http://localhost:9000/";
  first.data.connectors[0].args = ["C:\\Program Files\\Employee ID\\server.js"];
  const saved = store.put(first.data, first.etag);
  assert.equal(saved.data.studio.api_base, "http://localhost:9000");
  assert.deepEqual(createStore(root).get(), saved);
  assert.throws(() => store.put(DEFAULTS, first.etag), /another tab/);
  assert.throws(() => store.put(DEFAULTS), /Load settings/);
  assert.equal(fs.readdirSync(root).length, 1);
});
test("invalid or damaged settings are rejected without destroying the saved file", () => {
  const store = createStore(fixture()); const initial = store.get();
  const cases = [ { ...DEFAULTS, version: 2 }, { ...DEFAULTS, connectors: [...DEFAULTS.connectors, ...DEFAULTS.connectors] }, { ...DEFAULTS, studio: { ...DEFAULTS.studio, api_base: "javascript:alert(1)" } }, { ...DEFAULTS, token: "not-stored" }, { ...DEFAULTS, connectors: [{ ...DEFAULTS.connectors[0], args: "not-an-array" }] } ];
  for (const value of cases) assert.throws(() => store.put(value, initial.etag));
  for (const escaped of ["\b", "\t", "\n", "\u007f"]) assert.throws(() => store.put({ ...DEFAULTS, connectors: [{ ...DEFAULTS.connectors[0], args: [`C:${escaped}ad`] }] }, initial.etag), /control characters/);
  assert.deepEqual(store.get(), initial);
  fs.writeFileSync(store.file, "{broken");
  assert.throws(() => store.get(), /has not been overwritten/);
  assert.throws(() => store.put(DEFAULTS, initial.etag));
  assert.equal(fs.readFileSync(store.file, "utf8"), "{broken");
});
test("failed atomic replacement preserves previous configuration", () => {
  const store = createStore(fixture()); const first = store.get();
  const original = fs.renameSync;
  fs.renameSync = () => { throw new Error("simulated write failure"); };
  try { assert.throws(() => store.put({ ...first.data, connectors: [] }, first.etag)); }
  finally { fs.renameSync = original; }
  assert.deepEqual(store.get(), first);
});
test("HTTP route validates revisions, JSON, CORS, method and request size", async () => {
  const handler = createSettingsHandler(fixture());
  const server = http.createServer(async (req, res) => { if (!await handler(req, res)) { res.writeHead(404); res.end(); } });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/mcp-connections`;
  try {
    const first = await fetch(base); assert.equal(first.status, 200);
    const data = await first.json(), etag = first.headers.get("etag");
    data.connectors[0].notes = "HTTP persistence test";
    const saved = await fetch(base, { method: "PUT", headers: { "Content-Type": "application/json", "If-Match": etag, Origin: "http://127.0.0.1:5173" }, body: JSON.stringify(data) });
    assert.equal(saved.status, 200); assert.equal((await saved.json()).connectors[0].notes, "HTTP persistence test");
    assert.equal((await (await fetch(base)).json()).connectors[0].notes, "HTTP persistence test");
    assert.equal((await fetch(base, { method: "PUT", headers: { "Content-Type": "application/json", "If-Match": etag }, body: JSON.stringify(data) })).status, 409);
    assert.equal((await fetch(base, { headers: { Origin: "https://unrelated.example" } })).status, 403);
    assert.equal((await fetch(base, { headers: { Origin: "http://localhost:5173", "Sec-Fetch-Site": "cross-site" } })).status, 200);
    assert.equal((await fetch(base, { headers: { "Sec-Fetch-Site": "cross-site" } })).status, 403);
    const badHost = await new Promise((resolve, reject) => {
      http.get(base, { headers: { Host: "unrelated.example" } }, res => { res.resume(); resolve(res.statusCode); }).on("error", reject);
    });
    assert.equal(badHost, 403);
    const preflight = await fetch(base, { method: "OPTIONS", headers: { Origin: "http://localhost:5173" } });
    assert.equal(preflight.status, 204); assert.match(preflight.headers.get("access-control-allow-methods"), /PUT/);
    assert.equal((await fetch(base, { method: "POST" })).status, 405);
    assert.equal((await fetch(base, { method: "PUT", body: "{}" })).status, 415);
    assert.equal((await fetch(base, { method: "PUT", headers: { "Content-Type": "application/json" }, body: "{" })).status, 400);
    assert.equal((await fetch(base, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ huge: "x".repeat(70000) }) })).status, 413);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
