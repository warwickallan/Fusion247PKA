// VERA QA HARNESS — read-only against the live cockpit.
// Serves the LIVE cockpit's own bytes (proxied from 8090) on port 8098, so what is inspected is the
// shipped artefact. Two payloads are shaped so the correction control can be REACHED at all:
//   /api/asdair/workspace  -> live payload + injected resolved questions (live shop has resolved:0)
//   /api/asdair/command    -> a chosen RECEIPT shape. Never forwarded upstream. No live write happens.
import http from 'node:http';
process.on('unhandledRejection', (e) => console.error('unhandledRejection', e && e.message));
process.on('uncaughtException', (e) => console.error('uncaughtException', e && e.message));

const LIVE = 'http://127.0.0.1:8090';
const PORT = 8098;
let scenario = 'chain';      // which resolved fixture
let receipt  = 'corrected';  // which command receipt

// ── The resolved fixture. Field names taken verbatim from assembleWorkspace.js:617-669. ──────────
function resolvedItems(kind) {
  const base = (over) => Object.assign({
    id: null, list_item_id: null, status: 'answered', status_display: 'answered',
    answer_source_display: 'typed', resolution_display: null, decision: null,
    question_round: 1, supersedes_question_key: null, superseded_by_question_key: null,
    allowed_replies: [{ key: 'correct', label: 'Change this answer', command: 'correctAnswer' }],
  }, over);

  if (kind === 'plain') {
    return [ base({
      question_key: 'milk:1',
      question_text_display: 'About "milk" - which did you mean?',
      answer_text_display: 'Cravendale Semi Skimmed 2L',
      answered_at_display: 'yesterday at 7:42pm',
      resolution_display: 'Resolved to Cravendale Filtered Semi Skimmed Milk 2L',
    }) ];
  }
  if (kind === 'unpublished') { // the DISABLED path: API offers no correction for this row
    return [ base({
      question_key: 'milk:1',
      question_text_display: 'About "milk" - which did you mean?',
      answer_text_display: 'Cravendale Semi Skimmed 2L',
      answered_at_display: 'yesterday at 7:42pm',
      allowed_replies: [],
    }) ];
  }
  // 'chain' — a line already corrected once: round 1 superseded by round 2.
  return [
    base({
      question_key: 'milk:2', question_round: 2,
      question_text_display: 'About "milk" - you said "Cravendale Semi Skimmed 2L", and you have changed that. Which did you mean?',
      answer_text_display: 'Arla Cravendale Whole Milk 2L',
      answered_at_display: 'today at 8:10am',
      resolution_display: 'Resolved to Arla Cravendale Whole Milk 2L',
      supersedes_question_key: 'milk:1',
    }),
    base({
      question_key: 'milk:1', question_round: 1,
      question_text_display: 'About "milk" - which did you mean?',
      answer_text_display: 'Cravendale Semi Skimmed 2L',
      answered_at_display: 'yesterday at 7:42pm',
      resolution_display: 'Resolved to Cravendale Filtered Semi Skimmed Milk 2L',
      superseded_by_question_key: 'milk:2',
    }),
  ];
}

// ── The receipt shapes. Every one is a REAL return of pipeline/commands.js correctAnswer. ────────
const RECEIPTS = {
  // commands.js:679-689, answered.changed === true
  corrected: { status: 200, body: { ok: true, command: 'correctAnswer', result: {
    question_key: 'milk:2', successor_question_key: 'milk:3', question_round: 3,
    superseded_answer_text: 'Arla Cravendale Whole Milk 2L', superseded_answered_at: '2026-08-19T07:10:00Z',
    corrected: true, opened: true, duplicate: false } } },
  // commands.js:592-599 — the same words again on a settled row
  duplicate: { status: 200, body: { ok: true, command: 'correctAnswer', result: {
    question_key: 'milk:2', successor_question_key: null,
    corrected: false, opened: false, duplicate: true, unchanged: true } } },
  // commands.js:679-689 with answered.changed === false but opened === true
  dupOpened: { status: 200, body: { ok: true, command: 'correctAnswer', result: {
    question_key: 'milk:2', successor_question_key: 'milk:3', question_round: 3,
    superseded_answer_text: 'Arla Cravendale Whole Milk 2L', superseded_answered_at: '2026-08-19T07:10:00Z',
    corrected: false, opened: true, duplicate: true } } },
  // commands.js:571-578 — the tip was OPEN: answered it, nothing superseded
  openRound: { status: 200, body: { ok: true, command: 'correctAnswer', result: {
    question_key: 'milk:2', successor_question_key: null,
    answered_open_round: true, corrected: false, opened: false, duplicate: false } } },
  // commands.js:615-620 — the key cannot be reproduced. httpApi.js:780 forwards safeMessage verbatim.
  refuseKey: { status: 500, body: { ok: false, error: 'command_failed', command: 'correctAnswer',
    message: 'commands: correctAnswer cannot reproduce question key "milk:2" (round 2) from any name this '
      + 'question carries on shop SHOP-2026-08-18-M128. A successor derived from a different name would be '
      + 'invisible to the planner - recorded, and inert. Refusing rather than writing one. Nothing was written.' } },
  // httpApi.js:756-760 — the name is not on the surface
  unknown: { status: 400, body: { ok: false, error: 'unknown_command',
    message: 'The cockpit may only call the shared AsdAIr command surface.' } },
};

const send = (res, status, obj) => {
  const b = Buffer.from(JSON.stringify(obj));
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': b.length });
  res.end(b);
};

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');

  if (u.pathname === '/vera/set') {
    scenario = u.searchParams.get('s') || scenario;
    receipt  = u.searchParams.get('r') || receipt;
    return send(res, 200, { ok: true, scenario, receipt });
  }

  if (u.pathname === '/api/asdair/command') {
    let n = 0; for await (const c of req) n += c.length;   // drain; NEVER forwarded upstream
    const r = RECEIPTS[receipt] || RECEIPTS.corrected;
    return send(res, r.status, r.body);
  }

  if (u.pathname === '/api/asdair/workspace') {
    const up = await fetch(LIVE + '/api/asdair/workspace');
    const w  = await up.json();
    w.questions = w.questions || {};
    w.questions.resolved = resolvedItems(scenario);
    return send(res, 200, w);
  }

  // Everything else is the live cockpit's own bytes, verbatim.
  try {
    const up = await fetch(LIVE + req.url, { method: req.method, headers: { accept: req.headers.accept || '*/*' } });
    const buf = Buffer.from(await up.arrayBuffer());
    const h = {}; const ct = up.headers.get('content-type'); if (ct) h['content-type'] = ct;
    h['content-length'] = buf.length;
    res.writeHead(up.status, h); res.end(buf);
  } catch (e) {
    console.error('passthrough failed', req.url, e.message);
    try { res.writeHead(502, { 'content-type': 'text/plain' }); res.end('upstream'); } catch {}
  }
}).listen(PORT, '127.0.0.1', () => console.log('vera stub on http://127.0.0.1:' + PORT));
