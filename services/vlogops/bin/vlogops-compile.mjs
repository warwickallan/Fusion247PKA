#!/usr/bin/env node
// BUILD-006 Phase 2 — the Source Compiler CLI.
//
// Compilation is INVOKED FOR A SEED, exactly as Phase 1's intake routes are invoked for a
// window or a document. Nothing here is on a timer, nothing polls, and nothing runs
// unattended: a person decides that a seed is worth compiling and says so. The one thing
// that IS automatic is what happens when this process dies mid-compile, and that is a
// property of the single-transaction seal in src/compiler.mjs rather than of anything here.
//
// Usage:
//   node bin/vlogops-compile.mjs compile --seed <seed_id> [--emit <path>] [--hold-at <stage>]
//   node bin/vlogops-compile.mjs verify  --pack <pack_id>
//
// VLOGOPS_DB_URL must be set. It is the only database variable, and its value comes from the
// environment — never from a file inside this repository.

import fs from 'node:fs';
import process from 'node:process';
import { loadConfig } from '../src/config.mjs';
import { compileEvidencePack, readPack, verifyPack } from '../src/compiler.mjs';
import { closePool, getPool } from '../src/db.mjs';
import { packDocument } from '../src/pack.mjs';

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {};
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = rest[i + 1];
    if (next === undefined || next.startsWith('--')) {
      flags[key] = true;
    } else {
      flags[key] = next;
      i += 1;
    }
  }
  return { command, flags };
}

function usage() {
  return [
    'vlogops compile — turn a sealed Content Seed into a durable evidence pack.',
    '',
    '  compile  --seed <seed_id> [--emit <path>] [--hold-at <stage>]',
    '  verify   --pack <pack_id>',
    '',
    '--emit writes the canonical pack document, which is the artefact two independent',
    '       compiles are compared on.',
  ].join('\n');
}

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));

  if (!command || flags.help) {
    process.stdout.write(`${usage()}\n`);
    process.exit(command ? 0 : 64);
  }

  const config = loadConfig(process.env);
  const pool = getPool(config.databaseUrl);

  if (command === 'verify') {
    const packId = typeof flags.pack === 'string' ? flags.pack : null;
    if (!packId) {
      process.stderr.write(`vlogops: verify needs --pack <pack_id>\n\n${usage()}\n`);
      process.exit(64);
    }

    const result = await verifyPack(pool, packId);
    const found = await readPack(pool, packId);

    // The document is RECOMPUTED from the stored manifest rather than remembered, so a
    // read-back after a source has been damaged is answering with what the store actually
    // holds today — not with anything this process was told earlier.
    if (found !== null && typeof flags.emit === 'string') {
      fs.writeFileSync(flags.emit, packDocument({
        packId: found.pack.pack_id.trim(), manifest: found.pack.manifest,
      }));
    }

    process.stdout.write(`${JSON.stringify({
      pack_id: packId,
      ok: result.ok,
      entry_count: result.entryCount ?? 0,
      entries_verified: result.entriesVerified,
      bounded: result.bounded ?? null,
      problems: result.problems,
    })}\n`);

    // A failed verification is a failed command. It must not exit 0 and let a caller's
    // `&&` chain carry on as though the pack were whole.
    process.exit(result.ok ? 0 : 1);
  }

  if (command !== 'compile') {
    process.stderr.write(`vlogops: unknown command '${command}'\n\n${usage()}\n`);
    process.exit(64);
  }

  const seedId = typeof flags.seed === 'string' ? flags.seed : null;
  if (!seedId) {
    process.stderr.write(`vlogops: compile needs --seed <seed_id>\n\n${usage()}\n`);
    process.exit(64);
  }

  const holdAt = typeof flags['hold-at'] === 'string' ? flags['hold-at'] : null;
  const hooks = holdAt
    ? {
      onStage: async (stage) => {
        if (stage !== holdAt) return;
        process.stdout.write(`VLOGOPS_HELD_AT ${stage}\n`);
        // An explicit keepalive, for the same reason Phase 1's intake CLI has one: if the
        // event loop drained here the process would exit cleanly on its own and the kill
        // proof would be testing an ordinary shutdown while looking exactly like a real one.
        const keepalive = setInterval(() => {}, 1000);
        keepalive.ref();
        await new Promise(() => {});
      },
    }
    : {};

  const result = await compileEvidencePack({
    pool,
    seedId,
    maxEntries: config.packMaxEntries,
    maxBytes: config.packMaxBytes,
    hooks,
  });

  if (typeof flags.emit === 'string') {
    fs.writeFileSync(flags.emit, result.document);
  }

  process.stdout.write(`${JSON.stringify({
    pack_id: result.packId,
    seed_id: result.seedId,
    deduplicated: result.deduplicated,
    entries: result.entryCount,
    entry_bytes: result.entryBytes,
    bounded: result.bounded,
    omitted: result.omitted.length,
    candidates: result.candidateCount,
  })}\n`);
}

main()
  .then(async () => { await closePool(); })
  .catch(async (err) => {
    await closePool().catch(() => {});
    process.stderr.write(`${err.stack || err.message}\n`);
    if (err.code === 'EVLOGOPSCONFIG') process.exit(78);
    if (err.code === 'EVLOGOPSNOSEED') process.exit(65);
    process.exit(1);
  });
