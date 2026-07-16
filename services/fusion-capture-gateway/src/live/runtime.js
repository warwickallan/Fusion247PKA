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

import { createInMemoryOperationalStore } from '../store/operationalStore.js';
import { createMockTelegramAdapter } from '../adapters/telegramAdapter.js';
import { createSandboxMarkdownWriter } from '../markdownWriter.js';
import { createIntake } from '../intake.js';
import { createWorker } from '../worker.js';
import { createRateLimiter } from '../security/rateLimiter.js';
import { createAccessLogger } from '../security/accessLog.js';
import { REQUIRED_AT_RUNTIME, DEFAULT_CAPTURE_BRAIN_DIR } from '../config.js';

const FIXTURE_AUTH_ID = 'fixture-user'; // used only when fixtures config omits the id

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
 * string (F-09). TLS required for real Supabase (sslmode=require).
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
    return mod.createPostgresOperationalStore({ connectionString });
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

  // The governed writer lands in the CONFIGURED canonical destination. In WP0
  // this is the sandboxed writer confined to CAPTURE_BRAIN_DIR (default: a
  // clearly-marked capture-inbox) — the governed PKM destination is Larry/Cairn's
  // call; here it is simply configurable and traversal-confined.
  const baseDir = config.captureBrainDir ?? config.captureSandboxDir ?? DEFAULT_CAPTURE_BRAIN_DIR;
  const markdownWriter = createSandboxMarkdownWriter({ baseDir });

  const workerId = config.workerId ?? 'fixture-worker';

  const intake = createIntake({ store, adapter, clock, rateLimiter });
  const worker = createWorker({ store, markdownWriter, adapter, clock, workerId, leaseMs, accessLog });

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
    /** Close any live resources (Postgres pool). No-op for fixtures. */
    async shutdown() {
      if (store && typeof store.end === 'function') await store.end();
    },
  };
}
