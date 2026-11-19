# Starts Reelkit (hidden) and opens its window. If Reelkit is already running it just opens the window.
# Logs go to %USERPROFILE%\.reelkit\. If something fails you get a message box instead of silence.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
$root = (Resolve-Path "$PSScriptRoot\..").Path
$logDir = Join-Path $env:USERPROFILE '.reelkit'; New-Item -ItemType Directory -Force $logDir | Out-Null
$log = Join-Path $logDir 'launcher.log'
function Fail($m) { "$(Get-Date -Format s) FAIL: $m" | Out-File $log -Append; [System.Windows.Forms.MessageBox]::Show("$m`n`nLogs are in: $logDir", 'Reelkit could not start') | Out-Null; exit 1 }
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Fail 'Node.js was not found. Run scripts\install-windows.ps1 again, then open a new window.' }
if (-not (Test-Path (Join-Path $root 'bin\reelkit.mjs'))) { Fail "Reelkit files were not found in $root" }
Set-Location $root
$url = 'http://127.0.0.1:4177/healthz'
function Up { try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 $url).Content -match 'reelkit' } catch { $false } }
if (Up) { "$(Get-Date -Format s) already running, opening window" | Out-File $log -Append; & $node.Source bin\reelkit.mjs open | Out-Null; exit 0 }
"$(Get-Date -Format s) starting" | Out-File $log -Append
$out = Join-Path $logDir 'server.out.log'; $err = Join-Path $logDir 'server.err.log'
Start-Process -FilePath $node.Source -ArgumentList 'bin\reelkit.mjs', 'dashboard', '--open' -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err
for ($i = 0; $i -lt 60; $i++) { Start-Sleep -Milliseconds 500; if (Up) { "$(Get-Date -Format s) up" | Out-File $log -Append; exit 0 } }
$tail = if (Test-Path $err) { (Get-Content $err -Tail 10) -join "`n" } else { '' }
Fail "Reelkit did not start within 30 seconds.`n`n$tail"
