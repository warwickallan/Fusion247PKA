# =============================================================================
# Fusion Tower — always-on dispatcher service registration (Windows).
#
# ANNOUNCE-DON'T-LAUNCH: this script REGISTERS the service; it does NOT start a
# live governance loop against production surfaces. Warwick runs it deliberately,
# once, after the WP0 live gates are cleared (see tower-host-runbook.md). It never
# auto-installs from the build; it is provided for the human to execute.
#
# Primary path: NSSM (best restart semantics + stdout/stderr logging).
# Fallback path: a Scheduled Task "run whether user is logged on or not" + "At
# startup" + "Restart on failure" (zero-install) — see the commented block below.
#
# Run from an elevated PowerShell. Adjust the paths for your machine.
# =============================================================================

param(
  [string]$ServiceName = "FusionTower",
  [string]$NodeExe     = "C:\Program Files\nodejs\node.exe",
  [string]$AppDir      = "C:\Fusion247PKA\services\fusion-tower",
  [string]$Entry       = "src\tower.js",
  [string]$LogDir      = "C:\Fusion247PKA\services\fusion-tower\.logs",
  [string]$EnvFile     = "C:\Fusion247PKA\services\fusion-tower\.env"
)

Write-Host "Fusion Tower service registration (NSSM primary path)"
Write-Host "This registers a service; it does NOT start a live production loop."

# --- Preconditions ----------------------------------------------------------
if (-not (Get-Command nssm -ErrorAction SilentlyContinue)) {
  Write-Warning "NSSM not found on PATH. Install it (scoop install nssm) or use the Scheduled Task fallback below."
}
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

# --- NSSM registration (auto-start at boot, restart on crash, no login needed) --
# nssm install $ServiceName "$NodeExe" "$Entry"
# nssm set     $ServiceName AppDirectory     "$AppDir"
# nssm set     $ServiceName AppStdout        "$LogDir\tower.out.log"
# nssm set     $ServiceName AppStderr        "$LogDir\tower.err.log"
# nssm set     $ServiceName AppRotateFiles   1
# nssm set     $ServiceName AppRotateBytes   10485760
# nssm set     $ServiceName Start            SERVICE_AUTO_START
# nssm set     $ServiceName AppRestartDelay  5000
# nssm set     $ServiceName AppEnvironmentExtra ("__ENVFILE__=" + $EnvFile)
# Secrets are loaded by the service from $EnvFile (chmod-600-equivalent ACL),
# NEVER embedded in this script or the service config.
#
# Start ONLY when Warwick decides the live gates are cleared:
# nssm start $ServiceName

Write-Host ""
Write-Host "NSSM commands are printed above (commented). Review, then run them"
Write-Host "manually. The service will run '$NodeExe $Entry' from '$AppDir'."
Write-Host ""

# --- Scheduled Task fallback (zero-install) ---------------------------------
# $action  = New-ScheduledTaskAction -Execute $NodeExe -Argument $Entry -WorkingDirectory $AppDir
# $trigger = New-ScheduledTaskTrigger -AtStartup
# $settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
# $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
# Register-ScheduledTask -TaskName $ServiceName -Action $action -Trigger $trigger -Settings $settings -Principal $principal
# NOTE: use -AtStartup (NOT a one-time time trigger) so a machine that was off at
# the scheduled time still starts the Tower on next boot.
