# EVIDENCE — WO-2026-08-05-04, WP-2A (machine half): the legacy Tower start paths are removed

| Field | Value |
|---|---|
| **Work Order** | `Deliverables/proofline/WO-2026-08-05-04-machine-level-legacy-removal.md` (Amendment 1) |
| **Executed by** | Mack, Automation Specialist |
| **Executed** | 2026-08-05, 01:28 → 01:35 local (UTC+1) |
| **Branch** | `build-020/machine-legacy-removal`, cut from `b165b0c42b55babb5c52246b3b6a8b5bf783f457` |
| **Governance head** | `ff43b67dc3770ef0a0fef88cb0fe87964db7ece1` |
| **Live authority used** | BOUNDED — the four enumerated machine targets, deletion/deregistration only |
| **GL-012 authority** | Warwick's named exception of 2026-08-05 (map §14.13 D-B) — two exact root paths, delete only |
| **Verdict** | **All four machine-level targets removed. Every machine-level route fails when attempted. PID 31268 alive with its log advancing at both start and end.** |

---

## 🔴 SCOPE BOUNDARY — READ THIS BEFORE CITING THIS FILE

**This file evidences the FOUR MACHINE-LEVEL targets ONLY. It is not the whole of S-2 and must never be read as such.**

The acceptance property amended into the map at §14.14 names **eight** start paths. Two of them are **out of scope for this file** and are evidenced elsewhere:

| Path | What it is | Owner | Where it is evidenced |
|---|---|---|---|
| **7** | `services/tower-baton/bin/tower-watch.js` + `scripts/start-fusion-tower.ps1` — closed by a **refuse guard**, not deletion (Warwick's decision D-A) | **Keel** | `WO-2026-08-05-03` |
| **8** | `Builds/BUILD-010-fusion-tower/Architecture/tower-host-runbook.md` §3–§4 — a documented human re-registration procedure | **Larry** | Larry's own correction of `Builds/BUILD-010-fusion-tower/**` |

**S-2 composes from three files. It does not rest on this one.** A reviewer who reads only this file has seen half the claim. This boundary is stated because the previous version of this Work Order asserted the eight-path claim from a four-path proof, and that defect is the reason Amendment 1 exists.

### The second boundary — what "closed list" honestly means

**Every automatic and registered machine route is enumerated and closed.** Checked and re-checked: all scheduled tasks (216 before, 215 after), every `Run`/`RunOnce`/`RunOnceEx`/`RunServices`/Policies hive, both Startup folders, `Win32_StartupCommand`, `StartupApproved`, WMI permanent subscriptions, Winlogon, `cmd.exe` AutoRun, Group Policy scripts, four PowerShell profiles and the Git Bash profiles.

**But `C:\.fusion247` itself cannot be enumerated under any grant that exists.** Hard prohibition #3 forbids listing it, and the named exception reaches exactly two files. `run-tower-watcher.ps1` referenced a `C:\.fusion247\tower-ding.mjs` at two lines, and that file appears in **no** investigation to date.

**So the honest claim is: every automatic/registered route is closed. Unregistered scripts sitting at the secrets root are the paste-to-resurrect class and are un-enumerable under the current grant.** Not *"complete"*.

### Credential discipline in this file

No secret value was read into any output, log, or line of this file. Where a file under the secrets root had to be read to verify the deletion premise, **findings are stated as booleans, line numbers, counts and derived values — no content of either root script is reproduced** (GL-012 §6). One redaction is marked inline in §V1 and is the only one.

---

## A1 — the live runtime, captured FIRST

Every later step re-asserts this exact PID **and its absolute script path**. Never a process-name match — the `tower-loop` suite spawns children whose command line is bare `node watcher.mjs`, indistinguishable by name from a resurrected legacy watcher (map §14.9a B3).

```
=== A1.1  Live watcher process, PID 31268 (CIM, absolute path) ===
ProcessId    : 31268
Name         : node.exe
CreationDate : 2026-08-04 00:47:36
ExecutablePath: C:\Program Files\nodejs\node.exe
CommandLine  : "C:\Program Files\nodejs\node.exe" C:\Fusion247PKA\services\control-plane\tower-loop\watcher.mjs
ParentProcessId: 36416

=== A1.2  Watcher log file stat ===
LogPath      : C:\Users\Buggly\.mypka\tower\logs\watcher.log
Length bytes : 947637
LastWriteTime: 2026-08-05 01:27:55
Now          : 2026-08-05 01:28:23

=== A1.4  Last 6 log lines (cadence sample) ===
{"ts":"2026-08-05T00:22:47.339Z","watcher":"WARWICK_YOGA#cp#1785800856828","evt":"pr_poll_ok","repo":"warwickallan/Fusion247PKA","pr":90,"head":"d6dab691ed553d2afc15f1adef4c353dcaf80584","scanned":6,"candidates":4,"checkpointsCreated":0,"outcomes":["deduped","refused_no_head_directive","deduped","refused_no_head_directive"]}
{"ts":"2026-08-05T00:27:55.370Z","watcher":"WARWICK_YOGA#cp#1785800856828","evt":"pr_poll_ok","repo":"warwickallan/Fusion247PKA","pr":90,"head":"d6dab691ed553d2afc15f1adef4c353dcaf80584","scanned":6,"candidates":4,"checkpointsCreated":0,"outcomes":["deduped","refused_no_head_directive","deduped","refused_no_head_directive"]}

=== A1.5  All node.exe processes running watcher.mjs, by ABSOLUTE PATH (never by name) ===
PID 31268  ::  "C:\Program Files\nodejs\node.exe" C:\Fusion247PKA\services\control-plane\tower-loop\watcher.mjs

=== A1.6  Any process whose command line names tower-watch (legacy tower-baton entrypoint) ===
ZERO processes match 'tower-watch'
```

**Baseline fixed:** PID **31268** · `WATCHER_ID` **`WARWICK_YOGA#cp#1785800856828`** · log **947,637 bytes** at **01:27:55** · last ts **`2026-08-05T00:27:55.370Z`** · **exactly one** `watcher.mjs` process on the box.

---

## C-1 — Warwick's condition, discharged at deletion time by three falsifiers

> *"Confirm immediately before deletion that neither is used by the current Tower runtime."*

**The order's original method was struck.** v1 told me to re-check that the PS1's log target *"has not been written since 2026-07-24"* — but those logs live under `C:\.fusion247\`, which hard prohibition #3 forbids. **The substitution below is observable entirely outside the secrets root and is stronger evidence than the check it replaces.** Adopted in Amendment 1.

Executed **01:29:11**, four minutes before the deletions.

```
=== C-1 FALSIFIER CHECK, executed at deletion time ===
timestamp : 2026-08-05 01:29:11

--- TARGET 2 :: C:\.fusion247\run-tower-cp-watcher.ps1 ---
  exists            : True
  line count        : 25
  F1 refs 'Fusion247PKA-tower' (stale worktree) at lines : 7,8
  F2 WATCHER_ID assignments : line 16 stamps prefix token: YOGA_CP#
  F2 seconds-precision timestamp constructs found : 1
  F3 poll interval  : line 17 sets WATCHER_POLL_MS=3000
  KILL line 23 : Stop-Process present; -Force=True; matches-tower-loop-watcher-pattern=True
  occurrences of the LIVE id prefix 'WARWICK_YOGA' : 0
  occurrences of the LEGACY id prefix 'YOGA_CP'    : 1
  Stop-Process  at line(s) : 23
  Start-Process at line(s) : 24
  KILL EXECUTES BEFORE START : True

--- TARGET 3 :: C:\.fusion247\run-tower-watcher.ps1 ---
  exists            : True
  line count        : 75
  F1 refs 'Fusion247PKA-tower' (stale worktree) at lines : NONE
  F2 WATCHER_ID assignments : NONE
  START line 8  : references bin/tower-watch.js (tower-baton entrypoint)
  START line 57 : references bin/tower-watch.js (tower-baton entrypoint)
  START line 59 : references bin/tower-watch.js (tower-baton entrypoint)
  START line 68 : references bin/tower-watch.js (tower-baton entrypoint)
  NOTE line 27 : references a tower-ding.mjs under the secrets root (un-enumerable, recorded not resolved)
  NOTE line 42 : references a tower-ding.mjs under the secrets root (un-enumerable, recorded not resolved)
  occurrences of the LIVE id prefix 'WARWICK_YOGA' : 0

=== C-1 CADENCE, measured from the LIVE log (last 8 poll gaps, seconds) ===
  gap 1 : 61.629 s
  gap 2 : 61.591 s
  gap 3 : 61.714 s
  gap 4 : 61.465 s
  gap 5 : 61.485 s
  gap 6 : 61.622 s
  gap 7 : 61.745 s
  gap 8 : 61.474 s

=== Does the LIVE runtime reference either script? ===
  ZERO references to either script from the live tower-loop/tower source
```

### The three falsifiers, resolved

| # | Falsifier | The legacy script | The live runtime | Verdict |
|---|---|---|---|---|
| **1 — PATH** | Where does it start from? | `run-tower-cp-watcher.ps1` holds the stale worktree `C:\Fusion247PKA-tower` at lines **7 and 8** | PID 31268 runs `C:\Fusion247PKA\services\control-plane\tower-loop\watcher.mjs` | **Different absolute path.** Not launched by it |
| **2 — IDENTITY** | What ID does it stamp? | Line 16 stamps prefix **`YOGA_CP#`**, from a **seconds**-precision construct. **Zero** occurrences of `WARWICK_YOGA` in the file | Live ID is **`WARWICK_YOGA#cp#1785800856828`** — different prefix **and** 13-digit **millisecond** precision | **Different prefix AND different precision.** Two independent mismatches |
| **3 — CADENCE** | How fast would its child poll? | Line 17 hardcodes **`WATCHER_POLL_MS=3000`** — 3 seconds | Measured **61.465–61.745 s** across 8 consecutive gaps | **A process it launched would poll every 3s.** It polls every ~61.6s |

**For `run-tower-watcher.ps1`:** it launches `bin/tower-watch.js` (four reference sites) and **zero `tower-watch` processes exist** on the box (A1.6). It stamps no `WATCHER_ID` at all and never names the live path.

**Independent corroboration:** zero references to either script from the live `tower-loop` / `tower` source.

✅ **C-1 DISCHARGED. Neither script launched, nor is used by, the current Tower runtime.**

### Prohibition #1's premise — independently confirmed, and it is worse than "a kill"

`Stop-Process` at **line 23**, `-Force` **True**, pattern matching the `tower-loop` watcher — **it does match the live watcher's command line.** `Start-Process` is at **line 24**.

**The kill executes BEFORE the start, unconditionally.** That is why the sequencing note in map §14.14 is safety-critical: line 7's start target is the very worktree Keel is authorised to remove, so **had the worktree gone first, an accidental invocation would have stopped being a takeover and become a silent Tower death** — kill the incumbent, then have nothing to start. Larry placed Keel's `git worktree remove` under HOLD on this finding. **These deletions landed first.**

---

## BEFORE-STATE — all four targets, 01:32:05

```
--- T1 Startup VBS ---
path      : C:\Users\Buggly\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\mypka-tower-cp-watcher.vbs
Test-Path : True
size/ctime/mtime : 337 bytes / 2026-07-22 14:04:16 / 2026-07-22 14:04:16

--- T2 / T3 root scripts (existence + stat only) ---
Test-Path C:\.fusion247\run-tower-cp-watcher.ps1 : True
    size/ctime/mtime : 2228 bytes / 2026-07-22 17:24:05 / 2026-07-22 17:24:05
Test-Path C:\.fusion247\run-tower-watcher.ps1 : True
    size/ctime/mtime : 4518 bytes / 2026-08-02 05:23:53 / 2026-08-02 05:23:53

--- Startup FOLDER enumeration ---
  [C:\Users\Buggly\AppData\Roaming\...\Startup]
    desktop.ini
    mypka-tower-cp-watcher.vbs        <-- T1, ACTIVE
    Send to OneNote.lnk
  [C:\ProgramData\Microsoft\...\Startup]
    Dell Display Manager.lnk.disabled
    desktop.ini
    Tailscale.lnk

--- Win32_StartupCommand (tower-relevant row) ---
  Startup | mypka-tower-cp-watcher | mypka-tower-cp-watcher.vbs

--- StartupApproved\StartupFolder disable flags ---
  Send to OneNote.lnk
```

**T1 was an ACTIVE registration.** `Win32_StartupCommand` reported it, and the only `StartupApproved` disable flag on the box belongs to *Send to OneNote* — **there was no disable flag for the VBS.** It would have fired at the next interactive logon.

### T4 — the scheduled task, before

```
--- INSTRUMENT 1 = schtasks (AUTHORITATIVE per Amendment 1) ---
  TaskName:                             \FusionTowerBatonWatcher
  Next Run Time:                        N/A
  Status:                               Disabled
  Last Run Time:                        03/08/2026 02:05:02
  Last Result:                          0
  Task To Run:                          powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\.fusion247\run-tower-watcher.ps1"
  Comment:                              Fusion Tower baton watcher. Repaired 2026-08-02: was logon-only and pinned to the
                                        DELETED worktree C:\Fusion247PKA-b010, so it sat dead for 12 days in silence.
                                        Now repeats every 10 min, is idempotent, and dings TowerBot on every failure path.
  Scheduled Task State:                 Disabled
  [trigger 1] Schedule Type:            At logon time
  [trigger 2] Schedule Type:            Daily
             Start Time:                00:05:00
             Start Date:                02/08/2026
             Repeat: Every:             0 Hour(s), 10 Minute(s)
             Repeat: Until: Duration:   24 Hour(s), 0 Minute(s)
  schtasks exit code : 0

--- INSTRUMENT 2 = Get-ScheduledTask / Get-ScheduledTaskInfo (recorded, NOT authoritative) ---
  State   : Disabled
  Trigger 1 : type=MSFT_TaskLogonTrigger enabled=True repetition= start=
  Trigger 2 : type=MSFT_TaskDailyTrigger enabled=True repetition=PT10M start=2026-08-02T00:05:00+01:00
  Action  : powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\.fusion247\run-tower-watcher.ps1"
  LastRunTime=08/03/2026 02:05:02 LastResult=0 NextRunTime=08/05/2026 01:35:00 NumberOfMissedRuns=284
```

**Both triggers were `enabled=True`** while the task itself was `Disabled` — so re-enabling was a one-command resurrection, and the daily trigger's `Repetition = PT10M` over a 24-hour duration made it **a ten-minute resurrection loop requiring no logon.** `NumberOfMissedRuns` had reached **284**. **Disabled is reversible; unregistered is not.** That is the whole value of this target.

### ⚠️ Instrument disagreement — reproduced live, and recorded rather than resolved

At the **same minute on the same task**, `schtasks` reported `Next Run Time: N/A` while `Get-ScheduledTaskInfo` reported `NextRunTime = 08/05/2026 01:35:00`.

**`schtasks` is treated as authoritative for A3 per Amendment 1, and both instruments are recorded.** The disagreement is not explained here and is not claimed to be. It did not affect the outcome — **the deletion order was chosen so that it could not**: T4 was unregistered *before* its target script T3 was deleted, so even if instrument 2 had been right and a trigger had fired at 01:35, there was no window in which a live task could point at a missing file.

### ✅ The provenance question is closed — by the task's own Comment field

`run-tower-watcher.ps1` was escalated to Warwick as **unexplained** (created and last written `2026-08-02 05:23:53`, matching the daily trigger's start boundary). **The task's `Comment` field explains it:** a prior session **repaired a watchdog that had died silently** — it had been logon-only and pinned to the deleted worktree `C:\Fusion247PKA-b010`, and sat dead for 12 days.

**Nothing mysterious set it up.** The WO's STOP condition for target 3 was tested and **not met**: `LastRunTime 2026-08-03 02:05:02`, `LastResult 0`, disabled immediately after, and **zero `tower-watch` processes exist**. Not in use. Removal proceeded.

---

## THE DELETIONS — 01:33:08

Order rationale, stated in the run itself: **T1 first** removes the only *automatic* route to the killer script; **T4 is unregistered before T3 is deleted**, so no window exists in which a trigger could fire at a missing target.

Every step is bracketed by a **terminating** live-watcher assertion on **PID + absolute script path**.

```
=== DELETION PASS  2026-08-05 01:33:08 ===

=== DELETE T1 Startup VBS :: C:\Users\Buggly\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\mypka-tower-cp-watcher.vbs ===
  [live-watcher] pre-T1 Startup VBS : PID 31268 ALIVE, absolute path asserted
  Test-Path BEFORE : True
  Remove-Item issued. Test-Path AFTER : False
  [live-watcher] post-T1 Startup VBS : PID 31268 ALIVE, absolute path asserted

=== DELETE T2 run-tower-cp-watcher.ps1 :: C:\.fusion247\run-tower-cp-watcher.ps1 ===
  [live-watcher] pre-T2 run-tower-cp-watcher.ps1 : PID 31268 ALIVE, absolute path asserted
  Test-Path BEFORE : True
  Remove-Item issued. Test-Path AFTER : False
  [live-watcher] post-T2 run-tower-cp-watcher.ps1 : PID 31268 ALIVE, absolute path asserted

=== DEREGISTER T4 :: scheduled task FusionTowerBatonWatcher ===
  [live-watcher] pre-T4 : PID 31268 ALIVE, absolute path asserted
  present BEFORE : True
  Unregister-ScheduledTask issued.
  present AFTER  : False
  [live-watcher] post-T4 : PID 31268 ALIVE, absolute path asserted

=== DELETE T3 run-tower-watcher.ps1 :: C:\.fusion247\run-tower-watcher.ps1 ===
  [live-watcher] pre-T3 run-tower-watcher.ps1 : PID 31268 ALIVE, absolute path asserted
  Test-Path BEFORE : True
  Remove-Item issued. Test-Path AFTER : False
  [live-watcher] post-T3 run-tower-watcher.ps1 : PID 31268 ALIVE, absolute path asserted

=== DELETION PASS COMPLETE ===
  [live-watcher] end-of-deletion-pass : PID 31268 ALIVE, absolute path asserted
```

**Nothing else under `C:\.fusion247\` was touched, listed, opened or modified.** `tower-baton.env` is intact — condition C-2 held. Exactly two files at that root were deleted, and they are the two Warwick named.

---

## A0 — the GATE, and it is terminating

```
=== A0 GATE -- TERMINATING. 2026-08-05 01:34:35 ===
No attempt command may be issued while any file target survives.
  Test-Path T1 VBS = False   (gate requires False)
  Test-Path T2 cp-watcher.ps1 = False   (gate requires False)
  Test-Path T3 watcher.ps1 = False   (gate requires False)
  A0 GATE PASSED -- all three file targets absent. Attempts authorised.
```

**Why this gate exists:** an attempt against a *surviving* `run-tower-cp-watcher.ps1` would not be a proof — it would be a `Stop-Process -Force` over the live watcher followed by a stale copy starting against the live database. The gate is the difference between an attempt-proof and an outage.

---

## A2 — attempt each deleted `.ps1` by absolute path

Each attempt carries a **second, independent guard**: a `Test-Path -eq $false` re-assert issued **immediately before** the attempt command, not merely once at the gate.

`powershell -File` is used rather than inline `-Command`, which removes the argument-mangling class entirely. `MSYS_NO_PATHCONV=1` was set throughout, and every Windows instrument was invoked from inside a `.ps1` so that no MSYS layer ever saw `/Query`, `/Run` or `/TN`.

**The `wscript` attempt on the VBS is STRUCK** per the order: `WScript.Shell.Run(..., 0, False)` returns immediately and surfaces no error from its target, so it would prove only that one file is absent — which `Test-Path` already established with no execution risk.

```
--- attempt: T2 run-tower-cp-watcher.ps1 ---
  re-assert Test-Path -eq False immediately before attempt : True
  command : powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\.fusion247\run-tower-cp-watcher.ps1
  exit code : -196608
  output    :
    powershell.exe : The argument 'C:\.fusion247\run-tower-cp-watcher.ps1' to the -File parameter does not exist. Provide
    the path to an existing '.ps1' file as an argument to the -File parameter.
  [live-watcher] post-attempt T2 run-tower-cp-watcher.ps1 : PID 31268 ALIVE, absolute path asserted

--- attempt: T3 run-tower-watcher.ps1 ---
  re-assert Test-Path -eq False immediately before attempt : True
  command : powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\.fusion247\run-tower-watcher.ps1
  exit code : -196608
  output    :
    powershell.exe : The argument 'C:\.fusion247\run-tower-watcher.ps1' to the -File parameter does not exist. Provide the
    path to an existing '.ps1' file as an argument to the -File parameter.
  [live-watcher] post-attempt T3 run-tower-watcher.ps1 : PID 31268 ALIVE, absolute path asserted
```

**Both routes fail. Neither starts anything.** The live watcher is asserted alive after each.

---

## A3 — the load-bearing attempt

**This is the one attempt that distinguishes *unregistered* from *merely disabled*.** A "task is disabled" response would prove only that it is off — and off is one command from on.

```
  command : schtasks.exe /Query /TN FusionTowerBatonWatcher
  exit code : 1
    schtasks.exe : ERROR: The system cannot find the file specified.

  command : schtasks.exe /Run /TN FusionTowerBatonWatcher
  exit code : 1
    schtasks.exe : ERROR: The system cannot find the file specified.

  [live-watcher] post-A3 : PID 31268 ALIVE, absolute path asserted
```

✅ **"The system cannot find the file specified" — NOT "task is disabled".** The task is gone from the registry, not switched off. `/Run` — an explicit attempt to start it — fails for the same reason. **The ten-minute resurrection loop no longer exists.**

---

## A4 — re-enumeration: zero tower entries

```
  [Startup folders]
    ...\Roaming\...\Startup :: desktop.ini
    ...\Roaming\...\Startup :: Send to OneNote.lnk
    ...\ProgramData\...\Startup :: Dell Display Manager.lnk.disabled
    ...\ProgramData\...\Startup :: desktop.ini
    ...\ProgramData\...\Startup :: Tailscale.lnk
    >> matching entries : 0

  [Win32_StartupCommand]
    >> matching entries : 0

  [Run / RunOnce hives]     (HKCU Run, HKCU RunOnce, HKLM Run, HKLM RunOnce)
    >> matching entries : 0

  [Scheduled tasks -- full enumeration, filtered]
    total tasks on box : 215
    MATCH: \MyPKA-AsdAIr-Runtime [Ready]
    MATCH: \MyPKA-Directus-Live [Ready]
    MATCH: \MyPKA-Local-Services-Live [Disabled]
    >> matching entries : 3

  [Processes -- any legacy watcher, asserted by ABSOLUTE PATH not by name]
    PID 31268 :: "C:\Program Files\nodejs\node.exe" C:\Fusion247PKA\services\control-plane\tower-loop\watcher.mjs
    >> processes running from the stale worktree C:\Fusion247PKA-tower : 0
```

**Task count fell from 216 to 215** — the arithmetic of the removal, visible.

### V1 — the three surviving `MyPKA-*` matches, and why none is a tower start route

The A4 filter is deliberately broad (`tower|fusion247|mypka|baton`), so it catches three unrelated tasks. **A filter that returned a clean zero by being narrow would be worthless.** Their actions:

```
  MyPKA-AsdAIr-Runtime  [Ready]
    action : C:\Program Files\nodejs\node.exe --env-file=<secrets-root path, REDACTED> --env-file=<secrets-root path, REDACTED> "C:\Fusion247PKA\services\asdair\pipeline-runtime\ensure-asdair-runtime.mjs"
    starts a tower watcher? False
  MyPKA-Directus-Live  [Ready]
    action : C:\Program Files\nodejs\node.exe C:\Fusion247PKA\services\control-plane\wp-d-proof\ensure-directus-live.mjs
    starts a tower watcher? False
  MyPKA-Local-Services-Live  [Disabled]
    action : C:\Program Files\nodejs\node.exe scripts\ensure-local-services.mjs
    starts a tower watcher? False
```

*(The two `--env-file` arguments on the AsdAIr task are `.env` paths under the secrets root. They are redacted here — the redaction is declared rather than performed silently. The load-bearing part of the line, the target script, is intact and is not a tower watcher.)*

✅ **Zero tower start routes remain in any Startup folder, any `Run`/`RunOnce` hive, `Win32_StartupCommand`, or the scheduled-task registry.**

---

## A5 — the runtime was never disturbed

```
  [live-watcher] A5-final : PID 31268 ALIVE, absolute path asserted
  log length now : 949599 bytes   (A1 baseline: 947637)
  log mtime  now : 2026-08-05 01:34:04   (A1 baseline: 2026-08-05 01:27:55)
    {"ts":"2026-08-05T00:34:04.567Z","watcher":"WARWICK_YOGA#cp#1785800856828","evt":"pr_poll_ok",...}
  last log ts : 2026-08-05T00:34:04.567Z   (A1 baseline last ts: 2026-08-05T00:27:55.370Z)
  LOG ADVANCED SINCE A1 : True
  WATCHER_ID still : WARWICK_YOGA#cp#1785800856828   (A1 baseline: WARWICK_YOGA#cp#1785800856828)
  WATCHER_ID UNCHANGED : True
```

Final state at **01:35:35**:

```
  PID 31268 alive : True
  CommandLine     : "C:\Program Files\nodejs\node.exe" C:\Fusion247PKA\services\control-plane\tower-loop\watcher.mjs
  log length      : 949926 bytes
  log mtime       : 2026-08-05 01:35:06
```

**Same PID, same absolute path, same `WATCHER_ID`, log grown 947,637 → 949,926 bytes and still advancing.** The `WATCHER_ID` being *unchanged* matters as much as the PID: a restart would have minted a new one. **Nothing restarted, nothing was replaced, nothing was killed.**

---

## The gates were MADE TO FAIL — a control is not evidence until it is

Three assertions carried this work. Each was mutation-tested **after** the real run, with a decoy that forces the failure condition. An untested guard is a claim, not a control.

```
=== V2 -- MUTATION TEST of the A0 gate ===
  decoy created, Test-Path = True
  Test-Path T1 VBS = False   (gate requires False)
  Test-Path T2 DECOY = True   (gate requires False)
  gate threw as designed : A0 GATE FAILED -- a file target survives. NO ATTEMPT WILL BE ISSUED.
  RESULT: gate terminated = True ; attempt block reached = False
  MUTATION TEST PASSED = True

=== V3 -- MUTATION TEST of the per-attempt re-assert ===
  re-assert Test-Path -eq False immediately before attempt : False
  re-assert threw as designed : TERMINATING: target present at attempt time -- executing it would kill the live watcher
  RESULT: re-assert terminated = True ; attempt command issued = False
  MUTATION TEST PASSED = True

=== V4 -- MUTATION TEST of the live-watcher assertion ===
  assertion threw as designed : TERMINATING: PID 31268 does not match the STALE worktree path (expected -- this is the mutation)
  MUTATION TEST PASSED = True  (the assertion discriminates live path from stale path; it is not a tautology)
```

**V4 is the important one.** It proves the live-watcher assertion actually discriminates on the absolute path rather than passing for any node process — pointed at the *stale* worktree path, it fails. The "did not disturb the runtime" evidence throughout this file therefore means what it says.

---

## Acceptance property — assessed

> *All four **machine-level** targets are gone, and every **machine-level** route fails when attempted, while PID 31268 is alive with its log advancing at both start and end.*

| # | Target | Removed | Route attempted | Result |
|---|---|---|---|---|
| **T1** | Startup VBS `mypka-tower-cp-watcher.vbs` | ✅ `Test-Path False` | *(`wscript` attempt STRUCK by the order — it would prove nothing)* | Absent from Startup folder, `Win32_StartupCommand` and all hives |
| **T2** | `C:\.fusion247\run-tower-cp-watcher.ps1` | ✅ `Test-Path False` | `powershell -File` | **Fails — file does not exist** |
| **T3** | `C:\.fusion247\run-tower-watcher.ps1` | ✅ `Test-Path False` | `powershell -File` | **Fails — file does not exist** |
| **T4** | Scheduled task `FusionTowerBatonWatcher` | ✅ unregistered | `schtasks /Query`, `schtasks /Run` | **Fails — "cannot find the file specified", NOT "disabled"** |

**Live runtime:** PID 31268 alive and asserted on absolute path at **eleven** separate checkpoints — before and after each of the four removals, after each attempt, after A3, and at A5. `WATCHER_ID` unchanged. Log advanced 947,637 → 949,926 bytes.

✅ **The amended acceptance property is met for the machine half.**

---

## Named as unproven, and never quietly skipped

1. **A real interactive logon is the only complete proof of A4.** Under map §14.0b Warwick does not require restart testing, so this is **named as the one residual unproven step**, not claimed and not skipped. What *is* proven without it: the VBS file is absent, `Win32_StartupCommand` no longer reports it, and no `StartupApproved` entry references it. There is nothing left for a logon to launch — but the logon itself was not performed.
2. **`C:\.fusion247` is un-enumerable under any grant that exists.** See the scope boundary above. `run-tower-watcher.ps1` referenced a `C:\.fusion247\tower-ding.mjs` at lines 27 and 42 that appears in no investigation to date. It is **recorded, not resolved.**
3. **The instrument disagreement between `schtasks` and `Get-ScheduledTaskInfo` is unexplained.** Both are recorded; `schtasks` was treated as authoritative; the deletion order was chosen so the disagreement could not affect the outcome.
4. **Paths 7 and 8 are not evidenced here.** They are Keel's and Larry's. **S-2 composes from three files.**

## Report-only findings (out of scope, for Larry's decision — not work I have taken)

- **`run-tower-cp-watcher.ps1` set `TELEGRAM_BOT_TOKEN`, `AUTHORISED_TELEGRAM_USER_ID`, `CONTROL_PLANE_DEV_DATABASE_URL` and `TOWER_EVIDENCE_REPO_DIR` as environment variables** (names only — **no value was read into any output**). Pattern inspection found **no inline quoted credential literal** for the token or user-ID assignments, so the file appears to have derived them rather than hardcoding them. Its deletion is credential-hygiene-positive. **Line 12 assigned a 38-character string literal to a variable named `$key` that is referenced nowhere else in the file** — a dead assignment. Its value was never read into output and its nature is not determined; determining it would require reading a value, which the exception does not authorise. **Flagged because deletion is irreversible.** The live Codex-QA route's credentials live in `tower-baton.env`, which is intact per C-2.
- **The A4 filter still matches three `MyPKA-*` tasks.** All three re-verified as non-tower (§V1). Consistent with the earlier investigation.

---

## Envelope compliance

| Constraint | Status |
|---|---|
| Hard prohibition #1 — never execute `run-tower-cp-watcher.ps1` | ✅ **Never executed.** Read-to-verify only, then deleted. The only `powershell -File` invocation happened *after* deletion, behind a terminating gate plus a per-attempt re-assert, both mutation-tested |
| Hard prohibition #2 — never delete or modify `tower-baton.env` | ✅ **Untouched, unopened, unlisted** |
| Hard prohibition #3 — never touch anything else under `C:\.fusion247\` | ✅ **Exactly two files touched**, both named in Warwick's exception. The root was never enumerated |
| Hard prohibition #4 — never disturb PID 31268 | ✅ **Asserted alive at 11 checkpoints.** Same PID, path and `WATCHER_ID` throughout |
| `credential_scope: none` | ✅ **No secret value read into output, log or this file.** One declared redaction (§V1) |
| `file_surface` — one new evidence file under `Deliverables/proofline/` | ✅ **This file is the branch's only repo content** |
| `network: none` | ✅ No network call |
| `MSYS_NO_PATHCONV=1`, `powershell -File` not inline flags | ✅ Throughout. Every Windows instrument invoked from inside a `.ps1`, so no MSYS layer ever saw `/Query`, `/Run` or `/TN` |
| Assert on absolute path + `WATCHER_ID`, never a process name | ✅ Throughout, and **proven discriminating** by mutation test V4 |
