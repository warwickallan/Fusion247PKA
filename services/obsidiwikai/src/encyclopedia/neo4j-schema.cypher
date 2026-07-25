// ObsidiWikAi curated encyclopedia — Neo4j schema (the canonical graph layer).
// This is the ONE user-visible encyclopedia (FR-021). LightRAG's own working graph is a
// separate internal store (the candidate layer) and is never presented as a second brain.
// Nodes carry a `status` so candidate/accepted/held/superseded coexist in one graph (PRD-FOLLOWUP).
// Idempotent (IF NOT EXISTS). Applied via the Neo4j HTTP tx API by bin/apply-schema.

CREATE CONSTRAINT owai_concept_id IF NOT EXISTS
  FOR (c:OwaiConcept) REQUIRE c.canonical_id IS UNIQUE;

CREATE CONSTRAINT owai_source_id IF NOT EXISTS
  FOR (s:OwaiSource) REQUIRE s.source_id IS UNIQUE;

CREATE INDEX owai_concept_name IF NOT EXISTS
  FOR (c:OwaiConcept) ON (c.canonical_name);

CREATE INDEX owai_concept_status IF NOT EXISTS
  FOR (c:OwaiConcept) ON (c.status);

CREATE INDEX owai_concept_type IF NOT EXISTS
  FOR (c:OwaiConcept) ON (c.type);

// Concept node properties (written by the canonicaliser):
//   canonical_id, canonical_name, description, type, status, confidence,
//   aliases (list<string>), source_count, evidence_count, privacy_domain,
//   first_seen, last_updated, superseded_by
// Source node properties: source_id, title, url
// Relationship types (FR-015): IS_ALIAS_OF, IS_A, PART_OF, ENABLES, USES, SUPPORTS,
//   CONTRADICTS, SUPERSEDES, CAUSES, AFFECTS, RELATED_TO, MENTIONED_IN, DERIVED_FROM
// Every relationship carries: source_id, run_id, confidence, created_at (provenance, FR-016).
// Namespaced labels (Owai*) keep our curated encyclopedia cleanly separate from the pre-existing
// Neo4j acceptance dataset in the same database.
