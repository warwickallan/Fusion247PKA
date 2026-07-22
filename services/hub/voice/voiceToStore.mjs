// BUILD-002 WP6 — connect voiceIntake to the durable hub store (parity with emailToStore).
//
// A voice memo becomes a DURABLE capture in the operational store: transcribe (injected adapter) ->
// route -> record. A CLEAR intent is recorded (accepted). An AMBIGUOUS intent is ALSO recorded
// durably — held awaiting decision — and its correlated decision card is filed into the existing
// decision seam (injected fileDecisionCard, e.g. the cockpit decision_card writer live; a fixture in
// tests). The ambiguous path NEVER returns record:null and never drops the memo (TQA-005 fix).
// Idempotent on the voice ref (capture) and on the card's own idempotency key (card).
import { createHash } from 'node:crypto';
import { voiceIntake } from './voiceIntake.mjs';

function captureIdFor(voiceRef) {
  return 'cap-voice-' + createHash('sha256').update(String(voiceRef)).digest('hex').slice(0, 24);
}

// voice: see voiceIntake. deps: { transcribe, fileDecisionCard }. store: OperationalStore.
// fileDecisionCard(cardIntent, { now }) -> { card_id, isNew } — durably persists the correlated card,
// idempotent on cardIntent.idempotency_key (a re-delivery returns the SAME card, no duplicate).
// Returns { record, isNew, route, held?, capture_id?, card_id?, card? }.
export async function voiceToStore(voice, deps, store, { now } = {}) {
  if (!store || typeof store.recordIntake !== 'function') throw new Error('voiceToStore: an OperationalStore is required');
  if (typeof now !== 'number') throw new Error('voiceToStore: numeric now required');
  const res = await voiceIntake(voice, deps);

  if (res.route === 'needs_decision') {
    // FAIL CLOSED: an ambiguous memo must never be silently dropped — the durable card writer is required.
    if (typeof deps?.fileDecisionCard !== 'function') {
      throw new Error('voiceToStore: deps.fileDecisionCard is required to durably hold an ambiguous voice memo (fail closed — never drop it)');
    }
    const capture_id = captureIdFor(res.envelope.voice_ref);
    // 1) Persist the CAPTURE durably — content, channel + provenance retained; truthful held state.
    const { record, isNew } = await store.recordIntake({
      ...res.envelope, capture_id,
      text_preview: res.envelope.transcript,      // original content retained
      technical_source_type: 'voice',
      recorded_intent: 'needs_decision',          // truthful: held awaiting decision (not actionable yet)
    }, { now });
    // 2) Persist the CORRELATED decision card in the existing decision seam (idempotent on its own key).
    const filed = await deps.fileDecisionCard({ ...res.card.intent, capture_id }, { now });
    // 3) Return DURABLE identifiers — never record:null. `held` = truthfully awaiting a decision.
    return { record, isNew, route: 'needs_decision', held: true, capture_id, card_id: filed.card_id, card: res.card };
  }

  const capture_id = captureIdFor(res.envelope.voice_ref);
  // The store persists text_preview — land the transcript there so the content is durable.
  const { record, isNew } = await store.recordIntake({ ...res.envelope, capture_id, text_preview: res.envelope.transcript, technical_source_type: 'voice', recorded_intent: res.route }, { now });
  return { record, isNew, route: res.route };
}
