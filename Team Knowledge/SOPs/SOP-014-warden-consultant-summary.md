# SOP-014 - Consultant Summary

- **Default owner:** Warden
- **Reusable by any agent.** Run by whoever is preparing delivery/commercial interpretation for the user's own use — never for direct client circulation without explicit sign-off (see rule below).
- **Triggered by:** "write the consultant summary for X" / "what does this meeting mean for delivery."
- **Output:** a Consultant Summary note under `Reporting-QA-Comms/`. **Internal-only by default.**
- **References:** [[GL-006-client-delivery-frontmatter-conventions]] (source-tier doctrine), [[SOP-013-warden-meeting-summary]], [[SOP-010-warden-extract-source-to-evidence-pack]].

## Purpose

Everything [[SOP-013-warden-meeting-summary]] uses, plus tier-1 contract/SOW material and deliberately selected source excerpts, to produce delivery and commercial interpretation — what a meeting actually *means* for the engagement. This is the one meeting-intelligence skill allowed to speculate, and the one skill allowed to reopen source material beyond GL-006's mandatory reread triggers, because interpretation legitimately needs texture the register alone can't carry. The one non-negotiable: interpretation is never blended with the factual record — it is always visibly, consistently labeled apart from it.

## When to call this

An engagement needs delivery-side or commercial interpretation of a meeting or a run of meetings — stakeholder alignment, scope exposure, escalation candidates — beyond what a factual Meeting Summary states. Usually for the user's own internal use, ahead of a steering conversation or an internal decision.

## Steps

### 1. Pull inputs

- Everything SOP-013 uses: the Evidence Pack, its linked Register Items.
- Tier-1 artifacts relevant to what's being interpreted: contract, SOW, schedules, approved change requests, from `Sources (Immutable)/`.
- Any relevant tier-2 baseline material (signed-off requirements, solution design).
- Selected source excerpts, reopened deliberately where interpretation needs texture the register can't carry. Note *why* each excerpt was pulled — this is the one SOP allowed to go beyond GL-006's mandatory-reread trigger list, and that latitude only holds if each reopen is justified, not habitual.

### 2. Cross-reference every delivery/commercial claim against tier-1 material

For each claim about delivery or commercial exposure, check whether a tier-1 artifact bears on it. If a Register Item's content might conflict with a tier-1 obligation, this is GL-006's "possible tier-1 conflict" reread trigger — treat it as mandatory. Do not interpret past an unresolved tier conflict without flagging it explicitly; per the source-tier doctrine, a disputed contractual obligation only moves via a tier-1 artifact (an approved change request), never by a consultant's read of a meeting.

### 3. Draft, with fact and interpretation visibly separated in every section

Sections: **Delivery interpretation**, **Stakeholder alignment**, **Scope implications**, **Commercial implications**, **Implementation implications**, **Recommended next moves**, **Matters requiring escalation**.

In every section that offers interpretation, pair it explicitly — never blend the two into one sentence:

> **Recorded fact:** NPL requires multi-day contractor work to be supported (`[[bellrock-npl-implementation-reg-031]]`).
> **Consultant interpretation:** the current 12-hour expiry model may create either compliance exposure or significant administrative overhead unless a daily reassessment process is agreed.

A section with no fact behind it doesn't get a "Recorded fact:" line manufactured to satisfy the format — say plainly that the interpretation is unanchored, or drop the point.

### 4. Escalation items are recommendations, never decisions already made

Per Warden's Critical rule 4, Warden never makes a unilateral scope-change, risk-acceptance, or closure call. "Matters requiring escalation" is a list of things drafted for the user's decision via Larry — phrase each one as a recommendation ("recommend escalating X because…"), not as a conclusion already reached.

### 5. Mark the document internal-only

State it in the header, plainly, as a rule and not a suggestion: **"Internal only — not for client circulation without explicit user approval."** This document is not sent externally under any circumstance unless the user explicitly approves external circulation for that specific document. Larry surfaces that approval decision to the user; Warden does not assume it.

### 6. QA checklist (Consultant Summary-specific — the sharpest of the four, because this is the one skill allowed to speculate)

- Every **Recorded fact:** line traces to a Register Item, Evidence Pack entry, or tier-1/tier-2 source — never to an interpretation dressed up as fact.
- Every **Consultant interpretation:** line is labeled as such, with no unlabeled drift into assertion elsewhere in the same section.
- Any interpretation touching commercial or contractual exposure has been checked against tier-1 material, not asserted from meeting evidence alone.
- Escalation items read as recommendations surfaced to the user, not decisions already taken.
- The document header states internal-only status.

### 7. Save

`Client Delivery/<engagement-slug>/Reporting-QA-Comms/<engagement-slug>-consultant-summary-YYYY-MM-DD.md`.

## Worked example

Following the 2026-04-02 PTW workshop, the Meeting Summary (SOP-013) records the permit-expiry escalation decision as fact. The Consultant Summary adds, under Commercial implications: **Recorded fact:** the SOW's Schedule 3 sets a 12-hour permit expiry window (`Sources (Immutable)/schedule-3.pdf`, tier 1). **Consultant interpretation:** the workshop's discussion of multi-day contractor work suggests the 12-hour window may not fit real site conditions, which could become a change-request candidate — flagged under Matters requiring escalation as a recommendation, not a decision, for the user to weigh via Larry.

## Common mistakes to avoid

- Blending fact and interpretation into one sentence instead of two visibly separate lines.
- Treating an escalation item as already decided rather than as a recommendation for the user.
- Skipping the tier-1 cross-check because the meeting evidence alone "seems clear."
- Circulating this document externally without the user's explicit, per-document approval — this is a hard rule, not a judgment call Warden makes on the day.
- Reopening source material out of habit rather than for a specific, statable reason.
