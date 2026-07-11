# Content-Integrity Audit — 2026-07-11 09:10 — t009-hermes

## Reviewer independence

**Same-model review — not independently verified.** This audit is run by Pax in the same model/session that scoped and authored `tsk-2026-07-11-001-absorb-independent-change-qa-doctrine` (the PR this report is part of). It is real, useful content-integrity work, but it is not the independence gate the task file requires before T009 can close. That gate is a separate, later, genuinely non-author review (Fable/ChatGPT or Warwick) against this PR's pushed head SHA.

## Scope

- `PKM/My Life/Topics/ai-tooling.md`, section `## External intake — sources processed by Cairn` (the single 2026-07-10 Hermes/NetworkChuck entry), checked against the raw transcript.
- Raw source: no committed copy exists in this repo (Hermes was processed before `Sources (Immutable)/`/GL-011 existed). Checked `/tmp/claude-0/-home-user-Fusion247PKA/08ad2055-2fc5-51ea-a59e-3021d67ed3bb/scratchpad/pilot-hermes-transcript.txt` first, per the brief's instruction — **it exists and is complete** (107 lines, opens on the video's own title line "you need to use Hermes RIGHT NOW!! (goodbye OpenClaw!!)", closes on the narrator's full "prayer for viewers" sign-off with no truncation marker). Read in full, once, this pass.
- Checks run: fabricated-reference **and** content-drift (both, per SOP-017 §Inputs default).

## Step 0 — Privacy gate

Public-only scope. `PKM/My Life/Topics/ai-tooling.md` is not under any GL-009 private/local root (`PKM/Journal/`, `PKM/My Life/Current Context/`, `PKM/My Life/About Warwick/`). Confirmed directly by reading GL-009's list and the file's own path — not assumed from the dispatch brief. Report lands in tracked `Deliverables/`; session-log entry may be a normal detailed one.

## Summary

- 1 file audited (`ai-tooling.md`'s Hermes section) against 1 raw source (scratchpad transcript).
- 6 findings.
- Severity breakdown: 0 HIGH, 2 MEDIUM, 3 LOW, 1 Observation.
- No fabricated citations found. No claim traced to a source that doesn't actually exist. The core factual content, the five entity-rejection calls, and the two disclosed transcription-ambiguity flags (Nous Research, OpenClaw) all hold up against the raw transcript.

## Findings

### `PKM/My Life/Topics/ai-tooling.md`

| Severity | Check | Detail | Recommendation |
|---|---|---|---|
| MEDIUM | Fabricated-reference-adjacent (quote fidelity) | The note presents `"fastest growing project on GitHub"`, `"took first place in OpenRouter token usage, surpassing OpenClaw"`, and `"no security incidents to date"` / `"numerous CVEs"` in quotation marks as if verbatim source text. The transcript's actual (garbled auto-caption) wording is: *"Hermes is currently the fastest growing project on Gitub. In terms of OpenOuter token usage, it also took first place, surpassing Openclaw."* and *"until the time of producing this video, Hermes had no There was no attack... OpenClaw had numerous CV and core vulnerabilities."* The underlying substance is accurately paraphrased, but presenting a cleaned-up paraphrase inside quotation marks — without flagging it as a normalization — is inconsistent with the note's own stated practice of disclosing normalizations (it does this explicitly for "Nous Research" and "OpenClaw" two paragraphs earlier). | Either drop the quotation marks (present as paraphrase, not quote) or add the same transcription-quality flag the note already gives Nous Research/OpenClaw. Owner: whoever next edits this note (Cairn or the user). |
| MEDIUM | Content-consistency / selective disclosure | The note explicitly discloses two garbled-spelling normalizations ("Nous Research", "OpenClaw") but silently normalizes at least two more without the same disclosure: "OpenRouter" (source renders it "OpenOuter") and "Hostinger" (source renders it "Poster" and "hospinger.com" — never once spelled "Hostinger" cleanly). Both silent normalizations happen to be correct reads, confirmed directly against the transcript's own sponsor-URL text, but the note's evidence-labeling discipline is applied selectively, not uniformly, across comparably garbled terms in the same source. | Apply the same "every distinct spelling observed, normalized form used, reasoning" disclosure (the pattern SOP-016 §3 now formalizes) to OpenRouter and Hostinger, or note explicitly that these two were judged unambiguous enough not to need it. |
| LOW | Content-consistency | The note's Provenance paragraph states the transcript "refers to itself twice as continuing 'on the network Chuck Academy'". The raw transcript contains exactly **one** clean instance of that full phrase ("We plan to release it first on the network Chuck Academy along with courses for Hermes") and one later bare reference to "the Academy" (no repetition of "network Chuck"). The underlying channel-attribution conclusion is still reasonable, but "twice" mildly overstates the literal textual repetition. | Reword to "once explicitly, plus one later bare reference to 'the Academy'" or similar — a precision fix, not a substance fix. |
| LOW | Content-consistency | The note attributes the "6–7 months before the competitor's public release" origin story cleanly "to 'Jeff,' a co-founder, in reported speech." The transcript's own text is genuinely ambiguous at that exact passage — it shifts from the narrator's own voice ("I found out what happened") into a first-person-plural account ("we developed internally... we decided to release our version") without an unambiguous quotation marker tying it to Jeff specifically at that sentence. The attribution is a reasonable inference (Jeff is the co-founder quoted throughout), but the note states it more cleanly than the source's own ambiguity supports. | Low-stakes; optionally soften to "attributed in context to Jeff/the Nous Research team" rather than a clean single-speaker attribution. |
| LOW | Fabricated-reference check | Confirmed clean: "No video URL appears anywhere in the material handed to me" — verified true; no youtube.com or other video URL exists anywhere in the 107-line transcript (only a sponsor URL, `hospinger.com/...`, appears). | No action — this is a correctly honest negative finding by Cairn, called out here only because it was checked, not because anything is wrong. |
| Observation | Entity-rejection audit | All five entity-rejection calls (Hermes, Nous Research, Jeffrey Carnell, OpenClaw, Hostinger) hold up under GL-002's eight-entity-type test and Cairn's CRM-scoping reasoning ("the user has no relationship with it"). Jeffrey Carnell's full name does appear exactly once in the transcript, as the note claims ("I also spoke with Jeffrey Carnell, one of the co-founders"), with "Jeff" used elsewhere — matches exactly. | No action. |

## Unconfirmed (not fabricated, not verified — say so honestly)

- The transcript's own "internally for 6-7 months" and every other narrator-asserted competitive/feature claim (memory caps, curation cadence, "fastest growing," CVE counts) are correctly labeled by the note as directly-present-but-unverified narrator/company assertions. Their **truth** was not checked this pass — that is explicitly out of scope for SOP-017 (a Pax hand-off the note itself already names) and remains unconfirmed, not fabricated.
- No independent recomputation of a content hash for the scratchpad transcript was performed (no committed `Sources (Immutable)/` register entry exists for this source, and Pax's toolset this session has no hashing utility). This is the same raw-source-provenance gap Cairn's own session log already flagged as open.

## Recommendation

No HIGH-severity findings; nothing here blocks in principle, but two MEDIUM findings are real and should be fixed before this note is treated as a clean reference example: (1) the quoted-but-not-verbatim competitive claims should either lose their quotation marks or gain the same normalization disclosure the note gives comparable garbled terms, and (2) the OpenRouter/Hostinger silent normalizations should get the same explicit disclosure Nous Research/OpenClaw already receive, for internal consistency of the note's own stated evidence-labeling discipline. Both are Cairn's (or the user's) fix to make, not Pax's — this report finds and classifies only. Independently of this note's own quality, the underlying raw-source-provenance gap (Hermes was processed with no `Sources (Immutable)/` capture, only a citation line) remains open and is addressed at more length in the companion `t009-hermes-independent-change-qa` report.
