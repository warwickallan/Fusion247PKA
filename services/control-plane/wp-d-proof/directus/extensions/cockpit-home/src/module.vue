<template>
  <private-view title="Fusion247 Cockpit">
    <div class="cockpit-root">

      <!-- OVERALL STATE — Are things on track? -->
      <section class="banner" :class="overall.tone">
        <div class="beacon"><span></span></div>
        <div class="banner-txt">
          <div class="eyebrow">Overall</div>
          <h1>{{ overall.headline }}</h1>
          <p>{{ overall.sub }}</p>
        </div>
        <div class="banner-side">
          <div class="stamp">updated {{ nowLabel }}</div>
          <div class="larry-now"><span class="pip"></span>Larry now: {{ overall.larry_now }}</div>
        </div>
      </section>

      <!-- KEY NUMBERS -->
      <section class="gauges">
        <div class="gauge" :class="overall.tone"><span class="lbl">On track?</span><span class="val sm">{{ overall.word }}</span></div>
        <div class="gauge wait"><span class="lbl">Needs you</span><span class="val">{{ decisions.length }}</span></div>
        <div class="gauge" :class="blocked.length ? 'block' : ''"><span class="lbl">Blocked</span><span class="val">{{ blocked.length }}</span></div>
        <div class="gauge done"><span class="lbl">Recent wins</span><span class="val">{{ movement.length }}</span></div>
        <div class="gauge done"><span class="lbl">Regulars live</span><span class="val">{{ live.regulars ?? '—' }}</span></div>
      </section>

      <div class="grid">
        <!-- WHAT NEEDS ATTENTION (max 3, action-focused) -->
        <section class="block-card span-2">
          <div class="sec-h"><h2>What needs your attention</h2></div>
          <div v-if="!decisions.length" class="empty">Nothing waiting on you right now.</div>
          <div v-for="(d, i) in decisions" :key="d.id" class="decision">
            <div class="pri">{{ i + 1 }}</div>
            <div class="decision-body">
              <h3>{{ d.title }}</h3>
              <p class="why" v-if="d.why"><b>Why:</b> {{ d.why }}</p>
              <p class="action"><span class="tag">Do</span>{{ d.recommendation }}</p>
              <p class="cost" v-if="d.cost">If not: {{ d.cost }}</p>
            </div>
          </div>
        </section>

        <!-- ACTIVE WORK — What happens next? -->
        <section class="block-card span-2">
          <div class="sec-h"><h2>Active work</h2></div>
          <div v-for="b in builds" :key="b.id" class="build">
            <div class="build-top">
              <span class="bname">{{ b.name }}</span>
              <span class="chip" :class="b.status_tone"><span class="dot"></span>{{ b.status }}</span>
            </div>
            <div class="bgives">{{ b.gives }}</div>
            <div class="prog"><div class="track"><div class="fill" :class="b.status_tone" :style="{ width: b.progress_pct + '%' }"></div></div><span class="pct">{{ b.progress_pct }}%</span></div>
            <div class="bnext"><span class="arrow">→</span>{{ b.next_result }}</div>
          </div>
        </section>

        <!-- WHAT FINISHED -->
        <section class="block-card">
          <div class="sec-h"><h2>Recently finished</h2></div>
          <div class="feed">
            <div v-for="m in movement" :key="m.id" class="fitem"><span class="fdot" :class="m.tone"></span><span>{{ m.text }}</span></div>
          </div>
        </section>

        <!-- BY AREA (domain summaries) — progressive disclosure, desktop+ -->
        <section class="block-card disclosure-lg">
          <div class="sec-h"><h2>By area</h2></div>
          <div v-for="dm in domains" :key="dm.id" class="domain">
            <span class="chip" :class="dm.tone"><span class="dot"></span>{{ dm.domain }}</span>
            <span class="dhead">{{ dm.headline }}</span>
          </div>
        </section>
      </div>

      <!-- TECHNICAL EVIDENCE — available, not dominating -->
      <details class="tech">
        <summary>Technical evidence</summary>
        <div class="tech-body">
          <p>The delivery detail lives here, deliberately out of the main view.</p>
          <ul>
            <li><b>Delivery PR:</b> #55 — live Directus cockpit (real Regulars + write-back + MyPKA migrations)</li>
            <li><b>Branch:</b> build-014/directus-live-cockpit</li>
            <li><b>Assurance:</b> two independent Codex reviews; write-back proven synthetic-first (15/15 + 8/8 tailnet)</li>
            <li><b>Data:</b> live from MyPKA Supabase — {{ live.queueNote }}</li>
          </ul>
        </div>
      </details>

    </div>
  </private-view>
</template>

<script>
import { useApi } from '@directus/extensions-sdk';
import { ref, onMounted } from 'vue';

export default {
  setup() {
    const overall = ref({ tone: 'ok', word: 'On track', headline: 'Loading…', sub: '', larry_now: '' });
    const builds = ref([]);
    const decisions = ref([]);
    const movement = ref([]);
    const domains = ref([]);
    const blocked = ref([]);
    const live = ref({ regulars: null, queueNote: 'live from your data' });
    const nowLabel = ref('');

    onMounted(async () => {
      try { nowLabel.value = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { nowLabel.value = 'today'; }
      const api = useApi();
      const get = async (path, params) => { try { const r = await api.get(path, { params }); return r?.data?.data; } catch { return null; } };

      const os = await get('/items/overall_state', { limit: 1 });
      if (os && os[0]) overall.value = os[0];
      builds.value = (await get('/items/build', { sort: ['sort'], limit: 50 })) || [];
      blocked.value = builds.value.filter((b) => b.status_tone === 'block');
      decisions.value = (await get('/items/decision', { filter: { resolved: { _eq: false } }, sort: ['sort'], limit: 3 })) || [];
      movement.value = (await get('/items/movement', { sort: ['-happened_at'], limit: 8 })) || [];
      domains.value = (await get('/items/domain_summary', { sort: ['sort'], limit: 20 })) || [];

      const reg = await get('/items/regulars', { aggregate: { count: '*' } });
      if (reg && reg[0]) live.value.regulars = Number(reg[0].count) || null;
      const q = await get('/items/command_request', { aggregate: { count: '*' }, groupBy: ['status'] });
      if (q) {
        const pending = q.find((x) => x.status === 'requested')?.count ?? 0;
        const done = q.find((x) => x.status === 'done')?.count ?? 0;
        live.value.queueNote = `write-back queue: ${pending} pending, ${done} done`;
      }
    });

    return { overall, builds, decisions, movement, domains, blocked, live, nowLabel };
  },
};
</script>

<style scoped>
.cockpit-root {
  container-type: inline-size;
  --ok:#1f9d57;--ok-w:#e4f4ea;--warn:#b26a12;--warn-w:#f8ecda;--stop:#c1453c;--stop-w:#f8e5e3;
  --park:#66748a;--park-w:#eceff4;--accent:#0e7c86;--accent-ink:#0a5c64;--accent-w:#e2f1f2;
  --panel:#fff;--panel2:#f7f9fc;--ink:#16202e;--ink2:#47566b;--ink3:#768498;--hair:#e2e7ee;
  --mono: ui-monospace,"Cascadia Code",Consolas,monospace;
  max-width: 1600px; margin: 0 auto; padding: 20px; color: var(--ink);
  font-family: var(--v-font-family, system-ui, sans-serif);
}
@media (prefers-color-scheme: dark) {
  .cockpit-root { --panel:#18212e;--panel2:#1d2836;--ink:#e7edf5;--ink2:#a3b0c2;--ink3:#6c7a8f;--hair:#2a3644;
    --ok:#3ad07f;--ok-w:#10331f;--warn:#e0a63a;--warn-w:#3a2c12;--stop:#ee6a5f;--stop-w:#3a1c19;--park:#8b96a8;--park-w:#222c3a;--accent:#37c3c9;--accent-ink:#6fd8dc;--accent-w:#123138; }
}
.cockpit-root h1,.cockpit-root h2,.cockpit-root h3,.cockpit-root p { margin: 0; }

/* OVERALL banner */
.banner { display: grid; grid-template-columns: auto 1fr; gap: 14px; align-items: center; background: var(--panel); border: 1px solid var(--hair); border-radius: 16px; padding: 18px; position: relative; overflow: hidden; }
.banner::before { content:""; position:absolute; left:0; top:0; bottom:0; width:5px; background: var(--ok); }
.banner.warn::before { background: var(--warn); } .banner.block::before { background: var(--stop); }
.beacon { width:42px; height:42px; border-radius:50%; background: var(--ok-w); display:grid; place-items:center; margin-left:4px; }
.banner.warn .beacon { background: var(--warn-w); } .banner.block .beacon { background: var(--stop-w); }
.beacon span { width:14px; height:14px; border-radius:50%; background: var(--ok); }
.banner.warn .beacon span { background: var(--warn); } .banner.block .beacon span { background: var(--stop); }
.eyebrow { font-family: var(--mono); font-size:10px; letter-spacing:.1em; text-transform:uppercase; color: var(--ink3); }
.banner h1 { font-size:20px; letter-spacing:-.02em; text-wrap:balance; margin:2px 0; }
.banner p { color: var(--ink2); font-size:14px; max-width:64ch; }
.banner-side { display:none; }
.stamp { font-family: var(--mono); font-size:11px; color: var(--ink3); }
.larry-now { display:flex; align-items:center; gap:7px; font-size:12px; color: var(--accent-ink); margin-top:4px; }
.larry-now .pip { width:8px; height:8px; border-radius:50%; background: var(--accent); }

/* GAUGES */
.gauges { display:grid; grid-template-columns: repeat(2,1fr); gap:10px; margin:16px 0; }
.gauge { background: var(--panel); border:1px solid var(--hair); border-radius:12px; padding:12px 13px; display:flex; flex-direction:column; gap:4px; }
.gauge .lbl { font-family: var(--mono); font-size:10px; letter-spacing:.08em; text-transform:uppercase; color: var(--ink3); }
.gauge .val { font-family: var(--mono); font-weight:700; font-size:26px; line-height:1; }
.gauge .val.sm { font-size:16px; }
.gauge.ok .val{color:var(--ok);} .gauge.wait .val{color:var(--accent);} .gauge.block .val{color:var(--stop);} .gauge.done .val{color:var(--ok);}

/* GRID + cards */
.grid { display:grid; grid-template-columns: 1fr; gap:14px; }
.block-card { background: var(--panel); border:1px solid var(--hair); border-radius:14px; padding:16px 18px; }
.sec-h h2 { font-family: var(--mono); font-size:12px; letter-spacing:.09em; text-transform:uppercase; color: var(--ink2); font-weight:600; margin-bottom:12px; }
.empty { color: var(--ink3); font-size:14px; }

/* decisions — touch-friendly, action-focused */
.decision { display:grid; grid-template-columns:auto 1fr; gap:13px; padding:14px 0; border-top:1px solid var(--hair); }
.decision:first-of-type { border-top:none; }
.pri { font-family: var(--mono); font-weight:700; width:28px; height:28px; border-radius:8px; display:grid; place-items:center; background: var(--warn-w); color: var(--warn); }
.decision h3 { font-size:15.5px; letter-spacing:-.01em; text-wrap:balance; margin-bottom:6px; }
.why { font-size:13px; color: var(--ink2); margin-bottom:6px; } .why b { color: var(--ink); }
.action { font-size:14px; margin-bottom:5px; }
.action .tag { font-family: var(--mono); font-size:10px; letter-spacing:.05em; text-transform:uppercase; color:#fff; background: var(--accent); padding:3px 8px; border-radius:5px; margin-right:8px; }
.cost { font-size:12px; color: var(--ink3); font-style:italic; }

/* builds */
.build { padding:13px 0; border-top:1px solid var(--hair); }
.build:first-of-type { border-top:none; }
.build-top { display:flex; align-items:center; justify-content:space-between; gap:10px; }
.bname { font-weight:700; font-size:15px; }
.bgives { font-size:13px; color: var(--ink2); margin:3px 0 8px; }
.prog { display:flex; align-items:center; gap:10px; }
.track { flex:1; height:7px; border-radius:4px; background: var(--hair); overflow:hidden; }
.fill { height:100%; border-radius:4px; background: var(--accent); }
.fill.ok{background:var(--ok);}.fill.warn{background:var(--warn);}.fill.prog{background:var(--accent);}.fill.park{background:var(--park);}
.pct { font-family: var(--mono); font-size:12px; font-weight:700; }
.bnext { font-size:13px; color: var(--ink2); margin-top:7px; }
.bnext .arrow { color: var(--accent); font-weight:700; margin-right:5px; }

/* chips */
.chip { display:inline-flex; align-items:center; gap:6px; font-family: var(--mono); font-size:11px; font-weight:600; padding:4px 9px; border-radius:20px; white-space:nowrap; }
.chip .dot { width:7px; height:7px; border-radius:50%; }
.chip.ok{background:var(--ok-w);color:var(--ok);}.chip.ok .dot{background:var(--ok);}
.chip.warn{background:var(--warn-w);color:var(--warn);}.chip.warn .dot{background:var(--warn);}
.chip.prog{background:var(--accent-w);color:var(--accent-ink);}.chip.prog .dot{background:var(--accent);}
.chip.park{background:var(--park-w);color:var(--park);}.chip.park .dot{background:var(--park);}
.chip.block{background:var(--stop-w);color:var(--stop);}.chip.block .dot{background:var(--stop);}

/* feed + domains */
.feed { display:flex; flex-direction:column; }
.fitem { display:grid; grid-template-columns:auto 1fr; gap:11px; padding:9px 0; border-bottom:1px solid var(--hair); font-size:13.5px; align-items:start; }
.fitem:last-child { border-bottom:none; }
.fdot { width:8px; height:8px; border-radius:50%; margin-top:6px; background: var(--ok); }
.fdot.warn{background:var(--warn);}.fdot.block{background:var(--stop);}
.fitem:nth-child(n+4) { display:none; }        /* mobile progressive disclosure: 3 wins */
.domain { display:flex; align-items:center; gap:10px; padding:9px 0; border-bottom:1px solid var(--hair); font-size:13.5px; }
.domain:last-child { border-bottom:none; } .dhead { color: var(--ink2); }

/* technical evidence — collapsed, quiet */
.tech { margin-top:16px; border:1px solid var(--hair); border-radius:12px; background: var(--panel2); }
.tech summary { cursor:pointer; padding:12px 16px; font-family: var(--mono); font-size:11px; letter-spacing:.08em; text-transform:uppercase; color: var(--ink3); }
.tech-body { padding:0 16px 14px; font-size:13px; color: var(--ink2); }
.tech-body ul { margin:8px 0 0; padding-left:18px; } .tech-body li { margin:3px 0; }
.disclosure-lg { display:none; }

/* ---- TABLET / LAPTop (Yoga, Surface): two-column PM view ---- */
@container (min-width: 720px) {
  .gauges { grid-template-columns: repeat(5,1fr); }
  .banner { grid-template-columns:auto 1fr auto; } .banner-side { display:block; text-align:right; }
  .grid { grid-template-columns: 1fr 1fr; }
  .span-2 { grid-column: span 2; }
  .fitem:nth-child(n+4) { display:grid; }        /* show more wins on wider screens */
}

/* ---- 28-INCH MONITOR: expanded multi-column + more detail ---- */
@container (min-width: 1200px) {
  .cockpit-root { padding:28px; }
  .grid { grid-template-columns: repeat(3, 1fr); align-items:start; }
  .span-2 { grid-column: span 1; }               /* attention + active become their own columns */
  .disclosure-lg { display:block; }              /* domain summaries appear */
  .banner h1 { font-size:23px; }
}
@container (min-width: 1600px) {
  .grid { grid-template-columns: 1.1fr 1.1fr 1fr 1fr; }
}
</style>
