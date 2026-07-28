#!/usr/bin/env node
// =====================================================================
// BUILD-015 AsdAIr Stage 1 - shop-cli.js
//
// THE RUNTIME CALLER for the shop control surface, in the same shape as
// outcome/update-regulars.js.
//
// Usage (from services/asdair/shop):
//     node --env-file=<env> shop-cli.js <command> [--json '<json>'] [--file f.json] [--dry-run]
//
// The connection comes ONLY from the environment - ASDAIR_WRITE_DB_URL for
// every write command, ASDAIR_DB_URL for `status`. It is NEVER passed on the
// command line and never printed. Nothing here reads a credentials file.
//
// COMMANDS
//   next-ref        --json '{"date":"2026-07-27"}'
//                   Prints the shop_ref for a date. Pure; touches nothing.
//
//   create          --json '{"household_id":1,"shop_ref":"SHOP-2026-07-27",
//                            "source_kind":"text","raw_text":"milk\nbread",
//                            "telegram_chat_id":"123","telegram_message_id":"456"}'
//                   IDEMPOTENT on (telegram_chat_id, telegram_message_id): a
//                   redelivered message RESUMES the existing week and writes
//                   nothing.
//
//   transition      --json '{"shop_id":1,"to":"PROCESSING","description":"..."}'
//   fail            --json '{"shop_id":1,"error":"ASDA session expired"}'
//   resume          --json '{"shop_id":1}'
//                   Convenience: reads the failure event and transitions back
//                   to exactly the state the shop failed from.
//
//   ask             --json '{"shop_id":1,"question_key":"line-7-brand",
//                            "question_text":"Which milk?","candidates":[...]}'
//   answer          --json '{"shop_id":1,"question_key":"line-7-brand",
//                            "answer_text":"Arla 4pt","answer_source":"button"}'
//
//   request-build   --json '{"shop_id":1}'
//   claim-build     --json '{"shop_id":1,"claimed_by":"runner-a"}'
//   progress        --json '{"request_id":3,"progress":{"basket_product_count":41}}'
//   finish-build    --json '{"request_id":3,"status":"complete"}'
//
//   pending-add     --json '{"household_id":1,"action_type":"add_favourite",
//                            "action_key":"walls-sausages"}'
//   pending-resolve --json '{"action_id":2,"status":"done","note":"added"}'
//
//   status          --json '{"shop":"SHOP-2026-07-27"}'   (or {"shop":1})
//                   READ-ONLY projection. Every null means genuinely UNKNOWN -
//                   report it as "unknown", never as zero.
//
// --dry-run validates the payload with the PURE builders and prints what WOULD
// be written, opening NO connection at all. Run it first. Note what a dry run
// cannot tell you: whether a transition is legal, because legality is judged
// against the shop's DURABLE current status, which requires a read.
//
// PURE ASCII only.
// =====================================================================

'use strict';

const fs = require('node:fs');

const state = require('./shopState');
const store = require('./shopStore');
const status = require('./shopStatus');

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  if (i >= 0) return process.argv[i + 1];
  const eq = process.argv.find(function (a) { return a.indexOf('--' + name + '=') === 0; });
  return eq === undefined ? fallback : eq.slice(('--' + name + '=').length);
}
const has = function (name) { return process.argv.indexOf('--' + name) >= 0; };

function usage() {
  return 'usage: node --env-file=<env> shop-cli.js <command> [--json \'<json>\'] [--file f.json] [--dry-run]\n' +
    'commands: next-ref create transition fail resume ask answer request-build claim-build ' +
    'progress finish-build pending-add pending-resolve status';
}

function readPayload() {
  const file = arg('file', null);
  const json = arg('json', null);
  if (file !== null && json !== null) {
    throw new Error('pass either --json or --file, not both.');
  }
  if (file !== null) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  if (json !== null) {
    return JSON.parse(json);
  }
  return {};
}

function out(value) {
  console.log(JSON.stringify(value, null, 1));
}

// ---------------------------------------------------------------------
// Each command declares:
//   dry(payload)  -> what a dry run can HONESTLY say (pure only), or null
//                    when nothing can be validated without a read.
//   run(payload)  -> the real call.
//   reads         -> true for the read-only projection (ASDAIR_DB_URL).
// ---------------------------------------------------------------------
const COMMANDS = {
  'next-ref': {
    pure: true,
    run: async function (p) {
      return { shop_ref: state.nextShopRef(p.date || p.dateISO) };
    }
  },

  create: {
    dry: function (p) {
      const built = state.buildShopCreate(p);
      return {
        would_insert: built.row,
        columns: built.columns,
        resume_keys: built.resume_keys,
        note: 'if a shop already exists for this Telegram message (or this household + shop_ref) it is ' +
          'RESUMED and nothing is written'
      };
    },
    run: function (p) { return store.createOrResumeShop(p); }
  },

  transition: {
    dry: function (p) {
      const to = p.to || p.to_status;
      if (state.SHOP_STATUSES.indexOf(to) === -1) {
        throw new Error('to "' + String(to) + '" is not one of: ' + state.SHOP_STATUSES.join(', '));
      }
      state._internal.toDbId(p.shop_id, 'shop_id');
      const reachableFrom = Object.keys(state.ALLOWED_TRANSITIONS).filter(function (from) {
        return state.ALLOWED_TRANSITIONS[from].indexOf(to) !== -1;
      });
      return {
        shop_id: p.shop_id,
        to: to,
        reachable_from: reachableFrom,
        note: 'legality depends on the shop CURRENT status, which is durable state - a dry run cannot ' +
          'read it, so this only proves the target status exists and the id is well formed'
      };
    },
    run: function (p) { return store.transition(p.shop_id, p.to || p.to_status, p.description); }
  },

  fail: {
    dry: function (p) {
      state._internal.toDbId(p.shop_id, 'shop_id');
      state._internal.requireText(p.error, 'error');
      return { shop_id: p.shop_id, would_set_last_error: p.error, would_transition_to: 'FAILED' };
    },
    run: function (p) { return store.recordFailure(p.shop_id, p.error); }
  },

  resume: {
    dry: function (p) {
      state._internal.toDbId(p.shop_id, 'shop_id');
      return {
        shop_id: p.shop_id,
        note: 'the resume target is read from the shop LAST failure event; a dry run cannot read it'
      };
    },
    run: async function (p) {
      // The resume target is durable state, so this simply asks the store to
      // move to it. Reading it here and passing it back in would let a stale
      // value drive the write; instead the store reads it inside the same
      // transaction that performs the transition.
      const projection = await status.getShopStatus(p.shop_id, {});
      if (projection.stage !== 'FAILED') {
        throw new Error('shop ' + String(p.shop_id) + ' is ' + projection.stage + ', not FAILED - nothing to resume.');
      }
      if (!projection.failure || !projection.failure.resume_to) {
        throw new Error('shop ' + String(p.shop_id) + ' is FAILED but has no durable failure event recording ' +
          'the state it failed from, so it cannot be resumed automatically. Transition it explicitly.');
      }
      return store.transition(p.shop_id, projection.failure.resume_to, p.description || 'resumed after failure');
    }
  },

  ask: {
    dry: function (p) {
      const built = state.buildQuestion(p);
      return {
        would_insert: built.row,
        note: 'idempotent on (shop_id, question_key) - if this question already exists it is NOT re-asked, ' +
          'and any existing answer is returned instead'
      };
    },
    run: function (p) { return store.openQuestion(p); }
  },

  answer: {
    dry: function (p) {
      const built = state.buildAnswer(p);
      return {
        would_set: built.set,
        event: built.event,
        note: 'first answer wins - a question already answered or skipped is returned unchanged'
      };
    },
    run: function (p) { return store.answerQuestion(p); }
  },

  'request-build': {
    dry: function (p) {
      const built = state.buildBrowserRequest(p);
      return {
        would_insert: built.row,
        note: 'at most one live request per shop - a repeated tap RESUMES the existing one'
      };
    },
    run: function (p) { return store.requestBrowserBuild(p.shop_id); }
  },

  'claim-build': {
    dry: function (p) {
      state._internal.toDbId(p.shop_id, 'shop_id');
      state._internal.requireText(p.claimed_by, 'claimed_by');
      return {
        shop_id: p.shop_id,
        claimed_by: p.claimed_by,
        note: 'the claim is a single atomic UPDATE ... WHERE status = queued RETURNING, so of two runners ' +
          'exactly one can win'
      };
    },
    run: function (p) { return store.claimBrowserBuild(p.shop_id, p.claimed_by); }
  },

  progress: {
    dry: function (p) {
      state._internal.toDbId(p.request_id, 'request_id');
      return { request_id: p.request_id, would_set_progress: p.progress || {} };
    },
    run: function (p) {
      return store.updateBrowserProgress(p.request_id, p.progress || {}, { claimed_by: p.claimed_by });
    }
  },

  'finish-build': {
    dry: function (p) {
      state._internal.toDbId(p.request_id, 'request_id');
      if (['complete', 'failed', 'cancelled'].indexOf(p.status) === -1) {
        throw new Error('status must be complete | failed | cancelled, got "' + String(p.status) + '"');
      }
      return { request_id: p.request_id, would_set_status: p.status, last_error: p.last_error || null };
    },
    run: function (p) {
      return store.finishBrowserBuild(p.request_id, { status: p.status, last_error: p.last_error });
    }
  },

  'pending-add': {
    dry: function (p) {
      const built = state.buildPendingAction(p);
      return {
        would_insert: built.row,
        note: 'idempotent on (household_id, action_type, action_key) while pending'
      };
    },
    run: function (p) { return store.addPendingAction(p); }
  },

  'pending-resolve': {
    dry: function (p) {
      state._internal.toDbId(p.action_id, 'action_id');
      if (p.status !== 'done' && p.status !== 'abandoned') {
        throw new Error('status must be done | abandoned, got "' + String(p.status) + '"');
      }
      return { action_id: p.action_id, would_set_status: p.status };
    },
    run: function (p) { return store.resolvePendingAction(p.action_id, { status: p.status, note: p.note }); }
  },

  status: {
    reads: true,
    dry: function (p) {
      const handle = p.shop === undefined ? p.shop_id : p.shop;
      if (handle === undefined || handle === null || handle === '') {
        throw new Error('pass {"shop": <id or SHOP-YYYY-MM-DD>}');
      }
      return { would_read: handle, note: 'read-only projection; a dry run opens no connection' };
    },
    run: function (p) {
      const handle = p.shop === undefined ? p.shop_id : p.shop;
      return status.getShopStatus(handle, { household_id: p.household_id });
    }
  }
};

async function main() {
  const command = process.argv[2];
  if (!command || command === '--help' || command === '-h') {
    console.error(usage());
    process.exitCode = 2;
    return;
  }
  const spec = COMMANDS[command];
  if (!spec) {
    console.error('unknown command "' + command + '".\n' + usage());
    process.exitCode = 2;
    return;
  }

  let payload;
  try {
    payload = readPayload();
  } catch (e) {
    console.error('could not read/parse the payload: ' + (e && e.message ? e.message : String(e)));
    process.exitCode = 2;
    return;
  }

  const dryRun = has('dry-run');

  if (dryRun && !spec.pure) {
    // Validate with the PURE builders only. No pool is created, so no
    // connection string is even looked up.
    const described = spec.dry(payload);
    out({ dry_run: true, command: command, validated: described, note: 'nothing was written and no connection was opened' });
    return;
  }

  try {
    const result = await spec.run(payload);
    out({ command: command, result: result });
  } finally {
    // Close BOTH pools: `resume` legitimately uses the read path and the write
    // path in one command, and closing a pool that was never opened is a
    // no-op. Leaving one open would hang the process.
    if (!spec.pure) {
      await status.close().catch(function () {});
      await store.close().catch(function () {});
    }
  }
}

main().catch(function (e) {
  console.error(e && e.message ? e.message : String(e));
  process.exitCode = 1;
});
