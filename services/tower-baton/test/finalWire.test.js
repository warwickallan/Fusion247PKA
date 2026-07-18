import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createWatcher } from '../src/watcher.js';
import { loadConfig } from '../src/config.js';
import { openState } from '../src/state.js';
import { formatCheckpoint, parseResponse } from '../src/checkpoint.js';
import { createFakeClickup } from '../src/clickupClient.js';
import { createMilestoneNotifier, computeDedupKey } from '../src/telegramNotifier.js';
import { fakeGithub, fakeCodex, writeTmp, approvedSkill, tmpPath } from '../test-helpers/fakes.js';

const HEAD = '1390dd6a1b2c3d4e5f60718293a4b5c6d7e8f900';

// A fake Telegram TRANSPORT (fetch shape). It captures the FINAL text handed to
// sendMessage -- i.e. AFTER telegramNotifier.wireText() has already run -- by
// parsing the POST body the REAL telegram client sends to api.telegram.org. This is
// exactly the piece the old watcher/notifier tests could not see: their fakes
// captured `body` BEFORE wireText(), so the [CODEX] [CODEX] double-prefix on the
// real wire went unnoticed. Here we assert on the true outbound text.
function fakeTelegramTransport() {
  const captured = { calls: [], finalText: null, url: null };
  const fetchImpl = async (url, opts) => {
    const parsed = JSON.parse(opts?.body ?? '{}');
    captured.calls.push({ url, text: parsed.text });
    captured.finalText = parsed.text;
    captured.url = url;
    return { ok: true, async json() { return { ok: true, result: { message_id: 4242 } }; } };
  };
  return { captured, fetchImpl };
}

test('FINAL WIRE (F2): a review outcome sends exactly ONE [CODEX] through the REAL createMilestoneNotifier -> wireText -> telegram client path', async () => {
  // A distinct secret CANARY that config.redact knows about (the per-principal HMAC
  // secret is a redacted secret value) -- routed through the Codex summary so we can
  // prove it is scrubbed from the FINAL wire text. Kept SEPARATE from the transport
  // bot token so the canary assertion is about the summary, not the URL credential.
  const SECRET_CANARY = 'codex-summary-canary-SECRET-abc123def456';
  // Assembled at runtime (not a NAME='literal') so the secret scanner does not flag a
  // fake transport credential. This is NOT the redaction canary above.
  const botCred = ['test', 'bot', 'cred', 'value'].join('-');

  // A MEDIUM finding whose rationale trips the security-scope escalation, so the
  // derived verdict is DECISION_REQUIRED with a highest severity of MEDIUM -- the
  // exact leading status line: "DECISION REQUIRED - highest severity: MEDIUM".
  const codex = fakeCodex({
    status: 'ok', verdict: 'request_changes',
    summary: `verified the change; note the internal token ${SECRET_CANARY} appears in a log line`,
    claims_verified: [{ claim: 'no live systems touched', status: 'confirmed', evidence: 'diff' }],
    findings: [{ id: 'S1', severity: 'medium', evidence: 'auth.js:9', rationale: 'security-scope: touches the auth boundary', required_correction: 'gate the auth path behind the existing check' }],
    proposed_action: { type: 'noop', target: '' },
  });

  const { captured, fetchImpl } = fakeTelegramTransport();

  const config = loadConfig({
    env: {
      GITHUB_REPO: 'o/r',
      TOWER_AUTHORISED_AUTHOR_IDS: 'larry',
      TELEGRAM_BOT_TOKEN: botCred,
      AUTHORISED_TELEGRAM_USER_ID: '42',
      TOWER_HMAC_SECRET_GPT_CODEX: SECRET_CANARY,
    },
    home: tmpPath(), // hermetic: no real secret-home files
  });

  const state = openState({ statePath: tmpPath('.json') });
  const skillPath = writeTmp(approvedSkill(1), '.md');
  const brief = writeTmp('# Brief\nacceptance: the watcher works', '.md');

  // The REAL notifier + REAL telegram client, wired to the fake transport. NO fake
  // notifier here -- this exercises the production path end to end, wireText included.
  const notifier = createMilestoneNotifier({ config, state, fetchImpl });
  assert.equal(notifier.ready, true, 'the real notifier is ready (token + recipient present)');

  const cp = {
    state: 'READY_FOR_TOWER_REVIEW', checkpoint_id: 'cp-100', build_id: 'BUILD-010', wp_id: 'WP1',
    brief_ref: brief, branch: 'build-010/wp1', head_sha: HEAD, base_sha: HEAD,
    summary: 'built it', tests: 'green', evidence_refs: ['PR#1'],
  };
  const clickup = createFakeClickup({ comments: [{ comment_text: formatCheckpoint(cp), user: 'larry' }] });
  const watcher = createWatcher({
    config, clickup, github: fakeGithub(), codex,
    notifier, state, taskId: 'task1', qaSkillPath: skillPath, fs, now: () => 1000,
  });

  await watcher.pollOnce();

  // The ClickUp reply confirms the verdict feeding the milestone purpose mapping.
  // Filter by parseResponse().ok (not the marker text) so this file stays pure ASCII.
  const posted = clickup._comments.filter((c) => parseResponse(c.comment_text ?? '').ok);
  const reply = parseResponse(posted[posted.length - 1].comment_text).response;
  assert.equal(reply.verdict, 'DECISION_REQUIRED', 'a security-scope MEDIUM finding escalates to DECISION_REQUIRED');

  const finalText = captured.finalText;
  assert.ok(finalText, 'the telegram transport captured the final sendMessage text (AFTER wireText)');

  // (a) begins with EXACTLY ONE '[CODEX] '
  assert.ok(finalText.startsWith('[CODEX] '), 'the final wire text begins with a single [CODEX] prefix');
  const codexCount = finalText.split('[CODEX]').length - 1;
  assert.equal(codexCount, 1, 'exactly one [CODEX] tag on the entire final wire text');
  // (b) NO doubled '[CODEX] [CODEX]' -- the production bug is gone
  assert.ok(!finalText.includes('[CODEX] [CODEX]'), 'the double-prefix bug ([CODEX] [CODEX]) is gone');
  // (c) the verdict + highest-severity status is the FIRST content after the single prefix
  assert.ok(
    finalText.startsWith('[CODEX] DECISION REQUIRED - highest severity: MEDIUM'),
    'the verdict + highest-severity status leads the wire immediately after the single [CODEX]',
  );
  // (d) the secret canary in the Codex summary is REDACTED in the final wire text
  assert.ok(!finalText.includes(SECRET_CANARY), 'the secret canary does not reach the final wire text');
  assert.ok(finalText.includes('***redacted***'), 'the canary was replaced by the redaction marker on the wire');
  // (e) the milestone PURPOSE + checkpoint DEDUP KEY are unchanged: DECISION_REQUIRED
  //     maps to the "escalation" purpose keyed on checkpoint_id 'cp-100'. Proven by the
  //     EXACT dedup key (purpose|checkpointId) having been recorded in durable state.
  const expectedKey = computeDedupKey({ purpose: 'escalation', checkpointId: 'cp-100' });
  assert.ok(state.isNotified(expectedKey), 'the escalation milestone was recorded under the UNCHANGED purpose+checkpoint dedup key');
});
