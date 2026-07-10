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

# --- 3. first-run install + build (skipped on later launches) ----------------
if (-not (Test-Path "node_modules"))     { Write-Host "Installing server deps..."; npm install --no-audit --no-fund }
if (-not (Test-Path "web\node_modules")) { Write-Host "Installing web deps...";    npm --prefix web install --no-audit --no-fund }
if (-not (Test-Path "web\dist"))         { Write-Host "Building the web app...";   npm --prefix web run build }

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
node server\server.js
