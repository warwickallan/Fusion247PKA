#!/usr/bin/env node
// Stop hook — resurfaces the Warwick notification rule AT THE MOMENT LARRY GOES IDLE.
//
// WHY THIS EXISTS AND THE EXISTING REMINDER WAS NOT ENOUGH (2026-08-08, three misses in one session).
// `notify-reminder.mjs` fires on PostToolUse when a dispatched specialist returns. That is a real
// moment of decision, but it is not the one that keeps failing — and on 2026-08-08 it was ALSO NOT
// REGISTERED IN ANY SETTINGS FILE, so it had never fired at all. Every miss that day happened after
// Larry did the work HIMSELF and then ended the turn. No specialist returned, so no reminder could
// have fired even had it been wired. Warwick, verbatim:
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
 * THE WHOLE DECISION, as a pure function so it can be mutation-tested.
 * Remind unless a successful ding happened since the previous idle moment.
 */
export function shouldRemind({ lastDing, lastStop }) {
  return !(lastDing > lastStop);
}

export function run({ now = Date.now(), ding = lastDingMs(), state = readState(), write = true } = {}) {
  const remind = shouldRemind({ lastDing: ding, lastStop: state.lastStopMs });
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
