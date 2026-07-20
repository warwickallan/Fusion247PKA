// BUILD-014 Tower supervisor loop — session→Tower ingestion bridge (FIX 2).
//
// A Claude Code **Stop hook** invokes this at the end of every Larry turn. It reads the hook's
// JSON payload on STDIN (per Claude Code hook conventions: { session_id, transcript_path, ... }),
// extracts the latest INSTRUCTION (the last genuine user/Warwick message) and LARRY'S RESPONSE
// (the assistant text produced after it) from the session transcript JSONL, and calls
// ingestTurn() to create ONE pending durable turn. It is IDEMPOTENT per session-turn: the key
// is (session_id : last-assistant-message-uuid), so the same reply can never double-ingest.
//
// The persistent watcher (watcher.mjs) then claims and supervises the pending turn on its own.
// This bridge does NOT review, notify, or touch the merge path — it only lands the turn.
//
// FAIL-SOFT: a Stop hook must never wedge Larry's session. Any error is logged to stderr and
// the process exits 0 (never 2). Missing CONTROL_PLANE_DEV_DATABASE_URL → no-op exit 0.
//
//   Wire it (Warwick): .claude/settings.json Stop hook → node <abs>/bridge-ingest.mjs
//   Requires env:      CONTROL_PLANE_DEV_DATABASE_URL

import fs from 'node:fs';
import pg from 'pg';
import { ingestTurn } from './loop.mjs';

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    if (process.stdin.isTTY) return resolve('');
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { data += c; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(data));
    // Safety: if no stdin arrives, don't hang the hook.
    setTimeout(() => resolve(data), 4000).unref?.();
  });
}

/** Extract the user text from a transcript line's message. Returns null if it is not a real
 *  user instruction (tool_result rows, command stdout wrappers, meta rows are excluded). */
function userText(msg) {
  if (!msg) return null;
  const c = msg.content;
  if (typeof c === 'string') {
    const s = c.trim();
    if (!s) return null;
    // Skip slash-command scaffolding / local-command stdout wrappers — not a user instruction.
    if (s.startsWith('<local-command-stdout>') || s.startsWith('<command-name>') || s.startsWith('<command-message>')) return null;
    return s;
  }
  if (Array.isArray(c)) {
    // A tool_result-only message is NOT a user instruction.
    const texts = c.filter((b) => b?.type === 'text' && typeof b.text === 'string').map((b) => b.text);
    if (texts.length === 0) return null;
    const joined = texts.join('\n').trim();
    return joined || null;
  }
  return null;
}

/** Concatenate the assistant TEXT blocks from an assistant transcript line (skip thinking/tool_use). */
function assistantText(msg) {
  if (!msg || !Array.isArray(msg.content)) return '';
  return msg.content.filter((b) => b?.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n').trim();
}

/**
 * Parse the transcript JSONL: find the LAST genuine user instruction, then collect the
 * assistant text produced AFTER it (Larry's response) plus the last assistant message uuid
 * (the idempotency anchor).
 */
export function extractTurn(transcriptText) {
  const lines = String(transcriptText ?? '').split(/\r?\n/).filter(Boolean);
  const rows = [];
  for (const line of lines) {
    try { rows.push(JSON.parse(line)); } catch { /* skip non-JSON */ }
  }
  // Last genuine user instruction.
  let lastUserIdx = -1;
  let instruction = null;
  for (let i = rows.length - 1; i >= 0; i--) {
    const o = rows[i];
    if (o?.type !== 'user' || o.isMeta === true || o.isSidechain === true) continue;
    const t = userText(o.message);
    if (t) { lastUserIdx = i; instruction = t; break; }
  }
  if (lastUserIdx === -1) return { ok: false, reason: 'no user instruction found in transcript' };

  // Assistant text + last assistant uuid AFTER the instruction (Larry's response for this turn).
  const parts = [];
  let lastAssistantUuid = null;
  for (let i = lastUserIdx + 1; i < rows.length; i++) {
    const o = rows[i];
    if (o?.type !== 'assistant' || o.isSidechain === true) continue;
    const t = assistantText(o.message);
    if (t) parts.push(t);
    if (o.uuid) lastAssistantUuid = o.uuid;
    else if (o.message?.id) lastAssistantUuid = o.message.id;
  }
  const larryResponse = parts.join('\n\n').trim();
  if (!larryResponse) return { ok: false, reason: 'no assistant response after the last user instruction (turn not complete?)' };
  if (!lastAssistantUuid) return { ok: false, reason: 'could not resolve an assistant message uuid for idempotency' };

  return { ok: true, instruction, larryResponse, lastAssistantUuid };
}

async function main() {
  const raw = await readStdin();
  let hook = {};
  try { hook = raw ? JSON.parse(raw) : {}; } catch { hook = {}; }

  const transcriptPath = hook.transcript_path || process.env.CLAUDE_TRANSCRIPT_PATH;
  const sessionId = hook.session_id || process.env.CLAUDE_SESSION_ID || 'unknown-session';
  const dbUrl = process.env.CONTROL_PLANE_DEV_DATABASE_URL;

  if (!dbUrl) { console.error('[bridge-ingest] CONTROL_PLANE_DEV_DATABASE_URL unset — no-op'); return; }
  if (!transcriptPath) { console.error('[bridge-ingest] no transcript_path in hook payload — no-op'); return; }

  let transcript;
  try { transcript = fs.readFileSync(transcriptPath, 'utf8'); }
  catch (e) { console.error(`[bridge-ingest] cannot read transcript ${transcriptPath}: ${e.message}`); return; }

  const ex = extractTurn(transcript);
  if (!ex.ok) { console.error(`[bridge-ingest] nothing to ingest: ${ex.reason}`); return; }

  const sessionTurnKey = `${sessionId}:${ex.lastAssistantUuid}`;
  const pool = new pg.Pool({ connectionString: dbUrl, max: 2 });
  try {
    const row = await ingestTurn(pool, {
      instruction: ex.instruction,
      larryResponse: ex.larryResponse,
      buildRef: process.env.TOWER_BUILD_REF || undefined,
      sessionTurnKey,
    });
    console.error(`[bridge-ingest] ${row.deduped ? 'DEDUPED (already ingested)' : 'INGESTED'} turn ${row.id} seq=${row.seq} state=${row.state} key=${sessionTurnKey}`);
  } catch (e) {
    console.error(`[bridge-ingest] ingest failed: ${e.message}`);
  } finally {
    await pool.end();
  }
}

// Always exit 0 — a Stop hook must never block Larry's session.
main().catch((e) => { console.error(`[bridge-ingest] FATAL (soft): ${e?.message ?? e}`); }).finally(() => process.exit(0));
