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
