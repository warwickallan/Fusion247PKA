---
name: BUILD-015 — acceptance and evidence
owner: larry
tags: [build, asdair, acceptance, evidence]
---

# BUILD-015 — Acceptance and evidence

Running record. Evidence only — no claims without an executed result behind them.

---

## Accepted residual limitation — TQA-PR73-002 (Warwick's ruling, 2026-07-28)

Raised as **HIGH** by independent Codex QA against PR #73. **Codex is correct.** Accepted as a deliberate
product and risk decision for BUILD-015 — **not** a claim that the finding was wrong.

### What is actually guaranteed

> **AUTHORITATIVE PROVENANCE ELIGIBILITY**
>
> An actionable promotion must inherit the **persisted decision's** `source_document_id`, and that source must be
> an **authorised document type** (`agent_spec` or `decisions_log`, verified by lookup in the database).

### What is NOT guaranteed

> The system **does not** prove that the promoted instruction text literally occurs in the cited document.

**Do not describe this guard as "content-proven explicitness" or any equivalent.** It proves provenance of
**citation**, not of **content**.

### Why the residual is accepted here

- promotion callers are **first-party Fusion components**;
- non-authoritative learning is **downgraded to behaviourally inert `info`**, never silently dropped;
- the promotion-stage caller **cannot substitute a different `source_document_id`** — the rule always inherits the
  decision's, guarded by test;
- every resulting rule **retains provenance and audit history** (`rules.source_document_id` plus the
  `rule_qa_log.promoted_rule_id` back-link);
- hard rules are **reversible** via `active = false`;
- **Warwick retains the consequential checkout and payment gate**;
- content verification would require a **genuinely new source-content capability** — `asdair.source_documents`
  stores a title and a pointer, not document text.

### Trigger for reconsidering

**This accepted bound does not automatically survive** if hard-rule promotion is ever opened to untrusted or
external inputs, to materially more autonomous sources, or to higher-consequence domains. Re-open the question at
that point rather than inheriting this ruling.

**Status for BUILD-015: ACCEPTED RESIDUAL LIMITATION — not a merge blocker, by Warwick's ruling.**
No content-verification build is authorised.

---

## Independent QA history (Tower merge-check, PR #73)

| Head | Verdict | Findings | Outcome |
|---|---|---|---|
| `09bc203` | `request_changes` | 3 | TQA-PR73-001 **HIGH** — global-regulars contradiction |
| `fab2cee` | `request_changes` | 2 | 001 **resolved**; 002 raised |
| `55546ab` | *(pending re-review)* | — | 002 accepted by ruling; strengthened as far as possible |

### TQA-PR73-001 — HIGH, FIXED

`asdair.regulars.household_id` is `NOT NULL`, but `loadRegulars` queried `household_id IS NULL` for an unnamed
run and therefore returned **zero rows silently** — a planner that resolves nothing while appearing to work.
Unlike `products` and `budget_settings`, there is no global regular.

**A genuine integration defect that existed only at the seam between two workers**: one wrote the migration from
the live table's real shape, the other wrote the loader assuming a convention that does not hold for this table.
Neither could see it alone. Now throws with an explanatory message; two regression guards added.

### TQA-PR73-003 / evidence findings

Codex could not see test or CI results in the read-only packet. Recorded here instead:

- **CI green at `fab2cee`** — `unit` pass, `integration` pass, `secret-scan` pass.
- **Local suites on the integrated branch** — `services/asdair/skill` 186 tests / 184 pass / 0 fail;
  `services/asdair/outcome` 62 tests / 61 pass / 0 fail. Skips are the DB-gated `.dbtest.js` files, inert without
  `ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE`.

---

## Live proof already executed

- **Loop closes end-to-end through the real writer modules** as `asdair_rw`: instance A recorded a shop (3 events,
  `checked_out = false`) and promoted a decision; a **separate instance B with no knowledge of A** read only
  durable state and saw both, with provenance. Synthetic household, removed afterwards, zero rows remaining.
- **Promotion guard proven against the live database**: non-authoritative source → downgraded to `info` with a
  visible note · **flag-spray** (`explicit`/`trusted`/`force`/`override`/`skip_verification` on both payloads) →
  still `info` · authoritative source → actionable granted · `one_week_only` → refused outright.
- **Credentials negatively probed as the role itself**: `asdair_rw` cannot `DELETE`, cannot read or write
  `regulars`/`products`, cannot `CREATE` — all `42501`. Not superuser; no `CREATEROLE`/`CREATEDB`/`BYPASSRLS`.
  `asdair_ro` verified SELECT-only.
- **Fresh-instance orientation**: a bound Asdair instance oriented entirely from committed files plus database
  state, and correctly predicted from its own contract which paths would be missing.

## Outstanding before a READY verdict

Remaining Class-A fixes · behavioural fresh-AsdAIr acceptance on the full scenario · final integrated CI ·
independent Tower/Codex QA against this revised contract.

---

## FINAL VERDICT (behavioural acceptance, 2026-07-28)

# NOT READY for autonomous Lane 2. READY for **supervised** Lane 2.

A fresh bound Asdair instance ran the full scenario against the repaired code and actively tried to break it.

### What passed — on evidence, not assertion

- **Quantity parsing.** `milk 2` → 2, `yazoo strawberry 4` → 4, and **`omega 3` survived intact as an identity**,
  not a quantity. Probed both directions: `omega 3 x2` → 2 × "omega 3", `milk 2L` → qty 1, `7up` → qty 1. The
  curated collision-list mechanism is the honest approach rather than a clever regex that would fail later.
- **Never auto-substitute.** Nothing invented a substitute; `matched_product` was null on every held line.
- **Hard excludes fire on both alias orderings** — `yazoo banana` and `banana yazoo` both excluded, qty 0.
- **Nothing unidentified reached `add`.** The old confidently-wrong failure is gone.
- **The read path physically cannot write.** Every statement a SELECT as `asdair_ro`.

Criteria **5, 6 and 7 pass on evidence.**

### What blocks autonomy

1. **Resolution is 52% on the household's own historical vocabulary.** Measured over 73 distinct past list terms:
   38 add / 34 needs_decision / 1 excluded. `matchRegular` does **exact normalised-string equality** against
   `name` and each `aka`, so `"yazoo strawberry"` misses the alias `"strawberry yazoo"` **on word order alone** —
   proven by running the reversed form, which resolves. Only 28 of 91 regulars carry any alias.
   *A lane that hands back half the list every week is a triage queue, not a lane.*
2. **The needs-decision queue ships with `alternatives: []`.** `rankAlternatives` consults `products` (11 rows)
   only, never `regulars`, and needs a resolvable category an unmatched free-text line does not have. Standing
   rule 6 has two clauses — never substitute **and** surface alternatives. The second is currently performed by
   whichever human reads the output.
3. **The learning loop cannot close where it matters most.** Every one of the six held decisions is fundamentally
   "this name means that product" — an `aka` alias — and **`asdair_rw` has no write on `regulars`**.
   `promoteDecision` writes `rules` and `rule_qa_log` only. Without a governed `regulars` writer, next week's
   instance asks the same six questions. That is precisely the failure this build exists to end.

### Disqualifying for the stated gate — and Larry's error

**The acceptance ran against a worktree that does not contain the specialist contract or SOP-021.** Both are
committed only on `idea-016/idea-engine`; they are absent from `main` and therefore from this build's ancestry.
The instance passed only because it went looking on another branch and recovered them by inference. A stricter
instance would have stopped, or improvised a method.

**Criterion 1 is corrected to ⚠️ above.** Cause: Larry committed every governance artefact tonight while the main
tree sat on `idea-016/idea-engine`, never noticing the branch. Fix is a merge decision, not a code change.

### Further defects found, recorded not fixed

- **Same-class silent-null trap on the budget side.** If a household has no `budget_settings` row, `loadBudget`
  returns the **global** row with `household_id: null`, `planBasket` derives `household = null`, and **every
  household-scoped regular falls out of scope — resolving nothing while appearing to work.** This is the exact
  failure Codex caught in `loadRegulars` (TQA-PR73-001), through a different door, and it is **not** guarded.
- **`map` directives can resolve to prose, and prose reaches `add`.** Rule 23 maps `sure male` →
  *"Sure Men Anti-Perspirant Deodorant (blue variant)"*; confirmed to return `status: add, planned_qty: 1`.
  "Confidently matched" means `matched_product !== null`, which a human-readable *instruction* satisfies — so a
  line can be planned as `add` with a name nobody can put in a trolley.
- **Rotation is structurally dead.** SOP-021 §2 makes the last order a *required* planning input; there is no
  `loadLastOrder` and `planBasket` has no parameter for it, so rule 32 (rotate the Sure variant) cannot run —
  the same "documented, implemented, dead" class as rule 7.
- **`Arla BOB Semi-Skimmed 2L` (regular 69) is ACTIVE** while rule 10 says never buy BOB. Rule 10 is `info` with
  no `match_term`, so nothing enforces it. `milk` resolves correctly today **only because regular 69 happens to
  carry no alias.** Add `milk` as an alias there and the planner would add a product a standing rule forbids.
- **`Yazoo Banana` appears in `previously_ordered` dated 2026-07-20** — two days *after* the hard-exclude was
  recorded. The planner would have excluded it; whatever produced that row did not.
- **Exclude rules carry no reason to the human** (`reason` is NULL on 17/26), so an excluded line cannot say why.
- **`substitutes_allowed` is `false` on all 91 regulars**, so the flag currently carries no discriminating
  information — the mechanism works, the data does not exercise it.
- Stale claim in `skill/README.md` (~lines 146–149) that `regulars` is not in a committed migration; `004` now
  defines it on this branch.

### Unblocking work, named for a future build — NOT started

(a) land the contract and SOP-021 into this build's ancestry · (b) order-insensitive alias matching plus alias
coverage on `regulars` · (c) `rankAlternatives` to consult `regulars` · (d) a governed writer for `regulars.aka`
and a `loadLastOrder` input · (e) guard the budget-side null-household trap · (f) reject prose as a `map` target.

**Per doctrine, the specialist named these and touched no line of `services/**` to fix them.**
