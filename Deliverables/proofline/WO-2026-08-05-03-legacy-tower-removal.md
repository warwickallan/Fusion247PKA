# WO-2026-08-05-03 — WP-2A: remove the legacy Tower so it cannot return

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
