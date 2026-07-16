---
build: BUILD-002
wp: WP0
artifact: wp0-security-gate-delta-review
author: vex
status: delta-review-complete
created: 2026-07-16
---

# WP0 Security Gate — Delta Review (2026-07-16)

Targeted delta review of **PR #28**, branch `build-002/wp0-fixtures-baseline`,
reviewed head **`2bd51da7c33a6c86382fedcabaaa255f756320f7`** (confirmed live via
`git rev-parse HEAD` at time of writing — not trusted from the dispatch brief).
Delta base: **`6503528`** — the commit [[wp0-security-gate-execution-2026-07-16]]
(round 2) was executed against. This is NOT a restart of that audit; it is a
targeted review of everything that changed since it, against
[[wp0-security-gate]]. That prior report is preserved as history and is not
rewritten here.

**Review method:** live re-execution, not trust. Every claim below is backed by
a command actually run in this session, a file actually read at the current
head, or a probe actually executed and then discarded. Nothing is taken from
the PR body, the BUILD-002 record's own status prose, or Sonnet's commit
messages as proof — those were used only to locate what to verify.

---

## VERDICT: PASS

**Merge-security position: SECURITY DELTA GREEN — FIXTURES PR READY FOR FINAL QA / MERGE DECISION.**

Zero CRITICAL, zero HIGH findings. No committed secret. No regression in any
previously-GREEN control. The delta consists entirely of (a) a real, tested
autonomous-retry/dead-letter runtime path replacing what was previously a
test-only simulation, (b) an erasure-robustness fix so a tampered/foreign
`destination_ref` no longer blocks erasing the PII-carrying operational row,
(c) explicit FK constraint-naming + a static cross-file migration test, (d) a
new CI workflow that now actually runs the test suite (previously CI only ran
the secret scanner), and (e) new regression tests proving all of the above. All
nine new/changed test files pass; the full suite is 101/101. This does not
constitute live-production approval — see conditions below.

---

## Step 1 — delta baseline (independently verified)

`git diff --name-status 6503528..HEAD` — **21 files**, exactly matching the
reference list in the dispatch brief:

```
A  .github/workflows/fusion-capture-gateway-tests.yml
M  Builds/BUILD-002-unified-personal-capture-gateway/BUILD-002-unified-personal-capture-gateway.md
M  Builds/BUILD-002-unified-personal-capture-gateway/Work Packages/WP0-foundation-and-live-text-proof.md
M  services/fusion-capture-gateway/README.md
M  services/fusion-capture-gateway/migrations/0001_wp0_operational_baseline.sql
M  services/fusion-capture-gateway/migrations/0002_wp0_deletion_and_retention.sql
A  services/fusion-capture-gateway/src/core/retryPolicy.js
M  services/fusion-capture-gateway/src/core/states.js
M  services/fusion-capture-gateway/src/erasure.js
M  services/fusion-capture-gateway/src/markdownWriter.js
M  services/fusion-capture-gateway/src/store/operationalStore.js
M  services/fusion-capture-gateway/src/worker.js
A  services/fusion-capture-gateway/test/action-idempotency.test.js
A  services/fusion-capture-gateway/test/card-retry.test.js
A  services/fusion-capture-gateway/test/deadletter-worker.test.js
A  services/fusion-capture-gateway/test/deadletter.test.js
M  services/fusion-capture-gateway/test/erasure.test.js
A  services/fusion-capture-gateway/test/migrations.test.js
A  services/fusion-capture-gateway/test/retry-scheduling.test.js
A  services/fusion-capture-gateway/test/traversal.test.js
A  services/fusion-capture-gateway/test/unsafe-input.test.js
```

`.github/workflows/secret-scan.yml` is unchanged since `6503528` (pre-existing,
read for context per Step 2.6 but not part of the delta).

---

## Step 2 — evidence

### 2.1 Retry scheduling and reclaim

- `computeNextAttemptAtMs` (`src/core/retryPolicy.js:25-34`) is pure/deterministic:
  `now + min(BASE_BACKOFF_MS * 2^(attempt-1), MAX_BACKOFF_MS)` — 1s/2s/4s/…capped
  at 60s. `retry-scheduling.test.js:48-64` proves exponential growth, the cap,
  determinism, and rejects non-positive attempt counts / non-finite `now`.
- `store.claim()` (`operationalStore.js:199-246`) is the ONLY reclaim seam. A
  candidate is claimable if `CLAIMABLE_STATES` (queued/offline_queued), OR a
  `claimed` item past `lease_expires_at_ms`, OR (`FAILED`/`PARTIAL` AND
  `next_attempt_at_ms <= now` AND `attempt_count < MAX_DELIVERY_ATTEMPTS`).
  `retry-scheduling.test.js:100-117` proves reclaim is refused one ms before due
  and succeeds exactly at/after due. `:119-141` drives a real item to
  `MAX_DELIVERY_ATTEMPTS` via `MAX_DELIVERY_ATTEMPTS` real claim+recordFailure
  cycles and proves `claim()` refuses it even though its due time has arrived —
  the attempt cap is enforced at the store primitive, not just the worker.
- `states.js:30,42-46,86-93` — `DEAD_LETTER` is in `TERMINAL_STATES`,
  `BASE_TRANSITIONS[DEAD_LETTER] = []`, and because `TERMINAL_STATES.includes`
  suppresses the auto-added Cancel hop, `ALLOWED_TRANSITIONS[DEAD_LETTER]` is the
  empty array — **zero outgoing transitions**, confirmed by reading the code and
  by `deadletter.test.js:63-82` (`ALLOWED_TRANSITIONS[DEAD_LETTER]` deep-equals
  `[]`; every `canTransition(DEAD_LETTER, X)` is false for all X including
  `COMPLETED`; `assertTransition` throws).
- Idempotent claim + idempotent write: `claim()` mutates the in-memory Map
  synchronously (no `await`, no I/O) between the candidate scan and the mutation
  — see next bullet. `markdownWriter.write()` (unchanged this delta) still
  detects an existing note and returns `existed:true` without rewriting.
  `deadletter-worker.test.js:136-169` (transient-failure recovery) and
  `retry-scheduling.test.js` collectively re-prove this under the new retry path.
- Oldest-eligible selection: `candidates.sort((a,b) => (a.received_at_ms -
  b.received_at_ms) || (a.seq - b.seq))` (`operationalStore.js:228`).
  `retry-scheduling.test.js:143-158` proves a due-retry candidate still wins
  oldest-first over a fresher ordinary queued item.
- Expired-lease recovery: unchanged claim logic (`rec.state === CLAIMED &&
  lease_expires_at_ms <= now` → re-queued then re-claimed); still exercised by
  `test/recovery.test.js` (in the 101-test run).
- **Concurrency-by-construction (fixture):** `claim()`'s candidate scan
  (`for (const rec of byCaptureId.values())`) and its subsequent mutation
  (`rec.state = CLAIMED; ...`) are one synchronous function body with no `await`
  and no I/O in between, running in Node's single JS event loop. Two "concurrent"
  calls to `claim()` in this fixture cannot interleave — the second call only
  begins after the first's synchronous body (scan + mutate) has fully returned.
  This is not a general Postgres-safe pattern; it is safe here specifically
  because the fixture has no concurrency primitive to race on.
- **Real Postgres design intent — documented, not built.** Read
  `Builds/BUILD-002-unified-personal-capture-gateway/Architecture/supabase-operational-foundation-boundary.md`
  §1.1.2 and both migration files. §1.1.2 explicitly names the pattern:
  "Atomic claim (lease). The local worker claims the oldest eligible envelope
  under a lease... implemented as a conditional UPDATE ... (or `SELECT ... FOR
  UPDATE SKIP LOCKED` if a batch claim is ever needed)." The migration files
  contain no actual transaction/lock code (they are DDL only — tables, types,
  indexes, RLS-enable), consistent with "not executed by the WP0 test suite" and
  "FIXTURES-ONLY" headers in both files. **Verdict: the intended real design is
  correctly documented (conditional UPDATE / SKIP LOCKED-class pattern);
  it is NOT implemented — Postgres isn't wired in this PR, fixtures only.** No
  gap between what's documented and what's claimed as built.
- **O(n) fixture scan — classification (per the review's own instruction, not
  inflated).** `claim()` iterates every record in `byCaptureId` on each call
  (`operationalStore.js:214-224`). Classified as:
  - **Not** a security/correctness issue. It does not affect claim legality,
    tie-breaking, or the attempt cap; every property proven above holds
    regardless of scan order.
  - **A fixture-implementation characteristic, expected and fine for tests.**
    In-memory Map, deterministic small fixture datasets, no real-scale exposure.
  - **A real pre-live performance/indexing note for the eventual Postgres
    implementation, correctly out of scope for this PR.** `0001`'s
    `processing_state_claimable_idx` is `(state, lease_expires_at)`
    (`migrations/0001_wp0_operational_baseline.sql:197-198`). It does **not**
    cover `next_attempt_at` — a real due-retry query (`WHERE state IN
    ('failed','partial') AND next_attempt_at <= now() AND attempt_count <
    $cap`) would not be served by this index alone; it would need a composite
    covering `next_attempt_at` (e.g. `(state, next_attempt_at)` or extending the
    existing index) or fall back to a table/partial scan under Postgres. This is
    a genuine indexing gap **for the Postgres implementation that does not yet
    exist**, not a defect in the fixtures PR — recorded as INFO below, carried
    forward as a pre-Postgres-wiring note, not a blocker.

### 2.2 Failure and false-completion paths

- `recordFailure` payload/secret exposure: `worker.js:86` captures
  `writeErr.message` only. The only thing that can throw a governed write in
  this codebase is `markdownWriter.write()`'s two explicit `throw new Error(...)`
  sites: the test-only fault injector
  (`` `markdownWriter.write: simulated governed write failure for ${capture_id}` ``,
  `markdownWriter.js:90`) and the traversal guard
  (`` `markdownWriter.write: refusing out-of-sandbox path for ${capture_id}` ``,
  `markdownWriter.js:99`). Both interpolate only `capture_id` (a server-assigned
  id, not payload text, not a secret) — confirmed by reading every throw site in
  `markdownWriter.js`. `console.error` at `worker.js:109-119,127-136` logs
  `capture_id`, `attempt_count`, `error` (the above message), `at_ms` — no
  `text_preview`, no `raw_payload_ref`, no config secret ever enters this path.
- `complete()` unchanged this delta (`operationalStore.js:292-309`): still gates
  strictly on `rec.state === EVIDENCED`, a non-null `destination_ref`, and
  `evidence_pointers.length > 0`, then `assertTransition` to `COMPLETED`. Diffed
  against `6503528` — no lines touched in this function.
- Worker crash recovery at each changed transition point: `worker.js`'s
  try/catch (`:67-138`) wraps write→destination→written→evidence→evidenced→
  complete as one block; ANY throw inside routes to `recordFailure` +
  (dead-letter-or-not) — never a partial/duplicate state. `test/recovery.test.js`
  (unchanged, in the 101-test run) and the new `deadletter-worker.test.js`
  transient-recovery test both exercise this and pass.
- Failed card projection still cannot undo/duplicate canonical work: the
  swallow-and-log branch (`worker.js:143-159`) is byte-for-byte unchanged this
  delta (confirmed via `git diff`) — no lines in that block appear in the
  6503528..HEAD diff.
- Retry processing does not create a second Markdown artefact: proven directly —
  `deadletter-worker.test.js:63-134` asserts `markdownWriter.writeCount() === 0`
  for a capture that fails on every attempt (every failing write throws BEFORE
  touching disk) and zero leaked note files; `:136-169` (transient recovery)
  asserts exactly one write (`writeCount() === 1`) after the real autonomous
  reclaim completes it.
- Evidence cannot point to an escaped/refused path: markdownWriter's traversal
  guard (`markdownWriter.js:96-100`) is unchanged in the write path this delta
  (only `remove()` and the fault-injection hook were touched — see 2.3).
- Stale evidence cannot advance a failed item to completed: re-confirmed via
  `complete()`'s unchanged gate (above).

### 2.3 Erasure hardening — retested directly

Read `src/erasure.js` and `test/erasure.test.js`, then ran a live throwaway probe
(Node REPL-style script, executed and discarded, no files left under `services/`)
independently re-confirming the same properties the new committed test
(`erasure.test.js:166-202`, "a tampered/foreign destination_ref never blocks
erasing the operational row") asserts:

- Tampered/foreign `destination_ref` (`/etc/passwd`): `markdownWriter.remove()`
  throws `refusing out-of-sandbox path` (unchanged guard,
  `markdownWriter.js:156-161`). `erase()`'s new try/catch
  (`erasure.js:72-85`) catches it, logs `{event:'markdown_removal_failed',
  capture_id, error: err.message, at_ms}` — no payload/secret content — sets
  `markdownRemoved = false`, and **proceeds to step 3** (`store.deleteCapture`).
  Result: `{erased:true, removed:{markdown:false, record:true}}`. Confirmed by
  direct probe: `/etc/passwd` existed before and after, byte-identical
  (`fs.existsSync` + no write attempted — the guard throws before any `fs.rmSync`
  call), and the operational row was gone from the store after.
- Missing Markdown target (never written): `erase()` step 1 is gated on
  `record.destination_ref && typeof record.destination_ref.path === 'string'`
  (`erasure.js:71`) — never attempted when null; row still erased. Matches
  `erasure.test.js:143-164`.
- Markdown present, row later gone: not a distinct code path — covered by the
  double-erase test below (row absent → `store.getByCaptureId` returns
  `undefined` → immediate early return, `erased:false`, never throws).
- Markdown present but operational row already gone: `erase()`'s first line is
  `const record = store.getByCaptureId(captureId); if (!record) return
  {erased:false, removed:{markdown:false,record:false}, at_ms:now}` — never
  throws, confirmed by reading `erasure.js:51-60` and probed directly against an
  unknown id.
- Repeated erasure is idempotent: probed directly — first `erase()` call on a
  completed capture removed both the note and the row; a second call on the same
  id returned `{erased:false, removed:{markdown:false,record:false}}`, threw
  nothing, and left no resurrected file. Matches `erasure.test.js:109-141`.
- Completed-capture erasure end to end: probed and matches
  `erasure.test.js:45-80` — note gone, row gone.
- Unknown capture ID never throws: probed directly, matches
  `erasure.test.js:204-221`.
- Forged/mismatched `capture_id` cannot delete a different capture's data:
  `store.deleteCapture(captureId, ...)` (`operationalStore.js:362-373`) looks up
  `byCaptureId.get(captureId)` by exact key and only ever deletes that key plus
  its own `idempotency_key` index entry (guarded further by `byIdempotencyKey.get(rec.idempotency_key)
  === captureId` before removing the index entry) — no derived/guessed/prefix
  path exists anywhere in the delete path. `markdownWriter.remove()` likewise
  only acts on the exact `destinationRef.path` passed in, confined to the
  sandbox. Confirmed by code reading; no test explicitly targets cross-capture
  deletion but the exact-key-only implementation makes it structurally
  impossible, not merely untested.

**Git history / backup boundary:** `migrations/0002_wp0_deletion_and_retention.sql`'s
"RETENTION / BACKUP NOTE" (lines 95-108) is present and unchanged in substance
from the pre-delta version (only comment-formatting context above it changed —
confirmed via `git diff 6503528..HEAD` on this file, which touches only the
header-comment area, not this note). It correctly states shadow copies
(PITR/logical backups/WAL archives, Storage object versions, read
replicas/exports/caches) must also be purged within the retention window and
that retention never overrides erasure. Not re-litigated per instruction.

### 2.4 Migration contract

- All four FKs `0002` drops-and-recreates
  (`capture_envelope_raw_object_ref_fkey`, `idempotency_key_capture_id_fkey`,
  `processing_state_capture_id_fkey`, `evidence_pointer_capture_id_fkey`) now
  carry explicit `constraint <name>` clauses in `0001`
  (`migrations/0001_wp0_operational_baseline.sql:135-136,143-144,171-172,184-185,210-211`).
  `test/migrations.test.js` statically parses both files and asserts (a) 0001
  declares all four names, (b) every name 0002 drops is one 0001 declared, (c)
  every dropped name is re-added under the identical name — no silent rename.
  Ran and passed (part of the 101-test run below); also read both SQL files
  directly and confirmed the names match by eye.
- Cascade/set-null choices match `0002`'s own comments: `idempotency_key`,
  `processing_state`, `evidence_pointer` FKs → `on delete cascade`;
  `capture_envelope.raw_object_ref` → `on delete set null` (raw object may be a
  shared retention original, deleted explicitly by the erasure worker, not
  cascaded) — matches the comment block at `0002:31-49,69-73` exactly.
- Migrations remain deterministic text — no non-deterministic constructs
  (`gen_random_uuid()`/`now()` are the only non-literal defaults, both
  pre-existing and unrelated to this delta; no new non-determinism introduced).
- RLS: `0001` still `enable row level security` on all six tables
  (`channel_identity, raw_object, capture_envelope, idempotency_key,
  processing_state, evidence_pointer`), no `create policy` statement anywhere.
  `0002` diff (`6503528..HEAD`) touches only header-comment prose, zero SQL
  statements changed. `test/migrations.test.js`'s two RLS tests
  (`0001 enables row-level security on every table it creates`; `0002 does not
  add a permissive RLS policy or disable RLS`) both pass, AND I independently
  re-read both SQL files end to end and found no `create policy` / `disable row
  level security` anywhere. F-07 (restrictive production RLS policies) remains
  correctly deferred — not demanded here, per instruction.

### 2.5 Hostile input regression

Ran directly:
```
node --test test/traversal.test.js test/unsafe-input.test.js
```
via the full-suite run below (both files execute as part of `node --test`'s
default discovery; individually confirmed passing within the 101/101 total).
Read both files. Coverage confirmed present and passing:
`../` nested traversal, `/etc/passwd` and `C:\Windows\...` absolute paths,
`foo/../../bar`-style relative traversal, URL-encoded traversal
(`%2e%2e%2f...` — the allowlist strips `%` too, never decodes), Windows
backslash separators, embedded NUL byte, Unicode fullwidth dot/slash
look-alikes (`traversal.test.js:25-39`); control-char/space/tab/newline-laden
ids and shell-injection-flavoured message text
(`$(whoami); rm -rf / && ../../etc/passwd \`id\``) kept fully inert as note
body data, never a path/command component (`unsafe-input.test.js:38,67`); a
dedicated meta-test asserting no `child_process`/`execSync`/`execFileSync`/
`spawnSync`/`eval(`/`new Function(`/`vm.runIn` sink exists anywhere in `src/`
(`unsafe-input.test.js:100-132`) — passed. Also confirmed: unauthorised numeric
sender rejected by default-deny (`telegramAdapter.js:103-106`, unchanged this
delta — confirmed via diff, no lines in this file appear in 6503528..HEAD);
missing/malformed identity rejected (`toEnvelope` returns
`{ok:false, reason:'unauthorised_sender'}` when `senderId === undefined`);
duplicate/replayed update and duplicate/replayed action both dedup to one
effect — `action-idempotency.test.js:47-104` proves one durable row, one
governed write, one card, across both a pre-completion replay and a
post-completion replay; unsafe/foreign erasure reference refused — covered in
2.3.

### 2.6 CI and secret controls

- `.github/workflows/fusion-capture-gateway-tests.yml` (new this delta): Node 22
  pinned (`node-version: '22'`), full unfiltered `node --test` run (no path/tag
  filter), triggers scoped to `services/fusion-capture-gateway/**`,
  `Builds/BUILD-002-unified-personal-capture-gateway/**`, and the workflow file
  itself, on both `push` and `pull_request`. `permissions: contents: read` —
  least privilege, no broader scope. No credentials/secrets referenced anywhere
  in the file. No `continue-on-error`, no swallowed exit codes — a failing
  `node --test` fails the job directly (single `run:` step, default failure
  propagation).
- `.github/workflows/secret-scan.yml` (pre-existing, unchanged this delta): runs
  `bash scripts/secret-scan.sh` on `push`/`pull_request`, `permissions:
  contents: read`, no credentials.
- `git grep` sweep for network sinks across `src/` and `test/`:
  `fetch\(|http\.request|https\.request|WebSocket` → **zero matches** — no
  hidden live/network call in any test file or in application code.

**Commands run directly, exact results:**
```
$ cd services/fusion-capture-gateway && node --test
# tests 101
# suites 0
# pass 101
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 819.954851
exit code: 0

$ bash scripts/secret-scan.sh
secret-scan: clean — scanned 318 tracked file(s), 0 secret value(s) found.
exit code: 0
```
(101 vs the round-2 report's 65 — +36 tests: retry-scheduling, deadletter,
deadletter-worker, migrations, traversal, unsafe-input, action-idempotency,
card-retry, plus the widened erasure.test.js. 318 vs 308 tracked files — the 10
new files in this delta.)

---

## Step 3 — regression status of previously-GREEN controls

| Control | Status | Evidence |
|---|---|---|
| Single authorised numeric user + default-deny | **GREEN, unchanged** | `telegramAdapter.js` not in the 6503528..HEAD diff; re-read, logic identical to round 2. |
| No self-enrolment | **GREEN, unchanged** | No `/start`/invite/runtime-add path in `intake.js`/`telegramAdapter.js` (neither touched this delta). |
| Fail-closed config (`config.js`) | **GREEN, unchanged** | `config.js` not in the diff; `fixturesMode`/`missingRequired` logic untouched. |
| Scoped Markdown write root + traversal protection | **GREEN, re-verified** | `markdownWriter.js`'s guard block (`:96-100`) unchanged; new `traversal.test.js` adds regression coverage (2.5). Only `remove()` fault-injection hook were touched. |
| No false completion | **GREEN, re-verified** | `complete()` unchanged (2.2); re-proven under the new retry/dead-letter paths by `deadletter-worker.test.js`. |
| Idempotent write + restart | **GREEN, re-verified** | `test/recovery.test.js` unchanged and passing; new tests (`deadletter-worker`, `action-idempotency`, `card-retry`) add coverage under retry/replay scenarios. |
| Supabase operational-only boundary | **GREEN, unchanged** | Source-of-truth-matrix language in `0001`/README unchanged in substance; only comment context added. |
| Markdown canonical authority | **GREEN, unchanged** | Same boundary statements re-read, unchanged. |
| Health data excluded | **GREEN, unchanged** | `technical_source_type` enum (`0001:62-64`) unchanged — no health-specific type; WP0 still text-only. |
| No real secrets/personal data | **GREEN, re-verified** | Secret-scan clean, exit 0, 318 files (2.6); `git grep` secret-pattern sweep found only doc/name references, no values. |
| RLS deny-by-default | **GREEN, re-verified** | 2.4 — no `create policy`/`disable row level security` added; static test passes; re-read by eye. |
| No unauthenticated open ingress in fixtures mode | **GREEN, unchanged** | Network-sink grep (2.6) — zero matches across `src/`, unchanged from round 2. |

No regression found in any previously-GREEN control.

---

## Findings

| ID | Severity | Location | Finding | Notes |
|----|----------|----------|---------|-------|
| D-01 | INFO | `migrations/0001_wp0_operational_baseline.sql:197-198` | `processing_state_claimable_idx` covers `(state, lease_expires_at)` but not `next_attempt_at`. Once a real Postgres implementation exists, the due-retry query path (`state IN (failed,partial) AND next_attempt_at <= now() AND attempt_count < cap`) would need a composite index covering `next_attempt_at` to avoid a scan. | Pre-Postgres-wiring indexing note, not a fixtures-PR defect — no Postgres implementation exists yet to be inefficient. Not a security/correctness issue. Carry to the eventual real-store implementation task, not this gate. |
| D-02 | INFO | `services/fusion-capture-gateway/src/store/operationalStore.js:213-224` | `claim()` does an O(n) scan of all in-memory records per call. | Fixture-implementation characteristic (in-memory Map, small deterministic test datasets) — expected and fine for tests. Not a security issue: does not affect claim legality, ordering, or the attempt cap (all independently proven, see 2.1). Not inflated to a performance/security finding for this PR. |
| D-03 | INFO | `Builds/BUILD-002-unified-personal-capture-gateway/Architecture/supabase-operational-foundation-boundary.md` §1.1.2 | Real Postgres claim design (conditional UPDATE / `SELECT ... FOR UPDATE SKIP LOCKED`-class pattern) is documented but not built — Postgres isn't wired in this PR. | Correctly out of scope for fixtures. Re-verify the actual implementation matches this documented intent once Postgres is wired (F-09/F-10-adjacent, not a new pre-live condition on its own — folded into "verify at wiring"). |
| D-04 | INFO | `services/fusion-capture-gateway/src/erasure.js:72-85`; `test/erasure.test.js:166-202` | Erasure-tamper-catch fix (Sonnet review area F) independently re-verified: a foreign/tampered `destination_ref` no longer throws uncaught out of `erase()`; the PII-carrying operational row is still removed; the foreign file is never touched. | Positive finding — a real robustness fix, not a residual gap. No action needed. |
| D-05 | INFO | `services/fusion-capture-gateway/migrations/0001_wp0_operational_baseline.sql` (FK constraint names); `test/migrations.test.js` | Explicit FK constraint naming + static cross-file test closes a real "silent implicit-name drift" risk between `0001` and `0002`. | Positive finding. No action needed. |

**No CRITICAL, no HIGH, no MEDIUM, no LOW findings in this delta.** All five
items are INFO — forward-looking notes for the real Postgres implementation or
positive confirmations of fixes, none of which block this fixtures-only PR.

---

## Step 4 — pre-live conditions status (unchanged from round 2 unless noted)

| ID | Condition | Status this delta |
|----|-----------|--------------------|
| F-04 | Rate limiting / flood control | **Unchanged, correctly still deferred.** `telegramAdapter.js`/`intake.js` untouched this delta. No rate-limit code added or removed. |
| F-05 | Access logging (capture-write / raw-object-read, who/what/when) | **Unchanged, correctly still deferred.** `worker.js`'s new logging (`delivery_dead_lettered`, `governed_write_failed`) adds *failure*-path structured logs but does not add the still-missing *success*-path access log for capture-write/raw-object-read. Not worsened, not closed. |
| F-07 | Restrictive production RLS policies | **Unchanged, correctly still deferred.** `0002` explicitly does not add a policy or disable RLS (2.4). Deny-by-default preserved. |
| F-08 | Retention enforcement (raw-object retention-class enforcement in code) | **Unchanged, correctly still deferred.** No code touched this delta enforces `retained`/retention class on raw-object creation. |
| F-09 | Worker transport auth | **Unchanged, correctly still deferred.** Worker still pulls in-process (`worker.js` — no network listener; grep confirms, 2.6). D-03 above folds the real-Postgres-claim-design verification into this same "verify at wiring" bucket. |
| F-10 | Webhook/poll authenticity | **Unchanged, correctly still deferred.** `telegramAdapter.js` untouched; still no network/webhook code in fixtures. |

None of F-04/F-05/F-07/F-08/F-09/F-10 are marked complete. None were
accidentally worsened. None are newly blocking. All remain pre-live-wiring
conditions per `SECURITY.md §7`, unchanged in substance by this delta.

---

## Overall verdict and merge-security position

**Overall verdict: PASS.**

**Merge-security position: SECURITY DELTA GREEN — FIXTURES PR READY FOR FINAL QA / MERGE DECISION.**

Zero open CRITICAL/HIGH — the precondition for GREEN is met. Every required
delta test in Step 2 was independently re-run or re-derived from code, not
trusted from the PR body or prior checkpoints. No regression in any
previously-GREEN control (Step 3). All five findings are INFO-level forward
notes or positive confirmations (Step 4/Findings table) — none block merge.

**This delta does NOT constitute live-production approval.** No real
credentials or personal data were used anywhere in this review (all commands
ran against the in-memory/sandbox fixtures; the one live probe was a throwaway
script run and discarded). WP0's live phone-visible acceptance proof remains
pending — real Supabase/Telegram provisioning is not authorised by this
report. This report covers only PR #28 at head `2bd51da7c33a6c86382fedcabaaa255f756320f7`.

**Exact next action:** Larry may proceed to final QA / merge decision on PR
#28. Before real secrets are provisioned and the live phone-visible proof runs,
the six pre-live-wiring conditions (F-04, F-05, F-07, F-08, F-09, F-10) in
`SECURITY.md §7` still need to be closed and Vex re-signs at that point — this
delta does not shortcut that gate, it only clears the fixtures-merge bar for
PR #28's current changes.

*No implementation code, tests, or migrations were modified by Vex during this
review. No `git add`/`commit`/`push` was run — Larry handles git. The one
tamper/traversal probe in Step 2.3 ran against throwaway in-memory/sandbox
state and left no artifacts.*

---

## Links

- [[wp0-security-gate]] — the gate definition this review checks against.
- [[wp0-security-gate-execution-2026-07-16]] — round 1/round 2 history (preserved, not rewritten).
