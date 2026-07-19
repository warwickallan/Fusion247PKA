// Tower baton — read-only Codex QA adapter (OpenAI Codex CLI `codex exec`).
//
// Copied self-contained from the frozen fusion-tower codexAdapter.js (no import
// from the reactor tree). This is THE QA ENGINE: one bounded, read-only Codex turn
// that inspects the actual implementation on disk and returns a strict, signed,
// HONESTLY-LABELLED structured verdict (signer = gpt_codex, provider = openai-codex,
// NEVER xAI/Grok).
//
// Discovery (unchanged from the proven WP0 spike):
//   · BINARY lives in a VERSION-HASHED dir %LOCALAPPDATA%\OpenAI\Codex\bin\<hash>\
//     codex.exe — we discover the newest, never hard-code the hash.
//   · AUTH is ChatGPT-OAuth via %USERPROFILE%\.codex\auth.json (or CODEX_API_KEY).
//   · We ALWAYS override with --ignore-user-config --sandbox read-only so the host
//     config.toml cannot loosen the sandbox, and the reviewer never adopts a repo
//     "You are Larry" persona.
// FAIL-CLOSED: no binary / no credential / timeout / non-zero exit / malformed
// output each produce a distinct signed `blocked` verdict — never a hang, never spend.

import { spawn as nodeSpawn } from 'node:child_process';
import fsDefault from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { makeSignedVerdict } from './envelope.js';

export const CODEX_EXEC_FLAGS = Object.freeze([
  'exec', '--sandbox', 'read-only', '--skip-git-repo-check', '--ignore-user-config', '--json',
]);

// The QA reviewer result schema handed to `codex --output-schema` (STRICT mode:
// every object closed, every property required).
export const CODEX_RESULT_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'summary', 'claims_verified', 'findings', 'proposed_action'],
  properties: {
    verdict: { type: 'string', enum: ['approve', 'request_changes', 'comment'] },
    summary: { type: 'string' },
    claims_verified: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['claim', 'status', 'evidence'],
        properties: {
          claim: { type: 'string' },
          status: { type: 'string', enum: ['confirmed', 'refuted', 'partial', 'unverifiable'] },
          evidence: { type: 'string' },
        },
      },
    },
    findings: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['id', 'severity', 'evidence', 'rationale', 'required_correction'],
        properties: {
          id: { type: 'string' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] },
          evidence: { type: 'string' },
          rationale: { type: 'string' },
          required_correction: { type: 'string' },
        },
      },
    },
    proposed_action: {
      type: 'object', additionalProperties: false,
      required: ['type', 'target'],
      properties: {
        type: { type: 'string', enum: ['post_review', 'post_comment', 'noop'] },
        target: { type: 'string' },
      },
    },
  },
});

/** Resolve the codex binary WITHOUT hard-coding the version hash. */
export function resolveCodexBin({ env = process.env, fs = fsDefault, localAppData = process.env.LOCALAPPDATA, binName = process.platform === 'win32' ? 'codex.exe' : 'codex' } = {}) {
  const override = env?.CODEX_BIN;
  if (override) {
    try {
      if (fs.existsSync(override) && fs.statSync(override).isFile()) return { path: override, source: 'env:CODEX_BIN', error: null };
      return { path: null, source: 'env:CODEX_BIN', error: `CODEX_BIN set but not a file: ${override}` };
    } catch (e) { return { path: null, source: 'env:CODEX_BIN', error: String(e?.message ?? e) }; }
  }
  if (!localAppData) return { path: null, source: 'discovery', error: 'LOCALAPPDATA unset — cannot discover codex binary' };
  const binDir = path.join(localAppData, 'OpenAI', 'Codex', 'bin');
  let entries;
  try { entries = fs.readdirSync(binDir); } catch (e) { return { path: null, source: 'discovery', error: `codex bin dir not found (${binDir}): ${String(e?.message ?? e)}` }; }
  let best = null;
  for (const name of entries) {
    const candidate = path.join(binDir, name, binName);
    try {
      const st = fs.statSync(candidate);
      if (st.isFile()) { const mtime = st.mtimeMs ?? 0; if (!best || mtime > best.mtime) best = { path: candidate, mtime }; }
    } catch { /* helper-only dir — skip */ }
  }
  if (best) return { path: best.path, source: 'discovery', error: null };
  return { path: null, source: 'discovery', error: `no codex binary under ${binDir}` };
}

/** Detect Codex auth WITHOUT reading any secret value (existence + key NAMES only). */
export function detectCodexAuth({ config, homeDir = os.homedir(), fs = fsDefault } = {}) {
  if (config?.codexApiKey) return { authenticated: true, method: 'api-key', authPath: null, keyNames: null };
  const authPath = path.join(homeDir, '.codex', 'auth.json');
  try {
    if (!fs.existsSync(authPath)) return { authenticated: false, method: 'none', authPath: null, keyNames: null };
    let keyNames = null;
    try { const parsed = JSON.parse(fs.readFileSync(authPath, 'utf8')); if (parsed && typeof parsed === 'object') keyNames = Object.keys(parsed); } catch { /* existence is enough */ }
    return { authenticated: true, method: 'chatgpt-oauth', authPath, keyNames };
  } catch { return { authenticated: false, method: 'none', authPath: null, keyNames: null }; }
}

export function buildCodexArgv({ schemaFile, workdir }) {
  return [...CODEX_EXEC_FLAGS, '--output-schema', schemaFile, '-C', workdir, '-'];
}

// SEPARATION OF RESPONSIBILITY: Codex receives ONLY the QA task + evidence pointers.
// It must NEVER see the Telegram or ClickUp credentials — those belong to the Tower's
// own notifier / ClickUp poster, not the reviewer. This denylist is stripped from the
// child env before the reviewer process is spawned (a leaked TELEGRAM_BOT_TOKEN in the
// reviewer's env is a hard finding). CODEX_API_KEY/OPENAI_API_KEY are re-added ONLY on
// the api-key auth route (never on the OAuth route).
export const CODEX_ENV_DENYLIST = Object.freeze([
  'TELEGRAM_BOT_TOKEN', 'AUTHORISED_TELEGRAM_USER_ID', 'TELEGRAM_WEBHOOK_SECRET',
  'CLICKUP_TOKEN', 'DATABASE_URL', 'SUPABASE_SECRET_KEY',
  'TOWER_HMAC_SECRET_LARRY', 'TOWER_HMAC_SECRET_GPT_CODEX', 'TOWER_HMAC_SECRET_TOWER',
]);

/** Build the Codex child env: parent env MINUS the denylist, plus an optional api key. */
export function sanitizeCodexEnv(parentEnv = process.env, apiKey = null) {
  const env = { ...parentEnv };
  for (const name of CODEX_ENV_DENYLIST) delete env[name];
  if (apiKey) { env.CODEX_API_KEY = apiKey; env.OPENAI_API_KEY = apiKey; }
  return env;
}

/**
 * Compose the QA prompt: the FINGERPRINTED QA skill (operating instructions) verbatim,
 * then the bounded packet POINTERS for THIS checkpoint (exact repo/branch/head, diff
 * range, changed files, evidence pointers). Pointer-shaped — never pastes the corpus.
 */
export function buildCodexPrompt({ skillText, packet = {} }) {
  const p = packet;
  const pointerLines = [
    `checkpoint_id: ${p.checkpoint_id ?? '(none)'}`,
    `build_id: ${p.build_id ?? '(none)'}`,
    `wp_id: ${p.wp_id ?? '(none)'}`,
    `repo: ${p.repo ?? '(local working tree)'}`,
    `branch: ${p.branch ?? '(unknown)'}`,
    `head_sha (EXACT — review is bound to this): ${p.head_sha ?? '(unknown)'}`,
    `base_sha: ${p.base_sha ?? '(unknown)'}`,
    `diff_range: ${p.diff_range ?? '(unknown)'}`,
    p.changed_files?.length ? `changed_files: ${p.changed_files.slice(0, 60).join(', ')}` : 'changed_files: (none reported)',
    `brief_ref (the approved brief — the CLAIMS/acceptance to verify): ${p.brief_ref ?? '(none)'}`,
    p.brief_excerpt ? `brief_excerpt:\n${String(p.brief_excerpt).slice(0, 4000)}` : null,
    `checkpoint summary (Larry's claim): ${p.summary ?? '(none)'}`,
    p.tests ? `tests claimed: ${p.tests}` : null,
    p.evidence_refs?.length ? `evidence_refs: ${p.evidence_refs.join(', ')}` : null,
    p.ci_checks ? `ci_checks: ${p.ci_checks}` : null,
  ].filter(Boolean);

  // STAGED EVIDENCE: on Windows a read-only sandbox blocks Codex's own shell/file reads
  // (git, pwsh Get-Content → "rejected: blocked by policy"), so Tower stages the ACTUAL
  // unified diff here — collected read-only via Tower's allowlisted git. Codex reviews the
  // REAL changes from this payload; it does NOT depend on self-navigating the disk. If the
  // sandbox DOES permit reads, Codex may additionally inspect the tree — but the staged
  // diff is authoritative for what changed at this exact head.
  const diffBlock = p.diff_text
    ? ['', `── STAGED DIFF (${p.diff_range ?? 'head'}${p.diff_truncated ? ', TRUNCATED' : ''}) — the actual changes, read-only from Tower's git ──`, p.diff_text]
    : ['', '── STAGED DIFF: (none captured — if you cannot read the disk, say so honestly and return verdict "comment" with an "unverifiable" claim; do not fabricate) ──'];

  return [
    String(skillText ?? '').trim(),
    '',
    '── THIS REVIEW TURN — bounded packet (pointers + staged diff, not the whole corpus) ──',
    ...pointerLines,
    ...diffBlock,
    '',
    'Review the STAGED DIFF above (the real changes at the exact head) against the approved',
    'brief/acceptance. Your read-only sandbox may block shell/file access — that is expected;',
    'the staged diff is your primary evidence, so do NOT report "blocked" merely because you',
    'could not run git/pwsh yourself. Only return a blocked/"unverifiable" outcome if the diff',
    'itself is absent or insufficient to judge the claim. Compare Larry\'s claims against the',
    'staged changes. Return ONLY JSON conforming to the provided output schema. Keep it',
    'compact — a verdict, per-claim status, and severity-classified findings; not an essay.',
  ].join('\n');
}

export async function verifyCodexInvocable({ codexBin, spawn = nodeSpawn, timeoutMs = 15000, resolve = resolveCodexBin } = {}) {
  const binPath = codexBin ?? resolve().path;
  if (!binPath) return { invocable: false, version: null, error: 'codex binary not resolvable', binPath: null };
  return new Promise((resolveP) => {
    let out = ''; let err = ''; let done = false;
    const finish = (r) => { if (!done) { done = true; resolveP({ ...r, binPath }); } };
    let child;
    try { child = spawn(binPath, ['--version'], { shell: false }); } catch (e) { return finish({ invocable: false, version: null, error: String(e?.message ?? e) }); }
    const timer = setTimeout(() => { try { child.kill(); } catch { /* ignore */ } finish({ invocable: false, version: null, error: 'version probe timed out' }); }, timeoutMs);
    child.stdout?.on('data', (d) => { out += d.toString(); });
    child.stderr?.on('data', (d) => { err += d.toString(); });
    child.on('error', (e) => { clearTimeout(timer); finish({ invocable: false, version: null, error: String(e?.message ?? e) }); });
    child.on('close', (code) => { clearTimeout(timer); finish({ invocable: code === 0, version: (out.trim() || err.trim()) || null, error: code === 0 ? null : `exit ${code}: ${err.trim()}` }); });
  });
}

/**
 * Create the Codex QA adapter. `runTurn({ checkpoint, packet, skillText,
 * promptFingerprint })` runs ONE read-only turn and returns a signed verdict.
 */
// Default codex turn timeout. Tightened from 10min -> 8min (WP1) so the turn's OWN
// tree-kill fires WELL INSIDE the watcher's per-cycle watchdog (default 12min): the
// codex timeout reaps the process tree first; the watchdog is the outer safety net.
export const DEFAULT_CODEX_TIMEOUT_MS = 8 * 60 * 1000;

export function createCodexAdapter({ config, cwd = process.cwd(), mode = 'auto', spawn = nodeSpawn, resolveBin, authProbe, fs = fsDefault, timeoutMs = DEFAULT_CODEX_TIMEOUT_MS, platform = process.platform, log } = {}) {
  const PRINCIPAL = 'gpt_codex';
  const secret = config?.signingSecret ? config.signingSecret(PRINCIPAL) : null;
  const doResolveBin = typeof resolveBin === 'function' ? resolveBin : () => resolveCodexBin({});
  const doAuthProbe = typeof authProbe === 'function' ? authProbe : () => detectCodexAuth({ config, fs });

  function sign(payload, { checkpoint, packet, promptFingerprint }) {
    const args = {
      principal: PRINCIPAL, provider: 'openai-codex', modelId: 'openai-codex-exec',
      checkpointId: checkpoint?.checkpoint_id ?? null,
      reviewedHead: packet?.head_sha ?? checkpoint?.head_sha ?? null,
      promptFingerprint: promptFingerprint ?? null,
      payload,
    };
    return makeSignedVerdict(args, secret);
  }

  function blockerResult(ctx, blocker, kind = 'blocked') {
    const payload = { status: 'blocked', kind, blocker, proposed_action: { type: 'noop', target: '' } };
    const { envelope, signature } = sign(payload, ctx);
    return { ok: false, blocked: true, kind, signerPrincipal: PRINCIPAL, structuredResult: payload, envelope, signature, error: blocker };
  }

  return {
    principal: PRINCIPAL,
    execFlags: [...CODEX_EXEC_FLAGS],

    diagnostics() {
      const bin = doResolveBin(); const auth = doAuthProbe();
      return { principal: PRINCIPAL, provider: 'openai-codex', bin_path: bin.path ?? '(unresolved)', bin_source: bin.source, bin_error: bin.error, auth_method: auth.method, authenticated: auth.authenticated, auth_key_names: auth.keyNames ?? null };
    },

    async verifyInvocable() {
      const bin = doResolveBin();
      const probe = await verifyCodexInvocable({ codexBin: bin.path, spawn });
      const auth = doAuthProbe();
      return { ...probe, binSource: bin.source, authenticated: auth.authenticated, authMethod: auth.method };
    },

    async runTurn({ checkpoint, packet, skillText, promptFingerprint }) {
      const ctx = { checkpoint, packet, promptFingerprint };
      if (mode === 'record-blocker') return blockerResult(ctx, 'codex adapter forced to record-blocker mode', 'record_blocker');
      const auth = doAuthProbe();
      if (!auth.authenticated) return blockerResult(ctx, 'blocked: no codex credential — neither CODEX_API_KEY/OPENAI_API_KEY nor ChatGPT-OAuth auth.json present (do NOT auto-provision)', 'no_credential');
      const bin = doResolveBin();
      if (!bin.path) return blockerResult(ctx, `blocked: no codex binary — ${bin.error ?? 'not resolvable'} (do NOT auto-install)`, 'no_binary');

      const schemaFile = path.join(os.tmpdir(), `baton-codex-schema-${randomUUID()}.json`);
      try { fs.writeFileSync(schemaFile, JSON.stringify(CODEX_RESULT_SCHEMA), 'utf8'); }
      catch (e) { return blockerResult(ctx, `blocked: could not stage output schema — ${String(e?.message ?? e)}`, 'schema_write_failed'); }

      try {
        const prompt = buildCodexPrompt({ skillText, packet });
        const argv = buildCodexArgv({ schemaFile, workdir: cwd });
        const spawned = await runCodex({ codexBin: bin.path, argv, cwd, spawn, timeoutMs, apiKey: auth.method === 'api-key' ? config.codexApiKey : null, prompt, platform, log });
        if (spawned.code === -2) return blockerResult(ctx, spawned.stderr || `codex turn timed out after ${timeoutMs}ms`, 'timed_out');
        if (!spawned.ok) return blockerResult(ctx, `codex exec failed (exit ${spawned.code}): ${String(spawned.stderr ?? '').slice(0, 300)}`.trim(), 'exec_failed');

        const parsed = parseCodexJsonl(spawned.stdout);
        const validation = validateCodexResult(parsed.result);
        if (!validation.ok) return blockerResult(ctx, `codex returned malformed/non-conforming output: ${validation.errors.join('; ')}`, 'malformed_output');

        const r = parsed.result;
        const payload = {
          status: 'ok', verdict: r.verdict, summary: r.summary,
          claims_verified: Array.isArray(r.claims_verified) ? r.claims_verified : [],
          findings: Array.isArray(r.findings) ? r.findings : [],
          proposed_action: r.proposed_action ?? { type: 'noop', target: '' },
        };
        const { envelope, signature } = sign(payload, ctx);
        return { ok: true, blocked: false, signerPrincipal: PRINCIPAL, structuredResult: payload, envelope, signature, tokensUsed: parsed.tokensUsed ?? 0, rawStdout: spawned.stdout };
      } finally {
        try { fs.unlinkSync(schemaFile); } catch { /* best-effort */ }
      }
    },
  };
}

// Bound on the taskkill reap itself so the kill path can never hang the poll loop.
export const DEFAULT_TASKKILL_TIMEOUT_MS = 5000;

/**
 * Reap the ENTIRE process tree of a spawned codex child, and CONFIRM the reap before
 * resolving. This is the WP1 defect fix (CRITICAL): on Windows `child.kill()` signals
 * ONLY the direct child handle -- codex.exe's own subprocesses survive as ORPHANS and
 * wedge the watcher's poll loop (silent HALT).
 *
 * The earlier fix still had a Windows race: it spawned `taskkill /T /F` detached+unref'd
 * and then IMMEDIATELY did `child.kill('SIGKILL')`. If the leader died before taskkill
 * enumerated its descendants, taskkill failed and the orphans survived -- unconfirmed.
 *
 * Corrected reap:
 *   - win32:  run `taskkill /PID <leader> /T /F` and AWAIT its exit. taskkill kills the
 *             WHOLE tree INCLUDING the leader, so we do NOT pre-kill the leader first. A
 *             direct child.kill() fallback runs ONLY if taskkill fails/errors/times out.
 *             The taskkill call is itself bounded (DEFAULT_TASKKILL_TIMEOUT_MS) so the
 *             kill path cannot hang.
 *   - posix:  the child leads its own process group (spawned `detached`), so a single
 *             process.kill(-pid, 'SIGKILL') reaps the whole group INCLUDING the leader.
 *
 * Async: the caller AWAITs this so an abandoned codex tree is confirmed dead before the
 * turn resolves. Every step is guarded so this can never throw. Returns a Promise.
 */
export async function killProcessTree({ child, spawn = nodeSpawn, platform = process.platform, log, taskkillTimeoutMs = DEFAULT_TASKKILL_TIMEOUT_MS } = {}) {
  const pid = child?.pid;
  if (platform === 'win32') {
    if (pid != null) {
      // AWAIT taskkill: it reaps the whole tree (leader included). We must NOT pre-kill
      // the leader, or taskkill can fail to enumerate the now-dead leader's descendants.
      const reaped = await new Promise((resolve) => {
        let settled = false;
        const done = (ok) => { if (!settled) { settled = true; resolve(ok); } };
        let killer;
        try { killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { shell: false, stdio: 'ignore' }); }
        catch { return done(false); }
        // Bound the taskkill so the kill path itself cannot hang the loop.
        const timer = setTimeout(() => { try { killer?.kill?.(); } catch { /* ignore */ } done(false); }, taskkillTimeoutMs);
        try { timer.unref?.(); } catch { /* ignore */ }
        try { killer?.on?.('error', () => { clearTimeout(timer); done(false); }); } catch { clearTimeout(timer); return done(false); }
        try { killer?.on?.('close', (code) => { clearTimeout(timer); done(code === 0); }); } catch { clearTimeout(timer); return done(false); }
      });
      // Fallback ONLY if taskkill did not confirm: on success taskkill already killed the
      // leader, so signalling it again would be redundant (and it is already gone).
      if (!reaped) { try { child?.kill?.('SIGKILL'); } catch { try { child?.kill?.(); } catch { /* ignore */ } } }
    } else {
      // No pid to target the tree -- best-effort direct handle kill.
      try { child?.kill?.('SIGKILL'); } catch { try { child?.kill?.(); } catch { /* ignore */ } }
    }
  } else if (pid != null) {
    // The child leads its own process group (spawned detached); negative pid = group.
    // This reaps the whole group INCLUDING the leader in one call.
    try { process.kill(-pid, 'SIGKILL'); } catch { /* group already gone / no perms */ }
  } else {
    try { child?.kill?.('SIGKILL'); } catch { /* ignore */ }
  }
  if (typeof log === 'function') { try { log(`killProcessTree: reaped codex pid ${pid ?? '(unknown)'} (${platform})`); } catch { /* ignore */ } }
}

function runCodex({ codexBin, argv, cwd, spawn, timeoutMs, apiKey, prompt, platform = process.platform, log }) {
  return new Promise((resolve) => {
    let stdout = ''; let stderr = ''; let done = false;
    const finish = (r) => { if (!done) { done = true; resolve(r); } };
    let child;
    // SANITISED child env — Telegram/ClickUp/DB secrets are stripped so the reviewer
    // process can never read them. The api key (if any) rides via env, never argv.
    const env = sanitizeCodexEnv(process.env, apiKey);
    const spawnOpts = { cwd, shell: false, env };
    // POSIX: give codex its OWN process group so a timeout can reap the WHOLE tree via
    // process.kill(-pid). On win32 the tree is reaped by pid via `taskkill /T` instead,
    // so no detach is needed (and detaching would change console-handle behaviour).
    if (platform !== 'win32') spawnOpts.detached = true;
    try { child = spawn(codexBin, argv, spawnOpts); }
    catch (e) { return finish({ ok: false, code: -1, stderr: String(e?.message ?? e), stdout: '' }); }
    const timer = setTimeout(() => {
      // TREE-kill, not child.kill(): a bare child.kill() leaves codex.exe's children
      // as orphans on Windows, and an orphaned codex WEDGES the poll loop. AWAIT the tree
      // reap (taskkill confirms the whole tree is dead) BEFORE resolving, so an abandoned
      // codex process can never survive past the turn; killProcessTree is itself bounded
      // so this can never hang. ALWAYS resolve (timed_out) once the reap settles.
      Promise.resolve(killProcessTree({ child, spawn, platform, log }))
        .catch(() => { /* reaping must never throw */ })
        .finally(() => finish({ ok: false, code: -2, stderr: `turn timed out after ${timeoutMs}ms`, stdout, timed_out: true }));
    }, timeoutMs);
    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (e) => { clearTimeout(timer); finish({ ok: false, code: -1, stderr: String(e?.message ?? e), stdout }); });
    child.on('close', (code) => { clearTimeout(timer); finish({ ok: code === 0, code, stdout, stderr }); });
    try { child.stdin?.write(prompt); child.stdin?.end(); } catch { /* ignore */ }
  });
}

/** Parse codex `--json` JSONL: pull the final agent message JSON object. */
export function parseCodexJsonl(text) {
  const lines = String(text ?? '').split(/\r?\n/).filter(Boolean);
  let final = null; let tokensUsed = 0;
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj?.type === 'item.completed' || obj?.type === 'turn.completed' || obj?.item?.text || obj?.text) final = obj.item?.text ?? obj.text ?? final;
      const outTok = obj?.usage?.output_tokens ?? obj?.item?.usage?.output_tokens;
      if (outTok) tokensUsed += Number(outTok) || 0;
    } catch { /* skip non-JSON progress lines */ }
  }
  if (final && typeof final === 'string') {
    const start = final.indexOf('{'); const end = final.lastIndexOf('}');
    if (start >= 0 && end > start) { try { return { result: JSON.parse(final.slice(start, end + 1)), tokensUsed }; } catch { /* fall */ } }
    return { result: { summary: final.slice(0, 400) }, tokensUsed, malformed: true };
  }
  return { result: null, tokensUsed, malformed: true };
}

/** Lightweight structural validation against CODEX_RESULT_SCHEMA. Fail-closed. */
export function validateCodexResult(obj) {
  const errors = [];
  if (!obj || typeof obj !== 'object') return { ok: false, errors: ['result is not an object'] };
  const verdicts = ['approve', 'request_changes', 'comment'];
  if (!verdicts.includes(obj.verdict)) errors.push(`verdict must be one of ${verdicts.join('|')}`);
  if (typeof obj.summary !== 'string' || obj.summary.length === 0) errors.push('summary must be a non-empty string');
  const action = obj.proposed_action;
  const actionTypes = ['post_review', 'post_comment', 'noop'];
  if (!action || !actionTypes.includes(action.type)) errors.push(`proposed_action.type must be one of ${actionTypes.join('|')}`);
  if (obj.findings !== undefined && !Array.isArray(obj.findings)) errors.push('findings must be an array when present');
  return { ok: errors.length === 0, errors };
}
