---
agent_id: silas
session_id: ws-004-retro-2026-07-15-db-regen
timestamp: 2026-07-15T19:05:00Z
type: end-of-session
linked_sops:
  - SOP-002-convert-mypka-to-sqlite
  - SOP-019-fusion-delivery-tracking
  - SOP-close-task
  - SOP-004-vex-security-audit
linked_workstreams:
  - WS-004-team-retro-and-self-improvement-loop
linked_guidelines: []
---

# mypka.db regenerated after WS-004's first Team Retro landed (commit debc545)

## Context

Dispatched by Larry per [[WS-004-team-retro-and-self-improvement-loop]] Step 6: five approved retro proposals had just changed `Team/Larry - Orchestrator/AGENTS.md`, `Team Knowledge/SOPs/SOP-019-fusion-delivery-tracking.md`, `Team Knowledge/SOPs/SOP-close-task.md`, `Team Knowledge/SOPs/SOP-004-vex-security-audit.md`, and `Deliverables/2026-07-15-team-retro-proposals.md` (commit `debc545` on `claude/agent-count-kdved6`, already pushed). My job was to regenerate the SQLite mirror per [[SOP-002-convert-mypka-to-sqlite]] so the derived index reflects the new framework state, then report back plainly.

I read `Team Knowledge/SOPs/SOP-002-convert-mypka-to-sqlite.md` directly before doing anything, per my own contract.

## Finding: SOP-002's literal prompt is not what actually built this repo's mypka.db — flagging for Larry

SOP-002, as written, is a "prompt-as-deliverable": paste the body into a code-capable LLM, which produces `mypka_to_sqlite.py` (10 tables: `people, organizations, topics, projects, key_elements, goals, habits, journal, documents, journal_media, content_index`). That script does not exist anywhere in this repo (`git log --all` for `*mypka-to-sqlite*` shows only the SOP-002 file itself, added at the initial import).

What actually generates `mypka.db` in this repo is `Expansions/mypka-cockpit/scripts/regen-mypka-db.py` — the myPKA Cockpit's own regen script, installed via the Cockpit Expansion (see `Expansions/mypka-cockpit/INSTALL.md` and `Expansions/mypka-cockpit/docs/db-contract.md`). It mirrors the same "markdown canonical, SQLite derived, read-only vault" doctrine SOP-002 states, but its actual schema is a superset that has grown organically with the Cockpit: 23 owned tables (`people, organizations, topics, projects, goals, key_elements, habits, documents, deliverables, journal, journal_media, agents, agent_journal, links, meta, transactions, quotes, outer_world, library_registry, recipes, movies, workstreams, sops, guidelines`) plus `notes_fts` (FTS5) and 3 views, versus a set of other tables it explicitly leaves untouched (`food_logs, habit_logs, health_metric, health_mood, health_sleep, health_workout, health_workout_route`, FTS internals, `sqlite_sequence`). Notably it also mirrors `Team Knowledge/SOPs/`, `Team Knowledge/Workstreams/`, `Team Knowledge/Guidelines/`, and every `Team/<Name>/AGENTS.md` — none of which SOP-002's literal table list covers at all. Since the five retro-approved changes land in exactly those governance-doc/agent tables, running SOP-002's literal script (had I built a fresh one from its prompt) would have produced a `.db` missing `agents`/`sops`/`guidelines`/`workstreams` entirely and silently dropped every other Cockpit table already in the file. I ran the Cockpit's actual, established regen script instead, since it is what this repo's `mypka.db` is contractually built and read by (`meta.generator = 'mypka-cockpit/scripts/regen-mypka-db.py'` was already the recorded provenance of the file I found). I'm flagging the SOP-002/regen-mypka-db.py divergence to Larry — SOP-002 is stale relative to how this myPKA actually operates today and should be reconciled (either SOP-002 documents the Cockpit script as the canonical procedure for Fusion247PKA, or the two are explicitly scoped as separate paths).

## Whether a mypka.db already existed

Yes. `mypka.db` was tracked in git (deliberately excluded from `.gitignore`'s blanket `*.db` rule so a Python-less machine still has a working Cockpit after `git pull` — see `.gitignore` lines 33-38) and last regenerated **2026-07-10T09:29:42** (per its own `meta` table), committed at `b4a77d9`. That predates the retro commit by five days and multiple other deliverables/SOPs, so it was stale independent of today's retro landing too (e.g. `deliverables` had 0 rows pre-regen despite 8 files on disk, `sops` had 17 rows vs 28 files, `agents` had 12 rows vs 14 folders).

## What I ran

```
python3 "Expansions/mypka-cockpit/scripts/regen-mypka-db.py"
```
from the repo root. Read-only against the markdown vault by construction (only `.md` files are opened for read); it drops and rebuilds only its 23 owned tables + `notes_fts` + 3 views in-place inside the existing `mypka.db`, leaving the health/food/habit-log tables (owned by a different, Health-pack mirror) byte-for-byte untouched. Ran it twice back-to-back to confirm idempotency — identical output both times, no errors, no warnings.

## Row counts (before -> after)

| Table | Before | After | Files on disk (after) |
|---|---|---|---|
| people | 1 | 5 | 5 |
| organizations | 1 | 2 | 2 |
| topics | 1 | 1 | 1 |
| projects | 1 | 1 | 1 |
| goals | 1 | 1 | 1 |
| key_elements | 1 | 1 | 1 |
| habits | 1 | 1 | 1 |
| documents | 1 | 1 | 1 |
| deliverables | 0 | 8 | 8 |
| journal | 1 | 1 | 1 |
| agents | 12 | 14 | 14 |
| agent_journal | 0 | 2 | (n/a, not file-counted) |
| **workstreams** | 4 | **5** | 5 |
| **sops** | 17 | **28** | 28 |
| **guidelines** | 5 | **11** | 11 |
| links | 349 | 552 | — |
| notes_fts | 35 | 66 | — |
| recipes, movies, quotes, outer_world, transactions | 0 | 0 | (none exist yet) |

Every after-count matches the corresponding on-disk `.md` file count exactly (validated with `find ... | wc -l` per SOP-002 §"Validation") — no parsing failures, no skipped files.

## New SOP/Guideline/Deliverable content now indexed

Confirmed by direct row lookup (not assumed) that the five retro-approved changes are present verbatim in the regenerated mirror:

- `sops` row `SOP-close-task` body contains the new §"Verify success criteria" text: *"A task that grew into the running log for a much bigger effort can still be done if its own literal criteria are met... (added 2026-07-15, Team Retro proposal #4)"*.
- `sops` row `SOP-004-vex-security-audit` body contains the new `## Hardware/OS-dependent builds (added 2026-07-15, Team Retro proposal #5)` section in full, including the Fusion Health PR2 case study and its session-log cross-link.
- `sops` row `SOP-019-fusion-delivery-tracking` reflects the new consolidated "Known ClickUp quirks" section (15,796-char body, up from its pre-regen version).
- `agents` row `larry` (folder `Larry - Orchestrator`) contract body contains both new additions: the pre-send verification checklist and the structural-vs-substantive sorting heuristic.
- `deliverables` row `2026-07-15-team-retro-proposals` is indexed for the first time (was 0 deliverables rows pre-regen).
- FTS5 sanity check: `notes_fts MATCH 'literal'` returns 13 hits, confirming the new SOP-close-task body text is searchable.

## Files that failed to parse

None. All 28 SOPs, 11 Guidelines, 5 Workstreams, 14 agent contracts, 5 people, 2 organizations, 1 each of topics/projects/goals/key_elements/habits/documents/journal, and 8 deliverables parsed cleanly with no YAML errors and no warnings emitted by the script.

## Unresolved wikilinks

218 of 552 total `links` rows have `target_table IS NULL` (no matching slug in any mirrored table) — same proportion as before the regen, not a regression introduced by it. These are overwhelmingly **out of the mirror's scope by design**, not broken references needing a fix:

- Wikilinks to `Team Knowledge/session-logs/**` entries and `tsk-*` task files — neither session-logs nor the task-tracking layer is mirrored into any table by `regen-mypka-db.py` (by design; task files and session-logs are read straight off disk by the Cockpit, per the script's own docstring on `Fleeting Notes/`-style exclusions).
  - Example: `SOP-close-task`'s own body links out to `tsk-2026-05-15-002-...`, `2026-05-10-secret-rotation-discipline`, etc. — all session-log/task cross-references, all unresolved by design.
  - `2026-07-15-team-retro-proposals` links to five Larry close-session entries and two task IDs — same category.
- Literal template placeholders inside SOP bodies (`<wikilink to commit, file, or session-log>`, `<sub-task ids if any>`, `<previous-session-log-slug>`) — these are prose examples inside the SOP text itself, not real links.
- `AGENTS` self-references from `Team/<Name>/AGENTS.md` files resolve to slug `agents` (lowercased filename stem) but the `agents` table keys on the **folder name** (e.g. `larry`, `Larry - Orchestrator`), not the literal filename — a naming-shape mismatch that predates this regen and is worth a future Silas ticket if the Cockpit ever wants AGENTS.md self-links to resolve.

None of the newly-landed retro content introduced any *new* unresolved links beyond this pre-existing, expected set.

## Schema produced

Full CREATE TABLE/VIEW/INDEX statements are canonical at `Expansions/mypka-cockpit/scripts/regen-mypka-db.py` (the `SCHEMA` constant) and documented at `Expansions/mypka-cockpit/docs/db-contract.md` — not duplicated here per the SSOT rule. Summary: 23 owned tables + `notes_fts` (FTS5, porter unicode61) + 3 derived views (`v_open_invoices`, `v_reimbursement_pending`, `v_invoice_payment_trail`), plus 8 preserved-but-not-owned health/food/habit-log tables from a separate Health-pack mirror that this regen never touches.

## Outcome

`mypka.db` at the repo root now reflects the post-retro framework state. Markdown stayed canonical and untouched throughout (read-only scan). The `.db` file is tracked in git per the deliberate `.gitignore` exception (Python-less-machine fallback) — Larry/Warwick should decide whether to commit this regenerated binary now or leave that to a separate step.

## What the next agent should know

- **Run `Expansions/mypka-cockpit/scripts/regen-mypka-db.py`, not a hand-rolled SOP-002 script**, for any future myPKA-to-SQLite regen in this repo. SOP-002 is real and useful as a from-scratch bootstrap prompt for a *fresh* myPKA with no Cockpit installed, but it is not what maintains `mypka.db` here.
- Propose to Larry/Warwick: either (a) add a pointer from SOP-002 to `regen-mypka-db.py` as the concrete implementation once a Cockpit is installed, or (b) note in SOP-002 itself that Cockpit-equipped vaults supersede the prompt with their own regen script. I did not make this edit myself — it's a SOP content change and needs the normal approval path.
- `mypka.db` was 5 days stale even before today's retro (last regen 2026-07-10); consider whether Cockpit install/update flow should regen automatically on `git pull`, or whether this stays a manual/on-demand Silas duty.
