#!/usr/bin/env node
// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/migrate-command-ledger.js
//
// MOVE THE MACHINE LEDGER OFF THE HUMAN'S TO-DO LIST.
//
//     node --env-file=<env> migrate-command-ledger.js            # DRY RUN
//     node --env-file=<env> migrate-command-ledger.js --apply    # writes
//
// ── WHAT THIS IS FOR ────────────────────────────────────────────────────────
// Before migration 009 the pipeline kept its command / resume / outbox
// bookkeeping in `asdair.pending_action`, namespaced `cmd:` and `msg:`. That is
// the table the Cockpit and the Telegram status card surface to Warwick as
// OUTSTANDING ACTIONS, so machine plumbing read as chores he had to do.
//
// The code no longer writes those rows. THIS SCRIPT DEALS WITH THE ONES ALREADY
// THERE, and it has exactly two obligations:
//
//   NOTHING IS LOST.        Every legacy row is copied into
//                           asdair.pipeline_command with its status, its
//                           payload, its original timestamps and a pointer back
//                           to the pending_action row it came from.
//   NOTHING IS MISREAD.     Every legacy row that was still `pending` - i.e.
//                           every one a surface would have shown Warwick as an
//                           outstanding action - is RETIRED (status
//                           'abandoned') with a note saying where it went. It
//                           stays in the table as history; it just stops
//                           claiming to be a chore.
//
// Legacy rows that were ALREADY `done` or `abandoned` are copied but left
// untouched: every surface filters on status = 'pending', so they were never
// misread in the first place, and rewriting settled history to tidy it would be
// the more destructive choice.
//
// ── IDEMPOTENT AND RE-RUNNABLE ──────────────────────────────────────────────
// Run it once, run it five times, run it after a crash half way through - the
// end state is the same. Two independent guards, and BOTH are decided by the
// database inside the insert statement rather than by a check in this file:
//
//   1. `WHERE NOT EXISTS (... result->>'migrated_from_pending_action' = <id>)`
//      A row that has already been carried over is never carried over again.
//   2. `ON CONFLICT (idempotency_key) DO NOTHING`
//      migration 009's UNIQUE index, as the backstop.
//
// Retiring the source is `WHERE id = $ AND status = 'pending'`, so a second run
// matches nothing and writes nothing.
//
// ── WHAT THIS SCRIPT WILL NOT DO ────────────────────────────────────────────
// It does not create, alter or drop anything - migration 009 is applied
// separately and this refuses to run until it is. It never DELETEs. It reads no
// credentials file: the two connection strings arrive as ASDAIR_DB_URL and
// ASDAIR_WRITE_DB_URL through `node --env-file=`, and only their NAMES appear
// in this source. It is DRY RUN by default; `--apply` is a deliberate act.
//
// RUN IT WITH THE RUNTIME LOOP STOPPED. The generation each carried-over row
// receives is derived from what is already in the ledger, so a runtime recording
// new commands underneath it would be racing the backfill for the same numbers.
// A session advisory lock below stops two copies of THIS script colliding; it
// cannot stop a runtime, and nothing here pretends otherwise.
// =====================================================================

import { LEDGER_KINDS, LEGACY_COMMAND_PREFIX, LEGACY_OUTBOX_PREFIX, ledgerFamilyKey, ledgerIdempotencyKey } from './keys.js';
import { spentLedgerGenerations } from './store.js';

/** How migration 006's `status` vocabulary maps onto migration 009's CHECK. */
const STATUS_MAP = Object.freeze({
  pending: 'pending',
  done: 'done',
  abandoned: 'retired',
});

const SELECT_LEGACY_ROWS_SQL =
  `SELECT id, household_id, shop_id, action_type, action_key, payload, status, note, created_at, resolved_at
     FROM asdair.pending_action
    WHERE action_type LIKE $1 OR action_type LIKE $2
    ORDER BY id ASC`;

/**
 * The carry-over insert.
 *
 * INSERT ... SELECT ... WHERE NOT EXISTS rather than a check in JavaScript,
 * because "has this source row already been migrated?" and "write it" must be
 * one statement or a re-run started twice could double-write.
 */
// Every parameter is cast EXPLICITLY. In an INSERT ... SELECT the target column
// list is not what resolves an untyped parameter, so leaving the timestamps
// bare would be relying on inference that is not guaranteed to be there.
const INSERT_MIGRATED_SQL =
  `INSERT INTO asdair.pipeline_command (shop_id, kind, command, args, idempotency_key, status, result, created_at, updated_at)
   SELECT $1::bigint, $2::text, $3::text, $4::jsonb, $5::text, $6::text, $7::jsonb, $8::timestamptz, $9::timestamptz
    WHERE NOT EXISTS (
      SELECT 1 FROM asdair.pipeline_command WHERE result->>'migrated_from_pending_action' = $10::text
    )
   ON CONFLICT (idempotency_key) DO NOTHING
   RETURNING id, idempotency_key`;

/** Retire the source row so no surface can ever show it as a chore again. The
 *  original note is KEPT and the pointer appended - history, not erasure. */
const RETIRE_LEGACY_ROW_SQL =
  `UPDATE asdair.pending_action
      SET status = 'abandoned',
          note = coalesce(note || ' | ', '') || $1,
          resolved_at = coalesce(resolved_at, now())
    WHERE id = $2 AND status = 'pending'
    RETURNING id`;

function asObject(value) {
  if (value === null || value === undefined) return {};
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return {}; }
  }
  return typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function rowsOf(result) {
  return (result && result.rows) || [];
}

/** PURE. Split a legacy `action_type` into the ledger kind and the name. */
export function classifyLegacyActionType(actionType) {
  const t = String(actionType ?? '');
  if (t.startsWith(LEGACY_COMMAND_PREFIX)) {
    return { kind: LEDGER_KINDS.COMMAND, name: t.slice(LEGACY_COMMAND_PREFIX.length) };
  }
  if (t.startsWith(LEGACY_OUTBOX_PREFIX)) {
    return { kind: LEDGER_KINDS.OUTBOX, name: t.slice(LEGACY_OUTBOX_PREFIX.length) };
  }
  return null;
}

/**
 * THE BACKFILL.
 *
 * @param {{readQuery:Function, writeQuery:Function}} deps
 * @param {{apply?:boolean, log?:Function}} options  `apply:false` (the default)
 *        reads and REPORTS ONLY - not one statement that writes is issued.
 */
export async function migrateCommandLedger(deps, { apply = false, log = () => {} } = {}) {
  await assertMigration009Applied(deps);

  const legacy = rowsOf(await deps.readQuery(SELECT_LEGACY_ROWS_SQL,
    [`${LEGACY_COMMAND_PREFIX}%`, `${LEGACY_OUTBOX_PREFIX}%`]));

  // How many generations of each family are already spent. Read ONCE per family
  // and then tracked locally, so the generations this run mints are contiguous
  // whether or not it is actually writing - which is what makes the dry run an
  // honest rehearsal of the apply rather than a different calculation.
  const spent = new Map();
  const report = {
    ok: true,
    applied: apply,
    scanned: legacy.length,
    moved: [],
    already_migrated: [],
    retired: [],
    failed: [],
  };

  for (const row of legacy) {
    try {
      const classified = classifyLegacyActionType(row.action_type);
      if (!classified) continue;   // the SELECT cannot return one, but never assume

      const family = ledgerFamilyKey({
        kind: classified.kind,
        householdId: row.household_id,
        name: classified.name,
        key: row.action_key,
      });
      if (!spent.has(family)) spent.set(family, await spentLedgerGenerations(deps, family));

      const status = STATUS_MAP[row.status];
      if (!status) {
        throw new Error(`pending_action ${row.id} carries status "${row.status}", which migration 009 has no equivalent for`);
      }

      const generation = spent.get(family);
      const idempotencyKey = ledgerIdempotencyKey(family, generation);
      // A row that arrives already finished SPENDS its generation; a row that is
      // still pending does not, so the next live issue of that command adopts it
      // exactly as it would have before the move.
      if (status !== 'pending') spent.set(family, generation + 1);

      const args = {
        ...asObject(row.payload),
        ledger_key: family,
        // The old `action_key`, kept under the name store.js reads, because
        // runPipeline derives a downstream `add_list_item` idempotency key from
        // it. A carried-over correction must produce the same one it always did.
        ledger_action_key: String(row.action_key),
        household_id: row.household_id,
      };
      const result = {
        migrated_from_pending_action: String(row.id),
        legacy_action_type: row.action_type,
        legacy_status: row.status,
        note: row.note ?? null,
      };

      if (!apply) {
        report.moved.push({
          pending_action_id: row.id, idempotency_key: idempotencyKey, status, planned: true,
        });
        if (row.status === 'pending') report.retired.push({ pending_action_id: row.id, planned: true });
        continue;
      }

      const inserted = rowsOf(await deps.writeQuery(INSERT_MIGRATED_SQL, [
        row.shop_id ?? null, classified.kind, classified.name, JSON.stringify(args),
        idempotencyKey, status, JSON.stringify(result),
        row.created_at, row.resolved_at || row.created_at, String(row.id),
      ]))[0];

      if (!inserted) {
        // Already carried over by an earlier run (or the UNIQUE index refused a
        // duplicate key). Either way there is nothing to write - but the source
        // row may still need retiring if the previous run stopped between the
        // two statements.
        report.already_migrated.push({ pending_action_id: row.id, idempotency_key: idempotencyKey });
        // A generation was not consumed by us after all; put it back.
        if (status !== 'pending') spent.set(family, generation);
      } else {
        report.moved.push({
          pending_action_id: row.id,
          pipeline_command_id: inserted.id,
          idempotency_key: inserted.idempotency_key,
          status,
        });
      }

      const retired = rowsOf(await deps.writeQuery(RETIRE_LEGACY_ROW_SQL, [
        `retired by migrate-command-ledger: this is machine bookkeeping, not a household action - it now lives in asdair.pipeline_command as ${idempotencyKey}`,
        row.id,
      ]))[0];
      if (retired) report.retired.push({ pending_action_id: row.id });

      log('migrated', { pending_action_id: row.id, idempotency_key: idempotencyKey, status });
    } catch (err) {
      report.ok = false;
      report.failed.push({
        pending_action_id: row.id,
        action_type: row.action_type,
        error: String(err && err.message ? err.message : err),
      });
    }
  }

  return report;
}

/** Refuse to touch anything until migration 009 is actually applied here. A
 *  backfill that ran against a database without the destination table would
 *  report success having moved nothing. */
async function assertMigration009Applied(deps) {
  const res = await deps.readQuery("SELECT to_regclass('asdair.pipeline_command') AS table_name");
  const found = rowsOf(res)[0];
  if (!found || !found.table_name) {
    throw new Error('migrate-command-ledger: asdair.pipeline_command does not exist. Apply services/asdair/db/009_pipeline_command_and_question_render.sql first.');
  }
  return true;
}

// ---------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------

/** An arbitrary but STABLE key, so two copies of this script serialise. */
const ADVISORY_LOCK_KEY = 150015;

async function main() {
  const apply = process.argv.includes('--apply');
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const { Pool } = require('pg');

  const readUrl = process.env.ASDAIR_DB_URL;
  const writeUrl = process.env.ASDAIR_WRITE_DB_URL;
  if (!readUrl) throw new Error('ASDAIR_DB_URL is not set (the asdair READ connection string).');
  if (!writeUrl) throw new Error('ASDAIR_WRITE_DB_URL is not set (the asdair WRITE connection string).');

  const readPool = new Pool({ connectionString: readUrl });
  const writePool = new Pool({ connectionString: writeUrl });
  const writeClient = await writePool.connect();

  const deps = {
    async readQuery(sql, params) {
      const client = await readPool.connect();
      try {
        await client.query('BEGIN TRANSACTION READ ONLY');
        const res = await client.query(sql, params);
        await client.query('COMMIT');
        return res;
      } catch (err) {
        try { await client.query('ROLLBACK'); } catch { /* no-op */ }
        throw err;
      } finally {
        client.release();
      }
    },
    async writeQuery(sql, params) {
      await writeClient.query('BEGIN');
      try {
        const res = await writeClient.query(sql, params);
        await writeClient.query('COMMIT');
        return res;
      } catch (err) {
        try { await writeClient.query('ROLLBACK'); } catch { /* no-op */ }
        throw err;
      }
    },
  };

  try {
    // Session-level, so it is held across the individual statement
    // transactions above. Guards against two copies of THIS script; it cannot
    // guard against the runtime, which must be stopped.
    if (apply) await writeClient.query('SELECT pg_advisory_lock($1)', [ADVISORY_LOCK_KEY]);
    const report = await migrateCommandLedger(deps, {
      apply,
      log: (event, detail) => console.log(JSON.stringify({ event, ...detail })),
    });
    console.log(JSON.stringify(report, null, 1));
    if (!apply) {
      console.log('\nDRY RUN - nothing was written. Re-run with --apply to carry these rows over.');
    }
    if (!report.ok) process.exitCode = 1;
  } finally {
    try { if (apply) await writeClient.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]); } catch { /* no-op */ }
    writeClient.release();
    await Promise.allSettled([readPool.end(), writePool.end()]);
  }
}

const isCli = process.argv[1] && process.argv[1].endsWith('migrate-command-ledger.js');
if (isCli) {
  main().catch((e) => { console.error('migrate-command-ledger error:', e.message); process.exit(1); });
}
