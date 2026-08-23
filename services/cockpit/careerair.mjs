// Fusion247 Cockpit — CareerAIR: the live opportunity grid, and the tailored-CV reading route.
//
// ── WHY THIS FILE IMPORTS NO DATABASE AND NO CREDENTIALS ─────────────────────────────────────────
// `db.mjs` opens two production pools at module scope, so anything that imports it CANNOT be
// executed by a gate — not "is not executed", could not be. `private-api.mjs`, `static.mjs`,
// `provenance.mjs`, `rotation-report.mjs` and `capae.mjs` were each shaped this way for that
// reason, and this file is the same move. It imports node builtins only; the READ pool arrives as
// the `q` parameter, exactly as `capaeResponse(q)` and `rotationReportsResponse(q)` take it.
// `services/cockpit/careerair-check.mjs` depends on that: every pure function below is exercised
// with no credentials present at all.
//
// ── THE READ ROLE, AND WHAT IT CANNOT SEE ────────────────────────────────────────────────────────
// Every query here runs as `cp_directus`, the SELECT-only pooler role, granted by
// services/control-plane/db/mypka/290_careerair_cockpit_read_grants.sql. That grant is deliberately
// narrow: three tables, SELECT only, and NO grant on `careerair.email_message`. This page cannot
// read Warwick's email content, and that is a property of the grant rather than of this code.
//
// ── THE CV ROUTE, AND THE BOUNDARY IT HOLDS ──────────────────────────────────────────────────────
// The tailored CVs are class `career_identifiable` and live ONLY in the private store. They are
// read at request time and never copied: no CV byte is written into `public/`, into this repository,
// into a fixture, or into a log line. Three properties hold that line, and all three are asserted by
// careerair-check.mjs:
//
//   1. NO DRIVE-LETTER LITERAL IN THIS REPOSITORY. The private root arrives in the environment
//      (`COCKPIT_CAREERAIR_ROOT`), absent by default and then serving nothing. Naming the path here
//      would put a machine path in a public repo AND bind the cockpit to one machine — the defect
//      `clone-portability-check.mjs` exists to record. Keel owns the variable's SHAPE and its
//      validation; MACK OWNS ITS VALUE (`credential_scope: none`, and the Keel/Mack config split).
//   2. LOOPBACK ONLY. The route refuses unless the server is bound to a loopback address, measured
//      from `server.address()` — the socket as it actually is, not the value that was requested.
//      The cockpit binds 127.0.0.1 and is fronted by `tailscale serve`; if that ever changes, this
//      route stops serving rather than quietly following the new binding out.
//
//      ⚠️ TWO LIMITS ON THAT SENTENCE, BOTH DELIBERATE, NEITHER A DEFECT — recorded because the
//      paragraph above reads stronger than it is.
//
//      (a) IT GUARDS THIS ROUTE ONLY. `/api/careerair/opportunities` and the detail route carry no
//          bind check, exactly like every other route on this server. If the cockpit were ever bound
//          to 0.0.0.0 the CVs would fail closed and the GRID WOULD STILL SERVE. That is consistent
//          with the rest of the cockpit rather than a regression, and the grid carries no
//          career-identifiable document text — but it is not "the page is protected".
//
//      (b) LOOPBACK IS NOT "THIS MACHINE". `tailscale serve` terminates on the tailnet and proxies
//          INTO 127.0.0.1, so the request arrives at this process from loopback however far away the
//          device is. Every device on Warwick's tailnet can therefore read the CVs. That is the
//          intended design — it is how he opens this on his phone — and the control this property
//          actually delivers is "not reachable from the PUBLIC Funnel", not "not reachable off this
//          machine".
//   3. THE OPPORTUNITY ID IS THE ONLY INPUT, AND IT IS DIGITS. The request never names a file. A
//      directory is SELECTED from a listing by its `<id>-` prefix; nothing the caller sends is ever
//      joined onto a path. That is why traversal is not a case to be filtered — there is no
//      caller-supplied path component to traverse WITH.
//
// The shape of 1 and the fail-closed posture are taken from `private-apps.mjs`; the origin policy in
// `server.mjs`'s use of `private-api.mjs` is the sibling control. Neither is re-implemented here.
import fs from 'node:fs';
import path from 'node:path';

/** The environment variable carrying the private CareerAIR root. Mack owns the value. */
export const CV_ROOT_ENV = 'COCKPIT_CAREERAIR_ROOT';

/** Applications live one directory per opportunity, under this relative path inside the root. */
export const APPLICATIONS_SUBPATH = ['runtime', 'applications'];

/** The one filename a CV is read from. Never caller-supplied. */
export const CV_FILENAME = 'cv.md';

export const JSON_HEADERS = Object.freeze({
  'content-type': 'application/json; charset=utf-8',
  // A tailored CV is career_identifiable. It is never cached by a browser, a proxy, or the service
  // worker — `public/sw.js` is network-first for /api/* anyway, and this makes it explicit rather
  // than inherited.
  'cache-control': 'no-store',
});

const realpath = (p) => (fs.realpathSync.native ? fs.realpathSync.native(p) : fs.realpathSync(p));

/** Resolve symlinks/junctions/short names where we can; fall back to the literal path. */
function real(p) {
  try { return realpath(p); } catch { /* may not exist */ }
  try { return path.join(realpath(path.dirname(p)), path.basename(p)); } catch { return p; }
}

/**
 * Is `child` inside `root`? Compared AFTER both have been resolved, with a separator boundary so a
 * sibling directory whose name merely starts with the root's name is not mistaken for a descendant.
 * Case-folded on win32 only, because that is where the filesystem itself folds case — the same
 * decision `private-apps.mjs` makes, and for the same reason.
 * @param {string} child @param {string} root
 */
function containedBy(child, root) {
  const fold = (p) => (process.platform === 'win32' ? String(p).toLowerCase() : String(p));
  return fold(child).startsWith(fold(root) + path.sep);
}

/**
 * Is this bind address a loopback one? Property 2 above.
 *
 * An ALLOWLIST, not a denylist of the addresses that happen to be public. An unrecognised or empty
 * bind is NOT loopback, so the unknown fails closed — the direction that matters, because the
 * failure being prevented is a private CV leaving the machine.
 * @param {string} bind
 */
export function isLoopbackBind(bind) {
  const b = String(bind || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (b === '::1' || b === 'localhost' || b === '::ffff:127.0.0.1') return true;
  // The whole 127.0.0.0/8 block is loopback, not just 127.0.0.1.
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(b);
}

/**
 * Resolve the configured private root, or say why there is none.
 *
 * OPT-IN and ABSOLUTE ONLY, both from `private-apps.mjs`'s reasoning: no variable means "there is
 * nothing here", and a relative path would resolve against the server's cwd, which is not a stable
 * property of how the cockpit was started.
 * @param {NodeJS.ProcessEnv} env
 * @returns {{ok: boolean, root: string|null, state: string, detail: string}}
 */
export function resolveCvRoot(env) {
  const raw = String((env || {})[CV_ROOT_ENV] || '').trim();
  if (!raw) return { ok: false, root: null, state: 'unconfigured', detail: CV_ROOT_ENV + ' is not set, so no CV is served.' };
  if (!path.isAbsolute(raw)) return { ok: false, root: null, state: 'not-absolute', detail: CV_ROOT_ENV + ' must be an absolute path.' };
  const root = real(path.resolve(raw));
  let stat = null;
  try { stat = fs.statSync(root); } catch { /* missing */ }
  if (!stat || !stat.isDirectory()) return { ok: false, root: null, state: 'missing', detail: CV_ROOT_ENV + ' does not resolve to a directory.' };
  return { ok: true, root, state: 'configured', detail: 'CV root resolved.' };
}

/**
 * The applications directory inside a resolved root.
 * @param {string} root
 */
export function applicationsDir(root) { return path.join(root, ...APPLICATIONS_SUBPATH); }

/**
 * Which opportunity ids have a CV on disk. Read by LISTING the applications directory — never by
 * probing a path built from anything a caller sent.
 *
 * Returns a Set of id strings. A missing or unreadable directory returns an EMPTY set, so the page
 * reports "no CV" rather than failing: an absent CV is an ordinary state, not an error.
 * @param {string} root
 * @returns {Set<string>}
 */
export function cvIdsOnDisk(root) {
  const ids = new Set();
  let entries = [];
  try { entries = fs.readdirSync(applicationsDir(root), { withFileTypes: true }); } catch { return ids; }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const m = /^(\d+)-/.exec(e.name);
    if (!m) continue;
    try { fs.statSync(path.join(applicationsDir(root), e.name, CV_FILENAME)); } catch { continue; }
    ids.add(m[1]);
  }
  return ids;
}

/**
 * The file a given opportunity's CV lives in, or null.
 *
 * `id` is validated to DIGITS ONLY and then used to MATCH a listed directory name — it is never a
 * path component. There is therefore nothing for a traversal, an 8.3 short name or an NTFS stream
 * suffix to act on: none of them survive the digits test, and the name that is joined onto the path
 * comes from `readdirSync`, not from the request.
 * @param {string} root @param {string|number} id
 * @returns {string|null}
 */
export function resolveCvPath(root, id) {
  const key = String(id);
  if (!/^\d+$/.test(key)) return null;
  const rootReal = real(path.resolve(root));
  let entries = [];
  try { entries = fs.readdirSync(applicationsDir(root), { withFileTypes: true }); } catch { return null; }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const m = /^(\d+)-/.exec(e.name);
    if (!m || m[1] !== key) continue;
    const fp = path.join(applicationsDir(root), e.name, CV_FILENAME);
    let st = null;
    try { st = fs.statSync(fp); } catch { continue; }
    if (!st.isFile()) continue;
    if (!containedBy(real(fp), rootReal)) continue;
    // ⛔ TWO LINK VECTORS, AND THEY NEED TWO DIFFERENT CHECKS. The containment test above resolves
    // symlinks and junctions, so a link POINTING out of the root is refused. It does NOT reach a
    // HARD LINK: a hard link is a second directory entry for the same file, so `realpath` returns
    // the path you handed it and the containment test passes clean. Established by execution, not
    // reasoned about — a planted hard link reported `nlink=2` with `realpath` equal to its own path,
    // while every genuine CV in the store reported `nlink=1`. `nlink > 1` is therefore the only
    // signal that distinguishes them, and it is the whole of the hard-link defence.
    if (st.nlink > 1) continue;
    return fp;
  }
  return null;
}

/**
 * Strip HTML comment blocks.
 *
 * Every fork carries an internal provenance header in an HTML comment — fork basis, privacy class,
 * submission state. It is a note to the writers, not part of the document Warwick reads, and it is
 * removed here so the reading view starts at his name.
 *
 * This is NOT the safety control. The client escapes every character it renders and passes no raw
 * HTML through, so a comment that survived this would print as visible text, never as markup. Two
 * layers, and the one that matters is the client's.
 * @param {string} md
 */
export function stripHtmlComments(md) { return String(md == null ? '' : md).replace(/<!--[\s\S]*?-->/g, ''); }

/**
 * Pull the two kinds of score out of an opportunity note.
 *
 * ⚠️ BOTH KINDS CAN APPEAR IN ONE NOTE, AND THEY OFTEN DISAGREE. Measured on the live set
 * 2026-08-23: 354 captured rows, 196 carrying a LARRY-SCORE, 229 carrying a RUBRIC-SCORE, **71
 * carrying both — and 60 of those 71 disagree.** Reading only the note's leading prefix, which is
 * the obvious implementation, silently hides a second, different score on 71 rows.
 *
 * They mean different things and are never merged into one number: LARRY-SCORE is hand-judged,
 * RUBRIC-SCORE is a rubric applied without individual judgement. NEITHER is a fit-gate result —
 * `careerair.fit_assessment` is the gate and it covers 4 opportunities of 354, so a note is
 * displayed as a note.
 * @param {string|null} note
 * @returns {{larry: number|null, rubric: number|null, disagree: boolean, primary: number|null}}
 */
export function parseScores(note) {
  const s = String(note == null ? '' : note);
  const grab = (kind) => {
    const m = new RegExp(kind + '-SCORE\\s+(\\d{1,2})\\s*/\\s*10').exec(s);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isInteger(n) && n >= 0 && n <= 10 ? n : null;
  };
  const larry = grab('LARRY');
  const rubric = grab('RUBRIC');
  return {
    larry,
    rubric,
    disagree: larry !== null && rubric !== null && larry !== rubric,
    // What sorting and filtering use when both exist. The HAND-JUDGED one wins, because a human
    // looked at it. Both are always shown; this only decides an ordering.
    primary: larry !== null ? larry : rubric,
  };
}

/**
 * The evidence tier behind a row — how much advert there actually was.
 *
 * ⚠️ THREE TIERS, NOT TWO, AND THE THIRD IS WHY. The obvious split is "has extracted fields" vs
 * "does not", which gives 189 / 165 on the live set. But 73 of those 189 rows have a
 * `requirements` field whose VALUE IS BLANK — a field row exists, and there is nothing in it. A
 * two-way split counts all 189 as evidenced and tells Warwick a score means more than it does,
 * which is precisely the false-green this distinction exists to expose. Measured 2026-08-23:
 * full 116 · partial 73 · thin 165 · total 354.
 *
 * This DISPLAYS the gap. It does not repair the acquisition receipt behind it — that is recorded in
 * the private baseline and is Warwick's to schedule.
 * @param {{hasRequirements: boolean, fieldRows: number}} r
 * @returns {'full'|'partial'|'thin'}
 */
export function tierOf(r) {
  if (r && r.hasRequirements) return 'full';
  if (r && Number(r.fieldRows) > 0) return 'partial';
  return 'thin';
}

/** First non-blank of the arguments, else null. Blank is never displayed as a value. */
export function firstPresent(...vals) {
  for (const v of vals) {
    const s = v == null ? '' : String(v).trim();
    if (s) return s;
  }
  return null;
}

/* =================================================================================================
   WARWICK'S OWN STATUS — the cockpit's lifecycle over a dataset it may only read.

   ⛔ THE DEFAULT IS THE ABSENCE OF A ROW. `todo` is what an opportunity is until he says otherwise,
   and it is expressed by `cockpit.careerair_status` having no row for it. 354 opportunities create
   ZERO rows on day one, and the read path supplies `todo` through a LEFT JOIN. Nothing is backfilled,
   so this table stays proportional to his decisions rather than to the collector's output.

   ⚠️ TWO ROLES, TWO POOLS, AND NO SHARED TRANSACTION — a DECLARED design decision, not a discovery.
   Migration 290 granted `cp_worker` NOTHING in the `careerair` schema, deliberately and in writing,
   so the write role cannot see the opportunity set it is validating against. Validation therefore
   runs on `q` (`cp_directus`, SELECT) and the write on `w` (`cp_worker`), which cannot be one
   transaction. The race that opens is: an opportunity is deleted between the check and the write, and
   a status row is left with nothing to attach to. That is a stale row costing three columns — never
   corruption, and never a status on the WRONG job. The alternative, granting `cp_worker` reach into
   `careerair`, reverses a boundary 290 argued for at length; this is the cheaper side of that trade.
   ================================================================================================= */

/** The four states. FROZEN — the DB carries the same list as a check constraint. */
export const STATUS_VALUES = Object.freeze(['todo', 'reviewed', 'applied', 'closed']);

/** What Warwick reads. The stored value is never shown to him raw. */
export const STATUS_LABELS = Object.freeze({
  todo: 'To do',
  reviewed: 'Reviewed',
  applied: 'Applied',
  closed: 'No longer accepting',
});

/** The state an opportunity is in when no row exists for it. */
export const DEFAULT_STATUS = 'todo';

/**
 * The canonical form of an opportunity id, or null.
 *
 * ONE CANONICAL FORM, matching migration 291's check constraint character for character. '1131',
 * '01131' and '1131 ' would otherwise be three different text keys for one job, and a `text primary
 * key` would not notice. Whitespace is trimmed because it cannot change WHICH opportunity is meant;
 * a leading zero is REFUSED because accepting it would create a second key for the same job.
 *
 * Bounded at 18 digits so `$1::bigint` in the existence check can never overflow — that would be a
 * 500 from a caller-supplied value, which is a defect even when it is not a vulnerability.
 * @param {unknown} id
 * @returns {string|null}
 */
export function normaliseOpportunityId(id) {
  if (id === null || id === undefined) return null;
  // A float or an unsafe integer never round-trips to a canonical id; refuse before String() makes
  // something plausible-looking out of it (`1e21` becomes '1e+21', `1131.0` becomes '1131').
  if (typeof id === 'number' && !Number.isSafeInteger(id)) return null;
  const s = String(id).trim();
  return /^[1-9][0-9]{0,17}$/.test(s) ? s : null;
}

/**
 * Is this exactly one of the four? Strict: no case folding and no trimming, so 'TODO' and ' todo'
 * are refused rather than quietly coerced. The DB constraint is equally strict, and two controls
 * that disagree about what is valid are one control plus a surprise.
 * @param {unknown} v
 */
export function isStatus(v) { return typeof v === 'string' && STATUS_VALUES.indexOf(v) !== -1; }

/**
 * The status of a row as read from the database. An absent row — and anything unrecognised — is
 * `todo`. The unrecognised branch is unreachable while the check constraint holds; it exists so that
 * a future migration widening the constraint cannot make the page render a raw enum value at Warwick.
 * @param {unknown} v
 */
export function normaliseStatus(v) { return isStatus(v) ? v : DEFAULT_STATUS; }

/** Does this opportunity exist in the set the GRID renders? Same predicate as LIST_SQL, deliberately. */
const STATUS_EXISTS_SQL = `
select 1 from careerair.opportunity
where opportunity_id = $1::bigint and intake_status = 'captured'
limit 1`;

/** Record the decision. One row per opportunity Warwick has actually touched. */
const STATUS_UPSERT_SQL = `
insert into cockpit.careerair_status (opportunity_id, status, updated_at)
values ($1, $2, now())
on conflict (opportunity_id) do update set status = excluded.status, updated_at = now()`;

/**
 * Record Warwick's status for one opportunity.
 *
 * Returns `{ status, body }` for the caller to write — no I/O on the response, so
 * `careerair-check.mjs` executes this function directly with stub pools and NO CREDENTIALS PRESENT.
 * That is the same shape `careerairCvResponse` uses and for the same reason.
 *
 * The refusals, in order, and every one fails CLOSED — none of them reaches `w`:
 *   400 bad_opportunity_id   — not the canonical form of an id.
 *   400 bad_status           — not one of the frozen four. An unknown value is NEVER written.
 *   404 unknown_opportunity  — no such opportunity in the set the grid renders.
 *   500 status_check_failed  — the read failed.
 *   500 status_write_failed  — the write failed.
 *
 * ⛔ NO BRANCH RETURNS `e.message`. Node and `pg` both embed context in error messages — a path, a
 * host, a role name (`password authentication failed for user "..."`). `e.code` tells an operator
 * everything the message would and names nothing. This is the same defect that was found in the CV
 * route's 500 branch and fixed in `724f19f`; it is not being reintroduced one route along.
 *
 * @param {{q: (sql: string, params?: any[]) => Promise<{rows: any[]}>, w: (sql: string, params?: any[]) => Promise<any>}} pools
 * @param {unknown} body
 */
export async function careerairStatusWrite(pools, body) {
  const q = pools && pools.q;
  const w = pools && pools.w;
  const src = body && typeof body === 'object' ? body : {};

  const id = normaliseOpportunityId(src.id);
  if (id === null) return { status: 400, body: { ok: false, error: 'bad_opportunity_id' } };
  if (!isStatus(src.status)) {
    return { status: 400, body: { ok: false, error: 'bad_status', allowed: STATUS_VALUES.slice() } };
  }

  // Validate against the REAL opportunity set before writing anything. A status for an id that does
  // not exist is a row nothing will ever render and nothing will ever clean up.
  let found = false;
  try {
    const r = await q(STATUS_EXISTS_SQL, [id]);
    found = Boolean(r && r.rows && r.rows.length);
  } catch (e) {
    return { status: 500, body: { ok: false, error: 'status_check_failed', detail: (e && e.code) || 'unknown' } };
  }
  if (!found) return { status: 404, body: { ok: false, error: 'unknown_opportunity', id } };

  try {
    await w(STATUS_UPSERT_SQL, [id, src.status]);
  } catch (e) {
    return { status: 500, body: { ok: false, error: 'status_write_failed', detail: (e && e.code) || 'unknown' } };
  }
  // The page reconciles against THIS body, not against what it sent. See careerair.js.
  return { status: 200, body: { ok: true, id, status: src.status, at: new Date().toISOString() } };
}

/**
 * Turn one database row into the shape the page renders.
 *
 * ⚠️ THE FALLBACK CHAIN IS LOAD-BEARING AND IT IS COUNTER-INTUITIVE. On the live set, 188 of 354
 * captured rows have a NULL `opportunity.role_title`, and those 188 are the RICH ones — their
 * title and employer live in `opportunity_field_current` under `title` and `organisation`. The 165
 * rows that DO carry `role_title` are mostly the thin ones. An implementation that reads
 * `o.role_title` alone renders "unknown" over exactly the 188 best opportunities — which are also
 * most of the ones that already have a tailored document written against them.
 *
 * A missing value becomes `null` and prints as "unknown". It is never dropped, and never invented.
 * @param {Record<string, any>} r
 */
export function shapeRow(r) {
  const hasRequirements = Number(r.has_req || 0) > 0;
  const fieldRows = Number(r.field_rows || 0);
  const scores = parseScores(r.note);
  return {
    id: String(r.opportunity_id),
    // Order matters: the opportunity's own column first where it has one, then the extracted field.
    title: firstPresent(r.role_title, r.f_title),
    employer: firstPresent(r.employer_name, r.f_org),
    salary: firstPresent(r.salary_text, r.f_value),
    location: firstPresent(r.f_location),
    employmentType: firstPresent(r.f_employment),
    closingDate: firstPresent(r.f_closing),
    summary: firstPresent(r.f_summary),
    url: firstPresent(r.source_url),
    // ⛔ THE RAW NOTE IS DELIBERATELY NOT IN THIS PAYLOAD. Measured on the live set: it is 64 KB of a
    // 248 KB list response — a quarter of the bytes, for a field nothing on the grid renders. The
    // scores are parsed out of it HERE, server-side, so the two chips survive; the prose itself is
    // returned by the detail route, which is already fetched at the moment it is first shown. This
    // page is opened on a phone, so a quarter of the payload is worth more than saving one round
    // trip on a panel most visits never expand.
    scores: { larry: scores.larry, rubric: scores.rubric, disagree: scores.disagree, primary: scores.primary },
    tier: tierOf({ hasRequirements, fieldRows }),
    // Warwick's own status. `r.status` is NULL for every opportunity he has never touched — the LEFT
    // JOIN in LIST_SQL guarantees the row is still here, and `todo` is supplied on the way past.
    status: normaliseStatus(r.status),
    statusAt: r.status_at ? new Date(r.status_at).toISOString() : null,
    firstSeen: r.first_seen_at ? new Date(r.first_seen_at).toISOString() : null,
    lastSeen: r.last_seen_at ? new Date(r.last_seen_at).toISOString() : null,
    submissions: Number(r.submission_count || 0),
    hasCv: false, // filled in by the response builder from the private store listing
  };
}

/*
 * ⛔ THIS STATEMENT NEVER FILTERS BY STATUS, AND THAT IS WHAT KEEPS `countsAgree` HONEST.
 *
 * `countsAgree` compares the rows this payload built against COUNT_SQL, an INDEPENDENT `count(*)`.
 * Hiding "no longer accepting" rows HERE would drop `rows.length` while COUNT_SQL stayed at the full
 * number, so the page would paint its red MISMATCH banner — correctly, because rows really would be
 * missing from the payload. The tempting repair is to add the same predicate to COUNT_SQL, and that
 * is the one that must never happen: two measurements that filter identically can no longer falsify
 * each other, and the guarantee becomes a field that always says true.
 *
 * So the payload always carries EVERY live opportunity, and hiding `closed` is done in the client,
 * where five other filters already live (`visibleRows` in public/careerair.js). The page then reports
 * what it is hiding and offers it back in one tap. `careerair-check.mjs` asserts both halves of this.
 *
 * The JOIN IS `LEFT`, and that is load-bearing rather than stylistic: an inner join would silently
 * drop every opportunity Warwick has never touched — on day one, all 354 of them.
 */
const LIST_SQL = `
with f as (
  select opportunity_id,
         max(case when field_name = 'title'           then nullif(btrim(field_value), '') end) as f_title,
         max(case when field_name = 'organisation'    then nullif(btrim(field_value), '') end) as f_org,
         max(case when field_name = 'location'        then nullif(btrim(field_value), '') end) as f_location,
         max(case when field_name = 'value'           then nullif(btrim(field_value), '') end) as f_value,
         max(case when field_name = 'employment_type' then nullif(btrim(field_value), '') end) as f_employment,
         max(case when field_name = 'closing_date'    then nullif(btrim(field_value), '') end) as f_closing,
         max(case when field_name = 'summary'         then nullif(btrim(field_value), '') end) as f_summary,
         count(*) filter (where field_name = 'requirements'
                            and nullif(btrim(field_value), '') is not null) as has_req,
         count(*) as field_rows
  from careerair.opportunity_field_current
  group by opportunity_id
)
select o.opportunity_id, o.role_title, o.employer_name, o.salary_text, o.source_url, o.note,
       o.first_seen_at, o.last_seen_at, o.submission_count,
       f.f_title, f.f_org, f.f_location, f.f_value, f.f_employment, f.f_closing, f.f_summary,
       coalesce(f.has_req, 0) as has_req, coalesce(f.field_rows, 0) as field_rows,
       s.status, s.updated_at as status_at
from careerair.opportunity o
left join f on f.opportunity_id = o.opportunity_id
left join cockpit.careerair_status s on s.opportunity_id = o.opportunity_id::text
where o.intake_status = 'captured'
order by o.opportunity_id`;

/**
 * The independent count. Deliberately a SEPARATE statement from the list — see below.
 *
 * ⛔ IT MUST NEVER LEARN ABOUT STATUS. It does not join `cockpit.careerair_status` and it carries no
 * status predicate. The moment it filters the way LIST_SQL filters, the two measurements stop being
 * independent and `countsAgree` becomes a field that cannot say no. Asserted by careerair-check.mjs.
 */
const COUNT_SQL = 'select count(*)::int as n from careerair.opportunity where intake_status = \'captured\'';

/**
 * The two statements, exported for the gate ONLY.
 *
 * `careerair-check.mjs` asserts properties OF THE SQL ITSELF — that the status join is LEFT and that
 * COUNT_SQL never mentions status. Those are exactly the two mistakes that would break `countsAgree`
 * silently, and neither is visible from the payload when the fixture happens to have a status row for
 * every opportunity. A check that can only see outputs cannot catch them; this is how it sees inputs.
 */
export const SQL_FOR_ASSERTION = Object.freeze({ list: LIST_SQL, count: COUNT_SQL });

const DETAIL_SQL = `
select field_name, field_value, confidence, is_long_form
from careerair.opportunity_field_current
where opportunity_id = $1
order by field_name`;

const DETAIL_OPP_SQL = `
select opportunity_id, role_title, employer_name, note, source_url, intake_status
from careerair.opportunity
where opportunity_id = $1`;

/**
 * The grid payload.
 *
 * ⚠️ `dbCount` IS A SECOND, INDEPENDENT MEASUREMENT AND THAT IS THE WHOLE POINT. It comes from its
 * own `count(*)` statement, not from `rows.length`. The acceptance property of this Work Order is
 * that the number of rows on screen equals the number of live opportunities the database holds —
 * and a count derived from the array you are counting cannot falsify anything. Two measurements
 * that must agree can; `careerair-check.mjs` asserts they do, and the page says so out loud when
 * they do not.
 *
 * NEVER THROWS. A database failure returns HTTP 200 `{ ok: false, error }`, the contract
 * `rotationReportsResponse` and `capaeResponse` already hold, so one bad read cannot take the
 * cockpit down with it.
 * @param {(sql: string, params?: any[]) => Promise<{rows: any[]}>} q
 * @param {NodeJS.ProcessEnv} [env]
 */
export async function careerairListResponse(q, env) {
  try {
    const [list, count] = await Promise.all([q(LIST_SQL), q(COUNT_SQL)]);
    const rootInfo = resolveCvRoot(env || {});
    const cvIds = rootInfo.ok ? cvIdsOnDisk(rootInfo.root) : new Set();
    const rows = list.rows.map((r) => {
      const row = shapeRow(r);
      row.hasCv = cvIds.has(row.id);
      return row;
    });
    const dbCount = Number(count.rows[0] ? count.rows[0].n : -1);
    const tiers = { full: 0, partial: 0, thin: 0 };
    for (const r of rows) tiers[r.tier] += 1;
    // ⚠️ DERIVED FROM `rows`, exactly like `tiers` and `cvCount` — it is a convenience for the page,
    // NOT a second independent measurement. `dbCount` is the only independent one on this payload and
    // it is the only one `countsAgree` is built from. Saying so here because a count that sits beside
    // an independent count starts to look like one.
    const statusCounts = { todo: 0, reviewed: 0, applied: 0, closed: 0 };
    for (const r of rows) statusCounts[r.status] += 1;
    return {
      ok: true,
      rows,
      dbCount,
      statusCounts,
      // The page renders this. A mismatch is shown to Warwick rather than hidden, because a grid
      // that quietly drops rows is the exact failure this field exists to make impossible.
      countsAgree: dbCount === rows.length,
      tiers,
      cvCount: rows.filter((r) => r.hasCv).length,
      // Whether the private store is wired at all. `cvSource` never carries the path — where the
      // private store lives is not something a public surface says.
      cvSource: rootInfo.state,
      at: new Date().toISOString(),
    };
  } catch (e) {
    return { ok: false, error: e.message, rows: [], dbCount: -1, statusCounts: { todo: 0, reviewed: 0, applied: 0, closed: 0 }, countsAgree: false, tiers: { full: 0, partial: 0, thin: 0 }, cvCount: 0, cvSource: 'unknown', at: new Date().toISOString() };
  }
}

/**
 * The long-form detail for ONE opportunity — requirements, responsibilities, the full note.
 *
 * Deliberately a second round trip rather than part of the grid: `requirements` and
 * `responsibilities` average ~485 and ~371 characters across 189 rows, and folding them into the
 * list would roughly quadruple the first payload on the device this page is FOR. Most visits expand
 * nothing.
 * @param {(sql: string, params?: any[]) => Promise<{rows: any[]}>} q @param {string|number} id
 */
export async function careerairDetailResponse(q, id) {
  const key = String(id == null ? '' : id).trim();
  if (!/^\d+$/.test(key)) return { ok: false, error: 'bad_opportunity_id', id: key, fields: [], blankFields: [] };
  try {
    const [opp, fields] = await Promise.all([q(DETAIL_OPP_SQL, [key]), q(DETAIL_SQL, [key])]);
    if (!opp.rows.length) return { ok: false, error: 'not_found', id: key, fields: [], blankFields: [] };
    const o = opp.rows[0];
    return {
      ok: true,
      id: key,
      note: firstPresent(o.note),
      scores: parseScores(o.note),
      fields: fields.rows
        .map((f) => ({ name: String(f.field_name), value: firstPresent(f.field_value), longForm: f.is_long_form === true, confidence: firstPresent(f.confidence) }))
        // A field row that exists with no value is NOT shown as an empty section. It is counted in
        // `blankFields` instead, so "the advert was thin here" stays visible rather than looking
        // like a rendering bug.
        .filter((f) => f.value !== null),
      blankFields: fields.rows.filter((f) => firstPresent(f.field_value) === null).map((f) => String(f.field_name)),
      at: new Date().toISOString(),
    };
  } catch (e) {
    return { ok: false, error: e.message, id: key, fields: [], blankFields: [] };
  }
}

/**
 * The tailored CV for one opportunity, as JSON, read at request time from the private store.
 *
 * Returns `{ status, body }` for the caller to write — this function performs no I/O on the
 * response, so a gate can execute it directly.
 *
 * The refusals, in order, and every one fails CLOSED:
 *   403 not_loopback   — the server is not bound to a loopback address (property 2).
 *   400 bad_id         — the id is not digits.
 *   503 no_cv_root     — the private store is not configured or does not resolve (property 1).
 *   404 no_cv          — there is no CV for this opportunity. An ORDINARY state, not an error.
 * @param {NodeJS.ProcessEnv} env @param {string|number} id @param {{bind: string}} opts
 */
export function careerairCvResponse(env, id, opts) {
  const bind = (opts || {}).bind;
  if (!isLoopbackBind(bind)) {
    return { status: 403, body: { ok: false, error: 'not_loopback', detail: 'The CV route serves only while the cockpit is bound to loopback.' } };
  }
  const key = String(id == null ? '' : id).trim();
  if (!/^\d+$/.test(key)) return { status: 400, body: { ok: false, error: 'bad_opportunity_id' } };
  const rootInfo = resolveCvRoot(env || {});
  if (!rootInfo.ok) return { status: 503, body: { ok: false, error: 'no_cv_root', detail: rootInfo.detail } };
  const fp = resolveCvPath(rootInfo.root, key);
  if (!fp) return { status: 404, body: { ok: false, error: 'no_cv', id: key } };
  let markdown = '';
  // ⛔ `e.code`, NEVER `e.message`. Node embeds the ABSOLUTE PATH in an fs error message, so
  // returning `e.message` here published the private store's location in a 500 body — and the page
  // then printed it on screen. That directly contradicted the note below, which was written about
  // the 200 response and was silently untrue of this branch. A code (`ENOENT`, `EACCES`, `EBUSY`)
  // tells an operator everything the message would, and names nothing.
  try { markdown = fs.readFileSync(fp, 'utf8'); } catch (e) { return { status: 500, body: { ok: false, error: 'cv_unreadable', detail: e.code || 'unknown' } }; }
  return {
    status: 200,
    // `markdown` is the ONLY CV-derived field. NO RESPONSE FROM THIS FUNCTION — success or failure —
    // carries the absolute path, and none of them is logged: where the private store lives is not
    // something this surface says. (That guarantee once held for this 200 body alone; the 500 branch
    // above leaked it until Vex found the contradiction.)
    body: { ok: true, id: key, markdown: stripHtmlComments(markdown), bytes: Buffer.byteLength(markdown, 'utf8'), at: new Date().toISOString() },
  };
}

/** One honest line at startup, so a misconfigured root is never indistinguishable from an absent one. */
export function careerairStartupLine(env) {
  const r = resolveCvRoot(env || {});
  if (r.ok) {
    const n = cvIdsOnDisk(r.root).size;
    return { level: 'log', message: 'CareerAIR: CV store configured — ' + n + ' tailored CV(s) readable. (Path not printed.)' };
  }
  return {
    level: r.state === 'unconfigured' ? 'log' : 'warn',
    message: 'CareerAIR: no CV store — ' + r.detail + ' The grid still renders; CV links will report "no CV".',
  };
}
