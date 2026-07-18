import { test } from 'node:test';
import assert from 'node:assert/strict';

import { composeReviewBriefing, MAX_BRIEFING_CHARS } from '../src/reviewVoice.js';

const HEAD = '80d04108abcdef0123456789abcdef0123456789';

function checkpoint(overrides = {}) {
  return {
    checkpoint_id: 'BUILD-010-ACCEPT-0001', build_id: 'BUILD-010', wp_id: 'WP1',
    branch: 'build-010/wp1', head_sha: HEAD, ...overrides,
  };
}

test('(a) contains the plain-English verdict - CORRECTIONS_REQUIRED reads "sent it back for fixes"', () => {
  const msg = composeReviewBriefing({
    checkpoint: checkpoint(),
    codexResult: {
      status: 'ok', verdict: 'request_changes', summary: 'core is there but a gap remains',
      claims_verified: [{ claim: 'retry uses real backoff', status: 'confirmed', evidence: 'watcher.js:1' }],
      findings: [{ id: 'F1', severity: 'medium', evidence: 'x:1', rationale: 'no test', required_correction: 'Add a test for the timeout path' }],
    },
    derived: { verdict: 'CORRECTIONS_REQUIRED', material_findings: ['[medium] F1: Add a test for the timeout path'], next_action: 'Apply the named corrections, push a new head, and re-hand off the new checkpoint.' },
    reviewedHead: HEAD,
  });
  assert.match(msg, /My verdict:/);
  assert.ok(msg.includes('sent it back for fixes'), 'plain-English CORRECTIONS_REQUIRED wording present');
});

test('(b) includes a real finding rendered readably (not a bare severity code)', () => {
  const msg = composeReviewBriefing({
    checkpoint: checkpoint(),
    codexResult: {
      status: 'ok', verdict: 'request_changes', summary: 's',
      claims_verified: [],
      findings: [{ id: 'F1', severity: 'high', evidence: 'stop.js:12', rationale: 'silent failure', required_correction: 'Make the Stop button record before it clears on screen' }],
    },
    derived: { verdict: 'CORRECTIONS_REQUIRED', material_findings: [], next_action: 'fix it' },
    reviewedHead: HEAD,
  });
  assert.ok(msg.includes('Make the Stop button record before it clears on screen'), 'the finding correction is rendered in words');
  assert.ok(msg.includes('Important:'), 'severity rendered as a plain word, not a raw code');
  assert.ok(!msg.includes('[high]'), 'no raw severity code leaks into the message');
});

test('(c) includes what-happens-next drawn from next_action', () => {
  const msg = composeReviewBriefing({
    checkpoint: checkpoint(),
    codexResult: { status: 'ok', verdict: 'approve', summary: 's', claims_verified: [], findings: [] },
    derived: { verdict: 'APPROVE', material_findings: [], next_action: 'Proceed to the next WP step / final review.' },
    reviewedHead: HEAD,
  });
  assert.match(msg, /What happens next: Proceed to the next WP step/);
});

test('(d) includes the short reviewed SHA (first 8 chars)', () => {
  const msg = composeReviewBriefing({
    checkpoint: checkpoint(),
    codexResult: { status: 'ok', verdict: 'approve', summary: 's', claims_verified: [], findings: [] },
    derived: { verdict: 'APPROVE', material_findings: [], next_action: 'proceed' },
    reviewedHead: HEAD,
  });
  assert.ok(msg.includes('80d04108'), 'short SHA present');
  assert.ok(!msg.includes(HEAD), 'the full 40-char SHA is not dumped into Telegram');
});

test('(e) stays under ~1200 chars even with maximal input', () => {
  const long = 'x'.repeat(4000);
  const msg = composeReviewBriefing({
    checkpoint: checkpoint(),
    codexResult: {
      status: 'ok', verdict: 'request_changes', summary: long,
      claims_verified: [
        { claim: long, status: 'confirmed', evidence: long },
        { claim: long, status: 'refuted', evidence: long },
        { claim: long, status: 'unverifiable', evidence: long },
        { claim: long, status: 'partial', evidence: long },
      ],
      findings: [
        { id: 'F1', severity: 'critical', evidence: long, rationale: long, required_correction: long },
        { id: 'F2', severity: 'high', evidence: long, rationale: long, required_correction: long },
        { id: 'F3', severity: 'medium', evidence: long, rationale: long, required_correction: long },
        { id: 'F4', severity: 'low', evidence: long, rationale: long, required_correction: long },
      ],
    },
    derived: { verdict: 'CORRECTIONS_REQUIRED', material_findings: [], next_action: long },
    reviewedHead: HEAD,
  });
  assert.ok(msg.length <= MAX_BRIEFING_CHARS, `message length ${msg.length} must be <= ${MAX_BRIEFING_CHARS}`);
});

test('(e2) maximal input NEVER severs the verdict or the next-action line (F1)', () => {
  // The real bug: with a large summary + many long findings + long claims, the old
  // code truncated the whole assembled string from the END, dropping exactly the
  // two mandatory lines. Reserve a DISTINCTIVE, in-budget next_action so we can
  // assert it survives verbatim (not just that the message is short).
  const hugeSummary = 'S'.repeat(4000);
  const bigCorrection = 'F'.repeat(600);
  const NEXT = 'Apply the named corrections, push a new head, and re-hand off the new checkpoint.';
  const msg = composeReviewBriefing({
    checkpoint: checkpoint(),
    codexResult: {
      status: 'ok', verdict: 'request_changes', summary: hugeSummary,
      claims_verified: [
        { claim: 'A'.repeat(500), status: 'confirmed', evidence: 'A'.repeat(500) },
        { claim: 'B'.repeat(500), status: 'refuted', evidence: 'B'.repeat(500) },
        { claim: 'C'.repeat(500), status: 'partial', evidence: 'C'.repeat(500) },
        { claim: 'D'.repeat(500), status: 'unverifiable', evidence: 'D'.repeat(500) },
      ],
      findings: [
        { id: 'F1', severity: 'critical', evidence: 'e', rationale: 'r', required_correction: bigCorrection },
        { id: 'F2', severity: 'high', evidence: 'e', rationale: 'r', required_correction: bigCorrection },
        { id: 'F3', severity: 'medium', evidence: 'e', rationale: 'r', required_correction: bigCorrection },
        { id: 'F4', severity: 'low', evidence: 'e', rationale: 'r', required_correction: bigCorrection },
      ],
    },
    derived: { verdict: 'CORRECTIONS_REQUIRED', material_findings: [], next_action: NEXT },
    reviewedHead: HEAD,
  });
  // (a) the plain-English verdict still present
  assert.match(msg, /My verdict:/);
  assert.ok(msg.includes('sent it back for fixes'), 'the plain-English verdict survives maximal input');
  // (b) the mandatory next-action line still present, in full
  assert.ok(msg.includes(`What happens next: ${NEXT}`), 'the next-action line survives maximal input verbatim');
  // (c) still under the Telegram ceiling
  assert.ok(msg.length <= MAX_BRIEFING_CHARS, `message length ${msg.length} must be <= ${MAX_BRIEFING_CHARS}`);
});

test('(f) reads [CODEX], not [TOWER]', () => {
  const msg = composeReviewBriefing({
    checkpoint: checkpoint(),
    codexResult: { status: 'ok', verdict: 'approve', summary: 's', claims_verified: [], findings: [] },
    derived: { verdict: 'APPROVE', material_findings: [], next_action: 'proceed' },
    reviewedHead: HEAD,
  });
  assert.ok(msg.startsWith('[CODEX]'), 'briefing leads with the CODEX label');
  assert.ok(!msg.includes('[TOWER]'), 'review outcomes do not read as TOWER machine status');
});

test('(g) APPROVE with no findings reads cleanly - no dangling findings section', () => {
  const msg = composeReviewBriefing({
    checkpoint: checkpoint(),
    codexResult: { status: 'ok', verdict: 'approve', summary: 'claims match the diff', claims_verified: [], findings: [] },
    derived: { verdict: 'APPROVE', material_findings: [], next_action: 'Proceed to the next WP step / final review.' },
    reviewedHead: HEAD,
  });
  assert.ok(msg.includes('signed it off'), 'plain-English APPROVE wording present');
  assert.ok(!msg.includes('What needs doing'), 'no empty "what needs doing" header');
  assert.ok(!msg.includes('Worth noting:'), 'no empty "worth noting" header when there are zero findings');
  assert.ok(!msg.includes('What I checked out:'), 'no empty claims header when there are zero claims');
  assert.match(msg, /What happens next:/);
});

test('BLOCKED (pre-Codex gate) renders the blockers under "in the way" and reads cleanly', () => {
  const msg = composeReviewBriefing({
    checkpoint: checkpoint(),
    codexResult: null,
    derived: {
      verdict: 'BLOCKED',
      material_findings: ['[gate] fail-closed: brief_ref could not be resolved (C:/no/such/brief.md)'],
      next_action: 'Resolve the fail-closed gate(s) above, then re-hand off. Do not proceed unsupervised.',
    },
    reviewedHead: HEAD,
  });
  assert.ok(msg.startsWith('[CODEX]'), 'blocked briefing still leads with CODEX');
  assert.ok(msg.includes("couldn't complete it"), 'plain-English BLOCKED wording present');
  assert.ok(msg.includes("What's in the way:"), 'blockers get a dedicated section');
  assert.ok(msg.includes('brief_ref could not be resolved'), 'the blocker reason is shown plainly');
  assert.ok(!msg.includes('[gate]'), 'the raw gate tag is stripped for reading');
});

test('DECISION_REQUIRED reads "needs your call"', () => {
  const msg = composeReviewBriefing({
    checkpoint: checkpoint(),
    codexResult: {
      status: 'ok', verdict: 'request_changes', summary: 'security-sensitive change',
      claims_verified: [{ claim: 'no live systems touched', status: 'confirmed', evidence: 'diff' }],
      findings: [{ id: 'S1', severity: 'critical', evidence: 'auth.js:4', rationale: 'auth bypass', required_correction: 'Close the bypass before this goes anywhere near live' }],
    },
    derived: { verdict: 'DECISION_REQUIRED', material_findings: ['[critical] S1: Close the bypass'], next_action: 'Material issue (critical / security / scope) -- escalate to Warwick for a decision before proceeding.' },
    reviewedHead: HEAD,
  });
  assert.ok(msg.includes('needs your call'), 'plain-English DECISION_REQUIRED wording present');
  assert.ok(msg.includes('Close the bypass before this goes anywhere near live'), 'the material finding is rendered');
});

test('output is pure ASCII even when upstream material carries non-ASCII glyphs (PowerShell 5.1 / scheduled-task safe)', () => {
  // Build the non-ASCII inputs at RUNTIME (this source file stays pure ASCII):
  // em dash, rightwards arrow, curly quotes, ellipsis -- exactly the shapes the real
  // deriveVerdict next_action and Codex output can contain.
  const EM = String.fromCharCode(0x2014);
  const ARROW = String.fromCharCode(0x2192);
  const RSQUO = String.fromCharCode(0x2019);
  const ELLIPSIS = String.fromCharCode(0x2026);
  const msg = composeReviewBriefing({
    checkpoint: checkpoint(),
    codexResult: {
      status: 'ok', verdict: 'request_changes', summary: `core there${EM}gap remains${ELLIPSIS}`,
      claims_verified: [{ claim: `Larry${RSQUO}s retry uses real backoff`, status: 'partial', evidence: 'x' }],
      findings: [{ id: 'F1', severity: 'low', evidence: 'y', rationale: 'z', required_correction: `tidy the log line ${ARROW} one field` }],
    },
    derived: { verdict: 'CORRECTIONS_REQUIRED', material_findings: [], next_action: `push a new head ${EM} re-hand off` },
    reviewedHead: HEAD,
  });
  // eslint-disable-next-line no-control-regex
  assert.ok(/^[\x00-\x7F]*$/.test(msg), 'every character is ASCII');
  assert.ok(msg.includes('push a new head -- re-hand off'), 'em dash normalised to --');
  assert.ok(msg.includes('one field'), 'arrow normalised, text preserved');
});
