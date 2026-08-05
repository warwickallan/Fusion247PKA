// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline-runtime/runtime-paths.mjs
//
// WHERE THE RUNTIME'S OPERATIONAL STATE LIVES - in ONE place, so the launcher,
// the status surface, the tests and the proofs can never disagree about which
// lock they are talking about. Two components with two ideas of "the lock file"
// is a second poller waiting to happen.
//
// Everything is OUTSIDE the repo. Fusion247PKA is PUBLIC; the Telegram offset,
// the runtime log and the downloaded list photos are household personal data and
// must never enter git.
// =====================================================================

import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** The pipeline runtime entry, owned by the pipeline worker. Imported and
 *  launched by this folder; never edited by it. */
export const RUNTIME_ENTRY = path.join(HERE, '..', 'pipeline', 'runtime.js');
export const RUNTIME_CWD = path.join(HERE, '..', 'pipeline');

/** A stand-in entry used ONLY by --selftest, so the launcher's real spawn path
 *  can be exercised without a poller that would consume Telegram updates. */
export const SELFTEST_ENTRY = path.join(HERE, 'selftest-entry.mjs');

export const STATE_DIR = process.env.ASDAIR_RUNTIME_STATE_DIR
  || (process.platform === 'win32' ? 'C:/.fusion247/asdair' : path.join(os.homedir(), '.fusion247', 'asdair'));

export const LOG = path.join(STATE_DIR, 'runtime.log');

/**
 * The intake's durable offset file.
 *
 * Resolved exactly as services/asdair/intake/shopperIntake.js resolves it -
 * SHOPPER_INTAKE_STATE_FILE if set, otherwise the platform default under the
 * intake home - so the status surface reads the SAME file the receiver writes.
 */
export function intakeStateFile(env = process.env) {
  const override = env.SHOPPER_INTAKE_STATE_FILE;
  if (typeof override === 'string' && override.length > 0) return override;
  const home = process.platform === 'win32'
    ? 'C:/.fusion247/asdair'
    : path.join(os.homedir(), '.fusion247', 'asdair');
  return path.join(home, 'shopper-intake-state.json');
}

/** The dedicated Chrome profile the browser runner drives. Under the household
 *  root by default, so it belongs in this module with the other two rather than
 *  as a bare literal in the launcher.
 *
 *  MOVED here 2026-08-04 (WO-ZA follow-up). It was the THIRD helper with a
 *  fall-through to C:/.fusion247, found while enumerating the first two, and it
 *  was the one left documented rather than guarded - which is the state 5A
 *  existed to end. ensure-asdair-runtime.mjs re-exports the default constant so
 *  its own test suite is unaffected. */
export const CHROME_DEFAULT_PROFILE_DIR = process.platform === 'win32'
  ? 'C:/.fusion247/asdair/chrome-profile'
  : path.join(os.homedir(), '.fusion247', 'asdair', 'chrome-profile');

export function chromeProfileDir(env = process.env) {
  const override = env.ASDAIR_CHROME_PROFILE_DIR;
  if (typeof override === 'string' && override.length > 0) return override;
  return CHROME_DEFAULT_PROFILE_DIR;
}

/**
 * EVERY path helper in this module whose value can land under the household
 * root, named once so a control can enumerate them instead of a human
 * remembering to.
 *
 * THE POINT: the 2026-08-04 sweep found three fall-throughs, guarded two, and
 * left the third with a note on it. A note is not a control. PROOF 10 resolves
 * this whole list and fails on any that escapes, AND fails if this list stops
 * matching the `.fusion247` literals actually present in this file - so a
 * FOURTH helper added later cannot be silently unguarded.
 */
export const HOUSEHOLD_PATH_HELPERS = Object.freeze([
  { name: 'STATE_DIR', env: 'ASDAIR_RUNTIME_STATE_DIR', resolve: () => STATE_DIR },
  { name: 'LOG', env: 'ASDAIR_RUNTIME_STATE_DIR', resolve: () => LOG },
  { name: 'intakeStateFile', env: 'SHOPPER_INTAKE_STATE_FILE', resolve: (env) => intakeStateFile(env) },
  { name: 'chromeProfileDir', env: 'ASDAIR_CHROME_PROFILE_DIR', resolve: (env) => chromeProfileDir(env) },
]);

export { HERE };
