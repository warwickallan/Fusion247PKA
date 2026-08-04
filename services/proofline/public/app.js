// Proofline UI — plain ES modules, no framework, no build step.
//
// Every request below targets a RELATIVE same-origin `/api/...` path. There is
// no absolute URL anywhere in this file and no third-party origin: the page
// talks to the loopback service that served it, and to nothing else.
//
// It posts `application/json` so newlines survive transit unchanged (map §5.1)
// — a form-encoded post would rewrite them and change the digest.

const $ = (id) => document.getElementById(id);

const POLL_MS = 1000;
const TEXT_LIMIT = 1048576;

let selectedKey = null;
let lastListSignature = '';

// --- helpers ---------------------------------------------------------------

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, ok: res.ok, json };
}

function notice(el, message, kind = '') {
  el.textContent = message;
  el.className = kind ? `notice ${kind}` : 'notice';
}

function stateLabel(state) {
  return state.replace(/_/g, ' ');
}

function shortTime(iso) {
  if (!iso) return '—';
  return iso.replace('T', ' ').replace('Z', '').slice(0, 23);
}

// --- health ----------------------------------------------------------------

async function refreshHealth() {
  const { ok, json } = await api('/api/health');
  if (!ok || !json) return;
  $('health-epoch').textContent = String(json.epoch);
  $('health-awaiting').textContent = String(json.counts.awaiting_approval);
  $('health-total').textContent = String(json.counts.total);
}

// --- job list --------------------------------------------------------------

function renderList(jobs) {
  const signature = JSON.stringify(jobs.map((j) => [j.key, j.state, j.attempts, j.resultSha256]));
  if (signature === lastListSignature) return;
  lastListSignature = signature;

  const list = $('joblist');
  list.replaceChildren();
  $('jobs-empty').hidden = jobs.length > 0;

  for (const job of jobs) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'jobitem';
    btn.setAttribute('aria-current', String(job.key === selectedKey));

    const row = document.createElement('span');
    row.className = 'k';
    row.textContent = job.key;

    const state = document.createElement('span');
    state.className = 'state';
    state.dataset.state = job.state;
    state.textContent = stateLabel(job.state);

    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = `${job.textLength} bytes · attempt ${job.attempts} · ${shortTime(job.submittedAt)}`;

    const head = document.createElement('span');
    head.style.display = 'flex';
    head.style.justifyContent = 'space-between';
    head.style.gap = '8px';
    head.style.alignItems = 'center';
    head.append(row, state);

    btn.append(head, meta);
    btn.addEventListener('click', () => {
      selectedKey = job.key;
      lastListSignature = '';
      refresh();
    });

    li.append(btn);
    list.append(li);
  }
}

// --- detail ----------------------------------------------------------------

function renderTimeline(timeline) {
  const ol = $('timeline');
  ol.replaceChildren();
  for (const entry of timeline) {
    const li = document.createElement('li');

    const t = document.createElement('div');
    t.className = 'tl-t';
    t.textContent = entry.t;

    const at = document.createElement('div');
    at.className = 'tl-at';
    at.textContent = shortTime(entry.at);

    li.append(t, at);

    const extras = [];
    if (entry.attempts !== undefined) extras.push(`attempt ${entry.attempts}`);
    if (entry.epoch !== undefined) extras.push(`epoch ${entry.epoch}`);
    if (entry.reason) extras.push(entry.reason);
    if (entry.note) extras.push(`note: ${entry.note}`);
    if (extras.length > 0) {
      const ex = document.createElement('div');
      ex.className = 'tl-extra';
      ex.textContent = extras.join(' · ');
      li.append(ex);
    }

    ol.append(li);
  }
}

const COUNT_FIELDS = [
  ['chars', 'Characters'],
  ['charsNoWhitespace', 'Non-whitespace'],
  ['words', 'Words'],
  ['uniqueWords', 'Unique words'],
  ['lines', 'Lines'],
  ['sentences', 'Sentences'],
  ['paragraphs', 'Paragraphs'],
  ['avgWordLengthMilli', 'Avg word length (×1000)'],
  ['readingTimeSeconds', 'Reading time (s)'],
];

function renderResult(job) {
  const hasResult = job.result !== null;
  $('result-empty').hidden = hasResult;
  $('result').hidden = !hasResult;
  if (!hasResult) return;

  $('result-sha').textContent = job.resultSha256;

  const dl = $('result-counts');
  dl.replaceChildren();
  for (const [field, label] of COUNT_FIELDS) {
    const wrap = document.createElement('div');
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = String(job.result[field]);
    wrap.append(dt, dd);
    dl.append(wrap);
  }

  const longest = document.createElement('div');
  const ldt = document.createElement('dt');
  ldt.textContent = 'Longest line';
  const ldd = document.createElement('dd');
  ldd.textContent = `line ${job.result.longestLine.index + 1} · ${job.result.longestLine.length} chars`;
  longest.append(ldt, ldd);
  dl.append(longest);

  const terms = $('result-terms');
  terms.replaceChildren();
  for (const { term, count } of job.result.topTerms) {
    const li = document.createElement('li');
    const code = document.createElement('code');
    code.textContent = term;
    li.append(code, document.createTextNode(` — ${count}`));
    terms.append(li);
  }
}

function renderDetail(job) {
  $('detail-empty').hidden = true;
  $('detail').hidden = false;

  $('detail-key').textContent = job.key;
  const state = $('detail-state');
  state.dataset.state = job.state;
  state.textContent = stateLabel(job.state);

  $('decision').hidden = job.state !== 'awaiting_approval';

  renderTimeline(job.timeline);
  renderResult(job);

  $('detail-textsha').textContent = job.textSha256;
  $('detail-text').textContent = job.text;
}

// --- polling ---------------------------------------------------------------

async function refresh() {
  await refreshHealth();

  const listRes = await api('/api/jobs');
  if (listRes.ok && listRes.json) renderList(listRes.json.jobs);

  if (selectedKey === null) return;
  const detailRes = await api(`/api/jobs/${encodeURIComponent(selectedKey)}`);
  if (detailRes.status === 404) {
    selectedKey = null;
    $('detail').hidden = true;
    $('detail-empty').hidden = false;
    return;
  }
  if (detailRes.ok && detailRes.json) renderDetail(detailRes.json.job);
}

// --- events ----------------------------------------------------------------

$('text').addEventListener('input', (e) => {
  const bytes = new TextEncoder().encode(e.target.value).length;
  $('text-size').textContent = bytes.toLocaleString('en-GB');
  $('submit-btn').disabled = bytes > TEXT_LIMIT;
});

$('submit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const key = $('key').value.trim();
  const text = $('text').value;
  const out = $('submit-notice');

  if (key === '') {
    notice(out, 'A key is required.', 'err');
    return;
  }

  $('submit-btn').disabled = true;
  try {
    const { status, json } = await api('/api/jobs', { method: 'POST', body: { key, text } });

    if (status === 201) {
      notice(out, `Queued. The response came back before any processing started — state "${json.job.state}", result null.`, 'ok');
      selectedKey = key;
      lastListSignature = '';
    } else if (status === 200 && json.duplicate) {
      selectedKey = key;
      lastListSignature = '';
      if (json.textMatches) {
        notice(out, 'This key already exists with exactly this text. No second job was created.', 'warn');
      } else {
        notice(out, 'This key already exists — THE TEXT YOU JUST SUBMITTED WAS NOT STORED. Use a different key.', 'err');
      }
    } else {
      notice(out, `${json?.error ?? 'Submit failed'}${json?.detail ? ` — ${json.detail}` : ''}`, 'err');
    }
  } catch (err) {
    notice(out, `Could not reach the service: ${err.message}`, 'err');
  } finally {
    $('submit-btn').disabled = false;
    await refresh();
  }
});

async function decide(decision) {
  const out = $('decision-notice');
  const note = $('decision-note').value.trim();
  const { status, json } = await api(`/api/jobs/${encodeURIComponent(selectedKey)}/${decision}`, {
    method: 'POST',
    body: note === '' ? {} : { note },
  });
  if (status === 200) {
    notice(out, `Saved to the journal as "${json.job.state}". It survives a restart.`, 'ok');
    $('decision-note').value = '';
  } else {
    notice(out, `${json?.error ?? 'Failed'}${json?.detail ? ` — ${json.detail}` : ''}`, 'err');
  }
  lastListSignature = '';
  await refresh();
}

$('approve-btn').addEventListener('click', () => decide('approve'));
$('reject-btn').addEventListener('click', () => decide('reject'));

// --- go --------------------------------------------------------------------

refresh();
setInterval(refresh, POLL_MS);
