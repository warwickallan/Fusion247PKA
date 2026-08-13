// =====================================================================
// BUILD-015 AsdAIr - handoff/test/claimWorker.js
//
// WO-2026-08-13-12 (WP-B15-44), AC6. A REAL, SEPARATE OS PROCESS that claims a
// browser build request and then holds it.
//
// This exists because durability is a claim about the FUTURE, and the only
// honest way to test it is to kill the thing and see what survives. An
// in-process fake cannot be SIGKILLed, and a fake store cannot demonstrate that
// the lease lives on the DATABASE clock rather than in someone's heap.
//
// Usage (driven by readReconciled.dbtest.js, never by a human):
//   node test/claimWorker.js <shopId> <writerId> <leaseMs> [--hold]
//
// It prints one JSON line to stdout and then, with --hold, blocks forever
// waiting to be killed. It NEVER checks out, pays, books a slot or touches a
// browser: it writes one claim row to a throwaway Postgres and waits.
//
// PURE ASCII SOURCE ONLY.
// =====================================================================
'use strict';

const { claimHandoff, reportProgress, peekHandoff } = require('../claim');

const [shopIdArg, writerId, leaseMsArg, ...flags] = process.argv.slice(2);
const shopId = Number(shopIdArg);
const leaseMs = Number(leaseMsArg);
const hold = flags.includes('--hold');

const url = process.env.ASDAIR_WRITE_DB_URL;
if (!url) {
  process.stderr.write('claimWorker: ASDAIR_WRITE_DB_URL is not set\n');
  process.exit(2);
}

async function main() {
  // Lazy require, exactly as every other DB-touching file in this service does,
  // so the module still loads on a box with no dependencies installed.
  const { Client } = require('pg');
  const client = new Client({ connectionString: url });
  await client.connect();
  const query = (text, params) => client.query(text, params);

  try {
    const claimed = await claimHandoff(query, { shopId, writerId, leaseMs });
    if (!claimed) {
      process.stdout.write(`${JSON.stringify({ claimed: false, writerId })}\n`);
      return;
    }

    // Do a unit of work and record it durably. This is the "position" that must
    // survive the kill: line 1 has been shopped, and the revived writer must
    // not shop it again.
    await reportProgress(query, {
      requestId: claimed.id,
      writerId,
      progress: { lines_done: [1], last_seq: 1 },
    });

    const after = await peekHandoff(query, { requestId: claimed.id });
    process.stdout.write(`${JSON.stringify({
      claimed: true, requestId: claimed.id, writerId,
      progress: after.progress, status: after.status,
    })}\n`);

    if (hold) {
      // Hold the claim open and wait to be killed. No graceful shutdown handler
      // on purpose: a process that tidies up on the way out is not the failure
      // mode being tested. Real crashes do not run finally blocks.
      await new Promise(() => {});
    }
  } finally {
    if (!hold) await client.end();
  }
}

main().catch((e) => {
  process.stderr.write(`claimWorker: ${e && e.message}\n`);
  process.exit(1);
});
