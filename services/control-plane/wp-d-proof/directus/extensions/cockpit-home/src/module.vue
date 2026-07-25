<template>
  <private-view title="Fusion247 Cockpit">
    <div class="ck">
      <!-- SIDEBAR (icon rail / drawer on narrow; real sidebar ≥780px) -->
      <nav class="nav">
        <div class="nav-brand"><span class="pip" :class="statusTone"></span><b>Fusion247</b></div>
        <button v-for="a in areas" :key="a.key" class="nav-btn" :class="{ on: area === a.key }" @click="go(a.key)">
          <span class="nav-ico">{{ a.icon }}</span><span class="nav-lbl">{{ a.label }}</span>
          <span v-if="a.key === 'attention' && blocked.length" class="nav-badge">{{ blocked.length }}</span>
        </button>
        <div class="nav-foot"><span class="pip" :class="statusTone"></span>{{ statusLine }}</div>
      </nav>

      <main class="main">
        <!-- ===== L3/L4 DETAIL ===== -->
        <section v-if="detail" class="pane">
          <button class="back" @click="detail = null">← Back</button>
          <div class="detail">
            <div class="d-eyebrow">{{ catLabel(detail) }} · {{ moduleLabel(detail.source_module) }}</div>
            <h1>{{ detail.title }}</h1>
            <p v-if="detail.reason || detail.value" class="d-reason">{{ detail.reason || detail.value }}</p>
            <div v-if="detail._kind === 'attention'" class="d-actions">
              <span v-if="detail._done" class="done-pill">✅ {{ detail._done }} — queued</span>
              <template v-else><button v-for="ax in (detail.actions || [])" :key="ax.key" class="act" :class="ax.key" :disabled="busy" @click="doAction(detail, ax)">{{ ax.label }}</button></template>
              <span v-if="detail._error" class="err">⚠ {{ detail._error }}</span>
            </div>
            <div class="d-links"><a v-if="detail.evidence_url" :href="detail.evidence_url" target="_blank" rel="noopener">Open the full result / source ↗</a></div>
            <!-- LEVEL 4: technical, deliberately buried -->
            <details class="tech"><summary>Technical detail</summary>
              <div class="tech-body"><span class="mono">{{ detail.provenance_ref }}</span><span v-if="detail.related_ref" class="mono"> · related {{ detail.related_ref }}</span></div>
            </details>
          </div>
        </section>

        <!-- ===== LEVEL 1: HOME (tiles only) ===== -->
        <section v-else-if="area === 'home'" class="pane">
          <div class="status" :class="statusTone"><span class="pip" :class="statusTone"></span><span>{{ statusLine }}</span></div>
          <div class="tiles">
            <button v-for="t in tiles" :key="t.label" class="tile" :class="t.tone" @click="go(t.area)">
              <span class="t-num">{{ t.num }}</span><span class="t-lbl">{{ t.label }}</span><span class="t-desc">{{ t.desc }}</span>
            </button>
          </div>
        </section>

        <!-- ===== LEVEL 2: ATTENTION (grouped by real category) ===== -->
        <section v-else-if="area === 'attention'" class="pane">
          <header class="p-h"><h1>Attention</h1></header>
          <div class="grp" v-if="blocked.length">
            <h2>Blocked by you<span class="g-count">{{ blocked.length }}</span></h2>
            <div v-for="it in blocked" :key="it.id" class="item red">
              <div class="i-main tap" @click="open(it, 'attention')"><div class="i-title">{{ it.title }}</div><div v-if="it.reason" class="i-why">{{ oneLine(it.reason) }}</div></div>
              <div class="i-act"><span v-if="it._done" class="done-pill sm">✅ {{ it._done }}</span><template v-else><button v-for="ax in it.actions" :key="ax.key" class="act sm" :class="ax.key" :disabled="busy" @click.stop="doAction(it, ax)">{{ ax.label }}</button></template></div>
            </div>
          </div>
          <div class="grp">
            <h2>Decisions<span class="g-count">{{ decisions.length }}</span></h2>
            <div v-if="!decisions.length" class="empty">No decisions waiting.</div>
            <div v-for="it in decisions" :key="it.id" class="item amber">
              <div class="i-main tap" @click="open(it, 'attention')"><div class="i-title">{{ it.title }}</div><div v-if="it.reason" class="i-why">{{ oneLine(it.reason) }}</div></div>
              <div class="i-act"><span v-if="it._done" class="done-pill sm">✅ {{ it._done }}</span><template v-else><button v-for="ax in it.actions" :key="ax.key" class="act sm" :class="ax.key" :disabled="busy" @click.stop="doAction(it, ax)">{{ ax.label }}</button></template></div>
            </div>
          </div>
          <div class="grp">
            <h2>Suggestions<span class="g-count">{{ suggestions.length }}</span></h2>
            <div v-if="!suggestions.length" class="empty">No suggestions right now.</div>
            <div v-for="it in suggestions" :key="it.id" class="item blue">
              <div class="i-main tap" @click="open(it, 'attention')"><div class="i-title">{{ it.title }}</div><div v-if="it.reason" class="i-why">{{ oneLine(it.reason) }}</div></div>
              <div class="i-act"><span v-if="it._done" class="done-pill sm">✅ {{ it._done }}</span><template v-else><button v-for="ax in it.actions" :key="ax.key" class="act sm" :class="ax.key" :disabled="busy" @click.stop="doAction(it, ax)">{{ ax.label }}</button></template></div>
            </div>
          </div>
        </section>

        <!-- ===== OUTPUTS ===== -->
        <section v-else-if="area === 'outputs'" class="pane">
          <header class="p-h"><h1>Outputs</h1><span class="count">{{ outputs.length }}</span></header>
          <div v-if="!outputs.length" class="empty big">Nothing produced yet.</div>
          <div v-for="o in outputs" :key="o.id" class="item green" @click="open(o, 'output')">
            <div class="i-main"><div class="i-title">{{ o.title }}</div><div v-if="o.value" class="i-why">{{ oneLine(o.value) }}</div></div>
            <span class="fresh">{{ ago(o.produced_at) }}</span><span class="chev">›</span>
          </div>
        </section>

        <!-- ===== BRAIN ===== -->
        <section v-else-if="area === 'brain'" class="pane">
          <header class="p-h"><h1>Brain</h1><div class="tabs"><a :href="reportUrl" target="_blank" rel="noopener" class="tab-link">Report ↗</a><a :href="graphUrl" target="_blank" rel="noopener" class="tab-link">Galaxy ↗</a></div></header>
          <div class="tiles sm">
            <button class="tile grey"><span class="t-num">{{ live.learned ?? '—' }}</span><span class="t-lbl">Learned</span></button>
            <button class="tile green" @click="go('outputs')"><span class="t-num">{{ outputs.length }}</span><span class="t-lbl">Insights</span></button>
            <button class="tile amber" @click="go('attention')"><span class="t-num">{{ decisions.length }}</span><span class="t-lbl">To review</span></button>
            <button class="tile blue" @click="go('attention')"><span class="t-num">{{ makeBetter.length }}</span><span class="t-lbl">Make better</span></button>
          </div>
          <div class="grp"><h2>Recently learned</h2>
            <div v-if="!learned.length" class="empty">Nothing learned yet.</div>
            <div v-for="s in learned" :key="s.id" class="item grey"><div class="i-main"><div class="i-title">{{ s.title || s.video_id }}</div></div></div>
          </div>
        </section>

        <!-- ===== SYSTEM ===== -->
        <section v-else class="pane">
          <header class="p-h"><h1>Builds &amp; System</h1></header>
          <div class="grp" v-if="wins.length"><h2>Recent wins<span class="g-count">{{ wins.length }}</span></h2>
            <div v-for="w in wins" :key="w.id" class="item green"><div class="i-main"><div class="i-title">{{ w.text }}</div></div></div>
          </div>
          <div class="grp"><h2>Active work<span class="g-count">{{ builds.length }}</span></h2>
            <div v-if="!builds.length" class="empty">No builds tracked.</div>
            <div v-for="b in builds" :key="b.id" class="item" :class="b.status_tone === 'block' ? 'red' : 'grey'">
              <div class="i-main"><div class="i-title">{{ b.name }}</div><div class="i-why">{{ b.gives }} · {{ b.progress_pct || 0 }}%</div></div>
              <span class="chip" :class="b.status_tone"><span class="dot"></span>{{ b.status }}</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  </private-view>
</template>

<script>
import { useApi } from '@directus/extensions-sdk';
import { ref, computed, onMounted } from 'vue';

export default {
  setup() {
    const reportUrl = 'http://100.101.240.85:8701';
    const graphUrl = 'http://100.101.240.85:8700';
    const areas = [
      { key: 'home', label: 'Home', icon: '🏠' },
      { key: 'attention', label: 'Attention', icon: '🔔' },
      { key: 'outputs', label: 'Outputs', icon: '📤' },
      { key: 'brain', label: 'Brain', icon: '🧠' },
      { key: 'system', label: 'System', icon: '🛠' },
    ];
    const area = ref('home');
    const detail = ref(null);
    const busy = ref(false);
    const attention = ref([]);
    const outputs = ref([]);
    const builds = ref([]);
    const learned = ref([]);
    const wins = ref([]);
    const live = ref({ learned: null });

    const api = useApi();
    const get = async (p, params) => { try { const r = await api.get(p, { params }); return r?.data?.data; } catch { return null; } };

    const kindOf = (it) => it.kind || 'suggestion';
    const blocked = computed(() => attention.value.filter((i) => kindOf(i) === 'blocked'));
    const decisions = computed(() => attention.value.filter((i) => kindOf(i) === 'decision'));
    const suggestions = computed(() => attention.value.filter((i) => kindOf(i) === 'suggestion'));
    const makeBetter = computed(() => attention.value.filter((i) => i.source_type === 'system_improvement'));
    const newOutputs = computed(() => outputs.value.filter((o) => o.status === 'new').length);
    const itemsAdded = computed(() => outputs.value.filter((o) => o.source_module === 'shopping').length);
    const jobsFound = computed(() => outputs.value.filter((o) => o.source_module === 'careerair').length);

    const statusTone = computed(() => (blocked.value.length ? 'red' : 'green'));
    const statusLine = computed(() => (blocked.value.length ? `Blocked by you — ${blocked.value.length} item${blocked.value.length > 1 ? 's' : ''}` : 'Building — nothing blocking me'));

    // LEVEL 1: Home tiles — Warwick-facing outcomes, only when backed by real state (no "so what" zeros).
    const tiles = computed(() => {
      const t = [];
      if (blocked.value.length) t.push({ num: blocked.value.length, label: 'Blocked by you', desc: "I can't continue without you", tone: 'red', area: 'attention' });
      if (decisions.value.length) t.push({ num: decisions.value.length, label: 'Decisions', desc: 'a choice is waiting', tone: 'amber', area: 'attention' });
      if (suggestions.value.length) t.push({ num: suggestions.value.length, label: 'Suggestions', desc: 'ideas to consider', tone: 'blue', area: 'attention' });
      if (newOutputs.value) t.push({ num: newOutputs.value, label: 'New outputs', desc: 'results Fusion made you', tone: 'green', area: 'outputs' });
      if (itemsAdded.value) t.push({ num: itemsAdded.value, label: 'Items added', desc: 'to your lists', tone: 'green', area: 'outputs' });
      if (jobsFound.value) t.push({ num: jobsFound.value, label: 'Jobs found', desc: 'worth a look', tone: 'green', area: 'outputs' });
      if (wins.value.length) t.push({ num: wins.value.length, label: 'Recent wins', desc: 'just finished', tone: 'green', area: 'system' });
      t.push({ num: live.value.learned ?? '—', label: 'Brain', desc: 'sources learned', tone: 'grey', area: 'brain' });
      return t;
    });

    const catLabel = (it) => ({ blocked: 'Blocked by you', decision: 'Decision', suggestion: 'Suggestion' }[kindOf(it)] || 'Output');
    const moduleLabel = (m) => ({ brain: 'Brain', shopping: 'Shopping', builds: 'Builds', careerair: 'CareerAIr' }[m] || m);
    const oneLine = (t) => { if (!t) return ''; const s = String(t).split('\n')[0]; return s.length > 130 ? s.slice(0, 127) + '…' : s; };
    const ago = (ts) => { if (!ts) return ''; const d = (Date.now() - new Date(ts).getTime()) / 60000; if (d < 60) return `${Math.max(1, Math.round(d))}m`; if (d < 1440) return `${Math.round(d / 60)}h`; return `${Math.round(d / 1440)}d`; };

    const go = (k) => { detail.value = null; area.value = k; };
    const open = (item, kind) => { detail.value = { ...item, _kind: kind }; };

    async function doAction(item, ax) {
      busy.value = true; item._error = null;
      try {
        const idem = `${ax.intent}:${ax.args.candidate_id || ax.args.held_id}:${ax.key}:${Date.now()}`;
        await api.post(`/items/${ax.intent}`, { requested_by: 'cockpit:warwick', idempotency_key: idem, ...ax.args });
        item._done = ax.label;
        if (detail.value && detail.value.id === item.id) detail.value._done = ax.label;
        attention.value = attention.value.map((i) => (i.id === item.id ? { ...i, _done: ax.label } : i));
      } catch (e) { item._error = e?.response?.data?.errors?.[0]?.message || e?.message || 'Action failed'; }
      finally { busy.value = false; }
    }

    async function load() {
      const [at, ot] = await Promise.all([
        get('/items/attention_item', { filter: { status: { _eq: 'open' } }, sort: ['priority', '-updated_at'], limit: 200 }),
        get('/items/output_item', { filter: { status: { _neq: 'archived' } }, sort: ['-produced_at'], limit: 100 }),
      ]);
      attention.value = (at || []).map((x) => ({ ...x, actions: Array.isArray(x.actions) ? x.actions : (x.actions ? JSON.parse(x.actions) : []) }));
      outputs.value = ot || [];
      builds.value = (await get('/items/build', { sort: ['sort'], limit: 50 })) || [];
      learned.value = (await get('/items/youtube_source', { sort: ['-updated_at'], limit: 12 })) || [];
      wins.value = (await get('/items/movement', { sort: ['-happened_at'], limit: 8 })) || [];
      const reg = await get('/items/youtube_source', { aggregate: { count: '*' } });
      live.value.learned = (reg && reg[0]) ? (Number(reg[0].count) || learned.value.length) : learned.value.length;
    }
    onMounted(load);

    return { areas, area, detail, busy, attention, outputs, builds, learned, wins, live, reportUrl, graphUrl,
      blocked, decisions, suggestions, makeBetter, tiles, statusTone, statusLine,
      catLabel, moduleLabel, oneLine, ago, go, open, doAction };
  },
};
</script>

<style scoped>
.ck { container-type: inline-size; display: grid; grid-template-columns: 1fr;
  --ok:#1f9d57;--ok-w:#e4f4ea;--warn:#b26a12;--warn-w:#f8ecda;--stop:#c1453c;--stop-w:#f8e5e3;
  --accent:#0e7c86;--accent-ink:#0a5c64;--accent-w:#e2f1f2;--park:#66748a;
  --panel:#fff;--panel2:#f7f9fc;--ink:#16202e;--ink2:#47566b;--ink3:#768498;--hair:#e2e7ee;
  --mono:ui-monospace,"Cascadia Code",Consolas,monospace; color:var(--ink);
  font-family:var(--v-font-family,system-ui,sans-serif); min-height:70vh; }
@media (prefers-color-scheme: dark) { .ck { --panel:#18212e;--panel2:#1d2836;--ink:#e7edf5;--ink2:#a3b0c2;--ink3:#6c7a8f;--hair:#2a3644;
  --ok:#3ad07f;--ok-w:#10331f;--warn:#e0a63a;--warn-w:#3a2c12;--stop:#ee6a5f;--stop-w:#3a1c19;--accent:#37c3c9;--accent-ink:#6fd8dc;--accent-w:#123138; } }
.ck h1,.ck h2,.ck p { margin:0; }
.pip { width:9px;height:9px;border-radius:50%;background:var(--ok);display:inline-block; } .pip.red{background:var(--stop);} .pip.green{background:var(--ok);}

.nav { display:flex; gap:6px; overflow-x:auto; padding:10px 12px; background:var(--panel); border-bottom:1px solid var(--hair); position:sticky; top:0; z-index:5; }
.nav-brand,.nav-foot { display:none; }
.nav-btn { flex:0 0 auto; display:flex; flex-direction:column; align-items:center; gap:2px; background:none; border:none; border-radius:10px; padding:7px 12px; cursor:pointer; color:var(--ink2); position:relative; }
.nav-btn.on { background:var(--accent-w); color:var(--accent-ink); } .nav-ico { font-size:19px; } .nav-lbl { font-size:11px; font-weight:600; }
.nav-badge { position:absolute; top:2px; right:6px; background:var(--stop); color:#fff; font-size:10px; font-weight:700; padding:1px 5px; border-radius:9px; }

.main { padding:16px; max-width:1500px; margin:0 auto; width:100%; box-sizing:border-box; }
.pane { animation:fade .18s ease; } @keyframes fade { from{opacity:0;transform:translateY(4px);} to{opacity:1;} }

.status { display:flex; align-items:center; gap:9px; font-size:14px; font-weight:600; color:var(--ink2); padding:11px 15px; background:var(--panel); border:1px solid var(--hair); border-radius:12px; margin-bottom:14px; }
.status.red { color:var(--stop); }

.tiles { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; }
.tiles.sm { grid-template-columns:repeat(2,1fr); margin-bottom:16px; }
.tile { text-align:left; background:var(--panel); border:1px solid var(--hair); border-left:4px solid var(--park); border-radius:14px; padding:16px; display:flex; flex-direction:column; gap:2px; cursor:pointer; transition:transform .1s; }
.tile:hover { transform:translateY(-2px); }
.tile.red{border-left-color:var(--stop);} .tile.green{border-left-color:var(--ok);} .tile.blue{border-left-color:var(--accent);} .tile.amber{border-left-color:var(--warn);} .tile.grey{border-left-color:var(--park);}
.t-num { font-family:var(--mono); font-weight:700; font-size:34px; line-height:1; }
.tile.red .t-num{color:var(--stop);} .tile.green .t-num{color:var(--ok);} .tile.blue .t-num{color:var(--accent);} .tile.amber .t-num{color:var(--warn);}
.t-lbl { font-size:15px; font-weight:700; margin-top:6px; } .t-desc { font-size:12px; color:var(--ink3); }
.tiles.sm .t-num { font-size:24px; } .tiles.sm .t-desc { display:none; }

.p-h { display:flex; align-items:center; gap:12px; margin-bottom:14px; } .p-h h1 { font-size:22px; letter-spacing:-.02em; }
.count,.g-count { font-family:var(--mono); font-weight:700; background:var(--accent-w); color:var(--accent-ink); padding:1px 9px; border-radius:20px; font-size:13px; }
.tabs { margin-left:auto; display:flex; gap:10px; } .tab-link,.d-links a { color:var(--accent-ink); text-decoration:none; font-size:13px; font-weight:600; }
.grp { margin-bottom:22px; } .grp h2 { display:flex; align-items:center; gap:9px; font-family:var(--mono); font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:var(--ink2); font-weight:600; margin-bottom:11px; }
.grp .g-count { font-size:11px; }
.empty { color:var(--ink3); font-size:14px; padding:4px 2px; } .empty.big { padding:30px 6px; text-align:center; font-size:15px; }

.item { display:flex; align-items:center; gap:12px; background:var(--panel); border:1px solid var(--hair); border-left:4px solid var(--park); border-radius:12px; padding:13px 15px; margin-bottom:9px; }
.item.red{border-left-color:var(--stop);} .item.blue{border-left-color:var(--accent);} .item.amber{border-left-color:var(--warn);} .item.green{border-left-color:var(--ok);} .item.grey{border-left-color:var(--park);}
.item:hover { border-color:var(--accent); }
.i-main { flex:1; min-width:0; cursor:pointer; } .i-title { font-size:14.5px; font-weight:600; letter-spacing:-.01em; }
.i-why { font-size:12.5px; color:var(--ink3); margin-top:3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.i-act { display:flex; flex-wrap:wrap; gap:7px; align-items:center; } .chev { color:var(--ink3); font-size:20px; } .fresh { font-family:var(--mono); font-size:11px; color:var(--ink3); }
.act { font-weight:600; font-size:13px; padding:8px 15px; border-radius:9px; border:1px solid var(--hair); background:var(--panel2); color:var(--ink); cursor:pointer; }
.act.sm { padding:6px 12px; font-size:12px; } .act:hover { border-color:var(--accent); } .act:disabled { opacity:.5; }
.act.accept,.act.merge { background:var(--accent); color:#fff; border-color:var(--accent); }
.done-pill { font-size:13px; font-weight:600; color:var(--ok); background:var(--ok-w); padding:6px 12px; border-radius:8px; } .done-pill.sm { font-size:12px; padding:4px 10px; }
.err { color:var(--stop); font-size:12px; }
.chip { display:inline-flex; align-items:center; gap:6px; font-family:var(--mono); font-size:11px; font-weight:600; padding:4px 9px; border-radius:20px; }
.chip .dot{width:7px;height:7px;border-radius:50%;} .chip.block{background:var(--stop-w);color:var(--stop);} .chip.block .dot{background:var(--stop);} .chip.ok{background:var(--ok-w);color:var(--ok);} .chip.ok .dot{background:var(--ok);} .chip.prog{background:var(--accent-w);color:var(--accent-ink);} .chip.prog .dot{background:var(--accent);}

.back { background:none; border:none; color:var(--accent-ink); font-weight:600; cursor:pointer; font-size:14px; padding:0 0 12px; }
.detail { background:var(--panel); border:1px solid var(--hair); border-radius:16px; padding:22px; }
.d-eyebrow { font-family:var(--mono); font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--ink3); }
.detail h1 { font-size:21px; letter-spacing:-.02em; margin:6px 0 12px; text-wrap:balance; }
.d-reason { font-size:15px; color:var(--ink2); line-height:1.6; white-space:pre-line; margin-bottom:16px; }
.d-actions { display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin:18px 0; }
.d-links { display:flex; gap:16px; margin:14px 0; }
.tech { margin-top:14px; border:1px solid var(--hair); border-radius:10px; background:var(--panel2); }
.tech summary { cursor:pointer; padding:11px 14px; font-family:var(--mono); font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:var(--ink3); }
.tech-body { padding:0 14px 12px; } .mono { font-family:var(--mono); font-size:11px; color:var(--ink3); }

@container (min-width: 780px) {
  .ck { grid-template-columns: 210px 1fr; }
  .nav { flex-direction:column; overflow:visible; border-bottom:none; border-right:1px solid var(--hair); height:100%; padding:16px 12px; gap:4px; position:sticky; top:0; align-self:start; }
  .nav-brand { display:flex; align-items:center; gap:8px; font-size:15px; padding:6px 10px 14px; }
  .nav-btn { flex-direction:row; justify-content:flex-start; gap:11px; padding:10px 12px; width:100%; } .nav-lbl { font-size:14px; } .nav-badge { position:static; margin-left:auto; }
  .nav-foot { display:flex; align-items:center; gap:8px; margin-top:auto; padding:12px 10px; font-size:12px; color:var(--ink2); }
  .tiles { grid-template-columns:repeat(3,1fr); } .tiles.sm { grid-template-columns:repeat(4,1fr); }
}
@container (min-width: 1280px) { .main { padding:26px; } .tiles { grid-template-columns:repeat(4,1fr); } }
@container (min-width: 1600px) { .tiles { grid-template-columns:repeat(6,1fr); } }
</style>
