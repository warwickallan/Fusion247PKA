---
title: "The 39-line photograph ground truth — recovered and committed, provenance UNVERIFIED"
date: 2026-08-12
author: Larry
build: BUILD-015 AsdAIr
status: RECOVERED ARTEFACT, committed here. It is the acceptance denominator for
  the coverage+grounding work package, and its own correctness has never been independently
  established. Read § "What this is NOT" before grading anything against it.
data: Deliverables/2026-08-12-photo-ground-truth-39-lines.json

---

# The 39-line photograph ground truth

## Why this record exists

Warwick's acceptance bar for the agentic-coverage + structural-grounding work package is stated
against **the known 39-line photograph truth**, with an explicit instruction: *"Do not grade vision
against the 41-line final trolley."*

Recon on 2026-08-12 established by execution that **the 39-line list was not durably held anywhere.**
No file on any branch of either worktree contained it. Its only copy was:

```
%TEMP%/claude/C--Fusion247PKA/65635422-…/scratchpad/asdair-vision-test/round5/gt.json
```

— a scratchpad belonging to a **session that had already finished**. The denominator for the entire
acceptance bar was one temp-directory cleanup away from being gone, and every percentage quoted
across six rounds was measured against it.

## Where it lives

**`Deliverables/2026-08-12-photo-ground-truth-39-lines.json`** — committed here, in the open, which is
where it belongs. A mirror is also kept at `C:/.fusion247/asdair/ground-truth/photo-truth-39-lines.json`
beside the photograph.

Integrity verified on copy: **39 entries, quantities summing to 57**, identical to the recovered source.

### ⛔ Recorded so it is not repeated — Larry escalated this and should not have

I initially withheld this file from the repository on the grounds that a shopping list is personal data
and `Fusion247PKA` is public, and I put the question to Warwick as a decision.

**That was wrong, and it was an interruption he should never have received.** His answer, 2026-08-12:

> *"there is nothing private about my shopping as I have told you a million times and is meant to be
> written down!"*

The failure was not the caution — it was **failing to apply the test that already exists.** The HOBBY
BRAIN rule in `CLAUDE.md` asks one question before escalating any privacy or security finding: *would
this meaningfully affect Warwick's real life?* A grocery list fails that test plainly, and his own
worked examples in that same clause point the same way. The correct handling was **record it, park it,
move on** — not a decision request.

**The shopping data is meant to be written down.** It is the working record of the build. Itemised
lists, catalogue extracts, run outputs and scores belong in the open repository where the work is.

## What this IS

- The list of products believed to be written on Warwick's photographed shopping list.
- 39 lines; quantities sum to 57 units.
- Shape: `[{ "product": string, "qty": number }]`.
- The denominator the six rounds' omission and invention percentages were computed against, via
  `scoreSevenWay` in `services/asdair/pipeline/abAcceptanceHarness.js`.

## ⛔ What this is NOT — read before trusting a score computed against it

**Its provenance is UNRECORDED, and I am not going to imply otherwise.**

There is no record of **who** transcribed this list, **when**, **from what**, or whether it was ever
checked back against the photograph after being written. The file carries two keys and no metadata.
No commit message, deliverable or session log establishes its derivation.

The consequence is precise, and it is the 2026-08-11 input-truth lesson pointed at our own instrument
rather than at the pipeline:

> **Grading against this list proves consistency WITH THIS LIST. It does not prove consistency with
> the photograph.** If the transcription itself omitted a line or misread one, every score ever
> computed inherits that error invisibly, and a pipeline that correctly read the page would be marked
> wrong for doing so.

A "39 of 39 correct" result against an unverified denominator is exactly the shape of the failure that
has already cost this build a session: a confident total, reconciled against a derived list nobody
checked back to the source.

**Before this file is used to declare the acceptance bar met, it should be re-derived from the
photograph independently** — by someone reading the image, not by editing this file. Until then it is
fit for measuring *relative* movement between runs, and not fit for declaring an absolute pass.

## The photograph

`C:/.fusion247/asdair/shopper-media/tg-shopper-chat-…jpg` — private surface. Any Work Order that reads
it must declare `private_surface` per GL-012.

## The 41-line trolley — the WRONG denominator, and why

`Deliverables/2026-08-11-trolley-reconciliation-41-lines.md` — 41 rows, 58 units, £140.97.

Its own front matter states it is the **evidence record of a MANUAL RESCUE, not acceptance and not a
pipeline output.** It differs from the photograph by design: Regulars batches added on top, items
found by search, and Warwick's own late decisions during the rescue. It measures what was bought, not
what was written.

⚠️ **`abAcceptanceHarness.js` hardcodes `GROUND_TRUTH_PATH` to the 41-line trolley file** — the
denominator Warwick explicitly forbade grading against. Anyone running the committed harness rather
than the round-5 scratchpad script grades against the wrong list by default. Repointing it at the
committed 39-line file is part of requirement D.

## Two live test cases carried by the data

| Case | Why it matters |
|---|---|
| A pack-size product recorded at **qty 1** | Warwick's quantity invariant present in the truth data itself: a pack number is not a purchase quantity. The prototype has already reproduced this failure live. |
| The recurring `Lucozade Raspberry` invention | A **flavour-token substitution on a product genuinely present** — the Orange variant is on the page and Raspberry is a real household Regular. Not a fabrication from nothing, which is why it recurs and why it must not be special-cased. |
