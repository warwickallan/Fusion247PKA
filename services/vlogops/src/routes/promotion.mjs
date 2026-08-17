// BUILD-006 Phase 1 — Route 2: promote another Fusion247 output into a Content Seed.
//
// THE FIVE-FIELD CONTRACT, and it is a contract rather than a checklist:
//
//   source snapshot · provenance · privacy state · origin · proposed angle
//
// Missing any one of them is a REJECTED promotion, not a partial seed. That distinction is
// the whole of this route's design. A partial seed is worse than no seed, because it looks
// like a seed to everything downstream — the Source Compiler, Scribe, verification — and
// each of those would inherit the gap without ever being told there was one.
//
// The rejection is enforced in three places on purpose: here, with a message naming the
// missing field; in `validateSeedRequest`; and as CHECK constraints in the schema, which is
// the one that still holds when a future caller bypasses both.
//
// There is no Cockpit UI in this phase. The route is a callable surface and its proofs.

import fs from 'node:fs';
import { snapshotFile, snapshotText } from '../snapshot.mjs';

/**
 * Build a promotion bundle, or throw naming every field that is missing.
 *
 * `origin` says WHICH Fusion247 output this came from. `angle` is the proposed angle that
 * travels with it. Both are required input from the promoting surface; neither is inferred.
 */
export function promotionBundle({
  config, origin, angle, sourceRef = null, text = null, filePath = null, privacyState = 'unclassified',
}) {
  const problems = [];

  if (!origin || String(origin).trim() === '') {
    problems.push('origin is required — which Fusion247 output is being promoted');
  }
  if (!angle || String(angle).trim() === '') {
    problems.push('angle is required — the proposed angle is part of the promotion contract, not an afterthought');
  }
  if ((text === null || String(text).trim() === '') && !filePath) {
    problems.push('a source snapshot is required — a promotion with nothing to snapshot is not a seed');
  }
  if (!privacyState) {
    problems.push('privacy_state is required on every promotion');
  }

  if (problems.length > 0) {
    const err = new Error(`vlogops: promotion rejected\n  - ${problems.join('\n  - ')}`);
    err.code = 'EVLOGOPSSEEDREJECTED';
    err.problems = problems;
    throw err;
  }

  const ref = sourceRef ?? `promotion:${String(origin).trim()}`;

  const provenance = {
    source_system: 'fusion247',
    origin: String(origin).trim(),
    route: 'promotion',
    promoted_angle: String(angle).trim(),
  };

  const member = filePath && (text === null || String(text).trim() === '')
    ? snapshotFile({
      repoRoot: config.repoRoot,
      absPath: filePath,
      privacyState,
      maxInlineBytes: config.snapshotMaxInlineBytes,
      provenance,
    })
    : snapshotText({
      sourceRef: ref,
      text: text ?? fs.readFileSync(filePath, 'utf8'),
      mediaType: 'text/plain',
      privacyState,
      maxInlineBytes: config.snapshotMaxInlineBytes,
      provenance,
    });

  return {
    members: [member],
    angle: String(angle).trim(),
    origin: String(origin).trim(),
    selector: { kind: 'promotion', origin: String(origin).trim() },
  };
}
