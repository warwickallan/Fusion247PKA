import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import {
  VERDICT,
  EXIT_CODE,
  GIT_LIFECYCLE_OPERATIONS,
  ESCAPE_HATCH_REASONS,
  DECISION,
  classifyEscalation,
  detectGitLifecycleOperations,
  detectEscapeHatchReason,
  describeEscalationFromToolInput,
  evaluateEscalationGate,
  runEscalationGateHook,
  toHookOutput,
} from './escalation-gate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_PATH = join(__dirname, 'escalation-gate.mjs');

// ---------------------------------------------------------------------------
// Export shape sanity
// ---------------------------------------------------------------------------

describe('exported constants (AC1, AC2, AC5)', () => {
  test('VERDICT has exactly REFUSED/ALLOWED/UNCLASSIFIABLE, each with a distinct EXIT_CODE', () => {
    assert.deepEqual(Object.keys(VERDICT).sort(), ['ALLOWED', 'REFUSED', 'UNCLASSIFIABLE']);
    const codes = Object.values(EXIT_CODE);
    assert.equal(new Set(codes).size, codes.length, 'exit codes must be pairwise distinct');
    assert.equal(EXIT_CODE[VERDICT.UNCLASSIFIABLE] === EXIT_CODE[VERDICT.ALLOWED], false);
  });

  test('GIT_LIFECYCLE_OPERATIONS is the AC2-mandated vocabulary, frozen', () => {
    for (const required of [
      'push-force',
      'force-with-lease',
      'amend-pushed',
      'rebase',
      'reset-hard',
      'filter-branch',
      'filter-repo',
    ]) {
      assert.ok(GIT_LIFECYCLE_OPERATIONS.includes(required), `missing required signal: ${required}`);
    }
    assert.ok(Object.isFrozen(GIT_LIFECYCLE_OPERATIONS));
  });

  test('ESCAPE_HATCH_REASONS is a closed, frozen enum containing unsafe-repository-state', () => {
    assert.deepEqual([...ESCAPE_HATCH_REASONS], ['unsafe-repository-state']);
    assert.ok(Object.isFrozen(ESCAPE_HATCH_REASONS));
  });
});

// ---------------------------------------------------------------------------
// classifyEscalation — the pure mechanical core
// ---------------------------------------------------------------------------

describe('classifyEscalation — REFUSED on each vocabulary operation', () => {
  for (const op of GIT_LIFECYCLE_OPERATIONS) {
    test(`"${op}" alone -> REFUSED`, () => {
      const result = classifyEscalation({ proposedOperations: [op] });
      assert.equal(result.verdict, VERDICT.REFUSED);
      assert.equal(result.exitCode, EXIT_CODE[VERDICT.REFUSED]);
      assert.deepEqual(result.matchedOperations, [op]);
      assert.equal(result.escapeHatchUsed, null);
    });
  }

  test('multiple operations at once -> REFUSED, all matched operations reported', () => {
    const result = classifyEscalation({ proposedOperations: ['push-force', 'amend-pushed', 'rebase'] });
    assert.equal(result.verdict, VERDICT.REFUSED);
    assert.deepEqual([...result.matchedOperations].sort(), ['amend-pushed', 'push-force', 'rebase']);
  });

  test('unrecognised operation strings are ignored, never cause REFUSED on their own', () => {
    const result = classifyEscalation({ proposedOperations: ['delete-the-universe', 'not-a-real-op'] });
    assert.equal(result.verdict, VERDICT.ALLOWED);
    assert.deepEqual(result.matchedOperations, []);
  });

  test('a mix of unrecognised and recognised operations only counts the recognised ones', () => {
    const result = classifyEscalation({ proposedOperations: ['bogus', 'reset-hard'] });
    assert.equal(result.verdict, VERDICT.REFUSED);
    assert.deepEqual(result.matchedOperations, ['reset-hard']);
  });
});

describe('classifyEscalation — ALLOWED (a confident, checked "nothing here")', () => {
  test('explicitly empty proposedOperations array -> ALLOWED, not UNCLASSIFIABLE', () => {
    const result = classifyEscalation({ proposedOperations: [] });
    assert.equal(result.verdict, VERDICT.ALLOWED);
    assert.equal(result.exitCode, EXIT_CODE[VERDICT.ALLOWED]);
  });
});

describe('classifyEscalation — UNCLASSIFIABLE (absence is unknown, never zero — evaluator.mjs precedent)', () => {
  test('missing proposedOperations field entirely -> UNCLASSIFIABLE, never ALLOWED-by-assumption', () => {
    const result = classifyEscalation({});
    assert.equal(result.verdict, VERDICT.UNCLASSIFIABLE);
    assert.equal(result.exitCode, EXIT_CODE[VERDICT.UNCLASSIFIABLE]);
  });

  test('proposedOperations not an array (a string) -> UNCLASSIFIABLE', () => {
    const result = classifyEscalation({ proposedOperations: 'push-force' });
    assert.equal(result.verdict, VERDICT.UNCLASSIFIABLE);
  });

  test('proposedOperations null -> UNCLASSIFIABLE', () => {
    const result = classifyEscalation({ proposedOperations: null });
    assert.equal(result.verdict, VERDICT.UNCLASSIFIABLE);
  });

  test('describedEscalation itself is null -> UNCLASSIFIABLE, never throws', () => {
    assert.doesNotThrow(() => classifyEscalation(null));
    assert.equal(classifyEscalation(null).verdict, VERDICT.UNCLASSIFIABLE);
  });

  test('describedEscalation is undefined -> UNCLASSIFIABLE, never throws', () => {
    assert.doesNotThrow(() => classifyEscalation(undefined));
    assert.equal(classifyEscalation(undefined).verdict, VERDICT.UNCLASSIFIABLE);
  });

  test('describedEscalation is a primitive (number) -> UNCLASSIFIABLE, never throws', () => {
    assert.doesNotThrow(() => classifyEscalation(42));
    assert.equal(classifyEscalation(42).verdict, VERDICT.UNCLASSIFIABLE);
  });

  test('describedEscalation is an array -> UNCLASSIFIABLE (arrays are objects but not usable here)', () => {
    const result = classifyEscalation(['push-force']);
    assert.equal(result.verdict, VERDICT.UNCLASSIFIABLE);
  });
});

describe('classifyEscalation — the escape hatch (AC5) is a CLOSED enum, checked by exact equality', () => {
  test('valid reason clears a matched operation to ALLOWED, and the use is RECORDED (not silent)', () => {
    const result = classifyEscalation({
      proposedOperations: ['push-force'],
      escapeHatchReason: 'unsafe-repository-state',
    });
    assert.equal(result.verdict, VERDICT.ALLOWED);
    assert.equal(result.escapeHatchUsed, 'unsafe-repository-state');
    assert.deepEqual(result.matchedOperations, ['push-force'], 'the matched operation stays visible even when excused');
  });

  test('MUTATION: an arbitrary, unrecognised free-text reason does NOT clear the refusal', () => {
    const result = classifyEscalation({
      proposedOperations: ['push-force'],
      escapeHatchReason: 'because-i-said-so',
    });
    assert.equal(result.verdict, VERDICT.REFUSED, 'the enum must be genuinely closed, not merely documented as closed');
    assert.equal(result.escapeHatchUsed, null);
  });

  test('MUTATION: an empty-string reason does NOT clear the refusal', () => {
    const result = classifyEscalation({ proposedOperations: ['rebase'], escapeHatchReason: '' });
    assert.equal(result.verdict, VERDICT.REFUSED);
  });

  test('escape hatch present but no operations matched is a harmless no-op, not recorded as used', () => {
    const result = classifyEscalation({ proposedOperations: [], escapeHatchReason: 'unsafe-repository-state' });
    assert.equal(result.verdict, VERDICT.ALLOWED);
    assert.equal(result.escapeHatchUsed, null, 'nothing was excused because nothing needed excusing');
  });
});

// ---------------------------------------------------------------------------
// AC3 — D-4 itself, both as structured input and via the text-detection path.
// Neither test constructs, reads, or references any "is cosmetic" field
// anywhere — the refusal must stand on AD-20 (the matched operations) alone.
// ---------------------------------------------------------------------------

describe('AC3 — the D-4 scenario classifies REFUSED, with NO "is cosmetic" input anywhere', () => {
  test('structured: D-4\'s actual remedy (amend + force-push already-pushed history) -> REFUSED', () => {
    // No field named cosmetic/isCosmetic/defectKind or similar exists anywhere
    // in this object — the point of the test.
    const describedEscalation = {
      proposedOperations: ['amend-pushed', 'push-force'],
    };
    const result = classifyEscalation(describedEscalation);
    assert.equal(result.verdict, VERDICT.REFUSED);
    assert.match(result.reason, /AD-20/);
    assert.match(result.reason, /regardless of whether the underlying defect is cosmetic/);
  });

  test('text-extraction: the literal D-4 wording is detected and classifies REFUSED end-to-end', () => {
    const toolInput = {
      questions: [
        {
          question: 'The write-back commit landed and pushed correctly, but its subject line has a stray "@". Fix it?',
          header: 'Commit message typo',
          options: [
            {
              label: 'Amend and force-push',
              description: 'Amend the commit message and force-push the already-pushed history to correct the subject line.',
            },
            { label: 'Leave it', description: 'Leave the pushed commit exactly as it is.' },
          ],
        },
      ],
    };
    const described = describeEscalationFromToolInput(toolInput);
    assert.ok(described.proposedOperations.includes('push-force'), 'force-push must be detected from the option text');
    assert.ok(described.proposedOperations.includes('amend-pushed'), 'amend-pushed must be detected given the co-occurring force-push/already-pushed language');
    assert.equal(described.escapeHatchReason, null);

    const classified = classifyEscalation(described);
    assert.equal(classified.verdict, VERDICT.REFUSED);

    const gateResult = evaluateEscalationGate({ toolName: 'AskUserQuestion', toolInput });
    assert.equal(gateResult.decision, DECISION.DENY);
    assert.match(gateResult.reason, /AD-20/);
  });
});

// ---------------------------------------------------------------------------
// AC4 — positive control: a genuinely warranted escalation is NEVER refused.
// ---------------------------------------------------------------------------

describe('AC4 — positive control: genuinely warranted escalations are never refused', () => {
  const warrantedCases = [
    {
      name: 'a merge decision',
      toolInput: {
        questions: [
          {
            question: 'BUILD-018 has passed merge-readiness. Merge build-018/session-governor into main?',
            header: 'Merge decision',
            options: [
              { label: 'Merge now', description: 'Merge the reviewed branch into main.' },
              { label: 'Hold', description: 'Do not merge yet.' },
            ],
          },
        ],
      },
    },
    {
      name: 'a spend decision',
      toolInput: {
        questions: [
          {
            question: 'Upgrading the Hetzner box to the next tier costs an extra $40/month. Proceed?',
            header: 'Spend approval',
            options: [
              { label: 'Yes, upgrade', description: 'Approve the recurring spend.' },
              { label: 'No', description: 'Stay on the current tier.' },
            ],
          },
        ],
      },
    },
    {
      name: 'an irreversible live action',
      toolInput: {
        questions: [
          {
            question: 'This will permanently delete the production Supabase project. Proceed?',
            header: 'Irreversible live action',
            options: [
              { label: 'Delete it', description: 'Permanently delete the live project. This cannot be undone.' },
              { label: 'Cancel', description: 'Do nothing.' },
            ],
          },
        ],
      },
    },
  ];

  for (const { name, toolInput } of warrantedCases) {
    test(`${name} -> never REFUSED (no git-lifecycle vocabulary present)`, () => {
      const described = describeEscalationFromToolInput(toolInput);
      assert.deepEqual(described.proposedOperations, [], `false positive detected in: ${name}`);
      const result = evaluateEscalationGate({ toolName: 'AskUserQuestion', toolInput });
      assert.notEqual(result.decision, DECISION.DENY);
    });
  }

  test('a described escalation with an explicit empty operations list (a caller confident nothing git-shaped is offered) is ALLOWED', () => {
    const result = classifyEscalation({ proposedOperations: [] });
    assert.equal(result.verdict, VERDICT.ALLOWED);
  });
});

// ---------------------------------------------------------------------------
// detectGitLifecycleOperations — the heuristic layer, tested on its own
// ---------------------------------------------------------------------------

describe('detectGitLifecycleOperations — heuristic text layer', () => {
  test('bare "amend" with no push/pushed context never fires amend-pushed (routine, harmless)', () => {
    const ops = detectGitLifecycleOperations('Let me amend this commit message before I commit.');
    assert.ok(!ops.includes('amend-pushed'), 'a bare, unpushed amend must never be treated as a lifecycle escalation');
  });

  test('"amend" plus "already pushed" fires amend-pushed even without the word force', () => {
    const ops = detectGitLifecycleOperations('I will amend the message on the already-pushed commit and re-push it.');
    assert.ok(ops.includes('amend-pushed'));
  });

  test('force-push phrased as "force push" (two words) is detected', () => {
    const ops = detectGitLifecycleOperations('I can force push the corrected history.');
    assert.ok(ops.includes('push-force'));
  });

  test('--force-with-lease is detected as its own distinct operation', () => {
    const ops = detectGitLifecycleOperations('git push --force-with-lease origin build-018/session-governor');
    assert.ok(ops.includes('force-with-lease'));
  });

  test('"roll back the deploy" does not false-positive as reset-hard or rebase', () => {
    const ops = detectGitLifecycleOperations('Should I roll back the production deploy?');
    assert.deepEqual(ops, []);
  });

  test('"force a customer refund" does not false-positive as push-force (no push nearby)', () => {
    const ops = detectGitLifecycleOperations('This will force a customer refund to be issued.');
    assert.deepEqual(ops, []);
  });

  test('non-string / empty input never throws, returns empty', () => {
    assert.doesNotThrow(() => detectGitLifecycleOperations(undefined));
    assert.deepEqual(detectGitLifecycleOperations(undefined), []);
    assert.deepEqual(detectGitLifecycleOperations(''), []);
    assert.deepEqual(detectGitLifecycleOperations(null), []);
  });
});

describe('detectEscapeHatchReason — literal marker only, never sentiment', () => {
  test('the exact marker is recognised', () => {
    assert.equal(detectEscapeHatchReason('Found a secret in pushed history. [AD-26:unsafe-repository-state]'), 'unsafe-repository-state');
  });

  test('describing an unsafe state in ordinary prose WITHOUT the marker is not recognised (mechanical, not sentiment)', () => {
    assert.equal(
      detectEscapeHatchReason('There is a secret committed to already-pushed history, which is an unsafe repository state.'),
      null
    );
  });

  test('non-string input never throws', () => {
    assert.doesNotThrow(() => detectEscapeHatchReason(undefined));
    assert.equal(detectEscapeHatchReason(undefined), null);
  });
});

// ---------------------------------------------------------------------------
// evaluateEscalationGate / runEscalationGateHook — the impure PreToolUse wrapper
// ---------------------------------------------------------------------------

describe('evaluateEscalationGate — tool scoping', () => {
  test('a non-AskUserQuestion tool always DEFERs, regardless of tool_input content', () => {
    const result = evaluateEscalationGate({
      toolName: 'Bash',
      toolInput: { command: 'git push --force' },
    });
    assert.equal(result.decision, DECISION.DEFER);
  });

  test('missing tool_name DEFERs rather than throwing', () => {
    assert.doesNotThrow(() => evaluateEscalationGate({}));
    assert.equal(evaluateEscalationGate({}).decision, DECISION.DEFER);
  });
});

describe('AC4 — MUTATION: fail-open proven in every direction', () => {
  test('describeEscalationFromToolInput throwing -> ALLOW, never DENY, never propagates', () => {
    const hostileToolInput = new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === 'questions') throw new Error('injected extraction failure');
          return undefined;
        },
      }
    );
    // Prove the injected failure is real before trusting the wrapper's catch.
    assert.throws(() => describeEscalationFromToolInput(hostileToolInput));

    const result = evaluateEscalationGate({ toolName: 'AskUserQuestion', toolInput: hostileToolInput });
    assert.equal(result.decision, DECISION.ALLOW);
  });

  test('MUTATION (dangerous direction): classify() itself throwing -> ALLOW, never DENY, on a call that WOULD have been REFUSED', () => {
    // classifyEscalation is proven total over its documented domain by the
    // tests above, so it cannot be made to throw through realistic input —
    // exactly status-line.mjs's situation with evaluate(). Inject a stand-in
    // that throws to prove evaluateEscalationGate's own try/catch holds, on
    // a call that — had the real classifier run — would have matched
    // 'push-force' and produced REFUSED. This is the dangerous direction:
    // fail-open must hold even when the failure hides a genuine match.
    const throwingClassify = () => {
      throw new Error('injected classifier failure');
    };
    const toolInput = {
      questions: [{ question: 'Fix the pushed commit?', options: [{ label: 'force push the amended commit' }] }],
    };
    // Confirm this toolInput really would have matched, using the real classifier.
    const realDescribed = describeEscalationFromToolInput(toolInput);
    assert.ok(classifyEscalation(realDescribed).verdict === VERDICT.REFUSED, 'test setup: this input must be a genuine would-be REFUSED case');

    const result = evaluateEscalationGate({ toolName: 'AskUserQuestion', toolInput, classify: throwingClassify });
    assert.equal(result.decision, DECISION.ALLOW);
  });

  test('MUTATION: describe() itself throwing (injected) -> ALLOW, never DENY', () => {
    const throwingDescribe = () => {
      throw new Error('injected describe failure');
    };
    const result = evaluateEscalationGate({
      toolName: 'AskUserQuestion',
      toolInput: {},
      describe: throwingDescribe,
    });
    assert.equal(result.decision, DECISION.ALLOW);
  });

  test('runEscalationGateHook: malformed JSON stdin -> ALLOW, never throws', () => {
    assert.doesNotThrow(() => runEscalationGateHook('{not valid json'));
    const result = runEscalationGateHook('{not valid json');
    assert.equal(result.decision, DECISION.ALLOW);
  });

  test('runEscalationGateHook: empty stdin -> ALLOW', () => {
    const result = runEscalationGateHook('');
    assert.equal(result.decision, DECISION.ALLOW);
  });

  test('runEscalationGateHook: valid JSON but not an object (an array) -> ALLOW', () => {
    const result = runEscalationGateHook('[1,2,3]');
    assert.equal(result.decision, DECISION.ALLOW);
  });

  test('runEscalationGateHook: a would-be-REFUSED payload, end to end, still DENY (not a fail-open false negative)', () => {
    const raw = JSON.stringify({
      tool_name: 'AskUserQuestion',
      tool_input: {
        questions: [
          { question: 'Fix the pushed commit?', options: [{ label: 'force push the amended commit' }] },
        ],
      },
    });
    const result = runEscalationGateHook(raw);
    assert.equal(result.decision, DECISION.DENY);
  });
});

describe('toHookOutput', () => {
  test('DENY produces the expected hookSpecificOutput shape', () => {
    const out = toHookOutput({ decision: DECISION.DENY, reason: 'because' });
    assert.deepEqual(out, {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: 'because',
      },
    });
  });

  test('ALLOW produces null (no hook output at all)', () => {
    assert.equal(toHookOutput({ decision: DECISION.ALLOW }), null);
  });

  test('DEFER produces null', () => {
    assert.equal(toHookOutput({ decision: DECISION.DEFER }), null);
  });

  test('a nullish or malformed result produces null rather than throwing', () => {
    assert.doesNotThrow(() => toHookOutput(null));
    assert.equal(toHookOutput(null), null);
    assert.equal(toHookOutput(undefined), null);
  });
});

// ---------------------------------------------------------------------------
// CLI — a real subprocess, not an in-process call (T-15's own precedent for
// proving a hook module is genuinely "usable from a PreToolUse hook", AC1).
// Not wired into install-hooks.mjs (out of scope) — this proves the CLI
// entrypoint itself works as a real child process reading real stdin.
// ---------------------------------------------------------------------------

describe('CLI (real subprocess) — node escalation-gate.mjs check', () => {
  test('a REFUSED-shaped payload over real stdin -> exit 0 (fail-open at process level), deny JSON on stdout', () => {
    const payload = JSON.stringify({
      tool_name: 'AskUserQuestion',
      tool_input: {
        questions: [{ question: 'Fix the pushed commit?', options: [{ label: 'force push the amended commit' }] }],
      },
    });
    const proc = spawnSync(process.execPath, [SRC_PATH, 'check'], { input: payload, encoding: 'utf8' });
    assert.equal(proc.status, 0, 'a PreToolUse hook must always exit 0, even when it denies');
    const out = JSON.parse(proc.stdout);
    assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
    assert.match(out.hookSpecificOutput.permissionDecisionReason, /AD-20/);
  });

  test('an ALLOWED-shaped payload over real stdin -> exit 0, no stdout output at all', () => {
    const payload = JSON.stringify({
      tool_name: 'AskUserQuestion',
      tool_input: { questions: [{ question: 'Merge to main?', options: [{ label: 'Merge now' }] }] },
    });
    const proc = spawnSync(process.execPath, [SRC_PATH, 'check'], { input: payload, encoding: 'utf8' });
    assert.equal(proc.status, 0);
    assert.equal(proc.stdout, '');
  });

  test('malformed stdin over a real subprocess -> exit 0, no crash, no output', () => {
    const proc = spawnSync(process.execPath, [SRC_PATH, 'check'], { input: 'not json at all', encoding: 'utf8' });
    assert.equal(proc.status, 0);
    assert.equal(proc.stdout, '');
    assert.equal(proc.stderr, '');
  });

  test('an unrecognised subcommand exits non-zero with usage on stderr (a CLI usage error, not a hook failure)', () => {
    const proc = spawnSync(process.execPath, [SRC_PATH, 'bogus-subcommand'], { encoding: 'utf8' });
    assert.equal(proc.status, 1);
    assert.match(proc.stderr, /usage:/);
  });
});

// ---------------------------------------------------------------------------
// Structural purity check — this module must never touch the filesystem or
// shell out to git (unlike worktree-guard.mjs/delegation-gate.mjs, it never
// needs to: everything it decides comes from its caller-supplied input).
// Mirrors T-16's own "the module never invokes a destructive git or
// filesystem operation" source-scan test.
// ---------------------------------------------------------------------------

test('structural: escalation-gate.mjs never imports fs/child_process (genuinely pure end-to-end except CLI stdin)', () => {
  const source = readFileSync(SRC_PATH, 'utf8');
  assert.ok(!/from ['"]node:fs['"]/.test(source), 'must not import node:fs');
  assert.ok(!/from ['"]node:child_process['"]/.test(source), 'must not import node:child_process');
  assert.ok(!/execFileSync|execSync|spawnSync/.test(source), 'must not shell out');
});

// ---------------------------------------------------------------------------
// AC6 — coverage honesty: the module header must say what this gate does
// NOT cover, in terms, so the evidence doc and this file cannot silently
// drift apart on what is claimed.
// ---------------------------------------------------------------------------

test('AC6: the module header states the narrow scope and the unenforced AD-26 categories honestly', () => {
  const source = readFileSync(SRC_PATH, 'utf8');
  assert.match(source, /IT DOES NOT ENFORCE AD-26 GENERALLY/);
  for (const category of ['typo', 'wording', 'formatting', 'naming', 'ticket boundaries', 'completed workers', 'ordinary routing']) {
    assert.ok(source.toLowerCase().includes(category), `header must name "${category}" as an unenforced AD-26 category`);
  }
  assert.match(source, /UNENFORCED/);
});
