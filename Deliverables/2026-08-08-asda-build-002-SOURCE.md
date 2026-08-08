# Asda Build 002 — Warwick's Step-5 ruling and follow-on commission (SOURCE MIRROR)

> **MIRROR — Google Drive is canonical.** Source: Google Doc **"Asda Build 002"**, ID
> `1fGZYxjP7VcDHbrXZAC7WI-LgJkxFtaPHsylktCSBEss`, Drive root, modified 2026-08-08T21:34:56Z.
> Retrieved 2026-08-08 by Larry via the Drive MCP text export, de-escaped mechanically; content
> unmodified.

[FROM: WARWICK]

[ACTION: Step-5 PRODUCT DECISION — WP-B15-1 APPROVED, with explicit rulings below. Continue in this same Fable session on `build-015/grounded-recognition`. Do not rotate.]

I approve implementation of **WP-B15-1 items 1 + 2 only**.

Item 3 is OUT of this WP.

Continue from the banked Step-5 state at `3126e71` and the proposed WP:
`Deliverables/2026-08-08-b15-proposed-aswp-01.md`

The active Build remains BUILD-015.
The active Wayfinder remains:
`Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md`

Keep the estate shape simple:

**canonical main**
+
**one active BUILD-015 branch: `build-015/grounded-recognition`**

No new branch unless genuinely required by an existing repository safety rule.
No new map.
No new programme.
No Proofline side quest.
BUILD-020 remains parked at 4F.

# 1. WP-B15-1 — APPROVED SCOPE

Implement:

## ITEM 1 — PRODUCTION INTERPRETATION-CONFIRMATION SURFACE

Deliver the missing real human surface for the existing `needs_review` gate:

- self-healing once-per-shop Telegram confirmation card through ShopperBot;
- card generated when a shop is parked at `needs_review`;
- stuck shop 6 must recover through the same production mechanism, not through a manual DB insert or Larry intervention;
- use the existing command/latch/replan path;
- add a DISTINCT callback action name — do NOT collide with the existing `confirm` action already used for ASDA order-email confirmation;
- preserve the existing callback protocol and byte-budget constraints;
- no new service;
- no new framework;
- no Cockpit implementation merely to solve this.

Acceptance is the REAL event:

**live poller → real ShopperBot card → real Warwick tap → interpretation confirmed → gate clears → replan proceeds**

Zero Larry in the production path.

## ITEM 2 — EXACT-SOURCE PHOTOGRAPH BINDING / WRONG-WEEK PROTECTION

Implement the exact-source provenance required by invariant C:

- immutable image fingerprint captured at intake;
- source message / image identity remains bound to the shop;
- received timestamp;
- physical/interpreted line counts where truthfully available;
- fingerprint prefix rendered to the human;
- human-readable prior-photo comparison so the wrong-week condition is visible rather than merely encoded;
- card must make clear WHICH photograph produced the interpretation.

Do not claim an independent mechanical physical-line verification if none exists.

If the human confirmation gate is the point at which line completeness is verified, say exactly that in the acceptance evidence.

# 2. ITEM 3 — OUT

Candidate-evidence retention / invariant-D preservation is OUT of WP-B15-1.

Do not quietly implement it because you are touching adjacent code.

It is a different seam and likely a different schema/evidence problem.

Record it as the leading candidate for the next bounded slice, subject to the Supabase household-knowledge audit below.

Do not lose it.
Do not implement it yet.

# 3. MIGRATION AUTHORITY

I AUTHORISE the narrow forward-only migration required for ITEM 2 when implementation reaches that point.

Conditions:

- authored in repository;
- numbered safely beyond the existing live migration state;
- narrowly limited to the exact-source/fingerprint requirement of WP-B15-1;
- no opportunistic reconciliation of the three known live-only migration debts inside this WP;
- no unrelated schema cleanup;
- verify before live application what is being applied and why;
- apply through the established safe migration route;
- prove resulting schema state read-only afterwards.

My authority here is for the specific WP-B15-1 migration only.

It is not blanket authority to reconcile every migration discrepancy tonight.

# 4. RETAINED PHOTOGRAPH RULING

Prefer the exact source photograph belonging to shop 6 for the "what Terra actually receives" demonstration IF AND ONLY IF its provenance can be established from the durable production record:

- intake/message identity;
- image reference;
- fingerprint or derivable immutable source identity;
- shop binding;
- timestamp.

If that exact retained photograph cannot be proven, the answer is:

**NO APPROVED RETAINED PHOTOGRAPH ESTABLISHED**

Do not substitute another week's photograph merely because one is available.
Do not manufacture the evidence.

If another photograph is later used for a new real acceptance event, its source must be bound from intake and treated as that new shop's evidence.

# 5. BOB — PRODUCT RULING, CONTRADICTION CLOSED

The supposed BOB contradiction is not a product contradiction.

The household truth is:

- Arla Best of Both / BOB appears in ASDA Regulars and Favourites;
- ASDA controls membership of those surfaces — we do not get to decide what ASDA leaves there;
- the household previously bought BOB;
- ASDA repeatedly supplied milk too near end-of-date;
- Mum therefore switched to Cravendale;
- the rule saying **never BOB** is TRUE and should remain;
- BOB appearing in ASDA Regulars/Favourites is stale/external platform evidence, NOT current household purchase intent.

Therefore:

**KEEP RULE 10.**
**DO NOT REMOVE OR "FIX" THE BOB rule.**
**DO NOT interpret BOB's presence in ASDA Regulars/Favourites as an instruction to buy it.**

This distinction is important and should be carried into the household-knowledge model:

> External platform list membership is evidence about what ASDA thinks is regular/favourite; it is not automatically current household preference.

Where current household rules or confirmed decisions conflict with ASDA-curated Regulars/Favourites, the explicit household rule/decision must win according to the existing product hierarchy.

Do not alter ASDA's lists.
Do not attempt to "clean" BOB from them.
Do not treat this as an outstanding Warwick question any longer.

Record this ruling once in the active authority and move on.

# 6. COMMISSION A BOUNDED PAX READ-ONLY SUPABASE HOUSEHOLD-KNOWLEDGE AUDIT

This is important and is now authorised.

It is NOT another general AsdAIr audit.

It is a bounded read-only investigation answering:

> **What durable household shopping knowledge actually exists in the live database, where did it come from, what is current versus stale/contradictory, what does production AsdAIr actually load, what does Terra/planner actually receive, and what useful knowledge is currently being lost?**

Do not mutate live shopping data.
Do not "fix" findings while investigating.
Enumerate the LIVE schema first.
Do not assume table names from docs or source.

For every logical household-knowledge class that actually exists, establish:

- physical table/view/source;
- row count;
- active/inactive split where applicable;
- provenance/source field values;
- earliest/latest relevant timestamps;
- duplicates;
- conflicts;
- orphaned rows;
- stale values;
- whether production source READS it;
- exact loader/function/path that reads it;
- whether it reaches Terra;
- whether it reaches deterministic recognition;
- whether it reaches the planner BEFORE questions are asked;
- whether it reaches future-shop learning;
- whether it exists in DB but is effectively decorative/unconsumed.

At minimum investigate, where they actually exist:

- Regulars;
- ASDA Favourites or any representation of them;
- canonical household product names;
- aliases / alternate names;
- brand/category/variant knowledge;
- usual quantities;
- explicit shopping rules;
- previous question answers;
- promoted decisions / learned answers;
- previous-shop decisions;
- previous order / purchase context used by planning;
- product/store IDs and URLs where relevant;
- recognition candidate history;
- question/answer learning;
- rule QA / decision logs;
- any other durable household knowledge AsdAIr currently claims to consult.

DO NOT create a new schema or taxonomy merely to make the report pretty.

# 7. DISTINGUISH FOUR DIFFERENT KINDS OF "KNOWLEDGE"

Pax must NOT flatten these into one preference pool.

For every important row/example classify its authority as one of:

1. **EXTERNAL PLATFORM EVIDENCE** — e.g. ASDA Regulars / Favourites membership that ASDA controls.
2. **HOUSEHOLD EXPLICIT INTENT** — e.g. "never BOB", confirmed product choice, explicit rule.
3. **LEARNED HOUSEHOLD EVIDENCE** — e.g. confirmed answers, aliases learned from Warwick/Mum, repeated quantities.
4. **HISTORICAL OBSERVATION** — e.g. prior orders or old choices that may no longer express current preference.

Do not let "it appears in Regulars" silently outrank an explicit current household rule.

Use BOB → Cravendale as the proving case for this distinction.

# 8. CONCRETE PRODUCT TRACES REQUIRED

For each of these known examples, trace:

**what Supabase knows** → **where it came from** → **which source wins if there is conflict** → **what current production loader reads** → **what Terra receives** → **what deterministic recognition receives** → **what planner receives before deciding whether to ask** → **what the system would likely do today**

Examples:

- Arla BOB / Cravendale;
- Gourmet cat food;
- Dreamies cheese;
- Weetabix Protein;
- Wall's sausage rolls;
- Mars / Milky Way.

Also include at least one example where an alias/decision genuinely learned from a previous shop changes a future-shop outcome, if live data contains such evidence.

If no such example exists, say that plainly.

# 9. THE REPORT I WANT

Pax's final report should be compact and decision-useful, not a database dump.

Four sections:

## A. WHAT THE HOUSEHOLD DATABASE ACTUALLY KNOWS
Counts and meaningful classes.

## B. WHAT PRODUCTION ASDAIR ACTUALLY CONSUMES
For every knowledge class: READ / PARTLY READ / NOT READ / UNESTABLISHED.

## C. WHAT IS BEING LOST
Examples of useful knowledge present in live data but absent from Terra/planner/recognition decisions.

## D. PRODUCT CONSEQUENCE
Answer:

> **Does the current production recognition/planning path genuinely use the household knowledge Warwick has accumulated, or is important knowledge sitting unused in Supabase?**

Then identify the single most consequential loss, if one exists.

Do NOT propose a giant remediation programme.
Do NOT create multiple WPs.

This report informs the next slice after WP-B15-1.

# 10. PARALLELISM / ORDER

WP-B15-1 implementation is APPROVED NOW.

The Supabase audit does NOT block starting implementation.

Run the read-only Pax audit in parallel where safe, or immediately around the implementation work without delaying the real confirmation-gate outcome unnecessarily.

However:

- do not allow implementation of ITEM 3 until the audit is read;
- if Pax discovers a fact that materially invalidates WP-B15-1's Star acceptance, surface it immediately;
- ordinary knowledge gaps do not stop the already-approved confirmation-surface work.

# 11. ACCEPTANCE OF WP-B15-1

Do not report the WP complete because code exists.

Required real evidence includes:

- canonical current runtime;
- self-healing confirmation card emitted by the live production poller;
- exactly-once/once-per-shop behaviour demonstrated;
- real Telegram delivery;
- real human tap;
- callback resolves through the production path;
- `needs_review` clears;
- replan occurs;
- shop progresses beyond the invisible gate;
- exact-source identity visible on the card;
- wrong-week comparison visible;
- process restart/recovery does not lose the pending confirmation;
- no Larry/manual DB command in the journey;
- no unrelated shop state corrupted;
- acceptance tied to the exact branch head.

Shop 6 is the preferred recovery proving case if safe.

Do not manually insert the confirm command to make the evidence green.

# 12. AFTER WP-B15-1

Do not automatically start the next implementation slice.

Once the real WP-B15-1 acceptance event is established AND the Supabase household-knowledge report is back:

give Warwick one concise handback containing:

- WP-B15-1 visible outcome;
- real acceptance evidence;
- Supabase knowledge headline;
- what the system knows but does not currently consume;
- whether invariant D / candidate-evidence retention remains the correct next slice;
- any newly earlier product break exposed by the live confirmation event;
- your recommendation for ONE next WP.

That is the next genuine product decision.

# 13. DO NOT FORGET THE STAR

The destination remains:

Mum sends the real handwritten list photograph to ShopperBot.

Production, with zero Larry/ChatGPT/live Claude involvement:

receives exact photo → binds exact source → loads complete household knowledge before vision → Terra interprets catalogue-grounded → deterministic/current household intent wins where appropriate → genuine ambiguity asked once → answers persist and improve future shops → confirmed Brand A–Z plan → durable packet/handoff → delegated basket → reconciliation → checkout-ready notification → Warwick handles checkout/payment/slot only.

Tonight's work is valuable only insofar as it moves that real journey forward.

# 14. MANAGEMENT VISIBILITY

Continue autonomously.

Do not narrate every command.

Notify me concisely when:

- WP-B15-1 reaches its real production acceptance event;
- Pax's Supabase audit finds a material household-knowledge loss;
- a live migration is about to be applied under the authority above;
- a substantive blocker changes the route;
- the next genuine Warwick product decision is ready.

Do not stop at "implemented".
Do not stop at "tests green".
Do not stop at "report written".

Build to the Star and keep moving.
