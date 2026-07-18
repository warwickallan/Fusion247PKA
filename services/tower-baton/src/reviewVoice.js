// Tower baton -- the CODEX Telegram VOICE for review outcomes.
//
// PURE, SIDE-EFFECT-FREE. composeReviewBriefing() turns the raw review material
// (the Codex structured result + the derived baton verdict) into a WARM, PLAIN
// BRITISH, CANDID adviser-style Telegram message -- a trusted mate talking to
// Warwick, not a CI log wearing a tie.
//
// DRAWN FROM section 7 of tower-reviewer-runtime-prompt.md (the Warwick Telegram
// briefing voice), ADAPTED to the data the tested baton actually carries:
//   codexResult { verdict, summary, claims_verified[], findings[] }  (CODEX_RESULT_SCHEMA)
//   derived     { verdict, material_findings[], next_action }        (deriveVerdict)
// It does NOT change the ratified QA skill, the Codex schema, the verdict vocabulary
// or the loop. It only renders. SOURCE-TAG OWNERSHIP: this composer emits NO [CODEX]
// prefix -- the notifier's wireText() (driven by logicalSource: 'CODEX') is the SOLE
// owner of the single [CODEX] label on the final wire. The body produced here leads
// with the bare verdict + criticality status line; the wire ends up "[CODEX] <status>".
//
// ASCII ONLY -- this source file, and the string it produces. No em-dashes, no arrow
// glyphs: this runtime once had a Windows scheduled task broken by a non-ASCII char,
// so both the module and its output are forced to plain ASCII (see toAscii()).

// Hard ceiling on the whole message. Telegram is a glance, not a report; detail
// lives in the [TOWER -> LARRY] ClickUp reply and on GitHub.
export const MAX_BRIEFING_CHARS = 1200;

// Common non-ASCII punctuation -> ASCII, keyed by CODE POINT so THIS source file
// stays pure ASCII (no literal glyphs to break a PowerShell 5.1 parse or a scheduled
// task). Anything not in the map and above 0x7F is dropped by toAscii().
const ASCII_PUNCT = new Map([
  [0x2014, '--'],  // em dash
  [0x2013, '-'],   // en dash
  [0x2012, '-'],   // figure dash
  [0x2192, '->'],  // rightwards arrow
  [0x21d2, '->'],  // rightwards double arrow
  [0x2018, "'"],   // left single quote
  [0x2019, "'"],   // right single quote
  [0x201b, "'"],   // single high-reversed-9 quote
  [0x201c, '"'],   // left double quote
  [0x201d, '"'],   // right double quote
  [0x2026, '...'], // horizontal ellipsis
  [0x00b7, '-'],   // middle dot
  [0x2022, '-'],   // bullet
  [0x00a0, ' '],   // non-breaking space
]);

// Force ASCII. Upstream material (deriveVerdict's next_action, Codex's summary /
// findings) can carry em-dashes, arrows or curly quotes; the briefing normalises the
// common ones and drops anything else still above 0x7F.
export function toAscii(s) {
  let out = '';
  for (const ch of String(s ?? '')) {
    const cp = ch.codePointAt(0);
    if (cp <= 0x7f) { out += ch; continue; }
    const mapped = ASCII_PUNCT.get(cp);
    if (mapped !== undefined) out += mapped; // else drop it
  }
  return out;
}

// The baton verdict rendered in PLAIN ENGLISH (the exact meanings Warwick asked for).
export function plainVerdict(verdict) {
  switch (verdict) {
    case 'APPROVE': return "I've signed it off";
    case 'CORRECTIONS_REQUIRED': return "I've sent it back for fixes";
    case 'DECISION_REQUIRED': return 'it needs your call';
    case 'BLOCKED': return "I couldn't complete it";
    default: return 'see the detail above';
  }
}

// A warm, candid opening line keyed on the outcome. No performative praise, no
// "everything looks good" filler, no "as an AI".
function headline(verdict) {
  switch (verdict) {
    case 'APPROVE': return "Good news -- I've been through it and it stands up.";
    case 'CORRECTIONS_REQUIRED': return "Decent work, but it's not done -- a couple of things need sorting.";
    case 'DECISION_REQUIRED': return "This one's above my pay grade -- it needs your call.";
    case 'BLOCKED': return "I couldn't finish the review -- something's in the way.";
    default: return "Here's where the review landed.";
  }
}

// A claim outcome in plain words (never the raw enum).
function claimPhrase(status) {
  switch (status) {
    case 'confirmed': return 'Stood up';
    case 'refuted': return "Didn't hold up";
    case 'partial': return 'Only half-right';
    case 'unverifiable': return "Couldn't confirm";
    default: return 'Looked at';
  }
}

// A finding severity in plain words (so findings never read as severity codes alone).
function severityWord(severity) {
  switch (severity) {
    case 'critical': return 'Serious';
    case 'high': return 'Important';
    case 'medium': return 'Worth fixing';
    case 'low': return 'Minor';
    case 'info': return 'Note';
    default: return 'Note';
  }
}

// The verdict as a SHORT UPPERCASE status token for the leading status line
// (mirrors the runtime-prompt sec.5 verdicts, mapped to the tested baton vocab).
// Warwick reads this FIRST to judge how critical the outcome is before any detail.
function verdictStatusToken(verdict) {
  switch (verdict) {
    case 'APPROVE': return 'APPROVED';
    case 'CORRECTIONS_REQUIRED': return 'CORRECTIONS REQUIRED';
    case 'DECISION_REQUIRED': return 'DECISION REQUIRED';
    case 'BLOCKED': return 'BLOCKED';
    default: return 'REVIEWED';
  }
}

// Severity ranking, HIGHEST first (runtime-prompt sec.4: BLOCKER/HIGH/MEDIUM/LOW/NOTE),
// reconciled with the tested schema's lowercase severities (critical/high/medium/low/info).
// The winning rank drives the criticality clause on the leading status line.
const SEVERITY_RANK = new Map([
  ['blocker', 5],
  ['critical', 5],
  ['high', 4],
  ['medium', 3],
  ['low', 2],
  ['info', 1],
  ['note', 1],
]);

function severityRank(sev) {
  return SEVERITY_RANK.get(String(sev ?? '').toLowerCase().trim()) ?? 0;
}

// The HIGHEST severity among the material findings, returned as a canonical
// lowercase token (or null when there are none). Draws from BOTH sources the baton
// carries: the Codex structured findings[].severity AND any "[severity]"-tagged
// derived.material_findings strings (a "[gate]" tag has no severity and is ignored).
// The returned token is one of a FIXED, bounded set -- it can never inflate the
// leading status line past the budget regardless of caller input.
function highestSeverityToken({ codexResult = null, derived = {} } = {}) {
  const sevs = [];
  const findings = Array.isArray(codexResult?.findings) ? codexResult.findings : [];
  for (const f of findings) if (f?.severity) sevs.push(String(f.severity));
  const mats = Array.isArray(derived?.material_findings) ? derived.material_findings : [];
  for (const m of mats) {
    const tag = String(m ?? '').match(/^\s*\[([^\]]+)\]/);
    if (tag && SEVERITY_RANK.has(tag[1].toLowerCase().trim())) sevs.push(tag[1]);
  }
  let best = null;
  let bestRank = 0;
  for (const s of sevs) {
    const r = severityRank(s);
    if (r > bestRank) { bestRank = r; best = String(s).toLowerCase().trim(); }
  }
  return best;
}

// The criticality clause on the leading status line. BLOCKED can't be graded on
// severity (the review never completed), so it states that plainly. Otherwise it
// names the highest severity present, or reads "no findings" when the review is
// clean. Every branch returns a short, bounded, ASCII string.
function criticalityClause(verdict, sevToken) {
  if (verdict === 'BLOCKED') return 'could not complete the review';
  if (!sevToken) return 'no findings';
  return `highest severity: ${sevToken.toUpperCase()}`;
}

function tidy(s, max) {
  const t = toAscii(s).replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}...` : t;
}

// Per-identifier clamp for tokens that land in the MANDATORY SPINE (build_id,
// wp_id, and any other caller-supplied identifier embedded in the header line).
// A pathologically long identifier could otherwise inflate the spine itself past
// MAX_BRIEFING_CHARS -- and the spine-only fallback would then truncate from the
// END, severing the verdict / next-action after all (the residual F1 edge). By
// bounding each identifier to a sane length FIRST, the spine is guaranteed to fit
// the budget with room reserved for the verdict + next-action lines.
const SPINE_ID_MAX = 48;
function clampId(s, max = SPINE_ID_MAX) {
  const t = toAscii(s).replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 3).trimEnd()}...` : t;
}

// Strip a leading "[tag] " marker (e.g. "[gate] ", "[critical] ") for plain reading.
function stripTag(s) {
  return String(s ?? '').replace(/^\s*\[[^\]]+\]\s*/, '').trim();
}

// Cost of a block of lines once joined with '\n' into a larger message: each line
// contributes its own length plus one newline separator.
function blockCost(lines) {
  return lines.reduce((n, l) => n + l.length + 1, 0);
}

// Fit an OPTIONAL section into `room` characters by dropping whole lines from the
// end (its lowest-priority items first), never by cutting mid-line. A section that
// gets reduced to just its structural lines (a leading blank and/or a header with
// no items left) is dropped ENTIRELY so no dangling header survives. Returns the
// lines that fit (possibly empty). The mandatory spine is never passed here.
function fitBlock(lines, room) {
  if (room <= 0) return [];
  const kept = lines.slice();
  while (kept.length && blockCost(kept) > room) kept.pop();
  const wasList = lines.some((l) => l.startsWith('- '));
  const hasItem = kept.some((l) => l.startsWith('- '));
  if (wasList && !hasItem) return []; // header would dangle with no items -> drop whole
  return kept;
}

/**
 * Compose the CODEX review briefing for Telegram.
 *
 * @param {object}   args
 * @param {object}   args.checkpoint    parsed [LARRY -> TOWER] checkpoint (build_id/wp_id/head_sha/...)
 * @param {object?}  args.codexResult   the Codex structured result (or null when a gate blocked pre-Codex)
 * @param {object}   args.derived       deriveVerdict() result { verdict, material_findings[], next_action }
 * @param {string?}  args.reviewedHead  the exact reviewed head SHA (full)
 * @returns {string} a warm, plain-British, ASCII briefing under ~1200 chars, led by the
 *                   bare verdict + criticality status line. NO [CODEX] prefix here -- the
 *                   notifier's wireText() is the single owner of the [CODEX] source tag.
 */
export function composeReviewBriefing({ checkpoint = {}, codexResult = null, derived = {}, reviewedHead = null } = {}) {
  const verdict = derived?.verdict ?? 'BLOCKED';
  const blocked = verdict === 'BLOCKED';
  // shortSha is inherently bounded (first 8 chars). build_id and wp_id are
  // caller-supplied and UNBOUNDED, so each is clamped before it enters the spine.
  const shortSha = String(reviewedHead ?? checkpoint?.head_sha ?? '').slice(0, 8) || '(unknown)';
  const build = checkpoint?.build_id ? clampId(String(checkpoint.build_id)) : '(build?)';
  const wp = checkpoint?.wp_id ? ` ${clampId(String(checkpoint.wp_id))}` : '';

  // ---------------------------------------------------------------------------
  // MANDATORY SPINE -- reserved FIRST, must ALWAYS survive regardless of input
  // size. The LEADING STATUS LINE (the very first content line) states the
  // verdict token and the criticality up front so Warwick can gauge how serious
  // it is BEFORE reading any detail; it, the verdict line and the what-happens-
  // next line are the pieces whose budget is claimed before any optional section.
  // A huge summary / claims / findings payload can no longer crowd them past the
  // length clamp and sever them (F1 -- the bug Codex found: the old code truncated
  // the whole assembled string from the end, dropping exactly those lines). The
  // status line embeds NO caller-supplied identifiers -- only the bounded verdict
  // token and a bounded severity token -- so, unlike the "Had a look at ..." line
  // (whose build_id / wp_id are clampId()-bounded above), it cannot itself
  // overflow the budget. The status line carries NO [CODEX] source tag: the
  // notifier's wireText() (logicalSource: 'CODEX') is the single owner of that
  // label, so the final wire reads exactly "[CODEX] <status line>" -- never
  // "[CODEX] [CODEX] ...".
  // ---------------------------------------------------------------------------
  const sevToken = highestSeverityToken({ codexResult, derived });
  const statusLine = `${verdictStatusToken(verdict)} - ${criticalityClause(verdict, sevToken)}`;
  const headLines = [
    statusLine,
    headline(verdict),
    '',
    `Had a look at ${build}${wp} at ${shortSha}.`,
  ];
  const tailLines = [`My verdict: ${plainVerdict(verdict)}.`];
  const next = tidy(derived?.next_action, 220);
  if (next) tailLines.push(`What happens next: ${next}`);

  // ---------------------------------------------------------------------------
  // OPTIONAL SECTIONS -- built once (each already ASCII + per-field capped), then
  // admitted whole-or-truncated in PRIORITY order into whatever budget the spine
  // leaves, but RENDERED in reading order. Priority: what-needs-doing (findings /
  // blockers, the most actionable) first, then Codex's short summary, then the
  // claims tick-list -- the least load-bearing is the first to be trimmed.
  // ---------------------------------------------------------------------------

  // Codex's own verification summary (never on a pre-Codex gate block).
  const summaryText = codexResult && codexResult.status !== 'blocked' ? tidy(codexResult.summary, 200) : '';
  const summaryBlock = summaryText ? [`In short: ${summaryText}`] : [];

  // The claims, plainly. Omitted entirely when there are none (so an APPROVE with
  // nothing to tick off never dangles an empty header).
  const claims = Array.isArray(codexResult?.claims_verified) ? codexResult.claims_verified : [];
  const claimsItems = [];
  for (const c of claims.slice(0, 3)) {
    const text = tidy(c?.claim, 120);
    if (text) claimsItems.push(`- ${claimPhrase(c?.status)}: ${text}`);
  }
  const claimsBlock = claimsItems.length ? ['', 'What I checked out:', ...claimsItems] : [];

  // What needs doing / what's in the way. For a normal review this is the findings
  // in plain words; for a BLOCKED outcome it's the blocker(s) that stopped it.
  const doingItems = [];
  let doingHeader = '';
  if (blocked) {
    doingHeader = "What's in the way:";
    const gateItems = Array.isArray(derived?.material_findings) && derived.material_findings.length
      ? derived.material_findings
      : (codexResult?.blocker ? [codexResult.blocker] : []);
    for (const g of gateItems.slice(0, 3)) {
      const text = tidy(stripTag(g), 160);
      if (text) doingItems.push(`- ${text}`);
    }
  } else {
    doingHeader = verdict === 'APPROVE' ? 'Worth noting:' : 'What needs doing:';
    const findings = Array.isArray(codexResult?.findings) ? codexResult.findings : [];
    for (const f of findings.slice(0, 3)) {
      const what = tidy(f?.required_correction || f?.rationale || f?.id, 150);
      if (what) doingItems.push(`- ${severityWord(f?.severity)}: ${what}`);
    }
  }
  const doingBlock = doingItems.length ? ['', doingHeader, ...doingItems] : [];

  // ---------------------------------------------------------------------------
  // BUDGETED ASSEMBLY. Reserve the spine's cost, then admit optional blocks in
  // priority order until the ~1200-char ceiling is reached; a block that will not
  // fit whole is trimmed at line granularity (its lowest items dropped, or the
  // whole block if only its header would remain). The verdict + next-action lines
  // are never in the truncation path.
  // ---------------------------------------------------------------------------
  const spine = [...headLines, '', ...tailLines];
  let used = spine.join('\n').length;

  // read = reading-order index; prio = admit-order (lower first).
  const blocks = [
    { read: 0, prio: 2, lines: summaryBlock },
    { read: 1, prio: 3, lines: claimsBlock },
    { read: 2, prio: 1, lines: doingBlock },
  ].filter((b) => b.lines.length);

  const admitted = [];
  for (const b of [...blocks].sort((a, x) => a.prio - x.prio)) {
    let lines = b.lines;
    if (used + blockCost(lines) > MAX_BRIEFING_CHARS) lines = fitBlock(lines, MAX_BRIEFING_CHARS - used);
    if (lines.length) { admitted.push({ read: b.read, lines }); used += blockCost(lines); }
  }
  admitted.sort((a, x) => a.read - x.read);
  const middle = [];
  for (const b of admitted) middle.push(...b.lines);

  // Whole-message ASCII pass (defence in depth over the per-field tidy). Every
  // line is already ASCII, so this cannot grow the string past the reserved budget.
  let out = toAscii([...headLines, ...middle, '', ...tailLines].join('\n'));

  // Belt-and-braces: if some pathological spine still overran, fall back to the
  // spine ALONE (verdict + next-action preserved) rather than severing them.
  if (out.length > MAX_BRIEFING_CHARS) {
    out = toAscii([...headLines, '', ...tailLines].join('\n'));
    if (out.length > MAX_BRIEFING_CHARS) out = `${out.slice(0, MAX_BRIEFING_CHARS - 3).trimEnd()}...`;
  }
  return out;
}
