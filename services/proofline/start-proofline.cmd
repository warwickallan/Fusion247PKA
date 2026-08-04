@echo off
setlocal EnableExtensions DisableDelayedExpansion

rem ===========================================================================
rem  start-proofline.cmd - THE way to start Proofline on Windows.
rem
rem  Paste this ONE line into any Windows terminal - Command Prompt or
rem  PowerShell, either works, and you do not need to change directory first:
rem
rem      C:\Fusion247PKA-build-020-trial\services\proofline\start-proofline.cmd
rem
rem  Then open  http://127.0.0.1:7317/
rem
rem  WHY THIS FILE EXISTS, AND WHY IT IS PLAIN ASCII
rem  -----------------------------------------------
rem  1. Command Prompt cannot run a .ps1 at all. ".PS1" is not in PATHEXT, so
rem     cmd.exe hands the file to the shell file-association handler, which on
rem     this machine has no handler registered - you get the "Select an app to
rem     open this .ps1 file" dialog and no server.
rem  2. Windows PowerShell 5.1 reads an unmarked .ps1 as ANSI, not UTF-8. A
rem     single em-dash in the old launcher decoded into a curly quote and broke
rem     the parser outright. Every byte in THIS file is below 0x80 so that can
rem     never happen here.
rem
rem  This launcher invokes node directly. No PowerShell, no execution policy,
rem  no file associations, no encoding hazard.
rem
rem  There are no secrets here and none anywhere in Proofline. It binds
rem  127.0.0.1 only and makes no outbound request.
rem
rem  Options:
rem      --port 7400          start on a different port
rem      --detached           run in a separate minimised window
rem      --data-dir <path>    use a different journal directory
rem      --help               show this
rem  The PowerShell-style spellings -Port, -Detached, -DataDir also work.
rem
rem  STOPPING IT IS ABRUPT ON WINDOWS, AND THAT IS SAFE BY DESIGN. See RUNBOOK.md.
rem ===========================================================================

rem SELF is captured BEFORE any `shift`, because `shift` moves %0 as well and
rem every later message quotes the launcher's own path back at the reader.
set "SELF=%~f0"
set "SVC=%~dp0"
set "SVC=%SVC:~0,-1%"
set "ENTRY=%SVC%\bin\proofline.mjs"

set "PORT=7317"
if defined PROOFLINE_PORT set "PORT=%PROOFLINE_PORT%"
set "DETACHED="
set "DATADIR="
if defined PROOFLINE_DATA_DIR set "DATADIR=%PROOFLINE_DATA_DIR%"

rem --- 0. options -----------------------------------------------------------
:parse_args
if "%~1"=="" goto args_done
if /i "%~1"=="--help"      goto show_help
if /i "%~1"=="-help"       goto show_help
if /i "%~1"=="-h"          goto show_help
if /i "%~1"=="/?"          goto show_help
if /i "%~1"=="--port"      (set "PORT=%~2" & shift & shift & goto parse_args)
if /i "%~1"=="-port"       (set "PORT=%~2" & shift & shift & goto parse_args)
if /i "%~1"=="--data-dir"  (set "DATADIR=%~2" & shift & shift & goto parse_args)
if /i "%~1"=="-datadir"    (set "DATADIR=%~2" & shift & shift & goto parse_args)
if /i "%~1"=="--detached"  (set "DETACHED=1" & shift & goto parse_args)
if /i "%~1"=="-detached"   (set "DETACHED=1" & shift & goto parse_args)
echo.
echo [proofline] STOPPED: I do not understand the option "%~1".
echo.
goto show_help_fail

:args_done

rem --- 1. the port must be a sensible number --------------------------------
if not defined PORT goto bad_port
echo %PORT%|findstr /r /c:"^[0-9][0-9]*$" >nul
if errorlevel 1 goto bad_port
if %PORT% LSS 1 goto bad_port
if %PORT% GTR 65535 goto bad_port

if defined DATADIR (set "RESOLVED_DATA=%DATADIR%") else (set "RESOLVED_DATA=%SVC%\.data")

rem --- 2. node must be present and new enough -------------------------------
where node >nul 2>&1
if errorlevel 1 goto no_node

set "NODE_VER="
for /f "usebackq tokens=*" %%v in (`node --version 2^>nul`) do set "NODE_VER=%%v"
if not defined NODE_VER goto no_node

set "NODE_MAJ=%NODE_VER:v=%"
for /f "tokens=1 delims=." %%a in ("%NODE_MAJ%") do set "NODE_MAJ=%%a"
echo %NODE_MAJ%|findstr /r /c:"^[0-9][0-9]*$" >nul
if errorlevel 1 goto odd_node
if %NODE_MAJ% LSS 22 goto old_node

rem --- 3. the entrypoint must exist -----------------------------------------
if not exist "%ENTRY%" goto no_entry

rem --- 4. the port must be free ---------------------------------------------
set "BUSYPID="
for /f "tokens=5" %%p in ('netstat -ano -p TCP ^| findstr /r /c:"127\.0\.0\.1:%PORT% " ^| findstr /c:"LISTENING"') do set "BUSYPID=%%p"
if defined BUSYPID goto port_busy

rem --- 5. go ----------------------------------------------------------------
set "PROOFLINE_PORT=%PORT%"
if defined DATADIR set "PROOFLINE_DATA_DIR=%DATADIR%"

echo [proofline] service dir : %SVC%
echo [proofline] node        : %NODE_VER%
echo [proofline] data dir    : %RESOLVED_DATA%
echo [proofline] url         : http://127.0.0.1:%PORT%/   (loopback only)

if defined DETACHED goto start_detached

echo [proofline] starting in the foreground - press Ctrl+C to stop it
echo.
node "%ENTRY%"
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" (
  echo.
  echo [proofline] STOPPED: the service exited with code %RC%.
  echo             Scroll up for the reason. The most common causes are a port
  echo             already in use, a bad PROOFLINE_PORT value, or a journal that
  echo             is damaged in the middle. RUNBOOK.md has a section for each.
  echo.
  pause
)
endlocal & exit /b %RC%

rem --- detached -------------------------------------------------------------
:start_detached
if not exist "%RESOLVED_DATA%" mkdir "%RESOLVED_DATA%"
echo [proofline] detached, logging to: %RESOLVED_DATA%\proofline.log
echo.
start "Proofline" /MIN /D "%SVC%" cmd /s /c "node bin\proofline.mjs >> "%RESOLVED_DATA%\proofline.log" 2>> "%RESOLVED_DATA%\proofline.log.err""

set "TRIES=0"
:wait_loop
node -e "setTimeout(function(){},350)" >nul 2>&1
set "LIVEPID="
for /f "tokens=5" %%p in ('netstat -ano -p TCP ^| findstr /r /c:"127\.0\.0\.1:%PORT% " ^| findstr /c:"LISTENING"') do set "LIVEPID=%%p"
if defined LIVEPID goto detached_up
set /a TRIES+=1
if %TRIES% LSS 12 goto wait_loop

echo.
echo [proofline] STOPPED: it did not come up within about 5 seconds.
echo             What the service printed:
echo.
if exist "%RESOLVED_DATA%\proofline.log" type "%RESOLVED_DATA%\proofline.log"
if exist "%RESOLVED_DATA%\proofline.log.err" type "%RESOLVED_DATA%\proofline.log.err"
echo.
pause
endlocal & exit /b 1

:detached_up
echo [proofline] started, PID %LIVEPID%
echo [proofline] open  http://127.0.0.1:%PORT%/
echo.
echo [proofline] It is running in a SEPARATE MINIMISED WINDOW titled "Proofline".
echo             That window is the service. You can close THIS terminal and it
echo             keeps running. Closing the "Proofline" window stops it.
echo [proofline] To stop it:  taskkill /PID %LIVEPID% /F
echo.
endlocal & exit /b 0

rem --- the loud failures ----------------------------------------------------
:no_node
echo.
echo [proofline] STOPPED: I could not find Node on this machine.
echo.
echo             Proofline needs Node 22 or newer. Nothing else - no npm
echo             packages, no installer, no accounts.
echo.
echo             Install Node from https://nodejs.org/ (take the LTS build),
echo             then CLOSE this terminal, open a new one, and paste the same
echo             command again. A new terminal is needed because the installer
echo             only changes PATH for terminals opened after it.
echo.
pause
endlocal & exit /b 1

:old_node
echo.
echo [proofline] STOPPED: the Node on this machine is %NODE_VER%, which is too old.
echo.
echo             Proofline needs Node 22 or newer.
echo.
echo             Install the current LTS from https://nodejs.org/, then close
echo             this terminal, open a new one, and paste the same command again.
echo.
pause
endlocal & exit /b 1

:odd_node
echo.
echo [proofline] STOPPED: I could not read the Node version. "node --version"
echo             answered "%NODE_VER%", which I did not expect.
echo.
echo             Run  node --version  yourself. If it does not print something
echo             like v22.18.0, the Node install is broken - reinstall it from
echo             https://nodejs.org/.
echo.
pause
endlocal & exit /b 1

:no_entry
echo.
echo [proofline] STOPPED: the Proofline program file is missing.
echo.
echo             I expected it here:
echo               %ENTRY%
echo.
echo             This launcher looks for the program next to itself, so this
echo             usually means the file was deleted or only part of the folder
echo             was copied. Restore the folder from Git and try again.
echo.
pause
endlocal & exit /b 1

:port_busy
echo.
echo [proofline] STOPPED: something is already using port %PORT%.
echo.
echo             It is almost always a Proofline you forgot to stop. Try the
echo             page first - it may already be running and waiting for you:
echo               http://127.0.0.1:%PORT%/
echo.
echo             If you want to stop whatever is there:
echo               taskkill /PID %BUSYPID% /F
echo.
echo             Or start this one somewhere else:
echo               "%SELF%" --port 7400
echo.
pause
endlocal & exit /b 1

:bad_port
echo.
echo [proofline] STOPPED: "%PORT%" is not a usable port number.
echo.
echo             A port is a plain whole number between 1 and 65535, and 7317
echo             is the normal one. For example:
echo               "%SELF%" --port 7400
echo.
pause
endlocal & exit /b 1

:show_help_fail
call :print_help
pause
endlocal & exit /b 1

:show_help
call :print_help
endlocal & exit /b 0

:print_help
echo Proofline launcher
echo.
echo   Start it (this is the whole command, from any terminal, any folder):
echo     "%SELF%"
echo.
echo   Then open  http://127.0.0.1:7317/
echo.
echo   Options:
echo     --port 7400         start on a different port
echo     --detached          run in a separate minimised window, so you can
echo                         close the terminal you started it from
echo     --data-dir ^<path^>   use a different journal directory
echo     --help              this text
echo.
echo   Stop it: Ctrl+C in the foreground, or  taskkill /PID ^<pid^> /F
echo   Operating notes, health checks and recovery: RUNBOOK.md
goto :eof
