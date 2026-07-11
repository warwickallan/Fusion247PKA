# Fusion247 Brain → Fusion247PKA: Migration Closure Audit

**Status:** Audit only. Nothing amended, closed, moved, or archived as part of this pass, per explicit instruction. **Review status: independently spot-checked through external ChatGPT/Fable QA against live Google Drive sources. Warwick's final sign-off is still pending** — this document has not been approved for merge as of this pass.

**Correction note (2026-07-11, second pass):** the first version of this audit defined a controlled disposition vocabulary and then used compound/hybrid values not in that vocabulary, contained one internal contradiction on the Phase 5 acceptance-criteria count, classified two Drive obligations (T009, T013) as resolved by a process that didn't actually resolve them, and cited Drive object IDs inconsistently. All four were corrected in that pass.

**Correction note (2026-07-11, third pass):** the second pass itself contained three further errors, caught by the Fable review above: (1) it falsely attributed the Fable/ChatGPT external review's findings and the live-Drive spot-check to Warwick directly, and implied the git-mirror snapshot was read "directly from Drive" — corrected throughout this document and its companion session log; (2) the session log understated the proposed-task count as seven when the deliverable lists nine; (3) several rows were marked `retained-in-Drive` — meaning a deliberate decision to keep something there — when no such decision actually exists; the source documents still show these items as plainly `Open`. Those rows are now `unresolved`, with the auditor's retain-in-Drive recommendation recorded in the Reason column, not asserted as the disposition. One item (Open Register question 8, migration timing) is reclassified from `approved-deferred` to `superseded`, since its own named trigger has been met.

**Source snapshot provenance.** This audit has no live Google Drive API access. All extraction is against a git mirror of `warwickallan/fusion247brain` at `/workspace/fusion247brain`, commit `b2621b808eeeaf93ae6392253096c4f7af80a46b` (commit timestamp `2026-07-10 23:45:13 +0100`), re-pulled and confirmed up to date immediately before this correction pass. Where a document's Drive object ID is independently confirmed against the extracted `F247 Drive Object Registry` snapshot, it's marked "confirmed." Where an ID was supplied directly by Warwick and not independently found in that registry extract, it's marked "as supplied, not independently confirmed in this snapshot" — cited, not verified. This audit cannot state live Drive "last modified" timestamps for individual documents; the git commit timestamp above is the only verifiable floor ("snapshot no older than this").

**Method:** Every Drive document below was re-extracted fresh from the snapshot above (not read from cache, not read from `Team Knowledge/tasks/INDEX.md`, not inferred from git task counts). Each obligation was checked against actual current file content in `warwickallan/Fusion247PKA` main branch — not against whether a task was closed, not against whether a concept was "mapped" in the earlier Migration Coverage Matrix.

**Auditor:** Larry (this session), git commit at time of first pass: `43b2f76` (main).

## How to read the Disposition column

Exactly one of these seven values per row. Nuance, ambiguity, and "it depends" go in the Reason column — never a compound status. Where an obligation genuinely has two different outcomes, it is split into two separate rows below rather than given one hybrid label.

| Disposition | Meaning |
|---|---|
| `verified-absorbed` | The obligation's substance is actually present and checkable in Git — not just conceptually similar. |
| `retained-in-Drive` | Deliberately stays in Drive; not a Git migration obligation (internal Drive housekeeping, or explicitly scoped out). |
| `retained-external` | Deliberately stays outside both Drive and Git (e.g. a browser-automation tool, a live client relationship). |
| `approved-deferred` | A real decision to defer exists, with a named trigger for revisiting. |
| `superseded` | An old obligation was replaced by a later, different decision that actually addresses the *same* requirement — cited. |
| `rejected` | Considered and explicitly declined. |
| `unresolved` | No disposition has actually been made. This is the status that means "still open," full stop. |

---

## Part A — The 17 named documents, top-line status

| # | Drive source | Drive object ID | Top-line status found | Registered in current master index? |
|---|---|---|---|---|
| 1 | F247.master.index | not separately IDed (index of the Drive itself) | Live, actively maintained through 2026-07-10-era decisions. Does **not** list `build.icor.md`, Addendum A, or Addendum B anywhere (checked directly — zero matches). | n/a (self) |
| 2 | F247 Drive Object Registry | n/a (workbook) | Live, multi-sheet. Source of the "confirmed" IDs cited in this table. | n/a |
| 3 | F247 Work List | `18kIhEcZnjRKfPgoUY7JblRgjcykw-rASAbs2X-uNpi0` — **confirmed** (matches the Drive Object Registry's own protected-paths row for this document) | Live. Contains genuine open rows T024, T025, T028, T029 (below) plus internal ID collisions (T020/T021/T022 each reused for two unrelated tasks at different dates — a real hygiene defect in the source itself, not something to silently resolve on its behalf). | — |
| 4 | F247 Open Register | n/a | Live. 7 of 9 listed "Active Open Questions" are still marked `Open` in the document's own table (2 marked `Deferred`). None marked resolved in this file. | — |
| 5 | F247.current-state | n/a | Last touched 2026-07-06, describing Fusion247's own Drive-side Phase-1 state. Does not reference the myPKA chassis decision or Addendum B at all — it's tracking a different, earlier layer than the migration. | — |
| 6 | F247.decision-log | n/a | Live, most recent entry 2026-07-10 (F247-T035). Substantial and well-maintained. | — |
| 7 | Session Log | `17pUoGCc9Hr2mWmzEayqDqen4TWIMvIUq5tUqXSWBy8o` — confirmed (Drive Object Registry) | Live. Confirms a full VerifiAIr QA pass over the Hermes pilot was **never actually run** on the Drive side — every entry says "still recommended" / "if Warwick wants another pass," none confirms it happened. | — |
| 8 | F247 Brain PRD | n/a | §15 "Open Decisions" (folder structure, Obsidian-vs-plain, SQLite timing, Telegram, Git setup) has never been annotated as resolved in the PRD itself, even though the chassis decision substantively answers most of them elsewhere (see Part D). | — |
| 9 | F247.implementation.plan | `1hGm-UnOFUdM275owsizBcKU1UEUM4RPzcewJd84QIi0` — as supplied by Warwick, not independently found in this session's extracted registry snapshot | Its own Phase 5 ("Markdown / Obsidian / Git Migration") has explicit acceptance criteria — tested directly in Part D below. | — |
| 10 | README — Fusion247 Build Project (START HERE) | n/a | Live, last updated 2026-07-03; itself just a pointer to the master index, correctly. | — |
| 11 | F247.proposal.mypka-gap-analysis — 2026-07-08 | n/a | A **proposal**, status explicitly "PROPOSAL — for review... No changes have been made to any live control document." P1–P12/S1–S4 checked individually in Part C. | — |
| 12 | build.icor.md | n/a | Status still literally "Draft reference for comparison... requires Warwick review," **unchanged** — Addendum A/B were never folded into it. | No |
| 13 | build.icor.md — Addendum A | n/a | Its own "Status" field: "PROPOSED ADDENDUM... updates the gap analysis only." Not merged. | No |
| 14 | build.icor.md — Addendum B | `1pWlpHWj3GuQ1z42PkNZGEczLjwfmQgnUeaBNh_otYUc` — as supplied by Warwick, not independently found in this session's extracted registry snapshot | Its own "Status" field: **"To be merged into build.icor.md by Fusion, then this file archived."** Neither has happened. This is a direct, explicit, unactioned instruction in the source document itself. | No |
| 15 | GL-F247-001-project-entity-schema | `1K8NdaXpwkHeBtn9YwB7pVWOSVGl4g769vlP2CS6ELSQ` — **confirmed** (exact match, Drive Object Registry Objects sheet) | 13-stage structure "active candidate pending validation against a real project" — **per its own text**, unresolved even on the Drive side, not just here. | — |
| 16 | F247.project-operating-ontology | n/a | Live; explicitly defers stage-list detail to GL-F247-001 §8 (same unresolved validation status). | — |
| 17 | F247.proposal.agent-skill-boundary-refactor — 2026-07-09 | `18xXS1HtLOIsxYAElpCSeFoFCF0Prx_6H7S10jwSAuHw` (stated in doc) | Its own §11 "Progress tracking": **"No agent documents refactored yet."** A proposal, zero implementation, on either side. | — |

---

## Part B — The Migration Closure Matrix (one row per distinct obligation, one disposition per row)

### B1. F247 Work List — named rows and other genuinely open rows

| Drive source | Exact task | Original requirement | Current Git destination | Disposition | Evidence | Verification performed | Remaining action | Owner | Merge blocker | Reason |
|---|---|---|---|---|---|---|---|---|---|---|
| F247 Work List | **F247-T024** | Create/revise `F247.skill.project-intake` for `/project intake [project_id or alias]` | none | `unresolved` | Warden has no engagement-intake SOP; SOP-010 processes a source, it does not open a new engagement. | Grepped `Team/Warden - Delivery Manager/AGENTS.md` and `SOP-010`–`014` for "intake" — no engagement-creation procedure exists. | Warwick decides: does Warden need a formal "start new engagement" SOP, or is this implicitly Warden's own judgement with no procedure needed? | Warden/Silas | **No** | Bucket: **Warwick decision required**, not a confirmed blocker — nothing can be built against an unscoped requirement. |
| F247 Work List | **F247-T025** | Create a controlled golden-master project-template release pattern | none | `unresolved` | myPKA's own SSOT-single-canonical-template convention has no "release" step — one file is always current. This may already satisfy the underlying intent, or may not. | Checked `Team Knowledge/Templates/` — no versioned-release concept exists for any template, by design. | Warwick decides whether myPKA's single-canonical-template model already satisfies this, or whether a golden-master-release workflow specifically is wanted. | Silas | **No** | Bucket: **Warwick decision required.** |
| F247 Work List | **F247-T028** | Reconcile the approved Fusion247 project-management template pack with the candidate v0.2 scaffold/ontology | none | `unresolved` | This is a reconciliation between two of Fusion247's *own* competing Drive drafts. GL-006/Warden's schema is a fresh, independent re-derivation, not built by reconciling these two Drive documents. | Read GL-F247-001 §8 directly: still "active candidate pending validation" — Fusion247 itself never finished this reconciliation either. | None from the Git side. | Warwick/Fusion (Drive-side) | **No** | Drive-internal housekeeping; auditor recommends retaining in Drive, but no Warwick decision to that effect exists yet — the item is genuinely still open in the source, not settled. |
| F247 Work List | **F247-T029** | Register root-level ontology/build docs (`build.icor.md`, Addenda A/B, `F247.project-operating-ontology`) in the master index/document register | none | `unresolved` | Confirmed via direct grep of the fresh master-index extraction: zero mentions of `build.icor.md`, Addendum A, or Addendum B anywhere. | Grepped fresh extraction, zero hits. | Warwick decides whether these build docs' provenance needs a Git-side record (e.g. in `Team Knowledge/INDEX.md`), independent of whether Fusion247 ever does the Drive-side registration. | Fusion/Warwick (Drive) + Silas (if a Git-side record is wanted) | **No** | Bucket: **Warwick decision required** — this is the provenance-treatment decision, classified consistently with the sign-off checklist below (not listed twice under two different blocker statuses). |
| F247 Work List | T004 / T011 (same obligation, two IDs — a source-side collision) | Review and finalize CategorisAIr/VerifiAIr safe-update approval rules | Larry's Duty 2 safe-corrective-boundary rule (tsk-006/PR #7) | `verified-absorbed` | `Team/Larry - Orchestrator/AGENTS.md` Duty 2, explicit R/U/suggest-D-never-autonomous-D rule, modeled directly on VerifiAIr's own scope. | Read the current file directly. | none | Larry | No | Genuinely done, and recently. |
| F247 Work List | T009 | Run VerifiAIr review over the Hermes pilot outputs | none | `unresolved` | Cairn's own pilot (tsk-001 decision 20) processed the *same* Hermes transcript, but Cairn's intake pass is source-to-WIKI filing, not independent content-integrity QA. `SOP-017-content-integrity-audit` now exists and could run this check, but has never actually been run against the pilot output. | Read `PKM/My Life/Topics/ai-tooling.md`'s Cairn intake section directly; confirmed no `SOP-017` run exists anywhere for it. | Warwick decides: run a cheap `SOP-017` validation pass over the Hermes-derived note, or explicitly waive T009 as no longer meriting review. | Pax (SOP-017 owner) | **No** | Correction from first pass: this was previously marked `superseded` by Cairn's pilot. That conflated intake/filing with content-integrity QA — two different jobs per Task 006's own design. Left `unresolved` pending Warwick's explicit call, not silently resolved. |
| F247 Work List | T017 | Review PRD §15 Open Decisions and mark resolved items | none directly in the PRD document itself | `unresolved` | Most of §15's individual questions are substantively answered elsewhere (chassis decision, Addendum B), but the PRD document itself was never annotated to say so. | Read PRD §15 directly; searched decision log and session log for any entry closing T017 — none found. | Either annotate the PRD's own §15 with pointers to where each question was actually resolved, or accept "resolved elsewhere, PRD text stale" as final and log that decision. | Warwick | **No** | Substance is answered; the paper trail isn't. Named because the user explicitly asked for PRD open-decision reconciliation. |
| F247 Work List | T013 | Run a second source-to-WIKI test after Hermes | none | `unresolved` | Reprocessing the *same* Hermes transcript through Cairn is not a second source — the report itself states this plainly. | — | Warwick decides whether a genuinely different second source should be run, or whether this requirement is waived now that the intake loop has been proven a different way. | Cairn | **No** | Correction from first pass: previously described as "superseded in spirit," which is not one of the seven valid dispositions and overstated the resolution. Left `unresolved` pending Warwick's explicit deferral. |

### B2. F247 Open Register — every "Active Open Question" in the current table

| # | Question (verbatim, current status per the register itself) | Disposition | Current Git destination | Merge blocker | Reason |
|---|---|---|---|---|---|
| 1 | Archive/delete/leave-marked duplicate folder names? — `Open` | `unresolved` | n/a | No | Drive-internal folder hygiene; auditor recommends retaining in Drive (myPKA has no equivalent problem to inherit), but no Warwick decision to that effect exists — the register itself still shows `Open`. |
| 2 | When to move existing F247 docs into new folder structure? — `Open` | `unresolved` | n/a | No | Drive-internal sequencing question, overtaken by events; auditor recommends retaining in Drive, not yet a Warwick-approved disposition. |
| 3 | Standardise existing doc names to dot-style? — `Open` | `unresolved` | n/a | No | Naming-convention question about Fusion247's own Drive files; auditor recommends retaining in Drive, not yet a Warwick-approved disposition. |
| 4 | Minimum CategorisAIr metadata/template schema? — `Open` | `superseded` | `Team Knowledge/Guidelines/GL-008-source-classification-registry.md` | No | Cairn/GL-008 is a fresh, independent answer to the same underlying question. |
| 5 | Work/client meeting-transcript template content? — `Open` | `unresolved` | n/a | No | Warden's `SOP-010`–`014` solve the myPKA-side equivalent independently; auditor recommends retaining this specific Drive-template question in Drive, but no Warwick decision to that effect exists. |
| 6 | VerifiAIr's exact safe-update permissions? — `Open` | `verified-absorbed` | Larry's Duty 2 safe-corrective-boundary rule | No | Directly answered, this session. |
| 7 | First source-processing test (Hermes)? — `Open` in the register | `superseded` | Cairn's pilot | No | Register itself is stale; the underlying test has genuinely been run (see T009's caveat above — filing was re-proven, independent QA was not). |
| 8 | Drive→Markdown/Obsidian/Git migration timing? — `Deferred` | `superseded` | this repo | No — in progress, not blocked | The register's own deferral trigger ("wait until laptop/local environment available") has now been met; the deferred state is superseded by the active migration this audit itself is part of, not still a live deferral. |
| 9 | First dashboard/cockpit view? — `Deferred` | `approved-deferred` | `Expansions/mypka-cockpit/` exists (generic myPKA feature, not built for Fusion247 specifically) | No | Explicitly deferred in the source. |

**Business-naming open question (2026-07-04 entry, separate from the table above):** "Should Fusion247 use `IPA`, `BKM/BPM`, or another term for the business/project side?" — Status per the register: `Open pending first relevant ICOR course lesson note`. **Disposition: `approved-deferred`** — the register itself names an explicit trigger ("pending first relevant ICOR course lesson note"), which meets the definition of an approved deferral rather than a bare unresolved item. **Merge blocker: No.**

### B3. Named cross-cutting items

| Item | Original requirement | Current Git destination | Disposition | Evidence | Merge blocker | Reason |
|---|---|---|---|---|---|---|
| **Addendum A/B merge-and-archive instruction** | Addendum B's own header: "Merge instruction: fold B1–B8 into build.icor.md... Status: To be merged into build.icor.md by Fusion, then this file archived." | none | `unresolved` | `build.icor.md`'s own header is unchanged since 2026-07-03; no merge occurred. | No | Drive-side housekeeping instruction, never actioned there. No direct Git-side deliverable is required by the instruction itself, but see T029 above for the separate provenance-record decision. |
| **B9 Phase 3 — F247 port, worked-example gate** | "GATE: Warwick reviews one fully-ported project." | `Client Delivery/` — still a stub | `unresolved` | `Client Delivery/INDEX.md` confirms zero engagements exist. Real BRK-001 data correctly excluded (live client data, a separate prior decision) — nothing was substituted in its place. | **Yes** | **Confirmed blocker.** The schema is built but has never been exercised against real or synthetic content. |
| **B9 Phase 4 — ChatGPT history import** | "GATE: session-log review." | none | `unresolved` | Grepped for `conversations.json` / "ChatGPT export" under `Team Knowledge/` — zero hits. No raw export material exists anywhere in the audited Fusion247Brain snapshot (`02_Sources/ChatGPT Exports` does not exist there). | **No** | Bucket: **External-input-blocked, not a build gap.** Cannot be attempted until Warwick exports the material and adds it to a source the team can read; nothing here is a missing engineering task. |
| **B9 Phase 5 — connectors & bridges** | ClickUp connector, Withings health bridge, calendar feed | none | `approved-deferred` | Addendum B's own phase ordering sequences this after Phases 1–4, each step "independently reversible." | **No** | Bucket: **Roadmap, not a blocker** — the phase ordering is itself a Warwick-approved sequencing decision (Addendum B), not an oversight. |
| **F247.proposal.agent-skill-boundary-refactor** | Split bloated all-in-one agent docs into contract/skill/guideline/template layers, piloted on CategorisAIr first | myPKA/Fusion247PKA's own architecture | `verified-absorbed` | Every specialist hired this engagement (Warden, Cairn) was built with contract/SOP/Guideline/Template already separated from day one. | No | The proposal's goal was achieved as a side effect of how myPKA specialists are built — worth an explicit closing note on the Drive-side document, since nobody has gone back to mark it satisfied there. |
| **GL-F247-001 / 13-stage project model real-project validation** | "Active candidate pending validation against a real project" | `Client Delivery/` — still a stub | `unresolved` | Same underlying fact as the B9 Phase 3 row above — this is the schema-document's own statement of the identical gate. | **Yes** | **Confirmed blocker** — same root cause as B9 Phase 3, cited from the schema document's own text rather than only the runbook's. Not double-counted as a separate blocker in the final tally; it is the same blocker, two citations. |
| **Project template-pack reconciliation** | T028 above | — | `unresolved` | — | No | See B1 — auditor recommendation, not a Warwick-approved retention. |
| **TubeAIR / F247 YT Transcript Ingress — processing mechanics** | Re-derive the transcript chunk-mapping mechanics for Cairn | `SOP-016-cairn-process-youtube-transcript.md` | `verified-absorbed` | SOP-016 explicitly re-derives the chunk-mapping mechanics. | No | Split into its own row (was previously conflated with the adapter row below into an invalid "partially-absorbed" status). |
| **TubeAIR / F247 YT Transcript Ingress — capture adapter** | Build the actual Zapier-first capture pipeline (per the source's own 2026-07-06 decision) that lands raw transcripts before Cairn processes them | none | `approved-deferred` | `GL-011`'s Adapter rule states the requirement; Cairn's own hire contract explicitly defers adapter-wiring until after the v1 pilot. | No | Bucket: **Roadmap, not a blocker** — explicitly and deliberately deferred at Cairn's hire, cited directly in Cairn's contract. |
| **ICOR course-note adapter + business-domain naming** | Process ICOR course lesson notes; resolve IPA/BKM/BPM naming | none built | `approved-deferred` | See B2 — the Open Register itself names the trigger ("pending first relevant ICOR course lesson note"). | No | Bucket: **External-input-blocked, not a build gap** — same reasoning as B9 Phase 4, cited under `approved-deferred` here because the register states an explicit trigger, unlike the ChatGPT-export item, which has none. |
| **Raw ChatGPT/Claude/source import and preservation** | Addendum B Phase 4 (see above) | — | `unresolved` | — | No | Duplicate citation of the B9 Phase 4 row above; listed once there to avoid double-counting. |
| **PRD open-decision reconciliation** | PRD §15 | — | `unresolved` | See B1/T017 and Part D. | No | Substance answered elsewhere; document itself never annotated. |
| **Final Drive read-only/historical handover** | An explicit point where Drive stops being written to and becomes historical reference only | none | `unresolved` | The Decision Log's own most recent entry is dated 2026-07-10 (F247-T035) — Drive was still being actively decided-in and written to as of that date, after this migration engagement began. No handover announcement exists anywhere. | **Yes** | **Confirmed blocker.** There is no evidence Drive has been formally retired; needs Warwick's explicit confirmation either way. |
| **CareerAIR** | Career/CV knowledge management specialist | `tsk-2026-07-10-004-careerair-migration-direction-decision` | `approved-deferred` | Task open, priority 4, direction recommended, awaiting sign-off. | No | Bucket: **Roadmap** — explicitly deprioritized by the user's own prior instruction, direction already drafted. |
| **AsdAIr (the household-shopping domain agent itself)** | Personal household-shopping automation via Claude in Chrome | `tsk-2026-07-10-005-asdair-retained-external-recommendation` | `approved-deferred` | Master index confirms AsdAIr itself is `Active` Fusion247 Brain content (not out-of-scope) — distinct from the microsite below. Its final destination may turn out to be `retained-external` once `tsk-005` resolves (it's a browser-automation tool with no persistent memory of its own), but that has not been decided yet. | No | Bucket: **Roadmap** — open, deprioritized, direction already drafted; the eventual destination is a separate future decision, not this one. |
| **AsdAIr Microsite App** (the separate CV-building side-build project) | A standalone web app for Mum's shopping list | none, and per its own Drive record, should have none | `retained-external` | Decision log, 2026-07-07 entry, verbatim: *"Boundary: This is not part of `/Hey Fusion`, the Fusion247 PRD or the core implementation plan. Do not alter AsdAIr prompts, decisions log or order history as part of this project."* | **No** | Explicitly and deliberately out of scope, stated by Fusion247's own governance — not a gap this audit is inventing an excuse for. This is the distinction the user asked to be drawn explicitly: the microsite is a separate CV-strengthening side-build the source system itself excluded from the PRD/implementation plan, so it is never a merge blocker. |

### B4. A genuinely new finding this pass, not previously flagged anywhere

| Item | Original requirement | Current Git destination | Disposition | Evidence | Merge blocker | Reason |
|---|---|---|---|---|---|---|
| **Register Item "lessons" kind** | Fusion247's own 13-stage folder spec names six registers: risk, issue, change, decision, dependency, **lessons** (`lessons-log`) | `GL-006-client-delivery-frontmatter-conventions.md` `kind` enum | `unresolved` | GL-006's `kind` field is `risk \| issue \| change \| decision` only. "Dependency" is at least named as a future-extension candidate with a free-text stopgap. "Lessons" appears **nowhere** in GL-006 or Warden's contract — grepped both directly, zero hits. | **No** | Bucket: **Warwick decision required** — whether to add `lessons` (and promote `dependency`) to the `kind` enum. Not classified as a confirmed blocker because the schema is otherwise usable without it; classified consistently with T024/T025/T029 above rather than given a one-off severity. |

---

## Part C — Gap-analysis P1–P12 / S1–S4, individually re-checked

| Item | Disposition | Evidence |
|---|---|---|
| P1 manifest/framework-seam | `verified-absorbed` | `manifest.json` exists with `framework_paths`/`user_state_paths`. |
| P2 structural validation spec | `verified-absorbed` | `validation-script.sh` exists (per `manifest.json`'s own framework_paths list). |
| P3 SSOT + precedence | `verified-absorbed` | Root `AGENTS.md` Hard Rule 1; this whole engagement's practice. |
| P4 machine-actionable change recipes | `verified-absorbed` | `CHANGELOG-MIGRATION.md` referenced in manifest. |
| P5 index-rebuild SOP | `verified-absorbed` | `SOP-rebuild-task-index.md` exists and was used repeatedly this engagement. |
| P6 version stamping | `verified-absorbed` | `manifest.json`'s `scaffold_version`. |
| P7 Cockpit/SQLite data contract | `verified-absorbed` | `Expansions/mypka-cockpit/` + `SOP-002` (myPKA-generic, not Fusion247-specific). |
| P8 portable core/adapter boundary | `verified-absorbed` | `GL-005-llm-agnostic-portable-core.md`; `.claude/`/`.codex/` shim split. |
| P9 contract+shim pairing | `verified-absorbed` | Every hire this engagement (Warden, Cairn) shipped both layers. |
| P10 per-agent journals | `verified-absorbed` | `Team/*/journal/`, used this session. |
| P11 governance docs as searchable data | `approved-deferred` | SOP-002/mypka.db exists; Fusion247-specific governance-doc mirroring not built, not required yet. |
| P12 orchestrator discipline | `verified-absorbed` | Larry's iron rule, root `AGENTS.md`. |
| S1 formal retro loop | `verified-absorbed` | `WS-004-team-retro-and-self-improvement-loop.md`. |
| S2 consolidated hard-rules block | `verified-absorbed` | Root `AGENTS.md` §Hard rules. |
| S3 backup-before-overwrite | `verified-absorbed` | `manifest.json`'s own stated backup behavior. |
| S4 blocked-state convention | `verified-absorbed` | `blocked_reason`/`blocked_by` fields, used throughout. |

All 16 items independently re-verified this pass. All check out. This part of the audit is clean.

---

## Part D — Direct acceptance-criteria tests (not paraphrase)

### D1. Implementation Plan Phase 5 acceptance criteria (verbatim from the source)

| Criterion (verbatim) | Result | Evidence |
|---|---|---|
| "Vault opens cleanly in Obsidian." | Presumed pass, not independently tested this pass | Structural design claim (`AGENTS.md`: "An Obsidian-compatible markdown folder"). No actual Obsidian launch was performed in this audit. |
| "Markdown files remain readable outside Obsidian." | Pass | Trivially true — plain markdown throughout. |
| "Git tracks changes." | Pass | Extensively demonstrated this entire engagement. |
| "Google Drive docs are either migrated or clearly marked as staging copies." | Fail | This audit is the proof: T024/T025/T029, the Addendum merge instruction, the lessons-register gap, and the unresolved final-handover question are all real Drive obligations with no explicit disposition anywhere before this pass. |

**Net result, stated once, consistently: 2 of 4 criteria pass cleanly, 1 is presumed-but-untested, 1 fails outright. Phase 5 is not closed by its own stated criteria.** (This is the single authoritative count for this test in this document — any other phrasing of it elsewhere in this file is an error.)

### D2. B9 gated bootstrap phases (Addendum B, verbatim gate language)

| Phase | Gate (verbatim) | Result |
|---|---|---|
| Phase 0 — preconditions | n/a (manual, Warwick-side) | Pass (implicitly — this repo exists) |
| Phase 1 — vendor+fork setup | "GATE: Warwick confirms activation report." | Pass |
| Phase 2 — schema extension | "GATE: Warwick ratifies the Guideline." | Pass |
| Phase 3 — F247 port | "GATE: Warwick reviews one fully-ported project." | **Fail — confirmed blocker, see Part B3.** |
| Phase 4 — ChatGPT history import | "GATE: session-log review." | **Fail — external-input-blocked, see Part B3.** |
| Phase 5 — connectors & bridges | Each independently reversible; no single gate | **Fail — roadmap/approved-deferred, see Part B3.** |

---

## Answers to the seven required questions

### 1. Is the Drive-to-Git merge genuinely complete?

**NO.**

### 2. Exact remaining merge blockers, classified consistently in three buckets

**Confirmed blockers (Merge blocker: Yes in the matrix above):**
- Final Drive read-only/historical handover disposition — never decided, Drive was still actively written to as of 2026-07-10.
- One real or synthetic `Client Delivery/` engagement to validate GL-006/Warden's schema (B9 Phase 3 gate / GL-F247-001's own stated validation gate — one blocker, two citations, not two blockers).
- Resolving Implementation Plan Phase 5's own acceptance-criteria failure (criterion 4) — which is itself substantially the same underlying gap as the two items above, tested against the plan's own wording rather than the runbook's.

**Warwick decisions required (Merge blocker: No, but not yet classifiable as roadmap either):**
- F247-T024 — does Warden need a formal engagement-intake SOP?
- F247-T025 — does myPKA's own template model already satisfy the "golden-master release pattern" intent?
- F247-T029 — does `build.icor.md`/Addendum A/B's provenance need a Git-side record?
- Whether `lessons` (and possibly `dependency`) should be added to GL-006's Register Item `kind` enum.
- T009/T013 — run a cheap `SOP-017` validation pass over the Hermes pilot and/or a genuine second source, or explicitly waive both.

**External-input-or-roadmap — not blockers (Merge blocker: No):**
- Raw ChatGPT/Claude export and WS-002 import (blocked on Warwick exporting the material; cannot be attempted until then).
- TubeAIR capture adapter (explicitly deferred at Cairn's own hire).
- ICOR course-note adapter + business-domain naming (explicit trigger stated in the source Open Register).
- Connectors/bridges — ClickUp, Withings, calendar feed (B9's own approved phase ordering).
- CareerAIR, AsdAIr (the domain) — both open, both deprioritized by prior explicit instruction, directions already drafted.

### 3. Exact approved-deferred / post-merge roadmap items

CareerAIR, AsdAIr (the domain), TubeAIR capture adapter, ICOR course-note adapter/naming, connectors/bridges, gap-analysis P11 (governance-docs-as-searchable-data). All listed with citations in the bucket above and in Parts B2/B3.

### 4. Exact retained-in-Drive or retained-external items

**Genuinely `retained-external` (a real, pre-existing decision backs this):**
- **AsdAIr Microsite App** — by the source's own explicit, pre-existing decision. Not a merge blocker.

**Not actually `retained-in-Drive` — corrected to `unresolved` this pass.** These were previously marked `retained-in-Drive`, but that disposition means a deliberate decision to keep something there, and no such Warwick decision exists for any of them — they are simply still `Open` in the source documents. Reclassified `unresolved`, merge blocker No, with "auditor recommends retaining in Drive" recorded as the reason, not the disposition:
- F247-T028 (project template-pack reconciliation).
- The Open Register's folder-naming/duplicate-cleanup/naming/meeting-template questions (items 1, 2, 3, 5 in Part B2).

**Not found anywhere accessible:**
- Raw ChatGPT conversation history — not found in the audited repositories/source snapshot; cannot be migrated until it is exported and added to one accessible to this team.

### 5. Drive obligations missed entirely by WS-005 or later tasks

F247-T024, T025, T028, T029; the Addendum A/B merge-and-archive instruction; `F247.proposal.agent-skill-boundary-refactor` (never explicitly closed against, even though satisfied by construction); GL-F247-001's real-project validation gate (previously flagged only verbally, not audited against the source document's own wording until this pass); the Register Item `lessons` gap (genuinely new); PRD §15's unannotated status; Phase 5's 4th acceptance criterion tested literally for the first time.

### 6. One-page Warwick sign-off checklist

- [ ] Approve (or reject) the auditor's recommendation to formally retain T028 and the Open Register housekeeping questions (items 1, 2, 3, 5) in Drive. Until approved, they stay `unresolved`, not `retained-in-Drive`.
- [ ] T024 — does Warden need a formal engagement-intake SOP?
- [ ] T025 — does myPKA's own template model satisfy the "golden-master release pattern" intent?
- [ ] T029 — does `build.icor.md`/Addendum A/B's provenance need a Git-side record?
- [ ] Whether `lessons` (and `dependency`) should be added to GL-006's Register Item `kind` enum.
- [ ] Whether a synthetic/redacted worked-example engagement should be built in `Client Delivery/` to close the B9 Phase 3 / GL-F247-001 validation gate.
- [ ] Whether Drive is formally retired to read-only/historical status, or remains an active working surface.
- [ ] T009/T013 — run a cheap `SOP-017` pass and/or a genuine second source, or explicitly waive both.
- [ ] Confirm CareerAIR and AsdAIr directions (already drafted in `tsk-004`/`tsk-005`).
- [ ] Confirm TubeAIR/ICOR adapter wiring and connectors are genuinely roadmap, not blockers.
- [ ] Approve (or amend) the proposed task list in answer 7 before anything is created.

### 7. Proposed Git tasks to close real gaps (not created — awaiting approval)

1. Warwick decision + (if approved) build a Warden engagement-intake SOP — resolves T024.
2. Warwick decision on T025 — golden-master release pattern vs. myPKA's existing model.
3. Build one synthetic/redacted worked-example engagement in `Client Delivery/` to close the Phase 3 / GL-F247-001 validation gate, without touching real BRK-001 data.
4. Warwick decision + (if approved) add `lessons` (and consider promoting `dependency`) to GL-006's Register Item `kind` enum.
5. Warwick decision + (if approved) record `build.icor.md`/Addendum A/B's provenance somewhere in Git — resolves T029.
6. Warwick decision on final Drive handover status — a decision to log, not a build task.
7. Warwick decision on T009/T013 — run `SOP-017` against the Hermes pilot / run a genuine second source, or explicitly waive.
8. (Only if Warwick later exports it) Run WS-002 against the Fusion247 ChatGPT conversation export.
9. (Roadmap, not urgent) TubeAIR capture-adapter build, ICOR course-note adapter, ClickUp/Withings connectors — tracked, not blocking.
