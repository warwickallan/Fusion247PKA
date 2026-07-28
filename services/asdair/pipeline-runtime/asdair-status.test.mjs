// =====================================================================
// BUILD-015 AsdAIr Stage 1 - asdair-status.test.mjs
//
// The health surface's pure halves: what it makes of a runtime event log, and
// what it makes of the offset file. The parts that talk to the OS and to
// Postgres are exercised for real by proof/run-proofs.mjs.
//
// The cases that matter most here are the HONEST-ANSWER ones - a missing offset
// file must read as "nothing has ever been consumed", not as an error and not
// as zero, because "nothing has been consumed" is a load-bearing claim when
// somebody is deciding whether the week's list is still safe.
//
// Offline. No credentials, no network, no database.
// =====================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { summariseEvents, readOffset, readEventLog } from './asdair-status.mjs';

function tmpFile(name, body) {
  const f = path.join(os.tmpdir(), `asdair-status-test-${name}-${process.pid}-${Math.random().toString(36).slice(2)}`);
  if (body !== undefined) fs.writeFileSync(f, body);
  return f;
}

test('the last pass, the last poll and the last error are picked out of the event stream', () => {
  const s = summariseEvents([
    '{"event":"fetched","count":1,"offset":10}',
    '{"event":"emitted","updateId":11}',
    '{"event":"pass","pass":0,"stepped":1,"shops":1}',
    '{"event":"send_failed","kind":"plan_ready","detail":"telegram 502"}',
    '{"event":"fetched","count":0,"offset":11}',
    '{"event":"pass","pass":1,"stepped":0,"shops":1}',
  ]);
  assert.equal(s.last_pass.pass, 1);
  assert.equal(s.last_poll.offset, 11);
  assert.equal(s.last_error.event, 'send_failed');
  assert.equal(s.offset_held, false);
});

test('a HELD offset is surfaced by name - "nothing is happening" is not the same as "nothing to do"', () => {
  const s = summariseEvents([
    '{"event":"fetched","count":1,"offset":10}',
    '{"event":"failed_offset_held","updateId":11,"error":"photo download failed"}',
  ]);
  assert.equal(s.offset_held, true);
  assert.equal(s.last_error.event, 'failed_offset_held');
});

test('a torn final line does not break the summary', () => {
  const s = summariseEvents(['{"event":"pass","pass":0}', '{"event":"pas']);
  assert.equal(s.events_parsed, 1);
  assert.equal(s.last_pass.pass, 0);
});

test('non-JSON noise in the log is ignored rather than fatal', () => {
  const s = summariseEvents(['runtime error: boom', '', '{"event":"pass","pass":3}']);
  assert.equal(s.events_parsed, 1);
  assert.equal(s.last_pass.pass, 3);
});

test('an empty event stream reports nothing rather than inventing a last pass', () => {
  const s = summariseEvents([]);
  assert.equal(s.events_parsed, 0);
  assert.equal(s.last_pass, null);
  assert.equal(s.last_poll, null);
  assert.equal(s.last_error, null);
});

test('a MISSING offset file means nothing has ever been consumed - and says so', () => {
  const o = readOffset(tmpFile('absent'));
  assert.equal(o.exists, false);
  assert.equal(o.last_update_id, null);
  assert.equal(o.consumed, false);
  assert.match(o.note, /never acknowledged an update, so nothing has been consumed/);
});

test('a written offset file is reported with its value and its stamp', () => {
  const f = tmpFile('present', JSON.stringify({ last_update_id: 4711, updated_at: '2026-07-27T09:00:00.000Z' }));
  const o = readOffset(f);
  assert.equal(o.exists, true);
  assert.equal(o.last_update_id, 4711);
  assert.equal(o.consumed, true);
  assert.equal(o.updated_at, '2026-07-27T09:00:00.000Z');
});

test('a CORRUPT offset file is an error, never silently reported as "nothing consumed"', () => {
  const f = tmpFile('corrupt', '{ not json');
  const o = readOffset(f);
  assert.equal(o.exists, true);
  assert.equal(o.consumed, null, 'null means UNKNOWN - claiming false here would be claiming the list is safe');
  assert.match(o.error, /unreadable/);
});

test('the event log is read from its TAIL, so a long-running runtime stays cheap to inspect', () => {
  const f = tmpFile('big', '');
  const filler = `${JSON.stringify({ event: 'pass', pass: 0, pad: 'x'.repeat(400) })}\n`;
  for (let i = 0; i < 500; i += 1) fs.appendFileSync(f, filler);
  fs.appendFileSync(f, `${JSON.stringify({ event: 'pass', pass: 999 })}\n`);
  const log = readEventLog(f);
  assert.equal(log.exists, true);
  assert.equal(log.truncated, true, 'more than the tail window was written');
  assert.equal(log.last_pass.pass, 999, 'the tail must still yield the most recent facts');
});

test('a missing log reports absence rather than throwing', () => {
  const log = readEventLog(tmpFile('nolog'));
  assert.equal(log.exists, false);
});
