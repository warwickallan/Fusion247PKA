// =====================================================================
// BUILD-015 AsdAIr Stage 1 - proof/fake-telegram-server.mjs
//
// A FILE-BACKED TELEGRAM, WITH THE DESTRUCTIVE ACK MODELLED HONESTLY.
//
// The offset-survival proof is worthless against a fake that merely filters a
// list, because such a fake will happily re-deliver an update the receiver has
// already acknowledged - which is exactly the failure the proof is supposed to
// be able to detect. So this stand-in behaves like the real Bot API:
//
//   * getUpdates(offset) CONFIRMS every update with update_id < offset, and
//     those updates are DELETED. They are never delivered again, by anyone.
//   * getUpdates() with no offset confirms nothing (this is what makes a
//     read-only "is anything waiting?" probe safe against the real bot too).
//   * the queue lives in a FILE, so it survives the process - which is the
//     whole point: a restart must be able to lose the shopping list, or the
//     proof that it does not is meaningless.
//
// It also keeps a fetch log, so the proof can assert on what was ASKED FOR, not
// just on what came back: "the second process asked for offset N+1" is the
// evidence that the offset survived, and "no update_id was ever delivered
// twice, and none was confirmed without being handled" is the evidence that
// nothing was silently consumed.
//
// Test support only. Synthetic fixtures - obviously fake tokens, ids and text.
// NEVER pointed at the real ShopperBot.
// =====================================================================

import fs from 'node:fs';

export function initServer(file, updates) {
  const state = {
    pending: updates.map((u) => ({ ...u })),
    confirmed_up_to: null,
    deleted: [],
    fetches: [],
    deliveries: [],
  };
  write(file, state);
  return state;
}

function read(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function write(file, state) {
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, `${JSON.stringify(state, null, 1)}\n`);
  fs.renameSync(tmp, file);
}

export function readServer(file) { return read(file); }

/**
 * A Telegram client in the shape shopperIntake's real client presents.
 *
 * @param {string} file  the server state file
 * @param {object} opts  { label } - who is polling, recorded in the fetch log
 */
export function createServerClient(file, { label = 'poller' } = {}) {
  return {
    async getUpdates({ offset, timeout = 0, limit = 100 } = {}) {
      const state = read(file);
      state.fetches.push({ by: label, pid: process.pid, offset: offset ?? null, at: new Date().toISOString() });

      if (offset !== undefined && offset !== null) {
        // THE DESTRUCTIVE ACK. Everything below the offset is gone for good.
        const confirming = state.pending.filter((u) => u.update_id < offset);
        if (confirming.length > 0) {
          state.deleted.push(...confirming.map((u) => u.update_id));
          state.pending = state.pending.filter((u) => u.update_id >= offset);
        }
        state.confirmed_up_to = Math.max(state.confirmed_up_to ?? -Infinity, offset - 1);
      }

      const batch = state.pending.slice(0, limit).map((u) => ({ ...u }));
      state.deliveries.push(...batch.map((u) => ({ update_id: u.update_id, by: label, pid: process.pid })));
      write(file, state);
      return batch;
    },
    async getFile() { return { file_path: 'photos/synthetic-fixture.jpg' }; },
    async downloadFile() { return Buffer.from('synthetic-fixture-not-a-photo'); },
    describe() { return { bot: 'fake-shopperbot', file }; },
  };
}

/**
 * Was anything lost?
 *
 * An update is LOST when the server confirmed (deleted) it but no process ever
 * finished handling it. That is the exact failure two pollers cause, and the
 * exact failure a badly-ordered offset write causes on restart.
 */
export function auditServer(file, handledUpdateIds) {
  const state = read(file);
  const handled = new Set(handledUpdateIds.map(Number));
  const deleted = state.deleted.map(Number);
  const lost = deleted.filter((id) => !handled.has(id));
  const deliveredCounts = {};
  for (const d of state.deliveries) deliveredCounts[d.update_id] = (deliveredCounts[d.update_id] || 0) + 1;
  return {
    confirmed_up_to: state.confirmed_up_to,
    deleted,
    still_pending: state.pending.map((u) => u.update_id),
    lost,
    fetches: state.fetches,
    delivered_counts: deliveredCounts,
  };
}
