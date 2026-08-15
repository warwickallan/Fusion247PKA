// BUILD-006 Phase 4 — deliberately defective drafts, for MAKING THE VERIFIER FAIL.
//
// ⛔ WHY THIS EXISTS, AND WHY IT IS THE MOST IMPORTANT FILE IN THE PHASE ⛔
//
// A verifier nobody has made fail is not a verifier. This estate has learned that from three
// directions in one night: a self-test that had never once rendered the real data it guarded, a CI
// control red for eight days behind an abort nobody read, and a constraint set that would have
// scored identically had it refused everything. Phase 3 closed its own version of this properly —
// six planted attacks refused, PLUS the positive case that succeeds — because refusals alone
// cannot tell a control apart from a wall.
//
// ── HOW A DEFECT IS PLANTED, AND WHY IT IS NOT DONE BY EDITING ROWS ─────────────────────────
// It CANNOT be done by editing rows. A stored package is immutable — db/003 puts a trigger on
// every one of its tables refusing UPDATE and DELETE — so there is no path that takes a good
// package and makes it bad.
//
// So a planted defect is planted where a real defect would come from: THE DRAFT. Each client here
// implements the same `draft(prompt) -> string` interface the gateway client implements, composes
// the ordinary deterministic stub proposal, and then makes exactly one thing wrong with it. The
// resulting package goes through the real Scribe path, the real refusal layer and the real schema,
// and lands in the store as a real row. It is a REAL package that a model got wrong — which is
// precisely the thing Phase 4 exists to catch.
//
// Each client's `describe()` says what was planted, and that description is stored on the package
// row permanently. A future reader of this store must never have to guess why a package looks
// deliberately broken.

import { composeStubProposal, citableRefsFromPrompt } from '../../src/scribe/stub.mjs';

/**
 * Pull one entry's excerpt back out of the assembled prompt.
 *
 * The quotation plants need REAL evidence text — a quotation proof against invented source bytes
 * would prove the matcher works on a fixture and nothing about the store. buildPrompt writes each
 * entry as a `--- ENTRY n ---` block with a header and then the excerpt, so the excerpt is
 * everything after the header block up to the next entry.
 */
export function excerptFromPrompt(prompt, sourceRef) {
  const marker = `source_ref: ${sourceRef}\n`;
  const at = prompt.indexOf(marker);
  if (at === -1) throw new Error(`planted-drafts: ${sourceRef} is not in this prompt`);

  const afterHeader = prompt.indexOf('\n\n', at);
  if (afterHeader === -1) throw new Error(`planted-drafts: no excerpt body for ${sourceRef}`);

  const next = prompt.indexOf('\n--- ENTRY ', afterHeader);
  const end = next === -1 ? prompt.indexOf('\n═══', afterHeader) : next;
  return prompt.slice(afterHeader + 2, end === -1 ? undefined : end).trim();
}

/**
 * A run of `minChars` characters of real evidence, cut at word boundaries so the result reads as
 * a quotation rather than as a fragment.
 */
export function realQuotation(prompt, sourceRef, minChars = 60) {
  const text = excerptFromPrompt(prompt, sourceRef).replace(/\s+/g, ' ').trim();
  if (text.length < minChars + 10) {
    throw new Error(`planted-drafts: ${sourceRef} has only ${text.length} characters of excerpt`);
  }
  // Start past any leading heading punctuation so the span is ordinary prose.
  const words = text.split(' ');
  let out = '';
  for (const w of words) {
    if (out.length >= minChars) break;
    out = out === '' ? w : `${out} ${w}`;
  }
  return out;
}

/** Change one word of a quotation, leaving everything else identical. THE NEAR MISS. */
export function nearMiss(quote) {
  const words = quote.split(' ');
  const i = Math.floor(words.length / 2);
  words[i] = 'DEFINITELYNOTTHEORIGINALWORD';
  return words.join(' ');
}

const PLANTS = {
  // ── AC3 · a FACTUAL ERROR ────────────────────────────────────────────────────────────────
  // A claim that contradicts the evidence entry it cites. The number is large and specific so it
  // cannot be in any file this estate contains, and so that a reader of the finding can see at a
  // glance that it was planted rather than stumbled into.
  'factual-error': (proposal) => {
    proposal.claims[0].text =
      'STUB CLAIM (PLANTED FACTUAL ERROR): this window contains exactly 9,999,417 commits and cost '
      + '£8,241,660.75 to produce, neither of which appears anywhere in the evidence cited.';
    return proposal;
  },

  // ── AC3 · a PRIVATE DETAIL in publishable text ───────────────────────────────────────────
  // Synthetic values, chosen to be obviously fake: this package is committed to a demonstration
  // in a PUBLIC repository, so a plant using anything real would be the exact failure the rule
  // exists to prevent.
  'private-detail': (proposal) => {
    const seg = proposal.siblings.blog[0];
    seg.text = `${seg.text} Contact the household directly on 01632 960111 or at `
      + 'not.a.real.person@example.invalid for the full unredacted version.';
    return proposal;
  },

  // ── a NEAR-MISS QUOTATION — AC7's discriminating case ────────────────────────────────────
  'near-miss-quotation': (proposal, prompt) => {
    const seg = proposal.siblings.script[0];
    const quote = realQuotation(prompt, seg.cite, 60);
    seg.text = `STUB SCENE (PLANTED NEAR-MISS QUOTATION). The record says: "${nearMiss(quote)}"`;
    return proposal;
  },

  // ── the POSITIVE half of the same pair: an EXACT quotation must pass ─────────────────────
  'exact-quotation': (proposal, prompt) => {
    const seg = proposal.siblings.script[0];
    const quote = realQuotation(prompt, seg.cite, 60);
    seg.text = `STUB SCENE (EXACT QUOTATION, taken verbatim). The record says: "${quote}"`;
    return proposal;
  },

  // ── an OVER-EXTENT quotation — RIGHT-4 ───────────────────────────────────────────────────
  'long-quotation': (proposal, prompt) => {
    const seg = proposal.siblings.script[0];
    const quote = realQuotation(prompt, seg.cite, 340);
    seg.text = `STUB SCENE (PLANTED OVER-EXTENT QUOTATION). "${quote}"`;
    return proposal;
  },

  // ── CROSS-FORMAT drift the SCHEMA CANNOT CATCH — XF-3 ────────────────────────────────────
  // Every remaining row is still perfectly legal: each blog segment names a master claim and
  // cites evidence that claim rests on, so db/003's foreign keys are all satisfied. What is wrong
  // is an OMISSION, and an omission has no row to constrain.
  'dropped-beat': (proposal) => {
    if (proposal.beats.length < 2) {
      throw new Error('planted-drafts: dropped-beat needs a pack with at least two beats');
    }
    const dropped = proposal.beats[0].id;
    proposal.siblings.blog = proposal.siblings.blog.filter((s) => s.claim !== dropped);
    return proposal;
  },

  // ── a beat NO sibling tells — XF-2 ───────────────────────────────────────────────────────
  'untold-beat': (proposal) => {
    if (proposal.beats.length < 2) {
      throw new Error('planted-drafts: untold-beat needs a pack with at least two beats');
    }
    const dropped = proposal.beats[0].id;
    for (const sibling of Object.keys(proposal.siblings)) {
      proposal.siblings[sibling] = proposal.siblings[sibling].filter((s) => s.claim !== dropped);
    }
    // Keep every sibling non-empty; an empty one would be refused by Phase 3 before it stored,
    // and would be testing XF-1 rather than XF-2.
    for (const sibling of Object.keys(proposal.siblings)) {
      if (proposal.siblings[sibling].length === 0) {
        const keep = proposal.beats[1];
        proposal.siblings[sibling] = [{
          role: 'kept', claim: keep.id, cite: keep.citations[0],
          text: `STUB ${sibling.toUpperCase()} kept so this sibling is not empty.`,
        }];
      }
    }
    return proposal;
  },
};

export const PLANT_KINDS = Object.freeze(Object.keys(PLANTS));

/**
 * A model client that drafts the ordinary stub proposal and then plants exactly one defect.
 *
 * `describe()` names the plant, and that description is written to the package row and kept for as
 * long as the row exists. A deliberately defective package must announce itself to every future
 * reader without anybody having to remember which run was which.
 */
export function plantedModelClient(kind) {
  const plant = PLANTS[kind];
  if (plant === undefined) {
    throw new Error(`planted-drafts: no plant "${kind}". Known: ${PLANT_KINDS.join(', ')}`);
  }

  return {
    describe() {
      return {
        provider: 'stub',
        client: `planted-defect-${kind}`,
        model: null,
        configured: false,
        deterministic: true,
        planted_defect: kind,
        warning: 'DELIBERATELY DEFECTIVE DRAFT — planted by the Phase 4 proofs to make the '
          + 'verifier fail. Not Warwick\'s voice, and not a package anybody should publish.',
      };
    },
    async draft(prompt) {
      // The refs are read first for the same reason the ordinary stub reads them: if buildPrompt
      // ever stopped listing citable source_refs, a plant handed the rows out of band would carry
      // on passing while the real seam went blind.
      citableRefsFromPrompt(prompt);
      return JSON.stringify(plant(composeStubProposal(prompt), prompt));
    },
  };
}
