// BUILD-006 Phase 1 — the intake seal. All three routes converge here.
//
// This is the file that makes "kill it mid-intake and it recovers" true, and it does so by
// removing the failure rather than by handling it. The seed, every one of its snapshots and
// its ledger row are written inside ONE transaction. The database therefore has exactly two
// possible outcomes at any instant:
//
//   killed before COMMIT  ->  nothing. No seed, no snapshot, no partial row.
//   killed after  COMMIT  ->  one complete seed, sealed, with all of its snapshots.
//
// There is no third state, so there is nothing for a recovery pass to reconcile and no
// reconciler is built. A restart simply runs the intake again: the identity is a function
// of content, so it recomputes to the same 64 characters, and ON CONFLICT DO NOTHING turns
// the second write into a no-op that returns the existing seed. Recovery is a property of
// the design, not a subsystem.
//
// DEDUPE IS THE DATABASE'S JOB, NOT THIS PROCESS'S. Nothing here consults an in-memory set
// of "seeds I have seen". Two processes racing on the same source both attempt the insert
// and the primary key decides; the loser is told it deduplicated.

import { attemptKey, buildManifest, seedIdentity, selectionKey } from './identity.mjs';
import { withTransaction } from './db.mjs';

const VALID_ROUTES = new Set(['records', 'promotion', 'supplied']);

/**
 * Validate a seed against its route's contract BEFORE anything is written.
 *
 * The database enforces the same rules as CHECK constraints and is the real backstop; this
 * exists so a caller gets a usable message naming the missing field rather than a
 * constraint violation. A promotion missing any of its five contract fields is REJECTED —
 * it never becomes a partial seed that a later reader mistakes for a whole one.
 */
export function validateSeedRequest({ route, angle, origin, members, privacyState }) {
  const problems = [];

  if (!VALID_ROUTES.has(route)) {
    problems.push(`route must be one of ${[...VALID_ROUTES].join(', ')} (got ${route})`);
  }
  if (!Array.isArray(members) || members.length === 0) {
    problems.push('a seed must carry at least one source snapshot');
  }
  if (!privacyState) {
    problems.push('privacy_state is required on every seed');
  }

  if (route === 'promotion') {
    // The five-field promotion contract: source snapshot, provenance, privacy state,
    // origin, proposed angle. Snapshot and provenance are checked above and in the
    // snapshot layer; the two that are this route's own are checked here.
    if (!origin || String(origin).trim() === '') {
      problems.push('a promotion requires `origin` — which Fusion247 output it came from');
    }
    if (!angle || String(angle).trim() === '') {
      problems.push('a promotion requires `angle` — the proposed angle is part of the promotion contract');
    }
  }

  if (route === 'supplied' && (!angle || String(angle).trim() === '')) {
    // The angle is REQUIRED INPUT and is never inferred from the text. Inferring it would
    // be this service quietly deciding what Warwick meant, which is the one thing the
    // route exists to stop.
    problems.push('a supplied seed requires `angle` — the angle or question is required input and is never inferred from the text');
  }

  if (problems.length > 0) {
    const err = new Error(`vlogops: seed rejected\n  - ${problems.join('\n  - ')}`);
    err.code = 'EVLOGOPSSEEDREJECTED';
    err.problems = problems;
    throw err;
  }
}

/**
 * Seal a seed and its snapshots durably.
 *
 * Returns { seedId, deduplicated, memberCount, manifest }. `deduplicated: true` means the
 * seed already existed and nothing was written — which is the correct, quiet outcome of
 * taking the same source in twice, and of every restart after an abrupt kill.
 */
export async function intake({
  pool,
  route,
  selector = null,
  angle = null,
  origin = null,
  privacyState,
  members,
  selection = null,
  hooks = {},
}) {
  validateSeedRequest({ route, angle, origin, members, privacyState });

  const manifest = buildManifest({ route, angle, members });
  const seedId = seedIdentity(manifest);
  const selKey = selectionKey({ route, selector, angle });
  const startedAtIso = new Date().toISOString();

  // A test hook, and the ONLY thing in this module that exists for the tests. It lets the
  // AC7 proof park a real child process at a chosen instant so an external SIGKILL lands
  // in a known window. It injects no failure and fakes nothing: the kill is real, the
  // transaction is real, and what is being proven is what the database does about it.
  const pause = async (stage) => { if (hooks.onStage) await hooks.onStage(stage); };

  return withTransaction(pool, async (client) => {
    await pause('transaction-open');

    const inserted = await client.query(
      `insert into vlogops.content_seed
         (seed_id, selection_key, route, angle, origin, privacy_state,
          manifest, manifest_algo, selection, status, sealed_at)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::jsonb, 'sealed', now())
       on conflict (seed_id) do nothing
       returning seed_id`,
      [
        seedId,
        selKey,
        route,
        manifest.angle,
        origin,
        privacyState,
        JSON.stringify(manifest),
        'sha256-canonical-json-v1',
        selection === null ? null : JSON.stringify(selection),
      ],
    );

    const deduplicated = inserted.rowCount === 0;

    await pause('seed-inserted');

    if (!deduplicated) {
      for (const m of members) {
        await client.query(
          `insert into vlogops.source_snapshot
             (seed_id, source_ref, content_sha256, byte_length, media_type,
              content, content_url, provenance, privacy_state)
           values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)`,
          [
            seedId,
            m.source_ref,
            m.content_sha256,
            m.byte_length,
            m.media_type,
            m.content,
            m.content_url,
            JSON.stringify(m.provenance),
            m.privacy_state,
          ],
        );
        await pause('snapshot-written');
      }
    }

    await client.query(
      `insert into vlogops.intake_run
         (seed_id, attempt_key, route, outcome, member_count)
       values ($1, $2, $3, $4, $5)
       on conflict (seed_id, attempt_key) do nothing`,
      [
        seedId,
        attemptKey({ seedId, startedAtIso, pid: process.pid }),
        route,
        deduplicated ? 'deduplicated' : 'sealed',
        members.length,
      ],
    );

    await pause('pre-commit');

    return { seedId, deduplicated, memberCount: members.length, manifest };
  });
}

/** Read a seed and its snapshots back. Reads stored bytes only; never revisits a source. */
export async function readSeed(pool, seedId) {
  const seed = await pool.query(
    `select seed_id, selection_key, route, angle, origin, privacy_state,
            manifest, manifest_algo, selection, status, supersedes, created_at, sealed_at
       from vlogops.content_seed where seed_id = $1`,
    [seedId],
  );
  if (seed.rowCount === 0) return null;

  const snapshots = await pool.query(
    `select seed_id, source_ref, content_sha256, byte_length, media_type,
            content, content_url, provenance, privacy_state, captured_at
       from vlogops.source_snapshot where seed_id = $1 order by source_ref`,
    [seedId],
  );

  return { seed: seed.rows[0], snapshots: snapshots.rows };
}
