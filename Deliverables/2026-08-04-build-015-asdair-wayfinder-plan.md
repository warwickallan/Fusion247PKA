# BUILD-015 AsdAIr — Wayfinder plan

> ## ⭐ RECONCILED 2026-08-08 — BUILD-020 Sub-phase 4E (`BUILD-015-PREJUMP-WAYFINDER-HANDOVER`)
>
> **This map was reconciled against current repository, runtime and evidence truth on 2026-08-08,
> under Warwick's 4E commission** — canonical text: Google Doc "Asdair Brief" (Drive root); repo
> mirror: [[Deliverables/2026-08-08-build-015-prejump-wayfinder-handover-SOURCE]]. What happened
> between this map's writing (2026-08-04) and the reconciliation, in one paragraph:
>
> Branch `build-015/live-acceptance-recovery-2026-08-03` — the branch every head in the original
> §2 referred to — **was merged into canonical `main` and no longer exists** (its content reached
> `main` through the BUILD-020 Sub-phase 4C estate reconciliation, PR #98). BUILD-020 / Proofline
> then ran as the active Build through its Phase 4. On 2026-08-08 Warwick commissioned 4E: prepare
> THIS existing map for a clean post-Proofline restart, then merge, converge, and switch the active
> Build to BUILD-015. **Sections below carry explicit truth labels** — `CURRENT`, `STALE`,
> `SUPERSEDED`, `UNESTABLISHED`, `HISTORICAL EVIDENCE` — applied 2026-08-08; a section without a
> label was verified still accurate at reconciliation.
>
> **The one directive section of this map is § "THE PREPARED POST-JUMP PHASE".** The former §10
> frontier is superseded and says so. **Warwick's 2026-08-08 commission is later authority than the
> 2026-08-04 route authorisation; where they conflict, the commission governs** (root `CLAUDE.md`
> § RECONCILE: later explicit Warwick decisions outrank earlier conflicting ones).

## START / RESUME HERE — ordered by Warwick

- This Git Wayfinder is the sole route and source of truth.
- **On a fresh resume, BEFORE using any tool or doing any work, visibly state: (1) this recovered map path, (2) the goal, (3) the current phase and gate, (4) the next action. THEN open this map and continue.**
- **Canonical-lineage bootstrap — the first move of every fresh BUILD-015 session:** resolve current
  canonical state **by execution** before trusting anything in this map — `git rev-parse HEAD` on
  `main`, `git status --porcelain`, `gh pr list --state open`, and the live-runtime probes in
  § "THE PREPARED POST-JUMP PHASE" → Step 1. **Canonical `main` is the source lineage; a running
  process or old checkout is deployment evidence, never source authority.** *"Running code tells us
  what was deployed. Git tells us what source we own"* (Warwick, 2026-08-08).
- Read the current phase, gate and evidence before acting.
- Honcho points here; it does not replace this map.
- Do not create a todo list, parallel tracker or replacement plan.
- Update this map only at meaningful phase boundaries: PASS, PARTIAL or FAILED, with an evidence pointer.
- Continue autonomously until completion or a genuine Warwick-only blocker.
- Before any clear, restart or handoff, ensure Honcho contains this exact path, current phase/gate and next action.
- **Tangents go in "SHIT TO DO" below. Do not chase them.** See the rule there — it binds even when the tangent comes from Warwick.

## SHIT TO DO — parked tangents

**The canonical parked list for this build is
`Builds/BUILD-015-asdair-durable-household-shopping-steward/SHIT-TO-DO.md`.** It is not duplicated
here. Go there to park a tangent, to read the rule the bullet above points at, or to read the Work
Order challenge log. It also carries the completion gate: that file is reviewed, and the review
recorded, before BUILD-015 is ever described as complete.

**Estate-wide items that are not specific to BUILD-015 go in `Deliverables/BACKLOG.md`, not there
and not here.**

## RESUMPTION PRECEDENCE — recorded 2026-08-04, discharging Veritas `D-G3-07`

**Recorded by `WO-2026-08-04-03`, re-seated by `WO-2026-08-04-04` when this map was added. Exactly
one document may direct the next session. This is the order, and every resumption-shaped document
in `Deliverables/` carries this identical block.**

1. **`Builds/BUILD-015-asdair-durable-household-shopping-steward/`** — the build record is the
   **authority for every BUILD-015 fact, and it is not a route.** A document that disagrees with it
   is wrong.
2. **`Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md`** — **THE Wayfinder map. The sole
   route, and the only document that may state the exact next action.**
3. **`Deliverables/NEXT-ASDAIR-SESSION-brief.md`** — **NON-DIRECTIVE.** Operational hazards and
   code-level do-not-rebuild warnings the map points at. It states no next action.
4. **`Deliverables/2026-08-04-rotation-brief.md`** — **NON-DIRECTIVE.** A dated snapshot of the
   2026-08-04 rotation, kept for its record of what changed and the traps it names. It states no
   next action.
5. **`Deliverables/BUILD-015-STAGE1-continuation-brief.md`** — **NON-DIRECTIVE. Superseded
   2026-07-28 snapshot**, kept as a historical record only.
6. **`Deliverables/NEXT-SESSION-MISSION-repo-worktree-hygiene.md`** — **NOT a BUILD-015 resumption
   document.** A standing repository-hygiene mission; it never directs BUILD-015 work.

**This block is deliberately duplicated byte-identically across all five documents, as a recorded
exception to the SSOT Golden Rule** (root `AGENTS.md` §1), because a fresh instance may open any one
of them first and must learn from that one which document it is allowed to act on.

**The Honcho continuity brief is a POINTER, never the authority** (root `CLAUDE.md` Step 2).
**Verify by execution, not belief.**

---

## 🚦 THE BUILD-015 EXECUTION VIEW — FOUR LANES. **Read this first. Everything below is detail.**

> **Warwick's operating rule, 2026-08-09: PARALLEL PREPARATION. SERIAL PRODUCT TRUTH.**
> The **live journey stays waterfall** — a downstream stage must never run on semantically invalid
> upstream state. **Research, proof, design-readiness, bounded offline implementation and assurance
> preparation do NOT wait for each other.**

**THE CRITICAL PATH:**

```
A  valid current-shop decision  →  C  valid packet / browser / trolley
                                →  D  checkout reconciliation
                                →  B  durable knowledge feeds the NEXT shop
```

**B is developed in parallel even though its full product proof naturally closes at the end/start of
the weekly cycle.**

**Status vocabulary:** `PROVEN LIVE` · `WIRED NOT PROVEN` · `BUILT NOT WIRED` · `BROKEN` ·
`READY TO IMPLEMENT` · `ACTIVE` · `BLOCKED BY UPSTREAM`.

---


### ⚖️ WARWICK'S PRODUCT RULINGS — 2026-08-09. **These settle three open questions; they are his, quoted.**

**RULING 1 — the packet / handoff / `verifyBasket` subsystem: INTEGRATE AND REUSE IT.**
> *"Do NOT discard it. Do NOT preserve it merely as historical reference."*
It corresponds directly to required Product-Star links. **The recurring estate defect is already "correct thing exists but is unwired" — do not respond by writing a THIRD implementation.** What is missing is the production seam and durable storage; the absent `execution_packet` / `basket_reconciliation` migration is **an integration gap, not grounds to abandon the subsystem**.

**RULING 2 — the ASDA-reference hard stop is REJECTED.** It conflicts with the Product Star and with the recovered successful shopping evidence.
> *"A household product does NOT stop being a known household product merely because we lack a current ASDA reference."*
**Known household identity and ASDA retrieval method are SEPARATE concerns.** Use the durable reference when valid; otherwise bounded ASDA search/navigation from the canonical identity, **verified against the known household identity before addition**. **Search is RETRIEVAL — it does not redefine the item as "new".** No silent substitution. Several plausible products remaining → **stop that line and ask Warwick**, never the least-bad result. **This also RESOLVES the outstanding search-fallback contradiction** banked in `RUNTIME-DECISION.md` §"Open considerations" item 4.

**RULING 3 — lease/fencing/recovery is RETAINED as the durability model, but NOT a 45-second CDP lease.** A supervised session runs at human pace. Use the **already-built** lease/fencing machinery rather than the live lease-less duplicate; **the heartbeat lands in the SAME coherent cutover**; expiry suits the real workflow; loss of lease fences further writes; **historic dead rows return to a recoverable `queued` state with progress preserved under an explicit recovery marker and do NOT auto-resume an unknown six-day-old trolley** — re-entry is a deliberate supervised act. **`human_reauth_required` is a separate condition and stays separate.**

**Also accepted: Larry's Route B** — apply the durable current-shop decision **after** `planBasket` inside the live pipeline rather than rewriting planner semantics now. Conditions: build the seam so planner-level consumption can replace it later **without another data-model rewrite**, and **prove by execution that EVERY production recomputation used by the shopping journey applies the decisions before readiness is assessed** — *"a passing comment or test saying this happens is not evidence."*

### ⚠️ STANDING SAFETY CONSTRAINT — until Lane D fixes ingress classification

> **NO LIVE ORDER-CONFIRMATION FORWARDING TO SHOPPERBOT.**

Current intake would treat a forwarded ASDA confirmation as **another shopping list**, creating a spurious shop and spending a model call. The comment above that code asserts the opposite.

### 🔎 THE SEARCH HEURISTIC — Warwick, 2026-08-09. Use it; stop re-documenting it.

> **WHEN A MODULE LOOKS COMPLETE, FIND ITS PRODUCTION CALLER.**
> **WHEN A COMMENT SAYS A LOOP CLOSES, TRACE THE VALUE TO THE CONSUMER.**
> **Then fix the product.**

The "comment says wired / executable path says unwired" pattern is **sufficiently established**. It is now a search technique, not a finding to re-record.

---

### LANE A — INPUT → INTERPRETATION → QUESTIONS → CURRENT DECISION ⭐ **THE CRITICAL SPINE**

| | |
|---|---|
| **PRODUCT OUTCOME** | **Warwick can answer AsdAIr naturally, without Larry, and that answer changes THIS WEEK'S shop.** |
| **PROVEN LIVE** | Photo intake · exact-source fingerprint binding · catalogue-grounded interpretation · the **interpretation-confirmation card, delivered and tapped for real** (2026-08-09, shop 6 recovered `PROCESSING → READY_TO_SHOP` after a real Telegram tap, no Larry in the path) |
| **BROKEN** | 🔴 **D-1 `deps.interpretAnswer` HAS NO PRODUCTION BINDING** — a tap resolves; **free text CANNOT**. Larry's AC3 said "stub at the dep boundary" and never required the real caller, so this is a defect in the ORDER, not the build · 🔴 **D-2 the `wait:line_resolution` park is SILENT** — no outbox, no card, no event, ever; while D-1 stands it is the GUARANTEED destination of every free-text answer, so **the shop stops forever and nothing tells Warwick.** Shop 6's exact shape, re-created by this WP's own gate · **Question cards are never delivered** — all 11 of shop 6's questions have `card_chat_id`/`card_message_id` NULL, no render fingerprint · **an answer cannot reach the plan** — `runPipeline.js:638` writes `applies_going_forward:false`, `planner.js:1091` admits only `===true`, and `shopLines.markCorrected` has **zero production callers** · **`READY_TO_SHOP` never looks at a line** (`stages.js:306-318` counts open questions only) |
| **ACTIVE** | **WP-B15-2 decision spine BUILT** (`72579cd`+`2d84dd1`, pipeline 205→264, five mutation demos) — **but Veritas Gate 1 = HOLD.** Corrective dispatch in flight for **D-1** and **D-2** only. In parallel: Silas proving migration 017 against REAL disposable Postgres (no authority needed — engineering verification) |
| **READY NEXT** | Silas lands → regenerate WP-B15-2 through the envelope route ONCE → accept the read-back → Keel builds. Then Cockpit parity, which **must NOT hold Telegram autonomy hostage** |
| **LIVE ACCEPTANCE** | A real delivered card · ≥1 deterministic button resolution · **≥1 genuine natural-language Warwick reply** · any required Terra interpretation · durable structured decision · observable line/plan change · `READY_TO_SHOP` only after lines are actually resolved. **NO Larry answering.** Shop 6 is in an invalid semantic state — **its rows must NOT be hand-patched to manufacture acceptance** |
| **DEPENDS ON** | Nothing. This is the spine. |

**Establishment:** [[Deliverables/2026-08-09-pax-answer-to-plan-seam]], banked `397d388`. Conclusion **C** — neither buttons nor free text reliably change the current-week plan; both die at the same barriers, so **the seam is not in the channel**.

**Binding design ruling (Warwick):** current-shop meaning and future household learning are **different concerns**. **Do NOT route this week's decision through `rule_qa_log`.** Persist it in the current shop's durable state. **Terra is called only where semantic interpretation is genuinely required** — a button naming an exact candidate must not spend a model call — and may only assert a product identity present in its supplied evidence. **No least-bad match. Unknown means `clarification_required`.**

---

### LANE B — SUPABASE DURABLE HOUSEHOLD KNOWLEDGE / BETWEEN-SHOPS MEMORY

| | |
|---|---|
| **PRODUCT OUTCOME** | **What the household learns this week is there for Terra BEFORE next week's photograph.** |
| **PROVEN LIVE** | Static knowledge genuinely reaches Terra / recognition / planner — recognition is authentically grounded |
| **BROKEN** | **Everything learned by OPERATING is lost or inert.** Shop 6's 11 answers produced zero durable rows · `rule_qa_log` newest row is **2026-07-20** · the 106-key purchase-frequency view is read by nothing · `substitutes_allowed` flattened to `false` for all 103 regulars against a historical 9-of-36 · later regular enrichment has been **Larry-mediated, not production-learned** |
| **ACTIVE** | ✅ Establishment RETURNED. **B1's real break is one line earlier than believed** — `runPipeline.js:641` `resolution:{kind:'none'}`, so `buildAnswerLearning` builds no catalogue operation at all and the alias (the only proven mechanism) is never created. Three breaks stack. **B2** is a wired loop over a permanently empty table. **B3** has no production caller — `recordShopOutcome` is CLI-only |
| **READY NEXT** | Turn the establishment into bounded slices; build whichever are file-surface independent of Lane A. **Do not make every one-off answer a standing rule** — explicit "always/never/from now on" may become policy; this-week-only must not |
| **LIVE ACCEPTANCE** | An answer given this week demonstrably prevents the same question next week, **against the real planner** · a genuinely new accepted product reaches Regulars/Favourites and Supabase **without Larry** |
| **DEPENDS ON** | Full product proof closes at the weekly cycle boundary. **Design and implementation readiness do not wait.** |

> **⚠️ ASDA Regulars/Favourites are PLATFORM EVIDENCE, not household intent. BOB is the example that proves it** — it kept reappearing because Regulars is generated from order history, while the household had explicitly ruled against it.

---

### LANE C — BROWSER OPERATION / ASDA SHOPPING

| | |
|---|---|
| **PRODUCT OUTCOME** | **A valid confirmed plan becomes a correctly built ASDA trolley, reconciled, never checked out.** |
| **PROVEN LIVE** | A real ASDA trolley HAS been built successfully by the historical browser method (three runs recovered from evidence) |
| **BROKEN** | **Stale claims strand shops** — `browser_build_request` ids 1, 2 and 5 held by dead claimants since 28 Jul / 3 Aug, **no lease expiry, no reaper** · **packet/handoff has no production caller** — `handoff/` has zero non-test importers; `buildHandoff` appears in `runtime.js` only in a comment · **no Larry-less claimer by design** (`stages.js:85`: *waitsFor: the supervised browser runner (Larry, at the keyboard)*) |
| **ACTIVE** | ✅ **C3 COMPLETE** — `2bd86a6` + `b399c23` on `build-015/browser-method-contract`. Ruling 2 implemented at **all THREE** enforcement sites (handoff, packet producer, and the committed packet SCHEMA in `Builds/**`, which Keel could not touch and pinned instead). 18 behaviours in `BROWSER_METHOD`; handoff 81→**104** tests, packet **109**; mutation-proven both times · **C1** STOOD DOWN until Lane A releases `shop/**` |
| **READY NEXT** | Packet/handoff production seam + the missing `execution_packet` / `basket_reconciliation` storage — **only once Lane A's corrected plan contract exists.** ⚠️ **`handoff/**` still has NO production importer: C3 is PREPARED READINESS, not delivered capability.** Residuals carried, not fixed: no `LINE_REPORT_STATUSES` member for *"found several plausible products, stopping to ask"* (blocked by the out-of-surface cockpit label map) · capturing a discovered ASDA reference so a line stops searching forever (**Lane B2, parked**) · the `SOP-021a` disagreement, reported not edited |
| **LIVE ACCEPTANCE** | A real trolley built from a **semantically valid** plan, reconciled against it, `BASKET_READY` raised. **Never checkout, never pay** |
| **DEPENDS ON** | **Lane A for a valid plan contract.** Do NOT design against the current invalid transient plan shape. Do NOT execute a real trolley from shop 6 until Lane A is fixed |

---

### LANE D — POST-SHOP WRAP-UP / RECONCILIATION

| | |
|---|---|
| **PRODUCT OUTCOME** | **The real order is reconciled against the confirmed plan, discrepancies are visible, and the outcome is durable.** |
| **PROVEN LIVE** | Nothing. **The post-shop quarter has never run once.** `order_confirmation` and `order_confirmation_line` hold ZERO rows ever. Warwick's own checkout/pay/slot boundary is the healthiest link in the lane — enforced by four independent mechanisms, not convention |
| **BROKEN** | ⚠️ **No path from Telegram to `submitConfirmation`** — `runtime.js:145` `pollIntake` makes EVERY message a `receiveList` · **`asdair.orders` has no pipeline writer**, so `loadLastOrder` returns null forever and silently · the reconciliation card payload is `{shopRef}` only against a renderer needing seven counts · new zero-caller instances: `recordShopOutcome`+`buildOutcome`, `reconcile/verifyBasket.js`, and `asdair.previously_ordered` (**106 keys of real purchase frequency read by no code**) |
| **ACTIVE** | ✅ Establishment RETURNED. **Confirmation ingress is now a high-value INDEPENDENT slice** — Warwick has ruled it must be made truthful BEFORE checkout |
| **READY NEXT** | The prepared live acceptance sequence, written **before** we reach checkout |
| **LIVE ACCEPTANCE** | Warwick checks out personally → the confirmation reaches AsdAIr → the real order is parsed and reconciled → discrepancies visible → durable outcome → learning hooks fire. **Larry performs no checkout, payment or slot action** |
| **DEPENDS ON** | Lane C for `BASKET_READY`. **Establishment does not wait** — Warwick: *"so we do not reach checkout and then discover the last quarter of the product was only unit-tested."* |

---

**PARKED, NOT LOST** — carried, not chased: the tap-acknowledgement defect (`runtime.js:285-298`, historic, never worked) · the search-fallback browser-method contradiction · `RUNTIME-DECISION.md`'s corrected evidential premise · Veritas Gate 2's five open HOLDs · multi-worktree/active-programme-state semantics (parked to **BUILD-020 4F**).

**FILE-SURFACE OWNERSHIP while implementers run in parallel — Larry's, resolved before dispatch:**
Lane A owns `pipeline/**`, `bot/**`, `db/**`. Lane C1 owns `handoff/**`, `browser-runner/**`. **Neither crosses.** A worker needing the other's surface stops and says so rather than editing across it.

---

## WHAT THIS MAP IS, AND WHEN IT WAS WRITTEN — read before trusting its shape

**Written 2026-08-04, at roughly ninety percent of the build.** BUILD-015 was promoted on
2026-07-27 and predates the 2026-08-02 Wayfinder mandate, so **it ran without a map for its whole
implementation.** Warwick asked for one on 2026-08-04 and authorised writing it, for a stated
reason: Wayfinder is how rotations and model switches are tracked, and with Veritas now gating every
integrated head, properly-phased boundaries carry real assurance weight.

**This is a route record for the remainder. It is not a plan that governed the work.** Phases
already passed are described **retrospectively**; phases 0–5 below are the forward route. Presenting
it as though it planned BUILD-015 would be a fiction, and it would be a fiction inside a
documentation-truth review.

> ### THE ROUTE IS AUTHORISED. THE MAP AS A DOCUMENT IS NOT ACCEPTED. These are different things.
>
> **This is the single record of Warwick's route authorisation in the estate. Everything else that
> speaks to it defers to this block.**
>
> **What happened.** On **2026-08-04**, replying in session to a message containing the six-phase
> table now at §9, Warwick said: **"Yes I authorise and agree that."** That is an authorisation of
> **the six-phase route**, and it is real.
>
> **What that authorisation rests on, stated so a reader can weigh it.** It was given in
> conversation. **Nothing in Git recorded it until this line, and this line is Larry's account of
> it** — attested by Larry, not verifiable from the repository, and not independently reproducible
> by any reviewer working from the estate alone. Veritas found this authorisation unevidenced at
> `d63668f` (`D-G3-13`) and **was right to**: it reviews the repository, and the repository was
> silent. The defect was the estate's silence, not the authorisation.
>
> **Residual risk, which only Warwick can close.** This block writes a `product-decision` into the
> map from a second-hand account of a conversation. **If Larry's recollection is wrong, a false
> authorisation is now recorded one layer deeper than the contradiction it replaced.** The cheapest
> closure is Warwick confirming it once in a later session, giving the line a second attestation.
> **No mechanism is to be built to manage this.**
>
> **What Warwick has NOT done, and it is not a technicality.** He authorised the route. **He has
> not read or accepted this map as a document.** *(2026-08-08: the phrase "430-line" is removed per
> `D-G3-25` — the count was falsified by its own commit; the map carries no self-count, for the same
> reason §12 refuses one.)* The map carries far more than §9 — the
> current reality table, the fog register, the boundaries, the acceptance evidence and the frontier
> — and none of that has been in front of him. **Do not read "the route is authorised" as "the map
> is accepted."** A fresh instance must not begin phase 1 work on the strength of a document
> Warwick has never seen; root `CLAUDE.md` §Wayfinder — *"Do not begin implementation until Warwick
> accepts the plan"* — is satisfied for the route and **not** for the map.

**Nothing in this map records any work package, phase, build, service or journey as complete,
operational, durable, ready, accepted, production-safe or closed.** Larry holds no such authority
(`GOVERNANCE-VERITAS-HIRE`, 2026-08-04). ~~**BUILD-015 currently holds an open Veritas Gate 3
HOLD.**~~ **RE-CUT 2026-08-08:** the Gate 3 position when this map was written (two receipts, live
HOLD at `d63668f`) was superseded by a **third** Gate 3 review — **HOLD at `94f135f`**, receipt
`Builds/BUILD-015-.../Assurance/veritas-gate3-truth-94f135f.md`, with `D-G3-21`–`D-G3-24` never
subsequently corrected and `D-G3-26` (an `eol=lf` pin for `Assurance/*.md`) an open Warwick
decision. **That HOLD reviewed the 2026-08-04 document state as its boundary and is HISTORICAL
EVIDENCE about that boundary.** Whether any of its findings still bind after this 2026-08-08
reconciliation is listed in § "THE PREPARED POST-JUMP PHASE" → deferred verification — it is not
silently discharged here.

> **MAP ACCEPTANCE — CLOSED 2026-08-08.** The 4E route completed the same day it was prepared:
> Veritas **PASS** (all 14 requirements; receipt `Deliverables/2026-08-08-veritas-4e-prep-receipt.md`),
> Codex three-pass review on PR #99 (content 14/14; TQA-4E-002 adjudicated by Warwick, verbatim:
> *"I accept TQA-4E-002 as the bounded evidence limitation for this documentation-only merge"*),
> and **Warwick's `merge-decision`: MERGE — executed at the exact reviewed head `0511c0a`, PR #99.**
> **That merge is the acceptance event (commission §18, §22): this map is ACCEPTED and is the
> active post-jump authority.** ~~Until that merge, this map is a prepared candidate~~ —
> superseded by the merge itself; resolve current canonical `main` by execution, never from a SHA
> written here.

---

## 1. GOAL CONTRACT AND NORTH STAR

**Canonical: `Builds/BUILD-015-asdair-durable-household-shopping-steward/BUILD-015-goal-contract.md`.**
Not restated here. The North Star, in Warwick's terms:

> **Send Mum's list to ShopperBot and have the shopping sorted, without disturbing Warwick or Larry
> while other work is in flight.**

The formal contract's north star is a genuinely durable, spawnable household-shopping specialist
that orients from committed function plus Supabase state, plans correctly, asks for decisions when
required, persists outcomes and learning safely, and survives fresh runtime instances.

**The accepted bar is SUPERVISED, not hands-off** (Warwick, 2026-07-28). Fully hands-off shopping
was descoped 2026-07-21. **Warwick remains the checkout and payment gate, permanently.**

**The failure this build exists to close:** the method lived only in machine-local memory and
per-session scratchpads, and the three loop tables had zero writers anywhere in the repo. Each week
started no better informed than the last.

**Larry is outside the weekly operating path.** AsdAIr must run with zero Claude Code involvement;
model calls go through `FUSION_GATEWAY_URL`.

### ⭐ The Star as Warwick restated it, 2026-08-08 — CURRENT, and it extends (does not replace) the goal contract

**Canonical full text: [[Deliverables/2026-08-08-build-015-prejump-wayfinder-handover-SOURCE]] §5–§6.
Binding. The compact form:**

Warwick sends Mum's real handwritten shopping-list photograph to ShopperBot, and **without Warwick
opening Claude Code, contacting Larry or ChatGPT, transcribing anything, joining services by hand,
or deciding which week's photograph was used**, the production system: receives the photo durably →
binds the shop to the exact source message/image → loads the complete household recognition
catalogue **before** vision → has **Terra** interpret against Regulars, Favourites, canonical names,
aliases, brand/category/variant, usual quantities, prior answers and prior orders → resolves known
items safely → batches genuine ambiguities into ONE Telegram question round → persists answers so
next week asks less → produces one confirmed **Brand A–Z** plan → hands it to the approved delegated
basket runtime → builds the trolley → reconciles against the plan → notifies checkout-ready →
**checkout, payment and slot stay Warwick's alone** → persists outcomes and learning.

**The four non-negotiable product invariants (mirror §6, binding verbatim there):**

- **A — Recognition is catalogue-grounded.** No open-ended OCR or ungrounded transcription may
  remain available as a silent production fallback. *A function called `loadCatalogue` is not
  evidence the catalogue reached the model.*
- **B — ASDA product IDs do not gate handwriting recognition.** Missing IDs/URLs may affect basket
  execution; they must never stop Terra recognising a known Regular, Favourite, canonical name or
  alias. Recognition identity and store-navigation identity are separate concerns.
- **C — The exact source photograph remains provable** end-to-end (intake ID, image reference,
  immutable fingerprint, timestamp, shop reference, physical/interpreted line counts, packet
  fingerprint). The wrong-week-list incident is a product requirement, not trivia.
- **D — Grounded model evidence is constrained, not discarded.** Deterministic exact matches win;
  Terra ranks only supplied catalogue candidates; close candidates become a human question; nothing
  outside the catalogue becomes an accepted known item; confirmed outcomes enrich future aliases.

**Production vision ownership (Warwick, 2026-08-08):** Terra through the Fusion gateway is the
acceptable production vision runtime. Delegated Claude vision may later be *investigated* as
diagnostic or shadow-review capability; **it is not production architecture unless it demonstrably
operates independently of Larry and survives cold start.** Larry, ChatGPT and a live Claude Code
conversation must not remain part of the production shopping journey.

## 2. CURRENT REALITY AND VERIFIED ASSETS

### ⛔ The 2026-08-04 state table — HISTORICAL EVIDENCE. Its branch no longer exists.

The original table below described branch `build-015/live-acceptance-recovery-2026-08-03` at
`cd51ac0`. **That branch was merged into canonical `main` (via the 4C estate reconciliation, PR #98)
and deleted.** Its rows are retained struck-through as evidence of the 2026-08-04 position only:

~~Branch `build-015/live-acceptance-recovery-2026-08-03` · HEAD `cd51ac066895985463e88d3933de4e0c1db7c0db` · two Gate 3 reviews, live HOLD at `d63668f` · no open PR · 14 suites, 1,609 tests / 1,606 pass / 3 skipped pinned to that head · CI UNVERIFIABLE OFFLINE · live DB UNVERIFIABLE OFFLINE~~

### Current reality — resolved by execution 2026-08-08 (4E reconciliation). Every head will move — resolve it yourself.

| | |
|---|---|
| Source authority | **Canonical `main`.** All BUILD-015 source, this map, the build record and all four+1 assurance receipts live on `main`. No BUILD-015 branch exists |
| Gate 3 position | **THREE reviews, all HOLD.** Live receipt: `veritas-gate3-truth-94f135f.md` — `D-G3-21`–`24` never corrected, `D-G3-26` open Warwick decision. Enumerate `Builds/BUILD-015-…/Assurance/` rather than trusting this row |
| CI | ~~Root cause UNESTABLISHED~~ **RE-CUT at the bootstrap (2026-08-08 late): `asdair-tests.yml`'s `integration` job has NEVER passed in its recorded history (12/12 runs failed, 2026-08-05→08). Exact failure identified: `skill/test/integration.dbtest.js:266` — seeded `widget b` (household-scoped term match) plans `needs_decision` where the test requires `add`; the divergence is in the real `data.js` adapter ↔ planner contract, which unit fixtures never exercise. INHERITED BASELINE BREAKAGE — predates all 4E/bootstrap work. Do not weaken the assertion; the fix is routed work.** The path-filter warning stands: an unrun workflow looks exactly like a green one — check the last run PER WORKFLOW. Detail: [[Deliverables/2026-08-08-b15-bootstrap-evidence]] §3 |
| Live runtime | ~~RUNNING, and OLDER than current source~~ **RE-CUT — ALIGNED at the bootstrap (2026-08-08 ~21:50–21:55), on Warwick's §4 authority:** `runtime.js --watch` restarted via the canonical scheduled-task launcher (PID 13756, absolute canonical entrypoint) and cockpit-api restarted detached (PID 14376, canonical WorkingDirectory, port 8710 LISTENING). **Both now execute canonical source `959a64b` — the first live processes ever to carry the 2026-08-04 seven-workstream fixes.** No shop_event row appeared after the restarts (verified) — the alignment changed no shopping state. Known liability recorded once: **cockpit-api has no launcher/task; its start is manual.** Scheduled task `Ready`; `ACTIVATION-DEFERRED.md`'s "Disabled, not armed" remains STALE. Detail: [[Deliverables/2026-08-08-b15-bootstrap-evidence]] §2 |
| Live database | ~~UNVERIFIABLE from this reconciliation~~ **RE-CUT — ESTABLISHED read-only at the bootstrap (2026-08-08, `asdair_ro`, SELECTs only):** 26 live tables vs 23 repo-defined — **live-only: `command_request`, `previously_ordered`, `skill_steps` (the migration debt, now named); no packet table (015 never applied).** Rules: 40 by directive (exclude 3 · info 24 · map 10 · needs_decision 2 · rotate 1) — rule 32 is now a structured `rotate` WITH match_term; rule 10 (never-BOB) is still inert `info` while regular 69 (Arla BOB) is ACTIVE — fog 2 CONFIRMED LIVE. Regulars: 103/103 active, `source`={regular} only — fog 5 RESOLVED (no live Favourites source). **Real journey rows exist: 3 shops; shop 6 (2026-08-03) interpreted 35 lines against a 97-product catalogue, answered all 11 questions, replanned — and has sat at `PROCESSING` ever since: parked on the interpretation-confirmation gate (`needs_review=true`, zero confirm commands ever in `pipeline_command` — break 8 below), NOT the packet seam as first attributed.** Detail: [[Deliverables/2026-08-08-b15-bootstrap-evidence]] §4–§5 |
| Suites | Not re-run during 4E (documentation-only phase). The last committed local claim is the 2026-08-04 green at 1,599–1,609; **the CI row above is newer and redder — believe it** |

**Verified assets — real, tested, and reachable from something:** the intake receiver, shop state
store and status projection, the ShopperBot control surface, vision transcription through the
gateway, catalogue-grounded interpretation (`interpret/`), the deterministic planner with tolerant
term matching (`skill/termMatch.js`), reconciliation (`reconcile/`), the outcome and regulars
writers, and the Cockpit read surface. `sendQuestionCard` **now has a production caller**, bound in
`pipeline/runtime.js`.

**Verified assets with NO production caller — built, tested, and reached by nothing** *(re-enumerated
2026-08-08)*: the execution-packet → handoff chain. `packet/buildExecutionPacket.js` now HAS a real
caller — `handoff/buildHandoff.js` — **but `handoff/` itself has zero non-test importers anywhere in
`services/asdair/`**; `pipeline/runtime.js` mentions `buildHandoff()` only in a comment (line ~401).
The chain plan → packet → Sonnet handoff artefact exists and is tested, and **nothing in the
production journey invokes it. A tested module with no caller is not delivered.**

**The standing risk, re-stated with its scope (precision added at the 2026-08-08 bootstrap): no row
has ever been written to Postgres by the TESTED journey** — all three skipped tests are the
destructive Postgres tests gated on `ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE`, and that remains true.
**The LIVE journey has real rows** (3 shops; shop 6's full trail through interpretation, questions
and replan — see [[Deliverables/2026-08-08-b15-bootstrap-evidence]] §5), written during the
manually-rescued 2026-08-03 run. Both halves are true; the original sentence stated only the first. The `RESUMABILITY` tests build a fresh deps container over the
**same in-memory JS object graph** — which proves no state hides in the container, **not** that
anything survives process death.

## 3. SYSTEM MAP AND PRODUCT BOUNDARIES

**The canonical end-to-end process is
`Builds/BUILD-015-.../CANONICAL-WEEKLY-SHOP-PROCESS.md` (steps A–H).** Its own status table records,
per step, what is implemented and what is not. **That table is the authority on implementation
status; this map does not duplicate it.** *(Timing caveat added 2026-08-08: that status table is
dated 2026-08-04 01:31 — before the seven-workstream commit `996a838` at 02:39 the same night. Its
rows C ("exact-string"), D ("demonstrably broken") and E ("does not exist") describe the
pre-workstream source and are STALE as source claims; §10's seven-break table carries the
reconciled position with evidence.)*

Shape of the journey: photograph → ShopperBot intake → durable shop row → catalogue loaded **before**
interpretation → catalogue-constrained vision → identity resolved from our rows → rule and alias
matching → questions only for genuinely new items → answers → replan → **Sonnet Browser execution
packet (Brand A–Z)** → basket built → reconciliation against expected counts → basket-ready handback
→ outcome recording → learning write-back.

**Product boundaries, canonical in `Builds/BUILD-015-.../RUNTIME-DECISION.md`:**

- **Sonnet in Claude for Chrome is the Stage 1 live basket writer.** Not Larry, not a Claude Code
  subagent, not the CDP runner at `services/asdair/browser-runner/`.
- The CDP runner is **experimental, deferred, not the live default, not a blocker to Stage 1, and
  prohibited from further live-account testing without fresh authority from Warwick.**
- **Deferred as Stage 2c and not to be built:** a persistent external-LLM daemon, a fully autonomous
  planning daemon, an unattended ASDA browser, automated checkout, automated payment.
- The Cockpit read contract is published and binding on the read side:
  `Builds/BUILD-015-.../COCKPIT-PACKET-AND-RECONCILIATION-INTERFACE.md`. Its producers do not exist
  yet.

## 4. KNOWN DECISIONS

Each is settled. **Do not re-open one; point at it.**

| Decision | Where it is canonical |
|---|---|
| Sonnet in Claude for Chrome writes the basket | `RUNTIME-DECISION.md` (Warwick, 2026-08-04) |
| Sort order is **BRAND A–Z**, for the ASDA grid and the packet | Goal contract Q2, `CANONICAL-WEEKLY-SHOP-PROCESS.md` §E |
| Supervised bar, not hands-off; Warwick is the checkout and payment gate | Goal contract |
| Stage 2a/2b are REQUIRED parts of Stage 1; only 2c is deferred | Goal contract §"Stage 1 scope" |
| Execution-packet schema: `bigint`, surrogate PK, **append-and-retain never upsert**, `unique (shop_id, packet_fingerprint)`, `packet_version` GENERATED STORED, full `asdair_ro`/`asdair_rw` grants — migration **015** | Silas's recorded schema decision; restated in the directive brief's frontier |
| Ordinary shopping content is **explicitly not private**; only secrets stay out of the repo | GL-009 (Warwick, ruled twice — do not ask again) |
| Packet stored as whole schema-valid `jsonb`, cockpit renders `lines` in array order and does not re-sort | `COCKPIT-PACKET-AND-RECONCILIATION-INTERFACE.md` |
| The accepted provenance residual (TQA-PR73-002) proves provenance of **citation**, never of content | `ACCEPTANCE-AND-EVIDENCE.md` |
| Veritas gates every integrated head; Larry may not declare his own work complete | `GOVERNANCE-VERITAS-HIRE`, root `CLAUDE.md` |
| **Terra via the Fusion gateway is the production vision runtime**; delegated Claude vision is investigate-later, diagnostic/shadow only, and never production unless independently cold-start proven | Warwick, 2026-08-08 — commission mirror §5 |
| **ASDA product IDs never gate handwriting recognition** — recognition identity and store-navigation identity are separate concerns | Warwick, 2026-08-08 — commission mirror §6B |
| **Exact-source-photograph provability is a product requirement** (fingerprint, intake ID, line counts, packet fingerprint — the wrong-week incident is the reason) | Warwick, 2026-08-08 — commission mirror §6C |
| **Grounded candidate evidence is constrained, not discarded**; deterministic matches win, Terra ranks only supplied candidates, close calls become a human question | Warwick, 2026-08-08 — commission mirror §6D |
| **First post-jump mission and sequence**: grounded-vision / earliest-broken-link investigation → one bounded Pax investigation → ONE proposed Active Session Work Package → one bounded Nolan review → Warwick decision → only then implementation | Warwick, 2026-08-08 — commission mirror §11–§12, §23 |
| **WP-B15-1 APPROVED — items 1+2 only; item 3 OUT** (leading candidate for the next slice, subject to the household-knowledge audit). Narrow item-2 migration authority granted with conditions. Binding acceptance = the real production event list | Warwick, 2026-08-08 — [[Deliverables/2026-08-08-asda-build-002-SOURCE]] §1–§3, §11 |
| **BOB ruling — CLOSED, not a contradiction: KEEP rule 10 (never BOB).** BOB's presence in ASDA Regulars/Favourites is **external platform evidence, not household intent** — Mum switched to Cravendale over end-of-date milk. **Principle carried into the knowledge model: external platform list membership never silently outranks an explicit current household rule/decision.** Do not "clean" ASDA's lists | Warwick, 2026-08-08 — [[Deliverables/2026-08-08-asda-build-002-SOURCE]] §5, §7 |
| **Retained-photograph ruling**: shop 6's exact photo is approved for the "what Terra receives" demonstration IFF its provenance is provable from the durable production record; otherwise the recorded answer is NO APPROVED RETAINED PHOTOGRAPH ESTABLISHED — never substitute another week's | Warwick, 2026-08-08 — [[Deliverables/2026-08-08-asda-build-002-SOURCE]] §4 |

## 5. UNRESOLVED FOG AND CONTRADICTIONS

**Recorded rather than silently resolved. Nothing here is to be settled by picking the convenient
source.**

1. **The `sure`-variant conflict — three artefacts disagree.** `skill/planner.js:524` returns
   `fixed_variant_conflict`; `services/asdair/db/007_rules_rotate_directive.sql`'s header states the
   household holds a real conflict and that the migration does not resolve it; `ACTIVATION-DEFERRED.md`
   calls it *"Real, unresolved."* ~~Establish which is true against the live rules table.
   `UNVERIFIABLE OFFLINE`.~~ **PARTIALLY RESOLVED BY EXECUTION 2026-08-08 (read-only):** the live
   rules table now holds Sure as a structured family — rule 13 `info`, rules 23/24 `map` (male→blue,
   female→white), **rule 32 a structured `rotate` WITH `match_term`** (no longer inert info), rule
   37 `info` (multibuy rounding). Whether the planner actually actions `rotate` end-to-end is
   still for the routed investigation. **The separate three-way reading Warwick already closed is
   retracted and settled — this is not that, and it does not re-open it.**
2. **`Arla BOB Semi-Skimmed 2L` (regular 69) is ACTIVE while rule 10 says never buy BOB**, and rule
   10 is `info` with no `match_term`, so nothing enforces it. The old reasoning that `milk` resolved
   safely *because regular 69 carries no alias* was written when matching was exact-string. **Matching
   is now tolerant, so the reason that safety held may no longer hold.** More urgent, not less.
   ~~`UNVERIFIABLE OFFLINE`.~~ ~~CONFIRMED LIVE 2026-08-08: … a genuine product question.~~
   **CLOSED BY WARWICK'S RULING, 2026-08-08 (same day):** not a contradiction. **KEEP rule 10**;
   BOB in ASDA Regulars/Favourites is external platform evidence (ASDA controls those surfaces),
   not current household intent — Mum switched to Cravendale over end-of-date milk. The structural
   half survives as engineering fact, not open question: rule 10 is `info` with no `match_term`,
   so nothing yet ENFORCES the ruling in the planner — that belongs to routed knowledge-model
   work, guided by the audit. Authority:
   [[Deliverables/2026-08-08-asda-build-002-SOURCE]] §5, §7.
3. **Migrations 013 and 014 were applied live and have no committed files.** `services/asdair/db/`
   stops at `012_complete_grant_matrix.sql` — verified by listing. **The live database is ahead of
   the repository, and a fresh clone or bootstrap restore does not reproduce live state.**
4. **The producer's actual database role is unverified**, and it is the highest-risk unknown before
   any live migration application. `UNVERIFIABLE OFFLINE`.
5. **Whether Favourites is genuinely a distinct source view.** ~~`UNVERIFIABLE OFFLINE`.~~
   **RESOLVED BY EXECUTION 2026-08-08 (read-only): `asdair.regulars` = 103 rows, all active, and
   `source` holds exactly `{regular}` — no `'favourite'` row exists. `source_view: "favourites"`
   remains a forward contract describing nothing live.** Product intent is still Warwick's — §7
   item 2 (human dependency 2) stands.
6. **A `BUILD-002 live proof` test row is recorded as still sitting in a `next_week_draft` list.**
   `UNVERIFIABLE OFFLINE`.
7. **A corrected record may not reach a fresh agent. UNEXPLAINED — three observations across three
   sessions, three different relationships to the repository, and no mechanism consistent with all
   three** (`D-G3-10`, `D-G3-20`, and a third recorded below).

   **Every SHA below is a full 40 characters and was resolved through `git rev-parse --verify`. The
   two `CLAUDE.md` versions in play are blob `8d865ed166c339208a94a425e1a508115b556c04` (the
   superseded text) and blob `75a19c4b895a23190f43a20412c156641adbcc4f` (the corrected text).**

   | # | Session | Repository `HEAD` at the time | What the injected `CLAUDE.md` actually was |
   |---|---|---|---|
   | 1 | Veritas, round 1 | `ecfb04b8b6d5173ffa68b318baf2c3a97c0dd040` | superseded text, while the on-disk blob was current |
   | 2 | Veritas, round 2 | `d63668f653e233a22b5a28b6eb60f5fb84ecce48` | blob `8d865ed166c339208a94a425e1a508115b556c04` — **neither `HEAD` nor the working tree**, but the previous commit |
   | 3 | A dispatched worker, 2026-08-04 | `c9b04cfa3e74b7fb6621f720a0afeca131cfedbb` | blob `8d865ed166c339208a94a425e1a508115b556c04` **again** — while `HEAD:CLAUDE.md` was `75a19c4b895a23190f43a20412c156641adbcc4f`, the on-disk file was `75a19c4b895a23190f43a20412c156641adbcc4f`, **and the previous commit `d63668f653e233a22b5a28b6eb60f5fb84ecce48:CLAUDE.md` was also `75a19c4b895a23190f43a20412c156641adbcc4f`** |

   **Two candidate mechanisms have now been recorded and both are falsified.** "The injected copy
   matched the file at `HEAD`" is falsified by observations 2 and 3. "It matched the previous
   commit" — the replacement offered in the `d63668f` receipt — is falsified by observation 3, where
   the previous commit carried the corrected blob and the injected copy did not. Observation 3
   matched a blob that was ~~four commits back~~ **last current two commits back from the observing
   session's `HEAD` `c9b04cf`, and first appeared five commits back** *(corrected 2026-08-08 from
   `D-G3-23` of the `94f135f` receipt: blob `8d865ed1…` was `CLAUDE.md` at `ecfb04b`, `565351d`,
   `7ca8c3b` and `cd51ac0`; `75a19c4b…` from `d63668f` onward — "four" was neither)*. **No mechanism is offered here to replace them.** Caching or
   snapshotting is a hypothesis, not a finding, and re-narrowing this to a third guess is how the
   first two got written.

   **A real limit on this evidence, not a hedge:** all three observations are **first-person** — an
   agent reporting the contents of its own injected context — and **none is reproducible from the
   repository**. A reader working from Git alone cannot confirm any of them.

   **The live-probe criterion is OPEN. Do not record it as solved and DO NOT DESIGN A PROBE** —
   Nolan specifies one if and when Warwick asks. The behavioural rule this implies for a reader is
   in the directive brief.
8. **The proven ASDA basket-building mechanism is thinly evidenced.** `EXPERIMENT-RESULT.md` records
   that a bulk control *exists*; it does not record it used successfully at scale. Warwick's
   first-hand "fast ordered traversal" account is authoritative and the repository does not
   corroborate it. Close the gap by capturing evidence during the next real shop.

## 6. HUMAN DEPENDENCIES — and the phase at which each becomes blocking

**The detail of each decision — the options, the recommendation, the evidence — is in
`Deliverables/NEXT-ASDAIR-SESSION-brief.md` §"DECISIONS WAITING ON WARWICK". Not duplicated here.**
This map owns only *which dependency blocks what, and when*.

| # in the brief | Dependency | Becomes blocking at |
|---|---|---|
| 1 | **Asdair's contract still says Asdair runs `runner.js` itself**, which `RUNTIME-DECISION.md` supersedes and prohibits *(re-verified 2026-08-08: `Team/Asdair - Household Shopping Steward/AGENTS.md:97` still carries the superseded claim; only Warwick may authorise the `AGENTS.md` edit)* | **Before any Asdair dispatch, at any phase.** A dispatched Asdair reads its own contract first and that contract outranks every brief. The prohibited action is a **live ASDA account** action. **DO NOT DISPATCH ASDAIR UNTIL WARWICK HAS RULED.** |
| 2 | Should Favourites be a real second ASDA view? | **Phase 1** — it decides whether the packet's `source_view` contract describes anything |
| 3 | Should the dedupe guard live in the schema rather than in one writer? | **Phase 1**, with migrations 013/014 |
| 4 | `D-G3-08` — Keel's contract enumerates three conditions after "when all of these hold" | **Non-blocking.** Fold in at Warwick's next authorised touch of that contract |
| 5 | Root `CLAUDE.md:90` vs root `AGENTS.md` §3 on whether Larry may act personally on integration | **Phase 4**, when documentation is reconciled and Git truth is re-submitted |
| 6 | Nothing obliges re-reconciling a `.claude/agents/` shim when its wiki contract changes — how `D-G3-03` happened | **Non-blocking.** Needs an `AGENTS.md` edit reserved to Warwick. **No mechanism is to be built** |
| 7 | `.claude/agents/nolan.md:4` requests `MultiEdit`, which this host does not deliver | **Non-blocking.** Parked in `SHIT-TO-DO.md` |

**Plus the one this map itself creates, and its current state:** the six-phase route below was a
`product-decision`, and **Warwick authorised it on 2026-08-04** — see the authorisation block at the
top of this map, which is the single record of it and carries its provenance and its limits.
**It no longer blocks phase 1.** What still stands between this map and phase 1 is the open Veritas
Gate 3 HOLD, and — separately — the fact that **Warwick has not read or accepted this map as a
document**, which is not the same decision and has not been made.

## 7. SECURITY, PERMISSIONS, OWNERSHIP AND RECOVERY BOUNDARIES

- **Two credentials, both in `C:/.fusion247/asdair.env`:** `ASDAIR_DB_URL` (`asdair_ro`,
  **SELECT-only**) and `ASDAIR_WRITE_DB_URL` (`asdair_rw`, narrow write). **Consume the environment,
  never inspect it.** A writer told to use `ASDAIR_DB_URL` is a defect — that variable is
  contractually SELECT-only precisely so a bug *cannot* write.
- **The secrets store is denied by default.** `C:\.fusion247\**` is reachable only through one exact
  declared `private/<project>/**` subtree. Rule:
  `Team Knowledge/Guidelines/GL-012-secrets-store-access-boundary.md`. **Every Work Order declares
  `private_surface`, mandatory even when `none`.**
- **Shopping content is not a privacy matter** (GL-009), including the migrations encoding it. Only
  secrets stay out of the repo. **Do not widen "private" to mean "anything concerning a household."**
- **Permanently human-controlled, and no change of runtime touches them:** never auto-substitute ·
  never book a slot · never check out · never pay · never enter the ASDA password · `checked_out`
  stays false, enforced as a SQL literal.
- **A real reduction in mechanical guarantee, stated rather than glossed:** the CDP runner enforced
  the substitution ban in three independent code layers. **Sonnet in Chrome has none** — the boundary
  there is instruction and supervision. That is why the live pass is supervised and stops at
  checkout-ready.
- **Recovery boundary — the honest one.** Durability is **claimed nowhere in this build**. Restart
  and resume are proven only over an in-memory object graph. Until phase 2 lands, **recovery from
  process death is unproven, not partial.**
- **Ownership:** Larry owns implementation sequencing, integration and all reversible technical
  decisions, and the entire git lifecycle. Warwick retains genuine product decisions, consequential
  external actions and merge-to-main. **The specialist defines domain correctness; engineering
  implements.**

## 8. ACCEPTANCE EVIDENCE — what counts, and what has been produced

**Canonical record: `Builds/BUILD-015-.../ACCEPTANCE-AND-EVIDENCE.md`. Assurance receipts:
`Builds/BUILD-015-.../Assurance/`. Neither is restated here.**

Five assurance receipts exist *(re-enumerated 2026-08-08 — the 2026-08-04 version of this table
said four and went stale exactly as predicted)*. **Enumerate the directory rather than trusting
this table:**

| Receipt | Head reviewed | Verdict |
|---|---|---|
| `veritas-wp-red-suite-recovery-0f8a1bc.md` | `0f8a1bcd715ac04833534bf014a15563f3df9dff` | **HOLD** |
| `veritas-wp-red-suite-recovery-0f8a1bc-provenance-addendum.md` | same | isolation PROVEN, **HOLD stands** |
| `veritas-gate3-governance-ecfb04b.md` | `ecfb04b8b6d5173ffa68b318baf2c3a97c0dd040` | **HOLD** — 11 defects, 5 HIGH |
| `veritas-gate3-documentation-d63668f.md` | `d63668f653e233a22b5a28b6eb60f5fb84ecce48` | **HOLD** — 9 defects, 3 HIGH |
| `veritas-gate3-truth-94f135f.md` | `94f135f` (the second Gate 3 discharge commit) | **HOLD** — documentation truth rose from FAIL; `D-G3-21`–`24` named, never corrected; `D-G3-26` is an open Warwick decision. **This is the live Gate 3 receipt, and it reviewed the 2026-08-04 document state — HISTORICAL EVIDENCE about that boundary; its standing after the 2026-08-08 reconciliation is a deferred-verification item, not silently discharged** |

**The finding-level accounting — severities, which findings fell outside the dispatched scope, and
the disposition of each — is in `Deliverables/NEXT-ASDAIR-SESSION-brief.md` §"THE VERITAS POSITION".
It is not repeated here. The receipt itself is the register.**

**The evidence bar this build is held to, learned the hard way:**

- **A green suite is not evidence a caller exists.** Five separate builders reported "zero production
  callers" about their own work in one night.
- **A join is only proven when deleting it turns the suite RED.** D1's replacement protection clears
  that bar — Veritas reinstated the defect and got 17 failures.
- **A suite reporting zero executed subtests is a FAILURE, never a pass.** Read the count, never the
  exit code.
- **A skip is not a pass.** The 3 skips are the destructive Postgres tests.
- **Component passes do not answer the Gate 2 question** — *«Can Warwick now do the thing this phase
  promised, in the real intended context?»*
- **Larry may not record a phase PASS.** PARTIAL and FAILED are his; **PASS additionally requires a
  Veritas receipt against the exact integrated head.**

## 9. THE EXECUTION ROUTE — ⛔ SUPERSEDED 2026-08-08 as the directive route. HISTORICAL EVIDENCE + candidate future work.

> **⛔ This six-phase route no longer states what happens next.** Warwick's 2026-08-08 commission
> (`BUILD-015-PREJUMP-WAYFINDER-HANDOVER`) is later authority and sets a different first sequence —
> § "THE PREPARED POST-JUMP PHASE" is the one directive section. **What this section retains:** the
> six phases' *content* (repo/live reconciliation, durability, the injected journey, documentation
> truth, external acceptance) remains a truthful record of work BUILD-015 still plausibly needs, and
> the gate questions remain good questions — but **the order, the entry point and WHAT COMES FIRST
> are now decided by post-jump evidence through the prepared sequence, not by this table.** Phase 0's
> Gate 3 thread ended in the third HOLD (`94f135f`, see §8) with its corrections never made; that
> debt is carried in deferred verification, not silently discharged.

**Phased against assurance, not narrative progress.** Gate 1 = integrated Work Package · Gate 2 =
phase or vertical slice · Gate 3 = documentation and Git truth. **This table is the six-phase route
Warwick authorised on 2026-08-04** — see the authorisation block at the top of this map for the
quoted words, the provenance and the limits of that record. **His authorisation covers this table.
It does not extend to the map as a document, which he has not read.**

| Phase | Outcome | Gate | The question the gate answers | Status |
|---|---|---|---|---|
| **0** | Gate 3 documentation and Git truth discharged | Veritas Gate 3 | Does every active document agree with the code and with Git? | ~~IN PROGRESS~~ **THREAD ENDED UNRESOLVED — third HOLD at `94f135f`, corrections never made; debt carried in §10 deferred verification** |
| **1** | Repository and live database reconciled — migrations 013/014 authored as artefacts, the packet table contract settled | Gate 1 per WP | Does a fresh clone reproduce the live state? | Not started |
| **2** | Execution packet durable — 015 applied, producer wired to a real production caller, persistence and restart proven | **Gate 2** | **Can Warwick's plan survive a process death?** | Not started |
| **3** | Injected end-to-end journey green with duplicate, stale-answer, mutation and restart controls | **Gate 2** | **Photograph → correctly resolved, Brand A–Z, checkout-ready basket, in the real intended context?** | Not started |
| **4** | Documentation reconciled against the implemented journey; one clean PR; CI bound to the exact head | Gate 3 | Is what we say we built what we built? | Not started |
| **5** | Codex external QA within the three-pass maximum, then Pax's final product acceptance | External, then Pax | Would an independent party accept this? | Not started |

**No phase is marked PASS.** ~~Phase 0 is IN PROGRESS.~~ *(Re-cut 2026-08-08: Phase 0's Gate 3
thread ended in the third HOLD and this route is superseded as directive — see the banner above.)*

> **Phase 2's question is the one every green suite in this build has so far failed to answer.** The
> `RESUMABILITY` tests prove no state hides in the deps container; they prove nothing about process
> death. **No row has ever been written to Postgres by this journey.** Treat that as the standing
> risk of the whole build, not a phase-2 detail.

### What sits inside each phase

**Phase 0 — Gate 3.** ~~Current. Two rounds so far, both HOLD.~~ *(Re-cut 2026-08-08: THREE rounds
happened, all HOLD — the third at `94f135f` postdates this prose; see §8. The thread ended
unresolved and this section is historical evidence.)*

- **Round 1 — `ecfb04b8b6d5173ffa68b318baf2c3a97c0dd040`, HOLD, 11 defects, 5 HIGH.** `D-G3-01`
  through `D-G3-07` were the correction set; `D-G3-08` through `D-G3-11` were recorded for
  disposition. Corrected at `d63668f`, and **the receipt records `D-G3-03`, `-04`, `-06`, `-07` and
  `-11` as genuinely discharged.**
- **Round 2 — `d63668f653e233a22b5a28b6eb60f5fb84ecce48`, HOLD, 9 defects, 3 HIGH. This is the live
  HOLD.** Documentation truth FAILED a second time: the sole directive document stated a next action
  already complete at the head carrying it (`D-G3-12`), a Warwick authorisation was asserted that the
  estate held no record of (`D-G3-13`), and a remediation was recorded as done that had never been
  written into the artefacts (`D-G3-14`). `D-G3-15` through `D-G3-20` follow. **All nine are assigned
  to `WO-2026-08-04-05`.**

**The receipt is the register of findings — there is no findings ledger and none is to be built.**
Dispositions live in the `veritas_findings` block of the Work Orders under
`Builds/BUILD-015-.../Work Packages/`.

**Phase 1 — repository/live reconciliation.** The remaining D5 documentation classes: **classes 4–8
are outstanding; the verified per-class evidence table is in `NEXT-ASDAIR-SESSION-brief.md` §D5** and
is not copied here, because it goes stale item-by-item inside this phase. Then migrations 013 and 014
as repository artefacts under the settled GL-009 classification, and the packet table contract.

**Phase 2 — durability.** Migration 015 per Silas's recorded schema decision. **Verify the producer's
actual database role before any live application** — the highest-risk unknown in the sequence. Wire
the execution-packet producer into the real production pipeline; **persisting it without wiring it
produces a durable store nothing writes to.** Then prove persistence, read-back and restart against
the strongest safe environment available.

**Phase 3 — the journey.** Photo → interpretation → planning with rules and prior answers consulted
**before** questions → question cards → answers → persistence → packet (Brand A–Z) → handoff → basket
observation → reconciliation → `basket_ready`, with duplicate, stale-answer, mutation and restart
controls. Also in this phase: Keel's delivery half of the Codex closure-enumeration package through
the existing Tower routes.

**Phase 4 — documentation and Git truth.** Reconcile documentation against what was actually
implemented; one clean PR against `main`; CI evidence bound to the exact head, checked **per
workflow** — an unrun workflow vanishes from run lists and looks exactly like a green one.

**Phase 5 — external acceptance.** Codex external QA within the three-execution maximum, then Pax's
final BUILD-015 acceptance. **Pax is a different hat, not a different model:** report its verdict as
independent review by the same model, never as external verification. Merge-to-main is Warwick's
`merge-decision`.

## 10. THE PREPARED POST-JUMP PHASE — the one directive section of this map

**Prepared 2026-08-08 during BUILD-020 Sub-phase 4E. ~~It becomes ACTIVE when the Build switch to
BUILD-015 completes~~ — the switch COMPLETED 2026-08-08: the 4E preparation merged (PR #99, reviewed
head `0511c0a`), convergence was proven, BUILD-020 parked at its 4F return frontier, and BUILD-015
is the ACTIVE Build. THIS SECTION IS LIVE.** (Commission mirror §21–§22.) Implementation still
begins only after the prepared sequence below reaches Warwick's decision at step 5.

### The phase and its gate question

**Phase: GROUNDED RECOGNITION — the first post-jump mission** (Warwick, 2026-08-08):

> **Establish whether Mum's exact photograph can be interpreted safely, catalogue-grounded and
> without Larry, and identify the earliest still-broken link in the real photo-to-checkout-ready
> journey.**

**The gate question this phase must answer:** *Can Mum's exact photograph reach a safely resolved,
catalogue-grounded interpretation with no Larry in the execution path — and what, from executable
evidence, is the earliest link in the journey that still cannot happen in production?*

### 🎯 THE ONE CURRENT NEXT ACTION — merge-first EXECUTED; shop 6 recovered live 2026-08-09 00:41:55. **Veritas Gate 2 = HOLD.** Next action: Warwick rules on §11 row 7, then D1-corrected branch converges; the §12 handback proceeds regardless.

> **⚠️ COMPLETION IS NOT CLAIMED, AND VERITAS GATE 2 RETURNED `HOLD`.** Larry does not grade his own
> work. What follows is the acceptance EVIDENCE from the real production event; the grading is
> Veritas's and it is recorded below.
>
> **GATE 2 VERDICT: `HOLD`** — receipt
> `Builds/BUILD-015-.../Assurance/veritas-gate2-b15-1-live-journey-d907350.md`,
> `receipt_sha256 465e084544647befe7972dc11606f865aae3013926d1339d62685f05f6127255`.
> **§11 graded line by line: 9 PASS, 6 HOLD, 0 FAIL.** HOLD on: callback resolution (row 6) ·
> `needs_review` (row 7) · exact-source identity (row 10) · wrong-week comparison (row 11) · restart
> across a pending confirmation (row 12) · completed automation.
>
> **One HIGH blocking defect, and it is against LARRY, not the product — `D1`:** the earlier wording
> of this very section misattributed Warwick's own §11 acceptance criterion to Larry and retired it
> on that basis. **Corrected in place at observation 2 below.** Veritas's reason for HOLD rather than
> FAIL, verbatim: *"Not FAIL overall, because you did bank it as COMPLETION IS NOT CLAIMED — that
> honesty is precisely why this is HOLD."*
>
> **QUEUE EFFECT, per the receipt.** The HOLD gates the WP-B15-1 completion claim, the phase PASS,
> and **convergence of the acceptance-record branch in its ORIGINAL wording**. It does **NOT** gate
> the live runtime, shop 6's onward progress, or the § 12 handback — *"that should go, carrying these
> findings."* **Break 8's classification moves only on a discharged receipt, not on this record.**
>
> **§11 ROW 7 — RULED BY WARWICK, 2026-08-09. He accepted the substitute and AMENDED his own
> criterion.** The amendment is his, and it is recorded verbatim at observation 2 below.
> **It resolves row 7 ONLY.**
>
> **⚠️ THE OVERALL GATE 2 VERDICT REMAINS `HOLD`.** Warwick, verbatim: *"This ruling resolves §11
> row 7 only. It does NOT convert Veritas Gate 2 overall from HOLD: rows 6, 10, 11 and 12 retain
> their own evidence requirements/findings."* **Rows 6 (callback resolution), 10 (exact-source
> identity), 11 (wrong-week comparison), 12 (restart across a pending confirmation) and completed
> automation are unchanged and still HOLD. No completion claim exists.** The line above reading
> "6 HOLD" is superseded only as to row 7; five HOLDs stand.

#### THE LIVE ACCEPTANCE EVENT — executed evidence, 2026-08-09

**The route Warwick decided on 2026-08-09 ran end to end.** PR #100 → CI on the exact head →
Tower-visible Codex via `mergeCheck.mjs` (APPROVE, zero findings, three executions of three) →
Warwick's merge → merge commit **`d907350`** → **explicit** canonical runtime start → real card →
real tap → recovery.

| Step | Evidence | Time (local) |
|---|---|---|
| Merge | `d907350`, expected-head guard matched reviewed head `b4b37d8` | 00:37:41 |
| Canonical checkout | fast-forwarded, zero untracked paths; all 18 changed source files hash-match merged `main` | 00:38 |
| **Explicit** runtime start | scheduled task started by hand — **not** assumed from the logon trigger; `launcher_spawn` entry `C:\Fusion247PKA\services\asdair\pipeline\runtime.js`, PID 3704 | 00:38:40 |
| Lineage | process start **59 s AFTER** the merge commit; entry path in the canonical checkout | 00:38:40 |
| Card queued | `pipeline_command` id 21, `kind=outbox`, `confirm_interpretation` — **by the runtime, not by Larry** | 00:38:45 |
| Card delivered | `status=done`, `attempts=1`, `last_error=null`, `result={"note":"sent"}` | 00:38:46 |
| **Warwick's tap** | `pipeline_command` id 22, `kind=command`, `confirmInterpretation` — **the first confirm command in this system's entire history** | 00:40:51 |
| Gate cleared + replan | `shop_event` transition `PROCESSING → READY_TO_SHOP`, description *"every line is resolved"* | 00:41:55 |
| Shop 6 recovered | `plan_ready` card queued and sent (`pipeline_command` id 23, `done`) | 00:41:56 |

**Self-healing proven, not asserted.** Shop 6 had been parked silently at the interpretation gate
since **2026-08-03** — five days, every question answered, not one event. No row was inserted, no
manual database command was issued, and the durable state was not restarted. The new code met the
already-parked shop on its **first pass** and produced the card. That is the `outboxEverQueued`
self-heal path in `runPipeline.js:462` doing exactly what its comment claims.

**No Larry in the execution path.** Larry started the runtime — an acceptance step Warwick made
explicit — and touched nothing in the journey afterwards. Every subsequent row was written by the
runtime.

#### Defects and corrections observed AT the acceptance — recorded, not smoothed

1. **`answerCallbackQuery` rejected: "query is too old and response timeout expired or query ID is
   invalid".** Emitted as `tap_failed`, which then failed the whole pass (`pass_failed`, passes 2
   and 4). **Consequence for the human: Warwick's button never confirmed visually, so he tapped
   roughly four more times.** **The latch held: four tap batches produced exactly ONE
   `confirmInterpretation` row and zero duplicates**, and the offset advanced each time, so passes
   resumed cleanly once taps stopped. The durability design absorbed the defect; the UX is still
   wrong.

   > **CAUSE — PARTLY ESTABLISHED by Veritas Gate 2, 2026-08-09. This supersedes the "CAUSE
   > UNESTABLISHED / double-poller candidate" wording that stood here.**
   >
   > **The mechanism is in `services/asdair/pipeline/runtime.js:285-298`:** `bot.answerTap(...)` sits
   > **inside the same `try` as `commands.dispatch(...)`**, so a command that SUCCEEDED still gets
   > logged `tap_failed` and pushed onto `refused` when only the acknowledgement failed. The `catch`
   > then calls `answerTap` **again, unguarded** — and that second throw escapes `routeTaps` and
   > kills the whole pass. That is why a successful confirmation produced a failed pass.
   >
   > **And the defect is HISTORIC, not new.** `tap_failed … query is too old` recurs throughout
   > `runtime.log` under actions `build`, `retry` and `answer`, **weeks before this WP existed.**
   > **The tap acknowledgement has apparently NEVER worked in this system.** WP-B15-1 did not
   > introduce it; it is the first work to put a human in front of it.
   >
   > **The double-poller candidate is now a CONFIRMED LIVE CONDITION but still NOT a proven cause:**
   > ShopperBot `server.js` PID 14376 has held `shopper.env.txt` + `asdair.env` since 2026-08-08
   > 21:55. To be the cause it would have to explain the entire history above, and that has not been
   > shown. **Do not write it up as the root cause.**

1a. **Larry UNDER-claimed the automation, and Veritas corrected it upward.** `\MyPKA-AsdAIr-Runtime`
   is **Enabled**, trigger **At logon time**, last run 00:38:25, result 0 — the mechanism exists and
   is not absent. **But `Logon Mode: Interactive only` means an unattended reboot serves nobody**, and
   this session's start was a hand start. Under § "Nothing may live only in Larry's head",
   **Completed automation is HOLD — not absent, not satisfied.**

1b. **§11 rows 10 and 11 can NEVER be closed by one more shop, and this is recorded so it is not
   rediscovered.** Shop 6 predates fingerprinting and cannot prove either. The **first** fingerprinted
   photo shop proves row 10 (exact-source identity visible) **only**; row 11 (wrong-week comparison
   visible) additionally requires a **SECOND** one to compare against. Two future shops, minimum.

1c. **Open thread, mechanism unverified within the Gate 2 ceiling:** the Telegram offset advanced
   `171031136 → 171031140` across a pass that **failed**. It bears directly on §11 row 12 (restart or
   recovery must not lose a pending confirmation) and is not closed.
2. **`needs_review` remains `true`. §11 row 7 — AMENDED BY WARWICK, 2026-08-09, and thereby
   RESOLVED.** *(His amendment is quoted in full at the end of this observation. The correction
   block immediately below is LARRY'S record of Larry's own failure and is not part of his ruling.)*

   > **⛔ CORRECTED 2026-08-09 after Veritas Gate 2 defect D1 (HIGH, blocking). The previous wording
   > here was FALSE and it was self-serving.** It read: *"Warwick's route said 'observe `needs_review`
   > clear'; that phrasing originated in Larry's own framing and was wrong about the design."*
   >
   > **Warwick wrote that criterion himself, twice, on two separate days** — `2026-08-08-asda-build-002-SOURCE.md:300`
   > (§11 of his acceptance list) and `2026-08-09-warwick-route-decision-merge-first-SOURCE.md:37`
   > (his route decision, mirrored verbatim under the heading *"Nothing has been added, reordered or
   > paraphrased"*). **It appears in no Larry-authored artefact** — not the proposed ASWP, not the
   > Work Order. Verified by Veritas, then independently re-verified by Larry by execution.
   >
   > **What the earlier wording did:** it reattributed one of Warwick's acceptance criteria to Larry,
   > and then discharged the criterion on the strength of that false attribution — inside the very
   > document that orients the next session. **That is the attribution rule in root `CLAUDE.md`
   > § "Amendments — attribution and reconciliation" broken in the mirror-image direction:** the
   > canonical failure is Larry's conclusion appearing under Warwick's name; this was Warwick's
   > ruling appearing under Larry's, which is worse, because it let Larry retire his own gate.

   **The facts, stated without the excuse.** `commands.js:145-148`: the flag is set at the one moment
   it can be, creation, and *"there is no writer for `needs_review` afterwards — shopStore's UPDATE
   allowlist is (status, last_error, list_id) precisely so progressing a shop can never rewrite what
   arrived."* The gate is in fact cleared by `everIssued(snapshot, COMMANDS.CONFIRM_INTERPRETATION)`
   (`runPipeline.js:434-437`), not by the flag. Shop 6 is `READY_TO_SHOP` with `needs_review=true`.

   **So the criterion as written cannot be met without a design change, and the status transition is
   a SUBSTITUTE for it.** Larry made that substitution silently, which is what `D1` is about.

   > ### AMENDMENT — Warwick, 2026-08-09. §11 row 7. **His words, verbatim.**
   >
   > > **"I ACCEPT THE SUBSTITUTE.**
   > >
   > > The original §11 criterion "needs_review clears" was mine. Larry did not originate it and had
   > > no authority to retire or substitute it without asking me.
   > >
   > > I now amend that criterion because the shipped data model establishes that `needs_review` is
   > > an immutable arrival/provenance fact, not the live state of the interpretation-confirmation
   > > gate.
   > >
   > > **DO NOT add a writer merely to turn `needs_review` false.**
   > >
   > > §11 row 7 is replaced by:
   > >
   > > *"The interpretation-confirmation gate clears durably after the real human confirmation,
   > > evidenced by the durable `confirmInterpretation` latch and the shop subsequently
   > > replanning/progressing beyond `wait:interpretation_confirmation`. `needs_review` may remain
   > > true as the immutable record that the shop originally arrived requiring review."*
   > >
   > > Shop 6's PROCESSING → READY_TO_SHOP transition after my Telegram confirmation is acceptable
   > > evidence for this amended criterion.
   > >
   > > This ruling resolves §11 row 7 only. It does NOT convert Veritas Gate 2 overall from HOLD:
   > > rows 6, 10, 11 and 12 retain their own evidence requirements/findings."
   >
   > **⛔ STANDING PROHIBITION, from that ruling: no writer may be added merely to turn
   > `needs_review` false.** Anyone tempted to "fix" the flag is doing the opposite of what Warwick
   > decided — it is provenance, not state.

   **LARRY'S RECORD, not Warwick's words.** Row 7 is satisfied on the amended criterion by the
   evidence already banked above: the durable `confirmInterpretation` latch (`pipeline_command` id
   22, actor `telegram:8601328832` — a real Telegram principal) and the `PROCESSING → READY_TO_SHOP`
   transition at 00:41:55 carrying the shop beyond `wait:interpretation_confirmation`. **Row 7 only.
   The overall Gate 2 verdict is still HOLD** and no completion claim exists.
3. **`pipeline_command` id 22 remains `status=pending`.** Consistent with the documented design —
   *"A LATCH, not a queue entry: once issued it stays true for this shop, so the runner consuming it
   cannot re-close the gate"* (`commands.js:213-231`). **Honest limit: no writer that marks it `done`
   was located.** Non-blocking; recorded once.
4. **The learning loop wrote nothing, and the feared failure did NOT occur.** The watch item was that
   gate-clear → replan fires the first-ever live `recordAnswerLearning` writes, whose writer parks the
   shop FAILED on any error. **The shop did not park FAILED.** It also learned nothing: `rule_qa_log`
   still holds 5 rows with a newest timestamp of **2026-07-20**. This corroborates Pax's banked
   household-knowledge audit and the `runPipeline.js:581` `applies_going_forward: false` finding.
   **Next slice, and explicitly not touched here** (Warwick, 2026-08-09, boundary 8).

#### ⭐ THE § 12 HANDBACK — Warwick's four rulings, 2026-08-09. **This supersedes Larry's "durable human learning / intent promotion" phrasing, which was too narrow.**

**Warwick's product picture, his words:**

> **"Recognition can work. Confirmation can work. Shop recovery can work. But AsdAIr still does not
> reliably learn from either your answers or the final basket for next week."**
>
> **"And that latter half is bigger than Larry's current phrase 'durable human learning / intent
> promotion'. It is really DURABLE HOUSEHOLD LEARNING BETWEEN SHOPS — with at least two distinct
> inputs: human decisions and the confirmed basket/catalogue delta."**

**RULING 1 — Veritas Gate 2 is authorised and bounded.** It grades the real journey outcome at the
merged product boundary `d907350`, against the Asda Build 002 §11 acceptance list. **It does NOT
re-review Keel's source**; Gate 1's PASS stands and is not reopened.

**RULING 2 — the next-learning recommendation is AMENDED. There are TWO durable learning contracts,
not one, and they are to be established SEPARATELY.**

> **Flow A — question/decision learning:** *"answered ambiguity becomes future household knowledge."*
>
> **Flow B — confirmed-basket catalogue learning:** *"final reconciled ASDA basket is compared with
> the current household catalogue → genuinely new accepted products are identified → appropriate new
> products are favourited on ASDA → Regulars/Favourites delta is observed → useful product
> identity/provenance is persisted into Supabase → next week Terra receives the enriched catalogue
> before looking at Mum's photograph."*

**Warwick's binding constraint on how this is worked:** *"I would not yet assume the exact fix or
merge both mechanisms into one giant WP. First establish the two learning flows separately and their
earliest broken points."* **No Work Package is written until that establishment is done.** Flow B
must appear explicitly in §12 — it had been absent.

**Supporting evidence already banked for Flow B being unhealthy, per Warwick:** the later regulars
enrichment was **Larry-mediated**, and the live catalogue has **no genuine Favourites population**.
Recorded as supporting evidence, **not** as a settled diagnosis.

**Evidence already banked for Flow A being broken:** `runPipeline.js:581` hard-codes
`applies_going_forward: false` in `stepReplan`'s `recordAnswerLearning` call, so every answer the
live pipeline records is permanently ineligible to become a standing rule — verified against two
independent consumers, **cause UNESTABLISHED**, and distinct from the `stepInterpret` call site where
the same literal *is* legitimately justified. Observed live on 2026-08-09: the gate-clear replan
wrote nothing, and `rule_qa_log`'s newest row remains 2026-07-20. Sources:
[[Deliverables/2026-08-09-pax-browser-method-recovery-audit]] §B.1 and
[[Deliverables/2026-08-08-pax-supabase-household-knowledge-audit]].

**RULING 3 — the browser correction is RECORDED; the browser work is NOT reopened tonight.** Pax
proved the cancellation premise false — the repository did corroborate a real 25-item bulk operation,
twice, before the ruling. **That changes the evidential record, not tonight's WP.** Correction
applied at `Builds/BUILD-015-.../RUNTIME-DECISION.md` §"Open considerations" item 3. The
search-fallback disagreement is banked there as item 4, an **unresolved product-method decision** for
Warwick.

**WHAT THE § 12 HANDBACK CARRIES FROM GATE 2 — Warwick, 2026-08-09: *"Carry the Gate 2 HOLD and the
remaining findings honestly into the § 12 handback."*** The handback is **not** a completion report
and must not read as one:

- **Veritas Gate 2 = `HOLD`.** §11 row 7 resolved by Warwick's amendment; **rows 6, 10, 11, 12 and
  completed automation still HOLD.** No completion claim for WP-B15-1 exists.
- **`D1` (HIGH) stands against Larry** — the misattribution of Warwick's own criterion. Corrected,
  not erased.
- **The tap acknowledgement has apparently NEVER worked** (`runtime.js:285-298`; `tap_failed`
  recurring for weeks under `build`/`retry`/`answer`). **Not introduced by this WP** — this WP is the
  first work to put a human in front of it. It is a real product defect awaiting Warwick's
  disposition, and it is NOT folded into either learning flow.
- **Completed automation is HOLD, not absent** — `Logon Mode: Interactive only` means an unattended
  reboot serves nobody.
- **Rows 10 and 11 need TWO future fingerprinted shops**, not one, and cannot be closed by shop 6.
- **Open thread:** the Telegram offset advanced across a failed pass, bearing on row 12; mechanism
  unverified.

**RULING 4 — housekeeping happens only AFTER Gate 2, in this order.** Keep the acceptance-record
branch `build-015/wp-b15-1-acceptance-record` **alive** → place the Veritas receipt **on it** →
converge that evidence to `main` → **only then** decommission the merged working branches.
Warwick's reason, verbatim: *"No reason to throw away the evidence branch before the examiner has
signed the paper."* **`build-015/grounded-recognition` is NOT deleted yet.**



> **AMENDMENT — Warwick, 2026-08-09.** Verbatim ruling, mirrored at
> [[Deliverables/2026-08-09-warwick-route-decision-merge-first-SOURCE]]:
>
> > "Do NOT take option (a′). Do NOT install `node_modules` into `C:\Fusion247PKA-b15` merely to
> > resurrect the special acceptance launcher. Do NOT engineer around the failed worktree runtime
> > path. Proceed MERGE-FIRST, with one amendment: **The post-merge canonical runtime start is now
> > an EXPLICIT acceptance step. Do not assume the logon-triggered scheduled task will restart it.**"
>
> **The decided route, in order:** `build-015/grounded-recognition` → ONE PR to `main` → establish
> CI truth on the EXACT PR head → Tower-visible Codex merge-check via the canonical `mergeCheck.mjs`
> route → Warwick `merge-decision` → merge → **explicitly start/restart the canonical AsdAIr runtime
> from `C:\Fusion247PKA`** → prove by execution that the running process consumes merged canonical
> bytes → shop 6 reaches the new confirmation surface → real ShopperBot card → real Warwick tap on
> "Confirm this reading" → observe `needs_review` clear / replan / resulting shop state → §12 handback.
>
> **Warwick's boundaries on this route (his numbering):** (1) Veritas Gate 1 is already PASS on this
> WP boundary — **do not reopen Veritas** absent a material executable change. (2) There is no open
> PR; create the ONE BUILD-015 PR. (3) Establish CI on the exact PR head; **the known AsdAIr
> integration failure is INHERITED BASELINE — no CI-repair side quest** to make this WP look green.
> (4) If the canonical merge-check route can distinguish the inherited failure and proceed
> legitimately, use it. (5) **If `mergeCheck.mjs` hard-requires green CI and blocks on the inherited
> baseline: STOP and hand Warwick that exact gate.** No bypass, no bare `reviewDiff.mjs`, no silent
> redefinition of the assurance rule. (6) **Codex must be Tower-visible through `mergeCheck.mjs`** —
> the prior route-selection recurrence is already banked as 4F evidence; do not repeat it. (7) After
> merge, **do not assume runtime activation**: establish the canonical merged SHA, the runtime
> process start, the runtime source/cwd/launcher lineage as far as executable evidence permits, and
> that the new card code is genuinely live. (8) **Next-slice findings are not touched yet** — durable
> human learning / intent promotion, `substitutes_allowed` continuity loss, invariant-D candidate
> evidence, BOB, browser-shopping-method recovery. They belong in the §12 handback.
>
> **Larry's record, not Warwick's words:** the fresh-session bootstrap of 2026-08-09 established one
> operational fact the rotation record did not carry — **no AsdAIr pipeline runtime process was
> running at all** (only ShopperBot, PID 14376). The scheduled task `MyPKA-AsdAIr-Runtime` is
> **logon-triggered only** (`MSFT_TaskLogonTrigger`, 30 s delay; last run 2026-08-08 23:54:59,
> result 0). That is precisely why Warwick's amendment makes the runtime start an explicit acceptance
> step rather than an assumed consequence of merging. CI at the branch head was **failure**
> (`asdair-tests`, run 31281191826, 2026-08-08T22:13:29Z) — the inherited integration red.
>
> **Superseded by this amendment:** the "PENDING WARWICK'S CHOICE" framing below, option (a) and its
> still-live variant (a′), and the recommendation language. They are retained as the record of how
> the decision was reached. **Option (a′) is now PROHIBITED, not merely un-chosen.**

### ⛔ HISTORICAL — how the choice was framed at rotation, 2026-08-08 ~23:50. Settled by the amendment above. Directs nothing.

**Where the WP stands (everything below is banked and pushed on this branch):** source complete at
`7db899b` · Veritas Gate 1 **PASS** (all 8, mutation-tested) · **migration 016 APPLIED to the live
household DB** under Warwick's §3 authority (pre-notified, ding 424; schema proven read-only
after: `asdair_ro` SELECT-only, no UPDATE/DELETE for anyone) · both Pax audits banked · runtime
currently running CANONICAL MAIN bytes (restored; the card code is NOT live yet).

**THE BLOCKER, named honestly (`permission`):** the auto-mode classifier denies Larry starting the
acceptance runtime (a process start carrying secrets-store env-file arguments — twice denied;
worked around by NOTHING, per the guard's intent). **Warwick has two options, dinged to him
(425):**
- ~~(a) he runs the committed launcher script~~ **ATTEMPTED BY WARWICK 2026-08-08 ~23:53 — FAILED,
  mundane cause established:** the script killed the canonical runtime and the launcher then died
  before its first log line because **a git worktree carries no `node_modules`** — the branch
  worktree has Keel's source but not the installed dependencies. Nothing was corrupted; the
  canonical runtime was restored via the scheduled task (PID 10192, 23:55:16). *(The log's
  `wait:interpretation_confirmation` lines up to 23:50:52 are the OLD code's silent park — the
  pre-existing gate with no surface, exactly break 8 — not the new card code running.)*
- **(a′) still-live variant:** `npm install` (or `npm ci`) in the worktree's
  `services/asdair/{pipeline,pipeline-runtime,bot,intake}` packages, then rerun the committed
  launcher — same card-within-two-ticks outcome. Watch item unchanged: gate-clear → replan fires
  the first-ever live `recordAnswerLearning` writes, which park the shop FAILED on any error —
  honest acceptance evidence of the audit-predicted seam, not a card defect.
- **(b) NOW RECOMMENDED — "merge first":** Codex merge-check on this branch through the
  Tower-visible `mergeCheck.mjs` route → Warwick's `merge-decision` → merge → the scheduled task
  serves the new code from canonical `main` with its existing installed dependencies — no special
  start, no worktree deps, and the Tower conversation Warwick asked for becomes visible on the
  route that produces it.

**After the acceptance event (either route): the Asda Build 002 §12 handback** — WP outcome + real
evidence + both audit headlines + the next-slice recommendation (both audits point at durable
human learning / intent promotion over invariant-D retention; the going-forward act rides the new
card). **That handback is the next genuine product decision.**

**📄 SESSION REPORT — rotation 2026-08-08/09.** The payload describes session head `c4c0a41`; the
rotation-tail commits after it (payload banking, the launch-attempt record, Pax's report fold) are
part of this same rotation and the continuity packet names the true final tip.
- **Report:** [[Deliverables/2026-08-08-session-performance-report-b15-session]] — ✅ **LANDED
  BEFORE THE CLEAR and banked.** Executive CAPAE: **all four preventions held — the first
  all-clean session since the loop began** (`built-tested-never-activated` improved under its
  heaviest exercise; `record-amended-body-not-recut` second consecutive clean, PAX-awarded and
  folded via `capae-sync.mjs`). The one recurrence is outside the tracked families — the Codex
  route-selection/TowerBot class, already adjudicated by Warwick as 4F evidence. Two NEW family
  candidates proposed for Warwick's decision (never minted by script): `channel-healthy-route-not-called`
  and `session-meter-not-read-at-open`.
- **Payload:** [[Deliverables/2026-08-08-session-report-payload-b15-session.json]] · **Ledger:**
  [[Deliverables/2026-08-08-subagent-token-ledger-b15-session]] (A = 1,250,384 dedup; Larry's
  closing context level 582.9k/1000k separate) · **Order of record:**
  [[Deliverables/2026-08-08-wo-b15-01-order]].

### The standing fresh-session bootstrap — execution-based; it deliberately self-invalidates stale preparation assumptions.

**Nothing prepared before the merge may be trusted until this runs.** No SHA is written here — the
post-merge head cannot be known while this is being written, and hardcoding one is the failure this
map has already paid for three times.

```
git rev-parse HEAD                          # resolve current canonical main — the source authority
git status --porcelain                      # anything here is new work, not a BUILD-015 package
gh pr list --state open                     # never carry a PR list forward
ls Builds/BUILD-015-asdair-durable-household-shopping-steward/Assurance/
                                            # enumerate receipts; READ THE NEWEST ONE FIRST —
                                            # a HOLD names its correction set (D-G3-24's lesson)
gh run list --workflow=asdair-tests.yml --limit 1
                                            # CI truth PER WORKFLOW — an unrun workflow is not green
Get-ScheduledTask -TaskName "MyPKA-AsdAIr-Runtime"   # live activation state, verified, not asserted
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'"
                                            # which asdair processes run, from where, since when —
                                            # compare process START TIME against the newest asdair
                                            # commit: a process older than the source is executing
                                            # stale bytes and is DEPLOYMENT evidence, not truth
```

Then verify which 4E preparation assumptions survived: the seven-break classifications below, the
CI-red row in §2, and the live-runtime row in §2 were all established 2026-08-08 and **each names
its evidence so it can be re-established or falsified in minutes.**

### ⭐ ACTIVE SESSION WORK PACKAGE — WP-B15-1, items 1+2 (approved 2026-08-08)

**The prepared sequence below was EXECUTED AND DISCHARGED on 2026-08-08, in order:** step 1 the
bootstrap ([[Deliverables/2026-08-08-b15-bootstrap-evidence]]); step 2 Pax's bounded investigation
([[Deliverables/2026-08-08-pax-b15-grounded-vision-investigation]] — found break 8, the
interpretation-confirmation gate, verified live); step 3 the ONE proposed WP
([[Deliverables/2026-08-08-b15-proposed-aswp-01]]); step 4 Nolan CLEAR-WITH-OBSERVATIONS
([[Deliverables/2026-08-08-nolan-wp-b15-1-review]]); step 5 **Warwick's decision — WP-B15-1
items 1+2 APPROVED** ([[Deliverables/2026-08-08-asda-build-002-SOURCE]]).

**The active work is now WP-B15-1** — production confirmation surface (item 1) + exact-source
binding / wrong-week protection (item 2). **Binding acceptance is the real production event list
in Asda Build 002 §11** — live poller card → real Telegram delivery → real tap → gate clears →
replan → shop 6 recovers; restart-safe; no Larry and no manual DB command anywhere in the journey;
never reported complete because code exists. **Item 3 (candidate-evidence retention) is OUT,
recorded as leading candidate for the next slice.**

**IMPLEMENTATION POSITION, 2026-08-08 late:** Keel's Work Order `WO-2026-08-08-B15-01` (envelope
route, read-back held and accepted with the AC4 route-(a) amendment) returned COMPLETED —
integrated at `7db899b`, and **Veritas Gate 1 returned PASS on all eight requirements**
(independently re-executed 389 subtests; three capability mutations red-then-restored-green;
receipt: [[Deliverables/2026-08-08-veritas-wp-b15-1-gate1-receipt]]). **Recorded residuals (her
D1, non-blocking, discharged here):** (a) the card's `humanTime` renders UTC — the household is on
BST, so card times read an hour off local until a display decision is taken; (b) 7 pre-existing
env-shaped `skill` local test failures, identical pre/post, `skill/**` untouched. **The
old-brain→Supabase continuity audit is BANKED:**
[[Deliverables/2026-08-08-pax-old-brain-continuity-audit]] — stock preserved and enriched, flow
lost (the "never asked again" promise is structurally unmeetable; Ariel Pods re-asked live
2026-08-03), plus the F-fact that `substitutes_allowed=false` for ALL 103 regulars flattened the
old 9-of-36 allow-substitutes knowledge. Its §E recommendation: the next slice is durable human
learning / intent promotion, not invariant-D retention. Source-level ACs met with
builder self-evidence (pipeline 205/205, bot 156/156, intake 28/28 executed; surface secret scan
clean; migration `db/016_shop_source_image.sql` AUTHORED, NOT applied; `approve` action distinct
from the pre-existing `confirm`). **The live halves are explicitly NOT claimed** — the §11
production event (migration application under Warwick's §3 authority with pre-notification,
runtime restart, real card, real tap, shop 6 recovery) is the outstanding WP acceptance.

**The parallel Pax household-knowledge audit is BANKED:**
[[Deliverables/2026-08-08-pax-supabase-household-knowledge-audit]]. Headline: static knowledge
genuinely reaches Terra/recognition/planner (recognition is authentically grounded); **everything
the system should learn by operating is lost or inert** — shop 6's 11 answers produced zero
durable rows, the wired learning loop hard-codes itself ineligible (`applies_going_forward:
false`), the 106-key purchase-frequency view is read by nothing, and rule 10 cannot structurally
reach a decision point (never-BOB holds only by alias-curation accident on regular 4). **No
WP-B15-1 invalidation.** One acceptance watch item: gate-clear → replan fires the first-ever live
`recordAnswerLearning` writes, and that writer parks the shop FAILED on any error — first suspect
if acceptance stalls after the tap. **After the §11 event and Veritas: ONE handback to Warwick
(Asda Build 002 §12) — the next genuine product decision.**

### The prepared sequence — Warwick's commission §12/§23 — ✅ DISCHARGED 2026-08-08 (record retained)

1. **Fresh orientation / canonical bootstrap** — the first action above. Nothing else starts first.
2. **ONE bounded Pax investigation** — scope FIXED: grounded vision · exact source binding ·
   catalogue completeness · what Terra actually receives (one explicitly approved retained
   photograph only — if none exists, say so; never substitute another week's) · candidate-evidence
   loss · earliest still-broken product link. **Not another general AsdAIr audit.** The prepared
   question set is in the commission mirror §11 A–F, including the minimum recognition acceptance
   corpus (Gourmet cat food, Dreamies cheese, Weetabix Protein, Wall's sausage rolls, Arla milk,
   Mars/Milky Way, wrong-week control, and the structural cases).
3. **Propose ONE Active Session Work Package** targeting the earliest still-broken product link.
   **Larry-less catalogue-grounded recognition is the presumptive first gate unless executable
   evidence already closes it.** Wrong-week/source-image protection is included.
4. **ONE bounded Nolan review** — scope FIXED: accidental complexity · duplicated authority ·
   cargo-culted Proofline · framework regrowth · evidence that does not prove the visible outcome ·
   unnecessary platform/Cockpit work. Nolan does not redesign the product.
5. **Warwick decision.** Only then does AsdAIr implementation begin.

**Do not carry BUILD-020 specialist choreography into BUILD-015** unless this map actually calls
for it. Most future implementation lives in `services/asdair/**` behind stable interfaces; Cockpit
changes only when a real user-facing requirement requires them; no grand `server.mjs` refactor.

### Pax's seven broken links — classified 2026-08-08 from existing evidence, per the commission's four-value scale

**Scale: `OPEN` · `SOURCE FIXED — NOT LIVE` · `LIVE — NOT COLD-START PROVEN` · `FULLY CLOSED BY
EXECUTABLE PRODUCT EVIDENCE`. Closure is an executable product-evidence claim — never inferred from
module existence, tests, commit messages or docs.** Audit of record:
`Builds/BUILD-015-.../END-TO-END-PROCESS-AUDIT.md` (Pax, 2026-08-04). The shared live caveat for
every `SOURCE FIXED — NOT LIVE` row: **the live runtime process has run since 2026-08-03 21:31 and
predates every fix; no real shop has exercised any of them; no row of this journey has ever been
written to Postgres.**

| # | Pax's break (2026-08-04) | Classification 2026-08-08 | Evidence |
|---|---|---|---|
| 1 | Nothing sends a question card to Telegram — `sendQuestionCard()` had zero production callers | **SOURCE FIXED — NOT LIVE** | Wired into `pipeline/runtime.js` (commit `996a838`, suites recovered green at `24a731f`); enumerated caller verified 2026-08-08. Never exercised by a live shop |
| 2 | A button answer cannot be captured — live wiring passed `resolveCandidate: () => null` | **SOURCE FIXED — NOT LIVE** | `runtime.js:211–233` now hands real resolvers via `bot/resolveTap.js` (read 2026-08-08). Same live caveat |
| 3 | The execution packet does not exist | **OPEN** | The producer now exists (`packet/buildExecutionPacket.js`) and `handoff/buildHandoff.js` calls it — but **`handoff/` has zero non-test importers in all of `services/asdair/`** (enumerated 2026-08-08); `runtime.js` names `buildHandoff()` only in a comment. The production journey still cannot produce a packet. A tested module with no caller is not delivered |
| 4 | No basket writer | **OPEN** | The ruled writer is supervised Sonnet in Claude for Chrome (`RUNTIME-DECISION.md`); the handoff artefact it would consume is unreachable (row 3); no programmatic invocation surface exists, **deliberately** (`996a838`: "none was invented"). The CDP runner remains experimental and prohibited from live-account testing. No basket has ever been built by the ruled route |
| 5 | No basket-ready handback — nothing enqueues kind `basket_ready` | **SOURCE FIXED — NOT LIVE** | `basket_ready` is enqueued from `pipeline/runtime.js` at source (enumerated 2026-08-08) — but it sits downstream of rows 3–4, so it has never fired, and the live process predates it |
| 6 | The rulebook is not consumed — `info` rules discarded, exact-string matching, `rule_qa_log` never read | **SOURCE FIXED — NOT LIVE**, with a red flag | Rule-consumption workstream landed (`996a838`); tolerant matching in `skill/termMatch.js`; skill suite recovered green at `24a731f`. **Caveat that must not be dropped: `asdair-tests.yml`'s `integration` job — clean Postgres → schema → seed → `data.js` → `planner.js` — FAILED (AssertionError) at `eb03696`, 2026-08-08, the newest run on `main`. The full-path proof is red; root cause unestablished** |
| 7 | Answers do not survive the week — `promoteDecision` deliberately not wired | **SOURCE FIXED — NOT LIVE** | `promoteDecision` is driven from the outcome writers (`buildAnswerLearning.js`, `recordAnswerLearning.js`, `record-shop.js` — enumerated 2026-08-08); the learning-loop tests assert an answer this week prevents the question next week against the real planner. Never exercised by a real shop |

| **8** | **The interpretation-confirmation gate has no production surface** *(found by the Step-2 investigation, 2026-08-08 — absent from Pax's original seven because the 2026-08-04 audit enumerated module-caller wiring and this gate is correctly wired in code; the missing thing is the HUMAN surface)* | **OPEN** | Every photo shop is created `needs_review=true`; `planOutcome` refuses READY_TO_SHOP without `confirmInterpretation`; the Telegram adapter has no confirm action, live Cockpit proxies are read-only, and the only confirm UI is the non-running Directus `wp-d-proof` extension; the park writes no event and queues no card. **Verified live: shop 6 `needs_review=true`; zero confirm commands in `pipeline_command`'s entire history** |

**The honest summary a fresh session should carry** *(re-cut 2026-08-08 after Step 2)*: **zero of
the eight are closed by executable product evidence.** Five are fixed at source and (since the
bootstrap runtime alignment) now run in a live process for the first time — still unexercised by a
real shop; three (the confirmation gate, the packet chain and the basket writer) remain OPEN in
production terms. ~~The live runtime is executing pre-fix bytes.~~ *(Cleared at the bootstrap —
see the Live-runtime row above.)* **The earliest still-broken link IS now settled by execution:
break 8, the interpretation-confirmation gate** — the journey stalls there before the packet seam
can even be reached. The proposed WP targeting it:
[[Deliverables/2026-08-08-b15-proposed-aswp-01]] *(a PROPOSAL — active only on Warwick's Step-5
decision)*. Pax's full brief:
[[Deliverables/2026-08-08-pax-b15-grounded-vision-investigation]].

### Deferred verification — facts unknowable or deliberately not settled until post-merge canonical state

1. **Post-merge canonical `main` HEAD** — resolve by execution; never carry the 4E preparation SHA
   forward as current truth.
2. **`asdair-tests.yml` at the merged head** — does the integration red persist? Root-cause it
   (live candidate: migrations 013/014 absent from the repo — fog item 3 — so a clean Postgres may
   not reproduce live schema). *4E changed no asdair source, so the red is expected to persist; the
   workflow is path-filtered and may simply not run again until asdair changes.*
3. **Live database truth** — `live_authority: none` throughout 4E: the `sure`-variant conflict
   (fog 1), Arla BOB rule 10 (fog 2), applied-migrations list, `regulars.source` distinct values /
   Favourites (fog 5), the BUILD-002 test row (fog 6).
4. **Live runtime restart** — the running `runtime.js --watch` and ShopperBot processes predate
   current source. Whether and when to restart them onto canonical bytes is a **post-jump runtime
   decision taken inside BUILD-015 work with Warwick's visibility — 4E deliberately changed nothing
   live**, and this map does not claim live Cockpit or the live runtime has moved.
5. **Standing of the `94f135f` Gate 3 HOLD after this reconciliation** — its boundary was the
   2026-08-04 document state; this 4E reconciliation supersedes the map's directive layer and
   applies the receipt's `D-G3-23`/`D-G3-25` map corrections. Whether the residual findings still
   gate anything is for the next assurance boundary to state, not for this map to self-declare.
6. ~~Whether Warwick's merge of the 4E preparation has actually happened~~ **DISCHARGED 2026-08-08:
   the merge happened — PR #99 at reviewed head `0511c0a`; see the MAP ACCEPTANCE block above.
   Current canonical HEAD is still resolved by execution, never read from this map.**

### Parked documentation debt — recorded once, not chased (root `CLAUDE.md` finding-disposition)

- `SHIT-TO-DO.md:51` (row 11) — false consequence sentence about `secret-scan.sh` (`D-G3-21`; the
  receipt records the error as Veritas's own). Correct at the next authorised touch of that file.
- `SHIT-TO-DO.md:167` — self-contradicting "neither false sentence is reproduced" (`D-G3-22`);
  receipt supplies the corrected wording.
- `SHIT-TO-DO.md:49` — the same "four commits back" frame corrected in this map's §5.7 (`D-G3-23`).
- `D-G3-26` — receipts' CRLF digest mismatch on clean clone: **an open Warwick decision**
  (`.gitattributes` `eol=lf` pin for `Assurance/*.md`, or a template statement that digests bind to
  the blob). Should be taken before any external party verifies a receipt.

### ⛔ HISTORICAL — the 2026-08-04 exact next action (Phase 0 / Gate 3 resubmission). SUPERSEDED 2026-08-08. Directs nothing.

*The block below was the frontier while the Gate 3 thread was live. Its resubmission action was
overtaken: the third review happened (receipt at `94f135f`, HOLD), its corrections were never made,
and Warwick's 2026-08-08 commission then reset the route. The block is retained because its
discharge-test pattern — and `D-G3-24`'s one-clause repair, "if the newest receipt names the
immediately preceding head, read it first" — is folded into the bootstrap above.*

> ### THE EXACT NEXT ACTION — ⛔ SUPERSEDED
>
> **Submit the head that contains this line to Veritas for a Gate 3 re-review, and obtain the
> receipt that does not exist at it.**
>
> **Resolve the head; do not read it from here.** No SHA is written into this block, because the
> head that carries these words cannot be known while they are being written — that is precisely how
> the previous two next-actions went stale.
>
> ```
> git rev-parse HEAD          # this is the head to submit
> ```
>
> The submission carries `WO-2026-08-04-05`, which discharges `D-G3-12` through `D-G3-20` from the
> `d63668f` receipt, on top of the `WO-2026-08-04-01`…`-04` package already committed at `d63668f`.
>
> #### The discharge test — run this BEFORE acting, and believe it over this document
>
> ```
> ls Builds/BUILD-015-asdair-durable-household-shopping-steward/Assurance/
> ```
>
> **If that directory holds a receipt naming the head you just resolved, this action is already
> done and this map is behind the estate. Stop, read that receipt, and take your next action from
> its verdict** — a `HOLD` names its own correction set, a `PASS` opens phase 1. **If there is no
> such receipt, the action above is outstanding and is yours.**
>
> **Why it is written this way, so it is not "corrected" back.** An action of the form *"integrate
> the uncommitted package"* is **falsified by the very commit that carries it** — it describes work
> that the act of shipping it completes. This action is the opposite shape: **the commit creates its
> subject rather than discharging it.** A receipt for a head cannot exist at that head, so this stays
> true from the moment it is committed until a reviewer answers it.
>
> **The honest limit — this is a detector, not a fix.** Once the receipt exists, this block is stale
> like any other. The only thing bought is that **the reader can discover that unaided, in one
> command**, instead of acting on a stale instruction. **Nothing makes a map self-updating, and
> building something that would is exactly the regrowth the estate has already paid for once.** Do
> not add one.
>
> **Until that receipt exists, the maximum permitted statement is «Integrated at "\<SHA>" and
> submitted to Veritas for assurance.»** Not done, not complete, not ready.

~~**On `VERITAS_PASS`, phase 0 closes and phase 1 begins.** The six-phase route itself is authorised
(2026-08-04 — see the authorisation block at the top of this map). **The whole route remains
sequenced behind a Gate 3 PASS the estate does not hold.**~~ ⛔ **SUPERSEDED 2026-08-08 with the
block above** — the route and frontier are now stated once, at the top of §10.

**This is the only document permitted to state an exact next action.** If another document in
`Deliverables/` appears to state one, that document is the defect — see the precedence block above.

## 11. PARKED AND NON-GOAL WORK

**Parked tangents:** canonical in `Builds/BUILD-015-.../SHIT-TO-DO.md`. Not duplicated.
**Estate-wide items:** `Deliverables/BACKLOG.md`.

**Explicit non-goals, from the goal contract:** no shopping-platform redesign · no generic
agent-platform work · no broader cockpit changes · no new learning behaviour beyond the existing
design · no expansion of the specialist into an implementation engineer.

**Superseded and not to be revived as gaps:** **WO-C** (plan builder) is off the live-runtime critical
path, superseded in purpose by the Sonnet execution packet. **WO-D** (bulk add via the Regulars grid)
is cancelled as live-runtime work — it rested on a description of the proven process Warwick has
since corrected. Neither is deleted from the ledger; a fresh instance should see a decision, not a
gap.

**Deferred with the claim corrected rather than the capability pretended:** rule 7 (budget band) is
structurally unevaluable — no price column exists, so `budget_flag` is permanently `unknown`. The
rule is documented, implemented and dead. **Do not claim budget flagging works until a price source
exists.**

> ### THE REGROWTH CAP APPLIES TO THIS MAP
>
> **A Wayfinder map is a record. It is not an execution tracker, a ticket system or a governance
> layer.** BUILD-018 grew a validator → store → parser → registry around rules it never once
> enforced. **If the response to anything in this map is to build a mechanism, the diagnosis was
> rejected.** No new specialist, service, registry, validator, state machine or control plane.

## 12. RESUMABLE STATE AFTER `/clear` OR A FRESH SESSION

**Say these four things before touching a tool:**

1. **Recovered map** — `Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md` (this file).
2. **Goal** — `BUILD-015-END-TO-END-RECOVERY`: photograph → ShopperBot → checkout-ready basket, every
   gap closed, integrated, run and proven, with Larry outside the weekly operating path.
3. **Phase and gate** — **GROUNDED RECOGNITION, the prepared post-jump phase (§10), NOT STARTED**,
   active only once the BUILD-015 Build switch has completed. The historical Gate 3 thread ended in
   a third HOLD whose receipt is historical evidence — **enumerate `Assurance/` and read the newest
   receipt rather than naming a head from here.** *(Re-cut 2026-08-08; the previous text said
   "phase 0, IN PROGRESS, Veritas Gate 3, two receipts" — all three claims had gone stale.)*
4. **Exact next action** — **§10 → "THE EXACT FIRST ACTION"**: the execution-based bootstrap that
   re-establishes canonical state before anything prepared pre-merge is trusted.

**Then verify by execution, not belief:**

```
git rev-parse HEAD          # resolve it; every head named in this map WILL have moved
git status --porcelain      # see the warning below before reading anything into this
gh pr list --state open     # never carry a PR list forward
ls Builds/BUILD-015-asdair-durable-household-shopping-steward/Assurance/   # the live gate position
```

> #### ⚠️ THE DIRTY WORKING TREE IS NOT A BUILD-015 PACKAGE. DO NOT COMMIT IT AS ONE.
>
> *(Re-framed 2026-08-08: the checkout this block described — the deleted
> `build-015/live-acceptance-recovery-2026-08-03` working tree — no longer exists. The RULE stands
> on any checkout: entries `git status` returns are either new work needing their own attention or
> pre-existing strays; never sweep them into a BUILD-015 commit. The list below is the 2026-08-04
> inventory, retained as HISTORICAL EVIDENCE of the pattern.)*
>
> `git status --porcelain` in ~~this~~ that checkout returned **pre-existing, unrelated entries that
> belonged to no BUILD-015 work package** and were carried, untouched, across every Gate 3 review.
> As at 2026-08-04 they were:
>
> - `Team Knowledge/.obsidian/community-plugins.json`
> - `services/asdair/skill/planner.js` — **modified flag only; `git diff --numstat` is empty.** A
>   CRLF/LF artefact with no content change. Recorded in both Gate 3 receipts.
> - `services/hub/youtube/persistCapture.mjs`
> - `services/hub/youtube/watch-captures.mjs`
> - `Deliverables/2026-08-03-vlog-build-018-the-governor-episode-LARRY-FIRST-DRAFT-UNAPPROVED.md`
> - two Felix session logs under `Team Knowledge/session-logs/2026/08/`
>
> **No total is given here, deliberately.** A count drifts between the moment it is written and the
> commit that carries it — which is the same mechanism that produced `D-G3-12`. **Identify these by
> path, and treat anything else the command returns as genuinely new work needing its own
> attention.** An earlier version of this section glossed the output as *"four uncommitted packages
> were in flight"*; a fresh instance following it would have committed unrelated files as the Gate 3
> package.

**Two things that will mislead you if you skip them:**

- **The Honcho continuity brief is a POINTER, never the authority.** A stale brief must never
  override this map. Open the map and let it self-correct.
- **The `CLAUDE.md` injected at your session start may not be the file on disk** — see §5 item 7.
  **Read the file, do not trust the injection.**

**Before reading further into the build:** the operational hazards, the hard rules and the
do-not-rebuild warnings are in `Deliverables/NEXT-ASDAIR-SESSION-brief.md`. **Read it before touching
`services/asdair/**` — it is non-directive, and it will still save you a night.**
