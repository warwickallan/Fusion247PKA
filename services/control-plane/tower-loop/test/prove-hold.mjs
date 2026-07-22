// BUILD-014 Tower — durable-hold acceptance proof (run against Tower DEV or a throwaway).
import fs from 'node:fs';
import pg from 'file:///C:/Fusion247PKA/services/control-plane/node_modules/pg/lib/index.js';
import { holdTurn, releaseTurn } from '../hold.mjs';
const env=fs.readFileSync('C:/.fusion247/control-plane-dev.env','utf8');const url=env.split(/\r?\n/).find(l=>l.startsWith('CONTROL_PLANE_DEV_DATABASE_URL=')).slice('CONTROL_PLANE_DEV_DATABASE_URL='.length).trim();
const db=new pg.Client({connectionString:url,ssl:{rejectUnauthorized:false}});await db.connect();
let pass=0,fail=0;const ok=(c,m)=>{c?(pass++,console.log('  PASS',m)):(fail++,console.log('  FAIL',m));};
const KEY='holdtest-'+Date.now();
let fixtureId;
try{
  // fixture turn (clearly a test row; deleted at end)
  fixtureId=(await db.query(`insert into tower.turn (build_ref,instruction,larry_response,state,session_turn_key) values ('BUILD-999-HOLDTEST','hold fixture','x','pending',$1) returning id`,[KEY])).rows[0].id;

  console.log('1) held rows survive reclaimStale:');
  const heldBefore=(await db.query(`select count(*)::int n from tower.turn where state='held'`)).rows[0].n;
  await db.query(`update tower.turn set state='pending',lease_owner=null,lease_deadline_at=null,updated_at=now() where state='claimed' and lease_deadline_at is not null and lease_deadline_at<now()`); // exact reclaimStale SQL
  const heldAfter=(await db.query(`select count(*)::int n from tower.turn where state='held'`)).rows[0].n;
  ok(heldBefore===25 && heldAfter===25 || (heldBefore===heldAfter && heldBefore>=24), `held count unchanged by reclaimStale (${heldBefore}->${heldAfter})`);

  console.log('2) held rows are skipped by the normal claim:');
  await holdTurn(db,fixtureId,{heldBy:'HOLDTEST',reason:'proof'});
  ok((await db.query(`select state from tower.turn where id=$1`,[fixtureId])).rows[0].state==='held','fixture is held');
  const claim=await db.query(`update tower.turn t set state='claimed',lease_owner='HOLDTEST_CLAIM',lease_deadline_at=now()+make_interval(secs=>30),updated_at=now() from (select id from tower.turn where state='pending' order by seq for update skip locked limit 1) s where t.id=s.id returning t.id`); // exact claimOne SQL
  ok(claim.rowCount===0 || String(claim.rows[0]?.id)!==String(fixtureId),'claim did NOT pick the held fixture');
  // undo any incidental claim of another row
  if(claim.rowCount>0) await db.query(`update tower.turn set state='pending',lease_owner=null,lease_deadline_at=null where id=$1 and lease_owner='HOLDTEST_CLAIM'`,[claim.rows[0].id]);

  console.log('3) an explicitly RELEASED row becomes claimable:');
  const released=await releaseTurn(db,fixtureId);
  ok(released && (await db.query(`select state from tower.turn where id=$1`,[fixtureId])).rows[0].state==='pending','release -> pending');
  ok((await releaseTurn(db,fixtureId))===false,'releasing a non-held row is idempotent (no-op)');
  const claim2=await db.query(`update tower.turn set state='claimed',lease_owner='HOLDTEST_CLAIM2',lease_deadline_at=now()+make_interval(secs=>30) where id=$1 and state='pending' returning id`,[fixtureId]);
  ok(claim2.rowCount===1,'the released fixture is now claimable');

  console.log('4) the 24 historical held rows remain unreviewed + unnotified:');
  const hist=(await db.query(`select array_agg(id) ids from tower.turn where state='held' and held_by='WARWICK_RECOVERY_2026-07-23'`)).rows[0].ids;
  ok(hist && hist.length===24,'still 24 historical held');
  ok((await db.query(`select count(*)::int n from tower.supervisor_review where turn_id=any($1::uuid[])`,[hist])).rows[0].n===0,'0 reviews on the 24');
  ok((await db.query(`select count(*)::int n from tower.notification where turn_id=any($1::uuid[])`,[hist])).rows[0].n===0,'0 notifications on the 24');
}finally{
  if(fixtureId) await db.query(`delete from tower.turn where id=$1`,[fixtureId]); // test fixture only (NOT a historical row)
}
console.log(`\nRESULT: ${fail===0?'PASS':'FAIL'} — ${pass} passed, ${fail} failed`);
await db.end();process.exit(fail===0?0:1);
