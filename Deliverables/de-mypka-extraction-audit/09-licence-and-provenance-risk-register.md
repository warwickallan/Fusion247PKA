# 09 — Licence and Provenance Risk Register

**This is technical provenance and risk analysis, not legal advice.** No claim below asserts that anything
is legally safe merely because it has changed substantially. Every item is tagged: **[EVIDENCE]** (directly
observed), **[INFERENCE]** (reasonable read of evidence, not certain), or **[LEGAL]** (requires specialist
legal advice before any commercial step — this audit cannot resolve it).

## Repository-level licences

| Subtree | Licence | Copyright holder | Evidence |
|---|---|---|---|
| Base scaffold (root markdown: `PKM/`, `Team/`, `Team Knowledge/`, SOPs, root docs) | CC BY-NC-SA 4.0 | Paperless Movement S.L. | `LICENSE`, `LICENSE-MAP.md`, unmodified since import [EVIDENCE] |
| `Expansions/mypka-cockpit/` | "myICOR Cockpit Personal-Use License v1.0" (adapted PolyForm Noncommercial 1.0.0) | **myICOR** — a distinct copyright holder from Paperless Movement S.L. | `Expansions/mypka-cockpit/LICENSE` [EVIDENCE] |
| `Expansions/app-developer/`, `Expansions/designer-pack/` | CC BY-NC 4.0 (adapted) | Paperless Movement S.L. | Nested `LICENSE` files in each [EVIDENCE] |
| `services/*` (all Fusion-built) | No declared licence | N/A — Fusion's own code | 10 of 12 `package.json` files have no `license` field at all; 2 (`services/asdair/*`) are explicitly `UNLICENSED` [EVIDENCE] |

## Finding #1 (Top risk) — public redistribution of NonCommercial+ShareAlike material, with a commercial-shaped capability alongside it

**[EVIDENCE]** This repository is **PUBLIC** on GitHub (`gh repo view` confirms `visibility=PUBLIC`).
**[EVIDENCE]** 424 of the 453 files present at import are still byte-identical to the CC BY-NC-SA 4.0
"base scaffold" material; the licence's own ShareAlike clause requires any public redistribution of an
adapted version to remain under the same licence — the repo's `LICENSE` file is unchanged, so that specific
mechanical requirement appears satisfied at the file level.
**[EVIDENCE]** The repository also contains `Client Delivery/meridian-pos-modernisation/`, a populated,
Warden-specialist-governed capability area modelling a client engagement (Work Packages, Evidence Packs, a
Risk/Issue/Change/Decision register) — confirmed by an existing completed task
(`tsk-2026-07-12-002-synthetic-client-delivery-engagement-proof`) to be **synthetic/redacted proof data**,
not a real paying client, per project record.
**[INFERENCE]** The NonCommercial clause's scope as applied to "using the folder-structure/SOP methodology
to help operate an unrelated commercial or consultancy practice" (as opposed to selling the scaffold itself)
is genuinely ambiguous on the licence text alone.
**[LEGAL]** Whether operating any commercial activity *using* this repository's licensed material — even
where the underlying business itself is unrelated to "the scaffold" — triggers the NonCommercial restriction
is a question for specialist copyright counsel before any commercial use proceeds, synthetic-proof-data or
not. This is the single most consequential open question in the entire audit.

## Finding #2 — trademark exposure in Fusion-authored content (not upstream boilerplate)

**[EVIDENCE]** `ICOR`/`myICOR` appear in three genuinely Fusion-authored files, treating ICOR as a **named,
live/planned integration target** rather than a lineage acknowledgement:
`Team Knowledge/SOPs/SOP-015-cairn-process-external-source.md` ("an ICOR course-note drop"),
`Team Knowledge/Guidelines/GL-011-immutable-source-retention.md` ("ICOR adapter"),
`Team/Cairn - Knowledge Intake Specialist/AGENTS.md` (4 occurrences).
**[EVIDENCE]** By contrast, the 425 raw `myPKA`/`ICOR` hits across `services/`, `Deliverables/`, and Fusion
SOPs are overwhelmingly (a) the literal Postgres schema name `mypka` used throughout
`services/control-plane/db/mypka/*.sql` (a functional identifier, not branding text), or (b) descriptive,
lineage-acknowledging references in `Deliverables/` migration-coverage documents discussing Fusion's own
relationship to the prior myPKA/ICOR system.
**[INFERENCE]** No instance found anywhere of "myPKA"/"ICOR"/"myICOR" used as a **brand name for a
Fusion-authored product** — consistent with `LICENSE-MAP.md`'s permitted "descriptive/nominative" use.
**[LEGAL]** The three ICOR-as-integration-target references, and the `db/mypka` schema-name choice if that
service is ever distributed commercially under that name, should get a specialist trademark-clearance pass
before commercial release — low probability of real exposure based on current evidence, but not zero.

## Finding #3 — raw third-party content committed verbatim to a public repo

**[EVIDENCE]** `Team Knowledge/Sources/_raw/` contains ~20 complete, verbatim YouTube video transcripts
(other creators' content) committed to this public repository, distinct from the ~20 Fusion-authored
"standalone knowledge reconstruction" notes derived from them (which carry an explicit `review_state` field
and a documented separation boundary in `Team Knowledge/Sources/README.md`).
**[INFERENCE]** The separation between "raw evidence" and "Fusion's derivative notes" is well-designed for
knowledge-quality and personal-data purposes, but the README does not address the **copyright status of
publicly redistributing verbatim third-party video transcripts**, which is a separate question entirely.
**[LEGAL]** Verbatim public redistribution of another creator's transcript is a distinct copyright exposure
from anything myPKA-related — flagged as a standalone item requiring its own legal review, independent of
the myPKA lineage question this audit is centred on.

## Finding #4 — undeclared/unpinned third-party dependencies

**[EVIDENCE]** No `requirements.txt` or `pyproject.toml` exists anywhere in the repository. Of 15 Python
files, all are stdlib-only **except** `services/obsidiwikai/ops/graph-server.py` and `report-server.py`,
which import `neo4j` (typically Apache-2.0) and `psycopg2` (typically LGPL-with-exception) with **no version
pin and no licence declaration anywhere in the committed source**.
**[EVIDENCE]** 10 of 12 npm `package.json` files declare no `license` field at all (all are `"private": true`,
first-party code — low practical risk, but inconsistent with the discipline shown elsewhere in the repo).
**[EVIDENCE]** `node_modules/` is confirmed **not** committed to git.
**[EVIDENCE]** `Expansions/mypka-cockpit/NOTICE` already tracks its own third-party dependency licences at a
finer grain than any package.json, including one **Hippocratic License 2.1** (non-OSI "ethical source")
component pair (`react-leaflet`/`@react-leaflet/core`), confirmed inert/optional (only used by an unactivated
"workouts" feature pack, not compiled into the core app by default).
**[INFERENCE]** Practical risk is low across the board (first-party private packages, permissively-licensed
Python deps by common convention) but should be formally pinned and declared before any commercial packaging.

## Finding #5 — provenance is agent-labelled, not generation-method-labelled

**[EVIDENCE]** 61 files carry `agent_id:` frontmatter and 22 carry `authored_by:`, identifying which named
Fusion specialist persona (Silas, Larry, etc.) produced a document. **Zero files** anywhere use a `model:` or
`generated_by:` field identifying the underlying LLM/vendor.
**[INFERENCE]** This is a real, if minor, provenance gap for "model-generated assets where provenance is
unclear" — the repo can tell you *which persona* authored something, never *which model generated it*. Not a
licensing blocker on its own, but worth correcting if provenance ever needs to withstand external scrutiny.

## Trademarks (repository-declared, not licensed under CC BY-NC-SA)

| Mark | Registration | Holder |
|---|---|---|
| PAPERLESS MOVEMENT® | USPTO Reg. No. 6,689,873 | Paperless Movement S.L. |
| ICOR® | USPTO Reg. Nos. 6,607,819 and 6,608,200 | Paperless Movement S.L. (or affiliated holding entity) |
| myICOR™ | Common-law / EUTM pending | Paperless Movement S.L. / myICOR |
| myPKA™ | Common-law / EUTM pending | Paperless Movement S.L. / myICOR |

Per `NOTICE.md`: descriptive/nominative use is permitted ("based on the myPKA™ Scaffold by ICOR®"); use as
the name, logo, or branding of a derivative/competing product is not.

## Commercial-use blockers (summary)

1. **[LEGAL — top priority]** NonCommercial scope as applied to Client Delivery / consultancy use of the
   base scaffold — Finding #1.
2. **[LEGAL]** ShareAlike compliance if the *new core* repository is ever made public with material derived
   from (not clean-room-reimplemented from) the CC BY-NC-SA base scaffold — mitigated entirely if the clean-
   room principles in `07-clean-room-extraction-plan.md` are actually followed (start empty, reimplement from
   requirements, do not copy wording).
3. **[LEGAL]** Trademark clearance for the three ICOR-as-integration-target references and the `mypka`
   schema-naming choice — Finding #2.
4. **[LEGAL]** Copyright status of the committed raw YouTube transcripts — Finding #3, independent of myPKA
   lineage.
5. **[TECHNICAL, not legal]** `Expansions/mypka-cockpit/` (PolyForm Noncommercial, different copyright holder
   entirely — "myICOR") must not be carried into any new core under any circumstances; it is not Fusion's to
   relicense. Fusion's own `services/cockpit/` is a wholly separate, wholly Fusion-authored artefact with no
   claimed external licence entanglement in its own README — but that self-declaration has not been
   independently verified line-by-line in this audit and should be spot-checked before being treated as
   licence-clean.

## Questions that require legal advice before commercial release

1. Does using the CC BY-NC-SA-licensed base-scaffold *methodology and structure* to operate an unrelated
   commercial practice (Client Delivery / consultancy) fall inside or outside "commercial use of the
   material" under CC BY-NC-SA 4.0?
2. Does a clean-room reimplementation (per `07-clean-room-extraction-plan.md`'s principles) genuinely exit
   ShareAlike obligations, or does sufficient conceptual/structural similarity to the original still trigger
   them?
3. Is naming a Postgres schema `mypka` inside a service that may ship commercially a trademark risk, or is it
   purely functional/internal and outside trademark scope?
4. What is the copyright exposure of having publicly committed ~20 verbatim third-party YouTube transcripts,
   and what is the correct remedy (takedown, licence, fair-use analysis) if any is required?
5. Does `Expansions/mypka-cockpit/`'s PolyForm-Noncommercial licence (held by "myICOR", not Paperless
   Movement S.L.) impose any obligation on Fusion beyond "do not distribute it commercially," given Fusion has
   not modified it at all?
