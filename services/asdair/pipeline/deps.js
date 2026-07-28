// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/deps.js
//
// THE WIRING. Every component the pipeline joins is reached through ONE
// injectable container, so:
//
//   * the real runtime binds the real modules, and
//   * the whole test suite binds fakes and runs FULLY OFFLINE - no database,
//     no Telegram, no ASDA, no model gateway, no credentials file.
//
// Nothing in commands.js, runPipeline.js or runtime.js imports a component
// directly. That is not tidiness: it is what makes "prove this without touching
// Warwick's household data" possible at all.
//
// ── CREDENTIALS ─────────────────────────────────────────────────────────────
// This module knows env var NAMES and nothing else. It never opens, parses,
// prints or inspects a credentials file; values arrive via `node --env-file=`.
//
//   ASDAIR_DB_URL         SELECT-only (asdair_ro)  - every read
//   ASDAIR_WRITE_DB_URL   asdair_rw                - every write
//   SHOPPER_BOT_TOKEN     SECRET                   - the ShopperBot account
//   SHOPPER_CHAT_ID                                - the control-surface chat
//   FUSION_MODEL_VISION                            - the grounded vision model
//
// The write URL is never read HERE: shopStore, recordConfirmation and
// updateRegulars each take it from the environment themselves, exactly as they
// already do. This module does not centralise a secret that is currently spread
// safely.
// =====================================================================

import { createRequire } from 'node:module';
import { decideNextStep } from './stages.js';

const require = createRequire(import.meta.url);

// CommonJS components, loaded through createRequire so the ESM pipeline and the
// CJS components can live side by side without either changing module system.
const shopStore = require('../shop/shopStore.js');
const shopState = require('../shop/shopState.js');
const shopStatus = require('../shop/shopStatus.js');
const { loadCatalogue } = require('../interpret/loadCatalogue.js');
const { buildGroundedPrompt } = require('../interpret/groundedPrompt.js');
const { resolveAll } = require('../interpret/resolveByCatalogue.js');
const { planBasket } = require('../skill/planner.js');
const { buildPayload } = require('../reconcile/record-confirmation.js');
const { recordConfirmation } = require('../reconcile/recordConfirmation.js');
const { updateRegulars } = require('../outcome/updateRegulars.js');

// NOTE ON WHAT IS *NOT* IMPORTED HERE, AND WHY:
//   interpret/interpret-list.js, outcome/record-shop.js and shop/shop-cli.js
//   all call main() at module scope - they are CLIs, not libraries, and
//   importing one would run it (and process.exit) on import. So the pipeline
//   uses the libraries beneath them: resolveByCatalogue for identity,
//   recordConfirmation for the write, updateRegulars for the learning.
//   reconcile/record-confirmation.js IS importable (it guards on require.main).

/** Lazily-built read pool. `pg` is required only when a real read happens, so
 *  the whole pure surface loads on a box with no dependencies installed. */
let readPool = null;
function getReadPool() {
  if (readPool) return readPool;
  const url = process.env.ASDAIR_DB_URL;
  if (!url || String(url).trim() === '') {
    throw new Error('ASDAIR_DB_URL is not set. Export the asdair READ connection string as ASDAIR_DB_URL before running the pipeline.');
  }
  const { Pool } = require('pg');
  readPool = new Pool({ connectionString: url });
  return readPool;
}

let writePool = null;
function getWritePool() {
  if (writePool) return writePool;
  const url = process.env.ASDAIR_WRITE_DB_URL;
  if (!url || String(url).trim() === '') {
    throw new Error('ASDAIR_WRITE_DB_URL is not set. Export the asdair WRITE connection string as ASDAIR_WRITE_DB_URL before running the pipeline.');
  }
  const { Pool } = require('pg');
  writePool = new Pool({ connectionString: url });
  return writePool;
}

/** Every read runs inside BEGIN TRANSACTION READ ONLY - belt and braces on top
 *  of the SELECT-only role, exactly as skill/data.js and shopStatus.js do. */
async function realReadQuery(sql, params) {
  const client = await getReadPool().connect();
  try {
    await client.query('BEGIN TRANSACTION READ ONLY');
    const res = await client.query(sql, params);
    await client.query('COMMIT');
    return res;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* no-op */ }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * The ONE write path this module opens for a table shopStore does not own:
 * asdair.shop_line (migration 008). Every statement it carries is built in
 * shopLines.js from a column allowlist, and there is no DELETE among them.
 */
async function realWriteQuery(sql, params) {
  const client = await getWritePool().connect();
  try {
    await client.query('BEGIN');
    const res = await client.query(sql, params);
    await client.query('COMMIT');
    return res;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* no-op */ }
    throw err;
  } finally {
    client.release();
  }
}

/** The household catalogue, loaded read-only. THE precondition of every
 *  interpretation - see runPipeline.assertCatalogueLoaded. */
async function realLoadCatalogue(householdId) {
  const client = await getReadPool().connect();
  try {
    await client.query('BEGIN TRANSACTION READ ONLY');
    const catalogue = await loadCatalogue(client, Number(householdId));
    await client.query('COMMIT');
    return catalogue;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* no-op */ }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * ONE grounded vision request. Not a daemon, not a conversation, not an agent.
 *
 * The prompt is built from the catalogue by groundedPrompt.js and asks the model
 * for a raw_reading per line. The model's own candidate id is deliberately
 * IGNORED for identity: resolveByCatalogue decides that from our rows, so a
 * product that does not exist cannot reach a basket whatever the model claims.
 *
 * A single strict-JSON retry is allowed, and no more. That is a formatting
 * repair, not a second opinion.
 */
async function realInterpretPhoto({ prompt, imagePath }) {
  const fs = require('node:fs');
  const path = require('node:path');
  const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
  const ext = path.extname(imagePath).toLowerCase();
  const mime = MIME[ext];
  if (!mime) throw new Error(`pipeline: unsupported image type ${ext}`);
  const dataUrl = `data:${mime};base64,${fs.readFileSync(imagePath).toString('base64')}`;

  const { vision } = await import('../../obsidiwikai/src/core/models.mjs');
  const { extractJson } = await import('../../obsidiwikai/src/core/llm.mjs');

  let parsed = await extractJson(await vision(prompt, dataUrl));
  if (!parsed || !Array.isArray(parsed.lines)) {
    parsed = await extractJson(await vision(
      `${prompt}\n\nReturn ONLY valid JSON. No prose, no markdown, no code fences.`, dataUrl,
    ));
  }
  if (!parsed || !Array.isArray(parsed.lines)) {
    throw new Error('pipeline: the grounded vision request did not return usable JSON');
  }
  return parsed.lines.map((l, i) => ({
    line_no: l.line_no ?? i + 1,
    raw_reading: String(l.raw_reading ?? '').trim(),
    quantity: Number.isInteger(l.quantity) && l.quantity > 0 ? l.quantity : null,
  }));
}

/**
 * Execute add_list_item intents against the real list, in ONE transaction.
 *
 * asdairCommands.execute takes pg_advisory_xact_lock, which is only meaningful
 * inside a transaction - so the transaction boundary is opened here rather than
 * left to chance. A partial write is impossible: either every line of the list
 * lands or none does.
 */
async function realExecuteIntents(intents, { householdId }) {
  const asdairCommands = await import('../../control-plane/wp-d-proof/asdairCommands.mjs');
  const client = await getWritePool().connect();
  try {
    await client.query('BEGIN');
    let listId = null;
    const results = [];
    for (const intent of intents) {
      const res = await asdairCommands.execute(client, intent.command, { ...intent.args, household: householdId });
      if (!res.ok) throw new Error(`pipeline: ${intent.command} refused: ${res.error}`);
      listId = res.list_id;
      results.push(res);
    }
    await client.query('COMMIT');
    return { listId, results };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* no-op */ }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * services/asdair/skill/data.js is the ONE component here that requires `pg`
 * EAGERLY, at module scope. Loading it lazily keeps this whole module - and
 * therefore the pure command surface, the stage table and the entire offline
 * test suite - importable on a box with no dependencies installed, which is the
 * same discipline shopStore.js and shopStatus.js already apply to themselves.
 */
let skillDataModule = null;
function skillData() {
  if (!skillDataModule) skillDataModule = require('../skill/data.js');
  return skillDataModule;
}

/** Everything planBasket needs, all of it read-only. */
async function realLoadPlanningInputs(householdId) {
  const skill = skillData();
  const [rules, products, regulars, budget, lastOrder] = await Promise.all([
    skill.loadRules(),
    skill.loadProducts(),
    skill.loadRegulars(householdId),
    skill.loadBudget(householdId).catch(() => null),
    skill.loadLastOrder(householdId).catch(() => null),
  ]);
  return { rules, products, regulars, budget, lastOrder };
}

/**
 * THE LEARNING ARC, conservatively wired.
 *
 * Confirmed outcomes enrich aliases: a line whose raw reading resolved to a
 * regular by anything WEAKER than an exact alias is exactly the case where the
 * household's shorthand is missing from the catalogue, and adding it is what
 * makes next week's read better. `add_aka` can only ever ADD - updateRegulars
 * merges against what it reads in the same transaction and refuses a lost
 * update - so this can never destroy prior learning.
 *
 * DELIBERATELY NOT WIRED HERE: promoteDecision, which turns a human answer into
 * a STANDING RULE that changes every future basket forever. That needs the
 * provenance proving the instruction was explicit, and the pipeline does not
 * currently capture "and this applies going forward" as a distinct human act.
 * Guessing it would be exactly the ambiguous-inference failure promoteDecision's
 * own provenance guard exists to stop. It stays with record-shop.js until the
 * command surface can carry the intent honestly.
 */
async function realRecordLearning({ shop, deps }) {
  const errors = [];
  let applied = 0;
  let attempted = 0;
  const res = await deps.readQuery(
    `SELECT id, product_name, matched_regular_id, note
       FROM asdair.order_confirmation_line
      WHERE confirmation_id = (SELECT id FROM asdair.order_confirmation
                                WHERE shop_id = $1 ORDER BY id DESC LIMIT 1)
        AND matched_regular_id IS NOT NULL`, [shop.id],
  );
  for (const line of (res && res.rows) || []) {
    attempted += 1;
    try {
      await updateRegulars({
        op: 'enrichRegular',
        id: line.matched_regular_id,
        add_aka: [String(line.product_name)],
      });
      applied += 1;
    } catch (err) {
      // Learning NEVER fails a shop that otherwise reconciled correctly.
      errors.push(String(err && err.message ? err.message : err));
    }
  }
  return { attempted, applied, errors };
}

/** The hard allowlist, imported from the route that owns it so the two cannot
 *  drift. add-to-draft-list is the ONLY command that can reach the database. */
async function realAssertAllowedIntents(intents) {
  const { ALLOWED_SHOPPER_COMMANDS } = await import('../../hub/shopper/shopperRoute.mjs');
  for (const i of intents) {
    if (!ALLOWED_SHOPPER_COMMANDS.includes(i.command)) {
      throw new Error(`pipeline: refusing a non-allowlisted command "${i.command}" - the surface is add-to-draft-list only (no checkout, no payment, no substitution)`);
    }
  }
  return intents;
}

/**
 * Build the real dependency container.
 *
 * Every member is overridable, which is how the test suite runs offline. The
 * defaults are the REAL components - nothing here is a stub in production.
 */
export function createDeps(overrides = {}) {
  const base = {
    // durable state
    shopStore,
    shopState,
    readQuery: realReadQuery,
    writeQuery: realWriteQuery,
    getShopStatus: (handle, opts) => shopStatus.getShopStatus(handle, opts),

    // interpretation - catalogue FIRST, always
    loadCatalogue: realLoadCatalogue,
    buildGroundedPrompt,
    interpretPhoto: realInterpretPhoto,
    resolveAll,

    // list -> intents -> real rows
    shopperRoute: async (payload, opts) => {
      const { shopperRoute } = await import('../../hub/shopper/shopperRoute.mjs');
      return shopperRoute(payload, opts);
    },
    assertAllowedIntents: realAssertAllowedIntents,
    executeIntents: realExecuteIntents,

    // planning
    planBasket,
    loadPlanningInputs: realLoadPlanningInputs,

    // confirmation + learning
    buildConfirmationPayload: buildPayload,
    recordConfirmation: (confirmation) => recordConfirmation(confirmation),
    recordLearning: realRecordLearning,

    // the pure stage table, injected so getStatus can report the next step
    decideNextStep,

    // diagnostics
    log: () => {},
  };
  return { ...base, ...overrides };
}

/** Close every pool this module opened. Call once when a run finishes. */
export async function closeDeps() {
  const closers = [
    readPool ? readPool.end() : null,
    writePool ? writePool.end() : null,
    shopStore.close(),
    shopStatus.close(),
    // Only if it was ever loaded - closing a pool that was never opened would
    // pull `pg` in purely to shut it down.
    skillDataModule ? skillDataModule.close() : null,
  ].filter(Boolean);
  readPool = null;
  writePool = null;
  await Promise.allSettled(closers);
}
