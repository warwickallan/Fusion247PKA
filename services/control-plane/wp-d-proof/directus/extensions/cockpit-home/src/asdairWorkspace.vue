<template>
  <div class="aw">
    <!-- ===== HEADER: which shop, what stage ===== -->
    <header class="aw-h">
      <div class="aw-h-main">
        <div class="aw-eyebrow">Apps · Asdair</div>
        <h1>Details</h1>
      </div>
      <div class="aw-h-act">
        <select v-if="shops.length" class="aw-sel" :value="handle" @change="pick($event.target.value)">
          <option v-for="s in shops" :key="s.id" :value="String(s.id)">{{ s.shop_ref }} · {{ s.status }}</option>
        </select>
        <button class="aw-btn" :disabled="busy" @click="refresh">Refresh</button>
      </div>
    </header>

    <!-- ===== CONNECTION / ERROR ===== -->
    <div v-if="err" class="aw-note stop">
      <b>Can't read the shop.</b> {{ err }}
      <div class="aw-sub">Reading from <span class="aw-mono">{{ base }}</span>. Nothing is shown rather than a guess.</div>
    </div>
    <div v-else-if="loading" class="aw-note">Reading durable state…</div>
    <div v-else-if="data && data.ok === false" class="aw-note">
      <b>{{ data.message || 'Nothing to show yet.' }}</b>
    </div>

    <template v-if="data && data.ok">
      <!-- ===== 1. SHOP + STATUS ===== -->
      <section class="aw-card">
        <div class="aw-top">
          <div>
            <div class="aw-eyebrow">Shop</div>
            <div class="aw-big">{{ data.shop.shop_ref_display }}</div>
            <div class="aw-sub">{{ data.shop.stage_label_display }}</div>
          </div>
          <span class="aw-chip" :class="stageTone">{{ data.shop.stage_display }}</span>
        </div>

        <ol v-if="stages.length" class="aw-rail">
          <li v-for="s in stages" :key="s" :class="railClass(s)">{{ s }}</li>
        </ol>

        <div class="aw-kv">
          <div><span>Lines</span><b>{{ data.shop.lines_summary.total_display }}</b></div>
          <div><span>Resolved</span><b>{{ data.shop.lines_summary.resolved_display }}</b></div>
          <div><span>Still open</span><b>{{ data.shop.lines_summary.open_display }}</b></div>
          <div><span>Needs review</span><b>{{ data.shop.needs_review_display }}</b></div>
          <div><span>Updated</span><b>{{ data.shop.updated_at_display }}</b></div>
        </div>

        <div v-if="data.shop.failure" class="aw-note stop">
          <b>Stopped:</b> {{ data.shop.failure.description_display }}
          <span class="aw-sub">at {{ data.shop.failure.occurred_at_display }} · failures so far {{ data.shop.failure.failure_count_display }}</span>
        </div>

        <div class="aw-acts">
          <button class="aw-btn go" :disabled="busy" @click="run('buildShop')">Build this shop</button>
          <button class="aw-btn" :disabled="busy" @click="run('getStatus')">View status</button>
          <button v-if="data.shop.failure && data.shop.failure.resumable" class="aw-btn" :disabled="busy" @click="run('retryStage')">Retry the failed step</button>
          <button class="aw-btn stop" :disabled="busy" @click="confirmCancel">Cancel this shop</button>
        </div>

        <details class="aw-fold">
          <summary>Timeline ({{ data.timeline.length }})</summary>
          <div v-if="!data.timeline.length" class="aw-empty">No events recorded.</div>
          <div v-for="(e, i) in data.timeline" :key="i" class="aw-ev" :class="{ bad: e.is_failure }">
            <span class="aw-mono">{{ e.occurred_at_display }}</span>
            <span>{{ e.description_display }}</span>
            <span class="aw-sub">{{ e.from_display }} → {{ e.to_display }}</span>
          </div>
        </details>
      </section>

      <!-- ===== 2. ORIGINAL IMAGE / RAW TEXT ===== -->
      <section class="aw-card">
        <h2>What arrived</h2>
        <div class="aw-sub">Always retained. This is what everything below was produced from.</div>
        <div class="aw-kv">
          <div><span>Arrived as</span><b>{{ data.evidence.source_kind_display }}</b></div>
          <div><span>Transcribed by</span><b>{{ data.evidence.transcript_model_display }}</b></div>
          <div><span>Confidence</span><b>{{ data.evidence.transcript_confidence_display }}</b></div>
        </div>
        <div v-if="data.evidence.has_media" class="aw-media">
          <img v-if="!imgFailed" :src="mediaSrc" alt="The original shopping list" @error="imgFailed = true" />
          <div v-else class="aw-note">
            Retained at <span class="aw-mono">{{ data.evidence.raw_media_path_display }}</span> — not served from here.
          </div>
        </div>
        <details v-if="data.evidence.raw_text_display !== 'unknown'" class="aw-fold" open>
          <summary>Raw text</summary><pre class="aw-pre">{{ data.evidence.raw_text_display }}</pre>
        </details>
        <details v-if="data.evidence.transcript_display !== 'unknown'" class="aw-fold" open>
          <summary>Transcript</summary><pre class="aw-pre">{{ data.evidence.transcript_display }}</pre>
        </details>
      </section>

      <!-- ===== 3 + 4. CATALOGUE-GROUNDED INTERPRETATION (editable) ===== -->
      <section class="aw-card">
        <h2>What we think it says</h2>
        <div class="aw-sub">
          Read against your own catalogue ({{ data.interpretation.catalogue_size_display }} products). A matched line
          shows the product name and id from our database — never a name a model made up.
        </div>
        <div class="aw-tally">
          <span class="aw-pill ok">matched {{ data.interpretation.tally.matched }}</span>
          <span class="aw-pill warn">needs you {{ data.interpretation.tally.needs_confirmation }}</span>
          <span class="aw-pill">new item {{ data.interpretation.tally.unmatched_new_item }}</span>
          <span class="aw-pill">unreadable {{ data.interpretation.tally.unreadable }}</span>
          <span class="aw-pill warn">duplicate? {{ data.interpretation.tally.possible_duplicate }}</span>
        </div>

        <div v-if="!data.interpretation.lines.length" class="aw-empty">No lines yet — the list has not been read.</div>

        <div v-for="l in data.interpretation.lines" :key="'l' + l.line_no + '-' + l.list_item_id" class="aw-line" :class="lineTone(l)">
          <div class="aw-line-h">
            <span class="aw-no">{{ l.line_no }}</span>
            <div class="aw-line-main">
              <div class="aw-read">"{{ l.raw_reading_display }}"</div>
              <div class="aw-canon">
                <b>{{ l.canonical_product_name_display }}</b>
                <span class="aw-mono">regular #{{ l.matched_regular_id_display }}</span>
                <span v-if="l.asda_product_id_display !== 'unknown'" class="aw-mono">ASDA {{ l.asda_product_id_display }}</span>
              </div>
              <div class="aw-sub">
                qty {{ l.quantity_display }} · confidence {{ l.confidence_display }} · basis {{ l.match_basis_display }}
              </div>
              <div v-for="(w, i) in l.integrity_warnings" :key="i" class="aw-warn">{{ w }}</div>
            </div>
            <span class="aw-pill" :class="lineTone(l)">{{ l.status_label }}</span>
          </div>

          <div v-if="l.alternatives.length" class="aw-alts">
            <span class="aw-sub">Alternatives:</span>
            <span v-for="(a, i) in l.alternatives" :key="i" class="aw-alt">
              {{ a.name_display }}<span v-if="a.from_catalogue" class="aw-mono"> #{{ a.regular_id_display }}</span>
            </span>
          </div>

          <button class="aw-link" @click="toggleEdit(l)">{{ editing[l.list_item_id] ? 'Close' : 'Correct this line' }}</button>

          <div v-if="editing[l.list_item_id]" class="aw-edit">
            <label>
              <span>Product</span>
              <select v-model="edits[l.list_item_id].matched_regular_id">
                <option value="">— leave as it is —</option>
                <option v-for="(a, i) in catalogueChoices(l)" :key="i" :value="String(a.regular_id_display)">
                  {{ a.name_display }} (#{{ a.regular_id_display }})
                </option>
              </select>
            </label>
            <label><span>Quantity</span><input type="number" min="0" v-model="edits[l.list_item_id].quantity" /></label>
            <label class="aw-cb"><input type="checkbox" v-model="edits[l.list_item_id].new_item" /><span>This is a new item we don't stock yet</span></label>
            <label><span>Note</span><input type="text" v-model="edits[l.list_item_id].note" placeholder="what it actually says" /></label>
            <div class="aw-acts">
              <button class="aw-btn go" :disabled="busy" @click="saveLine(l)">Save correction</button>
            </div>
          </div>
        </div>

        <div class="aw-acts">
          <button class="aw-btn go" :disabled="busy" @click="run('confirmInterpretation')">Confirm this reading</button>
        </div>
      </section>

      <!-- ===== 5. PLAN ===== -->
      <section class="aw-card">
        <h2>The plan</h2>
        <div class="aw-sub">
          Prior order: {{ data.plan.prior_order_known ? 'loaded' : 'unknown' }} ·
          resolved {{ data.plan.counts.resolved_display }} ·
          held {{ data.plan.counts.held_display }} ·
          excluded {{ data.plan.counts.excluded_display }}
        </div>
        <div v-for="grp in planGroups" :key="grp.key" class="aw-grp">
          <h3>{{ grp.label }} <span class="aw-mono">{{ grp.rows.length }}</span></h3>
          <div v-if="!grp.rows.length" class="aw-empty">Nothing here.</div>
          <div v-for="r in grp.rows" :key="grp.key + '-' + r.line_no" class="aw-row">
            <div class="aw-row-main">
              <b>{{ r.canonical_product_name_display }}</b>
              <span class="aw-mono">#{{ r.matched_regular_id_display }}</span>
              <div class="aw-sub">"{{ r.raw_reading_display }}" · qty {{ r.requested_qty_display }} → added {{ r.added_qty_display }}</div>
              <div class="aw-sub">rule: {{ r.applied_rule_display }} · {{ r.prior_order_context }}</div>
            </div>
            <span class="aw-pill">{{ r.plan_status_display }}</span>
          </div>
        </div>
      </section>

      <!-- ===== 6. OPEN QUESTIONS ===== -->
      <section class="aw-card">
        <h2>Open questions <span class="aw-mono">{{ data.questions.open_count_display }}</span></h2>
        <div v-if="!data.questions.items.length" class="aw-empty">Nothing is waiting on you.</div>
        <div v-for="q in data.questions.items" :key="q.question_key" class="aw-q">
          <div class="aw-q-t">{{ q.question_text_display }}</div>
          <div class="aw-acts">
            <button v-for="c in q.candidates" :key="c.index" class="aw-btn" :disabled="busy"
              @click="answer(q, { candidate_index: c.index, answer_source: 'button' })">
              {{ c.label_display }}<span v-if="c.from_catalogue" class="aw-mono"> #{{ c.regular_id_display }}</span>
            </button>
          </div>
          <div class="aw-acts">
            <input type="text" v-model="typed[q.question_key]" placeholder="or type what it should be" />
            <button class="aw-btn go" :disabled="busy || !typed[q.question_key]"
              @click="answer(q, { answer_text: typed[q.question_key], answer_source: 'typed' })">Send</button>
            <button class="aw-btn" :disabled="busy" @click="answer(q, { intent: 'search', answer_source: 'button' })">Search ASDA</button>
            <button class="aw-btn" :disabled="busy" @click="answer(q, { intent: 'skip', answer_source: 'button' })">Skip this week</button>
          </div>
        </div>
      </section>

      <!-- ===== 7. BROWSER BUILD ===== -->
      <section class="aw-card">
        <h2>Basket build</h2>
        <div class="aw-sub">{{ data.browser.boundary }}</div>
        <div class="aw-kv">
          <div><span>Request</span><b>{{ data.browser.status_display }}</b></div>
          <div><span>Claimed by</span><b>{{ data.browser.claimed_by_display }}</b></div>
          <div><span>Regulars added</span><b>{{ data.browser.regulars_added_display }}</b></div>
          <div><span>Searched items added</span><b>{{ data.browser.searched_items_added_display }}</b></div>
          <div><span>Basket lines</span><b>{{ data.browser.basket_lines_display }}</b></div>
          <div><span>Estimated total</span><b>{{ data.browser.estimated_total.display }}</b></div>
        </div>
        <div v-if="data.browser.estimated_total.known && !data.browser.estimated_total.is_asda_quoted" class="aw-note warn">
          {{ data.browser.estimated_total.basis_label }}
        </div>
        <div v-if="data.browser.held_items.length" class="aw-grp">
          <h3>Held <span class="aw-mono">{{ data.browser.held_items.length }}</span></h3>
          <div v-for="(h, i) in data.browser.held_items" :key="i" class="aw-row">
            <div class="aw-row-main"><b>{{ h.label_display }}</b><div class="aw-sub">{{ h.reason_display }}</div></div>
          </div>
        </div>
        <div class="aw-grp">
          <h3>Pending favourite actions <span class="aw-mono">{{ data.browser.pending_actions.length }}</span></h3>
          <div v-if="!data.browser.pending_actions.length" class="aw-empty">Nothing outstanding.</div>
          <div v-for="a in data.browser.pending_actions" :key="a.id" class="aw-row">
            <div class="aw-row-main"><b>{{ a.action_type_display }}</b> <span class="aw-mono">{{ a.action_key_display }}</span>
              <div class="aw-sub">{{ a.note_display }} · raised {{ a.created_at_display }}</div></div>
          </div>
        </div>
        <div class="aw-acts">
          <button class="aw-btn go" :disabled="busy" @click="run('requestBasketBuild')">Request basket build</button>
          <button class="aw-btn" :disabled="busy" @click="run('pauseBasketBuild')">Pause</button>
        </div>
      </section>

      <!-- ===== 8. ORDER ===== -->
      <section class="aw-card">
        <h2>The order</h2>
        <div class="aw-note warn">{{ data.order.price_basis_note }}</div>
        <div class="aw-kv">
          <div><span>Confirmation</span><b>{{ data.order.received ? 'received' : 'not received' }}</b></div>
          <div><span>ASDA stated total</span><b>{{ data.order.stated_total.display }}</b></div>
          <div><span>Lines</span><b>{{ data.order.lines_count_display }}</b></div>
          <div><span>Inferred prices</span><b>{{ data.order.derived_price_count_display }}</b></div>
        </div>
        <div class="aw-kv">
          <div><span>As planned</span><b>{{ data.order.summary.as_planned_display }}</b></div>
          <div><span>Added after planning</span><b>{{ data.order.summary.added_after_planning_display }}</b></div>
          <div><span>Omitted</span><b>{{ data.order.summary.omitted_display }}</b></div>
          <div><span>Qty changed</span><b>{{ data.order.summary.qty_changed_display }}</b></div>
          <div><span>Variant changed</span><b>{{ data.order.summary.variant_changed_display }}</b></div>
          <div><span>Unmatched</span><b>{{ data.order.summary.unmatched_display }}</b></div>
        </div>

        <div v-for="l in data.order.lines" :key="l.line_no" class="aw-row">
          <div class="aw-row-main">
            <b>{{ l.canonical_product_name_display !== 'unknown' ? l.canonical_product_name_display : l.product_name_display }}</b>
            <span class="aw-mono">#{{ l.matched_regular_id_display }}</span>
            <div class="aw-sub">"{{ l.product_name_display }}" · qty {{ l.quantity_display }} · {{ l.pack_size_display }}</div>
          </div>
          <div class="aw-price">
            <b>{{ l.price.display }}</b>
            <span class="aw-pill" :class="l.price.is_asda_quoted ? 'ok' : 'warn'">{{ l.price.basis || 'unknown' }}</span>
            <span class="aw-sub">{{ l.outcome_display }}</span>
          </div>
        </div>

        <details class="aw-fold">
          <summary>Send the ASDA confirmation</summary>
          <textarea v-model="confirmationText" rows="6" placeholder="Paste the ASDA order confirmation here"></textarea>
          <input type="file" accept=".txt,.csv,.eml,text/plain" @change="loadFile" />
          <div class="aw-sub">A photo of the confirmation goes to ShopperBot — the same command handles it either way.</div>
          <div class="aw-acts">
            <button class="aw-btn go" :disabled="busy || !confirmationText"
              @click="run('submitConfirmation', { source_kind: 'text', raw_text: confirmationText })">Submit confirmation</button>
          </div>
        </details>
      </section>

      <!-- ===== 9. HISTORY ===== -->
      <section class="aw-card">
        <h2>What this taught us</h2>
        <div class="aw-kv">
          <div><span>Previous order</span><b>#{{ data.history.previous_order.order_id_display }}</b></div>
          <div><span>Run at</span><b>{{ data.history.previous_order.run_at_display }}</b></div>
          <div><span>Requested → added</span><b>{{ data.history.previous_order.total_requested_display }} → {{ data.history.previous_order.total_added_display }}</b></div>
          <div><span>Basket total</span><b>{{ data.history.previous_order.basket_total.display }}</b></div>
        </div>
        <div class="aw-grp">
          <h3>Sure rotation <span class="aw-mono">{{ data.history.rotation.length }}</span></h3>
          <div v-if="!data.history.rotation.length" class="aw-empty">No rotate rule stored.</div>
          <div v-for="r in data.history.rotation" :key="r.rule_id_display" class="aw-row">
            <div class="aw-row-main"><b>{{ r.match_term_display }}</b><div class="aw-sub">{{ r.reason_display }}</div></div>
          </div>
        </div>
        <div class="aw-grp">
          <h3>New regulars <span class="aw-mono">{{ data.history.new_regulars.length }}</span></h3>
          <div v-if="!data.history.new_regulars.length" class="aw-empty">Nothing new was learned.</div>
          <div v-for="r in data.history.new_regulars" :key="r.regular_id_display" class="aw-row">
            <div class="aw-row-main"><b>{{ r.name_display }}</b> <span class="aw-mono">#{{ r.regular_id_display }}</span></div>
          </div>
        </div>
        <div class="aw-grp">
          <h3>Aliases learned <span class="aw-mono">{{ data.history.aliases_learned.length }}</span></h3>
          <div class="aw-sub">{{ data.history.aliases_learned_basis }}</div>
          <div v-for="r in data.history.aliases_learned" :key="'a' + r.regular_id_display" class="aw-row">
            <div class="aw-row-main"><b>{{ r.name_display }}</b><div class="aw-sub">{{ r.aliases_display }}</div></div>
          </div>
        </div>
        <div class="aw-grp">
          <h3>Product IDs captured <span class="aw-mono">{{ data.history.product_ids_captured.length }}</span></h3>
          <div v-if="!data.history.product_ids_captured.length" class="aw-empty">None captured this shop.</div>
          <div v-for="r in data.history.product_ids_captured" :key="'p' + r.regular_id_display" class="aw-row">
            <div class="aw-row-main"><b>{{ r.name_display }}</b> <span class="aw-mono">{{ r.asda_product_id_display }}</span></div>
          </div>
        </div>
      </section>
    </template>

    <!-- ===== FOOTER: where this is reading from ===== -->
    <details class="aw-fold">
      <summary>Connection</summary>
      <div class="aw-acts">
        <input type="text" v-model="baseInput" class="aw-wide" />
        <button class="aw-btn" @click="saveBase">Use this</button>
      </div>
      <div class="aw-sub">
        Read-only workspace API. Every button above calls the SAME channel-neutral command as ShopperBot:
        <span class="aw-mono">{{ commandNames.join(', ') }}</span>.
      </div>
      <div v-if="lastResult" class="aw-sub aw-mono">{{ lastResult }}</div>
    </details>
  </div>
</template>

<script>
// =====================================================================
// BUILD-015 - Apps > Asdair > Details
//
// A VIEW. It renders durable state and it calls commands. It contains NO
// shopping logic:
//   * every number/label on screen arrives pre-formatted from
//     services/asdair/cockpit-api (present.js), so "unknown" and "this price
//     was inferred" are decided in code that `node --test` can prove, not in a
//     template;
//   * every button posts one named command from the SHARED surface in
//     services/asdair/pipeline/commands.js, so an answer given here and an
//     answer tapped in Telegram clear the same question the same way.
//
// It never checks out, never pays, never books a slot, never enters a password
// and never drives a browser. "Request basket build" writes a durable request
// and stops.
// =====================================================================
import { ref, reactive, computed, onMounted } from 'vue';

const STORE_KEY = 'asdair.cockpit.api';
const STORE_SHOP = 'asdair.cockpit.shop';
const DEFAULT_BASE = 'http://100.101.240.85:8710';

// Kept in step with services/asdair/cockpit-api/commandSurface.js. The UI may
// only offer an action whose name is in this list AND in the payload's
// command_names, so a button can never invent a capability.
const COMMANDS = [
  'confirmInterpretation', 'correctLine', 'buildShop', 'answerQuestion',
  'requestBasketBuild', 'pauseBasketBuild', 'submitConfirmation',
  'retryStage', 'cancelShop', 'getStatus',
];

export default {
  name: 'AsdairWorkspace',
  setup() {
    const readStore = (k, fallback) => {
      try { return window.localStorage.getItem(k) || fallback; } catch (e) { return fallback; }
    };

    const base = ref(readStore(STORE_KEY, DEFAULT_BASE));
    const baseInput = ref(base.value);
    const handle = ref(readStore(STORE_SHOP, ''));
    const data = ref(null);
    const shops = ref([]);
    const loading = ref(false);
    const busy = ref(false);
    const err = ref('');
    const lastResult = ref('');
    const imgFailed = ref(false);
    const editing = reactive({});
    const edits = reactive({});
    const typed = reactive({});
    const confirmationText = ref('');

    const commandNames = computed(() => (data.value && data.value.command_names) || COMMANDS);
    const stages = computed(() => (data.value && data.value.ok && Array.isArray(data.value.shop.all_stages)) ? data.value.shop.all_stages : []);
    const mediaSrc = computed(() => {
      if (!data.value || !data.value.ok || !data.value.evidence.media_url) return '';
      return base.value.replace(/\/+$/, '') + data.value.evidence.media_url;
    });

    const stageTone = computed(() => {
      if (!data.value || !data.value.ok) return '';
      const s = data.value.shop.stage;
      if (s === 'FAILED' || s === 'CANCELLED') return 'stop';
      if (s === 'NEEDS_DECISION') return 'warn';
      if (s === 'RECONCILED') return 'ok';
      return 'go';
    });

    const railClass = (s) => {
      if (!data.value || !data.value.ok) return '';
      const all = stages.value;
      const here = all.indexOf(data.value.shop.stage);
      const me = all.indexOf(s);
      if (me === here) return 'on';
      return here > -1 && me > -1 && me < here ? 'past' : '';
    };

    const lineTone = (l) => ({
      matched: 'ok',
      needs_confirmation: 'warn',
      possible_duplicate: 'warn',
      unmatched_new_item: '',
      unreadable: 'stop',
    }[l.status] || '');

    const planGroups = computed(() => {
      if (!data.value || !data.value.ok) return [];
      return [
        { key: 'resolved', label: 'Resolved', rows: data.value.plan.resolved },
        { key: 'held', label: 'Held for you', rows: data.value.plan.held },
        { key: 'excluded', label: 'Excluded', rows: data.value.plan.excluded },
        { key: 'unclassified', label: 'Not classified', rows: data.value.plan.unclassified },
      ].filter((g) => g.key !== 'unclassified' || g.rows.length);
    });

    // Only alternatives our own catalogue vouches for may be CHOSEN. A
    // free-text alternative has no id, so picking it could not name a product.
    const catalogueChoices = (l) => l.alternatives.filter((a) => a.from_catalogue);

    async function load() {
      loading.value = true; err.value = '';
      try {
        const q = handle.value ? ('?shop=' + encodeURIComponent(handle.value)) : '';
        const res = await fetch(base.value.replace(/\/+$/, '') + '/asdair/workspace' + q, { headers: { accept: 'application/json' } });
        const body = await res.json();
        if (!res.ok) throw new Error(body && body.message ? body.message : ('HTTP ' + res.status));
        data.value = body;
        shops.value = Array.isArray(body.shops) ? body.shops : [];
        if (body.ok && body.shop) handle.value = String(body.shop.shop_id);
        imgFailed.value = false;
      } catch (e) {
        data.value = null;
        err.value = (e && e.message) || 'the workspace API did not answer';
      } finally {
        loading.value = false;
      }
    }

    async function post(command, args) {
      if (COMMANDS.indexOf(command) === -1) {
        err.value = 'refused: "' + command + '" is not part of the shared AsdAIr command surface';
        return null;
      }
      busy.value = true; err.value = ''; lastResult.value = '';
      try {
        const payload = {
          command: command,
          actor: 'warwick',
          idempotency_key: command + ':' + String(handle.value) + ':' + String(Date.now()),
          args: Object.assign({ shop_id: handle.value || null, shop_ref: data.value && data.value.ok ? data.value.shop.shop_ref_display : null }, args || {}),
        };
        const res = await fetch(base.value.replace(/\/+$/, '') + '/asdair/command', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body && body.message ? body.message : ('HTTP ' + res.status));
        lastResult.value = command + ' accepted';
        return body;
      } catch (e) {
        err.value = command + ' failed: ' + ((e && e.message) || 'no answer');
        return null;
      } finally {
        busy.value = false;
      }
    }

    async function run(command, args) {
      const out = await post(command, args);
      if (out) await load();
      return out;
    }

    function confirmCancel() {
      // Cancelling throws away a week's work; make it deliberate.
      if (typeof window !== 'undefined' && window.confirm && !window.confirm('Cancel this shop?')) return;
      run('cancelShop');
    }

    function toggleEdit(l) {
      const k = l.list_item_id;
      if (!edits[k]) edits[k] = { matched_regular_id: '', quantity: l.quantity === null ? '' : l.quantity, new_item: false, note: '' };
      editing[k] = !editing[k];
    }

    function saveLine(l) {
      const e = edits[l.list_item_id] || {};
      const args = { list_item_id: l.list_item_id, line_no: l.line_no };
      if (e.matched_regular_id) args.matched_regular_id = Number(e.matched_regular_id);
      if (e.quantity !== '' && e.quantity !== null && e.quantity !== undefined) args.quantity = Number(e.quantity);
      if (e.new_item) args.new_item = true;
      if (e.note) args.note = e.note;
      editing[l.list_item_id] = false;
      return run('correctLine', args);
    }

    function answer(q, extra) {
      return run('answerQuestion', Object.assign({ question_key: q.question_key, question_id: q.id }, extra || {}));
    }

    function loadFile(ev) {
      const f = ev && ev.target && ev.target.files && ev.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => { confirmationText.value = String(reader.result || ''); };
      reader.readAsText(f);
    }

    function pick(v) {
      handle.value = v;
      try { window.localStorage.setItem(STORE_SHOP, v); } catch (e) { /* no-op */ }
      load();
    }

    function saveBase() {
      base.value = baseInput.value.trim() || DEFAULT_BASE;
      try { window.localStorage.setItem(STORE_KEY, base.value); } catch (e) { /* no-op */ }
      load();
    }

    const refresh = () => load();
    onMounted(load);

    return {
      base, baseInput, handle, data, shops, loading, busy, err, lastResult, imgFailed,
      editing, edits, typed, confirmationText,
      commandNames, stages, mediaSrc, stageTone, railClass, lineTone, planGroups, catalogueChoices,
      run, refresh, confirmCancel, toggleEdit, saveLine, answer, loadFile, pick, saveBase,
    };
  },
};
</script>

<style scoped>
.aw { display:flex; flex-direction:column; gap:14px; }
.aw h1 { font-size:22px; letter-spacing:-.02em; margin:0; }
.aw h2 { font-size:16px; margin:0 0 4px; }
.aw h3 { font-family:var(--mono); font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:var(--ink2); margin:14px 0 8px; }
.aw-h { display:flex; align-items:flex-end; gap:12px; flex-wrap:wrap; }
.aw-h-main { flex:1; min-width:160px; }
.aw-h-act { display:flex; gap:8px; flex-wrap:wrap; }
.aw-eyebrow { font-family:var(--mono); font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--ink3); }
.aw-card { background:var(--panel); border:1px solid var(--hair); border-radius:14px; padding:16px; }
.aw-top { display:flex; align-items:flex-start; gap:12px; }
.aw-top > div:first-child { flex:1; }
.aw-big { font-size:19px; font-weight:700; letter-spacing:-.01em; }
.aw-sub { font-size:12px; color:var(--ink3); margin-top:3px; }
.aw-mono { font-family:var(--mono); font-size:11px; color:var(--ink3); }
.aw-empty { color:var(--ink3); font-size:13px; padding:6px 0; }
.aw-pre { white-space:pre-wrap; font-family:var(--mono); font-size:12px; background:var(--panel2); border-radius:8px; padding:10px; margin:8px 0 0; overflow-x:auto; }

.aw-rail { display:flex; flex-wrap:wrap; gap:4px; list-style:none; padding:0; margin:12px 0 0; }
.aw-rail li { font-family:var(--mono); font-size:9.5px; letter-spacing:.04em; padding:3px 7px; border-radius:20px; background:var(--panel2); color:var(--ink3); }
.aw-rail li.past { color:var(--ok); background:var(--ok-w); }
.aw-rail li.on { color:#fff; background:var(--accent); }

.aw-kv { display:grid; grid-template-columns:repeat(2,1fr); gap:8px 14px; margin-top:12px; }
.aw-kv > div { display:flex; flex-direction:column; }
.aw-kv span { font-size:11px; color:var(--ink3); } .aw-kv b { font-size:14px; }

.aw-chip,.aw-pill { display:inline-flex; align-items:center; font-family:var(--mono); font-size:10.5px; font-weight:600; padding:3px 9px; border-radius:20px; background:var(--panel2); color:var(--ink2); }
.aw-chip.ok,.aw-pill.ok { background:var(--ok-w); color:var(--ok); }
.aw-chip.warn,.aw-pill.warn { background:var(--warn-w); color:var(--warn); }
.aw-chip.stop,.aw-pill.stop { background:var(--stop-w); color:var(--stop); }
.aw-chip.go,.aw-pill.go { background:var(--accent-w); color:var(--accent-ink); }
.aw-tally { display:flex; flex-wrap:wrap; gap:6px; margin:10px 0; }

.aw-acts { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:12px; }
.aw-btn { font-weight:600; font-size:13px; padding:8px 14px; border-radius:9px; border:1px solid var(--hair); background:var(--panel2); color:var(--ink); cursor:pointer; }
.aw-btn:hover { border-color:var(--accent); } .aw-btn:disabled { opacity:.5; cursor:default; }
.aw-btn.go { background:var(--accent); color:#fff; border-color:var(--accent); }
.aw-btn.stop { color:var(--stop); }
.aw-link { background:none; border:none; color:var(--accent-ink); font-weight:600; font-size:12px; cursor:pointer; padding:8px 0 0; }
.aw-sel,.aw input[type="text"],.aw input[type="number"],.aw textarea,.aw select { font:inherit; font-size:13px; padding:7px 10px; border:1px solid var(--hair); border-radius:8px; background:var(--panel); color:var(--ink); }
.aw textarea { width:100%; box-sizing:border-box; margin-top:8px; }
.aw-wide { flex:1; min-width:200px; }

.aw-note { font-size:13px; padding:10px 12px; border-radius:10px; background:var(--panel2); color:var(--ink2); margin-top:10px; }
.aw-note.stop { background:var(--stop-w); color:var(--stop); }
.aw-note.warn { background:var(--warn-w); color:var(--warn); }
.aw-warn { font-size:12px; color:var(--warn); margin-top:3px; }

.aw-fold { margin-top:12px; border:1px solid var(--hair); border-radius:10px; background:var(--panel2); padding:0 12px; }
.aw-fold > summary { cursor:pointer; padding:10px 0; font-family:var(--mono); font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:var(--ink3); }
.aw-fold[open] { padding-bottom:12px; }

.aw-ev { display:flex; flex-direction:column; gap:1px; padding:7px 0; border-top:1px solid var(--hair); font-size:13px; }
.aw-ev.bad { color:var(--stop); }

.aw-line { border:1px solid var(--hair); border-left:4px solid var(--park); border-radius:10px; padding:11px 13px; margin-bottom:8px; }
.aw-line.ok { border-left-color:var(--ok); } .aw-line.warn { border-left-color:var(--warn); } .aw-line.stop { border-left-color:var(--stop); }
.aw-line-h { display:flex; gap:10px; align-items:flex-start; }
.aw-line-main { flex:1; min-width:0; }
.aw-no { font-family:var(--mono); font-size:11px; color:var(--ink3); padding-top:3px; }
.aw-read { font-size:13px; color:var(--ink2); font-style:italic; }
.aw-canon { display:flex; flex-wrap:wrap; gap:8px; align-items:baseline; font-size:14.5px; margin-top:2px; }
.aw-alts { display:flex; flex-wrap:wrap; gap:8px; margin-top:7px; align-items:baseline; }
.aw-alt { font-size:12px; background:var(--panel2); border-radius:6px; padding:3px 8px; }
.aw-edit { display:flex; flex-direction:column; gap:8px; margin-top:10px; padding-top:10px; border-top:1px dashed var(--hair); }
.aw-edit label { display:flex; flex-direction:column; gap:3px; font-size:11px; color:var(--ink3); }
.aw-edit label.aw-cb { flex-direction:row; align-items:center; gap:7px; font-size:12px; color:var(--ink2); }

.aw-row { display:flex; gap:12px; align-items:flex-start; padding:9px 0; border-top:1px solid var(--hair); }
.aw-row-main { flex:1; min-width:0; font-size:14px; }
.aw-price { text-align:right; display:flex; flex-direction:column; gap:3px; align-items:flex-end; font-size:13px; }
.aw-grp { margin-top:6px; }
.aw-q { border-top:1px solid var(--hair); padding-top:10px; margin-top:10px; }
.aw-q-t { font-size:14.5px; font-weight:600; }
.aw-media img { max-width:100%; border-radius:10px; margin-top:10px; display:block; }

@container (min-width: 780px) { .aw-kv { grid-template-columns:repeat(3,1fr); } }
@container (min-width: 1280px) { .aw-kv { grid-template-columns:repeat(6,1fr); } }
</style>
