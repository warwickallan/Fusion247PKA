// BUILD-002 QA2 point 2 — one consistent lease/reclaim primitive for every intent queue.
//
// Problem: `update ... set status='claimed' where status='requested'` (autocommit) leaves a row
// PERMANENTLY 'claimed' if the worker crashes after claiming but before applying. Fix: a claim is a
// LEASE. A 'claimed' row whose claimed_at is older than the lease is reclaimable by any worker; the
// claim/reclaim update is atomic and single-winner (a second worker's WHERE matches 0 rows). The
// update-guards already permit claimed->claimed (the transition check only fires on a status CHANGE),
// so no schema/guard change is needed — this centralises the SQL so all six queues behave identically.
//
// Safety of re-apply after reclaim: the apply runs in ONE transaction, so a crash mid-apply rolls back
// cleanly (no partial durable effect); each apply is idempotent (ON CONFLICT DO NOTHING / effect-keyed
// upserts / status-guarded updates), so re-applying a reclaimed intent produces no duplicate effect.

export const LEASE_INTERVAL = "interval '5 minutes'";

// SQL predicate for "claimable now": a fresh requested row OR a claimed row whose lease has expired.
export function claimableWhere() {
  return `(status='requested' or (status='claimed' and claimed_at < now() - ${LEASE_INTERVAL}))`;
}

// Atomically claim/reclaim a specific row. `table` is a fixed trusted constant (never user input).
// Returns the pg result; rowCount===1 means THIS worker won the (re)claim, 0 means another did.
export async function claimById(cx, table, id) {
  return cx.query(
    `update ${table} set status='claimed', claimed_at=now() where id=$1 and ${claimableWhere()} returning id`,
    [id]);
}
