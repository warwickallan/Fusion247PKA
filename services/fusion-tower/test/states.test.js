import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canTransitionRun, canTransitionTurn, isTerminalRunStatus,
  assertRunTransition, assertTurnTransition, RUN_STATUS, TURN_STATE,
  RESPONDER_PRINCIPALS, PRINCIPAL,
} from '../src/core/states.js';

test('run transitions match the schema lifecycle', () => {
  assert.ok(canTransitionRun(RUN_STATUS.CREATED, RUN_STATUS.ACTIVE));
  assert.ok(canTransitionRun(RUN_STATUS.ACTIVE, RUN_STATUS.AWAITING_RESPONDER));
  assert.ok(canTransitionRun(RUN_STATUS.AWAITING_RESPONDER, RUN_STATUS.ACTIVE));
  assert.ok(canTransitionRun(RUN_STATUS.ACTIVE, RUN_STATUS.COMPLETED));
  assert.ok(!canTransitionRun(RUN_STATUS.COMPLETED, RUN_STATUS.ACTIVE), 'terminal has no outgoing edge');
  assert.throws(() => assertRunTransition(RUN_STATUS.BLOCKED, RUN_STATUS.ACTIVE), /illegal run transition/);
});

test('terminal run statuses', () => {
  assert.ok(isTerminalRunStatus(RUN_STATUS.BLOCKED));
  assert.ok(isTerminalRunStatus(RUN_STATUS.TIMED_OUT));
  assert.ok(!isTerminalRunStatus(RUN_STATUS.ACTIVE));
});

test('turn transitions match the schema lifecycle', () => {
  assert.ok(canTransitionTurn(TURN_STATE.PENDING, TURN_STATE.DISPATCHED));
  assert.ok(canTransitionTurn(TURN_STATE.DISPATCHED, TURN_STATE.RETURNED));
  assert.ok(canTransitionTurn(TURN_STATE.DISPATCHED, TURN_STATE.TIMED_OUT));
  assert.ok(!canTransitionTurn(TURN_STATE.RETURNED, TURN_STATE.DISPATCHED));
  assert.throws(() => assertTurnTransition(TURN_STATE.PENDING, TURN_STATE.RETURNED), /illegal turn transition/);
});

test('responder principals exclude tower', () => {
  assert.ok(RESPONDER_PRINCIPALS.includes(PRINCIPAL.LARRY));
  assert.ok(!RESPONDER_PRINCIPALS.includes(PRINCIPAL.TOWER));
});
