# ⛔ DECOMMISSIONED — Postgres/Supabase structural head-authority hardening

> **STATUS: REFERENCE-ONLY DESIGN CAPITAL. ZERO CURRENT AUTHORITY.**
>
> **This is a historical Supabase/Postgres alternative, preserved for possible future architectural
> reactivation. It is NOT part of the current system, is NOT applied to any database, has NO caller,
> and is NOT on any live migration, runtime or application discovery path.**
>
> **SQLite remains the current canonical architecture** unless Warwick explicitly decides otherwise later.

## Why this exists rather than being deleted

Warwick's ruling, BUILD-020 Sub-phase 4C, 2026-08-07:

> *"The original Supabase/Postgres control-plane work was valuable work. The subsequent move to SQLite
> happened during a later recovery/change of direction and does not justify throwing away a reusable
> implementation that may be deliberately revived in future."*

It was recovered from `build-014/before-live-hardening` @ `60bf97bf78517c50e5302e0c6ecd8cfc87c6b753`
during the 4C estate reconciliation. A forensic re-audit established that **none of it is represented
on canonical `main`** — `git grep "arrival_seq\|head_seq\|merge_gate_bind_current_head\|build_head_monotonic_guard"`
against canon returns nothing.

**Its own commit message is the honest caveat:** *"WIP: before-live-hardening partial (agent stopped
mid shared-tree race) — preserved for isolated re-run."* **Judge it as a design plus a partial
implementation, not a finished deliverable.**

## What is preserved here

| File | What it is |
|---|---|
| `head-authority-structural.sql` | **272 lines.** Makes three head-authority guarantees **DB-structural** rather than JS-boundary-deep. Documents the full lock order for deadlock-freedom. |
| `githubIngress.ingress-hardening.patch` | Namespaced ingress delivery keys (`github:<id>`) so a webhook key cannot collide with or forge the runtime's reserved `job:`/`effect:` ledger namespaces; divergent-body redelivery fails closed with a 409 and whole-transaction rollback instead of silently collapsing two distinct events into one. |
| `events.divergent-redelivery.patch` | `verifyPayloadHashOnConflict` opt-in on `appendEvent` — on conflict, compare the stored `payload_hash` and throw `DIVERGENT_REDELIVERY` rather than returning "deduped". Default OFF. |
| `wp-c-e2e.test.patch` | One line, following the namespacing change. |

**The three guarantees the SQL makes structural**, each closing a bypass found by Fable:

1. **P2** — a raw `INSERT` binding a `merge_gate` to an old head (BEFORE INSERT bind trigger).
2. **P3** — a raw `UPDATE` moving `ops.build_head` backward (BEFORE UPDATE monotonicity guard).
3. **Clock-step ordering** — a new set-once `ops.checkpoint.arrival_seq` sequence replacing wall-clock `created_at`.

**One characterisation stated precisely rather than dramatically.** The ingress patch also adds a strict
`/^[0-9a-fA-F]{64}$/` shape check before `Buffer.from(provided,'hex')`, on the correct observation that
Node's hex decoder truncates silently at the first invalid nibble rather than throwing. **This is
hardening, not a live bypass** — the current length check catches short decodes, and a "valid digest plus
trailing junk" string still requires possessing the correct digest. Call it signature malleability.
**No signature-verification hole is being claimed, because the evidence does not support one.**

## ⛔ Reactivation

**Reactivating any of this requires a NEW explicit Warwick architecture decision**, and reconciliation
against the then-current system. It may not be revived incrementally, by a specialist, or as a side
effect of other work.

Specifically, on reactivation:

- **The SQL must NOT be renumbered into the current live migration sequence as-is.** Its original slot
  `003` is occupied on `main` by `003_contract_acceptance_schema.sql`. It also hardens
  `002_current_head_authority.sql`, so it depends on the Postgres control-plane schema existing at all.
- It targets **Postgres/Supabase**, not the current SQLite store. Equivalence is not assumed and must be
  re-established.
- The implementation is **partial by its author's own statement** and needs the isolated re-run it never got.

## Pointer

Discoverable from the current control-plane architecture record. **This directory is the only home for
this material; it is not duplicated elsewhere, and it must not be copied back into `services/**` without
the decision above.**
