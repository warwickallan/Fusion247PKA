// Transcription stage — the governed worker-saga step that turns a durably-
// captured raw_object (image | voice) into text, then (for images) into the
// deterministic normalized shopping list.
//
// Source of truth: Deliverables/2026-07-18-asdair-gateway-convergence-contract.md
//   G3/B1  transcribe(raw_object) -> { items, confidence, needs_review }
//   D1     transcription is a GOVERNED WORKER-SAGA STAGE (durable capture first,
//          then OCR/STT runs as a governed step, so a failure retries via the
//          saga's existing bounded-retry -> dead-letter, in one evidence trail).
//
// INJECTED MODEL CALL (like the Tower review adapters): the constructor takes a
// `transcriber` fn. Tests pass a FAKE returning fixture OCR/STT text. The REAL
// transcriber (Claude-vision OCR for images, an STT engine for voice) + its
// credential + the byte-fetch from the private bucket are the ISOLATED REMAINDER
// — deliberately NOT built here, NOT wired into the live runtime.
//
// PURE of network/clock/secrets: this module never fetches bytes, never reads a
// clock, never touches a credential. It orchestrates: raw_object -> transcriber
// (injected) -> text -> normaliseRawList (the on-main deterministic parser).
//
// DEPENDENCY: normaliseRawList is imported from the on-main AsdAIr skill
// (services/asdair/skill/listNormaliser.js) — imported, NEVER reimplemented, and
// NEVER edited. It is a keyless, gate-free, pure deterministic function; importing
// it does NOT fold this integration into the AsdAIr core.

// listNormaliser is CommonJS ("type":"commonjs" in services/asdair/skill); this
// gateway is ESM. Default-import the module object, then destructure — the
// interop-safe form for a CJS module consumed from ESM.
import listNormaliser from '../../../asdair/skill/listNormaliser.js';

const { normaliseRawList } = listNormaliser;

/**
 * Reconstruct the channel-neutral raw_object descriptor from a DURABLE capture
 * record. The operational store persists `technical_source_type` + the
 * `raw_payload_ref` pointer (store/object_key/content_type/bytes); the mapping's
 * self-describing `raw_object` field is not persisted, so the transcription stage
 * rebuilds what the transcriber needs from what the store actually carries.
 *
 * `object_key` (e.g. "telegram:image:<file_unique_id>") encodes the stable file
 * reference the REAL transcriber will use to fetch bytes from the private bucket.
 *
 * @param {object} record  a store record with technical_source_type + raw_payload_ref.
 * @returns {{ technical_source_type:'image'|'voice', store:(string|null),
 *   object_key:(string|null), content_type:(string|null), bytes:(number|null),
 *   sha256:(string|null), fetched:false }}
 */
export function deriveRawObject(record) {
  if (!record || typeof record !== 'object') {
    throw new Error('deriveRawObject: record required');
  }
  const tst = record.technical_source_type;
  if (tst !== 'image' && tst !== 'voice') {
    throw new Error(`deriveRawObject: unsupported technical_source_type "${tst}" (image|voice only)`);
  }
  const ref = (record.raw_payload_ref && typeof record.raw_payload_ref === 'object')
    ? record.raw_payload_ref
    : {};
  return {
    technical_source_type: tst,
    store: ref.store ?? null,
    object_key: ref.object_key ?? null,
    content_type: ref.content_type ?? null,
    bytes: Number.isInteger(ref.bytes) ? ref.bytes : null,
    sha256: ref.sha256 ?? null,
    // Bytes are NOT fetched in this increment — the getFile -> bucket write is the
    // isolated remainder. The real transcriber flips this once bytes are present.
    fetched: false,
  };
}

// Normalise whatever the injected transcriber returned into { text, confidence }.
// Accepts either a bare string (text) or an object { text, confidence }, so a
// simple fake and a richer model adapter both satisfy the contract.
function coerceTranscriberResult(out) {
  if (typeof out === 'string') return { text: out, confidence: null };
  if (out && typeof out === 'object') {
    const text = typeof out.text === 'string' ? out.text : '';
    const confidence = (typeof out.confidence === 'number' && Number.isFinite(out.confidence))
      ? out.confidence
      : null;
    return { text, confidence };
  }
  return { text: '', confidence: null };
}

/**
 * Create the transcription stage.
 *
 * @param {object} deps
 * @param {(rawObject:object) => (string|{text:string,confidence?:number}|Promise<...>)} deps.transcriber
 *        INJECTED model call. Receives the raw_object descriptor (which carries
 *        technical_source_type so one fn can serve both image OCR and voice STT)
 *        and returns the transcribed text (optionally with a confidence). In
 *        production this fetches the bytes and calls Claude-vision / an STT engine
 *        — the isolated remainder. In tests it is a FAKE returning fixture text.
 * @returns {{ transcribe:Function, transcribeVoice:Function }}
 */
export function createTranscriptionStage({ transcriber } = {}) {
  if (typeof transcriber !== 'function') {
    throw new Error('createTranscriptionStage: an injected `transcriber` fn is required (model call)');
  }

  return {
    /**
     * IMAGE path (OCR). Calls the injected transcriber for the OCR text, then
     * feeds that text through the on-main deterministic normaliser to produce the
     * structured shopping list. Satisfies B1: -> { items, confidence, needs_review }
     * (plus the raw `text` for evidence/audit).
     *
     * @param {object} rawObject  a deriveRawObject() descriptor, technical_source_type 'image'.
     * @returns {Promise<{ kind:'image', text:string, confidence:(number|null),
     *   items:Array, needs_review:Array }>}
     */
    async transcribe(rawObject) {
      if (!rawObject || rawObject.technical_source_type !== 'image') {
        throw new Error("transcriptionStage.transcribe: raw_object with technical_source_type 'image' required");
      }
      const { text, confidence } = coerceTranscriberResult(await transcriber(rawObject));
      // Wire OCR text -> normaliseRawList (the real on-main module).
      const { items, needs_review } = normaliseRawList(text);
      return { kind: 'image', text, confidence, items, needs_review };
    },

    /**
     * VOICE path (STT). Calls the injected transcriber for the transcript text.
     * Voice transcripts route to the standard Team Inbox/captures/ markdown write
     * path (they are not shopping lists), so this returns just the text + a
     * confidence — no normaliser step.
     *
     * @param {object} rawObject  a deriveRawObject() descriptor, technical_source_type 'voice'.
     * @returns {Promise<{ kind:'voice', text:string, confidence:(number|null) }>}
     */
    async transcribeVoice(rawObject) {
      if (!rawObject || rawObject.technical_source_type !== 'voice') {
        throw new Error("transcriptionStage.transcribeVoice: raw_object with technical_source_type 'voice' required");
      }
      const { text, confidence } = coerceTranscriberResult(await transcriber(rawObject));
      return { kind: 'voice', text, confidence };
    },
  };
}
