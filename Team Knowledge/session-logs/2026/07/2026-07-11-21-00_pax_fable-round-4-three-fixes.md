---
agent_id: pax
session_id: fable-round-4-three-fixes-2026-07-11
timestamp: 2026-07-11T21:00:00Z
type: close-session
linked_sops: [SOP-017-content-integrity-audit, SOP-018-independent-change-qa, SOP-015-cairn-process-external-source, SOP-016-cairn-process-youtube-transcript]
linked_workstreams: []
linked_guidelines: [GL-011-immutable-source-retention, GL-002-frontmatter-conventions]
---

# Fixed 3 remaining issues from Fable's fourth external QA pass on PR #9

## Context

Larry dispatched me to fix 3 specific issues a fourth external QA review ("Fable," genuinely separate from this session) found in PR #9, all mine to fix (4 others were handled separately by Larry and Cairn already, untouched by me this pass): a wrong disposition at row #37 of the doctrine-absorption matrix, a stale-findings correction owed to the T009 audit now that Cairn's fixes landed, and a stale, self-contradicting sentence in the T013 report.

## What we did

- **Fix 1 — row #37 of `Deliverables/2026-07-11-independent-change-qa-doctrine-absorption.md`.** Read the row and `Team Knowledge/session-logs/_template.md` directly myself, plus several real session-log files (`agent_id: cairn`, `agent_id: pax`, `agent_id: larry`), before deciding. Confirmed Fable's point: `agent_id` names the specialist persona wearing the hat (cairn, pax, larry), not the actual underlying model/runtime that processed the source — nothing in the current schema records that, anywhere. Chose **Option B**: reclassified row #37's disposition from `already-covered` to a new `open-follow-up-gap` category rather than adding a `model:`/`runtime:` field myself — deciding the field's name/semantics and whether a prospective-only addition is truly low-risk is a schema call for Silas (frontmatter/schema owner) and Warwick, not something to implement unilaterally inside a QA-reconciliation pass. Updated the headline-dispositions summary counts (already-covered 9→8, new open-follow-up-gap bullet for #37) and added a round-4 Amendments entry.
- **Fix 2 — `Deliverables/2026-07-11-09-10-t009-hermes-content-integrity-audit.md`.** Read Cairn's session log (`2026-07-11-20-15_cairn_ai-tooling-fable-qa-fixes.md`) and the current `PKM/My Life/Topics/ai-tooling.md` directly — did not take Larry's summary on trust. Confirmed both fixes are real: quote marks dropped + a transcription-quality flag added (with the actual garbled auto-caption text) for the competitive-claims bullet; disclosure added for both OpenRouter ("OpenOuter" in source) and Hostinger ("Poster"/"hospinger.com" in source). Added a dated round-4 correction note citing exactly what changed, updated the Summary severity-breakdown line and the Findings-table Recommendation cells with `[Fixed 2026-07-11, round 4]` markers, and rewrote the Recommendation section so it no longer reads as a still-open ask. Did not touch `ai-tooling.md` itself (Cairn's, already done) or the Findings text/severity table — both retained verbatim as the historical audit record.
- **Fix 3 — `Deliverables/2026-07-11-10-10-t013-wanderloots-independent-change-qa.md`.** The "Improvement opportunities" bullet claimed both Hermes's and Wanderloots's data-quality defects were "attributed to the manual Google-Drive-fetch-plus-upload acquisition path" — directly contradicting this same report's own prior correction that the Wanderloots duplication is source-side (an upstream auto-caption defect, hash-confirmed). Re-read Cairn's original Hermes session log to check the acquisition-path attribution for Hermes too: it attributes the garbling to the transcript's own auto-caption quality, not explicitly to the fetch/upload step — so it's a genuinely open, unresolved acquisition-*or*-source question, not a second confirmed acquisition-path defect. Corrected the bullet in place: Wanderloots is now stated as confirmed source-side, Hermes as a separate, still-open question, and the underlying suggestion (worth Mack/Larry auditing the acquisition step) is explicitly downgraded — the evidence no longer supports it as stated, since it now rests on zero confirmed acquisition-path defects and one unconfirmed candidate, not two confirmed ones. Added a matching line to the Recommendation section.

## Decisions made

- **Question:** For row #37, add a real `model`/`runtime` frontmatter field (Option A) or just correct the disposition and flag it (Option B)?
  **Decision:** Option B. A prospective-only field addition might be low-risk, but naming it, defining its semantics, and judging whether it truly needs no backfill is a schema-ownership decision (Silas/Warwick's), not mine to make unilaterally while reconciling a QA matrix.
- **Question:** Does the T013 "worth auditing the acquisition step" suggestion still hold once the Wanderloots half of its premise is corrected?
  **Decision:** No — said so honestly rather than forcing the point. With Wanderloots confirmed source-side, the premise is down to zero confirmed acquisition-path defects and one open, unconfirmed one (Hermes); the suggestion is downgraded to "not currently actionable on the evidence in hand."

## Insights

- A disposition label like "already-covered" is itself a claim that needs the same triangulation discipline as any other finding — row #37 read as plausible on first pass because `agent_id` sits so close to the actual requirement, but "close by" and "actually satisfies" are different questions, and a fourth external reviewer was needed to catch the gap between them.
- When a report cites "both session logs" to support a shared claim about two different sources, each log needs to be re-checked individually — the Hermes and Wanderloots defects turned out to have different root causes (source-side transcription noise vs. confirmed source-side duplication) even though the original sentence lumped them into one acquisition-path narrative.

## Realignments

- _(none this session — Larry's brief was precise and specified do-not-touch items clearly)_

## Open threads

- [ ] Silas/Warwick to decide whether and how to close the row #37 gap (a `model:`/`runtime:` session-log frontmatter field, added prospectively) — not actioned this pass, per Option B.
- [ ] Genuinely independent (non-Pax, non-Cairn, non-Larry) confirmation of T009/T013 still outstanding — unaffected by this round's fixes, which only corrected in-file staleness, not the independence gate itself.

## Next steps

- None outstanding for Pax on this round. Awaiting Fable's (or another independent reviewer's) confirmation that these 3 fixes resolve the round-4 findings.

## Cross-links

- `[[2026-07-11-19-00_pax_sop-018-round-3-fable-corrections]]` — the prior (round 3) correction pass this one follows.
- `[[2026-07-11-20-15_cairn_ai-tooling-fable-qa-fixes]]` — Cairn's fixes to `ai-tooling.md`, confirmed directly and cited in Fix 2 above.
- `[[2026-07-11-10-20_pax_t009-t013-independent-qa-passes]]` — the original four QA reports this round corrects two of.
