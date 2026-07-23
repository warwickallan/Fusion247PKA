// ObsidiWikAi — runtime configuration.
// Secrets come from process.env (load via: node --env-file lightrag.env --env-file neo4j.env
// --env-file honcho.env --env-file fusion-capture-gateway.env ...). No secret values live in this repo.

const BOX = process.env.FUSION_CORE_TAILNET || '100.101.240.85';

export const endpoints = {
  lightrag: process.env.LIGHTRAG_URL || `http://${BOX}:9621`,
  neo4jHttp: process.env.NEO4J_HTTP_URL || `http://${BOX}:7474`,
  directus: process.env.DIRECTUS_URL || `http://${BOX}:8055`,
};

export const secrets = {
  lightragKey: process.env.LIGHTRAG_API_KEY,
  neo4jUser: process.env.NEO4J_USER,
  neo4jPass: process.env.NEO4J_PASSWORD,
  honchoKey: process.env.HONCHO_API_KEY,
  honchoWorkspace: process.env.HONCHO_WORKSPACE || 'Fusion247',
  databaseUrl: process.env.DATABASE_URL,
};

// Canonicalisation confidence policy (EDC-style). Deliberately conservative:
// prefer a one-tap human review over a wrong silent merge (PRD FR-014 over-merge prevention).
export const thresholds = {
  autoApplyConfidence: 0.85,   // >= : apply the classification automatically
  reviewFloor: 0.55,           // [floor, autoApply) : surface a one-tap Directus review (FR-A)
  // < reviewFloor with a plausible match : treat as UNCERTAIN, hold + reservoir
  deferBelowRelevance: 0.40,   // interest relevance below this : deferred reservoir (FR-B), not discarded
  matchCandidates: 8,          // nearest existing concepts to consider per candidate
};

// LLM reasoning (classification tie-break, relevance, suggestions) runs THROUGH the box
// (LightRAG's OpenAI binding) so the OpenAI key stays Coolify-only, never local.
export const model = {
  llmVia: 'lightrag',
  // per-role models already configured on the box: extract gpt-5-mini, query gpt-5.6-terra
};

export const privacy = {
  // Domains that must never be sent to external model APIs or enter the encyclopedia by default
  // (PRD FR-030). Work/Bellrock is the explicit, separately-authorised final lane (WP7).
  externalBlockedDomains: ['personal', 'health', 'family', 'employer', 'bellrock', 'client'],
  defaultDomain: 'world',
};

export function assertConfig() {
  const missing = [];
  if (!secrets.lightragKey) missing.push('LIGHTRAG_API_KEY');
  if (!secrets.neo4jUser || !secrets.neo4jPass) missing.push('NEO4J_USER/NEO4J_PASSWORD');
  if (!secrets.databaseUrl) missing.push('DATABASE_URL');
  if (missing.length) throw new Error(`obsidiwikai: missing env: ${missing.join(', ')}`);
}
