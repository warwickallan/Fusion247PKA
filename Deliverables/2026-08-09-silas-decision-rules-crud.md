# Schema decision — can the system MANAGE household rules, not just read them?

**Author:** Silas (Database Architect)
**Date:** 2026-08-09
**governance_head as briefed:** `341b091` · **worktree HEAD at time of work:** `ba41c20` (branch `main`, `C:/Fusion247PKA`). `341b091` is an ancestor of `ba41c20`; the two commits between them (`97b5cc6`, `ba41c20`) touch `Deliverables/` only and change nothing this decision rests on. Verified, not assumed.
**private_surface:** none · **credential_scope:** none · **live_authority:** none · **network:** none
**Status:** DECISION DOCUMENT. No migration written, no code changed, no database connected. Implementation is a separate commission.

> ## ⛔ CRITICAL-PATH STATEMENT — read this first
>
> **Nothing in this document is required before the first real photograph goes through the whole shopping chain.** Every recommendation is additive and independently applicable:
>
> - The **retire grant** (§1) changes **zero lines of code** and **zero planner behaviour**. It can be applied before the photo, after it, or never, and the photo journey is identical.
> - The **CREATE unblock** (§3) I explicitly recommend **NOT** doing before the photo, and §3.5 says why in terms of a side effect on `planner.js`.
> - The **`authored_by` column** (§5) is nullable and additive; nothing reads it until a later rendering change.
>
> **If nothing here is implemented, the photo journey is unaffected.** No pre-photo phase is invented, implied or needed.

---

## 0. Correcting the brief before deciding on it

Two of the brief's premises are inaccurate, and both matter to the answer. I establish the corrections here because §3 is built on them.

### 0.1 `promoteDecision` IS wired to production. What is not wired is its RULE BRANCH.

The brief reads `pipeline/deps.js:298-305` as a pipeline-wide refusal. That comment is attached to **`realRecordLearning`** — the *reconcile-time* alias-enrichment function — and states that *that function* does not also promote rules. It is not a statement about the pipeline.

The real chain, established by reading it end to end:

```
runPipeline.js:813  stepReplan -> deps.recordAnswerLearning({...})
deps.js:504-507     realRecordAnswerLearning -> require('../outcome/recordAnswerLearning.js')
recordAnswerLearning.js:150   const promoted = await promoteDecision(plan.decision, writerOptions)
```

`promoteDecision` runs on **every answered or skipped question of every shop**, today. Its `rule_qa_log` INSERT is live. What never fires is the `if (rule)` branch at `promoteDecision.js:501`, because `runPipeline.js:825` passes:

```js
applies_going_forward: false,
```

as an explicit literal, with a comment naming the exact condition for changing it: *"If the command surface ever grows an explicit 'and going forward' act, THAT is what flips this literal, and nothing else may."*

**Consequence for the brief's framing:** CREATE is not blocked by an unwired function. It is blocked by one literal — and by a second gate the brief does not mention, which is §0.2 and is the more important of the two.

### 0.2 THE SECOND GATE. Flipping the boolean alone produces a rule that DOES NOTHING.

This is the single most valuable finding in this document, and anyone who "unblocks CREATE" without it will ship a feature that appears to work and changes no basket.

`buildPromotion` is **structurally incapable** of emitting an actionable directive (`promoteDecision.js:315-321`): it always builds the rule inert and records the requested directive as a *request*. Only `applySourceVerdict` may grant it, and only on `asdair.source_documents.doc_type ∈ ('agent_spec','decisions_log')` **read from the database**.

So a rule promoted without an authoritative cited document lands with `directive = 'info'`. And an `info` rule:

- is **not even loaded** by Terra's grounding path — `interpret/loadCatalogue.js:76` filters `directive in ('exclude','map','rotate','needs_decision')`;
- is treated by `planner.js isAdvisoryRule` (`:993`) as commentary that changes no basket;
- carries an auto-written `note` beginning `[auto-downgraded to 'info'] ...` (`promoteDecision.js:379-401`) that **nothing currently surfaces distinctly**.

**Therefore:** *"Warwick said do this going forward"* → boolean flipped → **a rule that silently changes nothing.** That is the exact failure shape of `applies_going_forward` itself, displaced one layer along. It must be stated in any implementation order, or it will be rediscovered the expensive way.

### 0.3 What I verified, and what I took on trust

Verified from git at `ba41c20`: the `asdair.rules` DDL (`db/001:103-167`), the grants (`db/005:87,98`; `db/012:73,108` — `rules` sits in the **APPEND-ONLY** tier, `select, insert`), the 007 directive extension, the two runtime rule-load paths (`skill/data.js:275`, `interpret/loadCatalogue.js:74-81`), every reader of `superseded_by`, the `promoteDecision` guard, and the `runPipeline` literal.

**Taken on trust:** Larry's live `information_schema.role_table_grants` reading. I hold `live_authority: none` and did not connect. Git and the reported live state **agree exactly**, which is itself worth recording — the grant matrix has not drifted.

---

## 1. Should `asdair_rw` get UPDATE at all, and on which columns?

### Recommendation

**YES. `grant update (active, superseded_by) on asdair.rules to asdair_rw` — column-level, nothing else, no DELETE.**

Larry's instinct is right. I am not adopting it — I am overruling his *reason* for it, because his reason understates the case and a weaker reason will lose an argument later.

### The argument Larry did not make, and it is the decisive one

The framing "should the runtime be allowed to retire a rule?" invites a cautious no. The correct framing is:

> **Today the system can CREATE a standing rule and cannot RETIRE one. Creation without retirement is the dangerous half, and it is the half we already have.**

`asdair_rw` holds **table-level INSERT** on `asdair.rules` right now. `promoteDecision`'s default-deny provenance guard is a **code convention layered on a permissive grant** — the grant itself does not distinguish an `info` row from an `exclude` row. Meanwhile `active` and `superseded_by` — the table's own documented supersession mechanism (`001:97`, `001:100`) — are **inoperable from the runtime**. I had to spend owner privileges today to archive rules 31 and 36.

So the marginal risk of adding UPDATE on two lifecycle columns is **small relative to the INSERT grant that already exists**, and the marginal benefit is **large**: it is the difference between a wrong rule being *correctable by the system that made it* and a wrong rule requiring a human with owner credentials and a migration. That is precisely Warwick's §6 question, and the grant is its answer.

### Why exactly these two columns, and why not one more

| Column | Grant | Why |
|---|---|---|
| `active` | **UPDATE** | Already the filter, in SQL, in two independent readers. Retiring a rule is `active = false` and nothing else changes. |
| `superseded_by` | **UPDATE** | The self-FK the schema designed for *"the rule that replaced this one"*. Retire-and-replace becomes expressible without an owner. |
| `rule_text` | **absent** | **The load-bearing refusal.** `readRules.js` renders `rule_text` to Warwick so he can judge whether a rule is wrong. If the runtime could rewrite it, a rule's *words* and its *behaviour* could drift apart — a rule that says one thing and does another after an edit. **What Warwick reads must always be what was written when the rule was created.** Changing a rule's meaning is retire + insert, which leaves both versions visible. |
| `matched_product`, `match_term`, `match_category`, `directive`, `scope` | **absent** | These *are* the basket-changing behaviour. A grant here would let a model silently repoint a rule Warwick already read and approved. |
| `note`, `reason` | **absent** | Tempting — migration 011 exists precisely because notes were NULL. Refuse anyway: `UPDATE (note)` is the worst combination available, letting a model rewrite the human-facing *explanation* of a rule whose *behaviour* stays fixed. Note repair stays owner-level, as 011 already is. |
| `household_id` | **absent** | Re-scoping a rule to another household is not retirement. |
| `DELETE` | **absent** | §4. |

### The tier this moves the table into, stated honestly

`012_complete_grant_matrix.sql` names three tiers and calls them *"the safety model"*: read-only · insert+select · +update for *"rows whose lifecycle genuinely advances"*. This recommendation does **not** promote `asdair.rules` to the third tier. It creates a **hybrid**: **append-only content, lifecycle state**. That is strictly narrower than the `shop` / `shop_line` / `shop_question` grant already in force, and it should be written into the migration header in those words so a future reader does not "tidy" it into a full table-level UPDATE.

### The limit I cannot close, stated rather than papered over

**Postgres cannot express a one-way column transition through a grant.** `UPDATE (active)` is bidirectional: whatever can set `active = false` can set it back to `true`, so a runtime could in principle resurrect a rule Warwick archived. There is no CHECK that sees the old value, and the only mechanisms that could are a **trigger** or a **rule**, which is exactly the machinery the regrowth cap forbids for a hobby brain.

I accept the bidirectionality, and the reason is §1's own argument: **the runtime can already achieve "make this rule effective again" by INSERTing a duplicate row.** Arguing about resurrection-by-UPDATE while INSERT is table-level is arguing about a window in a house whose door is open. The honest position is that this grant does not widen the trust boundary in a way that matters; it makes the existing boundary *symmetric*.

### One cheap CHECK worth adding in the same migration

`check (superseded_by is null or superseded_by <> id)` — a rule cannot supersede itself. Without it a self-pointing row renders `is_superseded: true` forever with no successor (`readRules.js:164-165`), which is incoherent and invisible. Costs nothing.

**Not** attempted: a cross-household supersession guard. That needs a subquery, which a CHECK cannot do. **Recorded, not built.**

---

## 2. Is supersede-by-insert better than UPDATE at all?

**No — not for this table. And I can price it exactly.**

I argued the append-only case myself, hard, in the remembered-choice decision (`f0ebf31`, §"Append-only, newest wins"). It was right there and it is wrong here, for one reason: **append-only supersession requires the reader to compute currency, and `asdair.rules` has no key to be the newest of.**

### Can a rule be retired without any UPDATE grant? Yes — at this price

Three costs, in ascending order of seriousness:

1. **There is no grouping key.** A remembered choice has `(household_id, choice_term)` — the newest row per key wins, one index, no ambiguity. A rule is identified by a loose, nullable, multi-column tuple: `directive`, `match_term` (nullable), `match_category` (nullable), `scope`, `household_id` (nullable-means-global). "The newest rule about X" would require inventing a grouping key that does not exist. **Inventing it is a new mechanism, which is what we are trying to avoid.**

2. **Retirement with no successor is not expressible.** Archiving rules 31 and 36 today was *"this is wrong and nothing replaces it"*. Append-only cannot say that without a **tombstone row** — a new `directive` value in the CHECK vocabulary, a rulebook where a meaningful fraction of rows are anti-rows, and a fold step in **every** reader before any rule is evaluated.

3. **It costs `planner.js`'s load path — the answer to Larry's specific question.**

   `planner.js` never reads `asdair.rules` directly. It consumes what `skill/data.js loadRules()` returned, and that query is:

   ```sql
   SELECT ... FROM asdair.rules WHERE active = true ORDER BY id
   ```

   The filter is **already in SQL**, and `planner.js isAdvisoryRule` (`:993`) merely re-checks `rule.active === false` defensively in JS.

   **Under the recommended grant, `planner.js` changes by ZERO lines and `data.js` changes by zero lines.**

   Under supersede-by-insert, four readers change, one of them on the route to the photo:
   - `skill/data.js:275` — the planner's load path, `where active = true` → a newest-wins window over a supersession chain;
   - `interpret/loadCatalogue.js:74-81` — Terra's grounding load, same change;
   - `cockpit-api/readRules.js:44-51` — the rulebook render, including its `ORDER BY active DESC` and `is_superseded` projection;
   - `planner.js` — the defensive JS check becomes meaningless and misleading.

### The conclusion, and where append-only still governs

**`active boolean` IS this estate's supersession mechanism. It was designed in `001`, documented in `001:97`, consumed in two SQL readers, rendered in the Cockpit — and simply never granted.** Granting it finishes an existing design. Replacing it with append-only supersession deletes a working filter and rebuilds it as a window function on the planner's hot path, for no correctness gain.

**Append-only still governs the part that matters:** a rule's **words and target remain immutable by absent grant**. What becomes mutable is only whether the rule is in force. That is the smallest possible mutation surface consistent with the requirement, and it is smaller than what `shop_line` already has.

---

## 3. What unblocks CREATE honestly

The brief asks whether `decision_kind` fits, and says plainly to say so if it does not.

### 3.1 `decision_kind` does NOT fit, and 017 already says why

`decision_kind` proves **what kind of decision this was about this week's line**. Its vocabulary (`017:202-204`) is entirely about line outcomes — `existing_regular`, `quantity_change`, `variant_choice`, `new_item`, `skip_this_week`, `clarification_required`. **None of those six is "and this applies going forward."**

017 anticipated exactly this temptation and refused it in its own comment (`017:164-169`), verbatim:

> *"ORTHOGONAL to `decision_kind`, and that is the point: 'one packet, and yes get it every week' is simultaneously a quantity decision AND a forward signal, and a single enum could record only one of the two facts."*

The composite-FK trick worked in the remembered-choice decision because what needed proving *there* **was** the kind — only `existing_regular` and `variant_choice` may be remembered. Here what needs proving is the **forward** fact, which lives on a different column by deliberate design. **Stretching `decision_kind` to carry it would destroy the orthogonality 017 paid for and collapse two facts into one enum. Do not.**

### 3.2 The carrier already exists: `shop_decision.forward_intent`

`017:170` — `forward_intent text`, `check (forward_intent is null or forward_intent in ('yes','no','unclear'))`, with the header note: *"STORED, ROUTED NOWHERE. Consuming it is Lane B and is parked."*

**This is Lane B.** The forward-intent carrier is built, constrained, written, and durable. `NULL` (no forward signal expressed) and `'unclear'` (one was expressed and could not be read) are deliberately distinct, which is exactly the honesty this needs.

**No new column. No new table. No second competing mechanism.**

### 3.3 The authorisation already exists too, and it is stronger than anyone has credited

The question "what carries *this applies going forward* as a **proved human act** rather than an inference?" has an answer already in the tree, and it is not the boolean.

`asdair_rw` holds **SELECT only** on `asdair.source_documents` (`012:96-103`, read-only tier). `applySourceVerdict` grants an actionable directive **only** on a `doc_type` read from that table. Therefore:

> **The runtime cannot create the evidence that authorises its own rule.** Only an owner can put an `agent_spec` or `decisions_log` row into `asdair.source_documents`.

That is a genuine structural proof of a human act — at the **document** level. And `promoteDecision.js:119-126` is already honest about its limit: the pointer *"does not prove the instruction came from that document"*, only that an authoritative document was cited. **Document-level proof, not utterance-level proof.** State it that way and it is defensible; state it as more and it is not.

### 3.4 So the honest CREATE path needs NO schema change and NO grant change

This is the best possible answer under the regrowth cap, so I state it as plainly as the brief asked:

> **`promoteDecision` + the existing `source_documents` provenance guard + `shop_decision.forward_intent` already suffice. CREATE needs no new schema, no new table, no new grant, and no second mechanism.**

The behaviour that falls out is exactly the Terra-proposes / Warwick-authorises split §5 asks for, with no extra machinery:

| Situation | Outcome, today, with no schema change |
|---|---|
| Terra reads a forward signal; no authoritative document cited | Rule written **inert** (`info`), with an auto-appended note naming the reason. **A visible, inert proposal.** Correct behaviour, not a failure. |
| Warwick's instruction is written into the decisions log, and the decision cites it | Rule written **actionable**, exactly as requested. |
| A one-week answer | Refused by rule 10 (`promoteDecision.js:264-277`); recorded in the log only. |

### 3.5 The remaining work, bounded — and why it must NOT happen before the photo

What is actually left is small but not zero, and pretending otherwise would be the failure this document exists to prevent:

1. **`runPipeline.js:825`** stops passing the literal `false` and instead reads the stored fact from 017's row: `applies_going_forward: decision.forward_intent === 'yes'`. That reads a **durable decision**, not a fresh inference — and it satisfies the comment's own stated condition, because the command surface now *does* carry the intent.

2. **Something must construct the structured rule.** `buildPromotion` fails when `applies_going_forward` is true and `decision.rule` is absent (`:270-272`). Turning an answer into `{ category, rule_text, directive, match_term }` is real work and it is a model act. Its **safety** is already handled — the provenance guard makes it inert by default — but the work is not free.

3. **⚠️ A SIDE EFFECT THAT MUST BE IN THE ORDER.** `planner.js eligiblePriorAnswers` (`:1091`) admits `rule_qa_log` rows where `applies_going_forward === true`, and then performs **prose matching** on question/answer text (`priorAnswersForLine`, `:1151`). **Flipping the literal therefore also switches on the prose prior-answer path** — the same path that has been surfacing the archived "best value/wash" advisory. Turning on rule creation and turning on prose advisories are currently **the same switch**. That is a product-behaviour change in the week of a first live photo and it does not belong there.

**Recommendation: do not flip the literal before the photo.** Nothing in §1, §4 or §5 depends on it.

---

## 4. DELETE

**Confirmed: stays impossible. No argument otherwise, and it is short because it is not close.**

1. `rule_qa_log.promoted_rule_id` and `rules.superseded_by` are both FKs into `asdair.rules`. A DELETE either fails on the FK or — if anyone ever "fixed" that with a cascade — **silently severs the back-link that makes a promotion auditable at all.**
2. `001:97` states the design in terms: *"superseded rules are set `active=false` (kept for audit)"*. Retire, never erase.
3. A deleted rule is the one state a human cannot review. §6 asks for visible-and-reversible; DELETE is invisible-and-irreversible.
4. Owner-level DELETE remains available for a genuine mistake. That is sufficient and it is deliberately inconvenient.

---

## 5. Who may write — Terra proposing vs AsdAIr executing

### What the schema records today, and why it is inadequate

- `rules.source_document_id` records **what was cited**, never **who wrote the row**. A Terra-authored row and a Warwick-authored row can cite the same document.
- `rules.directive` accidentally encodes provenance: `info` ≈ "could not prove authority". But it also means "genuinely informational" — 011's seeded rows are `info` for content reasons, and so is a purely informational rule Warwick wrote himself. **Effect is being used to carry provenance. That is the defect.**
- `rules.note` carries the downgrade reason as **prose**. Prose is not a queryable field.

### Recommendation — the ONLY new column I recommend anywhere in this document

**`asdair.rules.authored_by text` — NULLABLE, with `check (authored_by is null or authored_by in ('human','terra','rule','migration'))`.**

Vocabulary mirrors 017's `interpreted_by` (`017:172-175`, `check (interpreted_by in ('terra','human','rule'))`) plus `'migration'` for the 011-seeded corpus, so the two tables cannot disagree about who wrote something.

Tested against the regrowth cap before recommending it: no existing column on `asdair.rules` answers the question; `interpreted_by` lives on `shop_decision` and a rule is not always sourced from a decision (011's rows have none). One column mirroring a sibling table's existing vocabulary is not a mechanism, a registry or a control plane.

**Nullable, deliberately, and not `default 'unknown'`:**

- `NULL` means *"this row predates authorship recording"* — honest. `'unknown'` asserted as a value is a claim nobody made. Same NULL-vs-`'unclear'` distinction 017 draws for `forward_intent`.
- `promoteDecision.RULE_COLUMNS` (`:127-140`) is a **fixed column list**. A `not null` no-default column breaks that INSERT the moment the migration lands. Nullable is additive: **the migration applies safely with no code change**, and the column becomes truthful the moment a later commission adds it to `RULE_COLUMNS`. No backfill, no lie by default.

### The sentence that matters more than the column

> **`authored_by` is a queryable LABEL. It is not the PROOF.** A writer can pass any permitted literal. What actually proves *"Warwick instructed this"* is `source_document_id → source_documents.doc_type` — a table `asdair_rw` may only **read**. Do not let the label be read as the proof; a future reviewer will, unless the migration header says this.

### And a label nobody displays is not visibility

`readRules.js RULES_SQL` (`:44-51`) selects a fixed column list. **Adding `authored_by` to that SELECT and to the presented row is what makes the distinction reach Warwick's eyes.** Recorded here as the second half of the recommendation, sequenced after the column, and not designed in this document.

---

## 6. The safety question: making a wrong or model-invented rule visible and reversible

Four properties, strongest first. Three of them already exist.

### 6.1 REVERSIBILITY — and it is the answer to Warwick's own question, from §1

**This is the headline and it should be reported to Warwick as the finding, not the grant.**

Today the runtime can **create** a standing rule and **cannot retire one**. Every wrong rule needs a human with owner credentials and a migration — which is what happened to rules 31 and 36 today. **"Quietly permanent" is not a risk in the current shape; it is the current shape.**

The retire grant in §1 is not a convenience. **It is the single largest safety improvement available here**, because it converts *quietly permanent* into *correctable by the system that made the mistake*. Warwick's §1 question and his §6 question have the same answer.

### 6.2 A model-invented rule is ALREADY structurally inert

`buildPromotion` cannot emit an actionable directive · `applySourceVerdict` requires a DB-read `doc_type` · `asdair_rw` cannot write `source_documents`. The **default outcome** of a model-invented rule is a rule that changes no basket.

So the dangerous case is **not** "a model invents a rule". It is **"an inert rule is mistaken for a live one, or a live rule is mistaken for inert"** — a *legibility* failure, not an authority failure. Which is why §5 and §6.3 are where the remaining value is.

### 6.3 The visibility surface exists and is under-used — no new mechanism needed

`readRules.js` was built for exactly this question — *"what has this thing actually learned, and is any of it wrong?"* — and already reports `active`, `is_superseded`, `applies_going_forward`, `was_promoted`, and a "standing answers never promoted" count (`:262-266`).

Two cheap additions, both **rendering**, neither a mechanism:

1. **Render `authored_by`** (§5), so "Terra proposed this" is visible at a glance rather than inferred from `directive = 'info'`.
2. **Surface the downgrade note distinctly.** `promoteDecision.downgradeReason` already writes `[auto-downgraded to 'info'] the requested directive 'exclude' was NOT applied because ...` into `note`. **That string is already in the database and nothing renders it as anything other than ordinary note text.** A rule that *wanted* to change the basket and was refused is the single most interesting row in the rulebook, and today it looks like every other comment. This is the cheapest real safety win in the document.

### 6.4 What must NOT be built

**No approval queue. No `pending_rules` staging table. No rule-review tracker. No notification pipeline. No `is_wrong` flag.**

The rulebook already has: two lifecycle states (`active`, `superseded_by`), an inert/actionable distinction (`directive`), an audit back-link (`promoted_rule_id`), provenance (`source_document_id`), and a dedicated read surface (`readRules.js`). **Adding a fifth state machine on top of that is the BUILD-018 shape and the regrowth cap applies at full force.**

### 6.5 The honest limit — recorded, PARKED, not escalated

**`asdair_rw` holds table-level INSERT on `asdair.rules`.** `promoteDecision`'s default-deny guard is a **code convention layered on a permissive grant**. Anything holding the `asdair_rw` credential can insert an `exclude` or `map` row directly, bypassing every guard described above. That is the honest boundary of the phrase "structurally impossible" as used anywhere in this document.

**Applying the hobby-brain bar (root `CLAUDE.md` §Proportionality):** the actor would already hold the household's database credential; the consequence is a wrong shopping basket; nothing touching money, identity, credentials, household privacy, safety, destructive loss, or an irreversible action in Warwick's name is involved. **PARK. Record it, do not act on it, do not interrupt Warwick with it.** It is recorded here so it is never mistaken for a claim of impossibility.

---

## 7. What a migration would contain — ILLUSTRATIVE, NOT A MIGRATION

**Migration 019.** `018` is reserved by the remembered-choice lane in flight (WO-B15-M1, `ba41c20`) — note the WO document is committed but **`db/018_*.sql` is not yet on disk**, so 018 is reserved by intent, not by file. **019 has no dependency on 018**; they touch different tables and may land in either order. Forward-only numbering; 013/014/015 are gitignored seeds (§8.2).

```
-- 019: the runtime may RETIRE a rule it must never REWRITE.

GRANT
  grant update (active, superseded_by) on asdair.rules to asdair_rw;
  -- rule_text, directive, match_term, match_category, matched_product,
  -- scope, reason, note, household_id: UPDATE ABSENT, DELIBERATELY.
  -- DELETE: absent to every role.
  -- Header must state: this is a HYBRID tier - append-only CONTENT,
  -- lifecycle STATE - and is NARROWER than 012's third tier. Do not "tidy"
  -- it into a table-level UPDATE.

CHECK
  check (superseded_by is null or superseded_by <> id)   -- no self-supersession

COLUMN (additive, safe with zero code change)
  authored_by text  NULL
    check (authored_by is null or authored_by in ('human','terra','rule','migration'))
  -- NULL = predates authorship recording. No default, no backfill, no lie.
  -- Becomes truthful when a later commission adds it to
  -- promoteDecision.RULE_COLUMNS. The column is the LABEL; the PROOF is
  -- source_document_id -> source_documents.doc_type, a table asdair_rw may
  -- only read.

NOT IN THIS MIGRATION
  * No change to asdair_ro.
  * No change to CREATE. No new table. No trigger. No tombstone directive.
  * asdair.rules is ALREADY in 012's enumerated matrix - unlike shop_decision
    and remembered_choice, this migration adds no new absentee. 012 is not
    amended by 019.
```

**Applies before or after the first photo, with identical effect.** Zero readers change: `skill/data.js:275` and `interpret/loadCatalogue.js:76` already filter `active = true`; `planner.js` already re-checks it defensively.

---

## 8. Anomalies recorded for Larry — observations, not work, not escalations

1. **`pipeline/deps.js:298-305` is read as a pipeline-wide refusal and is not one.** It scopes `realRecordLearning`. `promoteDecision` has run in production on every answered question since WP-B15-2. `buildAnswerLearning.js:64` cites it as `deps.js:252-258`; the text is now at `:298-305`. Both citations will keep misleading readers. **Non-blocking; note-only.**

2. **Migration 011 is untracked and gitignored on the strength of a superseded claim.** `git check-ignore` confirms `.gitignore:113` catches it; `git ls-files` confirms it is not tracked. Its header states household directive values *"live ONLY in the private Supabase asdair schema and are NEVER committed to git"* — the **exact wording `001:117-139` records as WRONG and corrected** by Warwick's `BUILD-015-SHOPPING-DATA-CLASSIFICATION` (2026-08-04), whose recorded harm was *"leaving the live database ahead of git."* 011 is a corrective migration applied to live and absent from git: **the live database is, for these rows, ahead of git today.** My own contract's critical rule 11 speaks to exactly this. **Recorded for Warwick's decision; I have taken no action and recommend none before the photo.**

3. **Two `applies_going_forward` semantics coexist.** `planner.js:1091` treats it as *"this answer is standing policy"* and gates a **prose** matching path on it; `promoteDecision` treats it as *"promote a structured rule"*. One boolean, two consumers, different meanings — which is why flipping it has the side effect in §3.5.

4. **`superseded_by` has exactly one reader in the whole tree** — `readRules.js:164-165`, for Cockpit display. No planner or grounding path consumes it. So granting UPDATE on it affects **display and audit only** until something else reads it. That is a feature, not a gap.

5. **`shop_decision.forward_intent` remains stored and routed nowhere** — unchanged by this decision, and §3.2 names it as the carrier when Lane B is actually commissioned.

6. **Hobby-brain bar applied throughout.** Nothing in this document meets the escalation test. §6.5 is the one finding that could be dressed as a security matter and is explicitly **PARKED**. All content here is ordinary household shopping data, explicitly committable per GL-009 and the ruling recorded at `001:117-139`.

---

## 9. The decision, in one paragraph

**Grant `asdair_rw` column-level `UPDATE (active, superseded_by)` on `asdair.rules` and nothing else — because the dangerous asymmetry today is not that the system might retire a rule, it is that the system can CREATE a standing rule and cannot retire one, so every mistake needs owner credentials and a migration. Keep `rule_text` and every targeting column immutable by absent grant, so what Warwick reads in the Cockpit is always what was written and a rule can never say one thing while doing another. Do not replace this with supersede-by-insert: `active` already IS the estate's supersession mechanism, filtered in SQL by both runtime readers, and append-only would need an invented grouping key, a tombstone directive, and changes to four readers including the planner's load path — the UPDATE grant retires a rule with zero code change. DELETE stays absent to everyone. CREATE needs no schema change at all: `promoteDecision` plus the existing `source_documents` provenance guard — a table the runtime may only read, so it cannot forge its own authority — plus `shop_decision.forward_intent` as the carrier already suffice, and `decision_kind` must NOT be stretched to carry the forward fact because 017 made the two orthogonal on purpose. Add one nullable `authored_by` column mirroring 017's `interpreted_by` vocabulary so a Terra proposal is a queryable label rather than an inference from `directive='info'`, while stating plainly that the label is not the proof. And the safety answer Warwick asked for last is the grant he asked about first: reversibility is what makes a wrong rule visible and correctable instead of quietly permanent — with the cheapest remaining win being to render the `[auto-downgraded to 'info']` note that `promoteDecision` already writes and nothing yet surfaces. None of it is required before the photograph.**
