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

> **CONCURRENCY HAZARD — do not ignore.** `getUpdates` is a single-consumer, destructive-ack protocol with no
> lock or lease. Its entire safety argument is *"nothing else polls this token."* **A second concurrent poller
> breaks that by existing** — the realistic failure is a shopping list silently consumed and permanently lost,
> with no error surfaced. Exactly one process may poll the shopper token at a time. If another lane needs the
> request, it must be handed the payload, not given the token.

**Handwritten lists:** transcription is done by vision, in-context — there is no separate OCR service. Transcribe
to structured items, then normalise via `services/asdair/skill/listNormaliser.js`.

## 2. Plan

Run the planner against the durable rulebook. It is pure and deterministic — same inputs, same output — which is
what makes the runtime disposable.

```
node services/asdair/skill/cli.js --list-date <YYYY-MM-DD> --household <id>
```

Connection comes from `ASDAIR_DB_URL` in the environment only, never on the command line.

Resolution is **offline** against `asdair.regulars` and `asdair.products` — do not scrape the live site to work
out what an item means. That was the original slow path and it is solved.

## 3. Human approval

The plan returns a `needs_decision` queue. **Never auto-substitute** (standing rule 6). Surface alternatives and
let a human choose. Budget breaches **flag, never block** (rule 7).

Every answer given here is a learning event — carry it to step 6.

## 4. Shop

Warwick logs into ASDA. He is already authenticated; **Larry never enters the account password** (hard rule), and
cannot open the extension sidebar.

**The proven add method — follow it, this was expensive to learn:**

- The **Regulars tab is the only tab with bulk checkboxes and "Add selected to trolley."** Favourites offers
  individual adds only. Use Regulars.
- **Sort A–Z** and do a **full single pass**: tick every match, then one bulk add. Do not scroll-hunt and do not
  switch views mid-pass — the grid reshuffles and resets sort. Two-at-a-time is a fallback only.
- The grid **will not scroll by wheel or keyboard.** `scroll_to` on an element ref is the scroll lever. The DOM
  **accumulates** loaded items, so: scroll until everything is loaded, `read_page` the accessibility tree **once**
  (persist to a file if large and parse it for checkbox refs), then batch-click every target ref and add in one go.
- **Screenshots come out blank on the heavy grid.** The trolley page renders fine — do verification there.
- Search-adds: navigate to the search URL for the term, then use the `find` tool to locate the exact product's add
  button and click its ref.

> **The real cause of a failed bulk add is a single OUT-OF-STOCK item silently rejecting the WHOLE batch.** It is
> not batch size, and it is not an expired delivery slot (that theory was tested and is wrong). Out-of-stock items
> still appear in Regulars/Favourites. If a bulk add fails, split the batch only to isolate and drop the
> out-of-stock item, then resume the full pass.

**Never book a delivery slot. Never check out.** The goal is a checkout-ready basket and nothing further
(standing rule 8). Payment and any consequential purchase remain Warwick's gate.

## 5. Reconcile, then RECORD

On the trolley page, do a line-by-line quantity reconcile and **untick "Allow substitutions for all."**

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

## 7. Confirm

Ping "basket ready" back through the shopper bot. Warwick reviews and completes any purchase himself.

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
- Some regulars still lack captured ASDA product IDs, so those resolve by name rather than by ID.

## References

- Standing rules + rule model: `services/asdair/skill/README.md`
- Schema and the loop's tables: `services/asdair/db/001_asdair_schema.sql`
- Outcome + learning writers: `services/asdair/outcome/`
- Function-vs-state split: Warwick's ruling, 2026-07-27 (table above)
- Secrets discipline (tokens and connection strings only — not shopping data):
  [[personal-data-never-public-repo]]
