import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  SCHEMA_PATH,
  SCHEMA_VERSION,
  loadSchema,
  programmeStatePath,
  validateAgainstSchema,
  validatePrivacyBoundary,
  validateConsistency,
  validateProgrammeState,
  evaluateFreshness,
  completedTickets,
  frontierTickets,
  frontierForModel,
  readProgrammeState,
  writeProgrammeState,
  renderSessionHandoff,
  sessionHandoffPath,
  HANDOFF_SECTIONS,
  COLLECTION_FIELDS,
  resolveTicket,
  deriveResumption,
  resolveTicketAndAdvance,
  MAP_STATUS_MARKERS,
  renderMapStatusBlock,
  updateMapStatusBlock,
  extractMapTicketMarkers,
  checkExecutionProjectionAgreement,
  applyTicketResolution,
} from './programme-state.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, 'fixtures');
const LIVE_STATE = join(
  __dirname, '..', '..',
  'Deliverables', 'BUILD-018-session-governor', 'programme-state.json'
);

function fixture(name) {
  return JSON.parse(readFileSync(join(FIXTURES, name), 'utf8'));
}
const base = () => fixture('programme-state.minimal.json');
const privateBase = () => fixture('programme-state.private-build.json');

function freshDir() {
  return mkdtempSync(join(tmpdir(), 'governor-state-test-'));
}

// ---------------------------------------------------------------------------
// Baseline: the fixtures and the LIVE state document are valid
// ---------------------------------------------------------------------------

test('the minimal fixture is valid, and validation actually examined something (INV-5)', () => {
  const result = validateProgrammeState(base());
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
  assert.ok(result.examined > 100, `expected a substantial number of checks, got ${result.examined}`);
  assert.ok(result.breakdown.schema > 0, 'schema checks must have run');
  assert.ok(result.breakdown.privacy > 0, 'privacy checks must have run');
  assert.ok(result.breakdown.consistency > 0, 'consistency checks must have run');
});

test('the private-surface fixture is valid and declares a bounded subtree', () => {
  const state = privateBase();
  const result = validateProgrammeState(state);
  assert.deepEqual(result.errors, []);
  assert.match(state.privacy.private_surface, /private\\synthetic-project\\\*\*$/);
  assert.ok(state.privacy.private_record, 'a non-none surface must name where the full record lives');
});

test('BUILD-018\'s own live programme-state.json validates against the schema', () => {
  assert.ok(existsSync(LIVE_STATE), `live state document is missing at ${LIVE_STATE}`);
  const result = readProgrammeState(LIVE_STATE);
  assert.equal(result.ok, true, `live state invalid: ${JSON.stringify(result.errors, null, 2)}`);
  assert.equal(result.data.programme.id, 'BUILD-018');
  assert.ok(result.examined > 500, 'the live document is large; validation must have examined it fully');
});

test('the schema file itself parses and is the version the code expects', () => {
  const schema = loadSchema();
  assert.equal(schema.properties.schema_version.const, SCHEMA_VERSION);
  assert.ok(existsSync(SCHEMA_PATH));
});

// ---------------------------------------------------------------------------
// Required-coverage: every field the commission named has a home in the schema
// ---------------------------------------------------------------------------

test('the schema covers every field the T-09 outcome requires', () => {
  const props = loadSchema().properties;
  // current phase / completed work / remaining frontier / blockers / model
  // recommendation / workers / branches / PRs / worktrees / safe boundary /
  // exact resumption point / private boundaries
  for (const field of [
    'phase', 'tickets', 'blockers', 'model_recommendation', 'workers',
    'branches', 'pull_requests', 'worktrees', 'safe_boundary', 'resumption', 'privacy',
  ]) {
    assert.ok(field in props, `schema is missing required coverage: ${field}`);
    assert.ok(loadSchema().required.includes(field), `${field} must be required, not optional`);
  }
  // completed work and the frontier are DERIVED from `tickets`, never stored twice
  assert.equal('completed' in props, false, 'completed work must be derived from tickets, not duplicated');
  assert.equal('frontier' in props, false, 'the frontier must be computed from tickets, not asserted');
});

// ---------------------------------------------------------------------------
// MUTATION: removing any required top-level field must be caught
// ---------------------------------------------------------------------------
// The point of this test is the validator, not the fixture: it proves the
// validator genuinely enforces the schema file rather than nodding at it. If the
// validator's `required` handling were deleted, every one of these subtests fails.

test('mutation: deleting ANY required top-level field is caught — and the count is asserted non-zero', () => {
  const required = loadSchema().required;
  assert.ok(required.length > 0, 'schema must declare required fields');
  let checked = 0;
  for (const field of required) {
    const broken = base();
    delete broken[field];
    const result = validateProgrammeState(broken);
    assert.equal(result.ok, false, `deleting ${field} was NOT caught`);
    assert.ok(
      result.errors.some((e) => e.startsWith(`${field}:`)),
      `deleting ${field} produced no error naming it: ${result.errors.join(' | ')}`
    );
    checked += 1;
  }
  assert.equal(checked, required.length);
  assert.ok(checked >= 18, `expected the full required set to be exercised, only saw ${checked}`);
});

test('mutation: an unexpected extra field is rejected (additionalProperties: false)', () => {
  const broken = base();
  broken.smuggled_field = 'anything';
  const result = validateProgrammeState(broken);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('smuggled_field')));
});

test('mutation: a bad enum value is rejected', () => {
  const broken = base();
  broken.tickets[1].state = 'nearly-done';
  const result = validateProgrammeState(broken);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('nearly-done')));
});

test('mutation: a malformed SHA is rejected by pattern', () => {
  const broken = base();
  broken.repository.head_sha = 'c9df077';
  const result = validateProgrammeState(broken);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('repository.head_sha')));
});

test('mutation: an empty next_action is rejected — a state document without one has failed at its only job', () => {
  const broken = base();
  broken.resumption.next_action = '';
  const result = validateProgrammeState(broken);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('resumption.next_action')));
});

test('mutation: the validator refuses to run against a schema keyword it does not implement', () => {
  // A control that silently skips an unimplemented constraint is the exact
  // "reported success over ground it never examined" failure. Prove it is loud.
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
  schema.properties.programme.minProperties = 3; // not implemented
  assert.throws(() => validateAgainstSchema(base(), schema), /unsupported keyword "minProperties"/);
});

// ---------------------------------------------------------------------------
// MUTATION: privacy boundary (INV-6 / GL-012)
// ---------------------------------------------------------------------------

test('mutation: a .fusion247 path smuggled into any ordinary field is rejected', () => {
  const broken = base();
  broken.resumption.next_action = 'Read C:\\.fusion247\\private\\synthetic-project\\notes.md and continue.';
  const result = validateProgrammeState(broken);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => e.startsWith('resumption.next_action:') && e.includes('.fusion247')),
    `expected a privacy violation naming the field, got: ${result.errors.join(' | ')}`
  );
});

test('mutation: a .fusion247 path deep inside an array element is rejected too', () => {
  const broken = base();
  broken.runtime_pointers.push({ label: 'ding', path: 'C:/.fusion247/larry-ding.mjs', how_to_read: null });
  const result = validateProgrammeState(broken);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('runtime_pointers[1].path')));
});

test('the two declared privacy fields are the ONLY places a .fusion247 path may appear', () => {
  // Positive control: the private fixture puts such paths in exactly those two
  // fields and passes. Without this, the test above could pass for the wrong
  // reason (a rule that rejects the path everywhere, making a private build
  // impossible to bank at all).
  const result = validatePrivacyBoundary(privateBase());
  assert.deepEqual(result.errors, []);
  assert.ok(result.examined > 10, 'every string in the document must have been walked');
});

test('mutation: a private surface wider than one project subtree is rejected (GL-012)', () => {
  for (const bad of [
    'C:\\.fusion247\\**',
    'C:\\.fusion247\\private\\**',
    'C:\\.fusion247\\private\\synthetic-project',
    'C:\\.fusion247\\private\\a\\b\\**',
  ]) {
    const broken = privateBase();
    broken.privacy.private_surface = bad;
    broken.privacy.private_record = 'C:\\.fusion247\\private\\synthetic-project\\record.json';
    const result = validateProgrammeState(broken);
    assert.equal(result.ok, false, `${bad} should not be an acceptable surface`);
    assert.ok(result.errors.some((e) => e.includes('private_surface')));
  }
});

test('mutation: a declared private surface with no private_record is rejected (INV-6)', () => {
  const broken = privateBase();
  broken.privacy.private_record = null;
  const result = validateProgrammeState(broken);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('privacy.private_record')));
});

test('mutation: an omitted private_surface is rejected — mandatory even when "none"', () => {
  const broken = base();
  delete broken.privacy.private_surface;
  const result = validateProgrammeState(broken);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('private_surface')));
});

// ---------------------------------------------------------------------------
// MUTATION: consistency — the frontier is computed, not asserted
// ---------------------------------------------------------------------------

test('mutation: a ticket claiming frontier while a dependency is unresolved is rejected', () => {
  const broken = base();
  broken.tickets[2].state = 'frontier'; // T-03 depends on T-02, which is not resolved
  const result = validateProgrammeState(broken);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('T-03') && e.includes('frontier')));
});

test('mutation: a ticket left blocked when every dependency is resolved is rejected', () => {
  const broken = base();
  broken.tickets[1].state = 'blocked'; // T-02 depends only on T-01, which IS resolved
  const result = validateProgrammeState(broken);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('T-02') && e.includes('belongs on the frontier')));
});

test('mutation: a dependency on a ticket that does not exist is rejected', () => {
  const broken = base();
  broken.tickets[1].depends_on = ['T-99'];
  const result = validateProgrammeState(broken);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('T-99')));
});

test('mutation: a resolved ticket with no resolved date is rejected', () => {
  const broken = base();
  broken.tickets[0].resolved = null;
  const result = validateProgrammeState(broken);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('T-01') && e.includes('resolved date')));
});

test('mutation: an EMPTY collection that is not declared unknown is rejected — absent is never zero', () => {
  let checked = 0;
  for (const field of COLLECTION_FIELDS) {
    const broken = base();
    broken[field] = [];
    const result = validateProgrammeState(broken);
    assert.equal(result.ok, false, `empty ${field} slipped through as "there are none"`);
    assert.ok(result.errors.some((e) => e.startsWith(`${field}:`)));
    checked += 1;
  }
  assert.equal(checked, COLLECTION_FIELDS.length);
  assert.ok(checked >= 6);
});

test('an empty collection IS accepted once declared unknown, with a reason', () => {
  const state = base();
  state.workers = [];
  state.unknown = [{ path: 'workers', why: 'Live worker detection is best-effort; absence could not be established.' }];
  const result = validateProgrammeState(state);
  assert.deepEqual(result.errors, []);
});

test('mutation: an unknown declaration with no reason is rejected', () => {
  const broken = base();
  broken.workers = [];
  broken.unknown = [{ path: 'workers' }];
  const result = validateProgrammeState(broken);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('why')));
});

// ---------------------------------------------------------------------------
// Derived views
// ---------------------------------------------------------------------------

test('completed and frontier views are derived from tickets, and the frontier excludes blocked work', () => {
  const state = base();
  assert.deepEqual(completedTickets(state).map((t) => t.id), ['T-01']);
  assert.deepEqual(frontierTickets(state).map((t) => t.id), ['T-02']);
  assert.deepEqual(frontierForModel(state, 'Sonnet').map((t) => t.id), ['T-02']);
  assert.deepEqual(frontierForModel(state, 'Opus').map((t) => t.id), []);
});

test('resolving a ticket moves the next one onto the computed frontier without any hand edit', () => {
  const state = base();
  state.tickets[1].state = 'resolved';
  state.tickets[1].resolved = '2026-01-02';
  state.tickets[2].state = 'frontier';
  assert.deepEqual(validateProgrammeState(state).errors, []);
  assert.deepEqual(frontierTickets(state).map((t) => t.id), ['T-03']);
});

// ---------------------------------------------------------------------------
// MUTATION (required by 02-MAP.md section 9, T-09 row): move HEAD -> state is stale
// ---------------------------------------------------------------------------

test('mutation: moving HEAD in a REAL git repository flags the banked state stale', () => {
  const dir = freshDir();
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
  try {
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'test@example.invalid');
    git('config', 'user.name', 'Test');
    writeFileSync(join(dir, 'a.txt'), 'one');
    git('add', '-A');
    git('commit', '-q', '-m', 'first');
    const bankedHead = git('rev-parse', 'HEAD');

    const state = base();
    state.banked.head_sha = bankedHead;
    state.repository.head_sha = bankedHead;

    // Control: at the head it was banked against, with a clean pushed tree, it is fresh.
    const fresh = evaluateFreshness(state, { headSha: git('rev-parse', 'HEAD'), dirty: false, unpushedCount: 0 });
    assert.equal(fresh.stale, false, `expected fresh, got: ${fresh.reasons.join('; ')}`);
    assert.equal(fresh.checked, 4);

    // Mutation: move HEAD.
    writeFileSync(join(dir, 'b.txt'), 'two');
    git('add', '-A');
    git('commit', '-q', '-m', 'second');
    const movedHead = git('rev-parse', 'HEAD');
    assert.notEqual(movedHead, bankedHead, 'the mutation must actually have moved HEAD');

    const stale = evaluateFreshness(state, { headSha: movedHead, dirty: false, unpushedCount: 0 });
    assert.equal(stale.stale, true, 'moving HEAD must flag the banked state stale');
    assert.ok(stale.reasons.some((r) => r.includes('HEAD moved')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('freshness never reports fresh when it cannot tell (BLIND is not GREEN, INV-1)', () => {
  const state = base();
  assert.equal(evaluateFreshness(state, { headSha: 'unknown', dirty: false, unpushedCount: 0 }).stale, true);
  assert.equal(evaluateFreshness(state, { headSha: state.banked.head_sha, dirty: null, unpushedCount: 0 }).stale, true);
  assert.equal(evaluateFreshness(state, { headSha: state.banked.head_sha, dirty: false, unpushedCount: null }).stale, true);
  assert.equal(evaluateFreshness(state, {}).stale, true);

  const unknownBank = base();
  unknownBank.banked.head_sha = 'unknown';
  assert.equal(evaluateFreshness(unknownBank, { headSha: 'abc', dirty: false, unpushedCount: 0 }).stale, true);
});

test('a dirty tree or an unpushed commit makes banked state stale', () => {
  const state = base();
  const head = state.banked.head_sha;
  assert.ok(evaluateFreshness(state, { headSha: head, dirty: true, unpushedCount: 0 })
    .reasons.some((r) => r.includes('dirty')));
  assert.ok(evaluateFreshness(state, { headSha: head, dirty: false, unpushedCount: 2 })
    .reasons.some((r) => r.includes('unpushed')));
});

// ---------------------------------------------------------------------------
// Read / write
// ---------------------------------------------------------------------------

test('write then read round-trips the state exactly', () => {
  const dir = freshDir();
  try {
    const path = programmeStatePath(dir);
    const state = base();
    writeProgrammeState(state, path);
    const result = readProgrammeState(path);
    assert.equal(result.ok, true);
    assert.deepEqual(result.data, state);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('mutation: the writer REFUSES an invalid state and leaves no file behind (fail closed on bank)', () => {
  const dir = freshDir();
  try {
    const path = programmeStatePath(dir);
    const broken = base();
    delete broken.resumption;
    assert.throws(() => writeProgrammeState(broken, path), /refusing to bank an invalid programme state/);
    assert.equal(existsSync(path), false, 'no partial or invalid state file may be left on disk');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('reading a state that was never banked reports missing, not a crash', () => {
  const dir = freshDir();
  try {
    const result = readProgrammeState(programmeStatePath(dir));
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'missing');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('mutation: a future schema version is refused loudly, never parsed optimistically', () => {
  const dir = freshDir();
  try {
    const path = programmeStatePath(dir);
    const state = base();
    writeFileSync(path, JSON.stringify({ ...state, schema_version: 99 }));
    const result = readProgrammeState(path);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'schema-version-mismatch');
    assert.equal(result.found, 99);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('mutation: a corrupt state file reports unreadable rather than throwing', () => {
  const dir = freshDir();
  try {
    const path = programmeStatePath(dir);
    writeFileSync(path, '{"schema_version": 1, "programme"');
    const result = readProgrammeState(path);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'unreadable');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('mutation: a state file that is valid JSON but violates the schema reports invalid, with the errors', () => {
  const dir = freshDir();
  try {
    const path = programmeStatePath(dir);
    const broken = base();
    broken.model_recommendation.model = 'GPT';
    writeFileSync(path, JSON.stringify(broken));
    const result = readProgrammeState(path);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'invalid');
    assert.ok(result.errors.length > 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Render: compatibility with the EXISTING session-handoff.md contract (AD-12)
// ---------------------------------------------------------------------------

test('the render reproduces the existing session-handoff.md contract exactly', () => {
  const md = renderSessionHandoff(base());
  assert.match(md, /^---\nartefact: session-handoff\n/, 'frontmatter must open with the artefact key');
  for (const key of ['artefact', 'provenance', 'owner_intent']) {
    assert.match(md, new RegExp(`^${key}: `, 'm'), `missing frontmatter key ${key}`);
  }
  assert.match(md, /^# Next-session handoff \(resume here\)$/m);
  for (const section of HANDOFF_SECTIONS) {
    assert.ok(md.includes(`## ${section}`), `missing section: ${section}`);
  }
  // Section order must match the existing file.
  const positions = HANDOFF_SECTIONS.map((s) => md.indexOf(`## ${s}`));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b), 'sections must appear in the contract order');
});

test('the render is DERIVED, not curated — provenance says so', () => {
  const md = renderSessionHandoff(base());
  assert.match(md, /^provenance: derived \(/m);
  assert.match(md, /do not hand-edit/);
});

test('the render carries the exact next action, the frontier, and the do-not list', () => {
  const state = base();
  const md = renderSessionHandoff(state);
  assert.ok(md.includes(state.resumption.next_action), 'the exact next action must survive rendering');
  assert.ok(md.includes('**T-02**'), 'the computed frontier must appear');
  assert.ok(md.includes('Do not alter main.'), 'boundaries must survive rendering');
  assert.ok(md.includes('Model recommendation: Sonnet'));
});

test('mutation: unknown declarations must appear in the render, never be silently dropped', () => {
  const state = base();
  state.workers = [];
  state.unknown = [{ path: 'workers', why: 'not gathered at banking' }];
  const md = renderSessionHandoff(state);
  assert.ok(md.includes('do NOT read these as "none"'));
  assert.ok(md.includes('not gathered at banking'));
  assert.ok(md.includes('`workers`'));
});

test('a private-surface state renders a marker, and leaks no private path into the body', () => {
  const md = renderSessionHandoff(privateBase());
  assert.ok(md.includes('Private surface declared.'));
  assert.equal(
    /\.fusion247/i.test(md), false,
    'the rendered public handoff must not contain any .fusion247 path'
  );
});

test('mutation: the renderer refuses invalid state rather than emitting a plausible-looking handoff', () => {
  const broken = base();
  broken.resumption.next_action = '';
  assert.throws(() => renderSessionHandoff(broken), /refusing to render a handoff from invalid programme state/);
});

test('sessionHandoffPath points at the EXISTING contract file, not a rival location (AD-12)', () => {
  const p = sessionHandoffPath('C:/repo');
  assert.ok(p.endsWith(join('Team Knowledge', 'fusion-brief', 'session-handoff.md')), p);
});

test('the real repository still has the handoff file this renderer targets', () => {
  // If the target moves or is renamed, AD-12's "derive, do not replace" quietly
  // becomes "create a rival file". Catch that here rather than at rotation time.
  const repoRoot = join(__dirname, '..', '..');
  assert.ok(existsSync(sessionHandoffPath(repoRoot)), 'session-handoff.md is missing — AD-12 target moved');
});

// ---------------------------------------------------------------------------
// resolveTicket / deriveResumption / resolveTicketAndAdvance — THE canonical
// write-back (fix for the 2026-07-31 T-14 incident: a ticket resolved in the
// map's narrative but never in tickets[], so the next rotation banked a
// resumption pointer that contradicted work already done).
// ---------------------------------------------------------------------------

test('resolveTicket: marks the ticket resolved, attaches evidence and date, leaves siblings untouched', () => {
  const next = resolveTicket(base(), { id: 'T-02', resolvedDate: '2026-02-01', evidence: ['ev/T-02.md'] });
  const t02 = next.tickets.find((t) => t.id === 'T-02');
  assert.equal(t02.state, 'resolved');
  assert.equal(t02.resolved, '2026-02-01');
  assert.deepEqual(t02.evidence, ['ev/T-02.md']);
  assert.equal(next.tickets.find((t) => t.id === 'T-01').state, 'resolved', 'T-01 was already resolved and must stay so');
});

test('resolveTicket: promotes a newly-unblocked sibling from blocked to frontier (T-03 depends on T-02)', () => {
  const next = resolveTicket(base(), { id: 'T-02', resolvedDate: '2026-02-01', evidence: ['ev/T-02.md'] });
  assert.equal(next.tickets.find((t) => t.id === 'T-03').state, 'frontier');
});

test('MUTATION: resolveTicket refuses an unknown ticket id', () => {
  assert.throws(() => resolveTicket(base(), { id: 'T-999', resolvedDate: '2026-02-01', evidence: ['x'] }), /no ticket "T-999"/);
});

test('MUTATION: resolveTicket refuses empty evidence — a resolution with no evidence is the exact AD-24 defect, one layer earlier', () => {
  assert.throws(() => resolveTicket(base(), { id: 'T-02', resolvedDate: '2026-02-01', evidence: [] }), /evidence must be a non-empty array/);
  assert.throws(() => resolveTicket(base(), { id: 'T-02', resolvedDate: '2026-02-01' }), /evidence must be a non-empty array/);
});

test('MUTATION: resolveTicket refuses a missing resolvedDate', () => {
  assert.throws(() => resolveTicket(base(), { id: 'T-02', evidence: ['x'] }), /resolvedDate is required/);
});

test('deriveResumption: a single frontier ticket is auto-selected, no override needed', () => {
  const resolved = resolveTicket(base(), { id: 'T-02', resolvedDate: '2026-02-01', evidence: ['ev/T-02.md'] });
  // T-03 is now the sole frontier ticket (T-02 resolved, its only dependency).
  const next = deriveResumption(resolved, {});
  assert.equal(next.resumption.ticket, 'T-03');
  assert.equal(next.model_recommendation.model, 'Opus'); // T-03's own model in the fixture
});

test('MUTATION: deriveResumption refuses an explicit override that is not actually on the computed frontier', () => {
  assert.throws(
    () => deriveResumption(base(), { nextTicket: 'T-03' }), // T-03 is still blocked in the base fixture
    /is NOT on the computed frontier/
  );
});

test('MUTATION: deriveResumption refuses to guess among MULTIPLE frontier tickets — a judgement call, not automatable', () => {
  const state = base();
  // Make T-03 independently takable too, so there are two frontier tickets at once.
  state.tickets = state.tickets.map((t) => (t.id === 'T-03' ? { ...t, depends_on: [] } : t));
  assert.throws(() => deriveResumption(state, {}), /judgement call this function will not fake-automate/);
  // An explicit override among the two DOES work:
  const next = deriveResumption(state, { nextTicket: 'T-02', nextActionText: 'do T-02', model: 'Sonnet' });
  assert.equal(next.resumption.ticket, 'T-02');
});

test('deriveResumption: an exhausted frontier (0 tickets) names no ticket and says so', () => {
  const state = base();
  state.tickets = state.tickets.map((t) => ({ ...t, state: 'resolved', resolved: '2026-01-01', evidence: ['x'] }));
  const next = deriveResumption(state, {});
  assert.equal(next.resumption.ticket, null);
  assert.match(next.resumption.next_action, /No ticket is currently on the frontier/);
});

test('resolveTicketAndAdvance: the one bounded atomic function — resolves, advances resumption, validates', () => {
  const { state: next, examined } = resolveTicketAndAdvance(base(), {
    resolve: { id: 'T-02', resolvedDate: '2026-02-01', evidence: ['ev/T-02.md'] },
    resumption: {},
  });
  assert.ok(examined > 0);
  assert.equal(validateProgrammeState(next).ok, true, 'the result must itself be bankable');
  assert.equal(next.resumption.ticket, 'T-03');
  assert.equal(completedTickets(next).map((t) => t.id).sort().join(','), 'T-01,T-02');
  assert.equal(frontierTickets(next).map((t) => t.id).join(','), 'T-03');
});

test('MUTATION: resolveTicketAndAdvance refuses (throws) rather than returning an unbankable document', () => {
  // Resolve T-02 but then override resumption onto a ticket NOT on the (now-recomputed) frontier.
  assert.throws(
    () => resolveTicketAndAdvance(base(), {
      resolve: { id: 'T-02', resolvedDate: '2026-02-01', evidence: ['ev/T-02.md'] },
      resumption: { nextTicket: 'T-01' }, // already resolved, never frontier
    }),
    /NOT on the computed frontier/
  );
});

// ---------------------------------------------------------------------------
// The generated map status block
// ---------------------------------------------------------------------------

test('renderMapStatusBlock: names phase, completed, frontier and resumption from the document alone', () => {
  const block = renderMapStatusBlock(base());
  assert.match(block, /Completed \(1\):\*\* T-01/);
  assert.match(block, /Frontier — takable now \(1\):\*\* T-02 \[Sonnet\]/);
  assert.match(block, /Resumption:\*\*\s*T-02/);
});

test('updateMapStatusBlock: replaces exactly the marked region, leaving the rest of the map untouched', () => {
  const mapText = [
    '# Map', '', 'before text stays', '',
    MAP_STATUS_MARKERS.begin, 'stale content', MAP_STATUS_MARKERS.end,
    '', 'after text stays',
  ].join('\n');
  const updated = updateMapStatusBlock(mapText, base());
  assert.match(updated, /before text stays/);
  assert.match(updated, /after text stays/);
  assert.doesNotMatch(updated, /stale content/);
  assert.match(updated, /Frontier — takable now \(1\):\*\* T-02/);
});

test('MUTATION: updateMapStatusBlock refuses to guess when the markers are missing, rather than inserting the block somewhere arbitrary', () => {
  assert.throws(() => updateMapStatusBlock('# a map with no markers at all', base()), /markers not found/);
});

test('MUTATION: updateMapStatusBlock refuses when the markers are present but out of order', () => {
  const backwards = `${MAP_STATUS_MARKERS.end}\nstuff\n${MAP_STATUS_MARKERS.begin}`;
  assert.throws(() => updateMapStatusBlock(backwards, base()), /markers not found \(or out of order\)/);
});

// ---------------------------------------------------------------------------
// checkExecutionProjectionAgreement — the STALE_EXECUTION_STATE check itself
// ---------------------------------------------------------------------------

test('extractMapTicketMarkers: reads the ~~title~~ **RESOLVED** convention, and only that convention', () => {
  const text = [
    '| **T-01** | ~~**First**~~ **RESOLVED 2026-01-01.** |',
    '| **T-02** | **Second** — frontier |',
  ].join('\n');
  const markers = extractMapTicketMarkers(text);
  assert.equal(markers.get('T-01'), 'resolved');
  assert.equal(markers.get('T-02'), 'not-resolved');
  assert.equal(markers.has('T-03'), false);
});

test('extractMapTicketMarkers: the FIRST row for a ticket id wins over a later duplicate', () => {
  const text = [
    '| **T-01** | ~~**First**~~ **RESOLVED 2026-01-01.** |',
    '| **T-01** | **duplicate row, should never happen, must not override** |',
  ].join('\n');
  assert.equal(extractMapTicketMarkers(text).get('T-01'), 'resolved');
});

test('checkExecutionProjectionAgreement: agreement on every ticket in the table', () => {
  const text = [
    '| **T-01** | ~~**t**~~ **RESOLVED 2026-01-01.** |',
    '| **T-02** | **t** — frontier |',
    '| **T-03** | **t** |',
  ].join('\n');
  const r = checkExecutionProjectionAgreement(base(), text);
  assert.equal(r.ok, true);
  assert.equal(r.disagreements.length, 0);
  assert.ok(r.checked > 0, 'INV-5: must assert a non-zero count of tickets actually compared');
});

test('MUTATION (THE T-14 INCIDENT): map claims a ticket resolved that the ledger still calls frontier', () => {
  const text = [
    '| **T-01** | ~~**t**~~ **RESOLVED 2026-01-01.** |',
    '| **T-02** | ~~**t**~~ **RESOLVED 2026-08-01.** |', // map says resolved; ledger's T-02 is 'frontier'
    '| **T-03** | **t** |',
  ].join('\n');
  const r = checkExecutionProjectionAgreement(base(), text);
  assert.equal(r.ok, false);
  assert.deepEqual(r.disagreements, [{ id: 'T-02', mapClaims: 'resolved', ledgerClaims: 'frontier' }]);
});

test('MUTATION (reverse direction): ledger says resolved, map row shows no resolved marker', () => {
  const text = [
    '| **T-01** | **t** — no marker, but the ledger already calls this resolved |',
    '| **T-02** | **t** — frontier |',
    '| **T-03** | **t** |',
  ].join('\n');
  const r = checkExecutionProjectionAgreement(base(), text);
  assert.equal(r.ok, false);
  assert.deepEqual(r.disagreements, [{ id: 'T-01', mapClaims: 'not-resolved', ledgerClaims: 'resolved' }]);
});

test('a ticket with no row in the map at all is out of this check\'s scope — never a silent pass, never a false alarm', () => {
  const r = checkExecutionProjectionAgreement(base(), '# a map with no ticket-index table');
  assert.equal(r.ok, true);
  assert.equal(r.checked, 0, 'nothing was found to compare, and that must be visible, not disguised as agreement');
});

// ---------------------------------------------------------------------------
// applyTicketResolution — the impure atomic entrypoint: writes BOTH files, or
// neither. This is the function that removes the dual-write failure for real.
// ---------------------------------------------------------------------------

test('applyTicketResolution: resolves the ticket AND regenerates the map status block, atomically', () => {
  const dir = freshDir();
  try {
    const statePath = join(dir, 'programme-state.json');
    const mapPath = join(dir, '02-MAP.md');
    writeFileSync(statePath, JSON.stringify(base(), null, 2));
    writeFileSync(
      mapPath,
      ['# Map', MAP_STATUS_MARKERS.begin, 'stale', MAP_STATUS_MARKERS.end, ''].join('\n')
    );

    const { state } = applyTicketResolution({
      statePath,
      mapPath,
      resolve: { id: 'T-02', resolvedDate: '2026-02-01', evidence: ['ev/T-02.md'] },
      resumption: {},
    });

    assert.equal(state.resumption.ticket, 'T-03');
    const rereadState = readProgrammeState(statePath);
    assert.equal(rereadState.ok, true);
    assert.equal(rereadState.data.tickets.find((t) => t.id === 'T-02').state, 'resolved');

    const rereadMap = readFileSync(mapPath, 'utf8');
    assert.match(rereadMap, /Frontier — takable now \(1\):\*\* T-03/);
    assert.doesNotMatch(rereadMap, /stale/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('MUTATION: applyTicketResolution writes NEITHER file when the resolution would be invalid', () => {
  const dir = freshDir();
  try {
    const statePath = join(dir, 'programme-state.json');
    const mapPath = join(dir, '02-MAP.md');
    const originalStateText = JSON.stringify(base(), null, 2);
    const originalMapText = ['# Map', MAP_STATUS_MARKERS.begin, 'stale', MAP_STATUS_MARKERS.end, ''].join('\n');
    writeFileSync(statePath, originalStateText);
    writeFileSync(mapPath, originalMapText);

    assert.throws(() =>
      applyTicketResolution({
        statePath,
        mapPath,
        resolve: { id: 'T-999', resolvedDate: '2026-02-01', evidence: ['x'] }, // unknown ticket
        resumption: {},
      })
    );

    // Neither file was touched — atomicity across the two writes.
    assert.equal(readFileSync(statePath, 'utf8'), originalStateText);
    assert.equal(readFileSync(mapPath, 'utf8'), originalMapText);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('MUTATION: applyTicketResolution throws if the map has no GOVERNOR:STATUS markers, and writes neither file', () => {
  const dir = freshDir();
  try {
    const statePath = join(dir, 'programme-state.json');
    const mapPath = join(dir, '02-MAP.md');
    const originalStateText = JSON.stringify(base(), null, 2);
    writeFileSync(statePath, originalStateText);
    writeFileSync(mapPath, '# a map with no markers');

    assert.throws(() =>
      applyTicketResolution({
        statePath,
        mapPath,
        resolve: { id: 'T-02', resolvedDate: '2026-02-01', evidence: ['ev/T-02.md'] },
        resumption: {},
      }),
      /markers not found/
    );
    assert.equal(readFileSync(statePath, 'utf8'), originalStateText, 'state must not be written if the map write would fail');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
