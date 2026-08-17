---
name: BUILD-015 — AsdAIr, Mum's Autonomous AI Shopping Operator
owner: larry
authority: warwick
promoted: 2026-07-27
promoted_from: IDEA-012 (AsdAIr)
recut: 2026-08-17
recut_reason: Warwick's product ruling of 2026-08-17 replaced the supervised North Star with an autonomous agentic one
tags: [build, asdair, idea-012]
---

# BUILD-015 — AsdAIr, Mum's Autonomous AI Shopping Operator

> # ⚑ RE-CUT WHOLE — 2026-08-17, on Warwick's product ruling
>
> **This contract was RE-CUT, not amended.** Warwick's instruction, verbatim: *"Do not append another
> qualification to the old contract. Re-cut the contract itself so a fresh Larry cannot inherit the wrong
> architecture again."*
>
> **Everything a fresh reader needs is in THIS body.** The superseded clauses are named, quoted and struck
> in § "What this ruling supersedes, by name" below — they are recorded there so the change is auditable,
> **and nowhere in this file are they still stated as current.** If you find text anywhere in the estate
> that contradicts this contract, this contract is later and it wins; report the contradiction once.
>
> **Prior versions live in Git history** (`git log --follow` this path). History is a record, never an
> active alternative source.

A **Goal Contract**, not a scaffold, and not a design exercise.

---

## North Star — Warwick's ruling, 2026-08-17. His words are the contract.

> **AsdAIr is Mum's autonomous AI shopping operator.**

Mum supplies her normal input. **From that point AsdAIr owns the task end to end:**

```
Mum's input
  → understand it
  → use household history, catalogue, rules and prior decisions as context
  → inspect live ASDA where necessary
  → resolve products semantically
  → ask Warwick ONLY genuine shopping decisions that cannot safely be resolved
  → construct the intended shop
  → OPERATE the live ASDA browser
  → SEARCH FOR AND EVALUATE products it has never seen before
  → add the correct products and the correct quantities
  → reconcile the trolley against the intended shop
  → leave the correct trolley ready at the deliberate checkout/payment boundary
```

**The target weekly experience, and it is the whole product:** Mum gives her input. Warwick later receives
genuine questions if there are any, then *"Mum's basket is ready."* **Nothing technical in between.**

### Warwick is NOT an internal component

**Normal operation must NEVER require Warwick to:**

repair OCR or AI interpretation · give the photograph to Larry · copy manifests between agents · launch
Sonnet · run PowerShell or node · identify request ids · start workers · choose implementation routes ·
bridge internal components · diagnose failures.

**He may only be asked to:**

1. answer a **genuinely ambiguous shopping question**;
2. **review the finished trolley**;
3. **perform checkout and payment.**

Anything else asked of him is a **product defect in AsdAIr**, not an operational inconvenience.

### Larry is NOT part of the runtime

**Larry builds and operates AsdAIr. Larry is not part of the weekly shopping runtime.** Model calls go
through `FUSION_GATEWAY_URL`, never through a Claude Code session. A step that works only because Larry is
at the keyboard is not delivered.

---

## ASDAIR ITSELF IS THE WEEKLY SHOPPING RUNTIME — Warwick, 2026-08-17

**Larry is not the runtime. A Claude Code session is not the runtime. A manually launched Sonnet session is not the runtime. Warwick is not the bridge between components.**

**AsdAIr must be capable of operating independently of any open Larry session.** The falsifiable form, and it is the test: **if killing Larry's session prevents the normal weekly shop from progressing, AsdAIr has failed.**

### The normal control surfaces are Telegram/ShopperBot and the Cockpit

**They are AsdAIr CONTROL SURFACES, not notification channels back to Larry.**

- Mum submits her shopping input through the normal route.
- Warwick answers a genuine ambiguity through ShopperBot or the Cockpit.
- Warwick may amend the shop there — *"add two more milk"*, *"don't buy that"*, *"try the other one"*.
- **AsdAIr receives that instruction DURABLY and acts on it itself**, then resumes from it.
- When the basket is ready, **AsdAIr** tells Warwick through the normal surface.

**⛔ Larry must NEVER sit behind Telegram translating Warwick's messages into commands.**

### The target runtime route — no step may require an interactive session

```
normal product event (ShopperBot / Cockpit)
  -> durable AsdAIr state
  -> AsdAIr agent WAKES WITHOUT LARRY
  -> capable model invoked through the production model/gateway route
  -> model reads the shop, household context, rules, prior decisions and the original input
  -> model inspects live ASDA / browser state
  -> model reasons semantically about known AND unseen products
  -> browser tooling provides the eyes and hands
  -> correct products and quantities added
  -> trolley read back and reconciled
  -> genuine ambiguity -> Warwick, via ShopperBot / Cockpit
  -> AsdAIr RESUMES from his answer
  -> "Mum's basket is ready"
  -> Warwick takes over only at checkout / payment
```

### What counts as FAILURE — any one of these in a normal weekly path

Warwick giving the photo to Larry · Larry interpreting or repairing the shopping list · Warwick running PowerShell or node · Warwick identifying request ids · Warwick starting a worker · Warwick launching Sonnet · Warwick copying a manifest or prompt into another AI · **Larry receiving a ShopperBot message and manually acting on it** · a product without an existing ASDA id being impossible to buy · a capable model being unable to inspect live ASDA candidates · a browser step waiting indefinitely for somebody to remember to start it · progress depending on session-local state · **an open Claude Code / Larry session being required** · component PASS while the real weekly journey does not complete.

### What counts as SUCCESS — deliberately boring

Mum supplies her normal input. Warwick may receive genuine shopping questions through Telegram or the Cockpit and answers them there. Later he receives **"Mum's basket is ready."** Nothing technical happens through Warwick in between. The basket contains the intended products and quantities, **including previously unseen products that required semantic search.** He reviews it and performs checkout and payment.

### Next week's real shop is the acceptance of THIS RUNTIME, not of any component

- **Start it through Mum's NORMAL input route. Do not pre-stage it through Larry.**
- **Do not manually start hidden machinery to make the test pass.**
- **Do not repair the route during the acceptance and then claim the original route passed.**
- **Observe whether the production event causes AsdAIr itself to proceed**, and **explicitly test that no Larry session is required.**
- Telegram/Cockpit questions and amendments must enter AsdAIr directly and be consumed without Larry translating them.
- **A genuinely new item is a NORMAL case**, not an exceptional state, if one arises naturally in the route.
- **Acceptance ends only at a correctly reconciled real ASDA trolley.**

> **⚠️ The 2026-08-17 manual recovery is NOT the target architecture and NOT a precedent.** Larry reading Mum's photograph, hand-building the manifest, answering the question board and launching Chrome from a shell got Mum her groceries that week. **Every one of those steps appears in the failure list above.** Do not mistake the rescue for the product.

---

## AsdAIr must be AGENTIC — this is the architecture, stated positively

**The runtime is explicitly authorised to use a capable reasoning model in normal production.** Within its
domain it may:

- inspect the original image itself;
- inspect its own durable state;
- query catalogue, household history, rules and prior decisions;
- reason across all of them;
- use tools, search, and inspect live pages;
- compare candidates semantically;
- make ordinary shopping judgements;
- drive browser automation;
- recover from ordinary failures and retry;
- **choose its own execution mechanism.**

> **AI judgement is part of the product contract. It is NOT a fallback, NOT a degraded mode, and NOT a
> defect.**

**A previously unseen product is a NORMAL case, not an exception.** *"Wet body wipes for women"* or
*"Ben & Jerry's Cookie Dough"* with no stored ASDA id is something AsdAIr **resolves itself** — by searching
ASDA, inspecting candidates and judging them against known household identity. **Only when several
materially plausible choices survive reasonable inspection does it ask Warwick.**

> **AsdAIr should have, within its domain, the agency Larry has** — investigate its own state, reason,
> choose tools, recover from ordinary failures, and complete the goal without Larry orchestrating it.

---

## Implementation is subordinate to the outcome

**No mechanism in this estate is mandatory merely because it exists or because it was expensive to build.**

| Component | Standing under this contract |
|---|---|
| **Terra** (gateway vision) | **OPTIONAL.** A useful capability. Not the required reader of the photograph. |
| **CDP / `browser-runner`** | **OPTIONAL, and AUTHORISED.** The 2026-08-04 exclusion is lifted (see below). |
| **Sonnet in Claude for Chrome** | **OPTIONAL.** No longer the designated basket writer. |
| **Stored ASDA product ids** | **A USEFUL OPTIMISATION.** Never a precondition for buying a known household item. **See the ruling immediately below — the ASDA PRODUCT NAME is the identity.** |

### ⛔ THE ASDA PRODUCT NAME IS THE IDENTITY. THE PRODUCT ID IS NOT. — Warwick, 2026-08-17

> **His words, and he has said this repeatedly before tonight:** *"not all items have visible IDs — I keep telling you this — and we should be working off the ASDA item name. I don't give a fuck about product id, each ASDA description is unique."*

**Every ASDA product description is unique. That is the identity AsdAIr matches on.** A stored `asda_product_id` is a shortcut that makes a known item faster to add. **It is never what makes an item buyable, and its absence is never a reason a line cannot be shopped.**

**What this rules out, permanently:**

- **"No stored id" must NEVER block a line.** Tonight 16 of 37 lines were unbuyable for this reason alone, and **none of them was a new product** — they are ordinary household items Mum buys every week.
- **"Harvest the missing ids" is not the fix, and treating it as the fix is the recurring error.** It is a performance optimisation worth doing opportunistically. The estate has carried "45 regulars have no id" as a blocking problem **for weeks**, when the correct response was to match on the name.
- **A command surface keyed exclusively on `product_ref`** — as `browser-runner/commands.cjs` is — **makes the id load-bearing by construction.** That is an implementation choice that contradicted this ruling, and implementation is subordinate to the outcome. Any executor must be able to act on a line whose only identity is its ASDA name.

**The correct resolution order for any line:** stored id if present (fast path) → **otherwise search ASDA and match on the unique product description** → select when clear → abstain only on genuine ambiguity. **Harvest the id afterwards as a by-product, never as a prerequisite.**

*(Recorded here because this instruction has been given more than once and repeatedly failed to reach the implementation. If a future reader finds the estate again treating missing ids as a blocker, this clause is the answer and no new decision is required.)*
| Rules, catalogue, Supabase, execution packets, handoff artefacts, reconciliation | **SUPPORTING CAPABILITIES.** Kept where they serve the outcome. |

**Two structural rules:**

1. **A deterministic executor may perform mechanical browser actions UNDERNEATH an AI. It must never be the
   semantic decision-maker.**
2. **A browser-capable AI may do both halves if that is the best route.**

> **⛔ DO NOT PRESERVE A FAILED ARCHITECTURE FOR SUNK COST.**

**The single test for everything else, and it settles every argument this contract does not name:**

> ### *Does it help AsdAIr autonomously complete Mum's shop?*
> **If yes, use it. If no, remove it from the runtime.**

---

## The product boundaries — unchanged, deliberate, and not negotiable

**AsdAIr NEVER:** checks out · pays · books or changes a delivery slot · enters credentials ·
auto-substitutes.

`checked_out` stays `false`, enforced in SQL rather than by input. **Checkout and payment are Warwick's,
permanently.** *(What is no longer Warwick's is the supervised browser session — see the supersession
register.)*

---

## Acceptance — THE REAL WEEKLY SHOP. Nothing else counts.

**Acceptance is a real weekly shop run through the finished production system.**

**⛔ NOT acceptance, in any combination, however green:** component tests · synthetic browser runs · an
isolated Terra result · a CDP test · a handoff artefact · a passing suite · a manual invocation that
worked.

**A successful run, in full:**

| # | Acceptance requirement |
|---|---|
| 1 | **Mum's ordinary input** — her normal method, unmodified for the test |
| 2 | **No Larry in the runtime** |
| 3 | **No Warwick technical intervention** — see the "not an internal component" list |
| 4 | **Correct interpretation** of what Mum actually asked for |
| 5 | **Known AND previously unseen products both handled** by AsdAIr itself |
| 6 | **Warwick answers only genuine ambiguity** |
| 7 | **A live trolley built** in the real ASDA session |
| 8 | **Contents and quantities reconciled** against the intended shop |
| 9 | **Warwick takes over only at checkout** |

**And then repeatedly, in normal weekly use.** One good run is evidence; the product bar is the ordinary
week.

> **This clause is bound to root `CLAUDE.md` § "Nothing may live only in Larry's head."** An outcome
> intended to be automatic is not complete while any required production step depends on Larry
> remembering, an interactive shell, session-local state, a manual invocation, or Warwick reminding
> anyone. **Acceptance exercises the real production event.**

---

## What this ruling supersedes, by name

**Every clause below was ACTIVE text in this estate before 2026-08-17 and directly contradicts the North
Star above. Each is quoted so the change is auditable, and each is struck. None of them is current.**

### In this contract (removed from the body by this re-cut)

| # | Superseded text, quoted | Status |
|---|---|---|
| S-1 | *"The accepted acceptance bar — **SUPERVISED, not fully hands-off**"* | ⛔ **SUPERSEDED 2026-08-17.** The bar is autonomous operation to a checkout-ready trolley. |
| S-2 | *"**Fully hands-off shopping was descoped by Warwick on 2026-07-21** ('a HUMAN logs into Asda')"* | ⛔ **SUPERSEDED 2026-08-17.** That descope is reversed. Autonomous operation of the live browser is now **in scope and required.** |
| S-3 | Deferred / NOT-to-be-built list: *"A persistent external-LLM AsdAIr daemon; a fully autonomous planning daemon; **an unattended ASDA browser**; automated checkout; automated payment."* | ⛔ **PARTIALLY SUPERSEDED 2026-08-17.** **"An unattended ASDA browser" and "a fully autonomous planning daemon" are REMOVED from the deferred list — they are the product.** **Automated checkout and automated payment REMAIN permanently out of scope.** |
| S-4 | *"**The permanently human-controlled actions** — unchanged and not negotiable: **the supervised live ASDA browser session**, checkout, and payment."* | ⛔ **SUPERSEDED IN PART 2026-08-17.** **Checkout and payment remain Warwick's permanently. The supervised browser session does NOT.** AsdAIr operates the browser. |
| S-5 | *"the browser drive stays with Larry"* / *"Sonnet in Claude for Chrome builds the basket"* | ⛔ **SUPERSEDED 2026-08-17.** Neither Larry nor a Sonnet browser session is the designated writer. AsdAIr chooses its own execution mechanism, subject to the two structural rules above. |
| S-6 | *"AsdAIr is an **A+B hybrid**… (A) the deterministic planner drives unambiguous structured directives… (B) an LLM instance handles fuzzy judgement"* | ⛔ **RE-FRAMED 2026-08-17.** The split is retained only as an implementation option. **The AI is not the "B" helper attached to a deterministic core — it is the operator, and a deterministic executor sits underneath it.** |

### In `RUNTIME-DECISION.md` (struck at source in that file)

| # | Superseded text, quoted | Status |
|---|---|---|
| S-7 | *"**The Stage 1 live basket writer is Sonnet in Claude for Chrome**"* | ⛔ **SUPERSEDED 2026-08-17.** |
| S-8 | the CDP runner is *"**prohibited from further live-account testing without fresh authority from Warwick**"* and *"excluded from the live route"* | ⛔ **LIFTED 2026-08-17. Warwick has confirmed that exclusion was an INTERNAL ARCHITECTURE DECISION, not his, and has now AUTHORISED CDP.** |
| S-9 | *"**THERE IS NO PROGRAMMATIC SONNET TRIGGER HERE, AND THAT IS NOT AN OMISSION**"* *(stated in `services/asdair/handoff/README.md`, resting on `RUNTIME-DECISION.md` open consideration 2)* | ⛔ **SUPERSEDED AS AN ARCHITECTURAL CONCLUSION, 2026-08-17.** The factual observation stands — Claude for Chrome has no programmatic invocation surface. **The conclusion does not: under this North Star, a route that cannot be invoked by the system is DISQUALIFIED from the runtime.** An un-invokable route is not an honest compromise; it is a route that fails the contract. |

### In `services/asdair/handoff/README.md` (struck at source in that file)

| # | Superseded text, quoted | Status |
|---|---|---|
| S-10 | *"**What is still human, stated plainly:** starting the browser session, giving Sonnet the artefact, and the substitution pass before purchase."* | ⛔ **SUPERSEDED 2026-08-17.** None of those three is acceptable as the normal path. Starting the browser and driving it are AsdAIr's. The substitution pass is governed by never-auto-substitute plus the ask-Warwick rule, not by a standing human step. |

### In the Wayfinder `Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md`

| # | Superseded text, quoted | Status |
|---|---|---|
| S-11 | §1: *"**The accepted bar is SUPERVISED, not hands-off** (Warwick, 2026-07-28). Fully hands-off shopping was descoped 2026-07-21."* | ⛔ **SUPERSEDED 2026-08-17.** §1 re-cut in the same commit as this contract. |
| S-12 | §12 RESUMABLE STATE, dated 2026-08-11 | ⛔ **STALE AND REPLACED 2026-08-17** — superseded by the events of 08-13, 08-14, 08-15 and this ruling. **Replaced, not appended to.** |

---

## Provenance — unchanged facts

| | |
|---|---|
| Promoted from | **IDEA-012 — AsdAIr**, an operating capability that had been running real weekly household shops without a BUILD record |
| Promoted at | Fusion247PKA `87c7ff6` |
| Promoted on | 2026-07-27, by Warwick's explicit ruling |
| Why a BUILD number | Tower's merge-check requires `build_ref` matching `^BUILD-\d{3}$`; AsdAIr had no BUILD number, so its code could not be independently reviewed at all |
| Re-cut on | **2026-08-17**, by Warwick's product ruling. Governance head at re-cut: `fe3ab16` on `main` |

**The historical record is NOT duplicated here:**
`Deliverables/2026-07-27-nolan-asdair-specialist-assessment.md` ·
`Team Knowledge/SOPs/SOP-021-run-the-weekly-asdair-shop.md` ·
`services/asdair/skill/README.md` (the ten standing rules — canonical, never restated) ·
`services/asdair/db/001_asdair_schema.sql` ·
`Team/Asdair - Household Shopping Steward/AGENTS.md`.

---

## Why the old architecture failed — the diagnosis, recorded once so it is not re-learned

**Evidence from the real run of 2026-08-16/17:**

1. **The vision model invented a product.** Mum's *"2 sliced roast beef"* became *"2 skinny cow bars"* —
   the drift is beef → cow — while `ASDA Sliced Topside of Beef 90g` was sitting in regulars.
2. **Two distinct products were read as one.** *6pk Heinz baked beans* and *5pk Heinz sausage & beans*
   collapsed together, so a line vanished entirely.
3. **It is not only a reading problem.** On **clean, correct text** the deterministic matcher still left
   **10 lines unresolved**, including items present in regulars, **and ignored an active rule.**
4. **The only writer of an executable browser plan anywhere in the repo is
   `services/asdair/browser-runner/proofkit.cjs` — the PROOF HARNESS, seeding synthetic requests.**
   Every "proven" CDP run was hand-fed.
5. **`cdp.js` only ATTACHES.** Nothing in the estate ever launched Chrome. **One missing spawn** is why
   the browser step never started by itself. **Chrome was launched from the system on 2026-08-17 and CDP
   came up on the dedicated profile — that capability is proven and MUST be preserved.**

> ### The diagnosis
>
> **The capable model was engineered OUT of the loop and replaced by weak deterministic components, each
> certified in isolation.** `acceptance-proves-mechanism-not-outcome` recurred **three times in that one
> night**. **The new North Star reverses exactly that.**

---

## Invariants — what survives the re-cut

- **Secrets out of Git.** Tokens and connection strings live only in the off-repo store.
  *(Shopping content is explicitly NOT a privacy matter — Warwick, ruled four times. Do not raise it.)*
- **Function in Git, runtime state in Supabase.** Migrations ship columns, never rows.
- **Warwick is the payment and checkout gate.** `checked_out` stays false, enforced in SQL.
- **Never auto-substitute.** Several materially plausible candidates → **stop that line and ask Warwick**,
  never the least-bad result.
- **Known household identity and ASDA retrieval method are SEPARATE concerns** (Warwick's Ruling 2,
  2026-08-09 — **still current and now load-bearing**). A household product does not stop being a known
  household product because we lack a current ASDA reference. **Search is RETRIEVAL; it does not redefine
  the item as "new."**
- **No ad-hoc DB writes bypassing the governed AsdAIr writers.**
- **Independent QA for implementation code**, consequence-appropriate.
- **The specialist defines domain correctness; engineering implements.**

---

## Non-goals

No shopping-platform redesign · no generic agent-platform work · no new governance layer, control plane,
registry or tracker built in response to this ruling · **no automated checkout · no automated payment · no
slot booking · no credential entry.**

---

## Deferred, with the claim corrected rather than the capability pretended

**Rule 7 (budget band) is structurally unevaluable** — no price column exists on `products` or `regulars`,
so `estimated_total` is null and `budget_flag` is permanently `unknown`. The rule is documented,
implemented and dead. **Do not claim budget flagging works until a price source exists.**

Also carried: schema drift on `previously_ordered` and `command_request`.

*(Removed from this list by the re-cut: "70 of 91 regulars carry no `asda_product_id`" is no longer a
deferred deficiency — under the new star a missing id is a normal case AsdAIr resolves by searching and
evaluating. It is an optimisation gap, not a capability gap.)*

---

## The live fixture — preserve it

**Tonight's durable state is the working fixture for the next run and must not be discarded or
hand-patched to manufacture acceptance:**

| | |
|---|---|
| Shop reference | **`SHOP-2026-08-19`** |
| Lines | **37** |
| Answers given | **9** |
| State | **`READY_TO_SHOP`** |
| Frozen manifest | `Deliverables/2026-08-17-asdair-frozen-manifest-SHOP-2026-08-19.json` |

---

## Authority

**Warwick** — product decisions, consequential external actions, checkout, payment, and merge-to-main.
**Larry** — implementation sequencing, worker allocation, integration and all reversible technical
decisions. **Larry builds and operates AsdAIr; he is not in its runtime.**

## Open questions — Warwick's, not Larry's

1. **"substitute Banana → Strawberry"** (from the superseded method). A legitimate `map` directive, or a
   safety bug against the never-substitute rule? Interim safe default: treat any banana/strawberry line as
   `needs_decision`.
2. **Data decisions** — Arla BOB is active in `regulars` while rule 10 says never buy BOB; rules 23/24 fix
   the Sure variant while `rule_qa_log` #5 says rotate it; a test row remains in a `next_week_draft` list.

*(Closed and not reopened: sort order — **BRAND A–Z**, settled 2026-08-04. It survives as a useful
traversal optimisation, not as a mandate.)*
