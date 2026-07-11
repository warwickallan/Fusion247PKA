---
agent_id: cairn
session_id: pr9-fable-round-3-qa-fixes
timestamp: 2026-07-11T20:15:00Z
type: close-session
linked_sops: ["SOP-015-cairn-process-external-source", "SOP-016-cairn-process-youtube-transcript", "SOP-017-content-integrity-audit"]
linked_workstreams: []
linked_guidelines: ["GL-008-source-classification-registry", "GL-011-immutable-source-retention"]
---

# Fixed two stale-provenance + disclosure-fidelity findings in ai-tooling.md's Hermes section (Fable's third-round QA pass, PR #9)

## Context

Larry dispatched me to fix `PKM/My Life/Topics/ai-tooling.md` (the Hermes/NetworkChuck section I authored during my pilot) directly, in response to findings from an external reviewer ("Fable," genuinely separate from this session) in a third-round QA pass on PR #9. Two things needed fixing: a now-false "Raw-source provenance" paragraph, and two still-open MEDIUM findings from Pax's own SOP-017 content-integrity audit of the same note.

## What we did

- Read `Sources (Immutable)/INDEX.md` directly (not from a summary) and confirmed row `source_id: 2026-07-11-hermes-networkchuck-transcript`: retroactive capture via git blob extraction from `warwickallan/fusion247brain`, path `Fusion247 Brain/02_Sources/YouTube Transcripts/Transcript.network.chuck.hermes.docx`, blob SHA `7653fba40d2ae898b917a86879fff72a5fa5d265`, plaintext extraction at `Sources (Immutable)/2026/07/2026-07-11-hermes-networkchuck-transcript.txt`, sha256 `cf418a1450788378d3e5adf62603f85df59919d15a92c2a3fcd9ce53f38a6799`.
- Read `Team Knowledge/Guidelines/GL-011-immutable-source-retention.md` and confirmed it now governs general PKM intake, not only `Client Delivery/`.
- Read `Deliverables/2026-07-11-09-10-t009-hermes-content-integrity-audit.md` directly (Pax's SOP-017 audit) and pulled the two still-open MEDIUM findings' exact language rather than re-deriving from memory.
- **Fix 1 (stale provenance paragraph):** rewrote the note's closing "Raw-source provenance" paragraph in `PKM/My Life/Topics/ai-tooling.md` as an honest, dated (2026-07-11), historical statement: this source was processed 2026-07-10, before GL-011 covered general PKM intake; a durable copy always existed in `fusion247brain`'s git history at the blob SHA above (so it was never truly at imminent-loss risk, just unregistered); GL-011 has since been extended (per the Wanderloots/T013 pilot) and this exact transcript has been retroactively registered with its plaintext extraction and hash. No longer framed as an open gap flagged to Silas — it's closed.
- **Fix 2a (quote-fidelity, MEDIUM):** the "fastest growing project on GitHub" / "OpenRouter token usage, surpassing OpenClaw" / "no security incidents" vs "numerous CVEs" bullet no longer presents cleaned-up paraphrase inside quotation marks as if verbatim. Dropped the quote marks, restated as explicit paraphrase, and added a transcription-quality flag quoting the actual garbled auto-caption text from the audit report (*"Hermes is currently the fastest growing project on Gitub..."* etc.), matching the disclosure pattern the note already used for Nous Research/OpenClaw.
- **Fix 2b (selective disclosure, MEDIUM):** added the same "every distinct spelling observed, normalized form used, reasoning" disclosure (per [[SOP-016-cairn-process-youtube-transcript]] §3) to two terms that were previously normalized silently: "OpenRouter" (source renders it "OpenOuter") and "Hostinger" (source renders it "Poster" and "hospinger.com," never spelled cleanly). Both normalizations are judged correct reads, same as before — only the disclosure was missing, now added.
- Did not touch `Deliverables/2026-07-11-09-10-t009-hermes-content-integrity-audit.md`, the companion independent-change-qa report, `Sources (Immutable)/INDEX.md`, any task file, SOP-018, or the doctrine matrix — all explicitly out of scope for me this round; Pax owns correcting the audit reports once this fix lands.

## Decisions made

- **Question:** For the quote-fidelity finding, drop quote marks or add a disclosure flag (the audit offered either)?
  **Decision:** Did both — restated as paraphrase (no quote marks) *and* added the transcription-quality flag with the actual garbled text, since the note's own established pattern for garbled terms already does exactly this (Nous Research, OpenClaw), and doing only one of the two would have been a weaker fix than the existing convention.
- **Question:** Are the OpenRouter/Hostinger normalizations ambiguous enough to need disclosure, or unambiguous enough to skip it (the audit's other offered option)?
  **Decision:** Disclosed both anyway, for internal consistency with Nous Research/OpenClaw — the audit itself flagged the selective application as the actual problem, not the correctness of the reads.

## Insights

- A provenance paragraph that states "this is a real gap, flagged to Silas" needs an expiry condition built in from the start — this one went stale the moment GL-011 was extended and the source was retroactively registered, and nothing about the original note's own text signaled it should be re-checked. Worth considering, for future Cairn passes, stating provenance flags with an explicit "recheck when GL-011's scope changes" trigger rather than an open-ended flag.
- Disclosure discipline (the "every distinct spelling, normalized form, reasoning" pattern) is easy to apply inconsistently across a single note when some garbled terms sit in a "claims" bullet and others sit in an unrelated "evidence caveat" bullet — the SOP-016 §3 pattern should probably be checked against *every* proper noun in a source's chunk map before drafting, not just the ones that happen to land in the same paragraph as each other.

## Realignments

- _(none this session — Larry's brief was precise and I followed it directly)_

## Open threads

- [ ] Pax to correct `Deliverables/2026-07-11-09-10-t009-hermes-content-integrity-audit.md` and the companion independent-change-qa report now that this fix has landed (explicitly Pax's, not mine, per Larry's brief).
- [ ] No GL-008 classification misfit to flag this round — the Video/Audio Transcript classification held throughout; nothing here is a candidate for Silas's recurrence-gated category growth.

## Next steps

- None outstanding for Cairn on this PR. Awaiting Fable's (or another independent reviewer's) confirmation that both fixes resolve the round-3 findings.

## Cross-links

- `[[2026-07-11-04-30_cairn_hermes-transcript-pilot]]` — the original pilot session that authored the section now fixed.
- `[[2026-07-11-10-20_pax_t009-t013-independent-qa-passes]]` — Pax's audit that raised these findings.
- `[[2026-07-11-19-00_pax_sop-018-round-3-fable-corrections]]` — the related round-3 correction pass on the QA reports themselves.
