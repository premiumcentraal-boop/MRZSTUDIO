# ID Generator — Cyclone Ports connector

MRZ Studio Local 7.2.0 includes this PC native connector for internal employee badge artwork. Contract: `cyclone.ports/1`, connector version 0.1.0. It uses the existing Studio number/MRZ rules, Photoshop worker, photo crop pipeline and bundled signature fonts. Default: Paul Signature **font**, with the employee's first name, transparent 420 × 123 pixels. Photo: 2421 × 3292 pixels.

## Start and connect

Use the normal `Start-MRZ-Local.cmd` or `mrz start`. Source checkout: `mrz build` first. Node 22+, Windows, Edge or Chrome, Photoshop, and the owner's EmployeeID.psd/IDCARDPRINT.psd templates are required for actual PNG front/back exports. Templates and employee data are never included in release packages. The headless renderer ships with the package; a packaged installation needs no npm install.

- Settings: <http://127.0.0.1:5173/settings/id-generator>
- Panel: <http://127.0.0.1:5173/plugins/id-generator>
- Embedded panel: <http://127.0.0.1:5173/plugins/id-generator?embed=1>
- Manifest: <http://127.0.0.1:8787/cyclone-plugin.json>
- Health: <http://127.0.0.1:8787/health>
- Generation schema: <http://127.0.0.1:8787/api/id-generator/schema>

Add the manifest in Glass Ports, approve its personal-data ports, then paste **the key supplied by Glass** into the plugin settings. The key is protected with Windows DPAPI for the current user. This page does not invent a key or grant consent on Glass's behalf. Alternatively set `CYCLONE_PLUGIN_SECRET=k<N>.<secret>` in the launching process or private `control/env.local`. Environment configuration overrides the saved DPAPI key. `CYCLONE_PLUGIN_SECRET_NEXT` accepts a second key during rotation. Never put a real key in source, command history, manifests, scenario files or reports.

For an isolated SDK development server:

```powershell
# Set a development-only key in this process; never use a production key here.
$env:CYCLONE_PLUGIN_SECRET='k1.id-generator-sdk-test'
$env:MRZ_STUDIO_ROOT='C:/path/to/private/test-root'
node app/local-server/id-generator/index.cjs --port 8793
```

The standalone API does not start the UI or worker; start these separately or use the normal launcher. `LOCAL_API_PORT` and `MRZ_UI_PORT` override defaults. `LOCAL_DRY_RUN=1` exercises wiring with placeholders; it does not prove a Photoshop export.

## Four ports

Photoshop execution uses Adobe's Windows COM interface, with file-launch fallback only if COM could not connect before dispatch. Each job has an immutable input/image/template snapshot and guarded entry script under worker `output/<jobId>/automation`. Terminal markers stop late launches after a blocking Adobe dialog; job failures are returned through the API/report rather than repeated JavaScript error modals. Existing owner documents are preserved on failure. Photoshop's payment/sign-in screens must be cleared before a real export can be verified.

| Port | Direction | Data |
|---|---|---|
| `file.out` | out | One-use hub `artifactUrl`; `data.assetId` is the run-scoped photo identifier. PNG/JPEG/WebP, ≤20 MB. |
| `x.id-generator.generate` | out | `{requestId, photoId, employee, signature?, photo?}`; see the live schema. |
| `value.in` | in | Match `{requestId}` for final status, job ID, MRZ and available outputs; `{requestId, ask:"status"}` for a snapshot; `{ask:"schema"}` for the contract. |
| `file.in` | in | Match `{requestId, output:"front"}` (or back/full/pdf/psd/mockup1…3); delivers the SDK file body with SHA-256. |

All requests from the hub need the SDK HMAC signature over timestamp, request ID, method, complete path/query and raw body hash. Replay protection persists across restarts. Wrong/absent signature →401; undeclared port →404; invalid structure →422. Out messages/awaits acknowledge immediately; rendering/export occurs asynchronously. Invalid generation details produce a failed `value.in` result.

Photo and generation must share `runId`; `photoId` refers to `data.assetId`. Waits are isolated by run and `requestId`. When several employees share a run, always supply `match.requestId`. Use one logical `requestId` per intended employee; retrying it cannot create another job. To correct failed data, use a fresh request and photo ID. Reusing an envelope ID with altered data returns409.

Empty document/personal numbers invoke current country rules. Supplied numbers are validated. Preset and custom cities work, height can be supplied as `height_cm` (140–210) or `height` (1,40–2,10 m). Signature font/name mode/placement and photo crop/background-removal can override saved defaults. A nonportrait that becomes an empty cutout fails before queueing with a clear instruction. The local model/WASM need no external service.

Delivery uses a persistent `deliveryId`; retries429/5xx/network with backoff and Retry-After until the original deadline. Terminal responses stop delivery. Cancel aborts an active callback and persists cancellation. After restarting Studio, the hub must resend `/await` with the same `awaitId` to restore the callback token; tokens never persist. No shell, phone-control instructions, reserved secret ports or speculative MCP features are exposed.

For >20 MB outputs (often editable PSDs), the v1 file port cannot transfer the file. The wait ends with local `too_large` status; the hub timeout must surface this to the owner. Retrieve the large file in Studio. Mockup outputs require the owner's existing mockup templates. PNG front/back additionally require IDCARDPRINT.psd.

## Local data and deletion

`control/id-generator/settings.json` stores owner defaults; `auth.json` stores only DPAPI ciphertext. `photos/` contains incoming photos. `receipts/`, `waits/` and `replays.json` retain delivery/deduplication metadata. Employee payloads are discarded from receipts once the worker job is published; final MRZ/status metadata is retained until expiry.

Photos, completed plugin job directories in `queue/{done,failed}`, `output/`, worker `output/`, per-job worker logs and idle matching `current-job/` files expire after the configured1–168 hours (default24). Expiration runs while Studio is running, including on restart. Active queued/processing jobs are preserved. Plugin panel jobs share this policy; ordinary Studio jobs keep their existing behavior. Photoshop reports inside private job directories can contain employee fields and expire with the job. Logs contain metadata only.

Deduplication tombstones, wait status/deadlines/IDs and settings persist so an old retry cannot generate a second badge. To completely erase a test/plugin installation, stop Studio, remove the owner's plugin job folders and `control/id-generator` within that installation, and unpair it in Glass. Doing so resets deduplication and the saved key. Never remove an active worker's files or the original templates.

## SDK verification

SDK source: Cyclone `claude/cyclone-ui-updates-emnerc`, commit `d8ed3c6b04a38b63aa82a8f8124e148e618cafc4`. `vendor/verify.mjs` is copied unmodified; provenance and signature vectors are included. With the SDK on PYTHONPATH and the isolated test key configured:

```text
python -m cyclone_ports.conformance http://127.0.0.1:8793
python -m cyclone_ports.devhub app/local-server/id-generator/scenario.json --plugin http://127.0.0.1:8793 --run-dir artifacts/id-generator-acceptance/devhub-runs
python -m cyclone_ports.devhub app/local-server/id-generator/scenario-timeout.json --plugin http://127.0.0.1:8793
npm --prefix app run test:ports
```

The synthetic fixture is deliberately not an employee portrait; background removal is disabled in its successful scenario. Use a fresh `runId` for each actual export trial. Timeout scenario intentionally exits1 with `timed_out`; DevHub emits `needs_you` on `run.event`. With no notification plugin bound, that event is skipped locally. The ID Generator does not claim the notification port.

## Contract feedback

No contract changes needed. The manifest's additive `ui.panelUrl`, `ui.settingsUrl` and `schemaUrl` let Glass discover the panel and settings. Existing hubs can ignore these fields. Real Glass must map these four ports to the connector and resend awaits after restart. The current base6420 MB limit is the constraint for large PSD delivery; reserved upload/pull features are intentionally not claimed.

See [builder handoff](../../docs/ID_GENERATOR_PORTS_HANDOFF.md) for integration details and [acceptance report](../../docs/ID_GENERATOR_ACCEPTANCE.md) for verified versus unverified paths.
