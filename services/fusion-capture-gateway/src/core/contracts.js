// Capture Contract Pack v1 — channel-neutral contract factories + validators.
//
// Source of truth: Builds/BUILD-002-unified-personal-capture-gateway/
//   Contracts/capture-contract-pack-v1.md
//
// FIXTURES ONLY (WP0): pure logic, no I/O, no secrets, no network.
// Validators NEVER throw on bad input — they return a Result:
//   { ok: true,  value }            on success
//   { ok: false, errors: [string] } on failure
//
// Channel-neutral: Telegram is one `source_channel` value among many. No field,
// enum, or default may assume Telegram.

import { STATES, ALL_STATES, TERMINAL_STATES, SAFE_AND_WAITING_STATES } from './states.js';

// ---------------------------------------------------------------------------
// Schema versions (the contract family). Consumers pin on these.
// ---------------------------------------------------------------------------

export const SCHEMA_VERSION = 'v1';

export const ENVELOPE_SCHEMA = 'capture-envelope/v1';
export const ACTION_SCHEMA = 'capture-action/v1';
export const RECEIPT_SCHEMA = 'capture-receipt/v1';

// ---------------------------------------------------------------------------
// Enumerations (§1, §2, §3, §4 of the contract pack)
// ---------------------------------------------------------------------------

export const SOURCE_CHANNELS = Object.freeze([
  'telegram', 'email-inbox', 'web', 'api', 'other',
]);

export const RECORDED_INTENTS = Object.freeze([
  'LarryDirect', 'SaveToBrain', 'ConfirmedAction',
]);

export const TECHNICAL_SOURCE_TYPES = Object.freeze([
  'text', 'voice', 'image', 'photo', 'pdf_office', 'url', 'email', 'youtube', 'unknown',
]);

export const CAPTURE_ACTIONS = Object.freeze([
  'SaveToBrain', 'AskLarry', 'KeepRaw', 'Approve', 'Reject', 'Retry', 'Cancel',
]);

// ---------------------------------------------------------------------------
// Small validation helpers (no throwing)
// ---------------------------------------------------------------------------

const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isBoolean = (v) => typeof v === 'boolean';

// RFC3339 timestamps are validated loosely: a non-empty string that Date can
// parse. We do not enforce strict grammar (WP0 keeps it forgiving), but reject
// obvious non-timestamps.
function isRfc3339(v) {
  if (!isNonEmptyString(v)) return false;
  const t = Date.parse(v);
  return Number.isFinite(t);
}

function checkEnum(errors, obj, field, allowed) {
  const v = obj[field];
  if (!isNonEmptyString(v)) {
    errors.push(`${field}: required non-empty string`);
    return;
  }
  if (!allowed.includes(v)) {
    errors.push(`${field}: "${v}" not one of ${allowed.join('|')}`);
  }
}

function checkString(errors, obj, field) {
  if (!isNonEmptyString(obj[field])) errors.push(`${field}: required non-empty string`);
}

function checkTimestamp(errors, obj, field) {
  if (!isRfc3339(obj[field])) errors.push(`${field}: required RFC3339 timestamp`);
}

function result(errors, value) {
  return errors.length === 0 ? { ok: true, value } : { ok: false, errors };
}

// ---------------------------------------------------------------------------
// 1. Capture Envelope v1
// ---------------------------------------------------------------------------

/**
 * Build a Capture Envelope, filling schema_version. Does not validate — call
 * validateEnvelope() on the result to check.
 */
export function createEnvelope(input = {}) {
  return { schema_version: ENVELOPE_SCHEMA, ...input };
}

function validateRawPayloadRef(errors, ref) {
  if (!isPlainObject(ref)) {
    errors.push('raw_payload_ref: required object');
    return;
  }
  if (!isNonEmptyString(ref.store)) errors.push('raw_payload_ref.store: required non-empty string');
  if (!isNonEmptyString(ref.object_key)) errors.push('raw_payload_ref.object_key: required non-empty string');
  if (!isNonEmptyString(ref.content_type)) errors.push('raw_payload_ref.content_type: required non-empty string');
  if (ref.bytes !== undefined && !(Number.isInteger(ref.bytes) && ref.bytes >= 0)) {
    errors.push('raw_payload_ref.bytes: must be a non-negative integer when present');
  }
  if (ref.sha256 !== undefined && !isNonEmptyString(ref.sha256)) {
    errors.push('raw_payload_ref.sha256: must be a non-empty string when present');
  }
}

function validateOriginalSourceRef(errors, ref) {
  // Conditional field. May be null/absent only for pure inline text.
  if (ref === null || ref === undefined) return;
  if (!isPlainObject(ref)) {
    errors.push('original_source_ref: must be an object when present');
    return;
  }
  const hasStore = isNonEmptyString(ref.store);
  const hasPointer = isNonEmptyString(ref.object_key) || isNonEmptyString(ref.message_ref);
  if (!hasStore && !hasPointer) {
    errors.push('original_source_ref: requires store and (object_key or message_ref) when present');
  }
  // retained must be true throughout the initial build.
  if (ref.retained !== true) {
    errors.push('original_source_ref.retained: must be true throughout initial build');
  }
}

export function validateEnvelope(value) {
  const errors = [];
  if (!isPlainObject(value)) return { ok: false, errors: ['envelope: required object'] };

  if (value.schema_version !== ENVELOPE_SCHEMA) {
    errors.push(`schema_version: expected "${ENVELOPE_SCHEMA}"`);
  }
  checkString(errors, value, 'capture_id');
  checkString(errors, value, 'idempotency_key');
  checkEnum(errors, value, 'source_channel', SOURCE_CHANNELS);
  checkString(errors, value, 'sender_identity_ref');
  checkEnum(errors, value, 'recorded_intent', RECORDED_INTENTS);
  checkEnum(errors, value, 'technical_source_type', TECHNICAL_SOURCE_TYPES);
  validateRawPayloadRef(errors, value.raw_payload_ref);
  validateOriginalSourceRef(errors, value.original_source_ref);
  checkTimestamp(errors, value, 'captured_at');
  checkTimestamp(errors, value, 'received_at');

  // Optional objects, only type-checked when present.
  if (value.channel_context !== undefined && !isPlainObject(value.channel_context)) {
    errors.push('channel_context: must be an object when present');
  }
  if (value.client_meta !== undefined && !isPlainObject(value.client_meta)) {
    errors.push('client_meta: must be an object when present');
  }
  if (value.text_preview !== undefined && typeof value.text_preview !== 'string') {
    errors.push('text_preview: must be a string when present');
  }

  return result(errors, value);
}

// ---------------------------------------------------------------------------
// 2. Capture Action v1
// ---------------------------------------------------------------------------

export function createAction(input = {}) {
  return { schema_version: ACTION_SCHEMA, ...input };
}

export function validateAction(value) {
  const errors = [];
  if (!isPlainObject(value)) return { ok: false, errors: ['action: required object'] };

  if (value.schema_version !== ACTION_SCHEMA) {
    errors.push(`schema_version: expected "${ACTION_SCHEMA}"`);
  }
  checkString(errors, value, 'capture_id');
  checkEnum(errors, value, 'action', CAPTURE_ACTIONS);
  checkString(errors, value, 'action_id');
  checkString(errors, value, 'actor_identity_ref');
  checkTimestamp(errors, value, 'requested_at');

  if (value.params !== undefined && !isPlainObject(value.params)) {
    errors.push('params: must be an object when present');
  }

  return result(errors, value);
}

// ---------------------------------------------------------------------------
// 3. Capture Receipt v1
// ---------------------------------------------------------------------------

export function createReceipt(input = {}) {
  return { schema_version: RECEIPT_SCHEMA, ...input };
}

export function validateReceipt(value) {
  const errors = [];
  if (!isPlainObject(value)) return { ok: false, errors: ['receipt: required object'] };

  if (value.schema_version !== RECEIPT_SCHEMA) {
    errors.push(`schema_version: expected "${RECEIPT_SCHEMA}"`);
  }
  checkString(errors, value, 'capture_id');

  if (!isNonEmptyString(value.state)) {
    errors.push('state: required non-empty string');
  } else if (!ALL_STATES.includes(value.state)) {
    errors.push(`state: "${value.state}" not a known processing state`);
  }

  checkString(errors, value, 'status_line');
  if (!isBoolean(value.is_terminal)) errors.push('is_terminal: required boolean');
  if (!isBoolean(value.safe_and_waiting)) errors.push('safe_and_waiting: required boolean');
  checkTimestamp(errors, value, 'updated_at');

  // Normative wording/consistency rules (§3).
  const state = value.state;

  // completed is only truthful after written AND evidenced pointers exist.
  if (state === STATES.COMPLETED) {
    if (!isPlainObject(value.destination_ref)) {
      errors.push('destination_ref: required object when state is completed');
    }
    if (!isPlainObject(value.evidence_ref)) {
      errors.push('evidence_ref: required object when state is completed');
    }
    if (value.is_terminal !== true) {
      errors.push('is_terminal: must be true when state is completed');
    }
  }

  // safe-and-waiting states must set the flag so cards render offline-safe copy.
  if (SAFE_AND_WAITING_STATES.includes(state) && value.safe_and_waiting !== true) {
    errors.push(`safe_and_waiting: must be true when state is ${state}`);
  }

  // is_terminal must agree with the state machine's terminal set.
  if (isBoolean(value.is_terminal) && isNonEmptyString(state) && ALL_STATES.includes(state)) {
    const shouldBeTerminal = TERMINAL_STATES.includes(state);
    if (value.is_terminal !== shouldBeTerminal) {
      errors.push(`is_terminal: ${value.is_terminal} disagrees with terminal-ness of state "${state}"`);
    }
  }

  // failed/partial must carry an honest failure block.
  if ((state === STATES.FAILED || state === STATES.PARTIAL) && !isPlainObject(value.failure)) {
    errors.push(`failure: required object when state is ${state}`);
  }

  // needs_clarification must carry the question.
  if (state === STATES.NEEDS_CLARIFICATION && !isPlainObject(value.clarification)) {
    errors.push('clarification: required object when state is needs_clarification');
  }

  return result(errors, value);
}
