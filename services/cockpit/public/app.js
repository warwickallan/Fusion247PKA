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
    onMounted(() => {
      load();
      // One small CAPAE read at start, so Home can answer "what needs my attention?" without
      // Warwick having to go and ask System first. Reuses capRequested, so System never re-reads.
      ensureCapaeSignal();
      // OPTIONAL deep link: ?app=<key>&view=<key>, e.g. from a Telegram card (the checklistPath
      // precedent in runPipeline.js hands Warwick a cockpit URL already — this lets that URL land
      // straight on an app's own view instead of Home). Silently ignored when absent or unknown;
      // never throws, never blocks the normal Home load above.
      try {
        const qp = new URLSearchParams(window.location.search);
        const wantApp = qp.get('app');
        if (wantApp && APPS.some((a) => a.key === wantApp)) {
          go('apps');
          openApp(wantApp);
          const wantView = qp.get('view');
          if (wantView) nextTick(() => goView(wantView));
        }
      } catch (ignore) { /* deep link is a courtesy, never a requirement */ }
    });

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
    // RECENT ACTIVITY — a merged, time-sorted feed across Fusion247, from EXISTING sources only.
    //
    // Widened 2026-08-08: this was "Latest" and behaved like "recently ingested". It now also carries
    // the learning estate's own events, because a family recurring or a prevention becoming proven is
    // exactly the kind of thing Warwick should see without opening System.
    //
    // ⛔ NO EVENT TYPE IS INVENTED. Every row below is derived from a field that already exists and is
    // already fetched. An event that cannot be dated honestly is OMITTED rather than given a
    // plausible timestamp — an activity feed whose ordering is partly guessed is worse than a short
    // one, and building an event store to fix that is the programme this must not become.
    const latest = computed(() => {
      const rows = [];
      for (const o of outputs.value) rows.push({ t: o.produced_at, label: outputTitle(o), kind: 'Output', area: 'outputs' });
      for (const s of (state.value.ingested || [])) rows.push({ t: s.updated_at, label: s.title || s.video_id, kind: 'Captured', area: 'brain' });
      for (const w of wins.value) rows.push({ t: w.happened_at, label: w.text, kind: 'Win', area: 'system' });
      // CAPAE. `last_occurrence_at` is the only honest timestamp a family carries, so a family that
      // has never been observed contributes nothing rather than appearing dated "now".
      for (const f of capList.value) {
        if (!f.last_occurrence_at) continue;
        const kind = f.state === 'CHALLENGED' ? 'Prevention challenged'
          : f.state === 'EFFECTIVE' ? 'Prevention proven'
          : f.state === 'INEFFECTIVE' ? 'Prevention failed'
          : f.occurrences > 0 ? 'Recurrence' : null;
        if (!kind) continue;
        rows.push({ t: f.last_occurrence_at, label: f.title, kind, area: 'system' });
      }
      return rows.filter((x) => x.t && x.label).sort((a, b) => new Date(b.t) - new Date(a.t)).slice(0, 8);
    });

    /**
     * HOME'S ONE ATTENTION SIGNAL. Not a second dashboard — the single most important thing, or
     * nothing at all.
     *
     * Returns null unless a prevention is genuinely in doubt. Routine MONITORING is not an attention
     * item: every family sits at MONITORING most of the time, so surfacing that would make the card
     * permanent furniture and therefore invisible — the same wallpaper failure the Stop reminder had
     * to be redesigned around.
     */
    const homeAttention = computed(() => {
      const o = capOverview.value;
      if (!o || !o.needsAttention) return null;
      const worst = (o.ineffective && o.ineffective[0]) || (o.reopened && o.reopened[0]) || null;
      if (!worst) return null;
      const n = (o.ineffective || []).length + (o.reopened || []).length;
      return {
        headline: `${n} prevention${n === 1 ? '' : 's'} need${n === 1 ? 's' : ''} attention`,
        title: worst.title,
        detail: `${worst.occurrences} occurrence${worst.occurrences === 1 ? '' : 's'}`,
        tone: (o.ineffective || []).length ? 'urgent' : 'prominent',
      };
    });

    /**
     * Load the CAPAE record ONCE so Home can show the signal above and the feed can carry its events.
     *
     * ⚠️ A DELIBERATE CHANGE to the "explicit trigger only" rule, and it is Warwick's: he asked for
     * Home to tell him what needs attention, which IS the request the old rule was protecting him
     * from making by accident. It is one small read, it reuses `capRequested` so System never
     * re-reads, and a failure leaves `capOverview` null — Home then simply shows nothing rather than
     * a broken card.
     */
    function ensureCapaeSignal() {
      if (!capRequested.value && !capLoading.value) loadCapae();
    }

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
    //
    // WP-B15-36, AC7 residual 3 — SCRIPTED FOCUS AND THE :focus-visible HEURISTIC. Vera recorded
    // that Chromium does not reliably apply `:focus-visible` to focus WE moved, so a keyboard user
    // could be left with no visible indicator after a level transition. Two things happen here, and
    // between them the indicator stops depending on a browser heuristic we do not control:
    //   1. `focus({ preventScroll:false, focusVisible:true })` — honoured where implemented,
    //      harmlessly ignored where it is not.
    //   2. a `.kb-focus` class we add ourselves and clear on blur, which the stylesheet renders with
    //      the SAME 2px --accent ring `:focus-visible` already draws. No new token, no second ring.
    // WP-B15-42, VERA RESIDUAL 3 — the ring must follow the KEYBOARD, not every scripted focus.
    // `focusSel()` is also called from mouse-driven `openApp()`, which handed a mouse user a keyboard
    // focus ring. Tracked here rather than guessed per call site, because the call sites do not know
    // how the user got there.
    //
    // ⛔ THE DEFAULT IS TRUE, AND THAT IS THE WHOLE DESIGN DECISION. If these listeners never attach
    // — no document, an exotic host, an input device neither event describes — the ring is SHOWN.
    // An over-visible focus ring harms nobody; a missing one strands a keyboard user with no idea
    // where they are. The failure mode is chosen deliberately toward the accessible outcome.
    let lastInputWasKey = true;
    if (typeof document !== 'undefined' && document.addEventListener) {
      // Capture phase: the flag must be correct before any handler that moves focus reads it.
      document.addEventListener('keydown', () => { lastInputWasKey = true; }, true);
      document.addEventListener('pointerdown', () => { lastInputWasKey = false; }, true);
      // Some hosts fire no pointer events. mousedown/touchstart cover them; all three are idempotent.
      document.addEventListener('mousedown', () => { lastInputWasKey = false; }, true);
      document.addEventListener('touchstart', () => { lastInputWasKey = false; }, true);
    }
    /** VERA RESIDUAL 2 — ONE focus-indicator mechanism, not two. Both `focusSel` and
     * `asdairTrapFocus` route through this, so the sheet-edge wrap draws the SAME ring as every
     * other scripted focus move instead of leaning on the very `:focus-visible` heuristic residual 3
     * exists to stop depending on. */
    function focusWithRing(el) {
      if (!el) return false;
      try { el.focus({ focusVisible: true }); } catch (e) { el.focus(); }
      if (!lastInputWasKey) return true;
      el.classList.add('kb-focus');
      const drop = () => { el.classList.remove('kb-focus'); el.removeEventListener('blur', drop); };
      el.addEventListener('blur', drop);
      return true;
    }
    async function focusSel(sel) {
      await nextTick();
      const el = document.querySelector(sel);
      if (!el) return false;
      return focusWithRing(el);
    }
    // The focusable set inside the AsdAIr sheet, in DOM order, disabled controls excluded — which is
    // what makes the two trap sentinels correct even when the last button is greyed out.
    function asdairTrapFocus(edge) {
      const card = document.querySelector('.asdair-sheet');
      if (!card) return;
      const els = Array.prototype.filter.call(
        card.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
        (el) => !el.disabled && el.getAttribute('aria-hidden') !== 'true' && el.offsetParent !== null,
      );
      if (!els.length) return;
      // Reaching a sentinel is only possible by TAB, so this is by definition a keyboard move.
      lastInputWasKey = true;
      focusWithRing(edge === 'last' ? els[els.length - 1] : els[0]);
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
        // Measure the photograph as soon as we know which shop it belongs to. The per-line crops
        // (AC5) need its natural pixel size, and this is the one place a shop id becomes known.
        if (d.evidence && d.evidence.has_media) asdairMeasureMedia();
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
    // ⛔ REMOVED IN WP-B15-36 — `asdairWaitingOn(shop, openCount)`, deliberately, and this note is
    // here so nobody restores it. It derived a SECOND status sentence from raw stage /
    // needs_review / open-count, alongside the canonical-state chip. AC2 is explicit: "No second
    // status indicator may contradict it." Two independently-derived sentences on one screen is
    // exactly the contradiction the design doc records Warwick hitting — "Waiting on you — check
    // Telegram" beside "0 still waiting on you". Its job is now done ONCE, by
    // `asdairBlockingSentence`, from the canonical state. Every sentence it used to produce
    // (failure, terminal, needs-decision, working) has a counterpart there.
    // The raw stage and needs_review it read are still shown — under the cog, in Diagnostics, where
    // internal state names belong.
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

    // =====================================================================================
    // BUILD-015 · WP-B15-36 (WO-2026-08-13-03) — COCKPIT UI CONVERGENCE.
    // Supersedes the B15-26 block that stood here. Warwick's test is the whole specification:
    //   "The normal Cockpit experience must be HUMAN-READABLE, RELEVANT, INFORMATIVE, NOT A
    //    DATABASE VIEW." and "Do not make Warwick reconcile contradictory counts or labels himself."
    // =====================================================================================

    // ---- THE BACKEND SEAM, DECLARED IN ONE PLACE ----------------------------------------------
    // The Cockpit BACKEND is being converged on `build-015/b15-25-cockpit-backend` AT THE SAME TIME
    // as this UI (WO-2026-08-13-02). Guessing one field name and silently rendering "Status unknown"
    // when it is wrong is exactly the silent seam disagreement that order exists to prevent — so
    // this reads a DECLARED, ORDERED candidate list and RECORDS which one answered (`asdairSeam`,
    // surfaced in Diagnostics). The seam is visible, not assumed.
    //
    //   'human_state'     asdair.shop.human_state — the REAL durable column, migration 020
    //                     (`020_shop_line_provenance_and_human_state.sql` §5). This is what
    //                     WO-2026-08-13-02 AC1 converges canonicalState.js onto. Tried FIRST.
    //   'canonical_state' what assembleWorkspace.js emits TODAY on the backend branch head
    //                     (`shop.canonical_state`, computed by cockpit-api/canonicalState.js).
    //   'cockpit_state'   the B15-26 placeholder this UI shipped with. Kept LAST so an older
    //                     backend still renders rather than regressing to "unknown".
    //
    // ⚠️ Only the PAYLOAD FIELD NAME is uncertain. The six VALUES are NOT a guess — they are the
    // closed vocabulary migration 020's own CHECK constraint enforces.
    const ASDAIR_STATE_FIELDS = Object.freeze(['human_state', 'canonical_state', 'cockpit_state']);

    // ---- ONE canonical state, ONE derivation site (AC2) --------------------------------------
    // Reads a single named field and NEVER recomputes a status from raw counts. No other function
    // in this file may derive a Shop-status label or sentence; both come from `asdairStatus` and
    // `asdairBlockingSentence`, and both read THIS value.
    const ASDAIR_STATE_PRESENTATION = Object.freeze({
      NEEDS_WARWICK: Object.freeze({ label: 'Needs you', tone: 'amber' }),
      ASDAIR_WORKING: Object.freeze({ label: 'AsdAIr is working', tone: 'blue' }),
      READY_FOR_WARWICK: Object.freeze({ label: 'Ready for you', tone: 'green' }),
      BROWSER_WORKING: Object.freeze({ label: 'Building your basket', tone: 'blue' }),
      COMPLETE: Object.freeze({ label: 'Complete', tone: 'green' }),
      FAILED: Object.freeze({ label: 'Something went wrong', tone: 'red' }),
    });
    /** PURE. Six-value canonical state -> {label, tone}. Independently testable without a live
     * backend — see the six-state evidence pasted in the final report. */
    function asdairStatePresentation(raw) {
      const key = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
      return ASDAIR_STATE_PRESENTATION[key] || { label: 'Status unknown', tone: 'grey' };
    }
    /** PURE. The seam resolver: the first declared field carrying a real value wins. Returns BOTH
     * the value and the field it came from, so an answer and its provenance never separate. */
    function asdairResolveState(shop) {
      const s = shop && typeof shop === 'object' ? shop : null;
      if (!s) return { field: null, value: null };
      for (const f of ASDAIR_STATE_FIELDS) {
        const v = s[f];
        if (typeof v === 'string' && v.trim() !== '' && v.trim().toLowerCase() !== 'unknown') {
          return { field: f, value: v.trim().toUpperCase() };
        }
      }
      return { field: null, value: null };
    }
    const asdairSeam = computed(() => asdairResolveState(asdairShop.value));
    const asdairCanonicalState = computed(() => asdairSeam.value.value);
    const asdairStateField = computed(() => asdairSeam.value.field);
    const asdairStatus = computed(() => asdairStatePresentation(asdairCanonicalState.value));

    // ---- Reading the API's OWN counts, once each ----------------------------------------------
    // "unknown" is the API's word for a fact it does not hold; it is NEVER rewritten to 0. Each
    // number below has exactly ONE reader, and the SAME reader feeds both the counter on screen and
    // the sentence — which is why a counter and the sentence structurally cannot disagree (AC1).
    function asdairCount(v) {
      if (v === null || v === undefined || v === '' || v === 'unknown') return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    const asdairOpenQuestions = computed(() =>
      asdairCount(asdairWs.value && asdairWs.value.questions && asdairWs.value.questions.open_count_display));
    const asdairAnsweredQuestions = computed(() =>
      asdairCount(asdairWs.value && asdairWs.value.questions && asdairWs.value.questions.resolved_count_display));
    const asdairOpenLines = computed(() =>
      asdairCount(asdairShop.value && asdairShop.value.lines_summary && asdairShop.value.lines_summary.open_display));
    const asdairTotalLines = computed(() =>
      asdairCount(asdairShop.value && asdairShop.value.lines_summary && asdairShop.value.lines_summary.total_display));
    const asdairResolvedLineCount = computed(() =>
      asdairCount(asdairShop.value && asdairShop.value.lines_summary && asdairShop.value.lines_summary.resolved_display));
    const plural = (n, one, many) => (n === 1 ? one : many);

    // ---- AC1: "WHY ISN'T MY BASKET READY?" — ONE prominent sentence ---------------------------
    // Warwick's own examples ARE the specification and are reproduced verbatim in the derivation:
    //   "2 decisions still need you."
    //   "Nothing needs you. AsdAIr is reconciling 3 products."
    //   "Everything is resolved. Ready to build the ASDA basket."
    //   "Basket build failed. Nothing was ordered."
    // ⛔ "Never require Warwick to infer this from several counters."
    //
    // A BACKEND-SUPPLIED sentence always wins, because the backend WP (AC3) builds one from the same
    // data as its counts. Only when none is supplied does this derive one — and the derivation takes
    // its SHAPE from the canonical state (the same value the status chip renders) and its NUMBERS
    // from the same fields the on-screen counters read. Neither half is independently computed,
    // which is what makes the sentence and the counters unable to contradict each other.
    //
    // ⚠️ ASSUMPTION, REPORTED: the backend sentence field name is not yet published. These are the
    // names probed for, in order; if the real one differs it is a ONE-LINE change here.
    const ASDAIR_SENTENCE_FIELDS = Object.freeze([
      'blocking_reason_display', 'why_not_ready_display', 'human_state_reason_display', 'blocking_sentence_display',
    ]);
    function asdairBackendSentence(shop) {
      const s = shop && typeof shop === 'object' ? shop : null;
      if (!s) return null;
      for (const f of ASDAIR_SENTENCE_FIELDS) {
        const v = s[f];
        if (typeof v === 'string' && v.trim() !== '' && v.trim().toLowerCase() !== 'unknown') return v.trim();
      }
      return null;
    }
    /** PURE. state + the API's own counts -> the one sentence. Independently testable. */
    function asdairDeriveSentence(state, openQuestions, openLines, failure) {
      switch (state) {
        case 'NEEDS_WARWICK':
          if (openQuestions !== null && openQuestions > 0) {
            return openQuestions + ' ' + plural(openQuestions, 'decision', 'decisions') + ' still '
              + plural(openQuestions, 'needs', 'need') + ' you.';
          }
          return 'AsdAIr needs a decision from you before this shop can go ahead.';
        case 'ASDAIR_WORKING':
          if (openLines !== null && openLines > 0) {
            return 'Nothing needs you. AsdAIr is reconciling ' + openLines + ' ' + plural(openLines, 'product', 'products') + '.';
          }
          return 'Nothing needs you. AsdAIr is still working on this shop.';
        case 'READY_FOR_WARWICK':
          return 'Everything is resolved. Ready to build the ASDA basket.';
        case 'BROWSER_WORKING':
          return 'Nothing needs you. Your ASDA basket is being built right now.';
        case 'COMPLETE':
          return 'This shop is finished. Nothing needs you.';
        case 'FAILED': {
          // Warwick's example names the basket build specifically. Say that ONLY when the recorded
          // failure actually came from the basket half — never as a blanket claim.
          const from = failure && typeof failure.failed_from_display === 'string' ? failure.failed_from_display : '';
          return (/BROWSER|SHOPPING|BASKET/i.test(from) ? 'Basket build failed.' : 'Something went wrong.')
            + ' Nothing was ordered.';
        }
        default:
          return null;
      }
    }
    const asdairBlockingSentence = computed(() => asdairBackendSentence(asdairShop.value)
      || asdairDeriveSentence(asdairCanonicalState.value, asdairOpenQuestions.value, asdairOpenLines.value,
        asdairShop.value && asdairShop.value.failure));
    const asdairSentenceSource = computed(() => (asdairBackendSentence(asdairShop.value)
      ? 'supplied by AsdAIr' : (asdairCanonicalState.value ? 'derived from the one canonical state' : 'none')));

    // ---- The one thing Warwick must NEVER be asked to reconcile himself -----------------------
    // If the canonical state and the open-question count genuinely disagree, that is a FAULT in the
    // data, not a puzzle for him. It is surfaced as a fault, in words, once — never by showing two
    // numbers and leaving him to work it out.
    const asdairStateDisagreement = computed(() => {
      const st = asdairCanonicalState.value;
      const q = asdairOpenQuestions.value;
      if (!st || q === null) return null;
      if (st === 'NEEDS_WARWICK' && q === 0) {
        return 'AsdAIr says it needs a decision from you, but records no open questions. That is a fault in AsdAIr, not something for you to resolve.';
      }
      if (st !== 'NEEDS_WARWICK' && st !== 'FAILED' && q > 0) {
        return 'AsdAIr says nothing needs you, but still has ' + q + ' open ' + plural(q, 'question', 'questions')
          + '. That is a fault in AsdAIr, not something for you to resolve.';
      }
      return null;
    });

    // ---- AC3: THIS WEEK'S SHOP, IN HUMAN TERMS ------------------------------------------------
    // The FOUR provenance origins stay visibly distinct — PHOTO / REGULARS / HOUSEHOLD RULES /
    // WARWICK — plus SKIPPED. ⛔ "Never an undifferentiated database-derived blob."
    // Warwick's summary shape: "39 from photograph + N Regulars − N skipped = N final products /
    // N items."
    //
    // The origin names are NOT invented: 'PHOTO' | 'REGULARS' | 'RULE' | 'WARWICK' is the closed
    // vocabulary of `asdair.shop_line_provenance.provenance`, enforced by that table's own CHECK
    // constraint in migration 020 §2.
    //
    // THREE ROUTES, in order, and the route used is always shown on screen:
    //   'api'    the backend published a `provenance` summary block (WO-2026-08-13-02 AC4).
    //   'lines'  no summary block, but the lines carry their own `provenance`: counted here.
    //   'none'   neither. Rendered as an HONEST GAP naming what is missing. Never fabricated.
    const ASDAIR_ORIGINS = Object.freeze([
      { key: 'PHOTO', label: 'From the photograph', blurb: 'Read straight off the list you sent.' },
      { key: 'REGULARS', label: 'Added from your Regulars', blurb: 'Not on the list — added because you normally buy it.' },
      { key: 'RULE', label: 'From household rules', blurb: 'Added by a standing rule you set.' },
      { key: 'WARWICK', label: 'You decided this week', blurb: 'Your own decision for this shop.' },
      { key: 'SKIPPED', label: 'Skipped this week', blurb: 'Deliberately left out. Nothing was substituted.' },
    ]);
    const ASDAIR_ORIGIN_ALIASES = Object.freeze({
      PHOTO: 'PHOTO', PHOTOGRAPH: 'PHOTO', LIST: 'PHOTO',
      REGULARS: 'REGULARS', REGULAR: 'REGULARS',
      RULE: 'RULE', RULES: 'RULE', HOUSEHOLD_RULE: 'RULE',
      WARWICK: 'WARWICK', HUMAN: 'WARWICK',
      SKIPPED: 'SKIPPED', SKIP: 'SKIPPED',
    });
    /** PURE. Normalise whatever origin token a line carries into one of the five, or null. */
    function asdairOrigin(raw) {
      const k = typeof raw === 'string' ? raw.trim().toUpperCase().replace(/[\s-]+/g, '_') : '';
      return ASDAIR_ORIGIN_ALIASES[k] || null;
    }
    /** A line's origin, from the line's OWN provenance field. A line with no provenance field is
     * NOT guessed at — it returns null and is counted as unattributed. */
    const asdairLineOrigin = (ln) => (ln ? asdairOrigin(ln.provenance || ln.provenance_display || ln.origin) : null);

    // ---- AC4: EXCEPTION-FIRST BY DEFAULT ------------------------------------------------------
    // "Warwick is NOT going to proofread 39 lines every week." Default emphasis: needs attention ·
    // changes and additions · unresolved exceptions. Resolved lines stay available, compact and
    // collapsed. The full photograph is available WHEN WANTED, never by default.
    const asdairLineFilter = ref('exceptions'); // 'exceptions' | 'all'
    const asdairAllLines = computed(() => (asdairWs.value && asdairWs.value.interpretation && asdairWs.value.interpretation.lines) || []);
    /** NEEDS ATTENTION — a line AsdAIr could not settle on its own. */
    const ASDAIR_ATTENTION_STATUSES = Object.freeze(['needs_confirmation', 'possible_duplicate', 'unreadable']);
    const asdairAttentionLines = computed(() => asdairAllLines.value.filter((ln) => ASDAIR_ATTENTION_STATUSES.indexOf(ln.status) !== -1));
    /** CHANGES AND ADDITIONS — settled, but NOT simply read off the photograph. Decided by the
     * line's own provenance where it has one; where it has none, a new item is the honest proxy. */
    const asdairChangeLines = computed(() => asdairAllLines.value.filter((ln) => {
      if (ASDAIR_ATTENTION_STATUSES.indexOf(ln.status) !== -1) return false;
      const o = asdairLineOrigin(ln);
      if (o) return o !== 'PHOTO';
      return ln.status === 'unmatched_new_item';
    }));
    /** RESOLVED — everything else. Collapsed by default, one compact row each. */
    const asdairResolvedLines = computed(() => {
      const flagged = new Set([].concat(asdairAttentionLines.value, asdairChangeLines.value));
      return asdairAllLines.value.filter((ln) => !flagged.has(ln));
    });
    const asdairExceptionLines = computed(() => [].concat(asdairAttentionLines.value, asdairChangeLines.value));
    const asdairShopLines = computed(() => (asdairLineFilter.value === 'all' ? asdairAllLines.value : asdairExceptionLines.value));

    const asdairProvenance = computed(() => {
      const ws = asdairWs.value;
      const api = ws && ws.provenance && typeof ws.provenance === 'object' ? ws.provenance : null;
      const lines = asdairAllLines.value;
      const counts = { PHOTO: null, REGULARS: null, RULE: null, WARWICK: null, SKIPPED: null };
      let route = 'none';
      let unattributed = null;

      if (api) {
        route = 'api';
        counts.PHOTO = asdairCount(api.photo_display);
        counts.REGULARS = asdairCount(api.regulars_display);
        counts.RULE = asdairCount(api.rules_display !== undefined ? api.rules_display : api.rule_display);
        counts.WARWICK = asdairCount(api.warwick_display);
        counts.SKIPPED = asdairCount(api.skipped_display);
      } else if (lines.some((ln) => asdairLineOrigin(ln) !== null)) {
        route = 'lines';
        Object.keys(counts).forEach((k) => { counts[k] = 0; });
        unattributed = 0;
        lines.forEach((ln) => {
          const o = asdairLineOrigin(ln);
          if (o) counts[o] += 1; else unattributed += 1;
        });
      }

      const finalProducts = api ? asdairCount(api.final_products_display) : null;
      const finalItems = api ? asdairCount(api.final_items_display) : null;

      // Warwick's equation, assembled ONLY from terms that are actually known. A missing term is
      // never filled with a zero — the equation simply is not claimed, and the gap is named on screen.
      let equation = null;
      if (counts.PHOTO !== null && counts.REGULARS !== null && counts.SKIPPED !== null && finalProducts !== null) {
        equation = counts.PHOTO + ' from the photograph + ' + counts.REGULARS + ' from Regulars − '
          + counts.SKIPPED + ' skipped = ' + finalProducts + ' products'
          + (finalItems !== null ? ' / ' + finalItems + ' items' : '');
      }

      return {
        route: route,
        origins: ASDAIR_ORIGINS.map((o) => ({ key: o.key, label: o.label, blurb: o.blurb, n: counts[o.key] })),
        unattributed: unattributed,
        source_lines: api ? asdairCount(api.source_lines_display) : asdairTotalLines.value,
        source_read: api && api.source_read_status_display ? String(api.source_read_status_display) : null,
        reconciled_products: api ? asdairCount(api.reconciled_products_display) : null,
        final_products: finalProducts,
        final_items: finalItems,
        equation: equation,
        summary: api && typeof api.summary_display === 'string' && api.summary_display.trim() ? api.summary_display.trim() : null,
      };
    });

    // Plain-English provenance for one line — never a raw status key, never a confidence decimal.
    // Where the line carries a real four-way origin it is used; otherwise the interpretation status
    // is translated. Both routes end in a sentence a person reads, never an enum.
    const ASDAIR_ORIGIN_PHRASE = Object.freeze({
      PHOTO: 'from the photograph', REGULARS: 'added from your Regulars',
      RULE: 'added by a household rule', WARWICK: 'you decided this', SKIPPED: 'skipped this week',
    });
    const ASDAIR_STATUS_PHRASE = Object.freeze({
      matched: 'from the photograph', needs_confirmation: 'from the photograph — needs confirming',
      possible_duplicate: 'from the photograph — looks like a duplicate',
      unmatched_new_item: 'from the photograph — new item',
      unreadable: 'from the photograph — could not be read',
    });
    /** Tolerant of BOTH call shapes — a line object, or a bare status string — so there is exactly
     * one place this wording lives. */
    function asdairLineProvenance(lineOrStatus) {
      if (lineOrStatus && typeof lineOrStatus === 'object') {
        const o = asdairLineOrigin(lineOrStatus);
        if (o && o !== 'PHOTO') return ASDAIR_ORIGIN_PHRASE[o];
        return ASDAIR_STATUS_PHRASE[lineOrStatus.status] || ASDAIR_ORIGIN_PHRASE.PHOTO;
      }
      return ASDAIR_STATUS_PHRASE[lineOrStatus] || ASDAIR_ORIGIN_PHRASE.PHOTO;
    }
    /** What a line is CALLED on a human screen.
     * CAUGHT BY READING THE RENDERED OUTPUT, not by reading the diff (AC8, and the reason AC8 is an
     * acceptance criterion): an unreadable line carries the API's own word "unknown" in BOTH
     * `canonical_product_name_display` and `raw_reading_display`, and the previous expression
     * printed that word as the product's title. The word "unknown" sitting where a product name
     * belongs is a database view, which is the single thing Warwick said this screen must not be. */
    function asdairLineTitle(ln) {
      const l = ln || {};
      if (asdairKnown(l.canonical_product_name_display)) return l.canonical_product_name_display;
      if (asdairKnown(l.raw_reading_display)) return l.raw_reading_display;
      return 'AsdAIr couldn’t read this line';
    }
    /** The GENERAL form of the same rule, for a slot that must still read as English when the API
     * holds no value. "unknown" is the API's own word for absence and must never reach a screen.
     * Added after Vera's gate found the identical defect surviving on the Rules screen while the
     * Shop screen was fixed in the same commit — a one-site fix for a wording rule invites exactly
     * that, so the rule now has a name that the next site can reach for. */
    const asdairSaid = (v, absent) => (asdairKnown(v) ? String(v) : absent);

    // =====================================================================================
    // BUILD-015 · WP-B15-42 (WO-2026-08-13-07) — COCKPIT IS THE PLACE WARWICK RUNS HIS SHOP.
    //
    // Warwick: "Cockpit is AsdAIr's control surface. Telegram is ingestion + notifications."
    // He must resolve exceptions HERE — "Not by scrolling Telegram. Not by asking Larry. Not by
    // reading database rows."
    //
    // This block adds four things the B15-36 block did not carry:
    //   1. ONE exception board, joining questions to the lines they hold up.
    //   2. The FINAL LIST, grouped by brand.
    //   3. CORROBORATION vocabulary — never "verified". Warwick's explicit ruling.
    //   4. Stale "needs human" suppression, on the UI side of the seam.
    // =====================================================================================

    // ---- ⛔ SORT SENTINELS ARE NOT BRAND NAMES ------------------------------------------------
    // The real reconciled artefact carries `brand: "ZZ (no brand recorded)"` on every held line.
    // That string exists so an unbranded line SORTS LAST — it is machinery, not a fact about a
    // product. Printed as-is, Warwick reads a brand called "ZZ (no brand recorded)", which is the
    // same defect class as the API's word `unknown` reaching a product title (Vera's finding,
    // WP-B15-36). It is caught here once, so the rule travels instead of being fixed per site.
    //
    // Matched EXACTLY, never by prefix: a real brand may legitimately begin with those letters, and
    // silently blanking it would be a worse bug than the one being fixed.
    const ASDAIR_BRAND_SENTINELS = Object.freeze(['zz', 'zzz', 'zzzz', '~', '~~', 'zz (no brand recorded)']);
    /** PURE. A brand a person can read, or null when the value is absent or a sort sentinel. */
    function asdairBrand(raw) {
      if (!asdairKnown(raw)) return null;
      const s = String(raw).trim();
      if (!s) return null;
      const k = s.toLowerCase();
      if (ASDAIR_BRAND_SENTINELS.indexOf(k) !== -1) return null;
      // Any sentinel that SAYS what it is, whatever letters carry it to the end of the sort.
      if (/no brand recorded/i.test(s)) return null;
      return s;
    }
    /** The heading an unbranded run gets. A statement about the record, never a brand name. */
    const ASDAIR_NO_BRAND = 'No brand recorded';

    // ---- AC6 — "CORROBORATED", NEVER "VERIFIED". Warwick's explicit ruling ---------------------
    // ⛔ "2-OF-3 IS CORROBORATION, NOT VERIFICATION… Do not let UI, receipts or Veritas call it
    // verified." Three readings by ONE model of ONE photograph are correlated, so agreement between
    // them is corroboration — including 3 of 3. There is no support level in this vocabulary that
    // earns the word "verified", which is why no branch below can produce it.
    //
    // This is a TRUTHFULNESS requirement, not a wording preference: `render-vm-check.mjs` carries a
    // global detector banning the word from rendered text, and a mutation proving the detector fires.
    const ASDAIR_CORROBORATION_CAVEAT = 'Agreement between readings is corroboration, not verification — the readings come from one model reading one photograph, so they can agree and still be wrong together.';
    /**
     * PURE. Support figures -> what a person is told. Accepts the reconciled artefact's
     * `provenance_detail` ({support, support_of, support_class}) or any object carrying those.
     * Returns null when nothing is recorded — an absent corroboration is never rendered as a
     * reassuring one.
     * @returns {null|{word:string, sentence:string, tone:'ok'|'warn'|'block'}}
     */
    function asdairCorroboration(d) {
      const o = d && typeof d === 'object' ? d : null;
      if (!o) return null;
      const n = asdairCount(o.support);
      const of = asdairCount(o.support_of);
      const cls = typeof o.support_class === 'string' ? o.support_class.trim().toLowerCase() : null;
      if (n !== null && of !== null && of > 0) {
        if (n >= of) {
          return { word: 'Corroborated', tone: 'ok',
            sentence: 'All ' + of + ' readings of the photograph agreed on this line.' };
        }
        if (n > 1) {
          return { word: 'Corroborated', tone: 'ok',
            sentence: n + ' of ' + of + ' readings of the photograph agreed on this line.' };
        }
        return { word: 'Not corroborated', tone: 'block',
          sentence: 'Only ' + n + ' of ' + of + ' readings saw this line, so nothing else supports it.' };
      }
      // No numbers, but a recorded class. Say what the class means; never invent a figure for it.
      if (cls === 'unanimous' || cls === 'corroborated') {
        return { word: 'Corroborated', tone: 'ok', sentence: 'More than one reading of the photograph agreed on this line.' };
      }
      if (cls === 'uncorroborated') {
        return { word: 'Not corroborated', tone: 'block', sentence: 'Only one reading saw this line, so nothing else supports it.' };
      }
      return null;
    }

    // ---- The FINAL LIST seam — TWO recognised shapes, both declared -----------------------------
    // ⚠️ ASSUMPTION, REPORTED, AND STATED ON SCREEN. Lane C (WP-B15-41) had not started when this was
    // built, so there is no published endpoint for the reconciled list. Two shapes are recognised,
    // in this order, and the one that answered is named in Diagnostics and on the list screen:
    //
    //   'packet'  services/asdair/cockpit-api/readPacket.js — the DOCUMENTED contract. Already
    //             publishes brand_display / has_brand / required_quantity_display / held[] and
    //             asserts its own Brand A-Z sort. Primary.
    //   'final'   the shape the REAL reconciled artefact actually has today
    //             (services/asdair/pipeline/finalise/out/final-shopping-list.json, WP-B15-37):
    //             lines[] with brand / product / quantity / provenance_detail / held_reason /
    //             routed_question, plus totals and a skipped[] carrying human reasons.
    //
    // ⛔ NEITHER route may invent a line. With both absent the screen renders an honest gap naming
    // what is missing. A plausible-looking shopping list that did not come from real reconciliation
    // is worse than an empty screen, because Warwick would act on it.
    const ASDAIR_FINAL_FIELDS = Object.freeze(['final_list', 'shopping_list', 'reconciled_list']);
    const asdairFinalDoc = computed(() => {
      const carriers = [asdairWs.value, asdairPacket.value];
      for (const c of carriers) {
        if (!c || typeof c !== 'object') continue;
        for (const f of ASDAIR_FINAL_FIELDS) {
          const v = c[f];
          if (v && typeof v === 'object' && Array.isArray(v.lines)) return v;
        }
      }
      return null;
    });
    /** Which shape answered, or 'none'. Shown on screen — an assumption nobody can see is a lie. */
    const asdairListSource = computed(() => {
      if (asdairPacketDoc.value && Array.isArray(asdairPacketDoc.value.lines) && asdairPacketDoc.value.lines.length) return 'packet';
      if (asdairFinalDoc.value) return 'final';
      return 'none';
    });

    // Plain English for the reconciled artefact's quantity_basis vocabulary. Mirrors the producer's
    // own closed set; an unrecognised basis is PRINTED AS ITSELF rather than dropped, so a new one
    // shows up as needing a phrase instead of vanishing.
    const ASDAIR_QTY_BASIS = Object.freeze({
      'explicit-on-page': 'the number written on the list',
      'household-default-one': 'no number was written, so one',
      'pack-identity-not-quantity': 'that is the pack size, not a count',
      'conflicting-observations': 'the readings disagreed, so this is not settled',
    });
    // Mirrors readPacket.js's HELD_REASON_MEANING. Duplicated deliberately and said so: the
    // reconciled-artefact shape carries the bare reason with no meaning beside it, and the backend's
    // own `reason_meaning` is preferred wherever it IS published (see asdairListRow).
    const ASDAIR_HELD_REASON = Object.freeze({
      ambiguous: 'the reading was ambiguous',
      awaiting_decision: 'waiting on an answer from you',
      excluded_by_rule: 'excluded by a standing rule',
      not_stocked: 'ASDA does not stock it',
      out_of_stock: 'out of stock',
      possible_duplicate: 'looks like a duplicate of another line',
    });

    /** PURE. One row of the final list, from EITHER shape, normalised to what a person reads.
     * `product` may legitimately be null — a held line has no settled product — in which case the
     * raw reading is the only honest title and `asdairSaid` supplies the fallback wording. */
    function asdairListRow(l, shape, i) {
      const o = l && typeof l === 'object' ? l : {};
      if (shape === 'packet') {
        const qty = asdairCount(o.required_quantity_display);
        return {
          key: 'p' + (o.seq_display != null ? o.seq_display : i),
          brand: asdairBrand(o.has_brand ? o.brand_display : null),
          product: asdairSaid(o.canonical_product_name_display, null),
          raw: asdairSaid(o.original_list_line_display, null),
          qty: qty,
          qtyWhy: o.has_quantity_rationale ? asdairSaid(o.quantity_rationale_display, null) : null,
          provenance: o.is_new ? 'searched for — this item is new' : asdairSaid(o.source_view_meaning, null),
          corroboration: asdairCorroboration(o.provenance_detail || o.corroboration),
          rules: Array.isArray(o.applied_rules) ? o.applied_rules : [],
          exception: false, heldReason: null, heldDetail: null, questionKey: null,
          incomplete: !!o.identity_incomplete,
        };
      }
      const d = o.provenance_detail && typeof o.provenance_detail === 'object' ? o.provenance_detail : null;
      const basis = typeof o.quantity_basis === 'string' ? o.quantity_basis : null;
      const reason = typeof o.held_reason === 'string' ? o.held_reason : null;
      return {
        key: 'f' + (d && d.line_no != null ? d.line_no : i),
        brand: asdairBrand(o.brand),
        product: asdairSaid(o.product, null),
        raw: asdairSaid(o.list_item_name, asdairSaid(d && d.raw_reading, null)),
        qty: asdairCount(o.quantity),
        qtyWhy: asdairSaid(o.quantity_note, basis ? (ASDAIR_QTY_BASIS[basis] || basis) : null),
        // The SAME wording function the Shop screen uses, so one line cannot describe its own origin
        // two different ways on two screens. It already handles PHOTO by falling through to the
        // interpretation-status phrase, which is why both fields are handed to it.
        provenance: asdairLineProvenance({ provenance: o.provenance, status: o.status }),
        corroboration: asdairCorroboration(d),
        rules: [],
        exception: o.shoppable === false,
        heldReason: reason ? (asdairSaid(o.reason_meaning, null) || ASDAIR_HELD_REASON[reason] || reason) : null,
        heldDetail: asdairSaid(o.held_detail, null),
        questionKey: asdairSaid(o.routed_question, null),
        incomplete: false,
      };
    }

    /** Every row of the final list, in the PRODUCER'S OWN ORDER. */
    const asdairListRows = computed(() => {
      const src = asdairListSource.value;
      if (src === 'packet') {
        const doc = asdairPacketDoc.value;
        const lines = doc.lines.map((l, i) => asdairListRow(l, 'packet', i));
        // The packet keeps held lines in their own array, so they become exception rows here —
        // one list, exceptions marked, which is what "one coherent view" means on this screen.
        const held = (doc.held || []).map((h, i) => ({
          key: 'ph' + i, brand: null,
          product: null, raw: asdairSaid(h.original_list_line_display, null),
          qty: null, qtyWhy: null, provenance: null, corroboration: null, rules: [],
          exception: true,
          heldReason: asdairSaid(h.reason_meaning, null) || ASDAIR_HELD_REASON[h.reason_display] || asdairSaid(h.reason_display, null),
          heldDetail: asdairSaid(h.detail_display, null), questionKey: null, incomplete: false,
        }));
        return lines.concat(held);
      }
      if (src === 'final') return asdairFinalDoc.value.lines.map((l, i) => asdairListRow(l, 'final', i));
      return [];
    });
    const asdairListResolvedRows = computed(() => asdairListRows.value.filter((r) => !r.exception));
    const asdairListExceptionRows = computed(() => asdairListRows.value.filter((r) => r.exception));

    // ---- AC5 — BRAND GROUPING, WITHOUT SILENTLY RE-SORTING -------------------------------------
    // ⛔ THE DECISION, RECORDED BECAUSE IT LOOKS LIKE A BUG UNTIL IT IS EXPLAINED. Rows are grouped
    // into CONSECUTIVE RUNS of the same brand. They are NOT re-sorted.
    //
    // Both producers declare Brand A-Z then product A-Z, and readPacket.js ASSERTS that contract and
    // publishes `sort_verified` so a consumer can see a breach. When the producer honours it,
    // consecutive-run grouping and a full sort are the same picture. When the producer BREAKS it,
    // the same brand appears as two groups and the existing loud banner fires — whereas a UI-side
    // sort would silently repair the display and hide a producer defect that costs real time in
    // ASDA. Showing the breach is the honest half; hiding it is how a wrong list ships looking right.
    const asdairListGroups = computed(() => {
      const out = [];
      for (const r of asdairListResolvedRows.value) {
        const label = r.brand || ASDAIR_NO_BRAND;
        const last = out[out.length - 1];
        if (last && last.label === label) last.rows.push(r);
        else out.push({ key: 'g' + out.length + ':' + label, label: label, branded: !!r.brand, rows: [r] });
      }
      return out;
    });
    /** A brand appearing in two separate runs means the declared sort is not the actual sort. */
    const asdairListSortBroken = computed(() => {
      const seen = new Set();
      for (const g of asdairListGroups.value) {
        if (seen.has(g.label)) return true;
        seen.add(g.label);
      }
      return false;
    });
    /** The list totals, from whichever shape answered. A term nobody published stays null. */
    const asdairListTotals = computed(() => {
      const src = asdairListSource.value;
      if (src === 'packet') {
        const d = asdairPacketDoc.value;
        return {
          products: asdairCount(d.expected_distinct_products_display) !== null
            ? asdairCount(d.expected_distinct_products_display) : asdairCount(d.lines_count_display),
          items: asdairCount(d.expected_total_units_display),
          shoppable: asdairCount(d.lines_count_display),
          held: asdairCount(d.held_count_display),
        };
      }
      if (src === 'final') {
        const t = (asdairFinalDoc.value && asdairFinalDoc.value.totals) || {};
        return {
          products: asdairCount(t.product_count), items: asdairCount(t.item_count),
          shoppable: asdairCount(t.shoppable_lines), held: asdairCount(t.held_lines),
        };
      }
      return { products: null, items: null, shoppable: null, held: null };
    });
    /** AC1 — "final reconciled product count" and "total item/unit count", from whichever source
     * holds them. The provenance summary wins where it publishes them (it is the same block the
     * equation above is assembled from, so the two can never disagree); the list totals fill the
     * gap. A term neither publishes stays null and the row says so instead of showing a zero. */
    const asdairFinalShop = computed(() => {
      const p = asdairProvenance.value;
      const t = asdairListTotals.value;
      const pick = (a, b) => (a !== null && a !== undefined ? a : b);
      return {
        products: pick(p.final_products, t.products),
        items: pick(p.final_items, t.items),
        shoppable: t.shoppable, held: t.held,
      };
    });
    /** Lines deliberately left out, WITH the reason in the producer's own words. Rendered nowhere
     * before this WP, which meant "what was skipped" (AC1) had no answer on any screen. */
    const asdairSkippedLines = computed(() => {
      const doc = asdairFinalDoc.value;
      const arr = doc && Array.isArray(doc.skipped) ? doc.skipped : [];
      return arr.map((s, i) => ({
        key: 's' + i,
        raw: asdairSaid(s && s.as_written, 'a line with no recorded wording'),
        reason: asdairSaid(s && s.reason, 'no reason was recorded'),
        corroboration: asdairCorroboration(s),
      }));
    });

    // ---- AC4 — NO STALE "NEEDS HUMAN". The UI half, and only the UI half ------------------------
    // The defect: a line whose question has ALREADY been answered keeps rendering as needing him.
    // Its data half belongs to Lanes AB and C — the line's own status is what goes stale.
    //
    // The UI half is a rule, not a patch: a line is only an exception if NOTHING has resolved it.
    // The resolved-question set is the authority, because a question moving to `resolved` is the
    // event that settles the line, and it is published on the same payload the stale status is.
    const asdairResolvedQuestionKeys = computed(() => {
      const qs = (asdairWs.value && asdairWs.value.questions) || null;
      const out = new Set();
      for (const q of (qs && Array.isArray(qs.resolved) ? qs.resolved : [])) {
        if (asdairKnown(q && q.question_key)) out.add(String(q.question_key));
      }
      return out;
    });
    /** PURE-ish. Has this line already been settled by an answered question? */
    const asdairLineSettled = (ln) => {
      const k = ln && (ln.routed_question || ln.question_key || ln.routed_question_key);
      return asdairKnown(k) && asdairResolvedQuestionKeys.value.has(String(k));
    };
    /** The attention lines a person should actually see: the stale ones are held back and COUNTED,
     * never silently dropped — a suppression nobody can see is its own kind of lie. */
    const asdairLiveAttentionLines = computed(() => asdairAttentionLines.value.filter((ln) => !asdairLineSettled(ln)));
    const asdairStaleAttentionCount = computed(() => asdairAttentionLines.value.length - asdairLiveAttentionLines.value.length);

    // ---- AC2/AC3 — ONE COHERENT EXCEPTION BOARD ------------------------------------------------
    // Before this WP there were THREE exception surfaces: the Shop screen's "Needs your attention",
    // the Questions screen's "Still waiting on you", and the Basket screen's "Held back". Three
    // partial answers to one question is the incoherence Warwick is describing when he says he
    // should not have to ask Larry. This is ONE board, and the Shop screen now points AT it rather
    // than rendering a second copy of it.
    //
    // Held lines join to their question by `routed_question` -> `question_key`. ⚠️ ASSUMPTION,
    // REPORTED: readPacket.js's held[] does NOT publish that key today (Lane C is adding it). The
    // board therefore works WITHOUT the join — an unjoined held line becomes its own entry that says
    // plainly no question was routed for it — and improves the moment the key arrives.
    const asdairHeldByQuestion = computed(() => {
      const m = new Map();
      for (const r of asdairListExceptionRows.value) if (r.questionKey) m.set(r.questionKey, r);
      return m;
    });
    /** One board entry. `kind` says where it came from, because a person answering it deserves to
     * know whether they are answering a question or looking at a line nobody asked about. */
    function asdairBoardEntry(kind, o) {
      return Object.assign({ kind: kind, resolved: false, blocking: false, held: null }, o);
    }
    const asdairBoard = computed(() => {
      const qs = (asdairWs.value && asdairWs.value.questions) || null;
      const open = qs && Array.isArray(qs.items) ? qs.items : [];
      const done = qs && Array.isArray(qs.resolved) ? qs.resolved : [];
      const heldMap = asdairHeldByQuestion.value;
      const claimed = new Set();
      const out = [];

      for (let i = 0; i < open.length; i++) {
        const q = open[i];
        const key = asdairKnown(q && q.question_key) ? String(q.question_key) : null;
        const held = key && heldMap.has(key) ? heldMap.get(key) : null;
        if (key && held) claimed.add(key);
        out.push(asdairBoardEntry('question', {
          key: 'q' + (q && q.id != null ? q.id : i), question: q, held: held,
          resolved: false, blocking: !!held,
        }));
      }
      // A held line with no question routed to it still needs him — and saying so is the whole
      // point of one board. It cannot be answered here, so it says why rather than offering a
      // control that does nothing.
      for (const r of asdairListExceptionRows.value) {
        if (r.questionKey && claimed.has(r.questionKey)) continue;
        if (r.questionKey && asdairResolvedQuestionKeys.value.has(r.questionKey)) continue;
        out.push(asdairBoardEntry('held', { key: 'h' + r.key, question: null, held: r, blocking: true }));
      }
      for (let i = 0; i < done.length; i++) {
        const q = done[i];
        out.push(asdairBoardEntry('answered', {
          key: 'a' + (q && q.id != null ? q.id : i), question: q, resolved: true, blocking: false,
        }));
      }
      return out;
    });
    /** The two halves of the board. Split HERE rather than in the template so both the counters and
     * the lists read the same partition — the counters cannot say 3 while 4 rows render. */
    const asdairBoardOpen = computed(() => asdairBoard.value.filter((e) => !e.resolved));
    const asdairBoardDone = computed(() => asdairBoard.value.filter((e) => e.resolved));
    /** AC3 — X NEED YOU / Y RESOLVED / Z STILL BLOCKING, always visible, always from ONE derivation.
     * A count nobody published stays null and renders as "not reported", never as a zero. */
    const asdairBoardCounts = computed(() => {
      const b = asdairBoard.value;
      const needYou = b.filter((e) => !e.resolved).length;
      const resolved = b.filter((e) => e.resolved).length;
      // BLOCKING is a narrower fact than NEEDS YOU and is deliberately not the same number: a line
      // held OUT of the basket blocks the shop; a question about a line that is still in it does
      // not. Where nothing publishes held state at all, this is unknown rather than zero.
      const blocking = asdairListSource.value === 'none' && !asdairListExceptionRows.value.length
        ? null : b.filter((e) => e.blocking && !e.resolved).length;
      return { needYou: needYou, resolved: resolved, blocking: blocking };
    });

    // ---- AC2 — "should this become durable household knowledge?" --------------------------------
    // Offered AFTER an answer lands, never before: the offer is about an answer that exists.
    // ⚠️ ASSUMPTION, REPORTED: no command for this is published today. Per Larry's ruling, an offer
    // that quietly discards the answer would corrupt trust in the whole surface — so with no command
    // behind it the control renders DISABLED and says exactly why. It is never hidden (Warwick is
    // owed the knowledge that the choice exists) and never live-looking (he is owed the truth that
    // it cannot yet be made).
    const ASDAIR_REMEMBER_COMMANDS = Object.freeze(['rememberDecision', 'setForwardIntent', 'promoteDecision', 'recordStandingDecision']);
    const asdairRememberCommand = computed(() => ASDAIR_REMEMBER_COMMANDS.find((n) => asdairCommands.value.has(n)) || null);
    /** @type {import('vue').Ref<null|{questionKey:string|null, answer:string, busy:boolean, done:string|null, error:string|null}>} */
    const asdairRemember = ref(null);
    function asdairOfferRemember(q, answerText) {
      asdairRemember.value = {
        questionKey: asdairKnown(q && q.question_key) ? String(q.question_key) : null,
        answer: String(answerText || ''), busy: false, done: null, error: null,
      };
    }
    const asdairDismissRemember = () => { asdairRemember.value = null; };
    async function asdairRememberAnswer() {
      const r = asdairRemember.value;
      const cmd = asdairRememberCommand.value;
      if (!r || !cmd) return;
      r.busy = true; r.error = null;
      try {
        await asdairCommand(cmd, { questionKey: r.questionKey, answerText: r.answer, forwardIntent: r.answer });
        await loadAsdairWorkspace();
        r.done = 'AsdAIr will remember this for future shops.';
      } catch (e) {
        r.error = e.message || 'failed';
      } finally {
        r.busy = false;
      }
    }

    // ---- The photo, and the PER-LINE CROP (AC5) -----------------------------------------------
    // "Show the relevant crop rather than making Warwick hunt around the page."
    //
    // The crop is rendered CLIENT-SIDE from the one full photograph the media route already serves,
    // using the four pixel bounds migration 020 stores per region
    // (`asdair.shop_image_region.pixel_top/left/bottom/right` — those exact column names, not
    // invented ones). That deliberately needs NO new backend endpoint: the seam is four integers.
    // If the backend later publishes a ready-made crop URL, that wins — see asdairRegionOf().
    const asdairMediaUrl = computed(() => (asdairShop.value ? '/api/asdair/media?shop=' + asdairShop.value.shop_id : null));
    // The photograph's natural pixel size, measured from the image itself. Needed to place a crop,
    // and free from one preload of a URL the page fetches anyway.
    const asdairMediaSize = ref({ w: 0, h: 0 });
    function asdairMeasureMedia() {
      asdairMediaSize.value = { w: 0, h: 0 };
      const url = asdairMediaUrl.value;
      if (!url || typeof Image === 'undefined') return;
      const img = new Image();
      img.onload = () => { asdairMediaSize.value = { w: img.naturalWidth || 0, h: img.naturalHeight || 0 }; };
      img.onerror = () => { asdairMediaErr.value = true; };
      img.src = url;
    }
    /** PURE. The region a question or line is evidence for, or null. Accepts the region on the
     * question, on its line, or a backend-rendered crop URL — and never fabricates one. */
    function asdairRegionOf(o) {
      if (!o || typeof o !== 'object') return null;
      const r = o.region || o.source_region || null;
      const url = o.region_image_url || (r && r.image_url) || null;
      if (!r && !url) return null;
      const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
      const top = r ? n(r.pixel_top) : null;
      const left = r ? n(r.pixel_left) : null;
      const bottom = r ? n(r.pixel_bottom) : null;
      const right = r ? n(r.pixel_right) : null;
      const bounded = top !== null && left !== null && bottom !== null && right !== null && bottom > top && right > left;
      if (!bounded && !url) return null;
      return { url: url, top: top, left: left, bottom: bottom, right: right, bounded: bounded };
    }
    /** The crop frame takes the SHAPE of the region, not of the page. */
    function asdairCropBoxStyle(region) {
      if (!region || !region.bounded) return null;
      return { aspectRatio: (region.right - region.left) + ' / ' + (region.bottom - region.top) };
    }
    /** Position the FULL photograph inside that frame so only the region shows. Percentages only:
     * width/left resolve against the frame's width, height/top against its height — which is exactly
     * the arithmetic below, and why no pixel value appears in the style. */
    function asdairCropImgStyle(region) {
      const nat = asdairMediaSize.value;
      if (!region || !region.bounded || !nat.w || !nat.h) return null;
      const rw = region.right - region.left;
      const rh = region.bottom - region.top;
      return {
        width: (nat.w / rw * 100) + '%',
        height: (nat.h / rh * 100) + '%',
        left: (-region.left / rw * 100) + '%',
        top: (-region.top / rh * 100) + '%',
      };
    }
    /** Can this region actually be drawn yet? A region we cannot draw is SAID, never faked. */
    const asdairCanCrop = (region) => !!(region && (region.url || (region.bounded && asdairMediaSize.value.w && asdairMediaSize.value.h)));

    // ---- The command surface, as the API itself publishes it ----------------------------------
    // "The UI may only offer an action that has a command behind it" — the payload's own rule, and
    // the only honest way to build a UI against a backend that is moving underneath it. A control
    // whose command is absent is NOT rendered as if it worked: it is disabled and says why.
    const asdairCommands = computed(() => new Set((asdairWs.value && asdairWs.value.command_names) || []));
    const asdairHasCommand = (n) => asdairCommands.value.has(n);
    // ⚠️ ASSUMPTION, REPORTED: "mark an already-resolved line 'not this week'" is a command the
    // backend WP (WO-2026-08-13-02 AC6) is building RIGHT NOW, and its name is not yet published.
    // These are the names probed for. Nothing is invented — with none present the control renders
    // disabled with an honest explanation rather than pretending to work.
    const ASDAIR_SKIP_COMMANDS = Object.freeze(['skipThisWeek', 'skipItem', 'markNotThisWeek', 'skipLine']);
    const asdairSkipCommand = computed(() => ASDAIR_SKIP_COMMANDS.find((n) => asdairCommands.value.has(n)) || null);

    // ---- "See immediately that the answer landed, and what remains" (AC5) ---------------------
    // One transient line, set only by a write that actually succeeded, cleared by the next write.
    const asdairFlash = ref(null);
    function asdairSetFlash(what) {
      const remain = asdairOpenQuestions.value;
      asdairFlash.value = what + (remain === null ? '' : (remain > 0
        ? ' ' + remain + ' ' + plural(remain, 'question', 'questions') + ' still '
          + plural(remain, 'needs', 'need') + ' you.'
        : ' Nothing else needs you.'));
    }

    // ---- The AsdAIr action sheet — one small, self-contained modal for every write action AND the
    // full-photo view, kept separate from the generic `detail` sheet (whose header is shared by
    // idea/opp/output/doc and would need a fifth branch for no benefit — this owns its own markup).
    /** @type {import('vue').Ref<null|{kind:'photo'}|{kind:'question',question:object}|{kind:'change',line:object}>} */
    const asdairSheet = ref(null);
    const asdairSheetBusy = ref(false);
    const asdairSheetErr = ref(null);
    const asdairChangeName = ref('');
    const asdairChangeQty = ref('');
    const asdairAnswerText = ref(''); // separate from asdairChangeName — a different field, a different sheet
    // WCAG 2.4.3: opening a dialog MUST move focus in; closing MUST return it. asdairCloseSheet
    // already returns focus to the workspace heading (mirrors focusSel's use elsewhere for level
    // transitions); this is the matching "in" half.
    function asdairOpenSheet(payload) { asdairSheetErr.value = null; asdairSheet.value = payload; nextTick(() => focusSel('.sheet-card .back')); }
    async function asdairCloseSheet() { asdairSheet.value = null; asdairSheetErr.value = null; await focusSel('#app-workspace-h'); }
    function asdairOpenPhoto() { asdairOpenSheet({ kind: 'photo' }); }
    function asdairOpenQuestion(q) { asdairAnswerText.value = ''; asdairOpenSheet({ kind: 'question', question: q }); }
    // AC5, "correct an already-resolved item". A RESOLVED question reopens the SAME sheet and the
    // SAME answerQuestion command — deliberately not a second, parallel "edit" path. His previous
    // answer is prefilled so changing it is an edit, not a retype from nothing.
    // ⚠️ ASSUMPTION, REPORTED: that answerQuestion accepts a re-answer on an already-resolved
    // question. If the backend refuses, the sheet shows that refusal verbatim — never a silent no-op.
    function asdairOpenReanswer(q) {
      asdairAnswerText.value = asdairKnown(q && q.answer_text_display) ? String(q.answer_text_display) : '';
      asdairOpenSheet({ kind: 'question', question: q, reanswer: true });
    }
    function asdairOpenChange(line) {
      const l = line || {};
      // Prefill from what is actually KNOWN — never the API's word "unknown". Typing over the string
      // "unknown" is not an edit, it is a trap.
      asdairChangeName.value = asdairKnown(l.canonical_product_name_display) ? String(l.canonical_product_name_display)
        : (asdairKnown(l.raw_reading_display) ? String(l.raw_reading_display) : '');
      asdairChangeQty.value = '';
      asdairOpenSheet({ kind: 'change', line: l });
    }

    // ---- The write path (AC4). Every write in this file goes through this ONE function, which
    // calls ONE route, which the backend forwards to the shared command surface. There is no other
    // write path here — grep for "fetch(" against '/api/asdair/command' to confirm.
    //
    // ⚠️ CROSS-WP GAP, flagged at read-back and accepted: `POST /api/asdair/command` does not exist
    // in server.mjs yet (Keel's surface — additive-only this round, AMENDMENT 1). This call is built
    // exactly against the documented contract (services/asdair/cockpit-api/httpApi.js `POST
    // /asdair/command`, proxied the same way `/api/asdair/workspace` already is) so it is correct the
    // moment that proxy route lands. Until then it fails with an honest error — never a silent no-op,
    // and never a second write path that bypasses the command surface to compensate.
    async function asdairCommand(name, args) {
      const shopId = asdairShop.value && asdairShop.value.shop_id;
      const body = {
        command: name,
        actor: 'warwick',
        // httpApi.js only maps body.actor -> requested_by, not into args.actor, and
        // commands.js's requireActor() reads spec.actor directly — so actor travels inside args too.
        args: Object.assign({ actor: 'cockpit:warwick', shopId: shopId }, args || {}),
      };
      const r = await fetch('/api/asdair/command', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      });
      let d = null;
      try { d = await r.json(); } catch (e) { /* handled by the ok check below */ }
      if (!r.ok || !d || d.ok === false) throw new Error((d && (d.message || d.error)) || ('http ' + r.status));
      return d.result;
    }

    /**
     * Answer, correct or skip a question — driven by the question's own `allowed_replies` rather
     * than a client-invented action, per AC4.
     * @param {object} q the open question row (from asdairWs.questions.items)
     * @param {'choose'|'typed'|'search'|'skip'} replyKey
     * @param {{candidate?:object, text?:string}} [opts]
     */
    async function asdairAnswerQuestion(q, replyKey, opts) {
      const o = opts || {};
      q._busy = true; q._error = null; asdairFlash.value = null; asdairRemember.value = null;
      try {
        const args = { questionKey: q.question_key };
        let landed = 'Saved.';
        let remembered = null; // the answer text worth offering to remember, or null for a skip
        if (replyKey === 'skip') {
          args.skip = true;
          landed = 'Marked “not this week”.';
        } else if (replyKey === 'choose' && o.candidate) {
          args.answerText = o.candidate.label_display; args.answerSource = 'button';
          landed = 'Saved: ' + o.candidate.label_display + '.';
          remembered = o.candidate.label_display;
        } else if (replyKey === 'typed' || replyKey === 'search') {
          const text = (o.text || '').trim();
          if (!text) { q._error = 'Type an answer first.'; q._busy = false; return; }
          args.answerText = text; args.answerSource = 'typed';
          landed = 'Saved: ' + text + '.';
          remembered = text;
        } else {
          q._error = 'Unrecognised reply.'; q._busy = false; return;
        }
        await asdairCommand('answerQuestion', args);
        if (asdairSheet.value && asdairSheet.value.kind === 'question' && asdairSheet.value.question === q) await asdairCloseSheet();
        // Re-read FIRST, then say what remains — so "what remains" is the new truth, not the old one.
        await loadAsdairWorkspace();
        asdairSetFlash(landed);
        // AC2 — and ONLY after a write that actually succeeded. Offering to remember an answer that
        // never landed would be the second lie in a row. A skip is not offered: "not this week" is a
        // statement about THIS week and turning it into a standing rule would invert its meaning.
        if (remembered !== null) asdairOfferRemember(q, remembered);
      } catch (e) {
        q._error = e.message || 'failed';
      } finally {
        q._busy = false;
      }
    }

    /** "Something looks wrong" — tappable on ANY line, resolved or not (design doc's escape hatch). */
    async function asdairSubmitChange() {
      const itemName = asdairChangeName.value.trim();
      if (!itemName) { asdairSheetErr.value = 'Type what this line should say.'; return; }
      const qtyRaw = asdairChangeQty.value.trim();
      const qty = qtyRaw ? Number(qtyRaw) : null;
      if (qty !== null && (!Number.isInteger(qty) || qty < 1 || qty > 99)) {
        asdairSheetErr.value = 'Quantity must be a whole number from 1 to 99, or left blank.'; return;
      }
      asdairSheetBusy.value = true; asdairSheetErr.value = null; asdairFlash.value = null;
      try {
        await asdairCommand('correctLine', { itemName: itemName, requestedQty: qty });
        await asdairCloseSheet();
        await loadAsdairWorkspace();
        asdairSetFlash('Saved: ' + itemName + '.');
      } catch (e) {
        asdairSheetErr.value = e.message || 'failed';
      } finally {
        asdairSheetBusy.value = false;
      }
    }

    /**
     * AC5, "mark something 'not this week'" on an ALREADY-RESOLVED line — not a question, a line.
     * Routed through whichever command the API actually publishes (asdairSkipCommand). If none is
     * published this is never called: the control renders disabled and says so.
     */
    async function asdairSkipLine(line) {
      const cmd = asdairSkipCommand.value;
      const l = line || {};
      if (!cmd) { asdairSheetErr.value = 'AsdAIr has no command for this yet.'; return; }
      asdairSheetBusy.value = true; asdairSheetErr.value = null; asdairFlash.value = null;
      try {
        await asdairCommand(cmd, {
          listItemId: l.list_item_id === undefined ? null : l.list_item_id,
          lineNo: l.line_no === undefined ? null : l.line_no,
        });
        await asdairCloseSheet();
        await loadAsdairWorkspace();
        asdairSetFlash('Marked “not this week”.');
      } catch (e) {
        asdairSheetErr.value = e.message || 'failed';
      } finally {
        asdairSheetBusy.value = false;
      }
    }

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
      asdairWs, asdairWsErr, asdairWsLoading, asdairMediaErr, loadAsdairWorkspace, asdairShop, asdairOtherShops, asdairPrevOrderTotal,
      asdairMoney, asdairLineTone, asdairLineChip, asdairTally, asdairKnown,
      asdairRules, asdairRulesErr, asdairRulesLoading, loadAsdairRules, asdairRuleGroups,
      asdairPacket, asdairPacketErr, asdairPacketLoading, loadAsdairPacket,
      asdairPacketDoc, asdairRecon, asdairPacketState, asdairReconState,
      asdairStatus, asdairCanonicalState, asdairStateField, asdairLineFilter, asdairAllLines, asdairExceptionLines, asdairShopLines, asdairLineProvenance,
      // WP-B15-36 — one sentence, the human summary, exception-first groups, and the crop.
      asdairOpenQuestions, asdairAnsweredQuestions, asdairOpenLines, asdairTotalLines, asdairResolvedLineCount,
      asdairBlockingSentence, asdairSentenceSource, asdairStateDisagreement,
      asdairProvenance, asdairLineOrigin,
      asdairAttentionLines, asdairChangeLines, asdairResolvedLines,
      asdairRegionOf, asdairCropBoxStyle, asdairCropImgStyle, asdairCanCrop, asdairMediaSize, asdairLineTitle, asdairSaid,
      asdairHasCommand, asdairSkipCommand, asdairSkipLine, asdairFlash, asdairOpenReanswer, asdairTrapFocus,
      asdairMediaUrl, asdairSheet, asdairSheetBusy, asdairSheetErr, asdairChangeName, asdairChangeQty, asdairAnswerText,
      asdairOpenSheet, asdairCloseSheet, asdairOpenPhoto, asdairOpenQuestion, asdairOpenChange,
      asdairAnswerQuestion, asdairSubmitChange,
      // WP-B15-42 — one exception board, the brand-grouped final list, corroboration vocabulary,
      // and the UI half of the stale "needs human" defect.
      asdairBrand, ASDAIR_NO_BRAND, asdairCorroboration, ASDAIR_CORROBORATION_CAVEAT,
      asdairFinalDoc, asdairListSource, asdairListRows, asdairListResolvedRows, asdairListExceptionRows,
      asdairListGroups, asdairListSortBroken, asdairListTotals, asdairSkippedLines, asdairFinalShop,
      asdairResolvedQuestionKeys, asdairLineSettled, asdairLiveAttentionLines, asdairStaleAttentionCount,
      asdairBoard, asdairBoardOpen, asdairBoardDone, asdairBoardCounts, asdairHeldByQuestion,
      asdairRememberCommand, asdairRemember, asdairOfferRemember, asdairDismissRemember, asdairRememberAnswer,
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
      capOverview, capRanked, capStateMark, capWhy, homeAttention, ensureCapaeSignal,
      rrOverview, rrOpenCard, rrCardToggle, rrRawOpen, rrRawToggle,
      rrArr, rrObj, rrHas, rrText, rrInt, rrCompact, rrIsCompact, rrPct, rrMins, rrBar,
      rrAlloc, rrAllocSum, rrAllocGap, rrAllocAnyKnown, rrCtx, rrCtxMax, rrSpecMax, rrLinesMax,
    };
  },
  template: `
<div class="app">
  <!-- BUILD-015 B15-26, MEDIUM 2 — focus trap for the AsdAIr action sheet. The sheet renders as a
       LATER SIBLING of both .nav and .shell-main (not nested inside either), so containing Tab means
       removing every OTHER top-level sibling from the tab order while the sheet is open — inert
       does that in one primitive rather than a hand-rolled Tab-cycle with its own edge cases
       (Shift+Tab from the first element, dynamically-added focusables inside the sheet). Left off
       the generic detail sheet below (pre-existing, outside this WP's surface). -->
  <nav class="nav" aria-label="Main" :inert="!!asdairSheet">
    <button v-for="a in AREAS" :key="a.key" class="nav-btn" :class="{on: area===a.key}" @click="go(a.key)">
      <span class="nav-ico">{{ a.icon }}</span><span class="nav-lbl">{{ a.label }}</span>
      <span v-if="a.key==='home' && needsYou.length" class="nav-badge">{{ needsYou.length }}</span>
    </button>
  </nav>

  <div class="shell-main" :inert="!!asdairSheet">
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
        <!-- ══ HOME'S ONE ATTENTION SIGNAL — NOT a second CAPAE dashboard.
             It appears only when a prevention is genuinely in doubt (INEFFECTIVE or reopened after
             having been proven). Routine MONITORING is deliberately excluded: every family sits
             there most of the time, so showing it would make this card permanent furniture and
             therefore invisible. Nothing to say → nothing rendered. -->
        <div class="grp" v-if="homeAttention">
          <div class="home-attn" :class="'t-'+homeAttention.tone" @click="go('system')" role="button" tabindex="0" @keyup.enter="go('system')">
            <div class="home-attn-h"><span aria-hidden="true">⚠</span> {{ homeAttention.headline }}</div>
            <div class="home-attn-b">{{ homeAttention.title }} · {{ homeAttention.detail }}</div>
            <div class="home-attn-go">System →</div>
          </div>
        </div>

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
          <h2>🕑 Recent activity</h2>
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
            <!-- The cog — AC1: Diagnostics/About/History reachable only here, never a competing tab.
                 Generic to any app that carries a non-primary view; today that is AsdAIr's 'about'. -->
            <button v-if="currentApp.views.some(v => v.primary === false)" class="act app-cog"
              :aria-label="currentApp.label + ' diagnostics and about'"
              :class="{on: currentView.primary === false}" @click="goView(currentApp.views.find(v => v.primary === false).key)">⚙</button>
          </header>

          <!-- Availability, measured. Never assumed, never dressed up.

               WP-B15-36, AC2 — "No second status indicator may contradict it." This band and the
               AsdAIr Shop band below were BOTH .app-status: same dot, same bold lead, one saying
               "AsdAIr's read service is answering" and one saying "Needs you". Two status bands in
               one visual language on one screen is precisely the thing Warwick said must not happen.
               So when AsdAIr's own canonical band is on screen (its service is up, so the shop state
               is real), THIS band stands down. It is never lost: it renders the moment the service is
               anything other than up — the only case where it carries information the shop band
               cannot — and it is always readable under the cog, in Diagnostics.
               Every other app is untouched. -->
          <div v-if="!(currentApp.key==='asdair' && statusOf(currentApp).state==='up')"
            class="app-status" :class="statusOf(currentApp).state" role="status" aria-live="polite">
            <span class="as-dot" aria-hidden="true"></span>
            <div class="as-body"><b>{{ appStatusLine(currentApp) }}</b><span v-if="statusOf(currentApp).detail"> — {{ statusOf(currentApp).detail }}</span></div>
            <button v-if="currentApp.probe" class="act" @click="probeApp(currentApp)">Check again</button>
          </div>

          <!-- The app's OWN navigation — the dashboard within the dashboard. Non-primary views
               (AC1: Diagnostics/About/History) are excluded from the tab bar; the cog above reaches
               them instead. currentView still resolves a non-primary key when goView routes there
               (normaliseApp keeps it in views[]), so a direct cog-tap always renders correctly even
               though it never appears as a tab here. -->
          <nav class="app-nav" :aria-label="currentApp.label + ' sections'">
            <button v-for="v in currentApp.views.filter(v => v.primary !== false)" :key="v.key" class="app-nav-btn" :class="{on: v.key===currentView.key}"
              :aria-current="v.key===currentView.key ? 'page' : null" @click="goView(v.key)">{{ v.label }}</button>
          </nav>

          <div class="app-view">
            <p v-if="currentView.blurb" class="app-blurb">{{ currentView.blurb }}</p>

            <!-- About = facts about the app itself, true whether or not its service is running, PLUS
                 (AsdAIr only) Diagnostics + History. Deliberately ONE v-if wrapper, not two siblings:
                 v-else-if below must attach to a single element/template, and everything gated on
                 currentView.key==='about' has to live inside it for that chain to stay valid. -->
            <template v-if="currentView.key==='about'">
              <ul v-if="currentApp.about.length" class="read">
                <li v-for="(f,i) in currentApp.about" :key="i">{{ f }}</li>
              </ul>
              <!-- Never a silent blank screen: an app that defines an 'about' view with nothing to
                   say (currently unreachable — only AsdAIr defines one, and it always has content)
                   still gets an honest message rather than empty space. -->
              <div v-if="!currentApp.about.length && currentApp.key!=='asdair'" class="empty big">
                {{ currentApp.label }} has nothing recorded here yet.
              </div>

              <!-- DIAGNOSTICS + HISTORY — AsdAIr only, reached only via the cog (AC1). Everything
                   AC3 keeps off Shop/Questions/Basket/Rules lives here instead: shop identifiers,
                   raw catalogue counts, match-method internals, ports, DB status, confidence
                   decimals and internal event/state names. Nothing is deleted — it moved. Gated on
                   asdairWs/asdairRules/asdairPacket being loaded (any view visited this session
                   loads its own data; opening Diagnostics first, before visiting Shop, honestly
                   shows nothing to dump yet rather than fetching data this screen doesn't own). -->
              <template v-if="currentApp.key==='asdair'">
                <div class="grp" v-if="asdairOtherShops.length">
                  <h2>Other shops (history)<span class="g-count">{{ asdairOtherShops.length }}</span></h2>
                  <div v-for="s in asdairOtherShops" :key="s.id" class="item grey">
                    <div class="i-main"><div class="i-eyebrow">{{ s.status }}</div><div class="i-title">{{ s.shop_ref }}</div></div>
                  </div>
                </div>

                <div class="grp" v-if="asdairWs && asdairWs.timeline && asdairWs.timeline.length">
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

                <!-- THE SEAM, VISIBLE. WP-B15-36: the Cockpit backend was converging at the same
                     time as this UI, so which field answered, which sentence was rendered and where
                     the provenance figures came from are all shown here rather than being something
                     an integrator has to infer from a blank chip. Diagnostics, behind the cog —
                     never on a primary screen. -->
                <div class="grp">
                  <h2>Technical status</h2>
                  <dl class="as-kv">
                    <div><dt>Canonical state</dt><dd>{{ asdairCanonicalState || 'not reported' }}</dd></div>
                    <div><dt>Read from field</dt><dd>{{ asdairStateField ? 'shop.' + asdairStateField : 'none of shop.human_state / shop.canonical_state / shop.cockpit_state' }}</dd></div>
                    <div><dt>Blocking sentence</dt><dd>{{ asdairSentenceSource }}</dd></div>
                    <div><dt>Provenance figures</dt><dd>{{ asdairProvenance.route === 'api' ? 'workspace.provenance' : (asdairProvenance.route === 'lines' ? 'counted from interpretation.lines[].provenance' : 'not reported') }}</dd></div>
                    <div><dt>“Not this week” command</dt><dd>{{ asdairSkipCommand || 'not published by the API' }}</dd></div>
                    <div><dt>Service availability</dt><dd>{{ appStatusLine(currentApp) }}</dd></div>
                  </dl>
                </div>

                <div class="grp" v-if="asdairWs">
                  <h2>Raw payloads (debugging only)</h2>
                  <p class="as-note">Every screen above is rendered from named fields of these payloads. This drawer exists so a field with no UI yet can still be found — it is not the intended way to read a shop.</p>
                  <details class="tech">
                    <summary>Workspace</summary>
                    <div class="tech-body"><div class="mono raw">{{ JSON.stringify(asdairWs, null, 2) }}</div></div>
                  </details>
                  <details class="tech" v-if="asdairRules">
                    <summary>Rulebook</summary>
                    <div class="tech-body"><div class="mono raw">{{ JSON.stringify(asdairRules, null, 2) }}</div></div>
                  </details>
                  <details class="tech" v-if="asdairPacket">
                    <summary>Execution packet + reconciliation</summary>
                    <div class="tech-body"><div class="mono raw">{{ JSON.stringify(asdairPacket, null, 2) }}</div></div>
                  </details>
                </div>
              </template>
            </template>

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

                <!-- ══ AC5 — THE FINAL LIST, SORTED BY BRAND ══════════════════════════════════
                     Warwick asked for the list "SORTED BY BRAND — not database order, not
                     provenance order, not question order", compact per line, with plain-English
                     provenance on expansion and exceptions clearly separated.

                     ⛔ THE GROUPING PRESERVES THE PRODUCER'S ORDER AND DOES NOT RE-SORT, and that
                     is deliberate. Both producers declare Brand A–Z then product A–Z, and
                     readPacket.js asserts that contract. Grouping consecutive runs renders exactly
                     the brand-sorted list Warwick asked for WHEN the producer honours it — and when
                     it does not, the same brand appears twice and the banner below fires, instead of
                     the UI silently tidying away a defect that costs real time in ASDA. -->
                <div class="grp" v-if="asdairListSource !== 'none'">
                  <h2>This week’s list<span class="g-count">{{ asdairListResolvedRows.length }}</span></h2>
                  <p class="as-answer as-answer-sm" v-if="asdairListTotals.products !== null || asdairListTotals.items !== null">
                    <template v-if="asdairListTotals.products !== null">{{ asdairListTotals.products }} products</template><template v-if="asdairListTotals.products !== null && asdairListTotals.items !== null"> · </template><template v-if="asdairListTotals.items !== null">{{ asdairListTotals.items }} items</template>, sorted by brand.
                  </p>
                  <p class="as-meaning">Tap a line for where it came from and why the quantity is what it is.</p>

                  <div v-if="asdairListSortBroken" class="item red as-stack">
                    <div class="i-main">
                      <div class="i-eyebrow blocked">BRAND ORDER BROKEN</div>
                      <div class="i-title">The same brand appears more than once in this list.</div>
                      <div class="as-sub">It is shown exactly as produced rather than quietly reordered. The order is what makes the shop quick, so this is worth fixing upstream.</div>
                    </div>
                  </div>

                  <template v-for="g in asdairListGroups" :key="g.key">
                    <h3 class="as-sec">{{ g.label }}<span class="g-count">{{ g.rows.length }}</span></h3>
                    <details v-for="r in g.rows" :key="r.key" class="as-line">
                      <summary class="as-line-sum">
                        <span class="as-line-name">{{ asdairSaid(r.product, asdairSaid(r.raw, 'AsdAIr couldn’t read this line')) }}</span>
                        <span class="as-line-qty" v-if="r.qty !== null">×{{ r.qty }}</span>
                        <span class="as-line-qty as-line-qty-unk" v-else>qty not set</span>
                      </summary>
                      <div class="as-line-body">
                        <div class="as-sub" v-if="r.brand">Brand: {{ r.brand }}</div>
                        <div class="as-sub" v-else>No brand is recorded for this line.</div>
                        <div class="as-sub" v-if="r.raw && r.raw !== r.product">Written on the list as “{{ r.raw }}”.</div>
                        <div class="as-sub" v-if="r.provenance">Where it came from: {{ r.provenance }}.</div>
                        <div class="as-sub strong" v-if="r.qtyWhy">Why {{ r.qty !== null ? r.qty : 'this quantity' }}: {{ r.qtyWhy }}</div>
                        <div class="as-note" v-else-if="r.qty !== null">No reason was recorded for this quantity.</div>
                        <div class="as-sub" v-if="r.rules.length">Rules applied: {{ r.rules.join(', ') }}</div>
                        <div class="as-chips" v-if="r.corroboration">
                          <span class="chip" :class="r.corroboration.tone"><span class="d" aria-hidden="true"></span>{{ r.corroboration.word }}</span>
                          <span class="as-sub">{{ r.corroboration.sentence }}</span>
                        </div>
                        <div class="as-sub" v-if="r.incomplete">This line says it is a known product but carries no catalogue id. Both are shown; neither is resolved here.</div>
                      </div>
                    </details>
                  </template>

                  <!-- EXCEPTIONS, CLEARLY SEPARATED — and they are not answered here. There is one
                       exception board and it is the Questions screen; a second set of controls is
                       exactly the incoherence AC2 exists to remove. -->
                  <template v-if="asdairListExceptionRows.length">
                    <h3 class="as-sec">Not on the list yet<span class="g-count">{{ asdairListExceptionRows.length }}</span></h3>
                    <p class="as-meaning">Held back because something is genuinely uncertain. Nothing here has been substituted.</p>
                    <div v-for="r in asdairListExceptionRows" :key="'x'+r.key" class="item red as-stack">
                      <div class="i-main">
                        <div class="i-eyebrow blocked">HELD</div>
                        <div class="i-title">{{ asdairSaid(r.product, asdairSaid(r.raw, 'AsdAIr couldn’t read this line')) }}</div>
                        <div class="as-sub" v-if="r.heldReason">{{ r.heldReason }}<span v-if="r.heldDetail"> — {{ r.heldDetail }}</span></div>
                        <div class="as-chips" v-if="r.corroboration">
                          <span class="chip" :class="r.corroboration.tone"><span class="d" aria-hidden="true"></span>{{ r.corroboration.word }}</span>
                          <span class="as-sub">{{ r.corroboration.sentence }}</span>
                        </div>
                      </div>
                    </div>
                    <div class="item amber" role="button" tabindex="0" @click="goView('questions')" @keydown.enter="goView('questions')" @keydown.space.prevent="goView('questions')">
                      <div class="i-main">
                        <div class="i-title">Resolve these</div>
                        <div class="i-why">One board, with the photograph beside each one.</div>
                      </div>
                      <span class="chev" aria-hidden="true">›</span>
                    </div>
                  </template>

                  <p class="as-note">{{ ASDAIR_CORROBORATION_CAVEAT }}</p>
                  <!-- ⚠️ THE ASSUMPTION, ON SCREEN. An assumption nobody can see is a lie by omission,
                       and this UI was built while the backend that serves it had not started. -->
                  <p class="as-note" v-if="asdairListSource === 'final'">Read from the reconciled list document. AsdAIr’s execution packet hasn’t been produced for this shop.</p>
                </div>
                <div class="grp" v-else>
                  <h2>This week’s list</h2>
                  <p class="empty big">
                    No reconciled list has been published for this shop, so nothing is shown here.
                    Nothing on this screen is invented — an empty list is the honest answer, and a
                    plausible-looking one you might act on would not be.
                  </p>
                </div>

                <!-- ── THE PACKET ─────────────────────────────────────────────────────────── -->
                <div class="grp">
                  <h2>Planned basket<span class="g-count" v-if="asdairPacketDoc">{{ asdairPacketDoc.lines_count_display }}</span></h2>

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

                    <!-- ⛔ THE "HELD BACK" BLOCK THAT STOOD HERE WAS DELETED IN WP-B15-42, and this
                         comment is its grave. The packet's held[] now feeds the ONE list above
                         (asdairListExceptionRows) and the ONE exception board on the Questions
                         screen. Rendering it a third time here is precisely the incoherence AC2
                         removes — three places showing the same eight items, three counts that can
                         drift apart, and Warwick left to work out which one is current. -->
                    <p class="as-note" v-if="asdairPacketDoc.held.length">
                      {{ asdairPacketDoc.held_count_display }} held line(s) are shown once, with the list above.
                    </p>
                  </template>
                </div>

                <!-- ── RECONCILIATION ─────────────────────────────────────────────────────── -->
                <div class="grp">
                  <h2>ASDA trolley</h2>

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

                <!-- BROWSER BUILD — moved here from the old Overview/Details split (design doc's
                     Basket screen covers the actual ASDA build, not just the plan). A request is a
                     request — the payload says so and so does this. -->
                <div class="grp" v-if="asdairWs && asdairWs.browser">
                  <h2>Building it in ASDA</h2>
                  <p class="empty" v-if="!asdairWs.browser.requested">No basket build has been requested for this shop.</p>
                  <template v-else>
                    <dl class="as-kv">
                      <div><dt>Status</dt><dd>{{ asdairWs.browser.status_display }}<span v-if="asdairWs.browser.is_paused"> (paused)</span></dd></div>
                      <div><dt>Requested</dt><dd>{{ asdairWs.browser.requested_at_display }}</dd></div>
                      <div><dt>Finished</dt><dd>{{ asdairWs.browser.finished_at_display }}</dd></div>
                      <div><dt>Basket lines</dt><dd>{{ asdairWs.browser.basket_lines_display }}</dd></div>
                      <div><dt>Estimated total</dt><dd>{{ asdairMoney(asdairWs.browser.estimated_total) || 'unknown' }}</dd></div>
                      <div v-if="asdairKnown(asdairWs.browser.last_error_display)"><dt>Last error</dt><dd class="err">{{ asdairWs.browser.last_error_display }}</dd></div>
                    </dl>
                    <template v-if="asdairWs.browser.held_items && asdairWs.browser.held_items.length">
                      <h3 class="as-sec">Needs attention<span class="g-count">{{ asdairWs.browser.held_items.length }}</span></h3>
                      <div v-for="(h,hi) in asdairWs.browser.held_items" :key="'h'+hi" class="item as-stack amber">
                        <div class="i-main"><div class="i-title">{{ h.label_display }}</div><div class="i-why" v-if="asdairKnown(h.reason_display)">{{ h.reason_display }}</div></div>
                      </div>
                    </template>
                    <p class="as-note">{{ asdairWs.browser.boundary }}</p>
                  </template>
                </div>

                <!-- ORDER CONFIRMATION — moved here from the old Overview/Details split. Money always
                     prints the display string that carries its basis (never an ASDA price dressed
                     up from a derived one). -->
                <div class="grp" v-if="asdairWs && asdairWs.order">
                  <h2>Order confirmation</h2>
                  <p class="empty" v-if="!asdairWs.order.received">No order confirmation has been received for this shop, so nothing has been reconciled.</p>
                  <template v-else>
                    <dl class="as-kv">
                      <div><dt>Received</dt><dd>{{ asdairWs.order.received_at_display }}</dd></div>
                      <div><dt>ASDA stated</dt><dd>{{ asdairMoney(asdairWs.order.stated_total) || 'unknown' }}</dd></div>
                      <div><dt>Our figure</dt><dd>{{ asdairMoney(asdairWs.order.reported_total) || 'unknown' }}</dd></div>
                    </dl>
                    <p class="as-note" v-if="asdairKnown(asdairWs.order.price_basis_note)">{{ asdairWs.order.price_basis_note }}</p>
                  </template>
                </div>
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
                <!-- AC6 — "do NOT imply CRUD that does not exist." The published command surface
                     (workspace.command_names) carries NO rule create/edit/forget command, so this
                     screen offers none and says so in one plain sentence, rather than growing an
                     Edit button that would fail. When such a command is published, the control can
                     be gated on asdairHasCommand() exactly as "Not this week" already is. -->
                <p class="app-blurb">These are the standing rules AsdAIr plans against. <b>You can’t change them from here yet</b> — there is no command for editing or forgetting a rule, so this screen shows you what AsdAIr believes rather than pretending to let you rewrite it. Tell it in Telegram and the rule changes here too.</p>

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
                        <!-- Vera, WP-B15-36 gate, MEDIUM 1. This slot printed the API's own word
                             "unknown" for a rule with no category — the SAME defect asdairLineTitle()
                             closes on the Shop screen, in the same commit, with an assertion banning
                             it there. The vocabulary is not invented: "no target recorded" is two
                             lines below, and "No detail recorded against this rule." is four. -->
                        <div class="i-eyebrow">#{{ r.id_display }} · {{ asdairSaid(r.category_display, 'no category recorded') }}<span v-if="r.scope_is_global"> · applies to every household</span></div>
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
                      <!-- No catalogue id on this primary screen (AC3) — it moved to Diagnostics. -->
                      <div class="i-eyebrow" v-if="asdairKnown(rg.category_display) || !rg.active">{{ rg.category_display }}<span v-if="!rg.active"> · not active</span></div>
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
              </div>
            </template>

            <!-- AsdAIr Overview/Details — both need the SHOP workspace, so both sit behind it. Reads
                 the read-only workspace proxy (server.mjs apiAsdairWorkspace) — never invents a field
                 the API didn't report. Every other app below is untouched. -->
            <template v-else-if="currentApp.key==='asdair' && statusOf(currentApp).state==='up'">
              <div v-if="asdairWsLoading && !asdairWs" class="empty big">Loading AsdAIr’s workspace…</div>
              <div v-else-if="asdairWsErr || !asdairShop" class="empty big">{{ currentApp.offline }}</div>

              <!-- SHOP — WP-B15-36. The reading order IS the specification, top to bottom:
                     1. ONE status label      (AC2)  — one field, one derivation site
                     2. ONE blocking sentence (AC1)  — "why isn't my basket ready?", answered
                     3. This week's shop in human terms, four origins distinct (AC3)
                     4. Exception-first lines, resolved collapsed (AC4)
                     5. The photograph, small, on demand (AC5)
                   ⛔ Nothing here recomputes a status from raw counts, and no number on this screen
                   is read from a different field than the sentence above it reads. -->
              <div v-else-if="currentView.key==='shop'" class="asdair-view">
                <div class="app-status" :class="asdairStatus.tone" role="status" aria-live="polite">
                  <span class="as-dot" aria-hidden="true"></span>
                  <div class="as-body">
                    <b>{{ asdairStatus.label }}</b>
                  </div>
                  <button class="act" :disabled="asdairWsLoading" @click="loadAsdairWorkspace()">{{ asdairWsLoading ? '…' : 'Refresh' }}</button>
                </div>

                <!-- AC1 — THE ONE SENTENCE. Warwick: "Never require Warwick to infer this from
                     several counters." It is the largest text on the screen, immediately under the
                     one status label, and it is never accompanied by a second competing sentence. -->
                <p v-if="asdairBlockingSentence" class="as-answer">{{ asdairBlockingSentence }}</p>
                <p v-else class="as-answer as-answer-unknown">AsdAIr hasn’t reported one overall status for this shop yet, so there is no single answer to show. Nothing below is a guess at one.</p>

                <!-- A real disagreement in AsdAIr's own data is named as a FAULT, once — never left
                     as two numbers for Warwick to reconcile himself. -->
                <p v-if="asdairStateDisagreement" class="as-fault">{{ asdairStateDisagreement }}</p>

                <!-- Confirmation that the last write landed, and what is left after it (AC5). -->
                <p v-if="asdairFlash" class="as-flash" role="status" aria-live="polite">{{ asdairFlash }}</p>

                <div class="grp" v-if="asdairOpenQuestions === null || asdairOpenQuestions > 0">
                  <div class="item amber" role="button" tabindex="0" @click="goView('questions')" @keydown.enter="goView('questions')" @keydown.space.prevent="goView('questions')">
                    <div class="i-main">
                      <!-- Deliberately carries NO count. The sentence above already answered "how
                           many"; repeating it here would be the second counter AC1 exists to remove. -->
                      <div class="i-title">Answer what’s waiting</div>
                      <div class="i-why">Everything AsdAIr needs from you, on one screen.</div>
                    </div>
                    <span class="chev" aria-hidden="true">›</span>
                  </div>
                </div>

                <!-- AC3 — THIS WEEK'S SHOP, IN HUMAN TERMS. The four origins stay VISIBLY DISTINCT.
                     ⛔ "Never an undifferentiated database-derived blob." Where a figure is not
                     reported, the row says so — a gap is named, never filled with a zero. -->
                <div class="grp">
                  <h2>This week’s shop</h2>
                  <p v-if="asdairProvenance.summary" class="as-answer as-answer-sm">{{ asdairProvenance.summary }}</p>
                  <p v-else-if="asdairProvenance.equation" class="as-answer as-answer-sm">{{ asdairProvenance.equation }}</p>

                  <div class="item grey as-stack">
                    <div class="i-main">
                      <div class="i-eyebrow">Your list</div>
                      <div class="i-title">
                        <template v-if="asdairResolvedLineCount !== null && asdairTotalLines !== null">{{ asdairResolvedLineCount }} of {{ asdairTotalLines }} lines sorted</template>
                        <template v-else>AsdAIr hasn’t reported how many lines it sorted</template>
                      </div>
                      <div class="as-sub" v-if="asdairOpenLines !== null && asdairOpenLines > 0">{{ asdairOpenLines }} still being worked through.</div>
                      <div class="as-sub" v-if="asdairProvenance.source_read">Source: {{ asdairProvenance.source_read }}</div>
                    </div>
                  </div>

                  <!-- The five origins, one row each, always all five — so a zero is visibly a
                       measured zero and an unreported one visibly unreported. -->
                  <div v-for="o in asdairProvenance.origins" :key="o.key" class="item as-stack"
                    :class="o.key==='SKIPPED' ? 'amber' : (o.n ? 'green' : 'grey')">
                    <div class="i-main">
                      <div class="i-title">{{ o.label }}<span v-if="o.n !== null"> — {{ o.n }}</span></div>
                      <div class="as-sub">{{ o.blurb }}</div>
                      <div class="as-note" v-if="o.n === null">AsdAIr isn’t reporting this count yet, so nothing is claimed for it.</div>
                    </div>
                  </div>

                  <!-- AC1 — the final reconciled product count AND the total item/unit count. The
                       item count had no home on any screen before WP-B15-42. -->
                  <div class="item grey as-stack" v-if="asdairFinalShop.products !== null || asdairFinalShop.items !== null">
                    <div class="i-main">
                      <div class="i-eyebrow">Final shop</div>
                      <div class="i-title">
                        <template v-if="asdairFinalShop.products !== null">{{ asdairFinalShop.products }} products</template><template v-if="asdairFinalShop.products !== null && asdairFinalShop.items !== null"> · </template><template v-if="asdairFinalShop.items !== null">{{ asdairFinalShop.items }} items</template>
                      </div>
                      <div class="as-sub" v-if="asdairFinalShop.shoppable !== null || asdairFinalShop.held !== null">
                        <template v-if="asdairFinalShop.shoppable !== null">{{ asdairFinalShop.shoppable }} ready to shop</template><template v-if="asdairFinalShop.shoppable !== null && asdairFinalShop.held !== null"> · </template><template v-if="asdairFinalShop.held !== null">{{ asdairFinalShop.held }} held back for you</template>
                      </div>
                      <div class="as-note" v-if="asdairFinalShop.items === null">AsdAIr hasn’t reported a total item count for this shop, so none is shown.</div>
                    </div>
                  </div>
                  <!-- AC1, and the verdict Warwick actually asked for: is AsdAIr working, or does he
                       need to act? Derived from the SAME canonical state the status chip renders, so
                       it structurally cannot contradict it. -->
                  <div class="item as-stack" :class="asdairCanonicalState === 'NEEDS_WARWICK' ? 'amber' : (asdairCanonicalState === 'FAILED' ? 'red' : 'green')" v-if="asdairCanonicalState">
                    <div class="i-main">
                      <div class="i-eyebrow">Who is doing something</div>
                      <div class="i-title" v-if="asdairCanonicalState === 'NEEDS_WARWICK'">You. AsdAIr has stopped and is waiting.</div>
                      <div class="i-title" v-else-if="asdairCanonicalState === 'FAILED'">Nobody. This shop stopped on an error.</div>
                      <div class="i-title" v-else-if="asdairCanonicalState === 'COMPLETE'">Nobody — it is finished.</div>
                      <div class="i-title" v-else-if="asdairCanonicalState === 'READY_FOR_WARWICK'">You, when you are ready. AsdAIr has done its part.</div>
                      <div class="i-title" v-else>AsdAIr. Nothing needs you.</div>
                    </div>
                  </div>

                  <p class="as-note" v-if="asdairProvenance.route === 'none'">
                    AsdAIr isn’t yet reporting where each product came from, so the five rows above are
                    blank rather than filled in with numbers nobody measured. The lines themselves are
                    below and are real.
                  </p>
                  <p class="as-note" v-else-if="asdairProvenance.route === 'lines'">
                    Counted from the lines themselves — AsdAIr hasn’t published its own summary yet.<span v-if="asdairProvenance.unattributed"> {{ asdairProvenance.unattributed }} {{ asdairProvenance.unattributed === 1 ? 'line carries' : 'lines carry' }} no origin at all and {{ asdairProvenance.unattributed === 1 ? 'is' : 'are' }} counted in none of the five.</span>
                  </p>
                </div>

                <!-- AC1 — WHAT WAS SKIPPED, and WHY, in the producer's own words. Rendered nowhere
                     at all before WP-B15-42, which meant one of Warwick's named questions had no
                     answer on any screen. A skip is a decision; an unexplained one is a mystery. -->
                <div class="grp" v-if="asdairSkippedLines.length">
                  <h2>Left out this week<span class="g-count">{{ asdairSkippedLines.length }}</span></h2>
                  <p class="as-meaning">Deliberately not on the list. Nothing here was substituted.</p>
                  <div v-for="s in asdairSkippedLines" :key="s.key" class="item amber as-stack">
                    <div class="i-main">
                      <div class="i-title">{{ s.raw }}</div>
                      <div class="as-sub">{{ s.reason }}</div>
                      <div class="as-chips" v-if="s.corroboration">
                        <span class="chip" :class="s.corroboration.tone"><span class="d" aria-hidden="true"></span>{{ s.corroboration.word }}</span>
                        <span class="as-sub">{{ s.corroboration.sentence }}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- AC4 — EXCEPTION-FIRST, BUT NOT A SECOND BOARD. WP-B15-42, AC2: there is ONE
                     exception board and it is the Questions screen. This block used to render every
                     attention line here as a tappable list, which made two places to resolve the
                     same thing and two counts that could disagree. It now SUMMARISES and routes.

                     ⛔ AC4, the UI half of "NO STALE NEEDS HUMAN". A line whose routed question has
                     already been answered must never still be counted as needing him. The
                     suppression is COUNTED and stated — a suppression nobody can see is its own
                     kind of lie, and the number is what tells Lane AB/C their data half is stale. -->
                <div class="grp">
                  <h2>Anything unsettled<span class="g-count">{{ asdairLiveAttentionLines.length }}</span></h2>
                  <p class="empty" v-if="!asdairAllLines.length">Not interpreted yet — no lines have been read off the list.</p>
                  <p class="empty" v-else-if="!asdairLiveAttentionLines.length">Nothing on the list needs a second look.</p>
                  <div v-else class="item amber" role="button" tabindex="0" @click="goView('questions')" @keydown.enter="goView('questions')" @keydown.space.prevent="goView('questions')">
                    <div class="i-main">
                      <div class="i-title">{{ asdairLiveAttentionLines.length }} {{ asdairLiveAttentionLines.length === 1 ? 'line needs' : 'lines need' }} a decision</div>
                      <div class="i-why">Answer them on one screen, with the photograph beside each.</div>
                    </div>
                    <span class="chev" aria-hidden="true">›</span>
                  </div>
                  <p class="as-note" v-if="asdairStaleAttentionCount > 0">
                    {{ asdairStaleAttentionCount }} further {{ asdairStaleAttentionCount === 1 ? 'line still carries' : 'lines still carry' }}
                    an unsettled marker in AsdAIr’s own data even though you have already answered
                    {{ asdairStaleAttentionCount === 1 ? 'it' : 'them' }}. {{ asdairStaleAttentionCount === 1 ? 'It is' : 'They are' }}
                    not counted above, and nothing is being asked of you twice.
                  </p>
                </div>

                <div class="grp" v-if="asdairChangeLines.length">
                  <h2>Changes and additions<span class="g-count">{{ asdairChangeLines.length }}</span></h2>
                  <p class="as-meaning">Not simply read off the photograph — added, changed, or decided.</p>
                  <div v-for="(ln,i) in asdairChangeLines" :key="'chg'+(ln.line_no != null ? ln.line_no : i)" class="item as-stack" :class="asdairLineTone(ln.status)"
                    role="button" tabindex="0" @click="asdairOpenChange(ln)" @keydown.enter="asdairOpenChange(ln)" @keydown.space.prevent="asdairOpenChange(ln)">
                    <div class="i-main">
                      <div class="i-title">{{ asdairLineTitle(ln) }}<span v-if="asdairKnown(ln.quantity_display)"> ×{{ ln.quantity_display }}</span></div>
                      <div class="as-sub">{{ asdairLineProvenance(ln) }}</div>
                    </div>
                    <span class="chev" aria-hidden="true">›</span>
                  </div>
                </div>

                <!-- RESOLVED — available, compact, and COLLAPSED. Warwick opens it when he wants it;
                     it never competes for the screen with the things that actually need him. -->
                <div class="grp" v-if="asdairResolvedLines.length">
                  <h2>Already sorted<span class="g-count">{{ asdairResolvedLines.length }}</span></h2>
                  <details class="tech">
                    <summary>Show the {{ asdairResolvedLines.length }} {{ asdairResolvedLines.length === 1 ? 'line' : 'lines' }} that are already settled</summary>
                    <div class="tech-body">
                      <button v-for="(ln,i) in asdairResolvedLines" :key="'res'+(ln.line_no != null ? ln.line_no : i)" type="button" class="as-compact" @click="asdairOpenChange(ln)">
                        <span class="as-compact-name">{{ asdairLineTitle(ln) }}<span v-if="asdairKnown(ln.quantity_display)"> ×{{ ln.quantity_display }}</span></span>
                        <span class="as-compact-why">{{ asdairLineProvenance(ln) }}</span>
                      </button>
                    </div>
                  </details>
                </div>

                <!-- AC5 — the full photograph WHEN WANTED, never by default. Auto-rotated by the
                     browser's own EXIF handling; no pipeline-computed rotation exists yet where the
                     source carries no EXIF (most Telegram photos), which is stated, not papered over. -->
                <div class="grp" v-if="asdairWs.evidence && asdairWs.evidence.has_media">
                  <h2>The photograph</h2>
                  <button class="asdair-photo-thumb" type="button" @click="asdairOpenPhoto()" :disabled="asdairMediaErr" aria-label="View the original photo of the list, full size">
                    <img v-if="!asdairMediaErr" class="asdair-photo-sm" :src="asdairMediaUrl" alt="" aria-hidden="true" @error="asdairMediaErr = true" />
                    <span class="as-note">{{ asdairMediaErr ? 'The photo could not be loaded.' : 'View the original photo' }}</span>
                  </button>
                </div>
              </div>

              <!-- ══ THE EXCEPTION BOARD — WP-B15-42, AC2 and AC3 ═══════════════════════════════
                   Warwick: he must resolve exceptions HERE. "Not by scrolling Telegram. Not by
                   asking Larry. Not by reading database rows."

                   ⛔ THIS IS NOW THE ONLY EXCEPTION SURFACE. Before this WP there were three — this
                   screen, the Shop screen's own "Needs your attention" list, and the Basket screen's
                   "Held back" block. Three partial answers to one question IS the incoherence. The
                   Shop screen now POINTS here and the list screen marks its exceptions and points
                   here; neither renders a second board.

                   Every entry carries, in this reading order: the crop it is evidence for · what
                   AsdAIr read · the product it proposes · sensible alternatives · why it is
                   uncertain · and the ways to answer. -->
              <div v-else-if="currentView.key==='questions'" class="asdair-view">
                <!-- The same one sentence that leads the Shop screen, so the two screens can never
                     tell Warwick two different stories about the same shop. ONE source, rendered twice. -->
                <p v-if="asdairBlockingSentence" class="as-answer">{{ asdairBlockingSentence }}</p>
                <p v-if="asdairFlash" class="as-flash" role="status" aria-live="polite">{{ asdairFlash }}</p>

                <!-- AC2 — the durable-knowledge offer, raised only by an answer that actually
                     landed. With no command published behind it, it renders DISABLED and says why:
                     an offer that quietly discarded the answer would be worse than no offer. -->
                <div v-if="asdairRemember" class="as-remember">
                  <p class="as-remember-q" v-if="!asdairRemember.done">Should AsdAIr remember “{{ asdairRemember.answer }}” for future shops?</p>
                  <p class="as-remember-q" v-else>{{ asdairRemember.done }}</p>
                  <p class="as-note" v-if="!asdairRememberCommand && !asdairRemember.done">
                    AsdAIr publishes no command for this yet, so it cannot be made durable from here.
                    Your answer has been applied to this shop.
                  </p>
                  <div class="i-act" v-if="!asdairRemember.done">
                    <button class="act accept" :disabled="!asdairRememberCommand || asdairRemember.busy" @click="asdairRememberAnswer()">{{ asdairRemember.busy ? '…' : 'Remember it' }}</button>
                    <button class="act" :disabled="asdairRemember.busy" @click="asdairDismissRemember()">Just this shop</button>
                  </div>
                  <div class="i-act" v-else><button class="act" @click="asdairDismissRemember()">Close</button></div>
                  <p class="err" v-if="asdairRemember.error">{{ asdairRemember.error }}</p>
                </div>

                <!-- AC3 — X NEED YOU / Y RESOLVED / Z STILL BLOCKING, at a glance, from ONE
                     partition so a counter can never disagree with the rows beneath it. -->
                <div class="as-tally" role="status" aria-live="polite">
                  <div class="as-tally-cell warn">
                    <b>{{ asdairBoardCounts.needYou }}</b><span>need you</span>
                  </div>
                  <div class="as-tally-cell ok">
                    <b>{{ asdairBoardCounts.resolved }}</b><span>resolved</span>
                  </div>
                  <div class="as-tally-cell block">
                    <b v-if="asdairBoardCounts.blocking !== null">{{ asdairBoardCounts.blocking }}</b><b v-else>—</b><span>still blocking</span>
                  </div>
                </div>
                <p class="as-note" v-if="asdairBoardCounts.blocking === null">
                  AsdAIr isn’t yet reporting which lines are held out of the basket, so “still blocking”
                  is not a number — it is left blank rather than shown as a zero nobody measured.
                </p>

                <div class="grp">
                  <h2>Needs you<span class="g-count">{{ asdairBoardCounts.needYou }}</span></h2>
                  <p class="empty" v-if="!asdairBoardOpen.length">Nothing is waiting on you. Every exception on this shop has an answer.</p>
                  <div v-for="e in asdairBoardOpen" :key="e.key" class="item as-stack" :class="e.blocking ? 'red' : 'amber'">
                    <div class="i-main">
                      <div class="i-eyebrow" :class="e.blocking ? 'blocked' : 'decision'">
                        <span v-if="e.blocking">HELD OUT OF THE BASKET</span><span v-else>NEEDS A DECISION</span>
                      </div>

                      <!-- WHAT ASDAIR READ. For a question, its own text; for a held line with no
                           question routed to it, the wording from the list. Never the word
                           "unknown", and never a null dressed as a product name. -->
                      <div class="as-raw" v-if="e.question">{{ e.question.question_text_display }}</div>
                      <div class="as-raw" v-else>{{ asdairSaid(e.held.raw, 'AsdAIr couldn’t read this line') }}</div>
                      <div class="as-sub" v-if="e.question && e.held && e.held.raw">Read from the list as “{{ e.held.raw }}”.</div>

                      <!-- THE RELEVANT CROP. "Show the relevant crop rather than making Warwick hunt
                           around the page." When no region is recorded we SAY so and offer the whole
                           photograph — a fabricated crop would be evidence that is not evidence. -->
                      <div v-if="asdairCanCrop(asdairRegionOf(e.question || e.held))" class="as-crop" :style="asdairCropBoxStyle(asdairRegionOf(e.question || e.held))">
                        <img v-if="asdairRegionOf(e.question || e.held).url" :src="asdairRegionOf(e.question || e.held).url" class="as-crop-whole" alt="" aria-hidden="true" />
                        <img v-else :src="asdairMediaUrl" :style="asdairCropImgStyle(asdairRegionOf(e.question || e.held))" alt="" aria-hidden="true" />
                      </div>
                      <p v-else-if="asdairWs.evidence && asdairWs.evidence.has_media" class="as-note">
                        AsdAIr hasn’t recorded which part of the photograph this line came from, so there is
                        no crop to show. <button class="as-link" type="button" @click="asdairOpenPhoto()">View the whole photograph</button>
                      </p>

                      <!-- THE PROPOSED PRODUCT, where one exists. -->
                      <div class="as-sub strong" v-if="e.held && e.held.product">AsdAIr proposes: {{ e.held.product }}</div>

                      <!-- WHY IT IS UNCERTAIN — the held reason in words, and the corroboration
                           behind the reading. ⛔ Never the word "verified": three readings by one
                           model of one photograph are correlated, so agreement is corroboration. -->
                      <div class="as-sub" v-if="e.held && e.held.heldReason">Why it is uncertain: {{ e.held.heldReason }}<span v-if="e.held.heldDetail"> — {{ e.held.heldDetail }}</span></div>
                      <div class="as-chips" v-if="e.held && e.held.corroboration">
                        <span class="chip" :class="e.held.corroboration.tone"><span class="d" aria-hidden="true"></span>{{ e.held.corroboration.word }}</span>
                        <span class="as-sub">{{ e.held.corroboration.sentence }}</span>
                      </div>

                      <!-- SENSIBLE ALTERNATIVES — the question's own candidates, one tap each. -->
                      <div class="as-tags" v-if="e.question && e.question.candidates && e.question.candidates.length">
                        <button v-for="c in e.question.candidates" :key="c.index" class="as-choice" type="button" :disabled="e.question._busy"
                          @click="asdairAnswerQuestion(e.question, 'choose', {candidate: c})">✓ {{ c.label_display }}</button>
                      </div>

                      <!-- ANSWERABLE IN PLACE. A held line with no question routed to it cannot be
                           answered here, and says that rather than offering a control that does
                           nothing. Lane C publishing routed_question on held lines closes this.
                           ⛔ NO BACKTICKS IN THIS TEMPLATE — it is a JS template literal, and one
                           backtick in a comment ends the string and breaks the whole app. -->
                      <div class="i-act" v-if="e.question">
                        <button class="act" :disabled="e.question._busy" @click="asdairOpenQuestion(e.question)">Type an answer</button>
                        <button class="act decline" :disabled="e.question._busy" @click="asdairAnswerQuestion(e.question, 'skip')">{{ e.question._busy ? '…' : 'Not this week' }}</button>
                      </div>
                      <p class="as-note" v-else>
                        AsdAIr has held this line back but hasn’t routed a question for it, so there is
                        nothing to answer here yet. It is shown so nothing is silently dropped.
                      </p>
                      <p class="err" v-if="e.question && e.question._error">{{ e.question._error }}</p>
                    </div>
                  </div>
                </div>

                <!-- AC3 — ANSWERED QUESTIONS STAY VISIBLE AND COLLAPSIBLE. They do not vanish:
                     collapsed but openable, each showing what was asked, what Warwick said, what it
                     was taken to mean, and whether it was REMEMBERED for future shops or applied
                     only to this one. Every one can be CHANGED through the same command. -->
                <div class="grp" v-if="asdairBoardDone.length">
                  <h2>Resolved<span class="g-count">{{ asdairBoardCounts.resolved }}</span></h2>
                  <p class="as-meaning">Kept on screen on purpose — an answer you cannot find again is an answer you cannot correct.</p>
                  <details v-for="e in asdairBoardDone" :key="e.key" class="tech">
                    <summary>{{ e.question.status_display === 'skipped' ? 'Skipped' : 'Answered' }}<span v-if="asdairKnown(e.question.answer_text_display)"> · {{ e.question.answer_text_display }}</span><span v-if="asdairKnown(e.question.answered_at_display)"> · {{ e.question.answered_at_display }}</span></summary>
                    <div class="tech-body">
                      <div class="as-raw">{{ e.question.question_text_display }}</div>
                      <div class="as-sub" v-if="asdairKnown(e.question.answer_text_display)">You said: “{{ e.question.answer_text_display }}”</div>
                      <div class="as-sub strong" v-if="e.question.resolution_display">→ {{ e.question.resolution_display }}</div>
                      <!-- "applied to this shop" vs "remembered for future shops" — from the
                           decision's own recorded forward intent, never inferred. -->
                      <div class="as-sub" v-if="e.question.decision && asdairKnown(e.question.decision.forward_intent_display)">Remembered for future shops: {{ e.question.decision.forward_intent_display }}</div>
                      <div class="as-note" v-else>Applied to this shop. Nothing says it was remembered for future shops.</div>
                      <div class="i-act">
                        <button class="act" :disabled="e.question._busy" @click="asdairOpenReanswer(e.question)">Change this answer</button>
                      </div>
                      <p class="err" v-if="e.question._error">{{ e.question._error }}</p>
                    </div>
                  </details>
                </div>

                <p class="as-note">{{ ASDAIR_CORROBORATION_CAVEAT }}</p>
              </div>

              <!-- Any asdair view that is neither shop nor questions and still needs the shop
                   workspace. Basket, Rules and Diagnostics are handled elsewhere. -->
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
               Derived server-side by capae.mjs capaeOverview(). capae-check.mjs now asserts that
               derivation directly — including a guard reproducing the exact mutation that proved it
               unasserted (needsAttention forced true, six gates green), and the check now runs in CI.
               ⚠️ THIS COMMENT PREVIOUSLY CLAIMED THAT COVERAGE BEFORE IT EXISTED. capae-check.mjs
               imported five symbols and never touched res.overview. A false statement about
               acceptance evidence, sitting in product source where the next reader believes it —
               which is the same failure as reporting a mechanism active before executing it. -->
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

  <!-- ASDAIR ACTION SHEET — every write action AND the full-photo view, in one small self-contained
       modal (BUILD-015 B15-26, AC4/AC5). Kept separate from the generic detail sheet below, whose
       header is shared by idea/opp/output/doc and would need a fifth branch for no benefit. -->
  <div v-if="asdairSheet" class="sheet" @click.self="asdairCloseSheet()">
    <!-- WP-B15-36, AC7 residual 2 — the focus-trap "body bounce". The inert attribute on .nav and
         .shell-main removes every other control from the tab order, but Tab from the LAST control in the
         sheet still walks out into the browser's own chrome before coming back. These two sentinels
         close that: they are in the tab order, in front of and behind the card, and each bounces
         focus to the opposite end of the dialog. Two focus handlers, no hand-rolled key cycle, and
         no Shift+Tab-from-first-element special case. -->
    <!-- VERA RESIDUAL 1, WP-B15-42 — aria-hidden="true" DROPPED from both sentinels.
         A focusable element marked aria-hidden is the axe aria-hidden-focus violation: it tells
         assistive technology the element does not exist while leaving it in the tab order, which is
         a contradiction no scan will ever stop reporting. The attribute bought nothing here — these
         spans are empty, so they announce nothing either way — and it cost a permanent finding.
         Empty focusable sentinels with no ARIA are the standard shape for this pattern. -->
    <span tabindex="0" class="as-trap" @focus="asdairTrapFocus('last')"></span>
    <div class="sheet-card asdair-sheet" role="dialog" aria-modal="true"
      :aria-label="asdairSheet.kind==='photo' ? 'Original photo' : asdairSheet.kind==='question' ? 'Answer this question' : 'Change this line'"
      @keydown.esc="asdairCloseSheet()">
      <button class="back" @click="asdairCloseSheet()">‹ Back</button>

      <template v-if="asdairSheet.kind==='photo'">
        <h1>The original photograph</h1>
        <p class="as-sub">Shown exactly as uploaded — the browser applies the photo's own rotation if it carries one.</p>
        <img class="asdair-photo" :src="asdairMediaUrl" alt="The full, original photo of this week's list." />
      </template>

      <template v-else-if="asdairSheet.kind==='question'">
        <h1>{{ asdairSheet.reanswer ? 'Change your answer' : 'Answer this question' }}</h1>
        <div class="as-raw">{{ asdairSheet.question.question_text_display }}</div>
        <p class="as-sub" v-if="asdairSheet.reanswer && asdairKnown(asdairSheet.question.answer_text_display)">You said “{{ asdairSheet.question.answer_text_display }}”. Change it below and save.</p>
        <!-- The crop, in the sheet too — the same region, drawn the same way, so answering from the
             sheet never means losing sight of the evidence. -->
        <div v-if="asdairCanCrop(asdairRegionOf(asdairSheet.question))" class="as-crop" :style="asdairCropBoxStyle(asdairRegionOf(asdairSheet.question))">
          <img v-if="asdairRegionOf(asdairSheet.question).url" :src="asdairRegionOf(asdairSheet.question).url" class="as-crop-whole" alt="" aria-hidden="true" />
          <img v-else :src="asdairMediaUrl" :style="asdairCropImgStyle(asdairRegionOf(asdairSheet.question))" alt="" aria-hidden="true" />
        </div>
        <div class="as-tags" v-if="asdairSheet.question.candidates && asdairSheet.question.candidates.length">
          <button v-for="c in asdairSheet.question.candidates" :key="c.index" class="as-choice" type="button" :disabled="asdairSheet.question._busy"
            @click="asdairAnswerQuestion(asdairSheet.question, 'choose', {candidate: c})">✓ {{ c.label_display }}</button>
        </div>
        <label class="lane-sub" for="asdair-answer-text">Or type your own answer</label>
        <input id="asdair-answer-text" class="asdair-input" type="text" v-model="asdairAnswerText"
          placeholder="e.g. Cravendale Semi-Skimmed 2L"
          @keydown.enter="asdairAnswerQuestion(asdairSheet.question, 'typed', {text: asdairAnswerText})" />
        <div class="i-act">
          <button class="act accept" :disabled="asdairSheet.question._busy" @click="asdairAnswerQuestion(asdairSheet.question, 'typed', {text: asdairAnswerText})">{{ asdairSheet.question._busy ? '…' : 'Save answer' }}</button>
          <button class="act" :disabled="asdairSheet.question._busy" @click="asdairAnswerQuestion(asdairSheet.question, 'search', {text: asdairAnswerText})">Search ASDA for this</button>
          <button class="act decline" :disabled="asdairSheet.question._busy" @click="asdairAnswerQuestion(asdairSheet.question, 'skip')">Not this week</button>
        </div>
        <p class="err" v-if="asdairSheet.question._error">{{ asdairSheet.question._error }}</p>
      </template>

      <template v-else-if="asdairSheet.kind==='change'">
        <h1>Something looks wrong?</h1>
        <p class="as-sub">Tell AsdAIr what this line should say. This goes through the same correction path Telegram uses — nothing here writes to the database directly.</p>
        <label class="lane-sub" for="asdair-change-name">Item</label>
        <input id="asdair-change-name" class="asdair-input" type="text" v-model="asdairChangeName" placeholder="e.g. Cravendale Semi-Skimmed 2L" />
        <label class="lane-sub" for="asdair-change-qty">Quantity (optional)</label>
        <input id="asdair-change-qty" class="asdair-input" type="number" min="1" max="99" v-model="asdairChangeQty" placeholder="leave blank if unchanged" />
        <div class="i-act">
          <button class="act accept" :disabled="asdairSheetBusy" @click="asdairSubmitChange()">{{ asdairSheetBusy ? '…' : 'Save correction' }}</button>
          <!-- AC5 — "mark something 'not this week'" on an ALREADY-RESOLVED line. Offered only when
               the API publishes a command for it; otherwise disabled and SAID, never faked. -->
          <button class="act decline" :disabled="asdairSheetBusy || !asdairSkipCommand"
            :title="asdairSkipCommand ? 'Leave this out of this week’s shop' : 'AsdAIr has no command for this yet'"
            @click="asdairSkipLine(asdairSheet.line)">Not this week</button>
        </div>
        <p class="as-note" v-if="!asdairSkipCommand">“Not this week” is greyed out because AsdAIr does not yet publish a command for skipping an already-sorted line. It becomes live the moment one exists — nothing here pretends to work in the meantime.</p>
        <p class="err" v-if="asdairSheetErr">{{ asdairSheetErr }}</p>
      </template>
    </div>
    <span tabindex="0" class="as-trap" @focus="asdairTrapFocus('first')"></span>
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
