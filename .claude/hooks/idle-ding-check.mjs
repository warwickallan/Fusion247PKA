#!/usr/bin/env node
// Stop hook — resurfaces the Warwick notification rule AT THE MOMENT LARRY GOES IDLE.
//
// ⛔ THE HISTORY, CORRECTED 2026-08-08 BY WARWICK FROM GIT. The first version of this header said
// `notify-reminder.mjs` "was NOT REGISTERED IN ANY SETTINGS FILE" and "has never fired". BOTH WERE
// FALSE, and asserting them without reading the history is the failure this file must not repeat:
//
//   • `89602f3` (2026-08-06) — it WAS registered, in tracked `.claude/settings.json`.
//   • `34d0cd0` (2026-08-06) — it WAS OBSERVED FIRING, by execution. That same evidence established
//     the event fact that matters: PostToolUse on a background Task fires at DISPATCH/LAUNCH, NOT
//     when the specialist later returns. The commit recorded that it therefore fires at the wrong
//     moment, AND it already considered a Stop hook, rejecting the naive form on the grounds that a
//     reminder firing every turn becomes noise and is eventually ignored.
//   • `664ea4c` (2026-08-07) — the specialist-return experiment was DELIBERATELY DESCOPED after a
//     demonstrated regression, together with the three `return-cue-*` hooks. A product decision, not
//     an accidental gap.
//
// So the prior experiment must not be pretended away, and `notify-reminder.mjs` must NOT be
// re-registered — it watches an event that does not occur — unless new executable evidence shows the
// host's event semantics have themselves changed.
//
// WHY A STOP HOOK IS NEVERTHELESS VIABLE NOW, against `34d0cd0`'s recorded objection: that objection
// was to a NAIVE Stop reminder that fires on every turn. This one does not. The factual mute below —
// "has a real ding been sent since the previous idle moment?" — is the material change, and it is
// what stops the reminder becoming wallpaper. The design is allowed to be better than the rejected
// one; it is not allowed to act as though the rejection never happened.
//
// WHAT KEEPS FAILING is the moment itself. Every miss on 2026-08-08 happened after Larry did the
// work HIMSELF and ended the turn — no specialist was involved at all. Warwick, verbatim:
//
//   "you should never be sat idle when we are mid phase or sub phase without dinging me!"
//
// Going idle is the event. This hook watches that event and nothing else.
//
// ⛔ WHAT IT DELIBERATELY IS NOT — Warwick, 2026-08-06, and unchanged by this file:
//   - it does NOT classify significance     — that judgement is Larry's and stays Larry's
//   - it does NOT send anything             — no Telegram, no network, ever
//   - it does NOT launch an agent           — no model is invoked; it costs zero tokens
//   - it reads NO credentials, NO private surface, and no message CONTENT
//
// THE MUTE IS A FACT, NOT A JUDGEMENT. It asks one question of the ding log: has a successful send
// happened since the previous time Larry went idle? That is an observable event, not an opinion about
// whether the outcome deserved one. If a ding went out, the rule was applied and the reminder would be
// noise — and a reminder that fires every single turn is one Larry learns to scroll past, which is how
// the previous compensating habit decayed.
//
// Exit 0 ALWAYS. A reminder that can break the turn is worse than no reminder.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

export const DING_LOG = join(homedir(), '.mypka', 'governor', 'ding-log.jsonl');
export const STATE_PATH = join(homedir(), '.mypka', 'governor', 'idle-check-state.json');

export const REMINDER =
  'You are ending the turn with a build phase active, and NO FusionDevBot notification has gone out ' +
  'since the last time you went idle. Apply the Warwick notification rule now (root CLAUDE.md ' +
  '§ "Rule 4a"): if this turn produced a substantive outcome, a gate verdict, a significant failure, ' +
  'a recovery, or anything needing his decision or action — send it, then finish. If it genuinely ' +
  'does not qualify, say nothing and continue.';

/** Last SUCCESSFUL send time from the ding log, in ms. 0 when there is none. */
export function lastDingMs(read = () => readFileSync(DING_LOG, 'utf8')) {
  let text;
  try { text = read(); } catch { return 0; }
  let best = 0;
  for (const line of String(text).split(/\r?\n/)) {
    if (!line.trim()) continue;
    let rec;
    try { rec = JSON.parse(line); } catch { continue; }
    // Only a real send counts. An attempted-and-failed ding is not a notification Warwick received.
    //
    // ⚠️ THE FIELD IS `outcome`, NOT `ok`. The first version of this line tested `rec.ok === true`,
    // which is nowhere in the record ding.mjs actually writes — so the hook reported "no ding has
    // ever been sent" while sitting on a log full of successful sends. It passed its own unit test
    // because the test fed it the ASSUMED shape. Caught only by running it against the live log.
    // This is the watched family `control-cannot-reach-what-it-checks`, hit inside the very control
    // written to fix a different miss. The fixture below is now copied from the real file.
    if (rec.outcome !== 'sent' || rec.exit !== 0) continue;
    const t = Date.parse(rec.ts || rec.at || rec.time || '');
    if (Number.isFinite(t) && t > best) best = t;
  }
  return best;
}

export function readState(read = () => readFileSync(STATE_PATH, 'utf8')) {
  try {
    const j = JSON.parse(read());
    return Number.isFinite(j.lastStopMs) ? j : { lastStopMs: 0 };
  } catch { return { lastStopMs: 0 }; }
}

/**
 * How recently a real notification counts as "Warwick has just heard from me". Within this window
 * the reminder stays quiet even across several turns.
 *
 * THIS WINDOW IS WHAT ANSWERS `34d0cd0`'s OBJECTION, and it was added only after measuring the
 * failure: without it, a six-turn exchange containing one genuine ding still fired FIVE reminders.
 * That is the wallpaper the earlier Stop proposal was rejected for. The window is purely temporal —
 * it reads a clock and a log, classifies nothing, and judges no outcome's significance.
 */
export const RECENT_CONTACT_MS = 20 * 60 * 1000;

/**
 * THE WHOLE DECISION, as a pure function so it can be mutation-tested.
 *
 * Stay quiet when EITHER a successful ding has happened since the previous idle moment, OR one
 * happened recently enough that Warwick has current context. Otherwise remind.
 *
 * A long unattended stretch with no notification at all fires every time — correctly, because that
 * IS the failure being guarded. A rapid back-and-forth where he is already being kept informed does
 * not, because a reminder he scrolls past is worth less than no reminder at all.
 */
export function shouldRemind({ lastDing, lastStop, now = Date.now() }) {
  if (lastDing > lastStop) return false;
  if (lastDing > 0 && now - lastDing < RECENT_CONTACT_MS) return false;
  return true;
}

export function run({ now = Date.now(), ding = lastDingMs(), state = readState(), write = true } = {}) {
  const remind = shouldRemind({ lastDing: ding, lastStop: state.lastStopMs, now });
  if (write) {
    try {
      mkdirSync(dirname(STATE_PATH), { recursive: true });
      writeFileSync(STATE_PATH, JSON.stringify({ lastStopMs: now }, null, 2) + '\n');
    } catch { /* the marker is best-effort; a failed write must never break the turn */ }
  }
  return remind;
}

const isMain = process.argv[1] && import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`;
if (isMain) {
  try {
    if (run()) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: { hookEventName: 'Stop', additionalContext: REMINDER },
      }));
    }
  } catch { /* never break the turn */ }
  process.exitCode = 0;
}
