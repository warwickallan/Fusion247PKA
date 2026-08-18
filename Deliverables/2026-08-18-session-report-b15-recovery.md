# Session performance and process report — BUILD-015 AsdAIr recovery + BUILD-006 Phases 1–2 close

**Author:** Pax, independent session witness. Commissioned at `/rotate` steps 5, 5b, 5c.
**⚠️ SAME-MODEL REVIEW — independent of the session and its context, not of the model. Not externally verified.**

| | |
|---|---|
| **Session** | BUILD-015 AsdAIr recovery + BUILD-006 Phases 1–2 close, 2026-08-17 → 2026-08-18 |
| **Branch** | `main` |
| **Closing head** | `80944ae30cf951184fe339199191e0e7f1053f49` |
| **Active map** | `Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md` (BUILD-006 map parked at `a2e9189`) |
| **Host at close** | claude-code **2.1.227**, model `claude-opus-5[1m]`, effort `high` — read from the sampler, not asserted |
| **Mandatory inputs used** | `Deliverables/2026-08-18-subagent-token-ledger-b15-recovery.md` · `~/.mypka/governor/capae-opening.json` |

⛔ **PAX COULD NOT COMMIT THIS FILE OR ITS PAYLOAD.** This dispatch's grant is `Read · Write · Grep · Glob · WebFetch · WebSearch` — **no Bash, no PowerShell, no git binary.** Larry must commit both, then run `populate.mjs` (7b) and `capae-sync.mjs` (7c). **This is the THIRD consecutive rotation in which the session witness has been dispatched without a shell**; see §12.

---

## 1. Executive summary

**Warwick's standing correction is upheld by measurement, and it is the headline. Of 18 material findings this session, 13 were answers the estate already held — 72.2%.** Rules 11, 33, 34, 40 and 50 all existed and named real rows; the ruling *"a default model name that the gateway does not provide must never survive preflight again"* was fifteen days old; the upscale that removes vision inventions had been measured on 2026-08-12 and never reached the production photo path. **This estate's failure mode is not ignorance. It is non-enforcement.**

**Work Order discipline collapsed in one session — from 7-of-7 generated with zero refusals to 0-of-3 generated with two refusals** — and the two refusals were for `file_surface` and `live_authority`, which are **mandatory, generator-enforced fields on the exact route that was skipped**. That is the cleanest preventable-failure finding this series has produced.

**Against that, two things went genuinely right.** `record-amended-body-not-recut` records its **first clean** — the BUILD-015 map was re-cut whole rather than appended, and rows were deliberately *not* touched while Veritas was mid-review. And BUILD-006 Phases 1 and 2 reached **Gate 1 PASS 9-of-9 and Gate 2 PASS** on the managed store, which is `built-tested-never-activated` working at its best, in the same session in which it failed seven times on the other build.

---

## 2. EXECUTIVE CAPAE

> **4 active risks were loaded into Larry at session start. All 4 had qualified opportunities. 1 prevention held. 3 recurred despite being in the opening brief. A FIFTH family — absent from the brief for the SECOND consecutive rotation — also recurred, and the reason is now established rather than hypothesised: the opening brief is snapshotted 36 minutes BEFORE the previous rotation's own `capae-sync` writes it, so every rotation's lesson reaches Larry ONE SESSION LATE BY CONSTRUCTION. Work Order generation degraded sharply, from 7-of-7 and zero refusals to 0-of-3 and two refusals. Activation discipline SPLIT — it held expensively on BUILD-006 and failed seven times on BUILD-015. Record reconciliation improved and records its first clean. `acceptance-proves-mechanism-not-outcome` recurred three-to-four times inside ONE boundary, in a dispatch in which Larry himself had named it as the family most likely to recur there.**

---

## 3. The measured window

**Every timestamp is derived from `.git/logs/refs/heads/main`, `.git/logs/refs/remotes/origin/main`, two branch reflogs, `~/.mypka/governor/ding-log.jsonl`, `session-report-populate.jsonl` and the statusline sampler, read directly. Unix seconds converted to UTC against the anchor `6dd40ba = 1786961253 = 2026-08-17T10:07:33Z`, which the previous report established.**

| | |
|---|---|
| **Session start (SessionStart hook)** | **2026-08-17T10:19:31.123Z** — `capae-opening.json` `snapshot_at`, 11m58s after the previous session's closing head |
| **First commit of this session** | `5254f150` — "BUILD-006 Phases 1+2: managed-Supabase LIVE ACCEPTANCE evidence complete" — **2026-08-17T10:57:33Z** |
| **Closing head** | `80944ae` — "Subagent token ledger for the rotation" — **2026-08-18T09:42:25Z** |
| **Head at the time of writing** | `80944ae`. **No drift.** For the first time in four rotations the declared closing head was still `main` when the witness began |
| **Wall clock, SessionStart → closing head** | **84,174 s = 1,402.9 min = 23 h 22 m 54 s** |
| **Wall clock, first commit → closing head** | 81,892 s = 1,364.87 min = 22 h 44 m 52 s |
| **Git-observable working span** | **449.62 min (7 h 29 m 37 s)** across three segments |
| **Git-silent gaps** | **915.25 min (15 h 15 m 15 s)** in two blocks |

**The three working segments:**

| # | Window (UTC) | Minutes | What it contains |
|---|---|---|---|
| 1 | 08-17 10:57:33 → 11:58:17 | **60.73** | BUILD-006 managed-Supabase live acceptance; **four Veritas passes, eight receipts**; the Wayfinder work-classification template + the reviewed `CLAUDE.md` redline; Phases 1 and 2 both PASS |
| 2 | 08-17 17:18:01 → 23:44:20 | **386.32** | BUILD-006 parked; the real weekly shop and its three defects; **Warwick's Goal Contract / North Star re-cut**; two Keel streams built and merged; the REPEAT-FAILURE enforcement fix; attempt 3 to the freeze point |
| 3 | 08-18 09:39:51 → 09:42:25 | **2.57** | Rotation banking — true state, then the token ledger |

**The gaps, honestly labelled and NOT asserted idle.** 08-17 11:58:17→17:18:01 (**319.73 min**) carries no notification and no commit. 08-17 23:44:20→08-18 09:39:51 (**595.52 min**) is overnight. The five-hour rate-limit bucket read **2 %** at 09:46 on 08-18 against a window that opened ~09:33 that morning, which is consistent with a quiet night and says nothing about the earlier gap.

### ⚠️ TWO SESSION IDS, ON TWO DIFFERENT HOST VERSIONS, INSIDE ONE WINDOW

The sampler holds exactly one file per session id. Two of them fall inside this window:

| session id | `sampled_at` | host | model | context |
|---|---|---|---|---|
| `6b147a85-fd06-4294-bf71-d171357401f2` | 2026-08-17T23:44:53Z | **2.1.222** | `claude-opus-5` | 925,116 / 1,000,000 — **93 %** |
| `058cb015-e803-4b49-9e9b-0819935f9eca` | 2026-08-18T09:46:21Z | **2.1.227** | `claude-opus-5[1m]` | 929,669 / 1,000,000 — **93 %** |

The previous session (`0deb55dc`) was already on **2.1.227** at 2026-08-17T10:17:20Z. **A 2.1.222 sample at 23:44 the same day cannot be the same installation moving forward in time**, so **two distinct Claude Code installations produced statusline output inside this window.** `6b147a85`'s sample lands **33 seconds after** commit `2329a98`, the last commit of segment 2.

**Whether they ran concurrently is UNESTABLISHED**, and I will not guess. It is reported because the subagent ledger records, unprompted, that *"one [worktree] was found deleted from disk by something other than its owner when it resumed — cause unestablished"*, and a second live session is the cheapest available explanation for that. **Recommendation: establish it once. A second installation running this estate's hooks against the same worktrees is the one item here with a real (if modest) data-loss surface.**

---

## 4. Token and context economics — every figure read from an instrument

### 4.1 Context readings

| Reading | Value | Source |
|---|---|---|
| **Closing context occupancy** | **929,669 input tokens of a 1,000,000 window — 93 % used, 7 % remaining.** `total_output_tokens: 648` is the last refresh's figure, never a session total | `~/.mypka/governor/health/C--Fusion247PKA/058cb015-….json`, `sampled_at 2026-08-18T09:46:21.637Z`, `source: statusLine` |
| **Opening context reading** | **UNESTABLISHED — and structurally unavailable, for the third report running.** The sampler keeps one JSON per session id and overwrites it on every refresh | verified by enumerating `health/**` — 76 files for this project, one per session id, none with history |
| **Total measured context movement** | **UNESTABLISHED.** No opening reading, therefore no delta. I will not estimate one | — |
| **Rate limits at close** | five-hour **2 %** (resets 2026-08-18T14:30:00Z); seven-day **7 %** | same sampler file |

**The binding constraint was again the context window, not quota** — 93 % occupancy against a 2 % five-hour bucket.

### 4.2 Subagent traffic — the ledger, independently cross-footed

**Total A = 2,509,759 deduplicated subagent tokens across 15 agents / 19 dispatches.** I re-added all 14 measured rows independently: they sum to **2,509,759 exactly**. The ledger's §C shape table also cross-foots to the same total (962,708 + 747,310 + 357,385 + 442,356), and its dispatch counts sum to 19. **Both totals cross-foot — a straight improvement on the previous ledger, whose Total C was wrong by one and contradicted its own prose.** No repeated value appears among the 14 readings.

**Total B — peak footprint per persistent agent:** the three resumed Keels dominate — **375,227 · 373,349 · 214,132**. Everything else was single-dispatch, so no reviewer or operator accumulated a large persistent context. **No oversized background agent was left running at rotation.**

**Total C — 19 dispatches across 15 agents.** One agent, `a3290e36…` (Keel, CDP, stopped by Larry), emitted no usage block: **unmeasured, NOT zero.** Every percentage below is of measured traffic.

**The cumulative-vs-per-dispatch question was re-tested this session and the 2026-08-08 finding HELD** — `subagent_tokens` cumulative per agent id, `tool_uses` per dispatch, proven by `tool_uses` going 75 → 51 on a resumed agent while tokens rose monotonically. **Summing every return would have inflated Total A by ~26 %.** Re-testing rather than assuming is the correct behaviour and is recorded as such.

**⛔ Larry's own context is NOT in Total A and must never be added to it.**

> **929,669 tokens of Larry's closing context occupancy (a LEVEL) against 2,509,759 tokens of delegated subagent traffic (a FLOW) — 1 : 2.70.** Previous session: 1 : 4.24.

### 4.3 Burn rate

| Basis | Rate | Comparison |
|---|---|---|
| Over the **449.62-min working span** | **5,582.7 tokens/min** | previous 7,842.7 — **down 28.8 %** |
| Over **1,364.87 min** wall clock | 1,838.8 tokens/min | not comparable; 15 h of git-silent time |

**19 returns at a mean 132,092 tokens.** Codex/Tower emitted nothing this session because **no Codex run occurred** — see §5.4.

---

## 5. THE HEADLINE — how much of this session was discovery, and how much was re-discovery

Warwick's standing correction: a large share of the night's discoveries were answers the estate already held. **I tested it against the artefacts, and it holds.**

### 5.1 The classification, item by item

**KNOWN DECISION NOT IMPLEMENTED — 7.** A recorded rule, ruling or diagnosis existed; the executable path did not obey it.

| # | Finding | The answer the estate already held |
|---|---|---|
| K1 | The trolley reconciliation decided presence from *this* invocation's outcomes, printing `Added 2 · not attempted 35` beside a trolley of 35 products | **Rule 34, since 2026-07-21**: *"confirm every item is present, the correct product, and the correct QUANTITY… Agents repeatedly get QUANTITIES wrong."* Quoted back at itself in `reconcile.cjs:75-77` |
| K2 | The executor free-searched every no-id line individually — the cause of all four abstentions and ~25 min of avoidable work | **Rule 40 and `SOP-021 §4` ARE the production method** (map Gap 1): Regulars/Favourites → Brand A–Z → ordered bulk pass |
| K3 | Warwick was asked about the Sure deodorant and the toffees anyway | **Rules 50 and 11** — *"both were active on 2026-08-17, both name a real row"* (`resolveByCatalogue.js:310-317`), and neither was passed into `resolveAll` |
| K4 | *"1 pk fruit lolly ice"* became a question Warwick called *"stupid"* | **Rule 33** maps Fruit Splits to ice lollies with a named fallback (Warwick, 2026-07-21). `mum-list-2026-08-17.expected.json:41`: *"Rule 33 already says what Mum's fruit lollies are."* |
| K5 | `ROLE_ALIAS.vision` still defaulted to `fusion.vision`, which the gateway does not register | **D-2026-08-03-05**, fifteen days old, carrying Warwick's ruling *"A default model name that the gateway does not provide must never survive preflight again."* The fix was applied to `answerModel()` only and this line was left carrying the dead alias — stated in the source's own comment |
| K6 | Nothing claimed a browser build request, so **every shop parked at `wait:browser_runner` forever** | The map's own Lane C, dated 2026-08-09: *"packet/handoff has no production caller… **no Larry-less claimer by design** (`stages.js:85`: waitsFor: the supervised browser runner (Larry, at the keyboard))"* |
| K7 | Three Work Orders issued, **zero** through the generated envelope route | `SOP-022 J1-1`, `tools/wo/envelope.mjs`, and 7-of-7 compliance six days earlier |

**KNOWN DATA NOT CONSUMED — 2.**

| # | Finding | The data that already existed |
|---|---|---|
| D1 | The running executor ignored the household rules | `household-rules.json:2`, in the repository: *"The runtime must OBEY these, not merely be able to read them."* Gap 10: *"Do not repeat tonight's mistake of proving rules exist in files while the executor ignores them."* |
| D2 | Identity was re-derived by live search; **12 ASDA ids were harvested as a by-product** of a shop that already had them on the page it was standing on | The household's own ASDA Favourites/Regulars grid. `read_regulars` was added on 2026-08-18 (`commands.test.cjs:6`) |

**KNOWN LESSON NOT APPLIED — 4.**

| # | Finding | The lesson |
|---|---|---|
| L1 | Terra **invented a product on a real shop** — *"2 sliced roast beef"* → *"2 skinny cow bars"* — and lost a second to a duplicated line | Measured **2026-08-12**: arm C (correctly-oriented bands, no upscale) 28/39 with **7 inventions**; arm D (same bands, deterministic 3× resize) 38/39 with **0 inventions**. The production path was still handing the model 720×1280 (~34 px/line) on 2026-08-17. `runPipeline.js:701-707` now says so in its own comment |
| L2 | The vision defaults test was **green in CI where the alias was broken and red where it worked**, because `loadModels()` never cleared `FUSION_MODEL_*` | *"A control is not evidence until made to fail"*; *"measure through the ENFORCING mechanism"* |
| L3 | `basket-executor` operates the live trolley and **nothing ran its 56 tests** | *"Unrun CI looks like green CI"* |
| L4 | The opening brief omitted the family that recurred, for the second consecutive rotation | `capae-brief-snapshot-taken-before-sync`, proposed 2026-08-13 |

**GENUINELY NEW DEFECT — 5.**

| # | Finding |
|---|---|
| N1 | **Nine typed answers bound to the question ABOVE the one they answered; two never recorded.** *"Which product is 1 x 4pk Ben & Jerry's cookie dough?"* → *"Ice lollies are in favourites. stupid question"*. Systematic, on the photo door. No prior record surfaced in my search *(confidence: Medium — absence established across the defect ledger, the map and `Deliverables/`, not exhaustively)* |
| N2 | **`answerQuestion` is first-answer-wins, so four mis-bound rows could not be corrected** and the whole shop had to be abandoned. A safety property became a trap |
| N3 | The grounded prompt was **instructing** the duplicate merge — *"mark the later one possible_duplicate"* — which is how the Heinz line was lost |
| N4 | Regular 105's alias *"tresemme blue label"* outranked regular 17, turning a conditioner into a shampoo |
| N5 | Two Claude Code installations produced statusline output inside one window (§3). **Found by me, not by the session** |

### 5.2 THE RATIO

> ### **13 already-held : 5 genuinely new = 2.6 : 1.**
> ### **72.2 % of this session's material findings were answers the estate already held.**

**Excluding N5, which the session did not find, the ratio is 13 : 4 = 76.5 %.** I lead with the more conservative figure.

**What this measures, stated precisely so it is not over-read.** It does **not** say the work was wasted — every one of the thirteen is now closed at the enforcement point, which is the first time several of them have been. It says that **thirteen separate times, the estate contained the answer and the running system did not act on it.** A prevention that lives in a rules table, a defect ledger entry, a map row or a measured experiment, and is never wired to the decision point, is indistinguishable at runtime from not knowing. **The single durable phrase this session produced is `main`'s own: *"rules that never reached the decision point"* — and it names the whole class.**

**Larry's own §12 record already draws the correct conclusion and it should be preserved verbatim:** *"Rules must reach the **decision point** — a rule in Git or Supabase that the runtime does not consume is FAIL."*

### 5.3 Evidenced allocation

Classified from the ledger's 14 measured agents. Denominator is **subagent token traffic**, not wall clock and not total effort.

| Class | Agents | Disp. | Tokens | % of A |
|---|---|---|---|---|
| **Product implementation** — 3 Keel streams (intake, runtime, basket executor) | 3 | 7 | **962,708** | **38.36 %** |
| **Assurance** — 4 Veritas (554,001) + Nolan complexity check (60,299) | 5 | 5 | **614,300** | **24.48 %** |
| **Operating the product (the rescue)** — 4 Asdair dispatches | 4 | 4 | **442,356** | **17.63 %** |
| **Rotation reporting** — Pax, the *previous* session's witness, landing after its `/clear` | 1 | 1 | **357,385** | **14.24 %** |
| **Record / governance** — Nolan contract re-cut | 1 | 1 | **133,010** | **5.30 %** |
| | **14** | **18** | **2,509,759** | **100.00 %** |

> ### **DELIVERY TAX: assurance 614,300 : product 962,708 = 0.64 : 1** — down from **1.18 : 1** last session.
> Including the previous session's Pax report as delivery overhead it is 971,685 : 962,708 = **1.01 : 1**. The ledger's own grouping (Veritas + both Nolans) gives **0.78 : 1**. All three are stated; none is wrong, they count different things.

**Corrective rework is 0.00 % — there was none.** No dispatch this session was a re-run of a defective earlier dispatch.

**⛔ The number that matters here is not the tax. It is the 17.63 % spent OPERATING the product**, plus Larry's own hands-on runtime work, which no instrument in this estate reads. **Under the contract re-cut the same night, every token in that row is a product failure**, not a cost of delivery.

### 5.4 What assurance ran, and what did NOT

**Four Veritas passes on BUILD-006, eight receipts, in the correct shape:**

| Pass | Head | Gate 1 | Gate 2 | Scope |
|---|---|---|---|---|
| 1 | `5254f15` | **HOLD** `77c93ee8` | **HOLD** `9f2a1370` | full nine functional requirements + North-Star journey |
| 2 | `2877dfb` | **HOLD** `ac7198b4` | **HOLD** `ac669ba3` | focused: D-1/D-2 and G2-1/G2-2 |
| 3 | `f373e4a` | **HOLD** `112b3b54` | **PASS** `cfee97b1` | focused: F2-5 only / G2-4 only |
| 4 | `35ce064` | **PASS 9 of 9** `5fb5ce1a` | **PASS** `7884e9c7` | focused: F2-5 only |

**Each pass narrowed. Zero re-reviews of a receipt. Zero reviews of a head whose delta was a previous verdict.** The commissioning question is satisfied in writing at each step — the confirm3 receipt states it: *"a capture using the product's own `--hold-at` facility now exists, which is the exact discharge route my prior receipt prescribed."* **That is the discipline `CLAUDE.md` demands, executed.**

**And no product defect was found at any pass.** The acceptance document says so in Larry's own words: *"Every finding was mine, and all four were one failure: asserting where I could have measured."* §6.4 grades that.

**⛔ NO CODEX RUN OCCURRED THIS SESSION, AND FOUR PRODUCT COMMITS REACHED `main`.** `wo/b15-intake` (2 commits) and `wo/b15-runtime` (1 commit) were merged locally at 22:35:05Z and 22:35:23Z — **eighteen seconds apart, no PR, no Tower trigger** — and `67736bb6` was committed directly to `main`. **BUILD-015 holds no Veritas gate on any of it.** This is precisely the condition `CLAUDE.md` §"GIT CONVERGENCE IS NOT AUTOMATICALLY ASSURANCE CONVERGENCE" names, *"regardless of how the work arrived: direct integration to main · a local merge and push"*.

**It is NOT a violation, and I say so plainly:** the map records the debt rather than hiding it. Its stated route is *"close the ten gaps → **Veritas** made-to-fail against the new Goal Contract → bounded estate reconcile → **Codex** external release QA → 24 August real shop"*, and §12's NEXT ACTION names the Veritas dispatch. **Named-and-owed is the bar; silence is not, and there is no silence.** What Warwick should know without reading further: **executable state on `main` has moved beyond BUILD-015's last assured boundary, deliberately, with the debt recorded and the route named.**

---

## 6. CAPAE — the six questions, per family, by name

**Graded against `~/.mypka/governor/capae-opening.json` (`snapshot_at 2026-08-17T10:19:31.123Z`, content `written_at 2026-08-13T15:21:52.339Z`), never against `capae-active.json`. Vocabulary: `clean` · `recurrence` · `none-this-session` · `unmeasurable-at-this-frequency`. There is no fifth word.**

**⚠️ The brief Larry was handed was 92 h 57 m stale by content and carried the same four families, with the same counters, as the previous session's brief.** §6.5 establishes exactly why.

### 6.1 `work-order-not-generated` — occurrences 5, clean 0 of 5, MONITORING

1. **Told:** *"The generation route is treated as exempt for orders that feel small, amendment-shaped, or urgent. The control exists, is known, and is skipped at the moment of dispatch."* Must: *"Generate the envelope, read it back, then issue. No exemption for small or amendment-shaped orders."*
2. **Exposure: `recurrence`.**
3. **Evidence, and it is complete rather than sampled.** Three Work Order identifiers are stamped into committed artefacts this session — `WO-2026-08-17-B15-BASKET` (`basket-run-log.json:2`, `trolley-reconciliation.md:3`, `run-basket.cjs:3`, `plan.cjs:2`, `judge.cjs:2`, `launcher.cjs:2`), `WO-2026-08-18-B15-INTAKE` (both `wo/b15-intake` commit subjects) and `WO-2026-08-18-B15-RUNTIME` (`resolve.cjs:2`, `favourites.cjs:2`, `method.cjs:2`, `consume-request.cjs:2`, `wake.test.cjs:2`, `ladder.test.cjs:2`, `RUNBOOK.md:5`). **Not one of the three exists as an order file anywhere in the repository.** Three independent checks agree: no `Deliverables/2026-08-1[78]-*wo*` file exists; a repository-wide search for `generated_at: 2026-08-17` or `2026-08-18` returns **zero matches**; and the newest file carrying `GENERATED by tools/wo/envelope.mjs` is `2026-08-15-wo-canonical-ding-and-crlf-check.md`. **0 of 3.**
   **⛔ AND THE CONSEQUENCE IS MEASURED, NOT THEORETICAL.** Larry reports two Keel orders returned `REFUSE`/`CLARIFY` for missing `file_surface` and `live_authority`. **Both are mandatory, generator-enforced fields** — `envelope.mjs:143` lists `live_authority` in the required set; `:1074` emits `authorRequired('file_surface', …)` so an unresolved surface renders the envelope visibly INCOMPLETE; `:973-977` makes a missing `live_authority` deviation fatal for a machine surface. **The route that was skipped is the route that supplies the two fields whose absence caused both refusals.**
4. **Prevention held: NO, three times out of three.**
5. **vs previous: `degraded`, and it is the sharpest single-session reversal in this series.** Previous: 7 of 7 generated, zero refusals, described as *"the clearest single improvement in the report"*. This: 0 of 7 → 0 of 3, two refusals, one order withdrawn.
6. **Still repeating despite being in Larry's starting context: YES.** It is the **first** family in the brief he was handed.

**⚠️ A second-order cost, and it is why this family is not clerical.** The two refusals and the withdrawn order **have no durable record**. I searched `Deliverables/`, `Builds/BUILD-015-…/SHIT-TO-DO.md` and every `.md` in the repository and found no challenge log for any of the three. Under the generated route the challenge lands *inside the committed order file*. Without it, **three read-back events that caught three real defects exist only in a transcript that `/clear` has now destroyed.** §8's first-dispatch figure is Larry's disclosure, not an artefact I can verify.

### 6.2 `built-tested-never-activated` — occurrences 6, clean 1 of 5, MONITORING

1. **Told:** *"Integration is treated as complete at the point the code is committed and green. The activation surface is a separate step nobody owns."* Must: *"Do not report an integration done until the thing it was built to do has actually happened once."*
2. **Exposure: `recurrence` — and it is the dominant family of the session.**
3. **Evidence. Seven instances, every one of them K1–K7 or D1–D2 in §5.1**, and the clearest is `consume-request.cjs`: the handoff seam had been built, tested and committed, and **nothing ever claimed a build request, so every shop parked at `wait:browser_runner` forever** — the map having recorded that exact diagnosis on 2026-08-09 and left it standing. Rules 11, 33, 34, 40 and 50 are the same shape in data rather than code: written, stored, green, and never at the decision point.
   **⛔ COUNTER-EVIDENCE, AND IT IS LARGE.** On the other build in the same session the family worked at its best. Migrations 001 and 002 had never reached the managed Supabase project; the phase-PASS claim had been **withheld in writing for that reason** across two prior sessions; and this session Larry applied them with the files' exact bytes, proved idempotency against the managed project, exercised all three intake routes, killed mid-intake at two timings, mutation-tested twenty append-only attempts **with a harness proven capable of observing a success**, and only then submitted for assurance — refusing to record PASS himself. **Gate 1 PASS 9 of 9 and Gate 2 PASS followed.** That is the `must` executed exactly.
4. **Prevention held: yes on BUILD-006, no on BUILD-015, seven times.**
5. **vs previous: `degraded`.** Two consecutive cleans, then seven instances in one session.
6. **Still repeating despite being in Larry's starting context: YES.**

### 6.3 `record-amended-body-not-recut` — occurrences 5, clean 0 of 5, MONITORING

1. **Told:** *"Amendment-by-append with no reconciliation step."* Must: *"Supersede the body, or do not append the amendment."*
2. **Exposure: `clean` — and it is this family's FIRST recorded clean.**
3. **Evidence, from the two maps rather than from Larry's account.** The BUILD-015 map took a North-Star change — the largest possible amendment — and **superseded rather than appended, everywhere I checked**: §1 *"GOAL CONTRACT AND NORTH STAR — **RE-CUT 2026-08-17**"*; §12 *"**REPLACED WHOLE 2026-08-17**"*; the four-lane execution view *"⛔ **BOUNDED 2026-08-17** … no longer the top of the map"* with *"THREE THINGS IN THE LANES BELOW ARE SUPERSEDED"* named individually; the seven runtime capabilities *"**superseded by the TEN GAPS above, 2026-08-17.** Kept for the owner column only"*; the 2026-08-08 Star restatement *"**BOUNDED 2026-08-17**: still the right SHAPE, no longer the right MECHANISM"*.
   **I specifically hunted the failure shape and did not find it.** Four separate pointers (lines 174, 186, 801, 5955) direct a fresh session to **§12 RESUMABLE STATE** as the one directive section. Under amendment-by-append those pointers would now aim at stale content. **§12 was replaced whole, so all four still resolve correctly.** On the BUILD-006 map, line 110 was re-cut *in place* with the reason recorded: *"Row re-cut 2026-08-17: it read 'draft PR #105 open and unmerged', contradicting the Release-train row below. **Superseded by execution, not by preference.**"*
   **⭐ AND THE 4B LESSON WAS APPLIED DELIBERATELY, AT COST.** The redline document records Nolan's finding that the classification block adds six lines to the BUILD-006 map and removes zero, and then holds the correction: *"His named cuts to that map are held only because **Veritas is mid-review of those exact rows**, and re-cutting them under a running reviewer is the failure this estate paid 5h27m for."* **That is a specialist finding correctly accepted, correctly sequenced, and correctly not acted on yet — and it is the opposite of this family.**
4. **Prevention held: yes.**
5. **vs previous: `improved`.** Previous: one recurrence, worker-detected mid-implementation, 32 m 07 s to repair, named in the same paragraph that committed it.
6. **Still repeating: NO.** **Record this as the first clean of five.**

### 6.4 `acceptance-proves-mechanism-not-outcome` — occurrences 2, clean 0 of 5, MONITORING

1. **Told:** *"Acceptance is authored against the implementation that exists rather than against the outcome that was promised, so the easiest available evidence is the one collected."* Must: *"State what was PROVEN, not what it implies. Name the scope of the verdict beside it."*
2. **Exposure: `recurrence` — three to four times inside ONE boundary.**
3. **Evidence, and the load-bearing half is the reviewer's, not Larry's.** Larry named this family in the Veritas dispatch as the one most likely to recur there. Veritas' reply is the finding: *"**Larry named `acceptance-proves-mechanism-not-outcome` as the family most likely to recur here. He was right, and it recurs on exactly one row.**"*
   - **Pass 1 — no raw capture was committed at all**, so nine requirements stood on unwitnessed attestation.
   - **Pass 2 — the mid-compile kill Larry had claimed had NO capture whatsoever.** Larry's own evidence README: *"saying otherwise was my **third occurrence** of `acceptance-proves-mechanism-not-outcome` in a single boundary."*
   - **Pass 3 — the replacement kill fired at 350 ms against a measured 317–337 ms boot-to-first-connect floor**, i.e. **23 ms above the 327 ms centre**, so it died during startup and proved nothing. Veritas: *"the harness cannot tell the difference, and says so without knowing it… branch **detection** was the improvement I praised at the last gate; here the detected branch is not the property the requirement is about. **This is the fourth occurrence… in this evidence directory, and it moved one level down rather than being closed.**"*
   - **Pass 4 discharged it on merits**, using the product's own `--hold-at` facility, with the **server** confirming one session `idle in transaction` at the instant of the kill — corroboration that does not depend on the harness reading its own stdout.
   **The count is disputed on the record and I report both: Larry says three, Veritas says four.** Either grades `recurrence`.
   **⚠️ AND THE SAME FAMILY IS THE DIAGNOSIS OF THE OTHER BUILD'S FAILURE, IN WARWICK'S OWN GOAL CONTRACT:** *"The capable model was engineered OUT of the loop and replaced by weak deterministic components, **each certified in isolation**. `acceptance-proves-mechanism-not-outcome` recurred **three times in that one night**."* **Two independent boundaries, one night, the same family.**
4. **Prevention held: no.** It failed inside the dispatch that named it.
5. **vs previous: `degraded`.** Previous: `clean`, with the reversal case stated. This: three-to-four uncontested occurrences at one boundary.
6. **Still repeating despite being in Larry's starting context: YES — and beyond the brief, despite being in the dispatch he wrote for the reviewer.** **This exceeds last session's benchmark instance.** The narrow prevention is already written in the product and was used at pass 4: **an acceptance kill is timed against a MEASURED floor and located by the product's own marker, never by elapsed milliseconds.** Existing facility, existing route, no new mechanism.

### 6.5 ⚠️ `control-cannot-reach-what-it-checks` — **NOT IN THE OPENING BRIEF, FOR THE SECOND CONSECUTIVE ROTATION — AND THE CAUSE IS NOW ESTABLISHED**

1. **What Larry was told: NOTHING.** The slug exists and is live — `capae-active.json` carries it as `occurrences: 4`, `state: CHALLENGED`, `clean: 0`. **It is absent from `capae-opening.json`.**
2. **Exposure: `recurrence`.**
3. **Evidence.**
   **(a) A defaults test that could not see defaults.** Map §12, line 6012: *"`ROLE_ALIAS.vision` was `fusion.vision`, which the gateway does not register; the guard pinned the broken literal and **`loadModels()` never cleared `FUSION_MODEL_*`**. All three fixed; mutation-proven."* The test was therefore **green in CI, where the default was broken, and red on a machine where an ambient variable made it work** — the control reading the environment instead of the property. The current source shows the repair: `visionRole.test.js:18-20` now deletes `FUSION_GATEWAY_URL`, `FUSION_GATEWAY_KEY` and `FUSION_MODEL_VISION` before each import. *(The pre-fix state is asserted by the map and the commit subject; I have no diff capability, so the "before" is single-source — but `models.mjs:20-28` corroborates the mechanism independently: "It survived because the ONLY thing keeping vision working was an ambient `FUSION_MODEL_VISION` on one machine; a clean box gets a 400.")*
   **(b) Two RUNBOOK commands that did not run as printed** — *"one exited 78, one exited 0 having run nothing"* (acceptance document, §OUTCOME). **An exit status of 0 from a command that executed nothing is this family's definition.**
4. **Prevention held: no.**
5. **vs previous: `unchanged`** — recurrence last rotation (×4), recurrence again.
6. **Still repeating despite being in Larry's starting context: NO — he was not told, for the second rotation running. And the cause is no longer a hypothesis.**

> **⛔ THE ORDERING DEFECT, MEASURED. This is the most actionable finding in the report.**
>
> | Event | Timestamp | Source |
> |---|---|---|
> | **This session's SessionStart snapshot** | **2026-08-17T10:19:31.123Z** | `capae-opening.json` `snapshot_at` |
> | The previous rotation's step 7b (`populate.mjs`) | 2026-08-17T10:55:36.627Z | `session-report-populate.jsonl:27` |
> | The previous rotation's step 7c (`capae-sync.mjs`) | **2026-08-17T10:56:20.668Z** | `capae-active.json` `written_at` |
>
> **The brief was snapshotted 36 minutes 49 seconds BEFORE the previous rotation's sync wrote it.** `capae-opening.json` carries `written_at: 2026-08-13T15:21:52.339Z` — the pre-sync content — and its `snapshot_of` field points at the very file that had not yet been updated.
>
> **The previous report proposed two explanations — graduation to `EFFECTIVE`, or crowding out by `selectActive`'s `limit = 4` — and could not distinguish them. It is NEITHER. The slug was not in the source file yet.**
>
> **The consequence is structural, not occasional: every rotation's lesson reaches Larry ONE SESSION LATE, by construction.** `/rotate` runs steps 5–8 *at the close*, but Pax is legitimately off the blocking path (step 6) and may return after the `/clear` — so 7b and 7c necessarily execute inside the **following** session, after that session's SessionStart has already frozen the brief.
>
> **AND IT IS ABOUT TO COST AGAIN.** `capae-active.json` as written on 2026-08-17 carries four families and **`acceptance-proves-mechanism-not-outcome` is not among them** — it was graded clean last session and displaced under the cap. **The family that recurred three-to-four times this session is currently absent from the live brief.** This rotation's sync will reinstate it, and by the ordering above that reinstatement will reach the session *after* the next one.
>
> **Prevention, and it is a sequencing decision rather than a mechanism: the snapshot is taken AFTER the previous rotation's `capae-sync` has run, or the brief states the `written_at` of the content it is showing so a stale one is visible on sight.** No new store, table, counter or control plane. The regrowth cap holds.

---

## 7. Findings

### F1 · `work-order-not-generated` — RECURRENCE, 0 of 3, with a measured consequence
Fully evidenced at §6.1. **The narrow prevention Warwick may want:** an order that names a builder goes through `tools/wo/envelope.mjs`. It is the existing script on the existing route, it was at 7-of-7 six days ago, and it supplies both fields whose absence caused both refusals.

### F2 · `acceptance-proves-mechanism-not-outcome` — RECURRENCE ×3–4 in one boundary, named in the dispatch that produced it
Fully evidenced at §6.4. Four Veritas passes and eight receipts produced **zero product defects** and four findings, all of them evidence quality. **The cost is entirely avoidable and entirely Larry's**: 554,001 tokens of internal assurance to establish, four times, that the evidence did not show what it was said to show.

### F3 · `built-tested-never-activated` — RECURRENCE ×7 on BUILD-015, CLEAN on BUILD-006
Fully evidenced at §6.2. **The estate's own new phrase is the durable output: a rule that does not reach the decision point is FAIL.**

### F4 · `control-cannot-reach-what-it-checks` — RECURRENCE, and the brief cannot deliver its own warnings
Fully evidenced at §6.5. **The ordering defect is the cheapest high-value fix available and it is a sequencing decision, not a build.**

### F5 · `record-amended-body-not-recut` — CLEAN, the first of five
Fully evidenced at §6.3. A North-Star change absorbed by supersession rather than append, with four cross-references still resolving and a specialist's correction correctly *held* rather than applied under a running reviewer.

### F6 · Three different basket totals for one shop, disclosed after a Keel caught it
**Established, and the durable record is the product's own source rather than Larry's account.** `reconcile.cjs:58-71`: *"`present` was decided from THIS INVOCATION'S `outcomes`. A line added by an EARLIER invocation has no outcome, so it was reported 'not attempted' while sitting in the basket — and, if it had been resolved by search, it then also appeared under 'in the trolley but not accounted for'. **One product, two contradictory rows, neither of them true.** … Meanwhile `shortfall` counted plan-versus-progress, a third number from a fourth source. **Three counters, three answers, and the phase was closed on a figure ("56 items, GBP 135.02") that appears in none of the artefacts.**"*
**The committed artefacts corroborate it exactly:** `trolley-reconciliation.md` reads `Order total £132.52 · Item count 55 · Distinct products 35` and `Added 2 · not attempted 35` beside a trolley of 35 products; the map's phase-closed row reads **56 items, £135.02**. **The regression test naming the defect is committed** (`basket.test.cjs:307-335`, *"THE DEFECT THAT PRODUCED THREE DIFFERENT TOTALS FOR ONE SHOP"*).
**Grading, and I split it because the evidence splits.** The reporting failure is real and the closed phase carries a number no artefact supports — **that must not stand unqualified in the map's outcome row.** But the discovery route is the one the estate wants: **a specialist caught it, Larry disclosed it, and the disclosure is in committed source rather than in a chat message.** Family: **`built-tested-never-activated`** — Rule 34 mandated exactly this reconciliation since 2026-07-21 and the executable path did not obey it.
**Recommendation (Warwick's call, one line):** correct the phase-closed row to the trolley-derived figure, or annotate it as a page-read total that three counters disagreed on.

### F7 · Larry inside the runtime — graded, because the commission asked
**The acts are established from the record, and the record is Larry's own map:** *"Larry read the photograph, hand-built the manifest, answered the question board, launched Chrome from a shell, started the executor, and **interfered with the browser mid-run**. **Every one of those is on the failure list in the operational contract above.**"* The failure list he wrote the same night names, individually: *"Warwick giving the photo to Larry · **Larry interpreting or repairing the list** · Warwick running PowerShell or node · **Warwick starting a worker** · progress depending on session-local state."*

**My grade: a KNOWING, DISCLOSED, TIME-BOXED VIOLATION, correctly labelled and correctly converted into ten named gaps — and it must never be repeated, which the map already says.**

- **Mitigation, and it is genuine.** A real household needed groceries that week; the shop had already failed twice; the alternative was Mum going without. Warwick's stated verdict on the outcome is *"Mum's basket delivered"*, and the map's *"OPERATIONAL RESCUE. NOT product acceptance"* is the correct label applied by Larry to himself.
- **Aggravation, and it is specific.** **Navigating the browser tab mid-run contaminated the run's own evidence.** The reconciliation artefact reports 35 of 37 lines `not_attempted` beside a trolley containing most of them, and twelve products *"in the trolley, but not accounted for by any manifest line"* that plainly were on the manifest. **Some of that is F6's code defect. Whether any of it is the mid-run navigation is UNESTABLISHED and unknowable**, which is precisely the harm — once an operator moves the surface under a running executor, no artefact can separate the two.
- **The separate acceptance risk, and the map already forbids it:** *"Do not repair the route mid-run and then claim the original route passed. **(This is the estate's `acceptance-proves-mechanism-not-outcome` family, which recurred three times on 2026-08-17 alone.)**"* Larry wrote that sentence about himself, on the day, and it is the right one.
- **Against the "delegation" rule specifically:** the one act with a *stated* Rule-4 justification is the managed-Supabase run, and the justification holds on inspection — the connection string sits at the **root** of `C:\.fusion247`, which GL-012 §4 makes an invalid grant a worker must refuse. **There was no lawful delegation, he says so in the document, and he did not route around the boundary to create one.** That is the correct handling. The AsdAIr runtime acts carry no such defence and are not offered one.

### F8 · Reporting accuracy — a second, smaller instance the commission did not name
**Larry's dispatch states four notifications were sent (550, 551, 552, 553/554). `~/.mypka/governor/ding-log.jsonl` records SIX: 550, 551, 552, 553, 554 and 555.** Message 555 (2026-08-17T18:03:59.686Z, 1,246 bytes, exit 0) is not in his account at all. **Nothing turns on it, and that is why it is worth one line: it is the same act as F6 — quoting a count he had not read from the instrument that holds it, in the very dispatch commissioning a report about doing that.** Family: **`control-cannot-reach-what-it-checks`** — recollection standing in for the log. **Record, park, no Work Order.**

### F9 · Two Claude Code installations inside one window
Fully evidenced at §3. **Reported for Warwick's decision, not recommended as a Work Order.** The one reason it rises above hobby-brain noise: a Keel worktree was found deleted by something other than its owner, and this is the cheapest available explanation.

### F10 · PROPOSED FAMILY — `capae-brief-snapshot-taken-before-sync`
**RE-PROPOSED, deliberately reusing the slug first proposed 2026-08-13, because the same prevention addresses every occurrence.** No slug emitted. Now measured exactly (§6.5): 36 m 49 s. **This supersedes the previous report's F8, whose two hypotheses were both wrong.**

### F11 · PROPOSED FAMILY — `rotation-close-cannot-name-its-own-closing-head` — **DID NOT RECUR**
Re-proposed unchanged at each of the last three rotations. **This time the declared closing head `80944ae` was still `main` when I began — drift 0.** Committing this report will make it +1, which is the structural minimum. **Recorded as improved, and the proposal stands only in its template form.**

### F12 · The subagent ledger — no defect found
Both totals cross-foot independently (§4.2). No repeated value among 14 readings. The cumulative-vs-per-dispatch property was **re-tested rather than assumed**, which `/rotate` 5b explicitly requires and which the previous ledger's defects showed was not decorative. **Stated positively because the previous report had to state the opposite.**

---

## 8. Work Order evidence

**Three Work Orders issued. Zero generated. Zero committed as order files.**

| # | Order | Package | Generated | Committed as a file | Read-back outcome | First dispatch substantive |
|---|---|---|---|---|---|---|
| 1 | `WO-2026-08-17-B15-BASKET` | the AI-capable basket executor | **NO** | **NO** | **UNESTABLISHED** | **UNESTABLISHED** |
| 2 | `WO-2026-08-18-B15-INTAKE` | household catalogue + rules decide what Mum's list means | **NO** | **NO** | **UNESTABLISHED** | **UNESTABLISHED** |
| 3 | `WO-2026-08-18-B15-RUNTIME` | Favourites-first identity, truthful trolley, a runtime that wakes | **NO** | **NO** | **UNESTABLISHED** | **UNESTABLISHED** |

**⛔ EVERY READ-BACK OUTCOME IN THIS TABLE IS UNESTABLISHED FROM THE RECORD, AND THAT IS THE FINDING.** Under the generated route the challenge log lives inside the committed order file, which is how the previous report could tabulate seven outcomes. With no order files, **three read-back events that caught three real defects survive only in a transcript `/clear` has now destroyed.**

**What Larry discloses, reported as his account and labelled as such:**

- **Two orders REFUSED/CLARIFIED for missing mandatory fields — `file_surface` and `live_authority`.**
- **One order cast the builder as the shopping operator and was withdrawn.**

**Derived figures, on his account: 3 orders · at most 1 first-dispatch substantive (33.3 %) · 2 refused/clarified · 1 withdrawn.** Against the previous session's 7 orders, 71.4 % and zero refusals.

**Preventable-failure analysis — all three are the same act, and it is one command.**

| Defect | Preventable by | Evidence that it would have fired |
|---|---|---|
| missing `file_surface` | `tools/wo/envelope.mjs` | `:1074` — `authorRequired('file_surface', 'COMPLETE writable REPO set')`; an unresolved field renders the envelope visibly INCOMPLETE |
| missing `live_authority` | `tools/wo/envelope.mjs` | `:143` in the required-field list; `:973-977` makes a missing deviation **fatal** for a machine surface |
| builder cast as the shopping operator | **not a generator defect** — a scoping error in the order's outcome. Preventable by the read-back, which caught it | the order was withdrawn, which is the correct outcome |

**Two of three were mechanically preventable by a script that exists, is committed, is tested, and was used seven times out of seven six days earlier. Neither is a new mechanism.**

**Not covered by any order:** the four Asdair operational dispatches (442,356 tokens, 17.63 % of A). **That is correct** — Asdair is a domain operator, not a builder, and the estate has never required orders for operating work.

---

## 9. Parent channel — availability, latency, queued messages

**Instrument: `~/.mypka/governor/ding-log.jsonl`, entries 214–219. It records timestamp, outcome, exit code, `message_id` and byte count. It never records message bodies.**

| `message_id` | UTC | Bytes | Outcome | Nearest commit |
|---|---|---|---|---|
| 550 | 2026-08-17T10:59:44.203Z | 1,567 | sent, exit 0 | `5254f15` 10:57:33Z, **+2 m 11 s** — managed-Supabase live acceptance complete |
| 551 | 11:48:48.530Z | 1,501 | sent, exit 0 | `35ce064` 11:48:10Z, **+38 s** — Phase 1 PASS, Gate 2 PASS |
| 552 | 11:59:08.836Z | 1,656 | sent, exit 0 | `c11b793` 11:58:17Z, **+51 s** — Phases 1 AND 2 both PASS, ACCEPT frontier CLOSED |
| 553 | 17:24:35.990Z | 1,652 | sent, exit 0 | `a2e9189` 17:18:01Z, +6 m 34 s — BUILD-006 parked, priority moves to AsdAIr |
| 554 | 17:33:15.361Z | 1,781 | sent, exit 0 | none within 15 m before or 61 m after |
| 555 | 18:03:59.686Z | 1,246 | sent, exit 0 | `fe3ab16` 18:34:47Z, **−30 m 48 s** (precedes it) |

**Established:** channel **available** — six sends, all exit 0, **zero `telegram-rejected`, zero transport failures, zero queued** (`ding.mjs` has no queue; every invocation logs a terminal outcome). **Send rate 6 in 1,402.9 min = 0.257/hour**, against 0.05 last session and 0.64 the session before.

**⚠️ The message ids 549 → 550 → 551 → 552 → 553 → 554 → 555 are CONTIGUOUS with no gaps.** Every message in that Telegram chat across the whole window came from `ding.mjs`. **Warwick sent nothing back through it** — which is consistent with the record showing him live at the terminal all evening (he cancelled two shops, answered nine questions, issued the Goal Contract ruling and checked out) and means the channel was one-way by his choice, not by failure.

**⛔ THE FINDING: ZERO NOTIFICATIONS IN THE FINAL 15 h 38 m 26 s**, from 18:03:59Z on 08-17 to the closing head. Inside that silence, each of these matches a written criterion in Rule 4a by shape:

| Event | Criterion |
|---|---|
| `d72e75b` 18:47:17Z — the real weekly run found three defects, one of which abandoned the shop | significant failure |
| `86f886c` 21:28:52Z — **"Mum's basket delivered"**, phase closed | substantive outcome he would want to know |
| `8d4bf4a` + `5e6d0e9` 22:35Z — **two branches merged into `main`** | **merges are named explicitly in the criteria** |
| `67736bb` 22:47:42Z — REPEAT FAILURE closed at the enforcement point | significant failure and recovery |
| `781859c`/`80944ae` 08-18 09:39–09:42Z — **the rotation itself** | `SAFE TO CLEAR` is named explicitly |

**My grade, split.** For the events up to and including the shop, **Warwick was demonstrably live and driving** — he issued a whole Goal Contract ruling at 20:00:58Z and checked out personally — so **the chat update was the delivery and no send was owed.** For **the two merges to `main`** and **the rotation**, that defence does not hold: the merges are named in the criteria, and the rotation ran on the morning of 08-18 after a nine-hour overnight gap during which Warwick was, on the evidence, not at the keyboard. **Under a literal reading, at least two sends were owed and none was made.**

**Was anything sent for routine narration?** **554 is the only candidate** — 8 m 40 s after 553, with no commit within 15 minutes before or 61 minutes after. **Its content is UNESTABLISHED and I will not grade a violation on a byte count.** The previously recorded failure mode (*"NEVER ding just to check in"*) is not evidenced.

**A separate, unmitigated point.** Rule 4a requires the notification path be confirmed available at orientation. **It was exercised at 10:59:44Z, 40 minutes into the session — so availability WAS confirmed early, and this is an improvement on the previous session.** It was then not exercised at all across the final 15 h 38 m, so availability across that stretch is **UNESTABLISHED**. **Response latency: UNESTABLISHED** — the ding log records deliveries, never replies.

---

## 10. Documentation versus product change volume — the complete session range

**⛔ Every line count, files-changed and `--stat` figure in this section is UNESTABLISHED. No Bash and no git binary in this grant, for the third consecutive rotation.** `.git/logs` carries SHAs, messages and timestamps and no diff content. **Commit classification below is derived from commit messages and from reading the working tree at the closing head** — the second of those is a primary artefact I verified myself; the first is the author's own words about his own work.

### On `main` — reflog lines 520–541, 22 ref updates

| Class | Count | Commits |
|---|---|---|
| Record · map · goal contract · governance | **13** | `70dd227`, `ade5e65`, `a2e9189`, `cc6d906`, `2b77224`, `cc598d8`, `57c1986`, `86f886c`, `2329a98`, `781859c`, `80944ae`, `fe3ab16`, `d72e75b` |
| Assurance evidence and receipts | **4** | `5254f15`, `2877dfb`, `f373e4a`, `35ce064` |
| Phase-PASS record | **1** | `c11b793` |
| **Product code** | **1** | **`67736bb`** — the dead model default, the defaults test, and the rules that never reached the decision point |
| Test fixture data | **1** | `bcf222d` — the household catalogue and Mum's 17 August list |
| Merge commits (`ort`) | **2** | `8d4bf4a` (`wo/b15-intake`), `5e6d0e9` (`wo/b15-runtime`) |

### On branches

| Branch | Content-bearing commits | Note |
|---|---|---|
| `wo/b15-intake` | **2** — `52f3053`, `2ad1ad0` | cut from `bcf222d` at 21:47:04Z, both commits within 47 min, merged 22:35:05Z |
| `wo/b15-runtime` | **1** — `d132aeb` | cut from `bcf222d` at 21:47:05Z, one commit, merged 22:35:23Z |

**Both branches were cut ONE SECOND apart from the same base and merged EIGHTEEN SECONDS apart** — genuinely parallel, disjoint, and serialised correctly at the merge, which is Larry's job under §Git ownership and was done.

### Ratios

**Non-product commits on `main` 20 : content-bearing product commits 4 (3 on branches + `67736bb`) = 5.0 : 1.** Previous session 2.31 : 1 — **materially worse on the number.**

**⚠️ And the number should be read with its cause, which I can evidence.** Thirteen of the twenty record commits carry a **Warwick product ruling and a whole re-cut Goal Contract and North Star** — the largest documentary event of the build. A North-Star change *is* a documentary output; measuring it as delivery overhead would misprice it. **The honest statement: the ratio is 5.0 : 1, and roughly two thirds of the numerator is the re-cut Warwick commissioned.** The BUILD-006 half of the session, by contrast, produced **five record/evidence commits and zero product commits by design** — it was an ACCEPT phase, correctly classified as such on the map.

**Pushes to `origin/main` through the closing head: 19** (reflog entries 239–257). **Zero force pushes. `main == origin/main` at close**, per the map's own §12 block.

---

## 11. UNESTABLISHED — the complete list

1. **Every line count, files-changed and `--stat` figure.** No Bash and no git binary — **third consecutive rotation.**
2. **The opening context reading, and therefore total measured context movement.** The sampler keeps one overwritten JSON per session id. **The `/rotate` mandate asks for a number the instrument architecturally cannot produce**, for the third report running.
3. **The read-back outcome and first-dispatch status of all three Work Orders.** No order file exists; the transcript is gone. §8's figures are Larry's disclosure.
4. **The bodies of all six notifications.** The ding log records bytes and outcomes, never content — so whether 554 was routine narration cannot be established.
5. **Parent-channel availability across the final 15 h 38 m 26 s.** Never exercised, so never confirmed.
6. **Parent-channel response latency.** The log records deliveries, never replies.
7. **Whether the two session ids in §3 ran concurrently**, and whether the second explains the worktree deleted by a non-owner.
8. **The pre-fix state of `loadModels()`.** Asserted by the map and the commit subject; the mechanism is corroborated by `models.mjs:20-28`; the "before" bytes are not readable without a diff.
9. **Whether any of the twelve "in the trolley but not accounted for" products, or the 35 `not_attempted` rows, were caused by Larry's mid-run browser navigation rather than by the reconciliation defect.** Structurally unknowable, and that is F7's point.
10. **Larry's own context as a FLOW.** No instrument reads it; correctly excluded from Total A.
11. **The unmeasured Keel dispatch `a3290e36…`** — stopped mid-flight before emitting a usage block. **Unmeasured, not zero.**
12. **Whether N1 (answers bound to the question above) has a prior record.** Absence established across the defect ledger, the map and `Deliverables/`, not exhaustively. Confidence: Medium.
13. **The exact split of Larry's own hands-on runtime time** during the rescue. Not instrumented anywhere.

---

## 12. Methodology, and its limits

**What I read, in order.** `Team/Pax - Researcher/AGENTS.md` and root `AGENTS.md` · the two mandatory inputs · `.claude/commands/rotate.md` for the grading contract · the previous report and payload for the comparison baseline · `.git/logs/refs/heads/main` (lines 505–541), `.git/logs/refs/remotes/origin/main` (lines 230–257) and both `wo/*` branch reflogs · `~/.mypka/governor/{capae-opening,capae-active}.json`, `ding-log.jsonl`, `session-report-populate.jsonl`, and two sampler files under `health/C--Fusion247PKA/` · both Wayfinder maps · the BUILD-006 managed-Supabase acceptance document and all eight Veritas receipts' frontmatter, plus three in full · the BUILD-015 Goal Contract, DEFECT-LEDGER and END-TO-END-PROCESS-AUDIT · the committed AsdAIr run artefacts · and, **as sources rather than as descriptions**, `services/asdair/basket-executor/{reconcile,basket.test}.cjs`, `services/asdair/interpret/resolveByCatalogue.js`, `services/asdair/pipeline/runPipeline.js`, `services/asdair/transcribe/visionRole.test.js`, `services/obsidiwikai/src/core/models.mjs`, `services/asdair/pipeline/testdata/household-rules.json`, and `tools/wo/envelope.mjs`.

**Cross-source discipline.** Every load-bearing claim rests on at least two independent sources, and the exceptions are labelled in place. Specifically, **I did not accept Larry's self-criticisms on trust and I did not accept his self-credit either**:

- The `acceptance-proves-mechanism-not-outcome` count is taken from **Veritas' receipts**, which are not Larry's writing, and the two counts (his three, Veritas' four) are both reported rather than reconciled in his favour.
- The three-totals disclosure is corroborated from **committed product source and a committed regression test**, not from his summary — and the committed artefacts independently show `£132.52 / 55 / 35` against the map's `56 / £135.02`.
- The Work Order finding is established by **three independent negative checks**, because a negative claim requires verification.
- The `record-amended-body-not-recut` clean was awarded only after I **hunted the failure shape deliberately** — chasing four cross-references into §12 to see whether they had been left aiming at stale content. They had not.

**Two corrections to the commission, which is Larry's own account of himself. One in his favour, one against.**

- **Against: he reported four notifications; the log records six.** §F8.
- **In his favour: he described the family as recurring "three times in one boundary". Veritas' own receipt calls the third instance "the fourth occurrence in this evidence directory."** The record is worse than his account of it, not better.

**A methodology self-catch, recorded because the previous report recorded the same one and it recurred.** `Grep`'s rendering returned `models.mjs:20` and `:27` as `\ 2026-08-18: …` and `\ 2026-08-17: …`, which read as a broken comment marker and would have produced a "the module cannot parse" finding. **The previous report caught the identical artefact in `permission-invariant.mjs` and recorded the lesson — *a rendering is not the source*. I applied it, read the file directly, and found the lines correct.** A prior lesson that actually prevented a false finding is worth one line in a report whose headline is that thirteen others did not.

**⚠️ The limit that bounds this report, now recurrent three times.** **Third consecutive rotation with no shell and no git binary.** Everything in §10 that Warwick would most want — lines changed, files touched, real diff volume — is unavailable for the third time running, and **the fix remains one word in the dispatch's tool grant.** `Bash` in the Pax grant would convert items 1, 8 and part of 9 from UNESTABLISHED into measurements.

---

## 13. Recommendations — evidence and options, never a decision

1. **⭐ Fix the CAPAE ordering (§6.5).** The brief has now failed to carry the recurring family twice running, and the cause is a 36-minute sequencing gap rather than either hypothesis previously offered. **Two options, both one line: (a) take the SessionStart snapshot after `capae-sync` has run, or (b) print the content's `written_at` in the brief so a stale one is visible on sight. Recommended: (b)** — it needs no change to when anything runs, it degrades safely, and it makes the defect self-reporting rather than requiring anyone to remember it. **Neither is a mechanism; the regrowth cap holds.**
2. **⭐ Restore the envelope route (§6.1, §8).** 0-of-3 in the session after 7-of-7, and the two refusals were for fields the generator makes mandatory. **No decision needed and nothing to build** — the script exists and worked six days ago.
3. **Correct the phase-closed outcome row (§F6).** *"56 items, £135.02"* appears in no artefact. **Warwick's call, one line: replace with the trolley-derived figure, or annotate it as a page read that three counters disagreed on.**
4. **Establish the two-installation question once (§3, §F9).** Not a Work Order. The only reason it clears the hobby-brain bar is the worktree deleted by a non-owner.
5. **Add `Bash` to the Pax rotation dispatch (§12).** Three consecutive reports have gone out with documentation-versus-product volume unmeasurable.
6. **Note for the next rotation, not an action:** `acceptance-proves-mechanism-not-outcome` is currently **absent** from the live brief and this rotation's `capae-sync` will reinstate it as a recurrence. **That is the correct mechanical outcome and it should be allowed to happen.**
7. **Not recommended as Work Orders: nothing in this report.** **No finding meets the `BLOCKS_CURRENT_MERGE` bar, and none of it justifies building anything.** F8 and F9 are record-and-park under the hobby-brain rule.

---

*Pax. Cross-source verified where possible; single-source claims flagged in place; nothing estimated.*
