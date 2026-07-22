// BUILD-002 WP2 — governed YouTube processor for the gateway spine.
//
// Implements the SAME governed-write contract the spine worker expects from markdownWriter.write():
//   process(record, { now }) -> { destination_ref, evidence, existed }
// so the durable state machine (claim → writing → written → evidenced → completed) governs a YouTube
// capture exactly like a note. The DURABLE work that earns `completed` is: transcript extracted +
// immutable RAW preserved + youtube_source row created. The standalone knowledge note is authored
// IN-SESSION afterwards (D-cairn) — it is deliberately NOT a completion gate.
//
// Every side-effecting dependency is INJECTED, so the fixtures proof runs fully synthetic (no network,
// no TubeAIR subprocess, no live DB) and the live wiring passes the real implementations.
//
// deps:
//   classify(text)            -> { isYouTube, videoId, canonicalUrl }
//   sourceExists(videoId)     -> Promise<boolean>            (idempotency short-circuit)
//   extract(url, videoId)     -> Promise<{ ok, manifest, packetFiles, error? }>
//   preserveRaw({videoId, packetFiles}) -> Promise<{ dir, files:[{sha256}], created }>
//   upsertSource(row)         -> Promise<void>               (idempotent on video_id)
export function createYoutubeProcessor(deps = {}) {
  const { classify, sourceExists, extract, preserveRaw, upsertSource } = deps;
  for (const [k, v] of Object.entries({ classify, sourceExists, extract, preserveRaw, upsertSource })) {
    if (typeof v !== 'function') throw new Error(`createYoutubeProcessor: dep "${k}" (function) required`);
  }

  return {
    async process(record, { now } = {}) {
      if (typeof now !== 'number' || !Number.isFinite(now)) throw new Error('youtubeProcessor.process: numeric now required');
      const text = (record && (record.payload_text ?? record.text_preview)) || '';
      const yt = classify(text);
      if (!yt.isYouTube) throw new Error('youtubeProcessor.process: not a YouTube capture (router misroute)');
      const videoId = yt.videoId;

      // Idempotency short-circuit: if the source row already exists, re-processing must NOT re-extract
      // or re-write RAW — return a stable destination + evidence (mirrors markdownWriter's `existed`).
      if (await sourceExists(videoId)) {
        return {
          destination_ref: { kind: 'youtube_source', video_id: videoId, source_url: yt.canonicalUrl },
          evidence: { evidence_kind: 'raw_transcript', target_ref: `Sources/_raw/${videoId}`, content_hash: `existing:${videoId}` },
          existed: true,
        };
      }

      const ex = await extract(yt.canonicalUrl, videoId);
      if (!ex || ex.ok !== true) throw new Error(`youtube extraction failed for ${videoId}: ${ex && ex.error ? ex.error : 'unknown'}`);

      const raw = await preserveRaw({ videoId, packetFiles: ex.packetFiles });
      const rawSha = raw.files && raw.files[0] ? raw.files[0].sha256 : null;
      if (!rawSha) throw new Error(`youtube RAW preservation produced no sha for ${videoId}`);

      const m = ex.manifest || {};
      await upsertSource({
        video_id: videoId, title: m.title, source_url: m.source_url || yt.canonicalUrl, channel: m.channel,
        published: m.published_date, transcript_source: m.transcript_source, segment_count: m.segment_count,
        captured_at: m.captured_at, capture_id: record.capture_id, raw_path: raw.dir, raw_sha256: rawSha,
      });

      return {
        destination_ref: { kind: 'youtube_source', video_id: videoId, source_url: m.source_url || yt.canonicalUrl },
        evidence: { evidence_kind: 'raw_transcript', target_ref: raw.dir, content_hash: rawSha },
        existed: false,
      };
    },
  };
}
