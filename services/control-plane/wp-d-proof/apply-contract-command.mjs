// BUILD-002 WP0 — approval-apply worker (cp_worker). Executes cockpit.contract_command intents.
//
//   node wp-d-proof/apply-contract-command.mjs --drain [--key-prefix=<pfx>]
//
// The trusted EXECUTE half of the contract-approval seam (the cockpit can only INSERT an intent).
// For each `requested` contract_command it claims the row, VERIFIES the approval binding against
// the target cockpit.build_contract (bound_git_sha == git_commit_sha AND bound_content_hash ==
// pack_content_hash/content_sha256), then applies:
//   approve_contract  -> lifecycle 'approved'   (+ approved_by/at), walking draft->pending_approval->approved
//   request_changes   -> lifecycle 'changes_requested' (+ note),   walking draft->pending_approval->changes_requested
// A binding mismatch, missing/superseded contract, or bad state FAILS CLOSED (status=failed,
// receipt.ok=false, lifecycle untouched). Idempotent: an already-approved target is a no-op success.
// cp_worker holds UPDATE on the lifecycle/approval columns only — it can never rewrite identity or
// the Git binding, and can never INSERT an intent.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(fs.readFileSync(path.join(here, '.runtime-live', 'directus-live.env.json'), 'utf8'));
const ca = fs.readFileSync(cfg.ssl_ca_file);
const SSL = { ca, rejectUnauthorized: true };

const args = process.argv.slice(2);
const keyPfxArg = args.find((a) => a.startsWith('--key-prefix='));
const KEYPFX = keyPfxArg ? keyPfxArg.slice('--key-prefix='.length) : null;

const worker = new pg.Client({
  host: cfg.host, port: cfg.port, database: cfg.database,
  user: cfg.worker_pooler_user, password: cfg.worker_password, ssl: SSL,
});

// Walk a build_contract row forward to a target lifecycle through the guard-allowed transitions.
async function setLifecycle(cx, buildId, version, target, extra = {}) {
  const cur = (await cx.query(
    `select lifecycle_state from cockpit.build_contract where build_id=$1 and contract_version=$2 for update`,
    [buildId, version])).rows[0];
  if (!cur) throw Object.assign(new Error('contract not found'), { _closed: true });
  let state = cur.lifecycle_state;
  if (state === target) { // idempotent no-op (already approved / already changes_requested)
    return state;
  }
  const step = async (to, cols = {}) => {
    const sets = ['lifecycle_state=$3', 'updated_at=now()'];
    const vals = [buildId, version, to];
    for (const [k, v] of Object.entries(cols)) { vals.push(v); sets.push(`${k}=$${vals.length}`); }
    await cx.query(`update cockpit.build_contract set ${sets.join(', ')} where build_id=$1 and contract_version=$2`, vals);
  };
  // draft -> pending_approval is the "submit" hop the worker performs if needed.
  if (state === 'draft') { await step('pending_approval'); state = 'pending_approval'; }
  if (target === 'approved') {
    if (state !== 'pending_approval') throw Object.assign(new Error(`cannot approve from ${state}`), { _closed: true });
    await step('approved', { approved_by: extra.approved_by, approved_at: new Date() });
  } else if (target === 'changes_requested') {
    if (state !== 'pending_approval') throw Object.assign(new Error(`cannot request changes from ${state}`), { _closed: true });
    await step('changes_requested', { changes_requested_note: extra.note ?? null });
  } else {
    throw Object.assign(new Error(`unsupported target ${target}`), { _closed: true });
  }
  return target;
}

async function processOne(cmd) {
  const cx = worker;
  // Claim in its OWN committed statement (autocommit) so a later apply failure can mark the row
  // 'failed' — if the claim shared the apply txn, a rollback would revert it to 'requested' and the
  // poison intent would retry forever (defect caught by prove-contract-apply.mjs).
  const claimed = await cx.query(
    `update cockpit.contract_command set status='claimed', claimed_at=now() where id=$1 and status='requested' returning id`,
    [cmd.id]);
  if (claimed.rowCount === 0) return null; // someone else took it

  await cx.query('begin');
  try {
    // Verify binding against the target contract.
    const t = (await cx.query(
      `select git_commit_sha, content_sha256, pack_content_hash from cockpit.build_contract where build_id=$1 and contract_version=$2`,
      [cmd.build_id, cmd.contract_version])).rows[0];
    const boundHash = t ? (t.pack_content_hash ?? t.content_sha256) : null;
    if (!t) throw Object.assign(new Error('target contract not found'), { _closed: true });
    if (cmd.bound_git_sha !== t.git_commit_sha || cmd.bound_content_hash !== boundHash) {
      throw Object.assign(new Error(`binding mismatch (git ${cmd.bound_git_sha}!=${t.git_commit_sha} or hash mismatch)`), { _closed: true });
    }

    const target = cmd.command === 'approve_contract' ? 'approved' : 'changes_requested';
    const finalState = await setLifecycle(cx, cmd.build_id, cmd.contract_version, target,
      { approved_by: cmd.requested_by, note: cmd.note });

    const receipt = { ok: true, action: target, build_id: cmd.build_id, contract_version: cmd.contract_version,
      bound_git_sha: cmd.bound_git_sha, bound_content_hash: cmd.bound_content_hash, lifecycle_state: finalState, by: cmd.requested_by };
    await cx.query(`update cockpit.contract_command set status='done', completed_at=now(), receipt=$2::jsonb where id=$1`,
      [cmd.id, JSON.stringify(receipt)]);
    await cx.query('commit');
    console.log(`[apply] ${cmd.command} ${cmd.build_id}/${cmd.contract_version} -> ${finalState} (done)`);
    return { id: cmd.id, ok: true, finalState };
  } catch (e) {
    await cx.query('rollback');
    // Record the failure OUTSIDE the rolled-back txn (lifecycle untouched, fail closed).
    const receipt = { ok: false, error: String(e.message), build_id: cmd.build_id, contract_version: cmd.contract_version };
    await cx.query(`update cockpit.contract_command set status='failed', completed_at=now(), receipt=$2::jsonb where id=$1 and status='claimed'`,
      [cmd.id, JSON.stringify(receipt)]);
    console.log(`[apply] ${cmd.command} ${cmd.build_id}/${cmd.contract_version} -> FAILED: ${e.message}`);
    return { id: cmd.id, ok: false, error: e.message };
  }
}

async function main() {
  await worker.connect();
  const where = KEYPFX ? `status='requested' and idempotency_key like $1` : `status='requested'`;
  const params = KEYPFX ? [`${KEYPFX}%`] : [];
  const pending = (await worker.query(
    `select id, requested_by, command, build_id, contract_version, bound_git_sha, bound_content_hash, note
       from cockpit.contract_command where ${where} order by requested_at asc`, params)).rows;
  console.log(`[apply] ${pending.length} pending contract_command(s)${KEYPFX ? ` (scope ${KEYPFX})` : ''}`);
  for (const cmd of pending) await processOne(cmd);
}

main()
  .catch((e) => { console.error('[apply] error', e.message); process.exitCode = 1; })
  .finally(async () => { await worker.end().catch(() => {}); });
