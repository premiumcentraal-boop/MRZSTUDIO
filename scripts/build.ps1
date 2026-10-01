$ErrorActionPreference = 'Stop'
$studioRoot = Split-Path $PSScriptRoot -Parent
$npmCommand = Get-Command npm.cmd -ErrorAction Stop
$env:VITE_LOCAL_MODE = 'true'
$env:VITE_LOCAL_API_BASE = ''
$lockPath = Join-Path $studioRoot 'app/package-lock.json'
$hasher = [Security.Cryptography.SHA256]::Create()
try { $lockHash = [BitConverter]::ToString($hasher.ComputeHash([IO.File]::ReadAllBytes($lockPath))).Replace('-', '') } finally { $hasher.Dispose() }
$modulesPath = Join-Path $studioRoot 'app/node_modules'
if ((Test-Path -LiteralPath $modulesPath) -and ((Get-Item -LiteralPath $modulesPath).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Linked node_modules is not supported by the local build.' }
$stampPath = Join-Path $modulesPath '.mrz-lock-sha256'
$installedHash = if (Test-Path -LiteralPath $stampPath) { (Get-Content -LiteralPath $stampPath -Raw).Trim() } else { '' }
if ($installedHash -ne $lockHash -or -not (Test-Path -LiteralPath (Join-Path $modulesPath 'vite/bin/vite.js'))) {
  & $npmCommand.Source --prefix (Join-Path $studioRoot 'app') ci
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  [IO.File]::WriteAllText($stampPath, $lockHash)
}
& $npmCommand.Source --prefix (Join-Path $studioRoot 'app') run build
exit $LASTEXITCODE
