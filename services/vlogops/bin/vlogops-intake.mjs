#!/usr/bin/env node
// BUILD-006 Phase 1 — the intake CLI.
//
// All three routes are HUMAN-INITIATED by design. Nothing here is on a timer, nothing polls
// and nothing runs unattended: a person decides that a thing is worth developing and says so.
// That is the product, not a limitation of it. The one behaviour that IS automatic is what
// happens when this process dies mid-intake, and that is a property of the seal in
// src/intake.mjs rather than of anything in this file.
//
// Usage:
//   node bin/vlogops-intake.mjs records  --from 2026-08-05 --to 2026-08-05
//   node bin/vlogops-intake.mjs promote  --origin "<fusion247 output>" --angle "<angle>" --file <path>
//   node bin/vlogops-intake.mjs supplied --angle "<angle>" [--file <path> | --text "<text>" | -]
//
// VLOGOPS_DB_URL must be set. It is the only database variable, and its value comes from
// the environment — never from a file inside this repository.

import fs from 'node:fs';
import process from 'node:process';
import { loadConfig } from '../src/config.mjs';
import { closePool, getPool } from '../src/db.mjs';
import { intake } from '../src/intake.mjs';

// Routes are imported LAZILY, per command. Import stays inert and cheap, and one route's
// module can never be a load-time dependency of another route's invocation.

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {};
  const positional = [];
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = rest[i + 1];
      if (next === undefined || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i += 1;
      }
    } else {
      positional.push(a);
    }
  }
  return { command, flags, positional };
}

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function usage() {
  return [
    'vlogops intake — land a durable Content Seed.',
    '',
    '  records   --from YYYY-MM-DD --to YYYY-MM-DD [--privacy <state>]',
    '  promote   --origin <text> --angle <text> (--file <path> | --text <text>) [--privacy <state>]',
    '  supplied  --angle <text> (--file <path> | --text <text> | -) [--privacy <state>]',
    '',
    'privacy states: unclassified | public | internal | private | restricted',
  ].join('\n');
}

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));

  if (!command || flags.help) {
    process.stdout.write(`${usage()}\n`);
    process.exit(command ? 0 : 64);
  }

  const config = loadConfig(process.env);
  const privacyState = typeof flags.privacy === 'string' ? flags.privacy : 'unclassified';

  const text = typeof flags.text === 'string'
    ? flags.text
    : (flags.file ? fs.readFileSync(flags.file, 'utf8') : (flags.stdin ? readStdin() : null));

  let bundle;
  switch (command) {
    case 'records': {
      const { compileRecordsBundle } = await import('../src/routes/records.mjs');
      bundle = compileRecordsBundle({
        config,
        from: String(flags.from ?? ''),
        to: String(flags.to ?? flags.from ?? ''),
        privacyState,
      });
      break;
    }

    case 'promote': {
      const { promotionBundle } = await import('../src/routes/promotion.mjs');
      bundle = promotionBundle({
        config,
        origin: typeof flags.origin === 'string' ? flags.origin : null,
        angle: typeof flags.angle === 'string' ? flags.angle : null,
        sourceRef: typeof flags['source-ref'] === 'string' ? flags['source-ref'] : null,
        text,
        filePath: typeof flags.file === 'string' ? flags.file : null,
        privacyState,
      });
      break;
    }

    case 'supplied': {
      const { suppliedBundle } = await import('../src/routes/supplied.mjs');
      bundle = suppliedBundle({
        config,
        angle: typeof flags.angle === 'string' ? flags.angle : null,
        text,
        filePath: typeof flags.file === 'string' ? flags.file : null,
        privacyState,
      });
      break;
    }

    default:
      process.stderr.write(`vlogops: unknown command '${command}'\n\n${usage()}\n`);
      process.exit(64);
  }

  const pool = getPool(config.databaseUrl);

  // A TEST AFFORDANCE, and deliberately a narrow one. `--hold-at <stage>` parks this real
  // process inside a real open transaction so an external kill lands in a known window. It
  // injects no failure, fakes nothing and changes no code path — the transaction, the
  // writes and the kill are all genuine. Without it the AC7 proof would be racing a
  // millisecond-long transaction and would silently become a test of timing.
  const holdAt = typeof flags['hold-at'] === 'string' ? flags['hold-at'] : null;
  const hooks = holdAt
    ? {
      onStage: async (stage) => {
        if (stage !== holdAt) return;
        process.stdout.write(`VLOGOPS_HELD_AT ${stage}\n`);
        // An explicit keepalive rather than relying on the pool's socket to hold the event
        // loop open. If the loop drained here the process would exit cleanly on its own and
        // the kill test would be proving an ordinary shutdown instead of an abrupt death —
        // a false pass that would look exactly like a real one.
        const keepalive = setInterval(() => {}, 1000);
        keepalive.ref();
        await new Promise(() => {});
      },
    }
    : {};

  const result = await intake({
    pool,
    route: command === 'promote' ? 'promotion' : command === 'supplied' ? 'supplied' : 'records',
    selector: bundle.selector,
    angle: bundle.angle ?? null,
    origin: bundle.origin ?? null,
    privacyState,
    members: bundle.members,
    selection: bundle.selection ?? null,
    hooks,
  });

  process.stdout.write(`${JSON.stringify({
    seed_id: result.seedId,
    deduplicated: result.deduplicated,
    members: result.memberCount,
  })}\n`);
}

main()
  .then(async () => { await closePool(); })
  .catch(async (err) => {
    await closePool().catch(() => {});
    process.stderr.write(`${err.stack || err.message}\n`);
    if (err.code === 'EVLOGOPSCONFIG') process.exit(78);
    if (err.code === 'EVLOGOPSSEEDREJECTED') process.exit(65);
    process.exit(1);
  });
