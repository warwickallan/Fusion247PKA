#!/usr/bin/env node
/**
 * SessionStart → drop EVERY marker. Unconditionally.
 *
 * A return-cue exists to be consumed inside the SAME live context that dispatched
 * the specialist. Any SessionStart — startup, clear, resume or compact — means that
 * context is gone, so every marker predating it is stale BY CONSTRUCTION.
 *
 * ── Why this is unconditional (WO-23 F1 repair, 2026-08-06) ───────────────────
 * The previous version kept a marker whose session_id matched the current session
 * and whose age was inside the TTL. A false cue was then observed firing on a fresh
 * context's very first UserPromptSubmit with zero specialists dispatched.
 *
 * The cause was NOT a cross-session marker. `return-cue-consume.mjs` refuses any
 * marker whose session_id differs from the consuming session, so a foreign marker
 * can never be consumed at all — the fact that this one WAS consumed proves its
 * session_id matched. It crossed a `/clear`, which PRESERVES the session id.
 *
 * Session id and TTL cannot detect a context boundary. SessionStart firing IS the
 * boundary, so the boundary itself is the only sound signal, and it needs no
 * payload field to be trusted.
 *
 * ── Fail-safe direction ───────────────────────────────────────────────────────
 * A missed nudge is recoverable — root CLAUDE.md Rule 4a is the actual control and
 * the hook was never more than a partial aid. A FALSE cue actively misleads the
 * parent into believing a specialist returned. So this sweep drops, never keeps.
 *
 * Always exit 0. A hook that can break SessionStart is worse than no hook.
 */
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

export const DEFAULT_TTL_MS = 30 * 60 * 1000;

export function stateDirFromEnv(env = process.env) {
  const root = env.CLAUDE_PROJECT_DIR || process.cwd();
  return join(root, '.claude', 'state', 'return-cues');
}

/** Marker files and claimed leftovers. Anything else in the dir is left alone. */
export function isMarkerFileName(name) {
  return name.endsWith('.json') || name.endsWith('.claimed');
}

/**
 * Delete every marker in the directory. `kept` is always 0 — it is retained in the
 * return shape so a caller asserting on it fails loudly if this ever regresses to
 * conditional sweeping.
 */
export function sweepStateDir(stateDir) {
  if (!existsSync(stateDir)) return { deleted: 0, kept: 0 };
  let deleted = 0;
  for (const name of readdirSync(stateDir)) {
    if (!isMarkerFileName(name)) continue;
    try {
      rmSync(join(stateDir, name), { force: true });
      deleted += 1;
    } catch { /* a marker we cannot remove must not break SessionStart */ }
  }
  return { deleted, kept: 0 };
}

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  try {
    const raw = await readStdin();
    let payload = {};
    try {
      payload = JSON.parse(raw || '{}');
    } catch {
      process.exit(0);
    }
    // payload is read only to confirm well-formed stdin; the sweep is unconditional
    // and deliberately does NOT depend on session_id being present or matching.
    void payload;
    sweepStateDir(stateDirFromEnv());
  } catch {
    // never break SessionStart
  }
  process.exit(0);
}

const isMain = process.argv[1] && (
  process.argv[1].endsWith('return-cue-sweep.mjs')
  || process.argv[1].includes('return-cue-sweep')
);

if (isMain && process.env.RETURN_CUE_NO_MAIN !== '1') {
  main();
}
