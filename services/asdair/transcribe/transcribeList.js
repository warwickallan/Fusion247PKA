// =====================================================================
// BUILD-015 AsdAIr Stage 1 - transcribe/transcribeList.js
//
// A photographed handwritten shopping list is the real front door. This
// module is the ONE-SHOT model call that turns that photo into a
// structured transcript. It is NOT a daemon, NOT a queue, NOT a
// scheduler and NOT a persistent agent: one call in, one transcript out,
// process exits.
//
// It routes through the provider-neutral, role-based gateway at
// services/obsidiwikai/src/core/models.mjs (`vision` role). It does not
// know or care which provider is behind it, and it holds no client of
// its own.
//
// THE CENTRAL RULE
//   An unreadable or ambiguous quantity is NEVER guessed as a fact. It
//   comes back `requested_qty: null, uncertain: true` with a reason, and
//   that line goes to the human question loop. Guessing "probably 2" on
//   somebody's shopping list is the exact failure this module exists to
//   prevent.
//
// DOWNSTREAM STAYS DETERMINISTIC
//   The transcript is the ONLY probabilistic step. `skill/listNormaliser.js`
//   (pure, deterministic) and the planner behind it are unchanged and
//   consume ordinary list text - see `certainLinesText()` below.
//
// NO DATABASE. NO CREDENTIAL IS READ, LOGGED OR RETURNED HERE. Config is
// by env var NAME only (FUSION_GATEWAY_URL / FUSION_MODEL_VISION), whose
// values this module never inspects.
//
// PURE ASCII only.
// =====================================================================

import { statSync, readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { extractJson } from '../../obsidiwikai/src/core/llm.mjs';

// ---------------------------------------------------------------------
// Image handling
// ---------------------------------------------------------------------

// Only formats a mainstream vision endpoint actually accepts. An unknown
// extension is refused loudly rather than sent and silently mis-decoded.
export const SUPPORTED_IMAGE_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

// A household photo above this is far likelier a mistake (a video frame dump,
// a wrong file) than a shopping list, and every byte of it would be uploaded.
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

// Validate the image reference WITHOUT reading its bytes. This is everything
// --dry-run checks, and it runs before any model call in the live path too.
export function validateImageRef(imagePath, { statImpl = statSync } = {}) {
  if (typeof imagePath !== 'string' || imagePath.trim() === '') {
    throw new Error('transcribe: --image <path> is required');
  }
  const abs = resolve(imagePath);
  const ext = extname(abs).toLowerCase();
  const mime = Object.prototype.hasOwnProperty.call(SUPPORTED_IMAGE_TYPES, ext)
    ? SUPPORTED_IMAGE_TYPES[ext]
    : null;
  if (!mime) {
    throw new Error(
      'transcribe: unsupported image type "' + (ext || '(none)') + '". Supported: ' +
      Object.keys(SUPPORTED_IMAGE_TYPES).join(', ')
    );
  }
  let st;
  try {
    st = statImpl(abs);
  } catch {
    throw new Error('transcribe: image not found: ' + abs);
  }
  if (!st.isFile()) throw new Error('transcribe: not a file: ' + abs);
  if (st.size === 0) throw new Error('transcribe: image is empty: ' + abs);
  if (st.size > MAX_IMAGE_BYTES) {
    throw new Error(
      'transcribe: image is ' + st.size + ' bytes, over the ' + MAX_IMAGE_BYTES +
      ' byte limit: ' + abs
    );
  }
  return { path: abs, mime, bytes: st.size };
}

// Turn a validated local image into a data: URL. Local read only - the file
// never leaves this process except as the body of the gateway call the caller
// explicitly configured.
export function readImageAsDataUrl(ref, { readImpl = readFileSync } = {}) {
  const buf = readImpl(ref.path);
  return 'data:' + ref.mime + ';base64,' + Buffer.from(buf).toString('base64');
}

// ---------------------------------------------------------------------
// Credential hygiene
//
// Nothing here reads process.env for a secret VALUE - that would itself be
// inspecting a credential. Instead this scrubs the shapes a secret takes if
// one ever arrives from outside (e.g. echoed back inside an upstream error
// body). Applied to every error message this module surfaces or the CLI prints.
// ---------------------------------------------------------------------
const SECRET_PATTERNS = [
  // Authorization header value
  { re: /\bBearer\s+[A-Za-z0-9._\-]{8,}/gi, to: '[REDACTED]' },
  // OpenAI-style key
  { re: /\bsk-[A-Za-z0-9._\-]{8,}/g, to: '[REDACTED]' },
  // user:pass@ in any URL - the scheme and host survive, they aid diagnosis
  { re: /\b([A-Za-z][A-Za-z0-9+.\-]*:\/\/)[^\s/@:]+:[^\s/@]+@/g, to: '$1[REDACTED]@' },
  // key/token/password assignments in prose or JSON
  { re: /\b(api[_-]?key|apikey|token|secret|password|passwd|pwd)\b"?\s*[:=]\s*"?[^\s"',}]{4,}"?/gi, to: '[REDACTED]' },
];

export function redactSecrets(text) {
  let s = text === null || text === undefined ? '' : String(text);
  for (const p of SECRET_PATTERNS) s = s.replace(p.re, p.to);
  return s;
}

// ---------------------------------------------------------------------
// The prompt
// ---------------------------------------------------------------------
export function buildPrompt() {
  return [
    'You are transcribing a photograph of a HANDWRITTEN household shopping list.',
    'Transcribe it. Do not interpret, shop, substitute, price or reorder anything.',
    '',
    'Return ONLY a JSON object with exactly this shape:',
    '{',
    '  "raw_transcript": "<the whole list verbatim, one item per line, newline separated>",',
    '  "lines": [',
    '    {',
    '      "raw": "<this line exactly as written, including any quantity>",',
    '      "item_name": "<just the item, no quantity>",',
    '      "requested_qty": <positive whole number, or null>,',
    '      "uncertain": <true|false>,',
    '      "uncertainty_reason": "<short reason, or null>"',
    '    }',
    '  ]',
    '}',
    '',
    'RULES - these matter more than completeness:',
    '1. NEVER guess a quantity. If a number is smudged, ambiguous, crossed out,',
    '   written as a word you cannot read, or simply absent-but-implied, set',
    '   "requested_qty": null, "uncertain": true and give the reason. A wrong',
    '   quantity is far worse than an unanswered one - a human will be asked.',
    '2. If a line has no quantity written at all, that is NOT uncertain: set',
    '   "requested_qty": null and "uncertain": false, and let the deterministic',
    '   normaliser downstream apply its own default.',
    '3. If you cannot read the ITEM itself, still emit the line with your best',
    '   "raw", set "uncertain": true and say why. Never drop a line.',
    '4. Never invent an item that is not on the paper.',
    '5. Preserve the order the lines appear in.',
    '',
    'No prose, no markdown, no code fences. JSON only.',
  ].join('\n');
}

// ---------------------------------------------------------------------
// Model call + JSON recovery
//
// Reuses `extractJson` from services/obsidiwikai/src/core/llm.mjs - the same
// tested fence-stripping / trailing-junk parser `generateJSON()` uses - and
// applies the same retry-with-stricter-suffix policy. It cannot call
// `generateJSON()` itself because that function is hard-wired to the `reason`
// (text) role; routing an image task through it would send a blind text model
// a prompt about a photo it cannot see. Same parse behaviour, correct role.
// ---------------------------------------------------------------------

// The minimum shape a response must have before we accept it. A structurally
// wrong reply is treated exactly like unparseable JSON: retried, not crashed on.
export function isPlausibleTranscript(parsed) {
  return !!parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Array.isArray(parsed.lines);
}

export async function generateVisionJSON(visionFn, prompt, imageUrl, { retries = 2 } = {}) {
  let last = '';
  let attempts = 0;
  for (let i = 0; i <= retries; i++) {
    attempts++;
    const suffix = i > 0 ? '\n\nReturn ONLY valid JSON. No prose, no markdown, no code fences.' : '';
    const out = await visionFn(prompt + suffix, imageUrl);
    const text = typeof out === 'string' ? out : (out && out.text) || '';
    const provenance = (out && typeof out === 'object' && out.provenance) || null;
    const parsed = extractJson(text);
    if (isPlausibleTranscript(parsed)) return { parsed, provenance, attempts };
    last = text;
  }
  throw new Error(
    'transcribe: model did not return a usable transcript after ' + attempts +
    ' attempts: ' + redactSecrets(String(last)).slice(0, 200)
  );
}

// ---------------------------------------------------------------------
// Defensive normalisation of the model's answer
// ---------------------------------------------------------------------

// Household lists never legitimately ask for more than this; matches the
// deterministic normaliser's own MAX_QTY so the two agree about implausibility.
const MAX_QTY = 999;

function asCleanString(v) {
  if (typeof v !== 'string') return '';
  return v.trim().replace(/\s+/g, ' ');
}

// A quantity is only a FACT when it is unambiguously a positive whole number.
// Anything else - a word, "?", a decimal, zero, a negative, an absurd value -
// is not read as a quantity; it becomes null + uncertain with a reason.
export function coerceQty(v) {
  if (v === null || v === undefined) return { qty: null, reason: null };
  let n = null;
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string' && /^\d+$/.test(v.trim())) n = parseInt(v.trim(), 10);
  else return { qty: null, reason: 'unreadable quantity: ' + JSON.stringify(v).slice(0, 40) };
  if (!Number.isSafeInteger(n)) return { qty: null, reason: 'quantity is not a whole number: ' + String(v).slice(0, 20) };
  if (n < 1) return { qty: null, reason: 'non-positive quantity: ' + n };
  if (n > MAX_QTY) return { qty: null, reason: 'implausible quantity: ' + n };
  return { qty: n, reason: null };
}

export function normaliseLine(rawLine) {
  const src = rawLine && typeof rawLine === 'object' ? rawLine : {};
  const raw = asCleanString(src.raw);
  const item_name = asCleanString(src.item_name).toLowerCase();

  let uncertain = src.uncertain === true;
  let uncertainty_reason = uncertain ? (asCleanString(src.uncertainty_reason) || 'model flagged this line as uncertain') : null;

  const flag = (reason) => {
    if (!uncertain) { uncertain = true; uncertainty_reason = reason; }
  };

  // A quantity the model could not read is the whole point: never a fact.
  const { qty, reason } = coerceQty(src.requested_qty);
  if (reason) flag(reason);
  // If the model already declared the line uncertain, its quantity is not a
  // fact either, whatever value it put there.
  const requested_qty = uncertain ? null : qty;

  if (raw === '') flag('no raw text transcribed for this line');
  if (item_name === '') flag('no item text transcribed for this line');

  return {
    raw,
    item_name,
    requested_qty,
    uncertain,
    uncertainty_reason: uncertain ? uncertainty_reason : null,
  };
}

export function buildTranscript(parsed, provenance) {
  const lines = parsed.lines.map(normaliseLine);
  const modelTranscript = typeof parsed.raw_transcript === 'string' ? parsed.raw_transcript.trim() : '';
  // Prefer the model's verbatim block; fall back to the per-line raws so
  // raw_transcript is never empty when there are lines.
  const raw_transcript = modelTranscript !== ''
    ? modelTranscript
    : lines.map((l) => l.raw).filter((r) => r !== '').join('\n');

  return {
    lines,
    raw_transcript,
    needs_review: lines.some((l) => l.uncertain),
    provenance: {
      provider: asCleanString(provenance && provenance.provider) || 'unknown',
      model: asCleanString(provenance && provenance.model) || 'unknown',
    },
  };
}

// ---------------------------------------------------------------------
// The handoff to the deterministic half.
//
// `skill/listNormaliser.js` takes plain list TEXT. The certain lines' `raw`
// values, newline joined, ARE that text - so:
//     normaliseRawList(certainLinesText(transcript))
// works against the normaliser unmodified. Uncertain lines are deliberately
// held back: they belong to the human question loop first, and only rejoin
// the list once a person has answered.
// ---------------------------------------------------------------------
export function certainLinesText(transcript) {
  return transcript.lines
    .filter((l) => !l.uncertain && l.raw !== '')
    .map((l) => l.raw)
    .join('\n');
}

// ---------------------------------------------------------------------
// The default model layer: the `vision` role on the Fusion gateway.
//
// Imported lazily so this module can be loaded, and fully tested, without
// touching the gateway config at all.
// ---------------------------------------------------------------------
export async function gatewayVision(prompt, imageUrl) {
  const { vision, ROLE_ALIAS } = await import('../../obsidiwikai/src/core/models.mjs');
  const text = await vision(prompt, imageUrl);
  // The alias is a ROLE NAME resolved by the gateway ("fusion.vision"), not a
  // credential. No key, URL or header ever enters provenance.
  return { text, provenance: { provider: 'fusion-gateway', model: ROLE_ALIAS.vision } };
}

// ---------------------------------------------------------------------
// Public entry point. ONE SHOT.
//
//   transcribeList('list.jpg')                      -> live, via the gateway
//   transcribeList('list.jpg', { visionFn: fake })  -> offline, for tests
// ---------------------------------------------------------------------
export async function transcribeList(imagePath, {
  visionFn = gatewayVision,
  retries = 2,
  statImpl = statSync,
  readImpl = readFileSync,
  prompt = buildPrompt(),
} = {}) {
  const ref = validateImageRef(imagePath, { statImpl });
  const imageUrl = readImageAsDataUrl(ref, { readImpl });
  const { parsed, provenance } = await generateVisionJSON(visionFn, prompt, imageUrl, { retries });
  return buildTranscript(parsed, provenance);
}
