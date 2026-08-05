# WO-2026-08-05-03 — evidence: the legacy Tower entrypoints REFUSE

- **Work Order:** `Deliverables/proofline/WO-2026-08-05-03-legacy-tower-removal.md` (Amendment 1)
- **Governance head:** `ec98ca4a43d433f781d8cbf68b160d88fd5ad309`
- **Branch:** `build-020/legacy-tower-refuse` · **worktree:** `C:\Fusion247PKA-wo-03` (cut from `ec98ca4a`)
- **Executed by:** Keel, 2026-08-05 · **Builder self-test evidence — NOT independent review.**
- **Acceptance property:** *`node bin/tower-watch.js` and `start-fusion-tower.ps1` REFUSE to start a
  watcher, exiting clearly and non-zero, while `services/tower-baton/src/clickupClient.js` remains
  present and the `control-trap` negative control still passes.*

This file exists because evidence that lives only in a session report dies with the session.

---

## 0. What was NOT done, and why

**`git worktree remove C:\Fusion247PKA-tower` was NOT performed.** It is in the Work Order's scope and
its preconditions were re-verified as safe (§5 below), but Larry placed a **sequencing hold** on that
one step mid-execution: `C:\.fusion247\run-tower-cp-watcher.ps1` kills every matching watcher **before**
it starts anything, so removing its start target ahead of WO-2026-08-05-04 would upgrade an accidental
invocation from a *takeover* into a *silent Tower death*. The worktree still exists. Nothing was
recreated or covered up.

## 1. Live runtime undisturbed — asserted at START and END

Asserted on **absolute script path and `WATCHER_ID`**, never a process-name match (a name match is
worthless here: the tower-loop suite spawns children whose command line is a bare `node watcher.mjs`).

| | Start (00:16 UTC) | End (00:28 UTC) |
|---|---|---|
| PID 31268 in `tasklist` | alive, `node.exe` | alive, `node.exe` |
| Absolute script path | `C:\Fusion247PKA\services\control-plane\tower-loop\watcher.mjs` | identical |
| Process start time | `04 August 2026 00:47:36` | identical — never restarted |
| `WATCHER_ID` in the log | `WARWICK_YOGA#cp#1785800856828` | identical |
| Last log line | `2026-08-05T00:16:37.517Z pr_poll_ok` | `2026-08-05T00:28:56.844Z pr_poll_ok` — advancing |

```
$ powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter 'ProcessId=31268' | Select-Object -ExpandProperty CommandLine"
"C:\Program Files\nodejs\node.exe" C:\Fusion247PKA\services\control-plane\tower-loop\watcher.mjs
```

Note the live watcher is the **tower-loop** watcher, a different service from the **tower-baton**
entrypoints retired here. Nothing in this change is on its path.

## 2. THE REFUSAL, PROVEN BY ATTEMPT

### 2a. `node bin/tower-watch.js` — the load-bearing route

```
$ cd C:/Fusion247PKA-wo-03/services/tower-baton && node bin/tower-watch.js
[TOWER-BATON RETIRED] This BUILD-010 legacy watcher entrypoint is retired and will NOT start.
[TOWER-BATON RETIRED] Retired by Warwick, 2026-08-05 - BUILD-020 proofline map 14.13 D-A (WO-2026-08-05-03).
[TOWER-BATON RETIRED] Use instead: node services/control-plane/tower-loop/run-watcher.mjs
[TOWER-BATON RETIRED] Nothing was started: no secret store read, no watcher lock taken, no ClickUp call made.
[TOWER-BATON RETIRED] Exiting 78.
EXIT=78
```

Run against the **real** environment, no overrides.

### 2b. `start-fusion-tower.ps1` — the documented launcher, on BOTH hosts

```
$ powershell -ExecutionPolicy Bypass -File "C:/Fusion247PKA-wo-03/services/tower-baton/scripts/start-fusion-tower.ps1" -TaskId 86b5abcde -Telegram
[TOWER-BATON RETIRED] This BUILD-010 legacy launcher is retired and will NOT start a watcher.
[TOWER-BATON RETIRED] Retired by Warwick, 2026-08-05 - BUILD-020 proofline map 14.13 D-A (WO-2026-08-05-03).
[TOWER-BATON RETIRED] Use instead: node services\control-plane\tower-loop\run-watcher.mjs
[TOWER-BATON RETIRED] Nothing was started: no pre-flight run, no secret store read, no watcher spawned.
[TOWER-BATON RETIRED] Exiting 78.
EXIT=78

$ pwsh -ExecutionPolicy Bypass -File "...same file..." -TaskId 86b5abcde -Telegram
   → byte-identical output, EXIT=78
```

**Exit `78` is deliberate.** This entrypoint has always exited non-zero on a bad day — `1` for
config fail-closed, `3` for the duplicate-watcher lock. "It exited non-zero" would therefore have been
a worthless assertion. `78` cannot be produced by any other path in either file.

## 3. The defect found on the way — the launcher NEVER parsed under the host its own documentation names

Pre-existing, not introduced here, and it changes what the seventh start path actually was.

`Builds/BUILD-010-fusion-tower/Runtime/recovery.md:58` documents the start as
`powershell -ExecutionPolicy Bypass -File ...\start-fusion-tower.ps1`. `powershell` is **Windows
PowerShell 5.1**, which reads a UTF-8-without-BOM file as ANSI/OEM. The file as committed carried
UTF-8 em-dashes (first at byte 25), and 5.1 died at **parse** time:

```
$ powershell ... [Parser]::ParseFile(<the file as committed at ec98ca4a>)
Message : The string is missing the terminator: ".
Message : Missing closing '}' in statement block or type definition.

$ pwsh ... [Parser]::ParseFile(<the same file>)
ORIGINAL PARSES CLEAN UNDER PWSH 7
```

So the launcher was live under **pwsh 7** and had never been runnable under **Windows PowerShell 5.1**.
Two consequences:

1. A guard alone would have been **unreachable** on the documented host — the script would have
   "refused" by crashing with a parser error, which is not the clear refusal Warwick asked for.
2. The file is now **pure ASCII** and a test asserts it stays that way (§4). Both hosts now parse it
   and both hosts now refuse identically.

## 4. Executable coverage — `services/tower-baton/test/retired.test.js`

```
$ cd services/tower-baton && node --test test/retired.test.js
# tests 6
# pass 6
# fail 0
```

| # | Test | What it pins |
|---|---|---|
| 1 | distinct retirement exit code | `78`, not merely non-zero |
| 2 | the notice names what is retired and what to use | a human can act on it |
| 3 | **the guard acts before anything is loaded, read or logged** | EXACT output (5 lines, all `[TOWER-BATON RETIRED]`), empty stdout, no `startup fail-closed`, **and nothing created under the secret-store path** |
| 4 | `src/clickupClient.js` still present | the negative control's target survives |
| 5 | the `.ps1` guard exists, uses the same code, precedes the launcher body | the second route is closed |
| 6 | **the `.ps1` is pure ASCII** | the §3 defect cannot be reintroduced |

**Test 3 is the invariant, not a comment.** ESM hoists static imports, so the guard cannot be written
textually above them; it is first-to-act only because every module under `services/tower-baton/src/**`
is declaration-only (verified: no top-level statements in any of the 13 files). Test 3 enforces that
by observation rather than by trust — add an import-time side effect anywhere in `src/**` and it fails.

### Both controls were made to FAIL before being cited

A control that has never failed is not evidence.

```
MUTATION A — restore the pre-guard entrypoint (git show ec98ca4a:...bin/tower-watch.js), re-run:
  # tests 5   # pass 2   # fail 3
  (the 2 survivors are the .ps1 and clickupClient tests, which correctly do not depend on the .js guard)

MUTATION B — append a single em-dash to the .ps1, re-run:
  not ok 6 - the launcher is pure ASCII ...
  # tests 6   # pass 5   # fail 1

BOTH REVERTED, clean re-run: # tests 6   # pass 6   # fail 0
```

### No regression in the service suite

```
BASELINE, unchanged tree (build-020/live-trial):   # tests 152   # pass 152   # fail 0
FINAL, this branch:                                 # tests 158   # pass 158   # fail 0
```

`158 = 152 + 6`. All six new tests are discovered by the service's own `node --test`, and nothing
pre-existing changed state. (An intermediate run reported `157` while `retired.test.js` still carried
five tests; the ASCII pin was added after it.)

## 5. The negative control still passes — and `src/` is untouched

```
$ cd services/control-plane/tower-loop && node test/doubles/graph-probe.mjs control-trap
TRAP_FIRED: ZERO-CLICKUP TRAP: this path loaded a ClickUp module: file:///C:/Fusion247PKA-wo-03/services/tower-baton/src/clickupClient.js
EXIT=0
```

Identical before and after the change (exit 0, same message). Exit `4` would have meant
`CONTROL_TARGET_MISSING`; exit `3` would have meant the trap could not fire. This is the whole reason
the retirement is a refusal and not a deletion, and it is why `services/tower-baton/src/**` was kept
out of the writable surface.

## 6. `C:\Fusion247PKA-tower` — re-verified safe to remove, then HELD

Re-verified at execution time rather than trusting the Work Order's paragraph:

| Check | Result |
|---|---|
| `git -C C:/Fusion247PKA-tower status --porcelain --untracked-files=all` | empty — clean, zero untracked |
| HEAD | `3c08e450d3617da1de43f11f0c33f3c2a483036b` on `build-014/tower-recovery` |
| Contained in a remote branch? | `origin/build-014/tower-recovery` — pushed, not orphaned |
| Ahead of `origin/main` | exactly 1 commit, and it is that pushed one |
| Any process holding the directory? | none (the only `Win32_Process` matches were my own probe commands) |
| Admin dir `C:/Fusion247PKA/.git/worktrees/Fusion247PKA-tower/` | no `locked` file |
| Stashes (shared `.git`) | 3, unaffected — they live in the shared `.git`, not in this worktree |
| Stale vs current | has `mergeCheck.mjs` + `run-watcher.mjs`, **no `reviewDiff.mjs`**; the current tree has all three |

**Removal not performed — see §0.**

## 7. Honest limits of this evidence

- **Builder self-test evidence, not independent review.**
- **The worktree removal is not done.** Re-verify §6 again at the moment it is released; the checks
  above were true at 2026-08-05 ~00:20–00:30 UTC and a worktree is a mutable thing.
- **A real logon is the only complete proof that no start path survives.** Nothing here tests the
  Startup folder or the scheduled task — those are WO-2026-08-05-04's ground, and restart testing is
  explicitly not required (map §14.0b). Recorded as the residual unproven step, not skipped.
- **`services/tower-baton/README.md` still documents both retired entrypoints as live** (lines 47 and
  50), as do `Builds/BUILD-010-fusion-tower/Runtime/recovery.md` and `runtime-manifest.yaml`. All are
  outside this order's surface: **reported, not fixed.** The guards mean following them now produces a
  clear refusal rather than a stale watcher, but the documents still point the wrong way.
- **Test 5 reads the `.ps1` rather than executing it**, so the suite stays runnable on non-Windows CI.
  The executed `.ps1` refusal is §2b, on both hosts.
