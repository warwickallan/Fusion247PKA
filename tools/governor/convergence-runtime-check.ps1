# convergence-runtime-check.ps1
#
# POSITIVE RUNTIME PROVENANCE. Replaces the earlier negative check.
#
#   Every live Fusion247 runtime must be IDENTIFIABLE, its actual code source must be KNOWN,
#   and that source must be either canonical `main` or an installed/derived runtime
#   DEMONSTRABLY PRODUCED FROM canonical `main`.
#
# WHY THIS CHANGED (BUILD-020 4C, 2026-08-08). The previous check asked the negative question
# "does any process reference one of these known-superseded roots?" and passed when none did.
# `~/.mypka/tower-runtime/` escaped it — not because the check malfunctioned, but because a
# blacklist can only catch what someone already thought to list. Tower was running PRE-MERGE
# installed bytes, including a stale ratified reviewer contract, and the check said PASS.
#
# The invariant is now inverted: an UNRECOGNISED runtime root is a FAILURE, not a pass. A future
# reader does not need to know tonight's history to find a hidden runtime copy — the check makes
# the estate declare every runtime it is actually operating.
#
# CLASSIFICATION (in order):
#   CANONICAL        the repository working folder itself.
#   PRIVATE-RUNTIME  C:\.fusion247\** — the approved private/runtime home (GL-012). Out of repo
#                    scope by design; reported, never silently ignored.
#   DERIVED-CURRENT  an installed copy whose tracked source files are byte-identical to canonical
#                    main. PROVEN by comparison, not by a marker file or a plausible name.
#   DERIVED-STALE    an installed copy that differs from canonical main. FAILS. This is the case
#                    that escaped the old check.
#   UNKNOWN          a live runtime whose code root cannot be placed. FAILS.
#
# SCOPE LIMIT, stated rather than implied: process working directory is not available from
# Win32_Process, so a runtime whose only link to a stale tree is its cwd is not observed here.
#
# Read-only. Kills nothing. exit 0 = PASS, exit 1 = FAIL.

$ErrorActionPreference = 'SilentlyContinue'
$CANON = 'C:\Fusion247PKA'

function Resolve-CodeRoot([string]$cmdline) {
    # the first absolute path in the command line that names a real file is the entry script
    foreach ($m in [regex]::Matches($cmdline, '[A-Za-z]:[\\/][^"'']+?\.(mjs|js|cjs)')) {
        $p = $m.Value.Replace('/', '\')
        if (Test-Path -LiteralPath $p -PathType Leaf) { return $p }
    }
    # RELATIVE entry script (the process was launched from its own working directory, which
    # Win32_Process does not expose). Resolve it against the known runtime homes rather than
    # declaring it unplaceable — a relative path is still a real, findable file.
    foreach ($m in [regex]::Matches($cmdline, '(?<![\w:\\/.])((?:[\w.-]+[\\/])*[\w.-]+\.(?:mjs|js|cjs))')) {
        $rel = $m.Groups[1].Value.Replace('/', '\')
        foreach ($base in @('C:\Fusion247PKA', 'C:\.fusion247\private\careerair', 'C:\.fusion247')) {
            $cand = Join-Path $base $rel
            if (Test-Path -LiteralPath $cand -PathType Leaf) { return $cand }
        }
        foreach ($d in (Get-ChildItem -LiteralPath 'C:\.fusion247\private' -Directory -ErrorAction SilentlyContinue)) {
            $cand = Join-Path $d.FullName $rel
            if (Test-Path -LiteralPath $cand -PathType Leaf) { return $cand }
        }
    }
    return $null
}

function Get-RuntimeRoot([string]$entry) {
    # Walk up to the RUNTIME ROOT: the first ancestor that is a git repository (.git), or that
    # contains a 'services' subtree. .git wins because a checkout's root is its own provenance
    # anchor — this is what places a runtime living in a subdirectory of another repository
    # (e.g. <repo>\apps\<app>), which an earlier version misread as an unplaceable install.
    $d = Split-Path -Parent $entry
    while ($d) {
        if (Test-Path -LiteralPath (Join-Path $d '.git')) { return $d }
        if (Test-Path -LiteralPath (Join-Path $d 'services') -PathType Container) { return $d }
        $parent = Split-Path -Parent $d
        if (-not $parent -or $parent -eq $d) { break }
        $d = $parent
    }
    return (Split-Path -Parent $entry)
}

function Test-DerivedFromMain([string]$root) {
    # PROVE derivation: every tracked source file present in the install must be byte-identical
    # to canonical main. node_modules and .git are excluded (dependency/VCS state, not source).
    $mismatch = @()
    $checked = 0
    $svc = Join-Path $root 'services'
    if (-not (Test-Path -LiteralPath $svc)) { return @{ ok = $false; checked = 0; mismatch = @('no services/ subtree') } }
    Get-ChildItem -LiteralPath $svc -Recurse -File -Include *.mjs,*.js,*.cjs,*.md,*.sql,*.json |
        Where-Object { $_.FullName -notmatch '\\node_modules\\' -and $_.FullName -notmatch '\\\.git\\' -and
                       $_.FullName -notmatch '\\\.runtime-live\\' -and $_.FullName -notmatch '\\\.logs?\\' -and
                       $_.Extension -ne '.log' } |
        ForEach-Object {
            $rel = $_.FullName.Substring($root.Length).TrimStart('\')
            $canonFile = Join-Path $CANON $rel
            if (Test-Path -LiteralPath $canonFile -PathType Leaf) {
                $checked++
                $a = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
                $b = (Get-FileHash -LiteralPath $canonFile -Algorithm SHA256).Hash
                if ($a -ne $b) { $mismatch += $rel }
            }
        }
    return @{ ok = ($mismatch.Count -eq 0 -and $checked -gt 0); checked = $checked; mismatch = $mismatch }
}

$rows = @()
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ForEach-Object {
    $p = $_
    $cl = [string]$p.CommandLine
    if ($cl -notmatch '(?i)fusion247|\.mypka|asdair|careerair|cockpit|obsidiwikai') { return }
    $entry = Resolve-CodeRoot $cl
    if (-not $entry) {
        if ($cl -match '(?i)C:[\/]\.fusion247') {
            $rows += [pscustomobject]@{ PID=$p.ProcessId; Root='C:\.fusion247 (relative entry)'; Class='PRIVATE-RUNTIME'; Detail='approved private/runtime home (GL-012); entry script is relative to its own cwd' }
        } else {
            $rows += [pscustomobject]@{ PID=$p.ProcessId; Root='(entry script not resolvable)'; Class='UNKNOWN'; Detail=$cl.Substring(0,[Math]::Min(70,$cl.Length)) }
        }
        return
    }
    $root = Get-RuntimeRoot $entry
    $cls = $null; $detail = ''
    if ($root -ieq $CANON) { $cls = 'CANONICAL'; $detail = 'repository working folder' }
    elseif ($root -like 'C:\.fusion247*' -or $entry -like 'C:\.fusion247*') { $cls = 'PRIVATE-RUNTIME'; $detail = 'approved private/runtime home (GL-012)' }
    elseif (Test-Path -LiteralPath (Join-Path $root '.git')) {
        $o = (& git -C $root remote get-url origin 2>$null)
        if ($o -and $o -notmatch '(?i)Fusion247PKA') {
            $cls = 'SEPARATE-REPO'; $detail = "own repository, origin $o - outside this estate's convergence, named not ignored"
        } else {
            $d = Test-DerivedFromMain $root
            if ($d.ok) { $cls = 'DERIVED-CURRENT'; $detail = "$($d.checked) source files byte-identical to canonical main" }
            else { $cls = 'DERIVED-STALE'; $detail = "$($d.mismatch.Count) file(s) differ: " + (($d.mismatch | Select-Object -First 3) -join ', ') }
        }
    }
    else {
        $d = Test-DerivedFromMain $root
        if ($d.ok) { $cls = 'DERIVED-CURRENT'; $detail = "$($d.checked) source files byte-identical to canonical main" }
        else { $cls = 'DERIVED-STALE'; $detail = "$($d.mismatch.Count) file(s) differ from canonical main: " + (($d.mismatch | Select-Object -First 4) -join ', ') }
    }
    $rows += [pscustomobject]@{ PID=$p.ProcessId; Root=$root; Class=$cls; Detail=$detail }
}

Write-Output "POSITIVE RUNTIME PROVENANCE - every live runtime must be placed, or it FAILS"
Write-Output ""
foreach ($r in ($rows | Sort-Object Class, Root)) {
    Write-Output ("  [{0,-15}] PID {1,-7} {2}" -f $r.Class, $r.PID, $r.Root)
    Write-Output ("                    {0}" -f $r.Detail)
}
Write-Output ""
$bad = @($rows | Where-Object { $_.Class -eq 'UNKNOWN' -or $_.Class -eq 'DERIVED-STALE' })
Write-Output ("runtimes examined : {0}" -f $rows.Count)
Write-Output ("canonical         : {0}" -f @($rows | Where-Object { $_.Class -eq 'CANONICAL' }).Count)
Write-Output ("derived-current   : {0}" -f @($rows | Where-Object { $_.Class -eq 'DERIVED-CURRENT' }).Count)
Write-Output ("private-runtime   : {0}" -f @($rows | Where-Object { $_.Class -eq 'PRIVATE-RUNTIME' }).Count)
Write-Output ("separate-repo     : {0}   (named, outside this estate)" -f @($rows | Where-Object { $_.Class -eq 'SEPARATE-REPO' }).Count)
Write-Output ("UNPLACED or STALE : {0}   (MUST BE ZERO)" -f $bad.Count)
Write-Output ""
if ($bad.Count -eq 0) {
    Write-Output "RESULT: PASS - every live Fusion247 runtime is canonical, provably derived from canonical main, or the approved private runtime."
} else {
    Write-Output "RESULT: FAIL - a live runtime is unplaced or running stale derived bytes."
}
Write-Output "LIMIT : process working directory is not exposed by Win32_Process and is not checked."
if ($bad.Count -eq 0) { exit 0 } else { exit 1 }
