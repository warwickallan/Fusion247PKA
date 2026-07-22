// BUILD-002 WP0 — reproducibly load the contract PACK (bodies + hashes) into live Supabase.
//
//   node wp-d-proof/load-contract-pack.mjs [--commit=<sha>] [--version=v1.1-draft]
//
// Reads the three pack documents STRAIGHT FROM GIT at the given commit (default HEAD), computes
// their blob shas + sha256 + the pack hash, then in one transaction: supersedes the prior active
// BUILD-002 contract, inserts the new cockpit.build_contract pack row, and inserts one
// cockpit.build_contract_doc row per member carrying the FULL readable Markdown body. This is the
// committed, reproducible population GPT's review requires — a clean run displays all three exact
// Git-bound documents as readable Markdown, with no manual live-row editing.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';

const REPO = 'C:/Fusion247PKA';
const DIR = 'Builds/BUILD-002-unified-personal-capture-gateway';
const args = process.argv.slice(2);
const arg = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const version = arg('version', 'v1.1-draft');
const commit = execFileSync('git', ['rev-parse', arg('commit', 'HEAD')], { cwd: REPO }).toString().trim();

const MEMBERS = [
  { role: 'brief',    file: 'BUILD-BRIEF.md',         title: 'Human-Readable Build Brief', sort: 0 },
  { role: 'contract', file: 'BUILD-CONTRACT.md',      title: 'Build Contract / PRD',       sort: 1 },
  { role: 'plan',     file: 'IMPLEMENTATION-PLAN.md', title: 'Implementation Plan',        sort: 2 },
];
const GH = `https://github.com/warwickallan/Fusion247PKA/blob/build-002/unified-fusion-hub/${DIR}`;
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

// Read each member from Git (committed content — line-ending stable).
const docs = MEMBERS.map((m) => {
  const path = `${DIR}/${m.file}`;
  const body = execFileSync('git', ['cat-file', 'blob', `${commit}:${path}`], { cwd: REPO, maxBuffer: 64 * 1024 * 1024 });
  const blob = execFileSync('git', ['rev-parse', `${commit}:${path}`], { cwd: REPO }).toString().trim();
  return { ...m, path, url: `${GH}/${m.file}`, body: body.toString('utf8'), git_blob_sha: blob, content_sha256: sha256(body) };
});
// pack hash = sha256 over the three member content_sha256 lines (order brief,contract,plan; newline-terminated).
const packHash = sha256(docs.map((d) => d.content_sha256).join('\n') + '\n');
const contract = docs.find((d) => d.role === 'contract');
const OUTCOME = 'Warwick can send information or instructions through the most natural front door — Telegram (DevBot / ShopperBot), forwarded email, voice note, or the Directus cockpit — and one central Fusion hub safely preserves the source, routes it to the correct specialist, records decisions and evidence, and returns a truthful contextual result, without Warwick manually relaying work between systems.';

function gatewayDsn() {
  const env = fs.readFileSync('C:/.fusion247/fusion-capture-gateway.env', 'utf8');
  const u = new URL(env.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL=')).slice('DATABASE_URL='.length).trim());
  const caFile = (env.split(/\r?\n/).find((l) => l.startsWith('DATABASE_SSL_CA_FILE=')) || '').split('=')[1]?.trim();
  const ssl = caFile ? { ca: fs.readFileSync(caFile), rejectUnauthorized: true } : { rejectUnauthorized: false };
  return { host: u.hostname, port: Number(u.port || 5432), user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password), database: (u.pathname || '/postgres').slice(1) || 'postgres', ssl };
}
const db = new pg.Client(gatewayDsn());

async function main() {
  await db.connect();
  console.log(`[load] commit ${commit.slice(0, 10)} -> pack ${version}`);
  for (const d of docs) console.log(`[load]   ${d.role.padEnd(8)} blob ${d.git_blob_sha.slice(0, 10)} sha256 ${d.content_sha256.slice(0, 12)}…`);
  console.log(`[load]   pack_content_hash ${packHash}`);

  await db.query('begin');
  try {
    // Supersede any prior non-terminal BUILD-002 contract (except this exact version, if re-run).
    await db.query(
      `update cockpit.build_contract set lifecycle_state='superseded', superseded_by_version=$1, updated_at=now()
        where build_id='BUILD-002' and contract_version <> $1 and lifecycle_state in ('draft','pending_approval','changes_requested')`,
      [version]);

    const documentsJson = JSON.stringify(docs.map((d) => ({
      doc_role: d.role, github_path: d.path, github_url: d.url,
      git_commit_sha: commit, git_blob_sha: d.git_blob_sha, content_sha256: d.content_sha256 })));

    await db.query(
      `insert into cockpit.build_contract
         (build_id, contract_version, doc_type, title, outcome,
          github_path, github_url, git_commit_sha, git_blob_sha, content_sha256,
          documents, pack_content_hash, current_wp, lifecycle_state, is_synthetic)
       values ('BUILD-002', $1, 'build_contract_pack',
          'BUILD-002 — Unified Fusion Hub · Approval Pack (Brief + Contract + Plan)', $2,
          $3, $4, $5, $6, $7, $8::jsonb, $9, 'WP0', 'draft', false)
       on conflict (build_id, contract_version) do nothing`,
      [version, OUTCOME, contract.path, contract.url, commit, contract.git_blob_sha, contract.content_sha256,
       documentsJson, packHash]);

    for (const d of docs) {
      await db.query(
        `insert into cockpit.build_contract_doc
           (build_id, pack_version, doc_role, title, github_path, github_url,
            git_commit_sha, git_blob_sha, content_sha256, body_markdown, sort)
         values ('BUILD-002', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         on conflict (build_id, pack_version, doc_role) do nothing`,
        [version, d.role, d.title, d.path, d.url, commit, d.git_blob_sha, d.content_sha256, d.body, d.sort]);
    }
    await db.query('commit');
  } catch (e) { await db.query('rollback'); throw e; }

  const n = (await db.query(`select count(*)::int c from cockpit.build_contract_doc where build_id='BUILD-002' and pack_version=$1`, [version])).rows[0].c;
  const st = (await db.query(`select lifecycle_state from cockpit.build_contract where build_id='BUILD-002' and contract_version=$1`, [version])).rows[0]?.lifecycle_state;
  console.log(`[load] done — build_contract ${version} lifecycle=${st}; ${n} readable doc bodies loaded.`);
}

main().catch((e) => { console.error('[load] error', e.message); process.exitCode = 1; }).finally(() => db.end());
