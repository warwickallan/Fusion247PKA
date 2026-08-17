#!/usr/bin/env node
// =====================================================================
// BUILD-015 AsdAIr - measure-known-list.js
//
// The three numbers, printed. Mum's real 17 August list, the household's real
// catalogue and rules, through the real resolver - no database, no gateway, no
// credentials, no arguments:
//
//     node services/asdair/interpret/measure-known-list.js
//
// It measures the CLEAN-TEXT case: the readings are a correct transcription of
// the photograph, so what it reports is the matcher, the rules and the
// question-generation, with the reading of the page taken out of the argument.
//
// ⛔ IT SAYS NOTHING ABOUT THE VISION MODEL, THE GATEWAY OR THE PROMPT. Those
// are a live run against the photograph, and a builder cannot give that.
// Exit 1 if the outcome has regressed, so it can be read by a script as well as
// by a person.
'use strict';

const { resolveAll } = require('./resolveByCatalogue');
const { extractRuleTriggers } = require('./ruleTriggers');
const { loadFixtureCatalogue, loadKnownList, readingsFromKnownList, scoreRun } = require('./knownList');

const catalogue = loadFixtureCatalogue();
const known = loadKnownList();
const resolved = resolveAll(readingsFromKnownList(known), catalogue.regulars, { rules: catalogue.rules });
const score = scoreRun(known, resolved);

const pad = (s, n) => String(s).padEnd(n);

console.log('');
console.log(`Mum's list of ${known.lines.length} lines, against ${catalogue.regulars.length} regulars and ${catalogue.rules.length} active rules`);
console.log(`source photograph: ${known.source_image}`);
console.log('');
for (const line of score.byLine) {
  const r = resolved[line.n - 1];
  const name = r.matched_product_name || (r.alternatives.length
    ? `? ${r.alternatives.map((a) => a.name).join('  |  ')}`
    : '(new item - nothing in the catalogue)');
  const mark = line.verdict === 'CORRECT' || line.verdict === 'CORRECT_NEW' ? ' ' : '*';
  console.log(`${mark} ${pad(line.n, 3)}${pad(line.reading, 42)} -> ${name.slice(0, 60)}`);
  if (r.match_basis && /household rule/.test(r.match_basis)) {
    console.log(`      ${r.match_basis}`);
  }
}

console.log('');
console.log('  identities the catalogue did not authorise :', score.unauthorised_identity);
console.log('  lines that would be put to a human        :', score.avoidable_questions);
console.log('  quantities lost or invented               :', score.quantities_lost);
console.log(`  correct                                   : ${score.correct} of ${score.lines}`);
console.log('');
console.log('  rules read deterministically              :',
  `${extractRuleTriggers(catalogue.rules, catalogue.regulars).length} of ${catalogue.rules.length}`);
console.log('  (the rest stay prose for the reasoning consumer - they are never guessed at)');
console.log('');

const regressed = score.unauthorised_identity > 0 || score.avoidable_questions > 2
  || score.quantities_lost > 0 || score.correct < 35;
if (regressed) {
  console.error('REGRESSED against the outcome Warwick reconciled from the photograph.');
  process.exit(1);
}
