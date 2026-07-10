# start-cockpit.ps1 - myPKA Cockpit launcher (Windows). Generated locally from
# launcher/templates/windows.ps1.txt - review before use.
$ErrorActionPreference = "Stop"

# --- config (the LLM fills these in for THIS machine) ------------------------
$Port = if ($env:PORT) { $env:PORT } else { "4317" }
# $env:MYPKA_ROOT = "C:\absolute\path\to\your\myPKA"   # only for a non-standard layout

# --- 1. resolve the cockpit dir and cd into it -------------------------------
$CockpitDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $CockpitDir

# Resolve the scaffold-root mypka.db the server will open (three levels up in the
# standard layout; honor MYPKA_ROOT for a non-standard one - the server reads it too).
if ($env:MYPKA_ROOT) {
  $DbPath = Join-Path $env:MYPKA_ROOT "mypka.db"
} else {
  $DbPath = Join-Path (Resolve-Path (Join-Path $CockpitDir "..\..")).Path "mypka.db"
}

# --- helper: is Python 3 + PyYAML usable? ------------------------------------
function Test-Python {
  param([string]$Exe)
  try { & $Exe -c "import yaml" 2>$null; return ($LASTEXITCODE -eq 0) } catch { return $false }
}
$Python = $null
foreach ($cand in @("python", "py")) {
  if (-not (Get-Command $cand -ErrorAction SilentlyContinue)) { continue }
  $probe = if ($cand -eq "py") { "py -3" } else { $cand }
  if (Test-Python $cand) { $Python = $probe; break }
  # Python is present but PyYAML is missing. That is a small, per-user pip
  # install - no admin/IT approval needed - so just do it rather than making
  # the user re-run the launcher after installing it themselves.
  Write-Host "Found $cand but the PyYAML package is missing - installing it"
  Write-Host "  (pip install --user pyyaml; no admin rights required)..."
  try { & cmd /c "$probe -m pip install --user --quiet pyyaml" 2>$null | Out-Null } catch { }
  if (Test-Python $cand) { $Python = $probe; break }
}

# --- helper: does mypka.db exist AND carry the core `journal` table? ----------
function Test-DbCore {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return $false }
  if (-not $Python) { return $true }  # can't probe without Python; assume a present file is usable
  $probe = @"
import os, sqlite3, sys
p = sys.argv[1]
if not os.path.isfile(p): sys.exit(1)
try:
    c = sqlite3.connect('file:%s?mode=ro' % p, uri=True)
    sys.exit(0 if c.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='journal'").fetchone() else 1)
except sqlite3.Error:
    sys.exit(1)
"@
  $tmp = [System.IO.Path]::GetTempFileName() + ".py"
  Set-Content -Path $tmp -Value $probe -Encoding ASCII
  try { & cmd /c "$Python `"$tmp`" `"$Path`"" ; return ($LASTEXITCODE -eq 0) }
  finally { Remove-Item $tmp -ErrorAction SilentlyContinue }
}

# --- 2. ensure mypka.db exists (the server REQUIRES it; absence = dead cockpit)
# The server opens mypka.db read-only and HARD-EXITS if it is missing, so the
# launcher must GUARANTEE a DB with the core schema before starting node. Check
# first (fast path: a normal start never rebuilds); only create when missing/coreless.
if (Test-DbCore $DbPath) {
  # FAST PATH - the DB is already here. Refresh from markdown if Python+PyYAML
  # are available (non-destructive); otherwise just serve the existing DB.
  if ($Python) {
    Write-Host "Refreshing mypka.db from your markdown (non-destructive)..."
    try { & cmd /c "$Python `"scripts\regen-mypka-db.py`"" } catch { Write-Host "  (regen failed - using existing mypka.db)" }
  } else {
    Write-Host "Python 3 + PyYAML not found - skipping DB refresh (existing mypka.db will serve)."
    Write-Host "  To enable refreshes: install Python 3, then  pip install --user pyyaml"
  }
} else {
  # FIRST-RUN PATH - no usable DB yet. Build it (core schema + every cockpit
  # module) via the idempotent installer, which auto-bootstraps the base DB.
  Write-Host "No mypka.db yet - creating it (core schema + all cockpit modules)..."
  if (-not $Python) {
    $ScaffoldRoot = Split-Path $DbPath -Parent
    Write-Host ""
    Write-Host "  Cannot create mypka.db: a working Python 3 install (with the PyYAML"
    Write-Host "  package) is required to read your markdown the first time."
    Write-Host ""
    Write-Host "  None of these need admin/IT approval - each installs for your own"
    Write-Host "  user account only:"
    Write-Host "      * winget install --scope user Python.Python.3.12"
    Write-Host "      * or the installer at https://www.python.org/downloads/ -"
    Write-Host "        leave 'Install launcher for all users' UNCHECKED"
    Write-Host "      * or the Microsoft Store 'Python 3.12' app, if Store is allowed"
    Write-Host "  Then:  pip install --user pyyaml"
    Write-Host ""
    Write-Host "  On a locked-down machine where none of that is possible: get the"
    Write-Host "  mypka.db file from another machine where this myPKA has already run"
    Write-Host "  (it's just a derived cache, safe to copy - never committed to git)"
    Write-Host "  and drop it at:"
    Write-Host "      $ScaffoldRoot\mypka.db"
    Write-Host "  The cockpit will then serve it read-only with no Python needed at all."
    Write-Host ""
    Write-Host "  (Once mypka.db exists, future launches do NOT need Python.)"
    Read-Host "Press Enter to close"
    exit 1
  }
  & cmd /c "$Python `"sqlite-extension\install-extensions.py`" `"$DbPath`" --all"
  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "  Could not create mypka.db (see the message above). The cockpit cannot"
    Write-Host "  start without it. Fix the issue, then re-run me."
    Read-Host "Press Enter to close"
    exit 1
  }
}

# --- 2.5 resolve node/npm (system PATH first; portable no-admin fallback) ----
# Same shape as the Python fallback above: if Node.js isn't on PATH at all
# (common on locked-down machines), offer a fully local, no-installer, no-admin
# portable Node.js instead of just failing. Nothing touches PATH, the registry,
# or Program Files; deleting the folder removes it completely.
function Get-PortableNode {
  $embedRoot = Join-Path $CockpitDir ".node-portable"
  $existing = Get-ChildItem -Path $embedRoot -Filter "node.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($existing) { return $existing.DirectoryName }

  Write-Host ""
  Write-Host "Node.js was not found on this machine, and you may not have admin rights"
  Write-Host "to install it system-wide. I can download the official portable"
  Write-Host "(no-installer) Node.js build into this folder only:"
  Write-Host "  $embedRoot"
  Write-Host "Nothing is installed system-wide, no admin rights are needed, and you"
  Write-Host "can delete that folder any time to remove it completely."
  $answer = Read-Host "Download and set this up now? (y/n)"
  if ($answer -notmatch '^(y|yes)$') { return $null }

  $nodeVersion = "20.18.1"
  $zipUrl = "https://nodejs.org/dist/v$nodeVersion/node-v$nodeVersion-win-x64.zip"
  $zipPath = Join-Path $env:TEMP "node-portable-$nodeVersion.zip"
  try {
    Write-Host "Downloading Node.js v$nodeVersion (portable, about 30MB)..."
    Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing
    New-Item -ItemType Directory -Force -Path $embedRoot | Out-Null
    Expand-Archive -Path $zipPath -DestinationPath $embedRoot -Force
    Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
    $found = Get-ChildItem -Path $embedRoot -Filter "node.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) {
      Write-Host "Portable Node.js ready at $($found.DirectoryName) (no admin rights used)."
      return $found.DirectoryName
    }
  } catch {
    Write-Host "Could not set up portable Node.js automatically: $($_.Exception.Message)"
  }
  return $null
}

$NodeDir = $null
if (-not (Get-Command node -ErrorAction SilentlyContinue) -or -not (Get-Command npm -ErrorAction SilentlyContinue)) {
  $NodeDir = Get-PortableNode
  if (-not $NodeDir) {
    Write-Host ""
    Write-Host "  Cannot continue: Node.js v20+ is required to run the Cockpit."
    Write-Host ""
    Write-Host "  None of these need admin/IT approval - each installs for your own"
    Write-Host "  user account only, or needs no install at all:"
    Write-Host "      * winget install --scope user OpenJS.NodeJS.LTS"
    Write-Host "      * or the no-install 'Windows Binary (.zip)' at"
    Write-Host "        https://nodejs.org/en/download - unzip it anywhere, then"
    Write-Host "        re-run me and answer 'y' when I offer to use a portable Node"
    Write-Host ""
    Read-Host "Press Enter to close"
    exit 1
  }
}
$Node = if ($NodeDir) { Join-Path $NodeDir "node.exe" } else { "node" }
$Npm  = if ($NodeDir) { Join-Path $NodeDir "npm.cmd" } else { "npm" }
if ($NodeDir) {
  # Prepend to THIS PROCESS's PATH only - nothing persists after this window
  # closes, no user/system PATH or registry touched. Needed because npm
  # spawns subprocesses (node-gyp/prebuild-install for native modules, esbuild's
  # install script, tsc, vite) that look up a bare "node" on PATH themselves;
  # pointing $Node/$Npm at the portable exe directly isn't enough for those.
  $env:PATH = "$NodeDir;$env:PATH"
}

# --- 3. first-run install + build (skipped on later launches) ----------------
# Check for a definite marker of a COMPLETE install/build, not just folder
# existence - an install that failed partway (e.g. a native module build
# error) still leaves the folder behind, which would otherwise make every
# future launch silently skip re-running it forever.
if (-not (Test-Path "node_modules\express\package.json")) {
  Write-Host "Installing server deps..."
  & "$Npm" install --no-audit --no-fund
}
if (-not (Test-Path "web\node_modules\.bin\tsc.cmd")) {
  Write-Host "Installing web deps..."
  & "$Npm" --prefix web install --no-audit --no-fund
}
if (-not (Test-Path "web\dist\index.html")) {
  Write-Host "Building the web app..."
  & "$Npm" --prefix web run build
}

# --- 4. free the port (NO lsof on Windows) -----------------------------------
# Preferred: Get-NetTCPConnection (Win8+/Server2012+). Fallback: parse netstat.
try {
  $owners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop |
            Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($procId in $owners) {
    Write-Host "Port $Port busy - stopping PID $procId..."
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
  }
} catch {
  $lines = netstat -ano | Select-String ":$Port\s.*LISTENING"
  foreach ($line in $lines) {
    $procId = ($line -split "\s+")[-1]
    if ($procId -match '^\d+$') {
      Write-Host "Port $Port busy - stopping PID $procId..."
      taskkill /PID $procId /F 2>$null | Out-Null
    }
  }
}
Start-Sleep -Seconds 1

# --- 5. open the browser (SPA retries until the API is up) -------------------
Start-Process "http://127.0.0.1:$Port/"

# --- 6. start the server, loopback-only, with the launcher defaults ----------
# NODE_ENV=production keeps Express from serving its default HTML stack trace on
# an unhandled error (which would leak absolute server paths); paired with the
# JSON error handler in server.js.
Write-Host "Starting the cockpit on http://127.0.0.1:$Port/  (close this window to stop it)"
$env:NODE_ENV = "production"
$env:PORT = $Port
$env:WORKBENCH_WRITE_ENABLED = "1"
$env:PLAN_WRITE_ENABLED = "1"
& "$Node" server\server.js
