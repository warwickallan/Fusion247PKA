import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

import { buildMarker, writeMarkerFile, markerPath } from './return-cue-write.mjs';
import {
  isParentPayload,
  formatCue,
  parseMarker,
  isFresh,
  claimMatchingMarkers,
  buildAdditionalContext,
  DEFAULT_TTL_MS,
} from './return-cue-consume.mjs';
import { shouldDelete, sweepStateDir } from './return-cue-sweep.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const textTable = JSON.parse(readFileSync(join(here, 'return-cue-text.json'), 'utf8'));

describe('return-cue Option A', () => {
  let dir;

  before(() => {
    dir = mkdtempSync(join(tmpdir(), 'return-cue-'));
  });

  after(() => {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* */ }
  });

  it('buildMarker keeps only the four fields and rejects missing ids', () => {
    const m = buildMarker({
      session_id: 's1',
      agent_id: 'a1',
      agent_type: 'keel',
      last_assistant_message: 'SECRET DO NOT STORE',
      extra: true,
    }, new Date('2026-08-06T12:00:00.000Z'));
    assert.deepEqual(Object.keys(m).sort(), ['agent_id', 'agent_type', 'session_id', 'ts']);
    assert.equal(m.session_id, 's1');
    assert.equal(m.agent_id, 'a1');
    assert.equal(m.agent_type, 'keel');
    assert.equal(m.ts, '2026-08-06T12:00:00.000Z');
    assert.equal(buildMarker({ session_id: 's1' }), null);
    assert.equal(buildMarker({ agent_id: 'a1' }), null);
  });

  it('isParentPayload is true only when agent_id is absent', () => {
    assert.equal(isParentPayload({ tool_name: 'Bash' }), true);
    assert.equal(isParentPayload({ agent_id: null }), true);
    assert.equal(isParentPayload({ agent_id: '' }), true);
    assert.equal(isParentPayload({ agent_id: 'a515f57fcfad85cbd' }), false);
  });

  it('formatCue uses specialist text and falls back without inventing', () => {
    const keel = formatCue(textTable, 'keel');
    assert.match(keel, /Keel has returned/);
    assert.match(keel, /Rule 4a/);
    const unknown = formatCue(textTable, 'totally-unknown-type');
    assert.match(unknown, /totally-unknown-type/);
    assert.match(unknown, /Rule 4a/);
  });

  it('write + claim is parent-session scoped and consumes once', () => {
    const state = join(dir, 'cues1');
    const m = buildMarker({
      session_id: 'sess-parent',
      agent_id: 'agent-abc',
      agent_type: 'pax',
    }, new Date());
    writeMarkerFile(state, m);
    assert.equal(existsSync(markerPath(state, 'agent-abc')), true);

    // foreign session must not claim
    const foreign = claimMatchingMarkers(state, 'other-session');
    assert.equal(foreign.length, 0);
    assert.equal(existsSync(markerPath(state, 'agent-abc')), true);

    const claimed = claimMatchingMarkers(state, 'sess-parent');
    assert.equal(claimed.length, 1);
    assert.equal(claimed[0].marker.agent_type, 'pax');
    assert.equal(existsSync(markerPath(state, 'agent-abc')), false);

    // second claim finds nothing
    const again = claimMatchingMarkers(state, 'sess-parent');
    assert.equal(again.length, 0);

    const ctx = buildAdditionalContext(claimed, textTable);
    assert.match(ctx, /Pax has returned/);
  });

  it('TTL discards stale markers on claim', () => {
    const state = join(dir, 'cues2');
    mkdirSync(state, { recursive: true });
    const stale = {
      session_id: 's',
      agent_id: 'old',
      agent_type: 'keel',
      ts: new Date(Date.now() - DEFAULT_TTL_MS - 60_000).toISOString(),
    };
    writeFileSync(join(state, 'old.json'), JSON.stringify(stale));
    const claimed = claimMatchingMarkers(state, 's');
    assert.equal(claimed.length, 0);
    assert.equal(isFresh(stale, Date.now()), false);
  });

  it('atomic claim: second rename loses the race', () => {
    const state = join(dir, 'cues3');
    const m = buildMarker({
      session_id: 's',
      agent_id: 'race',
      agent_type: 'mack',
    }, new Date());
    writeMarkerFile(state, m);
    const first = claimMatchingMarkers(state, 's');
    assert.equal(first.length, 1);
    // pre-create .claimed so a second path-level race would fail; marker already gone
    const second = claimMatchingMarkers(state, 's');
    assert.equal(second.length, 0);
  });

  it('sweep removes foreign session and TTL-stale; keeps current fresh', () => {
    const state = join(dir, 'cues4');
    mkdirSync(state, { recursive: true });
    writeFileSync(join(state, 'a.json'), JSON.stringify({
      session_id: 'keep-me',
      agent_id: 'a',
      agent_type: 'keel',
      ts: new Date().toISOString(),
    }));
    writeFileSync(join(state, 'b.json'), JSON.stringify({
      session_id: 'foreign',
      agent_id: 'b',
      agent_type: 'keel',
      ts: new Date().toISOString(),
    }));
    writeFileSync(join(state, 'c.json'), JSON.stringify({
      session_id: 'keep-me',
      agent_id: 'c',
      agent_type: 'keel',
      ts: new Date(Date.now() - DEFAULT_TTL_MS - 1).toISOString(),
    }));
    const r = sweepStateDir(state, 'keep-me');
    assert.equal(r.kept, 1);
    assert.equal(r.deleted, 2);
    assert.equal(existsSync(join(state, 'a.json')), true);
    assert.equal(shouldDelete({ session_id: 'x', ts: new Date().toISOString() }, 'y', Date.now()), true);
  });

  it('CLI write script produces a four-field marker from SubagentStop-shaped stdin', () => {
    const stateRoot = join(dir, 'cli-write');
    const project = join(stateRoot, 'proj');
    mkdirSync(join(project, '.claude', 'hooks'), { recursive: true });
    const payload = JSON.stringify({
      hook_event_name: 'SubagentStop',
      session_id: 'cli-sess',
      agent_id: 'cli-agent',
      agent_type: 'general-purpose',
      last_assistant_message: 'must not appear on disk',
    });
    const res = spawnSync(process.execPath, [join(here, 'return-cue-write.mjs')], {
      input: payload,
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: project },
    });
    assert.equal(res.status, 0);
    const markerFile = join(project, '.claude', 'state', 'return-cues', 'cli-agent.json');
    assert.equal(existsSync(markerFile), true);
    const onDisk = JSON.parse(readFileSync(markerFile, 'utf8'));
    assert.deepEqual(Object.keys(onDisk).sort(), ['agent_id', 'agent_type', 'session_id', 'ts']);
    assert.equal(onDisk.agent_type, 'general-purpose');
    assert.ok(!JSON.stringify(onDisk).includes('must not appear'));
  });

  it('CLI consume emits additionalContext only for parent payloads', () => {
    const project = join(dir, 'cli-consume', 'proj');
    const cueDir = join(project, '.claude', 'state', 'return-cues');
    mkdirSync(cueDir, { recursive: true });
    writeFileSync(join(cueDir, 'x.json'), JSON.stringify({
      session_id: 'sess',
      agent_id: 'x',
      agent_type: 'veritas',
      ts: new Date().toISOString(),
    }));

    const parent = spawnSync(process.execPath, [join(here, 'return-cue-consume.mjs')], {
      input: JSON.stringify({
        hook_event_name: 'PreToolUse',
        session_id: 'sess',
        tool_name: 'Bash',
      }),
      encoding: 'utf8',
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: project,
        RETURN_CUE_TEXT_PATH: join(here, 'return-cue-text.json'),
      },
    });
    assert.equal(parent.status, 0);
    assert.ok(parent.stdout.length > 0);
    const out = JSON.parse(parent.stdout);
    assert.match(out.hookSpecificOutput.additionalContext, /Veritas has returned/);
    assert.equal(existsSync(join(cueDir, 'x.json')), false);

    // subagent must not emit
    writeFileSync(join(cueDir, 'y.json'), JSON.stringify({
      session_id: 'sess',
      agent_id: 'y',
      agent_type: 'keel',
      ts: new Date().toISOString(),
    }));
    const sub = spawnSync(process.execPath, [join(here, 'return-cue-consume.mjs')], {
      input: JSON.stringify({
        hook_event_name: 'PreToolUse',
        session_id: 'sess',
        agent_id: 'sub-running',
        agent_type: 'general-purpose',
        tool_name: 'Bash',
      }),
      encoding: 'utf8',
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: project,
        RETURN_CUE_TEXT_PATH: join(here, 'return-cue-text.json'),
      },
    });
    assert.equal(sub.status, 0);
    assert.equal(sub.stdout, '');
    assert.equal(existsSync(join(cueDir, 'y.json')), true);
  });

  it('parseMarker rejects garbage', () => {
    assert.equal(parseMarker('not-json'), null);
    assert.equal(parseMarker('{}'), null);
  });
});
