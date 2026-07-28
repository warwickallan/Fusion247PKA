// =====================================================================
// BUILD-015 AsdAIr browser runner - THE CONTROL CLI.
//
//   node runnerctl.cjs pause      stop issuing browser commands; keep the lease
//   node runnerctl.cjs resume     continue from the last durable checkpoint
//   node runnerctl.cjs takeover   RELEASE the lease - the browser is yours
//   node runnerctl.cjs stop       stop cleanly at basket-ready
//   node runnerctl.cjs run        clear any directive
//   node runnerctl.cjs show       print the current directive (no credentials)
//   node --env-file=<env> runnerctl.cjs status [id]   durable state + lease
//
// pause/resume/takeover/stop/show need NO credentials and NO database: they
// work from any terminal on this machine even with Supabase unreachable.
// Only `status` reads the database.
// =====================================================================
'use strict';

const control = require('./control.cjs');

const DIRECTIVE_HELP = {
  pause: 'runner will stop issuing browser commands and hold its lease; Chrome stays open and usable',
  resume: 'runner will continue from the last durable checkpoint - already-completed steps are never repeated',
  takeover: 'runner will RELEASE the writing lease; no automated click can race your hand',
  stop: 'runner will stop cleanly at basket-ready and leave the browser on the trolley',
  run: 'directive cleared; the runner proceeds normally',
};

async function status(id) {
  const store = require('./store.cjs');
  const lease = require('./lease.cjs');
  const P = require('./progress.cjs');
  const query = store.readQuery();
  try {
    const rows = await lease.peek(query, { requestId: id || null });
    const list = Array.isArray(rows) ? rows : (rows ? [rows] : []);
    if (!list.length) { console.log('no browser_build_request rows'); return 0; }
    for (const r of list) {
      const l = (r.progress && r.progress._lease) || null;
      console.log('---');
      console.log(`request ${r.id}  shop ${r.shop_id}  status=${r.status}`);
      console.log(`  claimed_by : ${r.claimed_by || '(none)'}`);
      console.log(`  lease      : ${l ? `${l.runner_id} heartbeat=${l.heartbeat_at} expires=${l.expires_at} ${r.lease_expired ? 'EXPIRED' : 'LIVE'}` : '(no lease held)'}`);
      console.log(`  db now     : ${r.db_now && r.db_now.toISOString ? r.db_now.toISOString() : r.db_now}`);
      console.log(`  progress   : ${JSON.stringify(P.summary(r.progress))}`);
      if (r.last_error) console.log(`  last_error : ${r.last_error}`);
    }
  } finally { await query.end(); }
  return 0;
}

async function main() {
  const cmd = process.argv[2];
  if (!cmd || cmd === '--help' || cmd === '-h') {
    console.log('usage: node runnerctl.cjs pause|resume|takeover|stop|run|show   (no database access needed)');
    console.log('       node --env-file=<env file> runnerctl.cjs status [request-id]');
    return 0;
  }
  if (cmd === 'show') { console.log(JSON.stringify(control.read(), null, 2)); return 0; }
  if (cmd === 'status') return status(process.argv[3] || null);
  if (Object.prototype.hasOwnProperty.call(DIRECTIVE_HELP, cmd)) {
    const written = control.write(cmd, { note: process.argv[3] || null });
    console.log(`${cmd}: ${DIRECTIVE_HELP[cmd]}`);
    console.log(`written to ${written.source} at ${written.at}`);
    return 0;
  }
  console.error(`unknown command: ${cmd}`);
  return 2;
}

module.exports = { status };

if (require.main === module) {
  main().then((c) => process.exit(c)).catch((e) => { console.error('FATAL', e.message); process.exit(1); });
}
