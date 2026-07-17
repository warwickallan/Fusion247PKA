// Runtime configuration loader — env NAMES only (no values committed).
//
// Source of truth: Builds/BUILD-002-.../Architecture/
//   supabase-operational-foundation-boundary.md §2 (secret handling) and
//   Security/wp0-security-gate.md §2, §6.
//
// This module reads NAMES from process.env. It ships with NO real values and NO
// secret defaults. In fixtures mode the required-at-runtime secrets are simply
// ABSENT — the service runs on synthetic adapters/stores.
//
// ─── CREDENTIAL MODEL (corrected — PREPROVISION-CORRECTION-0001 §1) ───────────
// Three DISTINCT access surfaces that WP0 previously blurred together. Keeping
// them separate is what lets us avoid asking Warwick for credentials the code
// does not actually use:
//
//   A. BUILD-TIME PROJECT ACCESS — Larry administers the Supabase project and
//      applies migrations through the project-scoped Supabase MCP (browser OAuth
//      by Warwick). This is NOT an env var here: it is tool access, not a secret
//      the running service reads. No Supabase password or personal access token
//      is ever requested.
//
//   B. DATABASE RUNTIME ACCESS — the ONLY credential the running WP0 service
//      needs: DATABASE_URL. It carries the POSTGRES CONNECTION CREDENTIALS from
//      the Supabase "Connect" screen (the project DATABASE PASSWORD), TLS
//      required for real Supabase (sslmode=require). It is NOT a service_role
//      API key and NOT a service_role "password" — it is the database role's
//      password in a libpq connection string.
//
//   C. SUPABASE DATA API KEYS — SUPABASE_URL + a Supabase secret/publishable key
//      are needed ONLY if code calls the Supabase REST/Data API. The current
//      runtime (createLiveRuntime → Postgres store over DATABASE_URL) does NOT
//      use them, so they are RESERVED/optional, NOT required, and NOT requested.
//      If a future WP genuinely needs Data API access, prefer Supabase's current
//      publishable/secret key model over the legacy anon/service_role keys, and
//      document the compatibility decision at that point.

// The environment variable NAMES this service understands. Names only — the
// committed .env.example carries these with empty values.
export const CONFIG_KEYS = Object.freeze({
  // (B) DATABASE RUNTIME ACCESS — the one runtime credential WP0 needs. A libpq
  // connection string carrying the Postgres role password (Supabase Connect →
  // "Connection string"). TLS required for real Supabase (?sslmode=require).
  DATABASE_URL: 'DATABASE_URL',
  // Telegram bot token (SECRET — a full bot account credential). Masked always.
  TELEGRAM_BOT_TOKEN: 'TELEGRAM_BOT_TOKEN',
  // The local worker's identity/principal (least-privilege label, not a secret).
  WORKER_ID: 'WORKER_ID',
  // Single authorised Telegram NUMERIC user id (allowlist of one). Not a secret.
  AUTHORISED_TELEGRAM_USER_ID: 'AUTHORISED_TELEGRAM_USER_ID',
  // The CONFIGURED governed capture destination the live writer lands in. When
  // unset in LIVE mode it resolves to the authority-backed governed inbox
  // (repo `Team Inbox/`, see live/runtime.js). Not a secret.
  CAPTURE_BRAIN_DIR: 'CAPTURE_BRAIN_DIR',
  // Legacy fixtures sandbox override (throwaway path). Not a secret.
  CAPTURE_SANDBOX_DIR: 'CAPTURE_SANDBOX_DIR',

  // ── (C) RESERVED / OPTIONAL — Supabase Data API. NOT required for WP0, NOT
  //        requested from Warwick. Present only so a future Data-API path has a
  //        stable name and so any accidentally-set value is masked in diagnostics.
  SUPABASE_URL: 'SUPABASE_URL',
  SUPABASE_SECRET_KEY: 'SUPABASE_SECRET_KEY', // modern secret key (server-side)
  // ── OPTIONAL — webhook authenticity token (F-10). Needed ONLY for the FUTURE
  //    webhook transport; the WP0 proof uses getUpdates long polling and does
  //    NOT require it (PREPROVISION-CORRECTION-0001 §2).
  TELEGRAM_WEBHOOK_SECRET: 'TELEGRAM_WEBHOOK_SECRET',
});

// Which env vars carry a secret. Masked in every echo and NEVER logged. Includes
// the optional/reserved secrets so that IF one is ever set it is still masked.
export const SECRET_KEYS = Object.freeze([
  CONFIG_KEYS.DATABASE_URL,          // carries the Postgres DB password inline
  CONFIG_KEYS.TELEGRAM_BOT_TOKEN,
  CONFIG_KEYS.SUPABASE_SECRET_KEY,   // optional/reserved
  CONFIG_KEYS.TELEGRAM_WEBHOOK_SECRET, // optional/reserved (webhook only)
]);

// Which env vars MUST be present for a REAL (non-fixtures) runtime. This is the
// MINIMAL set for the WP0 long-poll live proof — NOT the blurred old list.
// Deliberately excludes SUPABASE_URL / any Supabase API key (unused by the
// Postgres-over-DATABASE_URL runtime) and TELEGRAM_WEBHOOK_SECRET (webhook-only).
export const REQUIRED_AT_RUNTIME = Object.freeze([
  CONFIG_KEYS.DATABASE_URL,
  CONFIG_KEYS.TELEGRAM_BOT_TOKEN,
  CONFIG_KEYS.AUTHORISED_TELEGRAM_USER_ID,
  CONFIG_KEYS.WORKER_ID,
]);

// The clearly-marked FIXTURES default when CAPTURE_BRAIN_DIR is unset — NOT the
// canonical Brain; a throwaway capture-inbox the writer is confined to. In LIVE
// mode the runtime resolves the authority-backed governed inbox instead.
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
    // (B) runtime DB credential + (WP0-required) Telegram/worker identity.
    [CONFIG_KEYS.DATABASE_URL]: get(CONFIG_KEYS.DATABASE_URL),
    [CONFIG_KEYS.TELEGRAM_BOT_TOKEN]: get(CONFIG_KEYS.TELEGRAM_BOT_TOKEN),
    [CONFIG_KEYS.WORKER_ID]: get(CONFIG_KEYS.WORKER_ID),
    [CONFIG_KEYS.AUTHORISED_TELEGRAM_USER_ID]: get(CONFIG_KEYS.AUTHORISED_TELEGRAM_USER_ID),
    [CONFIG_KEYS.CAPTURE_BRAIN_DIR]: get(CONFIG_KEYS.CAPTURE_BRAIN_DIR),
    [CONFIG_KEYS.CAPTURE_SANDBOX_DIR]: get(CONFIG_KEYS.CAPTURE_SANDBOX_DIR),
    // (C) reserved/optional — Data API + webhook. Read so they mask if ever set.
    [CONFIG_KEYS.SUPABASE_URL]: get(CONFIG_KEYS.SUPABASE_URL),
    [CONFIG_KEYS.SUPABASE_SECRET_KEY]: get(CONFIG_KEYS.SUPABASE_SECRET_KEY),
    [CONFIG_KEYS.TELEGRAM_WEBHOOK_SECRET]: get(CONFIG_KEYS.TELEGRAM_WEBHOOK_SECRET),
  };

  const missingRequired = REQUIRED_AT_RUNTIME.filter((name) => raw[name] === null);
  const fixturesMode = missingRequired.length > 0;

  const config = {
    // Convenience camelCase accessors (values are null in fixtures mode).
    databaseUrl: raw[CONFIG_KEYS.DATABASE_URL], // SECRET (Postgres DB password inline)
    telegramBotToken: raw[CONFIG_KEYS.TELEGRAM_BOT_TOKEN], // SECRET
    workerId: raw[CONFIG_KEYS.WORKER_ID],
    authorisedTelegramUserId: raw[CONFIG_KEYS.AUTHORISED_TELEGRAM_USER_ID],
    // Left NULL when unset so live/runtime.js can resolve the authority-backed
    // governed inbox (repo `Team Inbox/`) instead of a throwaway default.
    captureBrainDir: raw[CONFIG_KEYS.CAPTURE_BRAIN_DIR],
    captureSandboxDir: raw[CONFIG_KEYS.CAPTURE_SANDBOX_DIR],
    // (C) reserved/optional — unused by the WP0 Postgres-over-DATABASE_URL path.
    supabaseUrl: raw[CONFIG_KEYS.SUPABASE_URL],
    supabaseSecretKey: raw[CONFIG_KEYS.SUPABASE_SECRET_KEY], // SECRET (optional)
    telegramWebhookSecret: raw[CONFIG_KEYS.TELEGRAM_WEBHOOK_SECRET], // SECRET (webhook only)

    // Metadata.
    missingRequired,
    fixturesMode,
    requiredAtRuntime: [...REQUIRED_AT_RUNTIME],
    secretKeys: [...SECRET_KEYS],
    defaultCaptureBrainDir: DEFAULT_CAPTURE_BRAIN_DIR,

    isRuntimeReady() {
      return missingRequired.length === 0;
    },

    /** A log-safe snapshot: secrets masked, everything else shown. */
    describe() {
      return {
        // Required (WP0):
        DATABASE_URL: maskSecret(raw[CONFIG_KEYS.DATABASE_URL]),
        TELEGRAM_BOT_TOKEN: maskSecret(raw[CONFIG_KEYS.TELEGRAM_BOT_TOKEN]),
        WORKER_ID: raw[CONFIG_KEYS.WORKER_ID] ?? '(unset)',
        AUTHORISED_TELEGRAM_USER_ID: raw[CONFIG_KEYS.AUTHORISED_TELEGRAM_USER_ID] ?? '(unset)',
        CAPTURE_BRAIN_DIR: raw[CONFIG_KEYS.CAPTURE_BRAIN_DIR] ?? '(unset → governed Team Inbox in live mode)',
        CAPTURE_SANDBOX_DIR: raw[CONFIG_KEYS.CAPTURE_SANDBOX_DIR] ?? '(unset)',
        // Reserved/optional (masked if ever set):
        SUPABASE_URL: raw[CONFIG_KEYS.SUPABASE_URL] ?? '(unset — not required for WP0)',
        SUPABASE_SECRET_KEY: maskSecret(raw[CONFIG_KEYS.SUPABASE_SECRET_KEY]),
        TELEGRAM_WEBHOOK_SECRET: maskSecret(raw[CONFIG_KEYS.TELEGRAM_WEBHOOK_SECRET]),
        fixturesMode,
        missingRequired,
      };
    },
  };

  return config;
}
