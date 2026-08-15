#!/usr/bin/env node
// BUILD-006 Phase 3 — the Scribe CLI.
//
// Drafting is INVOKED FOR A PACK, exactly as Phase 2's compile is invoked for a seed and Phase
// 1's intake for a window. Nothing here is on a timer, nothing polls, and nothing runs
// unattended: a person decides that a pack is worth drafting and says so. THIS OUTCOME IS NOT
// INTENDED TO BE AUTOMATIC and the Work Order says so — what is automatic is that a sibling
// cannot silently drift from its master or from the evidence, and that is a property of the
// schema in db/003 rather than of anything in this file.
//
// Usage:
//   node bin/vlogops-scribe.mjs draft  --pack <pack_id> [--model gateway|stub]
//                                      [--contract <version>] [--emit <path>] [--emit-json <path>]
//                                      [--hold-at <stage>]
//   node bin/vlogops-scribe.mjs verify --package <package_id> [--emit <path>]
//   node bin/vlogops-scribe.mjs status
//
// --model DEFAULTS TO `gateway`, and gateway REFUSES when unconfigured. That default is
// deliberate: a default that quietly stubbed would make every run a lie about what produced it.
// Ask for the stub explicitly and the package records that it was stubbed, permanently, in its
// own row.
//
// VLOGOPS_DB_URL must be set. It is the only database variable, and its value comes from the
// environment — never from a file inside this repository.

import fs from 'node:fs';
import process from 'node:process';
import { loadConfig } from '../src/config.mjs';
import { closePool, getPool } from '../src/db.mjs';
import { CURRENT_CONTRACT_VERSION, availableContractVersions, loadContract } from '../src/scribe/contract.mjs';
import { ENV_GATEWAY_URL, ENV_MODEL, modelConfigured, resolveModelClient } from '../src/scribe/model.mjs';
import { renderPackage } from '../src/scribe/package.mjs';
import { stubModelClient } from '../src/scribe/stub.mjs';
import { draftStoryPackage, readStoryPackage, verifyStoryPackage } from '../src/scribe/store.mjs';

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
    'vlogops scribe — turn a compiled evidence pack into a Master Story Package.',
    '',
    '  draft   --pack <pack_id> [--model gateway|stub] [--contract <version>]',
    '          [--emit <path>] [--emit-json <path>] [--hold-at <stage>]',
    '  verify  --package <package_id> [--emit <path>]',
    '  status',
    '',
    '--model defaults to `gateway`, which REFUSES when no gateway is configured. `stub` is the',
    '        deterministic placeholder composer: it calls no model, and the package it produces',
    '        records that fact permanently. Stub output is NOT anybody\'s voice.',
    '--emit  writes the human-readable package; --emit-json writes the canonical document, which',
    '        is the artefact two independent drafts are compared on.',
  ].join('\n');
}

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));

  if (!command || flags.help) {
    process.stdout.write(`${usage()}\n`);
    process.exit(command ? 0 : 64);
  }

  // `status` answers a configuration question and must not require a database to do it.
  if (command === 'status') {
    const contract = loadContract(
      typeof flags.contract === 'string' ? flags.contract : CURRENT_CONTRACT_VERSION,
    );
    process.stdout.write(`${JSON.stringify({
      contract_version: contract.version,
      contract_id: contract.id,
      contracts_available: availableContractVersions(),
      model_configured: modelConfigured(process.env),
      model_gateway_var: ENV_GATEWAY_URL,
      model_name_var: ENV_MODEL,
      note: modelConfigured(process.env)
        ? 'A gateway and a model name are both set. That is NOT a promise the gateway registers '
          + 'that model — capability is only ever proven at call time.'
        : `No model is configured. \`draft\` will refuse unless --model stub is asked for explicitly.`,
    }, null, 2)}\n`);
    process.exit(0);
  }

  const config = loadConfig(process.env);
  const pool = getPool(config.databaseUrl);

  if (command === 'verify') {
    const packageId = typeof flags.package === 'string' ? flags.package : null;
    if (!packageId) {
      process.stderr.write(`vlogops: verify needs --package <package_id>\n\n${usage()}\n`);
      process.exit(64);
    }

    const result = await verifyStoryPackage(pool, packageId);
    const found = await readStoryPackage(pool, packageId);

    // Rendered from the STORED manifest rather than from anything this process was told
    // earlier, so a read-back after a source has been damaged answers with what the store
    // actually holds today.
    if (found !== null && typeof flags.emit === 'string') {
      const entries = await pool.query(
        'select ordinal, source_ref from vlogops.evidence_pack_entry where pack_id = $1',
        [found.pkg.pack_id.trim()],
      );
      fs.writeFileSync(flags.emit, renderPackage({
        packageId: found.pkg.package_id.trim(),
        manifest: found.pkg.manifest,
        modelBinding: found.pkg.model_binding,
        ordinalByRef: new Map(entries.rows.map((r) => [r.source_ref, r.ordinal])),
      }));
    }

    process.stdout.write(`${JSON.stringify({
      package_id: packageId,
      ok: result.ok,
      claims: result.claimCount ?? 0,
      segments: result.segmentCount ?? 0,
      segments_traced: result.segmentsTraced,
      problems: result.problems,
    })}\n`);

    // A failed verification is a failed command. It must not exit 0 and let a caller's `&&`
    // chain carry on as though the package were whole.
    process.exit(result.ok ? 0 : 1);
  }

  if (command !== 'draft') {
    process.stderr.write(`vlogops: unknown command '${command}'\n\n${usage()}\n`);
    process.exit(64);
  }

  const packId = typeof flags.pack === 'string' ? flags.pack : null;
  if (!packId) {
    process.stderr.write(`vlogops: draft needs --pack <pack_id>\n\n${usage()}\n`);
    process.exit(64);
  }

  const modelName = typeof flags.model === 'string' ? flags.model : 'gateway';
  const modelClient = resolveModelClient(modelName, process.env, stubModelClient);

  const holdAt = typeof flags['hold-at'] === 'string' ? flags['hold-at'] : null;
  const hooks = holdAt
    ? {
      onStage: async (stage) => {
        if (stage !== holdAt) return;
        process.stdout.write(`VLOGOPS_HELD_AT ${stage}\n`);
        const keepalive = setInterval(() => {}, 1000);
        keepalive.ref();
        await new Promise(() => {});
      },
    }
    : {};

  const result = await draftStoryPackage({
    pool,
    packId,
    contractVersion: typeof flags.contract === 'string' ? flags.contract : undefined,
    modelClient,
    hooks,
  });

  if (typeof flags['emit-json'] === 'string') {
    fs.writeFileSync(flags['emit-json'], result.document);
  }
  if (typeof flags.emit === 'string') {
    fs.writeFileSync(flags.emit, renderPackage({
      packageId: result.packageId,
      manifest: result.manifest,
      modelBinding: result.modelBinding,
      ordinalByRef: result.ordinalByRef,
    }));
  }

  process.stdout.write(`${JSON.stringify({
    package_id: result.packageId,
    pack_id: result.packId,
    seed_id: result.seedId,
    derivation_id: result.derivationId,
    contract: result.contract,
    prompt_sha256: result.promptSha256,
    prompt_bytes: result.promptBytes,
    model: result.modelBinding,
    deduplicated: result.deduplicated,
    claims: result.claimCount,
    segments: result.segmentCount,
  })}\n`);
}

main()
  .then(async () => { await closePool(); })
  .catch(async (err) => {
    await closePool().catch(() => {});
    process.stderr.write(`${err.stack || err.message}\n`);
    // Exit codes are meaningful and stable — the runbook reads them, and so does CI.
    if (err.code === 'EVLOGOPSCONFIG') process.exit(78);          // configuration
    if (err.code === 'EVLOGOPSNOMODEL') process.exit(69);         // a required service is absent
    if (err.code === 'EVLOGOPSNOPACK') process.exit(65);          // no such input
    if (err.code === 'EVLOGOPSNOSTUB') process.exit(69);
    if (typeof err.code === 'string' && err.code.startsWith('EVLOGOPSSCRIBE')) process.exit(65);
    process.exit(1);
  });
