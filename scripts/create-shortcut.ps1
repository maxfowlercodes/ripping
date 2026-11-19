# Creates a Desktop shortcut and (optionally) starts Reelkit at sign-in.   powershell -ExecutionPolicy Bypass -File scripts\create-shortcut.ps1 [-AtLogin]
param([switch]$AtLogin)
$root = (Resolve-Path "$PSScriptRoot\..").Path
$args = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$root\scripts\start-windows.ps1`""
$ws = New-Object -ComObject WScript.Shell
$lnk = $ws.CreateShortcut("$([Environment]::GetFolderPath('Desktop'))\Reelkit.lnk")
$lnk.TargetPath = "powershell.exe"; $lnk.Arguments = $args; $lnk.WorkingDirectory = $root; $lnk.WindowStyle = 7
$ico = Join-Path $root 'app\icon.ico'; if (Test-Path $ico) { $lnk.IconLocation = $ico }
$lnk.Save(); Write-Host "Desktop shortcut created (Reelkit)."
if ($AtLogin) {
  $a = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $args -WorkingDirectory $root
  $t = New-ScheduledTaskTrigger -AtLogOn
  Register-ScheduledTask -TaskName "Reelkit" -Action $a -Trigger $t -Force | Out-Null; Write-Host "Reelkit will start at sign-in."
}
