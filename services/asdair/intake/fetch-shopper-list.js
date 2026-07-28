#!/usr/bin/env node
// =====================================================================
// IDEA-012 AsdAIr — intake: fetch-shopper-list.js
//
// The runtime caller for shopperIntake.js. Fetches this week's shopping list
// message(s) from @Fusion247shopperbot and prints the emitted records.
//
// Usage (credentials come from the env file — NEVER on the command line):
//   node --env-file=<path to the shopper credentials file> \
//        services/asdair/intake/fetch-shopper-list.js [--dry-run]
//
// Options:
//   --dry-run              fetch and print what WOULD be emitted. Downloads
//                          nothing, writes no state file.
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
    'AsdAIr shopper intake — fetch this week\'s list from @Fusion247shopperbot.',
    '',
    'Usage:',
    '  node --env-file=<credentials file> services/asdair/intake/fetch-shopper-list.js [options]',
    '',
    'Options:',
    '  --dry-run            print what WOULD be emitted; download nothing, write no state',
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

export async function main(argv = process.argv.slice(2), { env = process.env, out = console } = {}) {
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
