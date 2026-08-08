# 00 — Executive Verdict

**Audit branch:** `audit/de-mypka-extraction-20260728` · **Baseline HEAD:** `ae32ac92b3781d75d0e8e525ce4f153b2a4390c7`
· **Import commit compared against:** `2eb94611f469994ede9fdd25cd600f6555b033a2` ("Initial import of
Fusion247PKA," 2026-07-10)

## What this repository really is today

`Fusion247PKA` is a **myPKA scaffold that has grown a large, genuinely independent build system inside it,
while its identity and bootstrap layer remains almost entirely the original upstream code.** These two facts
are both true and both important, and they answer different halves of the North Star question.

**At the identity/bootstrap layer, myPKA is still the operational centre.** `CLAUDE.md` — the file every
session reads first, including this audit session — has had exactly **one line changed** since the original
2026-07-10 import. It still opens with the Paperless Movement® trademark notice and instructs every session to
adopt "Larry, the team orchestrator of myPKA." `ADAPTER-PROMPT.md` (the actual bootstrap script), the entire
original 11-specialist roster's contract text (9 of 11 byte-identical), the licence/notice files, and the
task/journal mechanism are all **unmodified upstream material, actively executed every session.**

**At the build/governance layer, Fusion has built something the scaffold never had.** 994 new files were
added since import and **zero were deleted**. This is where Foundry-to-Build governance (SOP-010–022,
GL-006–011), Goal Contracts (`Builds/BUILD-015-.../BUILD-015-goal-contract.md`), the exact-head merge-QA
doctrine (`services/control-plane/tower/merge-check.mjs`), worker-agent commissioning, and eight independent
services (control-plane, cockpit, fusion-capture-gateway, hub, asdair, obsidiwikai, plus two now-superseded
Tower generations) genuinely live. None of this exists in the upstream scaffold at any version. It is Fusion's
own, built almost entirely from scratch on top of an unmodified upstream chassis.

**The one file that straddles both**, and matters most for planning the extraction, is
`Team/Larry - Orchestrator/AGENTS.md`: the name and role are upstream (present at the very first commit), but
its content has grown from 186 to 487 lines — the single most Fusion-authored file in the entire specialist
roster, carrying the delegation doctrine, the worker-commissioning pattern, and (as of tonight) the CI-truth
doctrine. It is upstream **and** actively required **and** overwhelmingly Fusion-owned by volume, all at once.

## How much is upstream, derived, Fusion-owned, personal, unknown

Counted at the **33-component logical inventory** (`01-component-inventory.md`), one primary provenance/
lifecycle tag per component — several components legitimately carry a real secondary tag, noted in the counts
section below rather than force-fit into a single bucket.

**Provenance:** 10 components primarily P0 (upstream) · 2 primarily P1 (derived) · 21 primarily P2
(Fusion-owned) · 0 primarily P3 or P4 at the component level (both exist as genuine secondary tags — see below)
· 0 P5 (nothing was genuinely unresolvable in origin, though several components carry real mixed content).

**Lifecycle:** 21 L0 (active & required) · 4 L1 (active but replaceable) · 4 L2 (dormant) · 2 L3 (superseded)
· 0 L4 at the component level (1 real sub-item — the `notify-snapshot-consumers.yml` workflow, red by design,
already ruled on tonight) · 1 L5 (historical evidence) · 1 L6 (external-runtime unknown) · 0 L7.

**Read this honestly**: 21 of 33 logical components are P2, but that undercounts how much upstream text is
still physically present, because P0 components (the original SOP/specialist corpus) are individually
small-file-count while P2 components (whole service directories) are individually large. By raw file count,
Fusion's own initial-import diff shows **994 files added vs 424 completely untouched since day one** — both
numbers matter; neither alone answers "is this still myPKA."

## Is a clean reusable core feasible

**Yes, with real work, and yes it should start from an empty repository, not this one.** The governance layer
(SOP-010–022, GL-006–011, the Goal-Contract pattern, the exact-head QA gate, the worker-commissioning
doctrine) is genuinely Fusion's own design and is coherent enough to restate from requirements without
needing to consult this repo's wording. The identity/bootstrap layer is not extractable as-is at all — it is
upstream text end to end — but the *pattern* it encodes (named orchestrator, delegating specialist team,
one-consent bootstrap) is simple enough to redesign cleanly. See `07-clean-room-extraction-plan.md`.

## The largest licensing/provenance risks

1. **This is a PUBLIC repository, still carrying 424 untouched files of CC BY-NC-SA 4.0 (NonCommercial +
   ShareAlike) material, alongside a Client-Delivery capability area shaped like real commercial consultancy
   work** (currently synthetic/proof data, per an existing completed task record — not a live client). Whether
   operating that capability commercially, even with synthetic data today, sits inside or outside the
   NonCommercial restriction is genuinely unresolved on the licence text and is the single most consequential
   open legal question this audit surfaced. **[LEGAL — see `09`]**
2. `Expansions/mypka-cockpit/` carries its own separate licence (adapted PolyForm Noncommercial) held by a
   **different** copyright holder ("myICOR," not Paperless Movement S.L.) — Fusion has not modified it at all
   (304 of 308 files byte-identical) and it must never be extracted into any new core.
3. ~20 raw, verbatim third-party YouTube transcripts are committed to this public repository
   (`Team Knowledge/Sources/_raw/`) — a distinct copyright question, independent of myPKA lineage entirely.
4. Three genuinely Fusion-authored files (`SOP-015`, `GL-011`, `Team/Cairn.../AGENTS.md`) name "ICOR" as a
   live/planned integration target, not a lineage acknowledgement — worth a trademark-clearance pass.
5. The exact upstream version Fusion started from (`4.1.1`, released 2026-06-23) **has no corresponding public
   tag** on `github.com/myICOR/myPKA` — the tag history jumps from `v2.4.0` straight to `v5.0.0`. This audit's
   provenance classification relies entirely on Fusion's own import-commit diff, not an external upstream
   comparison, which is methodologically sound for "what did Fusion touch" but leaves "what did the exact
   starting version actually contain" formally unverifiable from public evidence.

## The largest technical-debt findings

- **Two full generations of the Tower/merge-QA system are dead code that still passes its own CI**
  (`services/fusion-tower/`, `services/tower-baton/`) — CI presence here proves internal coherence, not
  liveness; both were explicitly superseded in writing by the next generation within a day or two of being
  built.
- **`services/cockpit/` and `services/obsidiwikai/` have zero CI coverage** despite one explicitly replacing
  the Directus admin shell and the other being a full knowledge-graph compiler with its own 14-file test
  suite that nothing in `.github/workflows/` ever runs.
- **BUILD-014's governance record was never filed into `Builds/`** — it is scattered across ~18 dated
  `Deliverables/` files instead, while BUILD-002/010/015 each got the proper durable-folder treatment. A real,
  if minor, organisational inconsistency.
- **The Directus-vs-`services/cockpit` supersession is in progress, not complete** — both are live-referenced
  in the evidence with no confirmation either way of which is currently the operative front door.

## Recommended next build

**Not a build at all — a decision.** Before any extraction work starts, Warwick needs to resolve the
NonCommercial-scope question (risk #1 above) with specialist counsel, because it determines whether the
Client-Delivery capability pack can exist inside a commercially-oriented `Fusion Core` at all. Everything else
in `07-clean-room-extraction-plan.md` can proceed in parallel — it only touches Fusion-owned material.

## The recommended deliberate parking point

Stop here. This audit is complete: evidence gathered, components classified, extraction designed on paper.
**Do not begin extraction, do not create the new repository, do not touch Buggly's or Jola's instances** until
Warwick has reviewed this evidence and the licensing questions in `09-licence-and-provenance-risk-register.md`
have at least a provisional answer.

---

## Required executive counts

### Provenance (33 components, primary tag; secondary tags noted)

| Tag | Count | Notes |
|---|---|---|
| P0 upstream | 10 | C001,C002,C003,C004,C005,C006,C009,C021,C022,C031 |
| P1 derived | 2 | C010, C014 |
| P2 Fusion-owned | 21 | C007,C008,C011,C012,C013,C015–C020,C023–C030,C032,C033 |
| P3 third-party | 0 primary (2 secondary: C021, C022 also carry a separate third-party licence) |
| P4 personal/runtime | 0 primary (1 secondary: C031 carries 7 P4 files inside an otherwise-P0 container) |
| P5 unknown/mixed | 0 |

### Lifecycle (33 components, primary tag)

| Tag | Count | Notes |
|---|---|---|
| L0 active & required | 21 | |
| L1 active but replaceable | 4 | C004, C018, C024, C030 |
| L2 dormant | 4 | C013, C014, C021, C022 |
| L3 superseded | 2 | C026, C027 |
| L4 defunct | 0 primary (1 real sub-item: `notify-snapshot-consumers.yml` inside C032) |
| L5 historical evidence | 1 | C019 |
| L6 external-runtime unknown | 1 | C033 |
| L7 unknown | 0 |

### Top ten most important active components

1. C007 Larry — Orchestrator identity + doctrine
2. C023 `services/control-plane/` (exact-head merge-QA gate)
3. C025 `services/fusion-capture-gateway/`
4. C028 `services/hub/`
5. C029 `services/asdair/`
6. C011 Fusion-authored SOPs (governance)
7. C012 Fusion-authored Guidelines
8. C008 Fusion-created specialists (Arc/Asdair/Cairn/Mason/Warden)
9. C006 Original 11 specialist roster (still actively routed)
10. C032 GitHub Actions CI (8 of 10 workflows)

### Top ten strongest removal/exclusion candidates (for the new core — nothing is deleted from this repo)

1. `services/fusion-tower/` — superseded twice over
2. `services/tower-baton/` — superseded once over
3. `Expansions/mypka-cockpit/` — separate copyright holder, never extract
4. `Expansions/app-developer/`, `Expansions/designer-pack/` — dormant source folders, capability already live elsewhere
5. `.codex/agents/*.toml` — quarantine, Warwick's own flagged pending review, not this audit's to resolve
6. `notify-snapshot-consumers.yml` — red by design, ruling already recorded tonight
7. `ideas/IDEA-007/` — historical PRD trail for an already-promoted idea
8. `Team Knowledge/Workstreams/WS-005` — one-time migration-reconciliation workstream, no future legacy system to reconcile against
9. Marketing/roadmap docs (`README.md`, `WAY-FORWARD.md`, `CHANGELOG*.md`) — not needed in a fresh core
10. `Deliverables/_archive`, `_corpus-dump.txt`, `_synthesis-proof-raw.json` — working scratch artefacts, historical only

### Top ten highest provenance/licensing risks

1. Public repo + CC BY-NC-SA NonCommercial scope vs. a commercially-shaped Client-Delivery capability
2. `Expansions/mypka-cockpit/` — separate licence, separate copyright holder ("myICOR")
3. ~20 raw third-party YouTube transcripts committed verbatim to a public repo
4. "ICOR" named as a live integration target in 3 Fusion-authored files (trademark clearance)
5. Undeclared/unpinned third-party Python deps (`neo4j`, `psycopg2` in `services/obsidiwikai/ops/`)
6. 10 of 12 npm packages declare no `license` field (2 explicitly `UNLICENSED`)
7. Bundled Hippocratic License 2.1 dependency in the Cockpit (inert/optional — low practical risk, still on record)
8. `services/control-plane/db/mypka/` Postgres schema naming choice, if ever shipped commercially under that name
9. Exact upstream starting version (`4.1.1`) has no public tag — provenance ceiling on any future direct comparison
10. Provenance is agent-persona-labelled, never model/vendor-labelled — weak against external scrutiny

### Top ten components most suitable for clean extraction

1. C007 Larry's operating doctrine (rewritten in Fusion's own words)
2. C011 Fusion-authored SOPs (governance corpus)
3. C012 Fusion-authored Guidelines
4. C008 Fusion-created specialist role definitions
5. C023 `services/control-plane/` exact-head merge-QA gate design
6. C025 `services/fusion-capture-gateway/` channel-intake pattern
7. C028 `services/hub/` adapter/routing pattern
8. C018 Client Delivery capability (GL-006, SOP-010–014) — **pending the licensing question above**
9. C016 `Builds/` BRIEF/CONTRACT/Architecture/Security/WP-STATUS/WP-EVIDENCE template shape
10. C029 `services/asdair/` as a worked example of the worker-commissioning pattern

### Top five questions Warwick may eventually need to answer

1. Does using the CC BY-NC-SA base-scaffold methodology to operate a commercial Client-Delivery practice fall
   inside or outside "commercial use of the material"?
2. Is it worth pursuing a genuine copy of the exact upstream `v4.1.1` (via the paid AI Library membership
   channel, if that is where it was originally distributed) to close the upstream-comparison gap?
3. Do the three "ICOR"-as-integration-target references need trademark clearance before commercial release?
4. What is the intended remedy, if any, for the raw YouTube transcripts committed to the public repo?
5. Is `services/cockpit/` meant to fully replace the Directus admin shell, or are both meant to coexist —
   and if replacement, when does `services/control-plane/wp-d-proof/directus/` get formally retired?
