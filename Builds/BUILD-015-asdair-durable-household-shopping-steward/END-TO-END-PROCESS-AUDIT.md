# BUILD-015 — END-TO-END PROCESS AUDIT

**Telegram photograph → checkout-ready basket handover, step by step.**

**Author:** Pax. **Date:** 2026-08-04.
**Commissioned by Warwick, verbatim:** *"where is my PAX deliverable and audit detailing the
process step by step from telegram submission to basket handover, confirming every step is in
place and automated so that I never have to come to you with this again."*

**Method:** the code was read, not the prose. Where a committed document and the source
disagree, this audit believes the source and says so. Nothing was executed.

---

## THE ANSWER, FIRST

> **Can Warwick send a photo next week and get a checkout-ready basket without contacting
> Larry?**
>
> # NO.

Not "nearly", not "with a nudge". The chain is broken in **seven** distinct places between the
question queue and the basket, and **three** of those places contain no code at all. The
sequence from a photograph arriving to a *plan* is largely real and largely automated. The
sequence from a plan to a *basket* does not exist as software.

**The chain breaks here, in order of where it stops:**

| # | Blocker | Severity | Evidence class |
|---|---|---|---|
| 1 | **Nothing sends a question card to Telegram.** `sendQuestionCard()` has **zero production callers** — only its own tests and a README example. No code path anywhere enqueues an outbox row of kind `question`. | **STOPS THE SHOP** | Read + enumerated |
| 2 | **A button answer cannot be captured.** The live wiring passes `resolveCandidate: () => null`, so every candidate tap is refused with `BAD_ANSWER_ARG`. A typed reply is refused too — `resolveQuestionByMessage: () => null`. | **STOPS THE SHOP** | Read |
| 3 | **The execution packet does not exist.** The JSON Schema is committed; the producer is not. No source file in the repository mentions it. | **STOPS THE SHOP** | Read + enumerated |
| 4 | **No basket writer.** The only code that can move a shop `SHOPPING → BASKET_READY` is `browser-runner/runner.js`, which the 2026-08-04 ruling made experimental, not the live default, and **prohibited from live-account testing**. The ruled-in writer (Sonnet in Claude for Chrome) has no handoff artefact, no adapter and no code. | **STOPS THE SHOP** | Read |
| 5 | **No basket-ready handback.** `renderBasketReady` exists; nothing ever enqueues kind `basket_ready`. | **STOPS THE SHOP** | Read + enumerated |
| 6 | **The rulebook is not consumed.** `actionableRules()` filters out every rule whose `directive` is `info` — which is rules 32, 36, 37 and 38, i.e. **every rotation and every multibuy rule in the system**. Rule matching is exact-string on `match_term`. `rule_qa_log` is **never read by the planner at all**. | **RE-ASKS ANSWERED QUESTIONS** | Read (root cause still needs execution) |
| 7 | **Answers do not survive the week.** `shop_question` is unique on `(shop_id, question_key)`. Next week is a new `shop_id`, so every question is a fresh question. `promoteDecision` — the one path that turns an answer into a standing rule — is deliberately not wired. | **RE-ASKS ANSWERED QUESTIONS** | Read |

Blockers 1–5 mean the shop **cannot reach a basket**. Blockers 6–7 mean that even if it
could, Warwick would answer the same questions he answered on 2026-07-06, 2026-07-21 and
2026-08-03.

Below, every step, with what actually does it.

---

## LIMITATIONS — read this before trusting any row

This audit was performed with `Read`, `Grep` and `Glob` only. **There is no `Bash` in this
grant, no database access, and no ability to run anything.** That constraint is exactly how a
previous pass on this build got a data-loss defect wrong (D-2026-07-28-21, retracted), so it
is stated up front rather than buried.

Concretely:

1. **Nothing here was executed.** Every "Evidence" cell says whether the claim is from reading
   a source file, from enumerating call sites across the repository, or from another document.
   **No claim in this audit is backed by a run.**
2. **The live database was not queried.** Whether `asdair.rules` currently holds the rows
   quoted in WO-Y, whether migrations 010–012 are applied, whether `regulars.source`
   distinguishes Favourites from Regulars — all **NOT VERIFIED** here. Where this audit repeats
   a fact about live data it names the document it came from.
3. **The machine state was not inspected.** Whether `MyPKA-AsdAIr-Runtime` is enabled, armed
   and running; whether `pg` resolves in each service folder; whether `asdair.env` carries
   `FUSION_GATEWAY_URL`, `FUSION_MODEL_VISION` and `ASDAIR_MEDIA_ROOT` — all **NOT VERIFIED**.
   Each of those was a real failure on 2026-08-03.
4. **Test suites were not run.** A test file's existence is evidence that a behaviour was
   specified. It is not evidence that it passes today, and it is never evidence that anything
   *calls* the module under test — which is this build's single most-repeated defect class
   (D-2026-07-27-08, D-2026-07-28-05, and blocker 1 above).
5. **"NO CODE" means: enumerated across the repository and not found.** It does not mean
   "I did not find it". Where the search was narrower than that, the row says NOT VERIFIED.

---

## STEP-BY-STEP

### Legend

- **AUTOMATED** — code runs it with no human in the loop beyond the gates Warwick deliberately owns.
- **GATED** — automated, but deliberately waiting on a Warwick tap. This is by design, not a defect.
- **MANUAL** — a human (in practice, Larry) performs it by hand.
- **ABSENT** — no code exists.

---

### Step 0 — The runtime is up and polling

| Field | Finding |
|---|---|
| **Supposed to happen** | `MyPKA-AsdAIr-Runtime` runs `pipeline/runtime.js --watch`, polls ShopperBot every 60s, survives reboot. |
| **What code does it** | `services/asdair/pipeline-runtime/ensure-asdair-runtime.mjs` (lock + arm gate); `services/asdair/pipeline/runtime.js` `runWatch()` / `main()`. |
| **Automated?** | **NOT VERIFIED.** The code exists and is structured to run unattended. Whether it is *enabled, armed and running* cannot be checked from here. |
| **Evidence** | Read `runtime.js:313-342, 392-424`. `ACTIVATION-DEFERRED.md` item 3 records the task as registered **Disabled** and **not armed** at merge; item 4 records reboot recovery as **NOT PROVEN** — no reboot was ever performed. |
| **Known defects** | D-2026-07-28-24 (shipped disabled/unarmed), D-2026-07-28-25 (reboot unproven), D-2026-08-03-19 (stalls silently while reporting `running: true`), D-2026-08-03-01 (`pg` unresolvable per folder). |
| **Unattended next week?** | **UNKNOWN.** If the task is not armed, nothing happens at all and there is no signal. If it is armed, D-2026-08-03-19 says it can stall for an hour while reporting healthy. |

---

### Step 1 — Photo arrives on ShopperBot

| Field | Finding |
|---|---|
| **Supposed to happen** | One poller fetches the photo, checks the sender allowlist, downloads the image to disk. |
| **What code does it** | `services/asdair/intake/shopperIntake.js` — `runIntake()`, `createShopperTelegramClient()`, `createFileMediaStore()`. Wired in `pipeline/runtime.js` `realWiring()` (lines 357-390) and driven by `pollIntake()` (lines 86-148). Single-poller enforcement: `pipeline-runtime/runtime-lock.mjs`; `bot/noPolling.test.js` fails the build if a poll method appears in the control-surface folder. |
| **Automated?** | **AUTOMATED.** |
| **Evidence** | Read `shopperIntake.js` (offset/allowlist/media), `runtime.js:63-76, 86-148`. Not executed. |
| **Known defects** | D-2026-07-17-01 (router kills long polls at ~45s — mitigated by a 25s cap), D-2026-07-28-37 (env-var name mismatch — fixed with an alias), D-2026-07-28-23 (Telegram's 24h retention ate a real list once). |
| **Unattended next week?** | **YES**, conditional on Step 0. |

---

### Step 2 — A durable shop row is created BEFORE the Telegram ack

| Field | Finding |
|---|---|
| **Supposed to happen** | The shop is persisted before the offset advances, so a crash cannot silently delete Mum's list. |
| **What code does it** | `pipeline/runtime.js` `pollIntake()` → the `persist()` closure (lines 107-130) → `commands.receiveList()`. The ordering is enforced inside `intake/shopperIntake.js` at lines 679-697: `await onRecord(record)` **then** `state.write(...)`; a throw holds the offset and stops the batch. |
| **Automated?** | **AUTOMATED.** |
| **Evidence** | **Read the source directly, not the ledger.** `shopperIntake.js:663-697` carries the comment block "THE ORDERING THAT MATTERS" and the awaited `onRecord` above `state.write`. This is the one place I deliberately re-verified from code, because the ledger got this exact entry wrong once and retracted it. |
| **Known defects** | D-2026-07-28-21 — **FIXED**, and the retraction stands: the fix is real in the source. Residual D-2026-08-03-21: a proof file's heading still describes the defect in the present tense above an assertion that proves the opposite. |
| **Unattended next week?** | **YES.** This is the single strongest link in the chain. |

---

### Step 3 — Receipt card ("Build this shop")

| Field | Finding |
|---|---|
| **Supposed to happen** | Warwick gets a card confirming the list landed, with a button to start. |
| **What code does it** | `pipeline/runPipeline.js:606-614` — a self-healing side effect on any shop found at `RECEIVED` with no prior `receipt` in the outbox history. Rendered by `bot/renderMessages.js` `renderReceipt()`. Sent by `runtime.js` `drainOutbox()` (lines 229-258). |
| **Automated?** | **AUTOMATED.** |
| **Evidence** | Read. The `outboxEverQueued` guard reads full history, so it recovers shops that predate the fix. Not executed. |
| **Known defects** | D-2026-08-03-08 (the card was never sent for any shop, ever — **FIXED**, verified live at 16:11:52 on 2026-08-03 per the ledger). |
| **Unattended next week?** | **YES.** |

---

### Step 4 — The build gate (Warwick taps "Build this shop")

| Field | Finding |
|---|---|
| **Supposed to happen** | The tap becomes a durable command; nothing spends a model call before he says go. |
| **What code does it** | `bot/inboundRouter.js` `routeAsdairUpdate()` → `pipeline/telegramAdapter.js` `intentToCommand()` case `'build'` (lines 63-66) → `commands.buildShop()` → `stages.js` `decideNextStep()` `RECEIVED` branch (lines 216-231). Taps are captured by `createCapturingTelegram()` on the *same* fetch as intake — one poller, two consumers. |
| **Automated?** | **GATED — by design.** This gate is Warwick's and should stay. |
| **Evidence** | Read `telegramAdapter.js:52-151`, `runtime.js:156-197`, `stages.js:216-231`. Not executed. |
| **Known defects** | D-2026-08-03-10 — **OPEN.** `routeTaps` dispatches the durable command *first* and acks the Telegram callback afterwards; by then the callback id has expired, so **every tap looks like it failed** even though it worked. Warwick pressed "Build this shop" twice on 2026-08-03 because of this. D-2026-08-03-09 — **OPEN**: the progress card fires once per *shop*, not per attempt, so retries are silent. |
| **Unattended next week?** | **YES functionally, NO experientially.** The command lands; the phone says it did not. |

---

### Step 5 — The household catalogue is loaded BEFORE interpretation

| Field | Finding |
|---|---|
| **Supposed to happen** | Every regular, alias, brand, ASDA reference and typical quantity is loaded before any model sees the image. A model call without a catalogue is forbidden. |
| **What code does it** | `interpret/loadCatalogue.js` via `pipeline/deps.js` `realLoadCatalogue()` (lines 131-144). Enforced by `runPipeline.assertCatalogueLoaded()` (lines 89-101), which **throws** on a missing or empty catalogue. Called first in `stepInterpret()` (lines 154-157) and again in `stepPlan()` and `stepRecordConfirmation()`. |
| **Automated?** | **AUTOMATED**, and it is the best-defended invariant in the build. |
| **Evidence** | Read `runPipeline.js:89-101, 154-157`; `deps.js:131-144`. `interpret/catalogueGrounding.test.js` asserts the call *order*. Not executed. |
| **Known defects** | D-2026-08-03-06 (bigint-as-string broke every matched line — **FIXED**, with a regression test that returns ids as strings the way Postgres actually does). D-2026-08-03-13 — **OPEN**: a latent second instance of the same class survives at `pipeline/shopLines.js:218-224`, currently unreachable. **A — Favourites as a distinct source view: NOT VERIFIED**, exactly as the canonical process says. |
| **Unattended next week?** | **YES**, provided `ASDAIR_DB_URL` and the grants are in place — both **NOT VERIFIED** here. |

---

### Step 6 — Catalogue-constrained vision interpretation

| Field | Finding |
|---|---|
| **Supposed to happen** | One grounded vision request through the Fusion gateway, carrying the photo plus the catalogue. The model returns a reading per line and **may never invent a product name**. Fail closed if the gateway or model is unavailable. |
| **What code does it** | `pipeline/deps.js` `realInterpretPhoto()` (lines 157-183) → `services/obsidiwikai/src/core/models.mjs` `vision()`. Prompt from `interpret/groundedPrompt.js` `buildGroundedPrompt()`. One strict-JSON retry, then a throw. |
| **Automated?** | **AUTOMATED.** |
| **Evidence** | Read. Not executed — and this step in particular has burned this build before. |
| **Known defects** | D-2026-08-03-04 (no gateway configured; every photo failed — fixed live, **preflight gap OPEN**). D-2026-08-03-05 (`fusion.vision` alias does not exist on the gateway — fixed live by pinning `FUSION_MODEL_VISION`, **preflight still does not validate the model name against `/v1/models`**). D-2026-07-28-11 (ungrounded transcription invented products — fixed by grounding). **§B "sanitized evidence of what was supplied to the model": NO CODE.** **§B "exactly one interpretation entry point": NOT MET** — `interpret/interpret-list.js` is a second, CLI entry point, and its `--dry-run` skips the model call entirely, which is precisely what produced a false green on 2026-08-03. |
| **Unattended next week?** | **UNKNOWN.** The code path is right. Both 2026-08-03 failures here were *configuration*, and no preflight check for either was ever built. It will work if `asdair.env` still carries the two variables — **NOT VERIFIED**. |

---

### Step 7 — Identity resolution (the catalogue decides, not the model)

| Field | Finding |
|---|---|
| **Supposed to happen** | Canonical identity is looked up from our own rows by id. A product that does not exist cannot reach a basket. |
| **What code does it** | `interpret/resolveByCatalogue.js` `resolveAll()`, called at `runPipeline.js:192-200`; canonical names re-attached from `asdair.regulars` by id in `pipeline/shopLines.js` `withCanonicalNames()`. `runPipeline.buildGroundedIntents()` (lines 274-312) uses `canonical_name`, never a model-written name; an unresolved line becomes `needs_decision` carrying the honest raw reading. |
| **Automated?** | **AUTOMATED.** |
| **Evidence** | Read `runPipeline.js:188-232, 274-312`. Not executed. |
| **Known defects** | D-2026-08-03-13 (latent bigint class, unreachable today). D-2026-07-28-42 (a `product_alternatives` primary key mistaken for a `regulars` id — **FIXED**, and `planCandidates()` now makes every candidate declare its `source`). |
| **Unattended next week?** | **YES.** |

---

### Step 8 — Alias and rule matching

**This is the step that cost Warwick his evening on 2026-08-03, and the code confirms why.**

| Field | Finding |
|---|---|
| **Supposed to happen** | A known product must never become a question over word order or a one-letter typo. Previous decisions and standing rules must be consulted **before** any question is generated. |
| **What code does it** | Aliases: `skill/planner.js` `regularHits()` (lines 306-315) — `regularAliases(r).indexOf(term) !== -1`. **Exact string equality after lowercase/trim/whitespace-collapse only** (`normaliseTerm`, lines 43-46). Rules: `actionableRules()` (lines 837-844) and `ruleAppliesToItem()` (lines 812-835). |
| **Automated?** | **AUTOMATED, AND WRONG IN THREE SPECIFIC WAYS.** |
| **Evidence** | **Read the source.** Three findings, each quoted from the code: |

**(a) Every `info` rule is discarded before matching.**

```js
// planner.js:837-844
function actionableRules(rules) {
  return (Array.isArray(rules) ? rules : []).filter(function (r) {
    return r && r.active !== false && r.directive && r.directive !== 'info' && hasTarget(r);
  });
}
```

WO-Y and D-2026-08-04-03 record rules **32 (rotate Sure), 36 (the multibuy offer rule), 37
(Sure pair rounding) and 38 (out-of-stock)** as all carrying `directive = 'info'`. *(Those
directive values are from the WO-Y evidence table, verified live on 2026-08-04 by someone
else — **not verified by me**; I have no database access.)* If that is still true,
**every rotation rule and every multibuy rule in this system is inert by construction.**
This is WO-Y's leading hypothesis, and the source is consistent with it.

**(b) A rule with no `match_term` and no `match_category` never matches anything.**

```js
// planner.js:808-810
function hasTarget(rule) {
  return normaliseTerm(rule.match_term) !== '' || normaliseTerm(rule.match_category) !== '';
}
```

WO-Y records rules 36 and 38 as having `match_term = NULL`. They are therefore doubly
excluded — once as `info`, once as target-less. The exclusion is *deliberate and correct*
(a target-less `exclude` would empty the basket), but its consequence is that a genuinely
global rule has **no way to be expressed at all**.

**(c) Rule matching is exact-string, same as alias matching.**

```js
// planner.js:824
if (rule.match_term) return normaliseTerm(rule.match_term) === term;
```

So a photographed *"bottle Azera coffee"* does not match a `match_term` of *"nescafe"*.
Two independent exact-string gates — aliases and rules — sit between Warwick's recorded
decisions and the question queue.

**(d) `rule_qa_log` is never read by the planner.** Enumerated across `services/`: the only
non-test readers are `outcome/promoteDecision.js` (a *writer*) and
`cockpit-api/readRules.js` (a *display* reader). `deps.js` `realLoadPlanningInputs()`
(lines 230-240) loads `rules, products, regulars, budget, lastOrder` — **and nothing else**.
The Ariel Pods answer (*"best value/wash"*, recorded 2026-07-21) is structurally unreachable
by the planner.

**(e) Rotation is inert even where the rule is actionable.** `stepPlan()`
(`runPipeline.js:335-343`) calls `planBasket({ listItems, rules, products, regulars, budget,
lastOrder, household })`. It does **not** pass `rotation`. `planner.js:922` reads
`const rotations = Array.isArray(args.rotation) ? args.rotation : [];` and the rotation
block at line 1013 is gated on `rotations.length > 0`. `skill/README.md:193` says it plainly:
*"**What is NOT here:** a database carrier for the rotation instruction."* The rotation
mechanism is built, tested and **structurally unreachable from the live pipeline**.

| Field | Finding |
|---|---|
| **Known defects** | D-2026-08-03-15, D-2026-07-28-10 (exact-string aliases — measured 52% resolution, **OPEN since 2026-07-28**), D-2026-08-04-04 / WO-Y (rules not consumed — **OPEN, HIGH**), D-2026-07-28-07 (rotation dead — *partially superseded*: see correction below), D-2026-07-28-35 (rule 7 budget band structurally inoperative — no price column exists anywhere). |
| **Unattended next week?** | **NO.** Known products will become questions again. |

> **CORRECTION TO THE LEDGER, from source.** D-2026-07-28-07 says there is no `loadLastOrder`
> and flags as a **CONTRADICTION** whether the `build-015/load-last-order` branch ever reached
> `main`. **It did.** `skill/data.js` exports `loadLastOrder` (line 506) and `deps.js:237` calls
> it inside `realLoadPlanningInputs`. The *last order* is loaded. What is missing is the
> **rotation instruction** that would make it do anything. That is a materially different
> defect from the one recorded, and the ledger should be amended rather than left to mislead
> the next instance.

---

### Step 9 — Question generation

| Field | Finding |
|---|---|
| **Supposed to happen** | Only genuinely new products become questions. Everything else resolves. |
| **What code does it** | `runPipeline.js` `stepPlan()` (lines 324-384): every plan line with `status === 'needs_decision'` becomes a `deps.shopStore.openQuestion({ shop_id, question_key, ... })`. Key from `keys.js` `questionKeyFor()` (normalised line text). Candidates from `planCandidates()` (lines 409-428). |
| **Automated?** | **AUTOMATED** — it reliably generates questions. Too many of them, for the reasons in Step 8. |
| **Evidence** | Read. Not executed. |
| **Known defects** | The upstream ones. Plus **D-2026-07-28-38 — `promoteDecision` is deliberately not wired**, and the idempotency key is `(shop_id, question_key)`: `db/006_shop_control_surface.sql:107` — `create unique index ... shop_question_key_uniq on asdair.shop_question (shop_id, question_key)`. **An answer is remembered for the current shop only.** Next week is a new `shop_id`, therefore a new question, therefore the same question. |
| **Unattended next week?** | **NO.** Even a perfectly answered question this week is asked again next week. This is not a bug in the index — it is the missing promotion path, recorded as deliberate at D-2026-07-28-38 and never revisited. |

---

### Step 10 — Batching the questions to Telegram

**This is the first place where there is no code at all.**

| Field | Finding |
|---|---|
| **Supposed to happen** | Collect every genuinely new item and ask **once, in one batch**, as cards Warwick can tap. |
| **What code does it** | **NO CODE.** `bot/questionRender.js` `sendQuestionCard()` / `prepareQuestionCard()` / `persistQuestionRender()` are complete, tested, and have **zero production callers**. |
| **Automated?** | **ABSENT.** |
| **Evidence** | **Enumerated across the whole repository** (excluding `node_modules`) for `sendQuestionCard` and `questionRender`: every hit is inside `bot/questionRender.js` itself, its two test files, `bot/README.md`'s usage example, or one line of `DEFECT-LEDGER.md`. Separately enumerated every `kind: '...'` passed to `store.enqueueMessage` across `services/`: the complete set is **`receipt`, `progress`, `failure`, `plan_ready`, `confirmation_received`, `reconciliation_summary`**. `bot/renderMessages.js:444-454` registers a `question` renderer in `MESSAGES`; **nothing ever enqueues that kind.** |
| **Known defects** | **NOT IN THE LEDGER.** This is a new finding of this audit. It is the same class as D-2026-07-27-08 (`shopperRoute` had zero callers), D-2026-07-28-05 (the outcome writers had no runtime caller) and D-2026-07-27-02 — *"a green module suite cannot detect an absent caller"* — recurring for the **fourth** time in this build, in the component the build's own README calls the question loop. |
| **Unattended next week?** | **NO.** The shop parks at `NEEDS_DECISION` / `wait:answers` and Warwick is never asked anything. On 2026-08-03 the eleven questions reached him because **Larry sent them by hand**. |

---

### Step 11 — Answer capture

| Field | Finding |
|---|---|
| **Supposed to happen** | A tap or a typed reply becomes a durable answer; first answer wins; a stale card is refused, never guessed at. |
| **What code does it** | `telegramAdapter.js` `intentToCommand()` case `'answer'` (lines 103-135) → `commands.answerQuestion()` (lines 282-305) → `shopStore.answerQuestion()` (compare-and-set on `status = 'open'`). Stale-card protection in `bot/resolveTap.js`. |
| **Automated?** | **ABSENT IN THE LIVE WIRING.** The mechanism is built; the wiring hands it two null stubs. |
| **Evidence** | Read `runtime.js:383-388`, verbatim: <br>`// Correlation lookups belong to whoever owns the question state. Until the`<br>`// card message_ids are persisted against their question keys, a typed`<br>`// reply is refused rather than attached to a guess.`<br>`resolveQuestionByMessage: () => null,`<br>`resolveCandidate: () => null,`<br><br>`telegramAdapter.js:122-129` then refuses **every** button answer: *"the index travels, not the product id — so an index the caller can no longer resolve is refused rather than answered with a number."* |
| **Known defects** | **NOT IN THE LEDGER as a defect** — it is recorded in the source as a deliberate, honest refusal, which is the right engineering call and still leaves the product unable to accept an answer. Compounded by D-2026-08-03-10: even a successful command acks too late and reads as failure. |
| **Unattended next week?** | **NO.** Only `skip` ("leave it this week") is routable, because it carries a bare question key and needs no candidate resolution. Warwick can decline items; he cannot choose one. |

---

### Step 12 — Replan once every question is settled

| Field | Finding |
|---|---|
| **Supposed to happen** | When no question is open, re-run the planner with the answers in place, so an answer actually changes the basket. |
| **What code does it** | `stages.js:239-250` — `NEEDS_DECISION` with `openQuestions === 0` returns `STEPS.REPLAN`; `runPipeline.js` `dispatchStep()` case `REPLAN` transitions back to `PROCESSING`, and `stepPlan` runs again. `openQuestion` is idempotent, so an answered question is not re-opened. |
| **Automated?** | **AUTOMATED.** |
| **Evidence** | Read. Not executed. |
| **Known defects** | None specific. Unreachable in practice because Steps 10–11 never deliver an answer. |
| **Unattended next week?** | **YES in isolation. NO in the chain** — nothing gets it to zero open questions. |

---

### Step 13 — The Sonnet Browser execution packet

| Field | Finding |
|---|---|
| **Supposed to happen** | One durable packet per shop: brand A–Z then product A–Z, one line per item with source view, ASDA reference, quantity, known-or-new, approved search term, plus expected distinct-product and total-unit counts. Stored in Postgres, exposed as JSON, as a checklist, in the Cockpit, and to the Sonnet handoff. **No Claude session builds it by hand.** |
| **What code does it** | **NO CODE.** |
| **Automated?** | **ABSENT.** |
| **Evidence** | The schema **does** exist — `Builds/BUILD-015-.../SONNET-BROWSER-EXECUTION-PACKET.schema.json`, and its own `description` says so: *"STATUS: schema only. The producer does not exist yet - WO-P."* Enumerated the repository for `SONNET-BROWSER-EXECUTION-PACKET`, `execution packet`, `executionPacket`, `execution_packet`: **four hits, all Markdown** (SOP-021 and three BUILD-015 documents). **Zero source files.** |
| **Known defects** | WO-P (issued, not started). D-2026-08-03-12 is its ancestor: `step_id` appears in exactly nine files, **all inside `browser-runner/`** — independently re-enumerated by me and confirmed. Every plan file on 2026-08-03 was hand-assembled. |
| **Unattended next week?** | **NO.** |

---

### Step 14 — Building the basket

| Field | Finding |
|---|---|
| **Supposed to happen** | Sonnet in Claude for Chrome opens Regulars/Favourites, sets ASDA ordering to Brand A–Z, follows the packet in that order, adds known products through Regulars/Favourites, never free-searches a known item, free-searches only approved new items, favourites them, captures their ASDA identity, and stops checkout-ready. |
| **What code does it** | **NO CODE for the ruled-in route.** The only implementation is `services/asdair/browser-runner/runner.js` (the CDP runner), which `RUNTIME-DECISION.md` makes *experimental, not the live default, and prohibited from further live-account testing without fresh authority from Warwick*. |
| **Automated?** | **ABSENT** (ruled route) / **PROHIBITED** (built route). |
| **Evidence** | Read `RUNTIME-DECISION.md` and `runner.js`. Grepped `BASKET_READY` across `services/`: the **only** code that writes the `SHOPPING → BASKET_READY` transition is `browser-runner/runner.js:397`. Nothing else in the estate can move a shop to `BASKET_READY`. |
| **Known defects** | D-2026-08-03-12 (no plan builder), D-2026-08-03-17 (SOP-021's "bulk add" was never runner code; the real runner costs ~13s/item happy path, 25–30s on fallback — 10–20 minutes for a 40-line shop). **Open consideration, stated honestly in the ruling:** the CDP runner blocks substitution in three independent code layers; **Sonnet in Chrome has no mechanical enforcement at all** — the boundary there is instruction and supervision. |
| **Unattended next week?** | **NO.** And note the ruling's own open consideration 2: even when built, Sonnet in Claude for Chrome is *not* a headless unattended runtime. It removes the need for *Larry*; it does not remove the need for *a browser session someone starts*. Whether that satisfies "fully automated" is Warwick's call and is not asserted here. |

---

### Step 15 — Reconciliation against expected counts

| Field | Finding |
|---|---|
| **Supposed to happen** | Compare expected **distinct products** and expected **total units** against the real basket; reconcile each identity and quantity; identify unavailable items **without substituting**; identify anything omitted or unexpected; confirm no checkout, payment or slot action occurred. |
| **What code does it** | **PARTIAL, and against the wrong artefact.** `services/asdair/reconcile/reconcile.js` is a complete, pure, seven-outcome reconciler — but it compares the **forwarded ASDA order confirmation** against the **recomputed plan**, i.e. it runs *after Warwick has already checked out*. There is **NO CODE** that compares the **basket** against **expected counts** before handover, because the expected counts live only in the packet from Step 13, which does not exist. |
| **Automated?** | **ABSENT** for the pre-handover check. **AUTOMATED** for the post-checkout check. |
| **Evidence** | Read `reconcile/reconcile.js:1-60` (its own header: *"takes the parsed ASDA order confirmation and the STORED PLAN"*). `CANONICAL-WEEKLY-SHOP-PROCESS.md` grades §G **PARTIAL** for exactly this reason and is correct. |
| **Known defects** | WO-S (issued, not started). D-2026-08-03-20 — **ACCEPTED-RESIDUAL**: the runner is hard-blocked from touching substitution controls, so **every basket needs a human substitution pass before purchase**. D-2026-08-03-23 — **OPEN and unverified**: nobody has checked whether ASDA re-enables "allow substitutions" after a later add. |
| **Unattended next week?** | **NO.** |

---

### Step 16 — The basket-ready handback

| Field | Finding |
|---|---|
| **Supposed to happen** | Only after reconciliation passes, send: *«Basket ready for Warwick to review and order.»* |
| **What code does it** | **NO CODE.** `bot/renderMessages.js` `renderBasketReady()` exists and is registered in `MESSAGES` as `basket_ready` (line 449). Nothing anywhere enqueues that kind. |
| **Automated?** | **ABSENT.** |
| **Evidence** | Enumerated every `kind: '...'` argument to `store.enqueueMessage` across `services/`. `basket_ready` and `question` are the two registered renderers with **no producer**. `runPipeline.messageForTransition()` (lines 835-872) switches on `result.to` and has **no `BASKET_READY` case**. |
| **Known defects** | **NOT IN THE LEDGER.** New finding. Fifth instance of the absent-caller class in this build. |
| **Unattended next week?** | **NO.** Warwick would not be told the basket was ready even if one existed. |

---

### Step 17 — Outcome recording (the forwarded ASDA confirmation)

| Field | Finding |
|---|---|
| **Supposed to happen** | Warwick checks out himself, forwards the ASDA confirmation email; it is parsed, reconciled against the plan and persisted. |
| **What code does it** | `runPipeline.js` `stepRecordConfirmation()` (lines 505-545) → `reconcile/record-confirmation.js` `buildPayload()` → `reconcile/recordConfirmation.js` `recordConfirmation()`, idempotent on `(shop_id, content_fingerprint)`. Then `stepReconcile()` (lines 556-569) transitions to `RECONCILED`. |
| **Automated?** | **AUTOMATED**, given Step 16 and a forwarded email. |
| **Evidence** | Read. Not executed. Note that the plan is **recomputed** here rather than read from a plan table — honest, because `planBasket` is pure and deterministic, but it means a plan recomputed against a *changed* rulebook would differ from the plan actually shopped. Not flagged anywhere; low severity today, real if rules change mid-week. |
| **Known defects** | D-2026-07-27-02 (a real shop once wrote nothing at all — **FIXED**), D-2026-07-28-05 (writers had no runtime caller — **FIXED**). |
| **Unattended next week?** | **YES in isolation**, unreachable in the chain. |

---

### Step 18 — New-item write-back (closing the learning loop)

| Field | Finding |
|---|---|
| **Supposed to happen** | For every genuinely new product: persist ASDA reference and URL, canonical name and brand, **the photographed wording as an alias**, the approved search wording, Regulars-or-Favourites, confirm the ASDA Favourite action, and make it next week's catalogue input. For every answer: a durable decision event, `rule_qa_log`, rule promotion, aliases, and **prevent the same question next week**. |
| **What code does it** | **PARTIAL.** `pipeline/deps.js` `realRecordLearning()` (lines 260-286) is the only automatic writer. It reads `asdair.order_confirmation_line` for lines that **already carry a `matched_regular_id`** and calls `outcome/updateRegulars.js` with `op: 'enrichRegular', add_aka: [product_name]`. That is **alias enrichment on already-known items and nothing else**. |
| **Automated?** | **PARTIAL — and it cannot learn a new item at all.** By construction a genuinely new product has no `matched_regular_id`, so it is filtered out by the query's own `AND matched_regular_id IS NOT NULL`. `updateRegulars` *does* support `upsertRegular` (line 211) — nothing calls it automatically. |
| **Evidence** | Read `deps.js:260-286` including the SQL; read `outcome/updateRegulars.js` op list. `deps.js:252-258` states plainly that `promoteDecision` is **deliberately not wired**: *"Turning an answer into a STANDING RULE that changes every future basket forever… needs the provenance… Guessing it would be exactly the ambiguous-inference failure promoteDecision's own provenance guard exists to stop."* |
| **Known defects** | WO-T (issued, not started). D-2026-07-28-38 (promotion not wired — by design). D-2026-07-27-02's remaining risk materialised: **six new regulars were written by hand on 2026-08-03**, a week after the same class was "fixed". |
| **Unattended next week?** | **NO.** New items learned this week do not become next week's catalogue without a human running `update-regulars.js`. |

---

### Step 19 — Next week's catalogue

| Field | Finding |
|---|---|
| **Supposed to happen** | Everything learned this week is an interpretation input next week. |
| **What code does it** | `interpret/loadCatalogue.js` reads `asdair.regulars` live, so anything durably written **is** next week's input. The read arc is sound. |
| **Automated?** | **AUTOMATED for the read. Broken at the write** (Step 18). |
| **Evidence** | Read. `interpret/README.md` states the coupling: *"These are two arcs of one cycle. Break the write-back arc and next week's read arc degrades against a stale catalogue."* |
| **Known defects** | The Step 18 ones. Plus **D-2026-08-04-02 — OPEN**: migration `011_decisions_log_rule_notes_seed.sql` is still unapplied because it needs the admin path. *(Per the D-2026-08-04-03 retraction, this is a completeness back-fill of the optional `note` column and is **not** the cause of any 2026-08-03 question. `rule_text` already carries the decisions. **Not verified by me** — I cannot query the database.)* |
| **Unattended next week?** | **YES for the read; the write it depends on is NO.** |

---

## THREE DOCUMENT-VERSUS-CODE CONTRADICTIONS FOUND

Recorded because tonight's pattern is documentation outliving the code it describes, and
because a fresh instance reading these documents would be misled.

1. **`WORK-ORDERS-REALIGNMENT-ADDENDUM.md` WO-W's table is stale.** It lists SOP-021 and
   SOP-021a as **NOT AMENDED**. Both **have** been amended — SOP-021 carries the Sonnet ruling
   at lines 9-15, 179-206, 388-433, and SOP-021a at lines 11-16. The table's other rows appear
   correct.
2. **`Team/Asdair - Household Shopping Steward/AGENTS.md` genuinely has not been amended**, and
   it now actively contradicts the ruling: lines 90-97 instruct the specialist that *"when
   Asdair has Bash and a genuine, authorised Work Order to build a basket, **Asdair runs
   `runner.js` itself** — this is responsibility 5 done for real"*. `runner.js` is the CDP
   runner the ruling **prohibits from further live-account testing**. A dispatched Asdair
   following its own contract would do the prohibited thing.
3. **`DEFECT-LEDGER.md` D-2026-07-28-07 is wrong about `loadLastOrder`.** It exists and is
   wired (`skill/data.js:506`, `deps.js:237`). The real defect is the missing rotation
   instruction carrier, which is a different thing.

---

## THE SHORTEST PATH TO "YES"

Ordered by how much each unblocks. This is not a schedule and not a design — it is the
minimum set, and nothing new is proposed beyond what the 2026-08-04 ruling already commissioned.

1. **Wire the question card into the outbox, and wire the answer back.**
   One producer that enqueues `kind: 'question'` per open `shop_question`, calling the
   already-built `sendQuestionCard()`; and a real `resolveCandidate` / `resolveQuestionByMessage`
   backed by the `rendered_candidates` contract migration 009 already persists.
   **Unblocks blockers 1 and 2 — nothing downstream can run until this does.** Both halves
   already exist as tested modules; what is missing is the caller. Small.

2. **WO-Y — find out why the rulebook is not consumed, by execution.**
   The source says `info` rules are filtered out, target-less rules never match, matching is
   exact-string, and `rule_qa_log` is never read. **Reading the code is not the same as running
   it**, and WO-Y is explicit that the root cause must be established by execution — run the
   planner against the real 2026-08-03 inputs and observe which rules are consulted. If the
   `info` filter is confirmed, the fix may be very small, and it removes the largest single
   source of needless questions.

3. **WO-P — build the execution packet producer.** The schema is already written and the sort
   contract is already specified. **This unblocks blockers 3, and is a hard prerequisite for
   both 4 and 5** (reconciliation needs the expected counts; the handback needs something to
   hand back).

4. **Build the Sonnet handoff and the basket-ready handback together.**
   Whatever hands the packet to Sonnet must also be what records the result and enqueues
   `kind: 'basket_ready'`. Splitting them re-creates blocker 5. Include a decision on the
   `SHOPPING → BASKET_READY` writer, since today only the deferred CDP runner can write it.

5. **WO-Q — order- and spelling-tolerant matching.** After (2), this is the remaining cause of
   known products becoming questions. Deliberately *below* WO-Y: if rules are inert, fuzzy
   matching fixes the symptom while the rulebook stays unread.

6. **Give an answer a life longer than one week.** Either wire `promoteDecision` with the
   provenance it requires, or make question suppression consult prior answers across shops.
   Without this, every fix above still asks him the same question next Sunday.

7. **Then, and only then, close the operational items:** preflight the gateway URL, the model
   name against `/v1/models`, and `ASDAIR_MEDIA_ROOT` (WO-B); arm and reboot-prove the runtime
   (D-2026-07-28-24/25); fix the callback ack so a tap does not look broken (D-2026-08-03-10);
   amend Asdair's contract (WO-W).

**Items 1–4 are the difference between NO and YES.** Items 5–7 are the difference between
YES and *pleasant*.

---

## WHAT THIS AUDIT DOES NOT SAY

- It does not say the build is bad work. The state machine, the acknowledgement boundary, the
  idempotency keys, the render contract, the grant scoping and the catalogue-grounding
  invariant are careful, well-reasoned engineering, and several of them are provably correct
  in the source.
- It does not say any of the ABSENT steps are hard. Three of the five blockers are wiring a
  caller to a module that already exists and already has tests.
- It does not say the 2026-08-03 basket was a failure. A real 35-product, £136.94 basket was
  built. It was built by hand, through hand-assembled plan files, over eight hours — which is
  the finding, not the basket.

**Nothing in this file should be read as a claim that any step was verified by execution.
It was not. No step was run.**
