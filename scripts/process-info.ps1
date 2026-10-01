param([int]$ProcessId, [int]$Port)
if ($Port) {
  $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $listener) { 'null'; exit }
  $ProcessId = $listener.OwningProcess
}
$ErrorActionPreference = 'Stop'
$p = Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId"
if ($p) { @{ pid=[int]$p.ProcessId; command=[string]$p.CommandLine; created=$p.CreationDate.ToUniversalTime().ToString('o') } | ConvertTo-Json -Compress }
else { 'null' }
