// =====================================================================
// BUILD-015 AsdAIr - interpret/knownList.js
//
// THE MEASUREMENT. Not a fix, and deliberately written before one.
//
// Mum's 17 August list is a real input whose correct output is known: the
// photograph is committed at pipeline/testdata/known-list/, the line-by-line
// truth at pipeline/testdata/mum-list-2026-08-17.expected.json, and the real
// household catalogue beside it. So "the matcher is unfit" stops being an
// opinion and becomes three numbers that either move or do not:
//
//   unresolved_wrongly     a line the catalogue COULD have identified and did not
//   unauthorised_identity  a line given an identity the catalogue never authorised
//   avoidable_questions    a line that would be put to a human although the
//                          household's own rows already answer it
//
// PURE. No database, no gateway, no clock. It scores whatever resolver it is
// handed, which is what lets the same file measure the code before and after a
// change without either side being able to grade its own homework.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const TESTDATA = path.join(__dirname, '..', 'pipeline', 'testdata');

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(TESTDATA, file), 'utf8'));
}

/** The household's real catalogue, shaped exactly as loadCatalogue() returns it
 *  from Postgres - INCLUDING the string ids node-postgres actually gives back
 *  for a bigint column, because a Map keyed the other way silently missed every
 *  lookup in the real deployment once already. */
function loadFixtureCatalogue() {
  const regulars = readJson('household-regulars.json').rows;
  const rules = readJson('household-rules.json').rows;
  return {
    household_id: 1,
    regulars,
    rules,
    regularsById: new Map(regulars.map((r) => [Number(r.id), r])),
    candidates: regulars.map((r) => ({
      id: Number(r.id),
      name: r.name,
      brand: r.brand || undefined,
      category: r.category || undefined,
      aka: Array.isArray(r.aka) && r.aka.length ? r.aka : undefined,
      typical_qty: r.typical_qty === null ? undefined : r.typical_qty,
    })),
    last_order: null,
  };
}

/** Mum's list and its known-correct outcome. */
function loadKnownList() {
  return readJson('mum-list-2026-08-17.expected.json');
}

/** The readings a CORRECT transcription of the photograph produces. This is the
 *  clean-text case: every number below is a matcher defect, with the reading of
 *  the page taken out of the argument entirely. */
function readingsFromKnownList(known) {
  return known.lines.map((l) => ({
    line_no: l.n,
    raw_reading: l.reading,
    quantity: l.qty === undefined ? null : l.qty,
  }));
}

function expectationOf(line) {
  const e = line.expect || {};
  if (e.kind === 'regular') return { kind: 'regular', ids: [Number(e.id)] };
  if (e.kind === 'one_of') return { kind: 'one_of', ids: e.ids.map(Number) };
  return { kind: 'new', ids: [] };
}

/**
 * Score one resolved line against its known-correct outcome.
 *
 * The verdicts are deliberately NOT a single pass/fail: a line held for a human
 * with the right answer among its alternatives is a different (and much
 * cheaper) failure than a line silently given the wrong identity, and lumping
 * them together is how a matcher that buys the wrong food scores the same as
 * one that asks a question.
 */
function scoreLine(expectedLine, resolved) {
  const want = expectationOf(expectedLine);
  const forbid = (expectedLine.forbid || []).map(Number);
  const got = resolved.matched_regular_id === null || resolved.matched_regular_id === undefined
    ? null : Number(resolved.matched_regular_id);
  const alternatives = (resolved.alternatives || []).map((a) => Number(a.id ?? a.regular_id));

  const out = {
    n: expectedLine.n,
    reading: expectedLine.reading,
    status: resolved.status,
    got,
    want,
    verdict: null,
    unresolved_wrongly: false,
    unauthorised_identity: false,
    avoidable_question: false,
    quantity_lost: false,
    detail: null,
  };

  // A quantity Mum wrote must survive. A quantity she did not write must not be
  // invented - both directions are failures, and only one of them is obvious.
  const wantQty = expectedLine.qty === undefined ? null : expectedLine.qty;
  const gotQty = resolved.quantity === undefined ? null : resolved.quantity;
  if (!expectedLine.qty_contested && wantQty !== gotQty) {
    out.quantity_lost = true;
    out.detail = `quantity ${JSON.stringify(gotQty)} but Mum wrote ${JSON.stringify(wantQty)}`;
  }

  if (got !== null && forbid.includes(got)) {
    out.verdict = 'WRONG_PRODUCT';
    out.unauthorised_identity = true;
    out.detail = `resolved to ${got}, which this line must never be`;
    return out;
  }

  if (want.kind === 'new') {
    if (got !== null) {
      out.verdict = 'INVENTED_IDENTITY';
      out.unauthorised_identity = true;
      out.detail = `the catalogue has no row for this line, but it was given regular ${got}`;
      return out;
    }
    out.verdict = 'CORRECT_NEW';
    return out;
  }

  if (got !== null && want.ids.includes(got)) {
    out.verdict = 'CORRECT';
    return out;
  }

  if (got !== null) {
    out.verdict = 'WRONG_PRODUCT';
    out.unauthorised_identity = true;
    out.detail = `resolved to ${got}, wanted ${want.ids.join(' or ')}`;
    return out;
  }

  // Nothing was identified. Whether that is a cheap failure or an expensive one
  // depends entirely on whether the right answer was on the table.
  out.unresolved_wrongly = true;
  out.avoidable_question = true;
  if (want.ids.some((id) => alternatives.includes(id))) {
    out.verdict = 'HELD_WITH_ANSWER_IN_HAND';
    out.detail = `held for a human, and the correct row ${want.ids.join('/')} was already among the candidates`;
  } else {
    out.verdict = 'UNRESOLVED';
    out.detail = `no identity, wanted ${want.ids.join(' or ')}`;
  }
  return out;
}

/** Score a whole run and return the three numbers plus the per-line detail. */
function scoreRun(known, resolvedLines) {
  const byLine = known.lines.map((expectedLine, i) => scoreLine(expectedLine, resolvedLines[i]));
  return {
    lines: byLine.length,
    unresolved_wrongly: byLine.filter((l) => l.unresolved_wrongly).length,
    unauthorised_identity: byLine.filter((l) => l.unauthorised_identity).length,
    avoidable_questions: byLine.filter((l) => l.avoidable_question).length,
    quantities_lost: byLine.filter((l) => l.quantity_lost).length,
    correct: byLine.filter((l) => l.verdict === 'CORRECT' || l.verdict === 'CORRECT_NEW').length,
    byLine,
  };
}

module.exports = {
  loadFixtureCatalogue,
  loadKnownList,
  readingsFromKnownList,
  scoreLine,
  scoreRun,
};
