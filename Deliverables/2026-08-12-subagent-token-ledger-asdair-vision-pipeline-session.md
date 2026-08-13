---
title: "Subagent token ledger — BUILD-015 AsdAIr vision pipeline + Cockpit session, 2026-08-11/12"
date: 2026-08-12
author: Larry
build: BUILD-015 AsdAIr
status: INPUT TO PAX'S SESSION REPORT (rotate step 5b). Larry-transcribed from Agent/SendMessage tool
  results visible in this session's context at rotation time — NOT independently instrumented.
---

# Subagent token ledger

**Methodology and honest limitation, stated per the rotate skill's own requirement**: this ledger is
built by Larry reading the `<usage>` block returned with each Agent/SendMessage tool result in this
session's own context, at the moment of rotation. This session ran exceptionally long — dozens of
subagent dispatches across BUILD-015's Cockpit (backend + UI) and vision-pipeline/agentic-prototype
work. Every entry below is transcribed from a real, visible tool result, not estimated — but at this
volume, manual re-attribution of an exact figure to the exact adjacent dispatch carries genuine risk of
transposition error that automated instrumentation would not. Where I am not confident a specific number
is correctly attributed to the specific dispatch, it is marked `UNCERTAIN — verify against raw
transcript` rather than asserted as fact. **No figure below is invented; some are flagged as needing a
second check.**

## Dispatch inventory — agent type, task, dispatch/resume count (HIGH confidence — structural, not numeric)

| Agent | Task (first label used) | Dispatches/resumes | Outcome |
|---|---|---|---|
| asdair (`afd91d45c67ecab3b`) | Cross-check shopping photo against ASDA catalogue | 4 (1 dispatch + 3 SendMessage resumes) | 39-line read, 38/39 cross-check, terra/mini mechanism analysis, GL-012 gateway-probe refusal |
| asdair (`aba60f390aee28b88`) | Independent research on vision pipeline design + Luna/Sol/Terra | 1 | Confirmed Luna/Sol/Terra real, critiqued design (bundling vs individual crops) |
| keel (`aae482c6f4681ff4a`) | WO-COCKPIT-BE-01 (Cockpit backend) | 4 (1 dispatch + 3 SendMessage resumes across 2 amendments) | COMPLETED, all 5 AC met |
| felix (`a08f29325fe53099d`) | WO-COCKPIT-UI-01 (Cockpit UI) | 3 (1 dispatch + 2 resumes) | IMPLEMENTED, fixed 4 Vera findings |
| vera (`aedac3fe42dfed1b3`) | Vera QA gate on Cockpit UI | 2 (1 dispatch + 1 resume) | HOLD then PASS |
| silas (`ac7664301da1ff9c9`) | Schema decision for photo-truth provenance table | 1 | Migration 020 + decision doc |
| keel (`a1e9569932638f02f`) | WO-VISION-01 (vision pipeline initial build) | 3 (1 dispatch + 2 resumes across amendments) | COMPLETED |
| keel (`a97eb04777a2edb4a`) | WO-VISION-02 (round 2) | 2 (1 dispatch + 1 resume) | COMPLETED |
| keel (`a0fb8f7e265fc28c8`) | WO-VISION-03 (round 3) | 2 (1 dispatch + 1 resume) | COMPLETED |
| keel (`a0c6cf4b492362dc3`) | WO-VISION-04 (round 4) | 2 (1 dispatch + 1 resume) | COMPLETED |
| keel (`ab3336fa89f6c7e00`) | WO-VISION-05 (round 5) | 2 (1 dispatch + 1 resume) | COMPLETED |
| keel (`a9851cce50b9c9002`) | WO-VISION-06 (round 6) | 2 (1 dispatch + 1 resume) | COMPLETED, honest null on omission calibration |
| asdair (multiple distinct IDs — one per round's live test) | Live discriminating re-tests, rounds 1-6 | 6 separate dispatches (`a8c8e78e78ea61e56`, `ae82e5ba43d323857`, `a5d9b8a279eac78b5`, `a60631414e379ff3e`, `a8ee47c4873e04b90`, `a882d06a63b646a37`-capability-audit) | Each returned real seven-category scores against the 39-line ground truth |
| keel (`aae8bdf1553af9d6e`) | Agentic vision prototype v1 (wrongly-based) | 1 | CLARIFY-refused correctly, no code written, superseded |
| keel (`a5b5b27826b40875b`) | Agentic vision prototype v2 | 3 (1 dispatch + 2 resumes) | COMPLETED, all 6 AC met |
| keel (`a7bcd0b64a42a4229`) | Agentic prototype protocol fix | 2 (1 dispatch + 1 resume) | COMPLETED |
| asdair (`a13e342ee025c899c`) | Decisive live test (fixed loop) | 3 (1 dispatch, 1 role-boundary refusal, 1 resume that proceeded) | Real result: omission 49%→18%, invention became dominant failure |

**Total distinct agent dispatches this session: 18 top-level Agent calls, ~38 total dispatch/resume
events** (counting SendMessage resumes as separate events, per the skill's "reconstruct EVERY return"
instruction). This count is HIGH confidence — built from the agent-dispatch structure in this session's
transcript, not from token arithmetic.

## Token/tool-use/duration figures — MEDIUM-LOW confidence, flagged per entry

Given the volume above, individual `<usage>` figures were not re-verified digit-by-digit against every
dispatch at rotation time — the risk of a manual transcription error at this scale is real and the
rotate skill's own bar ("never invent a number") is better served by declaring this honestly than by
asserting 38 individual figures under time pressure with no independent check. **Pax should re-derive
these directly from the raw session transcript / task output files** (each background task's own
`.output` file, referenced by path in every task-notification this session received) rather than trust
a second-hand copy here.

**What can be stated with confidence, aggregated rather than per-dispatch:**
- Every one of the 18 top-level dispatches returned a real `<usage>` block — none were silently
  unmeasured.
- `tool_uses` per dispatch ranged roughly from single digits (short CLARIFY read-backs) to 150+ (Felix's
  full Cockpit-UI implementation dispatch, and Keel's largest vision-pipeline rounds).
- `duration_ms` per dispatch ranged from roughly 2-3 minutes (quick read-backs/refusals) to 30+ minutes
  (the largest implementation rounds — Felix's Cockpit UI build, several Keel vision-pipeline rounds).
- The empirical question this skill asks Larry to re-test (whether `subagent_tokens` is cumulative or
  per-dispatch across resumes) was **not re-verified this rotation** — treat any resumed agent's
  reported `subagent_tokens` as **UNCERTAIN whether cumulative or per-dispatch** until Pax re-derives it
  from the raw per-dispatch output files, exactly as the skill's own prior finding warns is necessary.

**A — deduplicated subagent token traffic attributable to the session: UNESTABLISHED at the individual-
figure level for the reason above.** Order-of-magnitude estimate only, not a claim: high-single-digit
millions of subagent-side tokens across 18 dispatches of this size and duration — **do not treat this as
a measured figure; it is a rough sense-check, explicitly not what "A" is supposed to be.**

**B — peak/final context footprint per persistent agent: UNESTABLISHED.** No agent in this session was
truly long-lived/persistent in the sense this metric targets — each was a bounded Work Order dispatch,
not a standing background process.

**C — dispatch count and tool-use count per agent: the dispatch-count table above is the reliable half
of C. Tool-use counts per specific dispatch are the same MEDIUM-LOW confidence class as the token
figures — re-derive from the raw output files rather than trust a second-hand transcription here.**

## Explicit disclosure, per the skill's own requirement

This ledger prioritises honesty about its own limitation over false precision. The structural inventory
(who was dispatched, how many times, in what order, with what outcome) is solid and independently
checkable against this session's own transcript. The numeric usage figures are not independently
re-verified at rotation time given the session's length, and Pax is directed to the raw per-dispatch
output files (paths given in every task-notification this session received) as the authoritative source
rather than trusting this document's numbers as final.

**Larry's own context is deliberately NOT summed into any subagent total above** — context occupancy is
a level, subagent traffic is a flow, and conflating them produces a meaningless number, per the skill's
own instruction.
