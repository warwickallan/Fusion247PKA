// BUILD-002 WP6 — connect emailIntake to the durable hub store (not just a mapper).
//
// emailIntake maps an email to a hub envelope; this records it DURABLY in the operational store (the
// same store the gateway spine uses), so an email becomes a real capture the worker can process — with
// idempotent dedup on the message id and the router's decision carried through. An empty/uncertain
// email is ALSO recorded durably — held awaiting clarification — and a clarification decision card is
// filed into the existing decision seam, so it is never dropped (TQA-005 fix; parity with voiceToStore).
import { createHash } from 'node:crypto';
import { emailIntake } from './emailIntake.mjs';
import { renderCard } from '../decision/renderCard.mjs';

// Deterministic capture_id from the RFC message id, so a re-delivery maps to the SAME capture.
function captureIdFor(messageId) {
  return 'cap-email-' + createHash('sha256').update(String(messageId)).digest('hex').slice(0, 24);
}

// email: see emailIntake. store: an OperationalStore (recordIntake).
// opts: { now, fileDecisionCard } — fileDecisionCard(cardIntent, { now }) -> { card_id, isNew } durably
// persists the correlated clarification card, idempotent on cardIntent.idempotency_key.
// Returns { record, isNew, route, held?, capture_id?, card_id?, card? }. ASYNC — callers MUST await.
export async function emailToStore(email, store, { now, fileDecisionCard } = {}) {
  if (!store || typeof store.recordIntake !== 'function') throw new Error('emailToStore: an OperationalStore is required');
  if (typeof now !== 'number') throw new Error('emailToStore: numeric now required');
  const { envelope, route, reason } = emailIntake(email);

  if (route === 'needs_clarification') {
    // FAIL CLOSED: an uncertain email must never be silently dropped — the durable card writer is required.
    if (typeof fileDecisionCard !== 'function') {
      throw new Error('emailToStore: opts.fileDecisionCard is required to durably hold an uncertain email (fail closed — never drop it)');
    }
    const capture_id = captureIdFor(envelope.message_id);
    // 1) Persist the CAPTURE durably — content, channel + provenance retained; truthful held state.
    const { record, isNew } = await store.recordIntake({
      ...envelope, capture_id,
      text_preview: envelope.payload_text,
      source_channel: 'email',
      technical_source_type: 'email',
      recorded_intent: 'needs_clarification',   // truthful: held awaiting clarification (not actionable yet)
    }, { now });
    // 2) Render + file a CLARIFICATION decision card so the held email is resolvable via the A/B/C seam.
    const options = [{ key: 'A', label: 'Clarify / resend with content' }, { key: 'B', label: 'Discard' }];
    const subject = `This email had no clear content — what did you want? (${reason})`;
    const rendered = renderCard({ subject, body_markdown: envelope.payload_text || '(empty email)', options, related_ref: `email:${envelope.message_id}` });
    const cardIntent = {
      requested_by: 'email:warwick', target: 'devbot:warwick', subject,
      body_markdown: envelope.payload_text || '(empty email)', options,
      related_ref: `email:${envelope.message_id}`,
      idempotency_key: `email-decision:${envelope.message_id}`, dry_run: true, capture_id,
    };
    const filed = await fileDecisionCard(cardIntent, { now });
    // 3) Return DURABLE identifiers — never record:null. `held` = truthfully awaiting clarification.
    return { record, isNew, route: 'needs_clarification', held: true, reason, capture_id, card_id: filed.card_id, card: { rendered, intent: cardIntent } };
  }

  const capture_id = captureIdFor(envelope.message_id);
  // The store persists text_preview — land the subject+body there so the content is durable.
  const { record, isNew } = await store.recordIntake({ ...envelope, capture_id, text_preview: envelope.payload_text, source_channel: 'email', technical_source_type: 'email', recorded_intent: route }, { now });
  return { record, isNew, route };
}
