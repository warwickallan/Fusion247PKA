---
# Identity
id: tsk-2026-07-11-001
title: "Absorb legacy independent-change QA doctrine (SOP-018) and close T009/T013 through evidence"

# Ownership & priority
assignee: larry
priority: 2

# Status (mirrors folder location)
status: open
blocked_reason: null
blocked_by: null

# Time
created: 2026-07-11T07:00:00Z
updated: 2026-07-11T07:30:00Z
due: null

# Provenance
created_by: larry
source: Fable/ChatGPT brief, relayed by Warwick, 2026-07-11 — following the migration closure audit
parent: null

# Cross-references — REQUIRED, even if empty array. Seven slots. The act of filling these is the whole point.
# See [[GL-004-task-resource-linking]] for the one-way rule (task→resource, never the reverse) and slug formats.
linked_sops:
  - SOP-015-cairn-process-external-source
  - SOP-016-cairn-process-youtube-transcript
  - SOP-017-content-integrity-audit
  - SOP-007-audit-content-for-design-system-compliance
linked_workstreams:
  - WS-004-team-retro-and-self-improvement-loop
linked_guidelines:
  - GL-008-source-classification-registry
  - GL-009-public-private-knowledge-boundary
  - GL-010-warwick-knowledge-value-profile
  - GL-011-immutable-source-retention
linked_my_life: []
linked_session_logs:
  - 2026-07-11-05-00_larry_content-integrity-qa-implementation
  - 2026-07-11-06-00_larry_migration-closure-audit
linked_journal_entries: []
linked_deliverables:
  - 2026-07-11-migration-closure-audit

# Tagging
tags: [tier-1-proposal, qa, sop-018, t009, t013, fusion247-brain, awaiting-approval]
---

# Absorb legacy independent-change QA doctrine (SOP-018) and close T009/T013 through evidence

## What this is

**This is a build plan, not yet the build.** Per Warwick's explicit instruction, this task captures the plan and scope for PR #9 so he can check it before any of it is executed. Nothing described below has been built yet except the two verifications noted in §Pre-work already done.

The migration closure audit (`Deliverables/2026-07-11-migration-closure-audit.md`) found that Fusion247 Brain had three QA layers, and Fusion247PKA has only cleanly re-expressed two of them:

1. **Structural maintenance** — now Larry's automatic Librarian pass (Duty 2).
2. **Content integrity** — now Pax running `SOP-017-content-integrity-audit`.
3. **Independent change QA** — the old Claude `/update QA` skill (`F247.skill.update-qa-claude`). This is the piece with no clean current equivalent. The accepted Fusion247 decision was explicit: this capability is a *skill*, not a permanent agent, and it *complements* rather than replaces VerifiAIr (the structural checker). That principle should be preserved, not re-litigated.

This task is intended to close two specific outstanding Drive Work List rows the audit found unresolved, **subject to evidence and independent confirmation**: **T009** (run a QA review over the Hermes pilot outputs — never actually done) and **T013** (run a second source-to-WIKI test after Hermes — never actually done; reprocessing Hermes itself does not satisfy this).

## Pre-work already done (verification only, before committing to the plan)

Three things were checked directly before writing this plan, because building against wrong assumptions is exactly the failure mode this whole exercise exists to catch. **None of these checks are independent QA** — they were performed by Larry, the author of this plan, directly against source material. They are source verification, not independent review.

1. **A filename inaccuracy in the relayed brief, corrected.** The brief's "current files to compare" section named `SOP-015-general-external-source-intake.md` and `SOP-016-process-long-form-transcript.md`. Those files don't exist under those names. The real files are `SOP-015-cairn-process-external-source.md` and `SOP-016-cairn-process-youtube-transcript.md`. This plan uses the real names throughout.
2. **T013's proposed second source (the Wanderloots transcript) directly source-verified by Larry against Google Drive; not an independent QA review.** Warwick connected Google Drive access this session (`mcp__Google_Drive__*` tools, tested and working) and separately supplied the file directly as an upload. Read a content probe of the Drive copy (Drive ID `1Rr0dxWpyLE6xh-OhRMBJ7RN0mYUpqslMeJJAwIKiozY`, ~177,000 characters, a YouTube auto-transcript, creator "Callum / Wanderloots," video "the LLM Wiki — a shared memory layer for AI agents," ~34 minutes). Genuinely a different creator and a different specific system than Hermes/NetworkChuck, while conceptually adjacent (both are "AI agent memory/knowledge layer" content) — which is exactly the harder test Fable's brief wanted: can Cairn recognize adjacent-but-distinct material and decide correctly whether it earns promotion, enrichment, or "no promotion," rather than mechanically treating "another AI tooling video" as automatically note-worthy.
3. **The legacy QA-skill source map, corrected.** The first version of this plan claimed the root git-mirror copy of `F247.skill.update-qa-claude.docx` was "a superseded snapshot only — live copy not in this export." That was wrong. The root file (70 lines, "Rev 2," dated active 2026-07-04, token-optimised 2026-07-08) is the current, active document. Fetched the live Drive Rev 2 copy directly (ID `1CZTcbqxAa28nVyttoFGW5dDz4RMuDsDNsv4qSlDsfvs`, `modifiedTime: 2026-07-10T01:04:36.790Z`) via the tested Google Drive connection and compared it against the git-mirror root file: **content matches exactly** (same Rev 2 text, same 15+1 checklist items, same Role Boundaries section). The only genuinely superseded document is the separate, longer (460-line) pre-Rev2 snapshot already correctly archived at `08_Archive/Superseded/ZZ_superseded - F247.skill.update-qa-claude - pre-Rev2 snapshot 2026-07-08.docx`. This is again Larry's own direct source comparison, not an independent review.

## Source map (corrected, twice)

| Source | Location | Purpose |
|---|---|---|
| Claude external QA skill (Rev 2, active) | Git mirror root: `F247.skill.update-qa-claude.docx`; confirmed identical to live Drive Rev 2, ID `1CZTcbqxAa28nVyttoFGW5dDz4RMuDsDNsv4qSlDsfvs` (directly compared, content matches) | The capability being absorbed |
| Claude external QA skill (pre-Rev2, superseded) | `Fusion247 Brain/08_Archive/Superseded/ZZ_superseded - F247.skill.update-qa-claude - pre-Rev2 snapshot 2026-07-08.docx` (460 lines) | Historical only — genuinely superseded, kept separate from the row above |
| VerifiAIr contract | `Fusion247 Brain/00_System/agents/F247.agent.verifiair.docx` | Structural-checker boundary this must not duplicate |
| Accepted decisions | `Fusion247 Brain/03_Knowledge/Decisions/F247.decision-log.docx` | "Skill not agent," VerifiAIr/Claude-QA boundary |
| External QA reviews (2026-07-02, 2026-07-04, control-docs, update-fusion) | `Fusion247 Brain/00_System/Governance/Reviews/` | Worked examples of the actual failure modes this SOP must catch — positional splice damage, duplicate numbering, stacked changelogs, silently unregistered documents, broken tables, author-reviews-remembered-intent |
| Agent/skill boundary doctrine | `Fusion247 Brain/00_System/Governance/F247.proposal.agent-skill-boundary-refactor — 2026-07-09.docx` | Already read in full during the closure audit; governs how SOP-018 should be shaped (procedure lives in a skill/SOP, not bloated into an agent contract) |
| Critical Panel Review skill | `F247.skill.critical-panel-review.docx` (repo root in the fusion247brain mirror) | Confirmed present. Read during actual build; kept separate and only cross-linked, never inlined, per the brief |
| Hermes raw transcript | `Fusion247 Brain/02_Sources/YouTube Transcripts/Transcript.network.chuck.hermes.docx` | T009 evidence base |
| Wanderloots transcript | Google Drive ID `1Rr0dxWpyLE6xh-OhRMBJ7RN0mYUpqslMeJJAwIKiozY`; also supplied directly as an upload this session | T013 evidence base |
| Session Log | `Fusion247 Brain/00_System/Indexes/Session Log.docx` | Cross-check for T009/T013 history |
| `/Hey Fusion.md` | Google Drive root, ID `1ay4JpaLkKLJLWd0QuBYpBF32K9ehrNdUlk-x3DxfIz0` | Now reachable via the tested Drive connection — will read directly rather than relying on audit-extract citations, since live access exists |

**Current Fusion247PKA files to compare** (corrected list): `AGENTS.md`, `Team/Larry - Orchestrator/AGENTS.md`, `Team/Pax - Researcher/AGENTS.md`, `Team/Cairn - Knowledge Intake Specialist/AGENTS.md`, `Team Knowledge/SOPs/SOP-015-cairn-process-external-source.md`, `Team Knowledge/SOPs/SOP-016-cairn-process-youtube-transcript.md`, `Team Knowledge/SOPs/SOP-017-content-integrity-audit.md`, `PKM/My Life/Topics/ai-tooling.md`, `Deliverables/2026-07-11-migration-closure-audit.md`, `tsk-2026-07-10-006` (Task 006 design record, now `done/`), the Cairn/Hermes pilot's task and session records.

## Build plan (what I will actually do, once approved)

### Step 1 — Doctrine-absorption matrix

Read every source above in full (not skimmed), and for every durable rule found, record: historical principle → exact source → current Fusion247PKA equivalent → disposition (`already-covered` / `strengthen-existing` / `create-in-new-SOP` / `intentionally-not-absorbed`) → reason → target file → duplication risk. This is Larry's own re-derivation work, not a copy pass — matches the same discipline used for GL-006, GL-008, and every other absorption this engagement has done.

### Step 2 — `SOP-018-independent-change-qa.md`

New, lean, model-independent SOP — the portable successor to `/update QA`, not a Claude-only contract. Preserves the "skill not agent" decision explicitly. Default orchestration: Larry scopes the request; Pax is the default evidence/methodology owner; genuine reviewer independence is sought wherever practical (a different model/runtime/session, not just a persona switch inside the same authoring session); where genuine independence isn't available, the report states plainly **"Same-model review — not independently verified"** rather than overclaiming. A final external (Fable/ChatGPT or other non-author) pass remains the actual independence gate before Warwick treats a material migration/build PR as verified — this formalizes what has, in practice, already been this engagement's real QA loop.

Procedure will cover (re-derived in myPKA's own SOP voice, matching the shape of SOP-007/SOP-017, not copied from the brief's outline): defining the review window; recording requested-vs-claimed-vs-actual changes; checking both directions (claims against files, files against claims); reading the relevant control set rather than the whole repo by habit; source-of-truth precedence when documents conflict; a concrete non-conformance checklist (acceptance criteria, provenance, register/task/session hygiene, links, fabricated content, stale/contradictory instructions, duplicate source-of-truth files, schema/ontology/boundary drift, structural damage after edits — headings, numbering, tables, fragments); re-reading literal edited output rather than validating against remembered intent; severity classes (Critical/Major/Minor/Observation/Improvement); a Pass/Pass-with-observations/Pass-with-remedials/Fail verdict; report-only by default, no destructive or boundary-rewriting action without Warwick's approval; GL-009/SOP-017's privacy rules applied to the QA report itself; blocked-tool and unverifiable-evidence declared immediately, never silently treated as passed; never declaring the system clean while unresolved material findings remain.

### Step 2a — Small, justified SOP-017 amendment (filename collision, not architectural expansion)

This plan will run at least two `SOP-017` content-integrity audits on the same date (T009's Hermes check, T013's Wanderloots check). `SOP-017`'s current report path — `Deliverables/YYYY-MM-DD-content-integrity-audit.md` (public) / `PKM/My Life/Current Context/audits/YYYY-MM-DD-content-integrity-audit.md` (private) — has no time or scope component, so same-day runs would collide and silently overwrite each other's evidence. Fix: add an `HH-MM-<scope>` segment to both paths — `YYYY-MM-DD-HH-MM-<scope>-content-integrity-audit.md` in both locations. This is a one-line path-format fix to prevent evidence loss, not a scope or architecture change to the SOP.

### Step 3 — Minimal contract changes only

- **Root `AGENTS.md`**: one new LLM-agnostic trigger section ("`/update QA`", "QA the recent Brain changes", "check this PR before merge", "independently verify what changed", "compare what was requested with what was actually built") routing to SOP-018 — not to SOP-017 alone.
- **Larry's contract**: four durable routing principles only — never self-certify his own implementation as independently verified; a clean task board or closed-task-count is not completeness evidence for a migration/build claim (this is, verbatim, the lesson this whole audit thread has been teaching); route change QA through SOP-018 and record author/reviewer/independence level; unknown or unavailable evidence is declared, never silently treated as passed.
- **Pax's contract**: a concise "independent change QA" mode — literal artefact over author memory, both-directions diff-checking, methodology/access limitations stated, report-only by default, findings separated from optional improvements, no product decisions made for Warwick.
- **SOP-017**: unchanged in substance — a cross-link added explaining when SOP-018 is the correct procedure instead. No merge of the two SOPs.
- **Critical Panel Review**: stays separate and callable; SOP-018 may invoke it for a high-risk artefact but never inlines its logic.

### Step 4 — T009 (Hermes QA run)

Two distinct checks, not one blended pass: (A) a `SOP-017` content-integrity check over the existing Hermes-derived note in `PKM/My Life/Topics/ai-tooling.md` against the raw transcript; (B) a `SOP-018` independent-change check over the Cairn pilot itself — what it claimed to do vs. what it actually changed, whether all changed canonical files were logged, whether intake/filing/promotion boundaries were respected, whether later corrections changed the result without updating provenance. Written up as a report, findings not silently fixed in the same pass.

### Step 5 — T013 (genuine second source)

Process the Wanderloots transcript through the current `SOP-015`/`SOP-016`/Cairn route, capturing the raw source into `Sources (Immutable)/` per `GL-011` first. A successful outcome may legitimately be "no promotion" if the source is redundant or adds no worthwhile knowledge beyond what `ai-tooling.md` already carries — manufacturing a note to look productive is an explicit non-goal. Then run `SOP-017` against any resulting change, and `SOP-018` against the processing operation as a whole.

### Step 6 — Explicit output files (tracked, unique per report — no "write a report" left unspecified)

- `Deliverables/2026-07-11-independent-change-qa-doctrine-absorption.md` — the doctrine-absorption matrix.
- `Deliverables/2026-07-11-HH-MM-t009-hermes-content-integrity-audit.md` — T009, SOP-017 pass.
- `Deliverables/2026-07-11-HH-MM-t009-hermes-independent-change-qa.md` — T009, SOP-018 pass.
- `Deliverables/2026-07-11-HH-MM-t013-wanderloots-intake-disposition.md` — T013, Cairn's actual intake result.
- `Deliverables/2026-07-11-HH-MM-t013-wanderloots-content-integrity-audit.md` — T013, SOP-017 pass. If Cairn correctly disposes "no promotion," this file still gets written, stating explicitly "not applicable: no living-knowledge change" — the outcome must be explicit, never inferred from a missing file.
- `Deliverables/2026-07-11-HH-MM-t013-wanderloots-independent-change-qa.md` — T013, SOP-018 pass.

### Step 7 — Two-stage closure (implementation ≠ closure)

This is the sequence, made explicit rather than implied:

1. Larry builds `SOP-018`, runs both tests, writes all six output files above.
2. Larry pushes the implementation, but **leaves T009/T013 marked pending independent confirmation, the migration-closure-audit rows unresolved/pending, and this task open** — not done.
3. Larry returns PR #9 to Warwick and Fable with the **exact head SHA** of the pushed implementation.
4. Fable (or another genuinely non-author reviewer) reviews that SHA and the underlying source evidence.
5. Larry records in Git: reviewer identity, model/runtime, review date, the reviewed head SHA, verdict, and any limitations/remedials.
6. **Only then** does Larry update the migration audit, close T009/T013, and move this task to `done/`.

## Evidence-trail requirement (every T009/T013 report)

Raw source payloads are not necessarily committed to this repo. Every report in Step 6 must therefore include, so an independent reviewer can actually check the work rather than trust it: source title; git path or Drive ID; the `Sources (Immutable)/INDEX.md` register entry; content hash where available; the exact access method used (git mirror / Google Drive / direct upload); any access limitation encountered; and timestamp anchors supporting each material finding. The Critical Panel Review skill may be invoked to challenge a report's own reasoning, but a panel run by the authoring model is still same-model review, not external independence — its use (if any) must be declared the same way.

## Scope and exclusions (explicit, per the brief)

This PR does **not** touch: the `Client Delivery/` synthetic worked-example engagement, the GL-006 `lessons`/`dependency` decision, a Warden engagement-intake SOP, golden-master templates, `build.icor.md` provenance recording (beyond citing it where directly relevant), the final Drive handover decision, CareerAIR, AsdAIr, the TubeAIR capture adapter, the ICOR course-note adapter, or ClickUp/Withings connectors. Those remain exactly where the closure audit and the prior conversation left them.

## Closure rule

T009 and T013 are **not** marked resolved merely because the SOP was created, a report exists, the task ran, Cairn processed a source, or a same-model reviewer found no issue from memory. They close only where the report contains real evidence and an independent reviewer (Fable/ChatGPT or equivalent non-author pass) confirms the result, per the two-stage sequence in Step 7. This task itself will not be marked `done` until both close on that basis.

## Success criteria

- Warwick reviews this plan and either approves it as-is or redirects it. **Approved 2026-07-11**, subject to the six corrections folded into this revision.
- Implementation: doctrine-absorption matrix, `SOP-018`, the SOP-017 filename-disambiguation amendment, minimal contract edits, all six T009/T013 output files, pushed to this PR with T009/T013 and this task left pending. PR returned to Warwick/Fable with the exact head SHA — no merge, no premature closure.

## Updates

- 2026-07-11 07:00 (larry) — created. Plan-only, per Warwick's explicit "write the plan and brief, I'll come back once checked" instruction. Corrected one filename inaccuracy in the relayed brief (SOP-015/016 names) and directly source-verified the Wanderloots transcript's accessibility/genuineness against Google Drive (not an independent QA review — Larry is the plan's author).
- 2026-07-11 07:30 (larry) — Warwick approved the plan's direction, subject to six corrections, none architectural: (1) removed all "independently verified" language for Larry's own source checks, replaced with "directly source-verified... not an independent QA review"; (2) corrected the QA-skill source map — the root git-mirror `F247.skill.update-qa-claude.docx` is the live, active Rev 2 document, confirmed identical to the live Drive copy (ID `1CZTcbqxAa28nVyttoFGW5dDz4RMuDsDNsv4qSlDsfvs`) by direct comparison, not superseded; only the separate pre-Rev2 snapshot is superseded; (3) "this task also closes T009/T013" changed to "intended to close... subject to evidence and independent confirmation"; (4) added a small, justified SOP-017 filename-disambiguation amendment (`HH-MM-<scope>` segment) to prevent same-day audit reports overwriting each other; (5) defined six explicit, unique output file paths rather than "write a report"; (6) made closure explicitly two-stage (implementation push → PR returned with head SHA → independent review → recorded verdict → only then closure) and added the evidence-trail requirement (source title, path/ID, register entry, hash, access method, limitations, timestamp anchors) to every report. Proceeding to implementation now.
- 2026-07-11 08:00 (larry) — Dispatched Cairn and Pax in parallel. Cairn processed the Wanderloots transcript (T013 intake): disposition **Surface for Warwick**, `ai-tooling.md` untouched (correctly judged redundant with myPKA's own already-implemented architecture; four tactical patterns surfaced for Warwick's own decision instead of manufactured busywork). Report: `Deliverables/2026-07-11-08-00-t013-wanderloots-intake-disposition.md`. Pax wrote the doctrine-absorption matrix (`Deliverables/2026-07-11-independent-change-qa-doctrine-absorption.md`, 27 rows) and built `SOP-018-independent-change-qa.md` from it, plus its own contract's "independent change QA" mode and the one-line SOP-017 cross-link. Headline finding (matrix row #26): the old `/update QA` had reviewer independence for free, by construction (Claude auditing GPT/Fusion — different models); myPKA's single-session default doesn't, which is exactly why the "Same-model review — not independently verified" honesty rule matters here more than in the source doctrine. Both same-model passes, not yet independently reviewed. Remaining: T009's two reports (SOP-017 + SOP-018 on the Hermes pilot) and T013's two remaining reports (SOP-017 + SOP-018 on the Wanderloots intake) — dispatching next.
- 2026-07-11 10:20 (larry/pax) — Pax ran all four remaining reports: `Deliverables/2026-07-11-09-10-t009-hermes-content-integrity-audit.md`, `2026-07-11-09-30-t009-hermes-independent-change-qa.md`, `2026-07-11-09-50-t013-wanderloots-content-integrity-audit.md`, `2026-07-11-10-10-t013-wanderloots-independent-change-qa.md`. **All four state, verbatim, "Same-model review — not independently verified" — none of this closes T009/T013.** Verdicts: all four **Pass with remedials**, no Critical findings. 3 Major findings surfaced. One of the three was addressed by a post-audit unambiguous citation correction applied by Larry under the safe structural-correction boundary (finding 2 below); the other two were left open for Warwick/Silas, not fixed:
  1. **Corrected and resolved, 2026-07-11:** the original framing ("scratchpad-only, will disappear permanently") was factually wrong — external review confirmed a durable copy always existed in `warwickallan/fusion247brain` at `Fusion247 Brain/02_Sources/YouTube Transcripts/Transcript.network.chuck.hermes.docx`, git blob SHA `7653fba40d2ae898b917a86879fff72a5fa5d265` (confirmed via `git ls-tree`). The real, still-valid substance of the finding was that this source had never been ported into Fusion247PKA's own GL-011 register — fixed directly: extracted that exact git blob, captured it into `Sources (Immutable)/2026/07/2026-07-11-hermes-networkchuck-transcript.txt`, register row added with the blob SHA and a fresh sha256.
  2. `ai-tooling.md`'s "per SOP-015 §5" citation was stale (SOP-015 gained new early steps since the pilot; the "does this earn a note" test is now §6) — **fixed directly by Larry**, an unambiguous structural/citation correction, not a content-substance change.
  3. The Wanderloots register row's `status: active` vs. GL-011's "malformed" capture rule, given the repeated verbatim block in the raw payload. **Resolved directly, 2026-07-11:** independently re-counted the resets from the raw `t=` timestamp sequence (11, not "~15" — the original figure was an estimate) and re-fetched the live Drive source fresh, hashing it against the stored local payload: byte-for-byte identical. The defect is confirmed source-side (an upstream auto-caption export artifact), not introduced by capture — so this is a complete, faithful, unaltered capture, not a malformed one. `status: active` stands, documented in `Sources (Immutable)/INDEX.md`'s notes column. Flagged to Silas as a candidate GL-011 clarification (malformed-*capture* vs. source-that-itself-has-a-defect-faithfully-captured) — not actioned unilaterally, since GL-011 itself is outside this PR's scope.
  Also surfaced, not a Major finding but worth Silas/Cairn's attention per GL-008's own recurrence-gate logic: both Cairn pilots independently show the same selective-disclosure pattern — some garbled auto-caption terms flagged per SOP-015/016's noise-normalization discipline, others silently normalized without the same disclosure. Every normalization checked turned out correct; the *inconsistency* recurring across two independent pilots is the actual finding. No fabricated references found anywhere in either pilot. Register-row `sha256` values were cited as recorded, not independently recomputed by Pax (no hashing tool in Pax's toolset) — Larry computed the Wanderloots hash directly via `sha256sum` at capture time, so that one is verified; the Hermes question is moot until/unless it's captured per finding 1.

- 2026-07-11 18:30 (larry/pax/cairn) — Second external (Fable) review, run against pushed head SHA `215e01e98a12326b33336ec24f08e04813cb2cb7`, returned **FAIL pending remedials** with 7 required corrections. All 7 addressed on this branch; the entry above (10:20) is now stale where it says all four T009/T013 reports verdicted "Pass with remedials" — corrected as follows:
  1. **Verdict-rule violation fixed.** Both `SOP-018` independent-change reports had rendered "Pass with remedials" while carrying unresolved Major findings — a direct violation of SOP-018's own Step 8 ("never render any Pass variant while a Critical or Major finding remains unresolved"). Pax corrected the T013 report's verdict to **Fail pending remedials** (its one Major — the register `status: active` vs. GL-011 "malformed" wording ambiguity — is correctly still open, a genuine Warwick/Silas policy call, not self-resolved). The T009 report went through two correction passes in this same round (see its own in-file correction notes) and now reads **Fail pending independent confirmation** — both its Majors are resolved-during-review, so no open finding blocks a Pass on the merits, but this same-model reviewer is deliberately not self-certifying a Pass after needing two corrections to its own report in one round.
  2. **Wrong Hermes "imminent loss" claim fixed** — already captured above (10:20 entry decision 1); reconfirmed here as part of the round-2 close-out.
  3. **Wanderloots duplicate-count reconciled** — Cairn independently re-parsed every `t=` anchor in the raw payload: **10 backward resets → 11 total occurrences** of the repeated block (not "~15", and more precisely stated than my own earlier "11 backward resets" phrasing, which double-counted by one). Source-vs-capture question settled by a fresh live-Drive re-fetch hashed against the stored local payload: byte-for-byte identical — the defect is confirmed source-side.
  4. **Undisclosed "zettelkasting" normalization fixed** — Cairn's T013 intake report now discloses that the source only ever says "zettocasting"/"zealcasting"; "zettelkasting" was Cairn's own inferred reading, now marked `Reconstructed / Needs verification` rather than presented as a clean source statement.
  5. **"None silently fixed" contradiction fixed** — reworded above (10:20 entry) to distinguish the one direct citation fix (Larry, safe structural-correction boundary) from the two findings genuinely left open for Warwick/Silas.
  6. **Session log addendum added** — `Team Knowledge/session-logs/2026/07/2026-07-11-10-20_pax_t009-t013-independent-qa-passes.md` now carries an addendum flagging that its originally recorded "Pass with remedials" verdicts are stale, per items 1–3 above.
  All four T009/T013 reports, the register, the intake report, and this task file are believed internally consistent as of this entry. **T009, T013, this task, and the migration-closure audit remain open/unresolved** — none are closed by this same-model correction round. Returning PR #9 with the new head SHA for a third Fable/Warwick pass.

- 2026-07-11 19:15 (larry/pax) — Third external (Fable) review, run against pushed head SHA `6d14fae93d5034675722ed32015370770be59892`, returned **FAIL pending final doctrine-completeness and reconciliation remedials** with 10 required corrections (9 for Pax, 1 for Larry). Core SOP-018 design accepted as-is (skill-not-agent boundary, honesty rule, requested/claimed/actual comparison, bidirectional checks, literal-reread principle, structural-damage checks, evidence trail, verdict model). Dispatched Pax for the 9 doctrine/report items; handled the 10th (this entry, plus a register fix) directly:
  1. **T013's contradictory state reconciled.** The register/task-file side (already correct, saying `active` stands on source-side evidence) and `Deliverables/2026-07-11-10-10-t013-wanderloots-independent-change-qa.md` (which still said the Major finding "remains open," Fail pending remedials) disagreed. Pax corrected the report: the Major is now recorded **resolved on available same-actor evidence** (the byte-equality hash comparison was performed in this session's own environment, not independently recomputed by a genuinely separate reviewer), verdict changed to **Fail pending independent confirmation** — matching, not exceeding, the T009 independent-change-qa report's existing posture. Not upgraded to Pass. Also fixed one lingering register-wording issue myself: `Sources (Immutable)/INDEX.md`'s Wanderloots notes column called Cairn's own correction an "independent review" — corrected to "same-model correction... not an independent review," consistent with the honesty rule this whole engagement enforces.
  2. **T013 content-integrity audit's stale findings fixed.** `Deliverables/2026-07-11-09-50-t013-wanderloots-content-integrity-audit.md` still listed two open MEDIUM findings (the zettelkasting normalization, the "roughly fifteen" count) that were fixed in Cairn's intake report weeks (same session) earlier. Pax added a correction addendum, annotated both findings `[RESOLVED]`, updated the severity-breakdown line, retained the originals as historical audit-trail record.
  3. **Doctrine-absorption matrix extended** for the live Rev 2 skill's 2026-07-10 five-point scope amendment (rows #28-#32): ontology/schema/folder-purpose changes as high-priority + Fusion-wide logging (both **strengthen-existing**, folded into SOP-018 Step 6's existing schema/ontology-drift line), duplicate instruction stores and project-local-logs-as-ledgers-not-instructions (both **create-in-new-SOP**, new Step 6 checklist lines), and the verbal-handover-concurrence rule (**intentionally-not-absorbed-here** — flagged for Warden/`Client Delivery`/GL-006 as a future follow-up, not implemented, since `Client Delivery/` is on this PR's own exclusion list).
  4. **Recent-change-window fallback implemented** in SOP-018 Step 1: when no explicit commit/file range is given, default to the most recent completed QA/session boundary, else a 48-hour git-log window, resolved via git history/task/session-log evidence, with uncertainty stated explicitly rather than assumed away.
  5. **Warwick-approval field added** to the SOP-018 report template (`## Approval requirement`: required Yes/No, reason, requested decision) and retrofitted into all four existing T009/T013 reports.
  6. **Semantic-coverage-during-rewrite check added** to SOP-018 Step 6, sourced precisely to `qa-review-controldocs-fresh.txt`'s rejected lean `/Hey Fusion.md` rewrite (verified by direct read, not assumed) — a tidy, structurally-clean rewrite that silently drops governance context is now its own named failure mode, distinct from generic structural damage.
  7. **Candidate-lifecycle hygiene** added as its own explicit SOP-018 Step 6 line, distinguished from the existing "duplicate active source-of-truth files" line.
  8. **Matrix's treatment of the four historical QA reviews expanded** (rows #34-#38): the five durable rules in `qa-review-updatefusion-fresh.txt` (evidence restriction, reconstructed-memory labeling, raw-source preservation, processing-model metadata, legacy-spelling-as-defect) each given an explicit disposition and current-equivalent citation (SOP-018's own evidence trail, SOP-016 §3's labeling convention, GL-011, the session-log template's `agent_id` field — confirmed by direct check that GL-002 itself does *not* define this, so it's cited precisely rather than assumed by proximity — and SOP-015/016's normalization-disclosure rule), rather than resting on an implicit sweep.
  9. **Critical Panel Review duplicate-copies source-quality limitation recorded.** I checked Google Drive directly: 3 files titled/near-titled "F247.skill.critical-panel-review" exist, one explicitly self-labelled "superseded duplicate-write error," two others sharing an identical title with no distinguishing marker, ~8 minutes apart. Pax added this as a dedicated source-hygiene caveat in the matrix, and flagged that the scratchpad capture actually used for this matrix (`critical-panel-fresh.txt`) contains the skill's text repeated three times with no internal marker distinguishing which Drive copy it came from — an honest, unresolved provenance gap, stated plainly rather than guessed at. Does not change the underlying decision (Critical Panel Review stays separate, never inlined).
  All corrections verified directly by Larry against the actual file diffs before this entry was written (not taken on Pax's summary alone). **T009, T013, this task, and the migration-closure audit remain open/unresolved** — none are closed by this third same-model correction round. Returning PR #9 with a new head SHA for a fourth Fable/Warwick pass.

## Outcome
_(filled when status flips to done — see SOP-close-task)_
