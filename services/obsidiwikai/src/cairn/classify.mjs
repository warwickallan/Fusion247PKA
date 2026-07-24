// Cairn's classifier — decides lane/intent/privacy/action for a durable capture.
// PURE + rule-based: privacy is determined LOCALLY (no raw content shipped to external reasoning
// to discover whether it's private). Explicit instruction outranks inference. Fails closed.
import { LANE, INTENT, PRIVACY, ACTION, decision } from './contracts.mjs';

const YT_HOST = /(youtube\.com|youtu\.be)/i;
const URL_RE = /https?:\/\/[^\s]+/i;
const PERSONAL_RE = /\b(journal|diary|reflection|my (wife|kids|son|daughter|family|health)|blood pressure|medication|therapy|anxious|depress|dear diary|felt|feeling)\b/i;
const WORK_RE = /\b(bellrock|concerto|\bclient\b|\bcustomer\b|\bsla\b|colleague|work project)\b/i;
const TASK_RE = /\b(remind me|reminder|to-?do|task:|don'?t forget|need to|must (do|remember))\b/i;
const JOURNAL_MARK = /^\s*(journal|reflection|diary|note to self)\s*[:\-]/i;

function firstUrl(c) {
  if (c.url) return c.url;
  const m = (c.text || '').match(URL_RE);
  return m ? m[0] : null;
}

// Is this an actual "send to Honcho" COMMAND (not merely a mention of the word Honcho)?
// Deliberately tight: a bare "Honcho" or "…discusses Honcho…" must NOT trigger an auto-ACT,
// and an explicit negation ("don't send this to Honcho") must NOT either.
export function isHonchoCommand(t) {
  // Unambiguous structured / command markers.
  if (/#honcho\b/i.test(t) || /→\s*honcho\b/i.test(t) || /(^|\n)\s*honch(o)?\s+(that|this|it)\b/i.test(t)) return true;
  // Imperative "send/forward/save this to Honcho" — but never when negated.
  const imperative = /\b(send|forward|save|add|put|post)\s+(this|that|it|these|the\s+\w+)\s+(to|into|in)\s+honcho\b/i;
  const remember = /\bremember\s+(this|that)\s+about\s+me\b/i;
  if (imperative.test(t) || remember.test(t)) {
    if (/\b(don'?t|do not|never|no need to|not)\b[^.!?\n]*\bhoncho\b/i.test(t)) return false;
    return true;
  }
  return false;
}

// Explicit destination markers — Warwick telling Cairn where it goes. Outranks inference.
// `t` is subject + body combined, so an email whose SUBJECT is "Honch that" is caught.
function explicitTarget(t) {
  // "Honch that" is Warwick's deliberate GPT→brain instruction. → Honcho context lane.
  if (isHonchoCommand(t)) return { lane: LANE.HONCHO, intent: INTENT.REMEMBER, what: 'explicit → Honcho context' };
  if (/#journal|→\s*obsidian|to obsidian|save to journal/i.test(t)) return { lane: LANE.PERSONAL, intent: INTENT.JOURNAL, what: 'explicit → journal' };
  if (/#task|→\s*task\b|as a task/i.test(t)) return { lane: LANE.TASK, intent: INTENT.TASK, what: 'explicit → task' };
  if (/#keep|keep raw|just keep/i.test(t)) return { lane: LANE.ENCYCLOPEDIA, intent: INTENT.KEEP, treatment: INTENT.KEEP, what: 'explicit → keep' };
  if (/#learn|→\s*brain|learn this|save to brain/i.test(t)) return { lane: LANE.ENCYCLOPEDIA, intent: INTENT.LEARN, treatment: INTENT.LEARN, what: 'explicit → learn' };
  return null;
}

export function classify(capture, { feedback = [] } = {}) {
  const body = capture.text || capture.payload_text || capture.text_preview || '';
  // subject-aware: source adapters (email) pass a subject line that may carry the instruction.
  const text = [capture.subject, body].filter(Boolean).join('\n');
  const url = firstUrl({ url: capture.url, text });

  // 1) PRIVACY FIRST, locally (fail closed). Governs what may leave for external reasoning.
  let privacy = PRIVACY.WORLD;
  if (WORK_RE.test(text)) privacy = PRIVACY.WORK;
  else if (PERSONAL_RE.test(text) || JOURNAL_MARK.test(text)) privacy = PRIVACY.PERSONAL;

  // 2) EXPLICIT instruction wins (may not downgrade privacy).
  let explicit = explicitTarget(text);
  if (!explicit && capture.recorded_intent === 'SaveToBrain') explicit = { lane: LANE.ENCYCLOPEDIA, intent: INTENT.LEARN, treatment: INTENT.LEARN, what: 'explicit → learn' };

  // 3) infer
  let d;
  if (explicit) {
    d = { ...explicit, source_type: url ? (YT_HOST.test(url) ? 'youtube' : 'url') : 'text', confidence: 0.95, decided_by: 'rules', rationale: 'explicit Warwick instruction', explicit: true };
  } else if (privacy === PRIVACY.WORK) {
    d = { source_type: 'text', what: 'work/client material', intent: INTENT.KEEP, lane: LANE.WORK, confidence: 0.7, rationale: 'work/Bellrock signal — walled lane (deferred)' };
  } else if (privacy === PRIVACY.PERSONAL) {
    d = { source_type: 'text', what: 'personal reflection/journal', intent: INTENT.JOURNAL, lane: LANE.PERSONAL, confidence: 0.8, rationale: 'personal signal — personal vault, not external knowledge' };
  } else if (url && YT_HOST.test(url)) {
    d = { source_type: 'youtube', what: 'YouTube video', intent: INTENT.LEARN, lane: LANE.ENCYCLOPEDIA, treatment: INTENT.LEARN, confidence: 0.9, rationale: 'YouTube URL → external knowledge → learn' };
  } else if (url) {
    d = { source_type: 'url', what: 'web article/link', intent: INTENT.LEARN, lane: LANE.ENCYCLOPEDIA, treatment: INTENT.LEARN, confidence: 0.75, rationale: 'external URL → external knowledge → learn' };
  } else if (TASK_RE.test(text)) {
    d = { source_type: 'text', what: 'task/reminder', intent: INTENT.TASK, lane: LANE.TASK, confidence: 0.8, rationale: 'task/reminder phrasing' };
  } else if (JOURNAL_MARK.test(text)) {
    d = { source_type: 'text', what: 'journal/reflection', intent: INTENT.JOURNAL, lane: LANE.PERSONAL, confidence: 0.75, rationale: 'journal marker' };
  } else {
    d = { source_type: 'text', what: 'unclassified text', intent: INTENT.ASK, lane: LANE.UNKNOWN, confidence: 0.3, rationale: 'no clear signal' };
  }
  d.privacy = privacy;

  // 4) learned feedback — raises confidence / adjusts lane; NEVER upgrades privacy scope.
  const learned = matchFeedback(d, url, feedback);
  if (learned) {
    d.lane = learned.correct_lane || d.lane;
    d.intent = learned.correct_intent || d.intent;
    d.treatment = learned.correct_treatment || d.treatment;
    d.confidence = Math.min(0.99, d.confidence + 0.05 * (learned.weight || 1));
    d.decided_by = 'learned';
    d.rationale = `${d.rationale} (+learned:${learned.pattern_key})`;
  }

  // 5) action policy
  let action;
  if (d.explicit) action = ACTION.ACT;                          // explicit instruction → act
  else if (d.lane === LANE.UNKNOWN || d.confidence < 0.5) action = ACTION.ASK; // ambiguous → ask
  else if (d.privacy === PRIVACY.RESTRICTED) action = ACTION.ASK;              // uncertain privacy → fail closed
  else action = ACTION.CONFIRM;                                 // all inferred actions → confirm-first

  return decision({ ...d, action });
}

function matchFeedback(d, url, feedback) {
  const host = url ? (url.match(/https?:\/\/([^/]+)/i) || [])[1] : null;
  for (const f of feedback) {
    if (f.pattern_key === d.source_type) return f;
    if (host && f.pattern_key === `url_host:${host}`) return f;
  }
  return null;
}
