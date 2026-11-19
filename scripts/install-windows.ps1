# Reelkit installer for Windows 10/11 (no WSL needed). Run in PowerShell:  powershell -ExecutionPolicy Bypass -File scripts\install-windows.ps1
$ErrorActionPreference = 'Stop'
function Need($cmd, $id) { if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { Write-Host "Installing $id ..."; winget install --id $id -e --accept-source-agreements --accept-package-agreements } else { Write-Host "OK $cmd" } }
Need node 'OpenJS.NodeJS.LTS'
Need ffmpeg 'Gyan.FFmpeg'
Need python 'Python.Python.3.12'
Write-Host "Optional free neural voice:  pip install edge-tts"
Write-Host "Optional Claude Code (the AI brain): npm install -g @anthropic-ai/claude-code"
Write-Host "`nClose and reopen PowerShell, then:  node bin\reelkit.mjs doctor"
