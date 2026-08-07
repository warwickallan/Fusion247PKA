# 07 — Clean-Room Extraction Plan

**Design only. Nothing in this file has been implemented.** Working name per instruction: `Fusion Core`
(neutral, not final branding). Starts from a **new empty repository** — this repo is never forked, its git
history is never carried forward, its wording is never copied "to rewrite later."

## Proposed structure (starting hypothesis, per component evidence in `01`–`03`)

```
Fusion Core/
├── CORE
│   ├── bootstrap                 <- rewritten from C002/C003 requirements, no myPKA branding
│   ├── orchestration             <- rewritten from C007's doctrine content, neutral persona
│   ├── context-and-config        <- new: the manifest.json framework/user-state boundary pattern (C001), genericised
│   ├── task-and-decision-store   <- rewritten from C009/C010's task/journal mechanism
│   ├── skills-framework          <- new: formalises the "SOPs are skills, any agent can invoke any SOP" pattern already stated in root AGENTS.md
│   ├── agent-framework            <- rewritten from C006/C008 role definitions + SOP-021/022 worker-commissioning pattern
│   ├── governance                <- rewritten from C011/C012/C016 (Foundry-to-Build, Goal Contracts, BUILD template shape)
│   ├── audit-and-qa              <- rewritten from C023 (exact-head merge-QA gate design)
│   ├── adapters                  <- rewritten from C025/C028 (channel-neutral intake pattern)
│   └── deployment-contracts      <- new: today's own §8a CI-truth doctrine, generalised past this repo's specific CI setup
├── PACKS
│   ├── knowledge                 <- from C020's notes (NOT the raw transcript store — see data migration below)
│   ├── research                  <- from C008's Arc/Cairn/Mason pipeline pattern
│   ├── software-development      <- from C006's Felix/Vex/Vera roles, reimplemented
│   ├── business-operations       <- from C011/C012/C018 Foundry-to-Build + Client Delivery — PENDING the licensing gate below
│   ├── study-support              <- new, needed for Buggly (see `08`)
│   ├── life-administration        <- from C029's asdair pattern, domain-genericised (not household-shopping-specific)
│   ├── career                    <- new, not evidenced in this repo at all — CareerAir was named in the audit brief but no `services/careerair` or equivalent was found; treat as unresolved/not-yet-built, not as an extraction source
│   └── health                    <- new, deliberately excluded from Buggly/Jola per `08`; Warwick-instance-only if built at all
└── INSTANCES
    ├── Warwick
    ├── Buggly
    └── Jola
```

**Improvement on the starting hypothesis, evidenced**: `CareerAir` and `VlogOps` were named in the original
brief as Fusion-independent concepts, but this audit found **no corresponding `services/` directory or
dedicated SOP corpus for either** — searches for "CareerAir" and "VlogOps" outside `Deliverables/` and
`Team Knowledge/session-logs/` (where they appear only as narrative/planning references) returned nothing.
**These are not extraction sources; they are unbuilt or planning-stage concepts** and should not be listed as
if a `PACKS/career` or `PACKS/vlogops` already exists to extract from. Removed from the confident "reuse
unchanged" column below; flagged as unresolved instead.

## Per-component disposition

| Component (from `01`) | State |
|---|---|
| C001 Root licence/provenance | Exclude — author fresh licence for `Fusion Core` |
| C002 CLAUDE.md/AGENTS.md identity+bootstrap | Reimplement from requirements → `CORE/bootstrap`, `CORE/orchestration` |
| C003 ADAPTER-PROMPT.md | Reimplement from requirements → `CORE/bootstrap` |
| C004 Marketing/roadmap docs | Exclude |
| C005 validation-script.sh | Reimplement from requirements against the new structure |
| C006 Original 11 specialists | Reimplement role definitions from requirements → `PACKS/*` (do not copy contract text) |
| C007 Larry doctrine | **Redesign** — extract the principles, rewrite the persona → `CORE/orchestration` |
| C008 Fusion-created specialists | Reimplement from requirements → `PACKS/knowledge`, `PACKS/research` |
| C009/C010 Upstream + lightly-modified SOP/GL/WS | Reimplement mechanism only → `CORE/task-and-decision-store` |
| C011 Fusion SOPs (governance) | Reimplement from requirements → `CORE/governance`, `PACKS/business-operations` |
| C012 Fusion Guidelines | Reimplement from requirements → same targets |
| C013 WS-005 | Exclude — no legacy system to reconcile against in a fresh instance |
| C014 Codex shims | Unresolved — Warwick's pending review, not this plan's to decide |
| C015 tasks/session-logs | Migrate as private data → `INSTANCES/Warwick` only |
| C016 Builds/ | Retain only in historical repo; template *shape* → `CORE/governance` |
| C017 Deliverables/ | Retain only in historical repo |
| C018 Client Delivery | **Unresolved** — pending the licensing gate (Finding #1, `09`) before `PACKS/business-operations` can include it |
| C019 ideas/IDEA-007 | Retain only in historical repo |
| C020 Sources (notes) | Reimplement pattern → `PACKS/knowledge`; raw transcript store → migrate as private data or exclude entirely pending copyright resolution, never ship in a redistributable pack |
| C021 mypka-cockpit | Exclude entirely — separate licence, separate holder |
| C022 app-developer/designer-pack | Exclude entirely |
| C023 control-plane (core QA gate) | **Redesign**, provider-agnostic → `CORE/audit-and-qa` |
| C024 services/cockpit | Reimplement from requirements once CI-verified → candidate `INSTANCES/Warwick` output surface, not `CORE` (too Warwick-specific in current form) |
| C025 fusion-capture-gateway | Reuse the *pattern*, reimplement the code → `CORE/adapters` |
| C026 fusion-tower | Exclude — superseded |
| C027 tower-baton | Exclude — superseded |
| C028 hub | Reuse the pattern, reimplement → `CORE/adapters` |
| C029 asdair | Reimplement, domain-genericised → `PACKS/life-administration` |
| C030 obsidiwikai | Unresolved — close the CI gap first; genuine capability but not yet extraction-grade evidence |
| C031 PKM | Migrate as private data → shapes `INSTANCES/*` structure, never `CORE` |
| C032 CI workflows | Reimplement the path-filtered-per-service pattern, not the YAML |
| C033 External runtime refs | Reimplement the integration code → `CORE/adapters`; runtime itself is deployment, not extraction |

## Extraction order

1. **`CORE/bootstrap` + `CORE/orchestration`** — nothing else can be tested without a working identity layer.
2. **`CORE/task-and-decision-store` + `CORE/skills-framework`** — the substrate every governance pattern sits on.
3. **`CORE/audit-and-qa`** — reimplement the exact-head gate design provider-agnostically; this is the
   highest-value, best-evidenced piece and should be proven early while the design is fresh from this audit.
4. **`CORE/adapters`** (capture-gateway/hub pattern) — proves the core can actually take input.
5. **`CORE/agent-framework` + `CORE/governance`** — the worker-commissioning and Foundry-to-Build patterns,
   once there's a substrate to commission workers onto.
6. **First `PACKS/` entries**: `knowledge` and `research` (lowest personal-data risk, richest existing design).
7. **`business-operations`** only after the licensing gate (below) clears.
8. **`INSTANCES/Warwick`** — the reference, maximum-complexity instance, built last among the three because it
   has the most private data to migrate carefully.
9. **`INSTANCES/Buggly`, `INSTANCES/Jola`** — see `08` for why these are deliberately minimal, not
   maximal-minus-some-features.

## Acceptance criteria (per phase)

- **`CORE/bootstrap`**: a fresh clone activates to a working identity with zero myPKA/ICOR branding, zero
  trademark terms, in under the same number of user interactions as the current `ADAPTER-PROMPT.md` flow.
- **`CORE/audit-and-qa`**: an exact-head merge-QA gate proven against a real throwaway PR, with the same
  fail-closed guarantees as `merge-check.mjs` (missing build_ref/repo/PR/head → refuse, not guess).
- **Each `PACKS/` entry**: proven end-to-end against at least one real (or clearly synthetic) task, with an
  evidence record linking the new implementation back to the *behavioural requirement* observed in this audit
  — not back to the old repo's file.

## Test strategy

Every reimplemented component gets a test suite written against its **stated requirement**, not ported from
this repo's existing tests (porting tests risks porting upstream/derived expression along with them). Where
this repo's own test *scenarios* are genuinely instructive (e.g. the exact-head gate's fail-closed cases), the
scenario descriptions may inform new test design — the test *code* is rewritten.

## Provenance record

Every file created in `Fusion Core` should carry a short provenance note (not copied text, a record) pointing
to which `01-component-inventory.md` component ID informed its requirements — e.g. "orchestration doctrine
requirements derived from observed behaviour in Fusion247PKA component C007, see audit
2026-07-28." This keeps the evidence trail this audit built from being lost at the exact moment it becomes
most useful.

## Licence review gate

**Hard gate before `PACKS/business-operations` (Client Delivery) is populated with anything beyond the bare
governance schema, and before `Fusion Core` is ever made public**: resolve Finding #1 in
`09-licence-and-provenance-risk-register.md` with specialist counsel. Everything else in this plan can proceed
without waiting on that gate, since `CORE/*` and the other `PACKS/*` entries are built from Fusion's own
governance design, not from the base scaffold's licensed text.

## Data migration approach

- `INSTANCES/Warwick` inherits `PKM/`'s real content (the 7 P4 files + whatever `.gitignore`d material exists
  outside this repo entirely) via a private, non-public channel — never through the `Fusion Core` repository
  itself.
- No pre-baked `.db` file ships with `Fusion Core` or any instance template — every instance regenerates its
  own index from its own vault (see `06`'s `mypka.db` finding).
- The raw YouTube transcript store does not migrate anywhere until the copyright question is resolved.

## Rollback

Since nothing is deleted from `Fusion247PKA` at any point in this plan, rollback is definitionally trivial:
`Fusion Core` can be abandoned and rebuilt at any stage without any loss, because it never was the source of
truth — this repository remains that until `Fusion Core` is deliberately promoted.

## Proof gates

- **First reusable-core proof**: `CORE/bootstrap` + `CORE/orchestration` + `CORE/audit-and-qa` running
  end-to-end against one real (or synthetic) work item, entirely free of myPKA/ICOR trademark terms.
- **First Buggly proof**: the minimal GCSE study-support instance (see `08`) running with zero inherited
  Warwick content, zero commercial-consultancy capability present at all (not merely unused).
- **First Jola proof**: the minimal counselling/day-to-day instance (see `08`), with the private-data boundary
  independently verified before any content is loaded.
- **Commercialisation gate**: does not open until the Finding #1 licensing question has a specialist legal
  answer, independent of how well the technical extraction has gone.
