// Source intent — the human categorisation Warwick chooses at capture time (the Telegram cards).
// It decides HOW MUCH semantic work (and cost) a source earns. Independent of which model supplies
// the intelligence (that's the gateway/role axis) — the three axes stay unwelded.
export const INTENT = {
  KEEP_RAW: 'keep_raw',      // preserve the transcript only; £0 semantic spend
  EXTRACT: 'extract',        // DEFAULT: extract knowledge → populate Neo4j → link the raw source (cheap)
  DEEP_INDEX: 'deep_index',  // OPT-IN: also full-index the entire transcript for search (costs real money)
};

export const DEFAULT_INTENT = INTENT.EXTRACT;

export function normaliseIntent(v) {
  const s = String(v || '').toLowerCase();
  return Object.values(INTENT).includes(s) ? s : DEFAULT_INTENT;
}

// Card contract (for the capture-flow Telegram buttons — wired capture-side, respected here):
//   📄 Keep raw   → intent=keep_raw
//   🧠 Extract    → intent=extract      (default tap)
//   🔍 Deep-index → intent=deep_index   (explicit, priced)
export const CARD_BUTTONS = [
  { key: 'keep_raw', label: '📄 Keep raw' },
  { key: 'extract', label: '🧠 Extract to Brain' },
  { key: 'deep_index', label: '🔍 Deep-index' },
];
