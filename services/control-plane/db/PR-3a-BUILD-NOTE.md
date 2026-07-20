# BUILD-014 PR-3a — Notification-outbox SCHEMA (migration 005) — BUILD NOTE

**Author:** Silas (Database Architect) · **Status:** built + executed-tested, DEV/synthetic only, NOT applied to any hosted DB, NO PR opened.
**Branch:** `build-014/wp-3a-notification-outbox` (off `main` @ `8e4b348`).
**Scope:** the durable, event-derived Telegram notification **outbox + delivery state machine + the least-privilege notifier role** (v3 correction #5). The actual Telegram **SENDER** (HTTP delivery worker holding creds) is a SEPARATE follow-on (**PR-3b**) and is deliberately NOT built here.

## What / why

Correction #5 requires Telegram delivery via a durable `notification_outbox` **projection derived from `agent_event`** — not a second news store. This PR builds exactly that projection and its delivery lifecycle, with four structural guarantees:

1. **At-most-once per (source_event, destination, class).** One `agent_event` yields ≤1 notification per destination/class. A UNIQUE `(source_event_id, destination, notification_class)` (the `ON CONFLICT` target) plus a non-forgeable derived `dedup_key` (its own UNIQUE) make a redelivery / re-projection **collide and be read back, never duplicated** — the "no dup spam after restart" guarantee.
2. **SILENT is unsendable.** A biconditional CHECK `(class='SILENT') = (state='suppressed')` makes a queued/sending/sent SILENT row **impossible to represent**. SILENT events project to a terminal `suppressed` row (never claimed, never sent).
3. **Bounded retry + dead-letter**, mirroring `ops.job`: `attempts <= max_attempts` (CHECK), `dead_letter` reachable only once the budget is exhausted (CHECK), `next_attempt_at` backoff gate, a guarded state machine (`queued→sending→sent | sending→failed→queued/dead_letter`, plus claim-time `queued→dead_letter` parking of an exhausted row).
4. **Least-privilege notifier (the 5th boundary).** A `notifier` role gets SELECT + **column-level UPDATE on only** `state / attempts / next_attempt_at / sent_at / last_error_code`, plus EXECUTE on the claim/mark helpers — and **no grant on any other `ops` table**. A DEFAULT-DENY guard trigger is the defense-in-depth second wall: every non-delivery column is frozen (23001), DELETE/TRUNCATE rejected, `attempts` monotonic, illegal transitions rejected.

**No secrets in this layer.** There is no Telegram token/chat-id column. `destination` is a LOGICAL channel label (e.g. `warwick_primary`); the sender (PR-3b) resolves it to real credentials outside any reviewer process. The outbox holds only pointers + a sanitised headline/message + deep-link URLs (`cockpit_url`, `github_url`).

## Files

- `db/migrations/005_notification_outbox.sql` — the migration (additive; does NOT modify 001/002; idempotent/re-runnable).
- `db/test/notification-outbox.test.js` — 10 executed constraint-invariant proofs (applies 001+002+005 to a throwaway DB).
- `db/test/run-outbox-tests.mjs` — one-command runner; provisions a disposable Postgres cluster, **fails on 0 executed subtests**.
- `package.json` — `test:outbox` script + appended to the aggregate `test`.

## Objects added (schema `ops`)

- **Enums:** `notification_class` (ACTION_NEEDED · MILESTONE · SILENT), `notification_state` (queued · sending · sent · failed · dead_letter · suppressed). No name collision with any 001/002 table/enum.
- **Table:** `notification_outbox` (columns per the brief: id · source_event_id FK→`agent_event` · notification_class · destination · dedup_key · headline · message · cockpit_url · github_url · state · attempts · max_attempts · next_attempt_at · sent_at · last_error_code · created_at · updated_at). Append-only source binding (FK ON DELETE NO ACTION). Partial ready-index for the claim scan.
- **Functions:** `classify_notification_class(text, jsonb)`, `project_event_to_outbox(uuid, text)`, `notification_outbox_set_dedup_key()` (BEFORE INSERT), `notification_outbox_guard_mutation()` (BEFORE UPDATE/DELETE, default-deny), `claim_notification(text)`, `mark_notification_sent(uuid)`, `mark_notification_failed(uuid, text, integer)`. All pin `search_path = ops, pg_catalog`.
- **Triggers:** set-dedup (INSERT), immutable/state guard (UPDATE/DELETE), touch_updated_at, no-truncate.
- **Security:** RLS enabled + FORCED deny-by-default; `service_role` full DML policy; `notifier` SELECT + UPDATE policies; column-level UPDATE grant to `notifier`; EXECUTE default-denied from public then granted explicitly.

## Classification rules (correction #5)

Highest precedence first: **Warwick-needed → ACTION_NEEDED** (`payload.warwick_needed='true'`, any `warwick.*`, or the explicit action-needed kinds incl. `merge.live_gate`); then **merge landed → MILESTONE** (`payload.merge_landed='true'`, `merge.landed`, any other `merge.*`); then other milestone kinds → MILESTONE; **safe default = SILENT** (routine + unknown). So *merge = always MILESTONE* and *Warwick-needed = always ACTION_NEEDED*, with the merge-live GATE correctly routed to ACTION_NEEDED (a gate needs Warwick).

## Executed test output (proven = EXECUTED, not skipped)

Throwaway Postgres cluster (scoop PostgreSQL, Node 22), migrations 001+002+005 applied per test:

```
# outbox proofs — node db/test/run-outbox-tests.mjs
ok 1 - classification: merge/warwick/routine map to the right class
ok 2 - projection: <=1 row per dest/class, SILENT born suppressed, re-projection idempotent
ok 3 - at-most-once is STRUCTURAL: duplicate (event,dest,class) insert is 23505
ok 4 - SILENT is UNSENDABLE: queued-SILENT unrepresentable; claim skips; suppressed->sending rejected
ok 5 - bounded retry increments to dead_letter at the budget; backoff gates claim
ok 6 - delivery-state guard: non-delivery frozen; DELETE/TRUNCATE rejected; attempts monotonic; illegal transitions rejected
ok 7 - least-privilege NOTIFIER (SET ROLE): delivery UPDATE ok; non-delivery/insert/other-table denied (42501)
ok 8 - helpers drive the state machine: claim -> mark_sent (terminal, sent_at set)
ok 9 - double-apply idempotent; every new ops function pins search_path
# tests 9  # pass 9  # fail 0  # skipped 0

# 001 regression — node db/test/run-db-tests.mjs
# tests 25  # pass 25  # fail 0  # skipped 0
```

Each mandated proof maps to a subtest: at-most-once + re-projection idempotency (2,3,4); SILENT never sending/sent (2,4); merge→MILESTONE + Warwick→ACTION_NEEDED (1); retry→dead_letter at budget (5); delivery-state guard rejects non-delivery mutation (6,7); double-apply idempotent + search_path fence (9). 001 suite re-run proves no regression (additive migration).

## Self-review vs discipline (001 standards carried)

- RLS forced deny-by-default; `service_role`-only + a scoped `notifier` role; column-level grant + guard = two walls. ✓
- `ops.job` retry/dead-letter/lease pattern mirrored (attempts≤max CHECK, dead-letter-requires-exhausted CHECK, FOR UPDATE SKIP LOCKED claim, exhausted parking). ✓
- `set search_path = ops, pg_catalog` on **every** function (catalog fence test 9). ✓
- Named CHECKs; no enum/table name collision; append-only source binding (FK to immutable `agent_event`); TRUNCATE guard; default-deny column-freeze guard mirroring `merge_gate_guard_mutation` (R5-1). ✓
- No secrets: no token/chat-id column; destination is a logical label; body carries only pointers + sanitised text + deep-links. ✓
- Idempotent/re-runnable; DEV-only header; never targets `asdair`/live. ✓

## Decisions

- **dedup_key is trigger-derived, not a GENERATED column.** The identity key must include `notification_class`, but the enum→text cast is only STABLE (a generated-column expression requires IMMUTABLE — Postgres rejects it: `42P17`). A BEFORE INSERT trigger overwrites any caller value with `source_event_id|destination|class`, preserving non-forgeability. The composite UNIQUE is the primary structural guarantee (and the `ON CONFLICT` target); the derived `dedup_key` UNIQUE is defense-in-depth.
- **SILENT rows are still projected** (as terminal `suppressed`) rather than skipped — gives the cockpit an audit trail of the SILENT classification and makes re-projection idempotent for SILENT too.
- **No `lease_owner` column.** The brief's delivery-state column set is `state/attempts/next_attempt_at/sent_at/last_error_code`; I did not invent a durable lease column. Concurrency safety for multiple notifiers is via `FOR UPDATE SKIP LOCKED` at claim; `mark_*` helpers refuse to act on a row that is not `sending` (stale/duplicate completion rejected).
- **Grants are encoded here but the full DB-role wiring is PR-4.** Per the brief, this migration includes the intended `notifier` grants + policies + the structural guard; PR-4 owns applying/testing the role wiring end-to-end (dedicated login role, denied-access matrix on hosted DEV).

## Residuals for reviewers (Codex product-QA / Fable adversarial)

- **Threat-model residuals inherited from 001** (documented, accepted for DEV): a SUPERUSER/BYPASSRLS role sidesteps RLS; the table owner can `DISABLE TRIGGER` / `SET session_replication_role=replica` to bypass the guards. Out-of-band admin actions, not reachable by the runtime roles.
- **`mark_notification_failed` performs two UPDATEs (sending→failed, then failed→queued|dead_letter) in one call.** Both pass the guard; the intermediate `failed` state is transient within the transaction. Reviewers: confirm this is acceptable vs a single sending→(queued|dead_letter) transition (I kept `failed` explicit so a crash between the two UPDATEs leaves an inspectable `failed` row that a reclaim path in PR-3b can re-drive).
- **No reclaim/watchdog for stuck `sending` rows yet.** If the sender dies mid-send, a row can sit in `sending`. That reclaim (analogous to `ops.reclaim_expired_leases`) belongs with the sender in **PR-3b**; the state machine here already permits a `sending→failed→queued` re-drive.
- **Classification is event-kind + payload-flag driven.** The kind sets are a starting taxonomy; the real event-kind vocabulary lands as PR-1/PR-2 emit events. Reviewers: sanity-check the ACTION_NEEDED/MILESTONE kind lists against the intended `agent_event` vocabulary; the safe default (SILENT) means a mis-mapped unknown under-notifies rather than spams.

## Boundaries honored

DEV/synthetic only · not applied to any hosted/live DB · no real Telegram creds anywhere · idempotent · no PR opened, no merge, no live apply.
