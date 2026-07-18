import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertReadOnlyCommand } from '../src/githubEvidence.js';

const SERVICE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function allSourceFiles(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) out.push(...allSourceFiles(full));
    else if (/\.(js|ps1)$/.test(name)) out.push(full);
  }
  return out;
}

// The literal command shapes that would constitute an AUTONOMOUS MERGE / PUSH. None
// may appear anywhere in the shipped source (comments say "no merge"; none INVOKE one).
const FORBIDDEN_INVOCATIONS = ['gh pr merge', 'git push', 'push origin', 'git merge ', '--force'];

test('NO autonomous merge — no source file invokes a merge/push command', () => {
  const files = [...allSourceFiles(path.join(SERVICE_DIR, 'src')), ...allSourceFiles(path.join(SERVICE_DIR, 'bin')), ...allSourceFiles(path.join(SERVICE_DIR, 'scripts'))];
  const offenders = [];
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    for (const bad of FORBIDDEN_INVOCATIONS) {
      if (text.includes(bad)) offenders.push(`${path.basename(f)} contains "${bad}"`);
    }
  }
  assert.deepEqual(offenders, [], `autonomous-merge/push invocation found: ${offenders.join('; ')}`);
});

test('NO autonomous merge — the read-only guard refuses merge/push at runtime', () => {
  assert.throws(() => assertReadOnlyCommand('git', ['merge', 'main']), /REFUSED/);
  assert.throws(() => assertReadOnlyCommand('git', ['push']), /REFUSED/);
  assert.throws(() => assertReadOnlyCommand('gh', ['pr', 'merge']), /only "gh api"/);
});
