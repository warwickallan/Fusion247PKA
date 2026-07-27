// BUILD-002 §8/§10 + AC3 — structural gate tests (node --test). The note must carry every required section.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateNoteStructure, REQUIRED_SECTIONS, extractHeadings } from './noteStructure.mjs';

// The canonical template headings, written out literally here (NOT read from the module) so these fixtures stay
// an independent statement of the contract rather than a mirror of the implementation.
const CANONICAL = [
  '## Executive orientation',
  '## What the source says',
  '## Mechanisms, methods & implementation detail',
  '## Tools, people, products & organisations',
  '## Examples & use cases',
  '## Claims & confidence',
  '## Caveats & source gaps',
  '## What this means for Fusion247',
  '## Key concepts & takeaways',
  '## Actions & open questions',
];

// Build a note from a list of headings, each with a line of body text under it.
function noteFrom(headings) {
  return `---\nsource_id: pcR30j-sKxU\n---\n\n# Source note\n\n${
    headings.map((h) => `${h}\n\nSubstantive body text for this section.\n`).join('\n')}`;
}

// A complete note, minus any headings whose text matches one of `drop`.
function noteWithout(...drop) {
  return noteFrom(CANONICAL.filter((h) => !drop.some((d) => h.includes(d))));
}

test('a note with every required section passes', () => {
  const r = validateNoteStructure(noteFrom(CANONICAL));
  assert.equal(r.ok, true);
  assert.deepEqual(r.missing, []);
  assert.equal(r.presentCount, REQUIRED_SECTIONS.length);
  assert.equal(r.requiredCount, 10);
  for (const s of r.present) {
    assert.ok(typeof s.heading === 'string' && s.heading.startsWith('#'), `${s.id} reports its heading`);
    assert.ok(s.line > 0, `${s.id} reports a line number`);
  }
});

test('a note missing one section fails and names the missing one', () => {
  const r = validateNoteStructure(noteWithout('Caveats & source gaps'));
  assert.equal(r.ok, false);
  assert.equal(r.missingCount, 1);
  assert.deepEqual(r.missingIds, ['caveats_gaps']);
  assert.match(r.missing[0].label, /Caveats/);
  assert.equal(r.presentCount, 9);
});

test('a note missing several sections names all of them', () => {
  const r = validateNoteStructure(noteWithout('Mechanisms', 'Examples & use cases', 'Actions & open questions'));
  assert.equal(r.ok, false);
  assert.deepEqual(r.missingIds.slice().sort(), ['actions_open_questions', 'examples', 'mechanisms']);
  assert.equal(r.presentCount, 7);
  assert.equal(r.missingCount, 3);
});

test('an empty string fails with every section missing', () => {
  const r = validateNoteStructure('');
  assert.equal(r.ok, false);
  assert.equal(r.headingCount, 0);
  assert.equal(r.presentCount, 0);
  assert.equal(r.missingCount, REQUIRED_SECTIONS.length);
  assert.deepEqual(r.missingIds, REQUIRED_SECTIONS.map((s) => s.id));
});

test('a whitespace-only note fails the same way as an empty one', () => {
  const r = validateNoteStructure('   \n\n\t\n');
  assert.equal(r.ok, false);
  assert.equal(r.missingCount, REQUIRED_SECTIONS.length);
});

test('heading level, case and whitespace variation still passes', () => {
  const varied = [
    '#    EXECUTIVE   ORIENTATION',                        // level 1, upper case, padded/internal whitespace
    '###### what the source says',                          // level 6, lower case
    '### Mechanisms, methods and implementation detail ###', // closed ATX, "and" instead of "&"
    '  ## **Tools, people, products & organisations**',      // leading indent, emphasis
    '## Examples & Use Cases:',                              // trailing punctuation, title case
    '## Key claims & confidence',                            // extra leading word
    '## Caveats & Source Gaps   ',                           // trailing whitespace
    '## What this means for Fusion 247',                     // spaced product name
    '## KEY CONCEPTS & TAKEAWAYS',                           // upper case
    '## Actions & open questions',
  ];
  const r = validateNoteStructure(noteFrom(varied));
  assert.equal(r.ok, true, `unexpected misses: ${r.missingIds.join(', ')}`);
  assert.equal(r.presentCount, 10);
});

test('section names appearing only in prose do not count — the gate is heading-anchored', () => {
  const prose = `# Source note\n\n${CANONICAL.map((h) => h.replace(/^##\s*/, '')).join('. ')}.\n`;
  const r = validateNoteStructure(prose);
  assert.equal(r.ok, false);
  assert.equal(r.presentCount, 0);
});

test('headings inside a fenced code block do not satisfy a section', () => {
  const fenced = `${noteWithout('Actions & open questions')}\n\n\`\`\`markdown\n## Actions & open questions\n\`\`\`\n`;
  const r = validateNoteStructure(fenced);
  assert.equal(r.ok, false);
  assert.deepEqual(r.missingIds, ['actions_open_questions']);
});

test('a near-miss heading does not satisfy the claims section', () => {
  // "Claims" alone is not the contract's requirement — claims must be separated from fact and carry confidence.
  const r = validateNoteStructure(noteFrom(CANONICAL.map((h) => (h === '## Claims & confidence' ? '## Claims' : h))));
  assert.equal(r.ok, false);
  assert.deepEqual(r.missingIds, ['claims_confidence']);
});

test('sections reports every required section in canonical order, present or not', () => {
  const r = validateNoteStructure(noteWithout('Executive orientation'));
  assert.deepEqual(r.sections.map((s) => s.id), REQUIRED_SECTIONS.map((s) => s.id));
  assert.equal(r.sections[0].present, false);
  assert.equal(r.sections[0].heading, null);
  assert.equal(r.sections[0].line, null);
  assert.equal(r.sections[1].present, true);
});

test('extractHeadings ignores frontmatter body text and reports 1-based lines', () => {
  const hs = extractHeadings('---\ntitle: x\n---\n\n## Executive orientation\n\nbody\n');
  assert.equal(hs.length, 1);
  assert.equal(hs[0].line, 5);
  assert.equal(hs[0].text, 'executive orientation');
});

test('a non-string input is rejected rather than silently failing', () => {
  assert.throws(() => validateNoteStructure(null), TypeError);
  assert.throws(() => validateNoteStructure(undefined), TypeError);
  assert.throws(() => validateNoteStructure({ body: '## Executive orientation' }), TypeError);
});
