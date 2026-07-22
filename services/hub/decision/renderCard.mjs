// BUILD-002 WP4 — pure Telegram decision-card renderer.
//
// Turns a governed decision_card intent into the exact human-tap message that WOULD be sent through
// FusionDevBot. Pure + deterministic (no I/O, no send) so it is unit-testable and so the worker can
// record the rendered card in its receipt in dry-run mode. The card lists the A/B/C options as the
// human's reply choices — the Codex→Telegram-card→human-tap gate. Never embeds a token or chat id;
// `target` is a symbolic recipient ref only.
//
// card: { subject, body_markdown, options:[{key,label}], related_ref? }
export function renderCard(card) {
  if (!card || typeof card !== 'object') throw new Error('renderCard requires a card object');
  if (!card.subject) throw new Error('renderCard requires subject');
  if (!Array.isArray(card.options) || card.options.length < 1) throw new Error('renderCard requires >=1 option');
  const keys = card.options.map((o) => o.key);
  if (new Set(keys).size !== keys.length) throw new Error('renderCard: option keys must be unique');

  const lines = [];
  lines.push(`🗳️ *Decision needed* — ${card.subject}`);
  lines.push('');
  if (card.body_markdown) { lines.push(String(card.body_markdown).trim()); lines.push(''); }
  lines.push('*Reply with one:*');
  for (const o of card.options) {
    if (!o.key || !o.label) throw new Error('renderCard: each option needs key + label');
    lines.push(`  *${o.key}* — ${o.label}`);
  }
  if (card.related_ref) { lines.push(''); lines.push(`_ref: ${card.related_ref}_`); }
  return lines.join('\n');
}
