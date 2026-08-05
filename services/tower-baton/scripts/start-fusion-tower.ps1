# start-fusion-tower.ps1 -- RETIRED 2026-08-05. THIS LAUNCHER REFUSES TO START.
#
# Warwick, BUILD-020 proofline map 14.13 D-A (WO-2026-08-05-03): make the legacy start path
# refuse clearly rather than deleting the protected source tree.
#
# Guarded in BOTH places on purpose. The original header below says that invoking
# `node bin/tower-watch.js` is "equivalently" the same route through the same runtimeConfig
# module -- so a guard only here would have left that route wide open. bin/tower-watch.js
# carries the load-bearing guard; this one closes the documented launcher.
#
# THIS FILE IS PURE ASCII, AND MUST STAY THAT WAY. As committed before 2026-08-05 it carried
# UTF-8 em-dashes with no BOM, which Windows PowerShell 5.1 -- the host `powershell -File ...`
# actually launches -- decodes as ANSI/OEM, producing "The string is missing the terminator"
# at PARSE time. That is a refusal by crash, not a clear refusal, and it happens before any
# guard can run. Re-introduce a non-ASCII byte here and the retirement notice below becomes
# unreachable on the documented host. (pwsh 7 reads UTF-8 and was never affected -- which is
# why the launcher really was a live start path.)
#
# Use instead:  node services\control-plane\tower-loop\run-watcher.mjs
# Revive by deleting the RETIREMENT GUARD block below. The pre-retirement file is
#   git show ec98ca4a43d433f781d8cbf68b160d88fd5ad309:services/tower-baton/scripts/start-fusion-tower.ps1
#
# -- the original header, kept for the record ----------------------------------
# The CANONICAL Tower baton launcher.
#
# Claude Code, Codex, foreground testing, and the Scheduled Task ALL invoke THIS
# launcher (or, equivalently, `node bin/tower-watch.js`, which uses the SAME
# runtimeConfig module). There is no separate startup method.
#
# It:
#   1. locates the protected secret store C:\.fusion247 (FUSION247_HOME override);
#   2. runs the node pre-flight (bin/preflight.js) which loads + validates config via
#      the single runtimeConfig module -- MASKED, never printing a value -- and (with
#      -Telegram) runs a masked getMe outbound self-test on FusionDevBot;
#   3. fails closed when config is incomplete (a genuine Telegram blocker is sent by
#      the watcher/pre-flight when Telegram itself is configured);
#   4. starts the watcher, which acquires the single-watcher lock (a duplicate
#      instance is refused), writes bounded ROTATING logs OUTSIDE the repo
#      (C:\.fusion247\logs\tower-baton\), and emits the startup milestone via TOWER'S
#      OWN notifier ("[TOWER] ClickUp baton watcher online" / "... recovered ...").
#
# SECRETS ARE NEVER ON THIS COMMAND LINE. The node process loads them itself from the
# store. Nothing here echoes a value.
#
# Usage:
#   .\start-fusion-tower.ps1 -TaskId <clickupTaskId> [-RepoDir <path>] [-Telegram] [-PollMs 30000]

[CmdletBinding()]
param(
  [string]$TaskId = $env:TOWER_CLICKUP_TASK_ID,
  [string]$RepoDir = "",
  [switch]$Telegram,
  [int]$PollMs = 30000,
  [string]$FusionHome = $(if ($env:FUSION247_HOME) { $env:FUSION247_HOME } else { "C:\.fusion247" })
)

# -- THE RETIREMENT GUARD -- the first statement this script executes -----------
# It sits immediately after param() because PowerShell requires param() to be the first
# statement in a script; the param block only binds defaults (env reads) and starts nothing.
# Everything below the guard is the retired launcher, preserved and unreachable.
$RetiredExitCode = 78   # matches bin/tower-watch.js, and is deliberately distinct from the
                        # launcher's historic exit 1 (fail-closed) so an attempt-proof cannot
                        # mistake a config failure for a refusal.
Write-Host "[TOWER-BATON RETIRED] This BUILD-010 legacy launcher is retired and will NOT start a watcher."
Write-Host "[TOWER-BATON RETIRED] Retired by Warwick, 2026-08-05 - BUILD-020 proofline map 14.13 D-A (WO-2026-08-05-03)."
Write-Host "[TOWER-BATON RETIRED] Use instead: node services\control-plane\tower-loop\run-watcher.mjs"
Write-Host "[TOWER-BATON RETIRED] Nothing was started: no pre-flight run, no secret store read, no watcher spawned."
Write-Host "[TOWER-BATON RETIRED] Exiting $RetiredExitCode."
exit $RetiredExitCode

# -- everything below is the retired launcher, preserved and unreachable -------

$ErrorActionPreference = "Stop"
$ServiceDir = Split-Path -Parent $PSScriptRoot           # services/tower-baton
$LogDir = Join-Path $FusionHome "logs\tower-baton"

Write-Host "[TOWER launcher] secret store: $FusionHome"

# 1. Store must exist.
if (-not (Test-Path -LiteralPath $FusionHome -PathType Container)) {
  Write-Error "[TOWER launcher] FAIL-CLOSED: secret store not found at $FusionHome"
  exit 1
}
if (-not $TaskId) {
  Write-Error "[TOWER launcher] FAIL-CLOSED: -TaskId (or TOWER_CLICKUP_TASK_ID) is required"
  exit 1
}

# Resolve node.
$node = (Get-Command node -ErrorAction SilentlyContinue)
if (-not $node) { Write-Error "[TOWER launcher] FAIL-CLOSED: node not found on PATH"; exit 1 }

# 2. Pre-flight (masked). The node side reads secrets via runtimeConfig; we pass NO value.
$env:FUSION247_HOME = $FusionHome
$preflightArgs = @((Join-Path $ServiceDir "bin\preflight.js"))
if ($Telegram) { $preflightArgs += "--telegram" }
Write-Host "[TOWER launcher] running masked pre-flight..."
& node @preflightArgs
if ($LASTEXITCODE -ne 0) {
  Write-Error "[TOWER launcher] FAIL-CLOSED: pre-flight failed (config incomplete). See masked output above."
  exit $LASTEXITCODE
}

# 3. Prevent an obvious duplicate before we even spawn (the watcher lock is the
#    authoritative guard; this is a friendly early check).
$lockPath = Join-Path $FusionHome "tower-baton.lock"
if (Test-Path -LiteralPath $lockPath) {
  Write-Warning "[TOWER launcher] a lock file exists at $lockPath -- the watcher will reclaim it only if stale; a live watcher already running will be left alone."
}

# 4. Start the watcher. Secrets are loaded by the watcher itself (runtimeConfig).
$env:TOWER_CLICKUP_TASK_ID = $TaskId
if ($RepoDir) { $env:TOWER_REPO_DIR = $RepoDir }
$env:TOWER_POLL_MS = "$PollMs"

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
Write-Host "[TOWER launcher] starting watcher (task $TaskId). Bounded rotating logs at $LogDir. Ctrl+C to stop."
& node (Join-Path $ServiceDir "bin\tower-watch.js")
exit $LASTEXITCODE
