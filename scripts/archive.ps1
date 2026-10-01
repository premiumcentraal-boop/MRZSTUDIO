param([Parameter(Mandatory=$true)][ValidateSet('Pack','Unpack')][string]$Mode,
      [Parameter(Mandatory=$true)][string]$Archive,
      [Parameter(Mandatory=$true)][string]$Directory)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$archivePath = [IO.Path]::GetFullPath($Archive)
$folder = [IO.Path]::GetFullPath($Directory).TrimEnd('\') + '\'
if ($Mode -eq 'Pack') {
  $package = [IO.Compression.ZipFile]::Open($archivePath, [IO.Compression.ZipArchiveMode]::Create)
  try {
    foreach ($file in [IO.Directory]::EnumerateFiles($folder, '*', [IO.SearchOption]::AllDirectories)) {
      $name = $file.Substring($folder.Length).Replace('\', '/')
      [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($package, $file, $name, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
  } finally { $package.Dispose() }
  exit
}
$zip = [IO.Compression.ZipFile]::OpenRead($archivePath)
try {
  $seen = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  [long]$total = 0
  if ($zip.Entries.Count -gt 8000) { throw 'Too many package entries.' }
  foreach ($entry in $zip.Entries) {
    $name = $entry.FullName
    if ($name.Contains('\') -or $name.Contains(':') -or $name.StartsWith('/') -or ($name.TrimEnd('/') -split '/') -contains '..' -or ($name.TrimEnd('/') -split '/') -contains '.') { throw 'Unsafe archive path.' }
    foreach ($segment in ($name.TrimEnd('/') -split '/')) {
      if (-not $segment -or $segment -match '[. ]$|[<>"|?*\x00-\x1f]' -or $segment -match '^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)') { throw 'Unsafe Windows archive path.' }
    }
    $target = [IO.Path]::GetFullPath((Join-Path $folder $name))
    if (-not $target.StartsWith($folder, [StringComparison]::OrdinalIgnoreCase) -or -not $seen.Add($name.TrimEnd('/'))) { throw 'Unsafe or duplicate archive entry.' }
    if ((($entry.ExternalAttributes -shr 16) -band 61440) -eq 40960) { throw 'Links are not allowed in packages.' }
    $total += $entry.Length
    if ($entry.Length -gt 134217728 -or $total -gt 536870912) { throw 'Package expands beyond its size limit.' }
  }
  # Check every entry before writing any file, including link and traversal checks.
  foreach ($entry in $zip.Entries) {
    $target = [IO.Path]::GetFullPath((Join-Path $folder $entry.FullName))
    if ($entry.FullName.EndsWith('/')) { [IO.Directory]::CreateDirectory($target) | Out-Null; continue }
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target)) | Out-Null
    [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $false)
  }
} finally { $zip.Dispose() }
