/* Fusion247 Cockpit — the Warwick-facing surface. Reads /api/state (the spine, via cp_directus),
   files decisions to /api/decide (governed intents + surface lifecycle). Depth ladder, Life/Build
   lanes, decision lifecycle (accept/decline/defer + Archive + Later), readable outputs. No build step. */
const { createApp, ref, computed, onMounted } = Vue;

const REPORT = 'http://100.101.240.85:8701';
const GRAPH = 'http://100.101.240.85:8700';
const AREAS = [
  { key: 'home', label: 'Home', icon: '🏠' },
  { key: 'ideas', label: 'Ideas', icon: '💡' },
  { key: 'brain', label: 'Brain', icon: '🧠' },
  { key: 'outputs', label: 'Outputs', icon: '📤' },
  { key: 'system', label: 'System', icon: '🛠' },
];

const kindOf = (it) => it.kind || 'suggestion';
const catLabel = (it) => ({ blocked: 'Blocked by you', decision: 'Decision', suggestion: 'Suggestion' }[kindOf(it)] || 'Output');
const moduleLabel = (m) => ({ brain: 'Brain', shopping: 'Shopping', asdair: 'Shopping', builds: 'Builds', careerair: 'CareerAIr' }[m] || m || '');
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

    async function load() {
      loading.value = true;
      try { const r = await fetch('/api/state', { cache: 'no-store' }); state.value = await r.json(); } catch (e) { /* keep last */ }
      loading.value = false;
    }
    onMounted(load);

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

    const LIFE = new Set(['shopping', 'asdair', 'careerair']);
    const laneOf = (it) => (LIFE.has(it.source_module) ? 'life' : 'build');
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
    const jobsFound = computed(() => outputs.value.filter((o) => o.source_module === 'careerair').length);
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
      t.push({ num: suggestions.value.length, label: 'Ideas', desc: 'brain & cash', tone: 'blue', area: 'ideas' });
      t.push({ num: outputs.value.length, label: 'Outputs', desc: 'made for you', tone: 'green', area: 'outputs' });
      t.push({ num: state.value.ingestedCount ?? '—', label: 'Brain', desc: 'sources ingested', tone: 'grey', area: 'brain' });
      if (wins.value.length) t.push({ num: wins.value.length, label: 'Recent wins', desc: 'just finished', tone: 'green', area: 'system' });
      return t;
    });

    const go = (k) => { detail.value = null; area.value = k; };
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

    return {
      AREAS, state, area, detail, busy, loading,
      kindOf, catLabel, moduleLabel, oneLine, ago, terse, impactStars, outputTitle, humanValue, humanPoints, spinOf, notifyMark, build, housekeeping, host, when,
      attn, deferred, archived, blocked, decisions, suggestions, needsYou, ideaCat, ideasBrain, ideasCash, latest, toneOf,
      outputs, newOutputs, itemsAdded, jobsFound, wins, builds,
      statusTone, statusLine, tiles, go, open, closeDetail, decide, copyTranscript, primaryAction, load, REPORT, GRAPH,
    };
  },
  template: `
<div class="app">
  <nav class="nav">
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
      <button class="refresh" @click="load" :disabled="loading">{{ loading ? '…' : '↻' }}</button>
    </header>

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

        <!-- Latest: recent activity, under the tiles -->
        <div class="grp" style="margin-top:20px" v-if="latest.length">
          <h2>🕑 Latest</h2>
          <div v-for="(l,idx) in latest" :key="idx" class="item grey" @click="go(l.area)">
            <div class="i-main"><div class="i-eyebrow">{{ l.kind }} · {{ ago(l.t) }} ago</div><div class="i-title">{{ terse(l.label) }}</div></div>
            <span class="chev">›</span>
          </div>
        </div>
      </section>

      <!-- IDEAS (was Attention) — Brain (improve F247) vs Cash (make money) -->
      <section v-else-if="area==='ideas'" class="pane">
        <header class="p-h"><h1>Ideas</h1><button v-if="archived.length" class="refresh" style="margin-left:auto" @click="go('archive')">🗄 Archive · {{ archived.length }}</button></header>

        <div class="grp" v-if="ideasBrain.length">
          <h2>🧠 Brain<span class="g-count">{{ ideasBrain.length }}</span><span class="lane-sub">improve F247</span></h2>
          <div v-for="it in ideasBrain" :key="it.id" class="item blue">
            <div class="i-main" @click="open(it,'idea')"><div class="i-eyebrow"><span style="color:var(--warn)">{{ impactStars(it.priority) }}</span> impact</div><div class="i-title">{{ terse(it.title) }}</div><div v-if="it.reason" class="i-why">{{ oneLine(it.reason) }}</div></div>
            <div class="i-act"><span v-if="it._done" class="done-pill">✅ {{ it._done }}</span><template v-else><button class="act accept" :disabled="busy" @click.stop="decide(it,'accept',primaryAction(it))">Accept</button><button class="act defer" :disabled="busy" @click.stop="decide(it,'defer')">Later</button><button class="act decline" :disabled="busy" @click.stop="decide(it,'decline')">Decline</button></template></div>
          </div>
        </div>

        <div class="grp" v-if="ideasCash.length">
          <h2>💰 Cash<span class="g-count">{{ ideasCash.length }}</span><span class="lane-sub">make money</span></h2>
          <div v-for="it in ideasCash" :key="it.id" class="item green">
            <div class="i-main" @click="open(it,'idea')"><div class="i-eyebrow"><span style="color:var(--warn)">{{ impactStars(it.priority) }}</span> impact</div><div class="i-title">{{ terse(it.title) }}</div><div v-if="it.reason" class="i-why">{{ oneLine(it.reason) }}</div></div>
            <div class="i-act"><span v-if="it._done" class="done-pill">✅ {{ it._done }}</span><template v-else><button class="act accept" :disabled="busy" @click.stop="decide(it,'accept',primaryAction(it))">Accept</button><button class="act defer" :disabled="busy" @click.stop="decide(it,'defer')">Later</button><button class="act decline" :disabled="busy" @click.stop="decide(it,'decline')">Decline</button></template></div>
          </div>
        </div>

        <div v-if="!ideasBrain.length && !ideasCash.length" class="empty big">No ideas yet — the scout + dPax will fill this. 💡</div>

        <div class="grp" v-if="deferred.length">
          <h2>🕒 Later<span class="g-count">{{ deferred.length }}</span><span class="lane-sub">you parked these</span></h2>
          <div v-for="it in deferred" :key="it.id" class="item deferred" :class="toneOf(it)">
            <div class="i-main" @click="open(it,'idea')"><div class="i-title">{{ terse(it.title) }}</div></div>
            <div class="i-act"><button class="act" :disabled="busy" @click.stop="decide(it,'reopen')">Bring back</button></div>
          </div>
        </div>
      </section>

      <!-- OUTPUTS -->
      <section v-else-if="area==='outputs'" class="pane">
        <header class="p-h"><h1>Outputs</h1><span class="count">{{ outputs.length }}</span></header>
        <div v-if="!outputs.length" class="empty big">Nothing produced for you yet.</div>
        <div v-for="o in outputs" :key="o.id" class="item green">
          <div class="i-main" @click="open(o,'output')"><div class="i-eyebrow">{{ moduleLabel(o.source_module) }} · {{ ago(o.produced_at) }} ago</div><div class="i-title">{{ terse(outputTitle(o)) }}</div><div v-if="humanValue(o.value)" class="i-why">{{ oneLine(humanValue(o.value)) }}</div></div>
          <div class="i-side"><span class="chev">›</span></div>
        </div>
      </section>

      <!-- BRAIN -->
      <section v-else-if="area==='brain'" class="pane">
        <header class="p-h"><h1>Brain</h1></header>
        <div class="tiles">
          <button class="tile grey"><span class="t-num">{{ state.ingestedCount ?? '—' }}</span><span class="t-lbl">Ingested</span><span class="t-desc">sources processed</span></button>
          <button class="tile green" @click="go('outputs')"><span class="t-num">{{ outputs.length }}</span><span class="t-lbl">Insights</span><span class="t-desc">so-what for you</span></button>
          <button class="tile blue" @click="go('attention')"><span class="t-num">{{ suggestions.length }}</span><span class="t-lbl">Make better</span><span class="t-desc">brain ideas</span></button>
          <button class="tile grey" title="graph merges I'm holding — not something you need to action"><span class="t-num">{{ housekeeping }}</span><span class="t-lbl">Housekeeping</span><span class="t-desc">graph Qs I'm holding</span></button>
        </div>
        <div class="tiles" style="margin-top:12px">
          <a class="tile blue" :href="GRAPH" target="_blank" rel="noopener" style="text-decoration:none"><span class="t-num">🌌</span><span class="t-lbl">Galaxy</span><span class="t-desc">explore the graph ↗</span></a>
          <a class="tile grey" :href="REPORT" target="_blank" rel="noopener" style="text-decoration:none"><span class="t-num">📄</span><span class="t-lbl">Report</span><span class="t-desc">full knowledge report ↗</span></a>
        </div>
        <p class="empty" style="margin-top:10px">🌌 <b>Galaxy</b> = your knowledge as an explorable map you can fly around. 📄 <b>Report</b> = the full written write-up of everything the Brain has ingested.</p>
        <div class="grp" style="margin-top:20px">
          <h2>Recently ingested<span class="lane-sub">captured &amp; processed — not the same as "learned"</span></h2>
          <div v-if="!(state.ingested||[]).length" class="empty">Nothing ingested yet.</div>
          <div v-for="s in (state.ingested||[])" :key="s.video_id" class="item grey">
            <div class="i-main"><div class="i-title">{{ s.title || s.video_id }}</div><div class="i-why" :class="{err: s._copyErr}">{{ s._copyErr ? s._copyErr : ('ingested ' + ago(s.updated_at) + ' ago') }}</div></div>
            <div class="i-act"><button class="act" :disabled="busy" @click="copyTranscript(s)">{{ s._copied ? '✓ Copied' : '⧉ Transcript' }}</button></div>
          </div>
        </div>
      </section>

      <!-- ARCHIVE (declined items — change your mind here) -->
      <section v-else-if="area==='archive'" class="pane">
        <header class="p-h"><button class="back" style="padding:0;margin-right:4px" @click="go('attention')">‹</button><h1>Archive</h1><span class="count">{{ archived.length }}</span></header>
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
      <div class="d-eyebrow">{{ detail._as==='output' ? (moduleLabel(detail.source_module)+' · output') : catLabel(detail) }}</div>
      <h1>{{ detail._as==='output' ? outputTitle(detail) : detail.title }}</h1>

      <template v-if="detail._as==='output'">
        <ul v-if="humanPoints(detail.value).length" class="read"><li v-for="(p,i) in humanPoints(detail.value)" :key="i">{{ p }}</li></ul>
        <div v-else-if="humanValue(detail.value)" class="read">{{ humanValue(detail.value) }}</div>
        <div v-else class="d-reason">A result was produced — open the full read below.</div>
        <div class="d-links">
          <a v-if="detail.evidence_url" :href="detail.evidence_url" target="_blank" rel="noopener">📄 Open the full read ↗</a>
        </div>
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
