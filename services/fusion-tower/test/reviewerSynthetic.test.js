// Fusion Tower — BUILD-010 WP0 step 6a: SYNTHETIC reviewer wiring proof.
//
// Fake GitHub adapter (a governed diff/head-SHA pointer) + fake ClickUp adapter
// (the staged control task) + a fake-codex stub → one gpt_codex REVIEW turn,
// driven through the real dispatcher, produces a schema-conforming signed
// structured result and a guardrail-passed post_review action. ZERO live calls,
// ZERO quota: every external surface here is a fixture. This proves the reviewer
// wiring the live Step-6b turn exercises for real.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { loadConfig } from '../src/config.js';
import { createMemoryStore } from '../src/store/memoryStore.js';
import { createDispatcher } from '../src/dispatcher.js';
import { createCodexAdapter } from '../src/adapters/codexAdapter.js';
import { normalizeGithubEvent, routeResponder } from '../src/adapters/eventIntake.js';
import { verifyEnvelope } from '../src/core/envelope.js';

const SECRET = 'r'.repeat(40);
const OAUTH = () => ({ authenticated: true, method: 'chatgpt-oauth', authPath: 'C:/x/.codex/auth.json', keyNames: ['tokens'] });
const BIN_OK = () => ({ path: 'C:/x/codex.exe', source: 'discovery', error: null });

// Fake ClickUp adapter — governed READ of the control task the Tower stages.
const fakeClickup = {
  async readControlTask() {
    return {
      id: '869e5zu97',
      name: 'WP0 delivery — Fusion Tower control loop (build + prove)',
      status: 'to do',
      url: 'https://app.clickup.com/t/869e5zu97',
      claims: ['RLS deny-by-default on every ftw table', 'no autonomous merge', 'honest gpt_codex=openai-codex'],
    };
  },
};

// Fake GitHub adapter — governed READ returning the head SHA + diff pointer only.
const fakeGithub = {
  async readHead() { return { repo: 'Fusion247/Fusion247PKA', branch: 'build-010/wp0-fusion-tower', head_sha: 'abc123def', diff_ref: 'main...build-010/wp0-fusion-tower' }; },
};

// Fake-codex stub: asserts the Tower passed POINTERS (evidence path + head SHA),
// then returns a schema-conforming review verdict as codex --json JSONL.
function fakeCodexSpawn(promptSink) {
  return function spawn(bin, argv) {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    let prompt = '';
    child.stdin = { write: (d) => { prompt += d; }, end: () => { promptSink.value = prompt; emit(); } };
    child.kill = () => {};
    function emit() {
      const review = {
        verdict: 'request_changes',
        summary: 'Verified 3 claims against the branch; one medium finding.',
        claims_verified: [
          { claim: 'RLS deny-by-default', status: 'confirmed', evidence: 'migrations/0001_wp0_control_plane.sql' },
          { claim: 'no autonomous merge', status: 'confirmed', evidence: 'core/guardrails.js:45' },
          { claim: 'honest gpt_codex=openai-codex', status: 'confirmed', evidence: 'core/envelope.js:20' },
        ],
        findings: [{ id: 'F-SYN-1', severity: 'medium', evidence: 'dispatcher.js:88', rationale: 'x', required_correction: 'y' }],
        proposed_action: { type: 'post_review', target: 'https://app.clickup.com/t/869e5zu97' },
      };
      const jsonl = JSON.stringify({ type: 'item.completed', item: { text: JSON.stringify(review), usage: { output_tokens: 51 } } });
      setImmediate(() => { child.stdout.emit('data', Buffer.from(jsonl)); child.emit('close', 0); });
    }
    return child;
  };
}

test('SYNTHETIC reviewer wiring: fake GitHub + ClickUp + fake-codex → signed structured review (no live calls)', async () => {
  const config = loadConfig({ TOWER_HMAC_SECRET_GPT_CODEX: SECRET });
  const store = createMemoryStore();

  // Governed READS the Tower stages (fixtures — nothing live).
  const control = await fakeClickup.readControlTask();
  const head = await fakeGithub.readHead();

  // A green check on that head routes to a gpt_codex REVIEW turn (design rule).
  const norm = normalizeGithubEvent({ check_suite: { head_sha: head.head_sha, conclusion: 'success', app: { slug: 'ci' } } }, 'gh-delivery-1');
  assert.equal(routeResponder(norm), 'gpt_codex');

  const promptSink = {};
  const gpt_codex = createCodexAdapter({ config, mode: 'auto', authProbe: OAUTH, resolveBin: BIN_OK, spawn: fakeCodexSpawn(promptSink) });
  const dispatcher = createDispatcher({ store, config, adapters: { gpt_codex } });

  const run = await dispatcher.createRun({ title: 'WP0 review', scope: 'BUILD-010 WP0 claims', maxRounds: 1, evidenceCommitSha: head.head_sha });
  // The Tower stages POINTERS (not the corpus): evidence file path + head SHA + claim list.
  const boundedContext = {
    task: `Independently verify the control-task claims for ${control.id} against ${head.diff_ref}`,
    evidence_path: 'C:/tmp/clickup-control-task.md',
    source_event_id: norm.sourceEventId,
    pointers: { repo: head.repo, branch: head.branch, head_sha: head.head_sha, claims: control.claims },
  };
  const d = await dispatcher.dispatchNextTurn(run.run_id, { expectedResponder: 'gpt_codex', boundedContext });
  const res = await dispatcher.runTurn(d.turn.turn_id);

  // Wiring proven: a schema-conforming, signed, honestly-labelled review was recorded.
  const turn = await store.getTurn(d.turn.turn_id);
  assert.equal(turn.state, 'returned');
  assert.equal(res.result.structuredResult.verdict, 'request_changes');
  assert.equal(res.result.structuredResult.claims_verified.length, 3);
  assert.equal(res.action.type, 'post_review'); // allowed governance action (guardrail-passed)
  assert.equal(turn.structured_result.provider, 'openai-codex');
  assert.equal(verifyEnvelope(turn.structured_result, turn.result_signature, SECRET), true);

  // Evidence-pointer doctrine: the Tower passed POINTERS, never the corpus. The
  // prompt names the evidence file + head SHA; it does not paste diffs/file bodies.
  assert.match(promptSink.value, /C:\/tmp\/clickup-control-task\.md/);
  assert.match(promptSink.value, /abc123def/);
  assert.match(promptSink.value, /NOT Larry/); // independent reviewer identity asserted
});
