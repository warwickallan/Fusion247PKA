// Path-traversal containment (WP0 §6 regression — Vex's throwaway probe, now a
// permanent committed test).
//
// wp0-security-gate.md §3: the governed write path is scoped; a malicious
// capture_id must NEVER escape the sandbox inbox. safeSegment() flattens the id
// to an approved charset, and write() defence-in-depth refuses any resolved path
// outside the inbox. Separately, remove() refuses a FOREIGN (out-of-sandbox)
// pointer and leaves the target untouched. Deterministic: injected `now`.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createSandboxMarkdownWriter } from '../src/markdownWriter.js';

const T0 = 1_752_660_000_000;

// The probe's payloads: ids that TRY to climb out of the inbox. safeSegment()
// is a POSITIVE ALLOWLIST ([^a-zA-Z0-9_-] -> '_'), which by construction
// defeats encoding/platform tricks too — these variants make that explicit
// and regression-proof rather than relying on the allowlist's generality alone
// (Sonnet review area E: "including encoded and platform-specific variants").
const MALICIOUS_IDS = [
  '../../../../tmp/EVIL',
  '/etc/passwd',
  'foo/../../bar',
  'a/../../etc/x',
  // URL-encoded traversal — the allowlist strips '%' too, so this never decodes.
  '%2e%2e%2f%2e%2e%2fetc%2fpasswd',
  // Windows-style backslash separators.
  '..\\..\\..\\windows\\system32\\config',
  'C:\\Windows\\System32\\drivers\\etc\\hosts',
  // Embedded NUL byte (classic path-truncation trick in some C-backed APIs).
  'evil\0../../etc/passwd',
  // Unicode fullwidth dot/slash look-alikes — non-ASCII, so also flattened.
  '．．／etc／passwd',
];

test('malicious capture_ids all resolve INSIDE the sandbox inbox — no escape, no /tmp/EVIL', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-traversal-'));
  try {
    const writer = createSandboxMarkdownWriter({ baseDir });
    const inboxRoot = path.resolve(writer.inboxDir);

    // Guard: prove /tmp/EVIL does not pre-exist so a later assert is meaningful.
    assert.equal(fs.existsSync('/tmp/EVIL'), false, '/tmp/EVIL must not pre-exist');

    for (const id of MALICIOUS_IDS) {
      const res = writer.write({ capture_id: id, text_preview: 'inert' }, { now: T0 });
      const resolved = path.resolve(res.destination_ref.path);

      // The written path stays strictly inside the sandbox inbox.
      assert.ok(
        resolved.startsWith(inboxRoot + path.sep),
        `id ${JSON.stringify(id)} escaped the inbox: ${resolved}`,
      );
      assert.ok(fs.existsSync(resolved), 'the flattened in-sandbox note exists');
    }

    // Nothing climbed out: the classic escape targets were never created here.
    assert.equal(fs.existsSync('/tmp/EVIL'), false, 'no file created at /tmp/EVIL');
    assert.equal(fs.existsSync(path.join(baseDir, '..', 'bar')), false, 'no sibling escape');

    // Every note landed in the inbox and nowhere else.
    const notes = fs.readdirSync(writer.inboxDir).filter((f) => f.endsWith('.md'));
    assert.equal(notes.length, MALICIOUS_IDS.length, 'every write landed inside the inbox');
    for (const n of notes) {
      assert.ok(!n.includes('/') && !n.includes('..'), `flattened filename is safe: ${n}`);
    }
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});

test('markdownWriter.remove() refuses a foreign pointer and leaves it untouched', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-traversal-remove-'));
  try {
    const writer = createSandboxMarkdownWriter({ baseDir });

    // A tampered/foreign destination_ref pointing at a real system file.
    const foreign = '/etc/passwd';
    const existedBefore = fs.existsSync(foreign);

    assert.throws(
      () => writer.remove({ kind: 'markdown', path: foreign }, { now: T0 }),
      /refusing out-of-sandbox path/,
      'remove() must refuse a pointer outside the sandbox inbox',
    );

    // The foreign file is exactly as it was — remove() never followed the pointer.
    assert.equal(fs.existsSync(foreign), existedBefore, '/etc/passwd untouched by refused remove()');
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});
