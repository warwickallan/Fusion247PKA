# convergence-runtime-check.ps1
#
# Proves ONE property, and states its own limit:
#
#   No live process of any executable type has its executable, command line, or loaded
#   module path rooted in a SUPERSEDED MyPKA branch / worktree / checkout.
#
# BUILD-020 Sub-phase 4C. Written after Veritas proved the previous check narrower than its
# claim: it enumerated node.exe only and read command lines only, and so missed a stranded
# Proofline test-harness tree alive inside the candidate worktree since 2026-08-04.
#
# SCOPE, stated rather than implied:
#   CHECKED     - ExecutablePath, CommandLine and every loaded module path, for EVERY process,
#                 matching both \ and / path separators.
#   NOT CHECKED - the process working directory. Win32_Process does not expose it and obtaining
#                 it needs handle enumeration this estate does not carry. A process whose cwd is
#                 a superseded checkout, but whose exe, command line and modules are all canonical,
#                 would NOT be caught. That is a real gap, recorded, not argued away.
#
# Read-only. Kills nothing. exit 0 = PASS, exit 1 = FAIL.

$ErrorActionPreference = 'SilentlyContinue'

$CANON  = 'c:\fusion247pka'
$ACTIVE = 'c:\fusion247pka-build-020-trial'   # the ONE active working state, retired at 4C close

# Any MyPKA checkout root mentioned in a path, either separator.
$rx = [regex]'(?i)(c:[\\/]fusion247pka[a-z0-9._-]*)|(c:[\\/]fable-external-repair)|(c:[\\/]audit-worktrees)|(\.claude[\\/]worktrees[\\/][a-z0-9-]+)'

$superseded = @{}   # LIVE superseded root -> processes consuming it
$deadRefs   = @{}   # superseded root that no longer exists on disk -> processes merely naming it
$canonHits = 0; $activeHits = 0; $procs = 0

foreach ($p in Get-CimInstance Win32_Process) {
    $procs++
    $paths = New-Object System.Collections.ArrayList
    [void]$paths.Add($p.ExecutablePath)
    [void]$paths.Add($p.CommandLine)
    foreach ($m in (Get-Process -Id $p.ProcessId).Modules) { [void]$paths.Add($m.FileName) }

    foreach ($val in $paths) {
        if ([string]::IsNullOrWhiteSpace($val)) { continue }
        foreach ($m in $rx.Matches($val)) {
            $root = $m.Value.Replace('/', '\').ToLower().TrimEnd('\')
            if ($root -eq $CANON)       { $canonHits++;  continue }
            if ($root -eq $ACTIVE)      { $activeHits++; continue }
            # A root that no longer exists on disk cannot be CONSUMED - it is a dead reference
            # (a stale launch argument), not a live dependency. Both are reported; only the
            # live kind fails the check.
            if (-not (Test-Path -LiteralPath $root)) {
                if (-not $deadRefs.ContainsKey($root)) { $deadRefs[$root] = New-Object System.Collections.ArrayList }
                $de = "PID $($p.ProcessId) $($p.Name)"
                if ($deadRefs[$root] -notcontains $de) { [void]$deadRefs[$root].Add($de) }
                continue
            }
            if (-not $superseded.ContainsKey($root)) { $superseded[$root] = New-Object System.Collections.ArrayList }
            $entry = "PID $($p.ProcessId) $($p.Name)"
            if ($superseded[$root] -notcontains $entry) { [void]$superseded[$root].Add($entry) }
        }
    }
}

$supCount = 0
foreach ($k in $superseded.Keys) { $supCount += $superseded[$k].Count }

Write-Output "processes examined      : $procs"
Write-Output "canonical refs          : $canonHits   ($CANON)"
Write-Output "active-candidate refs   : $activeHits   ($ACTIVE - legitimate until 4C merges)"
Write-Output "SUPERSEDED-ROOT refs    : $supCount   (MUST BE ZERO)"
foreach ($k in $superseded.Keys) {
    Write-Output "    $k"
    foreach ($e in $superseded[$k]) { Write-Output "        $e" }
}
foreach ($k in $deadRefs.Keys) {
    Write-Output "    DEAD REFERENCE (path absent from disk, cannot be consumed): $k"
    foreach ($e in $deadRefs[$k]) { Write-Output "        $e" }
}
Write-Output ""
if ($supCount -eq 0) {
    Write-Output "RESULT: PASS - zero LIVE DEPENDENCIES on the superseded checkout roots ENUMERATED in this"
    Write-Output "        script's pattern, across executable path, command line and loaded-module paths."
    Write-Output "        The claim is bounded to those roots. A superseded root NOT matching the pattern"
    Write-Output "        would not be seen - widen the pattern before widening this sentence."
} else {
    Write-Output "RESULT: FAIL - $supCount live reference(s) to superseded roots."
}
Write-Output "LIMIT : process working directory NOT checked (not exposed by Win32_Process)."
if ($supCount -eq 0) { exit 0 } else { exit 1 }
