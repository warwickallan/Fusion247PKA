#!/usr/bin/env node
/**
 * Windows-safe entrypoint for the tower-loop watcher launcher.
 * Always invokes main() — does not rely on import.meta/argv path equality
 * (a Windows path casing/URL form trap in run-watcher.mjs isMainModule).
 *
 * Usage (installed runtime):
 *   set TOWER_NOTIFY_TRANSPORT=none   # or supply Telegram env via --env-file
 *   node path/to/tower-loop/start-watcher.mjs
 */
import { main } from './run-watcher.mjs';

main();
