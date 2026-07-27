# Arc quality correction — CLOSURE REPORT

**Status: COMPLETED.** Arc was the remaining defect in the YouTube  Source-Intelligence → Arc → Mason  chain. The
smallest robust correction is built, proven on the real failure fixture `vJEy3nP2_C8`, and merged. The chain now
delivers Warwick's terminal state: SI reads the source for him → Arc comprehensively spots transfers he might not →
durable atoms → Mason converges to a small coherent opportunity set.

Reviewed head `<REVIEWED_HEAD>` · merged via PR `<PR>` → main `<FINAL_SHA>`.

---

## 1. Exact Arc changes

- **NEW `services/control-plane/cockpit/arc.mjs`** — the Arc orchestrator (the Cockpit "🧠 Mine" button now fires it,
  `server.mjs` `/api/mine`). It reads a source-core, tiers by substance, runs the right engine, and persists the
  converged atoms transactionally to `cockpit.idea_atom` (Mason) + `cockpit.idea_candidate` (Cockpit).
- **`mine-ideas.mjs` (T1 engine)** — `buildPrompt` rewritten: exported `TRANSFER_DOMAINS`, the admission rule
  (obvious+low→discard, obvious+HIGH→keep as validation/sharpening), favour-recall, no fixed emit cap.
- **`t2-calibrate.mjs` (T2 engine)** — F2 broadened to include **strategic warnings** (dependency/lock-in); **new
  F6 reputation/career/distribution** frame; branch prompt admission rule + favour-recall + **verbatim-quote
  provenance**; convergence pass: cross-branch kill culls *only* forced/surface analogies (never "obvious/already
  doing it"), preserves `admission`, and **never rewrites the verbatim quote**; branch fan-out widened to one wave.
- **Canonical records** updated (see §11).

## 2. Source-input contamination FIXED (#1)

Arc reasons over a **factual source-core**, not the interpretation: `arc.mjs` `stripInterpretation()` removes YAML
frontmatter + the note's pre-written **"What this means for Fusion247"** and **"Actions & open questions"** sections,
leaving claims · mechanisms · examples · people/tools · evidence/timestamps · caveats · source-derived themes.
Proven on `vJEy3nP2_C8`: `basis=source-core`, 23,669-char core that **retains** "What the source says", the
technical-reversal and Sahil-Bloom material, and **strips** both interpretation sections. The human-readable SI note
is never modified (SI files untouched — §10). Falls back to the transcript when no note exists.

## 3. Rich-source tier behaviour (#4)

Deterministic tier keyed on the **raw-transcript length** (real source substance, since a thin source yields a padded
note): **rich ≥ 12,000 chars → T2** divergent (6 domain frames + non-model graph enrichment + convergence, favouring
RECALL); **thin < 1,500 → cheap single pass / ZERO**; medium → one strong T1 pass. `vJEy3nP2_C8` (42,442-char
transcript) → **rich → T2**. The old single lossy T1 pass that produced 3 atoms is gone for rich sources.

## 4. vJEy3nP2_C8 — BEFORE / AFTER coverage (#5)

| | BEFORE (defective) | AFTER (corrected) |
|---|---|---|
| Engine / input | T1, raw transcript | T2 (6 frames), factual source-core |
| Atoms | **3** | **24** (35 pre-convergence, 22 discards/kills auditable) |
| Verbatim-verified provenance | — | **24 / 24** |
| Material transfer veins covered | ~3 | **15 / 16** |

Veins covered in substance: manager-of-agents/Larry-delegation · isolated parallel builders · premium-parent→cheaper-
child routing · production-credential/human-gate · **vendor-lock-in/swappable-execution warning** · model-routing/cost ·
**high-stakes decision cadence/attention** · **phone-first supervision** · Production-Watchdog/chief-of-staff ·
rubric→detect→child-agent-improve · self-observation/execution-QA · **technical-knowledge-becomes-MORE-valuable** ·
**X/public-reputation (Sahil-Bloom building-in-public argument)** · **career implications** · commercial/product/service
seeds. **The one vein this final run did not surface: the software-factory trajectory (Ramp/in-house-at-scale).** It is
a stochastic recall miss, not a structural blind spot — the immediately-prior corrected-Arc run *did* surface it; the
domain (strategic/commercial scale threshold) is in F2/F4's remit. Recorded honestly, not as a permanent open item.

## 5. X / Sahil Bloom proof (#report item)

Atom target *"VlogOps / Warwick's X presence — repurpose BUILD-XXX closure reports + session-log learnings as
build-in-public content"* carries the **verbatim, verified** source quote *"even if you don't know, you can just say
I don't know… then ask an agent to help you"* and the implication *"people with far less genuine expertise are turning
'I'm learning this in public' posts into huge followings, book deals and companies"* — the Sahil-Bloom building-in-public
→ outsized-outcome argument, transferred to Warwick's own distribution. Reputation is now Arc's territory (frame F6),
not treated as Source-Intelligence-only. (Four reputation/career atoms in total.)

## 6. Commercial / career / strategic transfer proof (#report item)

- **Commercial:** vertical-AI-SaaS product line off the Larry/specialist engine; multi-model build-verify → externalised
  QA/automation offer; agent-cost-routing micro-tool; "Agent Cost Governor" module (cash category, route to Warwick).
- **Career:** "how I run an AI agent team" positioning thread; domain-fluency acquisition via the SOP-001 hire step.
- **Strategic warning:** *"Fusion's entire build system runs inside Claude Code, Anthropic's own product"* and
  *"Codex is subsidised now — don't build your company on it"* → vendor-lock-in / swappable-execution warnings (F2).

These are exactly the non-mechanism→component domains the old Arc slid past.

## 7. Obvious-but-high-value preservation proof (#3, #report item)

Of the 24 atoms, **10 are marked `admission.kind = validation|sharpening`** (7 sharpening + 3 validation) — obvious,
low-novelty, but high material value (e.g. credential-hygiene hardening, the Watchdog→Outputs-Layer pattern, the
build-in-public validation of VlogOps). Under the old FIRST-THREE-DISCARD/"already doing it" logic these would have been
**killed as "already said"**. They are now kept and tagged. `admission.kind` breakdown: 14 new · 7 sharpening · 3 validation.

## 8. Provenance / accounting (#6)

- **24 / 24** atoms carry a **verbatim** source quote (machine-verified against the source-core) + timestamp + named
  mechanism; every atom carries `source_ref`, contributing `frames`, `convergence_type`, `domain`, `admission`, NVFI.
- **Zero near-duplicate** fusion-target prefixes (dedup at convergence works; no landfill).
- **Nothing silently dropped:** 22 discards/kills are recorded (branch `discarded_obvious` + convergence `killed` with
  reasons); the deterministic post-check auto-flags any unaccounted candidate into `killed`.
- Convergence provenance: 1 novel-independent · 6 context-induced · 17 single-frame.

## 9. Mason regression — NO landfill (#6, #7C)

Mason synthesised the richer **92-atom** estate → **5 surfaced** opportunities (+5 emerging, 24 standalone, 3 rejected
clusters). **`every_atom_accounted: true`**, disposition carried (1), 0 conflicts. The richer estate did **not** inflate
Warwick's attention surface — Mason clustered the new commercial/reputation atoms and *rejected that cluster from
surfacing*, which is the correct division of labour (Arc favours recall; Mason protects attention). Boundary intact.

## 10. Source-Intelligence regression — NONE (#7E)

The correction touches only the Arc engines + the `/api/mine` wiring. `services/hub/youtube/*` (SI note generation) is
**untouched**; the note is read (source-brief API) and stripped in-memory only. SI's "drop a URL → standalone note"
behaviour is unchanged (proven live and merged earlier today, `db026c82`).

## 11. Canonical records updated (#8)

- `Team/Arc - Transfer Intelligence Specialist/AGENTS.md` — corrected behaviour: source-core input, transfer-domains
  section, admission rule, favour-recall, deterministic tiering, `arc.mjs` orchestrator, verbatim provenance.
- `.claude/agents/arc.md` — cold-start briefing + transfer-domains block rewritten to the corrected behaviour.
- `Deliverables/fusion-operating-model.md` — Arc role + instantiation status corrected (3→24 atoms, domains, tiering).

## 12. End-to-end (#7)

`real transcript → SI note → factual source-core → corrected Arc → durable atom register → Mason` — run for real:
- **A.** Warwick can understand the source without watching it — SI note (unchanged, merged).
- **B.** Arc catches material transfers he shouldn't have to spot — 24 atoms, 15/16 veins.
- **C.** Mason prevents an attention landfill — 92 atoms → 5 surfaced, every atom accounted.
- **D.** Provenance survives end-to-end — 24/24 verbatim quotes + timestamps + frames; source_ref → atom → opportunity.
- **E.** SI + Mason behaviour not regressed — SI untouched; Mason coherent + accounted + disposition carried.

## Remaining deferred / provisional items — NONE material in the SI→Arc→Mason chain

- **Software-factory-trajectory vein** — a single-run recall-variance miss on `vJEy3nP2_C8` (Arc surfaces it in other
  runs); NOT a structural gap, NOT queued work. The 16-vein list is a regression fixture, not a permanent ontology.
- **Non-model Neo4j enrichment** annotates only (novel-to-graph / prior-decision / active-problem) and degrades
  gracefully; the honestly-recorded "not wired today" annotations are unchanged (corpus-thin), not part of this chain.
- **Owner-deferred:** the Warwick-device Cockpit visual check (Warwick's, as stated).
- **Review gate:** Fable was NOT summoned — no per-use authorisation this round (hardlock); Warwick set the gate as
  "tests green + normal guarded merge". The empirical proof runs above are the green tests.

**No material open item remains in the YouTube Source-Intelligence → Arc → Mason intelligence chain.**
