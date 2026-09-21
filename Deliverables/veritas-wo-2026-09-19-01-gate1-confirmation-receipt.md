---
build: BUILD-016
scope: WO-2026-09-19-01 — focused confirmation of finding 2 only (AC8 second conjunct)
gate: 1
boundary: WO-2026-09-19-01 and the outcome it promised — successor receipt to Deliverables/veritas-wo-2026-09-19-01-gate1-receipt.md, discharging its single blocking finding
reviewed_sha: n/a — product at machine surface C:/.fusion247/private/careerair/** (unchanged basis; predecessor pinned 23 file digests, no product change claimed or found since)
governance_sha: 6c8f7e665c94ae0fccb6cfbea30dda332375e2c9
branch: n/a (machine surface); repository at 2693e1a5b08df879735c196e10de4028f4577a3a, branch wo/2026-08-23-cockpit-grid
evidence_method: mixed — supplied verbatim capture (Larry-executed report, JD 1597) + Veritas-executed local verification (renderer byte-shape, board-file corroboration, hash recomputation)
worktree_head_at_start: 2693e1a5b08df879735c196e10de4028f4577a3a
worktree_head_at_end: 2693e1a5b08df879735c196e10de4028f4577a3a
worktree_status_clean: unchanged apart from this receipt
verdict: PASS
receipt_sha256: abae0c3a76709bde89fa42c766210292ca5fe62b7bde31fcbd8d8c0da7530947
reviewed_by: veritas
reviewed_date: 2026-09-21
next_review_trigger: material change to the promised outcome only — the gate is closed at PASS
---
## Scope reviewed

ONE focused confirmation of finding 2 of receipt `Deliverables/veritas-wo-2026-09-19-01-gate1-receipt.md` (commit `2693e1a`) — AC8's second conjunct: *"and the report generating from it"*, i.e. the report command executed against an advert acquired by the real scheduled run. Nothing else. AC1–AC7 are settled by the predecessor receipt and were not re-reviewed; no new scope was opened.

## The finding, and what discharged it

| # | Finding (predecessor) | Verdict now | Evidence |
|---|---|---|---|
| 2 | No report had been generated from any of run 173's twelve run-acquired adverts | **PASS — discharged** | Larry-executed report against JD 1597 (supplied, verbatim capture at `C:/.fusion247/private/careerair/runtime/kgraph-ac8-report-1597.txt`, exit 0, 91 lines — line count verified by `wc -l`). Independently verified by Veritas: (a) **authenticity by renderer byte-shape** — class labels pad to exactly 8 chars, evidence text truncates at 120 chars, header/tally/sheet lines match `renderReport` (`src/kgraph/report.mjs:83–109`) verbatim; (b) **run-173 provenance corroborated locally** — the board file run 173 itself wrote (`runtime/board/careerair-email-2026-09-20-17-00.md`, mtime 2026-09-20 17:07) contains exactly one row matching JD 1597's employer, one matching its title, and the literal id 1597 (counts only; names not quoted here per the standing privacy boundary), independent of the supplied SELECT claim; (c) **substance** — 26 requirements rendered with covered=1 / adjacent=2 / gap=23, the title axis visibly engaged (w=1 family evidence ranked above a w=0 non-family entry, the exact rule at `report.mjs:24`), and the ATS keyword sheet carries 22 skill-kind terms with **none of the five never-claim terms and no platform-kind term present**. The adopted-requirement-set condition of the predecessor's discharge instruction is met: the full table was exercised, not an empty state |

## Resulting verdicts

- **AC8: PASS.** First conjunct was already proven by the real production event (run 173, predecessor receipt); the second conjunct is now evidenced by execution. The Accepted requirements table of the predecessor receipt, with this confirmation, reads AC1–AC8 all PASS.
- **Overall Gate 1 verdict for WO-2026-09-19-01: PASS.** Every mandatory property for the reviewed scope is evidenced. The predecessor receipt is not amended — its HOLD stands as the true record of 2026-09-21's first review; this successor receipt records the discharge, per the one-focused-confirmation rule.
- Non-blocking findings 1 (R2 mechanism misdescription), 3 (cosmetic truncation) and 4 (parked R6) are unchanged, remain parked to reconciliation, and did not and do not gate this boundary.

## Predecessor receipt integrity — the hash question, settled

Larry reported whole-file `sha256sum` = `1bf4f5447db3a3594acfc90a14b1db21d299af956e0312e0c766a14ffa53d977` differing from the stated `receipt_sha256`. **The receipt stands intact.** `receipt_sha256` is computed over the BODY only — everything below the closing `---` of the frontmatter, per [[Templates/veritas-receipt]] (the frontmatter cannot hash itself). Recomputed by Veritas on the committed on-disk file: body extraction → `44ab738a620a9758d9b8822739b7362107e8d79cb12bcc72476f73022ec35432` — **exact match**; whole-file → `1bf4f544…53d977` — reproducing Larry's figure exactly. Not an EOL or normalisation effect; a hashing-scope difference. Working copy clean against HEAD; commit `2693e1a` is reachable from `origin/wo/2026-08-23-cockpit-grid`.

## Evidence provenance

- Machine surface `C:/.fusion247/private/careerair/**` read-only per GL-012; no `C:/.fusion247/*.env` loaded, opened, parsed or echoed; no live database touched by Veritas; no MCP tool used. The report capture and the SELECT-based run-membership claim are **supplied** (Larry-executed); everything marked "verified by Veritas" above was executed or read directly by Veritas.
- Repository HEAD at this confirmation's start and end: `2693e1a5b08df879735c196e10de4028f4577a3a` (moved from the predecessor's `e07a827` by Larry's verbatim commit of that receipt — a receipt commit, not a product change; the commissioning basis of this review is the discharge evidence, not the moved head).
- This file is the only artefact this confirmation adds.

## Next review trigger

None for this boundary. The gate is closed at PASS. Only a material change to the promised outcome — executable behaviour, accepted functional scope, a load-bearing interface or dependency, runtime wiring — reopens it. Receipts, documentation and clerical commits never do.
