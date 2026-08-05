# WO-2026-08-05-04 — WP-2A (machine half): remove the legacy Tower start paths

> ## AMENDMENT 1 — 2026-08-05. Mack returned `REFUSE` on two grounds. **Both upheld. Both are defects in my order, both are wording, and neither needs Warwick or a wider grant.**
>
> ### D-1 upheld — **C-1 as written required a check my own prohibition #3 forbids**
>
> v1 said to re-execute the check that the PS1's log target *"has not been written since 2026-07-24"*. **Those logs live at `C:\.fusion247\logs\...` — under the secrets root and OUTSIDE the two-path exception.** I instructed a check that the same order forbids.
>
> **Mack's substitution is ADOPTED, and it is stronger evidence than what it replaces.** C-1 is discharged by three falsifiers observable entirely outside the secrets root:
> 1. **Path** — live PID 31268 runs `C:\Fusion247PKA\...\watcher.mjs`; the PS1 launches `C:\Fusion247PKA-tower\...`. Different absolute path.
> 2. **Identity** — live `WATCHER_ID` is `WARWICK_YOGA#cp#1785800856828` (13-digit ms); the PS1 stamps `YOGA_CP#<10-digit seconds>`. Different prefix **and** different precision.
> 3. **Cadence** — the PS1 hardcodes `WATCHER_POLL_MS=3000`; the live log polls at **61 seconds**. A process it launched would poll every 3s.
>
> For `run-tower-watcher.ps1`: it launches `bin/tower-watch.js` with cwd `services\tower-baton`, and **zero `tower-watch` processes exist**. **Warwick's condition C-1 is satisfied in substance and better than by the method I specified.**
>
> ### D-2 upheld — **my `acceptance_property` was the exact defect that got WO-03 refused**
>
> v1 said *"every remaining start path fails when attempted"* — but §14.14 amended the property to **eight** paths, and paths 7 and 8 are **Keel's and Larry's, not in Mack's `machine_surface`**. An evidence file asserting the eight-path claim from a four-path proof **reads as complete and is not.** I reproduced the failure I had just finished writing up.
>
> **AMENDED `acceptance_property`:** *All four **machine-level** targets are gone, and every **machine-level** route fails when attempted, while PID 31268 is alive with its log advancing at both start and end.*
>
> **The evidence file MUST carry a prominent boundary statement** naming paths 7 (`bin/tower-watch.js` + `start-fusion-tower.ps1`) and 8 (the `tower-host-runbook.md` §3–§4 registration procedure) as **out of scope for this file and evidenced elsewhere.** **S-2 composes from three files; it does not rest on this one.**
>
> ### Also amended
>
> - **🚨 SEQUENCING, and it is safety-critical.** Mack established that **line 23 (kill) executes BEFORE line 24 (start)** in `run-tower-cp-watcher.ps1`, and line 7's start target is the very worktree Keel may remove. **So if the worktree goes first, an accidental invocation stops being a takeover and becomes a SILENT TOWER DEATH.** **Mack's deletions land FIRST. Keel's `git worktree remove` is HELD until Larry releases it** — instruction already sent.
> - **Target 4's trigger is worse than v1 said.** It is a daily trigger **with `Repetition = PT10M`** — a **ten-minute resurrection loop needing no logon**, not "one run tomorrow". `NumberOfMissedRuns = 283`. **Raises the value of unregistering it; the method is unchanged.**
> - **The "closed list" claim is narrowed to what can honestly be claimed.** Mack enumerated **all 216 scheduled tasks**, every Run/RunOnce/RunOnceEx/RunServices/Policies hive, WMI permanent subscriptions, Winlogon, `cmd.exe` AutoRun, Group Policy scripts, four PowerShell profiles and the Git Bash profiles: **no eighth registered machine route exists.** **But `C:\.fusion247` itself cannot be enumerated under any grant** — prohibition #3 forbids listing it, and `run-tower-watcher.ps1:27` references a `C:\.fusion247\tower-ding.mjs` that appears in **no** investigation to date. **The evidence file must say: every automatic/registered route is enumerated and closed; unregistered scripts at the secrets root are the paste-to-resurrect class and are un-enumerable under the current grant.** Not *"closed list, complete"*.
> - **Read-to-verify is INSIDE the exception.** Mack named the tension rather than burying it. Confirmed: *"the exact named exception needed to remove"* includes reading those two files to confirm the kill premise — **because the deletion cannot be safely performed at all if the premise is unconfirmable.**
> - **Clerical:** map §14.14 says *"five machine-level removals"* and lists four. **Four is correct.** Map corrected.
> - **Instrument disagreement, recorded:** `Get-ScheduledTaskInfo` reported a `NextRunTime` while `schtasks /Query /V` reported `N/A / Disabled` **for the same task at the same minute**. **Treat `schtasks` as authoritative for A3 and record both.**
> - **Keel is not writing under `Deliverables/proofline/`** — confirmed; no collision.
>
> **Proceed on a fresh read-back.**

---

| Field | Value |
|---|---|
| **status** | ISSUED |
| **issued / issued_by** | 2026-08-05 / Larry |
| **owner** | **Mack** |
| **governance_head** | `ff43b67dc3770ef0a0fef88cb0fe87964db7ece1` |
| **authorised_by / date** | **Warwick, 2026-08-05, in his own words — map §14.13 D-B.** This order exists *because* Keel's contract bars this work and Warwick confirmed the seam: *"route the live machine-level removal through Mack where that is the correct contract boundary"* |
| **map** | `Deliverables/2026-08-04-proofline-wayfinder-plan.md` — **§14.9 (the enumeration), §14.9a (why the first order was refused), §14.13 (Warwick's authorisation and its three conditions). Read all three** |
| **branch** | `build-020/machine-legacy-removal`, cut from `ff43b67` or later on `build-020/live-trial`. **Its only repo content is the evidence file** |
| **file_surface** | `Deliverables/proofline/` — one new evidence file. **Nothing else in the repo** |
| **machine_surface** *(closed list — four targets)* | `C:\Users\Buggly\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\mypka-tower-cp-watcher.vbs` · `C:\.fusion247\run-tower-cp-watcher.ps1` · `C:\.fusion247\run-tower-watcher.ps1` · scheduled task `FusionTowerBatonWatcher` |
| **private_surface** | 🔐 **`C:\.fusion247\run-tower-cp-watcher.ps1` and `C:\.fusion247\run-tower-watcher.ps1` — THESE TWO EXACT PATHS ONLY, DELETE ONLY.** Under **Warwick's named GL-012 exception of 2026-08-05**, which is the sole authority for touching anything at that root. **It extends to nothing else: not the root, not siblings, not parents, not any `.env`, not `.env keys\`, not `private/`.** GL-012 otherwise permits only `private/<project>/**`, and these paths sit at the root — **which is exactly why this needed Warwick and not a redraft** |
| **credential_scope** | none. **Never open, print, log or echo any `.env` or secret value** |
| **live_authority** | **BOUNDED — the four enumerated machine targets, deletion/deregistration only.** Nothing else |
| **network** | none |
| **acceptance_property** | **All four targets are gone, every remaining start path fails when attempted, and the live watcher PID 31268 is alive with its log still advancing at both start and end** |
| **veritas_gate** | Phase 2 gate (§14.0c) — **this order is the primary evidence for S-2** |
| **integration_owner** | Larry |
| **document_impact** | one new evidence file under `Deliverables/proofline/` — **owner: mack** |
| **out_of_scope_policy** | report-only |
| **operational_handoff** | none — removal, not a new service |
| **blocking_dependencies** | none. **`WO-...-03` (Keel) runs concurrently on `services/tower-baton/**` and `Deliverables/**`; `WO-...-02` owns `services/control-plane/**`. Do not cross into either** |
| **return_to** | Larry |

## 🔴 FOUR HARD PROHIBITIONS

1. **NEVER EXECUTE `C:\.fusion247\run-tower-cp-watcher.ps1`.** Not to test it, not to see what it does, not "safely". Its line 23 is a `Stop-Process -Force` over every node process matching `*tower-loop*watcher.mjs*` — **which matches the LIVE watcher, PID 31268.** Running it kills the current runtime and starts a 22-July stale copy against the live database. **Read it if you must; never run it.** *(No one has independently re-read it — Keel declined because the grant was invalid. **You now have a valid grant for that exact file, so confirm this premise yourself before deleting.**)*
2. **NEVER delete or modify `C:\.fusion247\tower-baton.env`** — Warwick's condition C-2. It is consumed by the **current** Codex-QA route (`tower-loop/mergeCheck.mjs:142-143`, `tower/merge-check.mjs:8`) for the Telegram token. Deleting it breaks TowerBot verdict delivery **silently**, because that mirror is documented as best-effort and non-blocking.
3. **NEVER touch anything else under `C:\.fusion247\`.** The exception is two paths. The root holds ~15 `.env` files and a `.env keys\` directory.
4. **NEVER disturb the live watcher PID 31268** — do not stop, restart, or signal it.

## Outcome owed

**No legacy Tower watcher can be started from any machine-level route on this box — proven by attempting each route and having it fail — with the current runtime demonstrably untouched throughout.**

## The four targets

1. **Delete the Startup VBS.** The only automatic route to the stale copy. It is an **active** registration — `Win32_StartupCommand` reports it, and `StartupApproved\StartupFolder` holds **no** disable flag for it.
2. **Delete `run-tower-cp-watcher.ps1`.** **Delete — not "neutralise".** v1 offered both and it was a defect: a neutralised file still exists, and a later attempt-proof would then *execute* it. It is documented as *the* launcher at `Deliverables/2026-07-23-pr58-closure-evidence.md:105`, so a paste from a Deliverable resurrects it.
3. **Delete `run-tower-watcher.ps1`.** ⚠️ **Its provenance is UNEXPLAINED** — created *and* last written `2026-08-02 05:23:53`, the same date as the disabled task's daily-trigger boundary. **Something set it up on 2026-08-02 and then disabled it, and nobody has explained what.** Warwick has authorised removal, so it proceeds — but **record what you find about it**, and if the pre-deletion check suggests it is in use, **STOP and report** rather than proceeding.
4. **`Unregister-ScheduledTask FusionTowerBatonWatcher`.** It is currently *Disabled* with **both triggers still `enabled=True`** (logon **and** daily). **Disabled is reversible; deleted is not.** The daily trigger means re-enabling would need no logon at all.

## Warwick's condition C-1 — a live check IMMEDIATELY BEFORE deletion

> *"Confirm immediately before deletion that neither is used by the current Tower runtime."*

**Not from this map, not from a prior investigation — executed at deletion time.** Establish that the live watcher was not launched by either script and does not depend on them. Known supporting evidence to re-verify rather than trust: the live `WATCHER_ID` is `WARWICK_YOGA#cp#…` (the `run-watcher.mjs` format), whereas the PS1 stamps `YOGA_CP#…`; and the PS1's log target has not been written since 2026-07-24. **Re-execute both.**

## The attempt-proof — this IS the acceptance evidence (S-2)

**A hard mechanical gate first, then attempts.** Keel's analysis, adopted:

- **A0 — GATE.** `Test-Path` must be **false** for all three file targets **before any attempt command is issued.** If any is still present, **STOP** — an attempt against a surviving `run-tower-cp-watcher.ps1` would kill the live watcher.
- **A1** — capture the live watcher's PID and `WATCHER_ID` from `~/.mypka/tower/logs/watcher.log` **first**. Every later step re-asserts this exact PID. **That assertion is the "did not disturb the runtime" evidence.**
- **A2** — attempt `powershell -File` on each deleted `.ps1` by absolute path. Expect *file not found*. **The `wscript` attempt on the VBS is STRUCK** — `WScript.Shell.Run(..., 0, False)` returns immediately and surfaces no error from its target, so it proves only that one file is absent, which `Test-Path` already established with no execution risk.
- **A3 — the load-bearing attempt.** `schtasks /Query /TN FusionTowerBatonWatcher` then `/Run`. **Expect "cannot find the file specified" — NOT "task is disabled"**, which would prove only that it is off. This is the one attempt that distinguishes *unregistered* from *merely disabled*.
- **A4** — re-enumerate the Startup folder, `Win32_StartupCommand`, and both `Run` hives; assert **zero** tower entries.
- **A5** — re-assert A1's PID alive and the log still advancing.

**⚠️ Assert on absolute script path and `WATCHER_ID` — NEVER a process-name match.** The concurrent `tower-loop` suite spawns children whose command line is bare `node watcher.mjs`, **indistinguishable by name from a resurrected legacy watcher.** Keel observed two appear and vanish during preflight. A name-based assertion can false-positive **fail**, and a later reviewer could not tell a test child from a resurrection.

**A real logon is the only complete proof of A4. Warwick does not require restart testing (map §14.0b), so name it as the one residual unproven step — never quietly skip it.**

## Acceptance evidence

Every command and its **real pasted output**, per step, including the C-1 pre-deletion check and the A0 gate. **Write it to a file under `Deliverables/proofline/` and commit it** — evidence that lives only in a report dies with the session, and durability outside a session is this phase's whole point (S-5).

## Read-back gate — MANDATORY

**Return a READ-BACK and HOLD.** Outcome in your own words · method · what this order fails to settle · what looks wrong in it. **Preflight and `REFUSE` if under-specified.** **Three orders in this phase have been refused, every one for a defect in the order rather than in the work, and every refusal improved the build.** An under-specified *removal* order is worse than an under-specified build order.

`export MSYS_NO_PATHCONV=1` before any Windows command. **`schtasks /Query` and `tasklist /FI` are exactly the calls MSYS mangles**, and a mangled instrument here yields a confident wrong *"it's gone"* — the worst possible failure on a removal order.

Git for your branch is yours to execute. You do not decide the merge.
