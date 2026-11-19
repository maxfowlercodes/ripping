@echo off
rem Double-click to start Reelkit. Hidden, with logs, and a message box if it cannot start.
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0start-windows.ps1"
