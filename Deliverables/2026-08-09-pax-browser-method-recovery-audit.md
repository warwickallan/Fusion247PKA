# AsdAIr — proven browser-shopping method: recovery audit

**Pax, 2026-08-09.** Commissioned by Warwick. Read-only evidence recovery.
**Governance head:** `959a64b`. **Scope:** what the proven fast browser method was, what survived,
what displaced it, what the future basket worker should inherit. **Not in scope:** repairing the
browser route, drafting a Work Package, any live action.

**Method note:** primary Drive sources (Method Statement, AGENT doc, START HERE README, Order
History, Decisions Log) and git history were fetched and read by Larry because I have no Bash and no
MCP. The repository at `C:\Fusion247PKA` and the in-flight worktree at `C:\Fusion247PKA-b15` I read
myself. Confidence is marked per claim. Single-source claims are flagged as such.

*Revised 2026-08-09 after Larry closed two named evidence gaps (git-tracked status; Decisions Log
content). Changes are confined to the MATERIAL INVALIDATION strength, section B, section E's
constraint note, open question 4, and Limitations. No other finding moved.*

---

## ⚠️ MATERIAL INVALIDATION

**A canonical BUILD-015 document states, as its reason for cancelling work, a fact about the
repository that the repository contradicts — and the contradicting evidence sits in the same build
folder and predates the ruling by eight days.**

`Builds/BUILD-015-.../RUNTIME-DECISION.md:145-149` (open consideration 3):

> *"`EXPERIMENT-RESULT.md` records that a bulk control exists; it does not record it being used
> successfully at scale… the repository does not independently corroborate it."*

and `RUNTIME-DECISION.md:68-70` / `DURABILITY-CLOSEOUT-WORK-ORDERS.md:97-108`, cancelling WO-D:

> *"…on the strength of a description that may never have described a real mechanism."*
> *"Cancelled, not deferred — there is nothing here to build."*

**Two independent, git-tracked repository artefacts, both dated 2026-07-27, do corroborate it:**

1. `Team Knowledge/session-logs/2026/07/2026-07-27-19-03_larry_asdair-weekly-shop-browser-automated.md:29`
   — *"parsed the full 90-item accessibility tree to map 25 target checkboxes by ref, **bulk-ticked
   all 25 and 'Add selected to trolley' in one go** (£100 landed)"*; restated at `:44` and `:70`.
2. `Builds/BUILD-015-.../DEFECT-LEDGER.md:356-362`, **D-2026-07-27-09**, headed *"the bulk tick-pass
   silently skipped an item that was not a Regular"*, **Found: 2026-07-27, live, during the real
   shop**, describing *"the 25-item bulk tick"* as an event that happened.

**Both are tracked**, confirmed by `git ls-files --error-unmatch` on 2026-08-09; the session log was
first added in commit `db29c09`. **Both were committed before the 2026-08-04 ruling, and this
finding rests on neither one alone.** Confidence: **High**.

**What is invalidated:** the *evidential premise* of open consideration 3, and the *stated rationale*
for cancelling WO-D. A bulk selection pass over the Regulars grid is not an unevidenced description
— it was executed once, at 25 items, in a real shop, and is recorded twice in Git.

**What is NOT invalidated:** Warwick's authority to rule the live route; the deferral of the CDP
runner; the Brand A–Z ordering instruction. He may still prefer ordered traversal. But the decision
now rests on preference, not on absence of evidence, and the record should say so.

**One honest complication, because it cuts the other way** (§A.4): an earlier run records a bulk add
of 14 items *failing twice*. Bulk add is **conditionally** reliable, not guaranteed. Both facts
survive; neither cancels the other.

---

## A. THE PROVEN SUCCESSFUL METHOD

### A.1 There were three successful browser runs, not one

The commission asked me to resolve whether the Method Statement and the Order History describe the
same run. **They do not.** Confidence: **High.**

| Run | Date | Agent | Outcome | Source |
|---|---|---|---|---|
| **RUN-1** | week of 2026-07-06 | Claude in Chrome | 34 requested / 32 added → final **36 products, £129.58** | Order History (**single-source**) |
| **RUN-2** | documented 2026-07-20/21 | Claude in Chrome | 30-line list → **29 products / 48 items / £104.44** | Method Statement, 20 steps (**single-source**) |
| **RUN-3** | 2026-07-27 | **Larry** (Claude Code) + host-bound browser MCP | **32 products / 48 items / £111.75** | session log **+** DEFECT-LEDGER D-2026-07-27-09 (**two independent artefacts**) |
| RUN-4 | 2026-08-03 | CDP `browser-runner` | 35 products / £136.94, **~8 hours**, 3 hand-assembled plan files | RUNTIME-DECISION.md:19-28; SOP-021a; DEFECT-LEDGER D-12 |

**Why RUN-1 ≠ RUN-2:** different list sizes (34 vs 30); different finals (36/£129.58 vs
29/£104.44); the flagged-item sets are effectively disjoint (RUN-1: Richmond sausages, Nescafe
Azera, Aquafresh, Loratadine, Picnic; RUN-2: Lucozade Sport, Rustlers, Wall's, So…? Honey Oud, Just
Essentials Lollies, Ariel Pods, Double Gloucester); the Method Statement sheet was created
2026-07-20T23:41Z, fourteen days after the 07-06 entry; and Method Statement step 2 opens on a
trolley **already holding 10 products / 19 items**, consistent with a later week starting on the
residue of a basket the Order History confirms was never checked out.

**Consequence for §B:** AGENT doc operating rule 8 requires an Order History entry for *every* run.
**Only one exists.** At least RUN-2 and RUN-3 were never recorded. That is a durability failure in
the one artefact designed to survive a memoryless browser session.

### A.2 What the strongest run actually did — RUN-2, step by step

The Method Statement is the only contemporaneous tool-level record of a full successful run. It
names the tools per step, which is what makes it decisive.

**Tools actually invoked** (Method Statement, "Tool(s) Used" column, verbatim): `navigate` ·
`get_page_text` · `find` · `read_page` · `form_input` · `computer (click)` · `computer (screenshot)`
· `javascript_tool`. **No CDP anywhere.** These are Claude-in-Chrome / computer-use tool names,
corroborated independently by the AGENT doc (*"via Claude in Chrome"*, operating rule 2) and the
START HERE README (*"run through Claude in Chrome"*). Confidence: **High**.

The shape, with step numbers:

- **Step 2 — audit the trolley before touching anything.** `navigate`, `get_page_text`. Found 10
  products / 19 items already correct; changed none.
- **Step 3 — Regulars & Favourites first.** Located **15** of the list's items on that one page.
  `find` used to locate *each product's quantity input and selection checkbox*; quantities set with
  `form_input`. This is the structured-page sourcing pattern, stated in the primary source.
- **Step 4 — bulk add attempted and FAILED.** `computer (click)` on *"Add selected to trolley"* with
  14 items checked. *"Bulk add errored twice with 'Sorry… Something went wrong.'"*
- **Step 5 — the human course-correction.** Warwick stopped the agent browsing a category/shelf page
  hunting a size variant and instructed it back to Regulars, **alphabetically by brand**. *(This is
  the earliest evidence I found for brand ordering — as an instruction, not a measured speed-up.)*
- **Step 6 — pairs instead.** Re-added the 14 in pairs, `read_page` to **refresh refs after each
  round**, checking the trolley total/count **after every pair**. All succeeded except one item.
- **Step 7 — the failure was OUT OF STOCK.** The stubborn item failed *even alone*; its dedicated
  product page showed *"Unavailable / See alternatives"*. Left out; three priced alternatives
  offered. **This is the primary-source origin of SOP-021's "one OOS item rejects the whole batch"
  lesson, and it reconciles step 4 with RUN-3's success.**
- **Step 8 — search bar as fallback**, for the 5 items not in Regulars. Researched only; added
  nothing, because of genuine ambiguity.
- **Step 9 — ONE consolidated question batch.** Trolley state + 1 OOS decision + 7 open questions in
  a single message, then paused.
- **Steps 11-13 — search-and-add after answers**, screenshotting the trolley counter after each add
  before moving on; a value comparison (£/kg across three Ariel pack sizes) that changed a decision.
- **Step 16 — final reconcile from the trolley DOM.** `read_page` (interactive filter, full main
  region), reading **every line's actual quantity textbox value, explicitly "not just displayed
  price, which is affected by multibuy deals."** Found 2 discrepancies in 29 lines.
- **Steps 17-18 — the stepper lesson, first-hand.** `form_input` into the quantity field **did not
  persist** across reload. Re-done with `+`/`−` steppers: **persisted.**
- **Step 19 — basket left untouched for the user's own review and checkout.** Checkout was correctly
  never attempted, in every run.

### A.3 What RUN-3 adds (and it is the fastest-evidenced run)

Larry, driving Chrome through a host-bound browser MCP toolset (`scroll_to`, `read_page`
accessibility tree, `find`): Regulars tab, sorted **A–Z** (not Brand A–Z), scroll-to-load the whole
grid, **read the 90-item accessibility tree once**, map 25 target checkboxes by ref, **one bulk
tick + one "Add selected to trolley"** — £100 in a single operation. Then `find`-driven search-adds
for the 7 non-Regulars, then the mandatory line-by-line reconcile, which caught two wrong quantities
and one **silently missed item** (a list item that is not in Regulars has no checkbox and produces
no signal — D-2026-07-27-09).

**The exact MCP binding is UNESTABLISHED** — the session log says only *"under MCP automation"*.

### A.4 Answering the commission's specific asks

- **Elapsed time: "about 15 minutes" is NOT supported by any evidence I found.** No run records a
  duration. The Method Statement has no timestamps and its run demonstrably spanned a pause for
  seven answers. Warwick's *"~5 minutes"* benchmark appears in four repository documents
  (RUNTIME-DECISION.md:23, DEFECT-LEDGER D-17, DURABILITY-CLOSEOUT WO-D, SOP-021a §3) — **all four
  trace to the same single origin, Warwick's own recollection. Repetition across documents is not
  corroboration.** The only documented elapsed figure in the whole record is RUN-4's ~8 hours.
- **Batched operations: PROVEN** (RUN-3, 25 items one click; RUN-2, pairs after a batch failure).
- **Regulars/Favourites first: PROVEN** in all three runs. **Category/shelf pages: explicitly
  stopped** by Warwick mid-run (Method Statement step 5).
- **Unavailable items: PROVEN** — diagnosed on the dedicated product page, left out, alternatives
  offered, never auto-substituted.
- **Trolley checked during execution: PROVEN** — after every pair (step 6) and after every
  individual add (step 11).
- **Final reconciliation from the trolley DOM: PROVEN** (step 16), and it caught real errors in two
  separate runs.
- **Checkout left to Warwick: PROVEN**, every run, no exception.

---

## B. THE DURABILITY CHECK

Classification of each operating instruction against `SOP-021`, `SOP-021a`,
`services/asdair/handoff/instructions.js` (the pinned `BROWSER_METHOD` / `PROHIBITED_ACTIONS`) and
the packet contract.

| Operating instruction | Class | Where |
|---|---|---|
| Never checkout / pay / book a slot / enter a password | **DURABLY RECORDED** | `instructions.js:59-65`, pinned against a literal in its test |
| Never auto-substitute | **DURABLY RECORDED** | same; and `LINE_REPORT_STATUSES` (`:131`) deliberately has **no `substituted` member** |
| Start from Regulars / Favourites | **DURABLY RECORDED** | `BROWSER_METHOD:40,43`; SOP-021 §4.1 |
| Read the actual quantity field, never infer from price | **DURABLY RECORDED** | SOP-021 §5; primary evidence is Method Statement step 16 |
| Fix quantities with the **stepper**, never by typing | **DURABLY RECORDED** | SOP-021 §5; primary evidence is Method Statement steps 17-18 |
| Line-by-line trolley reconcile against the list | **DURABLY RECORDED** | SOP-021 §5; `RECONCILIATION_CONTRACT` (`instructions.js:87-93`) |
| A failed batch add means **out of stock**, not batch size | **DURABLY RECORDED** | SOP-021 §4 blockquote; SOP-021a §8.1; primary evidence Method Statement steps 4→6→7 |
| Batch every question into **one** ask | **DURABLY RECORDED** | SOP-021 §3 "Ask once"; primary evidence Method Statement step 9 |
| Heavy grid needs element-targeted scroll; screenshots blank on it | **DURABLY RECORDED** | SOP-021 §4 (surviving facts); session log `:44` |
| **Brand A–Z** ordering | **DURABLE INSTRUCTION ONLY (class B)** | `BROWSER_METHOD:41`; packet sort contract. **No proven run evidences Brand A–Z as the executed sort** — RUN-3 used plain A–Z; RUN-2 records it only as Warwick's mid-run instruction. It is a ruled refinement, not a measured one |
| **Refresh page references after every mutation** | **PARTLY RECORDED** | Method Statement step 6 and session-log insights carry it; **it is absent from `BROWSER_METHOD`** |
| **Verify each add from the trolley before moving on** | **PARTLY RECORDED** | Proven in RUN-2 steps 6/11; the current `COMPLETION_CONTRACT` asks for per-line status **at the end**, not per-add confirmation during |
| **Search fallback for a known item absent from its view** | **SUPERSEDED — and it was proven** | See §B.2 |
| **Bulk selection + "Add selected to trolley"** | **LOST — actively cancelled** | WO-D cancelled 2026-08-04 on the premise refuted at the top of this brief |
| **An Order History entry per run** | **LOST IN PRACTICE** | AGENT doc rule 8 requires it; 1 entry exists for ≥3 runs |
| **A Decisions Log entry per resolved question, marked for reuse** | **SUPERSEDED IN EFFECT** | See §B.1 |

### B.1 The Decisions Log — and the one durability regression it exposes

**The Decisions Log contains no browser-operation or tool-level instruction of any kind.** It is a
product-decision memory, not a method document. **That is itself a §B finding:** the browser method
was never durably recorded in the Drive brain at all. It lived in the Method Statement — a
retrospective sheet written *after* a run — and in the running chat prompt the AGENT doc admits is
*"currently held in chat with Warwick; to be promoted to a formal SOP doc once stable."* SOP-021
(2026-07-27) is the first durable home the method ever had, which is exactly what its own header
says it exists to fix.

What the Decisions Log *does* establish is the intended learning contract, and its schema is the
load-bearing detail. Its entry template carries the field **"Applies going forward: (yes/no — should
this be treated as a standing rule for future weeks?)"**. Its protocol is read-in-full at the start
of every run, append at the end. Its rule is *"do not delete old entries… add a new dated entry that
supersedes."* All three dated entries (2026-07-06) are marked **applies going forward: yes**.

**The regression, stated with both citations and verified in source:**

- **The original Drive schema had this field and used it. Every entry was `yes`.**
- **The wired production pipeline hard-codes it to `false`.**
  `services/asdair/pipeline/runPipeline.js:581` — `applies_going_forward: false`, a bare literal
  inside `stepReplan`'s call to `recordAnswerLearning`.
- **`false` means never promoted.** `promoteDecision.test.js:96` — *"applies_going_forward false: the
  answer is logged and NOTHING is promoted"*; `services/asdair/skill/README.md:170` — *"Only
  `applies_going_forward` rows count."*

**Effect: every answer the live pipeline records is permanently ineligible to become a standing
rule.** The audit trail grows; the rulebook does not. That is the same open-loop defect the Drive
Decisions Log was built to close, reintroduced in code.

**Confidence: High on the mechanism** (production literal, plus two independent consumers confirming
what `false` does). **CAUSE UNESTABLISHED** on why: the adjacent fields at `:578-584` each carry an
explanatory comment and this one does not. It may be a deliberate conservative default awaiting a
promotion decision surface, or an oversight. I did not find a document that says which, and I am not
inferring one.

**Scope caveat, so this is not over-read:** a separate literal `false` exists on the *grounding
record* in `stepInterpret` and is explicitly justified in the Veritas receipt
`Assurance/veritas-wp-red-suite-recovery-0f8a1bc.md:58`. **That is a different call site and is not
what this finding is about.** The finding is `runPipeline.js:581`, on the answer-learning path.

### B.2 Search fallback — the durable instruction and the proven practice disagree

Both sides are now sourced, and I am resolving neither.

- **The durable instruction forbids it.** `BROWSER_METHOD:44`: *"NEVER free-search a known item. If a
  known item cannot be found in its named view, stop that line and report it as not_found — do not
  search for it."* Upstream: AGENT doc operating rule 4, *"Sourcing is Favourites/Regulars only"*,
  repeated verbatim in the START HERE README's current operating rule.
- **The proven practice used it, successfully, twice.** RUN-1: a hayfever product *"showed out of
  stock via Favourites but was found in stock via general search (same product) and added"* (Order
  History). RUN-3: a sausage-roll line absent from Regulars was recovered by `find`-driven search
  after the reconcile caught its absence (session log `:29`, `:46`; D-2026-07-27-09).

As written, the current contract would have reported both as `not_found` and delivered a short
basket. **This is a genuine `product-decision` for Warwick, not a defect for me to resolve.**

### B.3 Could a fresh worker reconstruct the proven method?

**PARTLY.** It would inherit a safe, ordered, Regulars-first method with correct prohibitions and the
two expensive quantity lessons. It would **not** inherit: bulk selection (cancelled), search-fallback
for a known item (forbidden), per-add verification, or reference-refresh discipline — and it would
inherit a Brand A–Z instruction whose provenance is a ruling rather than a proven run. It would also
inherit a learning loop that cannot promote anything (§B.1).

---

## C. THE REGRESSION

### C.1 What replaced what, and when

**2026-07-28, commit `443cad4`** adds the entire `services/asdair/browser-runner/` (25 files, git
bundle §5) — a Node/CDP runner. Its own `EXPERIMENT-RESULT.md` frames the question it was answering:
*"can AsdAIr drive an authenticated ASDA session WITHOUT Larry's Claude Code session?"* That question
was legitimate and was answered YES.

**What was never asked is whether the new mechanism reproduced the proven one. It did not.**
`SOP-021a` §8.1 strand 1: a grep of the runner for `checkbox|bulk|sort|Add selected|select all`
*"returns nothing but `Array.prototype.sort()` calls."* No grid, no checkboxes, no bulk add, no
sorting.

**2026-08-03, RUN-4** executes a live shop through it: ~8 hours, three hand-assembled plan files
(D-2026-08-03-12), against a proven method that had built comparable baskets three times.

### C.2 Was a DOM-aware method replaced by item-by-item navigation? YES — proven from source

`browser.cjs` navigates to a **dedicated product page per item**: `goto(URLS.product(ref))` at lines
264, 339, 352, 384, 392, each with a **6-second settle** (`:164`, `:219`) and a **5-second** post-click
sleep (`:318`), plus 1.5 s inter-step in `runner.js`. Measured from the code (SOP-021a §3.3):
**~13 s/item happy path, ~25-30 s when `locate_product` falls back to reference-search** — the
fallback costs a second and third full navigation. `set_quantity` clicks one stepper at a time with
**3 s between clicks**, capped at 40.

The proven method touched **one page** for 15 items. The runner touches **one page per item**.
That is the regression, and it is arithmetic, not opinion.

### C.3 Tab-heavy? A SPLIT VERDICT — do not collapse these

- **`runner.js` / `browser.cjs` is NOT tab-heavy.** `cdp.js:96-108` `reuseTab()` carries the comment
  *"ONE tab is reused for the whole shop."* Verified.
- **`actions.cjs` IS tab-leaking, provably.** `withPage()` (`:7-15`) calls `newTab(url)` on **every**
  invocation, waits 12 s, and closes only the **websocket** (`c.close()`, `:25`) — never the tab.
  `addByProductRef` therefore leaves one open product tab per product. **`closeTab` is defined and
  exported (`cdp.js:33,110`) and has ZERO callers anywhere in `services/asdair/`** (enumerated).
  `browser-runner/README.md:239` classifies `actions.cjs`/`readTrolley.cjs` as *"the original
  experiment primitives, kept as run-anywhere probes"* — i.e. a hand-driven surface.

**So a tab-per-product mechanism demonstrably exists in the repository, in the hand-driven probe
surface rather than the runner.** Whether that is what Warwick observed on 2026-08-03 is
**UNESTABLISHED** — no session log or evidence file records which script was invoked that night.

### C.4 Was Claude-in-Chrome replaced by Larry-driven Chrome? Yes — and that was NOT the regression

This is the finding most likely to be got backwards. **RUN-3, the fastest and best-evidenced run,
was Larry driving Chrome.** Larry-at-the-browser produced the single bulk add of 25 items. The
regression is the **CDP runner**, which displaced *both* browser-driven modes. Treating
"Larry drove Chrome" as the fault would discard the best evidence in the record.

### C.5 Why — what is proven, and what is not

**Proven proximate cause** (RUNTIME-DECISION.md:36-42, DEFECT-LEDGER D-2026-08-03-17): SOP-021 §4's
method was written in Claude-in-Chrome tool names (`scroll_to`, `read_page`, `find`) and was
**misread as a specification for the runner being built** rather than as a description of the real
process. *"The build had been extending a slower, unproven mechanism while the proven one sat
documented in the SOP, misread."*

**Authorised evolution or drift?** The runner's *construction* was authorised in its own framing
(independence from Larry). The *displacement of the proven method* was **drift** — no document
records a decision to stop using it, and RUNTIME-DECISION.md calls it *"the error this ruling
corrects"*, which is an admission, not a record of a choice.

**Beyond the misreading, CAUSE UNESTABLISHED.** Nothing in the record explains why the working
method was not simply repeated while the runner was built alongside it.

**A second, later regression event, and it is the one that still bites:** the 2026-08-04 ruling
cancelled WO-D on the premise that the repository held no corroborating evidence. It did (top of
this brief). A recoverable, once-executed capability was converted into a closed decision on a
false factual premise.

---

## D. CURRENT STATE

**Journey:** confirmed plan → **packet** (`services/asdair/packet/buildExecutionPacket.js`, Brand
A–Z, schema-validated) → **handoff artefact** (`services/asdair/handoff/`, JSON + phone checklist,
single-writer claim, completion ingestion) → **Sonnet in Claude for Chrome** → trolley →
`verifyBasket` → `basket_ready`.

**Browser-worker link state: `OPEN`.** Not my inference — the active Wayfinder
(`Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md:615-616`) classifies both the packet
chain (row 3) and the basket writer (row 4) as **OPEN**, on enumerated evidence:

- **`handoff/` has zero non-test importers anywhere in `services/asdair/`**; `pipeline/runtime.js`
  names `buildHandoff()` **only in a comment**. *"A tested module with no caller is not delivered."*
- **No basket has ever been built by the ruled route.** The CDP runner is experimental and
  prohibited from further live-account testing.
- **No programmatic Sonnet trigger exists, deliberately** (`handoff/README.md:14-29`): Claude for
  Chrome has no invocation surface, and the module *"does not invent one."*
- The prohibitions are **instructions, not code** — the CDP runner blocked substitution in three
  layers; the Sonnet adapter has **no mechanical enforcement at all** (RUNTIME-DECISION.md:76-82).

**Verified identical in the in-flight worktree** `C:\Fusion247PKA-b15` — `handoff/instructions.js`
line 44 and `INSTRUCTIONS_VERSION = 1` are unchanged, so WP-B15-1 does not move any of the above.

**Two behavioural gaps worth Warwick's eye, recorded not actioned:** the search-fallback conflict
(§B.2), and the learning loop's hard-coded `applies_going_forward: false` (§B.1).

---

## E. PRESERVATION CONTRACT

The smallest evidence-backed set. **Every line below is proven by a real run**; anything I could
only find asserted in a document is excluded by design.

1. **Consume the confirmed plan in its given order. Never reinterpret the handwritten list at the
   shelf.** *(RUN-4's failure mode was hand-assembled plans; the packet exists to end that.)*
2. **Audit the existing trolley before changing anything, and leave already-correct lines alone.**
   *(Step 2 — 10 products / 19 items untouched.)*
3. **Source from Regulars / Favourites first. Do not browse category or shelf pages to hunt a size
   variant** — this was stopped mid-run by Warwick and never recurred. *(Step 5.)*
4. **Work one coherent browser session and one page context. Do not open a page per product.**
   *(Proven by contrast: 15 items off one page vs ~13-30 s per product page.)*
5. **Read structure, not pixels** — page text / accessibility tree to locate each product's quantity
   input and checkbox by reference. **Screenshots are blank on the heavy grid; the trolley page
   renders fine.** *(Steps 3, 16; session log `:44`.)*
6. **Re-acquire references after every mutation.** *(Step 6, explicitly.)*
7. **Batch adds where the grid allows it, and treat a batch failure as an out-of-stock signal —
   split to isolate and DROP the offending item, never to conclude the batch was too big.**
   *(Steps 4→6→7 prove the diagnosis; RUN-3 proves a 25-item batch can succeed when no OOS item is
   in it.)*
8. **Verify every add from the trolley counter before moving to the next line.** *(Steps 6, 11.)*
9. **Handle an unavailable item deliberately: confirm on its product page, leave it out, present
   priced alternatives, never substitute.** *(Step 7.)*
10. **Reconcile the finished trolley line by line from the trolley DOM, reading each line's actual
    quantity field — never inferring quantity from price.** *(Step 16 — caught 2 errors in 29 lines;
    RUN-3's reconcile caught a silently missed item.)*
11. **Correct a quantity with the `+`/`−` steppers. Typed quantities do not persist server-side, and
    the page will lie about it.** *(Steps 17-18, proven by reload.)*
12. **Batch every open question into one message and wait.** *(Step 9.)*
13. **Stop at a checkout-ready basket. Never book a slot, pay, check out, or enter a credential.**
    *(All runs; no exception anywhere in the record.)*
14. **Record the run, and mark each resolved question for reuse or not.** Every run gets an outcome
    entry; the original Drive template's `applies going forward` question is the field that decides
    whether an answer ever helps again. *(§B.1; the historical failure to do either is why this audit
    was needed.)*

**One environmental CONSTRAINT, proven and worth carrying — not a behaviour:** **the ASDA Regulars
list has no manual per-item remove control; it is auto-generated from order history.** Corroborated
across two independent Drive documents — the Decisions Log and the Order History entry (*"'Regulars'
has no manual remove option (it's auto-generated from order history)"*). **Consequence for a future
worker: Regulars cannot be curated directly.** Favourites is the curatable surface, which is why
"click ASDA's Favourite control for an approved new product" (`BROWSER_METHOD:47`) is the only
mechanism the worker has to shape next week's grid. I record this as a constraint rather than a
numbered behaviour because no run proves an *action* here — it proves an absence.

**Deliberately excluded:** any implementation technology. Nothing in the evidence makes CDP,
MCP, an extension or a runner necessary. What the evidence constrains is *behaviour*.

---

## F. NEXT-SLICE CONSEQUENCE

> **Should the basket-writer seam revive the proven historical method, adapt it, or deliberately
> replace it?**

**ADAPT.** One recommendation, and the grounds:

**Not "revive verbatim":** the proven runs used a specific tool vocabulary (`find`, `read_page`,
`form_input`, `scroll_to`) whose availability to the ruled Sonnet-in-Chrome adapter is
**UNESTABLISHED**, and the bulk control failed in one of the two runs that attempted it. A contract
that hard-codes a mechanism nobody has re-verified would repeat the exact error of 2026-08-03 — a
document read as a specification.

**Not "replace":** replacement has been measured. It cost ~8 hours against three prior runs that
worked, and every substantive engineering property the CDP runner has (lease, fencing, idempotent
replay) has already been harvested into `handoff/claim.js` without the runner itself.

**Adapt means, concretely:** carry §E's fourteen behaviours forward as the outcome contract; and
**reopen — as evidence questions for Warwick, not as build work — the two proven behaviours the
current instruction set has dropped**: (a) batch selection where the grid offers it, attempted with
a proven split-and-drop fallback, and (b) search-fallback for a known item absent from its named
view. Both were proven in real runs; both are currently forbidden or cancelled; one of them was
cancelled on a premise this audit refutes.

**And close the evidence gap that made all of this possible:** RUNTIME-DECISION.md:149 already asks
for it — *"that gap should be closed by capturing evidence during the next real shop."* The next real
shop should record tools invoked, operation counts and elapsed time. Three successful runs happened
and **not one of them recorded a duration**, which is why the entire speed argument rests on one
person's memory.

---

## Limitations

- **No git access of my own.** All commit-history and tracked-status facts were executed by Larry and
  reported to me. On that basis: **both corroborating artefacts are tracked** (`git ls-files
  --error-unmatch`), session log first added in `db29c09`. *(Gap closed 2026-08-09.)*
- **Decisions Log: read by Larry, summarised to me rather than staged**, deliberately, because it is
  dense with household personal data and this repository is public. I have relied on his extract for
  its protocol, template and entry count; I verified the *code-side* half of §B.1 in source myself.
  **The Drive-side half of that finding is single-source.** *(Gap closed 2026-08-09, with that
  caveat.)*
- **No live database, no live browser, no runtime.** Every current-state claim is a source claim.
- **RUN-1 and RUN-2 are each single-source.** Their internal step detail is uncorroborated. RUN-3 is
  the only run attested by two independent artefacts.
- **Elapsed times are unevidenced for every successful run.** Any speed comparison in this brief is
  relative (page-visits, operations), never absolute.
- I did not attempt to determine the exact MCP/extension binding used in RUN-3, nor which script was
  driven on 2026-08-03. Both are **UNESTABLISHED** and I have not guessed at either.
- **`applies_going_forward` cause is UNESTABLISHED** — the mechanism and its effect are proven; the
  intent behind the literal is not, and I did not construct one.
