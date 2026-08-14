// BUILD-006 Phase 1 — the one-command proof runner.
//
// Provisions a DISPOSABLE Postgres cluster in a temp directory on a free port, runs every
// proof against it, and tears the cluster down. It never touches an existing database and
// it never reaches the managed project: the target is created here, used here, and deleted
// here. Set REUSE_DATABASE_URL=1 to run against a pre-existing $DATABASE_URL instead — that
// is the CI service-container path.
//
//   node test/run-vlogops-tests.mjs
//
// TWO WAYS THIS RUNNER REFUSES TO GO GREEN ON NOTHING, because both have burned this
// estate before:
//
//   1. ZERO EXECUTED SUBTESTS. A DB-gated run whose connection string never reached the
//      child prints `# pass 0` and exits 0 — a green over proofs that never ran. The TAP
//      summary is parsed and an executed count of zero is a FAILURE, loudly.
//
//   2. ZERO TEST FILES. `node --test <glob matching nothing>` also exits 0 on this Node.
//      So the file list is enumerated from the filesystem and an empty list is a failure
//      before anything is spawned. A suite that has lost its tests must not look healthy.

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function testFiles() {
  const files = fs.readdirSync(__dirname)
    .filter((f) => f.endsWith('.test.mjs'))
    .sort()
    .map((f) => path.join(__dirname, f));

  if (files.length === 0) {
    console.error('[run-vlogops-tests] GUARD FAILURE: no *.test.mjs files found in test/. ' +
      'An empty suite exits 0 on this Node and would read as a pass. Failing instead.');
    process.exit(1);
  }
  return files;
}

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
  const files = testFiles();
  console.log(`[run-vlogops-tests] ${files.length} proof file(s): ${files.map((f) => path.basename(f)).join(', ')}\n`);

  return new Promise((resolve) => {
    // --test-concurrency=1: the proofs share one database and each resets the `vlogops`
    // namespace at its start, so running two files at once would have them drop the schema
    // out from under each other. Sequential is the correct answer here, not a workaround.
    const child = spawn(process.execPath, ['--test', '--test-concurrency=1', ...files], {
      stdio: ['inherit', 'pipe', 'inherit'],
      env: { ...process.env, VLOGOPS_DB_URL: databaseUrl },
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

      console.log(`\n[run-vlogops-tests] EXECUTED SUBTESTS: ${executed} (pass=${pass}, fail=${failN}, skipped=${skipped}, tests=${tests})`);

      if (executed === 0) {
        console.error(
          '[run-vlogops-tests] GUARD FAILURE: 0 subtests EXECUTED. A DB-gated run that skips ' +
          'everything is NOT a pass — the proofs never ran. Check that VLOGOPS_DB_URL reached ' +
          'the test process. Failing loudly.',
        );
        return resolve(code && code !== 0 ? code : 1);
      }
      resolve(code ?? 1);
    });
  });
}

async function main() {
  // Check the suite is non-empty BEFORE provisioning anything. Discovered by mutation-testing
  // this guard: it fired correctly, but only after initdb had built an entire cluster for a
  // run with nothing to execute.
  testFiles();

  if (process.env.REUSE_DATABASE_URL === '1') {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('REUSE_DATABASE_URL=1 but DATABASE_URL is unset');
    console.log('[run-vlogops-tests] reusing $DATABASE_URL (CI service container)');
    process.exit(await runNodeTest(url));
  }

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vlogops-pgtest-'));
  const dataDir = path.join(root, 'data');
  const pwFile = path.join(root, 'pw');
  const superuser = 'vlogops_test';
  const password = 'vlogops_test_pw';
  const port = await freePort();
  fs.writeFileSync(pwFile, password);

  let started = false;
  try {
    console.log(`[run-vlogops-tests] initdb -> ${dataDir}`);
    run(bin('initdb'), ['-D', dataDir, '-U', superuser, '-A', 'md5', `--pwfile=${pwFile}`, '--encoding=UTF8', '--no-locale']);

    console.log(`[run-vlogops-tests] starting Postgres on 127.0.0.1:${port}`);
    const sockOpt = process.platform === 'win32' ? '' : ` -c unix_socket_directories=${root}`;
    // stdio:'ignore' is REQUIRED: pg_ctl launches the long-lived server, which inherits the
    // stdout pipe; a piped spawnSync would then block until the SERVER exits rather than
    // until pg_ctl returns. Diagnostics still land in server.log via -l.
    run(bin('pg_ctl'), [
      '-D', dataDir,
      '-o', `-p ${port} -c listen_addresses=127.0.0.1${sockOpt}`,
      '-w', '-l', path.join(root, 'server.log'), 'start',
    ], { stdio: 'ignore' });
    started = true;

    run(bin('createdb'), ['-h', '127.0.0.1', '-p', String(port), '-U', superuser, 'vlogops_scratch'],
      { env: { ...process.env, PGPASSWORD: password } });

    const url = `postgres://${superuser}:${password}@127.0.0.1:${port}/vlogops_scratch`;
    const code = await runNodeTest(url);
    console.log(`[run-vlogops-tests] node --test exit code: ${code}`);
    process.exitCode = code;
  } finally {
    if (started) {
      try { run(bin('pg_ctl'), ['-D', dataDir, '-w', '-m', 'immediate', 'stop']); }
      catch (e) { console.error('[run-vlogops-tests] cluster stop failed:', e.message); }
    }
    try { fs.rmSync(root, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
