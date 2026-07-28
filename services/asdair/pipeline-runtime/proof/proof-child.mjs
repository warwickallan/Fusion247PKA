// =====================================================================
// BUILD-015 AsdAIr Stage 1 - proof/proof-child.mjs
//
// ONE RUN OF THE REAL PIPELINE, IN A REAL PROCESS THAT CAN REALLY DIE.
//
// This is the unit of the restart proofs. The parent (run-proofs.mjs) starts
// one of these, lets it work, kills it or lets it exit, then starts ANOTHER
// ONE - a genuinely fresh process, with nothing in memory - and checks that the
// second one picked up exactly where the first left off, without redoing
// anything and without losing anything.
//
// ── WHAT IS REAL HERE ───────────────────────────────────────────────────────
//   * pipeline/runtime.js runOnce                      the loop, verbatim
//   * pipeline/runPipeline.js, stages.js, commands.js  the state machine
//   * shop/shopStore.js                                the durable writer
//   * intake/shopperIntake.js runIntake                the receiver
//   * intake createFileStateStore                      THE REAL OFFSET FILE,
//                                                      atomic tmp+rename write
//
// ── WHAT IS STOOD IN FOR, AND WHY THAT IS HONEST ────────────────────────────
//   * `pg`: pipeline/test/fakePg.js, the suite's in-memory database - which
//     models the FIVE UNIQUE INDEXES that ARE the idempotency (shop_ref_uniq,
//     shop_inbound_uniq, shop_question_key_uniq, bbr_one_live_per_shop,
//     pending_action_key_uniq). Here it is made DURABLE: its tables are
//     serialised to a file after every statement and re-seeded on start, so
//     "the state survived the process" is a fact about a file on disk rather
//     than an assumption. What it does NOT model is transaction ROLLBACK, so
//     these proofs establish idempotency and resumability, not atomicity.
//   * Telegram: proof/fake-telegram-server.mjs, which models the DESTRUCTIVE
//     ack in a file, so a lost message is detectable.
//
//   NO CREDENTIALS FILE IS OPENED. NO NETWORK CALL IS MADE. THE REAL SHOPPERBOT
//   IS NEVER CONTACTED, and the real 2026-07-27 list is never touched.
//
// Usage (all paths absolute):
//   node proof-child.mjs --db <f> --telegram <f> --offset-file <f> --report <f>
//                        [--passes N] [--label X]
//                        [--crash-before-ack <updateId>]  hard-exit at the exact
//                                                         worst moment: work
//                                                         committed, offset not
//                        [--issue <COMMAND>]              record a command first
//                        [--fail-plan]                    make planning throw
// =====================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PIPELINE = path.join(HERE, '..', '..', 'pipeline');

const { makeHarness, HOUSEHOLD_ID, FIXED_NOW } = await import(pathToUrl(path.join(PIPELINE, 'test', 'harness.js')));
const { runOnce } = await import(pathToUrl(path.join(PIPELINE, 'runtime.js')));
const commands = await import(pathToUrl(path.join(PIPELINE, 'commands.js')));
const { COMMANDS } = await import(pathToUrl(path.join(PIPELINE, 'commandNames.js')));
const { createFileStateStore, runIntake } = await import(pathToUrl(path.join(HERE, '..', '..', 'intake', 'shopperIntake.js')));
const { createServerClient } = await import('./fake-telegram-server.mjs');

function pathToUrl(p) { return new URL(`file:///${p.replace(/\\/g, '/')}`).href; }

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const DB_FILE = arg('db');
const TELEGRAM_FILE = arg('telegram');
const OFFSET_FILE = arg('offset-file');
const REPORT_FILE = arg('report');
const PASSES = Number(arg('passes', 1));
const LABEL = String(arg('label', `child-${process.pid}`));
const CRASH_BEFORE_ACK = arg('crash-before-ack') === null ? null : Number(arg('crash-before-ack'));
const CRASH_AFTER_ACK = arg('crash-after-ack') === null ? null : Number(arg('crash-after-ack'));
const ISSUE = arg('issue');
const FAIL_PLAN = arg('fail-plan') === true;

if (!DB_FILE || !TELEGRAM_FILE || !OFFSET_FILE || !REPORT_FILE) {
  console.error('proof-child: --db, --telegram, --offset-file and --report are all required');
  process.exit(2);
}

// ---------------------------------------------------------------------
// The durable database
// ---------------------------------------------------------------------

function loadSeed(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}

/**
 * Persist the whole database.
 *
 * tmp + rename, so a kill mid-write cannot leave a half-written file that the
 * next process would read as a corrupt world. Windows will occasionally refuse
 * the rename (EPERM) when an indexer or scanner has the target open for a few
 * milliseconds, which is a property of the machine, not of the thing under
 * test - so it is retried rather than allowed to fail a proof spuriously.
 */
function saveDb(file, db) {
  const body = `${JSON.stringify(db, null, 1)}\n`;
  const tmp = `${file}.tmp-${process.pid}`;
  for (let attempt = 0; attempt < 25; attempt += 1) {
    try {
      fs.writeFileSync(tmp, body);
      fs.renameSync(tmp, file);
      return;
    } catch (err) {
      if (err.code !== 'EPERM' && err.code !== 'EBUSY' && err.code !== 'EACCES') throw err;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
    }
  }
  fs.writeFileSync(file, body);
}

/** PURE. Does this statement change anything? Persisting after reads would
 *  multiply the file churn for no gain. */
function isMutation(sql) {
  return /^\s*(INSERT|UPDATE|DELETE|COMMIT)/i.test(String(sql || ''));
}

const seed = loadSeed(DB_FILE);
const harness = makeHarness({
  seed,
  // A pinned clock, so the shop_ref a restart derives is the same shop_ref the
  // first process derived. A runtime with a drifting clock would "resume" into
  // a brand new week, which is a duplicate wearing a different name.
  depsOverride: FAIL_PLAN
    ? { planBasket() { throw new Error('proof: planning deliberately failed'); } }
    : {},
});

// PERSIST AFTER EVERY WRITE. The point of the restart proofs is that the second
// process reads what the first one wrote, so the write has to actually reach the
// disk rather than live in this process's heap - and it has to get there at the
// moment it happens, not at the end, or a crash would conveniently roll back the
// very half-finished state the proof is about.
const innerQuery = harness.client.query.bind(harness.client);
harness.client.query = async (sql, params) => {
  const result = await innerQuery(sql, params);
  if (isMutation(sql)) saveDb(DB_FILE, harness.db);
  return result;
};

// ---------------------------------------------------------------------
// The intake wiring - REAL receiver, REAL offset file, stand-in Telegram
// ---------------------------------------------------------------------

const realState = createFileStateStore(OFFSET_FILE);
const state = {
  path: realState.path,
  read: (...a) => realState.read(...a),
  async write(lastUpdateId, ...rest) {
    if (CRASH_BEFORE_ACK !== null && Number(lastUpdateId) >= CRASH_BEFORE_ACK) {
      // WINDOW 1 - the SAFE side of the ack. The update has been fetched and
      // handled but the offset has not been advanced, so Telegram will redeliver
      // it. If anything downstream is not idempotent, the restart duplicates it.
      crash('crashed_before_acking', lastUpdateId);
    }
    const written = await realState.write(lastUpdateId, ...rest);
    if (CRASH_AFTER_ACK !== null && Number(lastUpdateId) >= CRASH_AFTER_ACK) {
      // WINDOW 2 - the DANGEROUS side of the ack, and the reason this flag
      // exists. runIntake advances and PERSISTS the offset inside its own loop;
      // the shop row is only written afterwards, by pollIntake calling
      // commands.receiveList. A process that dies in between has told Telegram
      // "I have this" and has written nothing. Telegram deletes it. Nobody ever
      // finds out. See RUNTIME-PROOF.md - FINDING 1.
      crash('crashed_after_acking_before_the_shop_row', lastUpdateId);
    }
    return written;
  },
};

function crash(kind, lastUpdateId) {
  fs.appendFileSync(`${REPORT_FILE}.crash`, `${JSON.stringify({
    label: LABEL, pid: process.pid, kind, update_id: Number(lastUpdateId), at: new Date().toISOString(),
  })}\n`);
  process.exit(137);
}

const telegram = createServerClient(TELEGRAM_FILE, { label: LABEL });

const events = [];
const wiring = {
  householdId: HOUSEHOLD_ID,
  now: () => FIXED_NOW,
  log: (event, detail) => events.push({ event, ...detail }),
  intake: {
    now: () => FIXED_NOW,
    runIntake,
    config: {
      botToken: '000000:FAKE-TOKEN-NOT-A-CREDENTIAL',
      allowedSenderIds: ['555'],
      pollTimeoutSeconds: 0,
    },
    telegram,
    state,
    media: { async save() { return 'C:/.fusion247/asdair/shopper-media/synthetic-fixture.jpg'; } },
  },
};

// ---------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------

if (ISSUE) {
  // A human tap, recorded through the SAME command surface Telegram and the
  // Cockpit use. This is how a proof gets a shop past a human gate without
  // inventing a back door into the state machine.
  const shop = harness.db.shop[harness.db.shop.length - 1];
  if (shop) {
    await commands.dispatch(String(ISSUE), {
      shopRef: shop.shop_ref, householdId: HOUSEHOLD_ID, actor: 'proof:harness',
    }, harness.deps);
    saveDb(DB_FILE, harness.db);
  }
}

const reports = [];
for (let i = 0; i < PASSES; i += 1) {
  reports.push(await runOnce(harness.deps, wiring));
}
saveDb(DB_FILE, harness.db);

// WHAT "HANDLED" MEANS HERE: the pass that emitted this update ran all the way
// through commands.receiveList and returned. It is appended to a shared file so
// the audit spans every process in the timeline, not just this one - a message
// handled by process A must still count as handled when process C is asked
// whether anything was lost.
const emittedThisRun = events.filter((e) => e.event === 'emitted' && e.updateId !== undefined).map((e) => Number(e.updateId));
const HANDLED_FILE = arg('handled-file', `${DB_FILE}.handled`);
for (const id of emittedThisRun) fs.appendFileSync(HANDLED_FILE, `${id}\n`);
const handled = (() => {
  try { return fs.readFileSync(HANDLED_FILE, 'utf8').split(/\r?\n/).filter(Boolean).map(Number); } catch { return []; }
})();

fs.writeFileSync(REPORT_FILE, `${JSON.stringify({
  label: LABEL,
  pid: process.pid,
  passes: reports,
  events,
  handled_update_ids: handled,
  offset_after: await realState.read(),
  shops: harness.db.shop.map((s) => ({ id: s.id, shop_ref: s.shop_ref, status: s.status, list_id: s.list_id, last_error: s.last_error, telegram_update_id: s.telegram_update_id })),
  counts: countAll(harness.db),
  commands: COMMANDS,
}, null, 1)}\n`);

export function countAll(db) {
  return {
    shop: db.shop.length,
    shopping_lists: db.shopping_lists.length,
    shopping_list_items: db.shopping_list_items.length,
    shop_question: db.shop_question.length,
    shop_line: db.shop_line.length,
    shop_event: db.shop_event.length,
    pending_action: db.pending_action.length,
    browser_build_request: db.browser_build_request.length,
    order_confirmation: db.order_confirmation.length,
    order_confirmation_line: db.order_confirmation_line.length,
    answered_questions: db.shop_question.filter((q) => q.status === 'answered').length,
  };
}
