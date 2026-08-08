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
    /** @type {import('vue').Ref<Record<string,{state:'checking'|'up'|'down'|'unknown'|'none',detail:string,at?:number}>>} */
    const appStatus = ref({});
    const currentApp = computed(() => APPS.find((a) => a.key === appKey.value) || null);
    const currentView = computed(() => {
      const a = currentApp.value; if (!a) return null;
      return a.views.find((v) => v.key === appViewKey.value) || a.views[0];
    });
    const statusOf = (a) => (a && appStatus.value[a.key]) || { state: a && a.probe ? 'checking' : 'none', detail: '' };
    // Colour follows the MEASURED state, never the app's identity colour — a tile must not read as
    // healthy just because it is pretty. Its own tone is earned only once its service has answered.
    // 'unknown' is GREY, not amber. Amber means "something is wrong"; grey (--park) is GL-003's
    // "no status colour applies", which is precisely what an unreadable answer means. Colouring
    // uncertainty as a fault is inventing a fact, just quieter.
    const appTone = (a) => ({ up: a.tone, down: 'amber', unknown: 'grey', checking: 'grey', none: 'grey' }[statusOf(a).state] || 'grey');
    // 'unknown' is a FIFTH state and it is not a synonym for 'down'. The service answered, but not
    // with a health report we could read — so we know it is there and we do NOT know it is well.
    // Collapsing that into "not running" is an invented fact in the pessimistic direction, and the
    // honesty rule cuts both ways: unknown reads as unknown.
    const appStatusLine = (a) => ({ up: 'running', down: 'not running', unknown: 'state unknown', none: 'no service to check' }[statusOf(a).state] || 'checking…');
    const setStatus = (key, v) => { appStatus.value = { ...appStatus.value, [key]: v }; };
    async function probeApp(a) {
      if (!a) return;
      if (!a.probe) { setStatus(a.key, { state: 'none', detail: 'No backing service is registered for this app.' }); return; }
      setStatus(a.key, { state: 'checking', detail: '' });
      try {
        const r = await fetch('/api/app-status?app=' + encodeURIComponent(a.key), { cache: 'no-store' });
        const d = await r.json();
        // Allow-list the states we understand. A state we do not recognise is 'unknown', NOT 'down':
        // inventing "not running" about a service that just told us something we could not parse is
        // the same class of error as inventing "running" — it is a fact we do not have.
        const state = d && ['up', 'down', 'none', 'unknown'].includes(d.state) ? d.state : 'unknown';
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
    // ---- AsdAIr — the first app with real Overview/Details views (not the shared placeholder). ----
    // Pattern for the NEXT app to imitate: one `<key>Ws` ref holding the raw workspace JSON as-is
    // (never reshaped), loaded once per openApp() and re-readable by every view of that app, plus a
    // couple of `<key>...` helper functions kept local to setup() rather than a shared framework —
    // there is only one app doing this yet, so a generic abstraction would be guessing its own shape.
    /** @type {import('vue').Ref<null|Record<string,any>>} raw /api/asdair/workspace body, untouched */
    const asdairWs = ref(null);
    const asdairWsErr = ref(null);
    const asdairWsLoading = ref(false);
    const asdairMediaErr = ref(false);
    /** Fetch the read-only shop workspace. Never throws; a failure degrades the asdair view to the
     * SAME offline placeholder every other app uses when its service doesn't answer. */
    async function loadAsdairWorkspace() {
      asdairWsLoading.value = true; asdairWsErr.value = null; asdairMediaErr.value = false;
      try {
        const r = await fetch('/api/asdair/workspace', { cache: 'no-store' });
        const d = await r.json();
        if (!r.ok || !d || d.ok === false) throw new Error((d && d.error) || ('http ' + r.status));
        asdairWs.value = d;
      } catch (e) {
        asdairWsErr.value = e.message || 'failed'; asdairWs.value = null;
      } finally {
        asdairWsLoading.value = false;
      }
    }
    const asdairShop = computed(() => (asdairWs.value && asdairWs.value.shop) || null);
    // The other real shops, shown plainly (they are real historical data) but never mistaken for the
    // active one — filtered out of the "other shops" list by id, not hidden.
    const asdairOtherShops = computed(() => {
      const list = (asdairWs.value && asdairWs.value.shops) || [];
      const curId = asdairShop.value && asdairShop.value.shop_id;
      return list.filter((s) => String(s.id) !== String(curId));
    });
    // "What's waiting on you" is derived ONLY from fields the API actually reports (failure,
    // is_terminal, needs_review_display, stage) — never a guessed sentence for a stage we don't have
    // grounds for. Anything not covered here falls back to the raw stage_label_display, which the
    // Overview always shows anyway, per the brief: unsure → show the raw label, don't invent English.
    function asdairWaitingOn(shop) {
      if (!shop) return '';
      if (shop.failure) return 'Something went wrong — check Telegram.' + (typeof shop.failure === 'string' ? ' ' + shop.failure : '');
      if (shop.is_terminal) return `This shop has reached its end (${shop.stage_label_display}) — nothing needed from you.`;
      if (shop.stage === 'RECEIVED' && shop.needs_review_display === 'yes') return 'Waiting for you to tell AsdAIr to build this shop — reply in Telegram.';
      if (shop.stage === 'NEEDS_DECISION') return 'Waiting for you — there’s a decision to make in Telegram.';
      if (shop.needs_review_display === 'yes') return 'Waiting on you — check Telegram for what AsdAIr needs.';
      return 'AsdAIr is working on it — nothing needed from you right now.';
    }
    // SHAPE NOW CONFIRMED against the live payload: history.previous_order.basket_total is a
    // present.js money object — { known, amount, currency, basis, is_asda_quoted, display } — and
    // `display` already carries its basis ("124.25 GBP (inferred - not an ASDA price)"). Printing
    // that string is the ONLY safe way to show it: the basis suffix is decided server-side by
    // present.js precisely so the browser cannot show a derived figure as an ASDA-quoted one.
    // The older key-guessing loop is kept as a tail because it costs nothing and a payload that
    // changes shape should degrade to "on file", never to a wrong number.
    function asdairMoney(m) {
      if (!m || typeof m !== 'object') return null;
      if (m.known === false) return null;
      return m.display != null ? String(m.display) : null;
    }
    function asdairPrevOrderTotal(prev) {
      if (!prev || typeof prev !== 'object') return null;
      const money = asdairMoney(prev.basket_total);
      if (money) return money;
      for (const k of ['total_display', 'basket_total_display', 'order_total_display', 'grand_total_display']) {
        if (prev[k] != null && prev[k] !== 'unknown') return String(prev[k]);
      }
      return null;
    }
    // ---- Making a line VERIFIABLE at a glance -------------------------------------------------
    // The five interpretation_status values assembleWorkspace can emit, each mapped to a rail tone
    // and a chip tone. COLOUR IS NEVER THE SIGNAL: every row also prints the API's own
    // `status_label` in words (GL-003 §2b — "no state in the cockpit is signalled by colour alone").
    // An unrecognised status falls to neutral grey and still prints whatever it says, so a new
    // status added upstream shows up as itself rather than silently rendering as "matched".
    const ASDAIR_LINE_TONES = {
      matched: { item: 'green', chip: 'ok' },
      needs_confirmation: { item: 'amber', chip: 'warn' },
      possible_duplicate: { item: 'amber', chip: 'warn' },
      unmatched_new_item: { item: 'blue', chip: 'prog' },
      unreadable: { item: 'red', chip: 'block' },
    };
    const asdairLineTone = (s) => (ASDAIR_LINE_TONES[s] || { item: 'grey', chip: 'neutral' }).item;
    const asdairLineChip = (s) => (ASDAIR_LINE_TONES[s] || { item: 'grey', chip: 'neutral' }).chip;
    // The tally, as an ORDERED list of the statuses actually present. Counts come straight from
    // interpretation.tally — a measured 0 stays 0, and a status the API didn't report is simply
    // absent rather than shown as zero.
    const asdairTally = computed(() => {
      const t = (asdairWs.value && asdairWs.value.interpretation && asdairWs.value.interpretation.tally) || null;
      if (!t) return [];
      const labels = {
        matched: 'matched', needs_confirmation: 'needs confirming', unmatched_new_item: 'new item',
        possible_duplicate: 'possible duplicate', unreadable: 'unreadable',
      };
      return Object.keys(labels).filter((k) => t[k] != null)
        .map((k) => ({ key: k, label: labels[k], n: t[k], chip: asdairLineChip(k) }));
    });
    // "unknown" is the API's own word for a fact it does not hold. Treat it as absence for the
    // purpose of DECIDING WHETHER TO SHOW A ROW — never rewrite it into 0 or a blank.
    const asdairKnown = (v) => v != null && v !== '' && v !== 'unknown';

    // ---- The durable rulebook (its own read, its own state) -----------------------------------
    // Loaded LAZILY when the Rules tab is first opened, not on openApp: it carries the whole
    // household catalogue and has nothing to do with the current shop. Deliberately independent of
    // asdairWs — a household with no shop in flight still has a rulebook worth reading.
    /** @type {import('vue').Ref<null|Record<string,any>>} raw /api/asdair/rules body, untouched */
    const asdairRules = ref(null);
    const asdairRulesErr = ref(null);
    const asdairRulesLoading = ref(false);
    async function loadAsdairRules() {
      asdairRulesLoading.value = true; asdairRulesErr.value = null;
      try {
        const r = await fetch('/api/asdair/rules', { cache: 'no-store' });
        const d = await r.json();
        if (!r.ok || !d || d.ok === false) throw new Error((d && d.error) || ('http ' + r.status));
        asdairRules.value = d;
      } catch (e) {
        asdairRulesErr.value = e.message || 'failed'; asdairRules.value = null;
      } finally {
        asdairRulesLoading.value = false;
      }
    }
    // ---- The execution packet and the basket reconciliation -----------------------------------
    // ONE read (/api/asdair/packet) carrying both halves, because they are read on one screen, for
    // one shop, at one moment. Each half is INDEPENDENTLY nullable: the packet routinely exists
    // before the reconciliation does, and the producers (WO-P/WO-S) do not exist at all yet — so
    // "not produced" is the normal state today and is rendered as a first-class answer, never as an
    // empty packet and never as an error.
    /** @type {import('vue').Ref<null|Record<string,any>>} raw /api/asdair/packet body, untouched */
    const asdairPacket = ref(null);
    const asdairPacketErr = ref(null);
    const asdairPacketLoading = ref(false);
    async function loadAsdairPacket() {
      // The shop comes from the workspace read — the browser never invents one.
      const shop = asdairShop.value && asdairShop.value.shop_id;
      if (!shop) { asdairPacketErr.value = null; asdairPacket.value = null; return; }
      asdairPacketLoading.value = true; asdairPacketErr.value = null;
      try {
        const r = await fetch('/api/asdair/packet?shop=' + encodeURIComponent(shop), { cache: 'no-store' });
        const d = await r.json();
        if (!r.ok || !d || d.ok === false) throw new Error((d && (d.error || d.message)) || ('http ' + r.status));
        asdairPacket.value = d;
      } catch (e) {
        asdairPacketErr.value = e.message || 'failed'; asdairPacket.value = null;
      } finally {
        asdairPacketLoading.value = false;
      }
    }
    // Convenience readers. Each returns null rather than a stand-in object, so the template's
    // v-if chain distinguishes "not produced" from "produced and empty" — a distinction the whole
    // honesty rule rests on.
    const asdairPacketDoc = computed(() => (asdairPacket.value && asdairPacket.value.packet) || null);
    const asdairRecon = computed(() => (asdairPacket.value && asdairPacket.value.reconciliation) || null);
    // 'not_built' (the tables do not exist) and 'not_produced' (they do, but nothing has run) are
    // different facts and Warwick is told which. Neither is an error.
    const asdairPacketState = computed(() => (asdairPacket.value && asdairPacket.value.packet_state) || 'unknown');
    const asdairReconState = computed(() => (asdairPacket.value && asdairPacket.value.reconciliation_state) || 'unknown');

    // Only the directive groups that actually hold a rule. An empty group is noise on a phone; the
    // totals above the list already say how many rules exist in all.
    const asdairRuleGroups = computed(() => {
      const g = (asdairRules.value && asdairRules.value.rules && asdairRules.value.rules.groups) || [];
      return g.filter((x) => x.items && x.items.length);
    });

    const openApp = (k) => { appViewKey.value = null; appKey.value = k; probeApp(APPS.find((a) => a.key === k)); if (k === 'asdair') loadAsdairWorkspace(); focusSel('#app-workspace-h'); };
    // `from` is the app we are leaving, so focus can return to its tile. When we are not leaving an
    // app (a plain area switch) the selector matches nothing and focus is left exactly where it is.
    const closeApp = () => {
      const was = appKey.value;
      appKey.value = null; appViewKey.value = null;
      if (was) focusSel('[data-app-tile="' + was + '"]');
    };
    // Opening the Rules tab is what triggers its read — once. A failed read is NOT retried on every
    // tab switch (asdairRulesErr stays set); the view offers an explicit Retry instead, so a service
    // that is down cannot be hammered by navigation.
    const goView = (k) => {
      appViewKey.value = k;
      if (appKey.value === 'asdair' && k === 'rules'
        && !asdairRules.value && !asdairRulesErr.value && !asdairRulesLoading.value) loadAsdairRules();
      // Same lazy pattern for the basket: its own read, fetched once when the tab is first opened.
      // Deliberately NOT loaded on openApp — it is a second round trip that most visits never need.
      if (appKey.value === 'asdair' && k === 'basket'
        && !asdairPacket.value && !asdairPacketErr.value && !asdairPacketLoading.value) loadAsdairPacket();
    };

    // Leaving an area always drops you back to the Apps GRID — tapping "Apps" while already inside
    // an app must go somewhere, not silently do nothing. The breadcrumb is the way back in.
    // Rotation reports are read ONCE, lazily, when System is first opened — the same lazy pattern as
    // goView's Rules/Basket reads. Not on mount (a round trip on every load for a tab most visits
    // never open) and not on every entry (a service that is down must not be hammered by navigation;
    // the group offers an explicit retry instead).
    const go = (k) => {
      detail.value = null; closeApp(); area.value = k;
      if (k === 'apps') probeAll();
      if (k === 'system' && !rrRequested.value) loadRotationReports();
    };
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

    // ---- System > Session / Rotation Reports ---------------------------------------------------
    // Warwick reads each /rotate report here. The whole surface turns on ONE rule, in his words:
    // "Do not convert missing values into zero. 'Unknown,' 'not established' and zero are materially
    // different." The cheapest way to lie about a session is to print 0 where nothing was measured.
    //
    // HOW THE DISTINCTION IS CARRIED — four axes, NOT ONE OF WHICH IS COLOUR:
    //   a measured number -> .rr-num : MONO, --ink, full weight, a DIGIT.
    //   an unknown        -> .rr-unk : the body face, ITALIC, --ink2, a WORD ("not established").
    // Typeface, slant, ink-weight and digit-vs-word. It therefore survives greyscale, a colour-blind
    // reader and a screen reader, none of which can see a hue. Mono is not decoration here: GL-003 §3
    // fixes it as "this is a measurement or a machine string", so the TYPEFACE ITSELF is the claim,
    // and setting an unmeasured value in the body face withdraws that claim.
    //
    // Grey, never amber (app.js:229-237): amber says "something is wrong", and a value nobody
    // measured is not a fault. Colouring uncertainty as a fault is inventing a fact, just quieter.
    //
    // THE SAME RULE AT THE AGGREGATE LEVEL, which is where it is easiest to miss: a bar's TRACK is
    // drawn only when the value is known. A real 0 renders a VISIBLE EMPTY TRACK; an unknown renders
    // NO TRACK AT ALL. A zero-width fill inside no track is exactly the collapse this file exists to
    // prevent, so the two cases are distinguishable by presence, not only by the words beside them.
    const rrReports = ref(null);    // null = never read, or the read FAILED. Never an empty list.
    const rrLoading = ref(false);
    const rrErr = ref(null);
    const rrRequested = ref(false); // false = we have not asked yet, which is not "there are none".

    // Failure is HTTP 200 with {ok:false}, so this branches on `ok` and never on r.status (the house
    // pattern, as loadAsdairPacket does). A non-JSON body throws in r.json() and lands in the same
    // catch — the read failed either way, and the UI says the read failed rather than inventing an
    // empty list.
    async function loadRotationReports() {
      rrRequested.value = true; rrLoading.value = true; rrErr.value = null;
      try {
        const r = await fetch('/api/rotation-reports', { cache: 'no-store' });
        const d = await r.json();
        if (!d || d.ok === false) throw new Error((d && d.error) || 'the cockpit could not read the rotation reports');
        rrReports.value = Array.isArray(d.reports) ? d.reports : [];
        rrOverview.value = d.overview || null;
      } catch (e) {
        // Keep reports null, NOT []. "We could not read them" and "there are none" are two facts.
        rrErr.value = e.message || 'the read failed'; rrReports.value = null; rrOverview.value = null;
      } finally { rrLoading.value = false; }
    }

    // THE EXECUTIVE VIEW, derived server-side in rotation-report.mjs. Each report also carries its
    // own `summary`, so a collapsed card needs no computation here.
    const rrOverview = ref(null);
    const rrOpenCard = ref('');
    const rrCardToggle = (id) => { rrOpenCard.value = rrOpenCard.value === id ? '' : id; };
    /** Raw metrics (L4) are a SECOND disclosure inside an opened card — never on the default view. */
    const rrRawOpen = ref('');
    const rrRawToggle = (id) => { rrRawOpen.value = rrRawOpen.value === id ? '' : id; };

    const rrList = computed(() => (Array.isArray(rrReports.value) ? rrReports.value : []));

    // ---- Reading and downloading the report itself ------------------------------------------
    //
    // The Deliverable is the SSOT; the mirror row only points at it. `/api/deliverable` already
    // reads Deliverables/ behind a basename guard, so this reuses that route rather than adding a
    // second file-serving surface. The download is built from the SAME fetched text, so what
    // Warwick reads on screen and what he saves cannot diverge.
    const rrDoc = ref(null);
    const rrDocLoading = ref(false);
    const rrDocErr = ref(null);
    const rrDocName = (p) => String(p || '').split(/[\\/]/).pop();

    async function rrOpenDoc(p) {
      const file = rrDocName(p);
      if (!file) { rrDocErr.value = 'This rotation recorded no deliverable path, so there is nothing to open.'; return; }
      rrDocLoading.value = true; rrDocErr.value = null; rrDoc.value = null;
      try {
        const r = await fetch('/api/deliverable?file=' + encodeURIComponent(file), { cache: 'no-store' });
        const d = await r.json();
        if (!d || d.ok === false) throw new Error((d && d.error) || 'the document could not be read');
        rrDoc.value = { file: d.file, text: String(d.text || '') };
      } catch (e) {
        rrDocErr.value = (e.message || 'the read failed') + ' — the report row is still correct; only the file read failed.';
      } finally { rrDocLoading.value = false; }
    }
    function rrCloseDoc() { rrDoc.value = null; rrDocErr.value = null; }

    // Downloads the bytes actually fetched. If the document is not open yet it is fetched first, so
    // the button can never silently save an empty file.
    async function rrDownloadDoc(p) {
      const file = rrDocName(p);
      if (!file) return;
      if (!rrDoc.value || rrDoc.value.file !== file) await rrOpenDoc(p);
      if (!rrDoc.value) return;
      const blob = new Blob([rrDoc.value.text], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = rrDoc.value.file;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }

    // ---- CAPAE ------------------------------------------------------------------------------
    //
    // Same contract as the rotation reports, and the same refusal to invent: `capFamilies` stays
    // null when the read FAILED, so "could not be read" never renders as "there are none".
    const capFamilies = ref(null);
    const capActive = ref([]);
    const capLoading = ref(false);
    const capErr = ref(null);
    const capRequested = ref(false);
    const capOpen = ref('');

    async function loadCapae() {
      capRequested.value = true; capLoading.value = true; capErr.value = null;
      try {
        const r = await fetch('/api/capae', { cache: 'no-store' });
        const d = await r.json();
        if (!d || d.ok === false) throw new Error((d && d.error) || 'the cockpit could not read the CAPAE record');
        capFamilies.value = Array.isArray(d.families) ? d.families : [];
        capActive.value = Array.isArray(d.active) ? d.active : [];
        capOverview.value = d.overview || null;
        capOrder.value = Array.isArray(d.ordered) ? d.ordered : [];
      } catch (e) {
        capErr.value = e.message || 'the read failed'; capFamilies.value = null; capActive.value = [];
        capOverview.value = null; capOrder.value = [];
      } finally { capLoading.value = false; }
    }

    // THE EXECUTIVE VIEW. Computed on the server (services/cockpit/capae.mjs) and carried here, so
    // what Warwick sees at a glance is asserted by capae-check.mjs rather than by reading the page.
    const capOverview = ref(null);
    const capOrder = ref([]);

    const capList = computed(() => (Array.isArray(capFamilies.value) ? capFamilies.value : []));
    /** Worst first. Falls back to the supplied order if the server sent no ordering. */
    const capRanked = computed(() => {
      const by = new Map(capList.value.map((f) => [f.slug, f]));
      const ranked = capOrder.value.map((s) => by.get(s)).filter(Boolean);
      return ranked.length ? ranked : capList.value;
    });
    const capStateMark = (s) => ({
      INEFFECTIVE: '⛔', CHALLENGED: '⚠', MONITORING: '•', UNMEASURABLE: '–', EFFECTIVE: '✓',
    }[s] || '•');
    /** One line of WHY, so a collapsed card still answers "why does this matter". */
    const capWhy = (f) => (f && (f.root_cause || f.finding || f.required_larry_behaviour)) || null;
    const capToggle = (slug) => { capOpen.value = capOpen.value === slug ? '' : slug; };
    const capActionLabel = computed(() => (capLoading.value ? 'Reading…' : capRequested.value ? 'Read again' : 'Read the CAPAE record'));

    // The state chip's tone. EFFECTIVE is the ONLY green: everything else is either unproven or in
    // doubt, and colouring MONITORING green would tell Warwick a prevention had been demonstrated
    // when no qualified exposure has occurred.
    const capTone = (s) => ({
      EFFECTIVE: 'ok', INEFFECTIVE: 'red', CHALLENGED: 'warn', UNMEASURABLE: 'mute', MONITORING: 'info',
    }[s] || 'info');
    const capCDE = (f) => {
      const o = (f && f.cause_detection_escape) || {};
      return [
        { k: 'Cause', v: o.cause || null },
        { k: 'Detection', v: o.detection || null },
        { k: 'Escape', v: o.escape || null },
      ];
    };

    // ONE trigger for the whole surface, so it is the SAME DOM element in every state and keyboard
    // focus survives a load. It used to be re-created inside two v-if branches ("Read them" and
    // "Try again"), each of which destroyed itself on click: focus fell to <body> and a keyboard
    // user had to Tab from the top of the document (WCAG 2.2 SC 2.4.3 Focus Order). The label is
    // therefore state-derived rather than branch-derived. It never disappears after a successful
    // read either — that success path destroyed focus in exactly the same way.
    const rrActionLabel = computed(() => {
      if (rrLoading.value) return 'Reading…';
      if (rrErr.value) return 'Try again';
      if (!rrRequested.value) return 'Read them';
      return 'Read them again';
    });

    // "Any field may be null" (the frozen contract). These two make a null CONTAINER degrade into a
    // field-by-field "not established" instead of throwing — so a report with `workOrders: null`
    // renders four honest unknowns rather than blanking the card.
    const rrArr = (v) => (Array.isArray(v) ? v : []);
    const rrObj = (v) => ((v && typeof v === 'object') ? v : {});
    const rrHas = (v) => v !== null && v !== undefined && v !== '';
    const rrText = (v) => (rrHas(v) ? String(v).trim() : '');

    // ORDERING IS THE PRODUCER'S GUARANTEE, NOT OURS. The cockpit never re-sorts (app.js:735). If the
    // supplied order is not most-recent-first we SURFACE it as a producer defect, exactly as the
    // packet view does for a declared sort that is not the actual sort (app.js:737-745) — quietly
    // fixing it here would hide a bug in the endpoint and cost nothing to the person who could fix
    // it. Rows with an unestablished createdAt are skipped: they cannot PROVE a break either way.
    const rrOrderBreak = computed(() => {
      const l = rrList.value;
      for (let i = 1; i < l.length; i++) {
        const a = l[i - 1] && l[i - 1].createdAt, b = l[i] && l[i].createdAt;
        if (!rrHas(a) || !rrHas(b)) continue;
        if (new Date(b).getTime() > new Date(a).getTime()) return i + 1;
      }
      return 0;
    });

    // ---- formatters. Every one FORMATS a supplied value; not one produces a figure. ----
    // Every formatter guards isFinite, and they all fail the same way: print the SUPPLIED value
    // verbatim rather than "NaN". "NaN" in .rr-num is mono, --ink, upright — the house signal for
    // "this is a measurement" (GL-003 §3) — applied to something that is not one, which is the same
    // collapse this surface exists to prevent, just at the formatter level. rrCompact and rrMins
    // already did this; rrInt and rrPct did not, so a non-numeric field printed NaN / NaN%.
    // Residual, stated rather than implied: a non-numeric still renders INSIDE .rr-num. Routing it
    // to .rr-unk instead is a change at ~15 template call sites and is not taken here.
    const rrInt = (n) => { const v = Number(n); return isFinite(v) ? v.toLocaleString('en-GB') : String(n); };
    // Big counts are abbreviated to a few significant figures on a phone rather than printed as a
    // full grouped integer. That is a ROUNDING, so the template prints "≈" wherever rrIsCompact is
    // true, and the drawer always carries the exact grouped integer alongside. An abbreviation
    // presented as exact is a small lie with no upside.
    // (No worked example is written here on purpose: AC6 forbids the report's own figures appearing
    //  as literals anywhere in this diff, and a comment is in the diff.)
    const rrIsCompact = (n) => rrHas(n) && Math.abs(Number(n)) >= 1e4;
    function rrCompact(n) {
      const v = Number(n);
      if (!isFinite(v)) return String(n);
      if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
      if (Math.abs(v) >= 1e4) return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
      return rrInt(v);
    }
    const rrPct = (n) => { const v = Number(n); return isFinite(v) ? (Math.round(v * 10) / 10) + '%' : String(n); };
    function rrMins(n) {
      const v = Math.round(Number(n));
      if (!isFinite(v)) return String(n);
      if (v < 60) return v + 'm';
      const h = Math.floor(v / 60), m = v % 60;
      return m ? h + 'h ' + m + 'm' : h + 'h';
    }
    // Bar width as a percentage of a scale. Clamped, because a producer figure over its own maximum
    // must not paint outside the track — and the printed number beside it stays the real one.
    function rrBar(v, max) {
      const m = Number(max);
      if (!isFinite(m) || m <= 0) return '0%';
      return Math.max(0, Math.min(100, (Number(v) / m) * 100)).toFixed(1) + '%';
    }

    // The allocation slices, in a fixed reading order. This hard-codes KEYS AND LABELS — schema, not
    // data — and no figure. Every number still comes from r.allocation at render time.
    const RR_ALLOC = [['productPct', 'Product'], ['adminPct', 'Admin'], ['evidencePct', 'Evidence'],
      ['reworkPct', 'Rework'], ['waitingPct', 'Waiting']];
    const rrAlloc = (r) => RR_ALLOC.map(([k, label]) => ({ label, v: rrObj(r.allocation)[k] }));
    // What the MEASURED slices account for, and whether any slice is missing. Printing a sum that
    // silently omits an unmeasured slice would imply the rest was idle time; it was not measured.
    const rrAllocSum = (r) => rrAlloc(r).reduce((n, a) => (rrHas(a.v) ? n + Number(a.v) : n), 0);
    const rrAllocGap = (r) => rrAlloc(r).some((a) => !rrHas(a.v));
    // ⚠️ THE SUM ITSELF CAN LIE, AND IT DID. When NOTHING was measured, rrAllocSum is 0 and the note
    // read "the measured slices account for 0% of the session" — a computed zero presented as a
    // measurement. That is the exact failure this surface exists to prevent, reintroduced at the
    // aggregate level, where it is easiest to miss: a total over no measurements is not 0, it is
    // not established. Found by READING the rendered degenerate row, not by a gate — every check
    // was green while that sentence was on screen.
    const rrAllocAnyKnown = (r) => rrAlloc(r).some((a) => rrHas(a.v));

    const rrCtx = (r) => [
      { label: 'Context in', v: r.contextTokensIn },
      { label: 'Context out', v: r.contextTokensOut },
      { label: 'Subagent tokens', v: r.subagentTokens },
    ];
    // Bars scale against the largest ESTABLISHED value on the same card, so the comparison is real.
    const rrMax = (rows) => rows.reduce((m, x) => (rrHas(x.v) && Number(x.v) > m ? Number(x.v) : m), 0);
    const rrCtxMax = (r) => rrMax(rrCtx(r));
    const rrSpecMax = (r) => rrMax(rrArr(r.specialists).map((s) => ({ v: s.dispatches })));
    // Product and documentation lines share one scale so the two bars are comparable to each other,
    // which is the entire question that pair of numbers is asked.
    const rrLinesMax = (r) => rrMax([{ v: rrObj(r.lines).productChanged }, { v: rrObj(r.lines).docChanged }]);

    return {
      AREAS, APPS, appKey, appViewKey, currentApp, currentView, statusOf, appTone, appStatusLine, probeApp, openApp, closeApp, goView,
      asdairWs, asdairWsErr, asdairWsLoading, asdairMediaErr, loadAsdairWorkspace, asdairShop, asdairOtherShops, asdairWaitingOn, asdairPrevOrderTotal,
      asdairMoney, asdairLineTone, asdairLineChip, asdairTally, asdairKnown,
      asdairRules, asdairRulesErr, asdairRulesLoading, loadAsdairRules, asdairRuleGroups,
      asdairPacket, asdairPacketErr, asdairPacketLoading, loadAsdairPacket,
      asdairPacketDoc, asdairRecon, asdairPacketState, asdairReconState,
      state, area, detail, busy, loading, loadErr,
      kindOf, catLabel, moduleLabel, oneLine, ago, terse, impactStars, outputTitle, humanValue, humanPoints, spinOf, mdToHtml, notifyMark, build, housekeeping, host, when,
      deliverables, openDeliverable, openBrief, copyDoc, downloadDoc, downloadTranscript, download, copyText,
      attn, deferred, archived, blocked, decisions, suggestions, needsYou, ideaCat, ideasBrain, ideasCash, latest, toneOf,
      tiBrain, tiCash, tiSpin, tiStars, mine, ideaDecide, opps, opportunityDecide, synthesise, synthing, synthMsg,
      outputs, newOutputs, itemsAdded, wins, builds,
      statusTone, statusLine, tiles, go, open, closeDetail, decide, copyTranscript, primaryAction, sourceStatus, load, REPORT, GRAPH,
      rrReports, rrLoading, rrErr, rrRequested, loadRotationReports, rrList, rrOrderBreak, rrActionLabel,
      rrDoc, rrDocLoading, rrDocErr, rrDocName, rrOpenDoc, rrCloseDoc, rrDownloadDoc,
      capFamilies, capActive, capLoading, capErr, capRequested, capOpen,
      loadCapae, capList, capToggle, capActionLabel, capTone, capCDE,
      capOverview, capRanked, capStateMark, capWhy,
      rrOverview, rrOpenCard, rrCardToggle, rrRawOpen, rrRawToggle,
      rrArr, rrObj, rrHas, rrText, rrInt, rrCompact, rrIsCompact, rrPct, rrMins, rrBar,
      rrAlloc, rrAllocSum, rrAllocGap, rrAllocAnyKnown, rrCtx, rrCtxMax, rrSpecMax, rrLinesMax,
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

            <!-- BASKET — the Sonnet execution packet, and how the basket reconciled against it.
                 Above the workspace block for the same reason Rules is: its own read, its own
                 loading and error state.

                 THE HONESTY CHAIN HERE IS THE WHOLE POINT, so read the v-if order:
                   1. no shop            -> there is nothing to have a packet FOR
                   2. read failed        -> say the read failed; show NOTHING else
                   3. packet null        -> the producer has not run. NOT an empty packet.
                   4. packet present     -> render it, in the producer's order, unsorted by us
                 A produced-but-empty packet reaches (4) and prints a measured 0. That is a
                 different fact from (3) and it looks different on screen. -->
            <template v-else-if="currentApp.key==='asdair' && currentView.key==='basket' && statusOf(currentApp).state==='up'">
              <div v-if="!asdairShop" class="empty big">No shop is in flight, so there is no execution packet to show.</div>
              <div v-else-if="asdairPacketLoading && !asdairPacket" class="empty big">Reading the execution packet…</div>
              <div v-else-if="asdairPacketErr" class="asdair-view">
                <p class="empty big">The execution packet could not be read, so nothing is shown here — that is not the same as there being no packet.</p>
                <p class="err">{{ asdairPacketErr }}</p>
                <button class="act" :disabled="asdairPacketLoading" @click="loadAsdairPacket()">{{ asdairPacketLoading ? '…' : 'Try again' }}</button>
              </div>
              <div v-else class="asdair-view">

                <!-- ── THE PACKET ─────────────────────────────────────────────────────────── -->
                <div class="grp">
                  <h2>Execution packet<span class="g-count" v-if="asdairPacketDoc">{{ asdairPacketDoc.lines_count_display }}</span></h2>

                  <!-- Not produced. Said plainly, with WHICH kind of absent it is. -->
                  <div v-if="!asdairPacketDoc" class="item grey as-stack">
                    <div class="i-main">
                      <div class="i-eyebrow">NOT PRODUCED</div>
                      <div class="i-title">No execution packet exists for this shop yet.</div>
                      <div class="as-sub" v-if="asdairPacketState==='not_built'">
                        The packet feature has not shipped yet, so nothing has been recorded. When the product generates one it will appear here, in Brand A–Z order — nothing is being guessed at in the meantime.
                      </div>
                      <div class="as-sub" v-else>
                        The packet store exists but nothing has been written for this shop. Nothing is being guessed at.
                      </div>
                    </div>
                  </div>

                  <template v-else>
                    <div class="app-status" role="status" aria-live="polite">
                      <span class="as-dot" aria-hidden="true"></span>
                      <div class="as-body">
                        <b>{{ asdairPacketDoc.lines_count_display }} products · {{ asdairPacketDoc.expected_total_units_display }} units expected</b>
                        <span> · {{ asdairPacketDoc.known_items_count_display }} known, {{ asdairPacketDoc.new_items_count_display }} new · generated {{ asdairPacketDoc.generated_at_display }}</span>
                      </div>
                      <button class="act" :disabled="asdairPacketLoading" @click="loadAsdairPacket()">{{ asdairPacketLoading ? '…' : 'Refresh' }}</button>
                    </div>
                    <p class="app-blurb">Brand A–Z, then product A–Z — the order Sonnet works in ASDA. Shown in the order it was produced; the cockpit never re-sorts it.</p>

                    <!-- A declared sort that is not the actual sort is a producer defect, and it
                         costs Sonnet real time. Loud, not swallowed. -->
                    <div v-if="!asdairPacketDoc.sort_verified" class="item red as-stack">
                      <div class="i-main">
                        <div class="i-eyebrow blocked">SORT ORDER WRONG</div>
                        <div class="i-title">This packet says it is in Brand A–Z order, but it is not.</div>
                        <div class="as-sub">The order first breaks at line {{ asdairPacketDoc.sort_first_break_display }}. It is shown exactly as produced rather than quietly reordered — the ordering is the speed in ASDA, so this is worth fixing upstream.</div>
                      </div>
                    </div>
                    <div v-if="asdairPacketDoc.identity_incomplete_count_display !== '0'" class="item amber as-stack">
                      <div class="i-main">
                        <div class="i-eyebrow">IDENTITY INCOMPLETE</div>
                        <div class="i-title">{{ asdairPacketDoc.identity_incomplete_count_display }} line(s) claim to be a known product but carry no catalogue id.</div>
                        <div class="as-sub">Both facts are shown on the line rather than resolved here — resolving it in a view would be inventing.</div>
                      </div>
                    </div>

                    <p class="empty" v-if="!asdairPacketDoc.lines.length">This packet was produced and contains no lines.</p>

                    <!-- Known vs genuinely-new is carried by the RAIL plus the WORD, never by
                         colour alone, and never by a fade (GL-003 D-17/D-18 are open). -->
                    <div v-for="l in asdairPacketDoc.lines" :key="l.seq_display" class="item as-stack"
                      :class="l.identity_incomplete ? 'amber' : (l.is_new ? 'blue' : 'green')">
                      <div class="i-main">
                        <div class="i-eyebrow">
                          {{ l.seq_display }} · <span v-if="l.is_new">NEW ITEM</span><span v-else-if="l.is_known">KNOWN</span><span v-else>ORIGIN UNKNOWN</span>
                          · {{ l.source_view_meaning }}
                        </div>
                        <div class="i-title">{{ l.canonical_product_name_display }}<span v-if="l.has_brand"> — {{ l.brand_display }}</span></div>
                        <!-- .as-sub, NOT .i-why: .i-why is nowrap+ellipsis, and the verbatim list
                             line is the thing being verified. Truncating it defeats the screen. -->
                        <div class="as-sub">Written on the list as “{{ l.original_list_line_display }}”.</div>
                        <div class="as-sub" v-if="l.is_new && l.approved_search_term_display !== 'unknown'">
                          Searched for as “{{ l.approved_search_term_display }}” — your wording, not the model's.
                        </div>
                        <div class="as-sub" v-if="l.identity_incomplete">
                          This line says it is a known product but carries no catalogue id. Both are shown; neither is resolved here.
                        </div>
                        <!-- WHY the quantity is what it is. The reason this surface exists at all,
                             so it MUST wrap — a rationale like "list said 3; rule 37 rounds up to 4
                             for the any-2-for-X offer" is exactly the sentence an ellipsis eats. -->
                        <div class="as-sub strong" v-if="l.has_quantity_rationale">Why {{ l.required_quantity_display }}: {{ l.quantity_rationale_display }}</div>
                        <div class="as-note" v-else>No reason was recorded for this quantity.</div>
                        <div class="as-sub" v-if="l.has_applied_rules">Rules applied: {{ l.applied_rules.join(', ') }}</div>
                        <div class="fresh">
                          <span v-if="l.asda_product_ref_display !== 'unknown'">ASDA ref {{ l.asda_product_ref_display }}</span>
                          <span v-else>no ASDA reference recorded</span>
                          · substitutes {{ l.substitutes_allowed_display }}
                        </div>
                      </div>
                      <div class="i-side">
                        <span class="chip prog"><span class="d" aria-hidden="true"></span>×{{ l.required_quantity_display }}</span>
                      </div>
                    </div>

                    <!-- Held: deliberately NOT in the basket. Present so nothing is silently dropped. -->
                    <template v-if="asdairPacketDoc.held.length">
                      <h3 class="as-sec">Held back<span class="g-count">{{ asdairPacketDoc.held_count_display }}</span></h3>
                      <p class="as-meaning">Deliberately not in the basket. Nothing here has been substituted — substitution is not a permitted outcome anywhere in this product.</p>
                      <div v-for="(h,i) in asdairPacketDoc.held" :key="'h'+i" class="item amber as-stack">
                        <div class="i-main">
                          <div class="i-eyebrow">HELD · {{ h.reason_display }}</div>
                          <div class="i-title">{{ h.original_list_line_display }}</div>
                          <div class="as-sub">{{ h.reason_meaning }}<span v-if="h.detail_display !== 'unknown'"> — {{ h.detail_display }}</span></div>
                        </div>
                      </div>
                    </template>
                  </template>
                </div>

                <!-- ── RECONCILIATION ─────────────────────────────────────────────────────── -->
                <div class="grp">
                  <h2>Reconciliation</h2>

                  <div v-if="!asdairRecon" class="item grey as-stack">
                    <div class="i-main">
                      <div class="i-eyebrow">NOT RUN</div>
                      <div class="i-title">The basket has not been reconciled yet.</div>
                      <div class="as-sub" v-if="asdairReconState==='not_built'">
                        Reconciliation has not shipped yet. Nothing has been compared, and no count on this screen should be read as a check having passed.
                      </div>
                      <div class="as-sub" v-else>
                        Nothing has been recorded for this shop. Nothing has been compared.
                      </div>
                    </div>
                  </div>

                  <template v-else>
                    <!-- The verdict is computed server-side in tested code, precisely so the browser
                         cannot reach a friendlier conclusion than the evidence supports. -->
                    <div class="app-status" :class="asdairRecon.fully_reconciled ? 'up' : 'down'" role="status" aria-live="polite">
                      <span class="as-dot" aria-hidden="true"></span>
                      <div class="as-body">
                        <b v-if="asdairRecon.fully_reconciled">Everything matched.</b>
                        <b v-else-if="asdairRecon.counts_agree_but_lines_do_not">The totals agree, but the basket does not.</b>
                        <b v-else>The basket does not match what was expected.</b>
                        <span> Reconciled {{ asdairRecon.reconciled_at_display }}.</span>
                      </div>
                    </div>

                    <!-- Expected vs actual, side by side. A matching headline count is never
                         presented as proof on its own — ruling §3. -->
                    <div class="item as-stack" :class="asdairRecon.distinct_products_match ? 'green' : 'amber'">
                      <div class="i-main">
                        <div class="i-eyebrow">DISTINCT PRODUCTS</div>
                        <div class="i-title">{{ asdairRecon.actual_distinct_products_display }} in the basket · {{ asdairRecon.expected_distinct_products_display }} expected</div>
                        <div class="as-sub" v-if="!asdairRecon.distinct_products_match">These do not agree.</div>
                      </div>
                    </div>
                    <div class="item as-stack" :class="asdairRecon.total_units_match ? 'green' : 'amber'">
                      <div class="i-main">
                        <div class="i-eyebrow">TOTAL UNITS</div>
                        <div class="i-title">{{ asdairRecon.actual_total_units_display }} in the basket · {{ asdairRecon.expected_total_units_display }} expected</div>
                        <div class="as-sub" v-if="!asdairRecon.total_units_match">These do not agree.</div>
                      </div>
                    </div>
                    <div v-if="asdairRecon.counts_agree_but_lines_do_not" class="item red as-stack">
                      <div class="i-main">
                        <div class="i-eyebrow blocked">COUNTS AGREE, LINES DO NOT</div>
                        <div class="i-title">{{ asdairRecon.mismatched_lines_count_display }} line(s) are wrong despite the totals matching.</div>
                        <div class="as-sub">A matching headline count is not proof: the wrong product, or the wrong quantity of the right product, produces exactly these totals.</div>
                      </div>
                    </div>

                    <h3 class="as-sec">Line by line<span class="g-count">{{ asdairRecon.lines_count_display }}</span></h3>
                    <p class="empty" v-if="!asdairRecon.lines.length">No lines were recorded in this reconciliation.</p>
                    <div v-for="l in asdairRecon.lines" :key="'r'+l.seq_display" class="item as-stack" :class="l.is_match ? 'green' : 'red'">
                      <div class="i-main">
                        <div class="i-eyebrow" :class="l.is_match ? '' : 'blocked'">{{ l.seq_display }} · {{ l.identity_meaning }} · {{ l.quantity_meaning }}</div>
                        <div class="i-title">{{ l.canonical_product_name_display }}<span v-if="l.brand_display !== 'unknown'"> — {{ l.brand_display }}</span></div>
                        <div class="as-sub">{{ l.actual_quantity_display }} in the basket · {{ l.expected_quantity_display }} expected</div>
                        <div class="as-sub" v-if="l.identity_match_display==='different_product'">
                          Expected ASDA ref {{ l.expected_product_ref_display }}, found {{ l.actual_product_ref_display }}.
                        </div>
                        <div class="as-sub" v-if="l.detail_display !== 'unknown'">{{ l.detail_display }}</div>
                      </div>
                    </div>

                    <!-- Unavailable: visibly distinct from the lines above, by rail AND by word. -->
                    <template v-if="asdairRecon.unavailable.length">
                      <h3 class="as-sec">Not available<span class="g-count">{{ asdairRecon.unavailable_count_display }}</span></h3>
                      <p class="as-meaning">Wanted, but not in the basket. Nothing here was substituted.</p>
                      <div v-for="(u,i) in asdairRecon.unavailable" :key="'u'+i" class="item amber as-stack">
                        <div class="i-main">
                          <div class="i-eyebrow">UNAVAILABLE · {{ u.reason_display }}</div>
                          <div class="i-title">{{ u.canonical_product_name_display }}</div>
                          <div class="as-sub">{{ u.reason_meaning }}<span v-if="u.original_list_line_display !== 'unknown'"> · written as “{{ u.original_list_line_display }}”</span></div>
                        </div>
                      </div>
                    </template>

                    <template v-if="asdairRecon.unexpected.length">
                      <h3 class="as-sec">Not on the plan<span class="g-count">{{ asdairRecon.unexpected_count_display }}</span></h3>
                      <p class="as-meaning">In the basket but not in the packet. A headline count alone hides this.</p>
                      <div v-for="(u,i) in asdairRecon.unexpected" :key="'x'+i" class="item red as-stack">
                        <div class="i-main">
                          <div class="i-eyebrow blocked">UNEXPECTED</div>
                          <div class="i-title">{{ u.canonical_product_name_display }}</div>
                          <div class="as-sub">×{{ u.actual_quantity_display }} in the basket, not requested.</div>
                        </div>
                      </div>
                    </template>

                    <!-- Ruling §3 requires POSITIVE confirmation that none of these happened.
                         "not confirmed" is rendered as its own state — never as a reassuring no. -->
                    <h3 class="as-sec">Nothing was bought</h3>
                    <div class="item as-stack" :class="asdairRecon.no_purchase_action_confirmed ? 'green' : 'amber'">
                      <div class="i-main">
                        <div class="i-eyebrow">CONFIRMATION</div>
                        <div class="i-title" v-if="asdairRecon.no_purchase_action_confirmed">No checkout, no payment, no slot booked — all three confirmed.</div>
                        <div class="i-title" v-else>Not all three could be confirmed.</div>
                        <div class="as-sub">Checkout: {{ asdairRecon.checkout_performed.display }} · Payment: {{ asdairRecon.payment_performed.display }} · Slot booked: {{ asdairRecon.slot_booked.display }}</div>
                        <div class="as-sub" v-if="!asdairRecon.no_purchase_action_confirmed">“Not confirmed” means nobody checked — it does not mean it did not happen.</div>
                      </div>
                    </div>
                  </template>
                </div>

                <details class="tech">
                  <summary>Raw payload (debugging only)</summary>
                  <pre class="mono">{{ JSON.stringify(asdairPacket, null, 2) }}</pre>
                </details>
              </div>
            </template>

            <!-- RULES — the durable rulebook. DELIBERATELY ABOVE the workspace block and gated only
                 on the service being up, never on asdairShop: the rulebook is shop-independent, and a
                 household with no shop in flight still has rules worth reading. Its own read
                 (/api/asdair/rules), its own loading and error state. -->
            <template v-else-if="currentApp.key==='asdair' && currentView.key==='rules' && statusOf(currentApp).state==='up'">
              <div v-if="asdairRulesLoading && !asdairRules" class="empty big">Reading the rulebook…</div>
              <div v-else-if="asdairRulesErr || !asdairRules" class="asdair-view">
                <p class="empty big">The rulebook could not be read, so nothing is shown here — that is not the same as an empty rulebook.</p>
                <p class="err" v-if="asdairRulesErr">{{ asdairRulesErr }}</p>
                <button class="act" :disabled="asdairRulesLoading" @click="loadAsdairRules()">{{ asdairRulesLoading ? '…' : 'Try again' }}</button>
              </div>
              <div v-else class="asdair-view">
                <div class="app-status up" role="status" aria-live="polite">
                  <span class="as-dot" aria-hidden="true"></span>
                  <div class="as-body"><b>{{ asdairRules.rules.active_display }} active rules</b><span> · {{ asdairRules.decisions.total_display }} recorded decisions · {{ asdairRules.regulars.active_display }} active regulars</span></div>
                  <button class="act" :disabled="asdairRulesLoading" @click="loadAsdairRules()">{{ asdairRulesLoading ? '…' : 'Refresh' }}</button>
                </div>
                <p class="app-blurb">Read-only. Nothing on this screen is edited from the cockpit — rules change through the same command surface the Telegram bot uses.</p>

                <!-- STANDING RULES, grouped by what they DO. A directive name without its
                     consequence is just a label, so every group prints its meaning. -->
                <div class="grp">
                  <h2>Standing rules<span class="g-count">{{ asdairRules.rules.total_display }}</span></h2>
                  <p class="as-sub" v-if="asdairRules.rules.without_note_display !== '0'">
                    {{ asdairRules.rules.without_note_display }} of these carry no recorded detail. They are shown anyway — a rule that cannot explain itself is exactly the thing worth spotting.
                  </p>
                  <p class="empty" v-if="!asdairRuleGroups.length">No rules are recorded for this household.</p>
                  <template v-for="g in asdairRuleGroups" :key="g.directive">
                    <h3 class="as-sec">{{ g.directive_display }}<span class="g-count">{{ g.count_display }}</span></h3>
                    <p class="as-meaning">{{ g.meaning }}</p>
                    <div v-for="r in g.items" :key="r.id_display" class="item as-stack"
                      :class="r.active ? (r.directive==='exclude' ? 'red' : r.directive==='needs_decision' ? 'amber' : 'green') : 'grey'">
                      <div class="i-main">
                        <div class="i-eyebrow">#{{ r.id_display }} · {{ r.category_display }}<span v-if="r.scope_is_global"> · applies to every household</span></div>
                        <div class="as-raw">{{ r.rule_text_display }}</div>
                        <div class="as-sub strong" v-if="r.has_matched_product">→ always: {{ r.matched_product_display }}</div>
                        <div class="as-chips">
                          <span class="chip" :class="r.active ? 'ok' : 'neutral'"><span class="d" aria-hidden="true"></span>{{ r.active ? 'active' : 'not active' }}</span>
                          <span class="chip neutral" v-if="asdairKnown(r.match_term_display)"><span class="d" aria-hidden="true"></span>when the list says “{{ r.match_term_display }}”</span>
                          <span class="chip neutral" v-if="asdairKnown(r.match_category_display)"><span class="d" aria-hidden="true"></span>category: {{ r.match_category_display }}</span>
                          <span class="chip warn" v-if="!r.has_target"><span class="d" aria-hidden="true"></span>no target recorded</span>
                          <span class="chip warn" v-if="r.is_superseded"><span class="d" aria-hidden="true"></span>superseded by #{{ r.superseded_by_display }}</span>
                        </div>
                        <div class="as-sub" v-if="r.has_reason">Why: {{ r.reason_display }}</div>
                        <div class="as-sub" v-if="r.has_note">Note: {{ r.note_display }}</div>
                        <div class="as-note" v-else>No detail recorded against this rule.</div>
                      </div>
                    </div>
                  </template>
                </div>

                <!-- THE DECISION HISTORY. The pairing that matters: a STANDING answer with no rule
                     behind it is policy the planner cannot act on. -->
                <div class="grp">
                  <h2>Decisions given<span class="g-count">{{ asdairRules.decisions.total_display }}</span></h2>
                  <div class="as-chips">
                    <span class="chip ok"><span class="d" aria-hidden="true"></span>{{ asdairRules.decisions.standing_display }} standing</span>
                    <span class="chip neutral"><span class="d" aria-hidden="true"></span>{{ asdairRules.decisions.promoted_display }} became a rule</span>
                    <span class="chip warn" v-if="asdairRules.decisions.unpromoted_standing_display !== '0'"><span class="d" aria-hidden="true"></span>{{ asdairRules.decisions.unpromoted_standing_display }} standing with no rule</span>
                  </div>
                  <p class="as-sub" v-if="asdairRules.decisions.unpromoted_standing_display !== '0'">
                    The planner acts on rules, not on this log. An answer marked “applies going forward” with no rule behind it will not change a basket.
                  </p>
                  <p class="empty" v-if="!asdairRules.decisions.items.length">No decisions have been recorded yet.</p>
                  <div v-for="d in asdairRules.decisions.items" :key="'qa'+d.id_display" class="item as-stack"
                    :class="d.applies_going_forward ? (d.was_promoted ? 'green' : 'amber') : 'grey'">
                    <div class="i-main">
                      <div class="i-eyebrow">#{{ d.id_display }} · asked {{ d.asked_on_display }}</div>
                      <div class="as-raw">{{ d.question_display }}</div>
                      <div class="as-sub strong">→ {{ d.answer_display }}</div>
                      <div class="as-chips">
                        <span class="chip" :class="d.applies_going_forward ? 'ok' : 'neutral'"><span class="d" aria-hidden="true"></span>{{ d.applies_going_forward ? 'applies going forward' : 'one-off answer' }}</span>
                        <span class="chip ok" v-if="d.was_promoted"><span class="d" aria-hidden="true"></span>became rule #{{ d.promoted_rule_id_display }}</span>
                        <span class="chip warn" v-else-if="d.applies_going_forward"><span class="d" aria-hidden="true"></span>never became a rule</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- THE CATALOGUE. Aliases are the point — they are how “choc yazoo” resolves. -->
                <div class="grp">
                  <h2>Regulars &amp; aliases<span class="g-count">{{ asdairRules.regulars.total_display }}</span></h2>
                  <div class="as-chips">
                    <span class="chip ok"><span class="d" aria-hidden="true"></span>{{ asdairRules.regulars.active_display }} active</span>
                    <span class="chip neutral"><span class="d" aria-hidden="true"></span>{{ asdairRules.regulars.alias_total_display }} aliases on {{ asdairRules.regulars.with_aliases_display }} {{ asdairRules.regulars.with_aliases_display === '1' ? 'product' : 'products' }}</span>
                    <span class="chip warn" v-if="asdairRules.regulars.without_product_id_display !== '0'"><span class="d" aria-hidden="true"></span>{{ asdairRules.regulars.without_product_id_display }} active with no ASDA id</span>
                  </div>
                  <p class="empty" v-if="!asdairRules.regulars.items.length">The household catalogue is empty.</p>
                  <div v-for="rg in asdairRules.regulars.items" :key="'rg'+rg.id_display" class="item as-stack" :class="rg.active ? 'green' : 'grey'">
                    <div class="i-main">
                      <div class="i-eyebrow">#{{ rg.id_display }}<span v-if="asdairKnown(rg.category_display)"> · {{ rg.category_display }}</span><span v-if="!rg.active"> · not active</span></div>
                      <div class="as-raw">{{ rg.name_display }}</div>
                      <div class="as-chips">
                        <span class="chip" :class="rg.has_product_id ? 'neutral' : 'warn'"><span class="d" aria-hidden="true"></span>{{ rg.has_product_id ? 'ASDA ' + rg.asda_product_id_display : 'no ASDA id' }}</span>
                        <span class="chip neutral" v-if="asdairKnown(rg.typical_qty_display)"><span class="d" aria-hidden="true"></span>usually {{ rg.typical_qty_display }}</span>
                        <span class="chip neutral"><span class="d" aria-hidden="true"></span>{{ rg.substitutes_allowed_display === 'yes' ? 'substitutes allowed' : 'no substitutes' }}</span>
                      </div>
                      <div v-if="rg.has_aliases">
                        <div class="as-sub">Also written as:</div>
                        <div class="as-tags"><span v-for="(a,ai) in rg.aka" :key="'a'+ai" class="as-tag">{{ a }}</span></div>
                      </div>
                      <div class="as-note" v-else>No aliases recorded — only this exact name will match.</div>
                    </div>
                  </div>
                </div>

                <details class="tech">
                  <summary>Raw payload (debugging only)</summary>
                  <div class="tech-body"><div class="mono raw">{{ JSON.stringify(asdairRules, null, 2) }}</div></div>
                </details>
              </div>
            </template>

            <!-- AsdAIr Overview/Details — both need the SHOP workspace, so both sit behind it. Reads
                 the read-only workspace proxy (server.mjs apiAsdairWorkspace) — never invents a field
                 the API didn't report. Every other app below is untouched. -->
            <template v-else-if="currentApp.key==='asdair' && statusOf(currentApp).state==='up'">
              <div v-if="asdairWsLoading && !asdairWs" class="empty big">Loading AsdAIr’s workspace…</div>
              <div v-else-if="asdairWsErr || !asdairShop" class="empty big">{{ currentApp.offline }}</div>

              <!-- OVERVIEW -->
              <div v-else-if="currentView.key==='overview'" class="asdair-view">
                <div class="app-status up" role="status" aria-live="polite">
                  <span class="as-dot" aria-hidden="true"></span>
                  <div class="as-body"><b>{{ asdairShop.stage_label_display }}</b><span> — {{ asdairShop.shop_ref_display }}</span></div>
                  <button class="act" :disabled="asdairWsLoading" @click="loadAsdairWorkspace()">{{ asdairWsLoading ? '…' : 'Refresh' }}</button>
                </div>
                <p class="app-blurb">{{ asdairWaitingOn(asdairShop) }}</p>

                <div class="grp">
                  <h2>This shop</h2>
                  <div class="item grey">
                    <div class="i-main"><div class="i-eyebrow">Lines</div><div class="i-title">{{ asdairShop.lines_summary.resolved_display }} resolved of {{ asdairShop.lines_summary.total_display }} · {{ asdairShop.lines_summary.open_display }} open</div></div>
                  </div>
                  <div class="item grey">
                    <div class="i-main"><div class="i-eyebrow">Questions</div><div class="i-title">{{ (asdairWs.questions && asdairWs.questions.open_count_display) || 'unknown' }} open</div></div>
                  </div>
                  <div class="item grey">
                    <div class="i-main"><div class="i-eyebrow">Previous order</div>
                      <div class="i-title">{{ asdairPrevOrderTotal(asdairWs.history && asdairWs.history.previous_order) || (asdairWs.plan && asdairWs.plan.prior_order_known ? 'on file — see Technical below' : 'none on file') }}</div>
                    </div>
                  </div>
                </div>

                <div class="grp" v-if="asdairOtherShops.length">
                  <h2>Other shops<span class="g-count">{{ asdairOtherShops.length }}</span></h2>
                  <div v-for="s in asdairOtherShops" :key="s.id" class="item grey">
                    <div class="i-main"><div class="i-eyebrow">{{ s.status }}</div><div class="i-title">{{ s.shop_ref }}</div></div>
                  </div>
                </div>

                <details class="tech">
                  <summary>Raw payload (debugging only)</summary>
                  <div class="tech-body">
                    <p class="as-note">The readable version of all of this is on the Details tab.</p>
                    <div class="mono raw">{{ JSON.stringify({ history: asdairWs.history, plan: asdairWs.plan, browser: asdairWs.browser, order: asdairWs.order }, null, 2) }}</div>
                  </div>
                </details>
              </div>

              <!-- DETAILS — the VERIFICATION screen. Every section below reads named fields the API
                   actually reports; there is no JSON.stringify anywhere on a primary reading path.
                   The raw drawer at the bottom is a debugging last resort, not the content. -->
              <div v-else-if="currentView.key==='details'" class="asdair-view">
                <div class="grp">
                  <h2>Evidence</h2>
                  <img v-if="asdairWs.evidence && asdairWs.evidence.has_media && !asdairMediaErr" class="asdair-photo"
                    :src="'/api/asdair/media?shop=' + asdairShop.shop_id" :alt="'Photo of the list for ' + asdairShop.shop_ref_display"
                    @error="asdairMediaErr = true" />
                  <p v-if="asdairMediaErr" class="err">The photo could not be loaded.</p>
                  <p v-if="!(asdairWs.evidence && asdairWs.evidence.has_media)" class="empty">No photo evidence on file for this shop.</p>
                  <dl class="as-kv" v-if="asdairWs.evidence">
                    <div><dt>Source</dt><dd>{{ asdairWs.evidence.source_kind_display }}</dd></div>
                    <div><dt>Transcript</dt><dd>{{ asdairWs.evidence.transcript_display }}</dd></div>
                    <div v-if="asdairKnown(asdairWs.evidence.transcript_provider_display)"><dt>Read by</dt><dd>{{ asdairWs.evidence.transcript_provider_display }}<span v-if="asdairKnown(asdairWs.evidence.transcript_model_display)"> · {{ asdairWs.evidence.transcript_model_display }}</span></dd></div>
                    <div><dt>Confidence</dt><dd>{{ asdairWs.evidence.transcript_confidence_display }}</dd></div>
                    <div><dt>Needs review</dt><dd>{{ asdairWs.evidence.needs_review_display }}</dd></div>
                  </dl>
                </div>

                <!-- WHAT MUM WROTE vs WHAT IT MATCHED. The whole point of this screen. -->
                <div class="grp">
                  <h2>Every line<span class="g-count">{{ (asdairWs.interpretation && asdairWs.interpretation.total_lines_display) || '0' }}</span></h2>
                  <div class="as-chips" v-if="asdairTally.length">
                    <span v-for="t in asdairTally" :key="t.key" class="chip" :class="t.chip"><span class="d" aria-hidden="true"></span>{{ t.n }} {{ t.label }}</span>
                  </div>
                  <p class="as-sub" v-if="asdairWs.interpretation && asdairKnown(asdairWs.interpretation.catalogue_size_display)">
                    Matched against {{ asdairWs.interpretation.catalogue_size_display }} products in the household catalogue.
                  </p>
                  <p class="empty" v-if="!asdairWs.interpretation || !asdairWs.interpretation.lines || !asdairWs.interpretation.lines.length">Not interpreted yet — no lines have been read off the list.</p>
                  <div v-else v-for="(ln,i) in asdairWs.interpretation.lines" :key="i" class="item as-stack" :class="asdairLineTone(ln.status)">
                    <div class="i-main">
                      <div class="i-eyebrow">Line {{ ln.line_no }}<span v-if="asdairKnown(ln.quantity_display)"> · qty {{ ln.quantity_display }}</span></div>
                      <!-- Verbatim, never truncated: this is the evidence being verified. -->
                      <div class="as-raw">{{ ln.raw_reading_display }}</div>
                      <div class="as-sub strong" v-if="asdairKnown(ln.canonical_product_name_display)">→ {{ ln.canonical_product_name_display }}</div>
                      <div class="as-note" v-else>No catalogue match — nothing has been chosen for this line.</div>
                      <div class="as-chips">
                        <span class="chip" :class="asdairLineChip(ln.status)"><span class="d" aria-hidden="true"></span>{{ ln.status_label || ln.status }}</span>
                        <span class="chip neutral" v-if="asdairKnown(ln.plan_status_display)"><span class="d" aria-hidden="true"></span>plan: {{ ln.plan_status_display }}</span>
                        <span class="chip neutral" v-if="asdairKnown(ln.match_basis_display)"><span class="d" aria-hidden="true"></span>{{ ln.match_basis_display }}</span>
                        <span class="chip neutral" v-if="asdairKnown(ln.confidence_display)"><span class="d" aria-hidden="true"></span>confidence {{ ln.confidence_display }}</span>
                        <span class="chip neutral" v-if="asdairKnown(ln.matched_regular_id_display)"><span class="d" aria-hidden="true"></span>catalogue #{{ ln.matched_regular_id_display }}</span>
                        <span class="chip neutral" v-if="asdairKnown(ln.asda_product_id_display)"><span class="d" aria-hidden="true"></span>ASDA {{ ln.asda_product_id_display }}</span>
                      </div>
                      <div class="as-sub" v-if="asdairKnown(ln.note_display)">Note: {{ ln.note_display }}</div>
                      <div v-if="ln.alternatives && ln.alternatives.length">
                        <div class="as-sub">Alternatives offered — none is chosen automatically:</div>
                        <div class="as-tags">
                          <span v-for="(a,ai) in ln.alternatives" :key="ai" class="as-tag">{{ a.alternative_name_display || a.label_display || a.alternative_name || a.name }}<span v-if="a.chosen"> ✓ chosen</span></span>
                        </div>
                      </div>
                      <div class="as-sub" v-for="(w,wi) in (ln.integrity_warnings || [])" :key="'w'+wi">⚠ {{ w }}</div>
                    </div>
                  </div>
                </div>

                <!-- THE PLAN. Three lists, each saying what it means. -->
                <div class="grp" v-if="asdairWs.plan">
                  <h2>The plan<span class="g-count">{{ asdairWs.plan.counts ? asdairWs.plan.counts.resolved_display + ' / ' + asdairWs.plan.counts.held_display + ' / ' + asdairWs.plan.counts.excluded_display : '' }}</span></h2>
                  <p class="as-sub">Resolved = ready to add · Held = waiting on something · Excluded = deliberately left off.</p>
                  <template v-for="grp in [
                      {k:'resolved', h:'Resolved — ready to add', tone:'green', empty:'Nothing is resolved yet.'},
                      {k:'held',     h:'Held — waiting on something', tone:'amber', empty:'Nothing is being held.'},
                      {k:'excluded', h:'Excluded — deliberately left off', tone:'red', empty:'Nothing has been excluded.'},
                      {k:'unclassified', h:'Unclassified', tone:'grey', empty:''}]" :key="grp.k">
                    <template v-if="(asdairWs.plan[grp.k] || []).length || grp.empty">
                      <h3 class="as-sec">{{ grp.h }}<span class="g-count">{{ (asdairWs.plan[grp.k] || []).length }}</span></h3>
                      <p class="empty" v-if="!(asdairWs.plan[grp.k] || []).length">{{ grp.empty }}</p>
                      <div v-for="(p,pi) in (asdairWs.plan[grp.k] || [])" :key="grp.k+pi" class="item as-stack" :class="grp.tone">
                        <div class="i-main">
                          <div class="i-eyebrow">Line {{ p.line_no }}<span v-if="asdairKnown(p.requested_qty_display)"> · asked for {{ p.requested_qty_display }}</span><span v-if="asdairKnown(p.added_qty_display)"> · added {{ p.added_qty_display }}</span></div>
                          <div class="as-raw">{{ p.raw_reading_display }}</div>
                          <div class="as-sub strong" v-if="asdairKnown(p.canonical_product_name_display)">→ {{ p.canonical_product_name_display }}</div>
                          <div class="as-note" v-else>No catalogue match on this line.</div>
                          <div class="as-chips">
                            <span class="chip neutral" v-if="asdairKnown(p.plan_status_display)"><span class="d" aria-hidden="true"></span>{{ p.plan_status_display }}</span>
                            <span class="chip" :class="p.in_prior_order ? 'ok' : 'neutral'"><span class="d" aria-hidden="true"></span>{{ p.prior_order_context }}</span>
                            <span class="chip neutral" v-if="asdairKnown(p.applied_rule_id_display)"><span class="d" aria-hidden="true"></span>rule #{{ p.applied_rule_id_display }}</span>
                          </div>
                          <div class="as-sub" v-if="asdairKnown(p.applied_rule_display)">Why: {{ p.applied_rule_display }}</div>
                        </div>
                      </div>
                    </template>
                  </template>
                </div>

                <!-- THE TIMELINE. A real event list; failures are a red rail AND the word "failure". -->
                <div class="grp" v-if="asdairWs.timeline && asdairWs.timeline.length">
                  <h2>What happened<span class="g-count">{{ asdairWs.timeline.length }}</span></h2>
                  <div v-for="(ev,ei) in asdairWs.timeline" :key="'ev'+ei" class="item as-stack" :class="ev.is_failure ? 'red' : 'grey'">
                    <div class="i-main">
                      <div class="i-eyebrow" :class="{blocked: ev.is_failure}">{{ ev.event_type_display }}<span v-if="asdairKnown(ev.from_display) || asdairKnown(ev.to_display)"> · {{ ev.from_display }} → {{ ev.to_display }}</span></div>
                      <div class="as-raw">{{ ev.description_display }}</div>
                      <div class="as-chips">
                        <span v-if="ev.is_failure" class="chip block"><span class="d" aria-hidden="true"></span>failure</span>
                        <span class="chip neutral"><span class="d" aria-hidden="true"></span>{{ ev.occurred_at_display }}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- BROWSER. A request is a request — the payload says so and so does this. -->
                <div class="grp" v-if="asdairWs.browser">
                  <h2>Basket build</h2>
                  <p class="empty" v-if="!asdairWs.browser.requested">No basket build has been requested for this shop.</p>
                  <template v-else>
                    <dl class="as-kv">
                      <div><dt>Status</dt><dd>{{ asdairWs.browser.status_display }}<span v-if="asdairWs.browser.is_paused"> (paused)</span></dd></div>
                      <div><dt>Requested</dt><dd>{{ asdairWs.browser.requested_at_display }}</dd></div>
                      <div><dt>Claimed</dt><dd>{{ asdairWs.browser.claimed_at_display }}</dd></div>
                      <div><dt>Finished</dt><dd>{{ asdairWs.browser.finished_at_display }}</dd></div>
                      <div><dt>Runner</dt><dd>{{ asdairWs.browser.claimed_by_display }}</dd></div>
                      <div><dt>Basket lines</dt><dd>{{ asdairWs.browser.basket_lines_display }}<span v-if="asdairKnown(asdairWs.browser.basket_lines_source_display)"> (from {{ asdairWs.browser.basket_lines_source_display }})</span></dd></div>
                      <div><dt>Regulars added</dt><dd>{{ asdairWs.browser.regulars_added_display }}</dd></div>
                      <div><dt>Searched added</dt><dd>{{ asdairWs.browser.searched_items_added_display }}</dd></div>
                      <div><dt>Estimated total</dt><dd>{{ asdairMoney(asdairWs.browser.estimated_total) || 'unknown' }}</dd></div>
                      <div v-if="asdairKnown(asdairWs.browser.last_error_display)"><dt>Last error</dt><dd class="err">{{ asdairWs.browser.last_error_display }}</dd></div>
                    </dl>
                    <template v-if="asdairWs.browser.held_items && asdairWs.browser.held_items.length">
                      <h3 class="as-sec">Held by the runner<span class="g-count">{{ asdairWs.browser.held_items.length }}</span></h3>
                      <div v-for="(h,hi) in asdairWs.browser.held_items" :key="'h'+hi" class="item as-stack amber">
                        <div class="i-main"><div class="as-raw">{{ h.label_display }}</div><div class="as-sub" v-if="asdairKnown(h.reason_display)">{{ h.reason_display }}</div></div>
                      </div>
                    </template>
                    <template v-if="asdairWs.browser.pending_actions && asdairWs.browser.pending_actions.length">
                      <h3 class="as-sec">Still to do in the browser<span class="g-count">{{ asdairWs.browser.pending_actions.length }}</span></h3>
                      <div v-for="(a,ai) in asdairWs.browser.pending_actions" :key="'pa'+ai" class="item as-stack amber">
                        <div class="i-main">
                          <div class="i-eyebrow">{{ a.action_type_display }}</div>
                          <div class="as-raw">{{ a.action_key_display }}</div>
                          <div class="as-sub" v-if="asdairKnown(a.note_display)">{{ a.note_display }}</div>
                        </div>
                      </div>
                    </template>
                    <p class="as-note">{{ asdairWs.browser.boundary }}</p>
                  </template>
                </div>

                <!-- ORDER / RECONCILE. Money always prints the display string that carries its basis. -->
                <div class="grp" v-if="asdairWs.order">
                  <h2>Order confirmation</h2>
                  <p class="empty" v-if="!asdairWs.order.received">No order confirmation has been received for this shop, so nothing has been reconciled.</p>
                  <template v-else>
                    <dl class="as-kv">
                      <div><dt>Confirmation</dt><dd>{{ asdairWs.order.confirmation_id_display }}</dd></div>
                      <div><dt>Source</dt><dd>{{ asdairWs.order.source_kind_display }}</dd></div>
                      <div><dt>Received</dt><dd>{{ asdairWs.order.received_at_display }}</dd></div>
                      <div><dt>Reconciled</dt><dd>{{ asdairWs.order.reconciled_at_display }}</dd></div>
                      <div><dt>ASDA stated</dt><dd>{{ asdairMoney(asdairWs.order.stated_total) || 'unknown' }}</dd></div>
                      <div><dt>Our figure</dt><dd>{{ asdairMoney(asdairWs.order.reported_total) || 'unknown' }}</dd></div>
                      <div><dt>Lines</dt><dd>{{ asdairWs.order.lines_count_display }}</dd></div>
                    </dl>
                    <p class="as-note" v-if="asdairKnown(asdairWs.order.price_basis_note)">{{ asdairWs.order.price_basis_note }}</p>
                    <template v-if="asdairWs.order.lines && asdairWs.order.lines.length">
                      <h3 class="as-sec">Lines on the confirmation<span class="g-count">{{ asdairWs.order.lines.length }}</span></h3>
                      <div v-for="(ol,oi) in asdairWs.order.lines" :key="'ol'+oi" class="item as-stack grey">
                        <div class="i-main">
                          <div class="i-eyebrow">Line {{ ol.line_no }}<span v-if="asdairKnown(ol.quantity_display)"> · qty {{ ol.quantity_display }}</span></div>
                          <div class="as-raw">{{ ol.product_name_display }}</div>
                          <div class="as-chips">
                            <span class="chip neutral" v-if="asdairKnown(ol.outcome_display)"><span class="d" aria-hidden="true"></span>{{ ol.outcome_display }}</span>
                            <span class="chip neutral" v-if="ol.line_price && ol.line_price.display"><span class="d" aria-hidden="true"></span>{{ ol.line_price.display }}</span>
                          </div>
                          <div class="as-sub" v-if="asdairKnown(ol.note_display)">{{ ol.note_display }}</div>
                        </div>
                      </div>
                    </template>
                  </template>
                </div>

                <!-- Questions read the API's real field names (question_text_display / candidates),
                     not a guessed q.text that was always undefined and fell through to a JSON blob. -->
                <div class="grp">
                  <h2>Open questions<span class="g-count">{{ (asdairWs.questions && asdairWs.questions.open_count_display) || '0' }}</span></h2>
                  <p class="empty" v-if="!asdairWs.questions || !asdairWs.questions.items || !asdairWs.questions.items.length">No open questions — AsdAIr is not waiting on an answer.</p>
                  <div v-else v-for="(q,i) in asdairWs.questions.items" :key="i" class="item as-stack amber">
                    <div class="i-main">
                      <div class="i-eyebrow decision">{{ q.question_key || 'question' }}<span v-if="q.list_item_id"> · line item {{ q.list_item_id }}</span></div>
                      <div class="as-raw">{{ q.question_text_display }}</div>
                      <div v-if="q.candidates && q.candidates.length">
                        <div class="as-sub">Candidates offered:</div>
                        <div class="as-tags">
                          <span v-for="(c,ci) in q.candidates" :key="'c'+ci" class="as-tag">{{ c.label_display }}<span v-if="!c.from_catalogue"> (not in the catalogue)</span></span>
                        </div>
                      </div>
                      <div class="as-note">Answer it in Telegram — the cockpit shows this question, it does not answer it.</div>
                    </div>
                  </div>
                </div>

                <!-- LAST RESORT. The raw payload is kept — nothing was deleted — but it is now a
                     collapsed debugging drawer at the bottom, never the thing that greets the reader. -->
                <details class="tech">
                  <summary>Raw payload (debugging only)</summary>
                  <div class="tech-body">
                    <p class="as-note">Everything above is rendered from named fields of this payload. This drawer exists so a field that is missing UI can still be found — it is not the intended way to read a shop.</p>
                    <div class="mono raw">{{ JSON.stringify(asdairWs, null, 2) }}</div>
                  </div>
                </details>
              </div>

              <!-- Any asdair view that is neither overview nor details and still needs the shop
                   workspace. Rules is handled ABOVE, independently of shop state. -->
              <div v-else class="empty big">
                {{ currentApp.label }} is answering, but this view is not wired to it yet — so nothing is shown here, and nothing is being made up.
              </div>
            </template>

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
        <!-- ================= CAPAE =================================================
             A SEPARATE section from Session / Rotation Reports, deliberately. A rotation report is
             what happened in ONE session; a CAPAE family is what keeps happening ACROSS sessions and
             what is being done about it. Merging them would hide the only thing CAPAE adds.

             The read is on an explicit trigger, like the reports, so opening Settings never fires a
             database read Warwick did not ask for. -->
        <div class="grp">
          <h2>CAPAE — the learning loop<span class="g-count" v-if="capFamilies">{{ capList.length }}</span></h2>

          <div class="rr-state">
            <div class="rr-state-msg" role="status" aria-live="polite">
              <div v-if="capLoading" class="empty">Reading the CAPAE record…</div>
              <div v-else-if="!capRequested" class="empty">The CAPAE record has not been read yet.</div>
              <div v-else-if="capErr" class="item red as-stack">
                <div class="i-main">
                  <div class="i-eyebrow blocked">COULD NOT BE READ</div>
                  <div class="i-title">The CAPAE record could not be read, so no families are shown — that is not the same as there being none.</div>
                  <div class="err">{{ capErr }}</div>
                </div>
              </div>
              <div v-else-if="!capList.length" class="empty">The record was read and no failure families are recorded yet.</div>
              <div v-else class="as-sub">{{ capList.length }} failure {{ capList.length === 1 ? 'family is' : 'families are' }} recorded. A repeated failure updates its family — it never creates a second one.</div>
            </div>

            <button class="refresh" @click="loadCapae()" :disabled="capLoading">{{ capActionLabel }}</button>

            <!-- What Larry is handed at Continue. Shown here so Warwick can see the exact bounded
                 list rather than take its size on trust. -->

          <!-- ══ L1 — THE CAPAE EXECUTIVE VIEW. Warwick's four at-a-glance questions, answered
               without opening anything: does CAPAE need me · what is the most important family ·
               is learning being proven · what most recently went wrong.
               Derived server-side by capae.mjs capaeOverview(), so capae-check.mjs asserts it. -->
          <div v-if="capRequested && !capErr && capOverview" class="cap-exec">
            <div class="cap-alert" :class="capOverview.needsAttention ? 't-urgent' : 't-positive'">
              <span class="rr-mark" aria-hidden="true">{{ capOverview.needsAttention ? '⚠' : '✓' }}</span>
              <span class="rr-exec-text">{{ capOverview.attention }}</span>
            </div>

            <div class="cap-counts">
              <span class="rr-chip t-urgent"   v-if="capOverview.counts.INEFFECTIVE">⛔ {{ capOverview.counts.INEFFECTIVE }} ineffective</span>
              <span class="rr-chip t-prominent" v-if="capOverview.counts.CHALLENGED">⚠ {{ capOverview.counts.CHALLENGED }} challenged</span>
              <span class="rr-chip t-quiet"    v-if="capOverview.counts.MONITORING">• {{ capOverview.counts.MONITORING }} monitoring</span>
              <span class="rr-chip t-positive" v-if="capOverview.counts.EFFECTIVE">✓ {{ capOverview.counts.EFFECTIVE }} effective</span>
              <span class="rr-chip t-neutral"  v-if="capOverview.counts.UNMEASURABLE">– {{ capOverview.counts.UNMEASURABLE }} unmeasurable</span>
            </div>

            <!-- A family that HAD been proven and has failed since. This is the signal most worth
                 surfacing, because it is the one that silently disappears from an active list. -->
            <div v-if="capOverview.reopened.length" class="cap-line t-prominent">
              <b>Reopened:</b>
              <span v-for="(x, xi) in capOverview.reopened" :key="x.slug">{{ xi ? ' · ' : ' ' }}{{ x.title }}</span>
            </div>
            <div v-if="capOverview.becameEffective.length" class="cap-line t-positive">
              <b>Proven:</b>
              <span v-for="(x, xi) in capOverview.becameEffective" :key="x.slug">{{ xi ? ' · ' : ' ' }}{{ x.title }}</span>
            </div>

            <div v-if="capOverview.pilot" class="cap-line t-quiet">
              <b>Pilot — {{ capOverview.pilot.title }}</b>
              <span v-if="capOverview.pilot.progress"> · {{ capOverview.pilot.progress.label }}</span>
              <div v-if="capOverview.pilot.nextQualifiedExposure" class="cap-sub">Next qualified exposure: {{ capOverview.pilot.nextQualifiedExposure }}</div>
            </div>

            <div v-if="capOverview.latest" class="cap-line t-urgent">
              <b>Latest recurrence</b> · {{ String(capOverview.latest.occurred_at || '').slice(0,10) }} · {{ capOverview.latest.title }}
              <div v-if="capOverview.latest.summary" class="cap-sub">{{ capOverview.latest.summary }}</div>
            </div>
          </div>
            <div v-if="capRequested && !capErr && capList.length" class="rr-cards">
              <div v-for="f in capRanked" :key="f.slug" class="rr-card" :class="'t-'+capTone(f.state)">
                <!-- ══ L1 — THE COLLAPSED FAMILY. State (word AND mark, never colour alone), title,
                     count, one line of WHY, effectiveness progress, latest occurrence, pilot mark.
                     Everything else is L3/L4 and opens on tap. -->
                <div class="rr-h">
                  <h3><span class="cap-mark" aria-hidden="true">{{ capStateMark(f.state) }}</span> {{ f.title }}<span v-if="f.is_pilot" class="chip ok" style="margin-left:6px">PILOT</span></h3>
                  <div class="as-sub">
                    <span class="chip" :class="capTone(f.state)">{{ f.state }}</span>
                    <span class="rr-chip t-neutral" style="margin-left:6px">{{ f.occurrences }} occurrence{{ f.occurrences === 1 ? '' : 's' }}</span>
                    <span v-if="f.last_occurrence_at" class="rr-chip t-neutral" style="margin-left:6px">last {{ String(f.last_occurrence_at).slice(0,10) }}</span>
                  </div>
                </div>

                <div v-if="capWhy(f)" class="cap-why">{{ capWhy(f) }}</div>

                <!-- Effectiveness as PROGRESS where a threshold exists; the sentence itself is L3. -->
                <div v-if="f.exposures_required" class="cap-prog">
                  <div class="cap-prog-bar"><i :style="{width: Math.min(100, Math.round(100 * (f.exposures_clean || 0) / f.exposures_required)) + '%'}"></i></div>
                  <span class="cap-prog-txt">{{ f.exposures_clean || 0 }} of {{ f.exposures_required }} clean exposures</span>
                </div>
                <div v-else-if="f.unmeasurable" class="cap-prog-txt">No counter is open — exposures are too rare to prove effectiveness.</div>

                <div class="rr-acts">
                  <button class="refresh" @click="capToggle(f.slug)">{{ capOpen === f.slug ? 'Hide detail' : 'Open detail' }}</button>
                </div>

                <div v-if="capOpen === f.slug" class="rr-detail">
                <dl class="as-kv">
                  <div><dt>Occurrences</dt><dd><span class="rr-num">{{ f.occurrences }}</span></dd></div>
                  <div><dt>Latest occurrence</dt><dd><span v-if="f.last_occurrence_at" class="rr-num">{{ String(f.last_occurrence_at).slice(0,10) }}</span><span v-else class="rr-unk">none recorded</span></dd></div>
                  <div><dt>Cause class</dt><dd><span v-if="f.cause_class">{{ f.cause_class }}</span><span v-else class="rr-unk">not established</span></dd></div>
                  <div><dt>RCA</dt><dd><span class="chip" :class="f.rca_status === 'ESTABLISHED' ? 'ok' : 'warn'">{{ f.rca_status }}</span><span v-if="f.rca_confidence" class="rr-unk" style="margin-left:6px">confidence {{ f.rca_confidence }}</span></dd></div>
                </dl>

                <div class="rr-block">
                  <div class="as-lab">Effectiveness</div>
                  <div class="i-title">{{ f.effectiveness }}</div>
                  <div v-if="f.effectiveness_note" class="as-sub">{{ f.effectiveness_note }}</div>
                </div>

                <div class="rr-block">
                  <div class="as-lab">Root cause</div>
                  <div v-if="f.root_cause" class="as-sub">{{ f.root_cause }}</div>
                  <div v-else class="as-note">ROOT CAUSE: UNESTABLISHED. Evidence does not establish one, and nothing is being guessed in the meantime.</div>
                </div>

                <div class="rr-block">
                  <div class="as-lab">Cause · Detection · Escape</div>
                  <dl class="as-kv">
                    <div v-for="(c, ci) in capCDE(f)" :key="ci"><dt>{{ c.k }}</dt><dd><span v-if="c.v">{{ c.v }}</span><span v-else class="rr-unk">not established</span></dd></div>
                  </dl>
                </div>

                <div class="rr-block">
                  <div class="as-lab">Finding</div>
                  <div v-if="f.finding" class="as-sub">{{ f.finding }}</div><div v-else class="as-note">Not recorded.</div>
                  <div class="as-lab" style="margin-top:8px">Latest correction</div>
                  <div v-if="f.latest_correction" class="as-sub">{{ f.latest_correction }}</div><div v-else class="as-note">Not recorded.</div>
                  <div class="as-lab" style="margin-top:8px">Corrective / preventive action</div>
                  <div v-if="f.preventive_action" class="as-sub">{{ f.preventive_action }}</div>
                  <div v-else class="as-note">NONE — deliberately. Not every finding justifies a control.</div>
                  <div class="as-lab" style="margin-top:8px">Required Larry behaviour</div>
                  <div v-if="f.required_larry_behaviour" class="as-sub">{{ f.required_larry_behaviour }}</div><div v-else class="as-note">Not recorded.</div>
                </div>

                <!-- History behind a disclosure: Warwick can inspect it, and it never enters
                     Larry's context, which is the whole point of keeping the active brief tiny. -->
                <details class="tech" @toggle="capToggle(f.slug)">
                  <summary>History and evidence · {{ f.history.length }} {{ f.history.length === 1 ? 'occurrence' : 'occurrences' }}</summary>
                  <div class="tech-body">
                    <div v-if="!f.history.length" class="as-note">No individual occurrences are recorded against this family yet.</div>
                    <div v-for="(h, hi) in f.history" :key="hi" class="item as-stack" style="margin-top:8px">
                      <div class="i-main">
                        <div class="i-eyebrow">{{ h.disposition }}<span v-if="h.occurred_at"> · {{ String(h.occurred_at).slice(0,10) }}</span></div>
                        <div class="i-title">{{ h.summary || 'No summary was recorded.' }}</div>
                        <div v-if="h.evidence_ref" class="mono as-sub">{{ h.evidence_ref }}</div>
                        <div v-if="h.deliverable_path" class="as-sub">
                          Session report: <span class="mono">{{ rrDocName(h.deliverable_path) }}</span>
                          <button class="refresh" style="margin-left:6px" @click="rrOpenDoc(h.deliverable_path)">Open</button>
                        </div>
                        <div v-if="h.closing_head" class="as-note mono">head {{ String(h.closing_head).slice(0,12) }}<span v-if="h.branch"> · {{ h.branch }}</span></div>
                      </div>
                    </div>
                    <div v-if="f.evidence_refs.length" style="margin-top:8px">
                      <div class="as-lab">Evidence references</div>
                      <div v-for="(e, ei) in f.evidence_refs" :key="ei" class="as-note mono">{{ e }}</div>
                    </div>
                  </div>
                </details>
                </div>
              </div>
            </div>
          </div>

          <!-- ══ L3 — "What Larry was told at session start."
               MOVED HERE AND CLOSED BY DEFAULT, 2026-08-08. It used to sit ABOVE the executive
               signal, so Warwick read four paragraphs of standing brief before discovering that a
               prevention is currently failing. It is inspectable, not headline: the brief is an
               INPUT to the session, and what matters at a glance is the OUTCOME above it. -->
          <details class="tech" v-if="capRequested && !capErr && capActive.length">
            <summary>What Larry was told at session start · {{ capActive.length }}</summary>
            <div class="tech-body">
              <div class="as-sub">The precomputed active brief handed to Larry at Continue. Only families whose prevention is still unproven AND where an exposure is plausible — EFFECTIVE and UNMEASURABLE families are excluded, so they leave his attention automatically.</div>
              <div v-for="a in capActive" :key="a.slug" class="as-note" style="margin-top:6px">
                <strong>{{ a.title }}</strong> — MUST: {{ a.must || 'not recorded' }} <span class="rr-unk">· {{ a.effectiveness }}</span>
              </div>
            </div>
          </details>
        </div>

        <!-- ── SESSION / ROTATION REPORTS ─────────────────────────────────────────────────────
             Warwick's /rotate reports, most recent first. THE HONESTY CHAIN IS THE POINT, so read
             the v-if order — each rung is a DIFFERENT fact and none may be collapsed into another:
               1. reading         -> in flight (leads the chain: see the note on re-reads below).
               2. not asked yet   -> we have not read them. Not "there are none".
               3. read FAILED     -> say the read failed and show NOTHING else. Not an empty list.
               4. read, empty     -> a measured zero: they were read and there are none.
               5. read, present   -> N were read; the cards render below, in the producer's order,
                                     unsorted by us.
             A failure at rung 3 is CONTAINED to this group: "Happening now" above and "Recent
             history" below keep rendering, because a report read that fell over must not take the
             System tab with it.

             WHAT CHANGED AND WHY (Vera HIGH-1, WCAG 2.2 SC 4.1.3 Status Messages / SC 2.4.3 Focus
             Order). The five rungs were previously five sibling v-if branches with the trigger
             button living inside two of them, and nothing carried role="status". A screen-reader
             user pressed "Read them" and heard NOTHING — not "reading", not "the read failed", not
             "there are none", not the arrival of N reports — and a keyboard user lost focus to
             <body> because the button destroyed itself on click.
             Three structural consequences, each deliberate:
               a) the state region is STABLE and in the DOM from first paint, before any swap. A
                  role="status" region created at the same moment its text arrives is announced
                  unreliably — the AT has to have been observing it already. House pattern:
                  app.js:807, 867, 967, 1074, 1184.
               b) rung 1 leads on rrLoading alone, so a RE-read announces too. The CARDS are still
                  governed by rrList exactly as before, so an in-flight re-read keeps the
                  already-read cards on screen under a "Reading…" status — which is what is
                  actually true — instead of blanking them.
               c) rung 5 announces a SENTENCE, not the cards. The cards sit outside the live region
                  on purpose: a polite region wrapping ~40 dt/dd pairs per card would read the whole
                  set aloud on arrival. They are reached by their headings instead (see .rr-h). -->
        <div class="grp">
          <h2>Session / Rotation Reports<span class="g-count" v-if="rrReports">{{ rrList.length }}</span></h2>

          <div class="rr-state">
            <div class="rr-state-msg" role="status" aria-live="polite">
              <div v-if="rrLoading" class="empty">Reading the rotation reports…</div>

              <div v-else-if="!rrRequested" class="empty">The rotation reports have not been read yet.</div>

              <div v-else-if="rrErr" class="item red as-stack">
                <div class="i-main">
                  <div class="i-eyebrow blocked">COULD NOT BE READ</div>
                  <div class="i-title">The rotation reports could not be read, so none are shown — that is not the same as there being none.</div>
                  <div class="as-sub">Nothing else on this tab is affected.</div>
                  <div class="err">{{ rrErr }}</div>
                </div>
              </div>

              <div v-else-if="!rrList.length" class="empty">The reports were read and there are none recorded yet. Nothing is being guessed at in the meantime.</div>

              <!-- .as-sub, not .empty: this is the one rung that is NOT an empty state, and reusing
                   the empty-state class for it would be a naming lie in the markup for the sake of
                   2px of type. Same token, same surface: --ink2 on --bg, 6.59 / 8.34 (GL-003 §2b). -->
              <div v-else class="as-sub">{{ rrList.length }} <template v-if="rrList.length === 1">rotation report was</template><template v-else>rotation reports were</template> read, and {{ rrList.length === 1 ? 'it is' : 'they are' }} shown below in the order supplied.</div>
            </div>

            <!-- The single stable trigger (see rrActionLabel). Disabled during the read, NEVER
                 removed, so focus survives. It sits OUTSIDE the live region deliberately: its label
                 changes with the state and would otherwise be spoken as part of the status message.
                 Its own change is still announced when it holds focus, because a focused control's
                 accessible name changing is announced by the AT already. -->
            <div class="rr-state-act">
              <button class="act" :disabled="rrLoading" @click="loadRotationReports()">{{ rrActionLabel }}</button>
            </div>
          </div>

          <!-- aria-busy belongs HERE, on the container whose content is being replaced — not on the
               status region, where aria-busy="true" would SUPPRESS the very "Reading…" announcement
               it was asked for. This container renders nothing in the four non-list states: rrList
               is empty in all of them, the failed read included (rrReports goes back to null, never
               to [], so rung 3 still shows nothing rather than an empty list). -->
          <div class="rr-list" :aria-busy="rrLoading ? 'true' : 'false'">
            <!-- A declared order that is not the actual order is a PRODUCER defect. Surfaced, not
                 silently re-sorted (app.js:735 / :737-745) — the endpoint is where it gets fixed. -->
          <!-- ══ L1 — ACROSS RECENT SESSIONS, before any individual report. Derived server-side by
               rotation-report.mjs reportsOverview(). Every field is null when the measure is not
               established: a trend computed from one known and one absent value is a fabrication. -->
          <div v-if="rrRequested && !rrErr && rrOverview" class="cap-exec">
            <div class="cap-counts">
              <span class="rr-chip t-neutral">{{ rrOverview.sessions }} session{{ rrOverview.sessions === 1 ? '' : 's' }}</span>
              <span v-if="rrOverview.woFirstPass" class="rr-chip" :class="rrOverview.woFirstPass.success === 0 && rrOverview.woFirstPass.total > 0 ? 't-urgent' : 't-quiet'">WO first pass {{ rrOverview.woFirstPass.success }}/{{ rrOverview.woFirstPass.total }}</span>
              <span v-if="rrOverview.amendments !== null" class="rr-chip t-quiet">{{ rrOverview.amendments }} amendment{{ rrOverview.amendments === 1 ? '' : 's' }}</span>
              <span v-if="rrOverview.refusals !== null" class="rr-chip t-quiet">{{ rrOverview.refusals }} refusal{{ rrOverview.refusals === 1 ? '' : 's' }}</span>
              <span v-if="rrOverview.failuresTotal" class="rr-chip t-urgent">🔴 {{ rrOverview.failuresTotal }} prevention failure{{ rrOverview.failuresTotal === 1 ? '' : 's' }}</span>
              <span v-if="rrOverview.unestablishedTotal" class="rr-chip t-neutral">⚠ {{ rrOverview.unestablishedTotal }} measurements unavailable</span>
            </div>

            <div v-if="rrOverview.trend" class="cap-line" :class="'t-'+rrOverview.trend.tone">
              <b>{{ rrOverview.trend.measure }} {{ rrOverview.trend.direction }}</b>
              · {{ rrOverview.trend.previous }}% → {{ rrOverview.trend.latest }}% since the previous session
            </div>

            <div v-if="rrOverview.standout" class="cap-line t-urgent">
              <b>Standout session</b> · {{ rrOverview.standout.sessionDate || 'date not established' }} — {{ rrOverview.standout.headline }}
            </div>
          </div>
            <div v-if="rrOrderBreak" class="item red as-stack">
              <div class="i-main">
                <div class="i-eyebrow blocked">ORDER WRONG</div>
                <div class="i-title">These are supposed to arrive most-recent-first, and they do not.</div>
                <div class="as-sub">The order first breaks at report {{ rrOrderBreak }}. They are shown exactly as supplied rather than quietly reordered — the ordering is the endpoint's to guarantee, so this is worth fixing upstream.</div>
              </div>
            </div>

            <div v-for="(r, ri) in rrList" :key="ri" class="item grey as-stack">
              <div class="i-main">
                <div class="i-eyebrow">
                  ROTATION · <template v-if="rrHas(r.host)">{{ r.host }}</template><span v-else class="rr-unk">host not established</span>
                </div>
                <div class="i-title">
                  <template v-if="rrHas(r.createdAt)">{{ when(r.createdAt) }}</template>
                  <template v-else-if="rrHas(r.sessionDate)">{{ r.sessionDate }}</template>
                  <span v-else class="rr-unk">session date not established</span>
                </div>

                <!-- ══ L1 — WHAT MATTERS. Derived server-side by rotation-report.mjs reportSummary(),
                     so this line is asserted by rotation-report-check.mjs and not by reading the page.
                     Everything below the actions is L3/L4 and is CLOSED by default: on a phone a
                     normal report used to consume several screens before the next one was reachable. -->
                <div class="rr-exec" v-if="r.summary">
                  <div class="rr-exec-head" :class="'t-'+r.summary.tone">
                    <span class="rr-mark" aria-hidden="true">{{ r.summary.tone==='urgent' ? '🔴' : (r.summary.tone==='positive' ? '🟢' : '⚪') }}</span>
                    <span class="rr-exec-text">{{ r.summary.headline }}</span>
                  </div>
                  <div class="rr-chips">
                    <!-- Date first: "date/session" is the card's identity, and it must be readable
                         without opening anything. The rotation UUID and full SHA stay in L4. -->
                    <span v-if="r.sessionDate" class="rr-chip t-neutral">{{ r.sessionDate }}</span>
                    <span v-for="m in r.summary.measures" :key="m.label" class="rr-chip" :class="'t-'+m.tone">{{ m.label }} <b>{{ m.value }}</b></span>
                    <!-- The "not established" collapse. Twenty-one absent measurements are ONE chip,
                         not twenty-one lines; the exact list stays in the detail below. -->
                    <span v-if="r.summary.unestablishedCount" class="rr-chip t-neutral">⚠ {{ r.summary.unestablishedCount }} measurements unavailable</span>
                  </div>
                  <div class="rr-acts">
                    <button class="refresh" @click="rrCardToggle(String(ri))">{{ rrOpenCard===String(ri) ? 'Hide detail' : (r.summary.findingsCount ? 'Open findings · ' + r.summary.findingsCount : 'Open detail') }}</button>
                    <button class="refresh" style="margin-left:6px" @click="rrOpenDoc(r.deliverablePath)">Full report</button>
                    <button class="refresh" style="margin-left:6px" @click="rrDownloadDoc(r.deliverablePath)">Download</button>
                  </div>
                  <!-- THE FINDINGS LAYER. The label is derived from the closed exposure vocabulary and
                       the lead is a PREFIX of Pax's own summary — never a rewrite. Full prose below. -->
                  <div v-if="rrOpenCard===String(ri) && r.summary.findingsCount" class="rr-finds">
                    <div v-for="(fd, fi) in r.summary.findings" :key="fi" class="rr-find" :class="'t-'+fd.tone">
                      <div class="rr-find-h"><span aria-hidden="true">{{ fd.mark }}</span> <b>{{ fd.label }}</b><span v-if="fd.family" class="rr-find-fam">{{ fd.family }}</span></div>
                      <div v-if="fd.lead" class="rr-find-lead">{{ fd.lead }}</div>
                    </div>
                  </div>
                </div>

                <div v-if="rrOpenCard===String(ri)" class="rr-detail">
                  <!-- ══ L2 — SESSION ECONOMICS. Larry and the specialists as PEERS, side by side.
                       ⛔ THE TWO ARE NEVER SUMMED. Context occupancy and fanned-out subagent traffic
                       are different measures; adding them yields a number that means nothing.
                       Derived by rotation-report.mjs sessionEconomics(), so the template cannot get
                       the separation wrong even if someone edits it carelessly. -->
                  <div class="econ" v-if="r.econ">
                    <div class="econ-side">
                      <div class="econ-h">LARRY</div>
                      <template v-if="r.econ.larry.measured">
                        <div class="econ-row"><span>Context in</span><b>{{ rrHas(r.econ.larry.contextIn) ? rrCompact(r.econ.larry.contextIn) : '—' }}</b></div>
                        <div class="econ-row"><span>Context out</span><b>{{ rrHas(r.econ.larry.contextOut) ? rrCompact(r.econ.larry.contextOut) : '—' }}</b></div>
                        <div class="econ-row" v-if="rrHas(r.econ.larry.movement)"><span>Movement</span><b>{{ rrCompact(r.econ.larry.movement) }}</b></div>
                      </template>
                      <!-- ONE compact line, not a block of repeated "not established". -->
                      <div v-else class="econ-unk">⚠ Larry context usage was not measured</div>
                      <div class="econ-row" v-if="rrHas(r.econ.larry.elapsedMinutes)"><span>Elapsed</span><b>{{ rrMins(r.econ.larry.elapsedMinutes) }}</b></div>
                    </div>

                    <div class="econ-side">
                      <div class="econ-h">SPECIALISTS</div>
                      <div class="econ-row"><span>Traffic</span><b>{{ rrHas(r.econ.specialist.tokens) ? rrCompact(r.econ.specialist.tokens) : '—' }}</b></div>
                      <div class="econ-row"><span>Dispatches</span><b>{{ rrHas(r.econ.specialist.dispatches) ? rrInt(r.econ.specialist.dispatches) : '—' }}</b></div>
                      <div class="econ-row"><span>Specialists</span><b>{{ r.econ.specialist.count }}</b></div>
                      <div v-if="r.econ.specialist.tokensAreDerived" class="econ-unk">summed from the specialist rows, not a stored total</div>
                      <div v-if="!r.econ.specialist.count" class="econ-unk">no specialists dispatched</div>
                    </div>
                  </div>

                  <!-- ══ WHO DID WHAT, AND ROUGHLY WHAT DID IT COST. The tokens field is the MEASURED total
                       the mapper used to drop on the floor. An unmeasured one stays "not measured",
                       never 0 — the two are different answers and must not look alike. -->
                  <details class="tech" v-if="r.econ && r.econ.specialist.count">
                    <summary>Specialists · {{ r.econ.specialist.count }}<template v-if="r.econ.specialist.measuredCount"> · {{ r.econ.specialist.measuredCount }} measured</template></summary>
                    <div class="tech-body">
                      <div v-for="s in r.econ.specialist.roster" :key="s.specialist" class="spec-row">
                        <div class="spec-top">
                          <b class="spec-name">{{ s.specialist }}</b>
                          <span class="rr-chip t-quiet">{{ rrHas(s.dispatches) ? rrInt(s.dispatches) : '—' }} dispatch{{ s.dispatches === 1 ? '' : 'es' }}</span>
                          <span class="rr-chip" :class="rrHas(s.tokens) ? 't-neutral' : 't-quiet'">{{ rrHas(s.tokens) ? rrCompact(s.tokens) + ' tokens' : 'cost not measured' }}</span>
                        </div>
                        <div v-if="s.notes" class="spec-notes">{{ s.notes }}</div>
                        <div v-else class="econ-unk">what they worked on was not recorded for this rotation</div>
                      </div>
                    </div>
                  </details>
                <dl class="as-kv">
                  <div><dt>Session date</dt><dd><span v-if="rrHas(r.sessionDate)" class="rr-num">{{ r.sessionDate }}</span><span v-else class="rr-unk">not established</span></dd></div>
                  <div><dt>Host</dt><dd><span v-if="rrHas(r.host)" class="rr-num">{{ r.host }}</span><span v-else class="rr-unk">not established</span></dd></div>
                  <div><dt>Host version</dt><dd><span v-if="rrHas(r.hostVersion)" class="rr-num">{{ r.hostVersion }}</span><span v-else class="rr-unk">not established</span></dd></div>
                  <div><dt>Branch</dt><dd><span v-if="rrHas(r.branch)" class="rr-num">{{ r.branch }}</span><span v-else class="rr-unk">not established</span></dd></div>
                  <!-- Short head, with the full one on hover/focus AND in the drawer below, so the
                       exact SHA is available without expanding and exact when expanded. -->
                  <div><dt>Closing head</dt><dd><span v-if="rrHas(r.closingHeadShort)" class="rr-num" :title="rrText(r.closingHead)">{{ r.closingHeadShort }}</span><span v-else-if="rrHas(r.closingHead)" class="rr-num">{{ r.closingHead }}</span><span v-else class="rr-unk">not established</span></dd></div>
                  <div><dt>Elapsed</dt><dd><span v-if="rrHas(r.elapsedMinutes)" class="rr-num">{{ rrMins(r.elapsedMinutes) }}</span><span v-else class="rr-unk">not established</span></dd></div>
                  <div><dt>Specialist dispatches</dt><dd><span v-if="rrHas(r.specialistDispatches)" class="rr-num">{{ rrInt(r.specialistDispatches) }}</span><span v-else class="rr-unk">not established</span></dd></div>
                  <div><dt>Rotation id</dt><dd><span v-if="rrHas(r.id)" class="rr-num">{{ r.id }}</span><span v-else class="rr-unk">not established</span></dd></div>
                </dl>

                <!-- FINDINGS FIRST, because "the surface should make the important findings obvious
                     rather than presenting a database grid". The text is rendered VERBATIM: a
                     finding is prose, and a count parsed out of prose would be our figure, not the
                     producer's. A null (never established) and an empty list (recorded, none)
                     are different screens. -->
                <div class="rr-block">
                  <h3 class="as-sec rr-h">Findings</h3>
                  <div v-if="!r.findings" class="as-note">Findings were not established for this rotation.</div>
                  <div v-else-if="!rrArr(r.findings).length" class="as-note">This rotation was reviewed and recorded no findings.</div>
                  <template v-else>
                    <div v-for="(f, fi) in rrArr(r.findings)" :key="fi" class="rr-find">
                      <!-- An unmeasured confidence gets NO CHIP, exactly as an unmeasured figure
                           gets no track. It previously rendered inside the same .chip.neutral as a
                           measured one — mono, --ink2, same pill, same dot — which is this surface's
                           own criterion broken on the field sitting highest on the card. The absent
                           chip is the tell; .rr-unk carries the words. Contrast is unchanged: the
                           chip was --ink2 on --panel2 (7.08 / 6.78) and .rr-unk here is --ink2 on
                           --panel (7.47 / 7.37). Both PASS (GL-003 §2b). -->
                      <span v-if="rrHas(f.confidence)" class="chip neutral"><span class="d"></span>{{ f.confidence }}</span>
                      <span v-else class="rr-unk">confidence not established</span>
                      <span class="rr-find-t"><template v-if="rrHas(f.text)">{{ f.text }}</template><span v-else class="rr-unk">text not established</span></span>
                    </div>
                  </template>
                </div>

                <!-- CONTEXT CONSUMED. Note what a bar means here: the TRACK is drawn only when the
                     value is known, so a real 0 is a visible empty track and an unknown is no track
                     at all. The bar is aria-hidden; the number beside it is the accessible fact. -->
                <div class="rr-block">
                  <h3 class="as-sec rr-h">Context consumed</h3>
                  <dl class="rr-rows">
                    <div v-for="c in rrCtx(r)" :key="c.label" class="rr-row">
                      <dt class="rr-row-l">{{ c.label }}</dt>
                      <dd class="rr-row-v"><template v-if="rrHas(c.v)">
                        <span class="rr-track" aria-hidden="true"><span class="rr-fill" :style="{width: rrBar(c.v, rrCtxMax(r))}"></span></span>
                        <span class="rr-num"><template v-if="rrIsCompact(c.v)">≈</template>{{ rrCompact(c.v) }}</span>
                      </template>
                      <span v-else class="rr-unk">not established</span></dd>
                    </div>
                  </dl>
                </div>

                <!-- WHERE THE EFFORT WENT. Every slice uses the SAME neutral fill: the producer sends
                     five numbers and no assessment, so tinting "rework" amber would be our judgement
                     dressed as its data. The labels carry the meaning. -->
                <div class="rr-block">
                  <h3 class="as-sec rr-h">Where the effort went</h3>
                  <dl class="rr-rows">
                    <div v-for="a in rrAlloc(r)" :key="a.label" class="rr-row">
                      <dt class="rr-row-l">{{ a.label }}</dt>
                      <dd class="rr-row-v"><template v-if="rrHas(a.v)">
                        <span class="rr-track" aria-hidden="true"><span class="rr-fill" :style="{width: rrBar(a.v, 100)}"></span></span>
                        <span class="rr-num">{{ rrPct(a.v) }}</span>
                      </template>
                      <span v-else class="rr-unk">not established</span></dd>
                    </div>
                  </dl>
                  <!-- A total over NO measurements is not 0% — it is not established. Two different
                       sentences, because they are two different facts. -->
                  <div v-if="rrAllocGap(r) && rrAllocAnyKnown(r)" class="as-note">The measured slices account for {{ rrPct(rrAllocSum(r)) }} of the session. The remainder is not idle time — one or more slices were never measured, and they are named above.</div>
                  <div v-else-if="rrAllocGap(r)" class="as-note">None of the effort allocation was measured for this rotation, so there is no total to show — that is not the same as a session with no effort in it.</div>
                </div>

                <!-- WORK ORDERS. This block carries the criterion: firstDispatchSuccess is very often
                     a REAL ZERO, and it must read as a measurement (empty track + mono digits) on the
                     same card where an unmeasured elapsed time reads as an italic word. -->
                <div class="rr-block">
                  <h3 class="as-sec rr-h">Work Orders</h3>
                  <dl class="rr-rows">
                    <div class="rr-row">
                      <dt class="rr-row-l">Survived first read-back</dt>
                      <dd class="rr-row-v"><template v-if="rrHas(rrObj(r.workOrders).firstDispatchSuccess) && rrHas(rrObj(r.workOrders).total)">
                        <span class="rr-track" aria-hidden="true"><span class="rr-fill" :style="{width: rrBar(rrObj(r.workOrders).firstDispatchSuccess, rrObj(r.workOrders).total)}"></span></span>
                        <span class="rr-num">{{ rrInt(rrObj(r.workOrders).firstDispatchSuccess) }} of {{ rrInt(rrObj(r.workOrders).total) }}</span>
                      </template>
                      <span v-else class="rr-unk">not established</span></dd>
                    </div>
                    <div class="rr-row">
                      <dt class="rr-row-l">Amended</dt>
                      <dd class="rr-row-v"><template v-if="rrHas(rrObj(r.workOrders).amendments) && rrHas(rrObj(r.workOrders).total)">
                        <span class="rr-track" aria-hidden="true"><span class="rr-fill" :style="{width: rrBar(rrObj(r.workOrders).amendments, rrObj(r.workOrders).total)}"></span></span>
                        <span class="rr-num">{{ rrInt(rrObj(r.workOrders).amendments) }} of {{ rrInt(rrObj(r.workOrders).total) }}</span>
                      </template>
                      <span v-else class="rr-unk">not established</span></dd>
                    </div>
                    <div class="rr-row">
                      <dt class="rr-row-l">Refused</dt>
                      <dd class="rr-row-v"><template v-if="rrHas(rrObj(r.workOrders).refusals) && rrHas(rrObj(r.workOrders).total)">
                        <span class="rr-track" aria-hidden="true"><span class="rr-fill" :style="{width: rrBar(rrObj(r.workOrders).refusals, rrObj(r.workOrders).total)}"></span></span>
                        <span class="rr-num">{{ rrInt(rrObj(r.workOrders).refusals) }} of {{ rrInt(rrObj(r.workOrders).total) }}</span>
                      </template>
                      <span v-else class="rr-unk">not established</span></dd>
                    </div>
                  </dl>
                </div>

                <!-- WHAT CHANGED — product versus documentation. -->
                <div class="rr-block">
                  <h3 class="as-sec rr-h">What changed</h3>
                  <dl class="rr-rows">
                    <div class="rr-row">
                      <dt class="rr-row-l">Product lines</dt>
                      <dd class="rr-row-v"><template v-if="rrHas(rrObj(r.lines).productChanged)">
                        <span class="rr-track" aria-hidden="true"><span class="rr-fill" :style="{width: rrBar(rrObj(r.lines).productChanged, rrLinesMax(r))}"></span></span>
                        <span class="rr-num">{{ rrInt(rrObj(r.lines).productChanged) }}</span>
                      </template>
                      <span v-else class="rr-unk">not established</span></dd>
                    </div>
                    <div class="rr-row">
                      <dt class="rr-row-l">Documentation lines</dt>
                      <dd class="rr-row-v"><template v-if="rrHas(rrObj(r.lines).docChanged)">
                        <span class="rr-track" aria-hidden="true"><span class="rr-fill" :style="{width: rrBar(rrObj(r.lines).docChanged, rrLinesMax(r))}"></span></span>
                        <span class="rr-num">{{ rrInt(rrObj(r.lines).docChanged) }}</span>
                      </template>
                      <span v-else class="rr-unk">not established</span></dd>
                    </div>
                    <div class="rr-row">
                      <dt class="rr-row-l">Documentation share of insertions</dt>
                      <dd class="rr-row-v"><template v-if="rrHas(rrObj(r.gitStat).doc_share_of_insertions_pct)">
                        <span class="rr-track" aria-hidden="true"><span class="rr-fill" :style="{width: rrBar(rrObj(r.gitStat).doc_share_of_insertions_pct, 100)}"></span></span>
                        <span class="rr-num">{{ rrPct(rrObj(r.gitStat).doc_share_of_insertions_pct) }}</span>
                      </template>
                      <span v-else class="rr-unk">not established</span></dd>
                    </div>
                  </dl>
                </div>

                <!-- UNRESOLVED / UNESTABLISHED MEASUREMENTS. Three screens, deliberately: the list
                     was never established · it was established and is empty · it has entries. These
                     names are NOT correlated with the per-field nulls above — the two vocabularies
                     do not join, and inventing a mapping would be a naming contract the endpoint
                     never agreed to. Both are shown; neither is resolved here. -->
                <div class="rr-block">
                  <h3 class="as-sec rr-h">Unresolved or unestablished measurements<span class="g-count" v-if="r.unestablished">{{ rrArr(r.unestablished).length }}</span></h3>
                  <div v-if="!r.unestablished" class="as-note">The list of unestablished measurements was itself not established.</div>
                  <div v-else-if="!rrArr(r.unestablished).length" class="as-note">Nothing was left unestablished in this rotation.</div>
                  <div v-else class="as-tags"><span v-for="(u, ui) in rrArr(r.unestablished)" :key="ui" class="as-tag">{{ u }}</span></div>
                </div>

                <div class="rr-block">
                  <h3 class="as-sec rr-h">Notes</h3>
                  <div v-if="rrText(r.notes)" class="as-sub">{{ rrText(r.notes) }}</div>
                  <div v-else class="as-note">No notes were recorded for this rotation.</div>
                </div>

                <div class="rr-block">
                  <h3 class="as-sec rr-h">Durable report</h3>
                  <div v-if="rrHas(r.deliverablePath)" class="mono">{{ r.deliverablePath }}</div>
                  <!-- Open and Download read the DELIVERABLE, which is the SSOT. The mirror row is a
                       pointer to it, so these buttons are how Warwick gets the actual report rather
                       than the summarised fields above. Absent path = no buttons, never a dead one. -->
                  <div v-if="rrHas(r.deliverablePath)" class="as-sub">
                    <button class="refresh" @click="rrOpenDoc(r.deliverablePath)">Open report</button>
                    <button class="refresh" style="margin-left:6px" @click="rrDownloadDoc(r.deliverablePath)">Download</button>
                  </div>
                  <div v-else class="as-note">No durable report path was recorded.</div>
                </div>

                <!-- THE DRAWER — exact identifiers and the per-specialist breakdown. Unknowns stay
                     labelled unknown in here too; a technical drawer is not a licence to print 0. -->
                <details class="tech">
                  <summary>Full metric set · specialists · exact identifiers</summary>
                  <div class="tech-body">
                    <dl class="as-kv">
                      <div><dt>Rotation id</dt><dd><span v-if="rrHas(r.id)" class="rr-num">{{ r.id }}</span><span v-else class="rr-unk">not established</span></dd></div>
                      <div><dt>Closing head (exact)</dt><dd><span v-if="rrHas(r.closingHead)" class="rr-num">{{ r.closingHead }}</span><span v-else class="rr-unk">not established</span></dd></div>
                      <div><dt>Created at</dt><dd><span v-if="rrHas(r.createdAt)" class="rr-num">{{ r.createdAt }}</span><span v-else class="rr-unk">not established</span></dd></div>
                      <div><dt>Map path</dt><dd><span v-if="rrHas(r.mapPath)" class="rr-num">{{ r.mapPath }}</span><span v-else class="rr-unk">not established</span></dd></div>
                      <div><dt>Deliverable path</dt><dd><span v-if="rrHas(r.deliverablePath)" class="rr-num">{{ r.deliverablePath }}</span><span v-else class="rr-unk">not established</span></dd></div>
                      <div><dt>Context in (exact)</dt><dd><span v-if="rrHas(r.contextTokensIn)" class="rr-num">{{ rrInt(r.contextTokensIn) }}</span><span v-else class="rr-unk">not established</span></dd></div>
                      <div><dt>Context out (exact)</dt><dd><span v-if="rrHas(r.contextTokensOut)" class="rr-num">{{ rrInt(r.contextTokensOut) }}</span><span v-else class="rr-unk">not established</span></dd></div>
                      <div><dt>Subagent tokens (exact)</dt><dd><span v-if="rrHas(r.subagentTokens)" class="rr-num">{{ rrInt(r.subagentTokens) }}</span><span v-else class="rr-unk">not established</span></dd></div>
                      <div><dt>Elapsed (minutes)</dt><dd><span v-if="rrHas(r.elapsedMinutes)" class="rr-num">{{ rrInt(r.elapsedMinutes) }}</span><span v-else class="rr-unk">not established</span></dd></div>
                      <div><dt>Insertions</dt><dd><span v-if="rrHas(rrObj(r.gitStat).insertions)" class="rr-num">{{ rrInt(rrObj(r.gitStat).insertions) }}</span><span v-else class="rr-unk">not established</span></dd></div>
                      <div><dt>Deletions</dt><dd><span v-if="rrHas(rrObj(r.gitStat).deletions)" class="rr-num">{{ rrInt(rrObj(r.gitStat).deletions) }}</span><span v-else class="rr-unk">not established</span></dd></div>
                      <div><dt>Work Orders total</dt><dd><span v-if="rrHas(rrObj(r.workOrders).total)" class="rr-num">{{ rrInt(rrObj(r.workOrders).total) }}</span><span v-else class="rr-unk">not established</span></dd></div>
                    </dl>

                    <h3 class="as-sec rr-h">Specialists<span class="g-count" v-if="r.specialists">{{ rrArr(r.specialists).length }}</span></h3>
                    <div v-if="!r.specialists" class="as-note">The specialist breakdown was not established for this rotation.</div>
                    <div v-else-if="!rrArr(r.specialists).length" class="as-note">This rotation recorded no specialist dispatches.</div>
                    <div v-else class="rr-specs">
                      <div v-for="(s, si) in rrArr(r.specialists)" :key="si" class="rr-spec">
                        <dl class="rr-rows"><div class="rr-row">
                          <dt class="rr-row-l"><template v-if="rrHas(s.specialist)">{{ s.specialist }}</template><span v-else class="rr-unk">unnamed</span></dt>
                          <dd class="rr-row-v">
                            <template v-if="rrHas(s.dispatches)">
                              <span class="rr-track" aria-hidden="true"><span class="rr-fill" :style="{width: rrBar(s.dispatches, rrSpecMax(r))}"></span></span>
                              <span class="rr-num">{{ rrInt(s.dispatches) }}</span>
                            </template>
                            <span v-else class="rr-unk">not established</span>
                          </dd>
                        </div></dl>
                        <dl class="as-kv">
                          <div><dt>Tokens in</dt><dd><span v-if="rrHas(s.tokensIn)" class="rr-num">{{ rrInt(s.tokensIn) }}</span><span v-else class="rr-unk">not established</span></dd></div>
                          <div><dt>Tokens out</dt><dd><span v-if="rrHas(s.tokensOut)" class="rr-num">{{ rrInt(s.tokensOut) }}</span><span v-else class="rr-unk">not established</span></dd></div>
                        </dl>
                        <div v-if="rrText(s.notes)" class="as-sub">{{ rrText(s.notes) }}</div>
                        <div v-else class="as-note">No note was recorded for this specialist.</div>
                      </div>
                    </div>
                  </div>
                </details>
                </div>
              </div>
            </div>
          </div>
        </div>


        <!-- The opened report document. One viewer serving both surfaces: a report opened from the
             reports list and a report opened from a CAPAE occurrence are the same file, so they get
             the same reader rather than two that could drift. -->
        <div class="grp" v-if="rrDocLoading || rrDocErr || rrDoc">
          <h2>Report document</h2>
          <div v-if="rrDocLoading" class="empty">Reading the document…</div>
          <div v-else-if="rrDocErr" class="item red as-stack"><div class="i-main"><div class="i-eyebrow blocked">COULD NOT BE READ</div><div class="i-title">{{ rrDocErr }}</div></div></div>
          <div v-else-if="rrDoc">
            <div class="as-sub"><span class="mono">{{ rrDoc.file }}</span>
              <button class="refresh" style="margin-left:8px" @click="rrDownloadDoc(rrDoc.file)">Download</button>
              <button class="refresh" style="margin-left:6px" @click="rrCloseDoc()">Close</button>
            </div>
            <pre class="rr-doc" style="white-space:pre-wrap;overflow-x:auto;max-height:60vh;overflow-y:auto">{{ rrDoc.text }}</pre>
          </div>
        </div>
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
