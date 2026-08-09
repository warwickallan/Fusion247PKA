# Lane B — durable household knowledge between shops

**Pax · 2026-08-09 · READ-ONLY establishment and implementation-readiness · governance head `d907350`**
Commissioned by Warwick. No source edited, no live household knowledge mutated, no Work Package created.

**Method.** Static read of `services/asdair/**`, `services/cockpit/**` and `services/asdair/db/*.sql` at
the main checkout. Every module labelled below was reached by **enumerating its callers repo-wide**,
not by inspecting the one call site I expected. Live row-counts are carried forward from the
2026-08-08 read-only extract (`Deliverables/2026-08-08-pax-supabase-household-knowledge-audit.md`) —
**I had no database access and no shell in this dispatch**, so every live claim is single-sourced to
that extract and is flagged where it is load-bearing. Lane A is actively changing
`services/asdair/pipeline/**` and `services/asdair/bot/**` in a separate worktree; line numbers in
those two folders are as-of this head and should be re-pinned before implementation.

**Labels.** `PROVEN LIVE` = executed against real household data · `WIRED NOT PROVEN` = a production
caller exists, never run · `BUILT NOT WIRED` = no production caller at all · `BROKEN` = wired and
structurally incapable of its stated purpose.

---

## The one-paragraph answer

All three flows are **built and none of them has ever learned anything.** Every alias, rule and
product identity in the live household catalogue was written by Larry through a CLI. B1 is wired end
to end and is **BROKEN** at a single literal that is *earlier and more decisive* than the
`applies_going_forward` flag everyone has been looking at. B2's alias arc is wired but its input
table has **had zero rows ever**, and the Favourites half does not exist in any form — no module
anywhere reads an ASDA Regulars or Favourites list. B3 has **no production caller at all**: the
pipeline reaches its terminal `RECONCILED` state without ever writing an order row.

---

# B1 — HUMAN DECISION LEARNING

## WHAT EXISTS

| Module | Purpose | Label |
|---|---|---|
| `outcome/buildAnswerLearning.js` | PURE. One settled answer → `{decision, regulars[], pending_actions[], suppression}` | WIRED NOT PROVEN |
| `outcome/recordAnswerLearning.js` | The runtime join: `promoteDecision` → `updateRegulars` → `pending_action` | WIRED NOT PROVEN |
| `outcome/promoteDecision.js` | `rule_qa_log` row always; `asdair.rules` row only on `applies_going_forward === true`, with a default-deny provenance guard | WIRED NOT PROVEN |
| `outcome/updateRegulars.js` + `buildRegularsUpdate.js` | The catalogue writer (alias merge, enrich allowlist) | WIRED NOT PROVEN |
| `skill/data.js:293-301` `loadRuleQaLog` | Reads the log back as `priorAnswers` | PROVEN LIVE (reads 5 rows) |
| `skill/planner.js:1087-1097` `eligiblePriorAnswers` | The consumer filter | PROVEN LIVE |
| `pipeline/store.js:638-645` `claimAnswerLearning` | One-shot idempotency key `learn:<shopId>:<questionKey>` | WIRED NOT PROVEN |
| `outcome/answerSurvivesTheWeek.test.js` | The acceptance property, in-memory, against the **real** planner | test only |

## WHAT IS ACTUALLY WIRED

The chain has a genuine production caller and it is not a stub:

```
runPipeline.js:626  deps.recordAnswerLearning({...})
  → deps.js:395     recordAnswerLearning: realRecordAnswerLearning
  → deps.js:336-344 takes a real client from the write pool, calls outcome/recordAnswerLearning.js
  → promoteDecision → asdair.rule_qa_log  (+ asdair.rules, gated)
  → updateRegulars  → asdair.regulars     (aliases)
  → INSERT asdair.pending_action
```

`stepReplan` (`runPipeline.js:595-653`) runs from `NEEDS_DECISION` with zero open questions, claims
each answered/skipped question once, and calls the writer. Failures are **not** caught — the shop
parks `FAILED` (`runPipeline.js:587-593`). That is correct design.

## WHAT HAS RUN LIVE

**Nothing on this path.** `asdair.rule_qa_log` holds 5 rows, newest **2026-07-20**; all 5 have
`applies_going_forward = true` and were written by the `record-shop.js` CLI or migration `011`, i.e.
Larry-mediated. Shop 6's **11 real human answers (2026-08-03)** produced **zero** log rows — the
wiring postdates them. `asdair.pending_action` = **0 rows, ever**. *(Single-sourced to the 2026-08-08
extract.)*

## WHAT IS THE EARLIEST BREAK

> ### `runPipeline.js:641` — `resolution: { kind: 'none' }`
>
> **This is one line earlier than the `applies_going_forward` literal, and it is the decisive one.**

`buildAnswerLearning` builds catalogue operations in exactly two branches —
`resolution.kind === 'known_product'` (`buildAnswerLearning.js:365`) and `=== 'new_product'`
(`:381`). With `'none'`, **neither is taken**, so `regulars` stays `[]` (`:362`),
`pending_actions` stays `[]` (`:436`), and `suppression.prevents_repeat` is computed `false`
(`:456-461`). The production path therefore writes **exactly one audit row and nothing else.**

That matters because the alias is the *only* mechanism the acceptance test proves works:
`answerSurvivesTheWeek.test.js:258-288` — *"ACCEPTANCE: an answer given this week prevents the same
question next week"* — passes solely by applying the `regulars` operations to the catalogue. With
`kind:'none'` there are none to apply. **The passing acceptance test exercises a shape production
never produces.** Its own header says so honestly (`:38-40`): *"It does NOT prove the live pipeline
calls it — nothing in this file surface can."*

Two further **independent** breaks sit downstream. Fixing any one alone changes nothing:

2. `runPipeline.js:638` — `applies_going_forward: false`, hard literal. `promoteDecision` then writes
   no `asdair.rules` row at all (`promoteDecision.js:253-261`).
3. `planner.js:1091` — `if (qa.applies_going_forward !== true) return false;`. Even the audit row is
   filtered out of `priorAnswers`.

**The 30-line comment at `runPipeline.js:570-585` is false in three ways, and the one it argues about
is the weakest of them.** It claims *"the loop closes through the decision log, not through rule
promotion."* It does not close at all, and the mechanism that would close it — the alias — is
disabled two lines below the comment by a different literal the comment never mentions. This is the
estate's recurring defect pattern (documented-as-wired), in its most expensive form: **documented as
the fix.**

## WHAT IS THE MISSING SEMANTIC ACT

Warwick's four-way distinction is **representable in the data model and capturable by no surface**:

| Warwick's category | Representation that exists | Capture surface |
|---|---|---|
| This-week-only decision | `one_week_only: true` — honoured at `buildAnswerLearning.js:330` and `promoteDecision.js:264` | **none — no caller ever sets it** |
| Explicit future household preference | `resolution.kind='known_product'` + alias onto the regular | **none — `kind:'none'` is hard-coded** |
| Explicit standing rule (never/always) | `applies_going_forward:true` + a full structured `rule` + an authoritative `source_document_id` | **none** |
| Ambiguous forward intent (needs clarifying) | **no representation exists** | — |

The answer surface captures **which product**, never **what kind of decision**.
`commands.answerQuestion` writes only `status`, `answer_text`, `answer_source`. And there is an
arithmetic constraint worth naming before anyone designs a second button row: the Telegram
`callback_data` arg budget is 16 bytes, already fully spent by
`<questionKey>.<candidateIndex>` (`bot/resolveTap.js:22-26`) — **a second dimension cannot ride the
same callback payload.** A "and going forward?" act must be a *follow-up card* or a typed
convention, not an extra field on the answer button.

Note also the promotion bar, which is high on purpose and should not be lowered: an actionable
directive requires `source_documents.doc_type ∈ {agent_spec, decisions_log}` read from the database
(`promoteDecision.js:106, 358-375`), and a target `match_term`/`match_category` (`:297`). Anything
unproven is downgraded to inert `info` **with the reason appended to the rule's note** (`:379-401`) —
never refused. That guard is well built and is not the problem.

## WHAT CAN BE REUSED

Almost all of it. The one-shot claim ledger, the loud-failure contract, the alias merge, the
provenance guard, the duplicate-regular adoption guard and the whole planner-side read path are
complete and tested. **The gap is roughly one function: turn a settled `shop_question` row into a
`resolution`.**

The bridge already half-exists. `bot/resolveTap.js:210-324` `resolveCandidateAnswer` resolves a
tapped index **through the stored render contract** and returns a `candidateId`. And
`runPipeline.js:530-553` `candidatesFor` emits `{label, regular_id, source:'asdair.regulars
(resolveByCatalogue)'}` for resolver alternatives — **with a real `regular_id`** — while planner
suggestions deliberately carry a label only (`:545-551`: *"No id field is emitted, because the
planner does not return one and inventing one would be a lie"*). So a tap on a resolver-sourced
candidate can honestly yield `{kind:'known_product', regular_id}` today; a tap on a planner
suggestion cannot, and must not be made to.

## WHAT IS NEEDED TO SLOT IT INTO THE JOURNEY

Minimal data/schema implications: **none.** `shop_question` already stores `rendered_candidates`
(jsonb) and `callback_index` (`db/009_pipeline_command_and_question_render.sql`), which together
carry the chosen candidate. No migration is required for the `known_product` case.

## LIVE ACCEPTANCE CRITERIA (B1)

1. On a real shop, Warwick answers a question by tapping a **resolver-sourced** candidate.
2. `asdair.regulars` for that `regular_id` gains the photographed wording as an `aka` — **verified by
   SELECT, not by receipt** — and every prior alias survives.
3. `asdair.rule_qa_log` gains exactly one row for that question; re-running the pipeline adds none
   (the `claimAnswerLearning` one-shot holds).
4. **The following week, on a different `shop_id`, the same photographed wording opens no question**
   and the line resolves to that product. This is the only criterion that proves the lane; 1–3 prove
   capability only.
5. A tap on a **label-only** candidate records the audit row and writes no alias — and says so
   visibly, rather than silently doing nothing.

## BOUNDED RECOMMENDATION (B1) — one flow, one change

**Supply a real `resolution` at `runPipeline.js:626-642` for the case where it is honestly
derivable, and leave `applies_going_forward` exactly as it is.**

Read the settled question's `rendered_candidates[callback_index]`; if that candidate carries a
`regular_id`, pass `{kind:'known_product', regular_id}`; otherwise keep `{kind:'none'}` and record
*why* in the `learned[]` report the step already returns (`:611`, `:622`, `:646`). Do **not** touch
the `false` literal, the planner filter, or the promotion guard — those are the *standing-rule*
question and are a separate product decision about a human act that does not yet exist.

This is deliberately the smallest change that makes criterion 4 reachable. It closes B1's stated
outcome ("stop the same question being asked next week") **without** asserting a standing rule the
human never stated — which is exactly the inference the provenance guard was built to refuse.

**Anti-pattern to refuse explicitly:** flipping `applies_going_forward` to `true` at
`runPipeline.js:638`. It looks like the fix, it is what the surrounding comment invites, it would
make `ruleConsumption.test.js:582-588` go red, and it would turn every tap into permanent household
doctrine. It is the ambiguous inference the whole guard exists to prevent.

---

# B2 — CONFIRMED-BASKET CATALOGUE LEARNING

## WHAT EXISTS

| Module | Purpose | Label |
|---|---|---|
| `pipeline/deps.js:278-304` `realRecordLearning` | Reads `order_confirmation_line` where `matched_regular_id IS NOT NULL`, enriches each regular with the confirmed `product_name` as an alias | **WIRED NOT PROVEN** |
| `reconcile/reconcile.js` | PURE seven-outcome comparison: `as_planned · qty_changed · variant_changed · added_after_planning · unmatched · omitted · price_missing` (`:85-104`) | WIRED NOT PROVEN |
| `reconcile/recordConfirmation.js` | Writes `order_confirmation` + `order_confirmation_line` | WIRED NOT PROVEN |
| `outcome/update-regulars.js` | **CLI.** `node update-regulars.js --file <regulars.json>` — the Larry-mediated route | PROVEN LIVE (this is how ~100 aliases got there) |
| `packet/buildExecutionPacket.js` (`SOURCE_VIEWS = regulars\|favourites\|search`, `:81`) | The ASDA execution packet | **BUILT NOT WIRED** |
| `handoff/**` (`buildHandoff`, `completion.js`, `renderChecklist`) | Handoff + basket observation adapter | **BUILT NOT WIRED** |
| `reconcile/verifyBasket.js` | Packet-vs-actual basket verification | **BUILT NOT WIRED** |
| `outcome/buildAnswerLearning.js:437-451` | The un-clicked ASDA Favourite → `pending_action` | WIRED NOT PROVEN (unreachable while `kind:'none'`) |

## WHAT IS ACTUALLY WIRED

Exactly one thing: `runPipeline.js:785` `stepReconcile` → `deps.recordLearning` → `deps.js:394`
→ `realRecordLearning`. That is the confirmed-basket → catalogue arc, and it is real.

**Everything else in the B2 description is not wired.** Named explicitly, because "documented as
wired but no production caller" is the pattern:

- **`services/asdair/packet/**` and `services/asdair/handoff/**` have zero importers outside their
  own folders and their own tests.** Enumerated across
  `services/asdair/{pipeline,pipeline-runtime,cockpit-api,browser-runner}/*.{js,mjs,cjs}`: no
  `require`/`import` of either folder exists.
- **`asdair.execution_packet` and `asdair.basket_reconciliation` do not exist in any migration.**
  `db/*.sql` enumerated in full (001, 004–012, 016) — neither table is created anywhere.
  `cockpit-api/readPacket.js:59-60` guards with `to_regclass(...) IS NOT NULL` and degrades to
  `packet_state: 'not_built'`. The reader is honest; the producer and the table are absent.
- **`verificationFor` is never bound.** `runtime.js:698` passes `wiring.verificationFor || null`, and
  `realWiring` (`runtime.js:777-827`) returns no such key. So the BASKET_READY card always renders
  *"no basket verification is wired into this runtime yet"* (`runtime.js:558`). Honest, loud, and a
  zero-caller.

## WHAT HAS RUN LIVE

**`asdair.order_confirmation_line` has had zero rows, ever.** `realRecordLearning` has therefore
always been a loop over an empty result set — it has "succeeded" every time it ran and learned
nothing. `asdair.pending_action` = 0 rows. Every alias in the live catalogue is Larry-curated, and
`regulars.aka` carries **no per-alias provenance**, so the production loop cannot even be
distinguished from the manual one after the fact. *(Single-sourced to the 2026-08-08 extract.)*

## WHAT IS THE EARLIEST BREAK — three, in order

**1. The stage upstream has never fired.** `stepRecordConfirmation` (`runPipeline.js:730-770`) runs
only on a `SUBMIT_CONFIRMATION` command from `BASKET_READY` (`stages.js:87-88`). No shop has ever
reached it, which is why the input table is empty. Everything downstream is untested by execution.

**2. Schema — the confirmed basket cannot carry ASDA identity.**
`asdair.order_confirmation_line` (`db/006_shop_control_surface.sql:177-191`) has columns
`line_no · product_name · quantity · pack_size · promotion · line_price · price_basis ·
matched_regular_id · outcome · note`. **There is no `asda_product_id` and no `asda_url`.** The
confirmation is a forwarded ASDA email/text parse; product ids are not in it and there is nowhere to
put them. So *"persist useful exact ASDA identity/provenance into Supabase"* is **not representable
today** and is the one part of B2 that genuinely needs a migration. (Live corroboration: 46 of 103
regulars have no `asda_product_id`.)

**3. Nothing observes ASDA Regulars or Favourites at all.** Enumerated repo-wide: `source_view:
'favourites'` exists only as an **input vocabulary** on the packet and answer builders
(`buildExecutionPacket.js:81`, `buildAnswerLearning.js:110`). No module fetches, parses or diffs an
ASDA list. The 2026-08-08 extract records *"Favourites representation: does not exist live"*. There
is no Regulars/Favourites delta to observe because there is no observer and no stored representation
to diff against.

## THE BOB CONSTRAINT — where it actually bites

Warwick's rule — *ASDA Regulars/Favourites are platform evidence, not household intent* — is
correct and is **not currently violated by code, because no code reads the platform list.** It was
violated by **data**: regular 69 *"Arla BOB Semi-Skimmed Milk 2L"* sits ACTIVE with zero aliases,
seeded from platform/order history, while rule 10 (*"milk means Cravendale; never BOB"* — genuine
household intent) is `directive='info'` **with no `match_term`**, so it reaches no prompt, no
resolver and no plan line. The household is protected today only by alias curation on regular 4 —
it fails safe **for the wrong reason**.

**The implication for sequencing is the load-bearing one:** a Favourites observer is precisely the
mechanism that would re-create regular 69, automatically, every week. **Do not build the observer
until class-2 intent can outrank class-1 platform evidence at a decision point.** `regulars.source`
already exists as the provenance column and `buildAnswerLearning.js:155-158` already maps
`favourites → 'favourite'`; live data shows `source = 'regular'` on all 103 rows, i.e. the column is
present, plumbed, and carrying no discriminating information.

## LIVE ACCEPTANCE CRITERIA (B2)

1. One real shop reaches `ORDER_CONFIRMATION_RECEIVED` with a genuine forwarded confirmation, and
   `asdair.order_confirmation_line` holds one row per confirmed line — **the first rows that table
   has ever held.**
2. `stepReconcile` returns `learning.attempted > 0` and `learning.applied > 0`, and a SELECT shows at
   least one `regulars.aka` grew with a confirmed product name that was not there before.
3. Every prior alias on every touched row survives (the merge is a union, `updateRegulars` refuses a
   lost update — assert it, do not trust it).
4. A confirmed line matching **no** regular produces **no** new regulars row and **no** guess —
   `matched_regular_id IS NULL` is skipped by `deps.js:287`, and that must stay true.
5. The shop reaches `RECONCILED` even if the learning throws (`runPipeline.js:786-788`).

## BOUNDED RECOMMENDATION (B2) — walking skeleton, not the platform

**Prove `SUBMIT_CONFIRMATION → order_confirmation_line → realRecordLearning → regulars.aka` on one
real shop, and build nothing else in this flow.**

That arc is already fully wired; it has simply never had an input. It is the only B2 slice that can
be closed with **zero new modules, zero migrations and zero platform reads**, and it produces the
first-ever production-written alias — which is the thing that has never happened.

Explicitly **out** of this slice, and each for a stated reason:

- **The ASDA identity column** (`order_confirmation_line.asda_product_id`) — a real migration, and
  it should be designed once, alongside whatever eventually supplies the id. Recommend raising it to
  Warwick as a separate, small, later decision.
- **The Favourites/Regulars observer** — blocked behind the class-2-beats-class-1 rule above. Build
  the provenance ranking first or the observer will manufacture BOB rows.
- **`packet/**`, `handoff/**`, `verifyBasket`, `execution_packet`** — a large, coherent, well-tested,
  entirely unwired subsystem. Whether it is integrated, decommissioned as reference-only, or
  discarded is a **reconciliation decision for Warwick**, not something to quietly wire in as part
  of a learning slice.

**Anti-pattern to refuse explicitly:** treating "the ASDA Regulars list changed" as evidence of
household intent, in any direction — including the *inverse* temptation of removing a household
regular because it fell off the platform list.

---

# B3 — ORDER / OUTCOME LEARNING

## WHAT EXISTS

| Module | Purpose | Label |
|---|---|---|
| `outcome/buildOutcome.js` | PURE. `{plan, reconcile}` → `{order, events}`. `ORDER_COLUMNS` at `:85-98`; `EVENT_TYPES` at `:103`; `checked_out` pinned false | **BUILT NOT WIRED** |
| `outcome/recordShopOutcome.js` | Writes `asdair.orders` + `asdair.order_events` in one transaction; pins `checked_out=false` in SQL rather than trusting input | **BUILT NOT WIRED — zero production callers** |
| `outcome/record-shop.js` | **CLI.** The only caller. Header, verbatim: *"recordShopOutcome and promoteDecision were built, tested and proven end-to-end, but NOTHING INVOKED THEM"* (`:7-8`) | PROVEN LIVE (manually, twice) |
| `skill/data.js:513` `loadLastOrder` | Reads `asdair.orders` back into the prompt and planner | PROVEN LIVE (reads) |
| `previously_ordered` (live-only view, 106 keys) | Purchase frequency and last-ordered | **read by nothing** |

## WHAT IS ACTUALLY WIRED

**Nothing.** Enumerated repo-wide, the non-test references to `recordShopOutcome` are: its own
module, `record-shop.js` (the CLI), doc comments in `shopStore.js:11` / `updateRegulars.js:66,83,195`
/ `data.js:394`, and **`pipeline-runtime/runtime-deps.mjs:54` — which is a string literal in the
`PG_CONSUMERS` array (`:49-57`), a list of folders that `require('pg')`, not a call site.** That
string is worth naming: it makes the module *look* wired to a grep, and it is not.

`deps.js:391-395` binds `buildConfirmationPayload`, `recordConfirmation`, `recordLearning`,
`recordAnswerLearning` — and **no outcome writer at all.**

## WHAT IS THE EARLIEST BREAK

> ### `runPipeline.js:781-794` — `stepReconcile` writes no order.

The step calls `deps.recordLearning` and transitions to `RECONCILED`, which `stages.js:89` declares
**terminal**. So the pipeline completes a shop's entire lifecycle without ever recording that an
order happened. The step's own header (`:773-774`) says *"RECONCILE AND LEARN. The last arc of the
cycle: what actually arrived becomes next week's catalogue"*, and the stage table (`stages.js:88`)
labels the transition *"reconcile and learn"*. **Both describe an outcome record that the code does
not write.** Same defect pattern as B1's comment block, in a different file.

Consequence: `loadLastOrder` reads a table that only a human CLI can populate. Live: 2 rows, and
whether either qualifies as a *completed* order (`total_added IS NOT NULL`, `loadCatalogue.js:86-95`)
is **still unestablished** — it was fetch F1 on 2026-08-08 and remains open.

## WHAT THE ORDER UNIQUELY KNOWS (that the pre-checkout trolley cannot)

Establishing this separately, as instructed. Two distinct classes:

**Already computed and already persisted per line** — `reconcile.js` produces all seven outcomes and
`order_confirmation_line.outcome` stores the winner. `omitted`, `variant_changed`, `qty_changed` and
`unmatched` are each knowable **only** after the order, and are each a different household fact:
*ASDA did not have it · ASDA gave us something else · the quantity moved · we bought something
off-plan.* This half is representable today.

**Computed and then discarded** — the order-level aggregate: `basket_total` (actual, vs the budget
band), `total_requested` vs `total_added`, `total_needs_decision`, and the `order_events` narrative.
`buildOutcome.js` derives every one of these and nothing calls it, so the household's **spend and
fulfilment history does not accumulate.**

A third class is not represented anywhere and should be named rather than assumed: **delivery**
outcomes (what actually arrived at the door, substitutions accepted or refused, damaged/missing).
Nothing in the estate models a delivery as distinct from an order confirmation.

## MINIMAL DATA / SCHEMA IMPLICATIONS

**None for the aggregate.** `asdair.orders` and `asdair.order_events` exist, are grant-covered
(`ensure-asdair-runtime.mjs:162-163` requires `SELECT, INSERT` on both), and `schemaCompat.test.js`
already pins `ORDER_COLUMNS` against `001_asdair_schema.sql`. The writer is complete and the table is
ready. **Only the call is missing.**

## LIVE ACCEPTANCE CRITERIA (B3)

1. A real shop reaching `RECONCILED` leaves **one new `asdair.orders` row** with
   `checked_out = false`, a real `total_added`, and `run_at` non-null.
2. `total_added ≠ total_requested` where the confirmation genuinely differed — i.e. the row records
   what *happened*, not what was *planned*. A row that merely echoes the plan is a fail.
3. Re-running `stepReconcile` after a crash writes **no duplicate order** (`asdair.orders` has no
   natural key today — this needs a claim, exactly as `claimAnswerLearning` does for B1).
4. `loadLastOrder` on the following week's shop returns that order and it reaches the Terra prompt.
5. `checked_out` remains `false` in the database under an input that asks for `true`
   (`recordShopOutcome` enforces this in SQL — mutation-test it, do not trust the literal).

## BOUNDED RECOMMENDATION (B3) — one call, one guard

**Add `recordShopOutcome` to `stepReconcile`, behind a one-shot claim, and nothing else.**

Concretely: bind an outcome writer into `deps.js` alongside `recordLearning`; in
`runPipeline.js:781-794`, claim `outcome:<shopId>` through the same `store.insertOneShot` mechanism
`claimAnswerLearning` already uses (`store.js:638-645`), build the outcome from the plan already
recomputed at `stepRecordConfirmation` plus the persisted `order_confirmation_line` rows, and write
it. Follow `realRecordLearning`'s error posture, not `recordAnswerLearning`'s: **a failure to record
the outcome must not fail a shop that reconciled correctly** — the shop is over by then, and parking
it FAILED at the terminal boundary would be a worse outcome than a missing history row that can be
back-filled by the CLI that already exists.

**Anti-pattern to refuse explicitly:** building a new "shop history" table, view or reporting surface.
`asdair.orders`, `asdair.order_events` and `previously_ordered` already exist; the second is unwritten
and the third is unread. Adding a fourth home would be textbook regrowth.

---

# The `substitutes_allowed` continuity loss

## CURRENT STATE — established

| Fact | Evidence |
|---|---|
| Column exists, `not null default false` | `db/004_asdair_regulars.sql:80` |
| Live value is `false` on **all 103** regulars | 2026-08-08 extract; `DEFECT-LEDGER.md:785` (D-2026-07-28-33) recorded it at 91 rows |
| Historical truth: **9 of 36** products allowed substitutes | commission brief; `DEFECT-LEDGER` D-2026-07-28-33; Wayfinder `:721` |
| It **is** on the enrich allowlist — a writer exists | `buildRegularsUpdate.js:138`, `:411-418` (strict boolean, refuses anything but `true`/`false`) |
| Column-scoped write grant exists | `db/005_asdair_rw_grants.sql:69,74` |
| **No production path ever writes it** | `deps.js:292-296` `realRecordLearning` sends only `add_aka`, never `set`. The only route is `outcome/update-regulars.js` — the Larry CLI |
| It **is** read, in five places | `skill/data.js:97` · `packet/buildExecutionPacket.js:318-323` · `packet/renderChecklist.js:204` · `shop/shopStatus.js:122` (`count(*) FILTER (WHERE substitutes_allowed)`) · `cockpit/public/app.js:1368` |

**So the flag is fully plumbed, human-visible, counted on the status card, and uniformly false.** It
is a `false` that *looks like* a household decision and is actually an unpopulated default. That is
the worst of both: a real consumer reading a fabricated value.

`SOP-021a:486-496` already records the operational consequence — on 2026-08-03 the finished basket
had ASDA's *"Allow substitutions for all"* toggle ON, violating standing rule 6, and SOP-021 §5's
instruction to *"set per-item flags from each product's `substitutes_allowed`"* currently means
"set them all off."

## WHAT IT WOULD TAKE TO RESTORE TRUTHFULLY

**This is not an engineering fix.** The 9-of-36 fact is **class-2 household intent** living in the old
Order History document, not in the database, and it must not be re-derived from platform data —
that would be the BOB error applied to a permission flag, with a worse failure mode (a wrong `true`
authorises a swap the household refused).

Restoring it needs, in order: (a) the source document identified and read; (b) each of the 9
products mapped onto a **current** regular id — a mapping that must survive the 36→103 catalogue
growth and cannot be assumed one-to-one; (c) Warwick's confirmation that each of the 9 is still
wanted, since these are permissions and a stale `true` is the dangerous direction; (d) a single
`update-regulars.js --file` run with 9 `enrichRegular` operations carrying
`set: { substitutes_allowed: true }`, dry-run first.

**Recommendation:** carry this as a `product-decision` input for Warwick, not as engineering work.
The one thing that should change without a decision is **honesty**: `false` currently reads as "the
household said no" when it means "nobody has ever said". If a cheap distinction is wanted, that is a
nullable column or a display change — and it is worth exactly one sentence to Warwick, not a
mechanism.

---

# Cross-cutting

## Zero-caller modules, named

Per the dispatch instruction. Each of these is complete, tested, and reached by no production path:

1. **`outcome/recordShopOutcome.js`** — the only caller is a CLI. `pipeline-runtime/runtime-deps.mjs:54`
   makes it *look* wired to a grep; it is a string in a folder list.
2. **`services/asdair/packet/**`** (`buildExecutionPacket`, `renderChecklist`, `schemaAssert`,
   `committedSchema`) — no importer outside the folder.
3. **`services/asdair/handoff/**`** (`buildHandoff`, `completion`, `claim`, `fingerprint`,
   `instructions`) — no importer outside the folder.
4. **`reconcile/verifyBasket.js`** — `runtime.js` is built to consume it, but `realWiring` binds no
   `verificationFor` (`runtime.js:698`, `:777-827`), so it is permanently `null`.
5. **`asdair.execution_packet` / `asdair.basket_reconciliation`** — read by
   `cockpit-api/readPacket.js:59-71`, created by no migration.
6. **`asdair.previously_ordered`** (106 keys) — read by nothing.
7. **`pipeline/shopLines.js` `markCorrected`** — carried forward from
   `Deliverables/2026-08-09-pax-answer-to-plan-seam.md`; test-only callers.

## The pattern worth naming once

Three of the four most consequential findings in this lane are **a correct, detailed, confident
comment sitting directly above code that does the opposite**: `runPipeline.js:570-585` (the answer
loop "closes"), `runPipeline.js:773-774` + `stages.js:88` ("reconcile and learn"), and
`cockpit/public/apps.js:121` (the Cockpit "forwards the same named commands"). In each case the prose
describes the **design**, and a later constraint disabled the behaviour without the prose moving.
The cost is not the defect — it is that a reader who trusts the comment stops looking, which is how
B1's real break (`resolution: {kind:'none'}`) has sat five lines below a comment arguing about a
different line for a week.

## Confidence ledger

| Claim | Confidence |
|---|---|
| `resolution:{kind:'none'}` suppresses all catalogue learning on the answer path | **High** — both sides read (`runPipeline.js:641`, `buildAnswerLearning.js:362-419`) |
| B1's three breaks are independent; fixing one alone changes nothing | **High** |
| `recordShopOutcome` has zero production callers | **High** — callers enumerated repo-wide |
| `packet/**`, `handoff/**`, `verifyBasket` have zero production callers | **High** — importers enumerated |
| `execution_packet` / `basket_reconciliation` exist in no migration | **High** — all 11 `db/*.sql` files enumerated |
| `order_confirmation_line` cannot carry ASDA product identity | **High** — table DDL read (`006:177-191`) |
| No module reads ASDA Regulars/Favourites | **High** — repo-wide enumeration of `favourite`/`source_view` |
| `substitutes_allowed` has no production writer | **High** — `deps.js:292-296` sends only `add_aka` |
| Live row counts (`rule_qa_log` 5 · `order_confirmation_line` 0 · `pending_action` 0 · 103 regulars) | **Medium — SINGLE SOURCE.** The 2026-08-08 extract. I had no database access in this dispatch. Re-confirm before any acceptance claim rests on them |
| 9-of-36 historical `substitutes_allowed` | **Medium** — documented in DEFECT-LEDGER and the commission; the source document itself was not read by me |

## Open questions I could not resolve

1. **Are the live counts still current?** Everything live in this brief is one day old and
   single-sourced. One `SELECT count(*)` per table settles it.
2. **Fetch F1, still open from 2026-08-08:** do either of the 2 `asdair.orders` rows have
   `total_added IS NOT NULL`? If not, the Terra prompt's last-order context has never been populated
   and B3's break is one step wider than described.
3. **Is `packet/**` + `handoff/**` + `verifyBasket` wanted?** It is a large, coherent, well-tested,
   completely unwired subsystem. Integrate / decommission-as-reference / discard is a
   **reconciliation decision** and I have deliberately not chosen it.
4. **Where does the 9-of-36 `substitutes_allowed` record actually live**, and does it still map onto
   current regular ids? Not established — I did not read the old Order History source.
5. **Lane A's current shape.** `runPipeline.js` and `bot/**` line numbers are as-of `d907350`;
   Lane A is changing both folders in a separate worktree. Re-pin before implementing.
