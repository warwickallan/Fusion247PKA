// =====================================================================
// BUILD-015 AsdAIr browser runner - THE CONTROL CHANNEL.
//
// pause / resume / human takeover / stop-at-basket-ready arrive here.
//
// WHY A FILE AND NOT THE DATABASE. The four control words must work in exactly
// the moments the database may not: when Warwick wants his hands on the browser
// NOW, when the network to Supabase is down, or when the runner is wedged
// mid-request. A tiny local JSON file needs no credentials, no connection and
// no schema change, so `runnerctl pause` works from any terminal on this
// machine even with everything else broken. The database remains the RECORD of
// what happened; this file is only the doorbell.
//
// The runner also treats a request whose database status has become 'cancelled'
// as a stop, so the Cockpit and Telegram retain a remote off-switch.
//
// Directives are LEVELS, not edges: the file holds the current wish, so a
// directive issued while the runner was down is still obeyed when it comes up.
// =====================================================================
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const DIRECTIVES = Object.freeze(['run', 'pause', 'resume', 'takeover', 'stop']);

function stateDir(env = process.env) {
  return env.ASDAIR_RUNNER_STATE_DIR || path.join('C:', '.fusion247', 'asdair', 'runner');
}
function controlPath(env = process.env) {
  return path.join(stateDir(env), 'control.json');
}

/** Current directive. A missing or unreadable file means 'run' - never a crash. */
function read(env = process.env) {
  const file = controlPath(env);
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    const d = DIRECTIVES.includes(raw.directive) ? raw.directive : 'run';
    return { directive: d, at: raw.at || null, by: raw.by || null, note: raw.note || null, source: file };
  } catch {
    return { directive: 'run', at: null, by: null, note: null, source: file };
  }
}

/** Write a directive atomically (temp file + rename) so a reader never sees half a file. */
function write(directive, { by = os.userInfo().username, note = null, env = process.env } = {}) {
  if (!DIRECTIVES.includes(directive)) throw new Error(`unknown directive: ${directive}`);
  const dir = stateDir(env);
  fs.mkdirSync(dir, { recursive: true });
  const file = controlPath(env);
  const tmp = `${file}.${process.pid}.tmp`;
  const body = { directive, at: new Date().toISOString(), by, note };
  fs.writeFileSync(tmp, JSON.stringify(body, null, 2), 'utf8');
  fs.renameSync(tmp, file);
  return { ...body, source: file };
}

/**
 * Translate the current directive into what the runner should do next.
 *   proceed  - execute the next step
 *   hold     - issue no browser commands, keep the lease, keep heartbeating
 *   release  - drop the lease and let a human drive
 *   finish   - stop cleanly at basket-ready and leave the browser on the trolley
 */
function decide(directive) {
  switch (directive) {
    case 'pause': return 'hold';
    case 'takeover': return 'release';
    case 'stop': return 'finish';
    case 'run':
    case 'resume':
    default: return 'proceed';
  }
}

module.exports = { DIRECTIVES, stateDir, controlPath, read, write, decide };
