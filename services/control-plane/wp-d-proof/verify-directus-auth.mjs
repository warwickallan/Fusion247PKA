// BUILD-002 WP0 — verify the contract pack + approval receipt through the AUTHENTICATED Directus API.
//
//   node wp-d-proof/verify-directus-auth.mjs
//
// GPT/Warwick pre-completion fix 1: prove the three Markdown documents and the approval receipt are
// readable through Directus's authenticated interface (not just the raw DB). Provisions an EPHEMERAL,
// LEAST-PRIVILEGE read-only Directus policy + user + static token (never Warwick's admin password),
// does authenticated GETs, asserts, then REVOKES everything. Prints only safe fields.
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';

const BASE = 'http://127.0.0.1:8074';
const POLICY = 'larry-verify-ro';
const EMAIL = 'larry-verify@local.invalid';

// directus_sys is OWNED by cp_directus, so we provision the ephemeral policy/user/token as cp_directus
// (the same connection register-contract-collections.mjs uses), not the gateway role.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const CONN = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '.runtime-live', 'directus-live.env.json'), 'utf8'));
const db = new pg.Client({ host: CONN.host, port: CONN.port, database: CONN.database,
  user: CONN.pooler_user, password: CONN.password, ssl: { ca: fs.readFileSync(CONN.ssl_ca_file), rejectUnauthorized: true } });
const s = 'directus_sys';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m); } };

async function cleanup() {
  await db.query(`delete from ${s}.directus_access using ${s}.directus_users u where ${s}.directus_access.user=u.id and u.email=$1`, [EMAIL]).catch(()=>{});
  await db.query(`delete from ${s}.directus_users where email=$1`, [EMAIL]).catch(()=>{});
  await db.query(`delete from ${s}.directus_permissions where policy in (select id from ${s}.directus_policies where name=$1)`, [POLICY]).catch(()=>{});
  await db.query(`delete from ${s}.directus_policies where name=$1`, [POLICY]).catch(()=>{});
}

async function main() {
  await db.connect();
  await cleanup(); // idempotent

  const token = randomBytes(24).toString('hex');
  const pol = (await db.query(
    `insert into ${s}.directus_policies (id, name, icon, admin_access, app_access) values (gen_random_uuid(),$1,'policy',false,true) returning id`, [POLICY])).rows[0].id;
  for (const c of ['build_contract', 'build_contract_doc', 'contract_command']) {
    await db.query(
      `insert into ${s}.directus_permissions (policy, collection, action, permissions, fields) values ($1,$2,'read','{}'::json,'*')`, [pol, c]);
  }
  const uid = (await db.query(
    `insert into ${s}.directus_users (id, email, status, token) values (gen_random_uuid(),$1,'active',$2) returning id`, [EMAIL, token])).rows[0].id;
  await db.query(`insert into ${s}.directus_access (id, "user", policy) values (gen_random_uuid(),$1,$2)`, [uid, pol]);

  const H = { Authorization: `Bearer ${token}` };
  const get = async (path) => { const r = await fetch(`${BASE}${path}`, { headers: H }); if (!r.ok) throw new Error(`${path} -> HTTP ${r.status}`); return (await r.json()).data; };

  try {
    // 1) three readable document bodies
    const docs = await get('/items/build_contract_doc?filter[pack_version][_eq]=v1.1-draft&fields=doc_role,title,content_sha256,body_markdown&sort=sort');
    ok(Array.isArray(docs) && docs.length === 3, `authenticated Directus returns 3 pack documents (${docs.length})`);
    for (const d of docs) ok((d.body_markdown || '').length > 500, `  ${d.doc_role.padEnd(8)} body readable via Directus (${(d.body_markdown||'').length} chars, sha ${String(d.content_sha256).slice(0,10)}…)`);
    // 2) approval receipt on the contract row
    const bc = (await get('/items/build_contract?filter[contract_version][_eq]=v1.1-draft&fields=lifecycle_state,approved_by,pack_content_hash,git_commit_sha'))[0];
    ok(bc?.lifecycle_state === 'approved' && bc?.approved_by === 'warwick', `contract row shows approved by warwick (via Directus API)`);
    // 3) the bound command receipt
    const cc = (await get('/items/contract_command?filter[requested_by][_eq]=warwick&fields=command,status,receipt'))[0];
    ok(cc?.status === 'done' && cc?.receipt?.ok === true && cc?.receipt?.bound_content_hash === bc.pack_content_hash,
       `approval receipt done + ok, bound_content_hash matches pack (${String(bc.pack_content_hash).slice(0,10)}…)`);
  } finally {
    await cleanup();
  }
  console.log(`\nRESULT: ${fail === 0 ? 'PASS ✓' : 'FAIL ✗'} — ${pass} passed, ${fail} failed (ephemeral read-only token revoked)`);
}

main().catch(async (e) => { console.error('[verify] error', e.message); await cleanup().catch(()=>{}); process.exitCode = 1; }).finally(() => db.end());
