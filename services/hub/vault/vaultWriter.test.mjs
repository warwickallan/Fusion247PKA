// BUILD-002 WP1 — VaultWriter tests (node --test). Filesystem adapter; no external deps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { VaultWriter, FsVaultAdapter, slugify } from './vaultWriter.mjs';

function tmpVault() { return fs.mkdtempSync(path.join(os.tmpdir(), 'vault-')); }

test('slugify is deterministic + filesystem-safe', () => {
  assert.equal(slugify('NetworkChuck: Hermes/OS agentic!!'), 'networkchuck-hermes-os-agentic');
  assert.equal(slugify(''), 'note');
  assert.equal(slugify('a'.repeat(200)).length <= 80, true);
});

test('writeNote creates a governed note under Sources/', async () => {
  const root = tmpVault();
  const vw = new VaultWriter(new FsVaultAdapter(root));
  const r = await vw.writeNote({ sourceId: 'dQw4w9WgXcQ', title: 'How the hub works', frontmatter: { review: 'ai_created' }, body: '# Body\n\nSubstantive knowledge.' });
  assert.equal(r.created, true);
  assert.match(r.path, /^Sources\/dqw4w9wgxcq-how-the-hub-works\.md$/);
  const written = fs.readFileSync(path.join(root, r.path), 'utf8');
  assert.match(written, /source_id: dQw4w9WgXcQ/);
  assert.match(written, /review: ai_created/);
  assert.match(written, /Substantive knowledge\./);
});

test('writeNote is WRITE-ONCE idempotent — duplicate delivery makes no second note', async () => {
  const root = tmpVault();
  const vw = new VaultWriter(new FsVaultAdapter(root));
  const first = await vw.writeNote({ sourceId: 'abc123', title: 'T', body: 'one' });
  assert.equal(first.created, true);
  const again = await vw.writeNote({ sourceId: 'abc123', title: 'T', body: 'DIFFERENT body on retry' });
  assert.equal(again.created, false, 'second write for same sourceId must be a no-op');
  assert.equal(again.path, first.path);
  const files = fs.readdirSync(path.join(root, 'Sources'));
  assert.equal(files.length, 1, 'exactly one note for the source id');
  assert.equal(fs.readFileSync(path.join(root, first.path), 'utf8').includes('one'), true, 'original content preserved');
});

test('path is confined to the vault root (no traversal)', async () => {
  const root = tmpVault();
  const adapter = new FsVaultAdapter(root);
  await assert.rejects(() => adapter.write('../escape.md', 'x'), /outside the governed vault/);
});

test('missing sourceId is rejected (idempotency requires it)', async () => {
  const vw = new VaultWriter(new FsVaultAdapter(tmpVault()));
  await assert.rejects(() => vw.writeNote({ title: 'x', body: 'y' }), /requires a stable sourceId/);
});
