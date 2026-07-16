// Unsafe-input containment (WP0 §6 regression).
//
// wp0-security-gate.md §3 + adapter contract: a capture_id with control chars /
// spaces / dots is FLATTENED to a safe in-sandbox path; message TEXT containing
// newlines, `$(...)`, `;rm -rf /`, `../` is stored as INERT DATA — kept verbatim
// in the note body, never used to build a path or a command. There are no shell
// or eval primitives in src to abuse, and this test asserts that too.
// Deterministic: injected `now`, no wall-clock.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createInMemoryOperationalStore } from '../src/store/operationalStore.js';
import { createMockTelegramAdapter } from '../src/adapters/telegramAdapter.js';
import { createSandboxMarkdownWriter } from '../src/markdownWriter.js';
import { createIntake } from '../src/intake.js';
import { createWorker } from '../src/worker.js';
import { STATES } from '../src/core/states.js';

const AUTH_ID = 424242;
const T0 = 1_752_660_000_000;

function fixedClock(ms) {
  let t = ms;
  return { now: () => t, set: (v) => { t = v; }, advance: (d) => { t += d; } };
}

test('a capture_id with control chars / spaces / dots flattens to a safe in-sandbox path', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-unsafe-id-'));
  try {
    const writer = createSandboxMarkdownWriter({ baseDir });
    const inboxRoot = path.resolve(writer.inboxDir);

    const nastyId = ' ../a\tb\n..c/../$(x);rm -rf / .';
    const res = writer.write({ capture_id: nastyId, text_preview: 'inert' }, { now: T0 });
    const resolved = path.resolve(res.destination_ref.path);

    assert.ok(resolved.startsWith(inboxRoot + path.sep), 'flattened id stays inside the inbox');
    assert.ok(fs.existsSync(resolved), 'the flattened note exists in-sandbox');

    const fileName = path.basename(resolved);
    // Only the approved charset survives — no separators, no traversal, no ws.
    assert.match(fileName, /^[a-zA-Z0-9_-]+\.md$/, 'filename is confined to the safe charset');
    assert.ok(!fileName.includes('..') && !fileName.includes('/') && !/\s/.test(fileName));
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});

test('dangerous message TEXT is stored verbatim as inert data — no path escape, no command', () => {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcg-unsafe-text-'));
  try {
    const store = createInMemoryOperationalStore();
    const adapter = createMockTelegramAdapter({ authorisedUserId: AUTH_ID });
    const markdownWriter = createSandboxMarkdownWriter({ baseDir });
    const clock = fixedClock(T0);
    const intake = createIntake({ store, adapter, clock });
    const worker = createWorker({
      store, markdownWriter, adapter, clock, workerId: 'worker-A', leaseMs: 30_000,
    });

    // Injection-flavoured payload — every char here is DATA, never code/path.
    const payload = 'line one\nline two $(whoami); rm -rf / && ../../etc/passwd `id`';
    const acc = intake.accept({
      message: { message_id: 71001, from: { id: AUTH_ID }, text: payload },
    });
    assert.equal(acc.ok, true);

    clock.advance(1000);
    const done = worker.processOne({ now: clock.now() });
    assert.equal(done.state, STATES.COMPLETED);

    const notePath = path.resolve(done.destination_ref.path);
    const inboxRoot = path.resolve(markdownWriter.inboxDir);
    // The note landed inside the sandbox despite the traversal-looking text.
    assert.ok(notePath.startsWith(inboxRoot + path.sep), 'note stayed inside the inbox');

    // The dangerous text is present VERBATIM in the body — kept, not executed,
    // not interpreted, not folded into the path.
    const body = fs.readFileSync(notePath, 'utf8');
    assert.ok(body.includes(payload), 'payload retained verbatim as inert note data');

    // The path was derived from the (safe) capture_id, NOT from the text: none of
    // the traversal fragments from the message leaked into the filename.
    const fileName = path.basename(notePath);
    assert.match(fileName, /^[a-zA-Z0-9_-]+\.md$/);
    assert.ok(!fileName.includes('passwd'), 'message text did not shape the filename');

    // No escape artefacts anywhere near the sandbox.
    assert.equal(fs.existsSync(path.join(baseDir, '..', 'etc')), false);
  } finally {
    fs.rmSync(baseDir, { recursive: true, force: true });
  }
});

test('no shell / eval primitive exists in src to be abused by untrusted input', () => {
  // Meta-regression: the containment argument relies on there being NO command
  // or eval sink in the source. Assert that invariant directly.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const srcDir = path.join(here, '..', 'src');

  const files = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) files.push(full);
    }
  }(srcDir));

  assert.ok(files.length > 0, 'found source files to scan');
  // Sinks that would turn inert data into code/subprocess execution.
  const SINKS = [
    /child_process/,
    /\bexecSync\b/,
    /\bexecFileSync\b/,
    /\bspawnSync\b/,
    /\beval\s*\(/,
    /new\s+Function\s*\(/,
    /\bvm\.runIn/,
  ];
  for (const f of files) {
    const contents = fs.readFileSync(f, 'utf8');
    for (const sink of SINKS) {
      assert.equal(sink.test(contents), false, `unexpected code/subprocess sink ${sink} in ${f}`);
    }
  }
});
