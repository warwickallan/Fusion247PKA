# Reviewer Adversarial Checklist & Build-Brief Defaults (v1)

**Origin:** RCA of BUILD-014 WP-A (5 Codex+Fable rounds; ~2 avoidable). **Purpose:** make round 1 *exhaustive*, not incremental, and prescribe the robust patterns up front so builds converge in ~2 rounds. **Use:** attach the relevant parts to every Codex + Fable review prompt; embed in the BUILD-014 WP-C reviewer runtime prompt; apply Part 1 to every builder brief.

---

## Part 0 — Universal review directives (every review)
- State your **model identity honestly** (multi-MODEL independence is the point).
- **Default REQUEST_CHANGES** unless genuinely correct *and* complete. Do not rubber-stamp.
- **Adjudicate on the diff / source, not the prose.** Construct/refute each defect concretely.
- On a **re-review**, additionally **hunt NEW defects the fix introduced** (regressions).
- **Verify the test harness ACTUALLY executes** — read the runner + CI: does it run against real infra, or silently self-skip? Is "proven" = executed, or just claimed?
- **Classify every finding** (Part 4): severity + `merge-blocker` / `fold-before-live-apply` / `cosmetic` + core-invariant vs perimeter.

## Part 1 — Build-brief defaults (prescribe UP FRONT — the biggest lever)
1. **Default-deny for any immutability / permission guarantee.** Freeze *everything* except an explicit allow-list (diff-based; auto-skip generated cols). Never enumerate-the-bad (that's the "one more unfrozen column" whack-a-mole).
2. **Proven = EXECUTED IN CI.** A hermetic runner that **fails on 0 executed subtests** + a CI job against a real service container, from the first build. Local "it passed" is not evidence.
3. **Bind state to the FULL identity tuple up front** (e.g. `checkpoint_id + reviewed_commit_sha + build`), never one key — the state-correlation bug class.
4. **Concurrency:** require a **deadlock / lock-ordering analysis + genuine multi-connection tests** for any cross-row/cross-table trigger or claim path.
5. **Canonicalise at the boundary** (e.g. full-lowercase SHA) so downstream comparisons are correct by construction.
6. **No gate-disabled agents / secrets in probes** ([[no-gate-disabled-agents-in-probes]]); review runtimes are tool-less by actually removing tools.

## Part 2 — DB-schema / merge-gate adversarial checklist
- **Wrong-target binding impossible?** Domain/CHECK on canonical form + composite FK so a mis-bound row fails at INSERT (not app logic).
- **Immutability = default-deny** across *every* decision/evidence table, incl. **identity columns (id, created_at)**, **`TRUNCATE`** (statement trigger), `ON DELETE` cascade of evidence, and `DELETE` grants revoked.
- **Terminal states are one-way** (e.g. superseded can't return to live; timestamps non-forgeable, forced `now()`).
- **No duplicate ACTIVE state** — partial unique index scoped correctly (no caller-controlled escape column in the key).
- **Dual-gate**: distinct authoritative vs *cached-external* fields; impossible to show one undifferentiated "approved" when they disagree; moved-head supersession.
- **Roles bound to principals** (the two reviewer slots can't be filled by one identity).
- **RLS genuinely deny-by-default:** `FORCE ROW LEVEL SECURITY`; `BYPASSRLS`/owner/superuser residuals documented; views `security_invoker` + granted only to the service role; `search_path` pinned on *every* function; execute revoked from public.
- **Queue/jobs:** attempt-bounded (`attempts <= max`); claim skips/parks exhausted; completion guarded by lease ownership; atomic `SKIP LOCKED` claim.
- **Append-only ledger** reconstructs the full lifecycle; corrections are new events.
- **Concurrency:** trace both lock orders; no silently-inconsistent commit (a clean deadlock-abort is acceptable, a bad commit is not).

## Part 3 — Service / runtime (worker, queue, adapter) adversarial checklist
- **At-least-once delivery → exactly-once EFFECT** (idempotency keyed properly; duplicate delivery → single effect).
- **Crash recovery:** worker dies mid-lease → reclaimed → completes exactly once → no duplicate effect, no lost baton.
- **No double-execution / no double-post** under concurrency; one job → one worker.
- **Correctness must NOT depend on NOTIFY/Realtime** (wake-hint / dashboard only) — prove polling-only correctness.
- **Process/child hygiene:** timeouts, process-tree reaping, no orphan wedging the loop.
- **Fail-closed** on missing/ambiguous evidence (model-substitution, auth, config).
- **Secrets** never logged/echoed; env denylist to children; least privilege.

## Part 4 — Severity classification + verdict format
Each finding: `severity` (CRIT/HIGH/MAJOR/MED/LOW) **AND** a **disposition**: `merge-blocker` | `fold-before-live-apply` | `cosmetic`, **AND** `core-invariant` vs `perimeter`. Verdict: APPROVE only if no `merge-blocker` survives. This lets Larry triage instantly and never burn a round on a cosmetic. (Larry sets final severity on a split — Codex trends completeness-maximalist, Fable trends exhaustive-tracer-with-judgment.)

## Part 5 — Post-merge RCA (standing — run after EVERY merge)
Brief retro folded into the post-merge report: how many review rounds, which finds were genuine adversarial value vs avoidable process gaps, and one concrete up-front change (build-brief default or reviewer-checklist item) to prevent the avoidable ones next time. Update this checklist + the build-brief defaults with anything new. See [[merge-protocol-pr-integration]], [[build-verify-defaults-from-wpa-rca]].
