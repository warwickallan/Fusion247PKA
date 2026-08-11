---
build: BUILD-015
scope: WP-B15-22 (Gate Zero repair + B15-18/19/20/21 integration + orphaning fix)
gate: 1

boundary: >
  Everything landed on local `main` in b65c009..eb7c7ad closing BUILD-015's top blocker (Gate Zero
  root-cause repair) and integrating the four previously-built-but-unintegrated branches
  (B15-18/19/20/21), per Deliverables/2026-08-11-GATE-ZERO-source-truth-established.md and
  Deliverables/2026-08-11-worker-returns-and-findings.md.

reviewed_sha: eb7c7ad0d6a243eec2719bf6b188cab5e776a32f
governance_sha: eb7c7ad0d6a243eec2719bf6b188cab5e776a32f
branch: main

evidence_method: target checkout (primary, the reviewed boundary itself) + isolated git-archive export (mutation testing only, outside the repository) + live throwaway-Postgres execution (via the repository's own disposable-cluster script)
evidence_workspace: C:/Users/Buggly/AppData/Local/Temp/claude/C--Fusion247PKA/9250a5da-ce98-4129-9054-3e1eea132f2e/scratchpad/veritas-export
worktree_head_at_start: eb7c7ad0d6a243eec2719bf6b188cab5e776a32f
worktree_head_at_end: eb7c7ad0d6a243eec2719bf6b188cab5e776a32f
worktree_status_clean: true

verdict: HOLD
receipt_sha256: e26ee1fc717b5a5eef9c076339f1d214f79e1c55e8b50d974ea1b7911dd3f098
reviewed_by: veritas
reviewed_date: 2026-08-11
next_review_trigger: >
  Further code change to rememberedChoice.js, resolveByCatalogue.js, runPipeline.js's confidence or
  provenance wiring, runtime.js's recordedAnswerMatches, asdairCommands.mjs's reclaim logic, or
  renderMessages.js's photo_read — OR a corrected disposition of requirement 7 — OR the Gate 2
  real-photo journey once the runtime is cut over to this head.
---

## Scope reviewed

Everything that landed on local `main` in this session's window, `b65c009..eb7c7ad` (26 commits,
2 merges into the integration line plus the final BUILD-015/B15-22/B15-23 merges), closing BUILD-015's
top blocker: the Gate Zero root-cause repair (vision confidence threading and gating, transcript
provenance persistence, line-count advisory, the Photo Read Confirmation Card construction and
rendering), integration of the four previously-unintegrated branches (B15-18 cross-shop answer
routing, B15-19 supervised completion route, B15-20 remembered-choice lookup, B15-21 shop_id
emission), the pre-existing F1 defect fix (`recordedAnswerMatches` cross-pass redelivery), two
`fakePg` teaching commits (B15-21's shop_id lane, B15-19's AC6 handoff-preserving WHERE predicate),
and the newly-discovered cockpit-orphaning data-loss fix (`reclaimUnownedList`).

**Deliberately NOT in scope for this gate** (per dispatch, and per this contract's Gate 1/Gate 2
split): whether Warwick can complete the real end-to-end photo→shop journey through Telegram/the
browser (Gate 2, separately commissioned once the runtime is cut over to this head); the runtime
cutover itself (not attempted in this boundary — confirmed by `git log` showing no runtime/scheduled-
task commits in the reviewed range, consistent with the dispatch); live-database verification of
migration 019 (no `private_surface` declared for this dispatch, and not one of the numbered
requirements); the `shop_decision`/`stepReplan` operational-incident conclusion (explicitly not asked
to fix; no code in this boundary touches that area — `git diff --name-only` confirms zero files
matching `stepReplan`/`shop_decision`/`shopDecision` changed in this range, which is consistent with,
not contradictory to, the "operational, not a code defect" conclusion).

**Also observed but out of the dispatched numbered scope:** WO-B15-23 (AsdAIr cockpit "resolved vs
outstanding" UI, commits `9967f59`/`08ec03c`, merged at `eb7c7ad`) also landed in this window. It is
not one of the eight numbered functional requirements and is not graded as a requirement row here.
The cockpit checks named in the evidence standard were run and are green (see below); no receipt for
a "Vera-passed" claim on this specific WP was found in the repository — recorded as a non-blocking
documentation observation, not a Gate 1 functional defect.

## Accepted requirements

| # | Requirement | Verdict | Evidence | Residual |
|---|---|---|---|---|
| 1 | Four previously-built branches (B15-18/19/20/21) genuinely integrated into `main` — code live, full estate suite green | PASS | Code presence verified by direct read: `runtime.js` carries all 5 B15-18 fix points (`recordedAnswerMatches` shop-scoping, `byKey` map, `questionKeyFor` scoping comments at lines 280/422/527/598/669/2027/2127); `handoff/claim.js` carries `claimHandoff`/`completeHandoff` (B15-19); `rememberedChoice.js` carries the requested-term Map keying (B15-20); `runPipeline.js:941` emits `shop_id` on every `add_list_item` intent (B15-21). Full suite independently re-executed by Veritas across all 14 `services/asdair/*` packages: **2178 pass / 0 fail / 3 skip** (bot 188, browser-runner 92, cockpit-api 153, handoff 135, intake 43, interpret 36, outcome 193+1skip, packet 110, pipeline 508, pipeline-runtime 132, reconcile 106, shop 105, skill 341+2skip, transcribe 36) — matches Larry's reported 2178/0 exactly, independently reproduced, not trusted. | none |
| 2 | `recordedAnswerMatches` cross-pass redelivery defect fixed, reproducing test proves it | PASS | Commit `6aa99ab` read in full: `recordedAnswerMatches` now resolves the shop from `receipt.shop_id` (the just-completed dispatch's own resolved shop) rather than the stale `open` snapshot, both call sites updated. `runtime.test.js` test `WP-B15-22 F1` (read in full) drives TWO SEPARATE `runOnce` passes on one shop, byte-identical redelivered words, and proves PASS 2 is recognised as `duplicate: true` with no `error`, matching the original PASS1/PASS2 defect shape exactly. Included in the green pipeline run above (508/0). | none |
| 3 | `shop_line.match_confidence` genuinely populated from the model's own per-line confidence; a line the model was uncertain about (or `unreadable`) is forced to `needs_confirmation` regardless of catalogue-match strength | PASS | Commit `ecf15b5` read in full, diff-level: `deps.js realInterpretPhoto` passes `confidence`/`model_status` through faithfully (never invented, never defaulted to 1.0); `resolveByCatalogue.js`'s new `applyVisionConfidenceGate` clears `matched_regular_id` and forces `status: 'needs_confirmation'`/`'unreadable'` independent of catalogue-match strength; `runPipeline.js` wires `vision_confidence`/`vision_status` (photo path only) through `resolveAll` into `shop_line.match_confidence`. Six dedicated unit tests read in full in `tolerantResolve.test.js`, including an exact-boundary test (`VISION_CONFIDENCE_THRESHOLD` itself trusted, one hundredth below held) and a "gate never manufactures a match" negative test. Included in green run (interpret 36/0, pipeline 508/0). | none |
| 4 | `transcript_provider`/`transcript_model`/`transcript_confidence` populated after a photo shop's interpretation, raw reading/prompt/photo never stored | PASS | Commit `64e80d2` read in full: `shopStore.js SHOP_UPDATE_ALLOWED_COLUMNS` gains exactly the three provenance columns, explicitly excludes `transcript` itself (raw text) — comment and pinned allowlist test both confirm. `runPipeline.js` computes `transcriptProvider`/`transcriptModel` (live-resolved via `deps.visionModel()`, never hardcoded)/`transcriptConfidence` (MINIMUM across lines, not mean — documented rationale matches the real M64 incident shape) for photo shops only; a text shop acquires none of the three. `store.recordGroundingEvidence`'s sanitisation is untouched by this change (no diff to that function in this commit). Included in green run (pipeline 508/0, shop 105/0). | none |
| 5 | Photo Read Confirmation Card constructed with real derived counts AND actually renders as real Telegram text, not merely queued unrendered | PASS | Two-commit construction proven: `794cae4` (payload construction, discriminated on `result.interpreted` so a re-plan-to-PROCESSING transition never re-fires it — mutation-killed both directions) and `d720d00` (renderer). Verified the render is genuinely wired to the real send path, not just present in `renderMessages.js`: `runtime.js:2431` sets `messages: botMessages.MESSAGES` from `await import('../bot/renderMessages.js')`, and `drainOutbox` (`runtime.js:1722`) resolves `bot.messages[item.kind]` — `photo_read` is a real key in `MESSAGES` (registered `runtime.js` confirmed via grep), so a queued `photo_read` row is genuinely renderable through the production path, not abandoned. Four dedicated tests (read) prove rendered TEXT contains real counts, a missing count renders "unknown" not a fabricated 0, and `implausiblyLow` is visible on the card. Included in green run (bot 188/0). | none |
| 6 | `pipeline/test/fakePg.js` models both the B15-21 `shop_id` lane and B15-19's AC6 handoff-preserving `WHERE` predicate | PASS | Commits `0d5cb99` and `d375ae3` read in full: the shop-owned `shopping_lists` lookup/insert statements and the `updateBrowserProgress` handoff-preserving guard (`currentCarriesHandoff && !incomingCarriesHandoff → refused`) are both modelled directly off the real statements, ordered ahead of pre-existing unanchored generic handlers (first-match-wins), each mutation-killed per its own commit message. Confirmed present in the reviewed tree (`fakePg.js` inspected directly). Included in green run (pipeline 508/0). | none |
| 7 | B15-20's mutation-kill evidence re-proven in a properly isolated, namespaced scratchpad after the scratchpad-contamination incident; confirm genuine, not reused evidence | **HOLD** | **No re-proof was performed.** `git log --oneline b65c009..eb7c7ad -- services/asdair/pipeline/rememberedChoice.js services/asdair/pipeline/rememberedChoice.test.js` returns **empty** — neither file was touched anywhere in this session's boundary; the merge commit `1f796d0` merges branch commit `602caea` byte-unchanged. `602caea` was committed 2026-08-10 23:01:05, in the same ~6-minute window as the two sibling worker commits (`8181db4` 23:03:57, `cf59894` 23:06:55) during which the scratchpad-collision incident is reported to have occurred — i.e. the mutation evidence inside `602caea`'s own commit message is very plausibly the evidence flagged as potentially unsound, and it was never re-run. The rotation handover's own STATE CENSUS row for B15-20 and its NEXT ACTIONS item 3 ("Re-run B15-20's mutation proof") both explicitly called for this before any gate; this Gate 1 dispatch's residuals section does not mention that it was skipped. **Veritas independently discharged the underlying functional question** (does the fix actually work) rather than leaving it purely unknown: in an isolated `git archive` export of `eb7c7ad` (outside the repository, `.orig` backup kept, sha256-verified byte-identical restoration `b95fc12ffbdaf73226ba9bf088303f170875affbb4e0f6cf52f11ab191fac66f` both before mutation and after restore), two independent mutations were applied and reverted: **M1** (revert the Map-keying fix to the old stored-spelling key) — 6 of 31 tests turned red; **M2** (disable the "remembered product not a grounded candidate this week" refusal) — 3 of 31 tests turned red. Both restored byte-identical. This is genuine, isolated, real evidence that the WP-B15-20 fix itself is correct — but it is *Veritas's* evidence, not the promised re-proof, and the promised re-proof never happened. | **Blocking for this row only.** The corrective action is procedural, not a return to implementation: Larry should either bank Veritas's mutation evidence as the durable record for B15-20 (with an honest note of provenance), or have the builder re-run its own isolated proof and record it. The underlying code is not believed to be defective — this HOLD is about an undischarged, undisclosed process commitment, not a known product defect. |
| 8 | `findOrCreateDraftList` orphaning fix (pre-existing unowned same-date list reclaimed, not orphaned) — real disposable-Postgres proof independently verified, not just trusted | PASS | Commit `8d4ce9e` read in full. `asdairCommands.mjs`'s new `reclaimUnownedList` RECLAIMS (UPDATEs `shop_id`) rather than MOVES (never touches `shopping_list_items.list_id`), re-checking `shop_id is null` at write time. **Independently re-executed by Veritas** (not trusted): `bash run-add-list-item-test.sh` against a fresh throwaway local Postgres cluster (provisioned and torn down by the script itself) — **42 pass / 0 fail**, all seven original Silas assertions (a)-(g) unregressed plus new assertion (h), matching the commit's claim exactly. The "sequential exclusion, not a live race" limitation is genuinely recorded in the test file itself (`add-list-item.dbtest.mjs` lines 349-354, comment block read in full: "SEQUENTIAL EXCLUSION, NOT A LIVE RACE... does NOT exercise genuine concurrent interleaving... not built here (see the doc comment on the UPDATE itself for why that is a proportionate, not a missing, limit)") and cross-referenced in `asdairCommands.mjs`'s own doc comment on the UPDATE statement (line 80: "not built here as disproportionate to..."). This matches the residual as characterised in the dispatch. **No other orphaning-shaped edge case found left open**: `runPipeline.test.js`'s own three-round history comment block (lines 2814-2864, read in full) names exactly one prior gap (the cockpit-item-orphaned case) and states plainly this fix closes it; the isolation case (a different household's unowned list on the same date) and the already-claimed-list race-avoidance case are both explicitly tested (assertions in the same real-Postgres run, both PASS). | Concurrency limitation honestly recorded in code, matches dispatch's characterisation exactly — confirmed, not contradicted. |

## Evidence provenance

- Inspected the **actual primary checkout** (`C:/Fusion247PKA`, branch `main`) directly — this dispatch's own boundary statement is that this checkout IS the reviewed head, not a worktree or export. Repository `git rev-parse HEAD` at start / end — `eb7c7ad0d6a243eec2719bf6b188cab5e776a32f` / `eb7c7ad0d6a243eec2719bf6b188cab5e776a32f`, identical. `git status --porcelain` — empty, unchanged start to end.
- For mutation testing (which must never touch the working tree), a separate `git archive eb7c7ad` export was taken to `C:/Users/Buggly/AppData/Local/Temp/claude/C--Fusion247PKA/9250a5da-ce98-4129-9054-3e1eea132f2e/scratchpad/veritas-export`, outside the repository, never committed. All mutation and restoration activity for requirement 7's evidence happened only inside that export.
- The real disposable-Postgres proof for requirement 8 (`run-add-list-item-test.sh`) was run directly against the primary checkout's own script, which provisions and tears down its own throwaway local Postgres cluster under `services/control-plane/wp-d-proof/.cluster-$$` (cleaned up by its own trap; confirmed no residue via `git status --porcelain` after the run).
- `eb7c7ad` confirmed remotely reachable: `git branch -r --contains eb7c7ad` returns `origin/build-015/durable/2026-08-11-rotation`.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `cd services/asdair/bot && npm test` | 0 | 188 | 188 pass / 0 fail |
| `cd services/asdair/browser-runner && npm test` | 0 | 92 | 92 pass / 0 fail |
| `cd services/asdair/cockpit-api && npm test` | 0 | 153 | 153 pass / 0 fail |
| `cd services/asdair/handoff && npm test` | 0 | 135 | 135 pass / 0 fail |
| `cd services/asdair/intake && npm test` | 0 | 43 | 43 pass / 0 fail |
| `cd services/asdair/interpret && npm test` | 0 | 36 | 36 pass / 0 fail |
| `cd services/asdair/outcome && npm test` | 0 | 194 | 193 pass / 0 fail / 1 skip |
| `cd services/asdair/packet && npm test` | 0 | 110 | 110 pass / 0 fail |
| `cd services/asdair/pipeline && npm test` | 0 | 508 | 508 pass / 0 fail |
| `cd services/asdair/pipeline-runtime && npm test` | 0 | 132 | 132 pass / 0 fail |
| `cd services/asdair/reconcile && npm test` | 0 | 106 | 106 pass / 0 fail |
| `cd services/asdair/shop && npm test` | 0 | 105 | 105 pass / 0 fail |
| `cd services/asdair/skill && npm test` | 0 | 343 | 341 pass / 0 fail / 2 skip |
| `cd services/asdair/transcribe && npm test` | 0 | 36 | 36 pass / 0 fail |
| `cd services/cockpit && node render-vm-check.mjs` | 0 | 26 scenarios / 66 assertions | PASS, 0 failed |
| `cd services/cockpit && node render-vm-check.mjs --self-test` | 0 | 7 mutation classes | PASS, 7/7 caught, control clean |
| `cd services/cockpit && node contrast-check.mjs` | 0 | n/a (diagnostic, no gate) | Reports pre-existing opacity-composited contrast FAILs (`.i-eyebrow`, `.item.deferred`); confirmed pre-existing and unrelated — zero cockpit CSS files changed in the reviewed boundary (`git diff --name-only b65c009..eb7c7ad -- services/cockpit/` matches no `.css`/contrast files) |
| `cd services/cockpit && node template-check.mjs` | 0 | 1 template | PASS |
| `cd services/cockpit && node nav-check.mjs` | 0 | 43 assertions | PASS, 0 failed |
| `bash services/control-plane/wp-d-proof/run-add-list-item-test.sh` (real disposable Postgres) | 0 | 42 | 42 pass / 0 fail, Silas (a)-(h) all PASS |
| Mutation M1 in isolated export (Map keyed on stored spelling, reverting WP-B15-20's fix) | n/a | 31 | 6 of 31 turned RED; restored byte-identical (sha256 `b95fc12ffbda...`) |
| Mutation M2 in isolated export (disabled "not a grounded candidate this week" refusal) | n/a | 31 | 3 of 31 turned RED; restored byte-identical (sha256 `b95fc12ffbda...`) |

**Total across 14 packages: 2178 pass / 0 fail / 3 skip.** Zero packages reported zero executed subtests.

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | PASS | Delivers the Gate Zero root-cause fix precisely as diagnosed in `2026-08-11-GATE-ZERO-source-truth-established.md` — confidence threaded and gated, provenance persisted, card rendered — plus genuine integration of four previously-stranded branches and two pre-existing defects fixed. |
| Design fidelity | PASS | Privacy sanitisation in `recordGroundingEvidence` deliberately untouched; model id live-resolved, never hardcoded; RECLAIM-not-MOVE discipline for the orphaning fix mirrors migration 019's own backfill precedent; threshold and MIN/mean choices documented as judgement calls rather than silently asserted. |
| Functional proof | PASS | Every one of the seven PASS rows independently re-executed by Veritas (test suite re-run in full, real-Postgres db test re-run, two independent mutation tests performed by Veritas itself), not merely trusted from commit messages. |
| Integration | PASS | Confirmed by direct trace: `photo_read` reaches the real send path via `botMessages.MESSAGES` wired into `runtime.js`'s `drainOutbox`; `shop_id` reaches `findOrCreateDraftList`'s shop-owned branch via `runPipeline.js:941`; confidence reaches `shop_line.match_confidence` via `resolveAll → shopLines.upsertLines`. |
| Durability | PASS | All durable claims (match_confidence, transcript provenance, remembered_choice, reclaimed list ownership) are real Postgres column/row writes, proven either by the real disposable-Postgres db test (requirement 8) or by production-path pipeline tests reading the real store layer. |
| Test quality | HOLD | Six of seven functional rows carry genuine, boundary-tested, mutation-proven tests reproducing the exact original defect shapes. Requirement 7 is the exception — the specific claimed re-proof never happened; see that row. |
| Git truth | PASS | Every commit message read matches its diff precisely; no overclaiming found in any of the seven commits inspected in full. |
| Documentation truth | HOLD (non-blocking for Gate 1, named for Gate 3) | `Deliverables/2026-08-11-rotation-handover.md` — the document this dispatch names as carrying "the current frontier" — was last committed at `9b45527`, an ancestor of this entire reviewed boundary (`b65c009..eb7c7ad`), and its STATE CENSUS table still reads B15-18/19/20/21 as `Integrated: NO` / `In runtime: NO` and "Veritas Gate 1 + Gate 2 @ `fb58882`... not discharged" — all now stale. This did not misdirect this review (every functional claim was independently re-verified by execution, not read from that document), so it does not block Gate 1 per this contract's "Gate 1 grades functional... only" rule — but a fresh reader following that document alone would be materially misled about integration status, and it is flagged here for the Gate 3 documentation reconciliation this contract requires at the next boundary. |
| Residual risk | HOLD | The requirement 7 gap is the one open, honestly-nameable residual risk from this review; every other residual in the dispatch (concurrency-proof limitation, orphaning-scope match, `shop_decision` operational conclusion, `node_modules` environmental gap) was checked and confirmed accurately characterised. |
| Completed automation | n/a | Nothing in this reviewed scope claims a newly-automatic production outcome — the runtime cutover and the real photo→shop journey are explicitly Gate 2's, not attempted or claimed here. |

## Production caller and journey

Traced, not merely called from a test: `services/asdair/pipeline/runtime.js --watch` (the real entrypoint, confirmed by `runPipeline.js`/`runtime.js` reads, not re-verified live in this gate per the dispatch's Gate 2 boundary) → `stepInterpret` (photo path) → `deps.interpretPhoto` (real vision call, live-resolved model) → `resolveAll`/`resolveByCatalogue.applyVisionConfidenceGate` → `shopLines.upsertLines` (writes `shop_line.match_confidence`) and `store.advanceWithList` (writes `transcript_provider`/`transcript_model`/`transcript_confidence` in the same transaction) → `store.enqueueMessage` (queues `photo_read`) → `runtime.js drainOutbox` → `bot.messages.photo_read` (`botMessages.MESSAGES.photo_read`, real send path) → Telegram. Separately: `runtime.js runOnce` (reply-handling pass) → `recordedAnswerMatches(deps, { shopId: receipt.shop_id, ... })` → `store.listQuestions`. Separately: `asdairCommands.mjs add_list_item` → `findOrCreateDraftList` → `reclaimUnownedList` (shop-owned branch) → real `shopping_lists`/`shopping_list_items` writes. Every hop above was read in the actual source, not inferred; nothing here was reached only by a test calling it directly.

## Restart and durability

n/a for a new kill-and-revive proof in this gate — durability of the specific writes is established by the real disposable-Postgres test (requirement 8, transactional writes proven against a real database engine including constraint enforcement) rather than a fresh restart drill, which this contract treats as equivalent evidence for a stateless write path. No new daemon or long-lived process state is introduced by this boundary's changes.

## Documentation contradiction scan

- Larry's declared scope in the dispatch: the two Gate Zero documents plus the worker-returns document, explicitly marking the Wayfinder's own ACTIVE SESSION WORK PACKAGE as superseded. Verified accurate — both cited documents read in full and match the commits inspected.
- Verified independently: `Deliverables/2026-08-11-rotation-handover.md` (see Documentation truth dimension above) is stale against this integration and was not updated in this boundary (`git log --oneline -1 -- Deliverables/2026-08-11-rotation-handover.md` → `9b45527`, an ancestor of `b65c009`).
- What Larry's dispatch list missed: it did not disclose that the rotation handover's own NEXT ACTIONS item 3 ("re-run B15-20's mutation proof... before any gate") was never carried out before this dispatch — see requirement 7.
- Active documents that would misdirect a fresh instance: `Deliverables/2026-08-11-rotation-handover.md`'s STATE CENSUS table (stale integration status) and PRODUCT TRUTH section (still reads as though Gate Zero repair has not happened). Non-blocking for Gate 1; named for the next Gate 3 pass.
- Closure claims since the last receipt, and the receipt behind each: no Gate 1/2/3 closure claim was found asserted in the reviewed boundary's commits or documents beyond commit-message self-descriptions, all of which are explicitly labelled "Builder self-test evidence - NOT independent review" — no false completion claim found.

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| 1 | HIGH (process) | B15-20's mandated mutation-evidence re-proof (rotation handover NEXT ACTIONS item 3) was never performed, and its omission was not disclosed in this Gate 1 dispatch's residuals. | blocking (requirement 7 only) | Larry |
| 2 | LOW | `Deliverables/2026-08-11-rotation-handover.md` is stale against this session's integration (STATE CENSUS, PRODUCT TRUTH sections) | non-blocking — parked for Gate 3 | Larry |
| 3 | LOW | Merge commit `eb7c7ad`'s message claims "Vera-passed" for WO-B15-23; no dedicated Vera receipt was found in the repository for that specific WP | non-blocking — out of this gate's numbered scope | Larry |
| 4 | INFORMATIONAL | `contrast-check.mjs` reports several pre-existing opacity-composited contrast FAILs (`.i-eyebrow.blocked`, `.item.deferred .i-why`, etc.) | non-blocking — confirmed pre-existing, zero cockpit CSS touched in this boundary | n/a |

## Verdict

**HOLD** — Seven of eight numbered functional requirements are genuinely satisfied, independently
re-verified by execution rather than trusted, including two real-Postgres re-runs and two of Veritas's
own isolated mutation tests. Requirement 7 (B15-20's promised mutation-evidence re-proof) did not
happen and was not disclosed, which is a mandatory HOLD under this contract regardless of the fact that
Veritas independently confirmed the underlying fix is functionally sound. Per this contract, an overall
PASS cannot conceal a held mandatory requirement.

## Next review trigger

Any further code change to `services/asdair/pipeline/rememberedChoice.js`, `resolveByCatalogue.js`,
`runPipeline.js`'s confidence/provenance wiring, `runtime.js`'s `recordedAnswerMatches`,
`asdairCommands.mjs`'s reclaim logic, or `renderMessages.js`'s `photo_read` — OR a corrected disposition
of requirement 7 (either a genuine isolated re-proof recorded, or Larry's explicit acceptance of
Veritas's own mutation evidence as the durable record) — OR the Gate 2 real-photo journey once the
runtime is cut over to this head. A receipt, documentation or clerical-only commit is never a trigger.
