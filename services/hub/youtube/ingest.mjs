// BUILD-002 WP2 — YouTube ingest pipeline: RAW preservation + governed knowledge-note write.
//
// Ties the walking skeleton together downstream of TubeAIR extraction: it preserves the RAW
// transcript/packet IMMUTABLY in the governed vault, then writes the standalone knowledge note
// through the ONE write authority (VaultWriter) — idempotent on the video id, so duplicate delivery
// or a resumed worker never produces a second note or a second RAW copy.
//
// The GENERATIVE knowledge note (semantic reconstruction) is authored IN-SESSION (Larry), per the
// approved D-cairn decision — no headless LLM / API key. This module takes that authored body and
// governs its persistence + evidence; it does not itself call a model.
import path from 'node:path';
import { createHash } from 'node:crypto';
import { VaultWriter, FsVaultAdapter } from '../vault/vaultWriter.mjs';

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

// Preserve the RAW packet immutably (write-once) under <subdir>/_raw/<videoId>/, with sha256 evidence.
// Shared by ingestYouTube (in-session, with a note) and the auto-detect watcher (headless, RAW only).
export async function preserveRaw({ vaultRoot, videoId, packetFiles, subdir = 'Sources', adapter }) {
  const a = adapter || new FsVaultAdapter(vaultRoot);
  const rawDirRel = path.posix.join(subdir, '_raw', videoId);
  const files = [];
  let created = false;
  for (const f of packetFiles) {
    const rel = path.posix.join(rawDirRel, f.name);
    const incomingSha = sha256(f.content);
    let storedSha;
    // Race-safe exclusive create when available (EEXIST => already preserved); else exists/write.
    let wrote;
    if (typeof a.writeNew === 'function') wrote = (await a.writeNew(rel, f.content)).created;
    else wrote = !(await a.exists(rel)) ? (await a.write(rel, f.content), true) : false;
    if (wrote) {
      created = true; storedSha = incomingSha;
    } else {
      // The file already exists (RAW is immutable/write-once). Report the sha of the STORED bytes, not
      // the incoming ones — and FAIL CLOSED if they differ (QA2-A: a retry with changed/corrupt content
      // must never return evidence for content that was not written).
      const stored = await a.read(rel);
      storedSha = sha256(stored);
      if (storedSha !== incomingSha) throw new Error(`RAW immutability violation for ${rel}: stored content sha ${storedSha.slice(0, 12)} != incoming ${incomingSha.slice(0, 12)}`);
    }
    files.push({ file: rel, sha256: storedSha, bytes: Buffer.byteLength(f.content) });
  }
  return { dir: rawDirRel, created, files, adapter: a };
}

// meta: { videoId, title, sourceUrl, channel, published, transcriptSource, capturedAt, captureId }
// packetFiles: [{ name, content }]  — the TubeAIR report + manifest (RAW source evidence)
// authoredBody: the in-session-authored standalone knowledge note (Markdown, no frontmatter)
export async function ingestYouTube({ vaultRoot, meta, packetFiles, authoredBody, subdir = 'Sources' }) {
  if (!meta?.videoId) throw new Error('ingestYouTube requires meta.videoId');
  if (!authoredBody) throw new Error('ingestYouTube requires an authored knowledge-note body');
  const adapter = new FsVaultAdapter(vaultRoot);

  // 1. Preserve RAW immutably (write-once) with sha256 evidence.
  const rawResult = await preserveRaw({ videoId: meta.videoId, packetFiles, subdir, adapter });
  const rawDirRel = rawResult.dir;
  const rawEvidence = rawResult.files;
  const rawCreated = rawResult.created;

  // 2. Write the knowledge note through VaultWriter (idempotent on videoId).
  const vw = new VaultWriter(adapter, { subdir });
  const rawLine = rawEvidence.map((e) => `\`${path.posix.basename(e.file)}\` (sha256 \`${e.sha256.slice(0, 12)}…\`)`).join(', ');
  const body = `${authoredBody.replace(/\s*$/, '')}\n\n---\n\n**RAW transcript — immutable source evidence:** \`${rawDirRel}/\` — ${rawLine}. Preserved as captured; never edited or summarised.\n`;
  const note = await vw.writeNote({
    sourceId: meta.videoId,
    title: meta.title,
    frontmatter: {
      type: 'source-knowledge-note',
      source_type: 'youtube_transcript',
      title: meta.title,
      source_url: meta.sourceUrl,
      video_id: meta.videoId,
      channel: meta.channel,
      published: meta.published,
      transcript_source: meta.transcriptSource,
      captured_at: meta.capturedAt,
      capture_id: meta.captureId,
      review_state: 'ai_created',
      build: 'BUILD-002',
      authored_by: 'larry-in-session',
      raw_evidence: rawEvidence.map((e) => e.file),
      tags: ['youtube', 'source-knowledge', 'pending-warwick-review'],
    },
    body,
  });

  return {
    note,                                   // { path, created, ... }
    raw: { dir: rawDirRel, created: rawCreated, files: rawEvidence, link: adapter.linkFor(path.posix.join(rawDirRel, packetFiles[0].name)) },
  };
}
