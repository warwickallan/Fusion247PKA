// Runtime configuration loader — PLACEHOLDER secret NAMES only (WP0 fixtures).
//
// Source of truth: Builds/BUILD-002-.../Architecture/
//   supabase-operational-foundation-boundary.md §2 (secret handling) and
//   Security/wp0-security-gate.md §2, §6.
//
// FIXTURES ONLY (WP0). This module reads names from process.env. It ships with
// NO real values and NO secret defaults. In fixtures mode the required-at-runtime
// secrets are simply ABSENT — the service runs on synthetic adapters/stores.
//
// Real values (Supabase URL + service_role key, Telegram bot token, the
// authorised Telegram user id) are injected into the environment ONLY AFTER the
// Vex security gate passes (wp0-security-gate.md §6). Never commit real values;
// never echo a secret unmasked (Mack critical rules #1, #6).

// The environment variable NAMES this service understands. Names only — the
// committed .env.example carries these with empty values.
export const CONFIG_KEYS = Object.freeze({
  SUPABASE_URL: 'SUPABASE_URL',
  SUPABASE_SERVICE_ROLE_KEY: 'SUPABASE_SERVICE_ROLE_KEY',
  // The Postgres connection string the SERVER-SIDE worker/intake use to reach the
  // operational store (service_role, server-side only, TLS required for real
  // Supabase — document sslmode=require). Distinct from the REST SUPABASE_URL.
  DATABASE_URL: 'DATABASE_URL',
  TELEGRAM_BOT_TOKEN: 'TELEGRAM_BOT_TOKEN',
  // SECRET — Telegram webhook authenticity token (F-10). Verified constant-time
  // against the X-Telegram-Bot-Api-Secret-Token header on inbound webhooks.
  TELEGRAM_WEBHOOK_SECRET: 'TELEGRAM_WEBHOOK_SECRET',
  WORKER_ID: 'WORKER_ID',
  AUTHORISED_TELEGRAM_USER_ID: 'AUTHORISED_TELEGRAM_USER_ID',
  CAPTURE_SANDBOX_DIR: 'CAPTURE_SANDBOX_DIR',
  // The CONFIGURED canonical capture destination the governed live writer lands
  // in. The governed PKM destination is Larry/Cairn's call — configurable here,
  // defaulting to a clearly-marked capture-inbox path when unset.
  CAPTURE_BRAIN_DIR: 'CAPTURE_BRAIN_DIR',
});

// Which env vars carry a secret. These are masked in every echo and NEVER logged.
export const SECRET_KEYS = Object.freeze([
  CONFIG_KEYS.SUPABASE_SERVICE_ROLE_KEY,
  CONFIG_KEYS.DATABASE_URL, // carries the service_role credential inline
  CONFIG_KEYS.TELEGRAM_BOT_TOKEN,
  CONFIG_KEYS.TELEGRAM_WEBHOOK_SECRET,
]);

// Which env vars must be present for a REAL (non-fixtures) runtime. In fixtures
// mode they are expected absent — their absence is what keeps us pre-gate.
export const REQUIRED_AT_RUNTIME = Object.freeze([
  CONFIG_KEYS.SUPABASE_URL,
  CONFIG_KEYS.SUPABASE_SERVICE_ROLE_KEY,
  // The server-side worker/intake reach the operational store through this.
  CONFIG_KEYS.DATABASE_URL,
  CONFIG_KEYS.TELEGRAM_BOT_TOKEN,
  CONFIG_KEYS.AUTHORISED_TELEGRAM_USER_ID,
  CONFIG_KEYS.WORKER_ID,
]);

// The clearly-marked default capture destination when CAPTURE_BRAIN_DIR is unset
// — NOT the canonical Brain; a governed capture-inbox the writer is confined to.
export const DEFAULT_CAPTURE_BRAIN_DIR = './.capture-inbox';

/**
 * Mask a secret for display. Never returns the real value. Absent → "(unset)".
 * A present value is reduced to a fixed marker so nothing sensitive leaks.
 */
export function maskSecret(value) {
  if (value === null || value === undefined || value === '') return '(unset)';
  return '***set (masked)***';
}

/**
 * Load config from an environment map (defaults to process.env).
 *
 * Returns a plain object with normalised fields plus metadata:
 *   - `missingRequired`: required-at-runtime names that are absent.
 *   - `fixturesMode`: true when any required secret is missing (pre-Vex-gate).
 *   - `isRuntimeReady()`: true only when every required-at-runtime value present.
 *   - `describe()`: a fully-masked snapshot safe to log.
 *
 * No throwing here: fixtures mode is a valid, expected state for WP0.
 */
export function loadConfig(env = process.env) {
  const get = (name) => {
    const v = env[name];
    return typeof v === 'string' && v.length > 0 ? v : null;
  };

  const raw = {
    [CONFIG_KEYS.SUPABASE_URL]: get(CONFIG_KEYS.SUPABASE_URL),
    [CONFIG_KEYS.SUPABASE_SERVICE_ROLE_KEY]: get(CONFIG_KEYS.SUPABASE_SERVICE_ROLE_KEY),
    [CONFIG_KEYS.DATABASE_URL]: get(CONFIG_KEYS.DATABASE_URL),
    [CONFIG_KEYS.TELEGRAM_BOT_TOKEN]: get(CONFIG_KEYS.TELEGRAM_BOT_TOKEN),
    [CONFIG_KEYS.TELEGRAM_WEBHOOK_SECRET]: get(CONFIG_KEYS.TELEGRAM_WEBHOOK_SECRET),
    [CONFIG_KEYS.WORKER_ID]: get(CONFIG_KEYS.WORKER_ID),
    [CONFIG_KEYS.AUTHORISED_TELEGRAM_USER_ID]: get(CONFIG_KEYS.AUTHORISED_TELEGRAM_USER_ID),
    [CONFIG_KEYS.CAPTURE_SANDBOX_DIR]: get(CONFIG_KEYS.CAPTURE_SANDBOX_DIR),
    [CONFIG_KEYS.CAPTURE_BRAIN_DIR]: get(CONFIG_KEYS.CAPTURE_BRAIN_DIR),
  };

  const missingRequired = REQUIRED_AT_RUNTIME.filter((name) => raw[name] === null);
  const fixturesMode = missingRequired.length > 0;

  const config = {
    // Convenience camelCase accessors (values are null in fixtures mode).
    supabaseUrl: raw[CONFIG_KEYS.SUPABASE_URL],
    supabaseServiceRoleKey: raw[CONFIG_KEYS.SUPABASE_SERVICE_ROLE_KEY], // SECRET
    databaseUrl: raw[CONFIG_KEYS.DATABASE_URL], // SECRET (service_role inline)
    telegramBotToken: raw[CONFIG_KEYS.TELEGRAM_BOT_TOKEN], // SECRET
    telegramWebhookSecret: raw[CONFIG_KEYS.TELEGRAM_WEBHOOK_SECRET], // SECRET
    workerId: raw[CONFIG_KEYS.WORKER_ID],
    authorisedTelegramUserId: raw[CONFIG_KEYS.AUTHORISED_TELEGRAM_USER_ID],
    captureSandboxDir: raw[CONFIG_KEYS.CAPTURE_SANDBOX_DIR],
    captureBrainDir: raw[CONFIG_KEYS.CAPTURE_BRAIN_DIR] ?? DEFAULT_CAPTURE_BRAIN_DIR,

    // Metadata.
    missingRequired,
    fixturesMode,
    requiredAtRuntime: [...REQUIRED_AT_RUNTIME],
    secretKeys: [...SECRET_KEYS],

    isRuntimeReady() {
      return missingRequired.length === 0;
    },

    /** A log-safe snapshot: secrets masked, everything else shown. */
    describe() {
      return {
        SUPABASE_URL: raw[CONFIG_KEYS.SUPABASE_URL] ?? '(unset)',
        SUPABASE_SERVICE_ROLE_KEY: maskSecret(raw[CONFIG_KEYS.SUPABASE_SERVICE_ROLE_KEY]),
        DATABASE_URL: maskSecret(raw[CONFIG_KEYS.DATABASE_URL]),
        TELEGRAM_BOT_TOKEN: maskSecret(raw[CONFIG_KEYS.TELEGRAM_BOT_TOKEN]),
        TELEGRAM_WEBHOOK_SECRET: maskSecret(raw[CONFIG_KEYS.TELEGRAM_WEBHOOK_SECRET]),
        WORKER_ID: raw[CONFIG_KEYS.WORKER_ID] ?? '(unset)',
        AUTHORISED_TELEGRAM_USER_ID: raw[CONFIG_KEYS.AUTHORISED_TELEGRAM_USER_ID] ?? '(unset)',
        CAPTURE_SANDBOX_DIR: raw[CONFIG_KEYS.CAPTURE_SANDBOX_DIR] ?? '(unset)',
        CAPTURE_BRAIN_DIR: raw[CONFIG_KEYS.CAPTURE_BRAIN_DIR] ?? `(unset → ${DEFAULT_CAPTURE_BRAIN_DIR})`,
        fixturesMode,
        missingRequired,
      };
    },
  };

  return config;
}
