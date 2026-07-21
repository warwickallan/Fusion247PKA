// BUILD-014 LIVE cockpit — prove the acceptance for step 3's first slice:
// Directus, at a LOCAL authenticated URL, serves the REAL asdair.regulars over its HTTP API.
//   - wait for the server, log in as admin (authenticated URL), GET /items/regulars
//   - assert 91 real rows; print a few real names as evidence
//   - confirm nothing beyond regulars is exposed (a non-granted table is not readable)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rt = JSON.parse(fs.readFileSync(path.join(__dirname, '.runtime-live', 'runtime.json'), 'utf8'));
const base = rt.directus.url;

async function waitPing(ms = 40000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { const r = await fetch(`${base}/server/ping`); if (r.ok && (await r.text()).includes('pong')) return true; }
    catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function main() {
  if (!(await waitPing())) { console.error('[prove] Directus did not answer /server/ping in time'); process.exit(1); }
  console.log('[prove] Directus is up at', base);

  const login = await fetch(`${base}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: rt.directus.adminEmail, password: rt.directus.adminPassword }),
  });
  if (!login.ok) { console.error('[prove] admin login failed', login.status, await login.text()); process.exit(1); }
  const token = (await login.json()).data.access_token;
  console.log('[prove] authenticated as admin (this is the local login Warwick will use)');

  const H = { authorization: `Bearer ${token}` };
  const cntRes = await fetch(`${base}/items/regulars?aggregate[count]=*`, { headers: H });
  const cntJson = await cntRes.json();
  const count = Number(cntJson?.data?.[0]?.count ?? NaN);
  console.log(`[prove] GET /items/regulars aggregate count => ${count} ${count === 91 ? '(== 91 real rows ✓)' : '(UNEXPECTED)'}`);

  const sample = await (await fetch(`${base}/items/regulars?limit=6&fields=id,name,brand,category&sort=name`, { headers: H })).json();
  console.log('[prove] sample real rows:');
  for (const r of (sample.data || [])) console.log(`    #${r.id}  ${r.name ?? ''}${r.brand ? '  ['+r.brand+']' : ''}${r.category ? '  ('+r.category+')' : ''}`);

  // Negative: a non-granted asdair table must NOT be a usable collection.
  const neg = await fetch(`${base}/items/rules?limit=1`, { headers: H });
  const negOk = neg.status === 403 || neg.status === 404;
  console.log(`[prove] GET /items/rules => HTTP ${neg.status} ${negOk ? '(not exposed ✓)' : '(UNEXPECTED — exposed!)'}`);

  const pass = count === 91 && negOk;
  console.log(pass ? '\nRESULT: LIVE read proof PASS ✓ — real asdair regulars served at a local authenticated URL.'
                   : '\nRESULT: FAIL ✗');
  process.exit(pass ? 0 : 1);
}
main().catch((e) => { console.error('[prove] error', e.message); process.exit(1); });
