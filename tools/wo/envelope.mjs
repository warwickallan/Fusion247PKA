#!/usr/bin/env node
// tools/wo/envelope.mjs — the Work Order envelope GENERATOR.
//
// Warwick, 2026-08-05, and this sentence is the specification:
//   "Standing authority defaults and specialist constraints are copied verbatim from their
//    canonical source, never redrafted from memory or narrative context. Any proposed
//    deviation is a Warwick escalation, not a drafting choice."
//
// WHAT THIS IS: a producer of envelope field text. Larry runs it BEFORE drafting an order.
// WHAT THIS IS NOT: a checker. It never reads a Work Order, never scores one, has no verdict
// vocabulary, and its exit code carries no judgement about any order (WO-17 Amendment 1 F-3).
//
// THE ANTI-FABRICATION PROPERTY — the load-bearing half:
//   When a field cannot be established from canonical source, this emits
//   `UNRESOLVED — <file>:<section> must be read` and the envelope is INCOMPLETE.
//   It NEVER emits a plausible value. A generator that guesses is worse than a human
//   guessing, because it launders the guess as machinery.
//
// THE TEETH (WO-17 Amendment 1 F-6 / M-2): there is no new mechanism. `UNRESOLVED` reaches
// the worker literally, inside the issued order, and the worker REFUSEs on sight at the
// existing SOP-022 read-back gate.
//
// Zero runtime dependencies. node: builtins only — and deliberately SELF-CONTAINED with no
// relative imports, so the test suite can load mutated copies via a data: URL and write
// nothing outside the declared file surface.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

// ---------------------------------------------------------------------------
// The two strings. A CONCLUSION and an UNKNOWN never share one (Amendment 1 F-5).
// ---------------------------------------------------------------------------

export const UNRESOLVED_PREFIX = 'UNRESOLVED — ';
export const UNRESOLVED_SUFFIX = ' must be read';

/** An UNKNOWN. The generator could not establish the field from canonical source. */
export function unresolved(file, section) {
  return `${UNRESOLVED_PREFIX}${file}:${section}${UNRESOLVED_SUFFIX}`;
}

export function isUnresolved(value) {
  return typeof value === 'string' && value.startsWith(UNRESOLVED_PREFIX);
}

/** A CONCLUSION. The standing default determines the value; silence is not ignorance. */
export const GIT_SILENT = 'none — contract silent, deny-by-default';

// ---------------------------------------------------------------------------
// Canonical sources. Named once, here, so a reader can audit where every field comes from.
// ---------------------------------------------------------------------------

export const SOURCES = {
  shim: (slug) => `.claude/agents/${slug}.md`,
  contract: (folder) => `Team/${folder}/AGENTS.md`,
  template: 'Team Knowledge/Templates/work-order.md',
  notDeliveredRecord: '.claude/agents/keel.md',
};

// Heading anchors, in preference order. Extraction is VERBATIM text under a matched heading;
// an absent anchor degrades to UNRESOLVED, which is the safe direction (Amendment 1 F-6/M-4).
export const ANCHORS = {
  permitted: ['Where {Name} writes', 'What you write, where, and how'],
  prohibited: ['Scope boundaries', 'What {Name} never does', 'What you never do'],
  criticalRules: ['Critical rules'],
  gitAuthority: ['The integration role'],
};

// Tokens whose presence means the contract SAYS SOMETHING about git. Absence of all of them
// is what makes "contract silent" a determinate conclusion rather than a guess.
export const GIT_TOKENS = ['git', 'push', 'commit', 'branch', 'worktree', 'merge'];

// Tool -> the capability an acceptance property may rely on. Field 7 emits a CONSTRAINT LINE
// from this map. No refuse verb, no verdict, no exit code (Amendment 1 F-3).
export const CAPABILITY_MAP = {
  Bash: 'command execution',
  Write: 'file authorship',
  Edit: 'file modification',
  WebFetch: 'network fetch',
  WebSearch: 'network search',
};

// The authority fields whose standing defaults are copied verbatim out of the canonical
// Work Order template rather than restated here. Restating them here would be exactly the
// "redrafted from memory" that Warwick's sentence forbids.
export const STANDING_DEFAULT_FIELDS = [
  'credential_scope',
  'live_authority',
  'network',
  'dependency_policy',
  'private_surface',
];

// ---------------------------------------------------------------------------
// Small mechanical helpers. No judgement anywhere in this file.
// ---------------------------------------------------------------------------

// Line endings are normalised to LF on read, and every comparison in this file and its test
// happens on the normalised text. This is not cosmetic: the contracts sit in the worktree as
// CRLF while their blobs are LF, and that mismatch has bitten this build three times — most
// recently WO-16 E-1, where the direction was stated backwards in an order. "Verbatim" here
// therefore means byte-verbatim MODULO line-ending normalisation, and it is said out loud
// rather than assumed.
function readIfPresent(root, rel) {
  const abs = join(root, rel);
  if (!existsSync(abs)) return null;
  try {
    return readFileSync(abs, 'utf8').replace(/\r\n/g, '\n');
  } catch {
    return null;
  }
}

/** Extract the frontmatter block (between the first two `---` fences) verbatim. */
export function frontmatter(text) {
  if (typeof text !== 'string') return null;
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  return m ? m[1] : null;
}

/**
 * Verbatim text under the first heading matching one of `anchors`, up to the next heading of
 * the same or shallower depth. Returns null when no anchor matches — the caller emits
 * UNRESOLVED, it never invents a section.
 */
export function sectionUnder(text, anchors) {
  if (typeof text !== 'string') return null;
  const lines = text.split(/\r?\n/);
  for (const anchor of anchors) {
    const needle = anchor.toLowerCase();
    for (let i = 0; i < lines.length; i++) {
      const h = lines[i].match(/^(#{2,4})\s+(.*)$/);
      if (!h) continue;
      if (!h[2].toLowerCase().startsWith(needle)) continue;
      const depth = h[1].length;
      const body = [];
      for (let j = i + 1; j < lines.length; j++) {
        const nh = lines[j].match(/^(#{1,6})\s+/);
        if (nh && nh[1].length <= depth) break;
        body.push(lines[j]);
      }
      return { anchor, heading: h[2], body: body.join('\n').trim() };
    }
  }
  return null;
}

/** Map a specialist slug to its `Team/<folder>/` directory. Ambiguity is UNRESOLVED. */
export function contractFolder(root, slug) {
  const dir = join(root, 'Team');
  if (!existsSync(dir)) return { error: 'Team directory not found' };
  const prefix = `${slug.toLowerCase()} - `;
  const hits = readdirSync(dir).filter(
    (d) => d.toLowerCase().startsWith(prefix) && statSync(join(dir, d)).isDirectory(),
  );
  if (hits.length === 1) return { folder: hits[0] };
  return { error: hits.length === 0 ? 'no matching Team folder' : 'ambiguous Team folder' };
}

// ---------------------------------------------------------------------------
// FIELD 1 — tool grant, and the recorded not-delivered annotation.
//
// The shim `tools:` line is machine-readable, so the grant itself is copied verbatim.
// But VERBATIM and TRUE come apart here: six shims declare a tool that this host is
// recorded as never delivering. Copying that verbatim would launder a known falsehood
// through machinery — the one door the anti-fabrication property does not guard, because
// the property stops guesses, not faithfully-copied falsehoods.
//
// Ruling (WO-17 Amendment 1 F-4): verbatim PLUS the recorded annotation, the annotation
// itself COPIED from canonical source rather than composed.
// ---------------------------------------------------------------------------

export function toolGrant(root, slug) {
  const rel = SOURCES.shim(slug);
  const text = readIfPresent(root, rel);
  if (text === null) return { value: unresolved(rel, 'frontmatter tools:'), source: rel };
  const fm = frontmatter(text);
  if (fm === null) return { value: unresolved(rel, 'frontmatter tools:'), source: rel };
  const line = fm.split(/\r?\n/).find((l) => /^tools:\s*/.test(l));
  if (!line) return { value: unresolved(rel, 'frontmatter tools:'), source: rel };
  const raw = line.replace(/^tools:\s*/, '').trim();
  if (raw === '') return { value: unresolved(rel, 'frontmatter tools:'), source: rel };
  return {
    value: raw,
    tools: raw.split(',').map((t) => t.trim()).filter(Boolean),
    source: `${rel}:tools`,
  };
}

/**
 * The recorded not-delivered fact, matched out of the canonical record's own prose rather
 * than restated. When the recorded pattern cannot be found, this is an UNKNOWN, not a
 * silent "nothing to annotate" — a control that quietly stops firing is worse than none.
 */
export function notDeliveredRecord(root) {
  const rel = SOURCES.notDeliveredRecord;
  const text = readIfPresent(root, rel);
  const fm = text === null ? null : frontmatter(text);
  if (fm === null) return { error: unresolved(rel, 'frontmatter comment') };
  const comment = fm
    .split(/\r?\n/)
    .filter((l) => /^\s*#/.test(l))
    .map((l) => l.replace(/^\s*#\s?/, ''))
    .join(' ');
  const m = comment.match(/\b([A-Za-z][A-Za-z0-9_]*) is listed by\b[\s\S]*?\bbut is\s+NOT delivered\b/);
  if (!m) return { error: unresolved(rel, 'frontmatter comment') };
  return { tool: m[1], sentence: m[0].replace(/\s+/g, ' ').trim(), source: `${rel}:frontmatter comment` };
}

export function notDeliveredAnnotation(root, tools) {
  const rec = notDeliveredRecord(root);
  if (rec.error) return { value: rec.error, source: SOURCES.notDeliveredRecord };
  if (!Array.isArray(tools)) return { value: rec.error ?? unresolved(SOURCES.shim('<owner>'), 'frontmatter tools:'), source: rec.source };
  if (!tools.includes(rec.tool)) {
    return { value: `n/a — this grant declares no recorded not-delivered tool`, source: rec.source };
  }
  return { value: `⚠️ ${rec.sentence}`, tool: rec.tool, source: rec.source };
}

// ---------------------------------------------------------------------------
// FIELD 2 — permitted and prohibited file surfaces. Heading-anchored VERBATIM extraction.
// This is copying, not judgement, and it fails in the safe direction: a contract that
// carries no matching anchor yields UNRESOLVED naming the anchors that were looked for.
// ---------------------------------------------------------------------------

export function surfaces(root, slug) {
  const found = contractFolder(root, slug);
  if (found.error) {
    return {
      permitted: unresolved(`Team/<${slug}>/AGENTS.md`, found.error),
      prohibited: unresolved(`Team/<${slug}>/AGENTS.md`, found.error),
      criticalRules: unresolved(`Team/<${slug}>/AGENTS.md`, found.error),
      source: null,
    };
  }
  const rel = SOURCES.contract(found.folder);
  const text = readIfPresent(root, rel);
  const Name = slug.charAt(0).toUpperCase() + slug.slice(1);
  const expand = (list) => list.map((a) => a.replace('{Name}', Name));
  const pick = (key) => {
    const anchors = expand(ANCHORS[key]);
    const hit = text === null ? null : sectionUnder(text, anchors);
    if (!hit) return unresolved(rel, anchors.join(' | '));
    return hit.body === '' ? unresolved(rel, hit.heading) : hit.body;
  };
  return {
    permitted: pick('permitted'),
    prohibited: pick('prohibited'),
    criticalRules: pick('criticalRules'),
    source: rel,
    folder: found.folder,
  };
}

// ---------------------------------------------------------------------------
// FIELDS 3 & 4 — private/credential surface and live authority.
//
// These are NOT hardcoded here. They are copied verbatim out of the canonical Work Order
// template's own authority block, so that if Warwick changes a standing default the
// generator follows it without anyone remembering to. Hardcoding them in this file would
// be the "redrafted from memory" his sentence forbids, one level down.
// ---------------------------------------------------------------------------

export function standingDefaults(root) {
  const rel = SOURCES.template;
  const text = readIfPresent(root, rel);
  const out = { source: `${rel}:authority defaults` };
  for (const field of STANDING_DEFAULT_FIELDS) {
    if (text === null) {
      out[field] = unresolved(rel, `${field} standing default`);
      continue;
    }
    const m = text.match(new RegExp(`^${field}:\\s*(\\S+)`, 'm'));
    out[field] = m ? m[1] : unresolved(rel, `${field} standing default`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// FIELD 5 — git authority. THREE states, and the middle one is why WO-15's defect happened:
//   (a) contract says nothing about git at all  -> CONCLUSION: the standing default resolves it
//   (b) contract carries the anchored section   -> verbatim copy
//   (c) git prose present, no anchor to copy    -> UNKNOWN: UNRESOLVED
// Nolan's silence on git was a real class-A defect. Silence now RESOLVES rather than
// inviting an inference.
// ---------------------------------------------------------------------------

export function gitAuthority(root, slug) {
  const found = contractFolder(root, slug);
  if (found.error) return { value: unresolved(`Team/<${slug}>/AGENTS.md`, found.error), state: 'unresolved' };
  const rel = SOURCES.contract(found.folder);
  const text = readIfPresent(root, rel);
  if (text === null) return { value: unresolved(rel, 'git authority'), state: 'unresolved' };

  const hit = sectionUnder(text, ANCHORS.gitAuthority);
  if (hit && hit.body !== '') return { value: hit.body, state: 'granted', source: `${rel}:${hit.heading}` };

  const lower = text.toLowerCase();
  const mentions = GIT_TOKENS.filter((t) => new RegExp(`\\b${t}\\b`).test(lower));
  if (mentions.length === 0) return { value: GIT_SILENT, state: 'silent', source: rel };

  return {
    value: unresolved(rel, ANCHORS.gitAuthority.join(' | ')),
    state: 'unresolved',
    mentions,
    source: rel,
  };
}

// ---------------------------------------------------------------------------
// FIELD 6 — worktree and executable path. Larry supplies it; this verifies it.
// Judging an INPUT at generation time is inside the line; inspecting a FINISHED ORDER is
// outside it (Amendment 1 F-3). Every outcome here is a determinate fact, never a verdict.
// ---------------------------------------------------------------------------

export function worktreeCheck(worktree, governanceHead) {
  if (!worktree) return { value: 'n/a — no worktree supplied', state: 'absent-input' };
  if (!existsSync(worktree)) return { value: `ABSENT — ${worktree} does not exist`, state: 'absent' };
  let head;
  try {
    head = execFileSync('git', ['-C', worktree, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return { value: unresolved(worktree, 'git rev-parse HEAD'), state: 'unresolved' };
  }
  if (!governanceHead) {
    return { value: `${worktree} — HEAD ${head}; no governance head supplied`, state: 'no-head', head };
  }
  const match = head === governanceHead;
  return {
    value: match
      ? `${worktree} — exists, HEAD ${head} == governance head`
      : `MISMATCH — ${worktree} HEAD is ${head}, governance head is ${governanceHead}`,
    state: match ? 'match' : 'mismatch',
    head,
  };
}

// ---------------------------------------------------------------------------
// FIELD 7 — evidence the worker can actually produce. Derived from the tool grant.
// Emits a CONSTRAINT LINE. No refuse verb, no exit-code verdict, no report output.
//
// Direction matters and is why this is safe: the shims are recorded as OVER-claiming, never
// under-claiming, so the ABSENCE of a tool is trustworthy while its presence may not be.
// This field uses only the absence direction.
// ---------------------------------------------------------------------------

export function producibleEvidence(toolsOrUnresolved) {
  if (!Array.isArray(toolsOrUnresolved)) {
    return { value: unresolved(SOURCES.shim('<owner>'), 'frontmatter tools:'), lines: [] };
  }
  const lines = [];
  for (const [tool, capability] of Object.entries(CAPABILITY_MAP)) {
    lines.push(
      toolsOrUnresolved.includes(tool)
        ? `${capability}: available (tools: includes ${tool})`
        : `${capability}: NOT available (tools: has no ${tool})`,
    );
  }
  const constraint = toolsOrUnresolved.includes('Bash')
    ? 'acceptance evidence MAY require an executed command'
    : 'acceptance evidence must NOT require an executed command';
  return { value: `${constraint} · ${lines.join(' · ')}`, lines, constraint };
}

// ---------------------------------------------------------------------------
// The envelope.
// ---------------------------------------------------------------------------

export function resolveEnvelope({ root, owner, governanceHead, worktree }) {
  const grant = toolGrant(root, owner);
  const annotation = notDeliveredAnnotation(root, grant.tools);
  const surf = surfaces(root, owner);
  const defaults = standingDefaults(root);
  const git = gitAuthority(root, owner);
  const tree = worktreeCheck(worktree, governanceHead);
  const evidence = producibleEvidence(grant.tools);

  const fields = [
    { key: 'owner', value: owner, source: 'supplied' },
    { key: 'governance_head', value: governanceHead ?? unresolved('dispatch', 'governance_head'), source: 'supplied' },
    { key: 'tool_grant', value: grant.value, source: grant.source },
    { key: 'tool_grant_not_delivered', value: annotation.value, source: annotation.source },
    { key: 'permitted_file_surface', value: surf.permitted, source: surf.source },
    { key: 'prohibited_file_surface', value: surf.prohibited, source: surf.source },
    { key: 'critical_rules', value: surf.criticalRules, source: surf.source },
    ...STANDING_DEFAULT_FIELDS.map((f) => ({ key: f, value: defaults[f], source: defaults.source })),
    { key: 'git_authority', value: git.value, source: git.source ?? null },
    { key: 'worktree', value: tree.value, source: 'supplied + verified' },
    { key: 'producible_evidence', value: evidence.value, source: 'derived from tool_grant' },
  ];

  return { owner, governanceHead, worktree, fields, unresolvedCount: fields.filter((f) => isUnresolved(f.value)).length };
}

// ---------------------------------------------------------------------------
// Rendering. Markdown envelope rows on stdout; writes no files.
// ---------------------------------------------------------------------------

function cell(value) {
  return String(value).replace(/\r?\n/g, '<br>').replace(/\|/g, '\\|');
}

export function render(envelope) {
  const out = [];
  out.push(`<!-- generated by tools/wo/envelope.mjs — fields copied from canonical source, never drafted -->`);
  out.push('| Field | Value | Source |');
  out.push('|---|---|---|');
  for (const f of envelope.fields) {
    out.push(`| **${f.key}** | ${cell(f.value)} | ${f.source ? `\`${f.source}\`` : '—'} |`);
  }
  out.push('');
  if (envelope.unresolvedCount > 0) {
    out.push(
      `<!-- ${envelope.unresolvedCount} field(s) UNRESOLVED. This envelope is INCOMPLETE. ` +
        `Read the named sections and fill them, or issue it as-is and the worker REFUSEs on sight. -->`,
    );
  }
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// CLI.
// ---------------------------------------------------------------------------

export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

const USAGE = `usage: node tools/wo/envelope.mjs --owner <slug> --governance-head <sha> [--worktree <path>] [--root <repo>]

Produces Work Order envelope rows on stdout, every field copied from canonical source.
Writes no files. Its exit code is NOT a verdict about any Work Order.`;

function main(argv) {
  const args = parseArgs(argv);
  if (args.help || !args.owner) {
    process.stderr.write(`${USAGE}\n`);
    return 2;
  }
  const root = typeof args.root === 'string' ? args.root : process.cwd();
  const envelope = resolveEnvelope({
    root,
    owner: String(args.owner),
    governanceHead: typeof args['governance-head'] === 'string' ? args['governance-head'] : null,
    worktree: typeof args.worktree === 'string' ? args.worktree : null,
  });
  process.stdout.write(`${render(envelope)}\n`);
  return 0;
}

const invokedDirectly =
  process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/wo/envelope.mjs');
if (invokedDirectly) process.exit(main(process.argv.slice(2)));
