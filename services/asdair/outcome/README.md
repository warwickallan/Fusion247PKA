# asdair/outcome — the write path

The **only** writers for `asdair.orders`, `asdair.order_events` and `asdair.rule_qa_log`, plus the learning
promotion into `asdair.rules`.

Kept deliberately outside `services/asdair/skill/`, which is **read-only by contract** (`skill/README.md`) — its
adapter issues SELECTs inside `BEGIN TRANSACTION READ ONLY` and its role holds SELECT and nothing else. Mixing a
writer into that folder would erode the guarantee that a planning bug physically cannot write.

| Module | What it is |
|---|---|
| `buildOutcome.js` | **Pure.** Plan + reconcile record → the `order` and `events` rows to write. No DB, network, fs, clock or randomness. |
| `recordShopOutcome.js` | Writes one shop: order + its events, in a single transaction. |
| `promoteDecision.js` | Records a decision and, where its provenance proves the instruction was explicit, promotes it into a durable rule with a `promoted_rule_id` back-link. |

## Why the loop exists

The schema always designed a closed loop — request → plan → approval → shop → **record what actually happened** →
**learn** → next run uses it. Until 2026-07-27 the three outcome tables had **zero writers anywhere in the repo,
including tests**, so every shop was forgotten and the promotion mechanism was dead code. This module is that
missing half.

## Credentials — two roles, deliberately

| Env var | Role | Privileges |
|---|---|---|
| `ASDAIR_DB_URL` | `asdair_ro` | **SELECT only**, whole `asdair` schema. The read/planning path. Never writes. |
| `ASDAIR_WRITE_DB_URL` | `asdair_rw` | The narrow write path below. Used **only** by this module. |

`asdair_rw` grants (provisioned 2026-07-27, Warwick authorised):

```
USAGE  on schema asdair
SELECT, INSERT  on asdair.orders, asdair.order_events, asdair.rule_qa_log, asdair.rules
UPDATE on asdair.rule_qa_log.promoted_rule_id     -- column-scoped: the back-link, nothing else
SELECT on asdair.source_documents                 -- read-only, for provenance verification
USAGE  on the four loop tables' identity sequences
```

Verified by negative probe, connected as the role: it **cannot** update any other column, **cannot** DELETE,
**cannot** read or write `asdair.regulars` or `asdair.products`, and **cannot** CREATE. It is not a superuser and
holds no CREATEROLE/CREATEDB/BYPASSRLS. Secrets live only in the off-repo store, never here.

## The promotion guard

**Automatic promotion defaults to `directive='info'`** — durable and inspectable, but behaviourally inert: the
pure planner ignores it and it never changes a basket.

An **actionable** directive (`exclude` / `needs_decision` / `map`) is created only where the decision's own durable
provenance proves the instruction was explicit. The trust boundary is **source evidence, never a caller
assertion**:

- the decision's `source_document_id` is resolved against `asdair.source_documents`, **in the database**;
- `doc_type` of `agent_spec` or `decisions_log` → actionable is allowed;
- anything else — `order_history`, `shopping_list`, `readme`, unknown, unresolved or absent → **downgraded to
  `info`**, with the reason appended to the rule's `note` so the downgrade is visible and auditable.

There is deliberately **no `explicit` / `trusted` / `force` parameter**, and a property test sprays twenty such
flag names at both the decision and the rule payload to prove none of them can force an actionable directive.
`buildPromotion` is structurally incapable of emitting one: it always emits `info` plus a record of what was
*requested*, and only the verified DB layer may raise it. Any path that skips verification therefore yields an
inert rule.

`one_week_only` / `scope='one_time'` is never promoted at all (standing rule 10).

The objective: **autonomous learning, without one ambiguous event becoming permanent false doctrine.**

### What the guard guarantees — and what it does not (TQA-PR73-002)

Raised as HIGH by independent Codex QA; **Codex was correct**, and Warwick accepted the residual for BUILD-015 on
2026-07-28 as a deliberate product decision.

**Guaranteed — AUTHORITATIVE PROVENANCE ELIGIBILITY:**

> An actionable promotion must inherit the **persisted decision's** `source_document_id`, and that source must be
> an **authorised document type** (`agent_spec` / `decisions_log`), verified by lookup in the database.

**NOT guaranteed:**

> The system does **not** prove that the promoted instruction text literally occurs in the cited document.

**Never describe this as "content-proven explicitness" or any equivalent.** It proves provenance of **citation**,
not of **content**. A caller citing the agent spec while promoting an unrelated instruction would pass the gate.

**Why the residual is accepted here:** promotion callers are first-party Fusion components · non-authoritative
learning is downgraded to behaviourally inert `info` rather than dropped · the promotion-stage caller **cannot
substitute a different `source_document_id`** (the rule always inherits the decision's — guarded by test) · every
resulting rule retains provenance and audit history · hard rules are reversible via `active = false` · Warwick
retains the consequential checkout and payment gate · and content verification would require a genuinely new
source-content capability, since `asdair.source_documents` stores a title and a pointer, not text.

**Trigger to reconsider:** this bound does **not** automatically survive if hard-rule promotion is opened to
untrusted or external inputs, materially more autonomous sources, or higher-consequence domains.

Full record: `Builds/BUILD-015-asdair-durable-household-shopping-steward/ACCEPTANCE-AND-EVIDENCE.md`.

## Tests

`npm test` (or `node --test`) — pure-logic tests need no database. DB-touching tests follow the repo's gated
`.dbtest.js` pattern and stay inert without `ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE`. Fixtures are synthetic only.

## Known gaps

- `asdair.rules.source_document_id` exists but is still never written, so a promoted rule carries no provenance
  pointer of its own (the *decision* does). Follow-up.
- Nothing calls these writers from a runtime path yet — closing the loop in practice needs the shop run to invoke
  them. See [[SOP-021-run-the-weekly-asdair-shop]] steps 5 and 6.
