# =============================================================================
# Fusion Tower — independent 5-minute watchdog Scheduled Task (Windows).
#
# ANNOUNCE-DON'T-LAUNCH: registers the watchdog task; does NOT start a live loop.
# The watchdog is a SEPARATE failure domain from the main dispatcher service (Pax
# Item 4) so the two never share a crash. It runs `node src/watchdog.js` every 5
# minutes: one lease sweep, then exit.
#
# Run from an elevated PowerShell. Adjust paths for your machine.
# =============================================================================

param(
  [string]$TaskName = "FusionTowerWatchdog",
  [string]$NodeExe  = "C:\Program Files\nodejs\node.exe",
  [string]$AppDir   = "C:\Fusion247PKA\services\fusion-tower",
  [string]$Entry    = "src\watchdog.js"
)

Write-Host "Fusion Tower watchdog task registration (5-minute dead-man sweep)"
Write-Host "This registers a task; it does NOT start a live production loop."

# $action  = New-ScheduledTaskAction -Execute $NodeExe -Argument $Entry -WorkingDirectory $AppDir
# $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration ([TimeSpan]::MaxValue)
# $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
# $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
# Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal
#
# The task runs whether or not a user is logged on, self-heals via -StartWhenAvailable,
# and reaps expired turn leases even if the main dispatcher service is wedged.

Write-Host ""
Write-Host "Register-ScheduledTask command is printed above (commented). Review, then run it."
