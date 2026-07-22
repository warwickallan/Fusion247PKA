// BUILD-002 WP4 — pure Telegram decision-card renderer.
//
// Turns a governed decision_card intent into the exact human-tap message that WOULD be sent. Rendered
// as PLAIN TEXT (sent with NO parse_mode) — QA2 finding C: subjects/bodies/labels/refs are ordinary
// first-party notes that routinely contain `_ * [ ] ( )` and backticks, which would break a Markdown
// send. Plain text is unambiguously safe for any content, so nothing needs escaping. Option KEYS are
// structurally constrained (finding D) to a safe shape so they can never inject into a RegExp or render
// oddly. Pure + deterministic (no I/O, no send) so it is unit-testable.
//
// card: { subject, body_markdown, options:[{key,label}], related_ref? }
export const OPTION_KEY_RE = /^[A-Za-z0-9]{1,3}$/;

// Validate decision options at the card boundary: >=1 option, unique keys matching the safe shape,
// non-empty labels. Throws on any violation so an ill-formed card fails closed rather than being sent.
export function validateDecisionOptions(options) {
  if (!Array.isArray(options) || options.length < 1) throw new Error('decision options: at least one option required');
  const seenKeys = new Set();
  const seenLabels = new Set();
  for (const o of options) {
    const key = o && o.key != null ? String(o.key) : '';
    const label = o && o.label != null ? String(o.label) : '';
    if (!OPTION_KEY_RE.test(key)) throw new Error(`decision option key "${key}" must match ${OPTION_KEY_RE} (1-3 alphanumerics)`);
    if (!label.trim()) throw new Error(`decision option "${key}" needs a non-empty label`);
    // Keys are matched CASE-INSENSITIVELY by parseChoice, so uniqueness must be case-insensitive too
    // (else "A" and "a" would both match a reply and be ambiguous).
    const keyNorm = key.toLowerCase();
    if (seenKeys.has(keyNorm)) throw new Error(`decision option key "${key}" is not unique (case-insensitive)`);
    // Labels must also be unique (case-insensitively) — a typed reply matching a label must be
    // unambiguous (QA2 call-A finding: two options could otherwise share a label).
    const labelNorm = label.trim().toLowerCase();
    if (seenLabels.has(labelNorm)) throw new Error(`decision option label "${label}" is not unique`);
    seenKeys.add(keyNorm);
    seenLabels.add(labelNorm);
  }
  return true;
}

export function renderCard(card) {
  if (!card || typeof card !== 'object') throw new Error('renderCard requires a card object');
  if (!card.subject || !String(card.subject).trim()) throw new Error('renderCard requires subject');
  validateDecisionOptions(card.options);

  // PLAIN TEXT — no Markdown markers, so any punctuation in the dynamic fields is safe and literal.
  const lines = [];
  lines.push(`🗳️ Decision needed — ${String(card.subject).trim()}`);
  lines.push('');
  if (card.body_markdown && String(card.body_markdown).trim()) { lines.push(String(card.body_markdown).trim()); lines.push(''); }
  lines.push('Reply with one:');
  for (const o of card.options) lines.push(`  ${o.key} — ${o.label}`);
  if (card.related_ref) { lines.push(''); lines.push(`ref: ${card.related_ref}`); }
  return lines.join('\n');
}
