# 02 — Upstream and Derived Map

Audit branch `audit/de-mypka-extraction-20260728`, baseline HEAD `ae32ac9`. Comparison method: `git diff`
between Fusion's own initial-import commit `2eb9461` ("Initial import of Fusion247PKA", 2026-07-10 10:15
+0100) and current `HEAD` — **not** a diff against any external upstream tag (see "Upstream version caveat"
below). This isolates exactly what *Fusion* has touched, independent of anything upstream changed on its own
side afterwards.

## Upstream version caveat — record this before trusting any comparison

Fusion's `manifest.json` declares `scaffold_version: "4.1.1"`, `released: "2026-06-23"`, `from: "4.1.0"`.
**No `v4.x` or `v3.x` tag exists on the public upstream repository** (`github.com/myICOR/myPKA`, confirmed
via `gh api repos/myICOR/myPKA/tags` — the tag history jumps directly from `v2.4.0` (2026-06-18) to
`v5.0.0` (2026-07-07)). The exact commit Fusion imported cannot be located in upstream's public tag/release
history — it was likely distributed through a different channel (the README references a paid "AI Library
membership"). A raw byte-diff against the nearest public tag (`v5.0.0`, three days before Fusion's import)
was attempted and discarded as evidence: of 399 upstream v5.0.0 files with the same path in Fusion's import,
only 27 were byte-identical and 372 differed — but this is contaminated by upstream's *own* evolution between
the untagged 4.1.1 and the public 5.0.0, not evidence of anything Fusion did. **Unresolved evidence gap,
flagged for the risk register**, not resolved here.

The reliable signal used throughout this audit is therefore **Fusion's own import commit vs current HEAD**.

## Headline finding: what Fusion has touched since day one

- 453 files existed at import. **0 were deleted.** 994 new files were added. Of the original 453, only
  **29 were ever modified**; the remaining **424 are still byte-identical** to the file shipped 2026-07-10.
- Every root governance/provenance file — `LICENSE`, `NOTICE.md`, `LICENSE-MAP.md`, `README.md`,
  `CONTRIBUTING.md`, `CHANGELOG.md`, `CHANGELOG-MIGRATION.md`, `manifest.json`, `VERSION`,
  `.scaffold-version`, `WAY-FORWARD.md`, `ADAPTER-PROMPT.md` — is **untouched since import**. Byte-identical,
  confirmed by `git diff 2eb9461 HEAD -- <path>` returning empty for every one.
- `CLAUDE.md` — the file that governs the assistant's identity on every session, including this audit
  session — has had **exactly one line changed** since import. It still opens "myPKA Scaffold © 2026
  Paperless Movement® S.L." and instructs every fresh session to adopt "Larry, the team orchestrator of
  myPKA." This is P0/P1 material that is simultaneously **the most operationally load-bearing file in the
  entire repository** (L0) — see the executive verdict for what this means for the extraction plan.
- `scaffold_version` in `manifest.json` has **never been bumped** since import — the `update-scaffold`
  mechanism has never been run. Every divergence from the imported tree is Fusion's own direct edit, not a
  scaffold-updater merge.

## Inherited wording, structure, identities — explicit inventory

| Inherited element | Evidence | Disposition |
|---|---|---|
| **"Larry" as the orchestrator identity/name** | `Team/Larry - Orchestrator/AGENTS.md` and `github/team/larry.png` both present at the *first* commit. The name and role predate Fusion entirely. | Concept/name is P0. The *content* of Larry's contract has since grown 186→487 lines (+313/-12) with Fusion's own delegation doctrine, CI-truth doctrine, worker-commissioning patterns — genuinely P2 content living inside a P0 container. Rewrite the identity/bootstrap wrapper from requirements; the accumulated operating doctrine is a strong extraction candidate on its own (see `03-fusion-owned-assets.md`). |
| **11 of the 12 original specialist identities** (Charta, Felix, Iris, Mack, Nolan, Pax, Penn, Pixel, Silas, Vera, Vex) | Every `.claude/agents/<slug>.md` shim for these 11 was present at the import commit. 8 of the 11 `Team/<Name>/AGENTS.md` contracts are **still byte-identical** to import (Charta, Felix, Iris, Mack, Nolan, Pixel, Silas, Vera, Vex minus the two below — see full per-specialist table in `01-component-inventory.md`); only Pax (+2 lines) and Penn (+3 lines) received small Fusion hooks. | Names, roles, and almost all contract text are P0, unmodified. These came bundled via the App Developer and Designer Expansion packs (Felix/Vex/Vera from App Developer; Iris/Charta/Pixel from Designer) merged into the base team at import — confirmed by `ADAPTER-PROMPT.md`'s own text: "Agent-packs already merged into the base... These need verification, not a rebuild." Rewrite from requirements if the *role* is wanted (frontend dev, security, QA, design-system, infographic, visual); do not carry the upstream contract text forward into a redistributable core. |
| **Bootstrap/activation flow** (`ADAPTER-PROMPT.md`, the `PKM/.user.yaml` first-run check in `CLAUDE.md`, the "single upfront consent" pattern) | `ADAPTER-PROMPT.md` untouched since import (32,491 bytes). `CLAUDE.md`'s first-run check logic is verbatim upstream. | P0, L0 (executes every session). The *concept* (idempotent personalization, one consent gate, Expansion install/verify, identity adoption) is sound and worth keeping; the *text and trademark wrapper* must not be carried forward verbatim. |
| **SOP/Guideline/Workstream template mechanics** (frontmatter schema, `SOP-rebuild-task-index` algorithm, the tasks `open/in-progress/done/cancelled` folder convention, journal `SOP-write-journal-entry`/`SOP-read-own-journal`) | 11 SOPs, 4 Guidelines, 2 Workstreams byte-identical since import (full list in `01-component-inventory.md`). | P0 mechanics. Genuinely reusable *pattern* (a task lifecycle, a journal convention) but the specific prose is upstream expression — reimplement the mechanism from the observed behavioural contract (folder-as-status, deterministic index rebuild), not by copying the SOP text. |
| **Cockpit viewer concept and its trademark-carrying name** | `Expansions/mypka-cockpit/` — 304 of 308 files byte-identical to import; the 4 that changed are the scaffold's own documented install-artifact generation (launcher scripts, `INDEX.md` version bump), not new Fusion product code. | P0/P3 (own PolyForm Noncommercial license, held by "myICOR" — a *different* copyright holder than the base scaffold's Paperless Movement S.L.). Fusion's actual reusable Cockpit work lives entirely **outside** this tree, at `services/cockpit/` — see `03-fusion-owned-assets.md`. Do not extract `Expansions/mypka-cockpit/` into a new core at all; it is a separately-licensed third-party runtime Fusion has not modified. |
| **Trademark terms in Fusion-authored content** | `ICOR`/`myICOR` appear in 3 genuinely Fusion-authored files as a *named future intake channel*, not upstream boilerplate: `Team Knowledge/SOPs/SOP-015-cairn-process-external-source.md` ("an ICOR course-note drop"), `Team Knowledge/Guidelines/GL-011-immutable-source-retention.md` ("ICOR adapter"), `Team/Cairn - Knowledge Intake Specialist/AGENTS.md` (4 references to "ICOR course-note drop / ICOR notes"). | These three files should be reviewed for trademark clearance before any commercial redistribution — they treat ICOR as a live/planned integration target, which reads differently from the incidental, lineage-acknowledging references found elsewhere (`Deliverables/` migration-coverage docs discussing Fusion's own relationship to ICOR/myPKA prior art). See `09-licence-and-provenance-risk-register.md`. |

## Files present at import, modified since (P1 — strongest "derived, not owned" candidates)

Full list (29 files), each independently confirmed via `git diff --stat 2eb9461 HEAD -- <path>`:

`.claude/agents/{nolan,pax,penn}.md` · `.gitignore` · `AGENTS.md` · `CLAUDE.md` · `Expansions/INDEX.md` ·
`PKM/My Life/Topics/ai-tooling.md` · `Team Knowledge/Guidelines/{GL-002-frontmatter-conventions,INDEX}.md` ·
`Team Knowledge/INDEX.md` · `Team Knowledge/SOPs/{INDEX,SOP-001-how-to-add-a-new-specialist,
SOP-004-vex-security-audit,SOP-close-task,SOP-list-open-tasks,SOP-rebuild-task-index,
SOP-write-session-log}.md` · `Team Knowledge/Templates/INDEX.md` ·
`Team Knowledge/Workstreams/{INDEX,WS-001-daily-journaling,WS-004-team-retro-and-self-improvement-loop}.md` ·
`Team Knowledge/session-logs/{README,_template}.md` · `Team Knowledge/tasks/INDEX.md` ·
`Team/{Larry - Orchestrator,Pax - Researcher,Penn - Journal Writer}/AGENTS.md` · `Team/agent-index.md`.

None of these were deleted-and-replaced; every one is an **incremental addition on top of upstream structure**
— e.g. `SOP-001` and `SOP-004` are structurally upstream SOPs with a small, dated Fusion addendum bolted onto
the end (a real example of one file carrying mixed P0-base + P2-addendum content). Treat the base procedure
text as P1 (rewrite from requirements) and the addendum clauses as P2 (candidate for direct carry-forward,
since the addendum content is itself new authorship, not upstream expression).

## Recommended disposition, upstream/derived material

**Do not copy any of the above verbatim into a new core.** For every P0/P1 item above, the *behavioural
requirement* it encodes (a named orchestrator persona; a delegating multi-specialist team; an idempotent
one-consent bootstrap; a folder-status task lifecycle; a deterministic session-log/journal convention) is a
legitimate design pattern worth keeping — but the requirement should be restated in Fusion's own words and
reimplemented, not lifted. See `07-clean-room-extraction-plan.md` for how each maps to the proposed `CORE`.
