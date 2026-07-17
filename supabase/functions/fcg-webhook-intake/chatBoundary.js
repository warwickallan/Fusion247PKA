// BUILD-002 WP1 — the ONE private-direct-chat predicate.
//
// SHARED, SINGLE SOURCE (GPT-BUILD-002-WP1-REVIEW-0001, correction 3): imported
// by BOTH transports so the poll path and the webhook path CANNOT DRIFT —
//   * webhook: ./chatBoundary.js  (handler.js, same dir — bundles with the edge)
//   * poll:    ../../../../supabase/functions/fcg-webhook-intake/chatBoundary.js
//              (src/adapters/telegramMapping.js reaches this same physical file)
// It lives in the edge function directory so the deployed bundle stays
// self-contained (same rationale as derive.js); the Node poll path imports the
// exact same file rather than a copy, so there is literally nothing to drift.
//
// PURE + PORTABLE: no I/O, no crypto, no wall-clock — plain data predicate that
// Node and Deno execute identically.
//
// WHY: this BUILD is authorised for Warwick's PRIVATE DIRECT bot conversation
// ONLY — never groups, supergroups, or channels. A Telegram private chat ALWAYS
// carries `chat.type === 'private'` and `chat.id === the user's own id`, so a
// message/callback from the authorised user in their own DM has
// `chat.id === from.id`. This predicate enforces exactly that shape.
//
// SCOPE OF THIS PREDICATE — chat CONTEXT only, not sender authority. "Is this the
// ONE allowlisted user?" is a SEPARATE authority, enforced independently:
//   * poll path — inline in telegramMapping.js (senderId === authorisedUserId);
//   * webhook   — inside the fcg_webhook_* SECURITY DEFINER RPCs (DB allowlist).
// Composed, predicate (private direct chat matching its sender) + allowlist
// (the sender is the authorised user) guarantee the ONLY accepted context is the
// authorised user's own private direct chat. Keeping the two concerns separate
// means the webhook needs NO copy of the allowlist id (single source stays the
// DB) and a stranger in their OWN private chat still reaches — and is refused by
// — the RPC allowlist (preserving the layer-2 default-deny proof).

/**
 * True ONLY for a private direct chat whose id matches the message sender.
 * Rejects group / supergroup / channel / missing / malformed chat context.
 *
 * @param {{ chat?: unknown, senderId?: string|number }} args
 * @returns {boolean}
 */
export function isPrivateDirectChat({ chat, senderId } = {}) {
  if (!chat || typeof chat !== 'object') return false;          // missing/malformed
  // Only 'private' passes; 'group' | 'supergroup' | 'channel' | anything else out.
  if (/** @type {any} */ (chat).type !== 'private') return false;
  const chatId = /** @type {any} */ (chat).id;
  if (chatId === undefined || chatId === null) return false;
  if (senderId === undefined || senderId === null || senderId === '') return false;
  // A genuine 1:1 DM: chat.id === the user's own id. Guards the card_ref key
  // space too — with a single enforced chat, message_id cannot collide across
  // chats.
  return String(chatId) === String(senderId);
}
