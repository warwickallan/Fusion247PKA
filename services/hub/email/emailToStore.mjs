// BUILD-002 WP6 — connect emailIntake to the durable hub store (not just a mapper).
//
// emailIntake maps an email to a hub envelope; this records it DURABLY in the operational store (the
// same store the gateway spine uses), so an email becomes a real capture the worker can process — with
// idempotent dedup on the message id and the router's decision carried through. An empty/uncertain
// email is held for clarification rather than recorded as actionable.
import { createHash } from 'node:crypto';
import { emailIntake } from './emailIntake.mjs';

// Deterministic capture_id from the RFC message id, so a re-delivery maps to the SAME capture.
function captureIdFor(messageId) {
  return 'cap-email-' + createHash('sha256').update(String(messageId)).digest('hex').slice(0, 24);
}

// email: see emailIntake. store: an OperationalStore (recordIntake). Returns { record, isNew, route }.
export function emailToStore(email, store, { now } = {}) {
  if (!store || typeof store.recordIntake !== 'function') throw new Error('emailToStore: an OperationalStore is required');
  if (typeof now !== 'number') throw new Error('emailToStore: numeric now required');
  const { envelope, route, reason } = emailIntake(email);
  if (route === 'needs_clarification') {
    return { record: null, isNew: false, route, reason }; // not recorded as actionable — held for clarification
  }
  const capture_id = captureIdFor(envelope.message_id);
  const { record, isNew } = store.recordIntake({ ...envelope, capture_id, source_channel: 'email', technical_source_type: 'email', recorded_intent: route }, { now });
  return { record, isNew, route };
}
