// Source intent — the human categorisation Warwick chooses at capture time (the Telegram card).
// Two modes only (the earlier Keep/Extract/Deep-index model is retired):
//   KEEP  = retain the source without learning it (raw preserved, £0 semantic spend)
//   LEARN = process it: faithful-clean full transcript → LightRAG → Neo4j → searchable graph
export const INTENT = {
  KEEP: 'keep',
  LEARN: 'learn',
};

export const DEFAULT_INTENT = INTENT.LEARN;

// Accepts legacy values (keep_raw / extract / deep_index) and folds them into the 2-mode model.
export function normaliseIntent(v) {
  const s = String(v || '').toLowerCase();
  if (s === 'keep' || s === 'keep_raw') return INTENT.KEEP;
  return INTENT.LEARN; // extract / deep_index / learn / anything else → LEARN
}

// Card contract (capture-flow Telegram buttons — wired capture-side, respected here):
//   📄 Keep   → intent=keep
//   🧠 Learn  → intent=learn   (default tap)
export const CARD_BUTTONS = [
  { key: 'keep', label: '📄 Keep' },
  { key: 'learn', label: '🧠 Learn' },
];
