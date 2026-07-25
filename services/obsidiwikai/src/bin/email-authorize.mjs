// One-time Microsoft Graph authorisation (device-code flow) for the dedicated Fusion247 mailbox.
// Run once. It prints a short code + URL; you sign in to warwickallan-f247@outlook.com and approve
// Mail.Read; the rotating refresh token is then persisted server-side (oauth_token) so the Hetzner
// poller runs forever with the Yoga off.
//   node --env-file=C:/.fusion247/msgraph.env --env-file=C:/.fusion247/obsidiwikai.env \
//     services/obsidiwikai/src/bin/email-authorize.mjs
import { startDeviceCode, pollDeviceCode, config } from '../clients/msgraph.mjs';
import { close } from '../clients/db.mjs';

if (!config.CLIENT_ID) { console.error('MS_GRAPH_CLIENT_ID not set (register a public client app first — see EMAIL-SETUP.md).'); process.exit(2); }
if (!process.env.DATABASE_URL) { console.error('DATABASE_URL not set — the refresh token persists in Supabase (obsidiwikai.oauth_token).'); process.exit(2); }

const dc = await startDeviceCode();
console.log('\n=== Authorise the Fusion247 mailbox ===');
console.log(`Mailbox : ${config.MAILBOX}   (tenant: ${config.TENANT}, scope: ${config.SCOPE})`);
console.log(`\n  1. Open: ${dc.verification_uri}`);
console.log(`  2. Enter code: ${dc.user_code}`);
console.log(`  3. Sign in as the Fusion247 mailbox account and approve Mail.Read.\n`);
console.log('Waiting for approval (up to ~15 min)…');

try {
  await pollDeviceCode(dc.device_code, dc.interval);
  console.log('\n✅ Authorised. Refresh token persisted (obsidiwikai.oauth_token). Next: run email-baseline.mjs once, then email-poll.mjs.');
} catch (e) {
  console.error('\n❌ authorisation failed:', e.message);
  process.exitCode = 1;
} finally {
  await close();
}
