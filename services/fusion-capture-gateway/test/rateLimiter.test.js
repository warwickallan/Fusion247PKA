// F-04 rate limiting — deterministic token bucket + intake-seam wiring.
// Hermetic: injected `now`, no wall-clock, no network.

import test from 'node:test';
import assert from 'node:assert/strict';

import { createRateLimiter } from '../src/security/rateLimiter.js';
import { createInMemoryOperationalStore } from '../src/store/operationalStore.js';
import { createMockTelegramAdapter } from '../src/adapters/telegramAdapter.js';
import { createIntake } from '../src/intake.js';

const AUTH_ID = 424242;

function makeUpdate(messageId, text, fromId = AUTH_ID) {
  return { message: { message_id: messageId, from: { id: fromId }, chat: { id: fromId, type: 'private' }, text } };
}

test('burst is allowed up to capacity, then throttled with a retryAfterMs', () => {
  const rl = createRateLimiter({ capacity: 3, refillPerSec: 1 });
  const t = 1_000_000;
  assert.equal(rl.check('s', t).allowed, true);
  assert.equal(rl.check('s', t).allowed, true);
  assert.equal(rl.check('s', t).allowed, true);
  const fourth = rl.check('s', t);
  assert.equal(fourth.allowed, false, 'capacity exhausted → throttled');
  assert.ok(fourth.retryAfterMs > 0, 'a positive wait is reported');
});

test('bucket refills over time (deterministic, injected now)', () => {
  const rl = createRateLimiter({ capacity: 2, refillPerSec: 1 }); // 1 token / 1000ms
  const t0 = 5_000_000;
  rl.check('s', t0);
  rl.check('s', t0);
  assert.equal(rl.check('s', t0).allowed, false, 'drained');
  // After 1000ms exactly one token has refilled.
  assert.equal(rl.check('s', t0 + 1000).allowed, true, 'one token refilled at +1s');
  assert.equal(rl.check('s', t0 + 1000).allowed, false, 'only one refilled');
  // Refill is clamped to capacity — a long gap does not overflow.
  rl.check('s', t0 + 10_000_000);
  rl.check('s', t0 + 10_000_000);
  assert.equal(rl.check('s', t0 + 10_000_000).allowed, false, 'clamped to capacity, not unbounded');
});

test('buckets are per-sender independent', () => {
  const rl = createRateLimiter({ capacity: 1, refillPerSec: 1 });
  const t = 9_000_000;
  assert.equal(rl.check('a', t).allowed, true);
  assert.equal(rl.check('a', t).allowed, false, 'sender a drained');
  assert.equal(rl.check('b', t).allowed, true, 'sender b has its own bucket');
});

test('wired at intake seam: an authorised flood is bounded — excess NOT durably accepted', async () => {
  const store = createInMemoryOperationalStore();
  const adapter = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
  let t = 2_000_000;
  const clock = { now: () => t };
  const rateLimiter = createRateLimiter({ capacity: 2, refillPerSec: 1 });
  const intake = createIntake({ store, adapter, clock, rateLimiter });

  const r1 = await intake.accept(makeUpdate(1, 'a'));
  const r2 = await intake.accept(makeUpdate(2, 'b'));
  const r3 = await intake.accept(makeUpdate(3, 'c'));

  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);
  assert.equal(r3.ok, false, 'the 3rd message this instant is throttled');
  assert.equal(r3.reason, 'rate_limited');
  assert.ok(r3.retryAfterMs > 0);

  // Fail-closed: the throttled message created NO durable row and NO card.
  assert.equal(store.list().length, 2, 'only the two allowed captures are durable');
  assert.equal(adapter.sentCards.length, 2);

  // After the bucket refills, the (distinct) message is accepted again.
  t += 1000;
  const r4 = await intake.accept(makeUpdate(4, 'd'));
  assert.equal(r4.ok, true, 'accepted after refill');
  assert.equal(store.list().length, 3);
});
