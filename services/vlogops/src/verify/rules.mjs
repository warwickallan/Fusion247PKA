// BUILD-006 Phase 4 — the five dimensions, as pure functions over a materialised package.
//
// ── WHY ALL FIVE ARE IN ONE FILE ────────────────────────────────────────────────────────────
// The rest of this service is a module per concern and this file is the deliberate exception. A
// ruleset is read top to bottom by a human deciding whether they agree with it — that is what
// Wayfinder §9.1 rung 1 means when it says human-facing work is reviewed from source first — and
// splitting five short rulesets across five files buys separation nobody needs at the cost of the
// one property that matters here: you can see the whole of what the verifier believes at once.
//
// Every function here is PURE. No database, no filesystem, no clock, no randomness. They take a
// materialised view of one package and return findings. That is what makes a verdict reproducible
// from the same rows on any machine, and what lets these rules be proven without a database even
// though the package they judge only ever comes from one.
//
// ── WHAT EVERY DIMENSION OWES ───────────────────────────────────────────────────────────────
// A verdict AND its coverage. A dimension that answers `pass` having examined nothing is the
// exact defect this estate keeps meeting — a control reporting on ground it did not look at is
// worse than no control, because an absent control invites caution and a lying one invites
// confidence. So each returns what it actually examined, and that number is stored on the run.
//
// The rules themselves are documented for humans in src/verify/contract/verification-v1.md, whose
// bytes are hashed into the identity of every run. If you change a rule here, change it there.

import { SCRIBE_SIBLINGS } from '../config.mjs';
import {
  QUOTED_SPAN_MIN_CHARS,
  extractFactTokens,
  extractQuotedSpans,
  flatten,
  scanPrivatePatterns,
  tokenIsGrounded,
} from './text.mjs';

/** Long-form siblings. XF-3 holds these two to the same spine; the other two are selective. */
export const LONG_FORM_SIBLINGS = Object.freeze(['script', 'blog']);

/** Privacy states that carry a rank. `unclassified` is not a rank — it is an unknown. */
const PRIVACY_RANK = { public: 0, internal: 1, private: 2, restricted: 3 };

/** Provenance systems that settle a rights basis without a human. RIGHT-1. */
const ESTATE_SOURCE_SYSTEMS = Object.freeze(['git', 'repository', 'fusion247']);

/** Bases under which a long quotation raises no extent question. RIGHT-4. */
const UNRESTRICTED_BASES = Object.freeze(['estate-owned', 'public-domain']);

/** Above this many characters, a quotation from material that is not ours is a rights question. */
export const QUOTE_EXTENT_MAX_CHARS = 300;

function finding(dimension, severity, rule, detail, locator = {}, evidence = {}) {
  return {
    dimension,
    severity,
    rule,
    detail,
    claim_id: locator.claim_id ?? null,
    sibling: locator.sibling ?? null,
    segment_ordinal: locator.segment_ordinal ?? null,
    source_ref: locator.source_ref ?? null,
    evidence,
  };
}

/** The flattened frozen bytes of one entry, or null when they were never stored inline. */
function evidenceTextOf(view, sourceRef) {
  const entry = view.entries.get(sourceRef);
  if (entry === undefined || entry.text === null) return null;
  return flatten(entry.text);
}

/**
 * The union of the evidence a master claim rests on — its cited entries' bytes AND their
 * source_refs.
 *
 * The source_ref belongs in here on purpose. Naming your source is a citation, not a factual
 * assertion, so a claim that says "the record at 2026-08-05-something.md" must not be asked to
 * find "2026-08-05" inside that file's contents. Without this the dimension would report a
 * factual error every time a package mentioned what it was citing.
 */
function groundingTextFor(view, sourceRefs) {
  const parts = [];
  for (const ref of sourceRefs) {
    parts.push(flatten(ref));
    const text = evidenceTextOf(view, ref);
    if (text !== null) parts.push(text);
  }
  // Plus the NAMES of every entry in this package's own pack. A package that says "from
  // 2026-08-05-foo.md to 2026-08-11-bar.md" is naming its evidence set, not asserting two dates
  // about the world, and the second of those names belongs to an entry it may not have cited on
  // that particular claim. Without this the dimension reports a factual error every time a
  // package describes the span of its own evidence.
  //
  // The cost is declared in the ruleset: a number that happens to appear in the NAME of a pack
  // entry is treated as grounded. In this estate those names are dated slugs, so what it
  // whitelists is dates that are genuinely part of the evidence set.
  parts.push(view.packRefsText);
  return parts.join(' \n ');
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// DIMENSION 1 — FACT
//
// ⛔ THIS IS NOT A FACT-CHECKER AND MUST NEVER BE DESCRIBED AS ONE. ⛔
//
// It cannot read a sentence and decide whether the world is like that. What it does is take the
// classes of assertion that ARE mechanically checkable against frozen bytes — numbers of two or
// more digits, money, percentages, dates and times — and establish that each one appears in the
// evidence the claim itself cites. Then it reports how much of the package that covered.
//
// A rhetorical falsehood carrying no number passes this dimension untouched. "This was the moment
// everything changed" is not checkable against bytes and nothing here pretends otherwise. A pass
// from FACT means the checkable tokens were grounded over the coverage reported — never that the
// package is true.
// ═══════════════════════════════════════════════════════════════════════════════════════════
export function checkFact(view) {
  const findings = [];
  let claimsWithTokens = 0;
  let segmentsWithTokens = 0;
  let tokensChecked = 0;

  for (const claim of view.claims) {
    const tokens = extractFactTokens(claim.text);
    if (tokens.length === 0) continue;
    claimsWithTokens += 1;

    const grounding = groundingTextFor(view, claim.citations);
    for (const token of tokens) {
      tokensChecked += 1;
      if (tokenIsGrounded(token, grounding)) continue;
      findings.push(finding(
        'fact', 'block', 'FACT-1',
        `master claim "${claim.claim_id}" asserts ${token.kind} "${token.raw}", which appears in `
        + `none of the ${claim.citations.length} evidence entr${claim.citations.length === 1 ? 'y' : 'ies'} it cites`,
        { claim_id: claim.claim_id },
        { token: token.raw, kind: token.kind, cited: claim.citations },
      ));
    }
  }

  const citationsByClaim = new Map(view.claims.map((c) => [c.claim_id, c.citations]));

  for (const seg of view.segments) {
    const tokens = extractFactTokens(seg.text);
    if (tokens.length === 0) continue;
    segmentsWithTokens += 1;

    // Deliberately the more generous of the two. A segment adapts a master claim, and that claim
    // may rest on several entries; demanding that the segment's own single citation carry every
    // number would fail correct drafts. It still cannot reach outside its master's evidence.
    const refs = citationsByClaim.get(seg.claim_id) ?? [seg.source_ref];
    const grounding = groundingTextFor(view, new Set([seg.source_ref, ...refs]));

    for (const token of tokens) {
      tokensChecked += 1;
      if (tokenIsGrounded(token, grounding)) continue;
      findings.push(finding(
        'fact', 'block', 'FACT-2',
        `${seg.sibling}[${seg.ordinal}] asserts ${token.kind} "${token.raw}", which appears in `
        + `none of the evidence its master claim "${seg.claim_id}" rests on`,
        { sibling: seg.sibling, segment_ordinal: seg.ordinal, claim_id: seg.claim_id, source_ref: seg.source_ref },
        { token: token.raw, kind: token.kind, cited: [...new Set([seg.source_ref, ...refs])] },
      ));
    }
  }

  return {
    findings,
    coverage: {
      claims_total: view.claims.length,
      claims_carrying_checkable_tokens: claimsWithTokens,
      claims_not_mechanically_checkable: view.claims.length - claimsWithTokens,
      segments_total: view.segments.length,
      segments_carrying_checkable_tokens: segmentsWithTokens,
      segments_not_mechanically_checkable: view.segments.length - segmentsWithTokens,
      tokens_checked: tokensChecked,
      note: 'Checkable = number (2+ digits), currency, percentage, date or time, grounded against '
        + 'the cited evidence. Text carrying none of those was NOT examined by this dimension.',
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// DIMENSION 2 — QUOTATION
//
// A quoted passage must match the evidence it cites. The comparison is exact after the declared
// normalisation, so a near-quote is a finding rather than a pass — that is the dimension most
// likely to be quietly softened, and softening it is what turns "he said X" into "he roughly said
// something like X" with a citation attached.
//
// QUOT-2 is the one that matters most. Where the cited entry's bytes were never stored inline,
// the quotation COULD NOT BE CHECKED — and an unchecked quotation is an unanswered question, not
// a pass.
// ═══════════════════════════════════════════════════════════════════════════════════════════
export function checkQuotation(view) {
  const findings = [];
  let spansFound = 0;
  let spansChecked = 0;
  let spansUncheckable = 0;

  const citationsByClaim = new Map(view.claims.map((c) => [c.claim_id, c.citations]));

  const inspect = (text, refs, locator, where) => {
    for (const span of extractQuotedSpans(text)) {
      spansFound += 1;

      const checkable = [...refs].filter((r) => evidenceTextOf(view, r) !== null);
      if (checkable.length === 0) {
        spansUncheckable += 1;
        findings.push(finding(
          'quotation', 'surface', 'QUOT-2',
          `${where} carries a ${span.length}-character quotation, and none of the entries it cites `
          + 'stored its bytes inline — so the quotation could not be checked at all',
          locator,
          { quoted_length: span.length, cited: [...refs] },
        ));
        continue;
      }

      spansChecked += 1;
      const matched = checkable.some((r) => evidenceTextOf(view, r).includes(span.text));
      if (matched) continue;

      findings.push(finding(
        'quotation', 'block', 'QUOT-1',
        `${where} quotes ${span.length} characters that do not appear in the evidence it cites. `
        + 'A near-quote is a finding, not a pass.',
        locator,
        { quoted_length: span.length, quoted_head: span.text.slice(0, 60), cited: checkable },
      ));
    }
  };

  for (const claim of view.claims) {
    inspect(claim.text, claim.citations, { claim_id: claim.claim_id }, `master claim "${claim.claim_id}"`);
  }

  for (const seg of view.segments) {
    const refs = new Set([seg.source_ref, ...(citationsByClaim.get(seg.claim_id) ?? [])]);
    inspect(
      seg.text, refs,
      { sibling: seg.sibling, segment_ordinal: seg.ordinal, claim_id: seg.claim_id, source_ref: seg.source_ref },
      `${seg.sibling}[${seg.ordinal}]`,
    );
  }

  return {
    findings,
    coverage: {
      quoted_spans_found: spansFound,
      quoted_spans_checked: spansChecked,
      quoted_spans_uncheckable: spansUncheckable,
      minimum_span_chars: QUOTED_SPAN_MIN_CHARS,
      note: `A delimited span under ${QUOTED_SPAN_MIN_CHARS} characters is not treated as a `
        + 'quotation. That floor is a declared false negative — see the ruleset.',
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// DIMENSION 3 — PRIVACY
//
// Provenance first, text second. Phase 1 already carries privacy_state on every seed and every
// snapshot, and Wayfinder §7 says verification must be able to block on it — so the primary rule
// is a JOIN, not a heuristic. The pattern scan is a second net for detail that leaked into prose
// from a source nobody classified as sensitive.
//
// PRIV-3 will fire often, and that is the point: Phase 1's promote and supplied routes accept a
// seed with no --privacy and store it `unclassified`. Packages built on those raise PRIV-3 every
// time. That is a real defect becoming visible through the dimension built to see it, and it must
// NEVER be papered over by treating `unclassified` as `public`.
// ═══════════════════════════════════════════════════════════════════════════════════════════
export function checkPrivacy(view) {
  const findings = [];
  const citedRefs = view.citedSourceRefs;
  const quotedRefs = view.quotedSourceRefs;
  let unclassified = 0;
  let restricted = 0;

  for (const ref of citedRefs) {
    const entry = view.entries.get(ref);
    if (entry === undefined) continue;

    const states = [entry.seedPrivacy, entry.snapshotPrivacy];
    const known = states.filter((s) => s !== 'unclassified' && s in PRIVACY_RANK);
    const maxRank = known.length === 0 ? -1 : Math.max(...known.map((s) => PRIVACY_RANK[s]));
    const effective = known.length === 0
      ? 'unclassified'
      : Object.keys(PRIVACY_RANK).find((k) => PRIVACY_RANK[k] === maxRank);
    const hasUnknown = states.includes('unclassified');

    if (maxRank >= PRIVACY_RANK.private) {
      restricted += 1;
      findings.push(finding(
        'privacy', 'block', 'PRIV-1',
        `the package cites "${ref}", whose effective privacy state is "${effective}" — material `
        + 'classified private or restricted does not leave the estate',
        { source_ref: ref },
        { seed_privacy: entry.seedPrivacy, snapshot_privacy: entry.snapshotPrivacy, effective },
      ));
    } else if (hasUnknown) {
      unclassified += 1;
      findings.push(finding(
        'privacy', 'surface', 'PRIV-3',
        `the package cites "${ref}", which nobody has classified — it is stored "unclassified". `
        + 'This machinery will not decide what that material is.',
        { source_ref: ref },
        { seed_privacy: entry.seedPrivacy, snapshot_privacy: entry.snapshotPrivacy },
      ));
    }

    if (maxRank === PRIVACY_RANK.internal && quotedRefs.has(ref)) {
      findings.push(finding(
        'privacy', 'block', 'PRIV-2',
        `"${ref}" is classified internal and its words are QUOTED into a sibling. Resting a claim `
        + 'on internal material is fine; publishing its words is the act.',
        { source_ref: ref },
        { seed_privacy: entry.seedPrivacy, snapshot_privacy: entry.snapshotPrivacy },
      ));
    }
  }

  // The second net: publishable text, scanned for the closed pattern list. The MATCH IS NEVER
  // STORED — a privacy finding that copied the offending value into another table would have
  // spread exactly what it exists to stop.
  let textsScanned = 0;
  const scan = (text, locator, where) => {
    textsScanned += 1;
    for (const hit of scanPrivatePatterns(text)) {
      findings.push(finding(
        'privacy', 'block', hit.rule,
        `${where} contains a ${hit.rule.split('/')[1]} — ${hit.length} characters, shown masked as `
        + `"${hit.redacted}". The value is deliberately not recorded here.`,
        locator,
        { pattern: hit.rule, matched_length: hit.length, masked: hit.redacted },
      ));
    }
  };

  for (const claim of view.claims) {
    scan(claim.text, { claim_id: claim.claim_id }, `master claim "${claim.claim_id}"`);
  }
  for (const seg of view.segments) {
    scan(
      seg.text,
      { sibling: seg.sibling, segment_ordinal: seg.ordinal, claim_id: seg.claim_id },
      `${seg.sibling}[${seg.ordinal}]`,
    );
  }

  return {
    findings,
    coverage: {
      cited_sources: citedRefs.size,
      sources_unclassified: unclassified,
      sources_private_or_restricted: restricted,
      publishable_texts_scanned: textsScanned,
      note: 'Privacy is derived from the stored privacy_state of the seed and each snapshot, then '
        + 'a closed pattern list is applied to publishable text. There is no general heuristic.',
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// DIMENSION 4 — RIGHTS
//
// Before this ruleset the honest answer about every source was "unknown", and a dimension that
// answers unknown about everything is a wall rather than a control — it would score identically
// if it refused every package ever built. RIGHT-1 is what stops that: where the provenance
// genuinely settles the question, the basis is derived, and the derivation is RECORDED AS SUCH.
//
// `warwick-supplied` is never derivable, and that is the most important line in this dimension.
// Pasted text is the class that can actually carry someone else's words.
// ═══════════════════════════════════════════════════════════════════════════════════════════
export function resolveRights(entry) {
  if (entry.rights !== null && entry.rights !== undefined) {
    return { basis: entry.rights.basis, basis_source: entry.rights.basis_source, holder: entry.rights.holder ?? null };
  }
  const system = entry.provenance?.source_system ?? null;
  if (ESTATE_SOURCE_SYSTEMS.includes(system)) {
    return { basis: 'estate-owned', basis_source: 'derived-from-provenance', holder: null };
  }
  return { basis: null, basis_source: null, holder: null };
}

export function checkRights(view) {
  const findings = [];
  let declared = 0;
  let derived = 0;
  let unknown = 0;

  for (const ref of view.citedSourceRefs) {
    const entry = view.entries.get(ref);
    if (entry === undefined) continue;

    const rights = resolveRights(entry);

    if (rights.basis === null) {
      unknown += 1;
      const system = entry.provenance?.source_system ?? 'unrecorded';
      findings.push(finding(
        'rights', 'surface', 'RIGHT-3',
        `no rights basis is declared for "${ref}" (source_system "${system}") and none is `
        + 'derivable. Supplied material is never presumed to be Warwick\'s.',
        { source_ref: ref },
        { source_system: system },
      ));
    } else if (rights.basis_source === 'declared') {
      declared += 1;
    } else {
      derived += 1;
    }

    if (rights.basis === 'third-party-unlicensed') {
      findings.push(finding(
        'rights', 'block', 'RIGHT-2',
        `"${ref}" is declared third-party-unlicensed${rights.holder ? ` (holder: ${rights.holder})` : ''} `
        + 'and cannot be published as-is',
        { source_ref: ref },
        { basis: rights.basis, holder: rights.holder },
      ));
    }

    // RIGHT-5 — a media asset with no DECLARED basis. A derived basis is not enough here:
    // Wayfinder §7 asks for rights and provenance on every media asset explicitly, and a
    // provenance-derived guess is not a rights record for something that will be republished.
    const isText = typeof entry.media_type === 'string' && entry.media_type.startsWith('text/');
    if (!isText && rights.basis_source !== 'declared') {
      findings.push(finding(
        'rights', 'surface', 'RIGHT-5',
        `"${ref}" is a ${entry.media_type} asset with no DECLARED rights basis. Media carries `
        + 'rights and provenance of its own.',
        { source_ref: ref },
        { media_type: entry.media_type, resolved_basis: rights.basis, basis_source: rights.basis_source },
      ));
    }
  }

  // RIGHT-4 — extent. A long quotation from material that is not ours is a rights question even
  // when the quotation itself is perfectly accurate.
  let longQuotes = 0;
  const inspect = (text, refs, locator, where) => {
    for (const span of extractQuotedSpans(text)) {
      if (span.length <= QUOTE_EXTENT_MAX_CHARS) continue;
      for (const ref of refs) {
        const entry = view.entries.get(ref);
        if (entry === undefined) continue;
        const basis = resolveRights(entry).basis;
        if (basis !== null && UNRESTRICTED_BASES.includes(basis)) continue;
        longQuotes += 1;
        findings.push(finding(
          'rights', 'block', 'RIGHT-4',
          `${where} quotes ${span.length} characters from "${ref}", whose basis is `
          + `"${basis ?? 'undeclared'}". Extent is the part of a quotation a rights holder cares about.`,
          { ...locator, source_ref: ref },
          { quoted_length: span.length, limit: QUOTE_EXTENT_MAX_CHARS, basis },
        ));
        break;
      }
    }
  };

  const citationsByClaim = new Map(view.claims.map((c) => [c.claim_id, c.citations]));
  for (const claim of view.claims) {
    inspect(claim.text, claim.citations, { claim_id: claim.claim_id }, `master claim "${claim.claim_id}"`);
  }
  for (const seg of view.segments) {
    inspect(
      seg.text, [seg.source_ref, ...(citationsByClaim.get(seg.claim_id) ?? [])],
      { sibling: seg.sibling, segment_ordinal: seg.ordinal },
      `${seg.sibling}[${seg.ordinal}]`,
    );
  }

  return {
    findings,
    coverage: {
      cited_sources: view.citedSourceRefs.size,
      basis_declared: declared,
      basis_derived_from_provenance: derived,
      basis_unknown: unknown,
      over_extent_quotations: longQuotes,
      note: 'A derived basis is an inference from frozen provenance and is recorded as such, never '
        + 'as a declaration. `warwick-supplied` is never derivable.',
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// DIMENSION 5 — CROSS-FORMAT CONSISTENCY
//
// THE SPINE IS THE MASTER NARRATIVE, NOT THE SCRIPT. Wayfinder §5: "The Master Story Package is
// one canonical creative truth with sibling adaptations", and "the video and blog cannot drift
// into unrelated claims". Treating the script as authoritative would make the video's adaptation
// choices silently outrank the canonical truth, which inverts the design.
//
// ⛔ AND THIS DIMENSION CHECKS ONLY WHAT THE SCHEMA CANNOT. ⛔
// db/003's `story_segment_cites_its_master` foreign key already makes "a sibling asserts something
// its master does not" UNWRITABLE. Re-checking that here would be a control that cannot fail —
// precisely the defect this Work Package exists to answer. What is left, and is genuinely
// FK-legal, is OMISSION and ASYMMETRY: a beat nobody tells, or a beat one long-form sibling
// carries and the other drops.
// ═══════════════════════════════════════════════════════════════════════════════════════════
export function checkCrossFormat(view) {
  const findings = [];

  const bySibling = new Map(SCRIBE_SIBLINGS.map((s) => [s, new Set()]));
  for (const seg of view.segments) {
    if (!bySibling.has(seg.sibling)) bySibling.set(seg.sibling, new Set());
    bySibling.get(seg.sibling).add(seg.claim_id);
  }

  for (const sibling of SCRIBE_SIBLINGS) {
    if (bySibling.get(sibling).size === 0) {
      findings.push(finding(
        'cross-format', 'block', 'XF-1',
        `the package carries no "${sibling}" segments at all. A package carries all four siblings.`,
        { sibling },
        { siblings_present: [...bySibling].filter(([, v]) => v.size > 0).map(([k]) => k) },
      ));
    }
  }

  const beats = view.claims.filter((c) => c.kind === 'beat');

  for (const beat of beats) {
    const carriers = SCRIBE_SIBLINGS.filter((s) => bySibling.get(s).has(beat.claim_id));

    if (carriers.length === 0) {
      findings.push(finding(
        'cross-format', 'block', 'XF-2',
        `the master asserts beat "${beat.claim_id}" and no sibling tells it. The master says `
        + 'something no format carries.',
        { claim_id: beat.claim_id },
        { beat_text_head: beat.text.slice(0, 80) },
      ));
      continue;
    }

    const longForm = LONG_FORM_SIBLINGS.filter((s) => bySibling.get(s).has(beat.claim_id));
    if (longForm.length === 1) {
      const missing = LONG_FORM_SIBLINGS.find((s) => !bySibling.get(s).has(beat.claim_id));
      findings.push(finding(
        'cross-format', 'block', 'XF-3',
        `beat "${beat.claim_id}" is carried by the ${longForm[0]} and dropped by the ${missing}. `
        + 'The two long-form siblings must carry the same spine — that is what stops the video and '
        + 'the blog drifting into different stories.',
        { claim_id: beat.claim_id, sibling: missing },
        { carried_by: carriers, dropped_by: missing },
      ));
    }
  }

  return {
    findings,
    coverage: {
      siblings_present: SCRIBE_SIBLINGS.filter((s) => bySibling.get(s).size > 0).length,
      siblings_expected: SCRIBE_SIBLINGS.length,
      beats_total: beats.length,
      beats_checked_for_parity: beats.length,
      narrative_claims_exempt: view.claims.filter((c) => c.kind === 'narrative-claim').length,
      note: 'Beats are the spine and are checked for coverage and long-form parity. Narrative '
        + 'claims are supporting detail and are exempt; titles and thumbnail direction are '
        + 'selective by nature and exempt from parity.',
    },
  };
}

/** The five, in the order the ruleset documents them. */
export const DIMENSIONS = Object.freeze([
  { name: 'fact', check: checkFact },
  { name: 'quotation', check: checkQuotation },
  { name: 'privacy', check: checkPrivacy },
  { name: 'rights', check: checkRights },
  { name: 'cross-format', check: checkCrossFormat },
]);
