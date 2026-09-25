# Wayfinder plan — CareerAIR Set 1 email benchmark (local LLM eval)

## START / RESUME HERE — ordered by Warwick

- This Git Wayfinder is the sole route and source of truth.
- **On a fresh resume, BEFORE using any tool or doing any work, visibly state: (1) this recovered map path, (2) the goal, (3) the current phase and gate, (4) the next action. THEN open this map and continue.**
- Read the current phase, gate and evidence before acting.
- Honcho points here; it does not replace this map.
- Do not create a todo list, parallel tracker or replacement plan.
- Update this map only at meaningful phase boundaries: PASS, PARTIAL or FAILED, with an evidence pointer.
- Continue autonomously until completion or a genuine Warwick-only blocker.
- Before any clear, restart or handoff, ensure Honcho contains this exact path, current phase/gate and next action.
- **Tangents go in "SHIT TO DO" below. Do not chase them.** See the rule there — it binds even when the tangent comes from Warwick.

> **Privacy:** this map is in the public repo. It holds no email text and no employer names. All data,
> the answer key, results and the dated CPMAI project log live in the private tree:
> `C:\.fusion247\private\careerair\eval\set1\` (log: `PROJECT-LOG.md`).
> Owner session: "HP Careerair LLM Eval". Brief: https://claude.ai/artifact/5Q7K8XZrQUyffkXkeQ79CN

## STATUS

### ⚑ WORK CLASSIFICATION

| | Work type | Outcome | Owner | Model / effort | Blocks what | Done when |
|---|---|---|---|---|---|---|
| **FRONTIER** | BUILD | Set 1 frozen: model inputs + a separate answer key with gold (human-settled) and silver (two-model consensus) tiers, hashed | Larry (HP Careerair LLM Eval) | Opus 5.5 / medium | Phases 4–5 | `set1-inputs.jsonl`, `answer-key.jsonl` and `SHA256SUMS` exist; no input record carries a label or an application ID; every silver label has two independent agreeing labellers |
| **NEXT** | BUILD | One model-neutral runner that scores every contestant on the same frozen inputs | Keel (Work Order) | Opus 5.5 / medium | Phase 5 | A dry run on 5 items against gemma4:26b writes a results file with tag, digest, prompt hash, options and Ollama version per call |
| **SIDECAR / NON-BLOCKING** | ADMIN | Dated CPMAI project log and honest CV lines | Larry | — | — | — |
| **PARKED** | BUILD | Stream B (n8n Outlook intake, Paperclip Scout agent, Copilot Studio variant) | Larry | — | — | — |

## Goal contract and North Star

**North Star:** Warwick can say, on evidence, which model should do CareerAIR's email triage (category +
suggested application link), and whether any of it still needs Claude.

**Contract:** score the current keyword rules, `gemma4:26b`, `qwen3.8:27b`, a cheap cloud model and Opus
on the same frozen inputs, and report false rejects (target 0), rejection recall (≥90%),
interview/action-required recall (≥95%), linkage accuracy (a hint only, no pass mark), valid-JSON rate,
evidence-substring rate (≥98%), latency and cost. The targets were provisionally accepted by Warwick on
2026-09-25 ("I am but dont know") and are revisited at Phase 5.

## Current reality and verified assets (established by execution, 2026-09-25)

- Beast Ollama 0.34.4 reachable at `beast:11434`. Model digests are per the brief (not re-verified here).
- `careerair.email_message` has 495 rows, 121 of them in channel `application-updates` (the population).
  118 of the 121 are Outlook forwards. The rules label 41 as `unknown`.
- Ledger matching by quote or forwarded-header timestamp gives about 16 human-settled emails (gold).
- The pg driver is the estate's existing copy; the DSN comes from `fusion-capture-gateway.env` (read-only use, approved).
- No `codex` CLI on PATH on the HP. Codex runs through Tower.

## System map and product boundaries

Private tree `eval/set1/` → frozen JSONL inputs → runner → contestant endpoint (Beast Ollama / cloud
route / Opus in-session) → results JSONL → scorer (the only reader of `answer-key.jsonl`) → results table.
**Nothing in CareerAIR's runtime, Postgres or the Beast is changed.** Stream B and LiteLLM wiring are
out of the test path until after Phase 5.

## Known decisions (Warwick, 2026-09-25, all quoted in the private log)

1. Read-only DB access: approved. 2. Warwick's labelling time: not available. 3. Success targets:
provisionally accepted. 4. No Anthropic API. Cloud contestant = Codex via Tower (preferred) or OpenAI luna
via the LLM bridge. 5. Answer key = **Option B**: two independent models label; agreement → silver;
disagreement → excluded. The about 16 human-settled emails form a separate gold tier.

*Larry's consequent design (not Warwick's words):* Opus and the second labeller are scored as contestants
**on gold only**, because on silver they would be marking their own work. The local models and the rules
are scored on both tiers, and silver results are reported as "agreement with frontier consensus".

## Unresolved fog

- **The second labeller's route.** Tower/Codex was built for PR review. Whether a batch of about 150
  classification prompts fits it, or the LLM bridge (luna) is the practical route, is settled in Phase 3
  before any call is made.
- **Non-status negatives.** About 30 job-alert emails from channel `opportunities` are added as "other"
  items so false positives are measured.
- **Linkage candidate list:** applications open at the email's date, rebuilt from ledger history.
  Accuracy depends on the ledger's date coverage.

## Human dependencies

- Warwick: plan acceptance (now) and the final verdict read (Phase 5). None in between.
- "The Beast LLM Set Up": messaged before the first batch; owns any change on the Beast.
- Batches run in school hours. Connection refused or a timeout means "Beast busy": retry, never score it.

## Security, permissions, ownership, recovery

`private_surface: C:\.fusion247\private\careerair\**` plus the read-only DSN file. No email content
leaves the private tree except to the named contestant endpoints. No credentials are imported beyond the
DSN. The runner writes only under `eval/set1/`. Nothing is deleted or overwritten without Warwick's yes.

## Execution route

| Phase (CPMAI) | Outcome | Gate / evidence | Model |
|---|---|---|---|
| 1 Business understanding | Question, costs, success criteria | Warwick's decisions logged | Opus |
| 2 Data understanding | Population and gold size known | `tools/profile-*.mjs`, `work/ledger-matches.tsv` | Opus |
| 3 Data preparation | Set 1 frozen (FRONTIER) | Hash file; a leak check proves no input carries a label | Opus + 2nd labeller |
| 4 Model development | Model-neutral runner | 5-item dry run per contestant, per-call provenance | Keel |
| 5 Model evaluation | Results table + verdict | Scorer output; Veritas on the Phase 5 outcome | Opus |
| 6 Operationalise | Winner behind LiteLLM | Only after Phase 5, separate approval | — |

## Phase status

| Phase | Status | Model | Evidence |
|---|---|---|---|
| 1 | PARTIAL: decisions taken; targets provisional | Opus 5.5 | private `PROJECT-LOG.md` |
| 2 | PARTIAL: profiled; gold about 16 | Opus 5.5 | private `work/ledger-matches.tsv` |
| 3–6 | ⬜ NOT STARTED | | — |

## SHIT TO DO — parked tangents

| # | Parked item | Why it is not now |
|---|---|---|
| 1 | Stream B: n8n Outlook-original intake, Paperclip Scout, Copilot Studio | Must not sit in the test path before Phase 5 |
| 2 | S2 advert-screen benchmark (where Opus's recorded pre-correction verdicts belong) | Separate set |

## Resumable state

Fresh session: read this map, then the private `PROJECT-LOG.md`, then continue at the FRONTIER row.
