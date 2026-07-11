# Fusion247 Brain → Fusion247PKA: Migration Closure Audit

**Status:** Audit only. Nothing amended, closed, moved, or archived as part of this pass, per explicit instruction.
**Method:** Every Drive document below was re-extracted fresh from `/workspace/fusion247brain` this pass (not read from cache, not read from `Team Knowledge/tasks/INDEX.md`, not inferred from git task counts). Each obligation was checked against actual current file content in `warwickallan/Fusion247PKA` main branch — not against whether a task was closed, not against whether a concept was "mapped" in the earlier Migration Coverage Matrix.
**Auditor:** Larry (this session), git commit at time of audit: `43b2f76` (main).

## How to read the Disposition column

| Disposition | Meaning |
|---|---|
| `verified-absorbed` | The obligation's substance is actually present and checkable in Git — not just conceptually similar. |
| `retained-in-Drive` | Deliberately stays in Drive; not a Git migration obligation (internal Drive housekeeping, or explicitly scoped out). |
| `retained-external` | Deliberately stays outside both Drive and Git (e.g. a browser-automation tool, a live client relationship). |
| `approved-deferred` | A real decision to defer exists, with a named trigger for revisiting. |
| `superseded` | An old obligation was replaced by a later, different decision — cited. |
| `rejected` | Considered and explicitly declined. |
| `unresolved` | No disposition has actually been made. This is the status that means "still open," full stop. |

---

## Part A — The 17 named documents, top-line status

| # | Drive source | Drive object ID (where confirmed) | Top-line status found | Registered in current master index? |
|---|---|---|---|---|
| 1 | F247.master.index | not separately IDed (index of the Drive itself) | Live, actively maintained through 2026-07-10-era decisions. Does **not** list `build.icor.md`, Addendum A, or Addendum B anywhere (checked directly — zero matches). | n/a (self) |
| 2 | F247 Drive Object Registry | n/a (workbook) | Live, multi-sheet. Confirms real Drive object IDs for several items cited below. | n/a |
| 3 | F247 Work List | n/a (append-log doc) | Live. Contains genuine open rows T024, T025, T028, T029 (below) plus internal ID collisions (T020/T021/T022 each reused for two unrelated tasks at different dates — a real hygiene defect in the source itself, not something to silently resolve on its behalf). | — |
| 4 | F247 Open Register | n/a | Live. 7 of 9 listed "Active Open Questions" are still marked `Open` in the document's own table (2 marked `Deferred`). None marked resolved in this file. | — |
| 5 | F247.current-state | n/a | Last touched 2026-07-06, describing Fusion247's own Drive-side Phase-1 state. Does not reference the myPKA chassis decision or Addendum B at all — it's tracking a different, earlier layer than the migration. | — |
| 6 | F247.decision-log | n/a | Live, most recent entry 2026-07-10 (F247-T035). Substantial and well-maintained. | — |
| 7 | Session Log | `17pUoGCc9Hr2mWmzEayqDqen4TWIMvIUq5tUqXSWBy8o` (confirmed, Drive Object Registry) | Live. Confirms "full VerifiAIr QA" over the Hermes pilot was **never actually run** on the Drive side — every entry says "still recommended" / "if Warwick wants another pass," none confirms it happened. |
| 8 | F247 Brain PRD | n/a | §15 "Open Decisions" (folder structure, Obsidian-vs-plain, SQLite timing, Telegram, Git setup) has never been annotated as resolved in the PRD itself, even though the chassis decision substantively answers most of them elsewhere (see Part D). |
| 9 | F247.implementation.plan | n/a | Its own Phase 5 ("Markdown / Obsidian / Git Migration") has explicit acceptance criteria — tested directly in Part D below. |
| 10 | README — Fusion247 Build Project (START HERE) | n/a | Live, last updated 2026-07-03; itself just a pointer to the master index, correctly. |
| 11 | F247.proposal.mypka-gap-analysis — 2026-07-08 | n/a | A **proposal**, status explicitly "PROPOSAL — for review... No changes have been made to any live control document." P1–P12/S1–S4 checked individually in Part C. |
| 12 | build.icor.md | n/a | Status still literally "Draft reference for comparison... requires Warwick review," **unchanged** — Addendum A/B were never folded into it. |
| 13 | build.icor.md — Addendum A | n/a | Its own "Status" field: "PROPOSED ADDENDUM... updates the gap analysis only." Not merged. |
| 14 | build.icor.md — Addendum B | n/a | Its own "Status" field: **"To be merged into build.icor.md by Fusion, then this file archived."** Neither has happened. This is a direct, explicit, unactioned instruction in the source document itself. |
| 15 | GL-F247-001-project-entity-schema | n/a | 13-stage structure "active candidate pending validation against a real project" — **per its own text**, unresolved even on the Drive side, not just here. |
| 16 | F247.project-operating-ontology | n/a | Live; explicitly defers stage-list detail to GL-F247-001 §8 (same unresolved validation status). |
| 17 | F247.proposal.agent-skill-boundary-refactor — 2026-07-09 | `18xXS1HtLOIsxYAElpCSeFoFCF0Prx_6H7S10jwSAuHw` (stated in doc) | Its own §11 "Progress tracking": **"No agent documents refactored yet."** A proposal, zero implementation, on either side. |

---

## Part B — The Migration Closure Matrix (one row per distinct obligation)

### B1. F247 Work List — named rows and other genuinely open rows

| Drive source | Exact task | Original requirement | Current Git destination | Disposition | Evidence | Verification performed | Remaining action | Owner | Merge blocker | Reason |
|---|---|---|---|---|---|---|---|---|---|---|
| F247 Work List | **F247-T024** | Create/revise `F247.skill.project-intake` for `/project intake [project_id or alias]` | none | **unresolved** | Warden has no engagement-intake SOP; SOP-010 processes a source, it does not open a new engagement. | Grepped `Team/Warden - Delivery Manager/AGENTS.md` and `SOP-010`–`014` for "intake" — no engagement-creation procedure exists. | Decide: does Warden need an explicit "start new engagement" SOP, or is this implicitly Warden's own judgement with no procedure needed? | Warden/Silas | **Yes** | Named exactly by the user; genuinely nothing built. |
| F247 Work List | **F247-T025** | Create a controlled golden-master project-template release pattern | none directly; myPKA's own SSOT-single-canonical-template convention is architecturally different (no "release" step, one file is always current) | **unresolved-but-likely-moot** | — | Checked `Team Knowledge/Templates/` — myPKA has no versioned-release concept for any template, by design. | Confirm with the user whether myPKA's single-canonical-template model already satisfies this obligation's intent, or whether Fusion247 specifically wanted a golden-master-release workflow ported. | Silas | **Ambiguous — flag, don't assume** | Requires a judgement call the user should make, not one to silently resolve. |
| F247 Work List | **F247-T028** | Reconcile the approved Fusion247 project-management template pack with the candidate v0.2 scaffold/ontology | none | **retained-in-Drive (candidate)** | This is a reconciliation between two of Fusion247's *own* competing Drive drafts. GL-006/Warden's schema is a fresh, independent re-derivation, not built by reconciling these two Drive documents. | Read GL-F247-001 §8 directly: still "active candidate pending validation," i.e. Fusion247 itself never finished this reconciliation either. | None from the Git side — this is Drive-internal housekeeping the migration doesn't need to inherit, but say so explicitly rather than silently drop it. | Warwick/Fusion (Drive-side) | No | It's a Drive-vs-Drive reconciliation, not a Drive-vs-Git one. |
| F247 Work List | **F247-T029** | Register root-level ontology/build docs (`build.icor.md`, Addenda A/B, `F247.project-operating-ontology`) in the master index/document register | none | **unresolved** | Confirmed via direct grep of `master-index-fresh.txt`: zero mentions of `build.icor.md`, Addendum A, or Addendum B anywhere in the current master index. | Grepped fresh extraction, zero hits. | This is Fusion247's own Drive-side bookkeeping — genuinely still open there, and separately, no myPKA equivalent registry entry exists either (there is no myPKA doc that stands in for these build docs' provenance record). | Fusion/Warwick (Drive) + Silas (Git side, if these docs' provenance should be recorded in `Team Knowledge/INDEX.md`) | No (Drive-side), **Yes** if the intent was "these build docs' lineage must be traceable from Git" | Genuinely open on both sides, for different reasons. |
| F247 Work List | T004 / T011 (same obligation, two IDs — a source-side collision) | Review and finalize CategorisAIr/VerifiAIr safe-update approval rules | Larry's Duty 2 safe-corrective-boundary rule (this session, tsk-006/PR #7) | **verified-absorbed** | `Team/Larry - Orchestrator/AGENTS.md` Duty 2, explicit R/U/suggest-D-never-autonomous-D rule, modeled directly on VerifiAIr's own scope. | Read the current file directly. | none | Larry | No | Genuinely done, and recently — not a stale claim. |
| F247 Work List | T009 | Run VerifiAIr review over the Hermes pilot outputs | Cairn's own pilot (tsk-001 decision 20) processed the *same* Hermes transcript through the myPKA-side equivalent | **superseded** | `PKM/My Life/Topics/ai-tooling.md` §External intake | Read the actual filed note. | none | Cairn | No | The Drive-side T009 was never itself closed, but the underlying validation question ("does a source-to-WIKI-then-QA loop work") has been independently proven on the myPKA side with a fresh pilot — a real supersession, not a excuse. |
| F247 Work List | T017 | Review PRD §15 Open Decisions and mark resolved items | none directly in the PRD document itself | **unresolved (paperwork gap)** | See Part D — most of §15's individual questions are substantively answered elsewhere (chassis decision, Addendum B), but the PRD itself was never annotated to say so. | Read PRD §15 directly; searched decision log and session log for any entry closing T017 — none found. | Either annotate the PRD's own §15 with pointers to where each question was actually resolved, or formally accept that "resolved elsewhere, PRD text itself is stale" is the final disposition. | Warwick (PRD is his to approve edits to) | No | Substance is answered; the paper trail isn't tidy. Named as this because the user explicitly asked for "PRD open-decision reconciliation." |
| F247 Work List | T013 | Run a second source-to-WIKI test after Hermes | none | **unresolved on Drive side; superseded in spirit on Git side** | Cairn's pilot is technically a second, independent processing of the same source type on a different system — it satisfies the *intent* (prove the loop generalizes) without being literally "a second, different source." | — | None required for migration purposes. | n/a | No | Noting for completeness, not treating as a blocker. |

### B2. F247 Open Register — every "Active Open Question" in the current table

| # | Question (verbatim, current status per the register itself) | Disposition | Current Git destination | Merge blocker | Reason |
|---|---|---|---|---|---|
| 1 | Archive/delete/leave-marked duplicate folder names? — `Open` | retained-in-Drive | n/a | No | Pure Drive folder hygiene; myPKA has no equivalent duplicate-folder problem to inherit. |
| 2 | When to move existing F247 docs into new folder structure? — `Open` | retained-in-Drive | n/a | No | Drive-internal sequencing question, overtaken by events (docs have since moved repeatedly per the decision log). |
| 3 | Standardise existing doc names to dot-style? — `Open` | retained-in-Drive | n/a | No | Naming-convention question about Fusion247's own Drive files. |
| 4 | Minimum CategorisAIr metadata/template schema? — `Open` | **superseded** | `Team Knowledge/Guidelines/GL-008-source-classification-registry.md` | No | Cairn/GL-008 is a fresh, independent answer to the same underlying question. |
| 5 | Work/client meeting-transcript template content? — `Open` | **retained-in-Drive** | n/a (Warden's `SOP-010`–`014` solve the myPKA-side equivalent, but this specific question is about a Fusion247-Drive template, not a Git obligation) | No | Warden's meeting-intelligence SOPs already cover this need independently. |
| 6 | VerifiAIr's exact safe-update permissions? — `Open` | **verified-absorbed** | Larry's Duty 2 safe-corrective-boundary rule | No | Directly answered, this session. |
| 7 | First source-processing test (Hermes)? — `Open` (in the register; marked done elsewhere) | superseded | Cairn's pilot | No | Register itself is stale; the substance is done twice over now. |
| 8 | Drive→Markdown/Obsidian/Git migration timing? — `Deferred` | **this is literally the migration this whole engagement is** | this repo | No — in progress, not blocked | The register's own deferral trigger ("wait until laptop/local environment available") has been met; this question is answered by the fact that this audit exists. |
| 9 | First dashboard/cockpit view? — `Deferred` | approved-deferred | `Expansions/mypka-cockpit/` exists but is a generic myPKA feature, not built *for* Fusion247 specifically | No | Explicitly deferred in the source, consistent with "Do Not Build Yet" lists throughout Fusion247's own docs. |

**Business-naming open question (2026-07-04 entry, separate from the table above):** "Should Fusion247 use `IPA`, `BKM/BPM`, or another term for the business/project side?" — Status: **`Open pending first relevant ICOR course lesson note`**. **Disposition: unresolved, genuinely blocked on an external input** (the user's own ICOR course material, not yet processed through any adapter). Not a Git defect — nothing to build until that source material exists and is processed. **Merge blocker: No** (blocked on the user, not on missing work).

### B3. Named cross-cutting items

| Item | Original requirement | Current Git destination | Disposition | Evidence | Merge blocker | Reason |
|---|---|---|---|---|---|---|
| **Addendum A/B merge-and-archive instruction** | Addendum B's own header: "Merge instruction: fold B1–B8 into build.icor.md; B9 is the Codex bootstrap... Status: To be merged into build.icor.md by Fusion, then this file archived." | none | **unresolved** | `build.icor.md`'s own header is unchanged since 2026-07-03 ("Draft reference... requires Warwick review"); no merge occurred. | No (Drive-side housekeeping instruction, not a Git obligation) — but flagging per explicit instruction to test this. | The instruction was to Fusion (Drive-side), and it was never actioned there. It has no direct Git-side deliverable, but it does mean anyone citing "build.icor.md" as authoritative today is citing a doc its own author says is superseded-in-part by two addenda that were never folded in. |
| **B9 migration/bootstrap gates** | Five gated phases (see Part D) | this repo, partially | **mixed — see Part D** | — | **Yes**, on Phases 3–5 | Full breakdown in Part D. |
| **F247.proposal.agent-skill-boundary-refactor** | Split bloated all-in-one agent docs into contract/skill/guideline/template layers, piloted on CategorisAIr first | myPKA/Fusion247PKA's own architecture (Team/*/AGENTS.md + SOPs + Guidelines + Templates) already **is** the destination-side implementation of exactly this separation | **verified-absorbed, by construction — but never explicitly closed against this specific proposal** | Every specialist hired this engagement (Warden, Cairn) was built with contract/SOP/Guideline/Template already separated from day one. | No | The proposal's own goal was achieved as a side effect of how myPKA specialists are built, not because anyone ever went back to this specific proposal document and marked it satisfied. Worth an explicit closing note rather than leaving it as a dangling "proposed, zero action taken" record on the Drive side. |
| **GL-F247-001 / 13-stage project model real-project validation** | "Active candidate pending validation against a real project" | `Client Delivery/` — still a stub | **unresolved** | Confirmed directly, twice (GL-F247-001 and the ontology doc both say the same thing; `Client Delivery/INDEX.md` confirms zero engagements exist). | **Yes** | This is the same finding as my previous pass, now confirmed against the *source's own document*, not just against Git — the validation gate was never met on either side. |
| **Project template-pack reconciliation** | T028 above | — | retained-in-Drive (candidate) | — | No | See B1. |
| **TubeAIR / F247 YT Transcript Ingress adapter wiring** | Build a working YouTube-transcript capture pipeline into the Brain | `SOP-016-cairn-process-youtube-transcript.md` (the *processing* mechanics only) | **partially-absorbed** | SOP-016 explicitly re-derives the chunk-mapping mechanics; no adapter (Zapier route, capture automation) has been wired. `GL-011`'s "Adapter rule" states TubeAIR *must* preserve raw payload before Cairn processes it — a requirement, not yet a built adapter. | Read `GL-011-immutable-source-retention.md` §Adapter rule directly. | Build or explicitly defer the actual capture adapter (Zapier-first per the source's own decision). | Mack (automation/connector work) | **This is a roadmap item, not a merge blocker** — the processing-side mechanics exist; only the capture automation itself is unbuilt, and nothing in the source material treats the adapter as required before migration can be considered complete. | Separating "capability implemented" (processing mechanics: yes) from "adapter wired" (capture automation: no), per the user's explicit instruction to keep these separate. |
| **ICOR course-note adapter + business-domain naming** | Process ICOR course lesson notes; resolve IPA/BKM/BPM naming | none built; naming still `Open pending first relevant ICOR course lesson note` | **unresolved, blocked on external input** | See B2 above. | No | Not a Git defect — blocked on the user supplying course material, not on missing engineering. |
| **Raw ChatGPT/Claude/source import and preservation** | Addendum B Phase 4: bulk-import Fusion247's own ChatGPT conversation history via WS-002 | none | **unresolved — and currently impossible from what's in this repo** | Grepped for `conversations.json` / "ChatGPT export" anywhere under `Team Knowledge/` — zero hits. No raw export material exists anywhere in the Fusion247Brain repo either (`02_Sources/ChatGPT Exports` folder does not exist). | **Yes, as a named phase — but blocked on the user exporting the material first**, not purely a Git-side gap. | The runbook names this as a required phase; it cannot even be attempted until the raw export exists somewhere accessible. |
| **PRD open-decision reconciliation** | PRD §15 | — | unresolved (paperwork) | See B1/T017 and Part D. | No | Substance answered; document itself never annotated. |
| **Implementation-plan Phase 5 acceptance criteria** | 4 explicit criteria | this repo | **3 of 4 pass; 1 fails** | See Part D — full breakdown. | **Yes**, on the 4th criterion | Direct test against the plan's own stated acceptance criteria, not a paraphrase. |
| **Final Drive read-only/historical handover** | An explicit point where Drive stops being written to and becomes historical reference only | none | **unresolved** | The Decision Log's own most recent entry is dated 2026-07-10 (F247-T035, Support Handover) — Drive was still being actively decided-in and written to as of that date, well after this migration engagement began (2026-07-10). No handover announcement exists anywhere. | **Yes** | There is no evidence Drive has been formally retired. It may still be the live working surface for some Fusion247 activity — this needs the user's explicit confirmation, not an assumption either way. |
| **CareerAIR** | Career/CV knowledge management specialist | `tsk-2026-07-10-004-careerair-migration-direction-decision` | **approved-deferred** | Task open, priority 4, direction recommended, awaiting sign-off. | **Roadmap, not a blocker** — explicitly deprioritized by the user's own prior instruction, direction already drafted. | Genuinely a "when you're ready" item, not something silently dropped. |
| **AsdAIr (the household-shopping domain agent itself)** | Personal household-shopping automation via Claude in Chrome | `tsk-2026-07-10-005-asdair-retained-external-recommendation` | **approved-deferred**, trending toward **retained-external** | Master index confirms AsdAIr itself is `Active` Fusion247 Brain content (not out-of-scope) — distinct from the microsite below. | **Roadmap, not a blocker.** | Same as CareerAIR — open, deprioritized, direction already drafted. |
| **AsdAIr Microsite App** (the separate CV-building side-build project) | A standalone web app for Mum's shopping list | none, and per its own Drive record, **should have none** | **retained-external, by the source's own explicit design** | Decision log, F247-2026-07-07 entry, verbatim: *"Boundary: This is not part of `/Hey Fusion`, the Fusion247 PRD or the core implementation plan. Do not alter AsdAIr prompts, decisions log or order history as part of this project."* | **No — explicitly and deliberately out of scope**, stated by Fusion247's own governance, not a gap this audit is inventing an excuse for. | This is exactly the distinction the user asked me to draw explicitly: the microsite is a separate CV-strengthening app-build project the source system itself excluded from the PRD/implementation plan. It should never have been treated as a merge blocker, and isn't one. |

### B4. A genuinely new finding this pass, not previously flagged anywhere

| Item | Original requirement | Current Git destination | Disposition | Evidence | Merge blocker | Reason |
|---|---|---|---|---|---|---|
| **Register Item "lessons" kind** | Fusion247's own 13-stage folder spec names six registers: risk, issue, change, decision, dependency, **lessons** (`lessons-log`) | `GL-006-client-delivery-frontmatter-conventions.md` `kind` enum | **unresolved, and previously unflagged** | GL-006's `kind` field is `risk \| issue \| change \| decision` only. "Dependency" is at least named as a future-extension candidate with a free-text stopgap. "Lessons" appears **nowhere** in GL-006 or Warden's contract — grepped both directly, zero hits. | **Yes, small** | Two of six original register kinds are unaddressed; one was flagged before this pass, one was not. |

---

## Part C — Gap-analysis P1–P12 / S1–S4, individually re-checked (not just cited as "the matrix already covered this")

| Item | Disposition | Evidence |
|---|---|---|
| P1 manifest/framework-seam | **verified-absorbed** | `manifest.json` exists with `framework_paths`/`user_state_paths`. |
| P2 structural validation spec | **verified-absorbed** | `validation-script.sh` exists (per `manifest.json`'s own framework_paths list). |
| P3 SSOT + precedence | **verified-absorbed** | Root `AGENTS.md` Hard Rule 1; this whole engagement's practice. |
| P4 machine-actionable change recipes | **verified-absorbed** | `CHANGELOG-MIGRATION.md` referenced in manifest. |
| P5 index-rebuild SOP | **verified-absorbed** | `SOP-rebuild-task-index.md` exists and was used repeatedly this engagement. |
| P6 version stamping | **verified-absorbed** | `manifest.json`'s `scaffold_version`. |
| P7 Cockpit/SQLite data contract | **verified-absorbed** (myPKA-generic, not Fusion247-specific) | `Expansions/mypka-cockpit/` + `SOP-002`. |
| P8 portable core/adapter boundary | **verified-absorbed** | `GL-005-llm-agnostic-portable-core.md`; `.claude/`/`.codex/` shim split, used throughout. |
| P9 contract+shim pairing | **verified-absorbed** | Every hire this engagement (Warden, Cairn) shipped both layers. |
| P10 per-agent journals | **verified-absorbed** | `Team/*/journal/`, used this session (Larry's own two journal entries). |
| P11 governance docs as searchable data | **approved-deferred** | SOP-002/mypka.db exists; Fusion247-specific governance-doc mirroring not built, not required yet. |
| P12 orchestrator discipline | **verified-absorbed** | Larry's iron rule, root `AGENTS.md`. |
| S1 formal retro loop | **verified-absorbed** | `WS-004-team-retro-and-self-improvement-loop.md`. |
| S2 consolidated hard-rules block | **verified-absorbed** | Root `AGENTS.md` §Hard rules. |
| S3 backup-before-overwrite | **verified-absorbed** | `manifest.json`'s own stated backup behavior. |
| S4 blocked-state convention | **verified-absorbed** | `blocked_reason`/`blocked_by` fields, used throughout the task system this engagement. |

All 16 items independently re-verified this pass, not re-cited from memory. All check out. This part of the audit is clean.

---

## Part D — Direct acceptance-criteria tests (not paraphrase)

### D1. Implementation Plan Phase 5 acceptance criteria (verbatim from the source)

| Criterion (verbatim) | Result | Evidence |
|---|---|---|
| "Vault opens cleanly in Obsidian." | **Presumed pass, not independently tested this pass** | Structural design claim (`AGENTS.md`: "An Obsidian-compatible markdown folder"). No actual Obsidian launch was performed in this audit. |
| "Markdown files remain readable outside Obsidian." | **Pass** | Trivially true — plain markdown throughout. |
| "Git tracks changes." | **Pass** | Extensively demonstrated this entire engagement. |
| "Google Drive docs are either migrated or clearly marked as staging copies." | **FAIL** | This audit itself is the proof: T024/T025/T028/T029, the Addendum merge instruction, the agent-skill-boundary-refactor proposal, and the lessons-register gap are all real Drive obligations with **no explicit disposition anywhere** before this pass. They were neither migrated nor marked. |

**Net: 2 of 4 pass cleanly, 1 presumed-but-untested, 1 fails outright.** Phase 5 is not closed by its own stated criteria.

### D2. B9 gated bootstrap phases (Addendum B, verbatim gate language)

| Phase | Gate (verbatim) | Result |
|---|---|---|
| Phase 0 — preconditions | n/a (manual, Warwick-side) | **Pass** (implicitly — this repo exists) |
| Phase 1 — vendor+fork setup | "GATE: Warwick confirms activation report." | **Pass** — this repo, Larry active, confirmed throughout. |
| Phase 2 — schema extension | "GATE: Warwick ratifies the Guideline." | **Pass** — GL-006 built and iterated with explicit user sign-off across multiple QA passes. |
| Phase 3 — F247 port | "GATE: Warwick reviews one fully-ported project." | **FAIL — never attempted.** `Client Delivery/` is confirmed still a stub. Real BRK-001 data correctly excluded (live client data, already a considered decision), but nothing — not even a synthetic worked example — was substituted. |
| Phase 4 — ChatGPT history import | "GATE: session-log review." | **FAIL — never attempted, and currently unattemptable** (no raw export material exists anywhere in either repo). |
| Phase 5 — connectors & bridges | Each independently reversible; no single gate | **FAIL — never attempted.** No ClickUp, Withings, or calendar-feed setup anywhere. |

---

## Answers to the seven required questions

### 1. Is the Drive-to-Git merge genuinely complete?

**NO.**

### 2. Exact remaining merge blockers

- **Client Delivery/ has never been validated against a real (or even synthetic) engagement.** B9 Phase 3's gate — "Warwick reviews one fully-ported project" — has never been passed. GL-006/Warden's schema is built but functionally unproven.
- **F247-T024** — no engagement-intake SOP exists for Warden.
- **F247-T029** — the root-level build docs (`build.icor.md`, both Addenda) have no provenance record on either side; worth a Git-side equivalent even if the Drive-side registration is out of scope.
- **The Register Item schema is missing "lessons"** as a `kind` (dependency is at least flagged; lessons was never flagged anywhere before this pass).
- **Final Drive read-only handover has never happened** — Drive's own decision log was still actively being written to as of 2026-07-10, and no handover announcement exists. This needs the user's explicit call, not an assumption.
- **Implementation Plan Phase 5's own 4th acceptance criterion fails** as tested directly (see D1).

### 3. Exact approved-deferred / post-merge roadmap items

- CareerAIR (`tsk-004`) — direction drafted, awaiting sign-off, explicitly deprioritized by the user already.
- AsdAIr the domain (`tsk-005`) — same status.
- TubeAIR/ICOR adapter wiring — processing mechanics exist (SOP-016); capture automation itself is unbuilt and was never claimed to be a pre-migration requirement.
- ICOR course-note business-domain naming — blocked on the user's own course material, not on missing engineering.
- Governance-docs-as-searchable-data (gap-analysis P11) — explicitly fine to defer.
- F247-T025 (golden-master template release pattern) — likely moot under myPKA's own SSOT model, but flagged rather than assumed.

### 4. Exact retained-in-Drive or retained-external items

- **AsdAIr Microsite App** — retained-external, by the source's own explicit, pre-existing decision (outside `/Hey Fusion`, the PRD, and the implementation plan). This is not a merge blocker and the audit should not manufacture one.
- F247-T028 (template-pack reconciliation between two Fusion247 Drive drafts) — retained-in-Drive; internal to Fusion247's own documents, not a Git obligation.
- Most of the Open Register's folder-naming/duplicate-cleanup questions — retained-in-Drive, Drive-internal housekeeping with no myPKA equivalent problem.
- Raw ChatGPT conversation history — currently retained nowhere accessible; can't be migrated until it's exported.

### 5. Drive obligations missed entirely by WS-005 or later tasks

- **F247-T024, T025, T028, T029** — none of the four appear anywhere in the original 43-row Migration Coverage Matrix.
- **The Addendum A/B merge-and-archive instruction** — never checked by any prior pass.
- **`F247.proposal.agent-skill-boundary-refactor`** — never explicitly closed against, even though its intent was independently satisfied by construction.
- **GL-F247-001's real-project validation gate** — flagged before in my own prior (verbal, not audited) pass, but not previously checked against the *source document's own wording*, and not previously logged as a formal finding anywhere until this audit.
- **The Register Item "lessons" kind** — genuinely new, first surfaced in this pass.
- **PRD §15's own unannotated status** — never checked before.
- **Phase 5's 4th acceptance criterion, tested literally** — never tested this precisely before.

### 6. One-page Warwick sign-off checklist

- [ ] Decide T024: does Warden need a formal engagement-intake SOP, or is ad hoc judgement sufficient?
- [ ] Decide T025: is myPKA's single-canonical-template model an acceptable substitute for a "golden-master release pattern," or is something else wanted?
- [ ] Decide whether a synthetic/redacted worked-example engagement should be built in `Client Delivery/` to actually validate GL-006/Warden's schema, given real BRK-001 data correctly stays excluded.
- [ ] Decide whether `lessons` should be added as a Register Item `kind` (and whether `dependency`'s existing free-text stopgap needs promoting too).
- [ ] Confirm whether Drive is formally retired to read-only/historical status, or still an active working surface for some Fusion247 activity.
- [ ] Confirm CareerAIR and AsdAIr directions (already drafted in `tsk-004`/`tsk-005`).
- [ ] Confirm TubeAIR adapter wiring and ICOR course-note processing are genuinely post-migration roadmap, not blockers.
- [ ] Decide whether `build.icor.md`/Addendum A/B's provenance needs a Git-side record even though their own merge-and-archive instruction is Drive-internal.
- [ ] Approve (or amend) the task list in answer 7 below before anything is created.

### 7. Proposed Git tasks to close real gaps (not created — awaiting approval)

1. Design + build a Warden engagement-intake SOP (resolves T024), **or** explicitly rule it unnecessary.
2. Build one synthetic/redacted worked-example engagement in `Client Delivery/` to satisfy the B9 Phase 3 validation gate without touching real BRK-001 data.
3. Add `lessons` (and consider promoting `dependency`) to GL-006's Register Item `kind` enum.
4. Record `build.icor.md`/Addendum A/B's provenance somewhere in Git (even a short pointer note), independent of whether Drive ever does its own merge-and-archive.
5. Explicit user decision + record on Drive's read-only/handover status — not a build task, a decision to log.
6. (Only if the user later exports it) Run WS-002 against the Fusion247 ChatGPT conversation export.
7. (Roadmap, not urgent) TubeAIR capture-adapter build, ICOR course-note adapter, ClickUp/Withings connectors — tracked, not blocking.
