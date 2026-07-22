// BUILD-002 WP6 — voice intake (fixture-first).
//
// A voice memo is preserved + transcribed (the transcriber is INJECTED — a fixture supplies the text
// in tests; the live wiring would pass a real transcriber; no API key is embedded, per D-cairn). A
// CLEAR intent routes through the same router as every channel. An AMBIGUOUS intent is resolved through
// the A/B/C decision seam (WP4): it yields a ready-to-file decision_card (rendered) rather than guessing.
// Durable correlation: the envelope carries a voice-ref-derived idempotency key.
import { routeFor } from '../router/classifyRoute.mjs';
import { renderCard } from '../decision/renderCard.mjs';

// voice: { voice_ref, duration_sec?, source? }
// deps:  { transcribe(voice_ref) -> Promise<{ text, ambiguous?, interpretations?:[{key,label}] }> }
export async function voiceIntake(voice, deps = {}) {
  if (!voice || typeof voice !== 'object' || !voice.voice_ref) throw new Error('voiceIntake: voice.voice_ref required');
  if (typeof deps.transcribe !== 'function') throw new Error('voiceIntake: an injected transcribe(voice_ref) is required (none provided) — fail closed');
  const t = await deps.transcribe(voice.voice_ref);
  if (!t || typeof t.text !== 'string' || !t.text.trim()) throw new Error('voiceIntake: transcription produced no text');

  const envelope = {
    source_channel: 'voice',
    voice_ref: voice.voice_ref,
    transcript: t.text,
    duration_sec: voice.duration_sec ?? null,
    original_source_ref: { channel: 'voice', voice_ref: voice.voice_ref, source: voice.source ?? null },
    idempotency_key: `voice:${voice.voice_ref}`,
    payload_text: t.text,
  };

  // Ambiguous intent → resolve through the A/B/C decision seam, never a guess.
  if (t.ambiguous) {
    const interpretations = Array.isArray(t.interpretations) && t.interpretations.length >= 1
      ? t.interpretations
      : [{ key: 'A', label: 'Save as a note' }, { key: 'B', label: 'Discard' }];
    const rendered = renderCard({ subject: 'What did you want to do with this voice memo?', body_markdown: t.text, options: interpretations, related_ref: `voice:${voice.voice_ref}` });
    const cardIntent = { requested_by: 'voice:warwick', target: 'devbot:warwick', subject: 'What did you want to do with this voice memo?', body_markdown: t.text, options: interpretations, related_ref: `voice:${voice.voice_ref}` };
    return { envelope, route: 'needs_decision', card: { rendered, intent: cardIntent } };
  }

  const { route, youtube } = routeFor(envelope);
  return { envelope, route, youtube };
}
