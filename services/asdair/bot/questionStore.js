// BUILD-015 AsdAIr - the durable Store behind the question render contract.
//
// The bot folder deliberately never opens a connection (a test enforces it), so
// the Store is INJECTED. This is the real implementation over
// `asdair.shop_question` + `asdair.shop`.
//
// THREE THINGS HERE ARE LOAD-BEARING. Each was called out as something no test
// in the bot folder can catch, because they are properties of the SQL:
//
//   1. recordAnswer is a COMPARE-AND-SET (`and status = 'open'`), not a
//      read-then-write. Two taps racing must not both observe 'open' and both
//      write. A read-then-write here silently defeats idempotency and looks
//      fine in every unit test.
//
//   2. getQuestionByCard is an EXACT (card_chat_id, card_message_id) match.
//      A loose lookup - trailing-space tolerance, a LIKE, matching on chat
//      alone - defeats the entire staleness scheme, because the whole design
//      rests on "this tap came from THAT card".
//
//   3. Every row carries a joined `shop_ref`. Without it the shop-mismatch
//      check in resolveTap silently no-ops, and a tap from one week could
//      resolve against another.
//
// Telegram ids are stored as TEXT (they exceed 32-bit) and are normalised to
// String on the way in so a numeric 101 and a string '101' cannot become two
// different cards.
const SELECT_COLS = `
  q.id, q.shop_id, q.list_item_id, q.question_key, q.question_text,
  q.candidates, q.status, q.answer_text, q.answer_source,
  q.card_chat_id, q.card_message_id, q.asked_at, q.answered_at,
  q.rendered_candidates, q.render_fingerprint, q.render_version, q.callback_index,
  s.shop_ref`;

const asText = (v) => (v === null || v === undefined ? null : String(v));

/**
 * The store over a READ/WRITE query PAIR rather than a single client.
 *
 * WHY THE SPLIT EXISTS. The pipeline runtime holds no pg client - it holds
 * `deps.readQuery` and `deps.writeQuery`, which are two pools against two roles,
 * deliberately: the read role is SELECT-only so a bug cannot write through it.
 * Handing this store one `client.query` would collapse that separation for every
 * caller, so the seam is here instead and the SQL below has exactly one owner.
 *
 * The two READS go to `read`; the two WRITES go to `write`. Nothing else changes.
 *
 * @param {{read:Function, write:Function}} queries `(sql, params) => {rows, rowCount}`
 */
export function createQuestionStoreFromQueries({ read, write } = {}) {
  if (typeof read !== 'function' || typeof write !== 'function') {
    throw new Error('questionStore: read and write query functions are required');
  }
  return buildQuestionStore({ read, write });
}

export function createQuestionStore(client) {
  if (!client || typeof client.query !== 'function') {
    throw new Error('questionStore: a connected pg client is required');
  }
  const query = (sql, params) => client.query(sql, params);
  return buildQuestionStore({ read: query, write: query });
}

function buildQuestionStore({ read, write }) {
  const client = { query: read };
  const writer = { query: write };

  return {
    async getQuestionByCard({ chatId, messageId }) {
      // EXACT match on both. Never widen this.
      const r = await client.query(
        `select ${SELECT_COLS}
           from asdair.shop_question q
           join asdair.shop s on s.id = q.shop_id
          where q.card_chat_id = $1 and q.card_message_id = $2
          limit 1`,
        [asText(chatId), asText(messageId)],
      );
      return r.rowCount ? r.rows[0] : null;
    },

    async getQuestionByKey({ shopRef, questionKey }) {
      const r = await client.query(
        `select ${SELECT_COLS}
           from asdair.shop_question q
           join asdair.shop s on s.id = q.shop_id
          where s.shop_ref = $1 and q.question_key = $2
          limit 1`,
        [shopRef, questionKey],
      );
      return r.rowCount ? r.rows[0] : null;
    },

    // Bind a rendered card to its question. The UNIQUE (shop_id, question_key)
    // index means a re-render UPDATES the contract rather than creating a
    // second question - re-asking is impossible by construction.
    async saveRender({ shopRef, questionKey, chatId, messageId, renderedCandidates, renderFingerprint, renderVersion }) {
      const r = await writer.query(
        `update asdair.shop_question q
            set card_chat_id        = $3,
                card_message_id     = $4,
                rendered_candidates = $5::jsonb,
                render_fingerprint  = $6,
                render_version      = $7
           from asdair.shop s
          where s.id = q.shop_id
            and s.shop_ref = $1
            and q.question_key = $2
        returning ${SELECT_COLS.replace(/\bq\./g, 'q.')}`,
        [shopRef, questionKey, asText(chatId), asText(messageId),
         JSON.stringify(renderedCandidates ?? []), renderFingerprint ?? null, renderVersion ?? 1],
      );
      if (!r.rowCount) {
        throw new Error(`questionStore.saveRender: no question ${questionKey} on shop ${shopRef}`);
      }
      return r.rows[0];
    },

    // THE COMPARE-AND-SET. `and status = 'open'` is what makes a double tap safe.
    async recordAnswer({ questionId, answerText, answerSource, callbackIndex, answeredAt }) {
      const upd = await writer.query(
        `update asdair.shop_question
            set status         = 'answered',
                answer_text    = $2,
                answer_source  = $3,
                callback_index = $4,
                answered_at    = coalesce($5, now())
          where id = $1
            and status = 'open'
        returning id`,
        [questionId, answerText, answerSource || 'button',
         Number.isInteger(callbackIndex) ? callbackIndex : null, answeredAt || null],
      );

      // Re-read through the joined view either way, so the caller always gets a
      // row in the same shape (including shop_ref).
      const cur = await client.query(
        `select ${SELECT_COLS}
           from asdair.shop_question q
           join asdair.shop s on s.id = q.shop_id
          where q.id = $1`,
        [questionId],
      );
      const question = cur.rowCount ? cur.rows[0] : null;

      // 0 rows updated => somebody answered first. Return THAT answer verbatim.
      return { applied: upd.rowCount === 1, question };
    },
  };
}
