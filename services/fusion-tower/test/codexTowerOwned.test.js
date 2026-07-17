// Fusion Tower — BUILD-010 WP0 step 4: Tower-OWNED Codex invocation + robustness.
//
// Proves the codex adapter is driven THROUGH the dispatcher (not a bare CLI call),
// that binary resolution survives version updates (newest hashed dir wins; a
// helper-only dir is skipped), that ChatGPT-OAuth auth.json authenticates with no
// API key, and that malformed / timeout / non-zero-exit each fail closed into a
// distinct signed blocker — never a crash. Every codex spawn is a FAKE stub, so no
// live turn and no quota are ever consumed here.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { loadConfig } from '../src/config.js';
import { createMemoryStore } from '../src/store/memoryStore.js';
import { createDispatcher } from '../src/dispatcher.js';
import {
  createCodexAdapter, resolveCodexBin, detectCodexAuth, parseCodexJsonl, validateCodexResult,
} from '../src/adapters/codexAdapter.js';
import { verifyEnvelope } from '../src/core/envelope.js';

// A fake spawn: emits stdout/stderr/exit per invoked argv, or a timeout (never
// closes) when the plan returns { hang: true }.
function fakeSpawn(plan) {
  return function spawn(bin, argv) {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { write() {}, end() {} };
    // Real kill is async — the process dies on a later tick, AFTER the timeout's own
    // finish() has already resolved. Model that so the timeout path wins (code -2).
    child.kill = () => { setImmediate(() => child.emit('close', -9)); };
    let outcome;
    try { outcome = plan(argv, bin); }
    catch (e) { setImmediate(() => child.emit('error', e)); return child; }
    if (outcome.hang) return child; // never emits close → exercises the timeout path
    setImmediate(() => {
      if (outcome.stdout) child.stdout.emit('data', Buffer.from(outcome.stdout));
      if (outcome.stderr) child.stderr.emit('data', Buffer.from(outcome.stderr));
      child.emit('close', outcome.code ?? 0);
    });
    return child;
  };
}

// A fake fs for binary discovery: dirs → whether each contains the codex binary
// + mtime. `binName` is parametrised so the fixture models the ACTUAL layout the
// resolver looks for on each OS ('codex.exe' on Windows, 'codex' elsewhere). The
// fake must be built with the SAME binName the test injects into resolveCodexBin,
// otherwise no candidate would ever match — see the parametrised tests below.
function fakeFsForBins(layout, { localAppData = 'C:/LOCALAPPDATA', binName = 'codex.exe' } = {}) {
  const binDir = `${localAppData}/OpenAI/Codex/bin`;
  return {
    readdirSync(dir) {
      if (dir.replace(/\\/g, '/') === binDir) return Object.keys(layout);
      throw new Error(`ENOENT ${dir}`);
    },
    statSync(p) {
      const norm = p.replace(/\\/g, '/');
      for (const [name, meta] of Object.entries(layout)) {
        if (norm === `${binDir}/${name}/${binName}` && meta.hasCodex) {
          return { isFile: () => true, mtimeMs: meta.mtime };
        }
      }
      throw new Error(`ENOENT ${p}`);
    },
    existsSync() { return true; },
  };
}

// Both OS binary names. Discovery tests run over BOTH so the outcome NEVER depends
// on the CI runner's process.platform (win32→codex.exe, else→codex). Each case
// injects `binName` explicitly into resolveCodexBin AND into the fake fs layout, so
// they are decoupled from the host OS entirely.
const BIN_NAMES = ['codex.exe', 'codex'];
// Escape a binName for use inside a RegExp (the '.' in 'codex.exe' is a metachar).
const rx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const OK_JSONL = JSON.stringify({
  type: 'item.completed',
  item: {
    text: 'Here is the verdict:\n{"verdict":"request_changes","summary":"one medium finding","claims_verified":[{"claim":"RLS deny-by-default","status":"confirmed","evidence":"0001.sql:120"}],"findings":[{"id":"F-1","severity":"medium","evidence":"dispatcher.js:88","rationale":"x","required_correction":"y"}],"proposed_action":{"type":"post_review"}}',
    usage: { output_tokens: 37 },
  },
});

const OAUTH = () => ({ authenticated: true, method: 'chatgpt-oauth', authPath: 'C:/x/.codex/auth.json', keyNames: ['tokens'] });
const BIN_OK = () => ({ path: 'C:/x/codex.exe', source: 'discovery', error: null });
const SECRET = 'c'.repeat(40);

// ── Binary resolution (survive version updates) ──────────────────────────────

for (const binName of BIN_NAMES) {
  test(`resolveCodexBin: picks the NEWEST hashed ${binName} by mtime [${binName}]`, () => {
    const fs = fakeFsForBins({
      aaa11111: { hasCodex: true, mtime: 1000 },
      bbb22222: { hasCodex: true, mtime: 5000 }, // newest
      ccc33333: { hasCodex: true, mtime: 3000 },
    }, { binName });
    const r = resolveCodexBin({ env: {}, fs, localAppData: 'C:/LOCALAPPDATA', binName });
    assert.equal(r.source, 'discovery');
    assert.match(r.path.replace(/\\/g, '/'), new RegExp(`bbb22222/${rx(binName)}$`));
  });

  test(`resolveCodexBin: SKIPS a hashed dir with no ${binName} (helper-only, e.g. rg.exe) [${binName}]`, () => {
    const fs = fakeFsForBins({
      realbin: { hasCodex: true, mtime: 1000 },
      helperonly: { hasCodex: false, mtime: 9999 }, // newest dir but NO codex binary
    }, { binName });
    const r = resolveCodexBin({ env: {}, fs, localAppData: 'C:/LOCALAPPDATA', binName });
    assert.match(r.path.replace(/\\/g, '/'), new RegExp(`realbin/${rx(binName)}$`), 'never picks the helper-only dir');
  });
}

test('resolveCodexBin: CODEX_BIN override wins when it is a file', () => {
  const fs = { existsSync: () => true, statSync: () => ({ isFile: () => true }) };
  const r = resolveCodexBin({ env: { CODEX_BIN: 'D:/custom/codex.exe' }, fs });
  assert.equal(r.source, 'env:CODEX_BIN');
  assert.equal(r.path, 'D:/custom/codex.exe');
});

test('resolveCodexBin: no bin dir → path null + honest error (fail-closed input)', () => {
  const fs = { readdirSync() { throw new Error('ENOENT'); } };
  const r = resolveCodexBin({ env: {}, fs, localAppData: 'C:/LOCALAPPDATA' });
  assert.equal(r.path, null);
  assert.match(r.error, /codex bin dir not found/);
});

// ── Auth detection (existence / key-NAMES only, never a value) ───────────────

test('detectCodexAuth: API key present → api-key method', () => {
  const auth = detectCodexAuth({ config: { codexApiKey: 'sk-x' }, homeDir: 'C:/home', fs: { existsSync: () => false } });
  assert.equal(auth.method, 'api-key');
  assert.equal(auth.authenticated, true);
});

test('detectCodexAuth: no key but auth.json exists → chatgpt-oauth, key NAMES only', () => {
  const fs = {
    existsSync: (p) => p.replace(/\\/g, '/').endsWith('.codex/auth.json'),
    readFileSync: () => JSON.stringify({ tokens: { access_token: 'REDACTED' }, last_refresh: 'x' }),
  };
  const auth = detectCodexAuth({ config: {}, homeDir: 'C:/home', fs });
  assert.equal(auth.method, 'chatgpt-oauth');
  assert.equal(auth.authenticated, true);
  assert.deepEqual(auth.keyNames, ['tokens', 'last_refresh']); // NAMES only — no values leaked
});

test('detectCodexAuth: neither key nor auth.json → not authenticated', () => {
  const auth = detectCodexAuth({ config: {}, homeDir: 'C:/home', fs: { existsSync: () => false } });
  assert.equal(auth.authenticated, false);
  assert.equal(auth.method, 'none');
});

// ── Tower-OWNED invocation THROUGH the dispatcher ────────────────────────────

test('Tower-OWNED: dispatcher drives the codex turn end-to-end (signed, structured, recorded)', async () => {
  const config = loadConfig({ TOWER_HMAC_SECRET_GPT_CODEX: SECRET });
  const store = createMemoryStore();
  let spawnArgv = null;
  const spawn = fakeSpawn((argv) => { spawnArgv = argv; return { stdout: OK_JSONL, code: 0 }; });
  const gpt_codex = createCodexAdapter({ config, spawn, mode: 'auto', authProbe: OAUTH, resolveBin: BIN_OK });
  const dispatcher = createDispatcher({ store, config, adapters: { gpt_codex } });

  const run = await dispatcher.createRun({ title: 'review', scope: 'BUILD-010 review', maxRounds: 1 });
  const d = await dispatcher.dispatchNextTurn(run.run_id, { expectedResponder: 'gpt_codex', boundedContext: { task: 'verify claims', source_event_id: 'gh-1' } });
  const res = await dispatcher.runTurn(d.turn.turn_id);

  // Proven Tower-owned: the dispatcher (not a bare CLI call) invoked the adapter,
  // guardrail-checked the action, and recorded a signed structured return.
  const turn = await store.getTurn(d.turn.turn_id);
  assert.equal(turn.state, 'returned');
  assert.equal(turn.signer_principal, 'gpt_codex');
  assert.equal(res.result.structuredResult.verdict, 'request_changes');
  assert.equal(res.action.type, 'post_review'); // allowed governance action, guardrail-passed
  assert.equal(turn.structured_result.provider, 'openai-codex'); // honest label recorded
  assert.equal(verifyEnvelope(turn.structured_result, turn.result_signature, SECRET), true);
  // The proven exec shape reached the child: read-only, ignore-user-config, schema, stdin.
  assert.ok(spawnArgv.includes('--sandbox') && spawnArgv.includes('read-only'));
  assert.ok(spawnArgv.includes('--ignore-user-config') && spawnArgv.includes('--output-schema'));
  assert.equal(spawnArgv[spawnArgv.length - 1], '-');
});

// ── Robustness: malformed / timeout / non-zero exit → distinct signed blockers ─

test('robustness: MALFORMED output → fail-closed blocker (never a bogus ok)', async () => {
  const config = loadConfig({ TOWER_HMAC_SECRET_GPT_CODEX: SECRET });
  const spawn = fakeSpawn(() => ({ stdout: 'not json at all — no verdict', code: 0 }));
  const adapter = createCodexAdapter({ config, spawn, mode: 'auto', authProbe: OAUTH, resolveBin: BIN_OK });
  const r = await adapter.runTurn({ run: { run_id: 'r' }, turn: { ordinal: 1 } });
  assert.equal(r.blocked, true);
  assert.equal(r.kind, 'malformed_output');
  assert.match(r.structuredResult.blocker, /malformed|non-conforming/);
  assert.equal(verifyEnvelope(r.envelope, r.signature, SECRET), true);
});

test('robustness: TIMEOUT → timed_out blocker (kill + record, no hang)', async () => {
  const config = loadConfig({ TOWER_HMAC_SECRET_GPT_CODEX: SECRET });
  const spawn = fakeSpawn(() => ({ hang: true })); // never closes on its own
  const adapter = createCodexAdapter({ config, spawn, mode: 'auto', authProbe: OAUTH, resolveBin: BIN_OK, timeoutMs: 20 });
  const r = await adapter.runTurn({ run: { run_id: 'r' }, turn: { ordinal: 1 } });
  assert.equal(r.blocked, true);
  assert.equal(r.kind, 'timed_out');
  assert.match(r.structuredResult.blocker, /timed out/);
});

test('robustness: NON-ZERO exit → exec_failed blocker', async () => {
  const config = loadConfig({ TOWER_HMAC_SECRET_GPT_CODEX: SECRET });
  const spawn = fakeSpawn(() => ({ stderr: 'rejected: blocked by policy', code: 13 }));
  const adapter = createCodexAdapter({ config, spawn, mode: 'auto', authProbe: OAUTH, resolveBin: BIN_OK });
  const r = await adapter.runTurn({ run: { run_id: 'r' }, turn: { ordinal: 1 } });
  assert.equal(r.blocked, true);
  assert.equal(r.kind, 'exec_failed');
  assert.match(r.structuredResult.blocker, /exit 13/);
});

// ── Parse + validate units ───────────────────────────────────────────────────

test('parseCodexJsonl: extracts the final agent_message JSON + tallies tokens', () => {
  const parsed = parseCodexJsonl(OK_JSONL);
  assert.equal(parsed.result.verdict, 'request_changes');
  assert.equal(parsed.tokensUsed, 37);
});

test('validateCodexResult: rejects missing verdict / bad action; accepts a conforming result', () => {
  assert.equal(validateCodexResult({ summary: 'x', proposed_action: { type: 'noop' } }).ok, false);
  assert.equal(validateCodexResult({ verdict: 'approve', summary: 'x', proposed_action: { type: 'merge' } }).ok, false);
  assert.equal(validateCodexResult({ verdict: 'approve', summary: 'x', proposed_action: { type: 'noop' } }).ok, true);
});
