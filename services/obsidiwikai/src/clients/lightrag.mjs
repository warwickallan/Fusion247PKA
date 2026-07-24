// LightRAG client — extraction + retrieval engine (the candidate/working layer) and the
// LLM path (its /api/generate uses the box's OpenAI key, so no key ever lives locally).
import { endpoints, secrets } from '../config.mjs';

export function createLightRagClient({
  base = endpoints.lightrag,
  apiKey = secrets.lightragKey,
  fetchImpl = fetch,
} = {}) {
  const headers = { 'X-API-Key': apiKey, 'Content-Type': 'application/json' };
  async function jf(path, opts = {}) {
    const res = await fetchImpl(base + path, { headers, ...opts });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`lightrag ${opts.method || 'GET'} ${path} -> ${res.status}: ${t.slice(0, 300)}`);
    }
    return res.json();
  }

  return {
    // Ingest raw text as a source (async pipeline; poll track_status for completion).
    async ingestText(text, { source } = {}) {
      return jf('/documents/text', { method: 'POST', body: JSON.stringify({ text, file_source: source }) });
    },
    async trackStatus(trackId) { return jf('/documents/track_status/' + encodeURIComponent(trackId)); },
    async statusCounts() { return jf('/documents/status_counts'); },
    async documents() { return jf('/documents'); },

    async graphs({ label = '*', maxDepth = 3, maxNodes = 1000 } = {}) {
      return jf(`/graphs?label=${encodeURIComponent(label)}&max_depth=${maxDepth}&max_nodes=${maxNodes}`);
    },
    async labels() { return jf('/graph/label/list'); },

    async queryData(query, { mode = 'mix', topK = 12, onlyContext = true } = {}) {
      return jf('/query/data', {
        method: 'POST',
        body: JSON.stringify({ query, mode, top_k: topK, only_need_context: onlyContext }),
      });
    },

    async query(query, { mode = 'mix', topK = 12 } = {}) {
      const j = await jf('/query', {
        method: 'POST',
        body: JSON.stringify({ query, mode, top_k: topK, only_need_context: false }),
      });
      return j.response ?? j.data ?? '';
    },

    async entityExists(name) {
      return jf('/graph/entity/exists?name=' + encodeURIComponent(name));
    },
    async createEntity(entityName, entityData) {
      return jf('/graph/entity/create', {
        method: 'POST',
        body: JSON.stringify({ entity_name: entityName, entity_data: entityData }),
      });
    },
    async editEntity(entityName, updatedData, { allowRename = false, allowMerge = false } = {}) {
      return jf('/graph/entity/edit', {
        method: 'POST',
        body: JSON.stringify({
          entity_name: entityName,
          updated_data: updatedData,
          allow_rename: allowRename,
          allow_merge: allowMerge,
        }),
      });
    },
    async deleteEntity(entityName) {
      return jf('/graph/entity/delete', {
        method: 'DELETE',
        body: JSON.stringify({ entity_name: entityName }),
      });
    },
    async createRelation(sourceEntity, targetEntity, relationData) {
      return jf('/graph/relation/create', {
        method: 'POST',
        body: JSON.stringify({
          source_entity: sourceEntity,
          target_entity: targetEntity,
          relation_data: relationData,
        }),
      });
    },
    async editRelation(sourceEntity, targetEntity, updatedData) {
      return jf('/graph/relation/edit', {
        method: 'POST',
        body: JSON.stringify({
          source_id: sourceEntity,
          target_id: targetEntity,
          updated_data: updatedData,
        }),
      });
    },
    async deleteRelation(sourceEntity, targetEntity) {
      return jf('/graph/relation/delete', {
        method: 'DELETE',
        body: JSON.stringify({ source_entity: sourceEntity, target_entity: targetEntity }),
      });
    },

    // Live API 0313 contract: these names differ from older LightRAG clients.
    async mergeEntities(sourceEntities, targetEntity) {
      return jf('/graph/entities/merge', {
        method: 'POST',
        body: JSON.stringify({
          entities_to_change: sourceEntities,
          entity_to_change_into: targetEntity,
        }),
      });
    },

    async generate(prompt) {
      const j = await jf('/api/generate', {
        method: 'POST',
        body: JSON.stringify({ model: 'lightrag:latest', prompt, stream: false }),
      });
      return j.response ?? '';
    },
  };
}

export const lightrag = createLightRagClient();
