# Updates Reelkit in place from GitHub. Keeps your data (reelkit-data) and installed packages. Close Reelkit first.
#   powershell -ExecutionPolicy Bypass -File scripts\update-windows.ps1
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path "$PSScriptRoot\..").Path
$tmp = Join-Path $env:TEMP ("reelkit-update-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory $tmp | Out-Null
Write-Host "Downloading the latest version..."
Invoke-WebRequest https://github.com/maxfowlercodes/ripping/archive/refs/heads/main.zip -OutFile "$tmp\r.zip"
Expand-Archive "$tmp\r.zip" $tmp
$src = Join-Path $tmp "ripping-main"
Get-ChildItem $src -Force | Where-Object { $_.Name -notin @('reelkit-data', 'node_modules', '.git') } | ForEach-Object { Copy-Item $_.FullName -Destination $root -Recurse -Force }
Remove-Item $tmp -Recurse -Force
Set-Location $root
npm install --no-audit --no-fund
Write-Host "`nUpdated. Start Reelkit from the Desktop shortcut."
