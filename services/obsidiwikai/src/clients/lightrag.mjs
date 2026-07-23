// LightRAG client — extraction + retrieval engine (the candidate/working layer) and the
// LLM path (its /api/generate uses the box's OpenAI key, so no key ever lives locally).
import { endpoints, secrets } from '../config.mjs';

const base = endpoints.lightrag;
const H = { 'X-API-Key': secrets.lightragKey, 'Content-Type': 'application/json' };

async function jf(path, opts = {}) {
  const res = await fetch(base + path, { headers: H, ...opts });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`lightrag ${opts.method || 'GET'} ${path} -> ${res.status}: ${t.slice(0, 300)}`);
  }
  return res.json();
}

export const lightrag = {
  // Ingest raw text as a source (async pipeline; poll track_status for completion).
  async ingestText(text, { source } = {}) {
    return jf('/documents/text', { method: 'POST', body: JSON.stringify({ text, file_source: source }) });
  },
  async trackStatus(trackId) { return jf('/documents/track_status/' + encodeURIComponent(trackId)); },
  async statusCounts() { return jf('/documents/status_counts'); },

  // Retrieve the extracted graph (nodes + edges). label '*' = whole graph.
  async graphs({ label = '*', maxDepth = 3, maxNodes = 1000 } = {}) {
    return jf(`/graphs?label=${encodeURIComponent(label)}&max_depth=${maxDepth}&max_nodes=${maxNodes}`);
  },
  async labels() { return jf('/graph/label/list'); },

  // Semantic retrieval with provenance (entities/relations/chunks + source ids).
  async queryData(query, { mode = 'mix', topK = 12, onlyContext = true } = {}) {
    return jf('/query/data', {
      method: 'POST',
      body: JSON.stringify({ query, mode, top_k: topK, only_need_context: onlyContext }),
    });
  },

  // Full grounded answer (RAG) over the accumulated source knowledge.
  async query(query, { mode = 'mix', topK = 12 } = {}) {
    const j = await jf('/query', {
      method: 'POST',
      body: JSON.stringify({ query, mode, top_k: topK, only_need_context: false }),
    });
    return j.response ?? j.data ?? '';
  },

  // Graph-management primitives (verified live). Used for curation experiments; our canonical
  // writes go to Neo4j, but these let us merge within LightRAG's store when useful.
  async mergeEntities(sourceEntities, targetEntity, mergeStrategy) {
    return jf('/graph/entities/merge', {
      method: 'POST',
      body: JSON.stringify({ source_entities: sourceEntities, target_entity: targetEntity, merge_strategy: mergeStrategy }),
    });
  },

  // Raw LLM completion via the box (OpenAI key stays Coolify-only). Returns the text response.
  async generate(prompt) {
    const j = await jf('/api/generate', {
      method: 'POST',
      body: JSON.stringify({ model: 'lightrag:latest', prompt, stream: false }),
    });
    return j.response ?? '';
  },
};
