// Tower baton — ClickUp adapter (governed read + ADDITIVE write).
//
// Uses CLICKUP_TOKEN (secret-home, via config) to:
//   · getTaskComments(taskId)     — poll a control task's comments (the thread).
//   · createTaskComment(taskId, b)— post the [TOWER -> LARRY] reply as a NEW comment.
//
// ADDITIVE ONLY: the Tower posts NEW comments; it NEVER edits, replaces, or deletes
// an existing comment/page. FAIL-CLOSED: absent CLICKUP_TOKEN → every call rejects
// with a clear "CLICKUP_TOKEN missing" blocker (the client is never constructed
// live without a token). The token travels ONLY in the Authorization header to
// api.clickup.com; it is NEVER logged, stored, or placed in a comment body.
//
// The real client is a thin fetch wrapper. Tests inject a FAKE (createFakeClickup)
// — no live ClickUp call is ever made in a unit test.

const CLICKUP_API = 'https://api.clickup.com/api/v2';

/** Throw a fail-closed blocker when the ClickUp token is absent. */
function assertToken(token) {
  if (!token) {
    throw new Error('CLICKUP_TOKEN missing — ClickUp read/write is fail-closed (no live call attempted).');
  }
}

/**
 * Create the REAL ClickUp client. `config.clickupToken` owns the credential.
 * `fetchImpl` is injectable (defaults to global fetch). No token → the client is
 * still returned but `ready=false` and every call fails closed with the blocker.
 */
export function createClickupClient({ config, fetchImpl } = {}) {
  const token = config?.clickupToken ?? null; // SECRET — never logged
  const doFetch = fetchImpl ?? (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null);

  async function call(method, url, body) {
    assertToken(token);
    if (!doFetch) throw new Error('clickupClient: no fetch implementation available');
    let res;
    try {
      res = await doFetch(url, {
        method,
        headers: { Authorization: token, 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      // Never let the token surface in a transport error (defence-in-depth).
      throw new Error(`clickupClient: ${method} transport error: ${config?.redact ? config.redact(err?.message ?? String(err)) : (err?.message ?? String(err))}`);
    }
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok) {
      const desc = config?.redact ? config.redact(data?.err ?? `http ${res.status}`) : (data?.err ?? `http ${res.status}`);
      throw new Error(`clickupClient: ${method} ${url.replace(CLICKUP_API, '')} rejected: ${desc}`);
    }
    return data;
  }

  return {
    get ready() { return Boolean(token); },

    /** Poll a task's comments (oldest→newest). Returns [{ id, comment_text, date, user }]. */
    async getTaskComments(taskId) {
      const data = await call('GET', `${CLICKUP_API}/task/${encodeURIComponent(taskId)}/comment`);
      const comments = Array.isArray(data?.comments) ? data.comments : [];
      // Normalise + present oldest-first for deterministic thread scans.
      return comments
        .map((c) => ({ id: String(c.id ?? ''), comment_text: c.comment_text ?? c.text ?? '', date: c.date ?? null, user: c.user?.id ?? null }))
        .sort((a, b) => Number(a.date ?? 0) - Number(b.date ?? 0));
    },

    /** Post a NEW comment (additive). Returns { id }. Never edits an existing comment. */
    async createTaskComment(taskId, body) {
      const data = await call('POST', `${CLICKUP_API}/task/${encodeURIComponent(taskId)}/comment`, {
        comment_text: String(body ?? ''),
        notify_all: false,
      });
      return { id: String(data?.id ?? data?.comment?.id ?? '') };
    },
  };
}

/**
 * Injectable in-memory FAKE for tests. Seed with initial comments; records posts as
 * new comments (additive). No network. Optionally make a method throw to exercise
 * fail-closed / timeout paths.
 */
export function createFakeClickup({ comments = [], ready = true, failOnPost = false, failOnRead = false } = {}) {
  let seq = comments.length;
  const store = comments.map((c, i) => ({
    id: String(c.id ?? `seed-${i}`),
    comment_text: c.comment_text ?? c.text ?? '',
    date: c.date ?? String(1000 + i),
    user: c.user ?? 'larry',
  }));
  return {
    get ready() { return ready; },
    _comments: store,
    async getTaskComments() {
      if (failOnRead) throw new Error('fake clickup: read failure (injected)');
      if (!ready) throw new Error('CLICKUP_TOKEN missing — ClickUp read/write is fail-closed (no live call attempted).');
      return store.map((c) => ({ ...c })).sort((a, b) => Number(a.date ?? 0) - Number(b.date ?? 0));
    },
    async createTaskComment(taskId, body) {
      if (failOnPost) throw new Error('fake clickup: post failure (injected)');
      if (!ready) throw new Error('CLICKUP_TOKEN missing — ClickUp read/write is fail-closed (no live call attempted).');
      seq += 1;
      const id = `posted-${seq}`;
      store.push({ id, comment_text: String(body ?? ''), date: String(10_000 + seq), user: 'tower' });
      return { id };
    },
  };
}
