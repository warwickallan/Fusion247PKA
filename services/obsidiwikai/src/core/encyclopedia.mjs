// The curated encyclopedia: writes to Neo4j (live graph) + Supabase (durable, rebuildable mirror).
import { run as cy, rows as cyrows } from '../clients/neo4j.mjs';
import { q } from '../clients/db.mjs';
import { conceptId, nowIso } from './util.mjs';

export const SAFE_RELS = new Set([
  'IS_ALIAS_OF', 'IS_A', 'PART_OF', 'ENABLES', 'USES', 'SUPPORTS', 'CONTRADICTS',
  'SUPERSEDES', 'CAUSES', 'AFFECTS', 'RELATED_TO', 'MENTIONED_IN', 'DERIVED_FROM',
]);

// Match candidates for a name (exact / alias / substring both ways).
export async function searchConcepts(name, limit = 8) {
  return cyrows(
    `MATCH (c:OwaiConcept)
     WHERE toLower(c.canonical_name) = toLower($name)
        OR any(a IN c.aliases WHERE toLower(a) = toLower($name))
        OR toLower(c.canonical_name) CONTAINS toLower($name)
        OR toLower($name) CONTAINS toLower(c.canonical_name)
     RETURN c.canonical_id AS canonical_id, c.canonical_name AS canonical_name,
            c.description AS description, c.type AS type, c.aliases AS aliases, c.status AS status
     LIMIT $limit`,
    { name, limit }
  );
}

export async function createConcept({ id, name, description, type = 'Concept', status = 'accepted', confidence = 0.75, privacy = 'world' }) {
  const cid = id || conceptId(name);
  const now = nowIso();
  await cy(
    `MERGE (c:OwaiConcept {canonical_id:$cid})
     ON CREATE SET c.canonical_name=$name, c.description=$description, c.type=$type,
        c.status=$status, c.confidence=$confidence, c.aliases=[], c.privacy_domain=$privacy,
        c.source_count=0, c.evidence_count=0, c.first_seen=$now, c.last_updated=$now
     ON MATCH SET c.last_updated=$now,
        c.description = CASE WHEN c.description IS NULL OR c.description='' THEN $description ELSE c.description END`,
    { cid, name, description: description || '', type, status, confidence, privacy, now }
  );
  await q(
    `insert into obsidiwikai.canonical_concept(canonical_id,canonical_name,description,type,status,confidence,privacy_domain)
     values($1,$2,$3,$4,$5,$6,$7)
     on conflict (canonical_id) do update set
        description = coalesce(nullif(obsidiwikai.canonical_concept.description,''), excluded.description),
        last_updated = now()`,
    [cid, name, description || '', type, status, confidence, privacy]
  );
  return cid;
}

export async function addAlias(cid, alias) {
  await cy(
    `MATCH (c:OwaiConcept {canonical_id:$cid})
     SET c.aliases = CASE WHEN $alias IN c.aliases THEN c.aliases ELSE c.aliases + $alias END,
         c.last_updated=$now`,
    { cid, alias, now: nowIso() }
  );
  await q(
    `update obsidiwikai.canonical_concept
       set aliases = case when aliases @> to_jsonb(array[$2::text]) then aliases else aliases || to_jsonb(array[$2::text]) end,
           last_updated = now()
     where canonical_id = $1`,
    [cid, alias]
  );
}

export async function addEvidence(cid, { sourceId, runId, wording, claim, model, confidence }) {
  const r = await q(
    `insert into obsidiwikai.concept_evidence(canonical_id,source_id,run_id,original_wording,extracted_claim,model,confidence)
     values($1,$2,$3,$4,$5,$6,$7)
     on conflict (canonical_id,source_id,original_wording) do nothing
     returning evidence_id`,
    [cid, sourceId, runId, wording, claim || null, model || null, confidence || null]
  );
  if (r.rowCount > 0) {
    await q(`update obsidiwikai.canonical_concept set evidence_count=evidence_count+1, last_updated=now() where canonical_id=$1`, [cid]);
    await cy(`MATCH (c:OwaiConcept {canonical_id:$cid}) SET c.evidence_count = coalesce(c.evidence_count,0)+1`, { cid });
  }
}

export async function linkSource(cid, sourceId) {
  await cy(
    `MATCH (c:OwaiConcept {canonical_id:$cid})
     MERGE (s:OwaiSource {source_id:$sid})
     MERGE (c)-[r:MENTIONED_IN]->(s) SET r.last_seen=$now`,
    { cid, sid: sourceId, now: nowIso() }
  );
  await q(
    `update obsidiwikai.canonical_concept
       set source_count = (select count(distinct source_id) from obsidiwikai.concept_evidence where canonical_id=$1),
           last_updated = now()
     where canonical_id=$1`,
    [cid]
  );
}

export async function relate(fromId, toId, type, { sourceId, runId, confidence = 0.6, description } = {}) {
  if (fromId === toId) return;
  const T = SAFE_RELS.has(type) ? type : 'RELATED_TO';
  await cy(
    `MATCH (a:OwaiConcept {canonical_id:$fromId}), (b:OwaiConcept {canonical_id:$toId})
     MERGE (a)-[r:${T}]->(b)
     ON CREATE SET r.source_id=$sourceId, r.run_id=$runId, r.confidence=$confidence, r.description=$description, r.created_at=$now`,
    { fromId, toId, sourceId, runId, confidence, description: description || null, now: nowIso() }
  );
}

export async function ensureSource({ sourceId, title, url, captureId = null, rawRef = null, rawSha = null, privacy = 'world' }) {
  await q(
    `insert into obsidiwikai.source(source_id,title,source_url,capture_id,raw_ref,raw_sha256,privacy_domain)
     values($1,$2,$3,$4,$5,$6,$7)
     on conflict (source_id) do update set title=coalesce(excluded.title, obsidiwikai.source.title), last_seen=now()`,
    [sourceId, title || null, url || null, captureId, rawRef, rawSha, privacy]
  );
  await cy(`MERGE (s:OwaiSource {source_id:$sid}) ON CREATE SET s.title=$title, s.url=$url`, { sid: sourceId, title: title || null, url: url || null });
}

export async function encyclopediaStats() {
  const c = await cyrows(`MATCH (c:OwaiConcept) RETURN count(c) AS concepts`);
  const r = await cyrows(`MATCH (:OwaiConcept)-[r]->() RETURN count(r) AS relationships`);
  return { concepts: c[0]?.concepts ?? 0, relationships: r[0]?.relationships ?? 0 };
}
