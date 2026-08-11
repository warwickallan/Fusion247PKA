// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/test/dbSafeTarget.mjs
//
// WO-2026-08-11-B15-VISION-01. Shared SAFETY GATING for this Work Order's
// DB-gated proofs (provenanceConstraints.dbtest.js, lineProvenance.dbtest.js,
// shopImageRegions.dbtest.js). An ESM port of the identical, already-proven
// pattern in services/asdair/skill/test/dbSafeTarget.js (read there for
// reference per "match the nearest sibling's conventions" - not imported
// directly: skill/** is outside this Work Order's file_surface, and a
// cross-service require would add an undeclared dependency edge for no
// benefit over a small, self-contained port).
//
// TWO INDEPENDENT LAYERS, exactly as the original:
//   PRIMARY, positive opt-in: destructiveTestsEnabled() - true only when
//     ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE is exactly "1" or "true".
//   SECONDARY, defence-in-depth: assertSafeDbTarget(url) - refuses (throws)
//     an obviously-live host even after the opt-in passes.
//
// PURE ASCII only.
// =====================================================================

'use strict';

export const DESTRUCTIVE_OPT_IN_VAR = 'ASDAIR_DB_TEST_ALLOW_DESTRUCTIVE';

/** PRIMARY GATE. True only for an EXACT "1" or "true" - no fuzzy truthiness. */
export function destructiveTestsEnabled() {
  const raw = process.env[DESTRUCTIVE_OPT_IN_VAR];
  return raw === '1' || raw === 'true';
}

/**
 * SECONDARY / DEFENCE-IN-DEPTH. Refuses (throws) an obviously-live target
 * even once opted in. Only host/db-name are inspected; credentials are
 * never read out or logged.
 * @param {string} rawUrl
 */
export function assertSafeDbTarget(rawUrl) {
  try {
    const params = new URL(rawUrl).searchParams;
    if (params.has('host') || params.has('port')) {
      throw new Error(
        'REFUSING to run: ASDAIR_DB_URL carries a host/port query parameter, which pg uses '
        + 'to override the URL host - this could redirect the connection to a live DB. Refusing this ambiguous target.',
      );
    }
  } catch (e) {
    if (e && e.message && e.message.indexOf('REFUSING to run') === 0) throw e;
  }

  let host = '';
  let dbName = '';
  try {
    const u = new URL(rawUrl);
    host = (u.hostname || '').toLowerCase();
    dbName = (u.pathname || '').replace(/^\//, '').toLowerCase();
  } catch (e) {
    throw new Error('ASDAIR_DB_URL is not a parseable connection string; refusing to run the DB test.');
  }

  if (host.indexOf('supabase') !== -1 || host.indexOf('pooler') !== -1) {
    throw new Error(
      'REFUSING to run: ASDAIR_DB_URL host looks like live Supabase / a pooler ("' + host
      + '"). This test only ever runs against a throwaway / local Postgres, never live data.',
    );
  }

  const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1'];
  let isLocal;
  if (host === '') {
    if (process.env.PGHOST) {
      throw new Error(
        'REFUSING to run: ASDAIR_DB_URL resolves to an empty host while PGHOST is set, so pg would connect '
        + 'to PGHOST - which may be remote/live and this guard cannot vet. Set an explicit local host instead.',
      );
    }
    isLocal = true;
  } else {
    isLocal = LOCAL_HOSTS.indexOf(host) !== -1;
  }

  const isTestDb = dbName.endsWith('_test') || dbName.startsWith('asdair_test_');
  if (!isLocal && !isTestDb) {
    throw new Error(
      'REFUSING to run: ASDAIR_DB_URL must point at localhost/127.0.0.1/::1 or a *_test database (throwaway only). '
      + 'Got host "' + host + '". This test never runs against a remote/live DB.',
    );
  }
}
