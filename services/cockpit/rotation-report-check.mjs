// Fusion247 Cockpit — GATE: the rotation-report read layer, proved WITHOUT a database.
//
// Four things this gate holds, none of which inspection can establish:
//
//  1. ⭐ A SQL NULL NEVER BECOMES ZERO. Warwick: "Unknown, not established and zero are materially
//     different." This is asserted field by field, and — the part that actually decides it — against
//     a row that carries a genuine 0 and a genuine NULL AT THE SAME TIME. Any coalesce that flattens
//     unknown to zero passes a null-only test and passes a zero-only test; it fails only here.
//     The adversarial row is real: the 4A rotation has wo_first_dispatch_success = 0 (nought orders
//     survived first read-back — a measured failure) next to elapsed_minutes = null and
//     total_context_tokens_in = null (never measured at all).
//  2. NO POSTGRES IS TOUCHED. `db.mjs` constructs two live pools against production Postgres AT
//     MODULE LOAD, so this is not proved by reading imports and reasoning about them — a load hook
//     records every module the process actually resolves, and the assertion reads that record. The
//     recorder's own non-vacuity is asserted FIRST: "db.mjs is absent" is worthless if the recorder
//     observed nothing at all.
//  3. The failure path returns WORDS and leaks NOTHING. A pg error's `message` can carry a host, a
//     role or a connection detail; this asserts the rendered sentence contains none of it.
//  4. Ordering and joining are what the contract says: most recent first, specialists nested under
//     their own rotation, and a rotation that dispatched nobody returning [] rather than null.
//
// Exits non-zero on failure AND on a vacuous run.

import { registerHooks } from 'node:module';

// --- module-load recorder, installed BEFORE rotation-report.mjs is imported ----------------------
// Registered first, and the import below is dynamic for exactly that reason: a static import would be
// hoisted and resolved before this line ran, and the recorder would have watched nothing happen.
const LOADED = [];
registerHooks({
  load(url, context, nextLoad) {
    LOADED.push(url);
    return nextLoad(url, context);
  },
});

const mod = await import('./rotation-report.mjs');
const {
  ROTATION_ORDER_BY, ROTATION_SQL, SPECIALIST_SQL, SQLSTATE_REASONS,
  jsonList, jsonOrNull, mapRotation, mapSpecialist, num, readFailure,
  rotationReports, rotationReportsResponse, str, sumDispatches, toDateString, toIso,
  reportsOverview, reportSummary, findingHeadline,
} = mod;

let ran = 0, failed = 0;
const ok = (name, cond, detail = '') => {
  ran++;
  if (cond) console.log('  PASS  ' + name + (detail ? ' — ' + detail : ''));
  else { failed++; console.error('  FAIL  ' + name + (detail ? ' — ' + detail : '')); }
};

/** A query function over fixture rows. Mirrors pg's `{ rows }` and nothing else about pg. */
const fakeQuery = (rotations, specialists = []) => async (text, params) => {
  if (text === ROTATION_SQL) return { rows: rotations };
  if (text === SPECIALIST_SQL) {
    const ids = new Set((params?.[0] || []).map(String));
    return { rows: specialists.filter((s) => ids.has(String(s.rotation_id))) };
  }
  throw Object.assign(new Error('unexpected query'), { code: 'TEST' });
};

// ── 1. no Postgres, and the recorder is not looking at nothing ───────────────────────────────────
{
  const loadedNames = LOADED.map((u) => u.split('/').pop());
  ok('the load recorder actually observed rotation-report.mjs (the check is not vacuous)',
    loadedNames.includes('rotation-report.mjs'), `${LOADED.length} module(s) recorded`);
  ok('db.mjs was NEVER loaded — no live Postgres pool was constructed',
    !loadedNames.includes('db.mjs'), loadedNames.join(', ') || 'none');
  ok('nothing resolving to pg was loaded',
    !LOADED.some((u) => /[/\\]pg[/\\]/.test(u) || u.endsWith('/pg')),
    LOADED.filter((u) => /pg/i.test(u)).join(', ') || 'no pg-shaped module');
  ok('server.mjs was NEVER loaded (it is what imports db.mjs)',
    !loadedNames.includes('server.mjs'), loadedNames.join(', ') || 'none');
}

// ── 2. num(): the conversion where NULL turns into 0 if anyone is careless ───────────────────────
{
  ok('num(null) is null', num(null) === null, JSON.stringify(num(null)));
  ok('num(undefined) is null', num(undefined) === null, JSON.stringify(num(undefined)));
  ok('num(0) is 0 — a real zero survives', num(0) === 0, JSON.stringify(num(0)));
  ok("num('0') is 0 — pg sends numerics as strings", num('0') === 0, JSON.stringify(num('0')));
  ok("num('') is null, NOT 0 — Number('') is 0 and that is the trap", num('') === null, JSON.stringify(num('')));
  ok("num('   ') is null, not 0", num('   ') === null, JSON.stringify(num('   ')));
  ok("num('21.7') is the number 21.7 (numeric arrives as a string)", num('21.7') === 21.7, JSON.stringify(num('21.7')));
  ok("num('2221596') is a number (bigint/int8 ALSO arrives as a string)",
    num('2221596') === 2221596 && typeof num('2221596') === 'number', JSON.stringify(num('2221596')));
  ok('num of a non-numeric string is null, not 0', num('unknown') === null, JSON.stringify(num('unknown')));
  ok('num(NaN) is null', num(NaN) === null, JSON.stringify(num(NaN)));
  ok('str(null) is null, never ""', str(null) === null, JSON.stringify(str(null)));
  ok('str("") stays "" — an empty note is not an absent note', str('') === '', JSON.stringify(str('')));
  ok('jsonOrNull(null) is null (never recorded)', jsonOrNull(null) === null);
  ok('jsonList(null) is [] (none recorded)', Array.isArray(jsonList(null)) && jsonList(null).length === 0);
}

// ── 3. the realistic full row — the 4A rotation, with its genuine 0 beside its genuine nulls ─────
const ROT_4A = '2274c7ae-fc51-4e4a-9fdc-d29f9409627f';
const fullRow = {
  id: ROT_4A,
  created_at: new Date('2026-08-07T00:38:45.516Z'),
  session_date: new Date(2026, 7, 7),           // local midnight, exactly as pg builds a DATE
  branch: 'build-020/phase4-automation-law',
  closing_head: 'ccb4132e6d13a8f2e34f80019b8fefa79cdb1a6f',
  map_path: 'Deliverables/2026-08-04-proofline-wayfinder-plan.md',
  deliverable_path: 'Deliverables/2026-08-07-session-performance-report-subphase-4a.md',
  host: 'claude',
  host_version: null,                            // null is COMMON here and must survive
  elapsed_minutes: null,                         // TRUE UNKNOWN
  total_context_tokens_in: null,                 // TRUE UNKNOWN
  total_context_tokens_out: null,                // TRUE UNKNOWN
  total_subagent_tokens: '2221596',              // int8 → string from pg
  wo_total: 2,
  wo_first_dispatch_success: 0,                  // ⭐ TRUE ZERO, same row as the nulls above
  wo_amendments: 0,                              // ⭐ TRUE ZERO
  wo_refusals: 2,
  doc_lines_changed: 1667,
  product_lines_changed: 313,
  allocation_product_pct: '21.7',
  allocation_admin_pct: '8.9',
  allocation_evidence_pct: '29.9',
  allocation_rework_pct: '26.2',
  allocation_waiting_pct: null,                  // TRUE UNKNOWN
  git_stat: { commits: 14, doc_share_of_insertions_pct: 88.3 },
  work_orders: [{ id: 'WO-23' }, { id: 'WO-24' }],
  findings: [{ id: 'F1', confidence: 'high' }],
  unestablished: ['opening_context_tokens'],
  notes: 'Sub-phase 4A closure /rotate on the Claude host.',
};
const specialistRows4A = [
  { rotation_id: ROT_4A, specialist: 'veritas', dispatches: 4, tokens_in: null, tokens_out: null, notes: 'four rounds' },
  { rotation_id: ROT_4A, specialist: 'pax', dispatches: 3, tokens_in: null, tokens_out: null, notes: null },
  { rotation_id: ROT_4A, specialist: 'mack', dispatches: 3, tokens_in: null, tokens_out: null, notes: null },
  { rotation_id: ROT_4A, specialist: 'nolan', dispatches: 3, tokens_in: null, tokens_out: null, notes: null },
  { rotation_id: ROT_4A, specialist: 'keel', dispatches: 2, tokens_in: null, tokens_out: null, notes: 'both refused' },
];

const CONTRACT_KEYS = [
  'allocation', 'branch', 'closingHead', 'closingHeadShort', 'contextTokensIn', 'contextTokensOut',
  'createdAt', 'deliverablePath', 'elapsedMinutes', 'findings', 'gitStat', 'host', 'hostVersion',
  'id', 'lines', 'mapPath', 'notes', 'sessionDate', 'specialistDispatches', 'specialists',
  'subagentTokens', 'unestablished', 'workOrders',
];

{
  const r = mapRotation(fullRow, specialistRows4A);
  ok('the report carries EXACTLY the frozen contract keys',
    JSON.stringify(Object.keys(r).sort()) === JSON.stringify(CONTRACT_KEYS),
    Object.keys(r).sort().join(','));
  ok('id is the Supabase rotation id verbatim', r.id === ROT_4A, r.id);
  ok('createdAt is an ISO instant', r.createdAt === '2026-08-07T00:38:45.516Z', String(r.createdAt));
  ok('closingHead is the full 40 characters', r.closingHead.length === 40, String(r.closingHead.length));
  ok('closingHeadShort is the first 7, derived not stored', r.closingHeadShort === 'ccb4132', String(r.closingHeadShort));
  ok('subagentTokens converted from an int8 STRING to a JSON number',
    r.subagentTokens === 2221596 && typeof r.subagentTokens === 'number', JSON.stringify(r.subagentTokens));
  ok('allocation percentages converted from numeric STRINGS to numbers',
    r.allocation.productPct === 21.7 && r.allocation.reworkPct === 26.2, JSON.stringify(r.allocation));
  ok('lines maps doc/product line counts', r.lines.docChanged === 1667 && r.lines.productChanged === 313,
    JSON.stringify(r.lines));
  ok('gitStat is passed through verbatim', r.gitStat && r.gitStat.doc_share_of_insertions_pct === 88.3,
    JSON.stringify(r.gitStat));
  ok('findings passed through verbatim', Array.isArray(r.findings) && r.findings[0].id === 'F1',
    JSON.stringify(r.findings));
  ok('unestablished passed through verbatim', r.unestablished[0] === 'opening_context_tokens',
    JSON.stringify(r.unestablished));
  ok('specialists are nested and mapped', r.specialists.length === 5 && r.specialists[0].specialist === 'veritas',
    JSON.stringify(r.specialists.map((s) => s.specialist)));
  ok('specialistDispatches is the SUM of the nested rows', r.specialistDispatches === 15,
    JSON.stringify(r.specialistDispatches));
  ok('a specialist row with null tokens keeps them null, not 0',
    r.specialists[0].tokensIn === null && r.specialists[0].tokensOut === null,
    JSON.stringify([r.specialists[0].tokensIn, r.specialists[0].tokensOut]));
}

// ── 4. ⭐ THE CRITERION: null and zero in the SAME row, told apart field by field ────────────────
{
  const r = mapRotation(fullRow, specialistRows4A);

  // The genuine zeros. Asserted as `=== 0` AND `!== null`, so a coalesce cannot satisfy this by
  // accident and neither can a null.
  const zeros = [['workOrders.firstDispatchSuccess', r.workOrders.firstDispatchSuccess],
    ['workOrders.amendments', r.workOrders.amendments]];
  for (const [name, v] of zeros) {
    ok(`⭐ ${name} is a REAL ZERO and stays 0`, v === 0 && typeof v === 'number' && v !== null, JSON.stringify(v));
  }

  // The genuine unknowns — in the very same row.
  const unknowns = [['elapsedMinutes', r.elapsedMinutes], ['contextTokensIn', r.contextTokensIn],
    ['contextTokensOut', r.contextTokensOut], ['hostVersion', r.hostVersion],
    ['allocation.waitingPct', r.allocation.waitingPct]];
  for (const [name, v] of unknowns) {
    ok(`⭐ ${name} is UNKNOWN and stays null — not 0, "0", "" or "unknown"`,
      v === null && v !== 0 && v !== '0' && v !== '' && v !== 'unknown' && v !== undefined, JSON.stringify(v));
  }

  ok('⭐ zero and null are DIFFERENT VALUES in the same row',
    r.workOrders.firstDispatchSuccess === 0 && r.elapsedMinutes === null
      && r.workOrders.firstDispatchSuccess !== r.elapsedMinutes,
    `firstDispatchSuccess=${JSON.stringify(r.workOrders.firstDispatchSuccess)} elapsedMinutes=${JSON.stringify(r.elapsedMinutes)}`);

  // Through JSON, because that is how it reaches the browser — and JSON.stringify DROPS undefined
  // keys, so an accidental undefined would vanish rather than arriving as null.
  const wire = JSON.parse(JSON.stringify(r));
  for (const [name, _v] of unknowns) {
    const [a, b] = name.split('.');
    const holder = b ? wire[a] : wire;
    const key = b || a;
    ok(`⭐ after JSON, ${name} is PRESENT and null (an absent key is also a failure)`,
      Object.prototype.hasOwnProperty.call(holder, key) && holder[key] === null,
      JSON.stringify(holder[key]));
  }
  ok('⭐ after JSON, a real zero is still 0', wire.workOrders.firstDispatchSuccess === 0,
    JSON.stringify(wire.workOrders.firstDispatchSuccess));
}

// ── 5. the all-nulls row: every nullable field, enumerated, must be null ─────────────────────────
{
  const nullRow = {
    id: '00000000-0000-4000-8000-000000000000',
    created_at: null, session_date: null, branch: null, closing_head: null, map_path: null,
    deliverable_path: null, host: null, host_version: null, elapsed_minutes: null,
    total_context_tokens_in: null, total_context_tokens_out: null, total_subagent_tokens: null,
    wo_total: null, wo_first_dispatch_success: null, wo_amendments: null, wo_refusals: null,
    doc_lines_changed: null, product_lines_changed: null, allocation_product_pct: null,
    allocation_admin_pct: null, allocation_evidence_pct: null, allocation_rework_pct: null,
    allocation_waiting_pct: null, git_stat: null, work_orders: null, findings: null,
    unestablished: null, notes: null,
  };
  const r = mapRotation(nullRow, []);
  const wire = JSON.parse(JSON.stringify(r));

  const mustBeNull = [
    ['createdAt', wire.createdAt], ['sessionDate', wire.sessionDate], ['host', wire.host],
    ['hostVersion', wire.hostVersion], ['branch', wire.branch], ['closingHead', wire.closingHead],
    ['closingHeadShort', wire.closingHeadShort], ['mapPath', wire.mapPath],
    ['deliverablePath', wire.deliverablePath], ['elapsedMinutes', wire.elapsedMinutes],
    ['contextTokensIn', wire.contextTokensIn], ['contextTokensOut', wire.contextTokensOut],
    ['subagentTokens', wire.subagentTokens], ['specialistDispatches', wire.specialistDispatches],
    ['workOrders.total', wire.workOrders.total],
    ['workOrders.firstDispatchSuccess', wire.workOrders.firstDispatchSuccess],
    ['workOrders.amendments', wire.workOrders.amendments], ['workOrders.refusals', wire.workOrders.refusals],
    ['lines.docChanged', wire.lines.docChanged], ['lines.productChanged', wire.lines.productChanged],
    ['gitStat', wire.gitStat], ['allocation.productPct', wire.allocation.productPct],
    ['allocation.adminPct', wire.allocation.adminPct], ['allocation.evidencePct', wire.allocation.evidencePct],
    ['allocation.reworkPct', wire.allocation.reworkPct], ['allocation.waitingPct', wire.allocation.waitingPct],
    ['notes', wire.notes],
  ];
  for (const [name, v] of mustBeNull) {
    ok(`all-nulls row: ${name} is null and not 0/""/"0"`,
      v === null && v !== 0 && v !== '' && v !== '0', JSON.stringify(v));
  }
  ok('all-nulls row: findings is [] (schema default), not null',
    Array.isArray(wire.findings) && wire.findings.length === 0, JSON.stringify(wire.findings));
  ok('all-nulls row: unestablished is [], not null',
    Array.isArray(wire.unestablished) && wire.unestablished.length === 0, JSON.stringify(wire.unestablished));
  ok('all-nulls row: specialists is [], not null', Array.isArray(wire.specialists) && wire.specialists.length === 0,
    JSON.stringify(wire.specialists));
  ok('all-nulls row: no key was dropped by JSON (undefined would vanish)',
    JSON.stringify(Object.keys(wire).sort()) === JSON.stringify(CONTRACT_KEYS), Object.keys(wire).sort().join(','));
}

// ── 6. the true-zero row: a row where EVERY numeric is a real 0 ──────────────────────────────────
{
  const zeroRow = {
    id: 'z', created_at: null, session_date: null, branch: null, closing_head: null, map_path: null,
    deliverable_path: null, host: null, host_version: null,
    elapsed_minutes: '0', total_context_tokens_in: '0', total_context_tokens_out: '0',
    total_subagent_tokens: '0', wo_total: 0, wo_first_dispatch_success: 0, wo_amendments: 0,
    wo_refusals: 0, doc_lines_changed: 0, product_lines_changed: 0, allocation_product_pct: '0',
    allocation_admin_pct: '0', allocation_evidence_pct: '0', allocation_rework_pct: '0',
    allocation_waiting_pct: '0', git_stat: null, work_orders: [], findings: [], unestablished: [], notes: null,
  };
  const z = mapRotation(zeroRow, []);
  const n = mapRotation({ ...zeroRow, elapsed_minutes: null, total_context_tokens_in: null,
    total_subagent_tokens: null, wo_total: null, allocation_waiting_pct: null }, []);

  ok('true-zero row: elapsedMinutes 0 survives as 0', z.elapsedMinutes === 0, JSON.stringify(z.elapsedMinutes));
  ok('true-zero row: subagentTokens 0 survives as 0', z.subagentTokens === 0, JSON.stringify(z.subagentTokens));
  ok('true-zero row: allocation.waitingPct 0 survives as 0', z.allocation.waitingPct === 0,
    JSON.stringify(z.allocation.waitingPct));
  ok('true-zero row: workOrders.total 0 survives as 0', z.workOrders.total === 0, JSON.stringify(z.workOrders.total));
  ok('⭐ the SAME field is 0 in the zero row and null in the null row — the two are distinguishable',
    z.elapsedMinutes === 0 && n.elapsedMinutes === null
      && z.subagentTokens === 0 && n.subagentTokens === null
      && z.workOrders.total === 0 && n.workOrders.total === null,
    `zero=${JSON.stringify([z.elapsedMinutes, z.subagentTokens, z.workOrders.total])} null=${JSON.stringify([n.elapsedMinutes, n.subagentTokens, n.workOrders.total])}`);
  ok('⭐ the two rows do NOT serialise identically', JSON.stringify(z) !== JSON.stringify(n),
    'zero row and null row differ on the wire');
}

// ── 7. sumDispatches: a sum is where unknown quietly becomes zero ────────────────────────────────
{
  ok('no specialist rows → specialistDispatches is null, not 0', sumDispatches([]) === null,
    JSON.stringify(sumDispatches([])));
  ok('sumDispatches(null) is null', sumDispatches(null) === null);
  ok('rows summing to a real total give that total', sumDispatches([{ dispatches: 4 }, { dispatches: 2 }]) === 6,
    JSON.stringify(sumDispatches([{ dispatches: 4 }, { dispatches: 2 }])));
  ok('rows that genuinely dispatched nobody sum to 0, not null',
    sumDispatches([{ dispatches: 0 }, { dispatches: 0 }]) === 0,
    JSON.stringify(sumDispatches([{ dispatches: 0 }, { dispatches: 0 }])));
  ok('⭐ one UNKNOWN member makes the whole sum null — never a total that looks measured',
    sumDispatches([{ dispatches: 4 }, { dispatches: null }]) === null,
    JSON.stringify(sumDispatches([{ dispatches: 4 }, { dispatches: null }])));
}

// ── 8. dates: a DATE must not shift a day through UTC ────────────────────────────────────────────
{
  ok('a DATE at local midnight formats as its own calendar day, not the UTC one',
    toDateString(new Date(2026, 7, 7)) === '2026-08-07', String(toDateString(new Date(2026, 7, 7))));
  ok('a date string passes through unchanged', toDateString('2026-08-07') === '2026-08-07');
  ok('a null date stays null', toDateString(null) === null);
  ok('toIso(null) is null', toIso(null) === null);
  ok('toIso of a Date is an ISO instant', toIso(new Date('2026-08-07T00:38:45.516Z')) === '2026-08-07T00:38:45.516Z');
  // SIX now, not five: `tokens` is the MEASURED per-specialist total that populate.mjs has always
  // written and this mapper silently dropped, so every specialist cost rendered "not established"
  // while the number sat in the row. This assertion is what would have caught it — it did not,
  // because it asserted the shape the mapper HAD rather than the shape the schema supplies.
  ok('mapSpecialist maps its six contract fields, including the measured `tokens` total',
    JSON.stringify(Object.keys(mapSpecialist({ specialist: 'keel', dispatches: 2 })).sort())
      === JSON.stringify(['dispatches', 'notes', 'specialist', 'tokens', 'tokensIn', 'tokensOut']));
  ok('⭐ a measured token total survives the mapper as a number',
    mapSpecialist({ specialist: 'keel', dispatches: 2, tokens: '918273' }).tokens === 918273);
  ok('⭐ and an unmeasured one stays null, never 0',
    mapSpecialist({ specialist: 'keel', dispatches: 2, tokens: null }).tokens === null);
}

// ── 9. ordering, joining, and the empty table ────────────────────────────────────────────────────
{
  ok('the ordering column is created_at DESC and is declared in code', ROTATION_ORDER_BY === 'created_at desc',
    ROTATION_ORDER_BY);
  ok('the rotation query carries that ordering', ROTATION_SQL.includes('order by created_at desc'), ROTATION_SQL);
  ok('specialists are fetched by rotation_id, not by a second full scan',
    SPECIALIST_SQL.includes('rotation_id = any'), SPECIALIST_SQL);

  const older = { ...fullRow, id: 'aaaaaaaa-0000-4000-8000-000000000001', created_at: new Date('2026-08-01T00:00:00.000Z') };
  const newer = { ...fullRow, id: 'bbbbbbbb-0000-4000-8000-000000000002', created_at: new Date('2026-08-07T00:00:00.000Z') };
  // The database returns them most-recent-first; the module must preserve that order, not re-sort.
  const reports = await rotationReports(fakeQuery([newer, older], [
    { rotation_id: newer.id, specialist: 'keel', dispatches: 1, tokens_in: null, tokens_out: null, notes: null },
  ]));
  ok('two rotations come back most recent FIRST', reports[0].id === newer.id && reports[1].id === older.id,
    reports.map((r) => r.createdAt).join(' then '));
  ok('specialists attach to their OWN rotation', reports[0].specialists.length === 1 && reports[1].specialists.length === 0,
    JSON.stringify(reports.map((r) => r.specialists.length)));
  ok('a rotation with NO specialist rows returns [] — not null, not an error',
    Array.isArray(reports[1].specialists) && reports[1].specialists.length === 0,
    JSON.stringify(reports[1].specialists));
  ok('that rotation reports specialistDispatches null, not 0', reports[1].specialistDispatches === null,
    JSON.stringify(reports[1].specialistDispatches));

  const empty = await rotationReportsResponse(fakeQuery([]));
  ok('an empty table returns ok:true with an empty list, never an error',
    empty.ok === true && Array.isArray(empty.reports) && empty.reports.length === 0, JSON.stringify(empty));

  const good = await rotationReportsResponse(fakeQuery([fullRow], specialistRows4A));
  // Widened 2026-08-08 with the executive view: `overview` is the cross-session summary and each
  // report carries a derived `summary`. Still a CLOSED assertion — a fifth key is still a failure —
  // because the point of this check is that nothing sneaks into the envelope unnoticed.
  ok('the response envelope is exactly { ok, reports, overview }',
    JSON.stringify(Object.keys(good).sort()) === JSON.stringify(['ok', 'overview', 'reports']), Object.keys(good).join(','));
  ok('every report carries its derived summary',
    good.reports.every((r) => r.summary && typeof r.summary.headline === 'string'
      && Array.isArray(r.summary.measures) && typeof r.summary.unestablishedCount === 'number'),
    JSON.stringify(good.reports[0] && good.reports[0].summary && good.reports[0].summary.headline));
}

// ── 10. a query function that throws: words, HTTP-200 shape, and NO LEAK ─────────────────────────
{
  const SECRETS = [
    'postgresql://cp_directus:hunter2@db.abcdefgh.supabase.co:5432/postgres',
    'C:/Fusion247PKA/services/control-plane/wp-d-proof/.runtime-live/directus-live.env.json',
    'db.abcdefgh.supabase.co', 'hunter2',
  ];
  const denied = Object.assign(
    new Error(`permission denied for schema session_report; connecting as ${SECRETS[0]} using ${SECRETS[1]}`),
    { code: '42501' },
  );
  const throwing = async () => { throw denied; };
  const r = await rotationReportsResponse(throwing);

  ok('a database failure does NOT throw out of the response builder', typeof r === 'object' && r !== null);
  ok('it returns ok:false with an error string (HTTP 200 house pattern)',
    r.ok === false && typeof r.error === 'string' && r.error.length > 0, JSON.stringify(r));
  ok('the sentence says what is wrong IN WORDS', r.error.includes('has not been granted access'), r.error);
  for (const s of SECRETS) {
    ok(`the error string leaks nothing (${s.slice(0, 24)}…)`, !r.error.includes(s), r.error);
  }
  ok('the driver message is not echoed at all', !r.error.includes('permission denied for schema'), r.error);
  ok('no bare SQLSTATE is shown for a mapped code', !r.error.includes('42501'), r.error);

  // An UNMAPPED failure must still be safe — falls through to whyDown(), which also never reads
  // `message`. A bare code is uninformative but it is not a leak, and that is the right trade.
  const weird = Object.assign(new Error(`boom ${SECRETS[0]}`), { code: '99999' });
  const r2 = await rotationReportsResponse(async () => { throw weird; });
  ok('an UNMAPPED sqlstate still returns ok:false and still leaks nothing',
    r2.ok === false && !r2.error.includes(SECRETS[0]) && !r2.error.includes('boom'), r2.error);

  // A network-shaped failure, the case whyDown() was built for.
  const refused = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
  const r3 = await rotationReportsResponse(async () => { throw refused; });
  ok('a connection failure is explained in words by whyDown()', r3.ok === false && r3.error.includes('nothing is listening'),
    r3.error);
  ok('readFailure never surfaces a bare legacy NUMBER', typeof readFailure({ name: 'TimeoutError', code: 23 }) === 'string'
    && readFailure({ name: 'TimeoutError', code: 23 }) === 'it did not answer in time',
    readFailure({ name: 'TimeoutError', code: 23 }));
  ok('every mapped SQLSTATE reason is a human sentence, not a code',
    Object.values(SQLSTATE_REASONS).every((v) => typeof v === 'string' && v.length > 10 && !/^\d/.test(v)),
    Object.keys(SQLSTATE_REASONS).join(','));

  // A second route must be unaffected — the failure is contained in the returned value.
  const stillFine = await rotationReportsResponse(fakeQuery([fullRow], specialistRows4A));
  ok('a failed read does not poison the next read', stillFine.ok === true && stillFine.reports.length === 1,
    JSON.stringify(stillFine.ok));
}


// ── 12. reportsOverview: aggregates that live data proved wrong ──────────────────────────────────
// Both of these shipped and were caught by LOOKING AT THE LIVE ENDPOINT, not by this file. They are
// pinned here so the next edit cannot reintroduce them.
{
  const R = (over) => ({ workOrders: { total: null, firstDispatchSuccess: null, amendments: null, refusals: null },
    allocation: { reworkPct: null }, findings: [], unestablished: [], subagentTokens: null,
    contextTokensIn: null, contextTokensOut: null, sessionDate: '2026-01-01', ...over });

  // ⭐ success must never exceed total: a rotation with a numerator but no denominator contributes
  // to NEITHER half. Live data reported "13 of 7" before this was fixed.
  const mixed = reportsOverview([
    R({ workOrders: { total: 2, firstDispatchSuccess: 1, amendments: null, refusals: null } }),
    R({ workOrders: { total: null, firstDispatchSuccess: 6, amendments: null, refusals: null } }),
    R({ workOrders: { total: 5, firstDispatchSuccess: 2, amendments: null, refusals: null } }),
  ]);
  ok('⭐ WO first pass sums the PAIR, so success can never exceed total',
    mixed.woFirstPass.success === 3 && mixed.woFirstPass.total === 7,
    `${mixed.woFirstPass.success}/${mixed.woFirstPass.total}`);

  // ⭐ absent context tokens stay absent. `?? 0` reported a measured 0 across nine real sessions.
  const noCtx = reportsOverview([R({}), R({})]);
  ok('⭐ context tokens nobody established report null, never 0',
    noCtx.contextTokens === null, JSON.stringify(noCtx.contextTokens));

  const someCtx = reportsOverview([R({ contextTokensIn: 100, contextTokensOut: 20 }), R({})]);
  ok('⭐ and a single established value still sums, without the absent one contributing a zero',
    someCtx.contextTokens === 120, JSON.stringify(someCtx.contextTokens));

  ok('a trend is null when the two most recent rework values are not both established',
    reportsOverview([R({ allocation: { reworkPct: 10 } }), R({})]).trend === null);
}


if (ran === 0) { console.error('ROTATION-REPORT-CHECK FAIL — zero assertions executed.'); process.exit(1); }
if (failed) { console.error(`ROTATION-REPORT-CHECK FAIL — ${failed} of ${ran} assertions failed.`); process.exit(1); }
console.log(`ROTATION-REPORT-CHECK PASS — ${ran} assertions executed, 0 failed. NULL never became 0.`);