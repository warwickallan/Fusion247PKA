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

test('explicit "Honch that" → Honcho lane, remember, act', () => {
  const d = classify({ capture_id: 'h1', text: 'Honch that — Warwick prefers building for scale within reasonable cost' });
  assert.equal(d.lane, LANE.HONCHO);
  assert.equal(d.intent, INTENT.REMEMBER);
  assert.equal(d.action, ACTION.ACT);
});

test('email SUBJECT "Honcho that" is caught (subject-aware)', () => {
  const d = classify({ capture_id: 'h2', subject: 'Honcho that', source_type: 'email', text: 'He always prefers to build to the goal, not a narrow slice.' });
  assert.equal(d.lane, LANE.HONCHO);
  assert.equal(d.action, ACTION.ACT);
});

test('an ordinary email with a YouTube link → encyclopedia (Cairn owns routing, not the mailbox)', () => {
  const d = classify({ capture_id: 'h3', source_type: 'email', subject: 'Great video', text: 'thought you\'d like https://youtu.be/abc123' });
  assert.equal(d.lane, LANE.ENCYCLOPEDIA);
  assert.equal(d.intent, INTENT.LEARN);
});

test('an email with no clear signal → ask (fails safe, does not guess Honcho)', () => {
  const d = classify({ capture_id: 'h4', source_type: 'email', subject: 'Fwd:', text: 'see below' });
  assert.equal(d.lane, LANE.UNKNOWN);
  assert.equal(d.action, ACTION.ASK);
});

test('learned feedback raises confidence', () => {
  const fb = [{ pattern_key: 'url_host:medium.com', correct_lane: LANE.ENCYCLOPEDIA, correct_intent: INTENT.LEARN, weight: 3 }];
  const d = classify({ capture_id: 'c8', url: 'https://medium.com/some-article' }, { feedback: fb });
  assert.equal(d.decided_by, 'learned');
  assert.ok(d.confidence >= 0.75);
});
