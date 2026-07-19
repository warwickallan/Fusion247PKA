// ===========================================================================
// PORTED for BUILD-014 WP-C (Tower-on-baton). Faithfully carried from
//   Fusion247PKA-towerfix/services/tower-baton/src/fableAdapter.js (transport-agnostic).
// Only relative import extensions (.js -> .mjs) changed; the FAIL-CLOSED model-
// attestation, honest-provider labelling, tool-lessness and secret-denylist are
// preserved VERBATIM. The retired ClickUp wire (watcher/clickupClient/handoff) was
// deliberately NOT ported. Consumed by review/reviewHandler.mjs as a WP-B job.
// ===========================================================================
// Tower baton -- the SECOND, independent reviewer: Fable (claude-fable-5) COLD-FINAL QA.
//
// Two-mode reviewing: Codex is the correction-loop reviewer (codexAdapter.js); FABLE is
// the ADVERSARIAL COLD-FINAL reviewer. A Codex APPROVE alone is NOT merge-ready -- the
// watcher auto-routes the SAME head into a Fable cold-final pass, and ONLY Codex APPROVE
// + Fable APPROVE yields a merge-ready signal.
//
// This adapter mirrors codexAdapter's structure + discipline EXACTLY, but invokes a
// DIFFERENT engine so the two reviewers are genuinely INDEPENDENT (not the same model
// wearing two hats):
//
//   - INVOCATION: the `claude` CLI headless (print mode) --
//       claude -p --model claude-fable-5 --output-format json \
//              --tools "" --allowedTools "" --disallowedTools Read Glob Grep Bash ... \
//              --system-prompt <adversarial-reviewer> -
//     Verified against claude 2.1.214 (`claude --help`): `-p/--print` is print-and-exit;
//     `--output-format json` emits ONE result object with the final message under
//     `.result`; `--model claude-fable-5` selects the reviewer model (confirmed present
//     via modelUsage). TOOL-LESSNESS (WP1 CRITICAL A): `--tools ""` is the AVAILABILITY
//     flag -- `claude --help`: "Specify the list of available tools ... Use \"\" to
//     disable all tools" -- so `--tools ""` is what actually removes Read/Glob/Grep/Bash
//     from the child. `--allowedTools ""` is ONLY a permission PRE-APPROVAL list (it does
//     NOT reduce availability), so it is kept as belt-and-braces alongside an explicit
//     `--disallowedTools <every built-in tool>` denylist. Without `--tools ""` the child
//     retained Read/Glob/Grep and could read the repo CLAUDE.md (persona leak) and
//     C:\.fusion247\*.env (secrets) -- voiding independence + secret-freedom. `--system-
//     prompt` REPLACES the default Claude Code system prompt so the reviewer adopts NO
//     repo "You are Larry" persona. Claude has NO `--output-schema` flag, so the required
//     JSON shape is described IN THE PROMPT and validated fail-closed on the way back.
//   - NEUTRAL CWD: the child is spawned from a NEUTRAL directory (os.tmpdir()), NOT the
//     repo, so claude's CLAUDE.md auto-discovery cannot inject the project persona. Fable
//     reasons ONLY over the STAGED DIFF carried in the prompt -- it needs no tools/disk.
//   - DISCIPLINE (reused from codexAdapter, not re-implemented weaker): the SAME
//     process-TREE kill on timeout (killProcessTree), the SAME secret denylist stripped
//     from the child env (Fable NEVER sees TELEGRAM_BOT_TOKEN/CLICKUP_TOKEN/DATABASE_URL/
//     HMAC secrets), the SAME result-schema shape (validateCodexResult) so the watcher
//     consumes both reviewers uniformly.
//   - IDENTITY: signed under principal `claude_fable`, provider `anthropic`, modelId
//     `claude-fable-5` -- distinct from gpt_codex.
//
// FAIL-CLOSED: no binary / no auth / timeout / non-zero exit / malformed output each
// produce a distinct SIGNED `blocked` verdict (principal claude_fable) -- never a hang.

import { spawn as nodeSpawn } from 'node:child_process';
import fsDefault from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeSignedVerdict } from './envelope.mjs';
import {
  CODEX_RESULT_SCHEMA, CODEX_ENV_DENYLIST, killProcessTree,
  validateCodexResult, buildCodexPrompt,
} from './codexAdapter.mjs';

// The reviewer model. This is a NAME/alias (like codex's fixed 'openai-codex-exec'),
// NOT a version to discover -- the BINARY is discovered without a hard-coded version.
export const FABLE_MODEL_ID = 'claude-fable-5';

// ATTESTATION MATCH (HIGH #4). A modelUsage key is accepted as the Fable reviewer model ONLY
// when it is the EXACT alias or an explicitly dated id (claude-fable-5-YYYYMMDD). Anchored on
// both ends so unrelated ids (claude-fable-50, claude-fable-5-evil) can never match -- the
// old startsWith(FABLE_MODEL_ID) check let those through.
export const FABLE_MODEL_ID_RE = /^claude-fable-5(?:-\d{8})?$/;

// Print-mode headless flags proven against claude 2.1.214 (see header). `--model` and
// `--output-format json` are fixed; the tool-disabling flags + `--system-prompt`/`-` are
// appended by buildFableArgv so the variadic tool flags can never swallow the `-` stdin marker.
export const FABLE_CLI_FLAGS = Object.freeze(['-p', '--model', FABLE_MODEL_ID, '--output-format', 'json']);

// The built-in tools explicitly DENIED to the Fable child (belt-and-braces behind
// `--tools ""`). If claude ever adds a tool, `--tools ""` (availability) still removes it;
// this named denylist makes the intent auditable and defends the permission layer too.
export const FABLE_TOOL_DENYLIST = Object.freeze([
  'Read', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Glob', 'Grep',
  'Bash', 'BashOutput', 'KillShell', 'WebFetch', 'WebSearch', 'Task', 'TodoWrite',
]);

// REPLACES the default Claude Code system prompt (via --system-prompt) so the reviewer is
// an independent adversary, never the repo's Larry persona.
export const FABLE_SYSTEM_PROMPT = [
  'You are Fable, an independent adversarial code reviewer (principal claude_fable).',
  'You are NOT Larry, NOT an orchestrator, and you adopt NO project or repository persona.',
  'You perform a cold, final, whole-change review and you output ONLY strict JSON -- no',
  'prose, no markdown fences, no commentary. You have no tools and no disk access; you',
  'reason solely over the staged diff provided in the user message.',
].join(' ');

// The SAME secret denylist Codex uses -- Fable must NEVER see Telegram/ClickUp/DB/HMAC
// secrets. Re-exported by name so the intent is explicit at the call site + in tests.
export const FABLE_ENV_DENYLIST = CODEX_ENV_DENYLIST;

// CROSS-REVIEWER credential strip (WP1 LOW I): the Fable child authenticates with its OWN
// Anthropic session (ANTHROPIC_API_KEY / ~/.claude OAuth) and must never carry the OTHER
// reviewer's OpenAI/Codex creds -- strip them so a prompt-injected Fable cannot reach Codex.
export const FABLE_CROSS_REVIEWER_KEYS = Object.freeze(['OPENAI_API_KEY', 'CODEX_API_KEY']);

// Default Fable turn timeout. Same 8min as codex. On the routed path codex(<=8min) and
// fable(<=8min) run SEQUENTIALLY inside ONE per-cycle watchdog, so that watchdog must
// cover BOTH turns + slack (DEFAULT_CYCLE_WATCHDOG_MS = 8+8+4 = 20min in watcher.js);
// each turn's OWN tree-kill fires first, and the watchdog is the outer safety net that
// must NOT fire mid-fable on a healthy-but-slow two-turn cycle.
export const DEFAULT_FABLE_TIMEOUT_MS = 8 * 60 * 1000;

/** Locate the claude binary WITHOUT hard-coding a version. Override -> local-bin -> PATH. */
export function resolveFableBin({
  env = process.env, fs = fsDefault, homeDir = os.homedir(),
  binName = process.platform === 'win32' ? 'claude.exe' : 'claude',
} = {}) {
  // 1. Explicit overrides (most specific wins). FABLE_BIN is checked before CLAUDE_BIN.
  for (const key of ['FABLE_BIN', 'CLAUDE_BIN']) {
    const override = env?.[key];
    if (override) {
      try {
        if (fs.existsSync(override) && fs.statSync(override).isFile()) return { path: override, source: `env:${key}`, error: null };
        return { path: null, source: `env:${key}`, error: `${key} set but not a file: ${override}` };
      } catch (e) { return { path: null, source: `env:${key}`, error: String(e?.message ?? e) }; }
    }
  }
  // 2. The known local install: %USERPROFILE%\.local\bin\claude(.exe).
  const localBin = path.join(homeDir, '.local', 'bin', binName);
  try { if (fs.existsSync(localBin) && fs.statSync(localBin).isFile()) return { path: localBin, source: 'local-bin', error: null }; } catch { /* fall through */ }
  // 3. PATH lookup.
  const onPath = findOnPath(binName, { env, fs });
  if (onPath) return { path: onPath, source: 'PATH', error: null };
  return { path: null, source: 'discovery', error: `no claude binary -- checked FABLE_BIN, CLAUDE_BIN, ${localBin}, and PATH` };
}

/** Find an executable on PATH. On win32 also probes the PATHEXT-style .exe/.cmd variants. */
export function findOnPath(binName, { env = process.env, fs = fsDefault } = {}) {
  const rawPath = env?.PATH ?? env?.Path ?? '';
  if (!rawPath) return null;
  const isWin = process.platform === 'win32';
  const bases = isWin && !/\.[a-z]+$/i.test(binName) ? [`${binName}.exe`, `${binName}.cmd`, binName] : [binName];
  for (const dir of String(rawPath).split(path.delimiter)) {
    if (!dir) continue;
    for (const base of bases) {
      const candidate = path.join(dir, base);
      try { if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate; } catch { /* skip */ }
    }
  }
  return null;
}

/**
 * STARTUP model-resolution smoke check (finding #4c). Reads `claude --help` (a read, NOT a
 * gate-disabling probe) to confirm at STARTUP — not mid-review — that this claude CLI:
 *   · exits 0 (the binary is genuinely invocable), AND
 *   · advertises the `--tools` availability flag (so tool-lessness is enforceable), AND
 *   · advertises the `--model` flag (so the reviewer model is selectable / resolvable).
 * A missing flag or a non-zero exit means a mid-review turn could silently run without
 * tool-lessness or with an unresolvable model — caught here, LOUD, before the watcher comes
 * online rather than as a mid-review blocker. Bounded so a hung `--help` can never wedge startup.
 */
export function probeFableCli({ bin, spawn = nodeSpawn, timeoutMs = 15000 } = {}) {
  if (!bin) return Promise.resolve({ ok: false, supportsToolless: false, supportsModel: false, error: 'no claude binary to probe' });
  return new Promise((resolve) => {
    let out = ''; let err = ''; let done = false;
    const finish = (r) => { if (!done) { done = true; resolve(r); } };
    let child;
    try { child = spawn(bin, ['--help'], { shell: false }); }
    catch (e) { return finish({ ok: false, supportsToolless: false, supportsModel: false, error: String(e?.message ?? e) }); }
    const timer = setTimeout(() => { try { child?.kill?.(); } catch { /* ignore */ } finish({ ok: false, supportsToolless: false, supportsModel: false, error: 'claude --help probe timed out' }); }, timeoutMs);
    child.stdout?.on('data', (d) => { out += d.toString(); });
    child.stderr?.on('data', (d) => { err += d.toString(); });
    child.on('error', (e) => { clearTimeout(timer); finish({ ok: false, supportsToolless: false, supportsModel: false, error: String(e?.message ?? e) }); });
    child.on('close', (code) => {
      clearTimeout(timer);
      const help = `${out}\n${err}`;
      const supportsToolless = /--tools\b/.test(help);
      const supportsModel = /--model\b/.test(help);
      const ok = code === 0 && supportsToolless && supportsModel;
      finish({ ok, supportsToolless, supportsModel, error: ok ? null : (code !== 0 ? `claude --help exited ${code}` : 'claude --help lacks --tools/--model support (model tool-lessness unverifiable at startup)') });
    });
  });
}

/** Detect claude auth WITHOUT reading any secret value (existence + key NAMES only). */
export function detectFableAuth({ env = process.env, homeDir = os.homedir(), fs = fsDefault } = {}) {
  if (env?.ANTHROPIC_API_KEY) return { authenticated: true, method: 'api-key', authPath: null, keyNames: null };
  if (env?.CLAUDE_CODE_OAUTH_TOKEN) return { authenticated: true, method: 'oauth-token-env', authPath: null, keyNames: null };
  const credPath = path.join(homeDir, '.claude', '.credentials.json');
  try {
    if (!fs.existsSync(credPath)) return { authenticated: false, method: 'none', authPath: null, keyNames: null };
    let keyNames = null;
    try { const parsed = JSON.parse(fs.readFileSync(credPath, 'utf8')); if (parsed && typeof parsed === 'object') keyNames = Object.keys(parsed); } catch { /* existence is enough */ }
    return { authenticated: true, method: 'oauth-credentials', authPath: credPath, keyNames };
  } catch { return { authenticated: false, method: 'none', authPath: null, keyNames: null }; }
}

/** Build the read-only, tool-less headless argv. `-` is LAST so the stdin marker survives. */
export function buildFableArgv({ systemPrompt = FABLE_SYSTEM_PROMPT } = {}) {
  // Order matters (variadic flags are each bounded by the NEXT flag, which starts with `--`):
  //   `--tools ""`        -> AVAILABILITY: "" disables ALL tools (the real tool-lessness).
  //   `--allowedTools ""` -> permission pre-approval list (belt-and-braces).
  //   `--disallowedTools <names...>` -> explicit per-tool deny (belt-and-braces), bounded
  //                          by the following `--system-prompt` flag.
  //   `--system-prompt <prompt>` takes exactly one arg; `-` (read prompt from stdin) is last.
  return [
    ...FABLE_CLI_FLAGS,
    '--tools', '',
    '--allowedTools', '',
    '--disallowedTools', ...FABLE_TOOL_DENYLIST,
    '--system-prompt', systemPrompt,
    '-',
  ];
}

/** Strip the SAME secret denylist Codex uses + the OTHER reviewer's creds. No api key is injected. */
export function sanitizeFableEnv(parentEnv = process.env) {
  const env = { ...parentEnv };
  for (const name of FABLE_ENV_DENYLIST) delete env[name];
  for (const name of FABLE_CROSS_REVIEWER_KEYS) delete env[name]; // never carry Codex's OpenAI creds
  return env;
}

/**
 * Compose the Fable review prompt: the SAME builder pattern as buildCodexPrompt (QA skill
 * + staged diff + packet pointers), plus the cold-final adversarial framing AND the strict
 * JSON schema (claude has no --output-schema, so the shape is instructed in-band).
 */
export function buildFablePrompt({ skillText, packet = {} }) {
  const base = buildCodexPrompt({ skillText, packet });
  return [
    base,
    '',
    '-- FABLE COLD-FINAL (ADVERSARIAL) REVIEW --',
    'You are the SECOND, INDEPENDENT reviewer (principal claude_fable). This is a COLD',
    'FINAL pass over the WHOLE change: assume a prior correction-loop reviewer already',
    'signed it off, and your job is to find what it MISSED -- regressions, security/scope',
    'issues, broken invariants, untested edges. Be adversarial but fair; do NOT rubber-stamp.',
    'You have NO tools and NO disk access -- reason ONLY over the STAGED DIFF above.',
    '',
    'Return ONLY a single JSON object conforming EXACTLY to this schema (no prose, no',
    'markdown fences, nothing before or after the JSON):',
    JSON.stringify(CODEX_RESULT_SCHEMA),
    '',
    'verdict must be one of: approve | request_changes | comment.',
  ].join('\n');
}

/**
 * Create the Fable cold-final QA adapter. `runTurn({ checkpoint, packet, skillText,
 * promptFingerprint })` runs ONE read-only claude turn and returns a signed verdict,
 * shaped IDENTICALLY to the codex adapter so the watcher consumes both uniformly.
 */
export function createFableAdapter({
  config, mode = 'auto', spawn = nodeSpawn, resolveBin, authProbe, fs = fsDefault,
  timeoutMs = DEFAULT_FABLE_TIMEOUT_MS, platform = process.platform,
  neutralCwd = os.tmpdir(), log,
} = {}) {
  const PRINCIPAL = 'claude_fable';
  const secret = config?.signingSecret ? config.signingSecret(PRINCIPAL) : null;
  const doResolveBin = typeof resolveBin === 'function' ? resolveBin : () => resolveFableBin({});
  const doAuthProbe = typeof authProbe === 'function' ? authProbe : () => detectFableAuth({});

  function sign(payload, { checkpoint, packet, promptFingerprint }) {
    const args = {
      principal: PRINCIPAL, provider: 'anthropic', modelId: FABLE_MODEL_ID,
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
    cliFlags: [...FABLE_CLI_FLAGS],

    diagnostics() {
      const bin = doResolveBin(); const auth = doAuthProbe();
      return { principal: PRINCIPAL, provider: 'anthropic', model_id: FABLE_MODEL_ID, bin_path: bin.path ?? '(unresolved)', bin_source: bin.source, bin_error: bin.error, auth_method: auth.method, authenticated: auth.authenticated, auth_key_names: auth.keyNames ?? null };
    },

    async verifyInvocable() {
      const bin = doResolveBin();
      const auth = doAuthProbe();
      // STARTUP smoke check (#4c): a resolvable binary is not enough — confirm the CLI runs
      // and advertises --tools/--model so a missing tool-lessness/model support fails LOUD at
      // startup, not mid-review. invocable requires BOTH a binary AND a passing smoke probe.
      const smoke = bin.path ? await probeFableCli({ bin: bin.path, spawn }) : { ok: false, supportsToolless: false, supportsModel: false, error: bin.error ?? 'no claude binary' };
      return {
        invocable: Boolean(bin.path) && smoke.ok, binPath: bin.path ?? null, binSource: bin.source,
        binError: bin.error ?? (smoke.ok ? null : smoke.error), authenticated: auth.authenticated, authMethod: auth.method,
        modelSmoke: smoke,
      };
    },

    async runTurn({ checkpoint, packet, skillText, promptFingerprint }) {
      const ctx = { checkpoint, packet, promptFingerprint };
      if (mode === 'record-blocker') return blockerResult(ctx, 'fable adapter forced to record-blocker mode', 'record_blocker');
      const auth = doAuthProbe();
      if (!auth.authenticated) return blockerResult(ctx, 'blocked: no claude credential -- neither ANTHROPIC_API_KEY/CLAUDE_CODE_OAUTH_TOKEN nor ~/.claude/.credentials.json present (do NOT auto-provision)', 'no_credential');
      const bin = doResolveBin();
      if (!bin.path) return blockerResult(ctx, `blocked: no claude binary -- ${bin.error ?? 'not resolvable'} (do NOT auto-install)`, 'no_binary');

      const prompt = buildFablePrompt({ skillText, packet });
      const argv = buildFableArgv({});
      const spawned = await runFable({ fableBin: bin.path, argv, cwd: neutralCwd, spawn, timeoutMs, prompt, platform, log });
      if (spawned.code === -2) return blockerResult(ctx, spawned.stderr || `fable turn timed out after ${timeoutMs}ms`, 'timed_out');
      if (!spawned.ok) return blockerResult(ctx, `claude headless failed (exit ${spawned.code}): ${String(spawned.stderr ?? '').slice(0, 300)}`.trim(), 'exec_failed');

      const parsed = parseFableJson(spawned.stdout);
      if (!parsed.ok) return blockerResult(ctx, `fable returned unusable CLI output: ${parsed.error}`, 'malformed_output');
      // MODEL CONFIRMATION (finding #4): fail-CLOSED on both a SILENT substitution AND an
      // UNVERIFIABLE run. The verdict is signed model_id=claude-fable-5 from the argv; we must
      // NEVER sign that claim without positive evidence the model actually ran.
      //   (a) absent/malformed/ambiguous modelUsage -> BLOCKED (model_unverified). The earlier
      //       code accepted an absent map (fail-OPEN) -- it would sign an unverified approve.
      //       The startup smoke check (verifyInvocable) confirms the CLI emits modelUsage, so
      //       an absent map mid-review is a real anomaly, not merely an "older CLI".
      //   (b) EXACT-or-DATED match on FABLE_MODEL_ID (HIGH #4): the earlier startsWith() check
      //       accepted UNRELATED ids (claude-fable-50, claude-fable-5-evil) -- it is replaced by
      //       an anchored regex that accepts ONLY the exact alias or an explicitly dated id
      //       (claude-fable-5-YYYYMMDD). The matched modelUsage entry must ALSO be a non-null
      //       object carrying at least one credible numeric usage field (a `{"claude-fable-5":
      //       null}` / empty entry is malformed attestation), and a MULTIPLE/ambiguous match is
      //       rejected -- we never sign an approve on an ambiguous or non-credible attestation.
      const mu = parsed.modelUsage;
      const muValid = mu && typeof mu === 'object' && !Array.isArray(mu) && Object.keys(mu).length > 0;
      if (!muValid) {
        return blockerResult(ctx, `fable model unverified: the CLI reported no usable modelUsage map, so it cannot be confirmed that ${FABLE_MODEL_ID} ran -- refusing to sign an unverified verdict`, 'model_unverified');
      }
      const matchingKeys = Object.keys(mu).filter((k) => FABLE_MODEL_ID_RE.test(String(k)));
      if (matchingKeys.length === 0) {
        return blockerResult(ctx, `fable model substitution: CLI modelUsage did not include an exact/dated ${FABLE_MODEL_ID} (reported: ${Object.keys(mu).join(', ') || '(none)'})`, 'model_substituted');
      }
      if (matchingKeys.length > 1) {
        return blockerResult(ctx, `fable model unverified: CLI modelUsage reported MULTIPLE ${FABLE_MODEL_ID} entries (${matchingKeys.join(', ')}) -- ambiguous attestation, refusing to sign`, 'model_unverified');
      }
      const modelEntry = mu[matchingKeys[0]];
      const entryCredible = modelEntry && typeof modelEntry === 'object' && !Array.isArray(modelEntry)
        && Object.values(modelEntry).some((v) => typeof v === 'number' && Number.isFinite(v) && v > 0);
      if (!entryCredible) {
        return blockerResult(ctx, `fable model unverified: the ${matchingKeys[0]} modelUsage entry is null/empty or carries no credible numeric usage -- cannot confirm the model produced output, refusing to sign`, 'model_unverified');
      }
      const validation = validateCodexResult(parsed.result);
      if (!validation.ok) return blockerResult(ctx, `fable returned malformed/non-conforming output: ${validation.errors.join('; ')}`, 'malformed_output');

      const r = parsed.result;
      const payload = {
        status: 'ok', verdict: r.verdict, summary: r.summary,
        claims_verified: Array.isArray(r.claims_verified) ? r.claims_verified : [],
        findings: Array.isArray(r.findings) ? r.findings : [],
        proposed_action: r.proposed_action ?? { type: 'noop', target: '' },
      };
      const { envelope, signature } = sign(payload, ctx);
      return { ok: true, blocked: false, signerPrincipal: PRINCIPAL, structuredResult: payload, envelope, signature, tokensUsed: parsed.tokensUsed ?? 0, rawStdout: spawned.stdout };
    },
  };
}

function runFable({ fableBin, argv, cwd, spawn, timeoutMs, prompt, platform = process.platform, log }) {
  return new Promise((resolve) => {
    let stdout = ''; let stderr = ''; let done = false;
    const finish = (r) => { if (!done) { done = true; resolve(r); } };
    let child;
    // SANITISED child env -- Telegram/ClickUp/DB/HMAC secrets are stripped so the reviewer
    // process can never read them. Auth rides via the on-disk ~/.claude session (OAuth) or
    // ANTHROPIC_API_KEY (kept -- it is not on the denylist), never via a leaked secret.
    const env = sanitizeFableEnv(process.env);
    // cwd is a NEUTRAL dir (os.tmpdir()) so claude does not auto-discover the repo CLAUDE.md
    // persona; Fable reviews the STAGED DIFF from the prompt, not the disk.
    const spawnOpts = { cwd, shell: false, env };
    // POSIX: own process group so a timeout reaps the WHOLE tree via process.kill(-pid).
    // win32: the tree is reaped by pid via `taskkill /T` (killProcessTree), so no detach.
    if (platform !== 'win32') spawnOpts.detached = true;
    try { child = spawn(fableBin, argv, spawnOpts); }
    catch (e) { return finish({ ok: false, code: -1, stderr: String(e?.message ?? e), stdout: '' }); }
    const timer = setTimeout(() => {
      // TREE-kill (the SAME killProcessTree Codex uses), AWAITED before resolving, so an
      // abandoned claude tree can never survive past the turn and wedge the poll loop. The
      // reap is bounded internally so this can never hang. ALWAYS resolve timed_out after.
      Promise.resolve(killProcessTree({ child, spawn, platform, log }))
        .then((reap) => finish({ ok: false, code: -2, stderr: `turn timed out after ${timeoutMs}ms`, stdout, timed_out: true, tree_reaped: reap?.tree_reaped !== false }))
        .catch(() => finish({ ok: false, code: -2, stderr: `turn timed out after ${timeoutMs}ms`, stdout, timed_out: true, tree_reaped: false }));
    }, timeoutMs);
    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (e) => { clearTimeout(timer); finish({ ok: false, code: -1, stderr: String(e?.message ?? e), stdout }); });
    child.on('close', (code) => { clearTimeout(timer); finish({ ok: code === 0, code, stdout, stderr }); });
    try { child.stdin?.write(prompt); child.stdin?.end(); } catch { /* ignore */ }
  });
}

/**
 * Parse the claude `--output-format json` result: ONE JSON object whose `.result` holds
 * the model's final message text. Extract the reviewer JSON object out of that message
 * (first `{` .. last `}`), same as the codex final-message extraction. Fail-closed.
 */
export function parseFableJson(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return { ok: false, result: null, tokensUsed: 0, modelUsage: null, error: 'empty CLI output' };
  let cli;
  try { cli = JSON.parse(raw); }
  catch {
    // Some builds may stream multiple JSON lines -- take the last parseable object.
    const lines = raw.split(/\r?\n/).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      try { cli = JSON.parse(lines[i]); break; } catch { /* keep scanning */ }
    }
    if (!cli) return { ok: false, result: null, tokensUsed: 0, modelUsage: null, error: 'CLI output is not valid JSON' };
  }
  // Surface modelUsage so runTurn can fail-closed on a silent model substitution (H).
  const modelUsage = (cli && typeof cli.modelUsage === 'object') ? cli.modelUsage : null;
  if (cli?.type === 'result' && (cli.is_error === true || (cli.subtype && cli.subtype !== 'success'))) {
    return { ok: false, result: null, tokensUsed: 0, modelUsage, error: `claude reported ${cli.subtype ?? 'error'} (is_error=${cli.is_error})` };
  }
  const message = typeof cli?.result === 'string' ? cli.result : (typeof cli?.text === 'string' ? cli.text : null);
  const tokensUsed = Number(cli?.usage?.output_tokens ?? cli?.modelUsage?.[FABLE_MODEL_ID]?.outputTokens ?? 0) || 0;
  if (!message) return { ok: false, result: null, tokensUsed, modelUsage, error: 'no final message text in the claude result' };
  const start = message.indexOf('{'); const end = message.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return { ok: true, result: JSON.parse(message.slice(start, end + 1)), tokensUsed, modelUsage }; } catch { /* fall */ }
  }
  return { ok: false, result: null, tokensUsed, modelUsage, error: 'no JSON object in the final message' };
}

/**
 * Decide whether to wire the Fable cold-final reviewer (WP1 MAJOR E). Fable is OPTIONAL:
 * an install without Fable creds/binary must run the byte-identical CODEX-ONLY path, NOT
 * turn every Codex APPROVE into a Fable-BLOCKED flow. Rules:
 *   · not enabled (TOWER_FABLE_ENABLED !== '1')  -> { fable: null } (legacy codex-only path).
 *   · enabled AND fully provisioned (binary + auth via verifyInvocable) -> { fable: adapter }.
 *   · enabled BUT unprovisioned -> { fatal: true } so startup fails LOUD, never silently
 *     BLOCKs every checkpoint.
 * `buildAdapter()` is called ONLY when enabled, so the codex-only path constructs no Fable.
 *
 * @returns {Promise<{ fable, fatal?, reason, inv? }>}
 */
export async function wireFable({ enabled, buildAdapter }) {
  if (!enabled) return { fable: null, reason: 'disabled -- codex-only path (set TOWER_FABLE_ENABLED=1 to enable)' };
  const adapter = typeof buildAdapter === 'function' ? buildAdapter() : null;
  if (!adapter || typeof adapter.verifyInvocable !== 'function') {
    return { fable: null, fatal: true, reason: 'TOWER_FABLE_ENABLED=1 but no Fable adapter could be constructed' };
  }
  const inv = await adapter.verifyInvocable();
  if (!inv?.invocable || !inv?.authenticated) {
    return {
      fable: null, fatal: true, inv,
      reason: `TOWER_FABLE_ENABLED=1 but Fable is not provisioned (binary=${Boolean(inv?.invocable)}, auth=${Boolean(inv?.authenticated)})${inv?.binError ? ` -- ${inv.binError}` : ''}`,
    };
  }
  return { fable: adapter, reason: 'enabled + provisioned', inv };
}
