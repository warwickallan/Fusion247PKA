# BUILD-016 CareerAIR — Wayfinder plan

**Created 2026-08-14 on Warwick's instruction, from durable sources only.** Reconciled, not concatenated.
**No CareerAIR development has begun.** This map exists so the first CareerAIR session starts from
established truth rather than archaeology.

> ## 🔴 THIS MAP IS THE ACTIVE FRONTIER — 2026-08-22, on Warwick's instruction.
>
> **His words:** *"Seen loads of good jobs advertised lately but not been able to apply for any as been
> fannying about with this. Get AsdAIr durable banked and pushed, want to rotate and pivot to CareerAIR."*
>
> **⚠️ THAT SENTENCE IS THE GOAL, NOT THE PREAMBLE.** The outcome this build owes is **applications going
> out for jobs Warwick has actually seen** — not a wired runtime, not a passing gate. Every decision here
> is measured against whether an application reached an employer. **Four days of BUILD-015 cost him a
> window of live vacancies; that is the price of this build being slow, and it is not recoverable.**
>
> **BUILD-015 AsdAIr is PARKED, not abandoned** — engineering COMPLETE, one human action outstanding on
> **Tuesday 25 August** (send the photograph). See
> `Deliverables/2026-08-04-build-015-asdair-wayfinder-plan.md` §12. **Do not resume it before Tuesday and
> do not let it displace this map.**
>
> ### ⛔ THE LESSON BUILD-015 PAID FOR, AND IT APPLIES TO THIS MAP'S FRONTIER EXACTLY
>
> BUILD-015 lost four days to one defect: **the approved contract never became load-bearing runtime
> behaviour.** Code existed, was tested, was committed — and **nothing in production invoked it.**
>
> **This map's own frontier is the same defect, in its own words:** *"The product works. NOTHING IN
> PRODUCTION CALLS IT."* `runJourney` has exactly two callers and **both are scripts a human types.**
>
> **So do not re-derive it, do not re-audit it, and do not open with a census.** The diagnosis is already
> made and it is already correct. **Wire one real production event and prove it fired.**
>
> **A second lesson, from the rotation that failed on 2026-08-19:** *a next action that depends on someone
> opening a session is not scheduled, it is hoped for.* BUILD-015's send window opened and closed unused
> because the packet carrying it is only read when a session starts. **If this build's outcome depends on
> a recurring human moment, that dependency is a defect to design out, not a note to leave in a map.**

## START / RESUME HERE — ordered by Warwick

- This Git Wayfinder is the sole route and source of truth.
- **On a fresh resume, BEFORE using any tool or doing any work, visibly state: (1) this recovered map path, (2) the goal, (3) the current phase and gate, (4) the next action. THEN open this map and continue.**
- **Canonical-lineage bootstrap — the first move of every fresh BUILD-016 session:** resolve current
  canonical state **by execution** before trusting anything in this map — `git rev-parse HEAD` on
  `main`, `git status --porcelain`, `gh pr list --state open`, and the live-runtime probes in
  § "The standing fresh-session bootstrap". **A running process or old checkout is deployment evidence,
  never source authority.** *"Running code tells us what was deployed. Git tells us what source we own"*
  (Warwick, 2026-08-08).
- Read the current phase, gate and evidence before acting.
- Honcho points here; it does not replace this map.
- Do not create a todo list, parallel tracker or replacement plan.
- Update this map only at meaningful phase boundaries: PASS, PARTIAL or FAILED, with an evidence pointer.
- Continue autonomously until completion or a genuine Warwick-only blocker.
- Before any clear, restart or handoff, ensure Honcho contains this exact path, current phase/gate and next action.
- **Tangents go in "SHIT TO DO" below. Do not chase them.**

## SHIT TO DO — parked tangents

**Estate-wide items go in `Deliverables/BACKLOG.md`.** CareerAIR-specific parked items live in the private
tree's `HELD-ITEMS.md`, and the reason is recorded there: *"a sanitised entry describing a private
capability's internals is still a declaration of it."*

---

# ⭐ THE ONE CURRENT DIRECTIVE BLOCK — **START HERE. Nothing else on this map directs anything.**

## ⛔ THE PREVIOUS FRONTIER IS SUPERSEDED BY EXECUTED EVIDENCE, 2026-08-14

> **This map previously said Phase 1's completion state had "never been measured" and that the next action
> was to measure whether the North Star journey had ever completed. BOTH ARE NOW FALSE.**
>
> **The census measured it. Evidence:** `Deliverables/2026-08-14-careerair-phase1-census.md`
> *(absorbed by pointer — not duplicated here)*

**⭐ THE NORTH STAR JOURNEY HAS COMPLETED, END TO END, REPEATEDLY.** Real public job URL in → **8 of 8
stages ran** → fit 9/10 → `ready_to_send` → **DOCX and PDF on disk with signatures matching the database
byte-for-byte.** **Warwick saw and accepted one:** *"Yeah found that, look good. I'm happy with that."*
**Confidence HIGH** — corroborated by the run record, the database rows, and the bytes on disk.

**⚠️ The stale `not_started` rows were the illusion.** `careerair.acceptance_evidence` holds all 13 AC rows
marked `not_started` with null proof — **while 158 journey runs, 92 CV artefacts, 178 verified exports and
170 fit assessments sat underneath them.** *The results existed. The ledger was abandoned, not empty.*

## WHERE PHASE 1 ACTUALLY STANDS — 21 items, **ZERO UNKNOWN**

| | Outcomes A–H | AC-01…AC-13 | combined |
|---|---|---|---|
| **PASS** | 0 | **2** | **2** |
| **PARTIAL** | **8** | 4 | **12** |
| **FAIL** | 0 | **7** | **7** |
| **UNKNOWN** | 0 | 0 | **0** |

**The two PASSes are real and load-bearing:** **AC-04** — 20 durable stops below the 7/10 gate, a 6 halted
before the expensive path, reproduced three times · **AC-07** — a genuinely expired advert (HTTP 410)
stopped honestly with a non-empty route forward.

**The seven FAILs, at summary level:** no authenticated acquisition route exists · no non-URL source has
ever reached a fit assessment · the below-7 override is unreachable · duplicate opportunities never
converge (`opportunity_link` = **0 rows**, ~196 rows for ~3 vacancies) · the privacy scan is red · one
vacancy has ever reached `ready_to_send` · AC-13 regressed from a genuine PASS.

## ⛔ SUPERSEDED 2026-08-22 — THE FRONTIER BELOW IS NO LONGER THE ROUTE.
**Read AMENDMENT 1 at the foot of this map first. Warwick has split this build in two: the scanning half is automated, the CV/application half is deliberately NOT. The gap named below is real and its intake half was closed on 2026-08-22 — but wiring one production event to runJourney is NO LONGER the next action, because runJourney drives the half he has ruled collaborative.**

## 🔴 THE FORMER FRONTIER — retained as record, superseded above

> **The product works. NOTHING IN PRODUCTION CALLS IT.**
>
> `runJourney` has **exactly two callers, and both are scripts a human types.** Every live intake surface —
> the Cockpit, Telegram, the three scheduled email runs — **terminates at *"opportunity recorded"* and
> stops.**

**That single gap IS `FR-23`** (*"Larry is not the normal runtime operator"*), **IS** AC-01's one unmet
clause (*"without a manual session"*), **IS** why two thirds of the bot's notification surface has nothing
to fire from, and **IS** why AC-03 and AC-05 cannot be exercised through any real surface at all.

**It is the estate's own bar failing on its plainest clause** — *code existence and a successful manual
invocation prove capability only.*

### 🎯 THE ONE NEXT ACTION FOR THE FUTURE CAREERAIR RESUME

> **Dispatch, as a bounded Work Order, the wiring of ONE real production event to `runJourney`** — the
> Cockpit intake panel is the cheapest candidate, since it already exists and already works.
>
> **⛔ IT NEEDS NO WARWICK DECISION.** The intake decision on this map governs *how opportunities arrive*;
> this governs *what happens after one arrives*. **Do not reopen the intake question to reach it.**

**The cheaper alternative if measurement is preferred first**, and it is a genuine option rather than a
hedge: **run the existing acceptance runner against 3–5 more real vacancies**, including one paste and one
below-7-then-proceed. **That moves eight measured items and builds nothing.**

## ⛔ NOT DONE, DELIBERATELY, AND NOT TO BE PICKED UP AS DRIFT

**Warwick, 2026-08-14: *"This is orientation hygiene only."*** No CareerAIR implementation has begun.
**Explicitly NOT done, each on his instruction:** the journey runner is **not** wired · the privacy scanner
is **not** wired · the email-address finding is **not** cleaned · the intake decision is **not** reopened ·
the new frontier is **not** solved.

**AC-10, corrected and proportionate** — Larry ran the scanner personally: **20 findings, 9 files, ONE
term — an email address.** *Not* employer, salary, vacancy, recruiter or CV data. **The real defect is that
the scanner is invoked by NOTHING** — no CI, no hook, no scheduled task — which is how a clean PASS on
2026-07-30 regressed silently. **A control nothing runs is not a control.**

**CareerAIR is PARKED AND READY. Resume from this block.**

## 1. GOAL AND NORTH STAR

> **North Star, verbatim** (`build-record/BUILD-016-goal-contract.md`): *Given a genuine opportunity from
> Warwick, CareerAIR materially reduces the effort required to decide whether to apply and, where he should
> proceed, produces a high-quality evidence-grounded tailored application package that is ready to send.*

> **The economic purpose, and it is the sharpest line in the contract** (`specialist/AGENTS.md`): *The
> product's economic purpose is **not** "produce a CV". It is to materially reduce the effort of deciding
> whether to apply, and — only where he should — to produce an evidence-grounded package good enough to
> send. **A generator that drafts for everything has thrown that purpose away.***

**⛔ THE ABSOLUTE BOUNDARY.** It builds a ready-to-send package and **STOPS**. *"Submitting is this
product's checkout: consequential, largely irreversible and reputational. A bad shopping basket costs a few
pounds; a bad application costs a shot at a job."* **Never submits · never contacts an employer or
recruiter · never automates the principal LinkedIn account · never handles a credential · never invents a
qualification or metric · never changes the 7/10 decision rule.**

**`FR-23` runtime independence is a PRODUCT REQUIREMENT:** *"Larry builds, maintains and governs the
capability. Larry is not the normal runtime operator."*

**The acceptance bar is a complete build, not a slice:** *"A single impressive URL→DOCX demonstration is
evidence, not completion"* (`NFR-08`, `AC-12`).

**Three phases** (`contracts/CAREERAIR-PROGRAMME.md`, authority `CAREERAIR-OPPORTUNITY-RADAR-008`):
**Phase 1** Application Engine — **active**. **Phase 2** Scout / opportunity radar — committed, not started.
**Phase 3** learning radar — defined, not scheduled.

## 2. WHAT GENUINELY EXISTS AND IS PROVEN — capability, never completed automation

**Proven by execution, each with a durable receipt:**

- **Zapier-MCP intake on 4 real messages** (`2026-08-06-careerair-mcp-demonstration-evidence.md`, `bd11f96`):
  channel derived not trusted · persist-before-ack · dedupe · **no-dupe on restart** · run idempotency ·
  **deny-by-default** (real Inbox id → `REFUSED unknown_folder`, nothing written).
- **DOCX route, 4 of 5 stages** — generate · structural validation (22 OOXML parts) · render + page count
  via Word COM · independent validation. **Settles that the absent legacy toolchain is not a blocker.**
- **Google Doc comment loop** — CL-3/4/5/7/9/10 proven; **design amended by execution** when a guarded
  in-place `replaceAllText` preserved an unrelated Warwick edit.
- **Requirement-set determinism** (migration 014) — closed a real fit-score drift (8, 9, 10 on the same
  vacancy, **sitting on the 7/10 threshold**); two renders now byte-identical.
- **Scout LinkedIn** — ran a real search twice; **correctly detected the sign-in wall and paused.**
- **24 migrations** exist, `001`–`024`.

## 3. WHAT IS LIVE — executed 2026-08-14

```
[cockpit] :8090 UP   [api] :8791 UP   [asdair] :8710 UP   [email] :8787 UP   [bot] UP
```

**⭐ The supervisor that runs the whole estate is CareerAIR's** —
`private/careerair/scripts/ensure-local-services.mjs`, task `MyPKA-Local-Services-Live`. **Three of its
five services are CareerAIR's.** Its health checks deliberately assert more than "the port answered".

**⛔ THE PROCESSOR IS AUTOMATIC AND SUCCEEDING. THE COLLECTOR IS AUTOMATIC AND FAILING.**
`CareerAIR-Email-{0800,1200,1700}` all exit `0` — **but exit 0 includes "nothing to do" and queue depth is
0. It is succeeding at processing nothing.** `CareerAIR-Graph-Collect` returns `LastTaskResult = 2`, and
the Proofline map records that as an intentional control.

## 4. WHAT IS BUILT BUT NOT LIVE

**Two thirds of the bot's notification surface has nothing to fire from** (`HELD-ITEMS.md` #1). Intake
receipts and outcomes are live; **fit results and document-ready are not** — they sit in `src/gate/` and
`src/draft/` with no scheduled run. *"Until a scheduled run exists, CareerAIR only speaks when spoken to."*

## 5. WHAT IS BROKEN

- **🔴 The collector.** `runtime/ops/state.json` (2026-08-14T18:50:02Z): `collector_state: "down"` ·
  `last_error: CAREERAIR_GRAPH_CLIENT_ID not set` · incident `graph_auth_required` open since **2026-08-07**,
  **muted**, **`suppressed_alert_count: 757`**. The mute carries its own unmute instruction and a trap
  warning that liveness reports on the webhook, not on Graph.
- **A reply to a notification card cannot be resolved after a restart** — in-memory reply index. The
  refusal is correct behaviour; the fix needs a durable reverse lookup **neither store exposes**.
- **`src/acquire/status.js` tells Warwick something false about PDFs.**
- **Page rasterisation** — headless Edge produced *"a valid 10 KB PNG that is entirely blank"*. The plan
  flags it as **exactly the trap the capability exists to catch: a `bytes > 0` check would have reported
  success.**
- **Word COM** ~27 s/page, effectively single-instance — *"If Warwick has Word open, an automated `Quit()`
  could disturb his session."*

## 6. ⛔ WHAT REMAINS UNPROVEN — the biggest item on this map

⛔ **SUPERSEDED 2026-08-14 — the bar WAS met and is evidenced; see the directive block. The sentence below was true when written and is retained only as the record of what changed.** ~~NO RECORD EXISTS OF PHASE 1'S OWN BAR BEING MET~~ — *"One real job completing the whole journey, from
intake to a downloadable tailored CV."* `AC-01`–`AC-13` have a proof plan and **no recorded results**.
~~`careerair.requirement_set` is empty on live data~~ ⛔ **FALSE — measured 2026-08-14: 45 rows, 1 ADOPTED.** The claim traced to a note written 2026-07-29; a real run adopted a version the next day and the note went stale — *"no real journey run has adopted a version yet."*
**Stated as absence of evidence after searching the repo, the private tree and all branches.**

**The reboot path is unproven** — *"a manual `Start-ScheduledTask` exercises the registration but not the
trigger."* **The acceptance blocker is with Warwick:** the drafting layer *echoes evidence bodies rather
than composing prose*. Real artefacts contained *"Stepped away and handed back the franchise."* **Scout
needs a one-time LinkedIn sign-in** (Human Dependency #1).

## 7. CURRENT ASSURANCE POSITION

**The only Veritas verdict ever issued against CareerAIR scope is Gate 1 FAIL at `0cf70c9`** — and it
failed because **the capability was absent, not the evidence**: a headless `claude -p` gets NO-MCP-TOOLS.
**No Veritas PASS exists for any CareerAIR boundary. No CareerAIR-scoped Codex review exists.**

## 8. THE PRIVATE-SURFACE BOUNDARY

**`C:\.fusion247\private\careerair\**` — never the root, never a sibling.** Access means **read AND
write**. **Credential material stays forbidden inside it** (GL-012 §2).

> **The split: *"Git contains the machine. Git does not contain Warwick's career activity."*** No employer,
> vacancy, salary, recruiter, application state or CV content — **including in a branch name, commit
> subject, PR title or CI artifact name.** Logging is allow-list: ids, stages, counts, error types.

### 🔴 THE PRIVATE CODE TREE IS OUTSIDE GIT ENTIRELY

**`git rev-parse --is-inside-work-tree` in `C:/.fusion247/private/careerair` returns
`fatal: not a git repository`.** No commits, no remote, no history.

**Measured against this estate's own definition — *"DURABLE means canonical, remotely recoverable"* — the
entire CareerAIR codebase, its 24 migrations, its contracts, its canonical career source and its build
record are NOT DURABLE.** Recorded as a state fact for Warwick. **Not actioned, and not to be actioned
without his decision** — the fix touches a private surface and its correct form (private remote? encrypted
bundle? local-only accepted?) is a product decision, not a tidy-up.

## 9. ⛔ STALE POINTERS — every one names a public path that does not exist

| document | claims | actually |
|---|---|---|
| `build-record/BUILD-016-goal-contract.md` §Status | `Team/CareerAIR…/AGENTS.md` | `private/careerair/specialist/AGENTS.md` |
| `specialist/AGENTS.md:4`, `contracts/LIVING-PLAN.md:6` | `Builds/BUILD-016-careerair-application-engine/` | `private/careerair/build-record/` |
| `build-record/BUILD-016-goal-contract.md` | `services/careerair/*.md` | `private/careerair/contracts/*.md` |

**A fresh session following any of them finds nothing.** There is **no `Builds/BUILD-016*`**, **no
BUILD-016 entry in `Builds/INDEX.md`**, **no `services/careerair/`**.

### ⛔ `contracts/LIVING-PLAN.md` IS DEMOTED. It must not redirect a fresh Larry.

**Header says 2026-07-29. Its §"Status and next action" reads *"Next action: Outcome D — settle the DOCX
generation and render route"* — work its own body then records as 4 of 5 proven.** It reflects **none** of
the 2026-08-06/07 work. **It is EVIDENCE of what was planned, never the frontier.**

## 10. THE PROVIDER CONTRADICTION — three sources, three answers, unreconciled

| source | says |
|---|---|
| `config/source-providers.json` (06/08 20:20) | `outlook_connector` — Graph, **ACTIVE** |
| `runtime/ops/state.json` (14/08 18:50) | `zapier_webhook` |
| Proofline row 3, the authorised route | **Zapier MCP only** — *"Do not require Entra/Graph consent as the path"* |

**Reconciled by authority and date: the authorised route governs — Zapier MCP, Graph NOT authorised.**
`source-providers.json` naming Graph ACTIVE is **a stale config file contradicting an authorisation**, and
`runtime/ops/state.json` is a runtime observation, not an authority. **The contradiction is a defect in the
config, not an open question about the route.** *Resolving it is part of the Warwick decision above.*

## 11. C-10 AND LATER RULINGS — reconciled by authority and date

**`Deliverables/BACKLOG.md` C-10, parked 2026-08-06** — Warwick: *"Row 3 you may descope and move with
details back to the backlog, we will come back to CareerAIR."* Disposition: *"return deliberately, not by
drift."*

**Five findings C-10 says MUST NOT be re-derived** — ① intake proven on real mail ② 🔍 **the silent-zero
trap**: Zapier's folder picker lists top-level folders only, so `CareerAIR` reads `totalItemCount: 0` while
its children hold **160 messages** — *a collector built on the picker reports success and collects nothing
forever* ③ the child folder ids reconcile with config ④ Zapier MCP **redacts the mailbox owner's own
address** ⑤ the provider contradiction.

**No later Warwick ruling supersedes C-10.** Everything after 2026-08-06 in the record is AsdAIr. **C-10
stands as the current authority, and the decision it names is the frontier above.**

## 12. ⛔ PROOFLINE CONTAMINATION — what may and may not be inherited

`2026-08-04-proofline-wayfinder-plan.md` is **3,350 lines**, named Proofline, and its body is the
**BUILD-020 Phase 4** Wayfinder. **CareerAIR content is confined to:** Amendments 3 and 4 · the
private-surface declaration · package block B · **struck** row 3 · **mixed** row 4.

- **Row 3's EVIDENCE is safely reusable** — duplicated verbatim into C-10, which is its live home.
- **⛔ Row 3's ACCEPTANCE JOURNEY TEXT IS NOT.** It is descoped Proofline-package scope. **Lifting it into
  CareerAIR acceptance is exactly the masquerade Warwick prohibited.**
- **🚩 Row 4 is genuinely ambiguous and is NOT resolved here** — a *Cockpit* acceptance requirement whose
  subject is *CareerAIR's* operational view, **"MOSTLY DONE"**, with an open residual (*"executable browser
  journey still owed"*). **Whether that residual is inherited Proofline work or current CareerAIR work is
  the exact question Warwick's rule is about. Flagged, not decided.**

## 13. THE STANDING FRESH-SESSION BOOTSTRAP

```sh
git rev-parse HEAD && git status --porcelain          # canonical state
curl -s http://127.0.0.1:8791/careerair/health        # the data API
curl -s http://127.0.0.1:8787/careerair/health        # the email webhook
# the ops record — the ONLY honest source on collector health:
#   C:/.fusion247/private/careerair/runtime/ops/state.json
```

**⛔ Do NOT infer collector health from a task exit code.** Exit `0` includes *"nothing to do"*, and that is
precisely how a dead collector looked healthy for eight days.

## 14. RESUMABLE STATE

**⚠ RE-CUT 2026-08-25 (Amendment 4). The rows below described this map as it stood on 2026-08-14 and
were contradicted by Amendments 1–3. Superseded in place rather than left standing.**

**Phase:** BUILD-016 Phase 1, Application Engine — **split by Amendment 1** into an automated scanning
half and a deliberately collaborative CV/application half.
**Gate:** the only Veritas verdict on this build remains **Gate 1 FAIL** at `0cf70c9`, on absent
capability. **No PASS exists, and none has been sought since** — every outcome of Amendments 2 and 3 is
builder-evidenced, cross-checked between agents, and explicitly NOT assured.
**Frontier:** see the ⚡ WORK CLASSIFICATION block in **Amendment 4** at the foot of this map. It is the
only live statement of the frontier; the "Warwick decision at the top of this map" named here was
settled by Amendment 1 on 2026-08-22, and the measurement task by Amendment 3.
**Last CareerAIR development activity: 2026-08-25** — this session. The "eight days idle by design"
recorded here was true of 2026-08-06 → 2026-08-14 and is history, not current state.
**Sources reconciled into this map:** the 2026-08-14 raw recovery
(`2026-08-14-careerair-state-recovery-RAW.md`) · `BACKLOG.md` C-10 · the seven public CareerAIR evidence
documents · the Proofline map's CareerAIR rows · the private tree's contracts, build record, `HELD-ITEMS`
and live runtime state.

---

# ⚑ AMENDMENT 1 — Warwick, 2026-08-22. **A PRODUCT DECISION THAT RESHAPES THIS BUILD.**

> **His words, quoted:**
>
> *"the issue has been trying to build detministic apps with no human in the loop - simple fact, ai is
> not there yet as 6 weeks of Asdair shows"*
>
> *"the brief in the other app is we work together and do the plumbing as we go, we don't set out to
> build an auto app."*
>
> *"for Careerair, the bit I want to be automated is the opportunity scanning but the CV creation and
> application we can absolutely do together on desktop in side panel."*

**This splits BUILD-016 in two, and the split is now the primary structure of the build.**

| Half | Disposition |
|---|---|
| **Opportunity scanning** — collection, extraction, dedupe, storage, surfacing | **AUTOMATED.** Runs without him and without a session. This is where unattended engineering effort belongs. |
| **CV creation and application** — fit discussion, tailoring, drafting, the package | **COLLABORATIVE, BY DECISION.** Done together, on desktop, in side panel. **NOT a pipeline, and not to be rebuilt as one.** |

## What this SUPERSEDES on this map — Larry's reading, labelled as such

**The 2026-08-14 frontier is retired.** It read *"The product works. NOTHING IN PRODUCTION CALLS IT"*
and named the next action as wiring one production event to `runJourney`. **That diagnosis was correct
and is now moot for the half it pointed at:** `runJourney` drives fit → draft → document, which is
precisely the half Warwick has ruled collaborative. **Wiring it to fire unattended is now the wrong
work.** The intake half of the same gap WAS closed on 2026-08-22 — see below.

**A problem recorded earlier today largely dissolves.** Larry flagged that the CareerAIR specialist
writes files while the pipeline's ledger, gates and QA chain never see them — *"two parallel truths"* —
and called it the thing blocking CareerAIR from being one system. **Under this ruling that matters far
less:** a ledger-backed, gate-enforced, QA-chained CV pipeline is machinery for an unattended path he
has just declined. The ledger still earns its place for **opportunity** state; it does not need to
govern a drafting conversation.

**`FR-23` needs re-reading, not deleting.** *"Larry is not the normal runtime operator"* still binds
the scanning half absolutely. It does **not** bind the CV half, where Warwick has now said the human is
the point.

**AC-01's *"without a manual session"* clause applies to SCANNING ONLY.** Applying it to drafting would
grade this build against a design its owner has rejected.

## What was delivered on 2026-08-22, against the half that stays automated

- **Gmail collector** — `src/email/gmail-collect.mjs`, `scripts/careerair-gmail-collect.mjs`. Reads
  forwarded job mail over IMAP with an app password. No Entra, no Zapier, no Microsoft admin surface,
  no session. Proven end to end on a real vacancy: collected, idempotent on re-run, drained by the
  existing processor.
- **The three dead routes, established by execution and recorded so they are not retried:** local
  Outlook COM (0-for-4, hangs), Microsoft Entra app registration (work tenant hijacks the personal
  account, `AADSTS90072`), paid Zapier (declined).
- **Intake precision defect found and dispatched** — one digest produced 22 opportunities of which 6
  were vacancies. Allow-list filter in flight.

## The cost note, recorded because Warwick raised it

> *"I've had great success with you last few days building apps away from mypka and all it's excessive
> governance and productivity prevention department."*

**Recorded as his assessment, not adjudicated here.** The measurable fact from this session: a
two-file link-filter change consumed **two full Work Order generation-and-CLARIFY cycles** before a
line was written. Both refusals caught something real — one would have shipped a silent regression
across five job boards. **Both things are true at once, and the map records both rather than picking
the flattering one.**

**The collaborative half does not carry Work Order ceremony.** Working together in session is the
route Warwick has chosen for it, and imposing dispatch machinery on a conversation would be the
"productivity prevention" he is naming.

---

# AMENDMENT 2 — session of 2026-08-23. **THE COLLABORATIVE HALF WAS BUILT AND IS WORKING.**

**Written at rotation. Branch `wo/2026-08-23-cockpit-grid`, closing head `724f19fa`, DELIBERATELY
UNPUSHED — see the privacy hold below.**

> **PRIVACY BOUNDARY ON THIS MAP.** This file is tracked in the PUBLIC repository and currently names
> **zero** employers, roles or opportunities. **Keep it that way.** Everything specific to the job
> search lives in the private store and is pointed at, never restated here. Authority:
> `CAREERAIR-PRIVACY-REALIGN-002`.

## ⚑ WORK CLASSIFICATION

| Class | Item |
|---|---|
| **FRONTIER** (exactly one) | **ACCEPT** — Warwick reads the tailored documents and decides which go out. The machinery is built, live and proven; the remaining act is his judgement, which is the design. |
| **NEXT** | **ADMIN — the public-repo privacy decision (C-P2).** Blocks pushing anything, so it gates the Git half of everything below. Options and recommendation are in the private findings file. |
| **NEXT** | **BUILD — render the tailored documents to .docx.** None has been opened the way a recipient receives it, so the page-fill rule is unmeasured on all of them. This is the last step before anything is sent. |
| **SIDECAR / NON-BLOCKING** | Two parallel implementations now serve this dataset to a cockpit and only one is canon — a reconciliation question, not a defect. · A dormant second proxy exists that would now be refused by the new boundary. · The canonical private runbook still carries the reasoning that caused the leak. |
| **PARKED — deliberate, not forgotten** | The acquisition receipt reports `content_verified: true` on **400 of 400** rows while **96** have zero extracted requirements. Recorded with measurements in the private baseline. **A control that passes 400 of 400 is not a control** — but it is a data-quality defect, not a safety one, and it is Warwick's to schedule. |
| **PARKED** | Model-API credits remain exhausted, so the fit gate cannot score. All scoring this session was hand-judged or rubric-applied and is labelled as such — **never as a gate verdict**. |
| **PARKED** | The collector is still not scheduled; the registration commands are recorded in the private baseline. |

## What was delivered, against BOTH halves

**The collaborative half — built, and it is the point of the session.** Four cluster base CVs and nine
tailored forks, produced by forking rather than rewriting. The discipline held and was measured: one
fork's entire content was **verbatim from its base with zero novel lines**, another changed four lines
and dropped two bullets. That is what makes volume honest rather than generative.

**The scanning half — a readable surface over it.** A single cockpit page, tailnet-only, showing every
live opportunity with score, source link and its tailored document where one exists. **Live and proven
through Warwick's own URL**, restarted via the scheduled task rather than a shell, so the configuration
arrives from the production start path and not from a session.

**A durable route file** now records how a fork is made, so the next session can produce more without
reconstructing the method from conversation.

## Assurance carried out this session

- **Internal, external to the builder:** a security review of the new route returned **GREEN**. It
  verified rather than accepted the builder's claims — mutation-testing the traversal control by
  *removing* it, and executing the renderer against a recording DOM rather than reading it.
- **The builder then falsified part of that review.** The suggested containment fix does not reach a
  hard link, because `realpath` does not resolve one. Established by execution, and a second defence
  shipped alongside the first.
- **A live privacy leak was found, escalated, fixed and proven closed** — before and after on one
  record, a full route sweep, and the product path verified unbroken. Detail is in the private
  findings file; **the specifics deliberately do not appear on this public map.**

## ⛔ Honest limits at this boundary

- **No Veritas gate has been taken on any of this.** The work is builder-evidenced and
  security-reviewed; it is **not** internally assured, and nothing here may be reported as PASS,
  complete or accepted. The recommended next assurance target, if one is wanted, is the live boundary
  plus its executable gate — which re-runs independently rather than being read back.
- **Nothing is pushed.** Two commits sit on a local branch by decision, not by accident.
- **No application has been sent, and no ledger row exists for any of them.** Four separate workers
  flagged that independently rather than improvising a write into an unverified path. **If a document
  goes out, the record is opened BEFORE the irreversible act.**

## SESSION REPORT POINTER — and what is OUTSTANDING ON ARRIVAL

**Report path (commissioned, may arrive AFTER the `/clear`):**
`Deliverables/2026-08-23-session-report-careerair-collaborative.md`
**Payload:** `Deliverables/2026-08-23-session-report-payload.json`
**Ledger, already committed and handed to Pax as an input:**
`Deliverables/2026-08-23-subagent-token-ledger-careerair-collaborative.md`

**Closing head at rotation:** the **tip of `wo/2026-08-23-cockpit-grid`**, deliberately unpushed.

> **Why this is named as a tip rather than a literal SHA, and it is not evasion.** A map that writes
> its own closing SHA is self-referential: committing the line moves the head it just claimed. That is
> exactly what happened at this rotation - the map said `38f3b6dc`, the commit carrying it produced
> `2bd2d06`, and the read-back check caught the mismatch. **The commit that carries THIS correction is
> the closing head**, and the continuity packet - which is written after the commit and can therefore
> name it truthfully - carries the literal SHA. **The packet is the place for a literal head; a map is
> not.** Ancestry for anyone reconstructing: `18634098` (grid) then `724f19fa` (security fixes) then
> `38f3b6d` (amendment 2 + ledger) then `2bd2d06` (report pointer) then this one.

**⚑ OUTSTANDING ON ARRIVAL — named, not silent.** Pax was commissioned for the session report and is
**NOT on the blocking path**; his return may legitimately outlive the `/clear`. **When it lands —
this session or the next — write it to `Deliverables/`, commit it, and run `populate.mjs` then
`capae-sync.mjs` from the same payload.** A commissioned worker whose return is never read is
unbanked work.

**Steps 7b and 7c are DEFERRED WITH THE REPORT, not skipped.** They consume the payload Pax produces,
so they cannot run before it exists. That is a sequencing fact, not a failure — but it means **this
rotation ends with Supabase NOT populated and the CAPAE record NOT updated for it.** Recorded here so
the next session finishes the transaction rather than discovering the gap.

---

# AMENDMENT 3 — session of 2026-08-23 into 2026-08-24. **THE GRID IS GRADED AND 38 DOCUMENTS ARE SENDABLE.**

> **PRIVACY BOUNDARY UNCHANGED, AND NOW EXPLICITLY RULED ON.** Warwick, 2026-08-24: *"so long as
> there is nothing identifiable in the public repo, I don't give a shit. the fact that careerair
> exists is neither here nor there."* Recorded against the contract it supersedes in
> `contracts/PRIVACY-DATA-MAP.md`. **The service name may appear here. No employer, role, recruiter,
> vacancy, salary or opportunity URL may.** This amendment names none.

## ⚑ WORK CLASSIFICATION

| Class | Item |
|---|---|
| **FRONTIER** (exactly one) | **ACCEPT — Warwick reads and sends.** 26 documents are SEND_AS_IS today. The machinery is finished; the remaining act is his. |
| **NEXT** | **12 documents held on ONE named question each.** Listed below. Each is a product decision, not a defect. |
| **NEXT** | **The collector runs at 16:50 daily but the ops health record cannot go green** — the thing that used to write it is disabled and the live route does not write it. A health record that can never report healthy is not a health record. |
| **SIDECAR / NON-BLOCKING** | The runtime projection of the master source is owed — nine dated 2026-08-23/24 entries read `projected_to: NOT PROJECTED`. Anything reading the DB projection instead of the file will not see Warwick's rulings. |
| **PARKED** | Model-API credits remain exhausted, so the runtime fit gate still cannot score. Everything in this pass was judged by dispatched specialists grounded on the master, and is labelled as such. |

## What is true now, established by execution

- **140 open opportunities, 119 closed, 76 discarded** with a stated reason each. Every closure came
  from the advert's own words, never from age.
- **140 of 140 are tier `full`** — real advert text behind every score. It was 116 at session start.
- **38 tailored documents, every one rendered to `.docx` AND `.pdf`, every one opened and measured**,
  all within Warwick's three-page rule. It was 9 documents at session start, **of which only 1 was
  actually renderable.**
- **All four cluster bases are corrected at source** — the repeated figure and the contract wording —
  so future forks inherit the fixes rather than reproducing them.

## The root cause worth carrying forward

`thin` was never a scoring problem. **A database trigger forbids requirement text on an opportunity
that has never been classified, and the intake pipeline had classified only 190 of 688.** 102 live rows
were structurally incapable of holding the evidence the tier reads. No amount of careful reading could
have fixed it. Classifying them was the fix.

## ⚑ THE TWELVE OPEN QUESTIONS — each blocks exactly one document

1. **Full driving licence** — stated requirement on one role, absent from the evidence base. Nobody
   will write it without him, correctly.
2. **One advert's closing date has passed.** Document ready. Send anyway or discard.
3. **One advert says DO NOT send a CV** — it wants a LinkedIn profile plus a self-made artefact. Route
   decision.
4. **One is a people-leadership role and the headline still says Consultant.** Re-cutting a headline is
   re-drafting, so it was recommended and not done.
5. **One requires six-month rotations across two continents.** He ruled "potentially, don't rule it
   out", so it stays live — but he should see the shape before sending.
6. **⛔ TWO DOCUMENTS USE THE PERSONAL AGENTIC-AI EVIDENCE, AND THE RECORD SAYS HE NEVER SAID "I
   APPROVE" TO THAT BLOCK.** The master entry was written on Larry's reading of "do it" and says so.
   **This is a claims-provenance question on documents about to reach real employers, and it is the one
   on this list that should be settled first.**
7. **`121 staff` appears twice in every document** — the same repeated-figure pattern he had cut for
   another figure. He named only that one, so the rule was not extended for him.
8. **10 of 38 word the contract figure differently from the other 28.** Neither breaches his ruling;
   they are simply not identical across documents going to one market.
9. **Two roles carry an Associate seniority signal.** On one it is only a metadata dropdown and the
   body asks for no years at all; on the other the body itself says "looking to further their career".
   Different weights, same decision shape.
10. **One document was forked from a base another agent judged wrong for it.** Defensible either way.
11. **One opportunity now has two candidate documents** — an older one the grid could not see, with a
    substantial assessment behind it that may hold judgement worth keeping.
12. **One base's fork guidance cannot be executed as written** without minting a connective the base
    does not supply. A base defect to fix once, not per document.

## Honest limits at this boundary

- **No Veritas gate on any of it.** Builder-evidenced and cross-checked between agents; **not**
  internally assured. Nothing here may be reported as PASS, complete or accepted.
- **No application has been sent, no employer contacted, and the application ledger still holds ZERO
  rows.** Warwick's own rule is that the record opens BEFORE the irreversible act. It has not.
- **Four separate agents independently refused instructions from their own dispatch** when those
  instructions contradicted a banked Warwick ruling. In one case Larry had written the wrong
  instruction into a shared spec that five agents read; it would have put a forbidden phrasing into up
  to 31 documents. **The refusals are why it reached nothing.** Recorded in the master as Larry's
  error, dated, and explicitly not attributed to Warwick.

---

# ⚑ AMENDMENT 4 — session of 2026-08-25. **ACTIVE SESSION WORK PACKAGE, authorised by Warwick.**

> **Privacy boundary unchanged** and as ruled on 2026-08-24: the service name may appear here; no
> employer, role, recruiter, vacancy, salary or opportunity URL may. This amendment names none.

## ⚑ WORK CLASSIFICATION

| Class | Item |
|---|---|
| **FRONTIER** (exactly one) | **BUILD — the pre-send application record.** Warwick's own rule is that the ledger opens BEFORE the irreversible act, and it holds zero rows. Nothing may be sent until it does. |
| **NEXT** | **REMEDIATE — the ops health record cannot report healthy.** `collector_state` can only be set `up` by `touchContact()`, and the live daily route is not calling it. |
| **NEXT** | **ADMIN — convergence.** 19 commits (plus this session's) have never reached `main`. The assurance route is owed over the whole boundary, not a bare merge. |
| **NEXT** | **ACCEPT — the browser ops session.** Warwick works the opportunity cockpit with Larry in the side panel, LinkedIn open alongside. Requested for immediately after the three items above. |
| **SIDECAR / NON-BLOCKING** | The runtime projection of the master source is still owed — nine 2026-08-23/24 entries read `projected_to: NOT PROJECTED`. |
| **PARKED** | Model-API credits exhausted; the runtime fit gate still cannot score. Unchanged from Amendment 3. |
| **PARKED** | **The twelve open questions of Amendment 3.** Warwick did not take them this session. They are HIS decision queue and remain open — not deferred by Larry, not closed. |

## ACTIVE SESSION WORK PACKAGE — Warwick, 2026-08-25

**His words, quoted:** *"Do these three … Close the ledger gap first — build the pre-send record so
nothing goes out unrecorded … Fix the ops health record so collector liveness is honest again … Take
the 19 commits to main — they've been sitting unmerged since the 23rd, and that needs the assurance
route, not just a merge. Then I want to work through the Ops with you in the side panel browser, I have
opened linked in, open opportunities cockpit in seperate tab when you are ready."*

### Acceptance criteria — functional, numbered

1. **A pre-send application record exists and is written by the real production event.** A row in
   `careerair.application` is created BEFORE any document leaves, carrying the opportunity, the attempt,
   the state, and the exact version pointer that will be submitted. Capability alone does not satisfy
   this — see § "Nothing may live only in Larry's head" in `CLAUDE.md`.
2. **The record cannot be bypassed.** Sending without a prior row is not merely discouraged; the route
   that sends has no path that skips it.
3. **`collector_state` can reach `up` from the live route**, established by execution, and can also
   truthfully report `down` when the collector genuinely is. A health record that can only ever say one
   thing is not a health record — and the fix must not be to make it always say `up`.
4. **The deliberate `graph_auth_required` mute is preserved.** It is muted ON PURPOSE and its unmute
   instructions stay intact. Fixing liveness must not silently clear a truthful incident.
5. **The branch converges to `main` through the assurance route** — Veritas Gate 1 on the boundary,
   then Codex at the PR, then Warwick's merge decision. Not a bare merge.

### Larry's reading, labelled as Larry's and NOT attributed to Warwick

- Warwick said "the 19 commits". Items 1 and 2 land on the same branch, so the boundary assured is the
  19 **plus this session's work** — one boundary, one gate, rather than gating twice an hour apart.
  Stated to him at the time of acceptance; he did not object, and he did not explicitly rule on it.
- The browser ops session is **ACCEPT-class work with Warwick present**. It is not engineering and does
  not need a gate. It must not be allowed to become the apparent frontier of the build.

### Residuals on arrival — carried, not hidden

- **No Veritas gate exists on ANY of Amendment 3's work.** 38 documents are builder-evidenced only.
- **Zero applications sent, zero employer contact.** Unchanged and correct.
- The twelve open questions, above, remain Warwick's.


## ⚑ AMENDMENT 4a — item 2 built, and the ONE thing that is not yet true

**WO-2026-08-25-02 returned PARTIAL, and PARTIAL is the correct verdict, not a shortfall.**

**PASS:** AC2 (the `down` direction, proven at six clock positions with an exact boundary and **two mutations
made to go red**), AC3 (the deliberate `graph_auth_required` mute preserved — sha256 identical before and
after), AC4 (recommendation only; no scheduled task touched), AC5 (secret scan exit 0, 79 files).

**The diagnosis in the Work Order was WRONG and was corrected by the worker before any file was written.**
Larry wrote *"nothing writes `up`, therefore `collector_state` can never leave `down`"*. It left `down` on
2026-08-23 at 11:33 via the webhook, and was stamped back at 21:50 the same evening by the Graph collector
— which was **still running on the 23rd**. Larry had read scheduled-task trigger `StartBoundary` values as
disable dates. The real defect was **three writers sharing one last-writer-wins field with no provider
attribution**, and patching Gmail to call the same function would have reproduced it wearing a new hat.

### ⛔ ON THE FRONTIER UNTIL THE REAL EVENT — do not mark this done

**AC1 is PARTIAL by design.** `collect()` records provider-scoped liveness, proven over an **injected
in-memory IMAP transport against a temp ops file**. That is capability. It is **not** completed automation
(`CLAUDE.md` § "Nothing may live only in Larry's head"), and the worker labelled it so rather than letting
the limit sit beside the verdict as a caveat.

**THE ACCEPTANCE TEST, NAMED SO IT CANNOT DECAY INTO A HABIT:**

> **After the next scheduled `CareerAIR-Gmail-Collect` run (16:50 daily), read
> `C:/.fusion247/private/careerair/runtime/ops/state.json` and confirm `collectors.gmail` was written BY
> THAT RUN — a fresh `last_run_at` and `last_success_at`, with `active_collector: "gmail"`.**
>
> Until that is observed, this outcome is **NOT** complete and must not be reported as such. If it does not
> happen, the wiring is wrong and the residual below is the first place to look.

**The live record was never written during the build** — md5 `53c66809d2a718a92efbc360510875e5` before the
first edit and after the last command.

### Residuals carried, none blocking

- **The wrapper's failure paths cannot record `down`.** `CANNOT START` and `NOT CONNECTED` are decided in
  `scripts/careerair-gmail-collect.mjs`, outside the declared surface, before `collect()` is reached.
  Staleness catches it within 26h. A follow-up Work Order is recommended; **Warwick decides whether it is
  raised** — a reported finding is an observation, not an instruction.
- **The legacy writers still stamp the shared field directly** (`endpoint.mjs`, `graph-collect.mjs`,
  `ops-liveness.mjs`). Live exposure is nil while Graph-Collect is Disabled; **re-enabling it without
  migrating those call sites would restore the 2026-08-23 stomp.**
- **`CareerAIR-Ops-Liveness` must NOT be re-enabled as it stands** — it derives `collector_state` from local
  webhook reachability on 8787, a different subsystem, twice an hour. The mute holds correctly; the problem
  is the stamping, not the alerting.
- **Larry owns one reconciliation:** `src/cockpit/server.mjs:360` reads `ops.collector_state`, whose values
  are unchanged but whose **meaning** is now "the active collector's liveness" rather than "whatever wrote
  last". Recommendation on the table is that the cockpit move to `collectors.gmail`.

**No Veritas gate on any of this.** Builder self-test evidence only, and labelled as such by the builder.


---

# ⚑ AMENDMENT 5 — session of 2026-08-25 into 2026-08-26. **FOURTEEN SENT, AND THE FRONT DOOR DIAGNOSED.**

> **Privacy boundary unchanged.** The service name may appear here; no employer, role, recruiter,
> vacancy, salary or opportunity URL may. This amendment names none.

## ⚑ WORK CLASSIFICATION

| Class | Item |
|---|---|
| **FRONTIER** (exactly one) | **ACCEPT — read the ops rows after the next scheduled email run.** The intake wiring is BUILT-NOT-VERIFIED and stays on the frontier until a real run produces acquisition rows. |
| **NEXT** | **PRODUCT-DECISION — the CV-Library link class.** Destinations are opaque ciphertext; only a network request resolves them. Needs Warwick's authority to reverse a deliberate no-network policy. |
| **NEXT** | **PRODUCT-DECISION — `content_verified` persistence.** 336 rows across 156 opportunities assert it falsely. Data-model decision; Silas's to design, Warwick's to authorise. |
| **NEXT** | **ADMIN — convergence.** The branch is still unmerged and PR #116 is still correctly a draft. |
| **SIDECAR / NON-BLOCKING** | 29 unsent documents still carry the third-person profile. No rejected headline survives anywhere. |
| **PARKED** | Model-API credits; the runtime fit gate still cannot score. |

## What happened, established by execution

**FOURTEEN applications submitted** in one collaborative session, every one verified by reading the
employer's confirmation off the page rather than on assumption, and every one recorded with what actually
went out. **TEN adverts were found dead before effort was wasted on them. THREE were abandoned on stated
requirements Warwick does not meet** — one of which he spotted before the form did.

Full record, including all six of Warwick's rulings quoted as his:
`C:/.fusion247/private/careerair/runtime/applications/APPLICATION-LOG-2026-08-25.md` — **private tree, and
it must stay there.** It names employers, roles, salaries and opportunity URLs.

## ⛔ THE FRONT DOOR — two causes, neither what anyone assumed

**Neither was an extraction bug**, which is what Larry would have guessed and deliberately did not write
into the Work Order.

- **A 19-role email produced ZERO rows because the destination is not in the link.** Every candidate sits
  behind a click-tracker whose path segment is **encrypted** — 0 of 68 decoded to printable ASCII, 185
  distinct byte values in 304 bytes. Only a network request can resolve it, and the extractor is
  deliberately no-network. **This recurs on every send from that source until a resolver exists.**
- **Three empty rows because THE EMAIL PATH NEVER ACQUIRED.** Link extraction worked perfectly. There
  were **zero acquisition rows anywhere in the whole window** — the runner is called from three other
  paths and never from email. **The second half of the front door had never been wired.**
- **A third defect nobody was looking for:** the acquirer fetched adverts, verified them, recorded
  `content_verified: true`, extracted fields **and discarded the text**. The flag means "read once inside
  a process", not "durably held".

**Fixed and mutation-proven:** a silent drop where the link accounting was built and then thrown away one
call later, producing an arithmetically impossible durable record indistinguishable from an empty email.

**Wired and construct-proven, NOT run:** acquisition into the email path.

## ⛔ ACCEPTANCE TESTS OWED — named so they cannot decay into habits

1. **After the next scheduled 16:50 collector run:** read the ops record and confirm `collectors.gmail`
   was written BY THAT RUN. Until observed, the liveness fix is capability, not automation.
2. **After the next scheduled email run:** query `opportunity_acquisition` for opportunities that run
   created. Non-null rows with stored content = fixed. **Nothing there = still broken.**

**Neither may be marked done on the strength of a green test or a successful construction.**

## CI

`cockpit-private-apps` had failed on every commit for four days. Cause: an attribute added to a template
div broke a full-literal anchor. **A third of that gate had been DARK, not merely red** — seven mutations,
a false-positive control, a dirty check and a clean-control run had not executed since. Re-derived,
mutation-proven three ways, **and CI is now green on the pushed head.**

## Honest limits at this boundary

- **No Veritas gate on ANY of this session's work.** Builder-evidenced throughout, and labelled so by the
  builders themselves. Nothing here may be reported as PASS, complete or accepted.
- **Larry passed on an unverified negative twice** — a substring grep read as an anchor match, and a
  claim that no raw email payload existed when the bodies were in the database all along. Both were
  caught by workers who checked rather than inherited.

---

# ⚑ AMENDMENT 6 — Warwick, 2026-08-28. **THE LANGUAGE. A PRODUCT DECISION, BINDING.**

> **His words, verbatim, 2026-08-28:**
>
> *"we also need to change the language. an opportunity is something that meets the qualification
> criteria to apply for, once applied for it becomes an application.*
>
> *anything that comes in raw is not yet qualified is a prospect."*

**This is now the ONLY correct vocabulary for BUILD-016. It is canonical here and every other surface
points at it.** Larry's consequent record-keeping is below the quoted ruling and is labelled as
Larry's — none of it is attributed to Warwick.

## THE THREE TERMS

| Term | Definition | When it becomes the next thing |
|---|---|---|
| **PROSPECT** | Anything that has arrived RAW and is **not yet qualified**. A job-alert subject line, an unread advert, a link someone sent. It may be junk. Most of it is. | When it is qualified against the criteria. |
| **OPPORTUNITY** | A prospect that **meets the qualification criteria to apply for**. It has earned Warwick's attention. | When it is applied for. |
| **APPLICATION** | An opportunity that **has been applied for**. | — |

**A prospect is not an opportunity. Calling one an opportunity is a lie about how much work has been
done to it, and it is exactly the lie the current system tells.**

## ⛔ WHAT THIS MAKES FALSE — Larry's assessment, recorded 2026-08-28

**The estate currently calls EVERYTHING an opportunity from the moment it arrives.** Measured tonight:

- `careerair.opportunity` holds **695 rows**. Under the new language, **the overwhelming majority are
  PROSPECTS**, not opportunities — 429 are already `intake_status='discarded'`, i.e. they never
  qualified at all.
- The CareerAIRbot card says *"N new opportunities"* on arrival. **Under this ruling that line is
  false on its face** — nothing has been qualified at that point. It should read **prospects**.
- `email_message.outcome = 'new-opportunity'` is likewise mis-named at the point it is written.

**This is why 62 emails produced a card saying nothing useful.** The word "opportunity" was doing the
work of three different states, so the card could never tell Warwick which one he was looking at.

## THE MAPPING — Larry's, for implementation. Not Warwick's words.

| Today | Becomes |
|---|---|
| `opportunity` row at intake, `intake_status='captured'`, never scored | **prospect** |
| `opportunity` row that has passed the fit gate / qualification criteria | **opportunity** |
| a row in the application log with a `submitted_at` | **application** |
| card line *"N new opportunities"* | *"N new prospects"* |
| card line for qualified items (does not exist yet) | *"N new opportunities"* — **this is the line that is worth reading** |

## ⚠ NOT DONE YET, AND NAMED SO IT CANNOT DECAY INTO A HABIT

**Larry has changed the LANGUAGE here. He has NOT yet changed the CODE, the SCHEMA or the CARD.**

- The database still names its table `careerair.opportunity` and still writes `new-opportunity`.
- The CareerAIRbot card still says *"new opportunities"* for unqualified arrivals.
- **A rename of a live table while a pipeline is running is how data is lost.** It is owed as a
  proper forward-only migration plus a code change, not a find-and-replace tonight.

**Until that lands, every human-facing report — Larry's included — uses the NEW words even where the
column names still use the old ones.** A report that says "695 opportunities" is wrong from now on.
The truthful sentence is "695 prospects, of which a small number ever qualified".

---

# ⚑ AMENDMENT 7 — Warwick, 2026-08-29. **RECALL BEATS PRECISION. THE GATE STOPS BEING A BIN.**

> **His words, verbatim:**
>
> *"I am NOT trying to create the perfect auto prospect system and now we have cleared the backlog,
> I'd much rather a prospect was scored to high and became an opportunity than scored to low and
> binned and me never see it, this was the original mistake until we both went manual intervention.*
>
> *we can use the rubric and the API but they were developed when this was supposed to be a Larry
> less autonomous app, that's not what this is anymore.*
>
> *I care most that I know I'm not missing opportunities, that quality personalised CVs are written
> for applications and that nothing is missed."*

**This supersedes the design intent of the fit gate and of WO-2026-08-29-01 as issued.** Larry's
consequent reasoning is below the quote and is labelled as Larry's.

## ⛔ THE RULING

1. **NOTHING IS BINNED.** A prospect that scores low is still shown. **The score is a SORT ORDER and
   a SUMMARY, never a filter.** The `>=7` rule keeps its meaning as *"this one is worth your
   attention first"* — it stops meaning *"discard the rest"*.
2. **Asymmetric error preference, stated by him:** a prospect scored TOO HIGH and promoted is
   **acceptable**. A prospect scored TOO LOW and never seen is **the original mistake**. Where the
   gate is uncertain, it errs UP.
3. **The autonomy premise is withdrawn.** The rubric and the model gateway were built for a
   Larry-less autonomous product. **That is not what this is.** Warwick works the application stage
   with Larry. The machinery has to be trustworthy up to *"here is everything, best first"* — not up
   to *"I have decided what you do not need to see."*
4. **The three things that matter, in his order:**
   **(a) he is not missing opportunities · (b) quality personalised CVs are written for applications
   · (c) nothing is missed.**

## What this makes FALSE — Larry's assessment

- **The acceptance property of WO-2026-08-29-01 as issued is wrong.** It said items below 7 are
  *"recorded and NOT surfaced — Warwick should never see a raw prospect."* **That is now the
  defect, not the feature.** It is re-cut.
- **The evidence-projection debt stops being a blocker.** `careerair.evidence` holds 105 rows,
  newest **2026-07-30** — so the whole AI build estate is missing from what the gate reads. Under a
  filtering gate that silently under-scored every AI role. Under a ranking gate it only mis-ORDERS
  them, and Warwick still sees them. **Still worth fixing for accuracy. No longer gates the build.**
- **The missing knockout band stops being a blocker too, and changes shape.** Rubrik scored 8/10
  while requiring fluent French. Under a filter that is a false positive to be suppressed. **Under
  a ranking board it is a FLAG printed beside the role** — *"requires fluent French"* — and Warwick
  decides in two seconds. **A blocker is DISPLAYED, never used to hide a row.**
- **The known uncapped 10/10** (an advert declaring no essentials, so `CAPS.essential_gaps` has
  nothing to bite on) is tolerable rather than urgent. It over-scores. Over-scoring is now the
  acceptable direction.
- **Degraded scoring is LABELLED, not prevented.** Two silent fallbacks exist today — `reason()`
  routes to the box model when no gateway is configured, and `buildRequirements` sets
  `degraded = true` and returns requirements anyway. Under the old design those were dangerous
  because a degraded score could silently bin a role. **Under this ruling they must simply be
  visible: the row says the score is degraded and stays on the board.**

## ⛔ WHAT STILL MUST NOT HAPPEN

**"Show everything" is NOT "show a count".** The failure of 2026-08-26 and 2026-08-28 was a card
saying *"8 needs your review"* and *"62 needs your review"*. **A number is not a list.** The output
must NAME employer, role, score and blockers, ranked. Recall without legibility is the same defect
wearing a different hat.

**And nothing here weakens the claims controls.** Over-scoring a prospect is acceptable.
Over-claiming on a CV is not, and never becomes so.
