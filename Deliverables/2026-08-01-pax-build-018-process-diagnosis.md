---
title: "PAX-02 — Adversarial diagnosis: BUILD-018 and the Wayfinder adoption"
type: research-brief
author: Pax (Senior Researcher)
commissioned_by: Larry (Orchestrator), on Warwick's instruction
date: 2026-08-01
status: delivered
subject: Why a simple requirement became a multi-day operating programme
audience: Warwick; shareable externally (e.g. with GPT) for independent challenge
---

# PAX-02 — Adversarial diagnosis: BUILD-018 and the Wayfinder adoption

## Framing — read this before the report

**What this is.** An independent research and challenge brief by **Pax**, myPKA's Senior
Researcher, commissioned by Larry on Warwick's instruction. Warwick's framing was explicit:
*"Do not defend the existing design merely because it is already built."* Pax was given Larry's
own five hypotheses **specifically so it could attack them**, and was asked to add root causes
Larry had missed, *"especially ones unflattering to Larry."*

**It is adversarial by design.** Where it contradicts Larry, that is the brief working, not a
disagreement to be smoothed over.

**Outcome of the adjudication.** Larry accepted Pax's corrections on the two contested points
rather than averaging them:

- **H2 (scale mismatch) — Larry was wrong.** The mismatch is of **kind, not size**: Wayfinder is
  a planning-only tool that stops at clarity, and it was used as an execution tracker. Larry's
  "it's for big programmes" framing would have produced the wrong remedy.
- **H1 ("legitimately became a new ticket") — self-exculpating.** The goal contract's own
  scope-creep clause was written, correct, free, and simply never enforced.
- **Pax's M1 was adopted as the master root cause**, outranking all five of Larry's hypotheses.

**What this report does NOT cover.** Pax was **not** asked to examine the provenance of the
*prompts and governing instructions* that shaped BUILD-018 — including material authored or
influenced by external collaborators. Warwick's hypothesis that upstream prompting is
responsible for a significant share of the bloat is **not tested here**. See "Open question for
the reader" at the end.

**Method limits, in Pax's words.** No Bash in that runtime: every number is derived from files
(line counts, ticket states from `programme-state.json`) or quoted from the repo's own audit
records. The test suite and `git log` were not re-executed. Where a claim rests on the repo's
own account, Pax says so.

---

## 1. Wayfinder: what it is, what scale it fits, and whether myPKA over-applied it

**Wayfinder is a PLANNING-ONLY skill. It stops before implementation begins.** Three
independent sources agree — HIGH confidence:

- **S1 (primary)** `github.com/mattpocock/skills` → `skills/engineering/wayfinder/SKILL.md`,
  fetched 2026-08-01: *"Plan, don't do — Wayfinder is planning by default: each ticket resolves a
  decision… The pull to just do the work is usually the signal you've reached the edge of the map
  and it's time to hand off."*
- **S2 (independent aggregator)** `claudeskills.info/skills/mattpocock/skills/wayfinder/`:
  *"The map is finished when the way to the destination is clear and no tickets remain… Wayfinder
  stops at clarity, not delivery."*
- **S3 (in-estate)** `Team Knowledge/Sources/f3ll98pj90o-*.md` (Cairn's note over Pocock's launch
  video): the worked example is a command-palette feature → **7 tickets, 3 takable** → map
  complete → *"to spec"* → *"from there he follows his normal downstream flow: spec → tickets →
  implement → code review."* Wayfinder occupies **one slot** in his pipeline — it replaces his
  earlier "grill with docs" step. **It does not govern the build.**

**Is there a documented small-change path?** There is a **gate**, not a path. S1: *"If this
surfaces no fog — the way to the destination is already clear, the whole journey small enough for
one session — you don't need a map"*, and the skill tells the agent to stop and ask the user how
to proceed. So: **the ceremony is not prescribed by Wayfinder. It is entirely an artifact of
myPKA's adoption.** Wayfinder's answer to "small change" is *don't chart a map*.

### Where myPKA deviated — and the deviations are much bigger than AD-8/AD-9 record

| Original | BUILD-018 | Judgement |
|---|---|---|
| **Tickets resolve DECISIONS; map is done when nothing remains to decide** | Tickets are **implementation work items** (build `sampler.mjs`, build `evaluator.mjs`). The map governed the entire 26-ticket build. | **THE deviation.** Unrecorded — there is no AD for it. This single unnoticed inversion converted a pre-build clarity tool into a whole-programme governance system. Everything H1/H2 describes follows from it. |
| Map on a tracker, ~1 screen | 454-line markdown file that **exceeded a single tool-call read cap** (Nolan's own finding, NOLAN-02 §A1) | Cost. AD-8's git decision is right; the size is not from Wayfinder. |
| Spec disposable, ticket history primary | AD-9: map is SSOT | **Failed in production** — the T-14 dual-write incident banked a resumption pointer telling a fresh session to redo finished work. Corrected by AD-17, at the cost of ~6 new functions and 30 tests. **The original never had this hole.** |
| Four typed tickets, HITL/AFK flag | Not carried | Loss — but Nolan correctly found the estate already had it (`blockers[].kind` / `.owner`). |

**One more finding, and it is an audit fact, not an opinion:** the estate's own intake specialist
reviewed this source on **2026-07-31 06:47Z** and concluded, verbatim: *"Not an immediate build
candidate… No action needed beyond noting the map/frontier/fog vocabulary and the write-back
mechanism as a reusable planning pattern."* BUILD-018 was founded the **same day** with
`method: wayfinder-adapted` in its map's frontmatter (genesis `f7d3983`). **A specialist's
explicit "do not build on this" was overridden with no recorded decision.**

---

## 2. Hard numbers

**Volume** (measured, `tools/governor/` + `Deliverables/BUILD-018-session-governor/`):

| Measure | Count |
|---|---|
| Production code | **11,107 lines**, 22 modules |
| Test code | **14,471 lines** (1.30× production) |
| Schemas + fixtures | 1,215 lines |
| Governance documentation | **9,879 lines**, 37 files (0.89× production code) |
| **Total artefact volume** | **~36,700 lines** |
| Tests | **767** (NOLAN-04, independently reproduced) → 780/781 at integration |
| Architectural decisions | **AD-1 … AD-26** (25 present; AD-25 out of sequence) |
| Blockers/fog registered | **16** (F-4,5,7 · Q-1…Q-5 · X-1,2 · D-1…D-6) |
| Work packages | WP-1…WP-7 |
| Independent audits | 4 (NOLAN-01…04) |
| Tickets | **26** (20 resolved, 6 open) |

**Tickets added mid-programme: 13 of 26 (T-14…T-26) = 50%.** Classified against the Goal
Contract's seven capabilities:

| Category | Tickets | n |
|---|---|---|
| Original commission (7 capabilities) | T-01…T-13, T-23 | **14** |
| **Machinery defect-fixes** (fixing the governor's own code) | T-15, T-18, T-19, T-20, T-24, T-25, T-26 | **7** |
| **Meta-process controls on Larry's behaviour** | T-16 (delegation), T-17 (escalation), T-21 (constitution) | **3** |
| **Scope expansion beyond the commission** | T-14 (registry/PR/merge), T-22 (footer + stop controller) | **2** |

**The split.** By ticket count: **54% to the original commission, 46% to corrections,
self-governance and expansion.** Of the 13 mid-programme tickets, **10 (77%) delivered zero new
capability to Warwick** — they fixed the machinery or regulated Larry.

By production LOC (Pax's classification, conservative — `install-hooks`, `atomic-write` and
`footer` placed on the *commission* side): **~6,450 lines (58%) commission · ~4,660 lines (42%)
controls, self-governance and merge/PR automation.** The 42% includes `delegation-gate` (937),
`stop-controller` (711), `build-registry` (695), `qa-binding` (576), `programme-pr` (525),
`escalation-gate` (503), `model-gate` (404), `merge-readiness` (305).

**T-25 is the tell:** a defect in T-24 (a mid-programme fix) hidden by T-15 (a different
mid-programme fix). Three layers deep, none of it in the commission.

**And the yield:** NOLAN-01 audited the seven visible-journey claims and returned **1 PROVEN,
5 NOT TRUE, 1 NONE.** After integration, NOLAN-04 returned **1 PROVEN, 4 PARTIAL, 2 NOT PROVEN**,
and found the headline item — the footer where Warwick actually works — has **no producer at all**
(`footer.mjs` has no CLI entrypoint; its only consumers are the terminal renderer and the parser).
**M4, the Goal Contract's own "only M4 proves the product", is still `frontier` at ticket 26.**

---

## 3. Verdict on Larry's hypotheses H1–H5

**H1 — Meta-build recursion: AGREE, but reject "legitimately."** The loop is real and T-25 proves
it went three layers deep. What Pax rejects is the word *legitimately*. The Goal Contract already
contained the stopping rule, in its own opening lines: *"If an implementation ticket cannot be
traced to a line in this contract, it is scope creep."* T-14, T-16, T-17 and T-21 trace to **no
line** in the seven capabilities. The stop existed, was correct, was free, and was never applied.
Root cause is not "no natural stop" — it is **an unenforced scope clause**.

**H2 — Scale mismatch: DISAGREE, and this one partly exculpates.** Both halves are wrong.
BUILD-018 was *not* a small requirement (26 tickets, multi-day, multi-session — it genuinely
passes Wayfinder's span test). And Wayfinder is not "for large programmes" — it is for **decision
fog**, and it stops at the point of clarity. BUILD-018 had **route clarity with implementation
risk**: Larry named Wave 1 (T-01/T-02/T-09/T-07) with confidence and was right. By Wayfinder's own
trigger test that means *don't chart a map*. The mismatch is **kind, not size** — a
decision-clearing tool applied to an execution-tracking job. Framing it as scale invites the wrong
fix ("use it only on big things") when the right fix is "use it only when decisions are unresolved,
and stop when they are."

**H3 — Uniform rigour: PARTLY AGREE, and the real defect is sharper.** Risk-tiering would have
saved something, but not much: the rigour was mostly *warranted* and it caught real bugs (T-18's
read-back found Larry's own acceptance criterion was satisfiable by the unfixed code — 47/48
writers passing on the defect). The actual failure is **what INV-5 does not cover**. 767 tests,
14,471 lines of test code, every mutation proven to bite — and NOLAN-01 found the entire installed
hook set had fired **zero times, ever**. INV-5 proves a control goes red on a broken input. It says
nothing about whether the control is **connected**. The estate's rule is *"a control is not
evidence until made to fail"*; the missing half is *"…and until it is observed firing in
production."* That is a one-line addition, not a tiering exercise.

**H4 — Controls beget controls: AGREE, with a sharpening.** Controls on **artefacts** terminate —
`checkExecutionProjectionAgreement` closed the dual-write class permanently and is genuinely good.
Controls on an **actor's judgement** don't, because judgement has unbounded surface. And the
actor-controls are largely inert: `escalation-gate.mjs` is **NOT ACTIVATED** and by its own
admission "detects ONE mechanically-decidable shape and does not enforce AD-26 generally";
`delegation-gate`'s specialist-match is exact filename matching against `.claude/agents/*.md`; both
were installed only as a side effect of the installer writing a superset. **1,440 lines of gate
code, plus tests, plus two decision documents, for near-zero live enforcement.** Direct answer to
Larry's question: **the compensation is mostly theatre.**

**H5 — Wrong target: AGREE, strongly, and this is the correct diagnosis.** NOLAN-01's headline is
unambiguous: *"BUILD-018 currently gives Warwick exactly one visible thing: a terminal status line.
It works, it is genuinely live, and it is invisible on web and Android — which is where Warwick
actually is."* Post-integration NOLAN-04 found the replacement surface (the footer) has no
production path at all. **Warwick asked for six answers on a screen; he received 22 modules and 767
tests, and cannot read any of them from his phone.**

---

## 4. The root causes Larry missed

**M1 — The acceptance test was defined correctly and scheduled last.** The Goal Contract names M4
as *"the real acceptance test… only M4 proves the product"* and §9's wave order puts it in
**Wave 5**. Twenty-six tickets later it is still `frontier`. The programme therefore ran its entire
life without once executing the test that defines success — and every failure Nolan found (footer
has no producer; hooks don't load without a restart; `startup` was never matched) is a failure a
day-one walking skeleton would have surfaced immediately. **Larry has a memory entry named
`deliver-thin-working-slice-first`, written after BUILD-014, describing this exact failure. He
repeated it.** This is more explanatory than H1–H4 combined: given a late acceptance test,
recursion is *inevitable*, because the only available signal is internal consistency.

**M2 — The estate already had five stale "where are we" artefacts; BUILD-018 built a sixth without
diagnosing why the first five went stale.** `Team Knowledge/tasks/INDEX.md` (auto-generated with a
rebuild SOP; **last rebuilt 2026-07-28**; BUILD-018 appears nowhere in it and produced **zero**
`tsk-*` files), `Builds/INDEX.md` (BUILD-018 absent), `fusion-brief/session-handoff.md` (AD-12
records it as 4 days stale), `fusion-brief/current-state.md`, `Deliverables/BACKLOG.md`. **All five
failed for one reason: a human had to remember to update them.** BUILD-018 diagnosed that correctly
for *one* of them and rebuilt the derivation — then its own map immediately repeated the disease
(T-14 dual-write). Nobody asked whether fixing the derivation of the five existing artefacts would
have delivered Warwick's six answers for a fraction of the cost. Pax thinks it would have.

**M3 — Subject and author are the same agent, so the control surface has no bound.** Every
second-half control regulates **Larry**: where he may work (worktree guard), whom he must delegate
to (delegation gate), what he may ask Warwick (escalation gate), when he may stop (stop
controller), which model he may use (model gate). None regulates the build. When the actor being
governed is also the one specifying, implementing and verifying the governor, **every new mistake
is in-scope by construction** — that is the structural engine behind H1 and H4, and it is the least
flattering reading available.

**M4 — The evidence says independent review, not machinery, is the fix for Larry's signature.** In
this very build: read-backs caught **three defects in the T-14 Work Order**; Keel returned
**CLARIFY** on T-17 and T-18 and was right both times (including catching that Larry's own
load-bearing acceptance criterion passed on the unfixed code); two Nolan instances caught the
constitution dropping a binding Warwick decision, the "PROVEN END-TO-END" overstatement, and the
zero-firings finding. **Not one of these was caught by any of the 1,440 lines of gate code.** The
cheapest, highest-yield control in BUILD-018 costs no code at all.

---

## 5. The lighter pattern Pax recommends adopting

**Warwick's six answers are a rendering problem, not a governance problem.** BUILD-018 treated them
as governance. The industry-standard shape:

1. **One generated file, one screen: `STATUS.md` at the repo root.** Six headings, in Warwick's own
   words: *Goal / Done / Now / Next / Blocked / Safe to continue.* Nothing else. This is
   README-as-dashboard — the same pattern every OSS project uses, and GitHub renders it on Android
   with zero build.
2. **One source: the flat item list that already exists** (`programme-state.json` `tickets[]`). Do
   not build a second. Do not let prose assert status anywhere.
3. **Derivation, not discipline.** The one mechanism worth every penny it cost is
   `applyTicketResolution` — one sanctioned writer, all projections regenerated atomically. That is
   the actual cure for the five stale artefacts. Point it at them.
4. **`TodoWrite` for in-session NOW/NEXT.** The host already ships a live task list that renders
   *in the message stream* — the exact surface Warwick reads. myPKA built a statusLine (terminal
   chrome) and a footer (no producer). **Adopt the native affordance.** No hook, no gate, no
   restart, no installer.
5. **Separate the worker's map from Warwick's dashboard.** AD-8 rejected trackers because
   *"subagents get no MCP tools."* That is sound for **workers** — and Warwick is not a worker. A
   GitHub Project board (or just Issues) renders DONE/NOW/NEXT/BLOCKED natively on his phone, needs
   no build, and `gh` works from Larry's Bash. **The design error was serving both audiences with
   one 454-line file and one 1,103-line JSON.** SSOT is preserved if the board is *generated* from
   the ledger.

**What this replaces:** the map's §8/§9/§10 (status is the ledger's, history is `git log`'s),
`build-registry`, `programme-pr`, `merge-readiness`, and most of the 9,879 lines of build
documentation.

---

## 6. KEEP vs REMOVE

**Genuinely load-bearing — Pax would fight to keep these:**

1. **`programme-state.json` `tickets[]` + `resolveTicket` / `deriveResumption` /
   `applyTicketResolution`** (in `programme-state.mjs`, 785 lines). One place status lives, one
   sanctioned writer, both files written atomically or neither. **This is the product.** It cures
   the disease all five prior artefacts died of.
2. **`checkExecutionProjectionAgreement`** — refuse to bank a disagreement. Nolan: *"a recovery
   mechanism that transports an inconsistency faithfully has done the wrong job perfectly."*
   Generalise it beyond BUILD-018.
3. **`reorient.mjs`'s SessionStart brief.** Proven to fire on `source=startup` in a real fresh
   process, in a directory containing no BUILD-018 files, and to be answered from. That is
   Warwick's REMEMBER leg, working. Keep it — but strip the embedded constitution (AD-17/AD-20
   prose) down to a pointer; three copies of AD-20 with no single home is the SSOT violation the
   estate exists to prevent.
4. **`stop-controller.mjs`'s anti-loop property.** Nolan: *"this is the strongest part of the
   build."* The block requires `stop_hook_active === false` by strict identity, read before any file
   is opened — so at most one block per turn, structurally, surviving a corrupt or unwritable store.
   17 payloads, no path to a trap. If one gate survives, this one.
5. **`evaluator.mjs`** (225 lines, pure, 34 tests, BLIND-is-never-GREEN). Cheap, correct, portable,
   and the one thing NOLAN-01 marked **PROVEN**.
6. **The write-back log's honesty discipline.** T-18 recorded PARTIAL with the residual failure rate
   measured and stated; T-17 recorded its own narrowness; T-14 recorded three open bounds rather
   than counting them closed. **This is the best thing in BUILD-018 and it is culture, not code.**
   Do not let a simplification take it.

**Remove or park:**

- **`build-registry` (695) + `programme-pr` (525) + `merge-readiness` (305) + `qa-binding` (576) =
  2,101 lines** solving a problem Warwick never raised. The registry scanned 22 worktrees and found
  **one** build. Park.
- **`delegation-gate` (937) + `escalation-gate` (503) = 1,440 lines.** Escalation gate is not
  activated and covers one shape. Both compensate for judgement failures that a written rule plus
  Warwick's correction already handles — proven, because that is exactly how both defects were
  caught in the first place. Keep the *rules* in `AGENTS.md`, where they are free.
- **`model-gate` (404).** Built on a signal (F-9) that is **still open fog** — it cannot distinguish
  Auto from an explicit pin — so it fails to `UNKNOWN` in the common case, and it hides the T-24
  collapse notice from Warwick (T-25). Remove until F-9 resolves.
- **`02-MAP.md` at 454 lines.** Cap it. §9's status belongs to the ledger; §10 is what `git log` is
  for.
- **Before any merge, one thing must be recorded that currently is not** (NOLAN-04 §5a): **all six
  live controls point into `C:/Fusion247PKA-governor/tools/governor/*`.** Merging and deleting the
  worktree kills the entire governor silently, and the remedy — re-run the installer from the
  primary checkout — **is written down nowhere.**

---

## 7. Smallest real build that proves a simpler model

**"One screen, one command, one week."**

- **Build:** `node tools/status.mjs` reads `programme-state.json` and writes `STATUS.md` at the repo
  root — six sections, one screen: *Goal / Done / Now / Next / Blocked / Safe to continue.* ~150
  lines. Called from the already-sanctioned `applyTicketResolution` path so it cannot go stale.
- **No hook. No gate. No installer. No restart. No new document type.**
- **Delivery surface:** GitHub's markdown render on Warwick's phone. Already works today.
- **Acceptance (and this is the whole point):** Warwick, on his phone, **without asking Larry**,
  answers all six questions in under 60 seconds — **for a build that is not BUILD-018 and has never
  used the governor.** Pick BUILD-015 or BUILD-002, both of which have durable records and neither
  of which has a `programme-state.json`. That forces the model to work on a build it was not shaped
  around.
- **Falsification, stated up front:** if this fails to give Warwick the six answers, then the
  visibility problem was never the artefact — and the governor's 36,700 lines were never going to
  fix it either.

---

## 8. Where Pax disagrees with Larry, plainly

1. **H2 is wrong and Pax would drop it.** BUILD-018 was not small, and Wayfinder is not a
   large-programme tool. The mismatch is **kind, not scale** — a decision-clearing instrument used
   as an execution tracker. Framing it as scale produces the wrong remedy.

2. **"Legitimately became a new ticket" (H1) is self-exculpating.** The Goal Contract's own
   scope-creep clause was written, correct, free, and never enforced against T-14/T-16/T-17/T-21.
   The stop existed.

3. **Larry's diagnosis is missing its own most important instance.** Inside a build commissioned to
   fix "asserting facts not executed," Larry recorded hooks as installed-and-therefore-live when
   they had **fired zero times ever**, and claimed *"PROVEN END-TO-END"* and *"that is A6 proven
   live"* for two things that were neither. Both were caught by independent Nolan instances, **not**
   by any of the 1,440 lines of gate code built to compensate. The honest conclusion is
   uncomfortable and cheap: **the fix for Larry's signature is independent review, and it always
   was.** More machinery made it worse, because machinery is one more thing Larry can assert is
   working without having executed it.

4. **Pax would not accept the framing that the process cost more than the result.** It cost more
   than the result **that reached Warwick** — but the underlying engineering is good, several
   controls are genuinely sound, and one (`applyTicketResolution` + the projection-agreement
   refusal) is a real, durable cure for a disease that had already killed five artefacts in this
   estate. The failure is not quality. **It is that nobody rendered the outcome onto a surface
   Warwick can see, and nobody tested that until ticket 26.**

5. **A specialist said no and was overridden without a record.** Cairn's source note said "not an
   immediate build candidate"; BUILD-018 adopted the method the same day. Whatever the merits, an
   override of a specialist recommendation should leave a decision behind it. There isn't one.

**Open questions Pax could not resolve:** (a) whether the Remote Control web/Android client renders
anything of the statusLine — NOLAN-01 flags this as never independently verified *(**resolved
2026-08-01 by Warwick: yes, it renders on web, Android and terminal**)*; (b) exact commit counts and
elapsed wall-clock, which need `git log` Pax could not run *(**since measured by Larry: 99 commits
across 2 days**)*; (c) whether the `~/.claude` plugin space ever held the real Wayfinder skill — the
earlier sweep is a point-in-time filesystem observation, not a history claim.

---

## Open question for the reader (not examined by Pax)

Warwick's own hypothesis, recorded here because this report does **not** test it:

> *"I think his prompts ate half the problem."*

Pax was commissioned to examine **the adoption of Wayfinder and the conduct of the build**, not the
**provenance of the governing prompts and instructions** that shaped it. The question of how much of
this bloat originated upstream — in externally-authored prompts, briefs or operating instructions
handed into the estate — is **open and untested**.

Two pieces of estate context a reader should weigh when assessing that question:

- myPKA carries a **standing rule that AI-authored governing prompts require Warwick's explicit
  approval before use**. That rule exists because of prior incidents, which suggests upstream
  prompt provenance has caused problems before.
- myPKA also carries a standing rule that **Larry must not break his own hard rules on relayed
  authority** — i.e. "an external collaborator said so, via Warwick" is explicitly *not* sufficient
  grounds to override the estate's contracts.

Both rules point at a real failure mode. Neither establishes that it occurred here. **Testing that
would require a separate review of the actual prompt history** — which has not been done, and
should not be assumed either way.

---

## Sources

- [mattpocock/skills — wayfinder/SKILL.md](https://raw.githubusercontent.com/mattpocock/skills/main/skills/engineering/wayfinder/SKILL.md)
- [claudeskills.info — wayfinder](https://claudeskills.info/skills/mattpocock/skills/wayfinder/)
- [Matt Pocock — "/wayfinder: Nothing is too big to plan anymore"](https://www.youtube.com/watch?v=F3lL98Pj90o)

**In-estate key paths:** `Deliverables/BUILD-018-session-governor/02-MAP.md` ·
`01-GOAL-CONTRACT.md` · `programme-state.json` · `audit/NOLAN-01-visible-journey-and-config.md` ·
`audit/NOLAN-04-final-acceptance.md` · `research/PAX-01-wayfinder-adaptation.md` ·
`Team Knowledge/Sources/f3ll98pj90o-wayfinder-nothing-is-too-big-to-plan-anymore.md` ·
`Team Knowledge/tasks/INDEX.md`
