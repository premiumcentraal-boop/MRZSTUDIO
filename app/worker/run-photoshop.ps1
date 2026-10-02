param([Parameter(Mandatory=$true)][string]$ScriptPath,[Parameter(Mandatory=$true)][string]$PhotoshopExe)
$ErrorActionPreference = 'Stop'
$photoshopAutomation = $null
try {
  # Adobe's Windows automation interface executes in the running application.
  # Releasing the proxy never closes the owner's Photoshop instance.
  try { $photoshopAutomation = [Runtime.InteropServices.Marshal]::GetActiveObject('Photoshop.Application') }
  catch {
    try { $photoshopAutomation = New-Object -ComObject Photoshop.Application }
    catch {
      # Keep the existing file-launch path for installations without COM.
      # Fallback is safe only before a script has been dispatched.
      [Console]::Error.WriteLine('Photoshop automation is unavailable; attempting the installed Photoshop file launcher.')
      $launch = New-Object Diagnostics.ProcessStartInfo
      $launch.FileName = [IO.Path]::GetFullPath($PhotoshopExe)
      $launch.Arguments = '"' + [IO.Path]::GetFullPath($ScriptPath) + '"'
      $launch.UseShellExecute = $false
      $launch.CreateNoWindow = $true
      $launch.WindowStyle = [Diagnostics.ProcessWindowStyle]::Hidden
      $fileLauncher = [Diagnostics.Process]::Start($launch)
      $fileLauncher.WaitForExit()
      exit $fileLauncher.ExitCode
    }
  }
  $null = $photoshopAutomation.DoJavaScriptFile([IO.Path]::GetFullPath($ScriptPath))
} catch {
  [Console]::Error.WriteLine('Photoshop could not execute the job script. Check the per-job report and clear any Photoshop sign-in, subscription or error dialog.')
  exit 1
} finally {
  if ($null -ne $photoshopAutomation) { $null = [Runtime.InteropServices.Marshal]::ReleaseComObject($photoshopAutomation) }
}
