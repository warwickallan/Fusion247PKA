# Codex round 1 on PR #103 (`a5f5b5e`) — `request_changes`, three HIGH findings

**2026-08-09.** Tower-visible via `mergeCheck.mjs`, run `da33eb35`, TowerBot 487/488. **Execution 1 of the 3 permitted for this gate.**

> *"CORRECTIONS_REQUIRED. The review packet does not stage the accepted WP-B15-2 criteria or the referenced Veritas receipt, so the claimed eight-criterion PASS cannot be verified. The diff also leaves a reachable failure mode where structurally invalid Terra output produces neither a decision nor an open clarification question, leaving Warwick no actionable answer path. Merge-class Question 2 is additionally unestablished because runtime-dependency and off-repo/private-state evidence were not supplied."*

## F2 — a REAL product defect. Verified by Larry before dispatching the fix.

`runPipeline.js` throws `interpretAnswer returned no structured meaning` when Terra's return is structurally invalid. That throw means **no decision row → caught in `stepReplan` → line unresolved → shop parks at `wait:line_resolution` → `lines_unresolved` card queued.**

**So Warwick gets a card telling him it is stuck, and no question he can answer. A notification is not an answer path.**

**The inconsistency is the tell.** The function's own header says *"unparseable return, unknown kind, or an id the model was never shown"* all become `clarification_required`. **Two of the three do.** Structurally invalid output throws instead — so an unknown *kind* gives him a real round-2 question he can resolve, while a malformed *shape* gives him a dead end. Same underlying situation, two different fates, and only one lets him proceed.

**Dispatched to Keel**, with the instruction to look for siblings: any other throw or early return on this path producing neither a decision nor an open question. Codex found one instance; the class is what matters.

**Neither Veritas nor Larry caught this** across a Gate 1 HOLD, two focused confirmations and a PASS. It took a different model, reading the same diff, to see that two error shapes were being treated as one.

## F1 and F3 — LARRY'S defects, not the builder's

**F1** — the packet described the accepted criteria and the Veritas receipt **in prose** instead of **staging** them, so the eight-criterion PASS could not be independently verified. Round 2 stages both.

**F3** — runtime-dependency and off-repo/private-state evidence were not supplied. **Larry knew that standard** — it is the same check-6 standard met at the 4E boundary — and did not meet it. Gathered now, for round 2:

### Check 6 — runtime dependency evidence, gathered by execution 2026-08-09

**PASS: zero LIVE DEPENDENCIES on superseded checkout roots across executable path, command line and loaded-module paths.**

Surfaces inspected: (A) every `node.exe` process via `Win32_Process` — both `ExecutablePath` and full `CommandLine` — scanned for `Fusion247PKA-b15`, `Fusion247PKA-wp-b15-2`, `Fusion247PKA-wo-c3`, `external-repair`, `recovery`; (B) the loaded-module path list of every node process; (C) every registered scheduled task's `Execute`, `Arguments` and `WorkingDirectory`.

Results: **15 node processes, ZERO referencing any BUILD-015 worktree.** Zero loaded-module paths under any superseded root. All three Fusion247PKA-referencing scheduled tasks — `MyPKA-AsdAIr-Runtime`, `MyPKA-Directus-Live`, `MyPKA-YouTube-Watcher-Ensure` — run from the **canonical** checkout. The live AsdAIr runtime (PID 3704) runs `C:\Fusion247PKA\services\asdair\pipeline\runtime.js`, canonical.

**Known evidence limit, stated wherever this evidence is presented:** `Win32_Process` does not expose process working directory, so a dependency existing solely through a process cwd is not directly observed by this probe.

### Check 8 — off-repository and private canonical state

Three approved off-repo stores bear on this change, none superseded: `C:/.fusion247/*.env`, the private secrets store under GL-012, consumed via `--env-file`, with no credential in the diff and the surface scan clean; the **live household Postgres**, where **migration 017 is authored and NOT applied**; and the Fusion gateway, which resolves `gpt-5.6-terra` — **configuration on the box that this repository cannot see**, which is why the alias is resolved at call time and recorded in `interpreted_model`.

## Disposition

F2 → corrective dispatch, in flight. F1 and F3 → Larry, corrected for round 2. **No re-review is being requested for the parts already passed.**
