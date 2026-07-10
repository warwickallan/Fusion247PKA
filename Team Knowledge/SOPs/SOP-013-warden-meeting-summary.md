# SOP-013 - Meeting Summary

- **Default owner:** Warden
- **Reusable by any agent.** Anyone summarizing a captured meeting for internal or client-facing use can run this.
- **Triggered by:** "summarize [meeting]" / "write up the meeting notes for X."
- **Output:** a Meeting Summary note under `Reporting-QA-Comms/`.
- **References:** [[GL-006-client-delivery-frontmatter-conventions]] (`evidence_type` field), [[SOP-010-warden-extract-source-to-evidence-pack]].

## Purpose

Produce a factual record of a meeting from its Evidence Pack — targeted rereads only, never a full reread by default — with a hard anti-embellishment rule: strong claims ("agreed," "confirmed," "no blockers") only get written when the underlying Register Item's `evidence_type` actually supports them.

## When to call this

A meeting has already been processed by [[SOP-010-warden-extract-source-to-evidence-pack]] (its Evidence Pack exists) and someone needs a written record of what happened — internal circulation, a status update, or the factual base [[SOP-014-warden-consultant-summary]] will build interpretation on top of.

## Steps

### 1. Read the Evidence Pack

The pack is the primary source for this SOP, not the transcript. Pull `## Source metadata`, `## Structured summary`, `## Speaker / topic index`, and the linked Register Items from `## Register items produced`.

### 2. Targeted reread only, tied to specific claims — not a general pass

Reopen the anchored section of the source only when, for the *specific claim you're about to write*, one of these applies:

- You're about to write that something was **agreed**, and the Register Item behind it isn't already `evidence_type: agreed-decision` — reread the anchor before writing "agreed," or don't write it.
- Attendees or roles are uncertain in the pack's `## Source metadata` / speaker index.
- A risk write-up lacks enough context in `## Key extracts`.
- The pack's `## Contradictions` flags something relevant to what you're summarizing.
- The Register Item behind a claim is `evidence_type: inference`.

### 3. Draft the output

- **Attendees** — from the pack's `## Source metadata`. Mark uncertain attendees as uncertain; never infer someone attended because they usually do.
- **Purpose.**
- **Executive summary.**
- **Areas covered.**
- **Decisions** — only items whose underlying Register Item is `evidence_type: agreed-decision`. Anything else (a suggested option, an unresolved discussion) goes under Areas covered or Open questions, never under Decisions.
- **Risks.**
- **Actions and owners** — owner marked explicit vs. proposed, mirrored straight from the Register Item's own `owner` field.
- **Open questions** — `evidence_type: unresolved-discussion` items, and anything `confidence: low`.
- **Next steps.**

### 4. The anti-embellishment rule

Never write **"the team agreed,"** **"no blockers were identified,"** **"the solution meets requirements,"** or **"the workshop confirmed"** unless the specific underlying Register Item is `evidence_type: agreed-decision` (for "agreed"/"confirmed") or a Register Item actually states the claim being made. Absence of a recorded blocker in the register is not the same claim as "no blockers exist" — write **"no blockers recorded in the register as of [date]"**, not a blanket assertion about the world.

### 5. QA checklist (Meeting Summary-specific)

- Every "agreed"/"confirmed"/"approved" in the draft has a specific `evidence_type: agreed-decision` Register Item behind it — check each instance individually, not just the obvious one.
- Every "no X was identified" statement is qualified as absence-in-the-record, not asserted as fact about the world.
- The attendee list matches the pack's `## Source metadata`, not an assumed recurring invite list.
- Every Decision/Risk/Action line carries a wikilink to its Register Item.

### 6. Save

`Client Delivery/<engagement-slug>/Reporting-QA-Comms/<engagement-slug>-meeting-summary-YYYY-MM-DD.md`.

## Worked example

The 2026-04-02 PTW workshop pack shows `reg-022` (a decision on permit-expiry escalation routing) as `evidence_type: agreed-decision`. Warden writes "The team agreed to route permit-expiry escalations to the operations duty manager (`[[bellrock-npl-implementation-reg-022]]`)." A separate item, `reg-019` (notification recipients), is `evidence_type: suggested-option` — Warden writes it under Open questions, not Decisions, and does not claim it was agreed.

## Common mistakes to avoid

- Writing "the team agreed" because the discussion trended that way, without checking `evidence_type` on the specific item.
- Treating "nothing was flagged as a blocker" the same as "there are no blockers" — these are different claims.
- Doing a full reread of the source "to be thorough" instead of a targeted one tied to a specific claim.
- Listing a `suggested-option` or `unresolved-discussion` item under Decisions because it reads more decisively that way.
