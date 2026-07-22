// BUILD-002 WP1 — prove the Obsidian Local REST API (AC2) + mirror the key to the Yoga secret store.
//   node services/hub/vault/prove-obsidian-api.mjs
// localhost-only, bearer-authenticated, TLS verified against the plugin's own self-signed cert
// (NOT global verification-disable, per §11). Prints only status — never the key.
import fs from 'node:fs';
import https from 'node:https';

const DATA = 'C:/Fusion247PKA/Team Knowledge/.obsidian/plugins/obsidian-local-rest-api/data.json';
const SECRET = 'C:/.fusion247/obsidian-rest-api.env';
const HOST = '127.0.0.1';
const cfg = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const PORT = cfg.port || 27124;
const KEY = cfg.apiKey;
const CA = cfg.crypto?.cert;
if (!KEY || !CA) { console.error('[obsidian] missing apiKey/cert in data.json'); process.exit(1); }

// Mirror the key + connection facts to the secret store (outside git). Never logged.
fs.writeFileSync(SECRET,
  `# BUILD-002 WP1 — Obsidian Local REST API (localhost only). NEVER commit. Generated ${new Date().toISOString()}\n` +
  `OBSIDIAN_API_URL=https://${HOST}:${PORT}\nOBSIDIAN_API_KEY=${KEY}\nOBSIDIAN_VAULT=Team Knowledge\n`, { mode: 0o600 });

const agent = new https.Agent({ ca: CA, rejectUnauthorized: true }); // trust the plugin cert only
function req(method, path, body, accept) {
  return new Promise((resolve, reject) => {
    const r = https.request({ host: HOST, port: PORT, path, method, agent,
      headers: { Authorization: `Bearer ${KEY}`, ...(body ? { 'Content-Type': 'text/markdown' } : {}), ...(accept ? { Accept: accept } : {}) } },
      (res) => { let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => resolve({ status: res.statusCode, body: d })); });
    r.on('error', reject); if (body) r.write(body); r.end();
  });
}

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m); } };
const TEST = '/vault/Sources/_api-selftest.md';
const NOTE = '/vault/Sources/pcr30j-skxu-ai-memory-just-got-solved-they-beat-openai-anthropic.md';

try {
  const root = await req('GET', '/');
  ok(root.status === 200 && /"authenticated":\s*true/.test(root.body), 'authenticated bearer request to the localhost API');
  const list = await req('GET', '/vault/Sources/');
  ok(list.status === 200 && list.body.includes('pcr30j'), 'SEARCH/LIST: /vault/Sources/ returns the Honcho note');
  const read = await req('GET', NOTE);
  ok(read.status === 200 && read.body.includes('Honcho'), 'READ: worker can read the governed note via the API');
  const meta = await req('GET', NOTE, null, 'application/vnd.olrapi.note+json');
  ok(meta.status === 200 && /frontmatter/.test(meta.body), 'METADATA: note frontmatter inspectable via the API');
  const write = await req('PUT', TEST, `---\nreview_state: api-selftest\n---\n\nWP1 AC2 write proof — safe to delete.\n`);
  ok(write.status === 204 || write.status === 200, 'WRITE: worker can create a note via the API');
  const readback = await req('GET', TEST);
  ok(readback.status === 200 && readback.body.includes('write proof'), 'WRITE round-trips (read the note just written)');
  const open = await req('POST', '/open/Sources/_api-selftest.md');
  ok(open.status === 200 || open.status === 204, 'OPEN: note can be opened in Obsidian via the API');
  const del = await req('DELETE', TEST);
  ok(del.status === 204 || del.status === 200, 'cleanup: selftest note deleted');
} catch (e) { console.error('[obsidian] error', e.message); fail++; }

console.log(`\nRESULT: ${fail === 0 ? 'PASS ✓' : 'FAIL ✗'} — ${pass} passed, ${fail} failed. Key mirrored to the Yoga secret store (not git).`);
process.exit(fail === 0 ? 0 : 1);
