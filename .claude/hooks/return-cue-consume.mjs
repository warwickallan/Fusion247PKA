#!/usr/bin/env node
/**
 * Parent PreToolUse / UserPromptSubmit → claim return-cue markers and inject additionalContext.
 *
 * Parent-only: exit immediately if payload carries agent_id (subagent PreToolUse).
 *
 * Exactly-once claim via rename to .claimed. CORRECTED 2026-08-06 (WO-23 F2): the
 * previous comment claimed "Windows: rename fails if target exists → mutex". That
 * reason is FALSE — Node's fs.renameSync REPLACES an existing destination on Windows.
 * The mutex holds for a different reason: the winner's rename makes the SOURCE path
 * vanish, so every loser's renameSync throws ENOENT and skips. Safe behaviour, wrong
 * stated cause — and a wrong cause in a comment is what a later reader reasons from.
 *
 * Always exit 0.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_TTL_MS = 30 * 60 * 1000;

export function stateDirFromEnv(env = process.env) {
  const root = env.CLAUDE_PROJECT_DIR || process.cwd();
  return join(root, '.claude', 'state', 'return-cues');
}

export function textPathFromEnv(env = process.env) {
  if (env.RETURN_CUE_TEXT_PATH) return env.RETURN_CUE_TEXT_PATH;
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, 'return-cue-text.json');
}

/** Claude snake_case + Grok camelCase → one shape. */
export function normalizeHookPayload(raw) {
  if (!raw || typeof raw !== 'object') return {};
  return {
    ...raw,
    hook_event_name: raw.hook_event_name || raw.hookEventName || null,
    session_id: raw.session_id || raw.sessionId || null,
    agent_id: raw.agent_id || raw.agentId || null,
    agent_type: raw.agent_type || raw.agentType || null,
    tool_name: raw.tool_name || raw.toolName || null,
  };
}

export function isParentPayload(payload) {
  const p = normalizeHookPayload(payload);
  if (!p || typeof p !== 'object') return false;
  const id = p.agent_id;
  return id == null || id === '';
}

export function loadCueText(path) {
  const raw = readFileSync(path, 'utf8');
  return JSON.parse(raw);
}

export function formatCue(table, agentType) {
  const key = agentType && Object.prototype.hasOwnProperty.call(table, agentType)
    ? agentType
    : '_default';
  const template = table[key] || table._default || 'A background specialist has returned. Apply Rule 4a.';
  return String(template).replaceAll('{agent_type}', String(agentType || 'unknown'));
}

export function parseMarker(raw) {
  try {
    const j = JSON.parse(raw);
    if (!j || typeof j !== 'object') return null;
    if (!j.session_id || !j.agent_id || !j.ts) return null;
    return {
      session_id: String(j.session_id),
      agent_id: String(j.agent_id),
      agent_type: j.agent_type == null ? 'unknown' : String(j.agent_type),
      ts: String(j.ts),
    };
  } catch {
    return null;
  }
}

export function isFresh(marker, nowMs, ttlMs = DEFAULT_TTL_MS) {
  const t = Date.parse(marker.ts);
  if (Number.isNaN(t)) return false;
  return (nowMs - t) <= ttlMs;
}

/**
 * Claim matching markers. Returns claimed markers (may be multiple).
 *
 * Exactly-once: rename path.json → path.json.claimed. The loser of a race throws
 * ENOENT because the source is gone (see the file header — the rename does NOT
 * fail on an existing destination).
 */
export function claimMatchingMarkers(stateDir, sessionId, nowMs = Date.now(), ttlMs = DEFAULT_TTL_MS) {
  if (!existsSync(stateDir)) return [];
  mkdirSync(stateDir, { recursive: true });
  const claimed = [];
  // Claimed files are named "<id>.json.claimed", so .endsWith('.json') already excludes
  // them. A previous "!n.endsWith('.claimed.json')" clause here was dead code that read
  // like the duplicate guard while doing nothing (WO-23 F3). The real guard is the
  // rename below.
  const names = readdirSync(stateDir).filter((n) => n.endsWith('.json'));
  for (const name of names) {
    const path = join(stateDir, name);
    let raw;
    try {
      raw = readFileSync(path, 'utf8');
    } catch {
      continue;
    }
    const marker = parseMarker(raw);
    if (!marker) continue;
    if (marker.session_id !== sessionId) continue;
    if (!isFresh(marker, nowMs, ttlMs)) continue;
    const claimPath = `${path}.claimed`;
    try {
      renameSync(path, claimPath);
    } catch {
      // lost race or already claimed
      continue;
    }
    claimed.push({ marker, claimPath });
  }
  return claimed;
}

export function releaseClaims(claimed) {
  for (const c of claimed) {
    try {
      rmSync(c.claimPath, { force: true });
    } catch {
      /* ignore */
    }
  }
}

export function buildAdditionalContext(claimed, cueTable) {
  if (!claimed.length) return null;
  // One additionalContext string; name every claimed agent_type (Pax "each" + WO "exactly one" reconciled)
  const lines = claimed.map((c) => formatCue(cueTable, c.marker.agent_type));
  // de-dupe identical lines
  const unique = [...new Set(lines)];
  return unique.join('\n');
}

export function hookEventName(payload) {
  const p = normalizeHookPayload(payload);
  return p.hook_event_name || 'PreToolUse';
}

export function emitContext(eventName, text) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: eventName,
      additionalContext: text,
    },
  }));
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
    const p = normalizeHookPayload(payload);
    if (!isParentPayload(p)) process.exit(0);
    const sessionId = p.session_id;
    if (!sessionId) process.exit(0);

    const stateDir = stateDirFromEnv();
    const claimed = claimMatchingMarkers(stateDir, String(sessionId));
    if (!claimed.length) process.exit(0);

    let table = { _default: 'A background specialist has returned. Apply Rule 4a.' };
    try {
      table = loadCueText(textPathFromEnv());
    } catch {
      /* use fallback */
    }

    const text = buildAdditionalContext(claimed, table);
    if (text) {
      // Grok accepts the same hookSpecificOutput.additionalContext vocabulary as Claude.
      emitContext(hookEventName(p), text);
    }
    releaseClaims(claimed);
  } catch {
    // never break the turn
  }
  process.exit(0);
}

const isMain = process.argv[1] && (
  process.argv[1].endsWith('return-cue-consume.mjs')
  || process.argv[1].includes('return-cue-consume')
);

if (isMain && process.env.RETURN_CUE_NO_MAIN !== '1') {
  main();
}
