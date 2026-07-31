import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  REASON_ENUM,
  DENY_THRESHOLD,
  TARGET_TOOLS,
  DECISION,
  SCHEMA_VERSION,
  SPECIALIST_MATCH_ENUM,
  delegationLedgerDir,
  delegationLedgerPath,
  readLedger,
  appendLedgerRecord,
  isCheckpointRecord,
  countDirectCallsSinceCheckpoint,
  buildThresholdDenyMessage,
  validateLedgerRecord,
  resolveSpecialistMatch,
  evaluateDelegationGate,
  recordTaskDispatch,
  validateJustifyReason,
  justify,
  runObserveHook,
  runCheckHook,
  toHookOutput,
} from './delegation-gate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(__dirname, 'fixtures', 'programme-state.minimal.json');
const DELEGATION_SRC = join(__dirname, 'delegation-gate.mjs');
const SCHEMA_PATH = join(__dirname, 'delegation-ledger-record.schema.json');

function loadFixture() {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
}

// ---------------------------------------------------------------------------
// Schema-valid record builders — every literal record constructed in this
// file goes through one of these, so a test can never accidentally exercise
// appendLedgerRecord's write-side validation with a record that was already
// invalid for reasons unrelated to what the test is trying to prove.
// ---------------------------------------------------------------------------

function validDirectCall({ ticket, tool_name = 'Write', ts = '2026-01-01T00:00:00.000Z', session_id = null } = {}) {
  return { schema_version: SCHEMA_VERSION, ts, session_id, ticket, kind: 'direct-call', tool_name };
}

function validTask({
  ticket,
  subagent_type = 'general-purpose',
  description = null,
  governing_specialist = null,
  specialist_match = 'unchecked',
  ts = '2026-01-01T00:00:00.000Z',
  session_id = null,
} = {}) {
  return {
    schema_version: SCHEMA_VERSION,
    ts,
    session_id,
    ticket,
    kind: 'task',
    subagent_type,
    description,
    governing_specialist,
    specialist_match,
  };
}

function validJustify({
  ticket,
  reason = 'architecture',
  note = null,
  ts = '2026-01-01T00:00:00.000Z',
  session_id = null,
} = {}) {
  return {
    schema_version: SCHEMA_VERSION,
    ts,
    session_id,
    ticket,
    kind: 'justify',
    reason,
    note,
    governing_specialist: 'larry',
  };
}

// A real estate: a real git repo (the CANONICAL worktree) plus a second real
// worktree on another branch (the WRONG place to be working from) — same
// shape as worktree-guard.test.mjs's own makeEstate, because this gate's
// worktree-alignment behaviour must be proven against the exact same kind of
// estate worktree-guard.mjs itself is proven against.
//
// `agentSlugs`, when given, writes `.claude/agents/<slug>.md` fixture files
// into the canonical worktree so a test can exercise the "declared"
// specialist-match branch (decision §4a) against a real, readable roster.
function makeEstate({
  programme = 'BUILD-DGTEST',
  canonicalBranch = 'build-x/canonical',
  ticket = 'T-02',
  agentSlugs = [],
} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'governor-delegation-'));
  const repo = join(root, 'primary');
  mkdirSync(repo, { recursive: true });
  execFileSync('git', ['-C', repo, 'init', '-q', '-b', canonicalBranch]);
  execFileSync('git', ['-C', repo, 'config', 'user.email', 'test@example.com']);
  execFileSync('git', ['-C', repo, 'config', 'user.name', 'Test']);

  const canonicalWorktree = execFileSync('git', ['-C', repo, 'rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
  })
    .trim()
    .replace(/\\/g, '/');

  if (agentSlugs.length) {
    const agentsDir = join(repo, '.claude', 'agents');
    mkdirSync(agentsDir, { recursive: true });
    for (const slug of agentSlugs) {
      writeFileSync(join(agentsDir, `${slug}.md`), `---\nname: ${slug}\n---\nfixture specialist\n`);
    }
  }

  writeFileSync(join(repo, 'seed.txt'), 'seed\n');
  execFileSync('git', ['-C', repo, 'add', '.']);
  execFileSync('git', ['-C', repo, 'commit', '-q', '-m', 'seed']);
  const seedSha = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

  const other = join(root, 'other');
  execFileSync('git', ['-C', repo, 'worktree', 'add', '-q', '-b', 'some/other-branch', other, seedSha]);
  const otherWorktree = execFileSync('git', ['-C', other, 'rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
  })
    .trim()
    .replace(/\\/g, '/');

  const home = join(repo, 'Deliverables', programme);
  mkdirSync(home, { recursive: true });

  const doc = loadFixture();
  doc.programme.id = programme;
  doc.programme.status = 'active';
  doc.programme.home = `Deliverables/${programme}`;
  doc.repository.worktree = canonicalWorktree;
  doc.repository.branch = canonicalBranch;
  doc.resumption.worktree = canonicalWorktree;
  doc.resumption.branch = canonicalBranch;
  doc.resumption.ticket = ticket;

  const statePath = join(home, 'programme-state.json');
  writeFileSync(statePath, JSON.stringify(doc, null, 2) + '\n');
  execFileSync('git', ['-C', repo, 'add', '.']);
  execFileSync('git', ['-C', repo, 'commit', '-q', '-m', 'bank']);

  // The ledger's own home, isolated from the real ~/.mypka on this machine.
  const ledgerDir = mkdtempSync(join(tmpdir(), 'governor-delegation-ledger-'));

  return {
    root,
    repo,
    canonicalWorktree,
    canonicalBranch,
    other,
    otherWorktree,
    statePath,
    doc,
    ticket,
    ledgerDir,
    ledgerOpts: { envOverride: ledgerDir },
    cleanup: () => {
      try {
        rmSync(root, { recursive: true, force: true });
      } catch {
        /* Windows sometimes holds the worktree lock briefly; disposable */
      }
      try {
        rmSync(ledgerDir, { recursive: true, force: true });
      } catch {
        /* disposable */
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Constants match the approved design exactly
// ---------------------------------------------------------------------------

test('constants match the approved design: threshold 3, targets Write/Edit/MultiEdit/Bash only, the closed reason enum, schema_version 1, the 3-way specialist_match enum', () => {
  assert.equal(DENY_THRESHOLD, 3);
  assert.deepEqual(TARGET_TOOLS, ['Write', 'Edit', 'MultiEdit', 'Bash']);
  assert.deepEqual(REASON_ENUM, ['architecture', 'integration', 'safety', 'judgement', 'git-lifecycle', 'emergency']);
  assert.equal(SCHEMA_VERSION, 1);
  assert.deepEqual(SPECIALIST_MATCH_ENUM, ['declared', 'no-fit-declared', 'unchecked']);
});

// ---------------------------------------------------------------------------
// Schema file drift check — the hand-written validator and the documented
// JSON Schema must agree (decision §5: "the hand-written JS validator should
// agree with it exactly"). No ajv/ajv-like dependency is available or wanted
// (dependency_policy: no-new-runtime-deps), so this proves agreement on the
// closed vocabularies both sides must share, without a schema-execution engine.
// ---------------------------------------------------------------------------

test('delegation-ledger-record.schema.json exists, parses, and its enums/consts match the JS constants exactly', () => {
  const raw = readFileSync(SCHEMA_PATH, 'utf8');
  const schema = JSON.parse(raw);
  assert.equal(schema.$defs.task.properties.schema_version.const, SCHEMA_VERSION);
  assert.equal(schema.$defs.justify.properties.schema_version.const, SCHEMA_VERSION);
  assert.equal(schema.$defs.directCall.properties.schema_version.const, SCHEMA_VERSION);
  assert.deepEqual(schema.$defs.task.properties.specialist_match.enum, SPECIALIST_MATCH_ENUM);
  assert.deepEqual(schema.$defs.justify.properties.reason.enum, REASON_ENUM);
  assert.deepEqual(schema.$defs.directCall.properties.tool_name.enum, TARGET_TOOLS);
  assert.equal(schema.$defs.justify.properties.governing_specialist.const, 'larry');
  assert.equal(schema.$defs.task.properties.kind.const, 'task');
  assert.equal(schema.$defs.justify.properties.kind.const, 'justify');
  assert.equal(schema.$defs.directCall.properties.kind.const, 'direct-call');
  // justify records never carry specialist_match at all (decision §4b).
  assert.equal('specialist_match' in schema.$defs.justify.properties, false);
});

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

test('validateJustifyReason accepts only the closed enum — "convenience" is the exact value Warwick named as OUT', () => {
  for (const r of REASON_ENUM) assert.equal(validateJustifyReason(r), true, r);
  assert.equal(validateJustifyReason('convenience'), false);
  assert.equal(validateJustifyReason(undefined), false);
  assert.equal(validateJustifyReason(''), false);
  assert.equal(validateJustifyReason('Architecture'), false, 'case-sensitive — no fuzzy matching');
  assert.equal(validateJustifyReason(42), false);
});

test('isCheckpointRecord recognises task and justify records, and nothing else', () => {
  assert.equal(isCheckpointRecord({ kind: 'task' }), true);
  assert.equal(isCheckpointRecord({ kind: 'justify' }), true);
  assert.equal(isCheckpointRecord({ kind: 'direct-call' }), false);
  assert.equal(isCheckpointRecord({}), false);
  assert.equal(isCheckpointRecord(null), false);
});

test('countDirectCallsSinceCheckpoint counts only direct-call records after the most recent checkpoint, TRUSTING ARRAY (physical/append) ORDER — never re-sorted by ts (decision §3)', () => {
  const records = [
    { ts: '2026-01-01T00:00:00.000Z', kind: 'direct-call' },
    { ts: '2026-01-01T00:00:01.000Z', kind: 'direct-call' },
    { ts: '2026-01-01T00:00:02.000Z', kind: 'task' },
    { ts: '2026-01-01T00:00:03.000Z', kind: 'direct-call' },
  ];
  assert.equal(countDirectCallsSinceCheckpoint(records), 1);
  assert.equal(countDirectCallsSinceCheckpoint([]), 0);

  // Array order is DELIBERATELY not ts-ascending here: position 0 has the
  // LATEST ts, position 1 (a checkpoint) has the EARLIEST ts, as a clock-step
  // would produce. A defensive ts-sort (the behaviour this decision REMOVES)
  // would put the checkpoint FIRST and count all three direct-calls after it
  // (answer 3). Trusting physical order instead — the checkpoint sits at
  // position 1, so only what follows it in the ARRAY counts (answer 2).
  const clockStepped = [
    { ts: '2026-01-01T00:00:03.000Z', kind: 'direct-call' },
    { ts: '2026-01-01T00:00:00.000Z', kind: 'task' },
    { ts: '2026-01-01T00:00:01.000Z', kind: 'direct-call' },
    { ts: '2026-01-01T00:00:02.000Z', kind: 'direct-call' },
  ];
  assert.equal(
    countDirectCallsSinceCheckpoint(clockStepped),
    2,
    'a ts-sort would have answered 3 here; physical order answers 2 — proving no sort happens'
  );
});

test('buildThresholdDenyMessage states the count and both unblock paths, with the EXACT justify command', () => {
  const msg = buildThresholdDenyMessage({ ticket: 'T-42', count: 3, threshold: 3 });
  assert.match(msg, /3 direct Write\/Edit\/MultiEdit\/mutating-Bash call\(s\)/);
  assert.match(msg, /T-42/);
  assert.match(msg, /Dispatch a subagent via the Task tool/);
  assert.match(
    msg,
    /node tools\/governor\/delegation-gate\.mjs justify --reason <architecture\|integration\|safety\|judgement\|git-lifecycle\|emergency> --ticket T-42/
  );
});

// ---------------------------------------------------------------------------
// validateLedgerRecord — the hand-written per-kind + cross-field validator
// ---------------------------------------------------------------------------

test('validateLedgerRecord: a well-formed direct-call record is valid', () => {
  assert.equal(validateLedgerRecord(validDirectCall({ ticket: 'T-01' })).ok, true);
});

test('validateLedgerRecord: a well-formed task record with specialist_match "unchecked" and governing_specialist null is valid — the EXPECTED, common shape (decision §6)', () => {
  const r = validTask({ ticket: 'T-01', governing_specialist: null, specialist_match: 'unchecked' });
  assert.equal(validateLedgerRecord(r).ok, true);
});

test('validateLedgerRecord: a well-formed task record with specialist_match "declared" and governing_specialist === subagent_type is valid', () => {
  const r = validTask({
    ticket: 'T-01',
    subagent_type: 'keel',
    governing_specialist: 'keel',
    specialist_match: 'declared',
  });
  assert.equal(validateLedgerRecord(r).ok, true);
});

test('validateLedgerRecord: a structurally-valid "no-fit-declared" task record is ACCEPTED even though no write path in this module ever produces one (decision §4a — reserved, not built)', () => {
  const r = validTask({
    ticket: 'T-01',
    subagent_type: 'general-purpose',
    governing_specialist: 'silas',
    specialist_match: 'no-fit-declared',
  });
  assert.equal(validateLedgerRecord(r).ok, true);
});

test('validateLedgerRecord: a well-formed justify record is valid, and carries no specialist_match key at all', () => {
  const r = validJustify({ ticket: 'T-01' });
  assert.equal(validateLedgerRecord(r).ok, true);
  assert.equal('specialist_match' in r, false);
});

test('validateLedgerRecord: rejects non-objects, arrays and null', () => {
  assert.equal(validateLedgerRecord(null).ok, false);
  assert.equal(validateLedgerRecord('x').ok, false);
  assert.equal(validateLedgerRecord(42).ok, false);
  assert.equal(validateLedgerRecord([]).ok, false);
});

test('validateLedgerRecord: rejects a wrong or missing schema_version', () => {
  const r = validDirectCall({ ticket: 'T-01' });
  assert.equal(validateLedgerRecord({ ...r, schema_version: 2 }).ok, false);
  const { schema_version, ...withoutVersion } = r;
  assert.equal(validateLedgerRecord(withoutVersion).ok, false);
});

test('validateLedgerRecord: rejects an unrecognised kind, and a missing kind', () => {
  assert.equal(validateLedgerRecord({ ...validDirectCall({ ticket: 'T-01' }), kind: 'not-a-real-kind' }).ok, false);
  const { kind, ...withoutKind } = validDirectCall({ ticket: 'T-01' });
  assert.equal(validateLedgerRecord(withoutKind).ok, false);
});

test('validateLedgerRecord: rejects an extra, undeclared key on any kind (additionalProperties:false equivalent)', () => {
  const withExtra = { ...validDirectCall({ ticket: 'T-01' }), extra_field: 'nope' };
  assert.equal(validateLedgerRecord(withExtra).ok, false);
});

test('validateLedgerRecord: rejects empty/missing ts or ticket', () => {
  assert.equal(validateLedgerRecord({ ...validDirectCall({ ticket: 'T-01' }), ts: '' }).ok, false);
  assert.equal(validateLedgerRecord({ ...validDirectCall({ ticket: 'T-01' }), ticket: '' }).ok, false);
});

test('validateLedgerRecord: rejects an out-of-enum tool_name, reason, or specialist_match', () => {
  assert.equal(validateLedgerRecord({ ...validDirectCall({ ticket: 'T-01' }), tool_name: 'NotebookEdit' }).ok, false);
  assert.equal(validateLedgerRecord({ ...validJustify({ ticket: 'T-01' }), reason: 'convenience' }).ok, false);
  assert.equal(
    validateLedgerRecord({ ...validTask({ ticket: 'T-01' }), specialist_match: 'yolo' }).ok,
    false
  );
});

test('validateLedgerRecord: cross-field rule — specialist_match "unchecked" requires governing_specialist null (decision §4c)', () => {
  const r = validTask({ ticket: 'T-01', specialist_match: 'unchecked', governing_specialist: 'someone' });
  const result = validateLedgerRecord(r);
  assert.equal(result.ok, false);
  assert.match(result.error, /unchecked/);
});

test('validateLedgerRecord: cross-field rule — specialist_match "declared" requires governing_specialist === subagent_type exactly', () => {
  const wrongValue = validTask({
    ticket: 'T-01',
    subagent_type: 'keel',
    specialist_match: 'declared',
    governing_specialist: 'silas',
  });
  assert.equal(validateLedgerRecord(wrongValue).ok, false);

  const nullValue = validTask({
    ticket: 'T-01',
    subagent_type: 'keel',
    specialist_match: 'declared',
    governing_specialist: null,
  });
  assert.equal(validateLedgerRecord(nullValue).ok, false);
});

test('validateLedgerRecord: cross-field rule — specialist_match "no-fit-declared" requires a non-empty governing_specialist', () => {
  const r = validTask({ ticket: 'T-01', specialist_match: 'no-fit-declared', governing_specialist: null });
  assert.equal(validateLedgerRecord(r).ok, false);
});

test('validateLedgerRecord: justify records must carry governing_specialist "larry" and nothing else (decision §4b)', () => {
  assert.equal(
    validateLedgerRecord({ ...validJustify({ ticket: 'T-01' }), governing_specialist: 'not-larry' }).ok,
    false
  );
  // Adding a specialist_match key to a justify record is an undeclared extra
  // key for that shape — invalid, per additionalProperties:false.
  assert.equal(
    validateLedgerRecord({ ...validJustify({ ticket: 'T-01' }), specialist_match: 'unchecked' }).ok,
    false
  );
});

// ---------------------------------------------------------------------------
// resolveSpecialistMatch — the mechanical exact-match rule (decision §4a)
// ---------------------------------------------------------------------------

test('resolveSpecialistMatch: exact match against a .claude/agents/*.md slug -> declared, governing_specialist = subagent_type AS DISPATCHED', () => {
  const dir = mkdtempSync(join(tmpdir(), 'governor-roster-'));
  try {
    mkdirSync(join(dir, '.claude', 'agents'), { recursive: true });
    writeFileSync(join(dir, '.claude', 'agents', 'keel.md'), 'fixture\n');
    const r = resolveSpecialistMatch({ worktree: dir, subagentType: 'keel' });
    assert.deepEqual(r, { governing_specialist: 'keel', specialist_match: 'declared' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('resolveSpecialistMatch: comparison is case/whitespace-insensitive, but the STORED value is subagent_type exactly as dispatched', () => {
  const dir = mkdtempSync(join(tmpdir(), 'governor-roster-'));
  try {
    mkdirSync(join(dir, '.claude', 'agents'), { recursive: true });
    writeFileSync(join(dir, '.claude', 'agents', 'keel.md'), 'fixture\n');
    const r = resolveSpecialistMatch({ worktree: dir, subagentType: '  Keel  ' });
    assert.equal(r.specialist_match, 'declared');
    assert.equal(r.governing_specialist, '  Keel  ', 'stored as dispatched, not normalised');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('resolveSpecialistMatch: no roster match (e.g. "general-purpose", or a typo) -> unchecked, governing_specialist null — NEVER "declared" on a miss', () => {
  const dir = mkdtempSync(join(tmpdir(), 'governor-roster-'));
  try {
    mkdirSync(join(dir, '.claude', 'agents'), { recursive: true });
    writeFileSync(join(dir, '.claude', 'agents', 'keel.md'), 'fixture\n');
    assert.deepEqual(resolveSpecialistMatch({ worktree: dir, subagentType: 'general-purpose' }), {
      governing_specialist: null,
      specialist_match: 'unchecked',
    });
    assert.deepEqual(resolveSpecialistMatch({ worktree: dir, subagentType: 'keeel-typo' }), {
      governing_specialist: null,
      specialist_match: 'unchecked',
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('resolveSpecialistMatch: an unreadable/absent roster directory resolves to unchecked, never throws, never reads as declared', () => {
  const dir = mkdtempSync(join(tmpdir(), 'governor-roster-empty-'));
  try {
    assert.deepEqual(resolveSpecialistMatch({ worktree: dir, subagentType: 'keel' }), {
      governing_specialist: null,
      specialist_match: 'unchecked',
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('resolveSpecialistMatch: a missing/empty subagent_type resolves to unchecked without touching the filesystem', () => {
  assert.deepEqual(resolveSpecialistMatch({ worktree: 'C:/does/not/matter', subagentType: undefined }), {
    governing_specialist: null,
    specialist_match: 'unchecked',
  });
  assert.deepEqual(resolveSpecialistMatch({ worktree: 'C:/does/not/matter', subagentType: '' }), {
    governing_specialist: null,
    specialist_match: 'unchecked',
  });
});

// ---------------------------------------------------------------------------
// Ledger I/O plumbing
// ---------------------------------------------------------------------------

test('delegationLedgerDir honours MYPKA_GOVERNOR_DELEGATION_DIR override', () => {
  const dir = delegationLedgerDir({ cwd: 'C:\\Fusion247PKA', envOverride: 'D:\\custom\\root' });
  assert.equal(dir, 'D:\\custom\\root');
});

test('delegationLedgerPath rejects a missing ticket', () => {
  assert.throws(() => delegationLedgerPath(''), TypeError);
  assert.throws(() => delegationLedgerPath(undefined), TypeError);
});

test('appendLedgerRecord then readLedger round-trips records in order, one JSON object per line on disk', () => {
  const dir = mkdtempSync(join(tmpdir(), 'governor-delegation-io-'));
  try {
    const opts = { envOverride: dir };
    appendLedgerRecord('T-01', validDirectCall({ ticket: 'T-01', tool_name: 'Write' }), opts);
    appendLedgerRecord('T-01', validDirectCall({ ticket: 'T-01', tool_name: 'Edit' }), opts);
    const { records, skipped, path } = readLedger('T-01', opts);
    assert.deepEqual(records.map((r) => r.tool_name), ['Write', 'Edit']);
    assert.deepEqual(skipped, []);
    assert.equal(path, delegationLedgerPath('T-01', opts));

    const raw = readFileSync(delegationLedgerPath('T-01', opts), 'utf8');
    assert.equal(raw.split('\n').filter(Boolean).length, 2, 'exactly one JSON object per line');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('appendLedgerRecord refuses (throws) an invalid record and writes nothing (decision §5 — validated before any write)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'governor-delegation-io-'));
  try {
    const opts = { envOverride: dir };
    assert.throws(() => appendLedgerRecord('T-01', { kind: 'not-a-real-kind' }, opts), TypeError);
    assert.equal(existsSync(delegationLedgerPath('T-01', opts)), false, 'no file was created for a rejected record');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('readLedger on a ticket that was never written returns empty records/skipped and the resolved path, not a crash', () => {
  const dir = mkdtempSync(join(tmpdir(), 'governor-delegation-io-'));
  try {
    const opts = { envOverride: dir };
    const result = readLedger('T-never', opts);
    assert.deepEqual(result.records, []);
    assert.deepEqual(result.skipped, []);
    assert.equal(result.path, delegationLedgerPath('T-never', opts));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('readLedger skips a line that is not valid JSON, surfaces it in `skipped` with its line number, and the good line survives', () => {
  const dir = mkdtempSync(join(tmpdir(), 'governor-delegation-io-'));
  try {
    const opts = { envOverride: dir };
    appendLedgerRecord('T-01', validDirectCall({ ticket: 'T-01' }), opts);
    const path = delegationLedgerPath('T-01', opts);
    writeFileSync(path, readFileSync(path, 'utf8') + '{ not json\n');
    const { records, skipped } = readLedger('T-01', opts);
    assert.equal(records.length, 1, 'the corrupt line is skipped, the good one survives');
    assert.equal(skipped.length, 1);
    assert.equal(skipped[0].line, 2);
    assert.match(skipped[0].error, /not valid JSON/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('readLedger skips a line that IS valid JSON but fails schema/cross-field validation, and surfaces the reason (decision §6 — invalid vs unusual)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'governor-delegation-io-'));
  try {
    const opts = { envOverride: dir };
    appendLedgerRecord('T-01', validDirectCall({ ticket: 'T-01' }), opts);
    const path = delegationLedgerPath('T-01', opts);
    writeFileSync(
      path,
      readFileSync(path, 'utf8') +
        JSON.stringify({ schema_version: 1, ts: '2026-01-01T00:00:00.000Z', ticket: 'T-01', kind: 'not-a-real-kind' }) +
        '\n'
    );
    const { records, skipped } = readLedger('T-01', opts);
    assert.equal(records.length, 1);
    assert.equal(skipped.length, 1);
    assert.match(skipped[0].error, /kind/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('readLedger keeps and trusts UNUSUAL-but-valid records: null session_id/note/description, and governing_specialist:null with specialist_match:"unchecked" (decision §6)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'governor-delegation-io-'));
  try {
    const opts = { envOverride: dir };
    appendLedgerRecord(
      'T-01',
      validTask({ ticket: 'T-01', session_id: null, description: null, governing_specialist: null, specialist_match: 'unchecked' }),
      opts
    );
    const { records, skipped } = readLedger('T-01', opts);
    assert.equal(skipped.length, 0);
    assert.equal(records.length, 1);
    assert.equal(records[0].governing_specialist, null);
    assert.equal(records[0].specialist_match, 'unchecked');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// REAL GIT: the threshold gate itself
// ---------------------------------------------------------------------------

test('REAL GIT: the 1st-3rd direct Write/Edit/MultiEdit for a fresh ticket ALLOW (each counted correctly); the 4th DENIES', () => {
  const e = makeEstate();
  try {
    const base = { cwd: e.canonicalWorktree, sessionId: 'sess-a', ledgerOpts: e.ledgerOpts };

    const r1 = evaluateDelegationGate({ ...base, toolName: 'Write', toolInput: { file_path: 'a.mjs' } });
    assert.equal(r1.decision, DECISION.ALLOW);
    assert.equal(r1.count, 0, 'the 1st call had zero PRIOR direct calls');

    const r2 = evaluateDelegationGate({ ...base, toolName: 'Edit', toolInput: { file_path: 'a.mjs' } });
    assert.equal(r2.decision, DECISION.ALLOW);
    assert.equal(r2.count, 1);

    const r3 = evaluateDelegationGate({ ...base, toolName: 'MultiEdit', toolInput: { file_path: 'a.mjs' } });
    assert.equal(r3.decision, DECISION.ALLOW);
    assert.equal(r3.count, 2);

    const r4 = evaluateDelegationGate({ ...base, toolName: 'Write', toolInput: { file_path: 'b.mjs' } });
    assert.equal(r4.decision, DECISION.DENY, 'the 4th direct call without an intervening checkpoint must deny');
    assert.match(r4.reason, /Dispatch a subagent via the Task tool/);
    assert.match(r4.reason, /node tools\/governor\/delegation-gate\.mjs justify/);
    assert.match(r4.reason, new RegExp(e.ticket));
  } finally {
    e.cleanup();
  }
});

test('REAL GIT: every ledger line the gate itself writes is schema-valid (schema_version present, well-formed direct-call shape)', () => {
  const e = makeEstate();
  try {
    const base = { cwd: e.canonicalWorktree, sessionId: 'sess-a', ledgerOpts: e.ledgerOpts };
    evaluateDelegationGate({ ...base, toolName: 'Write', toolInput: { file_path: 'a.mjs' } });
    const { records, skipped } = readLedger(e.ticket, { ...e.ledgerOpts, cwd: e.canonicalWorktree });
    assert.equal(skipped.length, 0, 'nothing the gate itself wrote should ever fail its own validator');
    assert.equal(records.length, 1);
    assert.equal(records[0].schema_version, 1);
    assert.equal(records[0].kind, 'direct-call');
  } finally {
    e.cleanup();
  }
});

test('REAL GIT: only mutating Bash counts; read-only Bash and NotebookEdit are not governed at all', () => {
  const e = makeEstate();
  try {
    const base = { cwd: e.canonicalWorktree, sessionId: 'sess-a', ledgerOpts: e.ledgerOpts };

    const notebook = evaluateDelegationGate({ ...base, toolName: 'NotebookEdit', toolInput: {} });
    assert.equal(notebook.decision, DECISION.DEFER);
    assert.match(notebook.reason, /not governed/);

    const readOnlyBash = evaluateDelegationGate({ ...base, toolName: 'Bash', toolInput: { command: 'git status' } });
    assert.equal(readOnlyBash.decision, DECISION.DEFER);

    const mutatingBash = evaluateDelegationGate({ ...base, toolName: 'Bash', toolInput: { command: 'git commit -m x' } });
    assert.equal(mutatingBash.decision, DECISION.ALLOW);
    assert.equal(mutatingBash.count, 0, 'the two DEFERs above must never have counted toward the threshold');
  } finally {
    e.cleanup();
  }
});

test('REAL GIT: a Task dispatch resets the count — the call after a dispatch ALLOWS again, and the recorded task carries governing_specialist/specialist_match', () => {
  const e = makeEstate();
  try {
    const base = { cwd: e.canonicalWorktree, sessionId: 'sess-a', ledgerOpts: e.ledgerOpts };
    for (let i = 0; i < 3; i++) {
      const r = evaluateDelegationGate({ ...base, toolName: 'Write', toolInput: { file_path: `${i}.mjs` } });
      assert.equal(r.decision, DECISION.ALLOW);
    }
    const denied = evaluateDelegationGate({ ...base, toolName: 'Write', toolInput: { file_path: 'x.mjs' } });
    assert.equal(denied.decision, DECISION.DENY);

    const dispatch = recordTaskDispatch({
      cwd: e.canonicalWorktree,
      sessionId: 'sess-a',
      subagentType: 'general-purpose',
      description: 'do the remaining work',
      ledgerOpts: e.ledgerOpts,
    });
    assert.equal(dispatch.recorded, true);
    assert.equal(dispatch.ticket, e.ticket);

    const { records } = readLedger(e.ticket, { ...e.ledgerOpts, cwd: e.canonicalWorktree });
    const taskRecord = records.find((r) => r.kind === 'task');
    assert.ok(taskRecord, 'the task checkpoint record was written');
    assert.equal(taskRecord.subagent_type, 'general-purpose');
    assert.equal(taskRecord.specialist_match, 'unchecked', 'no .claude/agents/general-purpose.md exists in this estate');
    assert.equal(taskRecord.governing_specialist, null);

    const afterDispatch = evaluateDelegationGate({ ...base, toolName: 'Write', toolInput: { file_path: 'y.mjs' } });
    assert.equal(afterDispatch.decision, DECISION.ALLOW, 'the Task-dispatch checkpoint must reset the count to zero');
    assert.equal(afterDispatch.count, 0);
  } finally {
    e.cleanup();
  }
});

test('REAL GIT: dispatching BY NAME to a real specialist in the roster records governing_specialist = subagent_type, specialist_match = "declared"', () => {
  const e = makeEstate({ agentSlugs: ['keel'] });
  try {
    const dispatch = recordTaskDispatch({
      cwd: e.canonicalWorktree,
      sessionId: 'sess-a',
      subagentType: 'keel',
      description: 'implement T-16',
      ledgerOpts: e.ledgerOpts,
    });
    assert.equal(dispatch.recorded, true);
    const { records } = readLedger(e.ticket, { ...e.ledgerOpts, cwd: e.canonicalWorktree });
    const taskRecord = records.find((r) => r.kind === 'task');
    assert.equal(taskRecord.specialist_match, 'declared');
    assert.equal(taskRecord.governing_specialist, 'keel');
  } finally {
    e.cleanup();
  }
});

test('REAL GIT: a valid justify call resets the count, records governing_specialist:"larry", and carries no specialist_match key', () => {
  const e = makeEstate();
  try {
    const base = { cwd: e.canonicalWorktree, sessionId: 'sess-a', ledgerOpts: e.ledgerOpts };
    for (let i = 0; i < 3; i++) {
      assert.equal(
        evaluateDelegationGate({ ...base, toolName: 'Write', toolInput: { file_path: `${i}.mjs` } }).decision,
        DECISION.ALLOW
      );
    }
    assert.equal(
      evaluateDelegationGate({ ...base, toolName: 'Write', toolInput: { file_path: 'x.mjs' } }).decision,
      DECISION.DENY
    );

    const j = justify({
      reason: 'architecture',
      ticket: e.ticket,
      note: 'test note',
      sessionId: 'sess-a',
      cwd: e.canonicalWorktree,
      ledgerOpts: e.ledgerOpts,
    });
    assert.equal(j.ok, true);
    assert.equal(j.record.kind, 'justify');
    assert.equal(j.record.reason, 'architecture');
    assert.equal(j.record.governing_specialist, 'larry');
    assert.equal('specialist_match' in j.record, false);

    const afterJustify = evaluateDelegationGate({ ...base, toolName: 'Write', toolInput: { file_path: 'y.mjs' } });
    assert.equal(afterJustify.decision, DECISION.ALLOW);
    assert.equal(afterJustify.count, 0);
  } finally {
    e.cleanup();
  }
});

test('REAL GIT: the ledger is keyed by TICKET, not session — two session_ids on the same ticket share one counter (simulates surviving /clear)', () => {
  const e = makeEstate();
  try {
    const opts = { cwd: e.canonicalWorktree, ledgerOpts: e.ledgerOpts };
    assert.equal(
      evaluateDelegationGate({ ...opts, sessionId: 'sess-A', toolName: 'Write', toolInput: {} }).decision,
      DECISION.ALLOW
    );
    assert.equal(
      evaluateDelegationGate({ ...opts, sessionId: 'sess-A', toolName: 'Write', toolInput: {} }).decision,
      DECISION.ALLOW
    );
    // A DIFFERENT session_id, same ticket — as if the session was /clear'd and resumed.
    assert.equal(
      evaluateDelegationGate({ ...opts, sessionId: 'sess-B', toolName: 'Write', toolInput: {} }).decision,
      DECISION.ALLOW
    );
    const fourth = evaluateDelegationGate({ ...opts, sessionId: 'sess-B', toolName: 'Write', toolInput: {} });
    assert.equal(fourth.decision, DECISION.DENY, 'the count carried over from sess-A to sess-B: same ticket, one counter');
  } finally {
    e.cleanup();
  }
});

test('REAL GIT: the SAME session working TWO DIFFERENT tickets has two independent counters', () => {
  const e = makeEstate({ ticket: 'T-AAA' });
  try {
    const base = { cwd: e.canonicalWorktree, sessionId: 'sess-A', ledgerOpts: e.ledgerOpts };
    for (let i = 0; i < 3; i++) {
      assert.equal(
        evaluateDelegationGate({ ...base, toolName: 'Write', toolInput: { file_path: `${i}.mjs` } }).decision,
        DECISION.ALLOW
      );
    }
    assert.equal(
      evaluateDelegationGate({ ...base, toolName: 'Write', toolInput: {} }).decision,
      DECISION.DENY,
      'T-AAA is now over threshold'
    );

    // Move the SAME session onto a different ticket, exactly as a real
    // /rotate-session would re-point resumption.ticket.
    const doc = JSON.parse(readFileSync(e.statePath, 'utf8'));
    doc.resumption.ticket = 'T-BBB';
    writeFileSync(e.statePath, JSON.stringify(doc, null, 2) + '\n');

    const onNewTicket = evaluateDelegationGate({ ...base, toolName: 'Write', toolInput: {} });
    assert.equal(onNewTicket.decision, DECISION.ALLOW, 'T-BBB has never been touched — its own counter starts at zero');
    assert.equal(onNewTicket.ticket, 'T-BBB');
  } finally {
    e.cleanup();
  }
});

test('AD-19-style fail OPEN: no active programme means no ticket can be resolved, so the gate ALLOWS', () => {
  const dir = mkdtempSync(join(tmpdir(), 'governor-delegation-empty-'));
  try {
    execFileSync('git', ['-C', dir, 'init', '-q', '-b', 'main']);
    const r = evaluateDelegationGate({
      cwd: dir,
      sessionId: 'sess-a',
      toolName: 'Write',
      toolInput: { file_path: 'x' },
    });
    assert.equal(r.decision, DECISION.ALLOW);
    assert.match(r.reason, /no current ticket/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// MUTATION — the load-bearing safety property: fail OPEN, never DENY, on the
// gate's OWN failure to read or write its ledger (INV-2, generalised).
// ---------------------------------------------------------------------------

test('MUTATION: ledger READ forced to throw -> ALLOW, never DENY, even though a real ledger with 5 records exists', () => {
  const e = makeEstate();
  try {
    // Seed a REAL ledger with enough direct-call records that an honest read
    // would deny the very next call.
    for (let i = 0; i < 5; i++) {
      appendLedgerRecord(
        e.ticket,
        validDirectCall({ ticket: e.ticket, ts: new Date(2026, 0, 1, 0, 0, i).toISOString() }),
        { cwd: e.canonicalWorktree, ...e.ledgerOpts }
      );
    }
    const readFile = () => {
      throw new Error('simulated disk failure');
    };
    const r = evaluateDelegationGate({
      cwd: e.canonicalWorktree,
      sessionId: 'sess-a',
      toolName: 'Write',
      toolInput: { file_path: 'x.mjs' },
      ledgerOpts: { ...e.ledgerOpts, readFile },
    });
    assert.equal(
      r.decision,
      DECISION.ALLOW,
      'a gate that cannot READ its own ledger must fail OPEN, not closed — this governs discipline, not safety'
    );
    assert.match(r.reason, /could not be read/);
  } finally {
    e.cleanup();
  }
});

test('MUTATION: ledger WRITE (append) forced to throw does not flip an already-decided ALLOW into a DENY', () => {
  const e = makeEstate();
  try {
    const writeFile = () => {
      throw new Error('simulated disk-full on append');
    };
    const r = evaluateDelegationGate({
      cwd: e.canonicalWorktree,
      sessionId: 'sess-a',
      toolName: 'Write',
      toolInput: { file_path: 'x.mjs' },
      ledgerOpts: { ...e.ledgerOpts, writeFile },
    });
    assert.equal(
      r.decision,
      DECISION.ALLOW,
      'the decision is final the moment it is computed — a failed checkpoint-write afterward must not retroactively deny'
    );
  } finally {
    e.cleanup();
  }
});

test("MUTATION: worktree-guard's own denial wins outright — the delegation gate defers and never touches the ledger", () => {
  const e = makeEstate();
  try {
    const r = evaluateDelegationGate({
      cwd: e.otherWorktree, // wrong worktree
      sessionId: 'sess-a',
      toolName: 'Write',
      toolInput: { file_path: 'x.mjs' },
      ledgerOpts: e.ledgerOpts,
    });
    assert.equal(
      r.decision,
      DECISION.DEFER,
      "the delegation gate itself never denies here — worktree-guard's own separately-installed hook already will"
    );
    assert.ok(r.worktreeGuard, 'the underlying worktree-guard verdict is surfaced for diagnosis');
    assert.equal(r.worktreeGuard.decision, DECISION.DENY);
    assert.match(r.worktreeGuard.reason, /WRONG WORKTREE/);

    // And the ledger must never even have been opened — a wrong-worktree
    // session's "current ticket" resolution may itself be meaningless.
    assert.equal(existsSync(delegationLedgerPath(e.ticket, e.ledgerOpts)), false);
  } finally {
    e.cleanup();
  }
});

test('MUTATION: when aligned, the threshold gate is NOT crossed and worktree-guard would have nothing to add — both can coexist without conflict', () => {
  const e = makeEstate();
  try {
    const base = { cwd: e.canonicalWorktree, sessionId: 'sess-a', ledgerOpts: e.ledgerOpts };
    const r = evaluateDelegationGate({ ...base, toolName: 'Write', toolInput: { file_path: 'a.mjs' } });
    assert.equal(r.decision, DECISION.ALLOW);
    assert.equal(r.worktreeGuard, undefined, 'no worktree-guard verdict is surfaced when there is nothing wrong to report');
  } finally {
    e.cleanup();
  }
});

// ---------------------------------------------------------------------------
// justify() — validation happens before any I/O
// ---------------------------------------------------------------------------

test('justify: an invalid reason is rejected, ledger untouched, no I/O attempted', () => {
  const dir = mkdtempSync(join(tmpdir(), 'governor-delegation-justify-'));
  try {
    const r = justify({ reason: 'convenience', ticket: 'T-02', cwd: 'C:/does/not/exist', ledgerOpts: { envOverride: dir } });
    assert.equal(r.ok, false);
    assert.match(r.error, /convenience/);
    assert.match(r.error, /architecture, integration, safety, judgement, git-lifecycle, emergency/);
    assert.deepEqual(readLedger('T-02', { envOverride: dir }).records, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('justify: a MISSING reason is rejected the same way — not silently defaulted or skipped', () => {
  const dir = mkdtempSync(join(tmpdir(), 'governor-delegation-justify-'));
  try {
    const r = justify({ ticket: 'T-02', cwd: 'C:/does/not/exist', ledgerOpts: { envOverride: dir } });
    assert.equal(r.ok, false);
    assert.match(r.error, /missing/);
    assert.deepEqual(readLedger('T-02', { envOverride: dir }).records, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('justify: a missing ticket is also rejected', () => {
  const r = justify({ reason: 'architecture' });
  assert.equal(r.ok, false);
  assert.match(r.error, /--ticket/);
});

test('justify: refuses to write when no active programme can be resolved, rather than guessing where the ledger lives', () => {
  const dir = mkdtempSync(join(tmpdir(), 'governor-delegation-justify-nowhere-'));
  try {
    execFileSync('git', ['-C', dir, 'init', '-q', '-b', 'main']);
    const r = justify({ reason: 'architecture', ticket: 'T-02', note: 'x', cwd: dir, ledgerOpts: { envOverride: dir } });
    assert.equal(r.ok, false);
    assert.match(r.error, /no active programme/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Function-level hook plumbing (defer/allow semantics on malformed input)
// ---------------------------------------------------------------------------

test('runObserveHook never throws on malformed input, and no-ops on non-Task tools', () => {
  const bad = runObserveHook('not json at all');
  assert.equal(bad.recorded, false);

  const notTask = runObserveHook(JSON.stringify({ tool_name: 'Write', tool_input: {} }));
  assert.equal(notTask.recorded, false);
  assert.match(notTask.reason, /not a Task dispatch/);
});

test('runCheckHook fails open on malformed input, and toHookOutput emits nothing for a DEFER', () => {
  const bad = runCheckHook('not json at all');
  assert.equal(bad.decision, DECISION.DEFER);
  assert.equal(toHookOutput(bad), null);
});

// ---------------------------------------------------------------------------
// REAL PROCESS — the whole thing end to end, as the actual hook CLI
// ---------------------------------------------------------------------------

function runCli(args, input, envExtra = {}) {
  return execFileSync(process.execPath, [DELEGATION_SRC, ...args], {
    input: typeof input === 'string' ? input : JSON.stringify(input ?? {}),
    encoding: 'utf8',
    env: { ...process.env, ...envExtra },
  });
}

test('REAL PROCESS: check — 3 direct calls are silent (allowed), the 4th emits a PreToolUse deny and exits 0', () => {
  const e = makeEstate();
  try {
    const env = { MYPKA_GOVERNOR_DELEGATION_DIR: e.ledgerDir };
    for (let i = 0; i < 3; i++) {
      const out = runCli(
        ['check'],
        { tool_name: 'Write', tool_input: { file_path: `${i}.mjs` }, cwd: e.canonicalWorktree, session_id: 'sess-a' },
        env
      );
      assert.equal(out.trim(), '', `call ${i + 1} must be silent (allowed)`);
    }
    const denyOut = runCli(
      ['check'],
      { tool_name: 'Write', tool_input: { file_path: 'x.mjs' }, cwd: e.canonicalWorktree, session_id: 'sess-a' },
      env
    );
    const doc = JSON.parse(denyOut);
    assert.equal(doc.hookSpecificOutput.hookEventName, 'PreToolUse');
    assert.equal(doc.hookSpecificOutput.permissionDecision, 'deny');
    assert.match(doc.hookSpecificOutput.permissionDecisionReason, /DELEGATION GATE/);
  } finally {
    e.cleanup();
  }
});

test('REAL PROCESS: observe records a Task dispatch (schema-valid, governing_specialist/specialist_match populated) and it is visible to a subsequent check call', () => {
  const e = makeEstate();
  try {
    const env = { MYPKA_GOVERNOR_DELEGATION_DIR: e.ledgerDir };
    for (let i = 0; i < 3; i++) {
      runCli(
        ['check'],
        { tool_name: 'Write', tool_input: { file_path: `${i}.mjs` }, cwd: e.canonicalWorktree, session_id: 'sess-a' },
        env
      );
    }
    const denied = runCli(
      ['check'],
      { tool_name: 'Write', tool_input: {}, cwd: e.canonicalWorktree, session_id: 'sess-a' },
      env
    );
    assert.match(denied, /deny/);

    const observeOut = runCli(
      ['observe'],
      {
        tool_name: 'Task',
        tool_input: { subagent_type: 'general-purpose', description: 'help' },
        cwd: e.canonicalWorktree,
        session_id: 'sess-a',
      },
      env
    );
    assert.equal(observeOut.trim(), '', 'the observer never emits a hook decision — pure observation');

    const { records, skipped } = readLedger(e.ticket, { envOverride: e.ledgerDir, cwd: e.canonicalWorktree });
    assert.equal(skipped.length, 0, 'the real CLI process must never write a record its own reader rejects');
    const taskRecord = records.find((r) => r.kind === 'task');
    assert.ok(taskRecord);
    assert.equal(taskRecord.schema_version, 1);
    assert.equal(taskRecord.specialist_match, 'unchecked');

    const afterObserve = runCli(
      ['check'],
      { tool_name: 'Write', tool_input: {}, cwd: e.canonicalWorktree, session_id: 'sess-a' },
      env
    );
    assert.equal(afterObserve.trim(), '', 'the Task dispatch reset the count, so this call is allowed again');
  } finally {
    e.cleanup();
  }
});

test('REAL PROCESS: justify CLI rejects an invalid --reason with non-zero exit, and clears the gate on a valid one', () => {
  const e = makeEstate();
  try {
    const env = { ...process.env, MYPKA_GOVERNOR_DELEGATION_DIR: e.ledgerDir };

    let threw = false;
    try {
      execFileSync(
        process.execPath,
        [DELEGATION_SRC, 'justify', '--reason', 'convenience', '--ticket', e.ticket, '--note', 'x'],
        { cwd: e.canonicalWorktree, env, encoding: 'utf8' }
      );
    } catch (err) {
      threw = true;
      assert.notEqual(err.status, 0);
      assert.match(err.stderr.toString(), /--reason must be one of/);
    }
    assert.equal(threw, true, 'an invalid --reason must exit non-zero');

    const out = execFileSync(
      process.execPath,
      [DELEGATION_SRC, 'justify', '--reason', 'architecture', '--ticket', e.ticket, '--note', 'CLI test'],
      { cwd: e.canonicalWorktree, env, encoding: 'utf8' }
    );
    assert.match(out, /Checkpoint recorded/);
    assert.match(out, new RegExp(e.ticket));

    for (let i = 0; i < 3; i++) {
      const r = runCli(
        ['check'],
        { tool_name: 'Write', tool_input: {}, cwd: e.canonicalWorktree, session_id: 'sess-a' },
        { MYPKA_GOVERNOR_DELEGATION_DIR: e.ledgerDir }
      );
      assert.equal(r.trim(), '', `call ${i + 1} after justify must be allowed`);
    }
  } finally {
    e.cleanup();
  }
});

test('REAL PROCESS: justify CLI with a MISSING --reason exits non-zero and writes nothing', () => {
  const e = makeEstate();
  try {
    const env = { ...process.env, MYPKA_GOVERNOR_DELEGATION_DIR: e.ledgerDir };
    assert.throws(() => {
      execFileSync(process.execPath, [DELEGATION_SRC, 'justify', '--ticket', e.ticket], {
        cwd: e.canonicalWorktree,
        env,
        encoding: 'utf8',
      });
    });
    assert.deepEqual(readLedger(e.ticket, e.ledgerOpts).records, []);
  } finally {
    e.cleanup();
  }
});

test('REAL PROCESS: garbage and empty stdin to check/observe exit 0 and block nothing (fail open)', () => {
  const e = makeEstate();
  try {
    const env = { MYPKA_GOVERNOR_DELEGATION_DIR: e.ledgerDir };
    for (const bad of ['', 'not json at all', '[]']) {
      assert.equal(runCli(['check'], bad, env).trim(), '');
      assert.equal(runCli(['observe'], bad, env).trim(), '');
    }
  } finally {
    e.cleanup();
  }
});

test('REAL PROCESS: from the wrong worktree, check emits nothing (worktree-guard\'s own hook is what denies, not this one)', () => {
  const e = makeEstate();
  try {
    const env = { MYPKA_GOVERNOR_DELEGATION_DIR: e.ledgerDir };
    const out = runCli(
      ['check'],
      { tool_name: 'Write', tool_input: { file_path: 'x.mjs' }, cwd: e.otherWorktree, session_id: 'sess-a' },
      env
    );
    assert.equal(out.trim(), '', 'the delegation gate defers silently; it never duplicates the location denial');
  } finally {
    e.cleanup();
  }
});

// ---------------------------------------------------------------------------
// CONCURRENCY — mirrors health-store.mjs's own N-concurrent-writers proof.
// The claim here is narrower than health-store's: NOT "no lost updates" (a
// read-modify-write append can lose one under a genuine race — see the file
// header for why that is the SAFE direction), but "never a torn/partial
// line" — the one failure mode this design cannot tolerate in either
// direction, and the one the atomic temp-file+rename write prevents.
// ---------------------------------------------------------------------------

test('CONCURRENCY: N concurrent appender processes never produce a torn or corrupt ledger file', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'governor-delegation-concurrent-'));
  const opts = { envOverride: dir };
  const N = 12;
  try {
    const children = [];
    for (let i = 0; i < N; i++) {
      const record = JSON.stringify({
        schema_version: 1,
        ts: new Date(2026, 0, 1, 0, 0, i).toISOString(),
        session_id: `writer-${i}`,
        ticket: 'T-concurrent',
        kind: 'direct-call',
        tool_name: 'Write',
      });
      const script = `
        import { appendLedgerRecord } from ${JSON.stringify(pathToFileURL(DELEGATION_SRC).href)};
        appendLedgerRecord('T-concurrent', ${record}, { envOverride: ${JSON.stringify(dir)} });
      `;
      children.push(
        new Promise((resolve, reject) => {
          const child = spawn(process.execPath, ['--input-type=module', '-e', script], { stdio: 'pipe' });
          let stderr = '';
          child.stderr.on('data', (d) => {
            stderr += d;
          });
          child.on('exit', (code) => (code !== 0 ? reject(new Error(`writer ${i} exited ${code}: ${stderr}`)) : resolve()));
        })
      );
    }
    await Promise.all(children);

    const raw = readFileSync(delegationLedgerPath('T-concurrent', opts), 'utf8');
    const lines = raw.split('\n').filter((l) => l.trim());
    assert.ok(lines.length >= 1 && lines.length <= N, `expected between 1 and ${N} surviving lines, got ${lines.length}`);
    for (const line of lines) {
      assert.doesNotThrow(() => JSON.parse(line), `every surviving line must be complete, valid JSON: ${line}`);
    }

    const { skipped } = readLedger('T-concurrent', opts);
    assert.deepEqual(skipped, [], 'every surviving line must also be schema-valid, not merely parseable JSON');

    const leftoverTmp = readdirSync(dir).filter((f) => f.includes('.tmp-'));
    assert.deepEqual(leftoverTmp, [], 'no leftover temp files after N concurrent writers');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
