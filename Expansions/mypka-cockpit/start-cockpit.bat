@echo off
REM start-cockpit.bat - double-click wrapper for start-cockpit.ps1 (Windows).
REM Generated locally from launcher/templates/windows.bat.txt - review before use.
REM -ExecutionPolicy Bypass is scoped to this process only; nothing system-wide.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-cockpit.ps1"
REM Keep the window open if the server exits with an error so the user can read it.
if %ERRORLEVEL% NEQ 0 pause
