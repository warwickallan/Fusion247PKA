# convergence-runtime-check.ps1
#
# POSITIVE RUNTIME PROVENANCE. Replaces the earlier negative check.
#
#   Every live runtime CONTROLLED BY, LAUNCHED BY, or whose AUTHORITATIVE SOURCE BELONGS TO
#   Fusion247PKA must be IDENTIFIABLE, its actual code source KNOWN, and that source must be
#   canonical `main` or an install DEMONSTRABLY PRODUCED FROM canonical `main`.
#
#   SCOPE (Warwick, 2026-08-08): a legitimate separate repo/product estate is NOT in scope and is
#   NOT audited, reconciled or modified. No cross-repo archaeology.
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
#   DERIVED-CURRENT  an installed copy whose tracked source files are identical IN CONTENT to
#                    canonical main. PROVEN by comparison, not by a marker file or a plausible name.
#                    Line endings are normalised before comparing: the documented install route is
#                    `git cat-file blob`, which yields LF where the working tree holds CRLF, so a
#                    raw byte comparison manufactured drift that did not exist. See
#                    Test-ContentIdentical for the measurement that established it.
#   DERIVED-STALE    an installed copy whose CONTENT differs from canonical main. FAILS. This is the
#                    case that escaped the old check.
#   EXTERNAL-ESTATE  a legitimate SEPARATE repo/product estate. NOT Fusion247PKA state, NOT audited.
#                    Only one question is asked of it: does Fusion247PKA launch from or depend on it?
#   IMPROPER-DEPENDENCY  Fusion247PKA code references an external estate's path. FAILS.
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

function Test-ContentIdentical([string]$a, [string]$b) {
    # CONTENT, not REPRESENTATION.
    #
    # WHY THIS EXISTS (WO-2026-08-15-06, 2026-08-15). This estate runs core.autocrlf=true with no
    # root .gitattributes, so the git blob holds LF while the working tree holds CRLF. The documented
    # install route for every runtime here is `git cat-file blob <head>:<path>` — see the
    # INSTALLED-FROM.txt files, which record installing from the blob PRECISELY because a copy taken
    # from the working tree "differs by exactly the line count and fails byte-identity". So a
    # correctly installed, genuinely current file is routinely CR-different from its canonical
    # counterpart, and a raw hash calls that DRIFT. It is not drift. It is one content, written two
    # ways, and reporting it as stale sends an operator hunting a difference that does not exist.
    #
    # Measured before this was written: against the working tree 7 of 10 governor modules falsely
    # differed; against the git blob 2 of 10 falsely differed. Raw hashes lie in BOTH directions.
    #
    # CR bytes are stripped from BOTH sides and nothing else is touched. ISO-8859-1 is a lossless
    # byte<->char map — all 256 values round-trip — so this is a byte comparison written as a string
    # comparison: no encoding is assumed about the file, and a one-character content change still
    # differs. (Windows PowerShell 5.1 has no [Text.Encoding]::Latin1, hence GetEncoding by name.)
    #
    # FAILS CLOSED. An unreadable file returns $false and is reported as drift. A checker that goes
    # quiet when it cannot read the ground is worse than one that never ran at all.
    try {
        $enc = [System.Text.Encoding]::GetEncoding('iso-8859-1')
        $ta = $enc.GetString([System.IO.File]::ReadAllBytes($a)).Replace("`r", '')
        $tb = $enc.GetString([System.IO.File]::ReadAllBytes($b)).Replace("`r", '')
        return ($ta -ceq $tb)
    } catch {
        return $false
    }
}

function Test-DerivedFromMain([string]$root) {
    # PROVE derivation: every tracked source file present in the install must be identical IN CONTENT
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
                # TWO STAGES, deliberately. The raw hash is the fast path and settles the common
                # case outright: equal bytes are equal content, and no further question is worth
                # asking. Only when the bytes differ is the CONTENT question asked, so the cost of
                # the second read is paid solely by the handful of files that actually differ —
                # and a file whose sole difference is line endings stops being reported as drift.
                # A real change of even one character fails both stages and is still reported.
                $a = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
                $b = (Get-FileHash -LiteralPath $canonFile -Algorithm SHA256).Hash
                if ($a -ne $b -and -not (Test-ContentIdentical $_.FullName $canonFile)) { $mismatch += $rel }
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
            # EXTERNAL / SEPARATE ESTATE. Warwick, 2026-08-08: a legitimate separate repo/product
            # estate (fusion247-platform, Trainr, PowerLumina, ...) is NOT Fusion247PKA state and is
            # NOT audited, reconciled or modified by this check. The scope of the 4C invariant is
            # every runtime CONTROLLED BY, LAUNCHED BY, or whose AUTHORITATIVE SOURCE BELONGS TO
            # Fusion247PKA. The only question asked of an external estate is the one below: is
            # Fusion247PKA improperly depending on or launching from it? No cross-repo archaeology.
            $improper = @()
            if (Test-Path -LiteralPath (Join-Path $root '.git')) {
                $launchers = Get-ChildItem -LiteralPath $CANON -Recurse -File -Include *.mjs,*.js,*.ps1,*.cmd,*.vbs -ErrorAction SilentlyContinue |
                    Where-Object { $_.FullName -notmatch '\\node_modules\\' -and $_.FullName -notmatch '\\Deliverables\\' -and $_.FullName -notmatch '\\Builds\\' }
                foreach ($f in $launchers) {
                    if ((Get-Content -LiteralPath $f.FullName -Raw -ErrorAction SilentlyContinue) -match [regex]::Escape($root)) { $improper += $f.FullName }
                }
            }
            if ($improper.Count -eq 0) {
                $cls = 'EXTERNAL-ESTATE'; $detail = "separate repo, origin $o - NOT Fusion247PKA state, not audited. Fusion247PKA does not launch from or depend on it (0 references in canonical code)."
            } else {
                $cls = 'IMPROPER-DEPENDENCY'; $detail = "Fusion247PKA code references this external estate: " + (($improper | Select-Object -First 3) -join ', ')
            }
        } else {
            $d = Test-DerivedFromMain $root
            if ($d.ok) { $cls = 'DERIVED-CURRENT'; $detail = "$($d.checked) source files content-identical to canonical main (line endings normalised)" }
            else { $cls = 'DERIVED-STALE'; $detail = "$($d.mismatch.Count) file(s) differ: " + (($d.mismatch | Select-Object -First 3) -join ', ') }
        }
    }
    else {
        $d = Test-DerivedFromMain $root
        if ($d.ok) { $cls = 'DERIVED-CURRENT'; $detail = "$($d.checked) source files content-identical to canonical main (line endings normalised)" }
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
$bad = @($rows | Where-Object { $_.Class -eq 'UNKNOWN' -or $_.Class -eq 'DERIVED-STALE' -or $_.Class -eq 'IMPROPER-DEPENDENCY' })
Write-Output ("runtimes examined : {0}" -f $rows.Count)
Write-Output ("canonical         : {0}" -f @($rows | Where-Object { $_.Class -eq 'CANONICAL' }).Count)
Write-Output ("derived-current   : {0}" -f @($rows | Where-Object { $_.Class -eq 'DERIVED-CURRENT' }).Count)
Write-Output ("private-runtime   : {0}" -f @($rows | Where-Object { $_.Class -eq 'PRIVATE-RUNTIME' }).Count)
Write-Output ("external-estate   : {0}   (separate repo, NOT audited - only checked that Fusion247PKA does not launch from it)" -f @($rows | Where-Object { $_.Class -eq 'EXTERNAL-ESTATE' }).Count)
Write-Output ("UNPLACED or STALE : {0}   (MUST BE ZERO)" -f $bad.Count)
Write-Output ""
if ($bad.Count -eq 0) {
    Write-Output "RESULT: PASS - every live Fusion247 runtime is canonical, provably derived from canonical main, or the approved private runtime."
} else {
    Write-Output "RESULT: FAIL - a live runtime is unplaced or running stale derived bytes."
}
Write-Output "LIMIT : process working directory is not exposed by Win32_Process and is not checked."
if ($bad.Count -eq 0) { exit 0 } else { exit 1 }
