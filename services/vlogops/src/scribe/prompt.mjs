// BUILD-006 Phase 3 — assembling the question, deterministically.
//
// Everything in this file is a PURE FUNCTION of frozen data, on the same rule pack.mjs follows:
// no database, no filesystem, no clock, no randomness, no process identity. Hand it the same
// contract bytes and the same pack entries and it returns the same prompt, byte for byte, in any
// process on any machine on any day.
//
// THAT IS WHAT MAKES `derivation_id` MEAN SOMETHING. The claim Phase 3 can honestly make is not
// "the same pack produces the same words" — it does not, and no stub can make that true of a real
// model. The claim is "the same pack under the same contract asks EXACTLY the same question of
// exactly the same evidence". That claim is checkable precisely because this file cannot reach
// anything that varies.
//
// The excerpt bound lives in config.mjs as a module constant rather than an environment
// variable, for the same reason the pack budgets do: a limit an operator can widen is not a
// limit, and here it would be worse than untidy — a widened excerpt changes what the model was
// shown while every derivation_id computed under the old bound goes on claiming the question was
// unchanged.

import { SCRIBE_PROMPT_EXCERPT_CHARS, SCRIBE_SIBLINGS } from '../config.mjs';
import { canonicalJson, sha256Hex } from '../identity.mjs';

/**
 * A deterministic, bounded excerpt of one entry's frozen bytes.
 *
 * Decoded as UTF-8 and cut at a character count, not a byte count: a byte cut can land inside a
 * multi-byte sequence and produce a replacement character whose presence depends on where the cut
 * fell, which would make the prompt — and therefore the derivation identity — depend on an
 * accident of encoding.
 *
 * The truncation is DISCLOSED in the prompt itself. A model shown a silently truncated document
 * will confidently describe the part it was not shown.
 */
export function excerptOf(text, maxChars = SCRIBE_PROMPT_EXCERPT_CHARS) {
  const chars = [...String(text)];
  if (chars.length <= maxChars) return { text: String(text), truncated: false, chars: chars.length };
  return { text: chars.slice(0, maxChars).join(''), truncated: true, chars: chars.length };
}

/**
 * The evidence block for one entry, in the shape the contract's §2 describes.
 *
 * `source_ref` is printed on its own line, verbatim and unadorned, because the contract requires
 * the model to copy it exactly and every character of decoration is one more thing to copy wrong.
 */
function entryBlock(entry) {
  const ex = excerptOf(entry.excerpt_text ?? '');
  const when = entry.occurred_at === null || entry.occurred_at === undefined
    ? `unknown (basis: ${entry.occurred_at_basis})`
    : `${entry.occurred_at} (basis: ${entry.occurred_at_basis})`;

  return [
    `--- ENTRY ${entry.ordinal} ---`,
    `source_ref: ${entry.source_ref}`,
    `occurred_at: ${when}`,
    `media_type: ${entry.media_type}`,
    `bytes: ${entry.byte_length}`,
    ex.truncated
      ? `excerpt: FIRST ${SCRIBE_PROMPT_EXCERPT_CHARS} CHARACTERS OF ${ex.chars} — THIS DOCUMENT IS TRUNCATED HERE`
      : 'excerpt: complete',
    '',
    ex.text,
    '',
  ].join('\n');
}

/**
 * Assemble the whole prompt: the contract, then the pack, then the entries, then the one
 * instruction that closes it.
 *
 * `entries` arrive already in the pack's own presentation order, which pack.mjs decided
 * chronologically. This function does not re-sort them — two components each holding an opinion
 * about ordering is how "chronological" quietly starts meaning something else.
 */
export function buildPrompt({ contract, packId, seedId, angle = null, entries }) {
  if (!contract || typeof contract.text !== 'string' || typeof contract.id !== 'string') {
    throw new TypeError('buildPrompt: a loaded contract with text and id is required');
  }
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new TypeError('buildPrompt: a package needs at least one pack entry to draft from');
  }

  const head = [
    contract.text,
    '',
    '═══════════════════════════════════════════════════════════════════════════',
    'THE EVIDENCE PACK — this is everything you know. There is no other source.',
    '═══════════════════════════════════════════════════════════════════════════',
    '',
    `pack_id: ${packId}`,
    `seed_id: ${seedId}`,
    angle === null || angle === undefined || angle === ''
      ? 'requested_angle: none — this seed carries no angle, so the story question is yours to find in the evidence'
      : `requested_angle: ${angle}`,
    `entries: ${entries.length}`,
    '',
    'The ONLY citable source_ref values are these, exactly as written:',
    ...entries.map((e) => `  ${e.source_ref}`),
    '',
  ].join('\n');

  const body = entries.map(entryBlock).join('\n');

  const tail = [
    '═══════════════════════════════════════════════════════════════════════════',
    'Return one JSON object in the shape given in §4 of the contract above, and nothing else.',
    `All four siblings are required: ${SCRIBE_SIBLINGS.join(', ')}.`,
    'Every citation must be one of the source_ref values listed above, copied exactly.',
    '═══════════════════════════════════════════════════════════════════════════',
  ].join('\n');

  return `${head}\n${body}\n${tail}\n`;
}

/** The prompt's identity — sha256 of its exact bytes. */
export function promptIdentity(prompt) {
  return sha256Hex(prompt);
}

/**
 * THE DERIVATION IDENTITY — the deterministic half, and the only determinism Phase 3 claims.
 *
 * A pure function of: which pack, which contract bytes, which prompt bytes, and which derivation
 * rule. Not of the model, not of its output, not of the clock. Two packages sharing a
 * derivation_id were asked exactly the same question of exactly the same evidence; whether they
 * answered it the same way is a different fact and lives in package_id.
 */
export function derivationIdentity({ packId, contractId, promptSha256, derivationRuleVersion, scribeVersion }) {
  return sha256Hex(canonicalJson({
    v: 1,
    pack_id: packId,
    contract_id: contractId,
    prompt_sha256: promptSha256,
    derivation_rule: derivationRuleVersion,
    scribe: scribeVersion,
  }));
}
