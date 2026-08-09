# Session close — 2026-08-09. True positions, and what the next Larry starts from.

## The heads that matter

| Branch | Head | State |
|---|---|---|
| `build-015/wp-b15-2` | **`a5e21e4`** | **THE SPINE.** Veritas Gate 1 **PASS** at `a5f5b5e`; `a5e21e4` adds the Codex F2 fix. PR **#103**. |
| `build-015/session-consolidation` | `367a9b2`+ | All evidence and receipts. PR **#102** — now truthfully evidence-only. |
| `governor/hotfix-permission-regression` | **`4299932`** | PR **#104**. **The permission fix.** |
| `build-015/browser-method-contract` | `b399c23` | Lane C3 complete — browser method + Ruling 2 at all three sites. |
| `build-015/lane-b1-answer-learning` | `a5f5b5e` | Branch cut, **no commits** — seam banked, awaits an envelope order. |
| `build-015/lane-d-confirmation-ingress` | `a5f5b5e` | Branch cut, **no commits** — same. |

**Stashes: 0.** Worktrees: `C:/Fusion247PKA` (governor branch), `-b15`, `-wo-c3`, `-wp-b15-2`, plus two agent worktrees at `a5f5b5e` with no commits.

## ⚠️ The ONE thing that must land first, and why

**PR #104.** The Allow-prompt regression recurred **three times in one day** and the cause was Larry's each time — twice a branch checkout silently reverted the live hook file, once the classifier was simply too narrow (`mkdir` classified `unknown` and emitted nothing).

**The hook reads `tools/governor/worktree-guard.mjs` from the WORKING TREE.** While the fix exists only on a branch, **any checkout of a branch without it silently disarms it.** Landing #104 on `main` is what makes it present on every branch. Until then the fix is a working-tree condition, not a durable property.

## What needs Warwick, and nothing else does

1. **Merge decisions** on #102, #103, #104.
2. **Authority to apply migration 017** to the household database — after the two read-only preflights in `2026-08-09-silas-017-production-preflight-and-acceptance-runbook.md`, one of which catches a **silent** failure where `shop_decision` could be born with UPDATE/DELETE and insert-only would be false on day one while every other check passed.
3. **Lane B1's product decision** — `forward_intent` can never reach the tap path, so a button tap expresses neither one-off nor forward intent. Three options with a recommendation are in `2026-08-09-next-week-executable-seams.md`.
4. **The fresh photograph** for live acceptance. **Shop 6 is unsuitable and hand-patching it is prohibited.**

## `/rotate` versus a fresh session — established, not theorised

**`/rotate` preserves nothing about the process.** It is a *banking* transaction: finish in-flight work, update the Wayfinder, commit and push, produce the session report, publish the Honcho continuity packet and **read it back**. It exists because `/clear` is irreversible with respect to context. It is followed by `/clear`, which resets the conversation **inside the same process**.

**What a fresh process additionally resets:** `.claude/settings.json` — hooks, permissions and slash commands are **read at session start**. A settings *edit* therefore does nothing until a new process starts. The 192 accumulated entries in `.claude/settings.local.json` are session-scoped permission state.

**What a fresh process does NOT buy — proven today, not asserted:** the hook **script** is re-read on every invocation. The registered command spawns `node …/worktree-guard.mjs` per `PreToolUse` event, and the guard was edited mid-session with its new behaviour taking effect on the very next tool call. **A restart is NOT required to activate a changed guard script**, and no one should be told otherwise.

**So the honest reason for a fresh session is clean context and clean session-scoped permission state — not activation.** The hook registration in tracked `.claude/settings.json` is already correct and unchanged.

## Where the product actually is

**Recognition works. Confirmation works — proven live on shop 6.** The decision spine is built and Gate-1 assured, with Terra bound and provenance truthful. **Nothing downstream of `BASKET_READY` has ever run.** No real shop has been through the new spine with a real gateway, a real card and a real answer — that is the fresh-photo acceptance, and it is the next real event.
