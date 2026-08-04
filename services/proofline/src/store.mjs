// Proofline — the durable store.
//
// An append-only JSONL journal. Every append is `writeSync` followed by
// `fsyncSync`, and the call that appends does not return until fsync has
// returned. Persistence is a PRECONDITION of an acknowledgement, not a
// consequence of one (map D-4).
//
// The in-memory index is rebuilt by REPLAY. There is no second source of truth
// on disk, so "what the journal says" and "what the service believes" cannot
// drift.
//
// WHAT IS AND IS NOT CLAIMED (map F-2, permanent):
//   Claimed:     `fsyncSync` returned before the acknowledgement was written.
//   NOT claimed: survival of power loss. fsync returning is not a statement
//                about the platter. Nobody may upgrade this later.

import fs from 'node:fs';
import path from 'node:path';

import { sha256Utf8, utf8ByteLength } from './canonical.mjs';

/** Thrown when the journal is corrupt mid-file. Never swallowed. */
export class JournalCorruptError extends Error {
  constructor(message) {
    super(message);
    this.name = 'JournalCorruptError';
  }
}

export const RECORD_TYPES = new Set([
  'epoch.started',
  'job.created',
  'job.started',
  'job.completed',
  'job.failed',
  'job.requeued',
  'job.decided',
]);

export const JOB_STATES = new Set([
  'queued',
  'processing',
  'awaiting_approval',
  'approved',
  'rejected',
  'failed',
]);

/**
 * The durable writer: append + fsync, synchronously, on a file descriptor held
 * open in append mode.
 *
 * `fsImpl` is injectable so a test can record the exact call sequence and prove
 * `fsyncSync` RETURNED before the HTTP response was written (T-3d). The whole
 * writer is injectable so a test can replace it with a non-durable one and
 * prove the record is then LOST (T-3c).
 */
export function createDurableWriter(journalPath, fsImpl = fs) {
  const fd = fsImpl.openSync(journalPath, 'a');
  return {
    kind: 'durable',
    append(line) {
      fsImpl.writeSync(fd, line);
      fsImpl.fsyncSync(fd);
    },
    close() {
      try {
        fsImpl.closeSync(fd);
      } catch {
        /* already closed */
      }
    },
  };
}

/**
 * Replay raw journal bytes into records.
 *
 * Map §5.6, and the two halves are deliberately asymmetric:
 *   - a TRAILING partial line (torn by an abrupt kill) is discarded and
 *     reported. A single `writeSync` append is not guaranteed atomic.
 *   - a MID-FILE corrupt line is data loss and FAILS LOUD. It is never
 *     silently skipped, because silently skipping it would turn a corrupt
 *     journal into a plausible-looking one.
 */
export function replayJournal(bytes) {
  const text = bytes.toString('utf8');
  const records = [];
  let tornTail = null;

  if (text.length > 0) {
    const parts = text.split('\n');
    const last = parts.pop(); // '' when the file ends with a newline
    if (last !== '') tornTail = last;

    for (let i = 0; i < parts.length; i++) {
      const lineNo = i + 1;
      const line = parts[i];
      if (line === '') {
        throw new JournalCorruptError(`journal line ${lineNo}: empty line mid-file`);
      }
      let rec;
      try {
        rec = JSON.parse(line);
      } catch (err) {
        throw new JournalCorruptError(`journal line ${lineNo}: not valid JSON (${err.message})`);
      }
      if (rec === null || typeof rec !== 'object' || Array.isArray(rec)) {
        throw new JournalCorruptError(`journal line ${lineNo}: not a record object`);
      }
      if (!RECORD_TYPES.has(rec.t)) {
        throw new JournalCorruptError(`journal line ${lineNo}: unknown record type ${JSON.stringify(rec.t)}`);
      }
      records.push(rec);
    }
  }

  return { records, tornTail };
}

function emptyJob(rec) {
  return {
    key: rec.key,
    state: 'queued',
    text: rec.text,
    textSha256: rec.textSha256,
    textLength: rec.textLength,
    submittedAt: rec.at,
    startedAt: null,
    completedAt: null,
    decidedAt: null,
    attempts: 0,
    epoch: null,
    result: null,
    resultSha256: null,
    decision: null,
    note: null,
    failedReason: null,
    timeline: [],
  };
}

/**
 * Apply one journal record to the in-memory state.
 *
 * This is the ONLY place a job's state changes. The HTTP layer and the worker
 * both go through `append`, so every observable transition has a durable
 * record behind it — which is what makes the UI's state timeline (G-5) a
 * reading of the journal rather than a story told over it.
 */
function applyRecord(state, rec) {
  if (rec.t === 'epoch.started') {
    state.epoch = rec.epoch;
    if (rec.epoch > state.maxEpoch) state.maxEpoch = rec.epoch;
    return;
  }

  if (rec.t === 'job.created') {
    // A second `job.created` for one key would mean G-9 had been broken. It is
    // an invariant violation, not a state to tolerate.
    if (state.jobs.has(rec.key)) {
      throw new JournalCorruptError(`duplicate job.created for key ${JSON.stringify(rec.key)}`);
    }
    const job = emptyJob(rec);
    job.timeline.push({ t: rec.t, at: rec.at, state: 'queued' });
    state.jobs.set(rec.key, job);
    return;
  }

  const job = state.jobs.get(rec.key);
  if (!job) {
    throw new JournalCorruptError(`record ${rec.t} for unknown key ${JSON.stringify(rec.key)}`);
  }

  switch (rec.t) {
    case 'job.started':
      job.state = 'processing';
      job.attempts = rec.attempts;
      job.epoch = rec.epoch;
      job.startedAt = rec.at;
      job.timeline.push({ t: rec.t, at: rec.at, state: 'processing', attempts: rec.attempts, epoch: rec.epoch });
      break;

    case 'job.completed':
      job.state = 'awaiting_approval';
      job.result = rec.result;
      job.resultSha256 = rec.resultSha256;
      job.completedAt = rec.at;
      job.timeline.push({ t: rec.t, at: rec.at, state: 'awaiting_approval', resultSha256: rec.resultSha256 });
      break;

    case 'job.requeued':
      job.state = 'queued';
      job.timeline.push({ t: rec.t, at: rec.at, state: 'queued', reason: rec.reason });
      break;

    case 'job.failed':
      job.state = 'failed';
      job.failedReason = rec.reason;
      job.timeline.push({ t: rec.t, at: rec.at, state: 'failed', reason: rec.reason });
      break;

    case 'job.decided':
      if (rec.decision !== 'approved' && rec.decision !== 'rejected') {
        throw new JournalCorruptError(`job.decided: illegal decision ${JSON.stringify(rec.decision)}`);
      }
      job.state = rec.decision;
      job.decision = rec.decision;
      job.note = rec.note ?? null;
      job.decidedAt = rec.at;
      job.timeline.push({ t: rec.t, at: rec.at, state: rec.decision, note: rec.note ?? null });
      break;

    default:
      throw new JournalCorruptError(`unhandled record type ${JSON.stringify(rec.t)}`);
  }
}

/**
 * Create the store: replay the journal, allocate the next epoch, and FSYNC that
 * epoch record before returning — so no job can be leased under an epoch that
 * is not already durable (map D-6a).
 */
export function createStore({
  journalPath,
  writerFactory = createDurableWriter,
  fsImpl = fs,
  now = () => new Date().toISOString(),
  log = () => {},
} = {}) {
  if (!journalPath) throw new TypeError('createStore: journalPath is required');

  fs.mkdirSync(path.dirname(journalPath), { recursive: true });

  const state = { epoch: 0, maxEpoch: 0, jobs: new Map() };

  let bytes = Buffer.alloc(0);
  if (fs.existsSync(journalPath)) bytes = fs.readFileSync(journalPath);

  const { records, tornTail } = replayJournal(bytes);
  if (tornTail !== null) {
    log({
      level: 'warn',
      event: 'journal.torn_tail_discarded',
      bytes: Buffer.byteLength(tornTail, 'utf8'),
      note: 'trailing partial line discarded — expected after an abrupt kill',
    });
    // Truncate the torn tail so the next append starts on a clean line
    // boundary. Without this the tear would be embedded MID-FILE by the next
    // append, and replay would then correctly refuse to start at all.
    fs.truncateSync(journalPath, bytes.length - Buffer.byteLength(tornTail, 'utf8'));
  }

  for (const rec of records) applyRecord(state, rec);

  const writer = writerFactory(journalPath, fsImpl);

  function append(rec) {
    const line = `${JSON.stringify(rec)}\n`;
    writer.append(line);
    applyRecord(state, rec);
    return rec;
  }

  // Allocate this process's epoch and make it durable BEFORE anything can be
  // leased. `append` does not return until fsync has returned.
  const epoch = state.maxEpoch + 1;
  append({ t: 'epoch.started', epoch, at: now() });

  return {
    journalPath,
    writerKind: writer.kind,

    get epoch() {
      return state.epoch;
    },

    append,

    getJob(key) {
      return state.jobs.get(key) ?? null;
    },

    listJobs() {
      return [...state.jobs.values()];
    },

    queuedKeys() {
      const out = [];
      for (const job of state.jobs.values()) if (job.state === 'queued') out.push(job.key);
      return out;
    },

    counts() {
      const c = { queued: 0, processing: 0, awaiting_approval: 0, approved: 0, rejected: 0, failed: 0, total: 0 };
      for (const job of state.jobs.values()) {
        if (job.state in c) c[job.state]++;
        c.total++;
      }
      return c;
    },

    /**
     * Idempotent create. The caller checks `getJob(key)` and calls this with NO
     * `await` in between (map D-5) — Node's event loop is single-threaded, so a
     * synchronous check-and-append is a real guarantee here.
     */
    createJob({ key, text }) {
      append({
        t: 'job.created',
        key,
        text,
        textSha256: sha256Utf8(text),
        textLength: utf8ByteLength(text),
        at: now(),
      });
      return state.jobs.get(key);
    },

    /** queued → processing. `attempts` increments AT LEASE TIME (map §5.3). */
    lease(key) {
      const job = state.jobs.get(key);
      if (!job) throw new Error(`lease: unknown key ${key}`);
      append({ t: 'job.started', key, attempts: job.attempts + 1, epoch: state.epoch, at: now() });
      return state.jobs.get(key);
    },

    complete(key, result, resultSha256) {
      append({ t: 'job.completed', key, result, resultSha256, at: now() });
      return state.jobs.get(key);
    },

    requeue(key, reason) {
      append({ t: 'job.requeued', key, reason, at: now() });
      return state.jobs.get(key);
    },

    fail(key, reason) {
      append({ t: 'job.failed', key, reason, at: now() });
      return state.jobs.get(key);
    },

    decide(key, decision, note) {
      append({ t: 'job.decided', key, decision, note: note ?? null, at: now() });
      return state.jobs.get(key);
    },

    readBytes() {
      return fs.readFileSync(journalPath);
    },

    close() {
      writer.close();
    },
  };
}
