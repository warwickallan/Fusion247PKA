---
build: BUILD-015
scope: phase-agentic-runtime — RE-REVIEW of the same boundary after the corrective Work Order
gate: 2

boundary: >
  The BUILD-015 phase promise as re-cut by Warwick 2026-08-17 — "AsdAIr is Mum's autonomous AI shopping
  operator": Mum's normal input becomes a correct, reconciled ASDA trolley with no Larry in the runtime,
  no Warwick technical intervention, and only genuinely ambiguous shopping questions asked. Re-reviewed
  after the corrective implementation that inverts the decision path, carries the approved contract into
  the decision call, and joins the browser lane.

reviewed_sha: 4bc08947c50014919508a3de2702178aa28de07c
governance_sha: 4bc08947c50014919508a3de2702178aa28de07c
branch: main

evidence_method: mixed — live runtime (pid 7892) + live asdair Postgres (read-only) + target checkout source read + executed suites
evidence_workspace: C:/Users/Buggly/AppData/Local/Temp/claude/C--Fusion247PKA/736e76e6-1682-4c84-97a0-acc90d1abe3a/scratchpad/veritas-g2rr
worktree_head_at_start: 4bc08947c50014919508a3de2702178aa28de07c
worktree_head_at_end: 4bc08947c50014919508a3de2702178aa28de07c
worktree_status_clean: true

verdict: HOLD
receipt_sha256: d8b33f1c8d99a99dd8408252cb1c1893f1d5405d6d3f26adfea4ac15a56f2ba0
reviewed_by: veritas
reviewed_date: 2026-08-18
next_review_trigger: >
  A REAL photograph is driven through the joined production route at or after this head, producing a
  durable `decisionEvidence` row with a contract digest and a question board or basket built from the
  model's own output — AND the browser lane either launches a real Chrome or stops terminally failing
  queued requests in silence. Not a receipt, a document repair, a moved HEAD, a green suite, or a
  manual invocation of any component.
---

## Scope reviewed

**In scope — the accepted user journey, ungrudged and unnarrowed.** The BUILD-015 North Star as re-cut
by Warwick on 2026-08-17, re-graded at the same logical boundary after the corrective Work Order. All
nine numbered functional requirements are graded; none was narrowed. The twelve findings of the prior
Gate 2 FAIL (`a0a71f5`, receipt `d30201d`) were carried as regression targets and each was checked.

**Deliberately NOT in scope**, per the dispatch: documentation housekeeping and assurance receipts;
estate-wide Git archaeology; hostile/multi-tenant hardening.

**The commissioning question is satisfied.** Executable behaviour at the semantic decision point
changed, a load-bearing dependency (the contract read) was added, runtime wiring changed, and the
runtime was restarted onto the merged bytes. This is a new boundary, not a re-read.

**Dispatch hygiene, recorded once, `non-blocking`.** The dispatch named one head and no separate
governance head, and declared no `private_surface` in the GL-012 form. It did name "the durable
`asdair` Postgres state" and "the live runtime pid 7892" as part of the boundary, so the surface
actually touched — `C:/.fusion247/asdair.env` (loaded by `node --env-file`, never read or printed) and
`C:/.fusion247/asdair/*` (log, status, pid) — was within what the dispatch put in scope. Recorded, not
treated as a refusal.

## Accepted requirements

| # | Requirement | Verdict | Evidence | Residual |
|---|---|---|---|---|
| 1 | AsdAIr, not deterministic word-ranking, owns semantic shopping judgement | **HOLD** | The inversion is real and provable at source: `runPipeline.js:198-340` `planWithDecisions` now runs planBasket → `demoteDeterministicDecisions` → `applyRulebook` → **`decideBasket`** → `applyDecisionsToPlan`; `deps.js:869` binds `decide: realDecideBasket` and `decisionModel: realDecisionModel` in the production dependency object; `demoteDeterministicDecisions` sets `alternatives: []` on every undecided item so no scorer suggestion can reach a human. 171 executed subtests green across `decisionCorpus`, `decisionSpine`, `runPipeline`, `confidenceIsNotABinding`. **But it has never run.** `SELECT … FROM asdair.pipeline_command WHERE command ILIKE '%decision%'` returns **0 rows across the whole database** — no `decisionEvidence` row exists, so the semantic decision point has not executed once on the production path | **Two, both load-bearing.** (a) Zero production executions ⇒ the promised property is unevidenced in the intended real context. (b) The deterministic layer can still BIND IDENTITY: 19 of 37 corpus lines bind through the tolerant matcher and travel as `correctable`, so a tolerant binding that is wrong and collides with nothing stands unless a model — never yet observed deciding in production — overturns it. Executed proof under requirement 7's contradiction row |
| 2 | Household catalogue, rules and Favourites reach that model judgement | **HOLD** | Carried in code and provable: `decideBasket({ plan, regulars, rules: inputs.rules, contract: loadContract(), … })`; `skill/contract.js` reads the goal contract and Asdair's `AGENTS.md` from their canonical committed paths, throws if either is missing or empty, and returns a sha256 the caller records via `store.recordDecisionEvidence` (`store.js:725-757`, fields `contract_sha256`, `contract_bytes`, `rules_sent`, `catalogue_size`). This is a genuinely good fix for prior finding 8 — it makes *which* contract governed a decision checkable rather than assertable | **The affordance has never been exercised**: no `decisionEvidence` row exists, so no contract digest has ever been recorded. **Favourites do not reach it at all** — nothing in the estate holds the retailer-side list, and the only route that would read it is the browser lane, which has never launched. Warwick's ruling that the offline exclusion does not waive the production requirement is therefore undischarged |
| 3 | Known products are resolved without unnecessary Warwick questions | **HOLD** | Offline, on the committed corpus, the interpret-stage resolver is clean: `node services/asdair/interpret/measure-known-list.js` → exit 0, **37 of 37 correct · 0 unauthorised identities · 0 lines that would be put to a human · 0 quantities lost or invented**. `confidenceIsNotABinding.test.js` (added here) pins the 0.99-with-NULL-binding defect. **In live durable state nothing changed**: shop 37's seven questions are all still `open`, `question_round=1`, and `asdair.shop_line` for shop 37 was last written at **13:47:56Z**, before the merge | The requirement is graded on a corpus, not on a production run. The five questions that should never have been asked are still open on Warwick's phone |
| 4 | Unresolved / new products are handled by capable-model reasoning | **HOLD** | `skill/decide.js` implements `select` / `search` / `ask` / `correct` verdicts, validates every cited `regular_id` against the household rows and records inventions in `audit.rejected`; an `ask` carries **the model's own candidates** (`decide.js:494-530`), so a zero-candidate question is not producible from that path. Proven offline by the corpus suite | Never executed in production. No live ASDA search has ever run, because the browser lane has never launched a browser. The `search` verdict has no proven consumer |
| 5 | Telegram input wakes and continues AsdAIr without Larry | **HOLD** | Wake is alive: the runtime (pid 7892, started 21:22:43Z, entry `C:\Fusion247PKA\services\asdair\pipeline\runtime.js`, `identity_verified: true`) is polling — `{"event":"fetched","count":0,"offset":171031189,"dry_run":false}` on pass 3. **Continue is still not proven**: 7 of 7 questions on shop 37 `open`, `answered_at` NULL, `asdair.shop_decision` holds 0 rows for shop 37, and the shop has sat at `NEEDS_DECISION` since 13:49:22.814Z — now 8½ hours | Unchanged from the prior gate. The answer→resume half of the loop has still never been exercised against the corrected code |
| 6 | Larry can disappear and the route continues | **HOLD** | Genuine positive, and it is executed evidence: the runtime was restarted at 21:22:43Z onto the merged bytes (files written 21:22:18Z), holds `C:\.fusion247\asdair\runtime.pid`, and has completed three autonomous passes over six shops with no Larry action — including claiming, running and finishing browser build requests 1, 2, 5 and 7 | The Wayfinder's own acceptance — *"deliberately terminate Larry / Claude Code… if AsdAIr stops progressing, FAIL"* — is **still unperformed**. And the route has not in fact continued: the one live shop has not moved in 8½ hours |
| 7 | Browser execution follows the established shopping method | **HOLD** | **The join defect is genuinely fixed and I verified the mechanism, not the claim.** `run-basket.cjs:332-344` now accepts an in-memory manifest object as well as a path, and the `ensureChrome` / `Session` seams let 42 executed subtests drive the real plan/ladder/judge/reconcile code over a fake session — a lane nobody could exercise offline is what let a one-line argument defect survive 291 failures. Prior finding 7 is properly closed: every `Sonnet in Claude for Chrome` instruction in `SOP-021` and `SOP-021a` is now struck through and marked SUPERSEDED with the corrected law in force. **But no browser has ever run**, and what the lane now does instead is a new blocking defect — see defects 1 and 2 | Three residuals: no browser execution evidence exists at all; `ASDAIR_CHROME_PATH` / `ASDAIR_CHROME_PROFILE_DIR` / `ASDAIR_CDP_PORT` are absent from `C:/.fusion247/asdair.env`; and `CONFIGURATION.md` documents the wrong variable names for the lane it now calls a live precondition |
| 8 | Question / resume works through the product surfaces | **FAIL** | Graded on the surface Warwick actually holds, read from the durable rows that render it. All seven `asdair.shop_question` rows for shop 37 are `open` and carry the **deterministic scorer's** candidates, unchanged: id 76512 *"Which product is '1 wet wipes'?"* offers exactly **one** option — *"Gourmet GOURMET Mon Petit Intense Cod, Sardine, Salmon Wet Cat Food 6x50g"*; id 76514 *"2 pkts ASDA plain toffees"* offers ham and eggs; id 76510 *"1 x 4pk Ben & Jerrys cookie dough"* offers *"ASDA 4 Beef Quarter Pounders 454g"*; id 76509 still carries **zero** candidates. `source` on those rows reads *"planner suggestion, matched to asdair.regulars by exact name"* | **This is not a regression introduced by the corrective work — it is a live surface the corrective work did not reach, and nothing regenerates it.** Worse in effect: `applyDecisionsToPlan` runs **after** `decideBasket` by design ("the human is last"), so if Warwick taps the cat food for wet wipes it becomes a binding decision the model cannot overturn |
| 9 | The final trolley is reconciled truthfully | **HOLD** | Not reached. No trolley exists. `SELECT count(*) FROM asdair.shop_line_provenance` → **0** across the whole database; `pipeline_command` id 277 `groundingEvidence` is still `pending`, `attempts=0`, since 13:47 | Unknown on a mandatory property ⇒ HOLD, never a qualified pass. Migration 020's deliberate no-backfill is accepted; the missing writer is not evidence either way |

## The contradiction the dispatch declared — resolved by execution

**Both measurements are correct. They measure two different components at two different hops, and the
one on the basket-building path is the wrong one.** This was not a disagreement to adjudicate; it was
two instruments pointed at different things.

- `interpret/measure-known-list.js` calls **`resolveByCatalogue.resolveAll`** — the INTERPRET-stage
  resolver (journey hop 4). Executed at this head: line 31 → *TRESemme Rich Moisture HAIR CONDITIONER
  680 ml*, line 32 → *TRESemme Rich Moisture HAIR SHAMPOO 680 ml*. **Larry's figures are accurate for
  that component.**
- The PLAN stage does not consume that binding. `runPipeline.workingListItems` supplies
  `planWithDecisions` with rows from `shopping_list_items` — raw list text — and `planBasket`
  re-matches them through **`planner.matchRegular`** (`planner.js:1603`). `shop_line.matched_regular_id`
  reaches only the question-candidate lookup (`runPipeline.js:1004, 1016`), never the plan binding.

Executed directly against the committed corpus and catalogue at this head:

```
line 31 | "1 TRESemme hair conditioner, blue label"
   expect: {"kind":"regular","id":17}
   plan-stage matchRegular -> 105 TRESemme Rich Moisture HAIR SHAMPOO 680 ml | exact=false
line 32 | "1 TRESemme shampoo"
   expect: {"kind":"regular","id":105}
   plan-stage matchRegular -> 105 TRESemme Rich Moisture HAIR SHAMPOO 680 ml | exact=false

planBasket items: 37 | tolerant bindings: 19 | exact bindings: 1
   "1 TRESemme hair conditioner, blue label" -> TRESemme Rich Moisture HAIR SHAMPOO 680 ml | flags: matched from regulars ; matched tolerantly
   "1 TRESemme shampoo"                      -> TRESemme Rich Moisture HAIR SHAMPOO 680 ml | flags: matched from regulars ; matched tolerantly
```

**The implementer is right about the path a real shop traverses.** On the production plan path the
deterministic tolerant matcher binds line 31 to the product that line's own `forbid` list names, binds
line 32 to the same product, and raises no question about either. Both survive as bindings, marked
`correctable`, and reach the basket unless the model overturns them. Larry's `measure-known-list`
evidence does not cover that path, so it neither confirms nor refutes the finding — and presenting the
two as contradictory measurements of one thing would have retired a live defect on evidence about a
different component. The declaration rather than the resolution was the right call.

**The measured fast path is the reason this matters:** 1 exact binding, 19 tolerant, of 37 lines. The
architecture's safety on 19 of 37 lines rests on a model correction that has never been observed.

## Evidence provenance

- **Reviewer home:** `C:/Fusion247PKA` on `main` at `4bc08947c50014919508a3de2702178aa28de07c`,
  read-only. **No `git archive` export was taken**: the load-bearing questions at this gate are about
  the LIVE runtime and the LIVE durable state, which an export cannot show. Contract §"Evidence
  isolation" permits this and requires it be stated — **every runtime and database fact below was read
  against live state, not an export.** Source reads and the two executed scripts ran against the
  target checkout, whose tree was clean and unchanged throughout.
- **`git rev-parse HEAD`** at start and end — `4bc08947c50014919508a3de2702178aa28de07c` /
  `4bc08947c50014919508a3de2702178aa28de07c`, identical.
- **`git status --porcelain`** — empty at start and empty at end. The working tree was not modified.
- **Remote reachability** — `git branch -r --contains 4bc0894…` → `origin/main`. The reviewed head is
  durable on the canonical remote.
- **Database access** — `asdair` Postgres via `ASDAIR_DB_URL`, every statement inside
  `BEGIN TRANSACTION READ ONLY` … `ROLLBACK`, through an ephemeral script in a per-worker-namespaced
  scratchpad directory. **No write of any kind was issued.** No secret value was read or printed.
- **No mutation testing was performed**, in the repository or anywhere else. None was needed: the
  held properties are established by absence of production rows and by real production output.
- **Not executed, and named rather than smoothed over:** (a) no live gateway call was made — the
  decision model resolves to `gpt-5.6-terra` with `FUSION_GATEWAY_URL` and `FUSION_GATEWAY_KEY` set,
  but whether that alias is served was not tested, because spending on a live model call is not this
  role's to authorise; (b) the kill-Larry test — I may not terminate Larry's session; (c) any browser
  or trolley evidence — none exists.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `git rev-parse 4bc0894…:"Team/Veritas…/AGENTS.md"` | 0 | n/a | `d63d613d0c4001e6476a750316fa3193bd6ee2d4` — contract blob bound at the governance head |
| `git branch -r --contains 4bc0894…` | 0 | n/a | `origin/main` |
| `node --test pipeline/decisionCorpus.test.js decisionSpine.test.js runPipeline.test.js interpret/confidenceIsNotABinding.test.js` | **0 (node's own exit, not a pipe's)** | **171** | `# pass 171 · # fail 0 · # skipped 0` |
| `node --test basket-executor/browserLaneJoin.test.cjs browser-runner/runner.test.cjs` | **0** | **42** | `# pass 42 · # fail 0` |
| `node services/asdair/interpret/measure-known-list.js` | 0 | n/a | 37 of 37 correct · 0 unauthorised · 0 avoidable questions · 0 quantities lost · 7 of 39 rules read deterministically. **Measures `resolveByCatalogue`, not the plan binder** |
| ad-hoc: `planner._internal.matchRegular` + `planBasket` over the committed corpus | 0 | n/a | lines 31 and 32 both → regular 105 (SHAMPOO); 19 tolerant bindings, 1 exact, of 37 |
| `SELECT … FROM asdair.pipeline_command WHERE command ILIKE '%decision%'` | 0 | **0 rows** | **the semantic decision point has never executed in production** |
| `SELECT id, shop_ref, status, human_state, updated_at FROM asdair.shop ORDER BY id DESC LIMIT 8` | 0 | 8 rows | shop 37 `NEEDS_DECISION`, `updated_at` **13:49:22.814Z** — unchanged since the prior gate. No shop created after the merge |
| `SELECT max(updated_at) FROM asdair.shop_line WHERE shop_id=37` | 0 | 1 row | **13:47:56.230Z** — no re-plan has occurred |
| `SELECT id, status, question_round, jsonb_array_length(candidates), candidates FROM asdair.shop_question WHERE shop_id=37` | 0 | 7 rows | all `open`, round 1, scorer candidates verbatim; id 76512 offers cat food only; id 76509 offers nothing |
| `SELECT … FROM asdair.browser_build_request ORDER BY id` | 0 | 7 rows | ids **1, 2, 5, 7 all `failed`** with `last_error='launcher-config'`, `finished_at` between 21:22:48Z and 21:26:03Z tonight, `progress` reduced to `{"executor": null}`. id 8 `failed: NoExecutablePlanError` |
| `SELECT count(*) FROM asdair.shop_line_provenance` | 0 | 1 row | **0** |
| `SELECT id, command, status, created_at FROM asdair.pipeline_command ORDER BY id DESC LIMIT 8` | 0 | 8 rows | newest is id **282 at 14:13:35Z** — **nothing has been written to the outbox since the prior gate**; tonight's four browser failures produced no outbox row |
| `C:/.fusion247/asdair/runtime.log`, `status.json`, `runtime.pid`; `Get-Process -Id 7892` | 0 | 68 log lines | pid 7892, node, started 22:22:43 local; three passes; `LAUNCHER CONFIG ERROR` on requests 5 and 7 |
| `grep -c Sonnet SOP-021 / SOP-021a` + context read | 0 | 7 / 7 | every occurrence struck through and marked SUPERSEDED — prior finding 7 closed |
| `grep ASDAIR_CHROME_* / ASDAIR_CDP_* services/asdair` | 0 | n/a | launcher reads `ASDAIR_CHROME_PATH`, `ASDAIR_CHROME_PROFILE_DIR`, `ASDAIR_CDP_PORT`; `CONFIGURATION.md` documents `ASDAIR_CHROME_EXE` / `ASDAIR_CDP_ENDPOINT` and marks the endpoint `ADVISORY` |

**On the pipe hazard the dispatch raised:** every count above was taken from node's own exit code and
from `# pass` / `# fail` lines in a file, never through `| tail`. The hazard is real and is avoided
here rather than inherited.

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | **HOLD** | The correction addresses the right thing and addresses it structurally — the model is now the decision-maker by construction, not by discipline. The North Star outcome has not been produced once at this head |
| Design fidelity | **PASS** | Goal contract structural rule 1 is now satisfied at source: `planWithDecisions` runs the deterministic layer as a mechanical lookup, discards its suggestions at a seam, and takes the semantic decision in a model call. `decisionSpine.test.js` asserts on the module's own source that no second `deps.planBasket(` call site exists. The tolerant-binding residue is a bounded exception the design states openly rather than a violation it hides |
| Functional proof | **HOLD** | 213 executed subtests and a clean 37-of-37 corpus run prove the components. **Zero production executions of the decision point**, zero browser executions, zero trolleys. Component proof is not the production path — the operating principle this role exists for |
| Integration | **HOLD** | Telegram → runtime → transcribe → interpret → plan is wired and has run (before this head). plan → decide is wired and has **never** run. plan → browser → trolley → reconcile is wired and now terminates in failure before a browser is launched |
| Durability | **HOLD** | The shop spine survives restart — the runtime came up on merged bytes and resumed six shops with no reconstruction. **Counter-evidence introduced at this boundary:** a `basket_not_ready` result calls `lease.finish(status:'failed')` on the FIRST attempt with no retry and overwrites `progress` with `{"executor": null}`, destroying any carried executor progress the Gap-7 recovery design exists to preserve |
| Test quality | **HOLD** | The new suites are good: `browserLaneJoin.test.cjs` drives the real plan/ladder/judge/reconcile over a fake session, and `decisionSpine.test.js` pins the invariant on source text. **But nothing covers the path that actually fired four times tonight** — `basket_not_ready` → terminal `failed`. The only `'failed'` assertions in that suite are on the attempt-ceiling path |
| Git truth | **PASS** | Reviewed head is on `main`, reachable from `origin/main`; working tree clean and unchanged start to end; the live runtime's recorded entry point is the primary checkout, and its start time (21:22:43Z) is after the merged files were written (21:22:18Z), so it is provably executing these bytes |
| Documentation truth | **HOLD** | Prior finding 7 is properly repaired and I verified it independently. Two defects remain, one of them material: `CONFIGURATION.md` — the file whose stated purpose is that configuration gaps do not go missing — names `ASDAIR_CHROME_EXE` / `ASDAIR_CDP_ENDPOINT` (endpoint marked `ADVISORY`) for a lane whose production launcher requires `ASDAIR_CHROME_PATH`, `ASDAIR_CHROME_PROFILE_DIR` and `ASDAIR_CDP_PORT` as blocking with no defaults, and which that same file now calls a "live precondition". `RUNBOOK.md` has the right names; the two disagree |
| Residual risk | **PASS** | Every residual the dispatch declared was independently reproduced and none was found understated — including the uncomfortable ones (1-of-37 exact bindings; `regularCandidates` retained; `shop_line_provenance` empty; the pipe hazard). Two limits the dispatch did not name are recorded below as defects 1 and 2 |
| Completed automation | **HOLD** | Mandatory here. The runtime half is genuinely satisfied — a real supervised process, from a stable approved runtime, resuming without Larry. The promised automatic outcome is a **reconciled trolley**, and the route now stops earlier than it did at the prior gate: it stops at a browser request that terminally fails on missing configuration, silently. Under root `CLAUDE.md` §"Nothing may live only in Larry's head", *failure must never be silent* — and this one is |

## Production caller and journey

Traced from the real entry point, at this head, against live state.

1. **Telegram intake** — alive. Long-poll at offset 171031189, `count:0`. No new photograph since 13:42Z.
2. **`receiveList` → shop** — unchanged; last exercised 13:42:37Z creating shop 37 correctly beside a
   terminal `SHOP-2026-08-18`.
3. **`act:transcribe` → `act:interpret`** — model judgement, works, evidenced at the prior gate.
4. **`act:plan` → `planWithDecisions`** — ⭐ **the repaired hop. Never executed.** Shop 37 is parked at
   `wait:answers` and nothing re-plans a shop in that state without an answer. The corrected decision
   path is reachable only from a new answer or a new shop.
5. **`decideBasket` → gateway `answer` role** — **zero invocations, ever.** No `decisionEvidence` row.
6. **Question board → Telegram** — the live board is the prior gate's board, byte-identical in its
   durable rows. Nothing has been queued to the outbox since 14:13:35Z.
7. **Browser lane** — ⛔ **reached, and this is what it does now.** On each pass the runtime claims the
   oldest eligible `browser_build_request`, builds a manifest from durable rows (50 lines for shop 6,
   38 for shop 26 — the join genuinely works), reaches `ensureChrome`, throws `LauncherConfigError`,
   returns `basket_not_ready`, and `consume-request.cjs:166-172` calls `lease.finish(status:'failed')`.
   Four requests were terminated this way between 21:22:48Z and 21:26:03Z tonight.
8. **Trolley / reconcile** — never reached.

**Nothing on hops 1–7 required Larry.** The autonomy property is real. The journey still does not reach
the promised outcome, and it now stops one hop earlier and more quietly than it did before.

## Restart and durability

The runtime was restarted at 21:22:43Z onto the merged bytes and resumed six shops from durable
Postgres with no reconstruction — the shop spine's durability is evidenced by execution.
**Kill-and-revive was not performed by me**: the process is live and holds a lock, and terminating it is
a mutation of operational state this role has no authority to make.

The durability counter-evidence is new and belongs to this boundary. The Gap-7 design is explicit that
executor progress lives in the request row precisely so a resumed run does not re-add everything. The
`basket_not_ready` path overwrites that row's `progress` with `{"executor": null}` and marks the request
terminal on the first attempt. Requests 1, 2, 5 and 7 now carry exactly that. Shop 26 sits in
`WAITING_FOR_BROWSER`, whose stage decision is `AWAIT_RUNNER` — a park with no re-queue — and its only
request is terminal. That shop cannot progress again without intervention, and nothing said so.

## Documentation contradiction scan

- **Larry's declared DOCUMENT IMPACT / residuals:** nine items, including the unproven model judgement,
  no browser run, the 1-of-37 fast path, `regularCandidates` retained, line 14 fixture/live divergence,
  empty `shop_line_provenance`, unexecuted `release` SQL, the pipe hazard, and Favourites.
- **Verified independently:** every one held. The 1-of-37 figure is exact (I measured 1 exact, 19
  tolerant, 37 items). `shop_line_provenance` is 0 across the database. The pipe hazard is real.
- **What his list missed** — three, all found from durable state and source rather than from his account:
  1. **The browser lane's new failure mode.** Prior finding 6 is closed as stated — `browser_build_request`
     id 1 is terminal and `browser_build_failed` no longer appears — but it was replaced by
     `launcher-config` terminal failure on first attempt, which killed four queued requests tonight,
     wiped their progress, and produced no outbox row and no notification.
  2. **`CONFIGURATION.md` names variables the production launcher does not read.** Same document, same
     boundary, and it now declares those rows "live preconditions".
  3. **The live question board is unchanged and is still the product surface.** The corrective work
     repaired the generator, not the artefact, and no mechanism regenerates it. A tap on it still
     outranks the model by design.
- **Active documents that would misdirect a fresh instance:** `services/asdair/CONFIGURATION.md:16-17,
  70-72` — the wrong Chrome/CDP variable names for the now-authorised lane. Also, clerical and
  `non-blocking`: `Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md` row 4 of the gap table
  opens a `~~` strikethrough that is never closed, so the rest of the row renders struck.
- **Closure claims since the last receipt, and the receipt behind each:** **none found.** The Wayfinder's
  ⚑ WORK CLASSIFICATION block still reads `FRONTIER — REMEDIATE` with acceptance *"a real weekly shop
  completes all nine acceptance requirements"*. No completion, PASS, closure or readiness claim was made
  anywhere in the current Build or Wayfinder record at this head. The merge commit message —
  *"the approved contract becomes load-bearing runtime behaviour"* — is a true statement about source
  and does not claim an outcome.

## Regression targets — the prior twelve

| # | Prior finding | State at this head |
|---|---|---|
| 1 | Deterministic planner is the semantic decision-maker | **CLOSED IN SOURCE.** Order inverted, model bound in production deps, invariant pinned on source text. **Unexecuted in production** |
| 2 | `regularCandidates` produces the human's candidates | **CLOSED IN SOURCE.** `demoteDeterministicDecisions` empties `alternatives` before any consumer. `regularCandidates` has no production consumer and is retained with ~80 test call sites — accepted, reported |
| 3 | Known products escalated; 0.99 with NULL binding | **CLOSED IN SOURCE** (`confidenceIsNotABinding.test.js`, 0 avoidable questions on the corpus). **The live rows are unchanged** |
| 4 | A question sent with zero candidates | **CLOSED IN SOURCE** — an `ask` carries the model's own candidates. **Live question 76509 still has zero** |
| 5 | Sure MALE ignored | **CLOSED OFFLINE** — line 30 no longer binds deterministically and reaches the decision; the corpus scores it correct via household rule 50. Unproven live |
| 6 | 291-failure unbounded browser loop | **CLOSED AND INDEPENDENTLY VERIFIED** — id 1 is `failed`, terminal, `finished_at` 21:22:48.361Z; zero `browser_build_failed` events in the current log. **Superseded by a new failure mode — defect 1 below** |
| 7 | `SOP-021` / `SOP-021a` still instruct the Sonnet writer | **CLOSED AND VERIFIED** — all 14 remaining occurrences are struck through and marked SUPERSEDED with corrected law in force |
| 8 | The runtime consumes no contract text | **CLOSED IN SOURCE, and well** — `skill/contract.js` reads canonical bytes, fails loud, and the digest is recorded durably. **The recording has never happened, because the decision has never run** |
| 9 | `shop_line_provenance` empty | Unchanged, 0 rows. Accepted as separate work |
| 10 | `receiveList` permanently `pending` | Accepted as a latch, by design |
| 11 | *"already matched at 0.99"* in a deliverable | Corrected at `76637e3` |
| 12 | Stale shim in a worktree | Outside this reviewer's estate boundary |

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| 1 | **HIGH** | A `basket_not_ready` outcome marks the browser build request **terminally `failed` on the first attempt**, with no retry, no backoff and no re-queue, and overwrites `progress` with `{"executor": null}`, discarding the executor progress the Gap-7 recovery design exists to preserve. Four requests (1, 2, 5, 7) were terminated this way tonight without a browser ever launching. Shop 26 is parked at `wait:browser_runner` with its only request terminal and no route back | **blocking** for requirement 7 — it converts a transient environment gap into permanent loss of a shop's browser work | Larry (dispatch) |
| 2 | **HIGH** | That terminal failure is **silent to the human**. `runtime.js:2847` binds `announce` to a log line only; no outbox row was written (newest `pipeline_command` is id 282 at 14:13:35Z). The deliberate "no second announcement path" reasoning is sound for the *success* case and leaves the *failure* case unreported. Root `CLAUDE.md`: *failure must never be silent* | **blocking** for requirement 7 and for the `Completed automation` dimension | Larry (dispatch) |
| 3 | **HIGH** | The plan-stage tolerant matcher still binds identity on the production path: 19 of 37 corpus lines, including line 31 bound to a product its own `forbid` list names and line 32 bound to the same product. Correctness on those 19 lines depends entirely on a model correction that has never been observed in production | **blocking** for requirement 1's production claim; not blocking safe continuation | Larry (dispatch) |
| 4 | **HIGH** | The live question board for shop 37 is unchanged and still carries scorer candidates — cat food as the only option for wet wipes, ham for toffees, quarter pounders for ice cream, one question with no options. Because `applyDecisionsToPlan` runs after `decideBasket`, a tap on a wrong candidate binds and the model cannot overturn it | **blocking** for requirement 8 — Warwick cannot complete this journey from the product in front of him | Larry (dispatch) |
| 5 | MEDIUM | `services/asdair/CONFIGURATION.md` documents `ASDAIR_CHROME_EXE` and `ASDAIR_CDP_ENDPOINT` (the latter marked `ADVISORY`) for a lane whose production launcher requires `ASDAIR_CHROME_PATH`, `ASDAIR_CHROME_PROFILE_DIR` and `ASDAIR_CDP_PORT` as blocking with no defaults, and which the same document now calls a live precondition. `RUNBOOK.md` is correct; the two disagree | **blocking** for requirement 7's next enabling action — it misdirects whoever configures the browser lane | Larry (dispatch) |
| 6 | MEDIUM | No test covers the `basket_not_ready` → terminal `failed` path. `browserLaneJoin.test.cjs` asserts terminal state only on the attempt-ceiling path, so the behaviour that fired four times in production has no proof and no guard | non-blocking at this gate — it is the cause of defect 1 not being caught, rather than a separate outcome | Larry (dispatch) |
| 7 | LOW | `Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md`, gap-table row 4: an unclosed `~~` swallows the rest of the row | non-blocking — clerical, parked to the scheduled reconciliation | Larry (dispatch) |
| 8 | LOW | The dispatch named no separate governance head and no `private_surface` in the GL-012 form, although it did name the durable Postgres state and the runtime as in scope | non-blocking — recorded once | Larry (dispatch) |

## Verdict

**HOLD** — the design violation that produced the previous FAIL is genuinely repaired, and the repair is
better than it had to be; but nothing has run, the live surface Warwick holds is unchanged, and the
browser lane now fails terminally and silently.

Answering Gate 2's mandatory question plainly: **«Can Warwick now do the thing this phase promised, in
the real intended context?» No.** The seven questions on his phone are the same seven, with the same cat
food and the same ham, and the only route to the corrected path is a new shop nobody has told him to
send. If he answers the board he has, his answer outranks the model by design.

**This is `HOLD` and not `FAIL`, deliberately, and the distinction is not softening.** `FAIL` invalidates
the submitted route and sends Larry back to re-plan. The route is now correct — `planWithDecisions` puts
the model at the decision point by construction, the contract reaches it with a recorded digest, and the
browser lane's three-week-old join defect is fixed and provable. What is absent is production execution,
and absent evidence on a mandatory property is exactly what `HOLD` is for. Requirement 8 is graded
`FAIL` on its own row and that row is not concealed by this overall verdict.

**What this HOLD gates, precisely:** any claim that BUILD-015's agentic runtime is delivered, complete,
operational, durable, ready, accepted or closed; the phase-boundary PASS on the Wayfinder; and Codex
invocation for release QA of this scope. **What it does not gate:** the corrective implementation work,
which is Larry's to sequence and is unblocked. The frontier remains the Wayfinder's.

**What would discharge it, stated so it is not guessed at.** A real photograph through the joined route
producing (a) a durable `decisionEvidence` row carrying the contract digest, the rules sent and the
lines decided, and (b) a question board or basket whose contents came from the model's own output. That
single run answers requirements 1, 2, 3, 4, 5 and 8 at once. The browser lane needs its configuration
supplied and its terminal-on-first-failure behaviour reconsidered before requirement 7 or 9 can be
graded at all.

**One thing that must not be lost in the hold.** The correction was made at the right layer. It would
have been cheaper to tune the scorer, and Warwick refused that in terms; the implementation refused it
too, discarded the scorer's output at a seam rather than weakening the proofs that pin it, reported
`regularCandidates`'s orphaning instead of quietly deleting it, and made *which contract governed a
decision* a checkable fact rather than a claim. The tolerant-binding defect was found by the
implementer's own corpus and reported as HIGH against its own work. That is the behaviour this gate
exists to reward, and it is recorded as such.

## Next review trigger

A **real photograph** driven through the joined production route at or after this head, producing a
durable `decisionEvidence` row and a board or basket built from the model's own output — **and** the
browser lane either launching a real Chrome or ceasing to terminate queued requests silently. **Not** a
receipt, a document repair, a moved HEAD, a green suite, or a manual invocation of any component.
