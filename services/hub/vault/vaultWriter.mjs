// BUILD-002 WP1 — VaultWriter: the ONE write authority for governed knowledge notes.
//
// The hub has exactly one note-writer abstraction with a pluggable adapter, so idempotency and
// provenance rules live in ONE place regardless of whether the production write goes through the
// Obsidian Local REST API or the filesystem (test/recovery). Rules enforced here (build order §11):
//   • DETERMINISTIC target path from a stable source id (e.g. youtube video id) — same source always
//     maps to the same note path, so a resumed/duplicate job can never create a second note.
//   • WRITE-ONCE by default: if the target already exists, writeNote() is a no-op that returns the
//     existing path (created:false). A resumed worker never double-writes; duplicate delivery is safe.
//   • Path is sanitised + confined to the vault root (no traversal, no escaping the governed vault).
//   • Returns an evidence pointer { path, relPath, created, adapter } the saga records before it marks
//     a job completed.
//
// Adapters implement: exists(rel) / read(rel) / write(rel, content) / list(subdir) / open(rel).
// The FsVaultAdapter is here; the Obsidian (Local REST API) adapter is added once WP1's plugin is up.

import fs from 'node:fs';
import path from 'node:path';

// Deterministic, filesystem-safe slug. Lowercased, ascii word chars + hyphen, collapsed, bounded.
export function slugify(s, max = 80) {
  const base = String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/g, '');
  return base || 'note';
}

// Confine a relative vault path to the root; reject traversal / absolute escapes.
function safeRel(root, rel) {
  const full = path.resolve(root, rel);
  const rootResolved = path.resolve(root);
  if (full !== rootResolved && !full.startsWith(rootResolved + path.sep)) {
    throw new Error(`VaultWriter: refusing to write outside the governed vault root: ${rel}`);
  }
  return full;
}

export class FsVaultAdapter {
  constructor(vaultRoot) { this.root = path.resolve(vaultRoot); }
  _abs(rel) { return safeRel(this.root, rel); }
  async exists(rel) { try { await fs.promises.access(this._abs(rel)); return true; } catch { return false; } }
  async read(rel) { return fs.promises.readFile(this._abs(rel), 'utf8'); }
  async write(rel, content) {
    const abs = this._abs(rel);
    await fs.promises.mkdir(path.dirname(abs), { recursive: true });
    await fs.promises.writeFile(abs, content, 'utf8');
  }
  async list(subdir = '') {
    const abs = this._abs(subdir);
    try { return (await fs.promises.readdir(abs)).filter((f) => f.endsWith('.md')); } catch { return []; }
  }
  // Filesystem has no "open in app" — a no-op that returns a stable file:// link.
  async open(rel) { return { opened: false, link: 'file:///' + this._abs(rel).replace(/\\/g, '/') }; }
  linkFor(rel) { return 'file:///' + this._abs(rel).replace(/\\/g, '/'); }
}

// Serialise a note: YAML-ish frontmatter (from a flat object) + body.
function renderNote(frontmatter, body) {
  const fm = Object.entries(frontmatter || {}).map(([k, v]) => {
    if (Array.isArray(v)) return `${k}:\n${v.map((x) => `  - ${x}`).join('\n')}`;
    return `${k}: ${typeof v === 'string' && /[:#]/.test(v) ? JSON.stringify(v) : v}`;
  }).join('\n');
  return `---\n${fm}\n---\n\n${body.replace(/\s*$/, '')}\n`;
}

export class VaultWriter {
  constructor(adapter, { subdir = 'Sources' } = {}) { this.adapter = adapter; this.subdir = subdir; }

  // Deterministic note path from a stable source id (+ short title for readability).
  notePath(sourceId, title) {
    const idSlug = slugify(sourceId, 40);
    const titleSlug = title ? '-' + slugify(title, 60) : '';
    return path.posix.join(this.subdir, `${idSlug}${titleSlug}.md`);
  }

  // Write-once idempotent note write. Returns an evidence pointer.
  async writeNote({ sourceId, title, frontmatter = {}, body }) {
    if (!sourceId) throw new Error('VaultWriter.writeNote requires a stable sourceId for idempotency');
    const rel = this.notePath(sourceId, title);
    if (await this.adapter.exists(rel)) {
      return { path: rel, relPath: rel, created: false, adapter: this.adapter.constructor.name, link: this.adapter.linkFor?.(rel) };
    }
    const content = renderNote({ source_id: sourceId, ...frontmatter }, body);
    await this.adapter.write(rel, content);
    return { path: rel, relPath: rel, created: true, adapter: this.adapter.constructor.name, link: this.adapter.linkFor?.(rel) };
  }
}
