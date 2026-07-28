// =====================================================================
// BUILD-015 AsdAIr browser runner - DATABASE ACCESS.
//
// CREDENTIALS: this module knows env var NAMES and nothing else. It never
// opens, parses, prints or inspects a credentials file. Values arrive via
// `node --env-file=<path>`.
//
//   ASDAIR_DB_URL        SELECT-only (asdair_ro) - reads
//   ASDAIR_WRITE_DB_URL  asdair_rw               - writes
//
// `pg` is required LAZILY, so every pure module and the whole offline test
// suite loads on a box with no dependencies installed at all.
// =====================================================================
'use strict';

let pgModule = null;
function pg() {
  if (!pgModule) pgModule = require('pg');
  return pgModule;
}

function requireUrl(name, env = process.env) {
  const v = env[name];
  if (!v) throw new Error(`${name} is not set - run with: node --env-file=<env file> runner.js`);
  return v;
}

/**
 * A query function bound to one pool. This is the ONLY shape lease.cjs sees,
 * which is what lets the whole lease protocol be tested against a fake.
 */
function makeQuery(connectionString, { max = 3 } = {}) {
  const { Pool } = pg();
  const pool = new Pool({ connectionString, max });
  const query = (text, params) => pool.query(text, params);
  query.end = () => pool.end();
  return query;
}

function writeQuery(env = process.env) { return makeQuery(requireUrl('ASDAIR_WRITE_DB_URL', env)); }
function readQuery(env = process.env) { return makeQuery(requireUrl('ASDAIR_DB_URL', env)); }

// ---------------------------------------------------------------------
// Shop-level integration. The runner owns exactly two transitions:
//   WAITING_FOR_BROWSER -> SHOPPING       (it has claimed and started)
//   SHOPPING            -> BASKET_READY   (it stopped at basket-ready)
// Both are guarded on the CURRENT status, so a runner can never drag a shop
// backwards or past a stage another component owns.
// ---------------------------------------------------------------------

async function setShopStatus(query, { shopId, from, to, description }) {
  const res = await query(
    `update asdair.shop set status = $3, updated_at = now()
      where id = $1::bigint and status = $2
    returning id, status`,
    [String(shopId), from, to]);
  if (res.rows[0]) {
    await query(
      `insert into asdair.shop_event (shop_id, event_type, from_status, to_status, description)
       values ($1::bigint, 'transition', $2, $3, $4)`,
      [String(shopId), from, to, description || `browser runner: ${from} -> ${to}`]);
  }
  return res.rows[0] || null;
}

async function noteShopEvent(query, { shopId, eventType = 'note', description }) {
  await query(
    `insert into asdair.shop_event (shop_id, event_type, description) values ($1::bigint, $2, $3)`,
    [String(shopId), eventType, String(description).slice(0, 1000)]);
}

/**
 * Record a browser-only maintenance job the runner could not finish (adding a
 * product to ASDA Favourites, typically). Surfaced in status, never forgotten.
 * ON CONFLICT DO NOTHING because the partial unique index already guarantees
 * one live pending action per key.
 */
async function recordPendingAction(query, { householdId = 1, shopId, actionType, actionKey, payload = {}, note = null }) {
  await query(
    `insert into asdair.pending_action (household_id, shop_id, action_type, action_key, payload, note)
     values ($1::bigint, $2::bigint, $3, $4, $5::jsonb, $6)
     on conflict do nothing`,
    [String(householdId), shopId == null ? null : String(shopId), actionType, actionKey, JSON.stringify(payload), note]);
}

/** The shop a request belongs to, for status transitions and reporting. */
async function loadShop(query, shopId) {
  const res = await query(
    `select id, household_id, shop_ref, status, list_id from asdair.shop where id = $1::bigint`,
    [String(shopId)]);
  return res.rows[0] || null;
}

module.exports = { makeQuery, writeQuery, readQuery, requireUrl, setShopStatus, noteShopEvent, recordPendingAction, loadShop };
