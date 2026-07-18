// Tower baton — the SINGLE runtime secret/config loader (no terminal-session
// dependency). The watcher, the launcher pre-flight, and any handoff/Codex
// invocation all load through THIS module — there is no second hand-maintained loader.
//
// It reads secrets BY NAME from the protected store C:\.fusion247 at runtime (reusing
// the existing files; fusion-capture-gateway.env carries CLICKUP_TOKEN,
// TELEGRAM_BOT_TOKEN, AUTHORISED_TELEGRAM_USER_ID). Validation is MASKED-ONLY — it
// reports which NAMES are present/absent, never a value. It fails closed (with a
// REDACTED error) on: a missing store dir, a missing required var, or a malformed
// env file.
//
// SECRET DISCIPLINE: no value is ever printed, logged, or returned to an external
// surface. describe() masks every secret; every error string is passed through the
// config redactor so a stray value cannot surface.

import fsDefault from 'node:fs';
import path from 'node:path';

import { loadConfig, SECRET_HOME, DEFAULT_ENV_FILES, parseEnvBody } from './config.js';

// Consumers declare what they require. The watcher requires the ClickUp credential;
// Telegram is required for the milestone dings the acceptance depends on.
export const REQUIRED_FOR_WATCHER = Object.freeze(['CLICKUP_TOKEN', 'TELEGRAM_BOT_TOKEN', 'AUTHORISED_TELEGRAM_USER_ID']);

/** Detect a malformed env file: a non-blank, non-comment line without a KEY=VALUE shape. */
export function findMalformedLines(body) {
  const bad = [];
  const lines = String(body ?? '').split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const noExport = line.startsWith('export ') ? line.slice(7) : line;
    const eq = noExport.indexOf('=');
    const key = eq > 0 ? noExport.slice(0, eq).trim() : '';
    if (eq <= 0 || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) bad.push(i + 1); // line NUMBER only — never the content
  });
  return bad;
}

/**
 * Load + validate runtime config. Fail-closed with a redacted error.
 *
 * @param {object} args
 * @param {string} [args.home]      secret store (default C:\.fusion247, FUSION247_HOME override)
 * @param {string[]} [args.required] required env NAMES (default REQUIRED_FOR_WATCHER)
 * @param {object} [args.env]       process env (process.env; a value here overrides the files)
 * @param {object} [args.fs]        injectable fs
 * @param {string[]} [args.files]   env files under the store (default DEFAULT_ENV_FILES)
 * @returns {{ ok, config, missing, malformed, error }}
 */
export function loadRuntimeConfig({ home = SECRET_HOME, required = REQUIRED_FOR_WATCHER, env = process.env, fs = fsDefault, files = DEFAULT_ENV_FILES } = {}) {
  // 1. The protected store must exist (unless every required value is already in env —
  //    e.g. a hermetic test injecting process.env, which is a valid session-independent path).
  const dirExists = (() => { try { return fs.existsSync(home) && fs.statSync(home).isDirectory(); } catch { return false; } })();
  const allInEnv = required.every((n) => typeof env?.[n] === 'string' && env[n].length > 0);
  if (!dirExists && !allInEnv) {
    return { ok: false, config: null, missing: [...required], malformed: [], error: `fail-closed: secret store not found at ${home} (and required vars not in the environment)` };
  }

  // 2. Malformed-file check (fail-closed) — only for files that actually exist.
  const malformed = [];
  if (dirExists) {
    for (const rel of files) {
      const full = path.isAbsolute(rel) ? rel : path.join(home, rel);
      try {
        if (!fs.existsSync(full)) continue;
        const bad = findMalformedLines(fs.readFileSync(full, 'utf8'));
        if (bad.length) malformed.push({ file: full, lines: bad });
      } catch (e) {
        malformed.push({ file: full, lines: [], error: String(e?.code ?? 'read-error') });
      }
    }
  }

  const config = loadConfig({ env, home, files, fs });

  if (malformed.length) {
    const where = malformed.map((m) => `${m.file}${m.lines.length ? ` (lines ${m.lines.join(',')})` : ` (${m.error ?? 'unreadable'})`}`).join('; ');
    return { ok: false, config, missing: [], malformed, error: config.redact(`fail-closed: malformed env file(s): ${where}`) };
  }

  // 3. Required-var check (masked — NAMES only).
  const present = (name) => {
    const v = env?.[name];
    if (typeof v === 'string' && v.length > 0) return true;
    // fall back to the config's resolved (file-backed) values
    if (name === 'CLICKUP_TOKEN') return config.clickupToken !== null;
    if (name === 'TELEGRAM_BOT_TOKEN') return config.telegramBotToken !== null;
    if (name === 'AUTHORISED_TELEGRAM_USER_ID') return config.authorisedTelegramUserId !== null;
    return false;
  };
  const missing = required.filter((n) => !present(n));
  if (missing.length) {
    return { ok: false, config, missing, malformed: [], error: config.redact(`fail-closed: missing required secret(s) by NAME: ${missing.join(', ')} (add them to a file under ${home})`) };
  }

  return { ok: true, config, missing: [], malformed: [], error: null };
}

/**
 * A log-safe pre-flight health summary. Every secret is masked; the store dir and
 * per-name present/absent booleans are shown. Never prints a value.
 */
export function healthSummary({ home = SECRET_HOME, required = REQUIRED_FOR_WATCHER, env = process.env, fs = fsDefault, files = DEFAULT_ENV_FILES } = {}) {
  const loaded = loadRuntimeConfig({ home, required, env, fs, files });
  const c = loaded.config;
  return {
    ok: loaded.ok,
    store: home,
    storeExists: (() => { try { return fs.existsSync(home); } catch { return false; } })(),
    required: Object.fromEntries(required.map((n) => [n, loaded.ok || !loaded.missing.includes(n)])),
    describe: c ? c.describe() : null,
    error: loaded.error,
  };
}
