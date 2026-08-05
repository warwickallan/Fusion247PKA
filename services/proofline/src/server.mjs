// Proofline — the HTTP surface (map §5.5).
//
// Loopback only, no auth (single local user, no credentials anywhere in the
// service). Static files are served from an ALLOWLIST of known filenames — a
// request path is never joined to a directory, so there is no traversal
// surface (map §7).
//
// Ordering that matters (G-3): on submit, the journal append (which does not
// return until fsync has returned) happens, THEN the response is written, THEN
// the worker is nudged. The lease is a separate fsynced record, so the journal
// itself shows the response was emitted before `job.started`.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

import { sha256Utf8, utf8ByteLength } from './canonical.mjs';
import { HOST, TEXT_LIMIT_BYTES, BODY_LIMIT_BYTES } from './config.mjs';

/** Map §5.7. Keys are NEVER used to construct a filesystem path. */
export const KEY_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

const STATIC_FILES = new Map([
  ['/', { file: 'index.html', type: 'text/html; charset=utf-8' }],
  ['/index.html', { file: 'index.html', type: 'text/html; charset=utf-8' }],
  ['/app.js', { file: 'app.js', type: 'text/javascript; charset=utf-8' }],
  ['/styles.css', { file: 'styles.css', type: 'text/css; charset=utf-8' }],
]);

export function toSummary(job) {
  return {
    key: job.key,
    state: job.state,
    textSha256: job.textSha256,
    textLength: job.textLength,
    submittedAt: job.submittedAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    decidedAt: job.decidedAt,
    attempts: job.attempts,
    resultSha256: job.resultSha256,
  };
}

export function toJob(job) {
  return {
    ...toSummary(job),
    epoch: job.epoch,
    text: job.text,
    result: job.result,
    decision: job.decision,
    note: job.note,
    failedReason: job.failedReason,
    timeline: job.timeline,
  };
}

export function createHttpServer({
  store,
  worker,
  publicDir,
  textLimitBytes = TEXT_LIMIT_BYTES,
  bodyLimitBytes = BODY_LIMIT_BYTES,
  trace = () => {},
  log = () => {},
} = {}) {
  if (!store) throw new TypeError('createHttpServer: store is required');
  if (!worker) throw new TypeError('createHttpServer: worker is required');

  const startedAtMs = Date.now();

  function send(res, status, payload, headers = {}) {
    const body = Buffer.from(JSON.stringify(payload), 'utf8');
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'content-length': String(body.length),
      'cache-control': 'no-store',
      ...headers,
    });
    // Trace point for T-3d: this fires immediately before the response bytes
    // are written, so the fs façade's `fsyncSync` return must precede it.
    trace('http.response', { status });
    res.end(body);
  }

  function sendError(res, status, error, detail) {
    send(res, status, detail === undefined ? { error } : { error, detail });
  }

  function readJsonBody(req, res) {
    return new Promise((resolve) => {
      const chunks = [];
      let size = 0;
      let settled = false;

      req.on('data', (chunk) => {
        if (settled) return;
        // Counted AS BYTES ARRIVE, not after buffering (map §5.5).
        size += chunk.length;
        if (size > bodyLimitBytes) {
          settled = true;
          sendError(res, 413, 'request body too large', `body exceeds ${bodyLimitBytes} bytes`);
          req.destroy();
          resolve(null);
          return;
        }
        chunks.push(chunk);
      });

      req.on('aborted', () => {
        if (settled) return;
        settled = true;
        resolve(null);
      });

      req.on('end', () => {
        if (settled) return;
        settled = true;
        const raw = Buffer.concat(chunks).toString('utf8');
        if (raw === '') {
          resolve({});
          return;
        }
        try {
          const parsed = JSON.parse(raw);
          if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
            sendError(res, 400, 'body must be a JSON object');
            resolve(null);
            return;
          }
          resolve(parsed);
        } catch (err) {
          sendError(res, 400, 'body is not valid JSON', err.message);
          resolve(null);
        }
      });
    });
  }

  function serveStatic(res, entry) {
    const filePath = path.join(publicDir, entry.file);
    let body;
    try {
      body = fs.readFileSync(filePath);
    } catch (err) {
      log({ level: 'error', event: 'static.read_error', file: entry.file, message: err.message });
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('static asset unavailable');
      return;
    }
    res.writeHead(200, {
      'content-type': entry.type,
      'content-length': String(body.length),
      'cache-control': 'no-store',
    });
    res.end(body);
  }

  async function handleSubmit(req, res) {
    const body = await readJsonBody(req, res);
    if (body === null) return;

    const { key, text } = body;

    if (typeof key !== 'string' || !KEY_PATTERN.test(key)) {
      sendError(res, 400, 'invalid key', 'key must match [A-Za-z0-9._:-] and be 1..128 characters');
      return;
    }
    if (typeof text !== 'string') {
      sendError(res, 400, 'invalid text', 'text must be a string');
      return;
    }
    if (utf8ByteLength(text) > textLimitBytes) {
      sendError(res, 413, 'text too large', `text exceeds ${textLimitBytes} bytes`);
      return;
    }

    // --- synchronous critical section: check then append, no await between
    // them (map D-5). This is what makes G-9 real on a single-threaded loop.
    const existing = store.getJob(key);
    if (existing) {
      const textMatches = existing.textSha256 === sha256Utf8(text);
      // G-9 holds — but a silent no-op would be a data-loss surface, so the
      // caller is told whether the text it just sent was the stored one.
      send(res, 200, { job: toJob(existing), duplicate: true, textMatches });
      return;
    }
    const job = store.createJob({ key, text });
    // --- end critical section

    send(res, 201, { job: toJob(job) });
    // Nudged only AFTER the response is written — the worker never runs on the
    // request's path to the client.
    worker.nudge();
  }

  async function handleDecision(req, res, key, decision) {
    const body = await readJsonBody(req, res);
    if (body === null) return;

    const job = store.getJob(key);
    if (!job) {
      sendError(res, 404, 'no such job', key);
      return;
    }
    if (job.state !== 'awaiting_approval') {
      // G-6: `awaiting_approval` never self-advances, and nothing may advance
      // a job that has not reached it.
      sendError(res, 409, 'job is not awaiting approval', `state is ${job.state}`);
      return;
    }
    const note = typeof body.note === 'string' ? body.note : null;
    const updated = store.decide(key, decision, note);
    send(res, 200, { job: toJob(updated) });
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const pathname = url.pathname;

    const handle = async () => {
      if (req.method === 'GET' || req.method === 'HEAD') {
        const asset = STATIC_FILES.get(pathname);
        if (asset) return serveStatic(res, asset);

        if (pathname === '/api/health') {
          return send(res, 200, {
            ok: true,
            epoch: store.epoch,
            uptimeMs: Date.now() - startedAtMs,
            counts: store.counts(),
          });
        }
        if (pathname === '/api/jobs') {
          return send(res, 200, { jobs: store.listJobs().map(toSummary) });
        }
        const detail = /^\/api\/jobs\/([^/]+)$/.exec(pathname);
        if (detail) {
          const key = decodeURIComponent(detail[1]);
          const job = store.getJob(key);
          if (!job) return sendError(res, 404, 'no such job', key);
          return send(res, 200, { job: toJob(job) });
        }
        return sendError(res, 404, 'not found', pathname);
      }

      if (req.method === 'POST') {
        if (pathname === '/api/jobs') return handleSubmit(req, res);

        const approve = /^\/api\/jobs\/([^/]+)\/approve$/.exec(pathname);
        if (approve) return handleDecision(req, res, decodeURIComponent(approve[1]), 'approved');

        const reject = /^\/api\/jobs\/([^/]+)\/reject$/.exec(pathname);
        if (reject) return handleDecision(req, res, decodeURIComponent(reject[1]), 'rejected');

        return sendError(res, 404, 'not found', pathname);
      }

      return sendError(res, 405, 'method not allowed', req.method);
    };

    handle().catch((err) => {
      log({ level: 'error', event: 'http.unhandled', message: err.message, stack: err.stack });
      if (!res.headersSent) sendError(res, 500, 'internal error');
      else res.end();
    });
  });

  return { server, host: HOST };
}
