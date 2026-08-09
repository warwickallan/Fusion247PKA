#!/usr/bin/env node
// tools/wo/dispatch-guard.mjs — 4F CAPA ITEM 8. THE DISPATCH ITSELF REFUSES AN UNREADY ORDER.
//
// WHAT THIS IS
// ------------
// A `PreToolUse` hook for the subagent-dispatch tool (`Task`). It runs on the REAL production
// event — Larry dispatching a specialist — and returns `permissionDecision: deny` when the
// Work Order carried by that dispatch is not semantically executable.
//
// WHY IT EXISTS, and it is the whole of item 8 (Warwick, 2026-08-09):
//   "The dispatch command itself must enforce the validator. It must not be possible for Larry
//    to bypass it accidentally by sending a worker directly. This is the load-bearing one:
//    items 1–7 are all bypassable while dispatch remains a free-form message."
// A validator Larry must remember to run is the same class of defect as the rule it replaces.
//
// WHAT THIS IS NOT
// ----------------
// Not a control plane, registry, store, tracker or service. It holds no state, writes no file,
// starts no process and remembers nothing between calls. It is one function over the dispatch
// payload plus `assessOrder()` from the existing generator.
//
// THE TWO THINGS IT REFUSES
// -------------------------
//   1. A dispatch carrying a Work Order — inline, or by path — that `assessOrder` says is NOT
//      READY. This is rows 1–6 of the CAPA evidence table.
//   2. A dispatch that is Work-Order-SHAPED but carries no generated order at all. This is the
//      "sending a worker directly" bypass, and without it items 1–7 stay advisory.
// Everything else defers silently: research briefs, assurance dispatches, questions and
// ordinary sub-tasks are untouched.
//
// FAIL DIRECTION, chosen deliberately and matching tools/governor/worktree-guard.mjs AD-19:
// an internal error DEFERS rather than denies. A guard that bricks every dispatch when it has
// a bug is removed within a day, and a removed control protects nothing. The cost is real and
// is stated rather than hidden: while this guard is broken it is also silent.
//
// Zero runtime dependencies. node: builtins only.

import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { ORDER_MARKER, assessOrder, renderAssessment } from './envelope.mjs';

/** The host's subagent-dispatch tool. Named once. */
export const DISPATCH_TOOLS = ['Task'];

export const DECISION = { DENY: 'deny', DEFER: 'defer' };

export const REFUSAL = {
  UNREADY_ORDER: 'unready-order',
  NO_GENERATED_ORDER: 'no-generated-order',
};

// ---------------------------------------------------------------------------
// Is this dispatch a Work Order?
// ---------------------------------------------------------------------------
// `governance_head` is DELIBERATELY ABSENT from this list. Root CLAUDE.md § "Specialist
// dispatch" requires EVERY dispatch to name the governance head, so it discriminates nothing
// and including it would deny every Veritas and Pax dispatch on the estate.

export const ORDER_PHRASE = /\bwork[\s-]?order\b/i;

export const ENVELOPE_FIELD_TOKENS = [
  'file_surface',
  'work_order_id',
  'private_surface',
  'credential_scope',
  'live_authority',
  'contract_basis',
  'out_of_scope_policy',
  'acceptance_property',
  'operational_handoff',
  'worker_contract',
];

export function envelopeFieldsPresent(text) {
  const s = String(text ?? '').toLowerCase();
  return ENVELOPE_FIELD_TOKENS.filter((t) => s.includes(t));
}

/**
 * Work-Order-shaped when it either calls itself a Work Order AND carries an envelope field,
 * or carries two envelope fields with no such wording. Two signals, so ordinary prose that
 * happens to mention one of these words is not caught.
 */
export function looksLikeWorkOrder(text) {
  const fields = envelopeFieldsPresent(text);
  if (ORDER_PHRASE.test(String(text ?? '')) && fields.length >= 1) return { shaped: true, fields };
  if (fields.length >= 2) return { shaped: true, fields };
  return { shaped: false, fields };
}

// ---------------------------------------------------------------------------
// Finding the order the dispatch carries
// ---------------------------------------------------------------------------

/** `.md` path-shaped tokens in the dispatch text. Bare filenames are ignored. */
export function markdownReferences(text) {
  const out = [];
  for (const raw of String(text ?? '').split(/[\s"'`(),;<>\[\]]+/)) {
    const s = raw.replace(/[.,;:]+$/, '').trim();
    if (!s.toLowerCase().endsWith('.md')) continue;
    if (!/[\\/]/.test(s)) continue;
    const norm = s.replace(/\\/g, '/');
    if (!out.includes(norm)) out.push(norm);
  }
  return out;
}

export function resolveReference(ref, roots) {
  if (isAbsolute(ref) || /^[A-Za-z]:\//.test(ref)) return existsSync(ref) ? ref : null;
  for (const root of roots) {
    if (!root) continue;
    const abs = resolve(root, ref);
    if (existsSync(abs)) return abs;
  }
  return null;
}

/**
 * Every Work Order this dispatch carries: pasted inline, and/or referenced by path.
 * A file is only an order if it carries the generator's provenance marker — that is what
 * keeps an ordinary cited document (a Wayfinder map, a brief, a receipt) out of this set.
 */
export function collectOrders(text, roots, { read = readFileSync } = {}) {
  const orders = [];
  const body = String(text ?? '');
  if (body.includes(ORDER_MARKER)) orders.push({ source: 'inline (pasted into the dispatch)', text: body });
  for (const ref of markdownReferences(body)) {
    const abs = resolveReference(ref, roots);
    if (!abs) continue;
    let content;
    try {
      content = read(abs, 'utf8');
    } catch {
      continue;
    }
    if (!String(content).includes(ORDER_MARKER)) continue;
    orders.push({ source: ref, path: abs, text: String(content) });
  }
  return orders;
}

// ---------------------------------------------------------------------------
// The decision
// ---------------------------------------------------------------------------

export function denyReasonForUnready(assessed) {
  const lines = [
    '⛔ DISPATCH REFUSED — the Work Order this dispatch carries is NOT READY.',
    '',
    '4F CAPA item 8: dispatch itself enforces the readiness validator, so an unready order',
    'cannot reach a worker by being sent directly. This is not advisory.',
    '',
  ];
  for (const a of assessed) {
    lines.push(renderAssessment(a.assessment, a.source));
    lines.push('');
  }
  lines.push(
    'FIX THE ORDER, THEN DISPATCH AGAIN:',
    '  node tools/wo/envelope.mjs --assess <order file>   # exit 0 = READY',
    '',
    'Amend the existing order in place — do not regenerate a fresh envelope unless the work',
    'package genuinely changed (CAPA item 7). `contract_basis` justifies a surface; only',
    '`file_surface` grants one (CAPA item 2).',
  );
  return lines.join('\n');
}

export function denyReasonForNoOrder(fields) {
  return [
    '⛔ DISPATCH REFUSED — this dispatch is Work-Order-shaped but carries no GENERATED Work Order.',
    '',
    `Envelope fields seen in the prompt: ${fields.join(', ')}`,
    '',
    'A Work Order is issued on the ordinary generation route (SOP-022 § "Ordinary dispatch route"):',
    '  node tools/wo/envelope.mjs --owner <slug> --governance-head <sha> --surface <path> --out <file>',
    '  # author the bare slots, then:',
    '  node tools/wo/envelope.mjs --assess <file>          # exit 0 = READY',
    'then dispatch NAMING THAT FILE, or paste its full text into the prompt.',
    '',
    'If this dispatch is genuinely NOT a Work Order (a research brief, an assurance gate, a',
    'question), it must not read as one: remove the envelope field names from the prompt.',
  ].join('\n');
}

export function decideDispatch({ toolName, toolInput, roots = [], read = readFileSync, root = null } = {}) {
  if (!DISPATCH_TOOLS.includes(toolName)) {
    return { decision: DECISION.DEFER, reason: `${toolName ?? '(no tool)'} is not a dispatch tool.` };
  }
  const text = [toolInput?.prompt, toolInput?.description].filter(Boolean).join('\n\n');
  const orders = collectOrders(text, roots, { read });

  if (orders.length > 0) {
    const assessed = orders.map((o) => ({ ...o, assessment: assessOrder(o.text, { root: root ?? roots[0] ?? null }) }));
    const unready = assessed.filter((a) => !a.assessment.ready);
    if (unready.length > 0) {
      return {
        decision: DECISION.DENY,
        refusal: REFUSAL.UNREADY_ORDER,
        reason: denyReasonForUnready(unready),
        assessed,
      };
    }
    return {
      decision: DECISION.DEFER,
      reason: `${assessed.length} Work Order(s) carried by this dispatch are READY.`,
      assessed,
    };
  }

  const shape = looksLikeWorkOrder(text);
  if (shape.shaped) {
    return {
      decision: DECISION.DENY,
      refusal: REFUSAL.NO_GENERATED_ORDER,
      reason: denyReasonForNoOrder(shape.fields),
      fields: shape.fields,
    };
  }

  return { decision: DECISION.DEFER, reason: 'Dispatch carries no Work Order and is not Work-Order-shaped.' };
}

// ---------------------------------------------------------------------------
// Hook plumbing — same shape as tools/governor/worktree-guard.mjs, deliberately.
// ---------------------------------------------------------------------------

export function parseHookInput(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return { ok: false, reason: 'empty stdin', payload: {} };
  try {
    const payload = JSON.parse(raw);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return { ok: false, reason: 'stdin was not a JSON object', payload: {} };
    }
    return { ok: true, payload };
  } catch (err) {
    return { ok: false, reason: `stdin was not valid JSON: ${err.message}`, payload: {} };
  }
}

export function runHook(raw, opts = {}) {
  const parsed = parseHookInput(raw);
  if (!parsed.ok) {
    return { decision: DECISION.DEFER, reason: `Dispatch guard could not read its input (${parsed.reason}).` };
  }
  const payload = parsed.payload;
  const roots = [payload.cwd, ...(opts.roots ?? [])].filter(Boolean);
  try {
    return decideDispatch({
      toolName: payload.tool_name,
      toolInput: payload.tool_input || {},
      roots,
      read: opts.read,
      root: opts.root ?? roots[0] ?? null,
    });
  } catch (err) {
    return { decision: DECISION.DEFER, reason: `Dispatch guard errored (${err.message}); failing open.` };
  }
}

/** Only DENY emits. DEFER emits nothing and the host proceeds exactly as it would have. */
export function toHookOutput(result) {
  if (!result || result.decision !== DECISION.DENY) return null;
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: result.reason,
    },
  };
}

// ---------------------------------------------------------------------------
// CLI. ALWAYS exits 0 — a hook that exits non-zero is an error to the host, not a verdict.
// ---------------------------------------------------------------------------

async function main() {
  let raw = '';
  try {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    raw = Buffer.concat(chunks).toString('utf8');
  } catch {
    raw = '';
  }

  const roots = [];
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root' && argv[i + 1]) roots.push(argv[++i]);
  }

  let out = null;
  try {
    out = toHookOutput(runHook(raw, { roots }));
  } catch {
    out = null;
  }
  if (out) process.stdout.write(JSON.stringify(out));
  process.exitCode = 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
