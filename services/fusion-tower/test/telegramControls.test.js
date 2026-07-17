import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';
import { createMemoryStore } from '../src/store/memoryStore.js';
import { createDispatcher } from '../src/dispatcher.js';
import {
  createTelegramControls, parseUpdate, isAuthorised, TERMINAL_NOTICES,
} from '../src/adapters/telegramControls.js';

function wire(env = { AUTHORISED_TELEGRAM_USER_ID: '42' }) {
  const config = loadConfig(env);
  const store = createMemoryStore();
  const dispatcher = createDispatcher({ store, config });
  const controls = createTelegramControls({ config, dispatcher });
  dispatcher.setNotifier(controls.notifier);
  return { config, store, dispatcher, controls };
}

function update({ text, userId = 42, chatType = 'private', updateId = 1 }) {
  return { update_id: updateId, message: { text, from: { id: userId }, chat: { id: userId, type: chatType } } };
}

test('parseUpdate extracts command + args', () => {
  const i = parseUpdate(update({ text: '/start fix the docs typo' }));
  assert.equal(i.command, 'start');
  assert.equal(i.argline, 'fix the docs typo');
  assert.equal(i.known, true);
});

test('allowlist: only the authorised numeric id in a PRIVATE chat', () => {
  assert.equal(isAuthorised(parseUpdate(update({ text: '/status' })), { authorisedUserId: '42' }), true);
  assert.equal(isAuthorised(parseUpdate(update({ text: '/status', userId: 99 })), { authorisedUserId: '42' }), false);
  assert.equal(isAuthorised(parseUpdate(update({ text: '/status', chatType: 'group' })), { authorisedUserId: '42' }), false);
  assert.equal(isAuthorised(parseUpdate(update({ text: '/status' })), { authorisedUserId: null }), false);
});

test('/start creates a run', async () => {
  const { controls, store } = wire();
  const r = await controls.handleUpdate(update({ text: '/start improve the README' }));
  assert.equal(r.ok, true);
  assert.equal(r.command, 'start');
  assert.equal((await store.listRuns()).length, 1);
  assert.equal(r.run.scope, 'improve the README');
});

test('unauthorised update is fail-closed and audited', async () => {
  const { controls } = wire();
  const r = await controls.handleUpdate(update({ text: '/start hack', userId: 999 }));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unauthorised');
  assert.equal(controls.rejected.length, 1);
});

test('/stop terminates the run and surfaces a terminal notice', async () => {
  const { controls } = wire();
  await controls.handleUpdate(update({ text: '/start a task' }));
  const r = await controls.handleUpdate(update({ text: '/stop', updateId: 2 }));
  assert.equal(r.ok, true);
  const notice = controls.outbox.at(-1);
  assert.ok(TERMINAL_NOTICES.includes(notice.kind));
});

test('notifier REFUSES a non-terminal notice kind', async () => {
  const { controls } = wire();
  await assert.rejects(() => controls.notifier.notify('PROGRESS', {}), /not a terminal notice/);
});

test('notifier transport is synthetic-outbox when telegram not live', async () => {
  const { controls, dispatcher } = wire();
  const run = await dispatcher.createRun({ title: 't' });
  await dispatcher.terminate(run.run_id, 'blocked', 'blocked', 'stuck');
  assert.equal(controls.outbox.at(-1).transport, 'synthetic-outbox');
});
