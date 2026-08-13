// =====================================================================
// BUILD-015 AsdAIr - pipeline/finalise/accounting.js
//
// WO-2026-08-13-04 (WP-B15-37), AC1. THE ACCOUNTING CLOSURE.
//
//     "Every source line ends in exactly one of: resolved · skipped
//      (explicitly, with reason) · unresolved and routed. A line that simply
//      disappears is the defect this AC exists to catch."
//
// So this module does not summarise. It RECONCILES two counts that were derived
// independently, and reports `closes: false` the moment they part company. The
// proof beside it makes that assertion FAIL by removing a line, which is the
// only way to know the check can bite.
//
// The identity of every observation is carried through end to end, so the
// closure is a set comparison rather than an arithmetic coincidence: two errors
// that cancel out in a total cannot cancel out in a set difference.
//
// PURE. No I/O, no model, no clock, no database.
// =====================================================================

'use strict';

import { DISPOSITION } from './finalList.js';

/**
 * PURE. Reconcile every reconciled photo observation against its fate.
 *
 * @returns {{closes:boolean, observed:number, accounted:number,
 *            resolved:number, skipped:number, routed:number,
 *            missing:string[], duplicated:string[], byKey:object}}
 */
export function buildAccounting({ reconciled, established, unsupported, finalList, shopLines }) {
  // EVERY observation the reconciliation produced, by its own identity key.
  const observed = reconciled.observations.map((o) => o.identity_key);

  // The fate of each one, derived from what the PRODUCTION run actually did -
  // never from the same array the observations came from.
  const byKey = new Map();
  const record = (key, fate, detail) => {
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push({ fate, detail });
  };

  // Established lines: their fate is whatever the durable shop_line says, joined
  // through the line_no the pipeline was handed.
  const establishedByLineNo = new Map(established.map((o, i) => [i + 1, o]));
  for (const sl of shopLines) {
    const obs = establishedByLineNo.get(sl.line_no);
    if (!obs) continue;
    const line = finalList.lines.find((l) => l.provenance_detail.line_no === sl.line_no) || null;
    const fate = line && line.disposition === DISPOSITION.RESOLVED
      ? DISPOSITION.RESOLVED
      : DISPOSITION.ROUTED;
    record(obs.identity_key, fate, {
      line_no: sl.line_no,
      status: sl.status,
      product: line ? line.product : null,
      held_reason: line ? line.held_reason : null,
    });
  }

  // Explicitly skipped candidates.
  for (const s of finalList.skipped) {
    record(s.identity_key, DISPOSITION.SKIPPED, { reason: s.reason });
  }

  const missing = observed.filter((k) => !byKey.has(k));
  const duplicated = [...byKey.entries()].filter(([, v]) => v.length > 1).map(([k]) => k);

  const counts = { resolved: 0, skipped: 0, routed: 0 };
  for (const fates of byKey.values()) {
    for (const f of fates) {
      if (f.fate === DISPOSITION.RESOLVED) counts.resolved += 1;
      else if (f.fate === DISPOSITION.SKIPPED) counts.skipped += 1;
      else counts.routed += 1;
    }
  }

  const accounted = [...byKey.values()].reduce((n, v) => n + v.length, 0);

  return {
    work_order: 'WO-2026-08-13-04 (WP-B15-37) AC1',
    statement: 'every reconciled photo observation ends in exactly one of resolved / skipped / unresolved-routed',
    observed: observed.length,
    accounted,
    established: established.length,
    unsupported: unsupported.length,
    ...counts,
    missing,
    duplicated,
    closes: missing.length === 0 && duplicated.length === 0 && accounted === observed.length,
    byKey: Object.fromEntries([...byKey.entries()].map(([k, v]) => [k, v])),
  };
}

/**
 * PURE. The assertion itself, separated so a proof can call the SAME code the
 * artefact was built with and watch it fail. An accounting check that only ever
 * runs on a good input is not a check.
 */
export function assertAccountingCloses(accounting) {
  if (accounting.missing.length > 0) {
    throw new Error(`accounting does not close: ${accounting.missing.length} observation(s) vanished - ${accounting.missing.join(', ')}`);
  }
  if (accounting.duplicated.length > 0) {
    throw new Error(`accounting does not close: ${accounting.duplicated.length} observation(s) landed in two places - ${accounting.duplicated.join(', ')}`);
  }
  if (accounting.accounted !== accounting.observed) {
    throw new Error(`accounting does not close: ${accounting.observed} observed, ${accounting.accounted} accounted`);
  }
  return true;
}
