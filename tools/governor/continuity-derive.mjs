// F2 auto-derivation — the missing half of the continuity journey (Wayfinder Phase 3).
//
// WHAT THIS CLOSES. continuity.mjs already PERSISTS the local state to Honcho (Stop hook,
// deduped) and READS it back (SessionStart). The gap was that the local state was only
// ever populated by a MANUAL `set` — so a fresh session recovered whatever Larry last
// remembered to type, which drifted stale. This module DERIVES the true current state
// from the session transcript automatically, with zero hand-authored fields, and hands it
// to continuity.mjs to persist. No human and no Larry has to remember a `set`.
//
// TRIGGER — SessionEnd, NEVER Stop (Warwick's ruling, 2026-08-02). Stop fires every turn;
// an LLM pass on every turn is unaffordable and A-7 forbids expensive work on the Stop
// path. SessionEnd fires ONCE, at the session boundary, which is exactly when a final
// state is worth deriving. Wire as a SessionEnd hook (see the proposal deliverable).
//
// FAILS SAFE. Any failure — no transcript, empty derive, unparseable JSON, LLM error —
// exits 0 and persists NOTHING, leaving the existing (possibly stale) state untouched.
// A boundary hook must never crash a session, and a bad derive must never clobber good
// continuity. On success it replaces the state wholesale, which is correct: the derive is
// the true current picture, not a patch.
//
// REVERSIBLE PROOF ARTEFACT. Committed so the mechanism is inspectable and git-revertible.
// It is NOT yet wired into settings — installation is the reviewed integration step.

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const DERIVE_MODEL = process.env.CONTINUITY_DERIVE_MODEL || 'claude-sonnet-5';
const MAX_MSGS = 40;
const FIELD_CAP = 1400;

const DERIVE_PROMPT =
  'The input is the recent conversation from a work session between Warwick (the user) and ' +
  'Larry (the assistant/orchestrator). Derive the CROSS-SESSION CONTINUITY STATE a fresh ' +
  'session would need to resume seamlessly. Output ONLY a raw JSON object (no prose, no ' +
  'markdown fence) with EXACTLY these keys: focus (string), immediate_objective (string), ' +
  'warwick_last_request (string), accepted_decisions (array of strings), completed (array ' +
  'of strings), blockers (array of strings), next_action (string), notes (string). Be ' +
  'accurate to what actually happened and concise. Do not invent. Unknown -> empty string/array.';

// ---- transcript -> clean recent conversation ------------------------------

export function extractConversation(transcriptPath, { maxMsgs = MAX_MSGS } = {}) {
  const raw = readFileSync(transcriptPath, 'utf8');
  const lines = raw.split('\n').filter((l) => l.trim());
  const msgs = [];
  for (const line of lines) {
    let rec;
    try { rec = JSON.parse(line); } catch { continue; }
    const m = rec.message ?? rec;
    const role = m.role ?? rec.type;
    if (role !== 'user' && role !== 'assistant') continue;
    const content = m.content;
    let text = '';
    if (typeof content === 'string') text = content;
    else if (Array.isArray(content)) {
      text = content.filter((b) => b && b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n');
    }
    text = text.trim();
    if (!text) continue;
    if (text.startsWith('<') && text.length < 60) continue; // system-reminder-ish noise
    msgs.push({ role, text });
  }
  return msgs.slice(-maxMsgs).map((mm) => {
    const body = mm.text.length > FIELD_CAP ? mm.text.slice(0, FIELD_CAP) + ' …[truncated]' : mm.text;
    return `${mm.role.toUpperCase()}: ${body}`;
  }).join('\n\n---\n\n');
}

// ---- LLM derive -----------------------------------------------------------

export function deriveState(conversation, { model = DERIVE_MODEL, timeoutMs = 120000 } = {}) {
  const res = spawnSync('claude', ['-p', DERIVE_PROMPT, '--model', model, '--max-turns', '1'], {
    input: conversation, encoding: 'utf8', timeout: timeoutMs, windowsHide: true,
  });
  if (res.status !== 0 || !res.stdout) {
    throw new Error(`derive LLM call failed (status ${res.status}): ${(res.stderr || '').slice(0, 200)}`);
  }
  let txt = res.stdout.trim();
  const m = txt.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) txt = m[1].trim();
  const state = JSON.parse(txt); // throws on non-JSON -> caller fails safe
  // shape guard: require the load-bearing fields to be present and typed
  if (typeof state.focus !== 'string' || typeof state.next_action !== 'string') {
    throw new Error('derived object missing required string fields focus/next_action');
  }
  return state;
}

// ---- CLI / hook entrypoint ------------------------------------------------

function readStdinPayload() {
  try { return JSON.parse(readFileSync(0, 'utf8')); } catch { return null; }
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const tArg = (() => { const i = argv.indexOf('--transcript'); return i >= 0 ? argv[i + 1] : null; })();

  const payload = tArg ? null : readStdinPayload();
  const transcriptPath = tArg || payload?.transcript_path || null;
  if (!transcriptPath) { process.stdout.write('continuity-derive: no transcript_path (nothing to do)\n'); return 0; }

  let state;
  try {
    const convo = extractConversation(transcriptPath);
    if (!convo) { process.stdout.write('continuity-derive: empty transcript (nothing to do)\n'); return 0; }
    state = deriveState(convo);
  } catch (e) {
    // FAIL SAFE: derive failed -> persist nothing, keep existing state.
    process.stdout.write(`continuity-derive: derive failed, state untouched: ${e.message}\n`);
    return 0;
  }

  if (dryRun) { process.stdout.write(JSON.stringify(state, null, 2) + '\n'); return 0; }

  // Persist through the REAL continuity module (local state + Honcho).
  const cont = await import(pathToFileURL(join(HERE, 'continuity.mjs')).href);
  cont.saveState(state);
  const r = await cont.writeContinuity(state, { reason: 'auto-derive', sessionId: payload?.session_id || null });
  process.stdout.write(JSON.stringify({ persisted: true, honcho_ok: r.ok, id: r.id, error: r.error || null }) + '\n');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((c) => { process.exitCode = c || 0; }).catch((e) => {
    process.stdout.write(`continuity-derive: unexpected error, state untouched: ${e.message}\n`);
    process.exitCode = 0; // never crash the session boundary
  });
}
