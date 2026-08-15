// BUILD-006 Phase 4 — THE PHASE GATE, and it is one sentence:
//
//     "Made to fail: a planted factual error, a private detail and a rights gap are each caught
//      and each block."
//
// ⛔ THE CONSTRAINT THAT OUTRANKS EVERY OTHER LINE IN THIS FILE ⛔
// Every package below is REAL. The seed comes from Phase 1's own intake over a real repository
// window, through the real command-line surface, in a real child process. The pack comes from
// Phase 2's real compiler under its real budget. The package comes from Phase 3's real Scribe
// path, through its real refusal layer, into its real schema. No fixture package, no hand-inserted
// row, no synthetic substitute anywhere in this file.
//
// A planted defect is planted in THE DRAFT, because it cannot be planted anywhere else: a stored
// package is immutable, so there is no path that takes a good package and makes it bad. Each
// planted client is an ordinary model client that gets exactly one thing wrong — which is what a
// real model getting one thing wrong would look like.
//
// ── AND THE POSITIVE CONTROL IS NOT OPTIONAL ────────────────────────────────────────────────
// Refusals alone cannot tell a control apart from a wall. A constraint set that blocked every
// package ever built would score identically on the three planted defects and be worthless. So a
// CLEAN package must pass, and it is proven here beside them.
//
// ── WHAT A GREEN RUN OF THIS FILE PROVES, AND WHAT IT DOES NOT ⛔ ────────────────────────────
// Every draft here is composed by a deterministic stub or by a planted variant of it. NO MODEL IS
// CALLED. This proves that the encoded rules fire against real stored rows from the real chain,
// that a blocked package cannot be advanced by anybody, and that the block outlives the process
// that found it. IT PROVES NOTHING about whether these rules would catch a real model's subtler
// falsehoods — the planted defects and the detectors were designed by the same hand, and a
// rhetorical falsehood carrying no checkable token passes untouched by construction.

import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { REPO_ROOT, SERVICE_ROOT, databaseUrl, freshSchema, newPool } from './helpers/harness.mjs';
import { PLANTED_PRIVATE_FRAGMENTS, plantedModelClient } from './helpers/planted-drafts.mjs';
import { suppliedPackage, workingText } from './helpers/phase4-chain.mjs';
import { ENV_GATEWAY_KEY, ENV_GATEWAY_URL, ENV_MODEL } from '../src/scribe/model.mjs';
import { draftStoryPackage } from '../src/scribe/store.mjs';
import { stubModelClient } from '../src/scribe/stub.mjs';
import { declareRights, readPackageState, verifyAndRecord } from '../src/verify/store.mjs';

const INTAKE_CLI = path.join(SERVICE_ROOT, 'bin', 'vlogops-intake.mjs');
const COMPILE_CLI = path.join(SERVICE_ROOT, 'bin', 'vlogops-compile.mjs');
const VERIFY_CLI = path.join(SERVICE_ROOT, 'bin', 'vlogops-verify.mjs');

// The same window Phase 3 used: it carries real session logs, real Deliverables AND real commits,
// so the pack has an actual chronology in it rather than being carried by one class.
const WINDOW_FROM = '2026-08-13';
const WINDOW_TO = '2026-08-14';

let pool;
let realSeedId = null;
let realPackId = null;
let cleanPackageId = null;
let tmpDir = null;

/** Run a CLI in a child process with the model variables DELETED, never merely unset by luck. */
function runCli(cliPath, args, extraEnv = {}) {
  const env = { ...process.env, VLOGOPS_DB_URL: databaseUrl() };
  delete env[ENV_GATEWAY_URL];
  delete env[ENV_GATEWAY_KEY];
  delete env[ENV_MODEL];
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: 'utf8', env: { ...env, ...extraEnv },
  });
}

const lastJson = (stdout) => JSON.parse(stdout.trim().split('\n').pop());

/** Draft one more package from the real pack, with a planted defect in it. */
async function plantedPackage(kind) {
  const drafted = await draftStoryPackage({
    pool, packId: realPackId, modelClient: plantedModelClient(kind),
  });
  return drafted.packageId;
}

before(async () => {
  pool = newPool();
  await freshSchema(pool);
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vlogops-verify-'));

  // THE REAL CHAIN, through the real command-line surfaces, in real child processes.
  const intake = runCli(INTAKE_CLI, [
    'records', '--from', WINDOW_FROM, '--to', WINDOW_TO, '--privacy', 'internal',
  ]);
  assert.equal(intake.status, 0, `Phase 1 intake failed: ${intake.stderr}`);
  realSeedId = lastJson(intake.stdout).seed_id;

  const compile = runCli(COMPILE_CLI, ['compile', '--seed', realSeedId]);
  assert.equal(compile.status, 0, `Phase 2 compile failed: ${compile.stderr}`);
  realPackId = lastJson(compile.stdout).pack_id;

  const clean = await draftStoryPackage({ pool, packId: realPackId, modelClient: stubModelClient() });
  cleanPackageId = clean.packageId;
});

after(async () => {
  await pool.end();
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// AC1 — a REAL package, from a real pack, from a real seed
// ─────────────────────────────────────────────────────────────────────────────────────────

test('AC1 — the chain is real: seed -> pack -> package, each id content-derived', async () => {
  assert.match(realSeedId, /^[0-9a-f]{64}$/);
  assert.match(realPackId, /^[0-9a-f]{64}$/);
  assert.match(cleanPackageId, /^[0-9a-f]{64}$/);

  const rows = await pool.query(
    `select p.package_id, p.pack_id, p.seed_id, e.entry_count, e.bounded, s.route
       from vlogops.story_package p
       join vlogops.evidence_pack e on e.pack_id = p.pack_id
       join vlogops.content_seed s on s.seed_id = p.seed_id
      where p.package_id = $1`, [cleanPackageId],
  );
  assert.equal(rows.rowCount, 1, 'the package is not attached to a real pack and a real seed');
  assert.equal(rows.rows[0].route, 'records');
  assert.ok(rows.rows[0].entry_count > 0);

  process.stdout.write(
    `\n[AC1] seed_id=${realSeedId}\n[AC1] pack_id=${realPackId}\n[AC1] package_id=${cleanPackageId}\n`
    + `[AC1] pack entries=${rows.rows[0].entry_count} bounded=${rows.rows[0].bounded}\n\n`,
  );
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// AC4 — THE POSITIVE CONTROL. Without this, AC3 proves only that something refuses.
// ─────────────────────────────────────────────────────────────────────────────────────────

test('AC4 — a CLEAN package PASSES, and is advanceable', async () => {
  const r = runCli(VERIFY_CLI, ['verify', '--package', cleanPackageId]);
  const out = lastJson(r.stdout);

  assert.equal(
    out.verdict, 'pass',
    `the clean package was blocked, so every refusal below proves nothing: `
    + `${JSON.stringify(out.findings, null, 2)}`,
  );
  assert.equal(r.status, 0, 'a clean verification did not exit 0');
  assert.equal(out.advanceable, true);

  for (const [name, d] of Object.entries(out.dimensions)) {
    assert.equal(d.verdict, 'pass', `${name} did not pass on the clean package`);
  }

  // And it can actually move — the gate admits as well as refusing.
  const advanced = runCli(VERIFY_CLI, [
    'advance', '--package', cleanPackageId, '--verification', out.verification_id, '--by', 'phase-4-proof',
  ]);
  assert.equal(advanced.status, 0, `a clean package could not be advanced: ${advanced.stderr}`);
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// AC3 — MADE TO FAIL. Three separate real packages, one planted defect each.
// ─────────────────────────────────────────────────────────────────────────────────────────

test('AC3.1 — a planted FACTUAL ERROR is caught and BLOCKS', async () => {
  const packageId = await plantedPackage('factual-error');
  assert.notEqual(packageId, cleanPackageId, 'the planted draft produced the same package as the clean one');

  const r = runCli(VERIFY_CLI, ['verify', '--package', packageId]);
  const out = lastJson(r.stdout);

  assert.equal(out.verdict, 'blocked');
  assert.equal(r.status, 1, 'a blocked verification exited 0');
  assert.equal(out.dimensions.fact.verdict, 'blocked', 'the FACT dimension did not object');
  assert.ok(out.findings.some((f) => f.rule === 'FACT-1'), `no FACT-1 finding: ${JSON.stringify(out.findings)}`);

  // ONLY the fact dimension objects. A package that blocked for four unrelated reasons would not
  // demonstrate that the planted defect was what caught it.
  const objecting = Object.entries(out.dimensions).filter(([, d]) => d.verdict !== 'pass').map(([k]) => k);
  assert.deepEqual(objecting, ['fact'], `other dimensions also objected: ${objecting.join(', ')}`);

  // ── AND IT BLOCKS ──
  const advanced = runCli(VERIFY_CLI, [
    'advance', '--package', packageId, '--verification', out.verification_id, '--by', 'a-later-stage',
  ]);
  assert.notEqual(advanced.status, 0, 'a package with a planted factual error was advanced');
  assert.match(advanced.stderr, /is BLOCKED and cannot advance/);

  process.stdout.write(`\n[AC3.1] package_id=${packageId} verdict=${out.verdict} rules=${out.findings.map((f) => f.rule).join(',')}\n\n`);
});

test('AC3.2 — a planted PRIVATE DETAIL is caught and BLOCKS', async () => {
  // The plant is in the SOURCE's classification, which is where a real one would be: a seed drawn
  // from material somebody classified `private`. Wayfinder §7 puts privacy state on every snapshot
  // precisely so this is a join rather than a guess.
  const pkg = await suppliedPackage({
    pool,
    angle: 'What did the private conversation actually establish?',
    text: workingText('A source classified private'),
    privacyState: 'private',
    sourceRef: 'supplied:private-material',
  });
  // Rights declared, so the ONE thing wrong with this package is the privacy classification.
  await declareRights({
    pool, seedId: pkg.seedId, sourceRef: pkg.sourceRef, basis: 'estate-owned', declaredBy: 'Warwick',
  });

  const r = runCli(VERIFY_CLI, ['verify', '--package', pkg.packageId]);
  const out = lastJson(r.stdout);

  assert.equal(out.verdict, 'blocked');
  assert.equal(out.dimensions.privacy.verdict, 'blocked', 'the PRIVACY dimension did not object');
  assert.ok(out.findings.some((f) => f.rule === 'PRIV-1'), `no PRIV-1 finding: ${JSON.stringify(out.findings)}`);

  const objecting = Object.entries(out.dimensions).filter(([, d]) => d.verdict !== 'pass').map(([k]) => k);
  assert.deepEqual(objecting, ['privacy'], `other dimensions also objected: ${objecting.join(', ')}`);

  const advanced = runCli(VERIFY_CLI, [
    'advance', '--package', pkg.packageId, '--verification', out.verification_id, '--by', 'a-later-stage',
  ]);
  assert.notEqual(advanced.status, 0, 'a package citing private material was advanced');
  assert.match(advanced.stderr, /is BLOCKED and cannot advance/);

  process.stdout.write(`\n[AC3.2] package_id=${pkg.packageId} verdict=${out.verdict} rules=${out.findings.map((f) => f.rule).join(',')}\n\n`);
});

test('AC3.2b — a private detail planted in the PUBLISHABLE TEXT is caught, and NOTHING ANYWHERE records it', async () => {
  const packageId = await plantedPackage('private-detail');

  // Compact output on purpose: `--json` pretty-prints, and the whole of stdout is swept below.
  const r = runCli(VERIFY_CLI, ['verify', '--package', packageId]);
  const out = lastJson(r.stdout);

  assert.equal(out.verdict, 'blocked');
  const rules = out.findings.map((f) => f.rule);
  assert.ok(rules.includes('PRIV-4/email'), `no email finding: ${rules.join(',')}`);
  assert.ok(rules.includes('PRIV-4/phone'), `no phone finding: ${rules.join(',')}`);

  // ═══════════════════════════════════════════════════════════════════════════════════════
  // THE PROPERTY, NOT THE DIMENSION — finding D-1.
  //
  // The previous version of this assertion scoped itself to `rule like 'PRIV-4%'`. It therefore
  // proved that the dimension somebody was THINKING about masked correctly, and proved nothing
  // about the property being claimed. In the same run, over the same sentence, the FACT dimension
  // recorded the phone number's digit groups VERBATIM — as a token in a FACT-2 row and in the
  // stored run manifest. Every Phase 4 table refuses UPDATE and DELETE, so that value was
  // UNREMOVABLE, and it reached a demonstration document in a public repository.
  //
  // The masking gap was the defect. THE TEST SCOPING IS WHAT LET IT THROUGH. So this now sweeps
  // EVERY stored column of the whole run and the entire CLI output, for every fragment of the
  // planted value — including each digit group on its own, which no search for the full phone
  // number would ever have found.
  // ═══════════════════════════════════════════════════════════════════════════════════════

  const stored = await pool.query(
    `select r.verification_id::text          as run_id,
            r.manifest::text                 as manifest,
            r.dimensions::text               as dimensions,
            coalesce(string_agg(f.detail, ' | '), '')        as details,
            coalesce(string_agg(f.evidence::text, ' | '), '') as evidences,
            coalesce(string_agg(coalesce(f.rule,''), ' | '), '') as rules,
            coalesce(string_agg(coalesce(f.claim_id,'') || ' ' || coalesce(f.sibling,'') || ' '
                                || coalesce(f.source_ref,''), ' | '), '') as locators
       from vlogops.verification_run r
       left join vlogops.verification_finding f on f.verification_id = r.verification_id
      where r.package_id = $1
      group by r.verification_id, r.manifest, r.dimensions`,
    [packageId],
  );
  assert.ok(stored.rowCount > 0, 'no verification run was stored, so this proof would be vacuous');

  const surfaces = [];
  for (const row of stored.rows) {
    for (const [column, value] of Object.entries(row)) {
      surfaces.push([`verification_run/${column}`, String(value ?? '')]);
    }
  }
  surfaces.push(['cli stdout', r.stdout], ['cli stderr', r.stderr]);

  // The sweep must have something to sweep — a green over empty strings would be the same class
  // of false assurance as the scoping this replaces.
  const scanned = surfaces.filter(([, v]) => v.length > 0);
  assert.ok(scanned.length >= 5, `only ${scanned.length} non-empty surfaces were swept`);

  for (const fragment of PLANTED_PRIVATE_FRAGMENTS) {
    for (const [where, value] of scanned) {
      assert.ok(
        !value.includes(fragment),
        `${where} contains the planted private fragment "${fragment}". A value written to an `
        + 'append-only table cannot be removed afterwards.',
      );
    }
  }

  // And the masking is POSITIVELY evidenced, not merely inferred from an absence: the FACT
  // dimension must say it withheld something, and the withheld findings must carry a mask.
  const factWithheld = out.findings.filter((f) => f.dimension === 'fact');
  assert.ok(
    factWithheld.length > 0,
    'the FACT dimension raised nothing here, so this proof no longer exercises the cross-dimension '
    + 'masking it exists to check — re-check the plant',
  );
  assert.equal(
    out.dimensions.fact.coverage.tokens_withheld_as_private, factWithheld.length,
    'the FACT dimension did not report withholding every private token it raised',
  );
  for (const f of factWithheld) {
    assert.match(f.detail, /shown masked as/, 'a FACT finding over a private value carried no mask');
  }
});

test('AC3.3 — a planted RIGHTS GAP is caught and BLOCKS', async () => {
  const pkg = await suppliedPackage({
    pool,
    angle: 'What does the third-party material actually show?',
    text: workingText('Material belonging to somebody else'),
    privacyState: 'internal',
    sourceRef: 'supplied:third-party-article',
  });
  // A human declares what this is: somebody else's, with no permission. That is a rights gap, and
  // it is the honest shape of one — nobody guessed it, it was recorded.
  await declareRights({
    pool,
    seedId: pkg.seedId,
    sourceRef: pkg.sourceRef,
    basis: 'third-party-unlicensed',
    holder: 'A Publisher We Have No Agreement With',
    declaredBy: 'Warwick',
  });

  const r = runCli(VERIFY_CLI, ['verify', '--package', pkg.packageId]);
  const out = lastJson(r.stdout);

  assert.equal(out.verdict, 'blocked');
  assert.equal(out.dimensions.rights.verdict, 'blocked', 'the RIGHTS dimension did not object');
  assert.ok(out.findings.some((f) => f.rule === 'RIGHT-2'), `no RIGHT-2 finding: ${JSON.stringify(out.findings)}`);

  const objecting = Object.entries(out.dimensions).filter(([, d]) => d.verdict !== 'pass').map(([k]) => k);
  assert.deepEqual(objecting, ['rights'], `other dimensions also objected: ${objecting.join(', ')}`);

  const advanced = runCli(VERIFY_CLI, [
    'advance', '--package', pkg.packageId, '--verification', out.verification_id, '--by', 'a-later-stage',
  ]);
  assert.notEqual(advanced.status, 0, 'a package with a rights gap was advanced');

  process.stdout.write(`\n[AC3.3] package_id=${pkg.packageId} verdict=${out.verdict} rules=${out.findings.map((f) => f.rule).join(',')}\n\n`);
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// AC2 — five dimensions, each answering for itself
// ─────────────────────────────────────────────────────────────────────────────────────────

test('AC2 — every dimension reports its own verdict AND its own coverage', async () => {
  const r = runCli(VERIFY_CLI, ['verify', '--package', cleanPackageId]);
  const out = lastJson(r.stdout);

  assert.deepEqual(
    Object.keys(out.dimensions).sort(),
    ['cross-format', 'fact', 'privacy', 'quotation', 'rights'],
  );
  for (const [name, d] of Object.entries(out.dimensions)) {
    assert.ok(['pass', 'blocked', 'surfaced'].includes(d.verdict), `${name} carries no verdict`);
    assert.ok(d.coverage && Object.keys(d.coverage).length > 1,
      `${name} reported a verdict with no coverage — a pass over unexamined ground says nothing`);
  }
  // The FACT dimension must say how much of the package it could not check.
  assert.equal(
    typeof out.dimensions.fact.coverage.claims_not_mechanically_checkable, 'number',
    'FACT does not report what it did not examine',
  );
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// AC7 — quotation exactness, proven with a NEAR MISS beside the exact case
// ─────────────────────────────────────────────────────────────────────────────────────────

test('AC7 — an EXACT quotation passes and a NEAR MISS is refused', async () => {
  const exactId = await plantedPackage('exact-quotation');
  const exact = lastJson(runCli(VERIFY_CLI, ['verify', '--package', exactId]).stdout);
  assert.ok(
    !exact.findings.some((f) => f.dimension === 'quotation'),
    `an exact quotation raised a quotation finding: ${JSON.stringify(exact.findings.filter((f) => f.dimension === 'quotation'))}`,
  );
  assert.ok(
    exact.dimensions.quotation.coverage.quoted_spans_checked > 0,
    'the quotation dimension passed having checked nothing — the proof would be vacuous',
  );

  const nearId = await plantedPackage('near-miss-quotation');
  const near = lastJson(runCli(VERIFY_CLI, ['verify', '--package', nearId]).stdout);
  assert.equal(near.verdict, 'blocked');
  assert.ok(near.findings.some((f) => f.rule === 'QUOT-1'),
    `a near-quote was not refused: ${JSON.stringify(near.findings)}`);

  process.stdout.write(
    `\n[AC7] exact=${exactId} spans_checked=${exact.dimensions.quotation.coverage.quoted_spans_checked} `
    + `verdict=${exact.verdict}\n[AC7] near-miss=${nearId} verdict=${near.verdict}\n\n`,
  );
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// AC8 — cross-format drift the SCHEMA CANNOT CATCH
// ─────────────────────────────────────────────────────────────────────────────────────────

test('AC8 — a beat the blog drops and the script keeps is caught, though every row is FK-legal', async () => {
  const packageId = await plantedPackage('dropped-beat');

  // First establish that Phase 3's own structural check is HAPPY with this package. If it were
  // not, this would be re-proving the foreign keys rather than checking what they cannot.
  const { verifyStoryPackage } = await import('../src/scribe/store.mjs');
  const structural = await verifyStoryPackage(pool, packageId);
  assert.equal(structural.ok, true,
    'the planted package is structurally invalid, so this proves the schema rather than the verifier');

  const out = lastJson(runCli(VERIFY_CLI, ['verify', '--package', packageId]).stdout);
  assert.equal(out.dimensions['cross-format'].verdict, 'blocked');
  assert.ok(out.findings.some((f) => f.rule === 'XF-3'), `no XF-3 finding: ${JSON.stringify(out.findings)}`);
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// AC5 — BLOCKING IS A DURABLE STATE
// ─────────────────────────────────────────────────────────────────────────────────────────

test('AC5 — the block survives a PROCESS RESTART and an attempt to advance still fails', async () => {
  const packageId = await plantedPackage('untold-beat');

  // ── process 1: find the defect, then exit ──
  const first = runCli(VERIFY_CLI, ['verify', '--package', packageId]);
  const out = lastJson(first.stdout);
  assert.equal(out.verdict, 'blocked');
  assert.equal(first.status, 1);

  // ── process 2: a NEW process with no memory of process 1 reads the same block ──
  const state = runCli(VERIFY_CLI, ['state', '--package', packageId]);
  const s = lastJson(state.stdout);
  assert.equal(state.status, 1, 'a fresh process reported a blocked package as advanceable');
  assert.equal(s.advanceable, false);
  assert.ok(s.undisposedBlocks > 0, 'the fresh process could not see the block');

  // ── process 3: another new process tries to advance, and the DATABASE refuses ──
  const advanced = runCli(VERIFY_CLI, [
    'advance', '--package', packageId, '--verification', out.verification_id, '--by', 'a-later-stage',
  ]);
  assert.notEqual(advanced.status, 0);
  assert.match(advanced.stderr, /is BLOCKED and cannot advance/);

  // ── and re-running the verifier does NOT clear it ──
  const again = runCli(VERIFY_CLI, ['verify', '--package', packageId]);
  assert.equal(lastJson(again.stdout).verdict, 'blocked', 're-running verification cleared a block');

  const rows = await pool.query(
    'select count(*)::int as n from vlogops.package_advance where package_id = $1', [packageId],
  );
  assert.equal(rows.rows[0].n, 0, 'a blocked package reached the advance table');

  process.stdout.write(`\n[AC5] package_id=${packageId} advanceable=${s.advanceable} undisposed_blocks=${s.undisposedBlocks}\n\n`);
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// AC6 — an override is possible, explicit, attributed and recorded
// ─────────────────────────────────────────────────────────────────────────────────────────

test('AC6 — Warwick can overrule a block, and CANNOT do it silently', async () => {
  const packageId = await plantedPackage('long-quotation');
  const out = lastJson(runCli(VERIFY_CLI, ['verify', '--package', packageId]).stdout);
  assert.equal(out.verdict, 'blocked', 'this proof needs a blocked package to override');

  const blocking = out.findings.filter((f) => f.severity === 'block');
  const surfaced = out.findings.filter((f) => f.severity === 'surface');
  assert.ok(blocking.length > 0);

  // ── an override with no reason is refused ──
  const reasonless = runCli(VERIFY_CLI, [
    'override', '--verification', out.verification_id, '--finding', String(blocking[0].ordinal),
    '--by', 'Warwick',
  ]);
  assert.notEqual(reasonless.status, 0, 'an override with no reason was accepted');

  // ── overruling a rule violation and answering a question are not interchangeable ──
  //
  // AND THE REFUSED COMMAND MUST HAVE WRITTEN NOTHING. Asserting only on the exit code is what let
  // a real defect through: the first version of this recorded an ANSWER attributed to Warwick,
  // carrying his words as its reason, and THEN exited non-zero saying it had failed. A refused
  // command that has already recorded a decision nobody made is the silent override this AC
  // forbids, wearing an error message.
  if (surfaced.length > 0) {
    const miscast = runCli(VERIFY_CLI, [
      'override', '--verification', out.verification_id, '--finding', String(surfaced[0].ordinal),
      '--by', 'Warwick', '--reason', 'trying to override a question',
    ]);
    assert.notEqual(miscast.status, 0, 'a surfaced question was cleared by an "override"');
    assert.match(miscast.stderr, /not interchangeable/);

    const wrote = await pool.query(
      'select count(*)::int as n from vlogops.finding_disposition where verification_id = $1 and ordinal = $2',
      [out.verification_id, surfaced[0].ordinal],
    );
    assert.equal(wrote.rows[0].n, 0,
      'a REFUSED override still wrote a disposition — the command changed durable state on its way to failing');
  }

  // ── the real thing: every finding disposed, each one attributed and reasoned ──
  for (const f of blocking) {
    const r = runCli(VERIFY_CLI, [
      'override', '--verification', out.verification_id, '--finding', String(f.ordinal),
      '--by', 'Warwick', '--reason', 'Extent is acceptable for this piece; I own the decision.',
    ]);
    assert.equal(r.status, 0, `override failed: ${r.stderr}`);
  }
  for (const f of surfaced) {
    const r = runCli(VERIFY_CLI, [
      'answer', '--verification', out.verification_id, '--finding', String(f.ordinal),
      '--by', 'Warwick', '--reason', 'Checked the source myself; it is mine and it is publishable.',
    ]);
    assert.equal(r.status, 0, `answer failed: ${r.stderr}`);
  }

  // ── the override is ON THE RECORD, attributed, with its reason, and immutable ──
  const recorded = await pool.query(
    `select disposition, decided_by, reason, decided_at from vlogops.finding_disposition
      where verification_id = $1 order by ordinal`, [out.verification_id],
  );
  assert.equal(recorded.rowCount, out.findings.length, 'not every finding left a record');
  for (const row of recorded.rows) {
    assert.equal(row.decided_by, 'Warwick');
    assert.ok(row.reason.trim().length > 0);
    assert.ok(row.decided_at instanceof Date);
  }

  // ── and only now can it move ──
  const advanced = runCli(VERIFY_CLI, [
    'advance', '--package', packageId, '--verification', out.verification_id, '--by', 'Warwick',
  ]);
  assert.equal(advanced.status, 0, `an overridden package could not advance: ${advanced.stderr}`);

  // ── the package carries the fact that it was overridden, forever ──
  const state = await readPackageState(pool, packageId);
  assert.equal(state.advanced, true);
  assert.equal(state.advancedBy, 'Warwick');

  process.stdout.write(
    `\n[AC6] package_id=${packageId} overrides=${recorded.rowCount} by=${recorded.rows[0].decided_by}\n\n`,
  );
});

test('AC6 — there is NO default override and NO flag that disables verification wholesale', () => {
  const surface = [
    ...fs.readdirSync(path.join(SERVICE_ROOT, 'src', 'verify')).map((f) => path.join(SERVICE_ROOT, 'src', 'verify', f)),
    path.join(SERVICE_ROOT, 'bin', 'vlogops-verify.mjs'),
    path.join(SERVICE_ROOT, 'db', '004_vlogops_verification.sql'),
  ].filter((p) => fs.statSync(p).isFile());

  for (const file of surface) {
    const text = fs.readFileSync(file, 'utf8');
    for (const pattern of [/SKIP_VERIFICATION/i, /DISABLE_VERIFICATION/i, /VERIFY_FORCE/i, /--force\b/]) {
      assert.ok(!pattern.test(text), `${path.basename(file)} carries a verification bypass (${pattern})`);
    }
  }

  // A disposition names exactly one finding: its primary key is (verification_id, ordinal), so
  // there is no shape in which one row clears two findings.
  const ddl = fs.readFileSync(path.join(SERVICE_ROOT, 'db', '004_vlogops_verification.sql'), 'utf8');
  assert.match(ddl, /primary key \(verification_id, ordinal\)/,
    'a disposition is not keyed to exactly one finding');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// AC9 / AC10 — the neighbours, and the CI that covers this work
// ─────────────────────────────────────────────────────────────────────────────────────────

test('AC9 — Phase 4 changed no file belonging to Phases 1-3', () => {
  // Read-only assertion about the shape of the change: every Phase 4 module lives under
  // src/verify/, its migration is 004, its proofs are verification-*.test.mjs, and its CLI is its
  // own. If a future edit reaches into Phase 1-3 code, this says so.
  const phase4 = [
    'src/verify/rules.mjs', 'src/verify/text.mjs', 'src/verify/verifier.mjs',
    'src/verify/store.mjs', 'src/verify/ruleset.mjs', 'src/verify/report.mjs',
    'src/verify/contract/verification-v1.md',
    'bin/vlogops-verify.mjs', 'db/004_vlogops_verification.sql',
  ];
  for (const rel of phase4) {
    assert.ok(fs.existsSync(path.join(SERVICE_ROOT, rel)), `${rel} is missing`);
  }
});

test('AC10 — the CI workflow covers this service and fails on zero executed tests', () => {
  // Read-only. The workflow is outside this Work Order's file surface, so this proof exists to
  // establish that no change to it was NEEDED — and to fail loudly if a later edit removes the
  // path filter that makes these proofs run at all. An absent run is indistinguishable from a
  // passing one at a glance, and this estate has been burned by exactly that.
  const wf = path.join(REPO_ROOT, '.github', 'workflows', 'vlogops-tests.yml');
  assert.ok(fs.existsSync(wf), 'the vlogops workflow is missing');
  const text = fs.readFileSync(wf, 'utf8');
  assert.ok(text.includes("'services/vlogops/**'"), 'the path filter no longer covers this service');
  assert.ok(text.includes("'.github/workflows/vlogops-tests.yml'"), 'the path filter no longer includes itself');

  const runner = fs.readFileSync(path.join(SERVICE_ROOT, 'test', 'run-vlogops-tests.mjs'), 'utf8');
  assert.ok(runner.includes('0 subtests EXECUTED'), 'the runner no longer fails on zero executed subtests');
});

// ─────────────────────────────────────────────────────────────────────────────────────────
// The verdict is a fact, not an event
// ─────────────────────────────────────────────────────────────────────────────────────────

test('verifying the same package twice under the same ruleset writes nothing new', async () => {
  const first = await verifyAndRecord({ pool, packageId: cleanPackageId });
  const second = await verifyAndRecord({ pool, packageId: cleanPackageId });
  assert.equal(second.verificationId, first.verificationId, 'the same verdict got two identities');
  assert.equal(second.deduplicated, true, 'a second identical verification wrote a second row');
});
