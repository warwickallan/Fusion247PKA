# BUILD-015 AsdAIr — retrospective release scope, and the assurance state it is reviewed against

**Authorised by Warwick, 2026-08-15:** *"recover the missing BUILD-015 external assurance… obtain ONE
bounded retrospective Codex release review through the existing canonical external-review route."*
**This is assurance recovery, not authority to reopen BUILD-015 as another programme.**

---

## 1. The boundary — and a correction to the base SHA

`981a054` (2026-07-28) is the last Codex **approval** for BUILD-015, but it **is NOT an ancestor of HEAD**
— it is the tip of the deleted branch `idea-012/asdair-stage1-durability`. Diffing from it would misreport
54 commits as removals.

**The honest on-main base is `443cad4`** — the squash-merge of PR #82, *"BUILD-015 AsdAIr — Stage 1"*,
2026-07-28. Proven equivalent for this surface: `git rev-parse 981a054:services/asdair` and
`443cad4:services/asdair` are the **same tree object** `d029a64d…`, and `git diff 981a054 443cad4 --
services/asdair/` is empty.

`443cad4..HEAD` is **1,248 commits**. Unrestricted that is 1,076 files / +274,617 — 73 % of it
documentation and unrelated services.

## 2. The consequential release surface — 209 files, +73,145 / −817

| Group | Size | Note |
|---|---|---|
| `services/asdair/**` executable | 186 files, +59,000/−737 | `handoff/` and `packet/` are **entirely new and never externally reviewed** |
| Migrations `services/asdair/db/` | 10 files, +1,967/−10 | includes edits to already-applied `001` and `004` (comment-only, verified) |
| Cockpit write path / runtime | 12 production + 8 gates, +13,633 | proxy, not shared library — `server.mjs:418` *"THE WRITE DOOR… the one route that can change something in AsdAIr"* |
| **Shared dependencies** | 3 files, +512/−17 | **the group that matters most** — see below |

**Shared dependencies, proven by call site, not assumed:**

- **`services/control-plane/wp-d-proof/asdairCommands.mjs`** — the actual list-item write, reached from
  `services/asdair/pipeline/deps.js:267,274`. A production AsdAIr module reaching outside its own service
  to execute the write that creates household shopping rows.
- **`services/obsidiwikai/src/core/models.mjs`** — the single LLM/vision/answer seam, six production call
  sites in `deps.js` and `interpret-list.js`. **This is the one file BUILD-006/VlogOps also touches**; the
  change is additive plus one default-valued signature extension, and `reason()` — the only function the
  other consumer uses — is untouched. Blast radius onto BUILD-006 is real but confined.

**Excluded and named** (867 files, +201,472): all `Deliverables/`, `Team Knowledge/`, `Builds/`, `Team/`,
`tools/`, `.claude/`, `.github/`; proofline, obsidiwikai (except `models.mjs`), fusion-tower, hub,
tower-baton, fusion-capture-gateway (separate bot, separate token, **no runtime import from AsdAIr**);
non-AsdAIr Cockpit apps; and `services/control-plane/tower-loop/` — the PR-review control plane itself,
which is not on Warwick's shopping journey, though it is precisely the machinery whose absence produced
the 1,248-commit gap.

## 3. Why ONE pass cannot honestly cover all of it

`reviewDiff.mjs` **truncates the diff at 60,000 bytes**, and its own comments record the failure that
makes this non-negotiable: *"the Phase 5 range returned `approve` with 20/20 rows over a TRUNCATED
diff."* **A truncated diff is a false green wearing a pass.**

Measured candidates:

| Candidate scope | Bytes | Verdict |
|---|---|---|
| Full consequential surface (209 files) | ~2.5 M | truncates catastrophically |
| Top-5 clusters (~49 files, +15,700) | ~500 k | truncates |
| Write path **including** migration 020 | **77,891** | **truncates — rejected** |
| **Write path excluding migration 020** | **45,132** | **fits, with headroom — SELECTED** |

## 4. The scope actually reviewed

```
BASE 443cad4b4a806cf6d170fe409f91d1eef14f0501
HEAD 915b15c3f02d3cea9e46f66e989a14903256979e
paths:
  services/control-plane/wp-d-proof/asdairCommands.mjs
  services/cockpit/asdair-list.mjs
  services/asdair/db/019_shopping_list_shop_identity.sql
  services/asdair/db/021_regulars_display_name.sql
  services/obsidiwikai/src/core/models.mjs
```

**Chosen because it is every path that can lose, corrupt or misattribute real household shopping data**,
plus the one file BUILD-006 shares. It covers risks R1, R3, R4, R5 and R8 of the ten identified.

**⛔ NOT COVERED, and stated out loud because scoping is a promise owed to the reader:**

- **Migration `020_shop_line_provenance_and_human_state.sql` (R2)** — carries an unconditional
  `update asdair.shop set human_state = case status … end` that `021`'s own header records as re-firing on
  every run. **This is a top-four risk and it is deliberately outside this pass** — including it truncates
  the diff and destroys the verdict's value. **It is the obvious next bounded pass if Warwick wants one.**
- `handoff/` (+5,935) and `packet/` (+2,753) — entirely new, never externally reviewed.
- `browser-runner/` (+1,074) — drives a real logged-in ASDA session. Its checkout/pay guards
  (`guards.cjs`, `commands.cjs`, `lease.cjs`) are **unchanged since the reviewed state**, so the guard is
  stable while the driver around it moved.
- `skill/` rulebook and planner (+5,690), `bot/` (+2,443), Cockpit UI `app.js`/`shopping.js` (+4,893).
- **All test and proof material** — so this review asserts the code, **not the evidence**.

## 5. Internal assurance coverage for this scope — the honest position

**Warwick's instruction: *"Where required internal assurance is absent or HOLD for the release claim being
made, resolve that honestly before treating Codex as a substitute for it."* It is not resolved by pretending.
It is resolved by disclosing it to the reviewer and to Warwick, which is what this section does.**

| Boundary | Latest verdict | Effect on this scope |
|---|---|---|
| Gate 2 — accepted user journey (`e0667dc`) | **FAIL**, never lifted | the release claim is **not** internally assured |
| Gate 2 — live readiness (`3696960`) | HOLD; browser-operation question explicitly FAIL | |
| Gate 2 — write action path (`3d453c6`, 2026-08-14) | **HOLD**, `head_moved_during_review: true` | **directly over this scope's write door** |
| Gate 1 — WP-B15-2 (`a5f5b5e`) | PASS | narrow, and 6 days + 4 migrations old |
| Migrations 018, 020, 021 | **no receipt names them at all** | |
| Migration 019 | named only in a HOLD row where Veritas records she **could not execute the assertions** | in scope, unassured |

**Codex is therefore reviewing state that has NOT passed internal assurance, and is told so in the claim.
Codex does not substitute for Veritas, and this document does not pretend it does.**

## 6. CI is not green on `main`

`cockpit-private-apps` has failed on **every push to `main`**, including before VlogOps existed:
`SELF-TEST FAIL — the household template anchor is missing; rewrite the mutations`
(`services/cockpit/render-vm-check.mjs --self-test`). **That gate is inside this release surface.** A
control failing its own self-test proves nothing about the screens it guards — and CI green is a stated
precondition before Codex may be invoked. **Disclosed in the claim rather than worked around.**

## 7. Disposition rules for whatever comes back

Per Warwick, 2026-08-15, and unchanged from existing rules:

- genuine **active in-scope blocking defect** → corrective work;
- **isolated BUILD-015 defect** → banked against BUILD-015, **without derailing VlogOps**;
- **shared/current-infrastructure defect** → report its actual impact on BUILD-006;
- **non-blocker** → recorded once, and continue.

**BUILD-006 may only be affected if the review finds a concrete defect in infrastructure BUILD-006
actually shares** — which, on the evidence in §2, means `models.mjs` and nothing else.
