// Tower baton — secret-home configuration loader.
//
// SECRET HOME (persistent, session-independent): C:\.fusion247\ .
// ALL secrets come from env files under the secret home, read BY NAME, masked in
// every echo, NEVER written to the repo / a log / a ClickUp comment. This module
// reads NAMES only; it ships with NO real values and NO secret defaults.
//
// Required names (per the BUILD-010 baton brief):
//   CLICKUP_TOKEN               — ClickUp personal API token (NEW; may be ABSENT
//                                 tonight → clickupReady=false, fail-closed blocker).
//   TELEGRAM_BOT_TOKEN          — outbound milestone notifier (exists in
//                                 fusion-capture-gateway.env). SECRET.
//   AUTHORISED_TELEGRAM_USER_ID — single authorised numeric user id (not a secret).
// Optional:
//   GITHUB_REPO                 — 'owner/repo' the Tower governs (read scope).
//   TOWER_HMAC_SECRET_GPT_CODEX — per-principal HMAC signing secret (verdict).
//
// GitHub auth is NOT an env var here: it is the `gh` CLI keyring session for the
// interactive Buggly user (githubEvidence shells out to `gh`/`git`). Codex auth is
// the ChatGPT-OAuth session under %USERPROFILE%\.codex (codexAdapter discovers it).

import nodeFs from 'node:fs';
import path from 'node:path';

// The persistent secret home. Overridable via FUSION247_HOME for hermetic tests.
export const SECRET_HOME = process.env.FUSION247_HOME || 'C:\\.fusion247';

// Env files searched under the secret home, in precedence order (earlier wins).
// A dedicated tower-baton.env is the preferred home for CLICKUP_TOKEN; the
// capture-gateway file already holds TELEGRAM_BOT_TOKEN + AUTHORISED_TELEGRAM_USER_ID.
//
// NOTE (2026-07-18): the strict machine loader reads *.env files ONLY. Warwick's
// `C:\.fusion247\.env keys\*.txt` files are his HUMAN credential notes ("Tower Name =
// …", "Tower token = …", "Shopper …") — label=value, not machine KEY=VALUE — and are
// deliberately NOT in this list: including one made the malformed-file detector
// (correctly) fail-close the whole loader. Those notes are the SOURCE for values to
// copy into a proper *.env file. Wiring Tower to its OWN bot (the "Tower" token) vs the
// existing FusionDevBot is a pending Warwick decision — do NOT guess it. Once decided,
// the chosen bot token goes into tower-baton.env in real env syntax.
export const DEFAULT_ENV_FILES = Object.freeze([
  'tower-baton.env',
  'fusion-capture-gateway.env',
]);

export const SECRET_KEYS = Object.freeze([
  'CLICKUP_TOKEN',
  'TELEGRAM_BOT_TOKEN',
  'TOWER_HMAC_SECRET_GPT_CODEX',
]);

/** Mask a secret for display. Never returns the real value. Absent → "(unset)". */
export function maskSecret(value) {
  if (value === null || value === undefined || value === '') return '(unset)';
  return '***set (masked)***';
}

/**
 * Parse a KEY=VALUE env file body. Ignores blank lines, `#` comments, and a
 * leading `export `. Strips one layer of matching single/double quotes. Values
 * themselves are never logged by this module.
 */
export function parseEnvBody(body) {
  const out = {};
  for (const rawLine of String(body ?? '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const noExport = line.startsWith('export ') ? line.slice(7) : line;
    const eq = noExport.indexOf('=');
    if (eq <= 0) continue;
    const key = noExport.slice(0, eq).trim();
    let val = noExport.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"') && val.length >= 2) ||
      (val.startsWith("'") && val.endsWith("'") && val.length >= 2)
    ) {
      val = val.slice(1, -1);
    }
    if (key) out[key] = val;
  }
  return out;
}

/** Read + merge the secret-home env files (earlier file wins). Missing files skipped. */
export function readEnvFiles({ home = SECRET_HOME, files = DEFAULT_ENV_FILES, fs = nodeFs } = {}) {
  const merged = {};
  for (const rel of files) {
    const full = path.isAbsolute(rel) ? rel : path.join(home, rel);
    let body;
    try {
      if (!fs.existsSync(full)) continue;
      body = fs.readFileSync(full, 'utf8');
    } catch {
      continue; // an unreadable file is treated as absent (fail-closed on the KEY, not a crash)
    }
    const parsed = parseEnvBody(body);
    for (const [k, v] of Object.entries(parsed)) {
      if (!(k in merged)) merged[k] = v; // earlier file wins
    }
  }
  return merged;
}

/**
 * Load config. process.env overrides the secret-home files (so a live shell or a
 * hermetic test can inject values without touching disk). No throwing: an absent
 * CLICKUP_TOKEN is a valid, expected fail-closed state, not a crash.
 */
export function loadConfig({ env = process.env, home = SECRET_HOME, files = DEFAULT_ENV_FILES, fs = nodeFs } = {}) {
  const fileEnv = readEnvFiles({ home, files, fs });
  const get = (name) => {
    const fromEnv = env?.[name];
    if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv;
    const fromFile = fileEnv?.[name];
    return typeof fromFile === 'string' && fromFile.length > 0 ? fromFile : null;
  };

  const clickupToken = get('CLICKUP_TOKEN');
  const telegramBotToken = get('TELEGRAM_BOT_TOKEN');
  const authorisedTelegramUserId = get('AUTHORISED_TELEGRAM_USER_ID');
  const githubRepo = get('GITHUB_REPO');
  const codexHmacSecret = get('TOWER_HMAC_SECRET_GPT_CODEX');

  // TOWER_AUTHORISED_AUTHOR_IDS — comma-separated ClickUp user ids permitted to author a
  // checkpoint that the watcher will act on. NOT a secret (ids, not credentials): shown in
  // describe(). In live use this is Warwick's ClickUp user id (222204263), since checkpoints
  // are posted under his personal CLICKUP_TOKEN. Empty/absent → the author gate is
  // UNCONFIGURED and the watcher fails closed (no default-open).
  const authorisedAuthorIds = String(get('TOWER_AUTHORISED_AUTHOR_IDS') ?? '')
    .split(',').map((s) => s.trim()).filter(Boolean);

  const secretValues = [clickupToken, telegramBotToken, codexHmacSecret]
    .filter((v) => typeof v === 'string' && v.length > 0);

  return {
    secretHome: home,
    clickupToken,               // SECRET — never logged
    telegramBotToken,           // SECRET — never logged
    authorisedTelegramUserId,   // POINTER — safe
    githubRepo,                 // 'owner/repo' — safe
    codexHmacSecret,            // SECRET — never logged
    authorisedAuthorIds,        // POINTER list — safe (checkpoint-author allowlist)

    clickupReady: clickupToken !== null,
    telegramReady: telegramBotToken !== null && authorisedTelegramUserId !== null,

    // The checkpoint-author gate is CONFIGURED only when at least one id is present.
    // Unconfigured → the watcher fails closed (defence in depth over the text marker).
    authorGateConfigured: authorisedAuthorIds.length > 0,

    /** Is this ClickUp user id an authorised checkpoint author? Fail-closed (no default-open). */
    isAuthorisedAuthor(userId) {
      if (authorisedAuthorIds.length === 0) return false;
      if (userId === null || userId === undefined || userId === '') return false;
      return authorisedAuthorIds.includes(String(userId));
    },

    /** Signing secret VALUE for a principal (in-process HMAC only). Null when unset. */
    signingSecret(principal) {
      return principal === 'gpt_codex' ? codexHmacSecret : null;
    },

    /**
     * Fail-closed gate for the ClickUp credential. Returns { ok, blocker } — the
     * blocker is a clear, secret-free "CLICKUP_TOKEN missing" message the watcher
     * surfaces instead of crashing.
     */
    requireClickup() {
      if (clickupToken) return { ok: true, blocker: null };
      return {
        ok: false,
        blocker:
          'CLICKUP_TOKEN missing — add it to a secret-home env file '
          + `(e.g. ${path.join(home, 'tower-baton.env')}) as CLICKUP_TOKEN=<personal API token>. `
          + 'The Tower watcher fails closed without it (no ClickUp read/write); it never crashes.',
      };
    },

    /**
     * Build a secret-VALUE redactor: replaces every known secret value with a fixed
     * marker so no secret can surface in a log line or thrown error. The ONE
     * redaction path used everywhere the config touches output.
     */
    redact(msg) {
      let out = typeof msg === 'string' ? msg : String(msg ?? '');
      for (const secret of secretValues) out = out.split(secret).join('***redacted***');
      return out;
    },

    /** A log-safe snapshot: every secret masked, everything else shown. */
    describe() {
      return {
        SECRET_HOME: home,
        CLICKUP_TOKEN: maskSecret(clickupToken),
        TELEGRAM_BOT_TOKEN: maskSecret(telegramBotToken),
        AUTHORISED_TELEGRAM_USER_ID: authorisedTelegramUserId ?? '(unset)',
        GITHUB_REPO: githubRepo ?? '(unset)',
        TOWER_AUTHORISED_AUTHOR_IDS: authorisedAuthorIds.length ? authorisedAuthorIds.join(',') : '(unset)',
        TOWER_HMAC_SECRET_GPT_CODEX: maskSecret(codexHmacSecret),
        clickupReady: clickupToken !== null,
        telegramReady: telegramBotToken !== null && authorisedTelegramUserId !== null,
      };
    },
  };
}
