# BUILD-015 Lane D — post-shop wrap-up and reconciliation: what is BUILT vs what is PRESENT

**Author:** Pax (Senior Researcher) · **Date:** 2026-08-09 · **Commissioned by:** Warwick
**Governance head:** `d907350` · **Mode:** read-only establishment. No checkout, payment, slot, source edit or Work Package.
**Ceiling:** ~60 min. **Repo is PUBLIC** — no household personal data appears below.

---

## Executive summary

The post-shop quarter is **built to a high standard and almost entirely unexercised**. The pure
logic (parse, reconcile, price contract, idempotency) is genuinely excellent and is genuinely
wired into the pipeline dispatcher. But the quarter has **never once run**, and there are **three
structural breaks** between `BASKET_READY` and "next week has the learned state":

1. **There is no path from Telegram to `submitConfirmation`.** The intake turns *every* accepted
   message into `receiveList`. Forwarding the ASDA confirmation email would be interpreted as a
   **new shopping list**, not a confirmation. A source comment asserts the opposite.
2. **`asdair.orders` / `asdair.order_events` have no pipeline writer.** The only non-test caller of
   `recordShopOutcome` is a manual CLI. Because `loadLastOrder` gates on `orders.total_added IS NOT
   NULL`, **rotation and last-order context cannot survive the week** unless a human runs a CLI.
3. **The reconciliation summary card carries no numbers.** The production payload is `{ shopRef }`;
   the renderer expects seven counts. Every discrepancy figure renders `unknown`.

**Live status, verified:** `asdair.order_confirmation_line` has had **0 rows ever**. The entire
post-shop quarter is `WIRED NOT PROVEN` at its best and `BROKEN` at three points.

---

## Link-by-link audit

### Link 0 — `BASKET_READY` → Warwick checks out / pays / books slot (HUMAN ONLY)

| | |
|---|---|
| **WHAT EXISTS** | The stage table parks at `BASKET_READY` waiting for `submitConfirmation` (`services/asdair/pipeline/stages.js:87`, `:271-281`). `waitsFor: 'Warwick checking out HIMSELF and forwarding the ASDA confirmation'`. |
| **WHAT IS ACTUALLY WIRED** | The **absence** is enforced structurally, not by convention. `STEPS` (`stages.js:38-62`) contains no checkout/pay/slot step, and `stages.js:20-24` states a step not in `STEPS` "cannot be dispatched by runPipeline.js, and therefore cannot happen". `cockpit-api/commandSurface.js:68-75` holds a word-normalised deny list (`checkout`, `pay*`, `slot`, `password`, `place order`, `autonomous`) that fails binding loudly. `deps.js:348-356` refuses any non-allowlisted intent. |
| **WHAT HAS RUN LIVE** | Not applicable — this link is Warwick's own act. |
| **EARLIEST BREAK** | None. This is the healthiest link in the lane. |
| **REUSABLE** | All of it. |
| **TO SLOT IN** | Nothing. |

**`PROVEN LIVE`** — as an *absence*. Four independent mechanisms (STEPS vocabulary, deny list,
intent allowlist, `recordShopOutcome.js:90` refusing a checked-out order) enforce it. This is the
one part of the lane I would not touch.

---

### Link 1 — order confirmation reaches AsdAIr ⛔ **THE EARLIEST BREAK**

| | |
|---|---|
| **WHAT EXISTS** | `commands.submitConfirmation` (`services/asdair/pipeline/commands.js:387-399`), registered in the dispatch table (`commands.js:485`) and the command vocabulary (`commandNames.js:45`, `:74`). It retains the raw receipt verbatim (proved by `commands.test.js:300-305`). |
| **WHAT IS ACTUALLY WIRED** | **Nothing on the Telegram path produces this command.** `pollIntake`'s `persist()` (`runtime.js:116-146`) is unconditional: every accepted record becomes `commands.receiveList(spec, deps)` at `runtime.js:145`. There is no branch on shop status, no confirmation detection, no discriminator. The tap adapter (`telegramAdapter.js:149-152`) explicitly *refuses* to map the `confirm` action to a command. |
| **THE FALSE COMMENT** | `services/asdair/pipeline/telegramAdapter.js:150-151`, verbatim: `// A PROMPT, not an action: it asks Warwick to forward the ASDA email.` / `// The email itself arrives as a message and becomes submitConfirmation.` **The second sentence is false.** It arrives as a message and becomes `receiveList`. |
| **THE ONLY REAL CALLER** | `POST /asdair/command` in `services/asdair/cockpit-api/httpApi.js:196-222`, bound to `commandSurface.dispatch` (`httpApi.js:205-213`), with `submitConfirmation` on the surface (`commandSurface.js:45`). **That service is not mounted by the live Cockpit** — `services/cockpit/` contains no import of `cockpit-api` or `httpApi`; the sole mention is a comment at `services/cockpit/public/apps.js:104`. Corroborated independently in `Deliverables/2026-08-09-pax-answer-to-plan-seam.md:139`. |
| **WHAT HAS RUN LIVE** | Nothing. `asdair.order_confirmation_line` has **0 rows ever** (live query, `Deliverables/2026-08-08-pax-supabase-household-knowledge-audit.md:96`). |
| **EARLIEST BREAK** | **Here.** Everything downstream is unreachable through the surface Warwick actually uses. |
| **WHAT CAN BE REUSED** | `submitConfirmation` itself is complete and correct. The command ledger, idempotency and raw-text retention all work. Only the *trigger* is missing. |
| **TO SLOT IT IN** | A discriminator in `pollIntake` (or in the intake's record classifier) that, when the household's live shop is at `BASKET_READY`, routes the message to `submitConfirmation` instead of `receiveList` — **or** an explicit "I've checked out" button on the `basket_ready` card that latches the shop into a confirmation-expecting mode. The second is safer: content-sniffing an email to decide "list or receipt" is exactly the ambiguous inference this build refuses everywhere else. |

**`BROKEN`** — and worse than merely missing. A forwarded confirmation would be **planned as a
shopping list**, spending a model call and creating list rows. **This is the highest-consequence
finding in the lane.**

---

### Link 2 — the actual ASDA order is parsed

| | |
|---|---|
| **WHAT EXISTS** | `reconcile/parseConfirmation.js` — pure text → structured lines + order total. The price contract is genuinely rigorous: `price_basis` is required on every line, set in the same object literal as the number it describes, lines are frozen, and derivation requires five simultaneous conditions (`reconcile/README.md:25-78`). |
| **WHAT IS ACTUALLY WIRED** | Yes. `deps.js:45` imports `buildPayload` from `record-confirmation.js`; `deps.js:392` binds it as `buildConfirmationPayload`; `runPipeline.js:745-754` calls it inside `stepRecordConfirmation`. `deps.js:55` explains the import is safe because `record-confirmation.js` guards on `require.main`. |
| **WHAT HAS RUN LIVE** | Never. 0 confirmation rows. |
| **EARLIEST BREAK** | Inherits Link 1. No defect of its own found. |
| **REUSABLE** | All of it. |
| **TO SLOT IN** | Nothing — it activates the moment Link 1 is fixed. |

**`WIRED NOT PROVEN`**

---

### Link 3 — confirmed order reconciled against the confirmed plan

| | |
|---|---|
| **WHAT EXISTS** | `reconcile/reconcile.js` — seven outcomes with a data-driven precedence ladder (`OUTCOME_PRECEDENCE`), six matching passes, ambiguous sets matching nothing, `omitted` derived only from the plan (`reconcile/README.md:81-138`). Normalisation is imported from the planner's own `normaliseTerm` so reconciler and planner cannot drift. |
| **WHAT IS ACTUALLY WIRED** | Yes, via `buildPayload` → `runPipeline.js:745`. |
| **THE MATERIAL CAVEAT** | **The plan is RECOMPUTED, not read.** `runPipeline.js:730-743` re-runs `deps.planBasket(...)` at confirmation time. The code states why (`runPipeline.js:721-725`): "there is no plan table and inventing one would mean a migration in a folder this work package must not touch… planBasket is pure and deterministic, so given the same durable inputs it reproduces the same plan". **That premise is conditional on the inputs being unchanged.** `loadPlanningInputs` (`deps.js:247-258`) reads live `rules`, `regulars`, `products` and `rule_qa_log`. If any of those changed between planning and checkout — and Link 8's alias enrichment writes to `regulars` — the reconciliation compares the receipt against a plan **that was never shown to Warwick**. |
| **WHAT HAS RUN LIVE** | Never. |
| **EARLIEST BREAK** | Inherits Link 1. The recompute risk is latent and would show as spurious `variant_changed` / `omitted` lines. |
| **REUSABLE** | The reconciler wholesale. |
| **TO SLOT IN** | Either persist the approved plan at `READY_TO_SHOP`, or accept and *document to Warwick* that reconciliation is against a recomputed plan. This is a product decision, not a bug — but it is currently invisible. |

**`WIRED NOT PROVEN`** (with a flagged fidelity risk)

---

### Link 4 — order persistence (`order_confirmation`, `order_confirmation_line`)

| | |
|---|---|
| **WHAT EXISTS** | `reconcile/recordConfirmation.js` — header + lines in one transaction, shop row locked `FOR UPDATE`, idempotent on the natural key `(shop_id, content_fingerprint)` (`recordConfirmation.js:432-485`). `assertRecordable` (`:194-302`) validates the whole price contract *before* any connection opens. |
| **WHAT IS ACTUALLY WIRED** | Yes. `deps.js:46` imports it; `deps.js:393` binds it; `runPipeline.js:756` calls it. `matched_regular_id` **is** in `LINE_COLUMNS` (`recordConfirmation.js:115`) and **is** bound in `lineParams` (`:410`) — so the learning read in Link 8 has a real source. |
| **WHAT HAS RUN LIVE** | **0 rows ever** (live-verified). |
| **EARLIEST BREAK** | Inherits Link 1. |
| **NOTED GAP (the module's own)** | `order_confirmation_line.outcome` has **no database CHECK** in migration 006 and the column comment omits `price_missing` (`reconcile/README.md:218-220`). Vocabulary is enforced in code only. Low consequence for a hobby brain — record and park. |
| **TO SLOT IN** | Nothing. |

**`WIRED NOT PROVEN`**

---

### Link 5 — durable order outcome (`asdair.orders`, `asdair.order_events`) ⛔ **BREAK**

| | |
|---|---|
| **WHAT EXISTS** | `outcome/buildOutcome.js` (pure) and `outcome/recordShopOutcome.js` (order + events in one transaction), plus `outcome/promoteDecision.js` with a genuinely careful provenance guard. |
| **WHAT IS ACTUALLY WIRED** | **Nothing in the pipeline.** Enumerated callers of `recordShopOutcome` / `buildOutcome`: `outcome/record-shop.js:58-59` (**a manual CLI**), `outcome/test/outcome.dbtest.js:58-59`, `outcome/recordShopOutcome.test.js:25-26`, `outcome/buildOutcome.test.js:22`, `outcome/schemaCompat.test.js:34`. **Zero production callers outside the CLI.** |
| **AND IT IS DELIBERATE** | `deps.js:49-55`, verbatim: `// NOTE ON WHAT IS *NOT* IMPORTED HERE, AND WHY:` … `outcome/record-shop.js and shop/shop-cli.js all call main() at module scope - they are CLIs, not libraries`. The reason given is *import mechanics*, not a product decision — and the consequence (no `orders` row is ever written by the pipeline) is **not stated anywhere**. |
| **WHY IT MATTERS DOWNSTREAM** | `skill/data.js:505-518` — `loadLastOrder` selects `FROM asdair.orders … WHERE household_id = $1 AND o.total_added IS NOT NULL`. `data.js:391-400` explains "completed" *must* mean `total_added IS NOT NULL` because `checked_out` is false by construction. **If the pipeline never writes an `orders` row, `loadLastOrder` returns null forever** — and `data.js:519-520` treats that as "a first-ever shop. Not an error." So it fails **silently**, every week. |
| **WHAT HAS RUN LIVE** | `asdair.orders` holds **2 rows** (live, `2026-08-08-pax-supabase-household-knowledge-audit.md:31`). Whether either has `total_added IS NOT NULL` is **UNRESOLVED** — it is open question F1 in that same audit (`:186`) and **requires a live query I cannot run**. |
| **EARLIEST BREAK** | Independent of Link 1. Even a perfect confirmation flow would not write an `orders` row. |
| **REUSABLE** | `buildOutcome` + `recordShopOutcome` are complete and DB-proven (`outcome/test/outcome.dbtest.js:163-187`). Only the call site is missing. |
| **TO SLOT IN** | Add an `orders`/`order_events` write to `stepReconcile` (`runPipeline.js:781-794`), using the reconciled summary to populate `total_added`. `buildOutcome` is pure and takes plan + reconcile record — the exact two things `stepRecordConfirmation` already has in hand at `runPipeline.js:768`. |

**`BUILT NOT WIRED`** — and this is the break that silently kills next week's learning.

---

### Link 6 — the outcome writer / `last_order` input

| | |
|---|---|
| **WHAT EXISTS** | `skill/data.js:505` `loadLastOrder`, and `skill/planner.js:490` `chooseRotatedVariant`. |
| **WHAT IS ACTUALLY WIRED** | The *loader* is wired: `deps.js:254` calls `skill.loadLastOrder(householdId).catch(() => null)` and `runPipeline.js:380` and `:741` pass `lastOrder` into `planBasket`. Rotation is now reachable from a `rotate` **rule** rather than only an explicit argument (`planner.js:1049-1056`). |
| **THE STALE DOC** | `services/asdair/outcome/README.md:126-128` still lists as a known gap: **"No `loadLastOrder`. SOP-021 makes the previous order a required planning input, but nothing loads it"**. That is **out of date** — `data.js:505` exists and `deps.js:254` calls it. Flagging as documentation drift, non-blocking. |
| **THE HONEST CONFESSION** | `planner.js:1044-1047`, verbatim: `// chooseRotatedVariant() and loadLastOrder() have both been built, tested and` / `// live for weeks, and rotation has never happened once -- because the only way` / `// to trigger it was an` `args.rotation` `argument that NOTHING in the pipeline` / `// passes. The mechanism was reachable only from a test.` This is the estate's defect pattern **named by the code itself**, and it has since been fixed at the trigger. |
| **WHAT HAS RUN LIVE** | Rotation has **never fired** (per the comment above). Whether `loadLastOrder` currently returns non-null is **UNRESOLVED** (open question F1). |
| **EARLIEST BREAK** | Link 5. The loader is fine; it has nothing to load. |
| **TO SLOT IN** | Fix Link 5 and this link works with no further change. |

**`WIRED NOT PROVEN`** — functionally starved by Link 5.

---

### Link 7 — discrepancies visible (Telegram + Cockpit)

| | |
|---|---|
| **WHAT EXISTS** | Both renderers are complete: `bot/renderMessages.js:677` `renderConfirmationReceived` and `:704-725` `renderReconciliationSummary`, both registered in the `MESSAGES` catalogue (`:743-744`). |
| **WHAT IS ACTUALLY WIRED** | Cards are enqueued — `runPipeline.js:1042-1053` `queueMilestoneMessage` → `messageForTransition` (`:1056-1093`), which emits `confirmation_received` on `ORDER_CONFIRMATION_RECEIVED` (`:1078-1083`) and `reconciliation_summary` on `RECONCILED` (`:1084-1089`). |
| **⛔ THE PAYLOAD DEFECT** | `runPipeline.js:1088` emits `payload: { shopRef: shop.shop_ref }` — **and nothing else**. `renderReconciliationSummary` (`renderMessages.js:704-720`) renders seven values: `purchasedAsPlanned`, `addedAfterPlanning`, `omitted`, `qtyChanged`, `variantChanged`, `priceMissing`, `unresolved`. All seven arrive `undefined`. |
| **HOW IT FAILS** | Honestly, at least. `count()` (`renderMessages.js:62-63`) returns the literal `'unknown'` for anything non-finite, with the comment (`:59-60`): *"printing 0 for 'I have not worked that out yet' is the exact lie this build exists to stop telling."* So Warwick receives a card reading `Purchased as planned: unknown` seven times over. **Not misleading — but useless**, which is the whole point of the card. |
| **THE DATA IS RIGHT THERE** | `stepRecordConfirmation` already returns `reconcile_summary: built.reconciled.summary` (`runPipeline.js:768`). It is computed, returned, and then discarded — because the card is minted on the *later* `RECONCILED` transition, and `stepReconcile` (`:781-794`) never recomputes it. |
| **"VIEW EXCEPTIONS"** | Maps to `GET_STATUS` with `view: 'exceptions'` (`telegramAdapter.js:100-104`). Whether `getStatus` honours that view is **UNESTABLISHED** — I did not trace `shopStatus.getShopStatus`'s view handling within ceiling. |
| **COCKPIT** | The live Cockpit does not mount `cockpit-api` (see Link 1), so there is **no Cockpit reconciliation surface** at all. |
| **TO SLOT IN** | Carry the summary onto the `RECONCILED` payload — either persist it at `stepRecordConfirmation` or re-read `parsed->>'reconcile_summary'` (already stored, `recordConfirmation.js:372`) in `stepReconcile`. The second is cheap and needs no new column. |

**`BROKEN`** (renders, but conveys nothing)

---

### Link 8 — catalogue / household-learning hooks

| | |
|---|---|
| **WHAT EXISTS** | `deps.js:278-304` `realRecordLearning`, bound at `deps.js:394` and called by `stepReconcile` (`runPipeline.js:785`). It reads `order_confirmation_line` rows with a non-null `matched_regular_id` for the shop's latest confirmation and calls `updateRegulars({ op: 'enrichRegular', add_aka: [...] })`. |
| **WHAT IS ACTUALLY WIRED** | Genuinely wired, and the failure semantics are deliberate and correct: learning errors are collected, never thrown (`runPipeline.js:784-788`, `deps.js:298-301`) — "Learning NEVER fails a shop that otherwise reconciled correctly." |
| **WHAT HAS RUN LIVE** | **Never.** It reads `order_confirmation_line`, which has **0 rows ever**. Independently corroborated: `2026-08-08-pax-supabase-household-knowledge-audit.md:96` — *"reconcile-path enrichment (deps.js:278–304) reads `order_confirmation_line` — 0 rows ever"*. |
| **HONESTLY NOT WIRED** | `promoteDecision` is excluded **on purpose**, and the reasoning is documented rather than hidden (`deps.js:270-276`): *"DELIBERATELY NOT WIRED HERE: promoteDecision, which turns a human answer into a STANDING RULE… the pipeline does not currently capture 'and this applies going forward' as a distinct human act. Guessing it would be exactly the ambiguous-inference failure promoteDecision's own provenance guard exists to stop."* **This is exemplary.** It is a documented non-wiring, not a false claim, and I am recording it as correct behaviour. |
| **SCOPE LIMIT** | Learning is **alias enrichment only**. `favourites`/`regulars` promotion of genuinely new items, quantity correction, and decision promotion are all out of the automatic path. |
| **TO SLOT IN** | Nothing structural — it activates with Link 1. Widening beyond aliases is a separate product decision. |

**`WIRED NOT PROVEN`**

---

### Link 9 — the shop closes and reconciles honestly

| | |
|---|---|
| **WHAT EXISTS** | `stepReconcile` transitions to `RECONCILED` (`runPipeline.js:789-793`); `RECONCILED` is terminal and unreachable-from (`stages.js:89`, `:155-157`). Cancel is explicitly refused after reconciliation (`stages.js:150`) and the `close` tap is refused with a good reason (`telegramAdapter.js:153-156`): *"a shop closes itself when it reconciles; there is nothing to close by hand"*. |
| **WHAT IS ACTUALLY WIRED** | Yes. Terminality is enforced in the pure stage table. |
| **WHAT HAS RUN LIVE** | Never — no shop has reached `RECONCILED`. |
| **THE HONESTY GAP** | `stepReconcile` transitions to `RECONCILED` **whatever `recordLearning` returned** — including when it applied zero enrichments because there were no confirmation lines. A shop can therefore report `RECONCILED` having learned nothing, and the summary card (Link 7) will not say so. |
| **TO SLOT IN** | Surface `learning.attempted / applied / errors` (already returned at `runPipeline.js:793`) onto the reconciliation card. |

**`WIRED NOT PROVEN`**

---

### Link 10 — next week has the learned state

**`BROKEN`** — by Links 5 and 1 jointly. Specifically:

- No `orders` row → `loadLastOrder` returns null → rotation and last-order context are absent, **silently** (`data.js:519-520`).
- No confirmation rows → no alias enrichment ever fires.
- **`asdair.previously_ordered` — 106 item-keys of real purchase frequency — is read by ZERO code.** I verified this independently: no reference exists in any file under `services/**/*.js`; the only occurrences repo-wide are grant statements (`services/asdair/db/012_complete_grant_matrix.sql:58,70,99`), a drift note (`db/016_shop_source_image.sql:36`), and prior audit deliverables. Corroborated at `Deliverables/2026-08-08-pax-b15-grounded-vision-investigation.md:84`.

---

## Zero-caller modules — named explicitly

**The primary hunt. Every entry below was established by enumeration, not inspection.**

| Module | Non-test production callers | Evidence |
|---|---|---|
| **`services/asdair/handoff/**`** — `buildHandoff.js`, `claim.js`, `completion.js`, `instructions.js`, `fingerprint.js`, `index.js`, `renderChecklist.js`, `mutation-proof.js` | **ZERO** | No importer outside the folder anywhere in `services/**`. Only self-references and its own tests. (Confirms Larry's prior finding.) |
| **`pipeline/shopLines.js:205` `markCorrected`** | **ZERO** | Callers: `shopLines.test.js:52`, `runPipeline.test.js:578`. Both tests. (Confirms Larry's prior finding.) |
| **`outcome/recordShopOutcome.js` + `outcome/buildOutcome.js`** | **ZERO in the pipeline** — one manual CLI (`record-shop.js:58-59`) | Full enumeration in Link 5. **This is the newly-found instance and the most consequential.** |
| **`reconcile/verifyBasket.js`** | **ZERO** | Only `verifyBasket.test.js`. **And `runtime.js:388-392` documents a `report` that is "exactly what `reconcile/verifyBasket.js` returns" — while `runtime.js` never imports `verifyBasket`.** A comment describing a data flow that does not exist. |
| **`packet/buildExecutionPacket.js`, `packet/renderChecklist.js`** | **ZERO found** | No non-test reference in `services/**`. *Lower confidence — I did not exhaustively trace dynamic imports.* |
| **`cockpit-api/httpApi.js` `POST /asdair/command`** | Built and bound, **not mounted** by the live Cockpit | Link 1. The only production route to `submitConfirmation`. |
| **`asdair.previously_ordered`** (106 keys) | **ZERO readers** | Link 10. |

### Comments that claim wiring the code does not have

Quoted verbatim, as commissioned:

1. `services/asdair/pipeline/telegramAdapter.js:151`
   > `// The email itself arrives as a message and becomes submitConfirmation.`

   **False.** `runtime.js:145` makes it a `receiveList`, unconditionally.

2. `services/asdair/pipeline/runtime.js:390-391`
   > `* `report` is exactly what `reconcile/verifyBasket.js` returns. Nothing here`
   > `* recomputes a verdict…`

   **`verifyBasket` has no production caller.** The described producer never runs.

3. `services/asdair/outcome/README.md:126-128`
   > **"No `loadLastOrder`."**

   **Stale.** It exists (`data.js:505`) and is wired (`deps.js:254`). Documentation drift, non-blocking.

**For balance — a comment that is scrupulously honest**, and the model to follow:
`deps.js:311-313`, on the answer-learning writer: *"Both were complete, both were tested, and until
now NOTHING CALLED EITHER OF THEM."* The estate is capable of naming this defect accurately when it
chooses to.

---

## The prepared live acceptance sequence for Lane D

**Purpose:** prove the last quarter works *before* Warwick is standing at a checkout. Every step
names its observable event. **Steps marked 🚫-LARRY must occur with no Claude Code session in the
path** — per the standing rule at `pipeline-runtime/README.md:115-121`.

### Phase 0 — preconditions (before any live shop)

| # | Event | Observable | Who |
|---|---|---|---|
| 0.1 | `ensure-asdair-runtime.mjs --preflight` exits 0 | JSON `ok: true`, no BLOCKING | Larry (setup is legitimate) |
| 0.2 | Runtime armed and holding the lock | `--status` shows one live holder | Larry |
| 0.3 | **Answer open question F1**: does either `asdair.orders` row have `total_added IS NOT NULL` for household 1? | A live `SELECT` | **Requires DB access — I could not run it** |

**0.3 is a genuine gate.** If the answer is no, Link 6 is *already* dead in live data and Link 5
must be fixed before acceptance, not after.

### Phase 1 — reach `BASKET_READY` honestly

| # | Event | Observable |
|---|---|---|
| 1.1 | A shop exists at `BASKET_READY` | `asdair.shop.status = 'BASKET_READY'` |
| 1.2 | The `basket_ready` card is on Warwick's phone | A Telegram message, not a log line |

### Phase 2 — the human quarter 👤 **WARWICK ONLY**

| # | Event | Observable | Note |
|---|---|---|---|
| 2.1 | Warwick **books the delivery slot** | ASDA confirms in his own browser | 👤 Human only. No code path exists — verified. |
| 2.2 | Warwick **checks out and pays** | ASDA order placed | 👤 Human only. |
| 2.3 | Warwick **forwards the ASDA confirmation to ShopperBot** | The message arrives in the ShopperBot chat | 👤 Human act, machine consequence |

> ⚠️ **2.3 WILL CURRENTLY FAIL, AND FAIL DESTRUCTIVELY.** On today's code the forwarded email is
> consumed by `pollIntake` as a **new shopping list** (`runtime.js:145`). Expect a spurious shop,
> a spent vision/model call, and no confirmation recorded. **Link 1 must be fixed before this
> sequence is attempted live.** This is precisely the discovery Warwick asked to make *now*
> rather than at the checkout.

### Phase 3 — the machine quarter 🚫-LARRY

Every step below must be produced by the runtime loop with **no Claude Code session running**.
That is the acceptance bar from § "Nothing may live only in Larry's head": the **real production
event** must invoke it.

| # | Event | Observable evidence | Currently |
|---|---|---|---|
| 3.1 | A `submitConfirmation` command row is created by the **inbound path**, not by a CLI | `asdair.pipeline_command` row, `command = 'submitConfirmation'` | ⛔ no producer |
| 3.2 | The advancer records it | `asdair.order_confirmation` gains **its first row ever**; `shop.status → ORDER_CONFIRMATION_RECEIVED` | never run |
| 3.3 | Lines persist with outcomes and price bases | `order_confirmation_line` rows carrying all seven outcome values and a non-null `price_basis` on every row | never run |
| 3.4 | Re-forwarding the **same** email writes nothing | Second submit returns `created: false`, `lines_written: 0`; row count unchanged | idempotency untested live |
| 3.5 | The `confirmation_received` card reaches Warwick | Telegram message | wired |
| 3.6 | The advancer reconciles | `shop.status → RECONCILED` | wired |
| 3.7 | **A durable order outcome exists** | New `asdair.orders` row with `total_added IS NOT NULL` + `order_events` rows | ⛔ **no pipeline writer** |
| 3.8 | The reconciliation card carries **real numbers** | Telegram card showing seven finite counts — **not `unknown`** | ⛔ payload empty |
| 3.9 | Learning fires and is visible | `learning.applied > 0` reported, and a new `aka` on a regular | never run |

### Phase 4 — the week-after proof (the only proof that counts)

| # | Event | Observable |
|---|---|---|
| 4.1 | 🚫-LARRY. A **new** shop is created the following week | new `asdair.shop` row |
| 4.2 | `loadLastOrder` returns non-null for that household | the plan's rotation notes reference last week's actual variant |
| 4.3 | An alias learned in 3.9 resolves a line that previously failed | that line plans without a question |
| 4.4 | A question answered last week is **not re-asked** | question count strictly lower for the same input |

**4.2–4.4 are the acceptance test.** Everything before them proves capability; only these prove the
loop closed. **None of them can pass today**, because 3.7 has no writer.

---

## Recommendations (Warwick decides; I recommend)

1. **Fix Link 1 before any live checkout.** It is the earliest break and it fails destructively.
   Recommend the explicit-latch route (a button on the `basket_ready` card), not content-sniffing.
2. **Fix Link 5 in the same pass.** It is a call site, not a build — `buildOutcome` and
   `recordShopOutcome` are complete and DB-proven. Without it, Phase 4 can never pass.
3. **Fix Link 7's payload.** Cheapest of the three; the data is already computed and already stored.
4. **Run open question F1 (a live `SELECT`) before scheduling acceptance.** It changes whether
   Link 6 is starved-but-healthy or already broken.
5. **Park** the `outcome` CHECK-constraint gap and the three stale/false comments for the scheduled
   documentation reconciliation — with the exception of `telegramAdapter.js:151`, which should be
   corrected in whatever change fixes Link 1, because a fresh reader will otherwise re-derive the
   false belief.

---

## Methodology, confidence and limits

**Method.** Read-only static establishment across `services/asdair/**`. Wiring was established by
**enumeration of callers** (`Grep` across `services/**/*.{js,mjs}` for each symbol), never by
reading a comment and believing it — which is the specific failure this audit was commissioned to
find. Every "zero-caller" claim above is the result of an exhaustive symbol grep, and I state where
that grep was not exhaustive.

**Access limits — stated plainly.** I had **no Bash and no database access** in this session. Every
live-data claim is therefore **second-hand**, drawn from prior Pax deliverables that did have DB
access, and is cited to the line. The two load-bearing ones:

- `order_confirmation_line` = 0 rows ever — `2026-08-08-pax-supabase-household-knowledge-audit.md:96`
- `asdair.orders` = 2 rows — same document, `:31`

**Same-model honesty note (Pax contract §"Independent change QA").** Two corroborating sources here
are **my own prior deliverables**, produced by the same model in earlier sessions. That is
*corroboration of a live measurement I cannot repeat*, **not independent verification**. Treated as
Medium confidence and labelled at each use.

**Confidence by finding:**

| Finding | Confidence | Basis |
|---|---|---|
| No Telegram → `submitConfirmation` path (Link 1) | **High** | Direct code read of the only intake path (`runtime.js:116-146`) + exhaustive symbol grep |
| `recordShopOutcome` has no pipeline caller (Link 5) | **High** | Complete caller enumeration; every hit accounted for |
| Reconciliation card payload is empty (Link 7) | **High** | Both sides read directly (`runPipeline.js:1088` vs `renderMessages.js:704`) |
| `handoff/`, `markCorrected`, `verifyBasket` zero-caller | **High** | Exhaustive grep |
| `packet/` zero-caller | **Medium** | Grep-based; dynamic imports not exhaustively traced |
| 0 confirmation rows live / 2 `orders` rows | **Medium** | Single prior source, same model, not re-runnable here |
| `getStatus` handling of `view: 'exceptions'` | **Unestablished** | Not traced within ceiling |

**Out of scope / unresolved:**

- **Open question F1** (does either `orders` row have `total_added IS NOT NULL`) — needs a live query.
- Whether `shopStatus.getShopStatus` implements the `exceptions` view.
- Whether migration 006's `order_confirmation` schema matches `CONFIRMATION_COLUMNS` on the **live**
  database (`schemaCompat.test.js` skips loudly when the migration is absent from the branch —
  `reconcile/README.md:211-214`).
- I did not run any test suite; all "tested" claims are from reading test files, not executing them.

**Public-repo compliance:** no order contents, addresses, payment details, family names or household
identifiers appear above. Product examples are drawn only from already-committed public repo
documentation.
