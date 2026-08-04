// =====================================================================
// BUILD-015 AsdAIr - handoff/fingerprint.js
//
// THE PACKET IDENTITY THE SCHEMA DOES NOT CARRY.
//
// The committed SONNET-BROWSER-EXECUTION-PACKET schema has no id and no hash.
// Without one there is no way to satisfy the rule "a completion report against
// a SUPERSEDED packet is refused", because nothing on the report could say
// WHICH packet it was executing. This file supplies that identity by content,
// so no schema change, no migration and no new table is needed.
//
// CANONICAL FORM, and why it must be canonical: JSON.stringify preserves
// insertion order, so two structurally identical packets that were built with
// their keys assigned in a different order would hash differently and the
// second would be wrongly treated as superseding the first. canonicalize()
// sorts object keys recursively and leaves ARRAY order alone - array order is
// meaningful here (it is the Brand A-Z sort contract) and must never be
// normalised away.
//
// node:crypto is a Node builtin, not a dependency.
//
// PURE ASCII SOURCE ONLY. No clock, no randomness, no I/O.
// =====================================================================
'use strict';

const crypto = require('node:crypto');

/**
 * Recursively sort object keys. Arrays keep their order. Values are otherwise
 * untouched, so `undefined` members are dropped by JSON.stringify exactly as
 * they would be on the wire.
 */
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonicalize(value[key]);
    return out;
  }
  return value;
}

/**
 * Content fingerprint of a packet. Prefixed with the algorithm so a future
 * change is visible in stored data rather than silently comparing unequal.
 *
 * @param {object} packet
 * @returns {string} e.g. "sha256:1f0c..."
 */
function fingerprintPacket(packet) {
  if (!packet || typeof packet !== 'object' || Array.isArray(packet)) {
    throw new TypeError('fingerprintPacket: packet must be an object');
  }
  const json = JSON.stringify(canonicalize(packet));
  return `sha256:${crypto.createHash('sha256').update(json, 'utf8').digest('hex')}`;
}

/**
 * Constant-time-ish equality for two fingerprints. Not a security boundary -
 * these are not secrets - but a single comparison helper means the supersession
 * check reads the same way everywhere it is made.
 */
function sameFingerprint(a, b) {
  return typeof a === 'string' && typeof b === 'string' && a.length > 0 && a === b;
}

module.exports = { fingerprintPacket, sameFingerprint, _internal: { canonicalize } };
