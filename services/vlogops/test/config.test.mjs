// AC9 — startup config validation: aggregated, loud, and reading nothing from this repo.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SERVICE_ROOT } from './helpers/harness.mjs';
import { loadConfig } from '../src/config.mjs';

test('AC9 — a missing VLOGOPS_DB_URL throws, naming the variable', () => {
  assert.throws(
    () => loadConfig({}),
    (err) => err.code === 'EVLOGOPSCONFIG' && /VLOGOPS_DB_URL is required/.test(err.message),
    'an empty environment did not fail loudly',
  );
});

test('AC9 — EVERY problem is reported in ONE error, not just the first', () => {
  let caught;
  try {
    loadConfig({ VLOGOPS_DB_URL: 'not-a-url', VLOGOPS_REPO_ROOT: path.join(SERVICE_ROOT, 'does-not-exist') });
  } catch (err) {
    caught = err;
  }

  assert.ok(caught, 'a doubly-invalid environment was accepted');
  assert.equal(caught.code, 'EVLOGOPSCONFIG');
  assert.equal(caught.problems.length, 2, `expected both problems, got: ${JSON.stringify(caught.problems)}`);
  assert.match(caught.message, /VLOGOPS_DB_URL/);
  assert.match(caught.message, /VLOGOPS_REPO_ROOT/);
});

test('AC9 — a non-Postgres DSN is refused rather than quietly accepted', () => {
  assert.throws(
    () => loadConfig({ VLOGOPS_DB_URL: 'mysql://user:pw@localhost/db' }),
    /must be a postgres:\/\/ or postgresql:\/\/ URL/,
  );
  assert.throws(
    () => loadConfig({ VLOGOPS_DB_URL: '   ' }),
    /VLOGOPS_DB_URL is required/,
  );
});

test('AC9 — a valid environment loads, and VLOGOPS_DB_URL is the ONLY database variable', () => {
  const config = loadConfig({ VLOGOPS_DB_URL: 'postgres://u:p@127.0.0.1:5432/db' });
  assert.equal(config.databaseUrl, 'postgres://u:p@127.0.0.1:5432/db');
  assert.ok(fs.existsSync(config.repoRoot), 'the default repo root does not exist');

  // One database variable, and no second one hiding in the source.
  const sources = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.(mjs|js)$/.test(entry.name)) sources.push(p);
    }
  };
  walk(path.join(SERVICE_ROOT, 'src'));
  walk(path.join(SERVICE_ROOT, 'bin'));

  for (const f of sources) {
    const text = fs.readFileSync(f, 'utf8');
    for (const forbidden of ['ASDAIR_DB_URL', 'ASDAIR_WRITE_DB_URL', 'CONTROL_PLANE_DEV_DATABASE_URL', 'SUPABASE_SECRET_KEY']) {
      assert.ok(!text.includes(forbidden), `${path.basename(f)} reads ${forbidden}; VLOGOPS_DB_URL is the only database variable`);
    }
  }
});

test('AC9 — nothing in this service reads a value from a file inside the repository', () => {
  const sources = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.(mjs|js)$/.test(entry.name)) sources.push(p);
    }
  };
  walk(path.join(SERVICE_ROOT, 'src'));
  walk(path.join(SERVICE_ROOT, 'bin'));

  for (const f of sources) {
    const text = fs.readFileSync(f, 'utf8');
    // The secrets store is denied by default and this service has no business anywhere
    // near it. A path to it must not exist in the source at all.
    assert.ok(!/\.fusion247/i.test(text), `${path.basename(f)} names the private secrets store`);
    // Config values arrive as environment variables, never by this code opening an env file.
    assert.ok(!/readFileSync\([^)]*\.env/.test(text), `${path.basename(f)} reads an env file directly`);
    assert.ok(!/dotenv/.test(text), `${path.basename(f)} pulls in a dotenv loader`);
  }
});

test('AC9 — .env.example documents NAMES only and carries no values', () => {
  const p = path.join(SERVICE_ROOT, '.env.example');
  assert.ok(fs.existsSync(p), '.env.example is missing');
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    assert.match(trimmed, /^[A-Z0-9_]+=$/, `.env.example line carries a value, not just a name: ${trimmed}`);
  }

  assert.ok(lines.some((l) => l.trim() === 'VLOGOPS_DB_URL='), '.env.example does not document VLOGOPS_DB_URL');
});
