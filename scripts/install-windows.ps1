# Reelkit installer for Windows 10/11 (no WSL needed).  powershell -ExecutionPolicy Bypass -File scripts\install-windows.ps1
$ErrorActionPreference = 'Stop'
function Need($cmd, $id) { if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { Write-Host "Installing $id ..."; winget install --id $id -e --accept-source-agreements --accept-package-agreements } else { Write-Host "OK $cmd" } }
Need node 'OpenJS.NodeJS.LTS'
Need ffmpeg 'Gyan.FFmpeg'
Need python 'Python.Python.3.12'
if (-not (Test-Path "$env:ProgramFiles (x86)\Microsoft\Edge\Application\msedge.exe") -and -not (Test-Path "$env:ProgramFiles\Google\Chrome\Application\chrome.exe")) { Write-Host "Install Chrome or Edge (Edge ships with Windows 10/11)." }
Write-Host "Next (in a NEW PowerShell window):  npm install ; node bin\reelkit.mjs doctor"
Write-Host "Optional: pip install edge-tts   (free neural voices)   |   pip install faster-whisper   (filler-word removal, captions for your own footage)"
Write-Host "Optional: npm install -g @anthropic-ai/claude-code   (the AI brain for the reel-studio skill)"
