// BUILD-002 WP1 — portable (Deno + Node) derivation of the idempotency key and
// capture_id for the webhook intake path.
//
// THIS IS A BYTE-PARITY PORT. The Node originals are:
//   services/fusion-capture-gateway/src/core/idempotency.js
//     (normalisePayload string branch + buildIdempotencyKey)
//   services/fusion-capture-gateway/src/adapters/telegramMapping.js
//     (deriveCaptureId + the `chat:<sender>:msg:<message_id>` native-id shape)
//
// The parity IS the cross-transport dedup guarantee: the same logical Telegram
// message must produce the SAME idempotency_key (and therefore the SAME
// capture_id) whether it arrives via the WP0 long-poll runner (Node) or the WP1
// edge webhook (Deno). Golden-vector tests
// (services/fusion-capture-gateway/test/idempotencyParity.test.js) assert both
// implementations against pinned expected values — any drift fails CI.
//
// PORTABILITY: uses ONLY WebCrypto (crypto.subtle) + TextEncoder, available in
// both Node >= 19 (globalThis.crypto) and Deno / Supabase Edge Runtime. The
// hash API is async, so these exports are async where the Node originals are
// sync — the OUTPUT BYTES are identical.
//
// No secrets, no I/O, no logging, no wall-clock.

const encoder = new TextEncoder();

/** SHA-256 of a UTF-8 string, lowercase hex. Parity with sha256Hex (Node). */
export async function sha256Hex(input) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Normalise a text payload before digesting — the STRING branch of the Node
 * normalisePayload, byte-identical: Unicode NFC, collapse internal whitespace
 * runs to a single space, trim. (The webhook path is text-only in WP1; the
 * object/bytes branches are deliberately not ported.)
 */
export function normaliseTextPayload(text) {
  if (text === null || text === undefined) return '';
  return String(text).normalize('NFC').replace(/\s+/g, ' ').trim();
}

/**
 * Build the deterministic idempotency key. Parity with buildIdempotencyKey:
 *   <source_channel>:<channel_native_message_id>:sha256:<digest>
 */
export async function buildIdempotencyKey({ source_channel, channel_native_message_id, raw_payload } = {}) {
  if (typeof source_channel !== 'string' || source_channel.length === 0) {
    throw new Error('buildIdempotencyKey: source_channel required');
  }
  if (typeof channel_native_message_id !== 'string' || channel_native_message_id.length === 0) {
    throw new Error('buildIdempotencyKey: channel_native_message_id required');
  }
  const digest = await sha256Hex(normaliseTextPayload(raw_payload));
  return `${source_channel}:${channel_native_message_id}:sha256:${digest}`;
}

/**
 * Derive the deterministic RFC-4122 v5-style capture UUID from the idempotency
 * key. Parity with telegramMapping.deriveCaptureId: sha256(key) first 32 hex
 * chars, version nibble forced to 5, variant nibble to RFC-4122.
 */
export async function deriveCaptureId(idempotencyKey) {
  const hex = (await sha256Hex(idempotencyKey)).slice(0, 32).split('');
  hex[12] = '5'; // version nibble → 5 (name-based / deterministic)
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16); // RFC-4122 variant
  const s = hex.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

/**
 * The Telegram channel-native message id — MUST match telegramMapping's
 * `chat:${senderId}:msg:${messageId}` exactly (sender id, NOT chat id, per the
 * WP0 private-chat convention the poll path established).
 */
export function channelNativeMessageId(senderId, messageId) {
  return `chat:${senderId}:msg:${messageId}`;
}

/**
 * One-call convenience: derive { idempotencyKey, captureId } for a Telegram
 * text message, exactly as the WP0 poll path does.
 */
export async function deriveTelegramTextKeys({ senderId, messageId, text }) {
  const idempotencyKey = await buildIdempotencyKey({
    source_channel: 'telegram',
    channel_native_message_id: channelNativeMessageId(senderId, messageId),
    raw_payload: text,
  });
  const captureId = await deriveCaptureId(idempotencyKey);
  return { idempotencyKey, captureId };
}
