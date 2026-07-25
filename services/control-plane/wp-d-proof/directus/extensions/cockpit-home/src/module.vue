<template>
  <private-view title="Fusion247 Cockpit">
    <div class="ck" :class="{ 'has-detail': !!detail }">

      <!-- LEFT SIDEBAR (collapses to an icon rail / drawer on narrow) -->
      <nav class="nav">
        <div class="nav-brand"><span class="pip" :class="overall.tone"></span><b>Fusion247</b></div>
        <button v-for="a in areas" :key="a.key" class="nav-btn" :class="{ on: area === a.key }" @click="go(a.key)">
          <span class="nav-ico">{{ a.icon }}</span>
          <span class="nav-lbl">{{ a.label }}</span>
          <span v-if="badge(a.key)" class="nav-badge" :class="a.tone">{{ badge(a.key) }}</span>
        </button>
        <div class="nav-foot"><span class="pip" :class="overall.tone"></span>Larry: {{ overall.larry_now || 'idle' }}</div>
      </nav>

      <!-- MAIN -->
      <main class="main">
        <!-- DETAIL (drill-down) -->
        <section v-if="detail" class="pane">
          <button class="back" @click="detail = null">← Back</button>
          <div class="detail">
            <div class="d-eyebrow">{{ detail._kind === 'attention' ? 'Needs you' : 'Output' }} · {{ moduleLabel(detail.source_module) }}</div>
            <h1>{{ detail.title }}</h1>
            <p v-if="detail.reason" class="d-reason">{{ detail.reason }}</p>
            <p v-if="detail.value" class="d-reason">{{ detail.value }}</p>

            <div v-if="detail._kind === 'attention'" class="d-actions">
              <template v-if="detail._done"><span class="done-pill">✅ {{ detail._done }} — queued</span></template>
              <template v-else>
                <button v-for="ax in (detail.actions || [])" :key="ax.key" class="act" :class="ax.key" :disabled="busy" @click="doAction(detail, ax)">{{ ax.label }}</button>
              </template>
              <span v-if="detail._error" class="err">⚠ {{ detail._error }}</span>
            </div>

            <div class="d-links">
              <a v-if="detail.evidence_url" :href="detail.evidence_url" target="_blank" rel="noopener">Open evidence / report ↗</a>
              <a v-if="detail.source_module === 'brain'" :href="reportUrl" target="_blank" rel="noopener">Your brain report ↗</a>
              <a v-if="detail.source_module === 'brain'" :href="graphUrl" target="_blank" rel="noopener">Graph explorer ↗</a>
            </div>
            <div class="d-prov"><span class="mono">{{ detail.provenance_ref }}</span></div>
          </div>
        </section>

        <!-- HOME -->
        <section v-else-if="area === 'home'" class="pane">
          <div class="banner" :class="overall.tone">
            <div class="beacon"><span></span></div>
            <div><div class="eyebrow">Overall</div><h1>{{ overall.headline || homeHeadline }}</h1><p>{{ overall.sub || homeSub }}</p></div>
          </div>
          <div class="gauges">
            <button class="gauge wait" @click="go('attention')"><span class="lbl">Needs you</span><span class="val">{{ attention.length }}</span></button>
            <button class="gauge done" @click="go('outputs')"><span class="lbl">New outputs</span><span class="val">{{ freshOutputs }}</span></button>
            <button class="gauge" :class="blocked.length ? 'block' : 'ok'" @click="go('system')"><span class="lbl">Blocked</span><span class="val">{{ blocked.length }}</span></button>
            <button class="gauge ok" @click="go('brain')"><span class="lbl">Brain learned</span><span class="val">{{ live.learned ?? '—' }}</span></button>
          </div>
          <div class="cols">
            <div class="card">
              <h2>What needs you</h2>
              <div v-if="!attention.length" class="empty">Nothing waiting on you. 🎉</div>
              <div v-for="it in attention.slice(0, 4)" :key="it.id" class="row tap" @click="open(it, 'attention')">
                <span class="prio" :class="it.priority">{{ it.priority[0].toUpperCase() }}</span>
                <div><div class="r-title">{{ it.title }}</div><div class="r-sub">{{ moduleLabel(it.source_module) }}</div></div>
                <span class="chev">›</span>
              </div>
              <button v-if="attention.length > 4" class="more" @click="go('attention')">See all {{ attention.length }} →</button>
            </div>
            <div class="card">
              <h2>Recently produced</h2>
              <div v-if="!outputs.length" class="empty">Nothing produced yet.</div>
              <div v-for="o in outputs.slice(0, 4)" :key="o.id" class="row tap" @click="open(o, 'output')">
                <span class="odot"></span>
                <div><div class="r-title">{{ o.title }}</div><div class="r-sub">{{ ago(o.produced_at) }}</div></div>
                <span class="chev">›</span>
              </div>
              <button v-if="outputs.length > 4" class="more" @click="go('outputs')">See all outputs →</button>
            </div>
          </div>
        </section>

        <!-- ATTENTION -->
        <section v-else-if="area === 'attention'" class="pane">
          <header class="p-h"><h1>Attention</h1><span class="count">{{ attention.length }}</span></header>
          <div v-if="!attention.length" class="empty big">Nothing needs you right now. Go and live your life. ❤️</div>
          <div v-for="it in attention" :key="it.id" class="att-card" :class="it.priority">
            <div class="tap att-top" @click="open(it, 'attention')">
              <span class="prio" :class="it.priority">{{ it.priority[0].toUpperCase() }}</span>
              <div class="att-body"><div class="r-title">{{ it.title }}</div><div v-if="it.reason" class="r-reason">{{ it.reason }}</div><div class="r-sub">{{ moduleLabel(it.source_module) }}</div></div>
              <span class="chev">›</span>
            </div>
            <div class="att-actions" v-if="it.actions && it.actions.length">
              <template v-if="it._done"><span class="done-pill">✅ {{ it._done }} — queued</span></template>
              <template v-else>
                <button v-for="ax in it.actions" :key="ax.key" class="act" :class="ax.key" :disabled="busy" @click.stop="doAction(it, ax)">{{ ax.label }}</button>
              </template>
              <span v-if="it._error" class="err">⚠ {{ it._error }}</span>
            </div>
          </div>
        </section>

        <!-- OUTPUTS -->
        <section v-else-if="area === 'outputs'" class="pane">
          <header class="p-h"><h1>Outputs</h1><span class="count">{{ outputs.length }}</span></header>
          <div v-if="!outputs.length" class="empty big">No results yet — feed the Brain something. 🧠</div>
          <div v-for="o in outputs" :key="o.id" class="out-card tap" @click="open(o, 'output')">
            <div class="out-top"><span class="odot"></span><div class="r-title">{{ o.title }}</div><span class="fresh">{{ ago(o.produced_at) }}</span></div>
            <div v-if="o.value" class="out-val">{{ o.value }}</div>
            <div class="out-foot"><span class="chip prog">{{ moduleLabel(o.source_module) }}</span><a v-if="o.evidence_url" :href="o.evidence_url" target="_blank" rel="noopener" @click.stop>Open ↗</a></div>
          </div>
        </section>

        <!-- BRAIN -->
        <section v-else-if="area === 'brain'" class="pane">
          <header class="p-h"><h1>Brain</h1><div class="tabs"><a :href="reportUrl" target="_blank" rel="noopener" class="tab-link">Report ↗</a><a :href="graphUrl" target="_blank" rel="noopener" class="tab-link">Galaxy ↗</a></div></header>
          <div class="cols">
            <div class="card">
              <h2>Latest "so what"</h2>
              <div v-if="!brainOutputs.length" class="empty">No insights yet.</div>
              <div v-for="o in brainOutputs" :key="o.id" class="row tap" @click="open(o, 'output')"><span class="odot"></span><div><div class="r-title">{{ o.title }}</div><div class="r-sub">{{ o.value ? o.value.slice(0,90) : '' }}</div></div><span class="chev">›</span></div>
            </div>
            <div class="card">
              <h2>Held for your review</h2>
              <div v-if="!heldItems.length" class="empty">No held decisions — the Brain's confident. ✅</div>
              <div v-for="it in heldItems" :key="it.id" class="row tap" @click="open(it, 'attention')"><span class="prio medium">?</span><div><div class="r-title">{{ it.title }}</div></div><span class="chev">›</span></div>
            </div>
            <div class="card">
              <h2>🛠 Make the Brain better</h2>
              <div v-if="!makeBetter.length" class="empty">No self-improvement candidates.</div>
              <div v-for="it in makeBetter" :key="it.id" class="row tap" @click="open(it, 'attention')"><span class="prio" :class="it.priority">↑</span><div><div class="r-title">{{ it.title }}</div></div><span class="chev">›</span></div>
            </div>
            <div class="card">
              <h2>Recently learned</h2>
              <div v-if="!learned.length" class="empty">Nothing learned yet.</div>
              <div v-for="s in learned" :key="s.id" class="row"><span class="odot"></span><div><div class="r-title">{{ s.title || s.video_id }}</div><div class="r-sub">{{ s.review_state }}</div></div></div>
            </div>
          </div>
        </section>

        <!-- SYSTEM -->
        <section v-else class="pane">
          <header class="p-h"><h1>Builds &amp; System</h1></header>
          <div class="card">
            <h2>Active work</h2>
            <div v-if="!builds.length" class="empty">No builds tracked.</div>
            <div v-for="b in builds" :key="b.id" class="build">
              <div class="build-top"><span class="bname">{{ b.name }}</span><span class="chip" :class="b.status_tone"><span class="dot"></span>{{ b.status }}</span></div>
              <div class="bgives">{{ b.gives }}</div>
              <div class="prog"><div class="track"><div class="fill" :class="b.status_tone" :style="{ width: (b.progress_pct||0) + '%' }"></div></div><span class="pct">{{ b.progress_pct||0 }}%</span></div>
              <div v-if="b.next_result" class="bnext"><span class="arrow">→</span>{{ b.next_result }}</div>
            </div>
          </div>
          <details class="tech"><summary>Technical evidence</summary><div class="tech-body"><p>Cockpit reads live MyPKA state via cp_directus. Actions run the governed intent→worker→receipt seam. {{ live.queueNote }}</p></div></details>
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
      { key: 'attention', label: 'Attention', icon: '🔔', tone: 'wait' },
      { key: 'outputs', label: 'Outputs', icon: '📤', tone: 'done' },
      { key: 'brain', label: 'Brain', icon: '🧠' },
      { key: 'system', label: 'System', icon: '🛠' },
    ];
    const area = ref('home');
    const detail = ref(null);
    const busy = ref(false);
    const attention = ref([]);
    const outputs = ref([]);
    const builds = ref([]);
    const blocked = ref([]);
    const learned = ref([]);
    const overall = ref({ tone: 'ok', headline: '', sub: '', larry_now: '' });
    const live = ref({ learned: null, queueNote: '' });

    const api = useApi();
    const get = async (path, params) => { try { const r = await api.get(path, { params }); return r?.data?.data; } catch { return null; } };

    const freshOutputs = computed(() => outputs.value.filter((o) => o.status === 'new').length);
    const brainOutputs = computed(() => outputs.value.filter((o) => o.source_module === 'brain'));
    const heldItems = computed(() => attention.value.filter((i) => i.source_type === 'held_canonicalisation'));
    const makeBetter = computed(() => attention.value.filter((i) => i.source_type === 'system_improvement'));
    const homeHeadline = computed(() => attention.value.length ? `${attention.value.length} thing${attention.value.length > 1 ? 's' : ''} need you` : 'All clear');
    const homeSub = computed(() => `${freshOutputs.value} new output${freshOutputs.value === 1 ? '' : 's'} · ${live.value.learned ?? 0} sources learned`);

    const badge = (k) => (k === 'attention' ? attention.value.length || '' : k === 'outputs' ? freshOutputs.value || '' : '');
    const moduleLabel = (m) => ({ brain: 'Brain', shopping: 'Shopping', builds: 'Builds', careerair: 'CareerAIr' }[m] || m);
    const ago = (ts) => { if (!ts) return ''; const d = (Date.now() - new Date(ts).getTime()) / 60000; if (d < 60) return `${Math.max(1, Math.round(d))}m ago`; if (d < 1440) return `${Math.round(d / 60)}h ago`; return `${Math.round(d / 1440)}d ago`; };

    const go = (k) => { detail.value = null; area.value = k; };
    const open = (item, kind) => { detail.value = { ...item, _kind: kind }; };

    async function doAction(item, ax) {
      busy.value = true; item._error = null;
      try {
        const idem = `${ax.intent}:${ax.args.candidate_id || ax.args.held_id}:${ax.key}:${Date.now()}`;
        const body = { requested_by: 'cockpit:warwick', idempotency_key: idem, ...ax.args };
        await api.post(`/items/${ax.intent}`, body);
        item._done = ax.label;
        if (detail.value && detail.value.id === item.id) detail.value._done = ax.label;
        // optimistic: drop from the live attention list
        attention.value = attention.value.filter((i) => i.id !== item.id || i._done);
      } catch (e) {
        item._error = e?.response?.data?.errors?.[0]?.message || e?.message || 'Action failed';
      } finally { busy.value = false; }
    }

    async function load() {
      const [at, ot] = await Promise.all([
        get('/items/attention_item', { filter: { status: { _eq: 'open' } }, sort: ['priority', '-updated_at'], limit: 100 }),
        get('/items/output_item', { filter: { status: { _neq: 'archived' } }, sort: ['-produced_at'], limit: 100 }),
      ]);
      attention.value = (at || []).map((x) => ({ ...x, actions: Array.isArray(x.actions) ? x.actions : (x.actions ? JSON.parse(x.actions) : []) }));
      outputs.value = ot || [];
      builds.value = (await get('/items/build', { sort: ['sort'], limit: 50 })) || [];
      blocked.value = builds.value.filter((b) => b.status_tone === 'block');
      learned.value = (await get('/items/youtube_source', { sort: ['-updated_at'], limit: 12 })) || [];
      const os = await get('/items/overall_state', { limit: 1 }); if (os && os[0]) overall.value = { ...overall.value, ...os[0] };
      const reg = await get('/items/youtube_source', { aggregate: { count: '*' } }); if (reg && reg[0]) live.value.learned = Number(reg[0].count) || learned.value.length;
      live.value.queueNote = `${attention.value.length} open · ${outputs.value.length} outputs`;
    }

    onMounted(load);
    return { areas, area, detail, busy, attention, outputs, builds, blocked, learned, overall, live, reportUrl, graphUrl,
      freshOutputs, brainOutputs, heldItems, makeBetter, homeHeadline, homeSub, badge, moduleLabel, ago, go, open, doAction };
  },
};
</script>

<style scoped>
.ck { container-type: inline-size; display: grid; grid-template-columns: 1fr; gap: 0;
  --ok:#1f9d57;--ok-w:#e4f4ea;--warn:#b26a12;--warn-w:#f8ecda;--stop:#c1453c;--stop-w:#f8e5e3;
  --accent:#0e7c86;--accent-ink:#0a5c64;--accent-w:#e2f1f2;--park:#66748a;
  --panel:#fff;--panel2:#f7f9fc;--ink:#16202e;--ink2:#47566b;--ink3:#768498;--hair:#e2e7ee;
  --mono:ui-monospace,"Cascadia Code",Consolas,monospace; color:var(--ink);
  font-family:var(--v-font-family,system-ui,sans-serif); min-height:70vh; }
@media (prefers-color-scheme: dark) { .ck { --panel:#18212e;--panel2:#1d2836;--ink:#e7edf5;--ink2:#a3b0c2;--ink3:#6c7a8f;--hair:#2a3644;
  --ok:#3ad07f;--ok-w:#10331f;--warn:#e0a63a;--warn-w:#3a2c12;--stop:#ee6a5f;--stop-w:#3a1c19;--accent:#37c3c9;--accent-ink:#6fd8dc;--accent-w:#123138; } }
.ck h1,.ck h2,.ck p { margin:0; }
.pip { width:9px;height:9px;border-radius:50%;background:var(--ok);display:inline-block; }
.pip.warn{background:var(--warn);} .pip.block{background:var(--stop);}

/* NAV — mobile default = horizontal icon rail (drawer feel), NOT a wasted full sidebar */
.nav { display:flex; gap:6px; overflow-x:auto; padding:10px 12px; background:var(--panel); border-bottom:1px solid var(--hair); position:sticky; top:0; z-index:5; }
.nav-brand,.nav-foot { display:none; }
.nav-btn { flex:0 0 auto; display:flex; flex-direction:column; align-items:center; gap:2px; background:none; border:none; border-radius:10px; padding:7px 12px; cursor:pointer; color:var(--ink2); position:relative; }
.nav-btn.on { background:var(--accent-w); color:var(--accent-ink); }
.nav-ico { font-size:18px; } .nav-lbl { font-size:11px; font-weight:600; }
.nav-badge { position:absolute; top:2px; right:6px; background:var(--accent); color:#fff; font-size:10px; font-weight:700; padding:1px 5px; border-radius:9px; }
.nav-badge.wait{background:var(--accent);} .nav-badge.done{background:var(--ok);}

.main { padding:16px; max-width:1500px; margin:0 auto; width:100%; box-sizing:border-box; }
.pane { animation:fade .2s ease; } @keyframes fade { from{opacity:0;transform:translateY(4px);} to{opacity:1;} }
.p-h { display:flex; align-items:center; gap:12px; margin-bottom:14px; }
.p-h h1 { font-size:22px; letter-spacing:-.02em; }
.count { font-family:var(--mono); font-weight:700; background:var(--accent-w); color:var(--accent-ink); padding:2px 10px; border-radius:20px; font-size:14px; }
.tabs { margin-left:auto; display:flex; gap:8px; } .tab-link,.d-links a,.out-foot a { color:var(--accent-ink); text-decoration:none; font-size:13px; font-weight:600; }

.banner { display:grid; grid-template-columns:auto 1fr; gap:14px; align-items:center; background:var(--panel); border:1px solid var(--hair); border-radius:16px; padding:18px; position:relative; overflow:hidden; }
.banner::before { content:""; position:absolute; left:0; top:0; bottom:0; width:5px; background:var(--ok); }
.banner.warn::before{background:var(--warn);} .banner.block::before{background:var(--stop);}
.beacon { width:42px;height:42px;border-radius:50%;background:var(--ok-w);display:grid;place-items:center; } .beacon span{width:14px;height:14px;border-radius:50%;background:var(--ok);}
.banner.warn .beacon{background:var(--warn-w);} .banner.warn .beacon span{background:var(--warn);}
.eyebrow { font-family:var(--mono); font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--ink3); }
.banner h1 { font-size:20px; letter-spacing:-.02em; margin:2px 0; } .banner p { color:var(--ink2); font-size:14px; }

.gauges { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; margin:14px 0; }
.gauge { text-align:left; background:var(--panel); border:1px solid var(--hair); border-radius:12px; padding:12px 13px; display:flex; flex-direction:column; gap:4px; cursor:pointer; }
.gauge .lbl { font-family:var(--mono); font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:var(--ink3); }
.gauge .val { font-family:var(--mono); font-weight:700; font-size:26px; line-height:1; }
.gauge.wait .val{color:var(--accent);} .gauge.done .val{color:var(--ok);} .gauge.block .val{color:var(--stop);} .gauge.ok .val{color:var(--ok);}

.cols { display:grid; grid-template-columns:1fr; gap:14px; }
.card { background:var(--panel); border:1px solid var(--hair); border-radius:14px; padding:16px 18px; }
.card h2 { font-family:var(--mono); font-size:12px; letter-spacing:.09em; text-transform:uppercase; color:var(--ink2); font-weight:600; margin-bottom:12px; }
.empty { color:var(--ink3); font-size:14px; } .empty.big { padding:30px 6px; text-align:center; font-size:15px; }

.row { display:grid; grid-template-columns:auto 1fr auto; gap:12px; align-items:center; padding:11px 0; border-top:1px solid var(--hair); }
.row:first-of-type { border-top:none; } .tap { cursor:pointer; } .tap:hover .r-title { color:var(--accent-ink); }
.r-title { font-size:14.5px; font-weight:600; letter-spacing:-.01em; } .r-sub { font-size:12px; color:var(--ink3); margin-top:2px; }
.r-reason { font-size:13px; color:var(--ink2); margin-top:4px; white-space:pre-line; }
.chev { color:var(--ink3); font-size:20px; } .more { margin-top:10px; background:none; border:none; color:var(--accent-ink); font-weight:600; cursor:pointer; font-size:13px; padding:0; }
.prio { font-family:var(--mono); font-weight:700; width:26px; height:26px; border-radius:8px; display:grid; place-items:center; font-size:13px; background:var(--warn-w); color:var(--warn); }
.prio.high{background:var(--stop-w);color:var(--stop);} .prio.medium{background:var(--warn-w);color:var(--warn);} .prio.low{background:var(--accent-w);color:var(--accent-ink);}
.odot { width:9px;height:9px;border-radius:50%;background:var(--ok); }

.att-card { background:var(--panel); border:1px solid var(--hair); border-radius:14px; padding:14px 16px; margin-bottom:12px; border-left:4px solid var(--warn); }
.att-card.high{border-left-color:var(--stop);} .att-card.low{border-left-color:var(--accent);}
.att-top { display:grid; grid-template-columns:auto 1fr auto; gap:12px; align-items:start; }
.att-actions { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:12px; padding-top:12px; border-top:1px solid var(--hair); }
.act { font-weight:600; font-size:13px; padding:8px 16px; border-radius:9px; border:1px solid var(--hair); background:var(--panel2); color:var(--ink); cursor:pointer; }
.act:hover { border-color:var(--accent); } .act:disabled { opacity:.5; cursor:default; }
.act.accept,.act.merge { background:var(--accent); color:#fff; border-color:var(--accent); } .act.decline,.act.keep { background:var(--panel2); }
.done-pill { font-size:13px; font-weight:600; color:var(--ok); background:var(--ok-w); padding:6px 12px; border-radius:8px; }
.err { color:var(--stop); font-size:12px; }

.out-card { background:var(--panel); border:1px solid var(--hair); border-radius:14px; padding:15px 17px; margin-bottom:12px; cursor:pointer; }
.out-card:hover { border-color:var(--accent); } .out-top { display:flex; align-items:center; gap:10px; }
.fresh { margin-left:auto; font-family:var(--mono); font-size:11px; color:var(--ink3); }
.out-val { font-size:13.5px; color:var(--ink2); margin:8px 0 10px; line-height:1.5; }
.out-foot { display:flex; align-items:center; justify-content:space-between; }

.chip { display:inline-flex; align-items:center; gap:6px; font-family:var(--mono); font-size:11px; font-weight:600; padding:4px 9px; border-radius:20px; }
.chip .dot{width:7px;height:7px;border-radius:50%;} .chip.prog{background:var(--accent-w);color:var(--accent-ink);} .chip.ok{background:var(--ok-w);color:var(--ok);} .chip.ok .dot{background:var(--ok);}
.chip.warn{background:var(--warn-w);color:var(--warn);} .chip.warn .dot{background:var(--warn);} .chip.block{background:var(--stop-w);color:var(--stop);} .chip.block .dot{background:var(--stop);} .chip.prog .dot{background:var(--accent);}

.build { padding:13px 0; border-top:1px solid var(--hair); } .build:first-of-type{border-top:none;}
.build-top { display:flex; align-items:center; justify-content:space-between; gap:10px; } .bname{font-weight:700;font-size:15px;}
.bgives { font-size:13px; color:var(--ink2); margin:3px 0 8px; } .prog{display:flex;align-items:center;gap:10px;}
.track { flex:1; height:7px; border-radius:4px; background:var(--hair); overflow:hidden; } .fill{height:100%;border-radius:4px;background:var(--accent);}
.fill.ok{background:var(--ok);} .fill.block{background:var(--stop);} .pct{font-family:var(--mono);font-size:12px;font-weight:700;}
.bnext { font-size:13px; color:var(--ink2); margin-top:7px; } .bnext .arrow{color:var(--accent);font-weight:700;margin-right:5px;}

.back { background:none; border:none; color:var(--accent-ink); font-weight:600; cursor:pointer; font-size:14px; padding:0 0 12px; }
.detail { background:var(--panel); border:1px solid var(--hair); border-radius:16px; padding:22px; }
.d-eyebrow { font-family:var(--mono); font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--ink3); }
.detail h1 { font-size:21px; letter-spacing:-.02em; margin:6px 0 12px; text-wrap:balance; }
.d-reason { font-size:15px; color:var(--ink2); line-height:1.6; white-space:pre-line; margin-bottom:16px; }
.d-actions { display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin:18px 0; }
.d-links { display:flex; flex-wrap:wrap; gap:16px; margin:16px 0 12px; padding-top:14px; border-top:1px solid var(--hair); }
.d-prov { margin-top:8px; } .mono { font-family:var(--mono); font-size:11px; color:var(--ink3); }
.tech { margin-top:16px; border:1px solid var(--hair); border-radius:12px; background:var(--panel2); }
.tech summary { cursor:pointer; padding:12px 16px; font-family:var(--mono); font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:var(--ink3); }
.tech-body { padding:0 16px 14px; font-size:13px; color:var(--ink2); }

/* YOGA / SURFACE — real left sidebar + two-column working view */
@container (min-width: 780px) {
  .ck { grid-template-columns: 210px 1fr; }
  .nav { flex-direction:column; overflow:visible; border-bottom:none; border-right:1px solid var(--hair); height:100%; padding:16px 12px; gap:4px; position:sticky; top:0; align-self:start; }
  .nav-brand { display:flex; align-items:center; gap:8px; font-size:15px; padding:6px 10px 14px; }
  .nav-btn { flex-direction:row; justify-content:flex-start; gap:11px; padding:10px 12px; width:100%; }
  .nav-lbl { font-size:14px; } .nav-badge { position:static; margin-left:auto; }
  .nav-foot { display:flex; align-items:center; gap:8px; margin-top:auto; padding:12px 10px; font-size:12px; color:var(--accent-ink); }
  .gauges { grid-template-columns:repeat(4,1fr); }
  .cols { grid-template-columns:1fr 1fr; }
}
/* 28-INCH — richer multi-column */
@container (min-width: 1280px) {
  .main { padding:26px; } .cols { grid-template-columns:repeat(2,1fr); }
  .att-card, .out-card { max-width:none; }
}
@container (min-width: 1600px) { .cols { grid-template-columns:repeat(3,1fr); } }
</style>
