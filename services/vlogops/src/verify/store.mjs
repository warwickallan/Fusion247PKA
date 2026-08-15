// BUILD-006 Phase 4 — verification against the store: read frozen rows, judge, write the verdict.
//
// This module is the only place in Phase 4 that touches the database. Every decision about what
// is WRONG with a package was already made by rules.mjs and verifier.mjs, neither of which can
// reach a clock, a socket or a filesystem. What is left here is reading rows, writing a run in ONE
// transaction, and the three human acts that can move a package: declaring a right, disposing of
// a finding, and advancing.
//
// ── IT READS STORED ROWS AND NOTHING ELSE ───────────────────────────────────────────────────
// No original artefact is re-read, no model is called, and the thing that wrote the package is
// never asked whether the package is good. Verification that consulted the drafter would be the
// drafter marking its own homework with extra steps.
//
// ── WHY A KILL MID-VERIFICATION CANNOT LEAVE HALF A VERDICT ─────────────────────────────────
// The run row and every finding are written inside one transaction, exactly as Phase 1's intake,
// Phase 2's compile and Phase 3's draft are. Killed before COMMIT: nothing. Killed after: one
// complete verdict. There is no third state, so there is no reconciler and no recovery pass — and
// because the verdict is content-addressed, the re-run after a kill lands on the same identity.

import { withTransaction } from '../db.mjs';
import { extractQuotedSpans } from './text.mjs';
import { CURRENT_RULESET_VERSION, VERIFIER_VERSION, loadRuleset } from './ruleset.mjs';
import { verifyPackageView } from './verifier.mjs';

const PACKAGE_QUERY = `
  select package_id, pack_id, seed_id, story_question, claim_count, segment_count, model_binding
    from vlogops.story_package where package_id = $1`;

// The entries of the package's pack, joined to the frozen snapshot they point at, to the seed's
// own privacy state, and to any declared rights basis. One query, because every dimension needs
// some of it and reading it four times would let four dimensions disagree about the same row.
const ENTRY_QUERY = `
  select e.ordinal, e.source_ref, e.media_type, e.byte_length, e.content_sha256, e.provenance,
         s.content, s.privacy_state as snapshot_privacy,
         cs.privacy_state as seed_privacy,
         r.basis, r.basis_source, r.holder
    from vlogops.evidence_pack_entry e
    join vlogops.source_snapshot s
      on s.seed_id = e.seed_id and s.source_ref = e.source_ref
    join vlogops.content_seed cs on cs.seed_id = e.seed_id
    left join vlogops.source_rights r
      on r.seed_id = e.seed_id and r.source_ref = e.source_ref
   where e.pack_id = $1
   order by e.ordinal`;

/**
 * Materialise everything one package's verdict depends on.
 *
 * `text` is null where the snapshot kept only a content_url. That null is load-bearing: it is
 * what QUOT-2 turns into a surfaced question rather than letting an unverifiable quotation pass
 * quietly.
 */
export async function readPackageForVerification(pool, packageId) {
  const pkg = await pool.query(PACKAGE_QUERY, [packageId]);
  if (pkg.rowCount === 0) {
    const err = new Error(
      `vlogops verify: no package ${packageId}. Verification is invoked FOR a stored Master Story `
      + 'Package; there is no path that invents one.',
    );
    err.code = 'EVLOGOPSNOPACKAGE';
    throw err;
  }

  const row = pkg.rows[0];
  const packId = row.pack_id.trim();
  const seedId = row.seed_id.trim();

  const [claims, citations, segments, entries] = await Promise.all([
    pool.query(
      `select claim_id, kind, ordinal, text from vlogops.story_claim
        where package_id = $1 order by kind, ordinal, claim_id`, [packageId]),
    pool.query(
      `select claim_id, source_ref from vlogops.story_claim_citation
        where package_id = $1 order by claim_id, source_ref`, [packageId]),
    pool.query(
      `select sibling, ordinal, role, text, claim_id, source_ref from vlogops.story_segment
        where package_id = $1 order by sibling, ordinal`, [packageId]),
    pool.query(ENTRY_QUERY, [packId]),
  ]);

  const citationsByClaim = new Map();
  for (const c of citations.rows) {
    if (!citationsByClaim.has(c.claim_id)) citationsByClaim.set(c.claim_id, []);
    citationsByClaim.get(c.claim_id).push(c.source_ref);
  }

  const entryMap = new Map();
  for (const e of entries.rows) {
    entryMap.set(e.source_ref, {
      source_ref: e.source_ref,
      ordinal: e.ordinal,
      media_type: e.media_type,
      byte_length: Number(e.byte_length),
      content_sha256: e.content_sha256.trim(),
      provenance: e.provenance ?? {},
      // Buffer -> utf8, or null when the bytes were never stored inline.
      text: Buffer.isBuffer(e.content) ? e.content.toString('utf8') : (e.content ?? null),
      snapshotPrivacy: e.snapshot_privacy,
      seedPrivacy: e.seed_privacy,
      rights: e.basis === null || e.basis === undefined
        ? null
        : { basis: e.basis, basis_source: e.basis_source, holder: e.holder },
    });
  }

  const claimRows = claims.rows.map((c) => ({
    claim_id: c.claim_id,
    kind: c.kind,
    ordinal: c.ordinal,
    text: c.text,
    citations: citationsByClaim.get(c.claim_id) ?? [],
  }));

  const citedSourceRefs = new Set();
  for (const refs of citationsByClaim.values()) for (const r of refs) citedSourceRefs.add(r);
  for (const s of segments.rows) citedSourceRefs.add(s.source_ref);

  // Which sources have their WORDS carried into publishable text, as opposed to merely being
  // rested on. PRIV-2 turns on exactly this distinction.
  const quotedSourceRefs = new Set();
  for (const s of segments.rows) {
    if (extractQuotedSpans(s.text).length === 0) continue;
    quotedSourceRefs.add(s.source_ref);
    for (const r of citationsByClaim.get(s.claim_id) ?? []) quotedSourceRefs.add(r);
  }

  return {
    packageId: row.package_id.trim(),
    packId,
    seedId,
    // The names of every entry in the pack, for FACT's reference-grounding rule.
    packRefsText: entries.rows.map((e) => e.source_ref).join(' '),
    storyQuestion: row.story_question,
    modelBinding: row.model_binding,
    claims: claimRows,
    segments: segments.rows,
    entries: entryMap,
    citedSourceRefs,
    quotedSourceRefs,
  };
}

/**
 * Verify one package and STORE the verdict.
 *
 * Returns { verificationId, verdict, dimensions, findings, deduplicated }. `deduplicated: true`
 * means this exact verdict already existed and nothing was written — the correct, quiet outcome
 * of verifying the same package twice under the same ruleset, and of every restart after an
 * abrupt kill.
 */
export async function verifyAndRecord({ pool, packageId, rulesetVersion = CURRENT_RULESET_VERSION, hooks = {} }) {
  if (typeof packageId !== 'string' || !/^[0-9a-f]{64}$/.test(packageId)) {
    const err = new Error(`vlogops verify: package_id must be a 64-character lowercase hex string (got ${packageId})`);
    err.code = 'EVLOGOPSBADPACKAGEID';
    throw err;
  }

  const pause = async (stage) => { if (hooks.onStage) await hooks.onStage(stage); };

  const ruleset = loadRuleset(rulesetVersion);
  const view = await readPackageForVerification(pool, packageId);

  await pause('package-read');

  const result = verifyPackageView({ view, ruleset, verifierVersion: VERIFIER_VERSION });

  await pause('judged');

  const dimensions = result.dimensions;

  const written = await withTransaction(pool, async (client) => {
    const inserted = await client.query(
      `insert into vlogops.verification_run
         (verification_id, package_id, verifier_version, ruleset_version, manifest, dimensions,
          verdict, finding_count, blocking_count, surfaced_count)
       values ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10)
       on conflict (verification_id) do nothing
       returning verification_id`,
      [
        result.verificationId, view.packageId, VERIFIER_VERSION, ruleset.version,
        JSON.stringify(result.manifest), JSON.stringify(dimensions),
        result.verdict, result.findingCount, result.blockingCount, result.surfacedCount,
      ],
    );

    if (inserted.rowCount === 0) return { deduplicated: true };

    await pause('run-inserted');

    for (const f of result.findings) {
      await client.query(
        `insert into vlogops.verification_finding
           (verification_id, ordinal, dimension, severity, rule, detail,
            claim_id, sibling, segment_ordinal, source_ref, evidence)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
        [
          result.verificationId, f.ordinal, f.dimension, f.severity, f.rule, f.detail,
          f.claim_id, f.sibling, f.segment_ordinal, f.source_ref, JSON.stringify(f.evidence),
        ],
      );
    }

    await pause('pre-commit');
    return { deduplicated: false };
  });

  return {
    verificationId: result.verificationId,
    packageId: view.packageId,
    packId: view.packId,
    seedId: view.seedId,
    ruleset: { version: ruleset.version, id: ruleset.id },
    verifierVersion: VERIFIER_VERSION,
    verdict: result.verdict,
    dimensions,
    findings: result.findings,
    findingCount: result.findingCount,
    blockingCount: result.blockingCount,
    surfacedCount: result.surfacedCount,
    manifest: result.manifest,
    deduplicated: written.deduplicated,
  };
}

/**
 * Where a package stands, read from the store rather than from anything this process remembers.
 *
 * THIS IS THE ANSWER THAT SURVIVES A RESTART, because it is entirely a function of rows. A fresh
 * process with no history asks this and gets the same answer the process that ran the
 * verification would have given.
 */
export async function readPackageState(pool, packageId) {
  const state = await pool.query(
    `select package_id, pack_id, seed_id, verification_runs, undisposed_blocks,
            undisposed_surfaced, advanced, advanced_by, advanced_at, advanceable
       from vlogops.package_verification_state where package_id = $1`,
    [packageId],
  );
  if (state.rowCount === 0) return null;

  const open = await pool.query(
    `select f.verification_id, f.ordinal, f.dimension, f.severity, f.rule, f.detail,
            f.claim_id, f.sibling, f.segment_ordinal, f.source_ref
       from vlogops.verification_run r
       join vlogops.verification_finding f on f.verification_id = r.verification_id
       left join vlogops.finding_disposition d
         on d.verification_id = f.verification_id and d.ordinal = f.ordinal
      where r.package_id = $1 and d.verification_id is null
      order by f.severity desc, f.dimension, f.ordinal`,
    [packageId],
  );

  const row = state.rows[0];
  return {
    packageId: row.package_id.trim(),
    packId: row.pack_id.trim(),
    seedId: row.seed_id.trim(),
    verificationRuns: Number(row.verification_runs),
    undisposedBlocks: Number(row.undisposed_blocks),
    undisposedSurfaced: Number(row.undisposed_surfaced),
    advanced: row.advanced,
    advancedBy: row.advanced_by,
    advancedAt: row.advanced_at,
    advanceable: row.advanceable,
    openFindings: open.rows,
  };
}

/**
 * Record a human decision about ONE finding.
 *
 * `overridden` clears a rule violation; `answered` clears a surfaced question. The database
 * refuses the wrong pairing through a foreign key on (verification_id, ordinal, severity), so
 * overruling a failure can never be filed as though it were answering a question.
 *
 * ATTRIBUTION, NOT AUTHENTICATION. `decidedBy` is a name this process was handed. There is no
 * identity system in this service and `credential_scope: none` means there is not going to be one
 * here. What this buys is that the decision is undeniable AFTERWARDS — never that anybody was
 * authorised at the time. Say it that way in every report.
 */
export async function disposeFinding({ pool, verificationId, ordinal, decidedBy, reason, intent = null }) {
  if (typeof decidedBy !== 'string' || decidedBy.trim() === '') {
    const err = new Error('vlogops verify: an override or answer must name who decided it');
    err.code = 'EVLOGOPSVERIFYNODECIDER';
    throw err;
  }
  if (typeof reason !== 'string' || reason.trim() === '') {
    const err = new Error(
      'vlogops verify: an override or answer must carry a reason. "It was overridden and nobody '
      + 'knows why" is not a state this store can reach.',
    );
    err.code = 'EVLOGOPSVERIFYNOREASON';
    throw err;
  }

  const found = await pool.query(
    `select severity from vlogops.verification_finding
      where verification_id = $1 and ordinal = $2`,
    [verificationId, ordinal],
  );
  if (found.rowCount === 0) {
    const err = new Error(`vlogops verify: no finding ${verificationId}#${ordinal}`);
    err.code = 'EVLOGOPSVERIFYNOFINDING';
    throw err;
  }

  const severity = found.rows[0].severity;
  const disposition = severity === 'block' ? 'overridden' : 'answered';

  // ⛔ THE CATEGORY CHECK HAPPENS BEFORE THE WRITE, AND THAT ORDER IS THE WHOLE POINT. ⛔
  //
  // An earlier version of this function wrote the row first and let the caller notice the mismatch
  // afterwards. Driving the real CLI found what that costs: asking to OVERRIDE a surfaced question
  // recorded an ANSWER — attributed to a named person, carrying that person's words as the reason
  // — and then exited non-zero saying the command had failed. A refused command that has already
  // changed durable state, and recorded a decision somebody did not make, is precisely the silent
  // override this phase exists to prevent.
  //
  // So an intent that does not match the finding's severity is refused here, before anything is
  // written. The act is never quietly translated into the other one.
  if (intent !== null && intent !== disposition) {
    const err = new Error(
      `vlogops verify: finding ${verificationId}#${ordinal} is severity "${severity}", so the act `
      + `available on it is "${disposition}", not "${intent}". Overruling a rule violation and `
      + 'answering an unanswered question are different decisions and are not interchangeable. '
      + 'Nothing was recorded.',
    );
    err.code = 'EVLOGOPSVERIFYWRONGACT';
    err.severity = severity;
    err.available = disposition;
    throw err;
  }

  await pool.query(
    `insert into vlogops.finding_disposition
       (verification_id, ordinal, severity, disposition, decided_by, reason)
     values ($1,$2,$3,$4,$5,$6)`,
    [verificationId, ordinal, severity, disposition, decidedBy.trim(), reason.trim()],
  );

  return { verificationId, ordinal, severity, disposition, decidedBy: decidedBy.trim() };
}

/**
 * Advance a package — the operation the gate protects.
 *
 * The INSERT is what advancing means, and db/004's before-insert trigger refuses it while any
 * finding of any run of this package is undisposed. This function does not check first and then
 * insert: that would be a check-then-act race and, worse, it would put the decision back in the
 * application where a future caller could skip it. The database refuses, and this reads the
 * refusal.
 */
export async function advancePackage({ pool, packageId, verificationId, advancedBy }) {
  if (typeof advancedBy !== 'string' || advancedBy.trim() === '') {
    const err = new Error('vlogops verify: advancing a package must name who advanced it');
    err.code = 'EVLOGOPSVERIFYNOACTOR';
    throw err;
  }

  try {
    await pool.query(
      `insert into vlogops.package_advance (package_id, verification_id, advanced_by)
       values ($1,$2,$3)`,
      [packageId, verificationId, advancedBy.trim()],
    );
  } catch (cause) {
    const err = new Error(cause.message);
    err.code = 'EVLOGOPSBLOCKED';
    err.cause = cause;
    throw err;
  }

  return { packageId, verificationId, advancedBy: advancedBy.trim() };
}

/** Record a rights basis a human declares. Append-only; a change of mind is a new package. */
export async function declareRights({
  pool, seedId, sourceRef, basis, holder = null, licenceRef = null, note = null, declaredBy,
}) {
  if (typeof declaredBy !== 'string' || declaredBy.trim() === '') {
    const err = new Error('vlogops verify: a rights declaration must name who declared it');
    err.code = 'EVLOGOPSVERIFYNODECLARER';
    throw err;
  }
  await pool.query(
    `insert into vlogops.source_rights
       (seed_id, source_ref, basis, basis_source, holder, licence_ref, note, declared_by)
     values ($1,$2,$3,'declared',$4,$5,$6,$7)`,
    [seedId, sourceRef, basis, holder, licenceRef, note, declaredBy.trim()],
  );
  return { seedId, sourceRef, basis, basis_source: 'declared' };
}

/**
 * Materialise the DERIVED rights of a seed's estate-origin sources, so the inference is on the
 * record rather than recomputed silently at each verification.
 *
 * It writes `basis_source: derived-from-provenance` and never `declared`. A derived basis that
 * presented itself as a declaration would be a lie in the one field a rights question depends on.
 * Sources it cannot derive are left alone — RIGHT-3 surfaces them, which is the whole point.
 */
export async function deriveRights({ pool, seedId, declaredBy }) {
  if (typeof declaredBy !== 'string' || declaredBy.trim() === '') {
    const err = new Error('vlogops verify: deriving rights must name who ran the derivation');
    err.code = 'EVLOGOPSVERIFYNODECLARER';
    throw err;
  }

  const result = await pool.query(
    `insert into vlogops.source_rights
       (seed_id, source_ref, basis, basis_source, note, declared_by)
     select s.seed_id, s.source_ref, 'estate-owned', 'derived-from-provenance',
            'RIGHT-1: derived from provenance.source_system = ' || (s.provenance->>'source_system'),
            $2
       from vlogops.source_snapshot s
      where s.seed_id = $1
        and s.provenance->>'source_system' in ('git', 'repository', 'fusion247')
        and not exists (
          select 1 from vlogops.source_rights r
           where r.seed_id = s.seed_id and r.source_ref = s.source_ref)
      returning source_ref`,
    [seedId, declaredBy.trim()],
  );

  return { seedId, derived: result.rowCount, sourceRefs: result.rows.map((r) => r.source_ref) };
}
