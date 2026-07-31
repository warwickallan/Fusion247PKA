// Session Health Sampler (BUILD-018 T-03)
//
// Turns one statusLine stdin payload into a written health sample (AD-2's ephemeral
// half). Built on tools/capture-statusline.mjs (T-01) and health-store.mjs (T-02):
// the capture script proved the payload is readable and kill-tolerant to write; this
// module extracts the fields the evaluator (T-04, not yet built) will need and hands
// them to writeHealthSample's already-proven atomic temp+rename write.
//
// Fast, idempotent, kill-tolerant (map section 2's design consequence):
//  - fast: no I/O beyond one JSON parse and one atomic write, both synchronous.
//  - idempotent: writing the same session's sample twice just overwrites — no
//    accumulation, no side effect keyed on prior state.
//  - kill-tolerant: inherited entirely from writeHealthSample's temp+rename (T-02);
//    this module adds nothing that could leave a torn file.
//
// A statusLine command's stdout is rendered directly by the UI, and this must never
// surface a crash there. Malformed, empty, or unparseable stdin writes NOTHING and
// exits 0 — silence is the correct behaviour for a telemetry probe, not a defect: a
// governor that stops measuring must not also break the thing it measures (INV-2's
// spirit applied to the sampler, even though the sampler itself isn't a blocking hook).

import { pathToFileURL } from 'node:url';
import { writeHealthSample } from './health-store.mjs';

export const SAMPLE_SCHEMA_VERSION = 1;

function get(obj, path) {
  return path.split('.').reduce(
    (o, k) => (o && typeof o === 'object' && k in o ? o[k] : undefined),
    obj
  );
}

function orNull(value) {
  return value === undefined ? null : value;
}

// ---------------------------------------------------------------------------
// Parsing — pure, never throws
// ---------------------------------------------------------------------------

export function parseStdinPayload(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Extraction — pure, never throws. Absent fields are null, never 0/false
// (AD-3's missing-field rule applied to the ephemeral sample, same as the
// durable schema's `unknown` semantics — a sampler that turns "not present in
// this payload" into a zero would silently manufacture a false reading for
// whatever the evaluator does with it later).
// ---------------------------------------------------------------------------

export function extractHealthSample(payload, { sampledAt = null } = {}) {
  if (!payload || typeof payload !== 'object') return null;

  const sessionId = orNull(payload.session_id);
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    // No session to key the health store on — nothing safe to write.
    return null;
  }

  return {
    schema_version: SAMPLE_SCHEMA_VERSION,
    sampled_at: sampledAt,
    session_id: sessionId,
    source: 'statusLine',
    version: orNull(payload.version),
    model: {
      id: orNull(get(payload, 'model.id')),
      display_name: orNull(get(payload, 'model.display_name')),
    },
    effort: {
      level: orNull(get(payload, 'effort.level')),
    },
    context_window: {
      used_percentage: orNull(get(payload, 'context_window.used_percentage')),
      remaining_percentage: orNull(get(payload, 'context_window.remaining_percentage')),
      context_window_size: orNull(get(payload, 'context_window.context_window_size')),
      total_input_tokens: orNull(get(payload, 'context_window.total_input_tokens')),
      total_output_tokens: orNull(get(payload, 'context_window.total_output_tokens')),
      exceeds_200k_tokens: orNull(payload.exceeds_200k_tokens),
    },
    rate_limits: {
      five_hour: {
        used_percentage: orNull(get(payload, 'rate_limits.five_hour.used_percentage')),
        resets_at: orNull(get(payload, 'rate_limits.five_hour.resets_at')),
      },
      seven_day: {
        used_percentage: orNull(get(payload, 'rate_limits.seven_day.used_percentage')),
        resets_at: orNull(get(payload, 'rate_limits.seven_day.resets_at')),
      },
    },
    workspace: {
      git_worktree: orNull(get(payload, 'workspace.git_worktree')),
    },
    worktree: {
      name: orNull(get(payload, 'worktree.name')),
      path: orNull(get(payload, 'worktree.path')),
      branch: orNull(get(payload, 'worktree.branch')),
    },
    pr: {
      number: orNull(get(payload, 'pr.number')),
      url: orNull(get(payload, 'pr.url')),
      review_state: orNull(get(payload, 'pr.review_state')),
    },
  };
}

// ---------------------------------------------------------------------------
// Sampling — the one impure step, still never throws. Returns a result object
// so a caller (or the CLI entrypoint below) can decide what to print, but the
// exit code contract is always 0: a sampler that exits non-zero can break the
// statusLine UI that invokes it.
// ---------------------------------------------------------------------------

export function sampleFromStdin(raw, { sampledAt = null, writer = writeHealthSample, storeOpts = {} } = {}) {
  const payload = parseStdinPayload(raw);
  if (!payload) return { written: false, reason: 'unreadable-payload' };

  const sample = extractHealthSample(payload, { sampledAt });
  if (!sample) return { written: false, reason: 'no-session-id' };

  try {
    const path = writer(sample.session_id, sample, storeOpts);
    return { written: true, path, sample };
  } catch (err) {
    // Never let a write failure propagate — the sampler must exit 0 regardless.
    return { written: false, reason: 'write-failed', error: err.message };
  }
}

// ---------------------------------------------------------------------------
// CLI entrypoint — reads stdin to EOF, samples, prints one short harmless line.
// ---------------------------------------------------------------------------

function isMain() {
  return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMain()) {
  let data = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    data += chunk;
  });
  process.stdin.on('end', () => {
    try {
      sampleFromStdin(data, { sampledAt: new Date().toISOString() });
    } catch {
      // A statusLine command must never surface a failure to the UI.
    }
    process.stdout.write(' ');
    process.exitCode = 0;
  });
}
