-- 0011 — WP1.5 gap 1: distinguish the broad-discovery canonicalisation from the lens-DIRECTED second
-- pass (interest-conditioned extraction over the faithful-clean source, FR-006). 'broad' scores/
-- canonicalises what LightRAG already extracted; 'lens_directed' surfaces relevant concepts the broad
-- pass under-noticed and (if genuinely new) ADDS them to the one graph with provenance.
alter table obsidiwikai.wp15_entity_relevance add column if not exists pass text not null default 'broad';
alter table obsidiwikai.wp15_canonicalisation add column if not exists pass text not null default 'broad';
