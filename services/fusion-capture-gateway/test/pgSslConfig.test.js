// FU-1 — unit tests for the verify-full / pinned-CA pool-config builder.
// Hermetic: readFile is injected; no pg, no network, no real CA required.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildPgSslConfig } from '../src/store/pgSslConfig.js';

const FAKE_PEM = '-----BEGIN CERTIFICATE-----\nMIIFakeButShaped\n-----END CERTIFICATE-----\n';
const readFake = (requestedPath) => {
  readFake.lastPath = requestedPath;
  return FAKE_PEM;
};

test('no DATABASE_SSL_CA_FILE → passthrough: DSN untouched, no poolConfig (form B / throwaway DBs)', () => {
  const dsn = 'postgres://postgres:pw@localhost:5432/postgres';
  const out = buildPgSslConfig({ connectionString: dsn });
  assert.equal(out.mode, 'dsn-passthrough');
  assert.equal(out.connectionString, dsn);
  assert.equal(out.poolConfig, undefined);
});

test('explicit form: CA read at startup, ssl object with rejectUnauthorized true — never false', () => {
  const out = buildPgSslConfig({
    connectionString: 'postgres://u:pw@aws-0-eu-central-1.pooler.supabase.com:5432/postgres',
    sslCaFile: '/pinned/supabase-pooler-ca.pem',
    readFile: readFake,
  });
  assert.equal(out.mode, 'explicit-pinned-ca');
  assert.equal(readFake.lastPath, '/pinned/supabase-pooler-ca.pem');
  assert.equal(out.poolConfig.ssl.ca, FAKE_PEM);
  assert.equal(out.poolConfig.ssl.rejectUnauthorized, true);
});

test('the node-postgres replacement trap is defused: every ssl-ish DSN param is STRIPPED when the explicit form is active', () => {
  const out = buildPgSslConfig({
    connectionString: 'postgres://u:pw@host:5432/db?uselibpqcompat=true&sslmode=require&sslrootcert=C:%5Cold%5Cca.crt&application_name=fcg',
    sslCaFile: '/pinned/ca.pem',
    readFile: readFake,
  });
  assert.ok(!/sslmode=|sslrootcert=|uselibpqcompat=/.test(out.connectionString), `ssl params must be gone: ${out.connectionString}`);
  assert.match(out.connectionString, /application_name=fcg/, 'non-ssl params survive');
  assert.deepEqual([...out.strippedParams].sort(), ['sslmode', 'sslrootcert', 'uselibpqcompat']);
  assert.equal(out.poolConfig.ssl.rejectUnauthorized, true);
});

test('a CA file that is not PEM fails fast and loud at startup', () => {
  assert.throws(
    () => buildPgSslConfig({ connectionString: 'postgres://u:pw@h/db', sslCaFile: '/bad', readFile: () => 'not a cert' }),
    /does not look like a PEM certificate/,
  );
  assert.throws(
    () => buildPgSslConfig({ connectionString: 'postgres://u:pw@h/db', sslCaFile: '/missing', readFile: () => { throw new Error('ENOENT'); } }),
    /ENOENT/,
    'a missing CA file is a startup failure, not a silent unverified connection',
  );
});

test('mixing forms on a non-URL DSN refuses instead of silently losing the pinned CA', () => {
  assert.throws(
    () => buildPgSslConfig({
      connectionString: 'host=pooler.supabase.com sslmode=require dbname=postgres',
      sslCaFile: '/pinned/ca.pem',
      readFile: readFake,
    }),
    /never mix the two forms/,
  );
});
