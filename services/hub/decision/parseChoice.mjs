// BUILD-002 WP4 — parse a human's A/B/C reply to a decision card (pure).
//
// The inbound half of the human-tap gate: a decision_card offered options [{key,label}]; the human
// replies (a Telegram message or a Directus pick). This maps that free text onto exactly one option,
// or returns no-match — it NEVER guesses. Deterministic + unit-testable; no I/O.
//
// Accepts: the bare key ("A"), "option A", "A)", "A.", "A - accept", or the full label ("Accept").
// Case-insensitive. Ambiguous/unknown replies return { ok:false } so the caller can re-ask rather
// than act on a guess.
export function parseChoice(text, options) {
  if (!Array.isArray(options) || options.length === 0) return { ok: false, reason: 'no options' };
  const raw = String(text ?? '').trim();
  if (!raw) return { ok: false, reason: 'empty' };
  const lower = raw.toLowerCase();

  const matches = [];
  for (const o of options) {
    const key = String(o.key ?? '').toLowerCase();
    const label = String(o.label ?? '').toLowerCase();
    if (!key) continue;
    const keyHit =
      lower === key ||
      lower === `option ${key}` ||
      lower === `${key})` ||
      lower === `${key}.` ||
      new RegExp(`^${key}[\\s):.\\-–—]`).test(lower); // "A - accept", "A: go", "A) foo"
    const labelHit = label && lower === label;
    if (keyHit || labelHit) matches.push({ key: o.key, label: o.label });
  }
  // Exactly one distinct option must match — otherwise it is ambiguous, and we refuse to guess.
  const distinct = [...new Map(matches.map((m) => [m.key, m])).values()];
  if (distinct.length === 1) return { ok: true, key: distinct[0].key, label: distinct[0].label };
  if (distinct.length > 1) return { ok: false, reason: 'ambiguous' };
  return { ok: false, reason: 'no match' };
}
