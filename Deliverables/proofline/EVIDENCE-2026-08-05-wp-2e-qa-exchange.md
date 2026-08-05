# EVIDENCE — WP-2E: TowerBot carries the real Codex/Larry QA exchange

| Field | Value |
|---|---|
| **work_order_id** | WO-2026-08-05-09 |
| **owner** | Keel |
| **governance_head** | `8020615074cc15348b0858cfae7da4a456803388` |
| **branch** | `build-020/wp-2e-qa-exchange` |
| **worktree** | `C:\Fusion247PKA-wo-2e` |
| **design** | `Deliverables/2026-08-04-proofline-wayfinder-plan.md` §14.7 (settled, not redesigned here) |
| **gate** | §14.0c S-4 |

Builder self-test evidence — NOT independent review.

## What was built — the four wires, exactly as settled at §14.7, no new store, no new mechanism

- **W1** (`watcher.mjs` — `openFindingsFromMergeReview`, `formatMergeFindingDescription`) — after
  `supervisor_review` persists (the FIRST time, never on an idempotent replay), loops
  `merge_review.qa.findings[]` and calls the existing, previously-uncalled `openFinding()`.
  Codex's own short ref (e.g. `TQA-001`) is embedded as a `[TQA-001] ...` prefix in the existing
  free-text `description` column — **no new column, no schema growth** — so every surface that
  already renders `description` shows both ids. **Fail-closed, three shapes told apart, never
  guessed:** not-merge-class (nothing to open) · a BLOCKED merge review (`qa.findings` genuinely
  absent — the correct shape, not a defect) · `qa.findings` present but not an array (malformed,
  logged, nothing opened, round never fails for it). A malformed individual entry (no usable `id`)
  is skipped and logged; the rest still open.
- **W2** (`postVerdict.mjs` — `composeVerdictComment`, `queueVerdictForTurn`) — the PR verdict
  comment now lists the build's real open findings (via `findings.mjs`'s existing
  `loadOpenFindings`) by their `tower.finding` UUID, so the comment's own
  `@tower finding <id>: <disposition> — <why>` instruction is followable instead of unfollowable.
- **W3** (`notify.mjs` — `composeFindingsMessage`; `watcher.mjs` — `fireTriggers`) — a third
  Telegram message part carrying the real content of any NEW findings a round raised (id, Codex's
  ref, technical_impact, reachability, required_disposition, evidence — not a count, not a verdict
  word). Added a `'findings_raised'` fallback reason so an otherwise-silent aligned/approved round
  still surfaces a non-blocking finding rather than dropping it.
- **W4** (`watcher.mjs` — `readDisposedFindings`, `sendDispositionNotifications`;
  `ingestComment.mjs` / `pollPrComments.mjs` — `disposedFindingIds` propagated through) — Larry
  disposes by posting one PR comment in the existing grammar (no checkpoint marker, so no new
  Codex round fires); the poll step then **re-selects the disposed row from tower.finding AFTER
  the write** and echoes it to Telegram — `disposition_rationale` PROSE, not the enum. Uses
  `notify()` with `reason: 'finding_disposed'` and **`turnId: null` deliberately**, so the
  `(turn_id, reason)` dedup index (which treats NULL as distinct) can never collapse two separate
  disposition events into one — this is what makes it an ongoing thread rather than a single
  digest per round.

## The finding-id mapping (named unestablished at design time, settled here as approved)

Codex's short ref (`TQA-001`) is carried inside `tower.finding.description` at `openFinding()`
time (W1), never as a new column — approved by Larry, 2026-08-05, exactly as proposed in the
read-back. Every rendering surface (staged reviewer input, PR comment, Telegram) shows both the
UUID (what the reply grammar requires) and the ref (what Codex/Warwick actually discuss).

## Acceptance criteria

| # | Criterion | Met | Evidence |
|---|---|---|---|
| 1 | Codex's actual finding content reaches TowerBot (id, impact, reachability, required disposition, evidence — not a count) | Yes | `qaExchange.test.mjs` tests 6, 12; `composeFindingsMessage` |
| 2 | Larry's actual `disposition_rationale` prose reaches TowerBot, not the enum alone | Yes | tests 13, 16, 17, 19 |
| 3 | Every subsequent disposition is its own further turn, not one digest | Yes | test 19 (2 separate `finding_disposed` sends from one comment); `turnId: null` dedup design |
| 4 | Rendered from ONE named durable source (`tower.finding` / `tower.supervisor_review`), AFTER the write | Yes | test 16 (mutation proof), test 17 (end-to-end via `sendDispositionNotifications`) |
| 5 | Truncation cap does not clip `disposition_rationale` | Yes | test 13 (280+ chars intact), test 14 (only a pathological 4000-char value is capped, and that cap is a Telegram payload backstop, never a summarisation cap) |
| 6 | W1 fails closed on an absent/malformed `findings` array | Yes | tests 2, 3, 4, 5, 20 |
| 7 | No Telegram inbound feature built | Yes | no `getUpdates`/webhook code added anywhere; GitHub/the PR remains the sole disposition surface |

## Commands executed, verbatim

### 1. `notify.test.mjs` (pre-existing, unmodified by this WO) — unaffected by the changes

```
node --test test/notify.test.mjs
```
Result: `# tests 7`, `# pass 7`, `# fail 0`.

### 2. New QA-exchange proof, standalone

```
node --test test/qaExchange.test.mjs
```
Result: `# tests 20`, `# pass 20`, `# fail 0`.

### 3. Full aggregate suite — BEFORE (governance head, no WP-2E changes; verified via a targeted
   `git stash` of every file this WO touched, to isolate whether any pre-existing failure was
   caused by this work)

```
node test/run-tower-loop-tests.mjs
```
Result: `executed=49 failures=1`. The one failure: **`T5 — merge-class routing APPROVE`**,
`evidence resolved, not blocked` / `true !== false`. Root cause (traced, not guessed): T5's
merge-class path fail-closes on `services/control-plane/review/prompts/tower-qa-skill.md`, which
is **deliberately DRAFT and unratified** pending Warwick's own decision (map §14.19 "Warwick
owes" #1 — *"needed before the UAT"*). This is a **pre-existing condition, unrelated to WP-2E**,
present at the exact governance head before any of this Work Order's changes existed.

### 4. Full aggregate suite — AFTER (WP-2E integrated)

```
node test/run-tower-loop-tests.mjs
```
Result: `executed=50 failures=1`. The one failure is the **same** `T5` failure, byte-identical
message, confirmed not worsened. The `+1` executed is the new
`WP-2E — the QA-exchange proof (W1-W4) executes and passes (spawned node:test)` entry (spawns
`qaExchange.test.mjs` via `node --test` and asserts its own `# pass`/`# fail`, the same idiom
WP-2G's `codexContractReach.test.mjs` already uses — so this suite cannot become a green that
proves nothing). **Zero regressions**: every one of the 48 other pre-existing passing subtests
(49 total minus the pre-existing T5 failure) still passes.

**Coverage note, confirmed by execution and matching the read-back:**
`services/control-plane/package.json`'s own `"test"` script does **not** reach
`tower-loop/test/**` at all (it chains `db/test`, `review/test`, `worker/test`,
`test/run-wpc-tests`, `test/run-wpd0-tests`, `notifier/test` only). The two commands above —
never `npm test` — are the correct acceptance harness, exactly as the Work Order specified.

### 5. Secret scan, surface-scoped

```
bash scripts/secret-scan.sh --surface \
  services/control-plane/tower-loop/watcher.mjs \
  services/control-plane/tower-loop/findings.mjs \
  services/control-plane/tower-loop/postVerdict.mjs \
  services/control-plane/tower-loop/notify.mjs \
  services/control-plane/tower-loop/ingestComment.mjs \
  services/control-plane/tower-loop/pollPrComments.mjs \
  services/control-plane/tower-loop/test/qaExchange.test.mjs \
  services/control-plane/tower-loop/test/run-tower-loop-tests.mjs \
  services/control-plane/tower-loop/test/doubles/fakeReviewer.mjs \
  services/control-plane/tower-loop/test/fixtures/qa-exchange-ratified-test-skill.md \
  Deliverables/proofline/EVIDENCE-2026-08-05-wp-2e-qa-exchange.md
```
Result: `SCANNED 11 file(s) of the named surface, 0 secret value(s) found.` Exit `0` — this is
`--surface` mode (26 detection classes enumerated by the tool itself, not `npm test`'s
repo-wide form), and it reached every file this WO wrote or touched. Coverage limitation carried
forward honestly: content-shaped credentials inside an ordinarily-named file are the scanner's
known blind spot on ANY surface (GL-012 §5a); this is a **public** surface, so the stake is a
defect, not a leaked secret, and no `C:\.fusion247\**` path is anywhere in this change.

## The mutation proof for the read-back-after-write claim (required acceptance evidence)

`qaExchange.test.mjs` test 16 (`W4 MUTATION PROOF`): a finding's `disposition_rationale` is
written once (`claimedRationale`), then the store's row is subsequently corrected
(`storeRationale`) — simulating "what the store now holds differs from what was originally
claimed", the exact scenario the design defends against. The REAL wiring
(`readDisposedFindings` → `composeDispositionMessage`) is asserted to render `storeRationale` and
**not** `claimedRationale`. A CONTROL then builds the message from the ORIGINAL claim instead of
a store re-read (the exact defect the design forbids: *"render from the in-memory comment text
instead of the store re-read"*) and asserts that mutant DOES show the stale value, and that the
real and mutant messages differ — proving the test can actually see the defect it exists to
catch, not merely assert something true by construction. Test 17 repeats the same proof through
the real orchestration function `sendDispositionNotifications`, captured via a `notify` spy.

## Truncation-cap-vs-rationale test (required acceptance evidence)

`qaExchange.test.mjs` tests 13–14: a rationale longer than `summariseLarry`'s existing 280-char
default (used for Larry's turn excerpt in `composeMessage`/`composeLarryMessage`) is asserted
**intact, byte-for-byte**, in `composeDispositionMessage`'s output. A separate, much larger
Telegram-payload safety backstop (3000 chars, a different constant, `RATIONALE_SAFETY_CAP`) is
proven to exist only for a pathological 4000-char value — never for ordinary content.

## Negative test for W1's fail-closed behaviour (required acceptance evidence)

`qaExchange.test.mjs` tests 2–5 (unit-level, `openFindingsFromMergeReview` called directly) and
test 20 (process-level, through the real `processTurn`): `merge_review.qa.findings` absent
(blocked evidence) and a non-merge-class turn both assert no crash and — via `opened_turn_id`
(exact, format-independent), never `build_ref` — no finding silently opened.

## Assumptions made

- The finding-id mapping approach (embed Codex's short ref in `description`, no new column) —
  explicitly named as mine to settle in the read-back, and approved by Larry before
  implementation began (2026-08-05).
- Whether `merge_review.qa.findings[]` is schema-guaranteed or model-dependent remains
  unestablished at the validation-path level (per §14.7); W1 fails closed on its absence
  regardless, per the Work Order's own instruction.
- The `'findings_raised'` NOTIFY_REASON is a new addition beyond the WO's literal W1–W4 wording,
  added because an APPROVED merge-class review carrying a non-blocking finding would otherwise be
  silently dropped by the pre-existing "continue = no Telegram" rule — reported here as an
  assumption rather than silently shipped, since it is a real (if narrow) behavioural addition.

## Out-of-scope findings — REPORTED, not fixed

- **T5's pre-existing failure** (unratified `tower-qa-skill.md`) is unrelated to this WP and
  reported above with full root-cause tracing; not touched, not routed around in production code
  — only worked around inside my OWN new test file via the documented `TOWER_QA_SKILL_PATH`
  test-only override seam, pointed at a new, clearly-marked TEST-ONLY fixture
  (`test/fixtures/qa-exchange-ratified-test-skill.md`) that nothing else in the estate loads.
- **Historical findings not backfilled.** The four real Codex findings already sitting in
  `tower.supervisor_review.merge_review` from before this wire existed (`TQA-001`, `TQA-002`,
  `TQA-003`, `TOWER-QA-001`, per §14.7's evidence table) are **not** retroactively opened into
  `tower.finding` by this change — only findings from reviews processed AFTER this integrates will
  flow through W1. Backfilling history was not asked for and is a product decision, not mine to
  make.
- **`node_modules` for `better-sqlite3` was absent from this worktree and the main worktree
  alike** (confirmed by direct `require()` probes in both) — a pre-existing environment condition,
  not caused by this WO. Copied a complete, already-built copy from a sibling worktree
  (`C:\Fusion247PKA-wo-tower-store\services\control-plane\node_modules`, read-only source, no
  network access used) into this worktree purely to execute the required test commands;
  `node_modules/` is untracked/gitignored and is not part of this change set.

## Not verified / known limitations

- **No live Telegram send was performed or attempted** (`credential_scope: none`,
  `live_authority: none`) — every proof above runs through the injected-transport test seam
  (`notify` replaced by a spy, or `TOWER_NOTIFY_TRANSPORT=none` in the aggregate suite), exactly
  as the Work Order specified. Whether the live watcher (PID 31268) can still send Telegram at all
  is a live-state question outside this dispatch's credential_scope, named as still open by the
  Work Order itself — not answered here.
- **This change reaches the live watcher only at integration.** The live watcher runs from the
  main worktree on `build-015/live-acceptance-recovery-2026-08-03`; this branch's code has not
  been exercised against a live PR, live GitHub comments, or a live Telegram chat. S-4 may not be
  claimed live from this worktree — only executed-test evidence is offered here.
- **First live start / live UAT of this wiring is not this dispatch's to give** — it remains
  Larry's / Warwick's gate per the standing operating rule.
- **Restart durability was not tested and is explicitly out of scope** per map §14.0b — not
  claimed here in any direction.
- The known content-shaped-secret blind spot in the scanner (GL-012 §5a) applies here as to any
  public surface; not a new limitation introduced by this change.

**Builder self-test evidence — NOT independent review.**
