import test from 'node:test';
import assert from 'node:assert/strict';
import { formatLearningFollowOn } from './learning-follow-on.mjs';

test('system candidate handoff is understandable without conversational context', () => {
  const out = formatLearningFollowOn({
    candidate_scope: 'system_improvement', candidate_ref: 'OWAI:cerebras:A',
    recommendation: 'Add relationship-aware Cairn routing for graph-heavy sources.',
    proposed_target: 'cairn', candidate_kind: 'cairn_routing', source_title: 'Cerebras agent systems',
    source_video_id: 'cerebras', evidence: 'Graph concepts: Graph-Structured Agent Memory',
    why: 'The source shows relationship structure carries operational meaning.',
    expected_effect: 'Fewer flattened sources.', confidence: '0.82',
    risk: 'Invalid if TubeAIR already retains this structure.',
    next_step: 'Compare three source packets.',
  }, { id: 'cmd-1', requested_by: 'report:warwick', requested_at: '2026-07-24T12:00:00Z' });
  assert.equal(out.correlationId, 'OWAI:cerebras:A');
  for (const expected of ['Requested improvement:', 'Source / graph evidence:', 'Expected effect:',
    'Risk / what would invalidate it:', 'Concrete next step:', 'Warwick approval:',
    'did not mutate canonical MyPKA']) assert.match(out.detail, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
