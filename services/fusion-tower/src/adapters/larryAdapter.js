// Fusion Tower — Larry adapter (Claude Code, headless / non-interactive).
//
// Invokes `claude` as a bounded, guard-railed, STRUCTURED single turn and wraps
// the result in an HMAC-signed, honestly-labelled envelope (signer = larry,
// provider = anthropic-claude-code). Per Pax Item 2, the recommended shape is:
//
//   claude -p "<bounded prompt>" --output-format json
//          --permission-mode <acceptEdits|plan|default>
//          --allowedTools "<scoped list, NEVER a merge tool>"
//
// run inside a dedicated git worktree for repo isolation, with a hard turn
// timeout at the dispatcher. If `claude` is not invocable non-interactively (no
// binary, or auth not available for a headless run), the adapter FAILS CLOSED:
// it records the exact blocker and returns a signed structured `blocked` result
// so the run advances to a blocked terminal deterministically — never a hang.
//
// NO MERGE TOOL, EVER. ALLOWED_TOOLS is a fixed read/inspect/edit set; `merge`,
// `gh pr merge`, and any push are excluded by construction and asserted below.

import { spawn as nodeSpawn } from 'node:child_process';
import { makeSignedResult, buildEnvelope } from '../core/envelope.js';

// Scoped allow-list for a governance turn. Read + bounded edit + safe git reads.
// A merge/push tool is NEVER present; the assertion below guarantees it.
export const LARRY_ALLOWED_TOOLS = Object.freeze([
  'Read',
  'Grep',
  'Glob',
  'Edit',
  'Write',
  'Bash(git diff:*)',
  'Bash(git log:*)',
  'Bash(git status:*)',
]);

const FORBIDDEN_TOOL_SUBSTRINGS = ['merge', 'push', 'gh pr merge', 'force'];

function assertNoMergeTool(tools) {
  for (const t of tools) {
    const low = t.toLowerCase();
    for (const bad of FORBIDDEN_TOOL_SUBSTRINGS) {
      if (low.includes(bad)) {
        throw new Error(`larryAdapter: forbidden tool in allow-list ("${t}") — no merge/push tool is ever permitted`);
      }
    }
  }
  return true;
}

// Build a bounded prompt from the run scope + this turn's context. Deliberately
// short and pointer-shaped — never governed content.
export function buildLarryPrompt({ run, boundedContext }) {
  const scope = run?.scope ?? run?.title ?? 'governance task';
  const task = boundedContext?.task ?? boundedContext?.instruction ?? 'Perform the bounded governance task within scope.';
  const lines = [
    'You are Larry running a single BOUNDED governance turn under Fusion Tower.',
    `Scope: ${scope}`,
    `Task: ${task}`,
    'Constraints: stay strictly within scope; NEVER merge, push, or take any destructive action.',
    'Return ONLY a compact JSON object: {"summary": string, "proposed_action": {"type": "post_comment|post_review|set_task_status|noop", ...}, "confidence": number}.',
  ];
  return lines.join('\n');
}

/**
 * Probe whether `claude` is invocable headless on this machine. Resolves
 * { invocable, version, error } — never throws.
 */
export async function verifyClaudeInvocable({ claudeBin = 'claude', spawn = nodeSpawn, timeoutMs = 15000 } = {}) {
  return new Promise((resolve) => {
    let out = '';
    let err = '';
    let done = false;
    const finish = (r) => { if (!done) { done = true; resolve(r); } };
    let child;
    try {
      // shell:false — never hand any command line to cmd.exe (F-HIGH-01). The
      // `claude` entrypoint on this host is a native executable resolved via
      // PATH/PATHEXT by libuv; no shell is required to invoke it.
      child = spawn(claudeBin, ['--version'], { shell: false });
    } catch (e) {
      return finish({ invocable: false, version: null, error: String(e?.message ?? e) });
    }
    const timer = setTimeout(() => { try { child.kill(); } catch { /* ignore */ } finish({ invocable: false, version: null, error: 'version probe timed out' }); }, timeoutMs);
    child.stdout?.on('data', (d) => { out += d.toString(); });
    child.stderr?.on('data', (d) => { err += d.toString(); });
    child.on('error', (e) => { clearTimeout(timer); finish({ invocable: false, version: null, error: String(e?.message ?? e) }); });
    child.on('close', (code) => {
      clearTimeout(timer);
      const version = (out.trim() || err.trim()) || null;
      finish({ invocable: code === 0, version, error: code === 0 ? null : `exit ${code}: ${err.trim()}` });
    });
  });
}

/**
 * Create the Larry adapter.
 *
 * @param {object} args
 * @param {object} args.config          loadConfig() result (for the signing secret)
 * @param {string} [args.claudeBin]     path/name of the claude binary
 * @param {string} [args.cwd]           worktree/repo dir the turn runs in (isolation)
 * @param {'auto'|'live'|'record-blocker'} [args.mode]  force live spawn or blocker
 * @param {function} [args.spawn]       injectable spawn (tests pass a fake)
 * @param {number} [args.timeoutMs]     hard turn timeout (default 10 min)
 */
export function createLarryAdapter({
  config,
  claudeBin = 'claude',
  cwd = process.cwd(),
  mode = 'auto',
  spawn = nodeSpawn,
  timeoutMs = 10 * 60 * 1000,
} = {}) {
  assertNoMergeTool(LARRY_ALLOWED_TOOLS);
  const PRINCIPAL = 'larry';
  const secret = config?.signingSecret ? config.signingSecret(PRINCIPAL) : null;

  function sign(payload, { run, turn }) {
    const args = {
      principal: PRINCIPAL,
      modelId: 'claude-code-headless',
      runId: run?.run_id ?? null,
      ordinal: turn?.ordinal ?? null,
      sourceEventId: turn?.bounded_context_ref?.source_event_id ?? null,
      headSha: run?.evidence_commit_sha ?? null,
      payload,
    };
    if (secret) {
      const { envelope, signature } = makeSignedResult(args, secret);
      return { envelope, signature };
    }
    // No secret configured (fixtures) — build the honest envelope, unsigned.
    return { envelope: buildEnvelope(args), signature: null };
  }

  function blockerResult({ run, turn }, blocker) {
    const payload = { status: 'blocked', blocker, proposed_action: { type: 'noop' } };
    const { envelope, signature } = sign(payload, { run, turn });
    return { ok: false, blocked: true, signerPrincipal: PRINCIPAL, structuredResult: payload, envelope, signature, error: blocker };
  }

  return {
    principal: PRINCIPAL,
    allowedTools: [...LARRY_ALLOWED_TOOLS],

    async verifyInvocable() {
      return verifyClaudeInvocable({ claudeBin, spawn });
    },

    /**
     * Run one bounded turn. Returns a result the dispatcher records:
     *   live:    { ok:true, signerPrincipal, structuredResult, envelope, signature, tokensUsed }
     *   blocked: { ok:false, blocked:true, ... signed blocked envelope }
     */
    async runTurn({ run, turn, boundedContext }) {
      if (mode === 'record-blocker') {
        return blockerResult({ run, turn }, 'larry adapter forced to record-blocker mode');
      }

      const prompt = buildLarryPrompt({ run, boundedContext });
      const invocation = await verifyClaudeInvocable({ claudeBin, spawn });
      if (!invocation.invocable) {
        return blockerResult({ run, turn },
          `claude not invocable headless: ${invocation.error ?? 'unknown'}`);
      }

      // F-HIGH-01: the prompt is UNTRUSTED-INFLUENCED (run.scope / boundedContext.task
      // can carry event-derived text in a future WP). It is delivered on STDIN, never
      // on argv. `argv` is a fixed, fully-trusted constant set of flags — nothing here
      // is derived from run/turn/event input — so even under any shell there is no
      // metacharacter breakout surface. We spawn with shell:false regardless.
      const argv = [
        '-p', // headless print mode; prompt read from stdin (no prompt arg on argv)
        '--output-format', 'json',
        '--permission-mode', 'plan', // read/plan only for a review turn; no writes
        '--allowedTools', LARRY_ALLOWED_TOOLS.join(','),
      ];

      const spawned = await runClaude({ claudeBin, argv, cwd, spawn, timeoutMs, prompt });
      if (!spawned.ok) {
        return blockerResult({ run, turn },
          `claude headless run failed (exit ${spawned.code}): ${spawned.stderr?.slice(0, 300) ?? ''}`.trim());
      }

      // Parse the claude --output-format json envelope; extract the model result.
      let parsed;
      try { parsed = JSON.parse(spawned.stdout); } catch { parsed = null; }
      const modelText = parsed?.result ?? parsed?.text ?? spawned.stdout;
      const structured = coerceStructured(modelText);
      const tokensUsed = Number(parsed?.usage?.output_tokens ?? parsed?.total_tokens ?? 0) || 0;

      const payload = {
        status: 'ok',
        summary: structured.summary ?? String(modelText).slice(0, 400),
        proposed_action: structured.proposed_action ?? { type: 'noop' },
        confidence: structured.confidence ?? null,
        session_id: parsed?.session_id ?? null,
      };
      const { envelope, signature } = sign(payload, { run, turn });
      return { ok: true, blocked: false, signerPrincipal: PRINCIPAL, structuredResult: payload, envelope, signature, tokensUsed };
    },
  };
}

// Spawn claude, collect stdout/stderr, enforce the hard timeout.
//
// F-HIGH-01 fix: spawn with shell:false (Node never joins argv into a cmd.exe
// command line, so shell metacharacters can never break out), and deliver the
// (untrusted-influenced) prompt on STDIN — mirroring the Codex adapter's stdin
// pattern — so no prompt-derived text is ever an argv element.
function runClaude({ claudeBin, argv, cwd, spawn, timeoutMs, prompt }) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let done = false;
    const finish = (r) => { if (!done) { done = true; resolve(r); } };
    let child;
    try {
      child = spawn(claudeBin, argv, { cwd, shell: false });
    } catch (e) {
      return finish({ ok: false, code: -1, stderr: String(e?.message ?? e), stdout: '' });
    }
    const timer = setTimeout(() => {
      try { child.kill(); } catch { /* ignore */ }
      finish({ ok: false, code: -2, stderr: `turn timed out after ${timeoutMs}ms`, stdout });
    }, timeoutMs);
    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (e) => { clearTimeout(timer); finish({ ok: false, code: -1, stderr: String(e?.message ?? e), stdout }); });
    child.on('close', (code) => { clearTimeout(timer); finish({ ok: code === 0, code, stdout, stderr }); });
    // Prompt on stdin — never on argv. Inert prompt text, never a command.
    try { child.stdin?.write(prompt ?? ''); child.stdin?.end(); } catch { /* ignore */ }
  });
}

// Best-effort: pull a JSON object out of the model text; fall back to a summary.
function coerceStructured(text) {
  if (text && typeof text === 'object') return text;
  const s = String(text ?? '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(s.slice(start, end + 1)); } catch { /* fall through */ }
  }
  return { summary: s.slice(0, 400) };
}
