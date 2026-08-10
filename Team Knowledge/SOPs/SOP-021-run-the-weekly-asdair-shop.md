# SOP-021: Run the weekly AsdAIr shop

- **Status:** Active (created 2026-07-27, per Warwick's durability-repair directive).
- **Default owner:** AsdAIr (Household Shopping Steward).
- **Triggered by:** a weekly shopping request arriving by any channel (Telegram photo/text, cockpit picker), or
  Warwick asking to "do the shop".

> **⚠️ WHO WRITES THE LIVE BASKET — RULED 2026-08-04, `BUILD-015-CANONICAL-RUNTIME-REALIGNMENT`.**
> **The Stage 1 live basket writer is Sonnet in Claude for Chrome.** It is **not** Larry, **not** a Claude Code
> subagent, and **not** the custom Node/CDP runner at `services/asdair/browser-runner/` — that runner is now
> **experimental, deferred, not the live default, and prohibited from further live-account testing without fresh
> authority from Warwick.** Canonical: `Builds/BUILD-015-asdair-durable-household-shopping-steward/RUNTIME-DECISION.md`,
> with the end-to-end process in the same folder's `CANONICAL-WEEKLY-SHOP-PROCESS.md`. **Read those before acting
> on any statement in this file about who drives the browser.** The earlier line here — *"Larry orchestrates and
> holds the browser drive until the tool-binding question below is settled"* — is **superseded and removed**; that
> question is settled and the answer is neither Larry nor the runner.
>
> **Everything else in this SOP still stands.** Only the who-drives-the-browser question changed. The
> catalogue-grounding invariant, the single-poller hazard, the out-of-stock cause of a failed batch add, the
> typed-quantity trap, the never-auto-substitute rule and the learning arcs are all unchanged and still binding.
- **Why this file exists:** this method previously lived ONLY in machine-local Claude memory and a per-session
  scratchpad. It was rebuilt from scratch at least twice, was unversioned and unreviewable, and could not be
  handed to a fresh instance. That is the durability defect this SOP closes.
- **Companion file (added 2026-08-03):** [[SOP-021a-asdair-live-execution-method]] holds the **mechanical
  execution reality** — every env var and how to verify it, the DB grant preflight, the four processes, the
  browser runner's 16-command allowlist and plan contract, the durable-state diagnostics, and every known
  failure mode from the live run of 2026-08-03. **This file owns the intent and policy; SOP-021a owns the
  mechanics.** Where the two appear to disagree, SOP-021a §8 records the resolution — the code was read, and
  the code won.
  *(**Reframed 2026-08-04**, ruling `BUILD-015-CANONICAL-RUNTIME-REALIGNMENT`: SOP-021a is now the reference for
  the **DEFERRED experimental CDP adapter**, not for the live path. Its preflight, grant, diagnostic and
  failure-mode knowledge remains accurate and valuable; its runner-driven execution route is **not** how the
  live basket gets built. See `RUNTIME-DECISION.md`.)*

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

It deliberately **does not transcribe** (that is the vision step below).

> ## ⛔ DO NOT RUN THIS CLI IN LIVE MODE. Corrected 2026-08-10 — the claim that stood here was FALSE.
>
> This paragraph used to say the receiver *"holds the offset on genuine failure so a list can never be silently
> consumed and lost."* **That is not true of this CLI**, and following the instruction would destroy a shopping
> list. Found by Veritas (`WP-B15-07`, D-1) during the live acceptance window, while it was still telling an
> operator to run it.
>
> **Why.** In live mode `fetch-shopper-list.js` calls `runIntakeFromConfig`, which supplies **no `onRecord`**.
> `runIntake` only awaits durable capture `if (typeof onRecord === 'function')` — so with no `onRecord` it
> downloads the photo, **advances the shared Telegram offset**, and persists **nothing to the database**. The
> offset it moves is the same `intakeStateFile()` the live runtime depends on, so **one live run permanently
> consumes a pending shopping list.** Telegram then forgets the message and it cannot be recovered.
>
> **The safe route is the RUNTIME, not this CLI.** The scheduled task `MyPKA-AsdAIr-Runtime` runs
> `pipeline-runtime/ensure-asdair-runtime.mjs`, whose `pollIntake` **does** supply `onRecord` and persists the
> shop *before* the offset advances. That ordering is correct and is what protects the list.
>
> **`--dry-run` remains safe** — it fetches nothing and writes no state.
>
> **Status — UPDATED 2026-08-10, WP-B15-11: the defect is now FIXED, and the instruction stays withdrawn.**
> `runIntake` refuses a live run without a durable sink, so the unsafe invocation is impossible from ANY
> caller present or future — not just from this CLI. The guard is at the SEAM, which is why it survives:
> a warning in a command decays, a guard bound to the seam does not. The CLI itself now refuses live mode
> and exits 2 before any fetch happens, so no offset can move. `--dry-run` remains fully safe.
>
> The instruction is NOT reinstated. The runtime is the receiver; this CLI has no live role, and
> `npm run fetch` has been removed from the intake package so nothing advertises one.

> **CONCURRENCY HAZARD — do not ignore.** `getUpdates` is a single-consumer, destructive-ack protocol with no
> lock or lease. Its entire safety argument is *"nothing else polls this token."* **A second concurrent poller
> breaks that by existing** — the realistic failure is a shopping list silently consumed and permanently lost,
> with no error surfaced. Exactly one process may poll the shopper token at a time. If another lane needs the
> request, it must be handed the payload, not given the token.

### ⚠️ THE CATALOGUE-GROUNDING INVARIANT — never interpret a list without loading the catalogue first

**Load the household's catalogue BEFORE interpreting any photographed list.** Active regulars, aliases, ASDA
product IDs, brands, categories, typical quantities, standing rules and the previous completed order are
**required INPUTS to reading the list** — not merely outputs to update afterwards. Supabase is the operational
authority; where the old Google Doc survives it is provenance/fallback only and must never override newer
Supabase state. Never build a second catalogue for transcription.

The job is **not** "read handwriting and invent a product name". It is *"given this household's known products
and aliases, which of them does each mark refer to?"* Use `services/asdair/interpret/` — `loadCatalogue.js`,
then `groundedPrompt.js`, then `resolveByCatalogue.js` for identity.

**Measured 2026-07-28, same photo and same model, grounding the only change:** open-ended read *Gourmet cat food*
as "gourmet coffee", *Dreamies cheese* as "camomile cheese", *Weetabix Protein* as "beefs protein", *Wall's* as
"waffles", and **invented a line that was not on the page**. Grounded, every one of those read correctly and
nothing was invented; deterministic matching then resolved **28/31 lines (90%)** against a previously measured
**52%**. An earlier verdict that "the vision model is unfit" was therefore **wrong and is withdrawn** — the
defect was missing catalogue context. Do not reinstate that conclusion without re-running the grounded
comparison. Equally, do not claim the model alone is accurate: the catalogue does much of the work, and the
product is the combined system.

**The authority boundary:** the model READS and RANKS · the catalogue DETERMINES IDENTITY · the human resolves
genuine ambiguity · confirmed outcomes ENRICH ALIASES for next week. The model returns a candidate **id**, never
a product name; canonical names are looked up from our own rows. If nothing genuinely fits, the answer is
`unmatched_new_item` — never the least-bad catalogue item.

**Both arcs of the cycle are mandatory.** Writing new items/aliases/product IDs back each week is what grounds
next week's reading. Skip the write-back and the read degrades against a stale catalogue — which is exactly what
happened when the 2026-07-27 shop learned three new items in-session and persisted none of them. It appeared to
work only because a session's own context was holding the catalogue; that is not durability.

**Handwritten lists:** interpretation is grounded vision (above) — there is no separate OCR service. Interpret
**every** line, then normalise via `services/asdair/skill/listNormaliser.js`. Dedupe repeat
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

Warwick logs into ASDA. He is already authenticated; **nothing and nobody but Warwick ever enters the account
password** (hard rule).

> **⚠️ WHO SHOPS, RULED 2026-08-04 (`BUILD-015-CANONICAL-RUNTIME-REALIGNMENT`) — Sonnet in Claude for Chrome.**
> Not Larry, not a Claude Code subagent, not `services/asdair/browser-runner/`. Canonical:
> `Builds/BUILD-015-asdair-durable-household-shopping-steward/RUNTIME-DECISION.md`.

**The proven add method — Brand A–Z ordered sequential traversal. Follow it, this was expensive to learn:**

1. Open the appropriate ASDA **Regulars / Favourites** view.
2. **Change the ASDA ordering to Brand A–Z.**
3. Follow the prepared execution packet **in that same order**. The ordering *is* the speed.
4. Add known products **through Regulars or Favourites**, working through them **rapidly and sequentially**.
5. **Never free-search a known item.**
6. Free-search **only** a genuinely new item Warwick has approved — then add it, click ASDA's **Favourite**
   control for it, and capture its real ASDA product identity.
7. Stop at a **checkout-ready basket**.

Do not switch views mid-pass — the grid reshuffles and resets the sort.

> **⚠️ SUPERSEDED 2026-08-04 — the "bulk checkbox / Add selected to trolley" description.** An earlier version of
> this section described the proven method as *"the Regulars tab is the only tab with bulk checkboxes and 'Add
> selected to trolley'; sort A–Z, tick every match, then one bulk add"*, with `scroll_to` / `read_page` / `find`
> as the levers. **Warwick's ruling is that the proven process was fast ordered traversal, not an assumed
> one-click bulk operation.** Do not document or attempt it as mass checkbox selection unless evidence proves
> that was the action; the speed came from *ordering and sequence*, not from a single bulk control. Recorded
> honestly: `EXPERIMENT-RESULT.md` records only that ASDA's bulk control *exists* — never that it was driven
> successfully at scale. A work order (WO-D) to build "bulk add" as a performance feature rested on that
> description and is **CANCELLED as live-runtime work**.
>
> Two facts from the superseded block survive and are still worth knowing, because they cost real time to learn:
> the heavy Regulars grid **will not scroll by wheel or keyboard** and needs an element-targeted scroll, and
> **screenshots come out blank on that grid** — verify on the trolley page, which renders fine. The tool names in
> the old block (`scroll_to`, `read_page`, `find`) were always **Claude-in-Chrome tools**, never
> `browser-runner` commands; that was already noted on 2026-08-03 and is the clue that this SOP had been
> documenting the browser-driven process all along. Full evidence:
> [[SOP-021a-asdair-live-execution-method]] §8.1.

> **The real cause of a failed batch add is a single OUT-OF-STOCK item silently rejecting the WHOLE batch.** It is
> not batch size, and it is not an expired delivery slot (that theory was tested and is wrong). Out-of-stock items
> still appear in Regulars/Favourites. If a batch add fails, split it only to isolate and drop the
> out-of-stock item, then resume the pass. **Dropping is the action — never auto-substitute the missing
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

> **⚠️ WHO DOES THIS, 2026-08-03 — a HUMAN, always.** `browser-runner` **cannot** set either toggle, by design
> and in three layers: no allowlisted command exists, `guards.DENY_TARGET` refuses any click matching
> `substitut`, and `forbidden.test.cjs` fails the build if the token appears in executable source at all.
> "Enabling substitutions" sits on the same forbidden list as checkout and payment. On 2026-08-03 the finished
> basket was left with **"Allow substitutions for all" ON**, violating standing rule 6, because nothing and
> nobody closed this gap. **Make it the last action before hand-back, every week.** Detail:
> [[SOP-021a-asdair-live-execution-method]] §4.
>
> **AMENDED 2026-08-04 (`BUILD-015-CANONICAL-RUNTIME-REALIGNMENT`) — still a human, and now with LESS mechanical
> protection, not more.** Substitutions cannot be automated at all, under either adapter. The deferred CDP runner
> enforces the ban in the three code layers above. **Sonnet in Claude for Chrome has no such mechanical
> enforcement — there the boundary is instruction and supervision, not code.** That is a real, honest reduction
> in guarantee, accepted deliberately in exchange for a process that works at human speed, and recorded as an
> open consideration in `RUNTIME-DECISION.md`. It makes this step **more** important, never less: a human sets
> the substitution toggles, always, as the last action before hand-back.

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

> **NOTHING LIVES PERMANENTLY IN A SCRATCHPAD.** Working files are fine *during* a shop. **When the basket is
> deemed checkout-ready, everything still in a scratchpad that matters must be made permanent** — the order, new
> regulars, aliases, harvested ASDA product IDs, rotation history, pending favourite actions. A shop that ends
> with knowledge in a temp directory has taught the household nothing, and next week starts from zero. This is
> the same failure as the missing write-back arc above, wearing a different hat.

**The regulars half of the learning has a writer as of 2026-07-28** — use
`services/asdair/outcome/update-regulars.js` (`--dry-run` first, every time). Two operations and nothing else:

| Operation | Use it for |
|---|---|
| `upsertRegular` | A genuinely new item found mid-shop. Safe to re-run: an existing regular with the same normalised name is **adopted**, never duplicated (a duplicate would make the planner treat that term as AMBIGUOUS and break it every week). |
| `enrichRegular` | An alias (`add_aka`, which **merges** — prior aliases are never lost), a harvested `asda_product_id`/`asda_url`, brand, typical qty, substitutes flag. |

It **cannot** delete, retire, rename or re-home a regular — not by flag, not by argument. The database grant
enforces that independently of the code (`db/005_asdair_rw_grants.sql`).

> **Harvest product IDs while you shop — they are only obtainable there.** Every ASDA product URL carries its id
> (`/groceries/product/<category>/<slug>/<ID>`), and the Regulars/Favourites page you are already traversing is
> full of them. Capturing them as you go took coverage from 21/91 to 41/97 in one shop. An item with an
> id resolves by id next week instead of by name. *(2026-08-04: wording only — this previously referred to "the
> accessibility tree you already read for the bulk tick pass", which described the superseded bulk-add method.
> The harvesting instruction itself is unchanged and still binding.)*

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

**1. Sort order — BRAND A–Z or plain A–Z? RESOLVED 2026-08-04: BRAND A–Z.** ~~§4 above says sort A–Z. The database
copy said sort **BRAND** A–Z, and also that the resolved basket should be output sorted by brand. These may be the
same intent loosely worded, or the brand sort may be a deliberate refinement that made the single-pass tick
reliable. Unknown which.~~ *(2026-08-03: moot for `browser-runner`, which sorts nothing.)*

> **RESOLVED by Warwick's ruling `BUILD-015-CANONICAL-RUNTIME-REALIGNMENT`, 2026-08-04.** The answer is
> **Brand A–Z**, and it applies to both halves the old question asked about: the ASDA grid ordering **and** the
> order of the prepared execution packet, which must sort deterministically by **(1) normalized brand A–Z, then
> (2) canonical product name A–Z**. The database copy was right. §4 above now says Brand A–Z. Kept rather than
> deleted so the sequence stays legible. Canonical:
> `Builds/BUILD-015-asdair-durable-household-shopping-steward/CANONICAL-WEEKLY-SHOP-PROCESS.md` §E.

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

- ~~The browser drive is not yet proven from a subagent...~~ **SUPERSEDED 2026-07-28, commit `ab3f231`.**
  This line described one mechanism's limit (a Claude Code subagent does not inherit host MCP tools) and was
  wrongly generalised into "the browser step needs Larry." **PROVEN otherwise**: `services/asdair/browser-runner/`
  is a plain, zero-dependency Node/CDP process (`runner.js`) — an independently deployed program, not something
  any Claude Code agent, subagent, or MCP tool drives or needs to drive. It is started the same way any other
  service on this machine is started (`node runner.js --request <id>`, same pattern as `pipeline-runtime` and
  `cockpit-api`) — by a specialist's Bash tool, a scheduled task, or a human, all equally valid. "Asdair directs,
  Larry clicks" was never a valid permanent operating mode. See the commit message and `RUNNER-PROOF.md` for the
  decisive experiment. **Do not re-test this** — it is settled.
  > **SUPERSEDED IN CONSEQUENCE, 2026-08-04 (`BUILD-015-CANONICAL-RUNTIME-REALIGNMENT`).** The technical finding
  > above stands — `runner.js` genuinely does not need Larry, and that is still not to be re-tested. What
  > changed is what follows from it: **`runner.js` is no longer the live basket writer.** Warwick ruled the live
  > Stage 1 writer is **Sonnet in Claude for Chrome**; the CDP runner is experimental, deferred, not the live
  > default, and **prohibited from further live-account testing without fresh authority from Warwick**. So the
  > correct reading of this bullet is narrow: it retired "the browser step needs Larry", and it did **not**
  > establish the runner as the operating route. `RUNTIME-DECISION.md`.
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
- **No plan builder exists** *(added 2026-08-03)*. `stepQueueBrowserBuild` creates the
  `asdair.browser_build_request` row but does **not** populate `progress.plan`; nothing in the repo converts
  resolved `shop_line` rows into a browser-runner plan. On 2026-08-03 it was assembled by hand. Verified by
  enumeration — `step_id` appears only inside `services/asdair/browser-runner/`. ~~This is the largest remaining
  gap, and building it is a `product-decision`~~:
  [[SOP-021a-asdair-live-execution-method]] §7.6.
  > **AMENDED 2026-08-04 (`BUILD-015-CANONICAL-RUNTIME-REALIGNMENT`).** The gap is real and the enumeration
  > stands, but it is **no longer on the live critical path**, because the CDP runner is no longer the live
  > writer. WO-C (the runner plan builder) is **superseded in purpose**; what replaces it is the **Sonnet
  > Browser Execution Packet** (WO-P) — a durable, deterministic, Brand A–Z artefact produced by the product
  > itself and stored in Postgres, with a different consumer. **No Claude session constructs it by hand.**
  > `CANONICAL-WEEKLY-SHOP-PROCESS.md` §E.
- **The live basket writer has no mechanical substitution/checkout enforcement** *(added 2026-08-04)*. Sonnet in
  Claude for Chrome is bound by instruction and supervision, not by a closed command allowlist. The boundaries
  (never book a slot, check out, pay, enter a password, or auto-substitute) are unchanged and absolute, but under
  this adapter they are **not** enforced in code. Recorded as an open consideration in `RUNTIME-DECISION.md`.

## References

- **WHO WRITES THE LIVE BASKET (canonical, 2026-08-04):**
  `Builds/BUILD-015-asdair-durable-household-shopping-steward/RUNTIME-DECISION.md`
- **The end-to-end canonical process (2026-08-04):**
  `Builds/BUILD-015-asdair-durable-household-shopping-steward/CANONICAL-WEEKLY-SHOP-PROCESS.md`
- **Mechanical execution method of the DEFERRED experimental CDP adapter — preflight, diagnostics and failure
  modes: [[SOP-021a-asdair-live-execution-method]]**
- Standing rules + rule model: `services/asdair/skill/README.md`
- Schema and the loop's tables: `services/asdair/db/001_asdair_schema.sql`
- Outcome + learning writers: `services/asdair/outcome/`
- Function-vs-state split: Warwick's ruling, 2026-07-27 (table above)
- **Shopping data is explicitly NOT a privacy matter** (Warwick's ruling, 2026-07-27). Do not redact or hedge it.
  The only thing that stays out of the repo is **secrets** — tokens, connection strings, credentials:
  [[personal-data-never-public-repo]]
