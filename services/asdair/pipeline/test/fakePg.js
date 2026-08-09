// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline/test/fakePg.js
//
// AN IN-MEMORY STAND-IN FOR `pg`, GOOD ENOUGH TO RUN THE REAL COMPONENTS.
//
// WHY THIS AND NOT A SCRIPTED FAKE: services/asdair/shop/fakeClient.js is a
// SCRIPT - it proves statement ORDER and SHAPE, which is exactly right for
// unit-testing a writer. It cannot prove IDEMPOTENCY or RESUMABILITY, because
// those are properties of STATE: "the second insert wrote nothing" is only
// meaningful if the first one is still there.
//
// So this file implements the handful of tables migration 006 defines, WITH
// THEIR UNIQUE INDEXES, and answers the exact statements the real
// shopStore.js and pipeline/store.js emit. The tests then run the REAL
// shopStore code - not a re-implementation of it - and a duplicate is refused
// by the same mechanism that refuses it in Postgres.
//
// The indexes modelled, because they ARE the idempotency:
//   shop_ref_uniq              (household_id, shop_ref)
//   shop_inbound_uniq          (telegram_chat_id, telegram_message_id) partial
//   shop_question_key_uniq     (shop_id, question_key)
//   bbr_one_live_per_shop      (shop_id) where status in queued|claimed|running
//   pending_action_key_uniq    (household_id, action_type, action_key) where pending
//   pipeline_command_idem_uniq (idempotency_key)                       TOTAL  [009]
//
// The CHECK constraints modelled, because a test that can write a status
// Postgres would refuse is a test that proves nothing:
//   shop_line_matched_needs_regular / shop_line_quantity_sane          [008]
//   pipeline_command_kind_known   kind   in ('command','outbox')       [009]
//   pipeline_command_status_known status in ('pending','running','done','failed','retired')
//
// NOT a Postgres emulator and not trying to be. An unrecognised statement is an
// ERROR, so a test cannot pass by silently running a query nobody modelled.
//
// Test support only. Synthetic fixtures; never real household data.
// =====================================================================

const SHOP_COLUMNS = [
  'id', 'household_id', 'shop_ref', 'status', 'source_kind',
  'telegram_chat_id', 'telegram_message_id', 'telegram_update_id',
  'raw_text', 'raw_media_path', 'transcript', 'transcript_provider',
  'transcript_model', 'transcript_confidence', 'needs_review', 'list_id',
  'last_error', 'created_at', 'updated_at',
];

function nowIso() { return '2026-08-03T09:00:00.000Z'; }

function clone(row) { return row === null || row === undefined ? row : { ...row }; }

/** The real writer stringifies jsonb parameters and casts them; a reader gets
 *  back what Postgres would return, so the fake parses on the way in. */
function asJson(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return null; }
  }
  return typeof value === 'object' ? value : null;
}

function rows(list) { return { rows: list.map(clone), rowCount: list.length }; }
function none() { return { rows: [], rowCount: 0 }; }

/** Parse the column list out of an INSERT so the fake stores the same shape the
 *  real statement carries, rather than a shape this file invented. */
function insertColumns(sql, table) {
  const re = new RegExp(`INSERT INTO ${table.replace('.', '\\.')}\\s*\\(([^)]*)\\)`, 'i');
  const m = re.exec(sql);
  if (!m) throw new Error(`fakePg: could not read the column list from: ${sql}`);
  return m[1].split(',').map((c) => c.trim());
}

/**
 * Read the projected column names out of a SELECT's own statement text.
 *
 * WHY THIS EXISTS - defect D1, veritas-wp-red-suite-recovery-0f8a1bc. The
 * listQuestions handler below used to hold a hard-coded list of the columns it
 * returned. That list was derived from nothing, so the statement could change
 * underneath it unnoticed: dropping `q.answer_text` from the real SELECT left
 * the suite green at 185/0, and so did dropping `sl.raw_reading` and leaving a
 * trailing comma before FROM - which is not even valid SQL. The fake answered
 * from its own literal and never read what it was asked for.
 *
 * The statement is the input now. This is insertColumns() above pointed at a
 * select list instead of an insert list, and it is the ONLY new mechanism here:
 * no SQL parser, no schema registry, no column-contract store.
 *
 * WHAT IT DETECTS, exactly:
 *   * a column DROPPED from the select list       - it stops being returned
 *   * a column ADDED that the fake cannot source  - the handler throws
 *   * a column RENAMED, or its alias changed      - same; the new name is unknown
 *   * an EMPTY item in the list                   - throws (the trailing comma)
 *   * no top-level FROM                           - throws
 *   * unbalanced parentheses in the select list   - throws
 *
 * WHAT IT DOES NOT DO, and must not be read as doing:
 *   * it does NOT validate SQL. Only the three malformations named above are
 *     caught. Any other syntax error passes straight through this function.
 *   * it does NOT check types, nullability, join semantics, ordering or
 *     cardinality.
 *   * it proves NOTHING about Postgres. It reads a string.
 *   * it does not understand string literals, subqueries or a bare `*`. It
 *     THROWS on anything it cannot read a plain column name out of, which is
 *     loud rather than lenient on purpose.
 */
export function selectProjection(sql) {
  const text = String(sql).replace(/\s+/g, ' ').trim();
  if (!/^SELECT /i.test(text)) throw new Error(`fakePg: not a SELECT statement: ${text}`);
  const body = text.replace(/^SELECT /i, '');
  const items = [];
  let depth = 0;
  let start = 0;
  let end = -1;
  for (let i = 0; i < body.length; i += 1) {
    const c = body[i];
    if (c === '(') { depth += 1; continue; }
    if (c === ')') {
      depth -= 1;
      if (depth < 0) throw new Error(`fakePg: unbalanced ")" in the select list of: ${text}`);
      continue;
    }
    if (depth !== 0) continue;
    if (c === ',') { items.push(body.slice(start, i)); start = i + 1; continue; }
    if ((i === 0 || body[i - 1] === ' ') && /^FROM /i.test(body.slice(i, i + 5))) { end = i; break; }
  }
  if (end === -1) {
    throw new Error(depth === 0
      ? `fakePg: no top-level FROM in: ${text}`
      : `fakePg: unbalanced "(" in the select list of: ${text}`);
  }
  items.push(body.slice(start, end));
  return items.map((raw) => {
    const item = raw.trim();
    if (item === '') throw new Error(`fakePg: empty item in the select list of: ${text}`);
    const aliased = / AS ([A-Za-z_][A-Za-z0-9_]*)$/i.exec(item);
    const name = aliased ? aliased[1] : item.split('.').pop();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      throw new Error(`fakePg: could not read a column name from the select item "${item}" in: ${text}`);
    }
    return name;
  });
}

/**
 * The asdair.shop_question columns this fake knows how to SOURCE.
 *
 * Read the role of this list carefully, because it looks like the literal that
 * caused D1 and it is not doing that job. The old literal decided WHAT WAS
 * RETURNED, which is why the statement could drift away from it in silence.
 * This one decides only WHETHER THE FAKE ADMITS IT CAN SERVE A NAME the
 * statement asked for; what is returned is whatever the statement selects.
 *
 * A name outside this list, and outside the two join-sourced names handled in
 * projectQuestionRow, is a THROW - never a silent null.
 *
 * The exact expected set is pinned in a literal held OUTSIDE this file, in
 * listQuestionsProjection.test.js, precisely so that editing the statement and
 * this list together still reddens the suite.
 */
const QUESTION_ROW_COLUMNS = new Set([
  'id', 'list_item_id', 'question_key', 'question_text', 'candidates', 'status',
  'answer_text', 'answer_source', 'card_chat_id', 'card_message_id',
  'rendered_candidates', 'render_fingerprint', 'render_version', 'callback_index',
]);

/**
 * Build ONE result row for the listQuestions projection.
 *
 * `item_name` and `photographed_wording` go through here with everything else.
 * They used to be attached by the handler unconditionally, outside the column
 * list altogether - which is why dropping `sl.raw_reading AS photographed_wording`
 * stayed green even though runPipeline.test.js genuinely asserts on that field.
 * A consumer assertion existed and still could not fire.
 */
function projectQuestionRow(projection, question, listItem, shopLine) {
  const row = {};
  for (const name of projection) {
    if (QUESTION_ROW_COLUMNS.has(name)) {
      row[name] = question[name] === undefined ? null : question[name];
      continue;
    }
    if (name === 'item_name') {
      row[name] = listItem ? listItem.item_name : null;
      continue;
    }
    if (name === 'photographed_wording') {
      row[name] = shopLine && shopLine.raw_reading !== undefined ? shopLine.raw_reading : null;
      continue;
    }
    throw new Error(`fakePg: the select list asks for "${name}", which this fake does not model. `
      + 'Teach it where that column comes from, or the statement is asking asdair.shop_question '
      + 'and its two LEFT JOINs for something they cannot give.');
  }
  return row;
}

/**
 * The asdair.browser_build_request columns this fake can SOURCE.
 *
 * Same role as QUESTION_ROW_COLUMNS above, and read it the same way: this list
 * does NOT decide what a statement returns. It decides only whether the fake
 * admits it can serve a name the statement asked for. A name outside it throws.
 *
 * It is the full column set migration 006 defines for the table, which is also
 * exactly `handoff/claim.js`'s SELECT_COLS. If claim.js grows a column, the
 * statement will ask for it, this list will not have it, and the fake will say
 * so out loud instead of answering with a null the caller cannot distinguish
 * from a real one.
 */
const BROWSER_REQUEST_COLUMNS = new Set([
  'id', 'shop_id', 'status', 'claimed_by', 'progress',
  'requested_at', 'claimed_at', 'finished_at', 'last_error',
]);

/**
 * Check a browser_build_request projection BEFORE any row is looked at.
 *
 * The eager call is the whole point, and it was found by demonstration rather
 * than by reasoning: validating inside the row loop means a statement asking for
 * a column the fake cannot source returns an EMPTY RESULT whenever nothing
 * matched the WHERE - which is a silent wrong answer of exactly the kind D1 was.
 * "No rows" is a perfectly ordinary outcome here (no live request, no completed
 * request), so the empty case is the common one, not the edge one.
 */
function assertBrowserProjection(projection) {
  for (const name of projection) {
    if (!BROWSER_REQUEST_COLUMNS.has(name)) {
      throw new Error(`fakePg: the select list asks for "${name}", which this fake does not model on `
        + 'asdair.browser_build_request. Teach it where that column comes from, or the statement is '
        + 'asking the table for something it cannot give.');
    }
  }
  return projection;
}

/** Build ONE result row for an already-checked browser_build_request projection. */
function projectBrowserRow(projection, row) {
  const out = {};
  for (const name of projection) out[name] = row[name] === undefined ? null : row[name];
  return out;
}

/** Map positional params onto the insert's columns, honouring ::jsonb casts. */
function insertRow(sql, table, params) {
  const cols = insertColumns(sql, table);
  const row = {};
  cols.forEach((col, i) => {
    let v = params[i];
    if (typeof v === 'string' && /^[[{"]/.test(v.trim())) {
      // The real writer stringifies jsonb parameters and casts them; store the
      // parsed value so a reader sees what Postgres would return.
      try { v = JSON.parse(v); } catch { /* keep the string */ }
    }
    row[col] = v === undefined ? null : v;
  });
  return row;
}

export function createFakeDatabase(seed = {}) {
  const db = {
    shop: [],
    shop_event: [],
    shop_question: [],
    shop_line: [],
    // asdair.shop_source_image (migration 016) - the exact-source image
    // binding. PRIMARY KEY on shop_id IS the first-write-wins idempotency, so
    // it is modelled as a real unique index below, not as a convenience map.
    shop_source_image: [],
    // asdair.shop_decision (migration 017) - what an answer MEANT for this
    // week. UNIQUE (question_id) is modelled as a real index below.
    shop_decision: [],
    browser_build_request: [],
    pending_action: [],
    pipeline_command: [],
    households: [{ id: 1, name: 'test-household', display_name: 'Test Household' }],
    shopping_lists: [],
    shopping_list_items: [],
    order_confirmation: [],
    order_confirmation_line: [],
    // asdair.rule_qa_log - the decision log promoteDecision always writes, and
    // the table skill/data.js loadRuleQaLog() reads back as `priorAnswers`. It
    // is the whole mechanism by which an answer given this week stops the same
    // question being asked next week, so the pipeline suite has to be able to
    // see a row land in it.
    rule_qa_log: [],
    ...seed,
  };
  const nextId = {};
  const id = (table) => {
    const existing = (db[table] || []).reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);
    nextId[table] = Math.max(nextId[table] || 0, existing) + 1;
    return nextId[table];
  };
  return { db, id };
}

/**
 * A `pg`-shaped client over an in-memory database.
 *
 * `log` records every statement in order, so a test can still assert on ORDER
 * (that the status UPDATE and its audit INSERT are adjacent, say) as well as on
 * the resulting state.
 */
export function createFakeClient(store, options = {}) {
  const { db, id } = store;
  const log = [];
  let failNext = options.failNext || null;

  const PIPELINE_COMMAND_KINDS = ['command', 'outbox'];
  const PIPELINE_COMMAND_STATUSES = ['pending', 'running', 'done', 'failed', 'retired'];

  /** Migration 009's two CHECK constraints. A test must not be able to write a
   *  kind or a status the live database would reject. */
  function assertPipelineCommandChecks(row) {
    if (!PIPELINE_COMMAND_KINDS.includes(row.kind)) {
      throw new Error(`fakePg: CHECK pipeline_command_kind_known violated (kind = "${row.kind}")`);
    }
    if (!PIPELINE_COMMAND_STATUSES.includes(row.status)) {
      throw new Error(`fakePg: CHECK pipeline_command_status_known violated (status = "${row.status}")`);
    }
  }

  /**
   * INSERT ... ON CONFLICT (idempotency_key) DO NOTHING.
   *
   * pipeline_command_idem_uniq is TOTAL - it covers finished rows too - so a
   * second insert of a key that a DONE row already holds writes nothing. That
   * is the exact behaviour store.recordLedgerEntry's generation exists to cope
   * with, and modelling it faithfully is what makes the test meaningful.
   */
  function insertPipelineCommand(spec) {
    const row = {
      shop_id: spec.shop_id ?? null,
      kind: spec.kind,
      command: spec.command,
      args: asJson(spec.args) || {},
      idempotency_key: spec.idempotency_key,
      status: spec.status || 'pending',
      attempts: 0,
      last_error: null,
      result: asJson(spec.result),
      created_at: spec.created_at || nowIso(),
      updated_at: spec.updated_at || nowIso(),
    };
    assertPipelineCommandChecks(row);
    if (typeof row.idempotency_key !== 'string' || row.idempotency_key === '') {
      throw new Error('fakePg: NOT NULL violation on pipeline_command.idempotency_key');
    }
    if (db.pipeline_command.some((c) => c.idempotency_key === row.idempotency_key)) return none();
    const created = { id: id('pipeline_command'), ...row };
    db.pipeline_command.push(created);
    return rows([created]);
  }

  const handlers = [
    // ── transaction markers ────────────────────────────────────────────────
    [/^(BEGIN|COMMIT|ROLLBACK)/i, () => none()],
    [/^BEGIN TRANSACTION READ ONLY/i, () => none()],
    [/^SELECT pg_advisory_xact_lock/i, () => none()],

    // ── asdair.shop ────────────────────────────────────────────────────────
    [/^INSERT INTO asdair\.shop \(/i, (sql, params) => {
      const row = insertRow(sql, 'asdair.shop', params);
      // shop_ref_uniq
      if (db.shop.some((s) => String(s.household_id) === String(row.household_id) && s.shop_ref === row.shop_ref)) return none();
      // shop_inbound_uniq (PARTIAL - only rows carrying BOTH)
      if (row.telegram_chat_id !== null && row.telegram_message_id !== null
        && db.shop.some((s) => s.telegram_chat_id === row.telegram_chat_id && s.telegram_message_id === row.telegram_message_id)) return none();
      const created = {
        ...Object.fromEntries(SHOP_COLUMNS.map((c) => [c, null])),
        ...row,
        id: id('shop'),
        status: row.status || 'RECEIVED',
        needs_review: row.needs_review === true,
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      db.shop.push(created);
      return rows([created]);
    }],
    [/^UPDATE asdair\.shop SET /i, (sql, params) => {
      // The real statement is built dynamically: SET <cols> WHERE id = $n AND status = $m
      const assignments = /SET (.*?) WHERE id = \$(\d+) AND status = \$(\d+)/is.exec(sql);
      if (!assignments) throw new Error(`fakePg: unrecognised shop UPDATE: ${sql}`);
      const shopId = params[Number(assignments[2]) - 1];
      const expected = params[Number(assignments[3]) - 1];
      const target = db.shop.find((s) => String(s.id) === String(shopId) && s.status === expected);
      if (!target) return none();
      for (const part of assignments[1].split(',').map((p) => p.trim())) {
        const [col, expr] = part.split('=').map((x) => x.trim());
        if (expr === 'now()') { target[col] = nowIso(); continue; }
        const pIdx = /^\$(\d+)$/.exec(expr);
        if (!pIdx) throw new Error(`fakePg: unrecognised SET expression "${part}"`);
        target[col] = params[Number(pIdx[1]) - 1];
      }
      return rows([target]);
    }],
    [/FROM asdair\.shop WHERE telegram_chat_id = \$1 AND telegram_message_id = \$2/i, (sql, p) =>
      rows(db.shop.filter((s) => s.telegram_chat_id === p[0] && s.telegram_message_id === p[1]))],
    [/FROM asdair\.shop WHERE household_id = \$1 AND shop_ref = \$2/i, (sql, p) =>
      rows(db.shop.filter((s) => String(s.household_id) === String(p[0]) && s.shop_ref === p[1]))],
    [/FROM asdair\.shop WHERE id = \$1/i, (sql, p) =>
      rows(db.shop.filter((s) => String(s.id) === String(p[0])))],
    [/FROM asdair\.shop WHERE shop_ref = \$1/i, (sql, p) =>
      rows(db.shop.filter((s) => s.shop_ref === p[0]).sort((a, b) => a.id - b.id))],
    [/FROM asdair\.shop\s+WHERE status NOT IN/i, (sql, p) => {
      const consumable = Array.isArray(p[0]) ? p[0] : [];
      const withWork = new Set(db.pipeline_command
        .filter((c) => c.status === 'pending' && c.kind === 'command' && c.shop_id !== null
          && consumable.includes(c.command))
        .map((c) => String(c.shop_id)));
      return rows(db.shop
        .filter((s) => !['RECONCILED', 'CANCELLED'].includes(s.status) || withWork.has(String(s.id)))
        .sort((a, b) => a.id - b.id));
    }],

    // ── asdair.shop_event ──────────────────────────────────────────────────
    [/^INSERT INTO asdair\.shop_event \(/i, (sql, p) => {
      const row = {
        id: id('shop_event'), shop_id: p[0], event_type: p[1], from_status: p[2],
        to_status: p[3], description: p[4], occurred_at: nowIso(),
      };
      db.shop_event.push(row);
      return rows([{ id: row.id, occurred_at: row.occurred_at }]);
    }],
    [/FROM asdair\.shop_event\s+WHERE shop_id = \$1 AND event_type = 'failure'/i, (sql, p) => {
      const hits = db.shop_event.filter((e) => String(e.shop_id) === String(p[0]) && e.event_type === 'failure')
        .sort((a, b) => b.id - a.id);
      return rows(hits.slice(0, 1));
    }],
    [/FROM asdair\.shop_event WHERE shop_id = \$1 ORDER BY id DESC LIMIT 1/i, (sql, p) => {
      const hits = db.shop_event.filter((e) => String(e.shop_id) === String(p[0])).sort((a, b) => b.id - a.id);
      return rows(hits.slice(0, 1));
    }],

    // ── asdair.shop_question ───────────────────────────────────────────────
    [/^INSERT INTO asdair\.shop_question \(/i, (sql, params) => {
      const row = insertRow(sql, 'asdair.shop_question', params);
      // shop_question_key_uniq - THE reason a question is never asked twice.
      if (db.shop_question.some((q) => String(q.shop_id) === String(row.shop_id) && q.question_key === row.question_key)) return none();
      const created = {
        id: id('shop_question'), status: 'open', answer_text: null, answer_source: null,
        asked_at: nowIso(), answered_at: null,
        // Migration 017's COLUMN DEFAULTS. A round-1 INSERT deliberately omits
        // both columns so its statement shape stays byte-identical to the one
        // three live shops were written with - which means the fake has to
        // supply the defaults Postgres would, or every round-1 row reads back
        // with question_round undefined and a reader comparing it to 1 is
        // quietly wrong about every existing question.
        question_round: 1, parent_question_id: null,
        ...row,
      };
      db.shop_question.push(created);
      return rows([created]);
    }],
    [/^UPDATE asdair\.shop_question SET status = \$1/i, (sql, p) => {
      const target = db.shop_question.find((q) => String(q.id) === String(p[3]) && q.status === 'open');
      if (!target) return none();
      target.status = p[0];
      target.answer_text = p[1];
      target.answer_source = p[2];
      target.answered_at = nowIso();
      return rows([target]);
    }],
    [/FROM asdair\.shop_question WHERE shop_id = \$1 AND question_key = \$2/i, (sql, p) =>
      rows(db.shop_question.filter((q) => String(q.shop_id) === String(p[0]) && q.question_key === p[1]))],
    [/FROM asdair\.shop_question WHERE id = \$1/i, (sql, p) =>
      rows(db.shop_question.filter((q) => String(q.id) === String(p[0])))],
    [/count\(\*\)::int AS n FROM asdair\.shop_question WHERE shop_id = \$1 AND status = 'open'/i, (sql, p) =>
      rows([{ n: db.shop_question.filter((q) => String(q.shop_id) === String(p[0]) && q.status === 'open').length }])],
    // store.listQuestions - shop_question LEFT JOINed to the item name carrier.
    //
    // The previous handler here answered the FLAT statement listQuestions used to
    // emit. When that query grew the two LEFT JOINs and the four render-contract
    // columns, this file was not updated, so the statement fell through to "no
    // handler" - and queueShopCards catches per shop, so the throw surfaced as
    // "no question card was queued" rather than as an error. Nothing about the
    // real query was wrong; its offline counterpart simply did not exist.
    //
    // MODELLED AS A REAL LEFT JOIN, not as a convenience lookup:
    //   * no match on either side yields ONE row with those fields null - which
    //     is the whole reason both joins are LEFT, so a question whose list item
    //     has gone still reaches the card;
    //   * N matches on shop_line yield N rows, exactly as Postgres would. A fake
    //     that silently collapsed a fan-out would hide a real duplicate.
    //
    // THE PROJECTION IS DERIVED FROM THE STATEMENT, by selectProjection() above.
    // It is not a list held here. That is the correction of defect D1: the list
    // that used to live at this spot decided the output on its own, so the real
    // SELECT could lose a column - or be left syntactically invalid - and this
    // handler would keep answering exactly as before, green.
    //
    // What this now guarantees, and nothing beyond it: a column dropped from the
    // statement stops being returned; a column added that cannot be sourced
    // throws; a renamed column or alias throws; an empty item in the select list
    // (a trailing comma before FROM), a missing FROM, or unbalanced parentheses
    // in the select list all throw. It does NOT validate SQL in general, does not
    // check types or join semantics, and proves nothing whatever about Postgres.
    // The exact expected column set is pinned in listQuestionsProjection.test.js,
    // outside this file, so that changing the statement and this file together
    // still reddens the suite.
    [/FROM asdair\.shop_question q\s+LEFT JOIN asdair\.shopping_list_items li[\s\S]*WHERE q\.shop_id = \$1 ORDER BY q\.id ASC/i, (sql, p) => {
      const projection = selectProjection(sql);
      const out = [];
      db.shop_question
        .filter((q) => String(q.shop_id) === String(p[0]))
        .sort((a, b) => a.id - b.id)
        .forEach((q) => {
          // li: shopping_list_items.id is the primary key, so at most one.
          const li = q.list_item_id === null || q.list_item_id === undefined
            ? null
            : db.shopping_list_items.find((i) => String(i.id) === String(q.list_item_id)) || null;

          // sl: joined on (list_item_id, shop_id) - no unique index covers that
          // pair, so it can legitimately fan out.
          const lines = q.list_item_id === null || q.list_item_id === undefined
            ? []
            : db.shop_line.filter((l) => String(l.list_item_id) === String(q.list_item_id)
              && String(l.shop_id) === String(q.shop_id));

          if (lines.length === 0) {
            out.push(projectQuestionRow(projection, q, li, null));
            return;
          }
          for (const l of lines) out.push(projectQuestionRow(projection, q, li, l));
        });
      return rows(out);
    }],

    // ── asdair.shop_source_image (migration 016 - exact-source binding) ────
    // PRIMARY KEY (shop_id) + the three CHECKs, so a test cannot write a row
    // Postgres would refuse, and a second insert for the same shop writes
    // nothing - which is the first-write-wins property the writer relies on.
    [/^INSERT INTO asdair\.shop_source_image \(shop_id, fingerprint, algo, byte_length, captured_at\) VALUES/i, (sql, p) => {
      const row = {
        shop_id: p[0], fingerprint: p[1], algo: p[2] ?? 'sha256',
        byte_length: p[3] ?? null, captured_at: p[4] ?? nowIso(),
      };
      if (typeof row.fingerprint !== 'string' || !/^[0-9a-f]{16,128}$/.test(row.fingerprint)) {
        throw new Error('fakePg: CHECK shop_source_image_fingerprint_shaped violated');
      }
      if (row.algo !== 'sha256') {
        throw new Error('fakePg: CHECK shop_source_image_algo_known violated');
      }
      if (row.byte_length !== null && !(Number.isInteger(Number(row.byte_length)) && Number(row.byte_length) > 0)) {
        throw new Error('fakePg: CHECK shop_source_image_bytes_sane violated');
      }
      if (db.shop_source_image.some((r) => String(r.shop_id) === String(row.shop_id))) return none();
      db.shop_source_image.push(row);
      return rows([row]);
    }],
    [/FROM asdair\.shop_source_image WHERE shop_id = \$1/i, (sql, p) =>
      rows(db.shop_source_image.filter((r) => String(r.shop_id) === String(p[0])))],
    // store.findPriorPhotoShop - the newest earlier photo shop, LEFT JOINed to
    // its binding. Modelled as a real LEFT JOIN: no binding yields the shop row
    // with null fingerprint/captured_at, never a dropped row.
    [/FROM asdair\.shop s\s+LEFT JOIN asdair\.shop_source_image i ON i\.shop_id = s\.id\s+WHERE s\.household_id = \$1 AND s\.source_kind = 'photo' AND s\.id < \$2 ORDER BY s\.id DESC LIMIT 1/i, (sql, p) => {
      const hits = db.shop
        .filter((s) => String(s.household_id) === String(p[0]) && s.source_kind === 'photo'
          && Number(s.id) < Number(p[1]))
        .sort((a, b) => b.id - a.id)
        .slice(0, 1)
        .map((s) => {
          const i = db.shop_source_image.find((r) => String(r.shop_id) === String(s.id)) || null;
          return {
            id: s.id, shop_ref: s.shop_ref, created_at: s.created_at,
            fingerprint: i ? i.fingerprint : null, captured_at: i ? i.captured_at : null,
          };
        });
      return rows(hits);
    }],

    // ── asdair.rule_qa_log ─────────────────────────────────────────────────
    // outcome/promoteDecision.js builds this INSERT from a fixed column list and
    // writes it for EVERY decision - the `asdair.rules` insert beside it is the
    // conditional one, gated on applies_going_forward AND on the database's own
    // provenance verdict. Modelling the log insert (and only it) is therefore
    // enough to run the real promoteDecision on the answer-learning path the
    // pipeline takes, where applies_going_forward is an explicit false and no
    // rule is ever promoted.
    [/^INSERT INTO asdair\.rule_qa_log \(/i, (sql, params) => {
      const row = insertRow(sql, 'asdair.rule_qa_log', params);
      const created = { id: id('rule_qa_log'), promoted_rule_id: null, ...row };
      db.rule_qa_log.push(created);
      return rows([{ id: created.id }]);
    }],

    // ── asdair.browser_build_request - handoff/claim.js openHandoff ────────
    //
    // FOUR STATEMENTS THAT ARE NOT shopStore's, and they sit ABOVE the shopStore
    // handlers below ON PURPOSE. This list is first-match-wins, and two of the
    // four WERE already being matched by a handler written for a different
    // statement: the generic `INSERT INTO asdair.browser_build_request (` read
    // openHandoff's `$2` (a progress jsonb) as shopStore's `$2` (a status), and
    // the generic `SET progress` update looked for the row id in openHandoff's
    // progress parameter. Neither threw. A handler that answers the wrong
    // statement is worse than no handler, because "no handler" is loud.
    //
    // WHY THEY ARE DIFFERENT AT ALL: `openHandoff` opens the request WITH the
    // handoff artefact already on it (`progress.handoff`), under the PARTIAL
    // unique index, so exactly one live request per shop exists and it can never
    // exist without the operating contract it carries. shopStore's older
    // `requestBrowserBuild` inserts (shop_id, status) and nothing else.
    //
    // Each shape below was read off `services/asdair/handoff/claim.js` itself,
    // not off a description of it.

    // 1/4 - findComplete(): the most recently COMPLETED request for a shop.
    //   select <cols> from asdair.browser_build_request
    //    where shop_id = $1::bigint and status = 'complete'
    //    order by finished_at desc nulls last, id desc limit 1
    // This is the completed-shop guard, and it runs FIRST in openHandoff -
    // bbr_one_live_per_shop is partial, so a completed row blocks no insert and
    // only this read stands between a finished shop and being re-shopped.
    [/^select .*\bfrom asdair\.browser_build_request\s+where shop_id = \$1::bigint and status = 'complete'/i, (sql, p) => {
      const projection = assertBrowserProjection(selectProjection(sql));
      const hits = db.browser_build_request
        .filter((b) => String(b.shop_id) === String(p[0]) && b.status === 'complete')
        // ORDER BY finished_at DESC NULLS LAST, id DESC - modelled exactly,
        // including NULLS LAST, because a cancelled-then-completed history is
        // precisely when the wrong row would be returned.
        .sort((a, b) => {
          const aNull = a.finished_at === null || a.finished_at === undefined;
          const bNull = b.finished_at === null || b.finished_at === undefined;
          if (aNull !== bNull) return aNull ? 1 : -1;
          if (!aNull && a.finished_at !== b.finished_at) return a.finished_at < b.finished_at ? 1 : -1;
          return Number(b.id) - Number(a.id);
        })
        .slice(0, 1);
      return rows(hits.map((b) => projectBrowserRow(projection, b)));
    }],

    // 2/4 - the idempotent insert, under the PARTIAL unique index.
    //   insert into asdair.browser_build_request (shop_id, status, progress)
    //   values ($1::bigint, 'queued', $2::jsonb)
    //   on conflict (shop_id) where status in ('queued','claimed','running') do nothing
    //   returning <cols>
    // ON CONFLICT ... DO NOTHING over a PARTIAL index: a live row for this shop
    // means ZERO rows returned (openHandoff then reads to find out what is
    // there). A terminal row - complete, failed, cancelled - is not covered by
    // the index and does not block, which is what lets a paused week be asked
    // for again as a genuinely new request.
    //
    // The RETURNING list is not projected from the statement the way the two
    // SELECTs above are: the stored row carries exactly the nine columns
    // claim.js names, so there is nothing here for a projection to catch. Said
    // plainly rather than implied - a column added to RETURNING alone would not
    // be detected here.
    [/^insert into asdair\.browser_build_request \(shop_id, status, progress\)/i, (sql, p) => {
      const shopId = p[0];
      if (db.browser_build_request.some((b) => String(b.shop_id) === String(shopId)
        && ['queued', 'claimed', 'running'].includes(b.status))) return none();
      const row = {
        id: id('browser_build_request'), shop_id: shopId, status: 'queued',
        claimed_by: null, progress: asJson(p[1]) || {}, last_error: null,
        requested_at: nowIso(), claimed_at: null, finished_at: null,
      };
      db.browser_build_request.push(row);
      return rows([row]);
    }],

    // 3/4 - which live request already exists.
    //   select <cols> from asdair.browser_build_request
    //    where shop_id = $1::bigint and status = any($2::text[])
    //    order by requested_at, id limit 1
    // The statuses arrive as a PARAMETER (claim.js LIVE_STATUSES), so this
    // handler reads $2 rather than hard-coding the trio - a fake that pinned
    // the list here would keep answering after claim.js changed it.
    [/^select .*\bfrom asdair\.browser_build_request\s+where shop_id = \$1::bigint and status = any\(\$2::text\[\]\)/i, (sql, p) => {
      const projection = assertBrowserProjection(selectProjection(sql));
      const live = Array.isArray(p[1]) ? p[1] : [];
      const hits = db.browser_build_request
        .filter((b) => String(b.shop_id) === String(p[0]) && live.includes(b.status))
        .sort((a, b) => (a.requested_at === b.requested_at
          ? Number(a.id) - Number(b.id)
          : (a.requested_at < b.requested_at ? -1 : 1)))
        .slice(0, 1);
      return rows(hits.map((b) => projectBrowserRow(projection, b)));
    }],

    // 4/4 - supersede the SAME row in place; never a second row.
    //   update asdair.browser_build_request
    //      set progress = (coalesce(progress,'{}'::jsonb) - '_lease' - 'report')
    //                     || $2::jsonb
    //                     || jsonb_build_object('_superseded_at', to_jsonb(now()),
    //                                           '_superseded_from', $3::text),
    //          status = 'queued', claimed_by = null, last_error = null
    //    where id = $1::bigint and status = any($4::text[])
    // Modelled faithfully in three parts, because each is load-bearing:
    //   * `- '_lease' - 'report'` DROPS those keys. The stale lease must not
    //     survive a re-point, or the next claim would look held.
    //   * `||` is a SHALLOW top-level jsonb merge, so the new `handoff` block
    //     replaces the old one outright rather than being deep-merged into it.
    //   * the WHERE re-checks status against $4, so a row that went terminal
    //     between the read and this write matches nothing and openHandoff
    //     raises HandoffStateError instead of resurrecting it.
    // claimed_at and finished_at are deliberately NOT reset - the statement
    // does not touch them.
    [/^update asdair\.browser_build_request\s+set progress = \(coalesce\(progress/i, (sql, p) => {
      const live = Array.isArray(p[3]) ? p[3] : [];
      const target = db.browser_build_request.find((b) => String(b.id) === String(p[0])
        && live.includes(b.status));
      if (!target) return none();
      const next = { ...(target.progress && typeof target.progress === 'object' ? target.progress : {}) };
      delete next._lease;
      delete next.report;
      Object.assign(next, asJson(p[1]) || {}, {
        _superseded_at: nowIso(),
        _superseded_from: p[2] === undefined ? null : p[2],
      });
      target.progress = next;
      target.status = 'queued';
      target.claimed_by = null;
      target.last_error = null;
      return rows([target]);
    }],

    // ── asdair.browser_build_request - shop/shopStore.js ───────────────────
    // The column list is pinned in the pattern. It used to be an open `(`,
    // which is how openHandoff's three-column insert was silently answered by
    // this handler. An insert shape nobody has modelled now reaches the
    // no-handler throw at the bottom of query(), which is the honest answer.
    [/^INSERT INTO asdair\.browser_build_request \(shop_id, status\) VALUES/i, (sql, p) => {
      const shopId = p[0];
      // bbr_one_live_per_shop
      if (db.browser_build_request.some((b) => String(b.shop_id) === String(shopId)
        && ['queued', 'claimed', 'running'].includes(b.status))) return none();
      const row = {
        id: id('browser_build_request'), shop_id: shopId, status: p[1] || 'queued',
        claimed_by: null, progress: {}, last_error: null,
        requested_at: nowIso(), claimed_at: null, finished_at: null,
      };
      db.browser_build_request.push(row);
      return rows([row]);
    }],
    [/^UPDATE asdair\.browser_build_request SET status = 'claimed'/i, (sql, p) => {
      const target = db.browser_build_request.find((b) => String(b.shop_id) === String(p[0]) && b.status === 'queued');
      if (!target) return none();
      target.status = 'claimed'; target.claimed_by = p[1]; target.claimed_at = nowIso();
      return rows([target]);
    }],
    // shopStore.updateBrowserProgress. The `$1::jsonb` is pinned for the same
    // reason the insert's column list above is: this pattern used to match
    // openHandoff's supersede statement too, and answered it by looking for the
    // row id in a progress parameter - finding nothing, and returning no row.
    [/^UPDATE asdair\.browser_build_request SET progress = \$1::jsonb/i, (sql, p) => {
      const target = db.browser_build_request.find((b) => String(b.id) === String(p[1])
        && ['claimed', 'running'].includes(b.status));
      if (!target) return none();
      try { target.progress = JSON.parse(p[0]); } catch { target.progress = {}; }
      target.status = 'running';
      return rows([target]);
    }],
    [/^UPDATE asdair\.browser_build_request SET status = \$1, last_error = \$2/i, (sql, p) => {
      const target = db.browser_build_request.find((b) => String(b.id) === String(p[2])
        && ['queued', 'claimed', 'running'].includes(b.status));
      if (!target) return none();
      target.status = p[0]; target.last_error = p[1]; target.finished_at = nowIso();
      return rows([target]);
    }],
    [/FROM asdair\.browser_build_request\s+WHERE shop_id = \$1 AND status IN/i, (sql, p) => {
      const hits = db.browser_build_request.filter((b) => String(b.shop_id) === String(p[0])
        && ['queued', 'claimed', 'running'].includes(b.status)).sort((a, b) => b.id - a.id);
      return rows(hits.slice(0, 1));
    }],
    [/FROM asdair\.browser_build_request WHERE shop_id = \$1 ORDER BY id DESC LIMIT 1/i, (sql, p) => {
      const hits = db.browser_build_request.filter((b) => String(b.shop_id) === String(p[0])).sort((a, b) => b.id - a.id);
      return rows(hits.slice(0, 1));
    }],
    [/FROM asdair\.browser_build_request WHERE id = \$1/i, (sql, p) =>
      rows(db.browser_build_request.filter((b) => String(b.id) === String(p[0])))],

    // ── asdair.pipeline_command (migration 009 - THE MACHINE LEDGER) ───────
    // The command ledger, the resume bookkeeping and the outbox. Its UNIQUE
    // index is TOTAL (not partial like pending_action's), which is precisely
    // why store.recordLedgerEntry has to carry a generation - and why that
    // generation must be exercised against a real index rather than a mock.
    [/^INSERT INTO asdair\.pipeline_command \(shop_id, kind, command, args, idempotency_key, status\) VALUES/i,
      (sql, p) => insertPipelineCommand({
        shop_id: p[0] ?? null, kind: p[1], command: p[2], args: p[3],
        idempotency_key: p[4], status: 'pending',
      })],

    // The backfill's insert: carries the migrated status, provenance and the
    // original timestamps, and refuses to run twice for the same source row.
    [/^INSERT INTO asdair\.pipeline_command \(shop_id, kind, command, args, idempotency_key, status, result, created_at, updated_at\)\s*SELECT/i,
      (sql, p) => {
        const alreadyMigrated = db.pipeline_command.some(
          (c) => asJson(c.result) && String(asJson(c.result).migrated_from_pending_action ?? '') === String(p[9]),
        );
        if (alreadyMigrated) return none();
        return insertPipelineCommand({
          shop_id: p[0] ?? null, kind: p[1], command: p[2], args: p[3],
          idempotency_key: p[4], status: p[5], result: p[6],
          created_at: p[7], updated_at: p[8],
        });
      }],

    [/^UPDATE asdair\.pipeline_command\s+SET status = \$1/i, (sql, p) => {
      const live = Array.isArray(p[4]) ? p[4] : ['pending', 'running'];
      const target = db.pipeline_command.find((c) => String(c.id) === String(p[3]) && live.includes(c.status));
      if (!target) return none();
      assertPipelineCommandChecks({ ...target, status: p[0] });
      target.status = p[0];
      // `result = coalesce(result,'{}') || $2::jsonb` - a jsonb MERGE, not a
      // replace, so provenance written by the backfill survives a resolution.
      target.result = { ...(asJson(target.result) || {}), ...(asJson(p[1]) || {}) };
      if (p[0] === 'failed') target.last_error = p[2];
      target.attempts = Number(target.attempts || 0) + 1;
      target.updated_at = nowIso();
      return rows([target]);
    }],

    [/FROM asdair\.pipeline_command WHERE idempotency_key = \$1/i, (sql, p) =>
      rows(db.pipeline_command.filter((c) => c.idempotency_key === p[0]))],

    [/count\(\*\)::int AS n FROM asdair\.pipeline_command\s+WHERE args->>'ledger_key' = \$1 AND status = ANY\(\$2\)/i, (sql, p) => {
      const statuses = Array.isArray(p[1]) ? p[1] : [];
      return rows([{
        n: db.pipeline_command.filter((c) => (asJson(c.args) || {}).ledger_key === p[0]
          && statuses.includes(c.status)).length,
      }]);
    }],

    [/FROM asdair\.pipeline_command\s+WHERE shop_id = \$1 AND kind = 'command' AND status = 'pending'/i, (sql, p) =>
      rows(db.pipeline_command.filter((c) => String(c.shop_id) === String(p[0])
        && c.kind === 'command' && c.status === 'pending').sort((a, b) => a.id - b.id))],

    [/^SELECT DISTINCT command FROM asdair\.pipeline_command\s+WHERE shop_id = \$1 AND kind = 'command'/i, (sql, p) => {
      const seen = new Set(db.pipeline_command.filter((c) => String(c.shop_id) === String(p[0])
        && c.kind === 'command').map((c) => c.command));
      return rows([...seen].map((command) => ({ command })));
    }],

    [/FROM asdair\.pipeline_command\s+WHERE status = 'pending' AND kind = 'outbox' AND shop_id = \$1/i, (sql, p) =>
      rows(db.pipeline_command.filter((c) => c.status === 'pending' && c.kind === 'outbox'
        && String(c.shop_id) === String(p[0])).sort((a, b) => a.id - b.id))],

    [/FROM asdair\.pipeline_command\s+WHERE status = 'pending' AND kind = 'outbox'/i, () =>
      rows(db.pipeline_command.filter((c) => c.status === 'pending' && c.kind === 'outbox')
        .sort((a, b) => a.id - b.id))],

    // store.outboxEverQueued - the receipt self-heal's "ever, not merely pending" check.
    [/^SELECT 1 FROM asdair\.pipeline_command\s+WHERE shop_id = \$1 AND kind = 'outbox' AND command = \$2/i, (sql, p) => {
      const hit = db.pipeline_command.some((c) => String(c.shop_id) === String(p[0])
        && c.kind === 'outbox' && c.command === p[1]);
      return hit ? rows([{ exists: 1 }]) : none();
    }],

    // The backfill's preflight: "is migration 009 actually applied here?"
    [/^SELECT to_regclass\('asdair\.pipeline_command'\)/i, () =>
      rows([{ table_name: 'asdair.pipeline_command' }])],

    // ── asdair.pending_action (HUMAN ACTIONS - and the legacy ledger rows) ──
    [/^INSERT INTO asdair\.pending_action \(/i, (sql, params) => {
      const row = insertRow(sql, 'asdair.pending_action', params);
      // pending_action_key_uniq - PARTIAL: only while pending.
      if (db.pending_action.some((a) => a.status === 'pending'
        && String(a.household_id) === String(row.household_id)
        && a.action_type === row.action_type
        && a.action_key === row.action_key)) return none();
      const created = {
        id: id('pending_action'), status: 'pending', note: null,
        created_at: nowIso(), resolved_at: null, payload: {}, shop_id: null, ...row,
      };
      db.pending_action.push(created);
      return rows([created]);
    }],
    [/^UPDATE asdair\.pending_action SET status = \$1/i, (sql, p) => {
      const target = db.pending_action.find((a) => String(a.id) === String(p[2]) && a.status === 'pending');
      if (!target) return none();
      target.status = p[0]; target.note = p[1]; target.resolved_at = nowIso();
      return rows([target]);
    }],
    [/FROM asdair\.pending_action\s+WHERE household_id = \$1 AND action_type = \$2 AND action_key = \$3 AND status = 'pending'/i, (sql, p) =>
      rows(db.pending_action.filter((a) => String(a.household_id) === String(p[0])
        && a.action_type === p[1] && a.action_key === p[2] && a.status === 'pending'))],
    [/FROM asdair\.pending_action\s+WHERE shop_id = \$1 AND status = 'pending' AND action_type LIKE \$2/i, (sql, p) =>
      rows(db.pending_action.filter((a) => String(a.shop_id) === String(p[0]) && a.status === 'pending'
        && a.action_type.startsWith(String(p[1]).replace('%', ''))).sort((a, b) => a.id - b.id))],
    [/SELECT DISTINCT action_type FROM asdair\.pending_action\s+WHERE shop_id = \$1 AND action_type LIKE \$2/i, (sql, p) => {
      const prefix = String(p[1]).replace('%', '');
      const seen = new Set(db.pending_action.filter((a) => String(a.shop_id) === String(p[0])
        && a.action_type.startsWith(prefix)).map((a) => a.action_type));
      return rows([...seen].map((t) => ({ action_type: t })));
    }],
    [/FROM asdair\.pending_action WHERE status = 'pending' AND action_type LIKE \$1 AND shop_id = \$2/i, (sql, p) =>
      rows(db.pending_action.filter((a) => a.status === 'pending'
        && a.action_type.startsWith(String(p[0]).replace('%', ''))
        && String(a.shop_id) === String(p[1])).sort((a, b) => a.id - b.id))],
    [/FROM asdair\.pending_action WHERE status = 'pending' AND action_type LIKE \$1/i, (sql, p) =>
      rows(db.pending_action.filter((a) => a.status === 'pending'
        && a.action_type.startsWith(String(p[0]).replace('%', ''))).sort((a, b) => a.id - b.id))],
    [/FROM asdair\.pending_action WHERE household_id = \$1 AND status = 'pending'/i, (sql, p) =>
      rows(db.pending_action.filter((a) => String(a.household_id) === String(p[0]) && a.status === 'pending')
        .sort((a, b) => a.id - b.id))],

    // ── the backfill's two statements over the legacy ledger rows ──────────
    [/FROM asdair\.pending_action\s+WHERE action_type LIKE \$1 OR action_type LIKE \$2/i, (sql, p) => {
      const prefixes = [String(p[0]).replace('%', ''), String(p[1]).replace('%', '')];
      return rows(db.pending_action
        .filter((a) => prefixes.some((pre) => String(a.action_type).startsWith(pre)))
        .sort((a, b) => a.id - b.id));
    }],
    [/^UPDATE asdair\.pending_action\s+SET status = 'abandoned'/i, (sql, p) => {
      const target = db.pending_action.find((a) => String(a.id) === String(p[1]) && a.status === 'pending');
      if (!target) return none();
      target.status = 'abandoned';
      target.note = target.note ? `${target.note} | ${p[0]}` : p[0];
      target.resolved_at = target.resolved_at || nowIso();
      return rows([{ id: target.id }]);
    }],

    // ── asdair.shop_line (migration 008 - the durable interpretation) ──────
    // UNIQUE (shop_id, line_no), plus the two CHECKs that matter: a `matched`
    // line must carry a matched_regular_id, and a quantity is 1..999 or NULL.
    [/^INSERT INTO asdair\.shop_line \(/i, (sql, params) => {
      const row = insertRow(sql, 'asdair.shop_line', params);
      if (row.status === 'matched' && (row.matched_regular_id === null || row.matched_regular_id === undefined)) {
        throw new Error('fakePg: CHECK shop_line_matched_needs_regular violated');
      }
      if (row.quantity !== null && row.quantity !== undefined
        && (!Number.isInteger(Number(row.quantity)) || Number(row.quantity) < 1 || Number(row.quantity) > 999)) {
        throw new Error('fakePg: CHECK shop_line_quantity_sane violated');
      }
      const existing = db.shop_line.find((l) => String(l.shop_id) === String(row.shop_id)
        && Number(l.line_no) === Number(row.line_no));
      if (existing) {
        // ON CONFLICT DO UPDATE ... WHERE shop_line.confirmed_by IS NULL.
        // A line a human confirmed refuses the re-read, and returns no row.
        if (existing.confirmed_by !== null && existing.confirmed_by !== undefined) return none();
        Object.assign(existing, row, { updated_at: nowIso() });
        return rows([existing]);
      }
      const created = {
        id: id('shop_line'), confirmed_by: null, confirmed_at: null, corrected: false,
        list_item_id: null, match_confidence: null, alternatives: [],
        created_at: nowIso(), updated_at: nowIso(), ...row,
      };
      db.shop_line.push(created);
      return rows([created]);
    }],
    [/^UPDATE asdair\.shop_line SET list_item_id = \$3/i, (sql, p) => {
      const target = db.shop_line.find((l) => String(l.shop_id) === String(p[0]) && Number(l.line_no) === Number(p[1]));
      if (!target) return none();
      target.list_item_id = p[2]; target.updated_at = nowIso();
      return rows([target]);
    }],
    [/^UPDATE asdair\.shop_line SET corrected = true/i, (sql, p) => {
      const target = db.shop_line.find((l) => String(l.shop_id) === String(p[0]) && Number(l.line_no) === Number(p[1]));
      if (!target) return none();
      target.corrected = true; target.confirmed_by = p[2]; target.confirmed_at = nowIso(); target.updated_at = nowIso();
      return rows([target]);
    }],
    [/FROM asdair\.shop_line WHERE shop_id = \$1 AND line_no = \$2/i, (sql, p) =>
      rows(db.shop_line.filter((l) => String(l.shop_id) === String(p[0]) && Number(l.line_no) === Number(p[1])))],
    [/FROM asdair\.shop_line WHERE shop_id = \$1 ORDER BY line_no ASC/i, (sql, p) =>
      rows(db.shop_line.filter((l) => String(l.shop_id) === String(p[0])).sort((a, b) => a.line_no - b.line_no))],

    // ── asdair.shop_decision (migration 017 - the current-shop decision) ───
    // UNIQUE (question_id) IS the idempotency: one decision per question, ever.
    // Modelled as a real index rather than a convenience check, because "the
    // second insert wrote nothing" is only meaningful if the first is still
    // there.
    //
    // The CHECKs modelled are the ones a WRONG CALLER trips, not all fifteen:
    // a fake that can store a shape Postgres would refuse proves nothing about
    // the shape Postgres will accept.
    [/^INSERT INTO asdair\.shop_decision \(/i, (sql, params) => {
      const row = insertRow(sql, 'asdair.shop_decision', params);

      if (!['existing_regular', 'quantity_change', 'variant_choice', 'new_item',
        'skip_this_week', 'clarification_required'].includes(row.decision_kind)) {
        throw new Error('fakePg: CHECK shop_decision_kind_known violated');
      }
      if (['existing_regular', 'quantity_change', 'variant_choice'].includes(row.decision_kind)
        && (row.decided_regular_id === null || row.decided_regular_id === undefined)) {
        throw new Error('fakePg: CHECK shop_decision_regular_required violated');
      }
      if ((row.decision_kind === 'clarification_required')
        !== (row.clarification_reason !== null && row.clarification_reason !== undefined)) {
        throw new Error('fakePg: CHECK shop_decision_clarification_shape violated');
      }

      // The composite FK to shop_question (id, shop_id): a decision cannot name
      // a question that does not exist, nor one belonging to another shop.
      const parent = db.shop_question.find((r) => String(r.id) === String(row.question_id)
        && String(r.shop_id) === String(row.shop_id));
      if (!parent) throw new Error('fakePg: FK shop_decision_question_fk violated');

      // ON CONFLICT (question_id) DO NOTHING.
      if (db.shop_decision.some((d) => String(d.question_id) === String(row.question_id))) return none();

      const created = {
        id: id('shop_decision'),
        decided_regular_id: null, decided_quantity: null, decided_item_name: null,
        clarification_reason: null, forward_intent: null, interpreted_model: null,
        decision_evidence: {}, grounding_fingerprint: null, evidence_shop_line_id: null,
        interpreted_at: nowIso(), created_at: nowIso(), ...row,
      };
      db.shop_decision.push(created);
      return rows([created]);
    }],
    [/FROM asdair\.shop_decision WHERE question_id = \$1/i, (sql, p) =>
      rows(db.shop_decision.filter((d) => String(d.question_id) === String(p[0])))],
    // The shop-scoped read JOINs shop_question to carry question_key - the only
    // durable link between a recomputed plan line and a stored decision.
    [/FROM asdair\.shop_decision d\s+JOIN asdair\.shop_question q/i, (sql, p) => {
      const out = db.shop_decision
        .filter((d) => String(d.shop_id) === String(p[0]))
        .sort((a, b) => Number(a.id) - Number(b.id))
        .map((d) => {
          const q = db.shop_question.find((r) => String(r.id) === String(d.question_id)) || {};
          return {
            ...d,
            question_key: q.question_key ?? null,
            question_round: q.question_round ?? 1,
            parent_question_id: q.parent_question_id ?? null,
            question_status: q.status ?? null,
          };
        });
      return rows(out);
    }],

    // ── asdair.households / shopping_lists / shopping_list_items ───────────
    // Modelled so the REAL services/control-plane/wp-d-proof/asdairCommands.mjs
    // runs against this fake. Its add_list_item UPSERT on
    // (list_id, lower(item_name)) is what makes re-interpreting a list safe, so
    // the tests must exercise the real statement, not a stand-in for it.
    [/^select id from asdair\.households where id=\$1/i, (sql, p) =>
      rows((db.households || []).filter((h) => String(h.id) === String(p[0])))],
    [/^select id from asdair\.households where name=\$1 or display_name=\$1/i, (sql, p) =>
      rows((db.households || []).filter((h) => h.name === p[0] || h.display_name === p[0]))],
    [/^select id from asdair\.households order by id/i, () =>
      rows((db.households || []).map((h) => ({ id: h.id })).sort((a, b) => a.id - b.id))],
    [/^select id from asdair\.shopping_lists where household_id=\$1 and status='next_week_draft' and list_date=\$2/i, (sql, p) => {
      const hits = db.shopping_lists.filter((l) => String(l.household_id) === String(p[0])
        && l.status === 'next_week_draft' && l.list_date === p[1]).sort((a, b) => b.id - a.id);
      return rows(hits.slice(0, 1).map((l) => ({ id: l.id })));
    }],
    [/^select id from asdair\.shopping_lists where household_id=\$1 and status='next_week_draft'/i, (sql, p) => {
      const hits = db.shopping_lists.filter((l) => String(l.household_id) === String(p[0])
        && l.status === 'next_week_draft').sort((a, b) => b.id - a.id);
      return rows(hits.slice(0, 1).map((l) => ({ id: l.id })));
    }],
    [/^insert into asdair\.shopping_lists \(household_id, status, list_date\)/i, (sql, p) => {
      const row = { id: id('shopping_lists'), household_id: p[0], status: 'next_week_draft', list_date: p[1] ?? null };
      db.shopping_lists.push(row);
      return rows([{ id: row.id }]);
    }],
    [/^select id, requested_qty, status, note from asdair\.shopping_list_items where list_id=\$1 and lower\(item_name\)=lower\(\$2\)/i, (sql, p) => {
      const hit = db.shopping_list_items.find((i) => String(i.list_id) === String(p[0])
        && String(i.item_name).toLowerCase() === String(p[1]).toLowerCase());
      return hit ? rows([{ id: hit.id, requested_qty: hit.requested_qty, status: hit.status, note: hit.note }]) : none();
    }],
    [/^select id from asdair\.shopping_list_items where list_id=\$1 and lower\(item_name\)=lower\(\$2\)/i, (sql, p) => {
      const hit = db.shopping_list_items.find((i) => String(i.list_id) === String(p[0])
        && String(i.item_name).toLowerCase() === String(p[1]).toLowerCase());
      return hit ? rows([{ id: hit.id }]) : none();
    }],
    [/^insert into asdair\.shopping_list_items \(list_id,item_name,requested_qty,status,note\)/i, (sql, p) => {
      const row = {
        id: id('shopping_list_items'), list_id: p[0], item_name: p[1], requested_qty: p[2],
        status: p[3] ?? 'requested', note: p[4] ?? null, matched_product_id: null, price: null, one_week_only: false,
      };
      db.shopping_list_items.push(row);
      return rows([{ id: row.id }]);
    }],
    [/^update asdair\.shopping_list_items set requested_qty=\$2, status=\$3, note=coalesce\(\$4,note\)/i, (sql, p) => {
      const target = db.shopping_list_items.find((i) => String(i.id) === String(p[0]));
      if (!target) return none();
      target.requested_qty = p[1]; target.status = p[2];
      if (p[3] !== null && p[3] !== undefined) target.note = p[3];
      return rows([target]);
    }],
    [/^update asdair\.shopping_list_items set requested_qty=\$2 where id=\$1/i, (sql, p) => {
      const target = db.shopping_list_items.find((i) => String(i.id) === String(p[0]));
      if (!target) return none();
      target.requested_qty = p[1];
      return rows([target]);
    }],

    // ── asdair.shopping_list_items (the pipeline's own read) ───────────────
    [/FROM asdair\.shopping_list_items WHERE list_id = \$1/i, (sql, p) =>
      rows(db.shopping_list_items.filter((i) => String(i.list_id) === String(p[0])).sort((a, b) => a.id - b.id))],

    // ── asdair.order_confirmation_line (the learning read) ─────────────────
    [/FROM asdair\.order_confirmation_line/i, (sql, p) => {
      const conf = db.order_confirmation.filter((c) => String(c.shop_id) === String(p[0])).sort((a, b) => b.id - a.id)[0];
      if (!conf) return none();
      return rows(db.order_confirmation_line.filter((l) => String(l.confirmation_id) === String(conf.id)
        && l.matched_regular_id !== null && l.matched_regular_id !== undefined));
    }],
  ];

  return {
    log,
    db,
    released: false,
    /** Make the NEXT statement matching `needle` throw - how the tests simulate
     *  a process dying, or a transient database failure, mid-step. */
    breakOn(needle) { failNext = needle; },
    async query(sql, params = []) {
      const text = String(sql).replace(/\s+/g, ' ').trim();
      log.push({ sql: text, params });
      if (failNext && text.includes(failNext)) {
        failNext = null;
        throw new Error(`fakePg: injected failure on "${failNext}"`);
      }
      for (const [re, handler] of handlers) {
        if (re.test(text)) return handler(text, params);
      }
      throw new Error(`fakePg: no handler for statement:\n${text}`);
    },
    release() { this.released = true; },
  };
}

/** Every statement the client saw, in order. */
export function statements(client) {
  return client.log.map((e) => e.sql);
}

/** Index of the first statement containing `needle` (-1 when absent). */
export function indexOf(client, needle) {
  return statements(client).findIndex((s) => (needle instanceof RegExp ? needle.test(s) : s.includes(needle)));
}

export function countMatching(client, needle) {
  return statements(client).filter((s) => (needle instanceof RegExp ? needle.test(s) : s.includes(needle))).length;
}
