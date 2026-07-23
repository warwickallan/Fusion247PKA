// Cairn contracts — the routing decision vocabulary. Source-adapter based so new input kinds
// (email, article, audio, document) add without rewriting Cairn.

export const LANE = Object.freeze({
  ENCYCLOPEDIA: 'encyclopedia', // world knowledge → LightRAG/Compiler → Neo4j
  PERSONAL: 'personal',         // journals/reflections → Obsidian personal vault
  TASK: 'task',                 // reminders/todos → task lane
  WORK: 'work',                 // Bellrock/client — walled, deferred lane (WP7)
  UNKNOWN: 'unknown',           // can't tell → ask Warwick
});

export const INTENT = Object.freeze({
  LEARN: 'learn',   // full-quality extraction into the encyclopedia (searchable)
  KEEP: 'keep',     // retain the source only, no semantic extraction
  JOURNAL: 'journal',
  TASK: 'task',
  ASK: 'ask',
});

export const PRIVACY = Object.freeze({
  WORLD: 'world',         // public/external knowledge — safe to process externally
  PERSONAL: 'personal',   // journals/health/family — never auto-shipped to external reasoning
  WORK: 'work',           // Bellrock/client — walled
  RESTRICTED: 'restricted', // uncertain → fail closed
});

export const ACTION = Object.freeze({
  ACT: 'act',         // proceed automatically
  CONFIRM: 'confirm', // propose + ask Warwick to confirm/correct (default for inferred actions)
  ASK: 'ask',         // genuinely unsure → ask Warwick what to do
});

// A decision: { source_type, what, intent, privacy, lane, treatment, confidence, rationale, action, decided_by }
export function decision(fields) {
  return {
    source_type: fields.source_type || 'unknown',
    what: fields.what || 'unclassified object',
    intent: fields.intent || INTENT.ASK,
    privacy: fields.privacy || PRIVACY.RESTRICTED,
    lane: fields.lane || LANE.UNKNOWN,
    treatment: fields.treatment || null,
    confidence: typeof fields.confidence === 'number' ? fields.confidence : 0.4,
    rationale: fields.rationale || '',
    action: fields.action || ACTION.ASK,
    decided_by: fields.decided_by || 'rules',
  };
}
