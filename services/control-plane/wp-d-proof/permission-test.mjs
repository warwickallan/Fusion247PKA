// BUILD-014 WP-D increment 1 — acceptance + adversarial permission proof.
//
//   node wp-d-proof/permission-test.mjs    (Directus must be running)
//
// Proves, over the live Directus cockpit API + the Postgres ledger:
//   ACCEPTANCE (privileged admin cockpit user):
//     A1  "Can I see the log of the Tower conversations?"  -> GET /items/tower_review_log
//     A2  "Can I see Mum's shopping lists?"                -> GET /items/lists (+ list_items)
//   ADVERSARIAL (non-privileged "Cockpit Viewer"):
//     V1  in-scope read allowed        -> GET /items/lists            == 200
//     V2  out-of-scope read DENIED     -> GET /items/tower_review_log == 403  (can't see the ledger)
//     V2b out-of-scope read DENIED     -> GET /items/tower_verdicts   == 403
//     V3  write DENIED (read-only)     -> POST/PATCH/DELETE on shopping == 403
//   DB-LAYER IMMUTABILITY (the real append-only ledger, even as superuser):
//     D1  UPDATE / DELETE ops.agent_event -> rejected 23001 by the append-only trigger
//
// Exits non-zero if ANY assertion fails.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rt = JSON.parse(fs.readFileSync(path.join(__dirname, '.runtime', 'runtime.json'), 'utf8'));
const base = rt.directus.url;

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  PASS  ${name}${detail ? ' — ' + detail : ''}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}

async function req(method, url, token, body) {
  const r = await fetch(base + url, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let d = null; try { d = await r.json(); } catch { /* none */ }
  return { status: r.status, d };
}
async function login(email, password) {
  const r = await req('POST', '/auth/login', null, { email, password });
  return r.d?.data?.access_token;
}

const adminTok = await login(rt.directus.adminEmail, rt.directus.adminPassword);
const viewerTok = await login(rt.directus.viewerEmail, rt.directus.viewerPassword);
check('admin + viewer authenticated', !!adminTok && !!viewerTok);

console.log('\n=== ACCEPTANCE (privileged cockpit user) ===');
const a1 = await req('GET', '/items/tower_review_log?sort=occurred_at&limit=-1', adminTok);
check('A1  "log of the Tower conversations" visible', a1.status === 200 && a1.d?.data?.length > 0,
  `${a1.status}, ${a1.d?.data?.length ?? 0} rows`);
if (a1.status === 200) {
  console.log('       first 3 beats:');
  for (const row of a1.d.data.slice(0, 3)) console.log(`         ${row.build_ref} ${row.actor} ${row.event_kind}: ${String(row.summary).slice(0, 60)}`);
}
const a2 = await req('GET', '/items/lists', adminTok);
const a2i = await req('GET', '/items/list_items', adminTok);
check('A2  "Mum\'s shopping lists" visible', a2.status === 200 && a2.d?.data?.length > 0 && a2i.d?.data?.length > 0,
  `lists=${a2.d?.data?.length ?? 0}, items=${a2i.d?.data?.length ?? 0}`);

console.log('\n=== ADVERSARIAL (non-privileged "Cockpit Viewer") ===');
const v1 = await req('GET', '/items/lists', viewerTok);
check('V1  in-scope read (lists) ALLOWED', v1.status === 200 && v1.d?.data?.length > 0, `status ${v1.status}`);
const v2 = await req('GET', '/items/tower_review_log', viewerTok);
check('V2  out-of-scope read (tower_review_log) DENIED', v2.status === 403, `status ${v2.status} (expected 403)`);
const v2b = await req('GET', '/items/tower_verdicts', viewerTok);
check('V2b out-of-scope read (tower_verdicts) DENIED', v2b.status === 403, `status ${v2b.status} (expected 403)`);
const v3c = await req('POST', '/items/lists', viewerTok, { owner_label: 'ATTACKER', list_name: 'injected' });
check('V3  create on shopping DENIED (read-only)', v3c.status === 403, `POST status ${v3c.status} (expected 403)`);
const v3p = await req('PATCH', '/items/lists/1', viewerTok, { list_name: 'tampered' });
check('V3  update on shopping DENIED (read-only)', v3p.status === 403, `PATCH status ${v3p.status} (expected 403)`);
const v3d = await req('DELETE', '/items/list_items/1', viewerTok);
check('V3  delete on shopping DENIED (read-only)', v3d.status === 403, `DELETE status ${v3d.status} (expected 403)`);

console.log('\n=== DB-LAYER IMMUTABILITY (real append-only ledger ops.agent_event) ===');
const { default: pg } = await import('pg');
const c = new pg.Client({ connectionString: `postgres://${rt.superuser}:${rt.password}@${rt.host}:${rt.port}/${rt.database}` });
await c.connect();
try {
  let code = null;
  try { await c.query(`update ops.agent_event set event_kind='tamper'`); } catch (e) { code = e.code; }
  check('D1  UPDATE ops.agent_event rejected (append-only trigger)', code === '23001', `SQLSTATE ${code}`);
  code = null;
  try { await c.query(`delete from ops.agent_event`); } catch (e) { code = e.code; }
  check('D1  DELETE ops.agent_event rejected (append-only trigger)', code === '23001', `SQLSTATE ${code}`);
} finally { await c.end(); }

console.log(`\n[permission-test] ${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
