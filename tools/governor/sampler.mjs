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

import { openSync, fstatSync, readSync, closeSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { writeHealthSample, readHealthSample } from './health-store.mjs';

export const SAMPLE_SCHEMA_VERSION = 1;

// Where a sample came from. `statusLine` is the terminal payload (authoritative on the
// window SIZE, invisible to Warwick); `transcript` is the Stop-hook path (fires on every
// client including claude.ai web and Android, authoritative on the token COUNT).
export const SOURCE_STATUSLINE = 'statusLine';
export const SOURCE_TRANSCRIPT = 'transcript';

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
    source: SOURCE_STATUSLINE,
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

// ===========================================================================
// THE TRANSCRIPT PATH (WO-OR-05) — the half that actually reaches Warwick
// ===========================================================================
//
// THE DEFECT THIS EXISTS TO FIX. Everything above this line is fed by the terminal
// `statusLine`, which does not run on claude.ai web or on Android. Warwick works on both.
// So for him the health store was permanently empty and the `⟦GOV⟧` footer rendered
// `BLIND` forever — a governor reporting on ground it had never examined.
//
// The Stop hook fires on EVERY client and its payload carries `transcript_path`. The
// transcript's newest assistant message carries a `usage` block. That gives a real token
// count on every client, from a hook that is already installed.
//
// WHAT THIS PATH CANNOT DO, stated plainly rather than papered over: the transcript
// carries NO context-window size. Verified by reading real transcripts on this machine.
// So this path produces a true NUMERATOR and, on its own, no percentage. The denominator
// is resolved separately and only from authoritative sources — see `resolveWindowTokens`.
// A model -> window lookup table is forbidden: this estate runs 1M-context and
// 200k-context sessions of the same model, so such a table manufactures a confident lie.

// Read at most this much of the tail. Transcripts reach tens of megabytes (32MB observed
// on this machine) and this runs on every turn end, so reading the whole file is not an
// option. The newest assistant message is at the END, and assistant messages are small —
// the multi-megabyte lines are tool results. If no usage is found in the tail we report
// that, rather than silently widening the read until something turns up.
export const TRANSCRIPT_TAIL_BYTES = 2 * 1024 * 1024;

/**
 * readTranscriptTail(path, maxBytes) -> string
 *
 * Never throws. Returns '' on any failure. The first line is dropped whenever the file
 * was larger than the window, because that line is almost certainly a fragment — parsing
 * half a JSON object would throw, and a fragment that happened to parse would be worse.
 */
export function readTranscriptTail(path, maxBytes = TRANSCRIPT_TAIL_BYTES) {
  if (typeof path !== 'string' || path.length === 0) return '';
  let fd;
  try {
    fd = openSync(path, 'r');
    const size = fstatSync(fd).size;
    const length = Math.min(size, maxBytes);
    const start = size - length;
    const buf = Buffer.allocUnsafe(length);
    readSync(fd, buf, 0, length, start);
    const text = buf.toString('utf8');
    return start > 0 ? text.slice(text.indexOf('\n') + 1) : text;
  } catch {
    return '';
  } finally {
    if (fd !== undefined) {
      try { closeSync(fd); } catch { /* nothing left to do about it */ }
    }
  }
}

/**
 * sumUsedTokens(usage) -> number|null
 *
 * Everything occupying the context window: fresh input, cache writes, cache reads, and
 * the model's own output. Cache reads are the dominant term in a long session and
 * omitting them would under-report by an order of magnitude.
 *
 * Returns null when NO field was usable, never 0 — the missing-field rule this module
 * already applies everywhere else. A zero would read as "an empty context", which is a
 * very different claim from "I could not measure it".
 */
export function sumUsedTokens(usage) {
  if (!usage || typeof usage !== 'object') return null;
  const keys = ['input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens', 'output_tokens'];
  let total = 0;
  let seen = 0;
  for (const k of keys) {
    const v = usage[k];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
      total += v;
      seen += 1;
    }
  }
  return seen === 0 ? null : total;
}

/**
 * newestAssistantUsage(text) -> { usage, modelId, effort, sessionId }|null
 *
 * Scans the JSONL BACKWARDS and stops at the first assistant message carrying usage —
 * the newest one. Unparseable lines are skipped, never fatal: a transcript is an
 * append-only log written by another process and may well end mid-write.
 */
export function newestAssistantUsage(text) {
  if (typeof text !== 'string' || text.length === 0) return null;
  const lines = text.split('\n');
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (!line || line.charCodeAt(0) !== 123 /* '{' */) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    if (!obj || obj.type !== 'assistant' || !obj.message || !obj.message.usage) continue;
    return {
      usage: obj.message.usage,
      modelId: typeof obj.message.model === 'string' ? obj.message.model : null,
      effort: typeof obj.effort === 'string' ? obj.effort : null,
      sessionId: typeof obj.sessionId === 'string' ? obj.sessionId : null,
    };
  }
  return null;
}

// The two provenances a denominator may carry, named once rather than spelled inline.
// `WINDOW_SOURCE_OBSERVED` is both PRODUCED and CHECKED by the resolver below — a
// transcript sample carries it forward across the store's last-write-wins overwrite, and
// the next call reads it back — so the write site and the read site must be the same
// value, not two string literals that can drift apart.
export const WINDOW_SOURCE_ENV = 'env:CLAUDE_CONTEXT_WINDOW';
export const WINDOW_SOURCE_OBSERVED = 'statusline-observed';

const NO_WINDOW = Object.freeze({ tokens: null, source: null });

/**
 * resolveWindowTokens({ sessionId, usedTokens, ... }) -> { tokens: number|null, source: string|null }
 *
 * THE DENOMINATOR, AND THE ONLY TWO WAYS IT MAY BE OBTAINED:
 *
 *   1. `CLAUDE_CONTEXT_WINDOW` — an explicit statement by the operator, re-read live on
 *      every call and therefore never stored or carried anywhere.
 *   2. A window ESTABLISHED FOR THIS SESSION — read from this session's own health-store
 *      record, `<sessionId>.json`, and from nothing else. The store is never enumerated.
 *
 * WHY THERE IS NO CROSS-SESSION RULE ANY MORE (WO-OR-09, closing Codex TQA-001).
 *
 * Every earlier version of rule 2 enumerated the whole store and tied stored samples to
 * the live session BY MODEL ID. WO-OR-08 added two guards to make that match wrong less
 * often: refusing matched observations that disagreed on the size, and refusing a bare id
 * while a variant-suffixed sibling of it existed. An independent review then proved the
 * obvious thing about a heuristic — it only fires when the disproving entry HAPPENS to be
 * in the store. With one bare-id observation present and no sibling, a 1M session still
 * borrowed a 200k window and still rendered a confident five-times-wrong percentage. On a
 * fresh machine, or simply before the variant session had ever been observed, the repair
 * bought nothing at all.
 *
 * The principle the guards were missing: AGREEMENT BETWEEN OBSERVATIONS ESTABLISHES STORE
 * CONSISTENCY, NOT LIVE-SESSION IDENTITY. Nothing links a transcript sample to another
 * session's statusLine observation, so every cross-session inference — by matching, by
 * agreement, by recency, by variant analysis — is a guess about which session a stored
 * sample belonged to. The repair is therefore not a third guard. It is to stop guessing:
 * the session id is the one thing that genuinely links the two halves of this telemetry,
 * so it is the only thing rule 2 uses. `modelId` is not a parameter of this function any
 * more, and a model -> window lookup table remains forbidden outright.
 *
 * WHAT THIS SESSION'S RECORD MAY BE, and why it takes two cases rather than one. The
 * store holds ONE FILE PER SESSION and every write REPLACES it, so the turn-end
 * transcript write clobbers the statusLine sample that observed the window. After that
 * the observation survives only as the `context_window_size` / `context_window_source`
 * the transcript sample carried forward. Accepting only a direct observation would send a
 * terminal session BLIND after its first turn and flicker it back on the next statusLine
 * render, so both are accepted:
 *
 *   - a `statusLine` sample -> this session's own direct observation of its window;
 *   - a `transcript` sample recording `WINDOW_SOURCE_OBSERVED` -> that same observation,
 *     carried forward across the overwrite.
 *
 * An `env:`-sourced value is deliberately NOT carried forward. Rule 1 re-reads the
 * variable on every call, so carrying it buys nothing — and it would keep an operator's
 * declaration rendering after the operator had withdrawn it, which is the same false
 * authority this whole rule exists to remove, wearing a different costume.
 *
 * GUARDS. Of WO-OR-08's three, (a) DISAGREEMENT and (b) VARIANT AMBIGUITY are DELETED
 * ALONG WITH THE RULE THEY SERVED, and `variantBaseOf` went with them: one session has
 * exactly one record, so there is nothing for observations to disagree about and no
 * sibling to be ambiguous with. Retaining them as belt-and-braces would leave heuristics
 * standing guard over a rule that no longer exists. Two survive, and neither is an
 * inference about provenance:
 *
 *   (c) SELF-CONTRADICTION. A window smaller than the numerator it is about to divide is
 *       disproven by that numerator. Arithmetic, not inference — and the only guard that
 *       also binds rule 1, because an operator can typo an explicit value too.
 *   (d) IDENTITY. The record's own `session_id` must equal the one asked for. The file is
 *       keyed by session id so this is normally tautological; it costs one comparison,
 *       and it is the exact invariant the whole function now rests on, so it is asserted
 *       rather than assumed.
 *
 * KNOWN RESIDUAL, stated rather than guarded (WO-OR-09, Larry concurring). A mid-session
 * model change can alter the window, leaving this session's own earlier observation
 * stale. No model-compatibility check is applied here, for two reasons: the statusLine and
 * transcript id namespaces differ, so such a check would fire on exactly the large-context
 * sessions it was meant to protect; and rule 2 can only ever have data on a terminal,
 * where statusLine re-renders continuously and corrects the record within moments.
 *
 * `usedTokens` is optional and is used only by guard (c). Passing nothing disables that
 * guard alone. Returns the provenance beside the number so nothing downstream has to guess
 * where a denominator came from. Never throws.
 */
export function resolveWindowTokens({
  sessionId = null,
  usedTokens = null,
  env = process.env,
  storeOpts = {},
  readSample = readHealthSample,
} = {}) {
  // Guard (c), stated once and applied to whichever rule produces a candidate.
  const numerator =
    typeof usedTokens === 'number' && Number.isFinite(usedTokens) && usedTokens >= 0
      ? usedTokens
      : null;
  const coherent = (size) => numerator === null || numerator <= size;

  // 1 — the explicit operator statement.
  const declared = Number(env?.CLAUDE_CONTEXT_WINDOW);
  if (Number.isFinite(declared) && declared > 0) {
    return coherent(declared) ? { tokens: declared, source: WINDOW_SOURCE_ENV } : NO_WINDOW;
  }

  // 2 — this session's own record, and no other. No session id, no rule 2: there is
  // nothing to establish identity against, and an unidentified sample is precisely the
  // cross-session guess this function no longer makes.
  if (typeof sessionId !== 'string' || sessionId.length === 0) return NO_WINDOW;

  try {
    const read = readSample(sessionId, storeOpts);
    if (!read || read.ok !== true || !read.data) return NO_WINDOW;
    const data = read.data;

    // (d) identity.
    if (data.session_id !== sessionId) return NO_WINDOW;

    const directlyObserved = data.source === SOURCE_STATUSLINE;
    const carriedForward =
      data.source === SOURCE_TRANSCRIPT &&
      data.context_window?.context_window_source === WINDOW_SOURCE_OBSERVED;
    if (!directlyObserved && !carriedForward) return NO_WINDOW;

    const size = data.context_window?.context_window_size;
    if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) return NO_WINDOW;

    if (!coherent(size)) return NO_WINDOW; // (c)
    return { tokens: size, source: WINDOW_SOURCE_OBSERVED };
  } catch {
    // A store we cannot read yields no denominator. That is the safe side: the footer
    // renders a bare token count rather than a percentage over a guessed window.
  }
  return NO_WINDOW;
}

/**
 * extractTranscriptSample({ transcriptPath, sessionId, ... }) -> sample|null
 *
 * Pure-ish and never throws. Returns null when there is nothing safe to write —
 * no session to key on, or no usable usage block.
 */
export function extractTranscriptSample({
  transcriptPath = null,
  sessionId = null,
  sampledAt = null,
  env = process.env,
  storeOpts = {},
  readTail = readTranscriptTail,
  windowResolver = resolveWindowTokens,
} = {}) {
  const found = newestAssistantUsage(readTail(transcriptPath));
  if (!found) return null;

  const usedTokens = sumUsedTokens(found.usage);
  if (usedTokens === null) return null;

  // The payload's session id wins over the transcript's: the payload is the runtime
  // telling us which session this hook fired for, while the transcript line is a record
  // of a message that may predate a resume.
  const sid = (typeof sessionId === 'string' && sessionId.length ? sessionId : found.sessionId) || null;
  if (!sid) return null;

  // RESOLVED AFTER `sid` IS KNOWN, AND THAT ORDERING IS NOW LOAD-BEARING (WO-OR-09). The
  // session id is the denominator's only route to this session's own record, so a
  // resolver called before `sid` exists could not use rule 2 at all.
  //
  // The numerator is passed too, so guard (c) can refuse a denominator that this very
  // sample already disproves. Resolving the window in ignorance of the count it is about
  // to divide was how a window smaller than its own numerator survived.
  const window = windowResolver({ sessionId: sid, usedTokens, env, storeOpts });

  return {
    schema_version: SAMPLE_SCHEMA_VERSION,
    sampled_at: sampledAt,
    session_id: sid,
    source: SOURCE_TRANSCRIPT,
    version: null,
    model: { id: found.modelId, display_name: null },
    effort: { level: found.effort },
    context_window: {
      // No `used_percentage` key is invented here. The footer derives it when — and only
      // when — a denominator is present.
      used_percentage: null,
      remaining_percentage: null,
      context_window_size: window.tokens,
      context_window_source: window.source,
      used_tokens: usedTokens,
      total_input_tokens: null,
      total_output_tokens: null,
      exceeds_200k_tokens: null,
    },
    rate_limits: {
      five_hour: { used_percentage: null, resets_at: null },
      seven_day: { used_percentage: null, resets_at: null },
    },
    workspace: { git_worktree: null },
    worktree: { name: null, path: null, branch: null },
    pr: { number: null, url: null, review_state: null },
  };
}

/**
 * sampleFromTranscript(raw, opts) -> { written, ... }
 *
 * The one impure step. `raw` is the Stop hook's stdin JSON. Same contract as
 * `sampleFromStdin`: never throws, and a failure to write is reported rather than raised.
 * A Stop hook that crashed would end Warwick's turn with an error.
 */
export function sampleFromTranscript(raw, {
  sampledAt = null,
  writer = writeHealthSample,
  storeOpts = {},
  env = process.env,
  readTail = readTranscriptTail,
  windowResolver = resolveWindowTokens,
} = {}) {
  const payload = parseStdinPayload(raw);
  if (!payload) return { written: false, reason: 'unreadable-payload' };

  const transcriptPath = payload.transcript_path ?? payload.transcriptPath ?? null;
  if (typeof transcriptPath !== 'string' || transcriptPath.length === 0) {
    return { written: false, reason: 'no-transcript-path' };
  }

  const sample = extractTranscriptSample({
    transcriptPath,
    sessionId: payload.session_id ?? payload.sessionId ?? null,
    sampledAt,
    env,
    storeOpts,
    readTail,
    windowResolver,
  });
  if (!sample) return { written: false, reason: 'no-usable-usage' };

  try {
    const path = writer(sample.session_id, sample, storeOpts);
    return { written: true, path, sample };
  } catch (err) {
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
