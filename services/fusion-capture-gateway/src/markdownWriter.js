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
function renderNote(record) {
  const preview = typeof record.text_preview === 'string' ? record.text_preview : '';
  return [
    `# Capture ${record.capture_id}`,
    '',
    `- capture_id: ${record.capture_id}`,
    `- source_channel: ${record.source_channel ?? ''}`,
    `- recorded_intent: ${record.recorded_intent ?? ''}`,
    `- technical_source_type: ${record.technical_source_type ?? ''}`,
    '',
    preview,
    '',
  ].join('\n');
}

/**
 * Create a sandboxed Markdown writer rooted at baseDir. Writes land under
 * `<baseDir>/inbox/<capture_id>.md`. Never escapes baseDir.
 *
 * @param {object} opts
 * @param {string} opts.baseDir  sandbox root (throwaway path in fixtures).
 */
export function createSandboxMarkdownWriter({ baseDir } = {}) {
  if (typeof baseDir !== 'string' || baseDir.length === 0) {
    throw new Error('createSandboxMarkdownWriter: baseDir required');
  }
  const inboxDir = path.join(baseDir, 'inbox');
  let diskWrites = 0; // count of ACTUAL disk writes — proves idempotency in tests.

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

    /** Number of ACTUAL disk writes performed — used by tests to prove idempotency. */
    writeCount() {
      return diskWrites;
    },

    inboxDir,
  };
}
