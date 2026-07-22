// BUILD-002 WP5 — Shopper route: ShopperBot payload → AsdAIr list-item intents.
//
// The bounded Shopper integration. It REUSES the AsdAIr deterministic normaliser (services/asdair/skill)
// and produces intents in the AsdAIr command_request shape — it does NOT write shopping items directly,
// and it NEVER touches the general Brain (weekly-list data belongs in AsdAIr/Postgres, not the wiki).
//
// EXCLUDED BY CONSTRUCTION (BUILD-CONTRACT non-goals): the ONLY command this route can emit is
// `add_list_item` (add-to-draft-list) — never checkout, payment, or automatic substitution. Ambiguous
// lines are preserved as `needs_decision` intents (durable, awaiting a human) — never dropped, never
// guessed. Corrections flow through the SAME intent seam (a correction is a new durable intent).
import { resolvePayload } from './resolvePayload.mjs';
import listNormaliser from '../../asdair/skill/listNormaliser.js';

const { normaliseRawList } = listNormaliser;

// The route's hard allowlist. Anything outside this is a non-goal and cannot be produced.
export const ALLOWED_SHOPPER_COMMANDS = Object.freeze(['add_list_item']);
export const SHOPPER_CONTEXT = 'shopping';

// payload: see resolvePayload. opts: { requestedBy, listDate, transcribers?, sourceId }
// sourceId is REQUIRED and must be unique per inbound message (a Telegram message/update id, the
// voice/photo file ref, etc.) — the per-item idempotency keys are derived from it, so two DIFFERENT
// messages can never collide on shop-0/shop-1 (a real second message would otherwise be deduped away).
export async function shopperRoute(payload, opts = {}) {
  const requestedBy = opts.requestedBy || 'shopperbot:warwick';
  const listDate = opts.listDate || null; // a real caller supplies next-week's date; kept explicit, no clock here
  const sourceId = opts.sourceId ?? opts.keyPrefix; // keyPrefix kept as a back-compat alias
  if (!sourceId || typeof sourceId !== 'string') throw new Error('shopperRoute: opts.sourceId (unique per inbound message) is required — it scopes the idempotency keys so distinct messages never collide');
  const keyPrefix = `shop:${sourceId}`;
  const { rawText, provenance } = await resolvePayload(payload, opts.transcribers || {});
  const { items, needs_review: needsReview } = normaliseRawList(rawText);

  const intents = [];
  let n = 0;
  for (const it of items) {
    intents.push({
      command: 'add_list_item',
      args: { context: SHOPPER_CONTEXT, list_date: listDate, item_name: it.item_name, requested_qty: it.requested_qty, note: it.note ?? null, status: 'requested' },
      idempotency_key: `${keyPrefix}-${n++}`,
      requested_by: requestedBy,
    });
  }
  for (const nr of needsReview) {
    // Preserved DURABLY as a needs_decision item — never dropped, never guessed at.
    intents.push({
      command: 'add_list_item',
      args: { context: SHOPPER_CONTEXT, list_date: listDate, item_name: nr.raw, requested_qty: null, note: `needs review: ${nr.reason}`, status: 'needs_decision' },
      idempotency_key: `${keyPrefix}-${n++}`,
      requested_by: requestedBy,
    });
  }

  // Invariant guard: every emitted command is add-only (no checkout/payment/substitution can leak).
  for (const i of intents) {
    if (!ALLOWED_SHOPPER_COMMANDS.includes(i.command)) throw new Error(`shopperRoute produced a non-allowlisted command: ${i.command}`);
  }

  return { context: SHOPPER_CONTEXT, provenance, intents, itemCount: items.length, needsReviewCount: needsReview.length, targetsBrain: false, targetsAsdair: true };
}
