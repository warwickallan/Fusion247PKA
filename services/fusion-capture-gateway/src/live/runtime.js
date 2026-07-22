// F-09 — LIVE runtime assembly + fixtures/live component selection.
//
// Source of truth: supabase-operational-foundation-boundary.md §3 (server-side
// worker authenticates to the store with the service_role credential; markdown
// stays canonical) and wp0-security-gate.md §1/§2/§5/§6.
//
// This module ASSEMBLES the running system from managed config (env NAMES only,
// via config.js). It selects EITHER the fixtures pair (in-memory store + mock
// adapter) OR the live pair (Postgres store + live Telegram adapter), so intake
// and the worker run UNCHANGED against both.
//
// CI-SAFETY (critical): the Postgres store and — to keep the surface symmetric —
// the live adapter are imported DYNAMICALLY, only inside the live branch. Nothing
// the unit suite loads statically imports `pg` or opens a socket. Importing THIS
// module is dependency-free; only selectStoreAndAdapter()'s live branch reaches
// for pg (transitively, via the postgres store's own dynamic import).
//
// IDENTITY OWNERSHIP FIX: the authorised sender's channel_identity registration
// belongs HERE (runtime/intake), not in the store. Silas flagged that the
// Postgres store self-registers on recordIntake today as a STOPGAP. ensure-
// AuthorisedIdentity() is the designated owner going forward.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createInMemoryOperationalStore } from '../store/operationalStore.js';
import { createMockTelegramAdapter } from '../adapters/telegramAdapter.js';
import { createSandboxMarkdownWriter } from '../markdownWriter.js';
import { createIntake } from '../intake.js';
import { createWorker } from '../worker.js';
import { createRateLimiter } from '../security/rateLimiter.js';
import { createAccessLogger } from '../security/accessLog.js';
import { REQUIRED_AT_RUNTIME, DEFAULT_CAPTURE_BRAIN_DIR } from '../config.js';

const FIXTURE_AUTH_ID = 'fixture-user'; // used only when fixtures config omits the id

// ── Governed Markdown destination (PREPROVISION-CORRECTION-0001 §5) ──────────
// The authority-backed governed capture landing zone is the repo's `Team Inbox/`
// (root AGENTS.md: "where the user drops raw inputs for Larry to route. Penn
// picks them up and files into PKM." + Team Inbox/README.md). The mechanical
// worker performs the governed write there — it lands the raw capture; it does
// NOT decide the semantic PKM destination (that is Larry/Penn/Cairn's later
// triage, per source-of-truth-and-authority-matrix §1). Live captures land in
// `Team Inbox/captures/<capture_id>.md`, namespaced apart from hand-dropped files.
const HERE = path.dirname(fileURLToPath(import.meta.url)); // <repo>/services/fusion-capture-gateway/src/live
const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..'); // up: live→src→service→services→repo
export const GOVERNED_BRAIN_DIR = path.join(REPO_ROOT, 'Team Inbox');
export const GOVERNED_CAPTURE_SUBDIR = 'captures';

/**
 * Resolve the governed Markdown base dir + leaf subdir for the given mode.
 *  - explicit CAPTURE_BRAIN_DIR (operator override) wins in either mode;
 *  - legacy CAPTURE_SANDBOX_DIR next;
 *  - LIVE with nothing set → the authority-backed governed `Team Inbox/`;
 *  - FIXTURES with nothing set → the clearly-marked throwaway default.
 * Live always uses the 'captures' leaf; fixtures keep the default 'inbox' leaf.
 */
export function resolveGovernedDestination(config, mode) {
  const explicit = config.captureBrainDir ?? config.captureSandboxDir ?? null;
  if (explicit) {
    return { baseDir: explicit, subdir: mode === 'live' ? GOVERNED_CAPTURE_SUBDIR : 'inbox' };
  }
  if (mode === 'live') {
    return { baseDir: GOVERNED_BRAIN_DIR, subdir: GOVERNED_CAPTURE_SUBDIR };
  }
  return { baseDir: DEFAULT_CAPTURE_BRAIN_DIR, subdir: 'inbox' };
}

/**
 * Build the authorised sender's channel-identity descriptor. Pure — the single
 * definition of "who is allowed", owned by the runtime, not the store.
 *
 * @param {string|number} authorisedUserId
 * @returns {{ identity_ref:string, channel:string, channel_principal_ref:string, is_authorised:true }}
 */
export function buildAuthorisedIdentity(authorisedUserId) {
  if (authorisedUserId === undefined || authorisedUserId === null || authorisedUserId === '') {
    throw new Error('buildAuthorisedIdentity: authorisedUserId required');
  }
  const id = String(authorisedUserId);
  return {
    identity_ref: `telegram:user:${id}`,
    channel: 'telegram',
    channel_principal_ref: id,
    is_authorised: true,
  };
}

/**
 * Assert the live config carries every required env NAME. Throws a clear error
 * naming ONLY the missing NAMES — never a value (no secret can leak here).
 */
export function assertLiveConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('assertLiveConfig: config required');
  }
  // A loadConfig() result always carries `missingRequired` (the required env
  // NAMES that are absent). Trust it — including an empty array meaning "all
  // present". Its contents are NAMES only (never values), enumerated from
  // REQUIRED_AT_RUNTIME, so nothing sensitive can be printed.
  const missing = config.missingRequired;
  if (!Array.isArray(missing)) {
    throw new Error(
      'assertLiveConfig: config.missingRequired must be an array — pass a loadConfig() result '
      + `(required NAMES: ${REQUIRED_AT_RUNTIME.join(', ')})`,
    );
  }
  if (missing.length > 0) {
    // NAMES only — explicitly no values.
    throw new Error(`live runtime config missing required env NAME(s): ${missing.join(', ')}`);
  }
  return true;
}

/**
 * Ensure the authorised channel identity is registered. Ownership now lives in
 * the runtime (not the store). Idempotent + no-throw when the store does not
 * expose a registration method (e.g. the in-memory fixture) — in that WP0 case
 * the Postgres store's self-registration remains the documented stopgap.
 *
 * @param {object} args
 * @param {object} args.store            operational store
 * @param {string|number} args.authorisedUserId
 * @returns {{ identity:object, registered:boolean, ownedBy:'runtime' }}
 */
export async function ensureAuthorisedIdentity({ store, authorisedUserId } = {}) {
  const identity = buildAuthorisedIdentity(authorisedUserId);
  let registered = false;
  if (store && typeof store.registerChannelIdentity === 'function') {
    await store.registerChannelIdentity(identity);
    registered = true;
  }
  return { identity, registered, ownedBy: 'runtime' };
}

/**
 * Select the store + adapter pair for the given config.
 *
 * fixtures mode (config.fixturesMode truthy) → in-memory store + mock adapter,
 * constructed synchronously-in-a-promise, NO dynamic pg import, NO socket.
 *
 * live mode → validate required NAMES, then DYNAMICALLY import the Postgres store
 * (which itself dynamically imports pg) + the live Telegram adapter, and build
 * them. The worker authenticates to the store via the service_role connection
 * string (F-09). TLS for real Supabase is verify-full with the PINNED pooler CA
 * (FU-1): DATABASE_SSL_CA_FILE activates the explicit `ssl` config-object form
 * (src/store/pgSslConfig.js); otherwise the DSN itself must spell
 * `sslmode=verify-full&sslrootcert=<ca>` — a bare require-mode DSN never
 * verifies the CA in node-postgres (Pax Q5) and fails the static guard test.
 *
 * Factory overrides (storeFactory/adapterFactory) let a live-path test inject
 * doubles WITHOUT a real connection; production leaves them undefined.
 *
 * @returns {Promise<{ mode:'fixtures'|'live', store:object, adapter:object }>}
 */
export async function selectStoreAndAdapter(config, { storeFactory, adapterFactory, accessLog } = {}) {
  if (!config || typeof config !== 'object') {
    throw new Error('selectStoreAndAdapter: config required');
  }

  if (config.fixturesMode) {
    const store = createInMemoryOperationalStore();
    const adapter = createMockTelegramAdapter({
      authorisedUserId: config.authorisedTelegramUserId ?? FIXTURE_AUTH_ID,
    });
    return { mode: 'fixtures', store, adapter };
  }

  // LIVE. Fail-closed on any missing required NAME before touching the network.
  assertLiveConfig(config);

  // DYNAMIC imports — reached ONLY on the live path, never by the unit suite.
  const makeStore = storeFactory ?? (async ({ connectionString }) => {
    const mod = await import('../store/postgresOperationalStore.js');
    // FU-1: when DATABASE_SSL_CA_FILE is set, read the pinned CA once at
    // startup and hand pg an explicit verify-full ssl object (the DSN's own
    // ssl params are stripped so they can never replace the pinned CA).
    const sslMod = await import('../store/pgSslConfig.js');
    const sslCfg = sslMod.buildPgSslConfig({
      connectionString,
      sslCaFile: config.databaseSslCaFile ?? null,
    });
    return mod.createPostgresOperationalStore({
      connectionString: sslCfg.connectionString,
      poolConfig: sslCfg.poolConfig,
    });
  });
  const makeAdapter = adapterFactory ?? (async ({ botToken, authorisedUserId }) => {
    const mod = await import('../adapters/telegramLiveAdapter.js');
    return mod.createLiveTelegramAdapter({ botToken, authorisedUserId, accessLog });
  });

  const store = await makeStore({ connectionString: config.databaseUrl });
  const adapter = await makeAdapter({
    botToken: config.telegramBotToken,
    authorisedUserId: config.authorisedTelegramUserId,
  });
  return { mode: 'live', store, adapter };
}

/**
 * Assemble the full runtime: store + adapter + intake + worker + governed writer
 * + F-04 rate limiter + F-05 access logger, wired together. Works in BOTH modes.
 *
 * @param {object} config          a loadConfig() result.
 * @param {object} [opts]
 * @param {object} [opts.clock]    { now: () => number }. Default: Date.now-backed.
 * @param {number} [opts.leaseMs]  worker claim lease (default 30_000).
 * @param {object} [opts.rateLimit]  { capacity, refillPerSec } for F-04.
 * @param {object} [opts.accessSink]  custom access-log sink (default stderr).
 * @param {object} [opts.factories]  { storeFactory, adapterFactory } test hooks.
 * @returns {Promise<object>} runtime handles.
 */
export async function createLiveRuntime(config, opts = {}) {
  const clock = opts.clock ?? { now: () => Date.now() };
  const leaseMs = opts.leaseMs ?? 30_000;
  const rateLimit = opts.rateLimit ?? { capacity: 20, refillPerSec: 1 };

  const accessLog = createAccessLogger({ sink: opts.accessSink });
  const rateLimiter = createRateLimiter(rateLimit);

  const { mode, store, adapter } = await selectStoreAndAdapter(config, {
    ...(opts.factories ?? {}),
    accessLog,
  });

  // The governed writer lands in the authority-backed governed destination
  // (§5). In live mode with nothing configured this is the repo `Team Inbox/`
  // (Team Inbox/captures/<capture_id>.md); in fixtures it is the throwaway
  // default. Traversal-confined by the writer either way.
  const { baseDir, subdir } = resolveGovernedDestination(config, mode);
  const markdownWriter = createSandboxMarkdownWriter({ baseDir, subdir });

  // WP2 spine YouTube route — FEATURE-FLAGGED (default OFF). When HUB_YOUTUBE_ROUTE=1 the governed
  // writer becomes a routing writer that sends a YouTube capture to the extract→RAW→youtube_source
  // lane and everything else to the plain markdown writer, UNCHANGED. Dynamically imported so the
  // unit suite never loads pg / spawns TubeAIR (same discipline as the Postgres store). Enabling is
  // a deliberate switch: set the flag, restart, and stop the standalone auto-detect poller.
  let governedWriter = markdownWriter;
  let closeRouting = null;
  if (mode === 'live' && process.env.HUB_YOUTUBE_ROUTE === '1') {
    const mod = await import('../../../hub/router/liveDeps.mjs');
    const routing = await mod.createLiveYoutubeRoutingWriter({ markdownWriter });
    governedWriter = routing.writer;
    closeRouting = routing.close;
  }

  const workerId = config.workerId ?? 'fixture-worker';

  const intake = createIntake({ store, adapter, clock, rateLimiter });
  const worker = createWorker({ store, markdownWriter: governedWriter, adapter, clock, workerId, leaseMs, accessLog });

  // Identity registration ownership lives here, not in the store.
  const authorisedIdentity = await ensureAuthorisedIdentity({
    store,
    authorisedUserId: config.authorisedTelegramUserId ?? FIXTURE_AUTH_ID,
  });

  return {
    mode,
    store,
    adapter,
    markdownWriter,
    intake,
    worker,
    accessLog,
    rateLimiter,
    authorisedIdentity,
    /** Close any live resources (Postgres pool + routing writer pool). No-op for fixtures. */
    async shutdown() {
      if (closeRouting) await closeRouting();
      if (store && typeof store.end === 'function') await store.end();
    },
  };
}
