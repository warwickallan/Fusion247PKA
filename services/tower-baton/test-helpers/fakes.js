// Shared test fakes — NO live calls, NO network, NO real ClickUp/Codex/Telegram.
// Lives OUTSIDE test/ so the node test runner does not treat it as a test file.

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';

/** A unique temp path under the OS tmpdir (auto-cleaned by the OS; tests may unlink). */
export function tmpPath(suffix = '') {
  return path.join(os.tmpdir(), `tower-baton-test-${randomUUID()}${suffix}`);
}

/** Write a temp file and return its path. */
export function writeTmp(content, suffix = '') {
  const p = tmpPath(suffix);
  fs.writeFileSync(p, content, 'utf8');
  return p;
}

/** An approved QA skill fixture (minimal, valid frontmatter). */
export function approvedSkill(version = 1) {
  return `---\nstatus: approved\nversion: ${version}\n---\n# Tower QA skill (test fixture)\nRead-only. Fail-closed.`;
}

/** A GitHub evidence fake — returns a resolvable head + diff by default. */
export function fakeGithub(overrides = {}) {
  return {
    async collect(args) {
      return {
        ok: true,
        headSha: args.headSha,
        resolved: true,
        branchHeadSha: args.headSha,
        headMatchesBranch: true,
        diffRange: `${args.baseSha ?? args.headSha + '^'}..${args.headSha}`,
        changedFiles: ['services/tower-baton/src/watcher.js'],
        checks: [{ name: 'ci', status: 'completed', conclusion: 'success' }],
        checksError: null,
        error: null,
        ...overrides,
      };
    },
  };
}

/** A Codex adapter fake — returns a structured verdict you specify. */
export function fakeCodex(structuredResult = null) {
  const result = structuredResult ?? {
    status: 'ok', verdict: 'approve', summary: 'looks good; claims match the diff',
    claims_verified: [], findings: [], proposed_action: { type: 'noop', target: '' },
  };
  const calls = [];
  return {
    calls,
    async runTurn(args) {
      calls.push(args);
      return { ok: result.status !== 'blocked', blocked: result.status === 'blocked', structuredResult: result, envelope: { agent: 'gpt_codex', provider: 'openai-codex' }, signature: null };
    },
  };
}

/** A milestone-notifier fake — records notifyMilestone calls; dedups like the real one. */
export function fakeNotifier() {
  const calls = [];
  const seen = new Set();
  return {
    calls,
    ready: true,
    async notifyMilestone(spec) {
      calls.push(spec);
      const key = `${spec.purpose}|${spec.checkpointId ?? ''}|${spec.extra ?? ''}`;
      if (seen.has(key)) return { sent: false, deduped: true };
      seen.add(key);
      return { sent: true };
    },
  };
}

/**
 * A fake spawn (child_process shape) that captures the argv/env it was given and
 * emits a fixed stdout then closes with `code`. Used to assert the Codex child env.
 */
export function fakeSpawn({ captured = {}, stdout = '', code = 0 } = {}) {
  return (bin, argv, opts) => {
    captured.bin = bin; captured.argv = argv; captured.env = opts?.env;
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { write() {}, end() {} };
    child.kill = () => {};
    setImmediate(() => {
      if (stdout) child.stdout.emit('data', Buffer.from(stdout));
      child.emit('close', code);
    });
    return child;
  };
}

/** A no-op fs fake sufficient for codexAdapter's schema write/unlink. */
export function fakeFsForSchema() {
  return { writeFileSync() {}, unlinkSync() {}, existsSync() { return true; }, statSync() { return { isFile: () => true, mtimeMs: 1 }; }, readFileSync() { return '{}'; }, readdirSync() { return []; } };
}

/** Build one JSONL stdout line carrying a Codex structured result. */
export function codexJsonl(result) {
  return JSON.stringify({ type: 'item.completed', item: { text: JSON.stringify(result) } }) + '\n';
}

/**
 * Build a claude `--output-format json` stdout object whose `.result` is the model's final
 * message (the reviewer JSON, optionally wrapped in prose to prove extraction). Mirrors the
 * real claude 2.1.214 result shape.
 */
export function fableCliJson(result, { wrap = false } = {}) {
  const inner = JSON.stringify(result);
  const message = wrap ? `Here is my review:\n\n${inner}\n\nThat is my verdict.` : inner;
  return JSON.stringify({
    type: 'result', subtype: 'success', is_error: false,
    result: message, stop_reason: 'end_turn',
    usage: { output_tokens: 42 }, modelUsage: { 'claude-fable-5': { outputTokens: 42 } },
  });
}

/** A Fable adapter fake -- returns a structured verdict you specify, signed as claude_fable. */
export function fakeFable(structuredResult = null) {
  const result = structuredResult ?? {
    status: 'ok', verdict: 'approve', summary: 'cold-final: nothing missed; the change stands up',
    claims_verified: [], findings: [], proposed_action: { type: 'noop', target: '' },
  };
  const calls = [];
  return {
    calls,
    principal: 'claude_fable',
    async runTurn(args) {
      calls.push(args);
      return { ok: result.status !== 'blocked', blocked: result.status === 'blocked', signerPrincipal: 'claude_fable', structuredResult: result, envelope: { agent: 'claude_fable', provider: 'anthropic' }, signature: null };
    },
  };
}
