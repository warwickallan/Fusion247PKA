// BUILD-014 Tower supervisor loop — the AUTOMATIC Watcher Telegram.
//
// notify(pool, {turnId, reason, state, message}) sends a REAL Telegram message via the Bot
// API and records the actual delivery result into tower.notification. Tower owns this wire;
// Codex never sees the Telegram credentials (they are stripped from the Codex child env).
//
// Env (validated at call time, fail-loud, never logged): TELEGRAM_BOT_TOKEN,
// AUTHORISED_TELEGRAM_USER_ID. If either is absent the notification is recorded HONESTLY as
// not-sent (telegram_ok=false) with the reason — the loop never fabricates a delivery.
//
// Node 22 has global fetch; no dependency added.
//
// WO-TW-01: the store is SQLite (better-sqlite3, WAL). `pool` is the pg-shaped handle from
// db.mjs; the (turn_id, reason) dedup index does the same work it always did.

export const NOTIFY_REASONS = Object.freeze([
  'warwick_input_required',
  'codex_block_or_redirect',
  'goal_complete',
  'tower_failure',
  // W4 (WO-2026-08-05-09, WP-2E) — the disposition ECHO: Telegram reads back what the store
  // actually accepted after a PR-comment disposition writes it. ALWAYS sent with turnId=null,
  // deliberately, never the disposing round's real turn id: the dedup index is (turn_id, reason),
  // and SQLite treats NULL as distinct from every other NULL in a unique index (the same property
  // 'tower_failure' alarms already rely on for turnId=null crash notifications). Using the real
  // turn id here would silently swallow every disposition after the first one landed against the
  // same round — exactly the "single digest instead of an ongoing thread" the design forbids.
  'finding_disposed',
  // W3 (WO-2026-08-05-09) — a round whose delivery verdict is 'continue'/aligned and whose
  // merge-class QA APPROVED would otherwise be entirely SILENT (fireTriggers' existing "continue
  // -> no Telegram" rule) even when that same QA raised NEW, non-blocking findings alongside its
  // approval (e.g. a TRACKED_FOLLOWUP or NOTE_ONLY finding attached to an approve). Findings must
  // never be silently dropped, so this is the fallback reason ONLY when no other trigger fired
  // but this round opened at least one finding.
  'findings_raised',
  // WO-2026-08-07-33 — the FIRST card of the QA sequence, and the only one that fires BEFORE
  // Codex has returned. Every reason above is emitted from fireTriggers, i.e. after a verdict
  // exists, so TowerBot showed the outcome and never the "it is running" beat. Emitted from
  // watcher.mjs's processTurn at the last line before the real Codex invocation — NOT at poll
  // time, because a round can be created and then never reach Codex at all (the fail-closed
  // findings-disposition gate, an unreadable QA skill, unresolved Git evidence, a claim that
  // never happens). A card announcing a run that never starts is worse than no card.
  //
  // ALWAYS sent with the REAL turn id, never null — the exact opposite of 'finding_disposed' and
  // 'tower_failure' above. Those exploit SQLite treating every NULL as distinct in the
  // (turn_id, reason) unique index so they can send repeatedly; this card must send exactly once
  // per turn, so it depends on that same index actually biting. A null turn id here would
  // re-announce the card on every pass, forever.
  'codex_qa_started',
]);

const TELEGRAM_TIMEOUT_MS = 15000;

function maskToken(token) {
  if (!token) return '(unset)';
  const s = String(token);
  if (s.length <= 8) return '****';
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

/**
 * Send one automatic Watcher Telegram and record the real result.
 *
 * @param {ReturnType<import('./db.mjs').openDb>} pool
 * @param {object} args
 * @param {string} args.turnId
 * @param {string} args.reason   one of NOTIFY_REASONS
 * @param {string} args.state    the turn state at send time
 * @param {string} args.message  the human-facing message body
 * @returns {Promise<{notificationId:string, telegram_ok:boolean, telegram_message_id:number|null, detail:string}>}
 */
export async function notify(pool, { turnId, reason, state, message }) {
  if (!NOTIFY_REASONS.includes(reason)) {
    throw new Error(`notify: unknown reason '${reason}' (expected one of ${NOTIFY_REASONS.join('|')})`);
  }

  // `message` may be a single string OR an array of strings. An array is sent as SEPARATE Telegram
  // messages in order — e.g. Larry's turn, THEN Codex's verdict: an actual back-and-forth, not one
  // combined message — while still recording exactly ONE dedup row per (turn_id, reason).
  const parts = (Array.isArray(message) ? message : [message]).filter((m) => typeof m === 'string' && m.trim() !== '');
  const stored = parts.join('\n----\n');

  // IDEMPOTENCY — claim the (turn_id, reason) slot FIRST. If we do not win the insert, this
  // notification already exists (e.g. a restart re-processed the turn): do NOT POST again and
  // do NOT create a duplicate row. Only the winner of the insert POSTs to Telegram.
  const claim = await pool.query(
    `insert into tower.notification (turn_id, reason, state, message, telegram_ok)
     values (?, ?, ?, ?, 0)
     on conflict (turn_id, reason) do nothing
     returning id`,
    [turnId, reason, state, stored],
  );
  if (claim.rows.length === 0) {
    return {
      notificationId: null, deduped: true, telegram_ok: false, telegram_message_id: null,
      detail: 'deduped — notification already exists for (turn_id, reason); Telegram not re-sent',
    };
  }
  const notificationId = claim.rows[0].id;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.AUTHORISED_TELEGRAM_USER_ID;

  let telegramOk = false;
  let telegramMessageId = null;
  let detail = '';

  // FAKE TRANSPORT (test double, injected via env): TOWER_NOTIFY_TRANSPORT=none makes notify
  // record the notification (dedup insert already happened above) WITHOUT any network call —
  // so the CI doubles suite exercises the real dedup path with no Telegram dependency.
  if (process.env.TOWER_NOTIFY_TRANSPORT === 'none') {
    detail = `not sent — TOWER_NOTIFY_TRANSPORT=none (test double, no network); ${parts.length} message(s)`;
  } else if (!token || !chatId) {
    detail = `not sent — missing ${!token ? 'TELEGRAM_BOT_TOKEN' : ''}${!token && !chatId ? ' and ' : ''}${!chatId ? 'AUTHORISED_TELEGRAM_USER_ID' : ''}`;
  } else {
    // Send each part as a SEPARATE Telegram message, in order (Larry's, then Codex's).
    let allOk = parts.length > 0;
    let okCount = 0;
    let firstErr = '';
    for (const part of parts) {
      const r = await sendOneTelegram(token, chatId, part);
      if (r.ok) { okCount += 1; if (telegramMessageId === null) telegramMessageId = r.messageId; }
      else { allOk = false; if (!firstErr) firstErr = r.detail; }
    }
    telegramOk = allOk;
    detail = `sent ${okCount}/${parts.length} via bot ${maskToken(token)}${allOk ? '' : ` — ${firstErr}`}`;
  }

  // Record the REAL delivery result onto the row we already claimed.
  await pool.query(
    `update tower.notification set telegram_ok = ?, telegram_message_id = ? where id = ?`,
    [telegramOk, telegramMessageId, notificationId],
  );

  return { notificationId, deduped: false, telegram_ok: telegramOk, telegram_message_id: telegramMessageId, detail, sent: parts.length };
}

// Send ONE Telegram message. Never throws; never echoes the token. Returns {ok, messageId, detail}.
async function sendOneTelegram(token, chatId, text) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);
    let resp;
    try {
      resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
        signal: controller.signal,
      });
    } finally { clearTimeout(timer); }
    const bodyText = await resp.text();
    let body = null; try { body = JSON.parse(bodyText); } catch { /* keep raw */ }
    if (resp.ok && body?.ok) return { ok: true, messageId: body.result?.message_id ?? null, detail: 'sent' };
    return { ok: false, messageId: null, detail: `telegram API rejected (http ${resp.status}): ${String(body?.description ?? bodyText).slice(0, 160)}` };
  } catch (e) {
    return { ok: false, messageId: null, detail: `telegram send failed: ${String(e?.message ?? e).slice(0, 160)}` };
  }
}

// AC7 (WO-2026-08-07-33) — a CONTROL-DIRECTIVE line, for the purpose of excerpting only.
//
// This is a LINE-PREFIX TEST and deliberately not a grammar. `ingestComment.mjs` owns the
// directive vocabulary in HEAD_RE / FINDING_RE / CHECKPOINT_RE, and re-implementing any of them
// here would create a second definition that drifts from the first the day either changes. The
// shape below mirrors the ONE test in that module which already decides directive-ness without
// reference to the individual patterns — its catch-all `/^\s*@tower\b/` (ingestComment.mjs:108),
// the line that makes any unrecognised `@tower` line malformed.
//
// ONE DELIBERATE WIDENING, stated rather than slipped in: this test is case-INSENSITIVE where
// that catch-all is not. CHECKPOINT_RE and FINDING_RE both carry the `i` flag, so `@Tower
// checkpoint:` is a directive the parser ACCEPTS; matching case-sensitively here would let that
// form leak into the card as if it were prose. Over-stripping is not a risk in the other
// direction — a line that begins `@tower` is never Larry's plain English.
const TOWER_DIRECTIVE_LINE = /^\s*@tower\b/i;

// Bounded, human-readable excerpt of Larry's turn so the Telegram message shows LARRY'S SIDE of
// the Larry<->Codex dialogue, not just Codex's verdict (Warwick's ask: "I have no idea what you
// are doing in response to Codex"). Strips code fences + collapses whitespace and caps the length
// so a long turn can never blow up the message.
//
// AC7 — AND STRIPS `@tower …` CONTROL-DIRECTIVE LINES FIRST. `pollPrComments.ensureCheckpointTurn`
// stores the PR comment VERBATIM as larry_response (correctly — that field is the durable record
// of what was actually written, and must never be edited). But a checkpoint comment leads with
// `@tower head:` / `@tower checkpoint:` / `@tower finding …`, so the card was rendering raw
// control syntax instead of Larry's reaction. The defect is in what the card is FED, not the card.
//
// TWO ORDERING FACTS, and both are why this belongs HERE rather than in composeLarryMessage or at
// the data layer:
//
//   1. THE STRIP MUST PRECEDE THE TRUNCATION. Directives are long; leaving them in until after the
//      280-char cut lets them consume the whole budget and truncate the prose away entirely.
//      Stripping downstream of summariseLarry cannot fix that — the information is already gone.
//   2. THE STRIP MUST PRECEDE THE WHITESPACE COLLAPSE. `\s+ -> ' '` destroys line structure, and a
//      line-prefix test needs lines. Running it after would silently match nothing.
//
// Doing it at the data layer instead would corrupt the verbatim record, which is why that is not
// an option. This is an EXCERPTING concern, so it lives in the excerpter.
export function summariseLarry(text, max = 280) {
  if (text === null || text === undefined) return '';
  const prose = String(text)
    .split(/\r?\n/)
    .filter((line) => !TOWER_DIRECTIVE_LINE.test(line))
    .join('\n');
  const clean = prose
    .replace(/```[\s\S]*?```/g, ' [code] ')  // closed fenced blocks -> placeholder
    .replace(/`+/g, ' ')                       // F-002: any leftover/unmatched backticks -> space
    .replace(/\s+/g, ' ').trim();
  // Empty after stripping is the EXPECTED case for a directives-only comment, and '' is the right
  // answer: composeLarryMessage already returns '' for it, so only the Codex card is sent. A card
  // reading "Larry: (nothing)" would be worse than no card.
  if (clean === '') return '';
  return clean.length > max ? (clean.slice(0, max - 1).trimEnd() + '…') : clean;
}

/**
 * Compose LARRY'S message — his side of the Larry<->Codex dialogue, sent as its OWN Telegram message
 * BEFORE Codex's (a real back-and-forth, not one combined message — Warwick's requirement). Returns ''
 * when there is no larry_response, in which case only the Codex message is sent.
 */
export function composeLarryMessage({ buildRef, turnSeq, turnId, larryResponse }) {
  const larry = summariseLarry(larryResponse);
  if (!larry) return '';
  return [
    `🗣 Larry — Tower ${buildRef ?? 'BUILD-014'} · turn #${turnSeq ?? '?'}`,
    larry,
    `turn: ${turnId}`,
  ].join('\n');
}

/** Compose CODEX'S message — the supervisor verdict/action, sent as its OWN Telegram message after Larry's. */
export function composeMessage({ buildRef, turnSeq, turnId, state, verdict, summary, nextAction, warwickNeeded }) {
  const lines = [
    `🤖 Codex — Tower ${buildRef ?? 'BUILD-014'} · turn #${turnSeq ?? '?'}`,
    `state: ${state}`,
    verdict ? `verdict: ${verdict}` : null,
    summary ? `— ${summary}` : null,
    nextAction ? `next: ${nextAction}` : null,
    warwickNeeded ? '⚠️ Warwick needs to act.' : null,
    `turn: ${turnId}`,
  ].filter(Boolean);
  return lines.join('\n');
}

// ── W3/W4 (WO-2026-08-05-09, WP-2E) — the QA-exchange composers ─────────────────────────────
//
// Two DELIBERATELY SEPARATE safety caps, and they must never be confused with each other or with
// summariseLarry's 280-char default above:
//
//   - summariseLarry's 280 is a SUMMARY — it exists to keep Larry's excerpt short on purpose.
//   - the two caps below are a Telegram PAYLOAD BACKSTOP only (Telegram's hard limit is 4096
//     chars per message). They are set far above any realistic finding/rationale text so they
//     never clip real content — the WO's own acceptance evidence requires a test proving
//     disposition_rationale specifically survives intact past "today's cap" (280), and reusing
//     summariseLarry here would fail that on the first non-trivial rationale.
const EVIDENCE_SAFETY_CAP = 1200;
const RATIONALE_SAFETY_CAP = 3000;

function truncateSafety(text, max) {
  const s = String(text ?? '').trim();
  if (!s) return '';
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/** One line per NEW finding this round's merge-class QA raised. Codex's own short ref (e.g.
 *  "TQA-001") is shown alongside the tower.finding UUID so Warwick can always tell which id
 *  answers which Codex reference — the same pairing W1 embeds into `description` at write time. */
function formatFindingForTelegram(f) {
  const ref = f?.codexId ? `${f.codexId} ` : '';
  const head = `${ref}(${f?.id}) — ${f?.technical_impact ?? '?'}/${f?.reachability ?? '?'}/${f?.required_disposition ?? '?'}`;
  const evidence = truncateSafety(f?.evidence, EVIDENCE_SAFETY_CAP);
  return evidence ? `${head}\n  ${evidence}` : head;
}

/**
 * W3 — compose the THIRD message part: the real content of any findings THIS round's merge-class
 * QA raised — id, impact, reachability, required disposition, and the evidence text. Not a count,
 * not a verdict word (§14.7's requirement 1). Returns '' when the round opened no findings, so an
 * ordinary delivery round is byte-for-byte unchanged and `.filter(Boolean)` drops it from the
 * outgoing message array.
 */
export function composeFindingsMessage({ buildRef, turnSeq, turnId, findings = [] }) {
  if (!Array.isArray(findings) || findings.length === 0) return '';
  const lines = [
    `🔎 Codex findings — Tower ${buildRef ?? 'BUILD-014'} · turn #${turnSeq ?? '?'}`,
    ...findings.map((f) => formatFindingForTelegram(f)),
    `turn: ${turnId}`,
  ];
  return lines.join('\n');
}

/**
 * W4 — compose the disposition ECHO message. Every field here MUST come from the `finding` object
 * the caller passes in, and that object must itself have been re-read from tower.finding AFTER the
 * disposing write committed (see watcher.mjs readDisposedFindings) — this function performs no
 * read of its own, on purpose, so the read-back boundary stays in exactly one place a mutation can
 * be pinned to. Renders `disposition_rationale` PROSE, never the bare `disposition` enum
 * (§14.7's requirement 2) — "addressed" alone tells Warwick nothing about how.
 */
export function composeDispositionMessage({ buildRef, turnSeq, turnId, finding }) {
  const rationale = truncateSafety(finding?.disposition_rationale, RATIONALE_SAFETY_CAP);
  const lines = [
    `↩️ Disposition — Tower ${buildRef ?? 'BUILD-014'} · turn #${turnSeq ?? '?'}`,
    `finding: ${finding?.id}${finding?.description ? ` — ${truncateSafety(finding.description, 200)}` : ''}`,
    `disposition: ${finding?.disposition ?? '(none)'}`,
    rationale || '(no rationale recorded)',
    `turn: ${turnId}`,
  ];
  return lines.join('\n');
}

// ── WO-2026-08-07-33 — the QA-STARTED composer ──────────────────────────────────────────────
//
// PROVENANCE IS THE POINT OF THIS CARD, not decoration. "Codex QA started" on its own tells
// Warwick that something is happening to something; the PR number and the head are what make it
// a statement he can act on. So this composer states both, and it NEVER abbreviates the head —
// deliberately unlike the 12-char slices used in pollPrComments' refusal messages, which are
// diagnostics for a human reading a log rather than the identity of the thing under review.
//
// NOTHING IS EVER INVENTED HERE. A turn that carries no PR number or no canonical head says so
// in words. The alternative — defaulting to a plausible value, or silently omitting the line —
// would produce a card that reads as full provenance while carrying none, which is precisely the
// failure this card exists to avoid.

const CANONICAL_HEAD = /^[0-9a-f]{40}$/;

/** `#87`, or an explicit statement that this turn is not bound to a pull request. */
function formatPrRef(prNumber) {
  const n = Number(prNumber);
  return Number.isInteger(n) && n > 0 ? `#${n}` : '(not a pull-request turn)';
}

/** The FULL 40-hex head, or an explicit statement that the turn carries no canonical one. */
function formatHeadRef(headSha) {
  const s = String(headSha ?? '').trim().toLowerCase();
  return CANONICAL_HEAD.test(s) ? s : '(no canonical head recorded on this turn)';
}

/**
 * Compose the QA-STARTED message — the opening beat of the TowerBot QA sequence, sent BEFORE the
 * Codex verdict/findings cards rather than after them. One message, one dedup row keyed on the
 * real turn id.
 *
 * Its caller (watcher.mjs processTurn) owns the WHEN and it is load-bearing; this function owns
 * only the WHAT. Keep them separate: a composer that could be called from a second place would
 * make the timing guarantee unverifiable by reading either file alone.
 */
export function composeQaStartedMessage({ buildRef, turnSeq, turnId, prNumber, headSha }) {
  return [
    `🤖 Codex QA started — Tower ${buildRef ?? 'BUILD-014'} · turn #${turnSeq ?? '?'}`,
    `PR: ${formatPrRef(prNumber)}`,
    `head: ${formatHeadRef(headSha)}`,
    'Codex is reviewing this head now — the verdict follows.',
    `turn: ${turnId}`,
  ].join('\n');
}
