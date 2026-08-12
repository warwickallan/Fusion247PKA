// =====================================================================
// BUILD-015 AsdAIr - agenticVisionPrototype/fixtures/photo39.fixture.build.mjs
//
// WO-2026-08-12-02 (WP-B15-30), AC3: the one-shot authoring script that
// derived photo39.fixture.json.
//
// ⛔ TEST-DATA AUTHORING ONLY. Warwick: "This is TEST DATA ONLY. Do not turn
// it into production logic." Nothing outside this fixtures/ directory
// imports it, and no production path reads its output.
//
// IT IS COMMITTED FOR ONE REASON: the fixture's source_text column is
// NON-INDEPENDENT (transcribed from the photograph by a model), so the
// fixture's authority rests entirely on its derivation being auditable. A
// contested artefact with an invisible derivation is worse than none.
//
// USAGE (the 39-line list lives on main, not on this branch):
//   git show <main-sha>:Deliverables/2026-08-12-photo-ground-truth-39-lines.json > gt.json
//   node photo39.fixture.build.mjs --ground-truth=gt.json
//
// It re-runs the two cross-checks every time: the AC1 quantity rule against
// the human-anchored quantity column (exactly one known divergence, page 8),
// and a uniqueness check on the resolved catalogue ids. Either failing throws.
// =====================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { leadingQuantityEvidence } from '../../photoSanityChecks.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const gtArg = process.argv.find((a) => a.startsWith('--ground-truth='));
if (!gtArg) {
  throw new Error('photo39.fixture.build: --ground-truth=<path to the committed 39-line JSON> is required. '
    + 'That list is not on this branch; see the USAGE block above.');
}
const gt = JSON.parse(fs.readFileSync(gtArg.split('=').slice(1).join('='), 'utf8'));

// The 109-item household catalogue, taken from the WP-B15-29 Arm B artefact so
// the identity resolution is reproducible without a second database read.
const cat = JSON.parse(fs.readFileSync(
  path.join(HERE, '..', 'runs', '2026-08-12T18-45-44-097Z-arm-b.json'), 'utf8',
)).catalogue;

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const byName = new Map(cat.map((c) => [norm(c.name), c]));

// Identities that exact name matching does not reach, decided ONE AT A TIME by
// reading the catalogue, and recorded with the reason. `null` means NOT
// ESTABLISHED - AC3 says "intended catalogue identity WHERE ESTABLISHED", and a
// guess here would silently become the answer the model is graded against.
const MANUAL = {
  15: { id: null, why: 'The page says BIRDS EYE quarter pounders. The catalogue has Birds Eye BURGERS (19) and ASDA quarter pounders (118) - no Birds Eye quarter pounder. NOT ESTABLISHED; UNKNOWN_VISIBLE_ITEM is a correct answer here.' },
  21: { id: '87', why: 'Only Bloo product in the catalogue, and it is the same product class (toilet rim block).' },
  24: { id: '37', why: 'Catalogue name extends the ground-truth name verbatim (adds "limescale protection 15 tablets").' },
  27: { id: '12', why: 'Catalogue name is the ground-truth name with the brand repeated ("Dreamies DREAMIES ...").' },
  28: { id: null, why: 'Page says PLAIN TOFFEES. Catalogue holds ASDA Dairy Toffee (33), Toffee Assortment (49), Toffee Cheesecakes (78) - none is "plain toffees". NOT ESTABLISHED.' },
  35: { id: '107', why: 'Catalogue name is the ground-truth name with the active ingredient inserted (10mg Loratadine).' },
  36: { id: null, why: 'No lolly/ice-lolly/fruit-split product exists in the 109-item catalogue at all. NOT ESTABLISHED.' },
};

// ── THE TRANSCRIPTION. NON-INDEPENDENT: read off the photograph by Keel
//    (a model), upscaled ~2x, during WP-B15-30. Warwick has not verified it.
//    [page_order, column, source_text, ground_truth_index]
const PAGE = [
  [1, 'left', '4 x 4pts. ARLA SEMI Skimmed MiLk', 2],
  [2, 'left', '1 x 6pts ASDA SEMI Skimmed MiLk', 1],
  [3, 'left', '1 WARBURTS DANISH WHITE SLiCED BREAD', 3],
  [4, 'left', '2 CHiPS WiTH SKiNS ON', 4],
  [5, 'left', '1 MASHED POTATO', 5],
  [6, 'left', '1 PKT. ROAST BEEF', 6],
  [7, 'left', '1 PKT. HAM ON THE BONE', 7],
  [8, 'left', '16 Richmond SKiNLESS PORK SAUSAGES', 8],
  [9, 'left', '1 PKT. WHEETABIX PROTEIN', 9],
  [10, 'left', '2 RUSTLERS SAUSAGE muffins', 10],
  [11, 'left', "4 BATCHELORS PASTA in SAUCE. (CHEESE, LEEK and HAM)", 11],
  [12, 'left', '1 PRINCESS LEAN CORNED BEEF', 12],
  [13, 'left', '1 LURPACK BUTTER', 13],
  [14, 'left', '1 DOUBLE GLOUSTER CHEESE', 14],
  [15, 'left', '1 4PK. BIRDS EYE QUARTER POUNDERS', 15],
  [16, 'left', '3 YAZZO STRAWBERRY MiLK SHAKE', 16],
  [17, 'left', '2 YAZZO CHOCOLATE MiLK SHAKE', 17],
  [18, 'left', '2 4PK. LUCOZADE ORANGE SPORT', 18],
  [19, 'left', '1 ALWAYS DESCREE PANTY LiNERS normal', 19],
  [20, 'left', '1 FERBREEZE AIR MIST VANILLA', 20],
  [21, 'left', '2 BLOO TOILET Rim', 21],
  [22, 'left', '1 VANISH OXi PiNK', 22],
  [23, 'left', '1 LENOR OUTDOOR', 23],
  [24, 'left', '1 CALGON', 24],
  [25, 'left', '1 LOCTITE SUPERGLU', 25],
  [26, 'left', '3 GOURMET CAT FOOD. FISH', 26],
  [27, 'left', '1 DREAMiES CHEESE', 27],
  [28, 'right', '1 BAG ASDA PLAIN TOFFEES', 28],
  [29, 'right', '2 PKTS. ASDA SHORTBREAD Fingers', 29],
  [30, 'right', '1 6PK CHEESE ONION CRISPS', 30],
  [31, 'right', '2 PKTS. TWiX iCECREAM BARS', 31],
  [32, 'right', '1 PK. TWiX CHOC BiSCUiT BARS', 32],
  [33, 'right', '1 SULTARA + CHERRY CAKE', 33],
  [34, 'right', '2 PKTS. ASDA PARACETAMOL', 34],
  [35, 'right', '1 PKt. ASDA HAYFEVER TABS', 35],
  [36, 'right', '1 BOX ASDA FRUiT LOLLY iCES', 36],
  [37, 'right', '1 FERBREEZE FABRiC SPAY', 37],
  [38, 'right', '1 CAN DETTOL SPRAY', 38],
  [39, 'right', '1 2pack. KLEENEX TiSSUES', 39],
];

// Two heavily crossed-out lines. They are on the page and are NOT purchases:
// NOT_A_LINE is the correct answer, and omitting them is also correct. They
// are recorded so that reporting one as a product can be scored as an
// invention rather than silently ignored.
const STRUCK = [
  { after_page_order: 19, column: 'left', source_text: '(crossed out, illegible - ends "...MALE")' },
  { after_page_order: 25, column: 'left', source_text: '(crossed out, illegible)' },
];

// The ONE line where the deterministic rule and the human-anchored list
// disagree, and the ONE line where the page and the list name different
// products. Both are recorded, neither is resolved. A NEW disagreement
// appearing here later must fail this build rather than pass unnoticed.
const KNOWN_CONTESTED = {
  8: {
    quantity_rule_divergence:
      'AC1 applied to this text derives 16, because "16" IS the leading token. Warwick\'s ruling says the '
      + 'answer is 1 - the 16 names a 16-sausage pack. His written example puts the number AFTER the brand '
      + '("Richmond 16 sausages"), which the leading-count rule handles correctly; the page puts it FIRST, '
      + 'which it does not. Page text alone cannot separate "16 Richmond sausages" from "3 Yazoo milkshake". '
      + 'REPORTED, NOT TUNED AROUND: fitting a threshold to this input is the hardcoding failure mode.',
    identity_divergence:
      'The page reads 16. The list names the Richmond 12 pack. Either the list is wrong or the household '
      + 'regular differs from what was written. NOT RESOLVED HERE - the list is not adjusted (WO F13).',
  },
};

const lines = [];
const mismatches = [];
for (const [order, column, source, gtIndex] of PAGE) {
  const truth = gt[gtIndex - 1];
  if (!truth) throw new Error(`no ground-truth entry ${gtIndex}`);
  const evidence = leadingQuantityEvidence(source);
  const derived = evidence === null ? 1 : evidence;
  if (derived !== truth.qty) mismatches.push(`page ${order} "${source}" -> rule derives ${derived}, list says ${truth.qty}`);

  const manual = MANUAL[gtIndex];
  const exact = byName.get(norm(truth.product));
  const id = manual ? manual.id : (exact ? String(exact.id) : null);
  lines.push({
    page_order: order,
    column,
    source_text: source,
    source_text_provenance: 'NON-INDEPENDENT',
    ground_truth_index: gtIndex,
    catalogue_product: truth.product,
    expected_product_id: id,
    identity_established: id !== null,
    identity_note: manual ? manual.why : (exact ? 'exact catalogue name match' : 'unresolved'),
    expected_quantity: truth.qty,
    quantity_basis: evidence === null ? 'household-default-one' : 'explicit-on-page',
    ...(KNOWN_CONTESTED[gtIndex] ? { contested: KNOWN_CONTESTED[gtIndex] } : {}),
  });
}

// A disagreement between my transcription + the AC1 rule and the human-anchored
// quantity column is either a transcription error or a defect in the rule.
// Exactly one is known and recorded. Any other is a build failure.
const expectedMismatchOrders = Object.keys(KNOWN_CONTESTED).map(Number);
if (mismatches.length !== expectedMismatchOrders.length) {
  throw new Error(`quantity cross-check: ${mismatches.length} mismatch(es), expected exactly `
    + `${expectedMismatchOrders.length} known contested line(s):\n  ${mismatches.join('\n  ')}`);
}

const usedIds = lines.filter((l) => l.expected_product_id).map((l) => l.expected_product_id);
if (new Set(usedIds).size !== usedIds.length) throw new Error('a catalogue id is claimed by two fixture lines');
if (lines.length !== 39) throw new Error(`expected 39 lines, built ${lines.length}`);

const fixture = {
  fixture_version: '1.0.0',
  work_order: 'WO-2026-08-12-02 (WP-B15-30) AC3',
  photograph: 'tg-shopper-chat-8601328832-msg-86-AQADfhFrG0iN2FN-.jpg',
  TEST_DATA_ONLY: 'Warwick, 2026-08-12: "This is TEST DATA ONLY. Do not turn it into production logic." No production path may read this file.',
  provenance: {
    catalogue_product_and_expected_quantity:
      'HUMAN-ANCHORED. Copied byte-for-byte from Deliverables/2026-08-12-photo-ground-truth-39-lines.json '
      + '(read from main at d363a3a). That list\'s own provenance is unrecorded - see the committed ground-truth document.',
    source_text:
      'NON-INDEPENDENT. Transcribed from the photograph by Keel (a model) during WP-B15-30, from a ~2x upscaled '
      + 'render. It is the SAME CLASS OF INSTRUMENT as the one under test, so any score derived from it that '
      + 'grades visible-text/interpretation accuracy is NOT INDEPENDENTLY GRADED and must be reported as such. '
      + 'It is used as a JOIN KEY between a model reading and a page line - not as proof that the reading is right.',
    expected_product_id:
      'Resolved ONCE, before any re-score, against the 109-item household catalogue banked in the WP-B15-29 Arm B '
      + 'run artefact. Exact catalogue-name match where available; seven decided individually and recorded in '
      + '`identity_note`; three left NULL because the catalogue does not carry the product the page names.',
    ordering_evidence:
      'The committed 39-line list is in EXACT page order (left column top-to-bottom, then right column '
      + 'top-to-bottom). Established during transcription; it is corroboration of that list, not proof of it.',
  },
  contested_lines: lines.filter((l) => l.contested).map((l) => l.page_order),
  expected_purchase_lines: lines.length,
  identities_established: lines.filter((l) => l.identity_established).length,
  identities_not_established: lines.filter((l) => !l.identity_established).length,
  quantity_from_page: lines.filter((l) => l.quantity_basis === 'explicit-on-page').length,
  quantity_household_default: lines.filter((l) => l.quantity_basis === 'household-default-one').length,
  struck_through_lines: STRUCK,
  lines,
};

fs.writeFileSync(path.join(HERE, 'photo39.fixture.json'), `${JSON.stringify(fixture, null, 2)}\n`);
console.log('lines', lines.length,
  '| identities established', fixture.identities_established,
  '| not established', fixture.identities_not_established,
  '| qty from page', fixture.quantity_from_page,
  '| qty defaulted', fixture.quantity_household_default);
console.log('QUANTITY CROSS-CHECK (my transcription + AC1 rule vs the human-anchored qty column):',
  mismatches.length === 0 ? 'ALL 39 AGREE' : `${mismatches.length} MISMATCH(ES)`);
mismatches.forEach((m) => console.log('   ', m));
console.log('NOT ESTABLISHED:');
lines.filter((l) => !l.identity_established).forEach((l) => console.log('   page', l.page_order, '|', l.source_text, '->', l.catalogue_product));
