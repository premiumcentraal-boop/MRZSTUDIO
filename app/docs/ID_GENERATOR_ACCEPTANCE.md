# ID Generator acceptance — 2026-10-02

MRZ Studio Local7.2.0 / ID Generator0.1.0 / `cyclone.ports/1`.

All source changes are in MRZ Studio Local. Cyclone/Glass/Artemis source was not edited. SDK read-only inspection copy came from Cyclone branch `claude/cyclone-ui-updates-emnerc`, commit `d8ed3c6b04a38b63aa82a8f8124e148e618cafc4`.

## Evidence

| Check | Result |
|---|---|
| Canonical MRZ/name mapping, numbers, cities, height, date/layout validation | Passed in connector tests |
| SDK signature vectors, unsigned/wrong/path-bound/replayed requests, key rotation | Passed |
| Envelope/logical-request deduplication and published-job restart recovery | Passed |
| Matching isolation, repeated await, durable cancel/deadline/delivery ID | Passed |
| Retry503/Retry-After and SHA-256 file delivery | Passed |
| Owner origin/ETag settings persistence and plugin retention | Passed |
| Photoshop child-document transition and owner-document preservation | Passed in simulated host tests |
| Delayed finished/missing-input entry does not dispatch; consecutive jobs use separate inputs | Passed regression test for the owner's screenshot |
| Connector + worker safety suite | 13 tests passed |
| Existing mapping/date/print-margin suites | Passed |
| Root Windows launch/update/rollback/security suite | 13 tests passed |
| Official SDK suite | 20 passed, one optional jsonschema test skipped |
| Official SDK conformance | 23 checks passed |
| DevHub successful run: photo → generation → metadata → front/back files | Passed with real local renderer and dry-run worker placeholders |
| Timeout reaches needs_you | Passed with an isolated notification observer; ID Generator keeps its four ports |
| Settings browser: custom city/font save/reload, health, manifest/schema copy, nav | Passed; acceptance values restored to owner defaults |
| Embedded panel omits Studio shell and loads saved defaults | Passed |
| Fresh ZIP without node_modules | Passed startup/stop, manifest/schema, actual headless image rendering, offline segmentation and transparent-photo rejection |

Local detailed reports/screenshots live in ignored `artifacts/id-generator-acceptance/`; clean-package report in `artifacts/launcher-build/fresh-package-result.json`. Generated employee/test outputs, Photoshop reports, input snapshots and actual keys are never committed or packaged.

The clean GitHub runner exposed a missing source-build peer-resolution setting. The launcher build now explicitly uses the same legacy peer resolution as `app/.npmrc`, so source builds from the ZIP and clean clones reproduce the existing lock without fetching a different React type dependency. The source review branch also includes that non-secret npm setting.

The Windows runner also held a JSON file past the previous 900 ms rename retry budget. Atomic replacement now tolerates transient read/antivirus locks for a bounded five seconds, keeps the old JSON intact and never deletes it as a fallback. The real Windows lock regression holds the file for 1200 ms, exceeding the old budget.

## Real Photoshop limitation

Real exports were attempted with synthetic employee/fixture data and private copies of EmployeeID.psd and IDCARDPRINT.psd. They did **not** pass: an empty cutout first failed, subsequent blocked host automation returned Windows80080005 or cancelled/rejected commands. A blocking Adobe application screen prevented the final export check.

Blocked invocation delayed queued scripts beyond worker cleanup, producing the reported `Input JSON not found` dialog. The worker now keeps immutable job-scoped inputs and guarded entry scripts, marks jobs terminal, skips stale/absent-input entries, preserves unrelated documents, restores display-dialog preferences and reports errors without rethrowing modal JavaScript exceptions. Test fixture processes were stopped. No additional real export is attempted until Photoshop access is restored.

Package/DevHub success is **not** proof of a Photoshop export. The screen/COM issue must be cleared and the final real front/back output inspected before calling this a fully verified production release.

## Remaining integration checks

1. Clear the blocking Adobe screen; run the included scenario with a fresh runId, isolated DevHub port, real worker and the owner's templates. Require `value.status:"complete"` plus actual front/back files. Do not accept a delivered failure value as generation success.
2. Register/pair the manifest in the Ports builder's final Glass hub and mount `ui.panelUrl`.
3. Exercise a physical phone run through the real hub, including away-from-home gateway routing, cancellation and hub/Studio restart.

These production Glass/phone checks are **UNVERIFIED** while the other builder owns the hub. No public release, merge or claim of full physical acceptance is made by this build.

## Checkpoints

- `f116348`: Ports service, shared model/image pipeline, local renderer dependencies.
- `5d88b8b`: owner settings, embedded panel, persistent defaults/retention and safe Photoshop documents.
- `fcea8b0`: late-dispatch protection, package regression checks and this report.

Use [builder handoff](ID_GENERATOR_PORTS_HANDOFF.md) and [connector README](../local-server/id-generator/README.md) for setup and exact port workflow.
