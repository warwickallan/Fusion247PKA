// BUILD-006 Phase 4 — the ruleset, loaded and identified.
//
// THE VERSION IS THE TEXT. `ruleset_version` is a human-readable name and it is not trusted: a
// name can be left alone while the file underneath it changes, which is how a ruleset quietly
// stops being the one a verdict was reached under. `ruleset_id` is the sha256 of the ruleset
// document's text, and it participates in the identity of every verification run.
//
// Consequence, and it is the point: editing a rule cannot retroactively change an old verdict.
// The stored run carries the id of the text that produced it, the new text has a different id,
// and the run row is immutable in the database anyway. Two runs that disagree can always be
// traced to the two rulesets that produced them.
//
// This is Phase 3's contract.mjs applied to a different artefact, deliberately and openly — same
// reasoning, same CRLF handling, same reason for the CRLF handling. It is a separate module
// rather than a shared one because a scribe contract and a verification ruleset are different
// things that happen to be identified the same way, and collapsing them would couple two
// versioning schemes that must be free to move apart.
//
// ── PHASE 4 KEEPS ITS OWN CONSTANTS, ON PURPOSE ─────────────────────────────────────────────
// The verifier's version labels live here rather than in src/config.mjs so that this phase
// changes NO file belonging to Phases 1-3. That is not tidiness: those three phases are in
// assurance, and a Phase 4 edit inside them would put a phase that has already been reviewed back
// into scope for no product reason at all.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256Hex } from '../identity.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Where versioned rulesets live. One file per version, never edited in place after release. */
export const RULESET_DIR = path.join(__dirname, 'contract');

/** The ruleset in force. Bump it by adding a file, never by editing a released one. */
export const CURRENT_RULESET_VERSION = 'verification-v1';

/** The verifier's own generator label, stored on every run and participating in its identity. */
export const VERIFIER_VERSION = 'vlogops-verifier-v1';

/** Fold CRLF to LF. The only normalisation a ruleset gets — Phase 3's reasoning, unchanged. */
export function normaliseRulesetText(raw) {
  return raw.replace(/\r\n/g, '\n');
}

/**
 * Load a ruleset version and identify it.
 *
 * Returns { version, id, text, path }. `id` is the sha256 of exactly the normalised text, and
 * that text is the document a human reads to argue with a verdict — so the thing hashed and the
 * thing relied upon are the same thing, on every platform.
 */
export function loadRuleset(version = CURRENT_RULESET_VERSION) {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(version)) {
    const err = new TypeError(`vlogops verify: ruleset version must be a lowercase slug (got ${version})`);
    err.code = 'EVLOGOPSVERIFYBADVERSION';
    throw err;
  }

  const file = path.join(RULESET_DIR, `${version}.md`);
  if (!fs.existsSync(file)) {
    const err = new Error(
      `vlogops verify: no ruleset '${version}' at ${file}. A package is checked under a ruleset `
      + 'that exists on disk; there is no path that invents one.',
    );
    err.code = 'EVLOGOPSVERIFYNORULESET';
    throw err;
  }

  const text = normaliseRulesetText(fs.readFileSync(file, 'utf8'));
  return { version, id: sha256Hex(text), text, path: file };
}

/** Every ruleset version present on disk, in name order. Used by the CLI and by the proofs. */
export function availableRulesetVersions() {
  return fs.readdirSync(RULESET_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.slice(0, -3))
    .sort();
}
