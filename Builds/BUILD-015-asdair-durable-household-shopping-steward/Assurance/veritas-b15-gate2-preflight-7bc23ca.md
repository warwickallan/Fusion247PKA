---
build: BUILD-015
scope: gate2-current-state-preflight
gate: 2

boundary: >
  Gate 2 CURRENT-STATE PREFLIGHT for BUILD-015 AsdAIr — read-only readiness verification of the
  live production system at Gate-1-PASS integrated head `7bc23ca`, establishing whether it is
  genuinely ready to receive one real photograph and carry it correctly through to a reconciled
  trolley, per the six points named in Larry's dispatch. NOT the Gate 2 live-journey review itself
  (reserved for after Warwick sends a real photograph, per his own explicit sequencing).

reviewed_sha: 7bc23ca744762502c99731c23dffd1494f85c937
governance_sha: 7bc23ca744762502c99731c23dffd1494f85c937
branch: main

evidence_method: live runtime (primary — OS process table, scheduled tasks, live Postgres via asdair_ro) + target checkout (git log/diff for provenance). No mutation testing performed; no export needed.
evidence_workspace: n/a (no export taken this review)
worktree_head_at_start: 7bc23ca744762502c99731c23dffd1494f85c937
worktree_head_at_end: 7bc23ca744762502c99731c23dffd1494f85c937
worktree_status_clean: true

verdict: HOLD
receipt_sha256: 80903cf20078760bb2349e51a37d901b3d081f4d5b1fda88948c5db9862a2dcf
reviewed_by: veritas
reviewed_date: 2026-08-11
next_review_trigger: >
  Any further code change to the files named in the Gate 1 receipt's production-caller chain, to
  services/asdair/cockpit-api/assembleWorkspace.js or readWorkspace.js, to shopState.js's
  nextShopRef/collisionShopRef, or to the browser-runner's command allowlist — OR the Gate 2
  live-journey review itself, once Warwick sends a real photograph — OR a material change to the
  durable shop state this preflight measured (a new SHOP-2026-08-11 row, a status change on either
  of the two live shops). A restart of MyPKA-AsdAIr-ReadService alone does not require a new full
  preflight — it is the named remedy for Defect #2, not a product change.
---

## Scope reviewed

A read-only **CURRENT-STATE PREFLIGHT** ahead of BUILD-015 AsdAIr's Gate 2 live-journey review —
not the live journey itself (no photograph has been sent). Six specific readiness questions named
in Larry's dispatch, each independently re-established by direct execution and inspection of the
live production system at integrated head `7bc23ca` (Gate 1 `PASS`, confirmed at `eb7c7ad` +
addendum at `1473ef7`, zero `services/` diff since). **Deliberately NOT in scope**: anything
requiring an actual photograph to have been sent (reserved for the separate Gate 2 live-journey
review); Gate 3 documentation reconciliation (already opened and parked at Gate 1 for
`rotation-handover.md`; not re-litigated here beyond naming one directly-relevant extension found
during this review).

**Dispatch ceiling note (procedural, non-blocking):** the dispatch named no explicit elapsed-time
or token ceiling. Per this contract's Method 1b the honest default is the minimum needed to bind
heads, prove isolation and execute the primary journey, then `HOLD — dispatch ceiling missing`. No
primary user journey applies to this scope (explicitly excluded by the dispatch itself, since no
photograph exists yet), so the six explicitly-named questions were treated as that floor and no
open-ended investigation was performed beyond them. Recorded as a dispatch-hygiene defect, not
treated as grounds to withhold the substantive, decision-relevant findings below — the overall
verdict already independently gates on a genuine, named finding (see requirement 3).

## Accepted requirements

| # | Requirement | Verdict | Evidence | Residual |
|---|---|---|---|---|
| 1 | Runtime identity and health, independently re-verified (not trusted from Larry's numbers) | PASS | `ensure-asdair-runtime.mjs --status` re-executed by Veritas using the exact scheduled-task action (`Get-ScheduledTask -TaskName MyPKA-AsdAIr-Runtime`, resolved independently, not asked of Larry). Confirms PID 8920, `mode: live`, `identity_verified: true` (OS process table cross-checked against the runtime lock), `dependencies.ok: true` (pg resolvable from all 7 calling folders), armed. **Byte-currency independently derived, not copied from Larry**: `git log` shows `7bc23ca` (current HEAD) committed `2026-08-11T03:14:08Z`; runtime `started_at: 2026-08-11T03:14:59.219Z` — 51s later; `git diff --name-only eb7c7ad..HEAD -- services/` is empty (the two commits after `eb7c7ad` are Assurance-receipts-only). The runtime is therefore genuinely running the Gate-1-passed product bytes, not merely a plausible-looking PID. | A first `--status` run reported `healthy: false` with `problems: ["runtime liveness could not be judged: the runtime log was last written in the FUTURE..."]`. Traced to source (`runtime-deps.mjs assessLiveness`): `nowMs` is captured before the log is read, and the live runtime wrote a new line in that ~285ms window, making `last_write_at` briefly newer than the captured `nowMs` — a benign ordering race in the tool itself, not a real clock or liveness defect. Confirmed self-resolving: re-run 48s later returned `healthy: true`, `stalled: false`, `problems: []`, exit 0. Recorded as a LOW, non-blocking tool-hygiene finding (Defects #1). |
| 2 | Gateway/vision readiness (AC6/AC7), freshly re-confirmed this session, not hours-old | PASS | `ensure-asdair-runtime.mjs --preflight` executed fresh, this session: `AC6 FUSION_GATEWAY_URL is reachable` → true (`100.101.240.85:4000 answered (HTTP 401)`); `AC6 FUSION_GATEWAY_KEY authenticates` → true (HTTP 200); `AC7 FUSION_MODEL_VISION is present in the gateway's own /models response` → true (`'gpt-5-mini' is served by this gateway (9 model(s) offered)`). All three `severity: blocking`, all `ok: true`. | none |
| 3 | Full intended live path genuinely wired in the CURRENTLY RUNNING code, every hop, from zero prior state | **HOLD** | Pipeline hops confirmed wired in the running process (PID 8920, byte-current per row 1): `pollIntake` → `commands.receiveList` (`runtime.js:175`, read directly) creates/resumes the shop; stage table (`stages.js` `STAGE_TABLE`, read in full) shows `RECEIVED` legally gated on `commands.buildShop` ("Warwick tapping 'Build this shop'" — a real human gate, not automatic, matching the dispatch's own phrasing); `buildShop` (`commands.js:351`) is a real, wired Telegram command (`telegramAdapter.js:65`). `stepInterpret`'s confidence gating and provenance persistence, the Photo Read Confirmation Card construction+render, `stepPlan`/questions, and `stepReplan`→`READY_TO_SHOP` were traced in full, hop-by-hop, at Gate 1 (`veritas-b15-22-gate1-eb7c7ad.md` §"Production caller and journey") against the *same bytes* now running (zero `services/` diff since `eb7c7ad`, confirmed row 1) — reused per Method 5 rather than re-walked, since nothing in that chain changed. **The break is in the cockpit hop, not the pipeline.** WO-B15-23 (merged `9967f59`, `08ec03c`, both inside `eb7c7ad`) added a `resolved`/`resolved_count_display` shape to `services/asdair/cockpit-api/assembleWorkspace.js` and a `shop_decision` read to `readWorkspace.js` — genuinely on disk at HEAD. But the **live process serving that data, `MyPKA-AsdAIr-ReadService` (PID 39976, port 8710, CommonJS `require()`-cached)**, was independently confirmed (`Get-Process` StartTime) to have **started `2026-08-11T02:12:04+01:00` (01:12:04Z) — before both `9967f59` (01:35:49Z) and `08ec03c` (02:00:18Z)**. `require()` caches modules at first load in a long-running Node process; this process has not been restarted since those commits landed, so it is serving the **pre-WO-B15-23** `assembleWorkspace`/`readWorkspace` shape (no `resolved` array, no `resolved_count_display`, no `shop_decision` read) even though the frontend static assets (`public/app.js`, `public/apps.js`, served live from disk without restart, per established Cockpit behaviour) now expect that shape. `services/cockpit/server.mjs` itself (the general dashboard shell, PID 23640, port 8090) was independently checked and is **not** affected — its own last product change (`0412a2b`) predates its start, and nothing after that touched `server.mjs`/`db.mjs`/`capae.mjs`/`rotation-report.mjs`. | **Blocking for the cockpit-visibility half of this requirement only.** Remedy is a restart, not a code fix: the scheduled task `MyPKA-AsdAIr-ReadService` (confirmed registered and `Running`) needs stopping and restarting so its next `node` process picks up the current on-disk `assembleWorkspace.js`/`readWorkspace.js`. Until then, Warwick would see the AsdAIr cockpit app's pre-restoration shape — "Open questions" without the new "Resolved" section/counts — during any live journey, contrary to the dispatch's own framing that he can "see everything through the just-restored cockpit app... without needing Larry to translate database rows." |
| 4 | Contamination risk from the two live shops (`SHOP-2026-08-09` READY_TO_SHOP, `SHOP-2026-08-10-M64` NEEDS_DECISION) — a fresh photo today creates a genuinely new, separate shop | PASS | **Measured against the exact next real event, per this contract's "Current readiness is NOT capability"**, not inferred from wiring alone. Live, read-only query (`BEGIN TRANSACTION READ ONLY` / `ROLLBACK`, `asdair_ro` role, no value printed beyond the rows themselves) of `asdair.shop` for all August 2026 rows: **no row exists yet for `2026-08-11`** (8 rows total, most recent dated `2026-08-10`). `nextShopRef(dateISO)` (`shopState.js:300`, read in full) is `'SHOP-' + toDatePart(dateISO)` — pure, date-only, no clock. Since the two live shops sit on `2026-08-09` and `2026-08-10` and today is `2026-08-11` with **zero existing rows on that date**, the exact next inbound photo (whatever time it arrives today) resolves a brand-new `shop_ref` via `createOrResumeShop`'s plain `INSERT ... ON CONFLICT DO NOTHING` first-branch — it is not even the collision path (`collisionShopRef`, the B15-18/`SHOP-2026-08-10` mechanism the Veritas contract's own worked counterexample was built from) that would need to fire. That collision mechanism was independently confirmed present and correctly grounded on the inbound Telegram message id (`shopState.js:321-339`, read in full) as a second line of defence should a same-day collision ever occur. Cross-shop answer-routing scoping (`recordedAnswerMatches` via `shop_id`) and `shop_id` emission (B15-21) were independently re-verified by Veritas at Gate 1 against these same bytes (2178/0 suite, two of Veritas's own mutation kills). | The three currently-open questions (`questions_open: 3` in the live status) belong to `SHOP-2026-08-10-M64` (NEEDS_DECISION); not re-verified line-by-line here beyond the shop-scoping mechanism already proven at Gate 1 — proportionate given no date collision exists for this to interact with. |
| 5 | Gate Zero input-truth mechanism live — a fresh photo will genuinely populate `shop_line.match_confidence` and `shop.transcript_provider`/`transcript_model`/`transcript_confidence` through the actually-running process | PASS (mechanism confirmed live; **not yet exercised** — that is Gate 2's job) | Live schema, independently queried (read-only, `information_schema.columns`): `asdair.shop` genuinely carries `transcript`, `transcript_provider`, `transcript_model`, `transcript_confidence`, `needs_review` columns; `asdair.shop_line` genuinely carries `match_confidence`; `asdair.shop_decision` exists (migration 017). Code wiring for this exact chain (`deps.js realInterpretPhoto` → `resolveByCatalogue.applyVisionConfidenceGate` → `runPipeline.js` → `shopLines.upsertLines` / `store.advanceWithList`) was traced hop-by-hop and independently mutation-tested by Veritas at Gate 1 against the identical bytes now running (row 1). AC6/AC7 gateway reachability re-confirmed fresh this session (row 2), so the model call this chain depends on is genuinely reachable right now, not merely wired in principle. | Per this contract's own anti-overclaim rule: this is CAPABILITY plus a checked precondition, not proof of the real event. No photograph has been submitted in this review (correctly reserved for Warwick, per the dispatch). |
| 6 | The "never auto-substitute" toggle is understood as a manual operational step, not a code guarantee | PASS | Read directly, not inferred: `browser-runner/runner.js`'s own header states its closed command surface guarantees "no substitution - not disabled, absent" — there is no command in `commands.cjs`'s allowlist that touches ASDA's substitution setting at all. `renderMessages.js`, `skill/rulebook.js`, `skill/planner.js` and `assembleWorkspace.js` all treat "never auto-substitute" as a rendered instruction/flag/policy string surfaced to Warwick, never as an enforced action. This matches `Deliverables/2026-08-11-rotation-handover.md`'s own real-world finding from the Aug 10 rescue (the ASDA site's "Allow substitutions for all" toggle was left ticked, with no mechanical enforcement under the supervised adapter) — code and lived experience agree. | none — Larry/Warwick must remember to untick it in the browser before checkout, as already documented. |

## Evidence provenance

- Inspected the **live production system directly** — the primary checkout (`C:/Fusion247PKA`), the running OS processes, the scheduled tasks, and the live Postgres database via its own read-only role — per this contract's "reviewer stands beside the work" and "evidence isolation" sections, which explicitly permit and sometimes require live-runtime inspection for question 1. No mutation testing was performed this review (nothing to mutate; this is a state-inspection preflight), so no `git archive` export was needed.
- Repository `git rev-parse HEAD` at start / end of this review — `7bc23ca744762502c99731c23dffd1494f85c937` / `7bc23ca744762502c99731c23dffd1494f85c937`, identical.
- Repository `git status --porcelain` — empty, unchanged start to end.
- `7bc23ca` confirmed remotely reachable: `git branch -r --contains 7bc23ca` → `origin/build-015/durable/2026-08-11-rotation`.
- Database access: three read-only queries, each wrapped `BEGIN TRANSACTION READ ONLY` / `ROLLBACK`, using `ASDAIR_DB_URL` (role `asdair_ro`) loaded via the same `--env-file` pattern the scheduled task itself uses. No credential value was printed; only query results (shop refs, statuses, column names) were read.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `node ensure-asdair-runtime.mjs --status` (1st run) | 1 | n/a (status document) | `healthy: false` — transient tool-ordering race, see requirement 1 residual |
| `node ensure-asdair-runtime.mjs --status` (2nd run, 48s later) | 0 | n/a | `healthy: true`, `stalled: false`, `problems: []` |
| `node ensure-asdair-runtime.mjs --preflight` | 1 (expected — AC9 correctly refuses a 2nd poller while PID 8920 holds the lock) | 21 named checks | All blocking checks PASS except AC9 (expected/correct refusal, not a readiness defect); AC6/AC7 both PASS; one ADVISORY-severity schema-drift finding (2 ungoverned grants on `budget_settings`/`product_alternatives` — recorded, non-blocking, out of this review's scope) |
| `git log` / `git diff --name-only eb7c7ad..HEAD -- services/` | 0 | n/a | Empty diff; commit timestamps independently establish runtime byte-currency |
| `SELECT shop_ref, status, telegram_message_id, list_id, created_at, updated_at FROM asdair.shop WHERE shop_ref LIKE 'SHOP-2026-08-%'` (read-only txn) | 0 | 8 rows | No `2026-08-11` row exists; the two live shops sit on distinct, non-colliding dates |
| `information_schema.columns` queries against `asdair.shop`, `asdair.shop_line`, `asdair.shop_decision` (read-only txn) | 0 | 3 queries | All Gate-Zero-relevant columns and the `shop_decision` table confirmed live |
| `Get-Process` / `Get-CimInstance Win32_Process` / `Get-NetTCPConnection` / `Get-ScheduledTask` (PowerShell, read-only) | 0 | n/a | Identified PID 39976 (cockpit-api, port 8710, stale) and PID 23640 (general Cockpit, port 8090, current) and the `MyPKA-AsdAIr-ReadService` task (registered, `Running`) |

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | PASS | Answers exactly the six questions Larry's dispatch named, which themselves implement Warwick's own explicit sequencing (Gate Zero → Gate 1 → Gate 2 preflight → ask for a photograph). |
| Design fidelity | PASS | Used only the sanctioned tools (the scheduled task's own resolved action, `--status`/`--preflight`) plus read-only, transaction-wrapped database queries mirroring the tool's own established pattern; no credential value printed; no mutation of live state. |
| Functional proof | HOLD | Five of six requirement rows are clean PASS on freshly-gathered evidence; requirement 3 names a genuine, currently-live gap. |
| Integration | HOLD | Same basis as Functional proof — the pipeline is genuinely integrated and byte-current; the cockpit-api read-service process is not yet running the integrated bytes it already has on disk. |
| Durability | n/a | Nothing new was introduced or claimed durable by this review; `7bc23ca`'s remote reachability was confirmed as a precondition, not graded as a new durability claim. |
| Test quality | n/a | No new tests were written or run; Gate 1's suite evidence was reused (Method 5) against the confirmed-identical bytes rather than regenerated. |
| Git truth | PASS | Every SHA, timestamp and diff claim in this receipt was independently computed by Veritas, not copied from Larry's dispatch or from the rotation handover. |
| Documentation truth | HOLD (non-blocking for this preflight; extends an existing Gate 1 finding) | `Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md`'s own "READ FIRST" block (last touched `1fef79a`, before `eb7c7ad`) still tells a fresh reader "No photograph acceptance journey may be attempted until input truth is proven (Gate Zero)" as an open blocker — it is not; Gate Zero is integrated and Gate-1-`PASS`ed. This is the same underlying staleness Gate 1 already named for `rotation-handover.md` (parked for Gate 3), now confirmed to extend to the Wayfinder plan itself. Named here because it bears directly on this preflight's own question ("should Larry ask for a photo"), but not re-opened as a new gate — it does not misdirect *toward* an unsafe action, only *away* from a now-safe one, and Larry already holds the correct current facts independent of that document (this receipt, plus Gate 1's). |
| Residual risk | HOLD | Requirement 3's cockpit-api staleness is the one concrete, currently-live, immediately actionable residual from this review; every other residual named above is honestly bounded and non-blocking. |
| Completed automation | n/a | Nothing in this scope claims a newly-automatic production outcome. Requirement 6 specifically confirms the OPPOSITE is honestly labelled — that substitution handling is manual, not automated — which this dimension does not grade. |

## Production caller and journey

Traced end to end, hop by hop, mixing fresh confirmation (rows 1, 2, 4, 5's schema) with reused Gate-1 evidence against the confirmed-identical bytes (row 1's zero-diff proof licenses this reuse under Method 5): Telegram photo → `pollIntake` (`runtime.js:125`) → `commands.receiveList` (`runtime.js:175`) → durable `asdair.shop` row (`RECEIVED`) → Warwick taps "Build this shop" → `commands.buildShop` (`commands.js:351`, wired via `telegramAdapter.js:65`) → `TRANSCRIBING`/`PROCESSING` → `deps.interpretPhoto` (real vision call, gateway independently confirmed reachable this session) → `resolveByCatalogue.applyVisionConfidenceGate` → `shopLines.upsertLines` (writes `match_confidence`, column confirmed live) + `store.advanceWithList` (writes the three transcript-provenance columns, confirmed live) → Photo Read Confirmation Card queued → `runtime.js drainOutbox` → `bot.messages.photo_read` → Telegram (all traced and mutation-evidenced at Gate 1, same bytes) → `NEEDS_DECISION`/`READY_TO_SHOP` per the stage table → **cockpit visibility** → **BROKEN HOP**: `services/cockpit/public/app.js` (current, static, served live) fetches AsdAIr workspace data from `services/asdair/cockpit-api` (port 8710), whose live process (PID 39976 / `MyPKA-AsdAIr-ReadService`) is running `assembleWorkspace.js`/`readWorkspace.js` as they existed **before** WO-B15-23 — a restart away from correct, not a code defect — → (once restarted) `stepReplan` → `READY_TO_SHOP` → browser handoff (`WAITING_FOR_BROWSER`/`SHOPPING`, B15-19, integrated and Gate-1-verified against these bytes).

## Restart and durability

n/a for a new durability claim — nothing new was written or claimed persistent by this review. Noted for context: PID 8920 has held the single-poller lock continuously since `2026-08-11T03:14:59Z`, confirmed by AC9's correct refusal to start a second poller; this is corroborating evidence of continuous, single-writer operation, not a fresh restart drill.

## Documentation contradiction scan

- Larry's declared context in the dispatch: PID/health/head figures, the Gate 1 receipt and addendum, the two live shops and their statuses. Verified accurate against independent execution in every case checked (row 1's numbers, row 4's shop statuses).
- Verified independently, not asked of Larry: the scheduled task's exact resolved action (`Get-ScheduledTask -TaskName MyPKA-AsdAIr-Runtime`), the AsdAIr cockpit-api process's actual start time versus the WO-B15-23 commits, and the Wayfinder plan's staleness (above).
- What Larry's dispatch did not disclose (not necessarily known to him): the AsdAIr cockpit-api read-service process had not been restarted since the WO-B15-23 backend commits landed.
- Active documents that would misdirect a fresh instance: `Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md`'s "READ FIRST" block understates current readiness (see Documentation truth dimension) — non-blocking for this preflight, extends the existing Gate 1 Gate-3-parked finding.
- Closure claims since the last receipt, and the receipt behind each: none found asserted since the Gate 1 addendum (`1473ef7`) beyond this preflight itself, which makes no closure claim.

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| 1 | LOW (tool) | `ensure-asdair-runtime.mjs --status`'s liveness check can transiently report "clock moved" when its `nowMs` snapshot is captured moments before the concurrently-running poller appends a new log line; self-resolves within the normal poll interval, not a real defect. | non-blocking | n/a (informational) |
| 2 | **HIGH (operational, immediately actionable)** | `MyPKA-AsdAIr-ReadService` (PID 39976, port 8710) is running `assembleWorkspace.js`/`readWorkspace.js` as they existed before WO-B15-23 (`9967f59`, `08ec03c`) — started `01:12:04Z`, before both commits (`01:35:49Z`, `02:00:18Z`). Warwick would not see the restored "Resolved vs still waiting on you" cockpit view until this process is restarted. | **blocking for requirement 3's cockpit-visibility half only** | Larry (restart `MyPKA-AsdAIr-ReadService`; no code change needed) |
| 3 | LOW | ADVISORY schema drift: `asdair_rw` holds `SELECT` on `asdair.budget_settings` and `asdair.product_alternatives` that no committed migration grants. | non-blocking — out of this preflight's named scope | n/a (flagged, not this review's to chase) |
| 4 | LOW | `Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md`'s "READ FIRST" block still reads as though Gate Zero is unresolved; it is resolved and Gate-1-`PASS`ed. | non-blocking — extends the existing Gate 1 finding, parked for the next Gate 3 pass | Larry |
| 5 | INFORMATIONAL (procedural) | Dispatch named no explicit elapsed-time/token review ceiling (Method 1b). | non-blocking — see Scope note | Larry |

## Verdict

**HOLD** — Five of the six named readiness questions are genuinely `PASS` on freshly-gathered,
independently-executed evidence: the runtime is byte-current and healthy; the vision gateway is
reachable and serving the expected model right now; a fresh photo today lands cleanly on a new,
uncontaminated shop identity (measured against the live database, not inferred); the Gate Zero
mechanism is live and reachable, awaiting only the real event Warwick alone can supply; and the
substitution toggle is honestly understood as manual, matching both the code and last week's lived
experience. **Requirement 3 is the one genuine, concrete, quickly-fixable gap**: the AsdAIr cockpit
read-service has not been restarted since the just-integrated "resolved vs outstanding" backend
landed, so Warwick would not yet see what that Work Order promised through the live cockpit. This
is an operational action (restart one scheduled task), not a code defect, and does not implicate the
pipeline, the vision gateway, or shop-identity safety — all of which are independently confirmed
ready. **Recommendation to Larry: restart `MyPKA-AsdAIr-ReadService`, then this specific gap is
closed** (a fresh, lightweight re-check of requirement 3 alone would confirm it, at Larry's
discretion) **and, on the evidence gathered here, the pipeline itself is ready for Warwick's
photograph** — the Gate 2 live-journey review remains the next, separate, mandatory step once he
sends one.

## Next review trigger

Any further code change to the files named in the Gate 1 receipt's production-caller chain, to
`services/asdair/cockpit-api/assembleWorkspace.js` or `readWorkspace.js`, to `shopState.js`'s
`nextShopRef`/`collisionShopRef`, or to the browser-runner's command allowlist — OR the Gate 2
live-journey review itself, once Warwick sends a real photograph — OR a material change to the
durable shop state this preflight measured (a new `SHOP-2026-08-11` row, a status change on either
of the two live shops). A restart of `MyPKA-AsdAIr-ReadService` alone does not require a new full
preflight — it is the named remedy for Defect #2, not a product change.
