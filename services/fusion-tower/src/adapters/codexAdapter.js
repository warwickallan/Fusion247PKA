// Fusion Tower — GPT/Codex adapter (OpenAI Codex CLI `codex exec`, spike).
//
// HONEST LABEL: this is OpenAI/Codex — signer = gpt_codex, provider = openai-codex.
// It is NEVER labelled xAI/Grok (envelope.js enforces this on every sign).
//
// Per Pax Item 1, the unattended controller invocation is:
//   CODEX_API_KEY=… codex exec \
//     --sandbox read-only --ask-for-approval never \
//     --output-schema ./decision.schema.json -o ./out.json \
//     --ephemeral --ignore-user-config -        (prompt from stdin)
//
// Two hard prerequisites are Warwick-owned: (a) the `codex` binary installed, and
// (b) an OpenAI API key with a billing budget. When EITHER is missing the adapter
// FAILS CLOSED: it records the exact blocker and returns a signed structured
// `blocked` result — it never installs codex, never spends, never hangs.
//
// Windows caveat (Pax R3): codex loses its native OS sandbox on Windows; we still
// pass --sandbox read-only and rely on process/account isolation. Recorded, not fixed.

import { spawn as nodeSpawn } from 'node:child_process';
import { makeSignedResult, buildEnvelope } from '../core/envelope.js';

// The exact flag set for an unattended read-only review turn (design of record).
export const CODEX_EXEC_FLAGS = Object.freeze([
  'exec',
  '--sandbox', 'read-only',
  '--ask-for-approval', 'never',
  '--ephemeral',
  '--ignore-user-config',
  '--json',
  '-', // prompt from stdin
]);

export function buildCodexPrompt({ run, boundedContext }) {
  const scope = run?.scope ?? run?.title ?? 'governance review';
  const task = boundedContext?.task ?? boundedContext?.instruction ?? 'Review the change within scope and return a structured verdict.';
  return [
    'You are the OpenAI Codex governance reviewer running one BOUNDED, read-only turn under Fusion Tower.',
    `Scope: ${scope}`,
    `Task: ${task}`,
    'Constraints: read-only; NEVER merge, push, or take any action. Return a compact JSON verdict:',
    '{"verdict":"approve|request_changes|comment","summary":string,"proposed_action":{"type":"post_review|post_comment|noop"}}',
  ].join('\n');
}

/**
 * Probe whether `codex` is invocable. Resolves { invocable, version, error }.
 */
export async function verifyCodexInvocable({ codexBin = 'codex', spawn = nodeSpawn, timeoutMs = 15000 } = {}) {
  return new Promise((resolve) => {
    let out = '';
    let err = '';
    let done = false;
    const finish = (r) => { if (!done) { done = true; resolve(r); } };
    let child;
    try {
      child = spawn(codexBin, ['--version'], { shell: process.platform === 'win32' });
    } catch (e) {
      return finish({ invocable: false, version: null, error: String(e?.message ?? e) });
    }
    const timer = setTimeout(() => { try { child.kill(); } catch { /* ignore */ } finish({ invocable: false, version: null, error: 'version probe timed out' }); }, timeoutMs);
    child.stdout?.on('data', (d) => { out += d.toString(); });
    child.stderr?.on('data', (d) => { err += d.toString(); });
    child.on('error', (e) => { clearTimeout(timer); finish({ invocable: false, version: null, error: String(e?.message ?? e) }); });
    child.on('close', (code) => {
      clearTimeout(timer);
      finish({ invocable: code === 0, version: (out.trim() || err.trim()) || null, error: code === 0 ? null : `exit ${code}: ${err.trim()}` });
    });
  });
}

/**
 * Create the Codex adapter.
 *
 * @param {object} args
 * @param {object} args.config       loadConfig() result (codexApiKey + signing secret)
 * @param {string} [args.codexBin]
 * @param {string} [args.cwd]
 * @param {'auto'|'live'|'record-blocker'} [args.mode]
 * @param {function} [args.spawn]
 * @param {number} [args.timeoutMs]
 */
export function createCodexAdapter({
  config,
  codexBin = 'codex',
  cwd = process.cwd(),
  mode = 'auto',
  spawn = nodeSpawn,
  timeoutMs = 10 * 60 * 1000,
} = {}) {
  const PRINCIPAL = 'gpt_codex';
  const secret = config?.signingSecret ? config.signingSecret(PRINCIPAL) : null;

  function sign(payload, { run, turn }) {
    const args = {
      principal: PRINCIPAL,
      provider: 'openai-codex', // honest, explicit — never xAI/Grok
      modelId: 'openai-codex-exec',
      runId: run?.run_id ?? null,
      ordinal: turn?.ordinal ?? null,
      sourceEventId: turn?.bounded_context_ref?.source_event_id ?? null,
      headSha: run?.evidence_commit_sha ?? null,
      payload,
    };
    if (secret) return makeSignedResult(args, secret);
    return { envelope: buildEnvelope(args), signature: null };
  }

  function blockerResult({ run, turn }, blocker) {
    const payload = { status: 'blocked', blocker, proposed_action: { type: 'noop' } };
    const { envelope, signature } = sign(payload, { run, turn });
    return { ok: false, blocked: true, signerPrincipal: PRINCIPAL, structuredResult: payload, envelope, signature, error: blocker };
  }

  return {
    principal: PRINCIPAL,
    execFlags: [...CODEX_EXEC_FLAGS],

    async verifyInvocable() {
      const probe = await verifyCodexInvocable({ codexBin, spawn });
      return { ...probe, hasApiKey: Boolean(config?.codexApiKey) };
    },

    async runTurn({ run, turn, boundedContext }) {
      if (mode === 'record-blocker') {
        return blockerResult({ run, turn }, 'codex adapter forced to record-blocker mode');
      }
      // Prerequisite (b): API key. Fail closed WITHOUT spending / installing.
      if (!config?.codexApiKey) {
        return blockerResult({ run, turn },
          'blocked: no codex credential — CODEX_API_KEY/OPENAI_API_KEY unset (Warwick-owned gate R1)');
      }
      // Prerequisite (a): binary. Fail closed WITHOUT installing.
      const invocation = await verifyCodexInvocable({ codexBin, spawn });
      if (!invocation.invocable) {
        return blockerResult({ run, turn },
          `blocked: no codex binary — ${invocation.error ?? 'codex not on PATH'} (do NOT auto-install)`);
      }

      const prompt = buildCodexPrompt({ run, boundedContext });
      const spawned = await runCodex({ codexBin, argv: CODEX_EXEC_FLAGS, cwd, spawn, timeoutMs, apiKey: config.codexApiKey, prompt });
      if (!spawned.ok) {
        return blockerResult({ run, turn },
          `codex exec failed (exit ${spawned.code}): ${spawned.stderr?.slice(0, 300) ?? ''}`.trim());
      }

      const structured = parseCodexJsonl(spawned.stdout);
      const payload = {
        status: 'ok',
        verdict: structured.verdict ?? 'comment',
        summary: structured.summary ?? String(spawned.stdout).slice(0, 400),
        proposed_action: structured.proposed_action ?? { type: 'noop' },
      };
      const { envelope, signature } = sign(payload, { run, turn });
      return { ok: true, blocked: false, signerPrincipal: PRINCIPAL, structuredResult: payload, envelope, signature, tokensUsed: structured.tokensUsed ?? 0 };
    },
  };
}

function runCodex({ codexBin, argv, cwd, spawn, timeoutMs, apiKey, prompt }) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let done = false;
    const finish = (r) => { if (!done) { done = true; resolve(r); } };
    let child;
    try {
      // API key passed via env only — never on argv (would leak in a process list).
      child = spawn(codexBin, argv, {
        cwd,
        shell: process.platform === 'win32',
        env: { ...process.env, CODEX_API_KEY: apiKey, OPENAI_API_KEY: apiKey },
      });
    } catch (e) {
      return finish({ ok: false, code: -1, stderr: String(e?.message ?? e), stdout: '' });
    }
    const timer = setTimeout(() => { try { child.kill(); } catch { /* ignore */ } finish({ ok: false, code: -2, stderr: `turn timed out after ${timeoutMs}ms`, stdout }); }, timeoutMs);
    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (e) => { clearTimeout(timer); finish({ ok: false, code: -1, stderr: String(e?.message ?? e), stdout }); });
    child.on('close', (code) => { clearTimeout(timer); finish({ ok: code === 0, code, stdout, stderr }); });
    // Prompt from stdin (the `-` arg).
    try { child.stdin?.write(prompt); child.stdin?.end(); } catch { /* ignore */ }
  });
}

// Parse codex `--json` JSONL: find the final agent message / turn.completed.
function parseCodexJsonl(text) {
  const lines = String(text ?? '').split(/\r?\n/).filter(Boolean);
  let final = null;
  let tokensUsed = 0;
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj?.type === 'item.completed' || obj?.type === 'turn.completed' || obj?.item?.text || obj?.text) {
        final = obj.item?.text ?? obj.text ?? final;
      }
      if (obj?.usage?.output_tokens) tokensUsed += Number(obj.usage.output_tokens) || 0;
    } catch { /* skip non-JSON progress lines */ }
  }
  if (final && typeof final === 'string') {
    const start = final.indexOf('{');
    const end = final.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { return { ...JSON.parse(final.slice(start, end + 1)), tokensUsed }; } catch { /* fall */ }
    }
    return { summary: final.slice(0, 400), tokensUsed };
  }
  return { tokensUsed };
}
