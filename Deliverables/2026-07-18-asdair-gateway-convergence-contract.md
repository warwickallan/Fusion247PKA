# AsdAIr <-> Unified Capture Gateway — B Integration Contract (DRAFT)

**Status:** DRAFT design contract. Prepared while AsdAIr PR #36 is under review. **No implementation branch exists or should exist yet** (per Warwick: do not base a tangled branch on unmerged AsdAIr code). Build B from **fresh current `main`** only after #36 is merged and FU-1 is closed.

**Author:** Larry, 2026-07-18. **Owner on build:** to be split across specialists per the WP breakdown below.

---

## 1. Target product (Warwick, verbatim intent)

> Shopper bot -> BUILD-002 durable multimodal intake -> OCR/transcription -> AsdAIr routing/planner -> truthful Telegram status and decision handling -> manual Warwick checkout.

## 2. Hard constraints (Warwick + GPT DevOps guidance)

- **Separate integration PR**, built from **current `main`** — never folded into the AsdAIr core (PR #36), never branched off unmerged code.
- **Do not revive stale WP2 wholesale.** Salvage only reusable *generic* auth/dedup/routing, and only after checking it against current `main` and the separate Tower-bot architecture.
- **Edge Function stays dark** until the integrated path is ready for a controlled acceptance test.
- **Never place the order / never automate payment.** The pipeline ends at "basket ready"; **manual Warwick checkout** only.
- **Personal data -> private Supabase only**, never git (household names/health/items). Same boundary as the gitignored AsdAIr seed.
- Preconditions: AsdAIr core (PR #36) merged; FU-1 L-1 closed (authoritative CA cross-check).

## 3. The two sides, as-is (grounded in current `main`)

**BUILD-002 gateway (merged: WP0 live, WP1 cloud built-not-live):**
- Contract: Envelope / Action / Receipt v1 (`src/core/contracts.js`); 14-state saga (`src/core/states.js`).
- Schema `fcg` (non-API-exposed): `capture_envelope`, `raw_object`, `processing_state`, `evidence_pointer`, `idempotency_key`, `channel_identity`, `channel_update_dedup` (WP1). `technical_source_type` enum ALREADY reserves `image`/`photo`/`pdf_office`/`url`; `raw_object` table exists but **no code populates it**.
- Intake: `src/adapters/telegramMapping.js` — **single bot**, allowlist-of-one (`AUTHORISED_TELEGRAM_USER_ID`), private-DM-only, **TEXT-ONLY** (a photo is rejected `unsupported_content_type`).
- Saga: intake (durable commit) -> **tap-gate** -> leased worker -> **governed write** (Markdown into `Team Inbox/captures/<id>.md`) -> evidence-gated complete -> card edit.
- **No classifier** (raw file -> manual human triage). **No structured-table write path.** Reusable auth/dedup on main: `src/core/idempotency.js`, the `telegramMapping` allowlist/DM-boundary, and the `0006` `channel_update_dedup` ledger.
- `b7fd473` (WP2) is a **governance-control-surface DOC + README** (fail-closed decision) — design guidance, not auth/dedup code.

**AsdAIr core (PR #36, pending merge):**
- `asdair` schema: `rules` (with structured directives), `products`, `shopping_lists`, `shopping_list_items`, `orders`, `order_events`, `rule_qa_log` (learning loop).
- Read-only `planBasket()` planner + SELECT-only adapter. OCR = Claude vision. Separate **Fusion 247 Shopper** Telegram bot (own inbox).

## 4. The gaps B must close — exact interface mapping

| # | Gap (today) | B mapping (target) |
|---|---|---|
| G1 | Gateway is **single-bot** | A per-bot **channel registry**: `{bot_token, channel, allowlist}`. Shopper bot -> `channel='shopper'`, `source_channel='telegram'`. Extend `config.js` + `telegramMapping` to resolve by bot, not one global token. Keep default-deny allowlist per channel. |
| G2 | Gateway is **text-only** | Accept `photo` (and later `voice`): `telegramMapping` populates `raw_object` (Telegram `file_id` + fetched bytes) and sets `technical_source_type='image'`. Photo passes intake instead of `unsupported_content_type`. |
| G3 | **No transcription** | New governed **transcription stage**: raw image -> Claude vision -> normalized structured list (`[{item_name, requested_qty, note}]`) + a transcription-confidence. This is the "OCR/transcription" leg. Design decision D1 below. |
| G4 | **No classifier / routing** | A classification step assigns `destination`. A `channel='shopper'` capture with a list payload -> `destination='asdair'`; everything else keeps the existing Markdown-writer default. Fail-closed (b7fd473 governance): unknown/ambiguous -> hold for human, never mis-route. |
| G5 | **No structured-table write** | New governed **AsdAIr write adapter**: writes `asdair.shopping_lists` (+ `shopping_list_items`, status `pending`) instead of Markdown. Honors the source-of-truth boundary (approved domain store). Idempotent by `(household, list_date)` + capture idempotency key. |
| G6 | Planner not invoked | After the list lands, invoke read-only `planBasket()` -> basket plan (rules applied, needs_decision + budget flags). |
| G7 | No truthful status/decisions | Shopper bot returns the **basket plan + flags**; `needs_decision` items become tap/callback questions; answers feed the **learning loop** (`rule_qa_log` -> promoted rule). Reuse WP0 tap-gate/callback machinery + a truthful reviewVoice-style status (status-first, no over-claiming). |
| G8 | Checkout | **NEVER automated.** Pipeline ends at "basket ready" + the later Claude-in-Chrome run on the Yoga. Warwick checks out by hand. |

## 5. Interface contracts (the shapes B introduces)

- **Channel registry entry:** `{ channel: 'shopper', botTokenRef, allowlist: [userId], sourceChannel: 'telegram' }` (token by reference, never a value in git/DB).
- **Multimodal Envelope delta:** Envelope carries `technical_source_type='image'` + a `raw_object` pointer (`telegram_file_id`, sha256, bytes-in-store). No change to Envelope v1 identity/idempotency semantics.
- **Transcription action:** `transcribe(raw_object) -> { items: [...], confidence, needs_review }` — deterministic contract; the model call is the impl detail.
- **AsdAIr write-adapter action:** `writeShoppingList({ household, list_date, items, provenance }) -> { list_id }` — SELECT/INSERT on `asdair` only; never touches `fcg` semantics.
- **Status/decision callback:** reuse `processing_state.card_ref` + callback tap; `needs_decision` -> a Shopper-bot question; answer -> `rule_qa_log` row (+ optional promotion).

## 6. Sequencing (sub-work-packages; edge fn dark until B4)

- **B0** — multi-bot + multimodal intake (channel registry; `raw_object` populated; photo accepted). Gateway side, from current main.
- **B1** — transcription stage (Claude vision) -> normalized list.
- **B2** — classifier (fail-closed) + AsdAIr write adapter -> `asdair.shopping_lists`.
- **B3** — planner invocation + truthful Telegram status + decision handling (learning loop).
- **B4** — end-to-end controlled acceptance test; only THEN consider switching on the cloud Edge Function.

## 7. Salvage check (read-only analysis vs current `main`, 2026-07-18)

**Two framing corrections from the analysis:**
- The "separate Tower architecture" to keep apart from is **`services/fusion-tower/`** (schema `ftw`, BUILD-010) plus the baton worktree `C:\Fusion247PKA-baton` — there is no `services/tower-baton/` on `main`.
- **The stale WP2 branch (`b7fd473`, branch `build-002/wp2-telegram-governance-control-surface`, NOT on main) already fused Tower governance into the capture bot's SINGLE `getUpdates` poller** (routing `/status`, `/stop`, `dec:<token>` into `ftw.run_event`). This is the single biggest cross-wiring hazard: B must NOT inherit or revive that single-poller-multiplex. The Shopper bot is its own bot with its own poller and its own token.

**Reuse verdicts (file:line evidence in the analysis):**

| Piece | Verdict | What B does |
|---|---|---|
| `src/core/idempotency.js` | **reuse-as-is** | Channel-scoped key + already has a `Uint8Array` (photo-byte) branch. One-line widen: fold bot/channel into `channel_native_message_id` so two bots can't alias. |
| `src/adapters/telegramMapping.js` | **extend** | Keep the allowlist + private-DM two-layer gate (preserve the check ORDER: DM-boundary before content-type). Rewrite the single `authorisedUserId` scalar → per-channel allowlist, and the **text-only rejection** (`:125-128`) → multimodal accept (capture `photo[].file_id`, set `technical_source_type='image'`, build a `raw_object` pointer). |
| `src/config.js` | **extend** | Replace the two scalars (`TELEGRAM_BOT_TOKEN`, `AUTHORISED_TELEGRAM_USER_ID`) with a channel registry `{channel, botTokenRef, allowlist[], sourceChannel}`; add each bot's token env-NAME to `SECRET_KEYS` so the redactor masks all of them. |
| `migrations/0006` dedup + RPCs | **extend** | Reuse the `channel_update_dedup` ledger SHAPE; its PK `(channel, update_id)` must gain a per-bot dimension. RPCs are text-shaped (`p_payload_text` only) + are the cloud/webhook path — **keep the Edge Function dark until B4**. |
| `raw_object` + `technical_source_type` enum (`0001`) | **reuse-as-is (schema) / extend (code)** | Enum already reserves `image`/`photo`/`voice`; NO DDL change needed. Zero code populates `raw_object` today — B fills it purely in adapter/worker (getFile → bucket write → `raw_object` row → set `raw_object_ref`). |
| tap-gate / callback (`intake.js confirmSave`, `liveRunner.js handleCallback`) | **extend** | Reuse the `card_ref` reverse-lookup + idempotent-by-state loop for AsdAIr `needs_decision` Q&A. Generalize the fixed 3-button vocabulary; route answers into `asdair.rule_qa_log`. Dispatch callbacks to the ORIGINATING bot's adapter. |
| governed-write seam (`runtime.js`, `markdownWriter.js`) | **extend** | The `write()->{destination_ref,evidence}` writer CONTRACT is reusable as the interface for a second destination. Add a classify->route step (worker always calls markdown today) + an `asdair.shopping_lists` writer + a new `evidence_kind` enum value (migration). |
| `b7fd473` WP2 governance | **do-not-touch as code / honor as design** | Binding design constraints: fail-closed routing (hold on ambiguity, never mis-route or silently drop), never automate past "basket ready", personal data -> private Supabase only, strict bot separation, no single-poller-multiplex. |

## 7b. Multi-bot RISK REGISTER (must be designed out in B0)

| Risk | Location | Mitigation |
|---|---|---|
| **Env-name token collision with Tower** | `config.js:56,59` vs `fusion-tower/config.js:51-52` use the SAME `TELEGRAM_BOT_TOKEN` + `AUTHORISED_TELEGRAM_USER_ID` | Shopper bot gets a DISTINCT env name (e.g. `SHOPPER_TELEGRAM_BOT_TOKEN`); never reuse the bare name Tower also claims; add to `SECRET_KEYS`. |
| **Poll-offset key collision** | `channel_poll_offset PK (channel)` (`0005:54-58`) + `CHANNEL='telegram'` const | Key the durable offset per bot/channel-registry id, not the bare `source_channel`; else two bots clobber each other's cursor. |
| **`channel_update_dedup` cross-bot false-dedup** | `0006:90` PK `(channel, update_id)`; `update_id` is per-bot | Add a bot dimension to the dedup PK (or a distinct `source_channel` per bot). |
| **Idempotency-key aliasing** | `telegramMapping.js:133` `chat:<sender>:msg:<id>` | Fold bot/channel into `channel_native_message_id`. |
| **Callback-data namespace collision with Tower/WP2** | WP2 `dec:<gate_token>` vs AsdAIr `dec:<list>` | Disjoint callback-data prefix for AsdAIr; do NOT import WP2 `detect.js`/`commandGrammar.js`. |
| 409 getUpdates | same-token only | Distinct token per bot -> no 409; never run two pollers on one token; never revive the WP2 single-poller merge. |
| Module-global state | — | GOOD: the live adapter has no module singletons (`cardMessages` is instance-local) — one adapter instance per bot is safe. |

## 8. Design decisions — RECOMMENDATIONS (Larry, informed by §7; pending Warwick/GPT sign-off)

All four resolve toward **one intake codebase (channel registry + destination selector), reusing the gateway's durable/evidence machinery** rather than forking a parallel AsdAIr-only path. Rationale: the saga already gives durable capture, bounded retry, evidence-gating and a card/callback audit trail — a parallel path would re-implement all of it and double the surface.

- **D4 — Multi-bot model -> EXTEND to a channel registry (recommended).** The gateway is single-bot in several keyed places (config scalars, `channel_poll_offset` PK, `channel_update_dedup` PK, idempotency key). Rather than a divergent second intake, register the Shopper bot as a second channel and fix the per-bot keys (§7b). One codebase, one audit trail. More upfront work than a fork, but it is the correct unification and avoids two drifting intakes.
- **D1 — Transcription -> a WORKER SAGA STAGE (recommended), not a loose downstream consumer.** Gateway durably captures the raw photo (`raw_object`) first; OCR/transcription runs as a governed worker step (Claude vision) that produces the normalized list, so a transcription failure retries via the saga's existing bounded-retry -> dead-letter, and stays in one evidence trail. Keeps "OCR" exactly between durable intake and the AsdAIr write, per the target pipeline.
- **D2 — Write path -> REUSE the governed-write seam (recommended).** Add an `asdair.shopping_lists` writer object satisfying the same `write()->{destination_ref,evidence}` contract, selected by a new classify->route step, with a new `evidence_kind` value. The AsdAIr writer writes ONLY `asdair` (never `fcg` semantics), honoring the source-of-truth boundary. Evidence-gated completion is preserved.
- **D3 — Status/decisions -> REUSE the gateway card/tap + callback (recommended).** "Basket ready" + each `needs_decision` question use the durable `card_ref` machinery, dispatched to the SHOPPER bot's adapter, with a callback-data namespace DISJOINT from Tower/WP2 `dec:`. Answers flow into `asdair.rule_qa_log` (the learning loop). Single audit trail, no second status mechanism.

**Net:** B is a channel-registry + multimodal-intake + transcription-stage + asdair-writer + decision-callback extension of the EXISTING gateway — not a new service. Two migrations implied (per-bot dedup/offset keys; `evidence_kind` value). The Edge Function stays dark until B4. These are recommendations — Warwick/GPT confirm before B0.

## 9. Cross-links

`[[2026-07-18-22-10_larry_asdair-wp1-and-tower-baton-completion]]` (session log) · AsdAIr PR #36 · BUILD-002 `Architecture/wp1-safe-cutover.md` · memory `[[asdair-idea012-runtime]]`, `[[tower-baton-runtime]]`.
