// Proofline — test harness.
//
// TWO JOBS IN ONE FILE, on purpose:
//
//   1. Shared utilities the test files import (temp dirs, HTTP, polling,
//      journal reading, child spawn/kill).
//   2. The CHILD ENTRYPOINT for the crash tests. When
//      `PROOFLINE_CHILD_MODE` is set in the environment, importing this file
//      boots a real Proofline process; otherwise importing it does nothing.
//
// Why one file: on Node v22.18.0 `node --test` discovers and EXECUTES every
// `.js`/`.mjs` under `test/**`, not just `*.test.js` (measured — see the
// findings in the handback). Every extra helper file therefore shows up in the
// `# tests` total as a passing entry that ran no assertions. Keeping the count
// honest means keeping helper files to exactly one.
//
// The child is a real Proofline process: real store, real worker, real
// recovery, real HTTP server. Only the named seam for a given mode is swapped,
// and each swap is paired with a control run using the production value.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

export const HARNESS_PATH = fileURLToPath(import.meta.url);
export const SERVICE_DIR = path.resolve(path.dirname(HARNESS_PATH), '..', '..');
export const EXIT_MARKER = 'exit-marker.txt';

// ---------------------------------------------------------------------------
// Shared utilities
// ---------------------------------------------------------------------------

export function mkTempDir(label = 'proofline') {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${label}-`));
}

export function rmTempDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* best effort — a killed child can still hold a handle on win32 */
  }
}

export function journalPathIn(dataDir) {
  return path.join(dataDir, 'journal.jsonl');
}

/** Read the journal as records. Throws if a line is not parseable. */
export function readJournal(dataDir) {
  const p = journalPathIn(dataDir);
  if (!fs.existsSync(p)) return [];
  const text = fs.readFileSync(p, 'utf8');
  const parts = text.split('\n');
  const last = parts.pop();
  const records = parts.map((line, i) => {
    try {
      return JSON.parse(line);
    } catch (err) {
      throw new Error(`journal line ${i + 1} unparseable: ${err.message}`);
    }
  });
  records.tornTail = last === '' ? null : last;
  return records;
}

export function countRecords(records, type, key) {
  return records.filter((r) => r.t === type && (key === undefined || r.key === key)).length;
}

export async function httpJson(url, { method = 'GET', body } = {}) {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text === '' ? null : JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

/** POST a raw string body (used for the byte-limit tests). */
export async function httpRaw(url, rawBody) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: rawBody,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON error body is fine */
  }
  return { status: res.status, json, text };
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Poll `fn` until it returns truthy, or throw after `timeoutMs`. */
export async function waitFor(fn, { timeoutMs = 5000, intervalMs = 20, what = 'condition' } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last;
  for (;;) {
    last = await fn();
    if (last) return last;
    if (Date.now() > deadline) throw new Error(`waitFor timed out after ${timeoutMs}ms waiting for ${what}`);
    await sleep(intervalMs);
  }
}

/** Assert a condition STAYS false for `ms`. Used by T-6a (stuck forever). */
export async function staysFalse(fn, { ms = 1500, intervalMs = 50 } = {}) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await fn()) return false;
    await sleep(intervalMs);
  }
  return true;
}

/**
 * Boot a real Proofline app IN THIS PROCESS on an ephemeral port.
 * Every override is a named seam on the production wiring; nothing is stubbed
 * that the test does not name.
 */
export async function startApp({ dataDir, ...overrides } = {}) {
  const { createApp } = await import('../../src/app.mjs');
  const app = await createApp({
    journalPath: journalPathIn(dataDir),
    publicDir: path.join(SERVICE_DIR, 'public'),
    host: '127.0.0.1',
    port: 0,
    scanIntervalMs: 100,
    log: () => {},
    ...overrides,
  });
  const info = await app.listen();
  return { app, store: app.store, worker: app.worker, url: info.url.replace(/\/$/, ''), info };
}

// ---------------------------------------------------------------------------
// Child process control
// ---------------------------------------------------------------------------

/**
 * Spawn a real Proofline child process.
 *
 * @param {object} opts
 * @param {string} opts.dataDir       journal location (a temp dir)
 * @param {string} opts.mode          child mode, see CHILD MODES below
 * @returns {Promise<object>} handle with `url`, `pid`, `kill()`, `stopGracefully()`, `exitInfo`
 */
const liveChildren = new Set();

/**
 * Kill every child this process spawned. Call it from an `after()` hook.
 *
 * Without this, an assertion that throws before its own `kill()` leaves a child
 * holding the stdio pipes open, and the test runner's process never exits — the
 * suite hangs instead of failing. A crash-test harness that can hang is worse
 * than one that fails.
 */
export function killAllChildren() {
  for (const child of liveChildren) {
    try {
      if (child.exitCode === null && child.signalCode === null) process.kill(child.pid, 'SIGKILL');
    } catch {
      /* already gone */
    }
  }
  liveChildren.clear();
}

export async function spawnChild({ dataDir, mode = 'normal', scanIntervalMs = 200, extraEnv = {} } = {}) {
  const child = spawn(
    process.execPath,
    [HARNESS_PATH],
    {
      cwd: SERVICE_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PROOFLINE_CHILD_MODE: mode,
        PROOFLINE_DATA_DIR: dataDir,
        PROOFLINE_PORT: '0',
        PROOFLINE_SCAN_INTERVAL_MS: String(scanIntervalMs),
        ...extraEnv,
      },
    },
  );

  liveChildren.add(child);

  const stdoutLines = [];
  const stderrChunks = [];
  let buffer = '';
  const exitInfo = { code: null, signal: null, exited: false };

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      if (line.trim() !== '') stdoutLines.push(line);
    }
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => stderrChunks.push(chunk));

  const exited = new Promise((resolve) => {
    child.on('exit', (code, signal) => {
      exitInfo.code = code;
      exitInfo.signal = signal;
      exitInfo.exited = true;
      liveChildren.delete(child);
      resolve(exitInfo);
    });
  });

  const ready = await waitFor(
    () => {
      for (const line of stdoutLines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.event === 'child.ready') return parsed;
        } catch {
          /* not a JSON line */
        }
      }
      if (exitInfo.exited) {
        throw new Error(`child exited before ready: code=${exitInfo.code} signal=${exitInfo.signal}\n${stderrChunks.join('')}`);
      }
      return null;
    },
    { timeoutMs: 15000, what: `child.ready (mode=${mode})` },
  );

  return {
    child,
    pid: child.pid,
    // The listen URL ends with '/'; leaving it on would make every caller build
    // `http://host:port//api/jobs`, whose pathname is `//api/jobs` and matches
    // no route. That produced a 404 that looked like a service defect.
    url: ready.url.replace(/\/$/, ''),
    mode,
    exitInfo,
    stdoutLines,
    stderr: () => stderrChunks.join(''),

    /**
     * Abrupt kill. On win32 this is `TerminateProcess`; NO exit, beforeExit or
     * signal handler runs. Map F-1a: the killed child reports code=1,
     * signal=null on this platform — NOT signal==='SIGKILL' and not 137.
     */
    async kill() {
      process.kill(child.pid, 'SIGKILL');
      return exited;
    },

    /** Graceful control for T-3a: the child exits via process.exit(0). */
    async stopGracefully() {
      child.stdin.write('exit\n');
      return exited;
    },

    exited: () => exited,
  };
}

// ---------------------------------------------------------------------------
// CHILD ENTRYPOINT
// ---------------------------------------------------------------------------
//
// CHILD MODES
//   normal        production everything
//   hang          analysis never resolves — makes a job durably `processing`
//                 so the kill lands mid-flight DETERMINISTICALLY rather than
//                 racing a 2.5 ms window (map C-4 measured that window)
//   stream        production analysis, NON-DURABLE writer (plain
//                 createWriteStream — flush timing not controlled)
//   stream-corked production analysis, NON-DURABLE writer, corked so the bytes
//                 are deterministically still in userspace at kill time
//   hang-stream        `hang` + `stream`
//   hang-stream-corked `hang` + `stream-corked`
//   orphan-false  production everything EXCEPT isOrphaned === () => false
//
// Every mutant mode is used only alongside a `normal` control run.

function createStreamWriter(journalPath, { cork } = { cork: false }) {
  const stream = fs.createWriteStream(journalPath, { flags: 'a' });
  if (cork) stream.cork();
  return {
    kind: cork ? 'stream-corked-nondurable' : 'stream-nondurable',
    append(line) {
      // Returns immediately. The bytes are in USERSPACE, not the kernel.
      stream.write(line);
    },
    close() {
      if (cork) stream.uncork();
      stream.end();
    },
  };
}

function neverResolves() {
  return new Promise(() => {});
}

async function runChild(mode) {
  const { loadConfig } = await import('../../src/config.mjs');
  const { createApp } = await import('../../src/app.mjs');

  const config = loadConfig();

  const opts = { ...config, log: () => {} };

  if (mode.includes('hang')) opts.analyzeFn = () => neverResolves();
  if (mode.includes('stream-corked')) opts.writerFactory = (p) => createStreamWriter(p, { cork: true });
  else if (mode.includes('stream')) opts.writerFactory = (p) => createStreamWriter(p, { cork: false });
  if (mode === 'orphan-false') opts.isOrphanedFn = () => false;

  // T-3a control: an exit handler that writes a marker. After an abrupt kill
  // this file MUST be absent; after a graceful exit it MUST be present. That
  // is what makes "the kill is a crash, not a stop" an assertion rather than
  // an assumption.
  const markerPath = path.join(config.dataDir, EXIT_MARKER);
  process.on('exit', () => {
    try {
      fs.writeFileSync(markerPath, `exit handler ran at ${new Date().toISOString()}\n`);
    } catch {
      /* nothing useful to do inside an exit handler */
    }
  });

  const app = await createApp(opts);
  const { url, address, port } = await app.listen();

  process.stdout.write(`${JSON.stringify({ event: 'child.ready', mode, url, address, port, pid: process.pid, epoch: app.store.epoch })}\n`);

  // Graceful-stop channel. Deliberately NOT a signal: map F-1b established
  // there is no signal-delivered graceful shutdown path on win32, so a signal
  // could not be the control for T-3a.
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    if (chunk.includes('exit')) process.exit(0);
  });
}

if (process.env.PROOFLINE_CHILD_MODE) {
  await runChild(process.env.PROOFLINE_CHILD_MODE);
}
