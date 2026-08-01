---
ticket: T-18
build: BUILD-018
kind: evidence
date: 2026-08-01
private_surface: none
---

# T-18 evidence — Windows-safe atomic write

All proofs below were **executed**, not reasoned about. Numbers in this document are
measurements taken on this machine (Windows 11, Node v22.18.0, worktree
`C:/Fusion247PKA-governor`, branch `build-018/session-governor`), not estimates.

Work Order: `Deliverables/BUILD-018-session-governor/tickets/T-18-windows-safe-atomic-write-work-order.md`
(WO-2026-08-01-01). Keel returned a **CLARIFY** read-back; Larry answered with an
**amended** Work Order. Per SOP-022 an amended order is itself the authorisation, so
this build did not require a second read-back. The four contradictions and three open
points, and how they were settled, are recorded in the order's own AMENDMENT section.

**Builder self-test evidence — NOT independent review.**

## 1. Deliverable

- `tools/governor/atomic-write.mjs` — the ONE shared primitive.
  `atomicWriteFileSync(filePath, payloadOrProducer, opts)`, plus the exported policy
  constants `RETRYABLE_ERROR_CODES` / `MAX_ATTEMPTS` / `RETRY_BUDGET_MS` / `BACKOFF_MS` /
  `BACKOFF_JITTER` and the helpers `isRetryableError`, `backoffDelayMs`, `sleepSync`.
- `tools/governor/atomic-write.test.mjs` — 19 tests.
- `tools/governor/health-store.mjs` — `writeHealthSample` rewired; header claim corrected.
- `tools/governor/delegation-gate.mjs` — `atomicAppendRecord` rewired.

## 2. The mechanism — corrected diagnosis (AMENDMENT C2)

The `EPERM` is driven by a concurrent **READER** holding the target open across the
rename, not by writer-versus-writer contention. Measured pre-change:

| shape | writer failures | orphaned temps |
|---|---|---|
| 48 concurrent writers, no readers | 1 / 48 (2.1%) | 1 |
| 48 concurrent writers, no readers (rerun) | 1 / 48 (2.1%) | 1 |
| 24 writers + 24 concurrent readers | 4 / 24 (16.7%) | 4 |
| 16 writers + 16 concurrent readers | 7 / 16 (43.8%) | 7 |

This explains the asymmetry between the two callers: `atomicAppendRecord` reads its own
target on every call and so manufactures the contention that breaks it, which is why the
delegation-gate suite was the flakier of the two at only 12 concurrent processes;
`writeHealthSample` never reads its target. **A writers-only probe would have moved
1/48 → 0/48 and been called proven.** It would have been worthless.

Orphan count equalled failure count 1:1 in every scenario — which is what makes the
surviving-temp count the one witness independent of any writer's self-report.

## 3. Baseline, pre-change (HEAD `4815b85`)

| command | result |
|---|---|
| `node --test "tools/governor/delegation-gate.test.mjs"` × 12 | **9 pass / 3 fail** (25%). Always the same subtest: `CONCURRENCY: N concurrent appender processes never produce a torn or corrupt ledger file`, always `EPERM ... rename ... .tmp-… -> T-concurrent.jsonl` |
| `node --test "tools/governor/health-store.test.mjs"` × 6 | **5 pass / 1 fail** (17%) — this suite was flaky too (AMENDMENT C3) |
| `node --test "tools/governor/*.test.mjs"` | 588/588, exit 0 — a lucky run, not a stable one |

## 4. Acceptance criteria

| AC | Met | Evidence |
|---|---|---|
| AC1 — one primitive, named exported policy constants | **Met** | `atomic-write.mjs` exports the policy; both callers import it; neither retains a `writeFileSync`+`renameSync` pair (`grep` for both in the two callers returns nothing). Test 1 asserts the constants and their frozenness; test 2 asserts the worst-case budget against **literals held in the test**, not against the module's own numbers |
| AC2 — retry the three transient codes only | **Met** | Tests 6–9. Each of `EPERM`/`EBUSY`/`EACCES` retried to exhaustion (attempts === `MAX_ATTEMPTS`); `ENOENT`/`ENOSPC` and a bare `Error` with no `.code` rethrown on **attempt 1** with **zero** sleeps |
| AC3 — no orphaned temp on ANY path | **Met** | Tests 12–14, plus the probe in §6: **0 orphans in every post-change scenario, including the ones where writers still failed.** Cleanup failure does not mask the original error (test 14: caller sees `EPERM`, not the `EACCES` from the failing unlink) |
| AC4 — concurrency proof that goes RED on the current code | **Met** — see §5 for the honest boundary | Tests 17–19 |
| AC5 — mutation, both directions | **Met** | Test 10 (3 forced `EPERM`s → succeeds on attempt 4, payload verified on disk, no temp left). Test 11 (permanent `EPERM` → throws with the real code, returns nothing, no target file, no temp left) |
| AC6 — no regression, test files unmodified | **Met** | `git diff --stat` on both test files is **empty**. `health-store.test.mjs` 8/8 × 6 runs; `delegation-gate.test.mjs` 60/60 × 8 runs; full suite 607/607 |

## 5. AC4 — what the proof establishes, and its boundary

The AC4 test runs 16 real writer processes against 16 real reader processes on one
target and asserts all four required things: `results.length === N` with N a literal
≥ 16 (closing the `Promise.all([])` hole), `successCount === N` (never `> 0`),
`orphanedTmpCount === 0`, and that the surviving file is one writer's complete output.

**The counters were made to fail before any green from them was cited.** Two variants
run through the *same* harness: forcing a permanent rename failure drives
`successCount` to **0**, and additionally disabling cleanup drives the orphan counter to
**80** (`N × MAX_ATTEMPTS`). A counter that a forced failure cannot move measures
nothing.

### A contradiction in the order, reported rather than silently resolved

**AC4 clause 5 asks this variant to assert "orphan count non-zero", but AC3 requires a
permanent failure to leave ZERO temp files.** Both cannot hold at once: clause 5 was
written against the pre-fix behaviour, in which a failed rename orphaned its temp — which
is precisely what AC3 abolishes. The intent of clause 5 is that both counters be shown
capable of reporting failure, so it is satisfied by **two** variants rather than one (the
second disables cleanup to prove the orphan counter is live). Flagged for Larry; not
resolved unilaterally in the criterion.

### The boundary — stated, not implied

A bounded retry can only bridge a contention window shorter than its own budget.
Measured across reader intensities (16 writers + 16 readers, 3 reps each,
`maxAttempts` toggled in one harness):

| reader burst | reader lifetime | no retry | with retry |
|---|---|---|---|
| 400 back-to-back reads | ~1500 ms | 5, 4, 8 failures | **4, 2, 6 failures** |
| 150 reads | ~1280 ms | 4, 3, 0 | 0, 0, 0 |
| 60 reads | ~1100 ms | 0, 3, 1 | 0, 0, 0 |
| 25 reads | ~1020 ms | 5, 3, 0 | 0, 0, 0 |

**Under readers hammering the target continuously for well over a second, writers still
fail 2–6 of 16 even with the retry, and no policy inside the 250 ms ceiling can fix
that.** The ceiling was not raised (M2/M3 forbid it); the limit is reported instead.
The AC4 test uses a 25-read burst, which is already far more aggressive than the real
callers — `status-line.mjs` reads the health sample once per invocation and
`delegation-gate` reads its ledger once per tool call.

An unjittered backoff left 2 of 12 runs with a failed writer at the 150-read intensity,
because every contending writer backed off on the identical schedule and retried in
lockstep — a thundering herd of the module's own making. `BACKOFF_JITTER` was added for
that measured reason. Worst case remains inside the ceiling:
`sum(BACKOFF_MS) × (1 + BACKOFF_JITTER) = 150 × 1.5 = 225 ms ≤ 250 ms`.

## 6. The reader-contended probe — before / after (required evidence)

Against the **real `writeHealthSample`**, 16 writers + 16 readers, 4 repetitions,
temp directories only. "Before" was produced by reverting `health-store.mjs` to its
committed state via `git checkout --` and restoring it afterwards.

| shape | BEFORE | AFTER |
|---|---|---|
| readIters=400 | 6f/6orphan, 6f/6orphan, 7f/7orphan, 11f/11orphan | 1f/**0**, 5f/**0**, 5f/**0**, 1f/**0** |
| readIters=25 | 0f/0, 2f/2orphan, 8f/8orphan, 1f/1orphan | **0f/0, 0f/0, 0f/0, 0f/0** |

**The orphaned-temp defect is eliminated on every path, including the paths where a
writer still fails.** That is the half of D-5 that accumulated permanently and had to be
cleaned by hand.

## 7. Mutation-testing the new suite itself

The source was deliberately broken four ways and the suite re-run each time
(source restored and byte-verified identical afterwards):

| mutation | suite result |
|---|---|
| remove the `finally` temp cleanup | 15 pass / **4 fail** |
| retry every error, not just the three codes | 16 pass / **3 fail** |
| call the payload producer once (stale snapshot replay) | 18 pass / **1 fail** (the M1 test) |
| default `MAX_ATTEMPTS` to 1 — i.e. the pre-fix behaviour | 15 pass / **4 fail**, including the AC4 concurrency test |

The last row is AC4's headline requirement met directly: **the concurrency test goes RED
on no-retry behaviour.** It is probabilistic at that intensity (the deterministic
discrimination is the injected variant in §5), so it is reported as what it is.

## 8. Commands executed

| command | exit | result |
|---|---|---|
| `node --test "tools/governor/atomic-write.test.mjs"` | 0 | **19/19**, 19 executed subtests |
| `node --test "tools/governor/health-store.test.mjs"` × 6 | 0 ×6 | 8/8 every run |
| `node --test "tools/governor/delegation-gate.test.mjs"` × 8 | 0 ×8 | 60/60 every run (was 9/12) |
| `node --test "tools/governor/*.test.mjs"` | 0 | **607/607**, 13 suites (588 baseline + 19 new) |
| `git diff --stat` on both protected test files | 0 | empty — byte-unmodified |
| `bash scripts/secret-scan.sh --surface <5 declared paths>` | **0** | SCANNED 11 files of the named surface, 0 secrets |

## 9. Out-of-scope findings (REPORTED, not fixed)

Three further sites carry the identical unretried `writeFileSync` + `renameSync` pair
and are **outside this Work Order's surface** (AMENDMENT C4):

- `tools/governor/build-registry.mjs:275` (`writeRegistry`) — MEDIUM
- `tools/governor/programme-state.mjs:630` (`writeProgrammeState`) and `:638`
  (`atomicWriteText`, the §10 write-back / MAP entrypoint) — MEDIUM, the most
  load-bearing of the three
- `tools/governor/qa-binding.mjs:288` — MEDIUM, and it **already carries the same false
  "two concurrent writers never interleave" comment copied verbatim** at lines 282–284.
  That drift is the argument for having extracted one primitive rather than patching two.

Each is a one-line change to call `atomicWriteFileSync`, but a fix ticket must not sprawl
into the build's most load-bearing module.

## 10. Not verified / known limitations

- **Windows only.** The `EPERM`-on-rename behaviour is a Windows sharing semantic; the
  retry is harmless elsewhere but its value is unproven on POSIX.
- **Sustained contention exceeding the budget is not solved** and by design cannot be —
  see §5. A caller under that load still sees a thrown error, which both callers already
  handle (health-store's loss degrades to BLIND/stale per AD-3; delegation-gate fails
  open per INV-2).
- **A last-write-wins target cannot evidence N distinct landed renames.** The strongest
  available claim is three witnesses: all N processes exited 0, zero temp files survive,
  and the injected-failure variant drives both to their failing values.
- **`content-class` secret detection over an arbitrary surface is not confirmed landed**
  (GL-012 §5a); the clean exit 0 above does not evidence that class.
- These are builder self-tests on a disposable local target. **Not independent review,
  not operational acceptance.** No hook was activated; `install-hooks.mjs` is untouched.
