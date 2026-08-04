# Next AsdAIr session — brief

**~~For the Larry who runs next week's shop.~~** Written 2026-07-28 at the close of the BUILD-015 durability session.

> Reconstruct live state from git, `gh pr list`, and the `asdair` database. Everything below may have moved.

> **⚠️ SUPERSEDED IN PART, 2026-08-04 — Warwick's ruling `BUILD-015-CANONICAL-RUNTIME-REALIGNMENT`.**
> **Larry does not run the shop and does not drive the ASDA browser.** The Stage 1 live basket writer is
> **Sonnet in Claude for Chrome**, using the proven **Brand A–Z ordered sequential traversal** — not Larry, not a
> Claude Code subagent, and not the CDP runner at `services/asdair/browser-runner/` (experimental, deferred, not
> the live default, and **prohibited from further live-account testing without fresh authority from Warwick**).
> **Canonical:** `Builds/BUILD-015-asdair-durable-household-shopping-steward/RUNTIME-DECISION.md` and
> `CANONICAL-WEEKLY-SHOP-PROCESS.md` in the same folder.
> **The rest of this brief still stands** — the learning-capture priority in §2, the known gaps in §4, and the
> hard rules in §6 are unchanged and still the highest-value things in it.

---

## 1. Do the shop first. It works.

**Do not start by fixing things.** The supervised workflow is the product and it already runs: Warwick drops the
list, it is resolved against Mum's Regulars, genuinely unknown items are held and asked, **Sonnet in Claude for
Chrome builds the basket** *(2026-08-04 — this line previously read "you resolve it… drive the ASDA browser",
addressed to Larry; superseded, see the banner above)*, never substitute, never check out.

`Team Knowledge/SOPs/SOP-021-run-the-weekly-asdair-shop.md` is the method — **it is on `main` now**, including the
expensive lessons: the **stepper trap** (typed quantity edits do not persist server-side, use `+`/`−`), never
infer quantity from price, and that a failed batch add means **one out-of-stock item rejecting the whole batch**.

## 2. THE ONE THING THAT MATTERS MOST — capture the learning

**Last week's shop went beautifully and left ZERO trace.** No order recorded, no new regulars, no decisions
logged. Three new items were worked out and then forgotten. Next week would have re-derived them from scratch.

That is the whole reason BUILD-015 exists. **So this week: record it.**

> **2026-07-28 update — the 2026-07-27 learning WAS recovered and is now in the database.** 20 harvested ASDA
> product IDs (coverage 21/91 → 41/97), 6 genuinely-new items (Wall's 4-pack, Milky Way + Mars large multipacks,
> TRESemmé blue shampoo, black pepper, loratadine), and 5 alias sets including `chips` → ASDA Crispy Skin-On
> Fries. It was recovered from a session transcript, which worked exactly once and is not a method. **Record as
> you go from now on.**
>
> Still outstanding from that shop: the **order + decisions** were NOT written, because only Warwick knows what
> was finally checked out (the basket was left checkout-ready at GBP 111.75 and he completed it). Do not invent
> that record.

```
cd services/asdair/outcome
node --env-file=C:/.fusion247/asdair.env record-shop.js --file shop.json --dry-run   # validate first
node --env-file=C:/.fusion247/asdair.env record-shop.js --file shop.json
```

`record-shop.js` is the committed runtime caller (input shape in its header). `--dry-run` opens no connection.
**Run the dry-run first, every time.**

**Every answer Warwick gives you is an alias.** When he says "bread means Warburtons Danish", that is a new `aka`
on regular 88 — and it is the single highest-value thing you can capture. See §4: there is currently no governed
writer for it, so record the decision via `promoteDecision` **and** note the alias for manual application.

## 3. What Larry needs out of that session's memory

When the shop is done, before the context is lost, get these into durable state — not into a session log:

- **every list-term → product resolution you made**, especially ones the planner could not do itself. These are
  `aka` aliases and they are why next week is better than this week.
- **any genuinely new item** — it belongs in `asdair.regulars`, not a note.
- **any ASDA product ID you saw on a page** — 70 of 91 regulars still lack one, and they can only be harvested
  during a real shop.
- **anything that surprised you about the ASDA UI** — that belongs in SOP-021, in Git.
- **what you had to work out yourself** rather than read. That is the durability defect list writing itself.

## 4. Known gaps — do NOT fix these before the shop

All real, all named, none a safety failure. Ranked by value:

1. ~~**No governed writer for `asdair.regulars`.**~~ **CLOSED 2026-07-28.** Use
   `services/asdair/outcome/update-regulars.js` (`--dry-run` first). `upsertRegular` for a new item (adopts an
   existing same-named regular rather than duplicating), `enrichRegular` for aliases/product IDs (`add_aka`
   merges, so prior aliases are never lost). It cannot delete, retire, rename or re-home a regular — the grant
   in `db/005_asdair_rw_grants.sql` enforces that in the database, not just in code.
   **New in the same pass:** `services/asdair/intake/fetch-shopper-list.js` is the committed ShopperBot
   receiver — do NOT hand-roll a `getUpdates` snippet again.
2. **Alias matching is exact-string.** `"yazoo strawberry"` misses the alias `"strawberry yazoo"` on word order
   alone. Measured resolution over the household's own history: **52%**. Order-insensitive matching plus alias
   coverage is the fix. (Suggestions now fall back to partial word overlap, so held lines at least surface
   candidates — but resolution itself is still exact.)
3. **`map` directives can resolve to prose, and prose reaches `add`.** Rule 23 maps `sure male` →
   *"Sure Men Anti-Perspirant Deodorant (blue variant)"*. That is an instruction, not a product, and the planner
   treats it as confidently matched. **Watch for it when driving.**
4. **No `loadLastOrder`.** SOP-021 makes the previous order a required planning input; nothing loads it, so
   rotation rules ("a different variant each week", e.g. Sure) cannot run.
5. **Rule 7 (budget band) is structurally dead** — no price column exists anywhere, so `budget_flag` is
   permanently `unknown`. Documented as NOT OPERATIVE; do not claim it works.

## 5. Warwick's open questions — his call, not yours

1. **"substitute Banana → Strawberry"** from the superseded method. A legitimate `map`, or a safety bug against
   standing rule 6 and the live hard-excludes? Both readings are recorded in SOP-021, neither encoded. **Interim
   safe default: hold any banana/strawberry line as `needs_decision` and ask.**
2. ~~**Sort order** — SOP-021 says A–Z; the superseded database copy said BRAND A–Z.~~ **CLOSED 2026-08-04:
   BRAND A–Z**, for the ASDA grid ordering and for the execution packet (normalized brand A–Z, then canonical
   product name A–Z). The superseded database copy was right. Not Warwick's open question any more.
3. **Data conflicts:** `Arla BOB Semi-Skimmed 2L` (regular 69) is ACTIVE while rule 10 says never buy BOB — and
   rule 10 is `info` with no `match_term`, so nothing enforces it. `milk` resolves correctly today **only because
   regular 69 happens to carry no alias.** Also: rules 23/24 fix the Sure variant while `rule_qa_log` #5 says
   rotate it. And a test row (`BUILD-002 live proof`) still sits in a `next_week_draft` list.

## 6. Hard rules — never negotiable

Never auto-substitute · never book a slot · never check out · never pay · never enter the ASDA password ·
`checked_out` stays false. **Warwick is the gate for every consequential action.**

Shopping content is **not** a privacy matter (his ruling, 2026-07-27) — report baskets plainly. Only **secrets**
stay out of the repo.

## 7. State at handoff

BUILD-015 record: `Builds/BUILD-015-asdair-durable-household-shopping-steward/`. PR #73 carries the durability
repair. Two credentials exist: `ASDAIR_DB_URL` (`asdair_ro`, SELECT-only) and `ASDAIR_WRITE_DB_URL`
(`asdair_rw`, narrow write) — both in `C:/.fusion247/asdair.env`. **Consume the environment, never inspect it.**

**Check the PR's merge state before assuming anything.**
