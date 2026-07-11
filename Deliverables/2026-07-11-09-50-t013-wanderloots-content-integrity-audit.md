# Content-Integrity Audit — 2026-07-11 09:50 — t013-wanderloots

## Reviewer independence

**Same-model review — not independently verified.** Run by Pax in the same model/session that scoped this entire PR, including the task that dispatched Cairn's Wanderloots pass. Real, useful audit work, but not the independence gate T013 needs to close — that is a separate, later, non-author review against this PR's pushed head SHA.

## Scope

- `Deliverables/2026-07-11-08-00-t013-wanderloots-intake-disposition.md` (Cairn's own intake-disposition report), checked for internal evidence-fidelity against the raw transcript.
- `PKM/My Life/Topics/ai-tooling.md`, re-confirmed as genuinely untouched since the Hermes pass.
- Raw source: `Sources (Immutable)/2026/07/2026-07-11-wanderloots-llm-wiki-transcript.txt` — read directly (multiple targeted passes plus full-file grep sweeps for specific claims, given its length; not a second full linear read of the whole payload, consistent with the "one full read, targeted verification only" discipline SOP-016 itself prescribes).
- Checks run: both (fabricated-reference and content-drift), though the primary question here is narrower than a normal SOP-017 pass — per the brief, this report's central job is confirming the "not applicable" claim is actually true, and then auditing Cairn's own report's evidence-labeled claims against the raw source, since that report is itself the thing making checkable claims.

## Step 0 — Privacy gate

Public-only scope. Neither `ai-tooling.md`, the disposition report, nor the immutable transcript falls under any GL-009 private/local root. Report lands in tracked `Deliverables/`.

## "Not applicable" claim — verified, not just trusted

**Confirmed true.** Re-read `PKM/My Life/Topics/ai-tooling.md` directly, current state: it contains exactly one `## External intake` subsection (the 2026-07-10 Hermes entry) and no second entry for Wanderloots, Callum, or "the LLM Wiki." No frontmatter field changed since the Hermes pass. This is not inferred from Cairn's own report or the register row — it is a direct read of the note's current content. **So: not applicable, no living-knowledge change to check — verified independently of Cairn's own say-so, per the brief's explicit instruction not to trust the disposition report at face value on this point.**

## Summary

- 1 report audited (the disposition report) against 1 raw source (the immutable transcript), plus 1 confirmatory re-read of `ai-tooling.md`.
- 5 findings.
- Severity breakdown: 0 HIGH, 2 MEDIUM, 2 LOW, 1 Observation.
- The report's central disposition reasoning (redundant architecture, four surfaced tactical patterns, zero entity notes) holds up cleanly against the transcript. The findings below are all narrower evidence-fidelity issues inside the report's own chunk map and citations, not challenges to the disposition itself.

## Findings

### `Deliverables/2026-07-11-08-00-t013-wanderloots-intake-disposition.md`

| Severity | Check | Detail | Recommendation |
|---|---|---|---|
| MEDIUM | Fabricated-reference-adjacent (undisclosed normalization) | Chunk 14 states the creator names "a 'molecular zettelkasting' personal knowledge-theory extension — creator's own named framework." The raw transcript's actual text (`[32:57]`) is: *"my molecular zealcasting system which is just a more advanced knowledge theory."* The source never says "zettelkasting" — that is Cairn's own silent normalization of a garbled auto-caption term to a real, independently known personal-knowledge-management concept (Zettelkasten). This is the same class of judgment call the report explicitly discloses elsewhere (e.g. "codeex"/"codecs" → "Codex," "agents.mmd" → "agents.md"), but this specific normalization is presented as if it were the creator's own stated term, with no disclosure that the source actually says "zealcasting." | Add the same disclosure pattern used elsewhere in the report: state the observed spelling ("zealcasting"), the normalized guess ("zettelkasting"), and the reasoning (phonetic pattern, independently known term) — or leave it as "zealcasting" and note the term is unclear. Owner: whoever revisits this report (Cairn or the user); this report does not self-correct. |
| MEDIUM | Quantitative-claim precision | §"Raw-source quality finding" states the duplicated `[14:00]-[18:45]` block "repeats verbatim roughly fifteen times in sequence." Direct verification against the immutable payload (grepping the block's own recurring anchor line) finds the block's distinctive closing sentence recurring at lines 167, 223, 279, 335, 391, 447, 503, 559, 615, 671, 727 — **11 occurrences**, not "roughly fifteen." The qualitative finding (a large, real, verbatim-repeated block that self-evidently breaks at the same point the report identifies) is entirely correct and independently confirmed; only the specific count is measurably high (~36% over). | Correct "roughly fifteen" to "roughly eleven" (or state the precise count, now that it has been checked) if this report is ever revised. Does not change the disposition or the "don't re-read" judgment call, which remains correct regardless of the exact count. |
| LOW | Content-consistency (evidence completeness) | Chunk 3 states "Codex" is "rendered 'codeex'/'codecs' inconsistently across the file," normalized "as the most plausible reading given context, not a clean statement from the source." In fact the transcript also contains the **correctly spelled** "codex" twice (`[30:08]`, `[31:16]`), meaning the normalization had direct textual support available, not only phonetic/contextual inference. The report's own hedge ("not a clean statement from the source") is more cautious than the evidence actually required. | Optional: note that "codex" also appears cleanly twice, strengthening rather than weakening the normalization — a completeness improvement, not a correction of a wrong call. |
| LOW | Fabricated-reference check | The report's precise citations — the closing timestamp (`[33:57]`, "thanks again for watching... see you in the next video"), the exact line number of the "You can view the original video [here]" backlink (line 971), the creator's self-identification at `[00:32]` ("hi my name is callum also known as wanderloots"), and the unnamed "one of the founders of Obsidian" attribution at `[07:25]`/Chunk 4 — were all checked directly against the immutable payload and match exactly, including the specific line number cited. | No action — called out only because it was checked and holds up cleanly; this is the report doing exactly what SOP-016/SOP-017 ask. |
| Observation | Register/report consistency | `Sources (Immutable)/INDEX.md`'s row for this source matches the disposition report's own claims (`disposition: Surface for Warwick`, `destinations: none`, notes summarizing the outcome and pointing at this deliverable) — no drift between the register and the report it describes. | No action. |

## Unconfirmed (not fabricated, not verified — say so honestly)

- The report's own explicitly-flagged unverified narrator claims (the unnamed Obsidian-founder attribution, the "local models make more mistakes than cloud models" generalization, the "more efficient than RAG" self-assessment) are correctly labeled as unverified in the report itself. Their truth was not checked this pass — out of scope for SOP-017, a Pax hand-off the report itself already names.
- No independent recomputation of the register's cited `sha256` hash was performed — no hashing tool available in this session's toolset. The register's hash claim is therefore unconfirmed, not verified, though the payload's actual current content was read directly and matches the report's descriptions of it (start, duplicated block, and ending all checked directly).

## Recommendation

No HIGH findings; the disposition itself and the great majority of the report's evidence-labeling are sound and independently confirmed against the raw transcript. Two MEDIUM findings are worth a real fix before this report is treated as a clean audit trail: the undisclosed "zealcasting" → "zettelkasting" normalization should get the same disclosure treatment the report gives every other garbled term, and the "roughly fifteen" repeat-count claim should be corrected to the actual, now-confirmed count (eleven) if this document is ever revised. Neither finding changes the underlying disposition ("Surface for Warwick," not Enrich) or any of the four surfaced tactical patterns, which are independently supported by the transcript at the timestamps cited.
