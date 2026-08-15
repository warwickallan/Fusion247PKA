#!/usr/bin/env node
// BUILD-006 Phase 4 — the verification CLI.
//
// Verification is INVOKED FOR A PACKAGE, exactly as Phase 3's draft is invoked for a pack, Phase
// 2's compile for a seed and Phase 1's intake for a window. Nothing here is on a timer, nothing
// polls, and nothing runs unattended. THIS OUTCOME IS NOT INTENDED TO BE AUTOMATIC and the Work
// Order says so.
//
// What IS automatic is narrower and is the whole point: a package carrying an undisposed finding
// CANNOT BE ADVANCED, by this command or by any other client, because the refusal lives in
// db/004's trigger rather than in this file. Delete this CLI and the gate still holds.
//
// ⛔ AND THE LIMIT OF THAT, STATED HERE TOO ⛔
// The gate is structural for the advance operation Phase 4 defines. Phases 5-7 do not exist yet
// and nothing here can force a future stage to advance a package by writing to
// vlogops.package_advance rather than reading vlogops.story_package directly and pressing on.
// THIS MUST NEVER BE DESCRIBED AS UNBYPASSABLE.
//
// Usage:
//   node bin/vlogops-verify.mjs verify   --package <package_id> [--ruleset <version>]
//                                        [--emit <path>] [--json] [--hold-at <stage>]
//   node bin/vlogops-verify.mjs state    --package <package_id> [--emit <path>]
//   node bin/vlogops-verify.mjs override --verification <id> --finding <n> --by <who> --reason <why>
//   node bin/vlogops-verify.mjs answer   --verification <id> --finding <n> --by <who> --reason <why>
//   node bin/vlogops-verify.mjs advance  --package <package_id> --verification <id> --by <who>
//   node bin/vlogops-verify.mjs rights   --seed <seed_id> --ref <source_ref> --basis <basis>
//                                        --by <who> [--holder <name>] [--licence <ref>] [--note <text>]
//   node bin/vlogops-verify.mjs derive-rights --seed <seed_id> --by <who>
//   node bin/vlogops-verify.mjs status
//
// `override` and `answer` are two commands rather than one flag on purpose. Overruling a rule
// violation and answering a question nobody had answered are different human acts, they leave
// different rows, and they should not be reachable by the same keystrokes.
//
// VLOGOPS_DB_URL must be set. It is the only database variable, and its value comes from the
// environment — never from a file inside this repository.

import fs from 'node:fs';
import process from 'node:process';
import { loadConfig } from '../src/config.mjs';
import { closePool, getPool } from '../src/db.mjs';
import { renderVerification } from '../src/verify/report.mjs';
import {
  CURRENT_RULESET_VERSION, VERIFIER_VERSION, availableRulesetVersions, loadRuleset,
} from '../src/verify/ruleset.mjs';
import {
  advancePackage, declareRights, deriveRights, disposeFinding, readPackageState, verifyAndRecord,
} from '../src/verify/store.mjs';

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
    'vlogops verify — check a Master Story Package across five dimensions, and BLOCK when it fails.',
    '',
    '  verify        --package <id> [--ruleset <v>] [--emit <path>] [--json] [--hold-at <stage>]',
    '  state         --package <id> [--emit <path>]',
    '  override      --verification <id> --finding <n> --by <who> --reason <why>   (a rule violation)',
    '  answer        --verification <id> --finding <n> --by <who> --reason <why>   (a surfaced question)',
    '  advance       --package <id> --verification <id> --by <who>',
    '  rights        --seed <id> --ref <source_ref> --basis <basis> --by <who>',
    '                [--holder <name>] [--licence <ref>] [--note <text>]',
    '  derive-rights --seed <id> --by <who>',
    '  status',
    '',
    'A blocked package cannot advance. The block is a row: it survives a restart, and re-running',
    'verification does not clear it. Clear it with a recorded override or answer, or fix the draft.',
    '',
    'Exit codes: 0 clean · 1 blocked or refused · 64 bad usage · 65 no such input · 78 bad config.',
  ].join('\n');
}

function requireFlag(flags, name, command) {
  const v = flags[name];
  if (typeof v !== 'string' || v.trim() === '') {
    process.stderr.write(`vlogops: ${command} needs --${name} <value>\n\n${usage()}\n`);
    process.exit(64);
  }
  return v.trim();
}

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));

  if (!command || flags.help) {
    process.stdout.write(`${usage()}\n`);
    process.exit(command ? 0 : 64);
  }

  // `status` answers a configuration question and must not require a database to do it.
  if (command === 'status') {
    const ruleset = loadRuleset(
      typeof flags.ruleset === 'string' ? flags.ruleset : CURRENT_RULESET_VERSION,
    );
    process.stdout.write(`${JSON.stringify({
      verifier_version: VERIFIER_VERSION,
      ruleset_version: ruleset.version,
      ruleset_id: ruleset.id,
      rulesets_available: availableRulesetVersions(),
      dimensions: ['fact', 'quotation', 'privacy', 'rights', 'cross-format'],
      note: 'The ruleset id is the sha256 of the ruleset document. Editing a rule changes the id, '
        + 'so an old verdict can never silently become a product of new rules.',
    }, null, 2)}\n`);
    process.exit(0);
  }

  const config = loadConfig(process.env);
  const pool = getPool(config.databaseUrl);

  if (command === 'verify') {
    const packageId = requireFlag(flags, 'package', 'verify');
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

    const result = await verifyAndRecord({
      pool,
      packageId,
      rulesetVersion: typeof flags.ruleset === 'string' ? flags.ruleset : CURRENT_RULESET_VERSION,
      hooks,
    });
    const state = await readPackageState(pool, packageId);

    if (typeof flags.emit === 'string') {
      fs.writeFileSync(flags.emit, renderVerification({ result, state }));
    }

    const payload = {
      package_id: result.packageId,
      verification_id: result.verificationId,
      verdict: result.verdict,
      ruleset: result.ruleset,
      deduplicated: result.deduplicated,
      dimensions: Object.fromEntries(
        Object.entries(result.dimensions).map(([k, v]) => [k, {
          verdict: v.verdict, blocking: v.blocking, surfaced: v.surfaced, coverage: v.coverage,
        }]),
      ),
      findings: result.findings.map((f) => ({
        ordinal: f.ordinal, dimension: f.dimension, severity: f.severity, rule: f.rule,
        claim_id: f.claim_id, sibling: f.sibling, segment_ordinal: f.segment_ordinal,
        source_ref: f.source_ref, detail: f.detail,
      })),
      advanceable: state?.advanceable ?? false,
    };
    process.stdout.write(`${JSON.stringify(payload, null, flags.json ? 2 : 0)}\n`);

    // A blocked package is a failed command. It must not exit 0 and let a caller's `&&` chain
    // carry on as though the package were clean.
    process.exit(result.verdict === 'pass' ? 0 : 1);
  }

  if (command === 'state') {
    const packageId = requireFlag(flags, 'package', 'state');
    const state = await readPackageState(pool, packageId);
    if (state === null) {
      process.stderr.write(`vlogops: no package ${packageId}\n`);
      process.exit(65);
    }
    if (typeof flags.emit === 'string') {
      fs.writeFileSync(flags.emit, `${JSON.stringify(state, null, 2)}\n`);
    }
    process.stdout.write(`${JSON.stringify(state)}\n`);
    process.exit(state.advanceable ? 0 : 1);
  }

  if (command === 'override' || command === 'answer') {
    const verificationId = requireFlag(flags, 'verification', command);
    const finding = requireFlag(flags, 'finding', command);
    const by = requireFlag(flags, 'by', command);
    const reason = requireFlag(flags, 'reason', command);

    // The command names an act, and the finding's severity decides which act is available on it.
    // The intent goes IN so the mismatch is refused before anything is written — a refused command
    // must not have changed durable state on its way to failing.
    const disposed = await disposeFinding({
      pool,
      verificationId,
      ordinal: Number(finding),
      decidedBy: by,
      reason,
      intent: command === 'override' ? 'overridden' : 'answered',
    });

    process.stdout.write(`${JSON.stringify({ ...disposed, recorded: true })}\n`);
    process.exit(0);
  }

  if (command === 'advance') {
    const packageId = requireFlag(flags, 'package', 'advance');
    const verificationId = requireFlag(flags, 'verification', 'advance');
    const by = requireFlag(flags, 'by', 'advance');

    const advanced = await advancePackage({ pool, packageId, verificationId, advancedBy: by });
    process.stdout.write(`${JSON.stringify({ ...advanced, advanced: true })}\n`);
    process.exit(0);
  }

  if (command === 'rights') {
    const seedId = requireFlag(flags, 'seed', 'rights');
    const sourceRef = requireFlag(flags, 'ref', 'rights');
    const basis = requireFlag(flags, 'basis', 'rights');
    const by = requireFlag(flags, 'by', 'rights');

    const declared = await declareRights({
      pool,
      seedId,
      sourceRef,
      basis,
      holder: typeof flags.holder === 'string' ? flags.holder : null,
      licenceRef: typeof flags.licence === 'string' ? flags.licence : null,
      note: typeof flags.note === 'string' ? flags.note : null,
      declaredBy: by,
    });
    process.stdout.write(`${JSON.stringify(declared)}\n`);
    process.exit(0);
  }

  if (command === 'derive-rights') {
    const seedId = requireFlag(flags, 'seed', 'derive-rights');
    const by = requireFlag(flags, 'by', 'derive-rights');
    const derived = await deriveRights({ pool, seedId, declaredBy: by });
    process.stdout.write(`${JSON.stringify({
      ...derived,
      basis_source: 'derived-from-provenance',
      note: 'RIGHT-1 only. Sources that could not be derived are left alone and RIGHT-3 surfaces '
        + 'them — `warwick-supplied` is never derivable.',
    })}\n`);
    process.exit(0);
  }

  process.stderr.write(`vlogops: unknown command '${command}'\n\n${usage()}\n`);
  process.exit(64);
}

main()
  .then(async () => { await closePool(); })
  .catch(async (err) => {
    await closePool().catch(() => {});
    process.stderr.write(`${err.stack || err.message}\n`);
    // Exit codes are meaningful and stable — the runbook reads them, and so does CI.
    if (err.code === 'EVLOGOPSCONFIG') process.exit(78);
    if (err.code === 'EVLOGOPSNOPACKAGE') process.exit(65);
    if (err.code === 'EVLOGOPSVERIFYNORULESET') process.exit(65);
    if (err.code === 'EVLOGOPSVERIFYNOFINDING') process.exit(65);
    if (err.code === 'EVLOGOPSBLOCKED') process.exit(1);
    if (typeof err.code === 'string' && err.code.startsWith('EVLOGOPSVERIFY')) process.exit(64);
    process.exit(1);
  });
