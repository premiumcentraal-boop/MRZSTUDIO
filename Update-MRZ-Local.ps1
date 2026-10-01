param([switch]$Check)
$ErrorActionPreference = 'Stop'
$arguments = @((Join-Path $PSScriptRoot 'scripts/mrz.cjs'), 'update')
if ($Check) { $arguments += '--check' }
& node @arguments
exit $LASTEXITCODE
