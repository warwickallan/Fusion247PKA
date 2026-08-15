// BUILD-006 Phase 4 — the verdict, as a pure function of frozen rows.
//
// No database, no filesystem, no clock, no randomness, no process identity. Hand this the same
// package view twice, in two processes on two days, and it produces the same verification_id.
// That is the same discipline 001 applied to seeds, 002 to packs and 003 to packages, and it is
// what makes a verdict a FACT ABOUT A PACKAGE UNDER A RULESET rather than an event that happened
// once and cannot be reproduced.
//
// The immediate consequence: verifying the same package twice under the same ruleset lands on the
// same row and writes nothing new. The second run is not a second opinion.

import { canonicalJson, sha256Hex } from '../identity.mjs';
import { DIMENSIONS } from './rules.mjs';

/**
 * A total order over findings, so the manifest's bytes cannot depend on the order rules happened
 * to run in or on a Map's iteration order.
 *
 * Ordinals are assigned AFTER this sort, which is what lets a disposition reference
 * (verification_id, ordinal) and mean the same finding forever.
 */
function compareFindings(a, b) {
  const key = (f) => [
    f.dimension,
    f.rule,
    f.claim_id ?? '',
    f.sibling ?? '',
    f.segment_ordinal === null || f.segment_ordinal === undefined ? -1 : f.segment_ordinal,
    f.source_ref ?? '',
    f.detail,
  ];
  const ka = key(a);
  const kb = key(b);
  for (let i = 0; i < ka.length; i += 1) {
    if (ka[i] < kb[i]) return -1;
    if (ka[i] > kb[i]) return 1;
  }
  return 0;
}

/**
 * Run every dimension over one materialised package.
 *
 * Each dimension answers independently and carries its own evidence and its own coverage. There
 * is deliberately NO aggregate boolean anywhere in this return: Warwick must be able to see WHICH
 * dimension objected and why, and a single true/false is exactly the shape that makes that
 * impossible.
 */
export function runDimensions(view) {
  const dimensions = {};
  const all = [];

  for (const { name, check } of DIMENSIONS) {
    const { findings, coverage } = check(view);
    const blocking = findings.filter((f) => f.severity === 'block').length;
    const surfaced = findings.filter((f) => f.severity === 'surface').length;

    dimensions[name] = {
      // Three values, not two. `blocked` is a rule broken; `surfaced` is a question raised that
      // this machinery is not entitled to answer. Both stop the package; they are different
      // things and a reader must be able to tell them apart.
      verdict: blocking > 0 ? 'blocked' : surfaced > 0 ? 'surfaced' : 'pass',
      blocking,
      surfaced,
      coverage,
    };
    all.push(...findings);
  }

  const ordered = [...all].sort(compareFindings).map((f, i) => ({ ...f, ordinal: i }));

  return {
    dimensions,
    findings: ordered,
    findingCount: ordered.length,
    blockingCount: ordered.filter((f) => f.severity === 'block').length,
    surfacedCount: ordered.filter((f) => f.severity === 'surface').length,
    // `pass` requires silence from every dimension. A surfaced question is not a pass — a
    // question nobody is forced to answer is not a gate.
    verdict: ordered.length === 0 ? 'pass' : 'blocked',
  };
}

/**
 * The manifest that IS the verification's identity.
 *
 * In: the package, the ruleset's byte-identity, the verifier version, and every finding with its
 * locator. NOT in: any clock, row id, pid, hostname or insertion order — and not the coverage
 * numbers either, which are honest reporting about the run rather than part of what the verdict
 * IS. Two verifiers reaching the same findings about the same package under the same ruleset are
 * the same verdict.
 */
export function buildVerificationManifest({ packageId, ruleset, verifierVersion, result }) {
  if (typeof packageId !== 'string' || !/^[0-9a-f]{64}$/.test(packageId)) {
    throw new TypeError(`buildVerificationManifest: packageId must be a sha256 hex string (got ${packageId})`);
  }

  return {
    v: 1,
    package_id: packageId,
    verifier: verifierVersion,
    ruleset: { version: ruleset.version, id: ruleset.id },
    verdict: result.verdict,
    findings: result.findings.map((f) => ({
      ordinal: f.ordinal,
      dimension: f.dimension,
      severity: f.severity,
      rule: f.rule,
      claim_id: f.claim_id,
      sibling: f.sibling,
      segment_ordinal: f.segment_ordinal,
      source_ref: f.source_ref,
      detail: f.detail,
    })),
  };
}

/** The verification's identity: sha256 over the canonical manifest. Phase 1's functions, reused. */
export function verificationIdentity(manifest) {
  return sha256Hex(canonicalJson(manifest));
}

/**
 * The whole verdict, ready to store: run the dimensions, build the manifest, compute the identity.
 *
 * Pure. The caller does the I/O.
 */
export function verifyPackageView({ view, ruleset, verifierVersion }) {
  const result = runDimensions(view);
  const manifest = buildVerificationManifest({
    packageId: view.packageId, ruleset, verifierVersion, result,
  });
  return { ...result, manifest, verificationId: verificationIdentity(manifest) };
}
