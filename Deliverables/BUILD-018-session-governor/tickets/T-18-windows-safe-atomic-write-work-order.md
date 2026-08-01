---
# --- identity and authority ---
name: T-18 Windows-safe atomic write
work_order_id: WO-2026-08-01-01
build: BUILD-018
wp_number: n/a
status: amended
authorised_by: Warwick
authorised_date: 2026-08-01
owner: keel
return_to: larry
blocking_dependencies: []
tags: [build-018, t-18]

# --- scope ---
outcome: >
  The TWO concurrent-path callers — health-store.mjs (T-02) and delegation-gate.mjs (T-16) — share ONE
  atomic-write primitive that retries a transient Windows sharing failure (EPERM/EBUSY/EACCES) with
  bounded backoff instead of throwing on the first attempt, and never leaves an orphaned temp file on
  any path. The three OTHER sites carrying the same unretried pattern (build-registry.mjs,
  programme-state.mjs x2, qa-binding.mjs) are OUT OF SCOPE and report-only — see AMENDMENT C4.
file_surface:
  - tools/governor/atomic-write.mjs
  - tools/governor/atomic-write.test.mjs
  - tools/governor/health-store.mjs
  - tools/governor/delegation-gate.mjs
  - Deliverables/BUILD-018-session-governor/evidence/T-18-windows-safe-atomic-write.md
out_of_scope_policy: report-only

# --- authority (standing defaults) ---
credential_scope: none
live_authority: none
network: none
dependency_policy: no-new-runtime-deps
private_surface: none

# --- environment ---
worktree: C:/Fusion247PKA-governor
branch: build-018/session-governor

# --- inputs and handoffs ---
schema_decision: n/a
security_inputs: n/a
operational_handoff: none
runbook_path: n/a
---

## The defect — measured, not theorised (D-5)

Both `health-store.mjs`'s `writeHealthSample` and `delegation-gate.mjs`'s `atomicAppendRecord` do:

```
writeFileSync(tmpPath, payload)   // unique temp name, per-writer
renameSync(tmpPath, filePath)     // <-- no retry
```

On Windows, `rename` onto an **existing** target throws `EPERM` when another process holds that target
open. **Measured by Larry on 2026-08-01, against the real modules:**

- `health-store`: **21 of 48 writer processes failed (44%)** under 16 concurrent processes.
- `delegation-gate`'s own `CONCURRENCY: N concurrent appender processes never produce a torn or corrupt
  ledger file` test: fails **roughly 2 runs in 5** when run in isolation.
- **Every failed rename orphaned its temp file permanently** — 21 accumulated in the real health store
  during the probe and had to be removed by hand.

**Read this next part carefully, because it is the part that matters most.** T-02's evidence cites a
"12-process concurrent-write mutation test" as proof of concurrent-write safety. What that test
actually established is that the file is never **torn** — which is true, and remains true. It never
established that concurrent writers **succeed**. **Do not repeat that error in this ticket.**

**Direction of harm is safe but not nil.** A lost health sample degrades to BLIND/stale (AD-3); a lost
delegation checkpoint undercounts toward a *missed* deny (a discipline gate). Neither fails dangerously
today. But **T-03's sampler is intended to run on every assistant message from the live statusLine** —
exactly the high-concurrency path this primitive fails on — so the hit rate rises sharply the moment
that wiring is activated. This is why it is being fixed now rather than filed.

## Acceptance criteria

AC1 — **One primitive, not two.** `tools/governor/atomic-write.mjs` exports the shared atomic write.
`health-store.mjs` and `delegation-gate.mjs` both call it. Neither retains its own `writeFileSync` +
`renameSync` pair. The retry policy must be a **named, exported constant set** (attempts, backoff, and
the retryable error-code list) so a reviewer can read the policy in one place — the `SIGNAL_KEYS` /
`GIT_LIFECYCLE_OPERATIONS` precedent.

AC2 — **Bounded retry on transient sharing errors only.** `EPERM`, `EBUSY`, `EACCES` are retried with
backoff, up to a bounded attempt count. **Any other error code is rethrown immediately, not retried** —
a genuine `ENOENT` or `ENOSPC` must not be masked by a retry loop that eventually gives up and reports
something misleading.

AC3 — **No orphaned temp file on ANY path.** Success, retry-then-success, and permanent failure must
all leave zero `.tmp-*` files behind. Cleanup belongs in a `finally`, and a cleanup that itself fails
must not mask the original error.

AC4 — **A concurrency proof that goes RED on the current code.** *(REWRITTEN by amendment — the
original wording was satisfiable by the unfixed code. See AMENDMENT C1.)* The single test that decides
whether this ticket worked. It must:

1. **Contend with concurrent READERS, not writers alone.** Writers-only measures ~1–2% and a
   1/48 → 0/48 "improvement" is inside the noise. Reader contention is the actual mechanism
   (AMENDMENT C2).
2. `assert.equal(results.length, N)` with **N a literal ≥ 16** — closes the `Promise.all([])` hole
   where a spawn loop that never ran resolves green over nothing.
3. `assert.equal(successCount, N)` — **`=== N`, never `> 0`.** Every writer exits 0 or the suite fails.
4. `assert.equal(orphanedTmpCount, 0)` — **the assertion that does not depend on any writer's
   self-report.** A swallowed failure still leaves its temp file behind, and cannot remove it without
   having actually succeeded.
5. **Made to fail before it is cited** (AC5b's injected permanent failure through the *same* harness):
   assert `successCount === 0` and orphan count non-zero there. **Do not report a passing AC4 without
   also reporting that variant failing** — a counter that a forced permanent failure cannot drive to
   zero measures nothing, and every green above it is worthless.

**State the residual honestly and no higher:** on a last-write-wins target there is no way to prove N
distinct renames each landed. Three witnesses is the strongest available claim — all N exited 0, zero
temp files survive, and the injected-failure variant drives both to their failing values.

AC5 — **Proven by mutation, both directions.** (a) A forced transient `EPERM` on the first N attempts
is retried and ultimately **succeeds** — proving the retry is real and not decorative. (b) A rename
that fails **permanently** still reports failure honestly, never silently reports success, and still
leaves no temp file. Both must be forced by injection, not waited for.

AC6 — **No behavioural regression in either caller.** `health-store.test.mjs` (8/8) and
`delegation-gate.test.mjs` (60/60) pass **unmodified** — you may not edit either test file to
accommodate the refactor. If a test genuinely must change, STOP and return PARTIAL naming it; a test
edited to fit the code is critical rule 9.

## AMENDMENT (2026-08-01) — issued in response to Keel's CLARIFY read-back

**Keel returned CLARIFY and was right on every point. Recorded, because the reasoning is load-bearing.**

- **C1 — the original AC4 was satisfiable by the unfixed code.** Keel measured **47 of 48 writers
  succeeding against today's broken `writeHealthSample`**: 47 > 0, and 47 equals the number reporting
  success, so a test written to the original letter would have gone **green on the defect it exists to
  catch** — the same class of error as T-02's, one layer up, this time written by Larry. AC4 is
  rewritten above. Larry's error, caught by the worker, before implementation.
- **C2 — the mechanism is READER contention, not writer-vs-writer.** `EPERM` is driven by a concurrent
  *reader* holding the target across the rename. `writeHealthSample` never reads its target (writers
  alone: ~2%); `atomicAppendRecord` reads on every call, which is exactly why the delegation-gate suite
  is the flakier of the two. With readers added, health-store lands at **43.8%** — reproducing Larry's
  44%. **The Required Evidence probe shape is corrected below**; the original would have produced
  ~1/48 → 0/48 and called it proven.
- **C3 — `health-store.test.mjs` is flaky too** (1 failure in 6 isolated runs, pre-change). The order
  demanded ≥5 repeat runs for `delegation-gate.test.mjs` and then a single run for the other flaky
  suite. Corrected below.
- **C4 — FIVE sites carry the pattern, not two**: `health-store.mjs:57`, `delegation-gate.mjs:~415`,
  `build-registry.mjs:275`, `programme-state.mjs:630` **and** `:638`, `qa-binding.mjs:288`. The outcome
  sentence claimed the whole estate and is narrowed to the two concurrent-path callers this surface
  permits. **The other three stay report-only and out of scope** — a fix ticket must not sprawl into
  the build's most load-bearing module. Note for the record: `qa-binding.mjs:282-284` already carries
  the same false "two concurrent writers never interleave" comment copied verbatim, which is the drift
  that justifies extracting one primitive rather than patching in place.

**Larry's decisions on the three open points Keel correctly refused to settle alone:**

- **M1 — retry semantics for the read-modify-write. Keel's recommendation is ACCEPTED.** Retrying the
  rename with a *stale* snapshot would let another writer's records be discarded by a later successful
  rename — converting "lose my one record" into "lose several", i.e. **increasing** undercounting, the
  exact direction `delegation-gate.mjs`'s fail-direction doctrine cares about. **The primitive takes an
  optional payload PRODUCER, re-invoked per attempt**; `delegation-gate` passes one that re-runs the
  whole read-modify-write, `health-store` passes a constant. Correctly identified as a semantic change
  a worker must not choose alone.
- **M2 — retry policy: 5 attempts, total budget ≤ 250 ms**, exported as named constants with the
  retryable code list. Backoff shape is Keel's choice within that ceiling.
- **M3 — YES, the sleep must be synchronous** (`renameSync` inside a PreToolUse hook; zero-dep, so
  `Atomics.wait` on a `SharedArrayBuffer`). The **250 ms ceiling in M2 is set by exactly this
  constraint** — AD-19's reasoning is that a gate which gets in the way gets removed, and a hook that
  blocks longer than that is in the way. If the ceiling proves unreachable, STOP and report; do not
  raise it.
- **A2 — model mismatch noted and accepted, not silently passed over.** The ledger assigns T-18 to
  Sonnet; you are instantiated on Opus. Larry's call: proceed. The diagnosis is done and the fix is
  well-understood, but the M1 semantics turned out to need real judgement, so the higher tier is not
  wasted. Recorded here rather than left as an unexplained discrepancy.

## Required evidence

- `node --test "tools/governor/atomic-write.test.mjs"` → **>0** executed subtests, verbatim.
- `node --test "tools/governor/health-store.test.mjs"` → 8/8, **test file unmodified** (`git diff`
  empty). **Run ≥5 times consecutively, report every run** — this suite is flaky today too
  (AMENDMENT C3), so one green proves nothing here either. All runs must pass.
- `node --test "tools/governor/delegation-gate.test.mjs"` → 60/60, **test file unmodified**. **Run ≥5
  times consecutively**, report every run's count. All must pass. Baseline for comparison: Keel
  measured 9 pass / 3 fail over 12 runs pre-change.
- **The reader-contended probe** (corrected per AMENDMENT C2 — the original shape does not reproduce
  the defect): **≥16 concurrent writers AND ≥16 concurrent readers** against one health-store target in
  a **temp directory, never the real store at `~/.mypka/governor/health/**`**. Report writer failures
  and orphaned temp counts, **before and after**. Keel's measured "before" on this shape: **7/16 writer
  failures (43.8%), 7 orphaned temps**. Anything left behind must be named so it can be cleaned.
- `node --test "tools/governor/*.test.mjs"` → full suite, before/after (baseline **588/588**).
- `bash scripts/secret-scan.sh --surface <the 5 declared paths>` → exit 0, coverage reported.

## Inputs supplied

- **D-5** in `programme-state.json` and the §10 write-back row in `02-MAP.md` dated 2026-08-01 — the
  full measurement and reasoning. Read both.
- `tools/governor/health-store.mjs` — `writeHealthSample`, and its header comment which currently
  claims concurrent writers "never interleave"; that claim needs correcting to what is actually true.
- `tools/governor/delegation-gate.mjs` — `atomicAppendRecord` (~line 395) and its `CONCURRENCY` test.
- T-14's `discoverWorktreeRoots` extraction is the **precedent for this shape of change**: a bounded
  additive extraction into one shared implementation, proven safe by running the affected module's own
  unmodified test file before and after.

## Explicitly out of scope

- Changing the health-store's on-disk location, filename scheme, or record format.
- Changing the delegation ledger's JSONL format, schema, or Silas's decided record shape
  (`decisions/D-delegation-ledger-schema.md`) — this is a write-mechanics fix only.
- Any change to `worktree-guard.mjs`, `escalation-gate.mjs`, `install-hooks.mjs`, or activation of any
  hook.
- Introducing a lockfile, a mutex, or any new runtime dependency. Retry + cleanup only.
- `programme-state.json`'s `tickets[]`, `02-MAP.md`'s `GOVERNOR:STATUS` block, the write-back log.
