---
build: BUILD-015
scope: phase-agentic-runtime — the integrated production route of 2026-08-18 (SHOP-2026-08-18-M128)
gate: 2

boundary: >
  The BUILD-015 phase promise as re-cut by Warwick 2026-08-17 — "AsdAIr is Mum's autonomous AI shopping
  operator": Mum's normal input becomes a correct, reconciled ASDA trolley with no Larry in the runtime,
  no Warwick technical intervention, and only genuinely ambiguous shopping questions asked. Reviewed as
  exercised through the real production route on 2026-08-18.

reviewed_sha: a0a71f5e5144e6d4359ee16f621572f9961ac272
governance_sha: a0a71f5e5144e6d4359ee16f621572f9961ac272
branch: main

evidence_method: mixed — live runtime (pid 32008) + live asdair Postgres (read-only) + target checkout source read
evidence_workspace: C:/Users/Buggly/AppData/Local/Temp/claude/C--Fusion247PKA/736e76e6-1682-4c84-97a0-acc90d1abe3a/scratchpad/veritas
worktree_head_at_start: a0a71f5e5144e6d4359ee16f621572f9961ac272
worktree_head_at_end: a0a71f5e5144e6d4359ee16f621572f9961ac272
worktree_status_clean: true

verdict: FAIL
receipt_sha256: 1244fb58442a751d9ea5f5a31f3b9da186787d7e6c770632cb9c1aabd91551ee
reviewed_by: veritas
reviewed_date: 2026-08-18
next_review_trigger: >
  The semantic decision point moves off skill/planner.js regularCandidates() onto a capable model on the
  live act:plan path, AND a real weekly photograph is driven through the joined production route to a
  reconciled trolley or a genuinely answerable question board. Not a receipt, a document repair, a moved
  HEAD, a green suite, or a manual component invocation.
---

## Scope reviewed

**In scope — the accepted user journey, ungrudged and unnarrowed.** The BUILD-015 North Star as re-cut by
Warwick on 2026-08-17 (`Builds/BUILD-015-.../BUILD-015-goal-contract.md`), exercised through the real
production route on 2026-08-18: a real photograph sent to @Fusion247shopperbot at 13:42:37Z, becoming
`SHOP-2026-08-18-M128` (shop id 37) in the `asdair` Postgres, processed by the live runtime (pid 32008,
started 13:39:20Z from `C:\Fusion247PKA\services\asdair\pipeline\runtime.js`), through to the question
board Warwick actually received on Telegram. All nine numbered functional requirements in the dispatch are
graded; none was narrowed.

**Deliberately NOT in scope.** Assurance receipts and documentation housekeeping (excluded by the
dispatch); hostile/multi-tenant hardening (excluded, and excluded again by the hobby-brain rule);
estate-wide Git archaeology, which includes the declared stale shim at
`.claude/worktrees/b15-runtime/.claude/agents/asdair.md` — recorded once below as `non-blocking` and
outside this reviewer's boundary.

## Accepted requirements

| # | Requirement | Verdict | Evidence | Residual |
|---|---|---|---|---|
| 1 | AsdAIr, not deterministic word-ranking, owns semantic shopping judgement | **FAIL** | `runPipeline.js:150-190` `planWithDecisions()` runs `deps.planBasket` **first** and `applyRulebook` (the model consult) **second, over its output**, and only "where an inert rule speaks". The deterministic planner therefore decides which lines are unresolved and produces every candidate Warwick sees. Executed proof from the live run: `pipeline_command` id 282 `args.outstanding` — the exact bytes sent as Telegram message 134 — offers *"ASDA 10 Slices Honey Roast Dry Cured Ham 250g, ASDA 12 Free Range Large Eggs, ASDA 20 Medium Zip Seal Food & Freezer Bags, ASDA 4 Beef Quarter Pounders 454g, ASDA 6 Bananas"* for `2 pkts ASDA plain toffees`, and *"Gourmet Mon Petit … Wet Cat Food 6x50g"* for `1 wet wipes`. Mechanism confirmed in `skill/planner.js:257-304` `regularCandidates()`: word filter is `w.length > 2`, so `asda` scores against most of the catalogue; alphabetical tie-break at line 301 | Violates the goal contract's structural rule 1 — *"A deterministic executor may perform mechanical browser actions UNDERNEATH an AI. It must never be the semantic decision-maker."* On this path it **is** the semantic decision-maker |
| 2 | Household catalogue, rules and Favourites reach that model judgement | **FAIL** | Catalogue **does** reach the interpret model — `shop_event` id for shop 37: *"interpreted 37 line(s) against a catalogue of 109 known products"*, and 31 of 37 lines matched at `match_confidence` 0.68–0.99. Rules and Favourites **do not reach the decision point**: 39 active rows in `asdair.rules`, yet `1 wet wipes` (a line Warwick says a standing rule covers) was escalated; `1 pk. ASDA fruit lolly ices` and `2 pkts ASDA plain toffees` (both in his ASDA Favourites) were escalated. `asdair.regulars` holds id 33 *"Dairy toffee"* and id 49 *"Toffee assortment"*, and **neither appears in the toffee candidate list** — `regularCandidates` scores them **zero**, because the line's word is `toffees` and the alias is `toffee`, while `asda` scores 0.25 on bananas | The regulars/Favourites layer is consulted only by a substring scorer that never sees a model. The retailer-side ASDA Favourites list is read by nothing in the runtime |
| 3 | Known products are resolved without unnecessary Warwick questions | **FAIL** | 7 of 37 lines escalated. `asdair.shop_line` line 14 `2 sliced roast beef` — `match_confidence` **0.99**, `match_basis` *"known brand + variant"*, `matched_regular_id` **NULL**, status `needs_confirmation` — while `asdair.regulars` id 80 *"Sliced beef"* and id 81 *"Roast beef"* (aka `roast topside`) are both active. `shop_question` id 76509 asks *"Which product is 'Heinz Tinned Baked Beans in a Rich Tomato Sauce 6 x 415g'?"* — the full catalogue name of a product `shop_line` line 15 had **already matched to regular 108 at 0.99** | Independently reproduces the declared residual "five of seven should never have been asked"; I reached it from `shop_line` and `regulars` rather than from the deliverable |
| 4 | Unresolved / new products are handled by capable-model reasoning | **FAIL** | No model, no live ASDA inspection, and no `browser_build_request` row exists for shop 37. The five `unmatched_new_item` lines went straight from the interpreter to `regularCandidates`. `1 x 4pk Ben & Jerrys cookie dough` — resolved from live ASDA candidates by AsdAIr's own model on 2026-08-17 — was here offered *"ASDA 4 Beef Quarter Pounders 454g"* and *"Twix Chocolate & Caramel Ice Cream 4pk"*. `shop_question` id 76509 was sent with **zero** candidates (`jsonb_array_length(candidates) = 0`) | The goal contract's *"a previously unseen product is a NORMAL case"* is not implemented on this path |
| 5 | Telegram input wakes and continues AsdAIr without Larry | **HOLD** | **Wake proven.** `shop_event`: *"shop SHOP-2026-08-18-M128 created from a photo message (a fresh shop: SHOP-2026-08-18 is terminal and was left untouched)"* at 13:42:37.484Z; `pipeline_command` id 272 `receiveList`; outbox receipt id 273 `{"note":"sent","delivery":{"chatId":"8601328832","messageId":"129"}}`. The runtime advanced `act:transcribe` → `act:interpret` → `act:plan` unaided (`runtime.log` passes 6–8). **Continue NOT proven** — all 7 questions are `status='open'`, `answered_at` NULL, and the shop has sat at `NEEDS_DECISION` since 13:49:22.814Z | The answer-and-resume half was never exercised in this run. Unexercised load-bearing property ⇒ HOLD, per this contract §"Current readiness is NOT capability" |
| 6 | Larry can disappear and the route continues | **HOLD** | Positive: the runtime is a separate supervised OS process (pid 32008, lock `C:\.fusion247\asdair\runtime.pid`, `identity_verified: true`) and completed intake→plan with no Larry action. Negative and decisive for the grade: the acceptance the Wayfinder itself mandates — *"deliberately terminate Larry / Claude Code… If AsdAIr stops progressing, FAIL"* — **was not performed**, and the route has not in fact continued for ~6 h | Cannot be graded PASS on capability. The kill-Larry test remains unexecuted |
| 7 | Browser execution follows the established shopping method | **HOLD** | **Never exercised at this boundary** — no `browser_build_request` row for shop 37. What the live runtime is doing instead: `browser_build_request` id 1 (shop 1, queued since **2026-07-28**) is re-claimed and released **every pass**, `re-claimed_at` 18:55:10Z, with `browser_build_failed: The "path" argument must be of type string or an instance of Buffer or URL. Received an instance of Object` — **291 occurrences in `runtime.log`, still firing at pass 284 as this review closed**. The last real attempt, id 8 (shop 35, 2026-08-17), ended `failed: NoExecutablePlanError`. Separately, the *named authority* for this requirement still instructs the superseded method: `SOP-021:9` and `SOP-021a:11` both state *"The Stage 1 live basket writer is Sonnet in Claude for Chrome"* (6 and 8 `Sonnet` occurrences), which goal contract S-5/S-7 superseded | Two independent gaps: no evidence, plus an unbounded live error loop and an active SOP that would misdirect the executor |
| 8 | Question / resume works through the product surfaces | **HOLD** | Outbound half **proven**: `pipeline_command` ids 279/281/282, all `status='done'`, delivering to `chatId 8601328832` as messages 132 (sent), 132 (rewritten in place) and 134 (fresh send at 14:13:41Z). `card_message_id` being NULL on the question rows is by design (`runtime.js:1727` `perQuestionCards = false`), not a delivery failure. Resume half **unexercised** — 0 answers, `shop_decision` 0 rows for shop 37 | The board *arrived*; its **content** is unanswerable (rows 1/3/4 own that). Warwick could not complete this journey from the product in front of him, which is Gate 2's operative test |
| 9 | The final trolley is reconciled truthfully | **HOLD** | Not reached. The journey stopped at `NEEDS_DECISION`; no trolley exists for shop 37; `shop_line_provenance` holds **0 rows across the entire database**, so reconciliation to the source photograph remains a human act | No evidence either way. Unknown on a mandatory property ⇒ HOLD, never a qualified pass |

## Evidence provenance

- **Reviewer home:** `C:/Fusion247PKA` on `main` at `a0a71f5e5144e6d4359ee16f621572f9961ac272`, read-only.
  No `git archive` export was taken: every question in this gate is about the **live** runtime and the
  **live** durable state, which an export cannot show. Contract §"Evidence isolation" permits this and
  requires it be stated: **all runtime and database rows below were read against live state, not an export.**
- **Repository `git rev-parse HEAD`** at start and end — `a0a71f5e5144e6d4359ee16f621572f9961ac272` /
  `a0a71f5e5144e6d4359ee16f621572f9961ac272`, identical.
- **Repository `git status --porcelain`** — empty at start and empty at end. The working tree was not modified.
- **Remote reachability** — `git branch -r --contains a0a71f5…` returns `origin/main`. The reviewed head is
  durable on the canonical remote.
- **Database access** — `asdair` Postgres via the read-only role in `ASDAIR_DB_URL`, every statement inside
  `BEGIN TRANSACTION READ ONLY` followed by `ROLLBACK`, through an ephemeral script in the session
  scratchpad. **No write of any kind was issued.** Credentials were loaded by `node --env-file` and no
  secret value was read or printed. Declared private surface touched: `C:/.fusion247/asdair.env` (loaded,
  not read) and `C:/.fusion247/asdair/*` (runtime log and status files), both named in the dispatch.
- **No mutation testing was performed**, in the repository or anywhere else. None was needed: the failing
  properties are evidenced by real production output, not by a test that might not turn red.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `git rev-parse a0a71f5…:"Team/Veritas…/AGENTS.md"` | 0 | n/a | `d63d613d0c4001e6476a750316fa3193bd6ee2d4` — contract blob bound at the governance head |
| `git branch -r --contains a0a71f5…` | 0 | n/a | `origin/main` — reviewed head remotely reachable |
| `SELECT … FROM asdair.shop ORDER BY id DESC LIMIT 6` | 0 | n/a | shop 37 `SHOP-2026-08-18-M128`, `status=NEEDS_DECISION`, `human_state=NEEDS_WARWICK`, `updated_at=2026-08-18T13:49:22.814Z` |
| `SELECT … FROM asdair.shop_event WHERE shop_id=37` | 0 | 4 rows | RECEIVED 13:42:37 → TRANSCRIBING 13:45:57 → PROCESSING 13:47:56 (*"interpreted 37 line(s) against a catalogue of 109 known products"*) → NEEDS_DECISION 13:49:22 (*"7 line(s) need a human decision"*) |
| `SELECT line_no, raw_reading, match_confidence, status, match_basis FROM asdair.shop_line WHERE shop_id=37` | 0 | 37 rows | 31 matched · 5 `unmatched_new_item` · 1 `needs_confirmation`. Lines 15 and 16 are **distinct** Heinz products. No invented product present |
| `SELECT … FROM asdair.shop_question WHERE shop_id=37` | 0 | 7 rows | all `open`, all `answer_text` NULL, `question_round=1`; id 76509 has `candidates` length **0** |
| `SELECT args::text FROM asdair.pipeline_command WHERE id=282` | 0 | 1 row | the exact rendered board bytes delivered as Telegram message 134 — quoted in requirement rows 1 and 4 |
| `SELECT … FROM asdair.pipeline_command WHERE shop_id=37` | 0 | 10 rows | 5 outbox sends all `done` with real `messageId`s; **`receiveList` (272) and `groundingEvidence` (277) still `status='pending'`, `attempts=0`, since 13:42 / 13:47** |
| `SELECT count(*) FROM asdair.shop_line_provenance` | 0 | 1 row | **0** — whole table, whole database |
| `SELECT count(*) FROM asdair.shop_decision WHERE shop_id=37` | 0 | 1 row | **0** |
| `SELECT … FROM asdair.regulars WHERE … ~ '(wipe\|sure\|toffee\|topside\|lolly\|cookie dough)'` | 0 | 9 rows | ids 33, 49 (toffee) · 80, 81 (sliced/roast beef) · 21 (*"Sure female"*) — all `active=true` |
| `SELECT … FROM asdair.browser_build_request` | 0 | 7 rows | id 1 `queued` since 2026-07-28, `claimed_at` 2026-08-18T18:55:10Z; id 8 `failed: NoExecutablePlanError`; **no row for shop 37** |
| `grep -o '"event":"…"' C:/.fusion247/asdair/runtime.log \| sort \| uniq -c` | 0 | 91,219 lines | `browser_build_failed` **× 291**; `board_queued` × 29; `pass_failed` × 21; zero `rulebook` events |
| `sed -n '87840,87900p' runtime.log` | 0 | n/a | the M128 run in sequence: `act:transcribe` → `act:interpret` → `board_queued outstanding:0` → `act:plan` → `board_queued outstanding:7` → `wait:answers` (unchanged since) |
| `grep -n "Sonnet in Claude for Chrome" SOP-021*.md` | 0 | 10 matches | `SOP-021:9`, `SOP-021:225`, `SOP-021:517`, `SOP-021a:11`, `SOP-021a:42`, `SOP-021a:317`, `SOP-021a:803`, `SOP-021a:836` — all stated as current instruction |
| **Unavailable evidence, named rather than smoothed over** | — | — | (a) the answer→resume path — Warwick has given no answer, so it could not be observed; (b) the kill-Larry test — I may not terminate Larry's session; (c) any browser or trolley evidence for shop 37 — none exists |

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | **FAIL** | The North Star is *"AsdAIr is Mum's autonomous AI shopping operator"* using *"logic, reason and intelligence"*. The integrated route reads the photograph with a model and then hands the leftovers to a word-overlap scorer. The seven questions Warwick received are the outcome, and six of them are unanswerable |
| Design fidelity | **FAIL** | Goal contract structural rule 1 is violated by construction at `runPipeline.js:150-190`: the deterministic planner runs first and is the semantic decision-maker; `applyRulebook` is a post-hoc adjuster over its output |
| Functional proof | **FAIL** | The real production run completed intake and interpretation and then produced a defective decision surface. The browser lane has never run for this shop and is in a permanent error loop for another |
| Integration | **HOLD** | Telegram → runtime → transcribe → interpret → plan → outbox → Telegram is genuinely wired and executed. Plan → browser → trolley → reconcile is not evidenced at this boundary; two `pipeline_command` rows (`receiveList`, `groundingEvidence`) have sat `pending` with `attempts=0` since the run |
| Durability | **HOLD** | Durable state is real and survives — the runtime restarted at 13:39Z onto the merged code and picked up six shops. But `browser_build_request` id 1 has been retried without bound or backoff since **2026-07-28**, and nothing ever gives up on it. Kill-and-revive of the runtime was not performed by me |
| Test quality | **n/a** | Excluded by the dispatch ceiling and superseded as evidence: this gate had a real production run, which outranks any suite. The three merged changes' mutation proofs were not re-executed |
| Git truth | **PASS** | Reviewed head `a0a71f5…` is on `main` and reachable from `origin/main`; working tree clean and unchanged start to end; the runtime's recorded entry point is the primary checkout it was restarted from |
| Documentation truth | **FAIL** | `SOP-021:9` and `SOP-021a:11` still state, as standing instruction at the top of each document, that the live basket writer is *"Sonnet in Claude for Chrome"* — superseded by goal contract S-5/S-7 on 2026-08-17. This is the named authority for requirement 7's *"established shopping method"*, so it **misdirects the current executable journey** and is blocking under root `CLAUDE.md` §Finding disposition rather than clerical. Separately, the runtime consumes **no** contract text at all: `SOP-021` appears in `services/asdair/**` only in code comments |
| Residual risk | **PASS** | Every residual the dispatch declared was independently reproduced from source or durable state, and none was found understated. Two limits are recorded here that the dispatch did not name — the 291-occurrence browser error loop, and the two permanently `pending` pipeline commands |
| Completed automation | **FAIL** | Mandatory here, and it is the sharpest reading of the failure. The real production event **did** invoke the runtime from a stable supervised process, observably, without Larry — that half is genuinely satisfied. But the promised automatic outcome is *a reconciled trolley*, and the route stops at a question board no human can answer. Under root `CLAUDE.md` §"Nothing may live only in Larry's head", the only paths that have ever produced a trolley are the 2026-08-17 manual rescue and hand-fed harness runs — capability, not completed automation |

## Production caller and journey

Traced from the real entry point, hop by hop. Every hop below was executed on 2026-08-18 unless marked.

1. **Warwick's photograph → @Fusion247shopperbot** — 13:42:37Z. Real inbound Telegram event, `getUpdates`
   offset advanced to 171031186 (`shopper-intake-state.json`).
2. **`pipeline/runtime.js` (pid 32008) → `telegramAdapter` → `receiveList`** — creates shop 37, and
   **correctly refuses to absorb it into the terminal `SHOP-2026-08-18`**, creating the `-M128` ref instead.
   This is the 2026-08-10 counterexample in this contract, and it is now closed by execution.
3. **`act:transcribe` → gateway vision model** — 37 lines read from the photograph.
4. **`act:interpret` → `loadCatalogue` + `buildGroundedPrompt` + `resolveAll`** — 109 catalogue products,
   31 lines bound at 0.68–0.99. **This hop is model judgement and it worked.**
5. **`act:plan` → `planWithDecisions` → `deps.planBasket` (`skill/planner.js`)** — ⛔ **the break.** The
   deterministic planner decides the unresolved set and calls `regularCandidates()` for every one of them.
   `applyRulebook`, the model consult, runs *after* this, over its output, and only if an inert rule speaks;
   `runtime.log` records **zero** rulebook events across 91,219 lines.
6. **`queueBoard` → `pipeline_command` outbox → Telegram** — one board card, message 132, rewritten in
   place, re-sent fresh as 134. Delivery is sound; content is not.
7. **`wait:answers`** — where the journey has stood since 13:49:22Z.
8. **Browser / trolley / reconcile** — **never reached.** Not on the journey for this shop. The only browser
   activity in the live process is request 1 for shop 1 failing every pass.

**Nothing in hops 1–7 required Larry**, and that is a real gain over 2026-08-17. The journey nevertheless
does not reach the promised outcome.

## Restart and durability

The runtime was restarted at 13:39:20Z onto the merged code and resumed six active shops from durable
Postgres state with no reconstruction — durability of the shop spine is evidenced. **Kill-and-revive was
not performed by me**: the process is live, holds a lock, and terminating it is a mutation of operational
state that this role has no authority to make. That property is therefore recorded as **not established at
this gate**, not as passed.

The counter-evidence on durability is the retry policy: `browser_build_request` id 1 has been claimed and
released with the same `TypeError` since 2026-07-28 with no attempt ceiling, no backoff and no terminal
state. A failure that repeats 291 times without escalating is not a durable failure mode; it is a silent
one wearing a loud log.

## Documentation contradiction scan

- **Larry's declared DOCUMENT IMPACT:** the six residuals in the dispatch, including the `SOP-021`/`SOP-021a`
  Sonnet references (4 and 6 occurrences claimed) and "the runtime consumes NO contract text".
- **Verified independently against the repository:** both held. The Sonnet count is **6 in `SOP-021` and 8
  in `SOP-021a`** — his figures were the "Sonnet in Claude for Chrome" phrase only, and understate the
  total; the direction of the error is against his own interest, so it is recorded and not treated as a
  finding.
- **What his list missed** — three things, all found by reading durable state rather than his account:
  1. **`browser_build_request` id 1 is an unbounded live error loop**, 291 `browser_build_failed` events,
     still firing. Not in the residual list.
  2. **Two `pipeline_command` rows are permanently `pending` with `attempts=0`** — `receiveList` (272) and
     `groundingEvidence` (277). The second is the GATE ZERO provenance path he correctly reports as
     unwired; the durable trace of *why* it never runs is this row, which the dispatch does not name.
  3. **`Deliverables/2026-08-18-what-a-capable-model-does-with-this-list.md` says of question 1 that it was
     *"already matched at 0.99"*.** `shop_line` line 14 carries `match_confidence 0.99` but
     `matched_regular_id` **NULL** and status `needs_confirmation`. High confidence with no bound regular is
     not "already matched", and the distinction matters because it points at a different defect. Minor,
     `non-blocking`, recorded so the successor does not inherit it.
- **Active documents that would misdirect a fresh instance:** `Team Knowledge/SOPs/SOP-021-run-the-weekly-asdair-shop.md:9`
  and `Team Knowledge/SOPs/SOP-021a-asdair-live-execution-method.md:11` — *"The Stage 1 live basket writer
  is Sonnet in Claude for Chrome."* Stated as current law at the head of each document, with no supersession
  banner, while the goal contract struck it as S-5/S-7 on 2026-08-17.
- **Closure claims since the last receipt, and the receipt behind each:** none found. The Wayfinder's
  ⚑ WORK CLASSIFICATION block correctly still reads `FRONTIER — REMEDIATE`, and the phase-open block for
  24 August makes no completion claim. **No false completion claim was found anywhere in the current
  Build or Wayfinder record**, and the map's route was re-cut on 2026-08-18 to put the real production run
  *before* this gate, which is why this gate had a real run to inspect at all.

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| 1 | **CRITICAL** | `planWithDecisions` runs the deterministic planner as stage 1 and the model as a stage-2 adjuster over its output. The deterministic layer owns the semantic decision, violating the goal contract's structural rule 1 on the live production path | **blocking** — blocks any claim that the agentic runtime exists, and blocks the 24 August acceptance | Larry (dispatch) |
| 2 | **CRITICAL** | `regularCandidates()` (`skill/planner.js:257-304`) generates the candidate list the human sees by word-overlap with a `w.length > 2` filter and an alphabetical tie-break. Demonstrated output: cat food for wet wipes, bananas for toffees, quarter pounders for Ben & Jerry's | **blocking** — same action | Larry (dispatch) |
| 3 | **HIGH** | Known products with active `regulars` rows are escalated as questions: `2 sliced roast beef` (regulars 80, 81) at 0.99 confidence with `matched_regular_id` NULL; `Heinz baked beans` asked back at Warwick under the full catalogue name of the regular it had already matched | **blocking** — same action | Larry (dispatch) |
| 4 | **HIGH** | `shop_question` id 76509 was sent to Telegram with **zero** candidates. A question the product surface makes impossible to answer | **blocking** — violates this contract's coherent-surface property directly | Larry (dispatch) |
| 5 | **HIGH** | The one legitimate question (`2 Sure deoderent male`) offered four Sure variants, none of them the men's range, ignoring the word `MALE` present in the line it was asking about | **blocking** — same action | Larry (dispatch) |
| 6 | **HIGH** | `browser_build_request` id 1 has been re-claimed and released with `TypeError: The "path" argument must be of type string…` on every runtime pass since 2026-07-28 — 291 logged failures, still firing. No attempt ceiling, no backoff, no terminal state | **blocking** for requirement 7 — a browser lane that fails unboundedly cannot be assured, and it masks any real failure behind identical noise | Larry (dispatch) |
| 7 | **HIGH** | `SOP-021:9` and `SOP-021a:11` still instruct that the live basket writer is *"Sonnet in Claude for Chrome"*, superseded 2026-08-17. This is the named authority for requirement 7's "established shopping method" | **blocking** — it misdirects the current executable journey, which is the material-effect test in root `CLAUDE.md` §Finding disposition | Larry (dispatch) |
| 8 | MEDIUM | The runtime consumes no contract or SOP text at any point. `SOP-021` occurs in `services/asdair/**` only inside code comments. Gap 10 on the Wayfinder ("prove rules exist in files while the executor ignores them") is not closed | non-blocking at this gate — it is the cause of defects 1–3 rather than a separate outcome | Larry (dispatch) |
| 9 | MEDIUM | `shop_line_provenance` holds 0 rows across the entire database; `pipeline_command` id 277 `groundingEvidence` has been `pending` with `attempts=0` since 13:47. Reconciliation to the source photograph is still a human act | non-blocking for the 24 August route; **blocking for requirement 9 if a trolley is built before it is wired** | Larry (dispatch) |
| 10 | LOW | `pipeline_command` id 272 `receiveList` remains `pending`/`attempts=0` although the shop was created — a ledger row that never reconciles with the effect it records | non-blocking | Larry (dispatch) |
| 11 | LOW | `Deliverables/2026-08-18-what-a-capable-model-does-with-this-list.md` describes line 14 as "already matched at 0.99" where `matched_regular_id` is NULL | non-blocking | Larry (dispatch) |
| 12 | LOW | Stale copy of the superseded Asdair shim at `.claude/worktrees/b15-runtime/.claude/agents/asdair.md` | non-blocking — **outside this reviewer's estate boundary**, recorded once and parked | Larry (estate reconciliation) |

## Verdict

**FAIL** — the integrated production route does not deliver the phase's promised human outcome: a real
photograph produced a question board on which six of seven questions could not be answered, because the
approved contract's semantic decision-maker is still a deterministic word-overlap scorer on the live path.

Answering Gate 2's mandatory question plainly: **«Can Warwick now do the thing this phase promised, in the
real intended context?» No.** He sent the photograph through the normal route with no technical help, which
is real progress and is recorded as such — and what came back offered him cat food for wet wipes, bananas
for toffees, and one question with no options at all. He cannot complete this journey using only the
product in front of him, and no amount of correct backend wiring changes that.

This is `FAIL` rather than `HOLD` deliberately. `HOLD` is for missing evidence; the evidence here is
present and it demonstrates a violation of the accepted design (goal contract structural rule 1) on the
production path. Requirements 5–9 are individually `HOLD` for want of evidence, and none of those HOLDs is
concealed by this overall verdict.

**What this FAIL gates, precisely:** any claim that BUILD-015's agentic runtime is delivered, complete,
operational, durable, ready, accepted or closed; the phase-boundary PASS on the Wayfinder; and Codex
invocation for release QA of this scope. **What it does not gate:** the corrective implementation work
itself, which is Larry's to sequence and is unblocked. The frontier remains the Wayfinder's.

**One thing that must not be lost in the failure.** The photograph read is genuinely good and is the first
half of the North Star working: 37 lines, `match_confidence` 0.94–0.99, the invented product gone, both
Heinz products distinct where one had previously vanished, and the terminal-shop collision that falsified
a previous readiness verdict correctly avoided by `-M128`. The defect is downstream of that, and narrow:
**the model is used to read the list and then not consulted again about what to buy.**

## Next review trigger

The semantic decision point moves — that is, a capable model, not `regularCandidates()`, produces the
resolution and the candidate set for unresolved lines on the live `act:plan` path — **and** a real weekly
photograph is driven through the joined production route to a reconciled trolley or to a genuinely
answerable question board. **Not** a receipt, a document repair, a moved HEAD, a green suite, or a manual
invocation of any component.
