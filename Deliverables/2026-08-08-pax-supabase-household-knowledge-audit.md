# Pax — Bounded read-only Supabase household-knowledge audit (BUILD-015)

**Pax, 2026-08-08. Commission: Warwick, "Asda Build 002" §6–§9. Governance head `431df23`,
`build-015/grounded-recognition`. Method: the live-DB extract Larry ran tonight (read-only
`asdair_ro`, SELECTs only — `scratchpad/pax-db-extract.md`) cross-read against production source at
the stable main checkout `C:\Fusion247PKA\services\asdair\**` (byte-identical to the governance head
for these paths, per dispatch) and my two prior BUILD-015 briefs. No database access of my own; no
mutation anywhere; facts I could not establish are in §"Facts Larry must fetch", never inferred.
Evidence labels: LIVE (extract row), SOURCE (file:line read tonight), INFERRED (stated as such).**

---

## A. WHAT THE HOUSEHOLD DATABASE ACTUALLY KNOWS

25 tables/views were row-counted (LIVE). The knowledge-bearing classes, with authority per §7
(1 = external platform evidence · 2 = household explicit intent · 3 = learned household evidence ·
4 = historical observation):

| Class | Physical home | Rows | Active | Authority | Provenance & timestamps (LIVE) |
|---|---|---|---|---|---|
| Regulars (membership) | `asdair.regulars` | 103 | 103/103 | **1** (ASDA-curated membership) | `source={regular}` only; created 2026-07-20 → 2026-08-03 22:08; zero duplicate names |
| Favourites representation | — | 0 | — | — | **Does not exist live.** `source_view:"favourites"` describes nothing; Favourites survives only as prose in rules 4/9 |
| Canonical product names | `regulars.name`, `products.matched_product` | 103 + 11 | — | 1/3 | as above; `products` seeded from the July decisions batch |
| Aliases (`aka`) | `regulars.aka` | rich on most sampled rows (e.g. 6 aliases on Cravendale) | — | **3** — but **no per-alias provenance is recorded**, and no production writer has ever executed (see B) | curated during July/August Larry sessions |
| Brand / category / variant | `regulars.brand`, `category`, `high_level_category` | 103 | — | 1/3 | populated on all sampled rows |
| Usual quantities | `regulars.typical_qty` | **null on all 12 sampled rows** | — | — | effectively empty (whole-column count: fetch F5) |
| Explicit rules | `asdair.rules` | 40 | 40 | **2** (rule_text cites Warwick + dates) | directives: 24 info · 10 map · 3 exclude · 2 needs_decision · 1 rotate; seeded via migration 011 from the decisions log |
| Previous answers (per-shop) | `asdair.shop_question` | 11 | all `answered` | **3** | all shop 6, 2026-08-03 — real human answers incl. two vision-misread corrections (Stardrops, Sudocrem) |
| Promoted decisions | `asdair.rule_qa_log` | 5 | all `applies_going_forward=true` | **3** | all July (latest 2026-07-20); #4 → rule 17 (banana yazoo), #5 → rules 27–33 (7 ambiguities batch) — **zero rows from shop 6's 11 answers** |
| Previous-shop decisions | `asdair.shop_line` | 50 | — | 3/4 | shop 6: statuses matched / needs_confirmation / unmatched_new_item; **`match_confidence` null on every sampled row** |
| Previous-order context | `orders` (2) + `shopping_list_items` (132) + live-only view `previously_ordered` (106 keys) | 106 item-keys | — | **4** | frequency + last-ordered per item, 2026-07-18 → 2026-08-03; e.g. `sure male` ×3 qty 9, `arla semi milk` ×2 qty 7 |
| ASDA IDs / URLs | `regulars.asda_product_id/asda_url` | 57 of 103 have an id (46 without — LIVE) | — | 1 | — |
| Recognition-candidate history | — | **0** | — | — | **Not persisted at all** (invariant D — see C) |
| Rule QA log | `rule_qa_log` (same rows as promoted decisions) | 5 | — | 3 | — |
| Household product mappings | `asdair.products` (list_term → matched_product) | 11 | — | **3** | July batch (Toffees, Frank's 6-pint, Vanish Pink/White…) |
| Misc | `product_alternatives` 2 · `budget_settings` 1 · `source_documents` 6 · `pending_action` 0 · `skill_steps` 22 (live-only) · `process_suggestions` 0 | | | | |

**The BOB proving case, classified (Warwick §7):** rule 10 «Milk means Cravendale Arla; never a
Best-of-Both / BOB variant» = class-2 TRUE household intent (KEEP, per §5 ruling). Regular 69 «Arla
BOB Semi-Skimmed Milk 2L», ACTIVE, zero aliases = class-1/4 external/stale platform evidence. The
model must let 2 beat 1 — today it structurally does not (see the trace); the household is protected
only by class-3 alias data on regular 4.

## B. WHAT PRODUCTION ASDAIR ACTUALLY CONSUMES

Loader paths verified at SOURCE tonight. The three consumers: **Terra prompt**
(`interpret/loadCatalogue.js:60` → `groundedPrompt.js`), **deterministic recognition**
(`interpret/resolveByCatalogue.js`), **planner** (`skill/data.js loadPlanningInputs` →
`skill/planner.js planBasket`, wired at `pipeline/runPipeline.js:363–389`).

| Class | Verdict | Exact path |
|---|---|---|
| Regulars | **READ** | loadCatalogue.js:65 → prompt (id/name/brand/category/aka/typical_qty) + `regularsById` for resolver consumers; data.js:351 → planner `matchRegular`/`regularCandidates` |
| Aliases | **READ** — the strongest signal in all three consumers (resolver passes 1/2b/3; prompt: "their own alias list is the strongest signal") | resolveByCatalogue.js:87–125 |
| Canonical names | **READ** | resolver pass 2/4; planner `matchProduct` precedence: explicit id > products.list_term > map rule > regulars |
| Brand/category/variant | **PARTLY READ** — brand+category in prompt and resolver pass 4; `high_level_category` selected (loadCatalogue.js:66) but reaches nothing | — |
| Usual quantities | plumbing READ, **data empty** — decorative until populated | compactRegular drops null |
| Rules | **PARTLY READ** — the 16 directive rules (map/exclude/rotate/needs_decision) reach Terra AND planner line-level; the 24 `info` rules reach the planner only: with `match_term` → note-only line advisory (planner.js:1671–83), without → basket-level summary advisory attached to no line. **Rule 10 is `info` with NO match_term → it reaches no line, no prompt, no resolver — structurally unenforced** | loadCatalogue.js:74–80 excludes `info` from the prompt by design |
| Previous answers — `rule_qa_log` | **PARTLY READ** — planner consults as `priorAnswers` BEFORE deciding (runPipeline.js:381–387; planner.js:1704–15), but only rows with `applies_going_forward=true`, and only as flags/notes — never identity. All 5 July rows qualify. **Every future pipeline-recorded answer will NOT qualify** (see C) |
| Previous answers — `shop_question` | **PARTLY READ** — within its own shop only (question-key dedupe + replan). Never consulted cross-shop | runPipeline.js:357–361 |
| Promoted decisions (rules 17, 27–33) | **READ** — full chain live: rule_qa_log #5 → rules with match_term → Terra prompt + planner | — |
| Previous-order context | **CONDITIONALLY READ / UNESTABLISHED live** — last COMPLETED order only (`total_added is not null`, loadCatalogue.js:86–95; data.js loadLastOrder) into prompt + planner rotation. Whether either of the 2 live orders qualifies: fetch F1. The **106-key `previously_ordered` view is READ BY NOTHING** (repo-wide enumeration; only the 012 grant matrix names it). Resolver's `BASIS.PREVIOUS_ORDER` and `opts.lastOrderNames` are declared and **never used by any pass** (resolveByCatalogue.js:33,59) — decorative |
| ASDA IDs/URLs | **READ downstream** — deliberately withheld from the model; used by shopLines/planner for basket identity. 46/103 regulars lack one (does not gate recognition — no filter exists; invariant B holds) |
| Recognition-candidate history | **NOT READ — never persisted** (see C) |
| `products` mappings | **READ** — planner precedence above regulars (data.js:306) |
| `product_alternatives` / `budget_settings` | **READ** — data.js loadList / loadBudget |
| `skill_steps` (22 rows, live-only) | **NOT READ** — zero readers in production source |
| `pending_action` | writer wired; reader is Cockpit display only; 0 rows |
| `source_documents` | READ only by the promotion path, which has **no production caller** (Larry-mediated) |

## C. WHAT IS BEING LOST — concrete, live-evidenced

1. **Terra's candidate evidence is discarded every shop (invariant D — the §11E finding, now
   live-corroborated).** `deps.realInterpretPhoto` strips the reply to
   `{line_no, raw_reading, quantity}` (deps.js:178–182), discarding `matched_regular_id`,
   `confidence`, `alternatives`, `match_basis` that the prompt demanded; identity is re-derived from
   raw text. LIVE corroboration: **every sampled shop-6 line has `match_confidence: null`**, and
   question q911d80b5 asked Warwick "Which product is *2 yazoo choc*?" while regular 15 carried the
   alias `choc yazoo` — Terra almost certainly grounded it; the evidence was stripped; the old
   string-matcher missed the reversed word order; a human was asked. (That specific miss is since
   fixed in code — pass 2b — but the evidence-discard pattern that caused it is unchanged.)
2. **Shop 6's 11 human answers died with shop 6.** Zero `rule_qa_log` rows exist after 2026-07-20
   (LIVE) — the 2026-08-03 run predated the answer-learning wiring. Eleven real decisions, including
   two vision-misread corrections ("Sundries" = Stardrops 3in1; "Bioderma" = Sudocrem), exist only
   as per-shop rows no future shop consults. Next week's list re-asks e.g. the Vanish-variant
   question with nothing carried over.
3. **Even when the wired learning loop runs, it cannot improve a future shop.** The pipeline
   hard-codes `applies_going_forward: false` and `resolution: {kind:'none'}` (runPipeline.js:581–584,
   deliberate — no human act asserts "going forward"), so `buildAnswerLearning` emits **no alias
   operation and no rule promotion**, and the resulting log row is **excluded by the planner's own
   eligibility filter** (`applies_going_forward !== true` → out, planner.js:1091). The loop's
   "closes through the decision log" comment is structurally false for pipeline-written rows: they
   are audit-only.
4. **No production path can add an alias today.** Both alias writers exist and neither is
   reachable: answer-path enrichment requires a resolution kind the pipeline never supplies;
   reconcile-path enrichment (deps.js:278–304) reads `order_confirmation_line` — **0 rows ever**
   (LIVE). Every one of the ~100+ aliases doing the recognition work was Larry-curated. The Star's
   "answers persist and improve future shops" is currently satisfied by a human compensating loop,
   not by the product. (INFERRED, consistent: regulars 102–104 — Wall's, Milky Way, Mars, the
   high-id rows — appear to be post-shop-6 manual additions; per-row created_at is fetch F2.)
5. **106 item-keys of purchase frequency are invisible.** `previously_ordered` knows `sure male`
   ×3/qty 9, `arla semi milk` ×2/qty 7, etc. Nothing reads it; the resolver's previous-order match
   basis is dead code; at most ONE last completed order reaches the prompt — and whether even that
   fires live is unestablished (fetch F1).
6. **Rule 10 (the class-2 BOB rule) reaches no decision point** — see trace 1. More generally, 24
   of 40 rules are `info`, and the operationally load-bearing ones among them (34 reconcile, 35
   substitutions-off, 36 offer rule, 38 OOS-cause, 40 add strategy) bind to no executable stage —
   they are basket-summary prose.
7. **Usual quantities are unpopulated** — the one class the prompt/planner already plumb
   (`typical_qty`) is null on every sampled row, while real quantity history sits unread in
   `previously_ordered`.

## D. PRODUCT CONSEQUENCE

> **Does the current production recognition/planning path genuinely use the household knowledge
> Warwick has accumulated, or is important knowledge sitting unused in Supabase?**

**Split verdict. The STATIC knowledge is genuinely and well used: recognition today is authentically
grounded in the household's catalogue** — 103 regulars with curated aliases, brand/category, 16
directive rules and 11 term mappings all demonstrably reach Terra, the deterministic resolver and
the planner before any question is asked (2026-08-03 ran live against exactly this: 35 lines, 97
candidates). **The DYNAMIC knowledge — everything the system learns by operating — is almost
entirely lost or inert:** answers die with their shop, no production path can write an alias or
promote a rule, Terra's per-line evidence is discarded, purchase frequency is unread, and the one
class-2 rule the §5 ruling says must win (rule 10) is structurally incapable of winning anything.
The system consults what Larry curated; it does not yet learn from what Mum and Warwick do.

**Single most consequential loss: the answer-learning dead end (C2+C3 together).** Human answers —
the scarcest, highest-authority signal the system receives — are either never recorded
(shop 6's 11) or recorded in a form the planner is guaranteed to ignore and that can never touch an
alias or rule. This breaks the Star's clause "answers persist and improve future shops" at the
design level, not the wiring level: fixing it needs a human act that says "and going forward"
(which WP-B15-1's new confirmation surface is, incidentally, the natural place to carry). Invariant
D (C1) is the second loss and compounds it by inflating the number of questions asked.

**Answer to §8's "one genuinely learned alias/decision changing a future-shop outcome":** the chain
exists live for the July learnings — rule_qa_log #5 (2026-07-20 Q&A) was promoted into rules 27–33
and aliases (e.g. `sausage baps` → Rustlers, Wall's = 4-pack), which today reach both Terra and the
planner; shop 6 (2026-08-03) matched the Rustlers muffin and would have hit those aliases. **But I
must say plainly: those promotions were Larry-mediated, not production-written; no alias in the
live DB is attributable to the production learning loop (none has ever run, and `aka` carries no
provenance); and the extract does not include the raw_reading that matched Rustlers in shop 6, so I
cannot prove the learned alias did that work (fetch F4). No example of PRODUCTION-learned knowledge
changing a later shop exists in live data.**

### The six traces (§8) — Supabase → provenance → conflict winner → loader → Terra → recognition → planner → likely outcome TODAY

1. **Arla BOB / Cravendale.** Supabase: regular 4 Cravendale (aliases incl. `milk`, `4pt milk`,
   `arla semi` — class 3), regular 69 BOB ACTIVE, no aliases (class 1/4), rule 10 (class 2, info,
   no match_term), products #2 `Arla Semi milk`→Cravendale, previously_ordered history (class 4).
   Conflict winner today: **the alias data, not the rule** — rule 10 reaches neither the prompt
   (info excluded, loadCatalogue.js:79) nor any line (no match_term). Terra receives BOTH milks as
   candidates with no counter-instruction. Recognition: "milk"/"ARLA semi skim 4pts" → exact/approx
   alias → regular 4 (shop 6 line 1 proved this live). "BOB" written literally → no alias, name
   tokens too short for pass 4 → `unmatched_new_item` → human question. **Likely today: Cravendale,
   correctly — but by accident of alias curation; the class-2 rule itself is decorative. Fails safe,
   for the wrong reason.**
2. **Gourmet cat food.** Regular 1, aliases `gourmet cat food`/`gourmet` (class 3); history ×2
   (class 4). Recognition: exact alias, pass 1 → matched, no question. The founding "gourmet coffee"
   failure is closed by grounding. **Adds correctly.**
3. **Dreamies cheese.** Regular 12, aliases `dreamies cheese`/`dreamies`. "1 dreamies cheese large"
   → token-wise containment pass 3 → matched. **Adds correctly.**
4. **Weetabix Protein.** Regular 26, alias `weetabix protein`, asda_id present; ordered ×2 + ×1
   canonical (class 4, unread). Exact alias pass 1. **Adds correctly.**
5. **Wall's sausage rolls.** Regular 102 (aliases incl. `walls sausage rolls`, `sausage rolls`) +
   rule 29 map "1 pack = the 4-pack" (class 3, learned 2026-07-20, promoted from rule_qa_log #5 —
   the genuine learned-decision chain, Larry-mediated). Rule 29 reaches Terra AND the planner;
   the alias resolves deterministically. **Adds the 4-pack without asking.**
6. **Mars / Milky Way.** Regulars 103/104, disjoint alias sets (`milky way`, `pk milky way` vs
   `mars bars`, `small mars bars`). Exact alias, no cross-match. **Both add correctly.** (Likely
   post-shop-6 additions — the manual compensation loop at work; fetch F2.)

### WP-B15-1 acceptance — materially invalidated?

**No.** Nothing found contradicts the confirmation-card + source-binding scope or its Star
acceptance; the live data is consistent with my earlier park diagnosis (shop 6 `needs_review`,
zero confirm commands). **One watch item to hand Keel, not an invalidation:** the moment shop 6's
gate clears and replan runs on current bytes, `stepReplan` will attempt the FIRST-EVER live
`recordAnswerLearning` writes for the 11 answered questions — and that writer **throws by design
and parks the shop FAILED** on any error (runPipeline.js:530–536). The acceptance journey will
exercise a never-live-run writer; if the acceptance event stalls at FAILED after the tap, look
there first, and do not mistake it for a card/callback defect.

### Facts Larry must fetch (nothing above depends on them except as marked)

- **F1.** Do either of the 2 `orders` rows have `total_added is not null` for household 1 — i.e. is
  the prompt's/planner's `last_order` context populated today, and was it on 2026-08-03? Also the
  live definition of the `previously_ordered` view (it is live-only; repo has grants only).
- **F2.** `regulars` per-row `created_at` for ids ≥ 97 — confirms the 97→103 delta and whether
  102–104 were post-shop-6 manual additions.
- **F3.** Whole-column `typical_qty` non-null count (sample says 0/12).
- **F4.** Shop 6's `raw_reading` for the line matched to regular 23 (Rustlers) — did the learned
  `sausage baps` alias do the work?
- **F5.** Alias totals: count of aliases across active regulars; any alias string appearing on two
  regulars (`ariel pods` appears on regulars 22-pack and 33-pack in the sample — if both are
  active with the same alias, pass 1 yields `needs_confirmation`, which matches shop 6's live
  Ariel question and is correct behaviour, but worth counting).

### Limitations

Live facts rest on ONE extraction session (Larry, tonight, `asdair_ro`) — single-source by
construction and flagged as such; source facts were read directly by me at the stable checkout.
Samples (aka, shop 6 lines) are partial; whole-table claims from samples are labelled. I did not
verify the b15 worktree bytes (dispatch declared byte-identity for these paths). No mutation, no
schema/taxonomy proposals, no remediation programme — one next-slice-informing report, per §9.
