import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSystemImprovementPrompt,
  normaliseSystemCandidates,
  systemCandidateRef,
} from './systemImprovements.mjs';

test('stable candidate refs are source-scoped and human-friendly', () => {
  assert.equal(systemCandidateRef('cerebras-123', 0), 'OWAI:cerebras-123:A');
  assert.equal(systemCandidateRef('cerebras-123', 3), 'OWAI:cerebras-123:D');
});

test('normaliser retains only specific, evidenced, allowed candidates', () => {
  const rows = normaliseSystemCandidates([
    {
      target: 'Cairn', kind: 'cairn_routing',
      proposed_change: 'Add a source-complexity signal to Cairn so graph-heavy sources request a relationship-preserving TubeAIR treatment.',
      why: 'The source shows that useful agent knowledge depends on retaining the relationships between system actors.',
      cites: ['Graph-Structured Agent Memory'],
      evidence_reasoning: 'The cited concept makes relationship preservation, rather than flat keyword retention, the operative mechanism.',
      expected_effect: 'Fewer relationship-bearing sources enter LightRAG as flattened prose.',
      confidence: 0.82,
      risk: 'Invalid if TubeAIR already preserves the same relationship structure for every source class.',
      next_step: 'Compare Cairn decisions and TubeAIR outputs for three graph-heavy learned sources.',
    },
    {
      target: 'workflow', kind: 'workflow', proposed_change: 'Use more AI', why: 'generic filler that should be rejected',
      cites: ['Graph-Structured Agent Memory'], evidence_reasoning: 'not specific enough', expected_effect: 'better',
      confidence: 0.9, risk: 'unknown', next_step: 'think about it later',
    },
    {
      target: 'cairn', kind: 'cairn_routing',
      proposed_change: 'Route sources differently based on their graph density and entity relationships.',
      why: 'Specific but it cites a concept absent from this source.', cites: ['Invented Concept'],
      evidence_reasoning: 'The invented concept allegedly supports the change.', expected_effect: 'Better source routing outcomes.',
      confidence: 0.7, risk: 'Invalid if the signal has no predictive value.', next_step: 'Run a bounded routing experiment.',
    },
  ], { sourceConcepts: ['Graph-Structured Agent Memory'] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].target, 'cairn');
  assert.deepEqual(rows[0].cites, ['Graph-Structured Agent Memory']);
});

test('prompt keeps source evidence separate from current-system context and names the governance seam', () => {
  const prompt = buildSystemImprovementPrompt({
    source: {
      source_id: 'vid-1', title: 'Cerebras agent systems', why: 'It connects memory to orchestration.',
      new: ['Graph-Structured Agent Memory'], connected: ['Cairn'], evidence: { passage: 'Agents need durable, inspectable state.' },
    },
    lens: { enduring: [], active: ['Fusion247'], emerging: [], goals: [], negative_signals: [] },
    limit: 3,
  });
  assert.match(prompt, /the only source whose evidence may support/i);
  assert.match(prompt, /candidate -> Warwick decision -> follow_on_task -> Larry resume consumer/i);
  assert.match(prompt, /Accept authorises governed investigation\/implementation; it never silently mutates canonical MyPKA/i);
  assert.match(prompt, /Graph-Structured Agent Memory/);
});
