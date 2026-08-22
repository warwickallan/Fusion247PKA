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

## 🔴 THE NEW FRONTIER — derived from that evidence

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

**Phase:** BUILD-016 Phase 1, Application Engine. **Gate:** the only verdict is **Veritas Gate 1 FAIL** at
`0cf70c9`, on absent capability. **No PASS exists.**
**Frontier:** the Warwick decision at the top of this map, then the measurement task.
**Last CareerAIR development activity: 2026-08-06** — commit `bd11f96`. **Eight days idle by design**,
parked deliberately, not drifted.
**Sources reconciled into this map:** the 2026-08-14 raw recovery
(`2026-08-14-careerair-state-recovery-RAW.md`) · `BACKLOG.md` C-10 · the seven public CareerAIR evidence
documents · the Proofline map's CareerAIR rows · the private tree's contracts, build record, `HELD-ITEMS`
and live runtime state.
