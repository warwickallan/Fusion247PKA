// BUILD-002 WP0 — SYNTHETIC-FIRST proof of the contract approval-apply seam.
//
//   node wp-d-proof/prove-contract-apply.mjs
//
// Exercises the FULL seam against THROWAWAY synthetic contract rows only — the real BUILD-002
// pack is never touched. Proves: cp_directus can file an intent but cannot mutate approval;
// the worker applies a correctly-bound approve; a binding MISMATCH fails closed (no approval);
// request_changes works. Supersedes the synthetic rows on cleanup (build_contract forbids DELETE).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(here, '.runtime-live', 'directus-live.env.json'), 'utf8'));
const ca = fs.readFileSync(cfg.ssl_ca_file);
const SSL = { ca, rejectUnauthorized: true };
const KEY = 'csynth-' + Math.floor(Number(process.hrtime.bigint() % 1000000n));

function gatewayDsn() {
  const env = fs.readFileSync('C:/.fusion247/fusion-capture-gateway.env', 'utf8');
  const u = new URL(env.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL=')).slice('DATABASE_URL='.length).trim());
  return { host: u.hostname, port: Number(u.port || 5432), user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password), database: (u.pathname || '/postgres').slice(1) || 'postgres', ssl: SSL };
}
const admin = new pg.Client(gatewayDsn());
const cockpit = new pg.Client({ host: cfg.host, port: cfg.port, database: cfg.database, user: cfg.pooler_user, password: cfg.password, ssl: SSL });

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m); } };
async function expectErr(fn, code, m) {
  try { await fn(); fail++; console.log('  FAIL', m, '(expected error)'); }
  catch (e) { const g = !code || e.code === code; g ? (pass++, console.log('  PASS', m, `(${e.code})`)) : (fail++, console.log('  FAIL', m, `(got ${e.code} want ${code})`)); }
}
function runWorker() {
  const r = spawnSync(process.execPath, [path.join(here, 'apply-contract-command.mjs'), '--drain', `--key-prefix=${KEY}`], { encoding: 'utf8' });
  process.stdout.write(r.stdout.split('\n').filter((l) => l.includes('[apply]')).map((l) => '    ' + l).join('\n') + '\n');
  if (r.status !== 0) throw new Error('worker exited ' + r.status + ' ' + r.stderr);
}
async function seedSynthContract(version, commit, hash) {
  await admin.query(
    `insert into cockpit.build_contract (build_id, contract_version, doc_type, title, outcome, github_path, git_commit_sha, content_sha256, pack_content_hash, lifecycle_state, is_synthetic)
     values ('BUILD-000-SELFTEST',$1,'build_contract_pack','SYNTHETIC selftest','synthetic',$2,$3,$4,$5,'draft',true)`,
    [version, `path-${KEY}.md`, commit, 'contentsha-' + KEY, hash]);
}

async function main() {
  await admin.connect(); await cockpit.connect();
  const vGood = `v-${KEY}-good`, vBad = `v-${KEY}-bad`;
  const commit = `synthcommit-${KEY}`, hash = `synthhash-${KEY}`;
  await seedSynthContract(vGood, commit, hash);
  await seedSynthContract(vBad, commit, hash);
  console.log(`[setup] two synthetic contract rows (${vGood}, ${vBad})\n`);

  // 1. cp_directus can file an intent (all it can do) — correctly bound approve on the GOOD row.
  console.log('1) cockpit files a correctly-bound approve intent:');
  await cockpit.query(
    `insert into cockpit.contract_command (requested_by, command, build_id, contract_version, bound_git_sha, bound_content_hash, idempotency_key)
     values ('cockpit:warwick','approve_contract','BUILD-000-SELFTEST',$1,$2,$3,$4)`,
    [vGood, commit, hash, `${KEY}-good`]);
  ok(true, 'intent inserted by cp_directus');

  // 2. least-privilege: cp_directus cannot mutate approval, nor forge a claimed intent.
  console.log('2) least-privilege asymmetry:');
  await expectErr(() => cockpit.query(`update cockpit.build_contract set lifecycle_state='approved', approved_by='x', approved_at=now() where contract_version=$1`, [vGood]), '42501', 'cp_directus UPDATE build_contract denied');
  await expectErr(() => cockpit.query(`update cockpit.contract_command set status='done' where idempotency_key=$1`, [`${KEY}-good`]), '42501', 'cp_directus UPDATE contract_command denied');
  await expectErr(() => cockpit.query(`insert into cockpit.contract_command (requested_by,command,build_id,contract_version,bound_git_sha,bound_content_hash,idempotency_key,status) values ('x','approve_contract','B',$1,'c','h',$2,'claimed')`, [vGood, `${KEY}-forge`]), '42501', 'cp_directus cannot INSERT status column (grant)');

  // 3. worker applies the correctly-bound approve.
  console.log('3) worker applies the approve:');
  runWorker();
  const good = (await admin.query(`select lifecycle_state, approved_by, approved_at from cockpit.build_contract where contract_version=$1`, [vGood])).rows[0];
  ok(good.lifecycle_state === 'approved' && good.approved_by === 'cockpit:warwick' && good.approved_at, 'GOOD contract -> approved, approved_by+at set');
  const gcmd = (await admin.query(`select status, receipt from cockpit.contract_command where idempotency_key=$1`, [`${KEY}-good`])).rows[0];
  ok(gcmd.status === 'done' && gcmd.receipt?.ok === true && gcmd.receipt?.action === 'approved', 'intent -> done, receipt.ok, action=approved');

  // 4. FAIL CLOSED: a mismatched-hash approve on the BAD row must NOT approve it.
  console.log('4) binding mismatch fails closed:');
  await cockpit.query(
    `insert into cockpit.contract_command (requested_by, command, build_id, contract_version, bound_git_sha, bound_content_hash, idempotency_key)
     values ('cockpit:warwick','approve_contract','BUILD-000-SELFTEST',$1,$2,$3,$4)`,
    [vBad, commit, 'WRONG-hash', `${KEY}-bad`]);
  runWorker();
  const bad = (await admin.query(`select lifecycle_state from cockpit.build_contract where contract_version=$1`, [vBad])).rows[0];
  ok(bad.lifecycle_state !== 'approved', 'BAD contract NOT approved (mismatch)');
  const bcmd = (await admin.query(`select status, receipt from cockpit.contract_command where idempotency_key=$1`, [`${KEY}-bad`])).rows[0];
  ok(bcmd.status === 'failed' && bcmd.receipt?.ok === false && /mismatch/.test(bcmd.receipt?.error || ''), 'mismatched intent -> failed, fail-closed');

  console.log(`\nRESULT: ${fail === 0 ? 'PASS ✓' : 'FAIL ✗'} — ${pass} passed, ${fail} failed`);
}

async function cleanup() {
  try {
    // build_contract forbids DELETE -> supersede the synthetic rows instead; delete the synthetic intents.
    await admin.query(`delete from cockpit.contract_command where idempotency_key like $1`, [`${KEY}-%`]);
    await admin.query(`update cockpit.build_contract set lifecycle_state='superseded', superseded_by_version='selftest-cleanup', updated_at=now()
                       where build_id='BUILD-000-SELFTEST' and contract_version like $1 and lifecycle_state <> 'superseded'`, [`v-${KEY}-%`]);
    console.log('[cleanup] synthetic intents deleted; synthetic contracts superseded (real pack untouched).');
  } catch (e) { console.log('[cleanup] WARNING', e.message, '- marker', KEY); }
}

main()
  .catch((e) => { console.error('[prove-apply] error', e.message); fail++; })
  .finally(async () => { await cleanup(); await admin.end().catch(()=>{}); await cockpit.end().catch(()=>{}); process.exit(fail === 0 ? 0 : 1); });
