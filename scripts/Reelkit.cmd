@echo off
rem Double-click to start Reelkit in its own window (uses Edge/Chrome app mode, no installer needed).
cd /d "%~dp0.."
start "" /min wscript.exe "%~dp0Reelkit-hidden.vbs"
