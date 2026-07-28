# asdair/shop — the durable spine of the weekly shop

The state store and status projection over `db/006_shop_control_surface.sql`.
**Telegram is a VIEW over these tables. It is never the record.** Every tap, redelivery and runner restart is
answerable from `asdair.shop` alone.

Kept outside `services/asdair/skill/`, which is **read-only by contract** — same boundary, and for the same
reason, as `services/asdair/outcome/`.

| Module | What it is |
|---|---|
| `shopState.js` | **Pure.** The state machine, `nextShopRef`, and the builders that turn an intent into rows. No DB, network, fs, clock or randomness. |
| `shopStore.js` | The writer. One transaction per operation; idempotency is structural, not conventional. |
| `shopStatus.js` | The read-only projection behind "View status". Reads through `asdair_ro`, inside `BEGIN TRANSACTION READ ONLY`. |
| `shop-cli.js` | **The runtime caller.** `node --env-file=<env> shop-cli.js <command> [--json '<json>'] [--dry-run]`. |
| `fakeClient.js` | The scripted `pg` stand-in the offline tests assert statement order against. Not a test file. |

CommonJS, matching `services/asdair/outcome/` — this is the sibling write path, shares its `_internal`-export
and lazy-`pg` idioms, and `outcome/` is the module its reviewers will read it against. (`services/asdair/intake/`
is ESM; the two do not import each other.)

## The transition map

```
RECEIVED       -> TRANSCRIBING | PROCESSING        (photo transcribes first; text does not)
TRANSCRIBING   -> PROCESSING
PROCESSING     -> NEEDS_DECISION | READY_TO_SHOP
NEEDS_DECISION -> PROCESSING | READY_TO_SHOP | SHOPPING
READY_TO_SHOP  -> WAITING_FOR_BROWSER
WAITING_FOR_BROWSER -> SHOPPING | READY_TO_SHOP    (a request can be released without losing the week)
SHOPPING       -> BASKET_READY | NEEDS_DECISION    (an out-of-stock mid-shop)
BASKET_READY   -> ORDER_CONFIRMATION_RECEIVED | SHOPPING   (sent back in to amend)
ORDER_CONFIRMATION_RECEIVED -> RECONCILED
RECONCILED     -> (nothing)   terminal
CANCELLED      -> (nothing)   terminal
FAILED         -> CANCELLED, or resume to EXACTLY the state it failed from
```

Aborts are a **rule**, not map entries: `FAILED` and `CANCELLED` are reachable from every live state, so none of
the twelve can be forgotten. `RECONCILED -> SHOPPING` is refused by name.

**Resuming is never guessed.** The resume target is the `from_status` of the shop's most recent durable `failure`
event, read inside the same transaction that performs the transition. Failing twice does not decay it.

## The four guarantees, and where they are enforced

| Guarantee | Mechanism |
|---|---|
| A redelivered Telegram message resumes, never duplicates a week | `INSERT ... ON CONFLICT DO NOTHING` + re-select on the natural key. **No conflict target**, so it covers both unique indexes. Never check-then-insert — that has a race window between the SELECT and the INSERT. |
| A status change without an audit event is impossible | `applyTransition()` is the only `UPDATE asdair.shop SET status` in the module and always emits the matching `shop_event` immediately, in the same transaction. Asserted on the source text. |
| Two runners can never both claim a build | `UPDATE ... WHERE shop_id = $1 AND status = 'queued' RETURNING` — one statement. The `WHERE` clause *is* the mutual exclusion. |
| A question is asked at most once, ever | `ON CONFLICT (shop_id, question_key) DO NOTHING` + re-select. Re-opening an answered question returns the answer and writes nothing; first answer wins. |

The shop `UPDATE` is built from an allowlist (`status`, `last_error`, `list_id`) rather than filtered against
one, so `household_id`, `shop_ref`, `source_kind` and every `raw_*` evidence column have **no path into the SQL
at all**. Progressing a shop can never rewrite what arrived or which week it belongs to. There is no `DELETE`,
`TRUNCATE` or `DROP` anywhere in the module.

## Credentials

| Env var | Role | Used by |
|---|---|---|
| `ASDAIR_WRITE_DB_URL` | `asdair_rw` | `shopStore.js` only |
| `ASDAIR_DB_URL` | `asdair_ro` | `shopStatus.js` only |

Never hardcoded, never printed, never on a command line, and no credentials file is read. `pg` is required
lazily, so all pure validation loads on a box with no dependencies installed.

## Status: unknown means unknown

`getShopStatus` returns `null` for anything not durably known, and the caller must say **"unknown"** — never zero
and never a guess.

- No `list_id` yet → line counts are `null`, not `0`. "0 of 0 lines resolved" reads as an empty list.
- `stage` is `asdair.shop.status` and nothing else. A queued `browser_build_request` means somebody asked; it is
  **not** evidence that shopping is happening.
- Basket count and totals come from the order confirmation, else from the supervised runner's own `progress`
  record, else `null`. Nothing is inferred.
- Money always carries its **basis**: `stated` (ASDA showed it) or `derived` (inferred). A derived figure may
  never be presented as an ASDA-quoted value, so the basis travels with the number.
- `regulars_added` / `searched_items_added` are read from `browser_build_request.progress`; the runner reports
  them or they are `null`. Nothing here counts rows and calls the result "regulars added".

## Tests

`npm test` (or `node --test`) — fully offline. Pure tests for the state machine; scripted fake-client tests for
the writer and the projection, asserting statement **order and shape**, which is where the guarantees live.
Synthetic fixtures only; no real household data.

`schemaCompat.test.js` parses `db/006_shop_control_surface.sql` and checks every vocabulary, every INSERT column
and every idempotency index the code depends on. **Migration 006 is owned by another work package** — when it is
not present on the branch those checks skip with a loud reason and activate the moment it lands. Verified green
against the real migration: 91/91.
