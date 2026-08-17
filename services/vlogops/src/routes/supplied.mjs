// BUILD-006 Phase 1 — Route 3: a seed Warwick supplies directly.
//
// Free text, a pasted conversation, or a document — PLUS the angle or question he wants
// taken. The register the map keeps, because it sets the expectation for what arrives here:
//
//   "Today I thought X was a fucking good idea. GPT and Pax told me it was shite.
//    This is what I missed."
//
// THE ANGLE IS REQUIRED INPUT AND IS NEVER INFERRED FROM THE TEXT. This is the one rule
// this route exists to hold. Inferring it would be the system quietly deciding what he
// meant — and it would do so most confidently on exactly the material where he is being
// least literal. A seed offered without an angle is refused, and there is no fallback, no
// default angle, and no "best guess" path anywhere in this file.

import fs from 'node:fs';
import { snapshotText } from '../snapshot.mjs';

export function suppliedBundle({
  config, angle, text = null, filePath = null, privacyState = 'unclassified', sourceRef = null,
}) {
  const problems = [];

  if (!angle || String(angle).trim() === '') {
    problems.push('angle is required — the angle or question is required INPUT and is never inferred from the text');
  }

  let body = text;
  if ((body === null || String(body).trim() === '') && filePath) {
    body = fs.readFileSync(filePath, 'utf8');
  }
  if (body === null || String(body).trim() === '') {
    problems.push('a seed needs something to say — supply text, a pasted conversation or a document');
  }

  if (!privacyState) {
    problems.push('privacy_state is required on every supplied seed');
  }

  if (problems.length > 0) {
    const err = new Error(`vlogops: supplied seed rejected\n  - ${problems.join('\n  - ')}`);
    err.code = 'EVLOGOPSSEEDREJECTED';
    err.problems = problems;
    throw err;
  }

  const member = snapshotText({
    sourceRef: sourceRef ?? 'supplied:1',
    text: body,
    mediaType: filePath ? 'text/markdown' : 'text/plain',
    privacyState,
    maxInlineBytes: config.snapshotMaxInlineBytes,
    provenance: {
      source_system: 'warwick-supplied',
      route: 'supplied',
      supplied_as: filePath ? 'document' : 'text',
      // The angle is recorded in provenance AND participates in the identity via the
      // manifest. Two readings of the same text are two seeds, deliberately.
      angle: String(angle).trim(),
    },
  });

  return {
    members: [member],
    angle: String(angle).trim(),
    selector: { kind: 'supplied', angle: String(angle).trim() },
  };
}
