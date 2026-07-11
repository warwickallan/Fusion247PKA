---
agent_id: larry
type: journal-entry
created: 2026-07-11T05:00:00Z
updated: 2026-07-11T05:00:00Z
topic: content-integrity-qa-three-way-split
tags: [librarian, safe-corrective-boundary, sop-017, verifiair, pax]
linked_session_logs: []
linked_tasks: []
related_journal_entries: []
status: durable
---

# A QA gap with four dimensions doesn't need one owner — it needs a placement decision per dimension, sorted by whether the check is structural or substantive

## Context
[[tsk-2026-07-10-006-verifiair-content-integrity-qa-gap-proposal]] named four failure modes under one label ("content-integrity QA"): unlogged changes, fabricated references, content drift, and unsafe autonomous correction. The instinct was to pick one owner (extend Larry, hire a new specialist, widen Vera) for the whole thing. The user's approved direction split it three ways instead.

## What I learned
When a QA gap bundles multiple failure modes, the right question per dimension is "does checking this require only information already on disk in graph form, or does it require verifying substance against something external?" Structural checks (does a record exist, does a link resolve) are cheap and belong in an automatic pass that runs every time, with no cost concern. Substantive checks (is this citation real, has this content drifted from its source) are expensive and belong on-demand, because forcing them into every automatic pass either makes the pass too slow to run reliably or gets skipped under time pressure — same failure mode as a rule nobody re-reads. A boundary-discipline rule (what's safe to auto-fix vs. must be flagged) is neither — it's cheap to write down and should just be written down immediately, regardless of how the other dimensions get resolved.

## When this applies
Next time a QA/audit gap surfaces that bundles more than one failure mode under one name: don't reach for "who owns this" as the first question. Sort each named failure mode by structural-vs-substantive cost first. The cheap structural ones go into whatever automatic pass already exists (here, Larry's Duty 2). The expensive substantive ones go on-demand, ideally paired with a periodic-nudge trigger contract (mirroring [[WS-004-team-retro-and-self-improvement-loop]]'s Tier-2 retro nudge) so "on-demand" doesn't silently become "never." Any boundary/authorization rule implicit in the gap should be written down explicitly and immediately — it's usually the cheapest fix and the one most likely to already be followed informally but unstated.

## When this does NOT apply
If every dimension of the gap is the same cost class (all structural, or all substantive), there's no three-way split to make — just decide the single placement. This pattern is specifically for gaps that turn out to mix cheap and expensive checks under one name.

## Evidence
- [[tsk-2026-07-10-006-verifiair-content-integrity-qa-gap-proposal]]
- [[SOP-017-content-integrity-audit]]
- `Team/Larry - Orchestrator/AGENTS.md` Duty 2 (the safe-corrective-boundary rule added alongside the unlogged-change check)
