// Governed sandboxed Markdown writer (fixtures).
//
// Source of truth: supabase-operational-foundation-boundary.md §3 (worker
// performs the governed write, does not invent structure) and
// wp0-security-gate.md §3 (scoped write path, no traversal).
//
// FIXTURES ONLY (WP0): writes into a SANDBOX inbox dir, NOT the canonical Brain.
// The real governed write into PKM is Silas/PKM territory and follows PKM
// governance — this fixture only proves the seam: deterministic path, idempotent
// write, evidence pointer with a content hash.
//
// IDEMPOTENT: the write target is a deterministic path derived from capture_id.
// If the target already exists, the writer does NOT rewrite/duplicate — it
// detects the existing note and returns the existing destination + evidence.
// This is what makes worker recovery safe end-to-end.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Confine the write to a single approved filename charset — no path traversal
// ('../'), no arbitrary filename injection from untrusted content.
function safeSegment(id) {
  return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
}

// The "git-sha placeholder": a git blob object id (sha1 of "blob <len>\0<bytes>").
// Deterministic per content; stands in for the real commit-sha evidence later.
function gitBlobSha1(content) {
  const data = Buffer.from(content, 'utf8');
  const header = `blob ${data.length}\0`;
  return createHash('sha1').update(header).update(data).digest('hex');
}

// Deterministic note body derived purely from the record (no wall-clock), so the
// content hash is stable and re-derivation matches the on-disk note.
//
// TEXT PATH (no record.transcription): byte-for-byte identical to WP0 — the
// header block, then the preview. MULTIMODAL PATH (record.transcription present,
// set by the worker's opt-in transcription stage): appends a governed
// transcription block (the OCR/STT text + any structured items / needs_review).
function renderNote(record) {
  const preview = typeof record.text_preview === 'string' ? record.text_preview : '';
  const header = [
    `# Capture ${record.capture_id}`,
    '',
    `- capture_id: ${record.capture_id}`,
    `- source_channel: ${record.source_channel ?? ''}`,
    `- recorded_intent: ${record.recorded_intent ?? ''}`,
    `- technical_source_type: ${record.technical_source_type ?? ''}`,
    '',
  ];

  const t = record.transcription;
  if (!t || typeof t !== 'object') {
    // Unchanged WP0 text-note shape.
    return [...header, preview, ''].join('\n');
  }

  // Multimodal note. DEV provenance is explicit: the transcript came from an
  // INJECTED transcriber in this increment, not a live model call.
  const lines = [
    ...header,
    '## Transcription (DEV — injected transcriber, not a live model call)',
    '',
  ];
  if (typeof t.text === 'string' && t.text.length > 0) {
    lines.push(t.text, '');
  }
  if (Array.isArray(t.items) && t.items.length > 0) {
    lines.push('### Structured items');
    for (const it of t.items) {
      const note = it.note ? ` (${it.note})` : '';
      lines.push(`- ${it.requested_qty} x ${it.item_name}${note}`);
    }
    lines.push('');
  }
  if (Array.isArray(t.needs_review) && t.needs_review.length > 0) {
    lines.push('### Needs review');
    for (const r of t.needs_review) {
      lines.push(`- ${r.raw} — ${r.reason}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Create a sandboxed Markdown writer rooted at baseDir. Writes land under
 * `<baseDir>/<subdir>/<capture_id>.md`. Never escapes baseDir.
 *
 * @param {object} opts
 * @param {string} opts.baseDir   sandbox/governed root.
 * @param {string} [opts.subdir]  leaf folder under baseDir. Default 'inbox'
 *                 (fixtures). The LIVE governed writer passes 'captures' so real
 *                 captures land in `Team Inbox/captures/` (see live/runtime.js).
 */
export function createSandboxMarkdownWriter({ baseDir, subdir = 'inbox' } = {}) {
  if (typeof baseDir !== 'string' || baseDir.length === 0) {
    throw new Error('createSandboxMarkdownWriter: baseDir required');
  }
  if (typeof subdir !== 'string' || subdir.length === 0) {
    throw new Error('createSandboxMarkdownWriter: subdir must be a non-empty string');
  }
  const inboxDir = path.join(baseDir, subdir);
  let diskWrites = 0; // count of ACTUAL disk writes — proves idempotency in tests.
  let failNextWrites = 0; // test-only: how many upcoming write() calls to fail.

  return {
    /**
     * Perform the governed write. Idempotent on the derived path.
     *
     * @returns {{
     *   destination_ref: { kind: 'markdown', path: string },
     *   evidence: { evidence_kind: 'markdown_write', target_ref: string, content_hash: string },
     *   existed: boolean
     * }}
     */
    write(record, { now } = {}) {
      if (typeof now !== 'number' || !Number.isFinite(now)) {
        throw new Error('markdownWriter.write: injected numeric `now` (epoch ms) required');
      }
      if (!record || typeof record.capture_id !== 'string' || record.capture_id.length === 0) {
        throw new Error('markdownWriter.write: record.capture_id required');
      }

      // Test-only fault injection (mirrors the adapter's failNextEdit): throw a
      // synthetic error BEFORE any path resolution or disk I/O, so no partial
      // note leaks and diskWrites/idempotency are unaffected on a failed call.
      if (failNextWrites > 0) {
        failNextWrites -= 1;
        throw new Error(`markdownWriter.write: simulated governed write failure for ${record.capture_id}`);
      }

      const fileName = `${safeSegment(record.capture_id)}.md`;
      const filePath = path.join(inboxDir, fileName);

      // Guard: the resolved path must stay inside the sandbox inbox.
      const resolved = path.resolve(filePath);
      if (!resolved.startsWith(path.resolve(inboxDir) + path.sep)) {
        throw new Error(`markdownWriter.write: refusing out-of-sandbox path for ${record.capture_id}`);
      }

      // Idempotent: if the note already exists, do NOT rewrite. Hash the EXISTING
      // content so the evidence pointer matches what is on disk.
      if (fs.existsSync(resolved)) {
        const existing = fs.readFileSync(resolved, 'utf8');
        return {
          destination_ref: { kind: 'markdown', path: resolved },
          evidence: {
            evidence_kind: 'markdown_write',
            target_ref: resolved,
            content_hash: gitBlobSha1(existing),
          },
          existed: true,
        };
      }

      fs.mkdirSync(inboxDir, { recursive: true });
      const content = renderNote(record);
      // Atomic-ish: write to a temp file then rename into place.
      const tmp = path.join(inboxDir, `.${fileName}.tmp`);
      fs.writeFileSync(tmp, content, { encoding: 'utf8' });
      fs.renameSync(tmp, resolved);
      diskWrites += 1;

      return {
        destination_ref: { kind: 'markdown', path: resolved },
        evidence: {
          evidence_kind: 'markdown_write',
          target_ref: resolved,
          content_hash: gitBlobSha1(content),
        },
        existed: false,
      };
    },

    /**
     * Erase a previously written sandbox note (security finding F-03, app layer).
     * Idempotent: removing an already-absent note is not an error.
     *
     * Traversal-safe: only ever operates INSIDE this writer's inbox. A
     * destination_ref pointing outside the sandbox is refused (defence in depth
     * against a tampered/foreign pointer), never followed.
     *
     * @param {{ kind?: string, path: string }} destinationRef
     * @param {{ now: number }} opts  injected epoch ms (signature parity with write()).
     * @returns {{ removed: boolean, path: string }}
     */
    remove(destinationRef, { now } = {}) {
      if (typeof now !== 'number' || !Number.isFinite(now)) {
        throw new Error('markdownWriter.remove: injected numeric `now` (epoch ms) required');
      }
      if (!destinationRef || typeof destinationRef.path !== 'string' || destinationRef.path.length === 0) {
        throw new Error('markdownWriter.remove: destinationRef.path required');
      }

      const resolved = path.resolve(destinationRef.path);
      const inboxRoot = path.resolve(inboxDir);
      // Only delete within the sandbox inbox — refuse anything outside it.
      if (resolved !== inboxRoot && !resolved.startsWith(inboxRoot + path.sep)) {
        throw new Error('markdownWriter.remove: refusing out-of-sandbox path');
      }

      if (!fs.existsSync(resolved)) {
        return { removed: false, path: resolved };
      }
      fs.rmSync(resolved, { force: true });
      return { removed: true, path: resolved };
    },

    /** Number of ACTUAL disk writes performed — used by tests to prove idempotency. */
    writeCount() {
      return diskWrites;
    },

    /** Test hook: force the next `n` write() calls to throw once each. */
    failNextWrite(n = 1) {
      if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) {
        throw new Error('markdownWriter.failNextWrite: n must be a non-negative integer');
      }
      failNextWrites = n;
    },

    inboxDir,
  };
}
