# Creates a Desktop shortcut and (optionally) starts Reelkit at login.   powershell -ExecutionPolicy Bypass -File scripts\create-shortcut.ps1 [-AtLogin]
param([switch]$AtLogin)
$root = (Resolve-Path "$PSScriptRoot\..").Path
$ws = New-Object -ComObject WScript.Shell
$lnk = $ws.CreateShortcut("$([Environment]::GetFolderPath('Desktop'))\Reelkit.lnk")
$lnk.TargetPath = "wscript.exe"; $lnk.Arguments = "`"$root\scripts\Reelkit-hidden.vbs`""; $lnk.WorkingDirectory = $root
if (Test-Path "$root\app\icon.ico") { $lnk.IconLocation = "$root\app\icon.ico" }
$lnk.Save(); Write-Host "Desktop shortcut created."
if ($AtLogin) {
  $a = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$root\scripts\Reelkit-hidden.vbs`"" -WorkingDirectory $root
  $t = New-ScheduledTaskTrigger -AtLogOn
  Register-ScheduledTask -TaskName "Reelkit" -Action $a -Trigger $t -Force | Out-Null; Write-Host "Reelkit will start at login (keeps scheduled posts and daily check-ins running)."
}
