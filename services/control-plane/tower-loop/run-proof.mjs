// BUILD-014 Tower supervisor loop — REQUIRED end-to-end proof (executed).
//
// Flow: apply → seed → ingest one (instruction, larryResponse) → runTurn (REAL Codex) →
// then SIMULATE A WATCHER RESTART: tear down the pool, open a FRESH pool/process context,
// and reconstruct the COMPLETE turn (instruction + larry_response + prompt + Codex review)
// PURELY from the DB — printing it, proving durability across a restart.
//
// Nothing is faked: Codex really runs (or returns a clearly-marked blocked verdict if no
// binary/auth is present); Telegram really fires if TELEGRAM_BOT_TOKEN + AUTHORISED_
// TELEGRAM_USER_ID are set, otherwise the attempt is recorded honestly as not-sent.
//
//   CONTROL_PLANE_DEV_DATABASE_URL=postgres://... node run-proof.mjs

import pg from 'pg';
import { applySchema, applyWatcherSchema } from './apply.mjs';
import { seedPrompt } from './seed.mjs';
import { runTurn, reconstructTurn } from './loop.mjs';

const DB_URL = process.env.CONTROL_PLANE_DEV_DATABASE_URL;

function hr(label) { console.log(`\n${'═'.repeat(72)}\n${label}\n${'═'.repeat(72)}`); }

async function main() {
  if (!DB_URL) throw new Error('CONTROL_PLANE_DEV_DATABASE_URL is not set.');

  hr('STEP 1 — apply schema (idempotent)');
  const applied = await applySchema(DB_URL);
  console.log(`applied base: ${applied.applied} from ${applied.sqlPath}`);
  const appliedDelta = await applyWatcherSchema(DB_URL);
  console.log(`applied watcher delta: ${appliedDelta.applied} from ${appliedDelta.sqlPath}`);

  hr('STEP 2 — seed active supervisor prompt');
  const seeded = await seedPrompt(DB_URL);
  console.log(`prompt v${seeded.version} hash=${seeded.content_hash} active=${seeded.active} approved_by=${seeded.approved_by}`);

  hr('STEP 3 — ingest one turn + runTurn (prompt-loaded-first, persist, reconstruct, REAL Codex, review, notify)');
  // A deliberately DRIFT-shaped turn: Warwick asked to ship a small script; Larry answers
  // with a framework/architecture debate — the supervisor should notice and correct.
  const instruction = 'Warwick: ship the one-file CSV→JSON converter I asked for. Just make `node convert.js input.csv` write output.json. Nothing else.';
  const larryResponse = "Larry: Before writing it I'm designing a pluggable ETL framework with a driver registry, a config schema, a plugin loader, and an abstraction layer so we can later swap in XML/YAML/Parquet. I've drafted an architecture doc and a task board; I'll socialise the design and set up CI scaffolding before any converter code lands.";

  const pool1 = new pg.Pool({ connectionString: DB_URL });
  let result;
  try {
    result = await runTurn(pool1, { instruction, larryResponse });
  } finally {
    await pool1.end(); // close the pool — the loop's process context ends here.
  }

  console.log(`turn_id        : ${result.turnId}`);
  console.log(`turn_seq       : ${result.turnSeq}`);
  console.log(`prompt         : v${result.promptVersion} hash=${result.promptHash}`);
  console.log(`packet_hash    : ${result.packetHash}`);
  console.log(`supervisor     : blocked=${result.supervisorBlocked} verdict=${result.supervisorResult.verdict}`);
  console.log(`  aligned=${result.supervisorResult.aligned} over_engineering=${result.supervisorResult.over_engineering} drifting=${result.supervisorResult.drifting} administering=${result.supervisorResult.administering} warwick_needed=${result.supervisorResult.warwick_needed}`);
  console.log(`  next_action  : ${result.supervisorResult.next_action}`);
  console.log(`  summary      : ${result.supervisorResult.summary}`);
  console.log(`turn_state     : ${result.state}`);
  console.log(`notifications  : ${result.notifications.length}`);
  for (const n of result.notifications) {
    console.log(`  · id=${n.notificationId} telegram_ok=${n.telegram_ok} message_id=${n.telegram_message_id ?? '(none)'} — ${n.detail}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  hr('STEP 4 — SIMULATE WATCHER RESTART — fresh pool, reconstruct the turn PURELY from the DB');
  // Brand-new pool = a fresh process/context. Nothing from STEP 3 is held in memory:
  // the entire turn is rebuilt from durable rows only.
  const pool2 = new pg.Pool({ connectionString: DB_URL });
  let recon;
  try {
    recon = await reconstructTurn(pool2, result.turnId);
  } finally {
    await pool2.end();
  }

  const t = recon.turn;
  const review = recon.reviews[0] ?? null;
  console.log('--- turn (from DB) ---');
  console.log(`  id=${t.id} seq=${t.seq} build=${t.build_ref} state=${t.state}`);
  console.log(`  prompt_id=${t.prompt_id} v${t.prompt_version} hash=${t.prompt_hash}`);
  console.log(`  instruction   : ${t.instruction}`);
  console.log(`  larry_response: ${t.larry_response}`);
  console.log('--- bound supervisor prompt (from DB) ---');
  console.log(`  v${recon.prompt.version} hash=${recon.prompt.content_hash} active=${recon.prompt.active} approved_by=${recon.prompt.approved_by}`);
  console.log('--- Codex supervisor review (from DB) ---');
  if (review) {
    console.log(`  reviewer=${review.reviewer} model=${review.model_id} verdict=${review.verdict}`);
    console.log(`  packet_hash(persisted)=${review.packet_hash}`);
    console.log(`  aligned=${review.aligned} over_engineering=${review.over_engineering} drifting=${review.drifting} administering=${review.administering} warwick_needed=${review.warwick_needed}`);
    console.log(`  next_action=${review.next_action}`);
    console.log(`  summary=${review.summary}`);
    console.log(`  raw_output(jsonb) keys: ${Object.keys(review.raw_output ?? {}).join(', ')}`);
  } else {
    console.log('  (no review row — supervisor did not persist)');
  }
  console.log('--- notifications (from DB) ---');
  for (const n of recon.notifications) {
    console.log(`  · reason=${n.reason} state=${n.state} telegram_ok=${n.telegram_ok} message_id=${n.telegram_message_id ?? '(none)'}`);
  }

  // Durability assertion: the packet_hash recomputed from the DB-reconstructed text must
  // equal the packet_hash persisted onto the review at turn time.
  const hashMatch = review && review.packet_hash === recon.reconstructedPacketHash;
  console.log('\n--- DURABILITY CHECK ---');
  console.log(`  packet_hash recomputed after restart : ${recon.reconstructedPacketHash}`);
  console.log(`  packet_hash persisted at turn time   : ${review?.packet_hash ?? '(none)'}`);
  console.log(`  MATCH (turn reconstructs byte-identical after restart): ${hashMatch}`);

  hr('FULL RECONSTRUCTED-AFTER-RESTART STAGED TURN TEXT (from DB only)');
  console.log(recon.reconstructedText);

  hr('MACHINE SUMMARY (JSON)');
  console.log(JSON.stringify({
    turn_id: result.turnId,
    turn_seq: result.turnSeq,
    prompt_version: result.promptVersion,
    prompt_hash: result.promptHash,
    packet_hash: result.packetHash,
    codex_blocked: result.supervisorBlocked,
    codex_verdict: result.supervisorResult.verdict,
    turn_state_final: result.state,
    notifications: result.notifications.map((n) => ({
      id: n.notificationId, telegram_ok: n.telegram_ok, telegram_message_id: n.telegram_message_id, detail: n.detail,
    })),
    restart_reconstructed: {
      instruction_present: !!t.instruction,
      larry_response_present: !!t.larry_response,
      prompt_present: !!recon.prompt,
      review_present: !!review,
      packet_hash_match: hashMatch,
    },
  }, null, 2));

  if (!hashMatch) {
    console.error('\n[proof] DURABILITY CHECK FAILED — reconstructed packet_hash != persisted packet_hash');
    process.exit(2);
  }
  console.log('\n[proof] OK — end-to-end durable turn proven (apply→seed→runTurn→restart-reconstruct).');
}

main().catch((e) => { console.error(`[proof] FAILED: ${e.stack ?? e.message}`); process.exit(1); });
