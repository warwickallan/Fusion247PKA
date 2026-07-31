import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  resolveCurrentModel,
  evaluateModelGate,
  renderCompactGate,
  applyModelGate,
  isAutoLabel,
  normaliseModelFamily,
  STATUS,
  EXIT_CODE,
  DEFAULT_MAX_SAMPLE_AGE_MS,
  MODEL_GATE_VERDICT,
  runCli,
} from './model-gate.mjs';

import { reorient, runHook, VERDICT, CONTEXT_CAP } from './reorient.mjs';
import { writeHealthSample } from './health-store.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(__dirname, 'fixtures', 'programme-state.minimal.json');
const MODEL_GATE_SRC = join(__dirname, 'model-gate.mjs');

function loadFixture() {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
}

// A scratch estate: a real git repo with a real Deliverables/<X>/programme-state.json.
// Same pattern as reorient.test.mjs's makeEstate — replicated here rather than
// imported so this file stays independently runnable and does not reach into
// reorient.test.mjs's module (which exports nothing; it is a test file, not a library).
function makeEstate({ state = loadFixture(), programme = 'BUILD-TEST', branch = 'main' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'governor-modelgate-'));
  execFileSync('git', ['-C', root, 'init', '-q', '-b', branch]);
  execFileSync('git', ['-C', root, 'config', 'user.email', 'test@example.com']);
  execFileSync('git', ['-C', root, 'config', 'user.name', 'Test']);

  const home = join(root, 'Deliverables', programme);
  mkdirSync(home, { recursive: true });
  writeFileSync(join(root, 'seed.txt'), 'seed\n');
  execFileSync('git', ['-C', root, 'add', '.']);
  execFileSync('git', ['-C', root, 'commit', '-q', '-m', 'seed']);
  const baseSha = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

  // AD-14: banked.head_sha is the head the state DESCRIBES — the parent of the
  // commit that carries the state file. So bank against the CURRENT head, then commit.
  const doc = JSON.parse(JSON.stringify(state));
  doc.programme.id = programme;
  doc.programme.status = 'active';
  doc.programme.home = `Deliverables/${programme}`;
  doc.banked.head_sha = baseSha;
  doc.repository.worktree = root.replace(/\\/g, '/');
  doc.repository.head_sha = baseSha;
  doc.repository.branch = branch;
  doc.resumption.worktree = root.replace(/\\/g, '/');
  doc.resumption.branch = branch;

  const statePath = join(home, 'programme-state.json');
  writeFileSync(statePath, JSON.stringify(doc, null, 2) + '\n');
  execFileSync('git', ['-C', root, 'add', '.']);
  execFileSync('git', ['-C', root, 'commit', '-q', '-m', 'bank']);

  return { root, home, statePath, baseSha, doc, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function freshHealthDir() {
  return mkdtempSync(join(tmpdir(), 'governor-modelgate-health-'));
}

// ---------------------------------------------------------------------------
// Pure: label recognition
// ---------------------------------------------------------------------------

test('isAutoLabel: recognises "auto" as a whole word, case-insensitively', () => {
  assert.equal(isAutoLabel('Auto'), true);
  assert.equal(isAutoLabel('auto'), true);
  assert.equal(isAutoLabel('AUTO'), true);
  assert.equal(isAutoLabel('Claude Auto'), true);
  assert.equal(isAutoLabel('Opus'), false);
  assert.equal(isAutoLabel('Automatic'), false, 'must not match "automatic" as a substring of "auto"');
  assert.equal(isAutoLabel(null), false);
  assert.equal(isAutoLabel(undefined), false);
  assert.equal(isAutoLabel(42), false);
});

test('normaliseModelFamily: coarse family extraction, null on unknown', () => {
  assert.equal(normaliseModelFamily('Claude Opus 4.5'), 'opus');
  assert.equal(normaliseModelFamily('Sonnet 5'), 'sonnet');
  assert.equal(normaliseModelFamily('Haiku'), 'haiku');
  assert.equal(normaliseModelFamily('Auto'), null);
  assert.equal(normaliseModelFamily('gpt-4'), null);
  assert.equal(normaliseModelFamily(null), null);
});

// ---------------------------------------------------------------------------
// resolveCurrentModel — the fail-closed core
// ---------------------------------------------------------------------------

test('resolveCurrentModel: AUTO — a health sample whose label contains "auto"', () => {
  const sampleResult = {
    ok: true,
    data: { session_id: 's-1', sampled_at: new Date().toISOString(), model: { display_name: 'Auto' } },
  };
  const r = resolveCurrentModel({ sampleResult, sessionId: 's-1' });
  assert.equal(r.label, 'AUTO');
});

test('resolveCurrentModel: UNKNOWN (INV-1 core case) — no sample recorded for the session at all', () => {
  const sampleResult = { ok: false, reason: 'missing', path: 'X' };
  const r = resolveCurrentModel({ sampleResult, sessionId: 's-1' });
  assert.equal(r.label, 'UNKNOWN', 'BLIND is never GREEN — absence of a sample must never resolve to a trusted model');
  assert.match(r.reason, /no health sample has been recorded/);
});

test('resolveCurrentModel: an unreadable sample is UNKNOWN, with the read error surfaced', () => {
  const sampleResult = { ok: false, reason: 'unreadable', error: 'Unexpected token', path: 'X' };
  const r = resolveCurrentModel({ sampleResult, sessionId: 's-1' });
  assert.equal(r.label, 'UNKNOWN');
  assert.match(r.reason, /unreadable/);
  assert.match(r.reason, /Unexpected token/);
});

test('resolveCurrentModel: an explicit concrete model label resolves as itself', () => {
  const sampleResult = {
    ok: true,
    data: { session_id: 's-1', sampled_at: new Date().toISOString(), model: { display_name: 'Haiku 4.5' } },
  };
  const r = resolveCurrentModel({ sampleResult, sessionId: 's-1' });
  assert.equal(r.label, 'Haiku 4.5');
});

test('resolveCurrentModel: stale sample (too old) is UNKNOWN, never trusted', () => {
  const old = new Date(Date.now() - (DEFAULT_MAX_SAMPLE_AGE_MS + 60_000)).toISOString();
  const sampleResult = {
    ok: true,
    data: { session_id: 's-1', sampled_at: old, model: { display_name: 'Sonnet 5' } },
  };
  const r = resolveCurrentModel({ sampleResult, sessionId: 's-1' });
  assert.equal(r.label, 'UNKNOWN');
  assert.match(r.reason, /old/);
  assert.match(r.reason, /freshness window/);
});

test('resolveCurrentModel: stale sample from THE FUTURE is also UNKNOWN, never trusted', () => {
  const future = new Date(Date.now() + (DEFAULT_MAX_SAMPLE_AGE_MS + 60_000)).toISOString();
  const sampleResult = {
    ok: true,
    data: { session_id: 's-1', sampled_at: future, model: { display_name: 'Sonnet 5' } },
  };
  const r = resolveCurrentModel({ sampleResult, sessionId: 's-1' });
  assert.equal(r.label, 'UNKNOWN');
  assert.match(r.reason, /in the future/);
});

test('resolveCurrentModel: cross-session sample (recorded under a DIFFERENT session_id) is UNKNOWN, never trusted', () => {
  const sampleResult = {
    ok: true,
    data: { session_id: 'session-A', sampled_at: new Date().toISOString(), model: { display_name: 'Opus' } },
  };
  const r = resolveCurrentModel({ sampleResult, sessionId: 'session-B' });
  assert.equal(r.label, 'UNKNOWN', 'must not trust another session\'s model reading');
  assert.match(r.reason, /session-A/);
  assert.match(r.reason, /session-B/);
  assert.match(r.reason, /refusing to trust a sample from a different session/);
});

test('resolveCurrentModel: an unreadable/missing sampled_at is UNKNOWN', () => {
  const sampleResult = {
    ok: true,
    data: { session_id: 's-1', sampled_at: 'not-a-date', model: { display_name: 'Opus' } },
  };
  const r = resolveCurrentModel({ sampleResult, sessionId: 's-1' });
  assert.equal(r.label, 'UNKNOWN');
  assert.match(r.reason, /sampled_at/);
});

test('resolveCurrentModel: a sample with no readable model field is UNKNOWN', () => {
  const sampleResult = {
    ok: true,
    data: { session_id: 's-1', sampled_at: new Date().toISOString(), model: {} },
  };
  const r = resolveCurrentModel({ sampleResult, sessionId: 's-1' });
  assert.equal(r.label, 'UNKNOWN');
  assert.match(r.reason, /model\.display_name/);
});

// ---------------------------------------------------------------------------
// evaluateModelGate — the decision
// ---------------------------------------------------------------------------

test('evaluateModelGate: UNKNOWN current model blocks', () => {
  const g = evaluateModelGate({ recommendedModel: 'Opus', currentModel: { label: 'UNKNOWN', reason: 'no sample' } });
  assert.equal(g.status, STATUS.UNKNOWN);
});

test('evaluateModelGate: AUTO current model blocks', () => {
  const g = evaluateModelGate({ recommendedModel: 'Opus', currentModel: { label: 'AUTO' } });
  assert.equal(g.status, STATUS.AUTO);
});

test('evaluateModelGate: explicit MISMATCH — current family disagrees with recommended family', () => {
  const g = evaluateModelGate({ recommendedModel: 'Opus', currentModel: { label: 'Haiku 4.5' } });
  assert.equal(g.status, STATUS.MISMATCH);
});

test('evaluateModelGate: explicit MATCH — current family agrees with recommended family', () => {
  const g = evaluateModelGate({ recommendedModel: 'Opus', currentModel: { label: 'Claude Opus 4.5' } });
  assert.equal(g.status, STATUS.MATCH);
});

test('evaluateModelGate: recommendedModel "any" matches any known family', () => {
  const g = evaluateModelGate({ recommendedModel: 'any', currentModel: { label: 'Sonnet 5' } });
  assert.equal(g.status, STATUS.MATCH);
});

test('evaluateModelGate: recommendedModel "any" still blocks AUTO/UNKNOWN', () => {
  assert.equal(evaluateModelGate({ recommendedModel: 'any', currentModel: { label: 'AUTO' } }).status, STATUS.AUTO);
  assert.equal(evaluateModelGate({ recommendedModel: 'any', currentModel: { label: 'UNKNOWN' } }).status, STATUS.UNKNOWN);
});

test('evaluateModelGate: recommendedModel "unknown" cannot be verified against — UNKNOWN, fails closed', () => {
  const g = evaluateModelGate({ recommendedModel: 'unknown', currentModel: { label: 'Sonnet 5' } });
  assert.equal(g.status, STATUS.UNKNOWN);
});

// ---------------------------------------------------------------------------
// EXIT_CODE — distinct codes, INV-1 mirrored
// ---------------------------------------------------------------------------

test('EXIT_CODE: every STATUS value has its own distinct numeric code', () => {
  const codes = Object.values(STATUS).map((s) => EXIT_CODE[s]);
  assert.equal(codes.length, 4);
  for (const c of codes) assert.equal(typeof c, 'number');
  assert.equal(new Set(codes).size, codes.length, 'all four exit codes must be distinct');
  assert.equal(EXIT_CODE[STATUS.MATCH], 0, 'only MATCH may exit 0');
  assert.notEqual(EXIT_CODE[STATUS.UNKNOWN], 0);
  assert.notEqual(EXIT_CODE[STATUS.AUTO], 0);
  assert.notEqual(EXIT_CODE[STATUS.MISMATCH], 0);
});

// ---------------------------------------------------------------------------
// renderCompactGate — the exact six-line shape Warwick specified
// ---------------------------------------------------------------------------

const SIX_LINE_RE =
  /^REORIENTED — .*\nLocation: .*\nNext ticket: .*\nRecommended model: .*\nCurrent model: .*\nAction: .*/;

test('renderCompactGate: emits the compact 6-line gate format in order, on the MATCH path', () => {
  const text = renderCompactGate({
    buildId: 'BUILD-TEST',
    locationVerdict: 'verified',
    nextTicket: 'T-02',
    recommendedModel: 'Sonnet',
    gate: { status: STATUS.MATCH, label: 'Sonnet 5' },
    sessionId: 's-1',
    statePath: 'X/programme-state.json',
  });
  assert.match(text, SIX_LINE_RE);
});

test('renderCompactGate: emits the compact 6-line gate format in order, on a BLOCKED path', () => {
  const text = renderCompactGate({
    buildId: 'BUILD-TEST',
    locationVerdict: 'verified',
    nextTicket: 'T-02',
    recommendedModel: 'Opus',
    gate: { status: STATUS.AUTO, label: 'AUTO' },
    sessionId: 's-1',
    statePath: 'X/programme-state.json',
  });
  assert.match(text, SIX_LINE_RE);
  assert.match(text, /STOP/);
});

// ---------------------------------------------------------------------------
// applyModelGate — the composition
// ---------------------------------------------------------------------------

test('applyModelGate: true no-op when the underlying reorient() result does not permit implementation', () => {
  for (const bad of [
    { verdict: VERDICT.WRONG_WORKTREE, context: 'wrong worktree brief', implementationPermitted: false },
    { verdict: VERDICT.FAILED, context: 'failed brief' }, // implementationPermitted absent entirely
    { verdict: VERDICT.MISSING, context: 'missing brief', implementationPermitted: undefined },
    null,
    undefined,
  ]) {
    const out = applyModelGate(bad, { sessionId: 's-1' });
    assert.equal(out, bad, 'must return the exact same object/value — never construct a new blocked wrapper on top');
  }
});

test('applyModelGate: end-to-end — bank recommends Opus, session is Auto, blocks with the compact gate', () => {
  const e = makeEstate();
  const healthDir = freshHealthDir();
  try {
    // Set the bank's recommendation explicitly to Opus.
    const doc = JSON.parse(readFileSync(e.statePath, 'utf8'));
    doc.model_recommendation.model = 'Opus';
    writeFileSync(e.statePath, JSON.stringify(doc, null, 2) + '\n');
    execFileSync('git', ['-C', e.root, 'add', '.']);
    execFileSync('git', ['-C', e.root, 'commit', '-q', '--amend', '--no-edit']);

    const sessionId = 'sess-auto';
    writeHealthSample(sessionId, {
      session_id: sessionId,
      sampled_at: new Date().toISOString(),
      model: { display_name: 'Auto', id: null },
    }, { envOverride: healthDir });

    const base = reorient({ source: 'clear', cwd: e.root });
    assert.equal(base.verdict, VERDICT.ORIENTED, `precondition: base reorient must be ORIENTED, got ${base.verdict}: ${base.context?.slice(0, 300)}`);
    assert.equal(base.implementationPermitted, true);

    const gated = applyModelGate(base, { sessionId, healthOpts: { envOverride: healthDir } });

    assert.notEqual(gated.verdict, base.verdict, 'the gate must NOT be the original ORIENTED verdict');
    assert.equal(gated.verdict, MODEL_GATE_VERDICT);
    assert.equal(gated.implementationPermitted, false);
    assert.equal(gated.modelGate.status, STATUS.AUTO);
    assert.match(gated.context, SIX_LINE_RE);
    assert.match(gated.context, /Recommended model: Opus/);
    assert.match(gated.context, /Current model: AUTO/);
  } finally {
    e.cleanup();
    rmSync(healthDir, { recursive: true, force: true });
  }
});

test('applyModelGate: MATCH releases — implementationPermitted true, original brief content preserved', () => {
  const e = makeEstate();
  const healthDir = freshHealthDir();
  try {
    const doc = JSON.parse(readFileSync(e.statePath, 'utf8'));
    doc.model_recommendation.model = 'Sonnet';
    writeFileSync(e.statePath, JSON.stringify(doc, null, 2) + '\n');
    execFileSync('git', ['-C', e.root, 'add', '.']);
    execFileSync('git', ['-C', e.root, 'commit', '-q', '--amend', '--no-edit']);

    const sessionId = 'sess-match';
    writeHealthSample(sessionId, {
      session_id: sessionId,
      sampled_at: new Date().toISOString(),
      model: { display_name: 'Sonnet 5', id: 'claude-sonnet-5' },
    }, { envOverride: healthDir });

    const base = reorient({ source: 'clear', cwd: e.root });
    assert.equal(base.verdict, VERDICT.ORIENTED);

    const gated = applyModelGate(base, { sessionId, healthOpts: { envOverride: healthDir } });

    assert.equal(gated.implementationPermitted, true);
    assert.equal(gated.modelGate.status, STATUS.MATCH);
    assert.ok(gated.context.includes(base.context), 'the original brief content must survive, prepended by the gate banner');
    assert.match(gated.context, /Current model: Sonnet 5/);
  } finally {
    e.cleanup();
    rmSync(healthDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// AD-5 — the 10,000-char SessionStart cap, proven for real with an oversized context
// ---------------------------------------------------------------------------

test('MUTATION (AD-5): the combined MATCH-path output never exceeds the cap, and truncates the ORIGINAL brief, never the gate banner', () => {
  const oversizedContext = 'ORIGINAL-BRIEF-CONTENT. ' + 'X'.repeat(20000);
  const fakeReorientResult = {
    verdict: VERDICT.ORIENTED,
    implementationPermitted: true,
    context: oversizedContext,
    state: {
      model_recommendation: { model: 'Sonnet' },
      resumption: { ticket: 'T-02' },
      programme: { id: 'BUILD-TEST' },
    },
    location: { verdict: 'aligned' },
    statePath: 'X/programme-state.json',
  };

  const sampleResult = {
    ok: true,
    data: { session_id: 's-1', sampled_at: new Date().toISOString(), model: { display_name: 'Sonnet 5' } },
  };

  const gated = applyModelGate(fakeReorientResult, {
    sessionId: 's-1',
    readSample: () => sampleResult,
  });

  assert.equal(gated.modelGate.status, STATUS.MATCH);
  assert.ok(gated.context.length <= CONTEXT_CAP, `combined output must respect the ${CONTEXT_CAP}-char cap, got ${gated.context.length}`);
  assert.match(gated.context, /REORIENTED — /, 'the gate banner must survive intact — it is never the thing truncated');
  assert.match(gated.context, /Current model: Sonnet 5/, 'the full gate banner text must survive');
  assert.match(gated.context, /TRUNCATED/, 'truncation of the oversized original context must be announced');
  assert.ok(gated.context.includes('ORIGINAL-BRIEF-CONTENT.'), 'the start of the original brief must survive (truncated from the tail, not dropped outright)');
  assert.ok(!gated.context.endsWith('X'.repeat(100)), 'the original context must actually have been cut short, not just left oversized');
});

test('applyModelGate: when the gate banner ALONE already exceeds the cap, it is hard-truncated as a last resort', () => {
  const fakeReorientResult = {
    verdict: VERDICT.ORIENTED,
    implementationPermitted: true,
    context: 'short original context',
    state: {
      model_recommendation: { model: 'Sonnet' },
      // An absurdly long ticket name to blow the banner itself past the cap.
      resumption: { ticket: 'T-' + 'Z'.repeat(20000) },
      programme: { id: 'BUILD-TEST' },
    },
    location: { verdict: 'aligned' },
    statePath: 'X/programme-state.json',
  };
  const sampleResult = {
    ok: true,
    data: { session_id: 's-1', sampled_at: new Date().toISOString(), model: { display_name: 'Sonnet 5' } },
  };
  const gated = applyModelGate(fakeReorientResult, { sessionId: 's-1', readSample: () => sampleResult });
  assert.ok(gated.context.length <= CONTEXT_CAP, `even the degenerate banner-only case must respect the cap, got ${gated.context.length}`);
});

// ---------------------------------------------------------------------------
// LIVE ACCEPTANCE PROOF — the real Warwick-facing flow, end to end
// ---------------------------------------------------------------------------
// What this stands in for: T-03's sampler (tools/governor/sampler.mjs) is the thing
// that would normally write a health sample automatically from the live statusLine
// command on every turn — but that sampler is NOT wired into the live statusLine
// command yet (deliberately out of scope for T-15; it is its own, separate wiring
// step). So this test writes the health sample directly via the real
// `writeHealthSample`, the same way T-12's "synthetic adapter" precedent stood in for
// a second real estate during portability testing. This proves the GATE mechanism
// end to end against real modules, a real git estate and a real health-store
// directory — it does NOT prove the sampler is wired into production statusLine,
// which remains a separate, not-yet-done step.
// ---------------------------------------------------------------------------

test('LIVE ACCEPTANCE: bank recommends Sonnet, nothing observed yet -> blocked; sample written -> MATCH via runHook', () => {
  const e = makeEstate({ programme: 'BUILD-ACCEPT' });
  const healthDir = freshHealthDir();
  const sessionId = 'sess-acceptance-' + Date.now();
  try {
    // (a) Bank a real programme state recommending Sonnet with a named resumption ticket.
    const doc = JSON.parse(readFileSync(e.statePath, 'utf8'));
    doc.model_recommendation.model = 'Sonnet';
    doc.resumption.ticket = 'T-02';
    writeFileSync(e.statePath, JSON.stringify(doc, null, 2) + '\n');
    execFileSync('git', ['-C', e.root, 'add', '.']);
    execFileSync('git', ['-C', e.root, 'commit', '-q', '--amend', '--no-edit']);

    // (b) Fresh SessionStart(source="clear"), no health sample recorded yet (Auto/nothing
    // observed). Drive the real runHook with modelGate options pointed at the isolated
    // health directory, exactly as runHook's own destructuring (opts.modelGate) supports.
    const payload = JSON.stringify({ source: 'clear', cwd: e.root, session_id: sessionId });
    const blocked = runHook(payload, { modelGate: { healthOpts: { envOverride: healthDir } } });

    assert.notEqual(blocked.implementationPermitted, true, 'nothing has been observed yet — must not permit implementation');
    assert.match(blocked.context, /Recommended model: Sonnet/);
    assert.match(blocked.context, /Current model: (AUTO|UNKNOWN)/);
    // A blocked gate must genuinely withhold the next-action detail, not just stack a
    // banner on top of it — renderCompactGate's blocked path never includes the
    // ">>> THE EXACT NEXT ACTION <<<" heading or the resumption text that the ORIGINAL
    // oriented brief carries.
    assert.ok(!blocked.context.includes('THE EXACT NEXT ACTION'), 'a blocked gate must not leak the next-action detail');
    assert.ok(!blocked.context.includes('Dispatch T-02'), 'a blocked gate must not leak the underlying next-action text');

    // (c) Write a real health sample for that EXACT session_id via the real writeHealthSample.
    writeHealthSample(sessionId, {
      session_id: sessionId,
      sampled_at: new Date().toISOString(),
      model: { display_name: 'Sonnet 5', id: 'claude-sonnet-5' },
    }, { envOverride: healthDir });

    // (d) Re-run via the real CLI subprocess — this is what Larry actually runs in
    // production (`node tools/governor/model-gate.mjs check --state <path> --session <id>`).
    const out = execFileSync('node', [MODEL_GATE_SRC, 'check', '--state', e.statePath, '--session', sessionId], {
      encoding: 'utf8',
      env: { ...process.env, MYPKA_GOVERNOR_HEALTH_DIR: healthDir },
    });
    assert.match(out, /Recommended model: Sonnet/);
    assert.match(out, /Current model: Sonnet 5/);
    assert.match(out, /continue — model verified, implementation permitted\./);

    // Confirm the exit code side too, directly (execFileSync above would have thrown on
    // non-zero, but assert it explicitly via the in-process CLI for a precise EXIT_CODE
    // check). runCli reads MYPKA_GOVERNOR_HEALTH_DIR from process.env itself (it does not
    // accept a healthOpts override), so point THIS process at the isolated health dir the
    // same way the subprocess above was pointed at it, then restore it.
    const prevEnv = process.env.MYPKA_GOVERNOR_HEALTH_DIR;
    process.env.MYPKA_GOVERNOR_HEALTH_DIR = healthDir;
    let direct;
    try {
      direct = runCli(['check', '--state', e.statePath, '--session', sessionId]);
    } finally {
      if (prevEnv === undefined) delete process.env.MYPKA_GOVERNOR_HEALTH_DIR;
      else process.env.MYPKA_GOVERNOR_HEALTH_DIR = prevEnv;
    }
    assert.equal(direct.exitCode, EXIT_CODE[STATUS.MATCH]);
    assert.equal(direct.exitCode, 0);
    assert.equal(direct.gate.status, STATUS.MATCH);
  } finally {
    e.cleanup();
    rmSync(healthDir, { recursive: true, force: true });
  }
});
