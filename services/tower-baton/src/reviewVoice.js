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
// or the loop. It only renders. Identify review outcomes honestly as [CODEX].
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

function tidy(s, max) {
  const t = toAscii(s).replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}...` : t;
}

// Strip a leading "[tag] " marker (e.g. "[gate] ", "[critical] ") for plain reading.
function stripTag(s) {
  return String(s ?? '').replace(/^\s*\[[^\]]+\]\s*/, '').trim();
}

/**
 * Compose the CODEX review briefing for Telegram.
 *
 * @param {object}   args
 * @param {object}   args.checkpoint    parsed [LARRY -> TOWER] checkpoint (build_id/wp_id/head_sha/...)
 * @param {object?}  args.codexResult   the Codex structured result (or null when a gate blocked pre-Codex)
 * @param {object}   args.derived       deriveVerdict() result { verdict, material_findings[], next_action }
 * @param {string?}  args.reviewedHead  the exact reviewed head SHA (full)
 * @returns {string} a warm, plain-British, ASCII briefing under ~1200 chars, led by [CODEX].
 */
export function composeReviewBriefing({ checkpoint = {}, codexResult = null, derived = {}, reviewedHead = null } = {}) {
  const verdict = derived?.verdict ?? 'BLOCKED';
  const blocked = verdict === 'BLOCKED';
  const shortSha = String(reviewedHead ?? checkpoint?.head_sha ?? '').slice(0, 8) || '(unknown)';
  const build = checkpoint?.build_id ? String(checkpoint.build_id) : '(build?)';
  const wp = checkpoint?.wp_id ? ` ${checkpoint.wp_id}` : '';

  const lines = [];
  lines.push(`[CODEX] ${headline(verdict)}`);
  lines.push('');
  lines.push(`Had a look at ${build}${wp} at ${shortSha}.`);

  // Codex's own verification summary, when we have one (never on a pre-Codex gate block).
  const summary = codexResult && codexResult.status !== 'blocked' ? tidy(codexResult.summary, 200) : '';
  if (summary) lines.push(`In short: ${summary}`);

  // What I checked out -- the claims, plainly. Omitted entirely when there are none
  // (so an APPROVE with nothing to tick off never dangles an empty header).
  const claims = Array.isArray(codexResult?.claims_verified) ? codexResult.claims_verified : [];
  if (claims.length) {
    lines.push('');
    lines.push('What I checked out:');
    for (const c of claims.slice(0, 3)) {
      const text = tidy(c?.claim, 120);
      if (text) lines.push(`- ${claimPhrase(c?.status)}: ${text}`);
    }
  }

  // What needs doing / what's in the way. For a normal review this is the findings,
  // in plain words. For a BLOCKED outcome it's the blocker(s) that stopped the review.
  if (blocked) {
    const gateItems = Array.isArray(derived?.material_findings) && derived.material_findings.length
      ? derived.material_findings
      : (codexResult?.blocker ? [codexResult.blocker] : []);
    if (gateItems.length) {
      lines.push('');
      lines.push("What's in the way:");
      for (const g of gateItems.slice(0, 3)) {
        const text = tidy(stripTag(g), 160);
        if (text) lines.push(`- ${text}`);
      }
    }
  } else {
    const findings = Array.isArray(codexResult?.findings) ? codexResult.findings : [];
    if (findings.length) {
      lines.push('');
      lines.push(verdict === 'APPROVE' ? 'Worth noting:' : 'What needs doing:');
      for (const f of findings.slice(0, 3)) {
        const what = tidy(f?.required_correction || f?.rationale || f?.id, 150);
        if (what) lines.push(`- ${severityWord(f?.severity)}: ${what}`);
      }
    }
  }

  lines.push('');
  lines.push(`My verdict: ${plainVerdict(verdict)}.`);

  const next = tidy(derived?.next_action, 220);
  if (next) lines.push(`What happens next: ${next}`);

  // Whole-message ASCII pass (defence in depth over the per-field tidy), then the
  // belt-and-braces length ceiling. The per-section caps keep us well under in
  // practice, so the clamp never severs the verdict / next lines.
  let out = toAscii(lines.join('\n'));
  if (out.length > MAX_BRIEFING_CHARS) out = `${out.slice(0, MAX_BRIEFING_CHARS - 3).trimEnd()}...`;
  return out;
}
