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

import { readFileSync, readdirSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

// ---------------------------------------------------------------------------
// The THREE strings. A CONCLUSION, an UNKNOWN and a THING-LARRY-MUST-WRITE never share one.
//
// Amendment 1 F-5 established the first two. WO-18 adds the third, for exactly the reason
// F-5 gave for the first pair: an authoring slot is NOT an unknown. `outcome` is blank
// because only Larry can write it, not because the generator failed to establish it.
// Collapsing them would make an incomplete-because-unread order indistinguishable from an
// incomplete-because-unauthored one, and those are different defects with different fixes.
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

/** A SLOT. Larry authors it; no canonical source can supply it and none was consulted. */
export const AUTHOR_REQUIRED_PREFIX = 'AUTHOR REQUIRED — ';

export function authorRequired(field, hint) {
  return `${AUTHOR_REQUIRED_PREFIX}${field}: ${hint}`;
}

/** The same marker for a line that already carries its own key, so the key is not doubled. */
export function authorRequiredHint(hint) {
  return `${AUTHOR_REQUIRED_PREFIX}${hint}`;
}

export function isAuthorRequired(value) {
  return typeof value === 'string' && value.startsWith(AUTHOR_REQUIRED_PREFIX);
}

// ---------------------------------------------------------------------------
// Provenance. The git blob SHA of the exact bytes read, computed here rather than shelled out
// to `git hash-object`, so it works where there is no repository and needs no dependency.
// sha1 is used because it is git's blob identity function — nothing here is a security control.
// ---------------------------------------------------------------------------

export function blobSha(bytes) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(String(bytes ?? ''), 'utf8');
  return createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
}

/**
 * The blob SHA of a canonical source — of its LINE-ENDING-NORMALISED content.
 *
 * The CRLF trap, hit for the fourth time in this build and caught here only by an executed
 * test. Hashing the raw on-disk bytes produces a SHA that is true about this checkout and
 * USELESS to a reader: on a CRLF working tree it resolves to no object, so `git cat-file -p`
 * on the recorded SHA returns nothing. Normalising first makes the recorded SHA both (a) the
 * blob git actually stores and (b) the exact bytes this generator parsed, because
 * readIfPresent normalises too. Provenance nobody can check is decoration.
 */
export function sourceSha(root, rel) {
  const abs = join(root, rel);
  if (!existsSync(abs)) return null;
  try {
    return blobSha(Buffer.from(readFileSync(abs, 'utf8').replace(/\r\n/g, '\n'), 'utf8'));
  } catch {
    return null;
  }
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
  // Headings are captured alongside the body so a CITATION can name the exact section
  // (WO-18 S-2 and S-5). The body extraction itself is unchanged and still verbatim.
  const headings = {};
  const pick = (key) => {
    const anchors = expand(ANCHORS[key]);
    const hit = text === null ? null : sectionUnder(text, anchors);
    if (!hit) return unresolved(rel, anchors.join(' | '));
    headings[key] = hit.heading;
    return hit.body === '' ? unresolved(rel, hit.heading) : hit.body;
  };
  return {
    permitted: pick('permitted'),
    prohibited: pick('prohibited'),
    criticalRules: pick('criticalRules'),
    headings,
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
  // Tests may set WO_TEST_GIT_CWD to a temp fixture so git archive exports never need a .git
  // inside the extracted tree. Production leaves WO_TEST_GIT_CWD unset → use the worktree.
  const cwd = gitCwd(worktree);
  let head;
  try {
    head = execFileSync('git', ['-C', cwd, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return { value: unresolved(worktree, 'git rev-parse HEAD'), state: 'unresolved' };
  }
  if (!governanceHead) {
    return { value: `${worktree} — HEAD ${head}; no governance head supplied`, state: 'no-head', head };
  }
  if (head === governanceHead) {
    return { value: `${worktree} — exists, HEAD ${head} == governance head`, state: 'match', head, relation: 'equal' };
  }
  // ANCESTOR-OR-EQUAL, not equality (WO-18 S-4, amended). Equality was WRONG and the order
  // that commissioned this fix is the proof: J1-4 resolves with TWO commits — A carries the
  // governing contracts and is the declared governance head, B carries the Work Order and
  // descends from A. The worker cuts from B. Under the old rule that correct, mandated layout
  // rendered `MISMATCH`, i.e. the check fired on the honest case, which is how checks die.
  let descends = false;
  try {
    execFileSync('git', ['-C', cwd, 'merge-base', '--is-ancestor', governanceHead, 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    descends = true;
  } catch {
    descends = false;
  }
  if (descends) {
    return {
      value: `${worktree} — exists, HEAD ${head} DESCENDS FROM governance head ${governanceHead}`,
      state: 'match',
      head,
      relation: 'descendant',
    };
  }
  // Distinguish the two ways this fails, because they need different fixes: an unknown object
  // means the head is wrong or unfetched; a known object that is not an ancestor means the
  // worktree was cut from the wrong place.
  let known = false;
  try {
    execFileSync('git', ['-C', cwd, 'rev-parse', '--verify', `${governanceHead}^{commit}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    known = true;
  } catch {
    known = false;
  }
  return {
    value: known
      ? `MISMATCH — ${worktree} HEAD is ${head}, which does NOT descend from governance head ${governanceHead}`
      : `MISMATCH — governance head ${governanceHead} is not a commit in ${worktree}; HEAD is ${head}`,
    state: 'mismatch',
    head,
    relation: known ? 'unrelated' : 'unknown-object',
  };
}

// ---------------------------------------------------------------------------
// S-4 — the governance head must EXIST before anything is emitted.
//
// This is the one place in this file that stops the world. Everywhere else an unknown
// degrades to UNRESOLVED and the order is issued visibly incomplete; here it does not,
// because an order naming a head that does not exist cannot be read by the worker it governs
// at the head it declares, and no amount of marking inside the file repairs that.
//
// There is NO bypass flag. A check that can be skipped is not a check (M-3 ruling).
// ---------------------------------------------------------------------------

export const HEAD_FAILURE = {
  MISSING: 'no governance head was supplied',
  NO_GIT: 'the root is not a git repository, or git could not be run — the head cannot be verified',
  UNKNOWN: 'is not a commit in this repository',
};

/**
 * Git cwd for verification.
 * Tests may set WO_TEST_GIT_CWD + WO_TEST_GIT_ALLOW_REDIRECT=1 so a git-archive extract
 * (no .git) can still verify heads without `git init` inside the tree. Production leaves
 * both unset. When root already has .git, never redirect.
 */
function gitCwd(root) {
  if (process.env.WO_TEST_GIT_ALLOW_REDIRECT === '1' && process.env.WO_TEST_GIT_CWD) {
    try {
      execFileSync('git', ['-C', root, 'rev-parse', '--git-dir'], {
        encoding: 'utf8',
        stdio: ['ignore', 'ignore', 'ignore'],
      });
      return root;
    } catch {
      return process.env.WO_TEST_GIT_CWD;
    }
  }
  return root;
}

export function verifyGovernanceHead(root, governanceHead) {
  if (typeof governanceHead !== 'string' || governanceHead.trim() === '') {
    return { ok: false, reason: HEAD_FAILURE.MISSING };
  }
  const sha = governanceHead.trim();
  const cwd = gitCwd(root);
  try {
    execFileSync('git', ['-C', cwd, 'rev-parse', '--git-dir'], {
      encoding: 'utf8',
      stdio: ['ignore', 'ignore', 'ignore'],
    });
  } catch {
    return { ok: false, reason: HEAD_FAILURE.NO_GIT, head: sha };
  }
  try {
    const resolved = execFileSync('git', ['-C', cwd, 'rev-parse', '--verify', `${sha}^{commit}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return { ok: true, head: sha, resolved };
  } catch {
    return { ok: false, reason: `${sha} ${HEAD_FAILURE.UNKNOWN}`, head: sha };
  }
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
  // G-4 — this field describes the WORKER'S TOOL GRANT, never product/deliverable authority.
  // A deliverable that is an outbound POST is not forbidden by "network fetch: NOT available";
  // that line only constrains what the worker can personally execute as evidence.
  return {
    value: `WORKER TOOL GRANT (not product authority) — ${constraint} · ${lines.join(' · ')}`,
    lines,
    constraint,
  };
}

// ---------------------------------------------------------------------------
// S-2 — `contract_basis` BY EXTRACTION.
//
// The most-repeated envelope defect in the replay corpus: drafted wrongly in WO-15 (D-1) and
// again in WO-17 (R-40), two of the last three orders. It is also the field the generator can
// replace outright, because permitted surfaces and their governing headings are exactly what
// it already extracts verbatim.
//
// Two halves, and they resolve differently:
//   SURFACES — mechanical. Path patterns are lifted out of the permitted-surface section and
//     glob-matched against the declared entry. A match cites the exact heading and the exact
//     pattern it matched. No match is UNRESOLVED.
//   ACTIONS  — keyword overlap against the ANCHORED sections only (M-2 ruling: no action→clause
//     table, because that is a registry). The winning section must be unique and must clear a
//     stated threshold; anything else is UNRESOLVED. Every citation carries the keywords it
//     rests on, so the basis is auditable rather than merely plausible.
// ---------------------------------------------------------------------------

/** Path-shaped patterns, lifted from backticked spans in a contract section. */
export function surfacePatterns(sectionBody) {
  if (typeof sectionBody !== 'string') return [];
  const out = [];
  for (const m of sectionBody.matchAll(/`([^`\n]+)`/g)) {
    const token = m[1].trim();
    if (/\s/.test(token)) continue;
    if (!/[/*]/.test(token)) continue;
    if (token.startsWith('[[')) continue;
    if (!out.includes(token)) out.push(token);
  }
  return out;
}

/**
 * Glob → anchored RegExp. `**` crosses directory separators, `*` does not, and `<placeholder>`
 * matches one path segment. Everything else is escaped: a pattern is data, never a regex.
 */
export function globToRegExp(pattern) {
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        out += '.*';
        i++;
      } else {
        out += '[^/]*';
      }
    } else if (c === '<') {
      const close = pattern.indexOf('>', i);
      if (close === -1) {
        out += '\\<';
      } else {
        out += '[^/]+';
        i = close;
      }
    } else if ('\\^$.|?+()[]{}'.includes(c)) {
      out += `\\${c}`;
    } else {
      out += c;
    }
  }
  return new RegExp(`^${out}$`);
}

const slashes = (p) => String(p).replace(/\\/g, '/').replace(/^\.\//, '');

export function matchesPattern(entry, pattern) {
  const e = slashes(entry);
  const p = slashes(pattern);
  if (globToRegExp(p).test(e)) return true;
  // A directory pattern covers what is under it: `tools/**` permits `tools/wo/envelope.mjs`,
  // and so does the bare directory form `tools/`.
  if (p.endsWith('/')) return e.startsWith(p);
  return false;
}

/** One `contract_basis` entry for one declared `file_surface` path. */
export function permittingClause(root, owner, surfaceEntry) {
  const surf = surfaces(root, owner);
  if (isUnresolved(surf.permitted)) {
    return { surface: surfaceEntry, permitted_by: surf.permitted, state: 'unresolved' };
  }
  const rel = surf.source;
  const heading = surf.headings.permitted;
  const patterns = surfacePatterns(surf.permitted);
  const hit = patterns.find((p) => matchesPattern(surfaceEntry, p));
  if (!hit) {
    return {
      surface: surfaceEntry,
      permitted_by: unresolved(rel, `§ ${heading} — no declared pattern matches ${surfaceEntry}`),
      state: 'unresolved',
      patterns,
    };
  }
  return {
    surface: surfaceEntry,
    permitted_by: `${rel} § ${heading} — \`${hit}\``,
    state: 'granted',
    matched: hit,
  };
}

// Keyword matching constants. Held as named exports so the test pins them to literals rather
// than asking the source what its own threshold is.
export const ACTION_MIN_KEYWORD_LENGTH = 4;
export const ACTION_MIN_HITS = 2;
export const ACTION_STOPWORDS = [
  'this', 'that', 'with', 'from', 'into', 'over', 'under', 'they', 'them', 'then',
  'than', 'when', 'what', 'which', 'will', 'must', 'shall', 'have', 'been', 'were',
  'your', 'their', 'work', 'order', 'against', 'using', 'onto', 'also', 'each', 'every',
];

export function actionKeywords(actionText) {
  if (typeof actionText !== 'string') return [];
  const out = [];
  for (const raw of actionText.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < ACTION_MIN_KEYWORD_LENGTH) continue;
    if (ACTION_STOPWORDS.includes(raw)) continue;
    if (!out.includes(raw)) out.push(raw);
  }
  return out;
}

// ONLY a grant-bearing section may be cited as a permitting clause.
//
// This was found by executing the first implementation, and it is the sharpest lesson in this
// change: keyword overlap across ALL anchored sections cited `Critical rules` as PERMITTING
// "run a production migration against the live database" — a section whose rule 3 forbids
// exactly that. Overlap cannot distinguish "the contract mentions this" from "the contract
// permits this", because a contract uses the same nouns to grant and to forbid. A citation
// that names a prohibition as a permission is the fabrication mode this generator exists to
// prevent, laundered through machinery.
//
// The fix uses the anchor typing that already exists; it is not an action->clause table.
export const GRANT_BEARING_ANCHORS = ['permitted', 'gitAuthority'];
export const CONSTRAINT_BEARING_ANCHORS = ['prohibited', 'criticalRules'];

/**
 * One `contract_basis` entry for one declared non-file action.
 *
 * The winning section must (a) be GRANT-BEARING, (b) clear ACTION_MIN_HITS, and (c) be strictly
 * ahead of the runner-up. A tie is an UNKNOWN, not a coin toss — two sections matching equally
 * well is precisely the case where a citation would look convincing and be arbitrary.
 */
export function permittingClauseForAction(root, owner, actionText) {
  const found = contractFolder(root, owner);
  if (found.error) {
    return { action: actionText, permitted_by: unresolved(`Team/<${owner}>/AGENTS.md`, found.error), state: 'unresolved' };
  }
  const rel = SOURCES.contract(found.folder);
  const text = readIfPresent(root, rel);
  const Name = owner.charAt(0).toUpperCase() + owner.slice(1);
  const keywords = actionKeywords(actionText);
  const score = (key) => {
    const anchors = ANCHORS[key].map((a) => a.replace('{Name}', Name));
    const hit = text === null ? null : sectionUnder(text, anchors);
    if (!hit || hit.body === '') return null;
    const body = hit.body.toLowerCase();
    const matched = keywords.filter((k) => body.includes(k));
    return { key, heading: hit.heading, matched, score: matched.length };
  };
  const grants = GRANT_BEARING_ANCHORS.map(score).filter(Boolean).sort((a, b) => b.score - a.score);
  const constraints = CONSTRAINT_BEARING_ANCHORS.map(score).filter(Boolean).sort((a, b) => b.score - a.score);
  const best = grants[0];
  const runnerUp = grants[1];
  if (!best || best.score < ACTION_MIN_HITS || (runnerUp && runnerUp.score === best.score)) {
    const counts = grants.map((s) => `${s.heading}=${s.score}`).join(', ');
    // A constraint section scoring higher is a POINTER for the reader, never a citation and
    // never a verdict about the order: the action may still be permitted elsewhere.
    const louder = constraints.find((c) => c.score > (best?.score ?? 0));
    const note = louder ? `; the constraint section "${louder.heading}" scored higher (${louder.score}) — read it` : '';
    return {
      action: actionText,
      permitted_by: unresolved(
        rel,
        `no GRANT-BEARING section clears ${ACTION_MIN_HITS} unique keywords (${counts || 'no grant-bearing section found'})${note}`,
      ),
      state: 'unresolved',
      grants,
      constraints,
    };
  }
  return {
    action: actionText,
    permitted_by: `${rel} § ${best.heading} — matched on: ${best.matched.join(', ')}`,
    state: 'granted',
    grants,
    constraints,
  };
}

export function contractBasis(root, owner, { surfaces: surfaceEntries = [], actions = [] } = {}) {
  return [
    ...surfaceEntries.map((s) => permittingClause(root, owner, s)),
    ...actions.map((a) => permittingClauseForAction(root, owner, a)),
  ];
}

// ---------------------------------------------------------------------------
// S-3 support — one further template field, read the same way the standing defaults are.
//
// NOT folded into standingDefaults(): its loop body is a live mutation target (MUT-6), and a
// refactor there would delete the proof rather than the defect. The duplication is deliberate.
// ---------------------------------------------------------------------------

export function templateField(root, field) {
  const rel = SOURCES.template;
  const text = readIfPresent(root, rel);
  if (text === null) return { value: unresolved(rel, `${field} default`), source: rel };
  const m = text.match(new RegExp(`^${field}:\\s*(\\S+)`, 'm'));
  return m ? { value: m[1], source: `${rel}:${field}` } : { value: unresolved(rel, `${field} default`), source: rel };
}

// ---------------------------------------------------------------------------
// The envelope.
// ---------------------------------------------------------------------------

// S-5 — a CITATION in place of an inlined copy.
//
// The justification is the SSOT Golden Rule (root CLAUDE.md: every fact lives in exactly one
// file; everywhere else links), NOT a replay row. The replay corpus scores whether the
// generator prevents a defect; it contains no observation of a worker acting on an inlined
// copy, because no order was ever issued without one. That is stated plainly rather than
// dressed up as measurement.
//
// A citation carries MORE than the copy did: the exact heading, the blob SHA of the bytes
// cited, and the size of what was not inlined. Nothing is hidden by omission.
export function cite(root, rel, heading, body, label = 'CITED') {
  if (isUnresolved(body)) return body;
  const sha = sourceSha(root, rel);
  const chars = String(body).length.toLocaleString('en-US');
  const at = sha ? ` @ blob ${sha.slice(0, 12)}` : '';
  return `${label} — \`${rel}\` § ${heading}${at} (${chars} chars — read it there; not inlined, per the SSOT rule)`;
}

// G-7 — the envelope TABLE must print the OPERATIVE authority value, not the standing default,
// whenever the order deviates. It previously printed the template default unconditionally while
// the frontmatter carried the deviation, so a generated order contradicted itself on its own face
// for every deviating dispatch. That is not cosmetic: Keel's contract requires a worker to CLARIFY
// on exactly that disagreement and never act on the wider value, so the defect cost a live round
// trip on WO-2026-08-12-05 and would have cost another on -06 had it not been pre-answered in prose.
// `deviations` is optional so that the two callers that legitimately have none keep working.
export function resolveEnvelope({ root, owner, governanceHead, worktree, deviations = [] }) {
  const grant = toolGrant(root, owner);
  const annotation = notDeliveredAnnotation(root, grant.tools);
  const surf = surfaces(root, owner);
  const defaults = standingDefaults(root);
  const git = gitAuthority(root, owner);
  const tree = worktreeCheck(worktree, governanceHead);
  const evidence = producibleEvidence(grant.tools);
  const deviationMap = new Map((deviations ?? []).map((d) => [d.field, d]));

  // git_authority keeps its three-state VALUE and loses only its page. R-31 — a push
  // instruction issued to a specialist whose contract is silent on git — was prevented by the
  // STATE word, never by the 2,831 characters beneath it, so the prevention survives the cut.
  const gitValue = isUnresolved(git.value)
    ? git.value
    : git.state === 'silent'
      ? git.value
      : cite(root, surf.source ?? SOURCES.contract(surf.folder ?? ''), ANCHORS.gitAuthority[0], git.value, 'GRANTED');

  // G-2 — never lend `supplied + verified` to an absence. Provenance tracks the input state.
  const worktreeSource =
    tree.state === 'absent-input' ? 'absent-input'
      : tree.state === 'unresolved' ? 'verification-failed'
        : tree.state === 'absent' ? 'path-absent'
          : tree.state === 'no-head' ? 'supplied (no governance head to verify against)'
            : tree.state === 'match' ? 'supplied + verified'
              : tree.state === 'mismatch' ? 'supplied + verified (mismatch stated)'
                : 'supplied';

  // G-3 — both surfaces cited the same way (SSOT). Inlining one while citing the other was the defect.
  const fields = [
    { key: 'owner', value: owner, source: 'supplied' },
    { key: 'governance_head', value: governanceHead ?? unresolved('dispatch', 'governance_head'), source: 'supplied' },
    { key: 'tool_grant', value: grant.value, source: grant.source },
    { key: 'tool_grant_not_delivered', value: annotation.value, source: annotation.source },
    { key: 'permitted_file_surface', value: cite(root, surf.source, surf.headings?.permitted, surf.permitted), source: surf.source },
    { key: 'prohibited_file_surface', value: cite(root, surf.source, surf.headings?.prohibited, surf.prohibited), source: surf.source },
    { key: 'critical_rules', value: cite(root, surf.source, surf.headings?.criticalRules, surf.criticalRules), source: surf.source },
    // G-7 — operative value, never the bare default when the order deviates. The DEVIATED marker
    // and the superseded default are both stated, so the table remains a truthful summary of what
    // governs rather than a second, quieter answer that contradicts the frontmatter.
    ...STANDING_DEFAULT_FIELDS.map((f) => {
      const dev = deviationMap.get(f);
      if (!dev) return { key: f, value: defaults[f], source: defaults.source };
      return {
        key: f,
        value: `DEVIATED (operative) — ${dev.value}  ·  supersedes standing default \`${defaults[f]}\``,
        source: `order frontmatter (deviation) — ESCALATION: ${dev.authority ?? 'AUTHOR REQUIRED — deviation_authority'}`,
      };
    }),
    { key: 'git_authority', value: gitValue, source: git.source ?? null },
    { key: 'worktree', value: tree.value, source: worktreeSource },
    { key: 'producible_evidence', value: evidence.value, source: 'worker tool grant (not product authority)' },
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
// S-1 — the COMPLETE ORDER FILE.
//
// The tool stops producing rows for Larry to paste around and produces the order itself.
// Larry authors five things: outcome, scope, acceptance, evidence, sequencing. Everything
// else is copied, extracted, or visibly marked.
//
// J1-1 (closed outside this file): ordinary dispatch REQUIRES this generator's ORDER_MARKER.
// Workers REFUSE orders that lack it (SOP-022). The provenance header is evidence of origin —
// NOT a checker service. Generation is unavoidable because the dispatch route demands the
// marker; this tool does not police itself.
// ---------------------------------------------------------------------------

export const ORDER_MARKER = 'GENERATED by tools/wo/envelope.mjs';

function yamlBlock(label, lines) {
  return [`${label}:`, ...lines.map((l) => `  ${l}`)].join('\n');
}

export function provenanceHeader({ root, owner, governanceHead, headCheck, folder, generatedAt }) {
  const sources = [
    SOURCES.template,
    folder ? SOURCES.contract(folder) : `Team/<${owner}>/AGENTS.md`,
    SOURCES.shim(owner),
    SOURCES.notDeliveredRecord,
    'tools/wo/envelope.mjs',
  ].filter((v, i, a) => a.indexOf(v) === i);

  const rows = sources.map((rel) => {
    const sha = sourceSha(root, rel);
    return `      ${rel}  ->  blob ${sha ?? 'ABSENT — NOT READ'}`;
  });

  return [
    `<!-- ${ORDER_MARKER} — DO NOT HAND-AUTHOR THIS FILE.`,
    '',
    `     generated_at:    ${generatedAt}`,
    `     owner:           ${owner}`,
    `     governance_head: ${governanceHead}  (verified: ${headCheck.resolved ? 'commit exists' : 'UNVERIFIED'})`,
    '',
    '     canonical sources read, with the blob SHA of the exact bytes used:',
    ...rows,
    '',
    '     A field marked UNRESOLVED could not be established from canonical source: read the',
    '     named section and fill it, or issue as-is and the worker REFUSEs on sight.',
    '     A field marked AUTHOR REQUIRED is Larry\'s to write. It is NOT an unknown.',
    '',
    '     This header is EVIDENCE OF ORIGIN, not a control. Nothing verifies it automatically.',
    '-->',
  ].join('\n');
}

/**
 * Build a complete, ready-to-issue Work Order.
 *
 * Returns `{ ok: false, fatal }` and NO text when the governance head cannot be verified —
 * S-4/AC3. A partial order is not offered as a degraded result, because an order naming a
 * head that does not exist cannot be read by the worker it governs at the head it declares.
 */
/**
 * G-5 — count markers in an order body. Safe to re-run after Larry authors slots.
 * The generation-time trailer is a SNAPSHOT only; this is the live recomputation.
 */
export function countMarkers(text) {
  const s = String(text ?? '');
  return {
    authorCount: (s.match(/AUTHOR REQUIRED — /g) ?? []).length,
    unresolvedCount: (s.match(/UNRESOLVED — /g) ?? []).length,
  };
}

/** G-5 — snapshot footer. Explicitly not a live claim. */
export function issuabilitySnapshotFooter(authorCount, unresolvedCount) {
  return [
    '',
    `<!-- SNAPSHOT AT GENERATION (not a live claim): ${authorCount} AUTHOR REQUIRED, ${unresolvedCount} UNRESOLVED.`,
    '     Before issue, RECOMPUTE: node tools/wo/envelope.mjs --count-markers <file>',
    '     An order is unready while either recomputed count is above zero AFTER Larry authors slots.',
    '     Do not treat this footer as current once the file has been edited. -->',
  ].join('\n');
}

/**
 * G-6 — machine-install orders. Closed list of absolute machine paths; never matched against
 * repo contract patterns (that would fabricate a grant — MUT-10 class defect).
 */
export function isAbsoluteMachinePath(p) {
  if (typeof p !== 'string') return false;
  const s = p.trim();
  if (!s) return false;
  // Windows drive, UNC, or POSIX absolute. Reject relative and bare names.
  if (/^[A-Za-z]:[\\/]/.test(s)) return true;
  if (s.startsWith('\\\\') || s.startsWith('//')) return true;
  if (s.startsWith('/')) return true;
  return false;
}

export function validateMachineSurfaces(machineSurfaces, deviations = []) {
  const errors = [];
  if (!Array.isArray(machineSurfaces) || machineSurfaces.length === 0) {
    return { ok: true, errors };
  }
  for (const s of machineSurfaces) {
    if (!isAbsoluteMachinePath(s)) {
      errors.push(`machine_surface not absolute: ${JSON.stringify(s)}`);
    }
  }
  const liveDev = deviations.find((d) => d.field === 'live_authority');
  if (!liveDev || !liveDev.value || liveDev.value === 'none') {
    errors.push('machine_surface requires --deviate live_authority=<bounded value> (not none)');
  } else if (!liveDev.authority) {
    errors.push('machine_surface live_authority deviation requires --deviation-authority');
  }
  return { ok: errors.length === 0, errors };
}

export function machineSurfaceBasis(machineSurfaces) {
  return machineSurfaces.map((surface) => ({
    surface,
    permitted_by:
      'machine_surface — absolute machine path; NOT matched against repo contract patterns. '
      + 'Requires a live_authority deviation naming this exact surface. WP-3E / WO-20 shape.',
  }));
}

export function generateOrder({
  root,
  owner,
  governanceHead,
  worktree = null,
  branch = null,
  surfaces: surfaceEntries = [],
  machineSurfaces = [],
  actions = [],
  deviations = [],
  now = new Date(),
} = {}) {
  const headCheck = verifyGovernanceHead(root, governanceHead);
  if (!headCheck.ok) {
    return {
      ok: false,
      fatal: `governance head ${headCheck.reason}. NO ORDER EMITTED.`,
      reason: headCheck.reason,
    };
  }

  const machineCheck = validateMachineSurfaces(machineSurfaces, deviations);
  if (!machineCheck.ok) {
    return {
      ok: false,
      fatal: `machine_surface validation failed: ${machineCheck.errors.join('; ')}. NO ORDER EMITTED.`,
      reason: machineCheck.errors.join('; '),
    };
  }

  const generatedAt = now.toISOString();
  const found = contractFolder(root, owner);
  const folder = found.folder ?? null;
  const contractPath = folder ? SOURCES.contract(folder) : unresolved(`Team/<${owner}>/AGENTS.md`, found.error);
  const envelope = resolveEnvelope({ root, owner, governanceHead, worktree, deviations });
  const isMachineInstall = machineSurfaces.length > 0;
  // Repo surfaces still extract; machine surfaces use the dedicated basis (G-6).
  const repoBasis = surfaceEntries.length || actions.length
    ? contractBasis(root, owner, { surfaces: surfaceEntries, actions })
    : [];
  const basis = isMachineInstall
    ? [...machineSurfaceBasis(machineSurfaces), ...repoBasis]
    : repoBasis;
  const defaults = standingDefaults(root);
  const returnTo = templateField(root, 'return_to');
  const integrationOwner = templateField(root, 'integration_owner');
  const outOfScopePolicy = templateField(root, 'out_of_scope_policy');
  const tree = worktreeCheck(worktree, governanceHead);

  const deviated = new Map(deviations.map((d) => [d.field, d]));
  const authorityLines = [];
  for (const field of STANDING_DEFAULT_FIELDS) {
    const dev = deviated.get(field);
    if (!dev) {
      // G-1 — bare value on its own line; no prose glued to the scalar.
      authorityLines.push(`${field}: ${defaults[field]}`);
      continue;
    }
    // G-1 — value bare; deviation note is a sibling comment, never part of the field value.
    authorityLines.push(`${field}: ${dev.value}`);
    authorityLines.push(
      `# DEVIATION from standing default \`${defaults[field]}\`. `
      + `ESCALATION: ${dev.authority ?? authorRequired('deviation_authority', 'name who authorised this deviation, and when')}`,
    );
  }

  const basisLines = [];
  for (const b of basis) {
    if (b.surface !== undefined) basisLines.push(`- surface: ${b.surface}`);
    else basisLines.push(`- action: ${b.action}`);
    basisLines.push(`  permitted_by: "${String(b.permitted_by).replace(/"/g, '\\"')}"`);
  }
  if (basisLines.length === 0) {
    basisLines.push(
      `- ${authorRequired('contract_basis', 'declare --surface and/or --machine-surface and/or --action')}`,
    );
  }

  // G-6 — machine install uses machine_surface; file_surface may be empty list.
  const surfaceLines = surfaceEntries.length
    ? surfaceEntries.map((s) => `- ${s}`)
    : isMachineInstall
      ? []
      : [`- ${authorRequired('file_surface', 'COMPLETE writable REPO set — pure path data, never annotated')}`];

  const machineLines = machineSurfaces.map((s) => `- ${slashes(s)}`);

  const scanTargets = surfaceEntries.length
    ? [...new Set(surfaceEntries.map((s) => slashes(s).replace(/\/\*\*.*$/, '').replace(/\/[^/]*\*[^/]*$/, '')))].join(' ')
    : isMachineInstall
      ? '(machine_surface — secret-scan not applicable to absolute machine paths; report machine_surface list instead)'
      : '<declared paths>';

  // G-1 — AUTHOR REQUIRED bare marker on the value line; guidance only in sibling comments.
  const body = [
    provenanceHeader({ root, owner, governanceHead, headCheck, folder, generatedAt }),
    '---',
    '# --- identity and authority ---',
    `name: ${AUTHOR_REQUIRED_PREFIX}name`,
    `# guidance: one-line slice title`,
    `work_order_id: ${AUTHOR_REQUIRED_PREFIX}work_order_id`,
    `# guidance: WO-YYYY-MM-DD-nn`,
    `build: ${AUTHOR_REQUIRED_PREFIX}build`,
    `# guidance: BUILD-nnn, or standalone`,
    `wp_number: ${AUTHOR_REQUIRED_PREFIX}wp_number`,
    `# guidance: WP-n, or n/a`,
    'status: draft',
    `authorised_by: ${AUTHOR_REQUIRED_PREFIX}authorised_by`,
    `# guidance: who authorised this work — a claim only you can make`,
    `authorised_date: ${AUTHOR_REQUIRED_PREFIX}authorised_date`,
    `# guidance: YYYY-MM-DD of the AUTHORISATION (not the generation date)`,
    `owner: ${owner}`,
    `return_to: ${returnTo.value}`,
    `blocking_dependencies: ${AUTHOR_REQUIRED_PREFIX}blocking_dependencies`,
    `# guidance: [] or the exact blockers — overstating one was WO-11 A-3`,
    `tags: ${AUTHOR_REQUIRED_PREFIX}tags`,
    `# guidance: [build-nnn, wp-n]`,
    '',
    '# --- scope ---',
    `outcome: ${AUTHOR_REQUIRED_PREFIX}outcome`,
    `# guidance: one sentence — what is TRUE when this is done. If AUTOMATIC, acceptance must exercise the real production event; if manual, say so. See work-order template § intended-automatic.`,
    `acceptance_property: ${AUTHOR_REQUIRED_PREFIX}acceptance_property`,
    `# guidance: the ONE property whose truth decides this WP, checkable without being told the answer. "Tests pass" is not one.`,
    `integration_owner: ${integrationOwner.value}`,
    `veritas_gate: ${AUTHOR_REQUIRED_PREFIX}veritas_gate`,
    `# guidance: 1 = integrated WP · 2 = phase/vertical slice · 3 = documentation and Git truth`,
    `document_impact: ${AUTHOR_REQUIRED_PREFIX}document_impact`,
    `# guidance: every affected active document with its owner, or [] with the check actually run. IDENTIFIES; never AUTHORISES.`,
    '',
    yamlBlock('file_surface', surfaceLines.length ? surfaceLines : ['# (empty — machine_surface order)']),
    ...(isMachineInstall
      ? [
          '# machine_surface: CLOSED LIST. Write permitted here and ONLY here. Absolute machine paths.',
          yamlBlock('machine_surface', machineLines),
        ]
      : []),
    `out_of_scope_policy: ${outOfScopePolicy.value}`,
    '',
    '# --- contract and capability compatibility ---',
    '# `contract_basis` below is GENERATED BY EXTRACTION from the canonical contract, not authored.',
    '# Each entry names the exact heading that permits the surface or action, or is UNRESOLVED.',
    '# machine_surface entries are NOT matched against repo patterns (G-6).',
    yamlBlock('worker_contract', [`path: ${contractPath}`, `governance_sha: ${governanceHead}`]),
    '',
    yamlBlock('contract_basis', basisLines),
    '',
    // G-1 — bare AUTHOR REQUIRED; guidance is a sibling comment, never part of the value.
    `contract_conflicts: ${AUTHOR_REQUIRED_PREFIX}contract_conflicts`,
    '# guidance: bare value only — `none` OR the conflict list. `none` is EARNED, never a default placeholder. Never glue prose to the value.',
    '',
    yamlBlock('capability_evidence', [
      `source: ${AUTHOR_REQUIRED_PREFIX}capability_evidence.source`,
      `# guidance: authoritative live inventory | executed probe | unknown`,
      `result: ${AUTHOR_REQUIRED_PREFIX}capability_evidence.result`,
      `# guidance: capabilities actually OBSERVED. unknown is honest but is NOT permission`,
    ]),
    '',
    '# --- authority ---',
    `# STANDING DEFAULTS, generated by extraction from \`${SOURCES.template}\`. Larry does not retype`,
    '# these and never redrafts them from memory (J1-3). They are EMITTED, not omitted: every worker',
    '# contract and the canonical template require them present, and `private_surface` is GL-012\'s',
    '# only route to a worker that inherits nothing else. Any deviation carries its escalation.',
    ...authorityLines,
    '',
    '# --- environment ---',
    // Forward slashes on emission. A backslash path in an order is a defect waiting to happen:
    // R-24 was `MSYS_NO_PATHCONV` breaking `git -C` on this estate's path handling.
    // G-1/G-2 — bare value; verification is a sibling comment with honest provenance.
    `worktree: ${worktree ? slashes(worktree) : `${AUTHOR_REQUIRED_PREFIX}worktree`}`,
    ...(worktree
      ? [`# worktree verification (${tree.state}): ${tree.value}`]
      : [
          '# guidance: absolute worktree path, or the bare value `n/a — not a git repo`',
          '# worktree verification: n/a — no worktree supplied (absent-input; not "supplied + verified")',
        ]),
    `branch: ${branch ?? `${AUTHOR_REQUIRED_PREFIX}branch`}`,
    ...(branch ? [] : ['# guidance: wo/nn-slug, or the bare value `n/a — not a git repo`']),
    '',
    '# --- inputs and handoffs ---',
    `schema_decision: ${AUTHOR_REQUIRED_PREFIX}schema_decision`,
    `# guidance: link to Silas's decision, or bare n/a`,
    `security_inputs: ${AUTHOR_REQUIRED_PREFIX}security_inputs`,
    `# guidance: link to Vex's findings, or bare n/a`,
    `operational_handoff: ${AUTHOR_REQUIRED_PREFIX}operational_handoff`,
    '# guidance: bare value only — mack | none. The worker READS this field and never infers it.',
    '# runbook_path: REQUIRED when operational_handoff is `mack`. Must be a SERVICE-LOCAL path the',
    '#   implementer may actually write. A runbook under Builds/** is not writable by the implementer.',
    '---',
    '',
    `# ${AUTHOR_REQUIRED_PREFIX}title`,
    '# guidance: WO-YYYY-MM-DD-nn — slice title',
    '',
    '## Acceptance criteria',
    '',
    `${AUTHOR_REQUIRED_PREFIX}AC1..ACn`,
    '# guidance: each independently checkable. If automatic, no AC may be satisfiable by a manual invocation of the delivered script alone.',
    '',
    '## Required evidence',
    '',
    `- ${AUTHOR_REQUIRED_PREFIX}acceptance_command`,
    `# guidance: the exact command that must be EXECUTED — assert the reported count, never the exit code alone`,
    `- \`bash scripts/secret-scan.sh --surface ${scanTargets}\` → report exit code AND coverage. Exit 2 is NOT SCANNED, never a pass`,
    '',
    '## Inputs supplied',
    '',
    `${AUTHOR_REQUIRED_PREFIX}inputs`,
    '# guidance: every brief, decision, receipt and corpus this order stands on, BY PATH',
    '',
    '## Explicitly out of scope — report, never fix',
    '',
    `${AUTHOR_REQUIRED_PREFIX}out_of_scope`,
    '# guidance: what the worker must report rather than repair',
    '',
    '## Sequencing',
    '',
    `${AUTHOR_REQUIRED_PREFIX}sequencing`,
    '# guidance: order of work, the read-back HOLD, and the git endpoint (push? PR? neither?)',
    '',
    '---',
    '',
    '## Envelope — generated, not drafted',
    '',
    render(envelope),
  ].join('\n');

  const { authorCount, unresolvedCount } = countMarkers(body);
  const trailer = issuabilitySnapshotFooter(authorCount, unresolvedCount);

  return {
    ok: true,
    text: `${body}\n${trailer}\n`,
    generatedAt,
    authorCount,
    unresolvedCount,
    envelope,
    basis,
    headCheck,
    isMachineInstall,
  };
}

// ---------------------------------------------------------------------------
// CLI.
// ---------------------------------------------------------------------------

/** Repeatable flags collect into an array; a single occurrence stays a scalar. */
export function parseArgs(argv) {
  const args = {};
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    const value = next === undefined || next.startsWith('--') ? true : next;
    if (value !== true) i++;
    if (seen.has(key)) {
      args[key] = Array.isArray(args[key]) ? [...args[key], value] : [args[key], value];
    } else {
      args[key] = value;
      seen.add(key);
    }
  }
  return args;
}

export function asList(value) {
  if (value === undefined || value === true) return [];
  return Array.isArray(value) ? value.map(String) : [String(value)];
}

/** `--deviate field=value` pairs, with `--deviation-authority` applied to all of them. */
export function parseDeviations(raw, authority) {
  return asList(raw).map((entry) => {
    const idx = entry.indexOf('=');
    if (idx === -1) return { field: entry, value: authorRequired(entry, 'no value supplied to --deviate'), authority };
    return { field: entry.slice(0, idx).trim(), value: entry.slice(idx + 1).trim(), authority };
  });
}

const USAGE = `usage: node tools/wo/envelope.mjs --owner <slug> --governance-head <sha> [options]
       node tools/wo/envelope.mjs --count-markers <file>

ORDINARY DISPATCH ROUTE (J1-1): the ordinary issuer path is this generator (then bare-slot
authoring + --count-markers). Workers REFUSE orders that lack the ORDER_MARKER (SOP-022).
This is discipline + refuse-gate, not an auto-invoking service.

  --owner <slug>              the specialist the order is for
  --governance-head <sha>     the commit whose contracts govern. VERIFIED TO EXIST; no bypass
  --out <path>                write the complete order here ('-' or omitted = stdout)
  --surface <path>            a repo file_surface entry. REPEATABLE
  --machine-surface <path>    an absolute MACHINE path (G-6). REPEATABLE. Closed list.
                              Does NOT match against repo contract patterns. Requires
                              --deviate live_authority=<bounded value> for a real install.
  --action "<text>"           a required non-file action. REPEATABLE
  --worktree <path>           the worker's worktree (verified: ancestor-or-equal of the head)
  --branch <name>             the worker's branch
  --deviate field=value       deviate from a standing default. REPEATABLE
  --deviation-authority "..." who authorised the deviation(s), and when
  --envelope-only             envelope rows on stdout, no order body
  --count-markers <file>      G-5 live recomputation of AUTHOR REQUIRED / UNRESOLVED counts
  --root <repo>               repository root (default: cwd)

Emits a COMPLETE Work Order with every non-authored field copied or extracted from canonical
source. Larry authors bare slot values only; guidance lives in sibling comments (G-1).

Exit code is NOT a verdict about any Work Order. --count-markers exit 0 always; prints counts.`;

function main(argv) {
  const args = parseArgs(argv);

  // G-5 — live recomputation. Does not require --owner.
  if (args['count-markers']) {
    const file = args['count-markers'] === true ? null : String(args['count-markers']);
    if (!file) {
      process.stderr.write('usage: node tools/wo/envelope.mjs --count-markers <file>\n');
      return 2;
    }
    if (!existsSync(file)) {
      process.stderr.write(`FATAL — not found: ${file}\n`);
      return 3;
    }
    const text = readFileSync(file, 'utf8');
    const { authorCount, unresolvedCount } = countMarkers(text);
    const ready = authorCount === 0 && unresolvedCount === 0;
    process.stdout.write(
      JSON.stringify({
        file,
        authorCount,
        unresolvedCount,
        ready,
        note: 'Live recomputation. Generation-time footer is a snapshot only.',
      }) + '\n',
    );
    return 0;
  }

  if (args.help || !args.owner) {
    process.stderr.write(`${USAGE}\n`);
    return 2;
  }
  const root = typeof args.root === 'string' ? args.root : process.cwd();
  const owner = String(args.owner);
  const governanceHead = typeof args['governance-head'] === 'string' ? args['governance-head'] : null;
  const worktree = typeof args.worktree === 'string' ? args.worktree : null;

  if (args['envelope-only']) {
    // G-7 — this path must show the SAME operative authority values as the full order, or
    // `--envelope-only` becomes a second, quieter answer that contradicts the order it summarises.
    process.stdout.write(`${render(resolveEnvelope({
      root,
      owner,
      governanceHead,
      worktree,
      deviations: parseDeviations(args.deviate, args['deviation-authority']),
    }))}\n`);
    return 0;
  }

  const order = generateOrder({
    root,
    owner,
    governanceHead,
    worktree,
    branch: typeof args.branch === 'string' ? args.branch : null,
    surfaces: asList(args.surface),
    machineSurfaces: asList(args['machine-surface']),
    actions: asList(args.action),
    deviations: parseDeviations(
      args.deviate,
      typeof args['deviation-authority'] === 'string' ? args['deviation-authority'] : null,
    ),
  });

  // S-4: loud, and there is no order to show. Not a warning above a rendered file.
  if (!order.ok) {
    process.stderr.write(`FATAL — ${order.fatal}\n`);
    return 3;
  }

  const out = typeof args.out === 'string' && args.out !== '-' ? args.out : null;
  if (out) {
    writeFileSync(out, order.text, 'utf8');
    process.stderr.write(
      `wrote ${out} — SNAPSHOT ${order.authorCount} AUTHOR REQUIRED, ${order.unresolvedCount} UNRESOLVED (recompute with --count-markers after authoring)\n`,
    );
  } else {
    process.stdout.write(order.text);
  }
  return 0;
}

const invokedDirectly =
  process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/wo/envelope.mjs');
if (invokedDirectly) process.exit(main(process.argv.slice(2)));
