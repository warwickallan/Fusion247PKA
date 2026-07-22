// BUILD-014 Tower — durable hold transitions (explicit hold / release, idempotent).
//
// A 'held' turn is out of the normal claim/reclaim path (watcher.claimOne filters state='pending';
// reclaimStale filters state='claimed' — both skip 'held'). Holding NEVER reviews or notifies. Release
// explicitly returns a held row to 'pending'. Both operations are idempotent: re-holding a held row
// only refreshes its hold metadata; releasing a non-held row is a no-op. Substantive turn content
// (instruction, larry_response, seq, build_ref, timestamps other than updated_at) is never changed.

// Hold a turn. Only a pending / claimed / already-held row may be held (never a reviewed/final row).
// Returns { id, state } of the held row, or null if it was not in a holdable state.
export async function holdTurn(pool, id, { heldBy, reason, until = null } = {}) {
  if (!heldBy) throw new Error('holdTurn: heldBy required');
  const { rows } = await pool.query(
    `update tower.turn
        set state = 'held', lease_owner = null, lease_deadline_at = null,
            held_at = coalesce(held_at, now()), held_by = $2, hold_reason = $3, hold_until = $4,
            updated_at = now()
      where id = $1 and state in ('pending', 'claimed', 'held')
      returning id, state`,
    [id, heldBy, reason ?? null, until]);
  return rows[0] ?? null;
}

// Release a held turn back to pending (explicit). Idempotent: a non-held row is unchanged. Returns true
// only when THIS call released a held row.
export async function releaseTurn(pool, id) {
  const { rowCount } = await pool.query(
    `update tower.turn
        set state = 'pending', held_at = null, held_by = null, hold_reason = null, hold_until = null,
            lease_owner = null, lease_deadline_at = null, updated_at = now()
      where id = $1 and state = 'held'`,
    [id]);
  return rowCount > 0;
}
