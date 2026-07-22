// BUILD-002 WP6 — connect voiceIntake to the durable hub store (parity with emailToStore).
//
// A voice memo becomes a DURABLE capture in the operational store: transcribe (injected adapter) ->
// route -> record. A clear intent is recorded (accepted); an AMBIGUOUS intent is NOT recorded as
// actionable — it returns the ready-to-file decision_card intent so the A/B/C seam resolves it first,
// exactly as designed. Idempotent on the voice ref.
import { createHash } from 'node:crypto';
import { voiceIntake } from './voiceIntake.mjs';

function captureIdFor(voiceRef) {
  return 'cap-voice-' + createHash('sha256').update(String(voiceRef)).digest('hex').slice(0, 24);
}

// voice: see voiceIntake. deps: { transcribe }. store: OperationalStore. Returns { record, isNew, route, card? }.
export async function voiceToStore(voice, deps, store, { now } = {}) {
  if (!store || typeof store.recordIntake !== 'function') throw new Error('voiceToStore: an OperationalStore is required');
  if (typeof now !== 'number') throw new Error('voiceToStore: numeric now required');
  const res = await voiceIntake(voice, deps);
  if (res.route === 'needs_decision') {
    // Not recorded as actionable yet — the ambiguity is resolved through the decision seam first.
    return { record: null, isNew: false, route: res.route, card: res.card };
  }
  const capture_id = captureIdFor(res.envelope.voice_ref);
  // The store persists text_preview — land the transcript there so the content is durable.
  const { record, isNew } = await store.recordIntake({ ...res.envelope, capture_id, text_preview: res.envelope.transcript, technical_source_type: 'voice', recorded_intent: res.route }, { now });
  return { record, isNew, route: res.route };
}
