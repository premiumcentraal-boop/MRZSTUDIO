$ErrorActionPreference = 'Stop'
$studioRoot = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\')
$existing = [Environment]::GetEnvironmentVariable('Path', 'User')
$entries = @($existing -split ';' | Where-Object { $_ })
if (-not ($entries | Where-Object { $_.TrimEnd('\') -ieq $studioRoot })) {
  [Environment]::SetEnvironmentVariable('Path', (($entries + $studioRoot) -join ';'), 'User')
}
if (-not (($env:Path -split ';') | Where-Object { $_.TrimEnd('\') -ieq $studioRoot })) { $env:Path += ';' + $studioRoot }
Add-Type -Namespace MRZ -Name EnvironmentNotice -MemberDefinition '[System.Runtime.InteropServices.DllImport("user32.dll", CharSet=System.Runtime.InteropServices.CharSet.Auto)] public static extern System.IntPtr SendMessageTimeout(System.IntPtr hWnd, uint Msg, System.UIntPtr wParam, string lParam, uint flags, uint timeout, out System.UIntPtr result);'
$noticeResult = [UIntPtr]::Zero
[MRZ.EnvironmentNotice]::SendMessageTimeout([IntPtr]0xffff, 0x1a, [UIntPtr]::Zero, 'Environment', 2, 3000, [ref]$noticeResult) | Out-Null
Write-Host 'Installed the mrz command for this user. Open a new Command Prompt and run: mrz start'
