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

/** An id that names a NUMBERED Work Order, as opposed to any other kind of dispatch. */
export const NUMBERED_WORK_ORDER_ID = /^WO-\d+$/;

/**
 * The STORED Work Order denominator for a rotation — `wo_total`.
 *
 * WHAT IT COUNTS: numbered Work Orders. NOT dispatch instances. The distinction is not pedantic —
 * the 4A payload's `work_orders` array holds NINE entries, of which only two (`WO-23`, `WO-24`) are
 * numbered orders; the other seven are Veritas gate rounds, Mack dispatches and research rounds. A
 * denominator of 9 would make "0 of 9 survived first read-back", which is false, and false in the
 * flattering direction.
 *
 * PRECEDENCE:
 *   1. an explicit `payload.wo_total`, when a future payload carries one — the producer's own count
 *      always wins over anything worked out here;
 *   2. otherwise the number of `work_orders` entries whose `id` matches /^WO-\d+$/;
 *   3. otherwise SQL NULL.
 *
 * WHY THIS IS NOT THE INFERENCE schema.sql FORBIDS. Deriving the total from
 * success + amendments + refusals is circular: those three are outcomes OF these orders, so their sum
 * can never contradict them and can never see an order that produced none of the three. Counting the
 * orders themselves reads a different fact out of the same source evidence.
 *
 * THE NULL RULE, at the one place it is easy to get wrong: an ABSENT or EMPTY `work_orders` array
 * returns null, not 0 — nothing was enumerated, so nothing is known. A NON-EMPTY array that happens to
 * contain no numbered order returns 0, which is a real zero: the dispatches were enumerated and none
 * of them was a Work Order.
 */
export function woTotal(payload) {
  const explicit = payload ? payload.wo_total : undefined;
  if (explicit !== undefined && explicit !== null && explicit !== '') {
    const n = Number(explicit);
    return Number.isFinite(n) ? n : null;
  }
  const entries = payload && Array.isArray(payload.work_orders) ? payload.work_orders : null;
  if (!entries || entries.length === 0) return null;
  return entries.filter((e) => e && NUMBERED_WORK_ORDER_ID.test(String(e.id ?? ''))).length;
}

/**
 * The git stat block. The payload names it `git_stat_larry_measured` (the measurer is part of the
 * claim); the column is `git_stat`. The plain name is accepted as a fallback so a future producer
 * that drops the suffix keeps working. Absent → NULL, meaning never measured — not an empty object.
 */
export function gitStat(payload) {
  if (!payload) return null;
  return payload.git_stat_larry_measured ?? payload.git_stat ?? null;
}

/**
 * The specialist rows a payload asserts for one rotation — and, separately, WHETHER IT ASSERTS
 * ANYTHING AT ALL. That second fact is the whole point of this function and it is why the return is
 * a pair rather than a bare array.
 *
 * `claimed: false` means the payload carried no `specialists` array. The payload made NO CLAIM about
 * specialists, so the writer upserts nothing AND DELETES NOTHING. `claimed: true` with an empty
 * `rows` is the opposite: a positive assertion that this rotation had no specialist dispatches, which
 * legitimately removes every existing row for that rotation.
 *
 * WHY THE DISTINCTION IS LOAD-BEARING RATHER THAN PEDANTIC. Once the writer deletes rows the payload
 * no longer lists, letting "absent" and "empty" collapse into one another turns a single truncated or
 * malformed payload into a silent wipe of a rotation's specialist rows — rows that exist nowhere else
 * in the mirror. That would be a DATA-LOSS ROUTE introduced by an idempotency repair: a worse defect
 * than the duplication it fixes. It is the same null-is-not-zero rule the rest of this file applies to
 * scalars (`?? null`, never `?? 0`), applied to a collection: absent is not empty.
 *
 * NULL HANDLING, per column and deliberately not uniform:
 *   - tokens, tokens_in, tokens_out, notes are NULLABLE, so an absent key becomes SQL NULL — never 0
 *     and never ''. `tokens` is the measured TOTAL the payload actually carries; tokens_in/tokens_out
 *     stay NULL because the payload carries no split, and inventing one would be fabrication.
 *   - dispatches is `not null default 0` in schema.sql and so cannot hold NULL. `?? 0` there is the
 *     column's own contract, not an exception to the rule above.
 */
export function specialistRows(payload) {
  const raw = payload && Array.isArray(payload.specialists) ? payload.specialists : null;
  if (!raw) return { claimed: false, rows: [] };
  return {
    claimed: true,
    rows: raw.map((s) => ({
      specialist: String(s?.specialist ?? ''),
      dispatches: s?.dispatches ?? 0,
      tokens: s?.tokens ?? null,
      tokens_in: s?.tokens_in ?? null,
      tokens_out: s?.tokens_out ?? null,
      notes: s?.notes ?? null,
    })),
  };
}

/**
 * The COMPLETE specialist write for one rotation as a single transactional SQL script — or `null`
 * when the payload made no claim and nothing at all should run.
 *
 * Three properties are deliberate, and each is asserted by tools/session-report/idempotency-check.mjs:
 *
 *   1. ONE TRANSACTION, ONE INVOCATION. Before WO-28 each specialist row was a separate `psql` call
 *      outside any transaction. That was survivable while the writer only inserted; it stops being
 *      survivable the moment a DELETE exists, because a crash between the delete and the re-insert
 *      loses rows that exist nowhere else. BEGIN/COMMIT makes the mirror update atomic.
 *   2. UPSERT FIRST, DELETE LAST — never the reverse. Delete-then-insert opens a window in which the
 *      rotation has no specialist rows at all; on failure that window becomes permanent.
 *   3. ONE STATEMENT PER ROW rather than a single multi-row VALUES. A multi-row upsert raises
 *      "ON CONFLICT DO UPDATE command cannot affect row a second time" if a payload ever lists the
 *      same specialist twice. Per-row statements inside the transaction make that case last-one-wins
 *      instead of a hard failure, which is the right behaviour for a mirror.
 *
 * The DELETE is scoped to this rotation_id alone. `specialist` is NOT NULL in the schema, so the
 * `NOT IN (...)` list can never contain a NULL and can never silently match nothing.
 */
export function specialistWriteSql(rotationId, payload) {
  const { claimed, rows } = specialistRows(payload);
  if (!claimed) return null;

  const upserts = rows.map(
    (r) => `INSERT INTO session_report.specialist_dispatch (
  rotation_id, specialist, dispatches, tokens, tokens_in, tokens_out, notes
) VALUES (
  ${sqlLiteral(rotationId)}::uuid,
  ${sqlLiteral(r.specialist)},
  ${sqlLiteral(r.dispatches)},
  ${sqlLiteral(r.tokens)},
  ${sqlLiteral(r.tokens_in)},
  ${sqlLiteral(r.tokens_out)},
  ${sqlLiteral(r.notes)}
)
ON CONFLICT (rotation_id, specialist) DO UPDATE SET
  dispatches = EXCLUDED.dispatches,
  tokens = EXCLUDED.tokens,
  tokens_in = EXCLUDED.tokens_in,
  tokens_out = EXCLUDED.tokens_out,
  notes = EXCLUDED.notes;`,
  );

  const keep = rows.map((r) => sqlLiteral(r.specialist)).join(', ');
  const prune = rows.length
    ? `DELETE FROM session_report.specialist_dispatch
WHERE rotation_id = ${sqlLiteral(rotationId)}::uuid
  AND specialist NOT IN (${keep});`
    : `DELETE FROM session_report.specialist_dispatch
WHERE rotation_id = ${sqlLiteral(rotationId)}::uuid;`;

  return ['BEGIN;', ...upserts, prune, 'COMMIT;', ''].join('\n');
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
    // WO-25: fields the payload has always carried and this writer used to discard. `?? null` is
    // load-bearing — an absent key becomes SQL NULL ("not established"), never 0 and never ''.
    total_subagent_tokens: payload.total_subagent_tokens ?? null,
    wo_total: woTotal(payload),
    git_stat: gitStat(payload),
    work_orders: payload.work_orders ?? [],
    findings: payload.findings ?? [],
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

  // The same idempotency property as the database-url path: on_conflict names the unique index added
  // in schema.sql, and resolution=merge-duplicates is what turns PostgREST's POST into an upsert. The
  // `claimed` guard is shared with that path via specialistRows(), so an absent `specialists` array
  // means "no claim" here too.
  //
  // KNOWN AND DELIBERATE ASYMMETRY, recorded here so it is never mistaken for an oversight: this
  // branch does NOT prune specialists dropped from a later payload. Only the upsert half of WO-28 was
  // authorised here. This branch is also UNPROVEN — see the schema-qualification note on the rotation
  // POST below.
  const { claimed: specialistsClaimed, rows: specialistRowList } = specialistRows(payload);
  if (rotationId && specialistsClaimed) {
    for (const r of specialistRowList) {
      const r2 = await fetch(
        `${base}/rest/v1/session_report.specialist_dispatch?on_conflict=rotation_id,specialist`,
        {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=representation,resolution=merge-duplicates' },
          body: JSON.stringify({
            rotation_id: rotationId,
            specialist: r.specialist,
            dispatches: r.dispatches,
            tokens: r.tokens,
            tokens_in: r.tokens_in,
            tokens_out: r.tokens_out,
            notes: r.notes,
          }),
        },
      );
      if (!r2.ok) {
        return {
          ok: false,
          why: 'specialist-row-failed',
          specialist: r.specialist,
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
  unestablished, notes,
  total_subagent_tokens, wo_total, git_stat, work_orders, findings
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
  ${sqlLiteral(payload.notes ?? null)},
  ${sqlLiteral(payload.total_subagent_tokens ?? null)},
  ${sqlLiteral(woTotal(payload))},
  ${sqlLiteral(gitStat(payload))}::jsonb,
  ${sqlLiteral(payload.work_orders ?? [])}::jsonb,
  ${sqlLiteral(payload.findings ?? [])}::jsonb
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
  notes = EXCLUDED.notes,
  total_subagent_tokens = EXCLUDED.total_subagent_tokens,
  wo_total = EXCLUDED.wo_total,
  git_stat = EXCLUDED.git_stat,
  work_orders = EXCLUDED.work_orders,
  findings = EXCLUDED.findings
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

    // ONE transactional invocation for every specialist row plus the prune, rather than one psql
    // call per row outside any transaction. `null` means the payload made no claim about specialists,
    // in which case nothing is written and nothing is removed — see specialistRows().
    const specialistSql = specialistWriteSql(rotationId, payload);
    if (specialistSql !== null) {
      const tmp2 = join(tmpdir(), `session-report-spec-${randomBytes(8).toString('hex')}.sql`);
      try {
        writeFileSync(tmp2, specialistSql, 'utf8');
        const r2 = runPsql(creds.databaseUrl, creds.sslCaFile, ['-f', tmp2], secrets);
        if (!r2.ok) {
          return { ok: false, why: 'specialist-row-failed', specialists: specialists.length, detail: r2 };
        }
      } finally {
        try { unlinkSync(tmp2); } catch { /* */ }
      }
    }

    return {
      ok: true,
      rotation_id: rotationId,
      mode: 'database-url',
      specialists_written: specialistSql === null ? null : specialists.length,
    };
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
