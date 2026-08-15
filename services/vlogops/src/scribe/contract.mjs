// BUILD-006 Phase 3 — the Scribe contract, loaded and identified.
//
// Scribe is "a persistent specialist capability within VlogOps, implemented as a VERSIONED
// CONTRACT/SKILL whose underlying model may change" (Wayfinder §3). This module is what makes
// "versioned" a fact rather than a label.
//
// THE VERSION IS THE TEXT. `contract_version` is a human-readable name and it is not trusted: a
// name can be left alone while the file underneath it changes, which is how a contract quietly
// stops being the one a package was drafted under. `contract_id` is the sha256 of the contract's
// text, and it is what gets stored on the package.
//
// Consequence, and it is AC5: editing the contract cannot retroactively alter an existing
// package. The stored package carries the id of the text that produced it; the new text has a
// different id; and the package row is immutable in the database anyway. There is no path along
// which yesterday's package silently becomes a product of today's instructions.
//
// ── WHY LINE ENDINGS ARE NORMALISED BEFORE HASHING, AND WHY THAT IS NOT A LOOPHOLE ──────────
// This repository has `core.autocrlf=true` and no `.gitattributes`. Hashing the file's RAW bytes
// would therefore give this contract one identity when checked out on Windows and a different
// one on Linux — the same contract, two identities, decided by the operating system of whoever
// happened to run the draft. Every package's identity would inherit that, and `derivation_id`
// would claim two runs asked different questions when they asked the same one.
//
// So the bytes are read, CRLF is folded to LF ONCE here, and the normalised text is what gets
// BOTH hashed AND sent to the model. The Phase 1 invariant is preserved exactly — hash what you
// actually use, never a different view of it — and Phase 1 already ruled the same way for
// supplied text, for the same reason: line endings "vary for reasons that have nothing to do
// with what it says".
//
// This is deliberately the ONLY normalisation. Whitespace, case and Unicode composition are all
// left alone, because a change in any of those IS a change to the instructions.
//
// `.gitattributes` in this service pins `eol=lf` as well. That is defence in depth, not the
// mechanism: a checkout setting can be lost on a fresh clone, and this must hold anyway.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256Hex } from '../identity.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Where versioned contracts live. One file per version, never edited in place after release. */
export const CONTRACT_DIR = path.join(__dirname, 'contract');

/** The contract version in force. Bump it by adding a file, never by editing a released one. */
export const CURRENT_CONTRACT_VERSION = 'scribe-v1';

/** Fold CRLF to LF. The only normalisation a contract gets — see the header for why. */
export function normaliseContractText(raw) {
  return raw.replace(/\r\n/g, '\n');
}

/**
 * Load a contract version and identify it.
 *
 * Returns { version, id, text, path }. `text` is the normalised text, `id` is the sha256 of
 * exactly that text, and `text` is what reaches the model — so the thing hashed and the thing
 * used are the same thing, on every platform.
 */
export function loadContract(version = CURRENT_CONTRACT_VERSION) {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(version)) {
    const err = new TypeError(`scribe: contract version must be a lowercase slug (got ${version})`);
    err.code = 'EVLOGOPSSCRIBEBADVERSION';
    throw err;
  }

  const file = path.join(CONTRACT_DIR, `${version}.md`);
  if (!fs.existsSync(file)) {
    const err = new Error(
      `scribe: no contract '${version}' at ${file}. A package is drafted under a contract that `
      + 'exists on disk; there is no path that invents one.',
    );
    err.code = 'EVLOGOPSSCRIBENOCONTRACT';
    throw err;
  }

  const text = normaliseContractText(fs.readFileSync(file, 'utf8'));
  return {
    version,
    id: sha256Hex(text),
    text,
    path: file,
  };
}

/** Every contract version present on disk, in name order. Used by the CLI and by the proofs. */
export function availableContractVersions() {
  return fs.readdirSync(CONTRACT_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.slice(0, -3))
    .sort();
}
