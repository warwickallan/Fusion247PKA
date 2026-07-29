/* Fusion247 Cockpit — the Warwick-facing surface. Reads /api/state (the spine, via cp_directus),
   files decisions to /api/decide (governed intents + surface lifecycle). Depth ladder, Life/Build
   lanes, decision lifecycle (accept/decline/defer + Archive + Later), readable outputs. No build step. */
const { createApp, ref, computed, onMounted, nextTick } = Vue;

const REPORT = 'http://100.101.240.85:8701';
const GRAPH = 'http://100.101.240.85:8700';
const AREAS = [
  { key: 'home', label: 'Home', icon: '🏠' },
  { key: 'apps', label: 'Apps', icon: '🧩' },
  { key: 'ideas', label: 'Ideas', icon: '💡' },
  { key: 'brain', label: 'Brain', icon: '🧠' },
  { key: 'outputs', label: 'Outputs', icon: '📤' },
  { key: 'system', label: 'System', icon: '🛠' },
];
// Apps = the things Fusion RUNS for Warwick, each with its own workspace. The registry is the SSOT
// (public/apps.js) — adding an app is one entry there, never an edit in three places in this file.
/** @type {ReadonlyArray<{key:string,label:string,desc:string,icon:string,tone:string,probe:boolean,views:ReadonlyArray<{key:string,label:string,blurb:string}>,about:ReadonlyArray<string>,offline:string}>} */
const APPS = (typeof window !== 'undefined' && Array.isArray(window.FUSION_APPS)) ? window.FUSION_APPS : [];
// How a ROW's source_module prints, and which Home lane it sits in, comes from the same registry.
// Deliberately NOT a map in this file: a hardcoded list is a second place every module has to be
// named, and this file is the public one. Unregistered keys fall back to the raw key — honest, and
// it means a module the public tree does not know about still renders rather than vanishing.
//
// INTENDED DEGRADATION, recorded so nobody "fixes" it back. This change removed a module key from
// the public registry along with its label and its lane. Rows carrying that key therefore now print
// the RAW KEY and sit in the Build lane, where they used to print a proper name and sit in Life.
// That is not a regression to repair by re-adding the entry — the entry is what the overlay exists
// to hold. Restoring the label and the lane is done by supplying an overlay entry for that key
// (see services/cockpit/private-apps.mjs), never by putting it back in the list below.
// Consequence worth stating plainly: with no overlay loaded, the surface is not byte-identical to
// the previous build wherever such rows exist. It is identical everywhere else.
/** @type {Readonly<Record<string,{label:string,lane:'life'|'build'}>>} */
const MODULE = (typeof window !== 'undefined' && window.FUSION_MODULES) ? window.FUSION_MODULES : Object.create(null);

const kindOf = (it) => it.kind || 'suggestion';
const catLabel = (it) => ({ blocked: 'Blocked by you', decision: 'Decision', suggestion: 'Suggestion' }[kindOf(it)] || 'Output');
const moduleLabel = (m) => { const r = MODULE[m]; return (r && r.label) || m || ''; };
const oneLine = (t) => { if (!t) return ''; const s = String(t).split('\n')[0]; return s.length > 130 ? s.slice(0, 127) + '…' : s; };
const ago = (ts) => { if (!ts) return ''; const d = (Date.now() - new Date(ts).getTime()) / 60000; if (d < 60) return `${Math.max(1, Math.round(d))}m`; if (d < 1440) return `${Math.round(d / 60)}h`; return `${Math.round(d / 1440)}d`; };

// Outputs must read as human products, never raw JSON. Pull a sentence out of known shapes; if it's
// machine detail we can't humanise, return null so the card falls back to its title and the JSON is
// buried in L4 Technical only.
function humanValue(v) {
  if (!v) return '';
  const s = String(v).trim();
  if (s.startsWith('{') || s.startsWith('[')) {
    try {
      const j = JSON.parse(s);
      if (Array.isArray(j.relevant)) { const w = j.relevant.map((r) => r && r.why).filter(Boolean); if (w.length) return w.join(' · '); }
      if (j.why_it_matters) return j.why_it_matters;
      if (j.why) return j.why; if (j.summary) return j.summary; if (j.so_what) return j.so_what;
    } catch (e) { /* fall through */ }
    return null;
  }
  return s;
}
// Hybrid readable outputs: the "so what" points rendered in-app as a list; the full deep read stays a link.
function humanPoints(v) {
  if (!v) return [];
  const s = String(v).trim();
  if (s.startsWith('{') || s.startsWith('[')) {
    try { const j = JSON.parse(s); if (Array.isArray(j.relevant)) return j.relevant.map((r) => r && r.why).filter(Boolean); } catch (e) { /* not our shape */ }
  }
  return [];
}
// Minimal, safe markdown → HTML for reading deliverables/docs inside the app (escape first, then format;
// content is first-party so this is sufficient). Handles headings, bold, code, lists, quotes, links.
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function mdToHtml(md) {
  const inline = (t) => t
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  let html = '', inList = false, inCode = false;
  for (const raw of esc(md || '').split(/\r?\n/)) {
    if (/^```/.test(raw)) { if (inCode) { html += '</pre>'; inCode = false; } else { if (inList) { html += '</ul>'; inList = false; } html += '<pre>'; inCode = true; } continue; }
    if (inCode) { html += raw + '\n'; continue; }
    if (/^\s*[-*]\s+/.test(raw)) { if (!inList) { html += '<ul>'; inList = true; } html += '<li>' + inline(raw.replace(/^\s*[-*]\s+/, '')) + '</li>'; continue; }
    if (inList) { html += '</ul>'; inList = false; }
    const h = raw.match(/^(#{1,4})\s+(.*)$/);
    if (h) { const n = h[1].length; html += `<h${n}>${inline(h[2])}</h${n}>`; continue; }
    if (/^\s*>/.test(raw)) { html += '<blockquote>' + inline(raw.replace(/^\s*>\s?/, '')) + '</blockquote>'; continue; }
    if (raw.trim() === '') continue;
    html += '<p>' + inline(raw) + '</p>';
  }
  if (inList) html += '</ul>'; if (inCode) html += '</pre>';
  return html;
}
// SPIN detail for an idea — rendered if the generator has emitted structured fields; else fall back to the plain reason.
function spinOf(it) {
  const r = it && it.reason;
  if (!r) return null;
  const s = String(r).trim();
  if (s.startsWith('{')) {
    try { const j = JSON.parse(s); if (j.situation || j.problem || j.implication || j.payoff) return { s: j.situation, p: j.problem, i: j.implication, payoff: j.payoff }; } catch (e) { /* not SPIN */ }
  }
  return null;
}
// Collapse duplicate projections of the same source into one card (belt-and-braces to the projector fix).
function dedupe(list) {
  const seen = new Map();
  for (const o of list) { const k = (o.source_module || '') + '|' + (o.provenance_ref || o.source_key || o.title); if (!seen.has(k)) seen.set(k, o); }
  return [...seen.values()];
}
const notifyMark = (p) => (p === 'immediate' ? '🔔' : p === 'selective' ? '' : '');
// Keep list cards terse — full prose lives behind the click (depth-ladder rule).
const terse = (t, n = 66) => { const s = String(t || '').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const impactStars = (p) => ({ high: '★★★', medium: '★★', low: '★' }[p] || '★★');
function humanizeSlug(s) {
  const parts = String(s || '').split(/[-_]/).filter(Boolean);
  if (parts.length > 1) { const last = parts[parts.length - 1]; if ((/[A-Z]/.test(last) && /[a-z0-9]/.test(last)) || (/[0-9]/.test(last) && last.length >= 4)) parts.pop(); }
  return parts.join(' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
// Human output title — no machine slugs/IDs in the primary UI.
function outputTitle(o) {
  let t = String(o.title || '').replace(/^so what\s*[—-]\s*/i, '').trim();
  if (t && !/\s/.test(t) && /[-_]/.test(t)) t = humanizeSlug(t);
  return t || 'Insight';
}

createApp({
  setup() {
    const state = ref({ attention: [], outputs: [], archived: [], ingested: [], ingestedCount: 0, wins: [], builds: [] });
    const area = ref('home');
    const detail = ref(null);
    const busy = ref(false);
    const loading = ref(true);
    const loadErr = ref(false);

    // Fetch state with retry — a transient failure (e.g. a service-worker update mid-session) must not
    // strand the app on empty state forever. Retries a few times, then shows a visible retry banner.
    async function load(attempt = 1) {
      loading.value = true;
      try {
        const r = await fetch('/api/state', { cache: 'no-store' });
        if (!r.ok) throw new Error('http ' + r.status);
        state.value = await r.json();
        loadErr.value = false; loading.value = false;
      } catch (e) {
        if (attempt < 4) { setTimeout(() => load(attempt + 1), 700 * attempt); return; }
        loadErr.value = true; loading.value = false; // keep last state; banner offers a manual retry
      }
    }
    onMounted(() => load());

    const attn = computed(() => state.value.attention || []);
    const activeAttn = computed(() => attn.value.filter((i) => i.status !== 'deferred'));
    const deferred = computed(() => attn.value.filter((i) => i.status === 'deferred'));
    const blocked = computed(() => activeAttn.value.filter((i) => kindOf(i) === 'blocked'));
    const decisions = computed(() => activeAttn.value.filter((i) => kindOf(i) === 'decision'));
    const suggestions = computed(() => activeAttn.value.filter((i) => kindOf(i) === 'suggestion'));
    // Genuine "needs you" (blockers + decisions) — pinned to the top of Home.
    const needsYou = computed(() => activeAttn.value.filter((i) => kindOf(i) === 'blocked' || kindOf(i) === 'decision'));
    // Ideas = suggestions, split Brain (improve F247) vs Cash (make money). Category from a forward-compatible signal.
    const ideaCat = (it) => ((/cash/i.test(it.source_type || '') || /💰/.test(it.title || '')) ? 'cash' : 'brain');
    const ideasBrain = computed(() => suggestions.value.filter((i) => ideaCat(i) === 'brain'));
    const ideasCash = computed(() => suggestions.value.filter((i) => ideaCat(i) === 'cash'));
    // Transfer-Intelligence candidates (SPIN-first). Highest Impact first.
    const tiIdeas = computed(() => state.value.ideas || []);
    const tiBrain = computed(() => tiIdeas.value.filter((i) => i.category === 'brain'));
    const tiCash = computed(() => tiIdeas.value.filter((i) => i.category === 'cash'));
    const tiSpin = (it) => (it && it.spin && typeof it.spin === 'object' ? it.spin : {});
    const tiStars = (it) => '★'.repeat(Math.max(1, Math.min(5, Number((it.nvfi || {}).impact) || 3)));

    // Life vs Build is a registry field (public/apps.js), not a set here. Anything unregistered is
    // Build — the lane that says "Fusion is working on it", which is the safe default for a row
    // whose producer this tree has never heard of.
    const laneOf = (it) => ((MODULE[it.source_module] || {}).lane === 'life' ? 'life' : 'build');
    const toneOf = (it) => ({ blocked: 'red', decision: 'amber', suggestion: 'blue' }[kindOf(it)] || 'blue');
    const kRank = { blocked: 0, decision: 1, suggestion: 2 };
    const byKind = (a, b) => (kRank[kindOf(a)] ?? 9) - (kRank[kindOf(b)] ?? 9);
    const lifeAttn = computed(() => activeAttn.value.filter((i) => kindOf(i) !== 'blocked' && laneOf(i) === 'life').sort(byKind));
    const buildAttn = computed(() => activeAttn.value.filter((i) => kindOf(i) !== 'blocked' && laneOf(i) === 'build').sort(byKind));

    const archived = computed(() => state.value.archived || []);
    const build = computed(() => state.value.build || { version: '?', sha: '?', startedAt: null });
    const housekeeping = computed(() => state.value.housekeeping || 0);
    const host = (typeof window !== 'undefined' && window.location) ? window.location.host : '';
    const when = (ts) => (ts ? new Date(ts).toLocaleString('en-GB') : '—');
    const outputs = computed(() => dedupe(state.value.outputs || []));
    const newOutputs = computed(() => outputs.value.filter((o) => (o.status || 'new') === 'new').length);
    const itemsAdded = computed(() => outputs.value
      .filter((o) => o.source_module === 'shopping' && o.source_type === 'items_added')
      .reduce((n, o) => { const m = String(o.title || '').match(/^\s*(\d+)/); return n + (m ? Number(m[1]) : 1); }, 0));
    const wins = computed(() => state.value.wins || []);
    const builds = computed(() => state.value.builds || []);
    // Latest = a merged, time-sorted feed of recent activity (under the Home tiles).
    const latest = computed(() => {
      const rows = [];
      for (const o of outputs.value) rows.push({ t: o.produced_at, label: outputTitle(o), kind: 'Output', area: 'outputs' });
      for (const s of (state.value.ingested || [])) rows.push({ t: s.updated_at, label: s.title || s.video_id, kind: 'Ingested', area: 'brain' });
      for (const w of wins.value) rows.push({ t: w.happened_at, label: w.text, kind: 'Win', area: 'system' });
      return rows.filter((x) => x.t && x.label).sort((a, b) => new Date(b.t) - new Date(a.t)).slice(0, 8);
    });

    const blockedN = computed(() => blocked.value.length);
    const statusTone = computed(() => (blockedN.value ? 'red' : 'green'));
    const statusLine = computed(() => (blockedN.value ? `Blocked by you — ${blockedN.value} thing${blockedN.value > 1 ? 's' : ''}` : 'Building — nothing blocking me'));

    const tiles = computed(() => {
      const t = [];
      // Apps is a PLACE, not a count — but the number of registered apps is a real measured figure,
      // so it is safe to show even at 1. First tile: Warwick has asked twice where his app lives.
      t.push({ num: APPS.length, label: 'Apps', desc: 'things Fusion runs for you', tone: 'blue', area: 'apps' });
      t.push({ num: suggestions.value.length, label: 'Ideas', desc: 'brain & cash', tone: 'blue', area: 'ideas' });
      t.push({ num: outputs.value.length, label: 'Outputs', desc: 'made for you', tone: 'green', area: 'outputs' });
      t.push({ num: state.value.ingestedCount ?? '—', label: 'Brain', desc: 'sources ingested', tone: 'grey', area: 'brain' });
      if (wins.value.length) t.push({ num: wins.value.length, label: 'Recent wins', desc: 'just finished', tone: 'green', area: 'system' });
      return t;
    });

    // ---- Apps > <App> > <view> ---------------------------------------------------------------
    // Three levels, all driven by the registry: the grid of apps, one app's own workspace, and a
    // view inside it. An app is a dashboard within the dashboard, not a flat panel.
    const appKey = ref(null);      // null = showing the grid
    const appViewKey = ref(null);  // null = the app's first view
    /** @type {import('vue').Ref<Record<string,{state:'checking'|'up'|'down'|'none',detail:string,at?:number}>>} */
    const appStatus = ref({});
    const currentApp = computed(() => APPS.find((a) => a.key === appKey.value) || null);
    const currentView = computed(() => {
      const a = currentApp.value; if (!a) return null;
      return a.views.find((v) => v.key === appViewKey.value) || a.views[0];
    });
    const statusOf = (a) => (a && appStatus.value[a.key]) || { state: a && a.probe ? 'checking' : 'none', detail: '' };
    // Colour follows the MEASURED state, never the app's identity colour — a tile must not read as
    // healthy just because it is pretty. Its own tone is earned only once its service has answered.
    const appTone = (a) => ({ up: a.tone, down: 'amber', checking: 'grey', none: 'grey' }[statusOf(a).state] || 'grey');
    const appStatusLine = (a) => ({ up: 'running', down: 'not running', none: 'no service to check' }[statusOf(a).state] || 'checking…');
    const setStatus = (key, v) => { appStatus.value = { ...appStatus.value, [key]: v }; };
    async function probeApp(a) {
      if (!a) return;
      if (!a.probe) { setStatus(a.key, { state: 'none', detail: 'No backing service is registered for this app.' }); return; }
      setStatus(a.key, { state: 'checking', detail: '' });
      try {
        const r = await fetch('/api/app-status?app=' + encodeURIComponent(a.key), { cache: 'no-store' });
        const d = await r.json();
        const state = d && (d.state === 'up' || d.state === 'none') ? d.state : 'down';
        setStatus(a.key, { state, detail: (d && d.detail) || '', at: Date.now() });
      } catch (e) {
        // The COCKPIT couldn't be asked — say that, rather than pronouncing on the app itself.
        setStatus(a.key, { state: 'down', detail: 'The cockpit could not be asked whether this app is running.', at: Date.now() });
      }
    }
    const probeAll = () => { for (const a of APPS) probeApp(a); };

    // FOCUS MUST BE MOVED ON EVERY LEVEL TRANSITION (WCAG 2.4.3). Crossing a level destroys the
    // control that was focused — the tile, the breadcrumb, the back chevron are all inside a v-if —
    // and the browser then drops focus on <body>, restarting a keyboard user at the top of the page.
    // Going IN lands on the workspace heading (announces the new context); coming OUT lands back on
    // the tile you came from (returns you where you were). Switching views inside an app is left
    // alone deliberately: that button survives, so moving focus would be the rude thing to do.
    async function focusSel(sel) {
      await nextTick();
      const el = document.querySelector(sel);
      if (el) el.focus();
      return !!el;
    }
    const openApp = (k) => { appViewKey.value = null; appKey.value = k; probeApp(APPS.find((a) => a.key === k)); focusSel('#app-workspace-h'); };
    // `from` is the app we are leaving, so focus can return to its tile. When we are not leaving an
    // app (a plain area switch) the selector matches nothing and focus is left exactly where it is.
    const closeApp = () => {
      const was = appKey.value;
      appKey.value = null; appViewKey.value = null;
      if (was) focusSel('[data-app-tile="' + was + '"]');
    };
    const goView = (k) => { appViewKey.value = k; };

    // Leaving an area always drops you back to the Apps GRID — tapping "Apps" while already inside
    // an app must go somewhere, not silently do nothing. The breadcrumb is the way back in.
    const go = (k) => { detail.value = null; closeApp(); area.value = k; if (k === 'apps') probeAll(); };
    const open = (item, as) => { detail.value = { ...item, _as: as }; };
    const closeDetail = () => { detail.value = null; };

    async function decide(item, decision, ax) {
      busy.value = true; item._error = null;
      try {
        const body = { id: item.id, decision };
        if (decision === 'accept' && ax) { body.intent = ax.intent; body.args = ax.args; }
        const r = await fetch('/api/decide', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
        const res = await r.json();
        if (!res.ok) throw new Error(res.error || 'failed');
        if (detail.value && detail.value.id === item.id) closeDetail();
        await load();
      } catch (e) { item._error = e.message; }
      finally { busy.value = false; }
    }
    const deliverables = computed(() => state.value.deliverables || []);
    function download(name, text) { const b = new Blob([text || ''], { type: 'text/markdown' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u); }
    async function copyText(text) { try { await navigator.clipboard.writeText(text || ''); return true; } catch (e) { return false; } }
    async function fetchDoc(file) { const r = await fetch('/api/deliverable?file=' + encodeURIComponent(file)); return r.json(); }
    async function openDeliverable(d) {
      detail.value = { _as: 'doc', title: d.title, file: d.file };
      try { const j = await fetchDoc(d.file); if (!j.ok) throw new Error(j.error); if (detail.value && detail.value.file === d.file) detail.value = { _as: 'doc', title: d.title, file: d.file, text: j.text }; }
      catch (e) { if (detail.value && detail.value.file === d.file) detail.value = { _as: 'doc', title: d.title, file: d.file, _error: e.message }; }
    }
    // Open the PRIMARY output for a source: the standalone "what this source says" knowledge note, in the read
    // sheet — understandable without Arc/Mason. Mirrors openDeliverable (renders markdown via mdToHtml at detail.text).
    async function openBrief(s) {
      const key = s.video_id; const title = s.title || s.video_id;
      detail.value = { _as: 'doc', title, _brief: key };
      try { const r = await fetch('/api/source-brief?video=' + encodeURIComponent(key)); const j = await r.json(); if (!j.ok) throw new Error(j.error);
        if (detail.value && detail.value._brief === key) detail.value = { _as: 'doc', title, _brief: key, text: j.text }; }
      catch (e) { if (detail.value && detail.value._brief === key) detail.value = { _as: 'doc', title, _brief: key, _error: e.message }; }
    }
    async function copyDoc(d) { const j = await fetchDoc(d.file); if (j.ok && await copyText(j.text)) { d._copied = true; setTimeout(() => { d._copied = false; }, 2000); } }
    async function downloadDoc(d) { const j = await fetchDoc(d.file); if (j.ok) download(d.file, j.text); }
    async function downloadTranscript(s) { try { const r = await fetch('/api/transcript?video=' + encodeURIComponent(s.video_id)); const j = await r.json(); if (j.ok) download((s.title || s.video_id) + '.txt', j.text); } catch (e) { s._copyErr = 'download failed'; } }
    async function mine(s) {
      s._mining = true; s._mineErr = null;
      try { const r = await fetch('/api/mine', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ video: s.video_id }) }); const d = await r.json(); if (!d.ok) throw new Error(d.error); s._mined = true; setTimeout(() => { s._mined = false; }, 6000); }
      catch (e) { s._mineErr = e.message; } finally { s._mining = false; }
    }
    const synthing = ref(false); const synthMsg = ref(null);
    async function synthesise() {
      synthing.value = true; synthMsg.value = null;
      try { const r = await fetch('/api/synthesise', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }); const d = await r.json(); if (!d.ok) throw new Error(d.error); synthMsg.value = 'Mason is synthesising — new opportunities appear here in a few minutes. Tap ↻ to check.'; }
      catch (e) { synthMsg.value = 'Failed: ' + e.message; } finally { synthing.value = false; }
    }
    async function ideaDecide(it, decision) {
      busy.value = true; it._error = null;
      try {
        const r = await fetch('/api/idea-decide', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: it.id, decision }) });
        const res = await r.json(); if (!res.ok) throw new Error(res.error || 'failed');
        it._done = { keep: 'Kept', later: 'Later', decline: 'Declined', research: 'Research queued →' }[decision];
        if (detail.value && detail.value.id === it.id) closeDetail();
        await load();
      } catch (e) { it._error = e.message; } finally { busy.value = false; }
    }
    const opps = computed(() => state.value.opportunities || []);
    async function opportunityDecide(o, decision) {
      busy.value = true; o._error = null;
      try {
        const r = await fetch('/api/opportunity-decide', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: o.id, decision }) });
        const res = await r.json(); if (!res.ok) throw new Error(res.error || 'failed');
        o._done = { watch: 'Watching', research: 'Pax queued →', brief: 'Brief queued →', later: 'Later', decline: 'Declined' }[decision];
        if (detail.value && detail.value.id === o.id) closeDetail(); // acted from the detail sheet → return to the refreshed lane
        await load();
      } catch (e) { o._error = e.message; } finally { busy.value = false; }
    }
    async function copyTranscript(s) {
      s._copyErr = null;
      try {
        const r = await fetch('/api/transcript?video=' + encodeURIComponent(s.video_id));
        const d = await r.json();
        if (!d.ok) throw new Error(d.error || 'no transcript');
        await navigator.clipboard.writeText(d.text);
        s._copied = true; setTimeout(() => { s._copied = false; }, 2500);
      } catch (e) { s._copyErr = 'copy failed: ' + (e.message || e); }
    }
    // Primary governed action for an item (accept fires it). Brain items carry explicit actions[]; if
    // an item has a first action we treat Accept as "do it", else Accept is a plain acknowledge.
    const primaryAction = (it) => (Array.isArray(it.actions) && it.actions.length ? it.actions.find((a) => a.key === 'accept' || a.key === 'merge') || it.actions[0] : null);
    // Human-readable status for an ingested source — a STUCK source must never read "generating…" forever.
    const sourceStatus = (s) => {
      if (s.noted) return 'standalone note ready · ' + ago(s.updated_at) + ' ago';
      if (!s.extracted && (s.extract_attempts || 0) >= 3) return '⚠ transcript extraction failed — flagged';
      if (s.extracted && (s.note_attempts || 0) >= 3) return '⚠ note generation failed — flagged';
      return 'note generating…';
    };

    return {
      AREAS, APPS, appKey, appViewKey, currentApp, currentView, statusOf, appTone, appStatusLine, probeApp, openApp, closeApp, goView,
      state, area, detail, busy, loading, loadErr,
      kindOf, catLabel, moduleLabel, oneLine, ago, terse, impactStars, outputTitle, humanValue, humanPoints, spinOf, mdToHtml, notifyMark, build, housekeeping, host, when,
      deliverables, openDeliverable, openBrief, copyDoc, downloadDoc, downloadTranscript, download, copyText,
      attn, deferred, archived, blocked, decisions, suggestions, needsYou, ideaCat, ideasBrain, ideasCash, latest, toneOf,
      tiBrain, tiCash, tiSpin, tiStars, mine, ideaDecide, opps, opportunityDecide, synthesise, synthing, synthMsg,
      outputs, newOutputs, itemsAdded, wins, builds,
      statusTone, statusLine, tiles, go, open, closeDetail, decide, copyTranscript, primaryAction, sourceStatus, load, REPORT, GRAPH,
    };
  },
  template: `
<div class="app">
  <nav class="nav" aria-label="Main">
    <button v-for="a in AREAS" :key="a.key" class="nav-btn" :class="{on: area===a.key}" @click="go(a.key)">
      <span class="nav-ico">{{ a.icon }}</span><span class="nav-lbl">{{ a.label }}</span>
      <span v-if="a.key==='home' && needsYou.length" class="nav-badge">{{ needsYou.length }}</span>
    </button>
  </nav>

  <div class="shell-main">
    <header class="topbar">
      <div class="brand" @click="go('home')" title="Home" style="cursor:pointer"><span class="dot" :class="{red: statusTone==='red'}"></span> Fusion247</div>
      <div class="status-mini" :class="{red: statusTone==='red'}">{{ statusLine }}</div>
      <button class="refresh" @click="go('settings')" title="Settings">⚙</button>
      <button class="refresh" @click="load()" :disabled="loading">{{ loading ? '…' : '↻' }}</button>
    </header>

    <div v-if="loadErr" class="load-err" @click="load()">⚠ Couldn't reach the cockpit — tap to retry</div>

    <main class="main">
      <!-- HOME -->
      <section v-if="area==='home'" class="pane">
        <div class="status-line" :class="{red: statusTone==='red'}"><span>{{ statusTone==='red' ? '🔴' : '🟢' }}</span>{{ statusLine }}</div>

        <!-- Needs you: genuine blockers + decisions, pinned at the top -->
        <div class="grp" v-if="needsYou.length">
          <h2>🔔 Needs you<span class="g-count">{{ needsYou.length }}</span></h2>
          <div v-for="it in needsYou" :key="it.id" class="item" :class="toneOf(it)">
            <div class="i-main" @click="open(it,'attention')"><div class="i-eyebrow" :class="kindOf(it)">{{ catLabel(it) }} · {{ moduleLabel(it.source_module) }}</div><div class="i-title">{{ terse(it.title) }}</div><div v-if="it.reason" class="i-why">{{ oneLine(it.reason) }}</div></div>
            <div class="i-act"><span v-if="it._done" class="done-pill">✅ {{ it._done }}</span><template v-else><button class="act accept" :disabled="busy" @click.stop="decide(it,'accept',primaryAction(it))">Accept</button><button class="act defer" :disabled="busy" @click.stop="decide(it,'defer')">Later</button><button class="act decline" :disabled="busy" @click.stop="decide(it,'decline')">Decline</button></template></div>
          </div>
        </div>

        <div class="tiles">
          <button v-for="t in tiles" :key="t.label" class="tile" :class="t.tone" @click="go(t.area)">
            <span class="t-num">{{ t.num }}</span><span class="t-lbl">{{ t.label }}</span><span class="t-desc">{{ t.desc }}</span>
          </button>
        </div>

        <!-- Parked & declined — the two places a decision you postponed can be found again. ABOVE
             Latest deliberately: a surface where you still owe yourself a decision outranks a
             passive feed. Both rows render unconditionally; a destination that only exists while
             it is non-empty cannot be learned, which is how Archive became unreachable. -->
        <div class="grp" style="margin-top:20px">
          <h2>🗂 Parked &amp; declined</h2>
          <div class="item grey" role="button" tabindex="0" :aria-label="'Later — ' + deferred.length + ' parked'"
               @click="go('later')" @keydown.enter="go('later')" @keydown.space.prevent="go('later')">
            <div class="i-main"><div class="i-eyebrow">Parked · not dropped</div><div class="i-title">Later</div></div>
            <span class="count">{{ deferred.length }}</span><span class="chev" aria-hidden="true">›</span>
          </div>
          <div class="item grey" role="button" tabindex="0" :aria-label="'Archive — ' + archived.length + ' declined'"
               @click="go('archive')" @keydown.enter="go('archive')" @keydown.space.prevent="go('archive')">
            <div class="i-main"><div class="i-eyebrow">Declined · not deleted</div><div class="i-title">Archive</div></div>
            <span class="count">{{ archived.length }}</span><span class="chev" aria-hidden="true">›</span>
          </div>
        </div>

        <!-- Latest: recent activity, under the tiles -->
        <div class="grp" style="margin-top:20px" v-if="latest.length">
          <h2>🕑 Latest</h2>
          <div v-for="(l,idx) in latest" :key="idx" class="item grey" @click="go(l.area)">
            <div class="i-main"><div class="i-eyebrow">{{ l.kind }} · {{ ago(l.t) }} ago</div><div class="i-title">{{ terse(l.label) }}</div></div>
            <span class="chev">›</span>
          </div>
        </div>
      </section>

      <!-- APPS — the things Fusion RUNS for Warwick. Apps > <App> > <view>: an app opens into its own
           workspace with its own internal navigation, not a flat panel. Every level is driven by the
           registry in /apps.js, so adding the next app is one entry there — not three edits here. -->
      <section v-else-if="area==='apps'" class="pane apps-pane">

        <!-- L1 — the grid of apps -->
        <template v-if="!currentApp">
          <header class="p-h"><h1>Apps</h1><span class="count">{{ APPS.length }}</span></header>
          <p class="app-blurb">The things Fusion runs for you. Each one opens into its own workspace.</p>
          <div v-if="!APPS.length" class="empty big">No apps registered yet.</div>
          <div v-else class="tiles">
            <button v-for="a in APPS" :key="a.key" class="tile" :class="appTone(a)" :data-app-tile="a.key" @click="openApp(a.key)">
              <span class="t-num" aria-hidden="true">{{ a.icon }}</span>
              <span class="t-lbl">{{ a.label }}</span>
              <span class="t-desc">{{ a.desc }}</span>
              <span class="app-pill" :class="statusOf(a).state">{{ appStatusLine(a) }}</span>
            </button>
          </div>
        </template>

        <!-- L2/L3 — one app's own workspace -->
        <template v-else>
          <nav class="crumbs" aria-label="Breadcrumb">
            <button class="crumb" @click="closeApp()">Apps</button>
            <span class="crumb-sep" aria-hidden="true">›</span>
            <button class="crumb" @click="goView(currentApp.views[0].key)">{{ currentApp.label }}</button>
            <span class="crumb-sep" aria-hidden="true">›</span>
            <span class="crumb on" aria-current="page">{{ currentView.label }}</span>
          </nav>

          <header class="p-h">
            <button class="back app-back" @click="closeApp()" aria-label="Back to all apps">‹</button>
            <!-- tabindex=-1 so focus can be MOVED here on entry; it is never in the tab order. -->
            <h1 id="app-workspace-h" tabindex="-1">{{ currentApp.label }}</h1><span class="lane-sub">{{ currentApp.desc }}</span>
          </header>

          <!-- Availability, measured. Never assumed, never dressed up. -->
          <div class="app-status" :class="statusOf(currentApp).state" role="status" aria-live="polite">
            <span class="as-dot" aria-hidden="true"></span>
            <div class="as-body"><b>{{ appStatusLine(currentApp) }}</b><span v-if="statusOf(currentApp).detail"> — {{ statusOf(currentApp).detail }}</span></div>
            <button v-if="currentApp.probe" class="act" @click="probeApp(currentApp)">Check again</button>
          </div>

          <!-- The app's OWN navigation — the dashboard within the dashboard -->
          <nav class="app-nav" :aria-label="currentApp.label + ' sections'">
            <button v-for="v in currentApp.views" :key="v.key" class="app-nav-btn" :class="{on: v.key===currentView.key}"
              :aria-current="v.key===currentView.key ? 'page' : null" @click="goView(v.key)">{{ v.label }}</button>
          </nav>

          <div class="app-view">
            <p v-if="currentView.blurb" class="app-blurb">{{ currentView.blurb }}</p>

            <!-- About = facts about the app itself, true whether or not its service is running. -->
            <ul v-if="currentApp.about.length && currentView.key==='about'" class="read">
              <li v-for="(f,i) in currentApp.about" :key="i">{{ f }}</li>
            </ul>

            <!-- Every other view needs the service. No service, no data — and no invented data. -->
            <template v-else>
              <div v-if="statusOf(currentApp).state==='checking'" class="empty big">Checking whether {{ currentApp.label }} is running…</div>
              <div v-else-if="statusOf(currentApp).state==='up'" class="empty big">
                {{ currentApp.label }} is answering, but this view is not wired to it yet — so nothing is shown here, and nothing is being made up.
              </div>
              <div v-else class="empty big">{{ currentApp.offline }}</div>
            </template>
          </div>
        </template>
      </section>

      <!-- IDEAS — Transfer-Intelligence candidates, SPIN-first (Situation leads; tech detail behind Details) -->
      <section v-else-if="area==='ideas'" class="pane">
        <header class="p-h"><h1>Ideas</h1></header>

        <div class="grp" v-if="tiBrain.length">
          <h2>🧠 Brain<span class="g-count">{{ tiBrain.length }}</span><span class="lane-sub">improve F247</span></h2>
          <div v-for="it in tiBrain" :key="it.id" class="item blue">
            <div class="i-main" @click="open(it,'idea')"><div class="i-eyebrow"><span style="color:var(--warn)">{{ tiStars(it) }}</span> impact · {{ it.lens }} · FROM {{ terse(it.source_title, 38) }}</div><div class="i-title">{{ terse(tiSpin(it).situation, 92) }}</div><div v-if="tiSpin(it).implication" class="i-why">{{ oneLine(tiSpin(it).implication) }}</div></div>
            <div class="i-act"><span v-if="it._done" class="done-pill">✅ {{ it._done }}</span><template v-else><button class="act accept" :disabled="busy" @click.stop="ideaDecide(it,'keep')">Keep</button><button class="act defer" :disabled="busy" @click.stop="ideaDecide(it,'later')">Later</button><button class="act decline" :disabled="busy" @click.stop="ideaDecide(it,'decline')">Decline</button></template></div>
          </div>
        </div>

        <div class="grp" v-if="tiCash.length">
          <h2>💰 Cash<span class="g-count">{{ tiCash.length }}</span><span class="lane-sub">make money</span></h2>
          <div v-for="it in tiCash" :key="it.id" class="item green">
            <div class="i-main" @click="open(it,'idea')"><div class="i-eyebrow"><span style="color:var(--warn)">{{ tiStars(it) }}</span> impact · {{ it.lens }} · FROM {{ terse(it.source_title, 38) }}</div><div class="i-title">{{ terse(tiSpin(it).situation, 92) }}</div><div v-if="tiSpin(it).implication" class="i-why">{{ oneLine(tiSpin(it).implication) }}</div></div>
            <div class="i-act"><span v-if="it._done" class="done-pill">✅ {{ it._done }}</span><template v-else><button class="act accept" :disabled="busy" @click.stop="ideaDecide(it,'keep')">Keep</button><button class="act defer" :disabled="busy" @click.stop="ideaDecide(it,'later')">Later</button><button class="act decline" :disabled="busy" @click.stop="ideaDecide(it,'decline')">Decline</button></template></div>
          </div>
        </div>

        <div v-if="!tiBrain.length && !tiCash.length" class="empty big">No ideas yet — tap <b>🧠 Mine for ideas</b> on a source in Brain. 💡</div>
      </section>

      <!-- OUTPUTS = Insights / Deliverables / Transcripts -->
      <section v-else-if="area==='outputs'" class="pane">
        <header class="p-h"><h1>Outputs</h1></header>

        <div class="grp">
          <h2>🎯 Opportunities<span class="g-count">{{ opps.length }}</span><span class="lane-sub">Mason — joined-up build theses, not single ideas</span>
            <button class="act" style="margin-left:auto" :disabled="synthing" @click="synthesise()">{{ synthing ? '…' : '🧩 Synthesise' }}</button></h2>
          <div v-if="synthMsg" class="i-why" style="margin-bottom:9px">{{ synthMsg }}</div>
          <div v-if="!opps.length" class="empty">No opportunities surfaced yet — tap <b>🧩 Synthesise</b> to have Mason converge the idea estate.</div>
          <div class="lane-scroll">
          <div v-for="o in opps" :key="o.id" class="item blue">
            <div class="i-main" @click="open(o,'opp')">
              <div class="i-eyebrow">{{ o.otype==='strategic' ? '🧭 strategic' : '🔧 self-improvement' }}<template v-if="o.roi && o.roi.band"> · {{ o.roi.band }} ROI / {{ o.roi.value_type }}</template> · {{ o.atoms ? o.atoms.length : 0 }} ideas<span v-if="o.disposition && !o.disposition_conflict" class="opp-disp"> · your call: {{ o.disposition }}</span><span v-if="o.disposition_conflict" class="opp-conflict"> · ⚠ re-confirm</span></div>
              <div class="i-title">{{ terse(o.headline) }}</div>
            </div>
            <span class="chev">›</span>
          </div>
          </div>
        </div>

        <div class="grp">
          <h2>💡 Insights<span class="g-count">{{ outputs.length }}</span><span class="lane-sub">so-what from the Brain</span></h2>
          <div v-if="!outputs.length" class="empty">No insights yet.</div>
          <div v-for="o in outputs.slice(0,5)" :key="o.id" class="item green">
            <div class="i-main" @click="open(o,'output')"><div class="i-eyebrow">{{ moduleLabel(o.source_module) }} · {{ ago(o.produced_at) }} ago</div><div class="i-title">{{ terse(outputTitle(o)) }}</div><div v-if="humanValue(o.value)" class="i-why">{{ oneLine(humanValue(o.value)) }}</div></div>
            <span class="chev">›</span>
          </div>
        </div>

        <div class="grp">
          <h2>📄 Deliverables<span class="g-count">{{ deliverables.length }}</span><span class="lane-sub">produced docs — read / copy / download</span></h2>
          <div v-if="!deliverables.length" class="empty">No deliverables yet — dPax will drop them here.</div>
          <div class="lane-scroll">
          <div v-for="d in deliverables" :key="d.file" class="item grey">
            <div class="i-main" @click="openDeliverable(d)"><div class="i-eyebrow">doc · {{ ago(d.mtime) }} ago</div><div class="i-title">{{ terse(d.title) }}</div></div>
            <div class="i-act"><button class="act" :disabled="busy" @click.stop="copyDoc(d)">{{ d._copied ? '✓' : '⧉' }}</button><button class="act" @click.stop="downloadDoc(d)">⭳</button></div>
          </div>
          </div>
        </div>

        <div class="grp">
          <h2>📖 Source briefs<span class="g-count">{{ (state.ingested||[]).length }}</span><span class="lane-sub">what each source says — read it instead of watching</span></h2>
          <div v-if="!(state.ingested||[]).length" class="empty">Nothing ingested yet.</div>
          <div class="lane-scroll">
          <div v-for="s in (state.ingested||[])" :key="s.video_id" class="item grey">
            <div class="i-main" style="cursor:pointer" @click="openBrief(s)"><div class="i-title">{{ terse(s.title || s.video_id) }}</div><div class="i-why" :class="{err:s._copyErr}">{{ s._copyErr ? s._copyErr : sourceStatus(s) }}</div></div>
            <div class="i-act"><button class="act accept" @click="openBrief(s)">📖 Read</button><button class="act" :disabled="busy" @click="copyTranscript(s)" title="copy raw transcript">{{ s._copied ? '✓' : '⧉' }}</button><button class="act" @click="downloadTranscript(s)" title="download raw transcript">⭳</button></div>
          </div>
          </div>
        </div>
      </section>

      <!-- BRAIN -->
      <section v-else-if="area==='brain'" class="pane">
        <header class="p-h"><h1>Brain</h1></header>
        <div class="tiles">
          <button class="tile grey"><span class="t-num">{{ state.ingestedCount ?? '—' }}</span><span class="t-lbl">Ingested</span><span class="t-desc">sources processed</span></button>
          <button class="tile green" @click="go('outputs')"><span class="t-num">{{ outputs.length }}</span><span class="t-lbl">Insights</span><span class="t-desc">so-what for you</span></button>
          <button class="tile blue" @click="go('ideas')"><span class="t-num">{{ suggestions.length }}</span><span class="t-lbl">Make better</span><span class="t-desc">brain ideas</span></button>
          <button class="tile grey" title="graph merges I'm holding — not something you need to action"><span class="t-num">{{ housekeeping }}</span><span class="t-lbl">Housekeeping</span><span class="t-desc">graph Qs I'm holding</span></button>
        </div>
        <div class="tiles" style="margin-top:12px">
          <a class="tile blue" :href="GRAPH" target="_blank" rel="noopener" style="text-decoration:none"><span class="t-num">🌌</span><span class="t-lbl">Galaxy</span><span class="t-desc">explore the graph ↗</span></a>
          <a class="tile grey" :href="REPORT" target="_blank" rel="noopener" style="text-decoration:none"><span class="t-num">📄</span><span class="t-lbl">Report</span><span class="t-desc">full knowledge report ↗</span></a>
        </div>
        <p class="empty" style="margin-top:10px">🌌 <b>Galaxy</b> = your knowledge as an explorable map you can fly around. 📄 <b>Report</b> = the full written write-up of everything the Brain has ingested.</p>
        <div class="grp" style="margin-top:20px">
          <h2>Recently ingested<span class="lane-sub">captured &amp; processed — read the brief, or mine it for ideas</span></h2>
          <div v-if="!(state.ingested||[]).length" class="empty">Nothing ingested yet.</div>
          <div v-for="s in (state.ingested||[])" :key="s.video_id" class="item grey">
            <div class="i-main" style="cursor:pointer" @click="openBrief(s)"><div class="i-title">{{ s.title || s.video_id }}</div><div class="i-why" :class="{err: s._copyErr}">{{ s._copyErr ? s._copyErr : sourceStatus(s) }}</div></div>
            <div class="i-act"><button class="act accept" @click="openBrief(s)">📖 Read</button><button class="act" :disabled="s._mining" @click="mine(s)">{{ s._mined ? '✓ Mining…' : (s._mining ? '…' : '🧠 Mine') }}</button><button class="act" :disabled="busy" @click="copyTranscript(s)" title="copy raw transcript">{{ s._copied ? '✓' : '⧉' }}</button></div>
          </div>
        </div>
      </section>

      <!-- LATER (deferred items — parked by you, and kept). Items render as plain .item.grey on the
           neutral --park rail: NOT .item.deferred. The fade is how a deferred card is marked when it
           sits among live ones; in a lane where everything is deferred it signals nothing and only
           costs contrast (GL-003 D-18). Restore is decide(it,'reopen') — the same action and the same
           word as Archive, because two words for one action is a third vocabulary the user must learn. -->
      <section v-else-if="area==='later'" class="pane">
        <header class="p-h"><button class="back" style="padding:0;margin-right:4px" @click="go('home')">‹</button><h1>Later</h1><span class="count">{{ deferred.length }}</span></header>
        <p class="empty" v-if="!deferred.length">Nothing parked — nothing waiting for a second look.</p>
        <p class="empty" v-else>Parked, not dropped. Everything here stays until you bring it back — nothing expires and nothing resurfaces on its own.</p>
        <div v-for="it in deferred" :key="it.id" class="item grey">
          <div class="i-main" @click="open(it,'attention')"><div class="i-eyebrow">Later · {{ moduleLabel(it.source_module) }}</div><div class="i-title">{{ it.title }}</div></div>
          <div class="i-act"><button class="act" :disabled="busy" @click.stop="decide(it,'reopen')">Bring back</button></div>
        </div>
      </section>

      <!-- ARCHIVE (declined items — change your mind here) -->
      <section v-else-if="area==='archive'" class="pane">
        <header class="p-h"><button class="back" style="padding:0;margin-right:4px" @click="go('home')">‹</button><h1>Archive</h1><span class="count">{{ archived.length }}</span></header>
        <p class="empty" v-if="!archived.length">Nothing declined — nothing to change your mind about.</p>
        <div v-for="it in archived" :key="it.id" class="item grey">
          <div class="i-main" @click="open(it,'attention')"><div class="i-eyebrow">Declined · {{ moduleLabel(it.source_module) }}</div><div class="i-title">{{ it.title }}</div></div>
          <div class="i-act"><button class="act" :disabled="busy" @click.stop="decide(it,'reopen')">Bring back</button></div>
        </div>
      </section>

      <!-- SETTINGS (version — so you know you're on the latest, and which thing you're looking at) -->
      <section v-else-if="area==='settings'" class="pane">
        <header class="p-h"><button class="back" style="padding:0;margin-right:4px" @click="go('home')">‹</button><h1>Settings</h1></header>
        <div class="grp">
          <h2>This app</h2>
          <div class="item green"><div class="i-main"><div class="i-title">Fusion247 Cockpit — v{{ build.version }}</div><div class="i-why">build {{ build.sha }} · live since {{ when(build.startedAt) }}</div></div></div>
          <div class="item grey"><div class="i-main"><div class="i-title">You're on the standalone Cockpit ✅</div><div class="i-why">{{ host }} — the https tailnet app (not Directus, not the old IP link)</div></div></div>
          <div class="item grey"><div class="i-main"><div class="i-title">On the latest?</div><div class="i-why">Reload the app — if the build code above changes, you've picked up a newer version.</div></div></div>
        </div>
      </section>

      <!-- SYSTEM — answers "what's happening now?"; history is deeper down -->
      <section v-else class="pane">
        <header class="p-h"><h1>System</h1></header>
        <div class="status-line" :class="{red: statusTone==='red'}"><span>{{ statusTone==='red' ? '🔴' : '🟢' }}</span>{{ statusLine }}</div>
        <div class="grp"><h2>Happening now<span class="g-count">{{ builds.length }}</span></h2>
          <div v-if="!builds.length" class="empty">Nothing actively building.</div>
          <div v-for="b in builds" :key="b.id" class="item" :class="b.status_tone==='block' ? 'red':'grey'">
            <div class="i-main"><div class="i-title">{{ b.name }}</div><div class="i-why">{{ b.gives }} · {{ b.progress_pct || 0 }}%</div></div>
            <span class="chip" :class="b.status_tone==='block' ? 'block' : (b.status_tone==='ok' ? 'ok':'prog')"><span class="d"></span>{{ b.status }}</span>
          </div>
        </div>
        <details class="tech" v-if="wins.length"><summary>Recent history · {{ wins.length }}</summary>
          <div class="tech-body">
            <div v-for="wn in wins" :key="wn.id" class="item green" style="margin-top:8px"><div class="i-main"><div class="i-title">{{ wn.text }}</div><div class="i-why">{{ ago(wn.happened_at) }} ago</div></div></div>
          </div>
        </details>
      </section>
    </main>
  </div>

  <!-- DETAIL SHEET (L3 + L4) -->
  <div v-if="detail" class="sheet" @click.self="closeDetail">
    <div class="sheet-card">
      <button class="back" @click="closeDetail">‹ Back</button>
      <div class="d-eyebrow">{{ detail._as==='doc' ? 'Deliverable' : detail._as==='idea' ? ((detail.category==='cash'?'💰 Cash':'🧠 Brain')+' idea · '+tiStars(detail)+' impact') : detail._as==='opp' ? ('🎯 Opportunity — Mason'+(detail.roi&&detail.roi.band?' · '+detail.roi.band+' ROI / '+detail.roi.value_type:'')+' · '+(detail.atoms?detail.atoms.length:0)+' ideas') : (detail._as==='output' ? (moduleLabel(detail.source_module)+' · output') : catLabel(detail)) }}</div>
      <h1>{{ detail._as==='output' ? outputTitle(detail) : detail._as==='idea' ? terse(tiSpin(detail).situation, 110) : detail._as==='opp' ? detail.headline : detail.title }}</h1>

      <template v-if="detail._as==='doc'">
        <div v-if="detail._error" class="err">{{ detail._error }}</div>
        <div v-else-if="detail.text" class="read" v-html="mdToHtml(detail.text)"></div>
        <div v-else class="d-reason">Loading…</div>
        <div class="d-actions" v-if="detail.text">
          <button class="act" @click="copyText(detail.text)">⧉ Copy</button>
          <button class="act" @click="download(detail.file, detail.text)">⭳ Download</button>
        </div>
      </template>

      <template v-else-if="detail._as==='output'">
        <ul v-if="humanPoints(detail.value).length" class="read"><li v-for="(p,i) in humanPoints(detail.value)" :key="i">{{ p }}</li></ul>
        <div v-else-if="humanValue(detail.value)" class="read">{{ humanValue(detail.value) }}</div>
        <div v-else class="d-reason">A result was produced — open the full read below.</div>
        <div class="d-links">
          <a v-if="detail.evidence_url" :href="detail.evidence_url" target="_blank" rel="noopener">📄 Open the full read ↗</a>
        </div>
      </template>

      <template v-else-if="detail._as==='idea'">
        <div class="read">
          <h3>Situation</h3><p>{{ tiSpin(detail).situation }}</p>
          <h3>Problem</h3><p>{{ tiSpin(detail).problem }}</p>
          <h3>Implication — why it matters</h3><p>{{ tiSpin(detail).implication }}</p>
          <h3>Need-payoff — what gets better</h3><p>{{ tiSpin(detail).need_payoff }}</p>
        </div>
        <div class="d-actions" v-if="!detail._done">
          <button class="act accept" :disabled="busy" @click="ideaDecide(detail,'keep')">Keep</button>
          <button class="act defer" :disabled="busy" @click="ideaDecide(detail,'later')">Later</button>
          <button class="act decline" :disabled="busy" @click="ideaDecide(detail,'decline')">Decline</button>
          <button class="act" :disabled="busy" @click="ideaDecide(detail,'research')" style="border-color:var(--accent);color:var(--accent-ink)">🔬 Research with Pax →</button>
        </div>
        <div v-else class="done-pill">✅ {{ detail._done }}</div>
        <div v-if="detail._error" class="err">{{ detail._error }}</div>
        <details class="tech"><summary>Details (technical)</summary>
          <div class="tech-body"><div class="mono">target: {{ detail.fusion_target }}
lens: {{ detail.lens }} · nvfi: {{ JSON.stringify(detail.nvfi) }}
mechanism: {{ (detail.source_evidence||{}).named_mechanism }}
evidence: "{{ (detail.source_evidence||{}).quote }}"  [{{ (detail.source_evidence||{}).timestamp }}]
transfer: {{ detail.transfer_reasoning }}
traps: {{ JSON.stringify(detail.traps) }}
larry reconciliation: {{ detail.larry_recon ? JSON.stringify(detail.larry_recon) : 'pending' }}
source: {{ detail.source_title }} ({{ detail.source_ref }}) · {{ detail.mine_model }}
brief_hash: {{ detail.brief_hash }} · mine: {{ detail.mine_id }}</div></div>
        </details>
      </template>

      <template v-else-if="detail._as==='opp'">
        <div v-if="detail.disposition_conflict" class="opp-conflict" style="margin-bottom:8px">⚠ evidence changed since you last looked — worth re-confirming your call</div>
        <div v-else-if="detail.disposition" class="opp-disp" style="margin-bottom:8px">your call so far: {{ detail.disposition }}</div>
        <div v-if="detail.spin" class="read">
          <h3>Situation</h3><p>{{ detail.spin.situation }}</p>
          <h3>Problem</h3><p>{{ detail.spin.problem }}</p>
          <h3>Implication — why it matters</h3><p>{{ detail.spin.implication }}</p>
          <h3>Need-payoff — what gets better</h3><p>{{ detail.spin.need_payoff }}</p>
          <template v-if="detail.why_now"><h3>Why now</h3><p>{{ detail.why_now }}</p></template>
          <template v-if="detail.roi && detail.roi.note"><h3>ROI</h3><p>{{ detail.roi.note }}</p></template>
          <template v-if="detail.evidence"><h3>Evidence</h3><p>{{ detail.evidence.independent_sources }} sources · {{ detail.evidence.frames }} frames{{ detail.evidence.live_anchors && detail.evidence.live_anchors.length ? ' · '+detail.evidence.live_anchors.join('; ') : '' }}</p></template>
          <template v-if="detail.what_wed_build"><h3>What we'd build</h3><p>{{ detail.what_wed_build }}</p></template>
        </div>
        <details v-if="detail.atoms && detail.atoms.length" class="tech"><summary>Provenance — {{ detail.atoms.length }} supporting ideas</summary>
          <div class="tech-body"><div v-for="a in detail.atoms" :key="a.n" class="opp-atom">#{{ a.n }} <span class="mono">{{ a.source }} · {{ a.engine }}</span> — {{ a.situation || a.target }}</div></div>
        </details>
        <div class="d-actions" v-if="!detail._done">
          <button class="act" :disabled="busy" @click="opportunityDecide(detail,'watch')">Keep watching</button>
          <button class="act accept" :disabled="busy" @click="opportunityDecide(detail,'research')">Research w/ Pax</button>
          <button class="act accept" :disabled="busy" @click="opportunityDecide(detail,'brief')">Build brief</button>
          <button class="act defer" :disabled="busy" @click="opportunityDecide(detail,'later')">Later</button>
          <button class="act decline" :disabled="busy" @click="opportunityDecide(detail,'decline')">Decline</button>
        </div>
        <div v-else class="done-pill">✅ {{ detail._done }}</div>
        <div v-if="detail._error" class="err">{{ detail._error }}</div>
      </template>

      <template v-else>
        <div v-if="spinOf(detail)" class="read">
          <h3>Situation</h3><p>{{ spinOf(detail).s }}</p>
          <h3>Problem</h3><p>{{ spinOf(detail).p }}</p>
          <h3>Implication</h3><p>{{ spinOf(detail).i }}</p>
          <h3>Payoff</h3><p>{{ spinOf(detail).payoff }}</p>
        </div>
        <div v-else-if="detail.reason" class="d-reason">{{ detail.reason }}</div>
        <div class="d-actions" v-if="!detail._done">
          <button class="act accept" :disabled="busy" @click="decide(detail,'accept',primaryAction(detail))">Accept</button>
          <button class="act defer" :disabled="busy" @click="decide(detail,'defer')">Later</button>
          <button class="act decline" :disabled="busy" @click="decide(detail,'decline')">Decline</button>
        </div>
        <div v-else class="done-pill">✅ {{ detail._done }}</div>
        <div v-if="detail._error" class="err">{{ detail._error }}</div>
      </template>

      <details class="tech">
        <summary>Technical evidence</summary>
        <div class="tech-body"><div class="mono">module: {{ detail.source_module }}
type: {{ detail.source_type }}
provenance: {{ detail.provenance_ref }}
{{ detail.related_ref ? 'related: ' + detail.related_ref : '' }}
notify: {{ detail.notify_policy }}
id: {{ detail.id }}{{ detail.value ? '\\nvalue: ' + detail.value : '' }}</div></div>
      </details>
    </div>
  </div>
</div>
`,
}).mount('#app');
