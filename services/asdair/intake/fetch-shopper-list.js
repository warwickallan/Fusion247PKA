#!/usr/bin/env node
// =====================================================================
// IDEA-012 AsdAIr — intake: fetch-shopper-list.js
//
// The DRY-RUN INSPECTOR for shopperIntake.js. Reports what is waiting from
// @Fusion247shopperbot without consuming it.
//
// ── THIS COMMAND HAS NO LIVE MODE, AND THAT IS THE POINT (WP-B15-11) ─────────
// It used to have one, and it was a landmine. A live fetch advances the shared
// Telegram offset, which tells Telegram to forget the message permanently. This
// tool never touches a database (see below), so it had nowhere durable to put
// the list first: ONE live run permanently consumed a pending week's shopping
// list and nothing could recover it. It is now refused before anything is
// loaded or fetched. Real intake runs from services/asdair/pipeline/runtime.js,
// which persists the shop BEFORE the offset moves.
//
// Usage (credentials come from the env file — NEVER on the command line):
//   node --env-file=<path to the shopper credentials file> \
//        services/asdair/intake/fetch-shopper-list.js --dry-run
//
// Options:
//   --dry-run              REQUIRED. Fetch and print what WOULD be emitted.
//                          Downloads nothing, writes no state file, consumes
//                          nothing. Without it the command refuses to run.
//   --state-file <path>    override SHOPPER_INTAKE_STATE_FILE
//   --media-dir <path>     override SHOPPER_INTAKE_MEDIA_DIR
//   --timeout <seconds>    long-poll wait (0 = return immediately; capped at 25s)
//   --json                 print ONLY the machine-readable result object
//   --help
//
// This tool NEVER transcribes a photo (that is a downstream vision-model step),
// NEVER places an order, and NEVER connects to a database.
//
// SECRET HYGIENE: no token is ever accepted as an argument, printed, or logged.
// This file does not open any credential file itself — Node's --env-file does.
// =====================================================================

import { fileURLToPath } from 'node:url';

import {
  SHOPPER_INTAKE_ENV,
  loadIntakeConfig,
  runIntakeFromConfig,
  clampPollTimeout,
} from './shopperIntake.js';

/** PURE. Parse argv (already sliced past node + script). */
export function parseArgs(argv = []) {
  const out = { dryRun: false, json: false, help: false, stateFile: null, mediaDir: null, timeout: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--json') out.json = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--state-file') { i += 1; out.stateFile = argv[i] ?? null; }
    else if (a === '--media-dir') { i += 1; out.mediaDir = argv[i] ?? null; }
    else if (a === '--timeout') { i += 1; out.timeout = clampPollTimeout(argv[i]); }
    else throw new Error(`unknown argument "${a}" (see --help)`);
  }
  return out;
}

export function usage() {
  return [
    'AsdAIr shopper intake — INSPECT this week\'s list from @Fusion247shopperbot.',
    '',
    'This command has no live mode: a live fetch advances the Telegram offset and would',
    'permanently consume a pending list. Real intake runs from the AsdAIr pipeline',
    '(services/asdair/pipeline/runtime.js), which persists the shop before that happens.',
    '',
    'Usage:',
    '  node --env-file=<credentials file> services/asdair/intake/fetch-shopper-list.js --dry-run',
    '',
    'Options:',
    '  --dry-run            REQUIRED. Print what WOULD be emitted; download nothing, write',
    '                       no state, consume nothing. Without it the command refuses.',
    '  --state-file <path>  override the offset state file',
    '  --media-dir <path>   override where list photos are downloaded',
    '  --timeout <seconds>  long-poll wait (0 = immediate; capped at 25s)',
    '  --json               print only the machine-readable result',
    '  --help',
    '',
    'Environment (names only — values live in the env file, never here):',
    ...Object.values(SHOPPER_INTAKE_ENV).map((k) => `  ${k}`),
    '',
    'This tool never transcribes a photo, never places an order, never touches a database.',
  ].join('\n');
}

/** PURE. A print-safe view of a run result (no secrets anywhere in it). */
export function summarise(result) {
  return {
    dry_run: result.dryRun,
    fetched: result.fetched,
    emitted: result.emitted.map((r) => ({
      sourceId: r.sourceId,
      kind: r.payload.kind,
      imageRef: r.payload.kind === 'photo' ? r.payload.imageRef : undefined,
      chars: r.payload.kind === 'text' ? r.payload.text.length : undefined,
      receivedAt: r.meta.receivedAt,
    })),
    ignored: result.ignored,
    failed: result.failed,
    offset_before: result.offsetBefore,
    offset_after: result.offsetAfter,
  };
}

/**
 * The refusal text for a live invocation. (WP-B15-11 AC3/AC4)
 *
 * Exported so the message itself is testable, and so the two safe routes are
 * named in exactly one place rather than being remembered differently by a
 * comment, a README and a runbook.
 */
export function liveRunRefusal() {
  return [
    'REFUSED: this command has no live mode.',
    '',
    'A live fetch advances the shared Telegram offset, which permanently consumes the',
    'message - Telegram then forgets it. This tool never touches a database, so it has',
    'nowhere durable to put the list first, and a live run would destroy a pending week.',
    '',
    'Use one of these instead:',
    '  --dry-run              inspect what is waiting. Downloads nothing, writes no state,',
    '                         consumes nothing.',
    '  the AsdAIr pipeline    real intake runs from services/asdair/pipeline/runtime.js,',
    '                         which persists the shop BEFORE the offset moves.',
  ].join('\n');
}

export async function main(argv = process.argv.slice(2), { env = process.env, out = console, fetchImpl } = {}) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    out.error(err.message);
    out.error(usage());
    return 2;
  }
  if (args.help) {
    out.log(usage());
    return 0;
  }

  // ── REFUSE A LIVE RUN, BEFORE ANYTHING IS LOADED OR FETCHED (WP-B15-11) ────
  // This check sits above config loading deliberately. Building a client and
  // calling getUpdates is itself the destructive act, so the refusal must
  // precede any of it - not merely precede the write. A missing credential must
  // never be the thing that saves a pending list.
  if (!args.dryRun) {
    out.error(liveRunRefusal());
    return 2;
  }

  const effectiveEnv = { ...env };
  if (args.stateFile) effectiveEnv[SHOPPER_INTAKE_ENV.SHOPPER_INTAKE_STATE_FILE] = args.stateFile;
  if (args.mediaDir) effectiveEnv[SHOPPER_INTAKE_ENV.SHOPPER_INTAKE_MEDIA_DIR] = args.mediaDir;
  if (args.timeout !== null) effectiveEnv[SHOPPER_INTAKE_ENV.SHOPPER_POLL_TIMEOUT_SECONDS] = String(args.timeout);

  let config;
  try {
    config = loadIntakeConfig(effectiveEnv);
  } catch (err) {
    // loadIntakeConfig only ever reports NAMES, never values.
    out.error(`shopper intake config error: ${err.message}`);
    return 2;
  }

  if (!args.json) {
    out.log('AsdAIr shopper intake');
    out.log(`  config : ${JSON.stringify(config.describe())}`);
    out.log(`  mode   : ${args.dryRun ? 'DRY RUN — nothing downloaded, no state written' : 'live fetch'}`);
    out.log('  note   : this receiver never transcribes, never orders, never touches a database.');
  }

  let result;
  try {
    result = await runIntakeFromConfig(config, {
      dryRun: args.dryRun,
      // Injectable so the shipped entry point can be exercised end to end
      // without a network. Absent in real use, where the module default (the
      // Node global fetch) applies exactly as before.
      ...(fetchImpl ? { fetchImpl } : {}),
      log: args.json ? () => {} : (event, detail) => out.log(`  [${event}] ${JSON.stringify(detail)}`),
    });
  } catch (err) {
    out.error(`shopper intake failed: ${err.message}`);
    return 1;
  }

  out.log(JSON.stringify(summarise(result), null, 2));

  if (!args.json && result.emitted.length > 0) {
    out.log('');
    out.log('Next step (separate, downstream): hand each { payload, sourceId } to');
    out.log('services/hub/shopper/shopperRoute.mjs with an injected transcribeImage for photos.');
  }
  // A held offset (something failed) is a non-zero exit so a wrapper notices.
  return result.failed.length > 0 ? 1 : 0;
}

// Only run when executed directly — importing this file in tests must not fetch.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().then((code) => { process.exitCode = code; });
}
