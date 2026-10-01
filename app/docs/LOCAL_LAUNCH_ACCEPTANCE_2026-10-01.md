# MRZ Studio Local 7.1.0 acceptance

Verified on the owner's Windows PC with Node 24.16.0 on 2026-10-01.

## Delivered

- Double-click CMD launch, stop and update; `mrz` installed in the user PATH.
- Production website on 5173, local API on 8787 and managed Photoshop worker.
- Readiness requires matching website/API version, process identity and worker.
- Duplicate starts reuse the runtime; idle crashes recover with bounded retries.
- Stop drains the active worker, then closes API/UI connections cooperatively.
- Upload inputs are written before publishing their claimable job record.
- Verified GitHub/offline packages, isolated startup probes, program backups,
  rollback, interrupted-install recovery and protection of local code edits.
- Windows file-lock retries preserve the old JSON and keep heartbeat failures
  from terminating an active worker.
- Current offline badge, print-margin, signature and MCP settings features are
  retained in the canonical `app/` project.

## Evidence

- Launcher/update test suite: 13 tests covering startup, duplicate start, crash
  recovery, port conflict, stale PID ownership, job draining, Windows locks,
  package policy, local edits, rollback, interrupted recovery and ZIP handling.
- Existing mapping, bilingual date, print-margin, signature, gender and MCP
  persistence/HTTP tests passed.
- Clean app dependency installation and production build passed. Vite 6.4.3
  and React Router 7.18.4 are pinned; dependency audit reports zero findings.
- Fresh release ZIP extracted and started on isolated ports without
  `node_modules` or npm installation; worker, settings route and built JS asset
  responded, then stop released the runtime.
- Live installed PC: API/UI/worker ready; Photoshop and EmployeeID template
  detected; queue/processing empty. Normal launch is not in dry-run mode.
- Browser: MCP settings loaded through the production server; health showed
  API reachable, worker online, Photoshop found and template found. Glass JSON
  copy displayed a successful clipboard confirmation.

## Release boundary

The first compatible local GitHub release has not been published as part of
this build. The updater skips the existing V7 source-only downloads and reports
that accurately. The PR includes a Windows verification/package workflow;
publishing `mrz-local-v7.1.0` after review creates its ZIP, checksums and manifest.
No real Photoshop job was created for launcher acceptance. Active-job stop
behavior was exercised with an isolated deterministic worker fixture.

Runtime implementation and update trust details: [LOCAL_RUNTIME.md](LOCAL_RUNTIME.md).
Relevant upstream patches: [Vite advisory](https://github.com/vitejs/vite/security/advisories/GHSA-fx2h-pf6j-xcff)
and [React Router advisory](https://github.com/remix-run/react-router/security/advisories/GHSA-49rj-9fvp-4h2h).
