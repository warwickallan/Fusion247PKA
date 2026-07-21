# AsdAIr (IDEA-012) — Build Record & Roadmap

_2026-07-21, ~01:45. Honest status after the first real Telegram-photo shop, reasoned clean of the night's missteps. Contains SYSTEM/architecture only — no household data (that lives in private Supabase + gitignored-local, never here)._

## 1. What happened tonight
A real handwritten list was photographed, sent via Telegram, transcribed, resolved against the household's rules, and turned into a **checkout-ready Asda basket, in budget, left for the human to review + check out** (nothing paid). The run was **human-in-the-loop** (Larry resolved offline; a Sonnet browser agent + Warwick drove the live ASDA page). It worked.

## 2. The AsdAIr "brain" — now genuinely built (private Supabase `asdair` schema)
- **`regulars`** — mirror of the Asda Favourites/Regulars list (91 products): high-level category, category, name, **brand**, **`aka` aliases** (the varied phrasings the lister uses), **`substitutes_allowed`**, and **21 verified Asda product IDs** (harvested from live pages; a fabricated ID was caught and removed — only read-verified IDs are stored).
- **`rules`** (~39 active) — every standing decision as structured directives (map / exclude / substitute / rotate / offer-round-up / process / stock), + free-text audit. Learning loop via **`rule_qa_log`**.
- **`resolve_regular()`** SQL function + **`previously_ordered`** view — the **offline resolver**: a raw list line → known product via aka → name → rules. Proven to clear ~28/30 lines **before ASDA is opened**.
- **Order history** — `shopping_lists` / `shopping_list_items` / `orders` capture each week (this week recorded).
- **`skill_steps`** — the **canonical 21-step runtime skill v1** (agreed with Warwick), reasoned clean of tonight's missteps.

## 3. Honest gap vs the full spec (LRY-ASDAIR-FULL-PRODUCT-SLICE)
- **Done/proven:** transcribe; preserve image+raw text; load rules/mappings/budget; normalise+dedupe; identify uncertain matches; never auto-substitute; never checkout (both hard-coded); add only listed items; correct quantities (after audit); search for absent items; research alternatives w/ prices; flag prices+budget; basket left ready; write run/outcomes to Supabase; retain new Q&A.
- **Descoped (Warwick, 2026-07-21):** **fully hands-off is dropped.** No auto-browser / "no manual start" bar. A **human logs into Asda**. One shop/week; retest next week.

## 4. Key lessons baked in (so they don't recur)
- The add-block was **out-of-stock items**, NOT an expired slot or batch-size. Default = **full brand-A-Z pass → bulk add**; 2-at-a-time is only the OOS-isolation fallback.
- Don't scroll-hunt or switch grid/list views mid-pass (list won't scroll; grid resets the sort).
- Qty edits must use the **+/- steppers** (text-field edits don't persist server-side).
- **Mandatory line-by-line quantity audit** vs the original list before handover (agents get quantities wrong — caught the missed hotpots this way).
- Set per-item substitutions **at the end**; keep "allow subs for all" **unticked**.

## 5. New direction (Warwick, 2026-07-21) — off the terminal, onto Directus, multi-device
1. **Cockpit AsdAIr tab** — all favourites/regulars with a per-item number picker + add/added + submit; plus current basket + a **self-building next-week list**.
2. **One "watched inbox"** the brain reads, fed identically by shopper-bot text, shopper-bot photo, the Cockpit picker, and later the **Fusion app**.
3. **Weekly cadence** — after a shop is confirmed done/checked out, prompt Warwick, then start compiling next week.
4. **On Directus, any web-enabled device** (private/authenticated), not terminal-only.
5. **Proper 2-way Larry interaction** via Telegram / Fusion app (today only 1-way DevBot→session) — flagged "most crucial".

## 6. In flight (research dispatched 2026-07-21, no Fable, no live changes)
- `2026-07-21-asdair-two-way-larry-interaction-research.md`
- `2026-07-21-asdair-fusion-app-expansion-research.md`
- `2026-07-21-asdair-cockpit-directus-watched-inbox-design.md`

## 7. Recommended next step (for Warwick's greenlight)
Do **not** blind-build the multi-device architecture. Review the 3 briefs, pick the **watched-inbox mechanism** and the **Cockpit-vs-app-first** order, then build the smallest useful slice (most likely: an `asdair.inbox` table + a private Cockpit tab reading `regulars` with a picker that writes to that inbox). Hold until greenlit.
