---
agent_id: larry
session_id: asdair-weekly-shop-browser-automated
timestamp: 2026-07-27T18:03:07Z
type: close-session
linked_sops: []
linked_workstreams: []
linked_guidelines: []
---

# AsdAIr weekly shop — Mum's list → checkout-ready ASDA basket, browser-automated

## Coverage window

- **Previous close checkpoint:** `[[2026-07-22-00-00_larry_tower-mergeqa-directus-merge-and-reboot-recovery]]`
- **Covered from:** 2026-07-22T23:00Z
- **Covered to:** 2026-07-27T18:03Z
- **First checkpoint:** no
- _Note:_ work between the checkpoints (IDEA-007 live-access boundary, Tower CP watcher PR #58 merged, the BRAINS/Arc+Mason operating model, cockpit-worktree render lessons) happened in **other** sessions and is recorded in their own session-logs + memories — not retold here. **This** session was solely the AsdAIr weekly shop.

## Context

Warwick opened with "before we start with the build team, need to do latest shopping" — Mum's weekly ASDA list had just arrived via the Fusion247 Shopper bot. The explicit ask this week: **do it fully automated in the browser, no copy-paste** ("this is supposed to be automated"), shopping from Favourites/Regulars sorted alphabetically by brand.

## What we did

- **Larry** received the list from `@Fusion247shopperbot` (a photo) via a fresh scratchpad `shopper-recv.mjs` (getUpdates on the shopper token), and **OCR'd it with vision** — 33 handwritten items.
- **Larry** resolved the list against `asdair.regulars` + the rulebook (MyPKA Supabase, read-only), pulled last week's order (list 3) for continuity, presented the reconciled basket, and got Warwick's confirms: Wall's = 1×4-pack; Dreamies/Vanish usual sizes; Sure rotate + round to 4 (+1 female) on the 2-for offer; OJ buy 2 on 2-for-£5.
- **Larry** drove ASDA live in the browser (Warwick already logged in): Regulars tab, sorted **A–Z**, parsed the full 90-item accessibility tree to map 25 target checkboxes by ref, **bulk-ticked all 25 and "Add selected to trolley" in one go** (£100 landed). Then **search-added** the non-regulars via the `find` tool: hayfever (ASDA Loratadine 30), black pepper, Milky Way 10-pack, Mars 8-pack, Tresemmé Rich Moisture shampoo 680ml (blue), female Sure Bright Bouquet 250ml, and the missed Wall's 4-pack.
- **Larry** did the mandatory **line-by-line quantity reconcile** in the trolley (fixed Warburtons 2→1 and Princes Corned Beef 2→1; caught that **Wall's Sausage Rolls was silently missed** by the tick-pass and added it), set **"Allow substitutions for all" OFF**, and captured the offers (Pasta 4-for-£3.50, OJ 2-for-£5, Sure 2-for-£5 = 3 male + 1 female, milk 2-for-£4).
- **Result:** 32 products / 48 items / **£111.75**, checkout-ready. **Larry did NOT book a slot or check out** (Mum's rule: never place the order).

## Decisions made

- **Question:** Favourites tab (Warwick's word) or Regulars tab for the add?
  **Decision:** Regulars — it is the **only** tab with bulk checkboxes + "Add selected to trolley" (Favourites is individual-add only). Tick a single correct product per item, which honours Warwick's "no duplicate types" intent.
- **Question:** Stardrops 3-in-1 disinfectant not stocked at ASDA — substitute?
  **Decision (Mum's rule):** never auto-substitute — leave it **off** and flag for a human pick (nearest = Stardrops Multi-Purpose Cleaner 850ml).
- **Question:** Wall's sausage rolls quantity?
  **Decision (Warwick):** 1 × the 4-pack.

## Insights

- **ASDA Regulars grid won't scroll via wheel or keyboard under MCP automation** (the documented flaky grid); `scroll_to` on an element **ref** IS the reliable scroll lever, and the DOM **accumulates** loaded items — so: scroll to load all → read the full a11y tree once → batch-tick every target checkbox by ref → single bulk add. Screenshots blank on the heavy grid, but the **trolley page renders fine** and is where reconcile happens. Updates `[[asdair-idea012-runtime]]` / the cockpit-grid lessons.
- The **`find` tool nails exact "Add to cart" buttons by product name** — the efficient primitive for search-adds.
- **Wall's Sausage Rolls is not in Mum's Regulars/Favourites**, so the tick-pass silently skips it — precisely the "agent drops an item" failure Mum's mandatory reconcile rule exists to catch.

## Realignments

- _"remember that we are only shopping from favourites and they should be synced so there aren't multiples of each type of items."_
- _"can you try do it in [the] first place, this is supposed to be automated without me copy pasting."_
- _"remember to get your list alphabetical by brand, then [do the] same on asda"_
- Answers to the five confirms, verbatim: _"1 - 1 4 pack / 2 usual / 3 correct / 4 yea / 5 yes"_ and _"milky way and mars are new large multipacks", "treseeme shampoo please blue label."_

## Open threads

- [ ] **Warwick to finish the shop:** decide the Stardrops alternative (or skip), OK the size picks (black pepper 25g, Milky Way 10-pack, Mars 8-pack, Tresemmé 680ml blue), then **book a slot + checkout** (Larry never places the order).
- [ ] **Add Wall's 4-pack (and other frequently-missed items) to Mum's ASDA Favourites** so the bulk sweep catches them next week.
- [ ] **Sure variant rotation:** used **Quantum Dry** this week — record so next week rotates to a different blue (Sport Cool / Invisible).
- [ ] **Weekly-order capture into `asdair.shopping_lists` still to build** — this week's basket was NOT written to the DB (offered, not done).
- [ ] Then: switch to the **build team** (Warwick said he'd say the word).

## Next steps

- **Resumption point:** await Warwick — either he finalises the shop (slot + checkout) or gives the word to move to the build team. The standing AsdAIr direction (memory) is to get it **off the terminal onto the Directus cockpit** (an AsdAIr tab / watched inbox), on hold pending his architecture greenlight.

## VlogOps / story signals

- "Do it yourself this time — no copy-paste": Larry actually driving a live weekly ASDA shop end-to-end in the browser, not handing back a list.
- The bulk-add moment — 25 items into the trolley in a single click (£100 in one go).
- The line-by-line reconcile catching a **silently-missed item** (Wall's sausage rolls) — the exact failure mode Mum's rule warns about, caught.
- Declining to auto-substitute the unavailable Stardrops — the agent holding the "never substitute" line.

## Cross-links

- `[[2026-07-22-00-00_larry_tower-mergeqa-directus-merge-and-reboot-recovery]]` — previous close checkpoint.
- `[[asdair-idea012-runtime]]` — AsdAIr build state + runtime (rulebook, regulars, shopper intake).
