// =====================================================================
// BUILD-015 AsdAIr - packet/committedSchema.js
//
// TEST SUPPORT. Loads the COMMITTED contract from the build folder:
//   Builds/BUILD-015-.../SONNET-BROWSER-EXECUTION-PACKET.schema.json
//
// WHY IT READS FROM THERE AND NOT FROM A COPY IN THIS MODULE:
// the whole value of "validated against the schema" is that the schema is
// a literal held OUTSIDE the source under test. A copy vendored in here
// would drift, and the tests would then prove that this module agrees with
// itself - which is not a proof of anything. The file is owned by someone
// else (Larry) and is being tightened; if it changes in a way this module
// violates, the suite MUST go red.
//
// It is READ-ONLY. This module never writes to the build folder, which is
// outside this Work Order's file_surface.
//
// A missing or unreadable schema THROWS. It must never be caught and
// turned into a skipped test: a proof that quietly does not run is the
// exact false-green this build has been bitten by.
// =====================================================================

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// services/asdair/packet -> services/asdair -> services -> <repo root>
export const SCHEMA_PATH = path.resolve(
  HERE,
  '..', '..', '..',
  'Builds',
  'BUILD-015-asdair-durable-household-shopping-steward',
  'SONNET-BROWSER-EXECUTION-PACKET.schema.json'
);

let raw;
try {
  raw = readFileSync(SCHEMA_PATH, 'utf8');
} catch (err) {
  throw new Error(
    'committedSchema: the COMMITTED contract could not be read at ' + SCHEMA_PATH + '. ' +
    'These tests assert against the committed schema and MUST NOT be skipped or stubbed. ' +
    'Original error: ' + err.message
  );
}

/** SHA-256 of the exact bytes validated against, so the evidence is
 *  exact-head rather than "the schema, presumably". */
export const SCHEMA_SHA256 = createHash('sha256').update(raw).digest('hex');

export const SCHEMA = JSON.parse(raw);
