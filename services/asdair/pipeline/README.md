# asdair/pipeline — the join

**BUILD-015 Stage 1. The keystone.**

Every component of AsdAIr existed and was tested in isolation. **Nothing joined them.** The weekly shop
only worked because Larry stitched scripts together by hand each week — which is the
capability-lives-in-a-session failure this whole build exists to end.

This folder is the join: a **channel-neutral, idempotent, resumable** workflow that Telegram and the
Cockpit both drive through the **same commands**.

> **Telegram is a VIEW over Postgres. It is never the record.**
> Every tap, redelivery, restart and reboot is answerable from `asdair.shop` and its siblings alone.

```
                Telegram  ─┐
                            ├──►  commands.js  ──►  asdair.pending_action  (the durable ledger)
                Cockpit   ─┘            │
                                        │  records intent. NEVER advances the state machine.
                                        ▼
                              runPipeline.js  ──►  ONE legal step, from durable state
                                        ▲
                                        │
                                  runtime.js  ──►  poll · advance · send · exit
```

---

## Files

| File | What it is |
|---|---|
| `commands.js` | **The channel-neutral command surface.** Twelve commands. The only way anything asks AsdAIr to do something. |
| `commandNames.js` | The command vocabulary + per-command specs. An **allowlist** — a name not on it throws. |
| `stages.js` | **PURE.** The stage table, and `decideNextStep(snapshot)` — the one next legal step, from durable state. |
| `runPipeline.js` | **The resumable advancer.** Reads a snapshot, takes exactly ONE step, returns. |
| `runtime.js` | **The loop.** `--once` / `--watch`. A deterministic worker, not an LLM daemon. |
| `store.js` | Every read the pipeline makes, and the command/outbox ledger over `asdair.pending_action`. |
| `shopLines.js` | The durable interpretation (`asdair.shop_line`, migration 008). The one table this folder writes. |
| `keys.js` | **PURE.** Every key idempotency rests on — question keys, command keys, intent keys. |
| `telegramAdapter.js` | **PURE.** One routed Telegram intent → one call on the command surface. No logic of its own. |
| `deps.js` | The wiring. Real components by default, fully injectable — which is how the suite runs offline. |
| `*.test.js`, `test/` | `node --test`, **114 tests, fully offline.** No database, no network, no model, no credentials file. |

ESM, zero runtime dependencies of its own (`pg` arrives transitively, lazily). Node ≥ 18.

```bash
cd services/asdair/pipeline && node --test
```

---

## The stage table

One row per durable `asdair.shop.status`. `runPipeline` takes **the** step for the current row and stops.

| Status | The step | Gate | Moves to | Waiting on |
|---|---|---|---|---|
| `RECEIVED` | transcribe (photo) / interpret (text) | `buildShop` command | `TRANSCRIBING` / `PROCESSING` | Warwick tapping **Build this shop** |
| `TRANSCRIBING` | **load catalogue → ONE grounded read → identity → persist → list** | — | `PROCESSING` | — |
| `PROCESSING` | plan against the rulebook, regulars and the previous order; open a question per unresolved line | a reviewed list needs `confirmInterpretation` | `NEEDS_DECISION` / `READY_TO_SHOP` | Warwick confirming a reviewed interpretation |
| `NEEDS_DECISION` | re-plan once every question is settled | no open questions | `PROCESSING` | Warwick answering the questions |
| `READY_TO_SHOP` | queue the durable browser build request | `requestBasketBuild` command | `WAITING_FOR_BROWSER` | Warwick tapping **Build ASDA basket** |
| `WAITING_FOR_BROWSER` | *none* | — | `SHOPPING` | **a supervised human** claiming the request |
| `SHOPPING` | *none* | — | `BASKET_READY` / `NEEDS_DECISION` | the supervised runner |
| `BASKET_READY` | parse + reconcile + record the confirmation | `submitConfirmation` command | `ORDER_CONFIRMATION_RECEIVED` | **Warwick checking out himself** and forwarding the receipt |
| `ORDER_CONFIRMATION_RECEIVED` | reconcile and learn | — | `RECONCILED` | — |
| `RECONCILED` | *terminal* | — | — | — |
| `FAILED` | resume to **exactly** the state it failed from | `retryStage` command | *(the state it failed from)* | Warwick tapping **Retry** |
| `CANCELLED` | *terminal* | — | — | — |

Cancel **outranks everything** from every live state. Terminal is terminal: no step and no command can
revive a `RECONCILED` or `CANCELLED` week.

A step name is either `act:*` (it does something) or `wait:*` (**a legal park**, not a stall to work
around). AsdAIr waiting for a human is the design, not a bug.

---

## The command surface

Twelve commands. **Telegram and the Cockpit call these, and nothing else.** Neither channel holds a gram
of its own logic; each turns a tap into a call and renders whatever comes back.

| Command | Writes immediately | Consumed |
|---|---|---|
| `receiveList` | `createOrResumeShop` — the week itself | latch |
| `interpretList` | — | consume |
| `confirmInterpretation` | — | **latch** |
| `correctLine` | — | consume (per line) |
| `buildShop` | — | consume |
| `answerQuestion` | `answerQuestion` — **the decision** | **latch** (per question) |
| `requestBasketBuild` | — | consume |
| `pauseBasketBuild` | — | consume |
| `submitConfirmation` | the raw receipt, verbatim | consume |
| `retryStage` | — | consume |
| `cancelShop` | — | consume |
| `getStatus` | **nothing at all** | — |

**Every command does exactly two things:** record the intent durably and idempotently, and perform *only*
the single atomic durable write that **is** that intent. **No command advances the state machine** — that
is `runPipeline`'s job, and only its job. A button tap must never be holding a transaction open while a
model reads a photograph.

```js
import * as commands from './commands.js';
import { createDeps } from './deps.js';

const deps = createDeps();
await commands.answerQuestion(
  { shopRef: 'SHOP-2026-08-03', actor: 'cockpit:warwick', questionKey: 'q1f3a9c2', answerText: 'Dreamies Cheese Large' },
  deps,
);
```

An answer from Telegram clears the question the Cockpit is showing — **not because the two surfaces
synchronise, but because there is only one of them underneath.** `commands.test.js` proves it by
answering from one channel and then trying to answer from the other.

### What no command can do

Book a slot, check out, pay, enter a password, or auto-substitute. The surface is an allowlist:
`dispatch('checkout', …)` throws before anything is written. `invariants.test.js` scans the source of
every shipping module here for those capabilities and fails if one appears. **Warwick checks out himself,
in his own browser session, and tells AsdAIr afterwards.**

---

## THE INVARIANT — the catalogue is loaded before any interpretation

> **Never interpret a shopping list without first loading the household's catalogue.**

See [`../interpret/README.md`](../interpret/README.md) for the measurement that settled this. Ungrounded,
the same model read *"Gourmet cat food"* as **"gourmet coffee"** and invented a product that was not on
the page. Grounded, it read it correctly and invented nothing.

| Actor | Responsibility |
|---|---|
| the model | **READS and RANKS** — supplies `raw_reading`, nothing more |
| the catalogue | **DETERMINES IDENTITY** — `resolveByCatalogue.js` maps a reading to a real `regulars.id` |
| the human | resolves genuine ambiguity |
| confirmed outcomes | **ENRICH ALIASES** for next week |

How it is enforced here, structurally rather than by convention:

1. `runPipeline.assertCatalogueLoaded` is a **precondition** of the interpret step. A null or
   *empty* catalogue **throws** — an empty catalogue would silently revert the system to the
   measured-wrong method while still looking like it worked.
2. **The model is never reached** when the catalogue is unusable — asserted, so an ungrounded read is
   not even paid for.
3. `invariants.test.js` asserts the **call order** (`loadCatalogue` before `buildGroundedPrompt` before
   `interpretPhoto` before `resolveAll`), on both the photo path **and the text path**. A typed list is
   grounded against the catalogue exactly as a photographed one is.
4. **The canonical name is never stored and never taken from the model.** `asdair.shop_line` holds a
   `matched_regular_id`; `shopLines.withCanonicalNames` looks the name up from `asdair.regulars` by that
   id. A model-claimed match to an id we do not hold yields **no name at all**.
5. A line claiming `status = 'matched'` with no `matched_regular_id` is **refused before it reaches the
   database** (which also refuses it — migration 008's CHECK).

Open-ended transcription is not a fallback here. There is no code path to it.

---

## The resumability contract

**`runPipeline` never assumes the previous step ran in this process, this hour or this week.** It reads a
snapshot from Postgres, asks the pure stage table what comes next, does that one thing, and stops.

Kill the runner anywhere — between the catalogue load and the model call, between the model call and the
list write, between the list write and the transition — restart it, and it re-derives the next step from
what is durably true. **There is no in-memory progress to lose, because there is no in-memory progress.**
`runPipeline.test.js` proves this by walking a shop to each stage and then pointing a **brand-new
dependency container** at the same database.

### How work is claimed

Every acting step ends in a **guarded** transition: `shopStore.applyTransition` carries
`AND status = <the status the step was chosen from>`. Two runners racing the same shop cannot both advance
it — the loser matches zero rows, its transaction rolls back, and `runPipeline` reports
`claimed: false`. **The database is the mutual exclusion.** No advisory lock, no lease, no lock file to go
stale after a crash. A lost race is reported as a lost race and **never recorded as a failure of a
perfectly healthy shop.**

Work done *before* that transition is idempotent by construction, so a lost race costs a repeated no-op:

| Effect | What makes a repeat a no-op |
|---|---|
| the week itself | `INSERT … ON CONFLICT DO NOTHING` on **both** natural keys, then re-select |
| the interpretation | `ON CONFLICT (shop_id, line_no) DO UPDATE` — a re-read updates line 7, never appends |
| list items | upsert on `(list_id, lower(item_name))` |
| questions | `ON CONFLICT (shop_id, question_key) DO NOTHING`; **first answer wins** |
| the browser build | one live request per shop (partial unique index) |
| the confirmation | natural key `(shop_id, content_fingerprint)` |
| commands | unique **while pending** |
| outbox cards | keyed on the **milestone**, not the moment |

The one genuinely non-idempotent cost of a lost race is a **repeated model call** on the interpret step.
That is money, not correctness, and it is stated here rather than hidden: in the real deployment exactly
one runtime loop advances shops.

### Failure

A failed step parks the shop **visibly and resumably**: `FAILED`, with its `last_error`, and a failure
event whose `from_status` **is** the resume point. `retryStage` puts it back exactly there, and **failing
twice does not decay that target.** A failure card is queued, because a supervised shop that silently
stalls is worse than one that fails loudly — Warwick would keep waiting for a basket that is never coming.

Nothing retries itself. A step that failed once will usually fail again, and a runner that retried
silently would burn the week's model budget in a loop while he believed it was working.

---

## The runtime loop

```bash
node --env-file=<credentials env> runtime.js --once
node --env-file=<credentials env> runtime.js --watch --interval 60
```

Three deterministic phases per pass: **poll intake once → advance every shop that has work by ONE step →
send whatever is in the outbox → exit.**

**One step per shop per pass**, not "until it stops". That keeps every pass bounded, stops a wedged shop
starving the others, and makes the loop trivially safe to interrupt. `--once` is therefore also the unit
of recovery after a reboot.

### One poller, two consumers

Telegram long-polling is **destructive**: fetching updates with an offset **acks every update below it**.
`services/asdair/intake/` is the one poller, and a second would race it — the loser silently swallowing
the week's shopping list.

So the runtime **adds no second poller**. It wraps the intake client (`createCapturingTelegram`) so the
raw updates intake *ignores* — a button tap and a typed reply carry no `message` a list receiver can use —
are captured on the way past and routed through the bot's own `inboundRouter`. **One fetch, one offset,
both consumers served.**

Buttons that are **not commands** (`Search ASDA`, `Send order confirmation`, `Close shop`) get a
structured refusal with an honest reason, answered visibly on the tap. They are deliberately **not**
mapped to the nearest-looking command — mapping `Close shop` onto `cancelShop` would throw away a
finished week's record.

---

## Where the durable state lives

| Table | Owner | Written by |
|---|---|---|
| `asdair.shop`, `shop_event`, `shop_question`, `browser_build_request`, `pending_action` | `services/asdair/shop/shopStore.js` | **that module only** |
| `asdair.shop_line` | **this folder** (`shopLines.js`) — migration 008 arrived for this stage and has no other owner | `shopLines.js` |
| `asdair.shopping_lists`, `shopping_list_items` | `services/control-plane/wp-d-proof/asdairCommands.mjs` | that module, via `add_list_item` |
| `asdair.order_confirmation*` | `services/asdair/reconcile/recordConfirmation.js` | that module |
| `asdair.regulars` (aliases) | `services/asdair/outcome/updateRegulars.js` | that module, at reconcile |

`invariants.test.js` asserts that the only `INSERT`/`UPDATE` naming a table in this folder's source is
`asdair.shop_line`. There is **no `DELETE`, `TRUNCATE` or `DROP`** anywhere here, also asserted.

### The command ledger lives in `asdair.pending_action`

Migration 006 already provides a durable, household-scoped record whose unique index is exactly the
idempotency a command surface needs — `(household_id, action_type, action_key)` **where status =
'pending'**. So "record this command; if the same one is already outstanding, adopt it" is one
`INSERT … ON CONFLICT DO NOTHING`, **decided by the database** rather than by a check-then-insert.

**The cost, stated plainly:** `shopStatus.outstanding_actions` surfaces `pending_action` rows to a human
as *"things that must never be forgotten"*. Pipeline rows are namespaced `cmd:` and `msg:`, and
`keys.isPipelineActionType` / `store.listHouseholdActions` filter them out — **any surface showing
outstanding actions to Warwick must use that filter**, or his list will fill with plumbing. A dedicated
`asdair.pipeline_command` table would be cleaner and is the obvious migration-009 candidate.

A command issued against a week that has since finished is **retired with a reason** rather than left
pending forever (`runPipeline.abandonOutstanding`). Latch commands — `receiveList`,
`confirmInterpretation`, `answerQuestion` — are never retired: they are permanent facts about the week,
and abandoning them would erase the record rather than tidy it.

---

## Credentials

Env var **names** only. No module here opens, reads, parses or prints a credentials file, and
`invariants.test.js` asserts there is no token-shaped or connection-string-shaped literal anywhere in the
folder. Values arrive via `node --env-file=<path>`.

| Name | Secret | Purpose |
|---|---|---|
| `ASDAIR_DB_URL` | no | `asdair_ro` — **every read**, inside `BEGIN TRANSACTION READ ONLY` |
| `ASDAIR_WRITE_DB_URL` | no | `asdair_rw` — every write |
| `SHOPPER_BOT_TOKEN` | **yes** | the @Fusion247shopperbot account — same name the receiver and sender use |
| `SHOPPER_CHAT_ID` | no | the control-surface chat |
| `ASDAIR_HOUSEHOLD_ID` | no | which household the loop serves (default `1`) |
| `FUSION_MODEL_VISION` | no | the grounded vision model id |

---

## What this folder does NOT do

- **It does not book a slot, check out, pay, or enter a password.** No step, no command, no code path.
- **It does not drive a browser.** The basket build is a durable *request* a supervised human claims.
- **It does not auto-substitute.** Alternatives are surfaced for a human choice, never applied.
- **It is not an LLM daemon.** One grounded vision call per photographed list, and that is the only model
  call in the system.
- **It does not poll Telegram.** There is exactly one consumer of that stream.
- **It never sets `checked_out`.** The column is not named in executable code anywhere here.

---

## Known gaps (read before extending)

1. **`promoteDecision` is not wired.** Turning a human answer into a **standing rule** changes every
   future basket, forever. That needs provenance proving the instruction was explicit, and the command
   surface does not yet carry *"and this applies going forward"* as a distinct human act. Guessing it
   would be exactly the ambiguous-inference failure `promoteDecision`'s own guard exists to stop. Alias
   enrichment **is** wired (`deps.recordLearning`); rule promotion stays with `outcome/record-shop.js`.
2. **The plan is recomputed, not stored.** There is no plan table, so reconciliation re-derives the plan
   from the same durable inputs. `planBasket` is pure and deterministic, so this is honest rather than a
   guess — but a stored plan would be better, and is another migration-009 candidate.
3. **Typed replies are not correlated yet.** `resolveQuestionByMessage` and `resolveCandidate` are
   injected and currently return `null` in the real wiring, because nothing persists a question card's
   `message_id` and its rendered candidate order against the question key. Until they do, a typed reply
   and a tapped candidate are **refused rather than attached to a guess** — which is the right failure,
   but it does mean button-answering needs that lookup before it works live.
4. **`shopStore.transition` cannot carry `list_id`.** `store.advanceWithList` therefore composes
   `shopStore`'s own exported `_internal.applyTransition` inside `_internal.inTransaction`, which
   preserves every one of that module's guarantees. A `list_id` parameter on the public `transition`
   belongs to the shop work package.
