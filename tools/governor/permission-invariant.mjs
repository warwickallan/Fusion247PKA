#!/usr/bin/env node
/**
 * PERMISSION INVARIANT — the executable form of Warwick's ruling, 2026-08-13:
 *
 *   "MY WORD IS MY AUTHORISATION. For bounded work Warwick has authorised, he must NOT be
 *    asked to approve the same shell/edit/git/test/build actions again."
 *
 * WHY THIS EXISTS. On 2026-08-13 Warwick was still being shown "Allow Claude to run?" for
 * ordinary authorised work in this estate. Established by execution, the cause was two-layered:
 *
 *   1. C:/ProgramData/ClaudeCode/managed-settings.json carried an `ask` block on
 *      `git push origin main`. Managed settings are the HIGHEST precedence source in Claude
 *      Code, so it defeated the project's own configuration - including a local
 *      `defaultMode: bypassPermissions`, which never stood a chance against it. Every record
 *      commit that night ended in a push to main, so every one of them raised a modal on
 *      Warwick's phone.
 *   2. .claude/settings.local.json - which is GITIGNORED - had accreted a 200-entry allow
 *      list of which 153 were exact one-off literals with no wildcard. That is the signature
 *      of clicking "Allow once": each new command shape prompts again, and none of it
 *      survives a clone, a new machine, or a fresh worker.
 *
 * WHAT THIS ASSERTS, and nothing more. It is a bar on regression, NOT a permission framework.
 * The regrowth cap in CLAUDE.md applies at full force: do not grow this into a control plane.
 *
 * It fails if a fresh session in this estate would again require manual approval for standard
 * work, AND it fails if the safety floor has been quietly removed - because a check that only
 * looks one way would happily pass a configuration that permits everything.
 *
 * Run:  node tools/governor/permission-invariant.mjs
 * Exit: 0 = invariant holds. 1 = it does not, and the reason is printed.
 */
import { readFileSync, existsSync } from 'node:fs';

const MANAGED = 'C:/ProgramData/ClaudeCode/managed-settings.json';
const PROJECT = 'C:/Fusion247PKA/.claude/settings.json';

/** Routine authorised work. If any of these would prompt, the invariant is broken. */
const MUST_NOT_PROMPT = [
  'Bash(git status)',
  'Bash(git diff)',
  'Bash(git log)',
  'Bash(git add)',
  'Bash(git commit)',
  'Bash(git push)',
  'Bash(git worktree)',
  'Bash(node)',
  'Bash(npm)',
  'Bash(python)',
  'Bash(bash)',
];

/** The safety floor. If any of these stops being denied, the invariant is ALSO broken. */
const MUST_STAY_DENIED = [
  'git push --force',
  'git branch -D',
  'git push --delete',
];

const problems = [];

function load(path, label) {
  if (!existsSync(path)) return { __missing: true, __label: label };
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    problems.push(`${label} is not parseable JSON: ${e.message}`);
    return { __unparseable: true, __label: label };
  }
}

const managed = load(MANAGED, 'managed-settings.json');
const project = load(PROJECT, 'project .claude/settings.json');

// ---------------------------------------------------------------------------
// 1. No `ask` rule anywhere may cover routine work.
//    This is the rule that actually bit Warwick, so it is checked first and by name.
// ---------------------------------------------------------------------------
for (const [label, cfg] of [['managed-settings.json', managed], ['project settings.json', project]]) {
  const ask = cfg?.permissions?.ask;
  if (Array.isArray(ask) && ask.length > 0) {
    problems.push(
      `${label} declares ${ask.length} \`ask\` rule(s): ${JSON.stringify(ask)}\n` +
      `      An \`ask\` rule is an interactive prompt by definition. Warwick's ruling is that\n` +
      `      authorised work must not raise one. If something here is genuinely unsafe, DENY it\n` +
      `      (a deterministic refusal) rather than ASK (a modal on his phone).`
    );
  }
}

// ---------------------------------------------------------------------------
// 2. The project must carry a committed allow list covering routine work.
// ---------------------------------------------------------------------------
if (project.__missing) {
  problems.push(
    `${PROJECT} does not exist. The durable permission source is gone; a fresh clone would\n` +
    `      fall back to prompting for everything.`
  );
} else {
  const allow = project?.permissions?.allow;
  if (!Array.isArray(allow) || allow.length === 0) {
    problems.push(`project settings.json has no permissions.allow list.`);
  } else {
    // A rule "Bash(git status:*)" covers the probe "Bash(git status)".
    const prefixes = allow.map((r) => r.replace(/:\*\)$/, ')').replace(/ \*\)$/, ')'));
    for (const probe of MUST_NOT_PROMPT) {
      if (!prefixes.includes(probe)) {
        problems.push(`routine work would prompt: no committed allow rule covers ${probe}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 3. The safety floor must still deny. Authorisation is not the same as safety, and a
//    configuration that prompts for nothing AND refuses nothing is not the goal.
// ---------------------------------------------------------------------------
const allDeny = [
  ...(Array.isArray(managed?.permissions?.deny) ? managed.permissions.deny : []),
  ...(Array.isArray(project?.permissions?.deny) ? project.permissions.deny : []),
];
for (const destructive of MUST_STAY_DENIED) {
  const covered = allDeny.some((rule) => rule.includes(destructive));
  if (!covered) {
    problems.push(
      `SAFETY FLOOR BREACHED: nothing denies "${destructive}".\n` +
      `      Removing duplicate human approval must never mean removing the deterministic refusal.`
    );
  }
}

// ---------------------------------------------------------------------------
// 4. settings.local.json must not be the thing carrying the estate. It is gitignored, so
//    anything only living there is invisible to a fresh clone and to every worker.
// ---------------------------------------------------------------------------
const LOCAL = 'C:/Fusion247PKA/.claude/settings.local.json';
if (existsSync(LOCAL) && !project.__missing) {
  try {
    const local = JSON.parse(readFileSync(LOCAL, 'utf8'));
    const localAllow = local?.permissions?.allow ?? [];
    const oneOffs = localAllow.filter((r) => !r.includes('*')).length;
    if (oneOffs > 0) {
      console.log(
        `note: settings.local.json still holds ${oneOffs} exact one-off allow literal(s) of ` +
        `${localAllow.length}. Harmless, but they are "Allow once" residue and are gitignored - ` +
        `they protect nobody but this machine. The committed list is what carries the estate.`
      );
    }
  } catch { /* a broken local file is not this invariant's business */ }
}

// ---------------------------------------------------------------------------
if (problems.length > 0) {
  console.error('PERMISSION INVARIANT: BROKEN\n');
  problems.forEach((p, i) => console.error(`  ${i + 1}. ${p}\n`));
  console.error(
    'A fresh Larry in this estate would be stopped by a modal, or a destructive action would\n' +
    'no longer be refused. Fix the configuration - not this check.'
  );
  process.exit(1);
}

console.log(
  `PERMISSION INVARIANT: HOLDS\n` +
  `  - no \`ask\` rule in any source covers routine work\n` +
  `  - ${MUST_NOT_PROMPT.length} routine operations are covered by the COMMITTED allow list\n` +
  `  - ${MUST_STAY_DENIED.length} destructive operations remain DENIED (deterministic refusal, not a prompt)`
);
