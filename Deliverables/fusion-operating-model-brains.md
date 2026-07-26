# Fusion operating model — BRAINS role + Larry builder-delegation (RECORDED INTENT, not a design)

**Status:** recorded 2026-07-26. This is the intended operating model that the synthesis layer (locked design
`6fe677f`, `idea-engine-synthesis-layer-DESIGN.md`) and today's smallest proof must not architect us away from.
It is a **role charter + flow record**, deliberately NOT a system design. The full Brains autonomous system is NOT
designed here and must not be built yet.

## The problem this prevents

The synthesis layer must **not** become another Warwick-managed ideas backlog. Atoms → opportunities exists so
Warwick spends attention on a *small* set of mature recommendations, not so 68 items become 68 tasks he administers.

## New conceptual role — BRAINS (Fusion Improvement / Product Manager)

Distinct from Silas (database/technical architect). Brains is a *synthesiser and product-manager* role, not an
implementer or a fact-researcher.

**Brains OWNS:**
- the durable idea/opportunity estate (register);
- cross-idea synthesis (atoms → opportunities);
- watching weak/emerging opportunities and detecting **changed opportunity state**;
- duplication / current-capability challenge (does Fusion already do this?);
- deciding when evidence is **insufficient**;
- commissioning **Pax** for current-state research where required;
- preparing mature **SPIN + ROI** recommendations;
- deciding what deserves Warwick's **scarce attention**.

**Brains does NOT:**
- research facts itself → **Pax**;
- define technical / data architecture → **Silas**;
- own personal memory / preferences → **Honcho**;
- route raw intake → **Cairn**;
- implement code;
- approve its own recommendations;
- replace **Larry**.

## Opportunities must distinguish at least two types

- **STRATEGIC / PRODUCT** — something genuinely new or consequential Warwick may want to explore.
- **SELF-IMPROVEMENT** — an improvement to Fusion itself, which should *increasingly be handled autonomously* rather
  than becoming another Warwick project.

## Intended future flow for a MATURE SELF-IMPROVEMENT opportunity

`atoms → Brains synthesis → Pax current-state/evidence (where required) → mature SPIN + ROI recommendation →
Warwick GO → Larry implementation plan → Warwick authorisation (where required) → Larry commissions bounded builder
agent(s) → independent QA/Tower → Larry integration → DONE/BLOCKED`

**Warwick commissions outcomes, not implementation administration.**

## Separate standing requirement — Larry builder-delegation capability

Larry remains **orchestrator, operational-truth keeper, reconciler, and integration authority**. Bounded
implementation work should increasingly be performed by **temporary builder agents** that receive durable WP/context
packets and return implementation + evidence — with independent QA/Tower and Larry integration on top. (This is the
delegation muscle the future self-improvement flow depends on; recorded now, designed/built later.)

## Constraint on today's proof

The smallest proof (one corpus-level synthesis pass) plays the **Brains synthesis** role in one-shot, manual form. It
must: surface a *small* set (not a backlog), classify each opportunity STRATEGIC vs SELF-IMPROVEMENT, end each with
actions (incl. "Research with Pax" / "Make build brief") rather than a direct build, and reject false clusters. It
must NOT: create a durable Brains system, an autonomous loop, the builder-delegation capability, or a graph schema.
Those are later, gated steps in the flow above.
