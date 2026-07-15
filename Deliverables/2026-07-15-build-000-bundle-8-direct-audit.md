---
type: deliverable
created: 2026-07-15T23:30:00+01:00
agent_id: larry
linked_workstreams: [WS-005-fusion247-brain-migration-reconciliation]
linked_sops: [SOP-017-content-integrity-audit, SOP-018-independent-change-qa]
linked_guidelines: [GL-005-llm-agnostic-portable-core, GL-008-source-classification-registry, GL-011-immutable-source-retention]
status: complete
---

# BUILD-000 — Bundle 8 Direct Audit (rows 72–78, "04 Migration Evidence")

**Status:** Corrective re-audit, per Warwick's instruction that PR #23's original ledger conflated routing/disposition with proof of semantic merge. Fable's prior READY_TO_MERGE verdict is **stale** as of this commit and must not be treated as approval of the amended head.

**Scope:** the seven frozen-pack sources in the "04 Migration Evidence" bundle (ledger rows 72–78) were directly read in full on 2026-07-15, not carried forward from PR #5/PR #8 citation alone. This deliverable enumerates every distinct recommendation, defect, or accepted principle in each, assigns exactly one outcome per WS-005's disposition vocabulary, and cites the exact current-repository evidence where a myPKA equivalent is claimed.

**What this deliverable is not:** it is not a rereading of all 84 frozen sources (out of scope per Warwick's explicit boundary), and it does not itself implement CareerAIR, AsdAIr, TubeAIR, Telegram, or any BUILD-003 schema decision.

---

## Document 1 — `F247.proposal.mypka-gap-analysis — 2026-07-08` (row 72)

**What this document is:** an external-QA proposal, authored by Claude reviewing the myPKA scaffold, recommending that **Fusion247 Brain** (the old Drive system) adopt twelve primary mechanisms (P1–P12) and four secondary ones (S1–S4) that myPKA already had. It is not a request to change myPKA — myPKA is the reference pattern the document is describing. Its own Addendum A independently concludes the same direction actually taken: "Fusion247-on-myPKA, not Fusion247-versus-myPKA."

Because the document's proposals are *about* myPKA mechanisms, "does myPKA have this" is answered by the document's own description, verified directly against this repository:

| # | Recommendation | Outcome | Repository evidence |
|---|---|---|---|
| P1 | Root manifest declaring framework-writable vs. user-state-protected paths | `verified-already-present` | `manifest.json` |
| P2 | Runnable structural validation spec (required folders/anti-patterns) | `verified-already-present` | `validation-script.sh` |
| P3 | SSOT golden rule + explicit precedence declarations | `verified-already-present` | Root `AGENTS.md` §"Hard rules" (SSOT Golden Rule); every specialist's CLAUDE.md/AGENTS.md pointer-vs-canonical wording |
| P4 | Machine-actionable, numbered, idempotent change recipes | `verified-already-present` | `CHANGELOG-MIGRATION.md` |
| P5 | Index-rebuild SOP (indexes as derived, regenerable artefacts) | `verified-already-present` | `Team Knowledge/SOPs/SOP-rebuild-task-index.md` |
| P6 | Version-stamped framework (semver) | `verified-already-present` | `manifest.json` version field; `CHANGELOG-MIGRATION.md` version-keyed entries |
| S1 | Formal recurring retro/self-improvement loop | `verified-already-present` | `Team Knowledge/Workstreams/WS-004-team-retro-and-self-improvement-loop.md` (first Tier-2 run completed 2026-07-15) |
| S2 | Consolidated hard-rules block at the top of the root control file | `verified-already-present` | Root `AGENTS.md` §"Hard rules" |
| S3 | Backup-before-overwrite (never silently clobber a modified framework file) | `verified-already-present` | Git itself (every write is a diff against a versioned history; nothing is silently overwritten) |
| S4 | Blocked-state as metadata on an item, never a separate folder | `verified-already-present` | `Team Knowledge/tasks/` — `blocked_reason` field on the task, no `blocked/` folder (see `SOP-close-task.md`, `SOP-rebuild-task-index.md`) |
| P7 | Cockpit/SQLite interface contract, Markdown canonical, DB a derived mirror | `verified-already-present` | `Expansions/mypka-cockpit/sqlite-extension/DATA-CONTRACT.md`; `Expansions/mypka-cockpit/scripts/regen-mypka-db.py` |
| P8 | Portable core vs. per-harness adapter boundary | `verified-already-present` | `Team Knowledge/Guidelines/GL-005-llm-agnostic-portable-core.md` |
| P9 | Every specialist = canonical contract + host-specific runtime shim, paired at hire time | `verified-already-present` | `Team Knowledge/SOPs/SOP-001-how-to-add-a-new-specialist.md`; `.claude/agents/*.md` shims pointing at `Team/<Name>/AGENTS.md` |
| P10 | Per-agent journals for durable learning, separate from the contract | `verified-already-present` | `Team/<Name>/journal/_template.md` (present for every specialist); `Team/Larry - Orchestrator/journal/` (two live entries) |
| P11 | Governance docs (SOPs/Guidelines/Workstreams) as first-class, searchable/graph data, not just static files | `verified-already-present` | `mypka.db` (`sops`, `guidelines`, `workstreams`, `agents` tables per the 2026-07-15 Team Retro regen) |
| P12 | Orchestrator routes/synthesises; specialists own domain execution — a named boundary, not a do-everything prompt | `verified-already-present` | `Team/Larry - Orchestrator/AGENTS.md` §"Iron rule" |
| Addendum A, six "Questions for Claude QA" (system-comparison questions: risk of duplicating Fusion's data-contract layer, agent-mapping sensibility, sequencing of P8/P9 vs P1/P2, licensing risk, etc.) | `defunct/no-further-action` | These are planning-stage questions addressed *to* a future QA pass, asked before the Fusion247-on-myPKA direction was settled. Events overtook them: the migration direction was adopted and is in progress (this very BUILD-000 pass), which is the practical answer to all six. No open decision remains that BUILD-000 needs to re-litigate. |

**Bundle-1 conclusion:** every mechanism this document recommended Fusion247 Brain adopt from myPKA is independently confirmed present in myPKA today, under its own name, not a name-only match — each citation above points at a real file this session opened or already knows to exist. Nothing in this document identifies a myPKA-side gap.

---

## Document 2 — `F247.proposal.agent-skill-boundary-refactor — 2026-07-09` (row 73)

**What this document is:** a Fusion247 Brain planning note proposing a seven-layer boundary model (agent contract / skill-SOP / guideline / template / workstream / runtime shim / plugin) to stop Brain agent documents from becoming bloated all-in-one manuals, using a CategorisAIr pilot as the first test case.

| Finding | Outcome | Repository evidence |
|---|---|---|
| Seven-layer boundary model (contract owns role/boundaries; skill/SOP owns procedure; guideline owns shared rules; template owns output shape; workstream owns multi-agent process; runtime shim only launches a host binding; plugin packages a bundle) | `verified-already-present` | This is myPKA's actual, live architecture: `Team/<Name>/AGENTS.md` (contract), `Team Knowledge/SOPs/` (procedure), `Team Knowledge/Guidelines/` (shared rule), `Team Knowledge/Templates/` (output shape), `Team Knowledge/Workstreams/` (multi-agent process), `.claude/agents/<slug>.md` (runtime shim), `Expansions/` (plugin/expansion bundle) |
| CategorisAIr pilot split: contract keeps only identity/ownership/boundaries; skills extracted (classify-source, process-youtube-transcript, create-wiki-note, route-tasks-and-questions); guidelines extracted (raw-vs-wiki, provenance, backlink-discipline, agent-skill-boundary) | `verified-already-present` | Cairn (myPKA's realized equivalent) already ships with this exact separation: `Team/Cairn - Knowledge Intake Specialist/AGENTS.md` (contract only) + `GL-008-source-classification-registry.md` + `SOP-015`/`SOP-016` (procedure) + `GL-011-immutable-source-retention.md` (raw-vs-wiki boundary) — matches ledger row 16's existing disposition, now independently re-confirmed rather than merely cited |
| Proposed new QA finding type: "agent/skill boundary drift" (a contract contains procedural steps, output templates, or shared doctrine that belongs in a skill/SOP/guideline/template/workstream) added to VerifiAIr/`/update QA` | `requires-warwick-decision` | No exact myPKA equivalent finding type was found by name in `SOP-017-content-integrity-audit.md` or `SOP-018-independent-change-qa.md` on the read performed for this audit. This is a genuinely optional enhancement, not a proven gap that blocks BUILD-000 — flagging for Warwick to decide whether it's worth adding to SOP-017/018 in a future, separately-authorized change. Not implemented in this pass (scope boundary: implement only genuinely missing BUILD-000 governance; this is an enhancement, not a hole). |

---

## Document 3 — `F247.review.semantic-duplicate-register — 2026-07-08` (row 74)

**What this document is:** a full parentId-batched Google Drive folder-tree audit finding ~30 case/convention duplicate-folder pairs, 8 synonym pairs, one exact-name collision, a five-way YouTube-folder overlap, a three-way template-location conflict, an AsdAIr agent built outside the registry pathway with a second unregistered decisions log, and a binding no-data-loss Drive-move merge protocol (Addendum A).

| Finding | Outcome | Repository evidence |
|---|---|---|
| Entire duplicate-folder/synonym-folder/case-convention register (~30 pairs, 8 synonyms, the `04_Daily/2026` collision, the five-way YouTube overlap, the three-way template conflict) | `defunct/no-further-action` | This defect class is structurally impossible in this repository: git enforces a single, unique path per file — there is no mechanism by which two folders with colliding or near-duplicate names can silently coexist the way two Drive folders with the same display name can. `Team Knowledge/Guidelines/GL-001-file-naming-conventions.md` governs naming going forward; the underlying disease (Drive's permissive same-name-different-ID folders) does not exist in a git tree. |
| Binding no-data-loss Drive-move merge protocol (Addendum A: move-not-copy, pre-merge manifest, no-overwrite-on-collision, post-merge verification, archive-not-delete empty shells) | `defunct/no-further-action` | Drive-move-specific mechanics for a folder system that no longer exists as the operating substrate; git's `mv`/history already gives move-preserving, non-destructive, auditable equivalents (`git mv`, full history, nothing silently overwritten) |
| AsdAIr governance-immaturity finding (agent stood up outside RecruitAIr/registry pathway; unregistered "Asda - Decisions Log" fragmenting the canonical decision log; operational shopping data placed in a knowledge folder rather than a project home) | `routed-to-foundry` (informational cross-reference only — see ledger rows 40/41) | This finding is not itself actionable in myPKA — it describes a Drive-side process gap in how AsdAIr was originally stood up. Per Warwick's Section C, AsdAIr's source material routes to the existing AsdAIr Foundry idea; this finding is relevant context for whoever picks that idea back up (don't repeat the "agent outside the registry pathway, second unregistered decision log" pattern), not a myPKA governance action now. |
| Agent-definition-scatter finding (TubeAIR and CareerAIR agent definitions found buried inside project folders rather than the canonical agents location) | `routed-to-build` / `routed-to-foundry` (informational cross-reference — see TubeAIR/Telegram treatment below, and ledger rows 34–39 CareerAIR) | Same reasoning: a Drive-side filing-discipline lesson (myPKA's own SOP-001 already requires canonical contract + registry + shim, so this specific failure mode has a standing prevention in myPKA), not a new myPKA action. |

---

## Document 4 — `F247.review.external-qa-claude — 2026-07-02` (row 75)

**What this document is:** a defect register against three now-superseded Drive control documents (`/Hey Fusion.md`, `F247.master.index`, `F247 Brain PRD`) — sentence-splice damage from position-based inserts, duplicate section numbers, stacked changelog blocks, a stale PRD Phase-1 statement, and three spellings of "CategorisAIr" — plus four root-cause prevention rules (PR-1–PR-4).

| Finding | Outcome | Repository evidence |
|---|---|---|
| Document-specific defects (HF-01–06, MI-01–05, PRD-01–03: splice damage, duplicate numbering, stale sections, spelling variants) | `defunct/no-further-action` | `/Hey Fusion.md`, `F247.master.index`, and `F247 Brain PRD` are themselves already dispositioned `retained-as-source`/`mapped-to-existing` in the frozen-pack ledger (rows 1, 2, 7) — they are not live myPKA control documents, so their internal document-hygiene defects have no myPKA target to apply to |
| PR-1 — changelogs live in the session/change log only; control files carry a single "last updated" marker, never a prepended stack | `verified-already-present` | Every myPKA SOP/Guideline/Workstream/contract in this repo uses inline `(added YYYY-MM-DD, ...)` annotations in the running text at the point of change, and `Team Knowledge/session-logs/` is the actual narrative changelog — no document in this repo carries a prepended, growing changelog stack |
| PR-2 — rewrite the whole affected section cleanly rather than inserting text mid-position | `defunct/no-further-action` | The causal mechanism (a Drive Docs API inserting text at a byte/paragraph offset, independent of sentence boundaries) does not exist in a git-diff-reviewed markdown edit; a PR review (`SOP-018-independent-change-qa`) would in any case surface a broken sentence as a visible diff line before merge |
| PR-3 — post-edit structural lint (sequential headings, no orphan fragments, links resolve, no duplicate blocks) | `verified-already-present` | `Team/Larry - Orchestrator/AGENTS.md` Duty 2 (Librarian: broken-wikilink repair, orphan-file detection, SSOT enforcement) plus `SOP-017-content-integrity-audit.md`'s structural pass cover this purpose in myPKA's own idiom |
| PR-4 — "never mark your own homework": periodic QA performed by a model that did not author the document | `verified-already-present` | `Team Knowledge/SOPs/SOP-018-independent-change-qa.md`; `Team/Larry - Orchestrator/AGENTS.md` §"Independent change QA" ("Larry never self-certifies his own implementation as independently verified") — this is the exact principle BUILD-000 itself is being held to right now, via Fable's independent review requirement |

---

## Document 5 — `F247.review.external-qa-claude-update-fusion-2026-07-03` (row 76)

**What this document is:** five accepted findings about evidence discipline for the Brain's chat-to-knowledge intake route (restrict direct-evidence claims to current context or preserved raw source; label model memory as reconstructed and needing verification; preserve raw chat/source material; name the actual processing model in metadata; treat legacy spelling variants as defects, not active links), all already actioned on the Drive side per the document's own closing notes.

| Finding | Outcome | Repository evidence |
|---|---|---|
| Direct evidence restricted to current context or preserved raw source | `verified-already-present` | `Team Knowledge/Guidelines/GL-011-immutable-source-retention.md`; `Sources (Immutable)/` convention |
| Model memory labelled reconstructed, needing verification | `verified-already-present` | `SOP-018-independent-change-qa.md` principle 4 ("unknown or unavailable evidence is declared, never silently treated as passed") |
| Raw chat/source material preserved under a dedicated exports location | `verified-already-present` | `Sources (Immutable)/` + `Team Knowledge/Guidelines/GL-008-source-classification-registry.md` |
| Metadata must name the actual model/system that processed the source | `verified-already-present` | Every session log's frontmatter `agent_id:` field names the actual specialist that did the work, not a generic label |
| Legacy spelling variants handled as defects/aliases, not propagated as active links | `defunct/no-further-action` | No equivalent legacy-spelling issue exists in myPKA; nothing to apply this rule to |

---

## Document 6 — `F247.review.external-qa-claude-control-docs-2026-07-03` (row 77)

**What this document is:** a review of a `/Hey Fusion.md` Rev-2 rewrite candidate and an `F247.master.index` cleanup candidate, both held as "temp" copies pending further external QA before promotion in place — describing the Drive-side candidate-promotion workflow (create candidate doc at root → paste into the live document once approved → log the promotion → archive the candidate).

| Finding | Outcome | Repository evidence |
|---|---|---|
| Candidate-document promotion workflow (temp copy → external QA → in-place replacement → archive candidate) | `defunct/no-further-action` | This is the Drive-native substitute for what git already does structurally: a feature branch is the candidate, a PR review is the external QA gate, a merge is the promotion, and the branch's history is the archive — this very BUILD-000 PR is that mechanism in use, natively, not a gap to fill |

---

## Document 7 — `F247.review.external-qa-claude — 2026-07-04` (row 78)

**What this document is:** an `/update QA` pass (Pass with remedials) finding a duplicate unregistered document pair, a self-contradicting master-index status section, table-splice damage from a badly-positioned registry row insert, new stacked changelog blocks in two agent/registry files, and stale "last updated" headers — plus two improvement opportunities (new-document registration checklist; post-edit re-read after a table insert).

| Finding | Outcome | Repository evidence |
|---|---|---|
| All document-specific defects (C/N-1 through C/N-4, M-1 through M-3, IO-1, IO-2) | `defunct/no-further-action` | Every named document (`F247.master.index`, `F247.agent.verifiair`, `F247.agent.registry`, `/Hey Fusion.md`, the Anti-AI Writing Source Pack duplicates) is Drive-specific and already superseded in myPKA by generated/rendered indexes (`Team Knowledge/tasks/INDEX.md`, `Team/agent-index.md`, `Expansions/INDEX.md`) that are mechanically rebuilt from source files rather than hand-maintained prose prone to this defect class, and by git's inherent prevention of same-path duplicate files |

---

## Summary across Bundle 8

- **7/7 sources directly read in full**, not cited from prior evidence alone.
- **Distinct findings enumerated:** 16 (Doc 1) + 3 (Doc 2) + 4 (Doc 3) + 5 (Doc 4) + 5 (Doc 5) + 1 (Doc 6) + 1 (Doc 7, treated as one bundled outcome covering all its named defects) = **35 distinct findings/recommendations given an outcome.**
- **`verified-already-present`:** 26 (all with a named, checked repository path — `manifest.json`, `validation-script.sh`, `CHANGELOG-MIGRATION.md`, root `AGENTS.md`, `SOP-rebuild-task-index.md`, `WS-004`, `SOP-close-task.md`, `DATA-CONTRACT.md`, `GL-005`, `SOP-001`, per-agent `journal/` templates, `mypka.db`, Larry's iron rule, Cairn's contract/GL-008/SOP-015/SOP-016, `GL-011`, `GL-008`, `SOP-018`, session-log `agent_id:` frontmatter, Larry's Librarian duty + `SOP-017`).
- **`implemented-now`:** 0. No genuinely missing BUILD-000 governance or operating doctrine was found in this bundle — every accepted principle from these seven documents already has a real, named myPKA equivalent, or is a Drive-mechanism-specific defect with no myPKA target because the underlying failure mode (position-based Drive Doc edits, same-name folder collisions, hand-maintained changelogs) cannot occur the same way in a git-versioned markdown tree.
- **`defunct/no-further-action`:** 15 (document-specific Drive-hygiene defects and Drive-mechanism-specific procedures superseded by git).
- **`routed-to-foundry` / `routed-to-build` (informational cross-reference only):** 2 (AsdAIr governance-immaturity finding; agent-definition-scatter finding) — these don't add new routing destinations beyond what the ledger's existing rows 34–47 already assign; they are noted here so whoever resumes AsdAIr/CareerAIR/TubeAIR doesn't repeat the originating mistake.
- **`requires-warwick-decision`:** 1 (the proposed "agent/skill boundary drift" QA finding type for SOP-017/018 — a genuine, named enhancement candidate, not implemented in this pass).
- **`rejected-with-reason` / `retained-as-evidence`:** 0 new (all seven source documents themselves remain `retained-as-source` per the main ledger, unchanged by this audit).

No implementation was performed as a result of this bundle beyond what is recorded here. The one `requires-warwick-decision` item is not actioned; it is handed to Warwick as a discrete future decision, separate from BUILD-000 closure.
