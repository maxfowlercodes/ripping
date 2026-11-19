# Posts due reels every 15 minutes via Windows Task Scheduler. Set IG_ACCESS_TOKEN and IG_USER_ID as user environment variables first.
$repo = (Resolve-Path "$PSScriptRoot\..").Path
$action = New-ScheduledTaskAction -Execute "node" -Argument "`"$repo\bin\reelkit.mjs`" post --due" -WorkingDirectory $repo
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 15)
Register-ScheduledTask -TaskName "ReelkitPost" -Action $action -Trigger $trigger -Force
