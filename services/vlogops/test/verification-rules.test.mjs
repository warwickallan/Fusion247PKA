// BUILD-006 Phase 4 — every rule, made to fire AND made to stay quiet.
//
// ⛔ THE SHAPE OF THIS FILE IS THE POINT ⛔
// Every rule below is proven TWICE: once on input that should raise it, and once on input that
// should not. A rule only ever observed refusing is indistinguishable from a rule that refuses
// everything, and a constraint set that would score identically had it blocked every package is
// not a control — it is a wall with a report attached. Phase 3's reviewer made exactly this point
// and it is now the standing expectation for anything built here.
//
// These proofs are PURE — no database. The rules are pure functions of a materialised view, which
// is precisely so that the whole ruleset can be exercised at this granularity without a cluster.
// The end-to-end proof that the same rules fire against REAL stored rows from the real chain is
// verification-made-to-fail.test.mjs, and neither file substitutes for the other.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  QUOTE_EXTENT_MAX_CHARS, checkCrossFormat, checkFact, checkPrivacy, checkQuotation, checkRights,
  resolveRights,
} from '../src/verify/rules.mjs';
import {
  BARE_NUMBER_MIN_DIGITS, QUOTED_SPAN_MIN_CHARS, extractFactTokens, extractQuotedSpans, redact,
  scanPrivatePatterns,
} from '../src/verify/text.mjs';
import { runDimensions, verificationIdentity, buildVerificationManifest } from '../src/verify/verifier.mjs';
import { loadRuleset, CURRENT_RULESET_VERSION } from '../src/verify/ruleset.mjs';

const PACKAGE_ID = 'c'.repeat(64);

/** A minimal but STRUCTURALLY HONEST view — the same shape store.mjs materialises. */
function makeView({
  claims = [], segments = [], entries = [], packRefs = null,
} = {}) {
  const entryMap = new Map();
  for (const e of entries) {
    entryMap.set(e.source_ref, {
      source_ref: e.source_ref,
      ordinal: e.ordinal ?? 0,
      media_type: e.media_type ?? 'text/markdown',
      byte_length: e.byte_length ?? 0,
      content_sha256: e.content_sha256 ?? 'd'.repeat(64),
      provenance: e.provenance ?? { source_system: 'repository' },
      text: e.text === undefined ? '' : e.text,
      snapshotPrivacy: e.snapshotPrivacy ?? 'internal',
      seedPrivacy: e.seedPrivacy ?? 'internal',
      rights: e.rights ?? null,
    });
  }

  const cited = new Set();
  for (const c of claims) for (const r of c.citations) cited.add(r);
  for (const s of segments) cited.add(s.source_ref);

  const quoted = new Set();
  for (const s of segments) {
    if (extractQuotedSpans(s.text).length === 0) continue;
    quoted.add(s.source_ref);
    const master = claims.find((c) => c.claim_id === s.claim_id);
    for (const r of master?.citations ?? []) quoted.add(r);
  }

  return {
    packageId: PACKAGE_ID,
    packId: 'e'.repeat(64),
    seedId: 'f'.repeat(64),
    packRefsText: packRefs === null ? [...entryMap.keys()].join(' ') : packRefs.join(' '),
    claims,
    segments,
    entries: entryMap,
    citedSourceRefs: cited,
    quotedSourceRefs: quoted,
  };
}

const claim = (id, text, citations, kind = 'beat', ordinal = 0) => ({
  claim_id: id, kind, ordinal, text, citations,
});
const segment = (sibling, ordinal, text, claim_id, source_ref) => ({
  sibling, ordinal, role: 'unit', text, claim_id, source_ref,
});

const rulesOf = (findings) => findings.map((f) => f.rule);

// ═════════════════════════════════════════════════════════════════════════════════════════
// The extractors — the floors are declared, so they are proven
// ═════════════════════════════════════════════════════════════════════════════════════════

test('an APOSTROPHE is not a quotation mark', () => {
  const prose = "it is not written in anybody's voice, and it doesn't pretend to be anything else at all";
  assert.deepEqual(extractQuotedSpans(prose), [],
    'a contraction was extracted as a quoted passage — this is how a checker earns the reputation that gets it switched off');

  const quoted = `the record says "${'a genuine quotation long enough to clear the floor exactly'}" and then stops`;
  assert.equal(extractQuotedSpans(quoted).length, 1, 'a real quotation was not extracted');
});

test('a delimited span under the floor is not a quotation, and one over it is', () => {
  const short = 'the word "brief" is emphasis, not a quotation';
  assert.deepEqual(extractQuotedSpans(short), []);

  const long = `"${'x'.repeat(QUOTED_SPAN_MIN_CHARS)}"`;
  assert.equal(extractQuotedSpans(long).length, 1);
});

test('single digits are not factual assertions; two digits, money, dates and times are', () => {
  assert.deepEqual(extractFactTokens('the 3rd beat of 4 in total').map((t) => t.raw), [],
    `a bare integer under ${BARE_NUMBER_MIN_DIGITS} digits was treated as a factual assertion`);

  const tokens = extractFactTokens('on 2026-08-13 at 14:30 it cost £3 and rose 57.7% across 185 files');
  const kinds = tokens.map((t) => t.kind).sort();
  assert.deepEqual(kinds, ['currency', 'date-iso', 'number', 'percentage', 'time'].sort(),
    `expected one of each checkable kind, got ${JSON.stringify(tokens.map((t) => [t.kind, t.raw]))}`);
});

test('a private-detail match is REDACTED and its value is never returned', () => {
  const hits = scanPrivatePatterns('write to not.a.real.person@example.invalid about it');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].rule, 'PRIV-4/email');
  assert.ok(!hits[0].redacted.includes('real.person'), 'the finding carried the value it exists to suppress');
  assert.equal(redact('abcdef'), 'a****f');
});

test('a long digit run that fails Luhn is NOT reported as a card number', () => {
  assert.deepEqual(scanPrivatePatterns('build 1234567890123456 completed').map((h) => h.rule), [],
    'a non-Luhn digit run was reported as a payment card; a pattern that cries wolf gets switched off');
  assert.deepEqual(scanPrivatePatterns('the number 4111111111111111 appeared').map((h) => h.rule),
    ['PRIV-4/card-number']);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// FACT
// ═════════════════════════════════════════════════════════════════════════════════════════

test('FACT-1 fires on a number the cited evidence does not carry, and stays quiet when it does', () => {
  const entries = [{ source_ref: 'repo:notes.md', text: 'the compiler admitted 12 of 185 candidates' }];

  const wrong = checkFact(makeView({
    claims: [claim('beat-1', 'the compiler admitted 12 of 999417 candidates', ['repo:notes.md'])],
    entries,
  }));
  assert.deepEqual(rulesOf(wrong.findings), ['FACT-1']);
  assert.match(wrong.findings[0].detail, /999417|999,417/);

  const right = checkFact(makeView({
    claims: [claim('beat-1', 'the compiler admitted 12 of 185 candidates', ['repo:notes.md'])],
    entries,
  }));
  assert.deepEqual(right.findings, [], 'FACT-1 fired on a claim its evidence supports');
});

test('FACT grounds a token that names an evidence entry, rather than calling it a factual error', () => {
  const view = makeView({
    claims: [claim('beat-1', 'from 2026-08-05-first.md to 2026-08-11-last.md', ['repo:2026-08-05-first.md'])],
    entries: [
      { source_ref: 'repo:2026-08-05-first.md', text: 'no dates inside this file at all' },
      { source_ref: 'repo:2026-08-11-last.md', text: 'nor in this one' },
    ],
  });
  assert.deepEqual(checkFact(view).findings, [],
    'naming the span of its own evidence was reported as a factual error');
});

test('FACT reports COVERAGE, including what it did not examine', () => {
  const result = checkFact(makeView({
    claims: [
      claim('beat-1', 'this window mattered a great deal', ['repo:a.md']),
      claim('beat-2', 'there were 42 of them', ['repo:a.md'], 'beat', 1),
    ],
    entries: [{ source_ref: 'repo:a.md', text: 'there were 42 of them' }],
  }));
  assert.equal(result.coverage.claims_total, 2);
  assert.equal(result.coverage.claims_carrying_checkable_tokens, 1);
  assert.equal(result.coverage.claims_not_mechanically_checkable, 1,
    'the dimension did not report the claim it could not check — a pass over unexamined ground');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// QUOTATION
// ═════════════════════════════════════════════════════════════════════════════════════════

test('QUOT-1 accepts an exact quotation and refuses a NEAR MISS', () => {
  const source = 'The identity of a pack is a pure function of its content, and nothing else.';
  const entries = [{ source_ref: 'repo:a.md', text: `preamble\n${source}\ntrailer` }];
  const master = claim('beat-1', 'a beat', ['repo:a.md']);

  const exact = checkQuotation(makeView({
    claims: [master], segments: [segment('script', 0, `He wrote: "${source}"`, 'beat-1', 'repo:a.md')], entries,
  }));
  assert.deepEqual(exact.findings, [], 'an exact quotation was reported as a misquotation');
  assert.equal(exact.coverage.quoted_spans_checked, 1);

  const near = source.replace('pure function', 'rough function');
  const missed = checkQuotation(makeView({
    claims: [master], segments: [segment('script', 0, `He wrote: "${near}"`, 'beat-1', 'repo:a.md')], entries,
  }));
  assert.deepEqual(rulesOf(missed.findings), ['QUOT-1'], 'a near-quote passed as a quotation');
});

test('QUOT-1 tolerates re-wrapping and NOTHING else', () => {
  const entries = [{ source_ref: 'repo:a.md', text: 'a passage that was\noriginally wrapped across two lines' }];
  const result = checkQuotation(makeView({
    claims: [claim('beat-1', 'a beat', ['repo:a.md'])],
    segments: [segment('script', 0, '"a passage that was originally wrapped across two lines"', 'beat-1', 'repo:a.md')],
    entries,
  }));
  assert.deepEqual(result.findings, [], 'a re-wrapped quotation was reported as a misquotation');
});

test('QUOT-2 SURFACES an unverifiable quotation rather than passing it', () => {
  const result = checkQuotation(makeView({
    claims: [claim('beat-1', 'a beat', ['repo:a.md'])],
    segments: [segment('script', 0, `"${'y'.repeat(60)}"`, 'beat-1', 'repo:a.md')],
    // content_url only: Phase 1 permits a snapshot whose bytes were never stored inline.
    entries: [{ source_ref: 'repo:a.md', text: null }],
  }));
  assert.deepEqual(rulesOf(result.findings), ['QUOT-2']);
  assert.equal(result.findings[0].severity, 'surface');
  assert.equal(result.coverage.quoted_spans_uncheckable, 1);
  assert.equal(result.coverage.quoted_spans_checked, 0,
    'an unverifiable quotation was counted as checked — the exact false green this rule exists to stop');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// PRIVACY
// ═════════════════════════════════════════════════════════════════════════════════════════

test('PRIV-1 blocks private and restricted material; public and internal pass', () => {
  const withState = (snapshotPrivacy) => checkPrivacy(makeView({
    claims: [claim('beat-1', 'a beat', ['repo:a.md'])],
    entries: [{ source_ref: 'repo:a.md', snapshotPrivacy, seedPrivacy: 'public', text: 'words' }],
  }));

  assert.deepEqual(rulesOf(withState('private').findings), ['PRIV-1']);
  assert.deepEqual(rulesOf(withState('restricted').findings), ['PRIV-1']);
  assert.deepEqual(withState('public').findings, [], 'PRIV-1 fired on public material');
  assert.deepEqual(withState('internal').findings, [], 'PRIV-1 fired on unquoted internal material');
});

test('PRIV-1 takes the STRICTER of the seed and the snapshot', () => {
  const result = checkPrivacy(makeView({
    claims: [claim('beat-1', 'a beat', ['repo:a.md'])],
    entries: [{ source_ref: 'repo:a.md', snapshotPrivacy: 'public', seedPrivacy: 'restricted', text: 'words' }],
  }));
  assert.deepEqual(rulesOf(result.findings), ['PRIV-1'],
    'a public snapshot inside a restricted seed was treated as publishable');
});

test('PRIV-2 blocks internal material only when its WORDS are quoted', () => {
  const entries = [{ source_ref: 'repo:a.md', snapshotPrivacy: 'internal', seedPrivacy: 'internal', text: `x ${'z'.repeat(60)} y` }];
  const master = claim('beat-1', 'a beat', ['repo:a.md']);

  const rested = checkPrivacy(makeView({
    claims: [master], segments: [segment('blog', 0, 'an ordinary paragraph', 'beat-1', 'repo:a.md')], entries,
  }));
  assert.deepEqual(rested.findings, [], 'PRIV-2 fired on internal material that was merely cited');

  const quoted = checkPrivacy(makeView({
    claims: [master], segments: [segment('blog', 0, `"${'z'.repeat(60)}"`, 'beat-1', 'repo:a.md')], entries,
  }));
  assert.deepEqual(rulesOf(quoted.findings), ['PRIV-2']);
});

test('PRIV-3 SURFACES unclassified material and never treats it as public', () => {
  const result = checkPrivacy(makeView({
    claims: [claim('beat-1', 'a beat', ['repo:a.md'])],
    entries: [{ source_ref: 'repo:a.md', snapshotPrivacy: 'unclassified', seedPrivacy: 'unclassified', text: 'words' }],
  }));
  assert.deepEqual(rulesOf(result.findings), ['PRIV-3']);
  assert.equal(result.findings[0].severity, 'surface');
});

test('PRIV-4 blocks a private detail in publishable text and does not fire on ordinary prose', () => {
  const view = (text) => makeView({
    claims: [claim('beat-1', 'a beat', ['repo:a.md'])],
    segments: [segment('blog', 0, text, 'beat-1', 'repo:a.md')],
    entries: [{ source_ref: 'repo:a.md', snapshotPrivacy: 'public', seedPrivacy: 'public', text: 'words' }],
  });

  const hit = checkPrivacy(view('reach the household at not.a.real.person@example.invalid'));
  assert.deepEqual(rulesOf(hit.findings), ['PRIV-4/email']);
  assert.ok(!JSON.stringify(hit.findings).includes('not.a.real.person'),
    'the finding recorded the private value it exists to suppress');

  const clean = checkPrivacy(view('an ordinary paragraph about a compiler and a pack'));
  assert.deepEqual(clean.findings, [], 'PRIV-4 fired on ordinary prose');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// RIGHTS
// ═════════════════════════════════════════════════════════════════════════════════════════

test('RIGHT-1 derives estate ownership from provenance and RECORDS that it was derived', () => {
  for (const system of ['git', 'repository', 'fusion247']) {
    const r = resolveRights({ provenance: { source_system: system }, rights: null });
    assert.equal(r.basis, 'estate-owned');
    assert.equal(r.basis_source, 'derived-from-provenance',
      'a derived basis presented itself as a declaration');
  }
  const supplied = resolveRights({ provenance: { source_system: 'warwick-supplied' }, rights: null });
  assert.equal(supplied.basis, null,
    'warwick-supplied was presumed to be his — the one inference this dimension must never make');
});

test('RIGHT-2 blocks declared third-party material; a declared licence passes', () => {
  const view = (rights) => makeView({
    claims: [claim('beat-1', 'a beat', ['repo:a.md'])],
    entries: [{ source_ref: 'repo:a.md', provenance: { source_system: 'warwick-supplied' }, rights, text: 'words' }],
  });

  assert.deepEqual(
    rulesOf(checkRights(view({ basis: 'third-party-unlicensed', basis_source: 'declared', holder: 'A Publisher' })).findings),
    ['RIGHT-2'],
  );
  assert.deepEqual(
    checkRights(view({ basis: 'licensed', basis_source: 'declared', holder: 'A Publisher' })).findings,
    [], 'RIGHT-2 fired on properly licensed material',
  );
});

test('RIGHT-3 surfaces undeclared supplied material and stays quiet for estate material', () => {
  const view = (source_system) => makeView({
    claims: [claim('beat-1', 'a beat', ['repo:a.md'])],
    entries: [{ source_ref: 'repo:a.md', provenance: { source_system }, rights: null, text: 'words' }],
  });

  assert.deepEqual(rulesOf(checkRights(view('warwick-supplied')).findings), ['RIGHT-3']);
  assert.deepEqual(checkRights(view('git')).findings, [],
    'RIGHT-3 fired on the estate\'s own material — the dimension would be a wall');
});

test('RIGHT-4 blocks an over-extent quotation from material that is not ours', () => {
  const long = 'q'.repeat(QUOTE_EXTENT_MAX_CHARS + 20);
  const view = (rights) => makeView({
    claims: [claim('beat-1', 'a beat', ['repo:a.md'])],
    segments: [segment('script', 0, `"${long}"`, 'beat-1', 'repo:a.md')],
    entries: [{ source_ref: 'repo:a.md', provenance: { source_system: 'warwick-supplied' }, rights, text: long }],
  });

  const licensed = rulesOf(checkRights(view({ basis: 'licensed', basis_source: 'declared', holder: 'A Publisher' })).findings);
  assert.ok(licensed.includes('RIGHT-4'), 'a 320-character quotation from licensed third-party material raised nothing');

  const ours = checkRights(view({ basis: 'estate-owned', basis_source: 'declared', holder: null })).findings;
  assert.deepEqual(rulesOf(ours), [], 'RIGHT-4 fired on a long quotation from our own material');
});

test('RIGHT-5 surfaces a media asset with no DECLARED basis', () => {
  const view = (media_type, rights) => makeView({
    claims: [claim('beat-1', 'a beat', ['repo:a.md'])],
    entries: [{ source_ref: 'repo:a.md', media_type, provenance: { source_system: 'git' }, rights, text: 'words' }],
  });

  assert.ok(rulesOf(checkRights(view('image/png', null)).findings).includes('RIGHT-5'),
    'a media asset carrying only a derived basis raised nothing');
  assert.deepEqual(checkRights(view('text/markdown', null)).findings, [],
    'RIGHT-5 fired on ordinary text');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// CROSS-FORMAT — the spine is the MASTER
// ═════════════════════════════════════════════════════════════════════════════════════════

function twoBeatPackage({ blogCarries = ['beat-1', 'beat-2'], titlesCarry = ['beat-1'] } = {}) {
  const claims = [
    claim('beat-1', 'the first beat', ['repo:a.md'], 'beat', 0),
    claim('beat-2', 'the second beat', ['repo:a.md'], 'beat', 1),
    claim('claim-1', 'a supporting narrative claim', ['repo:a.md'], 'narrative-claim', 0),
  ];
  const segments = [
    segment('script', 0, 'scene one', 'beat-1', 'repo:a.md'),
    segment('script', 1, 'scene two', 'beat-2', 'repo:a.md'),
    ...blogCarries.map((id, i) => segment('blog', i, `paragraph for ${id}`, id, 'repo:a.md')),
    ...titlesCarry.map((id, i) => segment('titles', i, `title for ${id}`, id, 'repo:a.md')),
    segment('thumbnail-direction', 0, 'a frame', 'claim-1', 'repo:a.md'),
  ];
  return makeView({ claims, segments, entries: [{ source_ref: 'repo:a.md', text: 'words' }] });
}

test('XF stays quiet on a package whose siblings all carry the master spine', () => {
  assert.deepEqual(checkCrossFormat(twoBeatPackage()).findings, [],
    'cross-format fired on a consistent package');
});

test('XF-3 catches the blog dropping a beat the script keeps — which the SCHEMA cannot', () => {
  const result = checkCrossFormat(twoBeatPackage({ blogCarries: ['beat-1'] }));
  assert.deepEqual(rulesOf(result.findings), ['XF-3']);
  assert.match(result.findings[0].detail, /carried by the script and dropped by the blog/);
});

test('XF-3 does NOT demand parity from titles or thumbnail direction', () => {
  // Titles carry ONE of the two beats, and a different one from the package's default. A selective
  // sibling covering a strict subset of the spine is normal — three titles do not cover twelve
  // beats — and holding it to long-form parity would fire on every correct package.
  assert.deepEqual(checkCrossFormat(twoBeatPackage({ titlesCarry: ['beat-2'] })).findings, [],
    'a selective sibling was held to long-form parity');

  // And the sibling must still be PRESENT: selectivity is not absence.
  assert.ok(
    rulesOf(checkCrossFormat(twoBeatPackage({ titlesCarry: [] })).findings).includes('XF-1'),
    'a package with no titles at all was accepted',
  );
});

test('XF-2 catches a beat no sibling tells at all', () => {
  const view = twoBeatPackage({ blogCarries: ['beat-1'] });
  view.segments = view.segments.filter((s) => !(s.sibling === 'script' && s.claim_id === 'beat-2'));
  const result = checkCrossFormat(view);
  assert.ok(rulesOf(result.findings).includes('XF-2'));
});

test('XF-1 catches a missing sibling', () => {
  const view = twoBeatPackage();
  view.segments = view.segments.filter((s) => s.sibling !== 'titles');
  assert.ok(rulesOf(checkCrossFormat(view).findings).includes('XF-1'));
});

test('a NARRATIVE CLAIM no sibling carries is NOT a finding', () => {
  const view = twoBeatPackage();
  view.segments = view.segments.filter((s) => s.claim_id !== 'claim-1');
  // thumbnail-direction only carried claim-1, so removing it would trip XF-1; give it a beat.
  view.segments.push(segment('thumbnail-direction', 0, 'a frame', 'beat-1', 'repo:a.md'));
  assert.deepEqual(checkCrossFormat(view).findings, [],
    'a supporting narrative claim was required to appear in a sibling');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// The verdict itself
// ═════════════════════════════════════════════════════════════════════════════════════════

test('a SURFACED question is not a pass', () => {
  const result = runDimensions(makeView({
    claims: [claim('beat-1', 'a beat', ['repo:a.md'])],
    segments: [
      segment('script', 0, 'scene', 'beat-1', 'repo:a.md'),
      segment('blog', 0, 'paragraph', 'beat-1', 'repo:a.md'),
      segment('titles', 0, 'title', 'beat-1', 'repo:a.md'),
      segment('thumbnail-direction', 0, 'frame', 'beat-1', 'repo:a.md'),
    ],
    entries: [{ source_ref: 'repo:a.md', snapshotPrivacy: 'unclassified', seedPrivacy: 'unclassified', text: 'words' }],
  }));

  assert.equal(result.blockingCount, 0, 'this proof needs a run with surfaced findings and no blocks');
  assert.ok(result.surfacedCount > 0);
  assert.equal(result.verdict, 'blocked',
    'a package carrying only unanswered questions was reported as a pass — a question nobody is forced to answer is not a gate');
});

test('every dimension answers for itself — there is no single aggregate boolean', () => {
  const result = runDimensions(twoBeatPackage());
  assert.deepEqual(
    Object.keys(result.dimensions).sort(),
    ['cross-format', 'fact', 'privacy', 'quotation', 'rights'],
  );
  for (const [name, d] of Object.entries(result.dimensions)) {
    assert.ok(['pass', 'blocked', 'surfaced'].includes(d.verdict), `${name} has no verdict`);
    assert.ok(d.coverage && Object.keys(d.coverage).length > 0,
      `${name} reported a verdict with no coverage — a pass over unexamined ground`);
  }
});

test('the verdict identity is a pure function of the package, the ruleset and the findings', () => {
  const ruleset = loadRuleset(CURRENT_RULESET_VERSION);
  const view = twoBeatPackage({ blogCarries: ['beat-1'] });

  const once = runDimensions(view);
  const twice = runDimensions(view);
  const id = (r) => verificationIdentity(buildVerificationManifest({
    packageId: PACKAGE_ID, ruleset, verifierVersion: 'vlogops-verifier-v1', result: r,
  }));

  assert.equal(id(once), id(twice), 'two runs of the same rules over the same rows disagreed');

  // A DIFFERENT ruleset is a different question, so it must be a different verdict identity —
  // which is what stops an old verdict silently becoming a product of new rules.
  const other = id(once) === verificationIdentity(buildVerificationManifest({
    packageId: PACKAGE_ID,
    ruleset: { version: ruleset.version, id: 'a'.repeat(64) },
    verifierVersion: 'vlogops-verifier-v1',
    result: once,
  }));
  assert.equal(other, false, 'the ruleset does not participate in the verdict identity');
});

test('the ruleset document NAMES every rule the verifier can raise', () => {
  const { text } = loadRuleset(CURRENT_RULESET_VERSION);
  const rules = [
    'FACT-1', 'FACT-2', 'QUOT-1', 'QUOT-2', 'PRIV-1', 'PRIV-2', 'PRIV-3', 'PRIV-4',
    'RIGHT-1', 'RIGHT-2', 'RIGHT-3', 'RIGHT-4', 'RIGHT-5', 'XF-1', 'XF-2', 'XF-3',
  ];
  for (const r of rules) {
    assert.ok(text.includes(r), `the ruleset document does not name ${r}, so nobody can argue with it`);
  }
});
