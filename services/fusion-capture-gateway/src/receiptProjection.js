// Receipt + card projection — pure, deterministic, RETRYABLE.
//
// Source of truth: capture-contract-pack-v1 (Capture Receipt §3) +
// supabase-operational-foundation-boundary.md §3/§4 (cards are a retryable
// projection of processing-state; "safe and waiting" until write+evidence exist;
// no false completion).
//
// A projection maps an operational store record onto (a) a Capture Receipt and
// (b) a minimal card model. Same record in ⇒ same projection out, every time —
// so a re-sent/edited card is always safe to retry. NO I/O, NO clock reads.

import { createReceipt } from './core/contracts.js';
import {
  STATES,
  TERMINAL_STATES,
  SAFE_AND_WAITING_STATES,
} from './core/states.js';

/**
 * Human-facing status line per state. Wording is honest:
 *  - accepted → item is SAFE and PENDING the user's tap (tap-gated capture).
 *  - queued/offline_queued/claimed/writing → item is SAFE, not yet done.
 *  - written/evidenced → nearly there, finalising.
 *  - completed → done, with destination.
 *  - failed/partial → honest failure; nothing lost, will retry.
 */
function statusLineFor(state, record) {
  switch (state) {
    case STATES.RECEIVED:
      return 'Received — safe and saved. Not yet written to your Brain.';
    case STATES.ACCEPTED:
      // TAP-GATED pending state (Warwick decision 2026-07-16): the capture is
      // durable but is NOT written until the user taps "Save to Brain".
      return 'Received — safe and saved. Tap "Save to Brain" to write it to your Brain.';
    case STATES.QUEUED:
    case STATES.OFFLINE_QUEUED:
    case STATES.CLAIMED:
    case STATES.WRITING:
      return 'Saved and safe — waiting to be written to your Brain.';
    case STATES.WRITTEN:
    case STATES.EVIDENCED:
      return 'Almost there — write recorded, finalising your capture.';
    case STATES.COMPLETED: {
      // WP2: a YouTube capture completes via the routing writer — the durable
      // work is the extracted transcript + immutable RAW + youtube_source row,
      // and the standalone knowledge note is authored in-session afterwards
      // (D-cairn). The card must say that TRUTHFULLY — NOT "saved to your Brain"
      // (which would over-claim a finished note). Keyed on the destination kind
      // the routing writer records, so the plain-markdown path is unchanged.
      if (record.destination_ref && record.destination_ref.kind === 'youtube_source') {
        const vid = record.destination_ref.video_id ? ` (${record.destination_ref.video_id})` : '';
        return `Completed — transcript extracted and preserved${vid}. Knowledge note pending in-session authoring, then it appears for review.`;
      }
      // The destination path is wrapped in backticks (a Telegram legacy-Markdown
      // code span, sent with parse_mode 'Markdown' — see projectCard) so the
      // `.md` filename renders as plain monospace text instead of being
      // auto-linked as a bogus URL (live finding 2026-07-16: Telegram linkified
      // the filename as a Moldovan domain). Any backtick inside the path (never
      // produced by the governed writer) is stripped defensively so the code
      // span cannot be broken.
      const dest = record.destination_ref && record.destination_ref.path
        ? ` (\`${String(record.destination_ref.path).replace(/`/g, "'")}\`)`
        : '';
      return `Completed — saved to your Brain${dest}.`;
    }
    case STATES.PARTIAL:
      return 'Partially completed — some steps failed. Nothing lost; it will be retried.';
    case STATES.FAILED: {
      const err = record.last_error ? `: ${record.last_error}` : '';
      return `Failed — your capture is safe and will be retried${err}. Not written to your Brain yet.`;
    }
    case STATES.NEEDS_CLARIFICATION:
      return 'Needs a quick clarification before it can be saved.';
    case STATES.CANCELLED:
      return 'Cancelled — nothing was written.';
    default:
      return 'Status unknown.';
  }
}

function isoOrNow(ms) {
  const n = typeof ms === 'number' && Number.isFinite(ms) ? ms : 0;
  return new Date(n).toISOString();
}

/**
 * Project a store record onto a Capture Receipt (contract-valid for the state).
 */
export function projectReceipt(record) {
  if (!record || typeof record.state !== 'string') {
    throw new Error('projectReceipt: record with a state required');
  }
  const state = record.state;
  const isTerminal = TERMINAL_STATES.includes(state);
  const safeAndWaiting = SAFE_AND_WAITING_STATES.includes(state);

  const base = {
    capture_id: record.capture_id,
    state,
    status_line: statusLineFor(state, record),
    is_terminal: isTerminal,
    safe_and_waiting: safeAndWaiting,
    updated_at: isoOrNow(record.updated_at_ms),
  };

  // completed carries destination + evidence pointers (never before both exist).
  if (state === STATES.COMPLETED) {
    base.destination_ref = record.destination_ref ?? null;
    const firstEvidence = Array.isArray(record.evidence_pointers) && record.evidence_pointers.length > 0
      ? record.evidence_pointers[0]
      : null;
    base.evidence_ref = firstEvidence;
  }

  // failed/partial carry an honest failure block.
  if (state === STATES.FAILED || state === STATES.PARTIAL) {
    base.failure = { error: record.last_error ?? 'unknown', state };
  }

  // needs_clarification carries the question.
  if (state === STATES.NEEDS_CLARIFICATION) {
    base.clarification = record.clarification ?? { question: 'Clarification required.' };
  }

  return createReceipt(base);
}

/**
 * Project a store record onto a minimal card model. is_completed is true ONLY
 * when the state is exactly `completed` — no false completion is possible.
 */
export function projectCard(record) {
  if (!record || typeof record.state !== 'string') {
    throw new Error('projectCard: record with a state required');
  }
  const card = {
    status_line: statusLineFor(record.state, record),
    state: record.state,
    is_completed: record.state === STATES.COMPLETED,
  };
  // ONLY the completed card carries a parse_mode: its status line embeds the
  // destination path in a backtick code span (see statusLineFor) and Telegram
  // needs legacy-Markdown parsing to render it as monospace. Every other status
  // line is plain text with NO Markdown-special characters of ours, and failed
  // lines may echo arbitrary error text — so they are deliberately sent WITHOUT
  // a parse_mode (no risk of a Telegram parse rejection on untrusted text).
  // parse_mode 'Markdown' is needed ONLY for the markdown-destination completed
  // line, whose backtick code span renders the `.md` path as monospace. The
  // youtube_source completed line has no code span and a video id can contain
  // `_`/`-` (legacy-Markdown italic markers) — so it is sent WITHOUT a parse_mode
  // to avoid a Telegram parse rejection on an unbalanced marker.
  if (card.is_completed && record.destination_ref && record.destination_ref.path) {
    card.parse_mode = 'Markdown';
  }
  return card;
}
