// BUILD-006 Phase 3 — the refusal layer: what the model said, checked before anything is stored.
//
// ── WHY THIS EXISTS WHEN THE DATABASE ALREADY ENFORCES IT ───────────────────────────────────
// db/003 makes an uncited segment, an unresolvable citation and a drifting sibling all
// UNWRITABLE. So this file is not what makes the acceptance property true — the schema is. This
// file exists because the two layers answer to different readers:
//
//   the CONSTRAINT means it could not have been stored even if nobody was looking;
//   the NAMED REFUSAL tells a human exactly what the model got wrong, before a transaction is
//   ever opened, in words that name the offending claim and the offending reference.
//
// A foreign-key violation surfacing from deep inside a write is a true error and a useless one:
// it arrives after the work, it names a constraint rather than a mistake, and on a deferred
// constraint it arrives at COMMIT with no indication of which of forty rows caused it.
//
// ── EVERY PROBLEM, TOGETHER ─────────────────────────────────────────────────────────────────
// Problems are accumulated and reported in one error, following the shape config.mjs already
// established for the environment: a draft with six bad citations should tell you about six bad
// citations, not send you round the loop six times.
//
// ── WHAT THIS FILE DELIBERATELY DOES NOT DO ─────────────────────────────────────────────────
// It enforces TRACEABILITY, not taste. The contract asks for three to seven beats, a particular
// register, and no borrowed cadence; none of that is checked here and none of it should be.
// Those are creative instructions whose satisfaction is a human judgement — Warwick's, at Phase
// 5. Machinery that pretended to grade them would be making exactly the substitution this phase
// is most at risk of: proving the mechanism and calling it the outcome.

import { SCRIBE_SIBLINGS } from '../config.mjs';

/** The master claim id reserved for the story question itself. Models may not reuse it. */
export const STORY_QUESTION_CLAIM_ID = 'story-question';

const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

// Most severe first. The thrown error takes the most severe code present, and carries them all.
const SEVERITY = [
  'EVLOGOPSSCRIBEDRIFT',
  'EVLOGOPSSCRIBEUNKNOWNCITATION',
  'EVLOGOPSSCRIBEUNCITED',
  'EVLOGOPSSCRIBEINCOMPLETE',
  'EVLOGOPSSCRIBEBADID',
];

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim() !== '';
}

/**
 * Pull the JSON object out of whatever the model returned.
 *
 * Models fence JSON in markdown even when told not to, so a fence is tolerated. Anything else is
 * refused rather than repaired: a parser that guesses at malformed output is a parser that will
 * one day guess wrong and produce a package nobody can trace.
 */
export function parseProposal(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') {
    const err = new Error('vlogops scribe: the model returned nothing to parse');
    err.code = 'EVLOGOPSSCRIBEUNPARSEABLE';
    throw err;
  }

  let text = raw.trim();
  const fence = /^```(?:json)?\s*\n([\s\S]*?)\n?```$/.exec(text);
  if (fence) text = fence[1].trim();

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    const err = new Error(
      `vlogops scribe: the model's output is not JSON (${cause.message}). It is refused rather `
      + 'than repaired — a draft this machinery had to guess at is a draft nobody can trace.',
    );
    err.code = 'EVLOGOPSSCRIBEUNPARSEABLE';
    throw err;
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    const err = new Error('vlogops scribe: the model returned JSON that is not an object');
    err.code = 'EVLOGOPSSCRIBEUNPARSEABLE';
    throw err;
  }

  // The contract gives the model an honest exit: say you cannot do it rather than invent a
  // citation. Taking that exit is a correct outcome, and it must never look like a crash.
  if ('refusal' in parsed) {
    const err = new Error(`vlogops scribe: the model declined to draft — ${String(parsed.refusal)}`);
    err.code = 'EVLOGOPSSCRIBEREFUSED';
    err.refusal = String(parsed.refusal);
    throw err;
  }

  return parsed;
}

/**
 * Validate a proposal against the pack it was drafted from, and normalise it into the exact rows
 * db/003 stores.
 *
 * `allowedRefs` is the set of source_ref values in THIS pack. It is the only universe of
 * citations that exists; anything outside it is a fabricated reference, which is the one failure
 * mode a downstream verification stage cannot catch for us.
 */
export function validateProposal({ proposal, allowedRefs }) {
  const allowed = allowedRefs instanceof Set ? allowedRefs : new Set(allowedRefs);
  if (allowed.size === 0) {
    throw new TypeError('validateProposal: a pack with no entries has nothing to cite');
  }

  const problems = [];
  const add = (code, message) => problems.push({ code, message });

  // ── the story question ────────────────────────────────────────────────────────────────
  if (!isNonEmptyString(proposal.story_question)) {
    add('EVLOGOPSSCRIBEINCOMPLETE', 'story_question is missing or empty');
  }

  const claims = [];
  const seenIds = new Set();

  const takeCitations = (rawCitations, label) => {
    const list = Array.isArray(rawCitations) ? rawCitations : [];
    if (list.length === 0) {
      add('EVLOGOPSSCRIBEUNCITED', `${label} cites nothing — a master claim must rest on at least one pack entry`);
      return [];
    }
    const kept = [];
    for (const ref of list) {
      if (!isNonEmptyString(ref)) {
        add('EVLOGOPSSCRIBEUNKNOWNCITATION', `${label} carries a citation that is not a source_ref`);
        continue;
      }
      if (!allowed.has(ref)) {
        add(
          'EVLOGOPSSCRIBEUNKNOWNCITATION',
          `${label} cites "${ref}", which is not an entry of this pack. A citation that does not `
          + 'resolve is a fabricated reference.',
        );
        continue;
      }
      if (!kept.includes(ref)) kept.push(ref);
    }
    return kept;
  };

  const pushClaim = (id, kind, ordinal, text, citations) => {
    if (!ID_RE.test(id)) {
      add('EVLOGOPSSCRIBEBADID', `claim id "${id}" is not a lowercase slug`);
      return;
    }
    if (seenIds.has(id)) {
      add('EVLOGOPSSCRIBEBADID', `claim id "${id}" is used more than once`);
      return;
    }
    if (!isNonEmptyString(text)) {
      add('EVLOGOPSSCRIBEINCOMPLETE', `claim "${id}" has no text`);
      return;
    }
    seenIds.add(id);
    claims.push({ claim_id: id, kind, ordinal, text: text.trim(), citations });
  };

  pushClaim(
    STORY_QUESTION_CLAIM_ID,
    'story-question',
    0,
    proposal.story_question,
    takeCitations(proposal.question_citations, 'the story question'),
  );

  // ── beats and narrative claims ────────────────────────────────────────────────────────
  const beats = Array.isArray(proposal.beats) ? proposal.beats : [];
  if (beats.length === 0) {
    add('EVLOGOPSSCRIBEINCOMPLETE', 'beats is missing or empty — a master with no spine is not a master');
  }
  beats.forEach((b, i) => {
    const id = isNonEmptyString(b?.id) ? b.id : `beat-${i + 1}`;
    if (id === STORY_QUESTION_CLAIM_ID) {
      add('EVLOGOPSSCRIBEBADID', `"${STORY_QUESTION_CLAIM_ID}" is reserved for the story question`);
      return;
    }
    pushClaim(id, 'beat', i, b?.text, takeCitations(b?.citations, `beat "${id}"`));
  });

  const narrative = Array.isArray(proposal.claims) ? proposal.claims : [];
  narrative.forEach((c, i) => {
    const id = isNonEmptyString(c?.id) ? c.id : `claim-${i + 1}`;
    if (id === STORY_QUESTION_CLAIM_ID) {
      add('EVLOGOPSSCRIBEBADID', `"${STORY_QUESTION_CLAIM_ID}" is reserved for the story question`);
      return;
    }
    pushClaim(id, 'narrative-claim', i, c?.text, takeCitations(c?.citations, `claim "${id}"`));
  });

  const claimById = new Map(claims.map((c) => [c.claim_id, c]));

  // ── the siblings ──────────────────────────────────────────────────────────────────────
  const segments = [];
  const rawSiblings = proposal.siblings && typeof proposal.siblings === 'object' ? proposal.siblings : {};

  for (const sibling of SCRIBE_SIBLINGS) {
    const list = Array.isArray(rawSiblings[sibling]) ? rawSiblings[sibling] : [];
    if (list.length === 0) {
      add('EVLOGOPSSCRIBEINCOMPLETE', `sibling "${sibling}" has no segments — a package carries all four siblings`);
      continue;
    }

    list.forEach((s, i) => {
      const where = `${sibling}[${i}]`;

      if (!isNonEmptyString(s?.text)) {
        add('EVLOGOPSSCRIBEINCOMPLETE', `${where} has no text`);
        return;
      }
      if (!isNonEmptyString(s?.role)) {
        add('EVLOGOPSSCRIBEINCOMPLETE', `${where} has no role`);
        return;
      }

      // A SIBLING CANNOT BE GENERATED WITHOUT A MASTER — checked here by name, and by foreign
      // key in db/003 regardless of what this code does.
      if (!isNonEmptyString(s?.claim)) {
        add('EVLOGOPSSCRIBEDRIFT', `${where} names no master claim; a sibling segment is an adaptation OF something`);
        return;
      }
      const master = claimById.get(s.claim);
      if (master === undefined) {
        add(
          'EVLOGOPSSCRIBEDRIFT',
          `${where} adapts "${s.claim}", which is not a claim the master makes. A sibling asserting `
          + 'something the master does not is drift.',
        );
        return;
      }

      if (!isNonEmptyString(s?.cite)) {
        add('EVLOGOPSSCRIBEUNCITED', `${where} carries no citation`);
        return;
      }
      if (!allowed.has(s.cite)) {
        add('EVLOGOPSSCRIBEUNKNOWNCITATION', `${where} cites "${s.cite}", which is not an entry of this pack`);
        return;
      }
      // THE ONE THAT MATTERS: the segment's evidence must be evidence its own master rests on.
      // A sibling citing a real pack entry its master never used is how a blog quietly acquires
      // a claim the video never made.
      if (!master.citations.includes(s.cite)) {
        add(
          'EVLOGOPSSCRIBEDRIFT',
          `${where} cites "${s.cite}", which is a real pack entry but is NOT one that its master `
          + `claim "${s.claim}" rests on. A sibling may not bring its own evidence.`,
        );
        return;
      }

      segments.push({
        sibling,
        ordinal: segments.filter((x) => x.sibling === sibling).length,
        role: s.role.trim(),
        text: s.text.trim(),
        claim_id: s.claim,
        source_ref: s.cite,
      });
    });
  }

  if (problems.length > 0) {
    const codes = [...new Set(problems.map((p) => p.code))];
    const code = SEVERITY.find((c) => codes.includes(c)) ?? 'EVLOGOPSSCRIBEINCOMPLETE';
    const err = new Error(
      `vlogops scribe: the draft is refused; ${problems.length} problem(s) found, nothing written.\n`
      + problems.map((p) => `  - [${p.code}] ${p.message}`).join('\n'),
    );
    err.code = code;
    err.codes = codes;
    err.problems = problems.map((p) => p.message);
    throw err;
  }

  return {
    storyQuestion: claimById.get(STORY_QUESTION_CLAIM_ID).text,
    claims,
    segments,
  };
}
