# Schema decision — the household's REMEMBERED LAST CHOICE

**Author:** Silas (Database Architect)
**Date:** 2026-08-09
**governance_head:** `f14b358` (branch `main`, `C:/Fusion247PKA`)
**private_surface:** none · **credential_scope:** none · **live_authority:** none · **network:** none
**Status:** DECISION DOCUMENT. No migration written, no code changed. Implementation is a separate commission.

---

## 0. The requirement, and what it actually asks of the schema

Warwick, 2026-08-09: *"WHEN THERE IS MORE THAN ONE VALID CHOICE, REMEMBER THE CHOICE I MADE LAST TIME."*

Read structurally, that sentence contains four schema obligations and one prohibition:

| # | Obligation | Schema consequence |
|---|---|---|
| 1 | *"more than one valid choice"* | The mechanism fires only on a **candidate set of size >= 2**. A one-candidate resolution is not an ambiguity and must not be remembered. |
| 2 | *"the choice I made"* | A choice is a **grounded catalogue product**, i.e. an `asdair.regulars.id` — never prose, never a name string. |
| 3 | *"last time"* | The record is **time-ordered** and the newest wins. Provenance and age must be first-class, not derived. |
| 4 | *"so the list can resolve before browser execution"* | The record must be **findable next week from a new photo**, i.e. keyed on something that survives re-listing. |
| — | *"a preference, not permission to invent products or ignore hard exclusions"* | The record must be **structurally incapable** of excluding, mapping, inventing or changing quantity. |

Everything below follows from those five lines.

---

## 1. Where a remembered last choice LIVES

### Recommendation

**A new table, `asdair.remembered_choice`, in migration 018. Append-only; newest row wins; no role is granted UPDATE or DELETE.**

I do not reach that lightly — the regrowth cap says prefer an existing seam. Both existing seams were examined and both fail on a *correctness* ground, not a taste ground.

### Rejected: reuse `rule_qa_log` + `applies_going_forward`

`asdair.rule_qa_log` is a **free-text** record: `question text`, `answer text`. It has **no column capable of holding a grounded product identity** — no FK to `asdair.regulars` exists anywhere on it. The planner recovers meaning from those rows by *prose matching*: `termMatch.matchTerms(qa.question, item.item_name)` plus compound-answer splitting on `;` and `=` (`skill/planner.js:1151-1162`, `:1237-1249`).

That is precisely the authority boundary `interpret/resolveByCatalogue.js:3-13` exists to enforce:

> the model READS and RANKS · the catalogue DETERMINES IDENTITY · the human RESOLVES genuine ambiguity

Storing "he picked the Ariel 3-in-1 pods" as prose means next week's planner must re-derive a product identity **from prose**. The estate has already paid for that mistake once: `planner.js:1080-1085` records that a prior answer *"never names a product"* and that `"best value/wash"` is a heuristic the schema cannot evaluate — which is exactly why Warwick has now archived it. Re-entering the same seam with a rule that *requires* a product identity would rebuild the defect he just removed.

Secondary, but disqualifying on its own: `asdair_rw` holds column-level `UPDATE (promoted_rule_id)` on `rule_qa_log` (`005:90`). A durable memory living on a table the runtime may already UPDATE is a memory defended by convention.

### Rejected: promote to an `asdair.rules` row (`directive='map'`)

Three independent failures:

1. **It downgrades the fabrication guard.** `asdair.rules.matched_product` is `text` with **no foreign key** to `asdair.regulars` (`001:145`). Migration 017 spent its central argument making `decided_regular_id bigint references asdair.regulars(id)` so that *"a model cannot assert a product that does not exist — the database refuses the row rather than the code hoping to"* (`017:155-158`). A `map` rule stores a **name string**. Moving the household's memory into `rules` would replace an FK with a string — the exact regression 017 closed.
2. **The runtime cannot retire a stale one.** `asdair_rw` holds `SELECT, INSERT` on `asdair.rules` and **no UPDATE** (`012:106-110`). So `active = false` and the `superseded_by` self-FK — the table's own supersession mechanism — are **inoperable from the runtime**. Every change of mind would need an owner-level migration. A preference that requires a migration to change is not a preference.
3. **A rule is an instruction; this is a default.** `outcome/promoteDecision.js:40-69` built a whole default-deny provenance guard specifically to stop an inference becoming *"permanent doctrine inherited by every later runtime"*. A remembered last choice must **yield** to this week's grounded candidate set. Putting it in `rules` conflates preference with instruction — the conflation Warwick's own wording forbids.

### Why a new table is the right answer here

- **It is the 017 precedent applied verbatim, one layer up in time-scope.** 017's argument was: when the invariant is *"this must never be silently rewritten"*, the answer is a separate table whose grant matrix **omits UPDATE**, because *"immutability enforced by ABSENT GRANTS survives every code path, where a convention does not"* (`017:28-33`). The remembered choice has the same invariant. It inherits the same shape for the same reason.
- **017 already anticipated this consumer and parked it.** `shop_decision.forward_intent` is *"STORED, ROUTED NOWHERE. Consuming it is Lane B and is parked"* (`017:167`). There is currently **no** durable home for the forward half of the loop. 018 is that home — not a new concept, the parked one.
- **The separation Warwick requires is preserved by construction.** 017's header: *"Current-shop meaning and future household learning are different concerns and are stored apart."* `shop_decision` stays immutable and current-shop-only. The remembered choice is **derived from** a decision and **points back at it** by FK — provenance is a join, never a copy, so the two can never drift and neither is rewritten to serve the other.
- **The 001 defect becomes structurally unrepeatable.** This is the strongest single argument and it is worth stating plainly. `applies_going_forward` failed because it was a **filter a writer had to remember to set**, defaulting to the value that discarded everything. In the recommended shape there is no filter: the reader's query is `... where household_id = $1 and choice_term = $2 order by chosen_at desc, id desc limit 1`. **Every row in the table is, by construction, a remembered choice.** There is no boolean to leave false.

### Append-only, newest wins

A changed mind is a **new row**, never an edit. That single decision buys, at once: immutability by absent grant; a complete preference history for free; no `updated_at` lie; and no supersession mechanism to build. Volume is trivial (≈5 questions/week ≈ 260 rows/year).

Structural idempotency follows 017 exactly: **`unique (source_decision_id)` — one remembered choice per decision, EVER** — so the writer is `INSERT ... ON CONFLICT (source_decision_id) DO NOTHING` plus a re-select, and a replayed interpretation resolves to the same row instead of minting a second, differently-read one.

---

## 2. What KEYS the ambiguity — the hard part

### Recommendation

**`(household_id, choice_term)` where `choice_term = normaliseTerm(item_name)`, stored as PLAIN, READABLE, NORMALISED TEXT** — plus a `term_normaliser` column naming which normaliser produced it. No unique constraint on the key (append-only); an index on `(household_id, choice_term, chosen_at desc, id desc)`.

### The reframe that makes this decision tractable

The key does not have to be clever, **because validity is re-checked against this week's live candidate set at use time** (see §5). The reader applies a remembered choice only when the remembered `regulars.id` is in *this week's* grounded candidate set and is still active.

That changes the cost matrix decisively:

- **A key that MISSES costs one question.** Safe.
- **A key that OVER-MATCHES is caught by the candidate check before it can change a basket.** Also safe.

So the key should be optimised for **legibility and stability**, not for recall. This is `termMatch.js`'s own governing asymmetry (*"A matcher that is too loose SILENTLY BUYS THE WRONG PRODUCT. A matcher that is too tight asks a question. Those costs are not comparable"*) applied to the memory index.

### Rejected: `question_key`

Tempting — it already exists and is already the decision↔line join (`applyDecisions.js:30-35`). It is wrong as an **identity across shops**:

1. **Round-bearing.** `questionKeyFor(term, 2) !== questionKeyFor(term, 1)` (`keys.js:260-274`). The same settled ambiguity gets a different key depending on how many clarification rounds it happened to take that week — fragmenting the memory on an accident of the conversation.
2. **Opaque.** A truncated 8-hex sha1. `readRules.js` renders the rulebook to Warwick in the Cockpit; `q3f9a1c2` is not something he can audit. For a *learning* mechanism he must trust, legibility is functional, not cosmetic.
3. **Unscoped.** It deliberately excludes the shop (`keys.js:225-228`) because `(shop_id, question_key)` supplies scoping — and it excludes household too. Cross-shop identity needs the household in the key.
4. Lossy 32 bits. Negligible at household scale, but a needless risk for zero gain.

**It remains the right key for joining a decision to a question inside one shop.** It is the wrong key for identity across shops. Both statements are true and 018 should not disturb the first.

### Rejected: the candidate-set hash

Keying on the sorted set of candidate `regulars.id`s looks like the "true" identity of an ambiguity. It fails hard:

1. **It over-matches catastrophically in one case.** `resolveReading` returns `status: 'unmatched_new_item'` with an **empty** `alternatives` array (`resolveByCatalogue.js:66, :153`). Every unmatched new item would collapse onto one key — a **wrong-match** failure, not a miss. That is the unacceptable direction.
2. **The catalogue changes far more often than list wording.** The candidate set is a function of the live `regulars` rows and their `aka` arrays — and `asdair_rw` may INSERT regulars and UPDATE `aka` (`005:67-75`). Adding a single alias re-shapes the candidate set and **orphans every remembered choice** derived from it. Silent, total, and invisible.
3. Opaque, same as above.

The candidate set belongs in the row as **evidence** (§5), never as the key. That is 017's own distinction for `evidence_shop_line_id`: *"EVIDENCE ONLY, NEVER IDENTITY."*

### Why normalised term, in plain text

- **It is the estate's existing precedent for exactly this relation.** `asdair.products` already keys *list term → product* per household, with partial unique indexes normalised to match `normaliseTerm` (`001:202-232`). The remembered choice is that same relation with a **grounded id instead of a name string** and a **time dimension**. Same key shape means the two are joinable and comparable, rather than two competing indices of "what this household means by X".
- **Readable in the Cockpit.** `ariel pods → Ariel 3-in-1 Pods 38pk, chosen 2026-08-09 from SHOP-2026-08-09` is auditable at a glance.
- **`household_id` is `not null`, with an FK.** `rule_qa_log`, `rules` and `products` all use NULL-means-global, and 001 had to bolt on partial unique indexes twice to stop NULL-permissive duplication (`uq_budget_one_global`, `uq_products_global_term`). Warwick's rule says *"the household's most recent preference"* — there is no global scope in it. `not null` deletes the whole NULL-semantics class instead of defending against it a third time.

### THE STATED FAILURE MODE — "ariel" one week, "ariel pods" the next

I am not hiding this. It is the failure, exactly:

`normaliseTerm('ariel') = 'ariel'`. `normaliseTerm('ariel pods') = 'ariel pods'`. **Different keys. The lookup MISSES. Asdair asks again.**

What then happens:

1. Warwick answers a second time.
2. A **second** remembered-choice row is written, keyed `'ariel pods'`, pointing at the **same** `regulars.id`.
3. From week three, **both spellings are covered.**

**The mechanism self-heals by use, and it fails in the safe direction — one extra question, never a wrong product.** The cost of the miss is bounded and visible; the cost of closing it wrongly is not.

**Do NOT make the preference key fuzzy to close this.** The household's real mechanism for "we write it differently" is `asdair.regulars.aka` — a `text[]` the resolver already matches tolerantly through the ONE shared matcher. Adding fuzzy matching to the preference key creates a **second, competing notion of "the same item"**, which is verbatim the defect WO-Y was written to close:

> *"Two matchers that are supposed to agree, written twice, are exactly how the defect got in."* — `skill/termMatch.js:20-22`

If `ariel` / `ariel pods` recurring is worth fixing, **the fix is an `aka` entry, not a cleverer key.** Recorded; not built.

**The one widening I would accept, if any is wanted later:** widen the **lookup**, never the key. The planner may try the exact normalised term first, then `termMatch.bestMatch(term, storedChoiceTerms).confident`. That reuses the ONE matcher, inherits its confident/advisory asymmetry, and touches **no schema**. The recommended shape leaves that door open and does not require it. Do not design it now.

### The normalisation-drift hazard, and the cheap honest answer

There are **two** `normaliseTerm` implementations in the tree — `pipeline/keys.js:193` and `skill/termMatch.js normaliseMatchText` (reached via `interpret/resolveByCatalogue.js:25`) — pinned to agree only by a **sample-based** test (`pipeline/stages.test.js:267-270`). A key written by one and looked up by the other is a silent-miss surface that nobody would notice.

Two mitigations, both cheap, both recommended:

1. **`term_normaliser text not null`** — names the normaliser that produced `choice_term` (e.g. `'keys.normaliseTerm@1'`). A future normalisation change becomes a **queryable, visible** break rather than a memory that quietly stops firing.
2. **A fixed-point CHECK** making an un-normalised term unstorable, mirroring 001's approach for `products`:

   `choice_term = btrim(regexp_replace(regexp_replace(lower(choice_term), '[^a-z0-9&[:space:]]', ' ', 'g'), '[[:space:]]+', ' ', 'g'))`

   Order matters and matches `keys.js` exactly: lower → punctuation-to-space (`&` preserved) → collapse → trim. **Known residual, stated not discharged:** JS `\s` covers the full Unicode space set where Postgres `[[:space:]]` covers only ASCII/C-locale — the identical divergence 001 recorded at `:223-225`. The CHECK is a strong guard, not a proof of agreement, which is precisely why `term_normaliser` is carried as well.

### Deliberately NOT the key

`list_item_id`, `shop_id`, `question_id` — all shop-scoped; unfindable next week. `chosen_regular_id` — that is the *answer*; keying on it makes "what did I decide about X" unanswerable the moment the answer changes.

---

## 3. Grants

| Role | Privilege | Rationale |
|---|---|---|
| `asdair_rw` | `SELECT, INSERT` + sequence `USAGE` | Write the memory; never rewrite it. |
| `asdair_ro` | `SELECT` | The planner and the Cockpit read it. |
| **anyone** | **`UPDATE` — ABSENT** | A remembered choice cannot be silently rewritten by a code path that exists **or is later written**. 016/017's model. |
| **anyone** | **`DELETE` — ABSENT** | A memory is superseded by a newer row, never erased. |

**Three things the insert-only claim depends on beyond this matrix. 017 established that FK referential actions run with owner authority and bypass grants (`017:315-332`); 018 must re-state it, not assume it.**

1. **`chosen_regular_id → asdair.regulars(id)` must be `on delete no action`** (017's own choice for `decided_regular_id`). A memory must never be silently NULLed by a catalogue deletion — the delete should fail instead. Regulars are retired by `active = false`, never deleted (`004:52`), so this costs nothing and closes a silent-rewrite path.
2. **`source_decision_id → asdair.shop_decision(id)` must ALSO be `on delete no action` — and this is where 018 deliberately DIVERGES from 017.** 017 cascades a decision away when its question is deleted, correctly: *"a decision about a deleted question is not a decision."* But a **remembered** choice has outlived its shop by design; deleting last month's question must not erase this month's memory. **State the divergence in the migration header or a future reader will "fix" it back.**
   - **Consequence to record, not to design around:** with `no action`, deleting a `shop_question` will now FAIL where it previously cascaded. No runtime path hits this — `asdair_rw` holds `SELECT, INSERT, UPDATE` and **no DELETE** on `shop_question` (`006:207`, `012:113-119`) — but an owner-level cleanup would.
3. **The target cannot be rewritten to mean something else.** `asdair_rw` has table-level SELECT on `asdair.regulars` (`012:96-103`) and a column-scoped UPDATE that **excludes `name`, `household_id` and `active`** (`005:71-75`). So the runtime cannot rename or retire the product a memory points at. **The claim depends on that upstream grant staying as it is; record it here so a future grant change is understood to reach this table.**

**Record, do not act (017's precedent):** `asdair.remembered_choice` will be **absent from migration 012's enumerated grant matrix**. A future matrix re-enumeration must pick it up. **012 is not amended by 018.**

---

## 4. Provenance and time

Every column answers a question a human will actually ask when a preference looks wrong.

| Column | Why |
|---|---|
| `chosen_at timestamptz not null` — **NO DEFAULT** | **When Warwick made the choice**, sourced from the decision's `interpreted_at` / question's `answered_at`. A `default now()` would quietly re-date a replayed or backfilled choice, and "how old is this preference" is the entire point of the column. Absence of a default forces the writer to supply the truth. |
| `created_at timestamptz not null default now()` | When the **row** was written. Two clocks, two meanings — 017 keeps `interpreted_at` and `created_at` apart for the same reason. |
| `source_shop_id → asdair.shop(id)` | **Which shop** — yields `shop_ref` (`SHOP-YYYY-MM-DD`), the handle Warwick and the bot both use. |
| `source_decision_id → asdair.shop_decision(id)` | **Which decision** — and through it the question, his exact words, the model's structured return, and the `grounding_fingerprint` of the catalogue it was decided against. Provenance is a **join, never a copy**, so it cannot drift from what it claims. |
| `source_question_id` | **Not carried.** Reachable via `shop_decision.question_id`; duplicating it creates a second drift-capable path to one fact. SSOT. |
| `updated_at` | **Not carried.** 017's exact reasoning: no role is granted UPDATE, so a column claiming a modification time would be *"a lie waiting to be told"*. |

**Staleness is a READING, never a stored flag.** Nothing here says `is_stale`. Staleness is `now() - chosen_at` plus "is the target still an active regular", both computed at read time. A stored flag would need UPDATE — the thing that must not exist — and would go wrong silently the first time nobody recomputed it. **What the schema must never do is make a two-year-old preference look identical to last week's**; a required, non-defaulted, non-updatable `chosen_at` is how it doesn't.

**No `expires_at` / TTL.** That would invent a policy Warwick did not state and require a number nobody has decided. The age is visible; what age is too old is his call, later, and needs no schema now. **Explicit non-goal.**

---

## 5. Honest failure — making the honest path natural, not merely permitted

Four structural properties, in order of strength.

**1. An id, with a foreign key — so a fabricated match is unstorable, not merely discouraged.**
`chosen_regular_id bigint not null references asdair.regulars(id)`. A remembered choice **cannot exist** for a product the catalogue does not contain. This is 017's invariant carried forward: *"the database refuses the row rather than the code hoping to."*

**2. No `chosen_product_name` column at all.**
The name is looked up from `asdair.regulars` by id at read time — 008's rule, restated by 017's `shop_decision_name_only_for_new` and by `applyDecisions.js:224-228`: *"THE NAME IS LOOKED UP FROM THE CATALOGUE BY ID, NEVER TAKEN FROM THE DECISION ROW."* Consequence: a preference whose product was renamed renders as its **current** name; a preference whose product is gone renders as **nothing at all** — never as a stale string that looks like a live product. **There is no way to spell a fabricated match in this table.**

**3. The stored candidate set makes the honest failure EXPLAINABLE, not just correct.**
`candidate_regular_ids bigint[] not null` — the grounded candidate set that was on the table when he chose. **EVIDENCE, NEVER IDENTITY** (017's phrase for `evidence_shop_line_id`). The reader's rule: apply the memory **only** when `chosen_regular_id` is in *this week's* candidate set **and** is still an active regular. Otherwise, ask.

The stored array is what lets Asdair say *"last time the choice was between A, B and C; this week B is not a candidate, so I'm asking again"* rather than silently falling back. Two constraints:

- `chosen_regular_id = any(candidate_regular_ids)` — a choice that was never among its own candidates is incoherent and unstorable.
- `array_length(candidate_regular_ids, 1) >= 2` — **Warwick's rule fires only "when there is more than one valid choice."** Fewer than two candidates is not the thing he authorised; making it unstorable stops the mechanism quietly widening into "remember everything".

**Deliberately not a foreign key** (Postgres cannot FK an array element) and deliberately **no guard index** — 017's warning applies: a guard would *"imply a reliability it does not have."* The load-bearing FK is `chosen_regular_id`.

**4. It has no vocabulary with which to disobey.**
The table carries one `regulars.id` and **no directive columns** — no `exclude`, no `map`, no `matched_product`, no quantity. It therefore **cannot** override a hard exclusion, invent a product, or change how much. That is Warwick's *"a preference, not permission"* expressed as an **absence of columns** rather than as a rule someone must remember. Concretely: the planner applies exclusions and rules first; a remembered choice can only ever collapse an already-grounded, already-permitted set of candidates down to one of its own members.

---

## 6. Authorised standing preference vs accidental promotion

This is where the previous loop failed, so the answer must be structural.

**Why the old instrument was the wrong instrument.** `applies_going_forward boolean not null default false` made durability *a property the writer must remember to assert, on every row*, with a default that is either always-wrong-safe or always-wrong-dangerous. It chose safe, nothing ever set it, and — per 017's own header — *"every answer Warwick ever gave was written, read back, and discarded."* **A boolean cannot carry this distinction. Do not reintroduce one.**

Four structural distinctions instead, strongest first.

### 6.1 An ordinary one-week answer is NOT EXPRESSIBLE in this table

This is the load-bearing one. The table holds exactly one kind of thing, and its constraints exclude everything else:

- `candidate_regular_ids` with `>= 2` members — a one-week answer has no candidate set;
- `chosen_regular_id not null` with an FK — a one-week answer names no catalogue product;
- no directive vocabulary — a one-week exclusion cannot be spelled.

*"Don't buy X this week"* **cannot be written here at all.** Contrast `rule_qa_log`, where every answer is the same shape and only a flag distinguishes them — which is precisely how a flag came to be the single point of failure.

This also honours rule 10 (`promoteDecision.js:25-30`, *"a one-week-only exclusion is NEVER promoted"*) without importing it as a code check: the schema simply cannot hold one.

### 6.2 Only two decision kinds may source a row — enforced by COMPOSITE FOREIGN KEY

`existing_regular` and `variant_choice` are remembered. `skip_this_week`, `new_item`, `quantity_change` and `clarification_required` are **structurally never** remembered.

**Judgement call, stated:** this cannot be a plain CHECK (it depends on another table's row), and I will **not** recommend a trigger — a trigger is exactly the machinery the regrowth cap forbids. 017's own precedent for a cross-row invariant was a **composite foreign key**, and it applies here byte-for-byte:

- carry `source_decision_kind text not null` with `check (source_decision_kind in ('existing_regular','variant_choice'))`;
- add `create unique index on asdair.shop_decision (id, decision_kind)` — trivially satisfiable, `id` is already the PK, exactly as 017 did with `shop_question_id_shop_uniq`;
- bind them: `foreign key (source_decision_id, source_decision_kind) references asdair.shop_decision (id, decision_kind)`.

The kind is then **provably equal** to the sourcing decision's kind — not asserted by a writer, not trusted from a model's return. **This is the strongest single element of the recommendation and the clearest reason the shape is worth migration 018.**

### 6.3 `authorised_by` names the standing authority, with a CLOSED vocabulary

`authorised_by text not null check (authorised_by in ('standing-rule-2026-08-09'))`.

Not a per-row toggle a writer can flip — a statement of **which standing authorisation produced this row**, with its vocabulary closed by CHECK. A future second learning rule adds a value **in a future migration**: deliberate, reviewable, visible.

**Honest caveat, because it matters:** this is a *record* of authority, not an enforcement of it — a writer can pass the literal. What makes it more than a comment is that **adding a new kind of learning requires a migration, whereas flipping a boolean does not.**

### 6.4 `forward_intent` is NOT the authorisation, and 018 must not quietly make it one

017 stores `forward_intent` and routes it nowhere. It records *"yes, get it every week"* — a **repeat-purchase** signal, which is a different fact from *"when this is ambiguous, this is the one I pick"*. Conflating them would make a parked column suddenly basket-affecting. **Record the boundary; do not consume `forward_intent` in 018.**

---

## 7. The recommended shape

**ILLUSTRATIVE, NOT A MIGRATION.** Column list and constraint intent — the substance of the decision. Exact SQL, idempotency guards, `do $$` role guards and the header narrative belong to the implementation commission.

```
asdair.remembered_choice
  id                     bigint identity primary key

  -- IDENTITY OF THE AMBIGUITY (§2)
  household_id           bigint  not null  -> asdair.households(id)     [NOT NULL, no global scope]
  choice_term            text    not null  [normalised; fixed-point CHECK; btrim <> '' ; len <= 200]
  term_normaliser        text    not null  [e.g. 'keys.normaliseTerm@1']

  -- THE CHOICE (§5)
  chosen_regular_id      bigint  not null  -> asdair.regulars(id)  ON DELETE NO ACTION
  candidate_regular_ids  bigint[] not null [>= 2 members; chosen must be a member; EVIDENCE, not FK]

  -- AUTHORISATION (§6)
  authorised_by          text    not null  [CHECK closed vocabulary]
  source_decision_kind   text    not null  [CHECK in ('existing_regular','variant_choice')]

  -- PROVENANCE AND TIME (§4)
  chosen_at              timestamptz not null            [NO DEFAULT, deliberately]
  source_shop_id         bigint  not null  -> asdair.shop(id)
  source_decision_id     bigint  not null  -> asdair.shop_decision(id)  ON DELETE NO ACTION
  created_at             timestamptz not null default now()
  -- NO updated_at, NO is_stale, NO expires_at, NO chosen_product_name, NO price

CONSTRAINTS
  composite FK (source_decision_id, source_decision_kind)
      -> asdair.shop_decision (id, decision_kind)          [requires a unique index on 017's table]
  check  chosen_regular_id = any(candidate_regular_ids)
  check  array_length(candidate_regular_ids, 1) >= 2
  check  choice_term is its own normalised fixed point

INDEXES
  unique (source_decision_id)                              [structural idempotency, 017's model]
  (household_id, choice_term, chosen_at desc, id desc)      [THE read path: newest wins]

GRANTS
  asdair_rw : SELECT, INSERT + sequence USAGE
  asdair_ro : SELECT
  UPDATE / DELETE : granted to NOBODY, deliberately
```

**Dependencies and numbering.** 018 depends on **001** (schema, households), **004** (regulars), **006** (shop) and — **hard, unlike 017 — on 017 being APPLIED**, because of the composite FK. 017 was written to apply cleanly whether or not 016 had landed; **018 cannot be.** Larry's brief states 017 is the last applied migration, which satisfies this — but the migration header must say so explicitly, because on any database where 017 is authored-but-not-applied, 018 fails at the FK. 018 has **no dependency on 016**. Numbering is forward-only; 018 is next and collides with nothing.

**No backfill.** 017's rule, and for 017's reason: past choices were made before the mechanism existed, and synthesising rows for them would be *"fabrication of exactly the kind catalogue grounding exists to prevent."* **An absent remembered choice means "not yet chosen under this rule" — it never means "no preference exists."**

---

## 8. Coming later — NOT designed here

### 8.1 Household price history (Warwick's future enhancement)

A future reconciliation enhancement will capture **observed prices for ALL accessible Regulars/Favourites** — not merely the products bought — persisted with provenance and observation time. **Warwick has explicitly ruled this must NOT block B15-3 or the first live photo. It is not designed here.**

Compatibility of the recommended shape:

- **Compatible.** `remembered_choice` keys on `asdair.regulars.id`, the same key a price observation must use — `order_confirmation_line.matched_regular_id` already does.
- **Reuse, do not invent:** the estate already has the right vocabulary — `order_confirmation_line.price_basis check (price_basis in ('stated','derived','unknown'))`, with 006's standing rule that *"an inferred price may NEVER be presented as an ASDA-quoted value"* (`006:172-176`). A price-history table should inherit that column verbatim.
- **THE ONE THING THAT WOULD MAKE IT HARDER, AND WHY I AM NOT DOING IT:** do **not** put `price` or `price_at_choice` on `remembered_choice`. It is tempting and it would become an accidental, sparse, unreconciled second price store competing with the real one. **Prices belong in the price-history table, joined by `regulars.id` and time. Explicit non-goal, recorded so it is not added later "while we're in there".**

### 8.2 Archiving the "best value" rule — a SEPARATE commission

Not folded into 018, and flagged for Larry:

- Archiving the 2026-07-21 `rule_qa_log` row and anything it promoted requires an **owner-level migration**, because `asdair_rw` holds no UPDATE on `asdair.rules` (`012:106-110`).
- **Until it is archived, `planner.js`'s prior-answer prose path (`priorAnswersForLine`, `:1151`) will keep surfacing "best value/wash" as an advisory note on the Ariel line.** 018 does not touch it: the new mechanism reads `rule_qa_log` **not at all**, so archival and the new rule are fully independent and can be sequenced in either order.

---

## 9. Anomalies and observations recorded for Larry (not work, not escalations)

1. **Two `normaliseTerm` implementations** — `pipeline/keys.js:193` and `skill/termMatch.js normaliseMatchText` — agree only by a **sample-based** test (`pipeline/stages.test.js:267-270`), not by identity. §2 mitigates this for 018 (`term_normaliser` + fixed-point CHECK). The underlying duplication is pre-existing and out of scope.
2. **`asdair.shop_decision` is absent from 012's enumerated grant matrix** — recorded by 017 itself (`:343-345`) and still true. `asdair.remembered_choice` will make it two. A future re-enumeration picks up both.
3. **`asdair.rules`'s own supersession mechanism is inoperable from the runtime** — `active` and `superseded_by` both require UPDATE, which `asdair_rw` does not hold. Pre-existing; relevant here only because it is one of the three reasons a remembered choice must not live in `rules`.
4. **`shop_decision.forward_intent` remains stored and routed nowhere** after 018, deliberately (§6.4).
5. **Hobby-brain bar applied:** nothing in this decision is escalation-worthy under the § "Proportionality" test. No credential, financial, privacy, safety or destructive-loss surface is touched. All shopping content here is explicitly committable per GL-009 and the `BUILD-015-SHOPPING-DATA-CLASSIFICATION` ruling recorded at `001:117-139`.

---

## 10. The decision, in one paragraph

**Create `asdair.remembered_choice` in migration 018: append-only, newest-wins, `SELECT`+`INSERT` to `asdair_rw` and `SELECT` to `asdair_ro`, with UPDATE and DELETE granted to nobody. Key it on `(household_id, normalised choice_term)` — plain, readable, human-auditable — and accept that a re-worded list line misses and costs one question, because validity is re-checked against this week's grounded candidate set before anything reaches a basket, and because the household's real mechanism for alternate wording is `regulars.aka`, not a second matcher. Store the choice as a foreign-keyed `regulars.id` and never as a name, so a fabricated match is unstorable rather than discouraged. Carry the candidate set as evidence with `>= 2` members, so the mechanism cannot widen past the ambiguity Warwick actually authorised. Bind the sourcing decision's kind with a composite foreign key to 017's table, so "this was an authorised standing preference" is proved by the database rather than asserted by a writer — and so the boolean that silently discarded every answer Warwick ever gave has no successor.**
