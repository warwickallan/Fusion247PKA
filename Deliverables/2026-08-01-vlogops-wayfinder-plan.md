# VlogOps — the plan, before any building

> # ⛔ SUPERSEDED AS EXECUTION GUIDANCE — 2026-08-03
>
> **Do not follow this document. It is history.**
>
> This is the 2026-08-01 *"draft one script and see what happens"* planning trial. It **predates** the Foundry boundary decision of 2026-08-02 and the accepted IDEA-006 Goal Contract, and it plans a **manual scripting exercise** rather than the durable publishing engine BUILD-006 actually is.
>
> **The live route is `Deliverables/2026-08-03-build-006-vlogops-publishing-engine-wayfinder-plan.md`.**
>
> **Retained, not deleted.** It holds real thinking and the record of how the approach changed — including a correction where I asserted something did not exist without having looked hard enough. Deleting that would remove the evidence of the lesson. **A fresh Larry finding this file must treat it as history and open the BUILD-006 map instead.**

_Wayfinder planning trial, 2026-08-01. **Planning only. Nothing has been built and nothing will be until you accept this.**_

> **Revised the same day.** The first version of this document claimed the method was
> unreachable and that "Daily Editorial Handoff" had no definition anywhere. A follow-up
> search proved **both claims wrong**. Corrections are marked below rather than quietly
> patched — asserting something does not exist, when I had not looked hard enough, is the
> exact failure mode this estate has a standing rule against.

---

## What this is, and why it looks short

This is the first proper use of Wayfinder since the BUILD-018 post-mortem. Wayfinder is a
**planning** tool: it clears up genuine uncertainty about a route and **stops the moment the
route is clear**. BUILD-018 went wrong because it was used as an execution tracker — 26 tickets
governing a whole build, when its own rule says a ticket should resolve a *decision*.

So this maps only what is genuinely unclear. Where the way is already obvious there is nothing
to map, and I have said so rather than padding it out.

---

## What VlogOps actually is

**A build session becomes something you publish.** You do the work, the work is recorded, and a
script comes out — evidence-led, in your voice, telling the story of what actually happened.

**Nothing in this repository defines VlogOps in the abstract.** But one complete episode *was*
produced, and its record survives — on an unmerged branch, which is why I missed it first time
(`git show 84f22d8:"Team Knowledge/session-logs/2026/07/2026-07-15-12-55_larry_memory-checkpoints-and-first-script.md"`).
That single log is the most valuable VlogOps artefact in the estate, because it shows the real
method in operation rather than describing it:

- **Evidence window gathered first** — previous checkpoint, the day's Flight Recorders, PRs and
  their SHAs, Build Log entries, device transcripts.
- **Output shape** — ~1,230 spoken words, 8–9 minutes, five beats, with a full source register
  *and an explicit list of exclusions*.
- **Filed as** `VLOG-2026-07-15 — Fusion Health: The Dashboard Episode — LARRY FIRST DRAFT — UNAPPROVED`.
- **GPT returned PASS-WITH-NOTES with scores** — story/structure 9/10, voice 8/10, evidence
  9/10, and **privacy comprehension 2/10**: the draft had declared your body readings
  "classified", inverting your actual standing rule. Four corrections applied, second draft filed.

That failure is the most instructive thing in the whole record. The pipeline's weak point was
not story or voice — it was **getting your data-sensitivity rules backwards**, and only a
review pass caught it.

**What already exists to build on:** the raw material is genuinely there — 64 session logs from
July alone, and every close-session entry is *already required* to carry a `## VlogOps / story
signals` section. TubeAIR, the Sources pipeline and the Cockpit are live. The Brain is built but
unmerged.

**What does not exist:** any VlogOps build, ticket, PRD or idea. It has been explicitly out of
scope everywhere it appears. This would be new work.

---

## The fog — what is genuinely unclear

### ~~F1 — the method is unreachable~~ → **mostly cleared, correction**

The canonical `12 — Larry Scriptwriting Playbook` does live in ClickUp and the connector is
unavailable here — and my contract forbids caching it into the repo. But I was wrong that this
blocks planning. The recovered episode log gives the evidence window, the output shape, the
filing convention, the review dimensions and a worked failure. **That is enough to plan
against.** What ClickUp still holds exclusively is the *fine detail* of the playbook and the
`00A — Warwick Data Sensitivity & Publication Authority` rules — and 00A matters more than the
playbook does, because it is the thing the one real run got wrong.

**Residual:** I'd need 00A at drafting time, not at planning time. Not blocking now.

### ~~F2 — "Daily Editorial Handoff" is undefined~~ → **partially defined, correction**

A definition does exist, in root `AGENTS.md:186`:

> "Close-session checkpoints are a named VlogOps evidence stream (alongside the Daily Flight
> Recorder, GitHub commits/PRs/CI, ClickUp Build Logs, editorial context, and approved media).
> **Several checkpoints may feed one Daily Editorial Handoff; a checkpoint never itself
> authorises publication.**"

So it is an **aggregation point** — many session checkpoints converge into one handoff, and it
sits on the publication path without being publication authority. What is still missing: what it
contains, who produces it, and whether "daily" is real or aspirational. Smaller than I said, and
possibly not blocking at all.

### F3 — What is the actual bottleneck? *(the real question, and it is yours)*

This decides whether there is a build here at all. Four readings, four different builds:

| If the bottleneck is… | …then the work is |
|---|---|
| **Raw material** — the story-worthy bits aren't captured | Automate the Flight Recorder from session logs |
| **Drafting** — material exists, turning it into a script is slow | Build the drafting pipeline against the playbook |
| **The review loop** — GPT/Fable/approval is manual and fiddly | Build the approval-chain plumbing |
| **Nothing is broken** — you just want it started | Draft one script from a real session and see what breaks |

Pax reached the same place independently during BUILD-018 and put it more sharply than I would
have: *"a Build Contract requires a known outcome, and VlogOps' outcome is a matter of editorial
taste that only Warwick holds."* And the named risk: **"editorial scope creep is the
characteristic VlogOps risk."**

---

## My recommendation

**Draft one real script, end to end, and learn from it.** Unchanged by the corrections above —
and now better supported, because we have a worked example to follow rather than a blank page.

The reasoning is the lesson BUILD-018 taught expensively. I have never run this pipeline. The
one time it *was* run, the thing that broke was not the part anyone would have predicted — it
was privacy comprehension, and no amount of upfront planning would have surfaced that. Building
automation for a bottleneck I have inferred rather than observed is precisely how BUILD-018
produced 22 modules for a six-answer problem.

One script, by hand, through the existing approval chain, from one of the 64 logs already
sitting there. No new code, nothing to merge. It makes F3 answerable from evidence.

**BUILD-018 itself is the obvious subject.** Confident start, real failure, an adversarial
diagnosis that overruled me on two points, a proven fix, and a measured outcome. That story is
true, documented, and finished.

---

## Where this stops

The route to a *decision* is clear, so the mapping stops here. There is no map to chart, because
the one thing that would shape it (F3) is an editorial judgement only you hold. Charting further
would be inventing structure to look thorough — the exact failure this trial exists to avoid.

**Nothing will be built until you accept a plan.** What I need:

1. **F3 — where is the bottleneck?** Or "just draft one and find out" — my recommendation.
2. **If drafting:** I'll need `00A — Warwick Data Sensitivity & Publication Authority` at
   drafting time. Reconnect ClickUp, or paste it once.
3. **F2 — is the Daily Editorial Handoff still a live concept,** or historical? Low stakes.

---

## Honest notes

- **I got two things wrong in the first version of this document and both were negative claims.**
  I said a definition didn't exist and that a method was unreachable, when I had searched
  narrowly. Corrected above, in the open.
- **Wayfinder's own trigger test was applied, including the half that says don't use it.** With
  F1 and F2 now largely cleared, the remaining uncertainty is a single product decision — which
  is a stop, not a mapping exercise.
- **Wayfinder is authorised for this trial only**, planning-only. Nothing outside VlogOps adopts
  it on the strength of it.
- **Two stale facts noticed in passing, not fixed** (out of scope, logged here so they aren't
  lost): `Builds/INDEX.md` still says BUILD-002's live proof is pending — it passed on
  2026-07-17. And the only end-to-end VlogOps record sits on an unmerged branch where it is
  effectively invisible.
- **This document is the deliverable.** No code, no tickets, no programme, no branch.
