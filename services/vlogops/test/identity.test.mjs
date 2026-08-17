// AC2 — identity is content-derived and stable.
//
// These are the pure-function halves of AC2. The two-separate-processes half lives in
// route1-records.test.mjs, because that is where it can be proven the way the criterion
// actually asks for it.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildManifest, canonicalJson, normaliseSuppliedText, seedIdentity, selectionKey, sha256Hex,
} from '../src/identity.mjs';

const member = (ref, text) => ({ source_ref: ref, content_sha256: sha256Hex(text) });

test('AC2 — canonical JSON is insensitive to key order', () => {
  assert.equal(
    canonicalJson({ b: 1, a: 2, c: { z: 1, y: 2 } }),
    canonicalJson({ c: { y: 2, z: 1 }, a: 2, b: 1 }),
  );
});

test('AC2 — the manifest sorts members, so DISCOVERY ORDER cannot change identity', () => {
  const a = member('file:one.md', 'one');
  const b = member('file:two.md', 'two');
  const c = member('git-commit:abc', 'three');

  const forwards = seedIdentity(buildManifest({ route: 'records', members: [a, b, c] }));
  const backwards = seedIdentity(buildManifest({ route: 'records', members: [c, b, a] }));
  const shuffled = seedIdentity(buildManifest({ route: 'records', members: [b, c, a] }));

  assert.equal(forwards, backwards);
  assert.equal(forwards, shuffled);
  assert.match(forwards, /^[0-9a-f]{64}$/);
});

test('AC2 — identity changes when CONTENT changes, and only then', () => {
  const base = [member('file:one.md', 'one'), member('file:two.md', 'two')];
  const id = seedIdentity(buildManifest({ route: 'records', members: base }));

  const sameAgain = seedIdentity(buildManifest({ route: 'records', members: [...base] }));
  assert.equal(sameAgain, id, 'recomputing over identical content produced a different identity');

  const changed = [member('file:one.md', 'ONE'), member('file:two.md', 'two')];
  assert.notEqual(
    seedIdentity(buildManifest({ route: 'records', members: changed })), id,
    'changing a source\'s content did not change the identity',
  );

  const renamed = [member('file:renamed.md', 'one'), member('file:two.md', 'two')];
  assert.notEqual(
    seedIdentity(buildManifest({ route: 'records', members: renamed })), id,
    'changing where a source came from did not change the identity',
  );
});

test('AC2 — nothing time-varying, process-local or ordinal enters the identity', () => {
  const members = [member('file:one.md', 'one')];
  const first = seedIdentity(buildManifest({ route: 'records', members }));

  // The three things the criterion names by name. If any of them leaked in, computing the
  // identity a moment later in a different process state would drift.
  const manifest = buildManifest({ route: 'records', members });
  const serialised = canonicalJson(manifest);

  assert.ok(!/\d{4}-\d{2}-\d{2}T/.test(serialised), 'a timestamp leaked into the manifest');
  assert.ok(!new RegExp(`\\b${process.pid}\\b`).test(serialised), 'the process id leaked into the manifest');
  assert.ok(!/"(id|row_id|seq|ordinal)"/.test(serialised), 'an ordinal or row id leaked into the manifest');

  assert.equal(seedIdentity(manifest), first);
});

test('AC6/AC2 — the ANGLE is part of what a seed IS', () => {
  const members = [member('supplied:1', 'today I thought X was a good idea')];
  const one = seedIdentity(buildManifest({ route: 'supplied', angle: 'what did I miss?', members }));
  const two = seedIdentity(buildManifest({ route: 'supplied', angle: 'why was I so sure?', members }));
  assert.notEqual(one, two, 'the same text with a different angle collapsed to one identity');
});

test('AC2 — normalise in, hash what you store: line endings and composition do not fork identity', () => {
  const crlf = 'a line\r\nanother line\r\n';
  const lf = 'a line\nanother line';
  assert.equal(normaliseSuppliedText(crlf), normaliseSuppliedText(lf));

  // NFC: the same character composed two ways is the same character.
  assert.equal(normaliseSuppliedText('éclair'), normaliseSuppliedText('éclair'));

  const members = (t) => [{ source_ref: 'supplied:1', content_sha256: sha256Hex(normaliseSuppliedText(t)) }];
  assert.equal(
    seedIdentity(buildManifest({ route: 'supplied', angle: 'x', members: members(crlf) })),
    seedIdentity(buildManifest({ route: 'supplied', angle: 'x', members: members(lf) })),
  );
});

test('AC2 — a manifest refuses input it would otherwise silently mangle', () => {
  assert.throws(() => buildManifest({ route: 'records', members: [] }), /at least one member/);
  assert.throws(
    () => buildManifest({ route: 'records', members: [{ source_ref: 'a', content_sha256: 'NOTAHASH' }] }),
    /lowercase hex/,
  );
  assert.throws(
    () => buildManifest({
      route: 'records',
      members: [member('file:one.md', 'a'), member('file:one.md', 'b')],
    }),
    /duplicate source_ref/,
  );
  assert.throws(() => canonicalJson(1.5), /non-integer/);
  assert.throws(() => canonicalJson(NaN), /not representable/);
});

test('M2 — selection_key hashes the REQUEST, so the same selector keeps one key across re-takes', () => {
  const a = selectionKey({ route: 'records', selector: { kind: 'window', from: '2026-08-05', to: '2026-08-05' } });
  const b = selectionKey({ route: 'records', selector: { to: '2026-08-05', kind: 'window', from: '2026-08-05' } });
  assert.equal(a, b, 'the selection key depended on key order');
  assert.match(a, /^[0-9a-f]{64}$/);

  const other = selectionKey({ route: 'records', selector: { kind: 'window', from: '2026-08-06', to: '2026-08-06' } });
  assert.notEqual(a, other, 'two different selections shared a selection key');
});
