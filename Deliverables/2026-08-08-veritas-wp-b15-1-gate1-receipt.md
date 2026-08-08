---
build: BUILD-015
scope: WP-B15-1 (WO-2026-08-08-B15-01) — source-level halves of the interpretation-confirmation surface, items 1+2. Scope as dispatched matched the accepted ASWP outcome; no widening was required.
gate: 1

boundary: WP-B15-1 and the outcome it promised — a needs_review park queues exactly ONE self-healing confirmation card per shop (pre-existing parked shop recovers on next pass); the card names WHICH photograph produced the reading; a distinct `approve` action clears the existing CONFIRM_INTERPRETATION latch so replan proceeds; intake binds an immutable SHA-256 of the stored image bytes to the shop via the additive side table asdair.shop_source_image through pipeline/store.js inside the durability-before-ack boundary; migration 016 AUTHORED and never applied. The LIVE production event (Asda Build 002 §11) is explicitly OUTSIDE this boundary and remains the outstanding WP acceptance.

reviewed_sha: 7db899b34f28eccb274a26e239324b20bbd55ad6
governance_sha: 0e5e680e6c96ac9c232104397f33cab0d55de6ac
branch: build-015/grounded-recognition

evidence_method: export (git archive of 7db899b) for all executed tests and mutations; target repository object store (read-only git show/diff/grep) for diffs and durable-record checks; map read at governance head via git show. The target worktree C:\Fusion247PKA-b15 was not entered.
evidence_workspace: C:\Users\Buggly\AppData\Local\Temp\claude\C--Fusion247PKA\573cfd4e-240f-40c7-886e-3fb701f2bae4\scratchpad\export-7db899b
worktree_head_at_start: 959a64b77dd0e677af1191447da2bd35c7b4f0cd
worktree_head_at_end: 959a64b77dd0e677af1191447da2bd35c7b4f0cd
worktree_status_clean: true

verdict: PASS
receipt_sha256: 311b9ef96379e402c4637026e8a1f2926e6db731077415dc0962ba464f342599
reviewed_by: veritas
reviewed_date: 2026-08-08
review_ceiling: 45 minutes / ~120k tokens (dispatched); consumed within ceiling
next_review_trigger: the §11 live production event (migration applied under Warwick's authority, runtime restart, real card, real tap, shop 6 recovery) — that is the WP acceptance and Gate 2 material, not a re-run of this gate. A receipt, documentation or clerical commit is not a trigger.
---

## Scope reviewed

WP-B15-1 source-level halves, product delta `431df23..7db899b` — 18 files, all under `services/asdair/{pipeline,bot,intake,db}`. Governance head `0e5e680` on top adds only the Pax audit deliverable and the map ASWP re-cut (verified by `git show --stat`). Deliberately NOT in scope, per the WO and map: the live §11 event, migration application, any live process, the packet/handoff chain, the known-red `integration.dbtest.js` baseline.

Remote reachability: `git branch -r --contains` shows both `7db899b` and `0e5e680` on `origin/build-015/grounded-recognition`, and on no other ref — nothing reached `main`.

## Accepted requirements

| # | Requirement | Verdict | Evidence | Residual |
|---|---|---|---|---|
| 1 | AC1 once-per-shop self-healing card | **PASS** | Executed by Veritas in export: pipeline 205/205, incl. `runPipeline.test.js:1066` (enqueue-on-park, park unchanged), `:1081` (no dup on later passes), `:1156` (shop-6 shape: photo shop, answered question, parked, card history stripped → recovers on next pass with honest null fingerprint), `:1188` (two-runner race → exactly 1 card); `runtime.test.js:1163` (process death before delivery → survives restart, sent exactly once, never re-queued). Guard is pre-existing `outboxEverQueued` (present at baseline `431df23` store.js:680) over full outbox history. Mutation: disabling the enqueue guard turned 10 tests red; restore → 205/205. | Live delivery not exercised — outside boundary, recorded |
| 2 | AC2 distinct `approve` action | **PASS** | `callbackProtocol.js` adds `APPROVE: 'approve'` (7 bytes); `callbackProtocol.test.js:200` (distinct from order-email `confirm`, wire round-trip), `:209` (7 bytes, `exceptions` still sizes budget); adapter maps `approve` → pre-existing `COMMANDS.CONFIRM_INTERPRETATION` (handler exists unmodified at baseline commands.js:203); `runtime.test.js:1078` (approve→confirmInterpretation, confirm refusal pin untouched beside it), `:1097` (end-to-end to replan), `runPipeline.test.js:1200` (gate clears → READY_TO_SHOP, no second card). `runtime.test.js` delta is 157 insertions, 0 deletions — every pre-existing test byte-identical. All executed green. | none |
| 3 | AC3 card content | **PASS** | `renderMessages.js:renderConfirmInterpretation` read in full: fingerprint prefix with algo, received timestamp (`humanTime`, pure UTC arithmetic), interpreted-line count plus the explicit line "Physical lines on the page: not counted by AsdAIr — check the reading against the photograph yourself"; human-readable prior-photo comparison with loud same-photograph warning; honest absences ("none was recorded at intake", "none on record", "could not be compared"). No mechanical physical-line-verification claim anywhere in the delta. Bot suite 156/156 executed. | UTC display question — see defect D1 |
| 4 | AC4 (amended) intake SHA-256 binding | **PASS** | `shopperIntake.js:imageFingerprintOf` hashes the exact buffer `media.save` wrote, rides record meta; `runtime.js` carries it into `receiveList`; `commands.js` persists via `store.recordSourceImage` inside receiveList (durability-before-ack, before offset moves). First-write-wins is structural: PK + `ON CONFLICT (shop_id) DO NOTHING` + no UPDATE/DELETE granted to any role. Card reads the STORED value via `findSourceImage`; pre-existing shops render honest absence (proven `runPipeline.test.js:1092`, `:1156`). `services/asdair/shop/**` untouched (delta file list). Mutations: disabling the binding write → 4 red; nulling the intake hash → 2 red in intake; both restored green (205/205, 28/28). | Live write path needs 016 applied — the recorded live half |
| 5 | AC5 migration 016 authored, not applied | **PASS** | `db/016_shop_source_image.sql` is item-2 columns only (shop_id PK/FK, fingerprint, algo, byte_length, captured_at, three CHECKs, mirror-of-009 grants). Numbering reasoning present in header: past repo max 012, past referenced-never-authored 013–015, live-only tables named and reconciled by nothing. No migration runner or auto-apply route exists in `services/asdair` (grepped export); nothing in the delta executes it. | Never executed on any Postgres — declared, honest |
| 6 | AC6 no weakening | **PASS** | `integration.dbtest.js` absent from the delta. Complete enumeration of EVERY removed line in the product delta: 3 fake-token fixture reshapes (renderMessages.test.js, resolveTap.test.js, sendShopperMessage.test.js — same fixture, dots defeat the scanner pattern honestly), 2 additive closed-list extensions (MESSAGES catalogue + invariants OWNED list, each grown by exactly one entry, nothing removed or renamed), 1 product line (intake meta). Zero deleted or relaxed assertions. Exactly as declared, nothing more. | none |
| 7 | Isolation | **PASS** | All 18 delta files inside `services/asdair/{pipeline,bot,intake,db}/**`. Head pushed and reachable only from `origin/build-015/grounded-recognition`; `main` untouched. No code in the delta touches a live process or database; migration authored only. (Live DB itself not inspected — nothing in scope grants it and nothing in the delta reaches it.) | none |
| 8 | Honesty | **PASS** | Map ASWP block at `0e5e680` states: integrated at 7db899b and submitted to Veritas (the permitted maximum form), source-level ACs met with builder self-evidence, migration AUTHORED NOT applied, "live halves are explicitly NOT claimed", §11 outstanding, Pax watch item (learning-writer FAILED-park) recorded. Both feat commits end "Builder self-test evidence — NOT independent review". No completion overclaim found anywhere in the delta or map block. | Defect D1: two builder residuals not durably recorded |

Surface secret scan, executed by Veritas in the export: `bash scripts/secret-scan.sh --surface services/asdair/pipeline services/asdair/bot services/asdair/intake services/asdair/db` → exit 0, "SCANNED 58 file(s), 0 secret value(s) found".

## Evidence provenance

- Export at the evidence workspace above, extracted via `git archive 7db899b | tar -x` (full tree — a partial `services/asdair`-only export was insufficient: pipeline tests import `services/hub/shopper/shopperRoute.mjs`, and 35 tests failed until the full tree was exported; recorded so nobody mistakes that partial-export red for a product red).
- Repository `git rev-parse HEAD` start/end: `959a64b77dd0e677af1191447da2bd35c7b4f0cd` / identical. `git status --porcelain`: 0 lines start and end.
- Mutations applied ONLY inside the export; each restored from `git show 7db899b:<file>` and re-run green before the next.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `node --test` in export pipeline/ | 0 | 205 | 205 pass, 0 fail — matches builder claim |
| `node --test` in export bot/ | 0 | 156 | 156 pass, 0 fail — matches builder claim |
| `node --test` in export intake/ | 0 | 28 | 28 pass, 0 fail — matches builder claim |
| Mutation: enqueue-on-park guard forced false | 1 | 205 | 10 fail — tests detect the capability; restored → 205/205 |
| Mutation: recordSourceImage call disabled | 1 | 205 | 4 fail; restored → 205/205 |
| Mutation: intake imageSha256 nulled | 1 | 28 | 2 fail; restored → 28/28 |
| `scripts/secret-scan.sh --surface <4 pkgs>` in export | 0 | 58 files | 0 secret values |
| `git diff 431df23..7db899b` full removed-line enumeration | 0 | n/a | every removed line accounted for (AC6 row) |
| `git branch -r --contains 7db899b` / `0e5e680` | 0 | n/a | only `origin/build-015/grounded-recognition` |

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | PASS | The promised source-level halves exist and do what Warwick's §1 authorised, as bounded by the WO |
| Design fidelity | PASS | AC4 route-(a) amendment honoured (side table, shop/** frozen pins untouched); pre-existing self-healing outbox pattern reused, not reinvented; existing latch/replan chain unmodified |
| Functional proof | PASS | 389 subtests executed green by Veritas in a clean export; journeys traced below. Scope of this proof is the SOURCE level — the live journey is explicitly outside the boundary and unclaimed |
| Integration | PASS | Card enqueued at the real park inside `stepPlan`; delivery via the existing outbox/runtime path; `approve` rides the existing tap→command→latch→replan chain; binding written inside the real receive boundary. No test-only reachability found in the delta |
| Durability | PASS | Death-before-delivery restart test executed; first-write-wins structural (PK + absent grants); card payload built from durable reads only; head remotely reachable |
| Test quality | PASS | Three capability mutations → 10/4/2 reds respectively, all restored green. Tests prove properties, not existence |
| Git truth | PASS | Branch, head, scope and status exactly as reported; delta is 3 coherent commits + docs commit; nothing on main |
| Documentation truth | PASS | Map ASWP position truthful and would orient a fresh session correctly. One non-blocking omission (D1) |
| Residual risk | PASS | Declared residuals verified: skill/** untouched by delta so pre/post identity of the 7 env-shaped local failures is structural; known-red CI baseline untouched; Pax watch item on the map. One omission recorded (D1) |
| Completed automation | PASS | The intended-automatic outcome is nowhere claimed complete: WO `outcome` field, map ASWP block and commit messages all keep the §11 real production event ON THE FRONTIER as the outstanding WP acceptance, per root `CLAUDE.md` §"Nothing may live only in Larry's head". This gate certifies capability halves only, and says so |

## Production caller and journey

Traced at source (the live process has not run these bytes — outside boundary, unclaimed):
photo → `intake/shopperIntake.js` downloads bytes → `imageFingerprintOf(bytes)` on the exact saved buffer → meta.imageSha256 → `pipeline/runtime.js pollIntake` → `commands.receiveList` → `store.recordSourceImage` (inside durability-before-ack, before offset moves) → shop proceeds → `runPipeline stepPlan` parks at `needs_review` gate → `outboxEverQueued` full-history guard → `store.enqueueMessage(kind 'confirm_interpretation')` with payload from durable reads (`findSourceImage`, `findPriorPhotoShop`) → runtime outbox delivery → `renderMessages.renderConfirmInterpretation` (catalogue-wired) → Telegram card with `approve` button → tap → `telegramAdapter intentToCommand('approve')` → `COMMANDS.CONFIRM_INTERPRETATION` → pre-existing `confirmInterpretation` latch → next `stepPlan` pass → READY_TO_SHOP. Every hop has a production caller in the delta or at baseline; no hop is test-only.

## Restart and durability

`runtime.test.js:1163` executed: card queued, process death simulated before delivery, fresh runner on the same durable DB delivers exactly once, never re-queues. `runPipeline.test.js:1156` executed: pre-fix parked shop (shop 6 shape) recovered by a brand-new process on the same DB. Binding redelivery: PK adopt-original proven by test, immutability by absent grants in 016.

## Documentation contradiction scan

- Larry's declared DOCUMENT IMPACT: map ASWP block (updated at integration — verified re-cut at `0e5e680`); CANONICAL-WEEKLY-SHOP-PROCESS status rows (report-only) and ACCEPTANCE-AND-EVIDENCE (at WP acceptance) — correctly not yet due at this boundary.
- Verified independently: map ASWP position matches the code and claims nothing live; commit messages carry the builder-evidence disclaimer; no active document found asserting WP-B15-1 complete, closed, or live.
- **What his list missed:** the two builder residuals in D1 below exist only in the dispatch/session, not in the durable record.
- Active documents that would misdirect a fresh instance: none found.
- Closure claims since the last receipt: none found for this boundary — the map says "integrated and submitted to Veritas", which is the permitted pre-PASS maximum.

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| D1 | low | Two declared builder residuals are not in the durable record at `0e5e680`: (a) the UTC display question (`humanTime` renders UTC; the household is UK — BST is UTC+1, so card times will read an hour off local until the §11 event settles the display choice), and (b) the 7 pre-existing env-shaped `skill` local failures (identity pre/post is structural — `skill/**` untouched by the delta — but the residual itself is unrecorded). Both currently live only in Larry's session/dispatch. Bounded correction: one line each in the map's ASWP residuals at the next scheduled reconciliation — no new review needed | non-blocking | larry |

## Verdict

**PASS** — every functional requirement of the source-level boundary is evidenced by tests Veritas executed itself, three capability mutations prove the tests can fail, isolation and honesty hold, and the intended-automatic outcome is correctly held on the frontier awaiting the §11 real production event.

## Next review trigger

The §11 live production event completing (or materially failing) — that is the WP acceptance and the Gate 2 / phase-journey material. Not a receipt commit, not documentation repair, not a moved HEAD.
