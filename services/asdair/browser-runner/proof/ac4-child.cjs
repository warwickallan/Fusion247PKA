#!/usr/bin/env node
// =====================================================================
// BUILD-015 AsdAIr WO-2026-08-19-01 AC4 - THE KILLABLE WORKER.
//
// A real OS process that claims a real lease on a real Postgres row, writes
// real durable progress, and is designed to be SIGKILLed halfway through.
//
// It uses the SHIPPING lease module verbatim - services/asdair/browser-runner/
// lease.cjs - because the point of the proof is that THAT code survives a kill,
// not that a re-implementation of it does.
//
//   node ac4-child.cjs --dsn <url> --request-id N --runner-id X
//                      --lease-ms M --steps K --step-ms D [--no-progress]
//
// Exit codes are the proof's vocabulary and are deliberately distinct:
//   0  ran to completion (the parent normally kills it long before this)
//   3  COULD NOT CLAIM - a live lease is held by someone else
//   4  the lease was lost mid-run (LeaseLostError) - fencing worked
//   1  anything else
//
// --no-progress is the MUTATION arm: it claims and works but never persists a
// step, so a later process has nothing to resume from. The proof must fail in
// that arm or it is not measuring resumption.
//
// NO CREDENTIALS FILE IS OPENED. The DSN arrives on argv from the harness,
// which builds it for a throwaway local cluster. Nothing here reaches the
// household database, and nothing here can: it is given one connection string
// and has no fallback.
// =====================================================================
'use strict';

const path = require('node:path');

const lease = require(path.join(__dirname, '..', 'lease.cjs'));

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
}
const flag = (name) => process.argv.includes(`--${name}`);

function say(...parts) {
  process.stdout.write(`${parts.join(' ')}\n`);
}

async function main() {
  const dsn = arg('dsn');
  const requestId = arg('request-id');
  const runnerId = arg('runner-id');
  const leaseMs = Number(arg('lease-ms', '3000'));
  const steps = Number(arg('steps', '10'));
  const stepMs = Number(arg('step-ms', '300'));
  const noProgress = flag('no-progress');

  if (!dsn || !requestId || !runnerId) {
    say('CHILD-ERROR missing --dsn, --request-id or --runner-id');
    process.exit(1);
  }

  // `pg` is resolved from NODE_PATH, which the harness sets. It is a declared
  // dependency of this package that is simply not installed in every checkout;
  // failing loudly here beats a mystery further down.
  let Client;
  try { ({ Client } = require('pg')); } catch (e) {
    say(`CHILD-ERROR cannot resolve the pg driver: ${e.message}`);
    process.exit(1);
  }

  const client = new Client({ connectionString: dsn });
  await client.connect();
  const query = (text, params) => client.query(text, params);

  const claimed = await lease.claim(query, { runnerId, requestId, leaseMs });
  if (!claimed) {
    say('CHILD-NO-CLAIM a live lease is held by another runner');
    await client.end();
    process.exit(3);
  }

  // WHAT A PREVIOUS PROCESS LEFT BEHIND. This is the whole question the proof
  // asks, so it is printed before any new work happens.
  const carried = (claimed.progress && claimed.progress.executor) || null;
  const done = (carried && Array.isArray(carried.completed_steps)) ? carried.completed_steps.slice() : [];
  say(`CHILD-CLAIMED request=${claimed.id} runner=${runnerId} resume_from=${done.length}`);

  for (let i = done.length + 1; i <= steps; i += 1) {
    done.push(i);
    if (!noProgress) {
      try {
        await lease.writeProgress(query, {
          requestId, runnerId, progress: { executor: { completed_steps: done } },
        });
      } catch (e) {
        if (e instanceof lease.LeaseLostError) {
          say(`CHILD-LEASE-LOST at step ${i}`);
          await client.end();
          process.exit(4);
        }
        throw e;
      }
    }
    say(`CHILD-STEP ${i}`);
    await new Promise((r) => setTimeout(r, stepMs));
  }

  say(`CHILD-DONE ${done.length}`);
  await client.end();
  process.exit(0);
}

main().catch((e) => {
  say(`CHILD-ERROR ${e && e.stack ? e.stack : e}`);
  process.exit(1);
});
