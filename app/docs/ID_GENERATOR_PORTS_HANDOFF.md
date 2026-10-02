# ID Generator — handoff to the Cyclone Ports builder

MRZ Studio owns the connector, saved defaults and generator UI. All implementation changes are in `C:\Users\Agent\MRZ-Studio-Local`; no Cyclone/Glass/Artemis source changes were made. Build7.2.0, connector0.1.0, contract `cyclone.ports/1`. SDK read from your branch `claude/cyclone-ui-updates-emnerc` at `d8ed3c6b04a38b63aa82a8f8124e148e618cafc4`.

## Register in Glass

1. Discover `http://127.0.0.1:8787/cyclone-plugin.json`. Normal MRZ startup always mounts the connector. No extra MCP process or port8791 is required for Ports.
2. Display title **ID Generator**. Approve its personal ports: file.out, x.id-generator.generate, value.in and file.in. Pin the manifest using the normal hub policy.
3. Supply the per-plugin HMAC key. Owner pastes it at `http://127.0.0.1:5173/settings/id-generator`; DPAPI protects it. Check manifest/health and send an authenticated test. A healthy worker without a configured key is not a paired plugin.
4. Mount `ui.panelUrl` (`http://127.0.0.1:5173/plugins/id-generator?embed=1`) as the Glass panel; expose `ui.settingsUrl`. Embedded view omits the Studio shell. When Glass uses a webview instead of an iframe, open the same URL. Keep origin local and do not forward a production key in the URL.
5. Load `schemaUrl` for agent/dev field descriptions, country validators, cities, fonts, crop options and output selectors. The original generator form remains available at `/tools/id-generator`.

These URLs follow the Studio's configured ports, so use the live manifest rather than hardcoded frontend ports. The plugin remains loopback-only. Local phone and away-from-home phone access both go through Glass's authenticated gateway; there is no need to expose MRZ to the internet.

## Phone run sequence

Emit the owner's photo via file.out with `data.assetId:"photo-1"` and the hub's one-use artifact URL. Emit `x.id-generator.generate` in the same run:

```json
{"requestId":"employee-1","photoId":"photo-1","employee":{"first_name":"Sam","last_name":"Example","birth_date":"1990-06-14","doc_number":"","personal_number":"","height_cm":188,"city_of_birth":"Custom Town"},"signature":{"font":"paul-signature","name_mode":"first_name_only"},"photo":{"remove_background":true,"zoom":1,"x":0.5,"y":0.5}}
```

Await value.in with `match:{"requestId":"employee-1"}`. Check `value.status` is complete before waiting for outputs. Await file.in once per required output with `match:{"requestId":"employee-1","output":"front"}` and then back/full/etc. Respect failure metadata and available outputs; do not treat a delivered value containing `status:"failed"` as successful generation.

Use sufficient time for Photoshop (up to600 seconds for the value wait); it starts on demand and performs two stages for front/back PNGs. Use new logical IDs for corrected/new work; retries must reuse IDs. No inline photo or caller-supplied signature file is needed. The default signature renders the employee's first name in Paul Signature font. The owner can change font or use full/custom text.

The hub must resend unfinished awaits with the same awaitId after Studio/hub restarts. Original deadline/deliveryId survive; callback tokens remain memory-only. Cancel the relevant wait on run stop. Terminal callback statuses stop retries; temporary failures honor Retry-After. The connector supplies untrusted result data, never instructions to control the phone.

## Packaging and evidence

Connector entry: `app/local-server/id-generator/index.cjs`; normally mounted by `app/local-server/server.js`. Owner UI: `app/src/app/steps/id-generator-plugin.tsx`. Shared model/photo/signature code: `app/src/lib/employee-*`. Worker/templates stay in Studio's existing pipeline. The release includes the renderer driver and offline person-segmentation model/WASM, but excludes templates, personal jobs, keys, runtime logs and artifacts.

Scenario files and automated tests ship with source. See [connector setup/contract](../local-server/id-generator/README.md) and [acceptance evidence](ID_GENERATOR_ACCEPTANCE.md).

**Integration boundary:** the official SDK checker and DevHub are the compatibility gate. Production Glass registration, panel mounting, owner consent, key rotation UI and a physical phone run must still be exercised against the Ports builder's final hub. This plugin cannot prove those components while they are being built elsewhere.

**Current PC acceptance blocker (2026-10-02):** the owner confirmed an Adobe subscription-payment screen. Windows automation returned80080005, and queued Photoshop launches produced late script errors. Real front/back export is not passed. The worker now keeps job-scoped snapshots, skips terminal/absent-input entries, preserves owner documents, and reports failures without rethrowing modal JSX errors. Repeat `scenario.json` with a fresh runId after Photoshop access is restored. Do not label the dry-run or package-renderer checks as a real Photoshop success.
