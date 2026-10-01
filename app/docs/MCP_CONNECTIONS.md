# MCP connections — local settings cut

Implemented and checked on 2026-09-29. This is an MRZ Studio Local settings release, not a Cyclone installer or a new Cyclone alpha. The latest published Cyclone baseline observed at the start of this work was `v5.0.0-alpha.70.dev1`. No Cyclone, Glass, Artemis, or fallback MCP files were modified.

## Open and use

Start Studio normally using `Start-MRZ-Local.ps1`, then open <http://127.0.0.1:5173/settings/mcp>, or select **MCP connections** in the navigation menu.

1. Edit the Studio addresses and connector details. Arguments are a JSON array of strings; Windows backslashes must be doubled inside JSON strings.
2. Click **Save settings**. Reload the page to verify persistence.
3. Click **Check health**. This checks the entered API address, including unsaved edits. API reachability, worker heartbeat, Photoshop, template, and dry-run mode are reported separately. It never starts a badge job.
4. Click **Copy Glass JSON** after saving. Only enabled local stdio connectors appear in `mcpServers`. HTTP connectors offer **Copy server address** instead.
5. Import the recipe in Glass and complete its program approval. Settings alone do not import, enable, launch, or approve a process in Glass. A changed script needs its appropriate pin approval there.

The saved file is `control/mcp-connections.json`, relative to the Studio root. It is local state and excluded from Git. The first GET creates the Employee ID fallback recipe only when the file is absent. Existing or damaged settings are never silently reset.

## Contract and boundaries

Studio is the source of connection metadata. The settings API remains at the running Studio address even if an owner edits the *target* Studio API address; saving a wrong target cannot move the settings service out from under the page. Saving does not change listening ports or environment variables.

The Employee ID target contract is photo required, automatic given-name-only signature at 420 × 123, no caller signature inputs, and health/schema/generate/status tools. This page displays that target and persists its signature metadata. It does not retrofit the external MCP or the existing generation pipeline. The seeded fallback remains `C:\Users\Agent\cyclone-coord\employee-id-mcp\dist\server.js`; this cut did not launch or certify it.

The future Glass connector must explicitly read these settings, map the Studio endpoint, enforce the tool contract, and handle job retries/status/results. Phone-to-PC access away from home requires the separate authenticated Glass transport. This page does not expose Studio to the internet or provide a tunnel. HTTP URL storage is configuration, not evidence of a working remote MCP connection.

## API for the connector builder

- `GET /api/mcp-connections`: version-1 JSON body and `ETag` response header.
- `PUT /api/mcp-connections`: `Content-Type: application/json`, full version-1 body, and `If-Match` from the latest GET. Returns normalized saved JSON and a new ETag.
- Missing revision: 428. Stale revision: 409. Invalid data: 422. Malformed JSON: 400. Too large: 413. Non-JSON PUT: 415.
- Up to 20 connectors, unique lowercase IDs, HTTP(S) URLs without embedded credentials, and at most 40 single-line arguments. Configuration does not support secret fields; do not put secrets into notes or arguments.
- Settings are replaced atomically after validation. Invalid existing files return an error and remain intact; repair or restore the file before reloading.
- Settings access accepts loopback Host values and the local Studio origins `http://127.0.0.1:5173` and `http://localhost:5173`. CORS permits GET, PUT, OPTIONS and exposes ETag. The rest of the existing API is unchanged.

## Verification and checkpoints

- `766e628`: durable configuration API.
- `e22819d`: settings UI, navigation, recipes, conflict handling and validation refinements.
- Final documentation/checkpoint follows those commits.

Commands from the Studio root:

```powershell
node --test app/tests/mcp-connections.test.cjs
npm.cmd --prefix app run build
npm.cmd --prefix app run test:all
```

All passed. The build retains the existing large-chunk warning. The regression suite uses the current local working tree, including the owner's pre-existing badge work; those unrelated changes were not included in these checkpoints.

Browser acceptance passed in the Codex browser:

- Direct settings URL, reload, and navigation-menu entry.
- API address and Windows arguments edited, saved, reloaded, then restored to defaults; disk file checked.
- Copy Glass JSON read back from clipboard and parsed successfully.
- Add HTTP connector, save, copy its URL, remove, save, and restore original list.
- Dirty recipes cannot be copied; invalid JSON is rejected; unsaved navigation opens an accessible dialog with an Escape/keep-editing path.
- Health reports live API/worker/Photoshop/template state and an unreachable address; no generation job was launched.
- 390-pixel and 1280-pixel viewport checks: no horizontal document overflow.

At acceptance, the API was reachable, worker offline, Photoshop and template found, and real-render mode selected. This is a passing settings-page check, not a successful badge-generation claim. The API and UI were started for verification; no worker was started.

Local evidence and the checkpoint patch are under `artifacts/mcp-settings-build/`. Personal settings are excluded from the patch. Use the normal Studio startup for generation work.

## Changed files

`app/local-server/mcp-connections.js`, the two-line integration in `app/local-server/server.js`, `app/tests/mcp-connections.test.cjs`, `app/src/lib/mcpConnections.ts`, `app/src/lib/localApi.ts`, `app/src/app/steps/mcp-connections-settings.tsx`, `app/src/app/App.tsx`, `.gitignore`, this document, and the root `README-LOCAL.md` note.

## Hard-scope brief acceptance audit

Read-only reference: `C:\Users\Agent\cyclone-coord\CHATGPT_BUILD_MRZ_MCP_SETTINGS_2026-09-29.md`. All implementation and acceptance writes are confined to `C:\Users\Agent\MRZ-Studio-Local\`. The external fallback path is seeded metadata only.

- [x] First-GET seed and persistence in `control/mcp-connections.json`.
- [x] GET/PUT settings API, validation, saved response, and PUT CORS support.
- [x] `/settings/mcp`, step/path maps, and navigation entry **MCP connections**.
- [x] Studio endpoints, live Health, editable stdio/HTTP connectors, and Save.
- [x] Employee ID seed, copied `mcpServers` JSON, and script pin path hint.
- [x] Read-only Employee ID target contract.
- [x] Setup documentation and root README note.
- [x] Separate API, UI, and acceptance checkpoints; unrelated local edits preserved.

| Part | Completed | Confidence | Evidence / gaps |
| --- | --- | --- | --- |
| API and persistence | 10/10 | 10/10 | Four tests pass; live default seed equals disk; live preflight permits PUT. No gaps in this part. |
| UI | 10/10 | 10/10 | Production build and recorded browser Save/reload, Health, clipboard, navigation and responsive checks pass. No gaps in this part. |
| Documentation and acceptance | 10/10 | 10/10 | All five brief acceptance items verified; scope and integration boundaries documented. No gaps in this cut. |

Scores apply to this settings cut's explicit acceptance criteria, not to untested Glass execution, remote transport, or badge generation. The API requires `If-Match` from GET when saving, an intentional concurrency safeguard documented above and implemented by the page.
