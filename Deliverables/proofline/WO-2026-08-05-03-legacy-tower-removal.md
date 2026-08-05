# WO-2026-08-05-03 — WP-2A: make the legacy Tower unable to start

> ## AMENDMENT 1 — 2026-08-05. Keel returned `REFUSE` on seven grounds. All seven upheld. **This order is now KEEL'S HALF ONLY.**
>
> **B1 was a discovery that falsified the order, and it is the most valuable thing this build has produced today.** A **seventh** start path — `services/tower-baton/scripts/start-fusion-tower.ps1`, documented as *"the canonical launcher — the only method"* — **survives all six removal targets.** The acceptance property would have been false at the moment it was asserted.
>
> **Four class-A defects were mine and were checkable before dispatch:** `live_authority: BOUNDED` (Keel may act only under `none`) · `Builds/**` in the file surface (its contract permanently bars it; **a Work Order cannot override a contract**) · `private_surface` at the secrets root **for the second time in one session** · and scheduled-task/startup-registration work that is **Mack's** seam.
>
> **Warwick's decisions, 2026-08-05 — map §14.13:** make the seventh path **REFUSE, do not delete**; and a **named GL-012 exception** for the two root `.ps1` files, with three binding conditions. **The machine-level half is now `WO-2026-08-05-04` (Mack). `Builds/**` is Larry's.**

## Amendment 1 — envelope, REPLACING v1's

| Field | Value |
|---|---|
| **status** | ISSUED — AMENDED 1 |
| **governance_head** | `ff43b67dc3770ef0a0fef88cb0fe87964db7ece1` |
| **authorised_by / date** | Warwick, 2026-08-05 — map §14.13 **D-A** |
| **branch** | `build-020/legacy-tower-refuse`, cut from `ff43b67` or later |
| **file_surface** | `services/tower-baton/bin/tower-watch.js` · `services/tower-baton/scripts/start-fusion-tower.ps1` · `services/tower-baton/test/**` (new, if you add coverage) · `Deliverables/2026-07-28-overnight-estate-closure-report.md` · `Deliverables/2026-08-01-pax-reset-challenge.md` · `Deliverables/2026-07-23-pr58-closure-evidence.md` · a new evidence file under `Deliverables/proofline/` |
| **NOT in surface** | ❌ **`Builds/**` — Larry's, per your critical rule 5.** ❌ **`C:\.fusion247\**` — Mack's, under Warwick's named exception.** ❌ the Startup VBS and the scheduled task — **Mack's.** ❌ `services/tower-baton/src/**` — **the negative control's target. Do not touch** |
| **private_surface** | **`none`.** GL-012 **not** engaged for this order |
| **credential_scope** | none |
| **live_authority** | **`none`** — restored to the only value your contract permits |
| **network** | none |
| **acceptance_property** | **`node bin/tower-watch.js` and `start-fusion-tower.ps1` REFUSE to start a watcher, exiting clearly and non-zero, while `services/tower-baton/src/clickupClient.js` remains present and the `control-trap` negative control still passes** |
| **veritas_gate** | Phase 2 gate (§14.0c) — contributes to **S-2** |
| **integration_owner** | Larry |
| **document_impact** | the three `Deliverables/**` paths — **owner: keel** · `Builds/**` — **owner: larry** · the map — **owner: larry** |
| **out_of_scope_policy** | report-only |
| **operational_handoff** | none |
| **dependency_policy** | no new runtime dependencies |
| **blocking_dependencies** | none. **`WO-...-04` (Mack) runs concurrently on machine-level targets. Do not cross.** **`WO-...-02` owns `services/control-plane/**`. Do not cross** |
| **worker_contract** | `Team/Keel - Implementation Engineer/AGENTS.md` @ `ff43b67` |
| **contract_basis** | `services/tower-baton/**` — implementation code, core Keel surface · `Deliverables/**` — *"NOT prohibited wholesale"* · branch git — *"branch and worktree operations; commits and pushes"* |
| **contract_conflicts** | **none — v1's three are removed by re-scoping, not by waiver** |
| **capability_evidence** | `git worktree` authority exercised successfully on `WO-...-01` this session |
| **return_to** | Larry |
| **schema_decision / security_inputs** | n/a |

## Amendment 1 — the outcome, restated

**Not removal. A refusal.** Warwick: *"Make the seventh legacy start path refuse clearly rather than deleting the protected source tree. The outcome is that legacy Tower cannot start, while the negative control remains intact."*

**The guard belongs in `bin/tower-watch.js`, not only the `.ps1`.** The launcher's own header states that invoking `node bin/tower-watch.js` is *"equivalently"* the same route through the same `runtimeConfig` module — so a guard only in the `.ps1` leaves the path open. **Guard both; the `.js` is the load-bearing one.**

**Refuse clearly** — a message naming what is retired and what to use instead (`run-watcher.mjs`), and a non-zero exit. Not a silent no-op: a human who runs it must understand what happened.

## Amendment 1 — `git worktree remove C:\Fusion247PKA-tower` is IN, and verified safe

Your preflight established it loses nothing: clean tree, zero untracked, its one commit ahead of `main` is pushed and contained in `origin/build-014/tower-recovery`, no process holds the directory, admin dir unlocked. **The three stashes live in the shared `.git` and are unaffected — you were right to name them so nobody reads them as collateral.** Proceed, and **re-verify at execution time rather than trusting this paragraph.**

## Amendment 1 — your three questions, answered

**Q1** — you found the seventh path and an eighth (`tower-host-runbook.md` §3–§4). **Both are in the acceptance property now.** The eighth's document lives under `Builds/**` and is **Larry's** to correct.
**Q2** — answered above. Nothing lost.
**Q3** — **you were right on all three counts.** The order said *"delete or neutralise"* while A2 assumed deletion; the `wscript` attempt is evidentially vacuous because `Run(..., 0, False)` returns immediately and surfaces nothing; and once a file is deleted, an "attempt" is ceremony over a predicate. **Adopted:** `Test-Path`-false is a **hard mechanical gate** before any attempt command; delete rather than neutralise; **the `wscript` attempt is struck**; A3 (`schtasks /Run`, which distinguishes *unregistered* from *disabled*) is the load-bearing attempt. **That whole sequence is Mack's order now** — recorded here so the reasoning is not lost.

## Amendment 1 — B2 and B3 resolved

**B2 — the tower-loop suite is STRUCK from your acceptance evidence.** You were right: your surface is markdown plus one `services/tower-baton/` guard, and a change there cannot regress `tower-loop`. Requiring it was a control reporting on ground your change never touches, and it coupled your verdict to WO-02's in-flight state. **Prove the `control-trap` negative control still passes instead** — that is the one that is genuinely on your ground, and it is the whole reason the source tree survives.

**B3 — adopted as a standing rule for this phase.** Assert on **absolute script path and `WATCHER_ID`**, never a process-name match. The `tower-loop` suite spawns children whose command line is bare `node watcher.mjs`, indistinguishable by name from a resurrection.

## Amendment 1 — acceptance evidence

- **The refusal proven BY ATTEMPT:** run both entrypoints, paste the real refusal output and non-zero exit.
- **`src/clickupClient.js` still present**, and the `control-trap` negative control still passing — with its **executed** output.
- `git worktree remove` before/after, plus `git worktree list`.
- `bash scripts/secret-scan.sh --surface <each declared path>` — **`--surface` mode only.**
- **PID 31268 alive and its log still advancing, at start AND end.**

**Proceed if sound — one further read-back only if a material defect remains.**

---

| Field | Value |
|---|---|
| **status** | ISSUED |
| **issued / issued_by** | 2026-08-05 / Larry |
| **owner** | Keel |
| **governance_head** | `c3eb1af1b93f657638fa5521a64e8361f53822bd` |
| **authorised_by / date** | **Warwick, 2026-08-05, explicitly:** *"Verify the legacy Tower is genuinely obsolete, then remove it so it cannot restart or confuse the current runtime."* Map §14.0 **W-2**. This **supersedes** §13.5's parking of legacy retirement |
| **map** | `Deliverables/2026-08-04-proofline-wayfinder-plan.md` — **§14.9 holds the verification, the six targets, the three traps and the attempt-proof design. Read it before planning** |
| **branch** | `build-020/legacy-tower-removal`, cut from `c3eb1af` or later on `build-020/live-trial` |
| **worktree** | Keel creates and owns one. **NOT from `origin/main`** |
| **file_surface** | `Builds/BUILD-010-fusion-tower/Runtime/recovery.md` · `Deliverables/2026-07-28-overnight-estate-closure-report.md` · `Deliverables/2026-08-01-pax-reset-challenge.md` · `Deliverables/2026-07-23-pr58-closure-evidence.md` · a new evidence file under `Deliverables/proofline/`. **NOTHING under `services/**` — that surface belongs to WO-2026-08-05-02, running concurrently** |
| **machine_surface** *(non-repo, authorised removals — enumerated, closed list)* | `C:\Users\Buggly\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\mypka-tower-cp-watcher.vbs` · `C:\.fusion247\run-tower-cp-watcher.ps1` · `C:\.fusion247\run-tower-watcher.ps1` · scheduled task `FusionTowerBatonWatcher` · the linked git worktree `C:\Fusion247PKA-tower` |
| **acceptance_property** | **Every enumerated start path for a legacy Tower watcher fails when attempted, while the live watcher PID 31268 remains alive and its log still advancing** |
| **private_surface** | **`C:\.fusion247\` — WRITE authorised for the TWO named `.ps1` files ONLY.** Not the root, not siblings, not `tower-baton.env`. GL-012 applies. **Never print a secret value** |
| **credential_scope** | none |
| **network** | none |
| **live_authority** | **BOUNDED — removal of the five enumerated machine targets only.** Everything else is `none` |
| **veritas_gate** | Phase 2 gate (§14.0c) — this WP **is** the evidence for **S-2** |
| **integration_owner** | Larry |
| **document_impact** | the four documents in `file_surface` — **owner: keel** · the map — **owner: larry** |
| **out_of_scope_policy** | report-only |
| **operational_handoff** | none — removal, not a new service. No `runbook_path` owed |
| **blocking_dependencies** | none. **Disjoint from WO-2026-08-05-02 by file surface — do not cross into `services/**`** |
| **worker_contract** | `Team/Keel - Implementation Engineer/AGENTS.md` @ `c3eb1af` |

## 🔴 THREE HARD PROHIBITIONS — read before anything else

1. **NEVER execute `C:\.fusion247\run-tower-cp-watcher.ps1`. Not to test it, not to see what it does, not "safely".** Its line 23 is a `Stop-Process -Force` over every node process matching `*tower-loop*watcher.mjs*` — **which matches the LIVE watcher PID 31268.** Running it kills the current runtime and starts a 22-July stale copy against the live database. **Read it; never run it.**
2. **Do NOT delete `C:\.fusion247\tower-baton.env`.** It is consumed by the **current** Codex-QA route — `tower-loop/mergeCheck.mjs:142-143` and `tower/merge-check.mjs:8` fall back to it for `TELEGRAM_BOT_TOKEN` and `AUTHORISED_TELEGRAM_USER_ID`. Deleting it breaks TowerBot verdict delivery **silently**, because the README calls that mirror best-effort and non-blocking. **Keep the file. Remove only the watcher.**
3. **Do NOT delete `services/tower-baton/`.** `tower-loop/test/doubles/graph-probe.mjs:28` resolves `services/tower-baton/src/clickupClient.js` and exits 4 with `CONTROL_TARGET_MISSING` if absent — it is the target of a live **negative control** invoked as `control-trap` by the suite. Removing it would delete a control whose whole job is to fail. **The source tree is a SEPARATE decision and is NOT authorised by W-2.**

## Outcome owed

**A legacy Tower watcher cannot start — proven by attempting every enumerated path and having each fail — with the current runtime demonstrably undisturbed throughout.**

**Absence of code is not the bar.** Three of the four routes point at *paths* and one is a registered OS object. Warwick's words: *"remove it so it cannot restart or confuse the current runtime."*

## The six removal targets (map §14.9 — verify each still exists before acting)

1. Delete the Startup VBS — the only automatic route to the stale copy.
2. Delete or neutralise `run-tower-cp-watcher.ps1` — **it is documented as *the* launcher** in `Deliverables/2026-07-23-pr58-closure-evidence.md:105`, so a paste from a Deliverable resurrects it.
3. **`Unregister-ScheduledTask FusionTowerBatonWatcher`** — it is currently *Disabled* with **both triggers still `enabled=True`**. **Disabled is reversible; deleted is not.** Its daily trigger means re-enabling needs no logon.
4. Delete `run-tower-watcher.ps1` — the task's action target, independently runnable.
5. **`git worktree remove` `C:\Fusion247PKA-tower`** — **NOT a directory delete.** It is a linked worktree of `C:\Fusion247PKA\.git`; removing the directory leaves a dangling admin entry. **Check for uncommitted work there first and report it rather than discarding it.** Its `mergeCheck.mjs` is superseded and it has no `reviewDiff.mjs` at all, so nothing is lost — **verify that rather than trusting it.**
6. **Correct the documents.** `Builds/BUILD-010-fusion-tower/Runtime/recovery.md:81,90,91` instructs a human to `schtasks /Create` the legacy watcher back into existence — **a documented resurrection procedure is a start path with a human in the loop.** The other three still name `-tower` as the merge-check runtime home and would send the next fresh Larry to a stale tree.

## The attempt-proof — this IS the acceptance evidence (S-2)

Run **after** removal, in this order:

- **A1** — capture the live watcher's PID and `WATCHER_ID` from `~/.mypka/tower/logs/watcher.log` **first**. Every later step asserts this exact PID still alive. **That assertion is the "did not disturb the runtime" evidence.**
- **A2** — attempt the Startup path: `wscript.exe` the VBS by absolute path; then `powershell -File` the PS1 by absolute path. **Expect *file not found*.** *(Safe only because both files are gone by then — if either still exists, STOP: removal is incomplete and running it would kill the live watcher.)*
- **A3** — `schtasks /Query /TN FusionTowerBatonWatcher` then `/Run`. **Expect "cannot find the file specified" — NOT "task is disabled"**, which would prove only that it is off.
- **A4** — `node C:\Fusion247PKA-tower\services\control-plane\tower-loop\watcher.mjs`. Expect MODULE_NOT_FOUND / path absent.
- **A5** — re-enumerate the Startup folder and both `Run` hives; assert zero tower entries.
- **A6** — re-assert A1's PID alive and the log still advancing.

**A real logon is the only complete proof of A5. Warwick does not require restart testing (§14.0b), so record it as the one residual unproven step — named, never quietly skipped.**

## Acceptance evidence

Every command and its **real pasted output**, per step. Plus: the tower-loop suite still green after the document changes (`# tests`/`# fail`, **never the exit code**), and `bash scripts/secret-scan.sh --surface <each repo path>`.

**Write the evidence to a file under `Deliverables/proofline/` and commit it.** Evidence that lives only in a report dies with the session — and durability outside a session is the whole point of this phase (S-5).

## Read-back gate — MANDATORY

**Return a READ-BACK and HOLD.** Outcome in your own words · method · what the order fails to settle · what looks wrong. **Preflight and `REFUSE` if under-specified.** This order removes things; an under-specified removal order is worse than an under-specified build order.

`export MSYS_NO_PATHCONV=1` before any Windows command — **`schtasks /Query` and `tasklist /FI` are exactly the calls MSYS mangles**, and a mangled instrument here produces a confident wrong "it's gone".

Git for your branch is yours. You do not decide the merge.
