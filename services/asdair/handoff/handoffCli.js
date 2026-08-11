#!/usr/bin/env node
// =====================================================================
// BUILD-015 AsdAIr - handoff/handoffCli.js
//
// THE SUPERVISED OPERATOR'S ROUTE BACK. WP-B15-19.
//
// -- THE GAP THIS CLOSES -----------------------------------------------------
// WP-B15-14 taught the pipeline to notice a finished supervised build:
// `stages.js` moves SHOPPING -> BASKET_READY when the request is `complete` AND
// carries `progress.report`. `claim.js completeHandoff` was already the only
// thing in the estate that writes `progress.report`, was already fenced, and was
// already correct - and had ZERO PRODUCTION CALLERS. So a real operator who had
// actually built the trolley had nowhere to say so, and the shop stopped for
// ever inside a journey nobody declared manual.
//
// This file is that caller, and it is deliberately nothing more. It writes one
// durable fact and stops. IT NEVER TRANSITIONS A SHOP: the hop belongs to
// `decideNextStep` reacting to durable state on the pipeline's own next pass,
// which is what makes the leg survive a restart instead of depending on whoever
// happened to run a command.
//
// -- WHY NOT shopStore.updateBrowserProgress, WHICH LOOKS LIKE THE OBVIOUS ONE -
// Because it does `SET progress = $1::jsonb` - a WHOLE-OBJECT REPLACE. Writing a
// report through it deletes `progress.handoff`, and the pipeline then refuses
// with "carries a completion report but no handoff to check it against". The
// handoff artefact is the only thing the report can be checked against, so
// destroying it turns a good basket into an unverifiable one. `completeHandoff`
// merges - `progress = (progress - '_lease') || jsonb_build_object('report',...)`
// - so the packet survives. That is the whole reason this route exists at all.
// (shopStore now also refuses that destructive write outright; see WP-B15-19's
// fence in shop/shopStore.js.)
//
// -- THE CONNECTION ----------------------------------------------------------
// From the ENVIRONMENT only, exactly as shop-cli.js does: ASDAIR_WRITE_DB_URL,
// the `asdair_rw` role, read by shopStore's own pool. It is never accepted as an
// argument, never read out of a credentials file by this module, and never
// printed. The read-only role is deliberately not named anywhere in this file:
// this is a writer, and a writer pointed at the SELECT-only role fails at
// runtime in a way that looks like a bug in the report.
//
// No `pg` here, and no new dependency: this package has none and gets none. The
// client comes from shopStore's existing transaction seam, which is where the
// pool and the environment variable already live.
//
// Usage (from services/asdair/handoff):
//     node --env-file=<file> handoffCli.js <command> [--json '<json>'] [--file f.json] [--dry-run]
//
// PURE ASCII only.
// =====================================================================

'use strict';

const fs = require('node:fs');

const shopStore = require('../shop/shopStore.js');
const {
  claimHandoff, completeHandoff, releaseHandoff, peekHandoff, HandoffStateError, DEFAULT_LEASE_MS,
} = require('./claim');
const { ingestCompletion, basketEvidence } = require('./completion');

// =====================================================================
// 1. Invocation checks - PURE. Nothing below opens a statement until these
//    have passed, so a mistyped invocation costs no database work at all.
// =====================================================================

function requireWriter(writerId) {
  if (typeof writerId !== 'string' || writerId.trim() === '') {
    throw new HandoffStateError('writer_id is required - the lease is held by a NAMED writer, never by "whoever ran the command"');
  }
  return writerId.trim();
}

function requireTarget({ requestId = null, shopId = null }) {
  if (requestId == null && shopId == null) {
    throw new HandoffStateError('pass request_id or shop_id - there is nothing to report against otherwise');
  }
  return { requestId, shopId };
}

/**
 * What can be checked about a report WITHOUT a read.
 *
 * Deliberately narrow. The fingerprint match, the seq coverage and the
 * quantities are all judged against the STORED packet by ingestCompletion, and
 * pretending to check them here would be the sort of dry run that reassures
 * without proving anything.
 */
function assertReportInvocation(report) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    throw new HandoffStateError('report must be an object - one entry per packet line, as the checklist lists them');
  }
  if (!Array.isArray(report.lines) || report.lines.length === 0) {
    throw new HandoffStateError('report.lines must be a non-empty array. An empty ARRAY is not an empty basket: '
      + 'report every line with its real status, and let the pipeline judge the trolley.');
  }
  return report;
}

/**
 * Is the write connection configured? Returns a BOOLEAN and never the value.
 *
 * A connection string that is returned is a connection string that gets logged
 * by the next person who adds a debug line, so it is not handed back at all.
 */
function requireWriteUrl(env) {
  const url = env && env.ASDAIR_WRITE_DB_URL;
  if (typeof url !== 'string' || url.trim() === '') {
    throw new HandoffStateError('ASDAIR_WRITE_DB_URL is not set. Export the asdair WRITE connection string as '
      + 'ASDAIR_WRITE_DB_URL (role asdair_rw), or pass --env-file. It is never accepted on the command line.');
  }
  return true;
}

// =====================================================================
// 2. The route. `query` is INJECTED - this half never opens a connection, which
//    is what lets the whole of it be proven offline.
// =====================================================================

/** The live-or-latest request for a target, or null. */
async function findRequest(query, target) {
  if (target.requestId != null) {
    return peekHandoff(query, { requestId: target.requestId });
  }
  const rows = await peekHandoff(query, { shopId: target.shopId });
  const list = Array.isArray(rows) ? rows : [];
  return list.find((r) => ['queued', 'claimed', 'running'].includes(r.status)) || list[0] || null;
}

/**
 * Take the lease so the operator can shop. Reports refusal; never throws for
 * the ordinary "somebody else has it" case, because that is an answer.
 */
async function claimForOperator(query, { requestId = null, shopId = null, writerId, leaseMs = DEFAULT_LEASE_MS } = {}) {
  const writer = requireWriter(writerId);
  const target = requireTarget({ requestId, shopId });

  const row = await findRequest(query, target);
  if (!row) {
    throw new HandoffStateError('no browser build request exists for that handle. Nothing has been handed to an operator yet.');
  }
  const claimed = await claimHandoff(query, { requestId: row.id, writerId: writer, leaseMs });
  if (!claimed) {
    return {
      claimed: false,
      request_id: row.id,
      held_by: row.claimed_by,
      reason: row.claimed_by
        ? `another writer holds this request: ${row.claimed_by}. Two writers on one trolley is the failure that must never happen even once.`
        : `request ${row.id} is "${row.status}" and cannot be claimed`,
    };
  }
  return { claimed: true, request_id: claimed.id, request: claimed, packet_fingerprint: packetFingerprintOf(claimed) };
}

const packetFingerprintOf = (row) => (row && row.progress && row.progress.handoff
  ? row.progress.handoff.packet_fingerprint : null);

/**
 * THE ONE THAT MATTERS. Record the basket the operator actually built.
 *
 * Order of operations, and each step is where it is on purpose:
 *
 *  1. INVOCATION shape, pure, before any statement.
 *  2. READ the durable request and its handoff artefact.
 *  3. VALIDATE the report against THAT artefact with ingestCompletion - pure,
 *     writes nothing. A malformed or superseded report is refused here, before
 *     a lease is taken and before a byte is written.
 *  4. RE-CLAIM, unless told not to. A supervised shop routinely outlives the
 *     lease - the operator is a human in a browser, not a runner - so the same
 *     writer re-taking its own expired lease is the NORMAL case, and claim.js's
 *     CLAIMABLE predicate already permits exactly that. What it will not permit
 *     is taking a lease somebody else is holding live, which is the case that
 *     must fail.
 *  5. COMPLETE, fenced on the lease AND on the packet fingerprint.
 *
 * -- THE FINGERPRINT COMES FROM THE OPERATOR'S OWN REPORT, NOT FROM THE ROW --
 * Deliberate, and the opposite choice would be a hole. `report.packet_fingerprint`
 * is the packet the operator ACTUALLY SHOPPED FROM. Reading the stored one and
 * passing that instead would launder a stale report into whatever packet the row
 * happens to carry now - which is precisely the supersession the fence exists to
 * catch. So the report is taken at its word about which packet it is for, and
 * the database decides whether that is still the truth.
 *
 * -- AN EMPTY TROLLEY IS RECORDED, NOT DISCARDED -----------------------------
 * "I found none of it" is a truthful report and it is written. The REFUSAL of an
 * empty basket belongs to `runPipeline stepRecordBasketReady`, where it becomes
 * a durable failure, a resumable stage and a card on Warwick's phone. Refusing
 * it here would replace a loud refusal with silence, which is worse.
 */
async function reportBasket(query, {
  requestId = null, shopId = null, writerId, report, leaseMs = DEFAULT_LEASE_MS, reclaim = true,
} = {}) {
  const writer = requireWriter(writerId);
  const target = requireTarget({ requestId, shopId });
  assertReportInvocation(report);

  const row = await findRequest(query, target);
  if (!row) {
    throw new HandoffStateError('no browser build request exists for that handle. There is nothing to report against.');
  }
  const handoff = row.progress && row.progress.handoff;
  if (!handoff) {
    throw new HandoffStateError(`request ${row.id} carries no handoff artefact, so a report cannot be checked against `
      + 'anything. This is not a basket that can be accepted.', { requestId: row.id });
  }

  // PURE. Throws CompletionContractError - SUPERSEDED_PACKET, SHOP_REF_MISMATCH,
  // REPORT_BAD_STATUS, REPORT_MISSING_QUANTITY, REPORT_DUPLICATE_SEQ - and
  // writes absolutely nothing when it does.
  const ingest = ingestCompletion(handoff, report);
  const evidence = basketEvidence(ingest);

  if (reclaim) {
    const claimed = await claimHandoff(query, { requestId: row.id, writerId: writer, leaseMs });
    if (!claimed) {
      throw new HandoffStateError(
        row.claimed_by && row.claimed_by !== writer
          ? `another writer holds this request: ${row.claimed_by}. Nothing was written.`
          : `request ${row.id} is "${row.status}" and could not be claimed for completion. Nothing was written.`,
        { requestId: row.id, heldBy: row.claimed_by, code: 'NOT_CLAIMABLE' },
      );
    }
  }

  // Fenced on the lease AND the packet. LeaseLostError and HandoffStateError
  // (SUPERSEDED_PACKET) both come straight out - a lost lease is never a
  // cheerful no-op, and nothing partial is left behind when it happens.
  const done = await completeHandoff(query, {
    requestId: row.id,
    writerId: writer,
    packetFingerprint: report.packet_fingerprint,
    report,
  });

  return {
    reported: true,
    already_complete: done.alreadyComplete,
    request: done.request,
    basket: evidence,
    note: evidence.empty
      ? 'RECORDED, and the pipeline will refuse it: the packet intended products and nothing went in the trolley.'
      : 'recorded. The shop advances on the pipeline\'s own next pass; nothing here moves it.',
  };
}

/** Hand the browser back without completing. Progress is preserved in full. */
async function releaseForOperator(query, { requestId = null, shopId = null, writerId, reason = null } = {}) {
  const writer = requireWriter(writerId);
  const target = requireTarget({ requestId, shopId });
  const row = await findRequest(query, target);
  if (!row) throw new HandoffStateError('no browser build request exists for that handle.');
  const released = await releaseHandoff(query, { requestId: row.id, writerId: writer, reason });
  if (!released) {
    throw new HandoffStateError(`request ${row.id} is not held by ${writer}, so there is no lease to release. Nothing was written.`);
  }
  return { released: true, request: released };
}

/** READ-ONLY. What is durably true about this shop's request right now. */
async function peekRequest(query, { requestId = null, shopId = null } = {}) {
  const target = requireTarget({ requestId, shopId });
  const found = target.requestId != null
    ? await peekHandoff(query, { requestId: target.requestId })
    : await peekHandoff(query, { shopId: target.shopId });
  const list = Array.isArray(found) ? found : [found].filter(Boolean);
  return list.map((r) => ({
    request_id: r.id,
    shop_id: r.shop_id,
    status: r.status,
    claimed_by: r.claimed_by,
    lease_expired: r.lease_expired,
    packet_fingerprint: packetFingerprintOf(r),
    // Every null here means genuinely UNKNOWN, never zero.
    has_handoff: !!(r.progress && r.progress.handoff),
    has_report: !!(r.progress && r.progress.report),
    lines_in_packet: r.progress && r.progress.handoff && Array.isArray(r.progress.handoff.lines)
      ? r.progress.handoff.lines.length : null,
  }));
}

// =====================================================================
// 3. The commands. Same shape as shop/shop-cli.js:
//      dry(payload) -> what a dry run can HONESTLY say, pure only
//      run(query, payload) -> the real call
// =====================================================================

const COMMANDS = {
  peek: {
    reads: true,
    dry: function (p) {
      requireTarget({ requestId: p.request_id, shopId: p.shop_id });
      return { would_read: p.request_id != null ? { request_id: p.request_id } : { shop_id: p.shop_id },
        note: 'read-only; a dry run opens no connection' };
    },
    run: function (query, p) { return peekRequest(query, { requestId: p.request_id, shopId: p.shop_id }); },
  },

  claim: {
    dry: function (p) {
      requireTarget({ requestId: p.request_id, shopId: p.shop_id });
      requireWriter(p.writer_id);
      return {
        would_claim: p.request_id != null ? { request_id: p.request_id } : { shop_id: p.shop_id },
        writer_id: p.writer_id,
        note: 'whether it is claimable depends on the DURABLE lease, which a dry run cannot read',
      };
    },
    run: function (query, p) {
      return claimForOperator(query, {
        requestId: p.request_id, shopId: p.shop_id, writerId: p.writer_id, leaseMs: p.lease_ms,
      });
    },
  },

  'report-basket': {
    dry: function (p) {
      requireTarget({ requestId: p.request_id, shopId: p.shop_id });
      requireWriter(p.writer_id);
      const report = assertReportInvocation(p.report);
      return {
        would_complete_request: p.request_id,
        would_complete_shop: p.shop_id,
        writer_id: p.writer_id,
        lines_reported: report.lines.length,
        reported_packet_fingerprint: report.packet_fingerprint == null ? null : String(report.packet_fingerprint),
        note: 'the fingerprint, the line coverage and the quantities are judged against the STORED packet, '
          + 'and cannot be checked without a read. Nothing was written and no connection was opened.',
      };
    },
    run: function (query, p) {
      return reportBasket(query, {
        requestId: p.request_id, shopId: p.shop_id, writerId: p.writer_id,
        report: p.report, leaseMs: p.lease_ms,
      });
    },
  },

  release: {
    dry: function (p) {
      requireTarget({ requestId: p.request_id, shopId: p.shop_id });
      requireWriter(p.writer_id);
      return { would_release: p.request_id, writer_id: p.writer_id, note: 'progress is preserved in full; releasing is not abandoning' };
    },
    run: function (query, p) {
      return releaseForOperator(query, {
        requestId: p.request_id, shopId: p.shop_id, writerId: p.writer_id, reason: p.reason,
      });
    },
  },
};

// =====================================================================
// 4. The shell. Argument parsing, the connection, and nothing clever.
// =====================================================================

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  if (i >= 0) return process.argv[i + 1];
  const eq = process.argv.find(function (a) { return a.indexOf('--' + name + '=') === 0; });
  return eq === undefined ? fallback : eq.slice(('--' + name + '=').length);
}
const has = function (name) { return process.argv.indexOf('--' + name) >= 0; };

function usage() {
  return 'usage: node --env-file=<file> handoffCli.js <command> [--json \'<json>\'] [--file f.json] [--dry-run]\n'
    + 'commands: peek claim report-basket release\n'
    + '  peek          --json \'{"shop_id":1}\'\n'
    + '  claim         --json \'{"shop_id":1,"writer_id":"supervised:warwick"}\'\n'
    + '  report-basket --json \'{"request_id":3,"writer_id":"supervised:warwick","report":{...}}\'\n'
    + '  release       --json \'{"request_id":3,"writer_id":"supervised:warwick","reason":"handing back"}\'';
}

function readPayload() {
  const file = arg('file', null);
  const json = arg('json', null);
  if (file !== null && json !== null) throw new Error('pass either --json or --file, not both.');
  if (file !== null) return JSON.parse(fs.readFileSync(file, 'utf8'));
  if (json !== null) return JSON.parse(json);
  return {};
}

function out(value) { console.log(JSON.stringify(value, null, 1)); }

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

  if (has('dry-run')) {
    out({ dry_run: true, command: command, validated: spec.dry(payload), note: 'nothing was written and no connection was opened' });
    return;
  }

  // Fail on a missing connection BEFORE any work, and say which variable.
  requireWriteUrl(process.env);

  try {
    const result = await shopStore._internal.inTransaction({}, function (client) {
      return spec.run(function (text, params) { return client.query(text, params); }, payload);
    });
    out({ command: command, result: result });
  } finally {
    await shopStore.close().catch(function () {});
  }
}

module.exports = {
  claimForOperator, reportBasket, releaseForOperator, peekRequest,
  COMMANDS, usage,
  _internal: { requireWriteUrl, requireWriter, requireTarget, assertReportInvocation, findRequest },
};

if (require.main === module) {
  main().catch(function (e) {
    console.error(e && e.message ? e.message : String(e));
    process.exitCode = 1;
  });
}
