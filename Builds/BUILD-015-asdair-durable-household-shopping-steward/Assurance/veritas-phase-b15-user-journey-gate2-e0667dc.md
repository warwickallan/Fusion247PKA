---
build: BUILD-015
scope: THE ACTIVE ACCEPTED USER JOURNEY — photograph a list in Telegram through to a supervised ASDA basket. Scope floor and ceiling, determined by Veritas from the accepted journey; the dispatch offered no narrower slice and none was taken.
gate: 2

boundary: The BUILD-015 accepted user journey and the outcome it promised — that Warwick can photograph his shopping list, be asked only what genuinely needs asking, answer naturally including in free text, have those answers change this shop and where appropriate become durable household knowledge, SEE what he has answered and what remains, reach READY_TO_SHOP only when he can tell nothing is unresolved, and hand over to a supervised browser build.

reviewed_sha: e0667dc95134856494a4a3c95aaf22721e3fcb89
governance_sha: 37c9aef2d00e3f895f8c31ee8c3c0db7b697776b
branch: main (local only — on no ref of the canonical remote)

evidence_method: mixed — a RAW TELEGRAM CAPTURE supplied verbatim by Warwick (the rendered interface, as he received it), read-only source inspection in the repository working tree, and executed suites recorded but explicitly NOT relied on at this gate. Live durable production state was UNAVAILABLE and is declared by name.
evidence_workspace: C:/Users/Buggly/AppData/Local/Temp/claude/C--Fusion247PKA/a8a4a211-d8c2-42c1-8bb3-d7d87ba2540f/scratchpad/vx
worktree_head_at_start: 37c9aef2d00e3f895f8c31ee8c3c0db7b697776b
worktree_head_at_end: 37c9aef2d00e3f895f8c31ee8c3c0db7b697776b
worktree_status_clean: true

review_ceiling: 60 minutes elapsed across Gate 1 and Gate 2, set by the dispatch. Not extended.
narrowing_attempted: NO — the dispatch explicitly declined to offer a narrower slice and instructed Veritas to grade the journey. Recorded as required.

verdict: FAIL
receipt_sha256: 430a41966fff5f27c52a1d6d38b1169f4458a6a049ce9df4c6eb6edba13072b0
reviewed_by: veritas
reviewed_date: 2026-08-10
next_review_trigger: A question surface that lets Warwick determine from the PRODUCT ALONE every outstanding question, which he answered, which answers were accepted, what remains, whether anything blocks completion, and when he is finished — exercised through Telegram on a real shop, with the rendered artefacts durably captured. NOT a moved HEAD, NOT this receipt, NOT a green suite, NOT another Work Order landing.
---

## Scope reviewed

**The ACTIVE ACCEPTED USER JOURNEY, end to end, through Telegram — the real production interface.**

> Warwick photographs his shopping list in Telegram → it is interpreted against the household
> catalogue → he is asked only what genuinely needs asking → he answers naturally, including in free
> text → his answers change THIS shop and, where appropriate, become durable household knowledge → he
> can see what he has answered and what remains → it reaches `READY_TO_SHOP` only when he can tell
> nothing is unresolved → he taps Build ASDA basket → a handover card with a tappable checklist →
> supervised browser.

**The dispatch did not attempt to narrow this**, and says so explicitly. Recorded because the contract
requires the attempt to be recorded either way: **no narrowing was offered.** The scope graded here is
the journey, floor and ceiling, exactly as §"GATE 2 IS NOT GATE 1 AT WIDER SCOPE" requires.

**One question is asked and answered here, and it is the only one:**

> *«Could Warwick complete this journey correctly using ONLY the product in front of him — without
> Larry querying the database, explaining hidden state, telling him which cards he missed, or
> interpreting contradictions for him?»*

**Not graded here:** WP-B15-08's engineering rows. They have their own receipt
(`veritas-wp-b15-08-gate1-e0667dc.md`, HOLD). Where a user-facing row was graded there on component
evidence, this gate grades the human outcome — which the 2026-08-10 RE-CUT makes explicit is the first
time that requirement is graded at all, not duplication.

## The accepted journey, graded step by step

| Step | Verdict | What the product actually does |
|---|---|---|
| Photograph a list in Telegram | **PASS** | Established. `SHOP-2026-08-10-M64` was created from a real photograph with 35 lines and 8 questions. He received it |
| Interpreted against the household catalogue | **FAIL** | Interpretation runs, but the questions it produced are not ones a household catalogue should need to ask. `"BATCHLORS MAC N CHEESE"` was escalated to a human while the catalogue holds `"Batchelors Pasta 'n' Sauce Mac 'n' Cheese Pasta Sachet 99g"` — and that exact string was printed on the card as a suggestion. `"VANISH PRETREAT GEL"` was escalated while `"Vanish Pre-Treat Gel"` was printed on the same card. Warwick: *"its bloody obvious!"* §"What a coherent surface has to let the user do" forbids escalating a decision "where existing grounded evidence is already sufficient to settle it under the accepted product rules" |
| Asked only what genuinely needs asking | **FAIL** | Of the eight questions, at least two were settleable from the evidence already on the card (above). A ninth line he was asked about — list item 210 — is not from this photograph at all: `M64` is bound to `list_id 20`, the CANCELLED shop's list. He is being asked to decide an item he did not send this week |
| Answers naturally, including free text | **FAIL as experienced** | Every one of his four typed answers ALSO became a new shopping list: `M76`, `M77`, `M79`, `M82`, each answered with *"🛒 Shopping list received … Status: Safely stored"*. WP-B15-08 AC1 repairs this in code and is mutation-proven, **but no real typed reply has traversed the fixed bytes**, so at this gate the property is `HOLD` at best and the only observed behaviour is the failure |
| Answers become durable household knowledge where appropriate | **FAIL** | *"no durable rule was written by any of his four typed answers"* (`2026-08-10-assurance-falsification-question-surface.md`, row 8). He asked for this the previous night. It is a named part of the accepted journey and it has never been demonstrated through the interface |
| **He can see what he has answered and what remains** | **FAIL** | **This is the centre of the failure.** The product emits no answered/outstanding state. `renderStatus` requires a projection Warwick must ask for and reports lines, not questions. The one card that would tell him — `lines_unresolved`, *"N line(s) still need a decision"* — is enqueued behind `outboxEverQueued(…, 'lines_unresolved')` at `runPipeline.js:1009`: **once ever, per shop, never refreshed.** Its counts are a snapshot taken when the shop first parked and go stale the moment he answers anything. Warwick received no such card in the M64 capture at all. **Larry had to query the database and tell him "6 of 8".** That sentence is, by itself, the answer to this gate's question |
| Reaches `READY_TO_SHOP` only when he can tell nothing is unresolved | **FAIL** | He cannot tell. Worse, `M64` cannot presently reach it: one of the two open questions is the inherited item 210, and the other is *"1 PKT HAM ON THE BONE"* — no candidate buttons, `Search ASDA` dead, and typing an answer minted a junk shop. Both routes out of that card were closed to him |
| Taps Build ASDA basket | **NOT REACHED** | Blocked upstream |
| Handover card with a tappable checklist | **NOT REACHED** | Already `HOLD` at the prior Gate 2 (`veritas-phase-b15-live-readiness-gate2-3696960.md`) |
| Supervised browser | **NOT REACHED** | — |

## Evidence provenance

- **The human interface was inspected as the human received it**, per §"How that duty is
  DISCHARGED": `Deliverables/2026-08-10-warwick-telegram-capture-m64.md`, Warwick's own verbatim paste
  of all eight cards, the four replies and the four responses, plus his own words. It is a **raw
  capture supplied by the actor who can produce it**, not Larry's account of the interface — which is
  the sole reason it is admissible, and it is the reason this gate could return a verdict at all.
- Source inspected read-only in the repository working tree at `37c9aef` (product bytes identical to
  `e0667dc`; digests recorded in the Gate 1 receipt).
- `git rev-parse HEAD` start / end: `37c9aef2d00e3f895f8c31ee8c3c0db7b697776b` / same.
  `git status --porcelain` — 0 lines at start and end. No repository mutation.
- **Declared unavailable, by name:** the live durable production state. This dispatch declares no
  `private_surface`, no `ASDAIR_DB_URL` is present, and GL-012 denies `C:\.fusion247\**` by default.
  **Veritas therefore did not re-measure the state Larry reported and does not restate his figures as
  its own measurement.** Where a row above cites live state it is attributed to him or to the capture.
  This gate's FAIL does **not** depend on any unmeasured figure — every failing row is established
  from the raw capture or from source.
- **No journey step was requested of Warwick.** Per the dispatch and §Method 2a, a property needing
  his action is a named limit, never a request.

## Evidence executed or inspected

| Command or artefact | Exit | Executed subtests | Result |
|---|---|---|---|
| `Deliverables/2026-08-10-warwick-telegram-capture-m64.md` | n/a | n/a | Eight question cards, four typed answers, four "Shopping list received" responses, one dead `Search ASDA` tap, Warwick's own words. **PRE-fix** |
| `renderMessages.js` — `renderStatus`, `renderLinesUnresolved`, `renderQuestionCard` | n/a | n/a | No surface reports answered-vs-outstanding *questions*. `lines_unresolved` is the closest and is once-ever |
| `runPipeline.js:1008-1020` — `outboxEverQueued(… 'lines_unresolved')` | n/a | n/a | Confirms the once-ever guard from source |
| `runtime.js:591-594` | n/a | n/a | A refused control this product drew reaches the pass report, never Warwick |
| Suites: pipeline 405, bot 170, shop 102, intake 34 | 0 | 711 | All green — and green suites are explicitly **not** evidence at this gate |
| Live durable production state | **UNAVAILABLE** | n/a | Declared, not smoothed over |
| A real post-fix Telegram card or reply | **DOES NOT EXIST** | n/a | Declared. The runtime carries the new bytes; the event has not happened |

## Assurance dimensions

| Dimension | Verdict | Basis |
|---|---|---|
| Goal fidelity | **FAIL** | The journey's own words — *"he is asked only what genuinely needs asking"*, *"he can see what he has answered and what remains"*, *"it reaches READY_TO_SHOP only when he can tell nothing is unresolved"* — are each contradicted by what he received |
| Design fidelity | **FAIL** | §"What a coherent surface has to let the user do" requires the user to determine from the product: every outstanding question, which they answered, which answers were accepted, what remains, whether anything blocks completion, and when they are finished. **None of the six is available.** It also forbids reconstructing state from scrolling message history — which is the only route he had, and it failed him: *"The richmond question I have only just seen now whilst replying to you"* |
| Functional proof | **FAIL** | The one real end-to-end execution of this journey did not complete and cannot presently complete |
| Integration | **FAIL** | The seam between "answer a question" and "receive a list" was open in production. It is closed in code and unproven in production |
| Durability | **HOLD** | Answers persist — that much is established. Durable *household knowledge* from a free-text answer, a named part of the journey, has never been produced by a real answer |
| Test quality | PASS | Not this gate's question, and recorded only because it is genuinely good: the WP-B15-08 tests turn red when the capability is removed, verified independently at Gate 1. **It changes nothing here** — that is the point of the two gates being separate |
| Git truth | PASS | Larry's integration commit is labelled PARTIAL, names what was descoped and why, and states "NOT PROVEN: the real production event." No false completion claim was made anywhere in this boundary. This gate's FAIL is about the product, not about honesty |
| Documentation truth | PASS | The two forward-correction records state the failures plainly and correct forward without rewriting prior receipts. The Wayfinder's ACTIVE SESSION WORK PACKAGE is stale (still WP-B15-3) — recorded once, non-blocking, carried to Gate 3 |
| Residual risk | **FAIL** | The dominant residual is that Warwick's real, half-answered shop is stuck in a state he cannot resolve from the product, and the fixes that landed do not reach the eight cards already in his chat |
| Completed automation | **FAIL** | Root `CLAUDE.md` §"Nothing may live only in Larry's head": *"a fresh session must use it without being reminded"* and *"failure must never be silent"*. Warwick's shop state is currently knowable only by Larry running a query. That is a required production step depending on Larry, and it is the definition this clause gives |

## Production caller and journey

Traced and complete: Telegram → `pollIntake` → `claim` → `routeTaps` → `commands.dispatch` →
`runPipeline` (`transcribe` → `interpret` → gates) → `queueShopCards` → `drainOutbox` → Telegram. The
wiring is closed. **The wiring is not the finding.** The finding is that a closed loop delivering an
unusable surface is still an unusable surface, which is the exact distinction §"TECHNICAL CAPABILITY is
not USER OUTCOME" draws.

The one hop that is genuinely broken rather than merely inadequate: a callback on a control this
product drew, refused, terminates at the pass report (`runtime.js:591-594`) with no `acknowledge` —
so pressing `Search ASDA` on any of the eight cards still in his chat produces nothing, today, after
the fix.

## Restart and durability

The runtime was restarted at 17:56:06Z on the new bytes (Larry's report; not independently observed by
Veritas, and nothing here depends on it). **The withdrawal of `Search ASDA` applies only to cards
rendered after that restart. The eight cards in Warwick's chat were rendered before it and still draw
the dead control.** A rendering fix does not reach messages already sent — that is a durability
property of a messaging journey and it is not a defect in the fix, but it must not be mistaken for the
button being gone from his phone.

## Documentation contradiction scan

- Larry's declared DOCUMENT IMPACT for this boundary: `[]`.
- Verified independently: the two forward-correction records are accurate and complete against the raw
  capture. Every row of `2026-08-10-assurance-falsification-question-surface.md` is corroborated by the
  capture or by source. No document overstates what shipped.
- **What his list missed:** the Wayfinder's ACTIVE SESSION WORK PACKAGE still presents WP-B15-3 rows
  1–5 as the frontier, with requirement 2 — *"Coherent question surface"* — carrying a discharged-HOLD
  banner and no record that its PASS was falsified. A fresh Larry reading that section would not learn
  that this journey failed in the user's hands. **Non-blocking for the product verdict; material for
  orientation, and it belongs to Gate 3.**
- Closure claims since the last receipt, and the receipt behind each: **none made.** Correct conduct.

## Defects

| # | Severity | Finding | blocking/non-blocking | Owner |
|---|---|---|---|---|
| G2-1 | CRITICAL | **The product cannot tell Warwick what he has answered, what remains, or whether he is finished.** No surface reports it; `lines_unresolved` is once-ever and stale on arrival; he received none. Larry had to read the database for him. This alone answers the gate's question NO | **blocking** — blocks any claim that the accepted journey works, and blocks phase PASS | Larry (the question-surface redesign is already being specified) |
| G2-2 | CRITICAL | **The current shop cannot be completed from the product.** One open question is an item inherited from a CANCELLED shop's list (AC2, withdrawn from WP-B15-08 rather than fixed); the other offered no candidates, a dead `Search ASDA`, and a typed answer that minted a junk shop | **blocking** | Larry |
| G2-3 | HIGH | **Questions are escalated that the evidence on the card already settles.** Two of eight printed the correct catalogue product as a "suggestion" and asked anyway. Explicitly forbidden by §"What a coherent surface has to let the user do" | **blocking** for the "asked only what needs asking" clause | Larry |
| G2-4 | HIGH | **Free-text answers do not become durable household knowledge.** A named part of the accepted journey; four real typed answers produced none | **blocking** | Larry |
| G2-5 | HIGH | **A dead control is still live on his phone.** The eight existing cards still draw `Search ASDA`, and a refusal on it still reaches nothing he can see (Gate 1 D-2) | **blocking** | Larry |
| G2-6 | MEDIUM | **`Skip this week` ships but is unknown to the user, and he was told the opposite.** The capture records that he did not know the button existed and that Larry told him the junk line could not be cleared without a code fix. WP-B15-08 withdrew AC3 on the premise that "a skip route already ships" — engineering-true, user-false | non-blocking as a defect; **the withdrawal premise is unsound and is reported once** | Larry |
| G2-7 | LOW/UNVERIFIED | `"Show me what is waiting"` on the `lines_unresolved` card is `ACTIONS.ANSWER` with **no** argument. The candidate-resolution path at `runtime.js:603` requires `intent.arg`. Whether this control has a working handler was **NOT established** — the verdict was already determined and §Method 5a forbids broadening. Recorded as an open question, never as a finding | non-blocking, **unverified** | Larry |

## Why this is FAIL and not HOLD

`HOLD` is for *"may well be substantially correct, but required evidence … is missing."* That is not
this. **The evidence is present and it is negative.** The journey was executed once, for real, by the
user it was built for, and it did not complete — and the six properties §"What a coherent surface has
to let the user do" requires are absent from the product by construction, established from source, not
inferred from a missing test. `UNKNOWN → HOLD` does not apply, because this is not unknown.

**FAIL** here means what the contract says it means: the reviewed scope materially misses the goal, the
phase stays open, and Larry re-plans. It carries **no** accusation of dishonesty — the integration
commit and both forward-correction records are candid, and the question-surface redesign is already
being specified. It is a verdict about the product, recorded because Larry asked for the truth rather
than a comfortable verdict, and because a formulation of the amended contract that could still return
PASS or HOLD on this estate would, by that contract's own standard, not have been implemented.

## No readiness claim is made

This receipt does not authorise, recommend, permit, endorse or tell anyone to proceed with the live
journey, in any wording. Warwick's shop `SHOP-2026-08-10-M64` should not be treated as resumable on the
strength of anything here. Veritas could not measure the current durable production state and makes no
claim about what the system will do on the next real event.

## Verdict

**FAIL** — the accepted user journey cannot be completed by Warwick using only the product in front of
him; the six properties a coherent decision surface must provide are absent, his current shop is
blocked on a question inherited from a cancelled shop and a question with no usable answer route, and
free-text answers still produce no durable household knowledge.

## Next review trigger

The delivery of a question surface that lets Warwick determine, **from the product alone**, every
outstanding question, which he has answered, which answers were accepted, what remains, whether
anything blocks completion, and when he is finished — **exercised through Telegram on a real shop**,
with the rendered artefacts durably captured. **Not a moved HEAD. Not this receipt. Not a green suite.
Not another Work Order landing.** Until a real human run exists, there is nothing at this gate to
re-grade.
