// =====================================================================
// BUILD-015 AsdAIr Stage 1 - pipeline-runtime/selftest-entry.mjs
//
// A STAND-IN FOR THE RUNTIME, USED ONLY BY --selftest.
//
// It exists for one reason: the launcher's spawn path (exclusive lock ->
// detached child -> identity binding -> settle -> status) must be provable
// end-to-end, including from the Windows logon task, WITHOUT starting a
// Telegram poller. getUpdates is destructive; a proof run that eats the week's
// shopping list is not a proof, it is an incident.
//
// So this process does exactly what the real runtime does that the LAUNCHER
// cares about - it takes the same argv shape, lives in its own process group,
// survives its parent, and writes the same JSONL heartbeat to the same log -
// and nothing else. It opens no socket, reads no credential, touches no
// database and sends no message.
// =====================================================================

const started = new Date().toISOString();
const interval = Number(process.env.ASDAIR_SELFTEST_INTERVAL_MS || 2000);

function emit(event, detail = {}) {
  process.stdout.write(`${JSON.stringify({ event, selftest: true, at: new Date().toISOString(), ...detail })}\n`);
}

emit('selftest_started', { pid: process.pid, started, argv: process.argv.slice(2) });

let pass = 0;
const timer = setInterval(() => {
  pass += 1;
  // The SAME event name the real watch loop emits, so the status surface is
  // being exercised against the shape it will really see.
  emit('pass', { pass, stepped: 0, shops: 0 });
}, interval);

const stop = () => { clearInterval(timer); emit('stopping'); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
