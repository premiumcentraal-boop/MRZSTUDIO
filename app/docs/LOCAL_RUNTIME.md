# Local launcher and updates (7.1.0)

The canonical project has `app/` for the existing Vite site, API and worker;
`scripts/` manages the installed runtime. Normal launch serves the prebuilt
UI, proxies `/api` to 8787 and runs the worker. Vite and npm are only needed
for source development. All listeners bind to 127.0.0.1.

## Runtime checks

Start requires matching product, version and random instance identity from
both API and website, plus a matching worker heartbeat. Repeated starts reuse
that instance. A supervisor restarts idle crashed services with bounded
backoff (three attempts in five minutes). Stop uses a cooperative file request
so Photoshop can finish its current job. New jobs are refused while stopping.
PID files alone are never authority to terminate a process; command path and
instance identity must also match. A crashed worker's active job is left for
inspection in `queue/processing`, never silently replayed.

`mrz status --json` and `mrz doctor --json` provide machine-readable diagnostics.
Missing Photoshop or a template is reported separately from website readiness.
Use `--no-worker --no-browser` only for a deliberate UI/API-only session.

## Package and update contract

`release/version.json` is the installed release identity. `mrz build` forces
local mode, stamps the production UI and records source-install hashes.
`npm run package:release` emits a prebuilt ZIP, SHA-256 sidecar and
`mrz-local-release.json`. Only allowed program files are included; no
`.env*`, control files, PSDs, queue, output, worker workspace or logs.

The updater reads stable releases from `premiumcentraal-boop/MRZSTUDIO`,
selects releases with that manifest and skips historical source-only V7 ZIPs.
GitHub HTTPS is the download trust boundary. SHA-256 checks verify the ZIP
and every file. ZIP extraction rejects traversal, links, duplicate names and
oversized archives. Staged API/UI probes use separate ports and disposable
data, with no worker and no owner jobs. Existing source modifications block
the update rather than being overwritten. For source development, rebuild
after intentionally accepting your edits to record a new baseline.

Before replacing code, the updater waits for stop, backs up program files and
writes a transaction journal. Settings, templates and jobs are excluded from
both replacement and rollback. A failed startup rolls code back; an interrupted
transaction is recovered on the next mutating command. Rollback also refuses
local program edits. Update requests while a job is active fail without
interrupting it; retry after completion.

Optional offline install: `mrz update --file path-to-official.zip --manifest
path-to-mrz-local-release.json`. Obtain both from the trusted release; a
checksum is integrity verification, not a separate publisher signature.

The Windows GitHub workflow verifies tests, builds the UI and packages artifacts.
A `mrz-local-v7.1.0` tag publishes version 7.1.0 after those checks succeed.
Each later release must increment the metadata and matching package versions.

## Verification

Run `npm test` for launcher, recovery, ownership and update tests, and
`npm --prefix app run test:all` for local application regressions. Tests use
isolated folders and ports under `artifacts/launcher-build`, without personal
templates or real Photoshop jobs. On the installed PC verify `mrz start`,
`mrz status`, `/settings/mcp`, `mrz update --check` and `mrz stop`.
