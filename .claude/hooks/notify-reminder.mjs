#!/usr/bin/env node
// PostToolUse reminder — fires when a dispatched specialist returns to the parent.
//
// WHAT THIS IS: a zero-model reminder. It resurfaces the Warwick notification rule at the exact
// moment the decision is due. Root CLAUDE.md § "Rule 4a — the Warwick notification rule" is
// canonical; this file MUST NOT restate the criteria, only point at the moment.
//
// WHAT THIS IS DELIBERATELY NOT, and none of it may ever be added here
// (Warwick, 2026-08-06 — "The hook must not classify significance, send automatically, launch an
//  agent or create a daemon. It only resurfaces the rule at the moment of decision."):
//
//   - it does NOT classify significance          — that judgement is Larry's and stays Larry's
//   - it does NOT send anything                  — no Telegram call, no network, ever
//   - it does NOT launch an agent                — no model is invoked; this costs zero tokens
//   - it does NOT create or touch a daemon       — it runs, prints, and exits
//   - it reads NO credentials and NO private surface
//
// WHY A REMINDER RATHER THAN AUTOMATION: the DevBot transport is proven (J2-e, message_id 326).
// The repeated failure was ATTENTION AT THE POINT OF JUDGEMENT — twice in one session, by the
// author of the rule. Automating the decision was explicitly rejected; resurfacing it was not.
//
// Exit 0 always. A reminder that can break the parent turn is worse than no reminder.

const REMINDER =
  'A specialist has returned. Before summarising or beginning further parent work, apply the ' +
  'Warwick notification rule now. If it qualifies, send through FusionDevBot first; then report ' +
  'and yield.';

try {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: REMINDER,
    },
  }));
} catch {
  // Never fail the parent turn over a reminder.
}

process.exit(0);
