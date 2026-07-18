#!/usr/bin/env node
// Tower baton — pre-flight health check (MASKED). The launcher runs this before
// starting the watcher; it loads config via the single runtimeConfig module and
// prints a masked summary. Exit 0 = ready, exit 1 = fail-closed (config incomplete).
//
// Never prints a secret value. Optional --telegram to run a masked getMe outbound
// self-test (GET, not getUpdates — no inbound poll).

import { loadRuntimeConfig, healthSummary, REQUIRED_FOR_WATCHER } from '../src/runtimeConfig.js';
import { createTelegramClient } from '../src/telegramNotifier.js';

async function main() {
  const wantTelegram = process.argv.includes('--telegram');
  const summary = healthSummary({ required: REQUIRED_FOR_WATCHER });

  // Masked report only.
  console.log('[TOWER preflight] secret store:', summary.store, summary.storeExists ? '(present)' : '(MISSING)');
  console.log('[TOWER preflight] required secrets (by NAME, masked):');
  for (const [name, present] of Object.entries(summary.required)) {
    console.log(`  - ${name}: ${present ? 'present' : 'MISSING'}`);
  }
  if (summary.describe) console.log('[TOWER preflight] config:', JSON.stringify(summary.describe));

  const loaded = loadRuntimeConfig({ required: REQUIRED_FOR_WATCHER });
  if (!loaded.ok) {
    console.error('[TOWER preflight] FAIL-CLOSED:', loaded.error);
    process.exit(1);
  }

  if (wantTelegram) {
    const client = createTelegramClient({ config: loaded.config });
    const res = await client.verifyOutbound();
    console.log('[TOWER preflight] telegram outbound (getMe, masked):', res.ok ? `ok (botId ${res.botId})` : `FAILED: ${res.error}`);
    if (!res.ok) process.exit(1);
  }

  console.log('[TOWER preflight] READY');
  process.exit(0);
}

main().catch((e) => { console.error('[TOWER preflight] unexpected error:', String(e?.message ?? e)); process.exit(1); });
