#!/usr/bin/env node
/**
 * Populate session_report.* from a rotation JSON payload.
 *
 * Usage:
 *   node tools/session-report/populate.mjs --file <payload.json>
 *   node tools/session-report/populate.mjs --apply-schema
 *   node tools/session-report/populate.mjs --apply-schema --file <payload.json>
 *
 * Credentials (ding pattern — FusionDevBot precedent):
 *   Fixed approved path CREDENTIALS_PATH is read inside this process only.
 *   Values are never exported to process.env, never printed, never logged.
 *   No --env-file. No shell preparation. Fresh-shell must work.
 *
 * Preferred credential (existing durable runtime):
 *   DATABASE_URL (+ optional DATABASE_SSL_CA_FILE) from
 *   C:/.fusion247/fusion-capture-gateway.env
 *   → Postgres via `psql` (schema apply + insert). Same project as BUILD-002.
 *
 * Optional REST fallback (if ever provisioned in that file):
 *   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)
 *   → PostgREST fetch. Not required when DATABASE_URL is present.
 *
 * On failure: exit non-zero and print a durable reason — never silent.
 * credentials-absent → exit 2 so /rotate can record a visible FAIL.
 *
 * Zero npm runtime deps. Schema application is idempotent (schema.sql).
 */
import { readFileSync, existsSync, appendFileSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Approved off-repo runtime — same file ding.mjs uses for Telegram. PATH literal only. */
export const CREDENTIALS_PATH = 'C:/.fusion247/fusion-capture-gateway.env';

/** Names we accept for DB/REST. NAMES are safe to log; values never are. */
export const CREDENTIAL_NAMES_DB = ['DATABASE_URL'];
export const CREDENTIAL_NAMES_REST = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
export const CREDENTIAL_NAMES_REST_ALT = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY'];

const SCHEMA_SQL = join(__dirname, 'schema.sql');
const LOG_PATH = join(homedir(), '.mypka', 'governor', 'session-report-populate.jsonl');

function parseArgs(argv) {
  const a = { applySchema: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--file') a.file = argv[++i];
    if (argv[i] === '--apply-schema') a.applySchema = true;
    if (argv[i] === '--help') a.help = true;
  }
  return a;
}

/** Minimal KEY=VALUE parser — ding.mjs shape. Does NOT write process.env. */
export function parseEnvText(text) {
  const out = {};
  for (const line of String(text).split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

/**
 * Load credentials from the approved file only (file is authoritative).
 * Inherited process.env SUPABASE_* / DATABASE_URL are IGNORED — same reason as ding:
 * honouring them re-admits shell dependence and makes fresh-shell acceptance unfalsifiable.
 */
export function loadCredentials(envPath = CREDENTIALS_PATH, { readFile = (p) => readFileSync(p, 'utf8') } = {}) {
  let text;
  try {
    text = readFile(envPath);
  } catch (err) {
    const absent = err && (err.code === 'ENOENT' || err.code === 'ENOTDIR');
    return {
      ok: false,
      outcome: absent ? 'credentials-file-absent' : 'credentials-file-unreadable',
      missing: [],
      mode: null,
    };
  }
  const vars = parseEnvText(text);
  const databaseUrl = vars.DATABASE_URL && String(vars.DATABASE_URL).trim();
  const sslCaFile = vars.DATABASE_SSL_CA_FILE && String(vars.DATABASE_SSL_CA_FILE).trim();
  const supabaseUrl =
    (vars.SUPABASE_URL && String(vars.SUPABASE_URL).trim()) ||
    (vars.NEXT_PUBLIC_SUPABASE_URL && String(vars.NEXT_PUBLIC_SUPABASE_URL).trim()) ||
    '';
  const serviceKey =
    (vars.SUPABASE_SERVICE_ROLE_KEY && String(vars.SUPABASE_SERVICE_ROLE_KEY).trim()) ||
    (vars.SUPABASE_SECRET_KEY && String(vars.SUPABASE_SECRET_KEY).trim()) ||
    '';

  if (databaseUrl) {
    return {
      ok: true,
      mode: 'database-url',
      databaseUrl,
      sslCaFile: sslCaFile || null,
      missing: [],
      outcome: 'ok',
    };
  }
  if (supabaseUrl && serviceKey) {
    return {
      ok: true,
      mode: 'postgrest',
      supabaseUrl,
      serviceKey,
      missing: [],
      outcome: 'ok',
    };
  }

  const missing = [];
  if (!databaseUrl) missing.push('DATABASE_URL');
  if (!supabaseUrl) missing.push('SUPABASE_URL');
  if (!serviceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY');
  return {
    ok: false,
    outcome: 'credentials-missing-names',
    missing,
    mode: null,
  };
}

/** Strip query params libpq/psql reject (node-pg may accept them). Never log result. */
function toPsqlConnectionString(url) {
  try {
    const u = new URL(url);
    u.searchParams.delete('uselibpqcompat');
    if (!u.searchParams.has('sslmode')) u.searchParams.set('sslmode', 'require');
    return u.toString();
  } catch {
    return String(url)
      .replace(/([?&])uselibpqcompat=[^&]*/g, '')
      .replace(/\?&/, '?')
      .replace(/[?&]$/, '');
  }
}

function scrubSecrets(text, secrets = []) {
  let out = String(text ?? '');
  for (const s of secrets.filter((x) => typeof x === 'string' && x.length >= 8).sort((a, b) => b.length - a.length)) {
    out = out.split(s).join('***');
  }
  out = out.replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, '***URL***');
  return out;
}

function appendLog(entry, secrets = []) {
  try {
    mkdirSync(dirname(LOG_PATH), { recursive: true });
    appendFileSync(LOG_PATH, scrubSecrets(JSON.stringify(entry), secrets) + '\n', 'utf8');
  } catch {
    /* best effort */
  }
}

/**
 * Run SQL via psql. Connection string passed as argv only to the child; not exported
 * into this process's process.env. Child env gets PGSSLROOTCERT when CA path exists.
 */
function runPsql(databaseUrl, sslCaFile, args, secrets) {
  const conn = toPsqlConnectionString(databaseUrl);
  const env = { ...process.env, PGSSLMODE: 'require' };
  // Do not leave DATABASE_URL / SUPABASE_* in child from parent either
  delete env.DATABASE_URL;
  delete env.SUPABASE_URL;
  delete env.SUPABASE_SERVICE_ROLE_KEY;
  delete env.SUPABASE_SECRET_KEY;
  delete env.NEXT_PUBLIC_SUPABASE_URL;
  if (sslCaFile && existsSync(sslCaFile)) env.PGSSLROOTCERT = sslCaFile;

  const r = spawnSync('psql', [conn, '-v', 'ON_ERROR_STOP=1', '-q', ...args], {
    encoding: 'utf8',
    timeout: 60_000,
    windowsHide: true,
    env,
  });

  if (r.error) {
    const msg = r.error.code === 'ENOENT' ? 'psql-not-on-path' : String(r.error.message || r.error);
    return { ok: false, why: 'psql-spawn-failed', detail: msg, status: null };
  }
  if (r.status !== 0) {
    return {
      ok: false,
      why: 'psql-failed',
      status: r.status,
      stderr: scrubSecrets(r.stderr, secrets).trim().slice(0, 500),
      stdout: scrubSecrets(r.stdout, secrets).trim().slice(0, 200),
    };
  }
  return {
    ok: true,
    stdout: scrubSecrets(r.stdout, secrets).trim(),
    stderr: scrubSecrets(r.stderr, secrets).trim(),
  };
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'object') {
    return sqlLiteral(JSON.stringify(value));
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

function applySchema(creds) {
  if (!existsSync(SCHEMA_SQL)) {
    return { ok: false, why: 'schema-file-absent', path: SCHEMA_SQL };
  }
  if (creds.mode === 'database-url') {
    const secrets = [creds.databaseUrl];
    const r = runPsql(creds.databaseUrl, creds.sslCaFile, ['-f', SCHEMA_SQL], secrets);
    if (!r.ok) return r;
    return { ok: true, why: 'schema-applied', mode: 'database-url' };
  }
  // PostgREST cannot run DDL; REST-only credentials cannot apply schema.
  return {
    ok: false,
    why: 'schema-requires-database-url',
    detail: 'PostgREST mode has no DDL path; place DATABASE_URL in the approved credentials file.',
  };
}

async function populatePostgrest(creds, payload) {
  const base = creds.supabaseUrl.replace(/\/$/, '');
  const key = creds.serviceKey;
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation,resolution=merge-duplicates',
  };
  const rotationRow = {
    session_date: payload.session_date,
    branch: payload.branch,
    closing_head: payload.closing_head,
    map_path: payload.map_path,
    deliverable_path: payload.deliverable_path,
    host: payload.host ?? null,
    host_version: payload.host_version ?? null,
    elapsed_minutes: payload.elapsed_minutes ?? null,
    total_context_tokens_in: payload.total_context_tokens_in ?? null,
    total_context_tokens_out: payload.total_context_tokens_out ?? null,
    parent_channel_available: payload.parent_channel_available ?? null,
    queued_messages: payload.queued_messages ?? null,
    wo_first_dispatch_success: payload.wo_first_dispatch_success ?? null,
    wo_amendments: payload.wo_amendments ?? null,
    wo_refusals: payload.wo_refusals ?? null,
    doc_lines_changed: payload.doc_lines_changed ?? null,
    product_lines_changed: payload.product_lines_changed ?? null,
    allocation_product_pct: payload.allocation_product_pct ?? null,
    allocation_admin_pct: payload.allocation_admin_pct ?? null,
    allocation_evidence_pct: payload.allocation_evidence_pct ?? null,
    allocation_rework_pct: payload.allocation_rework_pct ?? null,
    allocation_waiting_pct: payload.allocation_waiting_pct ?? null,
    unestablished: payload.unestablished ?? [],
    notes: payload.notes ?? null,
  };

  const res = await fetch(`${base}/rest/v1/session_report.rotation`, {
    method: 'POST',
    headers,
    body: JSON.stringify(rotationRow),
  });
  if (!res.ok) {
    const body = await res.text();
    return {
      ok: false,
      why: 'supabase-post-failed',
      status: res.status,
      body: body.slice(0, 500),
    };
  }
  const rows = await res.json();
  const rotationId = Array.isArray(rows) ? rows[0]?.id : rows?.id;

  if (rotationId && Array.isArray(payload.specialists)) {
    for (const s of payload.specialists) {
      const r2 = await fetch(`${base}/rest/v1/session_report.specialist_dispatch`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({
          rotation_id: rotationId,
          specialist: s.specialist,
          dispatches: s.dispatches ?? 0,
          tokens_in: s.tokens_in ?? null,
          tokens_out: s.tokens_out ?? null,
          notes: s.notes ?? null,
        }),
      });
      if (!r2.ok) {
        return {
          ok: false,
          why: 'specialist-row-failed',
          specialist: s.specialist,
          status: r2.status,
        };
      }
    }
  }
  return { ok: true, rotation_id: rotationId, mode: 'postgrest' };
}

function populateDatabaseUrl(creds, payload) {
  const secrets = [creds.databaseUrl];
  const specialists = Array.isArray(payload.specialists) ? payload.specialists : [];

  const sql = `
BEGIN;
INSERT INTO session_report.rotation (
  session_date, branch, closing_head, map_path, deliverable_path,
  host, host_version, elapsed_minutes,
  total_context_tokens_in, total_context_tokens_out,
  parent_channel_available, queued_messages,
  wo_first_dispatch_success, wo_amendments, wo_refusals,
  doc_lines_changed, product_lines_changed,
  allocation_product_pct, allocation_admin_pct, allocation_evidence_pct,
  allocation_rework_pct, allocation_waiting_pct,
  unestablished, notes
) VALUES (
  ${sqlLiteral(payload.session_date)}::date,
  ${sqlLiteral(payload.branch)},
  ${sqlLiteral(payload.closing_head)},
  ${sqlLiteral(payload.map_path)},
  ${sqlLiteral(payload.deliverable_path)},
  ${sqlLiteral(payload.host ?? null)},
  ${sqlLiteral(payload.host_version ?? null)},
  ${sqlLiteral(payload.elapsed_minutes ?? null)},
  ${sqlLiteral(payload.total_context_tokens_in ?? null)},
  ${sqlLiteral(payload.total_context_tokens_out ?? null)},
  ${sqlLiteral(payload.parent_channel_available ?? null)},
  ${sqlLiteral(payload.queued_messages ?? null)},
  ${sqlLiteral(payload.wo_first_dispatch_success ?? null)},
  ${sqlLiteral(payload.wo_amendments ?? null)},
  ${sqlLiteral(payload.wo_refusals ?? null)},
  ${sqlLiteral(payload.doc_lines_changed ?? null)},
  ${sqlLiteral(payload.product_lines_changed ?? null)},
  ${sqlLiteral(payload.allocation_product_pct ?? null)},
  ${sqlLiteral(payload.allocation_admin_pct ?? null)},
  ${sqlLiteral(payload.allocation_evidence_pct ?? null)},
  ${sqlLiteral(payload.allocation_rework_pct ?? null)},
  ${sqlLiteral(payload.allocation_waiting_pct ?? null)},
  ${sqlLiteral(payload.unestablished ?? [])}::jsonb,
  ${sqlLiteral(payload.notes ?? null)}
)
ON CONFLICT (closing_head, deliverable_path) DO UPDATE SET
  session_date = EXCLUDED.session_date,
  branch = EXCLUDED.branch,
  map_path = EXCLUDED.map_path,
  host = EXCLUDED.host,
  host_version = EXCLUDED.host_version,
  elapsed_minutes = EXCLUDED.elapsed_minutes,
  total_context_tokens_in = EXCLUDED.total_context_tokens_in,
  total_context_tokens_out = EXCLUDED.total_context_tokens_out,
  parent_channel_available = EXCLUDED.parent_channel_available,
  queued_messages = EXCLUDED.queued_messages,
  wo_first_dispatch_success = EXCLUDED.wo_first_dispatch_success,
  wo_amendments = EXCLUDED.wo_amendments,
  wo_refusals = EXCLUDED.wo_refusals,
  doc_lines_changed = EXCLUDED.doc_lines_changed,
  product_lines_changed = EXCLUDED.product_lines_changed,
  allocation_product_pct = EXCLUDED.allocation_product_pct,
  allocation_admin_pct = EXCLUDED.allocation_admin_pct,
  allocation_evidence_pct = EXCLUDED.allocation_evidence_pct,
  allocation_rework_pct = EXCLUDED.allocation_rework_pct,
  allocation_waiting_pct = EXCLUDED.allocation_waiting_pct,
  unestablished = EXCLUDED.unestablished,
  notes = EXCLUDED.notes
RETURNING id;
COMMIT;
`;

  const tmp = join(tmpdir(), `session-report-populate-${randomBytes(8).toString('hex')}.sql`);
  try {
    writeFileSync(tmp, sql, 'utf8');
    const r = runPsql(creds.databaseUrl, creds.sslCaFile, ['-t', '-A', '-f', tmp], secrets);
    if (!r.ok) return r;
    // stdout may include BEGIN/COMMIT noise with -q; take last UUID-looking token
    const lines = r.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const rotationId = lines.reverse().find((l) => /^[0-9a-f-]{36}$/i.test(l)) || lines[0] || null;
    if (!rotationId) {
      return { ok: false, why: 'no-rotation-id-returned', stdout: r.stdout.slice(0, 200) };
    }

    for (const s of specialists) {
      const sSql = `
INSERT INTO session_report.specialist_dispatch (
  rotation_id, specialist, dispatches, tokens_in, tokens_out, notes
) VALUES (
  ${sqlLiteral(rotationId)}::uuid,
  ${sqlLiteral(s.specialist)},
  ${sqlLiteral(s.dispatches ?? 0)},
  ${sqlLiteral(s.tokens_in ?? null)},
  ${sqlLiteral(s.tokens_out ?? null)},
  ${sqlLiteral(s.notes ?? null)}
);
`;
      const tmp2 = join(tmpdir(), `session-report-spec-${randomBytes(8).toString('hex')}.sql`);
      try {
        writeFileSync(tmp2, sSql, 'utf8');
        const r2 = runPsql(creds.databaseUrl, creds.sslCaFile, ['-f', tmp2], secrets);
        if (!r2.ok) {
          return { ok: false, why: 'specialist-row-failed', specialist: s.specialist, detail: r2 };
        }
      } finally {
        try { unlinkSync(tmp2); } catch { /* */ }
      }
    }

    return { ok: true, rotation_id: rotationId, mode: 'database-url' };
  } finally {
    try { unlinkSync(tmp); } catch { /* */ }
  }
}

function verifyRow(creds, closingHead, deliverablePath) {
  if (creds.mode !== 'database-url') return { ok: true, skipped: true };
  const secrets = [creds.databaseUrl];
  const q = `SELECT closing_head || '|' || deliverable_path || '|' || id::text
FROM session_report.rotation
WHERE closing_head = ${sqlLiteral(closingHead)}
  AND deliverable_path = ${sqlLiteral(deliverablePath)}
LIMIT 1;`;
  const r = runPsql(creds.databaseUrl, creds.sslCaFile, ['-t', '-A', '-c', q], secrets);
  if (!r.ok) return r;
  const line = r.stdout.trim();
  if (!line) return { ok: false, why: 'verify-row-missing' };
  const [head, path, id] = line.split('|');
  return {
    ok: true,
    verified: true,
    closing_head: head,
    deliverable_path: path,
    rotation_id: id,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || (!args.file && !args.applySchema)) {
    process.stderr.write(
      'usage: node tools/session-report/populate.mjs [--apply-schema] [--file <payload.json>]\n',
    );
    process.exit(args.help ? 0 : 2);
  }

  const creds = loadCredentials();
  if (!creds.ok) {
    const rec = {
      ts: new Date().toISOString(),
      ok: false,
      why: 'credentials-absent',
      outcome: creds.outcome,
      missing: creds.missing,
      credentials_path: CREDENTIALS_PATH,
    };
    process.stderr.write(JSON.stringify(rec) + '\n');
    appendLog(rec);
    process.exit(2);
  }

  const secrets =
    creds.mode === 'database-url'
      ? [creds.databaseUrl]
      : [creds.serviceKey, creds.supabaseUrl].filter(Boolean);

  if (args.applySchema) {
    const schemaResult = applySchema(creds);
    if (!schemaResult.ok) {
      const rec = {
        ts: new Date().toISOString(),
        ok: false,
        why: schemaResult.why,
        detail: schemaResult.detail || schemaResult.stderr || null,
        mode: creds.mode,
      };
      process.stderr.write(JSON.stringify(rec) + '\n');
      appendLog(rec, secrets);
      process.exit(7);
    }
    if (!args.file) {
      const ok = {
        ts: new Date().toISOString(),
        ok: true,
        why: 'schema-applied',
        mode: creds.mode,
      };
      process.stdout.write(JSON.stringify(ok) + '\n');
      appendLog(ok, secrets);
      process.exit(0);
    }
  }

  if (!existsSync(args.file)) {
    process.stderr.write(JSON.stringify({ ok: false, why: 'file-absent', file: args.file }) + '\n');
    process.exit(3);
  }

  const payload = JSON.parse(readFileSync(args.file, 'utf8'));
  const required = ['session_date', 'branch', 'closing_head', 'map_path', 'deliverable_path'];
  for (const k of required) {
    if (!payload[k]) {
      process.stderr.write(JSON.stringify({ ok: false, why: 'payload-missing-field', field: k }) + '\n');
      process.exit(4);
    }
  }
  if (String(payload.closing_head).length !== 40) {
    process.stderr.write(JSON.stringify({ ok: false, why: 'closing-head-not-40', len: String(payload.closing_head).length }) + '\n');
    process.exit(4);
  }

  // If schema not applied yet, apply it first (idempotent) when on database-url mode.
  if (creds.mode === 'database-url') {
    const schemaResult = applySchema(creds);
    if (!schemaResult.ok) {
      const rec = {
        ts: new Date().toISOString(),
        ok: false,
        why: schemaResult.why,
        detail: schemaResult.stderr || schemaResult.detail || null,
        closing_head: payload.closing_head,
      };
      process.stderr.write(JSON.stringify(rec) + '\n');
      appendLog(rec, secrets);
      process.exit(7);
    }
  }

  let result;
  if (creds.mode === 'database-url') {
    result = populateDatabaseUrl(creds, payload);
  } else {
    result = await populatePostgrest(creds, payload);
  }

  if (!result.ok) {
    const rec = {
      ts: new Date().toISOString(),
      ok: false,
      why: result.why,
      status: result.status ?? null,
      detail: result.detail || result.stderr || result.body || null,
      closing_head: payload.closing_head,
      mode: creds.mode,
    };
    process.stderr.write(JSON.stringify(rec) + '\n');
    appendLog(rec, secrets);
    process.exit(result.why === 'specialist-row-failed' ? 6 : 5);
  }

  const verification = verifyRow(creds, payload.closing_head, payload.deliverable_path);
  const ok = {
    ts: new Date().toISOString(),
    ok: true,
    why: 'populated',
    rotation_id: result.rotation_id,
    closing_head: payload.closing_head,
    deliverable_path: payload.deliverable_path,
    mode: result.mode,
    verified: verification.ok === true && verification.verified === true,
  };
  process.stdout.write(JSON.stringify(ok) + '\n');
  appendLog(ok, secrets);
  process.exit(verification.ok ? 0 : 8);
}

main().catch((e) => {
  process.stderr.write(JSON.stringify({ ok: false, why: 'exception', message: String(e?.message || e) }) + '\n');
  process.exit(1);
});
