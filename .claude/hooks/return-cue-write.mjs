#!/usr/bin/env node
/**
 * SubagentStop → write a return-cue marker (Option A reduced, BUILD-020 WO-22).
 *
 * Marker fields ONLY: session_id, agent_id, agent_type, ts.
 * No message content — the cue must not become a summary Larry acts on instead of the real return.
 *
 * Always exit 0. A cue path that can break a turn is worse than no cue.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const MARKER_FIELDS = Object.freeze(['session_id', 'agent_id', 'agent_type', 'ts']);

export function stateDirFromEnv(env = process.env) {
  const root = env.CLAUDE_PROJECT_DIR || process.cwd();
  return join(root, '.claude', 'state', 'return-cues');
}

export function buildMarker(payload, now = new Date()) {
  if (!payload || typeof payload !== 'object') return null;
  const agentId = payload.agent_id;
  if (agentId == null || agentId === '') return null;
  const sessionId = payload.session_id;
  if (sessionId == null || sessionId === '') return null;
  const agentType = payload.agent_type == null || payload.agent_type === ''
    ? 'unknown'
    : String(payload.agent_type);
  return {
    session_id: String(sessionId),
    agent_id: String(agentId),
    agent_type: agentType,
    ts: now.toISOString(),
  };
}

export function markerPath(stateDir, agentId) {
  // agent_id is host-generated hex-like; still sanitise path segments
  const safe = String(agentId).replace(/[^\w.-]+/g, '_');
  return join(stateDir, `${safe}.json`);
}

export function writeMarkerFile(stateDir, marker) {
  mkdirSync(stateDir, { recursive: true });
  const path = markerPath(stateDir, marker.agent_id);
  writeFileSync(path, `${JSON.stringify(marker)}\n`, 'utf8');
  return path;
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
    const marker = buildMarker(payload);
    if (!marker) process.exit(0);
    writeMarkerFile(stateDirFromEnv(), marker);
  } catch {
    // never break the parent/subagent turn
  }
  process.exit(0);
}

const isMain = process.argv[1] && (
  process.argv[1].endsWith('return-cue-write.mjs')
  || process.argv[1].includes('return-cue-write')
);

if (isMain && process.env.RETURN_CUE_NO_MAIN !== '1') {
  main();
}
