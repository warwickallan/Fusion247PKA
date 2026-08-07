# EVIDENCE — AsdAIr CI diagnosis (PR #94, Codex finding F-001, AsdAIr half)

**Dispatch:** Larry → Keel, bounded investigation + fix-if-small, 2026-08-05.
**Governance head at dispatch:** `build-020/live-trial` @ `48195d7` (fresh fetch,
`origin/build-020/live-trial`).
**Worktree:** `C:/Fusion247PKA-wo-asdair-ci`, branch `build-020/asdair-ci-fix`, cut from `48195d7`.
**Builder self-test evidence — NOT independent review.**

This covers only the AsdAIr half of F-001 (`asdair-tests` workflow). The `governor-tests` half was
already root-caused (shallow-checkout) and is explicitly out of this dispatch's surface.

---

## Failure 1 — AC11 "slashes and case aside" (`ensure-asdair-runtime.test.mjs:747`)

**Disposition: FIXED. Small, in-surface, verified.**

### Root cause

`samePath(a, b)` in `services/asdair/pipeline-runtime/ensure-asdair-runtime.mjs` normalised in the
wrong order:

```js
const norm = (p) => path.resolve(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
```

`path.resolve()` ran **before** backslashes were converted to forward slashes. On a POSIX host (the
`ubuntu-latest` CI runner), `path.resolve()` does not treat `\` as a path separator — a Windows-style
registered path such as `\TMP\CHECKOUT-A\ensure-asdair-runtime.mjs` is not recognised as absolute, so
`path.resolve()` silently joined it onto `process.cwd()` as one long literal segment instead of
comparing it as itself. Two strings naming the exact same checkout, differing only by slash direction
and case — the two things the test's own name says should be ignored — came out as different paths,
producing the spurious "points at a DIFFERENT checkout" mismatch quoted in the dispatch.

This is genuinely pre-existing: `samePath` is byte-identical from its introduction in commit
`21c2e27` (2026-08-04, `BUILD-015 WO-B`) through to the state at dispatch (`git log -p` shows no
subsequent edit to the function before this fix). It has never been exercised on a POSIX runner until
`pipeline-runtime` was added to `asdair-tests.yml` on 2026-08-04 (same day, later commit — see
`996a838`'s "pipeline-runtime and browser-runner added to CI ... 156 tests that had never gated a
merge"). Not connected to anything built in BUILD-020 Phase 2 today.

### Fix

Normalise slash direction **before** calling `path.resolve()`, so the string is already
POSIX-absolute (still starts with `/`) and `resolve()` leaves it alone on every platform — the only
remaining differences are exactly the ones the comparison exists to ignore:

```js
export function samePath(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const norm = (p) => path.resolve(p.replace(/\\/g, '/')).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
  return norm(a) === norm(b);
}
```

`samePath` is now exported (it was module-private before) so it can be tested directly rather than
only through `evaluateScheduledTask`/`run()`.

### Proof the underlying comparison is correct, not just that the assertion goes green

Two new direct unit tests were added, proving `samePath` itself rather than relying on one caller's
assertion:

- `samePath: a backslash, all-caps Windows-style path still matches a forward-slash, mixed-case POSIX
  path for the same checkout` — asserts `true` for a deliberately mismatched case/slash pair.
- `samePath: a genuinely different checkout still compares unequal after normalisation` — asserts
  `false` for two different checkouts, so the fix cannot be satisfied by collapsing everything to
  equal.

Both pass, alongside the pre-existing AC11 suite (unchanged assertions, now green) and every other
subtest in `ensure-asdair-runtime.test.mjs` and the rest of `pipeline-runtime/`.

### Files touched

- `services/asdair/pipeline-runtime/ensure-asdair-runtime.mjs` — `samePath` fix, exported.
- `services/asdair/pipeline-runtime/ensure-asdair-runtime.test.mjs` — two new direct `samePath` tests.

Both inside the declared `file_surface`. No other file touched.

---

## Failure 2 — integration.dbtest.js "asdair full path" (`skill/test/integration.dbtest.js:95`)

**Disposition: NOT FIXED — out of bounds for this dispatch. Diagnosed from the CI log; no local
Postgres was available to reproduce interactively (checked: no `docker`, no local `pg_isready`
response on `localhost:5432`), exactly as the dispatch anticipated as a legitimate outcome.**

### What the CI log shows (`gh run view --job 92401201208`/integration job, run `31033938538`)

The failure is a **real assertion failure inside a live Postgres run, not an environment/connection
problem**: `constraints.dbtest.js`'s 12 subtests pass first, `integration.dbtest.js`'s own schema
creation, seeding and `loadBudget` assertions pass, and the first failure is a logic mismatch at
line 266:

```
not ok 2 - asdair full path: clean Postgres -> schema -> seed -> data.js -> planner.js
  error: |-
    mapped item plans to add
    + actual - expected
    + 'needs_decision'
    - 'add'
```

`byName['widget b']` — a shopping-list item that should resolve via a household-scoped
`asdair.products` term match to `'add'` — resolves to `'needs_decision'` instead. This is not a
"suspiciously fast" no-op skip; the test ran to completion against a real, freshly-seeded Postgres
16 container and failed on genuine planner output.

### Root cause is real but is NOT in this dispatch's surface

`services/asdair/skill/planner.js`, `services/asdair/skill/termMatch.js` and
`services/asdair/skill/data.js` are the files that would need to be read to root-cause the mismatch —
none of them is in this Work Order's `file_surface` (only `integration.dbtest.js` is, and only for
read/diagnose). Evidence that this is genuinely a pre-existing, non-trivial defect rather than
something this dispatch could safely absorb:

- `planner.js` grew by **798 lines** and `termMatch.js` was newly added at **350 lines** in commit
  `94978d2` (2026-08-04, `"BUILD-015: seven workstreams landed; TREE IS RED in two suites,
  deliberately banked"`) — an agent was stopped mid-edit, "part-way through removing the silent
  quantity SUM in dedupeList()."
- The recovery commit `0f8a1bc` ("the two banked red suites recovered; tree is green at 1599 tests")
  explicitly states **`planner.js is byte-identical to HEAD`** — the recovery was entirely
  test-file corrections (`planner.test.js`, `ruleConsumption.test.js`), and its own inventory list
  (`skill 279`) covers only the **offline** suite. `integration.dbtest.js` is DB-gated and skips
  without `ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE`+`ASDAIR_DB_URL` — it is not part of that 279 count and
  was not exercised by the recovery.
- This means the 798-line planner rewrite may never have been proven against this specific
  household-scoped-term-match path through a real Postgres schema. Tracking down exactly which of the
  many `needs_decision` branches added in that rewrite (planner.js now has at least 8 distinct
  `status = 'needs_decision'` assignment sites) is now claiming this line is a genuine investigation
  into someone else's mid-flight, already-banked rewrite — not a "few lines, no design decision"
  fix.
- The test's own expectation is correct and well-reasoned (its inline comments explain exactly why
  `'widget b'` should map to `'add'`); this is not a case of a stale or wrong test.

**Per the Work Order's explicit instruction 3, this is reported rather than fixed.** No file outside
`file_surface` was written. `integration.dbtest.js` itself was read but not modified — the defect is
upstream of it, in the planner/termMatch/data trio, and changing the test to match wrong output would
be exactly the fabrication critical rule 9 prohibits.

### Connection to BUILD-020 Phase 2 — none

`planner.js`, `data.js` and `termMatch.js` were last touched on 2026-08-04 (commits `94978d2` then
untouched further — `0f8a1bc` confirms `planner.js` byte-identical). `integration.dbtest.js` itself
was last touched 2026-07-27 (`fbe7225`). Neither has been touched since, including by any commit in
today's (2026-08-05) BUILD-020 Phase 2 work (Tower, Honcho, the governor closure), which touches an
entirely disjoint file set (`services/control-plane/**`, `tools/governor/**`, `Deliverables/**`
Wayfinder material). `git log <path>` for all three files confirms no commit after `94978d2`/`0f8a1bc`
touches them.

---

## Commands executed, verbatim

```
$ cd services/asdair/pipeline-runtime && node --test ensure-asdair-runtime.test.mjs
# tests 69
# pass 69
# fail 0
exit 0

$ cd services/asdair/pipeline-runtime && npm test        # = node --test, whole directory
# tests 132
# pass 132
# fail 0
exit 0

$ cd services/asdair/skill && npm ci && node --test        # broader sanity check, CI's own convention
# tests 281
# pass 279
# fail 0
# skipped 2   (both DB-gated dbtest.js files, correctly no-op without ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE)
exit 0

$ bash scripts/secret-scan.sh --surface \
    services/asdair/pipeline-runtime/ensure-asdair-runtime.mjs \
    services/asdair/pipeline-runtime/ensure-asdair-runtime.test.mjs \
    services/asdair/skill/test/integration.dbtest.js
secret-scan: SCANNED 3 file(s) of the named surface, 0 secret value(s) found.
exit 0
```

Coverage: the secret scan covered exactly the three declared `file_surface` paths (surface-scoped
mode, no git involvement, works on the exact named files) — exit `0` means SCANNED and clean, not
merely "did not error."

`git diff --stat` against the branch point (`48195d7`) shows exactly two modified files, both inside
`file_surface`: `ensure-asdair-runtime.mjs` and `ensure-asdair-runtime.test.mjs`. Zero paths outside
surface.

Local Postgres was checked and confirmed unavailable before relying on the CI log alone for Failure
2: no `docker` binary on PATH, and `pg_isready -h localhost -p 5432` returned "no response."

---

## Acceptance criteria — reconciled against the Work Order's four numbered asks

1. **Root-cause both failures, verified by reading actual code and actual CI logs** — met. AC11: read
   `samePath`/`evaluateScheduledTask` and the CI log line-for-line. integration.dbtest.js: read the
   full CI log (`gh run view --job 92401201208 --log-failed`, `gh run view 31033938538`), the test
   file, and the git history of the files that would need to change.
2. **Fix if genuinely small; STOP and report if not** — met for both: AC11 fixed (2 lines of logic,
   no design decision); integration.dbtest.js reported, not fixed, naming exactly why it is out of
   bounds (root cause lives in three files outside `file_surface`, inside another agent's already-
   banked, 1100+-line rewrite).
3. **Confirm no connection to today's BUILD-020 Phase 2 work** — met, with `git log` evidence per
   file above: the `samePath` bug is byte-identical since 2026-08-04 (`21c2e27`); the planner/data/
   termMatch trio was last touched 2026-08-04 (`94978d2`/confirmed unchanged at `0f8a1bc`);
   `integration.dbtest.js` was last touched 2026-07-27. None intersects today's Tower/Honcho/governor
   file set.
4. **Run the service's own test convention before/after, secret-scan, evidence file, commit, push** —
   this file, plus the command block above.

## Not verified / known limitations

- Failure 2's exact defective branch inside `planner.js`/`termMatch.js` was not pinned down to a line
  — that would require the deeper investigation this dispatch was explicitly bounded away from.
- The CI `integration` job for this exact dispatch's branch was not separately re-run (this dispatch
  did not push a change touching `integration.dbtest.js`, so there is nothing new to gate there — the
  fix only touches the `unit` job's `pipeline-runtime` step).
- Builder self-test evidence only — NOT independent review. No merge-readiness or completion claim is
  made here.

**Builder self-test evidence — NOT independent review.**
