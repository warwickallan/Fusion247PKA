#!/usr/bin/env node
// One-shot probe: installed as a Claude Code `statusLine` command to observe the real
// stdin payload. Reads stdin to EOF, writes it verbatim to a file via temp+rename so a
// killed mid-write (statusLine invocations are debounced 300ms and can be cancelled)
// never leaves a torn/partial file behind. Prints one short line to stdout, since
// statusLine renders stdout directly.
//
// Usage: node capture-statusline.mjs [outPath]
// outPath defaults to <os tmpdir>/claude-statusline-capture.json

import { writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import os from 'node:os';

const outPath = process.argv[2] || join(os.tmpdir(), 'claude-statusline-capture.json');

let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  data += chunk;
});
process.stdin.on('end', () => {
  try {
    mkdirSync(dirname(outPath), { recursive: true });
    const tmpPath = `${outPath}.tmp`;
    writeFileSync(tmpPath, data);
    renameSync(tmpPath, outPath);
  } catch {
    // A statusLine command must never surface a failure to the UI.
  }
  process.stdout.write('capture: ok');
});
