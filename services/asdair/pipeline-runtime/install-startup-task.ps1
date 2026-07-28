<#
.SYNOPSIS
  BUILD-015 AsdAIr Stage 1 - register (or remove) the Windows logon task that
  recovers the single AsdAIr runtime after a reboot.

.DESCRIPTION
  Mirrors MyPKA-Directus-Live, which is the pattern already proven to survive
  reboots on this machine: a LOGON trigger with a short delay, running the
  user's own launcher under the interactive token, with MultipleInstances set to
  IgnoreNew so the Scheduler itself will never start a second one.

  WHAT THIS TASK CAN DO, AND WHAT IT CANNOT.
  The action is exactly one thing: `node --env-file=<env> ensure-asdair-runtime.mjs`.
  That launcher starts the deterministic pipeline runtime and nothing else. It
  cannot check out, cannot pay, cannot book a delivery slot and cannot enter a
  password - there is no code path from here to any of those. It is also gated:
  the launcher refuses to start a live poller until it has been armed once with
  `--arm`, so registering this task does not, by itself, cause anything to be
  consumed.

  IDEMPOTENT. Re-running replaces the registration with the same definition.
  Nothing here reads, prints or inspects the credentials file - only its PATH is
  passed to node, which consumes it via --env-file.

.PARAMETER Action
  install (default) | uninstall | status

.PARAMETER Mode
  live (default) | selftest. `selftest` registers the same task shape but points
  the launcher at its no-Telegram stand-in entry - used to prove the
  Scheduler -> node -> launcher -> detached child chain without consuming updates.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\install-startup-task.ps1 -Action install
  powershell -ExecutionPolicy Bypass -File .\install-startup-task.ps1 -Action status
  powershell -ExecutionPolicy Bypass -File .\install-startup-task.ps1 -Action uninstall
#>
[CmdletBinding()]
param(
  [ValidateSet('install', 'uninstall', 'status')]
  [string]$Action = 'install',

  [ValidateSet('live', 'selftest')]
  [string]$Mode = 'live',

  [string]$TaskName = 'MyPKA-AsdAIr-Runtime',

  # Credentials are passed to node BY PATH and consumed with --env-file. This
  # script never opens them. On this machine the runtime needs TWO: the
  # ShopperBot token lives in the '.env keys' file and the database URLs live in
  # asdair.env, and node accepts --env-file more than once.
  [string[]]$EnvFiles = @('C:\.fusion247\.env keys\shopper.env.txt', 'C:\.fusion247\asdair.env'),

  [string]$NodeExe = '',

  [string]$LauncherPath = '',

  # Register but leave the task DISABLED. Used when the launcher path is not yet
  # the one that will exist at logon (e.g. before a branch is merged), so the
  # registration is in place and provable without a half-built runtime firing.
  [switch]$Disabled
)

$ErrorActionPreference = 'Stop'

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($LauncherPath)) {
  $LauncherPath = Join-Path $here 'ensure-asdair-runtime.mjs'
}
if ([string]::IsNullOrWhiteSpace($NodeExe)) {
  $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
  $NodeExe = if ($cmd) { $cmd.Source } else { 'C:\Program Files\nodejs\node.exe' }
}

function Show-Task {
  param([string]$Name)
  $t = Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue
  if (-not $t) {
    [pscustomobject]@{ registered = $false; task = $Name } | ConvertTo-Json -Depth 5
    return
  }
  $info = Get-ScheduledTaskInfo -TaskName $Name
  [pscustomobject]@{
    registered         = $true
    task               = $t.TaskName
    path               = $t.TaskPath
    state              = "$($t.State)"
    execute            = $t.Actions[0].Execute
    arguments          = $t.Actions[0].Arguments
    workingDirectory   = $t.Actions[0].WorkingDirectory
    trigger            = $t.Triggers[0].CimClass.CimClassName
    triggerDelay       = $t.Triggers[0].Delay
    principal          = "$($t.Principal.UserId) / $($t.Principal.LogonType) / $($t.Principal.RunLevel)"
    multipleInstances  = "$($t.Settings.MultipleInstances)"
    executionTimeLimit = "$($t.Settings.ExecutionTimeLimit)"
    restartCount       = $t.Settings.RestartCount
    lastRunTime        = $info.LastRunTime
    lastTaskResult     = ('0x{0:X}' -f $info.LastTaskResult)
    nextRunTime        = $info.NextRunTime
  } | ConvertTo-Json -Depth 5
}

switch ($Action) {

  'status' {
    Show-Task -Name $TaskName
    break
  }

  'uninstall' {
    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
      Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
      Write-Output "[asdair-task] removed $TaskName"
    }
    else {
      Write-Output "[asdair-task] $TaskName was not registered - nothing to remove"
    }
    break
  }

  'install' {
    if (-not (Test-Path $NodeExe)) { throw "node.exe not found at $NodeExe" }
    if (-not (Test-Path $LauncherPath)) { throw "launcher not found at $LauncherPath" }
    foreach ($f in $EnvFiles) {
      if (-not (Test-Path $f)) { throw "env file not found at $f (its PATH only - this script never opens it)" }
    }

    $modeArg = if ($Mode -eq 'selftest') { ' --selftest' } else { '' }
    # --env-file must precede the script: it is a node option, not a script arg.
    $envArgs = ($EnvFiles | ForEach-Object { "--env-file=`"$_`"" }) -join ' '
    $arguments = "$envArgs `"$LauncherPath`"$modeArg"

    # The working directory follows the LAUNCHER, not this script - they differ
    # whenever the task is being registered for a checkout other than this one.
    $workDir = Split-Path -Parent $LauncherPath
    $taskAction = New-ScheduledTaskAction -Execute $NodeExe -Argument $arguments -WorkingDirectory $workDir

    # LOGON, not BOOT: the runtime runs under Warwick's interactive token, the
    # same as MyPKA-Directus-Live, so it sees the same user profile and the same
    # local state directory. The 30s delay lets networking settle first.
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
    $trigger.Delay = 'PT30S'

    $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" `
      -LogonType Interactive -RunLevel Limited

    # IgnoreNew is the Scheduler's half of the single-poller rule. The launcher's
    # lock is the real guarantee; this simply stops the Scheduler contributing.
    $settings = New-ScheduledTaskSettingsSet `
      -MultipleInstances IgnoreNew `
      -ExecutionTimeLimit (New-TimeSpan -Minutes 15) `
      -RestartCount 2 -RestartInterval (New-TimeSpan -Minutes 2) `
      -StartWhenAvailable `
      -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
      -DontStopOnIdleEnd

    $description = @"
BUILD-015 AsdAIr Stage 1: at Warwick logon, run ensure-asdair-runtime.mjs so the
single supervised AsdAIr runtime auto-recovers after a reboot.

Starts the deterministic pipeline runtime ONLY (mode: $Mode). It takes an
exclusive single-poller lock and refuses to start a second Telegram consumer.
It cannot check out, pay, book a slot, or enter a password. The live poller
additionally refuses to start until armed once with --arm.
"@

    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
      Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    }
    Register-ScheduledTask -TaskName $TaskName -Action $taskAction -Trigger $trigger `
      -Principal $principal -Settings $settings -Description $description | Out-Null

    if ($Disabled) {
      Disable-ScheduledTask -TaskName $TaskName | Out-Null
      Write-Output "[asdair-task] registered $TaskName (mode: $Mode) and left DISABLED - enable it with: Enable-ScheduledTask -TaskName $TaskName"
    }
    else {
      Write-Output "[asdair-task] registered $TaskName (mode: $Mode)"
    }
    Show-Task -Name $TaskName
    break
  }
}
