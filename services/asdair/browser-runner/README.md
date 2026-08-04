# BUILD-015 AsdAIr — the supervised ASDA browser runner

> # ⚠️ STATUS 2026-08-04: EXPERIMENTAL / DEFERRED. NOT THE LIVE DEFAULT.
>
> **Warwick's ruling `BUILD-015-CANONICAL-RUNTIME-REALIGNMENT`, 2026-08-04.**
>
> - This runner is **experimental and deferred**. It is **not the live default** and **does not write Warwick's
>   weekly basket**.
> - The **Stage 1 live basket writer is Sonnet in Claude for Chrome**, using the proven Brand A–Z ordered
>   sequential traversal. Not Larry, not a Claude Code subagent, not this runner.
> - **This runner is PROHIBITED from further live-account testing without fresh authority from Warwick.**
> - It is **not a blocker to Stage 1** — Stage 1 acceptance does not depend on it.
>
> **It is not deleted and not condemned.** It is retained, its tests kept green, its proofs kept. The engineering
> documented below is genuinely good and is exactly why it stays on the record: the single-writer lease with
> fencing, the atomic claim proven against real Postgres with real concurrent processes, idempotent `step_id`
> replay, and the three-layer forbidden-operation enforcement. Those may well justify revisiting it later.
>
> **What the ruling acts on is different and specific:** speed (~13 s per item on the happy path, ~25–30 s on the
> reference-search fallback, plus ~1.5 s between steps — 10 to 20 minutes of pure runner time for a 40-line shop,
> before any failure, against a ~5-minute benchmark for the proven process), the **missing plan builder** (nothing
> in the repository converts a resolved shopping list into a runner plan; every plan on 2026-08-03 was written by
> hand), and the fact that **it was never the proven process**.
>
> **One difference must not be glossed over.** This runner enforces the never-substitute / never-checkout boundary
> in code that cannot be talked around. **The Sonnet adapter has no such mechanical enforcement** — there the
> boundary is instruction and supervision. That is a real, honest trade recorded in `RUNTIME-DECISION.md`.
>
> **Canonical, read first:**
> - `Builds/BUILD-015-asdair-durable-household-shopping-steward/RUNTIME-DECISION.md`
> - `Builds/BUILD-015-asdair-durable-household-shopping-steward/CANONICAL-WEEKLY-SHOP-PROCESS.md`
> - `Team Knowledge/SOPs/SOP-021-run-the-weekly-asdair-shop.md` (live method)
> - `Team Knowledge/SOPs/SOP-021a-asdair-live-execution-method.md` (this runner's mechanical reference)

An **event-driven service**, not a daemon and not an agent. It has no model, no judgement and no
discretion. It claims exactly one durable `asdair.browser_build_request`, executes the explicit,
allowlisted plan that request carries against a **visible** Chrome profile over the Chrome DevTools
Protocol, records what happened, and stops at basket-ready.

Every decision that needs judgement was made before the request was queued. The runner's whole job is
to carry it out reliably, once, and to be interruptible at any moment.

The mechanism — plain Node, CDP, a dedicated persistent Chrome profile, zero browser dependencies —
was settled by the experiment in [`EXPERIMENT-RESULT.md`](./EXPERIMENT-RESULT.md). This folder promotes
that experiment into the bounded runner. The evidence that it behaves as promised is in
[`RUNNER-PROOF.md`](./RUNNER-PROOF.md).

---

## The three guarantees

### 1. Exactly one writer against the live trolley

Two writers on one trolley is the failure that cannot be allowed to happen even once, because its
symptom is a real household paying for duplicated groceries. Three independent mechanisms prevent it:

| Mechanism | What it stops |
|---|---|
| **Atomic claim** — one `update … where id = (select … for update skip locked limit 1) returning` | Two runners racing at the same instant. Postgres serialises them; the loser gets zero rows and refuses. |
| **Bounded lease expiry** — the claim carries `expires_at`, refreshed by a heartbeat | A runner killed with `-9` stranding the request for ever. Its claim becomes stealable when, and only when, the lease elapses. |
| **Fencing on every write** — `and claimed_by = $runner and progress->'_lease'->>'runner_id' = $runner` | A stale runner that was blocked (long CDP call, laptop suspend) waking up and resuming clicks after someone else took over. Its next database write returns zero rows and it stops. |

A second runner **refuses** by default; `--wait-ms` makes it wait instead. It never writes.

**Where the lease lives.** In `browser_build_request.progress -> '_lease'`, not in dedicated columns.
This build may not apply migrations, and `progress` is a durable `jsonb` column on the same row — so
the heartbeat is exactly as durable and exactly as atomic as a column would be. `lease.cjs` is the only
file that reads `_lease`; if `heartbeat_at` / `lease_expires_at` columns are added later, that one file
changes and nothing else does.

### 2. No duplicate adds, ever

Every plan step carries a `step_id`, and that id is the durable idempotency key.

* Before a browser action the step id is written to `progress._in_flight`.
* After it succeeds the id moves to `progress._completed_steps`.
* On start, `remainingPlan()` drops every step already in `_completed_steps`.

The dangerous window is a crash **between** the click and the commit. A step still sitting in
`_in_flight` is resolved by **reading the live quantity back**, never by clicking again. Whatever the
read says, the remaining plan is then recomputed from the durable record rather than from the list
built before reconciliation — skipping that recompute is exactly how a landed click gets repeated.

### 3. A closed command surface

`commands.cjs` is the allowlist. `guards.cjs` is the refusal layer. `forbidden.test.cjs` scans this
folder's own executable source and fails the suite if a path to any forbidden operation appears.

**Allowlisted (16):** open groceries · open trolley · open Regulars · locate product by reference ·
add known product · search · select an approved search result · set quantity · read quantity · add to
Favourites · report unavailable · read basket line count · read estimated total · pause · resume ·
stop at basket-ready. Only four of those can change the trolley.

**Absent — not disabled, absent:** checkout · payment · booking or changing a delivery slot · entering
a password · changing payment details · enabling substitutions · accepting an unapproved substitute.

Three gates enforce it:

1. **URL allowlist.** Navigation is a closed set of exact patterns. There is no reachable URL for any
   forbidden surface.
2. **Click deny-list.** Every click is checked against a deny vocabulary first, so even a moved or
   mislabelled control on a permitted page cannot be clicked by accident.
3. **No typing, ever.** The runner issues no CDP `Input.` method. A process that cannot synthesise a
   keystroke cannot fill a credential field or a card field — and cannot set a quantity by typing,
   which matters on its own: *typed quantities do not persist server-side* (SOP-021's costliest
   lesson). Search is done by navigating to a search URL; quantity by clicking the real +/− steppers.

`guards.cjs` is the single file permitted to name the forbidden vocabulary, and it names it only in
order to refuse it. The test asserts both halves: that no other file names it in code, and that
`guards.cjs` genuinely refuses every item.

---

## Re-authentication

The runner **detects and reports** it; it never resolves it. Two signals:

* a redirect to an authentication host (`login.asda.com/...`), and
* the store rendering its signed-out `Register / Sign in` header — ASDA does **not** always redirect
  immediately, so detecting the header up front is what stops the runner walking into a redirect
  halfway through a write.

On detection it sets `human_reauth_required: true`, records the reason, **releases the lease** so
Warwick can sign in without an automated click racing him, and exits. A request already flagged is not
retried blind on the next start.

---

## Pause, resume, takeover, stop

Control arrives through a small local JSON file (`C:\.fusion247\asdair\runner\control.json`), written
atomically by `runnerctl.cjs`.

Why a file rather than the database: these four words must work in exactly the moments the database may
not — when Warwick wants his hands on the browser *now*, when Supabase is unreachable, when the runner
is wedged. The database remains the record of what happened; the file is only the doorbell. A request
whose database status becomes `cancelled` is also treated as a stop, so the Cockpit and Telegram keep a
remote off-switch.

| Command | Effect |
|---|---|
| `node runnerctl.cjs pause` | Stop issuing browser commands. **The lease is kept** and heartbeated; Chrome stays open and usable. A pause never lifted releases the lease after `--max-pause-ms` (default 30 min) rather than holding the trolley for ever. |
| `node runnerctl.cjs resume` | Continue from the last durable checkpoint. Completed steps are not repeated. |
| `node runnerctl.cjs takeover` | **Release the writing lease.** The request returns to `queued` with all progress intact — releasing is not abandoning. |
| `node runnerctl.cjs stop` | Stop cleanly at basket-ready, leaving the browser open on the trolley. |
| `node runnerctl.cjs show` | Print the current directive. No database access. |
| `node --env-file=<env file> runnerctl.cjs status [id]` | Durable state + lease, as the database actually holds it. |

Directives are **levels, not edges**: one issued while the runner was down is still obeyed when it
comes up.

---

## Running it

> **⚠️ 2026-08-04 — NOT AGAINST THE LIVE ASDA ACCOUNT.** This runner is deferred and **prohibited from further
> live-account testing without fresh authority from Warwick** (`BUILD-015-CANONICAL-RUNTIME-REALIGNMENT`).
> `--dry-run` and the offline test suite are unaffected and remain the supported ways to exercise it.

Chrome must already be running, **visible**, on the dedicated profile. The runner refuses to drive a
headless browser — a supervised shop Warwick cannot watch is not supervised.

```
chrome.exe --remote-debugging-port=9222 --user-data-dir=C:\.fusion247\asdair\chrome-profile
```

```
cd services/asdair/browser-runner
npm install                      # pg only; it is required lazily, so the tests need nothing
node --env-file=C:/.fusion247/asdair.env runner.js --request 2
```

| Switch | Meaning |
|---|---|
| `--request <id>` / `--shop <id>` | Claim a specific request (default: the oldest claimable one) |
| `--plan-file <path>` | Seed the plan when the request carries none |
| `--dry-run` | Exercise the full durable path with no browser at all |
| `--lease-ms` / `--heartbeat-ms` | Lease window and refresh interval (default 45 s / 10 s) |
| `--wait-ms` | Wait this long for another runner's lease to expire instead of refusing |
| `--max-pause-ms` | How long a pause may hold the lease (default 30 min) |

**Credentials.** This folder knows env var **names** and nothing else. It never opens, parses, prints
or inspects an env file; values arrive via `node --env-file=`.
`ASDAIR_DB_URL` (read, `asdair_ro`) · `ASDAIR_WRITE_DB_URL` (write, `asdair_rw`).

---

## The plan contract

A request carries its plan at `browser_build_request.progress.plan`. Whoever queues the request decides
what is in it; the runner only validates and executes.

```json
[
  { "step_id": "s1", "command": "add_known_product",    "product_ref": "489747", "origin": "regular",  "name": "Cravendale 2L" },
  { "step_id": "s2", "command": "select_search_result", "term": "mixed herbs", "product_ref": "544334", "origin": "searched" },
  { "step_id": "s3", "command": "set_quantity",         "product_ref": "544334", "qty": 2 }
]
```

`step_id` is mandatory — it is the idempotency key, not a label. Validation happens **before any step
runs**, so a plan naming anything off the allowlist is refused whole rather than executed partially.
`origin` decides whether an add counts toward `regulars_added` or `searched_added`.

## What it writes back

`progress` always carries the four contract keys, present even when zero, so a consumer never has to
guess whether a missing key means zero or unknown:

`regulars_added` · `searched_added` · `basket_product_count` · `estimated_total`

alongside `held_items`, `unavailable_items`, `failed_actions`, `pending_favourite_actions`,
`last_successful_browser_step` and `human_reauth_required`. Runner-internal bookkeeping is prefixed
with `_` (`_lease`, `_completed_steps`, `_in_flight`, `_runner_state`) so a reader can tell a report
from machinery at a glance.

It also owns exactly two shop transitions, each guarded on the current status so it can never drag a
shop backwards or past a stage another component owns:
`WAITING_FOR_BROWSER → SHOPPING` and `SHOPPING → BASKET_READY`. A favourite the browser could not add
becomes a durable `asdair.pending_action` rather than a silent loss.

---

## Files

| File | Role |
|---|---|
| `runner.js` | The service: claim → reconstruct → execute → checkpoint → stop |
| `commands.cjs` | The allowlist and step validation |
| `guards.cjs` | The refusal layer — the one file allowed to name what is forbidden |
| `browser.cjs` | The CDP session; one method per allowlisted command |
| `cdp.js` | Minimal CDP client, zero dependencies |
| `lease.cjs` | Atomic claim, heartbeat, bounded expiry, fenced writes, release |
| `progress.cjs` | The pure durable-progress model (no I/O — hence testable offline) |
| `control.cjs` | pause / resume / takeover / stop |
| `store.cjs` | Database access, shop transitions, pending actions |
| `runnerctl.cjs` | The control CLI |
| `proofkit.cjs` | Snapshot / seed / show — the harness `RUNNER-PROOF.md` was produced with |
| `actions.cjs`, `readTrolley.cjs` | The original experiment primitives, kept as run-anywhere probes |

## Tests

```
node --test
```

Fully offline: no database, no Chrome, no ASDA, no network. `pg` is required lazily so the suite runs
on a box with nothing installed.

**What the offline suite does not prove**, and where it is proved instead: the claim statement's
atomicity comes from Postgres, and no in-memory fake can demonstrate it. That is proved against the
real database with real concurrent processes in `RUNNER-PROOF.md`, which is also where the live browser
behaviour is recorded.
