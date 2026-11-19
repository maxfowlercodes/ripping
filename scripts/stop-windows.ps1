# Stops every running Reelkit process (the app and its background worker). Safe: only touches node processes running reelkit.mjs.
Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match 'reelkit\.mjs' } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop; Write-Host "Stopped Reelkit process $($_.ProcessId)" } catch {} }
Start-Sleep -Milliseconds 600
