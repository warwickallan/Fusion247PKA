// Arc quality correction — executable acceptance tests for the deterministic/pure logic (TQA-002 evidence).
// Covers the parts that do NOT need a live model: source-core stripping (AC-01), deterministic tiering (AC-02),
// T1/T2 atom normalisation incl. admission + provenance carry (AC-04/AC-06 shaping), content-hash identity /
// duplicate control (AC-07/AC-08), and verbatim-evidence verification (AC-05). Run: node --test arc.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tierOf, stripInterpretation, normalize } from '../arc.mjs';
import { atomKey, verifyEvidence } from '../atom-register.mjs';

const NOTE = `---
type: source-knowledge-note
video_id: vJEy3nP2_C8
tags:
  - youtube
---
## Executive orientation
A podcast about managing AI agents.
## What the source says
The engineering-is-going-away belief is wrong: you become MORE technical. Sahil Bloom built a following in public.
## Mechanisms, methods & implementation detail
Cloud VM per session; anti-lag brake+throttle.
## What this means for Fusion247
This maps onto the Outputs Layer and Tower — a pre-written Fusion transfer conclusion Arc must NOT consume.
## Key concepts & takeaways
Manager-of-agents; model routing.
## Actions & open questions
Warwick might consider a watchdog — another pre-written interpretation Arc must NOT consume.`;

test('AC-01 stripInterpretation removes frontmatter + interpretation sections, retains source substance', () => {
  const core = stripInterpretation(NOTE);
  // frontmatter gone
  assert.ok(!core.startsWith('---'), 'YAML frontmatter should be stripped');
  assert.ok(!/type: source-knowledge-note/.test(core), 'frontmatter keys stripped');
  // interpretation sections gone (both headings + their bodies)
  assert.ok(!/What this means for Fusion247/.test(core), '"What this means for Fusion247" heading stripped');
  assert.ok(!/pre-written Fusion transfer conclusion/.test(core), 'interpretation body stripped');
  assert.ok(!/Actions & open questions/.test(core), '"Actions & open questions" heading stripped');
  assert.ok(!/Warwick might consider a watchdog/.test(core), 'actions body stripped');
  // factual substance retained
  assert.ok(/What the source says/.test(core), 'factual reconstruction retained');
  assert.ok(/Sahil Bloom/.test(core), 'named exemplar retained');
  assert.ok(/more technical/i.test(core), 'counterintuitive reversal retained');
  assert.ok(/Mechanisms, methods/.test(core), 'mechanisms retained');
  assert.ok(/Key concepts/.test(core), 'source-derived themes retained');
});

test('AC-01 a stub with no frontmatter/interpretation is returned intact', () => {
  const stub = '> Extracted + RAW preserved — note generating…';
  assert.equal(stripInterpretation(stub), stub);
});

test('AC-02 tierOf is deterministic on substance length', () => {
  assert.equal(tierOf(42442), 'rich');   // vJEy3nP2 transcript → T2
  assert.equal(tierOf(13338), 'rich');   // Audi → T2
  assert.equal(tierOf(12000), 'rich');   // boundary inclusive
  assert.equal(tierOf(11999), 'medium');
  assert.equal(tierOf(1500), 'medium');  // boundary
  assert.equal(tierOf(1499), 'thin');
  assert.equal(tierOf(379), 'thin');     // near-empty air-fryer
});

test('AC-04/AC-06 normalize: T2 carries frames + convergence + admission; T1 is single/no-frames', () => {
  const t2 = normalize({
    spin: { situation: 's' }, source_evidence: { quote: 'q', timestamp: '[00:00]' },
    transfer_reasoning: 'r', fusion_target: 'Outputs Layer', category: 'brain', lens: 'mechanism',
    domain: 'reputation', admission: { obvious: true, value: 'high', kind: 'validation' },
    contributing_frames: ['F1-mechanism', 'F6-reputation-career'], convergence_type: 'novel_independent',
    forced_analogy: false, graph_note: 'g', nvfi: { impact: 4 },
  }, 'T2');
  assert.equal(t2.engine, 'T2');
  assert.deepEqual(t2.frames, ['F1-mechanism', 'F6-reputation-career']);
  assert.equal(t2.convergence, 'novel_independent');
  assert.equal(t2.admission.kind, 'validation'); // obvious+high-value KEPT and tagged (AC-04)
  assert.equal(t2.domain, 'reputation');

  const t1 = normalize({ spin: {}, source_evidence: {}, fusion_target: 'x', category: 'cash' }, 'T1');
  assert.equal(t1.engine, 'T1');
  assert.deepEqual(t1.frames, []);
  assert.equal(t1.convergence, 'single');
  assert.equal(t1.category, 'cash');
});

test('AC-07/AC-08 atomKey: same transfer → same key (idempotent); different → different (no collision)', () => {
  const a = { origin: 'production', source_ref: 'v1', fusion_target: 'Outputs Layer', transfer_reasoning: 'r1' };
  const b = { origin: 'production', source_ref: 'v1', fusion_target: 'Outputs Layer', transfer_reasoning: 'r1' };
  const c = { origin: 'production', source_ref: 'v1', fusion_target: 'Outputs Layer', transfer_reasoning: 'r2' };
  assert.equal(atomKey(a), atomKey(b), 'identical transfer → identical key (upsert idempotent)');
  assert.notEqual(atomKey(a), atomKey(c), 'different reasoning → different key (no content-swap)');
  assert.equal(atomKey(a).length, 64, 'sha256 hex key');
});

test('AC-05 verifyEvidence flags verbatim vs paraphrased quotes (never silently trusts)', () => {
  const src = 'you become MORE technical, not less, as you manage agents';
  assert.equal(verifyEvidence({ quote: 'you become MORE technical' }, src).verified, true);
  assert.equal(verifyEvidence({ quote: 'engineers get deskilled over time' }, src).verified, false);
  assert.equal(verifyEvidence({ quote: '' }, src).verified, false);
});
