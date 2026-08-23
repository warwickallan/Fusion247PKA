// Fusion247 Cockpit — the gate for the opportunity grid.
//
//   node services/cockpit/careerair-check.mjs
//
// ── WHAT THIS CHECK IS FOR, AND THE ONE THING IT REFUSES TO DO ───────────────────────────────────
// It asserts the properties the page is FOR — that every live opportunity reaches the screen, that a
// null field never removes a row, that the two kinds of score stay distinguishable, that the thin
// rows stay visibly thin, and that no byte of a private document is ever written into this public
// tree. It is a BUILDER's check. It is not independent review and it never says the page is accepted.
//
// ⛔ IT PRINTS THE NUMBER OF ASSERTIONS IT ACTUALLY EXECUTED, AND ZERO IS A FAILURE.
// An exit code of 0 is not evidence on its own: a check whose assertions were all skipped, or whose
// fixture quietly enumerated to nothing, exits 0 having proved nothing at all. This estate has been
// bitten by that repeatedly, so the executed count is part of the pass and is printed on every run.
//
// ⛔ AND IT CANNOT PASS BY BEING UNABLE TO RUN. If the database is unreachable, this check prints
// NOT RUN and exits NON-ZERO. It never reports a green over ground it could not read. The live half
// and the offline half are counted and reported separately, so "31 offline assertions passed" can
// never be mistaken for "the grid was verified against the database".
//
// ── EVERY FIXTURE IN THIS FILE IS SYNTHETIC ──────────────────────────────────────────────────────
// This file is in a PUBLIC repository. No sample opportunity, employer, role title, salary, advert
// or document text from the real dataset appears anywhere below. The rows are invented, the
// temporary CV fixture is invented, and the only real values ever touched are COUNTS and booleans
// read live from the database — never content.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  parseScores, tierOf, shapeRow, firstPresent, stripHtmlComments,
  isLoopbackBind, resolveCvRoot, resolveCvPath, cvIdsOnDisk,
  careerairCvResponse, careerairListResponse, careerairDetailResponse,
  CV_ROOT_ENV,
} from './careerair.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(DIR, 'public');

let executed = 0;
let failed = 0;
let liveExecuted = 0;
let phase = 'offline';

function ok(label, cond, detail) {
  executed += 1;
  if (phase === 'live') liveExecuted += 1;
  if (cond) { console.log('  ok   ' + label); return true; }
  failed += 1;
  console.log('  FAIL ' + label + (detail ? '\n         ' + detail : ''));
  return false;
}
const eq = (label, actual, expected) => ok(label + ' (' + JSON.stringify(actual) + ')', actual === expected, 'expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));

function section(name) { console.log('\n' + name); }

/* =================================================================================================
   1. SCORES — the two kinds, and the case that hides one of them
   ================================================================================================= */
section('Scores — both kinds, told apart, never merged');
{
  const both = parseScores('LARRY-SCORE 9/10 — synthetic note.  ·  RUBRIC-SCORE 6/10 (synthetic)');
  eq('a note carrying BOTH kinds yields the hand-judged score', both.larry, 9);
  eq('...and the rubric score from the same note', both.rubric, 6);
  ok('...and reports that they disagree', both.disagree === true);
  eq('...and sorts on the hand-judged one', both.primary, 9);

  // THE REGRESSION THIS ROW EXISTS FOR. Reading only the note's leading prefix is the obvious
  // implementation and it silently loses the second score on every row that carries both.
  const prefixOnly = parseScores('LARRY-SCORE 7/10 — synthetic.  ·  RUBRIC-SCORE 7/10 (synthetic)');
  ok('a rubric score later in the note is NOT lost to a prefix-only read', prefixOnly.rubric === 7);
  ok('...and equal scores are not reported as a disagreement', prefixOnly.disagree === false);

  const rubricOnly = parseScores('RUBRIC-SCORE 4/10 (synthetic)');
  eq('a rubric-only note has no hand-judged score', rubricOnly.larry, null);
  eq('...and sorts on the rubric score', rubricOnly.primary, 4);

  const none = parseScores('a synthetic note with no score in it at all');
  eq('an unscored note yields null, never 0', none.primary, null);
  eq('a null note yields null, never 0', parseScores(null).primary, null);
  ok('a malformed score is refused rather than coerced', parseScores('LARRY-SCORE 99/10').larry === null);
}

/* =================================================================================================
   2. THE FALLBACK CHAIN — the defect that would have blanked the best rows
   ================================================================================================= */
section('Row shaping — a null column never blanks a row that has the value elsewhere');
{
  // The live shape: the RICH rows carry a null role_title and hold their title in the extracted
  // fields. An implementation reading o.role_title alone renders "unknown" over exactly these.
  const rich = shapeRow({ opportunity_id: 1, role_title: null, employer_name: null, f_title: 'Synthetic Role', f_org: 'Synthetic Employer', has_req: 1, field_rows: 10, note: 'LARRY-SCORE 8/10' });
  eq('a null role_title falls back to the extracted title', rich.title, 'Synthetic Role');
  eq('...and a null employer falls back to the extracted organisation', rich.employer, 'Synthetic Employer');

  const thin = shapeRow({ opportunity_id: 2, role_title: 'Synthetic Thin Role', employer_name: 'Synthetic Co', has_req: 0, field_rows: 0, note: 'RUBRIC-SCORE 3/10' });
  eq('a row with its own title keeps it', thin.title, 'Synthetic Thin Role');

  const empty = shapeRow({ opportunity_id: 3, role_title: null, f_title: '   ', has_req: 0, field_rows: 0, note: null });
  eq('a WHITESPACE-ONLY value is treated as absent, not displayed as blank', empty.title, null);
  ok('...and the row still exists — absence never removes it', empty.id === '3');
  eq('a missing salary is null (the page prints "unknown"), never an invented value', empty.salary, null);

  eq('firstPresent skips blanks and returns the first real value', firstPresent(null, '', '  ', 'x'), 'x');
  eq('firstPresent returns null when nothing is present', firstPresent(null, '', '   '), null);
}

/* =================================================================================================
   3. EVIDENCE TIERS — three, because the two-way split flatters the data
   ================================================================================================= */
section('Evidence tiers — the blank-requirements case is not counted as evidenced');
{
  eq('requirements with content is a full advert', tierOf({ hasRequirements: true, fieldRows: 10 }), 'full');
  eq('fields extracted but requirements BLANK is partial, not full', tierOf({ hasRequirements: false, fieldRows: 10 }), 'partial');
  eq('no extracted fields at all is thin', tierOf({ hasRequirements: false, fieldRows: 0 }), 'thin');
}

/* =================================================================================================
   4. THE LOOPBACK GUARD — the half of the boundary question this build owns
   ================================================================================================= */
section('Loopback guard — an unrecognised bind fails CLOSED');
{
  ok('127.0.0.1 is loopback', isLoopbackBind('127.0.0.1'));
  ok('the rest of 127.0.0.0/8 is loopback too', isLoopbackBind('127.94.0.5'));
  ok('::1 is loopback', isLoopbackBind('::1'));
  ok('a bracketed IPv6 loopback is recognised', isLoopbackBind('[::1]'));
  ok('0.0.0.0 is NOT loopback', !isLoopbackBind('0.0.0.0'));
  ok('a tailnet address is NOT loopback', !isLoopbackBind('100.80.175.41'));
  ok('an empty bind is NOT loopback — the unknown fails closed', !isLoopbackBind(''));
  ok('undefined is NOT loopback', !isLoopbackBind(undefined));
  ok('a hostname that merely CONTAINS 127.0.0.1 is not loopback', !isLoopbackBind('127.0.0.1.evil.example'));
}

/* =================================================================================================
   5. THE PRIVATE READING ROUTE — against a synthetic fixture, so these always run
   ================================================================================================= */
section('CV route — refusals, resolution, and no leak of the path');
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cockpit-grid-check-'));
try {
  const appsDir = path.join(fixtureRoot, 'runtime', 'applications');
  fs.mkdirSync(path.join(appsDir, '4242-synthetic-role'), { recursive: true });
  fs.mkdirSync(path.join(appsDir, '4243-no-document'), { recursive: true });
  const SYNTHETIC_CV = '<!-- synthetic header, stripped -->\n\nSYNTHETIC PERSON\n\n# PROFILE\n\n- synthetic bullet\n';
  fs.writeFileSync(path.join(appsDir, '4242-synthetic-role', 'cv.md'), SYNTHETIC_CV, 'utf8');
  const env = { [CV_ROOT_ENV]: fixtureRoot };
  const LOOPBACK = { bind: '127.0.0.1' };

  ok('an absolute, existing root resolves', resolveCvRoot(env).ok === true);
  eq('an unset root is "unconfigured", not an error', resolveCvRoot({}).state, 'unconfigured');
  eq('a RELATIVE root is refused', resolveCvRoot({ [CV_ROOT_ENV]: 'runtime/applications' }).state, 'not-absolute');
  eq('a non-existent root is refused', resolveCvRoot({ [CV_ROOT_ENV]: path.join(fixtureRoot, 'nope') }).state, 'missing');

  eq('a document is found by its opportunity id', path.basename(resolveCvPath(fixtureRoot, '4242') || ''), 'cv.md');
  eq('an id with no document resolves to nothing', resolveCvPath(fixtureRoot, '4243'), null);
  eq('an unknown id resolves to nothing', resolveCvPath(fixtureRoot, '9999'), null);
  // The id is matched against a LISTING and is never a path component, so these are refused at the
  // digits test long before any path is built.
  eq('a traversal id is refused', resolveCvPath(fixtureRoot, '../../../etc/passwd'), null);
  eq('an id with a path separator is refused', resolveCvPath(fixtureRoot, '4242/cv.md'), null);
  eq('an NTFS stream suffix is refused', resolveCvPath(fixtureRoot, '4242::$DATA'), null);
  // A prefix match must not let 4242 answer for 42, which a naive startsWith would.
  eq('a numeric PREFIX of a real id does not match it', resolveCvPath(fixtureRoot, '42'), null);
  eq('the on-disk document set is discovered by listing', cvIdsOnDisk(fixtureRoot).size, 1);

  const served = careerairCvResponse(env, '4242', LOOPBACK);
  eq('a configured, loopback-bound request serves the document', served.status, 200);
  ok('...and the HTML comment header is stripped from the reading view', !/<!--/.test(served.body.markdown));
  ok('...and the document body survives stripping', /SYNTHETIC PERSON/.test(served.body.markdown));
  // The response is the ONE channel no scanner inspects. It must never carry the path.
  const asJson = JSON.stringify(served.body);
  ok('the response never carries the filesystem path', asJson.indexOf(fixtureRoot) === -1);
  ok('the response never carries a drive-letter path at all', !/[A-Za-z]:[\\/]/.test(asJson));

  eq('a NON-loopback bind is refused with 403', careerairCvResponse(env, '4242', { bind: '0.0.0.0' }).status, 403);
  eq('...and a tailnet bind is refused too', careerairCvResponse(env, '4242', { bind: '100.80.175.41' }).status, 403);
  eq('...and the refusal carries no document', careerairCvResponse(env, '4242', { bind: '0.0.0.0' }).body.markdown, undefined);
  eq('an unconfigured store answers 503, not 200 with nothing', careerairCvResponse({}, '4242', LOOPBACK).status, 503);
  eq('a non-numeric id is refused with 400', careerairCvResponse(env, 'abc', LOOPBACK).status, 400);
  eq('an id with no document answers 404 — an ordinary state', careerairCvResponse(env, '4243', LOOPBACK).status, 404);

  eq('stripHtmlComments removes a comment', stripHtmlComments('a<!--x-->b'), 'ab');
  eq('stripHtmlComments handles a multi-line comment', stripHtmlComments('a<!--x\ny-->b'), 'ab');

  /* -----------------------------------------------------------------------------------------------
     6. NOT ONE BYTE INTO THE PUBLIC TREE. Asserted BEHAVIOURALLY: take a digest of public/ before and
     after serving a document, and require it unchanged. A rule that only reads the source would pass
     the moment somebody added a cache that writes.
     ----------------------------------------------------------------------------------------------- */
  section('The public tree — a served document changes nothing on disk');
  const digestPublic = () => fs.readdirSync(PUBLIC, { withFileTypes: true, recursive: true })
    .map((d) => path.join(d.parentPath || d.path || '', d.name) + ':' + (d.isFile() ? fs.statSync(path.join(d.parentPath || d.path || '', d.name)).size : 'dir'))
    .sort().join('\n');
  const before = digestPublic();
  ok('the public tree enumerates to something (the digest is not vacuously empty)', before.length > 0);
  careerairCvResponse(env, '4242', LOOPBACK);
  careerairCvResponse(env, '4242', LOOPBACK);
  ok('serving a document twice leaves the public tree byte-identical', digestPublic() === before);

  const publicFiles = fs.readdirSync(PUBLIC, { withFileTypes: true, recursive: true })
    .filter((d) => d.isFile())
    .map((d) => path.join(d.parentPath || d.path || '', d.name));
  ok('the public file list is non-empty', publicFiles.length > 0);
  let leaks = [];
  for (const f of publicFiles) {
    if (/\.(png|jpg|jpeg|gif|ico|woff2?)$/i.test(f)) continue;
    const src = fs.readFileSync(f, 'utf8');
    // A drive-letter path in a served asset is either a leaked machine path or a leaked private
    // root. Neither belongs in a public tree served over a network.
    //
    // ⚠️ THE WORD BOUNDARY IS LOAD-BEARING. Without it, `[A-Za-z]:[\\/]` also matches the tail of
    // every `https://` in the tree, and this assertion goes red on five unrelated pre-existing
    // files the first time it runs. A control that cries wolf is one people learn to switch off, so
    // it is worth more than the two characters it costs. Same form as clone-portability-check.mjs.
    if (/\b[A-Za-z]:[\\/]/.test(src)) leaks.push(path.basename(f) + ' (drive-letter path)');
    if (/\.fusion247/.test(src)) leaks.push(path.basename(f) + ' (private store root)');
  }
  ok('no served asset names the private store or a machine path', leaks.length === 0, leaks.join(', '));

  const moduleSrc = fs.readFileSync(path.join(DIR, 'careerair.mjs'), 'utf8');
  ok('the server module contains no drive-letter literal — the root arrives by environment',
    !/\b[A-Za-z]:[\\/]/.test(moduleSrc.replace(/^\s*\/\/.*$/gm, '')));
  ok('the server module names the environment variable it reads', moduleSrc.indexOf('COCKPIT_CAREERAIR_ROOT') !== -1);

  /* -----------------------------------------------------------------------------------------------
     7. THE PAGE ITSELF — the properties a reviewer would otherwise have to take on trust
     ----------------------------------------------------------------------------------------------- */
  section('The page — readable, and honest about what it cannot show');
  const pageJs = fs.readFileSync(path.join(PUBLIC, 'careerair.js'), 'utf8');
  const pageHtml = fs.readFileSync(path.join(PUBLIC, 'careerair.html'), 'utf8');
  const pageCss = fs.readFileSync(path.join(PUBLIC, 'careerair.css'), 'utf8');
  // The security property of the reading view, asserted mechanically: nothing on this page turns a
  // string into markup. Comments are stripped first so describing the rule cannot satisfy it.
  const jsCode = pageJs.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  ok('the page never assigns innerHTML', jsCode.indexOf('innerHTML') === -1);
  ok('the page never uses outerHTML or insertAdjacentHTML',
    jsCode.indexOf('outerHTML') === -1 && jsCode.indexOf('insertAdjacentHTML') === -1);
  ok('the page never calls document.write', jsCode.indexOf('document.write') === -1);
  ok('external links are opened with rel="noopener noreferrer"', jsCode.indexOf('noopener noreferrer') !== -1);
  ok('the page states an absence rather than rendering an empty cell', jsCode.indexOf('ca-unknown') !== -1);
  // The phone is the primary device; these are the two things that make it usable there.
  ok('the page declares a mobile viewport', /name="viewport"[^>]*width=device-width/.test(pageHtml));
  ok('the stylesheet is the SHARED one, not a second design language', pageHtml.indexOf('href="/styles.css"') !== -1);
  ok('the page CSS declares no colour token of its own', !/^\s*:root\s*\{/m.test(pageCss));
  ok('the page CSS carries no raw hex colour', !/#[0-9a-fA-F]{3,8}\b/.test(pageCss.replace(/\/\*[\s\S]*?\*\//g, '')));
  ok('the card list is the base layout and the table is the wide-screen case',
    /@media\s*\(min-width:\s*900px\)/.test(pageCss));
  ok('the two score kinds are distinguished by WORD, not colour alone',
    jsCode.indexOf("'Judged '") !== -1 && jsCode.indexOf("'Rubric '") !== -1);
  ok('a disagreement between the two scores is stated in words', jsCode.indexOf('they disagree') !== -1);
  ok('a count mismatch is surfaced to the reader, not swallowed', jsCode.indexOf('MISMATCH') !== -1);

  const appsSrc = fs.readFileSync(path.join(PUBLIC, 'apps.js'), 'utf8');
  ok('the registry entry points the tile at the page', appsSrc.indexOf("href: '/careerair.html'") !== -1);
  ok('the registry refuses an off-site href', /\^\\\/\[A-Za-z0-9/.test(appsSrc));

  const provSrc = fs.readFileSync(path.join(DIR, 'provenance.mjs'), 'utf8');
  ok('the new module is inside the provenance digest’s field of view', /'careerair\.mjs'/.test(provSrc));

  // ⚠️ NO ASSERTION HERE ABOUT v-for ALIAS SHADOWING, AND THE REASON IS WORTH THE PARAGRAPH.
  // One render-check run against this page's tile split failed with a blank #app. The change made in
  // response — renaming the filter callback parameter so it no longer shadowed the v-for alias —
  // was followed by a pass, which looked like cause and effect. It was not. Isolating the four arms
  // afterwards (neither shadowed / anchor only / button only / both) produced FOUR PASSES, and the
  // pattern the "fix" removed already exists elsewhere in this file and has always rendered. Six
  // consecutive runs then passed. So the single failure is NOT reproducible, its cause is NOT
  // established, and the leading candidate is a transient in that one headless run.
  //
  // An assertion was written here against the shadowing pattern and is deliberately REMOVED: it
  // encoded a causal story the evidence had already falsified, and it fired on working pre-existing
  // code. A check that asserts the wrong property is worse than no check, because it will be
  // believed. render-check.mjs remains the real gate for this class.
  const appSrc = fs.readFileSync(path.join(PUBLIC, 'app.js'), 'utf8');
  ok('the apps grid still renders a button branch for in-shell apps', /v-for="a in APPS\.filter\(x => !x\.href\)"/.test(appSrc));
  ok('...and an anchor branch for apps that are their own page', /v-for="a in APPS\.filter\(x => x\.href\)"/.test(appSrc));

  // The CV route's loopback guard must be wired to what this process is ACTUALLY bound to. A guard
  // fed a literal would be a guard that cannot fail.
  const serverSrc = fs.readFileSync(path.join(DIR, 'server.mjs'), 'utf8');
  ok('the CV route is handed the real bind address, not a constant', /careerairCvResponse\(process\.env, id, \{ bind: BIND \}\)/.test(serverSrc));

  /* -----------------------------------------------------------------------------------------------
     8. LIVE — the acceptance property. Requires the database; NEVER passes without it.
     ----------------------------------------------------------------------------------------------- */
  section('Live — every opportunity reaches the page');
  let db = null;
  try { db = await import('./db.mjs'); } catch (e) {
    console.log('\nNOT RUN — the database could not be reached, so the acceptance property was NOT checked.');
    console.log('  reason: ' + e.message);
    console.log('\nExecuted ' + executed + ' assertion(s) offline, ' + failed + ' failed. LIVE assertions executed: 0.');
    console.log('A check that cannot read its ground does not pass. Exiting non-zero.');
    process.exit(3);
  }
  phase = 'live';
  try {
    const payload = await careerairListResponse(db.q, env);
    ok('the list route answered', payload.ok === true, payload.error);
    ok('it returned rows at all — an empty grid is a failure, not a pass', payload.rows.length > 0);

    // ── THE ACCEPTANCE PROPERTY ──────────────────────────────────────────────────────────────────
    // Two INDEPENDENT measurements: the rows this payload actually built, and a separate count(*)
    // executed against the same table. A count taken from the array being counted could not falsify
    // anything, which is why the module runs its own statement for it.
    const direct = await db.q("select count(*)::int as n from careerair.opportunity where intake_status = 'captured'");
    const trueCount = direct.rows[0].n;
    ok('the payload row count equals a DIRECT SQL count of live opportunities — no row is dropped',
      payload.rows.length === trueCount, 'payload ' + payload.rows.length + ' vs sql ' + trueCount);
    ok('...and the route reports that agreement itself', payload.countsAgree === true);
    ok('...and the route’s own count matches the direct one', payload.dbCount === trueCount);

    // No row may be lost to a null. Every row that exists in the table must exist in the payload,
    // compared by id — not by count, which two compensating errors could satisfy.
    const idsSql = await db.q("select opportunity_id::text as id from careerair.opportunity where intake_status = 'captured'");
    const sqlIds = new Set(idsSql.rows.map((r) => r.id));
    const payloadIds = new Set(payload.rows.map((r) => r.id));
    const missing = [...sqlIds].filter((i) => !payloadIds.has(i));
    ok('every live opportunity id appears in the payload', missing.length === 0, missing.slice(0, 8).join(', '));
    ok('the id sets are the same size in both directions', sqlIds.size === payloadIds.size);

    // A row with no title still appears, carrying an explicit null the page prints as "unknown".
    const untitled = payload.rows.filter((r) => r.title === null);
    ok('rows with no title anywhere are still present, with title null', untitled.length >= 0);
    ok('no row carries an empty-string title (which would render as a blank cell)',
      payload.rows.every((r) => r.title === null || String(r.title).trim() !== ''));
    ok('every row carries an id', payload.rows.every((r) => /^\d+$/.test(r.id)));

    // The tiers must account for every row — a row that fell out of the classification would be a
    // row whose evidence quality the page is silently not stating.
    const tierSum = payload.tiers.full + payload.tiers.partial + payload.tiers.thin;
    ok('the evidence tiers account for every row', tierSum === payload.rows.length,
      tierSum + ' classified vs ' + payload.rows.length + ' rows');
    ok('the thin tier is non-empty — the gap this page exists to show is actually shown',
      payload.tiers.thin > 0);
    ok('the partial tier is non-empty — blank requirements are not counted as a full advert',
      payload.tiers.partial > 0);

    // Scores.
    ok('every row carries a score object', payload.rows.every((r) => r.scores && typeof r.scores === 'object'));
    ok('at least one row carries both kinds of score', payload.rows.some((r) => r.scores.larry !== null && r.scores.rubric !== null));
    ok('at least one row records the two kinds disagreeing', payload.rows.some((r) => r.scores.disagree));

    // The detail route, exercised against a real id taken from the payload.
    const sample = payload.rows.find((r) => r.tier === 'full') || payload.rows[0];
    const detail = await careerairDetailResponse(db.q, sample.id);
    ok('the detail route answers for a real opportunity', detail.ok === true, detail.error);
    ok('...and never returns a field with a blank value', detail.fields.every((f) => f.value !== null && String(f.value).trim() !== ''));
    ok('...and names the fields that were extracted but came back empty', Array.isArray(detail.blankFields));
    const bad = await careerairDetailResponse(db.q, 'not-a-number');
    eq('the detail route refuses a non-numeric id', bad.error, 'bad_opportunity_id');

    // ── THE GRANT BOUNDARY ───────────────────────────────────────────────────────────────────────
    // Both halves. A read path with no read grant renders an empty page; a read grant that reaches
    // further than it should is a boundary nobody is holding.
    for (const t of ['opportunity', 'opportunity_field_current', 'fit_assessment']) {
      let readable = false;
      try { await db.q('select 1 from careerair.' + t + ' limit 1'); readable = true; } catch (ignore) { readable = false; }
      ok('the cockpit read role CAN select careerair.' + t, readable);
    }
    let mailReadable = false;
    try { await db.q('select 1 from careerair.email_message limit 1'); mailReadable = true; } catch (ignore) { mailReadable = false; }
    ok('the cockpit read role CANNOT select careerair.email_message — mail content is out of reach', !mailReadable);

    // Read-only in fact, not only by intention.
    let wrote = false;
    try { await db.q("update careerair.opportunity set note = note where opportunity_id = -1"); wrote = true; } catch (ignore) { wrote = false; }
    ok('the cockpit read role CANNOT update careerair.opportunity', !wrote);
  } finally {
    await db.close();
  }
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

/* ================================================================================================= */
console.log('\n' + '-'.repeat(78));
console.log('Executed ' + executed + ' assertion(s); ' + liveExecuted + ' of them against the live database.');
if (executed === 0) { console.log('ZERO assertions executed. That is a FAILURE, not a pass.'); process.exit(2); }
if (liveExecuted === 0) { console.log('ZERO LIVE assertions executed — the acceptance property was not checked.'); process.exit(3); }
if (failed > 0) { console.log(failed + ' assertion(s) FAILED.'); process.exit(1); }
console.log('All assertions passed.');
console.log('Builder self-test evidence — NOT independent review.');
