// BUILD-006 Phase 1 — capturing a source into an immutable snapshot.
//
// The build's critical reliability rule, carried in from the map: accepted source content
// is snapshotted with timestamps, provenance and integrity metadata, and a later source
// failure cannot erase or reinterpret an existing run. Everything in this file serves that
// one sentence.
//
// THE INVARIANT: content_sha256 is the hash of exactly the bytes that get stored. Not of
// the file on disk at some later moment, not of a normalised view produced on the way out.
// Whatever normalisation a route performs happens HERE, before storage. That is what makes
// re-hashing a stored snapshot an integrity check with teeth: if the two disagree, the
// stored row has been tampered with, and no amount of re-reading the original can hide it.

import fs from 'node:fs';
import path from 'node:path';
import { normaliseSuppliedText, sha256Hex } from './identity.mjs';

const MEDIA_TYPES = new Map([
  ['.md', 'text/markdown'],
  ['.markdown', 'text/markdown'],
  ['.txt', 'text/plain'],
  ['.json', 'application/json'],
  ['.yaml', 'application/yaml'],
  ['.yml', 'application/yaml'],
  ['.sql', 'application/sql'],
  ['.mjs', 'text/javascript'],
  ['.js', 'text/javascript'],
]);

export function mediaTypeForPath(p) {
  return MEDIA_TYPES.get(path.extname(p).toLowerCase()) ?? 'application/octet-stream';
}

/** Repo-relative, forward-slashed, so a snapshot taken on Windows and one taken on Linux agree. */
export function repoRelative(repoRoot, absPath) {
  return path.relative(repoRoot, absPath).split(path.sep).join('/');
}

const PRIVACY_STATES = new Set(['unclassified', 'public', 'internal', 'private', 'restricted']);

function checkPrivacy(privacyState) {
  if (!PRIVACY_STATES.has(privacyState)) {
    throw new TypeError(
      `snapshot: privacy_state must be one of ${[...PRIVACY_STATES].join(', ')} (got ${privacyState})`,
    );
  }
}

/**
 * Snapshot a file's RAW bytes. No normalisation whatsoever — a file is hashed and stored
 * exactly as it is on disk, so the hash is a statement about the file rather than about
 * this code's opinion of it.
 *
 * An artefact larger than the inline limit is REFUSED rather than truncated or stored by
 * reference. Phase 1 stores bytes; a content-addressed backing store is a later phase's
 * job, and the `content_url` column is there waiting for it. Silently keeping half of a
 * source would be the exact failure the reliability rule forbids.
 */
export function snapshotFile({ repoRoot, absPath, provenance, privacyState, maxInlineBytes }) {
  checkPrivacy(privacyState);
  const content = fs.readFileSync(absPath);
  if (content.byteLength > maxInlineBytes) {
    const err = new Error(
      `snapshot: ${repoRelative(repoRoot, absPath)} is ${content.byteLength} bytes, over the ` +
      `${maxInlineBytes}-byte inline limit. Phase 1 stores bytes and refuses to store a partial source.`,
    );
    err.code = 'EVLOGOPSOVERSIZE';
    throw err;
  }
  const rel = repoRelative(repoRoot, absPath);
  return {
    source_ref: `file:${rel}`,
    content_sha256: sha256Hex(content),
    byte_length: content.byteLength,
    media_type: mediaTypeForPath(absPath),
    content,
    content_url: null,
    privacy_state: privacyState,
    provenance: {
      source_system: 'repository',
      path: rel,
      captured_by: 'vlogops/1',
      ...provenance,
    },
  };
}

/**
 * Snapshot supplied or synthesised TEXT.
 *
 * Text arrives through hands, clipboards and subprocess pipes, so its line endings and
 * Unicode composition vary for reasons unrelated to what it says. It is normalised once,
 * here, and the NORMALISED bytes are what get both stored and hashed — the two can never
 * disagree, because they are the same bytes.
 */
export function snapshotText({ sourceRef, text, mediaType, provenance, privacyState, maxInlineBytes }) {
  checkPrivacy(privacyState);
  const normalised = normaliseSuppliedText(text);
  if (normalised === '') {
    const err = new Error(`snapshot: ${sourceRef} normalised to empty text; there is nothing to snapshot`);
    err.code = 'EVLOGOPSEMPTY';
    throw err;
  }
  const content = Buffer.from(normalised, 'utf8');
  if (content.byteLength > maxInlineBytes) {
    const err = new Error(
      `snapshot: ${sourceRef} is ${content.byteLength} bytes, over the ${maxInlineBytes}-byte inline limit`,
    );
    err.code = 'EVLOGOPSOVERSIZE';
    throw err;
  }
  return {
    source_ref: sourceRef,
    content_sha256: sha256Hex(content),
    byte_length: content.byteLength,
    media_type: mediaType ?? 'text/plain',
    content,
    content_url: null,
    privacy_state: privacyState,
    provenance: {
      captured_by: 'vlogops/1',
      ...provenance,
    },
  };
}

/**
 * Re-hash a stored snapshot and compare it with what the row claims.
 *
 * This reads ONLY the stored bytes. It never goes back to the original source — which is
 * the whole point: the check must still work, and still mean something, after the original
 * has been edited, corrupted or deleted.
 */
export function verifySnapshotIntegrity(row) {
  const stored = Buffer.isBuffer(row.content) ? row.content : Buffer.from(row.content);
  const actual = sha256Hex(stored);
  return {
    ok: actual === row.content_sha256 && stored.byteLength === Number(row.byte_length),
    expected_sha256: row.content_sha256,
    actual_sha256: actual,
    expected_bytes: Number(row.byte_length),
    actual_bytes: stored.byteLength,
  };
}
