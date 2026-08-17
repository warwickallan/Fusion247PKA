// BUILD-006 Phase 2 — the Source Compiler: the seal, and the read-back.
//
// This module is the only place in Phase 2 that touches the database, and it is deliberately
// thin. Every decision about what belongs in a pack, in what order, and what the pack IS was
// already made by `pack.mjs`, which cannot reach a clock or a socket. What is left here is
// reading frozen rows, writing them in one transaction, and being able to prove afterwards
// that what was written is still what it says it is.
//
// ── WHY A LATER SOURCE FAILURE CANNOT REACH AN EXISTING PACK ────────────────────────────
// The compiler NEVER re-reads an original artefact. Not once, not as a fallback, not to
// "refresh" anything. Its only input is the bytes Phase 1 froze into source_snapshot at
// intake, which 001's trigger makes immutable. So the answer to "what happens to an existing
// pack when a source is edited, corrupted or deleted afterwards" is: nothing, by
// construction. There is no code path along which the disk could influence a compiled pack,
// which is a stronger statement than any test could make on its own — the tests then go and
// break real sources to show the claim survives contact with reality.
//
// ── WHY A KILL MID-COMPILE CANNOT LEAVE A HALF-PACK ─────────────────────────────────────
// The pack row, every one of its entries and the ledger row are written inside ONE
// transaction, exactly as Phase 1's intake does. Killed before COMMIT: nothing. Killed
// after: one complete pack. There is no third state, so there is no reconciler, no lease and
// no recovery pass — the same design Phase 1 proved, inherited rather than re-invented.

import {
  COMPILER_VERSION,
  MANIFEST_ALGO,
  PACK_ORDERING_RULE_VERSION,
  PACK_SELECTION_RULE_VERSION,
} from './config.mjs';
import { withTransaction } from './db.mjs';
import {
  buildPackManifest,
  compileAttemptKey,
  packDocument,
  packIdentity,
  planPack,
} from './pack.mjs';
import { verifySnapshotIntegrity } from './snapshot.mjs';

const SNAPSHOT_COLUMNS = `seed_id, source_ref, content_sha256, byte_length, media_type,
                          provenance, privacy_state, captured_at`;

/**
 * Compile one seed into a durable evidence pack.
 *
 * Returns { packId, deduplicated, entryCount, bounded, manifest, document, omitted }.
 * `deduplicated: true` means this exact pack already existed and nothing was written —
 * which is the correct, quiet outcome of compiling the same seed twice, and of every
 * restart after an abrupt kill.
 */
export async function compileEvidencePack({ pool, seedId, maxEntries, maxBytes, hooks = {} }) {
  if (typeof seedId !== 'string' || !/^[0-9a-f]{64}$/.test(seedId)) {
    const err = new Error(`vlogops: seed_id must be a 64-character lowercase hex string (got ${seedId})`);
    err.code = 'EVLOGOPSBADSEEDID';
    throw err;
  }

  const startedAtIso = new Date().toISOString();

  // The same narrow test affordance Phase 1 uses, and for the same reason: it parks a real
  // process inside a real open transaction so an external kill lands in a known window. It
  // injects no failure, fakes nothing, and changes no code path.
  const pause = async (stage) => { if (hooks.onStage) await hooks.onStage(stage); };

  return withTransaction(pool, async (client) => {
    await pause('transaction-open');

    // Read the seed and its frozen snapshots inside the transaction, so the whole compile
    // sees one consistent view of the store. Ordered by source_ref for a stable read; the
    // pack's own ordering is decided by pack.mjs and does not depend on this at all.
    const seed = await client.query(
      'select seed_id, route, angle from vlogops.content_seed where seed_id = $1',
      [seedId],
    );
    if (seed.rowCount === 0) {
      const err = new Error(
        `vlogops: no seed ${seedId}. A pack is compiled FROM a sealed seed; there is no path `
        + 'that invents one.',
      );
      err.code = 'EVLOGOPSNOSEED';
      throw err;
    }

    const snaps = await client.query(
      `select ${SNAPSHOT_COLUMNS} from vlogops.source_snapshot
        where seed_id = $1 order by source_ref`,
      [seedId],
    );
    if (snaps.rowCount === 0) {
      const err = new Error(`vlogops: seed ${seedId} has no snapshots to compile`);
      err.code = 'EVLOGOPSNOSNAPSHOTS';
      throw err;
    }

    const plan = planPack({ snapshots: snaps.rows, maxEntries, maxBytes });
    const manifest = buildPackManifest({
      seedId,
      entries: plan.entries,
      omitted: plan.omitted,
      budget: { maxEntries, maxBytes },
    });
    const packId = packIdentity(manifest);

    const inserted = await client.query(
      `insert into vlogops.evidence_pack
         (pack_id, seed_id, compiler_version, selection_rule_version, ordering_rule_version,
          manifest_algo, manifest, budget, omitted, entry_count, entry_bytes, bounded)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11, $12)
       on conflict (pack_id) do nothing
       returning pack_id`,
      [
        packId,
        seedId,
        COMPILER_VERSION,
        PACK_SELECTION_RULE_VERSION,
        PACK_ORDERING_RULE_VERSION,
        MANIFEST_ALGO,
        JSON.stringify(manifest),
        JSON.stringify({ max_entries: maxEntries, max_bytes: maxBytes }),
        JSON.stringify(plan.omitted),
        plan.entries.length,
        plan.entryBytes,
        plan.bounded,
      ],
    );

    const deduplicated = inserted.rowCount === 0;

    await pause('pack-inserted');

    if (!deduplicated) {
      for (const e of plan.entries) {
        await client.query(
          `insert into vlogops.evidence_pack_entry
             (pack_id, seed_id, ordinal, source_ref, content_sha256, byte_length,
              media_type, occurred_at, occurred_at_basis, provenance)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
          [
            packId,
            seedId,
            e.ordinal,
            e.source_ref,
            e.content_sha256,
            e.byte_length,
            e.media_type,
            e.occurred_at,
            e.occurred_at_basis,
            JSON.stringify(e.provenance),
          ],
        );
        await pause('entry-written');
      }
    }

    await client.query(
      `insert into vlogops.compile_run (pack_id, attempt_key, seed_id, outcome, entry_count)
       values ($1, $2, $3, $4, $5)
       on conflict (pack_id, attempt_key) do nothing`,
      [
        packId,
        compileAttemptKey({ packId, startedAtIso, pid: process.pid }),
        seedId,
        deduplicated ? 'deduplicated' : 'compiled',
        plan.entries.length,
      ],
    );

    await pause('pre-commit');

    return {
      packId,
      seedId,
      deduplicated,
      entryCount: plan.entries.length,
      entryBytes: plan.entryBytes,
      bounded: plan.bounded,
      omitted: plan.omitted,
      candidateCount: plan.candidateCount,
      manifest,
      document: packDocument({ packId, manifest }),
    };
  });
}

/** Read a pack and its entries back. Stored rows only; no source is ever revisited. */
export async function readPack(pool, packId) {
  const pack = await pool.query(
    `select pack_id, seed_id, compiler_version, selection_rule_version, ordering_rule_version,
            manifest_algo, manifest, budget, omitted, entry_count, entry_bytes, bounded, created_at
       from vlogops.evidence_pack where pack_id = $1`,
    [packId],
  );
  if (pack.rowCount === 0) return null;

  const entries = await pool.query(
    `select pack_id, seed_id, ordinal, source_ref, content_sha256, byte_length,
            media_type, occurred_at, occurred_at_basis, provenance
       from vlogops.evidence_pack_entry where pack_id = $1 order by ordinal`,
    [packId],
  );

  return { pack: pack.rows[0], entries: entries.rows };
}

/**
 * VERIFY A PACK WITHOUT TRUSTING ANYTHING THAT WROTE IT.
 *
 * Three independent questions, and a pack is only whole if all three answer yes:
 *
 *   1. Does the stored manifest still hash to the pack's own id? (identity is recomputable
 *      from the row, so nobody has to take the compiler's word for it)
 *   2. Does every entry resolve to a snapshot Phase 1 actually froze, under this seed?
 *   3. Do those snapshots' STORED BYTES still hash to what the entry claims?
 *
 * Question 3 reads only stored bytes and never goes near the original artefact — which is
 * exactly why the answer is still meaningful after that artefact has been edited or deleted.
 */
export async function verifyPack(pool, packId) {
  const found = await readPack(pool, packId);
  if (found === null) {
    return { ok: false, packId, problems: ['pack not found'], entriesVerified: 0 };
  }

  const { pack, entries } = found;
  const problems = [];

  const recomputed = packIdentity(pack.manifest);
  if (recomputed !== pack.pack_id.trim()) {
    problems.push(`stored manifest hashes to ${recomputed}, not to the pack id ${pack.pack_id}`);
  }
  if (entries.length !== pack.entry_count) {
    problems.push(`pack claims ${pack.entry_count} entries and holds ${entries.length}`);
  }

  let entriesVerified = 0;
  for (const e of entries) {
    const snap = await pool.query(
      `select ${SNAPSHOT_COLUMNS}, content from vlogops.source_snapshot
        where seed_id = $1 and source_ref = $2`,
      [e.seed_id, e.source_ref],
    );
    if (snap.rowCount === 0) {
      problems.push(`entry ${e.ordinal} (${e.source_ref}) has no snapshot`);
      continue;
    }
    const row = snap.rows[0];
    const integrity = verifySnapshotIntegrity(row);
    if (!integrity.ok) {
      problems.push(
        `entry ${e.ordinal} (${e.source_ref}) failed integrity: stored bytes hash to `
        + `${integrity.actual_sha256}, row claims ${integrity.expected_sha256}`,
      );
      continue;
    }
    if (row.content_sha256.trim() !== e.content_sha256.trim()) {
      problems.push(`entry ${e.ordinal} (${e.source_ref}) disagrees with its snapshot's hash`);
      continue;
    }
    entriesVerified += 1;
  }

  return {
    ok: problems.length === 0 && entriesVerified === entries.length && entries.length > 0,
    packId: pack.pack_id.trim(),
    seedId: pack.seed_id.trim(),
    entryCount: pack.entry_count,
    entriesVerified,
    bounded: pack.bounded,
    problems,
  };
}
