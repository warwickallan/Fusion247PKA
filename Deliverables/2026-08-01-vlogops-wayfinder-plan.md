# VlogOps — the plan, before any building

_Wayfinder planning trial, 2026-08-01. **Planning only. Nothing has been built and nothing will be until you accept this.**_

---

## What this is, and why it looks short

This is the first proper use of Wayfinder since the BUILD-018 post-mortem. Wayfinder is a
**planning** tool: it exists to clear up genuine uncertainty about a route, and it **stops the
moment the route is clear**. BUILD-018 went wrong because it was used as an execution
tracker — 26 tickets governing a whole build, when its own rule says a ticket should resolve a
*decision*, not a piece of work.

So this document is deliberately small. It maps only what is genuinely unclear. Where the way
is already obvious, there is nothing to map and I have said so rather than padding it out.

---

## The destination, as I understand it

**VlogOps is how a build session becomes something you publish.** You do the work, the work
gets recorded, and a script comes out the other end — evidence-led, in your voice, telling the
story of what actually happened.

The pieces that exist today:

- **The raw material is already there.** 64 session logs from July alone, each one a
  structured account of a real session — what was attempted, what broke, what fixed it. This
  is exactly the "goal → failure → diagnosis → fix → proof" shape the scriptwriting method
  asks for.
- **The method exists** — `VlogOps Doc → 12 — Larry Scriptwriting Playbook` in ClickUp.
- **The approval chain exists and is settled:** I draft → GPT edits or challenges → Fable does
  factual/publication QA → **you approve, render and publish.** I am never publication
  authority, and rendering/uploading/publishing autonomously is prohibited outright.
- **The Daily Flight Recorder exists** — curated source material, explicitly never the script
  itself.

**What does not exist:** any VlogOps build, ticket, PRD or idea in this repository. Nothing has
been started. This would be new work.

---

## The fog — what is genuinely unclear

Three things, and only one of them is really about VlogOps.

### F1 — I cannot read the canonical method from here. *(blocking, and only you can clear it)*

The Scriptwriting Playbook and the Flight Recorder definition live in **ClickUp**, and the
ClickUp connector is **not available in this session**. My own operating contract says to read
the playbook *fresh on every drafting run* and explicitly forbids copying it into this repo —
so I cannot work around this by caching it.

This is the single biggest thing standing between here and a real plan. Everything below is
provisional until it is cleared.

**Options:** reconnect the ClickUp connector · paste the playbook in once so I can plan against
it (without copying it into the repo) · or accept a plan that treats the method as a black box.

### F2 — "Daily Editorial Handoff" has no definition anywhere. *(needs one sentence from you)*

The term appears once in my own operating contract, in a VlogOps context. A previous session
searched for a definition and found none; that is still true. Something is named as part of
this operation that nobody has ever written down.

It may be obsolete, or it may be the missing link between the Flight Recorder and a draft. One
sentence from you settles it — or "drop it", which is equally fine.

### F3 — What is the actual bottleneck? *(the real product question)*

This is the one that decides whether there is a build here at all.

"Prepare VlogOps" could reasonably mean any of these, and they lead to completely different
work:

| If the bottleneck is… | …then the work is |
|---|---|
| **Raw material** — sessions happen but nothing captures the story-worthy bits | Automate the Flight Recorder from session logs |
| **Drafting** — material exists but turning it into a script is slow | Build the drafting pipeline against the playbook |
| **The review loop** — drafts exist but GPT/Fable/approval is manual and fiddly | Build the approval chain plumbing |
| **Nothing is broken** — you just want it *started* | Draft one script from a real session and see what breaks |

I have a recommendation, below. But this is a product decision and it is yours.

---

## My recommendation

**Start with the last row: draft one real script, end to end, and learn from it.**

The reasoning is the lesson BUILD-018 taught at considerable cost. I do not actually know where
the bottleneck is — I have never run this pipeline once. Building automation for a bottleneck I
have inferred rather than observed is exactly how BUILD-018 produced 22 modules for a problem
that turned out to be six answers on a screen.

One real script, produced by hand through the existing approval chain, using one of the 64
session logs already sitting there, would tell us more in an afternoon than a planning exercise
would in a week. It needs no new code and nothing to merge. And it makes F3 answerable from
evidence instead of guesswork.

Concretely: BUILD-018 itself is the obvious candidate. It has the exact narrative shape the
method asks for — a confident start, a real failure, an adversarial diagnosis that overruled
me on two points, and a proven fix. That story is true, it is documented, and it is finished.

---

## Where this stops

The route is clear enough to stop mapping. There is **no map to chart** here yet, because the
one decision that would shape it (F3) is yours, and the one fact that would ground it (F1) is
not reachable from this session.

Charting further would be inventing structure to look thorough. That is precisely the failure
this trial exists to avoid.

**Nothing will be built until you accept a plan.** What I need from you:

1. **F3 — where is the bottleneck?** Or "just draft one and find out", which is my recommendation.
2. **F1 — how should I get at the playbook?** Reconnect ClickUp, paste it once, or plan around it.
3. **F2 — what is the Daily Editorial Handoff?** One sentence, or "drop it".

---

## Honest notes on the trial itself

- **Wayfinder's own rule was applied, including the part that says don't use it.** Its trigger
  test is: if surfacing the uncertainty shows the way is already clear, *do not chart a map*.
  Two of the three fog items here cannot be cleared by research at all — one needs a connector,
  one needs a sentence from you. That is a stop, not a mapping exercise.
- **Wayfinder is authorised for this trial only**, planning-only, and nothing outside VlogOps
  adopts it on the strength of it.
- **This document is the deliverable.** No code, no tickets, no programme, no branch.
