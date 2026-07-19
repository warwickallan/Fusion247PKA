// BUILD-014 WP-B — one-command worker-runtime proof runner.
//
// Mirrors WP-A's db/test/run-db-tests.mjs: provisions a DISPOSABLE, isolated Postgres
// cluster in a temp dir on a free port, applies nothing itself (the test file applies the
// WP-A migration 001 into a fresh `ops` schema per subtest), runs the worker-runtime
// proofs, then tears the cluster down. "Proven" means EXECUTED, not skipped — this runner
// FAILS on 0 executed subtests (an all-skipped run can never go green).
//
//   node services/control-plane/worker/test/run-worker-tests.mjs
//
// Requirements: initdb, pg_ctl, postgres on PATH (or POSTGRES_BIN pointing at the bin dir),
// and the `pg` npm driver installed. It NEVER touches an existing database: it creates its
// own throwaway cluster. Set REUSE_DATABASE_URL=1 to instead run against a pre-existing
// $DATABASE_URL (CI service container).

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_FILE = path.join(__dirname, 'worker-runtime.test.js');

function bin(name) {
  const dir = process.env.POSTGRES_BIN;
  const exe = process.platform === 'win32' ? `${name}.exe` : name;
  return dir ? path.join(dir, exe) : exe;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} exited ${r.status}\n${r.stdout || ''}\n${r.stderr || ''}`);
  }
  return r;
}

function runNodeTest(databaseUrl) {
  return new Promise((resolve) => {
    // Tee stdout so we BOTH stream it live AND parse the TAP summary. This is what lets us
    // fail on an all-skipped run: a mis-wired `node --test` (DATABASE_URL not reaching the
    // child so every gated() subtest skips) prints `# pass 0` and would otherwise EXIT 0 —
    // a green-on-skips false pass. We refuse that here.
    const child = spawn(process.execPath, ['--test', TEST_FILE], {
      stdio: ['inherit', 'pipe', 'inherit'],
      env: { ...process.env, DATABASE_URL: databaseUrl, LOG_LEVEL: process.env.LOG_LEVEL ?? 'silent' },
    });
    let out = '';
    child.stdout.on('data', (d) => { out += d.toString(); process.stdout.write(d); });
    child.on('exit', (code) => {
      const num = (re) => { const m = out.match(re); return m ? Number(m[1]) : null; };
      const pass = num(/^#\s*pass\s+(\d+)/m);
      const failN = num(/^#\s*fail\s+(\d+)/m);
      const skipped = num(/^#\s*skipped\s+(\d+)/m);
      const tests = num(/^#\s*tests\s+(\d+)/m);
      const executed = (pass ?? 0) + (failN ?? 0);
      if (executed === 0) {
        console.error(
          `\n[run-worker-tests] GUARD FAILURE: 0 subtests EXECUTED ` +
          `(tests=${tests}, pass=${pass}, fail=${failN}, skipped=${skipped}). ` +
          `A DB-gated run that skips everything is NOT a pass — the worker proofs never ran. ` +
          `Check that DATABASE_URL reached the test process. Failing loudly.`);
        return resolve(code && code !== 0 ? code : 1);
      }
      resolve(code ?? 1);
    });
  });
}

async function withReusedDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('REUSE_DATABASE_URL=1 but DATABASE_URL is unset');
  return runNodeTest(url);
}

async function main() {
  if (process.env.REUSE_DATABASE_URL === '1') {
    process.exit(await withReusedDb());
  }

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-wpb-pgtest-'));
  const dataDir = path.join(root, 'data');
  const pwFile = path.join(root, 'pw');
  const superuser = 'cp_test';
  const port = await freePort();
  fs.writeFileSync(pwFile, 'cp_test_pw');

  let started = false;
  try {
    console.log(`[run-worker-tests] initdb -> ${dataDir}`);
    run(bin('initdb'), ['-D', dataDir, '-U', superuser, '-A', 'md5', `--pwfile=${pwFile}`, '--encoding=UTF8', '--no-locale']);

    console.log(`[run-worker-tests] starting Postgres on 127.0.0.1:${port}`);
    const sockOpt = process.platform === 'win32' ? '' : ` -c unix_socket_directories=${root}`;
    // stdio:'ignore' is REQUIRED: pg_ctl launches the long-lived `postgres` server which
    // inherits stdout; a piped spawnSync would block until the SERVER exits (never).
    run(bin('pg_ctl'), [
      '-D', dataDir,
      '-o', `-p ${port} -c listen_addresses=127.0.0.1${sockOpt}`,
      '-w', '-l', path.join(root, 'server.log'), 'start',
    ], { stdio: 'ignore' });
    started = true;

    run(bin('createdb'), ['-h', '127.0.0.1', '-p', String(port), '-U', superuser, 'scratch'],
      { env: { ...process.env, PGPASSWORD: 'cp_test_pw' } });

    const url = `postgres://${superuser}:cp_test_pw@127.0.0.1:${port}/scratch`;
    console.log('[run-worker-tests] running worker-runtime proofs...\n');
    const code = await runNodeTest(url);
    console.log(`\n[run-worker-tests] node --test exit code: ${code}`);
    process.exitCode = code;
  } finally {
    if (started) {
      try { run(bin('pg_ctl'), ['-D', dataDir, '-w', '-m', 'immediate', 'stop']); }
      catch (e) { console.error('[run-worker-tests] cluster stop failed:', e.message); }
    }
    try { fs.rmSync(root, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
