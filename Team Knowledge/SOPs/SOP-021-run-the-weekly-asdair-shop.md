# SOP-021: Run the weekly AsdAIr shop

- **Status:** Active (created 2026-07-27, per Warwick's durability-repair directive).
- **Default owner:** AsdAIr (Household Shopping Steward). Larry orchestrates and holds the browser drive until
  the tool-binding question below is settled.
- **Triggered by:** a weekly shopping request arriving by any channel (Telegram photo/text, cockpit picker), or
  Warwick asking to "do the shop".
- **Why this file exists:** this method previously lived ONLY in machine-local Claude memory and a per-session
  scratchpad. It was rebuilt from scratch at least twice, was unversioned and unreviewable, and could not be
  handed to a fresh instance. That is the durability defect this SOP closes.

## Scope boundary — read before adding anything here

**Git owns the FUNCTION. Supabase owns the STATE.** (Warwick, 2026-07-27.)

| Lives in Git / myPKA | Lives in the `asdair` Postgres schema |
|---|---|
| This SOP, the specialist contract, routing | Shopping lists and their items |
| `services/asdair/**` code | Actual shops (`orders`) and what happened (`order_events`) |
| Schema **definitions** (DDL, columns) | Regulars, favourites, products |
| The operating method and pointers | Learned preferences, rules, QA/learning events |

A fresh instance reconstructs its **function** from committed files, then loads its authorised **state** from
Supabase. Do not migrate runtime data into Git to satisfy a fresh-instance test — that would break the split, not
prove it. Migrations ship **columns, never rows**.

**So if a shop teaches us something item-specific** — a product missing from the regulars catalogue, a brand that
rotates — **that is a database write, not an edit to this SOP.** The reason is functional, not one of secrecy:
**the planner reads rows, not prose.** A fact written into this file changes nothing; the same fact as a `rules`
or `regulars` row actually changes the next basket. Step 6 is where it belongs.

The ten standing shopping rules are NOT duplicated here. They are canonical at
`services/asdair/skill/README.md` §"Standing rules the planner implements". Read them there.

## The loop this SOP implements

```
REQUEST → PLAN (durable rules/regulars) → HUMAN APPROVAL → SHOP
        → RECORD WHAT ACTUALLY HAPPENED → LEARN → next instance uses it
```

The loop is only closed if steps 5 and 6 actually run. Historically they did not, which is why each week started
no better informed than the last.

---

## 1. Intake

The request arrives on the **Fusion 247 Shopper bot** — a *separate* bot with its own monitored inbox, distinct
from the dev bot and the Tower bot. **Never cross the tokens.**

- Token and the allowed-user allowlist are referenced by env var only; the value lives in the machine secret
  store, never in this repo and never in SQL (`asdair.credentials_ref` is an audit pointer, not a value).
- Intake polls `getUpdates` and downloads any photo attachments.

**Use the committed receiver — do NOT hand-roll one.** `services/asdair/intake/fetch-shopper-list.js` (module:
`shopperIntake.js`) is the intake, added 2026-07-28. It fetches, filters to the allowed senders, picks the
largest photo, downloads it, persists the update offset atomically **outside the repo**, and emits a payload in
exactly the shape `services/hub/shopper/shopperRoute.mjs` accepts — with a `sourceId` that scopes the downstream
idempotency keys. `--dry-run` fetches nothing and writes no state.

> Until 2026-07-28 this receiver was re-written into a session scratchpad **every single week** and thrown away.
> That is why it now lives in Git with 21 offline tests. If you find yourself about to write a `getUpdates`
> snippet, stop — you are recreating the exact defect this SOP exists to prevent.

It deliberately **does not transcribe** (that is the vision step below) and holds the offset on genuine failure
so a list can never be silently consumed and lost.

> **CONCURRENCY HAZARD — do not ignore.** `getUpdates` is a single-consumer, destructive-ack protocol with no
> lock or lease. Its entire safety argument is *"nothing else polls this token."* **A second concurrent poller
> breaks that by existing** — the realistic failure is a shopping list silently consumed and permanently lost,
> with no error surfaced. Exactly one process may poll the shopper token at a time. If another lane needs the
> request, it must be handed the payload, not given the token.

**Handwritten lists:** transcription is done by vision, in-context — there is no separate OCR service. Transcribe
**every** line to structured items, then normalise via `services/asdair/skill/listNormaliser.js`. Dedupe repeat
sends of the same list, and ignore anything from a sender outside the allowlist. Store the photo reference and the
raw transcription on the `asdair.shopping_lists` row, so a later dispute about "was that on the list?" is settled
by the record rather than by memory.

## 2. Plan

Run the planner against the durable rulebook. It is pure and deterministic — same inputs, same output — which is
what makes the runtime disposable.

```
node services/asdair/skill/cli.js --list-date <YYYY-MM-DD> --household <id>
```

Connection comes from `ASDAIR_DB_URL` in the environment only, never on the command line.

Resolution is **offline** against `asdair.regulars` and `asdair.products` — do not scrape the live site to work
out what an item means. That was the original slow path and it is solved.

Also load **the last order** as part of the planning inputs. Some regulars rotate deliberately (a different
variant each week), and rotation cannot be resolved without knowing what the previous shop actually contained.
The rotation itself is item-specific, so it lives as `rules`/`regulars` rows — this SOP only records that the
last order is a required *input*, not an optional nicety.

Anything the plan cannot resolve from regulars, `aka` aliases or rules is **genuinely new** and goes to step 3.

**Multibuy round-ups.** Where a multibuy makes the extra unit **50% or more off**, offering the round-up is
reasonable domain guidance rather than an assumption — surface it as an offer, never apply it silently. Like every
other planning behaviour, it only changes a basket once it exists as a structured `rules` row; written here alone
it is guidance for whoever encodes it, not an active rule.

## 3. Human approval

The plan returns a `needs_decision` queue. **Never auto-substitute** (standing rule 6). Surface alternatives and
let a human choose. Budget breaches **flag, never block** (rule 7).

**Ask once.** Collect every open question — genuinely-new items, ambiguous lines, unresolved alternatives — and
put them to the shopper bot as **one batch**, then wait. Do not drip-feed questions one at a time across the shop;
that is the pattern that makes a shop feel like an interrogation and stretches a ten-minute job across an evening.

Every answer given here is a learning event — carry it to step 6. Capture the answer as a `rules` row and, where
the answer was really "this name means that product", as an `aka` alias too, **so the same question is never asked
twice**. An answer that only lives in the conversation will be asked again next week.

## 4. Shop

Warwick logs into ASDA. He is already authenticated; **Larry never enters the account password** (hard rule), and
cannot open the extension sidebar.

**The proven add method — follow it, this was expensive to learn:**

- The **Regulars tab is the only tab with bulk checkboxes and "Add selected to trolley."** Favourites offers
  individual adds only. Use Regulars.
- **Sort A–Z** and do a **full single pass**: tick every match, then one bulk add. Do not scroll-hunt and do not
  switch views mid-pass — the grid reshuffles and resets sort. Two-at-a-time is a fallback only.
  (**Open question:** the superseded database copy of this method specified sort by **BRAND** A–Z, both for the
  grid and for the order of the resolved basket. See "Open questions" below — unresolved, do not silently pick one.)
- The grid **will not scroll by wheel or keyboard.** `scroll_to` on an element ref is the scroll lever. The DOM
  **accumulates** loaded items, so: scroll until everything is loaded, `read_page` the accessibility tree **once**
  (persist to a file if large and parse it for checkbox refs), then batch-click every target ref and add in one go.
- **Screenshots come out blank on the heavy grid.** The trolley page renders fine — do verification there.
- Search-adds: navigate to the search URL for the term, then use the `find` tool to locate the exact product's add
  button and click its ref.

> **The real cause of a failed bulk add is a single OUT-OF-STOCK item silently rejecting the WHOLE batch.** It is
> not batch size, and it is not an expired delivery slot (that theory was tested and is wrong). Out-of-stock items
> still appear in Regulars/Favourites. If a bulk add fails, split the batch only to isolate and drop the
> out-of-stock item, then resume the full pass. **Dropping is the action — never auto-substitute the missing
> item.** Use an already-approved fallback if one exists; otherwise flag the alternatives for a human (step 3).

**Never book a delivery slot. Never check out.** The goal is a checkout-ready basket and nothing further
(standing rule 8). Payment and any consequential purchase remain Warwick's gate.

## 5. Reconcile, then RECORD

On the trolley page, do a line-by-line quantity reconcile, then set substitutions, then record. Order matters —
substitutions are set **last, after the audit passes**, so they are set against the basket that actually exists.

**Auditing quantities — two traps, both learned the hard way:**

> **Read the actual quantity field. NEVER infer quantity from price.** Multibuys and offers distort the line
> price, so "the price looks about right" is not evidence that the quantity is right. Read the qty each line
> actually carries.

> **Fix quantities with the `+` / `−` STEPPER buttons. Typing into the quantity text field does NOT persist
> server-side.** The number changes on screen and the basket does not change underneath it — a silent
> corruption that survives every visual check and only shows up when the shop arrives wrong. This is the single
> most expensive non-obvious fact in this SOP.

Diff every line against the original list: right product, right quantity, exclusions actually omitted,
substitutions and out-of-stock drops flagged. Check the total against the GBP 120–150 band and flag if outside
(rule 7 — flag, never block).

**Then set substitutions:**

- **untick "Allow substitutions for all"**, and
- set the **per-item** substitution flag from each product's `substitutes_allowed`.

Unticking the global toggle alone is not the whole job — it makes the default safe, but items that are genuinely
fine to substitute stay durable state in the database, and the per-item settings are how that state reaches the
basket. **Never auto-substitute** (standing rule 6) still governs everything the *planner* does; this step is
only about honouring already-recorded per-product permissions on the ASDA page.

Then write what *actually* happened — not what was planned:

- one `asdair.orders` row for the run (`checked_out` stays **false**, always);
- `asdair.order_events` rows for corrections, flags, decisions, warnings and errors.

Use `services/asdair/outcome/recordShopOutcome.js`. **A shop that is not recorded did not teach us anything** —
this is the step whose historical absence made every week start from zero.

## 6. Learn

Record each decision from step 3 into `asdair.rule_qa_log`. Where the answer applies going forward, it is
**promoted** into a structured `asdair.rules` row with a `promoted_rule_id` back-link, so the rulebook grows from
each answer. Use `services/asdair/outcome/promoteDecision.js`.

- A **one-week-only** exclusion is never promoted (standing rule 10).
- An item found missing from the regulars catalogue becomes a `regulars` row, not a note.
- Provenance is preserved by the back-link — we can always see *why* a rule exists.

**The regulars half of the learning has a writer as of 2026-07-28** — use
`services/asdair/outcome/update-regulars.js` (`--dry-run` first, every time). Two operations and nothing else:

| Operation | Use it for |
|---|---|
| `upsertRegular` | A genuinely new item found mid-shop. Safe to re-run: an existing regular with the same normalised name is **adopted**, never duplicated (a duplicate would make the planner treat that term as AMBIGUOUS and break it every week). |
| `enrichRegular` | An alias (`add_aka`, which **merges** — prior aliases are never lost), a harvested `asda_product_id`/`asda_url`, brand, typical qty, substitutes flag. |

It **cannot** delete, retire, rename or re-home a regular — not by flag, not by argument. The database grant
enforces that independently of the code (`db/005_asdair_rw_grants.sql`).

> **Harvest product IDs while you shop — they are only obtainable there.** Every ASDA product URL carries its id
> (`/groceries/product/<category>/<slug>/<ID>`), and the accessibility tree you already read for the bulk tick
> pass is full of them. Capturing them as you go took coverage from 21/91 to 41/97 in one shop. An item with an
> id resolves by id next week instead of by name.

## 7. Confirm

Ping back through the shopper bot. Warwick reviews and completes any purchase himself. Two standard messages,
used verbatim so they are instantly recognisable on a phone:

- Success (trolley confirmed against the original list): **"You are ready to check out at Asda!"**
- Stuck at any point, at any step: **"Larry is stuck in Asda!"**

Follow the success ping with the summary: item count, total, substitutions, out-of-stock items, and anything
still needing a decision.

---

## Provenance of the operational detail above

A parallel copy of this method lived as 21 rows in `asdair.skill_steps` (version 1). The genuinely useful,
non-duplicated knowledge in it was folded into this SOP on **2026-07-27**; the two points where it conflicted with
this SOP or with the standing rules are recorded below rather than resolved.

That copy breached the function/state split — **Git owns the METHOD, Postgres owns the STATE** — and a fresh Asdair
instance found it by introspection and correctly reported it as an SSOT violation. **Git (this file) is now the sole
home of the method.** The database copy is being superseded separately. If a future instance finds a method table in
the `asdair` schema, this file wins; report the table rather than following it.

## Open questions — raised 2026-07-27, NOT resolved here

Both come from the rescued database copy. They are recorded as questions on purpose: neither is a call for a worker
or for Larry to make.

**1. Sort order — BRAND A–Z or plain A–Z?** §4 above says sort A–Z. The database copy said sort **BRAND** A–Z, and
also that the resolved basket should be output sorted by brand. These may be the same intent loosely worded, or the
brand sort may be a deliberate refinement that made the single-pass tick reliable. Unknown which. Whoever knows the
answer should settle it in §4 and delete this entry.

**2. SAFETY CONFLICT — "substitute Banana -> Strawberry".** ⚠️ The database copy's resolution step instructed
*"substitute Banana -> Strawberry"*. This cannot be taken at face value:

- **Standing rule 6 is "NEVER auto-substitute"** (`services/asdair/skill/README.md`).
- Live rules (reported as rules 17 and 26) **hard-exclude Banana Yazoo**.
- So a fresh instance trusting the database method could add an item that a standing rule permanently excludes.

There is a reading in which it is entirely legitimate: the rule model has a **`map` directive** (a learned
"this list line means that product" mapping) which is a *different mechanism* from an out-of-stock auto-substitution,
and "always give me the strawberry one, never the banana one" is exactly what a `map` plus an `exclude` express
together. There is also a reading in which it is a genuine safety bug in the database copy.

**Which one it is is a domain judgement for Warwick — it is not the worker's or Larry's to make.** Neither reading
is encoded above as fact. Until Warwick rules, treat any banana/strawberry line as `needs_decision` and ask.

---

## Acceptance — how to know this SOP is doing its job

A **completely fresh** AsdAIr instance, with no prior conversation and no machine-local memory, can run the whole
weekly shop from committed files plus durable database state alone.

The sharper test: **shop N writes durable state; a fresh instance running shop N+1 demonstrably sees and uses it.**
If that fails, the loop is open again regardless of what files exist.

## Known limitations (honest, as at 2026-07-27)

- **The browser drive is not yet proven from a subagent.** The Claude-for-Chrome connector is not project-scoped
  in `.mcp.json`, and every existing shim uses a `tools:` allowlist that would exclude it. Until that is settled
  on its own, the browser step stays with Larry in main context. This is a mechanical unknown, not a preference.
- **The ASDA session is a singleton** — one profile, one login, one live trolley holding real money. It cannot be
  worktree-isolated or run concurrently.
- **Fully hands-off is descoped** (Warwick, 2026-07-21): a human logs in. One shop per week.
- Some regulars still lack captured ASDA product IDs, so those resolve by name rather than by ID. **56 of 97 as
  at 2026-07-28** (was 70 of 91 — one shop's harvesting closed 20 of them). Keep harvesting.
- **Nothing drains the intent queue.** `services/control-plane/wp-d-proof/asdair-worker.mjs` is built and tested
  but is **not running and not scheduled** (verified 2026-07-28). So a list arriving on Telegram becomes
  `add_list_item` intents in `asdair.command_request` that sit there until a worker is run by hand. Wiring it to
  run unattended needs Warwick's go-ahead, because it means something unsupervised starts touching household data.
- **Rule 7 (the GBP 120-150 budget band) is structurally inoperative** — no price column exists anywhere in the
  schema, so `budget_flag` is permanently `unknown`. Any budget observation in a shop report is a *human* one.
  Do not claim the system flagged it.
- **Alias matching is exact-string**, so word order alone defeats it (`"yazoo strawberry"` misses the stored
  alias `"strawberry yazoo"`). Measured resolution over the household's own history was **52%**. Tonight's alias
  additions raise coverage but not the matching algorithm; order-insensitive matching remains the real fix.
- **`map` directives can resolve to prose.** Rule 23 maps `sure male` to *"Sure Men Anti-Perspirant Deodorant
  (blue variant)"* — an instruction, not a product — and the planner treats it as confidently matched. Watch for
  it when driving.

## References

- Standing rules + rule model: `services/asdair/skill/README.md`
- Schema and the loop's tables: `services/asdair/db/001_asdair_schema.sql`
- Outcome + learning writers: `services/asdair/outcome/`
- Function-vs-state split: Warwick's ruling, 2026-07-27 (table above)
- **Shopping data is explicitly NOT a privacy matter** (Warwick's ruling, 2026-07-27). Do not redact or hedge it.
  The only thing that stays out of the repo is **secrets** — tokens, connection strings, credentials:
  [[personal-data-never-public-repo]]
