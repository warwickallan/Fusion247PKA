// =====================================================================
// BUILD-015 AsdAIr Stage 1 - transcribe/transcribe-list.js
//
// The runtime caller. ONE SHOT: it makes at most one transcription call
// (with the standard JSON retries) and exits. It is not a daemon, does
// not poll, does not queue and holds no state.
//
// Usage:
//   node --env-file=<env> transcribe-list.js --image <path> [--json] [--dry-run]
//
// Environment (by NAME only - this file never reads a credential value):
//   FUSION_GATEWAY_URL    the gateway every household image is sent to.
//                         There is no hardcoded endpoint and no default.
//   FUSION_GATEWAY_KEY    optional bearer, consumed inside models.mjs only.
//   FUSION_MODEL_VISION   optional role alias override (default fusion.vision).
//
// --dry-run validates the image reference and prints what WOULD be sent.
// It makes no model call and opens no connection.
//
// PURE ASCII only.
// =====================================================================

import { transcribeList, validateImageRef, redactSecrets, MAX_IMAGE_BYTES, SUPPORTED_IMAGE_TYPES } from './transcribeList.js';

function parseArgs(argv) {
  const out = { json: false, dryRun: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--image') out.image = argv[++i];
    else if (a === '--json') out.json = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else { out.unknown = a; }
  }
  return out;
}

function usage() {
  console.log('Usage: node --env-file=<env> transcribe-list.js --image <path> [--json] [--dry-run]');
  console.log('');
  console.log('  --image <path>  photo of the handwritten list (' + Object.keys(SUPPORTED_IMAGE_TYPES).join(', ') + ', max ' + MAX_IMAGE_BYTES + ' bytes)');
  console.log('  --json          print the transcript object as JSON only');
  console.log('  --dry-run       validate inputs and print the plan; NO model call');
  console.log('');
  console.log('Set FUSION_GATEWAY_URL to the gateway you want the image sent to.');
  console.log('There is no default endpoint: with no gateway configured this fails, it never');
  console.log('falls back to a text model that would invent a shopping list.');
}

function pad(s, w) {
  const t = String(s);
  return t.length >= w ? t : t + ' '.repeat(w - t.length);
}

function printHuman(transcript, ref) {
  console.log('');
  console.log('AsdAIr list transcription (one-shot)');
  console.log('  image     : ' + ref.path);
  console.log('  provider  : ' + transcript.provenance.provider);
  console.log('  model     : ' + transcript.provenance.model);
  console.log('  lines     : ' + transcript.lines.length);
  console.log('  review    : ' + (transcript.needs_review ? 'YES - a human must answer the uncertain lines below' : 'no'));
  console.log('  NOTE      : transcription only - nothing is planned, ordered or substituted.');
  console.log('');
  console.log('  ' + pad('QTY', 6) + pad('ITEM', 30) + 'RAW / UNCERTAINTY');
  console.log('  ' + '-'.repeat(78));
  transcript.lines.forEach((l) => {
    const qty = l.requested_qty === null ? (l.uncertain ? '?' : '-') : String(l.requested_qty);
    console.log('  ' + pad(qty, 6) + pad(l.item_name || '(unreadable)', 30) + l.raw);
    if (l.uncertain) console.log('  ' + pad('', 36) + '^ ASK: ' + l.uncertainty_reason);
  });
  console.log('');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.image) { usage(); process.exit(args.help ? 0 : 2); }
  if (args.unknown) { console.error('transcribe: unknown argument: ' + args.unknown); usage(); process.exit(2); }

  // Always validated first, dry-run or not.
  const ref = validateImageRef(args.image);

  if (args.dryRun) {
    const plan = {
      dry_run: true,
      image: ref.path,
      mime: ref.mime,
      bytes: ref.bytes,
      gateway_configured: !!process.env.FUSION_GATEWAY_URL,   // presence only; the value is never printed
      model_role: 'vision',
      model_alias: process.env.FUSION_MODEL_VISION || 'fusion.vision',
      would_call: false,
    };
    if (args.json) console.log(JSON.stringify(plan, null, 2));
    else {
      console.log('');
      console.log('AsdAIr list transcription - DRY RUN (no model call made)');
      console.log('  image            : ' + plan.image);
      console.log('  type / size      : ' + plan.mime + ' / ' + plan.bytes + ' bytes');
      console.log('  gateway configured: ' + (plan.gateway_configured ? 'yes' : 'NO - a real run would fail, by design'));
      console.log('  model role/alias : ' + plan.model_role + ' / ' + plan.model_alias);
      console.log('');
    }
    return;
  }

  const transcript = await transcribeList(ref.path);
  if (args.json) console.log(JSON.stringify(transcript, null, 2));
  else printHuman(transcript, ref);
}

main().catch((err) => {
  // Redacted on the way out: an upstream error body could echo a header we
  // never want on a terminal or in a log file.
  console.error('transcribe: ' + redactSecrets(err && err.message ? err.message : err));
  process.exit(1);
});
