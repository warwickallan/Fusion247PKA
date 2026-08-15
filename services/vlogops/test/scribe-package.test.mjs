// BUILD-006 Phase 3 — AC1, AC2, AC3, AC4, AC5, AC6, AC7 against a REAL chain and a REAL store.
//
// THE CONSTRAINT THAT OUTRANKS EVERY OTHER LINE IN THIS FILE: the package drafted here comes
// from a pack PHASE 2 ACTUALLY COMPILED, from a seed PHASE 1'S OWN INTAKE ACTUALLY MADE, over a
// real repository window, through the real command-line surfaces, in real child processes. No
// fixture pack, no hand-inserted row, no synthetic substitute. A Phase 3 that had never seen a
// pack Phase 2 produced would be a third component wearing the same name.
//
// The window is 2026-08-13 to 2026-08-14 (approved for this Work Order). It was chosen because
// it is the opposite of Phase 1's fixture window: it carries real session logs, real
// Deliverables AND real commits, so the pack has an actual chronology and an actual story in it
// rather than being carried by one class.
//
// ⛔ WHAT A GREEN RUN OF THIS FILE PROVES, AND WHAT IT DOES NOT ⛔
// Every draft below is produced by the DETERMINISTIC STUB. This file proves the contract, the
// schema, the derivation, the citation enforcement and the plumbing, end to end, against real
// Postgres and real frozen bytes. IT PROVES NOTHING ABOUT WHETHER SCRIBE WRITES IN WARWICK'S
// VOICE. That is a creative judgement, it is Warwick's alone, and it is Phase 5.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { REPO_ROOT, SERVICE_ROOT, databaseUrl, freshSchema, newPool } from './helpers/harness.mjs';
import { SCRIBE_SIBLINGS } from '../src/config.mjs';
import { loadContract } from '../src/scribe/contract.mjs';
import { ENV_GATEWAY_KEY, ENV_GATEWAY_URL, ENV_MODEL } from '../src/scribe/model.mjs';
import { packageIdentity } from '../src/scribe/package.mjs';
import { verifyStoryPackage } from '../src/scribe/store.mjs';

const INTAKE_CLI = path.join(SERVICE_ROOT, 'bin', 'vlogops-intake.mjs');
const COMPILE_CLI = path.join(SERVICE_ROOT, 'bin', 'vlogops-compile.mjs');
const SCRIBE_CLI = path.join(SERVICE_ROOT, 'bin', 'vlogops-scribe.mjs');

const WINDOW_FROM = '2026-08-13';
const WINDOW_TO = '2026-08-14';

let pool;
let realSeedId = null;
let realPackId = null;
let realPackageId = null;
let tmpDir = null;

/**
 * Run a CLI in a child process with a DELIBERATELY CLEANED environment.
 *
 * The model variables are deleted rather than left to whatever the host happens to carry. If a
 * developer machine had a gateway configured, AC6's refusal proof would silently stop testing a
 * refusal and start testing a network call — a proof that passes for the wrong reason is worse
 * than one that fails.
 */
function runCli(cliPath, args, extraEnv = {}) {
  const env = { ...process.env, VLOGOPS_DB_URL: databaseUrl() };
  delete env[ENV_GATEWAY_URL];
  delete env[ENV_GATEWAY_KEY];
  delete env[ENV_MODEL];
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: 'utf8', env: { ...env, ...extraEnv },
  });
}

/** The last line of stdout is the JSON result; earlier lines are diagnostics. */
function lastJson(stdout) {
  return JSON.parse(stdout.trim().split('\n').pop());
}

before(async () => {
  pool = newPool();
  await freshSchema(pool);
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vlogops-scribe-'));
});
after(async () => {
  await pool.end();
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// AC1 — THE REAL CHAIN. Phase 1 makes the seed, Phase 2 compiles the pack, Phase 3 drafts.
// ─────────────────────────────────────────────────────────────────────────────────────────

test('AC1 — Phase 1 Route 1 makes a REAL seed from the real repository window', () => {
  const r = runCli(INTAKE_CLI, ['records', '--from', WINDOW_FROM, '--to', WINDOW_TO]);
  assert.equal(r.status, 0, `Phase 1 intake failed: ${r.stderr}`);

  const out = lastJson(r.stdout);
  assert.match(out.seed_id, /^[0-9a-f]{64}$/, 'intake did not return a content-derived seed id');
  assert.equal(out.deduplicated, false, 'the seed already existed before this proof ran');
  assert.ok(out.members > 0, 'Phase 1 produced a seed with no members');

  realSeedId = out.seed_id;
  console.log(
    `[AC1] REAL SEED via Phase 1 Route 1 (records --from ${WINDOW_FROM} --to ${WINDOW_TO}) over ${REPO_ROOT}\n`
    + `[AC1]   seed_id=${out.seed_id} members=${out.members}`,
  );
});

test('AC1 — Phase 2 compiles that real seed into a REAL evidence pack', () => {
  assert.ok(realSeedId, 'no real seed was produced by the previous proof');

  const r = runCli(COMPILE_CLI, ['compile', '--seed', realSeedId]);
  assert.equal(r.status, 0, `Phase 2 compile failed: ${r.stderr}`);

  const out = lastJson(r.stdout);
  assert.match(out.pack_id, /^[0-9a-f]{64}$/);
  assert.equal(out.seed_id, realSeedId, 'the pack is not for the seed Phase 1 made');
  assert.ok(out.entries > 0, 'Phase 2 produced a pack with no entries');

  realPackId = out.pack_id;
  console.log(`[AC1]   pack_id=${out.pack_id} entries=${out.entries} bounded=${out.bounded}`);
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// AC6 — THE SEAM REFUSES THROUGH THE REAL COMMAND SURFACE, with a real pack in front of it.
// ─────────────────────────────────────────────────────────────────────────────────────────

test('AC6 — with no model configured, the real CLI REFUSES to draft and writes nothing', async () => {
  assert.ok(realPackId, 'no real pack was produced by the previous proof');

  const before_ = await pool.query('select count(*)::int as n from vlogops.story_package');
  const r = runCli(SCRIBE_CLI, ['draft', '--pack', realPackId]);   // no --model: defaults to gateway

  assert.notEqual(r.status, 0, 'the CLI drafted a package with no model configured');
  assert.equal(r.status, 69, `expected exit 69 (service unavailable), got ${r.status}`);
  assert.match(r.stderr, /EVLOGOPSNOMODEL|no language model is configured/,
    'the refusal did not name the condition');
  assert.match(r.stderr, new RegExp(ENV_GATEWAY_URL), 'the refusal did not name the variable to set');
  assert.match(r.stderr, /REFUSES to substitute/, 'the refusal did not say it refuses to substitute');

  const after_ = await pool.query('select count(*)::int as n from vlogops.story_package');
  assert.equal(after_.rows[0].n, before_.rows[0].n, 'a refused draft wrote a package anyway');

  console.log(`[AC6] draft with no gateway -> EXIT_UNPIPED=${r.status}, 0 packages written`);
});

test('AC6 — a gateway URL with NO MODEL NAMED is refused too, through the same surface', () => {
  const r = runCli(SCRIBE_CLI, ['draft', '--pack', realPackId], {
    [ENV_GATEWAY_URL]: 'http://127.0.0.1:9/v1',                     // deliberately unreachable
  });
  assert.equal(r.status, 69, `expected exit 69, got ${r.status}: ${r.stderr}`);
  assert.match(r.stderr, new RegExp(ENV_MODEL), 'the refusal did not name the missing model variable');
  // It must refuse BEFORE reaching the network — a connection error would prove the wrong thing.
  assert.ok(!/ECONNREFUSED|fetch failed/.test(r.stderr),
    'the seam tried to call an unconfigured gateway instead of refusing');
});

test('AC6 — `status` reports the model as unconfigured without needing a database', () => {
  const env = { ...process.env };
  delete env.VLOGOPS_DB_URL;
  delete env[ENV_GATEWAY_URL];
  delete env[ENV_MODEL];
  const r = spawnSync(process.execPath, [SCRIBE_CLI, 'status'], { encoding: 'utf8', env });
  assert.equal(r.status, 0, `status failed: ${r.stderr}`);
  const out = JSON.parse(r.stdout);
  assert.equal(out.model_configured, false);
  assert.match(out.contract_id, /^[0-9a-f]{64}$/);
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// AC1 / AC2 — the real pack becomes a Master Story Package, explicitly stubbed.
// ─────────────────────────────────────────────────────────────────────────────────────────

test('AC1 — the real pack becomes a Master Story Package through the real CLI', () => {
  const emit = path.join(tmpDir, 'package.md');
  const emitJson = path.join(tmpDir, 'package.json');

  const r = runCli(SCRIBE_CLI, [
    'draft', '--pack', realPackId, '--model', 'stub', '--emit', emit, '--emit-json', emitJson,
  ]);
  assert.equal(r.status, 0, `scribe draft failed: ${r.stderr}`);

  const out = lastJson(r.stdout);
  assert.match(out.package_id, /^[0-9a-f]{64}$/);
  assert.equal(out.pack_id, realPackId, 'the package is not for the pack Phase 2 compiled');
  assert.equal(out.seed_id, realSeedId, 'the package is not for the seed Phase 1 made');
  assert.equal(out.deduplicated, false);
  assert.ok(out.claims > 0 && out.segments > 0);

  // The binding is recorded, permanently, in the CLI's own output and in the row.
  assert.equal(out.model.provider, 'stub');
  assert.match(out.model.warning, /Not Warwick's voice/);

  assert.ok(fs.existsSync(emit) && fs.statSync(emit).size > 0, 'nothing human-readable was emitted');
  assert.ok(fs.existsSync(emitJson) && fs.statSync(emitJson).size > 0, 'no canonical document was emitted');

  realPackageId = out.package_id;
  console.log(
    `[AC1] THE CHAIN — seed ${realSeedId}\n`
    + `[AC1]          -> pack ${realPackId}\n`
    + `[AC1]          -> package ${realPackageId} (${out.claims} claims, ${out.segments} segments)\n`
    + `[AC1]   derivation_id=${out.derivation_id} contract=${out.contract.version}/${out.contract.id}`,
  );
});

test('AC2 — the stored package carries ONE master and all four siblings derived from it', async () => {
  assert.ok(realPackageId, 'no package was drafted by the previous proof');

  const claims = await pool.query(
    'select kind, count(*)::int as n from vlogops.story_claim where package_id = $1 group by kind',
    [realPackageId],
  );
  const byKind = Object.fromEntries(claims.rows.map((r) => [r.kind, r.n]));
  assert.equal(byKind['story-question'], 1, 'a package must have exactly one story question');
  assert.ok(byKind.beat >= 1, 'the master has no beats');

  const siblings = await pool.query(
    'select sibling, count(*)::int as n from vlogops.story_segment where package_id = $1 group by sibling',
    [realPackageId],
  );
  assert.deepEqual(
    siblings.rows.map((r) => r.sibling).sort(),
    [...SCRIBE_SIBLINGS].sort(),
    'the package does not carry all four siblings',
  );
  for (const row of siblings.rows) assert.ok(row.n > 0, `sibling ${row.sibling} has no segments`);
});

test('AC2 — a sibling segment cannot exist without a master, in the DATABASE', async () => {
  // The application refuses this first, by name (proven in scribe-seam.test.mjs). This proves
  // the second layer: with the application bypassed entirely, the row is still unwritable.
  const entry = await pool.query(
    'select source_ref from vlogops.evidence_pack_entry where pack_id = $1 order by ordinal limit 1',
    [realPackId],
  );

  await assert.rejects(
    () => pool.query(
      `insert into vlogops.story_segment
         (package_id, sibling, ordinal, role, text, claim_id, pack_id, source_ref)
       values ($1,'blog',9001,'paragraph','a sibling with no master','no-such-claim',$2,$3)`,
      [realPackageId, realPackId, entry.rows[0].source_ref],
    ),
    (err) => {
      assert.match(err.message, /story_segment_claim_fk/, `refused for the wrong reason: ${err.message}`);
      return true;
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// AC3 — TRACEABILITY, END TO END, CHECKED FROM OUTSIDE THE CODE THAT WROTE IT.
// ─────────────────────────────────────────────────────────────────────────────────────────

test('AC3 — every sibling segment resolves to a master claim and to a real pack entry', async () => {
  const result = await verifyStoryPackage(pool, realPackageId);
  assert.deepEqual(result.problems, [], 'the stored package does not verify');
  assert.ok(result.ok);
  assert.ok(result.segmentCount > 0, 'a package with no segments cannot evidence traceability');
  assert.equal(result.segmentsTraced, result.segmentCount, 'not every segment traced');

  console.log(
    `[AC3] verify: ${result.segmentsTraced}/${result.segmentCount} segments traced, `
    + `${result.claimCount} master claims, 0 problems`,
  );
});

test('AC3 — the trace goes all the way to FROZEN BYTES, by SQL, with no application code', async () => {
  // The strongest form of the acceptance property: a reader who was told nothing can join the
  // sibling to its master, its master to a citation, the citation to a pack entry, and the pack
  // entry to the immutable snapshot Phase 1 froze — and count the ones that fail. It is zero.
  const broken = await pool.query(`
    select s.sibling, s.ordinal
      from vlogops.story_segment s
      join vlogops.story_claim mc
        on mc.package_id = s.package_id and mc.claim_id = s.claim_id
      left join vlogops.story_claim_citation cc
        on cc.package_id = s.package_id and cc.claim_id = s.claim_id and cc.source_ref = s.source_ref
      left join vlogops.evidence_pack_entry e
        on e.pack_id = s.pack_id and e.source_ref = s.source_ref
      left join vlogops.source_snapshot ss
        on ss.seed_id = e.seed_id and ss.source_ref = e.source_ref
     where s.package_id = $1
       and (cc.claim_id is null or e.source_ref is null or ss.source_ref is null
            or ss.content is null)`,
    [realPackageId],
  );
  assert.equal(broken.rowCount, 0,
    `segments whose trace does not reach frozen bytes: ${JSON.stringify(broken.rows)}`);

  const total = await pool.query(
    'select count(*)::int as n from vlogops.story_segment where package_id = $1', [realPackageId],
  );
  assert.ok(total.rows[0].n > 0);
  console.log(`[AC3] SQL join: ${total.rows[0].n} segments, 0 with a broken trace to frozen bytes`);
});

test('AC3 — every master claim rests on at least one entry that is really in the pack', async () => {
  const uncited = await pool.query(`
    select c.claim_id from vlogops.story_claim c
     where c.package_id = $1
       and not exists (
         select 1 from vlogops.story_claim_citation cc
           join vlogops.evidence_pack_entry e
             on e.pack_id = cc.pack_id and e.source_ref = cc.source_ref
          where cc.package_id = c.package_id and cc.claim_id = c.claim_id)`,
    [realPackageId],
  );
  assert.equal(uncited.rowCount, 0, `master claims resting on nothing: ${JSON.stringify(uncited.rows)}`);
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// AC4 — SIBLINGS CANNOT DRIFT. Planted, at the layer the application cannot reach.
// ─────────────────────────────────────────────────────────────────────────────────────────

test('AC4 — PLANTED DRIFT: a sibling citing evidence its master does not hold is REFUSED', async () => {
  // The subtle case, and the one a naive citation check passes. Everything about this row is
  // real: a real package, a real sibling, a real master claim of that package, and a real entry
  // of that pack. The only thing wrong with it is that the master does not rest on that entry —
  // which is exactly how a blog quietly acquires a claim the video never made.
  const seg = await pool.query(
    `select claim_id, source_ref from vlogops.story_segment
      where package_id = $1 and sibling = 'blog' order by ordinal limit 1`,
    [realPackageId],
  );
  assert.equal(seg.rowCount, 1, 'no blog segment to plant against');
  const { claim_id: claimId } = seg.rows[0];

  const foreign = await pool.query(
    `select e.source_ref from vlogops.evidence_pack_entry e
      where e.pack_id = $1
        and e.source_ref not in (
          select cc.source_ref from vlogops.story_claim_citation cc
           where cc.package_id = $2 and cc.claim_id = $3)
      order by e.ordinal limit 1`,
    [realPackId, realPackageId, claimId],
  );
  assert.equal(foreign.rowCount, 1,
    'this pack has no entry outside the master claim\'s citations, so drift cannot be planted');
  const plantedRef = foreign.rows[0].source_ref;

  await assert.rejects(
    () => pool.query(
      `insert into vlogops.story_segment
         (package_id, sibling, ordinal, role, text, claim_id, pack_id, source_ref)
       values ($1,'blog',9002,'paragraph','PLANTED DRIFT: real evidence, wrong master.',$2,$3,$4)`,
      [realPackageId, claimId, realPackId, plantedRef],
    ),
    (err) => {
      // The SPECIFIC constraint, named. "violates foreign key" alone would also pass if some
      // other key had fired for some other reason, and a refusal for the wrong reason is not
      // evidence that this rule is the one holding.
      assert.match(err.message, /story_segment_cites_its_master/,
        `planted drift was refused for the wrong reason: ${err.message}`);
      return true;
    },
  );

  console.log(
    `[AC4] PLANTED: blog segment adapting "${claimId}" while citing "${plantedRef}"\n`
    + '[AC4]   -> REFUSED by story_segment_cites_its_master. Nothing written.',
  );

  const still = await pool.query(
    `select count(*)::int as n from vlogops.story_segment
      where package_id = $1 and ordinal = 9002`, [realPackageId],
  );
  assert.equal(still.rows[0].n, 0, 'the planted drift landed after all');
});

test('AC4 — a citation to an entry OUTSIDE the pack is refused by the database', async () => {
  const claim = await pool.query(
    `select claim_id from vlogops.story_claim where package_id = $1 order by claim_id limit 1`,
    [realPackageId],
  );
  await assert.rejects(
    () => pool.query(
      `insert into vlogops.story_claim_citation (package_id, claim_id, pack_id, source_ref)
       values ($1,$2,$3,'file:Deliverables/this-file-was-never-in-the-pack.md')`,
      [realPackageId, claim.rows[0].claim_id, realPackId],
    ),
    (err) => {
      assert.match(err.message, /story_claim_citation_entry_fk/, `refused for the wrong reason: ${err.message}`);
      return true;
    },
  );
});

test('AC4 — a master claim with NO citation is refused at COMMIT, not quietly accepted', async () => {
  // The deferred constraint trigger. A foreign key can say "must exist"; only this can say "at
  // least one". Written as a whole transaction because that is the only place the question is
  // meaningful — mid-transaction, a claim with no citation yet is perfectly normal.
  const client = await pool.connect();
  try {
    const entry = await client.query(
      'select source_ref from vlogops.evidence_pack_entry where pack_id = $1 order by ordinal limit 1',
      [realPackId],
    );
    const ref = entry.rows[0].source_ref;
    const fakeId = 'f'.repeat(64);

    await client.query('BEGIN');
    await client.query(
      `insert into vlogops.story_package
         (package_id, pack_id, seed_id, derivation_id, scribe_version, contract_version,
          contract_id, derivation_rule_version, prompt_sha256, model_binding, manifest,
          story_question, claim_count, segment_count)
       values ($1,$2,$3,$4,'x','x',$4,'x',$4,'{}'::jsonb,'{}'::jsonb,'q?',2,1)`,
      [fakeId, realPackId, realSeedId, 'e'.repeat(64)],
    );
    // A well-formed claim, cited, with a segment on it.
    await client.query(
      `insert into vlogops.story_claim (package_id, claim_id, kind, ordinal, text)
       values ($1,'cited-claim','beat',0,'this one is fine')`, [fakeId],
    );
    await client.query(
      `insert into vlogops.story_claim_citation (package_id, claim_id, pack_id, source_ref)
       values ($1,'cited-claim',$2,$3)`, [fakeId, realPackId, ref],
    );
    await client.query(
      `insert into vlogops.story_segment
         (package_id, sibling, ordinal, role, text, claim_id, pack_id, source_ref)
       values ($1,'blog',0,'paragraph','fine','cited-claim',$2,$3)`,
      [fakeId, realPackId, ref],
    );
    // And the one that must sink the whole transaction: a claim resting on nothing.
    await client.query(
      `insert into vlogops.story_claim (package_id, claim_id, kind, ordinal, text)
       values ($1,'uncited-claim','beat',1,'this one rests on nothing')`, [fakeId],
    );

    await assert.rejects(
      () => client.query('COMMIT'),
      (err) => {
        assert.match(err.message, /cites no evidence/, `wrong refusal: ${err.message}`);
        return true;
      },
    );
  } finally {
    try { await client.query('ROLLBACK'); } catch { /* the transaction is already gone */ }
    client.release();
  }

  const leftovers = await pool.query(
    "select count(*)::int as n from vlogops.story_package where package_id = $1", ['f'.repeat(64)],
  );
  assert.equal(leftovers.rows[0].n, 0, 'a refused package left a row behind');
});

test('AC4 — a package header that MISREPORTS its own row counts is refused at COMMIT', async () => {
  const client = await pool.connect();
  const fakeId = 'a'.repeat(63) + 'b';
  try {
    const entry = await client.query(
      'select source_ref from vlogops.evidence_pack_entry where pack_id = $1 order by ordinal limit 1',
      [realPackId],
    );
    const ref = entry.rows[0].source_ref;

    await client.query('BEGIN');
    await client.query(
      `insert into vlogops.story_package
         (package_id, pack_id, seed_id, derivation_id, scribe_version, contract_version,
          contract_id, derivation_rule_version, prompt_sha256, model_binding, manifest,
          story_question, claim_count, segment_count)
       values ($1,$2,$3,$4,'x','x',$4,'x',$4,'{}'::jsonb,'{}'::jsonb,'q?',99,1)`,
      [fakeId, realPackId, realSeedId, 'e'.repeat(64)],
    );
    await client.query(
      `insert into vlogops.story_claim (package_id, claim_id, kind, ordinal, text)
       values ($1,'only-claim','beat',0,'the only claim')`, [fakeId],
    );
    await client.query(
      `insert into vlogops.story_claim_citation (package_id, claim_id, pack_id, source_ref)
       values ($1,'only-claim',$2,$3)`, [fakeId, realPackId, ref],
    );
    await client.query(
      `insert into vlogops.story_segment
         (package_id, sibling, ordinal, role, text, claim_id, pack_id, source_ref)
       values ($1,'blog',0,'paragraph','fine','only-claim',$2,$3)`,
      [fakeId, realPackId, ref],
    );

    await assert.rejects(
      () => client.query('COMMIT'),
      (err) => {
        assert.match(err.message, /declares 99 claims and holds 1/, `wrong refusal: ${err.message}`);
        return true;
      },
    );
  } finally {
    try { await client.query('ROLLBACK'); } catch { /* already gone */ }
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// AC5 — VERSIONED, and a later contract cannot reach back.
// ─────────────────────────────────────────────────────────────────────────────────────────

test('AC5 — the package records the contract version AND the bytes that produced it', async () => {
  const contract = loadContract();
  const row = await pool.query(
    `select contract_version, contract_id, scribe_version, derivation_rule_version, prompt_sha256
       from vlogops.story_package where package_id = $1`, [realPackageId],
  );
  assert.equal(row.rowCount, 1);
  assert.equal(row.rows[0].contract_version, contract.version);
  assert.equal(row.rows[0].contract_id.trim(), contract.id,
    'the package does not record the exact contract bytes it was drafted under');
});

test('AC5 — an existing package is IMMUTABLE, so no later contract can rewrite it', async () => {
  await assert.rejects(
    () => pool.query(
      "update vlogops.story_package set contract_version = 'scribe-v2' where package_id = $1",
      [realPackageId],
    ),
    (err) => {
      assert.match(err.message, /append-only; UPDATE refused/);
      return true;
    },
  );
  await assert.rejects(
    () => pool.query('delete from vlogops.story_package where package_id = $1', [realPackageId]),
    (err) => {
      assert.match(err.message, /append-only; DELETE refused/);
      return true;
    },
  );
  await assert.rejects(
    () => pool.query(
      "update vlogops.story_segment set text = 'rewritten' where package_id = $1", [realPackageId],
    ),
    (err) => {
      assert.match(err.message, /append-only; UPDATE refused/);
      return true;
    },
  );
});

test('AC5 — the stored manifest still hashes to the package id, recomputed independently', async () => {
  const row = await pool.query(
    'select manifest from vlogops.story_package where package_id = $1', [realPackageId],
  );
  assert.equal(packageIdentity(row.rows[0].manifest), realPackageId,
    'the stored manifest no longer hashes to the package id');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// AC7 — DETERMINISM WHERE DETERMINISM IS HONEST, across separate operating-system processes.
// ─────────────────────────────────────────────────────────────────────────────────────────

test('AC7 — the same pack and contract, drafted again in a SEPARATE process, dedupes', () => {
  const first = path.join(tmpDir, 'first.json');
  const second = path.join(tmpDir, 'second.json');

  const a = runCli(SCRIBE_CLI, ['draft', '--pack', realPackId, '--model', 'stub', '--emit-json', first]);
  assert.equal(a.status, 0, a.stderr);
  const b = runCli(SCRIBE_CLI, ['draft', '--pack', realPackId, '--model', 'stub', '--emit-json', second]);
  assert.equal(b.status, 0, b.stderr);

  const outA = lastJson(a.stdout);
  const outB = lastJson(b.stdout);

  assert.equal(outA.package_id, realPackageId, 'a fresh process reached a different identity');
  assert.equal(outB.package_id, realPackageId);
  assert.equal(outA.derivation_id, outB.derivation_id, 'the derivation identity is not stable');
  assert.equal(outA.prompt_sha256, outB.prompt_sha256, 'the same pack produced different prompt bytes');
  assert.equal(outA.deduplicated, true, 'the second draft wrote a second row');
  assert.equal(outB.deduplicated, true);

  // The canonical documents are compared, not the rows — a content-addressed store that
  // deduplicates cannot be shown deterministic by diffing one row against itself.
  assert.equal(fs.readFileSync(first, 'utf8'), fs.readFileSync(second, 'utf8'),
    'two independent drafts produced different canonical bytes');

  console.log(
    `[AC7] two separate processes -> package_id ${outA.package_id} (identical), `
    + `derivation_id ${outA.derivation_id}, deduplicated=true`,
  );
});

test('AC7 — exactly ONE package row exists for all three drafts of this pack', async () => {
  const rows = await pool.query(
    'select count(*)::int as n from vlogops.story_package where pack_id = $1', [realPackId],
  );
  assert.equal(rows.rows[0].n, 1, 'the store holds more than one package for the same deterministic draft');
});

test('AC7 — determinism is claimed for the STRUCTURE, and the row says what wrote the words', async () => {
  // The honest boundary, asserted rather than described. The package is reproducible because a
  // deterministic composer produced it; the row records that, so nobody can later read this
  // determinism as a property of a language model.
  const row = await pool.query(
    'select model_binding from vlogops.story_package where package_id = $1', [realPackageId],
  );
  const binding = row.rows[0].model_binding;
  assert.equal(binding.provider, 'stub');
  assert.equal(binding.deterministic, true);
  assert.equal(binding.configured, false);
  assert.match(binding.warning, /Not Warwick's voice/,
    'the stored binding does not disclose that this is not Warwick\'s voice');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// The reliability rule, inherited: a later source failure cannot reach an existing package.
// ─────────────────────────────────────────────────────────────────────────────────────────

test('a package verifies from stored bytes alone, with its original sources unreadable', async () => {
  // Scribe never re-reads an original artefact, so this is a property of the design rather than
  // of the test. Proven the same way Phase 2 proves it: point the service at an empty tree and
  // ask the store to answer anyway.
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'vlogops-no-sources-'));
  try {
    const r = runCli(SCRIBE_CLI, ['verify', '--package', realPackageId], { VLOGOPS_REPO_ROOT: empty });
    assert.equal(r.status, 0, `verify failed with sources absent: ${r.stderr}`);
    const out = lastJson(r.stdout);
    assert.equal(out.ok, true);
    assert.equal(out.segments_traced, out.segments);
    assert.ok(out.segments > 0);
  } finally {
    fs.rmSync(empty, { recursive: true, force: true });
  }
});

test('drafting from a pack that does not exist is refused, never invented', () => {
  const r = runCli(SCRIBE_CLI, ['draft', '--pack', '0'.repeat(64), '--model', 'stub']);
  assert.equal(r.status, 65, `expected exit 65, got ${r.status}: ${r.stderr}`);
  assert.match(r.stderr, /there is no path that invents one/);
});
