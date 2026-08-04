# WO-2026-08-04-01 — Proofline service core (WP-1)

## Envelope

| Field | Value |
|---|---|
| `work_order_id` | `WO-2026-08-04-01` |
| `status` | ISSUED |
| `owner` | Keel — Implementation Engineer |
| `return_to` | Larry |
| `authorised_by` | Warwick, 2026-08-04 (plan acceptance + "begin implementation") |
| `governance_head` | `d3180118e07b0bab3981de92a57c7a320b042163` |
| `worktree` | `C:\Fusion247PKA-build-020-trial` |
| `branch` | `build-020/live-trial` |
| `contract_basis` | `Team/Keel - Implementation Engineer/AGENTS.md` at the governance head |
| `contract_conflicts` | **One, named and overridden.** Keel's contract says UI is Felix's. **Warwick explicitly ruled on 2026-08-04 that Felix is not engaged and the UI is in this Work Order.** Warwick is source #1 and supersedes. Bar: *clean and usable*, not a design-system deliverable |
| `worker_contract` | Read-back already discharged (`REFUSE`, class-A) and answered by Amendment 1. **This dispatch is to implement.** A brief confirmation that Amendment 1 answers your eight items is expected, then proceed in the same dispatch — Warwick has capped this at one amendment and asked for implementation to begin |
| `private_surface` | **none** — nothing touches `C:\.fusion247\**`. GL-012 not engaged |
| `credential_scope` | none |
| `live_authority` | **none** — you do not perform the first live start. That is Warwick's, at Phase 4 |
| `network` | **none at build time and none at run time.** No install, no fetch, no egress |
| `dependency_policy` | **Zero npm dependencies.** Node v22.18.0 stdlib only. `node:sqlite` is forbidden (experimental — D-3) |
| `schema_decision` | n/a — no database schema. Silas not in the loop |
| `security_inputs` | n/a — Vex is not engaged (Warwick, 2026-08-04). Apply §7 of the map yourself |
| `integration_owner` | Larry |
| `operational_handoff` | **Warwick, as the local operator.** Mack is not engaged — this is a personal local app, and engaging him is scope growth Warwick did not authorise. The runbook is written **for Warwick** |
| `runbook_path` | `services/proofline/RUNBOOK.md` |
| `veritas_gate` | Yes — Veritas against the exact integrated head, after Larry integrates. Your tests are builder evidence and prove nothing about acceptance |
| `document_impact` | The map (`Deliverables/2026-08-04-proofline-wayfinder-plan.md`) is Larry's and **you may not touch it**. `services/proofline/README.md` and `RUNBOOK.md` are yours |
| `out_of_scope_policy` | Anything outside `file_surface` is REFUSED, not widened. Report it and continue |

## `outcome`

A standalone, single-process, zero-dependency Node service at `services/proofline/` that lets Warwick paste text under a key he chooses, and then **prove by execution** — not be told — that: the submission was fsynced to disk before he was acknowledged; a background worker picked it up rather than the request thread; the analysis is a pure function of the text alone and reproducible byte-for-byte; and a job caught mid-flight by an abrupt process kill comes back and finishes **exactly once** on restart. It stops for his approval and will not move past that point on its own.

## `acceptance_property`

**G-1 .. G-11 as restated in §1 of the map**, proven by **T-1 .. T-9 in §8**. The map is the contract; §5 is now exhaustive and leaves nothing to a guess.

Non-negotiable: **assert `# tests` ≥ expected AND `# fail 0`** — never the exit code alone. `node --test` returns exit 0 on zero tests.

## `file_surface`

```
services/proofline/.gitignore            <-- BUILD STEP 1, before any store write
services/proofline/package.json
services/proofline/README.md
services/proofline/RUNBOOK.md
services/proofline/src/**                server, store, worker, recovery,
                                         processor, canonical, config
services/proofline/public/**             index.html, app.js, styles.css
services/proofline/test/**               T-1..T-9 + crash harness helpers
services/proofline/bin/proofline.mjs
services/proofline/scripts/start-proofline.ps1
```

**Explicitly NOT in surface:** root `.gitignore` · `.github/workflows/**` (CI is out of scope, P-6) · `services/cockpit/**` · the Wayfinder map · anything under `Builds/**`.

## Build order — each step provable before the next exists

1. `.gitignore` + `package.json`. **`.gitignore` first — this is a data-leak precondition on a public repository, not housekeeping.**
2. `canonical.mjs` + `processor.mjs` — pure, no I/O, no clock, no locale. → T-2.
3. `store.mjs` — append + `fsyncSync` + replay, torn-tail tolerant, mid-file corruption loud. → T-1, T-7, T-8.
4. `recovery.mjs` — `isOrphaned(job, currentEpoch)` as an **exported pure function, injected** into the worker. This is the seam T-6a/T-6b need.
5. `worker.mjs` — startup recovery **and** the periodic live scan (D-6b — without the live scan the epoch is not load-bearing).
6. `server.mjs` — the §5.5 contract. → T-5.
7. Crash harness — real child spawn, real kill, real restart. → T-3a/b/c/d, T-4, T-6a/b.
8. `public/**` — **clean and usable.** Submit form, job list, detail view with the **durable state timeline** from the journal (G-5), result rendering, approve/reject. Posts `application/json`.
9. `bin/` + `scripts/` launcher.
10. `RUNBOOK.md` (must state: **stop is abrupt on Windows, and that is safe by design** — F-1b) + `README.md`.
11. Full suite with counts asserted, `bash scripts/secret-scan.sh --surface services/proofline`, `git diff --stat` reconciled against `file_surface`, commit.

## Your eight questions — answered

1. **Mandatory fields** — above.
2. **`operational_handoff` / `runbook_path`** — Warwick as operator; `services/proofline/RUNBOOK.md`, in surface.
3. **F-1** — your finding accepted in full. v1's assertion was false and is **deleted**. Build the three proofs: T-3a abruptness control, T-3c durable-write mutation, T-3d fsync-before-ack call ordering. Power-loss survival is never claimed.
4. **D-6a** — **confirmed**: journal-persisted monotonic integer, allocated at startup, **fsynced before any lease**. Plus D-6b: recovery also runs periodically while live.
5. **F-3 / G-3** — **route one.** G-3 is restated to what is true and provable. **Do not build an artificial delay.** State plainly that `processing` is journal-observable, not UI-observable.
6. **§5 gaps** — all settled in §5 of the amended map: two size limits (§5.5), exhaustive tokenisation (§5.2), torn-line replay (§5.6), `text` on the job object (§5.4), `summary` and `counts` defined (§5.4), `failed` semantics and the G-8 boundary (§5.3), `textMatches` on duplicate (§5.5).
7. **`.gitignore`** — in surface, build step 1. **CI is out of scope.**
8. **Stale head** — corrected by me throughout the map (C-3). Governance head is `d3180118…`.

Additionally: **the screenshotted browser walkthrough is Phase 4 / H-2, Warwick's own — not yours.** And **G-11 is not yours to claim**; you build the launcher and runbook and may evidence a disposable detached start, nothing more.

## Git

Commit to `build-020/live-trial` in this worktree when the suite is green and the surface reconciled. **Do not merge. Do not force-push. Do not touch `main`.** Larry sequences; Warwick decides the merge.

## Report back

Executed output pasted in the same message as every claim, or the claim is labelled **BUILT-NOT-VERIFIED**. State plainly which acceptance properties you proved, which you could only partly prove, and which are not yours (G-1 UI render, G-4 across-machines, G-10 zero-egress, G-11).
