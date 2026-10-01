$ErrorActionPreference = 'Stop'
& node (Join-Path $PSScriptRoot 'scripts/mrz.cjs') stop
exit $LASTEXITCODE
