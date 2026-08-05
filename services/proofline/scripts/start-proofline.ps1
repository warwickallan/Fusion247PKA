# start-proofline.ps1 - the SECONDARY, PowerShell-only launcher.
#
# THE PRIMARY LAUNCHER IS ..\start-proofline.cmd. Use that one unless you have
# a specific reason not to. It works from Command Prompt AND PowerShell, from
# any folder, and it does not involve PowerShell at all.
#
# THIS FILE WILL NOT RUN FROM COMMAND PROMPT. ".PS1" is not in PATHEXT, so
# cmd.exe hands it to the shell file-association handler and you get the
# "Select an app to open this .ps1 file" dialog instead of a server.
#
# THIS FILE MUST STAY PURE ASCII, AND IT MUST KEEP ITS UTF-8 BOM.
# Windows PowerShell 5.1 reads an unmarked .ps1 as ANSI (the system codepage),
# not UTF-8. A single em-dash on line 96 of an earlier version decoded to a
# curly closing quote, PowerShell took that as a string terminator, and the
# whole script failed to parse with "The string is missing the terminator".
# The BOM makes the encoding explicit; staying ASCII means it cannot recur
# even if the BOM is ever stripped. Belt and braces, deliberately.
#
# This launcher and `node bin/proofline.mjs` are the SAME startup path: the
# launcher only resolves node, validates the environment and invokes the
# entrypoint.
#
# There are NO secrets here and none anywhere in Proofline. It has no external
# dependency to authenticate to, it binds 127.0.0.1 only, and it makes no
# outbound request.
#
# Usage:
#   .\start-proofline.ps1                    # foreground, port 7317
#   .\start-proofline.ps1 -Port 7400         # foreground, another port
#   .\start-proofline.ps1 -Detached          # background, logs to a file
#   .\start-proofline.ps1 -OpenBrowser       # also open the page (opt-in)
#
# STOPPING IT IS ABRUPT, AND THAT IS SAFE BY DESIGN. See RUNBOOK.md.

[CmdletBinding()]
param(
  [int]$Port = $(if ($env:PROOFLINE_PORT) { [int]$env:PROOFLINE_PORT } else { 7317 }),
  [string]$DataDir = "",
  [switch]$Detached,
  [switch]$OpenBrowser
)

$ErrorActionPreference = "Stop"

$ServiceDir = Split-Path -Parent $PSScriptRoot      # services/proofline
$Entry      = Join-Path $ServiceDir "bin\proofline.mjs"

Write-Host "[proofline] service dir : $ServiceDir"

# --- 1. node must be present and new enough -------------------------------
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Error "[proofline] FAIL-CLOSED: node was not found on PATH. Proofline needs Node 22 or newer."
  exit 1
}

$nodeVersion = (& node --version).Trim()
$major = [int]($nodeVersion.TrimStart('v').Split('.')[0])
if ($major -lt 22) {
  Write-Error "[proofline] FAIL-CLOSED: Node $nodeVersion is too old. Proofline needs Node 22 or newer."
  exit 1
}
Write-Host "[proofline] node        : $nodeVersion"

# --- 2. the entrypoint must exist ------------------------------------------
if (-not (Test-Path -LiteralPath $Entry -PathType Leaf)) {
  Write-Error "[proofline] FAIL-CLOSED: entrypoint not found at $Entry"
  exit 1
}

# --- 3. environment ---------------------------------------------------------
$env:PROOFLINE_PORT = "$Port"
if ($DataDir -ne "") { $env:PROOFLINE_DATA_DIR = $DataDir }

$resolvedData = if ($DataDir -ne "") { $DataDir } else { Join-Path $ServiceDir ".data" }
Write-Host "[proofline] data dir    : $resolvedData"
Write-Host "[proofline] url         : http://127.0.0.1:$Port/  (loopback only)"

# --- 4. start ---------------------------------------------------------------
if ($Detached) {
  $logDir = Join-Path $ServiceDir ".data"
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  $log = Join-Path $logDir "proofline.log"
  Write-Host "[proofline] detached, logging to: $log"

  $proc = Start-Process -FilePath $node.Source `
                        -ArgumentList @($Entry) `
                        -WorkingDirectory $ServiceDir `
                        -RedirectStandardOutput $log `
                        -RedirectStandardError "$log.err" `
                        -WindowStyle Hidden `
                        -PassThru

  Start-Sleep -Milliseconds 900
  if ($proc.HasExited) {
    Write-Error "[proofline] the service exited immediately. Read $log and $log.err"
    exit 1
  }

  Write-Host "[proofline] started, PID $($proc.Id)"
  Write-Host "[proofline] stop it with: Stop-Process -Id $($proc.Id)"
  if ($OpenBrowser) { Start-Process "http://127.0.0.1:$Port/" }
  exit 0
}

if ($OpenBrowser) {
  Start-Job -ScriptBlock {
    param($u) Start-Sleep -Milliseconds 900; Start-Process $u
  } -ArgumentList "http://127.0.0.1:$Port/" | Out-Null
}

Write-Host "[proofline] starting in the foreground - Ctrl+C stops it"
& node $Entry
exit $LASTEXITCODE
