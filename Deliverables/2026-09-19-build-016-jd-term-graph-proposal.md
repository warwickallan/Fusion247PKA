# BUILD-016 proposal — JD term graph + semantic coverage matching ("the CareerAIR graph")

**Status: PROPOSAL for Warwick's product decision. Nothing here is authorised work.**
**Origin:** Warwick, 2026-09-19 (Apps/RAG exploration thread): *"what if when you analyse a job
description, key terms and phrases are captured and linked together, then when you write a cv for
another similar position, not only can you draw from the master/canonical cvs but you can ensure
that they are RAG key word matched."*

**Privacy note:** this proposal is deliberately generic. All examples, real JD phrases, and the
full schema sketch live in the private tree: `C:/.fusion247/private/careerair/design/2026-09-19-jd-term-graph-schema-sketch.md`.
No employer, role, or salary data appears in this file, per the standing privacy rule.

---

## The outcome, in one sentence

When a CV is forked for a role, the pipeline already knows — from every advert it has ever
analysed and every application outcome it has ever recorded — which of the advert's requirements
are covered, adjacent, or gaps against the canonical masters, and exactly which literal phrases to
mirror for ATS matching, with the claims controls enforced structurally rather than by memory.

## Why this, why now

1. **The language knowledge currently evaporates per application.** Each fork reads the advert
   fresh; the headline-mirroring and requirement-to-evidence tables are hand-built every time.
   The ledger keeps outcomes but not the *vocabulary* that produced them.
2. **The learning loop is the moat.** Applications now have outcomes (interviews, rejections,
   silences, one AI-scored top-of-pile). Linking advert term clusters to outcomes lets future CVs
   weight what demonstrably works. No off-the-shelf tool has this because no off-the-shelf tool
   holds both sides plus results.
3. **The infrastructure already exists and is proven.** A production LightRAG→Neo4j pipeline runs
   on the estate's cloud host (Hetzner/Coolify, tailnet-only), with embedding, graph storage and a
   force-graph viewer pattern all live. This proposal reuses the *pattern*, not the instance.

## Two matching layers, both required

- **Lexical (graph):** ATS parsers are literal. The advert's exact terms and phrases become graph
  nodes; the fork gets a keyword sheet of safe-to-mirror literal phrases. The claims controls live
  on the term nodes themselves (`never_claim`, `held:false` platform nouns), so the same query that
  suggests keywords enforces the guardrails.
- **Semantic (vectors):** requirement bullets and master evidence bullets are embedded **whole**
  (sentence/phrase level, not words). Coverage is meaning-level cosine similarity — it matches
  "multiple simultaneous projects" to "eleven concurrent implementations" with zero shared words.
  Neo4j 5 native vector indexes hold both layers in one store, one query language.

## Infrastructure decision (contained)

A **separate `neo4j:5-community` container** on the existing Coolify host — own volume, own
credentials, own port. **The production Brain (LightRAG/Neo4j, Team Knowledge) is not touched**:
not its container, not its database, not its views. Tag-based sharing of the Brain's graph was
considered and rejected: Community Edition has no multi-database isolation, the Brain's views
query the whole graph (career data would leak into them), and mixing a second writer into a
working production store is uncontained risk for zero saving.

## Relationship to WO-2026-08-29-01 (score-at-acquisition, drafted, unissued)

That order makes the scheduled run score and NAME every acquired prospect (Amendment 7: rank,
never bin). This proposal is the **companion harvest** at the same pipeline moment: the analysis
pass that scores an advert also extracts its requirement bullets and terms into the graph.
**Sequencing recommendation: issue WO-2026-08-29-01 first, unchanged** — it is enveloped and
ready — then the graph slice lands as a separate order that reads the same persisted advert text
and requirement sets, adding an extraction+embedding step and the coverage-report query. Folding
the graph into the existing order would bloat a ready WO and violate the thin-slice discipline.

## Walking skeleton (the whole of phase 1)

1. **Harvest:** at analysis time, one extraction pass per advert → requirement bullets + normalised
   terms → MERGE into the CareerAIR graph; embed bullets via the estate's existing embedding route.
2. **Seed:** embed the four canonical masters' evidence bullets once (~100 bullets).
3. **Report:** the fork-notes "requirement to evidence" table becomes a generated artefact —
   covered / adjacent / gap per requirement, plus the ATS keyword sheet. Human judgement still
   writes the CV; GL-007 and the claims verification are unchanged.
4. **Backfill:** ledger rows → Application and Outcome nodes, enabling the outcome-weighting query
   from day one on existing history.

**Acceptance shape (per "nothing lives only in Larry's head"):** the real analysis pass on a real
newly-acquired advert produces graph rows and a coverage report without manual invocation, and a
fork consumes the generated table. Manual one-off runs prove capability only.

## Explicit non-goals (regrowth cap applied)

- No ontology manager, term-curation UI, or taxonomy governance process.
- No auto-generation of CV prose from the graph. The fork remains judgement + GL-007.
- No coupling to the production Brain graph, its views, or its LightRAG instance.
- No new daemon; extraction runs inside the existing scheduled run and sweep flows.
- No change to the 7/10 rule, the calibration table, or the evidence hierarchy.

## The decision Warwick is being asked to make

1. **Approve the direction** (graph + semantic coverage as a BUILD-016 extension) — or park it.
2. **Approve the sequencing** — WO-2026-08-29-01 issued first, graph slice second — or reorder.
3. **Approve the infrastructure shape** — new small Neo4j container on the existing host (small
   incremental cost on the box, no new spend expected; confirmed at deploy time) — or keep phase 1
   entirely local (Postgres/SQLite edges, no vectors) and defer the container until the traversals
   earn it.

Recommended: 1 approve · 2 as stated · 3 the container, because the vector-index layer is where
half the value lives and the host already exists.
