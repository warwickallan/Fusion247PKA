// BUILD-002 WP2 — one-off runner: ingest the real Honcho capture (Warwick, via Telegram) into the vault.
//   node services/hub/youtube/run-honcho.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ingestYouTube } from './ingest.mjs';

const VAULT = 'C:/Fusion247PKA/Team Knowledge';
const PACKET_ROOT = 'C:/Fusion247PKA/tools/tubeair/out/honcho';
const NOTE_BODY = 'C:/Users/Buggly/AppData/Local/Temp/claude/C--Fusion247PKA/4191b69f-b367-4926-be91-95f92f8aa1b1/scratchpad/honcho-note-body.md';

const dir = path.join(PACKET_ROOT, fs.readdirSync(PACKET_ROOT).find((d) => d.includes('pcR30j-sKxU')));
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const reportName = fs.readdirSync(dir).find((f) => f.endsWith('.md'));
const report = fs.readFileSync(path.join(dir, reportName), 'utf8');
const authoredBody = fs.readFileSync(NOTE_BODY, 'utf8');

const res = await ingestYouTube({
  vaultRoot: VAULT,
  meta: {
    videoId: manifest.video_id,
    title: manifest.title,
    sourceUrl: manifest.source_url,
    channel: manifest.channel,
    published: manifest.published_date,
    transcriptSource: manifest.transcript_source,
    capturedAt: manifest.captured_at,
    captureId: 'd8544749-0fb9-5849-902f-e92bde7935c9',
  },
  packetFiles: [
    { name: 'tubeair-report.md', content: report },
    { name: 'manifest.json', content: JSON.stringify(manifest, null, 2) },
  ],
  authoredBody,
});

console.log('[honcho] note   :', res.note.path, res.note.created ? '(created)' : '(already existed — idempotent)');
console.log('[honcho] raw    :', res.raw.dir, res.raw.created ? '(preserved)' : '(already preserved)');
for (const e of res.raw.files) console.log('[honcho]   evidence:', e.file, 'sha256', e.sha256.slice(0, 16) + '…', `(${e.bytes} bytes)`);
