# Session Log - 2026-07-11 - PR #9 plan: independent-change QA doctrine + T009/T013

## Active tasks
- [ ] [[tsk-2026-07-11-001-absorb-independent-change-qa-doctrine]] — plan written, awaiting Warwick's review before execution

## What we did

Following the migration closure audit (PR #8, merged), Warwick relayed a detailed brief from Fable proposing PR #9: absorb the legacy Fusion247 Brain `/update QA` independent-change-QA capability into a new, portable `SOP-018-independent-change-qa.md`, and use it (plus `SOP-017`) to finally close T009 and T013 with real evidence rather than the prior "superseded" over-credit the audit's own correction passes had already flagged.

Reviewed the brief critically before building anything:

- Confirmed the three-QA-layer diagnosis is correct and the gap is real.
- Found and corrected one factual error in the brief: it cited `SOP-015-general-external-source-intake.md` and `SOP-016-process-long-form-transcript.md`, which don't exist — the real files are `SOP-015-cairn-process-external-source.md` and `SOP-016-cairn-process-youtube-transcript.md`.
- Flagged a genuine access gap: the brief's proposed T013 source (a Wanderloots transcript, Drive ID `1Rr0dxWpyLE6xh-OhRMBJ7RN0mYUpqslMeJJAwIKiozY`) was not in the git-mirrored Fusion247Brain snapshot and this session had no live Google Drive access at the time.

Warwick resolved the gap two ways: supplied the transcript PDF directly as an upload, and connected Google Drive access to this session (`mcp__Google_Drive__*` tools). Tested the connection directly by reading the Wanderloots file from Drive by ID — succeeded (176,990-character transcript, confirmed as a genuinely different creator/system than Hermes: "Callum / Wanderloots," "the LLM Wiki," ~34-minute video). PDF-page rendering of the local upload failed (`poppler-utils` not installed on this machine) but the Drive read made it moot.

**Wrote `tsk-2026-07-11-001`** — a plan-only task (per Warwick's explicit "write the plan and brief, I'll come back once checked" instruction), capturing: the corrected source map, the doctrine-absorption-matrix step, the `SOP-018` design (skill not agent, model-independent, same-model-review honesty requirement, cross-linked to but not merged with `SOP-017`), the minimal contract-edit scope for root `AGENTS.md`/Larry/Pax, the T009 and T013 test designs, the explicit exclusion list (no touching `Client Delivery/`, GL-006 lessons/dependency, CareerAIR, AsdAIr, TubeAIR/ICOR adapters, connectors), and the closure rule barring "resolved because a report exists" — mirroring the same discipline the closure audit itself had to be corrected into using.

Nothing has been built yet — no `SOP-018`, no contract edits, no T009/T013 execution. This task and its branch are the plan only.

## Decisions

- PR #9's actual build work does not start until Warwick has reviewed this plan.
- Google Drive access is now available to this session and was used (read-only, one file) with Warwick's explicit authorization.

## SSOT / structural fixes (Librarian pass)

None needed this pass beyond this entry itself, which is the required log for the new task file.

## Cross-links

- [[2026-07-11-06-00_larry_migration-closure-audit]]
