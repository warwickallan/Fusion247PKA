// BUILD-002 WP4 — fileInboundDecision unit tests (fake DB client; no live connection).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileInboundDecision } from './file-inbound-decision.mjs';
import { decisionCallbackData } from '../../hub/decision/telegramInbound.mjs';

function fakeClient({ rowCount = 1 } = {}) {
  const calls = [];
  return { calls, async query(sql, params) { calls.push({ sql, params }); return { rowCount, rows: rowCount ? [{ id: 'row-1' }] : [] }; } };
}

test('an authorised decision tap is mapped + filed as a decision_response', async () => {
  const db = fakeClient();
  const update = { callback_query: { id: 'cb1', data: decisionCallbackData('card-9', 'A'), from: { id: 42 } } };
  const r = await fileInboundDecision(db, update, { authorizedUserId: 42, keyPrefix: 't-' });
  assert.equal(r.filed, true);
  assert.equal(r.card_id, 'card-9');
  assert.equal(r.raw_text, 'A');
  assert.match(db.calls[0].sql, /insert into cockpit\.decision_response/);
  assert.equal(db.calls[0].params[0], 'card-9');
});

test('an UNAUTHORISED sender files nothing (default-deny), no DB write', async () => {
  const db = fakeClient();
  const update = { callback_query: { id: 'cb2', data: decisionCallbackData('card-9', 'A'), from: { id: 999 } } };
  const r = await fileInboundDecision(db, update, { authorizedUserId: 42 });
  assert.equal(r.filed, false);
  assert.equal(r.reason, 'unauthorized_sender');
  assert.equal(db.calls.length, 0, 'no DB write for an unauthorised tap');
});

test('a non-decision update files nothing', async () => {
  const db = fakeClient();
  const r = await fileInboundDecision(db, { callback_query: { id: 'x', data: 'SaveToBrain', from: { id: 42 } } }, { authorizedUserId: 42 });
  assert.equal(r.filed, false);
  assert.equal(db.calls.length, 0);
});

test('a re-delivered tap does not double-file (idempotent — DO NOTHING returns 0 rows)', async () => {
  const db = fakeClient({ rowCount: 0 });
  const update = { callback_query: { id: 'cb3', data: decisionCallbackData('card-9', 'B'), from: { id: 42 } } };
  const r = await fileInboundDecision(db, update, { authorizedUserId: 42 });
  assert.equal(r.filed, false, 'filed=false when the conflict clause inserted nothing');
});
