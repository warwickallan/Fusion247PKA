// Fusion Tower — runtime configuration loader. Env NAMES only; NO values committed.
//
// Mirrors the BUILD-002 fcg config house style
// (services/fusion-capture-gateway/src/config.js): read NAMES from process.env,
// never a secret default, mask every secret in every echo, and treat "core
// secret absent" as a valid FIXTURES mode rather than a crash.
//
// ─── FUSION TOWER CREDENTIAL MODEL ───────────────────────────────────────────
// The Tower has ONE core runtime credential and several GATED adapter
// credentials. Absent gated credentials do NOT crash the Tower — the relevant
// adapter runs FAIL-CLOSED in "record-blocker" mode (it emits a structured
// `blocked` result instead of reaching out live). This is what lets WP0 prove
// the whole loop against synthetic substrate with the live wiring gated on
// Warwick-owned secrets.
//
//   CORE (fixturesMode pivots on this):
//     DATABASE_URL          — libpq connection string to the SAME Supabase
//                             project as BUILD-002 but the `ftw` schema. Carries
//                             the Postgres role password inline. SECRET.
//     DATABASE_SSL_CA_FILE  — path to the pinned CA PEM for verify-full TLS to
//                             the Supabase pooler. A PATH, not a secret value.
//
//   GATED ADAPTER CREDENTIALS (absent → that adapter is fail-closed, not fatal):
//     CODEX_API_KEY / OPENAI_API_KEY — OpenAI/Codex controller (gpt_codex). SECRET.
//     GITHUB_TOKEN          — GitHub REST read/write (writes gated). SECRET.
//     CLICKUP_TOKEN         — ClickUp REST read/write. SECRET.
//     TELEGRAM_BOT_TOKEN    — Telegram control channel bot credential. SECRET.
//     AUTHORISED_TELEGRAM_USER_ID — the single authorised numeric user id. Not secret.
//     ANTHROPIC_API_KEY     — optional for the Larry (claude) headless adapter in
//                             `--bare` mode; when absent the adapter falls back to
//                             the machine's ambient claude auth (see larryAdapter).
//
//   HMAC SIGNING SECRETS (per honest principal). Env NAMES held here; the schema's
//   agent_identity.signing_key_ref stores the NAME (pointer), never the value:
//     TOWER_HMAC_SECRET_LARRY, TOWER_HMAC_SECRET_GPT_CODEX, TOWER_HMAC_SECRET_TOWER
//
// NOTHING in this module returns or logs a secret value. `describe()` masks every
// secret. `signingSecretEnvName(principal)` returns the NAME, never the value.

export const CONFIG_KEYS = Object.freeze({
  // CORE runtime.
  DATABASE_URL: 'DATABASE_URL',            // SECRET (Postgres password inline)
  DATABASE_SSL_CA_FILE: 'DATABASE_SSL_CA_FILE', // PATH to pinned CA PEM (not secret)

  // GATED adapter credentials.
  CODEX_API_KEY: 'CODEX_API_KEY',          // SECRET (preferred name)
  OPENAI_API_KEY: 'OPENAI_API_KEY',        // SECRET (accepted alias)
  ANTHROPIC_API_KEY: 'ANTHROPIC_API_KEY',  // SECRET (optional for larry --bare)
  GITHUB_TOKEN: 'GITHUB_TOKEN',            // SECRET
  CLICKUP_TOKEN: 'CLICKUP_TOKEN',          // SECRET
  TELEGRAM_BOT_TOKEN: 'TELEGRAM_BOT_TOKEN',// SECRET
  AUTHORISED_TELEGRAM_USER_ID: 'AUTHORISED_TELEGRAM_USER_ID', // numeric id (not secret)

  // Identity / operational (not secret).
  TOWER_ID: 'TOWER_ID',                    // dispatcher principal label
  GITHUB_REPO: 'GITHUB_REPO',              // 'owner/repo' the Tower governs (read scope)

  // HMAC signing secrets (per principal). SECRET.
  TOWER_HMAC_SECRET_LARRY: 'TOWER_HMAC_SECRET_LARRY',
  TOWER_HMAC_SECRET_GPT_CODEX: 'TOWER_HMAC_SECRET_GPT_CODEX',
  TOWER_HMAC_SECRET_TOWER: 'TOWER_HMAC_SECRET_TOWER',
});

// Every env var that carries a SECRET VALUE. Masked in every echo, never logged.
export const SECRET_KEYS = Object.freeze([
  CONFIG_KEYS.DATABASE_URL,
  CONFIG_KEYS.CODEX_API_KEY,
  CONFIG_KEYS.OPENAI_API_KEY,
  CONFIG_KEYS.ANTHROPIC_API_KEY,
  CONFIG_KEYS.GITHUB_TOKEN,
  CONFIG_KEYS.CLICKUP_TOKEN,
  CONFIG_KEYS.TELEGRAM_BOT_TOKEN,
  CONFIG_KEYS.TOWER_HMAC_SECRET_LARRY,
  CONFIG_KEYS.TOWER_HMAC_SECRET_GPT_CODEX,
  CONFIG_KEYS.TOWER_HMAC_SECRET_TOWER,
]);

// The ONE core credential. Its absence flips the whole Tower into fixtures mode
// (synthetic store + adapters). Everything else is per-adapter gated.
export const CORE_REQUIRED = Object.freeze([CONFIG_KEYS.DATABASE_URL]);

// Map an honest principal → the env NAME of its HMAC signing secret. This is the
// value that agent_identity.signing_key_ref should hold: a POINTER, never a key.
export const PRINCIPAL_SIGNING_ENV = Object.freeze({
  larry: CONFIG_KEYS.TOWER_HMAC_SECRET_LARRY,
  gpt_codex: CONFIG_KEYS.TOWER_HMAC_SECRET_GPT_CODEX,
  tower: CONFIG_KEYS.TOWER_HMAC_SECRET_TOWER,
  // warwick is a human principal and does not sign machine turns.
});

/**
 * Mask a secret for display. Never returns the real value. Absent → "(unset)".
 */
export function maskSecret(value) {
  if (value === null || value === undefined || value === '') return '(unset)';
  return '***set (masked)***';
}

/**
 * Load config from an environment map (defaults to process.env). No throwing:
 * fixtures mode and fail-closed gated adapters are valid, expected WP0 states.
 *
 * Returns a plain object with:
 *   - camelCase accessors (null when absent),
 *   - `fixturesMode` (true when DATABASE_URL absent),
 *   - per-adapter readiness booleans (`codexReady`, `githubReady`, ...),
 *   - `signingSecret(principal)` — returns the VALUE for in-process signing only,
 *   - `signingSecretEnvName(principal)` — returns the NAME (the pointer), never the value,
 *   - `describe()` — a fully-masked snapshot safe to log.
 */
export function loadConfig(env = process.env) {
  const get = (name) => {
    const v = env[name];
    return typeof v === 'string' && v.length > 0 ? v : null;
  };

  const raw = {};
  for (const name of Object.values(CONFIG_KEYS)) raw[name] = get(name);

  const missingCore = CORE_REQUIRED.filter((name) => raw[name] === null);
  const fixturesMode = missingCore.length > 0;

  // Codex accepts either CODEX_API_KEY (preferred) or OPENAI_API_KEY (alias).
  const codexApiKey = raw[CONFIG_KEYS.CODEX_API_KEY] ?? raw[CONFIG_KEYS.OPENAI_API_KEY];

  const config = {
    // Core.
    databaseUrl: raw[CONFIG_KEYS.DATABASE_URL],           // SECRET
    databaseSslCaFile: raw[CONFIG_KEYS.DATABASE_SSL_CA_FILE], // PATH
    // Gated.
    codexApiKey,                                          // SECRET (either name)
    anthropicApiKey: raw[CONFIG_KEYS.ANTHROPIC_API_KEY],  // SECRET (optional)
    githubToken: raw[CONFIG_KEYS.GITHUB_TOKEN],           // SECRET
    clickupToken: raw[CONFIG_KEYS.CLICKUP_TOKEN],         // SECRET
    telegramBotToken: raw[CONFIG_KEYS.TELEGRAM_BOT_TOKEN],// SECRET
    authorisedTelegramUserId: raw[CONFIG_KEYS.AUTHORISED_TELEGRAM_USER_ID],
    // Identity / operational.
    towerId: raw[CONFIG_KEYS.TOWER_ID] ?? 'fusion-tower',
    githubRepo: raw[CONFIG_KEYS.GITHUB_REPO],

    // Metadata.
    missingCore,
    fixturesMode,
    secretKeys: [...SECRET_KEYS],

    // Per-adapter readiness. Absent credential => that adapter is fail-closed.
    codexReady: codexApiKey !== null,
    githubReady: raw[CONFIG_KEYS.GITHUB_TOKEN] !== null,
    githubReadReady: raw[CONFIG_KEYS.GITHUB_TOKEN] !== null, // read can also be unauthenticated (public repo)
    clickupReady: raw[CONFIG_KEYS.CLICKUP_TOKEN] !== null,
    telegramReady:
      raw[CONFIG_KEYS.TELEGRAM_BOT_TOKEN] !== null
      && raw[CONFIG_KEYS.AUTHORISED_TELEGRAM_USER_ID] !== null,

    isRuntimeReady() {
      return missingCore.length === 0;
    },

    /**
     * The signing secret VALUE for a principal — for in-process HMAC only, never
     * logged, never returned to any external surface. Null when the env is unset.
     */
    signingSecret(principal) {
      const name = PRINCIPAL_SIGNING_ENV[principal];
      if (!name) return null;
      return raw[name];
    },

    /** The env NAME (pointer) of a principal's signing secret. Safe to store/log. */
    signingSecretEnvName(principal) {
      return PRINCIPAL_SIGNING_ENV[principal] ?? null;
    },

    /**
     * F-MED-01 — live-mode HMAC posture. In fixtures mode signing is optional
     * (adapters emit honest but unsigned envelopes). In LIVE mode (runtime-ready)
     * every signing principal MUST have its per-principal HMAC secret provisioned,
     * otherwise turn-result integrity verification would silently degrade to
     * fail-open. Returns { ok, missing:[env NAMES] } — NAMES only, never a value,
     * so the caller can fail closed with a safe (masked) fatal message.
     */
    requireLiveSigningSecrets() {
      if (missingCore.length > 0) return { ok: true, missing: [] }; // fixtures — not required
      const missing = [];
      for (const envName of Object.values(PRINCIPAL_SIGNING_ENV)) {
        if (raw[envName] === null) missing.push(envName);
      }
      return { ok: missing.length === 0, missing };
    },

    /** A log-safe snapshot: every secret masked, everything else shown. */
    describe() {
      return {
        DATABASE_URL: maskSecret(raw[CONFIG_KEYS.DATABASE_URL]),
        DATABASE_SSL_CA_FILE: raw[CONFIG_KEYS.DATABASE_SSL_CA_FILE] ?? '(unset)',
        CODEX_API_KEY: maskSecret(codexApiKey),
        ANTHROPIC_API_KEY: maskSecret(raw[CONFIG_KEYS.ANTHROPIC_API_KEY]),
        GITHUB_TOKEN: maskSecret(raw[CONFIG_KEYS.GITHUB_TOKEN]),
        CLICKUP_TOKEN: maskSecret(raw[CONFIG_KEYS.CLICKUP_TOKEN]),
        TELEGRAM_BOT_TOKEN: maskSecret(raw[CONFIG_KEYS.TELEGRAM_BOT_TOKEN]),
        AUTHORISED_TELEGRAM_USER_ID: raw[CONFIG_KEYS.AUTHORISED_TELEGRAM_USER_ID] ?? '(unset)',
        TOWER_ID: raw[CONFIG_KEYS.TOWER_ID] ?? '(unset → fusion-tower)',
        GITHUB_REPO: raw[CONFIG_KEYS.GITHUB_REPO] ?? '(unset)',
        TOWER_HMAC_SECRET_LARRY: maskSecret(raw[CONFIG_KEYS.TOWER_HMAC_SECRET_LARRY]),
        TOWER_HMAC_SECRET_GPT_CODEX: maskSecret(raw[CONFIG_KEYS.TOWER_HMAC_SECRET_GPT_CODEX]),
        TOWER_HMAC_SECRET_TOWER: maskSecret(raw[CONFIG_KEYS.TOWER_HMAC_SECRET_TOWER]),
        fixturesMode,
        readiness: {
          codex: codexApiKey !== null,
          github: raw[CONFIG_KEYS.GITHUB_TOKEN] !== null,
          clickup: raw[CONFIG_KEYS.CLICKUP_TOKEN] !== null,
          telegram:
            raw[CONFIG_KEYS.TELEGRAM_BOT_TOKEN] !== null
            && raw[CONFIG_KEYS.AUTHORISED_TELEGRAM_USER_ID] !== null,
        },
      };
    },
  };

  return config;
}
