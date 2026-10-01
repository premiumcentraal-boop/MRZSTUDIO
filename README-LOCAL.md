# MRZ Studio Local 7.1.0

Employee badge studio on your Windows PC. The website, local API and Photoshop
worker start together. Your settings, templates, jobs and outputs stay here.

## Open Studio

Double-click **Start-MRZ-Local.cmd**. It checks all services, then opens
[MRZ Studio](http://127.0.0.1:5173/). Closing the command window leaves Studio
running. Double-click **Stop-MRZ-Local.cmd** when finished.

From Command Prompt, inside this folder:

```bat
mrz start
mrz status
mrz doctor
mrz restart
mrz stop
```

To make `mrz` available from any folder, run once:

```bat
powershell -NoProfile -ExecutionPolicy Bypass -File Install-MRZ-Command.ps1
```

Open a new Command Prompt afterwards. No administrator permission is needed.
Existing PowerShell launchers and `npm start` / `npm stop` also work.

## Updates

Double-click **Update-MRZ-Local.cmd**, or:

```bat
mrz update --check
mrz update
mrz rollback
```

Updates come from the [MRZ Studio GitHub releases](https://github.com/premiumcentraal-boop/MRZSTUDIO/releases).
The updater accepts verified local packages, checks every file, tests startup
before installation and saves the previous version for rollback. Older
source-only V7 downloads are skipped. A failed update restores the previous
code; an interrupted update recovers on the next start.

Updates preserve `control/` (including MCP settings), `queue/`, `output/`,
`logs/` and your templates, job files and outputs in `app/worker/local-worker/`.
Worker helper scripts refresh from the released source on launch.
Local source edits block updates so they are not silently overwritten.
Finish the current job before updating. Stop allows an active job to finish.

## Requirements and setup

- Windows 10/11 and Node.js 22 or newer; Node 24 is used for verification.
- Adobe Photoshop and your licensed PSD templates for real badge generation.
- A local release ZIP includes the built UI. Normal start needs no npm install,
  development server or network connection.

Photoshop is detected from `PHOTOSHOP_EXE`, then `control/photoshop-path.txt`,
then common Adobe installation folders. `mrz doctor` reports detection.
Put `EmployeeID.psd` in `app/worker/local-worker/templates/`. Keep any optional
print templates there too. Private templates are never distributed in releases.

[MCP connections](http://127.0.0.1:5173/settings/mcp) remains in the menu.
The API stays at `http://127.0.0.1:8787` for Cyclone Glass.
See [MCP setup](app/docs/MCP_CONNECTIONS.md).

## Source development and diagnostics

```bat
mrz build
npm test
npm --prefix app run test:all
```

`mrz build` installs locked app dependencies if missing, builds in local mode
and records the accepted source version. Stop Studio before rebuilding.
Use `npm --prefix app run dev` only for Vite development.

Diagnostics: `mrz doctor --json`. Logs: `logs/runtime.log`, `api-runtime.log`,
`ui-runtime.log` and `worker-runtime.log`. A worker interrupted during a job
leaves that job in `queue/processing` for inspection, without automatic replay.
See [runtime and release details](app/docs/LOCAL_RUNTIME.md).
