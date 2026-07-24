// Prove the Honcho write->read round-trip (the WP2 outbox core + WP3 lens source).
import { honcho, PEER_WARWICK, SESSION_CONTEXT } from '../clients/honcho.mjs';

async function main() {
  console.log('workspace:', honcho.workspace);
  await honcho.ensureWorkspace(); console.log('✓ workspace');
  await honcho.ensurePeer(PEER_WARWICK); console.log('✓ peer', PEER_WARWICK);
  await honcho.ensureSession(SESSION_CONTEXT, [PEER_WARWICK]); console.log('✓ session', SESSION_CONTEXT);

  const pref = 'Warwick prefers visual routing maps but does not want to configure n8n himself.';
  const r = await honcho.addMessage(SESSION_CONTEXT, PEER_WARWICK, pref, { source: 'obsidiwikai-honcho-test', type: 'preference' });
  console.log('✓ message written:', JSON.stringify(r).slice(0, 200));

  // read back (dialectic). Honcho processes async so this may lag on a cold peer.
  const q = 'What are Warwick\'s preferences about visual routing and n8n?';
  const ans = await honcho.chat(PEER_WARWICK, q);
  console.log('\nchat query:', q);
  console.log('chat answer:', JSON.stringify(ans).slice(0, 600));
}
main().then(() => process.exit(0)).catch((e) => { console.error('HONCHO TEST FAILED:', e.message); process.exit(1); });
