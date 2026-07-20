// BUILD-014 Tower supervisor loop — REAL Codex product-supervisor call.
//
// Codex acts as GPT's stand-in product supervisor. It is handed the ACTIVE supervisor
// prompt + the reconstructed-turn text (staged by Tower — Codex reads the disk/DB for
// nothing), and must return STRICT supervisor JSON conforming to SUPERVISOR_SCHEMA.
//
// This is a LEAN reuse of the robust, proven helpers exported by ../review/codexAdapter.mjs
// (resolveCodexBin, detectCodexAuth, CODEX_EXEC_FLAGS, sanitizeCodexEnv, parseCodexJsonl).
// We do NOT re-implement discovery/auth/parsing — we compose them for the supervisor turn.
//
// SEPARATION OF SECRETS (hard rule): the Codex child receives NO Supabase/DB/Telegram
// credentials. sanitizeCodexEnv strips the denylist (DATABASE_URL, TELEGRAM_BOT_TOKEN, …),
// and we additionally strip CONTROL_PLANE_DEV_DATABASE_URL, which is this build's DB URL.
//
// FAIL-CLOSED: no binary / no auth / timeout / non-zero exit / malformed output each
// return { ok:false, blocked:true, result:{...blocker } } — never a hang, never a fake verdict.

import { spawn as nodeSpawn } from 'node:child_process';
import fsDefault from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  resolveCodexBin,
  detectCodexAuth,
  CODEX_EXEC_FLAGS,
  sanitizeCodexEnv,
  parseCodexJsonl,
} from '../review/codexAdapter.mjs';

// STRICT output schema handed to `codex exec --output-schema` (every property required,
// no additional properties) — the exact supervisor contract Warwick specified.
export const SUPERVISOR_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: [
    'aligned', 'over_engineering', 'drifting', 'administering',
    'next_action', 'warwick_needed', 'verdict', 'summary',
  ],
  properties: {
    aligned: { type: 'boolean' },
    over_engineering: { type: 'boolean' },
    drifting: { type: 'boolean' },
    administering: { type: 'boolean' },
    next_action: { type: 'string' },
    warwick_needed: { type: 'boolean' },
    verdict: { type: 'string', enum: ['continue', 'correct', 'block', 'ask_warwick'] },
    summary: { type: 'string' },
  },
});

const VERDICTS = ['continue', 'correct', 'block', 'ask_warwick'];

// The supervisor's DB URL env var — this build's only DB secret. It is not in the
// review adapter's denylist (that predates this build), so strip it explicitly.
const SUPERVISOR_ENV_DENYLIST = Object.freeze(['CONTROL_PLANE_DEV_DATABASE_URL']);

function stripSupervisorSecrets(env) {
  const clean = { ...env };
  for (const name of SUPERVISOR_ENV_DENYLIST) delete clean[name];
  return clean;
}

/** Fail-closed structural validation of the supervisor result. */
export function validateSupervisorResult(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object') return { ok: false, errors: ['result is not an object'] };
  for (const b of ['aligned', 'over_engineering', 'drifting', 'administering', 'warwick_needed']) {
    if (typeof obj[b] !== 'boolean') errors.push(`${b} must be a boolean`);
  }
  if (!VERDICTS.includes(obj.verdict)) errors.push(`verdict must be one of ${VERDICTS.join('|')}`);
  if (typeof obj.next_action !== 'string' || obj.next_action.length === 0) errors.push('next_action must be a non-empty string');
  if (typeof obj.summary !== 'string' || obj.summary.length === 0) errors.push('summary must be a non-empty string');
  return { ok: errors.length === 0, errors };
}

function blocked(kind, blocker) {
  return {
    ok: false,
    blocked: true,
    result: {
      status: 'blocked',
      kind,
      blocker,
      // Fail-safe verdict: a Tower that cannot get a real supervisor read must pull Warwick
      // in rather than silently continue.
      aligned: null,
      over_engineering: null,
      drifting: null,
      administering: null,
      next_action: `Supervisor unavailable (${kind}): ${blocker}`,
      warwick_needed: true,
      verdict: 'ask_warwick',
      summary: `Codex supervisor could not run (${kind}); escalating to Warwick.`,
    },
  };
}

function buildSupervisorPrompt({ supervisorPromptText, reconstructedTurnText }) {
  return [
    String(supervisorPromptText ?? '').trim(),
    '',
    '── THIS TURN — reconstructed from durable storage (judge only this text) ──',
    String(reconstructedTurnText ?? '').trim(),
    '',
    'Return ONLY the strict supervisor JSON conforming to the provided output schema.',
    'No prose, no markdown, no code fences.',
  ].join('\n');
}

function runCodexChild({ codexBin, argv, cwd, spawn, timeoutMs, apiKey, prompt, env }) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let done = false;
    const finish = (r) => { if (!done) { done = true; resolve(r); } };
    let child;
    const childEnv = apiKey ? { ...env, CODEX_API_KEY: apiKey, OPENAI_API_KEY: apiKey } : env;
    try {
      child = spawn(codexBin, argv, { cwd, shell: false, env: childEnv });
    } catch (e) {
      return finish({ ok: false, code: -1, stderr: String(e?.message ?? e), stdout: '' });
    }
    const timer = setTimeout(() => {
      // Best-effort tree reap on Windows so codex.exe children cannot orphan.
      if (process.platform === 'win32' && child?.pid != null) {
        try { spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { shell: false, stdio: 'ignore' }); } catch { /* ignore */ }
      }
      try { child?.kill?.('SIGKILL'); } catch { /* ignore */ }
      finish({ ok: false, code: -2, stderr: `supervisor turn timed out after ${timeoutMs}ms`, stdout });
    }, timeoutMs);
    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (e) => { clearTimeout(timer); finish({ ok: false, code: -1, stderr: String(e?.message ?? e), stdout }); });
    child.on('close', (code) => { clearTimeout(timer); finish({ ok: code === 0, code, stdout, stderr }); });
    try { child.stdin?.write(prompt); child.stdin?.end(); } catch { /* ignore */ }
  });
}

/**
 * Run ONE real Codex supervisor turn over a reconstructed turn.
 *
 * @param {object} args
 * @param {string} args.supervisorPromptText  the ACTIVE prompt content (loaded from tower.supervisor_prompt)
 * @param {string} args.reconstructedTurnText the turn re-read from the DB and staged
 * @returns {Promise<{ok:boolean, blocked:boolean, result:object, modelId?:string, rawStdout?:string}>}
 */
export async function runSupervisor({
  supervisorPromptText,
  reconstructedTurnText,
  cwd = process.cwd(),
  spawn = nodeSpawn,
  fs = fsDefault,
  timeoutMs = 8 * 60 * 1000,
} = {}) {
  const auth = detectCodexAuth({});
  if (!auth.authenticated) {
    return blocked('no_credential', 'no codex credential — neither CODEX_API_KEY/OPENAI_API_KEY nor ChatGPT-OAuth auth.json present (do NOT auto-provision)');
  }
  const bin = resolveCodexBin({});
  if (!bin.path) {
    return blocked('no_binary', `no codex binary — ${bin.error ?? 'not resolvable'} (do NOT auto-install)`);
  }

  const schemaFile = path.join(os.tmpdir(), `tower-supervisor-schema-${randomUUID()}.json`);
  try {
    fs.writeFileSync(schemaFile, JSON.stringify(SUPERVISOR_SCHEMA), 'utf8');
  } catch (e) {
    return blocked('schema_write_failed', `could not stage output schema — ${String(e?.message ?? e)}`);
  }

  try {
    // CODEX_EXEC_FLAGS already carries: exec --sandbox read-only --skip-git-repo-check
    // --ignore-user-config --json. We add the supervisor output schema, the workdir, and
    // `-` for stdin. The child env is DOUBLE-sanitised: the review denylist + this build's
    // DB url. On the OAuth route no api key rides the env; on api-key auth it is re-added.
    const argv = [...CODEX_EXEC_FLAGS, '--output-schema', schemaFile, '-C', cwd, '-'];
    const apiKey = auth.method === 'api-key' ? (process.env.CODEX_API_KEY || process.env.OPENAI_API_KEY || null) : null;
    const env = stripSupervisorSecrets(sanitizeCodexEnv(process.env, null));
    const prompt = buildSupervisorPrompt({ supervisorPromptText, reconstructedTurnText });

    const spawned = await runCodexChild({ codexBin: bin.path, argv, cwd, spawn, timeoutMs, apiKey, prompt, env });
    if (spawned.code === -2) return blocked('timed_out', spawned.stderr);
    if (!spawned.ok) return blocked('exec_failed', `codex exec failed (exit ${spawned.code}): ${String(spawned.stderr ?? '').slice(0, 400)}`.trim());

    const parsed = parseCodexJsonl(spawned.stdout);
    const validation = validateSupervisorResult(parsed.result);
    if (!validation.ok) {
      return blocked('malformed_output', `codex returned non-conforming supervisor output: ${validation.errors.join('; ')}`);
    }

    const r = parsed.result;
    return {
      ok: true,
      blocked: false,
      modelId: 'openai-codex-exec',
      result: {
        status: 'ok',
        aligned: r.aligned,
        over_engineering: r.over_engineering,
        drifting: r.drifting,
        administering: r.administering,
        next_action: r.next_action,
        warwick_needed: r.warwick_needed,
        verdict: r.verdict,
        summary: r.summary,
      },
      rawStdout: spawned.stdout,
    };
  } finally {
    try { fs.unlinkSync(schemaFile); } catch { /* best-effort */ }
  }
}
