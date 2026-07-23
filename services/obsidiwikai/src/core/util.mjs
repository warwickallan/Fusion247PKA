export function slug(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'x';
}

// stable id for a canonical concept from its normalised name
export function conceptId(name) { return 'c-' + slug(name); }

export function nowIso() { return new Date().toISOString(); }
