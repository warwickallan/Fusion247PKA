import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify } from './classify.mjs';
import { LANE, INTENT, PRIVACY, ACTION } from './contracts.mjs';

test('YouTube URL → encyclopedia/learn, confirm-first', () => {
  const d = classify({ capture_id: 'c1', url: 'https://youtu.be/abc123' });
  assert.equal(d.lane, LANE.ENCYCLOPEDIA);
  assert.equal(d.intent, INTENT.LEARN);
  assert.equal(d.privacy, PRIVACY.WORLD);
  assert.equal(d.action, ACTION.CONFIRM);
});

test('journal → personal lane, never external', () => {
  const d = classify({ capture_id: 'c2', text: 'Journal: shit day, feeling flat' });
  assert.equal(d.lane, LANE.PERSONAL);
  assert.equal(d.privacy, PRIVACY.PERSONAL);
  assert.notEqual(d.lane, LANE.ENCYCLOPEDIA);
});

test('task/reminder → task lane', () => {
  const d = classify({ capture_id: 'c3', text: 'remind me to call the dentist tomorrow' });
  assert.equal(d.lane, LANE.TASK);
  assert.equal(d.intent, INTENT.TASK);
});

test('ambiguous → ask (does NOT guess)', () => {
  const d = classify({ capture_id: 'c4', text: 'some loose thought about widgets and things' });
  assert.equal(d.lane, LANE.UNKNOWN);
  assert.equal(d.action, ACTION.ASK);
});

test('explicit instruction outranks inference (journal marker beats YouTube URL)', () => {
  const d = classify({ capture_id: 'c5', url: 'https://youtube.com/watch?v=x', text: '#journal a thought while watching this' });
  assert.equal(d.lane, LANE.PERSONAL);
  assert.equal(d.action, ACTION.ACT); // explicit → act
});

test('privacy fails closed — personal/health never routes to the encyclopedia', () => {
  const d = classify({ capture_id: 'c6', text: 'blood pressure medication review with my family' });
  assert.equal(d.privacy, PRIVACY.PERSONAL);
  assert.equal(d.lane, LANE.PERSONAL);
  assert.notEqual(d.lane, LANE.ENCYCLOPEDIA);
});

test('work/Bellrock → walled work lane', () => {
  const d = classify({ capture_id: 'c7', text: 'Bellrock client SLA change for the Concerto rollout' });
  assert.equal(d.privacy, PRIVACY.WORK);
  assert.equal(d.lane, LANE.WORK);
});

test('learned feedback raises confidence', () => {
  const fb = [{ pattern_key: 'url_host:medium.com', correct_lane: LANE.ENCYCLOPEDIA, correct_intent: INTENT.LEARN, weight: 3 }];
  const d = classify({ capture_id: 'c8', url: 'https://medium.com/some-article' }, { feedback: fb });
  assert.equal(d.decided_by, 'learned');
  assert.ok(d.confidence >= 0.75);
});
