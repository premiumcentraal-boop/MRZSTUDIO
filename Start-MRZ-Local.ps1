param([switch]$NoBrowser, [switch]$NoWorker)
$ErrorActionPreference = 'Stop'
$arguments = @((Join-Path $PSScriptRoot 'scripts/mrz.cjs'), 'start')
if ($NoBrowser) { $arguments += '--no-browser' }
if ($NoWorker) { $arguments += '--no-worker' }
& node @arguments
exit $LASTEXITCODE
