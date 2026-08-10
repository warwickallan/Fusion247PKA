# services/asdair/cockpit-api/install-readservice-task.ps1
#
# Run:  powershell -NoProfile -ExecutionPolicy Bypass -File install-readservice-task.ps1
# Idempotent: unregisters any existing task of the same name first.
#
# Register the AsdAIr read service (cockpit-api/server.js, port 8710) as a logon
# task, mirroring MyPKA-AsdAIr-Runtime exactly.
#
# Why: the service was started by hand and was registered nowhere, so it did not
# survive a reboot. It now serves GET /asdair/checklist - the only surface from
# which Warwick can read the list he shops from - so "started by hand" is not an
# acceptable state for it.
$ErrorActionPreference = 'Stop'

$name = 'MyPKA-AsdAIr-ReadService'
$node = 'C:\Program Files\nodejs\node.exe'
$args = '--env-file="C:\.fusion247\.env keys\shopper.env.txt" --env-file="C:\.fusion247\asdair.env" "C:\Fusion247PKA\services\asdair\cockpit-api\server.js"'
$wd   = 'C:\Fusion247PKA\services\asdair\cockpit-api'

$existing = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
if ($existing) {
  Unregister-ScheduledTask -TaskName $name -Confirm:$false
  Write-Output "removed existing task"
}

$action    = New-ScheduledTaskAction -Execute $node -Argument $args -WorkingDirectory $wd
$trigger   = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERNAME"
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERNAME" -LogonType Interactive -RunLevel Limited
$settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Principal $principal -Settings $settings | Out-Null
Write-Output "registered $name"
