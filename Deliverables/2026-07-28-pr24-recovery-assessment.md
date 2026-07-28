---
type: deliverable
created: 2026-07-28T10:00:00Z
agent_id: larry
linked_workstreams: [WS-004-team-retro-and-self-improvement-loop]
status: complete
---

# PR #24 recovery assessment

PR #24 (`claude/ws-004-team-retro-recovery` → `main`, opened 2026-07-16, draft, non-mergeable — hundreds of
commits behind) was left untouched during the 2026-07-28 estate/PR hygiene pass pending full assessment. This
document is that assessment: semantic comparison of every changed file and each of the five originally approved
Team Retro proposals against current `main`, not commit ancestry or file equality.

**Method.** For each of PR #24's 10 changed paths: does it exist on current `main`? If yes, does its *content*
(not just presence) already carry what PR #24 adds? If the file has evolved since PR #24's base, would applying
PR #24's version delete anything current `main` added later? Every claim below is a direct `git diff`/`git show`
against `origin/main`, not an inference from branch age.

## Per-file classification

| File | Class | Finding |
|---|---|---|
| `Team/Larry - Orchestrator/AGENTS.md` (whole file) | **D** | Applying wholesale would **delete** the entire 2026-07-27 doctrine reconciliation (Operating doctrine §1–10, including tonight's own §8a "CI truth is exact-head evidence") and revert Larry's Iron Rule to its pre-reconciliation absolute form. PR #24's branch was cut 2026-07-15, before any of that existed. **Not applied as a file.** |
| ↳ "Pre-send verification" section | **C** | Confirmed absent from current `main` (`grep` for "pre-send"/"verify before asserting" found nothing equivalent). Landed via surgical section-only extraction, not the whole file — see below. |
| ↳ "Handling a bundled QA/audit gap" section | **C** | Confirmed absent (`grep` for "bundled"/"structural.*substantive" found nothing). Landed the same way. |
| `Team Knowledge/SOPs/SOP-019-fusion-delivery-tracking.md` | **mixed B+C** | PR #24's version would **delete** the "Foundry vs build — the layer boundary" section, added 2026-07-18 (three days after PR #24's base) after a real breach (a TubeAIR closeout wrongly posted to Foundry) — that removal is **superseded/harmful, not applied**. Its "Known ClickUp quirks" addition is genuinely absent from `main` and unrelated to the Foundry section — hand-merged in without touching the newer content. |
| `Team Knowledge/SOPs/SOP-close-task.md` | **C** | Addition only (no main-side removal in the diff). Searched `Team Knowledge/SOPs/` for "literal criteria"/"accumulated narrative" — no match anywhere. Applied cleanly; current main's insertion point (`### Pre-flight` step 1) is byte-identical to what PR #24 assumed. |
| `Team Knowledge/SOPs/SOP-004-vex-security-audit.md` | **C** | Addition only. Searched for "hardware.*os-dependent"/"device-test-driven" — no match anywhere on main. Its evidence citation (`2026-07-13-18-45_vex_fusion-health-pr2-health-connect-audit.md`) verified present on `main` before landing — not a dangling reference. Applied cleanly. |
| `Team Knowledge/tasks/INDEX.md` | **B** | `INDEX.md` is explicitly **auto-generated, never hand-edited** (its own header says so). It was already 12 days stale on current `main` independent of PR #24 (last rebuilt 2026-07-16, missing all tasks created since). PR #24's hand-merged copy is now *also* stale and reflects neither PR #24's era nor today's. **Not carried forward.** Regenerated fresh by applying `SOP-rebuild-task-index`'s own deterministic procedure against every current task file — the correct current process already on `main` supersedes reusing any branch's stale snapshot. |
| `Team Knowledge/tasks/open/tsk-2026-07-15-001-...md` | **C** | Does not exist anywhere on `main`, in any task state (open/in-progress/done/cancelled) — confirmed by listing every task file. The gap it names is **still real**: `SOP-002-convert-mypka-to-sqlite.md` on current `main` still documents the phantom `mypka_to_sqlite.py` prompt-script; `Expansions/mypka-cockpit/scripts/regen-mypka-db.py` is still the actual, unchanged mechanism. Recovered with an added `Updates` line documenting re-verification and provenance; `created`/`source` left as the true original record. |
| `Deliverables/2026-07-15-team-retro-proposals.md` | **C** | Does not exist on `main`. Genuine historical evidence — Warwick's dated, per-item approval record for all five proposals. Recovered with a `Recovery note` banner (added, not overwriting the original body) documenting what changed in re-application versus 2026-07-15. |
| `Team Knowledge/session-logs/2026/07/2026-07-15-17-30_larry_team-retro-first-run.md` | **C** | Does not exist on `main`. Point-in-time record of the retro's decisions and open threads. No forward-looking claim in it is stale or misleading as read today (its open threads — the SOP-002 task and the DB-commit question — are the same ones this recovery is resolving). Recovered verbatim. |
| `Team Knowledge/session-logs/2026/07/2026-07-15-mypka-to-sqlite.md` | **C** | Does not exist on `main`. Silas's own investigation record of the SOP-002/regen-script divergence — the primary evidence for the recovered task. Recovered verbatim. |
| `mypka.db` (binary) | **D** | **Not carried forward.** Two independent reasons: (1) it is a derived artifact regenerated on demand, not routinely regenerated per content PR — `git log --oneline -- mypka.db` shows exactly **one** commit in this repo's entire history (`b4a77d9`, "ship a prebuilt mypka.db"); PR #77's doctrine merge and every other recent governance PR left it untouched. (2) PR #24's regenerated binary is *itself* now stale — it was built against a tree from ~2026-07-18/21 ("post-BUILD-000"), and current `main` has moved hundreds of commits since. Carrying it forward would replace one stale binary (tracked, generated 2026-07-10) with a *different* stale binary, not a current one. The current canonical regeneration process (`Expansions/mypka-cockpit/scripts/regen-mypka-db.py`) does not genuinely require this recovery to run it — regeneration is separate, on-demand maintenance, out of this recovery's scope. |

## Per-proposal classification (the five Warwick-approved items)

| # | Proposal | Target | Class | Outcome |
|---|---|---|---|---|
| 1 | Pre-send verification checklist | `AGENTS.md` §"Pre-send verification" | **C** | Landed — surgical section extraction, cross-linked to tonight's §8a (same principle, CI-specific instance) |
| 2 | "Known ClickUp quirks" consolidation | `SOP-019` | **C** | Landed — hand-merged, preserving the newer Foundry-vs-build section |
| 3 | Bundled QA/audit-gap structural-vs-substantive heuristic | `AGENTS.md` §"Handling a bundled QA/audit gap" | **C** | Landed — surgical section extraction |
| 4 | "Check literal success criteria, not accumulated narrative" | `SOP-close-task` | **C** | Landed — clean addition |
| 5 | "Hardware/OS-dependent builds" scoping note | `SOP-004` | **C** | Landed — clean addition |

**All five proposals are Class C — none were already present on `main`, none were superseded by later doctrine.**
Only their *containers* diverged (`AGENTS.md` most severely, `SOP-019` partially); the five approved changes
themselves remain exactly what Warwick approved on 2026-07-15 and are now genuinely on the recovery branch.

## What was already present

Nothing. Every one of PR #24's five approved proposals, and the sixth item (the SOP-002 task), was **absent**
from current `main` — verified by content search, not inferred from branch staleness.

## What was superseded (not applied)

- `AGENTS.md` as a whole file — would have deleted the entire 2026-07-27 doctrine reconciliation.
- `SOP-019`'s removal of the "Foundry vs build" section — a real, breach-motivated addition from 2026-07-18.
- `tasks/INDEX.md`'s PR #24 snapshot — auto-generated derived state; regenerated fresh instead of reused.
- `mypka.db` — a derived binary, itself stale in PR #24, and not routinely regenerated per PR in this repo.

## What was rescued

The five approved Team Retro proposals (landed as surgical extractions/hand-merges, not whole-file overwrites),
the still-unresolved SOP-002 drift task, and three historical-evidence documents (the proposals record and two
session logs) — none of which existed anywhere except the stranded branch.
