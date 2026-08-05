# EVIDENCE — Tower polling rotation and gh-sourced exact-head evidence (WO-2026-08-05-TW3)

**Builder self-test evidence — NOT independent review.**

- **Worker:** Keel (Implementation Engineer)
- **Governance head at dispatch:** `build-020/live-trial` @ `0572745f45e6d06345c52ea2c9ee990e4ac82182`
- **Governance head amended mid-dispatch, by the coordinator, twice — both verified before use:**
  1. Coordinator named `48195d7ff8d1d1f6f42c21d58f4a7d9ff8f4dd97` as the reconciled current head.
     Verified: `git fetch origin build-020/live-trial` resolved `origin/build-020/live-trial` to
     exactly that SHA. `git merge-base --is-ancestor` in both directions showed `0572745` and
     `48195d7` are **not** ancestor/descendant of each other — a genuine history reconciliation
     (rewrite), not a simple fast-forward: several commits share identical messages but different
     SHAs across the two lines (e.g. `97ae284`/`51cd8dc` "Tower: correct 6b12b68's flawed PR
     discovery…"). Sanity-checked the 4 target files (`watcher.mjs`, `gitEvidence.mjs`,
     `mergeCheck.mjs`, `test/run-tower-loop-tests.mjs`) existed at `48195d7` and were structurally
     consistent with what preflight had already read.
  2. By the time the worktree was actually cut, a fresh `git fetch` showed `origin/build-020/live-trial`
     had advanced again, to `edf446473af9062efe219edfe9e0004bde81ac6f` — one commit ahead
     (`edf4464 Backlog: two pre-existing AsdAIr CI failures, deferred, out of Phase 2 scope`),
     confirmed a genuine fast-forward descendant of `48195d7` (`git merge-base --is-ancestor
     48195d7 edf4464` → true), with **zero diff** in the 4 target files between `48195d7` and
     `edf4464`. Built from **`edf446473af9062efe219edfe9e0004bde81ac6f`** — the freshest verified
     head at the moment of worktree creation, consistent with (a strict superset of) what the
     coordinator approved.
- **Worktree:** `C:\Fusion247PKA-wo-tower-rotation`
- **Branch:** `build-020/tower-rotation-and-evidence`
- **File surface actually written** (the coordinator amended the original order to add
  `mergeCheck.mjs`, narrowly, in response to a preflight finding — see "Read-back / preflight
  findings" below):
  - `services/control-plane/tower-loop/watcher.mjs`
  - `services/control-plane/tower-loop/gitEvidence.mjs`
  - `services/control-plane/tower-loop/mergeCheck.mjs`
  - `services/control-plane/tower-loop/test/run-tower-loop-tests.mjs`
  - `services/control-plane/tower-loop/test/gitEvidenceGh.test.mjs` (new)
  - `Deliverables/proofline/EVIDENCE-2026-08-05-tower-rotation-and-evidence.md` (this file, new)

## Read-back / preflight findings (carried into implementation)

Full preflight read the current `pollTargets()` (`watcher.mjs`), `gatherGitEvidence()`
(`gitEvidence.mjs`), all four production callers of `gatherGitEvidence` (`watcher.mjs`
`processTurn`, `mergeCheck.mjs` `runMergeCheck`, `reviewDiff.mjs` `main`, `demo-merge-review.mjs`),
`tower/merge-check.mjs`'s `collectEvidence()`/`headGuard` (the cited prior art), and every existing
test in `run-tower-loop-tests.mjs` and `reviewTooling.test.mjs` that touches either function.

**One material finding, surfaced at read-back and resolved by the coordinator's amendment before
implementation began:** `mergeCheck.mjs` calls `gatherGitEvidence({ cwd, repo, baseSha, headSha,
prNumber })` with no `spawn` injection seam. Two pre-existing tests — `M2` and `M3` in
`run-tower-loop-tests.mjs` — force the evidence-unresolved branch via `cwd: NO_REPO_DIR` (a
non-repo temp dir), explicitly documented as "No network, no `gh` auth, no Codex." Once Gap 2
makes `gatherGitEvidence` prefer `gh` whenever `prNumber`+`repo` are given (which both tests
supply), that specific mechanism no longer forces a fail-closed evidence-unresolved branch — it
would instead attempt a real `gh` subprocess call, breaking the suite's own no-network/determinism
guarantee. The coordinator approved adding `mergeCheck.mjs` to `file_surface` for exactly the
narrow fix proposed: an optional `spawn` parameter, defaulted to the real spawn, passed straight
through to the `gatherGitEvidence` call. `M2`/`M3` now inject a deterministic fail-closed fake
`spawn` (`failClosedGhSpawn`) — see "Files touched" below for the exact diff.

## Gap 1 — polling starvation (`watcher.mjs` `pollTargets`)

**Design.** The existing fixed ranking (in-flight rounds first, then newest-first) is preserved for
`limit - PR_POLL_ROTATE_SLOTS` slots (`PR_POLL_ROTATE_SLOTS = 1`, a literal, same discipline as the
pre-existing `PR_POLL_FAIL_ESCALATE_AFTER`). In-flight rounds are **never** sacrificed for a
rotating slot — the reserved "fixed ranking" portion grows to cover every in-flight PR first
(`rankedSlots = min(limit, max(limit - PR_POLL_ROTATE_SLOTS, inFlightCount))`), and only the
(possibly zero) remainder rotates. The rotating slot(s) pick deterministically from the sorted
overflow list using `tick = floor(now() / PR_POLL_MS) ; start = tick % overflow.length`, where
`now` is a newly-added injectable parameter (defaulting to the real `Date.now`, same pattern as the
pre-existing `spawn`/`detectRepo`/`gh` injectables) — no new store, registry or table; the rotation
index is recomputed from wall-clock time on every call, never remembered between rounds. One tick
per `PR_POLL_MS` matches the cadence `runWatcher`'s own `nextPrPollAt` gate already advances by, so
consecutive production rounds land in different ticks without needing to remember which overflow
PR went last.

**Bounded-rounds proof, stated exactly:** with `limit = 5`, `PR_POLL_ROTATE_SLOTS = 1`, and
`overflow.length` open PRs beyond the fixed-ranked top 4, every overflow PR is polled at least once
within `ceil(overflow.length / 1) = overflow.length` successive rounds.

## Gap 2 — gh-sourced evidence (`gitEvidence.mjs` `gatherGitEvidence`)

**Design.** When `prNumber` and `repo` are both given (and no `paths` pathspec — GitHub's PR-diff
surface has no pathspec equivalent, and no current `prNumber`-passing caller uses one), evidence is
resolved **entirely via `gh`**, in a new `resolveViaGh()` helper:

- **head_sha:** `gh api repos/<repo>/pulls/<N> --jq '{"head":.head.sha,"base":.base.sha}'` — the
  same authoritative REST field `tower/merge-check.mjs`'s `headGuard` already trusts (there via
  `gh pr view --json headRefOid`). A caller-supplied `headSha` that disagrees fails **closed**
  (`head mismatch: … the PR may have moved`), same spirit as `headGuard`'s exact-head chain,
  without re-deriving its full TOCTOU machinery (that's Codex's merge-decision job; this function
  only gathers evidence for one review).
- **base_sha:** an explicit `baseSha` is trusted exactly as the local-git path trusts one.
  **Deliberate, disclosed deviation:** absent one, this resolves the PR's actual base ref via the
  same `gh api` call, rather than the local-git fallback's `head~1` heuristic — `head~1` inherently
  needs a local object to walk (defeats Gap 2 outright) and is also a less correct reading of "the
  PR's base" than the PR's real base ref. Every current production caller (`watcher.mjs`
  `processTurn`, via the checkpoint-turn path) passes `baseSha: null` and `prNumber` together, so
  this is the actual live-path base resolution, not a theoretical corner.
- **changed_files / diff_text:** both via `gh pr diff <N> [--name-only] --repo <repo>` — the same
  tool `tower/merge-check.mjs`'s `collectEvidence()` already proves in production — so they can
  never quietly describe different ranges.
- **`MAX_DIFF_BYTES` truncation:** factored into a shared `truncateDiff()` helper, applied
  identically by both mechanisms — one rule, not two copies that could drift.
- **CI checks (`gh pr checks`):** unchanged, and now shared explicitly by both mechanisms (it was
  already the only `gh` call the local-git path made).
- **Local-git mechanism:** untouched code, used exactly as before whenever `prNumber` is absent
  (the local/dev case, e.g. `reviewDiff.mjs`) or a `paths` pathspec is supplied.

## Required proof — mapped to acceptance criteria

| # | Criterion | Evidence |
|---|---|---|
| 1 | Gap 1: 7+ open PRs, tail PR polled within a bounded, stated number of rounds | `D-ROT1` (9 PRs, `limit=5`, bound = 5 rounds, asserts the full union of all 9 PRs is polled within 5 successive rounds, including the tail PR 9700) — `run-tower-loop-tests.mjs` |
| 2 | Gap 2: disconnected directory + `prNumber` + injected `gh` double → `resolved:true`, correct `changed_files`/`diff_text`, local git never consulted | `test/gitEvidenceGh.test.mjs`, test 1 (fresh `git init` temp dir with unrelated history, real-shaped diff via injected `spawn` answering only `gh`, asserts every launch was `gh`, never `git`) |
| 3 | Control: local-git fallback (no `prNumber`) unbroken | `test/gitEvidenceGh.test.mjs`, test 7 ("CONTROL") — asserts every launch is `git`, never `gh`; **plus** `reviewTooling.test.mjs` re-run unmodified, 31/31 pass (identical to baseline) |
| 4 | Full suite, before/after, `failures=0` | See "Commands executed" below |
| 5 | `secret-scan.sh --surface` | See "Commands executed" below |

Additional proofs beyond the minimum: `D-ROT2` (in-flight round never sacrificed for a rotating
slot, across 6 successive rounds); `gitEvidenceGh.test.mjs` tests 2–6 (CI checks via gh on the
disconnected dir; `changed_files`/`diff_text` same-range guarantee; `MAX_DIFF_BYTES` truncation
over the gh-sourced diff; gh-api-failure fail-closed; head-mismatch fail-closed).

## Commands executed (verbatim, exit codes and salient output)

### Baseline (BEFORE any change), in the fresh worktree

```
$ node services/control-plane/tower-loop/test/run-tower-loop-tests.mjs
...
executed=64 failures=0
RESULT: ALL PASS

$ node --test services/control-plane/tower-loop/test/reviewTooling.test.mjs
# tests 31
# pass 31
# fail 0
```

### AFTER (final, both new tests included)

```
$ node services/control-plane/tower-loop/test/run-tower-loop-tests.mjs
...
  [PASS] D7 — the cap bounds a round, prefers PRs with live rounds, and says so rather than dropping silently
  [PASS] D-ROT1 — 9 open PRs (more than `limit`=5): the TAIL PR is starved no longer — every overflow PR is polled within a BOUNDED, STATED number of rounds
  [PASS] D-ROT2 — CONTROL: an in-flight round is NEVER sacrificed for a rotating slot, across every rotating round
  [PASS] D-TR2 — a TOWER_PR_REPOS-sourced repo composes into the SAME rank+cap as every other source, not a parallel cap
  ...
  [PASS] WH1 — gitEvidence launches EVERY git/gh child with windowsHide:true (injected spawn), on BOTH the gh-sourced and the local-git mechanism
  [PASS] WH3 — ENUMERATION: all 25 child_process call sites under tower-loop carry windowsHide:true
  [PASS] M2 — END TO END, evidence unresolved: the run OPENS, records Larry, then closes `blocked` with rounds=1 — six of the eight statements on the real path
  [PASS] M3 — RESUME: a run interrupted after Larry's message is resumed on the next attempt — one run, no duplicate claim — and a CLOSED run is never resumed
  ...
executed=66 failures=0
RESULT: ALL PASS

$ node --test services/control-plane/tower-loop/test/gitEvidenceGh.test.mjs
# tests 7
# pass 7
# fail 0

$ node --test services/control-plane/tower-loop/test/reviewTooling.test.mjs
# tests 31
# pass 31
# fail 0
```

**Coverage note (executed-subtest counts, per critical rule 2a):** `run-tower-loop-tests.mjs`
executed 66 subtests both times (64 baseline + 2 new: `D-ROT1`, `D-ROT2`); zero-executed would have
been a failure, not a pass. `gitEvidenceGh.test.mjs` executed 7/7. `reviewTooling.test.mjs` executed
31/31 both before and after, byte-identical pass count — the file itself was never touched, and its
result is cited as the AC3 control.

### Secret scan (surface-scoped, per critical rule 15)

```
$ bash scripts/secret-scan.sh --surface services/control-plane/tower-loop/watcher.mjs \
    services/control-plane/tower-loop/gitEvidence.mjs \
    services/control-plane/tower-loop/mergeCheck.mjs \
    services/control-plane/tower-loop/test/run-tower-loop-tests.mjs \
    services/control-plane/tower-loop/test/gitEvidenceGh.test.mjs

secret-scan: CHECKED 26 detection class(es) — ...
secret-scan: SCANNED 5 file(s) of the named surface, 0 secret value(s) found.
EXIT=0
```

**Exit 0 = SCANNED and clean.** Coverage: exactly the 5 files touched by this Work Order — all of
`file_surface`'s writable paths, enumerated directly (no `git ls-files`/repo-wide fallback). Nothing
was found unread; exit `2` (NOT SCANNED) never occurred.

## Files touched (exact, count outside `file_surface` = 0)

```
$ git status --porcelain=v1
 M services/control-plane/tower-loop/gitEvidence.mjs
 M services/control-plane/tower-loop/mergeCheck.mjs
 A services/control-plane/tower-loop/test/gitEvidenceGh.test.mjs
 M services/control-plane/tower-loop/test/run-tower-loop-tests.mjs
 M services/control-plane/tower-loop/watcher.mjs
```

- `gitEvidence.mjs`: 233 lines changed (+/-) — new `resolveViaGh()`, `truncateDiff()`,
  `CANONICAL_SHA`/`short()` helpers; `gatherGitEvidence` branches between the gh-sourced and
  local-git mechanisms; local-git code path itself is byte-identical in logic, only re-indented
  under an `else` block.
- `mergeCheck.mjs`: 12 lines changed — the approved narrow `spawn` passthrough only.
- `watcher.mjs`: 62 lines changed — `PR_POLL_ROTATE_SLOTS` literal, `now` injectable parameter,
  the rotation logic replacing the old unconditional `.slice(0, limit)` truncation.
- `test/run-tower-loop-tests.mjs`: 171 lines changed — `D7`/`D-TR2` pinned to `now: () => 0` for
  determinism (assertions otherwise unchanged); `WH1` rewritten for the two-mechanism shape; `M2`/
  `M3` inject `failClosedGhSpawn`; `TOWER_LOOP_CP_SITES` `20` → `25` (the 5 new git-fixture launches
  in `gitEvidenceGh.test.mjs`, each already `windowsHide:true`); two new tests, `D-ROT1`/`D-ROT2`.
- `test/gitEvidenceGh.test.mjs`: 243 lines, new file — the Gap 2 proofs (see table above).

## Acceptance criteria table

| AC | Met? | Evidence |
|---|---|---|
| Gap 1: every open PR eventually polled, tail PR proven within a bounded, stated round count | Met | `D-ROT1` |
| Gap 1: no new persistent store/registry/table | Met | `now`/`PR_POLL_ROTATE_SLOTS` are a function parameter and a literal; nothing durable added |
| Gap 1: deterministic rotation, testable not random | Met | `now` injectable; `D-ROT1`/`D-ROT2` pin exact tick sequences |
| Gap 1: in-flight rounds never starved by rotation | Met | `D-ROT2`, and `rankedSlots` formula in `pollTargets` |
| Gap 2: exact-head review works from a directory with no relationship to the object database | Met | `gitEvidenceGh.test.mjs` test 1 (fresh `git init`, unrelated history) |
| Gap 2: `changed_files`/`diff_text` same range, never diverge | Met | `gitEvidenceGh.test.mjs` test 3; both sourced from the identical `gh pr diff` PR at construction |
| Gap 2: `MAX_DIFF_BYTES` truncation carries over | Met | `gitEvidenceGh.test.mjs` test 4 |
| Gap 2: local-git fallback preserved for no-`prNumber` callers | Met | `gitEvidenceGh.test.mjs` test 7 (control) + `reviewTooling.test.mjs` unmodified, 31/31 |
| Gap 2: `gh pr checks` CI-checks path unchanged | Met | `gitEvidenceGh.test.mjs` test 2 |
| Full suite green, before/after, `failures=0` | Met | See "Commands executed" |
| Secret scan clean over declared surface | Met | Exit 0, 5/5 files scanned |

## Assumptions made (each is a defect in the order the coordinator should weigh, per critical rule)

1. `PR_POLL_ROTATE_SLOTS = 1` — the WO said "slot(s)" without pinning a count; one slot is the
   minimum that satisfies "bounded, not merely eventually probably" while weakening the fixed
   ranking the least.
2. Rotation tick granularity = `PR_POLL_MS` (the watcher's own poll cadence) — not separately
   configurable; a literal, matching the WO's own "no new config" framing for the mechanism.
3. Base-SHA resolution deviates from the local-git fallback's `head~1` heuristic when resolving via
   `gh` (uses the PR's actual base ref instead) — disclosed above under Gap 2, required by Gap 2's
   own no-local-git constraint, and arguably a correctness improvement over `head~1` for
   multi-commit PRs, but it is a real behavioural change from what shipped before this WO.
4. `mergeCheck.mjs` added to `file_surface` mid-dispatch, by the coordinator's explicit amendment,
   for the narrow `spawn`-passthrough described above — not self-authorised.

## Out-of-scope findings

None beyond the one already surfaced and resolved at read-back (`mergeCheck.mjs`'s missing `spawn`
seam, see above).

## Not verified / known limitations

- `gitEvidenceGh.test.mjs` is **not wired into a `package.json` script or a CI workflow**, same
  documented limitation as the pre-existing `reviewTooling.test.mjs` — both are outside this WO's
  `file_surface` (`services/control-plane/package.json`, `.github/workflows/`).
- The gh-sourced mechanism has been proven only against **injected `spawn` doubles supplying
  real-shaped output**, never against a live `gh` process or the real GitHub API — no network was
  used anywhere in this dispatch (`network: none`, `credential_scope: none`, honoured throughout).
  First live exercise of this path (a real merge-class turn processed by the watcher against a real
  open PR) remains outstanding and is not evidenced here.
- This is code and test work only (`live_authority: none`) — no service was started, restarted, or
  operated. Nothing about operational acceptance is claimed.
- Same-model builder evidence only. Independent review (Veritas / Codex) has not run against this
  head.

**Builder self-test evidence — NOT independent review.**
