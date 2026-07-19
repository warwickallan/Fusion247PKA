// BUILD-014 WP-D increment 1 — provision the DISPOSABLE, LOCAL cockpit proof Postgres.
//
// Stands up a PERSISTENT-FOR-THE-SESSION local Postgres cluster (the same initdb/pg_ctl
// mechanism the hermetic db-test runner uses, but NOT torn down — it stays up so Directus
// and the acceptance/permission tests can run against it), applies migrations 001 + 002,
// then seeds SYNTHETIC data (Tower review log + shopping lists + cockpit read-models).
//
//   node wp-d-proof/provision.mjs
//
// LOCAL-ONLY: the cluster binds to 127.0.0.1 exclusively. DEV-ONLY, SYNTHETIC data only.
// Requires initdb/pg_ctl/postgres/createdb on PATH (PostgreSQL 17 is on this machine), and
// the `pg` npm driver (already installed in services/control-plane).
//
// Re-running is safe: it reuses the existing cluster + port and REBUILDS the ops schema and
// the public projections from scratch (disposable proof — a fresh, deterministic dataset).
//
// Tear down with: node wp-d-proof/stop.mjs   (stops the server; deletes .runtime)

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME = path.join(__dirname, '.runtime');
const CLUSTER = path.join(RUNTIME, 'cluster');
const PWFILE = path.join(RUNTIME, 'pw');
const LOGFILE = path.join(RUNTIME, 'server.log');
const RUNTIME_JSON = path.join(RUNTIME, 'runtime.json');

const MIGR = path.join(__dirname, '..', 'db', 'migrations');
const SEED = path.join(__dirname, 'seed');

const SUPERUSER = 'cp_admin';
const PASSWORD = process.env.WPD_DB_PASSWORD || 'wpd_dev_only_pw';
const DBNAME = 'controlplane';
const HOST = '127.0.0.1';

function bin(name) {
  const dir = process.env.POSTGRES_BIN;
  const exe = process.platform === 'win32' ? `${name}.exe` : name;
  return dir ? path.join(dir, exe) : exe;
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} exited ${r.status}\n${r.stdout || ''}\n${r.stderr || ''}`);
  }
  return r;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on('error', reject);
    srv.listen(0, HOST, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function serverRunning() {
  const r = spawnSync(bin('pg_ctl'), ['-D', CLUSTER, 'status'], { encoding: 'utf8' });
  return r.status === 0; // 0 = running, 3 = not running
}

// The authoritative port of a RUNNING cluster is line 4 of postmaster.pid.
function runningPort() {
  const pidFile = path.join(CLUSTER, 'postmaster.pid');
  if (!fs.existsSync(pidFile)) return null;
  const lines = fs.readFileSync(pidFile, 'utf8').split('\n');
  const p = parseInt((lines[3] || '').trim(), 10);
  return Number.isInteger(p) ? p : null;
}

async function main() {
  fs.mkdirSync(RUNTIME, { recursive: true });

  const initialized = fs.existsSync(path.join(CLUSTER, 'PG_VERSION'));
  if (!initialized) {
    fs.writeFileSync(PWFILE, PASSWORD);
    console.log(`[provision] initdb -> ${CLUSTER}`);
    run(bin('initdb'), ['-D', CLUSTER, '-U', SUPERUSER, '-A', 'md5', `--pwfile=${PWFILE}`, '--encoding=UTF8', '--no-locale']);
    // Best-effort: remove the plaintext pw file now that the cluster embeds the hash.
    try { fs.rmSync(PWFILE, { force: true }); } catch { /* ignore */ }
  }

  // Port resolution order: the running cluster's actual port (postmaster.pid) wins; else a
  // previously-persisted port; else a fresh free port.
  let port = null;
  if (serverRunning()) {
    port = runningPort();
    console.log(`[provision] Postgres already running on ${HOST}:${port}`);
  } else {
    if (fs.existsSync(RUNTIME_JSON)) {
      try { port = JSON.parse(fs.readFileSync(RUNTIME_JSON, 'utf8')).port; } catch { /* ignore */ }
    }
    if (!port) port = await freePort();
    console.log(`[provision] starting Postgres on ${HOST}:${port} (localhost-only)`);
    // listen_addresses pinned to 127.0.0.1 — never exposed off this machine.
    run(bin('pg_ctl'), [
      '-D', CLUSTER,
      '-o', `-p ${port} -c listen_addresses=${HOST}`,
      '-w', '-l', LOGFILE, 'start',
    ], { stdio: 'ignore' });
  }

  const env = { ...process.env, PGPASSWORD: PASSWORD };
  // Create the app database if it does not exist yet.
  const exists = spawnSync(bin('psql'), ['-h', HOST, '-p', String(port), '-U', SUPERUSER, '-d', 'postgres',
    '-tAc', `select 1 from pg_database where datname='${DBNAME}'`], { encoding: 'utf8', env });
  if (exists.stdout.trim() !== '1') {
    run(bin('createdb'), ['-h', HOST, '-p', String(port), '-U', SUPERUSER, DBNAME], { env });
    console.log(`[provision] created database ${DBNAME}`);
  }

  const url = `postgres://${SUPERUSER}:${PASSWORD}@${HOST}:${port}/${DBNAME}`;
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    console.log('[provision] applying migration 001 + 002 (fresh ops schema)…');
    await client.query('drop schema if exists ops cascade');
    await client.query(fs.readFileSync(path.join(MIGR, '001_control_plane_min_schema.sql'), 'utf8'));
    await client.query(fs.readFileSync(path.join(MIGR, '002_current_head_authority.sql'), 'utf8'));

    console.log('[provision] seeding SYNTHETIC data (010 review log, 020 shopping, 030 read-models)…');
    await client.query(fs.readFileSync(path.join(SEED, '010_tower_review_log.sql'), 'utf8'));
    await client.query(fs.readFileSync(path.join(SEED, '020_synthetic_shopping.sql'), 'utf8'));
    await client.query(fs.readFileSync(path.join(SEED, '030_cockpit_read_models.sql'), 'utf8'));

    const counts = await client.query(`
      select
        (select count(*) from ops.build)              as builds,
        (select count(*) from ops.checkpoint)         as checkpoints,
        (select count(*) from ops.verdict)            as verdicts,
        (select count(*) from ops.agent_event)        as events,
        (select count(*) from public.lists)           as lists,
        (select count(*) from public.list_items)      as list_items,
        (select count(*) from public.tower_review_log) as review_log_rows,
        (select count(*) from public.tower_verdicts)  as verdict_rows`);
    console.log('[provision] row counts:', counts.rows[0]);
  } finally {
    await client.end();
  }

  fs.writeFileSync(RUNTIME_JSON, JSON.stringify({
    host: HOST, port, superuser: SUPERUSER, password: PASSWORD, database: DBNAME,
    dataDir: CLUSTER, provisionedAt: new Date().toISOString(),
  }, null, 2));

  const masked = `postgres://${SUPERUSER}:***@${HOST}:${port}/${DBNAME}`;
  console.log(`\n[provision] DONE. Cluster live (localhost-only). Connection: ${masked}`);
  console.log(`[provision] runtime descriptor: ${RUNTIME_JSON}`);
}

main().catch((e) => { console.error('[provision] FAILED:', e); process.exit(1); });
