// workbench.slug.test.mjs — regression test for the non-Latin / emoji /
// punctuation-only fleeting-note + journal slug FALLBACK fix (v3.0.1).
// Run: `node server/workbench.slug.test.mjs` from the Expansion root.
//
// Before the fix, slugifyTitle() was ASCII-only, so a non-empty title made
// entirely of Korean/Chinese/Cyrillic/emoji/punctuation slugified to '' and
// createWorkbenchDoc()/createJournalEntry() returned bad-title (400) — capture
// was BLOCKED purely on the title's character set. The fix:
//   * falls back to a safe generated slug (workbench: `fleeting-<stamp>`;
//     journal: `<date>-entry`) that passes SLUG_RE + the containment jail,
//   * PRESERVES the human title (workbench: prepended H1 → deriveTitle recovers
//     it; journal: the existing `title:` frontmatter already carries it),
//   * keeps EVERY security guard intact: a path-like title still 400s, reserved
//     names still reserved, ASCII slugs unchanged, no silent overwrite.
//
// This test writes into the REAL PKM jail (same as workbench.attachments.test.mjs)
// and deletes exactly what it created.

import fs from 'node:fs';
import assert from 'node:assert';
import {
  slugifyTitle, createWorkbenchDoc, readWorkbenchDoc, deleteWorkbenchDoc,
} from './workbench.js';
import { createJournalEntry } from './journalEntries.js';

let pass = 0, fail = 0;
const cleanupWb = [];
const cleanupJ = [];
function check(name, fn) {
  try { fn(); console.log(`  ok  — ${name}`); pass++; }
  catch (e) { console.error(`  FAIL — ${name}\n        ${e.message}`); fail++; }
}
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;

// --- slugifyTitle ASCII behavior UNCHANGED ---
check('slugify "c" → "c"',                 () => assert.strictEqual(slugifyTitle('c'), 'c'));
check('slugify "Test Note" → "test-note"', () => assert.strictEqual(slugifyTitle('Test Note'), 'test-note'));
check('slugify "café" → "cafe"',           () => assert.strictEqual(slugifyTitle('café'), 'cafe'));
check('slugify "한글 메모" → ""',          () => assert.strictEqual(slugifyTitle('한글 메모'), ''));
check('slugify "!!!" → ""',                () => assert.strictEqual(slugifyTitle('!!!'), ''));

// --- workbench: fallback create + title preservation ---
function wbCreated(label, title) {
  const r = createWorkbenchDoc(title);
  assert.strictEqual(r.ok, 'created', `${label}: expected created, got ${JSON.stringify(r)}`);
  assert.ok(SLUG_RE.test(r.slug), `${label}: slug must pass SLUG_RE, got "${r.slug}"`);
  assert.ok(r.slug.startsWith('fleeting-'), `${label}: expected fleeting- slug, got "${r.slug}"`);
  assert.strictEqual(r.title, title.trim(), `${label}: title not preserved in return`);
  const read = readWorkbenchDoc(r.slug);
  assert.ok(read.markdown.includes(title.trim()), `${label}: human title not in body`);
  assert.strictEqual(read.title, title.trim(), `${label}: deriveTitle did not recover title`);
  cleanupWb.push(r.slug);
}
check('createWorkbenchDoc("한글 메모") → created + title preserved', () => wbCreated('KR', '한글 메모'));
check('createWorkbenchDoc("中文笔记") → created + title preserved',  () => wbCreated('ZH', '中文笔记'));
check('createWorkbenchDoc("Заметка") → created + title preserved',   () => wbCreated('CY', 'Заметка'));
check('createWorkbenchDoc("🎉🎉") → created + title preserved',       () => wbCreated('EMOJI', '🎉🎉'));
check('createWorkbenchDoc("!!!") → created + title preserved',        () => wbCreated('PUNCT', '!!!'));

// --- workbench: ASCII path unchanged (real slug, no fallback) ---
check('createWorkbenchDoc("Test Note <ts>") → "test-note-…", not fleeting-', () => {
  const r = createWorkbenchDoc('Test Note ' + Date.now());
  assert.strictEqual(r.ok, 'created');
  assert.ok(r.slug.startsWith('test-note-'), `got "${r.slug}"`);
  assert.ok(!r.slug.startsWith('fleeting-'), 'ASCII title must NOT use fallback');
  cleanupWb.push(r.slug);
});

// --- workbench: security guards intact ---
check('createWorkbenchDoc("../../etc/passwd") → bad-title', () =>
  assert.strictEqual(createWorkbenchDoc('../../etc/passwd').ok, 'bad-title'));
check('createWorkbenchDoc("a/b") → bad-title', () =>
  assert.strictEqual(createWorkbenchDoc('a/b').ok, 'bad-title'));
check('createWorkbenchDoc("README") → reserved', () =>
  assert.strictEqual(createWorkbenchDoc('README').ok, 'reserved'));

// --- workbench: two non-Latin in same second do not collide ---
check('two non-Latin notes uniquify (no collision block)', () => {
  const a = createWorkbenchDoc('테스트');
  const b = createWorkbenchDoc('테스트');
  assert.strictEqual(a.ok, 'created');
  assert.strictEqual(b.ok, 'created');
  assert.notStrictEqual(a.slug, b.slug);
  cleanupWb.push(a.slug, b.slug);
});

// --- journal: fallback create + title in frontmatter ---
check('createJournalEntry("한글 메모") → created + title in frontmatter', () => {
  const r = createJournalEntry('한글 메모', 'body', '2026-06-22');
  assert.strictEqual(r.ok, 'created', `got ${JSON.stringify(r)}`);
  assert.ok(SLUG_RE.test(r.slug), `slug must pass SLUG_RE, got "${r.slug}"`);
  assert.ok(r.slug.includes('-entry'), `expected -entry fallback, got "${r.slug}"`);
  assert.ok(fs.readFileSync(r.absPath, 'utf8').includes('한글 메모'), 'title must be in frontmatter');
  cleanupJ.push(r.absPath);
});
check('createJournalEntry("My Day") → descriptive slug (ASCII unchanged)', () => {
  const r = createJournalEntry('My Day', 'body', '2026-06-22');
  assert.strictEqual(r.ok, 'created');
  assert.ok(r.slug.includes('my-day'), `got "${r.slug}"`);
  cleanupJ.push(r.absPath);
});
check('createJournalEntry("../../x") → bad-title', () =>
  assert.strictEqual(createJournalEntry('../../x', '', '2026-06-22').ok, 'bad-title'));

for (const slug of cleanupWb) { try { deleteWorkbenchDoc(slug); } catch { /* noop */ } }
for (const abs of cleanupJ) { try { fs.unlinkSync(abs); } catch { /* noop */ } }

console.log(`\n${fail ? 'FAIL' : 'PASS'}: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
