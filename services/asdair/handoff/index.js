// =====================================================================
// BUILD-015 AsdAIr - handoff/index.js
//
// THE PUBLIC SURFACE OF THE SONNET HANDOFF MODULE.
//
// These are the exact signatures Larry wires. Nothing else in this folder is
// intended to be imported from outside it.
//
//   buildHandoff(packet) -> handoff
//       PURE. Validates and asserts the packet, returns the durable artefact.
//       Throws PacketContractError. No clock: the same packet always produces a
//       byte-identical artefact, which is what makes the handoff idempotent.
//
//   renderChecklist(handoff) -> string
//       PURE. The phone-readable Markdown rendering of the SAME artefact.
//
//   openHandoff(query, { shopId, handoff, openedBy?, allowAfterComplete? })
//       -> { request, created, resumed, superseded }
//       Idempotently establishes exactly ONE live asdair.browser_build_request
//       for the shop, bound to this packet's fingerprint.
//       Throws LiveWriterError / AlreadyCompleteError.
//
//   claimHandoff(query, { shopId | requestId, writerId, leaseMs? }) -> row | null
//   heartbeat(query, { requestId, writerId, leaseMs? }) -> expires_at
//   reportProgress(query, { requestId, writerId, progress, lastError? }) -> row
//   releaseHandoff(query, { requestId, writerId, reason? }) -> row | null
//   completeHandoff(query, { requestId, writerId, packetFingerprint, report?, status?, lastError? })
//       -> { request, alreadyComplete }
//   peekHandoff(query, { shopId? | requestId? }) -> row | rows
//
//   ingestCompletion(handoff, report) -> reconciler input structure
//       PURE. Throws CompletionContractError, including SUPERSEDED_PACKET.
//
// `query` is ALWAYS injected: `(text, params) => Promise<{rows}>`. This module
// has zero dependencies and never imports `pg` or opens a connection.
//
// PURE ASCII SOURCE ONLY.
// =====================================================================
'use strict';

const { buildHandoff, PacketContractError, HANDOFF_VERSION, SORT_CONTRACT, normalizeSortKey, identityKey } = require('./buildHandoff');
const { renderChecklist } = require('./renderChecklist');
const { fingerprintPacket, sameFingerprint } = require('./fingerprint');
const {
  ingestCompletion, toBasketObservation, toVerifyBasketArgs, assertVerifyBasketExpected,
  CompletionContractError, INGEST_VERSION,
} = require('./completion');
const claim = require('./claim');
const instructions = require('./instructions');
const {
  buildHandoffFromDb, readReconciledShop, toPacket,
  ReconciliationError, READY_STATUS, BRAND_SENTINEL,
} = require('./readReconciled');

module.exports = {
  // THE PRODUCTION PATH - the handoff built from the reconciled database rows
  // rather than from a side-artefact somebody wrote earlier. Refuses to emit
  // while shop.status is not READY_TO_SHOP.
  buildHandoffFromDb,
  readReconciledShop,
  toPacket,
  ReconciliationError,
  READY_STATUS,
  BRAND_SENTINEL,

  // pure artefact
  buildHandoff,
  renderChecklist,
  fingerprintPacket,
  sameFingerprint,
  PacketContractError,
  HANDOFF_VERSION,
  SORT_CONTRACT,

  // Public so the cross-module pin against packet/buildExecutionPacket.js's
  // exported normalizeSortKey can be written. The mirror is an obligation.
  normalizeSortKey,
  identityKey,

  // durable lifecycle
  openHandoff: claim.openHandoff,
  claimHandoff: claim.claimHandoff,
  heartbeat: claim.heartbeat,
  reportProgress: claim.reportProgress,
  releaseHandoff: claim.releaseHandoff,
  completeHandoff: claim.completeHandoff,
  peekHandoff: claim.peekHandoff,
  LeaseLostError: claim.LeaseLostError,
  LiveWriterError: claim.LiveWriterError,
  AlreadyCompleteError: claim.AlreadyCompleteError,
  HandoffStateError: claim.HandoffStateError,
  DEFAULT_LEASE_MS: claim.DEFAULT_LEASE_MS,
  DEFAULT_HEARTBEAT_MS: claim.DEFAULT_HEARTBEAT_MS,

  // completion ingestion. Prefer toVerifyBasketArgs - it is the one correct way
  // to build the verifyBasket call, and it refuses the handoff as `expected`.
  ingestCompletion,
  toBasketObservation,
  toVerifyBasketArgs,
  assertVerifyBasketExpected,
  CompletionContractError,
  INGEST_VERSION,

  // the pinned method and boundaries
  instructions,
};
