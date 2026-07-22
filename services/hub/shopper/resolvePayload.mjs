// BUILD-002 WP5 — Shopper payload resolver (the parked "B half" front door).
//
// A ShopperBot message can be typed, a photo of a list, or a voice memo. This is the ONE place that
// turns any of those into raw list text, before the deterministic normaliser runs. The photo/voice
// transcribers are INJECTED — a fixture supplies the transcript in tests, and the live wiring would
// pass Claude vision / a transcriber. NO API key is embedded here (D-cairn: no autonomous paid runtime);
// a payload that needs a transcriber which was not provided FAILS CLOSED rather than guessing.
//
// payload: { kind: 'text'|'photo'|'voice', text?, imageRef?, voiceRef? }
// deps:    { transcribeImage?(imageRef)->Promise<string>, transcribeVoice?(voiceRef)->Promise<string> }
export async function resolvePayload(payload, deps = {}) {
  if (!payload || typeof payload !== 'object') throw new Error('resolvePayload: payload object required');
  switch (payload.kind) {
    case 'text': {
      if (typeof payload.text !== 'string' || !payload.text.trim()) throw new Error('resolvePayload: text payload requires non-empty text');
      return { rawText: payload.text, provenance: { kind: 'text' } };
    }
    case 'photo': {
      if (typeof deps.transcribeImage !== 'function') throw new Error('resolvePayload: photo payload needs an injected transcribeImage (none provided) — fail closed');
      const rawText = await deps.transcribeImage(payload.imageRef);
      if (typeof rawText !== 'string' || !rawText.trim()) throw new Error('resolvePayload: image transcription produced no text');
      return { rawText, provenance: { kind: 'photo', source: payload.imageRef ?? null } };
    }
    case 'voice': {
      if (typeof deps.transcribeVoice !== 'function') throw new Error('resolvePayload: voice payload needs an injected transcribeVoice (none provided) — fail closed');
      const rawText = await deps.transcribeVoice(payload.voiceRef);
      if (typeof rawText !== 'string' || !rawText.trim()) throw new Error('resolvePayload: voice transcription produced no text');
      return { rawText, provenance: { kind: 'voice', source: payload.voiceRef ?? null } };
    }
    default:
      throw new Error(`resolvePayload: unsupported payload kind "${payload && payload.kind}"`);
  }
}
