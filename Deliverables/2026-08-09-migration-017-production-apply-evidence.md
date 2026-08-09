# Migration 017 — PRODUCTION APPLY EVIDENCE, household database

**Executed by:** Larry · **Date:** 2026-08-09 · **Authority:** Warwick, explicit, this session
**Target:** household Supabase project `kerdinlgcfxnjrztwqde`, database `postgres`, schema `asdair`
**Route:** Supabase MCP `apply_migration`, name `017_shop_decision` — the same route as 016 on 2026-08-08
**Result:** ✅ **APPLIED AND VERIFIED. V1–V7 ALL PASS.**

> **Structural evidence only.** No household content appears here — no `question_text`, no `answer_text`,
> no `raw_reading`, no `regulars.name`, no `decision_evidence`. Column names, constraint definitions,
> index definitions, booleans and a zero count. Per the runbook §4.1.

---

## 1. The bytes that were applied, and how byte-exactness was PROVEN rather than asserted

Silas's runbook §3.2 requires the file whole and unedited: *"Any edit-in-transit invalidates the proof
this runbook rests on."* The MCP route takes a **string**, so the file had to be reproduced into the
call. That reproduction was **proved identical before the call was made**, not trusted:

| | |
|---|---|
| Canonical source | `services/asdair/db/017_shop_decision.sql` @ `main` (`46fc8c9`) |
| Identical to branch tip | `git diff build-015/wp-b15-2 -- <file>` → **empty** |
| Canonical committed blob | **18,038 bytes**, LF, `sha256:5cafed16213d5d67792b0428aefccf4939470bd7132f2655a601efc13cc27e99` |
| Larry's reproduction | **17,668 chars** normalised, `sha256:5cafed16213d5d67792b0428aefccf4939470bd7132f2655a601efc13cc27e99` |
| Verdict | **IDENTICAL — hashes match exactly.** |

### Two corrections to the runbook's own description of the file

Both are harmless to the migration. Both are recorded because the runbook states them as verified facts
and they are not.

1. **The file is NOT pure ASCII.** It contains **185 `U+2500`** box-drawing characters in its section
   header rules. The file's own header says *"PURE ASCII"* and the runbook §3.2 says *"pure ASCII with
   no secrets and no rows (verified)"*. The characters live entirely inside `--` comments and Postgres
   accepts UTF-8, so there is **no effect on the migration**. The verification claim was simply wrong.
2. **The working copy and the committed blob are NOT byte-identical.** The working copy is **CRLF**
   (18,383 bytes); the committed blob is **LF** (18,038 bytes). The difference is exactly 345 bytes =
   one `\r` per line. Runbook §3.2 instructs *"confirm the two are identical"*, which cannot literally
   pass on a Windows checkout. **The committed blob was taken as canonical**, and line endings are
   semantically irrelevant to Postgres.

---

## 2. ⚠️ THE APPLY FAILED ONCE. What happened, and why re-running was correct rather than reckless

**First attempt returned:**

```
HttpException: upstream connect error or disconnect/reset before headers.
                reset reason: connection termination
```

This is a **gateway/transport error, not a Postgres error** — the SQL was never rejected. It is
runbook §3.4's named row: *"Statement timeout / connection drop mid-batch → Possible partial apply →
STOP, do not panic-repair. Run V-ALL to see what exists."*

**The rule was followed exactly: nothing was re-run until state had been read.**

### State read IMMEDIATELY after the failure — nothing had landed

| Object | Present after the failure? |
|---|---|
| `asdair.shop_decision` | **false** |
| New `shop_question` columns (`question_round`, `parent_question_id`) | **0** of 2 |
| New CHECK guards (the three) | **0** of 3 |
| New `shop_question` indexes (`..._id_shop_uniq`, `..._round_uniq`) | **0** of 2 |
| Row in `supabase_migrations.schema_migrations` for 017 | **absent** — last entry was `wp_b15_1_shop_source_image_016` |

**A completely clean failure. No partial application, no history row, no drift.** The database was
byte-for-byte the state all eight preflights had measured.

**Only then was the identical file re-applied**, which is precisely the runbook's recovery rule —
*"the recovery from a partial apply is to fix the cause and re-run the same file"* — under its
precondition, *"re-running is safe, but re-running before you know what happened destroys the evidence
of what happened."* The state was known. The second attempt returned `{"success": true}`.

> **A note on §1.7, stated carefully and NOT over-claimed.** Silas could not verify whether
> `apply_migration` is transactional and the stop conditions assumed the worse case. This incident is
> **consistent with** transactional behaviour but does **not prove it**: the failure was at the
> transport layer and may have occurred before any SQL reached Postgres at all. **§1.7 remains open.**
> One clean failure is not a proof of atomicity.

---

## 3. V1 — `shop_decision` has exactly 16 columns, and no `updated_at`. ✅ PASS

| # | Column | Type | NOT NULL |
|---|---|---|---|
| 1 | `id` | `bigint` | ✅ |
| 2 | `shop_id` | `bigint` | ✅ |
| 3 | `question_id` | `bigint` | ✅ |
| 4 | `decision_kind` | `text` | ✅ |
| 5 | `decided_regular_id` | `bigint` | — |
| 6 | `decided_quantity` | `integer` | — |
| 7 | `decided_item_name` | `text` | — |
| 8 | `clarification_reason` | `text` | — |
| 9 | `forward_intent` | `text` | — |
| 10 | `interpreted_by` | `text` | ✅ |
| 11 | `interpreted_model` | `text` | — |
| 12 | `interpreted_at` | `timestamptz` | ✅ |
| 13 | `decision_evidence` | `jsonb` | ✅ |
| 14 | `grounding_fingerprint` | `text` | — |
| 15 | `evidence_shop_line_id` | `bigint` | — |
| 16 | `created_at` | `timestamptz` | ✅ |

**Exactly 16, in the expected order, with the expected nullability. No `updated_at`** — the column that
would have been a lie, since no role holds UPDATE.

## 4. V2 — `shop_question` gained exactly two columns, and all three guards exist. ✅ PASS

- `question_round` — `integer`, **NOT NULL**, **default `1`**
- `parent_question_id` — `bigint`, nullable, **no default**

**All three constraints present**, definitions verbatim:

```
shop_question_round_sane          CHECK ((question_round >= 1))
shop_question_round_parent_agree  CHECK (((parent_question_id IS NULL) = (question_round = 1)))
shop_question_not_own_parent      CHECK (((parent_question_id IS NULL) OR (parent_question_id <> id)))
```

**This is the R1 test and it passed.** Fewer than three would have meant a guard silently skipped a
constraint that was never created — the single failure mode the entire preflight was built around.
**Three of three.**

## 5. V3 — 19 constraints, and the fifteen CHECK vocabularies. ✅ PASS

**Counts: `c` = 15 · `f` = 3 · `p` = 1 — 19 total.** Exactly as required.

**The three vocabulary CHECKs, verbatim from the database:**

| Constraint | Landed vocabulary | Required |
|---|---|---|
| `shop_decision_kind_known` | `existing_regular`, `quantity_change`, `variant_choice`, `new_item`, `skip_this_week`, `clarification_required` | **six, exact match** ✅ |
| `shop_decision_forward_intent_known` | `yes`, `no`, `unclear` (or NULL) | exact match ✅ |
| `shop_decision_interpreter_known` | `terra`, `human`, `rule` | exact match ✅ |

**All twelve remaining CHECK names present:** `_regular_required`, `_new_item_shape`,
`_name_only_for_new`, `_name_shaped`, `_qty_required`, `_qty_sane`, `_skip_shape`,
`_clarification_shape`, `_clarification_decides_nothing`, `_evidence_is_object`,
`_terra_shows_its_work`, `_grounding_fingerprint_shaped`.

Notable, since it is the governance constraint:
`shop_decision_terra_shows_its_work  CHECK (((interpreted_by <> 'terra') OR (decision_evidence <> '{}'::jsonb)))`

## 6. V4 — the composite FK and both simple FKs. ✅ PASS

```
shop_decision_question_fk
    FOREIGN KEY (question_id, shop_id) REFERENCES asdair.shop_question(id, shop_id) ON DELETE CASCADE
shop_decision_decided_regular_id_fkey
    FOREIGN KEY (decided_regular_id) REFERENCES asdair.regulars(id)                  -- NO ACTION, deliberate
shop_decision_evidence_shop_line_id_fkey
    FOREIGN KEY (evidence_shop_line_id) REFERENCES asdair.shop_line(id) ON DELETE SET NULL
```

**The composite key landed as composite.** A single-column FK would have let `shop_id` drift from its
question's `shop_id` — the exact invariant this key exists to make impossible.

## 7. V5 — indexes. ✅ PASS

| Index | Definition |
|---|---|
| `shop_decision_pkey` | UNIQUE btree `(id)` |
| `shop_decision_question_uniq` | **UNIQUE** btree `(question_id)` |
| `shop_decision_shop_idx` | btree `(shop_id, id)` |
| `shop_decision_shop_kind_idx` | btree `(shop_id, decision_kind)` |
| `shop_question_id_shop_uniq` | **UNIQUE** btree `(id, shop_id)` |
| `shop_question_round_uniq` | **UNIQUE** btree `(shop_id, parent_question_id, question_round)` **WHERE `parent_question_id IS NOT NULL`** |

Pre-existing `shop_question` indexes intact and untouched: `shop_question_pkey`,
`shop_question_key_uniq` (the `(shop_id, question_key)` uniqueness 017 promised not to disturb),
`shop_question_open_idx`.

**`shop_decision_question_uniq` is UNIQUE** — the structural idempotency the writer's
`ON CONFLICT (question_id) DO NOTHING` depends on.

## 8. V6 — GRANTS: the immutability claim as nine booleans. ✅ PASS

```
rw_select=t   rw_insert=t   rw_update=f   rw_delete=f   rw_truncate=f
ro_select=t   ro_update=f   ro_delete=f   rw_seq_usage=t
```

**Exactly the required result, with no deviation.** A current-shop decision is immutable to both
application roles **by absent grant**, not by convention.

**Neither "role absent — skipping grants" NOTICE occurred** — both would have been stop conditions, and
`rw_insert=t` / `ro_select=t` prove the grant blocks executed rather than being skipped.

**Reading instruction, unchanged from runbook §1.6:** immutable means immutable **to the application
roles**. The owner (`postgres`), the service key and the dashboard retain full privileges. That is the
estate's established model since 016 and is correct for this purpose.

## 9. V7 — table empty, and R2 still holds after the apply. ✅ PASS

- `select count(*) from asdair.shop_decision` → **0**. 017 performs no backfill, by design.
- **PRE-4 re-run verbatim** — all seven still `false`:

```
rw_delete_question=f  rw_delete_line=f  rw_delete_shop=f  rw_delete_regulars=f
ro_delete_question=f  ro_delete_line=f  ro_delete_shop=f
```

**R2 holds after the apply as it did before.** The FK referential actions that run with owner authority
and bypass grants cannot be reached, because no application role holds DELETE upstream.

---

## 10. Verdict

**MIGRATION 017 IS APPLIED TO THE HOUSEHOLD DATABASE AND FULLY VERIFIED. V1–V7 ALL PASS.**

Both proof residuals are now discharged **on the real database, after the apply**: R1 by V2 (three of
three guards), R2 by V7's PRE-4 re-run. The immutability claim is proven by execution as nine booleans.

**What this does NOT yet claim:**

- **Nothing has exercised the table.** It is empty and correct. No production code has written a
  decision, and no answer has yet changed a shop.
- **§1.7 remains open** — transactionality of `apply_migration` is not proven, per §2 above.
- **The runtime cutover is a separate step** with its own evidence, and the live acceptance is a
  separate event again requiring a genuinely new photograph. **Shop 6 remains prohibited as
  manufactured acceptance evidence.**
