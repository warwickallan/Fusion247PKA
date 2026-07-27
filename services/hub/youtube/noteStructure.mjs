// BUILD-002 §8/§10 + AC3 — structural gate for the YouTube knowledge note.
//
// The contract requires a STANDALONE knowledge note (BUILD-CONTRACT §8, AC3 "A standalone knowledge note is
// created"). Nothing executable enforced that the note actually carries the required section set — the only
// check in the tree is a case-sensitive substring scan inside generate-source-note.mjs. This module is the
// enforceable version of that requirement: pure, dependency-free, no I/O, no LLM.
//
// It validates STRUCTURE ONLY — that each required section is present as a markdown heading. It deliberately
// does NOT judge the prose inside a section (not-a-dump, not-a-thin-summary, review state and the other §8
// quality properties are outside a structural gate's remit).
//
// SCOPE RULING (Warwick, 2026-07-27): the required set is TEN structural sections. The contract's other two
// note requirements — provenance/metadata (§200) and related-notes/backlinks (§206, §240) — are NOT headings and
// are deliberately NOT validated here; they are frontmatter and inline-link properties needing their own separate
// validation. Do not invent headings merely to raise the count to 11 or 12.
//
//   import { validateNoteStructure, REQUIRED_SECTIONS } from './noteStructure.mjs';
//   const r = validateNoteStructure(noteMarkdown);
//   if (!r.ok) throw new Error(`incomplete note — missing: ${r.missing.map((s) => s.label).join(', ')}`);

/**
 * The required section set (BUILD-002 §8/§10, as realised by the approved
 * `F247.template.youtube-transcript-knowledge-note` headings).
 *
 * `patterns` are alternatives tested against a NORMALISED heading (see `normaliseHeading`): a section counts as
 * present if ANY pattern matches. Each pattern is the minimal set of anchor terms that identifies that section
 * unambiguously inside a knowledge note, so that wording drift ("Claims & confidence" vs the contract §10's
 * "claims requiring verification") does not produce a false failure, while a genuinely absent section does fail.
 */
export const REQUIRED_SECTIONS = Object.freeze([
  {
    id: 'executive_orientation',
    label: 'Executive orientation',
    canonicalHeading: '## Executive orientation',
    patterns: [/\bexecutive\b.*\borientation\b/],
  },
  {
    id: 'source_reconstruction',
    label: 'Source reconstruction (what the source says)',
    canonicalHeading: '## What the source says',
    // Template wording, plus the contract's own vocabulary (§10 "structured knowledge brief").
    patterns: [/\bwhat the source says\b/, /\breconstruction\b/, /\bstructured knowledge brief\b/],
  },
  {
    id: 'mechanisms',
    label: 'Mechanisms, methods & implementation detail',
    canonicalHeading: '## Mechanisms, methods & implementation detail',
    patterns: [/\bmechanisms?\b/],
  },
  {
    id: 'tools_people_products',
    label: 'Tools, people, products & organisations',
    canonicalHeading: '## Tools, people, products & organisations',
    patterns: [/\btools\b/],
  },
  {
    id: 'examples',
    label: 'Examples & use cases',
    canonicalHeading: '## Examples & use cases',
    patterns: [/\bexamples?\b/, /\buse cases?\b/],
  },
  {
    id: 'claims_confidence',
    label: 'Claims & confidence',
    canonicalHeading: '## Claims & confidence',
    // "Claims" alone is not enough: the contract requires claims to be SEPARATED from verified fact and carry a
    // confidence, so the heading must name both the claims and the confidence/verification dimension.
    patterns: [/^(?=.*\bclaims?\b)(?=.*(\bconfidence\b|\bverif))/],
  },
  {
    id: 'caveats_gaps',
    label: 'Caveats & source gaps',
    canonicalHeading: '## Caveats & source gaps',
    patterns: [/\bcaveats?\b/, /\bgaps?\b/],
  },
  {
    id: 'fusion247_implications',
    label: 'What this means for Fusion247',
    canonicalHeading: '## What this means for Fusion247',
    // Naming Fusion247 is NOT enough. The contract requires the note to separate source content from Fusion247
    // *interpretation* (§205) and to carry Fusion247 *relevance* (§239) — so the heading must name both Fusion247
    // and the implication dimension. "## Fusion247 background" is a mention, not an implications section, and
    // must fail. Same two-anchor shape as `claims_confidence` above.
    patterns: [
      /^(?=.*(\bfusion ?247\b|\bf247\b))(?=.*(\bmeans\b|\bimplicat|\brelevance\b|\brelevant\b|\binterpretation\b|\bapplies\b|\bapplication\b))/,
    ],
  },
  {
    id: 'key_takeaways',
    label: 'Key concepts & takeaways',
    canonicalHeading: '## Key concepts & takeaways',
    patterns: [/\btakeaways?\b/, /\bkey concepts?\b/],
  },
  {
    id: 'actions_open_questions',
    label: 'Actions & open questions',
    canonicalHeading: '## Actions & open questions',
    patterns: [/\bactions?\b/, /\bopen questions?\b/],
  },
]);

/**
 * Reduce one raw heading line to comparable text.
 * Tolerates heading level (# … ######), closed ATX (`## X ##`), case, surrounding/among-word whitespace,
 * markdown emphasis, trailing punctuation, and `&` vs `and`.
 * @param {string} line
 * @returns {string} normalised heading text (lowercase)
 */
export function normaliseHeading(line) {
  return String(line)
    .replace(/^\s*#{1,6}\s*/, '')   // opening hashes
    .replace(/\s*#+\s*$/, '')       // closed-ATX trailing hashes
    .replace(/[*_`]/g, '')          // markdown emphasis / code ticks
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\s+/g, ' ')
    .replace(/[\s:;.,\-–—]+$/, '')  // trailing punctuation
    .trim();
}

const ATX_HEADING = /^\s{0,3}#{1,6}(\s|$)/;
const FENCE = /^\s{0,3}(`{3,}|~{3,})/;

/**
 * Collect the ATX headings of a markdown document, ignoring anything inside a fenced code block
 * (a fenced example of a heading is not a section of the note).
 * @param {string} markdown
 * @returns {{ line: number, raw: string, text: string }[]} 1-based line numbers
 */
export function extractHeadings(markdown) {
  const headings = [];
  let fence = null;
  const lines = String(markdown).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = line.match(FENCE);
    if (fenceMatch) {
      // CommonMark: a closing fence must use the SAME character and be AT LEAST AS LONG as the opening one.
      // Tracking only the character (Codex F2) let a ``` line close a ```` block, so headings in the remainder
      // of that block leaked out and counted as sections.
      const marker = fenceMatch[1][0];
      const len = fenceMatch[1].length;
      if (fence === null) fence = { marker, len };
      else if (fence.marker === marker && len >= fence.len) fence = null;
      continue;
    }
    if (fence !== null) continue;
    if (!ATX_HEADING.test(line)) continue;
    const text = normaliseHeading(line);
    if (text) headings.push({ line: i + 1, raw: line.trim(), text });
  }
  return headings;
}

/**
 * Validate that a knowledge-note markdown string carries every required section.
 *
 * @param {string} markdown the full knowledge note (frontmatter included is fine)
 * @returns {{
 *   ok: boolean,
 *   requiredCount: number,
 *   presentCount: number,
 *   missingCount: number,
 *   sections: { id: string, label: string, present: boolean, heading: string|null, line: number|null }[],
 *   present: { id: string, label: string, heading: string, line: number }[],
 *   missing: { id: string, label: string }[],
 *   missingIds: string[],
 *   headingCount: number
 * }}
 * @throws {TypeError} if `markdown` is not a string
 */
export function validateNoteStructure(markdown) {
  if (typeof markdown !== 'string') {
    throw new TypeError('validateNoteStructure requires a markdown string');
  }
  const headings = extractHeadings(markdown);

  // Each heading may satisfy AT MOST ONE required section (Codex F1). Without this, one broad heading such as
  // "## Tools, examples & mechanisms" satisfied three sections at once, so a three-heading note could pass a
  // ten-section gate. Sections are matched in canonical order and consume the first heading they claim, which
  // guarantees N distinct headings for N sections.
  const claimed = new Set();

  const sections = REQUIRED_SECTIONS.map((section) => {
    const hit = headings.find((h) => !claimed.has(h) && section.patterns.some((p) => p.test(h.text)));
    if (hit) claimed.add(hit);
    return {
      id: section.id,
      label: section.label,
      present: Boolean(hit),
      heading: hit ? hit.raw : null,
      line: hit ? hit.line : null,
    };
  });

  const present = sections.filter((s) => s.present)
    .map(({ id, label, heading, line }) => ({ id, label, heading, line }));
  const missing = sections.filter((s) => !s.present).map(({ id, label }) => ({ id, label }));

  return {
    ok: missing.length === 0,
    requiredCount: REQUIRED_SECTIONS.length,
    presentCount: present.length,
    missingCount: missing.length,
    sections,
    present,
    missing,
    missingIds: missing.map((s) => s.id),
    headingCount: headings.length,
  };
}

export default validateNoteStructure;
