// Proofline — canonical serialisation and hashing.
//
// Everything in here is PURE: no I/O, no clock, no locale, no float.
// This module is the whole basis of G-4 (deterministic, structured result).
//
// Map D-7: no floats, no timestamps, no locale APIs may reach a canonical form.
// `'Z'.localeCompare('a') === 1` while code-unit compare gives `-1` — opposite
// orderings on a differently-configured machine, which is why `localeCompare`
// is banned here and in the processor.

import { createHash } from 'node:crypto';

/**
 * Code-unit comparison. NEVER `localeCompare`.
 * @returns {-1|0|1}
 */
export function cmp(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Canonical JSON: object keys sorted ascending by `cmp`, recursively; no
 * whitespace; array order preserved.
 *
 * Deliberately REFUSES anything that would make the bytes machine-dependent or
 * lossy: non-integer numbers, `undefined`, functions, symbols, BigInt. A float
 * reaching this function is a defect, and it throws rather than rounding.
 */
export function canonicalJson(value) {
  if (value === null) return 'null';

  const t = typeof value;

  if (t === 'boolean') return value ? 'true' : 'false';

  if (t === 'number') {
    if (!Number.isInteger(value)) {
      throw new TypeError(`canonicalJson: non-integer number is not canonicalisable: ${String(value)}`);
    }
    // -0 must not serialise differently from 0.
    return String(value === 0 ? 0 : value);
  }

  if (t === 'string') return JSON.stringify(value);

  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }

  if (t === 'object') {
    const keys = Object.keys(value).sort(cmp);
    const parts = [];
    for (const k of keys) {
      parts.push(`${JSON.stringify(k)}:${canonicalJson(value[k])}`);
    }
    return `{${parts.join(',')}}`;
  }

  throw new TypeError(`canonicalJson: ${t} is not canonicalisable`);
}

/** SHA-256 hex over a Buffer, or over the UTF-8 bytes of a string. */
export function sha256Hex(input) {
  const bytes = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * SHA-256 over the exact UTF-8 bytes of `text`.
 *
 * Map §5.1: the text is hashed EXACTLY as received — no Unicode normalisation,
 * no CRLF→LF, no trimming. The digest describes what arrived.
 */
export function sha256Utf8(text) {
  return sha256Hex(Buffer.from(text, 'utf8'));
}

/** Byte length of `text` as UTF-8 — the unit `textLength` is reported in. */
export function utf8ByteLength(text) {
  return Buffer.byteLength(text, 'utf8');
}
