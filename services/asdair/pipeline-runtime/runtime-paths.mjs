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

export { HERE };
