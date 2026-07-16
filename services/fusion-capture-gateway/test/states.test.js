import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  STATES,
  ALL_STATES,
  TERMINAL_STATES,
  ALLOWED_TRANSITIONS,
  canTransition,
  assertTransition,
  isTerminal,
} from '../src/core/states.js';

test('happy path is fully legal: received → ... → completed', () => {
  const path = [
    STATES.RECEIVED,
    STATES.ACCEPTED,
    STATES.QUEUED,
    STATES.CLAIMED,
    STATES.WRITING,
    STATES.WRITTEN,
    STATES.EVIDENCED,
    STATES.COMPLETED,
  ];
  for (let i = 0; i < path.length - 1; i++) {
    assert.equal(canTransition(path[i], path[i + 1]), true, `${path[i]} → ${path[i + 1]} should be legal`);
  }
});

test('completed is reachable ONLY from evidenced', () => {
  for (const from of ALL_STATES) {
    const legal = canTransition(from, STATES.COMPLETED);
    if (from === STATES.EVIDENCED) {
      assert.equal(legal, true, 'evidenced → completed must be legal');
    } else {
      assert.equal(legal, false, `${from} → completed must be illegal`);
    }
  }
});

test('evidenced is reachable ONLY from written', () => {
  for (const from of ALL_STATES) {
    const legal = canTransition(from, STATES.EVIDENCED);
    if (from === STATES.WRITTEN) {
      assert.equal(legal, true);
    } else {
      assert.equal(legal, false, `${from} → evidenced must be illegal`);
    }
  }
});

test('shortcut jumps to completed are rejected', () => {
  assert.equal(canTransition(STATES.QUEUED, STATES.COMPLETED), false);
  assert.equal(canTransition(STATES.CLAIMED, STATES.COMPLETED), false);
  assert.equal(canTransition(STATES.WRITING, STATES.COMPLETED), false);
  assert.equal(canTransition(STATES.WRITTEN, STATES.COMPLETED), false);
});

test('written may NOT skip straight to completed (must pass through evidenced)', () => {
  assert.equal(canTransition(STATES.WRITTEN, STATES.COMPLETED), false);
  assert.equal(canTransition(STATES.WRITTEN, STATES.EVIDENCED), true);
});

test('offline_queued and queued are mutually reachable safe states', () => {
  assert.equal(canTransition(STATES.QUEUED, STATES.OFFLINE_QUEUED), true);
  assert.equal(canTransition(STATES.OFFLINE_QUEUED, STATES.QUEUED), true);
  assert.equal(canTransition(STATES.OFFLINE_QUEUED, STATES.CLAIMED), true);
});

test('expired-claim reclaim path: claimed → queued → claimed', () => {
  assert.equal(canTransition(STATES.CLAIMED, STATES.QUEUED), true);
  assert.equal(canTransition(STATES.QUEUED, STATES.CLAIMED), true);
});

test('retry resumes: failed → claimed, partial → writing', () => {
  assert.equal(canTransition(STATES.FAILED, STATES.CLAIMED), true);
  assert.equal(canTransition(STATES.PARTIAL, STATES.WRITING), true);
  assert.equal(canTransition(STATES.PARTIAL, STATES.CLAIMED), true);
});

test('any non-terminal can be cancelled; terminals cannot', () => {
  for (const from of ALL_STATES) {
    const legal = canTransition(from, STATES.CANCELLED);
    if (TERMINAL_STATES.includes(from)) {
      assert.equal(legal, false, `${from} is terminal, cannot cancel`);
    } else {
      assert.equal(legal, true, `${from} should allow cancel`);
    }
  }
});

test('terminal states have no outgoing transitions', () => {
  assert.deepEqual(ALLOWED_TRANSITIONS[STATES.COMPLETED], []);
  assert.deepEqual(ALLOWED_TRANSITIONS[STATES.CANCELLED], []);
  assert.equal(isTerminal(STATES.COMPLETED), true);
  assert.equal(isTerminal(STATES.FAILED), false); // terminal-until-retry, not terminal
});

test('assertTransition throws on illegal, returns true on legal', () => {
  assert.equal(assertTransition(STATES.WRITTEN, STATES.EVIDENCED), true);
  assert.throws(() => assertTransition(STATES.QUEUED, STATES.COMPLETED), /Illegal state transition/);
  assert.throws(() => assertTransition('bogus', STATES.QUEUED), /unknown from-state/);
});

test('canTransition is false for unknown states, never throws', () => {
  assert.equal(canTransition('bogus', STATES.QUEUED), false);
  assert.equal(canTransition(STATES.QUEUED, 'bogus'), false);
});
