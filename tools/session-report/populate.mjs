#!/usr/bin/env node
/**
 * Populate session_report.* from a rotation JSON payload.
 *
 * Usage:
 *   node tools/session-report/populate.mjs --file <payload.json>
 *
 * Credentials: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from the approved runtime
 * (never invent flags). On failure: exit non-zero and print a durable reason —
 * never silent. When credentials are absent, exit 2 with why=credentials-absent
 * so /rotate can record a visible FAIL without inventing success.
 *
 * Zero runtime deps: uses fetch to PostgREST.
 */
import { readFileSync, existsSync, appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--file') a.file = argv[++i];
    if (argv[i] === '--help') a.help = true;
  }
  return a;
}

function loadEnv() {
  // Prefer process env (approved runtime may inject). Optional local file for Mack-operated runs.
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  return { url, key };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.file) {
    process.stderr.write('usage: node tools/session-report/populate.mjs --file <payload.json>\n');
    process.exit(args.help ? 0 : 2);
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

  const { url, key } = loadEnv();
  if (!url || !key) {
    const rec = {
      ts: new Date().toISOString(),
      ok: false,
      why: 'credentials-absent',
      closing_head: payload.closing_head,
      deliverable_path: payload.deliverable_path,
    };
    process.stderr.write(JSON.stringify(rec) + '\n');
    // Durable local failure record so /rotate never fails silently
    try {
      const logDir = join(process.env.USERPROFILE || process.env.HOME || '.', '.mypka', 'governor');
      mkdirSync(logDir, { recursive: true });
      appendFileSync(join(logDir, 'session-report-populate.jsonl'), JSON.stringify(rec) + '\n');
    } catch { /* best effort */ }
    process.exit(2);
  }

  const base = url.replace(/\/$/, '');
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
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
    headers: { ...headers, Prefer: 'return=representation,resolution=merge-duplicates' },
    body: JSON.stringify(rotationRow),
  });

  if (!res.ok) {
    const body = await res.text();
    const rec = {
      ts: new Date().toISOString(),
      ok: false,
      why: 'supabase-post-failed',
      status: res.status,
      body: body.slice(0, 500),
      closing_head: payload.closing_head,
    };
    process.stderr.write(JSON.stringify(rec) + '\n');
    try {
      const logDir = join(process.env.USERPROFILE || process.env.HOME || '.', '.mypka', 'governor');
      appendFileSync(join(logDir, 'session-report-populate.jsonl'), JSON.stringify(rec) + '\n');
    } catch { /* */ }
    process.exit(5);
  }

  const rows = await res.json();
  const rotationId = Array.isArray(rows) ? rows[0]?.id : rows?.id;

  if (rotationId && Array.isArray(payload.specialists)) {
    for (const s of payload.specialists) {
      const r2 = await fetch(`${base}/rest/v1/session_report.specialist_dispatch`, {
        method: 'POST',
        headers,
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
        process.stderr.write(JSON.stringify({
          ok: false,
          why: 'specialist-row-failed',
          specialist: s.specialist,
          status: r2.status,
        }) + '\n');
        process.exit(6);
      }
    }
  }

  const ok = {
    ts: new Date().toISOString(),
    ok: true,
    why: 'populated',
    rotation_id: rotationId,
    closing_head: payload.closing_head,
    deliverable_path: payload.deliverable_path,
  };
  process.stdout.write(JSON.stringify(ok) + '\n');
  try {
    const logDir = join(process.env.USERPROFILE || process.env.HOME || '.', '.mypka', 'governor');
    appendFileSync(join(logDir, 'session-report-populate.jsonl'), JSON.stringify(ok) + '\n');
  } catch { /* */ }
  process.exit(0);
}

main().catch((e) => {
  process.stderr.write(JSON.stringify({ ok: false, why: 'exception', message: String(e?.message || e) }) + '\n');
  process.exit(1);
});
