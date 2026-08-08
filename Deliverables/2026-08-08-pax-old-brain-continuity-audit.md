# Pax — Old Brain → Supabase Continuity Audit (BUILD-015)

**Pax, 2026-08-08. Commission: Warwick (verbatim, staged at
`uploads/…/d1f498bb-Pax_Old_Brain_to_Supabase_Continuity_Audit.md`). Governance head `0e5e680`,
`build-015/grounded-recognition`. Method: the four old-brain Drive documents fetched in full tonight
(`scratchpad/old-brain-asdair-corpus.md` — README, AGENT, complete Decisions Log, complete Order
History), the live-DB extract (`scratchpad/pax-db-extract.md`, 31 sections, read-only `asdair_ro`),
and production source re-read tonight by me at the stable main checkout
`C:\Fusion247PKA\services\asdair\**`. Keel's worktree untouched; no DB access of my own; nothing
mutated. Every load-bearing claim from my two prior briefs that this audit depends on was
RE-ESTABLISHED at source or in the extract tonight, not repeated; each is cited. Evidence labels:
OLD (corpus doc), LIVE (extract section), SOURCE (file:line read tonight). Single-source caveat:
OLD rests on one Drive fetch session and LIVE on one extraction session (both Larry, tonight) —
flagged as such; SOURCE facts I read directly.**

**The one question (Warwick):** *Did the new AsdAIr preserve and improve the household shopping
memory the old AsdAIr had, or did useful knowledge fall out during the move to Supabase?*

**Verdict in one line: the STOCK of knowledge was preserved and mostly improved; the FLOW of
knowledge — the old brain's core promise that an answered question is never asked again — did not
survive the move for anything answered after migration.**

---

## A. OLD BRAIN MEMORY CONTRACT

What the Drive brain was (OLD, all four docs, created 2026-07-06):

- **Memory model.** Claude-in-Chrome had no memory; the folder WAS the memory: the **Decisions
  Log** (standing rules + dated Q&A, "read this first, every run", read **in full** before the
  list is touched — AGENT rule 2), the **Order History** (append per run), the latest dated list,
  and the README/AGENT contracts.
- **The learning loop, explicitly contracted.** AGENT mission names "preventing … **repeat
  questions the system has already answered before**". AGENT rule 7: *"Any new question resolved
  mid-run gets appended to the Decisions Log at the end of the run, using its entry template, so it
  never has to be asked again."* The entry template itself carried the promotion act:
  `### YYYY-MM-DD / Question / Answer / **Applies going forward: (yes/no — standing rule for future
  weeks?)**` — i.e. the going-forward assertion was captured **as part of the answer, at answer
  time**. Every recorded entry says "Applies going forward: yes". Process rules (rule 9) needed
  Warwick's explicit approval before becoming standing — the human-promotion distinction already
  existed.
- **Knowledge held (OLD Doc 3):** 9 global operating rules (counts-not-packs, default-1, dedupe,
  Favourites/Regulars sourcing, nothing-off-list, no auto-substitution, £120–150 band,
  checkout-ready-never-place, open-both-pages-first) + product rules: Cravendale-never-BOB, toffees
  default = ASDA Dairy Toffee 180g, Nescafe = Azera on-offer-only, Sure male-blue/female-white,
  Heinz-not-own-brand ketchup 910g, Aquafresh cheapest, Picnic 4-pack, Yazoo-never-Banana, Frank's
  "x6" = ONE six-pint pack, Vanish pink-vs-white by "Whitener" wording, Richmond closest-Regulars
  match, custard-&-jelly = ASDA pot, loratadine. Plus one week's rich Order History (34 requested /
  32 added / £119.78→£129.58 final; allow-substitutes audit 9-of-36 ON, named; Warwick's 3 manual
  additions; two needs-decisions).
- **A class insight the old brain already had (OLD Doc 3, open item):** ASDA "Regulars" is
  auto-generated from order history with no manual remove — BOB was unfavourited but "may only
  disappear from Regulars once enough Cravendale orders replace it". The old brain explicitly knew
  **platform-list membership is stale ASDA evidence, not household intent** — the commission's
  class 1 vs class 2 distinction, articulated in the household's own log three weeks before this
  audit.

## B. CONTINUITY INTO SUPABASE

Per class: verdict + where it lives now + whether current production reads it. "Reads" columns are
SOURCE-verified tonight: Terra prompt = `interpret/loadCatalogue.js`+`groundedPrompt.js`;
deterministic recognition = `interpret/resolveByCatalogue.js`; planner =
`skill/data.js`→`skill/planner.js` via `pipeline/runPipeline.js:363–389`.

| Class | Verdict | Now lives | Production consumption |
|---|---|---|---|
| Standing rules (class 2) | **PRESERVED — content; PARTLY PRESERVED — enforcement** | `asdair.rules`, 40 rows (LIVE §RULES): every old rule present + 13 learned since | 16 directive rules (map/exclude/rotate/needs_decision) reach Terra AND planner lines (loadCatalogue.js:74–80). 24 `info` rules reach the planner only; those without `match_term` surface once in `summary.advisories`, attached to no line (planner.js:986–988, 1476). **Old contract read the whole log at every decision; new system routes filtered subsets — see rule 10 below** |
| Canonical names + catalogue | **PRESERVED AND IMPROVED** | `regulars` 103 rows, zero dup names, brand/category on all sampled (LIVE) | All active regulars reach all three consumers |
| Aliases | **PRESERVED AND IMPROVED — but 100% human-curated** | `regulars.aka`, rich (6 aliases on Cravendale) | The strongest recognition signal in all three consumers (resolveByCatalogue passes 1/2b/3). **No production path has ever written one** — see C |
| Regulars membership | **PRESERVED — with the class distinction FLATTENED** | 103 rows, `source='regular'` only | Read everywhere. But the old brain's own insight (membership = stale ASDA evidence) was not carried: **regular 69 "Arla BOB" is ACTIVE** (LIVE §TRACE milk) with no provenance field marking it platform-derived vs household-confirmed |
| Favourites | **SUPERSEDED** | Nowhere as a live concept (LIVE: `source_view:"favourites"` describes nothing) | The sourcing model changed (household-owned catalogue, not ASDA pages); old "save to Favourites" acts have a designed successor (`pending_action`, 0 rows, Cockpit-display reader only). Not a Star-relevant loss |
| Usual quantities | **UNESTABLISHED / effectively LOST in use** | `typical_qty` plumbed to prompt+planner, null on all 12 sampled rows (LIVE) | Plumbing reads it; data empty. Old brain equally list-driven — not a migration loss, an unfilled improvement |
| Resolved Q&A | **PARTLY PRESERVED (July corpus only)** | `rule_qa_log` 5 rows, all July, all `applies_going_forward=true`, all Larry-mediated (LIVE §RULE_QA_LOG); shop 6's 11 answers only in `shop_question` | Planner consults `priorAnswers` before deciding (runPipeline.js:381–387; planner.js:1687–1715) but only rows with `applies_going_forward===true` (planner.js:1091, pinned by ruleConsumption.test.js:582) and only as flags/notes, never identity. `shop_question` is consulted **within its own shop only** (question-key dedupe on replan, runPipeline.js:357–361) — never cross-shop |
| Promoted / going-forward decisions | **LOST at the capture point** | `promoteDecision.js` fully built with provenance guard; **no production caller supplies `true`** | Pipeline hard-codes `applies_going_forward:false`, `resolution:{kind:'none'}` (runPipeline.js:581–584, SOURCE re-read tonight) — see C |
| Prior-shop learning | **LOST for production; Larry-compensated** | Rules 27–33 + aliases from the 2026-07-20 Q&A batch — the one genuine learned-decision chain, Larry-promoted | Those promoted rows DO reach Terra+planner today. Zero rows in any table are attributable to the production learning path (never executed) |
| Order / purchase history | **PARTLY PRESERVED** | `orders` 2, `shopping_list_items` 132, `previously_ordered` view 106 item-keys (LIVE) | Last COMPLETED order only (`total_added is not null`, loadCatalogue.js:86–95) conditionally reaches prompt+planner — whether either live order qualifies is fetch F1. **`previously_ordered` is read by NOTHING** (repo-wide grep tonight: only `db/012_complete_grant_matrix.sql` and build docs name it). Old Order History's allow-substitutes audit (9/36 ON, named): `regulars.substitutes_allowed` column exists and is loaded — population UNESTABLISHED (fetch F6) |
| Recognition-candidate evidence | **N/A old → absent new** | Not persisted (invariant D) | `realInterpretPhoto` strips Terra's reply to `{line_no, raw_reading, quantity}` (deps.js:178–182, SOURCE re-read); every sampled shop-6 line has `match_confidence:null` (LIVE). Not a migration loss — a new-system gap that inflates question load |

**Named-rule continuity checks (the corpus cases outside my six traces):**

- **Yazoo-never-Banana — PRESERVED AND IMPROVED.** Old addendum entry → rules 17+26 (`exclude`,
  match_terms), reach Terra and planner; Banana Yazoo remains an aliased active regular so it can
  be recognised in order to be excluded. The strongest continuity chain in the estate. Caveat from
  the build's own ledger: a `previously_ordered` row for Yazoo Banana is dated **after** the
  hard-exclude (DEFECT-LEDGER D-2026-07-28-29) — historical-observation data contradicting intent,
  harmless only because nothing reads that view.
- **Nescafe-Azera-on-offer-only — PRESERVED in content; failed live once.** Rules 12+25
  (`needs_decision`). Shop 6's "bottle Azera coffee" missed both match_terms and Warwick re-answered
  a 2026-07-06 decision (LIVE q3a181e60; the planner's own comment records it, planner.js:1646–50).
  Late-rule pass since added at source — not live-proven.
- **Toffees default — PRESERVED** via `products` #1 (planner matchProduct precedence); rule 11
  itself is summary-only prose.
- **Vanish pink/white — PRESERVED** via products #9/#10 + aliases; shop 6's Vanish question was a
  genuine ambiguity (no qualifier written), not a repeat.
- **Frank's six-pint semantics — PARTLY PRESERVED.** Recognition safe (aliases incl. `franks 6
  pint`, products #3); the ONE-pack-not-six QUANTITY rule (18) is `info`/no-match_term → basket
  summary only. Old brain read it before touching the list; new system cannot put it on the line.
- **Sure blue/white — PRESERVED AND IMPROVED** (rules 13/23/24 + learned 32 rotate, 37 pairs).
- **Heinz-not-own-brand — PRESERVED** (rule 14 `map` + products #5).

**The six required traces** (old brain → Supabase → production reads → Terra → deterministic
recognition → planner-before-asking → future-learning-can-update). Re-established tonight; full
per-trace detail stands in my earlier audit (§D traces 1–6) and nothing found tonight moves any of
them:

| Trace | Chain today | Future-learning-can-update? |
|---|---|---|
| Arla BOB → Cravendale | Regular 4 aliases (`milk`, `4pt milk`…) win; BOB active, unaliased → unmatched → question. Rule 10 is `info`/no-match_term: excluded from prompt (loadCatalogue.js:79), attaches to no line — **basket-summary prose only**. Correct outcome, wrong mechanism: alias curation (class 3) is doing the work the class-2 rule should do | **NO** (see C) |
| Gourmet cat food | Regular 1, exact alias, pass 1. Founding failure closed | NO |
| Dreamies cheese | Regular 12, containment pass 3 | NO |
| Weetabix Protein | Regular 26, exact alias | NO |
| Wall's sausage rolls | Regular 102 aliases + rule 29 `map` (the one genuine learned chain — Larry-promoted from rule_qa_log #5) reaches Terra AND planner; adds the 4-pack without asking | NO |
| Mars / Milky Way | Regulars 103/104, disjoint alias sets, both exact | NO |

The "future-learning-can-update" column is NO for every trace, for one shared structural reason —
section C.

## C. LEARNING LOOP — what happens today to a real human answer

Old contract: answer → dated log entry **with the going-forward decision captured in the same
act** → read in full next run → never asked again. Demonstrated working across the 2026-07-06
sessions (OLD Docs 3–4).

New system, traced step by step (all SOURCE tonight):

1. Answer arrives (card tap / typed reply) → durable `shop_question` row. **Persists.** ✓
2. Same shop: question-key dedupe + replan honour it (runPipeline.js:357–361). **Within-shop
   memory works.** ✓
3. `stepReplan` → `claimAnswerLearning` (one shot ever) → `recordAnswerLearning` writes a
   `rule_qa_log` row — with **`applies_going_forward:false` and `resolution:{kind:'none'}`
   hard-coded** (runPipeline.js:581–584), deliberately: no production surface carries a human
   "and going forward" act, and `promoteDecision`'s provenance guard rightly refuses to infer one.
4. Consequently `buildAnswerLearning` emits **no alias operation and no rule promotion**
   (buildAnswerLearning.js:352–358 — a rule payload with `false` is refused).
5. Shop N+1: `loadRuleQaLog` loads the row; the planner's eligibility filter **discards it**
   (`applies_going_forward !== true`, planner.js:1091; test-pinned at ruleConsumption.test.js:582).
   The row is audit-only. The pipeline's own comment ("the loop closes through the decision log",
   runPipeline.js:522–528) is **structurally false** for every row the pipeline itself writes.
6. The only other alias writer, `realRecordLearning`, reads `order_confirmation_line` —
   **0 rows have ever existed** (LIVE §ORDERS) — unreachable.

> **Can a human answer in shop N reliably alter behaviour in shop N+1 without Larry, manual DB
> editing, or rewriting seed data? NO.**
>
> **Earliest structural reason: the production answer surface captures no "applies going forward"
> human act — the very field the old brain's entry template carried on every answer. Everything
> downstream (the hard-coded `false`, the refused promotion, the planner's filter) is correct
> behaviour given that missing act.** The loop dies at capture, not at write or read.

**The required repeat-question demonstration — stated plainly.** The old resolved Q&A "Ariel Pods
= best value per wash" (Decisions Log 2026-07-20 → rule_qa_log #5, `true`; rule 31 targeted
`ariel pods`) **should** prevent, or at least inform, a repeat question. Live shop 6 (2026-08-03)
**re-asked it bare** — q549c765f "Which product is 'Ariel Pods'?" — and Warwick re-answered
"whichever is better value" while his recorded answer sat in the database (LIVE §SHOP_QUESTION;
the planner comment at planner.js:1064–71 records the same incident). The priorAnswers wiring
added since (WO-Y) would now attach that recorded answer to the line as a note — **but only for
the five July Larry-mediated rows, and no shop has run on current bytes, so the current system
CANNOT yet demonstrate a single prevented or informed repeat question. The one live shop on
record demonstrates the failure.** And every answer recorded by production from now on is
guaranteed ineligible (step 5), so for post-migration answers the old brain's promise is not
merely unproven — it is structurally unmeetable today. Same pattern for Azera (decided 2026-07-06,
re-asked 2026-08-03).

## D. MATERIAL LOSSES (Star-relevant only)

The Star's phrase under test: *"uses the full accumulated household knowledge, asks only genuine
unknowns, learns confirmed answers for future shops."*

1. **The going-forward act — the promotion path from answer to standing knowledge.** Present in
   the old brain's entry template on every answer; absent from the new command surface. Direct
   break of "learns confirmed answers for future shops". (High confidence: OLD + SOURCE + LIVE
   agree.)
2. **Cross-shop repeat-question prevention for anything answered after migration.** Shop 6's 11
   real answers — including two vision-misread corrections (Stardrops, Sudocrem) — exist only as
   per-shop rows no future shop consults. Direct break of "asks only genuine unknowns".
3. **Production alias learning.** Both writers unreachable; every one of the ~100+ aliases doing
   the recognition work is Larry-curated. The Star's no-Larry clause is currently satisfied by a
   Larry compensation loop.
4. **The class-1/class-2 distinction the old brain explicitly held.** BOB proving case: the old
   log knew Regulars membership was stale ASDA evidence and that intent (Cravendale) outranks it.
   Migration imported the membership (BOB active, regular 69) but not the distinction (no
   provenance field), and the intent rule (10) is structurally unenforced (`info`, no match_term —
   prompt-excluded, line-unreachable). Never-BOB currently holds only through class-3 alias
   curation. Explicit household intent should be the strongest signal in the system; today it is
   the weakest-routed.
5. **Purchase-frequency knowledge unread.** 106 item-keys in `previously_ordered` (`sure male` ×3
   qty 9, `arla semi milk` ×2 qty 7…) consumed by nothing; resolver's `BASIS.PREVIOUS_ORDER` is
   dead code; at most ONE last completed order reaches the prompt, and whether it fires live is
   unestablished (F1). The old agent effectively consulted order-derived data every run via the
   Regulars page.

Not material: Favourites-as-page (superseded by a better model), typical_qty emptiness (unfilled
improvement, not loss), the allow-substitutes 9/36 audit (UNESTABLISHED, fetch F6, likely
superseded by rule 35's substitutions-always-off posture — worth one confirming fetch, not a loss
claim).

## E. NEXT-SLICE CONSEQUENCE — one recommendation

> **After WP-B15-1, the strongest next product slice is durable human learning / household-intent
> promotion — not invariant-D candidate-evidence retention.**

Reasoning, briefly: invariant D improves the QUALITY of this week's questions (retained Terra
evidence, ranked alternatives, fewer redundant asks) — but even perfectly-retained evidence flows
into the same dead end, because the answers it elicits still cannot become knowledge. Every class
in section B whose verdict is LOST or PARTLY PRESERVED shares the single root in section C, and
losses D1–D4 are all repaired by the same slice: carry an explicit "applies going forward" act on
the confirmation/answer surface WP-B15-1 is already building (the natural carrier), let
`promoteDecision`/`buildAnswerLearning` do what they were built and tested for, and route promoted
intent so it can actually outrank platform evidence (the BOB test: rule 10 must be able to win).
That one slice restores the old brain's defining capability — the promise its AGENT contract was
named for — and simultaneously unblocks production alias writing. Invariant D then rides behind
it as question-quality improvement, consuming a loop that finally goes somewhere. (Recommendation
only; no WP drafted, per commission.)

## WP-B15-1 acceptance relevance

**Nothing found tonight materially invalidates WP-B15-1's card/confirmation acceptance.** The one
standing watch item from my earlier audit is re-confirmed at source and carried, not new: when
shop 6's gate clears and replan runs, `stepReplan` will attempt the **first-ever live**
`recordAnswerLearning` writes (11 answers); that writer throws by design and parks the shop FAILED
on any error (runPipeline.js:530–536). If acceptance stalls at FAILED after the confirm tap, look
there first — it is not a card/callback defect. Additionally, section E is a scope OPPORTUNITY for
the surface Keel is building (the going-forward act belongs on exactly that card), but adding it
now would widen an approved WP — Warwick's call at the §12 handback, not mine.

## Facts Larry must fetch (nothing above depends on them except as marked)

- **F1 (carried).** Do either of the 2 `orders` rows have `total_added is not null` for
  household 1 — is the prompt/planner `last_order` context populated live?
- **F2 (carried).** `regulars.created_at` for ids ≥ 97 — confirms the post-shop-6 manual-addition
  reading of Wall's/Milky Way/Mars.
- **F6 (new).** `regulars.substitutes_allowed` population vs the old Order History's 9-of-36
  named allow-substitutes audit — the one old-brain knowledge item whose survival I could not
  establish in either direction.
- **Regulars spreadsheet:** NOT requested — row-level comparison never became material (103 live
  regulars, zero duplicate names; the spreadsheet could only refine class-1 provenance, which the
  BOB case already proves).

## Limitations

OLD corpus and LIVE extract each rest on one staging session by one agent (Larry, tonight) —
single-source by construction, flagged throughout; SOURCE claims I verified directly at the stable
main checkout (not Keel's worktree; his unmerged implementation is not assessed here and may
change section C's facts when it lands). No live run on current bytes exists, so every "at source"
mechanism (priorAnswers attachment, late Azera pass, answer-learning writer) is capability
evidence, not demonstrated behaviour. Read-only throughout; no rows mutated, no migrations, no
aliases or rules edited, no WP or map created.
