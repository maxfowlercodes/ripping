# Reelkit installer for Windows 10/11 (no WSL).   powershell -ExecutionPolicy Bypass -File scripts\install-windows.ps1
$ErrorActionPreference = 'Stop'
function Need($cmd, $id) { if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { Write-Host "Installing $id ..."; winget install --id $id -e --accept-source-agreements --accept-package-agreements } else { Write-Host "OK $cmd" } }
Need node   'OpenJS.NodeJS.LTS'
Need python 'Python.Python.3.12'
Write-Host "`nIf node/python were just installed, close this window, open a NEW PowerShell, and run this script again."
if ((Get-Command node -ErrorAction SilentlyContinue) -and (Get-Command python -ErrorAction SilentlyContinue)) {
  Set-Location (Resolve-Path "$PSScriptRoot\..")
  npm install                                       # playwright-core + bundled ffmpeg (optional deps)
  python -m pip install --upgrade piper-tts faster-whisper edge-tts kokoro-onnx soundfile   # voices + speech recognition
  node bin\reelkit.mjs voices install piper en     # small offline voice (~60 MB)
  node bin\reelkit.mjs voices install kokoro       # best free voice (~350 MB, one time)
  Write-Host "Optional: npm install -g @anthropic-ai/claude-code   then run  claude  once to sign in (needed for the AI parts)."
  powershell -ExecutionPolicy Bypass -File scripts\create-shortcut.ps1
  node bin\reelkit.mjs doctor
}
