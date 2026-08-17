// A disposable source tree, used where a proof must DAMAGE the sources it compiled from.
//
// ── WHY THIS EXISTS, AND IT IS NOT A CONVENIENCE ────────────────────────────────────────
// AC6 asks for a source to be broken and another deleted after a successful compile, so the
// existing pack can be shown to survive it. The obvious way to do that is to damage the real
// repository files a Route 1 seed drew on — and it is the wrong way twice over: it writes
// outside this Work Order's declared file surface, and it corrupts a working tree that a
// second worktree has checked out at the same commit.
//
// So the damage lands here instead: a real directory, holding real bytes copied from real
// repository records, handed to Phase 1's OWN Route 1 code as VLOGOPS_REPO_ROOT. The intake
// path is genuine, the files are genuine, the snapshots are genuine, and the destruction is
// confined to a temp directory the estate does not own. Nothing about the proof is weakened;
// only the blast radius is.
//
// This is deliberately NOT a fixture stand-in for the real thing. The AC1 compile runs
// against the real repository window, in a real CLI process. This tree exists for the two
// proofs that must destroy their inputs.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Create a scratch source tree.
 *
 * `files` maps a repo-relative path to its contents — either a string, or
 * `{ copyFrom: <absolute path> }` to take the real bytes of a real record.
 */
export function makeScratchTree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vlogops-scratch-'));

  for (const [rel, spec] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    if (typeof spec === 'string') {
      fs.writeFileSync(abs, spec);
    } else if (spec && typeof spec.copyFrom === 'string') {
      fs.copyFileSync(spec.copyFrom, abs);
    } else {
      throw new TypeError(`makeScratchTree: ${rel} needs a string or { copyFrom }`);
    }
  }

  return {
    root,
    abs: (rel) => path.join(root, rel),
    /** Corrupt a file in place — the same path, different bytes. */
    damage(rel) {
      const abs = path.join(root, rel);
      fs.writeFileSync(abs, 'THIS SOURCE HAS BEEN CORRUPTED AFTER THE PACK WAS COMPILED.\n');
      return abs;
    },
    /** Remove a file entirely — the source is simply gone. */
    remove(rel) {
      const abs = path.join(root, rel);
      fs.rmSync(abs);
      return abs;
    },
    cleanup() {
      try { fs.rmSync(root, { recursive: true, force: true }); } catch { /* best effort */ }
    },
  };
}
