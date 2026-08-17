// BUILD-006 Phase 1 — content-derived identity.
//
// THE RULE THIS FILE EXISTS TO ENFORCE: a seed's identity is a function of its content and
// of nothing else. Not a row id, not the wall clock, not the order things were inserted in,
// not a hostname, not a process-local counter, not anything held in memory between calls.
// Two unrelated processes on two different days, given the same source, must arrive at the
// same 64 hex characters — otherwise "the same source taken in twice yields one seed" is a
// property of luck rather than of design.
//
// The corollary, and it is the load-bearing half: the manifest that gets hashed is STORED
// alongside the seed. Anybody can recompute the identity from the row and check it. An
// identity nobody can independently recompute is an assertion, not an identity.

import crypto from 'node:crypto';

/**
 * Deterministic JSON. Object keys are emitted in sorted order, arrays keep their given
 * order, and there is no insignificant whitespace, so the same logical value always
 * serialises to the same bytes.
 *
 * Throws on anything whose serialisation would be ambiguous or lossy rather than quietly
 * dropping it — an identity computed over silently-discarded input is the worst kind of
 * stable, because it is stable and wrong.
 */
export function canonicalJson(value) {
  if (value === null) return 'null';

  const t = typeof value;

  if (t === 'boolean') return value ? 'true' : 'false';

  if (t === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(`canonicalJson: ${value} is not representable`);
    }
    // Integers only. A float's shortest round-trip representation is stable in modern
    // JS engines, but relying on that for a durable identity is a bet this store does
    // not need to take.
    if (!Number.isInteger(value)) {
      throw new TypeError(`canonicalJson: non-integer number ${value} is not permitted in a manifest`);
    }
    return String(value);
  }

  if (t === 'string') return JSON.stringify(value);

  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }

  if (t === 'object') {
    const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }

  throw new TypeError(`canonicalJson: unsupported type ${t}`);
}

/** sha256, lowercase hex. Accepts a Buffer or a string (hashed as UTF-8). */
export function sha256Hex(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * NORMALISE IN, HASH WHAT YOU STORE, NEVER NORMALISE OUT.
 *
 * Supplied text arrives through hands and clipboards, so its line endings and Unicode
 * composition vary for reasons that have nothing to do with what it says. It is normalised
 * ONCE, here, before it is stored — and the stored bytes are what get hashed. Retrieval
 * normalises nothing, which is what lets re-hashing a stored snapshot be a genuine
 * integrity check rather than a restatement of the same assumption.
 *
 * Bytes read from a file are never put through this: they are hashed and stored raw.
 */
export function normaliseSuppliedText(text) {
  return text
    .normalize('NFC')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

/**
 * Build the manifest that IS the seed's identity.
 *
 * `members` are sorted by source_ref, then by content hash, so the order in which sources
 * happened to be discovered cannot change the identity. Nothing time-varying is admitted.
 */
export function buildManifest({ route, angle = null, members }) {
  if (!Array.isArray(members) || members.length === 0) {
    throw new TypeError('buildManifest: a seed must have at least one member');
  }

  const sorted = members
    .map((m) => {
      if (!m || typeof m.source_ref !== 'string' || typeof m.content_sha256 !== 'string') {
        throw new TypeError('buildManifest: every member needs a source_ref and a content_sha256');
      }
      if (!/^[0-9a-f]{64}$/.test(m.content_sha256)) {
        throw new TypeError(`buildManifest: content_sha256 must be lowercase hex sha256 (got ${m.content_sha256})`);
      }
      return { source_ref: m.source_ref, content_sha256: m.content_sha256 };
    })
    .sort((a, b) => (
      a.source_ref < b.source_ref ? -1
        : a.source_ref > b.source_ref ? 1
          : a.content_sha256 < b.content_sha256 ? -1
            : a.content_sha256 > b.content_sha256 ? 1 : 0
    ));

  const seen = new Set();
  for (const m of sorted) {
    if (seen.has(m.source_ref)) {
      throw new TypeError(`buildManifest: duplicate source_ref ${m.source_ref}`);
    }
    seen.add(m.source_ref);
  }

  return {
    v: 1,
    route,
    // The angle is part of what the seed IS, for the two routes that require one. The same
    // words taken with a different question are honestly a different seed.
    angle: angle === null || angle === undefined ? null : normaliseSuppliedText(angle),
    members: sorted,
  };
}

/** The seed's identity: sha256 over the canonical manifest. */
export function seedIdentity(manifest) {
  return sha256Hex(canonicalJson(manifest));
}

/**
 * The hash of the REQUEST rather than of the result.
 *
 * Same selector, same key — even when the underlying records have changed since and the
 * resulting seed_id is therefore different. RECORDED ONLY. Nothing in this phase reads it,
 * and no supersession, history-walking or reconciliation behaviour is built on it; it
 * exists so that a later phase which needs versioning is not forced to guess retroactively
 * which seeds were re-takes of the same selection.
 */
export function selectionKey({ route, selector, angle = null }) {
  return sha256Hex(canonicalJson({
    v: 1,
    route,
    selector: selector ?? null,
    angle: angle === null || angle === undefined ? null : normaliseSuppliedText(angle),
  }));
}

/**
 * A deterministic label for one intake ATTEMPT, used only by the append-only run ledger.
 * Distinct from the identity: two attempts at the same seed are two ledger rows and one
 * seed row.
 */
export function attemptKey({ seedId, startedAtIso, pid }) {
  return sha256Hex(canonicalJson({ v: 1, seed_id: seedId, started_at: startedAtIso, pid }));
}
