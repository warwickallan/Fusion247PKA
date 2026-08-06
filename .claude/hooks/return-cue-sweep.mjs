#!/usr/bin/env node
/**
 * SessionStart → drop markers for other sessions and past TTL.
 * Always exit 0.
 */
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

export const DEFAULT_TTL_MS = 30 * 60 * 1000;

export function stateDirFromEnv(env = process.env) {
  const root = env.CLAUDE_PROJECT_DIR || process.cwd();
  return join(root, '.claude', 'state', 'return-cues');
}

export function shouldDelete(marker, currentSessionId, nowMs, ttlMs = DEFAULT_TTL_MS) {
  if (!marker) return true;
  if (currentSessionId && marker.session_id !== currentSessionId) return true;
  const t = Date.parse(marker.ts);
  if (Number.isNaN(t)) return true;
  if ((nowMs - t) > ttlMs) return true;
  return false;
}

export function sweepStateDir(stateDir, currentSessionId, nowMs = Date.now(), ttlMs = DEFAULT_TTL_MS) {
  if (!existsSync(stateDir)) return { deleted: 0, kept: 0 };
  let deleted = 0;
  let kept = 0;
  for (const name of readdirSync(stateDir)) {
    const path = join(stateDir, name);
    // claimed leftovers and markers
    if (!name.endsWith('.json') && !name.endsWith('.json.claimed') && !name.endsWith('.claimed')) {
      continue;
    }
    let marker = null;
    try {
      marker = JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      try { rmSync(path, { force: true }); deleted += 1; } catch { /* */ }
      continue;
    }
    if (shouldDelete(marker, currentSessionId, nowMs, ttlMs)) {
      try { rmSync(path, { force: true }); deleted += 1; } catch { /* */ }
    } else {
      kept += 1;
    }
  }
  return { deleted, kept };
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
    const sessionId = payload.session_id || payload.sessionId
      ? String(payload.session_id || payload.sessionId)
      : null;
    sweepStateDir(stateDirFromEnv(), sessionId);
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
