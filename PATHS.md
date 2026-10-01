# MRZ Studio Local (Agent PC path map)

Root: C:\Users\Agent\MRZ-Studio-Local

app\          Frontend + adapted local API (from MRZ Studio V7)
queue\
  incoming\   New jobs dropped by frontend (job.json + assets)
  processing\ Claimed by worker
  done\       Completed jobs + result paths
  failed\     Failed jobs + error.txt
output\       Final PNG/PSD/PDF artifacts
logs\         Worker + server logs
control\      start/stop state files
prompts\      Grok prompts
artifacts\    Status reports

Photoshop worker should read queue\incoming and write to output\ + queue\done.

## STANDARD TEMPLATE
C:\Users\Agent\Documents\New project\EmployeeID
(junctioned to app\worker\local-worker\templates)

## CANONICAL BACKUP (2026-09-10)

Immutable copies live at:

    C:\Users\Agent\MRZ-Studio-Canonical\assets\PRISTINE\01-EmployeeID

Do **not** retarget this junction at PRISTINE. A live worker `subDoc.save()` would
dirty the backup. Prefer a disposable work copy:

    C:\Users\Agent\MRZ-Studio-Canonical\Copy-PristineTemplates.ps1
    C:\Users\Agent\MRZ-Studio-Canonical\Copy-PristineTemplates.ps1 -JobId <id>

Default work copy: `C:\Users\Agent\MRZ-Studio-Canonical\runtime\templates-active`

This local queue\ and output\ were not changed when Canonical was built.
See `C:\Users\Agent\MRZ-Studio-Canonical\README.md`.


## ACTIVE TEMPLATES (retargeted)
C:\Users\Agent\MRZ-Studio-Local\app\worker\local-worker\templates -> C:\Users\Agent\MRZ-Studio-Canonical\runtime\templates-active
PRISTINE: C:\Users\Agent\MRZ-Studio-Canonical\assets\PRISTINE\01-EmployeeID
