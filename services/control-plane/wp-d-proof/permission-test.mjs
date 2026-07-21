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

// ---------------------------------------------------------------------------
//  increment 2 — the WRITE-BACK TRUST SEAM (app layer, via Directus)
// ---------------------------------------------------------------------------
console.log('\n=== INCREMENT 2 — CONSTRAINED WRITE-BACK (app layer, non-priv viewer) ===');

// C1: the viewer CAN toggle is_checked on a list item (the one allowed write).
const itemsForToggle = await req('GET', '/items/list_items?limit=1&fields=id,is_checked', adminTok);
const targetItem = itemsForToggle.d?.data?.[0];
const c1 = await req('PATCH', `/items/list_items/${targetItem.id}`, viewerTok, { is_checked: !targetItem.is_checked });
check('C1  viewer CAN check/uncheck a list item (is_checked)', c1.status === 200, `PATCH status ${c1.status} (expected 200)`);

// C2: the viewer CANNOT change any OTHER field on list_items (field-scoped deny).
const c2 = await req('PATCH', `/items/list_items/${targetItem.id}`, viewerTok, { item_name: 'TAMPERED' });
check('C2  viewer CANNOT change item_name (only is_checked permitted)', c2.status === 403, `PATCH status ${c2.status} (expected 403)`);

// C3: the viewer CAN INSERT an INTENT row (request a command) — but only intent.
const idem = 'perm-test-' + Date.now();
const c3 = await req('POST', '/items/command_request', viewerTok, {
  requested_by: 'viewer@wpd.example.com', command: 'recount_items', args: {}, idempotency_key: idem,
});
const newReqId = c3.d?.data?.id;
check('C3  viewer CAN request a command (INSERT intent)', c3.status === 200 && !!newReqId, `POST status ${c3.status}`);
// The row must have landed as status=requested with NO receipt (intent-only).
if (newReqId) {
  const created = await req('GET', `/items/command_request/${newReqId}?fields=status,receipt`, adminTok);
  check('C3b requested row is status=requested, receipt=null (intent only)',
    created.d?.data?.status === 'requested' && created.d?.data?.receipt == null,
    `status=${created.d?.data?.status}, receipt=${JSON.stringify(created.d?.data?.receipt)}`);
}

// C4: the viewer CANNOT execute — no update on the queue (can't complete/write a receipt).
const c4 = await req('PATCH', `/items/command_request/${newReqId}`, viewerTok, { status: 'done', receipt: { forged: true } });
check('C4  viewer CANNOT complete/receipt a command (no queue update)', c4.status === 403, `PATCH status ${c4.status} (expected 403)`);

// C5: the viewer CANNOT delete queue rows.
const c5 = await req('DELETE', `/items/command_request/${newReqId}`, viewerTok);
check('C5  viewer CANNOT delete a command_request', c5.status === 403, `DELETE status ${c5.status} (expected 403)`);

// C6: the viewer CANNOT write the worker-only metric table.
const c6 = await req('POST', '/items/cockpit_metric', viewerTok, { key: 'forged', value: 999, computed_by: 'attacker' });
check('C6  viewer CANNOT write cockpit_metric (worker-only)', c6.status === 403, `POST status ${c6.status} (expected 403)`);

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

// ---------------------------------------------------------------------------
//  increment 2 — DB-LAYER least-privilege proof (bypassing Directus entirely).
//  Even a direct DB connection as cp_directus / cp_worker is bounded by GRANTs.
// ---------------------------------------------------------------------------
async function attempt(client, sql, params) {
  try { await client.query(sql, params); return { ok: true, code: null }; }
  catch (e) { return { ok: false, code: e.code, msg: e.message }; }
}

console.log('\n=== INCREMENT 2 — DB-LAYER LEAST-PRIVILEGE: cp_directus (the cockpit) ===');
const dir = new pg.Client({ connectionString: `postgres://${rt.dbRoles.directusUser}:${rt.dbRoles.directusPassword}@${rt.host}:${rt.port}/${rt.database}` });
await dir.connect();
try {
  const anItem = (await dir.query('select id from public.list_items order by id limit 1')).rows[0];
  const r1 = await attempt(dir, `update public.list_items set is_checked = not is_checked where id = $1`, [anItem.id]);
  check('DB1 cp_directus CAN update is_checked', r1.ok, r1.ok ? 'ok' : `SQLSTATE ${r1.code}`);
  const r2 = await attempt(dir, `update public.list_items set item_name = 'x' where id = $1`, [anItem.id]);
  check('DB2 cp_directus CANNOT update item_name (column grant)', !r2.ok && r2.code === '42501', `SQLSTATE ${r2.code} (expected 42501)`);
  const r3 = await attempt(dir, `insert into public.command_request (requested_by, command, args, idempotency_key) values ('cp_directus','recount_items','{}', 'dbtest-'||gen_random_uuid())`);
  check('DB3 cp_directus CAN insert an INTENT command_request', r3.ok, r3.ok ? 'ok' : `SQLSTATE ${r3.code}`);
  const r4 = await attempt(dir, `update public.command_request set status='done'`);
  check('DB4 cp_directus CANNOT update command_request (no execute)', !r4.ok && r4.code === '42501', `SQLSTATE ${r4.code} (expected 42501)`);
  const r5 = await attempt(dir, `select 1 from ops.agent_event limit 1`);
  check('DB5 cp_directus CANNOT read ops.* ledger (no schema usage)', !r5.ok && (r5.code === '42501' || r5.code === '3F000'), `SQLSTATE ${r5.code} (expected 42501/3F000)`);
  const r6 = await attempt(dir, `insert into public.lists (owner_label, list_name) values ('x','y')`);
  check('DB6 cp_directus CANNOT insert into lists', !r6.ok && r6.code === '42501', `SQLSTATE ${r6.code} (expected 42501)`);
  const r7 = await attempt(dir, `insert into public.cockpit_metric (key, value, computed_by) values ('forged', 1, 'cp_directus')`);
  check('DB7 cp_directus CANNOT write cockpit_metric', !r7.ok && r7.code === '42501', `SQLSTATE ${r7.code} (expected 42501)`);
} finally { await dir.end(); }

console.log('\n=== INCREMENT 2 — DB-LAYER LEAST-PRIVILEGE: cp_worker (the executor) ===');
// Seed two dedicated requested rows (as superuser) for the worker-lifecycle assertions.
const su = new pg.Client({ connectionString: `postgres://${rt.superuser}:${rt.password}@${rt.host}:${rt.port}/${rt.database}` });
await su.connect();
const rowA = (await su.query(`insert into public.command_request (requested_by, command, idempotency_key) values ('seed','echo','wtestA-'||gen_random_uuid()) returning id`)).rows[0].id;
const rowB = (await su.query(`insert into public.command_request (requested_by, command, idempotency_key) values ('seed','echo','wtestB-'||gen_random_uuid()) returning id`)).rows[0].id;
await su.end();

const wrk = new pg.Client({ connectionString: `postgres://${rt.dbRoles.workerUser}:${rt.dbRoles.workerPassword}@${rt.host}:${rt.port}/${rt.database}` });
await wrk.connect();
try {
  // W1: the legitimate lifecycle — claim (requested->claimed) then complete (claimed->done + receipt).
  const w1a = await attempt(wrk, `update public.command_request set status='claimed', claimed_at=now() where id=$1`, [rowA]);
  const w1b = await attempt(wrk, `update public.command_request set status='done', completed_at=now(), receipt='{"ok":true}'::jsonb where id=$1`, [rowA]);
  check('W1  cp_worker CAN claim then complete (requested->claimed->done + receipt)', w1a.ok && w1b.ok, (w1a.ok && w1b.ok) ? 'ok' : `SQLSTATE ${w1a.code || w1b.code}`);
  const w2 = await attempt(wrk, `insert into public.command_request (requested_by, command, args, idempotency_key) values ('cp_worker','x','{}','w-'||gen_random_uuid())`);
  check('W2  cp_worker CANNOT insert command_request (cannot fabricate requests)', !w2.ok && w2.code === '42501', `SQLSTATE ${w2.code} (expected 42501)`);
  const w3 = await attempt(wrk, `select 1 from ops.agent_event limit 1`);
  check('W3  cp_worker CANNOT read ops.* ledger', !w3.ok && (w3.code === '42501' || w3.code === '3F000'), `SQLSTATE ${w3.code} (expected 42501/3F000)`);
  const w4 = await attempt(wrk, `update public.list_items set is_checked = true`);
  check('W4  cp_worker CANNOT write shopping (list_items)', !w4.ok && w4.code === '42501', `SQLSTATE ${w4.code} (expected 42501)`);
  const w5 = await attempt(wrk, `insert into public.cockpit_metric (key, value, computed_by) values ('worker_probe', 1, 'cp_worker') on conflict (key) do update set value = 1`);
  check('W5  cp_worker CAN write cockpit_metric (its side-effect surface)', w5.ok, w5.ok ? 'ok' : `SQLSTATE ${w5.code}`);
  // --- F2 fail-closed: the worker CANNOT rewrite the request or its provenance (columns not granted) ---
  const w6 = await attempt(wrk, `update public.command_request set command = 'rm -rf' where id=$1`, [rowB]);
  check('W6  cp_worker CANNOT rewrite command (column not granted)', !w6.ok && w6.code === '42501', `SQLSTATE ${w6.code} (expected 42501)`);
  const w7 = await attempt(wrk, `update public.command_request set requested_by = 'attacker' where id=$1`, [rowB]);
  check('W7  cp_worker CANNOT rewrite requested_by (column not granted)', !w7.ok && w7.code === '42501', `SQLSTATE ${w7.code} (expected 42501)`);
  const w8 = await attempt(wrk, `update public.command_request set is_synthetic = false where id=$1`, [rowB]);
  check('W8  cp_worker CANNOT flip is_synthetic (column not granted)', !w8.ok && w8.code === '42501', `SQLSTATE ${w8.code} (expected 42501)`);
  // --- F2 lifecycle: the worker CANNOT skip the claim or resurrect a completed row (transition trigger) ---
  const w9 = await attempt(wrk, `update public.command_request set status='done', receipt='{"forged":true}'::jsonb where id=$1`, [rowB]);
  check('W9  cp_worker CANNOT skip claim (requested->done rejected by transition trigger)', !w9.ok && w9.code === '23514', `SQLSTATE ${w9.code} (expected 23514)`);
  const w10 = await attempt(wrk, `update public.command_request set status='claimed' where id=$1`, [rowA]);
  check('W10 cp_worker CANNOT resurrect a completed row (done->claimed rejected)', !w10.ok && w10.code === '23514', `SQLSTATE ${w10.code} (expected 23514)`);
} finally { await wrk.end(); }

console.log('\n=== INCREMENT 2 — INTENT-ONLY GUARDS (belt-and-braces, fire for every role) ===');
const g = new pg.Client({ connectionString: `postgres://${rt.superuser}:${rt.password}@${rt.host}:${rt.port}/${rt.database}` });
await g.connect();
try {
  // Even the superuser cannot INSERT a pre-executed row: the guard trigger rejects it.
  const g1 = await attempt(g, `insert into public.command_request (requested_by, command, idempotency_key, status) values ('x','echo','g1-'||gen_random_uuid(),'done')`);
  check('G1  INSERT with status!=requested rejected by guard', !g1.ok && g1.code === '23514', `SQLSTATE ${g1.code} (expected 23514)`);
  const g2 = await attempt(g, `insert into public.command_request (requested_by, command, idempotency_key, receipt) values ('x','echo','g2-'||gen_random_uuid(),'{"forged":true}')`);
  check('G2  INSERT with a receipt rejected by guard', !g2.ok && g2.code === '23514', `SQLSTATE ${g2.code} (expected 23514)`);
  // Insert a dedicated requested row and prove the guards fire for EVERY role (superuser here).
  const gid = (await g.query(`insert into public.command_request (requested_by, command, idempotency_key) values ('gseed','noop','g-'||gen_random_uuid()) returning id`)).rows[0].id;
  const g3 = await attempt(g, `update public.command_request set command = 'rm -rf' where id=$1`, [gid]);
  check('G3  UPDATE rewriting the request command rejected by guard', !g3.ok && g3.code === '23514', `SQLSTATE ${g3.code} (expected 23514)`);
  const g4 = await attempt(g, `update public.command_request set is_synthetic = false where id=$1`, [gid]);
  check('G4  UPDATE flipping is_synthetic rejected by guard', !g4.ok && g4.code === '23514', `SQLSTATE ${g4.code} (expected 23514)`);
  const g5 = await attempt(g, `update public.command_request set status = 'done' where id=$1`, [gid]);
  check('G5  UPDATE skipping the claim (requested->done) rejected by guard', !g5.ok && g5.code === '23514', `SQLSTATE ${g5.code} (expected 23514)`);
  // Drive it legitimately to done, then prove a completed row is FINAL (no resurrection).
  await g.query(`update public.command_request set status='claimed', claimed_at=now() where id=$1`, [gid]);
  await g.query(`update public.command_request set status='done', completed_at=now(), receipt='{}'::jsonb where id=$1`, [gid]);
  const g6 = await attempt(g, `update public.command_request set status = 'claimed' where id=$1`, [gid]);
  check('G6  UPDATE resurrecting a completed row rejected by guard', !g6.ok && g6.code === '23514', `SQLSTATE ${g6.code} (expected 23514)`);
} finally { await g.end(); }

console.log(`\n[permission-test] ${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
